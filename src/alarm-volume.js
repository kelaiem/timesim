// BUILT §320 — THE VOLUME-ADJUSTABLE ALARM, designed IN A LINE (CLAUDE.md's "design in a line, fold to fit"):
// a straight chain in free space, no corridors, no size budget, every dimension derived from the constraint
// written beside it. This module is the group's LINE SPEC; the movement does not build it yet (the fold is a
// later landing, filed in the roadmap). Pure: no DOM, no three.js. Read by tools/probe-alarm-volume.mjs and by
// volume-bench.html. Everything here is MODELLED: the levels are the wire's own radiation through the build's
// law (src/gong-level.js), relative to a tip strike, never an absolute loudness and never the case's.
//
// THE CHAIN, input to output:
//   knob → selector arbor (a jumper-indexed STAR and a snail CAM on one arbor) → follower pin on the hammer
//   CARRIAGE, which slides on a guide parallel to a straight gong bar → the hammer, carried whole (its arm,
//   head, gap and spring unchanged), strikes the bar normal to it at the station the cam holds.
//   A LIFT RAIL parallel to the slide takes the lifting lever's stroke to the hammer's tail at every station.
//
// WHAT THE STATION CHANGES, and why the range ends where it does. Moving the contact inboard changes two
// things the build's law already prices (§197/§253): the mass the head meets, m₁/φ₁(x)², so the hand-off
// η = 4μ/(1+μ)²·((1+e)/2)² falls off its match; and each mode's share, ∝ φₙ(x)²/mₙ. On a straight bar at
// 2 kHz the A-weighted level is CARRIED BY THE SECOND MODE (12.5 kHz, 22 dB over f₁ at the tip — §262 found the
// same on the arc), so the level falls fast as the contact nears that mode's NODE and rises again past it
// (mode 2's antinode, 0.58 of the length, is within 1.5 dB of the tip). The control is therefore the run from
// the tip to the node, where it is monotonic: loud is the bright bell, quiet is the pure fundamental — the
// pitch stays 2 kHz and f₁ itself gets slightly LOUDER. It is a brightness-for-level control, and says so.
import * as GS from './gong-solve.js';
import * as GL from './gong-level.js';
import { UNIT_MM, STOCK, STEEL_E_PA, CLEAR_MARGIN, SELECTOR_DETENT_WINDOW_MN, ALARM_SPRING_HEADROOM, FRICTION } from './layout.js';

const U = UNIT_MM / 1000;   // m per model unit

// ---- INPUTS: each a choice with its reason. A fork overrides these and only these. ----
export const VOLUME_INPUTS = Object.freeze({
  wireR_u: { v: 1.4514, why: 'the movement\'s gong wire (gong-seats.js rows\' wireR; §197 sized it to the band)' },
  f1_Hz: { v: 2000, why: 'the fitted seats\' fundamental (gong-seats.js f[0], inside §197\'s 1–4 kHz band)' },
  faceW_u: { v: 2.63, why: '§197\'s head section: the line contact\'s length, and the face that must stand wholly on the wire' },
  stepMin_dB: { v: 3, why: 'the smallest step a listener reliably hears as a different setting (the conventional "clearly noticeable" 3 dB)' },
  pressureMax_deg: { v: 30, why: 'the conventional pressure-angle ceiling for a translating follower on a disc cam' },
  landHalf_deg: { v: 4, why: 'POSED: twice a jumper\'s seating play of ±2°, so the follower rests on the land wherever the star seats' },
  flank_deg: { v: 45, why: 'the classic jumper: a 90° V on the star, its flanks at 45°' },
  posTol_mm: { v: 0.01, why: 'POSED: the carriage\'s positional repeatability at a land (cam, follower and guide together)' },
  carriage_mg: { v: 150, why: 'POSED: the carriage with the hammer it carries — a budget the fold must meet, not a measured mass' },
});
const IN = (k, over) => (over && k in over ? over[k] : VOLUME_INPUTS[k].v);

// ---- the wire, the head and the level law (the build's, through src/gong-level.js) ----
// a straight bar clamped at the foot ringing f1 (the cantilever's first root, 1.8751), its audible modes,
// and a head MATCHED at the tip (§198's law: a straight bar's modal mass is M/4 for every mode)
export const volumeWire = (over) => {
  const a = IN('wireR_u', over) * U, D = 2 * a, f1 = IN('f1_Hz', over);
  const L = Math.sqrt(1.8751 ** 2 * (D / 4) * GS.STEEL_C / (2 * Math.PI * f1));
  const S = GS.sOf(L, D), segs = [{ k: 0, ds: 1 }];
  const g = GS.modes(segs, S, { nMax: 4, step: 0.004 }).filter((x) => GS.hz(x, L, D) <= 20000);   // the listener's limit
  const shapes = g.map((gg) => GS.shape(segs, S, gg, { nSamp: 800 }));
  const M = STOCK.steel.rho * Math.PI * a * a * L, mHead = M * shapes[0].mass;
  // the far field per mode, on the bar's own stations about its centroid (the build's NG = 160)
  const NG = 160, frame = { L_m: L, x: new Float64Array(NG + 1), y: new Float64Array(NG + 1), nx: new Float64Array(NG + 1), ny: new Float64Array(NG + 1).fill(1) };
  for (let i = 0; i <= NG; i++) frame.x[i] = L * i / NG - L / 2;
  const modes = g.map((gg, n) => { const f = GS.hz(gg, L, D), k = 2 * Math.PI * f / GL.AIR_C;
    const sh = Float64Array.from({ length: NG + 1 }, (_, i) => GS.shapeAt(shapes[n], i / NG));
    return { n: n + 1, f, k, mFrac: shapes[n].mass, shape: shapes[n], ...GL.radiationFactorsPath(sh, frame, k) }; });
  const node = GS.overtoneNode(segs, S);
  return { a, D, L, S, M, mHead, modes, node, Estar: STEEL_E_PA / (2 * (1 - GL.CONTACT_NU ** 2)) };
};
// the level at contact x (fraction of the length FROM THE FOOT, 1 = the tip): per mode and total, dBA, for a
// unit blow (E_blow = 1 J — every figure is used RELATIVE to the tip, so the blow cancels)
export const levelAt = (W, x, over) => {
  const phi = W.modes.map((m) => GS.shapeAt(m.shape, x));
  const m1 = W.M * W.modes[0].mFrac, mModal = m1 / phi[0] ** 2, mu = W.mHead / mModal, eta = GL.eta(mu);
  const mRed = W.mHead * mModal / (W.mHead + mModal), tau = GL.linearContactTau(mRed, GL.lineStiffness(W.Estar, IN('faceW_u', over), U));
  const w = W.modes.map((m, n) => GL.contactSpectrum(m.f, tau) ** 2 * phi[n] ** 2 / m.mFrac), ws = w.reduce((t, v) => t + v, 0);
  let tot = 0;
  const perMode = W.modes.map((m, n) => { const En = eta * w[n] / ws, mn = W.M * m.mFrac, Un = Math.sqrt(2 * En / mn), om = 2 * Math.PI * m.f;
    const amp = 2 * GL.AIR_RHO * Math.PI * W.a * W.a * om * Un;
    const I = m.k * m.k * amp * amp * m.peak / (32 * Math.PI * Math.PI * GL.AIR_RHO * GL.AIR_C * 0.09);
    const dBA = 10 * Math.log10(Math.max(I, 1e-300) / 1e-12) + GL.aWeight(m.f); tot += 10 ** (dBA / 10); return dBA; });
  return { x, phi, mu, eta, tau, perMode, total: 10 * Math.log10(tot) };
};

// ---- the solve ----
export const solveVolume = (over) => {
  const W = volumeWire(over), tip = levelAt(W, 1, over), rel = (x) => levelAt(W, x, over).total - tip.total;
  const Lmm = W.L * 1000, faceW_mm = IN('faceW_u', over) * UNIT_MM;
  // the loudest station: the head's whole face on the wire, half its width in from the free end
  const xLoud = 1 - (faceW_mm / 2) / Lmm;
  // the quietest: the level's minimum on the run toward the node, found by golden section (mode 2 vanishes there)
  let lo = W.node - 0.05, hi = Math.min(xLoud, W.node + 0.05);
  for (let it = 0; it < 80; it++) { const m1 = hi - (hi - lo) / 1.618, m2 = lo + (hi - lo) / 1.618; if (rel(m1) < rel(m2)) hi = m2; else lo = m1; }
  const xQuiet = (lo + hi) / 2, top = rel(xLoud), bottom = rel(xQuiet), range = top - bottom;
  // as many settings as the range holds at no less than stepMin apart, equally spaced in level, ending exactly
  // at the loudest and the quietest stations
  const N = 1 + Math.floor(range / IN('stepMin_dB', over) + 1e-9), step = range / (N - 1);
  // each station by bisection on the monotonic run [xQuiet, xLoud] (level rises with x there)
  const stationAt = (dB) => { let a = xQuiet, b = xLoud; for (let it = 0; it < 80; it++) { const m = (a + b) / 2; if (rel(m) < dB) a = m; else b = m; } return (a + b) / 2; };
  const stations = Array.from({ length: N }, (_, k) => {
    const want = top - k * step, x = k === 0 ? xLoud : k === N - 1 ? xQuiet : stationAt(want), r = levelAt(W, x, over);
    // the level's slope there, and what the carriage's positional tolerance costs in level
    const dx = 1e-4, slope = (rel(Math.min(xLoud, x + dx)) - rel(Math.max(xQuiet, x - dx))) / ((Math.min(xLoud, x + dx) - Math.max(xQuiet, x - dx)) * Lmm);   // dB per mm
    return { k, x, inset_mm: (1 - x) * Lmm, dB: r.total - tip.total, want, f1_dB: r.perMode[0] - tip.perMode[0], f2_dB: r.perMode[1] - tip.perMode[1], mu: r.mu, eta: r.eta,
      slope_dB_mm: slope, tolErr_dB: Math.abs(slope) * IN('posTol_mm', over) };
  });
  // ---- the cam: a snail on the selector arbor, a concentric LAND at each station, a cycloidal rise between ----
  // N settings and one sector for the banking stop: the star's pitch is 360°/(N+1)
  const pitch = 2 * Math.PI / (N + 1), land = IN('landHalf_deg', over) * Math.PI / 180, rise = pitch - 2 * land;
  // the follower's line passes through the cam's centre (a radial translating follower), so r = rBase + travel,
  // travel measured inboard from the loudest station. A cycloidal rise h over beta, t = u/β, has
  //     r = r₀ + h·(t − sin 2πt / 2π),   dr/dθ = (h/β)·(1 − cos 2πt)
  // and the pressure angle atan((dr/dθ)/r) peaks a little BEFORE mid-rise, where r is still the smaller (taking
  // it at mid-rise read 30.09° for a 30° ceiling — the probe's sampled profile found it). So the base radius is
  // the least whose TRUE peak, over every step, holds the ceiling: bisection on rBase, the peak by golden section.
  const travel = stations.map((s) => s.inset_mm - stations[0].inset_mm), ceil = IN('pressureMax_deg', over) * Math.PI / 180;
  const steps = []; for (let k = 1; k < N; k++) { const h = travel[k] - travel[k - 1]; steps.push({ k, h, drdth: 2 * h / rise }); }
  const peakOf = (rB, st) => { const r0 = rB + travel[st.k - 1], q = (t) => (st.h / rise) * (1 - Math.cos(2 * Math.PI * t)) / (r0 + st.h * (t - Math.sin(2 * Math.PI * t) / (2 * Math.PI)));
    let a = 0, b = 0.5; for (let it = 0; it < 80; it++) { const m1 = b - (b - a) / 1.618, m2 = a + (b - a) / 1.618; if (q(m1) > q(m2)) b = m2; else a = m1; }
    return Math.atan(q((a + b) / 2)); };
  const pressAt = (rB) => Math.max(...steps.map((st) => peakOf(rB, st)));
  let rLo = 0, rHi = 1; while (pressAt(rHi) > ceil) rHi *= 2;
  for (let it = 0; it < 80; it++) { const m = (rLo + rHi) / 2; if (pressAt(m) > ceil) rLo = m; else rHi = m; }
  const rBase = rHi, radii = travel.map((t) => rBase + t), pressMax = pressAt(rBase) * 180 / Math.PI;
  // ---- statics (P1). The follower spring must return the carriage against the guide's friction (FRICTION.muPlain's
  // ADVERSE corner) with the chain's headroom; at a land the cam's normal passes through its
  // centre, so a resting setting is held by GEOMETRY (zero back-drive), and the jumper's restoring torque must
  // beat the spring's worst back-drive MID-STEP, F_s·max(dr/dθ), by the same headroom; its force lives in the
  // detent window, never outside it.
  const muSlide = FRICTION.muPlain.adverse;   // a steel carriage on an oiled plain guide: muPlain's adverse corner (MU_STEEL)
  const g = 9.80665, Fs = ALARM_SPRING_HEADROOM * muSlide * IN('carriage_mg', over) * 1e-6 * g;   // N
  const drdthMax_m = Math.max(...steps.map((s) => s.drdth)) / 1000, Tback = Fs * drdthMax_m;      // N·m
  const rStar_m = rBase / 1000, Tj_per_F = rStar_m * Math.tan(IN('flank_deg', over) * Math.PI / 180);
  const Fj = Math.max(SELECTOR_DETENT_WINDOW_MN[0] / 1000, ALARM_SPRING_HEADROOM * Tback / Tj_per_F);   // N: the least that holds
  const detent = { Fs_mN: Fs * 1000, Fj_mN: Fj * 1000, Tback_uNm: Tback * 1e6, Tj_uNm: Fj * Tj_per_F * 1e6, margin: (Fj * Tj_per_F) / (Tback || 1e-300),
    window_mN: SELECTOR_DETENT_WINDOW_MN, inWindow: Fj * 1000 >= SELECTOR_DETENT_WINDOW_MN[0] && Fj * 1000 <= SELECTOR_DETENT_WINDOW_MN[1],
    knobPeak_uNm: (Fj * Tj_per_F + Tback) * 1e6, muSlide };
  // ---- the lift rail: the lifting lever's stroke must meet the tail at EVERY station, so the rail spans the
  // carriage's whole travel plus the tail's pad (posed at the head's face width) and the clearance margin each end
  const rail_mm = travel[N - 1] + faceW_mm + 2 * CLEAR_MARGIN * UNIT_MM;
  // ---- the blow: the hammer is carried whole, so at every station it strikes normal to the bar (its tilt
  // §319 allows is unspent) and the blow has NO component along the slide — striking cannot move the setting
  const blowAlongSlide = 0;
  return { inputs: Object.fromEntries(Object.keys(VOLUME_INPUTS).map((k) => [k, IN(k, over)])),
    wire: { L_mm: Lmm, D_mm: W.D * 1000, f_Hz: W.modes.map((m) => m.f), node: W.node, head_mg: W.mHead * 1e6 },
    tip, xLoud, xQuiet, top, bottom, range, N, step, stations,
    cam: { pitch_deg: pitch * 180 / Math.PI, land_deg: 2 * land * 180 / Math.PI, rise_deg: rise * 180 / Math.PI, rBase_mm: rBase, radii_mm: radii, steps, pressMax_deg: pressMax, travel_mm: travel[N - 1] },
    detent, rail_mm, blowAlongSlide, rel };
};
