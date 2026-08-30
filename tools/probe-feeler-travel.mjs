// IF THE FEELER RIDES THE HOUR, HAS IT ANYWHERE TO GO?
//
// TODO 117's decided topology (the moving reader on the hour) takes the alarm
// release feeler off its fixed dial bracket and carries it round the dial
// centre once per 12 h, to meet a notch the crown has set and left. The item
// files that as its expensive half and names it UNMEASURED. This measures it,
// in the two parts the item asks for:
//
//   TIER ONE — does the feeler's own swept footprint fit at every azimuth, or
//     is the band it would orbit through already occupied?
//   TIER TWO — what does its tail's run to the release lifter cost across
//     that travel? The lifter is a fixed part; a moving feeler has to reach it
//     from wherever it stands, and the reach's SPREAD is the cost.
//
// It is NOT probe-ledge-occupancy.mjs, whose method this borrows: that one
// scans a CASE annulus for a ledge and screw stations, outboard of the plate.
// This scans the dial-side band for a part that must orbit through it. Nor is
// it probe-124-sleeve.mjs or the §45 lane probes, which price the feeler's
// rock in z where it stands — the question here is azimuth, not lift.
//
// HOW IT MEASURES. At EACH POSE, the feeler's own points are rotated about the
// dial centre to each candidate station and their nearest non-ground metal is
// found; a station is blocked if that gap falls under CLEAR_MARGIN at any
// pose. Both sides are sampled along triangle EDGES, never at vertices: a
// radial arm crosses a band with no vertex inside it, which is MODELING.md
// rule 5 and the lesson probe-ledge-occupancy records.
//
// PER POSE is the load-bearing word. The first version unioned the feeler's
// cells over the whole net and the obstacles' cells over the whole net and
// intersected the two hulls — so a feeler cell from one pose met an obstacle
// cell from another, and it announced 0° of 360° free, with the SHIPPED
// station blocked by parts that are never there at the same time. That is the
// swept-hull error §36 job B exists for. Its must-miss control caught it, and
// the correction is why this reports a GAP in units rather than a cell count:
// sharing a grid cell is not touching.
//
// GROUND IS NOT AN OBSTACLE, so two units are excluded and both are named in
// the output rather than dropped quietly:
//   · 'Alarm release disc' — the thing the feeler READS. Its pin rides that
//     track by design, and under the decided topology it goes on riding it.
//   · 'Dial' — what the feeler hangs from.
// A third, §45's silence rocker, is designed to touch the feeler's tail at its
// OWN station and is a genuine obstacle everywhere else on the orbit — so it is
// excluded from the control and kept in the sweep. Two different lists, and the
// difference is the point.
// Everything else in the band is an obstacle. (Under the decided topology the
// feeler would hang from an hour-driven carrier rather than the dial, so the
// dial exclusion is the conservative reading: it says the dial is not what
// stops the travel, and leaves what carries it to the implementation.)
//
// CONTROLS, both kinds, and both real:
//   · must-hit — with the DISC INCLUDED, at the feeler's own station, the gap
//     must come out at or under the margin. The pin rides that track, so a
//     scan that reads clearance there is not seeing metal the feeler touches.
//   · must-miss — with the designed contacts excluded, at the same station,
//     the gap must be CLEAR of interpenetration. Note what this does NOT
//     assert: the shipped feeler sits 0.0458 from the alarm winding train,
//     well under CLEAR_MARGIN, with a green battery. So the movement contains
//     real sub-margin proximities it accepts, and a control demanding the
//     margin asserts something untrue of the tree — which is exactly what the
//     first two drafts did, reporting every station blocked. THE BAR FOR THE
//     SWEEP IS THEREFORE THE SHIPPED STATION\'S OWN CLEARANCE: is any station
//     at least as good as the one the movement already lives with?
//
// ACCEPTANCE — exits non-zero, and on exactly one thing: its own CONTROLS. The
// sweep's rows are a REPORT and are not gated, because what counts as enough
// free azimuth is a design question about where a carrier can be sited and how
// short the reader may be, which this does not answer. Gating that would be
// inventing a bar; gating the controls is refusing to publish a broken scan.
// Run from tools/ with a Playwright Chromium: `node probe-feeler-travel.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8515';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: process.env.ROOT || '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('/src/inspect.js');
  const C = window.__clock;
  const FEELER = 'Alarm release feeler';
  // GROUND for the SWEEP: what the feeler is designed to meet at EVERY
  // station. Only two things are.
  const GROUND = ['Alarm release disc', 'Dial'];
  // Designed at its OWN station only, and therefore excluded from the CONTROL
  // but not from the sweep: §45's silence rocker caps what the feeler's tail
  // may rise, so its finger touches the tail there on purpose (measured 0.0034
  // apart). Everywhere else on the orbit that same finger is a genuine
  // obstacle, which is why the two sets are not the same list. Getting this
  // wrong is the ground-is-not-an-obstacle trap in one direction and an
  // excused collision in the other.
  const DESIGNED_AT_STATION = [...GROUND, 'Alarm silence rocker'];

  const STATIONS = 72;          // 5° — a scoping resolution, stated in the output
  const CELL = 0.5;             // cartesian grid cell; must exceed the margin below
  const MARGIN = 0.15;          // CLEAR_MARGIN — the movement's one clearance margin
  const cx = C.P.dial.x, cy = C.P.dial.y;
  const v = new THREE.Vector3();

  // The pose net: every declared axis at f ∈ {0, 0.5, 1}, which is the set
  // §152's digestPoses derives — so this is measured over the same net the
  // battery's own digests are.
  const poses = [];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1]) poses.push(ax.pose(f));

  // Walk a mesh's triangle EDGES, handing each sample to `emit` in world xyz.
  const walk = (m, emit) => {
    const pos = m.geometry?.attributes?.position; if (!pos) return;
    const idx = m.geometry.index ? m.geometry.index.array : null;
    const cnt = idx ? idx.length : pos.count;
    for (let i = 0; i + 2 < cnt; i += 3) {
      for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) {
        v.fromBufferAttribute(pos, idx ? idx[i + p] : i + p).applyMatrix4(m.matrixWorld);
        const ax = v.x, ay = v.y, az = v.z;
        v.fromBufferAttribute(pos, idx ? idx[i + q] : i + q).applyMatrix4(m.matrixWorld);
        const bx = v.x, by = v.y, bz = v.z;
        const len = Math.hypot(bx - ax, by - ay, bz - az);
        const steps = Math.max(2, Math.ceil(len / (MARGIN / 2)));
        for (let t = 0; t <= steps; t++) emit(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps, az + (bz - az) * t / steps);
      }
    }
  };
  const unitOf = (nm) => C.labelEntries.find((e) => e.name === nm)?.obj ?? null;
  const meshesOf = (obj) => { const out = []; obj?.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
  const feelerUnit = unitOf(FEELER);
  if (!feelerUnit) return { fatal: 'no Alarm release feeler unit' };

  // ---- the feeler's envelope, for pruning and for the tail's radius ------
  let fr0 = Infinity, fr1 = -Infinity, fz0 = Infinity, fz1 = -Infinity;
  let sx = 0, sy = 0;
  for (const pose of poses) {
    C.setPose(pose); feelerUnit.updateWorldMatrix(true, true);
    for (const m of meshesOf(feelerUnit)) walk(m, (x, y, z) => {
      const r = Math.hypot(x - cx, y - cy);
      fr0 = Math.min(fr0, r); fr1 = Math.max(fr1, r);
      fz0 = Math.min(fz0, z); fz1 = Math.max(fz1, z);
      const a = Math.atan2(y - cy, x - cx); sx += Math.cos(a); sy += Math.sin(a);
    });
  }
  const refAz = Math.atan2(sy, sx);

  // EVERYTHING BELOW IS PER POSE, and that is the whole correction. The first
  // version unioned the feeler's cells over the net and the obstacles' cells
  // over the net and intersected the two hulls — so a feeler cell from one
  // pose met an obstacle cell from another, and it reported the SHIPPED
  // station blocked by parts that are never there at the same time. That is
  // the swept-hull error §36 job B exists for, and its must-miss control
  // caught it: 45 cells "blocked" where the movement demonstrably runs.
  const gk = (x, y, z) => `${Math.floor(x / CELL)}|${Math.floor(y / CELL)}|${Math.floor(z / CELL)}`;
  const buildOcc = (skip) => {
    const g = new Map();
    for (const { name, obj } of C.labelEntries) {
      if (name === FEELER) continue;
      if (skip.includes(name)) continue;
      obj.updateWorldMatrix(true, true);
      for (const m of meshesOf(obj)) {
        const box = new THREE.Box3().setFromObject(m);
        if (box.max.z < fz0 - 1 || box.min.z > fz1 + 1) continue;
        const far = Math.max(
          Math.hypot(box.min.x - cx, box.min.y - cy), Math.hypot(box.max.x - cx, box.max.y - cy),
          Math.hypot(box.min.x - cx, box.max.y - cy), Math.hypot(box.max.x - cx, box.min.y - cy));
        const near = 0;
        if (far < fr0 - 1 || near > fr1 + 1) continue;
        walk(m, (x, y, z) => {
          const r = Math.hypot(x - cx, y - cy);
          if (r < fr0 - 1 || r > fr1 + 1 || z < fz0 - 1 || z > fz1 + 1) return;
          const k = gk(x, y, z);
          let cell = g.get(k); if (!cell) { cell = []; g.set(k, cell); }
          cell.push(x, y, z, name);
        });
      }
    }
    return g;
  };
  // The feeler's own points at this pose, deduped onto a fine grid so the
  // station loop stays affordable without thinning the arm.
  const feelerPts = () => {
    const seen = new Set(), pts = [];
    feelerUnit.updateWorldMatrix(true, true);
    for (const m of meshesOf(feelerUnit)) walk(m, (x, y, z) => {
      const k = `${Math.round(x / 0.12)}|${Math.round(y / 0.12)}|${Math.round(z / 0.12)}`;
      if (seen.has(k)) return; seen.add(k);
      pts.push(x - cx, y - cy, z);
    });
    return pts;
  };
  // Nearest non-ground metal to the feeler's points, rotated by dPhi.
  const probeAt = (g, pts, dPhi) => {
    const c = Math.cos(dPhi), s = Math.sin(dPhi);
    let best = Infinity, who = null;
    for (let i = 0; i < pts.length; i += 3) {
      const px = pts[i] * c - pts[i + 1] * s + cx;
      const py = pts[i] * s + pts[i + 1] * c + cy;
      const pz = pts[i + 2];
      const bx = Math.floor(px / CELL), by = Math.floor(py / CELL), bz = Math.floor(pz / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const cell = g.get(`${bx + dx}|${by + dy}|${bz + dz}`);
        if (!cell) continue;
        for (let j = 0; j < cell.length; j += 4) {
          const d = Math.hypot(px - cell[j], py - cell[j + 1], pz - cell[j + 2]);
          if (d < best) { best = d; who = cell[j + 3]; }
        }
      }
    }
    return { gap: best, who };
  };

  // CONTROLS, at the feeler's OWN station, per pose — the only honest place
  // to judge them, since that is where the shipped movement runs.
  let hitGap = Infinity, hitWho = null, missGap = Infinity, missWho = null;
  for (const pose of poses) {
    C.setPose(pose);
    const pts = feelerPts();
    const withGround = buildOcc([]), without = buildOcc(DESIGNED_AT_STATION);
    const a = probeAt(withGround, pts, 0); if (a.gap < hitGap) { hitGap = a.gap; hitWho = a.who; }
    const b = probeAt(without, pts, 0); if (b.gap < missGap) { missGap = b.gap; missWho = b.who; }
  }

  // ---- tier one: the orbit, per pose, worst case per station -------------
  // Swept for the WHOLE feeler and for progressively SHORTER readers, because
  // the two answers are different questions. A blocked orbit for this arm
  // says only that THIS arm does not fit; the cutoff curve says whether the
  // band is full or the arm is simply long, which is what a redesign needs.
  const CUTOFFS = [3.6, 5, 7, 10, 99];
  const stationGap = new Array(STATIONS).fill(Infinity);
  const stationWho = new Array(STATIONS).fill(null);
  const cutGap = CUTOFFS.map(() => new Array(STATIONS).fill(Infinity));
  for (const pose of poses) {
    C.setPose(pose);
    const pts = feelerPts();
    const sub = CUTOFFS.map((cut) => {
      const out = [];
      for (let i = 0; i < pts.length; i += 3) {
        if (Math.hypot(pts[i], pts[i + 1]) <= cut) out.push(pts[i], pts[i + 1], pts[i + 2]);
      }
      return out;
    });
    const g = buildOcc(GROUND);
    for (let k = 0; k < STATIONS; k++) {
      const dPhi = (k / STATIONS) * Math.PI * 2;
      const r = probeAt(g, pts, dPhi);
      if (r.gap < stationGap[k]) { stationGap[k] = r.gap; stationWho[k] = r.who; }
      CUTOFFS.forEach((cut, ci) => {
        if (!sub[ci].length) return;
        const rc = probeAt(g, sub[ci], dPhi);
        if (rc.gap < cutGap[ci][k]) cutGap[ci][k] = rc.gap;
      });
    }
  }
  // THE BAR IS THE SHIPPED STATION, not CLEAR_MARGIN. The movement contains
  // real sub-margin proximities it accepts — the feeler already sits 0.0458
  // from the alarm winding train where it stands, with a green battery — so
  // asserting the margin everywhere asserts something untrue of the movement
  // and reports every station blocked, which is what the first two drafts did.
  // The honest question is whether any station is AT LEAST AS GOOD as the one
  // the movement already ships and accepts.
  const BAR = missGap;
  const free = stationGap.filter((g) => g >= BAR).length;
  const blockers = new Map();
  for (let k = 0; k < STATIONS; k++) if (stationGap[k] < BAR) blockers.set(stationWho[k], (blockers.get(stationWho[k]) || 0) + 1);
  const arcs = [];
  { let run = 0, started = false;
    for (let i = 0; i < STATIONS * 2; i++) {
      if (stationGap[i % STATIONS] >= BAR) { run++; started = true; }
      else { if (started && run > 0) arcs.push(Math.min(run, STATIONS)); run = 0; }
    }
    if (run > 0) arcs.push(Math.min(run, STATIONS));
    arcs.sort((a, b) => b - a);
  }
  const sortedGaps = [...stationGap].sort((a, b) => a - b);
  const stats = { best: +Math.max(...stationGap).toFixed(4), worst: +sortedGaps[0].toFixed(4),
    median: +sortedGaps[Math.floor(STATIONS / 2)].toFixed(4), bar: +BAR.toFixed(4) };

  // ---- tier two: the tail's run to the release lifter --------------------
  const lifter = unitOf('Alarm release lifter');
  let lift = null;
  if (lifter) {
    C.setPose(poses[0]); lifter.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(lifter);
    const lx = (box.min.x + box.max.x) / 2, ly = (box.min.y + box.max.y) / 2, lz = (box.min.z + box.max.z) / 2;
    const reach = [];
    for (let k = 0; k < STATIONS; k++) {
      const a = refAz + (k / STATIONS) * Math.PI * 2;
      reach.push(Math.hypot(cx + Math.cos(a) * fr1 - lx, cy + Math.sin(a) * fr1 - ly));
    }
    lift = { r: +Math.hypot(lx - cx, ly - cy).toFixed(3), azDeg: +(Math.atan2(ly - cy, lx - cx) * 180 / Math.PI).toFixed(1),
      z: +lz.toFixed(3), tailR: +fr1.toFixed(3),
      min: +Math.min(...reach).toFixed(3), max: +Math.max(...reach).toFixed(3) };
  }

  const gaps = stationGap.map((g, k) => ({ k, gap: +g.toFixed(4), who: stationWho[k] }));
  return {
    poses: poses.length, axes: I.AXES.length, margin: MARGIN,
    feeler: { r: [+fr0.toFixed(3), +fr1.toFixed(3)], z: [+fz0.toFixed(3), +fz1.toFixed(3)],
      refAzDeg: +(refAz * 180 / Math.PI).toFixed(1) },
    controls: { hitGap: +hitGap.toFixed(4), hitWho, missGap: +missGap.toFixed(4), missWho },
    free, total: STATIONS, arcs: arcs.slice(0, 6), gaps, stats,
    cutoffs: CUTOFFS.map((cut, ci) => ({ cut,
      free: cutGap[ci].filter((g) => g >= BAR).length,
      best: +Math.max(...cutGap[ci]).toFixed(4),
      worst: +Math.min(...cutGap[ci]).toFixed(4) })),
    blockers: [...blockers.entries()].sort((a, b) => b[1] - a[1]),
    lift, ground: GROUND, designedAtStation: DESIGNED_AT_STATION,
  };
});

if (out.fatal) { console.log('FATAL —', out.fatal); await browser.close(); srv.kill(); process.exit(2); }
let bad = 0;
const deg = (b) => ((b / out.total) * 360).toFixed(1);

console.log(`\nTHE FEELER, over ${out.poses} poses (${out.axes} axes × 3), margin ${out.margin}\n`);
console.log(`  radial reach   r ${out.feeler.r[0]} → ${out.feeler.r[1]}`);
console.log(`  z band         ${out.feeler.z[0]} → ${out.feeler.z[1]}`);
console.log(`  sits at        azimuth ${out.feeler.refAzDeg}°`);
console.log(`  ground for the SWEEP (met at every station by design): ${out.ground.join(', ')}`);
console.log(`  designed at its OWN station only, so excluded from the control and NOT from the sweep:`);
console.log(`    ${out.designedAtStation.filter((g) => !out.ground.includes(g)).join(', ')}`);

console.log('\nCONTROLS — both at the feeler\'s OWN station, per pose\n');
{
  const c = out.controls;
  const okHit = c.hitGap <= out.margin;
  const okMiss = c.missGap > 0;
  if (!okHit) bad++;
  if (!okMiss) bad++;
  console.log(`  ${okHit ? 'ok  ' : 'FAIL'} must-hit   ground INCLUDED: nearest metal ${c.hitGap} (${c.hitWho})`);
  console.log(`         the pin rides that track, so this must read at or under the margin.`);
  console.log(`  ${okMiss ? 'ok  ' : 'FAIL'} must-miss  designed contacts excluded: nearest metal ${c.missGap} (${c.missWho})`);
  console.log(`         the shipped movement runs here, so this must read CLEAR of interpenetration.`);
  console.log(`         Note it is well under CLEAR_MARGIN ${out.margin} — a real proximity the movement`);
  console.log(`         accepts, which is why the sweep's bar below is this number and not the margin.`);
}
if (bad) console.log('\n  Control failure — do not read the sweep below as a finding.');

console.log(`\nTIER ONE — the orbit, ${out.total} stations of ${(360 / out.total).toFixed(1)}°\n`);
console.log(`  bar = the SHIPPED station's own clearance, ${out.stats.bar}  (CLEAR_MARGIN ${out.margin} is not the bar — see the control)`);
console.log(`  gaps over the orbit: best ${out.stats.best}, median ${out.stats.median}, worst ${out.stats.worst}`);
console.log(`  AT LEAST AS GOOD AS SHIPPED at ${out.free} of ${out.total} stations = ${deg(out.free)}° of 360°`);
console.log(`  longest free arcs: ${out.arcs.length ? out.arcs.map((a) => `${deg(a)}°`).join(', ') : 'none'}`);
console.log('\n  worst gap per station (blank = clear):');
{
  let line = '   ';
  for (const g of out.gaps) {
    line += g.gap >= out.stats.bar ? ' ·' : ' X';
    if ((g.k + 1) % 36 === 0) { console.log(`${line}   ${((g.k - 35) / out.total * 360).toFixed(0)}–${((g.k + 1) / out.total * 360).toFixed(0)}°`); line = '   '; }
  }
}
console.log('\n  what blocks it, by how many stations it owns as the nearest metal:');
if (!out.blockers.length) console.log('    nothing — the band is clear all the way round');
for (const [who, n] of out.blockers) console.log(`    ${String(who).padEnd(28)} ${String(n).padStart(3)} stations  (${deg(n)}°)`);

console.log('\n  HOW SHORT would a reader have to be? Same sweep, keeping only the feeler\'s');
console.log('  points inside each radius — so this asks whether the BAND is full or the ARM is long:\n');
console.log('    reader reaches r   stations as good as shipped        best gap');
for (const c of out.cutoffs) {
  const label = c.cut >= 99 ? `${out.feeler.r[1]} (the whole arm)` : `${c.cut}`;
  console.log(`    ${String(label).padEnd(20)} ${String(c.free).padStart(3)} of ${out.total}  (${deg(c.free).padStart(5)}°)        ${c.best}`);
}

console.log('\nTIER TWO — the tail\'s run to the release lifter\n');
if (!out.lift) console.log('  no Alarm release lifter unit found');
else {
  console.log(`  lifter at r ${out.lift.r}, azimuth ${out.lift.azDeg}°, z ${out.lift.z}`);
  console.log(`  the feeler's tail tip traces r ${out.lift.tailR}, so the run to the lifter spans`);
  console.log(`    ${out.lift.min} → ${out.lift.max}  (a spread of ${(out.lift.max - out.lift.min).toFixed(3)})`);
  console.log(`  That spread is the cost the item asks for: a fixed lifter and an orbiting tail need a`);
  console.log(`  link whose length changes by it, or an output taken on the feeler's own axis instead.`);
}
console.log('\nThe SWEEP is a report — nothing in it passes or fails. What counts as enough free');
console.log('azimuth, and how short the reader may be, are design questions this does not answer.');
console.log(`\n${bad === 0 ? 'PASS — the controls hold, so the rows above are readable' : `FAIL — ${bad} control(s)`}`);
await browser.close(); srv.kill();
process.exit(bad === 0 ? 0 : 1);
