// §219 tier three (b), landing H — THE FUSEE MODULE AS A LEGO BUILD: a cord
// fusee on a stepped cone of grooved pulleys, a barrel the cord pays onto, the
// cord's two hooks, and Harrison's maintaining power. MODELLED: every part is
// placed and measured, every law that turns one part from another is a
// geometric relation read off the parts — but nothing here is integrated, and
// the one law the build runs on, the SPRING's torque against its wind, is
// POSED (below). Pure: no three.js, no DOM. tools/probe-technic-fusee.mjs holds
// it.
//
// THE QUESTION (docs/LEGO_FEASIBILITY.md §3.2 in the roadmap repo, module 2 of
// its §4): the steel movement's cone is CUT from its ribbon's torque law so
// that springTq · r is level to float noise (§104). LEGO has no helically
// grooved cone. Its safe form is a CORD on a STEPPED cone, climbing one step
// per wrap, so the continuous r(θ) becomes a staircase that matches the law
// only stepwise. This module solves WHICH steps, from the catalogue's grooved
// round parts, make the product as level as a staircase allows, and says by
// how much it is not level.
//
// WHAT IS POSED, BY NAME:
//   · the spring's torque law (TECHNIC_FUSEE_SPRING): LEGO has no spring steel
//     (F3); the barrel is a rubber band or a pull-back motor, and its law can
//     only be MEASURED, with a spring scale on the cord. Until it is, the table
//     carries a STAND-IN — the steel ribbon's own law, M = k·u (§104), at the
//     steel's set-up and working band — and says so in its `status`. The solve
//     reads the table and nothing else about the spring, so a measured table
//     replaces `rows` and re-solves with no code change;
//   · the bands: the barrel's spring, the maintaining band (its stretch), the
//     two pawls' bands. Each force is posed; the probe measures DIRECTIONS
//     (which way each pawl locks, which way the band turns the great wheel),
//     never a force.
//
// WHAT IS NOT BUILT: the chain fusee. A 3711 chain on a stack of sprockets is
// UNPROVEN rather than impossible — whether a link will step one gear-width
// sideways onto the next sprocket under load is a physical experiment
// (LEGO_FEASIBILITY §3.2), not something a model can answer. The cord is the
// fallback the note names and it loses nothing the demonstrator needs.
import { walk, placements, LDU_MM } from './ldraw.js';
import { LEGO_DIM_MM, FRAME_PARTS, AXLE_PARTS, columnFor, GEAR_TIP_MM, KEYLESS_PULL_DIM_MM, KEYLESS_PARTS } from './technic-frame.js';
import { surfaceSamples, forEachSurfaceSample, toothPhase } from './technic-ldraw.js';
import { CATALOGUES, TRAIN, catalogueMesh } from './layout.js';

const D = LEGO_DIM_MM;
const L = (mm) => mm / LDU_MM;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const TAU = 2 * Math.PI;
const mod = (a, m) => ((a % m) + m) % m;

// ── THE SPRING: A POSED TABLE ──────────────────────────────────────────────
// Rows are [turns, torque]: barrel turns of wind counted from RUN-DOWN (the
// first row is the set-up the spring is let down to, the last full wind), and
// the torque there. The run spans the whole table: the module is wound from
// its first row to its last, as a spring scale would be read over the band the
// builder uses. Torque is linear between rows (the solve's only assumption
// about the law); the unit is free, because torque × radius is levelled as a
// SHAPE — a scale on every row cancels.
//
// THE STAND-IN is the steel going spring's law, M = k·u (§104, the ribbon's
// moment, linear in its wind angle u from the free coil): set up by
// SETUP_CLICKS of the SETUP_RATCHET_TEETH-tooth set-up ratchet, and run to the
// wind at which the set-up torque is SPRING_TQ_EMPTY of full (main.js; the
// latter a solve output, quoted here at the five figures main.js' own comment
// records — probe-technic-fusee reads all three back off main.js' TEXT and
// fails when they part). Its turns are the steel's own, so the barrel's run is
// the steel barrel's, (23/24)·(1/0.58986 − 1) = 0.666 turns; its torque is
// scaled to 1 at full wind. A rubber band will not be linear, and a pull-back
// motor's band is a few turns: that is what the measurement is for.
export const STEEL_STAND_IN = Object.freeze({ setupClicks: 23, ratchetTeeth: 24, emptyFraction: 0.58986, rows: 9 });
function steelStandInRows({ setupClicks, ratchetTeeth, emptyFraction, rows }) {
  const uS = setupClicks / ratchetTeeth, uF = uS / emptyFraction;   // turns from the free coil
  return Array.from({ length: rows }, (_, i) => { const t = (uF - uS) * i / (rows - 1); return Object.freeze([r6(t), r6((uS + t) / uF)]); });
}
export const TECHNIC_FUSEE_SPRING = Object.freeze({
  status: 'POSED',
  source: 'to be measured: a spring scale on the cord at a known radius, torque read against barrel turns of wind (LEGO_FEASIBILITY §3.2)',
  standIn: Object.freeze({ law: 'the steel ribbon\'s, M = k·u (§104)', ...STEEL_STAND_IN,
    from: 'main.js SETUP_CLICKS, SETUP_RATCHET_TEETH and SPRING_TQ_EMPTY' }),
  units: Object.freeze({ turns: 'barrel turns of wind from run-down', torque: 'fraction of full-wind torque (any unit: the solve reads the shape)' }),
  rows: Object.freeze(steelStandInRows(STEEL_STAND_IN)),
});
// Torque at `t` barrel turns from run-down, linear between rows; NaN outside
// the table (a run the table does not cover is refused, never extrapolated).
export function springTorque(table, t) {
  const R = table.rows;
  if (!(t >= R[0][0] - 1e-12 && t <= R[R.length - 1][0] + 1e-12)) return NaN;
  for (let i = 1; i < R.length; i++) if (t <= R[i][0] + 1e-12) {
    const [t0, m0] = R[i - 1], [t1, m1] = R[i];
    return m0 + (m1 - m0) * (t - t0) / (t1 - t0);
  }
  return R[R.length - 1][1];
}
export const springBand = (table) => table.rows[table.rows.length - 1][0] - table.rows[0][0];

// ── THE PARTS ───────────────────────────────────────────────────────────────
// THE STEP CATALOGUE: every keyed (axle-hole) round part whose rim carries a
// CORD GROOVE. Landing H read five from the LDraw library's titles: the half
// bush, the bush with two flanges, the wheel rim 8 × 17.5, the wedge belt wheel
// and the pulley wheel 5D. A flat rim (the 3×3 disc, a round plate) lets a wrap
// walk off; a groove guides it. The barrel is chosen from the same list.
// §285 MEASURED the rest: tools/ldraw-groove-survey.mjs read every axle-keyed
// part in the LDraw library (468 of them, 2026-10-16) through grooveSeat, and
// every part whose groove a wrap can lie in joins — keyed on its own Z, its
// floor's middle within half a cord radius of its origin (the build places a
// pulley by its origin and carries that offset, `grooveOff`), round to a
// quarter of the cord's diameter, and both walls above the cord's centre at
// every angle. Tyre channels count: a wheel rim's tyre seat is a groove like
// any other. The second line is theirs, by seat. (The bush with two flanges
// fails that survey's wall rule — its flange dips to 3.27 mm, under the cord's
// centre at 3.40 — and stays, landing H's, never in an answer.)
export const FUSEE_PULLEYS = Object.freeze(['32123a', '3713', '3482', '4185a', '3736',
  '32123b', '4265a', '6577', '55982', '56903', '32089', '2994', '4185b', '54087', '56904', '22253', '6595', '44292', '6582']);
// THE CORD: LEGO's braided string, whose end STUDS are its hooks (each end a
// round 1×1 with a stud on top and an anti-stud under it), by length in studs.
// The shortest that reaches is the one built (cordChoice).
export const FUSEE_STRINGS = Object.freeze({ 11: '76384', 21: '75924', 31: '14225', 41: '71149' });
// The rest of the module, by role. The ONE-WAY 20T gear (7161c01) the
// feasibility note names is not in the LDraw library (official or unofficial,
// read 2026-10-15), so the ratchets are keyed gears with a pawl on a thin
// liftarm — landing F's measured RATCHET (a keyed 8T on an arm locks one way),
// here wanted. The maintaining RATCHET must carry the click's pivot and the
// band's peg in axle holes off its axis, and so must the great wheel carry the
// band's other peg: the catalogue gear that has them is the 40T (3649), whose
// four off-centre axle holes are drawn as axle-hole primitives 20 LDU out
// (`axleHoleOffsets` reads them). The 24T "with 3 axleholes" (3648a) was
// tried first and its extra holes are not drawn as primitives; sliced, they
// could not be located with confidence, so it is not used. The click's wheel
// is a 16T (frameFusee's comment says why).
export const FUSEE_PARTS = Object.freeze({
  hookPlate: '4032a',   // round plate 2×2 with axle hole: four studs, one takes each hook
  clickWheel: '4019', ratchet: '3649', pawl: '3647', arm: '6632', connector: '62462', greatWheel: '3649', knob: '4185a',
  centrePinion: '3647',   // §285: FUSEE_CENTRE's count, the part solveCentrePinion names
  cordEnd: '71149k01', cordSegment: '71149k02',
});

// MEASURED (held by probe-technic-fusee.mjs against the vendored parts, to
// 1e-4 mm). Each SEAT is where a cord of the string's own section comes to
// rest in that part's groove: the lowest centre radius between the part's two
// outermost rims at which the cord's circle touches the surface and enters it
// nowhere (`grooveSeat`). CAPACITY is how many cords lie side by side at that
// seat (the 8 × 17.5 rim's floor holds three; every other groove one).
export const FUSEE_DIM_MM = Object.freeze({
  cordR: 0.6,               // 71149k02: the braided segment's section, ±1.5 LDU
  seat: Object.freeze({ '32123a': 3.3117, '3713': 3.3971, '3482': 8.1989, '4185a': 11.5993, '3736': 18.1795,
    '32123b': 3.3117, '4265a': 3.3117, '6577': 3.3117, '55982': 5.3988, '56903': 5.3988, '32089': 6.697, '2994': 9.7989, '4185b': 11.6296, '54087': 12.9987, '56904': 12.9994, '22253': 13.3978, '6595': 13.3978, '44292': 14.1987, '6582': 15.3979 }),
  capacity: Object.freeze({ '32123a': 1, '3713': 4, '3482': 3, '4185a': 1, '3736': 1,
    '32123b': 1, '4265a': 1, '6577': 1, '55982': 1, '56903': 1, '32089': 1, '2994': 2, '4185b': 1, '54087': 5, '56904': 1, '22253': 12, '6595': 12, '44292': 7, '6582': 8 }),
  rim: Object.freeze({ '32123a': 3.6001, '3713': 3.6001, '3482': 8.8002, '4185a': 12.0007, '3736': 18.68,
    '32123b': 3.6001, '4265a': 3.6001, '6577': 3.6001, '55982': 8.4002, '56903': 8.4002, '32089': 13.1005, '2994': 12.0003, '4185b': 12.0007, '54087': 15.2001, '56904': 15.2009, '22253': 18.0011, '6595': 18.0011, '44292': 15.2024, '6582': 18.4011 }),
  halfWidth: Object.freeze({ '32123a': 2, '3713': 4, '3482': 4, '4185a': 2, '3736': 4,   // along the axle
    '32123b': 2, '4265a': 2, '6577': 2, '55982': 7.4, '56903': 4, '32089': 3.9004, '2994': 7, '4185b': 2, '54087': 10, '56904': 7.6, '22253': 12.4, '6595': 12.4, '44292': 10, '6582': 10 }),
  floorHalf: Object.freeze({ '32123a': 0.04, '3713': 2, '3482': 1.54, '4185a': 0.3, '3736': 0,   // the cord's centre may stand this far either side of the groove's middle at the seat
    '32123b': 0.04, '4265a': 0.04, '6577': 0.04, '55982': 0.28, '56903': 0.28, '32089': 0.18, '2994': 1, '4185b': 0.02, '54087': 2.94, '56904': 0.2, '22253': 6.73, '6595': 6.73, '44292': 3.8, '6582': 4.6 }),
  // §285: the floor's middle along the part's own Z from its origin (landing
  // H's five read 0), and the window grooveSeat reads each surveyed part over
  // (landing H's five: none, the outermost rims about the origin), at 0.25 LDU
  grooveOff: Object.freeze({ '32123a': 0, '3713': 0, '3482': 0, '4185a': 0, '3736': 0,
    '32123b': 0, '4265a': 0, '6577': 0, '55982': 0, '56903': 0, '32089': 0.1, '2994': 0, '4185b': 0, '54087': 0, '56904': 0, '22253': -0.27, '6595': -0.27, '44292': 0, '6582': 0 }),
  read: Object.freeze({
    '32123b': Object.freeze({ window: Object.freeze([-0.96, 0.96]), step: 0.25 }), '4265a': Object.freeze({ window: Object.freeze([-0.96, 0.96]), step: 0.25 }), '6577': Object.freeze({ window: Object.freeze([-0.96, 0.96]), step: 0.25 }), '55982': Object.freeze({ window: Object.freeze([-0.92, 0.92]), step: 0.25 }), '56903': Object.freeze({ window: Object.freeze([-0.92, 0.92]), step: 0.25 }), '32089': Object.freeze({ window: Object.freeze([-0.68, 0.88]), step: 0.25 }), '2994': Object.freeze({ window: Object.freeze([-1.6, 1.6]), step: 0.25 }), '4185b': Object.freeze({ window: Object.freeze([-0.88, 0.88]), step: 0.25 }), '54087': Object.freeze({ window: Object.freeze([-3.8, 3.8]), step: 0.25 }), '56904': Object.freeze({ window: Object.freeze([-0.8, 0.8]), step: 0.25 }), '22253': Object.freeze({ window: Object.freeze([-7.6, 7.2]), step: 0.25 }), '6595': Object.freeze({ window: Object.freeze([-7.6, 7.2]), step: 0.25 }), '44292': Object.freeze({ window: Object.freeze([-4.4, 4.4]), step: 0.25 }), '6582': Object.freeze({ window: Object.freeze([-5.2, 5.2]), step: 0.25 }) }),
  string: Object.freeze({ '76384': 80, '75924': 160, '14225': 240, '71149': 320 }),   // between the two end studs' centres
  endR: 3.2, endH: 3.2, endStudH: 1.6, endCord: 0.6,   // 71149k01: radius 8, body 8, stud 4 LDU; the cord 1.5 LDU under its top
  plateH: 3.2, plateStud: Math.hypot(4, 4), plateR: 8,  // 4032a: body 8 LDU, studs at (±10, ±10) LDU, radius 20
  wheelHole: 8,             // 3649: its four off-centre axle holes, 20 LDU out (the ratchet and the great wheel)
  wheelHalf: 4,             // 3649: 20 LDU thick
  clickHalf: 4,             // 4019: 20 LDU thick
  connectorHalf: 8, connectorR: 4,   // 62462: 40 LDU long, radius 10 LDU
  armMid: 8,                // 6632: its round middle hole 20 LDU from each end hole
  armHalfWidth: 3.6,        // 6632: ±9 LDU across
});


// THE SEAT OF A CORD IN A GROOVE, measured. The part's outermost surface
// radius R(z) along its axis (its own Z), from its sampled surface; the groove
// is between its two outermost rims; a cord of radius c centred at (ρ, z_c)
// rests where ρ(z_c) = max over |z − z_c| < c of R(z) + √(c² − (z − z_c)²) is
// least. Returns LDU and mm. `step` is the surface sampling (LDU; the catalogue
// is held at 0.25, ldraw-groove-survey.mjs screens the library coarser) and
// `axis` the part's own axis ('z', as every catalogued pulley is drawn, or 'y').
// `window` (mm along the axis) names the groove where a part has more than one,
// or where its two outermost rims do not stand either side of its origin; by
// default the groove is the one between the outermost rims about the origin.
// THE PROFILE it reads: the part's outermost surface radius per 0.1 LDU bin
// along its axis (LDU), memoised per library, so a part with several grooves
// is sampled once.
const GROOVE_BIN = 0.1, profileMemo = new WeakMap();
export function grooveProfile(lib, part, { step = 0.25, axis = 'z' } = {}) {
  if (!profileMemo.has(lib)) profileMemo.set(lib, new Map());
  const memo = profileMemo.get(lib), key = `${part}@${step}/${axis}`;
  if (memo.has(key)) return memo.get(key);
  const R = new Map();
  forEachSurfaceSample(lib, part, step, (x, y, z) => {
    const a = axis === 'y' ? y : z, r = axis === 'y' ? Math.hypot(x, z) : Math.hypot(x, y);
    const k = Math.round(a / GROOVE_BIN); R.set(k, Math.max(R.get(k) ?? 0, r));
  });
  const out = { R, ks: [...R.keys()].sort((p, q) => p - q), bin: GROOVE_BIN };
  memo.set(key, out);
  return out;
}
export function grooveSeat(lib, part, cordR = FUSEE_DIM_MM.cordR, { step = 0.25, axis = 'z', window = null } = {}) {
  const c = L(cordR), { R, ks, bin } = grooveProfile(lib, part, { step, axis });
  let rim = 0; for (const v of R.values()) rim = Math.max(rim, v);
  let lo, hi;
  if (window) {
    [lo, hi] = window.map(L);
    rim = 0; for (const k of ks) if (k * bin >= lo - 1e-9 && k * bin <= hi + 1e-9) rim = Math.max(rim, R.get(k));
  } else {
    const atRim = ks.filter((k) => R.get(k) > rim - 0.01).map((k) => k * bin);
    lo = Math.max(...atRim.filter((z) => z < 0)); hi = Math.min(...atRim.filter((z) => z > 0));
  }
  const rho = (zc) => { let m = 0; for (const k of ks) { const d = k * bin - zc; if (Math.abs(d) < c) m = Math.max(m, R.get(k) + Math.sqrt(c * c - d * d)); } return m; };
  let seat = Infinity; const scan = [];
  for (let i = Math.ceil(lo / 0.05); i * 0.05 <= hi + 1e-9; i++) { const zc = i * 0.05, r = rho(zc); scan.push([zc, r]); seat = Math.min(seat, r); }
  // the FLOOR: the run of cord positions at the seat (within 0.02 LDU of it)
  // CONTIGUOUS with the lowest one — §285: a crowned tyre's two gutters are two
  // floors, not one wide one, and a first reading that took the outermost of
  // all such positions called a 62 mm motorcycle wheel's crown a 15 mm channel
  const at = (j) => scan[j][1] < seat + 0.02;
  let i0 = scan.findIndex(([, r]) => r === seat), i1 = i0;
  while (i0 > 0 && at(i0 - 1)) i0--;
  while (i1 < scan.length - 1 && at(i1 + 1)) i1++;
  const f0 = scan[i0][0], f1 = scan[i1][0];
  // the WALLS: each side's highest surface within a cord diameter outside the
  // floor — a groove guides a wrap only where both stand above the cord's centre
  const wall = (a, b) => { let m = 0; for (const k of ks) if (k * bin >= a - 1e-9 && k * bin <= b + 1e-9) m = Math.max(m, R.get(k)); return m * LDU_MM; };
  const walls = [wall(f0 - 2 * c, f0), wall(f1, f1 + 2 * c)];
  let outer = 0; for (const v of R.values()) outer = Math.max(outer, v);
  return { seatLDU: seat, seat: seat * LDU_MM, rim: rim * LDU_MM, outer: outer * LDU_MM, walls, groove: [lo * LDU_MM, hi * LDU_MM], floor: [f0 * LDU_MM, f1 * LDU_MM],
    capacity: Math.floor((f1 - f0) / (2 * c) + 1e-9) + 1, rho: (zcMm) => rho(L(zcMm)) * LDU_MM };
}

// ── THE SOLVE ───────────────────────────────────────────────────────────────
// A RUN on a barrel of seat ρ_b and a cone whose steps are seats ρ_1 > … > ρ_n
// (the base, at the run-down end, first): winding takes the cord off the
// barrel onto the cone, base first, one wrap per step, so the barrel's wind θ
// rises by (cord laid)/(2π ρ_b) and the cord's arm on the cone is the step's
// seat. The BASE wrap is partial, f of a turn (the hook stands where the run
// begins); every step above it carries one whole wrap; between two steps the
// cord crosses on the tangent from the larger seat's circle to the smaller's,
// sqrt(ρ_j² − ρ_{j+1}² + Δy²) long, its arm the smaller seat (that line's
// distance from the axis). The run must use the whole table:
//   f·2πρ_1 + Σ_{j≥2} 2πρ_j + Σ transitions = 2πρ_b · band,
// which fixes f, and f must lie in (0, 1].
// The LEVEL PRODUCT is M(θ)·ρ(θ) — the torque at the fusee, the barrel's radius
// cancelling — and its SPREAD is (max − min)/mean over the run.
export function fuseeRun(table, barrel, steps, { seat = FUSEE_DIM_MM.seat, halfWidth = FUSEE_DIM_MM.halfWidth, floorHalf = FUSEE_DIM_MM.floorHalf,
  grooveOff = FUSEE_DIM_MM.grooveOff } = {}) {
  const band = springBand(table), rb = seat[barrel];
  const rho = steps.map((p) => seat[p]);
  const planes = stepPlanes(steps, { halfWidth, floorHalf, grooveOff });
  const trans = steps.slice(1).map((p, j) => Math.sqrt(rho[j] ** 2 - rho[j + 1] ** 2 + (planes[j + 1].wrapY - planes[j].wrapY) ** 2));
  const upper = rho.slice(1).reduce((s, r) => s + TAU * r, 0) + trans.reduce((s, t) => s + t, 0);
  const f = (TAU * rb * band - upper) / (TAU * rho[0]);
  // a run the table cannot carry is refused before it is sampled (§285: the
  // solve now reads a library-sized catalogue)
  if (!(f > 0 && f <= 1 + 1e-12)) return { barrel, steps, f, band, rb, rho, trans, upper, ok: false };
  // the cord's segments in the order winding lays them, each with its arm
  const segs = [{ step: 0, arm: rho[0], len: f * TAU * rho[0], kind: 'wrap' }];
  for (let j = 1; j < steps.length; j++) {
    segs.push({ step: j, arm: rho[j], len: trans[j - 1], kind: 'transition' });
    segs.push({ step: j, arm: rho[j], len: TAU * rho[j], kind: 'wrap' });
  }
  const t0 = table.rows[0][0];
  let s = 0, lo = Infinity, hi = -Infinity, sum = 0, n = 0;
  const samples = [];
  for (const g of segs) {
    for (let k = 0; k <= 64; k++) {
      const theta = t0 + (s + g.len * k / 64) / (TAU * rb), M = springTorque(table, theta), P = M * g.arm;
      samples.push({ theta, M, arm: g.arm, P, step: g.step, kind: g.kind });
      lo = Math.min(lo, P); hi = Math.max(hi, P); sum += P; n++;
    }
    s += g.len;
  }
  const mean = sum / n;
  const bareLo = Math.min(...table.rows.map((r) => r[1])), bareHi = Math.max(...table.rows.map((r) => r[1]));
  return { barrel, steps, f, band, rb, rho, trans, segs, cordOnCone: s, samples, spread: (hi - lo) / mean, mean, lo, hi,
    bare: (bareHi - bareLo) / ((bareHi + bareLo) / 2), ok: f > 0 && f <= 1 + 1e-12 && Number.isFinite(lo) };
}
// THE STEPS' PLANES along the axle, from the base step's front face: steps
// stand face to face, each its origin at its slab's middle, and each wrap lies
// in its groove's middle — or, where the
// floor is wider than one cord (the 8 × 17.5's channel holds three), on the side
// nearest the step before it. frameFusee places the steps by this; a crossing's
// axial leg is the difference of two wrap planes.
export function stepPlanes(steps, { halfWidth = FUSEE_DIM_MM.halfWidth, floorHalf = FUSEE_DIM_MM.floorHalf, grooveOff = FUSEE_DIM_MM.grooveOff } = {}) {
  let y = 0;
  return steps.map((p, j) => {
    // §285: a groove whose floor stands `grooveOff` along the part's Z from its
    // origin (each part mounted Z along +y, as fuseeBuild places it)
    const w = halfWidth[p], mid = y + w, g = mid + (grooveOff?.[p] ?? 0), wrapY = j === 0 ? g : g - floorHalf[p];
    const out = { part: p, y0: y, y1: y + 2 * w, mid, wrapY };
    y += 2 * w;
    return out;
  });
}
// Every barrel and every descending set of steps from the catalogue, ranked:
// the least spread first, then the fewest steps (parts), then the smaller
// barrel. A step is a STEP only if its seat stands a cord diameter below the
// one before it — lower, the wrap beneath could not guide the next one up
// (the half bush and the bush with two flanges sit 0.085 mm apart, so they
// are never both steps); a barrel must hold the run in ONE layer (run ≤ its
// capacity, in wraps), or its radius would change mid-run.
export function solveFusee(table, { pulleys = FUSEE_PULLEYS, seat = FUSEE_DIM_MM.seat, capacity = FUSEE_DIM_MM.capacity,
  halfWidth = FUSEE_DIM_MM.halfWidth, floorHalf = FUSEE_DIM_MM.floorHalf, grooveOff = FUSEE_DIM_MM.grooveOff, maxSteps = Infinity } = {}) {
  const twoC = 2 * FUSEE_DIM_MM.cordR, band = springBand(table);
  const ranked = [];
  const barrels = pulleys.filter((b) => band <= capacity[b] + 1e-12);
  // the longest run any barrel can lay: a cone whose UPPER wraps alone pass it
  // cannot run, and nor can any cone that adds a step below them, so the
  // descending sets are grown a step at a time and cut there (§285: the
  // catalogue is library-sized; 2^n masks are not)
  const most = Math.max(0, ...barrels.map((b) => TAU * seat[b] * band));
  const subsets = [];
  const bySeat = pulleys.map((p, i) => [p, i]).sort((a, b) => seat[b[0]] - seat[a[0]] || a[1] - b[1]).map(([p]) => p);
  const grow = (s, upper, from) => {
    if (s.length) subsets.push(s);
    if (s.length >= maxSteps) return;
    for (let i = from; i < bySeat.length; i++) {
      const q = bySeat[i];
      if (s.length && seat[s[s.length - 1]] - seat[q] < twoC) continue;
      const up = s.length ? upper + TAU * seat[q] : 0;
      if (up > most) continue;
      grow([...s, q], up, i + 1);
    }
  };
  grow([], 0, 0);
  for (const barrel of barrels) for (const steps of subsets) {
    const r = fuseeRun(table, barrel, steps, { seat, halfWidth, floorHalf, grooveOff });
    if (r.ok) { const { samples, ...light } = r; ranked.push(light); }   // the samples are re-read for the answer alone
  }
  // the least spread, then the fewest steps (parts), then the smaller barrel,
  // then catalogue order (parts that read the same seat — the four half bushes
  // — tie exactly, and the first listed stands)
  const at = new Map(pulleys.map((p, i) => [p, i]));
  const order = (r) => [at.get(r.barrel), ...r.steps.map((p) => at.get(p))];
  const lex = (a, b) => { const x = order(a), y = order(b); for (let k = 0; k < Math.min(x.length, y.length); k++) if (x[k] !== y[k]) return x[k] - y[k]; return x.length - y.length; };
  ranked.sort((a, b) => a.spread - b.spread || a.steps.length - b.steps.length || seat[a.barrel] - seat[b.barrel] || lex(a, b));
  if (ranked.length) ranked[0] = fuseeRun(table, ranked[0].barrel, ranked[0].steps, { seat, halfWidth, floorHalf, grooveOff });
  return { best: ranked[0] ?? null, ranked };
}
// THE IDEAL r(θ): the radius that would hold the staircase's own mean product
// exactly, P̄/M(θ). Each step's seat against it at the step's two ends.
export function idealAgainst(run) {
  const out = [];
  for (const [j, p] of run.steps.entries()) {
    const ss = run.samples.filter((s) => s.step === j && s.kind === 'wrap');
    const a = ss[0], b = ss[ss.length - 1];
    out.push({ part: p, seat: run.rho[j], from: a.theta, to: b.theta, idealFrom: run.mean / a.M, idealTo: run.mean / b.M });
  }
  return out;
}

// THE DECLARED ANSWER (probe-technic-fusee re-solves and fails when the solve
// answers otherwise). Landing H's: two steps on the pulley wheel 5D, the wedge
// belt wheel then the 8 × 17.5 rim (40.1%). §285's, over the surveyed
// catalogue: still two steps on the pulley wheel 5D, but the thin tread
// sprocket's hub groove (a little over three quarters of a wrap) then the
// 8 × 18 rim's deep centre groove (one wrap). A third step wins nowhere in it.
export const TECHNIC_FUSEE = Object.freeze({ barrel: '3736', steps: Object.freeze(['32089', '56903']) });

// THE CORD: the shortest string whose length between its studs reaches the
// whole path at full wind — hook leg, cone, span, the barrel's dead wrap and
// leg — with the rest wound DEAD on the barrel, which must still hold dead +
// run in one layer (its capacity).
export function cordChoice(pathNoDead, run, { strings = FUSEE_STRINGS, len = FUSEE_DIM_MM.string, capacity = FUSEE_DIM_MM.capacity } = {}) {
  const room = (capacity[run.barrel] - run.band) * TAU * run.rb;
  const opts = Object.entries(strings).map(([studs, part]) => ({ studs: Number(studs), part, length: len[part], dead: len[part] - pathNoDead }));
  const fit = opts.filter((o) => o.dead >= 0 && o.dead <= room + 1e-9).sort((a, b) => a.length - b.length);
  return { choice: fit[0] ?? null, opts, room };
}


// ── §285 — THE CENTRE PINION: the going train's next wheel ─────────────────
// Landing H stopped at the great wheel: the last thing that turned. A third
// step on the cone was the owner's first reading of "another gear", and §285's
// survey refused it (solveFusee answers two steps over the whole library's
// usable grooves), so the other gear is the steel train's next member: the
// CENTRE PINION the great wheel drives (TRAIN.barrel, 120 : 7 — a step-up of
// 17.1). One LEGO mesh off the 40T cannot reach that, so the pinion is the
// catalogue gear that meshes the 40T in parallel ON THE LATTICE (catalogueMesh,
// the going-train rule every fork row is held to) and whose step-up 40/n
// stands nearest the steel's, by ratio (|log|): the 8T, 5×, at 24 mm. The rest
// of the steel's step-up is the next mesh's, which this module does not build
// — the pinion turns, and drives nothing.
export function solveCentrePinion(cat = CATALOGUES.technic_classic, { driverTeeth = 40, steel = TRAIN.barrel } = {}) {
  const a = cat.counts.find((c) => c.teeth === driverTeeth), want = steel.teeth / steel.pinion;
  const ranked = cat.counts.map((b) => ({ b, m: catalogueMesh(a, b, cat) })).filter(({ m }) => m && m.class === 'parallel')
    .map(({ b, m }) => ({ teeth: b.teeth, part: b.part, cd: m.cd, ratio: driverTeeth / b.teeth, off: Math.abs(Math.log(driverTeeth / b.teeth / want)) }))
    .sort((p, q) => p.off - q.off || p.teeth - q.teeth);
  return { best: ranked[0] ?? null, ranked, steel: { teeth: steel.teeth, pinion: steel.pinion, ratio: want } };
}
// THE DECLARED ANSWER (probe-technic-fusee re-solves and fails when the solve
// answers otherwise).
export const FUSEE_CENTRE = Object.freeze({ teeth: 8, part: '3647', cd: 24 });
// ITS ANGLE travels the mesh (standing rule 2): the pinion is phased so a
// tooth of each part meets on the line of centres, read off each part's own
// tooth phase (technic-ldraw's toothPhase, the law ldrawBuild meshes every row
// by), and from there turns −40/8 of the great wheel's every turn.
const phaseCache = new Map();
const partPhase = (lib, part, n) => { const k = `${part}/${n}`; if (!phaseCache.has(k)) phaseCache.set(k, toothPhase(lib, part, n).theta); return phaseCache.get(k); };
export function centrePhase(lib, phiG, { great = { part: FUSEE_PARTS.greatWheel, teeth: 40 }, centre = FUSEE_CENTRE, alpha = 0 } = {}) {
  const Aang = phiG + partPhase(lib, great.part, great.teeth);
  const Bang = alpha + Math.PI + (Math.PI - great.teeth * (Aang - alpha)) / centre.teeth;
  return Bang - partPhase(lib, centre.part, centre.teeth);
}
export const centreRatio = (centre = FUSEE_CENTRE) => 40 / centre.teeth;

// ── THE FRAME (mm: x across, y along the axles, z up from the baseplate) ────
// Two lines on one baseplate: the BARREL's axle at x = 0 and the MAIN line at
// x = cd, three collinear axles end to end in two round pin joiners (62462),
// which hold their ends on one line and let them turn apart:
//   F, the FUSEE: the knob (outboard), its front column, the hook plate, the
//     steps base first, its back column, the CLICK WHEEL (16T keyed);
//   M, the MAINTAINING axle (3L, carried by the joiners alone): the RATCHET
//     (40T); in joiner A's gap the click's pawl on an axle keyed in one of the
//     ratchet's holes; in joiner B's gap the band's peg in the opposite hole;
//   G, the GREAT WHEEL (40T, its peg in a hole), and its two columns.
// The MAINTAINING DETENT is a second pawl on a frame pivot: its 8T in the
// ratchet's teeth, its arm in joiner B's gap, its pivot axle forward through
// two Technic bricks beside joiner A.
//
// THE CENTRE DISTANCE: the barrel's pulley stands in the cone's slab (its
// groove midway between the outermost wraps' planes), so its rim must pass
// every step's by the clearance floor: cd ≥ rim(barrel) + the largest step rim
// + AX_CLEAR (one LDU, CLEAR's), on the 4 mm lattice — landing H's 18.68 +
// 12.00 + 0.4 → 32; §285's 18.68 + 13.10 + 0.4 → 36 (the sprocket's teeth stand
// out past its groove's walls; at 32 they passed the barrel's rim by 0.32 mm).
// THE AXLE HEIGHT: columnFor the largest tip or rim on either line.
// THE CLICK'S WHEEL IS A 16T: the click's pawl pivots at its liftarm's round
// MIDDLE hole on the ratchet's 8 mm hole and carries its 8T at an END hole,
// 8 mm on — so the 8T can reach 12 mm from the axis, the 8:16 mesh, with the
// arm meeting the radius at 97°. A 24T's 16 mm mesh would put the arm straight
// along the radius (8 + 8 = 16), where a pawl neither locks nor frees.
// AXIAL CLEARANCE between parts that turn apart: one LDU (0.4 mm), the CLEAR
// test's own floor — the click's arm off the ratchet's front face, the
// detent's arm off its back face.
export const AX_CLEAR = 0.4;
export function frameFusee(spec = TECHNIC_FUSEE, maint = MAINTAINING, centre = FUSEE_CENTRE) {
  const F = FUSEE_DIM_MM, half = D.stud / 2;
  const cd = Math.ceil((F.rim[spec.barrel] + Math.max(...spec.steps.map((p) => F.rim[p])) + AX_CLEAR) / 4) * 4;
  const tipG = GEAR_TIP_MM[FUSEE_PARTS.greatWheel];
  const col = columnFor(Math.max(tipG, F.rim[spec.barrel]));
  const zA = r6(col.z);
  // ── F: the hook plate's top face at y = 0; the hook's end stud stands on
  // it, its own stud against the base step's face (endH + endStudH on)
  const yTop = 0;
  const y0 = yTop + F.endH + F.endStudH;
  const steps = stepPlanes(spec.steps).map((s) => ({ part: s.part, y: r6(y0 + s.mid), wrapY: r6(y0 + s.wrapY), y0: r6(y0 + s.y0), y1: r6(y0 + s.y1),
    seat: F.seat[s.part], rim: F.rim[s.part] }));
  const y = steps[steps.length - 1].y1;
  const coneEnd = y;
  const hookPlate = { part: FUSEE_PARTS.hookPlate, top: yTop, y0: yTop - F.plateH, y1: yTop, cordY: r6(yTop + F.endH - F.endCord) };
  // columns on the stud grid, flush or more outside the parts they hold
  const fFront = Math.floor((hookPlate.y0 - half) / D.stud) * D.stud;
  const fBack = Math.ceil((coneEnd + half) / D.stud) * D.stud;
  // the click wheel one LDU off the back column: the click's 8T rides round
  // in its slab, flush with its faces, and must pass the column's face
  const k0 = fBack + half + AX_CLEAR, k1 = k0 + 2 * F.clickHalf;
  // joiner A holds F's end and M's; the click's arm lies BEHIND it, between
  // its end and the ratchet, because the arm's edge reaches 3.8 mm from the
  // axis and the joiner is 4 mm round (measured touching when it lay over the
  // joiner). So M runs on the next axle up, the 4L, and its 7.8 mm of spare
  // length is that space: the arm, a clearance either side, and the rest
  const jA0 = k1, jA1 = jA0 + 2 * F.connectorHalf, jAmid = (jA0 + jA1) / 2;
  const mLen = 4 * D.stud - 0.4, armSpace = mLen + 0.2 - F.connectorHalf - 2 * F.wheelHalf - F.connectorHalf;
  const r0 = r6(jA1 + armSpace), r1 = r0 + 2 * F.wheelHalf, rMid = (r0 + r1) / 2;
  const jB0 = r1, jB1 = jB0 + 2 * F.connectorHalf, jBmid = (jB0 + jB1) / 2;
  const g0 = jB1, g1 = g0 + 2 * F.wheelHalf, gMid = (g0 + g1) / 2;
  const gCol1 = Math.ceil((g1 + half + AX_CLEAR) / D.stud) * D.stud, gCol2 = gCol1 + D.stud;   // the great wheel's peg rides round flush with its back face
  // §285: the centre pinion in the great wheel's slab, on the far side of the
  // main line from the barrel, its centre distance the mesh's; its two columns
  // on the great wheel's two stud slots
  const xC = cd + centre.cd;
  // the knob one stud gap outside the front column, as the keyless crown is
  const knobY = fFront - half - D.stud + 2;                            // 4185a is 4 mm wide
  // ── the barrel line: its groove midway between the cone's two wrap planes
  // (the cord's fleet angle the least either way); its hook plate in front of
  // it by the hook's height, as the cone's is
  const wrapYs = steps.map((s) => s.wrapY);
  const yb = r6((Math.min(...wrapYs) + Math.max(...wrapYs)) / 2);
  const bw = F.halfWidth[spec.barrel], yo = r6(yb - (F.grooveOff[spec.barrel] ?? 0));   // §285: the part's origin, its groove's floor at yb
  const bHookTop = r6(yo - bw - F.endH - F.endStudH);
  const bFront = Math.floor((bHookTop - F.plateH - half) / D.stud) * D.stud;
  const bBack = Math.ceil((yo + bw + half) / D.stud) * D.stud;
  // AXLES: the library trims each axle end by half an LDU (0.2 mm). F ends in
  // joiner A's middle and G starts in joiner B's; M is the longest axle that
  // fits between them (the 3L, 23.6 of the joiners' 24), centred.
  const trim = 0.2, lens = Object.keys(AXLE_PARTS).map(Number).sort((p, q) => p - q);
  const axleSpan = (shaft, x, z, a0, a1, fix) => {
    const need = a1 - a0;
    const n = fix === 'fit' ? [...lens].reverse().find((v) => v * D.stud - 2 * trim <= need + 1e-9) : lens.find((v) => v * D.stud - 2 * trim >= need - 1e-9);
    const len = n * D.stud - 2 * trim;
    const [y0, y1] = fix === 'back' ? [a1 - len, a1] : fix === 'front' ? [a0, a0 + len] : [(a0 + a1 - len) / 2, (a0 + a1 + len) / 2];
    return { shaft, x, z, y0: r6(y0), y1: r6(y1), part: AXLE_PARTS[n], lenStuds: n };
  };
  const axles = [
    axleSpan('barrel', 0, zA, bFront - half, bBack + half, 'mid'),
    axleSpan('fusee', cd, zA, knobY - 2, jAmid, 'back'),
    axleSpan('maintaining', cd, zA, jAmid, jBmid, 'fit'),
    axleSpan('great', cd, zA, jBmid, gCol2 + half, 'front'),
    axleSpan('centre', xC, zA, g0, gCol2 + half, 'back'),
  ];
  const column = (shaft, end, x, yc, holeZ) => {
    const onGrid = mod(x, D.stud) === 0;
    const stack = [{ part: onGrid ? FRAME_PARTS.plate1x1 : FRAME_PARTS.jumper1x2, h: D.plateH, dx: onGrid ? half : D.stud }];
    const m = Math.round((holeZ - D.holeZ - D.plateH) / D.plateH);   // plate-heights between the bottom plate and the Technic brick
    if (Math.abs(D.plateH * (1 + m) + D.holeZ - holeZ) > 1e-6 || m < 0) return null;
    const k = Math.floor(m / 3), p = m - 3 * k;
    for (let i = 0; i < p; i++) stack.push({ part: FRAME_PARTS.plate1x1, h: D.plateH, dx: half });
    for (let i = 0; i < k; i++) stack.push({ part: FRAME_PARTS.brick1x1, h: D.brickH, dx: half });
    stack.push({ part: FRAME_PARTS.technicBrick1x1, h: D.brickH, dx: half, hole: true });
    let zz = 0;
    const boxes = stack.map((s) => { const b = { part: s.part, x0: x - s.dx, x1: x + s.dx, y0: yc - half, y1: yc + half, z0: r6(zz), z1: r6(zz + s.h), hole: !!s.hole }; zz += s.h; return b; });
    return { shaft, end, x, y: yc, onGrid, boxes, holeZ: r6(zz - D.brickH + D.holeZ) };
  };
  const columns = [
    column('barrel', 'front', 0, bFront, zA), column('barrel', 'back', 0, bBack, zA),
    column('fusee', 'front', cd, fFront, zA), column('fusee', 'back', cd, fBack, zA),
    column('great', 'front', cd, gCol1, zA), column('great', 'back', cd, gCol2, zA),
    column('centre', 'front', xC, gCol1, zA), column('centre', 'back', xC, gCol2, zA),
  ];
  // THE MAINTAINING PARTS' SLABS (the pivots' places in the plane come from
  // MAINTAINING, solved by solveMaintaining)
  const click = { y0: k0, y1: k1, y: (k0 + k1) / 2 };
  const clickArm = { y0: r6(r0 - AX_CLEAR - 2 * KEYLESS_PULL_DIM_MM.armHalfThick), y1: r6(r0 - AX_CLEAR) };
  const detentArm = { y0: r6(r1 + AX_CLEAR), y1: r6(r1 + AX_CLEAR + 2 * KEYLESS_PULL_DIM_MM.armHalfThick) };
  const det = maint.detent, px = cd + det.pivot[0], pz = r6(zA + det.pivot[1]);
  // its two columns on the first two stud-grid slots past the click wheel
  const slot0 = Math.ceil((jA0 + half) / D.stud) * D.stud, slots = [slot0, slot0 + D.stud];
  const detentCols = slots.map((yc, i) => column('detent', i ? 'back' : 'front', px, yc, pz));
  const detentAxle = axleSpan('detent', px, pz, slot0 - half, detentArm.y1, 'front');
  const frame = {
    key: 'fusee', gen: 'technic_classic', cd, axleZ: zA, column: col, spec,
    barrel: { x: 0, part: spec.barrel, y: yb, origin: yo, y0: r6(yo - bw), y1: r6(yo + bw), seat: F.seat[spec.barrel], rim: F.rim[spec.barrel],
      hook: { part: FUSEE_PARTS.hookPlate, top: bHookTop, y0: r6(bHookTop - F.plateH), y1: bHookTop, cordY: r6(bHookTop + F.endH - F.endCord) } },
    fusee: { x: cd, hookPlate, steps, knob: { part: FUSEE_PARTS.knob, y: knobY }, click: { part: FUSEE_PARTS.clickWheel, teeth: 16, ...click } },
    joiners: [{ y: jAmid, y0: jA0, y1: jA1 }, { y: jBmid, y0: jB0, y1: jB1 }],
    ratchet: { part: FUSEE_PARTS.ratchet, teeth: 40, y: rMid, y0: r0, y1: r1 },
    great: { part: FUSEE_PARTS.greatWheel, teeth: 40, y: gMid, y0: g0, y1: g1 },
    centre: { part: centre.part, teeth: centre.teeth, x: xC, y: gMid, y0: g0, y1: g1, cd: centre.cd },
    clickArm, detentArm, detent: { pivot: { x: px, z: pz }, axle: detentAxle, columns: detentCols },
    axles: [...axles, detentAxle], columns: [...columns, ...detentCols],
  };
  if (frame.columns.some((c) => !c)) return { ...frame, framed: false, reason: 'a column is off the plate lattice' };
  const xs = frame.columns.flatMap((c) => c.boxes.flatMap((b) => [b.x0, b.x1])), ys = frame.columns.flatMap((c) => c.boxes.flatMap((b) => [b.y0, b.y1]));
  frame.base = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  frame.base.studsX = (frame.base.x1 - frame.base.x0) / D.stud; frame.base.studsY = (frame.base.y1 - frame.base.y0) / D.stud;
  frame.framed = true;
  return frame;
}

// ── PAWLS: a keyed 8T on a thin liftarm against a toothed wheel ─────────────
// In a wheel's plane, coordinates (u, v) = LDraw (X, Y) in mm about the
// wheel's axis — u = x, v = −z — so an angle counter-clockwise in (u, v) is a
// turn about the frame's +y, the sense LDraw's rotZ turns every body here.
// Gears are star-shaped about their axes, so each is its outer radius per
// angle, r(φ), read off its sampled surface in 0.1° bins; a point is inside a
// gear when it stands nearer its centre than r at its angle. PENETRATION of
// two gears is the deepest any boundary point of one stands inside the other.
const BINS = 3600;
const profCache = new Map();
export function starProfile(lib, part) {
  if (profCache.has(part)) return profCache.get(part);
  const r = new Float64Array(BINS);
  for (const [x, y] of surfaceSamples(lib, part, 0.25)) {
    const k = Math.floor(mod(Math.atan2(y, x) / TAU, 1) * BINS) % BINS;
    r[k] = Math.max(r[k], Math.hypot(x, y) * LDU_MM);
  }
  for (let i = 0; i < BINS; i++) if (!r[i]) {
    let a = 1, b = 1;
    while (!r[(i - a + BINS) % BINS]) a++;
    while (!r[(i + b) % BINS]) b++;
    r[i] = Math.max(r[(i - a + BINS) % BINS], r[(i + b) % BINS]);
  }
  let tip = 0; for (const v of r) tip = Math.max(tip, v);
  const out = { r, tip };
  profCache.set(part, out);
  return out;
}
const rAt = (P, phi) => { const t = mod(phi / TAU, 1) * BINS, i = Math.floor(t) % BINS, f = t - Math.floor(t); return P.r[i] * (1 - f) + P.r[(i + 1) % BINS] * f; };
export function penetration(A, ca, aa, B, cb, ab) {
  let worst = -Infinity;
  for (const [P, c1, a1, Q, c2, a2] of [[A, ca, aa, B, cb, ab], [B, cb, ab, A, ca, aa]]) {
    for (let i = 0; i < BINS; i += 2) {
      const r = Q.r[i];
      if (r < 0.6 * Q.tip) continue;
      const phi = i / BINS * TAU, px = c2[0] + r * Math.cos(phi + a2), py = c2[1] + r * Math.sin(phi + a2);
      const dx = px - c1[0], dy = py - c1[1], d = Math.hypot(dx, dy);
      if (d > P.tip + 0.01) continue;
      worst = Math.max(worst, rAt(P, Math.atan2(dy, dx) - a1) - d);
    }
  }
  return worst;
}
// A PAWL: the wheel at the origin turned θ; the arm's pivot at `pivot`, the 8T
// `arm` mm along it at angle ψ and keyed to it (its own X along the arm: an
// 8T's quarter turn is two teeth, so the four ways a cross axle keys it are
// one); the band turns ψ in `sense` until the 8T first touches.
// (`part` is the follower on the arm: the 8T here; landing I's detent rides a
// round half bush on the same law.)
export function pawlModel(lib, { wheel, pivot, arm, sense, part = FUSEE_PARTS.pawl }) {
  const W = starProfile(lib, wheel), P = starProfile(lib, part);
  const at = (psi) => [pivot[0] + arm * Math.cos(psi), pivot[1] + arm * Math.sin(psi)];
  const depth = (psi, theta) => penetration(W, [0, 0], theta, P, at(psi), psi);
  const seat = (theta) => {
    const far = Math.atan2(pivot[1], pivot[0]);            // the 8T straight out from the wheel
    let prev = far, hit = null;
    for (let k = 1; k <= 360; k++) { const p = far + sense * k * Math.PI / 180; if (depth(p, theta) > 0) { hit = p; break; } prev = p; }
    if (hit === null) return null;
    let a = prev, b = hit;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (depth(m, theta) > 0) b = m; else a = m; }
    return a;
  };
  return { W, P, at, depth, seat };
}
// WHICH WAY DOES IT LOCK? The wheel is turned in small steps one way from the
// seat and the pawl followed CONTINUOUSLY: where the 8T would enter the wheel
// it is lifted against its band by the least turn that clears it, then the
// band drops it back to touch. Riding a flank, the lift per step is the step
// times the flank's slope; against a lock the 8T would have to jump clear of
// a tooth in one step. So the measure is the steepest LIFT RATE, dψ/dθ, over
// a pitch and a half each way: a flank's is a few; LOCKED is the direction
// whose rate is over ten times the other's (an order of magnitude — a wall,
// not a slope). Traced at two step sizes, a quarter apart, so the reading is
// seen not to be the step's.
export const LOCK_RATIO = 10;
export function pawlLock(lib, pawlSpec, teeth, { theta0 = 0, divs = [64, 256] } = {}) {
  const m = pawlModel(lib, pawlSpec), s = pawlSpec.sense;
  const trace = (dir, div) => {
    let psi = m.seat(theta0), theta = theta0, rate = 0;
    if (psi === null) return null;
    const h = TAU / teeth / div, dpsi = 2e-4;
    for (let k = 0; k < 1.5 * div; k++) {
      theta += dir * h;
      let lift = 0;
      while (m.depth(psi, theta) > 0 && lift < 0.6) { psi -= s * dpsi; lift += dpsi; }
      rate = Math.max(rate, lift / h);
      let drop = 0;
      while (m.depth(psi + s * dpsi, theta) <= 0 && drop < 0.6) { psi += s * dpsi; drop += dpsi; }
    }
    return rate;
  };
  const out = { seat: m.seat(theta0) };
  if (out.seat === null) return { ...out, locks: 0 };
  for (const [name, dir] of [['plus', 1], ['minus', -1]]) out[name] = divs.map((d) => trace(dir, d));
  const fine = (k) => out[k][out[k].length - 1];
  out.locks = fine('plus') > LOCK_RATIO * fine('minus') ? 1 : fine('minus') > LOCK_RATIO * fine('plus') ? -1 : 0;
  return out;
}
// The off-centre axle holes a gear part draws as primitives, at their radius.
export function axleHoleOffsets(lib, part) {
  return placements(lib, `${part}.dat`, /axlehol/).map((p) => [p.m[0] * LDU_MM, p.m[1] * LDU_MM]).filter(([x, y]) => Math.hypot(x, y) > 1e-6);
}

// ── THE MAINTAINING POWER ───────────────────────────────────────────────────
// GOING: the cord leaves the cone toward the barrel, an open belt over the
// top of both (each wound the same way), so its tension turns F in the sense
// of its moment there. In (u, v) about F's axis the departure is ρ·n̂, where n̂
// is the open belt's normal (n̂·(F − B) = ρ_b − ρ, upward), and the moment of a
// tension t̂ toward the barrel is ρ (n̂ × t̂). Read off the frame, not declared.
export function spanTangent(frame, rhoC, rhoB = frame.barrel.seat) {
  const cd = frame.cd - frame.barrel.x, nu = (rhoB - rhoC) / cd, nv = -Math.sqrt(1 - nu * nu);   // v < 0 is up
  const pC = [rhoC * nu, rhoC * nv], pB = [-cd + rhoB * nu, rhoB * nv];                          // about F's axis
  const t = [pB[0] - pC[0], pB[1] - pC[1]], L2 = Math.hypot(...t);
  return { n: [nu, nv], pC, pB, len2d: L2, t: [t[0] / L2, t[1] / L2] };
}
export function goingSense(frame) {
  const top = frame.fusee.steps[frame.fusee.steps.length - 1];
  const { pC, t } = spanTangent(frame, top.seat);
  return Math.sign(pC[0] * t[1] - pC[1] * t[0]);
}
// THE BAND: from the peg in the ratchet's hole opposite the click's pivot to a
// peg in a hole of the great wheel. Its stretch is POSED, as an angle: the
// great wheel stands BAND_LAG_DEG behind the ratchet in the going sense. The
// moment it puts on the great wheel (the band pulling its peg toward the
// ratchet's) is read off the two pegs' places.
export const BAND_LAG_DEG = 60;
export function bandMoment(going, { lagDeg = BAND_LAG_DEG, phiM = 0, holeR = FUSEE_DIM_MM.wheelHole } = {}) {
  const aR = phiM + Math.PI, aG = aR - going * lagDeg * Math.PI / 180;
  const pR = [holeR * Math.cos(aR), holeR * Math.sin(aR)], pG = [holeR * Math.cos(aG), holeR * Math.sin(aG)];
  const f = [pR[0] - pG[0], pR[1] - pG[1]];
  return { great: Math.sign(pG[0] * f[1] - pG[1] * f[0]), ratchet: Math.sign(pR[0] * -f[1] - pR[1] * -f[0]), pR, pG, aR, aG };
}
// THE DECLARED MAINTAINING POWER, re-solved by solveMaintaining (the probe
// fails when it answers otherwise): the click pawl on the ratchet's hole at
// its own +u, its band sense the one that locks it when F runs in the going
// sense against the ratchet; the detent's pivot (mm off the main axis, x and
// z) and band sense the first that locks the ratchet against running back.
export const MAINTAINING = Object.freeze({
  click: Object.freeze({ sense: -1 }),
  detent: Object.freeze({ pivot: Object.freeze([-28, -16]), sense: -1 }),
});
// The click in M's frame: the 16T at the origin, the pivot in the ratchet's
// hole on +u, the 8T 8 mm out on the liftarm.
export const clickSpec = (sense) => ({ wheel: FUSEE_PARTS.clickWheel, pivot: [FUSEE_DIM_MM.wheelHole, 0], arm: FUSEE_DIM_MM.armMid, sense });
// The detent in the ratchet's frame: (u, v) = (dx, −dz).
export const detentSpec = (pivot, sense) => ({ wheel: FUSEE_PARTS.ratchet, pivot: [pivot[0], -pivot[1]], arm: KEYLESS_PULL_DIM_MM.armHoles, sense });
// THE CLICK'S SWEPT RADIUS about the main axis: the farthest its 8T's tip or
// its arm's edge reaches as it rides round with the ratchet.
export function clickSweep(lib, seatPsi) {
  const c = clickSpec(0), P = starProfile(lib, FUSEE_PARTS.pawl);
  const q = [c.pivot[0] + c.arm * Math.cos(seatPsi), c.pivot[1] + c.arm * Math.sin(seatPsi)];
  return Math.max(Math.hypot(...q) + P.tip, Math.hypot(...q) + FUSEE_DIM_MM.armHalfWidth, Math.hypot(...c.pivot) + FUSEE_DIM_MM.armHalfWidth);
}
// THE DETENT'S PIVOT, searched over the frame's lattice: x on the 4 mm grid
// (a jumper takes the half stud), z a Technic brick's hole height; within the
// arm's reach of a point 24 mm out (the 8:40 mesh); the pivot axle clear of
// both 40Ts' tips (it passes the ratchet's slab); its columns, in joiner A's
// gap, clear of the click's sweep; the arm clear of the band's pegs. Ranked by
// the fewest parts in a column (the lowest hole), then the arm nearest square
// to the radius at the 8T, then the smallest |x|; the first whose band seats
// it and whose pawl LOCKS THE RATCHET AGAINST RUNNING BACK is the answer.
export function solveMaintaining(lib, frame, { going = goingSense(frame), limit = 12 } = {}) {
  const F = FUSEE_DIM_MM, half = D.stud / 2, zA = frame.axleZ;
  const cdMesh = (8 + 40) / 2, arm = KEYLESS_PULL_DIM_MM.armHoles;
  const tip40 = GEAR_TIP_MM[FUSEE_PARTS.greatWheel];
  // the click first: the sense that locks it when F runs `going` against M
  const click = [1, -1].map((sense) => ({ sense, lock: pawlLock(lib, clickSpec(sense), 16) }));
  const clickPick = click.find((c) => c.lock.locks === going) ?? null;
  const sweep = clickPick ? clickSweep(lib, clickPick.lock.seat) : Infinity;
  const pegSweep = F.wheelHole + D.axleR;
  const cands = [];
  for (let dx = -40; dx <= 40; dx += 4) for (let m = 0; m <= 14; m++) {
    const z = r6(D.plateH + D.holeZ + D.plateH * m), dz = r6(z - zA), d = Math.hypot(dx, dz);
    if (Math.abs(d - cdMesh) > arm - 1e-9 || d < tip40 + D.axleR) continue;
    // the columns: a box x ± half (a jumper's bottom plate ± a stud), z from 0
    // to the brick's top, against the click's sweep about the main axis
    const box = (x0, x1, z0, z1) => Math.hypot(Math.max(x0 - frame.cd, 0, frame.cd - x1), Math.max(z0 - zA, 0, zA - z1));
    const x = frame.cd + dx, onGrid = mod(x, D.stud) === 0;
    const colClear = Math.min(box(x - half, x + half, 0, z + D.brickH - D.holeZ), box(x - (onGrid ? half : D.stud), x + (onGrid ? half : D.stud), 0, D.plateH));
    if (!(colClear > sweep)) continue;
    // the 8T 24 mm out and 16 from the pivot: two places; the band picks one
    for (const sense of [1, -1]) cands.push({ dx, dz, z, m, sense, colClear });
  }
  const scored = [];
  for (const c of cands) {
    const spec = detentSpec([c.dx, c.dz], c.sense), mdl = pawlModel(lib, spec), psi = mdl.seat(0);
    if (psi === null) continue;
    const q = mdl.at(psi), dq = Math.hypot(...q);
    // the arm's segment from the pivot to the 8T against the band's pegs
    const p = spec.pivot, t = Math.max(0, Math.min(1, -((p[0]) * (q[0] - p[0]) + (p[1]) * (q[1] - p[1])) / ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2)));
    const near = Math.hypot(p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])) - F.armHalfWidth;
    if (!(near > pegSweep)) continue;
    const square = Math.abs(((q[0] - p[0]) * q[0] + (q[1] - p[1]) * q[1]) / (arm * dq));
    scored.push({ ...c, psi, eightT: q, armNear: near, square });
  }
  scored.sort((a, b) => a.m - b.m || a.square - b.square || Math.abs(a.dx) - Math.abs(b.dx) || b.sense - a.sense);
  const tried = [];
  let pick = null;
  for (const c of scored.slice(0, limit)) {
    const lock = pawlLock(lib, detentSpec([c.dx, c.dz], c.sense), 40);
    tried.push({ ...c, lock });
    if (lock.locks === -going) { pick = { ...c, lock }; break; }
  }
  return { going, click, clickPick, sweep, candidates: cands.length, seated: scored.length, tried, pick };
}

// ── THE RUN'S STATE: how much cord is off the cone (§282) ───────────────────
// `paid` is the cord that has left the cone for the barrel since full wind, in
// mm: 0 at full wind, run.cordOnCone at run-down. It is the run's one state
// variable, and every angle of the cone and the barrel is read from it through
// fuseeRun's own segments (the law the solve levelled), never given a rate of
// its own. Paying off reverses winding's order: the top step's wrap first, then
// the crossing down to the step below, then that step's wrap, down to the
// base. Over a segment of arm a, a length ds of cord turns the cone ds/a and the
// barrel ds/ρ_b (fuseeRun's barrel wind is the cord laid over 2πρ_b), so on
// every segment the cone's turn × a equals the barrel's × ρ_b: that equality,
// step by step, is what the staircase is.
export const coneTurnTotal = (run) => run.segs.reduce((s, g) => s + g.len / g.arm, 0);
// The segment the cord is leaving with `laid` mm still on the cone, counted
// from the base the way fuseeRun lays it: the first whose far end reaches
// `laid`, so a boundary belongs to the segment below it (where the cord lies
// once the one above has gone).
function segAt(run, laid) {
  let cum = 0;
  for (let i = 0; i < run.segs.length; i++) {
    const g = run.segs[i];
    if (laid <= cum + g.len + 1e-12 || i === run.segs.length - 1) return { i, g, cum, inSeg: Math.min(g.len, Math.max(0, laid - cum)) };
    cum += g.len;
  }
  return null;
}
// THE STATE AT `paid`: the segment and step the cord is leaving, the cone's
// turn (turnF) and the barrel's (turnB) from full wind, in radians, unsigned
// (both turn the going sense, goingSense: an open belt), the barrel's wind
// θ in turns from run-down, and the torque the TABLE gives there (M, the
// spring's; P = M × arm, what the cone delivers — fuseeRun's level product,
// read at one point). `table` is the one the run was solved on.
export function runState(run, paid, table = TECHNIC_FUSEE_SPRING) {
  const laid = run.cordOnCone - paid, at = segAt(run, laid);
  let turnF = (at.g.len - at.inSeg) / at.g.arm;
  for (let k = at.i + 1; k < run.segs.length; k++) turnF += run.segs[k].len / run.segs[k].arm;
  const theta = table.rows[0][0] + laid / (TAU * run.rb), M = springTorque(table, theta);
  return { paid, laid, seg: at.i, step: at.g.step, kind: at.g.kind, arm: at.g.arm, inSeg: at.inSeg, turnF, turnB: paid / run.rb, theta, M, P: M * at.g.arm };
}
// The inverse: the cord paid when the cone has turned `turnF` from full wind.
export function paidAtTurn(run, turnF) {
  let left = Math.max(0, turnF), paid = 0;
  for (let k = run.segs.length - 1; k >= 0; k--) {
    const g = run.segs[k], whole = g.len / g.arm;
    if (left <= whole) return paid + left * g.arm;
    paid += g.len; left -= whole;
  }
  return run.cordOnCone;
}

// ── THE CORD, as a path (frame mm), at full wind or at any state of the run ─
// From the cone's hook to the barrel's: the end stud on a hook plate stud,
// the leg out over the base step's rim and down into its groove, the base
// wrap (f of a turn), the crossing to the next step on the tangent, a wrap a
// step, the span to the barrel, the DEAD wrap the string's spare length lays
// on the barrel, and the barrel's leg up over its rim to its own hook. Every
// wrap advances in the going sense from the hook end, so the cord leaves the
// top step exactly where the open belt's tangent does (spanTangent): the base
// wrap's start, and so the hook stud's angle and F's own, are worked back
// from there. The legs and the crossings BEAR on rims and groove walls — a
// contact the model places and does not measure.
//
// §282 — AT `paid` mm OFF THE CONE (0, the default, is full wind, and draws
// the path above point for point). The STRING is the one chosen at full wind:
// it does not change as the watch runs. What is left on the cone is the
// full-wind cone's own cord from its hook, cut short along fuseeRun's segments
// (a wrap at its seat, a crossing along its straight line) and turned with the
// cone by runState's turnF: the cord's last contact is a point OF the cone,
// carried round, so it moves continuously through every step boundary. The
// barrel takes the paid cord at the span's full-wind arrival and turns by
// paid/ρ_b the same way, carrying the dead wrap and its hook round with it.
// The FREE SPAN joins the two, a straight line, and its length is NOT held:
// fuseeRun turns the barrel by the cord laid on the cone alone, as if the span
// stood still, and probe-technic-fusee-loop.mjs reports how far the span's
// length, and the departure's angle off the open belt's tangent, move from
// that over the run — the solve's simplification made visible, not corrected.
export function cordPath(frame, run, { stringPart = null, paid = 0 } = {}) {
  const F = FUSEE_DIM_MM, g = goingSense(frame), c = F.cordR, zA = frame.axleZ;
  const st = frame.fusee.steps;
  const top = st[st.length - 1], sp = spanTangent(frame, top.seat);
  const aDep = Math.atan2(sp.n[1], sp.n[0]);                        // the departure's angle about F (u, v)
  // the angles each step spans, worked back from the departure
  const crossAng = st.slice(1).map((s, j) => Math.acos(s.seat / st[j].seat));
  let a = aDep;
  const spans = [];
  for (let j = st.length - 1; j >= 0; j--) {
    const turn = j === 0 ? run.f * TAU : TAU;
    spans.unshift({ j, a1: a, a0: a - g * turn });
    a -= g * turn;
    if (j > 0) a -= g * crossAng[j - 1];
  }
  const aHook = spans[0].a0;
  // (u, v) about an axis at (x, zA) → frame (x, y, z)
  const P = (x0, r, ang, y) => [x0 + r * Math.cos(ang), y, zA - r * Math.sin(ang)];
  const xF = frame.cd, hp = frame.fusee.hookPlate, b0 = st[0], bar = frame.barrel;
  const aArr = Math.atan2(sp.n[1], sp.n[0]);
  // THE CONE'S CORD with `laid` mm still on it, turned dF with the cone, then
  // the span's arrival on the barrel
  const cone = (laid, dF) => {
    const path = [], mark = [];
    const push = (p, tag) => { path.push(p); if (tag) mark.push({ tag, i: path.length - 1 }); };
    const arc = (x0, r, a0, a1, y0, y1, tag) => {
      const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / 0.6));
      for (let k = 0; k <= n; k++) push(P(x0, r, a0 + (a1 - a0) * k / n, y0 + (y1 - y0) * k / n), k === 0 ? tag : null);
    };
    // the cone's hook and leg
    push(P(xF, F.plateStud, aHook + dF, hp.cordY), 'cone hook');
    push(P(xF, b0.rim + c, aHook + dF, hp.cordY));
    push(P(xF, b0.rim + c, aHook + dF, b0.wrapY));
    // the wraps and crossings: fuseeRun's segments in laying order, as much of
    // each as is still on the cone
    let left = laid, k = 0;
    for (const s of spans) {
      const step = st[s.j];
      // the crossing: from where the last wrap ended, on the tangent onto this step
      if (s.j > 0) {
        const seg = run.segs[k++], on = Math.min(seg.len, left);
        if (!(on > 0)) break;
        const q = P(xF, step.seat, s.a0 + dF, step.wrapY);
        if (on < seg.len - 1e-12) { const p0 = path[path.length - 1], u = on / seg.len; push([0, 1, 2].map((d) => p0[d] + (q[d] - p0[d]) * u), `cross ${s.j}`); break; }
        push(q, `cross ${s.j}`);
        left -= on;
      }
      const seg = run.segs[k++], on = Math.min(seg.len, left);
      if (!(on > 0)) break;
      if (on < seg.len - 1e-12) { arc(xF, step.seat, s.a0 + dF, s.a0 + g * on / step.seat + dF, step.wrapY, step.wrapY, `wrap ${s.j}`); break; }
      arc(xF, step.seat, s.a0 + dF, s.a1 + dF, step.wrapY, step.wrapY, `wrap ${s.j}`);
      left -= on;
    }
    // the span: from the last contact on the cone to the arrival on the barrel
    push(P(bar.x, bar.seat, aArr, bar.y), 'span end');
    return { path, mark };
  };
  // the string is chosen at full wind
  const full = cone(Infinity, 0);
  const coneLen = pathLength(full.path);
  // the barrel's legs: up over its rim and in to its hook's stud, which
  // decides the dead wrap's end; the dead length is what the string leaves
  const legB = (bar.rim + c - bar.seat) + Math.abs(bar.y - bar.hook.cordY) + (bar.rim + c - F.plateStud);
  const noDead = coneLen + legB;
  const choice = cordChoice(noDead, run);
  const str = stringPart ? { part: stringPart, length: F.string[stringPart], dead: F.string[stringPart] - noDead } : choice.choice;
  // the state: the cone's turn and the barrel's, both read off `paid`
  const state = paid > 0 ? runState(run, paid) : null;
  const dF = state ? g * state.turnF : 0, dB = state ? g * paid / bar.seat : 0;
  const { path, mark } = state ? cone(run.cordOnCone - paid, dF) : full;
  const push = (p, tag) => { path.push(p); if (tag) mark.push({ tag, i: path.length - 1 }); };
  const departure = path[path.length - 2];
  // the cord the barrel has TAKEN since full wind, laid at the arrival and
  // turned on with the barrel
  if (state) {
    const n = Math.max(1, Math.ceil(paid / 0.6));
    for (let k = 1; k <= n; k++) push(P(bar.x, bar.seat, aArr + dB * k / n, bar.y), k === 1 ? 'taken' : null);
  }
  // the dead wrap, drawn as n equal chords whose lengths sum to the dead
  // length exactly, so the path is the string's length and not a chord short
  const nDead = Math.max(1, Math.ceil((str?.dead ?? 0) / 0.6));
  const dAng = str && str.dead > 0 ? 2 * Math.asin(str.dead / (2 * nDead * bar.seat)) : 0;
  const aEnd = aArr + dB + g * nDead * dAng;
  for (let k = 1; k <= nDead && dAng; k++) push(P(bar.x, bar.seat, aArr + dB + g * k * dAng, bar.y), k === 1 ? 'dead wrap' : null);
  push(P(bar.x, bar.rim + c, aEnd, bar.y));
  push(P(bar.x, bar.rim + c, aEnd, bar.hook.cordY));
  push(P(bar.x, F.plateStud, aEnd, bar.hook.cordY), 'barrel hook');
  return { path, mark, g, aDep, aHook: aHook + dF, aEnd, spans, crossAng, span: sp, coneLen, legB, noDead, string: str, choice, length: pathLength(path),
    paid, state, dF, dB, departure };
}
export const pathLength = (p) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]), 0);

// ── THE BUILD: LDraw placements (LDU), at full wind (or §282 at `paid`) ─────
// frame (x, y, z) → LDraw (x, −z, y)/0.4, a proper rotation. Each body (the
// barrel, F, M, G, the two pawls) is placed at its pose: F's and the barrel's
// angles set by the cord's hooks, M's posed (`phiM`), G lagging it by the
// band's stretch, each pawl seated by its band. The cord is its end studs and
// its braided segments along the path, one every 6 LDU, each along its chord.
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const at = (X, Y, Z, r = I3) => [X, Y, Z, ...r];
const ROT_X_TO_Z = [0, 0, -1, 0, 1, 0, 1, 0, 0];   // an axle's (or joiner's) own X onto LDraw Z
const rz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const mul3 = (A, B) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]));
// a round plate or an end stud: its own Y (its stud's axis, studs up = −Y)
// along LDraw −Z, so its studs face the frame's +y
const STUDS_TO_Y = [1, 0, 0, 0, 0, 1, 0, -1, 0];
// a thin liftarm: its length (own Z) along LDraw X, its holes (own Y) along
// LDraw Z, its width (own X) along LDraw Y; the body then turns it ψ about Z
const ARM_TO_PLANE = [0, 0, 1, 1, 0, 0, 0, 1, 0];
const fr = (x, y, z) => [L(x), -L(z), L(y)];
export const FUSEE_COLOUR = Object.freeze({ pulley: 71, barrel: 72, hook: 15, cord: 0, cordEnd: 0, click: 19, ratchet: 25, pawl: 4, arm: 1, joiner: 72, great: 14, knob: 15 });
export function fuseeBuild(frame, lib, { run, maint = MAINTAINING, phiM = 0, lagDeg = BAND_LAG_DEG, stringPart = null, paid = 0 } = {}) {
  const F = FUSEE_DIM_MM, g = goingSense(frame), zA = frame.axleZ;
  const cord = cordPath(frame, run, { stringPart, paid });
  const statics = [];
  // the baseplate: its studs at odd multiples of 10 LDU from its centre
  const midX = L((frame.base.x0 + frame.base.x1) / 2), midZ = L((frame.base.y0 + frame.base.y1) / 2);
  const snap = (v) => Math.round((v - 10) / 20) * 20 + 10;
  statics.push({ role: 'baseplate', part: Math.max(frame.base.studsX, frame.base.studsY) + 1 <= 16 ? FRAME_PARTS.baseplate16 : KEYLESS_PARTS.baseplate32, m: at(snap(midX), 0, snap(midZ)) });
  const roleOf = (p) => (p === FRAME_PARTS.technicBrick1x1 ? 'technicBrick' : p === FRAME_PARTS.brick1x1 ? 'brick' : 'plate');
  for (const c of frame.columns) for (const b of c.boxes) statics.push({ role: roleOf(b.part), part: b.part, m: at(L((b.x0 + b.x1) / 2), -L(b.z1), L((b.y0 + b.y1) / 2)) });
  const bodies = [];
  const body = (name, x, z, phi, parts) => { bodies.push({ shaft: name, origin: fr(x, 0, z), phi, speed: 0, parts }); };
  const axlePart = (a) => ({ role: 'axle', part: a.part, m: at(0, 0, L((a.y0 + a.y1) / 2), ROT_X_TO_Z) });
  const ax = Object.fromEntries(frame.axles.map((a) => [a.shaft, a]));
  // the hooks set F's and the barrel's angles: a hook plate's stud stands at
  // 45° + k·90° of its own turn, so the plate turns to put one on the hook's
  // angle
  const phiF = cord.aHook - Math.PI / 4, phiB = cord.aEnd - Math.PI / 4;
  // ── the barrel
  body('barrel', 0, zA, phiB, [axlePart(ax.barrel),
    { role: 'barrel', part: frame.barrel.part, m: at(0, 0, L(frame.barrel.origin)) },
    { role: 'hook', part: FUSEE_PARTS.hookPlate, m: at(0, 0, L(frame.barrel.hook.top), STUDS_TO_Y) }]);
  // ── F: knob, hook plate, steps, click wheel
  const fs = frame.fusee;
  body('fusee', frame.cd, zA, phiF, [axlePart(ax.fusee),
    { role: 'knob', part: fs.knob.part, m: at(0, 0, L(fs.knob.y)) },
    { role: 'hook', part: fs.hookPlate.part, m: at(0, 0, L(fs.hookPlate.top), STUDS_TO_Y) },
    ...fs.steps.map((s) => ({ role: 'pulley', part: s.part, m: at(0, 0, L(s.y)) })),
    { role: 'click', part: fs.click.part, teeth: 16, m: at(0, 0, L(fs.click.y)) }]);
  // ── the joiners (each its own free body on the line)
  for (const j of frame.joiners) body('joiner', frame.cd, zA, 0, [{ role: 'joiner', part: FUSEE_PARTS.connector, m: at(0, 0, L(j.y), ROT_X_TO_Z) }]);
  // ── M: the ratchet, the click's pivot axle in its +u hole, the band's peg in its −u hole
  const peg = (y0, y1, u) => ({ role: 'axle', part: AXLE_PARTS[2], m: at(L(u), 0, L((y0 + y1) / 2), ROT_X_TO_Z) });
  const R = frame.ratchet, h = F.wheelHole;
  body('maintaining', frame.cd, zA, phiM, [axlePart(ax.maintaining),
    { role: 'ratchet', part: R.part, teeth: 40, m: at(0, 0, L(R.y)) },
    peg(R.y1 - 15.6, R.y1, h), peg(R.y0, R.y0 + 15.6, -h)]);
  // ── G: lags M by the band's stretch in the going sense; its peg in the hole
  // the band reaches
  const phiG = phiM - g * lagDeg * Math.PI / 180, G = frame.great;
  body('great', frame.cd, zA, phiG, [axlePart(ax.great),
    { role: 'great', part: G.part, teeth: 40, m: at(0, 0, L(G.y)) },
    peg(G.y1 - 15.6, G.y1, -h)]);
  // ── §285: the centre pinion, meshed with the great wheel at its pose
  const C = frame.centre, phiC = centrePhase(lib, phiG, { centre: C });
  body('centre', C.x, zA, phiC, [axlePart(ax.centre), { role: 'centre', part: C.part, teeth: C.teeth, m: at(0, 0, L(C.y)) }]);
  // ── the click's pawl, seated against the click wheel at their relative turn
  const cs = clickSpec(maint.click.sense), cm = pawlModel(lib, cs);
  const rel = phiF - phiM;                                              // the click wheel in M's frame
  const psiC = cm.seat(rel);
  const pivC = [h * Math.cos(phiM), h * Math.sin(phiM)];
  // the arm pivots on its MIDDLE (round) hole, so the part (origin at its
  // first end hole) is set back one hole along the arm; its far end hole
  // carries the 8T, keyed on a 3L axle that runs from the 8T's far face (in
  // the click wheel's slab) to the arm's back face
  const eightAxle = Object.keys(AXLE_PARTS).map(Number).sort((p, q) => p - q).find((n) => n * D.stud - 0.4 >= frame.clickArm.y1 - fs.click.y0 - 1e-9);
  if (psiC !== null) bodies.push({ shaft: 'click pawl', origin: fr(frame.cd + pivC[0], 0, zA - pivC[1]), phi: phiM + psiC, speed: 0, parts: [
    { role: 'arm', part: FUSEE_PARTS.arm, m: at(-L(F.armMid), 0, L((frame.clickArm.y0 + frame.clickArm.y1) / 2), ARM_TO_PLANE) },
    { role: 'pawl', part: FUSEE_PARTS.pawl, teeth: 8, m: at(L(F.armMid), 0, L(fs.click.y)) },
    { role: 'axle', part: AXLE_PARTS[eightAxle], m: at(L(F.armMid), 0, L(fs.click.y0 + (eightAxle * D.stud - 0.4) / 2), ROT_X_TO_Z) },
  ] });
  // ── the detent's pawl, seated on the ratchet: its arm keyed to the pivot
  // axle at its near end hole, its 8T on a 2L axle through its far end hole
  // and into the ratchet's slab
  const ds = detentSpec(maint.detent.pivot, maint.detent.sense), dm = pawlModel(lib, ds);
  const psiD = dm.seat(phiM);
  const dp = frame.detent.pivot, armD = KEYLESS_PULL_DIM_MM.armHoles;
  if (psiD !== null) bodies.push({ shaft: 'detent pawl', origin: fr(dp.x, 0, dp.z), phi: psiD, speed: 0, parts: [
    axlePart(frame.detent.axle),
    { role: 'arm', part: FUSEE_PARTS.arm, m: at(0, 0, L((frame.detentArm.y0 + frame.detentArm.y1) / 2), ARM_TO_PLANE) },
    { role: 'pawl', part: FUSEE_PARTS.pawl, teeth: 8, m: at(L(armD), 0, L(R.y)) },
    { role: 'axle', part: AXLE_PARTS[2], m: at(L(armD), 0, L((R.y0 + frame.detentArm.y1) / 2), ROT_X_TO_Z) },
  ] });
  statics.push(...cordPlacements(frame, cord));
  return { key: 'fusee', gen: frame.gen, statics, shafts: bodies, meshes: [], modes: ['full wind'], cord,
    pose: { phiF, phiB, phiM, phiG, phiC, psiC, psiD, going: g } };
}
// ── the cord as parts: its end studs and its braided segments along a path
// (cordPath's, at whatever state of the run it was taken) — one function, so
// the loop's moving cord and the static build's are placed by the same law
export function cordPlacements(frame, cord) {
  const F = FUSEE_DIM_MM, cordParts = [];
  const p = cord.path, ends = [p[0], p[p.length - 1]];
  for (const [k, e] of ends.entries()) {
    const nxt = k ? p[p.length - 2] : p[1];
    const out = [e[0] - nxt[0], e[2] - nxt[2]].map((v) => -v);   // outward, in (x, z)
    const ang = Math.atan2(-out[1], out[0]);                        // in (u, v)
    // its stud on the plate's stud: its underside on the plate's top face
    const yTop = k ? frame.barrel.hook.top : frame.fusee.hookPlate.top;
    cordParts.push({ role: 'cordEnd', part: FUSEE_PARTS.cordEnd, m: at(...fr(e[0], yTop + F.endH, e[2]), mul3(rz(ang), STUDS_TO_Y)) });
  }
  // segments every 6 LDU along the path
  const segLen = 2.4, total = pathLength(p);
  let i = 0, acc = 0;
  const pointAt = (s) => {
    while (i < p.length - 2 && acc + Math.hypot(...[0, 1, 2].map((k) => p[i + 1][k] - p[i][k])) < s) { acc += Math.hypot(...[0, 1, 2].map((k) => p[i + 1][k] - p[i][k])); i++; }
    const a = p[i], b = p[i + 1], l = Math.hypot(...[0, 1, 2].map((k) => b[k] - a[k])), t = l ? (s - acc) / l : 0;
    return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
  };
  for (let s = 0; s + segLen <= total + 1e-9; s += segLen) {
    const a = pointAt(s), b = pointAt(s + segLen);
    const d = [L(b[0] - a[0]), -L(b[2] - a[2]), L(b[1] - a[1])], n = Math.hypot(...d);
    const ex = d.map((v) => v / n);
    const up = Math.abs(ex[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let ey = [ex[1] * up[2] - ex[2] * up[1], ex[2] * up[0] - ex[0] * up[2], ex[0] * up[1] - ex[1] * up[0]];
    const ny = Math.hypot(...ey); ey = ey.map((v) => v / ny);
    const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
    const mid = fr((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    cordParts.push({ role: 'cord', part: FUSEE_PARTS.cordSegment, m: at(...mid, [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]]) });
  }
  return cordParts;
}

// ── §282 — THE LOOP: run down, wind back through the maintaining power ──────
// The LEGO feasibility note's module 2 measurement made visible: the cord
// leaves the cone a step at a time, the barrel takes it, and the torque the
// spring gives is set beside the torque the cone delivers. MODELLED, not
// simulated: nothing here is integrated and no force is weighed. Every angle
// is read from the state through the parts' own laws (the cone's segments,
// the click's lock, the band's posed stretch), and the one quantity given a
// RATE is the great wheel's: in a watch the escapement governs it, and this
// module builds no escapement, so its rate is a DISPLAY rate (LOOP_RUN_S), not
// a claim — the analogue of technic.html's `keylessAngle`.
//
// THE CHAIN, one input per phase:
//   GOING — the great wheel G advances (the display rate); the band, at its
//     posed stretch (BAND_LAG_DEG), holds the ratchet M that far ahead of it;
//     the click, locked (pawlLock), turns the fusee F with M; the cord paid off
//     the cone is read from F's turn through the cone's segments (paidAtTurn),
//     and the barrel's turn from the cord paid (paid/ρ_b). So F turns at the
//     train's steady rate and the BARREL speeds up as the cord comes down onto
//     a larger step — the sense the geometry gives, since F is in the train;
//     the detent rides the ratchet's teeth (it frees the going way).
//   WINDING — a crank turns F back windSpeedup times as fast as the train
//     runs; the click frees and its pawl rides the click wheel's teeth; the
//     detent holds M against the band; the band, relaxing, keeps G turning the
//     going way at the same rate: Harrison's maintaining power carrying the
//     train. The cord goes back onto the cone by the same law, exactly back to
//     full wind (paid = 0), where the wind stops.
//   FULL — the going spring takes the train again and first re-tensions the
//     band: F and M (the click locked) run RECHARGE_SPEEDUP times as fast as G
//     until M stands BAND_LAG_DEG ahead again, then GOING resumes.
// WHAT IS POSED, BY NAME: the spring's law (TECHNIC_FUSEE_SPRING, a stand-in);
// the band's stretch and its relaxing while it carries the train (its force
// is not measured, only its direction, bandMoment); each pawl's band, which
// holds its 8T on the teeth it rides (the ride is the seat the band drops it
// to, pawlModel.seat, at each angle — a posed ride over the measured profile).

// THE DISPLAY RATE: one run-down, full wind to run-down, in this many seconds
// at speed 1 — long enough to read a step crossing, short enough that the
// loop comes round while someone watches. A display rate, not a claim.
export const LOOP_RUN_S = 40;
// THE WIND'S SPEED, derived: while the fusee is wound the band carries the
// train alone, spending its stretch at the train's rate, so a wind that took
// longer than the stretch lasts would let the band go slack — a maintaining
// power that ran out. The crank turns the fusee back the fewest whole times
// faster than the train that spends no more than HALF the band's posed stretch
// over a whole wind: k = ⌈2·T / λ⌉, T the cone's whole turn over the run.
export const windSpeedup = (run, lagDeg = BAND_LAG_DEG) => Math.ceil(2 * coneTurnTotal(run) / (lagDeg * Math.PI / 180));
// THE RECHARGE'S SPEED: any rate above the train's re-tensions the band (the
// fusee then runs ahead of the great wheel); a real going spring does it
// almost at once. 2 is a DISPLAY rate, the slowest whole one that keeps the
// FULL phase long enough to read.
export const RECHARGE_SPEEDUP = 2;

// A PAWL'S RIDE over one pitch of the teeth it rides: the seat its band drops
// it to (pawlModel.seat), at n + 1 wheel angles from theta0, read by linear
// interpolation between them. The first is seat(theta0) itself, so the ride
// starts where the static build seats it; each next search starts RIDE_BACK
// back toward the free side of the one before, a continuation of seat()'s own
// search (probe-technic-fusee-loop holds every sample to seat() from scratch).
// A generator, so a page can build it between frames.
const RIDE_BACK = 15 * Math.PI / 180;
export function* pawlRideSteps(lib, spec, teeth, { theta0 = 0, n = 48 } = {}) {
  const m = pawlModel(lib, spec), s = spec.sense, pitch = TAU / teeth, rad = Math.PI / 180;
  const table = new Float64Array(n + 1);
  table[0] = m.seat(theta0);
  for (let i = 1; i <= n; i++) {
    yield i;
    const theta = theta0 + i * pitch / n;
    let start = table[i - 1] - s * RIDE_BACK;
    while (m.depth(start, theta) > 0) start -= s * RIDE_BACK;
    let prev = start, hit = null;
    for (let k = 1; k <= 360; k++) { const q = start + s * k * rad; if (m.depth(q, theta) > 0) { hit = q; break; } prev = q; }
    let a = prev, b = hit;
    for (let j = 0; j < 40; j++) { const c = (a + b) / 2; if (m.depth(c, theta) > 0) b = c; else a = c; }
    table[i] = a;
  }
  const at = (theta) => { const u = mod(theta - theta0, pitch) / pitch * n, i = Math.min(n - 1, Math.floor(u)), f = u - i; return table[i] * (1 - f) + table[i + 1] * f; };
  return { table, theta0, pitch, n, at, model: m };
}
export function pawlRide(lib, spec, teeth, opts) {
  const it = pawlRideSteps(lib, spec, teeth, opts);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
// THE LOOP'S MODEL: the run, the build it starts from (fuseeBuild's pose at
// full wind: every angle below is that pose plus a turn), and the two rides —
// the click's over the click wheel (in M's frame, the relative angle F − M, as
// fuseeBuild seats it) and the detent's over the ratchet.
export const loopRideSpecs = (build, maint = MAINTAINING) => ({
  click: { spec: clickSpec(maint.click.sense), teeth: 16, theta0: build.pose.phiF - build.pose.phiM },
  detent: { spec: detentSpec(maint.detent.pivot, maint.detent.sense), teeth: 40, theta0: build.pose.phiM },
});
export function fuseeLoopModel(frame, lib, run, build, { table = TECHNIC_FUSEE_SPRING, maint = MAINTAINING, lagDeg = BAND_LAG_DEG, rides = null } = {}) {
  const p = build.pose;
  const r = rides ?? Object.fromEntries(Object.entries(loopRideSpecs(build, maint)).map(([k, v]) => [k, pawlRide(lib, v.spec, v.teeth, { theta0: v.theta0 })]));
  const full = runState(run, 0, table), T = coneTurnTotal(run);
  return { frame, run, table, build, pose0: p, g: p.going, T, k: windSpeedup(run, lagDeg), kr: RECHARGE_SPEEDUP, lag0: lagDeg * Math.PI / 180,
    rides: r, full, rate: T / LOOP_RUN_S };
}
export const loopStart = () => ({ phase: 'going', turnF: 0, dM: 0, dG: 0, cycle: 0 });
// Advance the loop by `a` radians of the great wheel (≥ 0, always the going
// way). Phases end EXACTLY where their law says (run-down at T, full wind at
// 0, the band at its stretch), and the rest of the advance carries into the
// next phase, so no step overshoots a boundary.
export function loopAdvance(model, st, a) {
  const s = { ...st }, { T, k, kr } = model;
  let left = a;
  for (let guard = 0; left > 0 && guard < 8; guard++) {
    if (s.phase === 'going') {
      const u = Math.min(left, T - s.turnF);
      s.turnF += u; s.dM += u; s.dG += u; left -= u;
      if (s.turnF >= T) { s.turnF = T; s.phase = 'winding'; }
    } else if (s.phase === 'winding') {
      const room = s.turnF / k, u = Math.min(left, room);
      s.dG += u; left -= u;
      if (u >= room) { s.turnF = 0; s.phase = 'full'; } else s.turnF -= k * u;
    } else {
      const room = (s.dG - s.dM) / (kr - 1), u = Math.min(left, room);
      s.turnF += kr * u; s.dM += kr * u; s.dG += u; left -= u;
      if (u >= room) { s.dM = s.dG; s.phase = 'going'; s.cycle++; }
    }
  }
  return s;
}
// THE POSE AT A STATE: every body's angle (LDraw rotZ, as fuseeBuild places
// them), the click pawl's pivot (it rides round in M's hole), the cord's
// state, the band's stretch, and the readout: the spring's torque and the
// torque after the cone, each as a fraction of its own value at full wind.
export function loopPose(model, st) {
  const { run, g, pose0: p } = model, h = FUSEE_DIM_MM.wheelHole;
  const paid = paidAtTurn(run, st.turnF), rs = runState(run, paid, model.table);
  const phiF = p.phiF + g * st.turnF, phiB = p.phiB + g * paid / run.rb;
  const phiM = p.phiM + g * st.dM, phiG = p.phiG + g * st.dG;
  const phiC = p.phiC - centreRatio(model.frame.centre) * g * st.dG;   // §285: through the 40:8, the mesh reversing
  return { phase: st.phase, paid, state: rs, phiF, phiB, phiM, phiG, phiC,
    psiC: model.rides.click.at(phiF - phiM), psiD: model.rides.detent.at(phiM), clickPivot: [h * Math.cos(phiM), h * Math.sin(phiM)],
    lag: model.lag0 + st.dM - st.dG, spring: rs.M / model.full.M, level: rs.P / model.full.P };
}
// THE PHASE LINE: what the page says, from the state alone. Steps are counted
// base first, as the solve lists them (step 1 is the largest).
export function loopPhaseLine(model, pose) {
  const n = model.run.steps.length, s = pose.state, k = s.step + 1, part = model.run.steps[s.step];
  if (pose.phase === 'winding') return 'winding — the crank turns the fusee back; the maintaining power carries the train';
  if (pose.phase === 'full') return 'full — the going spring re-tensions the maintaining band';
  return s.kind === 'transition' ? `running down — crossing from step ${k} to step ${k - 1} of ${n}`
    : `running down — step ${k} of ${n} (${part}, seat ${s.arm.toFixed(2)} mm)`;
}
