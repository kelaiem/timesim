// Verifies the two local patches in vendor/three-mesh-bvh.module.js (see
// vendor/README.md) still hold — run after any vendor bump, before trusting
// a single clearance number.
//
// 1. History independence: closestPointToGeometry must return the same
//    distance cold, after the transposed query, and after an unrelated one.
//    (Unpatched, a single-leaf outer tree pruned its inner traversal against
//    whatever OBB the PREVIOUS query left in the shared module temp:
//    0.1066 cold read 0.1404 or 0.4110 warm.)
// 2. Direction symmetry against a vertex-sampled reference: tree(a)->b and
//    tree(b)->a must agree, and neither may exceed the sampled bound — a
//    correct closest-point search can never exceed a sampled point pair.
//
// Usage: node check-bvh-patches.mjs   (needs npm ci + Playwright Chromium,
// same as ci-battery.mjs). Exits non-zero on any violation.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 8433;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose(I.AXES[0].pose(0, clock));
  const U = (n, t) => {
    const e = clock.labelEntries.find((x) => x.name === n);
    const out = [];
    e.obj.traverse((o) => { if (!o.userData.schematic && o.isMesh && o.geometry?.type === t) out.push(o); });
    return out;
  };
  // the witness pair: the sleeve's lathe vs the rocker's box — a single-leaf
  // outer tree on one side, the configuration that exposed patch 1
  const sleeves = U('Alarm release sleeve', 'LatheGeometry');
  const boxes = U('Alarm silence rocker', 'BoxGeometry');
  for (const m of [...sleeves, ...boxes]) if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
  const mat = new THREE.Matrix4();
  const q = (from, to) => {
    mat.copy(from.matrixWorld).invert().multiply(to.matrixWorld);
    const hit = from.geometry.boundsTree.closestPointToGeometry(to.geometry, mat, {}, {}, 0, Infinity);
    return hit ? hit.distance : Infinity;
  };
  const sample = (from, to) => {
    // vertex-sampled upper bound of the true distance, in `to`'s local frame
    // (all witness meshes are unscaled — asserted below)
    const s = new THREE.Vector3();
    to.getWorldScale(s);
    if (Math.abs(s.x - 1) > 1e-6 || Math.abs(s.y - 1) > 1e-6 || Math.abs(s.z - 1) > 1e-6) return null;
    const bvh = to.geometry.boundsTree;
    const inv = new THREE.Matrix4().copy(to.matrixWorld).invert();
    const pos = from.geometry.getAttribute('position');
    const V = new THREE.Vector3();
    let best = Infinity;
    for (let i = 0; i < pos.count; i++) {
      V.fromBufferAttribute(pos, i).applyMatrix4(from.matrixWorld).applyMatrix4(inv);
      const hit = bvh.closestPointToPoint(V, {});
      if (hit && hit.distance < best) best = hit.distance;
    }
    return best;
  };
  const failures = [];
  let pairs = 0;
  for (const a of sleeves) for (const b of boxes) {
    const cold = q(b, a);
    if (cold > 0.6) continue;               // hold the near pairs, where lies classified rows
    pairs++;
    q(a, b);                                // transposed history
    const warm1 = q(b, a);
    for (const c of sleeves) if (c !== a) { q(c, b); break; }   // unrelated history
    const warm2 = q(b, a);
    if (Math.abs(warm1 - cold) > 1e-9 || Math.abs(warm2 - cold) > 1e-9)
      failures.push(`history-dependent: cold ${cold.toFixed(4)}, after transposed ${warm1.toFixed(4)}, after unrelated ${warm2.toFixed(4)}`);
    const ab = q(a, b);
    if (Math.abs(ab - cold) > 1e-9)
      failures.push(`direction-asymmetric: a->b ${ab.toFixed(4)} vs b->a ${cold.toFixed(4)}`);
    const ref = Math.min(sample(a, b) ?? Infinity, sample(b, a) ?? Infinity);
    if (cold > ref + 1e-9)
      failures.push(`exceeds sampled bound: reported ${cold.toFixed(4)}, a sampled point pair sits at ${ref.toFixed(4)}`);
  }
  return { pairs, failures };
});

await browser.close();
srv.kill();
if (!res.pairs) { console.error('BVH patch check BROKEN: no witness pairs found — the sleeve/rocker meshes moved; re-site the witness'); process.exit(1); }
if (res.failures.length) {
  console.error(`BVH patch check FAILED (${res.failures.length}):`);
  for (const f of res.failures) console.error('  · ' + f);
  process.exit(1);
}
console.log(`BVH patch check OK — ${res.pairs} witness pair(s): history-independent, direction-symmetric, within sampled bounds`);
