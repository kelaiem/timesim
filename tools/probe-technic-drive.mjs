// IS THE LEGO GOING TRAIN'S ESCAPEMENT DRIVEN BY ITS SPRING LAW, AND ONLY BY IT: THE TORQUE CARRIED TO THE ESCAPE
// ARBOR BY IDENTITIES, THE BALANCE'S EQUATION OF MOTION THE PENDULUM'S WHEN NOTHING DRIVES IT, ITS ENERGY BOOKS
// CLOSED, ITS PERIOD RISING WITH ITS SWING, THE DRIVE'S SIZE AND THE RATING NUT'S PLACE THE SOLVE'S, AND THE NUT
// MOVING THE RATE BY WHAT ITS INERTIA SAYS? Acceptance, pure Node, no browser, no network; exits non-zero on any
// failed row. BUILT §316 (src/technic-drive.js). It reads the going train's own escapement frame (§315's
// escapementFor, the rating rod on its bob) and the fusee's solved run.
//
//   · FRICTION — TECHNIC_DRIVE_FRICTION is three corners, ordered (favourable ≥ nominal ≥ adverse) in each band,
//     each band with its source: a coefficient nothing here measures lives only as a band.
//   · TABLE — the widest swing whose drops are the posed swing's (`tableSwing`) is TECHNIC_DRIVE.tableDeg, and its
//     trace is a hundredth of a degree of the anchor a step (traceSteps).
//   · TORQUE — at every sample of the run, the escape torque is Munit · M · arm / ρ_b · η^n / ratio (the level
//     product P = M × arm read back, the barrel's seat, the meshes, the train) at float noise; and the spring law is
//     the ONLY source: the table's torque doubled doubles every escape torque exactly.
//   · MOTION — with no drive the equation of motion is the pendulum: at 0.1° its period is 2π √(I / m g d) and at
//     3°, 5° and 8° the elliptic integral's (`periodAt`), each to 1e-5; driven, its energy books close (the
//     escapement's work, through the pallets' friction, against the balance's energy) to the step's own error —
//     ω·h of the energy — and closer at half the step.
//   · PERIOD AGAINST AMPLITUDE — off the driven cycle (every period of the swing's approach to its own, from starts
//     1.5° to 8°), binned by a quarter degree: the period RISES with the swing. Why: the pendulum's own circular
//     error rises with it (T₀ (1 + A²/16 + …)), and the anchor's recoil — a push back against the swing just after
//     each catch, which the balance feels as a stiffer spring — is a smaller share of a wider swing, so the
//     escapement's (negative) error shrinks as the swing grows. Both effects push the same way.
//   · SOLVE — solveDrive re-solved on each generation's train: the escape torque's ceiling and the nut's place are
//     TECHNIC_DRIVE's (to the solve's own round-to-round spread, doubled, at least 1% and 0.05 mm); the nominal corner
//     holds a swing; every corner's swing, period and status reported; the lock against a hand reported, and held
//     over 1 (the escapement must hold the train it is driven by).
//   · RATING NUT — the rod is the only one whose nut's travel spans the beat (`solveRatingRod`); the nut's DERIVED
//     sensitivity (`nutSensitivity`, from its volume and the balance's I and first moment) agrees with the free
//     period's finite difference at its place to 1%, and moves the DRIVEN rate by within 5% of what it says; a nut
//     slid along the bob's axle (parallel to the knife) moves the period by nothing (float noise).
//   · CYCLE — the driven cycle the page draws advances the wheel one tooth a period, and the going train (§315's
//     trainModel) carried on it turns the great wheel 2π/(ratio × teeth) a period.
//
// CONTROLS, each seen to fail: a typed torque that ignores the table (the doubling); a restoring torque 1% stiffer
// (the pendulum's period); the escapement's work counted without the pallets' friction (the energy books); a
// stiffening restoring torque (the period would FALL with the swing); a nut whose mass is ignored (the
// sensitivity); the nut slid up its rod instead of along the bob's axle (the zero).
//
//   node tools/probe-technic-drive.mjs [technic_classic|technic_2026]
import { loadPack } from './technic-pack.mjs';
import { placements, bounds, LDU_MM } from '../src/ldraw.js';
import { CATALOGUES } from '../src/layout.js';
import { solveFusee, fuseeRun, TECHNIC_FUSEE_SPRING } from '../src/technic-fusee.js';
import { frameEscapement, framedBalance, balanceMoments, periodAt, TECHNIC_ESCAPEMENT, TECHNIC_BALANCE, BEAT_PERIOD_S, RATING_DIM_MM, RATING_PARTS } from '../src/technic-escapement.js';
import { frameTrain, trainChain, trainBuild, trainModel, trainPose } from '../src/technic-train.js';
import * as D from '../src/technic-drive.js';

const lib = loadPack();
const only = process.argv[2] ?? null;
const GENS = Object.keys(CATALOGUES).filter((g) => CATALOGUES[g] && (!only || g === only));
let fails = 0;
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const controls = [];
const control = (name, caught) => controls.push([name, !!caught]);
const near = (a, b, t) => Math.abs(a - b) <= t;
const N = (v) => (v * D.NMM).toExponential(3);
const run = solveFusee(TECHNIC_FUSEE_SPRING).best;
const F = D.TECHNIC_DRIVE_FRICTION, X = D.TECHNIC_DRIVE;
console.log('THE LEGO GOING TRAIN\'S ESCAPEMENT, DRIVEN — by a POSED spring law, frictions TABLED (modelled, not measured)\n');

// ── FRICTION
for (const band of ['mesh', 'pallet']) {
  const b = F[band];
  if (!(b.favourable >= b.nominal && b.nominal >= b.adverse && b.adverse > 0 && b.favourable <= 1)) fail(`${band}: the corners are not ordered in (0, 1]`);
  if (!b.source) fail(`${band}: no source`);
}
console.log(`FRICTION mesh ${F.mesh.adverse}–${F.mesh.favourable} (nominal ${F.mesh.nominal}), pallet ${F.pallet.adverse}–${F.pallet.favourable} (nominal ${F.pallet.nominal}); not modelled: ${F.notModelled.join(', ')}`);

// ── TABLE (one frame for the escapement, the train's own: the balance is the same in both generations)
const f0 = frameTrain(GENS[0]), ef = f0.escapement.ef, spec = { ...ef.spec, sense: f0.sense };
const tsw = D.tableSwing(lib, spec);
if (!tsw || tsw.A !== X.tableDeg) fail(`the table swing is ${tsw?.A}°, TECHNIC_DRIVE says ${X.tableDeg}°`);
if (X.traceSteps !== Math.round(X.tableDeg * 200)) fail(`the trace takes ${X.traceSteps} steps a leg, not a hundredth of a degree each (${Math.round(X.tableDeg * 200)})`);
const t0 = Date.now(), ct = D.contactTables(lib, spec, { A: X.tableDeg, n: X.traceSteps });
if (!ct.ok) { fail(`the contact trace at ${X.tableDeg}° does not escape: ${ct.why}`); process.exit(1); }
console.log(`TABLE the widest swing with the posed swing's drops is ${tsw.A}° (at ${tsw.next?.A}°: ${tsw.next?.what}${tsw.next?.drops ? ` — ${tsw.next.drops.map((d) => `${d.dir > 0 ? '+' : '−'}${d.deg}°`).join(', ')}` : ''}); traced in ${((Date.now() - t0) / 1000).toFixed(0)} s, releases out to ${(ct.release * 180 / Math.PI).toFixed(2)}°`);

// ── TORQUE CHAIN
{
  const opts = { Munit: 1, etaMesh: F.mesh.nominal, meshes: 7, ratio: 2250 };
  let worst = 0, worstP = 0;
  for (const s of run.samples) {
    const tau = D.escapeTorque(run, s, opts), want = s.M * s.arm / run.rb * opts.etaMesh ** opts.meshes / opts.ratio;
    worst = Math.max(worst, Math.abs(tau - want) / want); worstP = Math.max(worstP, Math.abs(s.P - s.M * s.arm) / s.P);
  }
  if (worst > 1e-12 || worstP > 1e-12) fail(`the escape torque parts from Munit·M·arm/ρ_b·η^n/ratio by ${worst.toExponential(2)} (P from M·arm by ${worstP.toExponential(2)})`);
  // the spring law the only source: double the table's torque
  const t2 = { ...TECHNIC_FUSEE_SPRING, rows: TECHNIC_FUSEE_SPRING.rows.map(([t, m]) => [t, 2 * m]) };
  const run2 = fuseeRun(t2, run.barrel, run.steps);
  const ratio = (fn) => Math.max(...run.samples.map((s, i) => Math.abs(fn(run2, run2.samples[i]) / fn(run, s) - 2)));
  const dbl = ratio((r, s) => D.escapeTorque(r, s, opts));
  if (dbl > 1e-12) fail(`doubling the spring table moves the escape torque by a factor off 2 by ${dbl.toExponential(2)}`);
  control('a typed torque that ignores the spring table', ratio(() => 0.3) > 1e-6);
  console.log(`TORQUE every run sample's escape torque is Munit·M·arm/ρ_b·η^n/ratio to ${worst.toExponential(1)}; doubling the spring table doubles it to ${dbl.toExponential(1)} (the run's level product ${run.lo.toFixed(4)}–${run.hi.toFixed(4)}, spread ${(run.spread * 100).toFixed(2)}%, on the POSED law)`);
}

// ── MOTION
const dyn0 = D.balanceDynamics(lib, ef);
{
  const T0 = 2 * Math.PI * Math.sqrt(dyn0.I / dyn0.Mgd);
  const per = (A, opts = {}) => { const r = D.drive({ ...dyn0, ct: null, tau: 0, A0: A, periods: 6, ...opts }); return r.cycles.slice(-3).reduce((s, c) => s + c.T, 0) / 3; };
  const small = per(0.1);
  if (!near(small, T0, 1e-5 * T0)) fail(`at 0.1° the undriven period is ${small.toFixed(8)} s, 2π√(I/mgd) is ${T0.toFixed(8)} s`);
  const rows = [3, 5, 8].map((A) => ({ A, T: per(A), want: periodAt(dyn0.T0, A) }));
  for (const r of rows) if (!near(r.T, r.want, 1e-5 * r.want)) fail(`at ${r.A}° the undriven period is ${r.T.toFixed(8)} s, the elliptic integral ${r.want.toFixed(8)} s`);
  control('a restoring torque 1% stiffer', !near(per(0.1, { restoring: (a) => 1.01 * dyn0.Mgd * Math.sin(a) }), T0, 1e-5 * T0));
  // energy books, driven (nominal pallets, a torque near the ceiling, a few dozen periods)
  // (the step is first order: its energy wanders by about ω·h of the energy and comes back, so the books close to
  // that bound, and to half of it at half the step)
  const books = (div) => { const T0 = 2 * Math.PI * Math.sqrt(dyn0.I / dyn0.Mgd), h = T0 / 5000 / div; const r = D.drive({ ...dyn0, ct, tau: X.escapeTorqueHi / D.NMM, eta: F.pallet.nominal, A0: 3, periods: 40, dt: h });
    const Eend = dyn0.Mgd * (1 - Math.cos(r.alpha)) + 0.5 * dyn0.I * r.omega ** 2; return { r, res: Math.abs(r.W - r.dE), bound: (2 * Math.PI / T0) * h * Eend }; };
  const b1 = books(1), b2 = books(2), r = b1.r, res = b1.res / Math.abs(r.W), resIdeal = Math.abs(r.Wideal - r.dE) / Math.abs(r.W);
  if (!(b1.res <= b1.bound && b2.res <= b2.bound && b2.res < 0.75 * b1.res)) fail(`the energy books do not close to the step's own error: ${b1.res.toExponential(3)} (bound ${b1.bound.toExponential(3)}), at half the step ${b2.res.toExponential(3)} (bound ${b2.bound.toExponential(3)})`);
  control('the escapement\'s work counted without the pallets\' friction', Math.abs(r.Wideal - r.dE) > 100 * b1.bound);
  console.log(`MOTION undriven: ${small.toFixed(8)} s at 0.1° against 2π√(I/mgd) ${T0.toFixed(8)} s; ${rows.map((x) => `${x.A}° ${x.T.toFixed(7)} (elliptic ${x.want.toFixed(7)})`).join(', ')}; driven, the energy books close to ${res.toExponential(1)} of the work, ${(b1.res / b1.bound).toFixed(2)} of the step's own bound and ${(b2.res / b1.res).toFixed(2)} of that at half the step (frictionless books would miss by ${resIdeal.toExponential(1)})`);
}

// ── PERIOD AGAINST AMPLITUDE (nominal pallets, the ceiling's torque)
{
  const binned = (rows) => {
    const m = new Map();
    for (const r of rows) if (r.A) { const k = Math.round(r.A * 4) / 4; if (!m.has(k)) m.set(k, []); m.get(k).push(r.T); }
    return [...m].sort((a, b) => a[0] - b[0]).filter(([, v]) => v.length >= 1).map(([A, v]) => ({ A, T: v.reduce((s, x) => s + x, 0) / v.length }));
  };
  const rising = (b) => b.every((x, i) => !i || x.T > b[i - 1].T);
  const rows = D.periodAgainstAmplitude(dyn0, ct, X.escapeTorqueHi / D.NMM, F.pallet.nominal);
  const b = binned(rows);
  if (b.length < 6) fail(`only ${b.length} amplitudes measured`);
  if (!rising(b)) fail(`the driven period does not rise with the swing: ${b.map((x) => `${x.A}° ${x.T.toFixed(6)}`).join(', ')}`);
  // control: a restoring torque that stiffens with the swing (a hardening spring) makes the period FALL
  const hard = [];
  for (const A0 of [1, 2, 3, 4, 5, 6, 7, 8]) { const r = D.drive({ ...dyn0, ct: null, tau: 0, A0, periods: 3, restoring: (a) => dyn0.Mgd * (a + a ** 3) }); for (const c of r.cycles) hard.push({ A: c.A, T: c.T }); }
  control('a stiffening restoring torque (the period would fall with the swing)', !rising(binned(hard)));
  console.log(`PERIOD AGAINST AMPLITUDE (driven, nominal, ${N(X.escapeTorqueHi / D.NMM)} N·mm): ${b.map((x) => `${x.A}° ${x.T.toFixed(5)}`).join(', ')} — RISES with the swing (the circular error grows, the recoil's share shrinks)`);
}

// ── SOLVE, per generation
let solved = null;
for (const gen of GENS) {
  const f = gen === GENS[0] ? f0 : frameTrain(gen), chain = trainChain(gen), meshes = chain.meshes.length, ratio = chain.meshes.reduce((q, m) => q * m.ta / m.tb, 1);
  const t1 = Date.now(), r = D.solveDrive(lib, f.escapement.ef, { run, ratio, meshes, ct });
  console.log(`\n${gen}: (${meshes} meshes, ${ratio}:1; solved in ${((Date.now() - t1) / 1000).toFixed(0)} s)`);
  if (!r.ok) { fail(`${gen}: ${r.why}`); continue; }
  solved ??= { r, f, gen };
  const spreadT = Math.max(...r.history.map((h) => h.tauHi)) - Math.min(...r.history.map((h) => h.tauHi));
  const spreadN = Math.max(...r.history.map((h) => h.nutV)) - Math.min(...r.history.map((h) => h.nutV));
  const tolT = Math.max(0.01 * X.escapeTorqueHi, 2 * spreadT * D.NMM), tolN = Math.max(0.05, 2 * spreadN);
  if (!near(r.tauHi * D.NMM, X.escapeTorqueHi, tolT)) fail(`${gen}: the escape torque's ceiling solves to ${N(r.tauHi)} N·mm, TECHNIC_DRIVE says ${X.escapeTorqueHi} (± ${tolT.toExponential(2)})`);
  if (!near(r.nutV, X.nutV, tolN)) fail(`${gen}: the nut solves to ${r.nutV.toFixed(3)} mm, TECHNIC_DRIVE says ${X.nutV} (± ${tolN.toFixed(3)})`);
  console.log(`  SCALE the escape torque's ceiling ${N(r.tauHi)} N·mm (declared ${X.escapeTorqueHi}; the solve's rounds ${r.history.map((h) => N(h.tauHi)).join(', ')}): the spring at full wind ${(r.Munit * D.NMM).toFixed(3)} N·mm at the barrel — what a measured band must not exceed, on the POSED law's shape`);
  for (const c of F.corners) {
    const v = r.corners[c], show = (s) => (s.status === 'sustained' ? `${s.A.toFixed(2)}° ${s.T.toFixed(5)} s` : `${s.status}${s.A ? ` (${s.A.toFixed(2)}°)` : ''}`);
    console.log(`  ${c.padEnd(11)} escape torque ${N(v.band.lo)}–${N(v.band.hi)} N·mm: at the run's least ${show(v.lo)}, mean ${show(v.mean)}, most ${show(v.hi)}`);
  }
  const nom = r.corners.nominal;
  if (![nom.lo, nom.mean, nom.hi].every((s) => s.status === 'sustained')) fail(`${gen}: the nominal corner does not hold a swing over the run`);
  if (nom.mean.status === 'sustained' && !near(nom.mean.T, BEAT_PERIOD_S, 2e-4)) fail(`${gen}: at the nominal corner and the run's mean torque the period is ${nom.mean.T.toFixed(6)} s, not the beat (the nut is off)`);
  if (nom.lo.T && nom.hi.T) console.log(`  RATE over the run (nominal): ${((1 - nom.lo.T / BEAT_PERIOD_S) * D.DAY_S).toFixed(0)} s/day at the least torque, ${((1 - nom.hi.T / BEAT_PERIOD_S) * D.DAY_S).toFixed(0)} at the most (the cone's ${(run.spread * 100).toFixed(1)}% residual spread, on the POSED law)`);
  if (!(r.lock.margin > 1)) fail(`${gen}: the drive (${N(r.lock.tauHi)} N·mm) is over the escapement's trip torque (${N(r.lock.trip)} N·mm): it would not hold the train`);
  console.log(`  LOCK the trip torque ${N(r.lock.trip)} N·mm at the escape arbor (frictionless) against the most the drive delivers, ${N(r.lock.tauHi)}: ${r.lock.margin.toFixed(0)}×; a hand on the great wheel trips it at ${(r.lock.trip * D.NMM * ratio / F.mesh.nominal ** meshes).toFixed(1)} N·mm there (nominal meshes)`);
}

// ── RATING NUT's parts, measured: the connector's two axle holes (axl2hol* primitives) run from RATING_DIM_MM.holeIn
// to holeOut off its centre, its body ±halfWidth across; the bush is ±nutHalf along its axis
{
  const holes = placements(lib, `${RATING_PARTS.connector}.dat`, /axl2hol/).map((p) => Math.hypot(p.m[0], p.m[1], p.m[2]) * LDU_MM).filter((r) => r > 0);
  const lo = Math.min(...holes), bc = bounds(lib, `${RATING_PARTS.connector}.dat`), bn = bounds(lib, `${RATING_PARTS.nut}.dat`);
  const hi = Math.min(-bc.lo[1], -bc.lo[2]) * LDU_MM;                 // each arm (−Y, −Z) ends at its hole's mouth
  const across = Math.max(-bc.lo[0], bc.hi[0]) * LDU_MM, along = Math.max(-bn.lo[2], bn.hi[2]) * LDU_MM;
  if (!near(lo, RATING_DIM_MM.holeIn, 1e-9) || !near(hi, RATING_DIM_MM.holeOut, 1e-3)) fail(`the connector's axle holes run ${lo}–${hi} mm off its centre; RATING_DIM_MM says ${RATING_DIM_MM.holeIn}–${RATING_DIM_MM.holeOut}`);
  if (!near(across, RATING_DIM_MM.halfWidth, 1e-9)) fail(`the connector is ±${across} mm across, RATING_DIM_MM says ±${RATING_DIM_MM.halfWidth}`);
  if (!near(along, RATING_DIM_MM.nutHalf, 1e-9)) fail(`the bush is ±${along} mm along its axis, RATING_DIM_MM says ±${RATING_DIM_MM.nutHalf}`);
  console.log(`\nRATING PARTS measured: the connector's (${RATING_PARTS.connector}) axle holes from ${lo.toFixed(1)} mm off its centre to each arm's mouth at ${hi.toFixed(1)}, ±${across.toFixed(1)} mm across; the bush (${RATING_PARTS.nut}) ±${along.toFixed(1)} mm along its axis`);
}

// ── RATING NUT
if (solved) {
  const { r, f } = solved, efr = f.escapement.ef;
  const rods = D.solveRatingRod(lib, ct, D.torqueBand(run, { Munit: r.Munit, etaMesh: F.mesh.nominal, meshes: r.meshes, ratio: r.ratio }).mean, F.pallet.nominal);
  const spanning = rods.filter((x) => x.ok).map((x) => x.rodStuds);
  if (!(spanning.length === 1 && spanning[0] === efr.rating.rod.lenStuds)) fail(`the rods whose nut spans the beat are ${spanning.join(', ') || 'none'}; the frame stands a ${efr.rating.rod.lenStuds}L`);
  console.log(`\nRATING NUT the rod: ${rods.map((x) => `${x.rodStuds}L ${x.ok ? `spans it (nut at ${x.nutV.toFixed(2)} mm)` : x.why ? `no (${x.tLow ? `${x.tLow.toFixed(4)}–${x.tHigh.toFixed(4)} s` : x.why})` : 'no'}`).join('; ')}`);
  const v = X.nutV, sens = D.nutSensitivity(lib, efr, v);
  const T0at = (vv) => D.balanceDynamics(lib, efr, { nutV: vv }).T0, dv = 0.5;
  const fd = (T0at(v - dv) - T0at(v + dv)) / (2 * dv);                 // dT0/dv, free
  if (!near(sens.dTdv, -fd, 0.01 * Math.abs(fd))) fail(`the nut's derived sensitivity ${sens.dTdv.toExponential(4)} s/mm parts from the free period's difference ${(-fd).toExponential(4)} by over 1%`);
  // driven: the nominal corner's mean torque, the nut a millimetre either side
  const tauMean = D.torqueBand(run, { Munit: r.Munit, etaMesh: F.mesh.nominal, meshes: r.meshes, ratio: r.ratio }).mean;
  const Td = (vv) => D.sustained({ ...D.balanceDynamics(lib, efr, { nutV: vv }), ct, tau: tauMean, eta: F.pallet.nominal }).T;
  const dvD = 1, measured = (Td(v - dvD) - Td(v + dvD)) / (2 * dvD) * -1;
  if (!near(measured, sens.dTdv, 0.05 * Math.abs(sens.dTdv))) fail(`the nut moves the driven period by ${measured.toExponential(4)} s/mm, its inertia says ${sens.dTdv.toExponential(4)}`);
  // control: a nut whose mass is ignored derives no sensitivity, and so misses the driven one
  const ghost = (D.balanceDynamics(lib, efr, { nutV: v - dvD, ignoreNut: true }).T0 - D.balanceDynamics(lib, efr, { nutV: v + dvD, ignoreNut: true }).T0) / (2 * dvD);
  control('a nut whose mass is ignored', !near(ghost, measured, 0.05 * Math.abs(measured)));
  // a nut slid along the bob axle: parallel to the knife, it moves no mass about it
  const along = (dw) => { const parts = framedBalance(efr, lib, { nutV: v }).map((p) => (p.rating === 'nut' ? { ...p, m: [p.m[0], p.m[1], p.m[2] + dw, ...p.m.slice(3)] } : p)); return balanceMoments(lib, parts).T; };
  const zero = Math.abs(along(8) - along(0)), up = Math.abs(T0at(v - 8) - T0at(v));
  if (zero > 1e-12) fail(`a nut slid a stud along the bob's axle moves the period by ${zero.toExponential(2)} s`);
  control('the nut slid a stud up its rod instead (it must move the period)', up > 1e-6);
  const [vLow, vHigh] = efr.rating.travel, rate = (T) => (1 - T / BEAT_PERIOD_S) * D.DAY_S;
  const tLow = Td(vLow), tHigh = Td(vHigh);
  console.log(`  at ${v} mm (${(-v).toFixed(2)} mm above the knife's apex, its travel ${(-vLow).toFixed(1)}–${(-vHigh).toFixed(1)} mm): ${sens.Vn.toFixed(0)} mm³ of bush; DERIVED ${sens.ratePerMm.toFixed(1)} s/day a millimetre up the rod, ${sens.ratePerStud.toFixed(0)} s/day a stud (the driven rate measures ${(-D.DAY_S * measured / BEAT_PERIOD_S).toFixed(1)} s/day a mm); its RANGE ${rate(tLow).toFixed(0)} s/day (bottom) to ${rate(tHigh).toFixed(0)} s/day (top) at the nominal corner; slid along the bob's axle it moves the period by ${zero.toExponential(1)} s`);

  // ── CYCLE: the driven cycle, and the going train carried on it
  const sus = D.sustained({ ...r.dyn, ct, tau: tauMean, eta: F.pallet.nominal });
  const cyc = D.drivenCycle(r.dyn, ct, tauMean, F.pallet.nominal, sus);
  const p0 = cyc.poseAt(0.0), p1 = cyc.poseAt(cyc.T), adv = (p1.theta - p0.theta) * cyc.sigma / cyc.pitch;
  if (!near(adv, 1, 1e-9)) fail(`the driven cycle advances the wheel ${adv} teeth a period`);
  const b = trainBuild(solved.f, lib, { run }), m = trainModel(b, cyc, null);
  const ga = (t) => trainPose(m, t).phi[b.index.great];
  const gAdv = Math.abs(ga(5 * cyc.T + 0.1) - ga(4 * cyc.T + 0.1)), want = 2 * Math.PI / (r.ratio * TECHNIC_ESCAPEMENT.teeth);
  if (!near(gAdv, want, 1e-9)) fail(`on the driven cycle the great wheel turns ${gAdv} a period, not 2π/${r.ratio * TECHNIC_ESCAPEMENT.teeth}`);
  console.log(`CYCLE the driven swing ${sus.A.toFixed(3)}° (${sus.Amin.toFixed(3)}–${sus.Amax.toFixed(3)}), its period ${cyc.T.toFixed(6)} s; the wheel one tooth a period (${adv.toFixed(9)}), the legs' seam ${(cyc.seam * 180 / Math.PI).toExponential(1)}°; the great wheel 2π/${r.ratio * TECHNIC_ESCAPEMENT.teeth} a period on the train carried by it`);
}

console.log('\ncontrols:');
for (const [n, c] of controls) { console.log(`  ${c ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!c) fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nthe escapement is driven by the posed spring law alone through the train, its swing and period solved, the nut setting the beat — modelled, frictions tabled');
process.exit(fails ? 1 : 0);
