#!/usr/bin/env node
// THE TWO-CORNER SETTING TRAVERSE, DESIGNED IN A LINE AGAINST THE BUILT MOVEMENT (§334 landing 3c, TODO 318) —
// acceptance, one native boot.
//
//   node --import ./tools/native/loader.mjs tools/probe-setting-traverse-line.mjs
//
// src/setting-traverse-line.js designs a traverse A → K1 → K2 → B that takes today's corner K out from under the
// keyless rocking bar (tools/probe-keyless-rocking-bar-fold.mjs row K). This probe reads the design's inputs off a
// native boot and holds the answer:
//   T0  the inputs are the build's (the published fold record, the plates' faces through tools/plate-faces.mjs)
//   T1  a design exists: leg 1 swung the least off its held heading for which every rule below holds.
//       CONTROL: on the held heading (no swing) no design exists, the chamfer argument in the module's header
//   T2  every corner is cuttable: its deflection at least FOLD_DEFLECT_MIN (the build's, re-derived here by the same
//       law) and under 90°, its blanks cut at STOCK_MIN_U or more at the module the law gives
//   T3  every leg is turnable (L/D at most TURN_LD_TARGET) and borne (two blocks by TODO 289's law, clear of its
//       corners' blanks; leg 3's B block where the build sites it)
//   T4  every corner's plate opening keeps the plate land to every piece of the bar's pocket (the bar planned with K's
//       opening set aside, as the fold probe does). CONTROL: today's K reads under it
//   T5  every leg passes the barrel's column at its own margin
//   T6  no metal of the movement stands within CLEAR_MARGIN of the new rods or the new corners' cone-distance spheres
//       (exact, meshClearance; the sphere covers a corner's blanks wherever they turn), the members the new traverse
//       replaces excepted. The reserve train is REPORTED apart: its swing is solved round the traverse at the fold
//       (§234's CAP_SOLVE), so a reserve member near the middle leg is that solve's input, not this design's defect
// REPORTS: the swing, the corners, the legs, every slack.
import { bootNative } from './native/host.mjs';

const r = await bootNative({ query: '' });
const C = r.clock, THREE = await import('three');
const I = await import('../src/inspect.js');
const L = await import('../src/layout.js');
const G = await import('../src/geometry.js');
const T = await import('../src/setting-traverse-line.js');
const { foldRockingBar } = await import('../src/keyless-rocking-bar.js');
const { plateFaces } = await import('./plate-faces.mjs');
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };
const f = (v, n = 4) => Number(v).toPrecision(n);

C.setPose({}); C.scene.updateMatrixWorld(true);
const F = C.settingFold, Bg = F.bearings, PF = plateFaces(C, THREE).base;
const A = F.A, B = F.B, Kd = F.K;
const approachU = (() => { const dx = B.x - Kd.x, dy = B.y - Kd.y, l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l }; })();
const bBlock = Bg.leg2Blocks.blocks.reduce((a, b) => (b.s > a.s ? b : a));
const bBlockFromB = Math.hypot(B.x - bBlock.centre[0], B.y - bBlock.centre[1]);
const z = F.zSetting, zCut = PF.back;
const deflMin = T.deflectMinDeg({ teeth: F.bevelTeeth, module: F.templateModule, bores: [F.leg1R, F.leg2R] });
ok('T0 the inputs are the build\'s: its FOLD_DEFLECT_MIN re-derives by the module\'s law, the traverse plane under the dial face',
  Math.abs(deflMin - F.foldDeflectMinDeg) < 1e-9 && z < zCut,
  `deflection floor ${f(deflMin, 6)}° (build ${f(F.foldDeflectMinDeg, 6)}°); plane z ${f(z)} under the dial face ${f(zCut)}; held heading ${f(F.leg1HeadingDeg)}°`);

// the bar's pocket pieces, planned with K's opening set aside (the fold probe's plan, its openings read the same way)
const byName = {}; C.scene.traverse((o) => { if (o.name && !byName[o.name]) byName[o.name] = o; });
const transfer = byName.transferWheel, spur = byName.windSpur, plate = byName.backPlate;
const T0 = transfer.getWorldPosition(new THREE.Vector3()), S = spur.getWorldPosition(new THREE.Vector3());
const ang = () => { const v = new THREE.Vector3(1, 0, 0).applyQuaternion(transfer.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(v.y, v.x); };
C.setPose({ tension: 0.5 }); C.scene.updateMatrixWorld(true); const a0 = ang();
C.setPose({ tension: 0.52 }); C.scene.updateMatrixWorld(true); let dA = ang() - a0; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
const windSenseWorld = Math.sign(dA);
C.setPose({}); C.scene.updateMatrixWorld(true);
const body = [plate, ...plate.children].find((o) => o.isMesh && o.geometry.parameters?.shapes);
const hullOf = (pts) => { const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const p of P) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
const cut = [].concat(body.geometry.parameters.shapes)[0].extractPoints(72).holes
  .map((h) => hullOf(h.map((p) => new THREE.Vector3(p.x, p.y, 0).applyMatrix4(body.matrixWorld)).map((v) => [v.x, v.y])));
const cen = (pts) => ({ x: pts.reduce((a, q) => a + q[0], 0) / pts.length, y: pts.reduce((a, q) => a + q[1], 0) / pts.length });
const near = (pts, p) => Math.hypot(cen(pts).x - p.x, cen(pts).y - p.y);
const ownBore = cut.reduce((a, o) => (near(o, T0) < near(a, T0) ? o : a));
const kBore = cut.reduce((a, o) => (near(o, Kd) < near(a, Kd) ? o : a));
const landMin = C.plateR * G.PLATE_BEVEL_F + L.STOCK_MIN_U;
const bar = foldRockingBar({ transferAt: { x: T0.x, y: T0.y }, spurAt: { x: S.x, y: S.y }, windSenseWorld, plateTopZ: PF.top, plateBackZ: PF.back,
  openings: cut.filter((o) => o !== ownBore && o !== kBore).map((pts, i) => ({ name: `opening ${i}`, pts })), landMin });
if (!bar.feasible) { console.log(`FAIL  the bar's plan (K set aside) — ${bar.why}`); process.exit(1); }
const keepOuts = bar.pockets.map((p) => ({ name: p.name, pts: p.pts }));

// the reserve train's members, each the disc it sweeps (they turn about the plate's normal): its box centre, its
// metal's farthest reach from that centre, its band
const discs = [];
C.scene.traverse((o) => { if (!o.isMesh || o.userData?.schematic) return;
  let rs = false; for (let q = o; q; q = q.parent) if (/rsv|reserve/i.test(q.name || '')) { rs = true; break; } if (!rs) return;
  o.updateWorldMatrix(true, false); const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3());
  if (bb.min.z > zCut) return;   // only what stands under the dial face, where the traverse runs
  let R = 0; const v = new THREE.Vector3(), pa = o.geometry.attributes.position;
  for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); R = Math.max(R, Math.hypot(v.x - c.x, v.y - c.y)); }
  discs.push({ name: o.name || o.parent?.name || '?', x: c.x, y: c.y, r: R, zLo: bb.min.z, zHi: bb.max.z }); });
console.log(`REPORT ${discs.length} reserve-train members as swept discs: ${discs.map((d) => `${d.name} r ${f(d.r, 3)} z ${f(d.zLo, 3)}…${f(d.zHi, 3)}`).join('; ')}`);
const inputs = { A, B, z, discs, heldHeadingDeg: F.leg1HeadingDeg, approachU, radii: [F.leg1R, F.leg2R, F.leg2R], dropBore: F.leg2R,
  teeth: F.bevelTeeth, templateModule: F.templateModule, zCut, ldMin: Bg.ldMin, wall: Bg.wall, boreClear: Bg.boreClear,
  deflMinDeg: deflMin, keepOuts, landMin, columns: [{ x: C.P.barrel.x, y: C.P.barrel.y, r: F.rsvArbExtR }], bBlockFromB };
const t0 = Date.now();
const D = T.solveTraverse(inputs);
ok('T1 a design exists', D.feasible, D.feasible
  ? `leg 1 swung ${f(D.swingDeg, 3)}° to ${f(D.headingDeg)}°; K1 (${f(D.K1.x)}, ${f(D.K1.y)}) ${f(D.t1, 3)} u out, middle heading ${f(D.midHeadingDeg)}°, K2 (${f(D.K2.x)}, ${f(D.K2.y)}); ${D.tried.exact} candidates cut, ${((Date.now() - t0) / 1000).toFixed(0)} s`
  : D.why);
{
  const H = T.solveTraverse({ ...inputs, swingMaxDeg: 0, t1Max: F.len1 });
  ok('T1 CONTROL on the held heading with K1 short of today\'s K no design exists (a chamfer, its corners under the floor)', !H.feasible, H.why || `found one at swing ${H.swingDeg}`);
}
if (!D.feasible) { console.log(`\n${fails.length} FAILED`); process.exit(1); }

// T2 corners
for (const [k, c] of Object.entries(D.corners)) {
  const thin = (() => { let t = Infinity; for (const bl of c.blanks) { void bl; }
    for (const [b, mb] of k === 'A' ? [[F.leg2R, F.leg1R], [F.leg1R, F.leg2R]] : k === 'K1' ? [[F.leg1R, F.leg2R], [F.leg2R, F.leg1R]] : [[F.leg2R, F.leg2R]]) {
      const g = G.makeConicalGear({ teeth: F.bevelTeeth, module: c.module, mateTeeth: F.bevelTeeth, shaftAngleDeg: c.shaftAngleDeg, boreR: b, mateBoreR: mb });
      g.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; t = Math.min(t, bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z); });
    } return t; })();
  const cuttable = (k === 'A' ? Math.abs(c.deflDeg - 90) < 1e-9 : c.deflDeg >= deflMin && c.deflDeg < 90) && thin >= L.STOCK_MIN_U - 1e-9;
  ok(`T2 corner ${k} is cuttable`, cuttable, `deflection ${f(c.deflDeg)}° (Σ ${f(c.shaftAngleDeg)}°), module ${f(c.module)}, thinnest blank ${f(thin)} u against ${f(L.STOCK_MIN_U)}`);
}
// T3 legs
D.legs.forEach((l, i) => ok(`T3 leg ${i + 1} is turnable and borne`, D.ld[i] <= L.TURN_LD_TARGET + 1e-9 && l.fits,
  `${f(D.lengths[i])} u at L/D ${f(D.ld[i])} (target ${L.TURN_LD_TARGET}); blocks at ${l.stations.map((s) => f(s)).join(' and ')}, spread ${l.fits ? f(l.spread) : '—'} against ${f(l.len)}${l.why ? `: ${l.why}` : ''}`));
// T4 lands
for (const k of ['A', 'K1', 'K2']) ok(`T4 corner ${k}'s opening keeps the plate land to the bar's pocket`, D.lands[k] >= landMin, `${f(D.lands[k])} u against ${f(landMin)}`);
{
  const g = Math.min(...keepOuts.map((k) => G.convexGap(kBore, k.pts)));
  ok('T4 CONTROL today\'s corner K reads under the land', g < landMin, `${f(g)} u`);
}
// T5 the column
ok('T5 every leg passes the barrel\'s column at its margin', D.col >= 0, `${f(D.col)} u past the margin`);

// T6 exact metal: the rods as cylinders, the new corners as their cone-distance spheres
const REPLACED = (n) => /^settingTraverse/.test(n) || /^mwCornerFold/.test(n) || n === 'mwCornerDropIn' || n === 'mwCornerDropOut' || n === 'backPlate';
const meshes = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData?.schematic && o.geometry?.attributes?.position) meshes.push(o); });
const unitOf = new Map(); for (const e of C.labelEntries) e.obj.traverse((o) => { if (!unitOf.has(o)) unitOf.set(o, e.name); });
const replacedUnder = (o) => { for (let p = o; p; p = p.parent) if (p.name && REPLACED(p.name)) return true; return false; };
// each rod trimmed at both ends by its corners' cone distance (the blanks own that space, and are checked as cut)
const rod = (a, b, rr, ta, tb) => { const va0 = new THREE.Vector3(a.x, a.y, z), vb0 = new THREE.Vector3(b.x, b.y, z), u = vb0.clone().sub(va0).normalize();
  const va = va0.clone().addScaledVector(u, ta), vb = vb0.clone().addScaledVector(u, -tb), len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, len, 32)); m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u); m.updateMatrixWorld(true); return m; };
// the new corners' blanks as the build cuts them (addBevelCorner's mounts: local +z along each blank's own axis)
const gears = (tag, c) => c.blanks.map((bl, i) => { const [b, mb] = tag === 'K1' ? (i ? [F.leg2R, F.leg1R] : [F.leg1R, F.leg2R]) : tag === 'A' ? (i ? [F.leg1R, F.leg2R] : [F.leg2R, F.leg1R]) : [F.leg2R, F.leg2R];
  const g = G.makeConicalGear({ teeth: F.bevelTeeth, module: c.module, mateTeeth: F.bevelTeeth, shaftAngleDeg: c.shaftAngleDeg, boreR: b, mateBoreR: mb });
  g.position.set(...bl.f.o); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...bl.f.a)); g.updateMatrixWorld(true);
  const ms = []; g.traverse((o) => { if (o.isMesh) ms.push(o); }); return [`corner ${tag} ${bl.name}`, ms]; });
const Ac = D.corners.A, K1c = D.corners.K1, K2c = D.corners.K2;
const probes = [
  ['leg 1', [rod(A, D.K1, F.leg1R, Ac.coneR, K1c.coneR)]], ['middle leg', [rod(D.K1, D.K2, F.leg2R, K1c.coneR, K2c.coneR)]],
  ['leg 3', [rod(D.K2, B, F.leg2R, K2c.coneR, K2c.coneR)]],
  ...gears('K1', K1c), ...gears('K2', K2c), gears('A', Ac)[1],
];
const rows = [];
for (const [what, ps] of probes) for (const p of ps) {
  const pb = new THREE.Box3().setFromObject(p).expandByScalar(L.CLEAR_MARGIN + 1);
  for (const o of meshes) {
    if (replacedUnder(o)) continue;
    const ob = new THREE.Box3().setFromObject(o); if (!ob.intersectsBox(pb)) continue;
    const d = I.meshClearance(p, o, 1); if (d < L.CLEAR_MARGIN) rows.push({ what, mesh: o.name || `(in ${o.parent?.name})`, unit: unitOf.get(o) || '?', d });
  }
}
const reserve = rows.filter((x) => /reserve|rsv/i.test(x.mesh) || /reserve/i.test(x.unit));
const others = rows.filter((x) => !reserve.includes(x));
ok('T6 no metal within CLEAR_MARGIN of the new rods and the new corners\' blanks as cut (the reserve train apart; its discs are in the search)', others.length === 0,
  others.length ? others.slice(0, 8).map((x) => `${x.what} ⇄ ${x.mesh} (${x.unit}) ${f(x.d)}`).join('; ') : 'none');
console.log(`REPORT the reserve train within CLEAR_MARGIN (its swing re-solves round the traverse at the fold): ${reserve.length ? reserve.map((x) => `${x.what} ⇄ ${x.mesh} ${f(x.d)}`).join('; ') : 'none'}`);
console.log(`REPORT deflections ${D.deflDeg.map((d) => f(d)).join('° and ')}°; legs ${D.lengths.map((l) => f(l)).join(' / ')} u (L/D ${D.ld.map((x) => f(x, 3)).join(' / ')}); least slack ${f(D.slack)} u (lands A ${f(D.lands.A)}, K1 ${f(D.lands.K1)}, K2 ${f(D.lands.K2)}, column ${f(D.col)})`);
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join('; ')}` : '\nall rows hold');
process.exit(fails.length ? 1 : 0);
