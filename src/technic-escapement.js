// §219 tier three (b), landing J — THE ESCAPEMENT AND ITS OSCILLATOR AS A LEGO
// BUILD: a balance arm on a KNIFE EDGE, an ANCHOR (recoil) escapement whose two
// pallets are keyed 8T gears, and an 8T escape wheel. MODELLED: every part is
// placed and measured, the escapement's lock, drop, recoil and impulse are read
// off the parts' outlines as the anchor turns, and the period is SOLVED from the
// balance's inertia and the depth of its centre of mass. Nothing is integrated:
// the cycle the page draws is a posed swing, and every body's angle in it is
// read off that swing through the parts' geometry. Pure: no three.js, no DOM.
// tools/probe-technic-escapement.mjs holds it.
//
// THE QUESTION (docs/LEGO_FEASIBILITY.md, module 4 of its §4, in the roadmap
// repo): the steel movement keeps time with a Swiss lever escapement and a
// sprung balance (TODO 25, §218). Neither has a LEGO form. LEGO gear teeth are
// symmetric involutes with no locking corner, and a lever's drop is a fraction
// of a degree, inside one plastic bearing's play (the note's F2: about 0.1 mm);
// LEGO has no spring steel (F3), so there is no hairspring. What a LEGO builder
// can make, and what the community does make, is an ANALOGUE of each (the
// architecture is Nico71's Balance Clock With Remontoire — a knife-edge balance
// arm and an anchor; the 8T escape wheel was first suggested by Eric
// Harshbarger's clock as BrickNerd reports it; both credited in README's
// Sources and BUILT §287, neither traced or measured):
//   · the ESCAPEMENT is an ANCHOR — a recoil escapement, two pallets on one
//     rocking body, each in turn catching a tooth of the escape wheel and
//     letting it go. It is a DIFFERENT escapement from the steel's Swiss lever:
//     no lever, no fork, no draw, no detached arc; the wheel recoils while a
//     pallet holds it;
//   · the OSCILLATOR is a BALANCE ARM ON A KNIFE EDGE, restored by GRAVITY:
//     physically a compound pendulum, drawn as a balance. Its period is
//     T = 2π √(I / (m g d)), I about the knife, m its mass, d the depth of its
//     centre of mass below the knife, and nothing else.
//
// THE KNIFE EDGE is the apex of a 45° double slope brick (3044b), on a column
// at each end of the balance, and the balance's CROSSBAR — a cross axle — lies
// across the two apices on one of its arms. The pivot is the apex line; the
// crossbar's axis stands an axle's reach (its arm's end, 2.4 mm) above it. A
// cross axle is LEGO's sharpest round-ended bar, and the apex its sharpest
// edge: builders call this kind of support the largest friction saving a
// plastic clock can make (Nico71's Galileo Clock says it greatly improves the
// pendulum). POSED, said wherever it is used: the contact does not
// slip (friction holds it; it is not measured).
//
// THE ANCHOR'S PALLETS ARE GEAR TEETH, because nothing else in LEGO is fine
// enough: a tooth space of a module-1 gear is about 1.6 mm across, and every
// pin, axle end and liftarm end is 4.8 mm or more. So each pallet is an 8T on a
// FRICTION AXLE PIN (43093) in a liftarm's round hole: the pin holds the 8T at
// whatever angle it is set to, which is each pallet's ONE SETTING. The setting
// is solved (`solveEscapement`), never chosen.
//
// WHAT IS POSED, BY NAME: the material's density (ESC_DENSITY, a band with its
// source — it cancels out of the period when every part is one material, and
// sets the mass, which only the trip torque below reads); the swing the page
// draws (ESC_SWING_DEG, inside the measured window); the knife's no-slip
// contact; the bearing play the lock is compared against (F2's 0.1 mm, the
// note's figure). The drive is not modelled at all: the escape wheel is turned
// by the going train's TORQUE, and this module measures only where its teeth
// may stand.
//
// WHAT IS NOT BUILT: the drive (the escape arbor here is the fourth→escape
// row's output by its RATE — RATE_TABLE's law, held by the probe — but the
// row's gears stand in their own cell, not on this arbor); a rating nut (the
// community trims a bob with a worm and rack, as Nico71's Galileo Clock does; the residual the lattice leaves
// is reported, not trimmed); the balance's amplitude as a consequence of any
// energy (the swing is posed inside the window the geometry admits).
import { walk, LDU_MM } from './ldraw.js';
import { LEGO_DIM_MM, FRAME_PARTS, AXLE_PARTS, GEAR_TIP_MM } from './technic-frame.js';
import { toothPhase } from './technic-ldraw.js';
import { starProfile } from './technic-fusee.js';
import { CATALOGUES, TECHNIC_VPH, TECHNIC_ESCAPE_TEETH } from './layout.js';

const D = LEGO_DIM_MM;
const L = (mm) => mm / LDU_MM;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const TAU = 2 * Math.PI;
const mod = (a, m) => ((a % m) + m) % m;
const deg = (d) => d * Math.PI / 180;

// ── THE PARTS ───────────────────────────────────────────────────────────────
// By role. All classic: the same build stands in both generations.
//   · KNIFE: the 45° double slope brick (3044b), ridge up, on a 1×2 stack of
//     bricks (3004) and plates (3023b);
//   · CROSSBAR: a cross axle, lying across both knives on one arm;
//   · ARMS keyed on the crossbar, each by its end AXLE hole (a cross in a cross
//     goes on at quarter turns only, so every arm is level or plumb): the two
//     MASS ARMS level (11478 or 6632), the BOB ARM plumb (41677, 6632 or
//     11478), and the ANCHOR DROP (41677) plumb, whose lower axle hole carries
//     the ANCHOR AXLE;
//   · PALLET ARMS (6632) keyed level on the anchor axle, each pallet an 8T on
//     a friction axle pin (43093) in its round middle hole;
//   · MASSES: 40T gears (3649) keyed on short axles in the arms' far axle
//     holes — the heaviest compact keyed part in the catalogue;
//   · ESCAPE WHEEL: a catalogue spur on its own arbor (the 8T, solved below),
//     on two Technic-brick columns like every arbor of the fork.
export const ESCAPEMENT_PARTS = Object.freeze({
  knife: '3044b', stackBrick: '3004', stackPlate: '3023b',
  massArm: '11478', bobArm: '11478', anchorDrop: '41677', palletArm: '6632', palletPin: '43093',
  pallet: '3647', wheel: '3647', mass: '3649',
});
// The thin liftarms, by the reach from their keyed end hole to their far AXLE
// hole (mm), and where their ROUND holes stand on the way (mm from that end).
export const ARM_PARTS = Object.freeze({
  '41677': Object.freeze({ reach: 8, round: Object.freeze([]) }),
  '6632': Object.freeze({ reach: 16, round: Object.freeze([8]) }),
  '11478': Object.freeze({ reach: 32, round: Object.freeze([8, 16, 24]) }),
});

// MEASURED (held by probe-technic-escapement.mjs against the vendored parts).
export const ESC_DIM_MM = Object.freeze({
  axleReach: 2.4,          // 3705: a cross axle's arm ends 6 LDU from its axis, rounded on that radius
  knifeH: 9.6,             // 3044b: apex to underside, 24 LDU
  knifeHalfSpan: 8,        // 3044b: ±20 LDU across the ridge (two studs)
  knifeHalfLength: 4,      // 3044b: ±10 LDU along it (one stud)
  knifeFlankDeg: 45,       // 3044b: the flank falls 20 LDU over 20 LDU from the apex
  armHalfThick: 2,         // 6632 / 11478 / 41677: ±5 LDU
  armHalfWidth: 3.6,       // the same: ±9 LDU, the ends round on that radius
  pinHalf: 8,              // 43093: the friction pin's half, 20 LDU
  pinAxle: 7.8,            // 43093: its axle half, 19.5 LDU
  gearHalf: 4,             // 3647 / 3649: ±10 LDU
});
const E = ESC_DIM_MM;

// ── SOLIDS: VOLUME AND INERTIA OFF THE PARTS ────────────────────────────────
// LDraw draws SURFACES, and a Technic part's surface is closed. So a part's
// solid is read by casting rays along its own Y through a grid in X–Z and
// pairing each ray's crossings in order: inside between the first and the
// second, and so on. A ray that crosses an odd number of times has met a part
// that is not closed there, and is counted, never guessed through. Returns the
// volume (mm³), the first moment ∫r dV (mm⁴) and the second ∫r rᵀ dV (mm⁵) in
// the part's own frame. The grid is 0.25 LDU (0.1 mm): measured, a 40T reads
// 3503 mm³ at 0.5 LDU, 3448 at 0.25 and 3444 at 0.125.
export const SOLID_STEP = 0.25;
const solidMemo = new Map();
export function partSolid(lib, part, step = SOLID_STEP) {
  const key = `${part}@${step}`;
  if (solidMemo.has(key)) return solidMemo.get(key);
  const tris = [];
  walk(lib, `${part}.dat`, (k, p) => { if (k === 'tri') tris.push(p); });
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  // the grid is offset by a few hundredths of an LDU so no ray runs along an edge
  const jx = 0.01234, jz = 0.00871;
  const nx = Math.ceil((hi[0] - lo[0]) / step) + 1, nz = Math.ceil((hi[2] - lo[2]) / step) + 1;
  const bins = Array.from({ length: nx * nz }, () => []);
  for (const t of tris) {
    const x0 = Math.max(0, Math.floor((Math.min(t[0][0], t[1][0], t[2][0]) - lo[0]) / step) - 1), x1 = Math.min(nx - 1, Math.ceil((Math.max(t[0][0], t[1][0], t[2][0]) - lo[0]) / step) + 1);
    const z0 = Math.max(0, Math.floor((Math.min(t[0][2], t[1][2], t[2][2]) - lo[2]) / step) - 1), z1 = Math.min(nz - 1, Math.ceil((Math.max(t[0][2], t[1][2], t[2][2]) - lo[2]) / step) + 1);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) bins[i * nz + k].push(t);
  }
  let V = 0, odd = 0, rays = 0;
  const F = [0, 0, 0], S = [0, 0, 0, 0, 0, 0, 0, 0, 0], A = step * step;
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const x = lo[0] + (i + 0.5) * step + jx, z = lo[2] + (k + 0.5) * step + jz;
    const hits = [];
    for (const [p, q, s] of bins[i * nz + k]) {
      const det = (q[0] - p[0]) * (s[2] - p[2]) - (s[0] - p[0]) * (q[2] - p[2]);
      if (Math.abs(det) < 1e-12) continue;
      const u = ((x - p[0]) * (s[2] - p[2]) - (s[0] - p[0]) * (z - p[2])) / det;
      const v = ((q[0] - p[0]) * (z - p[2]) - (x - p[0]) * (q[2] - p[2])) / det;
      if (u < 0 || v < 0 || u + v > 1) continue;
      hits.push(p[1] + u * (q[1] - p[1]) + v * (s[1] - p[1]));
    }
    if (!hits.length) continue;
    hits.sort((a, b) => a - b);
    // a crossing drawn twice (two coincident faces, or a ray through a shared
    // edge) is one crossing too many: coincident pairs cancel
    const h = [];
    for (const y of hits) if (h.length && y - h[h.length - 1] < 1e-5) h.pop(); else h.push(y);
    if (!h.length) continue;
    rays++;
    if (h.length % 2) { odd++; continue; }
    for (let m = 0; m < h.length; m += 2) {
      const y0 = h[m], y1 = h[m + 1], len = y1 - y0, my = (y1 * y1 - y0 * y0) / 2, myy = (y1 ** 3 - y0 ** 3) / 3;
      V += A * len; F[0] += A * len * x; F[1] += A * my; F[2] += A * len * z;
      S[0] += A * len * x * x; S[4] += A * myy; S[8] += A * len * z * z;
      S[1] += A * my * x; S[2] += A * len * x * z; S[5] += A * my * z;
    }
  }
  S[3] = S[1]; S[6] = S[2]; S[7] = S[5];
  const u = LDU_MM;
  const out = Object.freeze({ V: V * u ** 3, F: F.map((f) => f * u ** 4), S: S.map((s) => s * u ** 5), odd, rays });
  solidMemo.set(key, out);
  return out;
}
// A solid placed by [x y z (mm), a..i]: r' = R r + t.
export function placeSolid(sol, m) {
  const R = m.slice(3), t = m.slice(0, 3);
  const RF = [0, 1, 2].map((i) => R[i * 3] * sol.F[0] + R[i * 3 + 1] * sol.F[1] + R[i * 3 + 2] * sol.F[2]);
  const RS = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => R[i * 3] * sol.S[j] + R[i * 3 + 1] * sol.S[3 + j] + R[i * 3 + 2] * sol.S[6 + j]));
  const S = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => RS[i * 3] * R[j * 3] + RS[i * 3 + 1] * R[j * 3 + 1] + RS[i * 3 + 2] * R[j * 3 + 2] + RF[i] * t[j] + t[i] * RF[j] + t[i] * t[j] * sol.V));
  return { V: sol.V, F: RF.map((f, i) => f + t[i] * sol.V), S };
}

// THE MATERIAL, POSED. LEGO parts are ABS, about 1.04–1.06 g/cm³ (the range
// polymer data sheets give for ABS; LEGO does not publish a part's mass, and
// the LDraw library carries none). Every part here is read as that one
// material, so the density CANCELS from the period — T = 2π √(I/(m g d)) is a
// ratio of two integrals of the same ρ. It sets only the mass, which only the
// trip torque reads, so it is carried as its band. Axles and pins are a
// different polymer in some production years; ESC_DENSITY.axles is the band the
// probe reports the period against when they are (POM's 1.41, its data
// sheets' figure), never a claim that they are.
export const ESC_DENSITY = Object.freeze({
  status: 'POSED', unit: 'g/cm³', abs: Object.freeze([1.04, 1.06]), axles: 1.41,
  source: 'ABS: polymer data-sheet range (no LEGO part mass is published or in LDraw); POM for the axle variant',
});
export const G_MM_S2 = 9806.65;           // standard gravity, mm/s²

// ── THE BALANCE ─────────────────────────────────────────────────────────────
// The body's frame: LDraw's axes about the PIVOT (the knife's apex line), in
// mm — u across (LDraw X), v DOWN (LDraw Y), w along the crossbar (LDraw Z).
// Gravity is +v, and the body turns about w by α (LDraw's rotZ sense).
const I3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export const rz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const mul3 = (A, B) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]));
// a thin liftarm: its length (own Z) along LDraw X, its holes (own Y) along Z
const ARM = Object.freeze([0, 0, 1, 1, 0, 0, 0, 1, 0]);
// an axle or a pin: its own X along LDraw Z (+X to +Z)
const X2Z = Object.freeze([0, 0, -1, 0, 1, 0, 1, 0, 0]);
// the knife: its ridge (own X) along LDraw Z, its span (own Z) along X
const KNIFE = Object.freeze([0, 0, 1, 0, 1, 0, -1, 0, 0]);
// An arm keyed at its end axle hole on a point, pointing along `dir` (0 = +u,
// π/2 = +v, down): its part origin and matrix. 6632 and 41677 draw their origin
// at that end hole; 11478 at its middle.
function armAt(part, at, dir) {
  const R = mul3(rz(dir), ARM), back = part === '11478' ? 16 : 0;
  return { part, m: [at[0] + back * Math.cos(dir), at[1] + back * Math.sin(dir), 0, ...R] };
}
const holeAt = (at, dir, r) => [at[0] + r * Math.cos(dir), at[1] + r * Math.sin(dir)];

// THE DECLARED BALANCE (re-solved by the probe; solveBalance below): the mass
// arms, the masses per side, the bob arm and the bob's gears.
export const TECHNIC_BALANCE = Object.freeze({ massArm: '11478', masses: Object.freeze(['3649', '3648', '3648']), bobArm: '6632', bob: Object.freeze(['3649', '3649']) });
// THE BEAT the escapement row is cut for: RATE_TABLE's law at TECHNIC_VPH,
// two beats a period, so the period is 2 × 3600 / vph seconds.
export const BEAT_PERIOD_S = 2 * 3600 / TECHNIC_VPH;

// The balance's parts in its own frame (mm), each { role, part, m:[u v w, R] }
// with the slab it belongs in (`slab`, named as frameEscapement names them) —
// `w` is the frame's (it does not move the period). `esc` is the escapement's
// geometry with its setting (escSpec), so the pallets are in the balance's mass.
export const bobOnAnchor = (bal, esc) => bal.bob.length > 0 && !!esc.drop && bal.bobArm === esc.drop;
export function balanceParts(bal, esc) {
  const ra = E.axleReach, C = [0, -ra], out = [];
  const add = (role, slab, p) => out.push({ role, slab, ...p });
  add('crossbar', 'crossbar', { part: null, m: [C[0], C[1], 0, ...X2Z] });
  for (const [dir, slab, which] of [[0, 'M2', 'mass+'], [Math.PI, 'M1', 'mass-']]) {
    add('arm', slab, armAt(bal.massArm, C, dir));
    const h = holeAt(C, dir, ARM_PARTS[bal.massArm].reach);
    add('axle', which, { part: null, m: [h[0], h[1], 0, ...X2Z] });
    bal.masses.forEach((part, k) => add('mass', 'G', { part, m: [h[0], h[1], 0, ...I3], gear: k }));
  }
  // the bob: on its own plumb arm, or — when its arm is the anchor's drop — on
  // the anchor axle itself, carried forward into the gear slabs
  const onAnchor = bobOnAnchor(bal, esc);
  if (bal.bob.length > 0) {
    const h = holeAt(C, Math.PI / 2, ARM_PARTS[bal.bobArm].reach);
    if (!onAnchor) { add('arm', 'B', armAt(bal.bobArm, C, Math.PI / 2)); add('axle', 'bob', { part: null, m: [h[0], h[1], 0, ...X2Z] }); }
    bal.bob.forEach((part, k) => add('mass', 'G', { part, m: [h[0], h[1], 0, ...I3], gear: k, bob: true }));
  }
  // the anchor: its drop to the anchor axle, the pallet arms, the pins, the 8Ts
  if (esc.drop) add('arm', 'D', armAt(esc.drop, C, Math.PI / 2));
  const Aax = [0, esc.vA];
  add('axle', 'anchor', { part: null, m: [0, esc.vA, 0, ...X2Z] });
  for (const [k, slab] of [[1, 'P2'], [-1, 'P1']]) {
    const dir = k > 0 ? 0 : Math.PI;
    add('arm', slab, armAt(esc.palletArm, Aax, dir));
    const p = holeAt(Aax, dir, esc.s);
    add('pin', 'pin', { part: ESCAPEMENT_PARTS.palletPin, m: [p[0], p[1], 0, ...X2Z] });
    add('pallet', 'W', { part: ESCAPEMENT_PARTS.pallet, m: [p[0], p[1], 0, ...rz(palletAngle(esc, k))], k });
  }
  return out;
}
// The balance's moments about the knife: m (as volume, mm³ — ρ cancels), the
// centre of mass's depth d below the knife and its offset across, and I about
// the knife (mm⁵). T = 2π √(I / (V g d)).
export function balanceMoments(lib, parts, { axleDensityRatio = 1 } = {}) {
  let V = 0, Fu = 0, Fv = 0, I = 0;
  for (const p of parts) {
    const s = placeSolid(partSolid(lib, p.part), p.m), w = p.role === 'axle' || p.role === 'crossbar' || p.role === 'pin' ? axleDensityRatio : 1;
    V += w * s.V; Fu += w * s.F[0]; Fv += w * s.F[1]; I += w * (s.S[0] + s.S[4]);
  }
  const d = Fv / V, T = d > 0 ? TAU * Math.sqrt(I / (V * G_MM_S2 * d)) : null;
  return { V, I, d, offset: Fu / V, T, Ieq: I / V };
}
// PERIOD AGAINST AMPLITUDE: a rigid body swinging about a fixed axis under
// gravity is exactly a pendulum, so its period at an amplitude A is T₀ / agm(1,
// cos(A/2)) — the complete elliptic integral, read by the arithmetic–geometric
// mean. (The model's only amplitude dependence; the escapement's kicks are not
// in it.)
export function periodAt(T0, Adeg) {
  let a = 1, b = Math.cos(deg(Adeg) / 2);
  for (let i = 0; i < 30; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return T0 / a;
}
// THE BALANCE SOLVED: every keyed arrangement the parts allow — level mass arms
// of each length with up to three gears a side, a plumb bob arm of each length
// (or the anchor's own drop) with up to two, each gear a 40T, 24T or 16T, each
// arrangement FRAMED (one that does not fit the crossbar is not an answer) — on
// the declared escapement's anchor. The answer lands inside RATE_BAND of
// BEAT_PERIOD_S; among those, the deepest centre of mass. Solve the part, never
// re-target the beat.
// THE RATE BAND a solved period must land in: the oscillator gate's 0.5%
// (rule 4's `equalisation`: the governor's solve lands its gap within the
// oscillator's 0.5%). Inside it the residual is a TRIM, which LEGO builders make
// with a bob on a worm and rack; this build has none, and reports the residual.
export const RATE_BAND = 0.005;
export const MASS_PARTS = Object.freeze(['3649', '3648', '4019']);   // 40T, 24T, 16T: keyed, compact, in the catalogue
function* multisets(items, max) {
  const rec = function* (start, cur) { yield cur; if (cur.length === max) return; for (let i = start; i < items.length; i++) yield* rec(i, [...cur, items[i]]); };
  yield* rec(0, []);
}
export function solveBalance(lib, spec = TECHNIC_ESCAPEMENT, { target = BEAT_PERIOD_S, maxSide = 3, maxBob = 2 } = {}) {
  const rows = [];
  for (const massArm of ['6632', '11478']) for (const masses of multisets(MASS_PARTS, maxSide))
    for (const bobArm of ['41677', '6632', '11478']) for (const bob of multisets(MASS_PARTS, maxBob)) {
      if (!bob.length && bobArm !== '41677') continue;                     // no bob: one row, not three
      const bal = { massArm, masses, bobArm, bob };
      const fr = frameEscapement(spec, bal);
      if (!fr.framed) continue;
      const mo = balanceMoments(lib, framedBalance(fr, lib));
      if (mo.T === null) continue;
      rows.push({ ...bal, T: mo.T, d: mo.d, err: mo.T / target - 1, parts: 2 * masses.length + bob.length });
    }
  // inside the band, the deepest centre of mass (the least sensitive to the
  // knife: dT/T = −½ δd/d); outside it, the nearest
  const inBand = (r) => Math.abs(r.err) <= RATE_BAND;
  rows.sort((a, b) => (inBand(b) - inBand(a)) || (inBand(a) ? b.d - a.d : Math.abs(a.err) - Math.abs(b.err)) || a.parts - b.parts);
  return { best: rows[0], rows, inBand: rows.filter(inBand).length };
}

// ── THE ESCAPEMENT ──────────────────────────────────────────────────────────
// In the balance's plane, about the pivot (u across, v down, mm): the anchor
// axle at (0, vA), the two pallets s either side of it, the escape wheel's
// centre at (0, vW). The anchor turns with the balance, α; each pallet is an 8T
// at angle α + its setting; the wheel at θ. A PALLET AND THE WHEEL OVERLAP by
// the deepest any boundary point of one stands inside the other (landing H's
// star profiles, read only over the arc that faces the other part, every
// other 0.1° bin and only the outer 40% of radius — technic-fusee's
// `penetration` reads the same law over the whole circle, and the probe holds
// the two to agree).
const BINS = 3600;
const rAt = (P, phi) => { const t = mod(phi / TAU, 1) * BINS, i = Math.floor(t) % BINS, f = t - Math.floor(t); return P.r[i] * (1 - f) + P.r[(i + 1) % BINS] * f; };
export function overlap(A, ca, aa, B, cb, ab) {
  let worst = -Infinity;
  for (const [P, c1, a1, Q, c2, a2] of [[A, ca, aa, B, cb, ab], [B, cb, ab, A, ca, aa]]) {
    const dx0 = c1[0] - c2[0], dy0 = c1[1] - c2[1], dist = Math.hypot(dx0, dy0);
    // Q's points within P's tip lie inside the cone from Q's centre that P's
    // tip circle subtends (and a margin of 0.03 rad for Q's own radius)
    const w = dist > P.tip ? Math.asin(P.tip / dist) + 0.03 : Math.PI;
    // the even bins only, as landing H's law reads them, so the two agree point for point
    const n = Math.ceil(w / TAU * BINS), i0 = 2 * Math.round(mod((Math.atan2(dy0, dx0) - a2) / TAU, 1) * BINS / 2);
    for (let j = -n - (n % 2); j <= n; j += 2) {
      const i = (i0 + j + 2 * BINS) % BINS, r = Q.r[i];
      if (r < 0.6 * Q.tip) continue;                                  // a hub point never reaches the other part first
      const phi = i / BINS * TAU + a2;
      const px = c2[0] + r * Math.cos(phi), py = c2[1] + r * Math.sin(phi), dx = px - c1[0], dy = py - c1[1], d = Math.hypot(dx, dy);
      if (d > P.tip + 0.01) continue;
      const v = rAt(P, Math.atan2(dy, dx) - a1) - d;
      if (v > worst) worst = v;
    }
  }
  return worst;
}
// The 8T's own tooth phase (a tooth's angle in its frame): a pallet's mirror
// image across the anchor's centre line is the 8T turned π − 2τ − φ.
const tauCache = new Map();
const tau8 = (lib) => { if (!tauCache.has(lib)) tauCache.set(lib, toothPhase(lib, ESCAPEMENT_PARTS.pallet, 8).theta); return tauCache.get(lib); };
// a pallet's angle in the body's frame: the + pallet at its setting, the −
// pallet its mirror (the anchor is symmetric; one setting, cut twice)
export function palletAngle(esc, k) { return k > 0 ? esc.phase : Math.PI - 2 * esc.tau - esc.phase; }

// THE MODEL: the overlap of each pallet with the wheel at (θ, α), and the
// wheel's rest — the escape wheel is DRIVEN in its going sense σ, so wherever
// the anchor stands the wheel turns forward until a tooth meets a pallet, and
// if a pallet moves into it, it is pushed back (RECOIL) until it is clear.
export function escapementModel(lib, esc) {
  const W = starProfile(lib, esc.wheelPart), P = starProfile(lib, ESCAPEMENT_PARTS.pallet);
  const sigma = esc.sense, pitch = TAU / esc.teeth;
  const pal = (k, a) => { const c = Math.cos(a), s = Math.sin(a), x = k * esc.s, y = esc.vA; return [c * x - s * y, s * x + c * y - esc.vW]; };
  const overlapK = (k, th, a) => overlap(W, [0, 0], th, P, pal(k, a), a + palletAngle(esc, k));
  const depth = (th, a) => Math.max(overlapK(1, th, a), overlapK(-1, th, a));
  const bis = (lo, hi, a) => { for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (depth(m, a) > 0) hi = m; else lo = m; } return lo; };
  // forward to the first touch, in steps of half the radial gap over the
  // wheel's tip, never under a six-hundredth of a pitch (0.075° of an 8T, 6 µm
  // at its tip: no tooth is that thin), then bisected
  function forward(th, a, limit = 1.5 * pitch) {
    let t = th, d = depth(t, a);
    for (let k = 0; k < 4000; k++) {
      const step = sigma * Math.min(pitch / 60, Math.max(pitch / 600, -0.5 * d / W.tip));
      const t2 = t + step, d2 = depth(t2, a);
      if (d2 > 0) return bis(t, t2, a);
      t = t2; d = d2;
      if (Math.abs(t - th) > limit) return null;                     // runs free
    }
    return null;
  }
  function back(th, a) {
    let b = th, d;
    while ((d = depth(b, a)) > 0) { b -= sigma * Math.min(pitch / 60, Math.max(2e-4, 0.5 * d / W.tip)); if (Math.abs(b - th) > pitch) return null; }
    return bis(b, th, a);
  }
  const settle = (th, a) => (depth(th, a) > 0 ? back(th, a) : forward(th, a));
  // which pallet the wheel rests on: the one it would enter turning on
  const holder = (th, a) => { const t = th + sigma * 1e-4; return overlapK(1, t, a) > overlapK(-1, t, a) ? 1 : -1; };
  // how deep a pallet stands inside the wheel's tip circle (mm): the deepest
  // point of its outline, against the wheel's tip radius — the anchor must lift
  // it that far before a tooth can pass it
  function insideTip(k, a) {
    const c = pal(k, a), ang = a + palletAngle(esc, k);
    let deepest = -Infinity;
    for (let i = 0; i < BINS; i += 2) {
      const phi = i / BINS * TAU, r = P.r[i];
      const x = c[0] + r * Math.cos(phi + ang), y = c[1] + r * Math.sin(phi + ang);
      deepest = Math.max(deepest, W.tip - Math.hypot(x, y));
    }
    return deepest;
  }
  return { W, P, pitch, sigma, pal, overlapK, depth, settle, forward, back, holder, insideTip, esc };
}

// THE CYCLE, quasi-static: the anchor is turned through two full swings of
// amplitude A (deg) in `n` steps a leg, the wheel settled at every step. Each
// step is RECORDED: α, θ, the pallet the wheel rests on, and what happened —
// a DROP (the wheel ran free, more than a fortieth of a pitch in one step, to
// the next touch), RECOIL (it was pushed back against its drive), IMPULSE (it
// followed the receding pallet forward), or still. Returns the steps of the
// SECOND cycle (the first lets the start settle) and the wheel's advance over it.
// (A generator, so a page can run it between frames: it yields after every
// settle and RETURNS the result; traceCycle drains it.)
export function* traceCycleSteps(model, A, { n = 240, start = null } = {}) {
  const r = deg(A), { sigma, pitch } = model;
  let th = start;
  if (th === null) for (let k = 0; k < 120 && th === null; k++) if (model.depth(k * pitch / 120, -r) <= 0) th = model.settle(k * pitch / 120, -r);
  if (th === null) return { ok: false, why: 'no free place for the wheel at the swing\'s end' };
  const steps = [];
  let th0 = null;
  for (let c = 0; c < 2; c++) for (const [f, t] of [[-r, r], [r, -r]]) for (let i = 1; i <= n; i++) {
    const a = f + (t - f) * i / n, nt = model.settle(th, a);
    yield;
    if (nt === null) return { ok: false, why: model.depth(th, a) > 0 ? 'jams: a pallet cannot be cleared within a pitch' : 'runs: no pallet stops the wheel', at: a };
    const dth = (nt - th) * sigma;
    if (Math.abs(dth) > 0.9 * pitch) return { ok: false, why: 'runs: the wheel passed a whole pitch in one step', at: a };
    if (c === 1) {
      if (th0 === null) th0 = th;
      const kind = dth > pitch / 40 ? 'drop' : dth < -1e-6 ? 'recoil' : dth > 1e-6 ? 'impulse' : 'still';
      steps.push({ alpha: a, theta: nt, dth, kind, holder: model.holder(nt, a), dir: Math.sign(t - f) });
    }
    th = nt;
  }
  const advance = (th - th0) * sigma / pitch;
  const drops = steps.filter((s) => s.kind === 'drop');
  return { ok: Math.abs(advance - 1) < 1e-3, advance, steps, drops, theta0: th0 };
}
export function traceCycle(model, A, opts) {
  const it = traceCycleSteps(model, A, opts);
  let r;
  while (!(r = it.next()).done);
  return r.value;
}
// THE AMPLITUDE WINDOW: the least swing that escapes, the largest before the
// approaching pallet jams (or the cap), in `stepDeg` steps.
export function swingWindow(model, { lo = 0.2, hi = 8, stepDeg = 0.2, n = 160 } = {}) {
  const ok = [];
  for (let A = lo; A <= hi + 1e-9; A += stepDeg) if (traceCycle(model, A, { n }).ok) ok.push(r6(A));
  return { min: ok[0] ?? null, max: ok[ok.length - 1] ?? null, count: ok.length, contiguous: ok.length > 0 && Math.abs((ok[ok.length - 1] - ok[0]) / stepDeg + 1 - ok.length) < 1e-6 };
}

// THE ESCAPEMENT SOLVED, over the lattice. The anchor axle is the crossbar or
// the far axle hole of a plumb drop keyed on it (41677, 6632, 11478); the
// pallets ride round holes (8 mm out on a 6632; 8, 16 or 24 on an 11478); the
// wheel stands on the knife's line at a height a column can give, which the
// lattice fixes to vW = 3.2 j + (knifeH − holeZ) below the knife (both are
// stacks of plates on one baseplate); and each pallet's ONE SETTING is turned
// through the 8T's 45° in `phaseStep` steps. A geometry ESCAPES when two full
// swings of some amplitude in the window advance the wheel exactly one tooth
// each. The answer is the escaping geometry with the deepest engagement (the
// lock's margin over the bearings' play), its setting the MIDDLE of the run of
// settings that escape (the one a builder can miss by most), its sense the
// going sense (both escape; a symmetric anchor is its own mirror).
export const VW_OFFSET = r6(E.knifeH - D.holeZ);                  // 4.0: the lattice's offset
export function escCandidates(lib, teeth, { eMax = 1.4 } = {}) {
  const row = CATALOGUES.technic_classic.counts.find((c) => c.teeth === teeth);
  const tipW = GEAR_TIP_MM[row.part], tipP = GEAR_TIP_MM[ESCAPEMENT_PARTS.pallet];
  const out = [];
  const anchors = [{ drop: null, vA: -E.axleReach }, ...['41677', '6632', '11478'].map((p) => ({ drop: p, vA: r6(-E.axleReach + ARM_PARTS[p].reach) }))];
  const radii = [{ s: 8, palletArm: '6632' }, { s: 16, palletArm: '11478' }, { s: 24, palletArm: '11478' }];
  for (const an of anchors) for (const ra of radii) for (let j = -25; j <= 25; j++) {
    const vW = r6(VW_OFFSET + 3.2 * j), e = tipW + tipP - Math.hypot(ra.s, an.vA - vW);
    if (!(e > 0 && e < eMax)) continue;
    out.push({ teeth, wheelPart: row.part, ...an, ...ra, vW, e: r6(e) });
  }
  return out;
}
// THE SURVEY'S FAST FORM: the configuration space, once. For each anchor angle
// on a `da`° grid out to ±Amax and each of M wheel angles across one pitch,
// whether each pallet overlaps the wheel (bit 1 the + pallet, bit 2 the −).
// The wheel's rest at any α is then a walk along a row: forward until a
// blocked cell, back out of one — traceCycle's law on the grid, so a survey of
// every setting costs one map each rather than a trace per amplitude.
export function cspaceMap(model, { Amax = 6, da = 0.25, M = 90 } = {}) {
  const rows = Math.round(2 * Amax / da) + 1, map = new Uint8Array(rows * M);
  for (let i = 0; i < rows; i++) {
    const a = deg(-Amax + i * da);
    for (let k = 0; k < M; k++) {
      const th = k * model.pitch / M;
      map[i * M + k] = (model.overlapK(1, th, a) > 0 ? 1 : 0) | (model.overlapK(-1, th, a) > 0 ? 2 : 0);
    }
  }
  return { map, rows, M, Amax, da, sigma: model.sigma };
}
export function gridEscapes(cm, A, cycles = 2) {
  const { map, M, Amax, da, sigma } = cm, row = (a) => Math.round((a + Amax) / da);
  const blocked = (i, k) => map[i * M + mod(k, M)] !== 0;
  const i0 = row(-A), i1 = row(A);
  let k = null;
  for (let j = 0; j < M && k === null; j++) if (!blocked(i0, j)) k = j;
  if (k === null) return { ok: false, why: 'no free place' };
  const fwd = (i) => { let n = 0; while (!blocked(i, k + sigma) && n < M) { k += sigma; n++; } return n; };
  fwd(i0);
  const k0 = k, seq = [];
  for (let c = 0; c < cycles; c++) { for (let i = i0; i <= i1; i++) seq.push(i); for (let i = i1; i >= i0; i--) seq.push(i); }
  for (const i of seq) {
    let back = 0;
    while (blocked(i, k)) { k -= sigma; if (++back > M) return { ok: false, why: 'jams' }; }
    if (fwd(i) >= M) return { ok: false, why: 'runs' };
  }
  const adv = (k - k0) * sigma / M;
  return { ok: Math.abs(adv - cycles) < 0.05, adv };
}
export function solveEscapement(lib, { wheels = [8, 16], phaseStep = 3, sense = 1, Amax = 6, da = 0.25, M = 90 } = {}) {
  const tau = tau8(lib), found = [], tried = [];
  for (const teeth of wheels) for (const c of escCandidates(lib, teeth)) {
    const ok = [];
    for (let pd = 0; pd < 45; pd += phaseStep) {
      const cm = cspaceMap(escapementModel(lib, { ...c, tau, phase: deg(pd), sense }), { Amax, da, M });
      let hit = null;
      for (let a = da; a <= Amax - da + 1e-9 && hit === null; a += da) if (gridEscapes(cm, a).ok) hit = r6(a);
      if (hit !== null) ok.push({ pd, A: hit });
    }
    tried.push({ ...c, escapes: ok.length });
    if (ok.length) found.push({ ...c, settings: ok });
  }
  found.sort((p, q) => q.e - p.e || q.settings.length - p.settings.length);
  return { found, tried, best: found[0] ?? null };
}
// the setting refined on the grid: 0.5° steps either side of the coarse run;
// the middle of the run that escapes
export function refineSetting(lib, cand, { sense = 1, span = 3, Amax = 6, da = 0.25, M = 90 } = {}) {
  const tau = tau8(lib), pds = cand.settings.map((x) => x.pd), ok = [];
  for (let pd = Math.min(...pds) - span; pd <= Math.max(...pds) + span + 1e-9; pd += 0.5) {
    const cm = cspaceMap(escapementModel(lib, { ...cand, tau, phase: deg(pd), sense }), { Amax, da, M });
    for (let a = da; a <= Amax - da + 1e-9; a += da) if (gridEscapes(cm, a).ok) { ok.push(pd); break; }
  }
  return { lo: ok[0], hi: ok[ok.length - 1], mid: (ok[0] + ok[ok.length - 1]) / 2, n: ok.length };
}
// THE DECLARED ESCAPEMENT (the probe re-solves and fails when the solve
// answers otherwise). In the body's frame: the anchor axle 8 mm under the
// crossbar on a 41677, the pallets 8 mm either side on 6632s, the 8T escape
// wheel 10.4 mm under the knife; the + pallet's setting in degrees.
export const TECHNIC_ESCAPEMENT = Object.freeze({ teeth: 8, wheelPart: '3647', drop: '41677', vA: 5.6, s: 8, palletArm: '6632', vW: 10.4, phaseDeg: 38.75, sense: 1 });
export const escSpec = (lib, spec = TECHNIC_ESCAPEMENT) => ({ ...spec, tau: tau8(lib), phase: deg(spec.phaseDeg) });

// THE SWING THE PAGE DRAWS, POSED: inside the window the geometry admits (the
// probe holds it there), a few degrees, as the note's "swings a few degrees".
export const ESC_SWING_DEG = 3;
// The bearings' play the lock is compared against: the note's F2 figure for a
// plastic axle in a plastic hole. POSED (a figure quoted, not measured here).
export const F2_PLAY_MM = 0.1;

// ── WHAT ONE BEAT DOES, MEASURED ────────────────────────────────────────────
// From the traced cycle: each DROP (deg of the wheel, and mm at its tip), the
// LOCK — at each catch, how deep the catching pallet stands inside the wheel's
// tip circle — the RECOIL and the IMPULSE per beat (deg of the wheel), and the
// advance per beat and per period.
export function beatMeasures(model, A) {
  const tr = traceCycle(model, A);
  if (!tr.ok) return { ok: false, ...tr };
  const W = model.W, beats = [];
  // a beat is one leg of the swing (one direction)
  for (const dir of [1, -1]) {
    const leg = tr.steps.filter((s) => s.dir === dir);
    const drops = leg.filter((s) => s.kind === 'drop');
    const sum = (k) => leg.filter((s) => s.kind === k).reduce((t, s) => t + s.dth, 0);
    const catches = drops.map((s) => ({ alpha: s.alpha, holder: s.holder, lockMM: model.insideTip(s.holder, s.alpha) }));
    beats.push({ dir, advance: leg.reduce((t, s) => t + s.dth, 0) / model.pitch, drops: drops.map((s) => s.dth), dropMM: drops.map((s) => s.dth * W.tip),
      recoil: -sum('recoil'), impulse: sum('impulse'), catches });
  }
  const lock = Math.min(...beats.flatMap((b) => b.catches.map((c) => c.lockMM)));
  const deepest = Math.max(...tr.steps.map((s) => model.insideTip(s.holder, s.alpha)));
  return { ok: true, A, beats, lockMM: lock, deepestMM: deepest, advance: tr.advance, trace: tr };
}

// THE HAND ON THE GREAT WHEEL: the balance at rest, the wheel on a pallet, and
// a torque τ on the escape arbor. The wheel can only turn forward by pushing
// the pallet that holds it the way it recedes, and that lifts the balance; the
// work balances, τ dθ = m g d sin α dα, so along the contact the torque that
// holds the balance at α is m g d sin α / (dθ/dα). The largest of that before
// the pallet lets go is the torque that TRIPS the escapement; below it the
// lock holds, the balance standing deflected. FRICTIONLESS (it only adds), the
// mass at ESC_DENSITY's band. Returned per mm³·(g/cm³) of the balance: the
// caller multiplies by the mass.
export function tripTorque(model, mo, { step = 0.01 } = {}) {
  const { sigma } = model;
  let a = 0, th = model.settle(0, 0);
  // which way does the wheel's push turn the anchor? the way θ rises along the contact
  const k = model.holder(th, 0);
  const at = (alpha) => model.settle(th, alpha);
  const plus = (at(deg(step)) - th) * sigma, minus = (at(-deg(step)) - th) * sigma;
  const dir = plus > minus ? 1 : -1;
  let worst = 0, aWorst = 0, released = null;
  for (let i = 1; i < 2000; i++) {
    const na = dir * deg(step * i), nt = model.settle(th, na);
    if (nt === null) break;
    const dth = (nt - th) * sigma;
    if (dth > model.pitch / 40) { released = na; break; }        // the pallet let go: the wheel ran on
    if (model.holder(nt, na) !== k) { released = na; break; }
    const slope = dth / Math.abs(na - a);
    if (slope > 1e-9) { const need = Math.sin(Math.abs(na)) / slope; if (need > worst) { worst = need; aWorst = na; } }
    a = na; th = nt;
  }
  // τ = need × m g d (N·mm when m in kg and g d in mm/s²·mm ... see below)
  return { perMgd: worst, alphaWorst: aWorst, released, dir, holder: k };
}

// ── THE FRAME (mm: x across, y along the crossbar, z up from the baseplate) ──
// One knife line at x = X0 (a 1×2 stack's studs straddle it, so it stands on a
// half stud: X0 ≡ 4 mod 8), the escape arbor under it on jumper columns.
// Along y, front to back, each slab a part's thickness, bodies that move apart
// AX_CLEAR (one LDU) apart:
//   R1 (front knife) | bob 40Ts | bob arm | mass arm −u | mass arm +u |
//   anchor drop | pallet arm −u | pallet arm +u | W (pallets and wheel) |
//   escape columns E1, E2 (the mass 40Ts beside them, far out) | R2 (back knife)
// The bob's axle runs forward from its arm into the gear slabs, each mass axle
// back from its arm to its 40Ts; the anchor axle from the pallet arms forward
// into the + mass arm's slab (it may not reach W, where the wheel's teeth pass
// 0.4 mm under it, nor the bob arm) — or, when the bob rides it, on into the
// bob's slabs;
// each pallet pin's pin half spans both pallet arms, its axle half is W. The
// escape arbor runs from the wheel back through E1 and E2; R2 stands past its
// end, because the knife's stack fills its slab below the apex.
export const ESC_X0 = 4;
export const AX_CLEAR = 0.4;
const HALF = D.stud / 2;
const lens = Object.keys(AXLE_PARTS).map(Number).sort((p, q) => p - q);
export const axleLen = (n) => n * D.stud - 0.4;                       // the library trims half an LDU each end
const axleCovering = (need) => lens.find((n) => axleLen(n) >= need - 1e-9) ?? null;
// §312 — THE ESCAPEMENT IN A GOING TRAIN (src/technic-train.js) takes three options, each a position-space
// fold that moves no part of the balance or the anchor (so the period and the cycle are §287's):
//   · `x0`, the knife line. The train lands the escape arbor on whatever x its meshes reach, and every
//     catalogue centre distance it uses keeps x ≡ 0 (mod 8) from the centre arbor's, so the line may be ON
//     the stud grid. A 1×2 stack centred on a stud stands half a stud off the grid: its bottom plate is a
//     1×2 JUMPER (3794b, the frame's own half-stud part) along x, its one stud under the stack's −x anti-stud.
//     The escape arbor's columns, on a stud, stand on 1×1 plates.
//   · `zE`, the escape arbor's height: the train drives the escape wheel from straight below (a 24:8 mesh is
//     16 mm, five plates), so the arbor stands where the train puts it, raised by whole plates from the lowest.
//   · `driveZ`, the drive's bearings at that height, under the anchor: a 1×2 Technic brick (`driveBrick`, the
//     train's part) in the FRONT knife's stack and a second 1×1 Technic brick in the front escape column. The
//     drive's axle is threaded through the knife's hole from in front, before the balance is hung (between the two
//     knives it could not be: they shut both ends of its line, and the gap between the front knife and the escape
//     columns is shorter than the axle — the steps' swept insertion found it). `driveFrom: 'back'` turns that
//     round: the 1×2 Technic brick in the BACK knife's stack and a hole in both escape columns, the axle threaded
//     from behind through all three (the classic going train's line in front runs into its fusee).
export function frameEscapement(spec = TECHNIC_ESCAPEMENT, bal = TECHNIC_BALANCE, { x0: X0 = ESC_X0, zE: zWant = null, driveZ = null, driveBrick = null, driveFrom = 'front' } = {}) {
  const ra = E.axleReach, tip40 = GEAR_TIP_MM[ESCAPEMENT_PARTS.mass];
  // ── heights: the lowest knife whose balance clears the baseplate's studs
  // (its lowest point, the bob's 40T or a mass 40T, at the posed swing's
  // extreme, over stud tops and a clearance)
  const bobV = bal.bob.length ? -ra + ARM_PARTS[bal.bobArm].reach : -Infinity, massU = ARM_PARTS[bal.massArm].reach;
  const tipOf = (list) => Math.max(0, ...list.map((p) => GEAR_TIP_MM[p])), tipM = tipOf(bal.masses), tipB = tipOf(bal.bob);
  const sw = deg(ESC_SWING_DEG + 1);
  const lowest = Math.max(bal.bob.length ? bobV + tipB : -Infinity, bal.masses.length ? -ra + massU * Math.sin(sw) + tipM : -Infinity, spec.vA + E.armHalfWidth, spec.vW + GEAR_TIP_MM[spec.wheelPart]);
  let n = 1;
  while (D.plateH * n + E.knifeH < lowest + D.studH + AX_CLEAR) n++;
  if (zWant !== null) {
    const nw = Math.round((zWant + spec.vW - E.knifeH) / D.plateH);
    if (Math.abs(D.plateH * nw + E.knifeH - spec.vW - zWant) > 1e-6) return { framed: false, reason: `an escape arbor at ${zWant} mm puts the knife off the plate lattice` };
    if (nw < n) return { framed: false, reason: `an escape arbor at ${zWant} mm hangs the balance under the stud tops (it needs ${r6(D.plateH * n + E.knifeH - spec.vW)})` };
    n = nw;
  }
  const zK = r6(D.plateH * n + E.knifeH), zE = r6(zK - spec.vW);
  if (mod(X0, D.stud / 2) !== 0) return { framed: false, reason: `a knife line at x ${X0} is on neither the stud grid nor its half` };
  const m = Math.round((zE - D.holeZ - D.plateH) / D.plateH);
  if (Math.abs(D.plateH * (1 + m) + D.holeZ - zE) > 1e-6) return { framed: false, reason: `the escape arbor at ${zE} mm is not a column's hole height` };
  // ── slabs along y
  // The mass 40Ts ride BEHIND the anchor when their inner edge passes the
  // stacks' half span (a 40T 32 mm out clears a 1×2 stack by 3 mm), in the
  // columns' slabs, where nothing else stands that far out; otherwise in front
  // with the bob. The bob's 40Ts are always in front, where nothing stands on
  // the knife's line.
  const behind = bal.masses.length > 0 && massU - tipM >= D.stud + AX_CLEAR;
  const onAnchor = bobOnAnchor(bal, spec);
  const bobR = bal.bob.length ? ARM_PARTS[bal.bobArm].reach : 0;
  const shareFront = !bal.bob.length || Math.hypot(massU, bobR) >= tipM + tipB + AX_CLEAR;   // mass and bob gears side by side in one slab
  const front = behind ? bal.bob.length : shareFront ? Math.max(bal.masses.length, bal.bob.length) : bal.masses.length + bal.bob.length;
  const span = (a0, a1, fix) => { const k = axleCovering(a1 - a0); if (k === null) return null; return fix === 'front' ? { y0: r6(a0), y1: r6(a0 + axleLen(k)), part: AXLE_PARTS[k], lenStuds: k } : { y0: r6(a1 - axleLen(k)), y1: r6(a1), part: AXLE_PARTS[k], lenStuds: k }; };
  // Laid out from `start`; an axle on the knife's line (the bob's, the
  // anchor's) is flush with its back face (it may not reach W) and runs
  // forward its whole length, so when it would reach R1's slab the layout
  // starts that much further back.
  // §305 (TODO 264) — A GEAR THAT REACHES THE CROSSBAR CANNOT SHARE ITS SPAN. The crossbar runs from the front
  // knife to the back one, so every slab between them holds it; a gear keyed to the balance whose centre stands
  // nearer the crossbar's axis than its own tip plus the axle's reach would stand IN it there (the 40T bob, 16 mm
  // under it with a 20.94 mm tip, did: the crossbar through its web, 4.31 LDU deep). Such a gear slab, with the arms
  // whose axles carry it, hangs IN FRONT of the front knife, its face AX_CLEAR off the knife's stack, and the
  // crossbar reaches forward to carry the frontmost arm. (A bob on the anchor's own axle cannot: that axle is on the
  // knife's line and would pass the front knife's stack, so such a balance is refused.)
  const reachesBar = (bal.bob.length > 0 && bobR < tipB + ra) || (!behind && bal.masses.length > 0 && massU < tipM + ra);
  if (reachesBar && onAnchor) return { framed: false, reason: 'a gear on the anchor\'s axle reaches the crossbar, and that axle cannot pass the front knife' };
  const lay = (start) => {
    let y = start;
    const slab = (name, h) => { const s = { name, y0: r6(y), y1: r6(y + h) }; y += h; return s; };
    // the slabs in front of the front knife (when a gear reaches the crossbar): the gears, the bob's arm and —
    // when the masses share the gears' slab — the mass arms, laid back to AX_CLEAR off the knife's front face
    const ahead = reachesBar ? [bal.bob.length && !onAnchor ? 'B' : null, ...(behind ? [] : ['M1', 'M2'])].filter(Boolean) : [];
    if (reachesBar) y = -HALF - AX_CLEAR - 2 * E.gearHalf * front - 2 * E.armHalfThick * ahead.length;
    const G = slab('gears', 2 * E.gearHalf * front);
    const B = bal.bob.length && !onAnchor ? slab('bob arm', 2 * E.armHalfThick) : null;
    if (reachesBar && !ahead.includes('M1')) y = start;
    const M1 = slab('mass arm −u', 2 * E.armHalfThick), M2 = slab('mass arm +u', 2 * E.armHalfThick);
    if (reachesBar && ahead.includes('M1')) y = start;
    const Dp = spec.drop ? slab('anchor drop', 2 * E.armHalfThick) : null;
    const P1 = slab('pallet arm −u', 2 * E.armHalfThick), P2 = slab('pallet arm +u', 2 * E.armHalfThick);
    const W = slab('pallets', 2 * E.gearHalf);                        // the pins' axle halves: the pallets' slab
    const wheel = { name: 'escape wheel', y0: r6(W.y0 + AX_CLEAR), y1: r6(W.y1 + AX_CLEAR) };
    const Gb = behind ? { name: 'mass gears', y0: r6(wheel.y1 + AX_CLEAR), y1: r6(wheel.y1 + AX_CLEAR + 2 * E.gearHalf * bal.masses.length) } : null;
    const bobAxle = B ? span(G.y0, B.y1, 'back') : null;
    // the anchor axle: flush with P2's back face, forward over the drop into
    // M2 — or, carrying the bob, forward into the gear slabs
    const anchorAxle = span(onAnchor ? G.y0 : (Dp ?? P1).y0, P2.y1, 'back');
    return { G, B, M1, M2, D: Dp, P1, P2, W, wheel, Gb, bobAxle, anchorAxle };
  };
  let S = lay(HALF + AX_CLEAR);
  const reach = Math.min(...[reachesBar ? null : S.bobAxle, S.anchorAxle].filter(Boolean).map((a) => a.y0));
  if (reach < HALF + AX_CLEAR) S = lay(r6(HALF + AX_CLEAR + (HALF + AX_CLEAR - reach)));
  const { G, B, M1, M2, D: Dp, P1, P2, W: Wp, wheel: Ww, Gb, bobAxle, anchorAxle } = S;
  if (!anchorAxle || (B && !bobAxle)) return { framed: false, reason: 'an axle on the knife\'s line is past the longest axle' };
  // the escape columns on the stud grid behind the wheel
  const e1 = Math.ceil((Ww.y1 + AX_CLEAR + HALF) / D.stud) * D.stud, e2 = e1 + D.stud;
  // the escape arbor: from the wheel's front face back through both columns
  const eNeed = e2 + HALF - Ww.y0, eN = axleCovering(eNeed);
  const escAxle = { shaft: 'escape', x: X0, z: zE, y0: Ww.y0, y1: r6(Ww.y0 + axleLen(eN)), part: AXLE_PARTS[eN], lenStuds: eN };
  const r2 = Math.ceil((escAxle.y1 + AX_CLEAR + HALF) / D.stud) * D.stud;
  // the crossbar: from R1's front face to R2's back face, the shortest that spans
  // (from the frontmost arm's front face when the gears hang ahead of the front knife, §305)
  const c0 = reachesBar ? Math.min(...[B, M1].filter((s) => s && s.y1 <= -HALF).map((s) => s.y0)) : -HALF;
  const cNeed = r2 + HALF - c0, cN = axleCovering(cNeed);
  if (cN === null) return { framed: false, reason: `the crossbar needs ${cNeed.toFixed(1)} mm, past the longest axle` };
  const crossbar = { y0: c0, y1: r6(c0 + axleLen(cN)), part: AXLE_PARTS[cN], lenStuds: cN };
  // a mass axle from its arm to its gears, forward or back
  const massAxles = [M1, M2].map((M) => (behind ? span(M.y0, Gb.y1, 'front') : span(G.y0, M.y1, 'back')));
  if (massAxles.some((a) => !a)) return { framed: false, reason: 'a mass axle is past the longest axle' };
  if (behind && Math.max(Gb.y1, ...massAxles.map((a) => a.y1)) > crossbar.y1) return { framed: false, reason: 'the mass gears stand past the crossbar\'s end' };
  // ── columns: the knives (1×2 stacks, the 3044b on top) and the escape arbor's
  const onStud = mod(X0, D.stud) === 0;
  if (driveZ !== null && !driveBrick) return { framed: false, reason: 'a drive hole needs the 1×2 Technic brick that carries it in a knife' };
  if (!['front', 'back'].includes(driveFrom)) return { framed: false, reason: `the drive is threaded from the front or the back, not ${driveFrom}` };
  // the front knife's drive brick: plate heights from the stack's bottom plate to it, and from it to the knife
  const kD = driveZ === null ? null : Math.round((driveZ - D.holeZ - D.plateH) / D.plateH), kUp = kD === null ? null : n - 1 - kD - 3;
  if (kD !== null && (Math.abs(D.plateH * (1 + kD) + D.holeZ - driveZ) > 1e-6 || kD < 0 || kUp < 0)) return { framed: false, reason: `a drive hole at ${driveZ} mm is not a brick's hole height in the knife's stack` };
  const knifeCol = (end, yc) => {
    const units = n;                                                // plate heights under the knife
    const boxes = [];
    let zz = 0;
    const push = (part, h, dx = 0, extra = {}) => { boxes.push({ part, x0: X0 + dx - D.stud, x1: X0 + dx + D.stud, y0: yc - HALF, y1: yc + HALF, z0: r6(zz), z1: r6(zz + h), ...(dx ? { jumper: true } : {}), ...extra }); zz += h; };
    // on a stud, the stack's bottom plate is a jumper half a stud toward −x (its stud under the −x anti-stud)
    if (onStud) push(FRAME_PARTS.jumper1x2, D.plateH, -HALF);
    else push(ESCAPEMENT_PARTS.stackPlate, D.plateH);
    const fill2 = (m2) => { const k = Math.floor(m2 / 3), p = m2 - 3 * k; for (let i = 0; i < p; i++) push(ESCAPEMENT_PARTS.stackPlate, D.plateH); for (let i = 0; i < k; i++) push(ESCAPEMENT_PARTS.stackBrick, D.brickH); };
    if (kD !== null && end === driveFrom) { fill2(kD); push(driveBrick, D.brickH, 0, { hole: true, drive: true }); fill2(kUp); }
    else fill2(units - 1);
    boxes.push({ part: ESCAPEMENT_PARTS.knife, knife: true, x0: X0 - E.knifeHalfSpan, x1: X0 + E.knifeHalfSpan, y0: yc - E.knifeHalfLength, y1: yc + E.knifeHalfLength, z0: r6(zz), z1: r6(zz + E.knifeH) });
    return { shaft: 'knife', end, x: X0, y: yc, boxes, apex: r6(zz + E.knifeH) };
  };
  // plates and bricks for `m` plate heights, bricks where three plates would stand
  const fill = (stack, m2) => { const k = Math.floor(m2 / 3), p = m2 - 3 * k; for (let i = 0; i < p; i++) stack.push({ part: FRAME_PARTS.plate1x1, h: D.plateH, dx: HALF }); for (let i = 0; i < k; i++) stack.push({ part: FRAME_PARTS.brick1x1, h: D.brickH, dx: HALF }); };
  // the drive's hole, when asked: plate heights from the bottom plate's top to it, and from its brick's top to the arbor's
  const mD = driveZ === null ? null : Math.round((driveZ - D.holeZ - D.plateH) / D.plateH), mGap = mD === null ? null : m - mD - 3;
  if (mD !== null && (Math.abs(D.plateH * (1 + mD) + D.holeZ - driveZ) > 1e-6 || mD < 0 || mGap < 0)) return { framed: false, reason: `a drive hole at ${driveZ} mm is not a column's hole height under the arbor's` };
  const arborCol = (end, yc) => {
    const stack = [{ part: onStud ? FRAME_PARTS.plate1x1 : FRAME_PARTS.jumper1x2, h: D.plateH, dx: onStud ? HALF : D.stud }];
    if (mD !== null && (end === 'front' || driveFrom === 'back')) { fill(stack, mD); stack.push({ part: FRAME_PARTS.technicBrick1x1, h: D.brickH, dx: HALF, hole: true, drive: true }); fill(stack, mGap); }
    else fill(stack, m);
    stack.push({ part: FRAME_PARTS.technicBrick1x1, h: D.brickH, dx: HALF, hole: true });
    let zz = 0;
    const boxes = stack.map((s) => { const b = { part: s.part, x0: X0 - s.dx, x1: X0 + s.dx, y0: yc - HALF, y1: yc + HALF, z0: r6(zz), z1: r6(zz + s.h), hole: !!s.hole, ...(s.drive ? { drive: true } : {}) }; zz += s.h; return b; });
    return { shaft: 'escape', end, x: X0, y: yc, boxes, holeZ: r6(zz - D.brickH + D.holeZ), ...(mD !== null ? { driveZ: r6(driveZ) } : {}) };
  };
  const columns = [knifeCol('front', 0), arborCol('front', e1), arborCol('back', e2), knifeCol('back', r2)];
  const frame = {
    key: 'escapement', gen: 'technic_classic', spec, bal, x0: X0, zK, zE, plates: n, columnPlates: m, ...(driveZ !== null ? { driveZ: r6(driveZ), driveFrom } : {}),
    slabs: { G, B, M1, M2, D: Dp, P1, P2, W: Wp, wheel: Ww, Gb }, behind, shareFront,
    crossbar, massAxles, bobAxle, anchorAxle, escAxle, columns,
  };
  const xs = columns.flatMap((c) => c.boxes.flatMap((b) => [b.x0, b.x1])), ys = columns.flatMap((c) => c.boxes.flatMap((b) => [b.y0, b.y1]));
  frame.base = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  frame.base.studsX = (frame.base.x1 - frame.base.x0) / D.stud; frame.base.studsY = (frame.base.y1 - frame.base.y0) / D.stud;
  frame.framed = true;
  return frame;
}

// The balance's parts with their slabs (w, mm along the crossbar from the
// knife's station y = 0) and their real axles: the FRAMED body, which is what
// the period is read off (solveBalance frames every candidate).
export function framedBalance(frame, lib) {
  const { bal, slabs: S } = frame, ra = E.axleReach, esc = escSpec(lib, frame.spec);
  const mid = (s) => (s.y0 + s.y1) / 2;
  const axles = { crossbar: frame.crossbar, 'mass+': frame.massAxles[1], 'mass-': frame.massAxles[0], bob: frame.bobAxle, anchor: frame.anchorAxle };
  return balanceParts(bal, esc).map((p) => {
    const q = { ...p, m: [...p.m] };
    if (p.role === 'crossbar' || p.role === 'axle') { const a = axles[p.slab]; q.part = a.part; q.m[2] = mid(a); }
    else if (p.role === 'arm' || p.role === 'pallet') q.m[2] = mid(S[p.slab]);
    else if (p.role === 'mass' && !p.bob && frame.behind) q.m[2] = r6(S.Gb.y0 + E.gearHalf + 2 * E.gearHalf * p.gear);
    else if (p.role === 'mass') { const idx = p.bob ? p.gear : (frame.shareFront ? 0 : bal.bob.length) + p.gear; q.m[2] = r6(S.G.y1 - E.gearHalf - 2 * E.gearHalf * idx); }
    else if (p.role === 'pin') q.m[2] = S.P2.y1;                       // its pin/axle junction at the pallet arms' back face
    return q;
  });
}

// ── THE BUILD (LDraw placements; landing B's conventions) ────────────────────
// Two bodies: the BALANCE (the crossbar and everything keyed to it), turning α
// about the knife's apex line, and the ESCAPE ARBOR, turning θ about its axis.
const fr = (x, y, z) => [L(x), -L(z), L(y)];
const at = (X, Y, Z, r = I3) => [X, Y, Z, ...r];
export function escapementBuild(frame, lib, { alpha = 0, theta = 0 } = {}) {
  const statics = [];
  const midX = L((frame.base.x0 + frame.base.x1) / 2), midZ = L((frame.base.y0 + frame.base.y1) / 2);
  const snap = (v) => Math.round((v - 10) / 20) * 20 + 10;
  const studs = Math.max(frame.base.studsX, frame.base.studsY) + 1;
  statics.push({ role: 'baseplate', part: studs <= 16 ? FRAME_PARTS.baseplate16 : '3811', m: at(snap(midX), 0, snap(midZ)) });
  const roleOf = (p, b) => (p === FRAME_PARTS.technicBrick1x1 || (b.hole && b.drive) ? 'technicBrick' : p === ESCAPEMENT_PARTS.knife ? 'knife' : p === FRAME_PARTS.brick1x1 || p === ESCAPEMENT_PARTS.stackBrick ? 'brick' : 'plate');
  for (const c of frame.columns) for (const b of c.boxes)
    statics.push({ role: roleOf(b.part, b), part: b.part, m: at(L((b.x0 + b.x1) / 2), -L(b.z1), L((b.y0 + b.y1) / 2), b.knife ? KNIFE : I3) });
  // the balance: origin on the knife's apex line (y = 0 there), each part at
  // its body-frame place — (u, v, w) mm is LDraw (X, Y, Z)/0.4 about the origin
  const body = framedBalance(frame, lib).map((p) => ({ role: p.role === 'crossbar' ? 'axle' : p.role, part: p.part, m: [L(p.m[0]), L(p.m[1]), L(p.m[2]), ...p.m.slice(3)] }));
  const balance = { shaft: 'balance', origin: fr(frame.x0, 0, frame.zK), phi: alpha, speed: 0, parts: body };
  const ea = frame.escAxle;
  const arbor = { shaft: 'escape', origin: fr(frame.x0, 0, frame.zE), phi: theta, speed: 0, parts: [
    { role: 'axle', part: ea.part, m: at(0, 0, L((ea.y0 + ea.y1) / 2), X2Z) },
    { role: 'wheel', part: frame.spec.wheelPart, teeth: frame.spec.teeth, m: at(0, 0, L((frame.slabs.wheel.y0 + frame.slabs.wheel.y1) / 2)) },
  ] };
  return { key: 'escapement', gen: frame.gen, statics, shafts: [balance, arbor], meshes: [], modes: ['swing'] };
}

// ── THE CYCLE THE PAGE DRAWS ────────────────────────────────────────────────
// The balance swings α(t) = A sin(2π t / T) at the posed amplitude and the
// SOLVED period (display time runs at the speed slider's rate); the wheel's
// angle at every α is read off the traced cycle (a table, interpolated along
// the swing's phase), so every drop, recoil and impulse the page shows is one
// the parts make. The phase line names the step's kind; LOCK is the step at
// which a drop ends (the catch) and the anchor's first quarter degree after it;
// UNLOCK the last quarter degree of impulse before a drop.
export function* cycleModelSteps(lib, frame, { A = ESC_SWING_DEG, T = null, n = 240 } = {}) {
  const model = escapementModel(lib, escSpec(lib, frame.spec));
  const tr = yield* traceCycleSteps(model, A, { n });
  if (!tr.ok) return { ok: false, why: tr.why };
  const steps = tr.steps, N = steps.length;
  // the kind, read over a quarter degree of the anchor either side (a single
  // settle jitters by a bisection's width; the motion does not), drops kept
  const q = deg(0.25), w = Math.max(1, Math.round(q / (2 * deg(A) / n)));
  const lab = steps.map((s, i) => {
    if (s.kind === 'drop') return 'drop';
    let net = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(N - 1, i + w); j++) if (steps[j].kind !== 'drop' && steps[j].dir === s.dir) net += steps[j].dth;
    return net < -1e-5 ? 'recoil' : net > 1e-5 ? 'impulse' : 'still';
  });
  // LOCK after a catch, UNLOCK before a release
  for (let i = 0; i < N; i++) if (steps[i].kind === 'drop') {
    for (let j = i + 1; j < N && Math.abs(steps[j].alpha - steps[i].alpha) <= q && steps[j].kind !== 'drop'; j++) lab[j] = 'lock';
    for (let j = i - 1; j >= 0 && Math.abs(steps[j].alpha - steps[i].alpha) <= q && lab[j] === 'impulse'; j--) lab[j] = 'unlock';
  }
  return { ok: true, A, T: T ?? BEAT_PERIOD_S, model, steps, labels: lab, theta0: tr.theta0, pitch: model.pitch, sigma: model.sigma };
}
export function cycleModel(lib, frame, opts) {
  const it = cycleModelSteps(lib, frame, opts);
  let r;
  while (!(r = it.next()).done);
  return r.value;
}
// The pose at display time t (s): the swing's phase picks a step of the traced
// cycle (two legs, −A → A → −A, n steps each); α is the swing's own sine, the
// wheel's angle the step's, plus one pitch per period already run.
export function cyclePose(cm, t) {
  const N = cm.steps.length, per = cm.T;
  const cyc = Math.floor(t / per), f = t / per - cyc;            // phase in [0, 1)
  // α = −A cos(2π f): −A at f = 0, A at f = ½ — the legs' own order
  const alpha = -deg(cm.A) * Math.cos(TAU * f);
  // the step: the leg by the phase, the place in it by α
  const leg = f < 0.5 ? 0 : 1, n = N / 2;
  const u = leg === 0 ? (alpha + deg(cm.A)) / (2 * deg(cm.A)) : (deg(cm.A) - alpha) / (2 * deg(cm.A));
  const i = Math.min(N - 1, Math.max(0, leg * n + Math.round(u * n) - 1));
  const s = cm.steps[i];
  return { alpha, theta: s.theta + cm.sigma * cyc * cm.pitch, kind: cm.labels[i], holder: s.holder, step: i, cycle: cyc };
}
