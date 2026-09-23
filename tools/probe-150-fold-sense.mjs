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
//   · RODS — the two members keyed to each of leg 1, leg 2, the rise (its
//     outboard bevel ⇄ the cap) and the DROP (its inboard bevel ⇄ the keyless
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
// STILL REPORTED, NOT GATED — TODO 151: the cap does not mesh the motion
// works' minute wheel IN THE METAL, only in tooth-count arithmetic; the two
// stand 3.1 u apart along z. The row below prints that gap directly, off the
// built meshes' own world z-bands, so a future fix that closes it is visible
// here without anyone re-deriving the number.
//
// GATED — TODO 151 (MW_RISE_PLATE_HOLE): the six motion-works corner blanks
// against the base plate, the same clearance A and K's holes already held.
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

const out = await page.evaluate(async (bases) => {
  const C = window.__clock;
  const THREE = await import('/vendor/three.module.js');
  window.requestAnimationFrame = () => 0;   // freeze the live loop under the poses
  const NAMES = ['minuteWheel', 'mwCornerDropIn', 'mwCornerDropOut', 'mwCornerFoldIn', 'mwCornerFoldOut',
    'mwCornerRiseIn', 'mwCornerRiseOut', 'settingCap', 'mwMinuteWheel', 'cannonPinion'];
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
  const runs = [];
  for (const base of bases) {
    C.resetInputs();
    C.setPose({ crownPullT: 0, setPathRot: base }); const A = quats();
    const cen = Object.fromEntries(NAMES.map((n) => [n, centre(n)]));
    // the corner apex is the mount's origin: the gear's parent, in world
    const apex = Object.fromEntries(['mwCornerDrop', 'mwCornerFold', 'mwCornerRise'].map((t) =>
      [t, mesh[t + 'In'].parent.getWorldPosition(new THREE.Vector3())]));
    const pivot = Object.fromEntries(NAMES.map((n) => [n, mesh[n].getWorldPosition(new THREE.Vector3())]));
    C.setPose({ crownPullT: 0, setPathRot: base + 0.01 }); const B = quats();
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
    runs.push({ base, w: Object.fromEntries(NAMES.map((n) => [n, w[n].toArray()])), roll, capToWheel: mwR });
  }
  // TODO 151 — the cap's and the motion works' minute wheel's world z-BANDS,
  // off the built meshes directly (not a re-derivation): negative overlap is
  // the axial gap that makes the cap's claimed mesh false in the metal.
  const zBand = (n) => { const b = new THREE.Box3().setFromObject(mesh[n]); return [b.min.z, b.max.z]; };
  const capZ = zBand('settingCap'), mwZ = zBand('mwMinuteWheel');
  const overlap = Math.min(capZ[1], mwZ[1]) - Math.max(capZ[0], mwZ[0]);
  // TODO 151 — PLATE: the six motion-works corner blanks against the base
  // plate. `meshClearance` is inspect.js's own measure, so this is the same
  // instrument the battery gates rather than a re-derivation; schematic
  // occluder children are pruned first (they read as plate and would report
  // ~0 for a hole that is really open — CLAUDE.md's schematic-mode rule).
  const I = await import('/src/inspect.js');
  const L = await import('/src/layout.js');
  const PLATE_NAMES = ['mwCornerDropIn', 'mwCornerDropOut', 'mwCornerFoldIn', 'mwCornerFoldOut', 'mwCornerRiseIn', 'mwCornerRiseOut'];
  const plateMeshes = [];
  C.scene.traverse((o) => { if (o.isMesh && o.name === 'backPlate' && !(o.userData && o.userData.schematic)) plateMeshes.push(o); });
  const plate = {};
  for (const n of PLATE_NAMES) {
    let min = Infinity;
    for (const pm of plateMeshes) min = Math.min(min, I.meshClearance(mesh[n], pm));
    plate[n] = min;
  }
  // TODO 153 — STACK: the motion-works members against the plate's own
  // presented face, vertex-precise (Box3.setFromObject inflates a rotated
  // mesh's AABB — §151's own correction). `makeGear`/`makePinion` name the
  // GROUP, not the meshes, so the named object is found first and its
  // subtree walked for non-schematic meshes.
  const MW_NAMES = ['mwMinuteWheel', 'cannonPinion', 'mwMinutePinion', 'star', 'mwHourWheel'];
  const collectFor = (n) => {
    let root = null;
    C.scene.traverse((o) => { if (!root && o.name === n) root = o; });
    const out = [];
    if (root) {
      if (root.isMesh && !(root.userData && root.userData.schematic)) out.push(root);
      root.traverse((o) => { if (o.isMesh && o !== root && !(o.userData && o.userData.schematic)) out.push(o); });
    }
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
  return { runs, capZ, mwZ, overlap, plate, plateMeshCount: plateMeshes.length, CLEAR_MARGIN: L.CLEAR_MARGIN, mwStack, faceZ };
}, [0, 7.3]);

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
    ['rise', 'mwCornerRiseOut', 'settingCap'],
  ];
  for (const run of out.runs) {
    console.log(`\nbase pose setPathRot ${run.base}:`);
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
  }
  // TODO 151 — GATED: the six motion-works corner blanks against the base
  // plate (non-schematic meshes only), held to CLEAR_MARGIN — MW_RISE_PLATE_HOLE's
  // own acceptance, on the same instrument (inspect.js's meshClearance) the
  // battery's clearances check runs.
  console.log(`\nPLATE — corner blanks ⇄ backPlate (${out.plateMeshCount} plate mesh(es), CLEAR_MARGIN ${out.CLEAR_MARGIN}):`);
  for (const [n, c] of Object.entries(out.plate)) {
    if (c < out.CLEAR_MARGIN) fail(`${n} ⇄ backPlate clears ${c.toFixed(4)} — under CLEAR_MARGIN ${out.CLEAR_MARGIN}`);
    else ok(`${n} ⇄ backPlate clears ${c.toFixed(4)}`);
  }
  // TODO 153 — GATED: the motion-works stack members against the plate's own
  // presented face (out.faceZ), on BOTH measures — clearance and z-band
  // containment (see the header note above for why both).
  console.log(`\nSTACK — TODO 153: motion-works members ⇄ the plate's presented face `
    + `(${out.faceZ.toFixed(3)}), CLEAR_MARGIN ${out.CLEAR_MARGIN}:`);
  // cannonPinion's own solve lands its metal ON CLEAR_MARGIN by design (the
  // main.js T solve's own comment: "landing ON the margin" — unlike MW_Z2,
  // which rides ALARM_SEAT_SINK off the margin on purpose so no sweep meets
  // an exact tie). A BVH-measured clearance of a member solved to an exact
  // algebraic tie is float noise around that tie, not a real miss — MEASURE_EPS
  // is that noise's scale (measured here at 6.7e-8), not a margin being widened.
  const MEASURE_EPS = 1e-6;
  for (const [n, r] of Object.entries(out.mwStack)) {
    if (r.count === 0) { fail(`${n}: no non-schematic mesh found`); continue; }
    const clrOk = r.clr >= out.CLEAR_MARGIN - MEASURE_EPS;
    const bandOk = r.zTop <= out.faceZ - out.CLEAR_MARGIN + 1e-4;
    if (!clrOk || !bandOk)
      fail(`${n}: clr ${r.clr.toFixed(4)} (need ≥ ${out.CLEAR_MARGIN}), zTop ${r.zTop.toFixed(3)} `
        + `(need ≤ ${(out.faceZ - out.CLEAR_MARGIN).toFixed(3)})`);
    else ok(`${n}: clr ${r.clr.toFixed(4)}, zTop ${r.zTop.toFixed(3)}`);
  }
  // TODO 151 — REPORTED, not gated: the cap's and the motion works' minute
  // wheel's world z-bands, read off the built meshes. A positive number
  // would mean the bands overlap; negative is the axial GAP.
  console.log(`\n  REPORT settingCap z [${out.capZ[0].toFixed(3)}, ${out.capZ[1].toFixed(3)}] vs mwMinuteWheel z `
    + `[${out.mwZ[0].toFixed(3)}, ${out.mwZ[1].toFixed(3)}] — band overlap ${out.overlap.toFixed(3)} `
    + `(TODO 151: the cap meshes this wheel by tooth count only, not in the metal, until this closes)`);
}
console.log(bad ? `\nFAIL — ${bad} finding(s)` : '\nPASS — the setting fold turns as one train (TODO 151 residue reported above)');
await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
