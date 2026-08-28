// TODO 109 step 1 — WHO HOLDS THESE PARTS? The scan that has to run before a
// single `userData.bearings` line is written.
//
// Seven unwaived rows of §54's report are measured over their WHOLE STOCK
// because nobody declared where they are held. Step 1 of the item is to
// declare the bearings that exist — but a declaration is only legal if there
// is METAL at the station, and `checkSlenderness`'s supportAt looks for that
// metal ONLY inside the declaring mesh's own labelled unit (main.js says so at
// the applied-route builder: "a bush parented to the plate would read as a
// bearing with no metal at it"). An unsupported station FAILS the battery.
//
// So this walks each row's long axis and asks, at every station: what metal
// contains this point, and WHICH UNIT is it in? A candidate in the same unit
// is declarable today. A candidate in another unit is a real bearing the
// gate cannot see — that is a layout fact about the part, not a licence to
// declare it, and it is reported separately rather than mixed in.
//
// TWO TESTS PER STATION, because they answer different questions:
//   · BOX — Box3.setFromObject containment, exactly what supportAt does. This
//     predicts the gate's verdict.
//   · SURFACE — the station's distance to the candidate's actual triangles
//     (three-mesh-bvh). This says whether the metal is really there. A torus
//     bush passes BOX across its whole hole; only SURFACE knows the difference
//     between a bearing and the air inside its bore.
// A station that is BOX-in and SURFACE-far is the instrument's own warning:
// the gate would accept a declaration the metal does not earn.
//
// It reports; it decides nothing. Usage: node probe-bearing-candidates.mjs
// [out.json]   (from tools/; needs npm ci + Playwright Chromium).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8464;
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
  const BVH = await import('./vendor/three-mesh-bvh.module.js');
  const I = await import('./src/inspect.js');
  const { UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs();
  clock.scene.updateMatrixWorld(true);

  const rep = I.checkSlenderness(clock);
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));

  // checkSlenderness' own population rule, so a row and its mesh agree.
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

  const dims = (mesh) => {
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    const d = [['x', b.max.x - b.min.x], ['y', b.max.y - b.min.y], ['z', b.max.z - b.min.z]]
      .sort((p, q) => p[1] - q[1]);
    return { tMin: d[0][1], tMid: d[1][1], len: d[2][1], axis: d[2][0], box: b };
  };
  const r4 = (x) => +Number(x).toFixed(4);

  // Every candidate mesh in the scene, with the unit it is labelled under and
  // a bounds tree for the surface test. Schematic display is pruned — it is
  // not metal (§71), and letting a page-coloured occluder answer "yes, held"
  // is precisely the kind of clean-but-wrong this probe exists to avoid.
  const candidates = [];
  let nextId = 0;
  for (const { unit, mesh } of byMesh.values()) candidates.push({ unit, mesh, id: nextId++ });
  // A holder is identified by its MESH, never by its name: six of these units
  // hold many meshes called `(unnamed)`, and keying on the name merges them
  // into one line that describes none of them. Same rule as the row matcher.
  const holderDesc = (c) => {
    const g = c.mesh.geometry;
    const params = g.parameters ? Object.entries(g.parameters)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `${k} ${(+v).toFixed(4)}`).join(', ') : '';
    return `${g.type}${params ? ` (${params})` : ''}`;
  };

  const _p = new THREE.Vector3(), _box = new THREE.Box3(), _tgt = {};
  const surfaceDist = (mesh, worldPt) => {
    if (!mesh.geometry.boundsTree) {
      if (!mesh.geometry.index) return null;             // bvh needs an index (§81 welds them; a stray one is skipped, not faked)
      mesh.geometry.boundsTree = new BVH.MeshBVH(mesh.geometry);
    }
    const local = worldPt.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert());
    const hit = mesh.geometry.boundsTree.closestPointToPoint(local, _tgt, 0, Infinity);
    if (!hit) return null;
    // Back to world scale: the movement has no non-uniform scaling, so the
    // local distance is the world distance. Asserted rather than assumed.
    const s = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
    const uniform = Math.abs(s.x - s.y) < 1e-9 && Math.abs(s.y - s.z) < 1e-9;
    return { d: hit.distance * (uniform ? s.x : 1), uniform };
  };

  const STEP = 0.25;                    // u along the axis — fine against the bushes' own widths
  const rows = rep.rows.filter((r) => !r.waived).map((row) => {
    const cands = [...byMesh.values()].filter((e) => {
      if (e.unit !== row.unit || (e.mesh.name || '(unnamed)') !== row.mesh) return false;
      const { tMin, tMid, len } = dims(e.mesh);
      const near = (a, b) => Math.abs(a - b) <= 1.5e-4;
      const stock = row.stock_mm != null ? row.stock_mm : row.length_mm;
      return near(tMin * UNIT_MM, row.thin_mm) && near(tMid * UNIT_MM, row.section_mm)
        && Math.abs(len * UNIT_MM - stock) <= 1.5e-3;
    });
    if (cands.length !== 1) return { unit: row.unit, mesh: row.mesh, lambda: row.lambda, matched: cands.length, holders: null };
    const { mesh } = cands[0];
    const { axis, len, box, tMid } = dims(mesh);
    const lo = box.min[axis], hi = box.max[axis];

    const stations = [];
    for (let s = lo; s <= hi + 1e-9; s += STEP) {
      _p.set(0, 0, 0); _p[axis] = s; _p.applyMatrix4(mesh.matrixWorld);
      const here = [];
      for (const c of candidates) {
        if (c.mesh === mesh) continue;
        _box.setFromObject(c.mesh);
        if (!_box.containsPoint(_p)) continue;
        const sd = surfaceDist(c.mesh, _p);
        here.push({
          id: c.id, holder: c.mesh.name || '(unnamed)', geometry: holderDesc(c), unit: c.unit,
          sameUnit: c.unit === row.unit,
          surface_u: sd ? +sd.d.toFixed(4) : null,
          // "Inside the metal" is the honest reading of a small surface
          // distance at a point a box already contains: a bore's air is
          // FAR from the torus surface, a shaft buried in a boss is near it.
          inMetal: sd ? sd.d <= tMid : null,
        });
      }
      if (here.length) stations.push({ station: r4(s), t: r4((s - lo) / len), holders: here });
    }
    return { unit: row.unit, mesh: row.mesh, lambda: row.lambda, section_mm: row.section_mm,
             axis, lo: r4(lo), hi: r4(hi), len_u: r4(len), matched: 1, stations };
  });

  return { max: rep.max, over: rep.over, unwaived: rep.unwaived, step: STEP, rows };
});

await browser.close();
srv.kill();

const V_STEP = V.step;
const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(V, null, 2));

console.log(`${V.unwaived} unwaived rows over λ ${V.max}; axis sampled every ${V.step} u\n`);
for (const r of V.rows) {
  console.log(`${r.unit} / ${r.mesh}  λ ${r.lambda}   axis ${r.axis} ${r.lo} … ${r.hi} (${r.len_u} u)`);
  if (r.matched !== 1) { console.log(`   NOT IDENTIFIED (${r.matched} meshes match the row)\n`); continue; }
  if (!r.stations.length) { console.log('   nothing contains any station — NO BEARING METAL ANYWHERE\n'); continue; }
  // Collapse the sampled stations into runs per holder, which is what a
  // bearing IS — a band of contact, not a point.
  const byHolder = new Map();
  for (const s of r.stations) for (const h of s.holders) {
    if (!byHolder.has(h.id)) byHolder.set(h.id, { ...h, samples: [], inMetal: 0 });
    const e = byHolder.get(h.id);
    e.samples.push(s.station); if (h.inMetal) e.inMetal++;
    e.surfaceMin = Math.min(e.surfaceMin ?? Infinity, h.surface_u ?? Infinity);
  }
  // A bearing is a CONTIGUOUS band. Split each holder's samples into runs at
  // the sampling step, so one mesh touching the axis in two places reads as
  // two bands rather than one long false one.
  const runs = (xs) => {
    const out = [[xs[0]]];
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] <= V_STEP + 1e-6) out[out.length - 1].push(xs[i]);
      else out.push([xs[i]]);
    }
    return out;
  };
  for (const e of [...byHolder.values()].sort((a, b) => a.samples[0] - b.samples[0])) {
    const bands = runs(e.samples).map((b) => `${b[0].toFixed(3)}…${b[b.length - 1].toFixed(3)} (${b.length})`);
    console.log(`   ${e.sameUnit ? 'SAME UNIT  ' : 'other unit '} ${e.unit} / ${e.holder}  [#${e.id}] ${e.geometry}`);
    console.log(`      band(s) ${bands.join(', ')}; ${e.inMetal}/${e.samples.length} samples inside metal, nearest surface ${e.surfaceMin === Infinity ? 'n/a' : e.surfaceMin.toFixed(4)} u`);
  }
  console.log('');
}
