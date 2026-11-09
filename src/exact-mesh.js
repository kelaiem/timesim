// §338 landing 7 — THE EXACT PRIMITIVES, IN JS: the reference the compiled kernel is
// held to, bit for bit.
//
// tools/kernel/kernel.cpp answers `distance` and `intersects` exactly on the computed
// corners (its header says how). This is the same algorithm, OPERATION FOR OPERATION:
// the same tree (median split on the longest axis, Hoare's FIND with the middle
// pivot, leaves of 8), the same lazy mapping of B into A's frame (three.js'
// applyMatrix4, term for term), the same lower bounds, the same pruning margin, the
// same triangle tests in the same evaluation order, and min/max written as the
// kernel writes them (`b < a ? b : a`, never Math.min, which differs on −0 and NaN).
// JS doubles are IEEE binary64 and the kernel is built with no contraction and no
// fast-math, so the two compute the same bits, and
// tools/probe-338-kernel-parity.mjs holds them to Object.is on every answer.
//
// It exists because an EXACT question needs an exact reference in every host: the
// browser battery runs the js kernel, and three-mesh-bvh's boolean has a measured
// false-positive mode (inspect.js' meshesIntersect records it), so the contact
// predicate built on it could not be made exact by the compiled kernel alone.
// It is a measuring primitive and holds no watch law.

const LEAF = 8;
const PRUNE_PAD = 1e-12;   // kernel.cpp's PRUNE_PAD, and its derivation there
const dmin = (a, b) => (b < a ? b : a);
const dmax = (a, b) => (b > a ? b : a);

// ---------------------------------------------------------------------------
// The tree.
const cache = new WeakMap();   // geometry → its exact tree (geometries are immutable here, bvhCache's rule)

function selectK(key, idx, lo, hi, k) {
  while (hi - lo > 1) {
    const pv = key[lo + ((hi - lo) >> 1)];
    let i = lo, j = hi - 1;
    while (i <= j) {
      while (key[i] < pv) i++;
      while (key[j] > pv) j--;
      if (i <= j) {
        const tk = key[i]; key[i] = key[j]; key[j] = tk;
        const ti = idx[i]; idx[i] = idx[j]; idx[j] = ti;
        i++; j--;
      }
    }
    if (k <= j) hi = j + 1;
    else if (k >= i) lo = i;
    else return;
  }
}

// §338 landing 9 — A MORPHING MESH IS REFITTED, NOT REBUILT. The chain and the
// mainspring ribbon install a NEW geometry at every pose (the chain re-wraps, the
// ribbon winds), so this cache, keyed by geometry, missed on every pose: 721 builds
// of the chain's 23,856 triangles on `inspection:wind` alone, 27.5% of the battery's
// heavy check time. Both keep their TRIANGLES: the same vertices joined the same
// way. Not their index ORDER: three-mesh-bvh's computeBoundsTree reorders a
// geometry's index triples in place (the chain shares one index array across its
// geometries, the ribbon's is copied), so an index compared as written matches
// nothing. A triangle is named by its vertex triple, which a reorder moves but never
// renumbers. So a geometry of a FAMILY already built — the same vertex count, and the
// same SET of triples, every one of the family's found exactly once (an
// order-independent hash only finds the candidate) — takes the family's tree SHAPE,
// each slot holding the same triangle it held, and recomputes only what depends on
// the positions: the triangles in tree order, every leaf's box from its triangles,
// every inner box as the union of its children's (children are numbered after their
// parent, so one descending pass).
// The union of exact boxes IS the exact box of the subtree (min of mins), so every
// box is bit-identical to the one a pass over the same triangles computes; only the
// tree's shape is the family's rather than a fresh median split. And no answer
// depends on the shape: a pair is pruned only when its bound clears the best by
// PRUNE_PAD, so the distance is the exact minimum over every pair under the bound
// and the meet is true exactly when some pair meets, whatever the order of the
// visit (the compiled kernel still builds fresh, and shadow holds the two Object.is).
const families = new Map();   // `${n}:${ntri}:${hash}` → the family's built tree (its slots' triples in `slotKey`)

function intake(geometry) {
  const pos = geometry.attributes.position;
  const n = pos.count;
  const ix = geometry.index ? geometry.index.array : null;
  const ntri = ix ? Math.floor(ix.length / 3) : Math.floor(n / 3);
  // positions as the kernel receives them: f32, widened exactly
  const f32 = new Float32Array(n * 3);
  if (pos.isInterleavedBufferAttribute || pos.itemSize !== 3) for (let i = 0; i < n; i++) { f32[3 * i] = pos.getX(i); f32[3 * i + 1] = pos.getY(i); f32[3 * i + 2] = pos.getZ(i); }
  else f32.set(pos.array.subarray(0, n * 3));
  const raw = new Float64Array(ntri * 9);
  for (let t = 0; t < ntri; t++)
    for (let c = 0; c < 3; c++) {
      const v = ix ? ix[3 * t + c] : 3 * t + c;
      for (let a = 0; a < 3; a++) raw[9 * t + 3 * c + a] = f32[3 * v + a];
    }
  // each triangle named by its vertex triple, as one exact integer (n³ < 2⁵³, else no family)
  const keyed = n * n * n < 9007199254740992;
  const tkey = keyed ? new Float64Array(ntri) : null;
  let h = 0;   // order-independent: a sum of mixed triple keys, mod 2³²
  if (keyed) for (let t = 0; t < ntri; t++) {
    const k = ix ? (ix[3 * t] * n + ix[3 * t + 1]) * n + ix[3 * t + 2] : t;
    tkey[t] = k;
    let x = Math.imul((k % 4294967296) ^ Math.floor(k / 4294967296), 2654435761) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
    h = (h + x) >>> 0;
  }
  return { n, ntri, raw, tkey, famKey: keyed ? `${n}:${ntri}:${h}` : null };
}

// The family's shape, this geometry's positions; null when the triangle sets differ.
function refit(fam, raw, ntri, tkey) {
  const { nnode, left, start, count, slotKey } = fam;
  const where = new Map();
  for (let t = 0; t < ntri; t++) { if (where.has(tkey[t])) return null; where.set(tkey[t], t); }
  const order = new Int32Array(ntri);
  for (let t = 0; t < ntri; t++) { const id = where.get(slotKey[t]); if (id === undefined) return null; order[t] = id; }
  const tri = new Float64Array(ntri * 9);
  for (let t = 0; t < ntri; t++) for (let k = 0; k < 9; k++) tri[9 * t + k] = raw[9 * order[t] + k];
  const mn = new Float64Array(nnode * 3), mx = new Float64Array(nnode * 3);
  for (let slot = nnode - 1; slot >= 0; slot--) {
    const o = 3 * slot;
    mn[o] = mn[o + 1] = mn[o + 2] = Infinity;
    mx[o] = mx[o + 1] = mx[o + 2] = -Infinity;
    if (left[slot] < 0) {
      for (let t = start[slot]; t < start[slot] + count[slot]; t++)
        for (let c = 0; c < 3; c++) for (let a = 0; a < 3; a++) {
          mn[o + a] = dmin(mn[o + a], tri[9 * t + 3 * c + a]);
          mx[o + a] = dmax(mx[o + a], tri[9 * t + 3 * c + a]);
        }
    } else {
      for (const ch of [left[slot], left[slot] + 1])
        for (let a = 0; a < 3; a++) {
          mn[o + a] = dmin(mn[o + a], mn[3 * ch + a]);
          mx[o + a] = dmax(mx[o + a], mx[3 * ch + a]);
        }
    }
  }
  // the scratch AS B is per query (stamped by query id), so a family shares it
  return { ntri, nnode, tri, mn, mx, left, start, count, slotKey,
    btri: fam.btri, bmn: fam.bmn, bmx: fam.bmx, boxStamp: fam.boxStamp, triStamp: fam.triStamp };
}

export const exactStats = { builds: 0, refits: 0 };   // read by the battery's report and the probe

export function exactGeom(geometry) {
  let g = cache.get(geometry);
  if (g) return g;
  const { ntri, raw, tkey, famKey } = intake(geometry);
  const fam = famKey !== null && ntri > LEAF ? families.get(famKey) : undefined;
  if (fam) {
    g = refit(fam, raw, ntri, tkey);
    if (g) { exactStats.refits++; cache.set(geometry, g); return g; }
  }
  g = build(raw, ntri);
  exactStats.builds++;
  if (famKey !== null && ntri > LEAF) {
    g.slotKey = new Float64Array(ntri);
    for (let t = 0; t < ntri; t++) g.slotKey[t] = tkey[g.order[t]];
    families.set(famKey, g);
  }
  cache.set(geometry, g);
  return g;
}

function build(raw, ntri) {
  const cen = new Float64Array(ntri * 3), order = new Int32Array(ntri), key = new Float64Array(ntri);
  for (let t = 0; t < ntri; t++) {
    for (let a = 0; a < 3; a++) cen[3 * t + a] = (raw[9 * t + a] + raw[9 * t + 3 + a] + raw[9 * t + 6 + a]) / 3.0;
    order[t] = t;
  }
  const maxNode = ntri ? 2 * ntri : 1;
  const mn = new Float64Array(maxNode * 3), mx = new Float64Array(maxNode * 3);
  const left = new Int32Array(maxNode), start = new Int32Array(maxNode), count = new Int32Array(maxNode);
  let nnode = 1;
  const boxOf = (s, cnt, slot) => {
    mn[3 * slot] = mn[3 * slot + 1] = mn[3 * slot + 2] = Infinity;
    mx[3 * slot] = mx[3 * slot + 1] = mx[3 * slot + 2] = -Infinity;
    for (let t = s; t < s + cnt; t++) {
      const p = 9 * order[t];
      for (let c = 0; c < 3; c++) for (let a = 0; a < 3; a++) {
        mn[3 * slot + a] = dmin(mn[3 * slot + a], raw[p + 3 * c + a]);
        mx[3 * slot + a] = dmax(mx[3 * slot + a], raw[p + 3 * c + a]);
      }
    }
  };
  const split = (slot, s, cnt) => {
    boxOf(s, cnt, slot);
    start[slot] = s; count[slot] = cnt; left[slot] = -1;
    if (cnt <= LEAF) return;
    const e0 = mx[3 * slot] - mn[3 * slot], e1 = mx[3 * slot + 1] - mn[3 * slot + 1], e2 = mx[3 * slot + 2] - mn[3 * slot + 2];
    let ax = 0; let ea = e0;
    if (e1 > ea) { ax = 1; ea = e1; }
    if (e2 > ea) ax = 2;
    for (let t = s; t < s + cnt; t++) key[t] = cen[3 * order[t] + ax];
    const half = cnt >> 1;
    selectK(key, order, s, s + cnt, s + half);
    const l = nnode; nnode += 2;
    left[slot] = l;
    split(l, s, half);
    split(l + 1, s + half, cnt - half);
  };
  if (ntri) split(0, 0, ntri);
  else { mn.fill(Infinity, 0, 3); mx.fill(-Infinity, 0, 3); left[0] = -1; start[0] = 0; count[0] = 0; }
  const tri = new Float64Array(ntri * 9);
  for (let t = 0; t < ntri; t++) for (let k = 0; k < 9; k++) tri[9 * t + k] = raw[9 * order[t] + k];
  return { ntri, nnode, tri, mn, mx, left, start, count, order,
    // this geometry's scratch AS B: its triangles and boxes mapped into a query's A frame
    btri: new Float64Array(ntri * 9), bmn: new Float64Array(nnode * 3), bmx: new Float64Array(nnode * 3),
    boxStamp: new Uint32Array(nnode), triStamp: new Uint32Array(nnode) };
}

// ---------------------------------------------------------------------------
// Triangle tests (kernel.cpp's, line for line). Points are (array, offset) pairs.
function point_seg2(P, p, A, a, B, b) {
  const ab0 = B[b] - A[a], ab1 = B[b + 1] - A[a + 1], ab2 = B[b + 2] - A[a + 2];
  const ap0 = P[p] - A[a], ap1 = P[p + 1] - A[a + 1], ap2 = P[p + 2] - A[a + 2];
  const L = ab0 * ab0 + ab1 * ab1 + ab2 * ab2;
  let t = 0;
  if (L > 0) { const x = (ap0 * ab0 + ap1 * ab1 + ap2 * ab2) / L; t = x < 0 ? 0 : (x > 1 ? 1 : x); }
  const q0 = A[a] + ab0 * t, q1 = A[a + 1] + ab1 * t, q2 = A[a + 2] + ab2 * t;
  const d0 = P[p] - q0, d1 = P[p + 1] - q1, d2 = P[p + 2] - q2;
  return d0 * d0 + d1 * d1 + d2 * d2;
}
const d2p = (P, p, x, y, z) => { const a = P[p] - x, b = P[p + 1] - y, c = P[p + 2] - z; return a * a + b * b + c * c; };

function point_tri2(P, p, A, a, B, b, C, c) {
  const ab0 = B[b] - A[a], ab1 = B[b + 1] - A[a + 1], ab2 = B[b + 2] - A[a + 2];
  const ac0 = C[c] - A[a], ac1 = C[c + 1] - A[a + 1], ac2 = C[c + 2] - A[a + 2];
  const n0 = ab1 * ac2 - ab2 * ac1, n1 = ab2 * ac0 - ab0 * ac2, n2 = ab0 * ac1 - ab1 * ac0;
  if (!(n0 * n0 + n1 * n1 + n2 * n2 > 0)) return dmin(point_seg2(P, p, A, a, B, b), dmin(point_seg2(P, p, B, b, C, c), point_seg2(P, p, C, c, A, a)));
  const ap0 = P[p] - A[a], ap1 = P[p + 1] - A[a + 1], ap2 = P[p + 2] - A[a + 2];
  const d1 = ab0 * ap0 + ab1 * ap1 + ab2 * ap2, d2 = ac0 * ap0 + ac1 * ap1 + ac2 * ap2;
  if (d1 <= 0 && d2 <= 0) return d2p(P, p, A[a], A[a + 1], A[a + 2]);
  const bp0 = P[p] - B[b], bp1 = P[p + 1] - B[b + 1], bp2 = P[p + 2] - B[b + 2];
  const d3 = ab0 * bp0 + ab1 * bp1 + ab2 * bp2, d4 = ac0 * bp0 + ac1 * bp1 + ac2 * bp2;
  if (d3 >= 0 && d4 <= d3) return d2p(P, p, B[b], B[b + 1], B[b + 2]);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return d2p(P, p, A[a] + ab0 * v, A[a + 1] + ab1 * v, A[a + 2] + ab2 * v);
  }
  const cp0 = P[p] - C[c], cp1 = P[p + 1] - C[c + 1], cp2 = P[p + 2] - C[c + 2];
  const d5 = ab0 * cp0 + ab1 * cp1 + ab2 * cp2, d6 = ac0 * cp0 + ac1 * cp1 + ac2 * cp2;
  if (d6 >= 0 && d5 <= d6) return d2p(P, p, C[c], C[c + 1], C[c + 2]);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return d2p(P, p, A[a] + ac0 * w, A[a + 1] + ac1 * w, A[a + 2] + ac2 * w);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return d2p(P, p, B[b] + (C[c] - B[b]) * w, B[b + 1] + (C[c + 1] - B[b + 1]) * w, B[b + 2] + (C[c + 2] - B[b + 2]) * w);
  }
  const den = 1.0 / (va + vb + vc);
  const v = vb * den, w = vc * den;
  return d2p(P, p, A[a] + ab0 * v + ac0 * w, A[a + 1] + ab1 * v + ac1 * w, A[a + 2] + ab2 * v + ac2 * w);
}

const clamp01 = (x) => (x < 0 ? 0 : (x > 1 ? 1 : x));
function seg_seg2(P1, p1, Q1, q1, P2, p2, Q2, q2) {
  const d10 = Q1[q1] - P1[p1], d11 = Q1[q1 + 1] - P1[p1 + 1], d12 = Q1[q1 + 2] - P1[p1 + 2];
  const d20 = Q2[q2] - P2[p2], d21 = Q2[q2 + 1] - P2[p2 + 1], d22 = Q2[q2 + 2] - P2[p2 + 2];
  const r0 = P1[p1] - P2[p2], r1 = P1[p1 + 1] - P2[p2 + 1], r2 = P1[p1 + 2] - P2[p2 + 2];
  const a = d10 * d10 + d11 * d11 + d12 * d12, e = d20 * d20 + d21 * d21 + d22 * d22, f = d20 * r0 + d21 * r1 + d22 * r2;
  let s, t;
  if (!(a > 0) && !(e > 0)) return d2p(P1, p1, P2[p2], P2[p2 + 1], P2[p2 + 2]);
  if (!(a > 0)) { s = 0; t = clamp01(f / e); }
  else {
    const c = d10 * r0 + d11 * r1 + d12 * r2;
    if (!(e > 0)) { t = 0; s = clamp01(-c / a); }
    else {
      const b = d10 * d20 + d11 * d21 + d12 * d22, den = a * e - b * b;
      s = den > 0 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  const x0 = (P1[p1] + d10 * s) - (P2[p2] + d20 * t), x1 = (P1[p1 + 1] + d11 * s) - (P2[p2 + 1] + d21 * t), x2 = (P1[p1 + 2] + d12 * s) - (P2[p2 + 2] + d22 * t);
  return x0 * x0 + x1 * x1 + x2 * x2;
}

function seg_pierces(P, p, Q, q, A, a, B, b, C, c) {
  const dir0 = Q[q] - P[p], dir1 = Q[q + 1] - P[p + 1], dir2 = Q[q + 2] - P[p + 2];
  const e10 = B[b] - A[a], e11 = B[b + 1] - A[a + 1], e12 = B[b + 2] - A[a + 2];
  const e20 = C[c] - A[a], e21 = C[c + 1] - A[a + 1], e22 = C[c + 2] - A[a + 2];
  const h0 = dir1 * e22 - dir2 * e21, h1 = dir2 * e20 - dir0 * e22, h2 = dir0 * e21 - dir1 * e20;
  const det = e10 * h0 + e11 * h1 + e12 * h2;
  if (det === 0) return false;
  const inv = 1.0 / det;
  const s0 = P[p] - A[a], s1 = P[p + 1] - A[a + 1], s2 = P[p + 2] - A[a + 2];
  const u = inv * (s0 * h0 + s1 * h1 + s2 * h2);
  if (u < 0 || u > 1) return false;
  const q0 = s1 * e12 - s2 * e11, q1v = s2 * e10 - s0 * e12, q2 = s0 * e11 - s1 * e10;
  const v = inv * (dir0 * q0 + dir1 * q1v + dir2 * q2);
  if (v < 0 || u + v > 1) return false;
  const t = inv * (e20 * q0 + e21 * q1v + e22 * q2);
  return t >= 0 && t <= 1;
}

function tri_tri2(P, pi, Q, qi, best) {
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    if (seg_pierces(P, pi + 3 * i, P, pi + 3 * j, Q, qi, Q, qi + 3, Q, qi + 6)) return 0;
    if (seg_pierces(Q, qi + 3 * i, Q, qi + 3 * j, P, pi, P, pi + 3, P, pi + 6)) return 0;
  }
  let m = best;
  for (let i = 0; i < 3; i++) {
    m = dmin(m, point_tri2(Q, qi + 3 * i, P, pi, P, pi + 3, P, pi + 6));
    m = dmin(m, point_tri2(P, pi + 3 * i, Q, qi, Q, qi + 3, Q, qi + 6));
  }
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      m = dmin(m, seg_seg2(P, pi + 3 * i, P, pi + 3 * ((i + 1) % 3), Q, qi + 3 * j, Q, qi + 3 * ((j + 1) % 3)));
  return m;
}

function tri_meets(P, pi, Q, qi) {
  const pe10 = P[pi + 3] - P[pi], pe11 = P[pi + 4] - P[pi + 1], pe12 = P[pi + 5] - P[pi + 2];
  const pe20 = P[pi + 6] - P[pi], pe21 = P[pi + 7] - P[pi + 1], pe22 = P[pi + 8] - P[pi + 2];
  const nP0 = pe11 * pe22 - pe12 * pe21, nP1 = pe12 * pe20 - pe10 * pe22, nP2 = pe10 * pe21 - pe11 * pe20;
  const qe10 = Q[qi + 3] - Q[qi], qe11 = Q[qi + 4] - Q[qi + 1], qe12 = Q[qi + 5] - Q[qi + 2];
  const qe20 = Q[qi + 6] - Q[qi], qe21 = Q[qi + 7] - Q[qi + 1], qe22 = Q[qi + 8] - Q[qi + 2];
  const nQ0 = qe11 * qe22 - qe12 * qe21, nQ1 = qe12 * qe20 - qe10 * qe22, nQ2 = qe10 * qe21 - qe11 * qe20;
  const degenerate = !(nP0 * nP0 + nP1 * nP1 + nP2 * nP2 > 0) || !(nQ0 * nQ0 + nQ1 * nQ1 + nQ2 * nQ2 > 0);
  let onPlane = false;
  if (!degenerate) {
    const dq = [0, 0, 0], dp = [0, 0, 0];
    for (let i = 0; i < 3; i++) dq[i] = nP0 * (Q[qi + 3 * i] - P[pi]) + nP1 * (Q[qi + 3 * i + 1] - P[pi + 1]) + nP2 * (Q[qi + 3 * i + 2] - P[pi + 2]);
    if ((dq[0] > 0 && dq[1] > 0 && dq[2] > 0) || (dq[0] < 0 && dq[1] < 0 && dq[2] < 0)) return false;
    for (let i = 0; i < 3; i++) dp[i] = nQ0 * (P[pi + 3 * i] - Q[qi]) + nQ1 * (P[pi + 3 * i + 1] - Q[qi + 1]) + nQ2 * (P[pi + 3 * i + 2] - Q[qi + 2]);
    if ((dp[0] > 0 && dp[1] > 0 && dp[2] > 0) || (dp[0] < 0 && dp[1] < 0 && dp[2] < 0)) return false;
    onPlane = dq[0] === 0 || dq[1] === 0 || dq[2] === 0 || dp[0] === 0 || dp[1] === 0 || dp[2] === 0;
  }
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    if (seg_pierces(P, pi + 3 * i, P, pi + 3 * j, Q, qi, Q, qi + 3, Q, qi + 6)) return true;
    if (seg_pierces(Q, qi + 3 * i, Q, qi + 3 * j, P, pi, P, pi + 3, P, pi + 6)) return true;
  }
  if (degenerate || onPlane) return tri_tri2(P, pi, Q, qi, Infinity) === 0;
  return false;
}

function box_dist2(amn, ao, amx, bmn, bo, bmx) {
  let s = 0;
  for (let a = 0; a < 3; a++) {
    const g = dmax(bmn[bo + a] - amx[ao + a], amn[ao + a] - bmx[bo + a]);
    if (g > 0) s += g * g;
  }
  return s;
}

// ---------------------------------------------------------------------------
// The query (kernel.cpp's Query, begin_query, bbox, leaf_tris, lower2, visit*).
let queryId = 0;
const Q = { A: null, B: null, m: null, qid: 0, ax: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], best2: 0, prune2: 0, done: false };
const _o = new Float64Array(3);

function mapPoint(m, x, y, z, out, o) {
  const w = 1.0 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
  out[o] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
  out[o + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
  out[o + 2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
}
function leafTris(n) {
  const B = Q.B;
  if (B.triStamp[n] === Q.qid) return;
  B.triStamp[n] = Q.qid;
  for (let t = B.start[n]; t < B.start[n] + B.count[n]; t++)
    for (let c = 0; c < 3; c++) { const k = 9 * t + 3 * c; mapPoint(Q.m, B.tri[k], B.tri[k + 1], B.tri[k + 2], B.btri, k); }
}
function bbox(n) {
  const B = Q.B;
  if (B.boxStamp[n] === Q.qid) return;
  B.boxStamp[n] = Q.qid;
  const o = 3 * n;
  B.bmn[o] = B.bmn[o + 1] = B.bmn[o + 2] = Infinity;
  B.bmx[o] = B.bmx[o + 1] = B.bmx[o + 2] = -Infinity;
  if (B.left[n] < 0) {
    leafTris(n);
    for (let t = B.start[n]; t < B.start[n] + B.count[n]; t++)
      for (let k = 0; k < 9; k++) { const a = k % 3; B.bmn[o + a] = dmin(B.bmn[o + a], B.btri[9 * t + k]); B.bmx[o + a] = dmax(B.bmx[o + a], B.btri[9 * t + k]); }
    return;
  }
  for (let c = 0; c < 8; c++) {
    mapPoint(Q.m, (c & 1) ? B.mx[o] : B.mn[o], (c & 2) ? B.mx[o + 1] : B.mn[o + 1], (c & 4) ? B.mx[o + 2] : B.mn[o + 2], _o, 0);
    for (let a = 0; a < 3; a++) { B.bmn[o + a] = dmin(B.bmn[o + a], _o[a]); B.bmx[o + a] = dmax(B.bmx[o + a], _o[a]); }
  }
}
const _bc = new Float64Array(3);
function lower2(amn, amx, ao, b) {
  const B = Q.B;
  let g = box_dist2(amn, ao, amx, B.bmn, 3 * b, B.bmx);
  if (B.left[b] < 0) return g;
  const ac0 = (amn[ao] + amx[ao]) * 0.5, ac1 = (amn[ao + 1] + amx[ao + 1]) * 0.5, ac2 = (amn[ao + 2] + amx[ao + 2]) * 0.5;
  const ah0 = (amx[ao] - amn[ao]) * 0.5, ah1 = (amx[ao + 1] - amn[ao + 1]) * 0.5, ah2 = (amx[ao + 2] - amn[ao + 2]) * 0.5;
  const bo = 3 * b;
  mapPoint(Q.m, (B.mn[bo] + B.mx[bo]) * 0.5, (B.mn[bo + 1] + B.mx[bo + 1]) * 0.5, (B.mn[bo + 2] + B.mx[bo + 2]) * 0.5, _bc, 0);
  for (let k = 0; k < 3; k++) {
    const u = Q.ax[k];
    let rb = 0;
    for (let j = 0; j < 3; j++) {
      const cj = Q.col[j];
      rb += Math.abs(u[0] * cj[0] + u[1] * cj[1] + u[2] * cj[2]) * (B.mx[bo + j] - B.mn[bo + j]) * 0.5;
    }
    const ra = Math.abs(u[0]) * ah0 + Math.abs(u[1]) * ah1 + Math.abs(u[2]) * ah2;
    const sep = Math.abs(u[0] * (_bc[0] - ac0) + u[1] * (_bc[1] - ac1) + u[2] * (_bc[2] - ac2)) - ra - rb;
    if (sep > 0 && sep * sep > g) g = sep * sep;
  }
  return g;
}
function splitAOf(a, b) {
  const A = Q.A, B = Q.B;
  if (A.left[a] < 0) return false;
  if (B.left[b] < 0) return true;
  let ea = 0, eb = 0;
  for (let k = 0; k < 3; k++) { ea += A.mx[3 * a + k] - A.mn[3 * a + k]; eb += B.bmx[3 * b + k] - B.bmn[3 * b + k]; }
  return ea >= eb;
}
const pad2 = (best2) => { if (!(best2 < Infinity)) return best2; const r = Math.sqrt(best2) + PRUNE_PAD; return r * r; };

// kernel.cpp's tri_box and the leaf loops' prefilter (§338 landing 7, its reason there).
const _tbmn = new Float64Array(3 * LEAF), _tbmx = new Float64Array(3 * LEAF), _tamn = new Float64Array(3), _tamx = new Float64Array(3);
function triBox(t, o, mn, mx, mo) {
  for (let a = 0; a < 3; a++) {
    mn[mo + a] = dmin(dmin(t[o + a], t[o + 3 + a]), t[o + 6 + a]);
    mx[mo + a] = dmax(dmax(t[o + a], t[o + 3 + a]), t[o + 6 + a]);
  }
}
function leafBoxes(b) {
  const B = Q.B;
  for (let j = 0; j < B.count[b]; j++) triBox(B.btri, 9 * (B.start[b] + j), _tbmn, _tbmx, 3 * j);
}

function visit(a, b) {
  if (Q.done) return;
  const A = Q.A, B = Q.B;
  if (A.left[a] < 0 && B.left[b] < 0) {
    leafTris(b);
    leafBoxes(b);
    for (let i = A.start[a]; i < A.start[a] + A.count[a]; i++) {
      triBox(A.tri, 9 * i, _tamn, _tamx, 0);
      for (let j = B.start[b]; j < B.start[b] + B.count[b]; j++) {
        if (!(box_dist2(_tamn, 0, _tamx, _tbmn, 3 * (j - B.start[b]), _tbmx) < Q.prune2)) continue;
        const d = tri_tri2(A.tri, 9 * i, B.btri, 9 * j, Q.best2);
        if (d < Q.best2) { Q.best2 = d; Q.prune2 = pad2(d); if (d === 0) { Q.done = true; return; } }
      }
    }
    return;
  }
  const splitA = splitAOf(a, b);
  let c0, c1, d0, d1;
  if (splitA) {
    c0 = A.left[a]; c1 = c0 + 1;
    d0 = lower2(A.mn, A.mx, 3 * c0, b);
    d1 = lower2(A.mn, A.mx, 3 * c1, b);
  } else {
    c0 = B.left[b]; c1 = c0 + 1;
    bbox(c0); bbox(c1);
    d0 = lower2(A.mn, A.mx, 3 * a, c0);
    d1 = lower2(A.mn, A.mx, 3 * a, c1);
  }
  if (d1 < d0) { const tc = c0; c0 = c1; c1 = tc; const td = d0; d0 = d1; d1 = td; }
  if (d0 < Q.prune2) { if (splitA) visit(c0, b); else visit(a, c0); }
  if (d1 < Q.prune2) { if (splitA) visit(c1, b); else visit(a, c1); }
}

function visitMeets(a, b) {
  if (Q.done) return;
  const A = Q.A, B = Q.B;
  if (A.left[a] < 0 && B.left[b] < 0) {
    leafTris(b);
    leafBoxes(b);
    const pad = PRUNE_PAD * PRUNE_PAD;
    for (let i = A.start[a]; i < A.start[a] + A.count[a]; i++) {
      triBox(A.tri, 9 * i, _tamn, _tamx, 0);
      for (let j = B.start[b]; j < B.start[b] + B.count[b]; j++) {
        if (box_dist2(_tamn, 0, _tamx, _tbmn, 3 * (j - B.start[b]), _tbmx) > pad) continue;
        if (tri_meets(A.tri, 9 * i, B.btri, 9 * j)) { Q.done = true; return; }
      }
    }
    return;
  }
  const splitA = splitAOf(a, b);
  const pad = PRUNE_PAD * PRUNE_PAD;
  if (splitA) {
    for (let c = A.left[a]; c <= A.left[a] + 1; c++)
      if (!(lower2(A.mn, A.mx, 3 * c, b) > pad)) { visitMeets(c, b); if (Q.done) return; }
  } else {
    for (let c = B.left[b]; c <= B.left[b] + 1; c++) {
      bbox(c);
      if (!(lower2(A.mn, A.mx, 3 * a, c) > pad)) { visitMeets(a, c); if (Q.done) return; }
    }
  }
}

function begin(gA, gB, m) {
  Q.A = exactGeom(gA); Q.B = exactGeom(gB); Q.m = m;
  Q.qid = ++queryId;
  if (Q.qid > 0xfffffff0) { queryId = 1; Q.qid = 1; Q.B.boxStamp.fill(0); Q.B.triStamp.fill(0); }
  for (let k = 0; k < 3; k++) {
    const c0 = m[4 * k], c1 = m[4 * k + 1], c2 = m[4 * k + 2];
    const L = Math.sqrt(c0 * c0 + c1 * c1 + c2 * c2);
    Q.col[k][0] = c0; Q.col[k][1] = c1; Q.col[k][2] = c2;
    Q.ax[k][0] = L > 0 ? c0 / L : 0; Q.ax[k][1] = L > 0 ? c1 / L : 0; Q.ax[k][2] = L > 0 ? c2 / L : 0;
  }
  Q.done = false;
  bbox(0);
}

// The closest distance between `gA` (its own frame) and `gB` placed by `m` (a
// Matrix4's elements, B → A), or Infinity when no pair is closer than `upper`.
export function exactDistance(gA, gB, m, upper) {
  const A = exactGeom(gA), B = exactGeom(gB);
  if (!A.ntri || !B.ntri) return Infinity;
  begin(gA, gB, m);
  Q.best2 = upper < Infinity ? upper * upper : Infinity;
  Q.prune2 = pad2(Q.best2);
  if (lower2(A.mn, A.mx, 0, 0) < Q.prune2) visit(0, 0);
  const d = Math.sqrt(Q.best2);
  return d < upper ? d : Infinity;
}

// Whether any triangle of `gA` meets any triangle of `gB` under `m` (any
// invertible affine map).
export function exactMeets(gA, gB, m) {
  const A = exactGeom(gA), B = exactGeom(gB);
  if (!A.ntri || !B.ntri) return false;
  begin(gA, gB, m);
  Q.best2 = 0; Q.prune2 = 0;
  if (!(lower2(A.mn, A.mx, 0, 0) > PRUNE_PAD * PRUNE_PAD)) visitMeets(0, 0);
  return Q.done;
}
