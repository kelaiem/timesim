// TODO 151 — CAN THE SETTING CAP REACH THE MINUTE WHEEL'S PLANE IN POSITION
// SPACE?
//
// The setting cap (`settingCap`) meshes the motion works' minute wheel
// (`mwMinuteWheel`) by TOOTH-COUNT arithmetic only — the two stand 2.914 u
// apart along z in the metal, gearToothSpec's `mates` claim with nothing cut
// to make it true (TODO 150 items 2/4, split out as this item). This probe
// asks, by MUTATING the built geometry and measuring, whether the cap can be
// moved into the wheel's plane at all with the fold's current topology and
// station — every option the roadmap tried, each one a real measurement
// against the built metal rather than an estimate.
//
// This is a REPORT, not a gate: nothing here is a design decision, only a
// measurement the layout landing (TODO 151's own fix path, item (d)) needs
// before it starts. Every mutation is followed by an exact restore, and
// `scene.updateMatrixWorld(true)` runs after each one so descendants read
// the moved transform (mutating in place does not walk UP — see CLAUDE.md's
// `updateMatrixWorld` trap; every object mutated here is moved directly, not
// read through an unmoved ancestor).
//
// WHAT IT MEASURES, per section below:
//   1. Vertex-precise world z-bands (not Box3, which inflates a rotated
//      mesh — TODO 151's own "-0.912" turned out to be the Box3 answer, the
//      real vertex top is -1.308) of the cap, the wheel, the rise corner's
//      two blanks and the minute star, plus the rise apex B's world position.
//   2. Option (a) — cap alone raised to a mid-plane of -2.64 (the wheel's
//      own mid-plane), apex left where it is: clearance to every
//      non-schematic mesh within 0.6 u.
//   3. Option (b) — the rise corner's OUTBOARD mount (the group that carries
//      `mwCornerRiseOut`, on the cap's own rod) re-quaternioned to identity
//      (its axis flipped onto +Z): the blank's resulting z-band against the
//      base plate's own slab, read off its non-schematic mesh vertices.
//   4. A 1-D bisection: cap and corner apex sit on the SAME vertical axis
//      (same x, y — only z differs), so the minimum axial gap between them
//      for the cap to clear the corner by CLEAR_MARGIN is a pure function of
//      their shapes, independent of where on the axis the pair sits. Found
//      by bisecting the cap's position along that axis with the corner held
//      fixed. Applied to the three cap mid-planes that would cover the
//      wheel's own face, c ∈ {-2.266, -2.64, -3.014}, it gives the apex each
//      would force.
//   5. Option (c) — what SETTING_ROD_R would have to become if Z_SETTING
//      moved to close the gap (SETTING_ROD_R = (Z_SETTING - RSV_P0_TOP_Z) -
//      CLEAR_MARGIN; RSV_P0_TOP_Z measured live off `reservePinion0`, never
//      re-typed from the source comment).
//   6. Option (d)'s siting question: the rise corner's blanks translated
//      (apex alone; cap left in place) to each of the three implied apexes
//      from §4, clearance to every non-schematic, non-fold mesh.
//   7. A raycast of the base plate's presented face at the minute wheel's
//      own axis, plus mwMinuteWheel and cannonPinion's own clearances
//      against the (non-schematic) plate.
//
// Run from tools/ with a Playwright Chromium: `node probe-151-cap-plane.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8503';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html?schematic=0`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
await page.waitForTimeout(1500);

const out = await page.evaluate(async () => {
  const C = window.__clock;
  const THREE = await import('/vendor/three.module.js');
  const I = await import('/src/inspect.js');
  const L = await import('/src/layout.js');
  window.requestAnimationFrame = () => 0;
  C.resetInputs();
  C.setPose({});
  C.scene.updateMatrixWorld(true);

  const CLEAR_MARGIN = L.CLEAR_MARGIN;

  // The FOLD ASSEMBLY — every member of the cap's own rod, from the keyless
  // minute arbor's shaft to the cap itself. Excluded from "non-fold
  // neighbour" sweeps: comparing a rigid rod's own members against each
  // other at an EXPERIMENTAL position says nothing about whether the fold
  // fits the movement.
  const FOLD_NAMES = ['settingDrop', 'mwCornerDropIn', 'mwCornerDropOut', 'settingTraverse1',
    'mwCornerFoldIn', 'mwCornerFoldOut', 'settingTraverse2', 'mwCornerRiseIn', 'mwCornerRiseOut',
    'settingCap', 'settingRise'];

  const NAMES = ['settingCap', 'mwMinuteWheel', 'mwCornerRiseIn', 'mwCornerRiseOut', 'star',
    'cannonPinion', 'reservePinion0', 'reservePinion1'];
  const allMeshes = [];
  const namedGroups = {};
  C.scene.traverse((o) => {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh) allMeshes.push(o);
    if (NAMES.includes(o.name) && !namedGroups[o.name]) namedGroups[o.name] = o;
  });
  // a NAMED MESH where the builder named its own meshes (settingCap, the
  // mwCorner* bevels, star), else the first mesh descendant of the named
  // GROUP (makePinion/makeGear name the group and leave its bodies anonymous
  // — reservePinion0/1, cannonPinion, mwMinuteWheel) — either is rigid with
  // the part, which is enough for a position reading or a clearance call.
  // `meshesOf` is the FULL set (`makeGear`'s hub is a second, unnamed mesh —
  // missing it under-reports a wheel's own z-band, which is the trap this
  // probe's own header warns about for Box3; the fix is the same one, read
  // every mesh the part actually has).
  const mesh = {}, meshesOf = {};
  for (const n of NAMES) {
    const g = namedGroups[n];
    if (!g) continue;
    if (g.isMesh) { mesh[n] = g; meshesOf[n] = [g]; continue; }
    const list = [];
    g.traverse((o) => { if (o.isMesh) list.push(o); });
    meshesOf[n] = list;
    mesh[n] = list[0];
  }
  const missing = NAMES.filter((n) => !mesh[n]);
  if (missing.length) return { missing };
  const plateMeshes = allMeshes.filter((o) => o.name === 'backPlate');

  // vertex-precise world z-band — CLAUDE.md's rule: Box3.setFromObject
  // inflates a rotated mesh's AABB past its true extent.
  const V = new THREE.Vector3();
  const zBand = (o) => {
    const pos = o.geometry.attributes.position;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      V.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      o.localToWorld(V);
      lo = Math.min(lo, V.z); hi = Math.max(hi, V.z);
    }
    return [lo, hi];
  };
  const zBandAll = (list) => {
    let lo = Infinity, hi = -Infinity;
    for (const o of list) { const b = zBand(o); lo = Math.min(lo, b[0]); hi = Math.max(hi, b[1]); }
    return [lo, hi];
  };
  const minClearMulti = (listA, listB) => {
    let m = Infinity;
    for (const a of listA) for (const b of listB) m = Math.min(m, I.meshClearance(a, b));
    return m;
  };
  // walk up from a leaf mesh to the ancestor whose OWN parent is `refParent`
  // — the station-level object (a mount group, or the top of a same-named
  // chain like settingCap's), the thing that actually needs moving.
  const stationOf = (leaf, refParent) => { let o = leaf; while (o.parent && o.parent !== refParent) o = o.parent; return o; };
  const capStation = (() => { let o = mesh.settingCap; while (o.parent && o.parent.name === o.name) o = o.parent; return o; })();
  const refParent = capStation.parent; // `keyless` — both the cap and the rise corner's two mounts hang directly off it
  const mountIn = stationOf(mesh.mwCornerRiseIn, refParent);
  const mountOut = stationOf(mesh.mwCornerRiseOut, refParent);

  // most builders name only the GROUP (makeGear/makePinion leave the body
  // and hub meshes anonymous — see meshesOf above); label a candidate by
  // its nearest named ANCESTOR so a report row reads `reservePinion1`
  // rather than the empty string its own mesh carries.
  const labelOf = (o) => { let p = o; while (p && !p.name) p = p.parent; return p ? p.name : '(unnamed)'; };
  const minClearTo = (targetMesh, excludeNames, within = Infinity) => {
    const rows = [];
    for (const o of allMeshes) {
      const label = labelOf(o);
      if (o === targetMesh || excludeNames.includes(label)) continue;
      const c = I.meshClearance(targetMesh, o, within === Infinity ? Infinity : within + 0.5);
      if (c <= within) rows.push([label, c]);
    }
    rows.sort((a, b) => a[1] - b[1]);
    return rows;
  };

  // §1 — the bands and the apex, as built.
  const bands = {
    settingCap: zBandAll(meshesOf.settingCap),
    mwMinuteWheel: zBandAll(meshesOf.mwMinuteWheel),
    mwCornerRiseIn: zBandAll(meshesOf.mwCornerRiseIn),
    mwCornerRiseOut: zBandAll(meshesOf.mwCornerRiseOut),
    star: zBandAll(meshesOf.star),
  };
  const apexB = mountIn.getWorldPosition(new THREE.Vector3()).toArray();

  // §2 — option (a): cap alone at mid-plane -2.64, apex left at B.
  const capZ0 = capStation.position.z;
  const capMid0 = (bands.settingCap[0] + bands.settingCap[1]) / 2;
  const setCapMid = (mid) => { capStation.position.z = capZ0 + (mid - capMid0); C.scene.updateMatrixWorld(true); };
  setCapMid(-2.64);
  const optionA = minClearTo(mesh.settingCap, ['settingCap'], 0.6);
  setCapMid(capMid0); // restore

  // §3 — option (b): the outboard mount's quaternion set to identity (axis
  // flipped onto +Z) — measure the blank's own z-band against the plate's.
  const outQ0 = mountOut.quaternion.clone();
  mountOut.quaternion.identity();
  C.scene.updateMatrixWorld(true);
  const riseOutFlippedBand = zBand(mesh.mwCornerRiseOut);
  mountOut.quaternion.copy(outQ0);
  C.scene.updateMatrixWorld(true);
  let plateSlab = [Infinity, -Infinity];
  for (const pm of plateMeshes) { const b = zBand(pm); plateSlab[0] = Math.min(plateSlab[0], b[0]); plateSlab[1] = Math.max(plateSlab[1], b[1]); }

  // §4 — bisect the minimum axial gap (cap mid-plane above apex) that clears
  // CLEAR_MARGIN. Cap and apex share (x, y); only z differs, so this is 1-D.
  const apexZ0 = mountIn.position.z;
  const gapClearance = (gap) => {
    setCapMid(apexZ0 + gap);
    const c1 = I.meshClearance(mesh.settingCap, mesh.mwCornerRiseIn);
    const c2 = I.meshClearance(mesh.settingCap, mesh.mwCornerRiseOut);
    return Math.min(c1, c2);
  };
  let lo = 0, hi = 8;
  // hi must clear; lo must not (or the corner and cap were never in contact at all)
  if (gapClearance(hi) < CLEAR_MARGIN) { hi = 20; if (gapClearance(hi) < CLEAR_MARGIN) hi = 60; }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (gapClearance(mid) >= CLEAR_MARGIN) hi = mid; else lo = mid;
  }
  const gapNeeded = hi;
  setCapMid(capMid0); // restore

  // §5 — option (c): the implied SETTING_ROD_R if Z_SETTING moved by the
  // apex's own delta. RSV_P0_TOP_Z measured live off reservePinion0's own
  // vertex top, not re-typed from the source comment.
  const rsvP0TopZ = zBand(mesh.reservePinion0)[1];
  const settingRodR0 = (apexZ0 - rsvP0TopZ) - CLEAR_MARGIN;
  const targetsC = [-2.266, -2.64, -3.014];
  const impliedApex = targetsC.map((c) => c - gapNeeded);
  const impliedSettingRodR = impliedApex.map((a) => (a - rsvP0TopZ) - CLEAR_MARGIN);

  // §6 — option (d): the corner alone, lowered to each implied apex, cap
  // left in place — clearance to every non-schematic, non-fold mesh.
  const mIn0 = mountIn.position.clone(), mOut0 = mountOut.position.clone();
  const lowered = {};
  for (const a of impliedApex.slice().sort((x, y) => x - y).filter((v, i, arr) => arr.indexOf(v) === i)) {
    mountIn.position.z = a; mountOut.position.z = a;
    C.scene.updateMatrixWorld(true);
    const rowsIn = minClearTo(mesh.mwCornerRiseIn, FOLD_NAMES, 1.0);
    const rowsOut = minClearTo(mesh.mwCornerRiseOut, FOLD_NAMES, 1.0);
    lowered[a.toFixed(3)] = { in: rowsIn.slice(0, 3), out: rowsOut.slice(0, 3) };
  }
  mountIn.position.copy(mIn0); mountOut.position.copy(mOut0);
  C.scene.updateMatrixWorld(true);

  // §7 — the plate's presented face, raycast at the minute wheel's own axis.
  const wheelXY = mesh.mwMinuteWheel.getWorldPosition(new THREE.Vector3());
  // from BELOW, toward +Z: the works (mwMinuteWheel, the fold) sit at more
  // negative z than the plate, on the DIAL side, so the plate's PRESENTED
  // face (the one that matters here) is its first surface hit going up.
  const ray = new THREE.Raycaster(new THREE.Vector3(wheelXY.x, wheelXY.y, -50), new THREE.Vector3(0, 0, 1), 0, 100);
  let faceZ = null;
  for (const pm of plateMeshes) { const hits = ray.intersectObject(pm, false); if (hits.length) faceZ = hits[0].point.z; }
  const mwWheelPlateClear = minClearMulti(meshesOf.mwMinuteWheel, plateMeshes);
  const cannonPlateClear = minClearMulti(meshesOf.cannonPinion, plateMeshes);

  return {
    bands, apexB, optionA,
    riseOutFlippedBand, plateSlab,
    gapNeeded, targetsC, impliedApex, impliedSettingRodR,
    settingRodR0, rsvP0TopZ,
    lowered,
    faceZ, mwWheelPlateClear, cannonPlateClear,
    CLEAR_MARGIN,
  };
});

if (out.missing) {
  console.log('FAIL — mesh(es) not found: ' + out.missing.join(', ') + ' (nothing measured)');
} else {
  const fmtB = (b) => `[${b[0].toFixed(3)}, ${b[1].toFixed(3)}]`;

  console.log('\n§1 — WORLD Z-BANDS (vertex-precise)');
  console.log(`  settingCap       z ${fmtB(out.bands.settingCap)}`);
  console.log(`  mwMinuteWheel    z ${fmtB(out.bands.mwMinuteWheel)}`);
  console.log(`  mwCornerRiseIn   z ${fmtB(out.bands.mwCornerRiseIn)}`);
  console.log(`  mwCornerRiseOut  z ${fmtB(out.bands.mwCornerRiseOut)}`);
  console.log(`  star             z ${fmtB(out.bands.star)}`);
  console.log(`  apex B           (${out.apexB.map((v) => v.toFixed(3)).join(', ')})`);

  console.log('\n§2 — OPTION (a): cap mid-plane -2.64, apex left at B — clearance within 0.6:');
  if (!out.optionA.length) console.log('  (nothing within 0.6)');
  for (const [n, c] of out.optionA) console.log(`  ${n.padEnd(20)} ${c.toFixed(4)}`);

  console.log('\n§3 — OPTION (b): rise corner outboard bevel flipped onto +Z:');
  console.log(`  mwCornerRiseOut z ${fmtB(out.riseOutFlippedBand)}`);
  console.log(`  plate slab      z ${fmtB(out.plateSlab)}`);
  const insideSlab = Math.max(0, Math.min(out.riseOutFlippedBand[1], out.plateSlab[1]) - Math.max(out.riseOutFlippedBand[0], out.plateSlab[0]));
  console.log(`  overlap with plate slab: ${insideSlab.toFixed(3)} u`);

  console.log('\n§4 — BISECTION: min gap (cap mid-plane above apex) clearing CLEAR_MARGIN:');
  console.log(`  gap needed = ${out.gapNeeded.toFixed(4)} (CLEAR_MARGIN ${out.CLEAR_MARGIN})`);
  for (let i = 0; i < out.targetsC.length; i++)
    console.log(`  c = ${out.targetsC[i].toFixed(3)}  ->  implied apex ${out.impliedApex[i].toFixed(3)}`);

  console.log('\n§5 — OPTION (c): implied SETTING_ROD_R if Z_SETTING moved to the apex above:');
  console.log(`  RSV_P0_TOP_Z (measured, reservePinion0's own top) = ${out.rsvP0TopZ.toFixed(4)}`);
  console.log(`  current SETTING_ROD_R (Z_SETTING=${out.apexB[2].toFixed(3)}) = ${out.settingRodR0.toFixed(4)}`);
  for (let i = 0; i < out.impliedApex.length; i++)
    console.log(`  apex ${out.impliedApex[i].toFixed(3)}  ->  implied SETTING_ROD_R ${out.impliedSettingRodR[i].toFixed(4)}`);

  console.log('\n§6 — OPTION (d): rise corner alone, lowered to each implied apex (cap left in place):');
  for (const [a, rows] of Object.entries(out.lowered)) {
    console.log(`  apex ${a}:`);
    console.log(`    RiseIn  nearest: ${rows.in.map(([n, c]) => `${n} ${c.toFixed(4)}`).join(', ') || '(none within 1.0)'}`);
    console.log(`    RiseOut nearest: ${rows.out.map(([n, c]) => `${n} ${c.toFixed(4)}`).join(', ') || '(none within 1.0)'}`);
  }

  console.log('\n§7 — PLATE FACE RAYCAST + mwMinuteWheel/cannonPinion clearances:');
  console.log(`  plate presented face at minute-wheel axis: z = ${out.faceZ === null ? 'NO HIT' : out.faceZ.toFixed(4)}`);
  console.log(`  mwMinuteWheel ⇄ backPlate clears ${out.mwWheelPlateClear.toFixed(4)}`);
  console.log(`  cannonPinion  ⇄ backPlate clears ${out.cannonPlateClear.toFixed(4)}`);

  console.log('\n(REPORT — nothing here gates; see TODO 151 for the fix path this feeds)');
}
await browser.close();
srv.kill();
