// TODO 109 — the seven UNWAIVED rows of §54's slenderness report, NAMED.
//
// TODO 78 registered `checkSlenderness` and printed nine over-ceiling rows,
// seven of them unwaived. Six of those nine "cannot even be named: their
// meshes are anonymous, so the report addresses them positionally" — which is
// why nobody has triaged them: a row that says `Hack rod / (unnamed)` does not
// say WHICH bar, and `Keyless works` holds 40 meshes sharing that non-name.
//
// This reads the same rows off the built tree and gives each anonymous one an
// ADDRESS a reader can act on: the ancestor chain from its labelled unit, its
// sibling index, its geometry type and parameters, and its world position and
// extents. Geometry parameters are what make it greppable — a CylinderGeometry
// with radiusTop 0.42 and 12 radial segments is findable in main.js;
// "(unnamed)" is not.
//
// It also prices each row: what section (tMid) the row's own governing free
// length would need to reach its ceiling, and what that does to the row's
// cantilever stiffness. That is the number a fix is written against, and it
// is arithmetic on the row rather than a new judgement.
//
// λ is geometry-local, so it does not move with the pose. The WORLD position
// printed beside it does — the rods' two-circle solves ride the boot's tau —
// so the stable half of an address is the ancestor chain plus the geometry
// parameters, and the world point is a hint, good to about 0.01 u.
//
// A REPORT (§40) — it prints and exits 0. The rows it prints are debt, not
// failures; `slenderness` itself gates only its control, its malformed and
// its unsupported declarations, and this probe changes nothing about that.
//
// Usage: node probe-slenderness-residue.mjs [out.json]   (from tools/;
// needs npm ci + Playwright Chromium). ROOT= serves a different tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8463;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const V = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const { UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs();
  clock.scene.updateMatrixWorld(true);

  const rep = I.checkSlenderness(clock);
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));

  // Re-walk with checkSlenderness' own population rule so the mesh a row names
  // is the mesh this probe describes — nearest-ancestor dedupe plus the §71
  // schematic prune. Reproducing the walk is deliberate: matching on NAME is
  // exactly what fails for the rows this probe exists for, since six of them
  // are `(unnamed)` and a unit holds many.
  const byMesh = new Map();
  const hops = (mesh, name) => {
    const target = unitObj.get(name);
    let n = 0;
    for (let o = mesh; o; o = o.parent, n++) if (o === target) return n;
    return Infinity;
  };
  const walk = (o, unitName) => {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh && o.geometry?.attributes?.position) {
      const prev = byMesh.get(o);
      if (!prev || hops(o, unitName) < hops(o, prev.unit)) byMesh.set(o, { unit: unitName, mesh: o });
    }
    for (const c of o.children) walk(c, unitName);
  };
  for (const e of clock.labelEntries) walk(e.obj, e.name);

  const r4 = (x) => +Number(x).toFixed(4);
  const dims = (mesh) => {
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((x, y) => x - y);
    return { tMin: d[0], tMid: d[1], len: d[2], box: b };
  };

  const describe = (mesh, unitName) => {
    const chain = [];
    for (let o = mesh; o && o !== unitObj.get(unitName); o = o.parent) {
      chain.push({
        name: o.name || '(unnamed)',
        type: o.type,
        indexInParent: o.parent ? o.parent.children.indexOf(o) : -1,
        siblings: o.parent ? o.parent.children.length : 0,
      });
    }
    const g = mesh.geometry;
    const params = g.parameters ? Object.fromEntries(
      Object.entries(g.parameters).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, r4(v)])) : null;
    const { tMin, tMid, len, box } = dims(mesh);
    const p = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    return {
      chainFromUnit: chain.reverse(),
      geometryType: g.type,
      geometryParams: params,
      vertices: g.attributes.position.count,
      localExtents: { x: r4(box.max.x - box.min.x), y: r4(box.max.y - box.min.y), z: r4(box.max.z - box.min.z) },
      stock_u: { tMin: r4(tMin), tMid: r4(tMid), len: r4(len) },
      world: { x: r4(p.x), y: r4(p.y), z: r4(p.z) },
      declaresBearings: !!(mesh.userData && mesh.userData.bearings),
    };
  };

  // MATCH BY MEASUREMENT, NOT BY NAME. A row carries its own section and stock
  // in mm; the mesh that produced it reproduces both. Anything else picks the
  // first `(unnamed)` mesh in the unit and describes the wrong part — the
  // false-attribution failure this probe would otherwise commit while looking
  // clean. A row matched by more or fewer than one mesh is REPORTED as such.
  const priced = rep.rows.map((row) => {
    const cands = [...byMesh.values()].filter((e) => {
      if (e.unit !== row.unit || (e.mesh.name || '(unnamed)') !== row.mesh) return false;
      const { tMin, tMid, len } = dims(e.mesh);
      // The row's own numbers, at the row's own rounding: 1e-4 mm is the
      // quantum four decimal places leaves, so this is equality, not a fit.
      const near = (a, b) => Math.abs(a - b) <= 1.5e-4;
      const stock = row.stock_mm != null ? row.stock_mm : row.length_mm;
      return near(tMin * UNIT_MM, row.thin_mm) && near(tMid * UNIT_MM, row.section_mm)
        && Math.abs(len * UNIT_MM - stock) <= 1.5e-3;
    });
    const Le_mm = row.governing
      ? row.governing.effectiveL_u * (row.length_mm / row.governing.L_u)
      : row.length_mm;
    const needed = Le_mm / row.ceiling;
    const f = needed / row.section_mm;
    // I = a·c³/12. A ROUND or square bar grows both dimensions, so k goes as
    // f⁴; a flat one only has to grow the stiff dimension the check reads, f³.
    const round = Math.abs(row.thin_mm - row.section_mm) <= 1e-4;
    return {
      ...row,
      effectiveL_mm: r4(Le_mm),
      sectionNeeded_mm: r4(needed),
      sectionFactor: r4(f),
      sectionModel: round ? 'both dimensions (round/square stock), k ∝ f⁴' : 'the stiff dimension only, k ∝ f³',
      stiffnessAtNeededSection_N_per_m: +(row.cantileverStiffness_N_per_m * f ** (round ? 4 : 3)).toFixed(1),
      matched: cands.length,
      // The control on the matcher: how big a pool the NAME alone leaves. A
      // row where this is 1 proves nothing about the matching; a row where it
      // is 18 and `matched` is 1 is the measurement doing work.
      nameCandidates: [...byMesh.values()].filter((e) => e.unit === row.unit
        && (e.mesh.name || '(unnamed)') === row.mesh).length,
      address: cands.length === 1 ? describe(cands[0].mesh, cands[0].unit) : null,
    };
  });

  return {
    counted: rep.counted, exemptByKind: rep.exemptByKind, over: rep.over, unwaived: rep.unwaived,
    max: rep.max, overhangK: rep.overhangK, basis: rep.basis,
    control: rep.control, bearings: rep.bearings, staleWaivers: rep.staleWaivers,
    rows: priced,
  };
});

await browser.close();
srv.kill();

const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(V, null, 2));

console.log(`counted ${V.counted} meshes, ${V.exemptByKind} exempt by kind; ${V.over} over ceiling, ${V.unwaived} unwaived`);
console.log(`control: ${V.control}`);
console.log(`overhang K ${V.overhangK}; stale waivers ${V.staleWaivers.length}; malformed ${V.bearings.malformed.length}; unsupported ${V.bearings.unsupported.length}`);
console.log('');
for (const r of V.rows) {
  const a = r.address;
  const chain = a ? a.chainFromUnit.map((c) => `${c.name}[${c.indexInParent}/${c.siblings}]`).join(' > ') : '—';
  console.log(`${r.unit} / ${r.mesh}  λ ${r.lambda} (ceiling ${r.ceiling}, kind ${r.kind})  ${r.waived ? `WAIVED ${r.waived}` : 'unwaived'}`);
  console.log(`   section ${r.section_mm} × ${r.thin_mm} mm over ${r.length_mm} mm free${r.stock_mm ? ` of ${r.stock_mm} mm stock` : ''}; k ${r.cantileverStiffness_N_per_m} N/m`);
  if (r.governing) console.log(`   governing: ${r.governing.kind} L ${r.governing.L_u} u (effective ${r.governing.effectiveL_u} u), ${r.bearings} bearing(s), ${r.stiffnessModel}`);
  console.log(`   to reach λ ${r.ceiling}: section ${r.sectionNeeded_mm} mm (×${r.sectionFactor}, ${r.sectionModel}) → k ${r.stiffnessAtNeededSection_N_per_m} N/m`);
  if (!a) console.log(`   address: ${r.matched} meshes reproduce this row's section and stock — NOT identified`);
  if (a) {
    console.log(`   address: ${chain}   (${r.nameCandidates} mesh(es) in the unit share this name)`);
    console.log(`   ${a.geometryType} ${a.geometryParams ? JSON.stringify(a.geometryParams) : '(no parameters — welded or extruded)'}`);
    console.log(`   local extents ${JSON.stringify(a.localExtents)}, world ${JSON.stringify(a.world)}, ${a.vertices} verts, bearings declared: ${a.declaresBearings}`);
  }
  console.log('');
}
