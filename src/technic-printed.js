// §345 — PRINTED PARTS for the LEGO going train, landing 0: the CALIBRATION PRINTS.
//
// The hybrid route (the private roadmap's §345): print only what LEGO cannot supply, first a Graham pallet whose lock
// arcs are centred on the knife's apex. Nothing printed may be quoted until the printer has been MEASURED, so this
// landing generates three test pieces and holds the table their readings go into:
//
//   · THE FIT STRIP — cross holes cut to the LEGO axle's section as the vendored part draws it (3705, measured here,
//     never typed), each one clearance step wider than the last. The owner reports the first that takes an axle with
//     no play: that clearance is the one every printed bore uses.
//   · THE RING — its bore is the leading layout's lock radius (a drawn Graham about the pivot on the 8T, 3.5 pitches
//     between its locks: §345's scope measured it the only straddle that escapes at the 2–4° the LEGO drive reaches),
//     its wall the material that layout allows behind each face. Calipers inside and out read the print's error on a
//     concave face and on a convex one, at the radius the pallet will carry; the scale reads its density.
//   · THE RAMP — a plate printed standing on its long edge, so its big face is layer lines like a pallet's lock face,
//     and a sled of the build's own parts riding on 8T tooth tips. The angle it starts to slide at is μ = tan θ for
//     a LEGO tooth on printed PLA, the lock's rest friction.
//
// Every mesh is an extruded outline built here (no three.js: the probes are pure Node), closed and manifold, and
// written as binary STL. `tools/printed-stl.mjs` writes the files; `tools/probe-technic-printed.mjs` holds them.
// MODELLED: these are test pieces, and no reading below exists until the owner prints them (PRINT_MEASURED).

import { walk, LDU_MM } from './ldraw.js';
import { LEGO_DIM_MM } from './technic-frame.js';
import { drawnGraham } from './technic-deadbeat.js';

// THE PRINTER, as the owner gave it (2026-11-14): a 0.4 mm nozzle, glossy PLA in white, black, orange and grey.
// WHITE is the printed parts' colour: the pallet sits on the build's black crossbar beside its orange arms and locks
// against the light-grey 8T, and the grey filament would read as that wheel. μ and the fit are properties of the
// filament, so every reading below is taken on the white spool the parts will be printed from.
export const PRINT_SETUP = Object.freeze({
  nozzle: 0.4, material: 'PLA (glossy)', colour: 'white', source: 'owner, 2026-11-14',
  infill: 1,                // 100%: the balance reads the part's mass off its solid (or off the scale)
  layer: 0.12,              // the finest common 0.4 mm-nozzle layer; the lock face is perimeters, so the layer sets the
                            // face's ridge pitch along the sliding direction, not the outline's accuracy
});
// The thinnest wall a printed part may carry: two perimeters of the nozzle's line.
export const WALL_MIN = 2 * PRINT_SETUP.nozzle;

// THE AXLE'S SECTION, read off the vendored 3705: its arms' half-width and the radius their ends are cut to. LDraw's
// axle is the reference the build is measured on; a real axle may differ from it, which is what the fit strip absorbs.
export function axleSection(lib, part = '3705') {
  const pts = [];
  walk(lib, `${part}.dat`, (k, ps) => { if (k === 'tri' || k === 'quad') for (const p of ps) pts.push(p); });
  const ext = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])) - Math.min(...pts.map((p) => p[i])));
  const ax = ext.indexOf(Math.max(...ext)), [a, b] = [0, 1, 2].filter((i) => i !== ax);
  const r = Math.max(...pts.map((p) => Math.hypot(p[a], p[b])));
  // the arm's flank: the largest |minor coordinate| over the points well out along an arm (beyond the hub)
  let half = 0;
  for (const p of pts) {
    const u = Math.abs(p[a]), v = Math.abs(p[b]), lo = Math.min(u, v), hi = Math.max(u, v);
    if (hi > 0.75 * r && lo < 0.5 * r) half = Math.max(half, lo);
  }
  return { part, r: r * LDU_MM, halfArm: half * LDU_MM, axis: ax };
}

// A CROSS HOLE's outline (mm, counter-clockwise), the axle's section grown by `c` on every face: arm flanks at
// halfArm + c, arm ends on the circle r + c. `n` points per arm end.
export function crossHole(sec, c, { n = 6, at = [0, 0] } = {}) {
  const h = sec.halfArm + c, R = sec.r + c, out = [];
  for (let k = 0; k < 4; k++) {
    const th = k * Math.PI / 2, e = Math.asin(h / R);
    for (let i = 0; i <= n; i++) {                      // the arm's end, flank to flank
      const a = th - e + (2 * e * i) / n;
      out.push([R * Math.cos(a), R * Math.sin(a)]);
    }
    const t2 = th + Math.PI / 4, d = h * Math.SQRT2;    // the re-entrant corner between this arm and the next
    out.push([d * Math.cos(t2), d * Math.sin(t2)]);
  }
  return out.map(([x, y]) => [x + at[0], y + at[1]]);
}

// ── the extruder. A cell (a square with one hole) is triangulated by EAR CLIPPING the polygon its hole is spliced
// into by a BRIDGE: from the hole's farthest point along +x (its +x arm's end, on the hole's own axis) straight to the
// cell's right edge. Every cell carries the midpoints of both its vertical edges, so the bridge has a vertex to land
// on and two cells sharing an edge meet there vertex for vertex (no T-junction: the strip stays manifold). A fan
// stitched by angle was tried first and cut across the cross's re-entrant corners; the probe's winding check found it.
const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const same = (p, q) => p[0] === q[0] && p[1] === q[1];
function earClip(poly) {
  const V = poly.slice(), tris = [];
  let guard = 0;
  while (V.length > 3 && guard++ < 100000) {
    let cut = false;
    for (let i = 0; i < V.length; i++) {
      const a = V[(i + V.length - 1) % V.length], b = V[i], c = V[(i + 1) % V.length];
      if (cross2(a, b, c) <= 1e-12) continue;                               // reflex or flat: not an ear
      let inside = false;
      for (const p of V) {
        if (same(p, a) || same(p, b) || same(p, c)) continue;
        if (cross2(a, b, p) >= 0 && cross2(b, c, p) >= 0 && cross2(c, a, p) >= 0) { inside = true; break; }
      }
      if (inside) continue;
      tris.push([a, b, c]); V.splice(i, 1); cut = true; break;
    }
    if (!cut) throw new Error(`earClip: no ear among ${V.length} vertices`);
  }
  if (V.length === 3) tris.push([V[0], V[1], V[2]]);
  return tris;
}
// outer CCW with a vertex at `land`; hole CCW (it is spliced in reverse) with a vertex at `from`
function cellTris(outer, hole, from, land) {
  const io = outer.findIndex((p) => same(p, land)), ih = hole.findIndex((p) => same(p, from));
  if (io < 0 || ih < 0) throw new Error('cellTris: the bridge has no vertex to land on');
  const H = hole.slice(ih).concat(hole.slice(0, ih)).reverse();           // CW, ending at `from`
  H.unshift(H.pop());                                                      // CW, starting at `from`
  const poly = [...outer.slice(0, io + 1), ...H, H[0], ...outer.slice(io)];
  return earClip(poly);
}

// THE RING: an annulus of two n-gons on the same angles, stitched quad by quad.
function annulus(outer, inner) {
  const tris = [], n = outer.length;
  for (let i = 0; i < n; i++) {
    const a = outer[i], b = outer[(i + 1) % n], c = inner[(i + 1) % n], d = inner[i];
    tris.push([a, b, c], [a, c, d]);
  }
  return tris;
}
// One prism: caps from `tris` (CCW from +z) at z = 0 and z = h, walls along the given directed edges (outer CCW,
// inner rings CW so the walls face out of the solid).
function prism(tris, walls, h) {
  const T = [];
  for (const [a, b, c] of tris) {
    T.push([[...a, h], [...b, h], [...c, h]]);
    T.push([[...a, 0], [...c, 0], [...b, 0]]);
  }
  for (const [p, q] of walls) {
    T.push([[...p, 0], [...q, 0], [...q, h]]);
    T.push([[...p, 0], [...q, h], [...p, h]]);
  }
  return T;
}
const ringEdges = (r, reverse = false) => {
  const e = r.map((p, i) => [p, r[(i + 1) % r.length]]);
  return reverse ? e.map(([p, q]) => [q, p]) : e;
};
const circle = (R, n, c = [0, 0]) => Array.from({ length: n }, (_, i) => [c[0] + R * Math.cos((2 * Math.PI * i) / n), c[1] + R * Math.sin((2 * Math.PI * i) / n)]);

// THE CLEARANCE STEPS. Holes print small on an FDM printer by up to about half a line width (0.2 mm at 0.4); the LDraw
// arm may also be narrower than a moulded one. So the strip starts at the drawn section (0) and steps by
// CLEAR_STEP until it brackets both: one more step than the larger of the two allowances. If the owner's hole is
// the last one, the bracket was too narrow and the strip is reprinted further out, never extrapolated.
export const CLEAR_STEP = 0.05;
export const CLEAR_STEPS = Object.freeze(Array.from({ length: 8 }, (_, i) => +(i * CLEAR_STEP).toFixed(2)));

// THE FIT STRIP: one cell per step on the stud pitch (holes 8 mm apart, as a liftarm's are), a cell's width the
// pitch, its thickness one layer of the build (the gear face the pallet will be as thick as). A V notch in the outer
// end of the FIRST cell marks the tightest hole, so "the third from the notch" names a clearance.
export function fitStrip(sec, { steps = CLEAR_STEPS, pitch = LEGO_DIM_MM.stud, h = LEGO_DIM_MM.layer, notch: notchAt = null } = {}) {
  const T = [], half = pitch / 2, holes = [];
  let area = 0;
  // the notch's depth: as deep as the first cell leaves, keeping WALL_MIN between its tip and the tightest hole (a
  // right-angled V, so its half-height is its depth)
  const notch = notchAt ?? half - (sec.r + steps[0]) - WALL_MIN;
  steps.forEach((c, k) => {
    const cx = k * pitch, C = [cx, 0];
    const hole = crossHole(sec, c, { at: C });
    holes.push({ c, centre: C, ring: hole });
    // the cell's outer ring, CCW: corners, plus the notch on the strip's outer end (cell 0's left edge)
    const outer = [[cx - half, -half], [cx + half, -half], [cx + half, 0], [cx + half, half], [cx - half, half]];
    if (k === 0) outer.push([cx - half, notch], [cx - half + notch, 0], [cx - half, -notch]);
    else outer.push([cx - half, 0]);
    area += polyArea(outer) - polyArea(hole);
    const tip = hole.reduce((m, p) => (p[0] > m[0] ? p : m));               // the +x arm's end, on the axis
    const tris = cellTris(outer, hole, tip, [cx + half, 0]);
    const walls = [];
    for (const [p, q] of ringEdges(outer)) {
      const shared = (k > 0 && p[0] === cx - half && q[0] === cx - half) || (k < steps.length - 1 && p[0] === cx + half && q[0] === cx + half);
      if (!shared) walls.push([p, q]);
    }
    walls.push(...ringEdges(hole, true));
    T.push(...prism(tris, walls, h));
  });
  return { name: 'coupon-fit', tris: T, holes, pitch, h, area, notch };
}

// THE RING: bore 2R, R the leading layout's lock radius (drawnGraham on the 8T about the pivot, 3.5 pitches between
// the locks); wall `w`, the most material behind a face that layout was seen to escape with (8 mm, §345's scope);
// height one layer. `n` sides: the chord's sagitta R(1 − cos(π/n)) under a tenth of the nozzle, so the facets are
// far below what the printer resolves.
export function ringRadius(lib) { return drawnGraham(lib, '3647', 8, 3, { centre: [0, 0] }).R; }
export const RING_WALL = 8;
export function couponRing(lib, { w = RING_WALL, h = LEGO_DIM_MM.layer } = {}) {
  const R = ringRadius(lib), Ro = R + w;
  let n = 8;
  while (Ro * (1 - Math.cos(Math.PI / n)) > PRINT_SETUP.nozzle / 10) n *= 2;
  const outer = circle(Ro, n), inner = circle(R, n);
  const tris = annulus(outer, inner);
  const T = prism(tris, [...ringEdges(outer), ...ringEdges(inner, true)], h);
  return { name: 'coupon-ring', tris: T, R, Ro, h, n, area: polyArea(outer) - polyArea(inner) };
}

// THE RAMP: a plate 100 × 30 × 4 mm, exported STANDING on its long edge (z up the 30), so its two big faces print as
// perimeters, the lock face's texture, and the sled slides ALONG the layer lines as a tooth slides along a pallet.
// These three are a jig's, chosen for handling, not derived: four sled lengths of run, a face wider than the sled,
// and thick enough not to flex standing up.
export const RAMP = Object.freeze({ L: 100, H: 30, T: 4 });
export function couponRamp({ L = RAMP.L, H = RAMP.H, T: t = RAMP.T } = {}) {
  const outer = [[0, 0], [L, 0], [L, t], [0, t]], c = [L / 2, t / 2];
  // a box: its footprint is the plate's thickness × length on the bed, extruded H up
  const tris = [[outer[0], outer[1], outer[2]], [outer[0], outer[2], outer[3]]];
  return { name: 'coupon-ramp', tris: prism(tris, ringEdges(outer), H), area: L * t, h: H, centre: c };
}

// The SLED the ramp is read with, the build's own parts (none printed): two thin liftarms (6632) whose end holes
// are cross holes, two 3L axles (4519) keyed through both, and an 8T (3647) on each axle beside each liftarm — four
// gears that cannot turn, so the sled SLIDES on its tooth tips. A pure parts list: it is never placed or measured here.
export const SLED_PARTS = Object.freeze([{ part: '6632', qty: 2 }, { part: '4519', qty: 2 }, { part: '3647', qty: 4 }]);

// THE READINGS, empty until the owner prints and measures (each row its date and printer when it arrives). A printed
// dimension is never quoted while its row is null.
export const PRINT_MEASURED = Object.freeze({
  status: 'AWAITING',
  fit: null,                // { steps from the notch, c mm }: the first hole that takes a 3705 with no play
  ring: null,               // { boreMm, outsideMm, massG }: calipers inside and out, the scale
  slide: null,              // { startDeg: [..], keepDeg: [..] }: three runs each, the start and the nudged-and-keeps-going angles
});

// ── geometry readers, and the STL
export function polyArea(r) { let s = 0; for (let i = 0; i < r.length; i++) { const [x0, y0] = r[i], [x1, y1] = r[(i + 1) % r.length]; s += x0 * y1 - x1 * y0; } return s / 2; }
export function meshVolume(T) {
  let v = 0;
  for (const [a, b, c] of T) v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  return v;
}
// CLOSED and MANIFOLD: every directed edge appears once and its reverse once (so each undirected edge borders exactly
// two triangles, consistently wound). Returns the first offence, or null.
export function manifoldFault(T) {
  const key = (p) => p.map((x) => x.toFixed(9)).join(',');
  const dir = new Map();
  for (const t of T) for (let i = 0; i < 3; i++) {
    const e = `${key(t[i])}>${key(t[(i + 1) % 3])}`;
    dir.set(e, (dir.get(e) ?? 0) + 1);
  }
  for (const [e, n] of dir) {
    if (n !== 1) return `edge ${e} used ${n} times in one direction`;
    const [p, q] = e.split('>');
    if (dir.get(`${q}>${p}`) !== 1) return `edge ${e} has no reverse`;
  }
  return null;
}
export function stlBinary(T, name = 'timesim') {
  const buf = new ArrayBuffer(84 + 50 * T.length), dv = new DataView(buf);
  const head = `timesim ${name} (mm)`.slice(0, 80);
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, T.length, true);
  let o = 84;
  for (const [a, b, c] of T) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1;
    for (const x of [...n.map((x) => x / l), ...a, ...b, ...c]) { dv.setFloat32(o, x, true); o += 4; }
    o += 2;
  }
  return new Uint8Array(buf);
}
export function stlRead(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), n = dv.getUint32(80, true), T = [];
  let o = 84;
  for (let i = 0; i < n; i++) {
    o += 12;
    const t = [];
    for (let k = 0; k < 3; k++) { t.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]); o += 12; }
    T.push(t); o += 2;
  }
  return T;
}
export function coupons(lib) {
  const sec = axleSection(lib);
  return { sec, fit: fitStrip(sec), ring: couponRing(lib), ramp: couponRamp() };
}
