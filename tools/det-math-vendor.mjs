#!/usr/bin/env node
// §338 landing 2 — WRITES vendor/det-math.module.js and vendor/LICENSE-stdlib.txt:
// the engine-independent maths the build installs over Math (src/det-math.js).
//
//   node tools/det-math-vendor.mjs            write both files
//   node tools/det-math-vendor.mjs --check    rebuild in a temp dir and fail if
//                                             either committed file differs
//
// GENERATED, NEVER EDITED: re-run this. The bundle is the stdlib-js packages
// below (pure-JavaScript ports of FreeBSD msun / Sun fdlibm, Apache-2.0),
// pinned EXACTLY, installed into a throwaway directory and bundled by a pinned
// esbuild into one ES module. Everything about the output is a function of
// this file's table, so `--check` re-derives it byte for byte; a moved byte is
// a moved maths library, which moves the metal, and must be a deliberate act.
//
// WHY stdlib-js, measured before choosing (§338's record): on 40,000 inputs
// per function its results are bit-identical in V8 12.4, V8 15.3 and
// JavaScriptCore, where the engines' own Math disagrees by 1 ulp on 2–11% of
// inputs; it is within 2 ulp of V8's; it calls no transcendental builtin
// (the only Math it reads is abs/ceil/floor/round/sqrt, which IEEE 754 or
// ECMA-262 make exact) and uses no `**`. This tool re-asserts both of those on
// every run, because a dependency bump that started calling Math.exp would make
// the install recurse into itself, and one that used `**` would quietly ask the
// engine again.
//
// `log` is `@stdlib/math-base-special-ln`: `…-special-log` is log(x, base), and
// calling it with one argument returns NaN (which is how §338 found that the
// engines' NaN BIT PATTERNS differ too).
//
// stdlib's pow is NOT used for every input: its special values break ECMA-262
// (pow(NaN, 0), pow(±1, ±Infinity), ±0 and −Infinity bases, and an odd-integer
// test that is wrong for huge exponents). src/det-math.js applies the spec's
// rules itself and hands stdlib only a finite positive base.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'vendor/det-math.module.js');
const LIC = join(ROOT, 'vendor/LICENSE-stdlib.txt');

const ESBUILD = '0.28.2';
const ACORN = '8.19.0';
// export name → [package, exact version]
const FNS = {
  sin: ['@stdlib/math-base-special-sin', '0.3.1'],
  cos: ['@stdlib/math-base-special-cos', '0.3.1'],
  tan: ['@stdlib/math-base-special-tan', '0.3.1'],
  asin: ['@stdlib/math-base-special-asin', '0.2.4'],
  acos: ['@stdlib/math-base-special-acos', '0.2.4'],
  atan: ['@stdlib/math-base-special-atan', '0.2.4'],
  atan2: ['@stdlib/math-base-special-atan2', '0.3.1'],
  exp: ['@stdlib/math-base-special-exp', '0.2.5'],
  log: ['@stdlib/math-base-special-ln', '0.2.5'],
  log2: ['@stdlib/math-base-special-log2', '0.3.1'],
  log10: ['@stdlib/math-base-special-log10', '0.3.1'],
  log1p: ['@stdlib/math-base-special-log1p', '0.2.4'],
  expm1: ['@stdlib/math-base-special-expm1', '0.2.4'],
  pow: ['@stdlib/math-base-special-pow', '0.3.1'],
  cbrt: ['@stdlib/math-base-special-cbrt', '0.2.3'],
  sinh: ['@stdlib/math-base-special-sinh', '0.2.4'],
  cosh: ['@stdlib/math-base-special-cosh', '0.2.4'],
  tanh: ['@stdlib/math-base-special-tanh', '0.2.4'],
  asinh: ['@stdlib/math-base-special-asinh', '0.2.4'],
  acosh: ['@stdlib/math-base-special-acosh', '0.2.4'],
  atanh: ['@stdlib/math-base-special-atanh', '0.2.4'],
};
const EXACT_MATH = new Set(['abs', 'ceil', 'floor', 'round', 'sqrt', 'trunc', 'sign', 'min', 'max', 'fround', 'imul', 'clz32']);

function build(dir) {
  const pkgs = Object.values(FNS).map(([p, v]) => `${p}@${v}`);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'det-math-build', private: true, type: 'module' }));
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--save-exact', '--loglevel=error', `esbuild@${ESBUILD}`, `acorn@${ACORN}`, ...pkgs], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
  // Every installed @stdlib package's exact version, so the header names what
  // was actually bundled (transitive pins come from the packages' own ranges;
  // --check catches a resolution that moved, because the bytes move with it).
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'));
  const resolved = Object.entries(lock.packages).filter(([k]) => k.includes('node_modules/@stdlib/'))
    .map(([k, v]) => `${k.slice(k.lastIndexOf('node_modules/') + 13)}@${v.version}`).sort();
  writeFileSync(join(dir, 'entry.mjs'), Object.entries(FNS).map(([n, [p]]) => `export { default as ${n} } from '${p}';`).join('\n') + '\n');
  execFileSync(join(dir, 'node_modules/.bin/esbuild'), ['entry.mjs', '--bundle', '--format=esm', '--platform=neutral',
    '--main-fields=module,main', '--legal-comments=eof', '--charset=utf8', '--outfile=bundle.mjs', '--log-level=warning'], { cwd: dir, stdio: 'inherit' });
  const body = readFileSync(join(dir, 'bundle.mjs'), 'utf8');
  audit(body, createRequireFrom(dir)('acorn'));
  const header = `// GENERATED by tools/det-math-vendor.mjs (§338 landing 2). DO NOT EDIT: re-run the tool.
//
// Engine-independent elementary functions: stdlib-js's pure-JavaScript ports of
// FreeBSD msun / Sun fdlibm, bundled by esbuild ${ESBUILD}. Apache-2.0 (see
// LICENSE-stdlib.txt); the Sun Microsystems notices the ports carry are kept
// verbatim at the end of this file. src/det-math.js installs these over Math.
//
// Bundled packages (exact):
${resolved.map((r) => `//   ${r}`).join('\n')}
`;
  const licence = readFileSync(join(dir, 'node_modules', FNS.sin[0], 'LICENSE'), 'utf8');
  return { module: header + body, licence: `stdlib-js (https://github.com/stdlib-js/stdlib), as bundled in det-math.module.js.\n\n${licence}` };
}

import { createRequire } from 'node:module';
function createRequireFrom(dir) { return createRequire(join(dir, 'noop.js')); }

// The two properties the install depends on, re-asserted on every build.
function audit(src, acorn) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const bad = [];
  const walk = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if ((n.type === 'BinaryExpression' && n.operator === '**') || (n.type === 'AssignmentExpression' && n.operator === '**=')) bad.push(`\`${n.operator}\` at ${n.start}`);
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'Math') {
      const p = n.computed ? null : n.property.name;
      if (!p || !EXACT_MATH.has(p)) bad.push(`Math.${p ?? '[computed]'} at ${n.start}`);
    }
    for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  };
  walk(ast);
  if (bad.length) throw new Error(`det-math bundle is not engine-independent:\n  ${bad.join('\n  ')}`);
}

const check = process.argv.includes('--check');
const dir = mkdtempSync(join(tmpdir(), 'det-math-'));
try {
  const { module, licence } = build(dir);
  if (check) {
    const drift = [[OUT, module], [LIC, licence]].filter(([f, want]) => !existsSync(f) || readFileSync(f, 'utf8') !== want).map(([f]) => f.slice(ROOT.length));
    if (drift.length) { console.error(`det-math-vendor --check FAILED: ${drift.join(', ')} differ from a fresh build — re-run node tools/det-math-vendor.mjs`); process.exit(1); }
    console.log(`det-math-vendor --check OK — ${Object.keys(FNS).length} functions, ${module.length} bytes, reproduced byte for byte`);
  } else {
    writeFileSync(OUT, module); writeFileSync(LIC, licence);
    console.log(`wrote vendor/det-math.module.js (${module.length} bytes) and vendor/LICENSE-stdlib.txt`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
