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
// THE SOLVE, all of it read off the metal and none of it chosen:
//   · LEG_R = (plate back face − Z_SETTING) − CLEAR_MARGIN — the section the
//     corridor's OTHER wall leaves once the reserve pinch is dodged; the same
//     "governing neighbour − margin" law SETTING_ROD_R itself was derived by,
//     with the neighbour changed by the fold from reservePinion0 to the plate.
//   · leg 2 (K→B) must MISS the reserve column in plan, because at LEG_R its
//     underside is below reservePinion0's top: D = p0's tip radius (max vertex
//     radius about the barrel axis) + LEG_R + CLEAR_MARGIN, and the barrel-arbor
//     extension's own radius + LEG_R + margin as the second bound (the larger
//     governs). Swung about B, the least such swing is
//     β = asin(D / |B − barrel|) − φ, φ the barrel's own bearing off BA.
//     That ray exists on EITHER side of the column — swing by φ − asin(D/dB)
//     to pass it on the far side from the transfer arbor, or by φ + asin(D/dB)
//     to pass it on the near side — and the first cut of this probe took the
//     smaller swing without asking what else stood there. The answer was the
//     WINDING TRANSFER ARBOR (the crown-wheel arbor, r 0.7, climbing through
//     the plate 1.92 u off the run's mid-point): K landed 0.45 u from its axis
//     and leg 2's line 0.28 u from it, and the probe read "no wall in plan"
//     because the arbor is a Keyless works member and the whole unit had been
//     excluded as ground. The skill's trap, verbatim. Now BOTH rays are solved,
//     the transfer arbor is a second closed-form bound (each leg's line must
//     pass its axis by arborR + LEG_R + CLEAR_MARGIN), and the exclusion is the
//     SEVEN meshes the fold actually replaces or re-keys — the traverse, the
//     four corner blanks at A and B, the drop and the rise — nothing else.
//   · K is the point on the chosen ray with |AK| = |KB| — the split that gives
//     both legs the same L/D, i.e. the same margin under the target; any other
//     split spends one leg's margin on the other's. The deflection at K is then
//     2β and the bevel pair's shaft angle Σ = 180° − 2β, which `bevelToothSpec`
//     takes directly (pitch angle γ = Σ/2 for equal counts).
// Nothing here is a knob: change the plate, the reserve pinion, the transfer
// arbor or the corner's counts and K moves with them.
//
// WHAT IS MEASURED (over the full pose net, `digestPoses`, for BOTH sides,
// with only the seven replaced/re-keyed meshes excluded):
//   1. CONTROL (a): the straight run A→B walked by THIS probe's segment walker
//      must reproduce the mesh-based probe's pinch (worst free r ≈ 0.382 under
//      the reserve, and 0.55 against the plate above) — otherwise the walker is
//      not seeing the metal the other instrument saw.
//   2. Leg 1 (A→K) and leg 2 (K→B), station by station, free radius split by
//      side (below / above / plan). Every station must read ≥ LEG_R; the plate
//      above reading EXACTLY LEG_R is the derivation closing, not a miss.
//   3. The corner blanks: K's two gears at their new axes, A's outboard gear
//      and B's inboard gear re-aimed along the legs — each blank sampled on its
//      tip circle and at half radius, in its own plane. Walls BELOW and IN PLAN
//      are findings; the base plate ABOVE is expected (A's corner already bores
//      the plate to its tip circle, BACK_PLATE_HOLES) and is reported as the
//      recess K needs, not as a miss.
//   4. CONTROL (b): the bevel spec at Σ must be external (γ < 90°) and cut
//      with a face width > 0 at bore LEG_R — printed, with any generator warning.
//
// NOT probe-234-shaft-body-corridor.mjs (that walks an EXISTING mesh's own
// axis; this walks CANDIDATE segments that have no mesh yet). NOT
// probe-138-fold-price.mjs (prices a conical blank against the sheared member
// it replaces at the SAME apex; K has no old member). NOT probe-173-fold.mjs
// (the sautoir anchor's fold, a different part and a 2D box scan).
//
// Usage: cd tools && node probe-234-traverse-fold.mjs [out.json]
//        env STEP=0.5 SEARCH=3.0
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8562;
const ROOT = process.env.ROOT || '..';
const STEP = +(process.env.STEP || 0.5);
const SEARCH = +(process.env.SEARCH || 3.0);

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

const R = await page.evaluate(async ({ STEP, SEARCH }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const G = await import('./src/geometry.js');
  const { CLEAR_MARGIN, TURN_LD_MAX, TURN_LD_TARGET } = await import('./src/layout.js');
  const clock = window.__clock;
  const UNIT = 'Keyless works';
  const REPLACED = new Set(['settingTraverse', 'mwCornerDropIn', 'mwCornerDropOut', 'mwCornerRiseIn', 'mwCornerRiseOut', 'settingDrop', 'settingRise']);

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
  const tr = byName.get('settingTraverse'); if (!tr) throw new Error('settingTraverse not found');
  tr.updateWorldMatrix(true, false);
  const m = tr.matrixWorld.elements;
  const axis = new THREE.Vector3(m[4], m[5], m[6]).normalize();
  const cen = new THREE.Vector3(m[12], m[13], m[14]);
  const half = tr.geometry.parameters.height / 2;
  const rodR = tr.geometry.parameters.radiusTop;
  const e1 = cen.clone().addScaledVector(axis, -half), e2 = cen.clone().addScaledVector(axis, half);
  const drop = byName.get('settingDrop'); drop.updateWorldMatrix(true, false);
  const dropP = new THREE.Vector3().setFromMatrixPosition(drop.matrixWorld);
  const dxy = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const [A, B] = dxy(e1, dropP) < dxy(e2, dropP) ? [e1, e2] : [e2, e1];
  const Z = A.z;
  const plate = byName.get('backPlate'); if (!plate) throw new Error('backPlate not found');
  const plateBack = new THREE.Box3().setFromObject(plate).min.z;
  const LEG_R = (plateBack - Z) - CLEAR_MARGIN;
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
  // ---- the solve ----
  const p0Binds = (Z - LEG_R) < p0Top + CLEAR_MARGIN;   // at LEG_R the leg's underside is below p0's top: its TIP circle must be missed in plan
  const D_p0 = p0Tip + LEG_R + CLEAR_MARGIN, D_ext = extR + LEG_R + CLEAR_MARGIN;
  const D = Math.max(p0Binds ? D_p0 : 0, D_ext);
  const u = B.clone().sub(A); const Lab = u.length(); u.normalize();
  const n = new THREE.Vector3(-u.y, u.x, 0);
  const across = (barrel.x - A.x) * n.x + (barrel.y - A.y) * n.y;   // barrel's side of AB, signed
  const along = (barrel.x - A.x) * u.x + (barrel.y - A.y) * u.y;
  const dB = Math.hypot(barrel.x - B.x, barrel.y - B.y);
  const BA = A.clone().sub(B).normalize();
  const toBar = new THREE.Vector3(barrel.x - B.x, barrel.y - B.y, 0).normalize();
  const phi = Math.acos(Math.min(1, Math.max(-1, BA.dot(toBar))));
  const needArb = tArbR + LEG_R + CLEAR_MARGIN;
  const distLine = (P, Q, X) => { const d = Q.clone().sub(P); const L = d.length(); d.normalize(); return Math.abs((X.x - P.x) * -d.y + (X.y - P.y) * d.x); };
  const teeth = 10, module = 0.3; // BEVEL_TEETH / BEVEL_MODULE — the motion-works corners' counts (read as the shipped gears' pitch: below)
  const gearA = byName.get('mwCornerDropOut');
  const shippedPitchR = gearA?.parent?.userData?.r ?? null;
  const barrelSide = across >= 0 ? 1 : -1;   // which side of AB the barrel column stands on
  const solveSide = (side) => {
    // side = the side of AB that K swings to. Passing the column on the side AWAY
    // from K is the small swing (asin − φ); passing it on K's own side is the
    // large one (asin + φ). φ is the column's bearing off BA, on barrelSide.
    const beta = side === barrelSide ? Math.asin(D / dB) + phi : Math.asin(D / dB) - phi;
    const ell = (Lab / 2) / Math.cos(beta);
    const K = A.clone().addScaledVector(u, Lab / 2).addScaledVector(n, side * (Lab / 2) * Math.tan(beta));
    const sigmaDeg = 180 - 2 * (beta * 180 / Math.PI);
    const leg1 = K.clone().sub(A).normalize(), leg2 = B.clone().sub(K).normalize();
    const specWarns = [];
    const origWarn = console.warn; console.warn = (m) => specWarns.push(String(m));
    const spec = G.bevelToothSpec({ module, teeth, mateTeeth: teeth, shaftAngleDeg: sigmaDeg, boreR: LEG_R, mateBoreR: LEG_R });
    console.warn = origWarn;
    const gammaDeg = Math.atan2(Math.sin(sigmaDeg * Math.PI / 180), 1 + Math.cos(sigmaDeg * Math.PI / 180)) * 180 / Math.PI;
    return { side, betaDeg: beta * 180 / Math.PI, K: K.toArray(), ell, legLen1: A.distanceTo(K), legLen2: K.distanceTo(B),
      missBarrel2: distLine(K, B, new THREE.Vector3(barrel.x, barrel.y, 0)), missBarrel1: distLine(A, K, new THREE.Vector3(barrel.x, barrel.y, 0)),
      missArb1: distLine(A, K, tArbXY), missArb2: distLine(K, B, tArbXY), needArb,
      sigmaDeg, gammaDeg, ldLeg: ell / (2 * LEG_R), ldLegAtRodR: ell / (2 * rodR),
      spec: Object.fromEntries(Object.entries(spec).filter(([, x]) => typeof x === 'number')), specWarns, K3: K, leg1, leg2 };
  };
  const sides = { plus: solveSide(1), minus: solveSide(-1) };
  const spec90 = G.bevelToothSpec({ module, teeth, mateTeeth: teeth, shaftAngleDeg: 90, boreR: LEG_R, mateBoreR: LEG_R, quiet: true });
  // the transfer arbor's own bearing off the run, for the record
  const arbAlong = (tArbXY.x - A.x) * u.x + (tArbXY.y - A.y) * u.y, arbAcross = (tArbXY.x - A.x) * n.x + (tArbXY.y - A.y) * n.y;

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
  // sets of sample points, each a { pts: [Vector3], rows } — all scanned in ONE pass over the pose net
  const sets = {};
  const addSet = (key, pts, meta) => { sets[key] = { meta, pts, rows: pts.map((p, i) => ({ i, p: [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)], gap: Infinity, owner: null, poseIdx: null, dir: null, below: fresh(), above: fresh(), plan: fresh() })) }; };
  const segPts = (P, Q) => { const L = P.distanceTo(Q), d = Q.clone().sub(P).normalize(); const pts = []; for (let t = 0; t <= L + 1e-9; t += STEP) pts.push(P.clone().addScaledVector(d, Math.min(t, L))); if (L - (pts.length - 1) * STEP > 1e-6) pts.push(Q.clone()); return pts; };
  addSet('lineAB', segPts(A, B), { kind: 'control', from: 'A', to: 'B', r: rodR });
  // blank samples: the tip circle and the half-radius circle in the plane ⟂ the gear's axis, 24 azimuths each
  const blankPts = (c, ax, tipR) => { const a = ax.clone().normalize(); const t1 = Math.abs(a.z) < 0.9 ? new THREE.Vector3(0, 0, 1).cross(a).normalize() : new THREE.Vector3(1, 0, 0).cross(a).normalize(); const t2 = a.clone().cross(t1).normalize(); const pts = []; for (const rr of [tipR, tipR / 2]) for (let k = 0; k < 24; k++) { const th = (k / 24) * 2 * Math.PI; pts.push(c.clone().addScaledVector(t1, rr * Math.cos(th)).addScaledVector(t2, rr * Math.sin(th))); } return pts; };
  for (const [tag, S] of Object.entries(sides)) {
    addSet(`${tag}:leg1`, segPts(A, S.K3), { kind: 'leg', side: tag, from: 'A', to: 'K', r: LEG_R });
    addSet(`${tag}:leg2`, segPts(S.K3, B), { kind: 'leg', side: tag, from: 'K', to: 'B', r: LEG_R });
    addSet(`${tag}:blankK_in`, blankPts(S.K3, S.leg1, S.spec.tipR), { kind: 'blank', side: tag, at: 'K', axis: 'leg1' });
    addSet(`${tag}:blankK_out`, blankPts(S.K3, S.leg2, S.spec.tipR), { kind: 'blank', side: tag, at: 'K', axis: 'leg2' });
    addSet(`${tag}:blankA_out`, blankPts(A, S.leg1, spec90.tipR), { kind: 'blank', side: tag, at: 'A', axis: 'leg1' });
    addSet(`${tag}:blankB_in`, blankPts(B, S.leg2, spec90.tipR), { kind: 'blank', side: tag, at: 'B', axis: 'leg2' });
  }
  const allPts = Object.values(sets).flatMap((s) => s.rows.map((r, i) => ({ s, r, p: s.pts[i] })));
  const bbox = new THREE.Box3(); for (const q of allPts) bbox.expandByPoint(q.p);
  const bc = bbox.getCenter(new THREE.Vector3()), br = bbox.getSize(new THREE.Vector3()).length() / 2;
  const probeMat = new THREE.Matrix4();
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
        const owner = `${unitOf.get(o) || '?'} / ${nameOf(o)}`;
        if (d < q.r[key].gap) q.r[key] = { gap: d, owner, poseIdx: pi };
        if (d < best) { best = d; bestOwner = owner; bestVec = vv; }
      }
      if (best < q.r.gap) { q.r.gap = best; q.r.owner = bestOwner; q.r.poseIdx = pi; q.r.dir = Math.abs(bestVec.dz) > Math.hypot(bestVec.dx, bestVec.dy) ? (bestVec.dz < 0 ? 'z-' : 'z+') : 'xy'; }
    }
  }
  clock.scene.remove(probe); probeGeom.dispose();
  const free = (g) => (isFinite(g) ? +(PROBE_R + g - CLEAR_MARGIN).toFixed(4) : null);
  const out = {};
  for (const [k, s] of Object.entries(sets)) {
    out[k] = { meta: s.meta, rows: s.rows.map((r) => ({ i: r.i, p: r.p, freeR: free(r.gap), owner: r.owner, poseIdx: r.poseIdx, dir: r.dir, below: { freeR: free(r.below.gap), owner: r.below.owner }, above: { freeR: free(r.above.gap), owner: r.above.owner }, plan: { freeR: free(r.plan.gap), owner: r.plan.owner } })) };
  }
  return {
    inputs: { A: A.toArray(), B: B.toArray(), Lab, rodR, plateBack, LEG_R, barrel, p0Tip, p0Top, extR, p0Binds, D_p0, D_ext, D, dB, phiDeg: phi * 180 / Math.PI, along, across, barrelSide, tArbXY: [tArbXY.x, tArbXY.y], tArbR, arbAlong, arbAcross, needArb, CLEAR_MARGIN, TURN_LD_MAX, TURN_LD_TARGET, shippedPitchR, spec90tipR: spec90.tipR, poseCount: poses.length },
    sides: Object.fromEntries(Object.entries(sides).map(([k, S]) => [k, { ...S, K3: undefined, leg1: undefined, leg2: undefined }])),
    sets: out,
  };
}, { STEP, SEARCH });

const f4 = (x) => (x == null ? '—' : (+x).toFixed(4));
const inp = R.inputs;
console.log('§234 — the setting traverse FOLD, solved off the metal on both sides and measured over the pose net');
console.log(`  A ${inp.A.map(f4).join(', ')}   B ${inp.B.map(f4).join(', ')}   |AB| ${f4(inp.Lab)}   shipped rod r ${f4(inp.rodR)} (L/D ${(inp.Lab / (2 * inp.rodR)).toFixed(1)})`);
console.log(`  plate back face z ${f4(inp.plateBack)} → LEG_R = (${f4(inp.plateBack)} − ${f4(inp.A[2])}) − ${inp.CLEAR_MARGIN} = ${f4(inp.LEG_R)}`);
console.log(`  barrel (${f4(inp.barrel.x)}, ${f4(inp.barrel.y)}): along ${f4(inp.along)}, across ${f4(inp.across)} of AB (side ${inp.barrelSide}); p0 tip r ${f4(inp.p0Tip)}, top z ${f4(inp.p0Top)} (binds at LEG_R: ${inp.p0Binds}); arbor ext r ${f4(inp.extR)}`);
console.log(`  D = max(p0 ${f4(inp.D_p0)}, ext ${f4(inp.D_ext)}) = ${f4(inp.D)};  |B−barrel| ${f4(inp.dB)}, φ ${inp.phiDeg.toFixed(3)}°`);
console.log(`  transfer arbor (${f4(inp.tArbXY[0])}, ${f4(inp.tArbXY[1])}) r ${f4(inp.tArbR)}: along ${f4(inp.arbAlong)}, across ${f4(inp.arbAcross)} of AB — each leg's line must pass it by ${f4(inp.needArb)}`);
console.log('');
for (const [tag, S] of Object.entries(R.sides)) {
  console.log(`SIDE ${tag} (K on the ${S.side > 0 ? '+n' : '−n'} side of AB):  β ${S.betaDeg.toFixed(3)}°  K (${S.K.map(f4).join(', ')})  legs ${f4(S.legLen1)} / ${f4(S.legLen2)}  Σ ${S.sigmaDeg.toFixed(2)}° γ ${S.gammaDeg.toFixed(2)}°  L/D ${S.ldLeg.toFixed(2)} at LEG_R (${S.ldLegAtRodR.toFixed(2)} at 0.382)`);
  console.log(`  closed-form bounds: leg 2 passes the barrel axis at ${f4(S.missBarrel2)} (need ${f4(inp.D)}: ${S.missBarrel2 >= inp.D - 1e-6 ? 'ok' : 'MISS'}); leg 1 at ${f4(S.missBarrel1)}; transfer arbor — leg 1 ${f4(S.missArb1)}, leg 2 ${f4(S.missArb2)} (need ${f4(inp.needArb)}: ${S.missArb1 >= inp.needArb && S.missArb2 >= inp.needArb ? 'ok' : 'REFUSED'})`);
  console.log(`  bevel spec at Σ, bore LEG_R: tipR ${f4(S.spec.tipR)} (90° mitre ${f4(inp.spec90tipR)}), coneR ${f4(S.spec.coneR)}, faceW ${f4(S.spec.faceW)}, pitchR ${f4(S.spec.pitchR)} (shipped ${f4(inp.shippedPitchR)}); CONTROL (b) external and cut: ${S.gammaDeg < 90 && S.spec.faceW > 0 && S.specWarns.length === 0 ? 'PASS' : 'FAIL'} ${S.specWarns.join(' | ')}`);
}
console.log('');
const table = (key, title, r) => {
  const s = R.sets[key];
  console.log(`${title} (${s.rows.length} stations, r ${f4(r)})`);
  console.log('   i     x        y        z      freeR   owner                                      dir  below    above    plan');
  for (const row of s.rows) console.log(`  ${String(row.i).padStart(3)} ${row.p.map((x) => x.toFixed(3).padStart(8)).join(' ')}  ${String(row.freeR).padStart(7)}  ${String(row.owner).padEnd(42)} ${String(row.dir).padEnd(4)} ${String(row.below.freeR).padStart(7)} ${String(row.above.freeR).padStart(7)} ${String(row.plan.freeR).padStart(7)}`);
  const pick = (f) => s.rows.reduce((a, b) => ((f(b) ?? Infinity) < (f(a) ?? Infinity) ? b : a), s.rows[0]);
  const worst = pick((x) => x.freeR), wb = pick((x) => x.below.freeR), wa = pick((x) => x.above.freeR), wp = pick((x) => x.plan.freeR);
  console.log(`  worst: freeR ${worst.freeR} at #${worst.i} (${worst.owner}, ${worst.dir}); below ${wb.below.freeR} (${wb.below.owner}); above ${wa.above.freeR} (${wa.above.owner}); plan ${wp.plan.freeR} (${wp.plan.owner})`);
  console.log('');
  return { worst, wb, wa, wp };
};
const ctl = table('lineAB', 'CONTROL (a): the straight run A→B, this walker', inp.rodR);
const okA = ctl.worst.freeR != null && Math.abs(ctl.worst.freeR - inp.rodR) < 0.02 && ctl.wa.above.freeR != null && Math.abs(ctl.wa.above.freeR - inp.LEG_R) < 0.02;
console.log(`CONTROL (a) reproduces the pinch (worst ${ctl.worst.freeR} ≈ shipped r ${f4(inp.rodR)}) and the plate cap (above ${ctl.wa.above.freeR} ≈ LEG_R ${f4(inp.LEG_R)}): ${okA ? 'PASS' : 'FAIL — the walker is not seeing what probe-234-shaft-body-corridor saw'}`);
console.log('');
const verdict = {};
for (const tag of Object.keys(R.sides)) {
  const l1 = table(`${tag}:leg1`, `SIDE ${tag} — LEG 1: A → K`, inp.LEG_R), l2 = table(`${tag}:leg2`, `SIDE ${tag} — LEG 2: K → B`, inp.LEG_R);
  const legs = [['leg 1', l1], ['leg 2', l2]];
  for (const [name, l] of legs) console.log(`SIDE ${tag} ${name} at LEG_R ${f4(inp.LEG_R)}: worst freeR ${l.worst.freeR} → ${l.worst.freeR >= inp.LEG_R - 1e-4 ? 'CLEARS' : `SHORT by ${(inp.LEG_R - l.worst.freeR).toFixed(4)} (${l.worst.owner}, ${l.worst.dir})`}`);
  let blankFindings = 0;
  for (const [key, title] of [['blankK_in', 'K, inboard blank (axis leg 1)'], ['blankK_out', 'K, outboard blank (axis leg 2)'], ['blankA_out', 'A, outboard blank re-aimed along leg 1'], ['blankB_in', 'B, inboard blank re-aimed along leg 2']]) {
    const s = R.sets[`${tag}:${key}`];
    const byOwner = new Map();
    for (const r of s.rows) for (const side of ['below', 'above', 'plan']) { const o = r[side].owner; if (!o) continue; const cur = byOwner.get(o); const fr = r[side].freeR; if (!cur || fr < cur.freeR) byOwner.set(o, { freeR: fr, side, i: r.i }); }
    const rows = [...byOwner.entries()].sort((a, b) => a[1].freeR - b[1].freeR);
    console.log(`SIDE ${tag} BLANK ${title}: ${rows.length} neighbours within ${SEARCH}`);
    for (const [o, x] of rows) console.log(`    ${String(x.freeR).padStart(8)}  ${x.side.padEnd(5)}  ${o}   (sample #${x.i})`);
    const findings = rows.filter(([o, x]) => x.freeR < 0 && !/backPlate/.test(o));
    blankFindings += findings.length;
    console.log(`  → ${findings.length ? `${findings.length} wall(s) INSIDE the blank's margin (not the plate): ${findings.map(([o, x]) => `${o} ${x.freeR}`).join('; ')}` : 'no wall inside the blank\'s margin except the base plate (the recess a corner needs, A\'s precedent)'}`);
  }
  verdict[tag] = { legs: legs.every(([, l]) => l.worst.freeR >= inp.LEG_R - 1e-4), blanks: blankFindings === 0, bounds: R.sides[tag].missArb1 >= inp.needArb && R.sides[tag].missArb2 >= inp.needArb };
  console.log('');
}
console.log('VERDICT per side (legs clear at LEG_R / blanks clear of everything but the plate / closed-form bounds):');
for (const [tag, v] of Object.entries(verdict)) console.log(`  ${tag}: legs ${v.legs ? 'ok' : 'SHORT'}, blanks ${v.blanks ? 'ok' : 'WALLED'}, bounds ${v.bounds ? 'ok' : 'REFUSED'}  →  ${v.legs && v.blanks && v.bounds ? 'BUILDABLE' : 'refused'}`);
console.log(`boot warnings (WebGL driver noise included): ${bootWarns}`);
const outPath = process.argv[2];
if (outPath) { writeFileSync(outPath, JSON.stringify(R, null, 1)); console.log(`wrote ${outPath}`); }
await browser.close();
