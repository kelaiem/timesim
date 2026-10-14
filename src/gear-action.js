// §136's cycloidal pair solve, THREE-FREE so that anything that must price a
// mesh from the same arcs the teeth are cut with can import it without booting
// a renderer: geometry.js (the generator), main.js's energy column (TODO 255:
// the contact-ratio split a mesh's friction loss turns on) and the probes.
// Moved verbatim from geometry.js — the arithmetic, the memo and the order of
// operations are unchanged, which is why the geometry fingerprint is the
// acceptance. The derivation (the nine constraints) stays written beside the
// generator that applies them; this file holds the laws those constraints name.
export const cyEps = (m) => 0.01 * Math.PI * m;
export const cyBacklash = (m) => 0.02 * Math.PI * m + 2 * cyEps(m);
export const cyClear = (m) => 0.05 + cyEps(m);
export const cyHFloor = (m) => 0.05 + cyEps(m);
export const cyCRTarget = (m) => 1 + 0.02 + (2 * cyEps(m)) / (Math.PI * m);
// Epicycloid of a circle rho rolling outside a pitch circle R, cusp at
// azimuth 0 on the pitch circle; psi is the rolling centre's angle.
export const cyEpi = (R, rho, psi) => {
  const k = (R + rho) / rho;
  const x = (R + rho) * Math.cos(psi) - rho * Math.cos(k * psi);
  const y = (R + rho) * Math.sin(psi) - rho * Math.sin(k * psi);
  return [x, y, Math.hypot(x, y) - R, Math.atan2(y, x)];
};
export const cyPsiAtH = (R, rho, h) => {
  if (h <= 0) return 0;
  let lo = 0, hi = (Math.PI * rho) / (R + rho);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cyEpi(R, rho, mid)[2] < h) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
};
export const cyRetreat = (R, rho, h) => cyEpi(R, rho, cyPsiAtH(R, rho, h))[3];
export const cyArc = (R, rho, h) => {
  if (h <= 0) return 0;
  const c = ((R + rho) ** 2 + rho ** 2 - (R + h) ** 2) / (2 * rho * (R + rho));
  if (c <= -1) return rho * Math.PI;
  if (c >= 1) return 0;
  return rho * Math.acos(c);
};
// The pair solve: both members' faces on the PAIR's exact conjugate circles,
// larger member first. Returns the two addenda.
//
// IT IS MEMOISED, and the cache is the single biggest thing in this file's
// boot cost. Measured on one cold boot (tools/probe-239-boot-profile.mjs):
// this solve is 42.3% of the whole build, `cyEpi` alone 39.1% of it, and the
// reason is the nesting below — a 60-step bisection whose every step runs
// `cyRetreat`, which runs another 60-step bisection, which evaluates `cyEpi`.
// That is ~7,300 cyEpi per call, and the build makes 27,298 calls over
// **1,381 distinct (m, Na, Nb)**: 19.8 times out of 20, this function is
// re-deriving an answer it already had, because the layout solvers explore
// the same pairs over and over while searching.
//
// The cache changes NO NUMBER — same key, same solve, returned rather than
// recomputed — which is exactly why the acceptance for it is the geometry
// FINGERPRINT being unmoved rather than a tolerance.
//
// Two properties of the key, both load-bearing:
//   · It is ORDERED, because the ANSWER is: `hA` belongs to Na and `hB` to Nb,
//     so (m, Nb, Na) is a different question with its two answers swapped.
//     Folding the two into one key would be a 2× better hit rate bought with
//     an inversion nobody would see until a mesh came out with its addenda
//     exchanged.
//   · The stored result is FROZEN. The callers here only read `.hA` and
//     `.feasible`, so sharing one object is safe today; frozen, it cannot stop
//     being safe. An unfrozen shared result would let one future caller's
//     mutation poison every later hit, and the symptom would be a wheel cut
//     wrong in a build that had already been cut right once.
// The cache and its wrapper sit AFTER the solve they wrap, so nothing above
// them can call the wrapper before the function it calls exists — the first
// draft had them the other way round, which was correct only for as long as
// no module-level line between the two reached it.
const cyPairSolveUncached = (m, Na, Nb) => {
  const mk = (N, mate) => {
    const Rp = (m * N) / 2, rho = (m * mate) / 4;
    const halfThick = ((Math.PI * m) / 2 - cyBacklash(m) / 2) / 2 / Rp;
    // pointed-tip cap, less the land a 2ε round needs
    let lo = 0, hi = 2 * rho;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const land = halfThick - cyRetreat(Rp, rho, mid) - (2 * cyEps(m)) / (Rp + mid);
      if (land > 0) lo = mid; else hi = mid;
    }
    return { N, Rp, rho, hCap: (lo + hi) / 2, h: Math.min(cyHFloor(m), (lo + hi) / 2) };
  };
  const A = mk(Na, Nb), B = mk(Nb, Na);
  const [W, P] = A.N >= B.N ? [A, B] : [B, A];
  const target = cyCRTarget(m) * Math.PI * m;
  const arc = () => cyArc(W.Rp, W.rho, W.h) + cyArc(P.Rp, P.rho, P.h);
  for (const G of [W, P]) {
    if (arc() >= target) break;
    let lo = G.h, hi = G.hCap;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2; G.h = mid;
      if (arc() < target) lo = mid; else hi = mid;
    }
    G.h = Math.min(hi, G.hCap);
  }
  return Object.freeze({ hA: A.h, hB: B.h, cr: arc() / (Math.PI * m), feasible: arc() >= target - 1e-9 });
};

const cyPairCache = new Map();
export const cyPairSolve = (m, Na, Nb) => {
  const key = `${m}|${Na}|${Nb}`;
  const hit = cyPairCache.get(key);
  if (hit !== undefined) return hit;
  const out = cyPairSolveUncached(m, Na, Nb);
  cyPairCache.set(key, out);
  return out;
};

// TODO 255 — a pair's CONTACT PATH, split the way a friction loss needs it.
// The driver (the larger wheel, in the going train) cuts its face on the
// driven member's generating circle: that is the RECESS arc, after the pitch
// point. The driven member's face rides the driver's circle: the APPROACH arc.
// Both are the arcs `cyPairSolve` sized the addenda to (its own `cyArc`), as
// fractions of the circular pitch p = π·m, so eps_a + eps_r is the contact ratio
// the generator targets and the split is what it spent to reach it.
// `factor` is Merritt's correction to the small-ratio sliding loss,
// 1 − ε + ε_a² + ε_r² (ε = ε_a + ε_r): πμ(1/z₁ + 1/z₂) is that loss with the
// bracket taken as 1, and probe-251-pinion-mesh.mjs derives the bracket
// independently from the contact path (a point-by-point Coulomb loss averaged
// over a pitch) and agrees within 5% on every going-train mesh.
export function gearMeshAction({ module: m, driver, driven }) {
  const pair = cyPairSolve(m, driver, driven);
  const rD = (m * driver) / 2, rV = (m * driven) / 2, p = Math.PI * m;
  const epsR = cyArc(rD, rV / 2, pair.hA) / p;       // driver's face on the driven member's circle
  const epsA = cyArc(rV, rD / 2, pair.hB) / p;       // driven member's face on the driver's circle
  const eps = epsA + epsR;
  return Object.freeze({ epsA, epsR, cr: eps, factor: 1 - eps + epsA * epsA + epsR * epsR, feasible: pair.feasible });
}
