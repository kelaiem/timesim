// §122 — THE VERDICT DISSECTION: the instrument fix one's soundness claim
// rests on, kept in the tree because the landing's comment cites it and a
// future reader must be able to re-take the measurement.
//
// sampledVerdict's two §122 cuts skip work whose result is provable from the
// skip condition alone:
//   P2 (distance): boxD ≥ best ⇒ the bounded closestPointToPoint cannot
//      return a hit under best. A violation here means the cut is UNSOUND —
//      it would change the sampled minimum — and the landing is wrong.
//   P1 (parity): parity-odd ⇒ the sample lies inside the tree's bounds.
//      A "violation" here is the opposite: the BASELINE parity ray calling
//      a provably-outside sample inside — the grazing-count lying mode this
//      probe measured at up to 13 u outside the box (the instrument
//      family's third, after §82's two vendor patches). The §122 landing
//      SILENCES those lies; every report row that moved under it owes its
//      justification to rows this probe prints.
//
// Modes, from tools/ with a Playwright Chromium:
//   node probe-122-verdict.mjs                 broad dissection (stride-
//                                              sampled, every near pair at
//                                              tension 0.5; ~5 min)
//   node probe-122-verdict.mjs --unit "Fusee & great wheel" --mesh CylinderGeometry#11
//                                              full-density witness for one
//                                              mesh against its own unit at
//                                              the canonical pose — the mode
//                                              that justified the one moved
//                                              row of the fix-one landing
//                                              (assembly separation
//                                              0 → 0.0057: 166 parity-odd
//                                              samples, ALL outside the box,
//                                              0 genuine)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8621';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const argOf = (f) => { const i = process.argv.indexOf(f); return i === -1 ? null : process.argv[i + 1]; };
const unitArg = argOf('--unit'), meshArg = argOf('--mesh');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async ([unitArg, meshArg]) => {
  const C = window.__clock;
  const THREE = await import('three');
  const { MeshBVH } = await import('/vendor/three-mesh-bvh.module.js');
  C.resetInputs();
  if (!unitArg) { C.setPose({ tension: 0.5, tau: 0.13, crownPullT: 0, leverEngage: 0 }); }
  C.render();
  const bvhs = new Map();
  const bvhOf = (g) => { let t = bvhs.get(g); if (!t) { t = new MeshBVH(g); bvhs.set(g, t); } return t; };
  const ray = new THREE.Ray();
  const parity = (tree, pt) => {
    ray.origin.copy(pt); ray.direction.set(0.317, 0.591, 0.741).normalize();
    let n = 0;
    for (const h of tree.raycast(ray, THREE.DoubleSide)) if (h.distance > 1e-9) n++;
    return (n % 2) === 1;
  };
  const mat = new THREE.Matrix4(), v = new THREE.Vector3(), e0 = new THREE.Vector3(), e1 = new THREE.Vector3();
  const collect = (obj) => {
    const ms = [];
    obj.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) ms.push(o); });
    return ms;
  };
  let pairs = [];
  if (unitArg) {
    const unit = C.labelEntries.find((e) => e.name === unitArg)?.obj;
    if (!unit) return { error: `no unit '${unitArg}'` };
    const ms = collect(unit);
    const label = (m) => m.name || `${m.geometry.type}#${ms.indexOf(m)}`;
    const target = ms.find((m) => label(m) === meshArg);
    if (!target) return { error: `no mesh '${meshArg}'`, labels: ms.map(label) };
    for (const other of ms) if (other !== target) pairs.push([target, other, `${meshArg} ⇄ ${label(other)}`]);
  } else {
    const units = C.labelEntries.map((e) => ({ name: e.name, ms: collect(e.obj) })).filter((u) => u.ms.length);
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++)
      for (const a of units[i].ms.slice(0, 2)) for (const bm of units[j].ms.slice(0, 2)) {
        a.updateWorldMatrix(true, false); bm.updateWorldMatrix(true, false);
        a.geometry.computeBoundingSphere(); bm.geometry.computeBoundingSphere();
        const ca = a.geometry.boundingSphere.center.clone().applyMatrix4(a.matrixWorld);
        const cb = bm.geometry.boundingSphere.center.clone().applyMatrix4(bm.matrixWorld);
        if (ca.distanceTo(cb) - a.geometry.boundingSphere.radius - bm.geometry.boundingSphere.radius > 0.5) continue;
        pairs.push([a, bm, `${units[i].name} ⇄ ${units[j].name}`]);
      }
  }
  const stride = unitArg ? 1 : 7;                  // witness mode is full density
  let samples = 0, p2Viol = 0;
  const lies = [], genuine = [];
  for (const [A, B, name] of pairs) {
    for (const [src, dst] of [[B, A], [A, B]]) {
      const tree = bvhOf(dst.geometry);
      const box = tree.getBoundingBox(new THREE.Box3());
      mat.copy(dst.matrixWorld).invert().multiply(src.matrixWorld);
      const pos = src.geometry.attributes.position;
      let best = Infinity;
      const test = (pt) => {
        samples++;
        const boxD = box.distanceToPoint(pt);
        const hit = tree.closestPointToPoint(pt, {}, 0, best);
        const hd = hit ? hit.distance : Infinity;
        if (boxD >= best && hd < best) p2Viol++;
        if (hd < best) best = hd;
        if (parity(tree, pt)) {
          const row = { pair: name, boxD: +boxD.toFixed(5) };
          if (boxD > 0) { if (lies.length < 24) lies.push(row); }
          else if (genuine.length < 8) genuine.push(row);
        }
      };
      for (let k = 0; k < pos.count; k += stride) test(v.fromBufferAttribute(pos, k).applyMatrix4(mat));
      const idx = src.geometry.index;
      if (idx) for (let t3 = 0; t3 < idx.count; t3 += 3 * stride) {
        for (const [i0, i1] of [[0, 1], [1, 2], [2, 0]]) {
          e0.fromBufferAttribute(pos, idx.getX(t3 + i0));
          e1.fromBufferAttribute(pos, idx.getX(t3 + i1));
          test(v.addVectors(e0, e1).multiplyScalar(0.5).applyMatrix4(mat));
        }
      }
    }
  }
  return { pairs: pairs.length, samples, p2Viol,
    parityLiesOutsideBox: lies.length, genuineInside: genuine.length, lies, genuine };
}, [unitArg, meshArg]);
if (out.error) { console.log('ERROR', JSON.stringify(out)); process.exit(2); }
console.log(`pairs ${out.pairs} · samples ${out.samples} · P2 violations ${out.p2Viol} (distance cut unsound if > 0)`);
console.log(`parity-odd outside the box (baseline lies): ${out.parityLiesOutsideBox}${out.parityLiesOutsideBox ? '' : ' — none seen at this stride'}`);
for (const l of out.lies.slice(0, 8)) console.log(`  LIE  ${l.pair}  boxD ${l.boxD}`);
console.log(`genuine inside-box odd samples: ${out.genuineInside}`);
process.exit(out.p2Viol ? 1 : 0);
