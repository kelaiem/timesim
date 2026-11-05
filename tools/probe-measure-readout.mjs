// Does the Measure overlay report the size of the metal on every case shape? (§49's readout, re-derived for FORM.)
//   node tools/probe-measure-readout.mjs [--par N] ['<query>' …]     default: the round build and one build per form kind
// An ACCEPTANCE test (exits 1 on a failure). Boots each build headless (tools/boot-pool.mjs), turns Measure on through its
// own button, and holds `__clock.scaleReadout` — the one set the stats line, the legend and the in-scene ruler read — to
// the metal, never to the formula that made it:
//   M1 the plate's plan is the WORKING outline (what FORM and plateR describe), held to the metal cut on it:
//      · a form build: the base plate slab's CAPS — the root 'backPlate' mesh (inspect.js STRUCTURE_NODES.plate; its
//        children of that name are pocket floors and lands), only its vertices on its two extreme z planes. A beveled
//        extrude's outermost layer IS the shape; its flanks bulge bevelSize (0.126 mm, measured uniform) past it. The
//        caps lie inside the plan on every side and meet all four. The three-quarter plate is no reference here: it is
//        cut IN at its balance cutaway, measured 0.052 mm off the tonneau's +x side.
//      · the round build: the three-quarter plate (mesh 'threeQuarterPlate') — the base slab carries §186's mounting rim
//        there (⌀37.9), not the working circle. It lies inside the plan and meets three of four sides (its quarter cut
//        away for the balance, 0.065 mm off +x).
//      And on every build the plan's y bounds — where the ruler's leg and its leaders stand — meet that metal.
//   M2 the case's plan is the band's measured x/y extent (mesh 'caseMiddle': the wall the case is cut on, lugs and crowns
//      excluded — the 40 mm body cap's reading, §186)
//   M3 the cased depth is the movement-plus-case z extent; the depth leaders' faces are the movement's own z extent
//      (they read the BALANCE's box before this probe, because §39's `box` was last set by unitBox('Balance'))
//   M4 what reaches the screen is that set: the stats line and the legend quote it, and a form build quotes no '⌀'
//   C1 CONTROL — the old law (⌀ = plateR · 2) FAILS M1 on at least one form build, or this probe could not see the defect
// Tolerance: TOL_MM is float and vertex-weld noise. The readout quotes FORM's analytic bounds and the plates are cut on
// its polyline (FORM.loop()); measured, that loop's vertex bounds reach the analytic ones on every side of every default
// build (0.000 mm), so no chord sagitta needs allowing. Two orders under the 1.1–3.9 mm the old law was off by.
import { bootMany } from './boot-pool.mjs';
import { UNIT_MM } from '../src/layout.js';
import { GONG_SEATS } from '../src/gong-seats.js';

const TOL_MM = 0.02;
// Each box-fitted kind at its committed seat's FITTED formrect (src/gong-seats.js), never a bare ?case=<kind>: that boots
// the solvers' first-boot guess, which the build itself warns its metal stands outside (§307/§308) — measured, the cushion
// guess left a three-quarter plate ear 0.314 mm past it, a defect of the query and not of the readout.
const DEFAULT_QUERIES = [
  '',                                                // round
  ...Object.entries(GONG_SEATS).map(([kind, seats]) => `case=${kind}&formrect=${Object.values(seats)[0].formrect.join(',')}`),
  'case=free&alarm=0&barrelstep=-140&rsvaz=0&rsvidl=2&frame=lands&arrest=stopwork&drumaz=140',   // the stopwork-140 point (it has a generated outline)
];
const args = process.argv.slice(2);
const pi = args.indexOf('--par'); const par = pi >= 0 ? Number(args.splice(pi, 2)[1]) : undefined;
const queries = args.length ? args : DEFAULT_QUERIES;

// in the page: extents of named meshes read off their world vertices (a vertex walk, not a Box3 of the geometry's own
// bounds, so a mesh carrying a scale or a rotation reads its true extent)
const EXPR = `(async () => {
  const C = window.__clock;
  document.getElementById('btn-axes').click();
  await new Promise((r) => requestAnimationFrame(() => r()));
  const ext = (meshes) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const o of meshes) { o.updateWorldMatrix(true, false); const p = o.geometry.attributes.position, e = o.matrixWorld.elements;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const v = [e[0]*x + e[4]*y + e[8]*z + e[12], e[1]*x + e[5]*y + e[9]*z + e[13], e[2]*x + e[6]*y + e[10]*z + e[14]];
        for (let k = 0; k < 3; k++) { if (v[k] < mn[k]) mn[k] = v[k]; if (v[k] > mx[k]) mx[k] = v[k]; } } }
    return meshes.length ? { mn, mx } : null; };
  // an extrude's two cap planes only: vertices within 1e-6 u of the mesh's own z extremes
  const caps = (meshes) => { const all = ext(meshes); if (!all) return null; const mn = [Infinity, Infinity, 0], mx = [-Infinity, -Infinity, 0];
    for (const o of meshes) { const p = o.geometry.attributes.position, e = o.matrixWorld.elements;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const Z = e[2]*x + e[6]*y + e[10]*z + e[14]; if (Math.abs(Z - all.mn[2]) > 1e-6 && Math.abs(Z - all.mx[2]) > 1e-6) continue;
        const X = e[0]*x + e[4]*y + e[8]*z + e[12], Y = e[1]*x + e[5]*y + e[9]*z + e[13];
        mn[0] = Math.min(mn[0], X); mn[1] = Math.min(mn[1], Y); mx[0] = Math.max(mx[0], X); mx[1] = Math.max(mx[1], Y); } }
    return { mn, mx }; };
  const named = (root, n) => { const out = []; root.traverse((o) => { if (o.isMesh && o.name === n && !o.userData.schematic) out.push(o); }); return out; };
  const caseObj = C.labelEntries.find((e) => e.name === 'Case')?.obj;
  const movRoot = caseObj.parent;
  const movMeshes = [], allMeshes = [];
  for (const c of movRoot.children) { if (c.name === 'caseLines') continue;
    c.traverse((o) => { if (!o.isMesh || !o.geometry?.attributes?.position) return; allMeshes.push(o); if (c !== caseObj) movMeshes.push(o); }); }
  return { S: C.scaleReadout, plateR: C.plateR, kind: C.form?.kind ?? 'round',
    plate: C.form ? caps(named(movRoot, 'backPlate').filter((o) => o.parent?.name !== 'backPlate')) : ext(named(movRoot, 'threeQuarterPlate')),
    band: ext(named(caseObj, 'caseMiddle')),
    mov: ext(movMeshes), cased: ext(allMeshes),
    stats: document.querySelector('#scale-stats span')?.textContent ?? null,
    legend: document.querySelector('#axes-scale span')?.textContent ?? null };
})()`;

const MM = (u) => u * UNIT_MM;
let fails = 0, controlSaw = false;
const check = (name, ok, detail) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const near = (a, b) => Math.abs(a - b) <= TOL_MM;
const f2 = (x) => x.toFixed(3);
// a plan [xMin, xMax, yMin, yMax] (units) against a metal extent: sides the metal passes by more than TOL, and sides it meets
const judge = (plan, m) => {
  const metal = [m.mn[0], m.mx[0], m.mn[1], m.mx[1]], out = [-1, 1, -1, 1];
  return { past: plan.filter((p, i) => MM((metal[i] - p) * out[i]) > TOL_MM).length,
           meets: plan.filter((p, i) => near(MM(metal[i]), MM(p))).length };
};

for (const r of await bootMany(queries, EXPR, par ? { concurrency: par } : {})) {
  console.log(`\n# ${r.query || '(round)'}${r.unknownKeys?.length ? `  UNKNOWN KEYS ${r.unknownKeys}` : ''}`);
  if (r.bootError || !r.extra?.S) { check('boot', false, r.bootError ?? 'no scaleReadout published'); continue; }
  const { S, plate, band, mov, cased, stats, legend, kind, plateR } = r.extra;
  if (!plate || !band) { check('metal found', false, `plate ${!!plate}, caseMiddle ${!!band}`); continue; }
  const pW = MM(plate.mx[0] - plate.mn[0]), pH = MM(plate.mx[1] - plate.mn[1]);
  const cW = MM(band.mx[0] - band.mn[0]), cH = MM(band.mx[1] - band.mn[1]);
  console.log(`  ${kind}: readout plate ${f2(S.plateWMM)} × ${f2(S.plateHMM)}, case ${f2(S.caseWMM)} × ${f2(S.caseHMM)} × ${f2(S.casedMM)} mm`);
  const need = S.round ? 3 : 4, j = judge([S.plateXMinUnits, S.plateXMaxUnits, S.plateYMinUnits, S.plateYMaxUnits], plate);
  check(`M1 the ${S.round ? 'three-quarter plate' : "base plate's caps"} inside the plate plan, meeting ${need} of its sides`, j.past === 0 && j.meets >= need,
    `metal ${f2(pW)} × ${f2(pH)}; ${j.past} side(s) past, ${j.meets} met`);
  check('M1 plate y bounds = that plate (the ruler leg and its leaders)',
    near(MM(S.plateYMinUnits), MM(plate.mn[1])) && near(MM(S.plateYMaxUnits), MM(plate.mx[1])),
    `readout ${f2(MM(S.plateYMinUnits))}..${f2(MM(S.plateYMaxUnits))}, metal ${f2(MM(plate.mn[1]))}..${f2(MM(plate.mx[1]))}`);
  check('M2 case plan = the band (caseMiddle)', near(S.caseWMM, cW) && near(S.caseHMM, cH), `metal ${f2(cW)} × ${f2(cH)}`);
  const casedMetal = MM(cased.mx[2] - cased.mn[2]), movMetal = MM(mov.mx[2] - mov.mn[2]);
  check('M3 cased depth = movement + case z extent', near(S.casedMM, casedMetal), `metal ${f2(casedMetal)}`);
  check('M3 movement depth and its leader faces = the movement z extent',
    near(S.movMM, movMetal) && near(MM(S.zMinUnits), MM(mov.mn[2])) && near(MM(S.zMaxUnits), MM(mov.mx[2])),
    `readout ${f2(MM(S.zMinUnits))}..${f2(MM(S.zMaxUnits))}, metal ${f2(MM(mov.mn[2]))}..${f2(MM(mov.mx[2]))}`);
  // the shown text: decimal marks are the locale's (fmtNum); the harness boots English, whose mark is '.'
  const one = (x) => x.toFixed(1);
  const plan = (w, h) => S.round ? `⌀${one(w)}` : `${one(w)} × ${one(h)}`;
  const wantStats = `${plan(S.plateWMM, S.plateHMM)} × ${one(S.movMM)} mm · Case ${plan(S.caseWMM, S.caseHMM)} × ${one(S.casedMM)} mm`;
  check('M4 the stats line quotes the set', !!stats?.startsWith(wantStats), `"${stats}"`);
  check('M4 the legend quotes the plate plan', !!legend?.includes(`${plan(S.plateWMM, S.plateHMM)} mm plate`), `"${legend}"`);
  if (!S.round) check('M4 a form build quotes no diameter', !stats.includes('⌀') && !legend.includes('⌀'));
  if (!S.round) { const o = judge([-plateR, plateR, -plateR, plateR], plate); if (o.past > 0 || o.meets < 4) controlSaw = true; }
}
console.log('');
check('C1 control: the old law (⌀ = plateR · 2) fails M1 on a form build', controlSaw || !queries.some((q) => /case=/.test(q)),
  controlSaw ? 'it does' : 'no form build read wrong under it — the probe cannot see the defect it was written for');
console.log(fails ? `\nFAIL — ${fails} check(s)` : '\nPASS');
process.exit(fails ? 1 : 0);
