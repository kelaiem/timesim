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
import { UNIT_MM, MAINSPRING_E_PA, MAINSPRING_SIGMA_Y_PA, MAINSPRING_ALPHA_MIN } from './layout.js';

const U = UNIT_MM / 1000;   // metres per unit
// The collar's floor, the law main.js's MS_COLLAR_MIN states: the arbor's working section plus the 0.6 boss wall.
export const COLLAR_BOSS_U = 0.6;
export const collarFloor = (R) => barrelArborR(R) + COLLAR_BOSS_U;

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
