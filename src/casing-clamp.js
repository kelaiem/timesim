// TODO 300 — THE FORM CASE'S HOLD, designed IN A LINE (CLAUDE.md's "design in a line, fold to fit"): casing clamps on a
// FITTED bore, no rim (TODO 300 step 2's hold B, the owner's choice of 2026-11-10). This module is the hold's LINE SPEC;
// the form case does not cut it yet (the fold is the next landing). Pure: no DOM, no three.js. Read by
// tools/probe-300-casing-clamp.mjs. Every row is an OFFSET from the base plate's AUTHORED cut outline (positive outward),
// so it carries to any shape the case library draws, and every row is derived from a rule the repo already holds.
//
// THE HOLD, back to front (the movement goes in from the back, carrying its dial; the case back is the part that comes off):
//   BACK BORE — the band's bore LOCATES the plate: its wall stands SEAT_FIT (§186's locating fit, geometry.js's one
//     fit for a part dropped into a recess cut for it) off the plate's REAL reach, which is the authored outline swollen
//     by the extrude's bevel (geometry.js makeBackPlate: bevelSize = radius · PLATE_BEVEL_F, TODO 84 at plate scale).
//   LEDGE — the step from the back bore to the FRONT BORE. The plate's dial face is flat out to the authored outline
//     (the bevel's chamfer runs from there OUT to the swell), so the ledge bears on that face over one land, §62's
//     STOCK_MIN_U, the floor every land here is held to (§325 landing 15: the movement's load has no shock spec to size
//     a bearing by, TODO 192's residue). The front bore is the ledge's lip: authored outline − land.
//   DIAL — cut to the plate's outline today (FORM_DIAL), so it would stand IN the ledge; it must pass inside the lip by
//     CLEAR_MARGIN. Its edge break is taken off its own stock (layout.js DIAL_EDGE_BREAK), so its reach IS its outline.
//   NOTCHES — a stem crossing the outline crosses the ledge between the plate's dial face and the dial (TODO 300 step 3:
//     the only occupants of the band), so the ledge is notched there by §186's own half-width (the tube's aperture, the
//     margin, and the bevel the plate's swell carries into a concave cut).
//   CLAMPS — a DOG on the plate, its tongue in a GROOVE in the bore wall (step 4b; step 4's first reading tapped the
//     screws into the band, and a Ø0.6 mm screw's head or dog cannot sit in a 2.64 u band: centred a pitch and a half
//     off the bore so the thread keeps its wall, a 1.8:1 head's counterbore breaks the band's outer wall by 0.38 u,
//     and the room the round case finds for its heads is the annulus outside the plate this hold closes). So the
//     screw threads into the PLATE's edge (the outer PLATE_RIM_MARGIN of its back face carries no counted metal), its
//     axis one pitch of wall plus a half-diameter inside the outline, blind, §3's 0.7 mm engagement leaving a land of
//     floor under it. A flat dog under its head reaches OUT over the bore's fit into a groove cut in the band's bore
//     wall, one land deep plus SEAT_FIT at its tip, and as wide as the dog plus SEAT_FIT. The plate is then held
//     axially between the ledge (on its dial face) and the groove's back wall (over the tongue), with SEAT_FIT of play.
//     The movement goes in with each dog turned inward (its tongue then stands over the plate's own margin), and the
//     dogs are turned out into the groove. Three dogs (§186's tripod: the fewest bearings that seat a plane), spread
//     along the outline as far from the stem notches as the period allows; their triangle must hold the plate's
//     centroid or the plate rocks on two. The dog's thickness is the land floor (§325 landing 15's reasoning: no shock
//     spec exists to size it by, so it is held to the floor every land here is).
//   THE GRID — every offset is rounded on the 0.01 grid AWAY from the metal it clears (§325 landing 10's rule), so the
//     fits and margins hold past float noise and the case library's own offset error (the cushion's polyline, 1.8e-5 u);
//     the locating fit then reads 0.0879, inside §186's tenth of SEAT_FIT.
//
// This is MODELLED, never simulated: no preload or shock is priced (no load spec exists for either), and the dogs'
// turning is a fitting operation, not a mechanism any axis poses.
import { UNIT_MM, CASE_CLEAR, CASE_BAND_T, STOCK_MIN_U, CLEAR_MARGIN, PLATE_RIM_MARGIN, CASE_SCREW_HEAD_D, CASE_SCREW_SHAFT_D, CASE_TUBE_D, BACK_PLATE_T } from './layout.js';

// geometry.js' constants, restated by VALUE here because geometry.js imports three.js and a line spec is pure. The
// probe imports geometry.js under the native loader and holds each equal to its source (S0), so the two cannot part.
export const GEOMETRY_RULES = Object.freeze({ PLATE_BEVEL_F: 0.008, SEAT_FIT: 0.08, TUBE_WALL: 0.3 / UNIT_MM });

// ---- INPUTS: each a choice with its reason. A fork overrides these and only these. ----
export const CLAMP_INPUTS = Object.freeze({
  plateR_u: { v: 41.51616090422663, why: 'the radius the plate extrude\'s bevel rule reads (main.js plateR, measured on alarm=0&case=fitted; the fold passes the build\'s own)' },
  clampD_u: { v: 0.6 / UNIT_MM, why: 'the round build\'s smallest clamp stock (main.js CASE_CLAMP_SHAFT_D without the alarm, §325 landing 14)' },
  dogs: { v: 3, why: '§186\'s tripod (CASE_CLAMP_N): the fewest bearings that seat a plane' },
  ringExcess_u: { v: 0, why: 'MEASURED by the build: how far the case\'s rings (mitre offsets of its sampled outer loop, form-case.js) stand INSIDE their true offsets of the shape — 0.017 u on a rect\'s corner arcs; 0 is the exact-curve line' },
});
const IN = (k, over) => (over && k in over ? over[k] : CLAMP_INPUTS[k].v);

// ---- the rows ----
const GRID = 0.01;
const up = (x) => Math.ceil(x / GRID - 1e-9) * GRID;   // rounded away from zero on the grid
export function solveClamp(over) {
  const { PLATE_BEVEL_F, SEAT_FIT, TUBE_WALL } = GEOMETRY_RULES;
  const plateR = IN('plateR_u', over), D = IN('clampD_u', over), N = IN('dogs', over), E = IN('ringExcess_u', over);
  const bevel = plateR * PLATE_BEVEL_F;            // the plate's swell past its authored outline (makeBackPlate)
  const land = up(STOCK_MIN_U);                    // §62's land floor, on the grid
  const boreBack = up(bevel + SEAT_FIT + E);       // locating: SEAT_FIT off the real reach, at the ring's worst (E in)
  const boreFront = -land;                         // the ledge's lip: one land onto the flat dial face
  const ledgeW = boreBack - boreFront;             // the ledge's radial width, bore wall to lip
  const dial = -up(land + CLEAR_MARGIN + GRID + E);   // the dial passes inside the lip's worst point, a grid step past the margin
  const caseIn = CASE_CLEAR - boreBack;            // how far the band comes in against today's single bore
  const notchHalfW = CASE_TUBE_D / 2 + TUBE_WALL + CLEAR_MARGIN + bevel;   // §186 CASE_NOTCH_HALFW, carried whole
  const pitch = D / 4, headD = D * (CASE_SCREW_HEAD_D / CASE_SCREW_SHAFT_D);   // §186's thread wall, the 1.8:1 head
  const headT = 0.4 / UNIT_MM;                     // §186's clamp head height (geometry.js makeCase headT)
  const eng = 0.7 / UNIT_MM;                       // §3's engagement (main.js CASE_CLAMP_ENG)
  const screw = -up(D / 2 + pitch);                // the axis, inside the outline: a pitch of plate wall to its edge
  const holeFloor = BACK_PLATE_T - eng;            // plate metal left under the blind hole
  const headIn = -screw + headD / 2;               // the head's inboard edge, depth inside the outline
  const dogT = land;                               // the dog, at the land floor
  const grooveD = land + SEAT_FIT;                 // the groove's depth past the bore wall: a land of bearing, a fit at the tip
  const grooveW = dogT + SEAT_FIT;                 // its width along the axis
  const dogTip = boreBack + land;                  // the tongue's tip, out past the bore wall by its bearing
  const dogReach = dogTip - screw;                 // axis to tip
  const dogStow = screw - dogReach;                // the tip turned inward for casing, inside the outline
  const dogHalfW = headD / 2;                      // the dog is as wide as the head that holds it
  const dogSpacing = notchHalfW + dogHalfW + CLEAR_MARGIN;   // §186's rule: a clamp off a notch by notch + head + margin
  return { GRID, bevel, land, boreBack, boreFront, ledgeW, dial, caseIn, notchHalfW, D, pitch, headD, headT, eng, screw,
    holeFloor, headIn, dogT, grooveD, grooveW, dogTip, dogReach, dogStow, dogHalfW, dogSpacing, N,
    bandLeft: CASE_BAND_T - grooveD,               // band wall behind the groove
    marginClear: (depth) => PLATE_RIM_MARGIN - depth,   // a depth inside the outline to the counted metal
    E, fit: (boreOff) => boreOff - E - bevel };   // the locating fit a bore at boreOff gives at its worst point           // the locating fit a bore at boreOff gives: §186's measure, wall to reach
}

// ---- along an outline: arc length, a station's point, and the dogs' stations ----
export function arcTable(loop) {
  const cum = [0];
  for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const per = cum[loop.length];
  const at = (s) => { s = ((s % per) + per) % per; let i = 0; while (cum[i + 1] < s) i++;
    const a = loop[i], b = loop[(i + 1) % loop.length], t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  // the arc position where the ray from (cx, cy) at azimuth az leaves the loop (a stem's crossing)
  const exitAt = (az, cx = 0, cy = 0) => { const dx = Math.cos(az), dy = Math.sin(az); let best = null;
    for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length], ex = b[0] - a[0], ey = b[1] - a[1];
      const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-15) continue;
      const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den, u = ((a[0] - cx) * dy - (a[1] - cy) * dx) / den;
      if (t > 0 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, s: cum[i] + u * Math.hypot(ex, ey) }; }
    return best?.s ?? null; };
  return { per, at, exitAt, cum };
}
// the dogs' stations: N at an equal ARC period, the phase that keeps the nearest notch furthest away (§186's
// CASE_CLAMP_AZ, by arc length where the round case reads angle). Returns arc positions and the nearest distance.
export function dogStations(loop, notchS, N) {
  const T = arcTable(loop), period = T.per / N;
  const dist = (s, n) => { const d = Math.abs(((s - n) % T.per + T.per) % T.per); return Math.min(d, T.per - d); };
  let best = null;
  for (let k = 0; k < 2000; k++) { const ph = (period * k) / 2000;
    const st = [...Array(N)].map((_, j) => ph + j * period);
    const near = Math.min(...st.flatMap((s) => notchS.map((n) => dist(s, n))));
    if (!best || near > best.near) best = { st, near }; }
  return { stations: best.st, near: best.near, period, at: T.at };
}
// does the triangle (or polygon, in order) of the stations contain the point? (a plate seated on its dogs does not rock)
export const containsPoint = (pts, [x, y]) => { let sgn = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(c) < 1e-12) continue; const s = Math.sign(c); if (sgn && s !== sgn) return false; sgn = s; } return true; };
export const loopCentroid = (loop) => { let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < loop.length; i++) { const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length], c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
  return [cx / (3 * A), cy / (3 * A)]; };
