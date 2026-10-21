// §219 tier three (b), landing B — THE FRAME AS LEGO PARTS. Pure: no three.js,
// no DOM. Takes a row `frameRow` solved (src/technic-frame.js) and the
// vendored part library (src/ldraw.js) and places every part — baseplate,
// column plates and bricks, the Technic bricks, the axles and the gears — as
// LDraw placements (part, colour, 3×4 matrix in LDU). technic.html draws them;
// `toLdr` writes the same list as a model file Studio or LDView opens.
//
// THE FRAME → LDraw MAP is a proper rotation, never a mirror: frame (x along
// the chain, y along the axles, z up, mm) goes to LDraw (X, Y, Z) =
// (x, −z, y) / 0.4 — LDraw's +Y points down. Every part's origin is the
// centre of its TOP face (the library's convention), so a box from the frame
// is placed at its top. A Technic brick's hole and a gear's bore both run along
// the part's own Z, which is the frame's y, so they need no rotation; an axle
// runs along its own X and is turned onto Z.
//
// EACH SHAFT TURNS AS ONE BODY. A gear on a cross axle is keyed: it can be
// re-seated only by a quarter turn, which is a whole number of teeth for every
// count divisible by four. So a shaft carries ONE free angle, φ, its gears sit
// at their part-frame orientation on it, and φ is solved so the shaft's driven
// gear meshes with the previous shaft's driver: with tooth angles A and B
// (counter-clockwise from the line of centres, LDraw XY), a pair meshes when
//   Na·A + Nb·(B − π) ≡ π  (mod 2π)
// — technic.html's condition, the driven gear's GAP facing the driver's tooth.
// A part's tooth angle in its own frame is MEASURED off its geometry
// (`toothPhase`), never assumed. The shafts then turn at the running product
// of their pairs, signs alternating (standing rule 2: the angles travel the
// gears).
import { walk, LDU_MM } from './ldraw.js';
import { colourOf } from './technic-colour.js';
import { FRAME_PARTS, KEYLESS_PARTS, KEYLESS_DOGS, KEYLESS_DIM_MM, KEYLESS_SELECTOR_DIM_MM, KEYLESS_PULL_DIM_MM,
  PULL_PINION_TEETH, AXLE_PARTS } from './technic-frame.js';

const L = (mm) => mm / LDU_MM;
const ROT_X_TO_Z = [0, 0, -1, 0, 1, 0, 1, 0, 0];   // an axle's X onto LDraw Z
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const at = (X, Y, Z, r = I3) => [X, Y, Z, ...r];
export const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
export const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
// A part turned a quarter about LDraw Y so its own Z (a brick's hole, a
// wheel's bore) runs along LDraw X — the frame's x, the selector's axis.
const Z_TO_X = [0, 0, 1, 0, 1, 0, -1, 0, 0];
// The catch hangs from its pivot: its X along the pivot (LDraw X), its Y along
// the stem (LDraw Z), its Z up (LDraw −Y). A proper rotation (det +1).
const CATCH_M = [1, 0, 0, 0, 0, -1, 0, 1, 0];
// The rack lies along the stem (LDraw Z), teeth up: its X along LDraw Z, its Y
// as LDraw Y, its Z across (LDraw −X). The detent's arm: its hole axis (its Y)
// along LDraw X, its length (its Z) along LDraw Z at rest. Both proper (det +1).
const RACK_M = [0, 0, -1, 0, 1, 0, 1, 0, 0];
const ARM_M = [0, 1, 0, -1, 0, 0, 0, 0, 1];

// LDraw colour codes the .ldr carries (the page draws by role instead). BUILT §300:
// this is the ONE colour-by-role declaration, and it is COMPLETE — every role any
// build places has a row, so none falls to 16 ("the placer's colour", which a
// picture-led parts list would show as one grey). BUILT §303 RE-PICKED it so that
// BrickLink lists an element for EVERY line (the constraint is per (part, colour): a
// colour is feasible for a role only if BrickLink sells every part the role places in
// it). It is no longer typed: `repickColours` (src/technic-colour.js) derives it from
// the placements and the BrickLink subset, starting from `COLOUR_BASELINE_300`, and
// `tools/probe-technic-bom.mjs` fails if this table differs from what it returns.
// A role's row is its default colour; a `role/part` row is an EXCEPTION for a part
// the default is not listed in (7785 is listed in White only, 7861 in Light Bluish
// Gray only, 69778 in Blue only). The design intent survives where BrickLink allows:
// the frame is grey (plates and bricks 71, Technic bricks 72, baseplate green 2),
// axles and cord black (0), pawls, catch, followers and pallets red (4), levers,
// masses and the great wheel yellow (14), a ratchet and a detent wheel apart, a crown
// and a hook white (15). Gears that are only gears stay grey (spur 71). Every code is a
// real LDraw colour (COLOUR_INFO, src/technic-bom.js); 321 (Dark Azure) is the one
// extension of the base ten, for the 20-tooth gear 69779 BrickLink lists in no other.
export const LDRAW_COLOUR = Object.freeze({
  // the frame (landing B)
  baseplate: 2, plate: 71, brick: 71, technicBrick: 72, axle: 0, spur: 71, doubleBevel: 14,
  // the keyless and motion works (landings D-G)
  joiner: 15, ring: 72, crown: 15, catch: 4, pinion: 14, rack: 72, tile: 15, detent: 1, arm: 25, follower: 4,
  // the fusee (landing H, §285)
  cord: 0, cordEnd: 0, barrel: 14, hook: 15, knob: 15, pulley: 71, click: 19, ratchet: 25, pawl: 4, great: 14, centre: 19,
  // the alarm (landing I, §288)
  lever: 14, pin: 1, rotor: 0, wheel: 1, driver: 25, stub: 0, pushTip: 4, collar: 4, button: 15, beam: 2, gear: 71,
  // the escapement (§287)
  knife: 72, mass: 14, pallet: 4,
  // exceptions: a part its role's colour is not listed for (BUILT §303)
  'axle/60485': 14, 'detent/7785': 15, 'spur/18946': 4, 'spur/69778': 1, 'spur/69779': 321 });

// The angle of one tooth of a gear part, in its own frame, about its Z axis:
// the surface points at the tip radius, folded by the tooth count. arg Σ e^{iNθ}
// over the tip points, over N, is the tooth phase whatever the tip land's width
// — and |Σ|/count near 1 says the tips really do repeat every 2π/N.
export function toothPhase(lib, part, N) {
  const pts = [];
  walk(lib, `${part}.dat`, (kind, ps) => { if (kind === 'tri') for (const p of ps) pts.push(p); });
  let rMax = 0;
  for (const [x, y] of pts) rMax = Math.max(rMax, Math.hypot(x, y));
  let c = 0, s = 0, n = 0;
  for (const [x, y] of pts) if (Math.hypot(x, y) > rMax - 1e-6) {
    const a = N * Math.atan2(y, x); c += Math.cos(a); s += Math.sin(a); n++;
  }
  return { theta: Math.atan2(s, c) / N, coherence: Math.hypot(c, s) / n, tipLDU: rMax };
}

const mod = (a, m) => ((a % m) + m) % m;

// §219 tier three (b) landing D — THE DOG LOCK. A clutch gear is locked to the
// ring by four lugs a side, so its angle on the stem is not free: the ring's
// lugs sit between the gear's. Each part's lug angle is read the way a tooth's
// is — its surface at the lugs' radius, folded by the lug count — the ring's
// lugs being its farthest surface past the flanges, the gear's its nearest
// surface inside the recess's outer wall. Returns the gear's turn relative to
// the ring that puts each ring lug MIDWAY between two gear lugs (the middle of
// the play; the parts allow it either way).
export function dogPhase(lib, ringPart = KEYLESS_PARTS.ring, gearPart = KEYLESS_PARTS.clutch, N = KEYLESS_DOGS) {
  const surf = (p) => { const pts = []; walk(lib, `${p}.dat`, (k, ps) => { if (k === 'tri' || k === 'quad') pts.push(...ps); }); return pts; };
  const fold = (pts) => {
    let c = 0, s = 0;
    for (const [x, y] of pts) { const a = N * Math.atan2(y, x); c += Math.cos(a); s += Math.sin(a); }
    return { theta: Math.atan2(s, c) / N, coherence: Math.hypot(c, s) / pts.length };
  };
  const r = (p) => Math.hypot(p[0], p[1]);
  const ring = surf(ringPart), gear = surf(gearPart);
  // the ring's lugs: its farthest surface on the END TUBE (beyond the flanges,
  // whose radius is the ring's overall farthest)
  const zFl = Math.max(...ring.filter((p) => r(p) > Math.max(...ring.map(r)) - 1e-3).map((p) => Math.abs(p[2])));
  const tube = ring.filter((p) => Math.abs(p[2]) > zFl + 1e-6);
  const rLug = Math.max(...tube.map(r));
  const ringLugs = fold(tube.filter((p) => r(p) > rLug - 1e-3));
  // the gear's lugs: inside its recess (off the web, short of the outer wall,
  // outside the hub) — the surface nearest the axis there that is not the hub
  const zMax = Math.max(...gear.map((p) => p[2]));
  const wallR = Math.max(...gear.filter((p) => p[2] > 2 + 1e-6 && p[2] < zMax - 1e-6).map(r).filter((v) => v < rLug + 2));
  const inRecess = gear.filter((p) => p[2] > 2 + 1e-6 && p[2] < zMax - 1e-6 && r(p) > rLug - 1 && r(p) < wallR - 1e-3);
  const rIn = Math.min(...inRecess.map(r));
  const gearLugs = fold(inRecess.filter((p) => r(p) < rIn + 1e-3));
  return { delta: mod(ringLugs.theta - gearLugs.theta + Math.PI / N, 2 * Math.PI / N), ringLugs, gearLugs, rLug, rIn };
}

// §219 tier three (b) landing E — THE CATCH IN THE RING'S FRAME. A part's
// SURFACE sampled (every triangle and quad subdivided to `step` LDU, so an
// edge's interior counts and not only its corners — the catch's bulb is one
// quad whose corners stand 10 LDU off the stem's line), then hung from the
// selector's pivot `rise` LDU above the ring's axis and turned θ about it.
// Returns, per sample, [a, r, x, h]: along the stem from the pivot's plane,
// distance from the ring's axis, across, and height above the axis.
const sampleCache = new Map();
// The same samples, STREAMED to `fn(x, y, z)` and kept nowhere: a reader of a
// whole library (tools/ldraw-groove-survey.mjs, through technic-fusee's
// grooveSeat) would otherwise hold a large wheel's millions of samples at once.
// The points and their order are surfaceSamples' exactly.
export function forEachSurfaceSample(lib, part, step, fn) {
  const tri = (A, B, C) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...B.map((v, i) => v - A[i])), Math.hypot(...C.map((v, i) => v - A[i]))) / step));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n, w = 1 - u - v;
      fn(w * A[0] + u * B[0] + v * C[0], w * A[1] + u * B[1] + v * C[1], w * A[2] + u * B[2] + v * C[2]);
    }
  };
  walk(lib, `${part}.dat`, (k, ps) => { if (k === 'tri') tri(...ps); else if (k === 'quad') { tri(ps[0], ps[1], ps[2]); tri(ps[0], ps[2], ps[3]); } });
}
export function surfaceSamples(lib, part, step = 0.5) {
  const key = `${part}@${step}`;
  if (sampleCache.has(key)) return sampleCache.get(key);
  const out = [];
  forEachSurfaceSample(lib, part, step, (x, y, z) => out.push([x, y, z]));
  sampleCache.set(key, out);
  return out;
}
export function catchInRingFrame(lib, theta, riseLDU, part = KEYLESS_PARTS.catch) {
  const pz = L(KEYLESS_SELECTOR_DIM_MM.catchPivot), c = Math.cos(theta), sn = Math.sin(theta);
  return surfaceSamples(lib, part).map(([qx, qy, qz]) => {
    // CATCH_M about the pivot: (qx, −(qz − pz), qy) in LDraw, then rotX(θ)
    const y = -(qz - pz), z = qy;
    const yr = c * y - sn * z, zr = sn * y + c * z;
    const h = -(yr - riseLDU);              // LDraw +Y is down: height above the ring's axis
    return [zr, Math.hypot(qx, h), qx, h];
  });
}
// THE RING'S POSITION FROM THE LEVER: the ring is wherever the catch's bulb
// holds it, so its axial position is the middle of the catch's surface that
// stands inside the ring's flanges. Monotone in θ over the stroke.
// Only the catch's surface FARTHER than rise − flange from the pivot can ever
// stand inside the flanges (its height over the axis is at least rise minus
// that distance), so the solve turns that part alone: the same answer, from a
// few hundred samples instead of two hundred thousand.
const bulbCache = new Map();
export function catchCentre(lib, theta, riseLDU) {
  const fl = L(KEYLESS_DIM_MM.ringR), key = `${riseLDU}`;
  if (!bulbCache.has(key)) {
    const pz = L(KEYLESS_SELECTOR_DIM_MM.catchPivot);
    bulbCache.set(key, surfaceSamples(lib, KEYLESS_PARTS.catch).filter(([, qy, qz]) => Math.hypot(qy, qz - pz) >= riseLDU - fl));
  }
  const pz = L(KEYLESS_SELECTOR_DIM_MM.catchPivot), c = Math.cos(theta), sn = Math.sin(theta);
  let lo = Infinity, hi = -Infinity;
  for (const [qx, qy, qz] of bulbCache.get(key)) {
    const y = -(qz - pz), z = qy, yr = c * y - sn * z, zr = sn * y + c * z, h = riseLDU - yr;
    if (Math.hypot(qx, h) < fl) { lo = Math.min(lo, zr); hi = Math.max(hi, zr); }
  }
  return lo <= hi ? (lo + hi) / 2 : NaN;
}
// The selector angle that holds the ring at `s` LDU: a bisection on catchCentre.
export function selectorAngle(lib, s, riseLDU) {
  if (s === 0) return 0;
  let lo = 0, hi = Math.PI / 4;
  const sg = Math.sign(s);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, c = catchCentre(lib, sg * mid, riseLDU);
    if (!(c * sg < Math.abs(s))) hi = mid; else lo = mid;
  }
  return sg * (lo + hi) / 2;
}

// §219 tier three (b) landing F — THE RACK'S TEETH, in the frame's (y, z)
// plane: the 2D profile every toothr primitive extrudes across the rack — a
// trapezoid 6 LDU wide at the root and 2 at the tip, 5 LDU tall, every 8 LDU
// along its toothed span — over a body below the root. (The −X end's boss is
// not drawn here: PULL holds the pinion to the toothed span, far from it.) Returns whether (y, z) mm is inside the
// rack whose tooth 0 stands at yc and whose mid-height is pitchZ.
export function inRack(y, z, yc, pitchZ) {
  const P = KEYLESS_PULL_DIM_MM;
  if (Math.abs(y - yc) > P.rackHalfLength) return false;
  const root = pitchZ - P.rackDedendum, tip = pitchZ + P.rackAddendum;
  if (z > tip) return false;
  if (z <= root) return z >= pitchZ - P.rackPitchToBottom;
  const k = Math.round((y - yc) / P.rackPitch);
  if (k * P.rackPitch < P.rackTeethLo - 1e-9 || k * P.rackPitch > P.rackTeethHi + 1e-9) return false;
  const t = (z - root) / (tip - root), half = (1.2 * (1 - t) + 0.4 * t);
  return Math.abs(y - yc - k * P.rackPitch) <= half;
}
// A gear's OUTLINE in its own plane: its sampled surface projected along its
// bore, kept outside half its tip radius (nothing nearer the bore can meet a
// rack) and deduplicated to a hundredth of an LDU — the 3D samples repeat each
// point once per face of the part's width.
const outlineCache = new Map();
export function gearOutline(lib, part) {
  if (outlineCache.has(part)) return outlineCache.get(part);
  const pts = surfaceSamples(lib, part);
  let tip = 0; for (const [x, y] of pts) tip = Math.max(tip, Math.hypot(x, y));
  const seen = new Set(), out = [];
  for (const [x, y] of pts) {
    if (Math.hypot(x, y) < tip / 2) continue;
    const k = `${Math.round(x * 100)},${Math.round(y * 100)}`;
    if (!seen.has(k)) { seen.add(k); out.push([x, y]); }
  }
  outlineCache.set(part, out);
  return out;
}
// That outline in the frame's (y, z) plane, its bore along x at (cy, cz) and
// turned φ about it the way rotX turns a body (LDraw +Y is down).
export function gearInYZ(lib, part, cy, cz, phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  return gearOutline(lib, part).map(([qx, qy]) => {
    const Y = qy, Z = -qx;                                 // Z_TO_X: the part's X to LDraw −Z, its Y to LDraw Y
    const Yr = c * Y - s * Z, Zr = s * Y + c * Z;          // rotX(φ)
    return [cy + Zr * LDU_MM, cz - Yr * LDU_MM];           // frame y = LDraw Z, frame z = −LDraw Y
  });
}
// A gear's TEETH in the frame's (y, z) plane, turned φ: its outline outside
// 2.5 mm under its tip (the band a rack or a follower can reach), cached per φ.
const bandCache = new Map();
function teethAt(lib, part, cy, cz, phi) {
  if (!bandCache.has(part)) {
    const o = gearOutline(lib, part);
    let tip = 0; for (const [x, y] of o) tip = Math.max(tip, Math.hypot(x, y));
    bandCache.set(part, o.filter(([x, y]) => Math.hypot(x, y) > tip - 2.5 / LDU_MM));
  }
  const c = Math.cos(phi), s = Math.sin(phi);
  return bandCache.get(part).map(([qx, qy]) => {
    const Y = qy, Z = -qx, Yr = c * Y - s * Z, Zr = s * Y + c * Z;   // as gearInYZ
    return [cy + Zr * LDU_MM, cz - Yr * LDU_MM];
  });
}

// §219 tier three (b) landing F — THE DETENT. The follower (a round half bush,
// radius R) rides the detent wheel on the selector axle, carried at the end of
// an arm about a pivot parallel to the axle; a band turns the arm in `sense`
// from where the follower stands farthest from the wheel's axis toward where it
// stands nearest, until it first touches a tooth. Returns the arm's angle ψ (the
// follower at pivot + arm·(cos ψ, sin ψ) in the frame's (y, z)) and the
// follower's distance from the wheel's axis — the height the band works against.
export function followerSeat(lib, det, wheelZ, theta) {
  const P = KEYLESS_PULL_DIM_MM, R = P.followerR, A = P.armHoles;
  // only the teeth the follower's path can reach: within R of the arm's circle
  const pts = teethAt(lib, det.wheel.part, 0, wheelZ, theta + det.wheel.mount * Math.PI / 180)
    .filter(([y, z]) => Math.abs(Math.hypot(y - det.pivot.y, z - det.pivot.z) - A) < R);
  const at = (psi) => [det.pivot.y + A * Math.cos(psi), det.pivot.z + A * Math.sin(psi)];
  const hits = (psi) => { const [y, z] = at(psi); return pts.some(([a, b]) => (a - y) ** 2 + (b - z) ** 2 < R * R); };
  const near = Math.atan2(wheelZ - det.pivot.z, -det.pivot.y), far = near + Math.PI;
  if (hits(far) || !hits(near)) return null;
  let hi = far, lo = far + det.sense * Math.PI;              // free, touching
  for (let i = 0; i < 40; i++) { const m = (hi + lo) / 2; if (hits(m)) lo = m; else hi = m; }
  const [y, z] = at(hi);
  return { psi: mod(hi + Math.PI, 2 * Math.PI) - Math.PI, d: Math.hypot(y, z - wheelZ) };
}
// The REST nearest θ0: where the follower stands nearest the wheel's axis — the
// bottom of the notch nearest θ0, found by sampling a tooth and a half around
// it (so a notch half a tooth away is still seen as one) and refining. A notch
// is a low point at least halfway down from the follower's highest (riding a
// tooth's tip it stands on a plateau, flat to the solve's noise, whose ripples
// are local minima too and are not notches).
export function detentRest(lib, det, wheelZ, theta0) {
  const step = 2 * Math.PI / det.wheel.teeth, n = 36, f = (t) => followerSeat(lib, det, wheelZ, t)?.d ?? Infinity;
  const ts = [], ds = [];
  for (let i = 0; i <= n; i++) { const t = theta0 - 0.75 * step + (1.5 * i * step) / n; ts.push(t); ds.push(f(t)); }
  const fin = ds.filter(Number.isFinite), lo = Math.min(...fin), hi = Math.max(...fin), deep = (lo + hi) / 2;
  let k = -1;
  for (let i = 1; i < n; i++) if (ds[i] <= ds[i - 1] && ds[i] <= ds[i + 1] && ds[i] < deep && (k < 0 || Math.abs(ts[i] - theta0) < Math.abs(ts[k] - theta0))) k = i;
  if (k < 0) return null;                                   // no notch near θ0
  let a = ts[k - 1], b = ts[k + 1];
  for (let i = 0; i < 32; i++) { const m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618; if (f(m1) < f(m2)) b = m2; else a = m1; }
  return (a + b) / 2;
}
// THE PINION'S BACKLASH against the rack at slide s: the selector angles either
// side of `guess` at which the pinion's teeth first enter the rack's.
export function pinionWindow(lib, sel, pull, rackYc, s, guess) {
  const hit = (th) => teethAt(lib, KEYLESS_PARTS.pinion, sel.y, sel.z, th).some(([y, z]) => inRack(y, z, rackYc + s, pull.pitchZ));
  if (hit(guess)) return null;
  const edge = (dir) => {
    let free = guess, far = guess;
    for (let k = 1; k < 200 && !hit(far); k++) { free = far; far = guess + dir * k * 0.002; }
    for (let i = 0; i < 40; i++) { const m = (free + far) / 2; if (hit(m)) far = m; else free = m; }
    return free;
  };
  return [edge(-1), edge(1)];
}
// The catch's hold on the ring at selector angle θ: the middle of its
// in-flange surface (where it centres the ring) and its PLAY — how far the ring
// may stand off that middle before a flange meets the bulb (LDU).
let grooveHalfLDU = null;
export function catchHold(lib, theta, riseLDU) {
  const fl = L(KEYLESS_DIM_MM.ringR);
  if (grooveHalfLDU === null) {
    grooveHalfLDU = Infinity;
    for (const [x, y, z] of surfaceSamples(lib, KEYLESS_PARTS.ring)) if (Math.hypot(x, y) > fl - 1e-3) grooveHalfLDU = Math.min(grooveHalfLDU, Math.abs(z));
  }
  let lo = Infinity, hi = -Infinity;
  for (const [a, r] of catchInRingFrame(lib, theta, riseLDU)) if (r < fl) { lo = Math.min(lo, a); hi = Math.max(hi, a); }
  return { centre: (lo + hi) / 2, play: grooveHalfLDU - (hi - lo) / 2 };
}

// The placements for one framed row. `phases` caches toothPhase per part.
export function ldrawBuild(frame, lib, phases = new Map()) {
  if (!frame.framed) throw new Error(`${frame.key} is not framed: ${frame.reason}`);
  const phase = (g) => {
    if (!phases.has(g.part)) phases.set(g.part, toothPhase(lib, g.part, g.teeth));
    return phases.get(g.part).theta;
  };
  // the baseplate: its studs sit at odd multiples of 10 LDU from its centre,
  // the frame's on multiples of 20, so its centre is the nearest 10 (mod 20)
  // to the middle of the base
  const midX = L((frame.base.x0 + frame.base.x1) / 2), midZ = L((frame.base.y0 + frame.base.y1) / 2);
  const snap = (v) => Math.round((v - 10) / 20) * 20 + 10;
  // the smallest baseplate that covers the frame (landing F's pull outgrows 16)
  const plate = Math.max(frame.base.studsX, frame.base.studsY) + 1 <= 16 ? FRAME_PARTS.baseplate16 : KEYLESS_PARTS.baseplate32;
  const statics = [{ role: 'baseplate', part: plate, m: at(snap(midX), 0, snap(midZ)) }];
  const roleOf = (p) => (p === FRAME_PARTS.technicBrick1x1 ? 'technicBrick' : p === FRAME_PARTS.brick1x1 ? 'brick' : p === KEYLESS_PARTS.tile ? 'tile' : 'plate');
  for (const c of frame.columns) for (const b of c.boxes)
    statics.push({ role: roleOf(b.part), part: b.part, m: at(L((b.x0 + b.x1) / 2), -L(b.z1), L((b.y0 + b.y1) / 2), b.turned ? Z_TO_X : I3) });

  // BODIES: one per frame shaft (its axle, its gears, its extras), plus one per
  // CLUTCH gear — a gear that idles on its shaft (the keyless stem's two) is
  // its own body on the same axis. Each body has an origin on its axis at the
  // frame's y = 0, turns about Z, and carries a speed per MODE.
  const modes = frame.modes ?? ['run'];
  const bodies = [], gearAt = new Map();   // `${shaft}.${gear}` → { body, part }
  for (const [i, s] of frame.shafts.entries()) {
    const origin = [L(s.x), -L(frame.axleZ), 0];
    const ax = frame.axles[i];
    const own = { origin, parts: [{ role: 'axle', part: ax.part, m: at(0, 0, L((ax.y0 + ax.y1) / 2), ROT_X_TO_Z) }], shaft: i };
    bodies.push(own);
    for (const e of s.extras ?? []) {
      if (!e.part) continue;   // a sweep-only section (the ring's tube), not a part
      const p = { role: e.role, part: e.part, m: at(0, 0, L(e.y)) };
      if (e.slides) p.slide = Object.fromEntries(modes.map((md) => [md, md === 'wind' ? L(e.slides) : md === 'set' ? -L(e.slides) : 0]));
      own.parts.push(p);
    }
    for (const [gi, g] of s.gears.entries()) {
      const part = { role: g.kind, part: g.part, teeth: g.teeth, m: at(0, 0, L(g.y)) };
      // landing G: the HOUR WHEEL idles on the minute axle the same way (a
      // round bore), its own body, turned only by the mesh that drives it
      if (g.clutch || g.idles) {
        bodies.push({ origin: g.idles ? [...origin] : origin, parts: [part], shaft: i, ...(g.clutch ? { clutch: g.clutch } : { idles: g.role ?? true }) });
        gearAt.set(`${i}.${gi}`, { body: bodies.length - 1, part, g });
      } else {
        own.parts.push(part);
        gearAt.set(`${i}.${gi}`, { body: bodies.indexOf(own), part, g });
      }
    }
  }
  // The input turns shaft 0 in every mode; a clutch body turns with it only in
  // its own mode (the ring is in its recess), and stands still otherwise.
  const MODE_OF = { winding: 'wind', setting: 'set' };
  for (const b of bodies) {
    b.speeds = Object.fromEntries(modes.map((md) => [md, b.shaft === 0 ? (b.clutch ? (MODE_OF[b.clutch] === md ? 1 : 0) : 1) : null]));
    b.phi = null;
  }
  // a clutch gear's angle is its dog lock on the ring, which turns with the stem
  // (both at their parts' own orientation, φ = 0): solved before the meshes,
  // so each branch is phased FROM it
  if (bodies.some((b) => b.clutch)) {
    const { delta } = dogPhase(lib);
    for (const b of bodies) if (b.clutch) b.phi = delta;
  }
  // PHASE AND SPEED travel the meshes in order: the driven body's φ is solved
  // so its gear meshes the driver's, measured from the LINE OF CENTRES (a
  // keyless branch leaves along −x as well as +x). A driver with no φ yet (the
  // first gear of a chain) is turned so a tooth lies on that line.
  const meshes = [];
  const frameMeshes = frame.meshes ?? frame.shafts.slice(1).map((_, k) => ({ a: [k, frame.shafts[k].gears.length - 1], b: [k + 1, 0] }));
  for (const m of frameMeshes) {
    const A = gearAt.get(`${m.a[0]}.${m.a[1]}`), Bg = gearAt.get(`${m.b[0]}.${m.b[1]}`);
    const da = bodies[A.body], db = bodies[Bg.body];
    const alpha = Math.atan2(db.origin[1] - da.origin[1], db.origin[0] - da.origin[0]);
    if (da.phi === null) da.phi = alpha - phase(A.g);
    const Aang = da.phi + phase(A.g);
    const Bang = alpha + Math.PI + (Math.PI - A.g.teeth * (Aang - alpha)) / Bg.g.teeth;
    db.phi = mod(Bang - phase(Bg.g), 2 * Math.PI / Bg.g.teeth);
    for (const md of modes) db.speeds[md] = -da.speeds[md] * A.g.teeth / Bg.g.teeth;
    meshes.push({ a: A.body, b: Bg.body, ga: da.parts.indexOf(A.part), gb: db.parts.indexOf(Bg.part), ...(m.branch ? { branch: m.branch } : {}) });
  }
  const shafts = bodies.map((b) => ({ origin: b.origin, phi: b.phi ?? 0, speed: b.speeds[modes[0]] ?? 0,
    ...(frame.modes ? { speeds: b.speeds } : {}), parts: b.parts, shaft: b.shaft, ...(b.clutch ? { clutch: b.clutch } : {}),
    ...(b.idles ? { idles: b.idles } : {}) }));
  // LANDING E — THE SELECTOR, a body turning about LDraw X by an angle per mode
  // (it does not follow the input). Landing E posed the angle that holds the
  // ring at its stroke end, solved off the catch's own surface; landing F's
  // detent decides it instead (a frame with a `pull`). Either way the ring's
  // slide READS the angle back through the same catch, so the ring is where
  // the lever puts it rather than where a table says.
  const sel = frame.selector;
  let pullOut = null;
  if (sel) {
    const rise = L(sel.rise), travel = L(frame.ringTravel);
    // (landing E's posed angles; a pull replaces them with the detent's rests)
    let pose = frame.pull ? null : { wind: selectorAngle(lib, travel, rise), set: selectorAngle(lib, -travel, rise), neutral: 0 };
    const parts = [
      { role: 'axle', part: sel.axle.part, m: at(L((sel.axle.x0 + sel.axle.x1) / 2), 0, 0) },
      { role: 'catch', part: KEYLESS_PARTS.catch, m: at(L(sel.catchX), L(KEYLESS_SELECTOR_DIM_MM.catchPivot), 0, CATCH_M) },
    ];
    const pl = frame.pull;
    const hold = {};
    if (pl) {
      // LANDING F — THE DETENT DECIDES THE MODES, THE RACK DRIVES THEM. Each
      // mode is a rest of the follower on the detent wheel: the notch's bottom
      // nearest neutral, and one wheel tooth either way (wind is +, the way the
      // catch carries the ring toward the winding gear). Measured, not assumed:
      // each rest is found on its own.
      const det = pl.detent, step = 2 * Math.PI / det.wheel.teeth;
      const K0 = { neutral: 0, wind: 1, set: -1 };
      const rest = Object.fromEntries(modes.map((md) => [md, detentRest(lib, det, sel.z, K0[md] * step)]));
      if (modes.some((md) => rest[md] === null)) throw new Error(`${frame.gen}: the follower finds no notch on the detent wheel`);
      pose = rest;
      const mul3 = (A, B) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]));
      parts.push({ role: 'pinion', part: KEYLESS_PARTS.pinion, teeth: PULL_PINION_TEETH, m: at(L(sel.pinionX), 0, 0, Z_TO_X) });
      parts.push({ role: 'detent', part: det.wheel.part, teeth: det.wheel.teeth, m: at(L(det.wheel.x), 0, 0, mul3(rotX(det.wheel.mount * Math.PI / 180), Z_TO_X)) });
      // THE RACK meshes the pinion where it is: a pinion GAP at its lowest
      // point, read off the part's own tooth phase, a rack tooth under it —
      // then moved so the pinion stands in the MIDDLE of its measured backlash
      // at neutral. It rolls tooth for tooth (one rack pitch per pinion tooth),
      // so a selector angle θ is the rack at θ·N·pitch/2π.
      const N = PULL_PINION_TEETH, P = KEYLESS_PULL_DIM_MM, r = N / 2;
      const ph = toothPhase(lib, KEYLESS_PARTS.pinion, N).theta;
      // Z_TO_X sends the part's point at angle α to frame y = −r·cos α, so its
      // lowest point is α = π/2 and a point δ past it stands at y = r·sin δ; a
      // gap is half a pitch past a tooth
      const gap = ph + Math.PI / N, kq = Math.round((Math.PI / 2 - gap) / (2 * Math.PI / N));
      const delta = mod(gap + kq * 2 * Math.PI / N - Math.PI / 2 + Math.PI, 2 * Math.PI) - Math.PI;
      const yGap = r * Math.sin(delta);
      const rEff = N * P.rackPitch / (2 * Math.PI);
      let yc = yGap + P.rackPitch * Math.round((pl.y - yGap) / P.rackPitch);
      const w0 = pinionWindow(lib, sel, pl, yc, 0, 0);
      if (!w0) throw new Error(`${frame.gen}: the pinion stands in the rack's teeth`);
      yc -= ((w0[0] + w0[1]) / 2) * rEff;
      const rackS = Object.fromEntries(modes.map((md) => [md, rest[md] * rEff]));
      const rackOriginZ = pl.bottom + (P.rackPitchToBottom - 10);   // the rack's datum is 25 LDU under its mid-height
      shafts.push({ origin: [L(pl.x), -L(rackOriginZ), L(yc)], phi: 0, speed: 0, shaft: 'rack', slider: true,
        parts: [{ role: 'rack', part: KEYLESS_PARTS.rack, m: at(0, 0, 0, RACK_M), slide: Object.fromEntries(modes.map((md) => [md, L(rackS[md])])) }] });
      // THE FOLLOWER on its arm, seated at each rest (the band's force is
      // posed: nothing here measures it)
      const seat = Object.fromEntries(modes.map((md) => [md, followerSeat(lib, det, sel.z, rest[md])]));
      const ax = Object.keys(AXLE_PARTS).map(Number).sort((a, b) => a - b);
      const pivLen = ax.find((n) => n * 8 >= det.pivot.x1 - det.pivot.x0), fLen = ax.find((n) => n * 8 >= det.follower.axleX1 - det.follower.axleX0);
      shafts.push({ origin: [0, -L(det.pivot.z), L(det.pivot.y)], axis: 'x', phi: 0, speed: 0, shaft: 'detent',
        pose: Object.fromEntries(modes.map((md) => [md, seat[md].psi])),   // rotX by ψ puts the arm's far hole at the pivot + 16 mm·(cos ψ, sin ψ) in frame (y, z)
        parts: [
          { role: 'axle', part: AXLE_PARTS[pivLen], m: at(L(det.pivot.x0 + pivLen * 4), 0, 0) },
          { role: 'arm', part: KEYLESS_PARTS.detentArm, m: at(L(det.arm.x), 0, 0, ARM_M) },
          // the follower and its axle ride the arm's far hole, off the pivot's line
          { role: 'axle', part: AXLE_PARTS[fLen], m: at(L(det.follower.axleX0 + fLen * 4), 0, L(P.armHoles)), offLine: true },
          { role: 'follower', part: KEYLESS_PARTS.follower, m: at(L(det.follower.x), 0, L(P.armHoles), Z_TO_X), offLine: true },
        ] });
      pullOut = { rackYc: yc, pitchZ: pl.pitchZ, rEff, rackS, rest, seat, backlash0: w0 };
    }
    shafts.push({ origin: [0, -L(sel.z), L(sel.y)], axis: 'x', phi: 0, speed: 0, pose, parts, shaft: 'selector' });
    // THE RING. Driven into wind or set, it is PUSHED by the bulb's leading
    // side, so it runs ahead of the bulb's middle by up to the catch's play —
    // and the web stops it. It stands on the web when the web lies within the
    // play of the bulb's middle either way (short of it, the push carries it
    // there; past it, the bulb has room behind); otherwise it is left at the
    // middle, for STROKE to fail. At neutral it is posed at the middle: which
    // side of the play it lies on depends on the mode it came from.
    const SIDE = { wind: 1, set: -1, neutral: 0 };
    for (const md of modes) {
      const h = catchHold(lib, pose[md], rise), end = SIDE[md] * travel;
      hold[md] = { ...h, slide: SIDE[md] && Math.abs(h.centre - end) <= h.play ? end : h.centre };
    }
    for (const sh of shafts) for (const p of sh.parts) if (p.slide && sh.shaft === 0)
      for (const md of modes) p.slide[md] = pl ? hold[md].slide : md === 'neutral' ? 0 : Math.max(-travel, Math.min(travel, hold[md].centre));
    if (pullOut) pullOut.hold = hold;
  }
  return { key: frame.key, gen: frame.gen, statics, shafts, meshes, modes, ...(pullOut ? { pull: pullOut } : {}) };
}

const fmt = (v) => String(Math.round(v * 1e4) / 1e4);
const compose3 = (A, m) => {  // A: 3×3 rotation (row-major), m: [x y z a..i]
  const r = (i, j) => A[i * 3] * m[3 + j] + A[i * 3 + 1] * m[6 + j] + A[i * 3 + 2] * m[9 + j];
  const p = [0, 1, 2].map((i) => A[i * 3] * m[0] + A[i * 3 + 1] * m[1] + A[i * 3 + 2] * m[2]);
  return [...p, r(0, 0), r(0, 1), r(0, 2), r(1, 0), r(1, 1), r(1, 2), r(2, 0), r(2, 1), r(2, 2)];
};
// Every placement in the build's world frame at an input angle (radians of
// shaft 0): statics as they are, each shaft's parts turned by φ + speed·input.
// `mode` (a keyless build's wind, set or neutral) picks each body's speed and
// slides the ring along its axis; a row has one mode and ignores it.
export function placedParts(build, input = 0, mode = build.modes?.[0]) {
  const out = build.statics.map((p) => ({ ...p }));
  for (const s of build.shafts) {
    const R = s.axis === 'x' ? rotX(s.phi + (s.pose?.[mode] ?? 0))
      : rotZ(s.phi + (s.speeds && mode in s.speeds ? s.speeds[mode] : s.speed) * input);
    for (const p of s.parts) {
      const m = compose3(R, p.m);
      out.push({ ...p, m: [m[0] + s.origin[0], m[1] + s.origin[1], m[2] + s.origin[2] + (p.slide?.[mode] ?? 0), ...m.slice(3)] });
    }
  }
  return out;
}

// The model file: one line-type-1 per part, colour by role, at rest.
export function toLdr(build, input = 0, mode = build.modes?.[0]) {
  const lines = [`0 timesim technic fork — ${build.gen} ${build.key}${build.modes?.length > 1 ? ` (${mode})` : ''}`, `0 Name: ${build.gen}-${build.key.replace(/\W+/g, '-')}.ldr`,
    '0 Author: tools/technic-ldraw.mjs (generated from src/technic-frame.js)', '0 !LICENSE parts: LDraw.org, CC BY 4.0', ''];
  for (const p of placedParts(build, input, mode))
    lines.push(`1 ${colourOf(LDRAW_COLOUR, p.role, p.part) ?? 16} ${p.m.map(fmt).join(' ')} ${p.part}.dat`);
  return lines.join('\n') + '\n';
}
