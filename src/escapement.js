// TODO 226 step 3 — THE LEVER ESCAPEMENT AS ONE DESCRIPTION: the stones' seats
// and faces, and the escape wheel's angle at every fork angle, solved from the
// same handful of declared quantities. Pure 2-D arithmetic (no three.js), so
// the builder (geometry.js makePalletFork), the tick (main.js escapeAngle) and
// the probes all read ONE law. A law written twice is CLAUDE.md's longer fuse:
// until this module the impulse face was cut from a slide path (geometry.js)
// that the tick re-derived as a proportion (main.js), and the two agreed only
// at the ends.
//
// FRAMES. Everything here is in the fork's NEUTRAL frame: fork pivot at the
// origin, escape-wheel centre W₀ = (0, D), the stones at (σ·span/2, span/2)
// (σ = ±1). The fork turned by φ (its rotation off neutral, = −forkSwingRad in
// main.js) carries a fork-local point p to Rot(φ)·p. A stone σ is LOCKED with
// the fork banked at φ = σ·bank and UNLOCKS as the fork swings toward −σ·bank.
//
// WHAT A BEAT IS, in fork angle x = σ·φ, running from +bank down to −bank:
//
//   LOCK    x = bank         the tooth tip rests a total lock (lock + run) down
//                            the locking face of stone σ;
//   UNLOCK  bank → unlock    the pin carries the fork back through run and lock;
//                            the tip slides up the face to the corner, and the
//                            draw makes the wheel RECOIL as it goes — read off
//                            the face, not posed;
//   IMPULSE unlock → x_E     the tip rides the impulse face from the locking
//                            corner to the let-off corner; the wheel's angle is
//                            where its tooth circle crosses that face;
//   DROP    at x_E           the tip leaves the let-off corner and the wheel runs
//                            free until the NEXT tooth lands on the other
//                            stone's locking face, `lock` down it;
//   RUN     x_E → −bank      the draw carries the fork on to its banking, the
//                            landed tip sliding a further `run` down the face.
//
// with unlock = bank₀ − lock and bank = bank₀ + run, bank₀ the fork's angle at
// the pin's let-off (main.js derives it from the 50° lift). The drop is
// INSTANT in a real watch; here it is paced across the run (the wheel blends
// from its let-off angle to its locked one while the fork runs), because every
// consumer of this law is a function of time that must be continuous. The
// pacing is a timing, not a coefficient: both ends are contacts, and the boot
// asserts below hold the paced tooth behind the face it is landing on.

// The horological constants, declared with their sources (CLAUDE.md rule 1's
// accepted form for a quantity a watchmaker chooses rather than one the
// movement forces). They lived inside makePalletFork until TODO 226 step 3.
export const EMBRACE_DEG = 42; // half the arc of wheel the pallets span: 3.5 pitches of a 15-tooth wheel, the classic Swiss lever
export const DRAW_DEG = 12;    // locking-face lean that pulls the fork into its banking (Swiss practice 12–15°)
export const DROP_DEG = 1.5;   // the wheel's free run between let-off and landing (Swiss practice ≈1.5–2°)
// TODO 226 step 3 — LOCK and RUN, in fork angle. Lock is how far down the
// locking face a tooth lands at the drop; run is the further slide as the draw
// carries the fork onto its banking. Their sum is the TOTAL LOCK the pin must
// undo before the impulse. Swiss lever practice: lock ≈1.5°, run ≈0.5°, total
// lock under 2° (de Carle, Practical Watch Repairing; Daniels, Watchmaking §
// the lever escapement) — enough lock that a shock cannot unlock it, as little
// as possible because unlocking is work the balance pays for with no return.
export const LOCK_DEG = 1.5;
export const RUN_DEG = 0.5;
// TODO 226 step 3 — and the TOOTH'S UNDERCUT that lock makes necessary. A
// locked tip rests a lock + run down the stone's face, so the stone's corner
// stands INSIDE the tip circle, raked back behind the tip by the face's lean
// off the wheel's radial (the draw plus the angle between the fork's radial
// and the wheel's there: 19° on one stone here, 4° on the other). Only the tip
// may touch, so the tooth's locking face is undercut further than that: Swiss
// club-tooth wheels rake it about 24° from the radial (Daniels, Watchmaking,
// the club-tooth lever escapement). The depth the undercut runs to is the
// corners' reach, solved below (`lockReach`); the rake is asserted against
// the steeper of the two faces.
export const TOOTH_RAKE_DEG = 24;

const D2R = Math.PI / 180;
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Where the line A + t·v crosses the circle |P − W| = R, the root nearest t0.
// Returns null when the line misses the circle.
function lineCircle(A, v, W, R, t0) {
  const w = sub(A, W);
  const a = dot(v, v), b = 2 * dot(w, v), c = dot(w, w) - R * R;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
  return Math.abs(t1 - t0) <= Math.abs(t2 - t0) ? t1 : t2;
}

// Bisection for a sign change of f on [a, b].
function bisect(f, a, b, iters = 80) {
  let fa = f(a);
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2, fm = f(m);
    if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

// span: the stones' separation (fork-local x); beatRad: the wheel's advance per
// beat (half a pitch); bank0Rad: the fork's angle at the pin's let-off; sense:
// MOVEMENT_SENSE (the wheel's direction of rotation about +z).
export function leverEscapement({ span, beatRad, bank0Rad, sense, lockDeg = LOCK_DEG, runDeg = RUN_DEG }) {
  const R = span / (2 * Math.sin(EMBRACE_DEG * D2R));
  const D = span / 2 + Math.sqrt(Math.max(R * R - (span / 2) ** 2, 0));
  const W0 = [0, D];
  const lock = lockDeg * D2R, run = runDeg * D2R, drop = DROP_DEG * D2R, draw = DRAW_DEG * D2R;
  const beat = beatRad;
  const bank0 = bank0Rad;
  const bank = bank0 + run;
  const unlock = bank0 - lock;
  const warns = [];
  if (!(lock > 0 && run >= 0 && unlock > 0))
    warns.push(`lock ${lockDeg}° and run ${runDeg}° must leave an impulse: the let-off bank ${(bank0 / D2R).toFixed(3)}° is not more than the lock`);
  if (!(drop > 0 && drop < beat)) warns.push(`drop ${DROP_DEG}° must be a fraction of the beat`);

  const tipAngle0 = (C) => Math.atan2(C[1] - D, C[0]);
  // WHICH WAY THE WHEEL TURNS, written ONCE (TODO 115's rule): an advance δ is
  // a world rotation of sense·δ, and since sense is ±1 the same map reads a
  // world rotation back as an advance. The tip's path, the advance read off a
  // contact and the tooth's direction of travel all go through it.
  const wheelTurn = (delta) => sense * delta;
  // A tooth's tip with the wheel advanced δ from the tooth that stands at C.
  const tipAt = (C, delta) => add(W0, rot(sub(C, W0), wheelTurn(delta)));
  // The wheel advance δ (from the tooth at C) that puts a tip at P.
  const deltaOf = (C, P) => wheelTurn(wrap(Math.atan2(P[1] - D, P[0]) - tipAngle0(C)));

  const stones = [-1, 1].map((sigma) => {
    const C = [sigma * span / 2, span / 2];
    const u = mul(sub(C, W0), 1 / R);                        // wheel radial at the corner
    const tHat = mul([-u[1], u[0]], wheelTurn(1));            // the tooth's direction of travel
    const cHat = mul(C, 1 / len(C));                          // pivot radial
    let f0 = [-cHat[1], cHat[0]];
    if (dot(f0, u) < 0) f0 = mul(f0, -1);                     // zero-torque face, away-from-wheel branch
    const tau = rot(f0, sense * draw);                        // the locking face, leaned for draw
    const thetaTau = Math.atan2(tau[1], tau[0]);
    // THE SEAT, with lock: the corner is placed so the fork at x = unlock
    // carries it exactly onto the tip standing at C — the end of the unlock —
    // and so at the banking it stands a whole lock + run past it.
    const K = rot(C, -sigma * unlock);
    return { sigma, C, u, tHat, cHat, tau, thetaTau, K };
  });
  const byS = (s) => stones[s < 0 ? 0 : 1];

  // The tip on stone s's LOCKING face with the fork at φ: the face is the ray
  // from the corner along τ (into the stone's slot, away from the wheel).
  // `C` names the tooth δ is counted from (the tooth that reaches s's corner).
  function deltaOnLockFace(s, phi) {
    const st = byS(s);
    const A = rot(st.K, phi), v = rot(st.tau, phi);
    const t = lineCircle(A, v, W0, R, 0);
    if (t === null) return { delta: NaN, t: NaN };
    return { delta: deltaOf(st.C, add(A, mul(v, t))), t };
  }

  // THE LET-OFF CORNER, from the drop: with the fork at the let-off (x = −bank₀)
  // the next tooth lands `lock` down the OTHER stone's locking face; the tip
  // leaving THIS stone must stand a drop behind that, on the same wheel.
  for (const st of stones) {
    const s = st.sigma, o = -s;
    const phiL = -s * bank0;
    const land = deltaOnLockFace(o, phiL).delta + beat;       // in units of THIS stone's tooth
    const deltaL = land - drop;
    const tipL = tipAt(st.C, deltaL);
    st.Estar = rot(tipL, -phiL);                              // fork-local
    // stone-local: x across the stone (let-off side), y along τ
    const ch = sub(st.Estar, st.K);
    st.chordLoc = rot(ch, -(st.thetaTau - Math.PI / 2));
  }
  // ONE head polygon carries both stones, so one width: the smaller travel, so
  // that drop stays a floor (the other stone drops a little more, not less).
  const stoneW = Math.min(...stones.map((st) => Math.abs(st.chordLoc[0])));
  const mirrored = sense < 0;
  const bodyX = mirrored ? stoneW : -stoneW;
  for (const st of stones) {
    const { chordLoc } = st;
    st.lead = Math.abs(chordLoc[0]) > 1e-9 ? bodyX * (chordLoc[1] / chordLoc[0]) : 0;  // Δ
    // the let-off corner as cut: stone-local (bodyX, Δ) into fork-local
    st.E = add(st.K, rot([bodyX, st.lead], st.thetaTau - Math.PI / 2));
  }

  // The tip on stone s's IMPULSE face (corner K → let-off E), fork at φ.
  function deltaOnImpulseFace(s, phi) {
    const st = byS(s);
    const A = rot(st.K, phi), v = rot(sub(st.E, st.K), phi);
    const t = lineCircle(A, v, W0, R, 0.5);
    if (t === null) return { delta: NaN, t: NaN };
    return { delta: deltaOf(st.C, add(A, mul(v, t))), t };
  }

  // Where each stone lets off (x where the tooth circle passes through E) and
  // the wheel's angle there; where it rests at the banking.
  for (const st of stones) {
    const s = st.sigma;
    const g = (x) => len(sub(rot(st.E, s * x), W0)) - R;
    st.xE = bisect(g, unlock, -bank);
    st.deltaE = deltaOnImpulseFace(s, s * st.xE).delta;
    st.deltaRest = deltaOnLockFace(s, s * bank).delta;        // locked at the banking (x = bank)
    st.deltaUnlock = deltaOnLockFace(s, s * unlock).delta;    // 0 by the seat
  }

  // δ(σ, φ): the wheel's advance in a beat whose unlocking stone is σ, counted
  // from the tooth that reaches σ's corner, with the fork at φ.
  function deltaAt(sigma, phi) {
    const st = byS(sigma), other = byS(-sigma);
    const x = sigma * phi;
    if (x >= bank) return st.deltaRest;
    if (x >= unlock) return deltaOnLockFace(sigma, phi).delta;
    if (x >= st.xE) return deltaOnImpulseFace(sigma, phi).delta;
    if (x <= -bank) return beat + other.deltaRest;
    // DROP + RUN, paced across the run (see header): from the let-off angle to
    // the angle the next tooth rests at on the other stone at the banking.
    const f = (st.xE - x) / (st.xE + bank);
    return st.deltaE + f * (beat + other.deltaRest - st.deltaE);
  }

  // How far each stone's corner reaches inside the tip circle at the banking,
  // and how far behind the resting tip's inward radial it stands: the tooth's
  // undercut (makeEscapeWheel) is cut to clear both.
  for (const st of stones) {
    const s = st.sigma, phi = s * bank;
    const A = rot(st.K, phi), v = rot(st.tau, phi);
    const { t } = deltaOnLockFace(s, phi);
    const tip = add(A, mul(v, t));
    st.cornerDepth = R - len(sub(A, W0));
    const inward = sub(W0, tip), toC = sub(A, tip);
    const travel = mul([-(tip[1] - D) / R, tip[0] / R], wheelTurn(1));
    const ang = Math.abs(Math.atan2(inward[0] * toC[1] - inward[1] * toC[0], dot(inward, toC)));
    st.faceRake = dot(toC, travel) <= 0 ? ang : -ang;    // positive: the corner stands BEHIND the tip
  }
  const lockReach = Math.max(...stones.map((st) => st.cornerDepth));
  const faceRake = Math.max(...stones.map((st) => st.faceRake));
  if (!(faceRake < TOOTH_RAKE_DEG * D2R))
    warns.push(`a stone's corner stands ${(faceRake / D2R).toFixed(2)}° behind the locked tip, past the tooth's ${TOOTH_RAKE_DEG}° undercut — the tooth's flank would meet the stone`);

  // ---- the law's own asserts: each is a claim about contact, measured ----
  for (const st of stones) {
    const s = st.sigma;
    if (Math.abs(st.deltaUnlock) > 1e-9)
      warns.push(`stone ${s}: the seat leaves the tip ${(st.deltaUnlock / D2R).toFixed(6)}° off the corner at the end of the unlock`);
    // the unlock RECOILS: the wheel turns back as the face lifts (draw)
    if (!(st.deltaRest > 0))
      warns.push(`stone ${s}: the locked tooth stands ${(st.deltaRest / D2R).toFixed(4)}° from the corner's tooth — the unlock does not recoil, so the face has no draw`);
    // the impulse advances the wheel monotonically corner → let-off
    let prev = -Infinity, ok = true;
    for (let k = 0; k <= 64; k++) {
      const x = unlock + (st.xE - unlock) * (k / 64);
      const d = deltaOnImpulseFace(s, s * x).delta;
      if (!(d >= prev - 1e-12)) ok = false;
      prev = d;
    }
    if (!ok) warns.push(`stone ${s}: the wheel does not advance monotonically along the impulse face`);
    // the paced drop stays BEHIND the face the next tooth lands on
    let worst = Infinity;
    for (let k = 0; k <= 64; k++) {
      const x = st.xE + (-bank - st.xE) * (k / 64);
      const landing = deltaOnLockFace(-s, s * x).delta + beat;
      worst = Math.min(worst, landing - deltaAt(s, s * x));
    }
    st.dropClear = worst;
    if (worst < -1e-9)
      warns.push(`stone ${s}: the paced drop carries the landing tooth ${(-worst / D2R).toFixed(4)}° into the other stone's locking face`);
    st.dropDeg = (deltaOnLockFace(-s, s * st.xE).delta + beat - st.deltaE) / D2R;
    if (!(st.dropDeg >= DROP_DEG - 1e-9))
      warns.push(`stone ${s}: drop ${st.dropDeg.toFixed(4)}° under the declared ${DROP_DEG}°`);
  }

  return {
    R, D, W0, beat, bank0, bank, unlock, lock, run, drop, draw,
    stoneW, bodyX, mirrored, stones, lockReach, faceRake, deltaAt, deltaOnLockFace, deltaOnImpulseFace, tipAt, warns,
  };
}
