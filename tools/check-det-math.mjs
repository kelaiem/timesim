#!/usr/bin/env node
// §338 landing 2 — IS THE BUILD'S MATHS THE REPOSITORY'S, NOT THE ENGINE'S?
//
// Acceptance, browser-free, a few seconds (exits non-zero on a failure):
//
//   1. index.html's entry module imports src/det-math-boot.js FIRST, so every
//      module evaluated after it computes with the installed functions.
//   2. No module on index.html's graph uses `**` or `**=`. Replacing Math.pow
//      cannot reach that operator: it is the engine's own exponentiation. The
//      graph is walked from the entry's imports through every static and
//      literal dynamic import (`three` resolved as the importmap resolves it),
//      so a new module is covered the day something imports it. Two vendored
//      sites are ALLOWED, each named with why it is exact; an allowed site that
//      disappears is stale and fails, so the list cannot outlive its reason.
//   3. vendor/det-math.module.js calls no Math function but the exact ones and
//      uses no `**` (tools/det-math-vendor.mjs asserts the same at generation;
//      this holds the committed bytes, offline).
//   4. The recorded known answers reproduce on this engine (src/det-math-kat.js
//      at its FULL size, the same check tools/det-math-kat.mjs --check runs).
//
//   node tools/check-det-math.mjs          check
//   node tools/check-det-math.mjs --fix    rewrite every `a ** b` on the graph
//                                          as `Math.pow(a, b)` (and `x **= y` as
//                                          `x = Math.pow(x, y)` for a plain name),
//                                          then check
//
// The controls: each run plants a `**` in a copy of a graph module's source
// and a transcendental call in a copy of the bundle, and FAILS unless both
// scans catch them.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IMPORTMAP = { three: 'vendor/three.module.js', 'three/addons/controls/OrbitControls.js': 'vendor/OrbitControls.js' };
const EXACT_MATH = new Set(['abs', 'ceil', 'floor', 'round', 'sqrt', 'trunc', 'sign', 'min', 'max', 'fround', 'imul', 'clz32', 'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2', 'random']);
// file → [source excerpt at the site, why it needs no deterministic pow]
const ALLOWED = [
  ['vendor/three.module.js', '( raycaster.far - raycaster.near ) ** 2', 'a raycaster range filter, not metal; with the default far = Infinity it is Infinity ** 2 = Infinity, a special value ECMA-262 fixes'],
  ['vendor/three-mesh-bvh.module.js', 'triCount > 2 ** 16', 'an integer power of two, exactly representable, which every IEEE pow returns exactly; it picks the index buffer\'s width'],
];

const isAllowed = (file, src, n) => ALLOWED.some(([f, snip]) => f === file && src.slice(Math.max(0, n.start - 60), n.end + 5).includes(snip));
const parse = (src, what = 'source') => { try { return acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true }); } catch (e) { throw new Error(`cannot parse ${what}: ${e.message}`); } };
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const k in node) {
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) walk(c, visit);
    else if (v && typeof v.type === 'string') walk(v, visit);
  }
}
const expSites = (src) => { const out = []; walk(parse(src), (n) => { if ((n.type === 'BinaryExpression' && n.operator === '**') || (n.type === 'AssignmentExpression' && n.operator === '**=')) out.push(n); }); return out; };

// The entry module: index.html's one inline <script type="module">.
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const m = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
if (!m) throw new Error('index.html carries no inline module script');
const entry = m[1];

function specifiers(src, what) {
  const out = [];
  walk(parse(src, what), (n) => {
    if ((n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration') && n.source) out.push(n.source.value);
    if (n.type === 'ImportExpression' && n.source.type === 'Literal') out.push(n.source.value);
  });
  return out;
}
const resolveSpec = (spec, fromFile) => IMPORTMAP[spec] ?? (spec.startsWith('.') ? normalize(join(dirname(fromFile), spec.split('?')[0])) : null);

function graph() {
  const seen = new Set(), stack = [];
  for (const s of specifiers(entry)) { const r = resolveSpec(s, 'index.html'); if (r) stack.push(r); }
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!/\.m?js$/.test(f)) continue;   // a JSON or other resource import: not code
    for (const s of specifiers(readFileSync(join(ROOT, f), 'utf8'), f)) { const r = resolveSpec(s, f); if (r && !seen.has(r)) stack.push(r); }
  }
  return [...seen].filter((f) => /\.m?js$/.test(f)).sort();   // JSON and other resource imports are data, not code
}

// --fix: innermost-first passes, so a nested `a ** b ** c` is rewritten from
// the inside out on a fresh parse each pass.
function fix(file) {
  let src = readFileSync(join(ROOT, file), 'utf8'), passes = 0, total = 0;
  for (;;) {
    const sites = expSites(src);
    const inner = sites.filter((n) => !sites.some((o) => o !== n && o.start >= n.start && o.end <= n.end));
    const todo = inner.filter((n) => !isAllowed(file, src, n));
    if (!todo.length) break;
    todo.sort((a, b) => b.start - a.start);
    for (const n of todo) {
      const L = src.slice(n.left.start, n.left.end), R = src.slice(n.right.start, n.right.end);
      let rep;
      if (n.type === 'BinaryExpression') rep = `Math.pow(${L}, ${R})`;
      else if (n.left.type === 'Identifier') rep = `${L} = Math.pow(${L}, ${R})`;
      else throw new Error(`${file}: \`**=\` on a non-identifier at ${n.start} needs a hand rewrite`);
      src = src.slice(0, n.start) + rep + src.slice(n.end);
      total++;
    }
    passes++;
    if (passes > 20) throw new Error(`${file}: --fix did not converge`);
  }
  if (total) writeFileSync(join(ROOT, file), src);
  return total;
}

function auditBundle(src) {
  const bad = [];
  walk(parse(src), (n) => {
    if ((n.type === 'BinaryExpression' && n.operator === '**') || (n.type === 'AssignmentExpression' && n.operator === '**=')) bad.push('`**`');
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'Math' && (n.computed || !EXACT_MATH.has(n.property.name))) bad.push(`Math.${n.computed ? '[computed]' : n.property.name}`);
  });
  return bad;
}

const fails = [];
const gate = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };

const files = graph();
if (process.argv.includes('--fix')) {
  let n = 0;
  for (const f of files) { const k = fix(f); if (k) { console.log(`  rewrote ${k} \`**\` in ${f}`); n += k; } }
  console.log(`--fix: ${n} site(s) rewritten as Math.pow`);
}

console.log(`index.html's module graph: ${files.length} modules`);
const first = specifiers(entry)[0];
gate(first === './src/det-math-boot.js', `the entry's first import is src/det-math-boot.js (it is ${first})`);

const found = [];
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  for (const n of expSites(src)) found.push({ f, at: src.slice(Math.max(0, n.start - 60), n.end + 5), line: src.slice(0, n.start).split('\n').length, ok: isAllowed(f, src, n) });
}
const allowedHit = ALLOWED.map(([f, snip]) => found.some((x) => x.f === f && x.ok && x.at.includes(snip)));
const stray = found.filter((x) => !x.ok);
gate(stray.length === 0, `no \`**\` on the graph outside the ${ALLOWED.length} allowed vendored sites${stray.length ? ` — ${stray.length} site(s): ` + stray.slice(0, 12).map((x) => `${x.f}:${x.line}`).join(', ') + (stray.length > 12 ? ', …' : '') + ' (`--fix` rewrites them)' : ''}`);
ALLOWED.forEach(([f, snip, why], i) => gate(allowedHit[i], `allowed site still present (else stale): ${f} \`${snip}\` — ${why}`));

const bundle = readFileSync(join(ROOT, 'vendor/det-math.module.js'), 'utf8');
const bad = auditBundle(bundle);
gate(bad.length === 0, `vendor/det-math.module.js calls only exact Math functions and no \`**\`${bad.length ? ' — ' + [...new Set(bad)].join(', ') : ''}`);

// Controls: each scan must see what is planted in a copy.
const probeFile = files.find((f) => f.startsWith('src/')) ?? files[0];
const planted = readFileSync(join(ROOT, probeFile), 'utf8') + '\nexport const __plantedPow = 2 ** 0.5;\n';
gate(expSites(planted).length > expSites(readFileSync(join(ROOT, probeFile), 'utf8')).length, `control: a \`**\` planted in ${probeFile} is seen`);
gate(auditBundle(bundle + '\nexport const __planted = Math.sin(1);\n').some((b) => b === 'Math.sin'), 'control: a Math.sin planted in the bundle is seen');

const { knownAnswers } = await import('../src/det-math.js');
const { KAT_FULL, KAT_FULL_N } = await import('../src/det-math-kat.js');
const got = knownAnswers(KAT_FULL_N);
const moved = Object.keys(KAT_FULL).filter((k) => got[k] !== KAT_FULL[k]);
gate(moved.length === 0, `known answers reproduce on this engine (${Object.keys(KAT_FULL).length} functions × ${KAT_FULL_N + 23} inputs)${moved.length ? ' — moved: ' + moved.join(', ') : ''}`);

console.log(fails.length ? `\nFAIL — ${fails.length} gate(s)` : '\nPASS — the build computes with the repository\'s maths');
process.exit(fails.length ? 1 : 0);
