#!/usr/bin/env node
// §338 landing 14 — THE LOCAL PRE-FLIGHT: the whole battery CI's `battery` job gates,
// run natively on this machine before a push. No browser, no dev server.
//
//   node --import ./tools/native/loader.mjs tools/battery-local.mjs
//        [--shards K] [--sweep js|native] [--kernel js|wasm|shadow] [--only a,b]
//        [--report FILE] [--points-out FILE] [--no-points]
//
// WHAT IT GATES is what ci-battery.mjs gates, because it does not gate anything itself:
// it measures the same things natively and hands them to ci-battery.mjs' own `assemble`,
// the one gate loop the single process and the collector already share (§127 tier 3).
// So rule 4's checks, boot silence on every shard, the slice merges, the roster of
// registered checks, the fingerprint and per-unit key across two virgin boots, the share
// boot, the spec tier (every SPEC_POINTS row built, finite, the identity silent, declared
// warning sets exact), the point tier (every swept point measured and judged), the three
// validated-configs gates and the paths-ignore walk are the browser battery's own
// predicates over native payloads, and a new gate there is a gate here the day it lands.
//
// WHAT FEEDS THEM, each read where the browser reads it:
//   · the BATTERY table      sharded by battery-plan.mjs' partition, one worker per shard
//                            (tools/native/shard.mjs, the runner battery-native.mjs uses);
//                            the anchors read on shard 0
//   · boot B and the share   tools/native/battery-job.mjs, after the shards
//   · the spec tier          one boot per SPEC_POINTS row, in a pool of K lanes
//   · the point tier         one boot per swept point, the three sweeps restricted to the
//                            units it changes against boot B's key (sweepPoint's law),
//                            unioned and judged by `assemble` (judgePoint)
//
// THE NATIVE HOST IS HELD TO THE PAGE: native-host.yml holds a native boot's fingerprint
// and digests to Chromium's and battery-native-*'s reports leaf for leaf to the browser's,
// so a verdict here is CI's verdict on the same tree. What it does NOT measure is what the
// native host never claims (tools/native/host.mjs's header): the chrome, the HUD, offline,
// boot-yield, the screenshots, and the separate probe jobs in battery.yml. A green run
// here is a green `battery` gate list, not a green pull request.
//
// --sweep native runs inspection, clearances, expectedContacts and undeclaredClearance on
// the native sweep engine (landing 12), whose binary tools/native-sweep/build.mjs builds;
// it is the default when that binary is present and newer than its sources. The point
// tier's sweeps are restricted (`pairsTouching`), which the engine refuses, so they run
// in JS either way. --only narrows the table to those checks and the spec tier to the
// identity and drops the point tier (ci-battery.mjs' rule). --no-points drops the point
// tier alone (the gates that need it then say it did not run). Exits non-zero when any
// gate fails, exactly as ci-battery.mjs does.
//
// §338 landing 15 — INCREMENTAL, by §152's own rule. A whole run that passes every gate
// leaves a BASELINE in .battery-local/ (gitignored): its report, its points file and the
// digest of the code that produced them. The next run, if that baseline qualifies, takes
// the per-unit key on shard 0 (as it always did), and every shard restricts the five
// RESTRICTABLE sweeps to the units that changed against the baseline's key
// (`pairsTouching`, on the JS sweep: the engine has no restricted route), which
// `assemble` UNIONS with the baseline's rows before any gate reads them, exactly as a CI
// pull request's run. Each swept point unions against its own stored payload
// (`decidePointMode`, the same judge). The spec tier and every check that cannot be
// restricted run whole. Every doubt runs whole and says why: no baseline, an unreadable
// or misshapen one, any change to the code that produces or reshapes inheritable rows
// (LOCAL_CODE_FILES below: CI's CHECK_CODE_FILES and battery-points.mjs, and the native
// code that produced the baseline's rows). Only a WHOLE run writes a baseline, and only
// when it passed, so an incremental run can never be the base of the next (§152's rule
// against chaining a key error forward). --whole forces a whole run; --baseline DIR
// reads and writes another directory.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { BATTERY } from './battery-checks.mjs';
import { buildTasks } from './battery-split.mjs';
import { COSTS, partition } from './battery-plan.mjs';
import { REPORT_FORMAT_VERSION, SPEC_POINTS, SWEEP_POINTS, assemble, checkCodeDigest, pointsCodeDigest, sharePayload, specBootTimeoutMs } from './ci-battery.mjs';
import { POINTS_FORMAT_VERSION, decidePointMode } from './battery-points.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const KNOWN = new Set(['--shards', '--sweep', '--kernel', '--only', '--report', '--points-out', '--no-points', '--no-split', '--whole', '--baseline']);
for (const a of argv) if (a.startsWith('--') && !KNOWN.has(a)) throw new Error(`battery-local: unknown flag ${a}`);
const SHARDS = Number(opt('--shards') ?? Math.min(4, availableParallelism()));
if (!Number.isInteger(SHARDS) || SHARDS < 1) throw new Error('--shards wants a positive integer');
const KERNEL = opt('--kernel') ?? 'js';
if (!['js', 'wasm', 'shadow'].includes(KERNEL)) throw new Error('--kernel wants js, wasm or shadow');
const ONLY = opt('--only') ? new Set(opt('--only').split(',').filter(Boolean)) : null;
if (ONLY) for (const n of ONLY) if (!BATTERY.some((e) => e.name === n)) throw new Error(`--only names no BATTERY row: ${n} (checks, not slices, here)`);
const SPLIT = !argv.includes('--no-split');
const NO_POINTS = argv.includes('--no-points') || !!ONLY;

// The engine's binary is a build product; a stale one would run yesterday's loop.
const ENGINE = join(ROOT, 'tools/native-sweep/build/sweep');
const ENGINE_SRC = ['tools/native-sweep/sweep.cpp', 'tools/kernel/kernel.cpp'].map((f) => join(ROOT, f));
const engineFresh = existsSync(ENGINE) && ENGINE_SRC.every((f) => statSync(f).mtimeMs <= statSync(ENGINE).mtimeMs);
const SWEEP = opt('--sweep') ?? (engineFresh ? 'native' : 'js');
if (!['js', 'native'].includes(SWEEP)) throw new Error('--sweep wants js or native');
if (SWEEP === 'native' && !engineFresh) {
  throw new Error(`--sweep native: the engine at ${ENGINE} is ${existsSync(ENGINE) ? 'older than its sources' : 'not built'} — `
    + 'KERNEL_PYTHON=~/zig/bin/python node tools/native-sweep/build.mjs');
}
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

// ---- §338 landing 15: the local baseline -------------------------------------------
// The code a stored row was produced by, beyond CI's two lists: the native code that ran
// the baseline's sweeps and boots (held leaf for leaf to the JS sweeps by native-host.yml,
// and digested anyway, because a stored row is inherited on this file's word alone).
const LOCAL_FORMAT = 1;
const LOCAL_CODE_FILES = ['tools/native-sweep/sweep.cpp', 'tools/native-sweep/run.mjs', 'tools/kernel/kernel.cpp',
  'src/exact-mesh.js', 'tools/native/host.mjs', 'tools/native/shard.mjs', 'tools/native/battery-job.mjs'];
const localCode = () => ({ ...pointsCodeDigest(),
  ...Object.fromEntries(LOCAL_CODE_FILES.map((f) => [f, createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex')])) });
const BASE_DIR = resolve(opt('--baseline') ?? join(ROOT, '.battery-local'));
const readJson = (f) => { try { return JSON.parse(readFileSync(join(BASE_DIR, f), 'utf8')); } catch { return null; } };
// Qualify the baseline, or say why not. Never throws: a doubt is a whole run.
function qualify() {
  if (argv.includes('--whole')) return { why: '--whole' };
  const meta = readJson('meta.json');
  if (!meta) return { why: `no baseline in ${BASE_DIR}` };
  if (meta.format !== LOCAL_FORMAT) return { why: `the baseline is format ${meta.format}, this runner writes ${LOCAL_FORMAT}` };
  const code = localCode();
  const moved = Object.keys(code).filter((f) => meta.code?.[f] !== code[f]);
  if (moved.length) return { why: `the code that produces inheritable rows moved since the baseline (${moved.join(', ')})` };
  const report = readJson('report.json');
  if (!report || report.formatVersion !== REPORT_FORMAT_VERSION || !report.digests?.units || report.restrictedTo) {
    return { why: 'the baseline report is missing, at another format, carries no key, or is itself restricted' };
  }
  const points = readJson('points.json');
  return { report, points, meta };
}
const BASE = qualify();
const INCREMENTAL = !!BASE.report;

// One worker per boot: main.js evaluates once per isolate. Each worker re-registers the
// loader for itself, so the parent's registration guard is cleared (battery-native's rule).
const JOB = new URL('./native/battery-job.mjs', import.meta.url);
const env = { ...process.env, __TIMESIM_NATIVE_LOADER__: '' };
// `bootMs` bounds the boot (the time to its 'booted' message), `runMs` what follows; null
// is no bound. A job that runs out is terminated and answers `{ timedOut }`.
function job(data, { bootMs = null, runMs = null, against = null, onRestriction = null } = {}) {
  return new Promise((res) => {
    const w = new Worker(JOB, { workerData: data, env, execArgv: process.execArgv });
    let timer = null;
    const arm = (ms, phase) => { clearTimeout(timer); timer = ms === null ? null : setTimeout(() => finish({ timedOut: phase, ms }), ms); };
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); w.terminate().catch(() => {}); res(r); };
    arm(bootMs, 'boot');
    w.on('message', (m) => {
      if (m.type === 'booted') arm(runMs, 'run');
      else if (m.type === 'against') against.then((d) => w.postMessage(d), () => w.postMessage(null));
      else if (m.type === 'restriction') onRestriction(m.changed).then((r) => w.postMessage(r));
      else if (m.type === 'done') finish(m.fatal ? { fatal: m.fatal } : { result: m.result });
    });
    w.once('error', (err) => finish({ fatal: String(err && err.stack || err) }));
    w.once('exit', (code) => finish({ fatal: `the worker exited ${code} without answering` }));
  });
}
// K lanes over a list of thunks, in order.
async function pool(thunks, k) {
  const out = new Array(thunks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(k, thunks.length) }, async () => {
    for (;;) { const i = next++; if (i >= thunks.length) return; out[i] = await thunks[i](); }
  }));
  return out;
}

const t0 = Date.now();
console.log(INCREMENTAL
  ? `incremental against the baseline in ${BASE_DIR} (a whole run at ${BASE.meta.at}, tree ${BASE.meta.tree ?? 'unnamed'})`
  : `whole run: ${BASE.why}`);
console.log(`local pre-flight: ${SHARDS} lane(s), sweep ${SWEEP}${SWEEP === 'js' && !engineFresh && !opt('--sweep') ? ' (no fresh engine binary)' : ''}, kernel ${KERNEL}`
  + `${ONLY ? `, --only ${[...ONLY].join(',')}` : ''}${NO_POINTS ? ', no point tier' : ''} (node ${process.version}, ${process.platform}-${process.arch})`);

// ---- 1. the BATTERY table, sharded, the anchors on shard 0 --------------------------
const battery = BATTERY.filter((e) => !ONLY || ONLY.has(e.name));
const pageOnly = battery.filter((e) => e.host === 'page').map((e) => e.name);
const tasks = buildTasks(battery.filter((e) => e.host !== 'page'), SPLIT, COSTS);
const parts = partition(tasks, Math.min(SHARDS, tasks.length));
const plain = (t) => ({ key: t.key, name: t.name, opts: t.opts });
console.log(`battery: ${tasks.length} task(s) over ${parts.length} shard(s), LPT on COSTS: ${parts.map((p) => `${p.cost.toFixed(0)} s`).join(' / ')}`
  + (pageOnly.length ? ` · page-only, not run here: ${pageOnly.join(', ')}` : ''));
// Incremental: shard 0 computes the changed units against the baseline's key and every
// shard waits for them before its first task (one decision, the browser preflight's).
let restriction = null;
let resolveR;
const changedP = new Promise((r) => { resolveR = r; });
const shardOut = await Promise.all(parts.map((p, i) => job(
  { kind: 'shard', query: '', tasks: p.entries.map(plain), kernel: KERNEL, sweep: SWEEP, anchors: i === 0,
    incremental: INCREMENTAL, ...(INCREMENTAL && i === 0 ? { baseDigests: BASE.report.digests } : {}) },
  { onRestriction: (changed) => {
    if (changed) {
      restriction = changed;
      const n = BASE.report.digests.unitCount;
      console.log(`  ${changed.length} of ${n} unit(s) changed against the baseline: ${changed.join(', ')} — the five restrictable sweeps narrowed to them`);
      resolveR(changed);
    }
    return changedP;
  } }).finally(() => { if (i === 0) resolveR(null); })));   // shard 0 died before deciding: the others run whole, and its own gate fails
const results = new Map();
const shardRows = shardOut.map((s, shard) => {
  if (!s.result) return { shard, warns: [], error: s.fatal || `timed out (${s.timedOut})` };
  const errs = s.result.out.filter((o) => o.error);
  for (const o of s.result.out) if (!o.error) results.set(o.key, { result: o.result, ms: o.ms });
  return { shard, warns: s.result.warns, ...(errs.length ? { error: errs.map((o) => `${o.key}: ${o.error.split('\n')[0]}`).join(' | ') } : {}) };
});
const s0 = shardOut[0]?.result;
const anchorA = s0?.anchor ?? null;
console.log(`  shards done at ${secs(Date.now() - t0)} · boots ${shardOut.map((s) => (s.result ? secs(s.result.bootMs) : 'DIED')).join(' / ')}`);

// ---- 2. boot B, the share boot, the spec tier and the point tier, in K lanes --------
// BOOT_TIMEOUT_MS is a wedge guard sized for the BROWSER's default boot, and SPEC_BOOT_RATIO
// scales it per point against 13.7 s, the default boot its rows were measured beside (its
// comment). This host's default boot is shard 0's, measured above under the same load the
// lanes put it under, so each guard is scaled by how much slower this host's default is.
const { BOOT_TIMEOUT_MS } = await import('./ci-battery.mjs');
const REF_DEFAULT_BOOT_MS = 13700;
const hostScale = Math.max(1, (s0?.bootMs ?? REF_DEFAULT_BOOT_MS) / REF_DEFAULT_BOOT_MS);
const bootGuard = (name) => Math.round(specBootTimeoutMs(name) * hostScale);
const t1 = Date.now();
const share = await sharePayload();
const specPoints = ONLY ? SPEC_POINTS.filter((p) => p.name === 'identity') : SPEC_POINTS;
const sweepPoints = NO_POINTS ? [] : SWEEP_POINTS;
console.log(`boot B, the share boot, ${specPoints.length} spec boot(s)${sweepPoints.length ? ` and ${sweepPoints.length} swept point(s)` : ''} · ${SHARDS} lane(s), boot guard ×${hostScale.toFixed(2)} of the browser's`);
// Boot B first (every point reads its key, and a point asks for it only once its own boot
// and key are done, so the two overlap), then heaviest first (LPT): the swept points, then
// the spec boots by their measured ratios, the share boot among them as one default boot.
let resolveB;
const bDigests = new Promise((r) => { resolveB = r; });
const work = [
  { kind: 'anchor', w: Infinity },
  ...sweepPoints.map((pt) => ({ kind: 'point', pt, w: 1e9 })),
  { kind: 'share', w: BOOT_TIMEOUT_MS },
  ...specPoints.map((pt) => ({ kind: 'spec', pt, w: specBootTimeoutMs(pt.name) })),
].sort((a, b) => b.w - a.w);
const tierT0 = Date.now();
// Each swept point by CI's own judge: incremental against its stored payload when the
// baseline's points file qualifies for it, full against boot B's key otherwise.
const pointPlan = new Map(sweepPoints.map((pt) => [pt.name, INCREMENTAL
  ? decidePointMode({ name: pt.name, stored: BASE.points, checkCode: pointsCodeDigest(), incremental: true })
  : { mode: 'full', why: 'a whole run sweeps every point full' }]));
for (const [name, p] of pointPlan) if (INCREMENTAL) console.log(`  point ${name.padEnd(18)} ${p.mode.toUpperCase()} — ${p.why}`);
const done = await pool(work.map((x) => async () => {
  if (x.kind === 'anchor') {
    const r = await job({ kind: 'anchor', query: '' }, { bootMs: Math.round(BOOT_TIMEOUT_MS * hostScale) });
    resolveB(r.result?.digests ?? null);
    console.log(`  ${r.result ? '·' : '✗'} boot B ${r.result ? `fingerprint ${r.result.fp.hash}` : `FAILED: ${r.fatal || r.timedOut}`}`);
    return { ...x, B: r.result ?? null };
  }
  if (x.kind === 'share') {
    const r = await job({ kind: 'share', query: share.query }, { bootMs: Math.round(BOOT_TIMEOUT_MS * hostScale) });
    const s = r.result ? { fp: r.result.fp, link: r.result.link, leaves: share.leaves, config: r.result.config } : null;
    console.log(`  ${s ? '·' : '✗'} share boot ${s ? `fingerprint ${s.fp.hash}, ${s.link ? `${s.link.applied}/${s.link.pairs} applied` : 'NO LINK OUTCOME'}` : `FAILED: ${r.fatal || r.timedOut}`}`);
    return { ...x, fpShare: s };
  }
  if (x.kind === 'spec') {
    const r = await job({ kind: 'spec', query: `trial=1${x.pt.q ? `&${x.pt.q}` : ''}` }, { bootMs: bootGuard(x.pt.name) });
    const row = r.result ?? { alive: false, warns: null, fatal: r.fatal ? { message: r.fatal.split('\n')[0] } : null, wedged: !!r.timedOut, errors: [] };
    console.log(`  ${row.alive ? '·' : '✗'} spec  ${x.pt.name.padEnd(18)} ${row.alive ? `${row.warns.length ? `${row.warns.length} warn(s)` : 'silent'}${row.nonFinite.bad.length ? `, ${row.nonFinite.bad.length} NON-FINITE` : ''} · ${secs(row.bootMs)}` : (row.wedged ? 'WEDGED' : 'DEAD')}`);
    return { ...x, row: { ...x.pt, ...row } };
  }
  const plan = pointPlan.get(x.pt.name);
  const r = await job({ kind: 'point', q: x.pt.q, query: `trial=1&${x.pt.q}` },
    { bootMs: bootGuard(x.pt.name), against: plan.mode === 'incremental' ? Promise.resolve(plan.entry.digests) : bDigests });
  if (r.result) r.result.mode = plan.mode;
  const got = r.result ?? { q: x.pt.q, mode: plan.mode, error: r.fatal ? r.fatal.split('\n').slice(0, 2).join(' ') : `timed out (${r.timedOut})`, ms: 0 };
  console.log(`  ${got.error ? '✗' : '·'} point ${x.pt.name.padEnd(18)} ${got.error ? `ERROR ${got.error}` : `${got.changed.length} changed · ${secs(got.ms)}`}`);
  return { ...x, got };
}), SHARDS);
const B = done.find((d) => d.kind === 'anchor').B;
const fpShare = done.find((d) => d.kind === 'share').fpShare;
const byName = new Map(done.filter((d) => d.kind === 'spec').map((d) => [d.pt.name, d.row]));
const spec = { rows: specPoints.map((p) => byName.get(p.name)), ms: Date.now() - tierT0 };
const points = sweepPoints.length ? {
  got: Object.fromEntries(done.filter((d) => d.kind === 'point').map((d) => [d.pt.name, d.got])),
  entries: Object.fromEntries([...pointPlan].filter(([, p]) => p.mode === 'incremental').map(([n, p]) => [n, p.entry])),
  plan: [...pointPlan].map(([name, p]) => ({ name, mode: p.mode, why: p.why })),
  pr: false, ms: Date.now() - tierT0,
} : null;
console.log(`  tiers done at ${secs(Date.now() - t0)} (${secs(Date.now() - t1)} after the shards)\n`);

// ---- 3. CI's own assembly --------------------------------------------------------
// A whole, unnarrowed run is a baseline candidate: its report and points file go to the
// baseline directory under temporary names and become the baseline only if every gate
// passes. A user's --report / --points-out are written as asked, and copied from.
const candidate = !INCREMENTAL && !ONLY && !NO_POINTS;
if (candidate) mkdirSync(BASE_DIR, { recursive: true });
const userReport = opt('--report') ? resolve(opt('--report')) : null;
const userPoints = opt('--points-out') ? resolve(opt('--points-out')) : null;
const reportPath = userReport ?? (candidate ? join(BASE_DIR, 'report.json.tmp') : null);
const pointsPath = userPoints ?? (candidate ? join(BASE_DIR, 'points.json.tmp') : null);
const headDigests = anchorA?.digests ? { ...anchorA.digests, checkCode: checkCodeDigest(), formatVersion: REPORT_FORMAT_VERSION } : null;
const gates = assemble({
  battery, results, shardRows, shardCount: parts.length, expectedShards: null,
  axisMeta: s0?.axes ?? [], checkRoster: anchorA?.checkRoster ?? [],
  fpA: anchorA?.fp ?? null, fpB: B?.fp ?? null, digestsB: B?.digests ?? null, fpShare,
  spec, points,
  headDigests, restriction, baseline: INCREMENTAL ? BASE.report : null,
  split: SPLIT, specOnly: false, t0, reportPath, pointsOut: pointsPath,
});
const failed = gates.filter((g) => !g.pass).length;
if (candidate) {
  const tmp = (f) => join(BASE_DIR, `${f}.tmp`);
  if (!failed && existsSync(reportPath) && existsSync(pointsPath)) {
    if (reportPath !== tmp('report.json')) copyFileSync(reportPath, tmp('report.json'));
    if (pointsPath !== tmp('points.json')) copyFileSync(pointsPath, tmp('points.json'));
    let tree = null;
    try {
      const { execFileSync } = await import('node:child_process');
      const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' }).trim();
      tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim() + (dirty ? ' (dirty)' : '');
    } catch { /* not a git checkout: the baseline is named by its digests alone */ }
    renameSync(tmp('report.json'), join(BASE_DIR, 'report.json'));
    renameSync(tmp('points.json'), join(BASE_DIR, 'points.json'));
    writeFileSync(join(BASE_DIR, 'meta.json'), `${JSON.stringify({ format: LOCAL_FORMAT, at: new Date().toISOString(), tree,
      sweep: SWEEP, kernel: KERNEL, host: `${process.platform}-${process.arch} node ${process.version}`, code: localCode() }, null, 2)}\n`);
    console.log(`baseline written to ${BASE_DIR}: the next run is incremental against this tree`);
  } else {
    for (const f of ['report.json', 'points.json']) rmSync(tmp(f), { force: true });
    console.log(`no baseline written: ${failed ? 'a gate failed' : 'the report or points file is missing'} (the one in ${BASE_DIR}, if any, is unchanged)`);
  }
}
console.log(`local pre-flight ${failed ? `FAILED (${failed} gate(s))` : 'PASSED'}${INCREMENTAL ? ` (incremental: ${restriction ? restriction.length : '?'} unit(s) re-swept)` : ''} — the battery job's gates on this tree, natively; `
  + 'not run here: the chrome, offline, boot-yield and battery.yml\'s probe jobs');
process.exit(failed ? 1 : 0);
