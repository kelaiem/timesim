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
  const G = await import('/src/geometry.js');
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

  // The plate's presented face, raycast at the minute wheel's own axis —
  // moved ahead of §4/§5 (which need it to derive targetsC live); printed
  // under §7 below, alongside the wheel/cannon clearances that use it too.
  const wheelXY = mesh.mwMinuteWheel.getWorldPosition(new THREE.Vector3());
  // from BELOW, toward +Z: the works (mwMinuteWheel, the fold) sit at more
  // negative z than the plate, on the DIAL side, so the plate's PRESENTED
  // face (the one that matters here) is its first surface hit going up.
  const faceRay = new THREE.Raycaster(new THREE.Vector3(wheelXY.x, wheelXY.y, -50), new THREE.Vector3(0, 0, 1), 0, 100);
  let faceZ = null;
  for (const pm of plateMeshes) { const hits = faceRay.intersectObject(pm, false); if (hits.length) faceZ = hits[0].point.z; }

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

  // targetsC, LIVE-DERIVED off the built metal — the old [-2.266, -2.64,
  // -3.014] was this item's own hand-picked investigation of where the cap's
  // mid-plane would have to sit to cover the OLD (pre-TODO 153) wheel band,
  // and TODO 151's own update note flagged it as stale residue once TODO 153
  // moved that band. Two live bounds instead:
  //   rootR   — the wheel's own gearToothSpec (built with its current mate,
  //             cannonPinionTeeth only — the fold does not mesh it yet);
  //   rimBand — every mwMinuteWheel vertex farther than 0.9*rootR from the
  //             wheel's own world axis (this probe's original hand-measured
  //             "r > 3.9" threshold, now derived instead of eyeballed);
  //   capReach — half the cap's own vertex z-band (§1);
  //   cLo — the cap's own bottom face sitting on the rim band's dial-ward face;
  //   cHi — the cap's own top face standing CLEAR_MARGIN off the plate's
  //         presented face (§7's raycast, read above).
  const mwSpec = G.gearToothSpec({ module: L.MW_MODULE_1, teeth: L.MW_MINUTE_TEETH, mates: [L.cannonPinionTeeth] });
  const rootR = mwSpec.rootR;
  const wheelCenter = namedGroups.mwMinuteWheel.getWorldPosition(new THREE.Vector3());
  const rimBand = (() => {
    let lo = Infinity, hi = -Infinity;
    for (const o of meshesOf.mwMinuteWheel) {
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        V.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        o.localToWorld(V);
        const r = Math.hypot(V.x - wheelCenter.x, V.y - wheelCenter.y);
        if (r > 0.9 * rootR) { lo = Math.min(lo, V.z); hi = Math.max(hi, V.z); }
      }
    }
    return [lo, hi];
  })();
  const capReach = (bands.settingCap[1] - bands.settingCap[0]) / 2;
  const cHi = faceZ === null ? null : faceZ - CLEAR_MARGIN - capReach;
  // cLo: the cap's mid-plane low enough that its TOP face (mid + capReach)
  // still reaches the rim band's DIAL-WARD face (rimBand[1], the less
  // negative bound — the works sit at more negative z than the plate, so the
  // dial-ward face of the rim is its numerically larger z) — the engagement
  // floor, mirroring cHi's own plate-side ceiling without a clearance margin
  // (this bound is about MESHING the wheel, not clearing it).
  const cLo = rimBand[1] - capReach;
  const targetsC = cHi === null ? [cLo] : [cLo, cHi];
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

  // §7 — the plate's presented face (raycast above), plus mwMinuteWheel's
  // and cannonPinion's own clearances against it.
  const mwWheelPlateClear = minClearMulti(meshesOf.mwMinuteWheel, plateMeshes);
  const cannonPlateClear = minClearMulti(meshesOf.cannonPinion, plateMeshes);

  // §8 — the recommended (d) landing's own parameters, measured against
  // freshly-cut EXPERIMENTAL blanks (never added to the live scene) rather
  // than assumed. BEVEL_TEETH/BEVEL_MODULE match main.js's addBevelCorner
  // literals (10, 0.3); the bore is the fold's own leg-2 radius, settingRodR0
  // (main.js's SETTING_ROD_R, ≈0.382), so the blank is the same stock as the
  // shipped rise corner.
  const BEVEL_TEETH_8 = 10, BEVEL_MODULE_8 = 0.3;
  const mkMitre = () => G.makeConicalGear({ teeth: BEVEL_TEETH_8, module: BEVEL_MODULE_8,
    mateTeeth: BEVEL_TEETH_8, boreR: settingRodR0, mateBoreR: settingRodR0, shaftAngleDeg: 90 });
  const mitreVerts = (() => {
    const g = mkMitre();
    const body = g.children.find((o) => o.isMesh) || g.children[0];
    const posAttr = body.geometry.attributes.position;
    let rMax = 0, zTop = -Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
      rMax = Math.max(rMax, Math.hypot(x, y));
      zTop = Math.max(zTop, z);
    }
    return { rMax, zTop };
  })();
  const { rMax, zTop } = mitreVerts;
  const stubClosedForm = zTop + rMax + CLEAR_MARGIN;

  // The bisection: two such blanks, apexes on one line, each pointing its
  // body TOWARD the other apex (addBevelCorner's own convention — the body
  // trails back along the shaft from the pitch point, so on a rod joining
  // two corners the two blanks grow toward each other). A detached scratch
  // group (never added to the live scene) so updateMatrixWorld only moves
  // these two.
  const stubBisected = (() => {
    const scratch = new THREE.Group();
    const grpA = new THREE.Group();
    grpA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    grpA.add(mkMitre());
    const grpB = new THREE.Group();
    grpB.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));
    grpB.add(mkMitre());
    scratch.add(grpA, grpB);
    const bodyA = grpA.children[0].children.find((o) => o.isMesh);
    const bodyB = grpB.children[0].children.find((o) => o.isMesh);
    const clearAt = (d) => { grpB.position.set(d, 0, 0); scratch.updateMatrixWorld(true); return I.meshClearance(bodyA, bodyB); };
    let slo = 0, shi = 8;
    if (clearAt(shi) < CLEAR_MARGIN) shi = 20;
    for (let i = 0; i < 60; i++) { const mid = (slo + shi) / 2; if (clearAt(mid) >= CLEAR_MARGIN) shi = mid; else slo = mid; }
    return shi;
  })();

  // The φ bisection — the recommended design's tilt of the rise leg B→E,
  // built from the design's own formula rather than assumed. apexD is cHi's
  // implied apex (§5, reusing the existing cap-above-apex bisection as the
  // stand-in for the new cap-over-cornerCap gap, since both pairs are the
  // same two shapes — a MW_MODULE_1/SETTING_CAP_TEETH pinion over a
  // BEVEL_MODULE/MW_LEG2_R mitre). `t` and the new cap XY are recomputed at
  // every trial φ, since the chord (and so the cap's site on the wheel's
  // mesh circle) is itself a function of φ.
  const apexD = (cHi === null || impliedApex.length < 2) ? null : impliedApex[impliedApex.length - 1];
  const barrelXY = C.P?.barrel ? { x: C.P.barrel.x, y: C.P.barrel.y } : null;
  const phiResult = (apexD === null || !barrelXY) ? null : (() => {
    const Dz = apexB[2] - apexD; // Z_SETTING - apexD
    const capMeshD8 = Math.hypot(apexB[0] - wheelCenter.x, apexB[1] - wheelCenter.y);
    const solve = (phiDeg) => {
      const phi = phiDeg * Math.PI / 180;
      const chord = Dz * Math.tan(phi) + stubClosedForm;
      // circle-circle intersection: (wheelCenter, capMeshD8) ∩ (B, chord)
      const dx = apexB[0] - wheelCenter.x, dy = apexB[1] - wheelCenter.y;
      const d = Math.hypot(dx, dy);
      if (d > capMeshD8 + chord || d < Math.abs(capMeshD8 - chord) || d === 0) return null;
      const a = (d * d + capMeshD8 * capMeshD8 - chord * chord) / (2 * d);
      const h2 = capMeshD8 * capMeshD8 - a * a;
      if (h2 < 0) return null;
      const h = Math.sqrt(h2);
      const mx = wheelCenter.x + (a * dx) / d, my = wheelCenter.y + (a * dy) / d;
      const rx = -dy / d, ry = dx / d;
      const p1 = { x: mx + h * rx, y: my + h * ry };
      const p2 = { x: mx - h * rx, y: my - h * ry };
      const far = (Math.hypot(p1.x - barrelXY.x, p1.y - barrelXY.y) >= Math.hypot(p2.x - barrelXY.x, p2.y - barrelXY.y)) ? p1 : p2;
      const tLen = Math.hypot(far.x - apexB[0], far.y - apexB[1]);
      const t = { x: (far.x - apexB[0]) / tLen, y: (far.y - apexB[1]) / tLen };
      // d1 = -cosφ·Ẑ + sinφ·t (t is horizontal, in XY)
      const d1 = new THREE.Vector3(Math.sin(phi) * t.x, Math.sin(phi) * t.y, -Math.cos(phi)).normalize();
      const E = { x: apexB[0] + d1.x * (Dz / Math.cos(phi)), y: apexB[1] + d1.y * (Dz / Math.cos(phi)), z: apexB[2] + d1.z * (Dz / Math.cos(phi)) };
      return { cap: far, t, d1, E };
    };
    const clearancesAt = (phiDeg) => {
      const s = solve(phiDeg);
      if (!s) return null;
      const scratch = new THREE.Group();
      const mkAt = (pos, axis) => {
        const grp = new THREE.Group();
        grp.position.set(pos.x, pos.y, pos.z);
        grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
        grp.add(mkMitre());
        scratch.add(grp);
        return grp.children[0].children.find((o) => o.isMesh);
      };
      const riseOut = mkAt(new THREE.Vector3(apexB[0], apexB[1], apexB[2]), s.d1);
      const footIn = mkAt(new THREE.Vector3(s.E.x, s.E.y, s.E.z), s.d1.clone().negate());
      const footOut = mkAt(new THREE.Vector3(s.E.x, s.E.y, s.E.z), new THREE.Vector3(s.t.x, s.t.y, 0));
      scratch.updateMatrixWorld(true);
      return {
        riseInFootIn: I.meshClearance(mesh.mwCornerRiseIn, footIn),
        riseInFootOut: I.meshClearance(mesh.mwCornerRiseIn, footOut),
        riseOutFootOut: I.meshClearance(riseOut, footOut),
        s,
      };
    };
    const allClear = (phiDeg) => {
      const c = clearancesAt(phiDeg);
      if (!c) return false;
      return c.riseInFootIn >= CLEAR_MARGIN && c.riseInFootOut >= CLEAR_MARGIN && c.riseOutFootOut >= CLEAR_MARGIN;
    };
    // scan coarse, then bisect to 0.01° resolution
    let philo = 0, phihi = null;
    for (let p = 0; p <= 60; p += 0.5) { if (allClear(p)) { phihi = p; philo = Math.max(0, p - 0.5); break; } }
    if (phihi === null) return { phiMin: null, note: 'no φ up to 60° cleared all three pairs' };
    while (phihi - philo > 0.01) {
      const mid = (philo + phihi) / 2;
      if (allClear(mid)) phihi = mid; else philo = mid;
    }
    return { phiMin: phihi, at: clearancesAt(phihi) };
  })();

  return {
    bands, apexB, optionA,
    riseOutFlippedBand, plateSlab,
    gapNeeded, targetsC, impliedApex, impliedSettingRodR,
    settingRodR0, rsvP0TopZ,
    lowered,
    faceZ, mwWheelPlateClear, cannonPlateClear,
    CLEAR_MARGIN,
    rootR, rimBand, capReach, cHi, cLo,
    mitreVerts, stubClosedForm, stubBisected,
    apexD, phiResult,
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
  console.log(`  targetsC (LIVE) rootR ${out.rootR.toFixed(4)}, rim band ${fmtB(out.rimBand)}, capReach ${out.capReach.toFixed(4)}, plate face ${out.faceZ === null ? 'NO HIT' : out.faceZ.toFixed(4)}`);
  console.log(`  [cLo, cHi] = [${out.cLo.toFixed(3)}, ${out.cHi === null ? '?' : out.cHi.toFixed(3)}]`);
  for (let i = 0; i < out.targetsC.length; i++)
    console.log(`  c = ${out.targetsC[i].toFixed(3)}  ->  implied apex ${out.impliedApex[i].toFixed(3)}`);
  if (out.cHi !== null) console.log(`  apex implied by cHi (the (d) landing's target): ${(out.cHi - out.gapNeeded).toFixed(3)}`);

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

  console.log('\n§8 — THE (d) LANDING\'S OWN PARAMETERS, measured against fresh experimental blanks:');
  console.log(`  mitre blank (BEVEL_TEETH 10, module 0.3, bore ${out.settingRodR0.toFixed(4)}): rMax ${out.mitreVerts.rMax.toFixed(4)}, zTop ${out.mitreVerts.zTop.toFixed(4)}`);
  console.log(`  stub length: closed form zTop+rMax+CLEAR_MARGIN = ${out.stubClosedForm.toFixed(4)}  vs  bisected min E→D offset = ${out.stubBisected.toFixed(4)}`);
  if (out.apexD === null) {
    console.log('  apexD (cHi\'s implied apex) unavailable — cHi did not resolve, so the φ bisection did not run');
  } else {
    console.log(`  apexD (cHi's implied apex, reused as Z_CAP_CORNER's stand-in) = ${out.apexD.toFixed(3)}`);
    const pr = out.phiResult;
    if (!pr || pr.phiMin === null) {
      console.log(`  φ bisection: FAILED — ${pr?.note || 'no result (barrel position unavailable?)'}`);
    } else {
      console.log(`  φ bisection (0.01° resolution): φ_min = ${pr.phiMin.toFixed(2)}°`);
      console.log(`    at φ_min: RiseIn⇄FootIn ${pr.at.riseInFootIn.toFixed(4)}, RiseIn⇄FootOut ${pr.at.riseInFootOut.toFixed(4)}, RiseOut⇄FootOut ${pr.at.riseOutFootOut.toFixed(4)}`);
      console.log(`    cap's new site ≈ (${pr.at.s.cap.x.toFixed(3)}, ${pr.at.s.cap.y.toFixed(3)}, ${out.apexD.toFixed(3)})`);
    }
  }

  console.log('\n(REPORT — nothing here gates; see TODO 151 for the fix path this feeds)');
}
await browser.close();
srv.kill();
