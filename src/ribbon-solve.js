// THE MAINSPRING RIBBON'S LAWS, pure (no three.js): the free coil's length, the wind family's length, the drum's
// working dimensions and the ribbon solve. Moved verbatim out of geometry.js's makeBarrel (BACKLOG §339 landing 1), which
// imports them, so a line spec can call the build's own solve in Node and no law is written twice.

// TODO 192 step 3 — the FREE coil's developed length: the even-pitch spiral
// from innerR to outerR over A radians, ∫₀^A √(r² + r′²) da, by the same
// composite 2-point Gauss–Legendre (128 panels, open) mainspringFrames' arcLen
// uses for its k = 1 frame — so a ribbon proportioned with this number is
// priced by the record against the identical length.
export function freeCoilLength(innerR, outerR, A) {
  const QN = 128, GX = 1 / Math.sqrt(3), h = A / QN, dr = (outerR - innerR) / A;
  const f = (a) => Math.hypot(innerR + dr * a, dr);
  let s = 0;
  for (let i = 0; i < QN; i++) {
    const c = (i + 0.5) * h, e = (h / 2) * GX;
    s += f(c - e) + f(c + e);
  }
  return s * (h / 2);
}
// THE WIND FAMILY'S LENGTH, one law (mainspringFrames reads it, and since TODO 291 so does makeBarrel's ribbon solve):
// the frame wound to total angle A at distribution exponent k, r(a) = innerR + P·a + S·(a/A)^k with P the coil-bind
// pitch per radian and S the slack, developed by composite 2-point Gauss–Legendre (mainspringFrames' comment says why
// the rule must be OPEN). The arithmetic is the one mainspringFrames always ran, in the same order.
export function ribbonFrameLength(innerR, outerR, ribbonR, A, k) {
  const pBind = ribbonR * 2;
  const P = pBind / (Math.PI * 2);
  const S = (outerR - innerR) - P * A, QN = 128, GX = 1 / Math.sqrt(3), h = A / QN;
  const f = (a) => Math.hypot(innerR + P * a + S * Math.pow(a / A, k), P + (S * k * Math.pow(a / A, k - 1)) / A);
  let s = 0;
  for (let i = 0; i < QN; i++) {
    const c = (i + 0.5) * h, e = (h / 2) * GX;
    s += f(c - e) + f(c + e);
  }
  return s * (h / 2);
}
// The largest distribution exponent mainspringFrames' k-solve brackets. A wound frame whose length at this k still
// exceeds the ribbon's has no solution in the family: the ribbon is too short to take that wind on its collar.
export const RIBBON_K_MAX = 60;

// The drum arbor's working-section radius, the law makeBarrel bores the drum for.
export const barrelArborR = (radius) => radius * 0.09;

// A DRUM'S WORKING DIMENSIONS, the law makeBarrel cuts its wall and seats its ribbon by: the pitch and root circles
// (a plain drum's are its radius), the wall's module, the cavity's radius, and the spring's outer radius half a wall
// module inside it.
export function barrelDims({ radius, teeth, module, plain = false }) {
  const pitchR = plain ? radius : (module * teeth) / 2;
  const rootR = plain ? radius : pitchR - module * 1.15;
  const wallModule = module || radius * 0.06;
  const drumInnerR = Math.max(rootR - wallModule * 2.2, radius * 0.3);
  const springOuter = drumInnerR - wallModule * 0.5;
  return { pitchR, rootR, wallModule, drumInnerR, springOuter };
}

// THE RIBBON SOLVE (TODO 192 step 3, TODO 291): makeBarrel's comment at its call says what each row is. Returns null
// when the caller asked for no solve.
export function solveRibbon({ springOuter, springArborR, springWindSweep, springSetupSweep = 0, ribbonSolve }) {
    if (!(ribbonSolve && springArborR !== null && springWindSweep > 0)) return null;
    const thetaF = springSetupSweep + springWindSweep;
    const kappa = ribbonSolve.sigmaOverE / thetaF;
    const at = (r, n) => {
      let a = 0.1;
      for (let it = 0; it < 200; it++) {
        const L = freeCoilLength(r + a, springOuter, n * Math.PI * 2);
        const next = kappa * L;
        if (Math.abs(next - a) < 1e-12) { a = next; break; }
        a = next;
      }
      const L = freeCoilLength(r + a, springOuter, n * Math.PI * 2);
      const Afull = n * Math.PI * 2 + thetaF;
      return { ribbonR: a, devLen: L, fill: (2 * a * L) / (Math.PI * (Math.pow(springOuter, 2) - Math.pow(r, 2))),
        windLen: ribbonFrameLength(r + a, springOuter, a, Afull, RIBBON_K_MAX) };
    };
    const alphaMin = ribbonSolve.alphaMin ?? null;
    let best = null;
    for (let n = 1; n <= 40; n++) {
      if (alphaMin === null) {
        const c = at(springArborR, n);
        if (c.fill > 0.5) break;
        const { windLen, ...rest } = c;
        best = { coils: n, ...rest, collarR: springArborR, kappa, thetaF };
        continue;
      }
      const ok = (c) => c.fill <= 0.5 && c.windLen <= c.devLen;
      if (!ok(at(springArborR, n))) continue;
      let lo = springArborR, hi = springOuter * 0.95;
      if (!ok(at(hi, n))) for (let it = 0; it < 80 && hi - lo > 1e-10; it++) { const m = (lo + hi) / 2; if (ok(at(m, n))) lo = m; else hi = m; }
      else lo = hi;
      const c = at(lo, n), alpha = lo / (2 * c.ribbonR);
      if (alpha < alphaMin) continue;
      const binds = c.fill > 0.5 - 1e-6 ? 'fill' : 'wind';
      if (!best || c.ribbonR * c.devLen > best.ribbonR * best.devLen)
        best = { coils: n, ribbonR: c.ribbonR, devLen: c.devLen, fill: c.fill, windLen: c.windLen, collarR: lo, alpha, alphaMin, binds, kappa, thetaF };
    }
    if (!best) console.warn(alphaMin === null
      ? 'TODO 192: no whole number of coils keeps the solved ribbon inside half the barrel'
      : `TODO 291: no whole number of coils gives a ribbon at r/e ≥ ${alphaMin} that fits half the barrel and takes its full wind`);
    return best;
}
