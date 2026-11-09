#!/usr/bin/env node
// §338 landing 5 — G3, KERNEL PARITY: does the compiled kernel answer what the JS
// reference answers, and where it does not, is it the truer of the two?
//
//   node tools/probe-338-kernel-parity.mjs                      the primitives, on known and random geometry
//   node tools/probe-338-kernel-parity.mjs --reports JS WASM    two battery-native --report files of one tree
//
// Acceptance (exits non-zero on any failure).
//
// THE PRIMITIVE (default mode). src/kernel.js' wasm `distance` against:
//   · analytic pairs whose distance is known in closed form (parallel faces, vertex
//     over face, skew edges, piercing, coplanar overlap and apart, past the bound);
//   · random triangle soups under random rigid maps, against three-mesh-bvh's
//     closestPointToGeometry (the reference) and a DENSE UPPER BOUND that shares no
//     code with either: barycentric samples on one mesh, each measured to the other
//     with the reference's exact point query. A distance can never exceed a sampled
//     pair, so wasm over the bound is a wasm defect; where the reference reads 0 for a
//     pair the dense bound puts apart, that is the reference's documented false-0
//     (inspect.js' meshClearance), counted and reported, never held against wasm.
//
// THE BATTERY (--reports). Since §338 landing 8 the js body IS the kernel's algorithm
// (src/exact-mesh.js), so G3 asks for IDENTITY:
//   1. every BATTERY row's gate reaches the SAME verdict on both reports (each row's
//      own `fails`, standing rule 4's one definition);
//   2. the `census` counters (work done, not findings) are excluded BY NAME and
//      counted, report-diff's rule for timing;
//   3. every other leaf is equal, a minimum's WITNESS (`at`, `refinedAt`, `meshes`)
//      included. Until landing 8 the reference was three-mesh-bvh, and a witness
//      could move between two arithmetics' exact ties and a kernel leaf read smaller
//      than the reference's sampled upper bound after its false 0; both were
//      listed. Now either is a port defect, and fails.
// Its control plants a larger leaf and a moved verdict into a copy of the kernel's
// report, and fails unless both are caught.
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const fails = [];
const line = (ok, s) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${s}`); if (!ok) fails.push(s); };

if (argv[0] === '--reports') {
  const [jsFile, wasmFile] = argv.slice(1);
  if (!jsFile || !wasmFile) { console.error('usage: probe-338-kernel-parity.mjs --reports JS.json WASM.json'); process.exit(2); }
  const { BATTERY } = await import('./battery-checks.mjs');
  const [J, Wr] = [jsFile, wasmFile].map((f) => JSON.parse(readFileSync(f, 'utf8')));
  if ((J.kernel ?? 'js') !== 'js' || Wr.kernel !== 'wasm') throw new Error(`--reports wants a js report then a wasm report (got ${J.kernel ?? 'js'}, ${Wr.kernel})`);

  const WITNESS = new Set(['at', 'refinedAt', 'meshes']);
  const verdict = (e, r) => { const f = e.fails(r); return Array.isArray(f) ? f.length : (f ? 1 : 0); };
  const judge = (Jc, Wc) => {
    const out = { verdicts: [], larger: [], smaller: [], other: [], census: 0, witness: [], leaves: 0, ran: 0 };
    for (const e of BATTERY) {
      const a = Jc[e.name], b = Wc[e.name];
      if (!a || !b || a.neverRan || b.neverRan) continue;
      out.ran++;
      const va = verdict(e, a.result), vb = verdict(e, b.result);
      if (va !== vb) out.verdicts.push(`${e.name}: js ${va ? `FAIL (${va})` : 'PASS'}, wasm ${vb ? `FAIL (${vb})` : 'PASS'}`);
      const walk = (x, y, path) => {
        if (typeof x === 'number' && typeof y === 'number') {
          out.leaves++;
          if (Object.is(x, y)) return;
          (y < x ? out.smaller : y > x ? out.larger : out.other).push(`${path}: js ${x}, wasm ${y}`);
          return;
        }
        if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') {
          out.leaves++;
          if (x !== y) out.other.push(`${path}: js ${JSON.stringify(x)}, wasm ${JSON.stringify(y)}`);
          return;
        }
        if (Array.isArray(x) !== Array.isArray(y) || (Array.isArray(x) && x.length !== y.length)) { out.other.push(`${path}: shape differs`); return; }
        for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
          if (k === 'census') { out.census++; continue; }
          if (WITNESS.has(k)) { if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.witness.push(`${path}.${k}: js ${JSON.stringify(x[k])}, wasm ${JSON.stringify(y[k])}`); continue; }
          if (k === 'ms' || k === 'sliceMs' || /Ms$/.test(k)) continue;
          if (!(k in x) || !(k in y)) { out.other.push(`${path}.${k}: present on one side only`); continue; }
          walk(x[k], y[k], Array.isArray(x) ? `${path}[${k}]` : `${path}.${k}`);
        }
      };
      walk(a.result, b.result, e.name);
    }
    return out;
  };

  // The control: a larger leaf and a moved verdict, planted into a copy.
  {
    const C = JSON.parse(JSON.stringify(Wr.checks));
    let planted = null;
    const plant = (o, path) => {
      if (planted || !o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        if (planted) return;
        if (k === 'census' || k === 'ms' || /Ms$/.test(k)) continue;
        if (typeof o[k] === 'number' && o[k] > 0 && Number.isFinite(o[k])) { o[k] = o[k] * 2; planted = `${path}.${k}`; return; }
        plant(o[k], `${path}.${k}`);
      }
    };
    for (const n of ['clearances', 'expectedContacts', 'undeclaredClearance']) if (!planted && C[n] && !C[n].neverRan) plant(C[n].result, n);
    const support = BATTERY.find((e) => e.name === 'support');
    let moved = false;
    if (support && C.support && !C.support.neverRan) {
      const r = C.support.result;
      for (const k of ['failures', 'violations', 'rows']) if (Array.isArray(r[k])) { r[k] = [...r[k], { planted: true, ok: false }]; moved = verdict(support, r) !== verdict(support, Wr.checks.support.result); if (moved) break; }
    }
    const c = judge(J.checks, C);
    line(!!planted && c.larger.length >= 1 && moved && c.verdicts.length >= 1,
      `control: a doubled leaf (${planted ?? 'none planted'}) and a moved support verdict are both caught (${c.larger.length} larger, ${c.verdicts.length} verdict(s))`);
  }

  const r = judge(J.checks, Wr.checks);
  line(r.verdicts.length === 0, `every gate reaches the same verdict on both kernels (${r.ran} checks ran on both)${r.verdicts.length ? ': ' + r.verdicts.join('; ') : ''}`);
  line(r.larger.length === 0, `no kernel distance reads LARGER than the reference (${r.leaves} leaves compared, ${r.census} census blocks excluded by name)`);
  for (const s of r.larger.slice(0, 10)) console.log(`          LARGER ${s}`);
  line(r.other.length === 0, `no leaf differs in any other way (strings, shapes, presence)`);
  for (const s of r.other.slice(0, 10)) console.log(`          OTHER ${s}`);
  line(r.witness.length === 0, `no witness differs (where a minimum was found, and between which meshes)`);
  for (const s of r.witness.slice(0, 10)) console.log(`          WITNESS ${s}`);
  line(r.smaller.length === 0, `no kernel distance reads SMALLER either: the two reports are leaf-identical (${r.leaves} leaves)`);
  for (const s of r.smaller.slice(0, 20)) console.log(`          SMALLER ${s}`);
  console.log(`\n${fails.length ? `FAIL — ${fails.length} gate(s)` : 'PASS — the compiled kernel\'s report is the reference\'s, leaf for leaf'}`);
  process.exit(fails.length ? 1 : 0);
}

// ---------------------------------------------------------------------------
// The primitive.
const T = await import('../vendor/three.module.js');
const { computeBoundsTree } = await import('../vendor/three-mesh-bvh.module.js');
T.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
const K = await import('../src/kernel.js');
const { KERNEL_WASM_SHA256 } = await import('../src/kernel-wasm.js');
await K.useKernel('wasm');
console.log(`kernel ${KERNEL_WASM_SHA256.slice(0, 16)}…`);

const geo = (pts) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3)); return g; };
const tr = (x, y, z) => new T.Matrix4().makeTranslation(x, y, z);
const tri = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
const ANALYTIC = [
  ['parallel faces 0.5 apart', geo(tri), geo(tri), tr(0, 0, 0.5), 0.5],
  ['a vertex over a face', geo(tri), geo([[0.25, 0.25, 0.5], [0.25, 0.25, 2], [1, 1, 2]]), new T.Matrix4(), 0.5],
  ['skew edges 0.25 apart', geo([[0, 0, 0], [1, 0, 0], [0.5, -1, 0]]), geo([[0.5, -0.5, 0.25], [0.5, 0.5, 0.25], [0.5, 0, 3]]), new T.Matrix4(), 0.25],
  ['an edge piercing a face', geo(tri), geo([[0.25, 0.25, -1], [0.25, 0.25, 1], [0.5, 0.25, 1]]), new T.Matrix4(), 0],
  ['coplanar, overlapping', geo(tri), geo(tri), tr(0.125, 0.125, 0), 0],
  ['coplanar, 1 apart', geo(tri), geo(tri), tr(2, 0, 0), 1],
  ['3 apart, the bound 2', geo(tri), geo(tri), tr(0, 0, 3), Infinity, 2],
];
let bad = 0;
for (const [name, a, b, m, want, upper = Infinity] of ANALYTIC) {
  const got = K.wasmDistance(a, b, m.elements, upper);
  if (!(want === Infinity ? got === Infinity : got === want)) { bad++; console.log(`          ${name}: ${got}, want ${want}`); }
}
line(bad === 0, `analytic: ${ANALYTIC.length} pairs with closed-form distances read exactly (every coordinate a binary fraction)`);

// Random soups: deterministic LCG, so a failure names a seed.
let seed = 0x338;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
const soup = (n, c, s) => { const pts = []; for (let t = 0; t < n; t++) { const o = [c[0] + (rnd() - 0.5) * s, c[1] + (rnd() - 0.5) * s, c[2] + (rnd() - 0.5) * s]; for (let k = 0; k < 3; k++) pts.push([o[0] + (rnd() - 0.5) * 0.4, o[1] + (rnd() - 0.5) * 0.4, o[2] + (rnd() - 0.5) * 0.4]); } return geo(pts); };
const dense = (A, B, m, N, cap) => {
  const p = B.attributes.position, v = [new T.Vector3(), new T.Vector3(), new T.Vector3()], q = new T.Vector3();
  let best = cap;
  for (let t = 0; t < p.count; t += 3) {
    for (let c = 0; c < 3; c++) v[c].fromBufferAttribute(p, t + c).applyMatrix4(m);
    for (let i = 0; i <= N; i++) for (let j = 0; i + j <= N; j++) {
      q.set(0, 0, 0).addScaledVector(v[0], 1 - (i + j) / N).addScaledVector(v[1], i / N).addScaledVector(v[2], j / N);
      const r = A.boundsTree.closestPointToPoint(q, {}, 0, best);
      if (r && r.distance < best) best = r.distance;
    }
  }
  return best;
};
const PAIRS = 300;
let agree = 0, refFalseZero = 0, over = 0, mismatch = 0, worst = 0;
const why = [];
for (let k = 0; k < PAIRS; k++) {
  const sep = rnd() * 3;
  // Unequal sizes on every other pair, both ways round.
  const A = soup(k % 2 ? 12 : 30, [0, 0, 0], 2), B = soup(k % 2 ? 40 : 30, [0, 0, 0], 2);
  const m = new T.Matrix4().makeRotationFromEuler(new T.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3)).setPosition(sep, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5);
  // Every fifth map sheared and scaled: the kernel's box bounds must hold for any
  // affine map, not only the rigid ones inspect.js hands it (rigidFrame).
  if (k % 5 === 0) m.multiply(new T.Matrix4().set(1 + rnd(), 0.4 * rnd(), 0, 0, 0, 1, 0.3 * rnd(), 0, 0.2 * rnd(), 0, 0.6 + rnd(), 0, 0, 0, 0, 1));
  A.computeBoundsTree(); B.computeBoundsTree();
  const upper = rnd() < 0.3 ? 0.5 + rnd() : Infinity;
  const w = K.wasmDistance(A, B, m.elements, upper);
  const hit = A.boundsTree.closestPointToGeometry(B, m, {}, {}, 0, upper);
  const ref = hit ? hit.distance : Infinity;
  const ub = dense(A, B, m, 8, Number.isFinite(upper) ? upper : Infinity);
  if (w < upper && !(w <= ub + 1e-12)) { over++; why.push(`pair ${k}: wasm ${w} over the dense bound ${ub}`); continue; }
  const refUnder = ref < upper, wUnder = w < upper;
  if (refUnder && ref === 0 && w > 0) { refFalseZero++; continue; }
  if (refUnder !== wUnder) { mismatch++; why.push(`pair ${k}: js ${ref}, wasm ${w}, bound ${upper}`); continue; }
  if (refUnder) { const d = Math.abs(ref - w); worst = Math.max(worst, d); if (d > 1e-12) { mismatch++; why.push(`pair ${k}: js ${ref}, wasm ${w}`); continue; } }
  agree++;
}
for (const s of why.slice(0, 6)) console.log(`          ${s}`);
line(over === 0, `random: no wasm distance over the dense upper bound (${PAIRS} soup pairs, 30 × 30 and 12 × 40 triangles, a fifth of the maps sheared, 45 samples a triangle)`);
line(mismatch === 0, `random: wasm agrees with the reference within 1e-12 wherever the reference reads no false 0 (${agree} agree, worst ${worst.toExponential(2)})`);
console.log(`  REPORT the reference read 0 for ${refFalseZero} pair(s) the kernel puts apart (its false-0 mode; the dense bound decides, above)`);

// The control: a kernel whose answer is off by a known amount must fail the agreement test.
{
  const A = soup(30, [0, 0, 0], 2), B = soup(30, [0, 0, 0], 2);
  A.computeBoundsTree(); B.computeBoundsTree();
  const m = tr(3, 0, 0);
  const ref = A.boundsTree.closestPointToGeometry(B, m, {}, {}, 0, Infinity).distance;
  const w = K.wasmDistance(A, B, m.elements, Infinity);
  const ub = dense(A, B, m, 8, Infinity);
  line(Math.abs(ref - w) <= 1e-12 && !(w * 1.001 <= ub + 1e-12 && Math.abs(ref - w * 1.001) <= 1e-12),
    `control: a kernel answer 0.1% long (${(w * 1.001).toFixed(6)} for ${w.toFixed(6)}) fails the agreement test the real one passes`);
}
// ---------------------------------------------------------------------------
// §338 landing 6 — the BOOLEAN. src/kernel.js' wasm `intersects` against:
//   · analytic pairs (an edge piercing a face, apart, coplanar overlapping, two
//     triangles sharing one corner, coplanar 1 apart, one face exactly on the
//     other's plane but beside it);
//   · random soups under random affine maps, against three-mesh-bvh's
//     intersectsGeometry and an independent BRUTE FORCE written here (every pair's
//     six edges against the other triangle, Möller–Trumbore in JS). Where the
//     reference and the kernel part, the brute force and the reference's own
//     nonzero distance decide; a reference `true` they both refute is its
//     recorded false-positive mode, counted and reported, never held against wasm;
//   · consistency: the kernel's boolean is exactly "its distance is 0".
{
  const ANALYTIC_B = [
    ['an edge piercing a face', geo(tri), geo([[0.25, 0.25, -1], [0.25, 0.25, 1], [0.5, 0.25, 1]]), new T.Matrix4(), true],
    ['parallel faces 0.5 apart', geo(tri), geo(tri), tr(0, 0, 0.5), false],
    ['coplanar, overlapping', geo(tri), geo(tri), tr(0.125, 0.125, 0), true],
    ['two triangles sharing one corner', geo(tri), geo([[1, 0, 0], [2, 0, 1], [2, 1, 1]]), new T.Matrix4(), true],
    ['coplanar, 1 apart', geo(tri), geo(tri), tr(2, 0, 0), false],
    ['crossing the plane beside the face', geo(tri), geo([[2, 0.25, -1], [2, 0.25, 1], [2.5, 0.25, 1]]), new T.Matrix4(), false],
  ];
  let badB = 0;
  for (const [name, a, b, m, want] of ANALYTIC_B) {
    const got = K.wasmIntersects(a, b, m.elements);
    if (got !== want) { badB++; console.log(`          ${name}: ${got}, want ${want}`); }
  }
  line(badB === 0, `boolean, analytic: ${ANALYTIC_B.length} pairs answer as constructed`);

  const brute = (A, B, m) => {
    const tris = (g, M) => { const p = g.attributes.position, out = []; const v = new T.Vector3();
      for (let t = 0; t < p.count; t += 3) { const c = []; for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, t + k); if (M) v.applyMatrix4(M); c.push([v.x, v.y, v.z]); } out.push(c); } return out; };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const pierce = (p, q, [a, b, c]) => { const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cr(d, e2), det = dot(e1, h); if (det === 0) return false;
      const s0 = sub(p, a), u = dot(s0, h) / det; if (u < 0 || u > 1) return false; const qq = cr(s0, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false; const t = dot(e2, qq) / det; return t >= 0 && t <= 1; };
    const TA = tris(A, null), TB = tris(B, m);
    for (const a of TA) for (const b of TB) for (let i = 0; i < 3; i++) if (pierce(a[i], a[(i + 1) % 3], b) || pierce(b[i], b[(i + 1) % 3], a)) return true;
    return false;
  };
  let agreeB = 0, refFalsePos = 0, kernelWrong = 0, inconsistent = 0, metB = 0;
  const whyB = [];
  for (let k = 0; k < PAIRS; k++) {
    const A = soup(k % 2 ? 12 : 30, [0, 0, 0], 2), B = soup(k % 2 ? 40 : 30, [0, 0, 0], 2);
    const m = new T.Matrix4().makeRotationFromEuler(new T.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3)).setPosition(0.6 + rnd() * 2.4, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5);
    if (k % 5 === 0) m.multiply(new T.Matrix4().set(1 + rnd(), 0.4 * rnd(), 0, 0, 0, 1, 0.3 * rnd(), 0, 0.2 * rnd(), 0, 0.6 + rnd(), 0, 0, 0, 0, 1));
    A.computeBoundsTree(); B.computeBoundsTree();
    const w = K.wasmIntersects(A, B, m.elements);
    const ref = A.boundsTree.intersectsGeometry(B, m);
    const dW = K.wasmDistance(A, B, m.elements, Infinity);
    if (w !== (dW === 0)) { inconsistent++; whyB.push(`pair ${k}: intersects ${w}, distance ${dW}`); }
    if (w) metB++;
    if (w === ref) { agreeB++; continue; }
    const bf = brute(A, B, m);
    const hit = A.boundsTree.closestPointToGeometry(B, m, {}, {}, 0, Infinity);
    const refD = hit ? hit.distance : Infinity;
    if (ref && !w && !bf && refD > 0) { refFalsePos++; continue; }   // the reference's false positive, refuted twice
    kernelWrong++; whyB.push(`pair ${k}: js ${ref}, wasm ${w}, brute force ${bf}, js distance ${refD}`);
  }
  for (const s0 of whyB.slice(0, 6)) console.log(`          ${s0}`);
  line(kernelWrong === 0, `boolean, random: wasm agrees with the reference, or both the brute force and the reference's distance side with it (${PAIRS} pairs, ${metB} meeting, ${agreeB} agree)`);
  line(inconsistent === 0, `boolean, random: the kernel's boolean is exactly "its distance is 0" (${PAIRS} pairs)`);
  console.log(`  REPORT the reference's intersectsGeometry said true for ${refFalsePos} pair(s) the brute force and its own distance put apart`);
  // control: the gate must fail a kernel that answers the opposite on one meeting pair
  {
    const A = geo(tri), B = geo([[0.25, 0.25, -1], [0.25, 0.25, 1], [0.5, 0.25, 1]]);
    A.computeBoundsTree(); B.computeBoundsTree();
    const m = new T.Matrix4(), ref = A.boundsTree.intersectsGeometry(B, m), w = K.wasmIntersects(A, B, m.elements);
    line(ref === true && w === true && brute(A, B, m) === true, `boolean control: a piercing pair reads true on the reference, the kernel and the brute force, so a kernel answering false there would be caught`);
  }
}

// ---------------------------------------------------------------------------
// §338 landing 7 — THE EXACT PRIMITIVES' JS BODY. src/exact-mesh.js is the kernel's
// algorithm ported operation for operation, and CONTACT (inspect.js' meshesIntersect)
// is built on it in every mode, so here the parity is not "the same verdict": it is
// Object.is on every answer — every distance, at every bound, and every meet — over
// soups under rigid and sheared maps, unindexed, indexed (a shared-vertex geometry,
// the order the kernel's intake reads an index in) and interleaved.
{
  const X = await import('../src/exact-mesh.js');
  const indexed = (g) => { const p = g.attributes.position, n = p.count, h = new T.BufferGeometry();
    // reverse the vertex order and index it back, so the index is not the identity
    const pos = new Float32Array(n * 3), idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) { const j = n - 1 - i; pos[3 * j] = p.getX(i); pos[3 * j + 1] = p.getY(i); pos[3 * j + 2] = p.getZ(i); idx[i] = j; }
    h.setAttribute('position', new T.BufferAttribute(pos, 3)); h.setIndex(new T.BufferAttribute(idx, 1)); return h; };
  const interleaved = (g) => { const p = g.attributes.position, n = p.count, buf = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { buf[4 * i] = p.getX(i); buf[4 * i + 1] = p.getY(i); buf[4 * i + 2] = p.getZ(i); buf[4 * i + 3] = 7; }
    const h = new T.BufferGeometry(); h.setAttribute('position', new T.InterleavedBufferAttribute(new T.InterleavedBuffer(buf, 4), 3, 0)); return h; };
  const N7 = 400;
  let calls = 0, differ = 0, finite = 0, met = 0, refDiffers = 0, ulpTried = 0;
  const why7 = [];
  for (let k = 0; k < N7; k++) {
    let A = soup(k % 3 ? 30 : 160, [0, 0, 0], 2), B = soup(k % 2 ? 40 : 90, [0, 0, 0], 2);
    if (k % 4 === 1) A = indexed(A);
    if (k % 4 === 2) B = interleaved(B);
    const m = new T.Matrix4().makeRotationFromEuler(new T.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3)).setPosition(0.3 + rnd() * 2.4, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5);
    if (k % 5 === 0) m.multiply(new T.Matrix4().set(1 + rnd(), 0.4 * rnd(), 0, 0, 0, 1, 0.3 * rnd(), 0, 0.2 * rnd(), 0, 0.6 + rnd(), 0, 0, 0, 0, 1));
    for (const upper of [Infinity, 0.3, 1e-4]) {
      const j = X.exactDistance(A, B, m.elements, upper), w = K.wasmDistance(A, B, m.elements, upper);
      calls++; if (j < Infinity) finite++;
      if (!Object.is(j, w)) { differ++; why7.push(`pair ${k}, bound ${upper}: js ${j}, wasm ${w}`); }
      if (upper === Infinity && k % 4 === 0 && w < Infinity) {   // the control's evidence: B one f32 ulp off must move the answer
        const p = B.attributes.position, n = p.count, nud = new Float32Array(n * 3), u = 1 + Math.pow(2, -23);
        for (let i = 0; i < n; i++) { nud[3 * i] = p.getX(i) * u; nud[3 * i + 1] = p.getY(i) * u; nud[3 * i + 2] = p.getZ(i) * u; }
        const B2 = new T.BufferGeometry(); B2.setAttribute('position', new T.BufferAttribute(nud, 3));
        ulpTried++; if (!Object.is(X.exactDistance(A, B2, m.elements, Infinity), w)) refDiffers++;
      }
    }
    const jm = X.exactMeets(A, B, m.elements), wm = K.wasmIntersects(A, B, m.elements);
    calls++; if (jm) met++;
    if (jm !== wm) { differ++; why7.push(`pair ${k}: meets js ${jm}, wasm ${wm}`); }
  }
  for (const s0 of why7.slice(0, 6)) console.log(`          ${s0}`);
  line(differ === 0, `exact, random: src/exact-mesh.js answers Object.is the kernel's answer (${calls} answers over ${N7} pairs, ${finite} finite distances, ${met} meeting; a quarter indexed, a quarter interleaved, a fifth sheared)`);
  line(refDiffers > 0 && met > 0 && met < N7, `exact control: the comparison is not vacuous — B's vertices scaled by 1 + 2^-23 (an f32 ulp where the product does not round back) move the port's answer off the kernel's on ${refDiffers} of ${ulpTried} pair(s) apart, and the population both meets and stands apart`);
}

console.log(`\n${fails.length ? `FAIL — ${fails.length} gate(s)` : 'PASS — the compiled distance and boolean are the reference\'s, exact where the reference is not, and the exact primitives\' JS body bit for bit'}`);
process.exit(fails.length ? 1 : 0);
