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
//   τ_impulse the escapement: the column's `delivered_J` per beat, spread over
//             the lift as a constant torque in the beat's direction while the
//             pin is inside ±L/2 and the train has torque to give.
//
// THE ESCAPEMENT'S CLOCK IS AN OUTPUT. A beat counts when the balance crosses
// into the lift; τ = (n + p)/2F, where p is the escapement's phase. Inside the
// window p is the POSED law inverted at the balance's own angle — so the pin
// stands where the battery measured it standing for every θ in the window —
// and outside it (the escape wheel locked, the fork banked) p advances with the
// balance's phase-plane angle. Both pieces meet at the window's edges, so τ is
// continuous, and at the posed amplitude the whole map reproduces the posed law
// exactly (seed() and tauOf() are inverses there).

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
  if (p < K.IW) return dir * K.Ap * Math.sin(Math.PI * (p - K.IW / 2));
  const ae = Math.asin(Math.min(1, K.halfLift / A));
  const frac = (p - K.IW) / (1 - K.IW);
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
  const ae = Math.asin(Math.min(1, K.halfLift / Math.max(A, K.halfLift)));
  const a = Math.atan2(u, v);
  const span = Math.PI - 2 * ae;
  return span > 1e-12 ? Math.max(0, Math.min(1, (a - ae) / span)) : 1;
}
export function tauOf(K, S) {
  const p = S.inWindow ? windowP(K, S.theta, dirOf(S.n)) : K.IW + (1 - K.IW) * S.lockFrac;
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
  else sgn = (p - K.IW) / (1 - K.IW) < 0.5 ? dir : -dir;   // outbound before the turn, back after it
  const omega = sgn * K.Omega * Math.sqrt(Math.max(0, A * A - theta * theta));
  const lockFrac = inWindow ? 0 : (p - K.IW) / (1 - K.IW);
  return { theta, omega, n, inWindow, lockFrac, stuck: false, knocks: 0, peak: 0, ampEst: A, lastTurn: 0 };
}

// Table lookup, linear between frames.
function lerpTable(T, x) {
  const f = (x - T.x0) / T.dx;
  const i = Math.max(0, Math.min(T.y.length - 2, Math.floor(f)));
  const t = f - i;
  return T.y[i] * (1 - t) + T.y[i + 1] * t;
}

// The smooth part of the torque (spring, weight, viscous) — the Coulomb,
// brake and impulse terms are piecewise constant and held over a sub-step by
// the event logic in `step`.
function smoothAcc(K, env, theta, omega) {
  let tq = -lerpTable(K.spring, theta) - K.c * omega;
  if (env.weight) tq += lerpTable(env.weight, theta);
  return tq / K.I;
}

// One RK4 sub-step with the piecewise-constant torque `pc` (N·m) held.
function rk4(K, env, th, om, h, pc) {
  const a = (x, v) => smoothAcc(K, env, x, v) + pc / K.I;
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
    if (S.stuck) {
      const hold = -lerpTable(K.spring, S.theta) + (env.weight ? lerpTable(env.weight, S.theta) : 0)
        + (env.drive && S.inWindow ? dirOf(S.n) * K.impulseNm : 0);
      if (Math.abs(hold) <= fr) { left -= h; continue; }
      S.stuck = false;
    }
    const sgnW = S.omega !== 0 ? Math.sign(S.omega)
      : Math.sign(-lerpTable(K.spring, S.theta) + (env.drive && S.inWindow ? dirOf(S.n) * K.impulseNm : 0)) || 1;
    const pc = -fr * sgnW + (env.drive && S.inWindow ? dirOf(S.n) * K.impulseNm : 0);
    let [th, om] = rk4(K, env, S.theta, S.omega, h, pc);
    // Events inside the step: the window's edges and the turning point. Take
    // the earliest by linear interpolation, integrate to it under the old
    // torque, switch, and leave the rest of the step for the next pass.
    let f = 1, ev = null;
    const edge = (g0, g1, tag) => { if (g0 !== 0 && Math.sign(g0) !== Math.sign(g1)) { const ff = g0 / (g0 - g1); if (ff < f) { f = ff; ev = tag; } } };
    edge(S.theta - K.halfLift, th - K.halfLift, '+edge');
    edge(S.theta + K.halfLift, th + K.halfLift, '-edge');
    edge(S.omega, om, 'turn');
    if (ev) {
      // Refine the event's instant by Newton on the event function (its
      // derivative is ω for an edge, the acceleration for the turn), so the
      // switch happens AT the edge rather than at a linear guess of it — a
      // linear guess leaves θ up to θ''·h² off the edge, and snapping that
      // away is an energy error every beat.
      let hh = Math.max(h * f, 1e-12);
      const target = ev === '+edge' ? K.halfLift : ev === '-edge' ? -K.halfLift : 0;
      for (let it = 0; it < 4; it++) {
        [th, om] = rk4(K, env, S.theta, S.omega, hh, pc);
        const r = ev === 'turn' ? om : th - target;
        const d = ev === 'turn' ? smoothAcc(K, env, th, om) + pc / K.I : om;
        if (!(Math.abs(d) > 0)) break;
        const next = Math.min(h, Math.max(1e-12, hh - r / d));
        if (Math.abs(next - hh) < 1e-15) break;
        hh = next;
      }
      [th, om] = rk4(K, env, S.theta, S.omega, hh, pc);
      left -= hh;
    } else {
      left -= h;
    }
    S.theta = th; S.omega = om;
    if (ev === 'turn') {
      const amp = Math.abs(S.theta);
      S.ampEst = amp; S.lastTurn = S.theta;
      if (amp > S.peak) S.peak = amp;
      // Coulomb at the turning point: does what holds it exceed what drives it?
      const drv = -lerpTable(K.spring, S.theta) + (env.weight ? lerpTable(env.weight, S.theta) : 0)
        + (env.drive && S.inWindow ? dirOf(S.n) * K.impulseNm : 0);
      S.omega = 0;
      if (Math.abs(drv) <= fr) S.stuck = true;
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
export function makeDrive({ F, liftDeg, posedAmpDeg, knockDeg, I, k, Q, impulseJ, brakeNm, springRows, STEPS_PER_PERIOD = 400 }) {
  const D = Math.PI / 180;
  const IW = (2 / Math.PI) * Math.asin(liftDeg / (2 * posedAmpDeg));
  const rows = springRows.slice().sort((a, b) => a.theta - b.theta);
  const dx = rows[1].theta - rows[0].theta;
  const Omega = 2 * Math.PI * F;
  return {
    F, IW, Ap: posedAmpDeg * D, halfLift: liftDeg * D / 2, Omega, knockRad: knockDeg * D,
    I, k, Q, c: I * Math.sqrt(k / I) / Q,
    impulseNm: impulseJ / (liftDeg * D), impulseJ, brakeNm,
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
