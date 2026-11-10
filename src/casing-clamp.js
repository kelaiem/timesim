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
//   DOGS — casing screws tapped into the band's back face, parallel to the movement's axis, each turning a DOG (a flat
//     lever under its head) over the bore onto the plate's back face. The thread keeps one pitch (Ø/4, §186's thread
//     wall) of band metal each side, so the band must be 1.5 Ø wide; the dog reaches from the screw's axis over the
//     bore's fit and bevel to bear one land on the plate's flat back face, which leaves it far outboard of any counted
//     metal (the form fit keeps that PLATE_RIM_MARGIN inside the edge). Three dogs (§186's tripod: the fewest that seat
//     a plane), spread along the outline as far from the stem notches as the period allows, and their triangle must
//     contain the plate's centroid or the plate rocks on two.
//
// This is MODELLED, never simulated: no preload or shock is priced (no load spec exists for either), and the dogs'
// turning is a fitting operation, not a mechanism any axis poses.
import { UNIT_MM, CASE_CLEAR, CASE_BAND_T, STOCK_MIN_U, CLEAR_MARGIN, PLATE_RIM_MARGIN, CASE_SCREW_HEAD_D, CASE_SCREW_SHAFT_D, CASE_TUBE_D } from './layout.js';

// geometry.js' constants, restated by VALUE here because geometry.js imports three.js and a line spec is pure. The
// probe imports geometry.js under the native loader and holds each equal to its source (S0), so the two cannot part.
export const GEOMETRY_RULES = Object.freeze({ PLATE_BEVEL_F: 0.008, SEAT_FIT: 0.08, TUBE_WALL: 0.3 / UNIT_MM });

// ---- INPUTS: each a choice with its reason. A fork overrides these and only these. ----
export const CLAMP_INPUTS = Object.freeze({
  plateR_u: { v: 41.51616090422663, why: 'the radius the plate extrude\'s bevel rule reads (main.js plateR, measured on alarm=0&case=fitted; the fold passes the build\'s own)' },
  clampD_u: { v: 0.6 / UNIT_MM, why: 'the round build\'s smallest clamp stock (main.js CASE_CLAMP_SHAFT_D without the alarm, §325 landing 14): the next catalogue size up, Ø0.8 mm, needs a 3.17 u band' },
  dogs: { v: 3, why: '§186\'s tripod (CASE_CLAMP_N): the fewest bearings that seat a plane' },
});
const IN = (k, over) => (over && k in over ? over[k] : CLAMP_INPUTS[k].v);

// ---- the rows ----
export function solveClamp(over) {
  const { PLATE_BEVEL_F, SEAT_FIT, TUBE_WALL } = GEOMETRY_RULES;
  const plateR = IN('plateR_u', over), D = IN('clampD_u', over), N = IN('dogs', over);
  const bevel = plateR * PLATE_BEVEL_F;            // the plate's swell past its authored outline (makeBackPlate)
  const land = STOCK_MIN_U;                        // §62's land floor
  const boreBack = bevel + SEAT_FIT;               // locating: SEAT_FIT off the real reach
  const boreFront = -land;                         // the ledge's lip: one land onto the flat dial face
  const ledgeW = boreBack - boreFront;             // the ledge's radial width, bore wall to lip
  const dial = boreFront - CLEAR_MARGIN;           // the dial passes inside the lip
  const caseIn = CASE_CLEAR - boreBack;            // how far the band comes in against today's single bore
  const notchHalfW = CASE_TUBE_D / 2 + TUBE_WALL + CLEAR_MARGIN + bevel;   // §186 CASE_NOTCH_HALFW, carried whole
  const pitch = D / 4, headD = D * (CASE_SCREW_HEAD_D / CASE_SCREW_SHAFT_D);   // §186's thread wall, the 1.8:1 head
  const screw = boreBack + pitch + D / 2;          // the screw's axis, offset from the authored outline
  const bandNeed = 2 * pitch + D;                  // a thread wall each side
  const wallOut = boreBack + CASE_BAND_T - (screw + D / 2);   // band metal outboard of the tapped hole
  const dogTip = -land;                            // the dog bears one land on the flat back face
  const dogReach = screw - dogTip;                 // screw axis to the dog's tip
  const dogClear = PLATE_RIM_MARGIN + dogTip;      // the dog's tip to the counted metal, at the form fit's margin
  const dogHalfW = headD / 2;                      // the dog is as wide as the head that holds it
  const dogSpacing = notchHalfW + dogHalfW + CLEAR_MARGIN;   // §186's rule: a dog off a notch by notch + head + margin
  return { bevel, land, boreBack, boreFront, ledgeW, dial, caseIn, notchHalfW, D, pitch, headD, screw, bandNeed, wallOut,
    dogTip, dogReach, dogClear, dogHalfW, dogSpacing, N, eng: 0.7 / UNIT_MM,   // §3's engagement, as the round clamps (CASE_CLAMP_ENG)
    fit: (boreOff) => boreOff - bevel };   // the locating fit a bore at boreOff gives: §186's own measure, wall to real reach
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
