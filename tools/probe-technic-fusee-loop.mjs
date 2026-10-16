// DOES THE LEGO FUSEE'S LOOP RUN DOWN AND WIND BACK BY THE MODULE'S OWN LAWS —
// the cord off the cone a step at a time and onto the barrel, the two turning
// at the step's ratio, the maintaining power carrying the great wheel while it
// is wound, and the torque readout the solve's own level product? Acceptance,
// pure Node, no browser, no network; exits non-zero on any failure. BUILT §282
// (src/technic-fusee.js, the loop technic.html runs).
//
// MODELLED, NOT SIMULATED: the loop advances nothing by a force. Its one rate
// is the great wheel's, a DISPLAY rate standing in for an escapement this
// module does not build; every other angle is read from the state through the
// parts' laws, and the spring's torque is the POSED table's.
//
//   · FULL WIND — the loop's first state, and every state a wind ends on, is
//     the static build exactly: every body's angle fuseeBuild's, the cord the
//     same path point for point;
//   · ANGLES TRAVEL THE PARTS — at every sampled state the cone's and the
//     barrel's body angles are the angles the cord's two HOOKS stand at
//     (cordPath at that state), so the bodies and the cord are one reading;
//   · RATIO — on every segment of the run the cone's turn × that segment's arm
//     equals the barrel's turn × the barrel's seat, the arms read off the
//     MEASURED seats (FUSEE_DIM_MM.seat, held to the parts by
//     probe-technic-fusee), not off the solve's copy of them;
//   · BOOKKEEPING — the cord still on the cone plus the cord the barrel has
//     taken is constant: analytically to float noise, and on the drawn path
//     within its chords' sag;
//   · CONTINUOUS — the cord's last contact on the cone, and both hooks, move
//     continuously through every step boundary, and the free span leaves it
//     outward (its nearest approach to the cone's axis is that contact);
//   · FLAT — at run-down no wrap is left on the cone and the barrel has taken
//     the whole run, cordOnCone/ρ_b of a turn;
//   · READOUT — the spring's torque and the torque after the cone, at every
//     fuseeRun sample the solve levelled, ARE the samples; the readout's
//     extremes re-derive the solve's spread (31.6% since §284) and the bare spring's
//     (51.6%), neither retyped;
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
//   · CENTRE PINION (§284) — on every frame, winding included, it turns −40/8
//     of the great wheel's turn, and its teeth stay meshed (the tooth-phase law
//     off both parts) over a whole run-down and wind;
//   · RIDES — each pawl's ride table is seat() from scratch at every sample,
//     touching the teeth and not in them; between samples the interpolated
//     ride is REPORTED (it may graze the teeth by the interpolation's chord).
//
// REPORTED, not gated: the FREE SPAN. fuseeRun turns the barrel by the cord
// laid on the cone alone, as if the span stood still, and lets a crossing turn
// the cone at the upper step's arm; the cord carried round on the cone then
// leaves the base step off the open belt's tangent, and the span shortens.
// Both are printed — the solve's simplification, made visible.
//
// CONTROLS, each seen to fail: a step's seat 1% off the part's; the barrel
// turned the other way; a departure taken from the tangent law instead of the
// cone's own cord (it jumps at the crossing); a wind that stops a hair short;
// the detent's ride shifted half a tooth; the click with its band reversed;
// the readout taken from the spring alone (the bare spread, not the solve's);
// a span drawn through the pulley it leaves; and the centre pinion turned at a
// 40:16's rate.
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
const sweep = [...Array.from({ length: 401 }, (_, i) => C * i / 400), ...bounds.flatMap((b) => [b - 1e-7, b + 1e-7])].filter((v) => v >= 0 && v <= C).sort((a, b) => a - b);
const wrapped = (c) => {   // the cord on the cone (the base wrap's start to the last contact) and on the barrel (the span's end to the dead wrap's end)
  const iSpan = c.mark.find((m) => m.tag === 'span end').i, iHook = c.mark.find((m) => m.tag === 'barrel hook').i, w = c.mark.find((m) => m.tag === 'wrap 0');
  return { cone: w ? pathLength(c.path.slice(w.i, iSpan)) : 0, barrel: pathLength(c.path.slice(iSpan, iHook - 1)), span: pathLength(c.path.slice(iSpan - 1, iSpan + 1)) };
};
// the free span's nearest approach to the cone's axis, in the plane: it must be
// at the last contact itself (the span leaves the pulley outward, never
// through it)
const spanCuts = (c) => {
  const iS = c.mark.find((m) => m.tag === 'span end').i, A = c.path[iS - 1], B = c.path[iS], ax = frame.cd, az = frame.axleZ;
  const dx = B[0] - A[0], dz = B[2] - A[2], t = Math.max(0, Math.min(1, ((ax - A[0]) * dx + (az - A[2]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(A[0] - ax, A[2] - az) - Math.hypot(A[0] + t * dx - ax, A[2] + t * dz - az);
};
const w0 = wrapped(build.cord);
let worstHook = 0, worstBook = 0, worstPoly = 0, spanLo = Infinity, spanHi = -Infinity, worstCut = 0;
const off = [];
for (const paid of sweep) {
  const c = cordPath(frame, run, { paid }), rs = runState(run, paid);
  const phiF = build.pose.phiF + g * rs.turnF, phiB = build.pose.phiB + g * paid / rbPart;
  worstHook = Math.max(worstHook, Math.abs(c.aHook - Math.PI / 4 - phiF), Math.abs(c.aEnd - Math.PI / 4 - phiB));
  worstBook = Math.max(worstBook, Math.abs(rs.laid + paid - C));
  const w = wrapped(c);
  worstPoly = Math.max(worstPoly, Math.abs(w.cone + w.barrel - (w0.cone + w0.barrel)));
  spanLo = Math.min(spanLo, w.span); spanHi = Math.max(spanHi, w.span);
  worstCut = Math.max(worstCut, spanCuts(c));
  // the departure's angle off the open belt's tangent for the step it leaves
  const d = c.departure, ang = Math.atan2(-(d[2] - frame.axleZ), d[0] - frame.cd), tn = spanTangent(frame, rs.arm).n;
  off.push({ paid, step: rs.step, kind: rs.kind, off: Math.atan2(Math.sin(ang - Math.atan2(tn[1], tn[0])), Math.cos(ang - Math.atan2(tn[1], tn[0]))) });
}
if (worstHook > 1e-9) fail(`a body's angle and its hook's part ${worstHook.toExponential(2)} rad`);
if (worstBook > 1e-9) fail(`the cord on the cone plus the cord paid misses the run by ${worstBook.toExponential(2)} mm`);
if (worstPoly > 0.05) fail(`the drawn cord on the cone and on the barrel misses its full-wind sum by ${worstPoly.toFixed(4)} mm`);
if (worstCut > 1e-9) fail(`the free span passes ${worstCut.toFixed(4)} mm inside its last contact's radius: through the pulley it leaves`);
console.log(`  THE SPAN LEAVES OUTWARD: at every state its nearest approach to the cone's axis is its last contact (inside it by ${worstCut.toExponential(1)} mm at worst)`);
{ // CONTROL: the span's end mirrored through the cone's axis, so the span crosses the pulley
  const c = cordPath(frame, run, { paid: C / 2 }), iS = c.mark.find((m) => m.tag === 'span end').i, A = c.path[iS - 1];
  c.path[iS] = [2 * frame.cd - A[0], A[1], 2 * frame.axleZ - A[2]];
  control('a span drawn through the pulley it leaves', spanCuts(c) > 1e-9); }
console.log(`  ANGLES TRAVEL THE PARTS: over ${sweep.length} states the cone's and the barrel's body angles stand on their hooks to ${worstHook.toExponential(1)} rad`);
console.log(`  BOOKKEEPING: on the cone + paid = the run to ${worstBook.toExponential(1)} mm; the drawn cone and barrel wraps keep their sum to ${worstPoly.toFixed(4)} mm (the chords' sag)`);

// RATIO: per segment, at the MEASURED seats
function ratioErr(r, seat = F.seat) {
  let worst = 0;
  for (const [i, sg] of r.segs.entries()) {
    const a = C - cum[i] - 0.25 * sg.len, b = C - cum[i] - 0.75 * sg.len;   // two states inside the segment (paid)
    const sa = runState(r, a), sb = runState(r, b);
    const arm = seat[r.steps[sg.step]];                                     // a crossing turns the cone at the upper step's arm (fuseeRun)
    const dF = (sb.turnF - sa.turnF) * arm, dB = (b - a) / seat[r.barrel] * seat[r.barrel];
    worst = Math.max(worst, Math.abs(dF - dB) / Math.abs(dB));
  }
  return worst;
}
const re = ratioErr(run);
if (re > 1e-9) fail(`the cone's turn × its step's seat parts from the barrel's × its seat by ${re.toExponential(2)}`);
console.log(`  RATIO: on every segment the cone's turn × the step's measured seat = the barrel's turn × ${rbPart} mm, to ${re.toExponential(1)} (relative); per step the cone turns ρ_b/ρ = ${run.steps.map((p) => (rbPart / F.seat[p]).toFixed(4)).join(', ')} times the barrel`);
{ const bad = { ...run, segs: run.segs.map((sg) => sg.step === run.steps.length - 1 ? { ...sg, arm: sg.arm * 1.01 } : sg) };
  control('a step\'s seat 1% off the part\'s', ratioErr(bad) > 1e-9); }
{ // the barrel turned the other way: its hook leaves the barrel's plate stud
  const paid = C / 2, c = cordPath(frame, run, { paid });
  control('the barrel turned the other way', Math.abs(c.aEnd - Math.PI / 4 - (build.pose.phiB - g * paid / rbPart)) > 1e-9); }

// CONTINUOUS
let worstJump = 0;
const jumpAt = (b, pick) => { const A = pick(b - 1e-7), B = pick(b + 1e-7); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
for (const b of bounds) for (const pick of [(p) => cordPath(frame, run, { paid: p }).departure, (p) => cordPath(frame, run, { paid: p }).path[0], (p) => cordPath(frame, run, { paid: p }).path.at(-1)])
  worstJump = Math.max(worstJump, jumpAt(b, pick));
if (worstJump > 1e-4) fail(`the cord jumps ${worstJump.toFixed(6)} mm at a step boundary`);
console.log(`  CONTINUOUS: through the ${bounds.length * 2} segment boundaries inside the run the last contact on the cone and both hooks move ${worstJump.toExponential(1)} mm across ±1e-7 mm of cord`);
{ // the tangent law's departure: the open belt's tangent point for whichever step the cord is leaving
  const tangentDep = (p) => { const rs = runState(run, p), sp = spanTangent(frame, rs.arm); return [frame.cd + sp.pC[0], 0, frame.axleZ - sp.pC[1]]; };
  const jumpAtSteps = Math.max(...run.segs.map((sg, i) => i).filter((i) => i > 0 && run.segs[i].arm !== run.segs[i - 1].arm).map((i) => jumpAt(C - cum[i], tangentDep)));
  control('a departure taken from the tangent law (it jumps where the arm changes)', jumpAtSteps > 1e-4); }

// FLAT
{ const c = cordPath(frame, run, { paid: C }), rs = runState(run, C);
  const wraps = c.mark.filter((m) => /^(wrap|cross)/.test(m.tag)).length, w = wrapped(c);
  if (wraps) fail(`at run-down ${wraps} wraps or crossings are left on the cone`);
  if (Math.abs(rs.turnB / TAU - C / (TAU * rbPart)) > 1e-12 || Math.abs(w.barrel - w0.barrel - C) > 0.05) fail(`at run-down the barrel has taken ${(w.barrel - w0.barrel).toFixed(4)} mm, the run is ${C.toFixed(4)}`);
  console.log(`  FLAT: at run-down no wrap is on the cone; the barrel has taken ${(w.barrel - w0.barrel).toFixed(4)} mm (the run ${C.toFixed(4)}), turned ${(rs.turnB / TAU).toFixed(4)} turns = the spring's band ${run.band.toFixed(4)}`);
  if (Math.abs(rs.turnB / TAU - run.band) > 1e-9) fail(`the barrel's turn over the run ${(rs.turnB / TAU)} is not the table's band ${run.band}`); }

// REPORTED: the free span and the departure off the tangent
console.log(`  REPORTED — THE FREE SPAN: ${spanLo.toFixed(3)}–${spanHi.toFixed(3)} mm over the run (${(spanHi - spanLo).toFixed(3)} mm, the string ${build.cord.string.length}); fuseeRun holds it still`);
for (const [i, sg] of run.segs.entries()) {
  const rows = off.filter((o) => o.paid < C - cum[i] - 1e-6 && o.paid > C - cum[i] - sg.len + 1e-6);
  if (rows.length) console.log(`    ${sg.kind} on ${run.steps[sg.step]}: the last contact stands ${deg(Math.min(...rows.map((o) => o.off)))}° to ${deg(Math.max(...rows.map((o) => o.off)))}° off the open belt's tangent`);
}

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
function runLoop(m, { frames = Math.ceil(3.2 * (LOOP_RUN_S + LOOP_RUN_S / m.k + 2) * 60), cut = 0, clickLk = clickLock } = {}) {
  const errs = [], seq = [];
  let st = loopStart(), prev = loopPose(m, st), lagLo = Infinity, winds = 0, gMin = Infinity, fullAt = [];
  const a = m.rate / 60;
  for (let f = 0; f < frames; f++) {
    const nx = loopAdvance(m, st, a);
    const p = loopPose(m, nx);
    if (seq.at(-1) !== nx.phase) seq.push(nx.phase);
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
// §284 — THE CENTRE PINION rides the great wheel: on every frame, winding
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
  console.log(`  centre pinion (§284): over a whole run-down and wind it turns −${40 / FUSEE_CENTRE.teeth}× the great wheel on every frame to ${c.worstR.toExponential(1)} rad, its teeth in mesh to ${c.worstM.toExponential(1)} of a turn (tol 1e-3)`);
  control('the centre pinion turned at the 40:16\'s rate', centreErrs({ ...model, frame: { ...model.frame, centre: { ...model.frame.centre, teeth: 16 } } }).errs.length > 0); }
const L = runLoop(model);
for (const e of L.errs.slice(0, 8)) fail(e);
if (L.errs.length > 8) fail(`… and ${L.errs.length - 8} more`);
console.log(`  phases: ${L.seq.slice(0, 7).join(' → ')}…; ${L.winds} winds, each ending exactly at full wind (the static build's cord); the great wheel the going way on every frame (at least ${deg(L.gMin)}° a frame), the band never under ${deg(L.lagLo)}° of its ${BAND_LAG_DEG}°`);
{ const lines = new Set(); let st = loopStart();
  for (let f = 0; f < (LOOP_RUN_S + 3) * 60; f++) { st = loopAdvance(model, st, model.rate / 60); lines.add(loopPhaseLine(model, loopPose(model, st))); }
  console.log(`  the phase line reads, in turn: ${[...lines].map((l) => `"${l}"`).join(', ')}`);
  if (lines.size !== run.segs.length + 2) fail(`the phase line said ${lines.size} things, the run has ${run.segs.length} segments and two other phases`); }
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
