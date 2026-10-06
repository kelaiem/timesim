// §253 — IS THE GONG'S ARCH SOLVE RIGHT, AND DOES IT KNOW WHEN IT IS A STRAIGHT BAR?
//
// ACCEPTANCE. TODO 17's last open clause was the CURVATURE TERM: the gong wire
// is an arc struck in its own plane, and §56's voice was the straight
// clamped-free bar's. §253 solves Love's thin-arch equations exactly
// (`GONG_ARCH` in main.js — the six-state system propagated by the matrix
// exponential, the free-end 3×3 determinant scanned and bisected) and writes
// the arc's radiation integral by a Jacobi–Anger / Bessel series. Both are the
// kind of arithmetic that comes back CLEAN while measuring the wrong thing, so
// this holds each to limits it did not get to choose, calling the BUILD's own
// functions through `__clock.gongArch` rather than a copy of them:
//
//   1. THE STRAIGHT LIMIT. At the shipped developed length, flatten the arc
//      (α → 0 with L fixed, R = L/α): the first three roots must return to
//      §56's β_nL and the modal fraction to ¼ — and the approach must be
//      monotone in α, which is what says the deviation at 55° is the
//      curvature and not the solver.
//   2. A SECOND METHOD. A Rayleigh–Ritz solve of the same energy (Legendre
//      basis, Gauss quadrature, Cholesky + Jacobi — nothing shared with the
//      shooting) at the shipped S and α must land on the same Ω and the same
//      modal fraction.
//   3. THE CHARACTERISTIC CUBIC'S TEXTBOOK LIMIT. The cubic's S → ∞ root at
//      p = −n² must give the closed inextensional ring's Ω = n²(n²−1)²/(n²+1).
//   4. THE RADIATION'S STRAIGHT LIMIT. The build's arc integral, flattened the
//      same way, must return §197's line-of-dipoles integral (re-written here)
//      — total power AND on-axis peak.
//   5. THE RADIATION AT THE SHIPPED ARC. The build's Bessel series must agree
//      with a brute-force quadrature over the sphere of the same |F|².
//   6. THE DESIGN POINT. The length/block/radius fixed point closed, the foot
//      walked 0°, f₁ is the 2500 Hz target, f₂/f₁ is the arc's ratio and not
//      the straight bar's 6.27, and the head's mass is the arc fundamental's
//      modal fraction of the design wire.
//
//   cd tools && node probe-253-arch-modes.mjs       (exit 1 on any failure)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8553';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const UNIT_MM = 0.72 / 1.9, U = UNIT_MM / 1000, CBAR = Math.sqrt(200e9 / 7850), C0 = 343;
const BL = [1.87510407, 4.69409113, 7.85475744, 10.99554073, 14.13716839];

const out = await page.evaluate(({ BL }) => {
  const c = window.__clock, A = JSON.parse(JSON.stringify(c.acoustics)), G = c.gongArch;
  const k_u = A.wire.dia_mm / 0.379 / 4;   // placeholder, replaced below from the payload's own S
  const alpha = A.wire.arcRad, S = A.wire.S, R_u = A.wire.ringR_u;
  const kU = R_u / Math.sqrt(S);           // radius of gyration, u — exactly what S encodes
  const L_u = R_u * alpha;
  // 1 — the straight limit at fixed L: α → 0, R = L/α, S = (R/k)²
  const flat = [0.4, 0.2, 0.1, 0.05, 0.02].map((al) => {
    const R = L_u / al, Ss = (R / kU) ** 2;
    const m = G.modes(Ss, al, 1.3 * BL[2] / al, 3);
    return { al, gAlpha: m.map((x) => x.g * al), mFrac: m.map((x) => x.mFrac) };
  });
  // the shipped point, full
  const shipped = G.modes(S, alpha, 1.1 * BL[4] / alpha, 8);
  // 4 — radiation at the straight limit: the build's integral on the straight shape, R = L/α
  const straightShape = (bl, NG) => {
    const sig = (Math.cosh(bl) + Math.cos(bl)) / (Math.sinh(bl) + Math.sin(bl));
    const raw = (u) => (Math.cosh(bl * u) - Math.cos(bl * u)) - sig * (Math.sinh(bl * u) - Math.sin(bl * u));
    const tip = raw(1);
    return Array.from({ length: NG + 1 }, (_, q) => raw(q / NG) / tip);
  };
  const L_m = L_u * 0.72 / 1.9 / 1000;
  const radFlat = [0, 1].map((n) => {
    const al = 0.02, R_m = L_m / al, f = A.wire.straightLaw_Hz[n], kAc = 2 * Math.PI * f / 343;
    return { n, kAc, f, ...G.radiation(straightShape(BL[n], 400), al, R_m, kAc) };
  });
  // 5 — radiation at the shipped arc, the build's series on the build's shapes
  const R_m = R_u * 0.72 / 1.9 / 1000;
  const radArc = shipped.slice(0, 3).map((m, n) => {
    const kAc = 2 * Math.PI * A.modes[n].f_Hz / 343;
    return { n, kAc, ...G.radiation(m.w, alpha, R_m, kAc) };
  });
  return { A, flat, shipped: shipped.map((m) => ({ g: m.g, Om: m.Om, mFrac: m.mFrac, tanShare: m.tanShare, uTip: m.uTip, w: m.w })), radFlat, radArc, alpha, S, R_u, L_u, kU, roots: G.straightRoots };
}, { BL });
await browser.close(); srv.kill();

// ---------- the second method: Rayleigh–Ritz on the same energy ----------
function legendre(n, x) { const P = [1, x]; for (let k = 1; k < n; k++) P.push(((2 * k + 1) * x * P[k] - k * P[k - 1]) / (k + 1)); return P; }
function gauss(n) {
  const x = [], w = [];
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dz = 1;
    for (let it = 0; it < 100 && Math.abs(dz) > 1e-15; it++) { const P = legendre(n, z); const dp = n * (z * P[n] - P[n - 1]) / (z * z - 1); dz = P[n] / dp; z -= dz; }
    const P = legendre(n, z), dp = n * (z * P[n] - P[n - 1]) / (z * z - 1);
    x.push((z + 1) / 2); w.push(1 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}
function basisAt(N, s) {
  const h = 1e-5;
  const f = (ss) => { const P = legendre(N, 2 * ss - 1); return { w: P.slice(0, N).map((p) => ss * ss * p), u: P.slice(0, N).map((p) => ss * p) }; };
  const c = f(s), p = f(s + h), m = f(s - h);
  return { w: c.w, w1: c.w.map((_, i) => (p.w[i] - m.w[i]) / (2 * h)), w2: c.w.map((_, i) => (p.w[i] - 2 * c.w[i] + m.w[i]) / (h * h)), u: c.u, u1: c.u.map((_, i) => (p.u[i] - m.u[i]) / (2 * h)) };
}
function rrModes(S, alpha, N = 14, nq = 48) {
  const n = 2 * N, K = Array.from({ length: n }, () => new Array(n).fill(0)), M = Array.from({ length: n }, () => new Array(n).fill(0));
  const q = gauss(nq);
  for (let g = 0; g < nq; g++) {
    const s = q.x[g], wq = q.w[g] * alpha, b = basisAt(N, s);
    const eps = [], kap = [], uu = [], ww = [];
    for (let i = 0; i < N; i++) { uu.push(b.u[i]); ww.push(0); eps.push(b.u1[i] / alpha); kap.push(b.u1[i] / alpha); }
    for (let i = 0; i < N; i++) { uu.push(0); ww.push(b.w[i]); eps.push(b.w[i]); kap.push(-b.w2[i] / (alpha * alpha)); }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { K[i][j] += wq * (S * eps[i] * eps[j] + kap[i] * kap[j]); M[i][j] += wq * (uu[i] * uu[j] + ww[i] * ww[j]); }
  }
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let sum = M[i][j]; for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k]; L[i][j] = i === j ? Math.sqrt(sum) : sum / L[j][j]; }
  const solveL = (b) => { const y = b.slice(); for (let i = 0; i < n; i++) { for (let k = 0; k < i; k++) y[i] -= L[i][k] * y[k]; y[i] /= L[i][i]; } return y; };
  const Y = []; for (let j = 0; j < n; j++) Y.push(solveL(K.map((r) => r[j])));
  const C = []; for (let i = 0; i < n; i++) C.push(solveL(Y.map((col) => col[i])));
  const A = C.map((r) => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let qq = p + 1; qq < n; qq++) {
      if (Math.abs(A[p][qq]) < 1e-300) continue;
      const th = (A[qq][qq] - A[p][p]) / (2 * A[p][qq]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), cc = 1 / Math.sqrt(t * t + 1), sn = t * cc;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][qq]; A[k][p] = cc * akp - sn * akq; A[k][qq] = sn * akp + cc * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[qq][k]; A[p][k] = cc * apk - sn * aqk; A[qq][k] = sn * apk + cc * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][qq]; V[k][p] = cc * vkp - sn * vkq; V[k][qq] = sn * vkp + cc * vkq; }
    }
  }
  return Array.from({ length: n }, (_, i) => ({ Om: A[i][i], i })).sort((a, b) => a.Om - b.Om).map(({ Om, i }) => {
    const a = V.map((r) => r[i]);
    for (let r = n - 1; r >= 0; r--) { for (let k = r + 1; k < n; k++) a[r] -= L[k][r] * a[k]; a[r] /= L[r][r]; }
    const NG = 160, w = new Float64Array(NG + 1), u = new Float64Array(NG + 1);
    for (let g = 0; g <= NG; g++) { const b = basisAt(N, g / NG); let ww = 0, uu = 0; for (let k = 0; k < N; k++) { uu += a[k] * b.u[k]; ww += a[N + k] * b.w[k]; } w[g] = ww; u[g] = uu; }
    const tip = w[NG]; let I2 = 0;
    for (let g = 0; g <= NG; g++) { w[g] /= tip; u[g] /= tip; const c = (g === 0 || g === NG) ? 0.5 : 1; I2 += c * (u[g] * u[g] + w[g] * w[g]); }
    return { Om, mFrac: I2 / NG };
  });
}
// ---------- §197's line integral, and a brute-force sphere, for the radiation ----------
function lineIntegral(phi, kAc, L) {
  const NX = 400, NA = 720; let peak = 0, tot = 0;
  for (let j = 0; j <= NA; j++) {
    const al = (j / NA) * Math.PI, ca = Math.cos(al); let re = 0, im = 0;
    for (let q = 0; q <= NX; q++) { const u = q / NX, w = (q === 0 || q === NX) ? 0.5 : 1; const ph = phi[q] * w, th = -kAc * L * u * ca; re += ph * Math.cos(th); im += ph * Math.sin(th); }
    const D2 = (re * re + im * im) * (L / NX) ** 2, wA = (j === 0 || j === NA) ? 0.5 : 1;
    tot += wA * Math.sin(al) ** 3 * D2 * (Math.PI / NA); peak = Math.max(peak, Math.sin(al) ** 2 * D2);
  }
  return { sph: Math.PI * tot, peak };
}
function sphereBrute(wn, alpha, R, kAc, NT = 120, NP = 480) {
  const NG = wn.length - 1, dth = alpha / NG; let sph = 0, peak = 0;
  for (let t = 0; t <= NT; t++) {
    const vt = (t / NT) * Math.PI, st = Math.sin(vt), wT = (t === 0 || t === NT) ? 0.5 : 1;
    for (let p = 0; p < NP; p++) {
      const ph = (p / NP) * 2 * Math.PI; let re = 0, im = 0;
      for (let q = 0; q <= NG; q++) { const c = (q === 0 || q === NG) ? 0.5 : 1, th = q * dth, nr = st * Math.cos(ph - th), a = -kAc * R * nr; re += c * wn[q] * nr * Math.cos(a); im += c * wn[q] * nr * Math.sin(a); }
      const F2 = R * R * (re * re + im * im) * dth * dth; sph += wT * F2 * st * (Math.PI / NT) * (2 * Math.PI / NP); peak = Math.max(peak, F2);
    }
  }
  return { sph, peak };
}
const straightPhi = (bl, NG) => { const sig = (Math.cosh(bl) + Math.cos(bl)) / (Math.sinh(bl) + Math.sin(bl)); const raw = (u) => (Math.cosh(bl * u) - Math.cos(bl * u)) - sig * (Math.sinh(bl * u) - Math.sin(bl * u)); const tip = raw(1); return Array.from({ length: NG + 1 }, (_, q) => raw(q / NG) / tip); };

let bad = 0;
const say = (ok, what) => { if (!ok) bad++; console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${what}`); };
const { A } = out;
console.log(`§253 — the gong's arch solve, held to its limits\n  shipped: α ${(out.alpha * 180 / Math.PI).toFixed(3)}°, S ${out.S.toFixed(1)}, r ${out.R_u.toFixed(3)} u, L ${out.L_u.toFixed(3)} u; modes ${A.modes.map((m) => `${m.f_Hz.toFixed(0)}(${m.kind[0]})`).join(' ')} Hz\n`);

console.log('  1. the straight limit (L fixed, α → 0): g·α / β_nL and modal fraction, modes 1–3');
for (const f of out.flat) console.log(`      α ${String(f.al).padEnd(5)} ${f.gAlpha.map((g, i) => (g / BL[i]).toFixed(5)).join(' ')}   m/M ${f.mFrac.map((x) => x.toFixed(4)).join(' ')}`);
const last = out.flat[out.flat.length - 1];
say(last.gAlpha.every((g, i) => Math.abs(g / BL[i] - 1) < 1e-4), `at α = ${last.al} the three roots are §56's β_nL to 1e-4`);
say(last.mFrac.every((x) => Math.abs(x - 0.25) < 1e-3), `at α = ${last.al} the modal fraction is ¼ to 1e-3`);
const dev = out.flat.map((f) => Math.abs(f.gAlpha[0] / BL[0] - 1));
say(dev.every((d, i) => i === 0 || d < dev[i - 1]), `the fundamental's deviation from the straight root falls monotonically as the arc flattens (${dev.map((d) => d.toExponential(1)).join(' → ')})`);
const curv = { f1: A.modes[0].f_Hz / A.wire.straightLaw_Hz[0], f2: A.modes[1].f_Hz / A.wire.straightLaw_Hz[1] };
console.log(`      at the shipped arc the curvature term is f₁ ${((curv.f1 - 1) * 100).toFixed(2)}%, f₂ ${((curv.f2 - 1) * 100).toFixed(2)}% against the straight law, m₁/M ${A.wire.modalFrac.toFixed(4)}`);

console.log('\n  2. a second method: Rayleigh–Ritz at the shipped S and α');
const rr = rrModes(out.S, out.alpha, 14);
const flex = out.shipped;
for (let n = 0; n < Math.min(6, flex.length); n++) console.log(`      mode ${n + 1}: Ω shooting ${flex[n].Om.toExponential(8)}  RR ${rr[n].Om.toExponential(8)}  (${(rr[n].Om / flex[n].Om - 1).toExponential(1)})  m/M ${flex[n].mFrac.toFixed(6)} / ${rr[n].mFrac.toFixed(6)}`);
say([0, 1, 2].every((n) => Math.abs(rr[n].Om / flex[n].Om - 1) < 1e-6), 'modes 1–3: Ω agrees to 1e-6 between the two methods');
say([0, 1, 2].every((n) => Math.abs(rr[n].mFrac - flex[n].mFrac) < 1e-4), 'modes 1–3: modal fraction agrees to 1e-4');

console.log('\n  3. the cubic at S → ∞: the inextensional ring');
const cubic = (S, Om, p) => S * p ** 3 + (Om + 2 * S) * p * p - ((S + 1) * Om - S) * p - Om * (Om - S);
let ringOk = true;
for (const n of [2, 3, 4, 5]) {
  const Om = n * n * (n * n - 1) ** 2 / (n * n + 1), p = -n * n, S = 1e9;
  const r = cubic(S, Om, p) / (S * Math.abs(p) ** 3);   // relative to the leading term
  ringOk = ringOk && Math.abs(r) < 1e-6;
  console.log(`      n = ${n}: Ω_ring ${Om.toFixed(4)}, cubic residual / leading term ${r.toExponential(2)}`);
}
say(ringOk, 'p = −n² with the ring\'s Ω is a root of the cubic at S = 1e9, to 1e-6');

console.log('\n  4. the radiation\'s straight limit (α = 0.02, L fixed): the build\'s arc series vs §197\'s line integral');
const L_m = out.L_u * U;
for (const r of out.radFlat) {
  const line = lineIntegral(straightPhi(BL[r.n], 400), r.kAc, L_m);
  console.log(`      mode ${r.n + 1} (${r.f.toFixed(0)} Hz, kL ${(r.kAc * L_m).toFixed(2)}): ∫|F|² ${r.sph.toExponential(5)} vs ${line.sph.toExponential(5)} (${(r.sph / line.sph - 1).toExponential(1)}); peak ${(r.peak / line.peak - 1).toExponential(1)}`);
  say(Math.abs(r.sph / line.sph - 1) < 1e-3 && Math.abs(r.peak / line.peak - 1) < 1e-2, `mode ${r.n + 1}: power to 1e-3, peak to 1e-2`);
}

console.log('\n  5. the radiation at the shipped arc: the build\'s series vs a brute-force sphere');
const R_m = out.R_u * U;
for (const r of out.radArc) {
  const br = sphereBrute(out.shipped[r.n].w, out.alpha, R_m, r.kAc);
  console.log(`      mode ${r.n + 1} (kR ${(r.kAc * R_m).toFixed(2)}): ∫|F|² ${r.sph.toExponential(5)} vs ${br.sph.toExponential(5)} (${(r.sph / br.sph - 1).toExponential(1)}); peak ${(r.peak / br.peak - 1).toExponential(1)}`);
  say(Math.abs(r.sph / br.sph - 1) < 1e-4 && Math.abs(r.peak / br.peak - 1) < 3e-3, `mode ${r.n + 1}: power to 1e-4, peak to 3e-3`);
}

console.log('\n  6. the design point');
say(A.wire.designFixedPoint.closed, `the length/block/radius fixed point closed in ${A.wire.designFixedPoint.rounds} round(s), ${A.wire.designFixedPoint.solves} solves`);
say(A.wire.footWalkedDeg === 0 && Math.abs(A.modes[0].f_Hz / A.wire.targetF1_Hz - 1) < 1e-3, `foot walked ${A.wire.footWalkedDeg}°, f₁ ${A.modes[0].f_Hz.toFixed(1)} Hz on the ${A.wire.targetF1_Hz} target`);
const ratio = A.modes[1].f_Hz / A.modes[0].f_Hz;
say(ratio > 5 && ratio < 6 && Math.abs(ratio - (BL[1] / BL[0]) ** 2) > 0.3, `f₂/f₁ = ${ratio.toFixed(3)} — the arc's, not the straight bar's ${((BL[1] / BL[0]) ** 2).toFixed(2)}`);
say(A.modes[0].kind === 'flexural' && A.modes[1].kind === 'flexural', 'the two audible modes are flexural');
say(Math.abs(A.hammer.headMass_mg / A.wire.designModalMass_mg - 1) < 0.02, `head ${A.hammer.headMass_mg.toFixed(2)} mg against the design wire's fundamental modal mass ${A.wire.designModalMass_mg.toFixed(2)} mg (fraction ${A.wire.designModalFrac.toFixed(4)})`);
const noise = warns.filter((w) => !/WebGL|GL Driver|GroupMarker|404|swiftshader/i.test(w));
say(noise.length === 0, `boot silent${noise.length ? ': ' + noise.join(' | ') : ''}`);
console.log(bad ? `\n${bad} FAILED` : '\nALL PASS');
process.exitCode = bad ? 1 : 0;
