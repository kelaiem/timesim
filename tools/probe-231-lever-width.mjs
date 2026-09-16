// §231 — HOW MUCH WIDER CAN EACH OF THE ALARM SWITCH'S FLOOR-STOCK LEVERS BE CUT?
//
// §226 established the owner's reference (every feature reads one RATCHET
// TOOTH deep, 1.2540 u off the column wheel's own ratchetPoly), §229 cut the
// link's beak and arms to it, §230 the driver pawl. What is left in the
// 'Alarm switch' unit is a handful of members still at `STOCK_MIN_U` in a PLAN
// dimension — §50's floor standing in for a design. This measures what the
// movement allows each of them, so the width is chosen between a derived floor
// and a measured ceiling instead of pinned to the floor.
//
// IT GROWS THE MEMBER, NOT A MODEL OF IT. §230's first finding was that
// probe-163-driver's `freeRegion` models the pawl as a constant-width CAPSULE
// and never models its boss, so the radius it solved described a part the
// builder does not make. The lesson taken here: the thing measured at each
// candidate width is the MEMBER'S OWN GEOMETRY, cloned and SCALED along the
// width axis about its own centre, rigidly following the real member's world
// matrix pose by pose. There is no second model of the part to drift from the
// first.
//
// The first cut of this probe substituted a BOX of the member's bounding
// extents instead, and C1 caught it on the very first bored part: the return
// abutment is an annulus, a box FILLS ITS BORE, and the proxy read 0.0219
// closer than the member it stood for. A box is a model; the geometry is the
// part. (A scale is legal here because every candidate is a prism or a
// revolve whose width is one extrusion or one length — a member whose width
// is not a scale of itself does not belong on this list.)
//
// WHAT IT CANNOT SEE, stated because FIVE of its eight rows are governed by it:
// the ladder holds THE REST OF THE MOVEMENT FIXED. A width that also feeds a
// STATION — the return bracket's thickness along the press axis walks the
// abutment, the collar and the guide boss outboard through `abutS`, and the
// post's width walks itself out through `postW` — moves its own neighbours in
// the real build, so the ladder measures a movement that would not exist at
// that width. Such a row reads as a wall that is really a companion, or as
// free room that is really spent elsewhere; both happened here. For those
// members the binding measurement is the STATION's own headroom (§231 took the
// guide boss's remaining plate: 0.3042), not this.
//
// WHICH INSTRUMENT THIS IS NOT (the skill's rule, so the next search works):
//   · NOT probe-section-headroom.mjs. That one is the right SHAPE — nearest
//     cross-unit metal over the pose net, ranked — but its targets are
//     checkSlenderness's unwaived rows (9 of them, none here: these bars are
//     comfortably under the λ ceiling, which is exactly why nothing flagged
//     them), and it EXCLUDES the member's own unit. Here the unit is the wall:
//     the reach bar's neighbours are the stem, the riser and the column work.
//   · NOT probe-226-driver-width.mjs. That rasterises a free region in one
//     part's rotating frame to answer "what outline could this blank have".
//     These members are bars with one free plan dimension, so a width ladder
//     answers it directly and shape-honestly; a raster would add a second
//     model for nothing.
//   · NOT probe-163-driver.mjs. That maps a pawl centreline's corridor.
//
// THE OBSTACLE SET, per member, is every non-schematic mesh in the scene EXCEPT
//   1. the member itself;
//   2. its DECLARED joints, read from inspect.js's INTRA_UNIT_CONTACTS rather
//      than named here — a part is meant to touch what it is joined to;
//   3. meshes MEASURED rigid with it over the pose net, which cannot collide
//      with a body they travel with.
// Everything else stays, INCLUDING the rest of the 'Alarm switch' unit.
//
// FOUR CONTROLS, because a width scan that never blocks has measured nothing:
//   C1 FIDELITY — at the SHIPPED width the proxy's nearest gap must reproduce
//      the real member's own nearest gap to 1e-4 over the same poses. This is
//      the load-bearing one: it proves the proxy IS the member, and it is what
//      would have caught §230's capsule.
//   C2 MONOTONE — the gap may never RISE as the width grows. A ladder that
//      wanders is measuring pose noise, not a corridor.
//   C3 RATE — while one neighbour keeps governing, the gap may close by AT MOST
//      δ/2 per δ of width (the member grows δ/2 toward it) and may never open:
//      Δgap/Δwidth ∈ [−0.5, 0]. It is a BAND, not an equality, and the first
//      cut of this probe had it as an equality and failed all eight rows at
//      exactly 0.5 — i.e. on Δgap/Δw = 0, which is the CORRECT reading when the
//      governing neighbour does not lie in the growth direction (grow a bar
//      sideways and the gap to something above it does not move). A control
//      that fires on correct behaviour is worse than no control, because the
//      next reader learns to ignore it.
//   C4 CAN SAY NO — a scan that never blocks has not measured a corridor, so
//      the ladder is required to drive at least one member under CLEAR_MARGIN.
//      It is a control on the MEASUREMENT, not on any member: a row that never
//      blocks is a legitimate finding (an open corridor), and is reported as
//      `blocks: false` rather than as a failure. Read the two together — an
//      open row is only believable while some other row closes.
//
// THE SHORTLIST IS A BOUNDING SPHERE, not a box, and that is a cost decision
// with a correctness condition. `Box3.setFromObject` WALKS THE GEOMETRY, so
// rebuilding every obstacle's world box at every pose of every member is
// hundreds of thousands of vertex walks and the probe never finishes (measured:
// the first cut ran ten minutes without reaching its first row). A geometry's
// bounding SPHERE is computed once and transformed in O(1), and it is
// CONSERVATIVE — it contains the box — so shortlisting on it can only ever keep
// too many, never too few. The exact answer still comes from `meshClearance`
// on the survivors, so the sphere buys wall clock and spends no accuracy.
//
// A REPORT (§40): prints and exits 0. The battery is the acceptance for a
// width that lands.
//
// Usage: cd tools && node probe-231-lever-width.mjs [out.json]
//        env SAMPLES=5 WMAX=3.2 STEPS=17
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8533;
const ROOT = process.env.ROOT || '..';
const SAMPLES = +(process.env.SAMPLES || 5);
const WMAX = +(process.env.WMAX || 3.2);
const STEPS = +(process.env.STEPS || 17);

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const R = await page.evaluate(async ({ SAMPLES, WMAX, STEPS }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const { CLEAR_MARGIN, UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;

  // The MEMBERS, and the LOCAL AXIS each one's width runs along. A box is
  // widened about its own centre, so the axis is all this needs to know; the
  // member's other two dimensions are read off its own geometry and held.
  const MEMBERS = [
    { mesh: 'alarmPusherReach',          axis: 'y', what: 'the reach bar\'s plan width (ALARM_PUSH_REACH_W)' },
    { mesh: 'alarmPusherReach',          axis: 'z', what: 'the reach bar\'s thickness (ALARM_PUSH_REACH_T) — the z-costing direction' },
    { mesh: 'alarmPusherReturnArm',      axis: 'x', what: 'the return bracket\'s arm, along the press axis (bracketT)' },
    { mesh: 'alarmPusherReturnArm',      axis: 'z', what: 'the return bracket\'s arm, vertical (bracketT)' },
    { mesh: 'alarmPusherReturnPost',     axis: 'x', what: 'the return bracket\'s post, along the press axis (bracketT)' },
    { mesh: 'alarmPusherReturnPost',     axis: 'y', what: 'the return bracket\'s post, across it (bracketT)' },
    { mesh: 'alarmPusherCollar',         axis: 'y', what: 'the return collar\'s thickness on the stem (collarT)' },
    { mesh: 'alarmPusherReturnAbutment', axis: 'z', what: 'the return abutment\'s thickness (abutT)' },
  ];

  const unitOf = new Map();
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (!unitOf.has(o)) unitOf.set(o, e.name); });
  const all = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.userData && o.userData.schematic) return;
    all.push(o);
  });
  const nameOf = (o) => o.name || '(unnamed)';
  const byName = new Map();
  for (const o of all) if (o.name && !byName.has(o.name)) byName.set(o.name, o);

  const poses = [];
  for (const axis of I.AXES) for (let s = 0; s < SAMPLES; s++) poses.push({ axis, f: SAMPLES === 1 ? 0 : s / (SAMPLES - 1) });

  // Rigid-with-the-member, MEASURED over the pose net (probe-226's method).
  const relOf = (o, inv, _m) => _m.multiplyMatrices(inv, o.matrixWorld).elements.slice();
  // memoised: several rows measure two axes of ONE member, and the rigid set
  // is a property of the member, not of the axis.
  const _rigidCache = new Map();
  const rigidWith = (target) => {
    if (_rigidCache.has(target)) return _rigidCache.get(target);
    const _m = new THREE.Matrix4();
    const relFirst = new Map(); const rigid = new Set();
    I.enterAxis(clock); clock.scene.updateMatrixWorld(true);
    let inv = new THREE.Matrix4().copy(target.matrixWorld).invert();
    for (const o of all) { relFirst.set(o, relOf(o, inv, _m)); rigid.add(o); }
    let lastAxis = null;
    for (const p of poses) {
      if (p.axis !== lastAxis) { I.enterAxis(clock); lastAxis = p.axis; }
      clock.setPose(p.axis.pose(p.f)); clock.scene.updateMatrixWorld(true);
      inv = new THREE.Matrix4().copy(target.matrixWorld).invert();
      for (const o of Array.from(rigid)) {
        const a = relFirst.get(o), b = relOf(o, inv, _m);
        let same = true;
        for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > I.FRAME_TOL) { same = false; break; }
        if (!same) rigid.delete(o);
      }
    }
    _rigidCache.set(target, rigid);
    return rigid;
  };

  const SEARCH = 3.0;
  // one world sphere per mesh, from a geometry sphere computed once
  const _sc = new THREE.Vector3(), _ss = new THREE.Vector3();
  const worldSphere = (o) => {
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const bs = o.geometry.boundingSphere;
    _sc.copy(bs.center).applyMatrix4(o.matrixWorld);
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), _ss);
    const k = Math.max(Math.abs(_ss.x), Math.abs(_ss.y), Math.abs(_ss.z));
    return { x: _sc.x, y: _sc.y, z: _sc.z, r: bs.radius * k };
  };

  // POSES OUTER, WIDTHS INNER. The first cut of this probe ran the pose net
  // once per rung, so every obstacle's world box was rebuilt STEPS times at
  // each pose — `setFromObject` walks the geometry, and with ~570 obstacles
  // over 8 members that is tens of millions of walks for an answer that does
  // not depend on the rung. Here each pose is entered once: the obstacle boxes
  // and the SHORTLIST (those within SEARCH of the WIDEST proxy, which contains
  // every narrower one) are computed there, and the ladder is walked inside.
  const out = [];
  for (const M of MEMBERS) {
    const target = byName.get(M.mesh);
    if (!target) { out.push({ ...M, error: 'not in the scene' }); continue; }

    const joints = new Set();
    for (const r of I.INTRA_UNIT_CONTACTS) {
      if (r.a === M.mesh) joints.add(r.b);
      if (r.b === M.mesh) joints.add(r.a);
    }
    const rigid = rigidWith(target);
    const obstacles = all.filter((o) => o !== target && !rigid.has(o) && !joints.has(o.name));

    target.geometry.computeBoundingBox();
    const bb = target.geometry.boundingBox;
    const dim = { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
    const ctr = { x: (bb.max.x + bb.min.x) / 2, y: (bb.max.y + bb.min.y) / 2, z: (bb.max.z + bb.min.z) / 2 };
    const shipped = dim[M.axis];

    const widths = [];
    for (let i = 0; i < STEPS; i++) widths.push(shipped + (WMAX - shipped) * (i / (STEPS - 1)));

    // one PROXY per rung, built once and re-posed — the member's OWN geometry
    // scaled along the width axis about its own centre, riding the member's
    // world matrix. At w = shipped the scale is 1, so C1 below is a check on
    // this plumbing (clone, matrix copy, obstacle set) rather than on shape.
    const S = { x: 1, y: 1, z: 1 };
    const proxies = widths.map((w) => {
      const g = target.geometry.clone();
      const k = w / shipped;
      const sc = { ...S, [M.axis]: k };
      g.translate(-ctr.x, -ctr.y, -ctr.z);
      g.scale(sc.x, sc.y, sc.z);
      g.translate(ctr.x, ctr.y, ctr.z);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
      m.matrixAutoUpdate = false;
      clock.scene.add(m);
      return m;
    });
    const widest = proxies[proxies.length - 1];

    const best = widths.map(() => ({ gap: Infinity, owner: null }));
    let realMin = Infinity, realOwner = null;

    let lastAxis = null;
    for (const p of poses) {
      if (p.axis !== lastAxis) { I.enterAxis(clock); lastAxis = p.axis; }
      clock.setPose(p.axis.pose(p.f));
      clock.scene.updateMatrixWorld(true);
      for (const m of proxies) { m.matrix.copy(target.matrixWorld); m.matrixWorld.copy(target.matrixWorld); }

      // the shortlist, once per pose: anything whose world sphere comes within
      // SEARCH of the WIDEST rung's. Every narrower rung sits inside the widest,
      // and a sphere contains its box, so nothing that could matter is dropped.
      const wS = worldSphere(widest);
      const near = [];
      for (const c of obstacles) {
        const s = worldSphere(c);
        if (Math.hypot(s.x - wS.x, s.y - wS.y, s.z - wS.z) <= s.r + wS.r + SEARCH) near.push(c);
      }

      const scan = (probe, acc) => {
        const pS = worldSphere(probe);
        for (const c of near) {
          const s = worldSphere(c);
          if (Math.hypot(s.x - pS.x, s.y - pS.y, s.z - pS.z) > s.r + pS.r + SEARCH) continue;
          const d = I.meshClearance(probe, c, SEARCH);
          if (!(d < SEARCH)) continue;
          if (d < acc.gap) { acc.gap = d; acc.owner = `${unitOf.get(c) || '?'} / ${nameOf(c)}`; }
        }
      };
      for (let i = 0; i < proxies.length; i++) scan(proxies[i], best[i]);
      const realAcc = { gap: realMin, owner: realOwner };
      scan(target, realAcc);
      realMin = realAcc.gap; realOwner = realAcc.owner;
    }
    for (const m of proxies) { clock.scene.remove(m); m.geometry.dispose(); }

    const ladder = widths.map((w, i) => ({ w: +w.toFixed(4),
      gap: isFinite(best[i].gap) ? +best[i].gap.toFixed(4) : null, owner: best[i].owner }));

    const atShipped = ladder[0];
    const c1 = (atShipped.gap != null && isFinite(realMin)) ? Math.abs(atShipped.gap - realMin) : null;
    let c2 = 0;      // worst RISE in gap as width grows
    let c3 = null;   // worst |dgap/dw + 0.5| across same-owner steps
    for (let i = 1; i < ladder.length; i++) {
      const a = ladder[i - 1], b = ladder[i];
      if (a.gap == null || b.gap == null) continue;
      c2 = Math.max(c2, b.gap - a.gap);
      if (a.owner && a.owner === b.owner && b.w > a.w) {
        // how far OUTSIDE the band [-0.5, 0] this step's rate falls
        const rate = (b.gap - a.gap) / (b.w - a.w);
        const e = Math.max(0, rate - 0, -0.5 - rate);
        c3 = c3 == null ? e : Math.max(c3, e);
      }
    }
    const blocked = ladder.find((r) => r.gap != null && r.gap < CLEAR_MARGIN);
    let lastOk = null;
    for (const r of ladder) { if (r.gap != null && r.gap >= CLEAR_MARGIN) lastOk = r; else break; }
    out.push({
      mesh: M.mesh, axis: M.axis, what: M.what,
      shipped: +shipped.toFixed(4), shipped_mm: +(shipped * UNIT_MM).toFixed(4),
      realGap: isFinite(realMin) ? +realMin.toFixed(4) : null, realOwner,
      widestOk: lastOk ? lastOk.w : null, widestOkGap: lastOk ? lastOk.gap : null, widestOkOwner: lastOk ? lastOk.owner : null,
      firstBlocked: blocked ? blocked.w : null, firstBlockedGap: blocked ? blocked.gap : null, firstBlockedOwner: blocked ? blocked.owner : null,
      controls: {
        C1_fidelity: c1, C1: c1 != null && c1 <= 1e-4 ? 'PASS' : 'FAIL',
        C2_worstRise: +c2.toFixed(6), C2: c2 <= 1e-4 ? 'PASS' : 'FAIL',
        C3_worstOutOfBand: c3 == null ? null : +c3.toFixed(4), C3: c3 == null ? 'n/a - the governing neighbour changed at every rung' : (c3 <= 1e-3 ? 'PASS' : 'FAIL'),
        blocks: !!blocked,   // a FACT about this member, read against C4 below
      },
      ladder,
    });
  }
  return { clearMargin: CLEAR_MARGIN, unitMm: UNIT_MM, poses: poses.length, axes: I.AXES.length, samplesPerAxis: SAMPLES, rows: out };
}, { SAMPLES, WMAX, STEPS });

console.log(`§231 lever-width ladder — ${R.axes} axes x ${R.samplesPerAxis} = ${R.poses} poses, CLEAR_MARGIN ${R.clearMargin}`);
console.log('');
for (const r of R.rows) {
  if (r.error) { console.log(`${r.mesh} [${r.axis}]  ERROR ${r.error}`); continue; }
  const c = r.controls;
  console.log(`${r.mesh}  [${r.axis}]  — ${r.what}`);
  console.log(`   shipped ${r.shipped} u (${r.shipped_mm} mm), own nearest gap ${r.realGap} to ${r.realOwner}`);
  console.log(`   widest rung holding CLEAR_MARGIN: ${r.widestOk} (gap ${r.widestOkGap}, wall ${r.widestOkOwner})`);
  console.log(`   first rung under it:               ${r.firstBlocked} (gap ${r.firstBlockedGap}, wall ${r.firstBlockedOwner})`);
  console.log(`   controls  C1 ${c.C1} (${c.C1_fidelity})  C2 ${c.C2} (${c.C2_worstRise})  C3 ${c.C3} (${c.C3_worstOutOfBand})  blocks ${c.blocks}`);
  console.log('');
}
const c4 = R.rows.some((r) => r.controls && r.controls.blocks);
console.log(`C4 (probe-wide) ${c4 ? 'PASS' : 'FAIL'} — ${R.rows.filter((r) => r.controls && r.controls.blocks).length}/${R.rows.length} row(s) were driven under CLEAR_MARGIN, so the ladder can say no.`);
const bad = R.rows.filter((r) => r.controls && ['C1', 'C2', 'C3'].some((k) => typeof r.controls[k] === 'string' && r.controls[k].startsWith('FAIL')));
if (bad.length) console.log(`NOTE: ${bad.length} row(s) have a failing control — read those ladders with suspicion:\n  ` + bad.map((r) => `${r.mesh} [${r.axis}]`).join('\n  '));
else console.log('C1/C2/C3 PASS on every row.');
const out = process.argv[2];
if (out) { writeFileSync(out, JSON.stringify(R, null, 1)); console.log(`wrote ${out}`); }
await browser.close();
