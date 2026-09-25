// TODO 150 — DOES THE SETTING FOLD TURN AS ONE TRAIN? Every shaft rigid, every
// bevel corner rolling, the cap pinion meshing the minute wheel at its ratio.
//
// Owner's report: "a spider that inexplicably turns the opposite direction as
// the axle it's mounted in" — the rise corner's outboard bevel against the
// setting cap on the same rod. Measured, all three of §234's rods did it: tick
// alternated the sign corner to corner as if a ROD were an external mesh, and
// the two mounts on one rod face each other, so one world spin reads as
// opposite local spins. probe-coaxial-sense.mjs is the sibling and cannot see
// this: it reads azimuth about world z, and two of these rods lie in the plane.
//
// HOW IT MEASURES. Each member's WORLD angular velocity VECTOR, from two poses a
// small step of the setting input apart (setPathRot 0 → 0.01; crown in, so the
// hand-set offset is the raw forward chain and no easing is involved) — the
// quaternion difference as axis·angle. Nothing reasons about mount frames,
// which is where the defect lived.
//
// GATES (exit non-zero):
//   · RODS — the two members keyed to each of leg 1, leg 2, the rise (B's
//     outboard bevel ⇄ the foot corner's inboard one), the stub (the foot's
//     outboard ⇄ the cap corner's inboard), the cap arbor (the cap corner's
//     outboard ⇄ the cap) and the DROP (its inboard bevel ⇄ the keyless
//     minute arbor itself — closed by TODO 150 item 1, see below) have EQUAL
//     vectors, to 1e-6 of their size;
//   · CORNERS — each pair's surface velocities agree at the pitch point (the
//     unit bisector of the two gears' centres off the apex), which is rolling;
//   · CAP ⇄ MINUTE WHEEL — pitch-line speeds equal and opposite, the external
//     mesh the cap claims (and cap ⇄ cannon pinion co-rotate, both meshing it).
// CONTROLS / GUARDS: every member must MOVE (a still train agrees with
// anything); the cap ⇄ minute wheel check is the must-DIFFER half; the step is
// re-run from a second base pose so one lucky pose cannot pass it.
//
// TODO 150 item 1 CLOSED the one thing this probe used to only REPORT: the
// drop corner's inboard bevel used to be cut on the FAR side of its apex
// from the keyless minute arbor it is keyed to (mounted on Z_UP, pointing
// its axis AWAY from a shaft that ran below it), so no rigid spin could
// agree with both that arbor and the rods above it — it read equal and
// opposite, a sign and not a rate. Re-mounted on Z_UP negated (and re-bored
// to the arbor's own SETTING_ROD_R), the drop is now a fourth SHAFTS row,
// gated like the other three.
//
// GATED since TODO 151's (d) landing — PLANE: the cap meshes the motion
// works' minute wheel IN THE METAL, not only in tooth-count arithmetic. Until
// that landing the two stood 3.1 u apart along z and this row only printed
// the gap; now the cap stands on the wheel's own plane (off the base plate's
// face by one margin, down a fourth and fifth corner), and the row holds the
// wheel's whole world z-band INSIDE the cap's and the two axes at the mesh's
// centre distance, off the built meshes.
//
// GATED — TODO 151's (d) landing, FOLD CLEAR and CROSS-BODY: the members that
// landing added or moved (the tilted rise, the foot corner at E, the stub,
// the cap corner at D, the cap arbor and the cap, and the rise corner B whose
// outboard blank now keys to the tilted rise) against every mesh outside the
// fold, and every blank of one of the new corners against every blank of
// another, over ten poses that move the fold or its neighbours. Declared
// contacts are named, not skipped silently: the cap ⇄ minute wheel mesh, and
// the cap ⇄ base plate, which lands ON the margin by construction
// (Z_SETTING_CAP) and so is held to it within MEASURE_EPS.
//
// GATED — TODO 151, JUMPER: the minute jumper's station is solved at the end
// of the build on the real metal (main.js `JMP_SITE`), so this row is the gate
// that solve answers to — every jumper mesh against every mesh outside its
// unit, over the §152 digest poses plus the crown axis at twelfths (its own
// travel), the declared joints excused for their one part each (the beak in
// the star, the two posts in the base plate, the lifter's slot on the setting
// lever's post drop). A stretched mesh is passed to meshClearance SECOND:
// measured first, its distances read in its unscaled units (TODO 159).
//
// THE CRANK REVERSED WITH IT, AND THAT IS THE CAP'S NEW PLANE, NOT A SIGN
// SLIP: the cap has to stand ABOVE its last apex — an apex above the cap
// would sit inside the plate — so the fold's net sense (MW_FOLD_NET_SENSE) is
// +1 where it was −1, and the crown turns the other way to set the hands. The
// SHAFTS and CORNERS rows below are what say the fold is still one train.
//
// GATED — TODO 151 (MW_RISE_PLATE_HOLE): the motion-works corner blanks
// against the base plate, the same clearance A and K's holes already held —
// ten of them since the (d) landing added the foot and cap corners, plus the
// cap itself, which lands ON the margin by construction. The three recesses'
// LANDS (§62: the metal between two openings is a member) are reported.
// Only NON-schematic backPlate meshes count — the plate's schematic
// occluder children (§66/§71's silhouette convention) read as plate too and
// would report ~0 clearance for a hole that is really open.
//
// GATED — TODO 153: does each motion-works STACK member (the wheel, the
// cannon pinion, the minute pinion, the star, the hour wheel) actually
// stand clear of the plate the build CUTS, not just clear the corner
// blanks above? `meshClearance` alone can read a hairline positive
// somewhere on a part while its own top vertex runs past the plate's face
// — TODO 153 found exactly that for `mwMinuteWheel` and `cannonPinion`,
// both 0.0000 by clearance while 0.146/0.21 u buried. So the row is a
// CONJUNCTION: the measured clearance AND a z-band test (the member's own
// max world-vertex z must not exceed the plate's presented face minus the
// margin) — the z-band test is what catches containment a hairline-clear
// reading can hide. `makeGear`/`makePinion` name the GROUP, not their
// meshes, so each member is collected by walking that named object's
// subtree for non-schematic meshes. Studs are excluded — they are the
// riveted support edge, not a member standing clear of the plate.
//
// GATED — TODO 156, WALKS: the boot-time derivation that makes the four
// movement-wide walks (GONG_BAND_FLOOR, GONG_FOOT_OBSTACLES, the alarm
// corridor, the case walk) plus BACK_ENVELOPE PERMANENTLY indifferent to the
// jumper's reach, published at `__clock.jumperSite.walks`. Controlled first
// (its `reachR`/`zHi` bound must dominate this probe's own measured
// world-vertex reach over the jumper's travel — a bound that reads under a
// measurement is wrong, not conservative), then every row's margin must be
// positive and BACK_ENVELOPE must win zero bins.
//
// Run from tools/ with a Playwright Chromium: `node probe-150-fold-sense.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8501';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html?schematic=0`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
await page.waitForTimeout(1500);

const out = await page.evaluate(async ({ bases, tauBases }) => {
  const C = window.__clock;
  const THREE = await import('/vendor/three.module.js');
  window.requestAnimationFrame = () => 0;   // freeze the live loop under the poses
  const NAMES = ['minuteWheel', 'mwCornerDropIn', 'mwCornerDropOut', 'mwCornerFoldIn', 'mwCornerFoldOut',
    'mwCornerRiseIn', 'mwCornerRiseOut', 'mwCornerFootIn', 'mwCornerFootOut', 'mwCornerCapIn', 'mwCornerCapOut',
    'settingCap', 'mwMinuteWheel', 'cannonPinion'];
  const mesh = {};
  // a MESH by that name where the builder named its meshes, else the named
  // group (makeGear names the group and leaves its meshes anonymous) — either
  // is rigid with the part, which is all a spin reading needs
  C.scene.traverse((o) => { if (o.isMesh && NAMES.includes(o.name) && !mesh[o.name]) mesh[o.name] = o; });
  C.scene.traverse((o) => { if (NAMES.includes(o.name) && !mesh[o.name]) mesh[o.name] = o; });
  const missing = NAMES.filter((n) => !mesh[n]);
  if (missing.length) return { missing };
  const quats = () => Object.fromEntries(NAMES.map((n) => [n, mesh[n].getWorldQuaternion(new THREE.Quaternion())]));
  const centre = (n) => new THREE.Box3().setFromObject(mesh[n]).getCenter(new THREE.Vector3());
  // One step measurement, factored out so the setPathRot (handSet) sweep and
  // TODO 155's tau (going-train) sweep share it: the fold must turn as one
  // train under EITHER input now that the setting-train members are posed
  // from the wheel the cap meshes, not from handSetOffset alone.
  const measureStep = (poseA, poseB) => {
    C.resetInputs();
    C.setPose(poseA); const A = quats();
    const cen = Object.fromEntries(NAMES.map((n) => [n, centre(n)]));
    // the corner apex is the mount's origin: the gear's parent, in world
    const apex = Object.fromEntries(['mwCornerDrop', 'mwCornerFold', 'mwCornerRise', 'mwCornerFoot', 'mwCornerCap'].map((t) =>
      [t, mesh[t + 'In'].parent.getWorldPosition(new THREE.Vector3())]));
    const pivot = Object.fromEntries(NAMES.map((n) => [n, mesh[n].getWorldPosition(new THREE.Vector3())]));
    C.setPose(poseB); const B = quats();
    const w = {};
    for (const n of NAMES) {
      const d = B[n].clone().multiply(A[n].clone().invert());
      if (d.w < 0) { d.x = -d.x; d.y = -d.y; d.z = -d.z; d.w = -d.w; }
      const ang = 2 * Math.acos(Math.min(1, d.w));
      const s = Math.sqrt(Math.max(0, 1 - d.w * d.w));
      w[n] = s > 1e-12 ? new THREE.Vector3(d.x / s, d.y / s, d.z / s).multiplyScalar(ang) : new THREE.Vector3();
    }
    const roll = {};
    for (const t of Object.keys(apex)) {
      const P = cen[t + 'In'].clone().sub(apex[t]).normalize().add(cen[t + 'Out'].clone().sub(apex[t]).normalize()).normalize();
      roll[t] = { vIn: w[t + 'In'].clone().cross(P).toArray(), vOut: w[t + 'Out'].clone().cross(P).toArray() };
    }
    const mwR = pivot.settingCap.distanceTo(new THREE.Vector3(pivot.mwMinuteWheel.x, pivot.mwMinuteWheel.y, pivot.settingCap.z));
    return { w: Object.fromEntries(NAMES.map((n) => [n, w[n].toArray()])), roll, capToWheel: mwR };
  };
  const runs = [];
  for (const base of bases) {
    runs.push({ base, ...measureStep({ crownPullT: 0, setPathRot: base }, { crownPullT: 0, setPathRot: base + 0.01 }) });
  }
  // TODO 155 — the SAME train, walked by moving τ instead of setPathRot (crown
  // home throughout, so handSetOffset itself never changes): the setting
  // train is now posed FROM THE WHEEL THE CAP MESHES, so it must turn as one
  // rigid train under the going train's own input too, not only under
  // hand-set. tauBases are start points and each step is +60 s of τ — small
  // against the minute hand's own rate, so no member wraps between samples.
  const tauRuns = [];
  for (const T of tauBases) {
    tauRuns.push({ tau: T, ...measureStep({ crownPullT: 0, tau: T }, { crownPullT: 0, tau: T + 60 }) });
  }
  const I = await import('/src/inspect.js');
  const L = await import('/src/layout.js');
  const G = await import('/src/geometry.js');
  const CM = L.CLEAR_MARGIN;
  const unschem = (o) => { for (let q = o; q; q = q.parent) if (q.userData && q.userData.schematic) return false; return true; };
  // every non-schematic mesh of a named part — makeGear/makePinion name the
  // GROUP and leave their bodies anonymous, the fold's bevels name the mesh
  const collectFor = (n) => {
    let root = null;
    C.scene.traverse((o) => { if (!root && o.name === n) root = o; });
    const out = [];
    if (root) root.traverse((o) => { if (o.isMesh && unschem(o)) out.push(o); });
    return out;
  };
  const zBandVerts = (m) => {
    const pos = m.geometry.attributes.position;
    let lo = Infinity, hi = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.z < lo) lo = v.z;
      if (v.z > hi) hi = v.z;
    }
    return [lo, hi];
  };
  const zBandOf = (list) => list.reduce((b, m) => { const [lo, hi] = zBandVerts(m); return [Math.min(b[0], lo), Math.max(b[1], hi)]; }, [Infinity, -Infinity]);
  C.resetInputs(); C.setPose({}); C.scene.updateMatrixWorld(true);
  // TODO 151 — PLANE: vertex-precise world z-bands (Box3 inflates a rotated
  // mesh), and the two axes' distance against the mesh's pitch-circle sum.
  const capZ = zBandOf(collectFor('settingCap')), mwZ = zBandOf(collectFor('mwMinuteWheel'));
  const capAxis = mesh.settingCap.getWorldPosition(new THREE.Vector3());
  const mwAxis = mesh.mwMinuteWheel.getWorldPosition(new THREE.Vector3());
  const centreD = Math.hypot(capAxis.x - mwAxis.x, capAxis.y - mwAxis.y);
  const centreWant = L.MW_MODULE_1 * (L.SETTING_CAP_TEETH + L.MW_MINUTE_TEETH) / 2;
  // TODO 151 — PLATE: the ten motion-works corner blanks and the cap against
  // the base plate. `meshClearance` is inspect.js's own measure, the one the
  // battery gates; schematic occluders are pruned (they read as plate and
  // would report ~0 for a hole that is really open).
  const PLATE_NAMES = ['mwCornerDropIn', 'mwCornerDropOut', 'mwCornerFoldIn', 'mwCornerFoldOut', 'mwCornerRiseIn',
    'mwCornerRiseOut', 'mwCornerFootIn', 'mwCornerFootOut', 'mwCornerCapIn', 'mwCornerCapOut', 'settingCap'];
  const plateMeshes = [];
  C.scene.traverse((o) => { if (o.isMesh && o.name === 'backPlate' && unschem(o)) plateMeshes.push(o); });
  const plate = {};
  for (const n of PLATE_NAMES) {
    let min = Infinity;
    for (const m of collectFor(n)) for (const pm of plateMeshes) min = Math.min(min, I.meshClearance(m, pm));
    plate[n] = min;
  }
  // …and the LANDS the fold's three recesses leave (§62: the metal between two
  // openings is a member). Read off the plate's own authored shape — the
  // extrude keeps it — every other opening's outline sampled, against each
  // recess's circle. A REPORT; the shape is the builder's, so is the list.
  const lands = [];
  {
    const shape = plateMeshes.map((m) => m.geometry.parameters?.shapes).find(Boolean);
    const sh = Array.isArray(shape) ? shape[0] : shape;
    const F = C.settingFold;
    const circles = (sh?.holes || []).map((h) => {
      const c = h.curves?.[0];
      return c && c.isEllipseCurve ? { x: c.aX, y: c.aY, r: c.xRadius, h } : { h };
    });
    const nearOf = (pt) => circles.reduce((best, c) => (c.x === undefined ? best
      : (!best || Math.hypot(c.x - pt.x, c.y - pt.y) < Math.hypot(best.x - pt.x, best.y - pt.y) ? c : best)), null);
    for (const [name, pt] of [['A (drop)', F.A], ['K (fold)', F.K], ['B (rise)', F.B]]) {
      const me = nearOf(pt);
      if (!me) continue;
      let land = Infinity, other = null;
      for (const c of circles) {
        if (c === me) continue;
        for (const q of c.h.getPoints(96)) {
          const d = Math.hypot(q.x - me.x, q.y - me.y) - me.r;
          if (d < land) { land = d; other = c.x === undefined ? 'slot/sector' : `(${c.x.toFixed(2)}, ${c.y.toFixed(2)}) r ${c.r.toFixed(3)}`; }
        }
      }
      const outer = sh.getPoints(720).reduce((m, q) => Math.min(m, Math.hypot(q.x - me.x, q.y - me.y) - me.r), Infinity);
      lands.push({ name, r: me.r, land, other, outer });
    }
  }
  // TODO 151 — FOLD CLEAR and CROSS-BODY, over ten poses that move the fold
  // (the setting input, both ways, crown in and out) or its neighbours (the
  // going train through the motion works, the reserve train by the spring's
  // state, the keyless works by the pull).
  const POSES = [{}, { setPathRot: 0.37 }, { setPathRot: 1.9 }, { setPathRot: -2.6 }, { tau: 0.13 }, { tau: 0.61 },
    { crownPullT: 1 }, { crownPullT: 1, setPathRot: 1.1 }, { tension: 0.05 }, { tension: 1, windAccumTurns: 3 },
    // TODO 155 — the fold now turns with τ alone (crown home), so the net
    // f = 0.57 and f = 0.0417 poses (the train axis's own worst-reading
    // fractions, `mwCornerRiseOut ⇄ star` ≈0.1634) are walked here too.
    { tau: 0.57 * 120 / 7 * 3600 }, { tau: 0.0417 * 120 / 7 * 3600 }];
  const BODY = {
    mwCornerRiseIn: 'leg2', settingTraverse2: 'leg2', mwCornerFoldOut: 'leg2',
    mwCornerRiseOut: 'rise', settingRise: 'rise', mwCornerFootIn: 'rise',
    mwCornerFootOut: 'stub', settingStub: 'stub', mwCornerCapIn: 'stub',
    mwCornerCapOut: 'cap', settingCapArbor: 'cap', settingCap: 'cap',
  };
  const MOVED = ['mwCornerRiseIn', 'mwCornerRiseOut', 'settingRise', 'mwCornerFootIn', 'mwCornerFootOut', 'settingStub',
    'mwCornerCapIn', 'mwCornerCapOut', 'settingCapArbor', 'settingCap'];
  const CORNER = (n) => (n.match(/^mwCorner(Rise|Foot|Cap)(In|Out)$/) || [])[1];
  const FOLD = new Set(['settingDrop', 'mwCornerDropIn', 'mwCornerDropOut', 'settingTraverse1', 'mwCornerFoldIn',
    'mwCornerFoldOut', 'settingTraverse2', ...MOVED]);
  const labelOf = (o) => { for (let q = o; q; q = q.parent) if (q.name) return q.name; return '(unnamed)'; };
  const moved = MOVED.map((n) => [n, collectFor(n)]);
  const others = [];
  C.scene.traverse((o) => { if (o.isMesh && o.visible && unschem(o) && !FOLD.has(labelOf(o)) && o.geometry?.attributes?.position) others.push(o); });
  const DECLARED = { 'settingCap|mwMinuteWheel': 'the mesh itself' };
  const foldClear = {}, cross = {};
  const put = (m, k, d, pi) => { if (!m[k] || d < m[k].d) m[k] = { d, pose: pi }; };
  const box = (o) => new THREE.Box3().setFromObject(o);
  // TODO 162 — GATED: LEG 2 ⇄ RESERVE. `mwCornerFoldOut` is part of
  // `mwCornerFoldIn`'s rod (leg 2, with `settingTraverse1`/`settingTraverse2`
  // the rod itself and `mwCornerRiseIn` the far apex it shares with leg 2 —
  // one rigid body) and used to stand still outside the `handSet` axis; now
  // the fold turns with τ too (TODO 155), it sweeps volumes against the
  // reserve train it never used to reach. Not in `moved` (only the (d)
  // landing's own new/relocated members are) and not folded into FOLD
  // CLEAR's declared scope — TODO 162 found the pair cleared only
  // 0.0357–0.0552, under CLEAR_MARGIN, with no gate anywhere reading it
  // (`clearances`/`inspection` never see `Keyless works` ⇄ `Power-reserve
  // train` — TODO 162's second finding). Measured against every
  // non-schematic mesh of the WHOLE `Power-reserve train` unit (read off
  // `labelEntries`, not by part name — the first reading of this pair found
  // only rsvWheel1's direct children by name and missed the body that sets
  // the minimum), over FOLD CLEAR's own POSES plus every reserve/wind/
  // arrest/train/handSet axis at 24 samples each (the axes that move either
  // body and the ones TODO 162 measured the worst reading on).
  const LEG2_NAMES = ['mwCornerFoldIn', 'mwCornerFoldOut', 'settingTraverse1', 'settingTraverse2', 'mwCornerRiseIn'];
  const leg2Meshes = LEG2_NAMES.flatMap((n) => collectFor(n).map((m) => [n, m]));
  const rsvUnit = (C.labelEntries || []).find((e) => e.name === 'Power-reserve train');
  const rsvMeshes = [];
  if (rsvUnit) rsvUnit.obj.traverse((o) => { if (o.isMesh && unschem(o)) rsvMeshes.push(o); });
  const leg2AxisPoses = [];
  for (const axName of ['reserve', 'wind', 'arrest', 'train', 'handSet']) {
    const ax = I.AXES.find((a) => a.name === axName);
    if (!ax) continue;
    const n = 24;
    for (let i = 0; i < n; i++) leg2AxisPoses.push(ax.pose(i / (n - 1)));
  }
  const leg2Poses = [...POSES, ...leg2AxisPoses];
  let leg2Rsv = null;
  // the must-hit control: settingTraverse2's rod against reservePinion0's top
  // face is the DESIGNED tie (SETTING_ROD_R, solved from RSV_P0_TOP_Z) — an
  // exact 0.15 by construction, so this sweep must record it within
  // MEASURE_EPS or its own coverage is the thing in question, not the pair.
  let leg2Tie = null;
  for (let pi = 0; pi < leg2Poses.length; pi++) {
    C.resetInputs(); C.setPose({ crownPullT: 0, ...leg2Poses[pi] }); C.scene.updateMatrixWorld(true);
    for (const [ln, lm] of leg2Meshes) for (const rm of rsvMeshes) {
      const d = I.meshClearance(lm, rm);
      if (!leg2Rsv || d < leg2Rsv.d) leg2Rsv = { d, pose: pi, a: ln, b: labelOf(rm) };
      if (ln === 'settingTraverse2' && labelOf(rm) === 'reservePinion0' && (!leg2Tie || d < leg2Tie.d)) leg2Tie = { d, pose: pi };
    }
  }
  for (let pi = 0; pi < POSES.length; pi++) {
    C.resetInputs(); C.setPose({ crownPullT: 0, ...POSES[pi] }); C.scene.updateMatrixWorld(true);
    const ob = others.map(box);
    for (const [n, list] of moved) for (const m of list) {
      const mb = box(m).expandByScalar(1);
      for (let j = 0; j < others.length; j++) {
        if (!mb.intersectsBox(ob[j])) continue;
        const k = `${n}|${labelOf(others[j])}`;
        if (DECLARED[k]) continue;
        put(foldClear, k, I.meshClearance(m, others[j]), pi);
      }
    }
    // CROSS-BODY: every blank of one of the three corners against every blank
    // of another (whether or not a rod joins them — the solve's own rule), and
    // every member against every member of a different rigid body that is
    // not its neighbour at a shared apex.
    for (let i = 0; i < moved.length; i++) for (let j = i + 1; j < moved.length; j++) {
      const [a, la] = moved[i], [b, lb] = moved[j];
      const ca = CORNER(a), cb = CORNER(b);
      const blanks = ca && cb && ca !== cb;   // one rod's two blanks are kept too — held apart, not to the margin
      const rods = /^setting(Rise|Stub|CapArbor)$/;
      if (!blanks) {
        if (BODY[a] === BODY[b]) continue;                 // one rigid body: its keyed joints are the design
        if (ca && cb) continue;                            // one corner's two blanks MESH
        if (rods.test(a) && rods.test(b)) continue;        // two rods meet at their shared apex by construction
        if ((rods.test(a) && cb) || (rods.test(b) && ca)) {
          // a rod against the blank keyed to the rod it MEETS at that corner's apex is the corner itself
          const rod = rods.test(a) ? a : b, bl = rods.test(a) ? b : a;
          const at = { settingRise: ['Rise', 'Foot'], settingStub: ['Foot', 'Cap'], settingCapArbor: ['Cap'] }[rod];
          if (at.includes(CORNER(bl))) continue;
        }
      }
      let d = Infinity;
      for (const x of la) for (const y of lb) d = Math.min(d, I.meshClearance(x, y));
      put(cross, `${a}|${b}`, d, pi);
    }
  }
  C.resetInputs(); C.setPose({}); C.scene.updateMatrixWorld(true);
  // TODO 151 — JUMPER: the minute jumper against every mesh of every other
  // unit over the pose net (the §152 digest poses — every axis at 0, ½ and 1
  // plus the canonical states) and the crown axis at twelfths (the jumper's
  // own travel), schematic proxies pruned, the three declared joints excused
  // for the one part each belongs to: the beak's seat in the star, the two
  // posts riveted into the base plate, and the lifter's slot on the setting
  // lever's post drop. This is the gate the jumper's siting solve answers to:
  // the solve judged derived obstacles, revolved rotors and its own travel at
  // build; this holds the metal it cut, at the poses the battery sweeps.
  const jumper = [];
  let jUnit = null;
  C.scene.traverse((o) => { if (!jUnit && o.name === 'jumperLifter') jUnit = o.parent; });
  if (jUnit) jUnit.traverse((o) => { if (o.isMesh && unschem(o) && o.geometry?.attributes?.position) jumper.push(o); });
  const inJ = new Set(); if (jUnit) jUnit.traverse((o) => inJ.add(o));
  const jOthers = [];
  C.scene.traverse((o) => { if (o.isMesh && unschem(o) && !inJ.has(o) && o.geometry?.attributes?.position) jOthers.push(o); });   // visibility is a view setting, not a fact about the metal: collectUnits counts hidden meshes too
  const underName = (o, n) => { for (let q = o; q; q = q.parent) if (q.name === n) return true; return false; };
  const plateFaceZ = plateMeshes.reduce((z, pm) => Math.min(z, zBandVerts(pm)[0]), Infinity);
  const plateTop = (m) => { m.updateWorldMatrix(true, false); const [, hi] = zBandVerts(m); return hi >= plateFaceZ - 1e-6; };
  const excused = (j, o) => (j.name === 'jumperBeak' && underName(o, 'star'))
    || (j.name === 'jumperLifter' && o.name === 'settingLeverPostDrop')
    || (o.name === 'backPlate' && !j.name && plateTop(j));
  const _sv = new THREE.Vector3();
  const scaled = (m) => { m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), _sv); return Math.max(_sv.x, _sv.y, _sv.z) - Math.min(_sv.x, _sv.y, _sv.z) > 1e-6 * Math.max(_sv.x, _sv.y, _sv.z); };
  const jPoses = [...I.digestPoses(C)];
  for (let k = 0; k <= 12; k++) jPoses.push({ tau: 0.05, crownPullT: k / 12, leverEngage: k / 12, tension: 1 });
  const jumperRows = {}, jumperBoth = new Set();
  // TODO 156 — WALKS control: the jumper's own MEASURED world-vertex reach
  // (radius from the plate axis, and the z its metal actually stands at)
  // over these same poses, vertex-precise like zBandVerts — never a rotated
  // Box3, which inflates. This is what JMP_SITE's boot-time derivation
  // (`walks.reachR`/`walks.zHi`) must bound, not resemble: the derivation is
  // a closed-form BOUND over the whole travel, this is a direct measurement
  // at a finite pose sample, and a bound that reads under a measurement is
  // simply wrong.
  let measR = 0, measZ = -Infinity;
  const _mv = new THREE.Vector3();
  for (let pi = 0; pi < jPoses.length; pi++) {
    C.resetInputs(); C.setPose(jPoses[pi]); C.scene.updateMatrixWorld(true);
    const ob = jOthers.map(box);
    for (const j of jumper) {
      const pos = j.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        _mv.fromBufferAttribute(pos, i).applyMatrix4(j.matrixWorld);
        const r = Math.hypot(_mv.x, _mv.y);
        if (r > measR) measR = r;
        if (_mv.z > measZ) measZ = _mv.z;
      }
      const jb = box(j).expandByScalar(0.5);
      for (let k = 0; k < jOthers.length; k++) {
        if (!jb.intersectsBox(ob[k]) || excused(j, jOthers[k])) continue;
        // meshClearance measures in its FIRST mesh's local frame, so a first
        // mesh with a non-uniform scale reads distances in its unscaled units:
        // the lifter carries its span as scale.x (~36) and read a tab 3.4 u
        // away at 0.119. The scaled mesh goes second, where its triangles are
        // carried into the other's frame — exact under any affine map.
        const o = jOthers[k];
        if (scaled(j) && scaled(o)) jumperBoth.add(`${j.name} ⇄ ${labelOf(o)}`);
        put(jumperRows, `${j.name || j.geometry.type}|${labelOf(o)}`, scaled(j) ? I.meshClearance(o, j) : I.meshClearance(j, o), pi);
      }
    }
  }
  C.resetInputs(); C.setPose({}); C.scene.updateMatrixWorld(true);
  // TODO 153 — STACK: the motion-works members against the plate's own
  // presented face, vertex-precise (Box3.setFromObject inflates a rotated
  // mesh's AABB — §151's own correction). `makeGear`/`makePinion` name the
  // GROUP, not the meshes, so the named object is found first and its
  // subtree walked for non-schematic meshes.
  const MW_NAMES = ['mwMinuteWheel', 'cannonPinion', 'mwMinutePinion', 'star', 'mwHourWheel'];
  let faceZ = Infinity;
  for (const pm of plateMeshes) { const [lo] = zBandVerts(pm); faceZ = Math.min(faceZ, lo); }
  const mwStack = {};
  for (const n of MW_NAMES) {
    const meshes = collectFor(n);
    let clr = Infinity, zTop = -Infinity;
    for (const m of meshes) {
      for (const pm of plateMeshes) clr = Math.min(clr, I.meshClearance(m, pm));
      const [, hi] = zBandVerts(m);
      if (hi > zTop) zTop = hi;
    }
    mwStack[n] = { count: meshes.length, clr, zTop };
  }
  return { runs, tauRuns, capZ, mwZ, centreD, centreWant, plate, lands, foldClear, cross, poses: POSES.length,
    leg2Rsv, leg2Tie, leg2Poses: leg2Poses.length,
    jumperRows, jumperBoth: [...jumperBoth], jumperPoses: jPoses.length, jumperSite: C.jumperSite, jumperParts: jumper.length, plateMeshCount: plateMeshes.length, CLEAR_MARGIN: L.CLEAR_MARGIN, mwStack, faceZ,
    measR, measZ,
    capLeg: C.settingFold && C.settingFold.capLeg };
}, { bases: [0, 7.3], tauBases: [0, 20000] });

let bad = 0;
const fail = (s) => { bad++; console.log('  FAIL ' + s); };
const ok = (s) => console.log('  ok   ' + s);
if (out.missing) { fail(`no mesh named: ${out.missing.join(', ')}`); }
else {
  const V = (a) => ({ a, n: Math.hypot(...a) });
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const fmt = (a) => '[' + a.map((x) => (x >= 0 ? ' ' : '') + x.toFixed(6)).join(',') + ']';
  const MOVED = 1e-5, REL = 1e-6;
  const SHAFTS = [
    ['drop', 'minuteWheel', 'mwCornerDropIn'],
    ['leg 1', 'mwCornerDropOut', 'mwCornerFoldIn'],
    ['leg 2', 'mwCornerFoldOut', 'mwCornerRiseIn'],
    ['rise', 'mwCornerRiseOut', 'mwCornerFootIn'],
    ['stub', 'mwCornerFootOut', 'mwCornerCapIn'],
    ['cap arbor', 'mwCornerCapOut', 'settingCap'],
  ];
  // Factored so the setPathRot (handSet) sweep and TODO 155's τ (train) sweep
  // run the identical RODS/CORNERS/cap⇄wheel gates, must-move guard included.
  const checkRun = (run, label) => {
    console.log(`\n${label}:`);
    for (const [n, a] of Object.entries(run.w)) {
      const m = Math.hypot(...a);
      console.log(`    ${n.padEnd(16)} ω ${fmt(a)}   |ω| ${m.toFixed(6)}`);
      if (m < MOVED) fail(`${n} did not move — nothing about it can be judged`);
    }
    for (const [what, a, b] of SHAFTS) {
      const A = V(run.w[a]), B = V(run.w[b]);
      const d = Math.hypot(...sub(A.a, B.a));
      if (d > REL * Math.max(A.n, B.n)) fail(`${what}: ${a} ${fmt(A.a)} ≠ ${b} ${fmt(B.a)} — one rod, two spins`);
      else ok(`${what}: ${a} ⇄ ${b} one spin (|Δω| ${d.toExponential(2)})`);
    }
    for (const [t, r] of Object.entries(run.roll)) {
      const d = Math.hypot(...sub(r.vIn, r.vOut)), m = Math.max(Math.hypot(...r.vIn), Math.hypot(...r.vOut));
      if (m < MOVED || d > 1e-4 * m) fail(`${t}: pitch-point velocities ${fmt(r.vIn)} vs ${fmt(r.vOut)} — the pair slides`);
      else ok(`${t}: rolls (|Δv| ${d.toExponential(2)} of ${m.toExponential(2)})`);
    }
    // CAP ⇄ MINUTE WHEEL — parallel axes along world z: pitch-line speed ω·r
    // equal and OPPOSITE. The radii are the pitch radii the centre distance
    // splits in the tooth ratio (8 : 30 at module 0.3 → 1.2 + 4.5 = 5.7).
    const capW = run.w.settingCap[2], mwW = run.w.mwMinuteWheel[2], cpW = run.w.cannonPinion[2];
    const rCap = run.capToWheel * 8 / 38, rMw = run.capToWheel * 30 / 38;
    const slip = Math.abs(capW * rCap + mwW * rMw);
    if (!(Math.sign(capW) === -Math.sign(mwW))) fail(`cap ⇄ minute wheel co-rotate (${capW.toFixed(6)}, ${mwW.toFixed(6)}) — an external mesh counter-rotates`);
    else if (slip > 1e-4 * Math.abs(capW * rCap)) fail(`cap ⇄ minute wheel pitch-line slip ${slip.toExponential(3)} (cap ${(capW * rCap).toFixed(6)}, wheel ${(mwW * rMw).toFixed(6)})`);
    else ok(`cap ⇄ minute wheel mesh: pitch-line ${(capW * rCap).toFixed(6)} against ${(mwW * rMw).toFixed(6)} (centre distance ${run.capToWheel.toFixed(4)})`);
    if (Math.sign(capW) !== Math.sign(cpW)) fail(`cap ⇄ cannon pinion counter-rotate — both mesh the minute wheel, so they must turn together`);
    else ok(`cap ⇄ cannon pinion co-rotate (${capW.toFixed(6)}, ${cpW.toFixed(6)})`);
  };
  for (const run of out.runs) checkRun(run, `base pose setPathRot ${run.base}`);
  // TODO 155 — the same train, driven by τ alone (crown home): before this
  // item the setting fold stood still under `train` and this whole block
  // would have failed on the must-move guard alone. It moving, and moving as
  // ONE train, is the P0 claim the stateless law makes.
  for (const run of out.tauRuns) checkRun(run, `base pose tau ${run.tau} (TODO 155, train input)`);
  // TODO 151 — GATED: the six motion-works corner blanks against the base
  // plate (non-schematic meshes only), held to CLEAR_MARGIN — MW_RISE_PLATE_HOLE's
  // own acceptance, on the same instrument (inspect.js's meshClearance) the
  // battery's clearances check runs.
  // cannonPinion's own solve lands its metal ON CLEAR_MARGIN by design, and
  // so does the setting cap since TODO 151 (Z_SETTING_CAP: its top face one
  // margin off the plate's presented face). A BVH-measured clearance of a
  // member solved to an exact algebraic tie is float noise around that tie,
  // not a real miss — MEASURE_EPS is that noise's scale (measured here at
  // 6.7e-8), not a margin being widened.
  const MEASURE_EPS = 1e-6;
  console.log(`\nPLATE — corner blanks and the cap ⇄ backPlate (${out.plateMeshCount} plate mesh(es), CLEAR_MARGIN ${out.CLEAR_MARGIN}):`);
  for (const [n, c] of Object.entries(out.plate)) {
    if (c < out.CLEAR_MARGIN - MEASURE_EPS) fail(`${n} ⇄ backPlate clears ${c.toFixed(4)} — under CLEAR_MARGIN ${out.CLEAR_MARGIN}`);
    else ok(`${n} ⇄ backPlate clears ${c.toFixed(4)}`);
  }
  console.log('  REPORT the fold\'s recess lands (§62 — the metal between two openings is a member):');
  for (const l of out.lands)
    console.log(`    ${l.name.padEnd(9)} r ${l.r.toFixed(4)}: nearest opening ${l.land.toFixed(4)} away (${l.other}), plate edge ${l.outer.toFixed(4)}`);
  // TODO 151 — PLANE: the cap meshes the wheel in the metal
  console.log(`\nPLANE — TODO 151: the setting cap on the motion works' minute wheel's plane:`);
  if (!(out.capZ[0] <= out.mwZ[0] && out.mwZ[1] <= out.capZ[1]))
    fail(`mwMinuteWheel z [${out.mwZ[0].toFixed(3)}, ${out.mwZ[1].toFixed(3)}] is not inside settingCap z [${out.capZ[0].toFixed(3)}, ${out.capZ[1].toFixed(3)}]`);
  else ok(`mwMinuteWheel z [${out.mwZ[0].toFixed(3)}, ${out.mwZ[1].toFixed(3)}] inside settingCap z [${out.capZ[0].toFixed(3)}, ${out.capZ[1].toFixed(3)}]`);
  if (Math.abs(out.centreD - out.centreWant) > 1e-6) fail(`cap ⇄ minute wheel axes ${out.centreD.toFixed(6)} apart, the mesh wants ${out.centreWant.toFixed(6)}`);
  else ok(`cap ⇄ minute wheel axes ${out.centreD.toFixed(6)} apart — the pitch-circle sum ${out.centreWant.toFixed(6)}`);
  if (out.capLeg) console.log(`  REPORT the cap leg as solved: φ ${out.capLeg.phiDeg.toFixed(4)}°, stub ${out.capLeg.stub.toFixed(4)}, chord ${out.capLeg.chord.toFixed(4)}, `
    + `Σ_B ${out.capLeg.sigmaBDeg.toFixed(3)}°, Σ_E ${out.capLeg.sigmaEDeg.toFixed(3)}° (probe-151-cap-plane.mjs §8 verifies them)`);
  const sorted = (m) => Object.entries(m).sort((a, b) => a[1].d - b[1].d);
  console.log(`\nFOLD CLEAR — TODO 151: the members the (d) landing added or moved ⇄ every mesh outside the fold, over ${out.poses} poses:`);
  for (const [k, r] of sorted(out.foldClear)) {
    const [a, b] = k.split('|');
    if (b === 'backPlate' && a === 'settingCap' ? r.d < out.CLEAR_MARGIN - MEASURE_EPS : r.d < out.CLEAR_MARGIN) fail(`${a} ⇄ ${b} clears ${r.d.toFixed(4)} (pose ${r.pose}) — under CLEAR_MARGIN`);
    else if (r.d < 0.4) ok(`${a} ⇄ ${b} clears ${r.d.toFixed(4)} (pose ${r.pose})`);
  }
  console.log('  (pairs clearing 0.4 or more not listed; settingCap ⇄ mwMinuteWheel is the declared mesh and is not measured here)');
  // TODO 162 — GATED: LEG 2 ⇄ RESERVE. Before this landing nothing read this
  // pair (0.0552 on main, 0.0357 at its worst here — see the item). The
  // must-hit control comes first: if the designed tie (settingTraverse2 ⇄
  // reservePinion0, exactly CLEAR_MARGIN by construction — SETTING_ROD_R,
  // solved from RSV_P0_TOP_Z) is not recorded within MEASURE_EPS, this
  // sweep's own coverage is broken and the main row below cannot be trusted.
  console.log(`\nLEG 2 ⇄ RESERVE — TODO 162: leg 2's rod and both its bevel corners ⇄ every mesh of Power-reserve train, over ${out.leg2Poses} poses:`);
  if (!out.leg2Tie || Math.abs(out.leg2Tie.d - out.CLEAR_MARGIN) > 1e-6)
    fail(`control: settingTraverse2 ⇄ reservePinion0 tie not recorded within 1e-6 of CLEAR_MARGIN ${out.CLEAR_MARGIN} — ${out.leg2Tie ? `read ${out.leg2Tie.d.toFixed(7)} (pose ${out.leg2Tie.pose})` : 'never measured'}`);
  else ok(`control: settingTraverse2 ⇄ reservePinion0 tie ${out.leg2Tie.d.toFixed(7)} — the designed SETTING_ROD_R tie, within 1e-6 of CLEAR_MARGIN`);
  if (!out.leg2Rsv) fail('LEG 2 ⇄ RESERVE: no mesh pair found to measure');
  else if (out.leg2Rsv.d < out.CLEAR_MARGIN - MEASURE_EPS)
    fail(`${out.leg2Rsv.a} ⇄ ${out.leg2Rsv.b} clears ${out.leg2Rsv.d.toFixed(4)} (pose ${out.leg2Rsv.pose}) — under CLEAR_MARGIN ${out.CLEAR_MARGIN}`);
  else ok(`${out.leg2Rsv.a} ⇄ ${out.leg2Rsv.b} clears ${out.leg2Rsv.d.toFixed(4)} (pose ${out.leg2Rsv.pose})`);
  console.log(`\nCROSS-BODY — TODO 151: every blank of one new corner ⇄ every blank of another, and each member ⇄ the other rigid bodies:`);
  // two blanks keyed to ONE rod turn as one rigid body (§107: one connected
  // part), so between them the rule is that they do not run into each other,
  // not the working margin — the cap leg's solve holds them the same way
  const ONE_ROD = new Set(['mwCornerRiseOut|mwCornerFootIn', 'mwCornerFootOut|mwCornerCapIn']);
  for (const [k, r] of sorted(out.cross)) {
    const [a, b] = k.split('|');
    const need = ONE_ROD.has(k) ? 0 : out.CLEAR_MARGIN;
    if (!(r.d > need || (need > 0 && r.d >= need))) fail(`${a} ⇄ ${b} clears ${r.d.toFixed(4)} (pose ${r.pose}) — under ${need ? 'CLEAR_MARGIN' : 'zero: one rod\'s blanks run into each other'}`);
    else ok(`${a} ⇄ ${b} clears ${r.d.toFixed(4)} (pose ${r.pose})${need ? '' : '  (one rod: held apart)'}`);
  }
  // TODO 153 — GATED: the motion-works stack members against the plate's own
  // presented face (out.faceZ), on BOTH measures — clearance and z-band
  // containment (see the header note above for why both).
  const js = out.jumperSite;
  console.log(`\nJUMPER — TODO 151: the minute jumper (${out.jumperParts} meshes) ⇄ every non-contact unit, over ${out.jumperPoses} poses:`);
  if (js) console.log(`  REPORT the siting solve: ${js.azDeg.toFixed(2)}° (tripwire ${js.measuredDeg}°), certified clearance ${js.clr === null ? 'none' : js.clr.toFixed(4)}, `
    + `capD ${js.capD === null ? '-' : js.capD.toFixed(3)}, ${js.tested} of ${js.candidates} stations tested at ${js.stepDeg}°, ${js.ms.toFixed(0)} ms `
    + `(${js.staticMeshes} static meshes, ${js.rotors} rotors revolved, ${js.coaxialRotors} on the jumper's own stud)`);
  if (!out.jumperParts) fail('no jumper meshes found (jumperLifter\'s unit)');
  for (const p of out.jumperBoth) fail(`${p}: both meshes non-uniformly scaled — meshClearance cannot measure the pair`);
  if (!js || js.clr === null) fail('the siting solve settled on no station that clears by the margin');
  for (const [k, r] of sorted(out.jumperRows)) {
    const [a, b] = k.split('|');
    if (r.d < out.CLEAR_MARGIN - MEASURE_EPS) fail(`${a} ⇄ ${b} clears ${r.d.toFixed(4)} (pose ${r.pose}) — under CLEAR_MARGIN`);
    else if (r.d < 0.4) ok(`${a} ⇄ ${b} clears ${r.d.toFixed(4)} (pose ${r.pose})`);
  }
  console.log('  (pairs clearing 0.4 or more not listed)');
  // TODO 156 — WALKS: the boot-time derivation (JMP_SITE's `walks`, published
  // at __clock.jumperSite.walks) that makes the movement-wide walks'
  // indifference to the jumper PERMANENT rather than a fact only true of
  // today's build. Control first (the bound must dominate a real
  // measurement), then every row's margin must be positive.
  console.log(`\nWALKS — TODO 156: the jumper's reach vs the four movement-wide walks (GONG_BAND_FLOOR, `
    + 'GONG_FOOT_OBSTACLES, the alarm corridor, the case walk) plus BACK_ENVELOPE:');
  const jw = js && js.walks;
  if (!jw) fail('no jumperSite.walks published — TODO 156\'s derivation did not run');
  else {
    if (!(jw.reachR >= out.measR - MEASURE_EPS))
      fail(`walks.reachR ${jw.reachR.toFixed(4)} is under the measured world-vertex reach ${out.measR.toFixed(4)} — the bound does not bound`);
    else ok(`control: reachR ${jw.reachR.toFixed(4)} ≥ measured r ${out.measR.toFixed(4)}`);
    if (!(jw.zHi >= out.measZ - MEASURE_EPS))
      fail(`walks.zHi ${jw.zHi.toFixed(4)} is under the measured world-vertex z ${out.measZ.toFixed(4)} — the bound does not bound`);
    else ok(`control: zHi ${jw.zHi.toFixed(4)} ≥ measured z ${out.measZ.toFixed(4)}`);
    for (const r of jw.rows) {
      if (!(r.margin > 0)) fail(`${r.walk}: margin ${r.margin.toFixed(4)} (limit ${Number.isFinite(r.limit) ? r.limit.toFixed(4) : r.limit}) — not indifferent to the jumper`);
      else ok(`${r.walk}: margin ${r.margin.toFixed(4)}`);
      if (r.walk === 'BACK_ENVELOPE' && r.jumperBins !== 0)
        fail(`BACK_ENVELOPE: ${r.jumperBins} bin(s) inside the jumper's own reach are governed by 'Minute jumper'`);
    }
  }
  console.log(`\nSTACK — TODO 153: motion-works members ⇄ the plate's presented face `
    + `(${out.faceZ.toFixed(3)}), CLEAR_MARGIN ${out.CLEAR_MARGIN}:`);
  for (const [n, r] of Object.entries(out.mwStack)) {
    if (r.count === 0) { fail(`${n}: no non-schematic mesh found`); continue; }
    const clrOk = r.clr >= out.CLEAR_MARGIN - MEASURE_EPS;
    const bandOk = r.zTop <= out.faceZ - out.CLEAR_MARGIN + 1e-4;
    if (!clrOk || !bandOk)
      fail(`${n}: clr ${r.clr.toFixed(4)} (need ≥ ${out.CLEAR_MARGIN}), zTop ${r.zTop.toFixed(3)} `
        + `(need ≤ ${(out.faceZ - out.CLEAR_MARGIN).toFixed(3)})`);
    else ok(`${n}: clr ${r.clr.toFixed(4)}, zTop ${r.zTop.toFixed(3)}`);
  }
}
console.log(bad ? `\nFAIL — ${bad} finding(s)` : '\nPASS — the setting fold turns as one train, and meshes the minute wheel in the metal');
await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
