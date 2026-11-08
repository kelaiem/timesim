// TODO 289's residue — WHERE ALONG EACH TRAVERSE COULD A BUSH STAND? A REPORT (exits 0; the judgement is the reader's).
// For each station s along settingTraverse1 / settingTraverse2 (and up to 5 u past each apex, the outboard extension the
// tail's bearings use), a solid test tube coaxial with the rod — radius journal + PIVOT_BORE_CLEAR + STOCK_MIN_U, length
// twice the journal (a straddled journal's L/D 1) — is measured against every mesh except the fold's own rods, at six
// poses (rest, tension 0 / 1 / 0.5 with the crown pulled, two τ). Two journals: the rod's own radius, and 0.174 (the
// rise's pivot). The plate's reading and the nearest other metal are printed apart, because the plate is the one wall a
// bush can be LET INTO. Want ≥ CLEAR_MARGIN. The pose set is not the battery's net: a window read here is a candidate.
//   node tools/probe-fold-traverse-room.mjs ['<query>']      (one boot through boot-form.mjs, a few minutes)
import { bootForm } from './boot-form.mjs';
const q = process.argv[2] ?? '';
const expr = `(async () => { 
  const C = window.__clock, I = await import('./src/inspect.js'), L = await import('./src/layout.js');
  const RODS = new Set(['settingDrop','settingTraverse1','settingTraverse2','settingRise','settingRisePivot','settingStub','settingCapArbor']);
  C.scene.updateMatrixWorld(true);
  const all = []; const byName = {};
  C.scene.traverse((o) => { if (!o.isMesh) return; let p = o; while (p) { if (p.userData?.schematic) return; p = p.parent; }
    (byName[o.name] = byName[o.name] ?? []).push(o); if (!RODS.has(o.name)) all.push(o); });
  const unitOf = (o) => { let p = o; while (p) { const e = C.labelEntries.find((e) => e.obj === p); if (e) return e.name; p = p.parent; } return '?'; };
  const out = {}; const POSES = [null, { tension: 0 }, { tension: 1 }, { tension: 0.5, crownPullT: 1 }, { tau: 1800 }, { tau: 5400, tension: 0.2 }];
  const M = L.CLEAR_MARGIN, BC = L.PIVOT_BORE_CLEAR, W = L.STOCK_MIN_U;
  for (const n of ['settingTraverse1', 'settingTraverse2']) {
    const m = byName[n][0]; const g = m.geometry.parameters, r = g.radiusTop, len = g.height;
    const q = m.getWorldQuaternion(new m.quaternion.constructor()); const c = m.getWorldPosition(new m.position.constructor());
    const u = new m.position.constructor(0, 1, 0).applyQuaternion(q);
    const ends = [c.clone().addScaledVector(u, -len / 2), c.clone().addScaledVector(u, len / 2)];
    const rows = [];
    for (const jr of [r, 0.174]) {
      const R = jr + BC + W, l = 2 * jr;
      for (let s = -5; s <= len + 5 + 1e-9; s += 0.5) {
        const tube = new m.constructor(new m.geometry.constructor(R, R, l, 24), m.material);
        tube.quaternion.copy(q); tube.position.copy(ends[0]).addScaledVector(u, s); tube.updateMatrixWorld(true);
        const hits = [];
        for (const P of POSES) { if (P) { C.setPose(P); C.scene.updateMatrixWorld(true); }
          for (const o of all) { const v = I.meshClearance(tube, o, 1.0); if (v < 1.0) hits.push({ d: +v.toFixed(3), mesh: o.name || o.geometry.type, unit: unitOf(o) }); } }
        C.resetInputs?.(); C.scene.updateMatrixWorld(true);
        hits.sort((a, b) => a.d - b.d);
        rows.push({ journal: +jr.toFixed(3), R: +R.toFixed(3), s: +s.toFixed(2), at: [tube.position.x, tube.position.y, tube.position.z].map((x) => +x.toFixed(2)),
          worst: hits.slice(0, 3), plate: hits.find((h) => h.mesh === 'backPlate')?.d ?? null, nonPlate: hits.find((h) => h.mesh !== 'backPlate') ?? null });
        tube.geometry.dispose();
      }
    }
    out[n] = { r, len, ends: ends.map((e) => [e.x, e.y, e.z].map((x) => +x.toFixed(3))), rows };
  }
  return out;
})()`;
const res = await bootForm(q, expr);
if (res.bootError) { console.log('boot error', res.bootError); process.exit(1); }
for (const [n, v] of Object.entries(res.extra)) {
  console.log(`\n${n}  r ${v.r.toFixed(3)}  L ${v.len.toFixed(2)}  ends ${JSON.stringify(v.ends)}`);
  for (const row of v.rows) console.log(`  j ${row.journal} R ${row.R} s ${String(row.s).padStart(5)} @${JSON.stringify(row.at)}  plate ${row.plate ?? '>1'}  other ${row.nonPlate ? row.nonPlate.d + ' ' + row.nonPlate.mesh + ' (' + row.nonPlate.unit + ')' : '>1'}`);
}
console.log('\nwarnings:', res.warnings?.length ?? 0);
