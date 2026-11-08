#!/usr/bin/env node
// §338 landing 3 (§227's precondition) — ARE TWO BATTERY REPORTS THE SAME VERDICT, LEAF FOR LEAF?
//
//   node tools/report-diff.mjs A.json B.json [--checks a,b] [--max N]
//
// Acceptance (exits non-zero on any difference). Reads two `--report` files
// (tools/ci-battery.mjs' or tools/battery-native.mjs', which share the
// `checks: {name: {ms, result}}` shape) and compares every check BOTH ran,
// every leaf of its payload, EXACTLY: numbers by Object.is (so −0 and +0
// differ, NaN equals NaN), strings and booleans by value, arrays by length and
// position, objects by key set. Timing is excluded by NAME, never by guessing:
// a check row's own `ms` and `sliceMs`, and inside payloads any key named `ms`,
// `elapsedMs`, `wallMs` or ending `Ms` whose value is a number (the payloads'
// own timers), each excluded leaf COUNTED and printed so an exclusion that grew
// to swallow a real number shows up as a count.
//
// §227 compared two architectures' reports at summary granularity and refused
// to call that portability, because §152's incremental path inherits the float
// minima the summaries never print. This compares the ~10^5 leaves themselves.
// It prints the LEAF COUNT it compared, so a diff of nothing cannot pass for a
// clean one, and a check one side never ran is listed rather than passed.
// Its control: each run plants a one-ulp change in one numeric leaf of a copy of
// A and fails unless the comparison reports exactly that leaf.
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const files = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const MAX = Number(opt('--max') ?? 8);
const ONLY = opt('--checks') ? new Set(opt('--checks').split(',')) : null;
if (files.length !== 2) { console.error('usage: report-diff.mjs A.json B.json [--checks a,b] [--max N]'); process.exit(2); }
const [A, B] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));

const TIMING = (k, v) => typeof v === 'number' && (k === 'ms' || k === 'sliceMs' || k === 'elapsedMs' || k === 'wallMs' || /Ms$/.test(k));
function compare(a, b, path, acc) {
  if (typeof a === 'number' && typeof b === 'number') { acc.leaves++; if (!Object.is(a, b)) acc.diffs.push({ path, a, b }); return; }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    acc.leaves++;
    if (a !== b) acc.diffs.push({ path, a, b });
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) { acc.leaves++; acc.diffs.push({ path, a: Array.isArray(a) ? 'array' : 'object', b: Array.isArray(b) ? 'array' : 'object' }); return; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) acc.diffs.push({ path: `${path}.length`, a: a.length, b: b.length });
    for (let i = 0; i < Math.min(a.length, b.length); i++) compare(a[i], b[i], `${path}[${i}]`, acc);
    return;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (TIMING(k, a[k]) || TIMING(k, b[k])) { acc.timing++; continue; }
    if (!(k in a) || !(k in b)) { acc.diffs.push({ path: `${path}.${k}`, a: k in a ? 'present' : 'absent', b: k in b ? 'present' : 'absent' }); continue; }
    compare(a[k], b[k], `${path}.${k}`, acc);
  }
}
function diffReports(A, B) {
  const out = { checks: [], leaves: 0, timing: 0, diffs: 0, oneSided: [] };
  for (const name of Object.keys(A.checks)) {
    if (ONLY && !ONLY.has(name)) continue;
    const a = A.checks[name], b = B.checks?.[name];
    if (!b) { out.oneSided.push(`${name}: absent from B`); continue; }
    if (a.neverRan || b.neverRan) { if (a.neverRan !== b.neverRan) out.oneSided.push(`${name}: ran in ${a.neverRan ? 'B' : 'A'} only`); continue; }
    const acc = { leaves: 0, timing: 0, diffs: [] };
    compare(a.result, b.result, name, acc);
    out.checks.push({ name, ...acc });
    out.leaves += acc.leaves; out.timing += acc.timing; out.diffs += acc.diffs.length;
  }
  return out;
}

// The control: one ulp in one numeric leaf of a copy of A must be found, and only it.
{
  const C = JSON.parse(JSON.stringify(A));
  let planted = null;
  const plant = (o, path) => {
    if (planted || o === null || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (planted) return;
      const v = o[k];
      if (typeof v === 'number' && Number.isFinite(v) && v !== 0 && !TIMING(k, v)) {
        const f = new Float64Array([v]), u = new BigInt64Array(f.buffer); u[0] += 1n; o[k] = f[0]; planted = `${path}.${k}`; return;
      }
      plant(v, `${path}.${k}`);
    }
  };
  for (const [name, row] of Object.entries(C.checks)) { if (!row.neverRan && (!ONLY || ONLY.has(name))) plant(row.result, name); if (planted) break; }
  const d = diffReports(A, C);
  const ok = planted && d.diffs === 1 && d.checks.some((c) => c.diffs.some((x) => x.path === planted));
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  control: a one-ulp change planted at ${planted ?? '(no numeric leaf)'} is the one difference found`);
  if (!ok) process.exit(1);
}

const d = diffReports(A, B);
for (const c of d.checks) {
  console.log(`  ${c.diffs.length ? 'DIFF' : 'same'}  ${c.name.padEnd(20)} ${String(c.leaves).padStart(8)} leaves${c.timing ? `, ${c.timing} timing excluded` : ''}${c.diffs.length ? `, ${c.diffs.length} differ` : ''}`);
  for (const x of c.diffs.slice(0, MAX)) console.log(`          ${x.path}: ${JSON.stringify(x.a)} ≠ ${JSON.stringify(x.b)}`);
  if (c.diffs.length > MAX) console.log(`          … ${c.diffs.length - MAX} more`);
}
for (const s of d.oneSided) console.log(`  ONE-SIDED  ${s}`);
console.log(`\n${d.diffs ? 'FAIL' : 'PASS'} — ${d.checks.length} checks, ${d.leaves} leaves compared exactly (${d.timing} timing leaves excluded by name), ${d.diffs} difference(s)${d.oneSided.length ? `, ${d.oneSided.length} one-sided` : ''}`);
process.exit(d.diffs || d.oneSided.length ? 1 : 0);
