// §152 follow-up's acceptance — IS THE KEY'S POSE SET WORTH WHAT IT SKIPS?
//
// The incremental battery keys every skip on unitDigests(), whose verdict is a
// claim about geometry across poses. It sampled the eleven FINGERPRINT_POSES —
// a list chosen for a different instrument — while the sweeps it gates run
// 1892 poses across the fourteen AXES. The gap is a POSE-LAW change: an
// easing, a solver constant, a derived angle law in main.js/layout.js/state.js
// that leaves the sampled points fixed and moves geometry between them. Same
// key, different verdicts — a stale green.
//
// Three parts, one boot:
//
//   (a) CENSUS — how big was the blind class. Per (unit, axis): does the unit
//       move across that axis, and does the old eleven-pose set visit more
//       than one of the stations the axis puts it at? The population where the
//       answer is "moves, and no" is exactly what a pose-law change on that
//       axis could move invisibly.
//   (b) MISS THEN CATCH — one induced pose-law change, run against both sets.
//       A wrapper displaces one unit only inside tension ∈ (0.45, 0.55), a
//       band the old set never samples (it hits 0.4 and 1) and the derived set
//       hits at reserve's midpoint. The old digest must not notice; the new
//       one must notice, for that unit and no other; both must reverse.
//   (c) COST — one full derived walk, measured, because the harness pays it
//       twice per run.
//
//   node tools/probe-152-pose-coverage.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8555';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
await p.evaluate(async () => { window.__I = await import('./src/inspect.js'); });

const out = await p.evaluate(() => {
  const c = window.__clock;
  const I = window.__I;

  // Mirrors FINGERPRINT_POSES (src/inspect.js), which is module-private. The
  // census is a comparison AGAINST the shipped set, so a drift here would
  // quietly re-scope the measurement rather than break it — hence the count
  // assertion below, which fails visibly if the two lists part company.
  const OLD_POSES = [
    { tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 },
    { tau: 8 * 3600 * 0.37, crownPullT: 0, leverEngage: 0, tension: 1 },
    { tau: 0.05, crownPullT: 1, leverEngage: 1, tension: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.4 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: 2.0 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmStrikePhase: 7.3 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: 2.0, alarmOn: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownPullT: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmReleased: 1, alarmStrikePhase: 5.2 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmBarrelWind: 1.75 },
  ];

  // One pose in, one PLACE hash per unit out — the same walk and the same
  // quantisation the key uses, by calling the key itself on a one-pose set.
  const placeAt = (pose) => {
    const d = I.unitDigests(c, { poses: [pose] });
    const rows = {};
    for (const n of Object.keys(d.units)) rows[n] = d.units[n].place;
    return rows;
  };

  const FRACS = [0, 0.5, 1];

  // ---- (a) blind-class census --------------------------------------------
  const oldStations = new Map();   // unit -> Set of place hashes over the 11
  for (const pose of OLD_POSES) {
    const rows = placeAt(pose);
    for (const n of Object.keys(rows)) {
      if (!oldStations.has(n)) oldStations.set(n, new Set());
      oldStations.get(n).add(rows[n]);
    }
  }

  const perAxis = [];
  let totalMoving = 0, totalBlind = 0;
  const blindPairs = [];
  for (const axis of I.AXES) {
    const stations = new Map();    // unit -> Set of place hashes over {0,.5,1}
    for (const f of FRACS) {
      const rows = placeAt(axis.pose(f, c));
      for (const n of Object.keys(rows)) {
        if (!stations.has(n)) stations.set(n, new Set());
        stations.get(n).add(rows[n]);
      }
    }
    let moving = 0, blind = 0;
    for (const [n, s] of stations) {
      if (s.size < 2) continue;                        // the axis does not move it
      moving++;
      const old = oldStations.get(n) || new Set();
      let hit = 0;
      for (const h of s) if (old.has(h)) hit++;        // stations the old set visits
      if (hit <= 1) { blind++; blindPairs.push(`${n} @ ${axis.name}`); }
    }
    perAxis.push({ axis: axis.name, unitsMoving: moving, pairsBlind: blind });
    totalMoving += moving; totalBlind += blind;
  }

  // ---- (b) induced pose-law change, missed then caught --------------------
  // 'Maintaining detent': not a morphing pool unit and not the always-changed
  // chain, so a moved digest can only be the induced displacement.
  const TARGET = 'Maintaining detent';
  const root = c.labelEntries.find((e) => e.name === TARGET).obj;
  const baseZ = root.position.z;

  const derived = () => I.unitDigests(c);
  const canonical = () => I.unitDigests(c, { poses: OLD_POSES });
  const moved = (a, bb) => Object.keys(a.units).filter((n) => a.units[n].key !== bb.units[n].key);

  const oldBase = canonical();
  const newBase = derived();

  const orig = c.setPose.bind(c);
  c.setPose = (pose) => {
    orig(pose);
    // Written as an absolute assignment, never as a += : the wrapper fires at
    // every pose of every walk, so an incremental offset would accumulate and
    // contaminate the poses outside the band as well as the one inside it.
    root.position.z = baseZ + (pose && pose.tension > 0.45 && pose.tension < 0.55 ? 0.05 : 0);
    c.scene.updateMatrixWorld(true);
  };

  const oldWrapped = canonical();
  const newWrapped = derived();

  c.setPose = orig;
  root.position.z = baseZ;
  c.scene.updateMatrixWorld(true);

  const oldRestored = canonical();
  const newRestored = derived();

  // ---- (c) cost -----------------------------------------------------------
  const poses = I.digestPoses(c);
  const t0 = performance.now();
  const walk = I.unitDigests(c);
  const walkMs = Math.round(performance.now() - t0);

  return {
    definition: 'BLIND (unit, axis) := the unit\'s PLACE hash differs across the axis\'s f ∈ {0, 0.5, 1}, '
      + 'AND the old 11-pose set produces at most 1 of the hashes those three fractions produce for it.',
    oldPoseCount: OLD_POSES.length,
    derivedPoseCount: poses.length,
    axisCount: I.AXES.length,
    unitCount: walk.unitCount,
    census: perAxis,
    totals: { unitsMovingSummed: totalMoving, pairsBlind: totalBlind },
    blindPairs,
    induced: {
      target: TARGET,
      band: 'tension ∈ (0.45, 0.55) — reserve @ f=0.5 only',
      oldSetMoved: moved(oldBase, oldWrapped),
      derivedSetMoved: moved(newBase, newWrapped),
      restoredOld: moved(oldBase, oldRestored),
      restoredDerived: moved(newBase, newRestored),
    },
    cost: { derivedWalkMs: walkMs, poseCount: walk.poseCount },
  };
});
await b.close(); srv.kill();

console.log(JSON.stringify(out, null, 1));
const fail = [];
const only = (arr, n) => arr.length === 1 && arr[0] === n;
if (out.oldPoseCount !== 11) fail.push('the mirrored FINGERPRINT_POSES list is no longer 11 poses — re-copy it');
if (out.derivedPoseCount <= out.oldPoseCount) fail.push('the derived set is no larger than the borrowed one');
if (out.induced.oldSetMoved.length) fail.push('the old pose set NOTICED the induced change — the band is mis-chosen, so (b) proves nothing');
if (!only(out.induced.derivedSetMoved, out.induced.target)) fail.push('the derived set did not catch the induced change on exactly its unit');
if (out.induced.restoredOld.length || out.induced.restoredDerived.length) fail.push('undoing the wrap did not restore both digests');
if (fail.length) { console.error('FAILED:\n  ' + fail.join('\n  ')); process.exitCode = 1; }
else console.log(`PASS — ${out.totals.pairsBlind} blind (unit, axis) pairs retired; the induced pose-law change is missed by ${out.oldPoseCount} poses and caught by ${out.derivedPoseCount} (${out.cost.derivedWalkMs} ms/walk)`);
