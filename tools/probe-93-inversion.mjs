// TODO 93 — why does meshClearance report CLEARANCE through 1 mm of band?
//
// The entry filed a parity inversion as the suspected cause. It is not: the
// parity cross-check (`sampledVerdict`) is gated on `d < 0.05`, and the value
// under investigation is 2.6104, so that branch never runs. This probe asks
// the narrower question instead — is 2.6104 the TRUE surface-to-surface
// distance, or a non-minimal over-estimate of the kind §82 patched the vendor
// for? An over-estimate is the unsafe direction precisely because it sails
// over the 0.05 guard.
//
// Method: the stem's surface demonstrably crosses the band's surface, so a
// point lying on BOTH exists and the true distance is 0. Sampling the stem's
// own triangles and asking caseMiddle's BVH for the closest point to each
// gives a sound UPPER BOUND on that distance. If the bound comes back near 0
// while meshClearance says 2.6104, the query is over-estimating.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8462);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const BVH = await import('../vendor/three-mesh-bvh.module.js');
  const clock = window.__clock;
  const out = [];
  clock.resetInputs();

  const unit = (n) => clock.labelEntries.find((x) => x.name === n);
  const meshesOf = (e) => {
    const m = []; e.obj.traverse((o) => {
      if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) m.push(o);
    }); return m;
  };
  const mid = meshesOf(unit('Case')).find((m) => m.name === 'caseMiddle');
  // The pusher stem: the Alarm switch cylinder whose axis stands off centre.
  const stem = meshesOf(unit('Alarm switch')).find((m) => {
    const g = m.geometry;
    return /Cylinder/.test(g.type) && g.parameters && g.parameters.height > 15;
  });
  out.push(`stem: ${stem.name || '(unnamed)'} Ø${(Math.max(stem.geometry.parameters.radiusTop, stem.geometry.parameters.radiusBottom) * 2).toFixed(3)} len ${stem.geometry.parameters.height.toFixed(3)}`);

  // 1. What meshClearance says, both orders, cold-ish and repeated.
  out.push('');
  out.push(`meshClearance(case, stem) = ${I.meshClearance(mid, stem, Infinity).toFixed(4)}`);
  out.push(`meshClearance(stem, case) = ${I.meshClearance(stem, mid, Infinity).toFixed(4)}`);
  out.push(`meshClearance(case, stem) again = ${I.meshClearance(mid, stem, Infinity).toFixed(4)}`);

  // 2. Sound upper bound by sampling the stem's surface against the case tree.
  //    meshClearance has already run bvhFor on both, so boundsTree exists.
  const tree = mid.geometry.boundsTree;
  if (!tree) { out.push('no boundsTree on caseMiddle — bvhFor did not run'); return out; }
  const toCaseLocal = new THREE.Matrix4().copy(mid.matrixWorld).invert();
  const pos = stem.geometry.attributes.position;
  const idx = stem.geometry.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const p = new THREE.Vector3(), target = {};
  let best = Infinity, bestPt = null;
  // Barycentric lattice per triangle — surface samples, not just vertices.
  const LAT = [];
  const N = 6;
  for (let i = 0; i <= N; i++) for (let j = 0; i + j <= N; j++) LAT.push([i / N, j / N, 1 - i / N - j / N]);
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    vA.fromBufferAttribute(pos, a); vB.fromBufferAttribute(pos, b); vC.fromBufferAttribute(pos, c);
    stem.localToWorld(vA); stem.localToWorld(vB); stem.localToWorld(vC);
    for (const [u, v, w] of LAT) {
      p.set(vA.x * u + vB.x * v + vC.x * w, vA.y * u + vB.y * v + vC.y * w, vA.z * u + vB.z * v + vC.z * w);
      const q = p.clone().applyMatrix4(toCaseLocal);
      const hit = tree.closestPointToPoint(q, target, 0, best);
      if (hit && hit.distance < best) { best = hit.distance; bestPt = p.clone(); }
    }
  }
  out.push('');
  out.push(`sampled stem-surface → case-surface minimum = ${best.toFixed(4)}`);
  if (bestPt) out.push(`  at world r ${Math.hypot(bestPt.x, bestPt.y).toFixed(3)}  z ${bestPt.z.toFixed(3)}`);
  out.push(`  (${triCount} stem triangles × ${LAT.length} barycentric samples)`);

  // 3. The raw vendor query, unwrapped, to see whether the wrapper or the
  //    library is the one over-estimating.
  const m = new THREE.Matrix4().copy(mid.matrixWorld).invert().multiply(stem.matrixWorld);
  const raw = tree.closestPointToGeometry(stem.geometry, m, {}, {}, 0, Infinity);
  out.push('');
  out.push(`raw closestPointToGeometry(case←stem) = ${raw ? raw.distance.toFixed(4) : 'null'}`);
  const tree2 = stem.geometry.boundsTree;
  if (tree2) {
    const m2 = new THREE.Matrix4().copy(stem.matrixWorld).invert().multiply(mid.matrixWorld);
    const raw2 = tree2.closestPointToGeometry(mid.geometry, m2, {}, {}, 0, Infinity);
    out.push(`raw closestPointToGeometry(stem←case) = ${raw2 ? raw2.distance.toFixed(4) : 'null'}`);
  }
  out.push('');
  // The three numbers together localise the fault. The RAW query and the
  // independent surface sampling are the ground truth; meshClearance is the
  // only one that can disagree with both, and when it does the wrapper — not
  // the library, and not the geometry — is what published the wrong answer.
  const mc = I.meshClearance(mid, stem, Infinity);
  out.push(mc <= 0.001
    ? `CONCLUSION: meshClearance ${mc.toFixed(4)} agrees with the raw query and with sampling at ${best.toFixed(4)}. The pass-through witness is holding.`
    : `CONCLUSION: raw says ${raw ? raw.distance.toFixed(4) : 'null'} and sampling says ${best.toFixed(4)}, but meshClearance says ${mc.toFixed(4)}. The LIBRARY is right and the WRAPPER overrode it — _meshClearanceInner takes Math.max(d, v.d) when sampledVerdict finds no contained sample, so a sampling miss beats a correct 0.`);
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
