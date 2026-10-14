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
import { FRAME_PARTS, KEYLESS_PARTS, KEYLESS_DOGS, KEYLESS_DIM_MM, KEYLESS_SELECTOR_DIM_MM } from './technic-frame.js';

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

// LDraw colour codes the .ldr carries (the page draws by role instead).
export const LDRAW_COLOUR = Object.freeze({ baseplate: 2, plate: 71, brick: 71, technicBrick: 72, axle: 0, spur: 71, doubleBevel: 19,
  joiner: 0, ring: 72, crown: 15, catch: 4, knob: 14 });

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
export function surfaceSamples(lib, part, step = 0.5) {
  const key = `${part}@${step}`;
  if (sampleCache.has(key)) return sampleCache.get(key);
  const out = [];
  const tri = (A, B, C) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...B.map((v, i) => v - A[i])), Math.hypot(...C.map((v, i) => v - A[i]))) / step));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n, w = 1 - u - v;
      out.push([0, 1, 2].map((k) => w * A[k] + u * B[k] + v * C[k]));
    }
  };
  walk(lib, `${part}.dat`, (k, ps) => { if (k === 'tri') tri(...ps); else if (k === 'quad') { tri(ps[0], ps[1], ps[2]); tri(ps[0], ps[2], ps[3]); } });
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
  const statics = [{ role: 'baseplate', part: FRAME_PARTS.baseplate16, m: at(snap(midX), 0, snap(midZ)) }];
  const roleOf = (p) => (p === FRAME_PARTS.technicBrick1x1 ? 'technicBrick' : p === FRAME_PARTS.brick1x1 ? 'brick' : 'plate');
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
      if (g.clutch) {
        bodies.push({ origin, parts: [part], shaft: i, clutch: g.clutch });
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
    meshes.push({ a: A.body, b: Bg.body, ga: da.parts.indexOf(A.part), gb: db.parts.indexOf(Bg.part) });
  }
  const shafts = bodies.map((b) => ({ origin: b.origin, phi: b.phi ?? 0, speed: b.speeds[modes[0]] ?? 0,
    ...(frame.modes ? { speeds: b.speeds } : {}), parts: b.parts, shaft: b.shaft, ...(b.clutch ? { clutch: b.clutch } : {}) }));
  // LANDING E — THE SELECTOR, a body turning about LDraw X by a POSED angle per
  // mode (it does not follow the input): the angle that holds the ring at its
  // stroke end, solved off the catch's own surface. The ring's slide then READS
  // that angle back through the same catch (catchCentre), so the ring is where
  // the lever puts it rather than where a table says.
  const sel = frame.selector;
  if (sel) {
    const rise = L(sel.rise), travel = L(frame.ringTravel);
    const pose = { wind: selectorAngle(lib, travel, rise), set: selectorAngle(lib, -travel, rise), neutral: 0 };
    const parts = [
      { role: 'axle', part: sel.axle.part, m: at(L((sel.axle.x0 + sel.axle.x1) / 2), 0, 0) },
      { role: 'catch', part: KEYLESS_PARTS.catch, m: at(L(sel.catchX), L(KEYLESS_SELECTOR_DIM_MM.catchPivot), 0, CATCH_M) },
      { role: 'knob', part: KEYLESS_PARTS.knob, m: at(L(sel.knobX), 0, 0, Z_TO_X) },
    ];
    shafts.push({ origin: [0, -L(sel.z), L(sel.y)], axis: 'x', phi: 0, speed: 0, pose, parts, shaft: 'selector' });
    for (const sh of shafts) for (const p of sh.parts) if (p.slide)
      for (const md of modes) p.slide[md] = md === 'neutral' ? 0 : catchCentre(lib, pose[md], rise);
  }
  return { key: frame.key, gen: frame.gen, statics, shafts, meshes, modes };
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
    lines.push(`1 ${LDRAW_COLOUR[p.role] ?? 16} ${p.m.map(fmt).join(' ')} ${p.part}.dat`);
  return lines.join('\n') + '\n';
}
