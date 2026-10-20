// §219 tier three (b), landing I — THE ALARM MODULE AS A LEGO BUILD: a column
// wheel that a pusher indexes, a release disc geared 12:1 off an hour axle, and
// a striking train that ends in a FLY, with its hammer on a cam and its barrel a
// rubber band. MODELLED: every part is placed and measured, and every law that
// moves one part from another is geometry read off the parts. Nothing is
// integrated, and every FORCE is posed (the bands, the barrel, the air). Pure:
// no three.js, no DOM. tools/probe-technic-alarm.mjs holds it.
//
// THE QUESTION (docs/LEGO_FEASIBILITY.md §3.7 in the roadmap repo, module 3 of
// its §4): the steel alarm is a six-column wheel indexed to 12 stops by a
// pusher's pawl (its parity is the on/off), a setting disc whose notch a feeler
// drops into at the set hour, and a striking train geared 4:1 off its barrel to
// a four-lobe cam, governed by an anchor on a 20T saw whose poising ring is
// solved to a 0.42 s gap. Which of that has a LEGO form, read off the parts?
//
// WHAT IS A DIFFERENT MECHANISM, SAID WHEREVER IT IS DESCRIBED: the governor.
// The steel one is an OSCILLATOR (an anchor and its ring, a period). LEGO's is
// a FLY — two vanes on the last arbor, braked by AIR DRAG, with no period at
// all. Same job (it slows the strike), different physics, and the cadence it
// gives can only be measured. And the gong: there is no LEGO part that rings,
// so the hammer strikes a brick, and the record says so.
//
// WHAT IS POSED, BY NAME (TECHNIC_ALARM_STRIKE, below): the barrel's band (its
// turns of wind), the cadence (the fly's drag against the band's torque), and so
// the strikes per wind — a table labelled "to be measured", standing in the
// steel's own numbers until a LEGO band is measured. Also posed: the bands on
// the release lever, the pawl, the detent, the driver and the hammer. The model
// measures DIRECTIONS and CONTACTS (which way a pawl locks, where a beak rides,
// when a nose drops, where a fly is caught), never a force.
//
// WHAT WAS MEASURED AND REFUSED: a stock NOTCHED DISC. Every axle-keyed round
// part in the LDraw library was read for an outline with one notch, and none has
// one (the record in docs/BUILT.md names the survey). So the notch is BUILT: a
// ring of three pins at 90° on two beams keyed to the disc's axle, the fourth
// place empty. The release arm's flat side rides the three pins; where the
// fourth would be, it drops. The drop is a V (the arm drops as the empty place
// turns under it), not a cut step, and the record gives its slope in minutes.
import { LDU_MM } from './ldraw.js';
import { LEGO_DIM_MM, FRAME_PARTS, AXLE_PARTS, GEAR_TIP_MM, KEYLESS_PULL_DIM_MM, KEYLESS_PARTS } from './technic-frame.js';
import { surfaceSamples, toothPhase } from './technic-ldraw.js';
import { pawlModel, pawlLock, starProfile, penetration, FUSEE_DIM_MM, pawlRideSteps } from './technic-fusee.js';
// (pawlRideSteps: landing H's ride of a pawl over its wheel, which §283's press
// reads for the alarm's pawl rather than tracing a second one)

const D = LEGO_DIM_MM;
const L = (mm) => mm / LDU_MM;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const TAU = 2 * Math.PI;
const mod = (a, m) => ((a % m) + m) % m;
const deg = (d) => d * Math.PI / 180;

// ── THE PARTS ───────────────────────────────────────────────────────────────
// Every part the module places, by role. All classic: the same build stands in
// both generations.
//   · the COLUMN WHEEL is two 3-blade rotors (2712) on one axle, the second
//     turned over: a 3-blade rotor's blades stand at 90°, 210° and 330° of its
//     own frame, turned over at 270°, 150° and 30°, so the pair is SIX columns
//     60° apart, which no keyed quarter turn of two unflipped rotors gives
//     (90° steps put the second set at 0°, 120°, 240°: gaps of 30° and 90°);
//   · the 12-position RATCHET the pawl indexes is the 12T (69778), and the
//     DETENT (the steel's sautoir) is a round half bush (32123a) on a thin
//     liftarm (6632) banded onto the same wheel, landing F's idiom;
//   · the PAWL is a keyed 8T (3647) at an end hole of a thin liftarm (6632)
//     pivoting on its round middle hole — landing H's click, the 8T's teeth
//     read for the way it LOCKS (pawlLock) — carried by the DRIVER, a 5L thin
//     liftarm (11478) idling on the column wheel's axle by its round middle
//     hole, whose other end is the PUSHER a finger presses;
//   · the RELEASE DISC is a ring of pins (3673, and one 6558 long pin) in two
//     thick 1×3 beams with a centre axle hole (7229) keyed at 90° to each
//     other — three pins, the fourth place empty (the notch);
//   · the RELEASE LEVER is a 5L thin liftarm (11478) keyed by an end hole:
//     its flat side rides the disc's pins, its far end catches the fly, and a
//     pin (3673) in its middle round hole is the BEAK reading the columns;
//   · the FLY is two thick 1×3 beams (7229) crossed on the last arbor: FOUR
//     vanes, where the brief's "two flat plates" asked for two — a plate has
//     no axle hole at its middle, and a beam's end holes carry the cam;
//   · the CAM is four pins (3673) in those beams' end holes, two pointing
//     back from the front beam and two forward from the back one, their
//     shafts meeting in the tail's band: four lobes, the steel's
//     ALARM_CAM_LOBES;
//   · the HAMMER is two thin liftarms (6632) keyed on one pivot axle, its tail
//     riding the cam's pins, its head striking a tile (3070b) on a stack of
//     plates: no LEGO part rings;
//   · §288, the PUSHER: a cross axle sliding in the round holes of two Technic
//     bricks (6541) turned a quarter round, so their holes run across the
//     frame; a round half bush (32123a) on its tip presses a second half bush
//     on a 2L axle in the driver's free end hole, a third is its collar, and a
//     bush (3713) on its outer end is the button a finger presses.
export const ALARM_PARTS = Object.freeze({
  rotor: '2712', wheel: '69778', pawl: '3647', arm: '6632', lever: '11478', follower: '32123a',
  pin: '3673', longPin: '6558', beam: '7229',
  spur8: '3647', spur16: '4019', spur24: '3648', tile: '3070b', button: '3713',
});

// MEASURED (held by probe-technic-alarm.mjs against the vendored parts, to
// 1e-4 mm). LDU in the comments; mm in the values.
export const ALARM_DIM_MM = Object.freeze({
  rotorTip: 20.0008,        // 2712: each blade's farthest surface, its round end 50 LDU out
  rotorBody: 3.2,           // 2712: the body, 8 LDU, a plate
  rotorStud: 1.6,           // 2712: a stud on one face over each blade, 4 LDU
  pinR: 2.4,                // 3673, 6558: the shaft, 6 LDU
  pinLipR: 2.6,             // 3673, 6558: the lip over each tip's last 2 LDU, 6.5 LDU
  pinCollarR: 3.2,          // 3673, 6558: the collar, 8 LDU
  pinCollarHalf: 0.8,       // 3673: the collar spans ±2 LDU about the pin's middle
  pinHalf: 8,               // 3673: each half 20 LDU from the collar's middle
  longPinShort: 7.2,        // 6558: its short side 18 LDU from the collar's face
  longPinLong: 15.2,        // 6558: its long side 38 LDU from the collar's other face
  beamHoles: 8,             // 7229: its end holes 20 LDU either side of the centre axle hole
  beamHalfWidth: 3.6,       // 7229: ±9 LDU across, a capsule about its end holes
  beamThick: 8,             // 7229: 20 LDU along its holes
  leverHoles: 16,           // 11478: its end holes ±40 LDU from its middle (axle holes), round holes between at 20 LDU steps
  leverHalfWidth: 3.6,      // 11478, 6632: ±9 LDU across, a capsule about the end holes
  armThick: 4,              // 6632, 11478: 10 LDU thick
  armMid: 8,                // 6632: its round middle hole 20 LDU from each end hole
  tileH: 3.2,               // 3070b: 8 LDU, a flat top
  gearWidth: 8,             // 3647, 4019, 69778: 20 LDU
  spur24Width: 7.7,         // 3648: 19.25 LDU (GEAR_WIDTH_MM)
});
const A = ALARM_DIM_MM;

// ── THE PLANE ───────────────────────────────────────────────────────────────
// Every planar law below works in (u, v) = LDraw (X, Y) in mm — u = x, v = −z,
// so "up" is −v — the plane the fusee's pawls work in (landing H), so an angle
// counter-clockwise in (u, v) is LDraw's rotZ and a body turned by it is placed
// with rotZ(angle) directly.
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy;
  const t = ll ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / ll)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segsCross = (a, b, c, d) => cross2(a, b, c) * cross2(a, b, d) < 0 && cross2(c, d, a) * cross2(c, d, b) < 0;
export const segSegDist = (a, b, c, d) => (segsCross(a, b, c, d) ? 0 : Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b)));
// A segment against an axis-aligned rectangle [u0, u1] × [v0, v1] (a brick's
// section): 0 when they meet, else the least distance.
export function segRectDist(a, b, [u0, u1, v0, v1]) {
  const inside = (p) => p[0] >= u0 && p[0] <= u1 && p[1] >= v0 && p[1] <= v1;
  if (inside(a) || inside(b)) return 0;
  const c = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  let d = Infinity;
  for (let i = 0; i < 4; i++) d = Math.min(d, segSegDist(a, b, c[i], c[(i + 1) % 4]));
  return d;
}
const at = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];

// A part's OUTLINE about an axis, as a star profile: its outer radius per angle
// in 0.1° bins, off its sampled surface, after a base rotation M (3×3, LDraw)
// that stands the part's own axis along LDraw Z — so the angle is the (u, v)
// plane's. `band` keeps only the surface whose LDraw Z (mm) lies in it: the
// slab another part works in. Empty bins take the larger neighbour (a star
// profile, as starProfile builds one).
export const BINS = 3600;
const profCache = new Map();
export function profileOf(lib, part, M = [1, 0, 0, 0, 1, 0, 0, 0, 1], band = null) {
  const key = `${part}|${M.join(',')}|${band ? band.join(',') : ''}`;
  if (profCache.has(key)) return profCache.get(key);
  const r = new Float64Array(BINS);
  for (const [x, y, z] of surfaceSamples(lib, part, 0.25)) {
    const X = (M[0] * x + M[1] * y + M[2] * z) * LDU_MM, Y = (M[3] * x + M[4] * y + M[5] * z) * LDU_MM, Z = (M[6] * x + M[7] * y + M[8] * z) * LDU_MM;
    if (band && (Z < band[0] - 1e-9 || Z > band[1] + 1e-9)) continue;
    const k = Math.floor(mod(Math.atan2(Y, X) / TAU, 1) * BINS) % BINS;
    r[k] = Math.max(r[k], Math.hypot(X, Y));
  }
  for (let i = 0; i < BINS; i++) if (!r[i]) {
    let a = 1, b = 1;
    while (a < BINS && !r[(i - a + BINS) % BINS]) a++;
    while (b < BINS && !r[(i + b) % BINS]) b++;
    r[i] = Math.max(r[(i - a + BINS) % BINS], r[(i + b) % BINS]);
  }
  let tip = 0; for (const v of r) tip = Math.max(tip, v);
  const out = { r, tip };
  profCache.set(key, out);
  return out;
}
export const unionProfile = (...ps) => {
  const r = new Float64Array(BINS);
  for (let i = 0; i < BINS; i++) r[i] = Math.max(...ps.map((p) => p.r[i]));
  return { r, tip: Math.max(...ps.map((p) => p.tip)) };
};
export const rAt = (P, phi) => { const t = mod(phi / TAU, 1) * BINS, i = Math.floor(t) % BINS, f = t - Math.floor(t); return P.r[i] * (1 - f) + P.r[(i + 1) % BINS] * f; };
// The least distance from a point to a profile body (centre c, turned by a):
// negative inside it (the radial depth), else the least distance to its
// boundary — every bin's point, so a narrow tip is not missed between samples.
export function profileGap(P, c, a, p, reach = 8) {
  const dx = p[0] - c[0], dy = p[1] - c[1], d = Math.hypot(dx, dy);
  const depth = rAt(P, Math.atan2(dy, dx) - a) - d;
  if (depth > 0) return -depth;
  if (d - P.tip > reach) return d - P.tip;
  let best = Infinity;
  for (let i = 0; i < BINS; i++) {
    const r = P.r[i], phi = i / BINS * TAU + a;
    const q = Math.hypot(c[0] + r * Math.cos(phi) - p[0], c[1] + r * Math.sin(phi) - p[1]);
    if (q < best) best = q;
  }
  return best;
}

// THE PLACEMENTS' BASE ROTATIONS (LDraw 3×3, row-major). Each stands a part's
// own axis along LDraw Z (the frame's y), so its outline is in (u, v):
//   · gears and the bushes: their axis IS their Z (identity);
//   · the rotor and the thick beam: their axis is their own Y, turned onto Z
//     (Y_TO_Z, a proper rotation: X stays, Y → Z, Z → −Y);
//   · the rotor TURNED OVER: the same, then a half turn about X (Y_TO_Z_FLIP,
//     X stays, Y → −Z, Z → Y) — still a rotation (det +1), so the part is
//     turned over, never mirrored;
//   · a pin and an axle pin: their axis is their own X (X_TO_Z, as an axle).
export const I3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export const Y_TO_Z = Object.freeze([1, 0, 0, 0, 0, -1, 0, 1, 0]);
export const Y_TO_Z_FLIP = Object.freeze([1, 0, 0, 0, 0, 1, 0, -1, 0]);
export const X_TO_Z = Object.freeze([0, 0, -1, 0, 1, 0, 1, 0, 0]);
export const mul3 = (P, Q) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => P[i * 3] * Q[j] + P[i * 3 + 1] * Q[3 + j] + P[i * 3 + 2] * Q[6 + j]));
export const rz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];

// ── THE COLUMN WHEEL'S OUTLINE ───────────────────────────────────────────────
// The two rotors as placed: rotor A (behind, next to the release lever) on
// Y_TO_Z — its studs face forward, toward rotor B — and rotor B on
// Y_TO_Z_FLIP, its studs facing back toward A. Each set of studs stands over
// its own blades, so it meets the other rotor only in that rotor's gaps: the
// two bodies stand a stud's height apart (plus the CLEAR floor) and nothing
// touches. Both on the SAME quarter turn of the axle: a quarter turn of one
// alone would put its blades 90° round, and the six would not be even.
export function columnWheelProfile(lib) {
  return unionProfile(profileOf(lib, ALARM_PARTS.rotor, Y_TO_Z), profileOf(lib, ALARM_PARTS.rotor, Y_TO_Z_FLIP));
}
// Where the columns stand (their centres, in the wheel's own frame at θ = 0):
// the profile's local maxima at the tip radius.
export function columnAngles(P) {
  const out = [];
  for (let i = 0; i < BINS; i++) {
    const a = P.r[(i - 1 + BINS) % BINS], b = P.r[i], c = P.r[(i + 1) % BINS];
    if (b > P.tip - 0.05 && b >= a && b > c) out.push((i + 0.5) / BINS * TAU);
  }
  // a flat tip spans several bins: merge runs within 5°
  const merged = [];
  for (const a of out) if (!merged.length || a - merged[merged.length - 1].last > deg(5)) merged.push({ first: a, last: a }); else merged[merged.length - 1].last = a;
  if (merged.length > 1 && merged[0].first + TAU - merged[merged.length - 1].last < deg(5)) { merged[0].first = merged.pop().first - TAU; }
  return merged.map((m) => mod((m.first + m.last) / 2, TAU)).sort((a, b) => a - b);
}

// ── THE COLUMN WHEEL'S INDEX: THE DETENT, THE PAWL, THE DRIVER ───────────────
// All in the column wheel's plane about its axis (the origin here; the build
// adds W). The 12T is the one wheel both members work: the PAWL pushes it a
// tooth, the DETENT holds it at each of its twelve rests.
//
// THE DETENT (the steel's sautoir): a round half bush on a thin liftarm, its
// pivot at `pivot`, banded in `sense` onto the 12T — landing F's follower, on
// landing H's pawl law (`pawlModel` with the bush as its follower). Its RESTS
// are where the bush stands nearest the wheel's axis (the notch's bottom), its
// CRESTS where it stands farthest (a tooth's tip): a turn of the wheel short of
// the crest falls back to the rest it left, past it on to the next.
export const DETENT_ARM = KEYLESS_PULL_DIM_MM.armHoles;   // 6632: the bush 16 mm from the pivot, at the arm's far end hole
export const detentSpec = (pivot, sense) => ({ wheel: ALARM_PARTS.wheel, pivot, arm: DETENT_ARM, sense, R: KEYLESS_PULL_DIM_MM.followerR });
// A gear's OUTLINE in its plane: its star profile (starProfile, the 0.1°
// bins landing H's pawls read) as points, kept within `band` mm of its tip —
// all a follower can reach — as (radius, angle), so a turn is a sum. A gear is
// star-shaped about its axis, so its profile IS its outline.
const outlineCache = new Map();
export function wheelOutline(lib, part, band = 4) {
  const key = `${part}|${band}`;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const P = starProfile(lib, part), out = [];
  for (let i = 0; i < BINS; i++) if (P.r[i] >= P.tip - band) out.push([P.r[i], (i + 0.5) / BINS * TAU]);
  const o = { pts: out, tip: P.tip };
  outlineCache.set(key, o);
  return o;
}
// A ROUND FOLLOWER (the half bush: its section a circle of radius R) on an arm
// of length `arm` about `pivot`, banded in `sense` onto the wheel at the origin
// turned θ. From where it stands straight out from the wheel it turns until its
// circle first touches the outline: for each outline point q the arm angles at
// which the circle passes through q solve |pivot + arm·e(ψ) − q| = R in closed
// form, and the seat is the first of them in the band's sense. Returns the
// arm's angle, or null if it never touches.
export function followerModel(lib, { wheel, pivot, arm, sense, R }) {
  const O = wheelOutline(lib, wheel);
  const atPsi = (psi) => [pivot[0] + arm * Math.cos(psi), pivot[1] + arm * Math.sin(psi)];
  const far = Math.atan2(pivot[1], pivot[0]);
  const seat = (theta) => {
    let best = Infinity;
    for (const [r, a] of O.pts) {
      const qx = r * Math.cos(a + theta) - pivot[0], qy = r * Math.sin(a + theta) - pivot[1], d = Math.hypot(qx, qy);
      const c = (arm * arm + d * d - R * R) / (2 * arm * d);
      if (c > 1 || c < -1) continue;
      const al = Math.atan2(qy, qx), w = Math.acos(c);
      for (const psi of [al - w, al + w]) { const off = mod(sense * (psi - far), TAU); if (off < best) best = off; }
    }
    return best === Infinity ? null : far + sense * best;
  };
  const dist = (theta) => { const p = seat(theta); return p === null ? Infinity : Math.hypot(...atPsi(p)); };
  const gapAt = (c, theta) => {
    let best = Infinity;
    for (const [r, a] of O.pts) { const d = Math.hypot(c[0] - r * Math.cos(a + theta), c[1] - r * Math.sin(a + theta)); if (d < best) best = d; }
    return best - R;
  };
  return { at: atPsi, gapAt, seat, dist, outline: O };
}
// The rest and crest within a pitch either side of θ0, each refined by a golden
// search on the follower's distance from the axis: the REST nearest θ0 (a
// minimum deeper than halfway from the lowest to the highest — riding a tip it
// stands on a plateau whose ripples are minima too) and the CREST either side
// that bounds its basin: the FIRST maximum met walking out from the rest, not the
// highest in the pitch. The 12T's tip is not round under the bush: measured, the
// bush rides over TWO peaks of one height (0.532 mm, at +14.2° and +18.7° from a
// rest) with a saddle 0.006 mm deep between them, so "the highest" is a coin
// toss between the two, and was, rest by rest. The FAR crests (`farPlus`,
// `farMinus`) bound the neighbouring basins, a pitch on less the near crest the
// other side; between a near and a far crest the wheel stands ON THE TIP, in
// that saddle, at neither rest. The FLANKS are the mean slope (mm per degree) of
// the follower's rise from the rest to each crest: within 30% of each other it
// is a DETENT (landing F's rule); apart, a ratchet.
const golden = (fn, a, b) => { for (let i = 0; i < 40; i++) { const m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618; if (fn(m1) < fn(m2)) b = m2; else a = m1; } return (a + b) / 2; };
export function detentRests(lib, spec, theta0 = 0, teeth = 12) {
  const pitch = TAU / teeth, m = followerModel(lib, spec), n = 120;
  const ts = [], ds = [];
  for (let i = 0; i <= n; i++) { const t = theta0 - pitch + 2 * pitch * i / n; ts.push(t); ds.push(m.dist(t)); }
  if (ds.some((v) => !Number.isFinite(v))) return null;
  const lo = Math.min(...ds), hi = Math.max(...ds), deep = (lo + hi) / 2;
  let k = -1;
  for (let i = 1; i < n; i++) if (ds[i] <= ds[i - 1] && ds[i] <= ds[i + 1] && ds[i] < deep && (k < 0 || Math.abs(ts[i] - theta0) < Math.abs(ts[k] - theta0))) k = i;
  if (k < 0) return null;
  const h = ts[1] - ts[0], rest = golden(m.dist, ts[k] - h, ts[k] + h);
  const crest = (dir) => {
    const step = pitch / 240;
    let prev = m.dist(rest), i = 1;
    for (; i <= 240; i++) { const v = m.dist(rest + dir * step * i); if (v < prev) break; prev = v; }
    const t = rest + dir * step * (i - 1);
    return golden((x) => -m.dist(x), t - step, t + step);
  };
  const cPlus = crest(1), cMinus = crest(-1), dRest = m.dist(rest);
  const slope = (c) => (m.dist(c) - dRest) / (Math.abs(c - rest) * 180 / Math.PI);
  const flanks = [slope(cMinus), slope(cPlus)];
  return { rest, crestPlus: cPlus, crestMinus: cMinus, farPlus: rest + pitch - (rest - cMinus), farMinus: rest - pitch + (cPlus - rest), lift: Math.min(m.dist(cPlus), m.dist(cMinus)) - dRest, dRest, flanks,
    symmetric: Math.abs(flanks[0] - flanks[1]) <= 0.3 * Math.max(...flanks), psi: m.seat(rest) };
}
// WHERE A TURN OF THE WHEEL SETTLES: released at θ, the band carries the bush
// down the slope it stands on, so the wheel ends at the rest of the BASIN θ lies
// in — the rest whose two near crests bracket it. Short of the near crest it is
// the rest the press left; past the far crest, the next; between them the wheel
// stands on the tooth's tip, at no rest, and this answers null.
// `restsNear` is where the rests come from: by default detentRests read fresh
// at θ (the rest nearest it), and §283's animated press passes the same rests
// read once and kept (columnModel), so the one law answers both.
export function detentSettle(lib, spec, theta, teeth = 12, restsNear = (t) => detentRests(lib, spec, t, teeth)) {
  const r = restsNear(theta);
  if (!r) return null;
  if (theta >= r.crestMinus && theta <= r.crestPlus) return r.rest;
  const n = restsNear(r.rest + (theta > r.crestPlus ? 1 : -1) * TAU / teeth);
  return n && theta >= n.crestMinus && theta <= n.crestPlus ? n.rest : null;
}

// THE PAWL rides on the DRIVER: a thin liftarm idling on the column wheel's
// axle by its round middle hole, its end holes DRIVER_ARM either side. One end
// carries the pawl's pivot (an axle keyed in its axle hole); the other end is
// the PUSHER's (since §288 a half bush on a 2L there, which a rod presses: THE
// PUSHER, below). The pawl is landing H's click: a thin
// liftarm pivoting on its round middle hole, its 8T keyed at an end hole
// PAWL_ARM on, in the 12T's slab. The 8T must stand the 8:12 mesh, 10 mm, from
// the axis, so the driver's arm, the pawl's arm and 10 make a triangle, and
// pawlLock reads which of the catalogue's arms LOCKS (landing H's rule: one way
// over ten times as steep as the other). Measured on the 12T: 8 and 8 (two
// 6632s, the triangle 8, 8, 10) rides BOTH ways (steepest rates 9.6 and 5.2);
// 16 and 16 rides both ways; 8 and 16 locks (99.4 against 0.7), but its 16 mm
// pawl folds back across the column wheel's own axle (the build measured its
// side 0.04 mm off it); 16 and 8 locks too (122.7 against 1.0), its short pawl
// standing clear. So the driver is a 5L thin liftarm (11478) idling by its
// round middle hole, and the pawl a 6632 on its round middle hole, its 8T at an
// end hole 8 mm on.
export const DRIVER_ARM = 16, PAWL_ARM = 8;
export const pawlSpecOn = (sense) => ({ wheel: ALARM_PARTS.wheel, pivot: [DRIVER_ARM, 0], arm: PAWL_ARM, sense, part: ALARM_PARTS.pawl });


// ── THE LAYERS (frame y, mm, along every axle; forward is −y) ───────────────
// One band carries the three readings: the RELEASE LEVER's, [0, 4]. In it the
// lever's flat side meets the disc's pins and its far end meets the fly; a pin
// in its middle hole reaches FORWARD into the column wheel's rotors. So the
// column wheel's works stand in front of the band, the release disc's and the
// striking train's behind it, and no axle but the fly's crosses it. Between
// parts that turn apart the gap is AX_CLEAR, one LDU — the CLEAR test's own
// floor (landing H's convention); parts of one body touch.
//   · the beak (3673): its collar's back face on the lever's front face, so its
//     front half reaches 8.8 forward and its back half 3.2 behind the lever;
//   · rotor A: its back face AX_CLEAR in front of the collar, its studs facing
//     forward; rotor B (turned over) a stud's height and AX_CLEAR in front of
//     A, its studs facing back into A's gaps, A's into B's;
//   · the follower's arm, then the 12T (the follower bush in its back half, the
//     pawl's 8T across its width), the pawl's arm, the driver;
//   · behind: the disc's front beam, its pins' collars on its front face — set
//     so their LIPS stand in front of the band (−1.2..−0.4), and the band meets
//     their shafts; its back beam touching it (one body), the long pin's collar
//     on that beam's front face, its lip in front of the band likewise; then the
//     disc's 24T. The fly's beam at the band, its pins' collars on its back
//     face; the cam's second beam behind them, its pins' collars on its front
//     face, their tips AX_CLEAR behind the band; the hammer's tail between the
//     beams, where both sets of collars reach (so all four lobes present the
//     same radius); its head in front of the tail; the trains' meshes behind.
export const AX_CLEAR = 0.4;
export const ALARM_Y = (() => {
  const Y = {}, g = AX_CLEAR, t = A.armThick, w = A.gearWidth, ch = A.pinCollarHalf;
  Y.lever = [0, t];
  Y.beakMid = -ch;                                                   // the beak pin's middle
  Y.rotorA = [Y.beakMid - ch - g - A.rotorBody, Y.beakMid - ch - g];
  Y.rotorB = [Y.rotorA[0] - A.rotorStud - g - A.rotorBody, Y.rotorA[0] - A.rotorStud - g];
  Y.followerArm = [Y.rotorB[0] - g - t, Y.rotorB[0] - g];
  Y.wheel = [Y.followerArm[0] - g - w, Y.followerArm[0] - g];
  Y.follower = [Y.wheel[1] - 2 * KEYLESS_PULL_DIM_MM.followerHalfWidth, Y.wheel[1]];
  Y.pawlArm = [Y.wheel[0] - g - t, Y.wheel[0] - g];
  Y.driver = [Y.pawlArm[0] - g - t, Y.pawlArm[0] - g];
  // the disc: a 3673's tip is its middle − pinHalf; its lip is the last 0.8
  const tip = -3 * g;                                                // the lip's back edge AX_CLEAR in front of the band
  Y.discPinMid = tip + A.pinHalf;
  Y.discFront = [Y.discPinMid + ch, Y.discPinMid + ch + A.beamThick];
  Y.discBack = [Y.discFront[1], Y.discFront[1] + A.beamThick];
  Y.discLongCollar = [Y.discBack[0] - 2 * ch, Y.discBack[0]];        // 6558: its long side reaches longPinLong forward of the collar
  Y.disc24 = [Y.discBack[1] + g, Y.discBack[1] + g + A.spur24Width];
  // the fly, the cam's pins, the hammer
  Y.fly = [0, A.beamThick];
  Y.flyPinMid = Y.fly[1] + ch;
  Y.cam2 = [Y.lever[1] + g + A.pinHalf + ch, Y.lever[1] + g + A.pinHalf + ch + A.beamThick];
  Y.cam2PinMid = Y.cam2[0] - ch;
  Y.tail = [Y.fly[1] + g, Y.fly[1] + g + t];
  Y.head = [Y.tail[0] - g - t, Y.tail[0] - g];
  // the trains
  Y.flyPinion = [Y.cam2[1] + g, Y.cam2[1] + g + w];                  // the fly arbor's 8T
  Y.strikeMid = [Y.flyPinion[1] + g, Y.flyPinion[1] + g + w];        // the middle arbor's 8T and the barrel's 16T
  Y.trainA = [Y.disc24[0], Y.disc24[0] + w];                         // the 12:1's last stage (8T into the disc's 24T)
  Y.trainB = [Y.trainA[1] + g, Y.trainA[1] + g + w];
  Y.trainC = [Y.trainB[1] + g, Y.trainB[1] + g + w];
  for (const k of Object.keys(Y)) Y[k] = Array.isArray(Y[k]) ? Object.freeze(Y[k].map(r6)) : r6(Y[k]);
  return Object.freeze(Y);
})();
const Yp = ALARM_Y;

// THE RADIUS A PIN PRESENTS to a member working in a band: the pin's sampled
// surface, set along y with its own X running `dir` from yRef at its own xRef
// (LDU), the farthest point from its axis among those in the band. A pin is a
// shaft with a collar and two lips: which of them a band meets is the layer's
// question, so it is read, not assumed.
export function pinRadiusIn(lib, part, { yRef, xRef = 0, dir = 1 }, band) {
  let r = 0;
  for (const [x, y, z] of surfaceSamples(lib, part, 0.25)) {
    const yy = yRef + dir * (x - xRef) * LDU_MM;
    if (yy >= band[0] - 1e-9 && yy <= band[1] + 1e-9) r = Math.max(r, Math.hypot(y, z) * LDU_MM);
  }
  return r;
}
// The pins' places along y, as pinRadiusIn reads them. A 3673's middle is its
// own x 0; a 6558's collar spans its x −12..−8 LDU, its short side −30..−12
// (in the back beam), its long side −8..30 (forward).
export const PIN_PLACES = Object.freeze({
  disc: Object.freeze({ part: ALARM_PARTS.pin, yRef: Yp.discPinMid, xRef: 0, dir: -1 }),
  long: Object.freeze({ part: ALARM_PARTS.longPin, yRef: Yp.discLongCollar[0], xRef: -8, dir: -1 }),
  beak: Object.freeze({ part: ALARM_PARTS.pin, yRef: Yp.beakMid, xRef: 0, dir: -1 }),
  fly: Object.freeze({ part: ALARM_PARTS.pin, yRef: Yp.flyPinMid, xRef: 0, dir: 1 }),
  cam2: Object.freeze({ part: ALARM_PARTS.pin, yRef: Yp.cam2PinMid, xRef: 0, dir: -1 }),
});
export const pinR = (lib, place, band) => pinRadiusIn(lib, PIN_PLACES[place].part, PIN_PLACES[place], band);

// ── THE RELEASE: A RING OF PINS, ONE PLACE EMPTY ─────────────────────────────
// Two thick beams (7229) keyed on the disc's axle at 90° to each other, their
// end holes beamHoles out: the front beam carries a pin (3673) in each end
// hole, the back beam a long pin (6558) in ONE end hole, reaching past the front
// beam's side into the lever's band. So at disc angle θ the pins stand at θ,
// θ + 90° and θ + 180°, and θ + 270° is the NOTCH: there is no pin there.
export const releasePins = (geo, theta) => [
  { c: at(geo.D, A.beamHoles, theta), r: geo.rDisc },
  { c: at(geo.D, A.beamHoles, theta + Math.PI / 2), r: geo.rLong },
  { c: at(geo.D, A.beamHoles, theta + Math.PI), r: geo.rDisc },
];

// ── THE RELEASE LEVER ────────────────────────────────────────────────────────
// A 5L thin liftarm keyed by one end hole on the lever axle at L; at angle ψ its
// centreline runs from L to its far end hole 2·leverHoles out, a capsule of
// leverHalfWidth. The BEAK is a pin (3673) in its middle round hole, leverHoles
// out, reaching forward into the rotors: rotor A meets the radius the pin
// presents in A's band, rotor B the radius in B's. A band turns the lever in
// `sense` (posed); it comes to rest on the FIRST of its supports it meets: the
// disc's pins (the rim), or — through the beak — a column.
export const leverSeg = (Lp, psi) => [Lp, at(Lp, 2 * A.leverHoles, psi)];
export const beakAt = (Lp, psi) => at(Lp, A.leverHoles, psi);
export function beakGap(geo, psi, thetaW) {
  const b = beakAt(geo.L, psi);
  return Math.min(profileGap(geo.colA, geo.W, thetaW, b) - geo.rBeakA, profileGap(geo.colB, geo.W, thetaW, b) - geo.rBeakB);
}
export function leverGaps(geo, psi, { theta = 0, thetaW = null } = {}) {
  const [a, b] = leverSeg(geo.L, psi), R = A.leverHalfWidth;
  const out = { pins: Math.min(...releasePins(geo, theta).map((p) => segDist(p.c, a, b) - R - p.r)) };
  if (thetaW !== null) out.beak = beakGap(geo, psi, thetaW);
  return out;
}
// THE LEVER'S REST: from `from` (clear of everything, against its band; by
// default 45° up) turned in `sense` until the first support touches — a step of
// a quarter degree to find it, then a bisection. Returns the angle and which
// support holds it.
export function leverRest(geo, { theta = 0, thetaW = null, from = null } = {}) {
  const s = geo.sense, start = from ?? -s * deg(45);
  const touch = (psi) => { const g = leverGaps(geo, psi, { theta, thetaW }); return Object.keys(g).filter((k) => g[k] <= 0); };
  if (touch(start).length) return { psi: start, by: touch(start), stuck: true };
  let prev = start;
  for (let k = 1; k <= 720; k++) {
    const p = start + s * deg(0.25 * k);
    if (touch(p).length) {
      let lo = prev, hi = p;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (touch(m).length) hi = m; else lo = m; }
      return { psi: lo, by: touch(hi) };
    }
    prev = p;
  }
  return null;
}
// THE RELEASE'S STATES, over a turn of the disc (a degree at a time): the lever
// on the pins at each θ. The NOTCH is where the lever drops furthest (the empty
// place under it); the RIM is every θ a quarter turn or more from there (the
// empty place away round the ring). rimUp and rimDown bound the lever on the
// rim; the drop is from rimDown to the notch.
export function releaseStates(geo) {
  const pts = [];
  for (let i = 0; i < 360; i++) { const r = leverRest(geo, { theta: deg(i) }); pts.push({ th: deg(i), psi: r ? r.psi : NaN }); }
  if (pts.some((p) => !Number.isFinite(p.psi))) return null;
  const down = (p) => geo.sense * p.psi;
  const n = pts.reduce((b, p) => (down(p) > down(b) ? p : b));
  const rim = pts.filter((p) => Math.abs(mod(p.th - n.th + Math.PI, TAU) - Math.PI) >= Math.PI / 2 - 1e-9);
  const rimD = rim.map(down);
  return { pts, thetaNotch: n.th, psiNotch: n.psi, rimUp: geo.sense * Math.min(...rimD), rimDown: geo.sense * Math.max(...rimD),
    margin: down(n) - Math.max(...rimD), ripple: Math.max(...rimD) - Math.min(...rimD) };
}
// THE FLY'S ENGAGEMENT on the lever: the vane (a capsule through C, beamHoles
// either side, of beamHalfWidth) sweeps a disc of beamHoles + beamHalfWidth as
// it turns, so the lever stops it when its capsule reaches into that disc.
// Positive: it stops the fly by that much; negative: the fly passes it by that.
export const FLY_SWEEP = A.beamHoles + A.beamHalfWidth;
export const flyEngagement = (geo, psi) => FLY_SWEEP + A.leverHalfWidth - segDist(geo.C, ...leverSeg(geo.L, psi));
// THE LOCK'S PUSH. The fly turns in `run`; from where its vane is clear of the
// lever it turns until the vane first touches, and the contact pushes the lever
// along the normal from the vane to the lever. Its moment about the lever's
// pivot must be in the DROP sense: the lever is held against that sense by its
// supports (the pins, or a column under the beak), so the train's push is
// carried into them. A moment against the drop would lift the lever off the fly
// against nothing but its band — a lock the train opens itself.
export function lockPush(geo, psi, run) {
  const [a, b] = leverSeg(geo.L, psi), R = A.leverHalfWidth + A.beamHalfWidth;
  const vane = (phi) => [at(geo.C, -A.beamHoles, phi), at(geo.C, A.beamHoles, phi)];
  const hit = (phi) => segSegDist(...vane(phi), a, b) < R;
  let start = null;
  for (let k = 0; k < 360; k++) { if (!hit(deg(k))) { start = deg(k); break; } }
  if (start === null) return null;
  let prev = start, phiHit = null;
  for (let k = 1; k <= 720; k++) { const p = start + run * deg(0.25 * k); if (hit(p)) { phiHit = p; break; } prev = p; }
  if (phiHit === null) return { free: true };
  let lo = prev, hi = phiHit;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hit(m)) hi = m; else lo = m; }
  const [va, vb] = vane(lo);
  let best = { d: Infinity };
  for (let i = 0; i <= 400; i++) {
    const t = i / 400, q = [va[0] + (vb[0] - va[0]) * t, va[1] + (vb[1] - va[1]) * t];
    const dx = b[0] - a[0], dy = b[1] - a[1], u = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    const p = [a[0] + u * dx, a[1] + u * dy], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.d) best = { d, q, p };
  }
  const n = [(best.p[0] - best.q[0]) / best.d, (best.p[1] - best.q[1]) / best.d];
  const contact = [best.q[0] + n[0] * A.beamHalfWidth, best.q[1] + n[1] * A.beamHalfWidth];
  const moment = (contact[0] - geo.L[0]) * n[1] - (contact[1] - geo.L[1]) * n[0];
  return { phi: lo, contact, n, moment, intoSupports: Math.sign(moment) === geo.sense };
}

// ── SOLVING THE RELEASE ──────────────────────────────────────────────────────
// The plane is laid out about the lever's pivot L = (0, 0), the lever pointing
// +u at rest and its band turning it toward +v (down: v = −z). The mirror image
// is the same build. Every other axle stands on the frame's lattice relative to
// L: u on the 4 mm grid (a jumper takes the half stud), v on the plate lattice
// (3.2 mm), because every axle stands in a Technic brick on one baseplate.
export const LEVER_SENSE = 1;
// The geometry the laws read: L, D, W, C and the radii each contact presents,
// measured off the parts in their bands.
export function releaseGeometry(lib, { D, W = null, C = null, run = null }) {
  return {
    L: [0, 0], sense: LEVER_SENSE, D, W, C, run,
    rDisc: pinR(lib, 'disc', Yp.lever), rLong: pinR(lib, 'long', Yp.lever),
    rBeakA: pinR(lib, 'beak', Yp.rotorA), rBeakB: pinR(lib, 'beak', Yp.rotorB),
    colA: profileOf(lib, ALARM_PARTS.rotor, Y_TO_Z), colB: profileOf(lib, ALARM_PARTS.rotor, Y_TO_Z_FLIP),
  };
}
// A COLUMN REST and a GAP REST for the beak: the column wheel turned so a column
// (or a gap, 30° on) is centred on the line from its axis to the beak at the
// rim's lowest. The detent puts the real rests there (solveDetent).
export function beakRests(geo, rimDown) {
  const cols = columnAngles(unionProfile(geo.colA, geo.colB));
  const b = beakAt(geo.L, rimDown), toBeak = Math.atan2(b[1] - geo.W[1], b[0] - geo.W[0]);
  const column = toBeak - cols[0];
  return { cols, toBeak, column, gap: column + Math.PI / 6 };
}
// The beak's least clearance from the rotors with the lever at ψ, over every
// angle of the column wheel (half a degree at a time over a column's 60° pitch):
// what the wheel must pass when the pusher turns it under a held lever.
export function beakClearance(geo, psi) {
  let c = Infinity;
  for (let a = 0; a < 60; a += 0.5) c = Math.min(c, beakGap(geo, psi, deg(a)));
  return c;
}
export function solveRelease(lib, { dRange = [[8, 36], [3, 6]], wRange = [[-8, 40], [4, 10]], cRange = [[16, 60], [-6, 2]] } = {}) {
  const g = AX_CLEAR, lattice = (uR, kR) => { const out = []; for (let u = uR[0]; u <= uR[1]; u += 4) for (let k = kR[0]; k <= kR[1]; k++) out.push([u, r6(D.plateH * k)]); return out; };
  // THE DISC. Below the lever's far half, its pin ring (beamHoles + the pin)
  // clear of the lever axle's end (which stands in the band). Ranked by the
  // DROP NOT SPENT ON THE RIM: the notch's drop below the rim's lowest, less
  // the rim's own wander (its ripple) — a lever that wanders as far on the rim
  // as it drops in the notch cannot tell the two apart.
  const discs = [];
  for (const Dp of lattice(...dRange)) {
    if (Math.hypot(...Dp) < A.beamHoles + A.pinLipR + D.axleR + g) continue;
    const geo = releaseGeometry(lib, { D: Dp }), st = releaseStates(geo);
    if (!st) continue;
    discs.push({ D: Dp, st, score: st.margin - st.ripple });
  }
  discs.sort((a, b) => b.score - a.score);
  const disc = discs[0];
  // THE COLUMN WHEEL. Its rotors (rotorTip) clear the lever axle (which runs
  // forward through their layers); the beak clear of every column by AX_CLEAR
  // with the lever at the rim's lowest (so the pusher can turn the wheel under
  // a held lever); on a COLUMN rest the beak holds the lever before the notch
  // would; on a GAP rest the lever drops onto the disc's pins in the notch,
  // untouched by the rotors. Ranked by the least drop before the column holds.
  const wheels = [];
  for (const Wp of lattice(...wRange)) {
    if (Math.hypot(...Wp) < A.rotorTip + D.axleR + g) continue;
    const geo = releaseGeometry(lib, { D: disc.D, W: Wp }), st = disc.st;
    const clear = beakClearance(geo, st.rimDown);
    if (clear < g) continue;
    const r = beakRests(geo, st.rimDown);
    const onCol = leverRest(geo, { theta: st.thetaNotch, thetaW: r.column, from: st.rimDown });
    const inGap = leverRest(geo, { theta: st.thetaNotch, thetaW: r.gap, from: st.rimDown });
    if (!onCol || !inGap || !onCol.by.includes('beak') || inGap.by.includes('beak')) continue;
    wheels.push({ W: Wp, clear, block: onCol.psi, gapRest: inGap.psi, score: LEVER_SENSE * (onCol.psi - st.rimDown) });
  }
  wheels.sort((a, b) => a.score - b.score);
  const wheel = wheels[0];
  // THE FLY. It stops the lever at the column's hold by AX_CLEAR or more and
  // passes it at the notch by AX_CLEAR or more; the lever never reaches its
  // axle; its sweep clears the disc's pin ring (and its second beam the disc's
  // back beam, both FLY_SWEEP); the beak's back half (the pin's lip) clears it
  // at every lever angle; and the vane's push carries into the lever's
  // supports at the rim's top, its bottom and the column's hold, for the run
  // sense chosen. Ranked by the worse of its two margins (locked, free); the
  // two run senses tie on those, and the one whose push into the supports is
  // the firmer (its least moment the larger) is taken.
  const flies = [];
  const geoW = releaseGeometry(lib, { D: disc.D, W: wheel.W });
  for (const Cp of lattice(...cRange)) {
    const geo = { ...geoW, C: Cp };
    if (Math.hypot(Cp[0] - disc.D[0], Cp[1] - disc.D[1]) < 2 * FLY_SWEEP + g) continue;
    const eB = flyEngagement(geo, wheel.block), eN = flyEngagement(geo, disc.st.psiNotch), eU = flyEngagement(geo, disc.st.rimUp);
    if (!(eB >= g && eN <= -g && eU <= FLY_SWEEP + A.leverHalfWidth - (D.axleR + A.leverHalfWidth + g))) continue;
    let beakOk = true;
    for (let p = disc.st.rimUp; LEVER_SENSE * (disc.st.psiNotch - p) >= 0; p += LEVER_SENSE * deg(0.5)) { const b = beakAt(geo.L, p); if (Math.hypot(b[0] - Cp[0], b[1] - Cp[1]) < FLY_SWEEP + A.pinLipR + g) beakOk = false; }
    if (!beakOk) continue;
    for (const run of [1, -1]) {
      const pushes = [disc.st.rimUp, disc.st.rimDown, wheel.block].map((p) => lockPush(geo, p, run));
      if (!pushes.every((q) => q && q.intoSupports)) continue;
      flies.push({ C: Cp, run, eBlock: eB, eNotch: eN, eUp: eU, pushes, score: Math.min(eB, -eN) + 1e-6 * Math.min(...pushes.map((q) => LEVER_SENSE * q.moment)) });
    }
  }
  flies.sort((a, b) => b.score - a.score);
  return { discs, disc, wheels, wheel, flies, fly: flies[0] ?? null };
}

// ── SOLVING THE COLUMN WHEEL'S INDEX ─────────────────────────────────────────
// Everything here in the column wheel's own plane about W (W at the origin).
// THE DETENT'S PIVOT, searched over the lattice about W, both band senses: its
// rests must fall where a column or a gap is centred on the beak (the wheel
// steps 30°, a column pitch is 60°, so every rest alternates), and it must be a
// detent (flanks within 30%). Clear of the 12T and of the driver's sweep (its
// axle passes their layers), its arm clear of the lever axle (which passes the
// arm's layer), its pivot at a Technic brick's hole height. Ranked by how far
// its rest misses the beak's line, then by the larger lift.
export function solveDetent(lib, { W, zW, toBeakColumn, Lrel, range = [[-24, 24], [-8, 8]] }) {
  const g = AX_CLEAR, out = [];
  const tip12 = GEAR_TIP_MM[ALARM_PARTS.wheel];
  for (let pu = range[0][0]; pu <= range[0][1]; pu += 4) for (let k = range[1][0]; k <= range[1][1]; k++) {
    const pv = r6(D.plateH * k), P = [pu, pv], dP = Math.hypot(pu, pv);
    if (dP < DETENT_ARM - (tip12 + KEYLESS_PULL_DIM_MM.followerR) + 0.5 || dP > DETENT_ARM + tip12 + KEYLESS_PULL_DIM_MM.followerR - 0.5) continue;
    if (dP < DRIVER_ARM + A.leverHalfWidth + D.axleR + g) continue;          // the driver's sweep (its ends 11.6 out)
    if (zW - pv < D.plateH + D.holeZ - 1e-9) continue;                       // the lowest hole: one plate and a Technic brick
    for (const s of [1, -1]) {
      const spec = detentSpec(P, s), r = detentRests(lib, spec, toBeakColumn);
      if (!r || !r.symmetric) continue;
      const m = followerModel(lib, spec), f = m.at(r.psi);
      if (segDist(Lrel, P, f) < A.leverHalfWidth + D.axleR + g) continue;    // the arm's layer is crossed by the lever axle
      const off = Math.abs(mod(r.rest - toBeakColumn + Math.PI / 12, Math.PI / 6) - Math.PI / 12);
      out.push({ pivot: P, sense: s, rest: r, offset: off, follower: f });
    }
  }
  out.sort((a, b) => a.offset - b.offset || b.rest.lift - a.rest.lift);
  return { ranked: out, pick: out[0] ?? null };
}

// THE DRIVER'S STOPS. The driver idles on W; its band turns it back (−σ) onto
// the REST stack, and a press (§288: the pusher's rod) turns it σ onto the BANK stack.
// Each stack is 1×1 plates topped with a tile (a flat top), so its top is a
// whole number of plates over the baseplate and its middle on the 4 mm grid.
// A press must carry the wheel past the detent's FAR crest (the next rest's
// basin begins there; short of it the wheel can stall on the tooth's tip) and
// short of the next rest's near crest the same way, each by an LDU of arc at the
// pawl's mesh (10 mm out): what the plastic's play could otherwise eat (F2).
export const PRESS_MARGIN = AX_CLEAR / ((12 + 8) / 2);   // rad: one LDU at the 8:12 mesh
export function driverSeg(psi) { return [at([0, 0], -DRIVER_ARM, psi), at([0, 0], DRIVER_ARM, psi)]; }
// the angle at which the driver, turned from psi0 in `dir`, first meets a stack
export function driverStop(rect, psi0, dir) {
  const hit = (p) => segRectDist(...driverSeg(p), rect) < A.leverHalfWidth;
  if (hit(psi0)) return null;
  let prev = psi0;
  for (let k = 1; k <= 360; k++) {
    const p = psi0 + dir * deg(0.25 * k);
    if (hit(p)) { let lo = prev, hi = p; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hit(m)) hi = m; else lo = m; } return lo; }
    prev = p;
  }
  return null;
}
// A stack's section in the plane about W: u ∈ [x − 4, x + 4], v from its top
// down to the baseplate.
export const stackRect = (u, topZ, zW) => [u - D.stud / 2, u + D.stud / 2, zW - topZ, zW];
export function solveDriver(lib, { zW, pawlLocks, detent, pRel, Lrel }) {
  const g = AX_CLEAR, sigma = -pawlLocks;      // the press turns the driver against the way the pawl locks the wheel
  const pitch = TAU / 12, r = detent.rest;
  const crest = sigma > 0 ? r.crestPlus - r.rest : r.rest - r.crestMinus;          // the near crest: short of it a press falls back
  const far = sigma > 0 ? r.farPlus - r.rest : r.rest - r.farMinus;                  // the far crest: past it, the next rest
  const lo = far + PRESS_MARGIN, hi = pitch + crest - PRESS_MARGIN;
  // the pawl end at rest points along +u when σ < 0 (the push end, on the left,
  // goes down), along −u when σ > 0
  const psiRef = sigma < 0 ? 0 : Math.PI;
  const out = [];
  for (let ur = -24; ur <= 24; ur += 4) for (let nr = 1; nr <= 12; nr++) {
    const rest = stackRect(ur, nr * D.plateH, zW);
    const pRest = driverStop(rest, psiRef + sigma * deg(60), -sigma);
    if (pRest === null) continue;
    for (let ub = -24; ub <= 24; ub += 4) for (let nb = 1; nb <= 12; nb++) {
      if (Math.abs(ub - ur) < D.stud) continue;                       // two stacks, not one
      const bank = stackRect(ub, nb * D.plateH, zW);
      if (segRectDist(...driverSeg(pRest), bank) < A.leverHalfWidth + g) continue;   // the bank clear at rest
      const pBank = driverStop(bank, pRest, sigma);
      if (pBank === null) continue;
      if (segRectDist(...driverSeg(pBank), rest) < A.leverHalfWidth) continue;
      const stroke = sigma * (pBank - pRest);
      if (!(stroke > lo && stroke < hi)) continue;
      // the stacks clear the detent's axle and the lever axle (both pass the driver's slot)
      if ([pRel, Lrel].some((q) => [rest, bank].some((R) => segRectDist(q, q, R) < D.axleR + g))) continue;
      out.push({ rest: { u: ur, plates: nr }, bank: { u: ub, plates: nb }, psiRest: pRest, psiBank: pBank, stroke, window: [lo, hi],
        score: Math.abs(stroke - (lo + hi) / 2) + 1e-3 * (nr + nb) });
    }
  }
  out.sort((a, b) => a.score - b.score);
  return { sigma, crest, far, window: [lo, hi], ranked: out, pick: out[0] ?? null };
}

// ── THE PRESS, MODELLED ──────────────────────────────────────────────────────
// A press of stroke s from rest k: the pawl, seated in the 12T at rest, LOCKS
// (pawlLock says which way), so the wheel turns with the driver by σ·s; let go,
// the detent carries it down the slope it stands on (detentSettle) — to the
// next rest if it passed the crest, back to the one it left if not — while the
// driver returns on its band and the pawl rides back over the teeth (its free
// way). The beak then reads the rest it settled at: a column holds the lever
// (off), a gap lets it drop (on).
// THE INDEX, SOLVED WHOLE: the detent's candidates in their rank, each with
// the driver's stops solved for it, and the first whose pawl (seated at rest,
// and at the press's end) stands clear of the follower in the 12T's band, whose
// pawl arm clears the detent's axle (it passes the arm's layer), is the answer.
export function pawlAt(lib, pawlSense, driverPsi, wheelTheta) {
  const m = pawlModel(lib, pawlSpecOn(pawlSense)), psi = m.seat(wheelTheta - driverPsi);
  if (psi === null) return null;
  const rot = (p) => [p[0] * Math.cos(driverPsi) - p[1] * Math.sin(driverPsi), p[0] * Math.sin(driverPsi) + p[1] * Math.cos(driverPsi)];
  const pivot = rot([DRIVER_ARM, 0]), eight = rot(m.at(psi)), back = rot(at([DRIVER_ARM, 0], PAWL_ARM, psi + Math.PI));
  return { psi: psi + driverPsi, rel: psi, pivot, eight, armSeg: [back, eight] };
}
export function solveIndex(lib, { W, zW, toBeakColumn, Lrel, pawlSense, pawlLocks }) {
  const g = AX_CLEAR, det = solveDetent(lib, { W, zW, toBeakColumn, Lrel });
  const tried = [];
  for (const d of det.ranked.slice(0, 12)) {
    const drv = solveDriver(lib, { zW, pawlLocks, detent: d, pRel: d.pivot, Lrel });
    const t = { detent: d, driver: drv.pick, sigma: drv.sigma, window: drv.window };
    tried.push(t);
    if (!drv.pick) { t.why = 'no stops in the window'; continue; }
    const p0 = pawlAt(lib, pawlSense, drv.pick.psiRest, d.rest.rest), p1 = pawlAt(lib, pawlSense, drv.pick.psiBank, d.rest.rest + drv.sigma * drv.pick.stroke);
    if (!p0 || !p1) { t.why = 'the pawl does not seat'; continue; }
    const fol = d.follower, gap8 = Math.min(...[p0, p1].map((p) => Math.hypot(p.eight[0] - fol[0], p.eight[1] - fol[1]))) - GEAR_TIP_MM[ALARM_PARTS.pawl] - KEYLESS_PULL_DIM_MM.followerR;
    const gapArm = Math.min(...[p0, p1].map((p) => segDist(d.pivot, ...p.armSeg))) - A.leverHalfWidth - D.axleR;
    t.gap8 = gap8; t.gapArm = gapArm; t.pawl = [p0, p1];
    if (gap8 < g) { t.why = 'the pawl\'s 8T meets the follower'; continue; }
    if (gapArm < g) { t.why = 'the pawl\'s arm meets the detent\'s axle'; continue; }
    return { pick: t, tried, detents: det.ranked.length };
  }
  return { pick: null, tried, detents: det.ranked.length };
}
export function press(lib, { detent, sigma, wheelAt, stroke }) {
  const spec = detentSpec(detent.pivot, detent.sense);
  const pushed = wheelAt + sigma * stroke;
  return { pushed, settled: detentSettle(lib, spec, pushed) };
}

// ── THE STRIKE: A CAM OF FOUR PINS, A HAMMER, A BRICK ───────────────────────
// The fly arbor carries two thick beams at 90° (the fly's vanes, and the cam's
// carriers): the front beam's pins point back, the back beam's forward, so in
// the TAIL band between the beams four pins stand at φ + k·90° (φ the front
// beam's angle) — the steel's four lobes (main.js ALARM_CAM_LOBES), one strike
// each. The hammer is two thin liftarms keyed on one pivot axle: the TAIL in
// that band, riding the pins; the HEAD a layer in front, landing on the top of
// a stack of bricks. Its band (posed) turns it in `sense`, the head onto the
// stack and the tail into the pins' path.
export const CAM_LOBES = 4;
export const camPins = (C, phi, r) => Array.from({ length: CAM_LOBES }, (_, k) => ({ c: at(C, A.beamHoles, phi + k * TAU / CAM_LOBES), r }));
export const armSeg = (P, psi, len = KEYLESS_PULL_DIM_MM.armHoles) => [P, at(P, len, psi)];
// the hammer's angle with the cam at φ: from `from` (raised clear) turned in
// its sense until the tail meets a pin or the head meets the stack
export function hammerRest(h, phi, { from = null } = {}) {
  const s = h.sense, start = from ?? h.psiFree;
  const gaps = (psi) => {
    const t = armSeg(h.Hm, psi), hd = armSeg(h.Hm, psi + h.headOff);
    return { pin: Math.min(...camPins(h.C, phi, h.pinR).map((p) => segDist(p.c, ...t) - A.leverHalfWidth - p.r)), stk: segRectDist(...hd, h.struck) - A.leverHalfWidth };
  };
  const hit = (psi) => { const g = gaps(psi); return g.pin <= 0 || g.stk <= 0; };
  if (hit(start)) return null;
  let prev = start;
  for (let k = 1; k <= 1440; k++) {
    const p = start + s * deg(0.25 * k);
    if (hit(p)) {
      let lo = prev, hi = p;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hit(m)) hi = m; else lo = m; }
      const g = gaps(hi);
      return { psi: lo, by: g.pin <= g.stk ? 'pin' : 'stack' };
    }
    prev = p;
  }
  return null;
}
// THE STRIKE TRACE over one turn of the fly arbor in its running sense, `step`
// degrees a step, followed CONTINUOUSLY as landing H's pawls are: where a pin
// would enter the tail the hammer is lifted against its band by the least turn
// that clears it, then the band drops it back until the tail meets a pin or the
// head meets the stack. Riding a pin, the lift per step is the step times a
// slope, the same slope at any step; a pin meeting the tail END-ON is a WALL —
// the least clearing lift is a whole jump whatever the step, so its rate grows
// as the step shrinks. So the steepest lift rate is read at two steps, and a
// rate that does not hold still between them is a jam, not a strike. A FALL is
// a step in which the tail slips off a pin and the band drops the head back
// onto the stack: a discontinuity the other way, its drop the whole lift at
// either step.
// a rate read at half the step may grow by at most this before it is a wall
// (a slope's holds; a wall's doubles)
export const RATE_HOLD = 1.5;
export function strikeTrace(h, run, { step = 0.25, from = 0, turns = 1 } = {}) {
  const s = h.sense, hstep = deg(step), dpsi = 2e-4;
  const pinGap = (psi, phi) => Math.min(...camPins(h.C, phi, h.pinR).map((p) => segDist(p.c, ...armSeg(h.Hm, psi)) - A.leverHalfWidth - p.r));
  const stkGap = (psi) => segRectDist(...armSeg(h.Hm, psi + h.headOff), h.struck) - A.leverHalfWidth;
  let psi = h.psiRest, phi = from, rate = 0, jam = false;
  const pts = [{ phi, psi }], falls = [];
  const n = Math.round(360 * turns / step);
  const lift = (q) => s * (h.psiRest - q);
  for (let i = 1; i <= n; i++) {
    phi = from + run * hstep * i;
    let up = 0;
    while (pinGap(psi, phi) < 0 && up < 0.6) { psi -= s * dpsi; up += dpsi; }
    if (up >= 0.6) { jam = true; break; }
    rate = Math.max(rate, up / hstep);
    const before = lift(psi);
    let down = 0;
    while (pinGap(psi + s * dpsi, phi) >= 0 && stkGap(psi + s * dpsi) >= 0 && down < TAU) { psi += s * dpsi; down += dpsi; }
    pts.push({ phi, psi });
    if (down > deg(1) && lift(psi) < deg(0.05)) falls.push({ phi, from: before, drop: down });
  }
  return { pts, falls, rate, jam, maxLift: Math.max(...pts.map((p) => lift(p.psi))) };
}
// THE HAMMER, SOLVED: its pivot over the lattice about C (its axle passes the
// fly's layer, so it stands outside the fly's sweep; its tail must reach the
// pins), both band senses, the head keyed a quarter, a half or three quarters
// round from the tail, and the stack it lands on — a 1×1 column whose top is a
// whole number of plates over the baseplate, its middle on the 4 mm grid. At
// rest the head lies on the stack and the tail stands AX_CLEAR clear of every
// pin with the train LOCKED (the fly on the lever, at each lever angle the lock
// can hold at), so a locked alarm holds the hammer still; over a turn of the fly arbor the tail must be lifted and FALL
// four times, each fall landing on the stack. Ranked by the head's lift (the
// blow), then the shortest stack.
export function solveHammer(lib, { C, run, zC, phiLocks, range = [[8, 32], [-8, 8]] }) {
  const g = AX_CLEAR, out = [];
  const pinRad = Math.max(pinR(lib, 'fly', Yp.tail), pinR(lib, 'cam2', Yp.tail));
  const arm = KEYLESS_PULL_DIM_MM.armHoles, w = A.leverHalfWidth;
  for (let hu = range[0][0]; hu <= range[0][1]; hu += 4) for (let k = range[1][0]; k <= range[1][1]; k++) {
    const hv = r6(D.plateH * k), Hm = [C[0] + hu, C[1] + hv], d = Math.hypot(hu, hv);
    if (d < FLY_SWEEP + D.axleR + g) continue;                                   // its axle passes the fly's layer
    if (d > arm + w + A.beamHoles + pinRad - 1) continue;                         // the tail reaches the pins
    if (zC - hv < D.plateH + D.holeZ - 1e-9) continue;
    for (const sense of [1, -1]) for (const kHead of [1, 2, 3]) {
      const headOff = kHead * Math.PI / 2, up = -Math.PI / 2 - headOff;           // the head pointing straight up
      for (let su = -24; su <= 24; su += 4) for (let n = 1; n <= 24; n++) {
        const struck = [Hm[0] + su - D.stud / 2, Hm[0] + su + D.stud / 2, zC - n * D.plateH + C[1], 1e9];
        // the rest: from straight up, turned in the band's sense onto the stack
        const hitS = (psi) => segRectDist(...armSeg(Hm, psi + headOff), struck) < w;
        let prev = up, rest = null;
        for (let i = 1; i <= 720; i++) {
          const p = up + sense * deg(0.5 * i);
          if (hitS(p)) { let lo = prev, hi = p; for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2; if (hitS(m)) hi = m; else lo = m; } rest = lo; break; }
          prev = p;
        }
        if (rest === null) continue;
        const tail0 = armSeg(Hm, rest), head0 = armSeg(Hm, rest + headOff);
        if (segDist(C, ...head0) < FLY_SWEEP + w + g) continue;                    // the head stays out of the fly's sweep
        if (segDist(C, ...tail0) < D.axleR + w + g) continue;                      // the tail never reaches the fly's axle
        const lockGap = Math.min(...phiLocks.flatMap((ph) => camPins(C, ph, pinRad).map((p) => segDist(p.c, ...tail0) - w - p.r)));
        if (lockGap < g) continue;
        // the pins' circle must pass into the tail, or nothing lifts it
        let reachIn = Infinity;
        for (let i = 0; i < 360; i++) reachIn = Math.min(reachIn, segDist(at(C, A.beamHoles, deg(i)), ...tail0) - w - pinRad);
        if (reachIn > -g) continue;
        const h = { C, Hm, sense, headOff, struck, pinR: pinRad, psiFree: up, psiRest: rest };
        const tr = strikeTrace(h, run, { step: 1, from: phiLocks[0] });
        if (tr.jam || tr.falls.length !== CAM_LOBES) continue;
        const tr2 = strikeTrace(h, run, { step: 0.5, from: phiLocks[0] });
        if (tr2.jam || tr2.falls.length !== CAM_LOBES || tr2.rate > RATE_HOLD * tr.rate) continue;
        out.push({ Hm, hu, hv, sense, kHead, struck: { u: su, plates: n }, psiRest: rest, lockGap, reachIn, falls: tr.falls, maxLift: tr.maxLift, rate: [tr.rate, tr2.rate], h,
          headLift: 2 * arm * Math.sin(tr.maxLift / 2) });
      }
    }
  }
  out.sort((a, b) => b.headLift - a.headLift || a.struck.plates - b.struck.plates);
  return { ranked: out, pick: out[0] ?? null, pinRad };
}

// ── THE DESIGN, SOLVED WHOLE ─────────────────────────────────────────────────
// THE LEVER'S HEIGHT is the lowest Technic-brick hole that stands the column
// wheel's rotors (rotorTip under W, W the lowest axle) a stud and AX_CLEAR over
// the baseplate: every other part stands higher.
export function leverHeight(Wv) {
  let best = null;
  for (let k = 0; k <= 12; k++) for (let p = 0; p <= 2; p++) {
    const z = r6(D.plateH * (1 + p) + D.brickH * k + D.holeZ);
    if (z - Wv - A.rotorTip >= D.studH + AX_CLEAR - 1e-9 && (best === null || z < best)) best = z;
  }
  return best;
}
// The strike's run sense and its hammer are solved TOGETHER: a fly placement
// lists every run sense whose lock pushes into the lever's supports, and the
// first of those for which a hammer exists is the answer (with the run fixed a
// hammer must stand on the side where its tail is LIFTED by the pins and FALLS
// off them; mirrored, the pins would strike it end-on).
export function solveAlarm(lib) {
  const rel = solveRelease(lib);
  const zL = leverHeight(rel.wheel.W[1]), st = rel.disc.st;
  const C = rel.fly.C;
  const geo0 = { ...releaseGeometry(lib, { D: rel.disc.D, W: rel.wheel.W }), C };
  const strike = { tried: [] };
  for (const f of rel.flies.filter((q) => q.C[0] === C[0] && q.C[1] === C[1])) {
    const geo = { ...geo0, run: f.run };
    const phiLocks = [st.rimUp, st.rimDown, rel.wheel.block].map((p) => lockPush(geo, p, f.run).phi);
    const hm = solveHammer(lib, { C, run: f.run, zC: zL - C[1], phiLocks });
    strike.tried.push({ run: f.run, candidates: hm.ranked.length });
    if (hm.pick) { Object.assign(strike, { run: f.run, phiLocks, hammer: hm.pick, ranked: hm.ranked }); break; }
  }
  // the index, for each band of the pawl: which way it locks the 12T is read
  // off the teeth (pawlLock), the press turns the driver against that, and
  // the band whose stroke stands nearest the middle of its window is taken
  const br = beakRests(geo0, st.rimDown);
  const bands = [1, -1].map((band) => {
    const lock = pawlLock(lib, pawlSpecOn(band), 12);
    const ix = solveIndex(lib, { W: rel.wheel.W, zW: zL - rel.wheel.W[1], toBeakColumn: br.column, Lrel: [-rel.wheel.W[0], -rel.wheel.W[1]], pawlSense: band, pawlLocks: lock.locks });
    return { band, lock, ix, score: ix.pick ? ix.pick.driver.score : Infinity };
  });
  bands.sort((a, b) => a.score - b.score);
  const { lock, ix } = bands[0];
  return { rel, zL, strike, lock, pawlSense: bands[0].band, bands, beak: br, index: ix };

}

// THE DECLARED ANSWER, re-solved by tools/probe-technic-alarm.mjs (it fails
// when the solve answers otherwise). Plane positions are (u, v) mm about the
// lever's pivot L, v down; the detent's pivot is about W, the hammer's about C,
// the stacks' middles about W (the driver's) and about the hammer's pivot (the
// struck stack). `pawlSense` is the pawl's band (the solve tries both and keeps
// the one whose stroke stands nearest its window's middle), `pawlLocks` the way
// pawlLock reads it locking the 12T — re-read by the probe, declared here so a
// page need not trace it — and the press turns the driver against it.
export const TECHNIC_ALARM = Object.freeze({
  D: Object.freeze([28, 16]), W: Object.freeze([12, 25.6]), C: Object.freeze([36, -6.4]), run: 1, pawlSense: 1, pawlLocks: -1,
  detent: Object.freeze({ pivot: Object.freeze([-16, 16]), sense: 1 }),
  driver: Object.freeze({ rest: Object.freeze({ u: 20, plates: 5 }), bank: Object.freeze({ u: 0, plates: 2 }) }),
  hammer: Object.freeze({ at: Object.freeze([12, -25.6]), sense: 1, kHead: 3, struck: Object.freeze({ u: 12, plates: 23 }) }),
  // §288: the guides' middles about W, the plates under each guide's brick (its
  // foot among them), and the rod's length in studs (solvePusher)
  pusher: Object.freeze({ slot: -40, plates: 2, guides: Object.freeze([36, 44]), rod: 6 }),
});
// THE TRAINS, laid on the lattice from the shafts the solve fixed: the strike
// train runs from the fly arbor toward −u (away from the hammer), one 16:8
// mesh (12 mm) a stage; the 12:1 runs from the disc toward +u (away from the
// column wheel), the fork's classic motion-works row reversed: the disc's 24T
// from an 8T 16 mm off, then two 16:8 stages, to the HOUR AXLE (the input,
// once an hour, turned by hand here: no going train drives it).
export const STRIKE_CHAIN = Object.freeze([[16, 8], [16, 8]]);            // barrel → middle → fly arbor, [driver, driven]
export const RELEASE_CHAIN = Object.freeze([[8, 16], [8, 16], [8, 24]]);  // hour axle → … → disc, [driver, driven]
export function alarmShafts(spec = TECHNIC_ALARM) {
  const [C, D_] = [spec.C, spec.D];
  const cd = (a, b) => (a + b) / 2;
  const I = [C[0] - cd(16, 8), C[1]], B = [I[0] - cd(16, 8), I[1]];
  const S2 = [D_[0] + cd(8, 24), D_[1]], S1 = [S2[0] + cd(8, 16), S2[1]], H0 = [S1[0] + cd(8, 16), S1[1]];
  return { L: [0, 0], D: D_, W: spec.W, C, I, B, S2, S1, H0,
    P: [spec.W[0] + spec.detent.pivot[0], spec.W[1] + spec.detent.pivot[1]],
    Hm: [C[0] + spec.hammer.at[0], C[1] + spec.hammer.at[1]] };
}

// ── THE FRAME (mm: x across, y along the axles, z up from the baseplate) ────
// x = u (L on the stud grid), z = zL − v. Every axle stands in two Technic
// bricks on columns, both on the side its parts leave free: the column wheel's
// works, the detent's and the hammer's in FRONT (their parts reach back to the
// lever's band), the lever's, the disc's, the fly's and the trains' BEHIND. A
// column is the fusee's: a 1×1 plate (or a jumper, a half stud off the grid),
// plates and bricks to height, a Technic brick. Its SLOT along y is the first
// stud-grid position past the axle's parts whose column stands clear (AX_CLEAR)
// of every member swept through that slot and of every column already there
// (allocated in a fixed order); its second column the next such slot out.
const AXLE_LENS = Object.keys(AXLE_PARTS).map(Number).sort((a, b) => a - b);
const TRIM = 0.2;   // the library shortens each axle end by half an LDU

// ── §288: THE PUSHER ────────────────────────────────────────────────────────
// Landing I left the driver's free end bare: "the PUSHER, the end a finger
// presses", a liftarm's end pressed down in the plane. That end does not move
// down. Between the driver's two stops it swings 31.19° about W, so it moves
// 7.0 mm across and 5.0 mm down, along a chord 35° off the level, and no
// straight push from above meets it on one face. What a straight push CAN
// follow is one coordinate of a ROUND part. So the driver carries a round half
// bush (32123a) on a 2L axle keyed in its free end hole, standing in front of
// its slot (the rest and bank stacks fill that slot), and a ROD pushes it
// level, across the frame:
//   · the ROD is a cross axle sliding in the round pin holes of two Technic
//     bricks (6541), each turned a quarter round about the vertical so its hole
//     runs along x. A 1×1 brick stands on the same stud turned, so the guides
//     are ordinary columns. An axle turns and slides free in a pin hole, and
//     the rod's parts are all round, so its spin is no part of the law;
//   · its TIP is a second half bush, flush with the rod's end. Its face is flat
//     out to the flanges (3.6 mm, read off the part by the probe), and it
//     presses the driver's half bush where that bush stands farthest along the
//     push. The two are round, so the tip's face stands at
//         u = −DRIVER_ARM·cos ψ − pd·R        (pushFace; R the bush's flanges)
//     about W, and the driver stands where that holds (pushDriver). The ROD is
//     the input and the driver follows it: rule 2 at a LEGO pusher;
//   · a third half bush is the COLLAR, an LDU short of the inner guide at rest:
//     the rod's out-stop (a bush slides on an axle, so it is set anywhere). The
//     bank stack ends the stroke, through the driver;
//   · a BUSH (3713) on the outer end is the BUTTON.
// The driver's band, which turned it back onto its rest stack, now also pushes
// the rod back out through the same contact. A force along pd·u at the bush's
// height v turns the driver by −v·pd. So the push runs the way that gives the
// press's σ over the whole stroke, and the end must not cross W's height. The
// rod stands at a lattice height, and the contact must stay on the tip's face.
// Its slot is the first stud-grid slot in front of the driver that the tip's
// flanges clear by an LDU. MODELLED: nothing is weighed, and the finger's
// force is not a number here.
const PUSH_R = KEYLESS_PULL_DIM_MM.followerR, PUSH_W = 2 * KEYLESS_PULL_DIM_MM.followerHalfWidth;
const BUTTON_W = 2 * FUSEE_DIM_MM.halfWidth[ALARM_PARTS.button];
// the 2L in the driver's free end hole, from the driver's back face forward,
// and the half bush flush with its front end
export const PUSH_Y = Object.freeze((() => {
  const stub = [r6(Yp.driver[1] - (2 * D.stud - 2 * TRIM)), Yp.driver[1]];
  return { stub, follower: [stub[0], r6(stub[0] + PUSH_W)] };
})());
export const pushEnd = (psi) => [-DRIVER_ARM * Math.cos(psi), -DRIVER_ARM * Math.sin(psi)];
export const pushFace = (psi, pd) => pushEnd(psi)[0] - pd * PUSH_R;
// the driver's angle where the tip's face stands at u (the branch the stroke is on)
export function pushDriver(u, pd, psiRest) {
  const c = Math.max(-1, Math.min(1, -(u + pd * PUSH_R) / DRIVER_ARM));
  const psi = Math.sign(Math.sin(psiRest)) * Math.acos(c);
  return psiRest + mod(psi - psiRest + Math.PI, TAU) - Math.PI;
}
// the driver's two stops, as alarmStates reads them
export function driverStops(spec, zW) {
  const rect = (s) => stackRect(s.u, s.plates * D.plateH, zW), sigma = -spec.pawlLocks;
  const psiRest = driverStop(rect(spec.driver.rest), (sigma < 0 ? 0 : Math.PI) + sigma * deg(60), -sigma);
  return { psiRest, psiBank: driverStop(rect(spec.driver.bank), psiRest, sigma), sigma };
}
// THE SOLVE. Everything the rod needs from the driver's stroke: the push's
// direction, its slot, its height (the lattice height that keeps the contact
// nearest the tip's middle), the guides, the collar and the rod's length.
export function solvePusher(spec, zL) {
  const g = AX_CLEAR, half = D.stud / 2, zW = r6(zL - spec.W[1]);
  const { psiRest, psiBank, sigma } = driverStops(spec, zW);
  const out = { psiRest, psiBank, sigma };
  if (psiRest === null || psiBank === null) return { ...out, pick: null, why: 'the driver has no stops' };
  const n = 128, at = Array.from({ length: n + 1 }, (_, i) => psiRest + (psiBank - psiRest) * i / n);
  const pd = -Math.sign(sigma * pushEnd(psiRest)[1]);
  if (at.some((p) => -pushEnd(p)[1] * pd * sigma <= 0)) return { ...out, pick: null, why: 'the end crosses the axle\'s height: no one push turns the driver all the way' };
  const faces = at.map((p) => pushFace(p, pd));
  for (let i = 0; i < n; i++) if (pd * (faces[i + 1] - faces[i]) <= 0) return { ...out, pick: null, why: 'the face turns back along the stroke' };
  const stroke = r6(pd * (faces[n] - faces[0]));
  // the slot: the tip's flanges an LDU in front of the driver, on the stud grid;
  // they must cover the driver's half bush and clear the stops' slot
  const slot = Math.floor((Yp.driver[0] - g - PUSH_R) / D.stud) * D.stud;
  const band = [slot - PUSH_R, slot + PUSH_R], fol = PUSH_Y.follower;
  const dSlot = Math.round(((Yp.driver[0] + Yp.driver[1]) / 2 - half / 2 - 0.5) / D.stud) * D.stud;
  // (1e-4: the flanges are 9 LDU, and the part's vertices read them 0.09 µm out)
  if (band[0] > fol[0] + 1e-4 || band[1] < fol[1] - 1e-4) return { ...out, pick: null, why: 'the tip does not cover the driver\'s half bush' };
  if (band[1] > dSlot - half - g + 1e-4) return { ...out, pick: null, why: 'the tip reaches into the stops\' slot' };
  // the height: a guide's hole, plates over its foot, the contact on the tip's face
  // (an LDU inside its flanges) and the tip over the baseplate's studs
  const cz = at.map((p) => zW - pushEnd(p)[1]);
  let h = null;
  for (let k = 1; k <= 12; k++) {
    const z = r6(D.plateH * k + D.holeZ), dev = Math.max(...cz.map((c) => Math.abs(c - z)));
    if (z - PUSH_R < D.studH + g || dev > PUSH_R - g) continue;
    if (!h || dev < h.dev) h = { plates: k, z, dev };
  }
  if (!h) return { ...out, pick: null, why: 'no lattice height keeps the contact on the tip\'s face' };
  // the guides, on the stud grid side by side (a jumper's foot would reach
  // under its neighbour): the inner's near face far enough out that the tip
  // and the collar fit before it, the collar an LDU short of it
  const o = -pd, xTip0 = r6(spec.W[0] + faces[0]);
  const need = o * xTip0 + 2 * PUSH_W + g + half;              // the inner guide's middle, outward
  const xIn = o * Math.ceil(need / D.stud - 1e-9) * D.stud, xOut = xIn + o * D.stud;
  const collar = r6(o * (xIn - o * half) - g - PUSH_W - o * xTip0);   // the collar's inner face, outward from the tip
  // the rod: through both guides at every stroke, and the button an LDU off the
  // outer guide at the bank
  const reach = o * (xOut + o * half) + g + stroke + BUTTON_W - o * xTip0;
  const rod = AXLE_LENS.find((k) => k * D.stud - 2 * TRIM >= reach - 1e-9);
  if (!rod) return { ...out, pick: null, why: 'no axle reaches the button' };
  const len = r6(rod * D.stud - 2 * TRIM);
  return { ...out, pick: { pd, slot, plates: h.plates, z: h.z, dev: h.dev, xTip0, stroke, guides: [r6(xIn - spec.W[0]), r6(xOut - spec.W[0])], collar, rod, len,
    play: g, buttonGap: r6(o * xTip0 + len - BUTTON_W - stroke - o * (xOut + o * half)) } };
}
// The rod as the frame carries it, from the DECLARED spec (the probe re-solves
// it): the push's direction, its height, the tip at rest, the stroke.
export function pusherOf(spec, zL) {
  const P = spec.pusher, zW = r6(zL - spec.W[1]);
  const { psiRest, psiBank, sigma } = driverStops(spec, zW);
  const pd = -Math.sign(sigma * pushEnd(psiRest)[1]);
  const xTip0 = spec.W[0] + pushFace(psiRest, pd), stroke = pd * (pushFace(psiBank, pd) - pushFace(psiRest, pd));   // unrounded: the laws read them
  const o = -pd, xIn = spec.W[0] + P.guides[0], len = r6(P.rod * D.stud - 2 * TRIM);
  return { pd, slot: P.slot, z: r6(D.plateH * P.plates + D.holeZ), xTip0, stroke, psiRest, psiBank, len,
    collar: r6(o * (xIn - o * D.stud / 2) - AX_CLEAR - PUSH_W - o * xTip0), guides: P.guides.map((u) => spec.W[0] + u), R: PUSH_R, W: PUSH_W, buttonW: BUTTON_W };
}
// travel along the press (mm from rest) ⇄ the driver's angle
export const pusherX = (pu, travel) => pu.xTip0 + pu.pd * travel;
export const pusherDriver = (pu, spec, travel) => pushDriver(pusherX(pu, travel) - spec.W[0], pu.pd, pu.psiRest);
export const pusherTravel = (pu, spec, psi) => pu.pd * (spec.W[0] + pushFace(psi, pu.pd) - pu.xTip0);
export function sweptMembers(spec = TECHNIC_ALARM, sh = alarmShafts(spec)) {
  const Y = Yp, r = (k) => GEAR_TIP_MM[ALARM_PARTS[k]];
  const tip24 = GEAR_TIP_MM[ALARM_PARTS.spur24];
  const pawlReach = DRIVER_ARM + PAWL_ARM + A.leverHalfWidth;
  return [
    { who: 'lever', c: sh.L, r: 2 * A.leverHoles + A.leverHalfWidth, y: [Y.beakMid - A.pinHalf, Y.beakMid + A.pinHalf] },
    { who: 'rotors', c: sh.W, r: A.rotorTip, y: [Y.rotorB[0], Y.rotorA[1]] },
    { who: '12T', c: sh.W, r: r('wheel'), y: Y.wheel },
    { who: 'follower', c: sh.P, r: DETENT_ARM + A.leverHalfWidth, y: [Y.wheel[0] - 3 * AX_CLEAR - A.armThick, Y.followerArm[1]] },
    { who: 'pawl', c: sh.W, r: pawlReach, y: [Y.pawlArm[0], Y.followerArm[1]] },
    { who: 'driver', c: sh.W, r: DRIVER_ARM + A.leverHalfWidth, y: Y.driver },
    { who: 'pawl pivot', c: sh.W, r: DRIVER_ARM + D.axleR, y: [Y.pawlArm[1] - 2 * D.stud + 2 * TRIM, Y.pawlArm[1]] },
    { who: 'push follower', c: sh.W, r: DRIVER_ARM + PUSH_R, y: [PUSH_Y.stub[0], Y.driver[0]] },   // §288: the driver's half bush and its 2L
    { who: 'disc', c: sh.D, r: FLY_SWEEP, y: [Y.discPinMid - A.pinHalf, Y.discBack[1]] },
    { who: 'disc 24T', c: sh.D, r: tip24, y: Y.disc24 },
    { who: 'fly', c: sh.C, r: FLY_SWEEP, y: [Y.fly[0], Y.cam2[1]] },
    { who: 'fly 8T', c: sh.C, r: r('spur8'), y: Y.flyPinion },
    { who: 'middle 16T', c: sh.I, r: r('spur16'), y: Y.flyPinion },
    { who: 'middle 8T', c: sh.I, r: r('spur8'), y: Y.strikeMid },
    { who: 'barrel 16T', c: sh.B, r: r('spur16'), y: Y.strikeMid },
    { who: 'S2 8T', c: sh.S2, r: r('spur8'), y: Y.trainA },
    { who: 'S2 16T', c: sh.S2, r: r('spur16'), y: Y.trainB },
    { who: 'S1 8T', c: sh.S1, r: r('spur8'), y: Y.trainB },
    { who: 'S1 16T', c: sh.S1, r: r('spur16'), y: Y.trainC },
    { who: 'hour 8T', c: sh.H0, r: r('spur8'), y: Y.trainC },
    { who: 'hammer', c: sh.Hm, r: KEYLESS_PULL_DIM_MM.armHoles + A.leverHalfWidth, y: [Y.head[0], Y.tail[1]] },
  ];
}
// A column's section in (x, z): its stack x ± half a stud from 0 to the brick's
// top, and its foot (a jumper is a stud either side) on the baseplate.
function columnBoxes(x, top, jumper) { return [[x - D.stud / 2, x + D.stud / 2, 0, top], [x - (jumper ? D.stud : D.stud / 2), x + (jumper ? D.stud : D.stud / 2), 0, D.plateH]]; }
const boxDiscGap = ([x0, x1, z0, z1], cx, cz, r) => Math.hypot(Math.max(x0 - cx, 0, cx - x1), Math.max(z0 - cz, 0, cz - z1)) - r;
const boxesOverlap = (a, b) => a[0] < b[1] - 1e-9 && b[0] < a[1] - 1e-9 && a[2] < b[3] - 1e-9 && b[2] < a[3] - 1e-9;
export function frameAlarm(lib = null, spec = TECHNIC_ALARM) {
  const sh = alarmShafts(spec), zL = leverHeight(spec.W[1]), g = AX_CLEAR, half = D.stud / 2, Y = Yp;
  const X = (p) => r6(p[0]), Z = (p) => r6(zL - p[1]);
  const swept = sweptMembers(spec, sh);
  // the AXLES: their parts' y extent and the side their columns stand on
  const lastFace = (who) => Math.max(...swept.filter((m) => m.who.startsWith(who)).map((m) => m.y[1]));
  const axleDefs = [
    { shaft: 'lever', p: sh.L, side: 1, from: Y.lever[0], to: Y.lever[1] },
    { shaft: 'disc', p: sh.D, side: 1, from: Y.discFront[0], to: Y.disc24[1] },
    { shaft: 'fly', p: sh.C, side: 1, from: Y.fly[0], to: Y.flyPinion[1] },
    { shaft: 'middle', p: sh.I, side: 1, from: Y.flyPinion[0], to: Y.strikeMid[1] },
    { shaft: 'barrel', p: sh.B, side: 1, from: Y.strikeMid[0], to: Y.strikeMid[1] },
    { shaft: 'S2', p: sh.S2, side: 1, from: Y.trainA[0], to: Y.trainB[1] },
    { shaft: 'S1', p: sh.S1, side: 1, from: Y.trainB[0], to: Y.trainC[1] },
    { shaft: 'hour', p: sh.H0, side: 1, from: Y.trainC[0], to: Y.trainC[1] },
    { shaft: 'column wheel', p: sh.W, side: -1, from: Y.rotorA[1], to: Y.driver[0] },
    { shaft: 'detent', p: sh.P, side: -1, from: Y.followerArm[1], to: Y.followerArm[0] },
    { shaft: 'hammer', p: sh.Hm, side: -1, from: Y.tail[1], to: Y.head[0] },
  ];
  // the FIXED stacks: the driver's two stops (in the driver's slot) and the
  // stack the hammer strikes (in the slot of the head's layer)
  const slotOf = (y) => Math.round(y / D.stud) * D.stud;
  const dSlot = slotOf((Y.driver[0] + Y.driver[1]) / 2 - half / 2 - 0.5), hSlot = slotOf((Y.head[0] + Y.head[1]) / 2 + half / 2);
  const stacks = [
    { who: 'rest stop', x: r6(sh.W[0] + spec.driver.rest.u), top: r6(spec.driver.rest.plates * D.plateH), slot: dSlot, tile: true },
    { who: 'bank stop', x: r6(sh.W[0] + spec.driver.bank.u), top: r6(spec.driver.bank.plates * D.plateH), slot: dSlot, tile: true },
    { who: 'struck', x: r6(sh.Hm[0] + spec.hammer.struck.u), top: r6(spec.hammer.struck.plates * D.plateH), slot: hSlot, tile: true },
    // §288: the pusher's two guides, each a Technic brick turned a quarter round
    ...spec.pusher.guides.map((u, i) => ({ who: i ? 'outer guide' : 'inner guide', x: r6(sh.W[0] + u), top: r6(spec.pusher.plates * D.plateH + D.brickH), slot: spec.pusher.slot, technic: true, turned: true })),
  ];
  const placed = stacks.map((s) => ({ ...s, boxes: columnBoxes(s.x, s.top, mod(s.x, D.stud) !== 0) }));
  const clearOf = (boxes, slot, self) => {
    const y0 = slot - half, y1 = slot + half;
    for (const m of swept) if (m.y[0] < y1 - 1e-9 && m.y[1] > y0 + 1e-9) {
      if (self && m.who === self) continue;
      if (boxes.some((b) => boxDiscGap(b, X(m.c), Z(m.c), m.r) < g)) return false;
    }
    for (const q of placed) if (q.slot === slot && q.boxes.some((b) => boxes.some((c) => boxesOverlap(b, c)))) return false;
    for (const a of axleDefs) {
      if (!a.span) continue;
      if (a.span[0] < y1 - 1e-9 && a.span[1] > y0 + 1e-9 && boxes.some((b) => boxDiscGap(b, X(a.p), Z(a.p), D.axleR) < g)) return false;
    }
    return true;
  };
  const columns = [], axles = [];
  for (const a of axleDefs) {
    const x = X(a.p), zH = Z(a.p), jumper = mod(x, D.stud) !== 0;
    const m = Math.round((zH - D.holeZ - D.plateH) / D.plateH);
    if (m < 0 || Math.abs(D.plateH * (1 + m) + D.holeZ - zH) > 1e-6) return { framed: false, reason: `${a.shaft} stands off the plate lattice` };
    const top = r6(zH - D.holeZ + D.brickH), boxes = columnBoxes(x, top, jumper);
    const slots = [];
    let s = a.side > 0 ? Math.ceil((a.to + g + half) / D.stud) * D.stud : Math.floor((a.to - g - half) / D.stud) * D.stud;
    for (let tries = 0; slots.length < 2 && tries < 12; tries++, s += a.side * D.stud) if (clearOf(boxes, s, null)) slots.push(s);
    if (slots.length < 2) return { framed: false, reason: `no two clear column slots for the ${a.shaft} axle` };
    const outer = slots[1] + a.side * half, inner = a.from;
    const need = Math.abs(outer - inner) + (a.knob ? A.armThick + g + half : 0);
    const n = AXLE_LENS.find((v) => v * D.stud - 2 * TRIM >= need - 1e-9);
    const len = n * D.stud - 2 * TRIM, span = a.side > 0 ? [inner, inner + len] : [inner - len, inner];
    a.span = span.map(r6);
    axles.push({ shaft: a.shaft, x, z: zH, y0: a.span[0], y1: a.span[1], part: AXLE_PARTS[n], lenStuds: n, knobY: a.knob ? r6(slots[1] + a.side * (half + g + A.armThick / 2)) : null });
    for (const [i, sl] of slots.entries()) {
      const col = { shaft: a.shaft, end: i ? 'outer' : 'inner', x, y: sl, holeZ: zH, top, jumper, slot: sl, boxes };
      placed.push(col); columns.push(col);
    }
  }
  const all = [...columns, ...placed.filter((q) => !q.shaft)];
  const xs = all.flatMap((c) => c.boxes.flatMap((b) => [b[0], b[1]])), ys = all.flatMap((c) => [c.slot - half, c.slot + half]);
  const base = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  base.studsX = (base.x1 - base.x0) / D.stud; base.studsY = (base.y1 - base.y0) / D.stud;
  return { framed: true, key: 'alarm', gen: 'technic_classic', spec, zL, shafts: sh, axles, columns, stacks: placed.filter((q) => !q.shaft), swept, base, pusher: pusherOf(spec, zL) };
}

// ── THE BUILD: LDraw placements (LDU) ───────────────────────────────────────
// frame (x, y, z) → LDraw (x, −z, y)/0.4, a proper rotation, as every technic
// build here. Each body turns about LDraw Z through its axis by its angle in
// (u, v) — rotZ — so the planar laws above pose it directly.
const at3 = (X, Y, Z, r = I3) => [X, Y, Z, ...r];
const fr = (x, y, z) => [L(x), -L(z), L(y)];
// a thin liftarm: its length (own Z) along LDraw X, its holes (own Y) along
// LDraw Z, its width (own X) along LDraw Y (landing H's ARM_TO_PLANE)
const ARM_TO_PLANE = [0, 0, 1, 1, 0, 0, 0, 1, 0];
const X_TO_Z_REV = [0, 0, 1, 0, 1, 0, -1, 0, 0];   // a pin's own X onto LDraw −Z (proper)
// (This module's own role-colour table was retired by BUILT §300: read by nothing, and 'pawl' and 'pin' disagreed with the .ldr's.
// LDRAW_COLOUR in technic-ldraw.js is the one colour-by-role declaration.)
// The bodies' poses: the lever's angle ψ, the disc's θ, the column wheel's θW,
// the driver's angle, the fly arbor's φ; the rest follow (each pawl and the
// hammer seated, each train phased to mesh).
export function alarmPose(lib, frame, { theta, thetaW, psiDriver, phiC = null, mode = 'armed' } = {}) {
  const spec = frame.spec, sh = frame.shafts, geo = { ...releaseGeometry(lib, { D: spec.D, W: spec.W, C: spec.C, run: spec.run }) };
  const lever = leverRest(geo, { theta, thetaW });
  const lock = lockPush(geo, lever.psi, spec.run);
  const phi = phiC ?? (lock && !lock.free ? lock.phi : 0);
  const det = detentSpec(spec.detent.pivot, spec.detent.sense), fm = followerModel(lib, det);
  const psiFollower = fm.seat(thetaW);
  const pawl = pawlAt(lib, spec.pawlSense, psiDriver, thetaW);
  const pinRad = Math.max(pinR(lib, 'fly', Yp.tail), pinR(lib, 'cam2', Yp.tail));
  const Hs = spec.hammer, headOff = Hs.kHead * Math.PI / 2;
  const struckSt = frame.stacks.find((s) => s.who === 'struck');
  const h = { C: spec.C, Hm: sh.Hm, sense: Hs.sense, headOff, pinR: pinRad, psiFree: -Math.PI / 2 - headOff,
    struck: [struckSt.x - D.stud / 2, struckSt.x + D.stud / 2, frame.zL - struckSt.top, 1e9] };
  const hr = hammerRest(h, phi);
  // §288: the rod against the driver's half bush (at a rest state, the band
  // holds the driver on its stop and the rod rests on it)
  const pushX = pusherX(frame.pusher, pusherTravel(frame.pusher, spec, psiDriver));
  return { theta, thetaW, psiDriver, pushX, psiLever: lever.psi, leverBy: lever.by, phiC: phi, lock, psiFollower, pawl, psiHammer: hr ? hr.psi : null, hammerBy: hr?.by ?? null, mode };
}
export function alarmBuild(frame, lib, pose) {
  const spec = frame.spec, sh = frame.shafts, Y = Yp, zL = frame.zL;
  const statics = [], bodies = [];
  // the baseplate: its studs at odd multiples of 10 LDU from its centre
  const midX = L((frame.base.x0 + frame.base.x1) / 2), midZ = L((frame.base.y0 + frame.base.y1) / 2);
  const snap = (v) => Math.round((v - 10) / 20) * 20 + 10;
  statics.push({ role: 'baseplate', part: Math.max(frame.base.studsX, frame.base.studsY) + 1 <= 16 ? FRAME_PARTS.baseplate16 : KEYLESS_PARTS.baseplate32, m: at3(snap(midX), 0, snap(midZ)) });
  // columns and stacks: a foot (plate or jumper), plates and bricks, a Technic
  // brick on an axle column; plates and a tile on a stack
  const stack = (x, slot, top, technic, turned = false) => {
    const jumper = mod(x, D.stud) !== 0;
    const parts = [{ part: jumper ? FRAME_PARTS.jumper1x2 : FRAME_PARTS.plate1x1, h: D.plateH, role: 'plate' }];
    const cap = technic ? { part: FRAME_PARTS.technicBrick1x1, h: D.brickH, role: 'technicBrick', r: turned ? X_TO_Z_REV : I3 } : { part: ALARM_PARTS.tile, h: A.tileH, role: 'tile' };
    let n = Math.round((top - cap.h - D.plateH) / D.plateH);
    const k = Math.floor(n / 3); n -= 3 * k;
    for (let i = 0; i < n; i++) parts.push({ part: FRAME_PARTS.plate1x1, h: D.plateH, role: 'plate' });
    for (let i = 0; i < k; i++) parts.push({ part: FRAME_PARTS.brick1x1, h: D.brickH, role: 'brick' });
    parts.push(cap);
    let zz = 0;
    for (const p of parts) { zz += p.h; statics.push({ role: p.role, part: p.part, m: at3(L(x), -L(zz), L(slot), p.r) }); }
    return r6(zz);
  };
  for (const c of frame.columns) stack(c.x, c.slot, c.top, true);
  for (const s of frame.stacks) stack(s.x, s.slot, s.top, !!s.technic, !!s.turned);
  const body = (shaft, p, phi, parts) => { bodies.push({ shaft, origin: fr(p[0], 0, zL - p[1]), phi, speed: 0, parts }); };
  const ax = Object.fromEntries(frame.axles.map((a) => [a.shaft, a]));
  const axlePart = (a) => ({ role: 'axle', part: a.part, m: at3(0, 0, L((a.y0 + a.y1) / 2), ROT_AXLE) });
  const mid = (b) => L((b[0] + b[1]) / 2);
  // THE RELEASE LEVER: the 5L keyed by its end hole on L (its middle 16 out),
  // the beak pin in its middle hole
  body('lever', sh.L, pose.psiLever, [axlePart(ax.lever),
    { role: 'lever', part: ALARM_PARTS.lever, m: at3(L(A.leverHoles), 0, mid(Y.lever), ARM_TO_PLANE) },
    { role: 'pin', part: ALARM_PARTS.pin, m: at3(L(A.leverHoles), 0, L(Y.beakMid), X_TO_Z_REV) }]);
  // THE COLUMN WHEEL: rotor A (studs forward), rotor B turned over, the 12T
  body('column wheel', sh.W, pose.thetaW, [axlePart(ax['column wheel']),
    { role: 'rotor', part: ALARM_PARTS.rotor, m: at3(0, 0, L(Y.rotorA[0]), Y_TO_Z) },
    { role: 'rotor', part: ALARM_PARTS.rotor, m: at3(0, 0, L(Y.rotorB[1]), Y_TO_Z_FLIP) },
    { role: 'wheel', part: ALARM_PARTS.wheel, teeth: 12, m: at3(0, 0, mid(Y.wheel)) }]);
  // THE DETENT: its arm keyed on P, the bush on a 2L axle in its far end hole
  const twoL = (yFrom, dir) => ({ y0: dir > 0 ? yFrom : yFrom - (2 * D.stud - 2 * TRIM), y1: dir > 0 ? yFrom + 2 * D.stud - 2 * TRIM : yFrom });
  const fAx = twoL(Y.followerArm[1], -1);
  body('detent', sh.P, pose.psiFollower, [axlePart(ax.detent),
    { role: 'arm', part: ALARM_PARTS.arm, m: at3(0, 0, mid(Y.followerArm), ARM_TO_PLANE) },
    { role: 'axle', part: AXLE_PARTS[2], m: at3(L(DETENT_ARM), 0, L((fAx.y0 + fAx.y1) / 2), ROT_AXLE) },
    { role: 'follower', part: ALARM_PARTS.follower, m: at3(L(DETENT_ARM), 0, mid(Y.follower)) }]);
  // THE DRIVER: a 5L idling on W by its round middle hole (its origin), the
  // pawl's pivot axle keyed in its end hole DRIVER_ARM out
  const pAx = twoL(Y.pawlArm[1], -1);
  body('driver', sh.W, pose.psiDriver, [
    { role: 'driver', part: ALARM_PARTS.lever, m: at3(0, 0, mid(Y.driver), ARM_TO_PLANE) },
    { role: 'axle', part: AXLE_PARTS[2], m: at3(L(DRIVER_ARM), 0, L((pAx.y0 + pAx.y1) / 2), ROT_AXLE) },
    // §288: the 2L in the free end hole, and the half bush the pusher presses
    { role: 'stub', part: AXLE_PARTS[2], m: at3(-L(DRIVER_ARM), 0, mid(PUSH_Y.stub), ROT_AXLE) },
    { role: 'follower', part: ALARM_PARTS.follower, m: at3(-L(DRIVER_ARM), 0, mid(PUSH_Y.follower)) }]);
  // §288 THE PUSHER: one body sliding along x, its origin the tip's face; the
  // tip, the rod, the collar and the button outward from it
  const pu = frame.pusher, o = -pu.pd, yP = L(pu.slot);
  bodies.push({ shaft: 'pusher', origin: fr(pose.pushX, 0, pu.z), phi: 0, speed: 0, slides: 'x', parts: [
    { role: 'pushTip', part: ALARM_PARTS.follower, m: at3(L(o * pu.W / 2), 0, yP, X_TO_Z_REV) },
    { role: 'axle', part: AXLE_PARTS[frame.spec.pusher.rod], m: at3(L(o * pu.len / 2), 0, yP) },
    { role: 'collar', part: ALARM_PARTS.follower, m: at3(L(o * (pu.collar + pu.W / 2)), 0, yP, X_TO_Z_REV) },
    { role: 'button', part: ALARM_PARTS.button, m: at3(L(o * (pu.len - pu.buttonW / 2)), 0, yP, X_TO_Z_REV) }] });
  // THE PAWL: a 6632 on the pivot by its round middle hole (its origin, an end
  // hole, set back armMid), the 8T at its far end hole on a 2L axle reaching
  // back through the 12T's band
  const pw = pose.pawl, eAx = twoL(Y.pawlArm[0], 1);
  bodies.push({ shaft: 'pawl', origin: fr(sh.W[0] + pw.pivot[0], 0, zL - (sh.W[1] + pw.pivot[1])), phi: pw.psi, speed: 0, parts: [
    { role: 'arm', part: ALARM_PARTS.arm, m: at3(-L(A.armMid), 0, mid(Y.pawlArm), ARM_TO_PLANE) },
    { role: 'axle', part: AXLE_PARTS[2], m: at3(L(PAWL_ARM), 0, L((eAx.y0 + eAx.y1) / 2), ROT_AXLE) },
    { role: 'pawl', part: ALARM_PARTS.pawl, teeth: 8, m: at3(L(PAWL_ARM), 0, mid(Y.wheel)) }] });
  // THE RELEASE DISC: the front beam (holes at 0 and π) with its two pins, the
  // back beam a quarter round with the long pin at +π/2, the 24T
  const beamAt = (a) => mul3(rz(a + Math.PI / 2), Y_TO_Z);
  const pinAt = (a, yMid) => ({ role: 'pin', part: ALARM_PARTS.pin, m: at3(L(A.beamHoles * Math.cos(a)), L(A.beamHoles * Math.sin(a)), L(yMid), X_TO_Z_REV) });
  const longZ0 = Y.discLongCollar[0] - 8 * LDU_MM;   // its own x −8 (the collar's long-side face) at the collar's front face
  const discParts = [axlePart(ax.disc),
    { role: 'beam', part: ALARM_PARTS.beam, m: at3(0, 0, mid(Y.discFront), beamAt(0)) },
    { role: 'beam', part: ALARM_PARTS.beam, m: at3(0, 0, mid(Y.discBack), beamAt(Math.PI / 2)) },
    pinAt(0, Y.discPinMid), pinAt(Math.PI, Y.discPinMid),
    { role: 'pin', part: ALARM_PARTS.longPin, m: at3(0, L(A.beamHoles), L(longZ0), X_TO_Z_REV) },
    { role: 'gear', part: ALARM_PARTS.spur24, teeth: 24, m: at3(0, 0, mid(Y.disc24)) }];
  body('disc', sh.D, pose.theta, discParts);
  // THE FLY ARBOR: the fly's beam (vanes at 0 and π) with its pins pointing
  // back, the cam's second beam a quarter round with its pins pointing
  // forward, the 8T
  body('fly', sh.C, pose.phiC, [axlePart(ax.fly),
    { role: 'beam', part: ALARM_PARTS.beam, m: at3(0, 0, mid(Y.fly), beamAt(0)) },
    pinAt(0, Y.flyPinMid), pinAt(Math.PI, Y.flyPinMid),
    { role: 'beam', part: ALARM_PARTS.beam, m: at3(0, 0, mid(Y.cam2), beamAt(Math.PI / 2)) },
    pinAt(Math.PI / 2, Y.cam2PinMid), pinAt(-Math.PI / 2, Y.cam2PinMid),
    { role: 'gear', part: ALARM_PARTS.spur8, teeth: 8, m: at3(0, 0, mid(Y.flyPinion)) }]);
  // THE HAMMER: the tail keyed on Hm, the head kHead quarter turns round
  const Hs = spec.hammer, headOff = Hs.kHead * Math.PI / 2;
  body('hammer', sh.Hm, pose.psiHammer, [axlePart(ax.hammer),
    { role: 'arm', part: ALARM_PARTS.arm, m: at3(0, 0, mid(Y.tail), ARM_TO_PLANE) },
    { role: 'arm', part: ALARM_PARTS.arm, m: at3(0, 0, mid(Y.head), mul3(rz(headOff), ARM_TO_PLANE)) }]);
  // THE TRAINS, each driven body phased to mesh its driver (technic-ldraw's
  // law: the driven gear's GAP faces the driver's tooth)
  const phases = new Map();
  const phaseOf = (part, n) => { if (!phases.has(part)) phases.set(part, toothPhase(lib, part, n).theta); return phases.get(part); };
  const meshPhi = (pa, phiA, partA, nA, pb, partB, nB) => {
    const alpha = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
    const Aang = phiA + phaseOf(partA, nA);
    const Bang = alpha + Math.PI + (Math.PI - nA * (Aang - alpha)) / nB;
    return mod(Bang - phaseOf(partB, nB), TAU / nB);
  };
  const phiI = meshPhi(sh.C, pose.phiC, ALARM_PARTS.spur8, 8, sh.I, ALARM_PARTS.spur16, 16);
  const phiB = meshPhi(sh.I, phiI, ALARM_PARTS.spur8, 8, sh.B, ALARM_PARTS.spur16, 16);
  body('middle', sh.I, phiI, [axlePart(ax.middle),
    { role: 'gear', part: ALARM_PARTS.spur16, teeth: 16, m: at3(0, 0, mid(Y.flyPinion)) },
    { role: 'gear', part: ALARM_PARTS.spur8, teeth: 8, m: at3(0, 0, mid(Y.strikeMid)) }]);
  body('barrel', sh.B, phiB, [axlePart(ax.barrel),
    { role: 'gear', part: ALARM_PARTS.spur16, teeth: 16, m: at3(0, 0, mid(Y.strikeMid)) }]);
  const phiS2 = meshPhi(sh.D, pose.theta, ALARM_PARTS.spur24, 24, sh.S2, ALARM_PARTS.spur8, 8);
  const phiS1 = meshPhi(sh.S2, phiS2, ALARM_PARTS.spur16, 16, sh.S1, ALARM_PARTS.spur8, 8);
  const phiH = meshPhi(sh.S1, phiS1, ALARM_PARTS.spur16, 16, sh.H0, ALARM_PARTS.spur8, 8);
  body('S2', sh.S2, phiS2, [axlePart(ax.S2),
    { role: 'gear', part: ALARM_PARTS.spur8, teeth: 8, m: at3(0, 0, mid(Y.trainA)) },
    { role: 'gear', part: ALARM_PARTS.spur16, teeth: 16, m: at3(0, 0, mid(Y.trainB)) }]);
  body('S1', sh.S1, phiS1, [axlePart(ax.S1),
    { role: 'gear', part: ALARM_PARTS.spur8, teeth: 8, m: at3(0, 0, mid(Y.trainB)) },
    { role: 'gear', part: ALARM_PARTS.spur16, teeth: 16, m: at3(0, 0, mid(Y.trainC)) }]);
  body('hour', sh.H0, phiH, [axlePart(ax.hour),
    { role: 'gear', part: ALARM_PARTS.spur8, teeth: 8, m: at3(0, 0, mid(Y.trainC)) }]);
  return { key: 'alarm', gen: frame.gen, statics, shafts: bodies, meshes: [], modes: [pose.mode], pose };
}
const ROT_AXLE = [0, 0, -1, 0, 1, 0, 1, 0, 0];   // an axle's own X onto LDraw Z

// ── THE THREE STATES THE BUILD IS DRAWN IN ───────────────────────────────────
// ARMED: the column wheel at a GAP rest (on), the disc a quarter turn short of
// its notch, the lever on the rim, the fly caught on it, the hammer resting.
// RINGING: the notch under the lever, the lever dropped onto the disc's pins,
// the fly passed. OFF: the next rest, a COLUMN under the beak; with the notch
// under the lever the column holds it, and the fly stays caught. The driver at
// its rest stop each time. Every angle is a law above, read at that state.
export function alarmStates(lib, frame) {
  const spec = frame.spec;
  const geo = releaseGeometry(lib, { D: spec.D, W: spec.W, C: spec.C, run: spec.run });
  const st = releaseStates(geo), br = beakRests(geo, st.rimDown);
  const det = detentSpec(spec.detent.pivot, spec.detent.sense);
  const zW = frame.zL - spec.W[1];
  const restAt = (k) => detentRests(lib, det, br.gap + k * Math.PI / 6);
  const gapRest = restAt(0), colRest = restAt(1);
  const { psiRest, psiBank, sigma } = driverStops(spec, zW);
  const armed = alarmPose(lib, frame, { theta: st.thetaNotch - Math.PI / 2, thetaW: gapRest.rest, psiDriver: psiRest, mode: 'armed' });
  const ringing = alarmPose(lib, frame, { theta: st.thetaNotch, thetaW: gapRest.rest, psiDriver: psiRest, mode: 'ringing' });
  ringing.phiC = armed.phiC;   // the fly passed; drawn where it last stood
  const off = alarmPose(lib, frame, { theta: st.thetaNotch, thetaW: colRest.rest, psiDriver: psiRest, mode: 'off' });
  const crest = sigma > 0 ? gapRest.crestPlus - gapRest.rest : gapRest.rest - gapRest.crestMinus;
  const farCrest = sigma > 0 ? gapRest.farPlus - gapRest.rest : gapRest.rest - gapRest.farMinus;
  return { geo, st, beak: br, gapRest, colRest, sigma, crest, farCrest, window: [farCrest + PRESS_MARGIN, TAU / 12 + crest - PRESS_MARGIN], psiRest, psiBank, stroke: sigma * (psiBank - psiRest), armed, ringing, off };
}

// ── THE STRIKES, COUNTED THROUGH THE MESHES ─────────────────────────────────
// The fly arbor turns STRIKE_CHAIN's product per barrel turn (16/8 × 16/8, the
// steel's ALARM_STRIKE_RATIO 44/11 = 4 by another route), both meshes external,
// so in the barrel's own sense; strikeTrace over that many turns of it counts
// the hammer's falls. Nothing here is timed.
export const strikeRatio = () => STRIKE_CHAIN.reduce((p, [a, b]) => p * a / b, 1);
export function alarmHammer(lib, frame) {
  const spec = frame.spec, Hs = spec.hammer, headOff = Hs.kHead * Math.PI / 2;
  const s = frame.stacks.find((q) => q.who === 'struck');
  const pinRad = Math.max(pinR(lib, 'fly', Yp.tail), pinR(lib, 'cam2', Yp.tail));
  const h = { C: spec.C, Hm: frame.shafts.Hm, sense: Hs.sense, headOff, pinR: pinRad, psiFree: -Math.PI / 2 - headOff,
    struck: [s.x - D.stud / 2, s.x + D.stud / 2, frame.zL - s.top, 1e9] };
  // the rest: the head on the stack, from straight up in the band's sense
  const hitS = (psi) => segRectDist(...armSeg(h.Hm, psi + headOff), h.struck) < A.leverHalfWidth;
  let prev = h.psiFree;
  for (let i = 1; i <= 2880; i++) {
    const p = h.psiFree + Hs.sense * deg(0.125 * i);
    if (hitS(p)) { let lo = prev, hi = p; for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2; if (hitS(m)) hi = m; else lo = m; } h.psiRest = lo; break; }
    prev = p;
  }
  return h;
}
export function strikesPerBarrelTurn(lib, frame, { step = 1, from = 0 } = {}) {
  const h = alarmHammer(lib, frame);
  return strikeTrace(h, frame.spec.run, { step, from, turns: strikeRatio() }).falls.length;
}

// ── THE POSED TABLE: THE BAND, THE FLY, THE CADENCE ─────────────────────────
// A FLY has no period: the strike's pace is the band's torque against the
// vanes' air drag, and both can only be MEASURED (wind the band a counted
// number of barrel turns, count the strikes to run-down and time them). Until
// they are, the table stands in the steel's own numbers, read back off main.js'
// TEXT by the probe: ALARM_BARREL_TURNS (the barrel's travel on one wind) and
// ALARM_STRIKE_GAP (the designed cadence, 0.42 s, which the steel's anchor ring
// is SOLVED to; nothing here is solved to it). So strikes per wind is the
// counted strikes per barrel turn times a POSED number of turns, and the gap a
// POSED number of seconds: a measured table replaces `standIn` and the counts
// follow with no code change.
export const TECHNIC_ALARM_STRIKE = Object.freeze({
  status: 'POSED',
  source: 'to be measured: the band wound a counted number of barrel turns, the strikes counted and timed to run-down (LEGO_FEASIBILITY §3.7)',
  governor: 'a FLY: two beams of vanes braked by air drag, not the steel anchor and its poising ring; it has no period',
  standIn: Object.freeze({ barrelTurns: 1.75, strikeGap: 0.42, from: 'main.js ALARM_BARREL_TURNS and ALARM_STRIKE_GAP' }),
});
export const strikesPerWind = (perTurn, table = TECHNIC_ALARM_STRIKE) => perTurn * table.standIn.barrelTurns;

// ── §283: THE PRESS, ANIMATED ────────────────────────────────────────────────
// Landing I drew the alarm in three still poses. This is a press HAPPENING, every
// body read off one state through the laws above, so none is written twice:
//   · the DRIVER turns with the pusher's stroke s ∈ [0, 1], from its rest stop
//     (s = 0) to its bank stop (s = 1), alarmStates' psiRest and stroke;
//   · the PAWL rides the 12T on its band: its seat is landing H's ride
//     (pawlRideSteps) at the relative angle pawlAt seats it at. The ride says
//     where the pawl DROPS off a tooth — its 8T falling behind a tooth's face,
//     the wall it LOCKS against (pawlLock's direction). Seated at rest, the
//     pawl stands PICKUP short of that wall, so a press first turns the driver
//     that far with the wheel standing (the pawl PICKING UP a tooth), and only
//     then drives the wheel;
//   · the DETENT rides the wheel (followerModel.seat); let go, the wheel goes
//     where detentSettle says, from the rests detentRests reads (kept);
//   · the LEVER reads the wheel: on the pins it stands where releaseStates
//     measured it a degree at a time; on a COLUMN rest the beak holds it where
//     leverRest at the notch finds the beak first, so the lever's rest is the
//     first of the two supports, as leverRest's own sweep takes it;
//   · the FLY stands where lockPush puts its vane against the lever, and runs
//     where lockPush finds the lever clear; the hammer rides its cam by
//     strikeTrace's table, and strikes are its falls;
//   · the two trains turn by their tooth counts off the disc and the fly arbor.
// Every RATE here is a DISPLAY rate: the pusher's speed, the bands' (all
// posed), the hand on the hour axle (no going train drives it). The strike
// cadence is TECHNIC_ALARM_STRIKE's POSED gap. MODELLED, NOT SIMULATED: no
// force is weighed and nothing is integrated but a display clock.
//
// WHAT THE RIDE FOUND (reported by probe-technic-column-wheel.mjs): landing I's
// `press` turns the wheel by the WHOLE stroke, the pawl taken as driving from
// the first degree. Read off the teeth, the pawl at rest stands PICKUP short of
// its tooth's face, so the wheel turns stroke − PICKUP. Every full press still
// passes the far crest and every half press still falls back; the animated law
// is the one that includes the pick-up, and `press` is left as landing I wrote
// it (its probe's controls are written against it).
export const PRESS_S = 0.9;          // display: the pusher's whole stroke, in seconds at speed 1
export const RETURN_S = 0.7;         // display: the driver's band returns it from the bank
export const DROP_S = 0.25;          // display: the detent's band carries the wheel on into a rest
export const HOUR_RIM_DEG_S = 90;    // display: the hand on the hour axle, where the lever rides the rim
export const HOUR_V_DEG_S = 15;      // display: …and where it is off the rim (the V), slow enough to watch the reading
// The strikes ring at the POSED cadence: one cam pin a strike, so the fly
// arbor turns a quarter turn per TECHNIC_ALARM_STRIKE gap.
export const flyRate = (table = TECHNIC_ALARM_STRIKE) => (TAU / CAM_LOBES) / table.standIn.strikeGap;

// THE MODEL: everything the state is read through. A generator, so a page can
// build it between frames (the pawl's ride is 48 seat searches, the pick-up a
// bisection on seat()); columnModel drains it. Options are the probe's
// controls: `shift` turns the wheel's reading by a constant (the wheel set a
// half column pitch off its rests), `restHook` rewrites each rest the detent
// reads (a detent with no crest).
export function* columnModelSteps(lib, frame, states = alarmStates(lib, frame), { shift = 0, restHook = null, ride = null } = {}) {
  const spec = frame.spec, S = states, sigma = S.sigma, run = spec.run, pitch = TAU / 12, step30 = Math.PI / 6;
  // the ride is read over increasing relative angle, which is the pawl's FREE
  // way when it locks −; solveDriver's press then turns the driver + (σ = 1)
  if (spec.pawlLocks >= 0 || sigma !== 1) throw new Error('technic-alarm: the press is built for a pawl locking − and a press turning the driver +');
  const det = detentSpec(spec.detent.pivot, spec.detent.sense), fm = followerModel(lib, det);
  // THE RESTS, read once each: rest k at S.beak.gap + k·30°, exactly where
  // alarmStates reads rest 0 (a gap) and rest 1 (a column), so those two are its own
  const seed = S.beak.gap, cache = new Map(restHook ? [] : [[0, S.gapRest], [1, S.colRest]]);
  const turned = (r, d) => (d ? { ...r, rest: r.rest + d, crestPlus: r.crestPlus + d, crestMinus: r.crestMinus + d, farPlus: r.farPlus + d, farMinus: r.farMinus + d } : r);
  const restsOf = (k) => {
    const kk = mod(k, 12);
    if (!cache.has(kk)) { const r = detentRests(lib, det, seed + kk * step30); cache.set(kk, restHook ? restHook(r) : r); }
    return turned(cache.get(kk), Math.floor(k / 12) * TAU);
  };
  const restAngle = (k) => restsOf(k).rest;
  const restsNear = (t) => restsOf(Math.round((t - seed) / step30));
  // the rest at or σ-behind a wheel angle, and the rest a wheel stands at (or null)
  const kBehind = (w) => {
    let k = Math.round((w - seed) / step30);
    while (sigma * (restAngle(k) - w) > 1e-9) k -= sigma;
    while (sigma * (restAngle(k + sigma) - w) <= 1e-9) k += sigma;
    return k;
  };
  const atRest = (w) => { const k = Math.round((w - seed) / step30); return Math.abs(w - restAngle(k)) < 1e-7 ? k : null; };
  // THE PAWL'S RIDE, from its seat at rest 0 (x0, pawlAt's relative angle)
  const x0 = S.gapRest.rest - S.psiRest, pawlSpec = pawlSpecOn(spec.pawlSense);
  let r = ride;
  if (!r) { const it = pawlRideSteps(lib, pawlSpec, 12, { theta0: x0 }); let q; while (!(q = it.next()).done) yield 'ride'; r = q.value; }
  // THE PICK-UP: the ride's DROP is the sample step where the band turns the pawl
  // deepest in its sense at once; bisected on seat() itself to where the seat
  // leaves the riding branch for the dropped one.
  const ps = pawlSpec.sense, n = r.n;
  let iDrop = 0, big = -Infinity;
  for (let i = 0; i < n; i++) { const jump = ps * (r.table[i + 1] - r.table[i]); if (jump > big) { big = jump; iDrop = i; } }
  let lo = x0 + iDrop * pitch / n, hi = x0 + (iDrop + 1) * pitch / n;
  const upper = r.table[iDrop], lower = r.table[iDrop + 1];
  for (let i = 0; i < 16; i++) { yield 'pickup'; const mid = (lo + hi) / 2, v = r.model.seat(mid); if (Math.abs(v - upper) < Math.abs(v - lower)) lo = mid; else hi = mid; }
  const xDrop = (lo + hi) / 2 - x0;                 // the drop, along the free way from the seat at rest
  const pickup = pitch - xDrop;                      // the driver's travel from rest to the tooth's face
  // THE PAWL'S SEAT at relative angle x: the ride read between its samples,
  // except across the drop, where reading between would draw the pawl half way
  // down the tooth's face. There each side is carried on from its own two
  // samples to the drop, so the pawl stands on the tooth up to it and against
  // the face from it (where it stands while it drives).
  const T = r.table, hS = pitch / n;
  const pawlRel = (x) => {
    const u = mod(x - x0, pitch), i = Math.min(n - 1, Math.floor(u / hS));
    if (i !== iDrop) return r.at(x);
    if (u < xDrop - 1e-9) return T[i] + (T[i] - T[(i - 1 + n) % n]) / hS * (u - i * hS);   // (at the face itself, to float noise, it is against the face)
    return T[i + 1] - (T[(i + 2) % n] - T[i + 1]) / hS * ((i + 1) * hS - u);
  };
  // THE LEVER: on the pins (releaseStates, a whole degree at a time, read
  // between), or held by the beak on a column (leverRest at the notch, per rest)
  const pts = S.st.pts, dRad = deg(1);
  const leverPins = (theta) => { const u = mod(theta, TAU) / dRad, i = Math.floor(u) % 360, f = u - Math.floor(u); return pts[i].psi * (1 - f) + pts[(i + 1) % 360].psi * f; };
  const holds = new Map(shift || restHook ? [] : [[0, S.ringing], [1, S.off]].map(([k, p]) => [k, p.leverBy.includes('beak') ? p.psiLever : null]));
  const hold = (k) => {
    const kk = mod(k, 12);
    if (!holds.has(kk)) { const q = leverRest(S.geo, { theta: S.st.thetaNotch, thetaW: restAngle(kk) + shift }); holds.set(kk, q && q.by.includes('beak') ? q.psi : null); }
    return holds.get(kk);
  };
  const leverAt = (theta, w) => {
    const pins = leverPins(theta), k = atRest(w), h = k === null ? null : hold(k);
    return h !== null && LEVER_SENSE * (h - pins) < 0 ? { psi: h, by: 'beak' } : { psi: pins, by: 'pins' };
  };
  // THE FLY: the vane is a beam, the same at φ and φ + π
  const lockAt = (psi) => lockPush(S.geo, psi, run);
  const branch = (phi, near) => phi + Math.PI * Math.round((near - phi) / Math.PI);
  // THE HAMMER: strikeTrace over a turn of the fly arbor from the armed lock,
  // half a degree a step; a strike is one of its falls
  const h = alarmHammer(lib, frame), from = S.armed.phiC, tStep = 0.5;
  const trace = strikeTrace(h, run, { step: tStep, from });
  const falls = trace.falls.map((f) => mod(run * (f.phi - from), TAU) || TAU).sort((a, b) => a - b);
  const uOf = (phi) => run * (phi - from);
  const hammerAt = (phi) => trace.pts[Math.min(trace.pts.length - 1, Math.floor(mod(uOf(phi), TAU) / deg(tStep) + 1e-9))].psi;
  const strikesUpTo = (u) => Math.floor(u / TAU) * falls.length + falls.filter((f) => f <= mod(u, TAU) + 1e-12).length;
  const strikesBetween = (a, b) => strikesUpTo(uOf(b)) - strikesUpTo(uOf(a));
  // THE COLUMNS, for the reading's display: their angles in the wheel's frame,
  // which rotor carries each, and the direction from W to the beak
  const prof = unionProfile(S.geo.colA, S.geo.colB), cols = columnAngles(prof).map((c) => ({ c, rotor: rAt(S.geo.colA, c) >= rAt(S.geo.colB, c) ? 'A' : 'B' }));
  // §288 THE PUSHER: the stroke s is the ROD's travel, a fraction of its whole
  // stroke, and the driver stands where the rod's tip meets its half bush; so
  // turn(s) is the driver's turn from its rest stop, and sOf its inverse
  const pu = frame.pusher;
  const turn = (s) => sigma * (pusherDriver(pu, spec, s * pu.stroke) - S.psiRest);
  const sOf = (t) => pusherTravel(pu, spec, S.psiRest + sigma * t) / pu.stroke;
  return {
    pu, turn, sOf,
    lib, frame, S, spec, sigma, run, pitch, det, fm, ride: r, pawlRel, x0, pickup, xDrop, restsOf, restAngle, restsNear, kBehind, atRest,
    leverPins, hold, leverAt, lockAt, branch, h, trace, falls, hammerAt, strikesBetween, cols, toBeak: S.beak.toBeak, shift,
    thetaPress: S.armed.theta, thetaNotch: S.st.thetaNotch, rimDown: S.st.rimDown,
    // the half press: the wheel stopped PRESS_MARGIN (an LDU of arc at the mesh)
    // short of the detent's near crest, the margin the probe's half press keeps
    halfAim: sOf(S.crest - PRESS_MARGIN + pickup),
    rate: flyRate(), perWind: strikesPerWind(strikesPerBarrelTurnOf(falls.length)),
  };
}
const strikesPerBarrelTurnOf = (fallsPerFlyTurn) => fallsPerFlyTurn * strikeRatio();
export function columnModel(lib, frame, states, opts) {
  const it = columnModelSteps(lib, frame, states, opts);
  for (;;) { const q = it.next(); if (q.done) return q.value; }
}
// The rests and holds not yet read, read between frames (each is otherwise read
// the first time a press needs it).
export function* columnWarmSteps(m) { for (let k = 0; k < 12; k++) { m.restsOf(k); yield k; m.hold(k); yield k; } }

// ── THE STATE ────────────────────────────────────────────────────────────────
// s: the stroke. stand: where the wheel stands when the pawl is not driving it.
// j: the tooth the pawl drives (or will pick up, pressing on). drop: the detent
// carrying the wheel on into a rest, u ∈ [0, 1] of DROP_S. theta: the disc. phi:
// the fly arbor; free: the fly running. act: what the display is doing.
// home: the rest the press began from (for the phase line); last: how the last
// release came out.
export function columnStart(m, { k = 0, theta = null, act = 'idle' } = {}) {
  const w = m.restAngle(k), th = theta ?? m.thetaPress;
  const st = { act, s: 0, aim: 0, stand: w, j: k, drop: null, theta: th, hourTo: null, phi: m.S.armed.phiC, free: false, strikes: 0, ring: 0, runDown: false, home: k, last: null };
  return flyFollow(m, st, 0);
}
// The wheel: the pawl drives tooth j, or the wheel stands; the detent's drop
// carries it on. Tooth j's FACE is the 12T's own, a whole pitch from the next
// (the teeth are cut alike; the detent's rests wander from 30° steps by the
// profile's sampling, so the face is placed off rest 0, not off rest j): the
// pawl meets it where the driver has turned PICKUP past its rest stop with the
// wheel at rest_0 + j·30°.
const drivenAt = (m, st) => m.restAngle(0) + st.j * m.pitch + m.sigma * (m.turn(st.s) - m.pickup);
export function columnWheel(m, st) {
  if (st.drop) return st.drop.from + (st.drop.to - st.drop.from) * st.drop.u;
  const driven = drivenAt(m, st);
  return m.sigma * (driven - st.stand) > 0 ? driven : st.stand;
}
const isDriven = (m, st) => !st.drop && m.sigma * (drivenAt(m, st) - st.stand) > 1e-12;
// The tooth the pawl stands behind: once the driver has gone back far enough
// that the pawl drops behind the NEXT tooth's face, that is the one it drives.
function pawlTooth(m, st, w) {
  const behind = Math.floor((w - m.sigma * (m.turn(st.s) - m.pickup) - m.restAngle(0)) / m.pitch + 1e-9);
  return behind > st.j ? behind : st.j;
}
// WHERE A LET-GO WHEEL GOES: detentSettle's answer, from the rests kept.
export function columnRelease(m, w) {
  const T = detentSettle(m.lib, m.det, w, 12, m.restsNear);
  if (T === null) return { kind: 'tip', target: w };
  return { kind: m.sigma * (T - w) > 1e-12 ? 'forward' : 'back', target: T };
}
// THE STROKE MOVES. Forward, the pawl picks up and drives (columnWheel). Back,
// the pawl stops holding the wheel forward: it goes where the detent takes it —
// on into a rest ahead (the pawl rides free over the teeth), or back with the
// pawl to the rest behind (the pawl locks that way, so the two return together),
// or it stands on the tooth's tip.
export function columnStroke(m, st0, s) {
  const st = { ...st0 }, sNew = Math.max(0, Math.min(1, s));
  if (sNew < st.s && isDriven(m, st)) {
    const w = columnWheel(m, st), rel = columnRelease(m, w);
    st.last = { ...rel, from: st.home, w };
    if (rel.kind === 'forward') { st.drop = { from: w, to: rel.target, u: 0 }; st.stand = rel.target; }
    else st.stand = rel.target;
  }
  st.s = sNew;
  st.j = pawlTooth(m, st, columnWheel(m, st));
  return st;
}
// COMMANDS: a press and a half press run from rest (the disc on the rim, where
// the beak clears every column); scrubbing moves the stroke by hand and a
// release lets the band take it; the three poses are states, not rebuilds.
export function columnCommand(m, st, cmd, arg) {
  const w = columnWheel(m, st);
  if (cmd === 'press' || cmd === 'half') {
    if (st.act !== 'idle') return null;
    return { ...st, act: 'pressing', aim: cmd === 'press' ? 1 : m.halfAim, home: m.kBehind(w), last: null };
  }
  if (cmd === 'scrub') {
    if (st.act !== 'idle' && st.act !== 'scrubbing') return null;
    return { ...columnStroke(m, { ...st, home: st.act === 'idle' ? m.kBehind(w) : st.home, last: st.act === 'idle' ? null : st.last }, arg), act: 'scrubbing' };
  }
  if (cmd === 'release') return st.act === 'scrubbing' ? { ...st, act: 'returning' } : null;
  if (cmd === 'armed' || cmd === 'ringing' || cmd === 'off') {
    // the nearest rest at or σ-ahead of the wheel whose reading is the one asked
    let k = m.kBehind(w);
    while ((m.hold(k) === null) !== (cmd !== 'off')) k += m.sigma;
    const theta = cmd === 'armed' ? m.thetaPress + TAU * Math.ceil((st.theta - m.thetaPress) / TAU - 1e-9) : m.thetaNotch + TAU * Math.ceil((st.theta - m.thetaNotch) / TAU - 1e-9);
    const out = { ...st, act: cmd === 'armed' ? 'idle' : 'hour', s: 0, stand: m.restAngle(k), j: k, drop: null, theta, home: k, last: null, ring: 0, runDown: false };
    out.hourTo = cmd === 'armed' ? null : nextPress(m, theta);
    if (cmd === 'armed') { out.free = false; }
    return flyFollow(m, out, 0);
  }
  return null;
}
const nextPress = (m, theta) => m.thetaPress + TAU * Math.ceil((theta - m.thetaPress) / TAU + 1e-9);
// THE DISPLAY CLOCK: dt seconds at speed 1.
export function columnAdvance(m, st0, dt) {
  let st = { ...st0 };
  if (st.drop) {
    const u = Math.min(1, st.drop.u + dt / DROP_S);
    st.drop = u >= 1 ? null : { ...st.drop, u };
  }
  if (st.act === 'pressing') {
    st = columnStroke(m, st, Math.min(st.aim, st.s + dt / PRESS_S));
    if (st.s >= st.aim - 1e-12) st.act = 'returning';
  } else if (st.act === 'returning') {
    st = columnStroke(m, st, Math.max(0, st.s - dt / RETURN_S));
    if (st.s === 0 && !st.drop) {
      // a wheel at rest is read at the hour; one on the tooth's tip is at no
      // rest, and the model does not say what the beak reads there
      if (m.atRest(st.stand) !== null) { st.act = 'hour'; st.hourTo = nextPress(m, st.theta); st.ring = 0; st.runDown = false; }
      else st.act = 'idle';
    }
  } else if (st.act === 'hour') {
    const rate = m.leverPins(st.theta) > m.rimDown + 1e-9 ? HOUR_V_DEG_S : HOUR_RIM_DEG_S;
    st.theta = Math.min(st.hourTo, st.theta + deg(rate) * dt);
    if (st.theta >= st.hourTo) { st.theta = st.hourTo; st.act = 'idle'; }
  }
  return flyFollow(m, st, dt);
}
// THE FLY: caught, it stands where its vane meets the lever (the branch nearest
// where it stood, so it follows the lever as the lever moves); clear of the
// lever it runs at the POSED cadence, until the lever reaches into its path
// again and the vane comes round onto it. A run of more than the POSED wind
// would run the band down — the display rates are chosen so it never does, and
// the probe holds that; were it reached, the train stops (runDown).
function flyFollow(m, st, dt) {
  const L = m.leverAt(st.theta, columnWheel(m, st)), lp = m.lockAt(L.psi);
  if (!st.free) {
    if (lp.free) { st.free = true; st.ring = 0; }
    else st.phi = m.branch(lp.phi, st.phi);
    return st;
  }
  if (st.runDown) return st;
  const a = st.phi;
  let b = a + m.run * m.rate * dt;
  if (!lp.free) {
    const c = lp.phi + Math.PI * Math.ceil((m.run * (a - lp.phi)) / Math.PI - 1e-12) * m.run;   // the first catch at or ahead of a
    if (m.run * (b - c) >= 0) { b = c; st.free = false; }
  }
  let n = m.strikesBetween(a, b);
  if (st.ring + n >= m.perWind) { n = m.perWind - st.ring; st.runDown = true; }
  st.ring += n; st.strikes += n; st.phi = b;
  return st;
}
// THE POSE: every body's angle, in alarmPose's shape (so alarmBuild draws it
// and toLdr writes it), plus the readings the page shows.
export function columnPose(m, st) {
  const S = m.S, travel = st.s * m.pu.stroke, psiDriver = pusherDriver(m.pu, m.spec, travel), w = columnWheel(m, st);
  const rel = m.pawlRel(w - psiDriver), c = Math.cos(psiDriver), sn = Math.sin(psiDriver);
  const pawl = { rel, psi: rel + psiDriver, pivot: [DRIVER_ARM * c, DRIVER_ARM * sn] };
  const L = m.leverAt(st.theta, w), k = m.atRest(w);
  // the column nearest the beak's line from W, and whether it is centred
  // under the pin (within half the 30° between a column rest and a gap rest)
  let best = null;
  for (const [i, col] of m.cols.entries()) { const off = Math.abs(mod(w + col.c + m.shift - m.toBeak + Math.PI, TAU) - Math.PI); if (!best || off < best.off) best = { i, off, rotor: col.rotor }; }
  const reading = k === null ? null : m.hold(k) === null ? 'gap' : 'column';
  return {
    theta: st.theta, thetaW: w, psiDriver, pushX: pusherX(m.pu, travel), psiLever: L.psi, leverBy: [L.by], phiC: st.phi, psiFollower: m.fm.seat(w), pawl,
    psiHammer: m.hammerAt(st.phi), hammerBy: null,
    mode: reading === null ? 'press' : reading === 'column' ? 'off' : st.free ? 'ringing' : 'armed',
    rest: k, reading, column: { index: best.i, rotor: best.rotor, under: best.off < Math.PI / 12 },
    driven: isDriven(m, st), free: st.free, strikes: st.strikes, ring: st.ring,
  };
}
// THE TRAINS' ANGLES, travelling the gears from a reference build: each mesh
// external, so each driven arbor turns −(driver's teeth / its teeth) of the one
// before it (STRIKE_CHAIN off the fly arbor, RELEASE_CHAIN off the disc).
export function trainAngles(build0, pose) {
  const ref = Object.fromEntries(build0.shafts.map((b) => [b.shaft, b.phi])), p0 = build0.pose;
  const dF = pose.phiC - p0.phiC, dD = pose.theta - p0.theta;
  const [[b1, d1], [b2, d2]] = STRIKE_CHAIN;                       // barrel 16T → middle 8T; middle 16T → fly 8T
  const [[a1, c1], [a2, c2], [a3, c3]] = RELEASE_CHAIN;            // hour 8T → S1 16T; S1 8T → S2 16T; S2 8T → disc 24T
  const mid = -dF * d2 / b2, S2 = -dD * c3 / a3, S1 = -S2 * c2 / a2;
  return { middle: ref.middle + mid, barrel: ref.barrel - mid * d1 / b1, S2: ref.S2 + S2, S1: ref.S1 + S1, hour: ref.hour - S1 * c1 / a1 };
}
// THE PHASE LINE: what the press is doing, in words, read off the state; and
// a short form of it for a label in the scene.
const PHASE_SHORT = {
  pickup: 'the pawl picking up a tooth', climb: 'climbing to the crest', crest: 'over the near crest — on the tooth\'s tip',
  committed: 'committed — past the far crest', dropped: 'dropped into the next rest', back: 'let go short of the crest — falling back',
  tip: 'on the tooth\'s tip — at no rest', hour: 'the hour comes round', silent: 'lever on a column — silent',
  ringing: 'lever in a gap — free: ringing', rundown: 'run down', passing: 'the hour passes',
  armed: 'at rest — a gap under the pin: armed', off: 'at rest — a column under the pin: off',
};
export function columnPhase(m, st, pose = columnPose(m, st)) {
  const out = columnPhaseOf(m, st, pose);
  return { ...out, short: out.key === 'ringing' ? `${PHASE_SHORT.ringing}, strike ${st.ring}` : PHASE_SHORT[out.key] };
}
function columnPhaseOf(m, st, pose) {
  const r = m.restsOf(st.home), sg = m.sigma, d = (x) => (x * 180 / Math.PI).toFixed(1);
  const crest = sg > 0 ? r.crestPlus - r.rest : r.rest - r.crestMinus, far = sg > 0 ? r.farPlus - r.rest : r.rest - r.farMinus;
  const travel = sg * (pose.thetaW - r.rest);
  if (st.act === 'pressing' || st.act === 'scrubbing' || st.act === 'returning') {
    if (st.drop || (st.last && st.last.kind === 'forward')) return { key: 'dropped', line: `dropped into the next rest: past the far crest, the detent's band carries the wheel on (the pawl rides back over a tooth)` };
    if (st.last && st.last.kind === 'tip') return { key: 'tip', line: `let go on the tooth's tip, between the crests (${d(crest)}°–${d(far)}°): at no rest, and the model does not say which way it falls` };
    if (st.last && st.last.kind === 'back') {
      const home = sg * (st.last.target - r.rest) < 1e-9;
      return home ? { key: 'back', line: `let go short of the crest: falling back to the rest it left (the pawl and the wheel return together)` }
                  : { key: 'dropped', line: `committed: the press carried it past the next rest, and it settles back into it` };
    }
    if (!pose.driven) return { key: 'pickup', line: `the pawl picking up a tooth: the driver turns ${d(m.pickup)}° before the pawl meets a tooth's face` };
    if (travel < crest) return { key: 'climb', line: `climbing to the crest: the wheel ${d(Math.max(0, travel))}° of the detent's ${d(crest)}°` };
    if (travel < far) return { key: 'crest', line: `over the near crest, on the tooth's tip (${d(crest)}°–${d(far)}°): let go here, it stands at no rest` };
    return { key: 'committed', line: `committed: past the far crest (${d(far)}°), in the next rest's basin` };
  }
  if (st.act === 'hour') {
    if (pose.leverBy[0] === 'beak') return { key: 'silent', line: `lever on a column: silent (the beak holds it above the notch, the fly stays caught)` };
    if (st.free) return st.runDown ? { key: 'rundown', line: `run down: the POSED wind spent` } : { key: 'ringing', line: `lever in a gap, free: ringing, strike ${st.ring} (the cadence POSED)` };
    if (st.theta >= st.hourTo - 1.5 * Math.PI) return { key: 'passing', line: st.ring > 0 ? `the hour passes: the pins lift the lever and it catches the fly` : `the hour passes: the pins lift the lever off the column` };
    return { key: 'hour', line: pose.reading === 'gap' ? `the hour comes round: the lever rides the pins toward the empty place, a gap under its pin` : `the hour comes round: the lever rides the pins, a column under its pin` };
  }
  if (pose.reading === null) return { key: 'tip', line: `on the tooth's tip, at no rest: a press must pass the far crest` };
  return pose.reading === 'gap' ? { key: 'armed', line: `at rest: a gap under the lever's pin, armed` } : { key: 'off', line: `at rest: a column under the lever's pin, off` };
}
