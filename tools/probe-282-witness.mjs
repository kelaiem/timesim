// TODO 282 — does the pass-through witness reach a body whose surface DOUBLES a face inside its metal? ACCEPTANCE.
//
// `sampledVerdict`'s TODO 95 witness (does an edge of one body pierce the other in AND out?) runs only when the body
// crossed is closed, judged by `boundsASolid`. That read "every edge on exactly two faces", and a face doubled inside the
// metal (the form case's bezel sweep and band share the seat plane; the chain's links touch along edges) shares its
// edges FOUR ways, so the six such meshes in the movement were refused the witness. With no sample point in the metal,
// `meshClearance` then replaced the library's correct 0 with a vertex distance: on `case=rect` before §331 the winding
// stem read 2.289 u clear of the band it crossed 96 times. TODO 282 reads "no edge on an ODD number of faces" (no
// boundary, mod 2), under which the argument still holds: a doubled internal face can be reached only from inside.
//
// Three tiers, against the rule AS IT WAS (boundsASolid's line rewritten back to `bad === 0` in flight; a rewrite that
// does not take is a thrown error, never a silent pass):
//   doubled — a coarse slab cut as two boxes sharing a face (every edge even, two-triangle faces), a thin rod through it
//             with no vertex or edge midpoint of either inside the other. Truth is independent: the library's raw
//             closest point and an exact crossing count. The OLD rule must read the rod clear (the must-fail control:
//             if it reads 0, some other witness saw it and the tier proves nothing); the NEW rule must read exactly 0.
//   open    — the same rod through an open sheet (a PlaneGeometry, odd edges). The new law must still refuse it the
//             witness: a segment crossing an open surface twice is inside no metal at all (TODO 95's guard).
//   census  — the default build and `form-rect`: nothing accepted by the old law is refused by the new one (monotone),
//             and the meshes the new law newly accepts are listed by name, each with no odd edge.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8488);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const NEW_CLOSED = 'v = surfaceEdgeCensus(geom).odd === 0;';
const src = readFileSync(join(ROOT, 'src/inspect.js'), 'utf8');
if (src.split(NEW_CLOSED).length - 1 !== 1)
  throw new Error('probe-282: boundsASolid\'s closedness line is not where this probe expects it — update the probe');
const OLD_SRC = src.replace(NEW_CLOSED, 'v = surfaceEdgeCensus(geom).bad === 0;');

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

const MEASURE = async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const BV = await import('./vendor/three-mesh-bvh.module.js');
  const c = window.__clock;
  c.resetInputs();
  c.scene.updateMatrixWorld(true);
  // one indexed body from several geometries (each made non-indexed, concatenated, then indexed 0..n−1: the BVH wants
  // an index, and the census keys edges by position, so the shared face's duplicated vertices still meet)
  const merge = (geos) => {
    const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const n = flat.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(n * 3);
    let w = 0;
    for (const g of flat) { pos.set(g.attributes.position.array, w); w += g.attributes.position.count * 3; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setIndex([...Array(n).keys()]);
    out.computeVertexNormals();
    return out;
  };
  const mesh = (g, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(g); m.position.set(x, y, z); m.updateMatrixWorld(true); return m; };
  // the slab: 10 × 10 × 1, cut at z = 0 into two closed boxes whose shared faces coincide (one segment a side, so each
  // face is two triangles: no slab vertex or edge midpoint stands anywhere near the rod)
  const lo = new THREE.BoxGeometry(10, 10, 0.5); lo.translate(0, 0, -0.25);
  const hi = new THREE.BoxGeometry(10, 10, 0.5); hi.translate(0, 0, 0.25);
  const slab = mesh(merge([lo, hi]));
  // the rod: 0.2 square, z −1 .. 3 at (1.3, 1.7). Asymmetric on purpose: its edges' midpoints stand at z = 1 (and its
  // face diagonals' too), outside the slab's |z| ≤ 0.5, so no point sample of the rod lands in the slab's metal
  const rodG = new THREE.BoxGeometry(0.2, 0.2, 4); rodG.translate(0, 0, 1);
  const rod = mesh(merge([rodG]), 1.3, 1.7, 0);
  const sheet = mesh(merge([new THREE.PlaneGeometry(10, 10)]));
  const world = (m) => { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); return g; };
  const raw = (a, b) => { const ga = world(a), gb = world(b); const t = new BV.MeshBVH(ga); return t.closestPointToGeometry(gb, new THREE.Matrix4(), {}, {}).distance; };
  // independent crossing count: the rod's axis against the slab, double-sided, deduped to distinct depths
  const ray = new THREE.Ray(new THREE.Vector3(1.3, 1.7, -1), new THREE.Vector3(0, 0, 1));
  const sw = world(slab); const st = new BV.MeshBVH(sw);
  const axisHits = [...new Set(st.raycast(ray, THREE.DoubleSide, 0, 4).map((h) => +h.distance.toFixed(6)))].sort((x, y) => x - y);
  const out = {
    slab: I.surfaceEdgeCensus(slab.geometry), sheet: I.surfaceEdgeCensus(sheet.geometry), rodCensus: I.surfaceEdgeCensus(rod.geometry),
    rawSlab: raw(slab, rod), rawSheet: raw(sheet, rod), axisHits,
    dSlab: I.meshClearance(rod, slab), dSlabRev: I.meshClearance(slab, rod), dSheet: I.meshClearance(rod, sheet),
  };
  // census over the build's labelled units (collectUnits' pruning: a schematic subtree is cut)
  const walk = (n, acc) => { if (n.userData && n.userData.schematic) return; if (n.isMesh && n.geometry?.attributes?.position) acc.push(n); for (const ch of n.children) walk(ch, acc); };
  const per = new Map(); let total = 0, oldAcc = 0, newAcc = 0; const lost = [], gained = [];
  for (const e of c.labelEntries) {
    const ms = []; walk(e.obj, ms);
    for (const m of ms) {
      total++;
      let r = per.get(m.geometry); if (!r) { r = I.surfaceEdgeCensus(m.geometry); per.set(m.geometry, r); }
      const o = r.bad === 0, nw = r.odd === 0;
      if (o) oldAcc++; if (nw) newAcc++;
      if (o && !nw) lost.push(`${e.name}/${m.name || m.geometry.type}`);
      if (!o && nw) gained.push(`${e.name}/${m.name || m.geometry.type} (over ${r.over}, odd ${r.odd})`);
    }
  }
  out.census = { total, oldAcc, newAcc, lost, gained: [...new Set(gained)] };
  return out;
};

const run = async (q, oldRule) => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/__state*', (r) => r.fulfill({ status: 404, body: '' }));
  let took = !oldRule;
  if (oldRule) await page.route('**/src/inspect.js*', (r) => { took = true; r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: OLD_SRC }); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?trial=1${q ? '&' + q : ''}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !!window.__clock && !!window.__clock.labelEntries, null, { timeout: 400000 });
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  const r = await page.evaluate(MEASURE);
  if (!took) throw new Error('probe-282: the old-rule route never fired — the control would be the new rule twice');
  await page.close();
  return { ...r, errors };
};

const fails = [];
const fail = (s) => { fails.push(s); console.log('  FAIL ' + s); };
const f4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : String(x));
const NEW = await run('', false);
const OLD = await run('', true);
const FORM = await run('case=rect&formrect=-45.72,45.72,-44.38,44.38', false);

console.log('== doubled: a rod through a slab cut as two boxes sharing a face ==');
console.log(`  slab census: ${NEW.slab.edges} edges, bad ${NEW.slab.bad}, over ${NEW.slab.over}, odd ${NEW.slab.odd}; rod: bad ${NEW.rodCensus.bad}`);
if (!(NEW.slab.over > 0)) fail('the slab has no over-shared edge — the fixture does not double its face');
if (NEW.slab.odd !== 0) fail(`the slab has ${NEW.slab.odd} odd edge(s) — it is not closed mod 2, so it tests nothing about this law`);
console.log(`  truth: the library's raw closest point ${f4(NEW.rawSlab)}; the rod's axis crosses the slab at [${NEW.axisHits.join(', ')}]`);
if (NEW.rawSlab !== 0) fail(`the library reads the rod ${f4(NEW.rawSlab)} from the slab — the fixture does not interpenetrate`);
if (NEW.axisHits.length < 2) fail(`the rod's axis crosses the slab ${NEW.axisHits.length} time(s) — not a pass-through`);
console.log(`  meshClearance(rod, slab): old rule ${f4(OLD.dSlab)}, new rule ${f4(NEW.dSlab)}; (slab, rod) new ${f4(NEW.dSlabRev)}`);
if (!(OLD.dSlab > 0)) fail('CONTROL: the old rule already reads the rod as touching — some other witness sees it, so this tier proves nothing');
if (NEW.dSlab !== 0) fail(`the new rule reads ${f4(NEW.dSlab)} for a rod through the slab — the witness did not run`);
if (NEW.dSlabRev !== 0) fail(`the new rule reads ${f4(NEW.dSlabRev)} with the arguments swapped`);

console.log('== open: the same rod through an open sheet ==');
console.log(`  sheet census: bad ${NEW.sheet.bad}, odd ${NEW.sheet.odd}; meshClearance new ${f4(NEW.dSheet)}, old ${f4(OLD.dSheet)}`);
if (!(NEW.sheet.odd > 0)) fail('the sheet reads closed mod 2 — the open control is not open');
if (NEW.dSheet !== OLD.dSheet) fail(`the open sheet's reading moved (${f4(OLD.dSheet)} → ${f4(NEW.dSheet)}) — the new law reached a surface with a boundary`);

console.log('== census ==');
for (const [tag, R] of [['default', NEW], ['form-rect', FORM]]) {
  const C = R.census;
  console.log(`  ${tag}: ${C.total} labelled meshes; closed under the old law ${C.oldAcc}, under the new ${C.newAcc}`);
  if (C.lost.length) fail(`${tag}: ${C.lost.length} mesh(es) closed before are refused now (must be monotone): ${C.lost.slice(0, 5).join(', ')}`);
  for (const g of C.gained) console.log(`    newly closed: ${g}`);
}
if (!NEW.census.gained.length && !FORM.census.gained.length) fail('the new law accepts no mesh the old refused — the change did nothing');

console.log('== boot ==');
for (const [tag, R] of [['new', NEW], ['old', OLD], ['form-rect', FORM]]) {
  console.log(`  ${tag}: ${R.errors.length} page error(s)`);
  if (R.errors.length) fail(`${tag} build: ${R.errors[0]}`);
}

await browser.close(); srv.kill();
console.log(fails.length ? `\nFAIL — ${fails.length} problem(s)` : '\nPASS — a rod through a doubled-face slab reads 0 (the old rule read it clear), an open sheet is still refused, and the census is monotone');
process.exit(fails.length ? 1 : 0);
