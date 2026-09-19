// §234 step 3a follow-up — WHERE DOES THE SETTING TRAVERSE FOLD, AND DOES EACH
// LEG CLEAR AT THE SECTION THE PLATE LEAVES IT? A REPORT, with controls.
//
// `Keyless works::settingTraverse` is the last `TURN_WAIVERS` row: a 27.47 u
// rod at r 0.382 (L/D 36) whose section is pinned by the reserve train's first
// pinion under it (`RSV_P0_TOP_Z`) over ~2.5 u of its run, and by the base
// plate's back face over ALL of it (probe-234-shaft-body-corridor.mjs
// MESH=settingTraverse: free r 0.55 above at every station, 0.382 below over
// the pinch, ≥ 2 u everywhere else). No single bar reaches the ceiling there
// — the plate caps r at 0.55 and the ceiling wants 0.687 — so the fix is a
// FOLD: one added bevel corner K splitting the run into two legs judged
// separately by `turnedBars` (a kink off the axis LINE is what splits a bar).
//
// THE SOLVE, all of it read off the metal and none of it chosen — and it took
// three cuts to get the SHAPE of it right, each refused by measurement:
//   1. one section for both legs (the plate's 0.55) and the equal-leg split on
//      the small-swing ray: K landed 0.45 u from the WINDING TRANSFER ARBOR
//      (the crown-wheel arbor, r 0.7, 1.92 u off the run's mid-point) and the
//      probe said "no wall in plan" because it had excluded the whole Keyless
//      works unit as ground. The skill's trap, verbatim. The exclusion is now
//      the SEVEN meshes the fold replaces or re-keys (traverse, the four
//      corner blanks at A and B, drop, rise) and nothing else.
//   2. the same on the other ray (K on the barrel's side): leg 1 at 29° ran
//      INTO the Yoke 4–6 u from A (inside its body, not near it), and leg 2 at
//      r 0.55 sat 0.075 into the reserve train's margin — the w1/p1 stratum
//      under the barrel side tops 0.1 below reservePinion0, so the plate is
//      not that leg's governing wall at all.
//   3. this one. The two legs have DIFFERENT governing neighbours, so each
//      takes its own section by the same law SETTING_ROD_R was derived by
//      (governing neighbour − CLEAR_MARGIN):
//        LEG1_R = (plate back face − Z_SETTING) − CLEAR_MARGIN      (0.55)
//        LEG2_R = (Z_SETTING − RSV_P0_TOP_Z) − CLEAR_MARGIN         (0.382, the traverse's own)
//      and each swings exactly as far as ITS wall forces:
//        β2 — leg 2 from B, toward the barrel's side, until the barrel-arbor
//             extension (r extR, vertical through the plane at the barrel's
//             XY) is passed by extR + LEG2_R + CLEAR_MARGIN:
//             β2 = φ + asin(need / |B − barrel|). At LEG2_R the leg still
//             passes OVER reservePinion0 exactly as the traverse does today.
//        α  — leg 1 from A, toward the same side, the LARGEST swing whose
//             first run clears the Yoke at LEG1_R over the whole pose net
//             (the Yoke moves with crownPullT). MEASURED here, by walking
//             the leg at each candidate angle — the Yoke is a fork, not a
//             circle, and a closed form for it would be a guess. Largest,
//             because K = the two rays' intersection and |AK| shrinks as α
//             grows: the Yoke is the constraint that binds before the
//             equal-margin split would (13.1° wanted, measured ~11° allowed).
//      K is the intersection; the deflection at K is α + β2 and the bevel
//      pair's shaft angle Σ = 180° − (α + β2), which `bevelToothSpec` takes
//      directly (γ = Σ/2 for equal counts). The mirror-image fold on the
//      transfer arbor's side degenerates (α ≤ 2° before the arbor, β2 ≤ 1°
//      before the column: Σ → 177°, leg 2 ≈ 21 u at 0.382, L/D 27, over the
//      gate) and is refused in the closed form below, not by taste.
// Nothing here is a knob: change the plate, the reserve pinion, the arbor
// extension, the Yoke or the corner's counts and K moves with them.
//
// WHAT IS MEASURED (over the full pose net, `digestPoses`, the seven
// replaced meshes excluded and nothing else):
//   1. CONTROL (a): the straight run A→B walked by THIS probe's segment walker
//      must reproduce the mesh-based probe's pinch (worst free r ≈ 0.382 under
//      the reserve, and 0.55 against the plate above) — otherwise the walker is
//      not seeing the metal the other instrument saw.
//   2. The α scan: leg 1's first ALPHA_RUN u at LEG1_R for every candidate
//      angle, the worst station per angle; α_max is the largest angle that
//      clears, and the table is printed whole.
//   3. Leg 1 (A→K) at LEG1_R and leg 2 (K→B) at LEG2_R, station by station,
//      free radius split by side. Every station must read ≥ its leg's r; a
//      wall reading EXACTLY the leg's r is the derivation closing, not a miss.
//   4. The corner blanks — K's two gears at Σ, A's outboard and B's inboard
//      mitres re-aimed along the legs — sampled on the BLANK ITSELF: the
//      spherical cap of radius coneR about the apex out to the tip cone's
//      angle, plus the small-end tip ring at coneRi. (The first cuts sampled a
//      flat disc of radius tipR AT the apex plane, which a 45° mitre never
//      fills — it read A's re-aimed blank into the minute pinion that the
//      shipped blank, the same cone turned about z, has never touched.)
//      Walls BELOW and IN PLAN are findings; the base plate ABOVE is expected
//      at K (A's corner already bores the plate to its tip circle,
//      BACK_PLATE_HOLES) and is reported as the recess K needs.
//   5. CONTROL (b): the bevel spec at Σ must be external (γ < 90°) and cut
//      with a face width > 0 at the legs' bores — printed, with any warning.
//
// NOT probe-234-shaft-body-corridor.mjs (that walks an EXISTING mesh's own
// axis; this walks CANDIDATE segments that have no mesh yet). NOT
// probe-138-fold-price.mjs (prices a conical blank against the sheared member
// it replaces at the SAME apex; K has no old member). NOT probe-173-fold.mjs
// (the sautoir anchor's fold, a different part and a 2D box scan).
//
// Usage: cd tools && node probe-234-traverse-fold.mjs [out.json]
//        env STEP=0.5 SEARCH=3.0 ALPHA_RUN=12 ALPHA_MIN=0 ALPHA_MAX=30 ALPHA_STEP=1 (ALPHA_FIXED=n skips the scan)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8562;
const ROOT = process.env.ROOT || '..';
const STEP = +(process.env.STEP || 0.5);
const SEARCH = +(process.env.SEARCH || 3.0);
const ALPHA_RUN = +(process.env.ALPHA_RUN || 12);
const ALPHA_MAX = +(process.env.ALPHA_MAX || 30);
const ALPHA_MIN = +(process.env.ALPHA_MIN || 0);
const ALPHA_STEP = +(process.env.ALPHA_STEP || 1);
const ALPHA_FIXED = process.env.ALPHA_FIXED != null ? +process.env.ALPHA_FIXED : null;   // skip the scan and walk the fold at this α (re-runs after a scan)

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const bootWarns = warns.length;

const R = await page.evaluate(async ({ STEP, SEARCH, ALPHA_RUN, ALPHA_MIN, ALPHA_MAX, ALPHA_STEP, ALPHA_FIXED }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const G = await import('./src/geometry.js');
  const { CLEAR_MARGIN, TURN_LD_MAX, TURN_LD_TARGET } = await import('./src/layout.js');
  const clock = window.__clock;
  const UNIT = 'Keyless works';
  // …and, once the fold is BUILT, the fold's own metal too — the probe then
  // re-measures the built legs as candidates and is the fold's acceptance.
  const REPLACED = new Set(['settingTraverse', 'settingTraverse1', 'settingTraverse2', 'mwCornerFoldIn', 'mwCornerFoldOut', 'mwCornerDropIn', 'mwCornerDropOut', 'mwCornerRiseIn', 'mwCornerRiseOut', 'settingDrop', 'settingRise']);

  const all = [];
  clock.scene.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position && !(o.userData && o.userData.schematic)) all.push(o); });
  const byName = new Map();
  for (const o of all) if (o.name && !byName.has(o.name)) byName.set(o.name, o);
  const unitOf = new Map();
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (!unitOf.has(o)) unitOf.set(o, e.name); });
  const nameOf = (o) => o.name || '(unnamed)';
  const obstacles = all.filter((o) => !REPLACED.has(o.name));

  // ---- inputs, read off the metal at the rest pose ----
  I.enterAxis(clock); clock.resetInputs?.(); clock.scene.updateMatrixWorld(true);
  // A and B are the two mitre corners' apexes — the corner mounts sit AT the
  // apex (addBevelCorner puts the mount at `point`), so they are the same
  // points whether the run between them is the shipped straight rod or the
  // built fold. The shipped straight rod's radius, where one exists, is the
  // control's reference; on the folded tree it is leg 2's law (LEG2_R below).
  const apexOf = (name) => { const g = byName.get(name); if (!g) throw new Error(`${name} not found`); return g.parent.getWorldPosition(new THREE.Vector3()); };
  const A = apexOf('mwCornerDropIn'), B = apexOf('mwCornerRiseOut');
  const tr = byName.get('settingTraverse');
  const rodR = tr ? tr.geometry.parameters.radiusTop : null;
  const Z = A.z;
  const plate = byName.get('backPlate'); if (!plate) throw new Error('backPlate not found');
  const plateBack = new THREE.Box3().setFromObject(plate).min.z;
  const LEG1_R = (plateBack - Z) - CLEAR_MARGIN;
  const barrel = { x: clock.P.barrel.x, y: clock.P.barrel.y };
  const p0g = clock.scene.getObjectByName('reservePinion0'); if (!p0g) throw new Error('reservePinion0 not found');
  p0g.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  let p0Tip = 0, p0Top = -Infinity;
  p0g.traverse((o) => { if (!o.isMesh) return; const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); p0Tip = Math.max(p0Tip, Math.hypot(v.x - barrel.x, v.y - barrel.y)); p0Top = Math.max(p0Top, v.z); } });
  // the barrel-arbor extension: the reserve-train mesh whose box holds the barrel axis at the traverse plane
  let ext = null;
  for (const o of all) { if (unitOf.get(o) !== 'Power-reserve train') continue; const b = new THREE.Box3().setFromObject(o); if (b.containsPoint(new THREE.Vector3(barrel.x, barrel.y, Z))) { ext = o; break; } }
  if (!ext) throw new Error('no reserve-train mesh crosses the traverse plane at the barrel axis');
  const extR = ext.geometry.parameters?.radiusTop ?? null;
  if (extR == null) throw new Error('the arbor extension is not a plain cylinder — its radius cannot be read');

  // the winding transfer arbor: the crown-wheel arbor climbing through the plate — the mid-run obstacle the first cut missed
  const tArb = byName.get('transferArbor'); if (!tArb) throw new Error('transferArbor not found');
  tArb.updateWorldMatrix(true, false);
  const tArbXY = new THREE.Vector3().setFromMatrixPosition(tArb.matrixWorld);
  const tArbR = tArb.geometry.parameters?.radiusTop ?? null;
  if (tArbR == null) throw new Error('transferArbor is not a plain cylinder — its radius cannot be read');
  // the reserve train's members under the barrel side, for the record: station, z-band and tip radius (max vertex radius about their own axis)
  const rsvInfo = {};
  for (const nm of ['reservePinion0', 'rsvWheel1', 'reservePinion1', 'rsvWheel2']) {
    const g = clock.scene.getObjectByName(nm); if (!g) continue; g.updateWorldMatrix(true, true);
    const c = g.getWorldPosition(new THREE.Vector3()); let tip = 0, lo = Infinity, hi = -Infinity;
    g.traverse((o) => { if (!o.isMesh) return; const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); tip = Math.max(tip, Math.hypot(v.x - c.x, v.y - c.y)); lo = Math.min(lo, v.z); hi = Math.max(hi, v.z); } });
    rsvInfo[nm] = { x: +c.x.toFixed(4), y: +c.y.toFixed(4), tipR: +tip.toFixed(4), z: [+lo.toFixed(4), +hi.toFixed(4)] };
  }
  // ---- the solve ----
  const LEG2_R = (Z - p0Top) - CLEAR_MARGIN;                       // the traverse's own law, re-derived here off the same pinion
  const rodRef = rodR ?? LEG2_R;                                   // the straight run's section: the shipped rod's, or leg 2's law once folded
  const leg2OverP0 = Math.abs(LEG2_R - rodRef) < 1e-3;            // control: this IS the shipped SETTING_ROD_R
  const u = B.clone().sub(A); const Lab = u.length(); u.normalize();
  const n = new THREE.Vector3(-u.y, u.x, 0);
  const across = (barrel.x - A.x) * n.x + (barrel.y - A.y) * n.y;   // barrel's side of AB, signed
  const along = (barrel.x - A.x) * u.x + (barrel.y - A.y) * u.y;
  const side = across >= 0 ? 1 : -1;                                // K swings to the barrel's side
  const dB = Math.hypot(barrel.x - B.x, barrel.y - B.y);
  const BA = A.clone().sub(B).normalize();
  const toBar = new THREE.Vector3(barrel.x - B.x, barrel.y - B.y, 0).normalize();
  const phi = Math.acos(Math.min(1, Math.max(-1, BA.dot(toBar))));
  const needCol = extR + LEG2_R + CLEAR_MARGIN;
  const beta2 = phi + Math.asin(needCol / dB);
  const needArb = tArbR + LEG1_R + CLEAR_MARGIN;
  const distLine = (P, Q, X) => { const d = Q.clone().sub(P); d.normalize(); return Math.abs((X.x - P.x) * -d.y + (X.y - P.y) * d.x); };
  const distSeg = (P, Q, X) => { const d = Q.clone().sub(P); const L = d.length(); d.normalize(); const t = Math.min(L, Math.max(0, (X.x - P.x) * d.x + (X.y - P.y) * d.y)); return Math.hypot(P.x + d.x * t - X.x, P.y + d.y * t - X.y); };
  const teeth = 10, module = 0.3; // BEVEL_TEETH / BEVEL_MODULE — the motion-works corners' counts (read as the shipped gears' pitch: below)
  const gearA = byName.get('mwCornerDropOut');
  const shippedPitchR = gearA?.parent?.userData?.r ?? null;
  const rot = (v, ang) => new THREE.Vector3(v.x * Math.cos(ang) - v.y * Math.sin(ang), v.x * Math.sin(ang) + v.y * Math.cos(ang), 0);
  const leg1DirAt = (alpha) => rot(u, side * alpha);               // leg 1 from A swung toward K's side
  const leg2Ray = rot(BA, -side * beta2);                           // leg 2 from B, swung toward the same side (BA's left normal is −n)
  const intersect = (P, d1, Q, d2) => { const det = d1.x * -d2.y - d1.y * -d2.x; const t = ((Q.x - P.x) * -d2.y - (Q.y - P.y) * -d2.x) / det; return P.clone().addScaledVector(d1, t); };
  const foldFor = (alphaDeg) => {
    const alpha = alphaDeg * Math.PI / 180;
    const K = intersect(A, leg1DirAt(alpha), B, leg2Ray);
    const leg1 = K.clone().sub(A).normalize(), leg2 = B.clone().sub(K).normalize();
    const deflDeg = alphaDeg + beta2 * 180 / Math.PI;
    const sigmaDeg = 180 - deflDeg;
    const specWarns = [];
    const origWarn = console.warn; console.warn = (m) => specWarns.push(String(m));
    const spec = G.bevelToothSpec({ module, teeth, mateTeeth: teeth, shaftAngleDeg: sigmaDeg, boreR: LEG1_R, mateBoreR: LEG2_R });
    console.warn = origWarn;
    const gammaDeg = Math.atan2(Math.sin(sigmaDeg * Math.PI / 180), 1 + Math.cos(sigmaDeg * Math.PI / 180)) * 180 / Math.PI;
    return { alphaDeg, beta2Deg: beta2 * 180 / Math.PI, K: K.toArray(), legLen1: A.distanceTo(K), legLen2: K.distanceTo(B),
      ld1: A.distanceTo(K) / (2 * LEG1_R), ld2: K.distanceTo(B) / (2 * LEG2_R),
      missCol2: distLine(K, B, new THREE.Vector3(barrel.x, barrel.y, 0)), missCol1: distSeg(A, K, new THREE.Vector3(barrel.x, barrel.y, 0)),
      missArb1: distSeg(A, K, tArbXY), missArb2: distSeg(K, B, tArbXY),
      deflDeg, sigmaDeg, gammaDeg, spec: Object.fromEntries(Object.entries(spec).filter(([, x]) => typeof x === 'number')), specWarns, K3: K, leg1, leg2 };
  };
  // the equal-margin split, for the record (what α WOULD be if nothing stood in the way)
  const alphaEqualDeg = Math.asin(Math.min(1, Math.sin(beta2) * LEG2_R / LEG1_R)) * 180 / Math.PI;
  const spec90 = G.bevelToothSpec({ module, teeth, mateTeeth: teeth, shaftAngleDeg: 90, boreR: LEG1_R, mateBoreR: LEG1_R, quiet: true });
  const arbAlong = (tArbXY.x - A.x) * u.x + (tArbXY.y - A.y) * u.y, arbAcross = (tArbXY.x - A.x) * n.x + (tArbXY.y - A.y) * n.y;
  // the mirror fold, closed form only: leg 2 passing the column on the far side, leg 1 bounded by the transfer arbor
  const mirror = (() => {
    const b2 = phi - Math.asin(needCol / dB);
    const ray2 = rot(BA, -side * b2);
    // leg 1 swung away from the barrel's side until it grazes the transfer arbor at needArb
    const dA = Math.hypot(tArbXY.x - A.x, tArbXY.y - A.y);
    const bearing = Math.atan2(arbAcross, arbAlong); // arbor's bearing off AB (signed toward +n)
    const aMax = -(bearing) - Math.asin(needArb / dA) * (arbAcross < 0 ? -1 : 1); // toward the arbor's side, stopping short of it
    const a = Math.max(0, Math.abs(aMax)) * (arbAcross < 0 ? -1 : 1);
    const K = intersect(A, rot(u, a), B, ray2);
    return { beta2Deg: b2 * 180 / Math.PI, alphaDeg: a * 180 / Math.PI, legLen1: A.distanceTo(K), legLen2: K.distanceTo(B), ld2: K.distanceTo(B) / (2 * LEG2_R), sigmaDeg: 180 - Math.abs(a * 180 / Math.PI) - Math.abs(b2 * 180 / Math.PI) };
  })();

  // ---- the walker ----
  const poses = I.digestPoses(clock);
  const PROBE_R = 0.02;
  const probeGeom = new THREE.SphereGeometry(PROBE_R, 8, 6); probeGeom.computeBoundingSphere();
  const probe = new THREE.Mesh(probeGeom, new THREE.MeshBasicMaterial()); probe.matrixAutoUpdate = false; clock.scene.add(probe);
  const _sc = new THREE.Vector3(), _ss = new THREE.Vector3();
  const worldSphere = (o) => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const bs = o.geometry.boundingSphere; _sc.copy(bs.center).applyMatrix4(o.matrixWorld); o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), _ss); return { x: _sc.x, y: _sc.y, z: _sc.z, r: bs.radius * Math.max(Math.abs(_ss.x), Math.abs(_ss.y), Math.abs(_ss.z)) }; };
  const boxCache = new Map();
  const worldBox = (o) => { let b = boxCache.get(o); if (!b) { b = new THREE.Box3().setFromObject(o); boxCache.set(o, b); } return b; };
  const fresh = () => ({ gap: Infinity, owner: null, poseIdx: null });
  // sets of sample points, each a { pts: [Vector3], rows }; `walk` scans a batch over the whole pose net
  const sets = {};
  const addSet = (key, pts, meta) => { sets[key] = { meta, pts, rows: pts.map((p, i) => ({ i, p: [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)], gap: Infinity, owner: null, poseIdx: null, dir: null, below: fresh(), above: fresh(), plan: fresh() })) }; return sets[key]; };
  const segPts = (P, Q) => { const L = P.distanceTo(Q), d = Q.clone().sub(P).normalize(); const pts = []; for (let t = 0; t <= L + 1e-9; t += STEP) pts.push(P.clone().addScaledVector(d, Math.min(t, L))); if (L - (pts.length - 1) * STEP > 1e-6) pts.push(Q.clone()); return pts; };
  const probeMat = new THREE.Matrix4();
  const walk = (batch) => {
    const allPts = batch.flatMap((s) => s.rows.map((r, i) => ({ s, r, p: s.pts[i] })));
    const bbox = new THREE.Box3(); for (const q of allPts) bbox.expandByPoint(q.p);
    const bc = bbox.getCenter(new THREE.Vector3()), br = bbox.getSize(new THREE.Vector3()).length() / 2;
    let lastAxis = null;
    for (let pi = 0; pi < poses.length; pi++) {
      const p = poses[pi];
      if (p.axis !== lastAxis) { I.enterAxis(clock); lastAxis = p.axis; }
      clock.setPose(p); clock.scene.updateMatrixWorld(true); boxCache.clear();
      const near = [];
      for (const o of obstacles) { const s = worldSphere(o); if (Math.hypot(s.x - bc.x, s.y - bc.y, s.z - bc.z) <= s.r + br + SEARCH + PROBE_R) near.push(o); }
      for (const q of allPts) {
        const pt = q.p;
        probeMat.identity().setPosition(pt); probe.matrix.copy(probeMat); probe.matrixWorld.copy(probeMat);
        let best = Infinity, bestOwner = null, bestVec = null;
        for (const o of near) {
          const s = worldSphere(o);
          if (Math.hypot(s.x - pt.x, s.y - pt.y, s.z - pt.z) > s.r + SEARCH + PROBE_R) continue;
          const d = I.meshClearance(probe, o, SEARCH);
          if (!(d < SEARCH)) continue;
          const bx = worldBox(o);
          const cx = Math.min(Math.max(pt.x, bx.min.x), bx.max.x), cy = Math.min(Math.max(pt.y, bx.min.y), bx.max.y), cz = Math.min(Math.max(pt.z, bx.min.z), bx.max.z);
          const vv = { dx: cx - pt.x, dy: cy - pt.y, dz: cz - pt.z };
          const vertical = Math.abs(vv.dz) > Math.hypot(vv.dx, vv.dy);
          const key = vertical ? (vv.dz < 0 ? 'below' : 'above') : 'plan';
          const owner = `${unitOf.get(o) || '?'} / ${nameOf(o)}${o.name ? '' : ` [${o.geometry.type.replace('Geometry', '')} z ${bx.min.z.toFixed(2)}..${bx.max.z.toFixed(2)}]`}`;
          if (d < q.r[key].gap) q.r[key] = { gap: d, owner, poseIdx: pi };
          if (d < best) { best = d; bestOwner = owner; bestVec = vv; }
        }
        if (best < q.r.gap) { q.r.gap = best; q.r.owner = bestOwner; q.r.poseIdx = pi; q.r.dir = Math.abs(bestVec.dz) > Math.hypot(bestVec.dx, bestVec.dy) ? (bestVec.dz < 0 ? 'z-' : 'z+') : 'xy'; }
      }
    }
  };
  const freeOf = (g) => (isFinite(g) ? +(PROBE_R + g - CLEAR_MARGIN).toFixed(4) : null);
  const worstFree = (set) => set.rows.reduce((a, b) => (b.gap < a.gap ? b : a), set.rows[0]);
  // PASS 1 — the control run and the α scan
  const pass1 = [addSet('lineAB', segPts(A, B), { kind: 'control', from: 'A', to: 'B', r: rodRef })];
  const alphas = []; if (ALPHA_FIXED == null) { for (let a = ALPHA_MIN; a <= ALPHA_MAX + 1e-9; a += ALPHA_STEP) alphas.push(+a.toFixed(3)); } else alphas.push(ALPHA_FIXED);
  for (const a of alphas) { const d = leg1DirAt(a * Math.PI / 180); pass1.push(addSet(`alpha:${a}`, segPts(A, A.clone().addScaledVector(d, ALPHA_RUN)), { kind: 'alpha', alphaDeg: a, r: LEG1_R })); }
  walk(pass1);
  let alphaMax = null;
  for (const a of alphas) if (freeOf(worstFree(sets[`alpha:${a}`]).gap) >= LEG1_R - 1e-4) alphaMax = a;
  if (ALPHA_FIXED != null && alphaMax == null) throw new Error(`ALPHA_FIXED ${ALPHA_FIXED}° does not clear the Yoke at LEG1_R — re-run the scan`);
  // PASS 2 — the fold at α_max: both legs and the four blanks
  // the blank on its own cone: spherical cap of radius coneR out to θ_tip (3 rings × 16), plus the small-end tip ring at coneRi
  const blankPts = (c, ax, sp) => { const a = ax.clone().normalize(); const t1 = Math.abs(a.z) < 0.9 ? new THREE.Vector3(0, 0, 1).cross(a).normalize() : new THREE.Vector3(1, 0, 0).cross(a).normalize(); const t2 = a.clone().cross(t1).normalize(); const thTip = Math.asin(Math.min(1, sp.tipR / sp.coneR)); const pts = []; const ring = (rho, th) => { for (let k = 0; k < 16; k++) { const ph = (k / 16) * 2 * Math.PI; pts.push(c.clone().addScaledVector(a, rho * Math.cos(th)).addScaledVector(t1, rho * Math.sin(th) * Math.cos(ph)).addScaledVector(t2, rho * Math.sin(th) * Math.sin(ph))); } }; for (let r = 1; r <= 3; r++) ring(sp.coneR, thTip * r / 3); ring(sp.coneR - sp.faceW, thTip); return pts; };
  if (alphaMax != null) {
    const F = foldFor(alphaMax);
    walk([
      addSet('leg1', segPts(A, F.K3), { kind: 'leg', alphaDeg: alphaMax, from: 'A', to: 'K', r: LEG1_R }),
      addSet('leg2', segPts(F.K3, B), { kind: 'leg', alphaDeg: alphaMax, from: 'K', to: 'B', r: LEG2_R }),
      addSet('blankK_in', blankPts(F.K3, F.leg1, F.spec), { kind: 'blank', at: 'K', axis: 'leg1' }),
      addSet('blankK_out', blankPts(F.K3, F.leg2, F.spec), { kind: 'blank', at: 'K', axis: 'leg2' }),
      addSet('blankA_out', blankPts(A, F.leg1, spec90), { kind: 'blank', at: 'A', axis: 'leg1' }),
      addSet('blankB_in', blankPts(B, F.leg2, spec90), { kind: 'blank', at: 'B', axis: 'leg2' }),
    ]);
  }
  clock.scene.remove(probe); probeGeom.dispose();
  const free = freeOf;
  const out = {};
  for (const [k, s] of Object.entries(sets)) {
    out[k] = { meta: s.meta, rows: s.rows.map((r) => ({ i: r.i, p: r.p, freeR: free(r.gap), owner: r.owner, poseIdx: r.poseIdx, dir: r.dir, below: { freeR: free(r.below.gap), owner: r.below.owner }, above: { freeR: free(r.above.gap), owner: r.above.owner }, plan: { freeR: free(r.plan.gap), owner: r.plan.owner } })) };
  }
  return {
    inputs: { A: A.toArray(), B: B.toArray(), Lab, rodR: rodRef, folded: !tr, rsvInfo, plateBack, LEG1_R, LEG2_R, leg2OverP0, barrel, p0Tip, p0Top, extR, needCol, dB, phiDeg: phi * 180 / Math.PI, along, across, side, tArbXY: [tArbXY.x, tArbXY.y], tArbR, arbAlong, arbAcross, needArb, alphaEqualDeg, beta2Deg: beta2 * 180 / Math.PI, CLEAR_MARGIN, TURN_LD_MAX, TURN_LD_TARGET, shippedPitchR, spec90: { tipR: spec90.tipR, coneR: spec90.coneR, faceW: spec90.faceW }, poseCount: poses.length, alphas, ALPHA_RUN },
    folds: Object.fromEntries(alphas.map((a) => [a, { ...foldFor(a), K3: undefined, leg1: undefined, leg2: undefined }])),
    alphaMax,
    mirror,
    sets: out,
  };
}, { STEP, SEARCH, ALPHA_RUN, ALPHA_MIN, ALPHA_MAX, ALPHA_STEP, ALPHA_FIXED });

const f4 = (x) => (x == null ? '—' : (+x).toFixed(4));
const inp = R.inputs;
console.log('§234 — the setting traverse FOLD: each leg at its own wall, K where the two boundary rays meet, measured over the pose net');
console.log(`  A ${inp.A.map(f4).join(', ')}   B ${inp.B.map(f4).join(', ')}   |AB| ${f4(inp.Lab)}   straight-run r ${f4(inp.rodR)} (L/D ${(inp.Lab / (2 * inp.rodR)).toFixed(1)})${inp.folded ? ' — the tree is FOLDED: the straight run is the control only, the built legs are re-measured as the candidates' : ''}`);
console.log(`  LEG1_R = (plate back ${f4(inp.plateBack)} − ${f4(inp.A[2])}) − ${inp.CLEAR_MARGIN} = ${f4(inp.LEG1_R)};  LEG2_R = (${f4(inp.A[2])} − p0 top ${f4(inp.p0Top)}) − ${inp.CLEAR_MARGIN} = ${f4(inp.LEG2_R)} (= shipped SETTING_ROD_R: ${inp.leg2OverP0 ? 'yes' : 'NO'})`);
console.log(`  barrel (${f4(inp.barrel.x)}, ${f4(inp.barrel.y)}): along ${f4(inp.along)}, across ${f4(inp.across)} of AB (K swings to side ${inp.side}); p0 tip r ${f4(inp.p0Tip)}; arbor ext r ${f4(inp.extR)} → leg 2 passes the column by ${f4(inp.needCol)}: β2 = φ ${inp.phiDeg.toFixed(3)}° + asin(${f4(inp.needCol)}/${f4(inp.dB)}) = ${inp.beta2Deg.toFixed(3)}°`);
for (const [nm, r] of Object.entries(inp.rsvInfo)) console.log(`  reserve ${nm.padEnd(16)} at (${f4(r.x)}, ${f4(r.y)})  tip r ${f4(r.tipR)}  z ${f4(r.z[0])}..${f4(r.z[1])}`);
console.log(`  transfer arbor (${f4(inp.tArbXY[0])}, ${f4(inp.tArbXY[1])}) r ${f4(inp.tArbR)}: along ${f4(inp.arbAlong)}, across ${f4(inp.arbAcross)} — leg 1 must pass it by ${f4(inp.needArb)}`);
console.log(`  equal-margin split would want α ${inp.alphaEqualDeg.toFixed(3)}° (sin α = sin β2 · LEG2_R/LEG1_R); the α scan below says what the Yoke allows`);
console.log(`  MIRROR fold (transfer arbor's side), closed form: β2 ${R.mirror.beta2Deg.toFixed(3)}°, α ${R.mirror.alphaDeg.toFixed(3)}° → legs ${f4(R.mirror.legLen1)} / ${f4(R.mirror.legLen2)}, leg 2 L/D ${R.mirror.ld2.toFixed(1)} at LEG2_R (gate ${inp.TURN_LD_MAX}), Σ ${R.mirror.sigmaDeg.toFixed(1)}° → ${R.mirror.ld2 > inp.TURN_LD_MAX ? 'REFUSED (over the gate)' : 'not refused by the gate'}`);
console.log('');
const worstOf = (key, f) => { const s = R.sets[key]; return s.rows.reduce((a, b) => ((f(b) ?? Infinity) < (f(a) ?? Infinity) ? b : a), s.rows[0]); };
const table = (key, title, r) => {
  const s = R.sets[key];
  console.log(`${title} (${s.rows.length} stations, r ${f4(r)})`);
  console.log('   i     x        y        z      freeR   owner                                      dir  below    above    plan');
  for (const row of s.rows) console.log(`  ${String(row.i).padStart(3)} ${row.p.map((x) => x.toFixed(3).padStart(8)).join(' ')}  ${String(row.freeR).padStart(7)}  ${String(row.owner).padEnd(42)} ${String(row.dir).padEnd(4)} ${String(row.below.freeR).padStart(7)} ${String(row.above.freeR).padStart(7)} ${String(row.plan.freeR).padStart(7)}`);
  const worst = worstOf(key, (x) => x.freeR), wb = worstOf(key, (x) => x.below.freeR), wa = worstOf(key, (x) => x.above.freeR), wp = worstOf(key, (x) => x.plan.freeR);
  console.log(`  worst: freeR ${worst.freeR} at #${worst.i} (${worst.owner}, ${worst.dir}); below ${wb.below.freeR} (${wb.below.owner}); above ${wa.above.freeR} (${wa.above.owner}); plan ${wp.plan.freeR} (${wp.plan.owner})`);
  console.log('');
  return { worst, wb, wa, wp };
};
const ctl = table('lineAB', 'CONTROL (a): the straight run A→B, this walker', inp.rodR);
const okA = ctl.worst.freeR != null && Math.abs(ctl.worst.freeR - inp.rodR) < 0.02 && ctl.wa.above.freeR != null && Math.abs(ctl.wa.above.freeR - inp.LEG1_R) < 0.02;
console.log(`CONTROL (a) reproduces the pinch (worst ${ctl.worst.freeR} ≈ shipped r ${f4(inp.rodR)}) and the plate cap (above ${ctl.wa.above.freeR} ≈ LEG1_R ${f4(inp.LEG1_R)}): ${okA ? 'PASS' : 'FAIL — the walker is not seeing what probe-234-shaft-body-corridor saw'}`);
console.log('');
console.log(`THE α SCAN — leg 1's first ${inp.ALPHA_RUN} u at LEG1_R ${f4(inp.LEG1_R)}, worst station per angle over ${inp.poseCount} poses`);
console.log('   α°     worst    at u    owner                                      dir   | fold at this α: legs, L/D, Σ');
const alphaMax = R.alphaMax;
for (const a of inp.alphas) {
  const w = worstOf(`alpha:${a}`, (x) => x.freeR); const F = R.folds[a];
  const ok = w.freeR >= inp.LEG1_R - 1e-4;
  console.log(`  ${String(a).padStart(5)}  ${String(w.freeR).padStart(7)}  ${(w.i * STEP).toFixed(1).padStart(5)}  ${String(w.owner).padEnd(42)} ${String(w.dir).padEnd(4)} ${ok ? 'ok ' : 'HIT'} | ${f4(F.legLen1)} / ${f4(F.legLen2)}  L/D ${F.ld1.toFixed(2)} / ${F.ld2.toFixed(2)}  Σ ${F.sigmaDeg.toFixed(2)}°`);
}
console.log(`  α_max (largest clearing angle in the scan): ${alphaMax == null ? 'NONE' : alphaMax + '°'}  — monotone? ${inp.alphas.filter((a) => a <= (alphaMax ?? -1)).every((a) => worstOf(`alpha:${a}`, (x) => x.freeR).freeR >= inp.LEG1_R - 1e-4) ? 'yes' : 'NO — read the table'}`);
console.log('');
if (alphaMax != null) {
  const a = alphaMax, F = R.folds[a];
  console.log(`THE FOLD at α_max ${a}°:  K (${F.K.map(f4).join(', ')})  legs ${f4(F.legLen1)} / ${f4(F.legLen2)}  L/D ${F.ld1.toFixed(2)} at LEG1_R, ${F.ld2.toFixed(2)} at LEG2_R (target ${inp.TURN_LD_TARGET}, gate ${inp.TURN_LD_MAX});  deflection ${F.deflDeg.toFixed(3)}°, Σ ${F.sigmaDeg.toFixed(3)}°, γ ${F.gammaDeg.toFixed(3)}°`);
  console.log(`  closed-form bounds: leg 2 passes the barrel axis at ${f4(F.missCol2)} (need ${f4(inp.needCol)}: ${F.missCol2 >= inp.needCol - 1e-6 ? 'EXACT/ok' : 'MISS'}); leg 1's segment to the barrel axis ${f4(F.missCol1)}; transfer arbor — leg 1 ${f4(F.missArb1)}, leg 2 ${f4(F.missArb2)} (need ${f4(inp.needArb)}: ${F.missArb1 >= inp.needArb && F.missArb2 >= inp.needArb ? 'ok' : 'REFUSED'})`);
  console.log(`  bevel spec at Σ, bores LEG1_R/LEG2_R: tipR ${f4(F.spec.tipR)} (90° mitre ${f4(inp.spec90.tipR)}), coneR ${f4(F.spec.coneR)}, faceW ${f4(F.spec.faceW)}, pitchR ${f4(F.spec.pitchR)} (shipped ${f4(inp.shippedPitchR)}); CONTROL (b) external and cut: ${F.gammaDeg < 90 && F.spec.faceW > 0 && F.specWarns.length === 0 ? 'PASS' : 'FAIL'} ${F.specWarns.join(' | ')}`);
  console.log('');
  const l1 = table('leg1', `LEG 1: A → K at α_max`, inp.LEG1_R), l2 = table('leg2', `LEG 2: K → B`, inp.LEG2_R);
  console.log(`leg 1 at LEG1_R ${f4(inp.LEG1_R)}: worst freeR ${l1.worst.freeR} → ${l1.worst.freeR >= inp.LEG1_R - 1e-4 ? 'CLEARS' : `SHORT by ${(inp.LEG1_R - l1.worst.freeR).toFixed(4)} (${l1.worst.owner}, ${l1.worst.dir})`}`);
  console.log(`leg 2 at LEG2_R ${f4(inp.LEG2_R)}: worst freeR ${l2.worst.freeR} → ${l2.worst.freeR >= inp.LEG2_R - 1e-4 ? 'CLEARS' : `SHORT by ${(inp.LEG2_R - l2.worst.freeR).toFixed(4)} (${l2.worst.owner}, ${l2.worst.dir})`}`);
  let blankFindings = 0;
  for (const [key, title] of [['blankK_in', 'K, inboard blank (axis leg 1)'], ['blankK_out', 'K, outboard blank (axis leg 2)'], ['blankA_out', 'A, outboard mitre re-aimed along leg 1'], ['blankB_in', 'B, inboard mitre re-aimed along leg 2']]) {
    const s = R.sets[key];
    const byOwner = new Map();
    for (const r of s.rows) for (const sd of ['below', 'above', 'plan']) { const o = r[sd].owner; if (!o) continue; const cur = byOwner.get(o); const fr = r[sd].freeR; if (!cur || fr < cur.freeR) byOwner.set(o, { freeR: fr, side: sd, i: r.i }); }
    const rows = [...byOwner.entries()].sort((x, y) => x[1].freeR - y[1].freeR);
    console.log(`BLANK ${title}: ${rows.length} neighbours within ${SEARCH}`);
    for (const [o, x] of rows) console.log(`    ${String(x.freeR).padStart(8)}  ${x.side.padEnd(5)}  ${o}   (sample #${x.i})`);
    const findings = rows.filter(([o, x]) => x.freeR < 0 && !/backPlate/.test(o));
    blankFindings += findings.length;
    console.log(`  → ${findings.length ? `${findings.length} wall(s) INSIDE the blank's margin (not the plate): ${findings.map(([o, x]) => `${o} ${x.freeR}`).join('; ')}` : 'no wall inside the blank\'s margin except the base plate (the recess a corner needs, A\'s precedent)'}`);
  }
  console.log('');
  const legsOk = l1.worst.freeR >= inp.LEG1_R - 1e-4 && l2.worst.freeR >= inp.LEG2_R - 1e-4;
  const boundsOk = F.missArb1 >= inp.needArb && F.missArb2 >= inp.needArb && F.missCol2 >= inp.needCol - 1e-6;
  console.log(`VERDICT at α_max ${a}°: legs ${legsOk ? 'ok' : 'SHORT'}, blanks ${blankFindings === 0 ? 'ok' : 'WALLED'}, bounds ${boundsOk ? 'ok' : 'REFUSED'}, both legs under the gate ${F.ld1 <= inp.TURN_LD_MAX && F.ld2 <= inp.TURN_LD_MAX ? 'yes' : 'NO'} (target ${F.ld1 <= inp.TURN_LD_TARGET && F.ld2 <= inp.TURN_LD_TARGET ? 'met' : 'not met — reported, not gated'})  →  ${legsOk && blankFindings === 0 && boundsOk && F.ld1 <= inp.TURN_LD_MAX && F.ld2 <= inp.TURN_LD_MAX ? 'BUILDABLE' : 'refused'}`);
} else console.log('VERDICT: no α in the scan clears the Yoke — the fold cannot be laid on this side at LEG1_R');
console.log(`boot warnings (WebGL driver noise included): ${bootWarns}`);
const outPath = process.argv[2];
if (outPath) { writeFileSync(outPath, JSON.stringify(R, null, 1)); console.log(`wrote ${outPath}`); }
await browser.close();
