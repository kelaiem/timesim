// §329 landing 3 (option B) — THE WINDING ARREST AS A GENEVA STOP-WORK, DESIGNED IN A LINE (pure, movement-independent).
//
// Why a count and not a cam. The state the arrest must read is how far the cone has been wound, and the cone's wind is
// FUSEE_WRAP_TURNS (1.75 at the 30 h default) of its own rotation. A cam on the cone repeats every turn and cannot tell turn one from
// turn two, so the arrest has to COUNT turns. The classic count is a Geneva: a finger on the cone carries a star one slot per
// revolution, and a star whose other slots are closed stops the finger at either end of its travel.
//
// The line (free space): a finger pin at radius r1 on the cone's axis; a star of n slots on a pivot at distance a, where
//   r1 = a·sin(π/n)  and  r2 = a·cos(π/n)
// make the pin enter a slot with its velocity ALONG the slot (no shock). The star turns 2π/n per engagement, which spans a finger angle
//   E = π − 2π/n.
// With m open slots and c = n − m ≥ 1 closed slots in one run, the finger travels (m + 1) revolutions less E between the two stops:
//   travel = (m + 1)·2π − E.
// The stop face may be set earlier than the engagement's mouth, by up to TRIM (below); it can never be later.
import { STOCK_MIN_U, PIVOT_MIN_U, CLEAR_MARGIN } from './layout.js';

export const TAU = Math.PI * 2;
export const engagementArc = (n) => Math.PI - TAU / n;                       // E
export const travelTurns = (m, n) => (m + 1) - engagementArc(n) / TAU;       // stop to stop, in finger revolutions

// the pin's and the stud's §50 floor (a pivot's bore / half a wheel's stock): the radius the line uses when no load sizes them
export const PIN_FLOOR_U = Math.max(PIVOT_MIN_U, STOCK_MIN_U / 2);
export const STUD_FLOOR_U = PIVOT_MIN_U;
// the Geneva's dimensions from the pin's orbit radius (the one input the cone supplies). The pin's radius and the star's stud are
// INPUTS since §329's P1 pricing: at the going side's stall they are sized by the load, not the floor (main.js), and every
// dimension that reads them (the slot's width, the tip circle, the slots' inner end, the lock disc's window) follows.
export function genevaDims(n, r1, { rPin = PIN_FLOOR_U, studR = STUD_FLOOR_U } = {}) {
  const a = r1 / Math.sin(Math.PI / n), r2 = a * Math.cos(Math.PI / n);
  const rTip = r2 + rPin + CLEAR_MARGIN;                                      // the star's tip circle: past the entry point by the pin and the margin
  const rIn = a - r1 - rPin - CLEAR_MARGIN;                                   // the slots' inner end: the pin's closest approach, less its own radius and the margin
  // the lock disc rides the star's concave arc between engagements: it must reach the tip circle and stay clear of the slots' pin circle
  const lockLo = a - rTip, lockHi = r1 - rPin - CLEAR_MARGIN;
  return { n, a, r1, r2, rPin, studR, rTip, rIn, lockLo, lockHi, E: engagementArc(n) };
}

// the earliest the stop face can meet the pin: where the pin's circle first crosses the star's tip circle
export function trimMax(n, r1, sizes = {}) {
  const { a, rTip, E } = genevaDims(n, r1, sizes);
  const c = (a * a + r1 * r1 - rTip * rTip) / (2 * a * r1);
  return c >= 1 ? 0 : Math.max(0, Math.acos(Math.max(-1, c)) - E / 2) * 2 / TAU;   // in finger revolutions (both ends can give it)
}

// the member floors the dimensions owe: the lock disc has a window, and the slots' inner end leaves a hub round the star's bore (the
// stud, its running fit, and a §50 wall). The fit was not counted while the stud stood at the pivot floor (PIVOT_MIN_U + STOCK_MIN_U);
// it is a hundredth, and counted now that the stud may be sized by its load.
export const STAR_RUN_U = 0.01;   // the star's bore over its stud: main.js's RUN, the running fit inside one mechanism
export const floorsHold = (d) => d.lockLo <= d.lockHi && d.rIn >= d.studR + STAR_RUN_U + STOCK_MIN_U;

// the (m, n) with the least trim that still reaches the wind's turns T: travel ≥ T, trim = travel − T ≤ trimMax
export function chooseStopwork(T, r1, { nMax = 12, rPin = PIN_FLOOR_U, studR = STUD_FLOOR_U } = {}) {
  const sizes = { rPin, studR };
  let best = null;
  for (let n = 3; n <= nMax; n++) for (let m = 1; m <= Math.ceil(T) + 1; m++) {
    const travel = travelTurns(m, n), trim = travel - T;
    if (trim < -1e-9 || trim > trimMax(n, r1, sizes) + 1e-9) continue;
    if (!floorsHold(genevaDims(n, r1, sizes))) continue;
    if (!best || trim < best.trim - 1e-12 || (Math.abs(trim - best.trim) < 1e-12 && n < best.n)) best = { n, m, c: n - m, travel, trim, ...genevaDims(n, r1, sizes) };
  }
  return best;
}

// THE COUNT, simulated discretely and independent of the closed form: the star presents slot index s (index 0..c-1 closed, the rest
// open); a forward passage enters slot s and presents s+1, a backward passage enters slot s−1 and presents s−1. A passage into a closed
// slot is the stop. Returns the passages possible forward from the lower stop, and the finger angle (rad) between the two stops.
export function simulateStops(m, n) {
  const c = n - m, E = engagementArc(n), closed = (i) => ((i % n) + n) % n < c;
  let s = c;                                                                  // presented slot: the first open one, so the lower stop is just behind it
  const lowerBlocked = closed(s - 1);
  let passages = 0;
  while (!closed(s) && passages < 4 * n) { s += 1; passages += 1; }
  const upperBlocked = closed(s);
  // lower stop at the exit side of passage 0 (θ = +E/2); upper stop at the entry side of passage (passages + 1) (θ = TAU·(passages + 1) − E/2)
  return { passages, lowerBlocked, upperBlocked, travel: TAU * (passages + 1) - E };
}

// the shock-free entry: the pin's velocity direction against the radial to the star's centre at the mouth (1 = along the slot)
export function entryAlignment(n, r1, a = r1 / Math.sin(Math.PI / n)) {
  const E = engagementArc(n), th = -E / 2;
  const vx = a - r1 * Math.cos(th), vy = r1 * Math.sin(th);                  // star centre → pin
  const tx = -r1 * Math.sin(th), ty = -r1 * Math.cos(th);                    // pin's velocity direction (θ increasing), up to sign
  return Math.abs((vx * tx + vy * ty) / (Math.hypot(vx, vy) * Math.hypot(tx, ty)));
}

// the star's angle against the finger's, over the engagement (θ from the line of centres)
export const starAngle = (n, r1, theta, a = r1 / Math.sin(Math.PI / n)) => Math.atan2(r1 * Math.sin(theta), a - r1 * Math.cos(theta));
