// §337 landing 1 — THE GEARED GENEVA STOP-WORK, DESIGNED IN A LINE (pure, movement-independent; src/stopwork-arrest.js's
// sibling, which it reads rather than restates).
//
// Why gear the finger. A Geneva of n slots, m of them open, stops its finger after exactly m + ½ + 1/n turns
// (stopwork-arrest.js travelTurns), and the fusee's cone winds T = reserveHours·pinion/teeth turns. On the cone itself
// the two agree only at 30 h and 45 h (§329). Put the pin on its OWN arbor, driven from the cone through a wheel pair
// z_cone : z_finger, and the finger turns g = z_cone/z_finger times per cone turn, so its travel is g·T. Choose the pair so
//   g·T = m + ½ + 1/n,  exactly:  g = 60·(2mn + n + 2) / (7·h·n)  (with the fusee's 120/7, layout.js GREAT_WHEEL_TEETH)
// and every reserve has a star with no trim. Exact as a reduced fraction, scaled by the smallest whole k that lets both
// wheels be cut (below): no float reaches a tooth count (the reserve train's rule, layout.js rsvReduction).
//
// The line, input to output: the cone's wheel (z_cone, fast on the cone's arbor) → the finger's pinion (z_finger) on the
// finger's own arbor → a CRANK on that arbor carrying the pin at r1 → the star of n slots at a = r1/sin(π/n) from the
// finger's axis, its closed slots the two stops. The pin cannot ride the pinion itself: a 6-leaf pinion at the module
// floor has a pitch radius near 0.6, inside which no pin and its wall fit; a crank and its pinion on one hub is the alarm
// Geneva's own arrangement (§129, TODO 212).
//
// What sizes each member (CLAUDE.md's P1, the stop-work's §329 rule):
//   · MODULE: a tooth is π·module/2 thick at its pitch line and nothing is cut under STOCK_MIN_U, so module ≥ 2·STOCK/π.
//   · COUNTS: the pinion has at least PINION_LEAVES_MIN leaves (the movement's smallest), and the cone's wheel is bored over
//     the cone's arbor: its root circle (pitch − 1.25 modules) stands a bore wall (STOCK_MIN_U) outside coneBoreR. Both are
//     met by scaling the reduced pair by the smallest k, which keeps g exact.
//   · THE LOAD: the stall at the cone is the fusee's level torque (the caller's stallNmm, the same at both stops); the
//     finger, turning g times as fast, holds it divided by g, so the pin carries F = stall / (g·r1).
//   · THE PIN AND THE STUD are cantilevers loaded at the star's mid-plane, sized σ = 32·F·L/(π·d³) ≤ SPRING_SIGMA_Y_PA or
//     their §50 floors (stopwork-arrest.js PIN_FLOOR_U / STUD_FLOOR_U). In free space the stack is one CLEAR_MARGIN between
//     layers, so the pin reaches from the crank's face across one margin to the star's mid-plane, and the stud from its seat
//     across one margin to the same plane: L = CLEAR_MARGIN + STOCK/2 for both. The fold re-sizes them at its real lengths.
//   · r1, THE CRANK'S ORBIT: the smallest at which the Geneva's floors hold (stopwork-arrest.js floorsHold: a lock window, a
//     hub round the star's bore) with the pin and stud sized at THAT orbit's load, and the star's tips clear of the finger's
//     own hub (its arbor at the §50 pivot floor and a wall) by a margin.
// Choice: of every (m, n) with at least one closed slot, the one whose plan reaches least far from the cone's axis (the
// gear pair's centre distance plus the star's far edge from the finger's axis); fewer teeth breaks a tie.
import { STOCK_MIN_U, PIVOT_MIN_U, CLEAR_MARGIN, PINION_LEAVES_MIN, SPRING_SIGMA_Y_PA, UNIT_MM, GREAT_WHEEL_TEETH, CENTRE_PINION_LEAVES } from './layout.js';
import { genevaDims, travelTurns, floorsHold, PIN_FLOOR_U, STUD_FLOOR_U } from './stopwork-arrest.js';

export const MODULE_MIN_U = (2 * STOCK_MIN_U) / Math.PI;     // a tooth's pitch-line thickness at the §50 floor
export const DEDENDUM_F = 1.25;                               // root depth in modules (the movement's tooth form)
export const LINE_LAYER_GAP_U = CLEAR_MARGIN;                 // free space: one margin between the line's layers
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// the cone's wind in turns, from the fusee's own gearing
export const windTurns = (reserveHours) => (reserveHours * CENTRE_PINION_LEAVES) / GREAT_WHEEL_TEETH;

// the exact pair for (m, n) at a reserve, scaled to be cuttable: { zCone, zFinger, g, k }
export function gearPair(reserveHours, m, n, { coneBoreR, module = MODULE_MIN_U } = {}) {
  let p = 60 * (2 * m * n + n + 2), q = 7 * reserveHours * n;
  const d = gcd(p, q); p /= d; q /= d;
  // g = 1 needs NO gear: the pin rides the cone itself, §329's direct stop-work (30 h and 45 h), so there is no pair to cut
  if (p === q) return { zCone: null, zFinger: null, g: 1, k: 0, num: 1, den: 1, direct: true };
  const rootClear = (z) => (module * z) / 2 - DEDENDUM_F * module >= coneBoreR + STOCK_MIN_U;
  for (let k = 1; k <= 64; k++) {
    const zCone = k * p, zFinger = k * q;
    if (zFinger < PINION_LEAVES_MIN || zCone < PINION_LEAVES_MIN) continue;
    if (!rootClear(zCone)) continue;
    return { zCone, zFinger, g: zCone / zFinger, k, num: p, den: q };
  }
  return null;
}

// a cantilever's radius at yield for force F (N) at free length L (units)
const cantR = (F, L) => Math.cbrt((32 * F * L * UNIT_MM) / (Math.PI * (SPRING_SIGMA_Y_PA / 1e6))) / 2 / UNIT_MM;

// The lock disc holds the star through the dwell only while its relief (cut against the star's sweep) leaves metal under both
// ends of the lock arc, within GAMMA of the azimuth the star faces. Measured by sweeping r1 through the disc's own relief code
// (tools/probe-337-geared-build.mjs reads the result as `unlocked`): n = 3 never holds, n = 4 holds from r1 2.65, n = 5 from 2.50
// (m and the pin's size move it by less than the 0.05 step). Floors carry one step of margin above the first r1 that held.
export const LOCK_R1_MIN = { 4: 2.7, 5: 2.55 };
const lockR1Min = (n) => (n < 4 ? Infinity : (LOCK_R1_MIN[n] ?? LOCK_R1_MIN[5]));

// the Geneva at its smallest orbit for a finger holding `fingerNmm`: sizes, dims and the floors it met
export function sizeGeneva(n, fingerNmm, { r1Max = 12, step = 0.005 } = {}) {
  const L = LINE_LAYER_GAP_U + STOCK_MIN_U / 2;
  const hubR = PIVOT_MIN_U + STOCK_MIN_U;                    // the finger's arbor at the pivot floor and a wall
  for (let r1 = Math.max(step, lockR1Min(n)); r1 <= r1Max; r1 += step) {
    const F = fingerNmm / (r1 * UNIT_MM);
    const rPin = Math.max(PIN_FLOOR_U, cantR(F, L)), studR = Math.max(STUD_FLOOR_U, cantR(F, L));
    const d = genevaDims(n, r1, { rPin, studR });
    if (!floorsHold(d)) continue;
    if (!(d.a - d.rTip >= hubR + CLEAR_MARGIN)) continue;    // the star's tips pass the finger's hub
    return { ...d, F, L, hubR, governs: { pin: rPin > PIN_FLOOR_U ? 'load' : 'floor', stud: studR > STUD_FLOOR_U ? 'load' : 'floor' } };
  }
  return null;
}

// the line for one reserve: every (m, n), its pair and its sized Geneva, and the one that reaches least far
export function chooseGearedStopwork(reserveHours, { stallNmm, coneBoreR, nMax = 12 } = {}) {
  const T = windTurns(reserveHours), rows = [];
  for (let n = 3; n <= nMax; n++) for (let m = 1; m <= n - 1; m++) {
    const pair = gearPair(reserveHours, m, n, { coneBoreR });
    if (!pair) continue;
    const gen = sizeGeneva(n, stallNmm / pair.g);
    if (!gen) continue;
    const centre = pair.direct ? 0 : (MODULE_MIN_U * (pair.zCone + pair.zFinger)) / 2;   // a direct Geneva's finger IS the cone
    const reach = centre + gen.a + gen.rTip;                 // the cone's axis to the star's far edge, along the line
    rows.push({ reserveHours, T, m, n, c: n - m, travel: travelTurns(m, n), ...pair, module: pair.direct ? null : MODULE_MIN_U, centre, reach, geneva: gen });
  }
  rows.sort((p, q) => p.reach - q.reach || ((p.zCone ?? 0) + (p.zFinger ?? 0)) - ((q.zCone ?? 0) + (q.zFinger ?? 0)));
  return { best: rows[0] ?? null, rows };
}
