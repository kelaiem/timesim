// BUILT §323 — A DEAD-BEAT ESCAPEMENT FOR THE LEGO GOING TRAIN, landing 1: MEASURED AND DECIDED. Pure: no three.js,
// no DOM. tools/probe-technic-deadbeat.mjs holds it; tools/ldraw-arc-survey.mjs reads the whole library through the
// same two laws (`silhouette`, `arcsAbout`).
//
// THE QUESTION. §316 drove §287's recoil anchor and found its swing, and its rate's sensitivity to friction, set by
// the anchor's recoil: the swing settles where the recoil the balance pays back equals the impulse it takes in
// (recoil / impulse = η²), and the pallets' friction band moves the rate 345 s/day (matched corners; 734 s/day with
// the bands at opposite ends). A DEAD-BEAT locks each tooth on a face that is an ARC ABOUT THE PIVOT, so the lock
// does no work on the balance, and the impulse comes only from the impulse face. The owner asked for it ("reduce
// friction"), and chose the option this landing builds: A1, a HALF dead-beat on the shipped knife.
//
// WHY "HALF". The balance turns about the knife's apex line, and every hole on the balance stands on an 8 mm lattice
// about the CROSSBAR's axis, which is a cross axle's reach (2.4 mm, §287's `axleReach`) above that line. No arc can be
// centred on the apex through LEGO's lattice; the nearest is the crossbar's axis itself, 2.4 mm off, 24× F2's play.
// So each locking face is an arc about a point 2.4 mm from the pivot, and the lock carries a small RESIDUAL RECOIL,
// which the model below measures off the parts rather than assumes. The true dead-beat (B: the knife inverted, its
// apex on the balance) needs the apex's real radius, which LDraw cannot give; the owner deferred it.
//
// THE PALLETS. A plate or tile whose outline carries a quarter-circle ARC about a STUD-GRID CORNER of its own (the
// survey's answer, below): placed on the stud grid of a 2×2 round plate with an axle hole (4032a) keyed on the
// crossbar, its arc's centre IS the crossbar's axis (the 4032a's axle sits at the corner of its four studs; the
// probe measures both off the parts). Keyed on a cross, the grid turns with the balance at quarter turns only, so a
// pallet's arc spans one QUADRANT about the crossbar. Its straight edges are RADII of that arc: where the tooth leaves
// the arc's end it slides down a radius, and a radius is the steepest impulse face there is (the normal to it is
// tangential about the arc's centre). A CONVEX arc (the plate's material inside it) locks a tooth pressing INWARD; a
// CONCAVE one (material outside, a quarter-circle CUTOUT) a tooth pressing OUTWARD — the two pallets of a Graham.
//
// THE CONTACT (`deadbeatModel`). The same quasi-static law as §287's `escapementModel` — the escape wheel, driven in
// its going sense, turns forward until a tooth meets a pallet, and is pushed back if a pallet moves into it — with a
// pallet that is the part's own SILHOUETTE in the balance's plane rather than an 8T's star profile. The model exposes
// §287's interface (depth, settle, holder, pitch, sigma), so §287's `traceCycle` and §316's contact tables and
// equation of motion read it unchanged; where the tooth rests on an arc, the table's slope IS the residual recoil.
//
// WHAT IS POSED OR NOT MODELLED, BY NAME: the knife's own loss (not modelled: the owner deferred its free-decay test;
// every swing this module returns is an UPPER BOUND); the lock face's sliding friction (landing 2 adds it to
// `drive`: here the rate spread is read with it, from the tabled pallet band at a 45° face, and labelled so);
// the pallets' and plates' play on their studs (none: LDraw places them exactly; F2's 0.1 mm is the only play the
// lock is held against).
import { walk, placements, LDU_MM } from './ldraw.js';
import { starProfile } from './technic-fusee.js';
import { LEGO_DIM_MM, GEAR_TIP_MM } from './technic-frame.js';
import { ESC_DIM_MM, F2_PLAY_MM, traceCycle } from './technic-escapement.js';

const TAU = 2 * Math.PI;
const mod = (a, m) => ((a % m) + m) % m;
const deg = (d) => d * Math.PI / 180, toDeg = (r) => r * 180 / Math.PI;
const r6 = (v) => Math.round(v * 1e6) / 1e6;

// ── A PART'S SILHOUETTE IN A PLANE ───────────────────────────────────────────
// Every triangle of the part projected along `normal` (0 x, 1 y, 2 z of the part's own frame) and filled into a grid
// of `res` LDU cells: the plan of all its material. `inside(u, v)` reads it (LDU); `dist` is each filled cell's
// distance to the nearest empty one (LDU, a two-pass chamfer, exact to a cell); `edge` lists the boundary cells'
// centres. The plane's axes are the other two, in order (normal 1: u = x, v = z).
const silCache = new Map();
export function silhouette(lib, part, { normal = 1, res = 0.25, cache = true } = {}) {
  const key = `${part}|${normal}|${res}`;
  if (cache && silCache.has(key)) return silCache.get(key);
  const [a, b] = [0, 1, 2].filter((i) => i !== normal);
  const tris = [];
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  walk(lib, part.endsWith('.dat') ? part : `${part}.dat`, (k, ps) => {
    if (k !== 'tri') return;
    const t = ps.map((p) => [p[a], p[b]]);
    for (const p of t) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])]; }
    tris.push(t);
  });
  const u0 = lo[0] - 2 * res, v0 = lo[1] - 2 * res, nu = Math.ceil((hi[0] - u0) / res) + 3, nv = Math.ceil((hi[1] - v0) / res) + 3;
  const occ = new Uint8Array(nu * nv);
  for (const [A, B, C] of tris) {
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
    if (Math.abs(area) < 1e-9) continue;                                    // edge-on: its neighbours carry the plan
    const i0 = Math.max(0, Math.floor((Math.min(A[0], B[0], C[0]) - u0) / res)), i1 = Math.min(nu - 1, Math.ceil((Math.max(A[0], B[0], C[0]) - u0) / res));
    const j0 = Math.max(0, Math.floor((Math.min(A[1], B[1], C[1]) - v0) / res)), j1 = Math.min(nv - 1, Math.ceil((Math.max(A[1], B[1], C[1]) - v0) / res));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const x = u0 + (i + 0.5) * res, y = v0 + (j + 0.5) * res;
      const w0 = (B[0] - x) * (C[1] - y) - (C[0] - x) * (B[1] - y), w1 = (C[0] - x) * (A[1] - y) - (A[0] - x) * (C[1] - y), w2 = (A[0] - x) * (B[1] - y) - (B[0] - x) * (A[1] - y);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) occ[i * nv + j] = 1;
    }
  }
  const out = gridSilhouette({ part, normal, axes: [a, b], res, u0, v0, nu, nv, occ, lo, hi });
  if (cache) silCache.set(key, out);              // (a whole-library reader passes cache: false: thousands of grids)
  return out;
}

// A POLYGON's silhouette (LDU, in its own plan): the same grid and the same readers, for a pallet drawn rather than
// read off a part — the probe's control, a slender Graham pallet no LEGO part has.
export function polySilhouette(poly, { res = 0.25 } = {}) {
  const lo = [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1]))], hi = [Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1]))];
  const u0 = lo[0] - 2 * res, v0 = lo[1] - 2 * res, nu = Math.ceil((hi[0] - u0) / res) + 3, nv = Math.ceil((hi[1] - v0) / res) + 3;
  const occ = new Uint8Array(nu * nv);
  const inPoly = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) if (inPoly(u0 + (i + 0.5) * res, v0 + (j + 0.5) * res)) occ[i * nv + j] = 1;
  return gridSilhouette({ part: null, normal: null, axes: [0, 1], res, u0, v0, nu, nv, occ, lo, hi });
}
// the grid's readers: the inside distance (cells, chamfer 1 / √2), the boundary cells, inside and depthAt
function gridSilhouette(g) {
  const { res, u0, v0, nu, nv, occ } = g;
  const big = 1e9, d = new Float32Array(nu * nv);
  for (let k = 0; k < d.length; k++) d[k] = occ[k] ? big : 0;
  const at = (i, j) => (i < 0 || j < 0 || i >= nu || j >= nv ? 0 : d[i * nv + j]);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const k = i * nv + j; if (!occ[k]) continue; d[k] = Math.min(d[k], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + Math.SQRT2, at(i - 1, j + 1) + Math.SQRT2); }
  for (let i = nu - 1; i >= 0; i--) for (let j = nv - 1; j >= 0; j--) { const k = i * nv + j; if (!occ[k]) continue; d[k] = Math.min(d[k], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + Math.SQRT2, at(i + 1, j - 1) + Math.SQRT2); }
  const edge = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) if (occ[i * nv + j] && d[i * nv + j] <= 1.0001) edge.push([u0 + (i + 0.5) * res, v0 + (j + 0.5) * res]);
  const cell = (u, v) => { const i = Math.floor((u - u0) / res), j = Math.floor((v - v0) / res); return i < 0 || j < 0 || i >= nu || j >= nv ? -1 : i * nv + j; };
  return {
    ...g, edge,
    inside: (u, v) => { const k = cell(u, v); return k >= 0 && occ[k] === 1; },
    // how far a point stands inside the material (LDU; ≤ 0 outside): the cell's chamfer distance less half a cell
    depthAt: (u, v) => { const k = cell(u, v); return k >= 0 && occ[k] ? (d[k] - 0.5) * res : -1; },
  };
}

// ── ARCS ABOUT A POINT ───────────────────────────────────────────────────────
// The silhouette's boundary read in polar coordinates about a centre (LDU): every boundary cell binned by its radius
// (a cell's width), and each radius whose cells cover a CONTIGUOUS angular run of at least `minSpanDeg` is an arc.
// Its radius and ROUNDNESS are then read off the part's own vertices in that run and band (the cells only find it):
// the roundness is the vertices' spread in radius, which is the LDraw polygon's tessellation (its sagitta). CONVEX
// when the material lies inside the arc (at half a cell in from it), CONCAVE when outside.
export function arcsAbout(lib, sil, centre, { minSpanDeg = 60, minR = 10, gapDeg = 6 } = {}) {
  const { res } = sil, bins = new Map();
  for (const [u, v] of sil.edge) {
    const r = Math.hypot(u - centre[0], v - centre[1]);
    if (r < minR) continue;
    const k = Math.round(r / res);
    if (!bins.has(k)) bins.set(k, []);
    bins.get(k).push(Math.atan2(v - centre[1], u - centre[0]));
  }
  const runs = [];
  for (const [k, list] of bins) {
    // merge the neighbouring bins (a cell straddles two)
    const angs = [...list, ...(bins.get(k - 1) ?? []), ...(bins.get(k + 1) ?? [])].map((x) => mod(x, TAU)).sort((p, q) => p - q);
    if (angs.length < 8) continue;
    let best = null, start = angs[0], prev = angs[0];
    const close = (s, e) => { const span = e - s; if (!best || span > best.span) best = { s, e, span }; };
    for (let i = 1; i < angs.length; i++) { if (angs[i] - prev > deg(gapDeg)) { close(start, prev); start = angs[i]; } prev = angs[i]; }
    close(start, prev);
    // a run that wraps through 0
    if (angs.length && angs[0] + TAU - angs[angs.length - 1] <= deg(gapDeg)) {
      let i = angs.length - 1; while (i > 0 && angs[i] - angs[i - 1] <= deg(gapDeg)) i--;
      let j = 0; while (j < angs.length - 1 && angs[j + 1] - angs[j] <= deg(gapDeg)) j++;
      if (i > j) close(angs[i], angs[j] + TAU);
    }
    if (best && best.span >= deg(minSpanDeg)) runs.push({ k, ...best });
  }
  // one arc per radius family: keep the widest of neighbouring bins
  runs.sort((p, q) => q.span - p.span);
  const arcs = [];
  for (const r of runs) {
    if (arcs.some((a) => Math.abs(a.k - r.k) <= 2 && Math.abs(mod(a.from - r.s + Math.PI, TAU) - Math.PI) < deg(10))) continue;
    // its vertices: the part's own, in this run and within a cell of the radius
    const R0 = r.k * res, vs = [];
    let h0 = Infinity, h1 = -Infinity;
    walk(lib, `${sil.part}.dat`, (kind, ps) => {
      for (const p of ps) {
        const u = p[sil.axes[0]], v = p[sil.axes[1]], rr = Math.hypot(u - centre[0], v - centre[1]);
        if (Math.abs(rr - R0) > 1.5 * res) continue;
        const ph = mod(Math.atan2(v - centre[1], u - centre[0]) - r.s, TAU);
        if (ph <= r.e - r.s + 1e-9) { vs.push(rr); if (sil.normal !== null) { h0 = Math.min(h0, p[sil.normal]); h1 = Math.max(h1, p[sil.normal]); } }
      }
    });
    if (vs.length < 4) continue;
    const rmin = Math.min(...vs), rmax = Math.max(...vs), mid = r.s + (r.e - r.s) / 2;
    const probe = (dr) => sil.inside(centre[0] + (R0 + dr) * Math.cos(mid), centre[1] + (R0 + dr) * Math.sin(mid));
    const convex = probe(-res) && !probe(res), concave = !probe(-res) && probe(res);
    arcs.push({ k: r.k, r: (rmin + rmax) / 2, roundness: rmax - rmin, from: r.s, span: r.e - r.s, kind: convex ? 'convex' : concave ? 'concave' : 'thin', vertices: vs.length, faceHeight: h1 > h0 ? h1 - h0 : 0 });
  }
  // a 'thin' reading beside a convex or concave one at the same radius is the same arc read off a wall's far face
  return arcs.filter((a) => a.kind !== 'thin' || !arcs.some((b) => b !== a && b.kind !== 'thin' && Math.abs(b.k - a.k) <= 4));
}

// The lattice points of a part's plane (LDU) where a mount can put the centre of an arc: the HALF-STUD lattice (a
// 10-LDU grid in phase with the part's own studs, or its origin when it has none — a tile's anti-studs sit on its
// origin's grid) over the part's extent, every point of which a stud grid reaches (a stud centre, or the corner of
// four, where an axle through a 2×2 round plate lands), and the part's own holes.
export function latticeCentres(lib, part, sil, { margin = 10 } = {}) {
  const out = new Map();
  const add = (u, v, kind) => { const k = `${r6(u)},${r6(v)}`; if (!out.has(k)) out.set(k, { c: [r6(u), r6(v)], kind }); };
  for (const h of placements(lib, `${part}.dat`, /(peghole|axlehol|axleh|connhole|npeghol|beamhole)/i)) add(h.m[sil.axes[0]], h.m[sil.axes[1]], 'hole');
  const studs = placements(lib, `${part}.dat`, /stud/i);
  const ph = studs.length ? [mod(studs[0].m[sil.axes[0]], 10), mod(studs[0].m[sil.axes[1]], 10)] : [0, 0];
  for (let u = Math.floor((sil.lo[0] - margin - ph[0]) / 10) * 10 + ph[0]; u <= sil.hi[0] + margin; u += 10)
    for (let v = Math.floor((sil.lo[1] - margin - ph[1]) / 10) * 10 + ph[1]; v <= sil.hi[1] + margin; v += 10) add(u, v, 'lattice');
  return [...out.values()];
}

export { TAU, mod, deg, toDeg, r6 };

// ── THE MOUNT (A1) ───────────────────────────────────────────────────────────
// The balance's frame is §287's: about the PIVOT (the knife's apex line), u across, v DOWN, mm. The crossbar's axis
// stands a cross axle's reach above the pivot. A pallet part is placed with the centre of its measured arc ON that
// axis, its plane the balance's, turned by quarter turns (`rot`, the crossbar's cross keys it, directly or through a
// 2×2 round plate's axle hole) and possibly face-down (`flip`: studs the other way along the crossbar, which reflects
// its plan). A part's plan point (x, z) in LDU, about its arc's centre, maps to the body as
//   (u, v) = C + R(rot·90°) · F(flip) · (x − cx, z − cz) · 0.4.
export const PIVOT_TO_CROSSBAR = ESC_DIM_MM.axleReach;                 // 2.4 mm: the eccentricity A1 cannot remove
export const CROSSBAR = Object.freeze([0, -PIVOT_TO_CROSSBAR]);
export function palletFrame(p, C0 = CROSSBAR) {
  // (`at` and `angle` place a part anywhere at any angle: the probe's control re-reads §287's 8T pallets through
  // this model; A1's pallets take the crossbar and quarter turns)
  const C = p.at ?? C0, q = p.angle ?? (p.rot ?? 0) * Math.PI / 2, c = Math.cos(q), s = Math.sin(q), f = p.flip ? -1 : 1;
  const toBody = (x, z) => { const a = (x - p.centre[0]) * LDU_MM, b = f * (z - p.centre[1]) * LDU_MM; return [C[0] + c * a - s * b, C[1] + s * a + c * b]; };
  const toPart = (u, v) => { const a = u - C[0], b = v - C[1], x = c * a + s * b, z = -s * a + c * b; return [x / LDU_MM + p.centre[0], f * z / LDU_MM + p.centre[1]]; };
  return { toBody, toPart };
}

// ── THE CONTACT MODEL ────────────────────────────────────────────────────────
// §287's quasi-static law, with pallets that are their parts' silhouettes. spec: { wheelPart, teeth, W: [u, v] (the
// escape wheel's centre, mm), sense, pallets: [{ part, centre: [x, z] (its arc's centre, LDU), rot, flip }] }.
// THE OVERLAP of a pallet and the wheel is the deepest any boundary point of one stands inside the other: the
// wheel's star-profile points against the pallet's silhouette (its chamfer depth), and the pallet's boundary cells
// against the wheel's profile (landing H's law, as §287 reads it).
const BINS = 3600;
const rAt = (P, phi) => { const t = mod(phi / TAU, 1) * BINS, i = Math.floor(t) % BINS, f = t - Math.floor(t); return P.r[i] * (1 - f) + P.r[(i + 1) % BINS] * f; };
export function deadbeatModel(lib, spec, { swingDeg = 15 } = {}) {
  const Wp = starProfile(lib, spec.wheelPart), sigma = spec.sense, pitch = TAU / spec.teeth, Wc = spec.W;
  const pals = spec.pallets.map((p) => {
    const sil = p.poly ? polySilhouette(p.poly, { res: spec.res ?? 0.25 }) : silhouette(lib, p.part, { normal: p.normal ?? 1, res: spec.res ?? 0.25 }), fr = palletFrame(p);
    // the boundary cells that can ever come near the wheel over the swing, in the body frame at α = 0
    const reach = (u, v) => Math.hypot(u, v) * deg(swingDeg) + Wp.tip + 1;
    const edge = [];
    for (const [x, z] of sil.edge) { const [u, v] = fr.toBody(x, z); if (Math.hypot(u - Wc[0], v - Wc[1]) <= reach(u, v)) edge.push([u, v]); }
    return { ...p, sil, fr, edge };
  });
  const wheelPts = [];
  for (let i = 0; i < BINS; i += 2) if (Wp.r[i] >= 0.6 * Wp.tip) wheelPts.push([i / BINS * TAU, Wp.r[i]]);
  function overlapK(k, th, a) {
    const P = pals[k], ca = Math.cos(a), sa = Math.sin(a);
    let worst = -Infinity;
    // the wheel's points in the pallet: undo the balance's turn, then into the part's plan
    for (const [phi, r] of wheelPts) {
      const x = Wc[0] + r * Math.cos(phi + th), y = Wc[1] + r * Math.sin(phi + th);
      const u = ca * x + sa * y, v = -sa * x + ca * y;                 // R(−α)
      const [px, pz] = P.fr.toPart(u, v), d = P.sil.depthAt(px, pz);
      if (d > -1) { const dm = d * LDU_MM; if (dm > worst) worst = dm; }
    }
    // the pallet's boundary in the wheel
    for (const [u0, v0] of P.edge) {
      const u = ca * u0 - sa * v0, v = sa * u0 + ca * v0, dx = u - Wc[0], dy = v - Wc[1], dd = Math.hypot(dx, dy);
      if (dd > Wp.tip + 0.01) continue;
      const val = rAt(Wp, Math.atan2(dy, dx) - th) - dd;
      if (val > worst) worst = val;
    }
    return worst;
  }
  const depth = (th, a) => { let w = -Infinity; for (let k = 0; k < pals.length; k++) w = Math.max(w, overlapK(k, th, a)); return w; };
  const bis = (lo, hi, a) => { for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (depth(m, a) > 0) hi = m; else lo = m; } return lo; };
  function forward(th, a, limit = 1.5 * pitch) {
    let t = th, d = depth(t, a);
    for (let k = 0; k < 4000; k++) {
      const step = sigma * Math.min(pitch / 60, Math.max(pitch / 600, -0.5 * d / Wp.tip));
      const t2 = t + step, d2 = depth(t2, a);
      if (d2 > 0) return bis(t, t2, a);
      t = t2; d = d2;
      if (Math.abs(t - th) > limit) return null;
    }
    return null;
  }
  function back(th, a) {
    let b = th, d;
    while ((d = depth(b, a)) > 0) { b -= sigma * Math.min(pitch / 60, Math.max(2e-4, 0.5 * d / Wp.tip)); if (Math.abs(b - th) > pitch) return null; }
    return bis(b, th, a);
  }
  const settle = (th, a) => (depth(th, a) > 0 ? back(th, a) : forward(th, a));
  const holder = (th, a) => { const t = th + sigma * 1e-4; let best = 0, bv = -Infinity; for (let k = 0; k < pals.length; k++) { const v = overlapK(k, t, a); if (v > bv) { bv = v; best = k; } } return best; };
  return { W: Wp, pitch, sigma, overlapK, depth, settle, forward, back, holder, pallets: pals, spec, kind: 'deadbeat' };
}

// ── THE PALLET CANDIDATES (the survey's answer, re-read from the pack) ───────
// Every plate, tile or beam whose outline carries a USABLE quarter-circle arc (tools/ldraw-arc-survey.mjs) about a
// lattice point a 2×2 round plate or its own axle hole can put on the crossbar, by part: the centre of its arc in its
// own plan (LDU). The probe re-reads each arc off the part (radius, span, kind, roundness) and fails on a mismatch, so
// the table only names; the parts measure.
export const DEADBEAT_PALLETS = Object.freeze({
  // plates, tiles and a beam whose quarter-circle arcs stand in their plan (normal y), on a stud grid or a keyed hole
  '7904': Object.freeze({ centre: [-20, 20], normal: 1 }),    // Plate 2×2 Quarter Circle: convex r 16
  '27925': Object.freeze({ centre: [-10, 10], normal: 1 }),   // Tile 2×2 Corner Round: convex r 16 (and concave r 8)
  '32249': Object.freeze({ centre: [0, 0], normal: 1 }),      // Technic Beam 3×3×0.5 Quarter Circle: concave r 16.4 about its axle hole
  '27507': Object.freeze({ centre: [0, 0], normal: 1 }),      // Tile 4×4 Corner Round: concave r 24, convex r 32 (a quarter ring)
  '3477': Object.freeze({ centre: [0, 0], normal: 1 }),       // its Type 2
  '48092': Object.freeze({ centre: [0, 0], normal: 1 }),      // Brick 4×4 Corner Round: concave r 24, convex r 32
  '30565': Object.freeze({ centre: [-40, 40], normal: 1 }),   // Plate 4×4 with Corner Round: convex r 32
  '35044': Object.freeze({ centre: [40, -40], normal: 1 }),   // Plate 4×4 with 3×3 Quarter Circle Cutout: concave r 24
  // the survey's SLENDEREST arcs about a part's own axle hole (under 3 mm of material behind the face), keyed on the
  // crossbar through that hole; their plane is the one the survey read them in (the hole's axis)
  '30324': Object.freeze({ centre: [0, 0], normal: 2 }),      // Wheel Hard with Treads: convex r 4.8, 2.35 mm behind
  '98302': Object.freeze({ centre: [4, 30], normal: 0 }),     // Plate 1×2 with Jet Engine with Axle Hole: convex r 4.8, 2.45 mm
  '3482': Object.freeze({ centre: [0, 0], normal: 2 }),       // Wheel Rim 8×17.5 with Axlehole: concave r 6, 2.6 mm
  '69779': Object.freeze({ centre: [0, 0], normal: 2 }),      // Technic Gear 20 Tooth: concave r 6.7, 2.1 mm (its hub's cut-outs)
  '35188': Object.freeze({ centre: [0, 0], normal: 2 }),      // Technic Changeover Rotary Catch: concave r 6.8, 2.85 mm
});
// the mount (4032a, a 2×2 round plate with an axle hole: its axle sits at the corner of its four studs, so a stud-grid
// corner of anything on its studs IS the crossbar's axis), and the survey's controls
export const DEADBEAT_PARTS = Object.freeze({ mount: '4032a', fullDisc: '2723', plainPlate: '3023b' });

// THE PAIRS: a CONVEX arc (the entry pallet: the tooth presses toward the crossbar) beside a CONCAVE one (the exit:
// it presses away), each on its part's own measured arc, every part at each of the eight quarter-turn placements a
// keyed cross allows (four turns, face up or down). A part that carries both kinds is one pallet.
export function a1Pallets(lib) {
  const arcs = Object.fromEntries(Object.entries(DEADBEAT_PALLETS).map(([p, d]) => [p, arcsAbout(lib, silhouette(lib, p, { normal: d.normal, res: 0.25 }), d.centre).filter((a) => a.kind !== 'thin')]));
  const has = (p, k) => arcs[p].some((a) => a.kind === k);
  const placements8 = (p) => [0, 1, 2, 3].flatMap((rot) => [false, true].map((flip) => ({ part: p, centre: DEADBEAT_PALLETS[p].centre, normal: DEADBEAT_PALLETS[p].normal, rot, flip })));
  const sets = [];
  for (const cv of Object.keys(arcs).filter((p) => has(p, 'convex'))) for (const cc of Object.keys(arcs).filter((p) => has(p, 'concave'))) {
    if (cv === cc) { for (const a of placements8(cv)) sets.push([a]); continue; }
    for (const a of placements8(cv)) for (const b of placements8(cc)) sets.push([a, b]);
  }
  return { arcs, sets };
}
// the pallets' arcs in the body frame (radius, start angle, span, kind), for the prefilter
function bodyArcs(arcs, p) {
  const f = p.flip ? -1 : 1, q = (p.rot ?? 0) * Math.PI / 2;
  return arcs[p.part].map((a) => { const b0 = q + f * a.from, b1 = q + f * (a.from + a.span); return { kind: a.kind, R: a.r * LDU_MM, s: mod(Math.min(b0, b1), TAU), span: a.span }; });
}
// does the wheel's tip circle cross this arc inside its span (a tooth could rest on it there)?
function crosses(arc, W, rt, C = CROSSBAR) {
  const dx = W[0] - C[0], dy = W[1] - C[1], d = Math.hypot(dx, dy);
  if (d > arc.R + rt || d < Math.abs(arc.R - rt)) return false;
  const base = Math.atan2(dy, dx), half = Math.acos((arc.R * arc.R + d * d - rt * rt) / (2 * arc.R * d));
  return [base - half, base + half].some((g) => mod(g - arc.s, TAU) <= arc.span);
}

// ── A1, SOLVED ───────────────────────────────────────────────────────────────
// Every escape wheel `wheels` names (default the going train's own 8T: another count re-gears the train), at every
// lattice point of the escape arbor's (u on LEGO's 4 mm half-stud, v on §287's 3.2 j + 4.0 under the knife, over the
// window the pallets' radii reach), under every pair of pallets whose convex AND concave arcs its tip circle crosses,
// in both senses. A geometry ESCAPES when a free place for the wheel exists at the swing's centre and ±`quickDeg`
// (every escapement passes through those: the wheel rests somewhere at every angle of the swing) and §287's own trace
// then advances it one tooth a cycle at some swing in `swings`. CLOSEST is the least, over the candidates, of the
// deepest overlap the best wheel angle leaves at the worst of those three anchor angles: how far the nearest
// candidate is from even letting the wheel rest.
// THE JUDGE, one candidate: a free place for the wheel (some wheel angle where nothing overlaps) at the swing's centre
// and ±quickDeg — every escapement passes through those — then §287's trace at each swing. `score` is the deepest
// overlap the best wheel angle leaves at the worst of the three (≤ 0: the wheel can rest at all three). Reading
// stops early once the score is past `bound` (the solve's best so far) or a place is refused.
export function judgeA1(m, { quickDeg = 2, swings = [3, 6, 10], n = 120, bound = -Infinity } = {}) {
  let score = -Infinity, free = true;
  for (const a of [-deg(quickDeg), 0, deg(quickDeg)]) {
    let least = Infinity;
    for (let k = 0; k < 90 && least > 0; k++) least = Math.min(least, m.depth(k * m.pitch / 90, a));
    score = Math.max(score, least);
    if (least > 0) { free = false; if (score >= bound) break; }
  }
  return { free, score, swings: free ? swings.filter((A) => traceCycle(m, A, { n }).ok) : [] };
}
export function solveA1(lib, { wheels = { '3647': 8 }, uRange = [-40, 40], vRange = [-10, 14], quickDeg = 2, swings = [3, 6, 10], n = 120, closest = true, onCandidate = null } = {}) {
  const { arcs, sets } = a1Pallets(lib), out = { tried: 0, prefiltered: 0, escapes: [], closest: null, counts: { noFree: 0, traced: 0 } };
  for (const [wp, teeth] of Object.entries(wheels)) {
    const rt = starProfile(lib, wp).tip;
    for (let u = uRange[0]; u <= uRange[1] + 1e-9; u += LEGO_DIM_MM.stud / 2) for (let j = vRange[0]; j <= vRange[1]; j++) {
      const W = [u, r6(LEGO_DIM_MM.plateH * j + (ESC_DIM_MM.knifeH - LEGO_DIM_MM.holeZ))];
      for (const pal of sets) {
        out.tried++;
        const all = pal.flatMap((p) => bodyArcs(arcs, p));
        if (!all.some((a) => a.kind === 'convex' && crosses(a, W, rt)) || !all.some((a) => a.kind === 'concave' && crosses(a, W, rt))) continue;
        out.prefiltered++;
        for (const sense of [1, -1]) {
          const m = deadbeatModel(lib, { wheelPart: wp, teeth, W, sense, pallets: pal });
          const jd = judgeA1(m, { quickDeg, swings, n, bound: closest ? (out.closest?.score ?? Infinity) : -Infinity });
          if (closest && (!out.closest || jd.score < out.closest.score)) out.closest = { score: jd.score, wheel: wp, W, sense, pallets: pal };
          onCandidate?.({ wp, W, sense, pal, ...jd });
          if (!jd.free) { out.counts.noFree++; continue; }
          out.counts.traced++;
          if (jd.swings.length) out.escapes.push({ wheel: wp, W, sense, pallets: pal, swings: jd.swings });
        }
      }
    }
  }
  return out;
}

// HOW THICK a pallet stands behind its locking face: from the arc, at each angle of its span (every degree), the
// run of material straight away from the face — toward the arc's centre on a convex arc, away from it on a concave —
// until the silhouette empties (mm). A Graham pallet dips into the tooth circle between two teeth, so the material
// behind its face near the wheel must fit a tooth gap; the probe holds every candidate's LEAST thickness against
// the widest drawn pallet the same model lets escape on the same wheel.
export function thicknessBehind(sil, centre, arc, { step = 0.05 } = {}) {
  let least = Infinity, most = 0;
  const dir = arc.kind === 'convex' ? -1 : 1, R = arc.r;               // LDU
  for (let t = 0.02; t <= 0.98; t += 1 / Math.max(2, Math.round(arc.span * 180 / Math.PI))) {
    const a = arc.from + t * arc.span, c = Math.cos(a), s = Math.sin(a);
    // from two cells in (one cell can straddle the face); an angle with no material there is not part of the face
    let r = R + 2 * dir * sil.res, run = 2 * sil.res * LDU_MM;
    if (!sil.inside(centre[0] + r * c, centre[1] + r * s)) continue;
    while (sil.inside(centre[0] + r * c, centre[1] + r * s) && r > 0) { r += dir * step / LDU_MM; run += step; if (run > 200) break; }
    least = Math.min(least, run); most = Math.max(most, run);
  }
  return Number.isFinite(least) ? { least, most } : { least: null, most: null };
}

// ── THE CONTROL: A TEXTBOOK GRAHAM, DRAWN ────────────────────────────────────
// No LEGO part: two slender pallets drawn as polygons, laid out as the textbook lays a Graham out — the arcs' centre
// on the tangents to the tip circle at the two locking points (each lock face then runs along the wheel's radius
// there, so the tooth presses straight at the centre), the points (n + ½) pitches apart; each pallet `w` thick across
// its arc (a convex face for the entry, the tooth pressing toward the centre; concave for the exit), dipping `dip`
// into the tooth circle and running `len` out of it, its inner end set back by `lift` along the arc (the impulse
// face). `centre` is where the arcs are centred: the crossbar (A1's) or the pivot (a true dead-beat). The probe holds
// that the SAME model and judge let it escape, so a LEGO pallet refused is refused by its geometry.
export function drawnGraham(lib, wheelPart, teeth, n, { w = 1, dip = 0.6, len = 3, lift = 1, sense = 1, centre = CROSSBAR } = {}) {
  const rt = starProfile(lib, wheelPart).tip, pitch = TAU / teeth, beta = (n + 0.5) * pitch / 2, C = centre;
  const D = rt / Math.cos(beta), W = [C[0], C[1] + D], R = rt * Math.tan(beta);
  const pallets = [-1, 1].map((s) => {
    const P = [W[0] + s * rt * Math.sin(beta), W[1] - rt * Math.cos(beta)], phi = Math.atan2(P[1] - C[1], P[0] - C[0]);
    const inside = (a) => Math.hypot(C[0] + R * Math.cos(a) - W[0], C[1] + R * Math.sin(a) - W[1]) < rt;
    const into = inside(phi + 0.01) ? 1 : -1, convex = s < 0;
    const face = convex ? R : R, back = convex ? R - w : R + w, aIn = phi + into * dip / R, aOut = phi - into * len / R, aBackIn = aIn - into * lift / R;
    const pts = [], N = 16;
    for (let i = 0; i <= N; i++) { const a = aOut + (aIn - aOut) * i / N; pts.push([C[0] + face * Math.cos(a), C[1] + face * Math.sin(a)]); }
    for (let i = N; i >= 0; i--) { const a = aOut + (aBackIn - aOut) * i / N; pts.push([C[0] + back * Math.cos(a), C[1] + back * Math.sin(a)]); }
    return { poly: pts.map(([u, v]) => [u / LDU_MM, v / LDU_MM]), at: [0, 0], angle: 0, centre: [0, 0] };
  });
  return { wheelPart, teeth, W, sense, pallets, R, D, beta };
}

// ── A1′: THE LOCK ARC ON A FRICTION AXLE PIN, ITS ANGLE FREE ─────────────────
// §287 sets each pallet on a friction axle pin (43093) in a liftarm's ROUND hole: the pin's axle half keys the part,
// its pin half turns in the hole, friction holds it — so its angle is FREE (a setting, not a quarter turn). A1′ carries
// each lock arc that way: the part keyed on the pin's axle half (32249 directly; a plate through a 4032a), its arc's
// centre on the pin. The pins stand in the round holes of arms keyed on the crossbar (6632 and 11478, §287's ARM_PARTS:
// their round holes at 8, 16, 24 mm from the keyed end, at each quarter turn), so the arc's centre stands on one of
// those holes: the nearest is 8 mm straight down the crossbar, 5.6 mm from the pivot. Two parts need two pins (one
// slab, one part a pin); a part carrying both arcs (a quarter ring) is one pallet on one pin.
export function a1PrimeHoles(arms = { '6632': [8], '11478': [8, 16, 24] }, { maxE = 12 } = {}) {
  const out = new Map();
  for (const ds of Object.values(arms)) for (const d of ds) for (let k = 0; k < 4; k++) {
    const q = k * Math.PI / 2, Q = [r6(CROSSBAR[0] + d * Math.cos(q)), r6(CROSSBAR[1] + d * Math.sin(q))], e = Math.hypot(Q[0], Q[1]);
    if (e <= maxE) out.set(`${Q}`, { Q, e: r6(e) });
  }
  return [...out.values()].sort((a, b) => a.e - b.e);
}
// THE SOLVE. A Graham's two locks stand (n + ½) pitches apart on the tip circle. For each wheel position on the
// lattice, each straddle n, each pair of pins, the convex arc's circle meets the tip circle at up to two points P1; the
// point (n + ½) pitches round from it is P2, and the concave arc must pass within `tol` of it (the lock depth the dip
// can take up). Each pallet is then turned — its angle is free — so an END of its arc stands at its lock point, set
// `dip` into the wheel's side, face up or down: every such placement is judged (`judgeA1`: a free place at the swing's
// centre and ±2°, then §287's trace).
export function solveA1Prime(lib, { wheels = { '3647': 8 }, ns = [1, 2, 3], uRange = [-32, 32], vRange = [-8, 14], tol = 0.6, dips = [0.5], holes = a1PrimeHoles(), swings = [3, 6, 10], onCase = null } = {}) {
  const { arcs } = a1Pallets(lib);
  const parts = Object.keys(arcs), convexOf = (p) => arcs[p].filter((a) => a.kind === 'convex'), concaveOf = (p) => arcs[p].filter((a) => a.kind === 'concave');
  const out = { geometries: 0, judged: 0, rests: 0, escapes: [] };
  for (const [wp, teeth] of Object.entries(wheels)) {
    const rt = starProfile(lib, wp).tip, pitch = TAU / teeth;
    for (let u = uRange[0]; u <= uRange[1] + 1e-9; u += LEGO_DIM_MM.stud / 2) for (let j = vRange[0]; j <= vRange[1]; j++) {
      const W = [u, r6(LEGO_DIM_MM.plateH * j + (ESC_DIM_MM.knifeH - LEGO_DIM_MM.holeZ))];
      for (const pc of parts) for (const ac of convexOf(pc)) for (const pk of parts) for (const ak of concaveOf(pk)) for (const h1 of holes) for (const h2 of holes) {
        if ((pc === pk) !== (h1 === h2)) continue;                       // one part, one pin; two parts, two pins
        const R1 = ac.r * LDU_MM, R2 = ak.r * LDU_MM, dx = W[0] - h1.Q[0], dy = W[1] - h1.Q[1], d = Math.hypot(dx, dy);
        if (d > R1 + rt || d < Math.abs(R1 - rt)) continue;
        const base = Math.atan2(h1.Q[1] - W[1], h1.Q[0] - W[0]), half = Math.acos((rt * rt + d * d - R1 * R1) / (2 * rt * d));
        for (const phi1 of [base - half, base + half]) for (const n of ns) for (const s of [1, -1]) {
          const P1 = [W[0] + rt * Math.cos(phi1), W[1] + rt * Math.sin(phi1)], phi2 = phi1 + s * (n + 0.5) * pitch;
          const P2 = [W[0] + rt * Math.cos(phi2), W[1] + rt * Math.sin(phi2)];
          if (Math.abs(Math.hypot(P2[0] - h2.Q[0], P2[1] - h2.Q[1]) - R2) > tol) continue;
          // the wheel's sense: a tooth presses INTO each lock face — toward the convex arc's centre at P1, away from the
          // concave arc's at P2 (the velocity of a tip, sense σ, is σ·(−sin φ, cos φ)); the two must agree
          const tangent = (phi) => [-Math.sin(phi), Math.cos(phi)];
          const into1 = Math.sign(tangent(phi1)[0] * (h1.Q[0] - P1[0]) + tangent(phi1)[1] * (h1.Q[1] - P1[1]));
          const into2 = -Math.sign(tangent(phi2)[0] * (h2.Q[0] - P2[0]) + tangent(phi2)[1] * (h2.Q[1] - P2[1]));
          if (!into1 || into1 !== into2) continue;
          const sense = into1;
          out.geometries++;
          const T1 = Math.atan2(P1[1] - h1.Q[1], P1[0] - h1.Q[0]), T2 = Math.atan2(P2[1] - h2.Q[1], P2[0] - h2.Q[0]);
          // each pallet turned so an END of its arc stands at its lock point and the arc runs on OUT of the tip circle
          // (the lock face a tooth slides along as the swing goes on), its end set `dip` back into the wheel
          const placements = (part, a, Q, T, R) => {
            const res = [];
            for (const end of [false, true]) for (const flip of [false, true]) {
              const f = flip ? -1 : 1, at = end ? a.from + a.span : a.from, runs = (end ? -1 : 1) * f;     // the arc runs this way from its end
              const probe = [Q[0] + R * Math.cos(T + runs * 3 / R), Q[1] + R * Math.sin(T + runs * 3 / R)];
              if (Math.hypot(probe[0] - W[0], probe[1] - W[1]) <= rt) continue;   // it would run into the wheel
              for (const dip of dips) res.push({ part, centre: DEADBEAT_PALLETS[part].centre, normal: DEADBEAT_PALLETS[part].normal, at: Q, angle: T - runs * dip / R - f * at, flip });
            }
            return res;
          };
          const A = placements(pc, ac, h1.Q, T1, R1), B = pc === pk ? [null] : placements(pk, ak, h2.Q, T2, R2);
          for (const p1 of A) for (const p2 of B) {
            const pals = p2 ? [p1, p2] : [p1];
            const m = deadbeatModel(lib, { wheelPart: wp, teeth, W, sense, pallets: pals });
            const jd = judgeA1(m, { swings });
            out.judged++;
            if (jd.free) out.rests++;
            onCase?.({ wp, W, n, sense, pallets: pals, ...jd });
            if (jd.swings.length) out.escapes.push({ wheel: wp, W, n, sense, pallets: pals, holes: [h1, h2], swings: jd.swings });
          }
        }
      }
    }
  }
  return out;
}

// ── A1′, AS FOUND ────────────────────────────────────────────────────────────
// `solveA1Prime` on the going train's 8T: of 16,222 geometries (77,056 placements judged), 4,792 let the wheel rest
// and 124 escape. The one declared here escapes over the widest window with a contact table the drive can read
// (2.5°–6.5°, the table to 6.5°), and is the one the probe holds: a 2×2 quarter circle plate (convex, r 16) on a
// friction axle pin in the round hole 8 mm UP the crossbar (10.4 mm above the pivot), a 3×3-cutout plate (concave,
// r 24) on a pin in the round hole 8 mm along the +u mass arm (8.35 mm from the pivot), the 8T at (−12, 4) mm, driven
// in sense +1, the locks 3.5 pitches apart. Each pallet's ANGLE is its friction pin's setting (the solve's answer,
// to a hundredth of a degree), its centre the pin. A1′'s eccentricities (10.4 and 8.35 mm) are what its free angle
// costs: 4.3 and 3.5 times A1's 2.4.
export const A1_PRIME = Object.freeze({
  wheelPart: '3647', teeth: 8, W: Object.freeze([-12, 4]), sense: 1, n: 3,
  pallets: Object.freeze([
    Object.freeze({ part: '7904', pin: Object.freeze([0, -10.4]), angleDeg: -128.4, flip: false }),
    Object.freeze({ part: '35044', pin: Object.freeze([8, -2.4]), angleDeg: 243.2, flip: true }),
  ]),
});
export function a1PrimeSpec(c = A1_PRIME, { res } = {}) {
  return { wheelPart: c.wheelPart, teeth: c.teeth, W: [...c.W], sense: c.sense, res,
    pallets: c.pallets.map((p) => ({ part: p.part, centre: DEADBEAT_PALLETS[p.part].centre, normal: DEADBEAT_PALLETS[p.part].normal, at: [...p.pin], angle: deg(p.angleDeg), flip: p.flip })) };
}
// the widest swing whose drops are those of the narrowest that escapes (the contact table the drive reads)
export function tableSwingOf(m, { from = [2, 2.5, 3, 4, 5, 6], step = 0.25, cap = 20, perDeg = 100 } = {}) {
  let start = null;
  for (const A of from) { const t = traceCycle(m, A, { n: Math.round(A * perDeg) }); if (t.ok) { start = { A, t }; break; } }
  if (!start) return null;
  const ref = start.t.drops.map((d) => ({ dir: d.dir, a: d.alpha })), tol = 2 * 2 * deg(1 / perDeg);
  let A = start.A, next = null;
  for (let a = start.A + step; a <= cap + 1e-9; a += step) {
    const t = traceCycle(m, a, { n: Math.round(a * perDeg) });
    const same = t.ok && t.drops.length === ref.length && t.drops.every((d, i) => d.dir === ref[i].dir && Math.abs(d.alpha - ref[i].a) <= tol);
    if (!same) { next = { A: r6(a), why: t.ok ? 'other drops' : t.why }; break; }
    A = a;
  }
  return { from: start.A, A: r6(A), next };
}
