#!/usr/bin/env node
// §338 landing 3 — THE BATTERY, NATIVELY: the same checks, the same gates, no browser.
//
//   node --import ./tools/native/loader.mjs tools/battery-native.mjs [--only a,b] [--report FILE] [--query 'k=v']
//
// Boots the build once in tools/native/host.mjs (main.js unchanged, the
// deterministic maths installed first) and runs every row of
// tools/battery-checks.mjs' BATTERY through inspect.js' own start/status
// protocol, exactly as the browser harness drives a page: the sweep hold taken
// first (prepPage's rule), each check started from resetInputs. Each row is
// judged by its OWN `fails` function, so there is one definition of a gate
// (standing rule 4) and this file holds none. A sliced check runs WHOLE, which
// is the browser harness's own reference (`--no-split`).
//
// §338's design constraints, which this file is the first to be held to:
//   · ONE TABLE. Nothing here registers a check. A row added to BATTERY runs
//     here the day it lands.
//   · A PAGE CHECK SAYS SO. A row whose `host` is 'page' needs a real page and
//     is SKIPPED here, by name and counted; the browser battery runs it. No row
//     carries the tag yet: every check in the table measured clean natively
//     (§338's record), so the list of skips reads empty until one needs it.
//   · NO KERNEL YET. Every check runs the JS path, three-mesh-bvh, which is
//     the reference any compiled kernel will be held to.
//
// --report FILE writes `ci-battery.mjs --report`'s `checks` shape
// ({name: {ms, result}} over the WHOLE table, `neverRan` for the rest), so
// tools/report-diff.mjs compares the two hosts leaf for leaf. Exits 0 only when
// every run row's gate passes and no row threw.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootNative } from './native/host.mjs';
import { BATTERY } from './battery-checks.mjs';

const argv = process.argv.slice(2);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const REPORT = opt('--report');
const QUERY = opt('--query') ?? '';
if (ONLY) for (const n of ONLY) if (!BATTERY.some((e) => e.name === n)) throw new Error(`--only names no BATTERY row: ${n}`);

const t0 = Date.now();
const { clock, ms: bootMs, warns } = await bootNative({ query: QUERY });
const I = await import('../src/inspect.js');
clock.beginSweepHold();   // battery-checks.mjs prepPage's rule: the whole run, geometry frozen
console.log(`booted in ${(bootMs / 1000).toFixed(1)} s, ${warns.length} boot warning(s)${warns.length ? ': ' + warns.join(' | ') : ''}`);

async function run(name, opts) {
  const s0 = Date.now();
  I.start(clock, name, opts);
  for (;;) {
    await new Promise((r) => setTimeout(r, 25));
    const st = I.status(name);
    if (st.state === 'done') return { result: st.result, ms: Date.now() - s0 };
    if (st.state === 'error') throw new Error(`check ${name} threw:\n${st.error}`);
  }
}

const results = new Map(), lines = [], skipped = [], threw = [];
let failed = 0;
for (const e of BATTERY) {
  if (ONLY && !ONLY.has(e.name)) continue;
  if (e.host === 'page') { skipped.push(e.name); continue; }
  let r;
  try { r = await run(e.name, e.opts); } catch (err) { threw.push(e.name); failed++; lines.push(`  THREW ${e.name}: ${String(err.message).split('\n').slice(0, 3).join(' | ')}`); continue; }
  results.set(e.name, r);
  const f = e.fails(r.result);
  const n = Array.isArray(f) ? f.length : (f ? 1 : 0);
  if (n) failed++;
  const note = e.note ? (() => { try { return ' — ' + e.note(r.result); } catch { return ''; } })() : '';
  lines.push(`  ${n ? 'FAIL' : 'PASS'}  ${e.name.padEnd(20)} ${String((r.ms / 1000).toFixed(1)).padStart(7)} s  ${e.gate}${n ? ` (${n} failing)` : ''}${note}`);
  console.log(lines[lines.length - 1]);
}
const wall = Date.now() - t0;
const ran = results.size;
console.log(`\n${ran - (failed - threw.length)}/${ran} gates pass natively · ${threw.length} threw · ${skipped.length} page-only skipped${skipped.length ? ` (${skipped.join(', ')})` : ''} · wall ${(wall / 1000).toFixed(0)} s (node ${process.version}, V8 ${process.versions.v8})`);
for (const l of lines.filter((x) => x.startsWith('  THREW'))) console.log(l);

if (REPORT) {
  const report = {
    host: `native ${process.platform}-${process.arch} node ${process.version}`,
    query: QUERY,
    checks: Object.fromEntries(BATTERY.map(({ name }) => [name, results.has(name) ? { ms: results.get(name).ms, result: results.get(name).result } : { neverRan: true }])),
  };
  writeFileSync(resolve(REPORT), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`report written to ${resolve(REPORT)}`);
}
process.exit(failed ? 1 : 0);
