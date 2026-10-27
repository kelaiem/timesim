// BUILT §316 — THE LEGO GOING TRAIN, landing 2 of three: THE ESCAPEMENT DRIVEN. Pure: no three.js, no DOM.
// tools/probe-technic-drive.mjs holds it.
//
// THE QUESTION. Landing 1 (§315) joined the fusee, the train and §287's escapement into one train, but the balance
// still swung at a POSED amplitude and the train followed it. Here the swing is SOLVED: the balance's equation of
// motion is stepped in time, restored by gravity (it is a compound pendulum on a knife edge, §287), and kicked
// through the anchor by the escape wheel's torque — which comes from the fusee's spring law through the cone and
// the train. What comes out is the swing's amplitude, its period at that amplitude, how both move with the drive,
// and a RATING NUT to set the period on the beat. It is DRIVEN BY A POSED SPRING LAW, FRICTIONS TABLED: modelled,
// never measured, and every number below that rests on the posed law says so.
//
// THE DRIVE, link by link (`escapeTorque`):
//   · the barrel's torque is TECHNIC_FUSEE_SPRING's law — the ONLY spring source here — at the barrel's wind. That
//     table is POSED (the steel ribbon's shape, §285), and it carries a SHAPE, not a size: its torque is a fraction
//     of full wind. Its SIZE is the one number a measurement would supply; here it is SOLVED (`solveScale`): the
//     largest full-wind torque at which the driven period stays inside RATE_BAND of the free pendulum's, over the
//     whole run, at the nominal friction corner — what the band may deliver and leave the balance the timekeeper
//     (an escapement driven harder keeps the escapement's time, not the pendulum's).
//   · the cord carries it to the cone: tension M/ρ_b at the barrel's seat, torque P/ρ_b at the fusee, P = M × arm
//     the run's level product (fuseeRun's own samples, §286); the maintaining work is lossless (POSED: it carries
//     the great wheel only in the wind);
//   · the train divides it by its ratio (2250:1, read off the build) and multiplies by each mesh's efficiency, a
//     TABLED band (TECHNIC_DRIVE_FRICTION.mesh), never one number.
//
// THE BALANCE (`balanceDynamics`): I about the knife and m g d from §287's partSolid integrals of the very parts the
// build places (the rating nut included), at ESC_DENSITY's mean; the period at small swings is 2π √(I / m g d).
//
// THE ANCHOR (`contactTables`): the escape wheel's angle along the anchor's swing is §287's quasi-static settle (the
// parts' outlines, `traceCycle`), traced once over the widest swing that still escapes. Per direction of swing it is
// a table: where the wheel follows a pallet (impulse, or recoil when the pallet pushes it back) and where it DROPS.
// The wheel and the train behind it are taken as MASSLESS here (landing 3 gives them their inertia): wherever a
// tooth touches a pallet, the work balances, τ dθ = Q dα, so the anchor feels Q = τ dθ/dα; a drop does no work on
// the balance (the wheel runs free and its energy is lost in the catch). FRICTION at the pallets is the tabled band
// TECHNIC_DRIVE_FRICTION.pallet as an efficiency: the wheel driving the anchor delivers η·τ dθ/dα, the anchor
// driving the wheel back (recoil) costs τ dθ/dα / η.
//
// THE EQUATION OF MOTION (`drive`): I α'' = −m g d sin α + Q(α, sign α'), stepped by semi-implicit Euler at a five-
// thousandth of the period. The work the escapement does and the balance's energy are summed beside it, so the
// probe holds the energy balance to the integration's own error. A swing that reaches past the widest escaping
// one BANKS (the pallet would jam on the wheel: the escapement fails); one that falls short of every release
// STOPS (no tooth escapes).
//
// WHAT IS NOT MODELLED, BY NAME: the knife edge's rolling loss and the air's drag (no τ-independent loss at all: so
// the swing's amplitude is set by the pallets' friction and NOT by the drive's size — the solve finds this and says
// it); the wheel's and the train's inertia; the maintaining work's loss; the cord's stretch. Landing 3 integrates
// the whole train in time and is where those enter.
import { escapementModel, escSpec, traceCycle, traceCycleSteps, balanceMoments, framedBalance, frameEscapement, tripTorque, periodAt,
  ESC_DENSITY, ESC_SWING_DEG, G_MM_S2, BEAT_PERIOD_S, RATE_BAND, TECHNIC_ESCAPEMENT, TECHNIC_BALANCE } from './technic-escapement.js';
import { TECHNIC_FUSEE_SPRING, springTorque } from './technic-fusee.js';

const TAU = 2 * Math.PI;
const deg = (d) => d * Math.PI / 180, toDeg = (r) => r * 180 / Math.PI;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
export const NMM = 1e-3;                 // one kg·mm²/s² (the model's torque unit: mm, kg, s) is 1e-3 N·mm
export const DAY_S = 86400;

// ── THE FRICTIONS, TABLED ────────────────────────────────────────────────────
// Three corners, as the movement's FRICTION table carries them (favourable ≥ nominal ≥ adverse): a coefficient
// this repo cannot measure lives here as a band with its source, never as one number.
export const TECHNIC_DRIVE_FRICTION = Object.freeze({
  status: 'TABLED',
  corners: Object.freeze(['favourable', 'nominal', 'adverse']),
  // per mesh, the train's spur gears (great wheel → escape wheel)
  mesh: Object.freeze({ favourable: 0.98, nominal: 0.95, adverse: 0.90,
    source: 'a band for moulded plastic spur gearing as general engineering references quote it (roughly 0.9 to 0.98 a mesh); nothing here measures a LEGO mesh' }),
  // the escape wheel's tooth sliding on a pallet (an 8T's tooth flank), as an efficiency of the work through it
  pallet: Object.freeze({ favourable: 0.80, nominal: 0.70, adverse: 0.60,
    source: 'a guess, bracketed wide: two ABS gear teeth sliding across each other with no lubricant; it is the band the sustained swing turns on, so it is the first thing to measure' }),
  notModelled: Object.freeze(['the knife edge\'s rolling loss', 'air drag on the balance', 'the escape wheel\'s and the train\'s inertia', 'the maintaining work\'s loss', 'the cord\'s stretch']),
});
export const etaOf = (corner, F = TECHNIC_DRIVE_FRICTION) => ({ mesh: F.mesh[corner], pallet: F.pallet[corner] });

// THE DECLARED DRIVE (the probe re-solves each and fails when the solve answers otherwise):
//   tableDeg  — the widest swing whose drops are the posed swing's, on a quarter-degree grid (`tableSwing`): the
//               contact table is traced over it, and a swing that grows past it BANKS (a pallet slips near the
//               swing's end, and a little further the wheel has no free place: the anchor jams);
//   traceSteps — that trace's steps a leg: a hundredth of a degree of the anchor a step;
//   escapeTorqueHi — `solveScale`'s answer, N·mm at the escape arbor at the run's highest level product: the most the
//               posed spring may deliver there (it rests on the posed law's shape and on the tabled frictions);
//   nutV      — `solveNut`'s answer, mm (v down from the knife's apex): where the rating nut stands on its rod for
//               the beat at the nominal corner and the run's mean torque; the rod is `solveRatingRod`'s.
export const TECHNIC_DRIVE = Object.freeze({ tableDeg: 8.75, traceSteps: 1750, escapeTorqueHi: 3.198e-4, nutV: -16.96 });

// ── THE DRIVE: the spring law → the escape arbor ─────────────────────────────
// τ_e = Munit · P / ρ_b · η_mesh^n / ratio, at the run's sample `s` (fuseeRun's samples: P = M × arm, in the
// table's torque unit × mm). `table` is read ONLY through the run's samples, which fuseeRun made from it.
export function escapeTorque(run, s, { Munit, etaMesh, meshes, ratio }) {
  return Munit * s.P / run.rb * etaMesh ** meshes / ratio;
}
// the band over the run: the least and greatest level product (the cone's residual spread) and the mean
export function torqueBand(run, opts) {
  const at = (P) => escapeTorque(run, { P }, opts);
  return { lo: at(run.lo), mean: at(run.mean), hi: at(run.hi), spread: run.spread };
}
// ── THE BALANCE AS A BODY ────────────────────────────────────────────────────
// I (kg·mm²) and m g d (kg·mm²/s²) of the framed balance, the rating nut at `nutV` (mm, v down; null: none).
export const RHO_NOMINAL = (ESC_DENSITY.abs[0] + ESC_DENSITY.abs[1]) / 2;   // g/cm³; it cancels from the period
export function balanceDynamics(lib, frame, { nutV = frame.rating?.nutV ?? null, rho = RHO_NOMINAL, ignoreNut = false } = {}) {
  const parts = framedBalance(frame, lib, { nutV }).filter((p) => !(ignoreNut && p.rating === 'nut'));
  const mo = balanceMoments(lib, parts), k = rho * 1e-6;              // g/cm³ → kg/mm³
  return { I: mo.I * k, Mgd: mo.V * k * G_MM_S2 * mo.d, T0: mo.T, mo, rho, nutV };
}

// ── THE ANCHOR'S CONTACT, TABLED ─────────────────────────────────────────────
// One trace (§287's settle law, two full swings, the second kept) over the swing `A` (deg), n steps a leg. Per
// direction: the anchor angles in that direction's order, the wheel's angle after each, and what each step was.
// `slope(dir, α)` is dθ/dα of the wheel FOLLOWING a pallet (0 across a drop); `thetaAt(dir, α)` the wheel's angle.
export function* contactTablesSteps(lib, spec, { A, n = 1600 } = {}) {
  const model = escapementModel(lib, escSpec(lib, spec));
  const tr = yield* traceCycleSteps(model, A, { n });
  if (!tr.ok) return { ok: false, why: tr.why, A };
  const R = deg(A), da = 2 * R / n, legs = {};
  for (const dir of [1, -1]) {
    const st = tr.steps.filter((s) => s.dir === dir);
    // indexed by α ascending: grid point i at α = −R + i·da (i = 0 … n); the step into point i (in the leg's own
    // order) carries the slope of the interval it crossed
    const theta = new Float64Array(n + 1), slope = new Float64Array(n), kind = new Array(n), holder = new Int8Array(n + 1);
    st.forEach((s, j) => {
      const i = dir > 0 ? j + 1 : n - 1 - j;                          // the grid point the step arrived at
      theta[i] = s.theta; holder[i] = s.holder;
      const iv = dir > 0 ? j : n - 1 - j;                             // the interval it crossed
      slope[iv] = s.kind === 'drop' ? 0 : s.dth / (dir * da);
      kind[iv] = s.kind;
    });
    // the leg's starting point (its last step of the leg before, in the trace): the opposite extreme
    const first = st[0], i0 = dir > 0 ? 0 : n;
    theta[i0] = first.theta - first.dth * model.sigma; holder[i0] = first.holder;
    legs[dir] = { theta, slope, kind, holder };
  }
  const drops = tr.steps.filter((s) => s.kind === 'drop').map((s) => ({ dir: s.dir, alpha: s.alpha, dth: s.dth }));
  const release = Math.max(...drops.map((d) => Math.abs(d.alpha)));
  return { ok: true, A, n, R, da, legs, drops, release, pitch: model.pitch, sigma: model.sigma, theta0: tr.theta0, model };
}
export function contactTables(lib, spec, opts) { const it = contactTablesSteps(lib, spec, opts); let r; while (!(r = it.next()).done); return r.value; }
const idx = (ct, al) => Math.max(0, Math.min(ct.n - 1, Math.floor((al + ct.R) / ct.da)));
export const slopeAt = (ct, dir, al) => ct.legs[dir].slope[idx(ct, al)];
export function thetaAt(ct, dir, al) {
  const L = ct.legs[dir], f = Math.max(0, Math.min(ct.n, (al + ct.R) / ct.da)), i = Math.min(ct.n - 1, Math.floor(f)), u = f - i;
  return L.theta[i] * (1 - u) + L.theta[i + 1] * u;
}
export const kindAt = (ct, dir, al) => ct.legs[dir].kind[idx(ct, al)];

// ── THE EQUATION OF MOTION ───────────────────────────────────────────────────
// I α'' = −m g d sin α + Q, Q = τ dθ/dα through the pallet's efficiency η (the wheel driving: ×η; driven back: ÷η).
// From α0 (deg) at rest; `periods` of the small-swing period at most. Returns each full period's mean amplitude
// (deg) and its length (s), the run's status, and the energy books (the work the escapement did, the balance's
// energy gained) — the probe holds W − ΔE to the integrator's own error.
export function drive({ I, Mgd, ct, tau, eta = 1, A0, start = null, periods = 200, dt = null, record = false, settle = null, restoring = null }) {
  const T0 = TAU * Math.sqrt(I / Mgd), h = dt ?? T0 / 5000, Rmax = ct ? ct.R : Infinity;
  const grav = restoring ?? ((a) => Mgd * Math.sin(a));                // (a probe's control may stiffen it)
  let al = start ? start.alpha : deg(A0), w = start ? start.omega : 0, t = 0, W = 0, Wideal = 0, peak = 0, lastDir = w > 0 ? 1 : -1, halfs = [], ups = [], status = 'running';
  const E = (a, v) => 0.5 * I * v * v + Mgd * (1 - Math.cos(a)), E0 = E(al, w);
  const Q = (a, v) => {
    if (!ct || tau === 0) return 0;
    const dir = v > 0 ? 1 : v < 0 ? -1 : (Math.sin(a) > 0 ? -1 : 1);
    const s = slopeAt(ct, dir, a), p = s * v;
    return p >= 0 ? eta * tau * s : tau * s / eta;
  };
  const trace = record ? { t: [], a: [] } : null;
  const steps = Math.ceil(periods * T0 / h);
  for (let k = 0; k < steps; k++) {
    const q = Q(al, w), w1 = w, sdir = w > 0 ? 1 : -1;
    w += (-grav(al) + q) / I * h;
    const al2 = al + w * h;
    W += q * h * (w1 + w) / 2;                                        // the escapement's work as the step counts it
    if (ct && tau) Wideal += tau * slopeAt(ct, sdir, al) * h * (w1 + w) / 2;   // the same, the pallets frictionless
    if (al < 0 && al2 >= 0) ups.push(t + h * (-al) / (al2 - al));
    peak = Math.max(peak, Math.abs(al2));
    const dir = w > 0 ? 1 : -1;
    if (dir !== lastDir) { halfs.push(toDeg(peak)); peak = 0; lastDir = dir; }
    al = al2; t += h;
    if (record) { trace.t.push(t); trace.a.push(al); }
    if (Math.abs(al) > Rmax) { status = 'banks'; break; }
    if (ct && halfs.length > 4 && halfs[halfs.length - 1] < toDeg(ct.release)) { status = 'stops'; break; }
    if (settle && ups.length > 12 && settle(halfs, ups)) { status = 'sustained'; break; }
  }
  if (status === 'running') status = 'ran';
  // full periods: between upward crossings, the amplitude the mean of the two half-swings inside it
  const cycles = [];
  for (let j = 1; j < ups.length; j++) cycles.push({ T: ups[j] - ups[j - 1], at: ups[j] });
  const amps = halfs.slice(1);
  cycles.forEach((c, j) => { const a = amps.slice(2 * j + 1, 2 * j + 3); c.A = a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; });
  return { status, cycles, halfs, t, W, Wideal, dE: E(al, w) - E0, alpha: al, omega: w, T0, h, trace };
}
// the swing the drive holds: run until the half-swings stop moving (every half-swing of the last twenty periods
// within SETTLED_DEG of the one twenty periods before) or the escapement banks or stops
export const TABLE_STEP_DEG = 0.25;      // tableSwing's grid
export const SETTLED_DEG = 2e-3;          // half-swings that stay within this of the swing twenty periods back are settled (the table's
                                          // own step is a hundredth of a degree: the swing jitters inside it)
export const AVERAGE_PERIODS = 400;      // the settled swing is not a fixed point (it wanders within a few hundredths of a
                                          // degree, the table's steps beating against the swing): its period and amplitude
                                          // are averaged over this many periods after it settles
export function sustained({ I, Mgd, ct, tau, eta, A0 = 3, periods = 4000 }) {
  const settle = (halfs) => { const n = halfs.length; if (n < 60) return false; let d = 0; for (let j = n - 40; j < n; j++) d = Math.max(d, Math.abs(halfs[j] - halfs[n - 42 + ((j - n) & 1)])); return d < SETTLED_DEG; };
  const r = drive({ I, Mgd, ct, tau, eta, A0, periods, settle });
  if (r.status !== 'sustained') return { status: r.status === 'ran' ? 'unsettled' : r.status, A: null, T: null, Tfree: null, T0: r.T0, run: r };
  const r2 = drive({ I, Mgd, ct, tau, eta, start: { alpha: r.alpha, omega: r.omega }, periods: AVERAGE_PERIODS + 1 });
  const cyc = r2.cycles.filter((c) => Number.isFinite(c.A));
  if (r2.status === 'banks' || r2.status === 'stops' || !cyc.length) return { status: r2.status === 'ran' ? 'unsettled' : r2.status, A: null, T: null, Tfree: null, T0: r.T0, run: r2 };
  const A = cyc.reduce((x, c) => x + c.A, 0) / cyc.length, T = cyc.reduce((x, c) => x + c.T, 0) / cyc.length;
  const Amin = Math.min(...cyc.map((c) => c.A)), Amax = Math.max(...cyc.map((c) => c.A));
  // a swing that settles within the table swing's own grid step of its edge may already be making the slip the
  // table does not hold: it is counted as BANKING, not as a swing the escapement holds
  const status = ct && Amax > ct.A - TABLE_STEP_DEG ? 'banks' : 'sustained';
  return { status, A, T, Amin, Amax, Tfree: periodAt(r.T0, A), T0: r.T0, run: r2, settledAfter: r.cycles.length };
}

// ── THE SIZE OF THE DRIVE, SOLVED ────────────────────────────────────────────
// The driven period's error against the free pendulum's at the same swing is the escapement's error; it grows with
// the torque. The largest escape torque at which it stays inside RATE_BAND (bisected on a log scale) — the most the
// spring may deliver at the run's highest level product. Nominal corner.
export function escapementError(dyn, ct, tau, eta, A0 = 3) {
  const s = sustained({ ...dyn, ct, tau, eta, A0 });
  return { ...s, err: s.T !== null ? s.T / s.Tfree - 1 : null };
}
export function solveScale(dyn, ct, eta, { band = RATE_BAND, lo = 1e-6, hi = 1e-1 } = {}) {
  // (each trial starts at the swing a moderate drive settles to: the swing hardly moves with the torque, and a weak
  // drive takes a long time to bring a wrong start to it)
  const A0 = sustained({ ...dyn, ct, tau: Math.sqrt(lo * hi) / NMM, eta }).A ?? 3;
  const bad = (tau) => { const e = escapementError(dyn, ct, tau, eta, A0); return e.status !== 'sustained' || Math.abs(e.err) > band; };
  if (bad(lo / NMM)) return null;
  let a = lo / NMM, b = hi / NMM;
  for (let i = 0; i < 40; i++) { const m = Math.sqrt(a * b); if (bad(m)) b = m; else a = m; }
  return a;                                                            // kg·mm²/s², the escape arbor's torque
}

// ── THE RATING NUT ───────────────────────────────────────────────────────────
// Its rate sensitivity DERIVED from the inertias: T0 = 2π √(I / (g ρ F)), F = Σ V v the balance's first moment down
// the plumb (V d), I = Σ ∫(u² + v²) dV. Sliding the nut (volume V_n) up the rod by dv changes I by 2 V_n v dv (the
// parallel axis; its own moment about its centre does not move) and F by V_n dv, so
//   dT0/dv = T0 · ½ (2 V_n v / I − V_n / F)      (per mm of the nut's travel, v down)
// and the rate, s/day, moves by −DAY_S · dT/T. Per stud, × the stud.
export function nutSensitivity(lib, frame, nutV, { stud = 8 } = {}) {
  const dyn = balanceDynamics(lib, frame, { nutV }), mo = dyn.mo;
  const Vn = balanceMoments(lib, framedBalance(frame, lib, { nutV }).filter((p) => p.rating === 'nut')).V;
  const F = mo.V * mo.d, dTdv = mo.T * 0.5 * (2 * Vn * nutV / mo.I - Vn / F);
  return { Vn, dTdv, ratePerMm: -DAY_S * dTdv / mo.T, ratePerStud: -DAY_S * dTdv / mo.T * stud, T0: mo.T };
}
// The nut's place: where the driven period, at the nominal corner and the run's mean torque, is the beat. The
// driven period rises as the nut climbs (v falls); bisected over the rod's travel.
export function solveNut(lib, frame, ct, tau, eta, { target = BEAT_PERIOD_S } = {}) {
  const [vLow, vHigh] = frame.rating.travel;                          // vLow the lowest place (largest v)
  const Tat = (v) => sustained({ ...balanceDynamics(lib, frame, { nutV: v }), ct, tau, eta }).T;
  const tLow = Tat(vLow), tHigh = Tat(vHigh);
  if (!(tLow <= target && target <= tHigh)) return { ok: false, tLow, tHigh, why: `the beat ${target} s is outside the nut's travel (${tLow?.toFixed(5)} … ${tHigh?.toFixed(5)} s)` };
  let a = vLow, b = vHigh;
  for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (Tat(m) < target) a = m; else b = m; }
  return { ok: true, nutV: r6((a + b) / 2), tLow, tHigh };
}

// ── THE LOCK AGAINST A HAND ──────────────────────────────────────────────────
// §287's trip torque (the balance at rest, the wheel on a pallet: the torque that pushes the pallet aside,
// frictionless) against the drive's: the escapement holds the train while the drive is under it.
export function lockMargin(lib, frame, dyn, tauHi) {
  const model = escapementModel(lib, escSpec(lib, frame.spec)), tr = tripTorque(model, dyn.mo);
  const trip = tr.perMgd * dyn.Mgd;
  return { trip, tauHi, margin: trip / tauHi, alphaWorst: tr.alphaWorst, released: tr.released };
}

// ── THE DRIVEN CYCLE THE PAGE DRAWS ──────────────────────────────────────────
// One steady period of the solved swing, from its negative extreme: α(t) sampled off the equation of motion, the
// wheel's angle read off the contact table in the direction the anchor swings (one pitch a period on), the step's
// kind and holder with it. `poseAt(t)` has cyclePose's shape, so landing 1's train follows it unchanged.
export function drivenCycle(dyn, ct, tau, eta, sus) {
  const A = deg(sus.A);
  const r = drive({ ...dyn, ct, tau, eta, A0: sus.A, periods: 1.5, record: true });
  // one period from the first extreme after the start (ω through zero, α < 0)
  const { t, a } = r.trace;
  let i0 = 1; while (i0 < a.length - 1 && !(a[i0] <= a[i0 - 1] && a[i0] <= a[i0 + 1])) i0++;
  let i1 = i0 + 2; while (i1 < a.length - 1 && !(a[i1] <= a[i1 - 1] && a[i1] <= a[i1 + 1] && t[i1] - t[i0] > 0.5 * sus.T)) i1++;
  const T = t[i1] - t[i0], N = 480, samples = [];
  for (let k = 0; k <= N; k++) {
    const tt = t[i0] + T * k / N; let j = i0; while (j < i1 && t[j + 1] < tt) j++;
    const al = a[j] + (a[Math.min(j + 1, a.length - 1)] - a[j]) * (tt - t[j]) / ((t[j + 1] ?? t[j] + 1) - t[j]);
    const dir = k === 0 ? 1 : (al >= samples[k - 1].alpha ? 1 : -1);
    samples.push({ f: k / N, alpha: al, dir });
  }
  for (const s of samples) {
    s.theta = thetaAt(ct, s.dir, s.alpha);
    s.kind = kindAt(ct, s.dir, s.alpha);
    s.holder = ct.legs[s.dir].holder[Math.round((s.alpha + ct.R) / ct.da)] || 1;
  }
  // the two legs meet: at the swing's top the wheel's angle read off both directions' tables, and at its foot the
  // down leg's against the next period's up leg (one pitch on)
  const seam = Math.max(Math.abs(thetaAt(ct, 1, A) - thetaAt(ct, -1, A)), Math.abs(thetaAt(ct, -1, -A) - thetaAt(ct, 1, -A) - ct.sigma * ct.pitch));
  const label = (k) => (k === 'drop' ? 'drop' : k === 'recoil' ? 'recoil' : k === 'impulse' ? 'impulse' : 'still');
  // (the period the train keeps is the settled swing's, averaged: one period's own length wanders with it)
  const cyc = { driven: true, ok: true, A: sus.A, T: sus.T, Tone: T, sigma: ct.sigma, pitch: ct.pitch, steps: samples, labels: samples.map((s) => label(s.kind)), seam, theta0: samples[0].theta };
  // the wheel's angle runs on one pitch a period: the up leg's table, then the down leg's, each table the trace's
  // own (its down leg follows its up leg in the same cycle)
  cyc.poseAt = (tt) => {
    const c = Math.floor(tt / cyc.T), f = tt / cyc.T - c, k = Math.min(N, Math.max(0, Math.round(f * N))), s = samples[k];
    return { alpha: s.alpha, theta: s.theta + ct.sigma * c * ct.pitch, kind: cyc.labels[k], holder: s.holder, step: k, cycle: c };
  };
  return cyc;
}

// ── THE WHOLE SOLVE ──────────────────────────────────────────────────────────
// For one going train (its run, ratio and mesh count) and its escapement frame (with the rating rod): the contact
// tables, the drive's size, the nut's place, the swing and its period per friction corner, the period against
// amplitude, the lock. (`ct` may be passed in: it is the one expensive piece.)
// The barrel's full-wind torque (the table's 1, kg·mm²/s²) that gives the escape torque `tauHi` at the run's highest
// level product through `meshes` meshes of efficiency `etaMesh` and the train's ratio: escapeTorque solved for Munit.
export const barrelScale = (tauHi, run, ratio, meshes, etaMesh) => tauHi * ratio * run.rb / (run.hi * etaMesh ** meshes);
// THE DECLARED DRIVE, AS THE PAGE RUNS IT: TECHNIC_DRIVE's ceiling and nut on this frame and train, each corner's
// swing at the run's mean torque (one `sustained` each; `between` is awaited between them, so a page can breathe),
// and the nominal corner's driven cycle when it holds a swing.
export async function driveDeclared(lib, frame, { run, ratio, meshes, ct, F = TECHNIC_DRIVE_FRICTION, between = async () => {} } = {}) {
  const tauHi = TECHNIC_DRIVE.escapeTorqueHi / NMM, Munit = barrelScale(tauHi, run, ratio, meshes, F.mesh.nominal);
  const dyn = balanceDynamics(lib, frame, { nutV: TECHNIC_DRIVE.nutV }), corners = {};
  for (const c of F.corners) {
    const e = etaOf(c, F), band = torqueBand(run, { Munit, etaMesh: e.mesh, meshes, ratio });
    corners[c] = { eta: e, band, mean: sustained({ ...dyn, ct, tau: band.mean, eta: e.pallet }) };
    await between();
  }
  const nom = corners.nominal;
  const cycle = nom.mean.status === 'sustained' ? drivenCycle(dyn, ct, nom.band.mean, nom.eta.pallet, nom.mean) : null;
  const lock = lockMargin(lib, frame, dyn, corners.favourable.band.hi);
  return { ok: !!cycle, why: cycle ? null : `the nominal corner ${nom.mean.status}`, tauHi, Munit, dyn, corners, cycle, lock, sens: nutSensitivity(lib, frame, TECHNIC_DRIVE.nutV) };
}
export function solveDrive(lib, frame, { run, ratio, meshes, ct, F = TECHNIC_DRIVE_FRICTION, iterations = 3 } = {}) {
  const nom = etaOf('nominal', F);
  // the drive's size and the nut's place each read the other (the nut moves the balance a little, and so the
  // escapement's error; the torque moves the period a little, and so the nut): a few rounds from the travel's middle
  let nutV = frame.rating ? (frame.rating.travel[0] + frame.rating.travel[1]) / 2 : null, tauHi = null, Munit = null, nut = null, history = [];
  for (let k = 0; k < iterations; k++) {
    tauHi = solveScale(balanceDynamics(lib, frame, { nutV }), ct, nom.pallet);
    if (tauHi === null) return { ok: false, why: 'no torque drives the escapement inside the rate band' };
    Munit = barrelScale(tauHi, run, ratio, meshes, nom.mesh);
    const tauMean = torqueBand(run, { Munit, etaMesh: nom.mesh, meshes, ratio }).mean;
    nut = frame.rating ? solveNut(lib, frame, ct, tauMean, nom.pallet) : null;
    if (nut && !nut.ok) return { ok: false, why: nut.why, tauHi };
    history.push({ tauHi, nutV: nut?.nutV ?? null });
    if (nut) nutV = nut.nutV;
  }
  const band = (c) => torqueBand(run, { Munit, etaMesh: etaOf(c, F).mesh, meshes, ratio });
  const dyn = balanceDynamics(lib, frame, { nutV });
  const corners = Object.fromEntries(F.corners.map((c) => {
    const e = etaOf(c, F), b = band(c);
    return [c, { eta: e, band: b, lo: sustained({ ...dyn, ct, tau: b.lo, eta: e.pallet }), mean: sustained({ ...dyn, ct, tau: b.mean, eta: e.pallet }), hi: sustained({ ...dyn, ct, tau: b.hi, eta: e.pallet }) }];
  }));
  const lock = lockMargin(lib, frame, dyn, band('favourable').hi);
  return { ok: true, Munit, tauHi, nut, nutV, history, dyn, corners, lock, ratio, meshes, run, F };
}

// ── THE WIDEST SWING THE TABLE HOLDS ─────────────────────────────────────────
// §287's window, read upward on a `step` grid from the posed swing: the widest amplitude whose trace escapes with the
// SAME drops as the posed swing's (each leg's releases at the same anchor angles, within two trace steps). Past it a
// pallet slips near the swing's end (a drop the small swing never makes) and, further, the swing has no free place
// for the wheel: the escapement jams. Inside it the contact along a leg is a function of the anchor's angle alone,
// which is what lets one trace stand for every swing up to it. Returns that amplitude and the first that differs.
const dropsOf = (tr) => tr.steps.filter((s) => s.kind === 'drop').map((s) => ({ dir: s.dir, alpha: s.alpha }));
export function tableSwing(lib, spec = TECHNIC_ESCAPEMENT, { from = ESC_SWING_DEG, step = TABLE_STEP_DEG, cap = 20, perDeg = 100 } = {}) {
  const model = escapementModel(lib, escSpec(lib, spec));
  const trace = (A) => traceCycle(model, A, { n: Math.round(A * perDeg) });
  const t0 = trace(from);
  if (!t0.ok) return null;
  const ref = dropsOf(t0), tol = 2 * 2 * deg(1 / perDeg);           // two steps (a step is 2/perDeg degrees: the leg spans 2A)
  const same = (tr) => { const d = dropsOf(tr); return d.length === ref.length && d.every((x, i) => x.dir === ref[i].dir && Math.abs(x.alpha - ref[i].alpha) <= tol); };
  let A = from, why = null;
  for (let a = from + step; a <= cap + 1e-9; a += step) {
    const tr = trace(a);
    if (!tr.ok) { why = { A: r6(a), what: tr.why }; break; }
    if (!same(tr)) { why = { A: r6(a), what: 'a drop the posed swing does not make', drops: dropsOf(tr).map((d) => ({ dir: d.dir, deg: r6(toDeg(d.alpha)) })) }; break; }
    A = a;
  }
  return { A: r6(A), next: why };
}
// ── THE ROD, SOLVED ──────────────────────────────────────────────────────────
// Every axle the frame's lattice can stand in the connector: the rods whose nut, from the connector to the rod's
// top, spans the beat at the nominal corner. (Shorter rods leave the balance fast whatever the nut does; longer
// ones slow, because the rod itself stands above the knife.)
export function solveRatingRod(lib, ct, tau, eta, { spec = TECHNIC_ESCAPEMENT, bal = TECHNIC_BALANCE, studs = [2, 3, 4, 5, 6, 7, 8] } = {}) {
  return studs.map((k) => {
    const fr = frameEscapement(spec, bal, { rating: { nutV: null, rodStuds: k } });
    if (!fr.framed) return { rodStuds: k, ok: false, why: fr.reason };
    return { rodStuds: k, travel: fr.rating.travel, ...solveNut(lib, fr, ct, tau, eta) };
  });
}
// ── PERIOD AGAINST AMPLITUDE, off the driven cycle ───────────────────────────
// From each starting swing the drive carries the balance toward its own swing; every full period on the way is a
// (amplitude, period) pair measured off the equation of motion. The free pendulum's period at the same amplitude
// beside it (τ = 0: the elliptic integral, `periodAt`).
export function periodAgainstAmplitude(dyn, ct, tau, eta, { starts = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8], cycles = 4 } = {}) {
  const rows = [];
  for (const A0 of starts) {
    const r = drive({ ...dyn, ct, tau, eta, A0, periods: cycles + 1 });
    if (r.status === 'banks' || r.status === 'stops') { rows.push({ A0, status: r.status }); continue; }
    for (const c of r.cycles.slice(0, cycles)) if (Number.isFinite(c.A)) rows.push({ A0, A: c.A, T: c.T, Tfree: periodAt(r.T0, c.A) });
  }
  return rows;
}
