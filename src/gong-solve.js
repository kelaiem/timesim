// BUILT §310 — THE GONG PLACEMENT SOLVER: where a gong wire can go in a fitted
// case, and what it rings there. Pure (no DOM, no three.js): the build, the
// Gong Bench page and tools/probe-gong-solve.mjs read this one copy.
//
// TWO MODELS OF THE WIRE, both §253's transfer-matrix method generalised from
// one circular arc to ANY planar centreline: the wire is a chain of short
// constant-curvature pieces, clamped at the foot and free at the struck end,
// each piece propagated exactly by the matrix exponential of its own constant
// system and the pieces multiplied.
//
//  · IN PLANE (§253's family): Love's arch equations per unit length,
//      u' = N/S - k w,  w' = psi + k u,  psi' = -M,  M' = V,
//      V' = k N - Om w,  N' = -k V - Om u
//    in z = (u, w, psi, M, V, N); at constant k this is §253's θ-form exactly
//    (the probe re-derives §253's arc table from it).
//  · OUT OF PLANE (the wire flapping across the plate while it twists): the
//    section's rotation th n + ph t differentiates to (ph' - k th) t +
//    (th' + k ph) n along the frame (t, n, b), dt/ds = k n, so
//      v' = -th,  th' = M - k ph,  ph' = r T + k th,
//      M' = Q - k T,  T' = k M - (2/S) Om ph,  Q' = -Om v
//    in z = (v, th, ph, M, T, Q), r = EI/GJ = 1 + nu for a round section and
//    the twist's rotary inertia rho Ip/(rho A L^2) = 2k^2/L^2 = 2/S.
//
// Nondimensional on the wire's own length: EI = 1, rho A = 1, L = 1, so
// Om = rho A w^2 L^4/EI and S = (L/k_g)^2 with k_g = d/4 the round section's
// radius of gyration; g = Om^(1/4) is the straight bar's betaL. Clamped at
// s = 0 (first three states zero), free at s = 1 (last three zero), so each
// family's frequency condition is the same 3x3 determinant and its roots are
// found by a sign scan in g refined by bisection. The scan step must be finer
// than the closest pair of roots in one family: a straight bar's third
// bending root (7.8548) and first twist root (7.8493 at S = 4000) are 0.0055
// apart, and a coarser step straddled both and found neither (§310's record).
//
// THE SOLVER turns the bench's question round: given the case's free space
// at the wire's height, a band for f1 and a striking rule, where does a wire
// go? Families, each generated in position space:
//   edge    a straight bar along a flat run of the outline, one wire's need
//           inside it; its foot blocks to the plate's rim
//   column  a spiral whose foot sits on a column's keep-out ring, winding
//           outward; the column carries the foot
//   any     a straight or circular-arc wire from any free point and heading
//   near    'any' restricted to a neighbourhood of a given placement
// Every length is SOLVED for the band (never typed); the striking rule picks
// the free end (loudest f1) or the first overtone's node (purest); and the
// HAMMER'S REACH is a constraint when given: the hammer hangs off the alarm
// module, which only turns about the movement's centre, and §198's law puts
// its face INBOARD of the wire with the blow RADIAL and outward. So a strike
// point is reachable only where the wire's normal there is radial (within
// tolDeg) and the face it implies (wire radius + rest gap inboard) lands in
// [rFaceMin, rFaceMax] — the window the hammer's re-solve may move its face
// through. A flat-edge bar meets that exactly at one point per edge: the foot
// of the perpendicular from the centre.
import { STOCK, STEEL_NU, UNIT_MM } from './layout.js';

const STEEL = STOCK.steel;
export const STEEL_C = Math.sqrt(STEEL.E / STEEL.rho);   // bar wave speed, m/s
export const U_M = UNIT_MM / 1000;                        // m per model unit

// ---- the transfer-matrix kernel -------------------------------------------
const mul = (A, B, C) => { for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let t = 0; for (let k = 0; k < 6; k++) t += A[i * 6 + k] * B[k * 6 + j]; C[i * 6 + j] = t; } };
// e^A by scaling and squaring, Taylor to 14 terms at |B|_1 <= 1/4 (§253's)
export const expm = (A) => {
  let norm = 0; for (let i = 0; i < 6; i++) { let r = 0; for (let j = 0; j < 6; j++) r += Math.abs(A[i * 6 + j]); norm = Math.max(norm, r); }
  const s = Math.max(0, Math.ceil(Math.log2(norm / 0.25)));
  const B = A.map((v) => v / 2 ** s), X = new Float64Array(36), T = new Float64Array(36), P = new Float64Array(36);
  for (let i = 0; i < 6; i++) { X[i * 7] = 1; T[i * 7] = 1; }
  for (let k = 1; k <= 14; k++) { mul(T, B, P); for (let i = 0; i < 36; i++) { T[i] = P[i] / k; X[i] += T[i]; } }
  for (let q = 0; q < s; q++) { mul(X, X, P); X.set(P); }
  return X;
};
export const sysIn = (k, S, Om, ds) => { const A = new Float64Array(36), set = (r, c, v) => { A[r * 6 + c] = v * ds; };
  set(0, 5, 1 / S); set(0, 1, -k); set(1, 2, 1); set(1, 0, k); set(2, 3, -1); set(3, 4, 1); set(4, 5, k); set(4, 1, -Om); set(5, 4, -k); set(5, 0, -Om);
  return A; };
export const sysOut = (k, S, Om, ds, nu = STEEL_NU) => { const A = new Float64Array(36), set = (r, c, v) => { A[r * 6 + c] = v * ds; };
  set(0, 1, -1); set(1, 3, 1); set(1, 2, -k); set(2, 4, 1 + nu); set(2, 1, k); set(3, 5, 1); set(3, 4, -k); set(4, 3, k); set(4, 2, -(2 / S) * Om); set(5, 0, -Om);
  return A; };
const SYS = { in: sysIn, out: sysOut };
// segs: [{ k: curvature x L, ds }], foot -> free end, sum ds = 1
export const transfer = (segs, S, Om, fam = 'in') => { const sys = SYS[fam]; let T = new Float64Array(36); for (let i = 0; i < 6; i++) T[i * 7] = 1; const P = new Float64Array(36);
  for (const g of segs) { mul(expm(sys(g.k, S, Om, g.ds)), T, P); T = P.slice(); } return T; };
const det3 = (T) => { const m = (r, c) => T[(3 + r) * 6 + 3 + c];
  return m(0, 0) * (m(1, 1) * m(2, 2) - m(1, 2) * m(2, 1)) - m(0, 1) * (m(1, 0) * m(2, 2) - m(1, 2) * m(2, 0)) + m(0, 2) * (m(1, 0) * m(2, 1) - m(1, 1) * m(2, 0)); };
export const freqDet = (segs, S, Om, fam = 'in') => det3(transfer(segs, S, Om, fam));
// the lowest nMax roots in g (sign scan from g0 at `step`, then bisection)
export const modes = (segs, S, { nMax = 3, gMax = 20, fam = 'in', step = 0.004, g0 = 0.3 } = {}) => {
  const roots = [], det = (g) => freqDet(segs, S, g ** 4, fam);
  let a = g0, da = det(a);
  for (let b = a + step; b <= gMax && roots.length < nMax; b += step) { const db = det(b);
    if (Math.sign(db) !== Math.sign(da)) { let lo = a, hi = b, dlo = da; for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2, dm = det(mid); if (Math.sign(dm) === Math.sign(dlo)) { lo = mid; dlo = dm; } else hi = mid; } roots.push((lo + hi) / 2); }
    a = b; da = db; }
  return roots;
};
// Hz from g for a wire of length L_m (m) and diameter d_m: w = g^2 k_g c / L^2
export const hz = (g, L_m, d_m) => g * g * (d_m / 4) * STEEL_C / (2 * Math.PI * L_m * L_m);
export const sOf = (L_m, d_m) => (L_m / (d_m / 4)) ** 2;
// a mode's shape: the clamp's free initial values are the free-end 3x3's null
// vector; propagated to ~nSamp points. w is the displacement a blow normal to
// the wire drives (in plane: the normal w; out of plane: v), tip-normalised;
// mass the generalised mass of that shape (int (u^2 + w^2) ds).
export const shape = (segs, S, g, { nSamp = 200, fam = 'in' } = {}) => {
  const sys = SYS[fam], Om = g ** 4, T = transfer(segs, S, Om, fam), m = (r, c) => T[(3 + r) * 6 + 3 + c];
  const rows = [0, 1, 2].map((r) => [m(r, 0), m(r, 1), m(r, 2)]);
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const v = [cr(rows[0], rows[1]), cr(rows[1], rows[2]), cr(rows[0], rows[2])].reduce((b, c) => (Math.hypot(...c) > Math.hypot(...b) ? c : b));
  let z = [0, 0, 0, v[0], v[1], v[2]];
  const w = [0], u = [0], s = [0]; let pos = 0;
  for (const sg of segs) { const n = Math.max(1, Math.round(nSamp * sg.ds)), P = expm(sys(sg.k, S, Om, sg.ds / n));
    for (let q = 0; q < n; q++) { const nz = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) nz[i] += P[i * 6 + k] * z[k];
      z = nz; pos += sg.ds / n; s.push(pos); if (fam === 'out') { u.push(0); w.push(z[0]); } else { u.push(z[0]); w.push(z[1]); } } }
  const tip = w[w.length - 1] || 1; let mass = 0;
  for (let i = 0; i < w.length; i++) { w[i] /= tip; u[i] /= tip; }
  for (let i = 1; i < w.length; i++) mass += (s[i] - s[i - 1]) * ((w[i] ** 2 + u[i] ** 2 + w[i - 1] ** 2 + u[i - 1] ** 2) / 2);
  return { s, w, u, mass };
};
export const shapeAt = (sh, x) => { const s = sh.s; let i = 1; while (i < s.length - 1 && s[i] < x) i++;
  const t = (x - s[i - 1]) / ((s[i] - s[i - 1]) || 1); return sh.w[i - 1] + t * (sh.w[i] - sh.w[i - 1]); };
// the first overtone's node nearest the free end, as a fraction from the foot
export const overtoneNode = (segs, S) => { const g = modes(segs, S, { nMax: 2, step: 0.01 }); if (g.length < 2) return 1;
  const sh = shape(segs, S, g[1], { nSamp: 400 }); for (let q = sh.w.length - 1; q > 1; q--) if (Math.sign(sh.w[q]) !== Math.sign(sh.w[q - 1])) {
    const t = sh.w[q - 1] / (sh.w[q - 1] - sh.w[q]); return sh.s[q - 1] + t * (sh.s[q] - sh.s[q - 1]); } return 1; };

// ---- geometry ---------------------------------------------------------------
// curvature pieces from a polyline ordered FOOT -> free end, nseg pieces, k x L
export const segsFromPts = (pts, nseg) => { const ks = [];
  for (let i = 1; i < pts.length - 1; i++) { const a1 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]), a2 = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); const d = a2 - a1; ks.push(Math.atan2(Math.sin(d), Math.cos(d))); }
  const n = pts.length - 1, out = [];
  for (let q = 0; q < nseg; q++) { const a = Math.floor(q * ks.length / nseg), b = Math.max(a + 1, Math.floor((q + 1) * ks.length / nseg)); let t = 0; for (let i = a; i < b && i < ks.length; i++) t += ks[i]; out.push({ k: ks.length ? t * n / (b - a) : 0, ds: 1 / nseg }); }
  return out; };
// constant curvature k (1/u) from a point and heading, s from that point
export const arcGen = (x, y, th, k) => (s) => Math.abs(k) < 1e-9 ? [x + s * Math.cos(th), y + s * Math.sin(th)]
  : [x + (Math.sin(th + k * s) - Math.sin(th)) / k, y - (Math.cos(th + k * s) - Math.cos(th)) / k];
// an Archimedean spiral anchored at its foot on (cx, cy) at radius rf, winding
// outward by p per turn in direction dir from azimuth a0; null past 3 turns
export const spiralFootGen = (cx, cy, rf, a0, dir, p) => { const b = p / (2 * Math.PI), H = 0.05; const cache = [[cx + rf * Math.cos(a0), cy + rf * Math.sin(a0)]]; let ph = 0, r = rf, acc = 0;
  return (s) => { while (acc < s) { const dph = H / Math.hypot(r, b); ph += dph; r += b * dph; acc += H; if (ph > 6 * Math.PI) return null; cache.push([cx + r * Math.cos(a0 + dir * ph), cy + r * Math.sin(a0 + dir * ph)]); }
    return cache[Math.min(cache.length - 1, Math.round(s / H))]; }; };
// §310 landing 2 — an Archimedean spiral that STARTS at a point (sx, sy) on heading th and winds INWARD
// (turn +1 curving left) from radius r0 by p per turn, to its foot block at rMin; null past it. The curve is
// rotated about its start so its heading there is exactly th (an Archimedean tangent leans atan(b/r) off
// the circle's), which is what lets a strike anchored at the start meet the wire square.
export const spiralInGen = (sx, sy, th, r0, p, turn, rMin = 2.5) => { const b = p / (2 * Math.PI), H = 0.05;
  const cx0 = sx - turn * r0 * Math.sin(th), cy0 = sy + turn * r0 * Math.cos(th), a0 = Math.atan2(sy - cy0, sx - cx0);
  const h0 = Math.atan2(turn * r0 * Math.cos(a0) - b * Math.sin(a0), -turn * r0 * Math.sin(a0) - b * Math.cos(a0)), rot = th - h0, c = Math.cos(rot), sn = Math.sin(rot);
  const at = (ph) => { const r = r0 - b * ph, x = cx0 + r * Math.cos(a0 + turn * ph) - sx, y = cy0 + r * Math.sin(a0 + turn * ph) - sy; return [sx + c * x - sn * y, sy + sn * x + c * y]; };
  const cache = [[sx, sy]]; let ph = 0, acc = 0;
  return (s) => { while (acc < s) { const r = r0 - b * ph; if (r <= rMin) return null; ph += H / Math.hypot(r, b); acc += H; cache.push(at(ph)); }
    return cache[Math.min(cache.length - 1, Math.round(s / H))]; }; };
export const sample = (gen, from, to, h = 0.25) => { const pts = []; for (let s = from; s <= to + 1e-9; s += h) { const p = gen(Math.min(s, to)); if (p) pts.push(p); } return pts; };
export const pointInLoop = (loop, x, y) => { let c = false; for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const [xi, yi] = loop[i], [xj, yj] = loop[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
// flat runs of an outline: consecutive edges within half a degree of one direction, at least minLen long
export const flatRuns = (loop, minLen = 15) => { const n = loop.length, runs = []; let start = 0, dir = null, len = 0;
  const ang = (i) => Math.atan2(loop[(i + 1) % n][1] - loop[i][1], loop[(i + 1) % n][0] - loop[i][0]);
  for (let i = 0; i <= n; i++) { const a = ang(i % n), seg = Math.hypot(loop[(i + 1) % n][0] - loop[i % n][0], loop[(i + 1) % n][1] - loop[i % n][1]);
    if (dir !== null && Math.abs(Math.atan2(Math.sin(a - dir), Math.cos(a - dir))) < 0.5 * Math.PI / 180) { len += seg; continue; }
    if (dir !== null && len >= minLen) runs.push({ a: loop[start % n], dir, len });
    start = i; dir = a; len = seg; }
  return runs; };

// ---- the solver ---------------------------------------------------------------
// map:  { free: Uint8Array (1 = a wire centreline may stand here), W, H, x0, y0, RES,
//         loop: [[x, y]], pillars: [{ x, y, r }] (r = the column's keep-out for a centreline), need }
// opts: { edge, column, any, near: { x, y, th, k } | null, fLo, fHi, strike: 'end' | 'node',
//         rank: 'pitch' | 'clean' | 'room', wireD_m, wireR (u), reach: { rFaceMin, rFaceMax, gap, tolDeg } | null }
export const solveGong = (map, opts, progress = () => {}) => {
  const M = map, D = opts.wireD_m, WR = opts.wireR, STEP = 0.25, fLo = opts.fLo, fHi = opts.fHi, fT = Math.sqrt(fLo * fHi);
  const free = (x, y) => { const i = Math.floor((x - M.x0) / M.RES), j = Math.floor((y - M.y0) / M.RES); return i >= 0 && j >= 0 && i < M.W && j < M.H && M.free[j * M.W + i] === 1; };
  // the HAMMER'S band (map.hammer, the same grid read at the hammer's own heights — its staff, arm and head stand
  // above and below the wire's band, where the alarm pusher's linkage runs): where the hammer's metal may stand.
  // No map, no constraint (the bench's own solves and the round build's callers pass none).
  // Two grids: `arm` read over the arm's and head's heights (the arm's line and the head's travel), `staff` over the
  // post's whole height (the pivot, where the post stands).
  const gridFree = (G) => G ? (x, y) => { const i = Math.floor((x - G.x0) / G.RES), j = Math.floor((y - G.y0) / G.RES); return i >= 0 && j >= 0 && i < G.W && j < G.H && G.free[j * G.W + i] === 1; } : () => true;
  const hfree = gridFree(M.hammer?.arm), sfree = gridFree(M.hammer?.staff);
  const march = (gen, Lmax) => { for (let s = 0; s <= Lmax; s += STEP) { const p = gen(s); if (!p || !free(p[0], p[1])) return Math.max(0, s - STEP); } return Lmax; };
  const allFree = (pts) => pts.every(([x, y]) => free(x, y));
  const Lstraight = (f) => Math.sqrt(1.8751 ** 2 * (D / 4) * STEEL_C / (2 * Math.PI * f)) / U_M;
  const S = (Lu) => sOf(Lu * U_M, D);
  const f1Of = (segs, Lu) => { const g = modes(segs, S(Lu), { nMax: 1, gMax: 6, step: 0.05, g0: 0.6 }); return g.length ? hz(g[0], Lu * U_M, D) : NaN; };
  // the length that rings fT, by Newton on f ~ L^-2, for a wire whose curvature pieces at length L are segsAt(L)
  const solveL = (segsAt, Lfit) => { let L = Math.min(Lfit, Lstraight(fT));
    for (let it = 0; it < 5; it++) { const f = f1Of(segsAt(L), L); if (!(f > 0)) return null; const nL = L * Math.sqrt(f / fT); const done = Math.abs(nL - L) < 0.02; L = nL; if (done) break; }
    return Math.min(L, Lfit); };
  // the hammer: a head's travel of room on the side it strikes from, and (with a reach) the face where the module can put it
  const strikeFrame = (pts, idx) => { const i = Math.max(0, Math.min(pts.length - 2, idx)), [x, y] = pts[i], [x2, y2] = pts[i + 1], l = Math.hypot(x2 - x, y2 - y) || 1; return { x, y, nx: -(y2 - y) / l, ny: (x2 - x) / l }; };
  const hammer = (pts, idx) => { if (opts.lever) return leverHammer(pts, idx); const f = strikeFrame(pts, idx), R = opts.reach;
    for (const sg of [1, -1]) {
      let room = true; for (let dd = 1.6; dd <= 4.5; dd += 0.4) if (!free(f.x + sg * f.nx * dd, f.y + sg * f.ny * dd)) { room = false; break; }
      if (!room) continue;
      if (!R) return { side: sg };
      // face on side sg, the blow runs from the face to the wire: -sg n; §198 wants it radial and outward
      const off = WR + R.gap, fx = f.x + sg * f.nx * off, fy = f.y + sg * f.ny * off, rf = Math.hypot(fx, fy);
      const cos = (-sg * f.nx * fx - sg * f.ny * fy) / (rf || 1);
      if (rf >= R.rFaceMin && rf <= R.rFaceMax && cos >= Math.cos(R.tolDeg * Math.PI / 180)) return { side: sg, face: [fx, fy], rFace: rf, azDeg: Math.atan2(fy, fx) * 180 / Math.PI };
    }
    return null; };
  // §310 landing 2 — THE LEVER'S REACH. The hammer is not free to stand
  // anywhere: its tail is lifted by the lifting lever, pivoted at Q, whose far
  // arm and the tail lie anti-parallel, so the hammer's pivot P stands exactly
  // rho = |(a + l, s)| from Q (main.js ALARM_STRIKE_LAWS.hammerPivot's circle).
  // And the blow is normal to the wire where it lands (§198's Thales rule, the
  // radial blow generalised): the face F one rest gap off the wire on the side
  // the head has room, the pivot tanLen along the tangent from F on the lever's
  // side. So for a wire, the strike is where |P(s) - Q| = rho: a root along
  // the wire, found by sign change and interpolated, and the wire must leave
  // the strike AWAY from the pivot toward its foot (§198's GONG_HAND rule).
  const leverAt = (S, n, sg) => { const L = opts.lever, off = WR + L.gap, fx = S[0] + sg * n[0] * off, fy = S[1] + sg * n[1] * off;
    const bx = -sg * n[0], by = -sg * n[1], px = fx + L.side * L.tanLen * -by, py = fy + L.side * L.tanLen * bx;
    return { fx, fy, bx, by, px, py, g: Math.hypot(px - L.Q.x, py - L.Q.y) - L.rho }; };
  const leverRoom = (h) => { const L = opts.lever; if (!free(h.px, h.py) || !sfree(h.px, h.py)) return false;
    // the staff and the arm (eye to pivot) stand in free space too: sampled at a quarter unit
    const ex = h.fx - h.bx * L.headR, ey = h.fy - h.by * L.headR, d = Math.hypot(h.px - ex, h.py - ey);
    for (let t = 0; t <= d; t += 0.25) { const x = ex + (h.px - ex) * t / d, y = ey + (h.py - ey) * t / d; if (!free(x, y) || !hfree(x, y)) return false; } return true; };
  const leverHammer = (pts, want) => { const L = opts.lever, roots = [];
    for (const sg of [1, -1]) { let prev = null;
      for (let i = 0; i < pts.length - 1; i++) { const f = strikeFrame(pts, i), h = leverAt([f.x, f.y], [f.nx, f.ny], sg);
        // a root ON a sample (the lever family anchors its free end exactly at the strike) counts as one
        const onPt = Math.abs(h.g) < 1e-6 && (!prev || Math.abs(prev.h.g) >= 1e-6);
        if (onPt || (prev && Math.abs(prev.h.g) >= 1e-6 && Math.sign(prev.h.g) !== Math.sign(h.g))) { const t = onPt ? 1 : prev.h.g / (prev.h.g - h.g), j = onPt ? i : i - 1;
          const ii = onPt ? Math.min(i + 1, pts.length - 1) : i;
          const S = onPt ? [pts[i][0], pts[i][1]] : [pts[j][0] + t * (pts[i][0] - pts[j][0]), pts[j][1] + t * (pts[i][1] - pts[j][1])], fr = strikeFrame(pts, j), q = leverAt(S, [fr.nx, fr.ny], sg);
          const fdx = pts[ii][0] - pts[j][0], fdy = pts[ii][1] - pts[j][1];   // toward the foot (pts run free end first)
          const idx = onPt ? i : j + t;
          // §198: the blow runs OUTWARD (toward the case) unless the caller lifts that rule
          const outward = !L.outward || q.bx * q.fx + q.by * q.fy > 0;
          if ((q.px - q.fx) * fdx + (q.py - q.fy) * fdy < 0 && outward) roots.push({ sg, idx, q }); }
        prev = { h }; } }
    roots.sort((a, b) => Math.abs(a.idx - want) - Math.abs(b.idx - want));
    for (const r of roots) { let room = true; const f = strikeFrame(pts, Math.floor(r.idx));
      for (let dd = 1.6; dd <= 4.5; dd += 0.4) { const x = f.x + r.sg * f.nx * dd, y = f.y + r.sg * f.ny * dd; if (!free(x, y) || !hfree(x, y)) { room = false; break; } }
      if (!room || !leverRoom(r.q)) continue;
      const near = pts.reduce((m, p) => Math.min(m, Math.hypot(p[0] - r.q.px, p[1] - r.q.py)), Infinity);
      if (near < WR + L.postR + L.margin) continue;   // the staff clear of the wire it strikes
      return { side: r.sg, face: [r.q.fx, r.q.fy], rFace: Math.hypot(r.q.fx, r.q.fy), azDeg: Math.atan2(r.q.fy, r.q.fx) * 180 / Math.PI,
        blowDeg: Math.atan2(r.q.by, r.q.bx) * 180 / Math.PI, pivot: [r.q.px, r.q.py], at: r.idx, frac: 1 - r.idx / (pts.length - 1) }; }
    return null; };
  // TODO 269 — the hammer of an END strike: the face one gap before the wire's end, the blow along the
  // wire, the pivot on the lever's circle by construction (the candidate was built from it). What it owes:
  // the staff and arm in free space (leverRoom), the head's travel of room BEHIND the face (along −b, where
  // the drawn head goes), the staff clear of the wire, and the head clear of every coil but the end it strikes
  // (the wire beyond its first unit, one wire's need plus the head's half-width off the head's line).
  const endHammer = (c, pts) => { const L = opts.lever, e = c.end, h = { fx: e.fx, fy: e.fy, bx: e.bx, by: e.by, px: e.px, py: e.py };
    if (!leverRoom(h)) return null;
    for (let dd = L.gap + 0.4; dd <= 4.5; dd += 0.4) { const x = e.fx - e.bx * (dd - L.gap), y = e.fy - e.by * (dd - L.gap); if (!free(x, y) || !hfree(x, y)) return null; }
    const near = pts.reduce((m, p) => Math.min(m, Math.hypot(p[0] - e.px, p[1] - e.py)), Infinity);
    if (near < WR + L.postR + L.margin) return null;
    if (endHeadClear(pts, STEP, { x: e.fx, y: e.fy }, { x: e.bx, y: e.by }, L.headR, L.headH ?? 2 * L.headR, WR) < L.margin) return null;
    return { side: 0, blow: 'tangent', face: [e.fx, e.fy], rFace: Math.hypot(e.fx, e.fy), azDeg: Math.atan2(e.fy, e.fx) * 180 / Math.PI,
      blowDeg: Math.atan2(e.by, e.bx) * 180 / Math.PI, pivot: [e.px, e.py], at: 0, frac: 1 }; };
  // the block stands on PLATE: under a plate test (map.plateInset, the outline's signed distance) its whole
  // circle (map.footR, the block's radius) lies inside the outline
  const onPlate = (p) => !M.plateInset || M.plateInset(p[0], p[1]) >= (M.footR ?? 0);
  const footRoom = (p) => { if (!free(p[0], p[1]) || !onPlate(p)) return false; for (let a = 0; a < 2 * Math.PI; a += Math.PI / 6) if (!free(p[0] + 1.2 * Math.cos(a), p[1] + 1.2 * Math.sin(a))) return false; return true; };
  const hitFrac = (segs, Lu) => opts.strike === 'node' ? overtoneNode(segs, S(Lu)) : 1;
  const sol = [];
  // ---- edge bars: where a reach is given, the strike sits at the foot of the perpendicular from the centre
  if (opts.edge) flatRuns(M.loop).forEach((run, ri) => {
    const tx = Math.cos(run.dir), ty = Math.sin(run.dir); let nx = -ty, ny = tx;
    const mx = run.a[0] + tx * run.len / 2, my = run.a[1] + ty * run.len / 2; if (!pointInLoop(M.loop, mx + nx, my + ny)) { nx = -nx; ny = -ny; }
    // the bar's standoff from the edge: one wire's need, or (under the lever, whose reach is a circle)
    // up to opts.lever.inboard further in, a quarter unit at a time — the first that the lever reaches wins
    const off0 = Math.max(M.need, M.footR ?? 0) + 0.1;   // a wire's need, or the block's radius where that is larger
    for (let off = off0; off <= off0 + (opts.lever?.inboard ?? 0) + 1e-9; off += 0.25) {
    const ax = run.a[0] + nx * off, ay = run.a[1] + ny * off;
    const segsAt = () => [{ k: 0, ds: 1 }];
    const Lband = solveL(segsAt, 400), hit = hitFrac(segsAt(), Lband);
    // strike positions: the perpendicular's foot under a reach, else every unit along the run
    // under the lever, the strike is where the pivot P(u) = P0 + u t lands rho from Q (two roots per face side)
    const leverUs = () => { const L = opts.lever, us = [];
      for (const sg of [1, -1]) { const h = leverAt([ax, ay], [nx, ny], sg), dx = h.px - L.Q.x, dy = h.py - L.Q.y, b = dx * tx + dy * ty, c = dx * dx + dy * dy - L.rho * L.rho, disc = b * b - c;
        if (disc >= 0) for (const r of [-b - Math.sqrt(disc), -b + Math.sqrt(disc)]) us.push(r); }
      return us; };
    const us = opts.lever ? leverUs() : opts.reach ? [-(ax * tx + ay * ty)] : Array.from({ length: Math.floor(run.len) + 1 }, (_, i) => i);
    for (const u of us) for (const sg of [1, -1]) {
      const px = ax + tx * u, py = ay + ty * u, dx = sg * tx, dy = sg * ty;   // dx,dy: from the strike toward the FOOT
      // the length: the band's centre, else the longest inside the band that fits
      for (const L of [Lband, ...Array.from({ length: 30 }, (_, i) => Lband - (i + 1) * (Lband - Lstraight(fHi)) / 30)]) {
        const freeEnd = [px - dx * (1 - hit) * L, py - dy * (1 - hit) * L], gen = arcGen(freeEnd[0], freeEnd[1], Math.atan2(dy, dx), 0), pts = sample(gen, 0, L);
        if (!allFree(pts) || !onPlate(pts[pts.length - 1])) continue;
        const hm = hammer(pts, Math.round((1 - hit) * (pts.length - 1))); if (!hm) break;
        sol.push({ fam: 'edge', label: 'bar along a flat edge', pts, L, nseg: 1, hit: opts.lever ? hm.frac : hit, hammer: hm, slack: 0, segs: segsAt(), spread: `run${ri}`, off }); break;
      }
    }
    if (sol.some((q) => q.spread === `run${ri}`)) break;
    }
  });
  // ---- generated families: march the longest fit, then solve the length for the band
  const cands = [];
  if (opts.column) M.pillars.forEach((q, pi) => {
    const da = opts.reach ? Math.PI / 36 : Math.PI / 6;
    for (let a0 = 0; a0 < 2 * Math.PI - 1e-9; a0 += da) for (const dir of [1, -1]) for (const p of [3.1, 4.5, 7]) {
      const gen = spiralFootGen(q.x, q.y, q.r + 0.1, a0, dir, p), Lfit = march(gen, 200); if (Lfit < Lstraight(fHi) * 0.8) continue;
      cands.push({ fam: 'column', label: `spiral round column P${pi + 1}`, pillar: pi, p, a0, gen, anchor: 'foot', Lfit, key: `c${pi}:${p}:${Math.round(a0 / (Math.PI / 3))}` }); } });
  const near = opts.near, ks = [0, 1 / 12, -1 / 12, 1 / 20, -1 / 20, 1 / 35, -1 / 35, 1 / 60, -1 / 60].concat(near && Number.isFinite(near.k) ? [near.k] : []);
  // §310 landing 2 — under the lever, 'any' is ANCHORED AT THE STRIKE rather than scattered: every pivot on
  // the lever's circle (2°) and blow direction (3°, outward), the face and the strike they imply, and a wire
  // of each curvature leaving the strike away from the pivot — struck at its free end (the loudest f1).
  if ((opts.any || opts.spiral) && opts.lever) { const L = opts.lever;
    for (let ph = 0; ph < 360; ph += 2) { const px = L.Q.x + L.rho * Math.cos(ph * Math.PI / 180), py = L.Q.y + L.rho * Math.sin(ph * Math.PI / 180);
      if (!free(px, py) || !sfree(px, py)) continue;
      for (let be = 0; be < 360; be += 3) { const bx = Math.cos(be * Math.PI / 180), by = Math.sin(be * Math.PI / 180);
        const fx = px - L.side * L.tanLen * -by, fy = py - L.side * L.tanLen * bx;   // P = F + side·tanLen·(ẑ×b)
        const radialOk = !L.outward || bx * fx + by * fy > 0;
        const sx = fx + bx * (WR + L.gap), sy = fy + by * (WR + L.gap);
        const tx = -by, ty = bx, away = -Math.sign((px - fx) * tx + (py - fy) * ty), th = Math.atan2(away * ty, away * tx);
        if (opts.any && radialOk && free(sx, sy)) for (const k of ks) { const gen = arcGen(sx, sy, th, k), Lfit = march(gen, 140); if (Lfit < Lstraight(fHi) * 0.85) continue;
          cands.push({ fam: 'any', label: k === 0 ? 'straight bar' : `arc, radius ${(1 / Math.abs(k)).toFixed(0)} u`, k, th, gen, anchor: 'free', Lfit, strikeEnd: true,
            key: `l:${k.toFixed(4)}:${Math.round(ph / 6)}:${Math.round(be / 9)}` }); }
        // ...and the SPIRAL that stands on its own block, struck at its outer end and winding inward to its
        // foot. TODO 269: struck ALONG ITS TANGENT, on the wire's squared end. A spiral of a turn or more rings
        // first in its WINDING mode, whose free end moves along the wire (31.7x its normal motion on the rect's
        // first plan), so a blow across the end meets 55-1400x a bar's modal mass and a blow along it 0.35-0.50x
        // M. The face is one gap BEFORE the end, normal to the tangent, and the wire leaves the strike along the
        // blow: S = F + b·gap, heading b. §198's outward rule is the RADIAL blow's (a head striking a ring from
        // inside) and is not applied to a blow along the wire.
        if (opts.spiral) { const ex = fx + bx * L.gap, ey = fy + by * L.gap, eth = Math.atan2(by, bx);
          if (free(ex, ey)) for (const r0 of [8, 11, 14, 18]) for (const p of [3.5, 4.5, 6]) for (const turn of [1, -1]) {
            const gen = spiralInGen(ex, ey, eth, r0, p, turn), Lfit = march(gen, 140); if (Lfit < Lstraight(fHi) * 0.85) continue;
            // the hammer is judged HERE, before the roomiest-first cap: it does not depend on the length the
            // band solves, and its coil tests on the longest fit are the stricter (the solved wire is a prefix)
            const end = { px, py, fx, fy, bx, by }; if (!endHammer({ end }, sample(gen, 0, Lfit))) continue;
            cands.push({ fam: 'spiral', label: `spiral from r ${r0} u, ${p} u a turn, struck along its end`, r0, p, turn, th: eth, gen, anchor: 'free', Lfit, strikeEnd: true,
              spiral: { sx: ex, sy: ey, th: eth, r0, p, turn }, blow: 'tangent', end,
              key: `s:${r0}:${p}:${turn}:${Math.round(ph / 6)}:${Math.round(be / 9)}` }); } } } } }
  if ((opts.any && !opts.lever) || near) {
    const grid = near ? 1 : 3, xs = near ? [near.x - 6, near.x + 6] : [M.x0 + 1, M.x0 + M.W * M.RES], ys = near ? [near.y - 6, near.y + 6] : [M.y0 + 1, M.y0 + M.H * M.RES];
    const ths = near ? Array.from({ length: 25 }, (_, i) => near.th + (i - 12) * Math.PI / 36) : Array.from({ length: 18 }, (_, i) => i * Math.PI / 9);
    for (let y = ys[0]; y <= ys[1]; y += grid) for (let x = xs[0]; x <= xs[1]; x += grid) { if (!free(x, y)) continue;
      for (const th of ths) for (const k of ks) { const gen = arcGen(x, y, th, k), Lfit = march(gen, 140); if (Lfit < Lstraight(fHi) * 0.85) continue;
        cands.push({ fam: near ? 'near' : 'any', label: k === 0 ? 'straight bar' : `arc, radius ${(1 / Math.abs(k)).toFixed(0)} u`, k, th, gen, anchor: 'free', Lfit,
          key: `${near ? 'n' : 'a'}:${k.toFixed(4)}:${Math.round(x / 8)}:${Math.round(y / 8)}:${Math.round((th + 7) / 0.6)}` }); } }
  }
  progress(`${cands.length + sol.length} placements; solving lengths…`);
  // per-family caps, spread by key, roomiest first — so no family crowds another out
  const CAP = { column: 150, any: 260, near: 220, spiral: 220 }, pool = [];
  for (const fam of Object.keys(CAP)) { const seen = new Set(); for (const c of cands.filter((q) => q.fam === fam).sort((a, b) => b.Lfit - a.Lfit)) { if (seen.has(c.key)) continue; seen.add(c.key); pool.push(c); if (seen.size >= CAP[fam]) break; } }
  pool.forEach((c, i) => { if (i % 50 === 0) progress(`solving lengths: ${i} of ${pool.length}`);
    const segsAt = c.anchor === 'foot' ? (L) => segsFromPts(sample(c.gen, 0, L), 12)
      : c.spiral ? (L) => segsFromPts(sample(c.gen, 0, L).reverse(), 12) : (L) => [{ k: c.k * L, ds: 1 }];
    const L = solveL(segsAt, c.Lfit); if (!L) return;
    const f1 = f1Of(segsAt(L), L); if (!(f1 >= fLo * 0.999 && f1 <= fHi * 1.001)) return;
    const pts = c.anchor === 'foot' ? sample(c.gen, 0, L).reverse() : sample(c.gen, 0, L);
    if (c.anchor === 'free' && !footRoom(pts[pts.length - 1])) return;
    const segs = (c.anchor === 'foot' || c.spiral) ? segsFromPts(pts.slice().reverse(), 20) : segsAt(L), hit = c.strikeEnd ? 1 : hitFrac(segs, L);
    const hm = c.blow === 'tangent' ? endHammer(c, pts) : hammer(pts, Math.round((1 - hit) * (pts.length - 1))); if (!hm) return;
    sol.push({ fam: c.fam, label: c.label, pts, L, nseg: (c.anchor === 'foot' || c.spiral) ? 20 : 1, spiral: c.spiral, blow: c.blow, k: c.k, th: c.th, hit: opts.lever ? hm.frac : hit, hammer: hm, slack: c.Lfit - L, segs, key: c.key, pillar: c.pillar,
      spread: c.anchor === 'foot' ? `P${c.pillar}` : `${Math.round(pts[0][0] / 25)}:${Math.round(pts[0][1] / 25)}` }); });
  progress(`${sol.length} reach the band${opts.reach ? ' and the hammer' : ''}; judging…`);
  // the shortlist: distinct placements per family, nearest the band's centre first
  sol.sort((a, b) => Math.abs(Math.log2(f1Of(a.segs, a.L) / fT)) - Math.abs(Math.log2(f1Of(b.segs, b.L) / fT)) || b.slack - a.slack);
  // up to 14 per family for the full judgement: one from each distinct placement first, then the rest
  const seen = new Set(), short = [], per = {};
  const take = (s, key) => { if (seen.has(key) || (per[s.fam] || 0) >= 14) return; seen.add(key); per[s.fam] = (per[s.fam] || 0) + 1; short.push(s); };
  const spreadSeen = new Set();
  for (const s of sol) { const k = `${s.fam}|${s.spread}`; if (!spreadSeen.has(k)) { spreadSeen.add(k); take(s, s.fam === 'edge' ? `e:${Math.round(s.pts[0][0] / 12)}:${Math.round(s.pts[0][1] / 12)}` : s.key); } }
  for (const s of sol) take(s, s.fam === 'edge' ? `e:${Math.round(s.pts[0][0] / 12)}:${Math.round(s.pts[0][1] / 12)}` : s.key);
  const out = short.map((s) => { const Sx = S(s.L), Lm = s.L * U_M;
    const fi = modes(s.segs, Sx, { nMax: 3, gMax: 10, step: 0.01 }).map((g) => hz(g, Lm, D)), fo = modes(s.segs, Sx, { nMax: 2, gMax: 8, fam: 'out', step: 0.01 }).map((g) => hz(g, Lm, D));
    const beat = fo.length ? 12 * Math.log2(fi[0] / fo[0]) : Infinity;   // semitones the out-of-plane f1 sits under the in-plane
    return { ...s, f: fi, fo, beat, clean: Math.abs(beat) < 0.05 || Math.abs(beat) > 3 }; });
  const err = (r) => Math.abs(Math.log2(r.f[0] / fT));
  const rank = { pitch: (a, b) => err(a) - err(b) || b.slack - a.slack, clean: (a, b) => (b.clean - a.clean) || err(a) - err(b), room: (a, b) => b.slack - a.slack };
  out.sort(rank[opts.rank] || rank.pitch);
  // four per family (opts.perFamily), the first of them from distinct placements (each side, each column, each
  // quarter of the case) so one good spot cannot fill a family's list with copies of itself
  const top = [], nPer = opts.perFamily ?? 4;
  for (const f of ['near', 'edge', 'column', 'spiral', 'any']) { const mine = out.filter((o) => o.fam === f), seenS = new Set(), pick = [];
    for (const o of mine) if (pick.length < nPer && !seenS.has(o.spread)) { seenS.add(o.spread); pick.push(o); }
    for (const o of mine) if (pick.length < nPer && !pick.includes(o)) pick.push(o);
    top.push(...pick); }
  return { results: top, counts: { placements: cands.length + (opts.edge ? sol.filter((s) => s.fam === 'edge').length : 0), reach: sol.length, judged: out.length } };
};

// ---- §310 landing 2: a SEAT, as the build reads it --------------------------
// A seat's centreline is stored ANALYTICALLY from its free end (s = 0) toward
// its foot (s = L), so the build can solve its strike exactly rather than on a
// sampled chord:
//   { type: 'line', sx, sy, th, L }               a straight bar, heading th
//   { type: 'arc',  sx, sy, th, k, L }            constant curvature k (1/u)
//   { type: 'spiral', sx, sy, th, r0, p, turn, L } spiralInGen's curve
// at(s) -> { x, y, tx, ty, k } (tangent toward the foot, signed curvature).
export const seatCurve = (c) => {
  if (c.type === 'line' || c.type === 'arc') {
    const k = c.type === 'line' ? 0 : c.k, gen = arcGen(c.sx, c.sy, c.th, k);
    return { L: c.L, at: (s) => { const [x, y] = gen(s), a = c.th + k * s; return { x, y, tx: Math.cos(a), ty: Math.sin(a), k }; } };
  }
  if (c.type !== 'spiral') throw new Error(`seatCurve: unknown type '${c.type}'`);
  const { sx, sy, th, r0, p, turn } = c, b = p / (2 * Math.PI);
  const cx0 = sx - turn * r0 * Math.sin(th), cy0 = sy + turn * r0 * Math.cos(th), a0 = Math.atan2(sy - cy0, sx - cx0);
  const h0 = Math.atan2(turn * r0 * Math.cos(a0) - b * Math.sin(a0), -turn * r0 * Math.sin(a0) - b * Math.cos(a0)), rot = th - h0, cr = Math.cos(rot), sr = Math.sin(rot);
  const pos = (ph) => { const r = r0 - b * ph, x = cx0 + r * Math.cos(a0 + turn * ph) - sx, y = cy0 + r * Math.sin(a0 + turn * ph) - sy; return [sx + cr * x - sr * y, sy + sr * x + cr * y]; };
  const der = (ph) => { const r = r0 - b * ph, a = a0 + turn * ph, x = -b * Math.cos(a) - turn * r * Math.sin(a), y = -b * Math.sin(a) + turn * r * Math.cos(a); return [cr * x - sr * y, sr * x + cr * y]; };
  // arc length in phi, Simpson per step of 1e-3 rad (|d^4| ~ r: error ~1e-13 u a step)
  const dph = 1e-3, phs = [0], ss = [0], sp = (ph) => Math.hypot(...der(ph));
  while (ss[ss.length - 1] < c.L + 1e-9) { const a = phs[phs.length - 1]; phs.push(a + dph); ss.push(ss[ss.length - 1] + dph / 6 * (sp(a) + 4 * sp(a + dph / 2) + sp(a + dph))); }
  const phOf = (s) => { let lo = 0, hi = ss.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] <= s) lo = m; else hi = m; }
    // linear inside one step, then two Newton steps on the speed (ds/dphi), exact to float noise
    let ph = phs[lo] + (s - ss[lo]) / ((ss[hi] - ss[lo]) || 1) * dph;
    for (let it = 0; it < 2; it++) { const a = phs[lo], sOf = ss[lo] + (ph - a) / 6 * (sp(a) + 4 * sp((a + ph) / 2) + sp(ph)); ph -= (sOf - s) / sp(ph); }
    return ph; };
  return { L: c.L, at: (s) => { const ph = phOf(s), [x, y] = pos(ph), [dx, dy] = der(ph), l = Math.hypot(dx, dy), r = r0 - b * ph;
    return { x, y, tx: dx / l, ty: dy / l, k: turn * (r * r + 2 * b * b) / (r * r + b * b) ** 1.5 }; } };
};
// The strike on a seat, exactly: the root of |P(s) - Q| - rho nearest `guess`
// (arc length from the free end), the face on side `sg` of the wire's left
// normal — the same law as the solver's leverAt, on the analytic tangent.
export const seatStrike = (curve, { Q, rho, tanLen, side, gap }, wireR, sg, guess) => {
  const g = (s) => { const q = curve.at(s), nx = -q.ty, ny = q.tx, off = wireR + gap, fx = q.x + sg * nx * off, fy = q.y + sg * ny * off;
    const bx = -sg * nx, by = -sg * ny, px = fx + side * tanLen * -by, py = fy + side * tanLen * bx;
    return { s, S: { x: q.x, y: q.y }, n: { x: nx, y: ny }, F: { x: fx, y: fy }, b: { x: bx, y: by }, P: { x: px, y: py }, k: q.k, g: Math.hypot(px - Q.x, py - Q.y) - rho }; };
  // the search runs a twentieth of a unit PAST the free end: a strike solved AT the end (the lever family's
  // anchor) has its root there to float noise, either side, and must not be lost to the other root
  const s0min = -0.05;
  if (Math.abs(g(Math.max(s0min, guess)).g) < 1e-9) return g(Math.max(s0min, guess));
  let best = null;
  for (let d = 0; d <= 3 && !best; d += 0.02) for (const s0 of [guess - d, guess + d]) {
    const a = Math.max(s0min, s0 - 0.02), c = Math.min(curve.L, s0); if (!(c > a)) continue;
    let lo = g(a), hi = g(c); if (Math.sign(lo.g) === Math.sign(hi.g)) continue;
    for (let it = 0; it < 80; it++) { const m = g((lo.s + hi.s) / 2); if (Math.sign(m.g) === Math.sign(lo.g)) lo = m; else hi = m; }
    best = Math.abs(lo.g) < Math.abs(hi.g) ? lo : hi; break; }
  return best;
};
// TODO 269 — the end-struck head against the COILS. The head stands behind its face (from the face plane
// back to its eye, headR, along −b) and is headH wide across the blow; the wire's own struck end runs AHEAD
// of the face plane and can never meet it. So a station of the wire clashes only where it stands behind the
// plane or within a wire's radius in front of it, inside the head's extent, and laterally within the face's
// half-width plus the wire's radius of the head's axis. The struck end's own first 2 u are its end, not a
// coil (any returning coil is a turn away). Returns the least lateral clearance over the stations that can
// meet the head (Infinity when none can); the solver and the build's seat check read this one rule.
export const endHeadClear = (pts, ds, F, b, headR, headH, wireR) => { let best = Infinity;
  for (let i = 0; i < pts.length; i++) { if (i * ds < 2) continue;
    const dx = pts[i][0] - F.x, dy = pts[i][1] - F.y, along = dx * b.x + dy * b.y;
    if (along > wireR || along < -headR - wireR) continue;
    best = Math.min(best, Math.abs(-dx * b.y + dy * b.x) - headH / 2 - wireR); }
  return best; };
// TODO 269 — the END strike on a seat, exactly: the blow along the wire's tangent at its free end (s = 0),
// the face one gap before the end and normal to it, the pivot tanLen along the face from F on the lever's
// side (the same P = F + side·tanLen·(ẑ×b) as every seat). No root to find: the end is the strike, and
// g = |P − Q| − rho is the residual the build holds (the generator placed the end from P, so it is float noise).
export const seatStrikeEnd = (curve, { Q, rho, tanLen, side, gap }) => {
  const q = curve.at(0), bx = q.tx, by = q.ty, fx = q.x - bx * gap, fy = q.y - by * gap;
  const px = fx + side * tanLen * -by, py = fy + side * tanLen * bx;
  return { s: 0, S: { x: q.x, y: q.y }, n: { x: -by, y: bx }, F: { x: fx, y: fy }, b: { x: bx, y: by }, P: { x: px, y: py }, k: q.k,
    g: Math.hypot(px - Q.x, py - Q.y) - rho, blow: 'tangent' };
};
// ---- the band's metal, as the build measures it (FORM_REGIONS' per-mesh hulls)
// distance from a point to a convex polygon (0 inside)
export const hullDist = (hull, x, y) => { let inside = true, best = Infinity;
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) { const [ax, ay] = hull[j], [bx, by] = hull[i], vx = bx - ax, vy = by - ay, wx = x - ax, wy = y - ay;
    if (vx * wy - vy * wx < 0) inside = false;
    const t = Math.max(0, Math.min(1, (vx * wx + vy * wy) / ((vx * vx + vy * vy) || 1))); best = Math.min(best, Math.hypot(wx - t * vx, wy - t * vy)); }
  if (hull.length >= 3) { let area = 0; for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) area += hull[j][0] * hull[i][1] - hull[i][0] * hull[j][1];
    if (area < 0) { inside = true; for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) { const [ax, ay] = hull[j], [bx, by] = hull[i]; if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) > 0) inside = false; } } }
  return inside && hull.length >= 3 ? 0 : best; };
// the parts that stand in the band [z0, z1] (one margin of z either side), every
// unit's meshes but those named in `exclude`: [{ unit, hull, box }]
export const bandParts = (regions, z0, z1, margin, exclude = new Set()) => { const out = [];
  for (const [unit, u] of Object.entries(regions.units)) { if (exclude.has(unit)) continue;
    for (const p of u.parts) { if (p.z[1] < z0 - margin || p.z[0] > z1 + margin || p.hull.length < 1) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of p.hull) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      out.push({ unit, hull: p.hull, box: [x0, x1, y0, y1] }); } }
  return out; };
// the nearest band part to (x, y) within `reach`: { d, unit } (d = Infinity past reach)
export const bandNearest = (parts, x, y, reach) => { let d = Infinity, unit = null;
  for (const q of parts) { const [x0, x1, y0, y1] = q.box; if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) continue;
    const e = hullDist(q.hull, x, y); if (e < d) { d = e; unit = q.unit; } }
  return { d, unit }; };
// the solver's map from those parts: a centreline may stand where no part is
// within `need` and the outline is at least `need` inside (inset(x, y) >= need)
export const bandMap = (parts, { x0, y0, W, H, RES, need, inset }) => { const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + (i + 0.5) * RES, y = y0 + (j + 0.5) * RES;
    free[j * W + i] = inset(x, y) >= need && bandNearest(parts, x, y, need).d >= need ? 1 : 0; }
  return { free, W, H, x0, y0, RES, need }; };
