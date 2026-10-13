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
import { FRAME_PARTS } from './technic-frame.js';

const L = (mm) => mm / LDU_MM;
const ROT_X_TO_Z = [0, 0, -1, 0, 1, 0, 1, 0, 0];   // an axle's X onto LDraw Z
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const at = (X, Y, Z, r = I3) => [X, Y, Z, ...r];
export const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];

// LDraw colour codes the .ldr carries (the page draws by role instead).
export const LDRAW_COLOUR = Object.freeze({ baseplate: 2, plate: 71, brick: 71, technicBrick: 72, axle: 0, spur: 71, doubleBevel: 19 });

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
    statics.push({ role: roleOf(b.part), part: b.part, m: at(L((b.x0 + b.x1) / 2), -L(b.z1), L((b.y0 + b.y1) / 2)) });

  // shafts: origin on the axle's line at the frame's y = 0, turning about Z
  const shafts = [];
  let speed = 1;
  for (const [i, s] of frame.shafts.entries()) {
    const ax = frame.axles[i];
    const parts = [{ role: 'axle', part: ax.part, m: at(0, 0, L((ax.y0 + ax.y1) / 2), ROT_X_TO_Z) }];
    for (const g of s.gears) parts.push({ role: g.kind, part: g.part, teeth: g.teeth, m: at(0, 0, L(g.y)) });
    let phi = 0;
    if (i === 0) {
      // the driver's tooth on the line of centres, pointing at shaft 1
      const d = s.gears[s.gears.length - 1];
      phi = -phase(d);
    } else {
      const prev = shafts[i - 1], a = frame.shafts[i - 1].gears.at(-1), b = s.gears[0];
      const A = prev.phi + phase(a);
      const B = Math.PI + (Math.PI - a.teeth * A) / b.teeth;
      phi = mod(B - phase(b), 2 * Math.PI / b.teeth);
      speed = -prev.speed * a.teeth / b.teeth;
    }
    shafts.push({ origin: [L(s.x), -L(frame.axleZ), 0], phi, speed, parts });
  }
  return { key: frame.key, gen: frame.gen, statics, shafts };
}

const fmt = (v) => String(Math.round(v * 1e4) / 1e4);
const compose3 = (A, m) => {  // A: 3×3 rotation (row-major), m: [x y z a..i]
  const r = (i, j) => A[i * 3] * m[3 + j] + A[i * 3 + 1] * m[6 + j] + A[i * 3 + 2] * m[9 + j];
  const p = [0, 1, 2].map((i) => A[i * 3] * m[0] + A[i * 3 + 1] * m[1] + A[i * 3 + 2] * m[2]);
  return [...p, r(0, 0), r(0, 1), r(0, 2), r(1, 0), r(1, 1), r(1, 2), r(2, 0), r(2, 1), r(2, 2)];
};
// Every placement in the build's world frame at an input angle (radians of
// shaft 0): statics as they are, each shaft's parts turned by φ + speed·input.
export function placedParts(build, input = 0) {
  const out = build.statics.map((p) => ({ ...p }));
  for (const s of build.shafts) {
    const R = rotZ(s.phi + s.speed * input);
    for (const p of s.parts) {
      const m = compose3(R, p.m);
      out.push({ ...p, m: [m[0] + s.origin[0], m[1] + s.origin[1], m[2] + s.origin[2], ...m.slice(3)] });
    }
  }
  return out;
}

// The model file: one line-type-1 per part, colour by role, at rest.
export function toLdr(build, input = 0) {
  const lines = [`0 timesim technic fork — ${build.gen} ${build.key}`, `0 Name: ${build.gen}-${build.key.replace(/\W+/g, '-')}.ldr`,
    '0 Author: tools/technic-ldraw.mjs (generated from src/technic-frame.js)', '0 !LICENSE parts: LDraw.org, CC BY 4.0', ''];
  for (const p of placedParts(build, input))
    lines.push(`1 ${LDRAW_COLOUR[p.role] ?? 16} ${p.m.map(fmt).join(' ')} ${p.part}.dat`);
  return lines.join('\n') + '\n';
}
