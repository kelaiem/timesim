// DOES THE LEGO FUSEE'S LOOP RUN DOWN AND WIND BACK BY THE MODULE'S OWN LAWS —
// the cord off the cone a step at a time and onto the barrel, leaving each
// pulley on the open belt's tangent, its length conserved, the maintaining
// power carrying the great wheel while it is wound, the steps filling base
// first, and the torque readout the solve's own level product? Acceptance,
// pure Node, no browser, no network; exits non-zero on any failure. BUILT §282,
// §286 (src/technic-fusee.js, the loop technic.html runs).
//
// MODELLED, NOT SIMULATED: the loop advances nothing by a force. Its one rate
// is the great wheel's, a DISPLAY rate standing in for an escapement this
// module does not build; every other angle is read from the state through the
// parts' laws, and the spring's torque is the POSED table's.
//
//   · FULL WIND — the loop's first state, and every state a wind ends on, is
//     the static build exactly: every body's angle fuseeBuild's, the cord the
//     same path point for point;
//   · ON THE TANGENT (§286) — read off the DRAWN path at every swept state: the
//     span square to the radius at its departure and at its arrival (float
//     noise); on a wrap the departure is the belt's tangent point for the
//     step's MEASURED seat (float noise, 1e-9); through a crossing it stays
//     between the two seats and within the belt's own turn between them
//     (|α(ρ_j) − α(ρ_k)|, derived);
//   · LENGTH CONSERVED (§286) — the cord, arcs counted as arcs, is the string's
//     length at every state (1e-9 mm): the barrel's turn takes up the span's
//     change, not the cord paid alone;
//   · ANGLES TRAVEL THE PARTS — at every sampled state the cone's and the
//     barrel's body angles are the angles the cord's two HOOKS stand at
//     (cordPath at that state), so the bodies and the cord are one reading;
//   · RATIO — on every wrap the cone's turn × the step's seat equals the
//     barrel's turn × the barrel's seat, the seats read off the MEASURED parts
//     (FUSEE_DIM_MM.seat, held to the parts by probe-technic-fusee);
//   · LEVER (§286) — through a crossing the arm is the span's distance from
//     F's axis, d, and IN THE PLANE the barrel's turn × ρ_b per cone turn is d
//     (five-point differences, 1e-6); off the plane the crossing's posed rise
//     pays cord no lever turns, which is REPORTED;
//   · CONTINUOUS — the departure and both hooks move continuously through
//     every step boundary, and the free span leaves outward (its nearest
//     approach to the cone's axis is the departure);
//   · FLAT — at run-down no wrap is left on the cone and the barrel has turned
//     the spring's whole band;
//   · FILL ORDER (§286) — read off the drawn wraps frame by frame: the wind
//     fills the steps in the exact reverse of the order the run-down emptied
//     them, the base (the largest seat) first, one at a time, none shrinking,
//     and the step the page names is the one growing;
//   · READOUT — the spring's torque and the torque after the cone, at every
//     fuseeRun sample the solve levelled, ARE the samples; the readout's
//     extremes re-derive the solve's spread and the bare spring's, neither
//     retyped;
//   · LOOP — several cycles of loopAdvance at a page frame: the phases run
//     going → winding → full → going in that order and no other; the great
//     wheel turns the going way on EVERY frame, winding included; the band
//     never spends more than half its stretch; each wind ends exactly at full
//     wind; the ratchet stands still while it is wound;
//   · LOCKS — the click's lock and the detent's are read off the teeth
//     (pawlLock), and the loop moves each member only its FREE way: while
//     winding the fusee runs back against the ratchet (the click's free way)
//     and the detent holds the ratchet the way the band pulls it; while going
//     the ratchet runs the going way, which the detent frees, and the click
//     does not slip;
//   · CENTRE PINION (§285) — on every frame, winding included, it turns −40/8
//     of the great wheel's turn, and its teeth stay meshed (the tooth-phase law
//     off both parts) over a whole run-down and wind;
//   · RIDES — each pawl's ride table is seat() from scratch at every sample,
//     touching the teeth and not in them; between samples the interpolated
//     ride is REPORTED (it may graze the teeth by the interpolation's chord).
//
// REPORTED, not gated: the free span's range; the crossing's posed rise (the
// cord its leg pays onto the barrel beyond the arm's turn); the rides between
// samples.
//
// CONTROLS, each seen to fail: §282's law restored (the departure carried round
// on the cone); §282's barrel law (paid/ρ_b, the span held still); a step's seat
// 1% off the part's; the 3D bookkeeping read as the lever; the barrel turned the
// other way; a departure that jumps from step to step with no crossing; a wind
// that lays the top step first; a wind that stops a hair short; the detent's
// ride shifted half a tooth; the click with its band reversed; the readout
// taken from the spring alone; a span drawn through the pulley it leaves; and
// the centre pinion turned at a 40:16's rate.
//
//   node tools/probe-technic-fusee-loop.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary } from '../src/ldraw.js';
import {
  TECHNIC_FUSEE_SPRING, FUSEE_DIM_MM, solveFusee, frameFusee, fuseeBuild, cordPath, cordPlacements, pathLength, spanTangent,
  bandMoment, MAINTAINING, clickSpec, detentSpec, pawlLock, pawlModel, coneTurnTotal, runState, paidAtTurn,
  fuseeLoopModel, loopStart, loopAdvance, loopPose, loopPhaseLine, loopRideSpecs, windSpeedup, LOOP_RUN_S, RECHARGE_SPEEDUP, BAND_LAG_DEG,
  FUSEE_PARTS, FUSEE_CENTRE,
} from '../src/technic-fusee.js';
import { toothPhase } from '../src/technic-ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
const deg = (r) => (r * 180 / Math.PI).toFixed(2);
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ctl = [];
const control = (name, caught) => { ctl.push([name, caught]); };
const F = FUSEE_DIM_MM, TAU = 2 * Math.PI;

console.log('THE LEGO FUSEE\'S LOOP — run down, wind back through the maintaining power (MODELLED; the spring POSED)\n');
const run = solveFusee(TECHNIC_FUSEE_SPRING).best, frame = frameFusee();
const build = fuseeBuild(frame, lib, { run });
const model = fuseeLoopModel(frame, lib, run, build);
const g = model.g, C = run.cordOnCone, rbPart = F.seat[run.barrel];
console.log(`run: cone ${run.steps.join(' > ')} (base first), barrel ${run.barrel}; ${C.toFixed(4)} mm of cord on the cone at full wind, the cone turning ${(model.T / TAU).toFixed(4)} turns over the run`);
console.log(`  display: a run-down in ${LOOP_RUN_S} s at speed 1 (the great wheel's display rate ${model.rate.toFixed(4)} rad/s); the wind ${model.k}× the train (⌈2·T/λ⌉, T ${model.T.toFixed(4)} rad, λ ${BAND_LAG_DEG}°), the recharge ${RECHARGE_SPEEDUP}×`);
if (model.k !== windSpeedup(run) || !(model.T / model.k <= model.lag0 / 2) || !(model.T / (model.k - 1) > model.lag0 / 2)) fail(`the wind's speed-up ${model.k} is not the fewest whole times that spends at most half the band`);

// ── FULL WIND ───────────────────────────────────────────────────────────────
console.log('\nfull wind:');
const p0 = loopPose(model, loopStart());
for (const k of ['phiF', 'phiB', 'phiM', 'phiG', 'phiC', 'psiC', 'psiD']) if (p0[k] !== build.pose[k]) fail(`the loop starts with ${k} ${p0[k]}, the static build has ${build.pose[k]}`);
const sameCord = (c) => JSON.stringify(c.path) === JSON.stringify(build.cord.path) && JSON.stringify(cordPlacements(frame, c)) === JSON.stringify(build.statics.filter((p) => p.role === 'cord' || p.role === 'cordEnd'));
if (p0.paid !== 0 || !sameCord(cordPath(frame, run, { paid: p0.paid }))) fail('the loop\'s cord at its first state is not the static build\'s');
console.log(`  the loop's first state: every body at fuseeBuild's angle exactly, the cord the static build's ${build.cord.path.length} points and ${build.statics.filter((p) => p.role === 'cord').length} segments`);

// ── THE RUN, swept ──────────────────────────────────────────────────────────
console.log('\nthe run (paid off the cone, swept):');
const cum = []; { let s = 0; for (const sg of run.segs) { cum.push(s); s += sg.len; } }
const bounds = run.segs.slice(1).map((sg, i) => C - cum[i + 1]);         // paid at each boundary (laid = start of the upper segment)
const sweep = [...Array.from({ length: 801 }, (_, i) => C * i / 800), ...bounds.flatMap((b) => [b - 1e-7, b + 1e-7])].filter((v) => v >= 0 && v <= C).sort((a, b) => a - b);
const uv = (p, x0 = frame.cd) => [p[0] - x0, -(p[2] - frame.axleZ)];   // frame (x, z) → (u, v) about an axis
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the free span's nearest approach to the cone's axis, in the plane: it must be
// at the last contact itself (the span leaves the pulley outward, never
// through it)
const spanCuts = (c) => {
  const iS = c.mark.find((m) => m.tag === 'span end').i, A = c.path[iS - 1], B = c.path[iS], ax = frame.cd, az = frame.axleZ;
  const dx = B[0] - A[0], dz = B[2] - A[2], t = Math.max(0, Math.min(1, ((ax - A[0]) * dx + (az - A[2]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(A[0] - ax, A[2] - az) - Math.hypot(A[0] + t * dx - ax, A[2] + t * dz - az);
};
// THE DEPARTURE, read off the DRAWN path (its last point on the cone, A, and
// the span's end on the barrel, B), against the open belt's law in the plane:
// the span square to the radius at both ends (|cos|), and A's angle off the
// belt's tangent point for the step's MEASURED seat (on a wrap: float noise)
// or, on a crossing, for the nearer of its two seats (bounded by the belt's
// own turn between them, |α(ρ_j) − α(ρ_k)|, derived — and A's radius between
// the two seats)
const alphaOf = (r) => Math.atan2(spanTangent(frame, r).n[1], spanTangent(frame, r).n[0]);
function departureOf(c, rs) {
  const iS = c.mark.find((m) => m.tag === 'span end').i, A = uv(c.path[iS - 1]), B = uv(c.path[iS], frame.barrel.x);
  const t = [c.path[iS][0] - c.path[iS - 1][0], -(c.path[iS][2] - c.path[iS - 1][2])], tl = Math.hypot(...t);
  const sqA = Math.abs(A[0] * t[0] + A[1] * t[1]) / (Math.hypot(...A) * tl), sqB = Math.abs(B[0] * t[0] + B[1] * t[1]) / (Math.hypot(...B) * tl);
  const aA = Math.atan2(A[1], A[0]), rA = Math.hypot(...A);
  if (rs.kind === 'wrap') {
    const seat = F.seat[run.steps[rs.step]];
    return { sq: Math.max(sqA, sqB), off: Math.abs(wrapAng(aA - alphaOf(seat))), bound: 0, rOff: Math.abs(rA - seat) };
  }
  const hi = F.seat[run.steps[rs.step - 1]], lo = F.seat[run.steps[rs.step]];
  const off = Math.min(Math.abs(wrapAng(aA - alphaOf(hi))), Math.abs(wrapAng(aA - alphaOf(lo))));
  return { sq: Math.max(sqA, sqB), off, bound: Math.abs(wrapAng(alphaOf(hi) - alphaOf(lo))), rOff: Math.max(0, lo - rA, rA - hi) };
}
const STR = build.cord.string;
let worstHook = 0, worstBook = 0, spanLo = Infinity, spanHi = -Infinity, worstCut = 0, worstSq = 0, worstWrapOff = 0, worstCrossOver = -Infinity, worstR = 0, worstLen = 0, worstSag = 0;
const crossBound = [];
for (const paid of sweep) {
  const c = cordPath(frame, run, { paid }), rs = runState(run, paid);
  const phiF = build.pose.phiF + g * rs.turnF, phiB = build.pose.phiB + g * rs.turnB;
  worstHook = Math.max(worstHook, Math.abs(c.aHook - Math.PI / 4 - phiF), Math.abs(c.aEnd - Math.PI / 4 - phiB));
  worstBook = Math.max(worstBook, Math.abs(rs.laid + paid - C));
  worstLen = Math.max(worstLen, Math.abs(c.length - STR.length));
  worstSag = Math.max(worstSag, c.length - c.drawn);
  const iS = c.mark.find((m) => m.tag === 'span end').i, S = pathLength(c.path.slice(iS - 1, iS + 1));
  spanLo = Math.min(spanLo, S); spanHi = Math.max(spanHi, S);
  worstCut = Math.max(worstCut, spanCuts(c));
  const d = departureOf(c, rs);
  worstSq = Math.max(worstSq, d.sq); worstR = Math.max(worstR, d.rOff);
  if (rs.kind === 'wrap') worstWrapOff = Math.max(worstWrapOff, d.off);
  else { worstCrossOver = Math.max(worstCrossOver, d.off - d.bound); crossBound.push(d.bound); }
}
const DEP_TOL = 1e-9;
if (worstSq > DEP_TOL) fail(`the span stands ${worstSq.toExponential(2)} off square to a radius at its departure or its arrival: it does not leave on the tangent`);
if (worstWrapOff > DEP_TOL) fail(`on a wrap the cord leaves its step ${deg(worstWrapOff)}° off the open belt's tangent point for its measured seat`);
if (worstR > DEP_TOL) fail(`the departure stands ${worstR.toExponential(2)} mm off its seat (a wrap) or outside its two seats (a crossing)`);
if (worstCrossOver > 1e-12) fail(`through a crossing the departure stands ${worstCrossOver.toExponential(2)} rad past the belt's own turn between its two seats`);
if (worstHook > 1e-9) fail(`a body's angle and its hook's part ${worstHook.toExponential(2)} rad`);
if (worstBook > 1e-9) fail(`the cord on the cone plus the cord paid misses the run by ${worstBook.toExponential(2)} mm`);
if (worstLen > 1e-9) fail(`the cord's length, arcs counted as arcs, parts from the string's ${STR.length} mm by ${worstLen.toExponential(2)} mm: its length is not conserved`);
if (worstCut > 1e-9) fail(`the free span passes ${worstCut.toFixed(4)} mm inside its last contact's radius: through the pulley it leaves`);
console.log(`  ON THE TANGENT: over ${sweep.length} states, read off the drawn path, the span stands square to the radius at its departure and at its arrival to ${worstSq.toExponential(1)}; on a wrap the departure is the belt's tangent point for the step's measured seat to ${worstWrapOff.toExponential(1)} rad (tol ${DEP_TOL}), on its seat to ${worstR.toExponential(1)} mm; through a crossing it stays within the belt's own turn between the two seats (${deg(Math.max(...crossBound))}°, derived), ${worstCrossOver <= 0 ? 'inside it' : 'PAST it'}`);
console.log(`  LENGTH CONSERVED: the cord, arcs counted as arcs, is the ${STR.part}'s ${STR.length} mm at every state to ${worstLen.toExponential(1)} mm (the polyline drawn short of it by at most ${worstSag.toFixed(4)} mm, its chords' sag)`);
console.log(`  THE SPAN LEAVES OUTWARD: at every state its nearest approach to the cone's axis is its last contact (inside it by ${worstCut.toExponential(1)} mm at worst)`);
{ // CONTROL: the span's end mirrored through the cone's axis, so the span crosses the pulley
  const c = cordPath(frame, run, { paid: C / 2 }), iS = c.mark.find((m) => m.tag === 'span end').i, A = c.path[iS - 1];
  c.path[iS] = [2 * frame.cd - A[0], A[1], 2 * frame.axleZ - A[2]];
  control('a span drawn through the pulley it leaves', spanCuts(c) > 1e-9); }
// CONTROL: §282's law restored — the cone turned by the cord laid over each
// segment's arm (a crossing at the upper step's), the departure the cone's own
// cord carried round — and read through the same gate: it must fail
{ const full = cordPath(frame, run);                                       // the cone's cord at full wind, in laying order
  const iW = full.mark.find((m) => m.tag === 'wrap 0').i, iS = full.mark.find((m) => m.tag === 'span end').i;
  const pts = full.path.slice(iW, iS), at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const oldArm = (sg) => (sg.kind === 'wrap' ? sg.arm : run.rho[sg.step]);
  let worst = 0;
  for (const paid of sweep) {
    const laid = C - paid, rs = runState(run, paid);
    if (rs.kind !== 'wrap' || paid === 0) continue;
    let turn = 0, rem = paid;
    for (let k = run.segs.length - 1; k >= 0 && rem > 0; k--) { const u = Math.min(rem, run.segs[k].len); turn += u / oldArm(run.segs[k]); rem -= u; }
    const s = laid * (at.at(-1) / C), i = Math.max(1, at.findIndex((v) => v >= s - 1e-12)), f = (s - at[i - 1]) / (at[i] - at[i - 1] || 1);
    const p = pts[i - 1].map((v, k) => v + (pts[i][k] - v) * f), q = uv(p), a = Math.atan2(q[1], q[0]) + g * turn;
    worst = Math.max(worst, Math.abs(wrapAng(a - alphaOf(F.seat[run.steps[rs.step]]))));
  }
  console.log(`  CONTROL — §282's law (the cone's own cord carried round, a crossing turned at the upper step's arm): the departure stands ${deg(worst)}° off the tangent on a wrap`);
  control('§282\'s law restored: the departure carried round on the cone', worst > DEP_TOL); }
{ // CONTROL: §282's barrel — turned by the cord paid alone, as if the span stood still — breaks the length
  let worst = 0;
  for (const paid of sweep) { const rs = runState(run, paid); worst = Math.max(worst, Math.abs(paid - frame.barrel.seat * rs.turnB)); }
  control('§282\'s barrel law (paid/ρ_b, the span held still): the cord\'s length is not conserved', worst > 1e-9); }
console.log(`  ANGLES TRAVEL THE PARTS: over ${sweep.length} states the cone's and the barrel's body angles stand on their hooks to ${worstHook.toExponential(1)} rad`);
console.log(`  BOOKKEEPING: on the cone + paid = the run to ${worstBook.toExponential(1)} mm`);

// RATIO: on a wrap the span stands still, so the cone's turn × the step's
// MEASURED seat is the barrel's turn × ρ_b (per segment, two states inside it).
// THE LEVER on a crossing: in the plane the cone and its cord are one body and
// the span its only pull, so the arm is the span's distance from F's axis, d —
// and the plane's own bookkeeping must say so: the barrel's turn × ρ_b per
// cone turn, from the PLANAR cord (the leg √(ρ_j² − d²), the span's len2d and
// the arrival's angle), is d to float noise. Off the plane the leg's posed
// rise pays out cord no lever turns: REPORTED.
function ratioErr(r, seat = F.seat) {
  let worst = 0;
  for (const [i, sg] of r.segs.entries()) {
    if (sg.kind !== 'wrap') continue;
    const a = C - cum[i] - 0.25 * sg.len, b = C - cum[i] - 0.75 * sg.len;   // two states inside the segment (paid)
    const sa = runState(r, a), sb = runState(r, b), arm = seat[r.steps[sg.step]];
    const dF = (sb.turnF - sa.turnF) * arm, dB = (sb.turnB - sa.turnB) * seat[r.barrel];
    worst = Math.max(worst, Math.abs(dF - dB) / Math.abs(dB));
  }
  return worst;
}
const re = ratioErr(run);
if (re > 1e-9) fail(`on a wrap the cone's turn × its step's seat parts from the barrel's × its seat by ${re.toExponential(2)}`);
console.log(`  RATIO: on every wrap the cone's turn × the step's measured seat = the barrel's turn × ${rbPart} mm, to ${re.toExponential(1)} (relative); per step the cone turns ρ_b/ρ = ${run.steps.map((p) => (rbPart / F.seat[p]).toFixed(4)).join(', ')} times the barrel`);
{ const bad = { ...run, segs: run.segs.map((sg) => sg.step === run.steps.length - 1 && sg.kind === 'wrap' ? { ...sg, arm: sg.arm * 1.01 } : sg) };
  control('a step\'s seat 1% off the part\'s', ratioErr(bad) > 1e-9); }
function leverErr(rr, { planar = true } = {}) {
  let worst = 0, excess = 0, turnX = 0;
  for (const [i, sg] of rr.segs.entries()) {
    if (sg.kind !== 'transition') continue;
    const rj = rr.rho[sg.lo], rk = rr.rho[sg.step], b = (d) => spanTangent(frame, d);
    // the planar bookkeeping at a state: cord onto the barrel = cord off the cone (the leg in the plane), less the span's growth, plus the arrival's move
    const leg = (d) => Math.sqrt(Math.max(0, rj * rj - d * d));
    const wound = (rs) => (planar ? -leg(rs.arm) - b(rs.arm).len2d + frame.barrel.seat * g * alphaOf(rs.arm) : frame.barrel.seat * rs.turnB);
    const h = sg.len / 4000, D = (fn, p) => (-fn(p + 2 * h) + 8 * fn(p + h) - 8 * fn(p - h) + fn(p - 2 * h)) / (12 * h);   // five points
    for (let k = 1; k < 200; k++) {
      const p = C - cum[i] - sg.len * k / 200, sm = runState(rr, p);
      const dPsi = D((q) => runState(rr, q).turnF, p), dW = D((q) => wound(runState(rr, q)), p);
      worst = Math.max(worst, Math.abs(dW / dPsi - sm.arm) / sm.arm);
    }
    { const a = runState(rr, C - cum[i]), z = runState(rr, C - cum[i] - sg.len);   // over the whole crossing (paid from its top end to its foot)
      let arm = 0; for (let k = 0; k < 2000; k++) { const p0 = C - cum[i] - sg.len * k / 2000, p1 = C - cum[i] - sg.len * (k + 1) / 2000, s0 = runState(rr, p0), s1 = runState(rr, p1); arm += (s0.arm + s1.arm) / 2 * (s0.turnF - s1.turnF); }
      excess += frame.barrel.seat * (a.turnB - z.turnB) - arm; turnX += a.turnF - z.turnF; }
    void rk;
  }
  return { worst, excess, turnX };
}
const lv = leverErr(run);
if (lv.worst > 1e-6) fail(`through a crossing, in the plane, the barrel's turn × ρ_b per cone turn parts from the arm d by ${lv.worst.toExponential(2)} (relative)`);
console.log(`  LEVER: through a crossing the arm is the span's distance from F's axis, d, running ${run.steps.slice(1).map((p, j) => `${F.seat[p].toFixed(3)} → ${F.seat[run.steps[j]].toFixed(3)}`).join(', ')} mm; in the plane the barrel's turn × ρ_b per cone turn IS d to ${lv.worst.toExponential(1)} (relative, finite differences)`);
console.log(`  REPORTED — the crossing's POSED rise: off the plane its leg pays ${lv.excess.toFixed(3)} mm of cord onto the barrel that no lever turns, over ${deg(lv.turnX)}° of cone turn (${(100 * lv.excess / (TAU * rbPart * run.band)).toFixed(2)}% of the barrel's ${(TAU * rbPart * run.band).toFixed(2)} mm over the band) — work the walls the leg bears on would have to take`);
control('the 3D bookkeeping read as the lever (the posed rise counted as an arm)', leverErr(run, { planar: false }).worst > 1e-6);
{ // the barrel turned the other way: its hook leaves the barrel's plate stud
  const paid = C / 2, c = cordPath(frame, run, { paid }), rs = runState(run, paid);
  control('the barrel turned the other way', Math.abs(c.aEnd - Math.PI / 4 - (build.pose.phiB - g * rs.turnB)) > 1e-9); }

// CONTINUOUS
let worstJump = 0;
const jumpAt = (b, pick) => { const A = pick(b - 1e-7), B = pick(b + 1e-7); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
for (const b of bounds) for (const pick of [(p) => cordPath(frame, run, { paid: p }).departure, (p) => cordPath(frame, run, { paid: p }).path[0], (p) => cordPath(frame, run, { paid: p }).path.at(-1)])
  worstJump = Math.max(worstJump, jumpAt(b, pick));
if (worstJump > 1e-4) fail(`the cord jumps ${worstJump.toFixed(6)} mm at a step boundary`);
console.log(`  CONTINUOUS: through the ${bounds.length * 2} segment boundaries inside the run the departure and both hooks move ${worstJump.toExponential(1)} mm across ±1e-7 mm of cord`);
{ // a departure that jumps from one step's tangent point to the next's, with no crossing between
  const stepDep = (p) => { const rs = runState(run, p), sp = spanTangent(frame, F.seat[run.steps[rs.kind === 'wrap' ? rs.step : rs.step - 1]]); return [frame.cd + sp.pC[0], 0, frame.axleZ - sp.pC[1]]; };
  control('a departure that jumps from step to step (no crossing between)', Math.max(...bounds.map((b) => jumpAt(b, stepDep))) > 1e-4); }

// FLAT
{ const c = cordPath(frame, run, { paid: C }), rs = runState(run, C);
  const wraps = c.mark.filter((m) => /^(wrap|cross)/.test(m.tag)).length;
  if (wraps) fail(`at run-down ${wraps} wraps or crossings are left on the cone`);
  console.log(`  FLAT: at run-down no wrap is on the cone; the barrel has taken ${(rbPart * rs.turnB).toFixed(4)} mm (the cone's ${C.toFixed(4)}, the span ${(run.sBase - run.sTop).toFixed(4)} mm longer, the arrival moved), turned ${(rs.turnB / TAU).toFixed(6)} turns = the spring's band ${run.band.toFixed(6)}`);
  if (Math.abs(rs.turnB / TAU - run.band) > 1e-9) fail(`the barrel's turn over the run ${(rs.turnB / TAU)} is not the table's band ${run.band}`); }
console.log(`  THE FREE SPAN: ${spanLo.toFixed(3)}–${spanHi.toFixed(3)} mm over the run (the string ${STR.length})`);

// FILL ORDER (the owner's "it winds the small wheel before the larger one"):
// read off the DRAWN path, each step's wrap length per state. While the cone is
// wound the steps must fill in the EXACT REVERSE of the order the run-down
// emptied them, the base (the largest seat) first, one at a time, none ever
// shrinking — and the step the page lights and the phase line names (the
// state's step) is the one growing.
const wrapLens = (c) => {
  const out = run.steps.map(() => 0), ms = [...c.mark].sort((a, b) => a.i - b.i);
  for (const [k, m] of ms.entries()) {
    const w = /^wrap (\d+)$/.exec(m.tag); if (!w) continue;
    // the wrap as the arc it is: its points' turn about F × the seat (a polyline's chord count steps as it grows)
    const pts = c.path.slice(m.i, (ms[k + 1]?.i ?? c.path.length - 1) + 1).filter((p) => Math.abs(Math.hypot(...uv(p)) - frame.fusee.steps[Number(w[1])].seat) < 1e-9);
    let ang = 0; for (let i = 1; i < pts.length; i++) ang += Math.abs(wrapAng(Math.atan2(uv(pts[i])[1], uv(pts[i])[0]) - Math.atan2(uv(pts[i - 1])[1], uv(pts[i - 1])[0])));
    out[Number(w[1])] = ang * frame.fusee.steps[Number(w[1])].seat;
  }
  return out;
};
function fillOrder(frames) {   // frames: [{ lens, step }] in time order
  const order = [], errs = [];
  for (let f = 1; f < frames.length; f++) {
    const grow = frames[f].lens.map((v, j) => v - frames[f - 1].lens[j]);
    if (grow.some((v) => v < -1e-9)) errs.push(`frame ${f}: a step's wrap shrank while it was wound`);
    const up = grow.map((v, j) => (v > 1e-9 ? j : -1)).filter((j) => j >= 0);
    if (up.length > 1) errs.push(`frame ${f}: ${up.length} steps grew at once`);
    for (const j of up) { if (!order.includes(j)) order.push(j); if (frames[f].step !== null && frames[f].step !== j) errs.push(`frame ${f}: step ${j + 1} grew, the page names step ${frames[f].step + 1}`); }
  }
  return { order, errs };
}
function emptyOrder(frames) {
  const order = [];
  for (const fr of frames) fr.lens.forEach((v, j) => { if (v <= 1e-9 && !order.includes(j) && frames[0].lens[j] > 0) order.push(j); });
  return order;
}
const largestFirst = run.steps.map((p, j) => [F.seat[p], j]).sort((a, b) => b[0] - a[0]).map(([, j]) => j);
const fillVerdict = (wind, down) => {
  const errs = [...wind.errs];
  if (JSON.stringify(wind.order) !== JSON.stringify([...down].reverse())) errs.push(`the wind filled steps ${wind.order.map((j) => j + 1).join(', ')}; the run-down emptied ${down.map((j) => j + 1).join(', ')}`);
  if (wind.order[0] !== largestFirst[0]) errs.push(`the wind filled step ${wind.order[0] + 1} (seat ${F.seat[run.steps[wind.order[0]]]}) first, not the base (seat ${F.seat[run.steps[largestFirst[0]]]})`);
  return errs;
};
const FILL = { wind: [], down: [] };   // filled by runLoop on the real loop's frames
// ── READOUT ─────────────────────────────────────────────────────────────────
console.log('\nreadout (the spring\'s torque and the torque after the cone; the table POSED):');
let worstS = 0, lo = Infinity, hi = -Infinity;
let si = 0;
for (const [i, sg] of run.segs.entries()) for (let k = 0; k <= 64; k++, si++) {
  const smp = run.samples[si], laid = cum[i] + sg.len * k / 64;
  const nudge = k === 0 ? 1e-9 : k === 64 ? -1e-9 : 0;                     // the segment's own side of a boundary
  const rs = runState(run, C - (laid + nudge));
  if (k > 0 && k < 64) worstS = Math.max(worstS, Math.abs(rs.P - smp.P) / smp.P, Math.abs(rs.M - smp.M) / smp.M);
  lo = Math.min(lo, rs.P); hi = Math.max(hi, rs.P);
}
const spreadRe = (hi - lo) / run.mean;
const full = runState(run, 0), flat = runState(run, C);
const bareRe = (full.M - flat.M) / ((full.M + flat.M) / 2);
if (worstS > 1e-9) fail(`the readout parts from fuseeRun's samples by ${worstS.toExponential(2)}`);
if (Math.abs(spreadRe - run.spread) > 1e-6) fail(`the readout's extremes give a spread of ${spreadRe}, the solve's is ${run.spread}`);
if (Math.abs(bareRe - run.bare) > 1e-9) fail(`the spring's readout runs ${bareRe}, the bare spread is ${run.bare}`);
console.log(`  at every interior sample of fuseeRun the readout IS the sample, to ${worstS.toExponential(1)}; its extremes ${lo.toFixed(4)}–${hi.toFixed(4)} over the mean ${run.mean.toFixed(4)} give ${(spreadRe * 100).toFixed(2)}% (the solve: ${(run.spread * 100).toFixed(2)}%); the spring alone ${(bareRe * 100).toFixed(2)}% (bare: ${(run.bare * 100).toFixed(2)}%)`);
console.log(`  as the page shows them, a fraction of full wind: the spring ${(flat.M / full.M).toFixed(4)} at run-down; after the cone ${(lo / full.P).toFixed(4)}–${(hi / full.P).toFixed(4)}`);
control('the readout taken from the spring alone', Math.abs(bareRe - run.spread) > 1e-6);

// ── LOCKS ───────────────────────────────────────────────────────────────────
console.log('\nlocks (read off the teeth):');
const clickLock = pawlLock(lib, clickSpec(MAINTAINING.click.sense), 16).locks;
const detentLock = pawlLock(lib, detentSpec(MAINTAINING.detent.pivot, MAINTAINING.detent.sense), 40).locks;
const clickRev = pawlLock(lib, clickSpec(-MAINTAINING.click.sense), 16).locks;
const band = bandMoment(g);
console.log(`  click locks ${clickLock > 0 ? '+' : '−'}, detent locks ${detentLock > 0 ? '+' : '−'}; the going sense ${g > 0 ? '+' : '−'}; the band pulls the ratchet ${band.ratchet > 0 ? '+' : '−'} and turns the great wheel ${band.great > 0 ? '+' : '−'}`);

// ── LOOP ────────────────────────────────────────────────────────────────────
console.log('\nloop (loopAdvance at 60 frames a second, speed 1):');
function runLoop(m, { frames = Math.ceil(3.2 * (LOOP_RUN_S + LOOP_RUN_S / m.k + 2) * 60), cut = 0, clickLk = clickLock, fill = null } = {}) {
  const errs = [], seq = [];
  let st = loopStart(), prev = loopPose(m, st), lagLo = Infinity, winds = 0, gMin = Infinity, fullAt = [];
  const a = m.rate / 60;
  for (let f = 0; f < frames; f++) {
    const nx = loopAdvance(m, st, a);
    const p = loopPose(m, nx);
    if (seq.at(-1) !== nx.phase) seq.push(nx.phase);
    // the first run-down and the first wind, each frame's drawn wraps (FILL ORDER)
    if (fill && nx.cycle === 0 && nx.phase !== 'full') (nx.phase === 'winding' ? fill.wind : fill.down).push({ lens: wrapLens(cordPath(frame, run, { paid: p.paid })), step: p.state.kind === 'wrap' ? p.state.step : null });
    const dG = g * (p.phiG - prev.phiG), dM = g * (p.phiM - prev.phiM), dF = g * (p.phiF - prev.phiF), dRel = g * ((p.phiF - p.phiM) - (prev.phiF - prev.phiM));
    gMin = Math.min(gMin, dG);
    if (!(dG > 0)) errs.push(`frame ${f}: the great wheel did not turn the going way (${dG})`);
    lagLo = Math.min(lagLo, p.lag);
    if (p.lag < m.lag0 / 2 - 1e-12 || p.lag > m.lag0 + 1e-12) errs.push(`frame ${f}: the band's stretch ${deg(p.lag)}° is outside its half to its whole`);
    if (p.paid < 0 || p.paid > C + 1e-12) errs.push(`frame ${f}: ${p.paid} mm paid, outside the run`);
    if (st.phase === 'winding' && nx.phase === 'winding') {
      if (dM !== 0) errs.push(`frame ${f}: the ratchet moved while it was wound`);
      if (!(dF < 0)) errs.push(`frame ${f}: the fusee did not run back while it was wound`);
      if (Math.sign(dRel) !== -clickLk * g) errs.push(`frame ${f}: the fusee runs back against the ratchet the way the click LOCKS`);
      if (detentLock !== band.ratchet) errs.push(`frame ${f}: the detent does not lock the way the band pulls the ratchet`);
    }
    if (st.phase !== 'winding' && nx.phase !== 'winding') {
      if (Math.abs(dRel) > 1e-12) errs.push(`frame ${f}: the click slipped while the fusee drove`);
      if (detentLock === g) errs.push(`frame ${f}: the ratchet runs the going way, which the detent locks`);
    }
    if (st.phase === 'winding' && nx.phase === 'full') {
      // the state the wind ends on: this frame's advance stopped exactly at
      // the wind's boundary (the rest of the frame carries on into FULL)
      winds++;
      let end = loopAdvance(m, st, st.turnF / m.k);
      if (cut) end = { ...end, turnF: cut };                                  // CONTROL: a wind that stops short
      const q = loopPose(m, end);
      if (end.phase !== 'full' || end.turnF !== 0 || q.paid !== 0 || q.phiF !== build.pose.phiF) errs.push(`frame ${f}: the wind ended at ${q.paid} mm paid, the fusee at ${q.phiF}, not full wind`);
      else fullAt.push(f);
      if (!sameCord(cordPath(frame, run, { paid: q.paid }))) errs.push(`frame ${f}: the cord at the wind's end is not the static build's`);
    }
    st = nx; prev = p;
  }
  const want = ['going', 'winding', 'full'];
  if (!seq.every((s, i) => s === want[i % 3])) errs.push(`the phases ran ${seq.join(' → ')}`);
  if (winds < 3) errs.push(`only ${winds} winds in ${frames} frames`);
  return { errs, seq, lagLo, winds, gMin, fullAt };
}
// §285 — THE CENTRE PINION rides the great wheel: on every frame, winding
// included (the maintaining power carries it too), it turns −40/n of the great
// wheel's turn, and its teeth stay in mesh — the residue of
// 40·(φG + tG) + n·(φC + tC − π) ≡ π, each tooth phase t read off its part
// (toothPhase), the build probe's law, held at its 1e-3 of a turn
const tG = toothPhase(lib, FUSEE_PARTS.greatWheel, 40).theta;
function centreErrs(m, frames = Math.ceil((LOOP_RUN_S + LOOP_RUN_S / m.k + 2) * 60)) {
  const errs = [], tC = toothPhase(lib, m.frame.centre.part, FUSEE_CENTRE.teeth).theta;
  let st = loopStart(), prev = loopPose(m, st), worstR = 0, worstM = 0;
  for (let f = 0; f < frames; f++) {
    st = loopAdvance(m, st, m.rate / 60);
    const p = loopPose(m, st), dG = p.phiG - prev.phiG, dC = p.phiC - prev.phiC;
    worstR = Math.max(worstR, Math.abs(dC + 40 / FUSEE_CENTRE.teeth * dG));
    const r = (((40 * (p.phiG + tG) + FUSEE_CENTRE.teeth * (p.phiC + tC - Math.PI) - Math.PI) % TAU) + TAU) % TAU / TAU;
    worstM = Math.max(worstM, Math.min(r, 1 - r));
    prev = p;
  }
  if (worstR > 1e-12) errs.push(`the centre pinion parts from −${40 / FUSEE_CENTRE.teeth}× the great wheel's turn by ${worstR.toExponential(2)} rad a frame`);
  if (worstM > 1e-3) errs.push(`the centre pinion's teeth stand ${worstM.toFixed(4)} of a turn off mesh`);
  return { errs, worstR, worstM };
}
{ const c = centreErrs(model);
  for (const e of c.errs) fail(e);
  console.log(`  centre pinion (§285): over a whole run-down and wind it turns −${40 / FUSEE_CENTRE.teeth}× the great wheel on every frame to ${c.worstR.toExponential(1)} rad, its teeth in mesh to ${c.worstM.toExponential(1)} of a turn (tol 1e-3)`);
  control('the centre pinion turned at the 40:16\'s rate', centreErrs({ ...model, frame: { ...model.frame, centre: { ...model.frame.centre, teeth: 16 } } }).errs.length > 0); }
const L = runLoop(model, { fill: FILL });
for (const e of L.errs.slice(0, 8)) fail(e);
if (L.errs.length > 8) fail(`… and ${L.errs.length - 8} more`);
console.log(`  phases: ${L.seq.slice(0, 7).join(' → ')}…; ${L.winds} winds, each ending exactly at full wind (the static build's cord); the great wheel the going way on every frame (at least ${deg(L.gMin)}° a frame), the band never under ${deg(L.lagLo)}° of its ${BAND_LAG_DEG}°`);
{ const lines = new Set(); let st = loopStart();
  for (let f = 0; f < (LOOP_RUN_S + 3) * 60; f++) { st = loopAdvance(model, st, model.rate / 60); lines.add(loopPhaseLine(model, loopPose(model, st))); }
  console.log(`  the phase line reads, in turn: ${[...lines].map((l) => `"${l}"`).join(', ')}`);
  if (lines.size !== 2 * run.segs.length + 1) fail(`the phase line said ${lines.size} things, the run has ${run.segs.length} segments each way and the full phase`); }
// FILL ORDER, gated on the loop's own frames, and its control: the same wind's
// cord laid top step first (each step's full wrap, in the run-down's order)
{ const fullLens = wrapLens(build.cord);
  const flat = { lens: wrapLens(cordPath(frame, run, { paid: C })), step: null };   // run-down: the state the wind starts from
  FILL.down.push(flat); FILL.wind.unshift(flat);
  FILL.down.unshift({ lens: fullLens, step: null });
  const down = emptyOrder(FILL.down), wind = fillOrder(FILL.wind), errs = fillVerdict(wind, down);
  for (const e of errs.slice(0, 6)) fail(`fill order: ${e}`);
  console.log(`  FILL ORDER (read off the drawn wraps, ${FILL.down.length} run-down and ${FILL.wind.length} wind frames): the run-down empties step${down.length > 1 ? 's' : ''} ${down.map((j) => `${j + 1} (${run.steps[j]}, seat ${F.seat[run.steps[j]]})`).join(' then ')}; the wind fills ${wind.order.map((j) => `${j + 1} (${run.steps[j]})`).join(' then ')} — the base, the largest seat, first, one step at a time, none shrinking, the step named on the page the one growing`);
  const topFirst = FILL.wind.map((fr) => { let left = fr.lens.reduce((a, b) => a + b, 0); const lens = run.steps.map(() => 0); for (let j = run.steps.length - 1; j >= 0; j--) { lens[j] = Math.min(left, fullLens[j]); left -= lens[j]; } return { lens, step: null }; });
  control('a wind that lays the top step first', fillVerdict(fillOrder(topFirst), down).length > 0); }
control('a wind that stops a hair short', runLoop(model, { cut: 1e-9 }).errs.length > 0);
control('the click with its band reversed (it locks the way the wind turns it)', clickRev !== clickLock && runLoop(model, { clickLk: clickRev, frames: Math.ceil((LOOP_RUN_S + 2) * 60) }).errs.length > 0);

// ── RIDES ───────────────────────────────────────────────────────────────────
console.log('\npawl rides (the seat the band drops each 8T to, at each wheel angle; posed bands, measured teeth):');
function rideErrs(ride, { shift = 0 } = {}) {
  const errs = [], m = ride.model;
  let worstSeat = 0, worstMid = -Infinity, worstIn = -Infinity;
  for (let i = 0; i <= ride.n; i++) {
    const th = ride.theta0 + i * ride.pitch / ride.n, psi = ride.at(th + shift);
    if (!shift) worstSeat = Math.max(worstSeat, Math.abs(m.seat(th) - ride.table[i]));
    const d = m.depth(psi, th);
    worstIn = Math.max(worstIn, d);
    if (d > 1e-9) errs.push(`at ${deg(th)}° the 8T stands ${d.toFixed(4)} mm in the teeth`);
    if (!shift && d < -0.01) errs.push(`at ${deg(th)}° the 8T stands ${(-d).toFixed(4)} mm off the teeth`);
    if (i < ride.n) worstMid = Math.max(worstMid, m.depth(ride.at(th + ride.pitch / ride.n / 2), th + ride.pitch / ride.n / 2));
  }
  if (!shift && worstSeat > 1e-9) errs.push(`the table parts from seat() by ${worstSeat.toExponential(2)} rad`);
  return { errs, worstSeat, worstMid, worstIn };
}
const specs = loopRideSpecs(build);
for (const [name, ride] of Object.entries(model.rides)) {
  const r = rideErrs(ride);
  for (const e of r.errs.slice(0, 4)) fail(`${name}: ${e}`);
  console.log(`  ${name}: ${ride.n} samples over a ${specs[name].teeth}T pitch, each seat() to ${r.worstSeat.toExponential(1)} rad, touching (the deepest ${r.worstIn.toExponential(1)} mm); REPORTED between samples: the interpolated 8T ${r.worstMid > 0 ? `grazes ${r.worstMid.toFixed(4)} mm into` : `stands ${(-r.worstMid).toFixed(4)} mm off`} the teeth at worst; one pitch on it stands ${deg(Math.abs(ride.table[ride.n] - ride.table[0]))}° from where it began`);
}
control('the detent\'s ride shifted half a tooth', rideErrs(model.rides.detent, { shift: model.rides.detent.pitch / 2 }).errs.length > 0);

console.log('\ncontrols:');
for (const [n, ok] of ctl) { console.log(`  ${ok ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!ok) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nthe cord runs down the ${run.steps.length} steps and winds back to the static build exactly; after the cone the torque spreads ${(run.spread * 100).toFixed(2)}% where the spring's spreads ${(run.bare * 100).toFixed(2)}%, on a POSED law; and while it is wound the great wheel keeps turning, carried by the maintaining band`);
process.exit(fails ? 1 : 0);
