// §329 landing 1 — THE TRAILING-SIDE WINDING ARREST, DESIGNED IN A LINE (pure; nothing in the build reads it yet).
//
// §47's arrest is one finger on one stud: the arriving coil lifts its pad, and its beak, on the SAME part, throws inward in front of
// the fusee's lug. §75 step 1 measured that with the mainspring drum turned to 125–135° the chain fills every beak station on the side
// that finger throws inward, while the other side of the pad is chain-free, where a beak on the same finger throws OUTWARD. A mirrored
// finger throws inward there but reverses the lug's moment (in radial/tangential components the lug's push gives a moment a_r·f, which
// a mirror does not change, while the throw's sign flips), so the lug would peel it out. So the beak moves to a SECOND lever on its own
// stud, and the finger drives it in reverse through a PIN IN A SLOT (the owner's pick, 2026-11-02).
//
// The line (CLAUDE.md's design priority: input at one end, output at the other, no corridors), in its own frame:
//
//        pad (lifts by PAD_LIFT, −x)               beak (throws +x, inward at the lug)
//          │                                         ╲  tilted β past the lug's force line
//          │ R_PAD_ARM                                ╲ L2
//   S1 ────●──── r1 ──── pin ═══[ slot ]═══ r2 ────────● S2
//      finger (turns +ψ1)                   beak lever (turns −ψ2)
//
// S1 at the origin, S2 at (d, 0) with d = r1 + r2; the pad arm and the beak arm both run along +y at rest (the beak arm tilted by β),
// so the pad's lift and the beak's throw are both along x and opposite. Every row is derived from a constraint, written beside it:
//   · ψ1 = asin(PAD_LIFT / R_PAD_ARM): the finger's turn when the pad's face moves PAD_LIFT perpendicular to its arm;
//   · the pin rides the slot exactly: ψ2 = atan2(r1·sin ψ1, d − r1·cos ψ1), the slot running along S2→pin;
//   · r1 and r2 at their floors: a hub (the bore and its running clearance, a STOCK_MIN_U wall) and the pin (or the slot's flank) set in
//     a STOCK_MIN_U wall beyond it;
//   · ONE spring, on the BEAK LEVER, biasing it toward rest on its own bank: through the slot it presses the pin — and the finger with it —
//     onto the slot's DRIVING flank at every pose, so the slot's running clearance (the pin's diameter plus PIVOT_BORE_CLEAR) is never
//     lost motion, and the finger needs no bank of its own (the pin locates it). The first draft hung the spring on the finger and left
//     the beak lever to float: its parked beak could then drift PIVOT_BORE_CLEAR·L2/|S2→pin| (0.104) INWARD, leaving 0.066 to the lug's
//     orbit, under CLEAR_MARGIN — the reason the spring moved. The stop's engaging moment turns the beak lever further along its throw,
//     which lifts the flank OFF the pin, so the slot carries the throw and never the stop;
//   · β: at full throw the lug's force (tangential, along −y onto the beak, toward S2) must pass OUTSIDE the pivot's friction circle on the
//     ENGAGING side, so the stop's load drives the beak deeper rather than back into the slot. The friction circle's radius is
//     MU_STEEL·PIVOT_MIN_U (MU_STEEL: the adverse corner of every steel row, layout.js), so the thrown arm stands asin(MU_STEEL·PIVOT_MIN_U
//     / L2) past the force line, on the side the throw carries it: β = −ψ2 − asin(MU_STEEL·PIVOT_MIN_U / L2);
//   · L2: solved so the throw, after the lost motion, reaches the PARKED clearance (CLEAR_MARGIN + 0.02, §47's BEAK_PARKED_R − LUG_OUTER)
//     plus the bite the arrest it replaces delivers (BITE_REF) — the trailing arrest bites as deep as §47's, not merely past 0.15.
import { CLEAR_MARGIN, PIVOT_MIN_U, STOCK_MIN_U, PIVOT_BORE_CLEAR, MU_STEEL } from './layout.js';

// §47's own line spec, as main.js declares it (its locals R_PAD_ARM and PAD_LIFT); tools/probe-329-arrest-line.mjs holds these two
// equal to main.js' source text, so the reference and the arrest it replaces cannot part.
export const R_PAD_ARM = 1.25;
export const PAD_LIFT = 0.36;
// The parked clearance between the lug's orbit and the parked beak: §47's BEAK_PARKED_R = LUG_OUTER + CLEAR_MARGIN + 0.02.
export const PARKED_CLEAR = CLEAR_MARGIN + 0.02;
// The bite §47's arrest delivers on the default build (ENGAGE, __clock.windArrest.engage = 0.33607 at main 599fe46c), the depth this
// one must match; and the floor §47's own assert holds (ENGAGE ≥ 0.15).
export const BITE_REF = 0.336;
export const BITE_MIN = 0.15;
// A hub: the bore (a PIVOT_MIN_U stud) plus 0.01 running clearance plus a STOCK_MIN_U wall — main.js' HUB_R, the same expression.
export const HUB_R = PIVOT_MIN_U + 0.01 + STOCK_MIN_U;
export const PIN_R = PIVOT_MIN_U;   // the drive pin: the §50 pivot floor, as §47's bank pin
// The pin (on the finger) and the slot's flank (on the beak lever) each stand a STOCK_MIN_U wall clear of their own hub.
export const R1_MIN = HUB_R + STOCK_MIN_U + PIN_R;
export const R2_MIN = HUB_R + STOCK_MIN_U + PIN_R + PIVOT_BORE_CLEAR / 2;

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// The line's kinematics for given radii and beak arm. `psi1` overrides the finger's turn (default: full throw). Pure.
export function lineAt({ r1 = R1_MIN, r2 = R2_MIN, L2, beta, psi1 = Math.asin(PAD_LIFT / R_PAD_ARM) }) {
  const d = r1 + r2;
  const pin = [r1 * Math.cos(psi1), r1 * Math.sin(psi1)];
  const psi2 = -Math.atan2(pin[1], d - pin[0]);   // the slot runs along S2→pin, so the beak lever turns to keep it there: reversed
  const toPin = Math.hypot(d - pin[0], pin[1]);
  // the beak arm at rest is tilted by +beta from +y about S2 (toward −x, i.e. outboard of the force line); the lever turns by psi2
  const [bx0, by0] = rot(0, L2, beta), [bx, by] = rot(bx0, by0, psi2);
  const pad = rot(0, R_PAD_ARM, psi1);
  return { d, pin, psi1, psi2, toPin, beak0: [d + bx0, by0], beak: [d + bx, by], pad, armAngle: Math.atan2(-bx, by) };
}

// Solve the line: the radii at their floors, L2 for the throw the bite needs, β for an engaging stop. Returns every row.
export function solveTrailingArrest({ r1 = R1_MIN, r2 = R2_MIN, bite = BITE_REF, mu = MU_STEEL } = {}) {
  const psi1 = Math.asin(PAD_LIFT / R_PAD_ARM);
  const throwNeed = PARKED_CLEAR + bite;
  const throwOf = (L2) => {
    const beta = betaOf(L2);
    const a = lineAt({ r1, r2, L2, beta, psi1: 0 }), b = lineAt({ r1, r2, L2, beta, psi1 });
    // the spring holds the pin on the driving flank, so none of the slot's clearance is lost motion; `floatIfUnsprung` is what it
    // would cost (and how far the parked beak could drift inward) were the beak lever left without it — reported, the first draft's error
    const floatIfUnsprung = L2 * (PIVOT_BORE_CLEAR / b.toPin);
    return { gross: b.beak[0] - a.beak[0], lost: 0, floatIfUnsprung, net: b.beak[0] - a.beak[0], beta, a, b };
  };
  // β: the full-throw arm must stand asin(ρ/L2) past the force line (ρ = μ·r_pivot), measured from where the throw leaves it
  const psi2Full = lineAt({ r1, r2, L2: 1, beta: 0, psi1 }).psi2;
  // At full throw the arm stands at β + ψ2 from +y. The force (−y, toward S2) then has moment L2·sin(β + ψ2)·(+1) about S2 — CCW, back
  // toward rest — when β + ψ2 > 0, so the ENGAGING side is β + ψ2 < 0: the arm carried just past the force line by the throw itself.
  function betaOf(L2) { return -psi2Full - Math.asin(Math.min(1, (mu * PIVOT_MIN_U) / L2)); }
  // the throw grows with L2: bracket and bisect
  let lo = 1e-3, hi = 1;
  while (throwOf(hi).net < throwNeed && hi < 1e3) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-13; i++) { const m = (lo + hi) / 2; if (throwOf(m).net < throwNeed) lo = m; else hi = m; }
  const L2 = hi, t = throwOf(L2), full = t.b;
  // the stop's moment about S2 at full throw: the lug pushes the beak along −y (toward S2); engaging = the sense that turns the lever
  // further along its own throw (psi2's sign)
  const F = [0, -1];
  const arm = [full.beak[0] - full.d, full.beak[1]];
  const moment = arm[0] * F[1] - arm[1] * F[0];          // z of arm × F, per unit force
  const engaging = Math.sign(moment) === Math.sign(full.psi2);
  const leverOffset = Math.abs(moment);                   // the force line's distance from S2, per unit force
  // the pin's transmission: angle between the pin's own velocity (⊥ S1→pin) and the slot's normal (⊥ S2→pin); 0 is ideal
  const sv = [-Math.sin(psi1), Math.cos(psi1)], sn = [-(full.pin[1] - 0), full.pin[0] - full.d];
  const snL = Math.hypot(sn[0], sn[1]);
  const transmissionDeg = (Math.acos(Math.min(1, Math.abs(sv[0] * sn[0] + sv[1] * sn[1]) / snL)) * 180) / Math.PI;
  // the slot's length: the pin's travel along it over the stroke, plus its diameter and the clearance
  const slide = Math.abs(full.toPin - r2);
  return Object.freeze({
    psi1, psi2: full.psi2, ratio: Math.abs(full.psi2 / psi1), r1, r2, d: full.d, L2, beta: t.beta,
    throwGross: t.gross, lostMotion: t.lost, floatIfUnsprung: t.floatIfUnsprung, parkedIfUnsprung: PARKED_CLEAR - t.floatIfUnsprung, throwNet: t.net, throwNeed, bite: t.net - PARKED_CLEAR,
    gain: t.net / PAD_LIFT, leverOffset, frictionCircle: mu * PIVOT_MIN_U, engaging, transmissionDeg,
    slotLen: slide + 2 * PIN_R + PIVOT_BORE_CLEAR, slide,
  });
}
