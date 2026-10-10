// §197 — WHAT DOES THE GONG ACTUALLY SOUND LIKE, AND HOW LOUD?
//
// ACCEPTANCE. The build declares the whole chain on `__clock.acoustics` — the
// blow's energy, the wire's modes, the radiated power, a sound pressure level
// — and CLAUDE.md's rule for a figure an instrument also computes is that the
// instrument must ASSERT against it rather than resemble it. So this re-derives
// every number a SECOND way, off the metal and off the shipped pose law, and
// fails on disagreement:
//
//   · the wire's radius, section and developed length are measured from
//     `alarmGongArc`'s VERTICES, not from its TorusGeometry parameters (a
//     parameter is what the builder meant; a vertex is what it cut);
//   · the hammer's moment of inertia about its pivot is integrated by signed
//     tetrahedra over the rotor's own triangles;
//   · and the strike VELOCITY is measured by stepping `setPose({alarmStrikePhase})`
//     across the fall and differencing the head's world position — which is
//     the one number that cannot be re-read out of a constant, because it is
//     the shipped animation's own answer to "how fast does the hammer arrive".
//
// The acoustics themselves (since §253 a clamped-free ARC — Love's thin-arch
// modes, solved in main.js by shooting and HERE by Rayleigh–Ritz, a second
// method; an impulsive hand-off weighted by each mode's own modal mass; the
// arc's dipoles integrated over the sphere — by a Bessel series in the build,
// by brute-force quadrature here) are written out in main.js beside the
// build. What is worth repeating here is the LIMIT: this
// models the wire radiating ON ITS OWN. A real alarm watch is loud because the
// gong's foot drives the caseback and the caseback is a diaphragm — the wire
// is the string and the case is the soundboard — and that path is not
// modelled. Every level below is a floor, not a prediction of the watch.
//
//   node probe-197-gong-loudness.mjs            # measure, compare, verdict
//   node probe-197-gong-loudness.mjs --json     # the payload, for diffing
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8531';
const root = process.env.ROOT || '..';
const JSON_OUT = process.argv.includes('--json');
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const clock = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  const byName = new Map();
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData?.schematic || !o.geometry?.attributes?.position) return;
    if (!byName.has(o.name)) byName.set(o.name, []);
    byName.get(o.name).push(o);
  });

  // --- the wire, from its vertices ------------------------------------------
  const arc = byName.get('alarmGongArc')[0];
  arc.updateWorldMatrix(true, false);
  const wire = (() => {
    const p = arc.geometry.attributes.position, v = new THREE.Vector3();
    let rLo = Infinity, rHi = 0, zLo = Infinity, zHi = -Infinity;
    const azs = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(arc.matrixWorld);
      const r = Math.hypot(v.x, v.y);
      rLo = Math.min(rLo, r); rHi = Math.max(rHi, r);
      zLo = Math.min(zLo, v.z); zHi = Math.max(zHi, v.z);
      azs.push(Math.atan2(v.y, v.x));
    }
    // The arc's angular span, unwrapped: sort, then find the largest gap —
    // what is left is the span. (A raw max−min reads 2π on any arc that
    // straddles ±π, which this one does at some module rotations.)
    azs.sort((a, b) => a - b);
    let gap = azs[0] + Math.PI * 2 - azs[azs.length - 1], at = azs.length - 1;
    for (let i = 1; i < azs.length; i++) if (azs[i] - azs[i - 1] > gap) { gap = azs[i] - azs[i - 1]; at = i - 1; }
    const span = Math.PI * 2 - gap;
    // The tube's radius from the SECTION, two independent ways: the radial
    // half-width and the z half-height of a circular section must agree.
    return { R: (rLo + rHi) / 2, aRadial: (rHi - rLo) / 2, aAxial: (zHi - zLo) / 2, span, zMid: (zLo + zHi) / 2 };
  })();

  // --- the rotor's inertia about its pivot, by signed tetrahedra ------------
  const pivotGroup = byName.get('alarmHammerHead')[0].parent;
  pivotGroup.updateMatrixWorld(true);
  const pivotW = pivotGroup.getWorldPosition(new THREE.Vector3());
  const rotor = (() => {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let V = 0, Izz = 0;
    pivotGroup.traverse((o) => {
      if (!o.isMesh || o.userData?.schematic || !o.geometry?.attributes?.position) return;
      const pos = o.geometry.attributes.position, idx = o.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t + 2 < n; t += 3) {
        for (let e = 0; e < 3; e++) {
          const i = idx ? idx.getX(t + e) : t + e;
          const v = e === 0 ? a : e === 1 ? b : c;
          o.localToWorld(v.fromBufferAttribute(pos, i));
          v.x -= pivotW.x; v.y -= pivotW.y;
        }
        const v6 = a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x);
        V += v6 / 6;
        const P = [a, b, c];
        let sxy = 0;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const w = i === j ? 2 : 1;
          sxy += w * (P[i].x * P[j].x + P[i].y * P[j].y);
        }
        Izz += (v6 / 6) * sxy / 20;
      }
    });
    return { vol_u3: V, Izz_u5: Izz };
  })();

  // --- the strike speed, off the SHIPPED pose law --------------------------
  // Sweep one whole strike; the head's world position gives the plan radius
  // and the angle, and the fall ends where the angular rate collapses (the
  // wire stops the hammer dead — that discontinuity IS the strike).
  const head = byName.get('alarmHammerHead')[0];
  // §198 — the hammer's own sense: the lifting lever turns it CLOCKWISE under
  // the lift, so the pivot's angle is liftSign × the law's. Read in the LAW's
  // frame (the fall runs negative there, and the strike is its minimum), so
  // the extremum search below stays the one §197 wrote.
  const liftSign = clock.acoustics.hammer.liftSign || 1;
  const sample = (u) => {
    clock.setPose({ alarmStrikePhase: 4 + u, alarmReleased: true });
    pivotGroup.updateMatrixWorld(true);
    return liftSign * pivotGroup.rotation.z;
  };
  const N = 20000;
  const th = [];
  for (let i = 0; i <= N; i++) th.push(sample(i / N));
  clock.setPose({ alarmStrikePhase: 0 });
  let iMin = 0;
  for (let i = 1; i < th.length; i++) if (th[i] < th[iMin]) iMin = i;
  // The rate at the wire, per unit PHASE — measured a couple of samples SHORT
  // of the minimum on purpose. The minimum IS the strike, and the sample at it
  // may already belong to the rebound branch, so a difference that straddles
  // the discontinuity reads the bounce's rate instead of the fall's (measured:
  // 2.6% low, which is 5% of the blow's energy). A centred difference two
  // samples back is wholly inside the free swing, and the fall's own curvature
  // over 1e-4 of a phase is nothing.
  const dTheta = (th[iMin - 1] - th[iMin - 3]) * N / 2;
  const armPlan = Math.hypot(head.getWorldPosition(new THREE.Vector3()).x - pivotW.x,
    head.getWorldPosition(new THREE.Vector3()).y - pivotW.y);

  return {
    declared: JSON.parse(JSON.stringify(clock.acoustics)),
    gapNow: clock.equalisation.alarm.cadence.gapFull_s,
    cadence: JSON.parse(JSON.stringify(clock.equalisation.alarm.cadence)),
    wire, rotor,
    poseLaw: { dThetaPerPhase: dTheta, strikeU: iMin / N, thetaMin: th[iMin], thetaMax: Math.max(...th) },
  };
});
await browser.close(); srv.kill();

// --- the re-derivation, in this process ------------------------------------
const UNIT_MM = 0.72 / 1.9;
const U = UNIT_MM / 1000;
const RHO = 7850, E_STEEL = 200e9, NU = 0.29, CBAR = Math.sqrt(E_STEEL / RHO);
const RHO0 = 1.2, C0 = 343, REST = 0.8, Q = 4000;
const BL = [1.87510407, 4.69409113, 7.85475744, 10.99554073, 14.13716839];   // §56's straight roots: the mode ceiling, as in the build
// §253 — the arc's in-plane modes by RAYLEIGH–RITZ (Legendre basis in s = θ/α,
// Gauss quadrature, Cholesky + Jacobi): nothing shared with the build's
// shooting solve, which probe-253-arch-modes holds it against to 1e-6.
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
function archModesRR(S, alpha, N = 14, nq = 48) {
  const n = 2 * N, K = Array.from({ length: n }, () => new Array(n).fill(0)), Mm = Array.from({ length: n }, () => new Array(n).fill(0));
  const q = gauss(nq);
  for (let g = 0; g < nq; g++) {
    const s = q.x[g], wq = q.w[g] * alpha, b = basisAt(N, s);
    const eps = [], kap = [], uu = [], ww = [];
    for (let i = 0; i < N; i++) { uu.push(b.u[i]); ww.push(0); eps.push(b.u1[i] / alpha); kap.push(b.u1[i] / alpha); }
    for (let i = 0; i < N; i++) { uu.push(0); ww.push(b.w[i]); eps.push(b.w[i]); kap.push(-b.w2[i] / (alpha * alpha)); }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { K[i][j] += wq * (S * eps[i] * eps[j] + kap[i] * kap[j]); Mm[i][j] += wq * (uu[i] * uu[j] + ww[i] * ww[j]); }
  }
  const Lc = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let sum = Mm[i][j]; for (let k = 0; k < j; k++) sum -= Lc[i][k] * Lc[j][k]; Lc[i][j] = i === j ? Math.sqrt(sum) : sum / Lc[j][j]; }
  const solveL = (b) => { const y = b.slice(); for (let i = 0; i < n; i++) { for (let k = 0; k < i; k++) y[i] -= Lc[i][k] * y[k]; y[i] /= Lc[i][i]; } return y; };
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
    for (let r = n - 1; r >= 0; r--) { for (let k = r + 1; k < n; k++) a[r] -= Lc[k][r] * a[k]; a[r] /= Lc[r][r]; }
    const NG = 160, w = new Float64Array(NG + 1), u = new Float64Array(NG + 1);
    for (let g = 0; g <= NG; g++) { const b = basisAt(N, g / NG); let ww = 0, uu = 0; for (let k = 0; k < N; k++) { uu += a[k] * b.u[k]; ww += a[N + k] * b.w[k]; } w[g] = ww; u[g] = uu; }
    const tip = w[NG]; let I2 = 0, Iu = 0;
    for (let g = 0; g <= NG; g++) { w[g] /= tip; u[g] /= tip; const c = (g === 0 || g === NG) ? 0.5 : 1; I2 += c * (u[g] * u[g] + w[g] * w[g]); Iu += c * u[g] * u[g]; }
    return { Om, g: Om ** 0.25, mFrac: I2 / NG, tanShare: Iu / I2, w };
  });
}
const aWeight = (f) => {
  const f2 = f * f;
  const num = 12194 ** 2 * f2 * f2;
  const den = (f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2);
  return 20 * Math.log10(num / den) + 2.0;
};

const w = out.wire;
const aW = ((w.aRadial + w.aAxial) / 2) * U;         // the section, both readings averaged
const L = w.R * w.span * U;
const M = RHO * Math.PI * aW * aW * L;
// §253 — the arc as the vertices read it: R and the span give α, R and the
// section give S, and the fundamental's own modal fraction is the impedance.
const R_m = w.R * U, alphaArc = w.span, S_arc = (R_m / (aW / 2)) ** 2;
const arch = archModesRR(S_arc, alphaArc).filter((m) => m.g <= 1.1 * BL[4] / alphaArc).slice(0, 8)
  .map((m) => ({ ...m, f: Math.sqrt(m.Om) * (aW / 2) * CBAR / (2 * Math.PI * R_m * R_m), kind: m.tanShare > 0.5 ? 'extensional' : 'flexural' }));
const mModal = M * arch[0].mFrac;
const I_h = out.rotor.Izz_u5 * U ** 5 * RHO;
// The gap the pose law was sampled at: setPose derives the wind from the phase
// (phase 4 of 28 ⇒ 1.75 − 4/16 turns), so the fall's phase fraction converts
// to seconds through the governor's law at THAT wind — read from the cadence
// record rather than restated.
const c = out.cadence;
const windAt4 = 1.75 - 4 / 16;
// §104's law is gap ∝ 1/√M(θ) and the barrel's moment is linear in wind, so
// 1/gap² is linear in turns: the record's two endpoints fix it exactly, with
// no constant of the governor's restated here.
const gapFromLaw = (() => {
  // Two known points on gap ∝ 1/√(a + b·turns) fix a and b: use gapEmpty and gapFull.
  const g0 = c.gapEmpty_s, g1 = c.gapFull_s, T = 1.75;
  const k0 = 1 / (g0 * g0), k1 = 1 / (g1 * g1);          // ∝ moment
  return (t) => 1 / Math.sqrt(k0 + (k1 - k0) * (t / T));
})();
const gap = gapFromLaw(windAt4);
const thetaDot = -out.poseLaw.dThetaPerPhase / gap;   // rad/s (the fall runs negative)
const rArm = out.declared.hammer.arm_mm / 1000;
const vHead = thetaDot * rArm;
const E_blow = 0.5 * I_h * thetaDot * thetaDot;
const mEff = I_h / (rArm * rArm);
const mu = mEff / mModal;
const eta = (4 * mu / (1 + mu) ** 2) * ((1 + REST) / 2) ** 2;
const Estar = E_STEEL / (2 * (1 - NU * NU));
const kHertz = (4 / 3) * Estar * Math.sqrt(Math.sqrt(aW * w.R * U));
const mRed = mEff * mModal / (mEff + mModal);
const tau = 2.9432 * (5 * mRed / (4 * kHertz)) ** 0.4 * Math.abs(vHead) ** -0.2;
const spec = arch.map((m) => {
  const f = m.f, x = 2 * f * tau;
  const S = Math.abs(Math.cos(Math.PI * f * tau) / (Math.abs(1 - x * x) < 1e-12 ? 1e-12 : 1 - x * x));
  return { f, w: S * S / m.mFrac, mFrac: m.mFrac, kind: m.kind, shape: m.w };   // §253: ÷ modal mass — J²φ²/2mₙ per mode
});
const wSum = spec.reduce((t, m) => t + m.w, 0);
// §253 — the arc's far field by BRUTE FORCE over the sphere (the build does it
// by a Bessel series): F(r̂) = R∫φ (n̂·r̂) e^{−ik r̂·x} dθ, dipoles normal to the
// wire, turning with it.
const radiate = (shape, kAc, amp) => {
  const NG = shape.length - 1, dth = alphaArc / NG, NT = 100, NP = 400;
  let sph = 0, peak = 0;
  for (let t = 0; t <= NT; t++) {
    const vt = (t / NT) * Math.PI, st = Math.sin(vt), wT = (t === 0 || t === NT) ? 0.5 : 1;
    for (let p = 0; p < NP; p++) {
      const ph = (p / NP) * 2 * Math.PI; let re = 0, im = 0;
      for (let q = 0; q <= NG; q++) { const c = (q === 0 || q === NG) ? 0.5 : 1, th = q * dth, nr = st * Math.cos(ph - th), a = -kAc * R_m * nr; re += c * shape[q] * nr * Math.cos(a); im += c * shape[q] * nr * Math.sin(a); }
      const F2 = R_m * R_m * (re * re + im * im) * dth * dth;
      sph += wT * F2 * st * (Math.PI / NT) * (2 * Math.PI / NP); peak = Math.max(peak, F2);
    }
  }
  return {
    W: kAc * kAc * amp * amp * sph / (32 * Math.PI * Math.PI * RHO0 * C0),
    I: kAc * kAc * amp * amp * peak / (32 * Math.PI * Math.PI * RHO0 * C0 * 0.09),
  };
};
let acc = 0;
const modes = spec.map((m, i) => {
  const E_n = eta * E_blow * m.w / wSum;
  const U_n = Math.sqrt(2 * E_n / (M * m.mFrac));
  const om = 2 * Math.PI * m.f, kAc = om / C0;
  const { W: W_rad, I } = radiate(m.shape, kAc, 2 * RHO0 * Math.PI * aW * aW * om * U_n);
  const spl = 10 * Math.log10(Math.max(I, 1e-30) / 1e-12);
  const audible = m.f <= 20000;
  if (audible) acc += 10 ** ((spl + aWeight(m.f)) / 10);
  return { n: i + 1, kind: m.kind, f_Hz: m.f, mFrac: m.mFrac, W_W: W_rad, spl_dB: spl, splA_dBA: spl + aWeight(m.f), audible,
    ringT60_s: 13.8 * Q / om };
});
const splA = 10 * Math.log10(Math.max(acc, 1e-30));

const D = out.declared;
const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : String(x));
if (JSON_OUT) {
  console.log(JSON.stringify({ measured: { aW, L, M, I_h, thetaDot, vHead, E_blow, mu, eta, tau, modes, splA }, declared: D }, null, 1));
} else {
  console.log('§197 — the alarm gong, measured off the metal\n');
  console.log(`  band            floor ${fmt(D.band.floor)} (${D.band.floorOwner})  ceiling ${fmt(D.band.ceiling)}  ring z ${fmt(D.band.ringZ)}  cam z ${fmt(D.band.strikeZ)}`);
  console.log(`  wire            ⌀${fmt(2 * aW * 1000)} mm  × ${fmt(L * 1000)} mm developed (${fmt(w.span * 180 / Math.PI, 2)}° of r ${fmt(w.R, 2)})  ${fmt(M * 1e6, 2)} mg, modal ${fmt(mModal * 1e6, 2)} mg (the arc fundamental's ${fmt(arch[0].mFrac, 4)} of the wire — §253; S ${fmt(S_arc, 0)})`);
  console.log(`  hammer rotor    ${fmt(out.rotor.vol_u3 * U ** 3 * RHO * 1e6, 2)} mg   I ${I_h.toExponential(4)} kg·m²   effective at the face ${fmt(mEff * 1e6, 2)} mg`);
  console.log(`  the blow        ${fmt(Math.abs(thetaDot), 1)} rad/s → ${fmt(Math.abs(vHead), 3)} m/s at the face,  E = ${E_blow.toExponential(4)} J`);
  console.log(`                  fall ${fmt(D.hammer.fall_s * 1000, 2)} ms — √(k/I) since §266 (W ${fmt(D.spring.W_rad_s, 0)} rad/s), where §25 chose a third of the cam's free window`);
  console.log(`  the spring      §266's torsion spiral: k = ${D.spring.k_Nm_per_rad.toExponential(3)} N·m/rad (energy rate; secant ${D.spring.kSecant_Nm_per_rad.toExponential(3)}, pure ${D.spring.kPure_Nm_per_rad.toExponential(3)})`);
  console.log(`   (TODO 128)     a ${fmt(D.spring.t_mm, 3)} mm × ${fmt(D.spring.b_u * UNIT_MM, 3)} mm strip, ${fmt(D.spring.coils, 4)} turns, ${fmt(D.spring.devLen_mm, 2)} mm developed, strain ${D.spring.strainMax.toExponential(3)} at the draw (target ${D.spring.strainTarget.toExponential(3)})`);
  console.log(`                  the lift's peak ${D.spring.liftPeak_Nm.toExponential(3)} N·m at the strike arbor against its ${D.spring.liftBudget_Nm.toExponential(3)} budget (${D.spring.liftShare} of ${D.spring.arborTqSetup_Nm.toExponential(3)} at set-up); mean spend ${D.spring.liftSpend_Nm.toExponential(3)}`);
  console.log(`                  stores ${(D.spring.storedAtDraw_J * 1e6).toFixed(2)} µJ at the draw, ${(D.spring.storedAtWire_J * 1e6).toFixed(2)} µJ at the wire — releases ${(D.spring.release_J * 1e6).toFixed(2)} µJ (the blow, held as an identity below)`);
  console.log(`  hand-off        μ = ${fmt(mu)} (matched at 1.0), η = ${fmt(eta)}, contact ${fmt(tau * 1e6, 2)} µs\n`);
  console.log('  mode      f        SPL @0.3 m     dBA      T60      heard            kind');
  for (const m of modes)
    console.log(`   ${m.n}   ${fmt(m.f_Hz, 0).padStart(8)} Hz  ${fmt(m.spl_dB, 1).padStart(7)} dB  ${fmt(m.splA_dBA, 1).padStart(7)}  ${fmt(m.ringT60_s, 2).padStart(6)} s   ${(m.audible ? 'yes' : 'no (ultrasonic)').padEnd(16)} ${m.kind}`);
  console.log(`\n  TOTAL           ${fmt(splA, 1)} dBA at 0.3 m, on axis — the WIRE alone (no case path)\n`);
}

// --- the verdict ------------------------------------------------------------
const checks = [
  ['wire section, radial vs axial reading', Math.abs(w.aRadial / w.aAxial - 1), 0.02],
  ['fundamental vs declared', Math.abs(modes[0].f_Hz / D.modes[0].f_Hz - 1), 0.01],
  ['second partial vs declared (§253)', Math.abs(modes[1].f_Hz / D.modes[1].f_Hz - 1), 0.01],
  ['fundamental modal fraction vs declared (§253)', Math.abs(modes[0].mFrac / D.wire.modalFrac - 1), 0.01],
  ['second partial radiated power vs declared (§253)', Math.abs(modes[1].W_W / D.modes[1].W_W - 1), 0.05],
  ['blow energy vs declared', Math.abs(E_blow / D.strike.energy_J - 1), 0.03],
  ['mass ratio vs declared', Math.abs(mu / D.strike.mu - 1), 0.02],
  ['A-weighted level vs declared (dB)', Math.abs(splA - D.splA_dBA), 0.6],
  ['implied spring release vs rotor arrival', Math.abs(D.spring.release_J / D.strike.energy_J - 1), 1e-6],
];
let bad = 0;
console.log('  cross-check (this process re-derived it; the build declared it)');
for (const [what, got, lim] of checks) {
  const ok = got <= lim;
  if (!ok) bad++;
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${what.padEnd(40)} ${got.toExponential(2)} ≤ ${lim}`);
}
// The design bounds §197 holds, restated here so the probe is a gate and not
// only a mirror of the build's own asserts.
const bounds = [
  ['fundamental inside 1–4 kHz', modes[0].f_Hz >= 1000 && modes[0].f_Hz <= 4000],
  ['wire inside real gong stock 0.4–1.1 mm', 2 * aW * 1000 >= 0.4 - 1e-3 && 2 * aW * 1000 <= 1.1 + 1e-3],   // §198 sizes the wire AT the ceiling; the knob's 4-decimal quantum is 8e-5 mm
  ['mass ratio within 0.4–2.5 of matched', mu > 0.4 && mu < 2.5],
  ['fall fits the fastest free window', D.hammer.fall_s <= out.cadence.hammerWindow.freeAtFastest_s],
];
for (const [what, ok] of bounds) {
  if (!ok) bad++;
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${what}`);
}
const noisy = warns.filter((x) => !/WebGL|GroupMarkerNotSet|Failed to load resource|GL Driver Message/.test(x));
if (noisy.length) { bad++; console.log('   FAIL  boot is not silent:'); noisy.forEach((x) => console.log('         ' + x)); }
console.log(bad ? `\n${bad} FAILURE(S)` : '\nall clear');
process.exit(bad ? 1 : 0);
