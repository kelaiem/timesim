// TODO 289 — DOES ANYTHING BEAR THE SETTING FOLD'S SHAFTS? Before this item no rod of the motion-works fold ran in
// anything: each blank was keyed to a rod whose only other constraint was the bevel mesh at its far end. The tail
// — the tilted rise, the stub and the cap arbor — now runs in three plain bushes hung from the base plate and a
// jewel over the cap; the two traverses still do not (the item's residue, REPORTED here, never passed).
//
// GATES (exit non-zero), every one on the cut metal at the rest pose (the battery holds the pose net):
//   · FIT — each tail journal reads its bush at the running fit: PIVOT_BORE_CLEAR less at most the bore polygon's
//     sag (ringGeo's RING_GEO_SEG sides), never more and never a foul; the cap arbor reads its jewel's stone the same;
//   · HELD — each bush touches its arm, each arm its column, each column the base plate (planted: contact), and the
//     rise's pivot is one body with its rod (contact);
//   · CLEAR — every bearing part stands CLEAR_MARGIN off every mesh outside the fold, and off every fold blank;
//   · LAW — the published record (__clock.settingFold.bearings) re-derives: bore = journal + PIVOT_BORE_CLEAR, wall
//     = STOCK_MIN_U, the stub's bush 2× its larger overhang (or the journal's diameter), the cap's bush the journal's
//     diameter (straddled), the rise's bush the lesser of its rule and the dial band, the rise's pivot inside the band
//     by the margin, the stub's ends reaching its blanks' webs, each arm at least a section long, each column let the
//     seat into the plate.
// CONTROLS: the must-miss — a bush read against a rod it does NOT bear is over the margin (a fit reading that
// cannot miss measures nothing); the must-hit — the column ⇄ plate contact the HELD gate needs reads ≤ 0.
// REPORTED: the two traverses' nearest metal (over the margin: borne by nothing), and the achieved overhang ratio
// of each bush against the 2× rule (the rise's is capped by the dial band and is TODO 289's filed residue).
//   node tools/probe-fold-bearings.mjs ['<query>']      (one boot through boot-form.mjs)
import { bootForm } from './boot-form.mjs';
const q = process.argv[2] ?? '';
const expr = `(async () => {
  const C = window.__clock, I = await import('./src/inspect.js'), L = await import('./src/layout.js');
  const RODS = ['settingDrop', 'settingTraverse1', 'settingTraverse2', 'settingRise', 'settingRisePivot', 'settingStub', 'settingCapArbor'];
  const BLANKS = ['mwCornerDropIn','mwCornerDropOut','mwCornerFoldIn','mwCornerFoldOut','mwCornerRiseIn','mwCornerRiseOut',
    'mwCornerFootIn','mwCornerFootOut','mwCornerCapIn','mwCornerCapOut','settingCap'];
  const BEARINGS = ['settingRiseBush', 'settingRiseArm', 'settingRiseColumn', 'settingStubBush', 'settingStubArm', 'settingStubColumn',
    'settingCapBush', 'settingCapArm', 'settingCapColumn', 'settingCapJewel'];
  const FOLD = new Set([...RODS, ...BLANKS, ...BEARINGS]);
  const meshes = [], mine = {};
  C.scene.updateMatrixWorld(true);
  C.scene.traverse((o) => { if (!o.isMesh) return; let p = o; while (p) { if (p.userData?.schematic) return; p = p.parent; }
    if (FOLD.has(o.name)) { (mine[o.name] = mine[o.name] ?? []).push(o); } else meshes.push(o); });
  const unitOf = (o) => { let p = o; while (p) { const e = C.labelEntries.find((e) => e.obj === p); if (e) return e.name; p = p.parent; } return o.name || '?'; };
  const one = (n) => (mine[n] ?? [])[0];
  const d = (a, b) => { let m = Infinity; for (const x of (mine[a] ?? [])) for (const y of (mine[b] ?? [])) m = Math.min(m, I.meshClearance(x, y)); return m; };
  const nearest = (n, k = 4) => { const out = []; for (const m of (mine[n] ?? [])) for (const o of meshes) { const v = I.meshClearance(m, o, 2.0); if (v < 2.0) out.push({ d: +v.toFixed(4), mesh: o.name || o.geometry.type, unit: unitOf(o) }); } return out.sort((a, b) => a.d - b.d).slice(0, k); };
  const plate = meshes.filter((o) => o.name === 'backPlate');
  const toPlate = (n) => { let m = Infinity; for (const x of (mine[n] ?? [])) for (const p of plate) m = Math.min(m, I.meshClearance(x, p)); return m; };
  const rod = (n) => { const m = one(n); if (!m) return null; const g = m.geometry.parameters; const u = new m.position.constructor(0, 1, 0).applyQuaternion(m.getWorldQuaternion(new m.quaternion.constructor()));
    const c = m.getWorldPosition(new m.position.constructor()); return { r: g.radiusTop, len: g.height, LD: g.height / (2 * g.radiusTop), centre: [c.x, c.y, c.z], dir: [u.x, u.y, u.z] }; };
  const missing = [...FOLD].filter((n) => !mine[n]);
  const rec = C.settingFold.bearings, leg = C.settingFold.capLeg;
  // CLEAR: every bearing part against every mesh outside the fold, and against every fold blank
  const clear = [];
  // declared: the columns planted in the plate, the jewel housed in it, the arbor's pivot in the jewel's recess (PLATE_SEATS)
  const DECLARED = new Set(['settingRiseColumn|backPlate', 'settingStubColumn|backPlate', 'settingCapColumn|backPlate', 'settingCapJewel|backPlate']);
  for (const n of BEARINGS) { for (const o of nearest(n, 3)) if (!DECLARED.has(n + '|' + o.mesh)) clear.push({ a: n, b: o.mesh + ' (' + o.unit + ')', d: o.d, kind: 'outside' });
    for (const b of BLANKS) { const v = d(n, b); if (isFinite(v)) clear.push({ a: n, b, d: +v.toFixed(4), kind: 'blank' }); } }
  for (const b of BLANKS) { const v = d('settingRisePivot', b); if (isFinite(v)) clear.push({ a: 'settingRisePivot', b, d: +v.toFixed(4), kind: 'blank' }); }
  return {
    missing, rec, leg: leg && { phiDeg: leg.phiDeg, stub: leg.stub, sigmaEDeg: leg.sigmaEDeg, E: leg.E, D: leg.D, zCap: leg.zCap, zCapCorner: leg.zCapCorner },
    consts: { CLEAR_MARGIN: L.CLEAR_MARGIN, PIVOT_BORE_CLEAR: L.PIVOT_BORE_CLEAR, STOCK_MIN_U: L.STOCK_MIN_U, Z_DIAL: L.Z_DIAL, TURN_LD_TARGET: L.TURN_LD_TARGET },
    rods: Object.fromEntries(RODS.map((n) => [n, rod(n)])),
    fit: { rise: d('settingRisePivot', 'settingRiseBush'), stub: d('settingStub', 'settingStubBush'), cap: d('settingCapArbor', 'settingCapBush'), jewel: d('settingCapArbor', 'settingCapJewel') },
    held: { pivot: d('settingRise', 'settingRisePivot'),
      riseArm: d('settingRiseBush', 'settingRiseArm'), riseCol: d('settingRiseArm', 'settingRiseColumn'), risePlate: toPlate('settingRiseColumn'),
      stubArm: d('settingStubBush', 'settingStubArm'), stubCol: d('settingStubArm', 'settingStubColumn'), stubPlate: toPlate('settingStubColumn'),
      capArm: d('settingCapBush', 'settingCapArm'), capCol: d('settingCapArm', 'settingCapColumn'), capPlate: toPlate('settingCapColumn'), jewelPlate: toPlate('settingCapJewel'), arborPlate: toPlate('settingCapArbor') },
    control: { mustMiss: d('settingRiseBush', 'settingStub'), mustMiss2: d('settingStubBush', 'settingCapArbor') },
    jewelInside: await (async () => {   // parity: a ray from the collar's mid-height crosses the plate's surfaces an odd number of times when it starts inside
      const j = one('settingCapJewel'); if (!j) return null;
      const c = j.getWorldPosition(new j.position.constructor()); c.z = rec.jewelZ + 0.2;
      const THREE = await import('/vendor/three.module.js');
      const rc = new THREE.Raycaster(c, new THREE.Vector3(0, 0, 1));
      // parity PER MESH: the slab and a pocket's floor are two closed solids sharing a face plane, so a ray through
      // both crosses an even number of surfaces while starting inside one of them
      // …and Mesh.raycast skips back faces under FrontSide, which is every face a ray leaving a solid from inside meets:
      // cast double-sided (the material is shared; restored after)
      const sides = plate.map((p) => p.material.side); plate.forEach((p) => { p.material.side = THREE.DoubleSide; });
      try { return plate.some((p) => rc.intersectObject(p, false).length % 2 === 1); }
      finally { plate.forEach((p, i) => { p.material.side = sides[i]; }); }
    })(),
    clear: clear.sort((a, b) => a.d - b.d),
    traverses: { settingTraverse1: nearest('settingTraverse1', 3), settingTraverse2: nearest('settingTraverse2', 3), settingDrop: nearest('settingDrop', 3) },
    ringSeg: ${/* RING_GEO_SEG, main.js: the bush bore is a 40-gon */ 40},
  };
})()`;
const r = await bootForm(q, expr);
if (r.bootError) { console.log('BOOT ERROR', r.bootError); process.exit(1); }
if (r.unknownKeys?.length) { console.log(`UNKNOWN QUERY KEY(S): ${r.unknownKeys.join(', ')} — this boot is NOT the spec you asked for`); process.exit(1); }
const X = r.extra, K = X.consts, m = K.CLEAR_MARGIN;
let bad = 0;
const row = (ok, what, detail) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ' — ' + detail : ''}`); if (!ok) bad++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
console.log(`TODO 289 — THE SETTING FOLD'S BEARINGS (φ ${X.leg?.phiDeg.toFixed(3)}°, stub ${X.leg?.stub.toFixed(4)}, Σ_E ${X.leg?.sigmaEDeg.toFixed(3)}°)`);
row(!X.missing.length, 'every fold member built', X.missing.length ? 'missing ' + X.missing.join(', ') : '');
row(!!X.rec, 'the bearings record is published (__clock.settingFold.bearings)');
if (!X.rec || X.missing.length) { console.log('FAIL — the build has no tail bearings'); process.exit(1); }
const R = X.rec;
console.log('\nFIT — each journal in its bush at the running fit (PIVOT_BORE_CLEAR less the bore polygon\'s sag at most):');
const sagOf = (bore) => bore * (1 - Math.cos(Math.PI / X.ringSeg));
for (const [k, fit, bore] of [['rise pivot ⇄ bush', X.fit.rise, R.risePivotR + K.PIVOT_BORE_CLEAR], ['stub ⇄ bush', X.fit.stub, 0.382 + K.PIVOT_BORE_CLEAR], ['cap arbor ⇄ bush', X.fit.cap, 0.382 + K.PIVOT_BORE_CLEAR]])
  row(fit <= K.PIVOT_BORE_CLEAR + 1e-6 && fit >= K.PIVOT_BORE_CLEAR - sagOf(bore) - 1e-6, k, `${fit.toFixed(4)} (fit ${K.PIVOT_BORE_CLEAR}, sag ≤ ${sagOf(bore).toFixed(4)})`);
row(X.fit.jewel <= K.PIVOT_BORE_CLEAR + 1e-6 && X.fit.jewel >= K.PIVOT_BORE_CLEAR - 0.02, 'cap arbor ⇄ jewel stone', `${X.fit.jewel.toFixed(4)} (ringExtrude\'s hole, fit ${K.PIVOT_BORE_CLEAR})`);
console.log('\nHELD — welds, seats and the plate:');
for (const [k, v, what] of [['pivot ⇄ rise rod', X.held.pivot, 'one body'], ['rise bush ⇄ arm', X.held.riseArm, 'weld'], ['rise arm ⇄ column', X.held.riseCol, 'weld'], ['rise column ⇄ plate', X.held.risePlate, 'planted'],
  ['stub bush ⇄ arm', X.held.stubArm, 'weld'], ['stub arm ⇄ column', X.held.stubCol, 'weld'], ['stub column ⇄ plate', X.held.stubPlate, 'planted'],
  ['cap bush ⇄ arm', X.held.capArm, 'weld'], ['cap arm ⇄ column', X.held.capCol, 'weld'], ['cap column ⇄ plate', X.held.capPlate, 'planted'],
  ['cap arbor ⇄ plate', X.held.arborPlate, 'the upper pivot in the jewel\'s recess']])
  row(v <= 1e-6, `${k} (${what})`, v.toFixed(4));
row(X.jewelInside === true, 'jewel housed: its collar stands inside the plate\'s metal (parity ray)', `surface distance ${X.held.jewelPlate.toFixed(4)}`);
console.log('\nCONTROL — the fit reading can miss:');
row(X.control.mustMiss >= m, 'must-miss: rise bush ⇄ stub (a rod it does not bear)', X.control.mustMiss.toFixed(4));
row(X.control.mustMiss2 >= m, 'must-miss: stub bush ⇄ cap arbor', X.control.mustMiss2.toFixed(4));
row(X.held.risePlate <= 0 && X.held.stubPlate <= 0 && X.held.capPlate <= 0, 'must-hit: every column reads contact with the plate');
console.log(`\nCLEAR — every bearing part ⇄ every mesh outside the fold and every fold blank, CLEAR_MARGIN ${m} (rest pose; the battery holds the pose net):`);
for (const c of X.clear.slice(0, 12)) row(c.d >= m - 1e-6, `${c.a} ⇄ ${c.b}`, `${c.d.toFixed(4)} (${c.kind})`);
for (const c of X.clear.slice(12)) if (c.d < m - 1e-6) row(false, `${c.a} ⇄ ${c.b}`, `${c.d.toFixed(4)} (${c.kind})`);
console.log('\nLAW — the record re-derived:');
row(near(R.wall, K.STOCK_MIN_U) && near(R.boreClear, K.PIVOT_BORE_CLEAR) && near(R.hangerS, K.STOCK_MIN_U) && near(R.seat, K.STOCK_MIN_U), 'wall, bore clearance, hanger section and seat are STOCK_MIN_U / PIVOT_BORE_CLEAR', `${R.wall.toFixed(4)} ${R.boreClear} ${R.hangerS.toFixed(4)} ${R.seat.toFixed(4)}`);
row(near(R.stubBush.len, Math.max(2 * 0.382 * R.ldMin, R.overhangK * R.overhang.stub)), 'stub bush = max(journal ⌀, 2 × overhang)', `${R.stubBush.len.toFixed(4)} vs overhang ${R.overhang.stub.toFixed(4)}`);
row(near(R.capBushLen, 2 * 0.382 * R.ldMin), 'cap bush = the journal\'s diameter (straddled between jewel and bush)', R.capBushLen.toFixed(4));
row(near(R.riseBushLen, Math.min(Math.max(2 * R.risePivotR * R.ldMin, R.overhangK * R.overhang.rise), R.riseRoom - R.riseS0)), 'rise bush = min(its rule, the dial band)', `${R.riseBushLen.toFixed(4)} (rule ${(R.overhangK * R.overhang.rise).toFixed(4)}, band ${(R.riseRoom - R.riseS0).toFixed(4)})`);
const riseEndZ = X.leg.E[2] - (R.riseS0 + R.riseBushLen) * Math.cos(X.leg.phiDeg * Math.PI / 180);
row(riseEndZ >= K.Z_DIAL + m - 1e-6, 'the rise\'s pivot ends inside the dial band by the margin', `${riseEndZ.toFixed(4)} vs ${(K.Z_DIAL + m).toFixed(4)}`);
for (const k of ['rise', 'stub', 'cap']) row(R.hangers[k].armLen >= R.hangerS - 1e-9, `${k} hanger's arm at least a section long`, R.hangers[k].armLen.toFixed(4));
row(near(X.rods.settingRisePivot.r, R.risePivotR) && X.rods.settingRisePivot.r <= 0.382, 'the rise\'s pivot is cut at the solved radius, a shoulder on the rod', X.rods.settingRisePivot.r.toFixed(4));
row(X.rods.settingStub.len <= X.leg.stub - R.stubStart - R.stubEnd + 1e-6 && X.rods.settingStub.len >= X.leg.stub - R.stubStart - R.stubEnd - 1e-6, 'the stub is cut between its two clearances', `${X.rods.settingStub.len.toFixed(4)} = ${X.leg.stub.toFixed(4)} − ${R.stubStart.toFixed(4)} − ${R.stubEnd.toFixed(4)}`);
console.log('\nREPORT — the overhung-bevel rule, achieved (bearing spread / overhang, rule 2×):');
console.log(`  rise  ${(R.riseBushLen / R.overhang.rise).toFixed(2)}×  (bush ${R.riseBushLen.toFixed(3)}, overhang ${R.overhang.rise.toFixed(3)}; the dial band caps the bush — TODO 289 residue)`);
console.log(`  stub  ${(R.stubBush.len / R.overhang.stub).toFixed(2)}×  (bush ${R.stubBush.len.toFixed(3)}, overhang ${R.overhang.stub.toFixed(3)})`);
console.log(`  cap   straddled (jewel to bush ${(X.rods.settingCapArbor.len).toFixed(3)} of arbor)`);
console.log('\nREPORT — the two traverses and the drop, borne by nothing (TODO 289 residue): nearest metal outside the fold');
for (const [k, v] of Object.entries(X.traverses)) console.log(`  ${k.padEnd(18)} r ${X.rods[k].r.toFixed(3)} L/D ${X.rods[k].LD.toFixed(1)}: ${v.map((n) => `${n.d.toFixed(4)} ${n.mesh} (${n.unit})`).join(' | ')}`);
console.log(`\n${r.warnings.length} boot warning(s)`); for (const w of r.warnings) console.log('  ' + w.slice(0, 300));
console.log(bad ? `\nFAIL — ${bad} finding(s)` : '\nPASS');
process.exit(bad ? 1 : 0);
