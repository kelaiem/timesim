#!/usr/bin/env node
// §338 landing 3 — THE BATTERY, NATIVELY: the same checks, the same gates, no browser.
//
//   node --import ./tools/native/loader.mjs tools/battery-native.mjs
//        [--shards K] [--no-split] [--only a,b] [--report FILE] [--query 'k=v'] [--kernel js|wasm|shadow]
//        [--sweep js|native]
//
// Boots the build in tools/native/host.mjs (main.js unchanged, the deterministic
// maths installed first) and runs every row of tools/battery-checks.mjs' BATTERY
// through inspect.js' own start/status protocol, exactly as the browser harness
// drives a page: the sweep hold taken first (prepPage's rule), each check started
// from resetInputs. Each row is judged by its OWN `fails` function, so there is
// one definition of a gate (standing rule 4) and this file holds none.
//
// SHARDED like the browser battery, and planned by the SAME rules: the tasks are
// battery-split.mjs' buildTasks (a split check is one task per axis, §127) over
// battery-plan.mjs' COSTS column, balanced by battery-plan.mjs' partition (LPT,
// §81). Each shard is a worker_thread that boots its own copy of the movement
// (one isolate, one globalThis, one host each), and a split check's slices are
// merged by its own BATTERY row's `merge` against the axis roster the movement
// reports, the browser harness's merge exactly. The references the split must
// agree with are the same as the browser's: `--shards 1` (one process, no
// workers) and `--no-split` (each check whole). tools/report-diff.mjs holds a
// sharded report leaf-identical to the reference.
//
// §338's design constraints, which this file is held to:
//   · ONE TABLE. Nothing here registers a check. A row added to BATTERY runs
//     here the day it lands.
//   · A PAGE CHECK SAYS SO. A row whose `host` is 'page' needs a real page and
//     is SKIPPED here, by name and counted; the browser battery runs it. No row
//     carries the tag yet: every check measured clean natively (§338's record).
//   · THE JS PATH IS THE REFERENCE. Every check runs inspect.js' `Kernel`, whose
//     JS body (src/exact-mesh.js since landing 8) any compiled kernel is held to.
//
// --kernel (landing 5) picks the implementation behind inspect.js' `Kernel`: `js`
// (the reference and the default), `wasm` (src/kernel.js' compiled kernel), or
// `shadow` (js answers, wasm runs beside it on every call and any difference is
// tallied and printed).
//
// --report FILE writes `ci-battery.mjs --report`'s `checks` shape
// ({name: {ms, sliceMs?, result}} over the WHOLE table, `neverRan` for the rest).
// Exits 0 only when every run row's gate passes and nothing threw.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { BATTERY } from './battery-checks.mjs';
import { buildTasks } from './battery-split.mjs';
import { COSTS, partition } from './battery-plan.mjs';

// One shard's work, in whatever thread it runs: boot, hold, run each task.
async function runShard({ query, tasks, kernel = 'js', sweep = 'js' }) {
  const { bootNative } = await import('./native/host.mjs');
  const { clock, ms: bootMs, warns } = await bootNative({ query });
  const I = await import('../src/inspect.js');
  await I.useKernel(kernel);
  clock.beginSweepHold();   // battery-checks.mjs prepPage's rule: the whole run, geometry frozen
  // §338 landing 12 — `--sweep native`: the four checks the native sweep engine answers
  // run on it (tools/native-sweep/run.mjs), with the task's own options (a slice's axes
  // among them) after the canonical reset start() performs; every other row is unchanged.
  const N = sweep === 'native' ? await import('./native-sweep/run.mjs') : null;
  const NATIVE = N ? { inspection: N.runNativeInspection, clearances: N.runNativeClearances,
    expectedContacts: N.runNativeExpectedContacts, undeclaredClearance: N.runNativeUndeclared } : {};
  const out = [];
  for (const t of tasks) {
    const s0 = Date.now();
    if (NATIVE[t.name]) {
      if (t.opts.pairsTouching) throw new Error(`--sweep native: ${t.name} has no restricted (pairsTouching) route`);
      try {
        clock.resetInputs();
        const { payload } = await NATIVE[t.name](clock, I, { axes: t.opts.axes, ...(t.name === 'inspection' ? { includeExcluded: !!t.opts.includeExcluded } : {}) });
        out.push({ key: t.key, result: payload, ms: Date.now() - s0 });
      } catch (err) { out.push({ key: t.key, error: String(err && err.stack || err) }); }
      continue;
    }
    I.start(clock, t.name, t.opts);
    for (;;) {
      await new Promise((r) => setTimeout(r, 25));
      const st = I.status(t.name);
      if (st.state === 'done') { out.push({ key: t.key, result: st.result, ms: Date.now() - s0 }); break; }
      if (st.state === 'error') { out.push({ key: t.key, error: String(st.error) }); break; }
    }
  }
  const X = await import('../src/exact-mesh.js');   // §338 landing 9 — the js trees: built fresh, or refitted from a family
  return { bootMs, warns, axes: I.AXES.map((a) => ({ name: a.name, n: a.n })), out, kernel: I.kernelStats(), trees: { ...X.exactStats } };
}

if (!isMainThread) {
  // Silence the checks' own console tables inside a worker; the parent prints the verdicts.
  // console.warn too: main.js wraps it at boot to collect the boot warnings it
  // returns (rule 6), so muting the sink loses none of them, only three-mesh-bvh's
  // coplanar-triangle chatter, which main.js' own filter already drops.
  console.log = () => {}; console.table = () => {}; console.warn = () => {};
  runShard(workerData).then((r) => { parentPort.postMessage(r); }, (err) => { parentPort.postMessage({ fatal: String(err && err.stack || err) }); });
} else {
  const argv = process.argv.slice(2);
  const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
  const REPORT = opt('--report');
  const QUERY = opt('--query') ?? '';
  const SPLIT = !argv.includes('--no-split');
  const SHARDS = Number(opt('--shards') ?? Math.min(4, availableParallelism()));
  const KERNEL = opt('--kernel') ?? 'js';
  const SWEEP = opt('--sweep') ?? 'js';
  if (!['js', 'native'].includes(SWEEP)) throw new Error('--sweep wants js or native');
  if (!['js', 'wasm', 'shadow'].includes(KERNEL)) throw new Error('--kernel wants js, wasm or shadow');
  if (ONLY) for (const n of ONLY) if (!BATTERY.some((e) => e.name === n)) throw new Error(`--only names no BATTERY row: ${n}`);
  if (!(SHARDS >= 1)) throw new Error('--shards wants a positive integer');

  const t0 = Date.now();
  const rows = BATTERY.filter((e) => (!ONLY || ONLY.has(e.name)) && e.host !== 'page');
  const skipped = BATTERY.filter((e) => (!ONLY || ONLY.has(e.name)) && e.host === 'page').map((e) => e.name);
  const tasks = buildTasks(rows, SPLIT, COSTS);
  const plain = (t) => ({ key: t.key, name: t.name, opts: t.opts });
  let shards = [];
  if (SHARDS === 1) {
    // The reference path: one process, no workers.
    const r = await runShard({ query: QUERY, tasks: tasks.map(plain), kernel: KERNEL, sweep: SWEEP });
    shards = [{ ...r, tasks: tasks.map((t) => t.key), cost: tasks.reduce((a, t) => a + t.cost, 0) }];
  } else {
    const parts = partition(tasks, Math.min(SHARDS, tasks.length));
    console.log(`plan: ${tasks.length} tasks (${SPLIT ? 'split by axis' : 'whole checks'}) over ${parts.length} worker(s), LPT on COSTS: ${parts.map((p) => `${p.cost.toFixed(0)} s`).join(' / ')}`);
    // Each worker re-runs this file with the same --import, so it must register
    // the loader for itself: clear the guard the parent's registration set.
    const env = { ...process.env, __TIMESIM_NATIVE_LOADER__: '' };
    shards = await Promise.all(parts.map((p) => new Promise((res, rej) => {
      const w = new Worker(new URL(import.meta.url), { workerData: { query: QUERY, tasks: p.entries.map(plain), kernel: KERNEL, sweep: SWEEP }, env, execArgv: process.execArgv });
      w.once('message', (m) => (m.fatal ? rej(new Error(`a shard died: ${m.fatal}`)) : res({ ...m, tasks: p.entries.map((t) => t.key), cost: p.cost })));
      w.once('error', rej);
      w.once('exit', (code) => { if (code) rej(new Error(`a shard exited ${code}`)); });
    })));
  }

  const got = new Map();
  for (const s of shards) for (const o of s.out) got.set(o.key, o);
  const axisMeta = shards[0].axes;
  const warns = [...new Set(shards.flatMap((s) => s.warns))];
  console.log(`booted ${shards.length} shard(s) in ${shards.map((s) => (s.bootMs / 1000).toFixed(1)).join(' / ')} s, ${warns.length} boot warning(s)${warns.length ? ': ' + warns.join(' | ') : ''}`);

  // Assemble each row's result: whole tasks as they came back, split checks merged
  // by their own `merge`, every slice required (a dead slice never merges into a
  // clean report of work that did not happen, the browser harness's rule).
  const results = new Map(), threw = [], lines = [];
  const sliceMs = new Map();
  for (const e of rows) {
    const mine = tasks.filter((t) => t.name === e.name);
    const parts = mine.map((t) => got.get(t.key));
    const err = parts.find((p) => !p || p.error);
    if (err) { threw.push(e.name); lines.push(`  THREW ${e.name}: ${err ? String(err.error || 'no payload').split('\n').slice(0, 3).join(' | ') : 'no payload'}`); continue; }
    if (mine.length === 1 && !mine[0].slice) { results.set(e.name, { result: parts[0].result, ms: parts[0].ms }); continue; }
    try {
      results.set(e.name, { result: e.merge(mine.map((t, i) => ({ slice: t.slice, result: parts[i].result })), axisMeta), ms: parts.reduce((a, p) => a + p.ms, 0) });
      sliceMs.set(e.name, Object.fromEntries(mine.map((t, i) => [t.slice, parts[i].ms])));
    } catch (er) { threw.push(e.name); lines.push(`  THREW ${e.name}: the slices did not merge: ${er.message}`); }
  }

  let failed = threw.length;
  for (const e of rows) {
    const r = results.get(e.name);
    if (!r) continue;
    const f = e.fails(r.result);
    const n = Array.isArray(f) ? f.length : (f ? 1 : 0);
    if (n) failed++;
    const note = e.note ? (() => { try { return ' — ' + e.note(r.result); } catch { return ''; } })() : '';
    console.log(`  ${n ? 'FAIL' : 'PASS'}  ${e.name.padEnd(20)} ${String((r.ms / 1000).toFixed(1)).padStart(7)} s  ${e.gate}${n ? ` (${n} failing)` : ''}${note}`.slice(0, 400));
  }
  for (const l of lines) console.log(l);
  { const ts = (k) => shards.reduce((a, x) => a + ((x.trees && x.trees[k]) || 0), 0); console.log(`exact trees (js body): ${ts('builds')} built, ${ts('refits')} refitted from a family`); }
  if (KERNEL !== 'js') {
    const ks = shards.map((s) => s.kernel);
    console.log(`kernel: ${KERNEL}`);
    if (KERNEL === 'shadow') {
      const es = (k) => ks.reduce((a, x) => a + ((x.exact && x.exact[k]) || 0), 0);
      console.log(`kernel shadow: ${es('distance')} distance and ${es('meets')} intersection calls, ${es('differ')} differing from wasm (the reference is the kernel's algorithm ported, so anything but 0 is a defect); time js ${(es('refMs') / 1000).toFixed(1)} s, wasm ${(es('wasmMs') / 1000).toFixed(1)} s`);
      for (const x of ks.flatMap((k) => (k.exact && k.exact.samples) || []).slice(0, 6)) console.log(`  differs: ${x.kind} js ${x.ref} wasm ${x.kernel}`);
    }
  }
  const wall = Date.now() - t0;
  const ran = results.size;
  const checkMs = [...results.values()].reduce((a, r) => a + r.ms, 0);
  console.log(`\n${ran - (failed - threw.length)}/${rows.length} gates pass natively · ${threw.length} threw · ${skipped.length} page-only skipped${skipped.length ? ` (${skipped.join(', ')})` : ''} · wall ${(wall / 1000).toFixed(0)} s, checks ${(checkMs / 1000).toFixed(0)} s across ${shards.length} shard(s)${SPLIT ? ', split by axis' : ''} (node ${process.version}, V8 ${process.versions.v8})`);

  if (REPORT) {
    const report = {
      host: `native ${process.platform}-${process.arch} node ${process.version}`, kernel: KERNEL, sweep: SWEEP,
      query: QUERY, shards: shards.length, split: SPLIT,
      checks: Object.fromEntries(BATTERY.map(({ name }) => [name, results.has(name)
        ? { ms: results.get(name).ms, ...(sliceMs.has(name) ? { sliceMs: sliceMs.get(name) } : {}), result: results.get(name).result }
        : { neverRan: true }])),
    };
    writeFileSync(resolve(REPORT), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report written to ${resolve(REPORT)}`);
  }
  process.exit(failed ? 1 : 0);
}
