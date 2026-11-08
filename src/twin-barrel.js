// BACKLOG §339 landing 1 — A TWIN-BARREL GOING TRAIN'S LINE SPEC, in free space (pure: no movement, no three.js).
//
// The single going drum feeds the fusee's chain with a LINEAR torque law over two wind angles at the chain hook: the
// set-up θ_s and the service sweep θ_w (main.js SETUP_SWEEP and DRUM_ROT_FULL). The fusee's cone is cut against that law
// NORMALISED to those angles (springTorqueAt), so any set of springs that shows the hook a linear law over the same two
// angles leaves the cone, the chain and the arrest exactly as they are. Only the stiffness, and with it the energy,
// moves. That is the interface this module designs against.
//
// THE PARALLEL TWIN. Drum A carries the chain, as today, and a toothed band cut on its wall below the chain's coil
// (§339 landing 0 measured that band's legal window, z 2.93–4.26, clear of the coil and the span at every reserve).
// Drum B's toothed rim meshes that band, so B turns n = r_A/r_B times A's angle, both pitch circles taken at their
// drums' walls (a going barrel's teeth are cut on its wall). Both arbors stand still (BUILT §100's fixed arbor kept),
// each with its own set-up, and each ribbon is solved by the build's own law (ribbon-solve.js' solveRibbon: the stress,
// the half fill, the wind, and TODO 291's packing), B's at n times A's angles. Equal stress at full wind is therefore
// automatic, never a tuned ratio. The hook then sees
//     T(θ) = k_A·θ + n·k_B·(n·θ) = (k_A + n²·k_B)·θ,
// linear, over the same θ_s…θ_s + θ_w.
//
// THE SERIES CONTROL. Two drums in series (B's drum drives A's arbor) carry one torque and add their angles, so each
// identical ribbon is solved at HALF the hook's angles. That is what a modern twin barrel usually does, and §339 weighed
// it: the packing argument is the reason it is not the one designed here, and seriesTwin() states it as numbers.
//
// Energies are the ribbons' own ½k(θ_full² − θ_setup²) over the service band, each at its own angles. Nothing here is
// friction-priced: the coupling mesh is a stage loss the build's energy column takes from FRICTION when it is folded.
import { barrelDims, barrelArborR, solveRibbon } from './ribbon-solve.js';
import { solveSpringWind, springWindBeta, SPRING_WIND_NPT } from './fusee-wind.js';
import { CLEAR_MARGIN, UNIT_MM, MAINSPRING_E_PA, MAINSPRING_SIGMA_Y_PA, MAINSPRING_ALPHA_MIN } from './layout.js';

const U = UNIT_MM / 1000;   // metres per unit
// The collar's floor, the law main.js's MS_COLLAR_MIN states: the arbor's working section plus the 0.6 boss wall.
export const COLLAR_BOSS_U = 0.6;
export const collarFloor = (R) => barrelArborR(R) + COLLAR_BOSS_U;

// THE CHAIN INTERFACE (landing 2a's correction). Landing 1 held drum A's wind angles at the single drum's, and that is
// only true at the single drum's radius: the chain coils on drum A, so A's angle per unit of chain is 1/R_wrap. What the
// fusee actually sees is the chain's tension along its length, F = M/R_wrap, against the cone's radius. The cut is
// r(t) = P/u(t) with u² = θ_s² + 4πW·P·t/R_wrap (the closed form; main.js' span-aware solve corrects it by under 1%), so
// the cone is the SAME cone when θ_s and P both scale by ρ = R_wrap₀/R_wrap and the level radius r₀ = P/θ_s is held. The
// set-up is a whole number of clicks on the set-up ratchet (SETUP_RATCHET_TEETH, equalisation's integer-click row), so ρ
// is that count over today's, and drum A's radius is DERIVED from the click count:
//     R_A = R_wrap₀·(clicks₀/clicks) − CHAIN_END_R_OUT.
// The span's give is the one term that is not invariant (it reads R_wrap and the centre distance D), so the angles come
// from the build's own solve at A's geometry, never from the scaling. The hook then needs k₀/ρ² for today's torque.
// `fw` is the booted build's __clock.fuseeWind record.
export function chainDrumR(clicks, fw) {
  return fw.inputs.DRUM_WRAP_R * (fw.setupClicks / clicks) - fw.chainEndROut;
}
// main.js' FUSEE_DRUM_DIST = FUSEE_R_LARGE + R + 2.5: the XY gap its drum block justifies (clearance taken in z)
export const DRUM_GAP_U = 2.5;
export const levelP = (clicks, fw) => fw.inputs.FUSEE_LEVEL_P * (clicks / fw.setupClicks);
export function chainDrumAngles({ R, clicks, fw }) {
  return chainDrumAnglesAt({ R, setup: (clicks * 2 * Math.PI) / fw.setupTeeth, P: levelP(clicks, fw), fw, clicks });
}
// The same at any set-up angle θ_s (the pulley's: its set-up is the barrel's, carried back through the mesh), with
// P = P₀·θ_s/θ_s₀ so r₀ = P/θ_s is held, unless P is given.
export function chainDrumAnglesAt({ R, setup, P = null, fw, clicks = null }) {
  const I = fw.inputs;
  const SETUP_SWEEP = setup;
  const DRUM_WRAP_R = R + fw.chainEndROut;
  // main.js' own expressions, in its order, so the default (clicks₀) reproduces the booted record to the bit
  const FUSEE_LEVEL_P = P ?? I.FUSEE_LEVEL_P * (setup / I.SETUP_SWEEP);   // r₀ = P/θ_s held: the cone's large end does not move
  const FUSEE_R_LARGE = FUSEE_LEVEL_P / SETUP_SWEEP;
  const FUSEE_DRUM_DIST = FUSEE_R_LARGE + R + DRUM_GAP_U;
  const SPRING_WIND_BETA = springWindBeta({ FUSEE_WRAP_TURNS: I.FUSEE_WRAP_TURNS, FUSEE_R_LARGE, SETUP_SWEEP, DRUM_WRAP_R });
  const sol = solveSpringWind({ ...I, FUSEE_LEVEL_P, DRUM_WRAP_R, FUSEE_DRUM_DIST, SETUP_SWEEP, SPRING_WIND_BETA });
  const full = sol.u[I.SPRING_WIND_NPT ?? SPRING_WIND_NPT];
  return { R, clicks, setup: SETUP_SWEEP, full, sweep: full - SETUP_SWEEP, Rw: DRUM_WRAP_R, D: FUSEE_DRUM_DIST,
    P: FUSEE_LEVEL_P, rho: fw.inputs.DRUM_WRAP_R / DRUM_WRAP_R, sol };
}

// One drum's ribbon, solved at its own angles. `c` is the ribbon's axial half-height (the record's section.c), which
// the drum's height sets and the twin keeps for both drums (they share the train's band).
export function drumRibbon({ R, c, setup, sweep, sigmaOverE = MAINSPRING_SIGMA_Y_PA / MAINSPRING_E_PA, alphaMin = MAINSPRING_ALPHA_MIN }) {
  const { springOuter } = barrelDims({ radius: R, plain: true });
  const sol = solveRibbon({ springOuter, springArborR: collarFloor(R), springWindSweep: sweep, springSetupSweep: setup,
    ribbonSolve: { sigmaOverE, alphaMin } });
  if (!sol) return null;
  const a = sol.ribbonR, L = sol.devLen;
  const I_u4 = ((2 * a) ** 3 * (2 * c)) / 12;   // the strip's section, the build's (section.I_u4)
  const k = (MAINSPRING_E_PA * I_u4 * U ** 4) / (L * U);   // N·m/rad, main.js ribbonK's law
  const thFull = setup + sweep;
  const energyJ = 0.5 * k * (thFull ** 2 - setup ** 2);
  const sigmaFull = (MAINSPRING_E_PA * a * thFull) / L;   // σ = E·a·θ/L at full wind
  return { R, springOuter, sol, a, L, I_u4, k, energyJ, sigmaFull, alpha: sol.collarR / (2 * a) };
}

// THE PARALLEL TWIN at drum radii RA (the chain's) and RB, B meshing A's wall band at n = RA/RB.
export function parallelTwin({ RA, RB, c, setup, sweep, ...opts }) {
  const n = RA / RB;
  const A = drumRibbon({ R: RA, c, setup, sweep, ...opts });
  const B = drumRibbon({ R: RB, c, setup: n * setup, sweep: n * sweep, ...opts });
  if (!A || !B) return { RA, RB, n, A, B, feasible: false };
  const kHook = A.k + n * n * B.k;
  // the hook's law, sampled: torque over angle must be the one constant across the service band
  const lawDev = [0, 0.25, 0.5, 0.75, 1].reduce((m, f) => {
    const th = setup + f * sweep, T = A.k * th + n * (B.k * n * th);
    return Math.max(m, Math.abs(T / th - kHook) / kHook);
  }, 0);
  return { RA, RB, n, A, B, feasible: true, kHook, energyJ: A.energyJ + B.energyJ, lawDev,
    centreDistance: RA + RB };
}

// THE SERIES CONTROL: two identical drums of radius R, one torque, the angles shared, so each ribbon is solved at half.
export function seriesTwin({ R, c, setup, sweep, ...opts }) {
  const each = drumRibbon({ R, c, setup: setup / 2, sweep: sweep / 2, ...opts });
  if (!each) return { R, feasible: false };
  // in series the stiffnesses add as compliances: k = k₁k₂/(k₁+k₂) = k/2 for two equal ribbons
  return { R, feasible: true, each, kHook: each.k / 2, energyJ: 2 * each.energyJ };
}

// THE CHAIN PULLEY AND ONE BARREL (landing 2a', the owner's choice 2026-11-08 over the twin as landing 1 specified it).
// Drum A carries the chain and NO spring: it is a pulley. Drum B, the one barrel, stands in the free disc, and its teeth
// (cut on its wall, a going barrel's) mesh a toothed FLANGE on A, zA teeth on A, zB on B, one module m, so B turns
// n = zA/zB times A. The flange is under the chain (the coupling band, landing 0 (c)) and its pitch circle stands
//     r_pA = R_A + FLANGE_DELTA,   FLANGE_DELTA = 2·c_end + CLEAR_MARGIN,
// because B's wall stands on that circle all the way up its height, and above the flange it must clear the chain coiled
// on A (outer metal R_A + 2·c_end) by the margin. B's wall, its pitch circle, is R_B = m·zB/2 with m = 2·r_pA/zA.
// The set-up is B's alone, a whole NB clicks on a set-up ratchet of `teeth` (the build's cut, 24), so the hook sees
// θ_s = θ_sB/n and the torque n·k_B·(n·u) = n²·k_B·u: proportional, with nothing to match between two set-ups.
// The cone is the same cone when θ_s·R_wrap,A = θ_s₀·R_wrap₀ =: Q (chainDrumR's invariant), which fixes the pulley:
//     R_A = Q/(θ_sB/n) − c_end,   R_B = r_pA/n,
// so (zA, zB, NB) are the design's integers, and every length follows from them (rule 1). The multiple of a ratio sets
// only the module.
export function flangeDelta(fw) { return 2 * fw.chainEndROut + CLEAR_MARGIN; }
// `cB` is B's ribbon half-height, `c` by default: the drive's SIZE goes as the strip's height (k ∝ c at a fixed stress,
// which the section's height does not enter), so the caller can size B to the train's demand without moving a radius.
export function pulleyBarrel({ zA, zB, NB, fw, c, cB = c, teeth = fw.setupTeeth, ...opts }) {
  const I = fw.inputs, ce = fw.chainEndROut;
  const n = zA / zB;
  const setupB = (NB * 2 * Math.PI) / teeth;
  const Q = I.SETUP_SWEEP * I.DRUM_WRAP_R;
  const RA = Q / (setupB / n) - ce;
  if (!(RA > 0)) return { zA, zB, NB, n, feasible: false, why: 'no positive pulley' };
  const rpA = RA + flangeDelta(fw), m = (2 * rpA) / zA, RB = (m * zB) / 2;
  const chain = chainDrumAnglesAt({ R: RA, setup: setupB / n, fw });
  const B = drumRibbon({ R: RB, c: cB, setup: setupB, sweep: n * chain.sweep, ...opts });
  const out = { cB, zA, zB, NB, n, m, RA, rpA, RB, setupB, chain, B, centreDistance: rpA + RB, invariant: (chain.setup * chain.Rw) / Q - 1 };
  if (!B) return { ...out, feasible: false, why: 'no ribbon for B' };
  const kHook = n * n * B.k;
  const lawDev = [0, 0.25, 0.5, 0.75, 1].reduce((mx, f) => {
    const u = chain.setup + f * chain.sweep, T = n * B.k * (n * u);
    return Math.max(mx, Math.abs(T / u - kHook) / kHook);
  }, 0);
  return { ...out, feasible: true, kHook, lawDev, energyJ: B.energyJ };
}
