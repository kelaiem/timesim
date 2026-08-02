#!/usr/bin/env node
// §73 tier two — DOES THE EXPLAINER STILL QUOTE THE SOURCE?
//
// explain.html's header promises "values quoted from src/*.js", and CLAUDE.md
// makes the page part of a §'s reconciliation when a constant moves. Until
// now that promise was kept by discipline: nothing compared the page's numbers
// to the source's. This is that promise as an exit code — the same move
// ci-battery.mjs made for standing rule 4.
//
// It reads BOTH sides statically (no browser, under a second):
//
//   source  every `const NAME = …` in src/*.js, including multi-declarations
//           (`const A = 30, B = 8;`). Literals are taken directly; expressions
//           are resolved ONLY when every identifier in them is already known
//           (so ALARM_PIN_DROP + CLEAR_MARGIN resolves, but anything reaching
//           into geometry does not).
//   page    every `<code>NAME = 1.23</code>`, `<code>NAME</code> 1.23`, the
//           feeler table's NAME|VALUE rows, and bare `NAME 1.23` in plates.
//
// DEGREES ARE NOT A DISAGREEMENT. A plate says `GONG_A1 135°` where the source
// holds radians; the comparison accepts a degree reading when it matches after
// conversion, and SAYS so, rather than reporting a false drift that would
// train the next reader to ignore this tool.
//
// Tolerance is 0.5% — the page rounds for display (0.37894… quoted as 0.379).
// A constant that genuinely moved will blow past that; a re-rounding will not.
//
// Exit 0 only when no comparable claim disagrees. Un-comparable claims are
// REPORTED, never silently passed: an instrument that hides what it cannot
// see teaches you to trust it further than it deserves.
//
// Usage: node tools/explain-quotes.mjs [--verbose]
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const VERBOSE = process.argv.includes('--verbose');
const TOL = 0.005;                    // 0.5% — display rounding, not drift
const DEG2RAD = Math.PI / 180;

// Names that look like constants but are page furniture, not source symbols.
const STOP = new Set(['PLATE', 'TODO', 'TABLE', 'BUILT', 'GPa']);

// ---- source ---------------------------------------------------------------
const lit = new Map();                // name -> { value, file }
const declared = new Map();           // every declared name, resolved or not
const pending = [];                   // [{ name, rhs, file }] awaiting resolution
for (const f of readdirSync(SRC).filter((x) => x.endsWith('.js'))) {
  const text = readFileSync(join(SRC, f), 'utf8');
  for (const m of text.matchAll(/^\s*(?:export\s+)?(?:const|let|var)\s+(.+?);\s*(?:\/\/.*)?$/gm)) {
    // one declaration statement may carry several bindings: A = 1, B = 2
    for (const part of m[1].split(/,(?![^(]*\))/)) {
      const b = part.match(/^\s*([A-Za-z_$][\w$]*)\s*=\s*(.+?)\s*$/);
      if (!b) continue;
      const [, name, rhs] = b;
      if (lit.has(name)) continue;
      const n = rhs.match(/^(-?\d+(?:\.\d+)?)$/);
      declared.set(name, { rhs, file: f });
      if (n) lit.set(name, { value: parseFloat(n[1]), file: f });
      else pending.push({ name, rhs, file: f });
    }
  }
}
// Resolve expressions over already-known names, to a fixed point. The guard is
// deliberately narrow: arithmetic, parentheses, Math.PI, and identifiers we
// have already resolved — anything else stays un-comparable by construction.
lit.set('Math.PI', { value: Math.PI, file: '(builtin)' });
for (let pass = 0; pass < 6; pass++) {
  let progress = false;
  for (const p of pending.slice()) {
    if (lit.has(p.name)) continue;
    const idents = [...p.rhs.matchAll(/[A-Za-z_$][\w$.]*/g)].map((x) => x[0]);
    if (!idents.every((id) => lit.has(id))) continue;
    if (!/^[\w\s.+\-*/()]+$/.test(p.rhs)) continue;
    let expr = p.rhs;
    for (const id of [...new Set(idents)].sort((a, b) => b.length - a.length))
      expr = expr.split(id).join(`(${lit.get(id).value})`);
    let v;
    try { v = Function(`"use strict";return (${expr});`)(); } catch { continue; }
    if (typeof v === 'number' && isFinite(v)) { lit.set(p.name, { value: v, file: p.file, derived: p.rhs }); progress = true; }
  }
  if (!progress) break;
}

// ---- page -----------------------------------------------------------------
const page = readFileSync(join(ROOT, 'explain.html'), 'utf8');
const claims = [];
const add = (name, value, deg, ctx) => {
  if (STOP.has(name)) return;
  claims.push({ name, value: parseFloat(value), deg: !!deg, ctx: ctx.replace(/\s+/g, ' ').slice(0, 76) });
};
for (const m of page.matchAll(/<code>([A-Za-z_][\w]{2,})\s*=\s*(-?\d+(?:\.\d+)?)\s*(°)?\s*(?:rad|mm|u)?\s*<\/code>/g)) add(m[1], m[2], m[3], m[0]);
for (const m of page.matchAll(/<code>([A-Z_][A-Z0-9_]{2,})<\/code>\s*(-?\d+(?:\.\d+)?)\s*(°)?/g)) add(m[1], m[2], m[3], m[0]);
for (const m of page.matchAll(/<code>([A-Z_][A-Z0-9_]{2,})<\/code>\s*<\/td>\s*<td[^>]*>\s*(-?\d+(?:\.\d+)?)/g)) add(m[1], m[2], null, m[0]);
for (const m of page.matchAll(/\b([A-Z][A-Z0-9_]{3,})\s+(-?\d+(?:\.\d+)?)\s*(°)?/g)) add(m[1], m[2], m[3], m[0]);

// ---- compare --------------------------------------------------------------
const seen = new Set(), agree = [], asDeg = [], bad = [], noDef = [], opaque = [];
for (const c of claims) {
  const k = `${c.name}=${c.value}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const d = lit.get(c.name);
  // A name the source DECLARES but whose value needs geometry to know is a
  // different situation from a name the source has never heard of, and the
  // report keeps them apart — collapsing them would train the reader to skim
  // past the line that actually matters.
  if (!d) { (declared.has(c.name) ? opaque : noDef).push({ ...c, decl: declared.get(c.name) }); continue; }
  const near = (a, b) => Math.abs(a - b) < 1e-9 || Math.abs(a - b) <= Math.abs(b) * TOL;
  if (near(c.value, d.value)) agree.push({ ...c, src: d });
  else if (near(c.value * DEG2RAD, d.value)) asDeg.push({ ...c, src: d });
  else bad.push({ ...c, src: d });
}
console.log(`source: ${lit.size} constants resolved from src/*.js (literals + derived)`);
console.log(`page:   ${seen.size} distinct numeric claims in explain.html\n`);
console.log(`agrees                 : ${agree.length}`);
console.log(`agrees (page in degrees): ${asDeg.length}`);
for (const r of asDeg) console.log(`     ${r.name}: page ${r.value}° = ${(r.value * DEG2RAD).toFixed(4)} rad, source ${r.src.value.toFixed(4)}`);
console.log(`declared, not statically comparable: ${opaque.length}  (value needs geometry — check by hand when it moves)`);
for (const r of opaque) console.log(`     ${r.name}: page says ${r.value}${r.deg ? '°' : ''}, source = ${r.decl.rhs.slice(0, 52)}  (${r.decl.file})`);
console.log(`no source definition   : ${noDef.length}  (prose names, or renamed — reported, not passed)`);
for (const r of noDef) console.log(`     ${r.name} ${r.value}   ${r.ctx}`);
console.log(`DISAGREES              : ${bad.length}${bad.length ? '  <-- the page and the source have drifted apart' : ''}`);
for (const r of bad) {
  const via = r.src.derived ? `  [${r.src.derived}]` : '';
  console.log(`     ${r.name}: page says ${r.value}, source says ${r.src.value}  (${r.src.file})${via}\n         ${r.ctx}`);
}
if (VERBOSE) for (const r of agree) console.log(`     ok  ${r.name} = ${r.value}  (${r.src.file}${r.src.derived ? ' — ' + r.src.derived : ''})`);

console.log(bad.length ? '\nFAIL — reconcile explain.html with the source (CLAUDE.md: the source is right)' : '\nPASS — every comparable quoted value matches src/*.js');
process.exit(bad.length ? 1 : 0);
