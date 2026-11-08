// §329 — THE TRAILING-SIDE WINDING ARREST, DESIGNED IN A LINE (pure). Landing 2a's site solve in main.js reads it under ?arrest=trailing.
//
// §47's arrest is one finger on one stud: the arriving coil lifts its pad, and its beak, on the SAME part, throws inward in front of
// the fusee's lug. §75 step 1 measured that with the mainspring drum turned to 125–135° the chain fills every beak station on the side
// that finger throws inward, while the other side of the pad is chain-free (landing 1 measured it: all 105 stations). A beak on the
// finger there throws OUTWARD; a mirrored finger throws inward but reverses the lug's moment (in radial/tangential components the lug's
// push gives a moment a_r·f, which a mirror does not change, while the throw's sign flips), so the lug would peel it out. So the beak
// moves to a SECOND lever on its own stud, driven by the finger through a PIN IN A SLOT (the owner's pick, 2026-11-02): its own pivot is
// what lets the lug's force pass on the engaging side.
//
// WHICH WAY THE SECOND LEVER TURNS, AND HOW FAR, ARE THE FOLD'S FACTS — and landing 2a found landing 1 wrong on both.
//   1. Landing 1 drew the pin BETWEEN the studs, so the levers counter-rotated. 2a's site solve tried every far-side beak station at
//      every lever direction on the lands preview at drum 135° (69 pad candidates): every station able to throw the full 0.506 put the
//      stop's moment in the PEELING sense (21,874 refused on the sign, none on the size). In this movement the finger turns with
//      MOVEMENT_SENSE and the lug pushes the beak away from the pad, so an engaging stop needs the beak lever to turn WITH the finger.
//   2. With the pin beyond S2 (S1 ─ S2 ─ pin) the levers co-rotate but the beak lever turns MORE than the finger (ratio 2.03), so its
//      arm is short (0.89) and, held near the force line by the engaging condition, keeps S2 within ~4.5 u of the cone: every site's
//      hub rim stood inside the arm stop (49–59k tries per drum direction, the shipped one included).
// So the finger's stud stands BETWEEN the beak lever's stud and the pin (S2 ═ S1 ─ pin): the beak lever's slotted tail reaches back
// over S1 to the pin on the finger's tail, the levers co-rotate, and the beak lever turns LESS than the finger, so its beak arm is long
// and its stud stands well outside the cone. (The owner's pick, 2026-11-02, after both refusals.)
//
//        pad (lifts by PAD_LIFT, −x)
//          │ R_PAD_ARM
//   S2 ════════ e ════════ S1 ── r1 ── pin        the beak lever's slot runs from S2 out past S1 to the pin (r2 = e + r1)
//   │╲                                            finger turns +ψ1, beak lever +ψ2 (< ψ1)
//   │ ╲ L2 — a +ψ2 turn carries the beak +x (inward at the lug)
//   ●  beak; the lug pushes it toward S2 (+y): the arm in compression, §47's own idiom
//
// THE LINE IS A FAMILY IN L2, AND THE FOLD PICKS ITS MEMBER. What the arrest must deliver is the spec: the throw and bite §47 delivers,
// the gain band, an engaging stop outside the friction circle, the pin's pressure angle inside the friction cone, the member floors.
// Given L2 those fix everything else in closed form:
//   · β and ψ2: the thrown arm stands ε = asin(ρ/L2) past the force line (ρ = MU_STEEL·PIVOT_MIN_U, the friction circle), so with the
//     arm at rest at β and thrown at β + ψ2 = ε, the throw is L2·(sin ε − sin(ε − ψ2)) = ρ − L2·sin(ε − ψ2), and the throw the bite needs
//     gives ψ2 = ε + asin((throw − ρ) / L2);
//   · e: the pin-in-slot with S2 behind S1 gives ψ2 = atan2(r1·sin ψ1, r1·cos ψ1 + e), so e = r1·sin ψ1 / tan ψ2 − r1·cos ψ1 for the pin
//     at its floor radius r1 — and for the fold, r1 = e·tan ψ2 / (sin ψ1 − cos ψ1·tan ψ2) at the stud distance it finds (r1For);
//   · the arm length is therefore a FOLD output, chosen as the smallest that seats S2 (the arm-length rule binds a fold that changes a
//     designed arm; here no arm was designed before the fold, and the record says so).
// Each remaining row is derived from a constraint:
//   · ψ1 = asin(PAD_LIFT / R_PAD_ARM): the finger's turn when the pad's face moves PAD_LIFT across its arm;
//   · r1 at its floor (the pin in a STOCK_MIN_U wall beyond the finger's hub), e at or over its floor (the two hubs clear in plan);
//   · ONE spring, on the BEAK LEVER, biasing it to rest on its own bank: through the slot it holds the pin — and the finger — on the
//     slot's DRIVING flank at every pose, so the slot's running clearance is never lost motion and the finger needs no bank of its own.
//     Unsprung, the beak lever would float PIVOT_BORE_CLEAR·L2/|S2→pin|, and its parked beak could drift that much toward the lug's orbit.
//     The stop's engaging moment turns the beak lever further along its throw, lifting the flank OFF the pin: the slot carries the throw,
//     never the stop;
//   · the GAIN band: §47 held its single lever's beak arm to 1.1–2.2 pad arms, which for one lever IS the displacement gain (throw over
//     lift). With two levers the arms no longer equal the gain, so the band is held where it was always aimed: on throw / PAD_LIFT.
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
// §47's lever ratio band, held here on the overall displacement gain (see the header)
export const GAIN_BAND = Object.freeze([1.1, 2.2]);
// A hub: the bore (a PIVOT_MIN_U stud) plus 0.01 running clearance plus a STOCK_MIN_U wall — main.js' HUB_R, the same expression.
export const HUB_R = PIVOT_MIN_U + 0.01 + STOCK_MIN_U;
export const PIN_R = PIVOT_MIN_U;   // the drive pin: the §50 pivot floor, as §47's bank pin
export const D_MIN = 2 * HUB_R + CLEAR_MARGIN;                                  // S2 to S1: the two hubs, clear in plan
export const R1_MIN = HUB_R + STOCK_MIN_U + PIN_R;                               // S1 to the pin: a STOCK_MIN_U wall beyond the finger's hub

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// The pin-in-slot law with S2 BEHIND S1 (S2 ═ S1 ─ pin): the beak lever's turn for the finger's turn ψ1. Co-rotating, always under ψ1.
export const psi2Of = (psi1, r1, e) => Math.atan2(r1 * Math.sin(psi1), r1 * Math.cos(psi1) + e);
// …its inverse for the fold: the pin radius that gives ψ2 at the stud distance e and the finger's own ψ1 (needs ψ2 < ψ1).
export const r1For = (psi1, psi2, e) => (e * Math.tan(psi2)) / (Math.sin(psi1) - Math.cos(psi1) * Math.tan(psi2));
// …and the line's own closed forms: the turn an engaging arm of length L2 needs for a throw, and the stud distance that gives it.
export const frictionCircle = (mu = MU_STEEL) => mu * PIVOT_MIN_U;
export const epsOf = (L2, mu = MU_STEEL) => Math.asin(Math.min(1, frictionCircle(mu) / L2));
export const psi2ForThrow = (L2, thr, mu = MU_STEEL) => epsOf(L2, mu) + Math.asin((thr - frictionCircle(mu)) / L2);
export const eFor = (psi1, psi2, r1 = R1_MIN) => (r1 * Math.sin(psi1)) / Math.tan(psi2) - r1 * Math.cos(psi1);

// The line's kinematics for a given member. `psi1` overrides the finger's turn (default: full throw). Pure.
export function lineAt({ e, r1 = R1_MIN, L2, beta, psi1 = Math.asin(PAD_LIFT / R_PAD_ARM) }) {
  const pin = [r1 * Math.cos(psi1), r1 * Math.sin(psi1)];
  const psi2 = psi2Of(psi1, r1, e);
  const toPin = Math.hypot(pin[0] + e, pin[1]);
  // the beak arm at rest points −y from S2 = (−e, 0), tilted by beta (CCW positive); the lever turns by psi2 with the finger
  const [bx0, by0] = rot(0, -L2, beta), [bx, by] = rot(bx0, by0, psi2);
  const pad = rot(0, R_PAD_ARM, psi1);
  return { e, r1, pin, psi1, psi2, toPin, beak0: [-e + bx0, by0], beak: [-e + bx, by], pad };
}

// Solve one member of the line: L2 given (the fold's pick), or, by default, the most compact member (S2 at its floor distance D_MIN,
// the pin at R1_MIN) for the probe to judge in free space. Returns every row.
export function solveTrailingArrest({ L2 = null, r1 = R1_MIN, bite = BITE_REF, mu = MU_STEEL } = {}) {
  const psi1 = Math.asin(PAD_LIFT / R_PAD_ARM);
  const throwNeed = PARKED_CLEAR + bite;
  let psi2, e;
  if (L2 === null) {
    e = D_MIN; psi2 = psi2Of(psi1, r1, e);
    // throw(L2) = ρ − L2·sin(ε − ψ2) at this ψ2 grows with L2: bisect for the throw
    const thr = (x) => frictionCircle(mu) - x * Math.sin(epsOf(x, mu) - psi2);
    let lo = Math.max(1e-3, frictionCircle(mu) + 1e-9), hi = 1;
    while (thr(hi) < throwNeed && hi < 1e3) hi *= 2;
    for (let i = 0; i < 200 && hi - lo > 1e-13; i++) { const m = (lo + hi) / 2; if (thr(m) < throwNeed) lo = m; else hi = m; }
    L2 = hi;
  } else {
    psi2 = psi2ForThrow(L2, throwNeed, mu); e = eFor(psi1, psi2, r1);
  }
  const eps = epsOf(L2, mu), beta = eps - psi2;
  const a = lineAt({ e, r1, L2, beta, psi1: 0 }), full = lineAt({ e, r1, L2, beta, psi1 });
  const throwNet = full.beak[0] - a.beak[0];
  // the stop's moment about S2 at full throw, per unit force: the lug pushes the beak toward S2 (+y); engaging = psi2's sense
  const moment = full.beak[0] - (-e);
  const engaging = Math.sign(moment) === Math.sign(full.psi2);
  // the pin's pressure angle: between its velocity (⊥ S1→pin) and the slot's normal (⊥ S2→pin); 0 is ideal
  const v = [-Math.sin(psi1), Math.cos(psi1)], n = [-full.pin[1], full.pin[0] + e];
  const transmissionDeg = (Math.acos(Math.min(1, Math.abs(v[0] * n[0] + v[1] * n[1]) / Math.hypot(n[0], n[1]))) * 180) / Math.PI;
  const r2 = e + r1, slide = Math.abs(full.toPin - r2), floatIfUnsprung = L2 * (PIVOT_BORE_CLEAR / full.toPin);
  return Object.freeze({
    topology: 'S2 behind S1, the pin beyond S1 (co-rotating, ratio under 1)',
    psi1, psi2: full.psi2, ratio: full.psi2 / psi1, e, r1, r2, L2, beta, eps,
    throwNet, throwNeed, bite: throwNet - PARKED_CLEAR, gain: throwNet / PAD_LIFT, lostMotion: 0,
    floatIfUnsprung, parkedIfUnsprung: PARKED_CLEAR - floatIfUnsprung,
    leverOffset: Math.abs(moment), frictionCircle: frictionCircle(mu), engaging, transmissionDeg,
    slotLen: slide + 2 * PIN_R + PIVOT_BORE_CLEAR, slide,
  });
}
