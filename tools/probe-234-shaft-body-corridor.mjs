// §234 Landing 4 addendum — WHAT IS THE FREE RADIUS OF THE LAY SHAFT'S BODY
// ALONE, STATION BY STATION, IF THE NECKS BECOME SEPARATE PRESSED STUBS?
//
// TODO 145 group A's `turnedBars` census clusters `alarmLinkShaft` (the
// body, t1..t3, 28.3 u) with its two necks into one bar at the necks'
// narrow diameter (0.2664, L/D 104.3). §234 Landing 4 asked whether a
// SHORTER chord at a fatter uniform section clears both the L/D target and
// the corridor, and measured no — but Landing 4's `scoreChord` scored the
// WHOLE candidate chord (body + both neck/stub regions) at ONE bush-OD
// figure (`s + 0.02 + 0.12`), and `probe-231-lever-width.mjs SET=link232`
// separately found the real wall (`Dial / alarmSelTab`) sits AT the crank
// station (shaft-local s ≈ −16.693, per docs/BUILT.md §232's "Three
// instruments" note) — outside the body's own t1..t3 run, "nowhere along
// the 33-unit run". Nobody has measured the BODY'S OWN corridor in
// isolation, with the crank/rod contacts left where they are (on fixed-
// radius stub necks, per TODO 145 group A's priced option 1 — a balance-
// staff construction, fat body / thin pressed pivots).
//
// METHOD. The body mesh `alarmLinkShaft` is a straight CylinderGeometry;
// its mesh-local +Y is the chord's own axis (rotation.z = PI/2 sends
// geometry +Y to the shaft group's -X, and the mesh sits centred on its own
// length — see the long §232 comment block in src/main.js above
// `ALARM_LINK_BUSH_T`). Reading the axis off `matrixWorld`'s Y column
// (rather than re-deriving ALARM_LINK_FORK_STATION et al., which are
// function-local consts with no window hook) means this probe cannot be
// wrong about WHERE the metal's own axis is, only about what stands near
// it — the property the instruments skill asks for. A single small SPHERE
// probe (r 0.02) is walked along that axis every ~0.5 u from the body's own
// −halfLen to +halfLen (that IS t1..t3 — the body's local Y span, by
// construction), plus 5 u of overrun each side into the neck/crank/rod
// territory for the CONTROL below, and `meshClearance` (the real BVH
// distance to the metal, never a bounding box) reports the nearest
// obstacle's surface at each station over the FULL pose net
// (`digestPoses`, the same derived set `unitDigests`/the battery use — not
// invented here). Free radius at a station = (probe radius + measured gap)
// − CLEAR_MARGIN, minimised over every pose — and the same minimum kept
// SEPARATELY for walls BELOW the axis, ABOVE it and IN PLAN (which way the
// nearest metal lies is read off the obstacle's world AABB's closest point
// to the station, never its bounding-sphere centre: the first cut used the
// centre and labelled the alarm setting idler an in-plane wall, when that
// idler is a 9 u disc whose centre sits 4.4 u off the axis in plan while its
// top face lies 0.435 straight below it). The three columns are what turn
// "the body cannot be fatter" into "the body cannot be fatter AT THIS
// STRATUM" — a wall below the axis is answered by raising the shaft, a wall
// in plan by re-siting it, and the two are different landings.
//
// OBSTACLES: every non-schematic mesh in the scene EXCEPT the 'Alarm link'
// unit's own meshes (rod, necks, cranks, hangers/bushes — the hangers are
// bored to the shaft's own OD and are the GROUND this shaft stands in, not
// a wall; the skill's "ground is not an obstacle" trap). Unlike
// `probe-231-lever-width SET=link232`'s `follows` table, the crank rim/pin
// and `alarmLinkRod` are NOT excluded here as "moves with the radius" —
// under the pressed-stub construction being priced, the cranks stay on
// fixed-radius NECK stubs independent of the body's section, so growing
// the body must be checked against them like any other neighbour. (They
// are still excluded as part of the 'Alarm link' unit itself, which is
// correct: the unit's own crank/rod geometry does not change in this
// experiment, only the body between the bushes does, and this probe is
// asking what stands OUTSIDE the unit.)
//
// CONTROLS:
//   (a) at the shipped body radius (ALARM_LINK_SHAFT_R, read off the mesh's
//       own CylinderGeometry radius — never re-typed), every body-only
//       station (t1..t3) must clear CLEAR_MARGIN, because the battery says
//       the shipped tree is clean. A miss here means the instrument is
//       measuring something other than what `clearances`/`intraUnit` do.
//   (b) the OVERRUN stations (into neck/crank territory) must show a
//       TIGHTER wall than the body-only span's own worst station, and its
//       radius must land near the ~0.2635–0.285 figures §232/§234 already
//       measured by independent instruments (`probe-231-lever-width`,
//       `probe-137-jumper-envelope.mjs`) — if the overrun profile does not
//       reproduce that order of magnitude, this probe is not seeing the
//       metal those instruments saw.
//
// WHAT THIS IS NOT: `probe-231-lever-width.mjs SET=link232` (scales the
// WHOLE body uniformly and reports one worst-case ladder, with the
// crank/rod EXCLUDED as "follows" — the single-diameter-shaft question);
// `probe-l3-shaft-ld-filter.mjs` (varies the CHORD SITE via the §112 solve's
// own 2D box-distance heuristic, never the real BVH metal, and scores the
// whole candidate at one uniform section); `probe-79-rodend-band.mjs` /
// `probe-137-jumper-envelope.mjs` (report a single number for their own
// sub-spans, not a station-resolved profile of the body alone).
//
// A REPORT (§40): prints and exits 0. Phase 0's stop/go gate is read off
// the numbers by a person, per the task record.
//
// Usage: cd tools && node probe-234-shaft-body-corridor.mjs [out.json]
//        env STEP=0.5 OVERRUN=5 SEARCH=3.0 node probe-234-shaft-body-corridor.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8544;
const ROOT = process.env.ROOT || '..';
const STEP = +(process.env.STEP || 0.5);
const OVERRUN = +(process.env.OVERRUN || 5);
const SEARCH = +(process.env.SEARCH || 3.0);

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const R = await page.evaluate(async ({ STEP, OVERRUN, SEARCH }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const { CLEAR_MARGIN, UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;

  const target = null;
  const all = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.userData && o.userData.schematic) return;
    all.push(o);
  });
  const byName = new Map();
  for (const o of all) if (o.name && !byName.has(o.name)) byName.set(o.name, o);
  const body = byName.get('alarmLinkShaft');
  if (!body) throw new Error('alarmLinkShaft not found in the scene');

  const unitOf = new Map();
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (!unitOf.has(o)) unitOf.set(o, e.name); });
  const nameOf = (o) => o.name || '(unnamed)';

  const obstacles = all.filter((o) => o !== body && unitOf.get(o) !== 'Alarm link');

  body.geometry.computeBoundingBox();
  const bodyLen = body.geometry.parameters && body.geometry.parameters.height != null
    ? body.geometry.parameters.height
    : (body.geometry.boundingBox.max.y - body.geometry.boundingBox.min.y);
  const shippedR = body.geometry.parameters ? body.geometry.parameters.radiusTop : null;
  const halfLen = bodyLen / 2;

  // stations, in mesh-local Y (which IS the chord axis, by construction):
  // the body-only span is [-halfLen, +halfLen] == [t1, t3]; OVERRUN samples
  // past each end into neck/crank territory for control (b).
  const stations = [];
  for (let y = -halfLen - OVERRUN; y <= halfLen + OVERRUN + 1e-9; y += STEP) stations.push(+y.toFixed(4));

  const poses = I.digestPoses(clock);

  // one reusable probe sphere, matrixAutoUpdate off — repositioned by hand
  // every (pose, station), exactly probe-231's pattern.
  const PROBE_R = 0.02;
  const probeGeom = new THREE.SphereGeometry(PROBE_R, 8, 6);
  probeGeom.computeBoundingSphere();
  const probe = new THREE.Mesh(probeGeom, new THREE.MeshBasicMaterial());
  probe.matrixAutoUpdate = false;
  clock.scene.add(probe);

  const _sc = new THREE.Vector3(), _ss = new THREE.Vector3();
  const worldSphere = (o) => {
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const bs = o.geometry.boundingSphere;
    _sc.copy(bs.center).applyMatrix4(o.matrixWorld);
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), _ss);
    const k = Math.max(Math.abs(_ss.x), Math.abs(_ss.y), Math.abs(_ss.z));
    return { x: _sc.x, y: _sc.y, z: _sc.z, r: bs.radius * k };
  };
  // world AABB per obstacle, cached per pose (cleared at each pose below) —
  // only read for the DIRECTION label, never for the distance.
  const boxCache = new Map();
  const worldBox = (o) => {
    let b = boxCache.get(o);
    if (!b) { b = new THREE.Box3().setFromObject(o); boxCache.set(o, b); }
    return b;
  };

  // per-station worst (min) gap across the whole pose net, with owner+pose;
  // and the same minimum split by WHICH WAY the wall lies (below the axis,
  // above it, or in plan), so a stratum question can be read off directly.
  const freshSides = () => ({ below: { gap: Infinity, owner: null, poseIdx: null }, above: { gap: Infinity, owner: null, poseIdx: null }, plan: { gap: Infinity, owner: null, poseIdx: null } });
  const rows = stations.map((y) => ({ y, gap: Infinity, owner: null, poseIdx: null, dir: null, bySide: freshSides() }));
  const axisDir = new THREE.Vector3(), center = new THREE.Vector3(), pt = new THREE.Vector3();
  const probeMat = new THREE.Matrix4();

  let lastAxis = null;
  for (let pi = 0; pi < poses.length; pi++) {
    const p = poses[pi];
    if (p.axis !== lastAxis) { I.enterAxis(clock); lastAxis = p.axis; }
    clock.setPose(p);
    clock.scene.updateMatrixWorld(true);
    boxCache.clear();

    body.updateWorldMatrix(true, false);
    const m = body.matrixWorld.elements;
    axisDir.set(m[4], m[5], m[6]).normalize();
    center.set(m[12], m[13], m[14]);

    // shortlist once per pose: everything within SEARCH of the body's own
    // world sphere, GROWN by the overrun so the extended stations are
    // covered too (a sphere containing the whole sampled segment).
    const reach = halfLen + OVERRUN + SEARCH + PROBE_R;
    const near = [];
    for (const o of obstacles) {
      const s = worldSphere(o);
      const d = Math.hypot(s.x - center.x, s.y - center.y, s.z - center.z);
      if (d <= s.r + reach) near.push(o);
    }

    for (let si = 0; si < stations.length; si++) {
      pt.copy(center).addScaledVector(axisDir, stations[si]);
      probeMat.identity().setPosition(pt);
      probe.matrix.copy(probeMat);
      probe.matrixWorld.copy(probeMat);
      let best = Infinity, bestOwner = null, bestVec = null;
      for (const o of near) {
        const s = worldSphere(o);
        const d0 = Math.hypot(s.x - pt.x, s.y - pt.y, s.z - pt.z);
        if (d0 > s.r + SEARCH + PROBE_R) continue;
        const d = I.meshClearance(probe, o, SEARCH);
        if (!(d < SEARCH)) continue;
        // DIRECTION is read off the obstacle's world AABB's closest point to
        // the station, NOT off its bounding-sphere centre: the first cut used
        // the centre and called the alarm setting idler an in-plane wall,
        // when that idler is a 9 u DISC whose centre sits 4.4 u off the axis
        // in plan while its TOP FACE lies 0.435 straight below the axis — the
        // nearest metal was vertical and the label said otherwise. A flat
        // sheet's AABB puts its closest point on the face; a post beside the
        // shaft puts it in plan. Still a proxy (the AABB, not the surface),
        // but one that answers "which way is the wall" for the shapes here.
        const bx = worldBox(o);
        const cx = Math.min(Math.max(pt.x, bx.min.x), bx.max.x), cy = Math.min(Math.max(pt.y, bx.min.y), bx.max.y), cz = Math.min(Math.max(pt.z, bx.min.z), bx.max.z);
        const v = { dx: cx - pt.x, dy: cy - pt.y, dz: cz - pt.z };
        const vertical = Math.abs(v.dz) > Math.hypot(v.dx, v.dy);
        const sideKey = vertical ? (v.dz < 0 ? 'below' : 'above') : 'plan';
        const row = rows[si];
        if (d < row.bySide[sideKey].gap) { row.bySide[sideKey] = { gap: d, owner: `${unitOf.get(o) || '?'} / ${nameOf(o)}`, poseIdx: pi }; }
        if (d < best) { best = d; bestOwner = `${unitOf.get(o) || '?'} / ${nameOf(o)}`; bestVec = v; }
      }
      const row = rows[si];
      if (best < row.gap) {
        row.gap = best; row.owner = bestOwner; row.poseIdx = pi;
        row.dir = bestVec ? (Math.abs(bestVec.dz) > Math.hypot(bestVec.dx, bestVec.dy) ? (bestVec.dz < 0 ? 'z-' : 'z+') : 'xy') : null;
      }
    }
  }
  clock.scene.remove(probe); probeGeom.dispose();

  const out = rows.map((r) => ({
    y: r.y,
    inBody: r.y >= -halfLen - 1e-6 && r.y <= halfLen + 1e-6,
    freeR: isFinite(r.gap) ? +(PROBE_R + r.gap - CLEAR_MARGIN).toFixed(4) : null,
    rawGap: isFinite(r.gap) ? +r.gap.toFixed(4) : null,
    owner: r.owner, poseIdx: r.poseIdx, dir: r.dir,
    below: sideOut(r.bySide.below), above: sideOut(r.bySide.above), plan: sideOut(r.bySide.plan),
  }));
  function sideOut(s) { return { freeR: isFinite(s.gap) ? +(PROBE_R + s.gap - CLEAR_MARGIN).toFixed(4) : null, owner: s.owner, poseIdx: s.poseIdx }; }
  const bodyRows = out.filter((r) => r.inBody);
  const worstBody = bodyRows.reduce((a, b) => (b.freeR < a.freeR ? b : a), bodyRows[0]);
  const overrunRows = out.filter((r) => !r.inBody);
  const worstOverrun = overrunRows.length
    ? overrunRows.reduce((a, b) => (b.freeR < a.freeR ? b : a), overrunRows[0]) : null;
  const worstSide = (key) => bodyRows.reduce((a, b) => ((b[key].freeR ?? Infinity) < (a[key].freeR ?? Infinity) ? b : a), bodyRows[0]);
  const worstBodyBySide = { below: worstSide('below'), above: worstSide('above'), plan: worstSide('plan') };

  return {
    clearMargin: CLEAR_MARGIN, unitMm: UNIT_MM, poseCount: poses.length,
    bodyLen: +bodyLen.toFixed(4), shippedR: shippedR != null ? +shippedR.toFixed(4) : null,
    halfLen: +halfLen.toFixed(4), step: STEP, overrun: OVERRUN,
    axisZ: +center.z.toFixed(4),
    stations: out, worstBody, worstOverrun, worstBodyBySide,
  };
}, { STEP, OVERRUN, SEARCH });

console.log(`§234 group A — shaft body corridor, station by station`);
console.log(`  body: len ${R.bodyLen} u (t1..t3 span), shipped r ${R.shippedR}, axis z ${R.axisZ}, CLEAR_MARGIN ${R.clearMargin}, ${R.poseCount} poses`);
console.log('');
console.log('  y        inBody  freeR    rawGap   owner                                  dir  pose#   below    above    plan');
const f = (v) => String(v == null ? '—' : v).padStart(7);
for (const r of R.stations) {
  console.log(`  ${r.y.toFixed(3).padStart(7)}  ${String(r.inBody).padEnd(6)}  ${String(r.freeR).padStart(7)}  ${String(r.rawGap).padStart(7)}  ${String(r.owner).padEnd(38)} ${String(r.dir).padEnd(4)} ${String(r.poseIdx).padEnd(5)} ${f(r.below.freeR)} ${f(r.above.freeR)} ${f(r.plan.freeR)}`);
}
console.log('');
console.log(`WORST BODY-ONLY STATION (t1..t3): y=${R.worstBody.y}  freeR=${R.worstBody.freeR}  wall=${R.worstBody.owner}  dir=${R.worstBody.dir}  pose#${R.worstBody.poseIdx}`);
for (const k of ['below', 'above', 'plan']) {
  const w = R.worstBodyBySide[k];
  console.log(`  worst ${k.padEnd(5)} over the body: y=${w.y}  freeR=${w[k].freeR}  wall=${w[k].owner}  pose#${w[k].poseIdx}`);
}
if (R.worstOverrun) console.log(`WORST OVERRUN STATION (neck/crank territory): y=${R.worstOverrun.y}  freeR=${R.worstOverrun.freeR}  wall=${R.worstOverrun.owner}  dir=${R.worstOverrun.dir}  pose#${R.worstOverrun.poseIdx}`);
console.log('');
console.log(`CONTROL (a) shipped body r ${R.shippedR} clears body-only worst freeR ${R.worstBody.freeR}: ${R.worstBody.freeR >= R.shippedR ? 'PASS' : 'FAIL — the shipped tree should read clean here'}`);
if (R.worstOverrun) console.log(`CONTROL (b) overrun worst (${R.worstOverrun.freeR}) tighter than body worst (${R.worstBody.freeR}): ${R.worstOverrun.freeR < R.worstBody.freeR ? 'PASS' : 'FAIL — expected the crank-station wall to bind harder than mid-body'}`);
console.log('');
console.log(`Target r 0.786 (TURN_LD_TARGET=18 over ${R.bodyLen} u): ${R.worstBody.freeR >= 0.786 ? 'FITS' : `SHORT by ${(0.786 - R.worstBody.freeR).toFixed(4)}`}`);
console.log(`Ceiling r 0.708 (TURN_LD_MAX=20 over ${R.bodyLen} u):  ${R.worstBody.freeR >= 0.708 ? 'FITS' : `SHORT by ${(0.708 - R.worstBody.freeR).toFixed(4)}`}`);

const out = process.argv[2];
if (out) { writeFileSync(out, JSON.stringify(R, null, 1)); console.log(`wrote ${out}`); }
await browser.close();
