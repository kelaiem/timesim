// §338 landing 14 — ONE BOOT of the local pre-flight (tools/battery-local.mjs), run in a
// worker thread: main.js evaluates once per isolate, so every boot the browser battery
// makes in its own browser context is a worker here. Each kind reads what the browser
// battery's page reads at the same point, through the same module functions:
//
//   shard   tools/native/shard.mjs' runShard: a share of the BATTERY table (and, on the
//           shard that carries them, the anchors runShardGroup reads on its shard 0)
//   anchor  boot B: the fingerprint and the per-unit key of a second virgin boot
//           (ci-battery.mjs anchorBootB)
//   share   the §240 share boot: every shareable leaf moved, the fingerprint, the
//           link's receipt and the build's config (ci-battery.mjs shareSafeBoot)
//   spec    one SPEC_POINTS row: built or not, its warnings, its metal finite, its
//           config (ci-battery.mjs specBoot, NON_FINITE_WALK itself)
//   point   one swept point: its key, the units it changes against the default, and
//           the three sweeps restricted to them (battery-points.mjs sweepPoint)
//
// A boot that throws is a FINDING, not a crash: the job answers `{ alive: false }` with
// the build's own fatal error and the warnings it had raised (TODO 30's surface), as
// specBoot does. The parent times every job out and terminates the worker, which is how
// a wedged build reads here.
import { parentPort, workerData } from 'node:worker_threads';

// The checks' tables and three-mesh-bvh's chatter are the parent's to summarise.
// console.warn too: main.js wraps it at boot to collect the build's warnings
// (rule 6), so muting the sink loses none of them.
console.log = () => {}; console.table = () => {}; console.warn = () => {};

const say = (m) => parentPort.postMessage(m);

async function poll(I, name) {
  for (;;) {
    await new Promise((r) => setTimeout(r, 25));
    const st = I.status(name);
    if (st.state === 'done') return st.result;
    if (st.state === 'error') throw new Error(`check ${name} threw:\n${st.error}`);
  }
}

async function boot(query) {
  const { bootNative } = await import('./host.mjs');
  try {
    const r = await bootNative({ query });
    say({ type: 'booted', ms: r.ms });
    return r;
  } catch (err) {
    const g = globalThis;
    return { dead: { alive: false, warns: g.__bootWarns ? g.__bootWarns.slice() : null,
      fatal: { message: String(err && err.message || err) }, errors: [] } };
  }
}

async function run(job) {
  if (job.kind === 'shard') {
    const { runShard } = await import('./shard.mjs');
    // §338 landing 15 — an incremental run's restriction: the shard carrying the anchors
    // computes it (inspect.js' own digestChangedUnits, its key against the baseline's), and
    // every shard asks the parent for it before its first task.
    const beforeTasks = job.incremental ? async (anchor) => {
      let changed;
      if (anchor) {
        const I = await import('../../src/inspect.js');
        changed = I.digestChangedUnits(job.baseDigests, anchor.digests);
      }
      return new Promise((res) => { parentPort.once('message', res); say({ type: 'restriction', changed }); });
    } : null;
    return runShard({ ...job, beforeTasks, restricted: 'js' });
  }
  const b = await boot(job.query);
  if (b.dead) return b.dead;
  const { clock, ms: bootMs } = b;
  const I = await import('../../src/inspect.js');
  if (job.kind === 'anchor') return { bootMs, fp: I.fingerprint(clock), digests: I.unitDigests(clock) };
  if (job.kind === 'share') {
    const A = await import('../../src/aesthetics.js');   // the instance main.js imported: one isolate, one module map
    const o = A.LINK_OUTCOME;
    return { bootMs, fp: I.fingerprint(clock), config: clock.config ?? null,
      link: o ? { pairs: o.pairs, applied: o.applied.length, refused: o.refused, clamped: o.clamped } : null };
  }
  if (job.kind === 'spec') {
    const { NON_FINITE_WALK } = await import('../ci-battery.mjs');
    return { alive: true, bootMs, warns: (clock.buildWarns || []).slice(), errors: [], nonFinite: NON_FINITE_WALK(),
      config: clock.config ?? null };
  }
  if (job.kind === 'point') {
    // battery-points.mjs sweepPoint, step for step: the hold (prepPage), the key, the
    // changed set by inspect.js' own digestChangedUnits, the units this build has, and
    // the three sweeps restricted to them, each with its BATTERY row's own options.
    const t0 = Date.now();
    const { BATTERY } = await import('../battery-checks.mjs');
    const { POINT_CHECKS } = await import('../battery-points.mjs');
    clock.beginSweepHold();
    const warns = clock.buildWarns.slice();
    const config = clock.config ?? null;
    const digests = I.unitDigests(clock);
    // The default's key is boot B's, which boots beside this one: asked for only now,
    // so the two boots overlap instead of this one waiting to start.
    const against = await new Promise((res) => { parentPort.once('message', res); say({ type: 'against' }); });
    if (!against) throw new Error('no default digests to compare a full point against (boot B did not answer)');
    const changed = I.digestChangedUnits(against, digests);
    const known = new Set(clock.labelEntries.map((e) => e.name));
    const touching = changed.filter((n) => known.has(n));
    const checks = {};
    for (const name of POINT_CHECKS) {
      const entry = BATTERY.find((e) => e.name === name);
      const c0 = Date.now();
      I.start(clock, name, { ...entry.opts, pairsTouching: touching });
      checks[name] = { result: await poll(I, name), ms: Date.now() - c0 };
    }
    return { q: job.q, mode: 'full', warns, config, digests, changed, absentHere: changed.filter((n) => !known.has(n)),
      checks, ms: Date.now() - t0 + bootMs };
  }
  throw new Error(`battery-job: no job kind ${job.kind}`);
}

run(workerData).then((r) => say({ type: 'done', result: r }), (err) => say({ type: 'done', fatal: String(err && err.stack || err) }));
