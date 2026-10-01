// TODO 159 — DOES A DISTANCE COME BACK IN WORLD UNITS WHEN A MESH IS SCALED?
// An ACCEPTANCE test, browser-free: controls with exact answers, in both
// argument orders, for `meshClearance` (and through it `sampledVerdict`, which
// arbitrates its near-zeros).
//
// THE DEFECT IT HOLDS CLOSED. `_meshClearanceInner(a, b)` used to query `a`'s
// tree with inverse(a.matrixWorld) · b.matrixWorld, so every distance came back
// in `a`'s LOCAL units. The minute jumper's lifter bar is cut at unit length and
// stretched onto its span (scale.x ≈ 37–40), and bar-first read 0.1189 to a tab
// 3.4 u away. The fix measures every mesh through a RIGID frame (`rigidFrame` in
// src/inspect.js: a non-rigid linear part is baked into a cached copy of the
// geometry), so it is exact in both orders and with both meshes stretched.
//
// WHAT IT MEASURES.
//   · EXACT ROWS — two boxes with an analytic gap, one or both stretched,
//     rotated, uniformly scaled, or sheared (a rotated child in a stretched
//     parent). Each must read its gap to 1e-6 in BOTH orders.
//   · BRUTE ROWS — seeded random poses of a stretched / shrunk / sheared body
//     against a 960-triangle sphere, checked against an
//     independent brute-force minimum over every triangle pair in WORLD space
//     (vertex–face and edge–edge, Ericson's segment–segment). Both orders. The
//     body alternates between a 12-triangle box (ONE leaf — the shape of the
//     lifter and the spring blades) and a 160-triangle ellipsoid (MANY leaves —
//     the shape of the ribbons), because a single-leaf tree is never pruned at
//     all: shapecast does not consult the root's bounds, so a box-only run
//     cannot see a pruning error on the scaled side.
//   · SWAP ROWS — the fix the TODO named first, emulated with the raw library
//     call: put the RIGID mesh's tree first and carry the scaled one into it.
//     That fixes the units, and these rows ask whether it also fixes the
//     search. They are a REPORT about the rejected design (they print, never
//     gate): a non-rigid map reaches the library's OBB pruning bounds.
//   · CONTROLS — a must-hit (an overlapping stretched pair reads 0), and a
//     rigid pair, which must read what it always read.
//
// Run it against another tree to see the defect: the `INSPECT` env var names
// the inspect.js to load (default this tree's). On main before TODO 159 the
// exact rows fail in the stretched-first order.
//
// WHICH PROBES THIS IS NOT. `probe-149-lifter-width.mjs` measures the real
// lifter in the movement (and its identity control could not see this defect,
// because proxy and bar were measured the same wrong way); `probe-95-*` test the
// closedness guard on real pairs. This one has no movement at all — its answers
// are known before it runs, which is what lets it gate.
//
// Usage: node --import ./tools/three-node-loader.mjs tools/probe-159-frame-scale.mjs
//        INSPECT=/path/to/other/src/inspect.js node --import ./tools/three-node-loader.mjs tools/probe-159-frame-scale.mjs
import * as THREE from 'three';
import { pathToFileURL } from 'node:url';

const here = new URL('.', import.meta.url);
const inspectUrl = process.env.INSPECT ? pathToFileURL(process.env.INSPECT).href : new URL('../src/inspect.js', here).href;
const I = await import(inspectUrl);
const TOL = 1e-6;

let failures = 0;
const fail = (m) => { failures++; console.log(`FAIL  ${m}`); };
const f6 = (x) => (Number.isFinite(x) ? x.toFixed(6) : String(x));

// ---- independent truth: brute force over every triangle pair, in WORLD space
const worldTris = (mesh) => {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const n = idx ? idx.count : pos.count, at = (k) => (idx ? idx.getX(k) : k);
  const out = [];
  for (let t = 0; t < n; t += 3) {
    out.push([0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pos, at(t + j)).applyMatrix4(mesh.matrixWorld)));
  }
  return out;
};
// Ericson, Real-Time Collision Detection §5.1.9
const segSeg = (p1, q1, p2, q2) => {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-20 && e <= 1e-20) return p1.distanceTo(p2);
  if (a <= 1e-20) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1.dot(r);
    if (e <= 1e-20) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
};
const _tri = new THREE.Triangle(), _cp = new THREE.Vector3();
const triTri = (A, B) => {   // exact for DISJOINT triangles
  let best = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) {
    _tri.set(Q[0], Q[1], Q[2]);
    for (const p of P) { _tri.closestPointToPoint(p, _cp); best = Math.min(best, p.distanceTo(_cp)); }
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    best = Math.min(best, segSeg(A[i], A[(i + 1) % 3], B[j], B[(j + 1) % 3]));
  return best;
};
const brute = (a, b) => {
  const TA = worldTris(a), TB = worldTris(b);
  let best = Infinity;
  for (const x of TA) for (const y of TB) best = Math.min(best, triTri(x, y));
  return best;
};

const place = (mesh, { p = [0, 0, 0], s = [1, 1, 1], rz = 0, rx = 0, parent = null } = {}) => {
  mesh.position.set(...p); mesh.scale.set(...s); mesh.rotation.set(rx, 0, rz);
  if (parent) parent.add(mesh);
  (parent || mesh).updateMatrixWorld(true);
  mesh.updateWorldMatrix(true, false);
  return mesh;
};
const box = () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
const blob = () => new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 9));   // unit-diameter: the box's reach rule holds

// ---- EXACT ROWS: analytic gaps ----------------------------------------------
const exact = [];
{
  const A = place(box());   // unit cube, [-0.5, 0.5]^3
  // 1. the lifter's case: a bar stretched ×36 along the gap's axis, gap 3.4
  exact.push({ name: 'stretch ×36, gap along the stretch', a: A, b: place(box(), { p: [0.5 + 3.4 + 18, 0, 0], s: [36, 1, 1] }), want: 3.4 });
  // 2. stretched bar turned 90° — the stretch now lies along world y, the gap too
  exact.push({ name: 'stretch ×36 turned 90°, gap 0.3 along it', a: A, b: place(box(), { p: [0, 0.5 + 0.3 + 18, 0], s: [36, 1, 1], rz: Math.PI / 2 }), want: 0.3 });
  // 3. uniform scale ×2 — distances must not come back halved
  exact.push({ name: 'uniform ×2, gap 0.6', a: A, b: place(box(), { p: [0.5 + 0.6 + 1, 0, 0], s: [2, 2, 2] }), want: 0.6 });
  // 4. uniform shrink ×0.25
  exact.push({ name: 'uniform ×0.25, gap 0.6', a: A, b: place(box(), { p: [0.5 + 0.6 + 0.125, 0, 0], s: [0.25, 0.25, 0.25] }), want: 0.6 });
  // 5. BOTH stretched, corner to corner: gap (0.3, 0.4) → 0.5
  const A10 = place(box(), { s: [10, 1, 1] });   // x [-5, 5], y [-0.5, 0.5]
  exact.push({ name: 'both stretched (×10, ×36 turned 90°), corner gap 0.5', a: A10,
    b: place(box(), { p: [5 + 0.3 + 0.5, 0.5 + 0.4 + 18, 0], s: [36, 1, 1], rz: Math.PI / 2 }), want: 0.5 });
  // 6. a SHEAR: a child turned 90° inside a parent stretched ×4 along x. The
  //    child's box is then 4 wide in world x, 1 in y: x [-2, 2] about its
  //    centre. A 90° turn keeps the columns orthogonal, so this is the
  //    scale-bake path with the stretch on a non-innermost axis.
  const par = new THREE.Group(); par.scale.set(4, 1, 1); par.position.set(0, 0.5 + 0.7 + 0.5, 0);
  exact.push({ name: 'child turned 90° in a parent stretched ×4, gap 0.7', a: A, b: place(box(), { rz: Math.PI / 2, parent: par }), want: 0.7 });
  // 7. a TRUE shear: 45° inside a ×3 parent. World box corners are known
  //    in closed form: the child's corner (±.5,±.5) turns to (0,±.707) / (±.707,0)
  //    and the parent stretches x by 3 — a rhombus with vertices (±2.1213, 0),
  //    (0, ±0.7071). Placed with its lower vertex 0.25 above the cube's top face
  //    and centred over it, the gap is 0.25 (vertex to face).
  const par2 = new THREE.Group(); par2.scale.set(3, 1, 1); par2.position.set(0, 0.5 + 0.25 + Math.SQRT1_2, 0);
  exact.push({ name: 'TRUE shear: 45° child in a ×3 parent, gap 0.25', a: A, b: place(box(), { rz: Math.PI / 4, parent: par2 }), want: 0.25 });
}
console.log('EXACT ROWS (want to 1e-6, both orders)');
for (const r of exact) {
  const ab = I.meshClearance(r.a, r.b), ba = I.meshClearance(r.b, r.a), bf = brute(r.a, r.b);
  const ok = Math.abs(ab - r.want) <= TOL && Math.abs(ba - r.want) <= TOL;
  if (Math.abs(bf - r.want) > TOL) fail(`${r.name}: the brute-force truth reads ${f6(bf)} against the analytic ${r.want} — the CONTROL is wrong`);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(56)} want ${f6(r.want)}  a,b ${f6(ab)}  b,a ${f6(ba)}  brute ${f6(bf)}`);
  if (!ok) failures++;
}

// ---- CONTROLS ---------------------------------------------------------------
{
  const A = place(box());
  const hit = place(box(), { p: [0.5 + 18 - 0.2, 0, 0], s: [36, 1, 1] });   // overlaps the cube by 0.2
  const h1 = I.meshClearance(A, hit), h2 = I.meshClearance(hit, A);
  console.log(`${h1 <= 0 && h2 <= 0 ? 'ok  ' : 'FAIL'}  MUST-HIT: stretched bar 0.2 into the cube reads ${f6(h1)} / ${f6(h2)} (≤ 0)`);
  if (!(h1 <= 0 && h2 <= 0)) failures++;
  const rig = place(box(), { p: [1.75, 0.3, 0], rz: 0.4 });
  const r1 = I.meshClearance(A, rig), r2 = I.meshClearance(rig, A), rb = brute(A, rig);
  const ok = Math.abs(r1 - rb) <= TOL && Math.abs(r2 - rb) <= TOL;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  RIGID: a rigid pair reads the brute force ${f6(rb)}: ${f6(r1)} / ${f6(r2)}`);
  if (!ok) failures++;
}

// ---- BRUTE ROWS: seeded random poses against a many-leaf tree ----------------
let seed = 159;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sphere = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 16));
place(sphere);
const N = +(process.env.TRIALS || 120);
const swapKinds = [];
let bruteBad = 0, swapBad = 0, swapWorst = 0, oldBad = 0, pierced = 0, inBand = 0, bandWorst = 0, measured = 0;
const worldSphere = sphere.geometry.clone().applyMatrix4(sphere.matrixWorld); worldSphere.computeBoundsTree();
const rows = [];
for (let k = 0; k < N; k++) {
  const sh = rnd() < 0.3;   // 30% of trials sheared: a turned child in a stretched parent
  const s = [0.2 + rnd() * 40, 0.3 + rnd() * 2, 0.3 + rnd() * 2];
  const dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
  const reach = 3 + 0.1 + rnd() * 2 + Math.max(...s) * 0.5;
  let m;
  if (sh) {
    const par = new THREE.Group(); par.scale.set(...s); par.position.copy(dir.clone().multiplyScalar(reach)); par.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    m = place(k % 2 ? blob() : box(), { rz: rnd() * 3, rx: rnd() * 3, parent: par });
  } else {
    m = place(k % 2 ? blob() : box(), { p: dir.clone().multiplyScalar(reach).toArray(), s, rz: rnd() * 6.3, rx: rnd() * 6.3 });
  }
  // The brute force is exact only for DISJOINT pairs, and a pierced pair
  // can still read a positive tri-tri minimum, so intersection is decided
  // first — on WORLD-baked copies, which owe nothing to inspect.js.
  const wm = m.geometry.clone().applyMatrix4(m.matrixWorld); wm.computeBoundsTree();
  if (worldSphere.boundsTree.intersectsGeometry(wm, new THREE.Matrix4())) { pierced++; continue; }
  const bf = brute(sphere, m);
  // Inside 0.05 meshClearance hands its answer to sampledVerdict, whose
  // vertex-and-midpoint sampler cannot see an edge–edge minimum and may only
  // RAISE the library's figure (`Math.max(d, v.d)`) — a property of the
  // arbitration, rigid frames included, and not this item's. Those trials are
  // gated on the library query through rigidFrame instead, where it exists.
  const band = bf < 0.05;
  const ab = I.meshClearance(sphere, m), ba = I.meshClearance(m, sphere);
  let raw = null;
  if (band && I.rigidFrame) {
    const vs = I.rigidFrame(sphere), vm = I.rigidFrame(m);
    const M = vs.frame.clone().invert().multiply(vm.frame);
    const h = vs.geometry.boundsTree.closestPointToGeometry(vm.geometry, M, {}, {}, 0, Infinity);
    raw = h ? h.distance : Infinity;
  }
  if (band) {
    inBand++;
    bandWorst = Math.max(bandWorst, ab - bf, ba - bf);
    if (raw !== null && Math.abs(raw - bf) > TOL) { bruteBad++; rows.push(`  trial ${k}${sh ? ' (shear)' : ''}: brute ${f6(bf)}  rigid-frame library ${f6(raw)}`); }
  } else if (Math.abs(ab - bf) > TOL || Math.abs(ba - bf) > TOL) { bruteBad++; if (bruteBad <= 5) rows.push(`  trial ${k}${sh ? ' (shear)' : ''}: brute ${f6(bf)}  sphere,box ${f6(ab)}  box,sphere ${f6(ba)}`); }
  measured++;
  // the SWAP design, emulated: rigid tree first, scaled mesh carried in, raw library call
  const bvh = sphere.geometry.boundsTree || (sphere.geometry.computeBoundsTree(), sphere.geometry.boundsTree);
  if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
  const M = sphere.matrixWorld.clone().invert().multiply(m.matrixWorld);
  const hit = bvh.closestPointToGeometry(m.geometry, M, {}, {}, 0, Infinity);
  const sw = hit ? hit.distance : Infinity;
  if (Math.abs(sw - bf) > TOL) {
    swapBad++; swapWorst = Math.max(swapWorst, sw - bf);
    swapKinds.push(`${sh ? 'sheared' : 'stretched'} ${k % 2 ? 'ellipsoid' : 'box'} (min stretch ${Math.min(...s).toFixed(2)}): ${f6(sw)} for ${f6(bf)}`);
  }
  // and the OLD order — the scaled mesh's tree first, the defect itself
  const Mo = m.matrixWorld.clone().invert().multiply(sphere.matrixWorld);
  const ho = m.geometry.boundsTree.closestPointToGeometry(sphere.geometry, Mo, {}, {}, 0, Infinity);
  if (Math.abs((ho ? ho.distance : Infinity) - bf) > TOL) oldBad++;
}
console.log(`\nBRUTE ROWS: ${N} seeded poses of a stretched/shrunk/sheared box or ellipsoid against a 960-triangle sphere`);
console.log(`      ${measured} disjoint and measured, ${pierced} pierced (skipped), ${inBand} inside the 0.05 arbitration band`);
console.log(`${bruteBad === 0 ? 'ok  ' : 'FAIL'}  meshClearance, both orders, against the brute force: ${bruteBad} off by more than ${TOL}`);
for (const r of rows) console.log(r);
if (bruteBad) failures++;
if (measured < N / 2) fail(`only ${measured} of ${N} trials were measured — the trial generator no longer exercises the query`);
if (!I.rigidFrame && inBand) console.log(`      (no rigidFrame in this inspect.js — the ${inBand} band trial(s) were not gated)`);
console.log(`REPORT  in-band, meshClearance over the brute force by at most ${f6(bandWorst)} (sampledVerdict's max(), not the frame)`);
console.log(`REPORT  raw library, SCALED tree first (the defect): ${oldBad} of ${measured} off`);
console.log(`REPORT  raw library, RIGID tree first (the swap):    ${swapBad} of ${measured} off, worst over-read ${f6(swapWorst)}`);
for (const r of swapKinds) console.log(`          ${r}`);

console.log(`\n${failures ? `FAIL — ${failures} failure(s)` : 'PASS'}  (inspect: ${inspectUrl.replace(/^.*?([^/]+\/src\/inspect\.js)$/, '$1')})`);
process.exit(failures ? 1 : 0);
