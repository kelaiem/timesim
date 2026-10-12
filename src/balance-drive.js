// §246 tier two — THE BALANCE, DRIVEN. A pure module (no scene, no three.js):
// main.js builds the tables from the metal and the energy column and calls
// `step` from the live loop; probes import it to test the integrator alone.
//
// The equation of motion (SI, θ the balance's rotation from rest):
//
//   I·θ'' = −τ_spring(θ) + τ_weight(θ) − c·θ' − T_f·sgn θ' − T_brake·sgn θ' + τ_impulse
//
//   τ_spring  the elastica's own torque, read off the hairspring's wind frames
//             (geometry.js makeHairspring, §218) — the same solves the metal wears;
//   τ_weight  the spring's own weight through its breathing centroid,
//             m_s·g·d(ĝ·c)/dθ (§246 tier one's term, from the same frames);
//   c         the losses the energy column prices as Q: per beat πkA²/2Q, so
//             c = I·Ω/Q (a viscous loss of that size does that work);
//   T_f       the balance pivot's Coulomb friction for the position — the
//             column's `pivot.flat_Nm` / `pivot.vertical_Nm`;
//   T_brake   the hack lever's pad, sized to hold the spring's peak torque;
//   τ_impulse the escapement, wherever the pin and the fork are in contact
//             and the train has torque to give: a table over u = dir·θ (the
//             angle in the beat's own sense) that main.js reads off the metal
//             by virtual work (TODO 238) — negative through the unlock, where
//             the balance turns the wheel back against the stone's draw, zero
//             across the shake's crossing, positive from the crossing's end to
//             the let-off — its net work the column's `delivered_J` per beat.
//             Without a table it is that energy laid evenly over ±L/2, the
//             symmetric impulse Airy's control needs.
//
// THE ESCAPEMENT'S CLOCK IS AN OUTPUT. A beat counts when the balance crosses
// into the lift; τ = (n + p)/2F, where p is the escapement's phase. Inside the
// pin's PASSAGE p is the POSED law inverted at the balance's own angle — so the
// pin stands where the battery measured it standing for every θ there — and
// outside it (the escape wheel locked, the fork banked) p advances with the
// balance's phase-plane angle. Both pieces meet at the passage's edges, so τ is
// continuous, and at the posed amplitude the whole map reproduces the posed law
// exactly (seed() and tauOf() are inverses there).
//
// TWO THRESHOLDS, since TODO 226 step 3b. The LIFT (±L/2, `halfLift`) is where
// the impulse acts and where a beat is counted and timed (`entryT`). The
// PASSAGE (±`halfPass`, the pin's entry half-angle, wider than the lift by the
// run and the lock) is where the pin is in the notch and carries the fork: the
// unlock before the lift and the run after it. τ must be the posed law's own
// inverse over the whole passage, because the fork and the train are read off
// τ through the posed law — a passage narrower than the pin's let the fork read
// one balance angle while the balance showed another, in a dial-flat pose and
// in the live loop. With halfPass = halfLift the map is the old one exactly.

export const POSITIONS = ['DU', 'DD', 'CU', 'CD', 'CL', 'CR'];
export const FLAT_POSITIONS = new Set(['DU', 'DD']);
export const DEFAULT_POSITION = 'CU';   // a pocket watch hangs pendant up — and a hanging position poses the designed swing

// The beat's direction: beat n crosses the window toward +θ when n is even
// (the posed law: τ = 0 is the unlocking with θ rising through −L/2).
const dirOf = (n) => ((n % 2) + 2) % 2 === 0 ? 1 : -1;

// The posed balance at amplitude A (radians): inside the window the posed
// law of amplitude A_p (the pin geometry the battery holds), outside it an arc
// of amplitude A that meets the window's edges. At A = A_p this IS
// A_p·sin(2πF(τ − τ0)); the caller keeps that closed form for that case so the
// default pose is bit-identical to the pre-§246 law.
export function posedTheta(K, tau, A) {
  const raw = tau * 2 * K.F, n = Math.floor(raw), p = raw - n, dir = dirOf(n);
  // inside the pin's passage — this beat's, or the next one's entry, which
  // the same sinusoid carries across the beat boundary — the posed law
  if (p < K.IW / 2 + K.pw || p > 1 + K.IW / 2 - K.pw) return dir * K.Ap * Math.sin(Math.PI * (p - K.IW / 2));
  const ae = Math.asin(Math.min(1, K.halfPass / A));
  const frac = (p - K.IW / 2 - K.pw) / (1 - 2 * K.pw);
  return dir * A * Math.sin(ae + frac * (Math.PI - 2 * ae));
}

// The escapement's phase from the balance's state, and the state from τ.
function windowP(K, theta, dir) {
  const s = Math.max(-1, Math.min(1, dir * theta / K.Ap));
  return K.IW / 2 + Math.asin(s) / Math.PI;
}
function lockFracOf(K, theta, omega, dir) {
  const u = dir * theta, v = dir * omega / K.Omega;
  const A = Math.hypot(u, v);
  const ae = Math.asin(Math.min(1, K.halfPass / Math.max(A, K.halfPass)));
  const a = Math.atan2(u, v);
  const span = Math.PI - 2 * ae;
  return span > 1e-12 ? Math.max(0, Math.min(1, (a - ae) / span)) : 1;
}
export function tauOf(K, S) {
  let p;
  if (S.inWindow) p = windowP(K, S.theta, dirOf(S.n));
  else if (Math.abs(S.theta) < K.halfPass) {
    // in the passage but outside the lift: the run after this beat's exit, or
    // the unlock before the next beat's entry (whose phase is just under 1)
    p = S.lockFrac < 0.5 ? windowP(K, S.theta, dirOf(S.n)) : 1 + windowP(K, S.theta, dirOf(S.n + 1));
  } else p = K.IW / 2 + K.pw + (1 - 2 * K.pw) * S.lockFrac;
  return (S.n + p) / (2 * K.F);
}

// Seed the driven state from a pose: θ is the posed law at A; ω is a linear
// oscillator's at amplitude A through that θ, signed by the phase (the live
// loop then relaxes the amplitude to whatever the energy balance sustains).
export function seed(K, tau, A) {
  const raw = tau * 2 * K.F, n = Math.floor(raw), p = raw - n, dir = dirOf(n);
  const theta = posedTheta(K, tau, A);
  const inWindow = p < K.IW;
  let sgn;
  if (inWindow) sgn = dir;
  else sgn = p < 0.5 + K.IW / 2 ? dir : -dir;   // outbound before the turn (mid-arc), back after it
  const omega = sgn * K.Omega * Math.sqrt(Math.max(0, A * A - theta * theta));
  const lockFrac = inWindow ? 0 : Math.max(0, Math.min(1, (p - K.IW / 2 - K.pw) / (1 - 2 * K.pw)));
  return { theta, omega, n, inWindow, lockFrac, stuck: false, knocks: 0, peak: 0, ampEst: A, lastTurn: 0 };
}

// The impulse laid evenly over the lift: the law before TODO 238, kept as the
// symmetric control (Airy's), and as the default when no table is given.
export function symmetricImpulse(halfLift, impulseJ) {
  const c = impulseJ / (2 * halfLift);
  return { u0: -halfLift, du: halfLift, y: Float64Array.from([c, c, c]), breaks: [] };
}

// The impulse table at u, linear between nodes and ZERO outside it: the pin is
// out of the notch, or the fork is banked.
function impulseAt(T, u) {
  const f = (u - T.u0) / T.du;
  if (!(f > 0 && f < T.y.length - 1)) return 0;
  const i = Math.floor(f), t = f - i;
  return T.y[i] * (1 - t) + T.y[i + 1] * t;
}

// Which beat the pin is working, if any: inside the lift it is beat n's; in
// the passage on the way back in (the lock after beat n, past its turn) it is
// the NEXT beat's unlock; on the way out after the drop it is nobody's.
function escBeat(S) {
  if (S.inWindow) return S.n;
  return S.lockFrac >= 0.5 ? S.n + 1 : null;
}

// The escapement's torque on the balance at θ, for the beat `nb` (or none).
function escTorque(K, env, nb, theta) {
  if (!env.drive || nb === null) return 0;
  const d = dirOf(nb);
  return d * impulseAt(K.impulse, d * theta);
}

// Table lookup, linear between frames.
function lerpTable(T, x) {
  const f = (x - T.x0) / T.dx;
  const i = Math.max(0, Math.min(T.y.length - 2, Math.floor(f)));
  const t = f - i;
  return T.y[i] * (1 - t) + T.y[i + 1] * t;
}

// The smooth part of the torque (spring, weight, viscous, and the escapement's
// table for the beat `nb` the sub-step began in) — the Coulomb and brake terms
// are piecewise constant and held over a sub-step by the event logic in `step`.
function smoothAcc(K, env, theta, omega, nb) {
  let tq = -lerpTable(K.spring, theta) - K.c * omega + escTorque(K, env, nb, theta);
  if (env.weight) tq += lerpTable(env.weight, theta);
  return tq / K.I;
}

// What drives the balance at rest at θ: everything but the friction.
function restTorque(K, env, nb, theta) {
  return -lerpTable(K.spring, theta) + (env.weight ? lerpTable(env.weight, theta) : 0) + escTorque(K, env, nb, theta);
}

// One RK4 sub-step with the piecewise-constant torque `pc` (N·m) held.
function rk4(K, env, th, om, h, pc, nb) {
  const a = (x, v) => smoothAcc(K, env, x, v, nb) + pc / K.I;
  const k1x = om, k1v = a(th, om);
  const k2x = om + h / 2 * k1v, k2v = a(th + h / 2 * k1x, om + h / 2 * k1v);
  const k3x = om + h / 2 * k2v, k3v = a(th + h / 2 * k2x, om + h / 2 * k2v);
  const k4x = om + h * k3v, k4v = a(th + h * k3x, om + h * k3v);
  return [th + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), om + h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)];
}

// Advance the state by dt. env = { drive: bool (the train has torque), brake:
// 0..1 (the hack pad's engagement), friction: N·m (the position's pivot),
// weight: table|null (the position's spring-weight torque), steps: sub-steps
// per period (defaults to K.STEPS_PER_PERIOD; fast-forward passes fewer) }.
export function step(K, S, dt, env) {
  if (S.t === undefined) S.t = 0;
  const hMax = 1 / (K.F * (env.steps || K.STEPS_PER_PERIOD));
  let left = dt;
  let guard = 0;
  while (left > 1e-15 && guard++ < 100000) {
    const h = Math.min(hMax, left);
    const fr = env.friction + (env.brake || 0) * K.brakeNm;
    // Stuck: static friction holds while it can.
    const nb = escBeat(S);
    if (S.stuck) {
      if (Math.abs(restTorque(K, env, nb, S.theta)) <= fr) { left -= h; continue; }
      S.stuck = false;
    }
    const sgnW = S.omega !== 0 ? Math.sign(S.omega) : Math.sign(restTorque(K, env, nb, S.theta)) || 1;
    const pc = -fr * sgnW;
    let [th, om] = rk4(K, env, S.theta, S.omega, h, pc, nb);
    // Events inside the step: the window's edges and the turning point. Take
    // the earliest by linear interpolation, integrate to it under the old
    // torque, switch, and leave the rest of the step for the next pass.
    let f = 1, ev = null;
    const edge = (g0, g1, tag) => { if (g0 !== 0 && Math.sign(g0) !== Math.sign(g1)) { const ff = g0 / (g0 - g1); if (ff < f) { f = ff; ev = tag; } } };
    edge(S.theta - K.halfLift, th - K.halfLift, '+edge');
    edge(S.theta + K.halfLift, th + K.halfLift, '-edge');
    edge(S.omega, om, 'turn');
    // the escapement's own switches (the unlock's start and end, the impulse's
    // start): the torque jumps there, and RK4 carried across a jump mis-counts
    // the work by up to a sub-step's share of it every beat — so they are
    // events too, located and stepped to like the lift's edges
    let brk = 0;
    if (env.drive && nb !== null) {
      const d = dirOf(nb);
      for (const b of K.impulse.breaks || []) {
        const tb = d * b, f0 = f;
        edge(S.theta - tb, th - tb, 'break');
        if (f < f0) brk = tb;
      }
    }
    if (ev) {
      // Refine the event's instant by Newton on the event function (its
      // derivative is ω for an edge, the acceleration for the turn), so the
      // switch happens AT the edge rather than at a linear guess of it — a
      // linear guess leaves θ up to θ''·h² off the edge, and snapping that
      // away is an energy error every beat.
      let hh = Math.max(h * f, 1e-12);
      const target = ev === '+edge' ? K.halfLift : ev === '-edge' ? -K.halfLift : ev === 'break' ? brk : 0;
      for (let it = 0; it < 4; it++) {
        [th, om] = rk4(K, env, S.theta, S.omega, hh, pc, nb);
        const r = ev === 'turn' ? om : th - target;
        const d = ev === 'turn' ? smoothAcc(K, env, th, om, nb) + pc / K.I : om;
        if (!(Math.abs(d) > 0)) break;
        const next = Math.min(h, Math.max(1e-12, hh - r / d));
        if (Math.abs(next - hh) < 1e-15) break;
        hh = next;
      }
      [th, om] = rk4(K, env, S.theta, S.omega, hh, pc, nb);
      left -= hh;
    } else {
      left -= h;
    }
    S.theta = th; S.omega = om;
    if (ev === 'break') S.theta = brk;   // on the switch exactly, so the next pass starts from it
    if (ev === 'turn') {
      const amp = Math.abs(S.theta);
      S.ampEst = amp; S.lastTurn = S.theta;
      if (amp > S.peak) S.peak = amp;
      // Coulomb at the turning point: does what holds it exceed what drives it?
      S.omega = 0;
      if (Math.abs(restTorque(K, env, nb, S.theta)) <= fr) S.stuck = true;
    } else if (ev === '+edge' || ev === '-edge') {
      const edgeSign = ev === '+edge' ? 1 : -1;
      S.theta = edgeSign * K.halfLift;
      const outward = Math.sign(S.omega) === edgeSign;
      if (S.inWindow) {
        const dir = dirOf(S.n);
        if (outward && edgeSign === dir) { S.inWindow = false; S.lockFrac = 0; }          // the drop: beat n done, wheel locks
        else if (outward && edgeSign === -dir) { S.n -= 1; S.inWindow = false; S.lockFrac = 1; }   // backed out the entry: the wheel recoils to lock
      } else if (!outward) {
        // Into the window from the lock after beat n: the unlocking of beat n+1.
        S.n += 1; S.inWindow = true;
        S.entryT = S.t + (dt - left);   // the instant, to the sub-step — what a rate instrument times
      }
    }
    // The knock: the pin meets the banked fork's horn. Reflected, and counted.
    if (Math.abs(S.theta) > K.knockRad) {
      S.theta = Math.sign(S.theta) * K.knockRad; S.omega = -S.omega; S.knocks++;
    }
    if (!S.inWindow) {
      const lf = lockFracOf(K, S.theta, S.omega, dirOf(S.n));
      if (lf > S.lockFrac) S.lockFrac = lf;
    }
  }
  S.t += dt;
  return S;
}

// Build the constants. Inputs are SI except the frame tables' angles (rad).
export function makeDrive({ F, liftDeg, passHalfDeg = liftDeg / 2, posedAmpDeg, knockDeg, I, k, Q, impulseJ, impulse = null, brakeNm, springRows, STEPS_PER_PERIOD = 400 }) {
  const D = Math.PI / 180;
  const IW = (2 / Math.PI) * Math.asin(liftDeg / (2 * posedAmpDeg));
  // the passage's half-width in phase: the posed law reaches ±halfPass at
  // p = IW/2 ± pw (TODO 226 step 3b; pw = IW/2 when the passage is the lift)
  if (!(passHalfDeg >= liftDeg / 2 - 1e-12)) throw new Error(`balance-drive: the pin's passage (±${passHalfDeg}°) is narrower than the lift (±${liftDeg / 2}°)`);
  const pw = Math.asin(passHalfDeg / posedAmpDeg) / Math.PI;
  const rows = springRows.slice().sort((a, b) => a.theta - b.theta);
  const dx = rows[1].theta - rows[0].theta;
  const Omega = 2 * Math.PI * F;
  const imp = impulse || symmetricImpulse(liftDeg * D / 2, impulseJ);
  return {
    F, IW, pw, Ap: posedAmpDeg * D, halfLift: liftDeg * D / 2, halfPass: passHalfDeg * D, Omega, knockRad: knockDeg * D,
    I, k, Q, c: I * Math.sqrt(k / I) / Q,
    impulse: imp, impulseJ, impulsePeakNm: imp.y.reduce((m, y) => Math.max(m, y), 0), brakeNm,
    spring: { x0: rows[0].theta, dx, y: Float64Array.from(rows.map((r) => r.torque)) },
    STEPS_PER_PERIOD,
  };
}

// The spring-weight table for a gravity direction (gx, gy) in the spring's
// own plan frame: τ_w = m_s·g·d(ĝ·c)/dθ, central differences on the frames'
// centroids (model units × uM metres per unit).
export function weightTable(rows, gx, gy, massKg, g, uM) {
  const R = rows.slice().sort((a, b) => a.theta - b.theta);
  const h = R.map((r) => gx * r.cx + gy * r.cy);
  const dx = R[1].theta - R[0].theta;
  const y = new Float64Array(R.length);
  for (let i = 0; i < R.length; i++) {
    const lo = Math.max(0, i - 1), hi = Math.min(R.length - 1, i + 1);
    y[i] = massKg * g * uM * (h[hi] - h[lo]) / ((hi - lo) * dx);
  }
  return { x0: R[0].theta, dx, y };
}

// Does the escapement START a stopped balance? The watchmaker's test: the
// balance at rest at its spring's own zero, the train wound, nothing else.
// A lever escapement starts itself when the wheel's push carries the pin from
// there through the let-off — the tooth drops, the other stone locks, and the
// spring the push wound up swings the balance back into the next impulse. Run
// the drive from that rest and count the beats: `starts` once the balance has
// worked both stones twice and is still swinging.
export function selfStart(K, env, periods = 8) {
  const S = { theta: 0, omega: 0, n: 0, inWindow: true, lockFrac: 0, stuck: false, knocks: 0, peak: 0, ampEst: 0, lastTurn: 0 };
  const dt = 1 / (K.F * 40);
  for (let i = 0; i < periods * 40; i++) step(K, S, dt, env);
  return { starts: S.n >= 4 && !S.stuck, beats: S.n, stuck: S.stuck, peakRad: S.peak, theta: S.theta };
}
