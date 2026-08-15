// §121 triage evidence — for every in-scope FF/MM row the three-tier check
// flags, measure HOW the two solids share space: what fraction of each mesh's
// vertices stands inside the other, and how deep the deepest one sits. A
// joint by construction (an arbor through its bore, a stud through a spring's
// eye) reads as a large contained fraction at real depth; a bevel-creep or
// assembly graze reads as a sliver. Verdicts in the declared table cite these
// numbers rather than a look.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8463';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  I.start(window.__clock, 'intraUnit', { yieldEvery: 64 });
});
let out = null;
for (let i = 0; i < 240; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  out = await page.evaluate(() => (window.__checks?.intraUnit ?? null));
  if (out && out.state !== 'running') break;
}
const rows = out?.result?.violations ?? [];
console.log(`${rows.length} in-scope rows to measure`);

const measured = await page.evaluate(async (rows) => {
  const clock = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  await import('./src/inspect.js');   // patches BufferGeometry with computeBoundsTree
  // find each row's meshes by re-deriving the unit → label mapping the check used
  const units = [];
  for (const e of clock.labelEntries) {
    const meshes = [];
    (function walk(o) {
      if (o.userData?.schematic) return;
      if (o.isMesh && o.geometry?.attributes?.position) meshes.push(o);
      for (const c of o.children) walk(c);
    })(e.obj);
    if (meshes.length) units.push({ name: e.name, meshes });
  }
  const byLabel = (unitName, label) => {
    const u = units.find((x) => x.name === unitName);
    if (!u) return null;
    return u.meshes.find((m) => (m.name || `${m.geometry.type}#${u.meshes.indexOf(m)}`) === label) ?? null;
  };
  // Parity EXACTLY as the check does it: the geometry's own BVH raycast in
  // DST-LOCAL space, DoubleSide, the fixed oblique direction — a scene-level
  // Raycaster culls backfaces on front-side materials and its parity is
  // garbage on closed solids. Depth = closestPointToPoint for contained
  // samples, in the same local frame.
  const v = new THREE.Vector3(), tgt = {};
  const parityRay = new THREE.Ray();
  const DIR = new THREE.Vector3(0.317, 0.591, 0.741).normalize();
  const insideTree = (tree, pLocal) => {
    parityRay.origin.copy(pLocal);
    parityRay.direction.copy(DIR);
    let n = 0;
    for (const h of tree.raycast(parityRay, THREE.DoubleSide)) if (h.distance > 1e-9) n++;
    return (n % 2) === 1;
  };
  const out = [];
  for (const r of rows) {
    const A = byLabel(r.unit, r.a ?? r.mover), B = byLabel(r.unit, r.b ?? r.fixture);
    if (!A || !B) { out.push({ ...r, err: 'mesh not found' }); continue; }
    const stat = (src, dst) => {
      src.updateWorldMatrix(true, false);
      dst.updateWorldMatrix(true, false);
      if (!dst.geometry.boundsTree) dst.geometry.computeBoundsTree();
      const tree = dst.geometry.boundsTree;
      const pos = src.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 600));
      const toDst = dst.matrixWorld.clone().invert().multiply(src.matrixWorld);
      let n = 0, inN = 0, deep = 0, threw = 0;
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(toDst);   // src → dst local
        n++;
        try {
          if (insideTree(tree, v)) {
            inN++;
            const hit = tree.closestPointToPoint(v, tgt);
            if (hit && hit.distance > deep) deep = hit.distance;
          }
        } catch { threw++; }   // the no-normals raycast throw the check also guards
      }
      return { frac: +(inN / n).toFixed(3), deep: +deep.toFixed(4), n, threw };
    };
    out.push({ ...r, AinB: stat(A, B), BinA: stat(B, A),
      matA: A.material?.name || '', matB: B.material?.name || '' });
  }
  return out;
}, rows);

for (const m of measured) {
  const lbl = `${m.unit} [${m.tier}] ${m.a ?? m.mover} ⇄ ${m.b ?? m.fixture}`;
  if (m.err) { console.log(`${lbl}  ERR ${m.err}`); continue; }
  console.log(`${lbl}  A-in-B ${m.AinB.frac} deep ${m.AinB.deep}  B-in-A ${m.BinA.frac} deep ${m.BinA.deep}  @${m.at}`);
}
await browser.close();
srv.kill();
