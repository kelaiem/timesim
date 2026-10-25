// §307 — THE FORM CASE: a FORM case for the form movement, built the
// way `makeCase` (geometry.js) builds the round one, with the lathe's one
// profile replaced by ONE outline law. Every wall here is an OFFSET of the
// plate's own SHAPE — `form.loop({ grow })`, §308's caseShapeOf (layout.js:
// rect, cushion or tonneau), the loop the plate, the dial and the opening are
// all cut from — so the band, the bezel,
// the crystal and the opening are concentric by construction, and each grow is
// the round case's radial rule restated on the loop:
//
//   bore     = plate + CASE_CLEAR                 (R_IN = plateR + 1 mm)
//   outer    = plate + CASE_CLEAR + CASE_BAND_T   (R_OUT = R_IN + 1 mm)
//   opening  = plate − 1 mm                       (R_BEZEL_IN = dialR − 1 mm: the
//                                                  bezel covers 1 mm of the dial's edge)
//   crystal  = plate − 0.5 mm                     (R_CRYST: trapped under the lip)
//
// The z stations are the round case's CASE_DIMS, unchanged: the dial side is
// −z (the crystal at the most negative z, the back at the most positive — the
// convention the round builder learned by putting the caseback through the
// dial). The frame is the MOVEMENT's, untransformed, which is the frame
// `formRect` was solved in; `main.js` adds the group to `movement`.
//
// PROTOTYPE, and every line that is one says so: the back is a plain plate
// (no thread, no gasket), the band is not bored for the tubes (the round
// case's declared CSG debt, kept), and the step the round midcase carries at
// zStep is not cut — the outer wall is one plane from the bezel to the back.
//
// Every body is a CLOSED solid wound outward (the parity raycast in
// `meshClearance` reads an open mesh as solid behind its missing face —
// CLAUDE.md's trap, TODO 27): an ExtrudeGeometry of a Shape with holes is
// closed by construction, the sleeves are `ringExtrude` (capped annuli), and
// every merged body is held by a signed-volume warn at the build.
import * as THREE from 'three';
import {
  UNIT_MM, CLEAR_MARGIN, STOCK_MIN_U, CASE_CLEAR, CASE_BAND_T, CASE_WIDTH_MAX,
  CASE_LUG_T, CASE_LUG_EDGE_R, CASE_SPRING_BAR_D, CASE_SPRING_BAR_TIP_D,
  caseLugPlan,
} from './layout.js';
import { makeRoundedSlab, PLATE_BEVEL_F, COLLAR_PROUD, TUBE_WALL } from './geometry.js';
import { CASE_POLISH_ATTR } from './materials.js';

// The press-contact idiom (makeCase's own `SEAT_EMBED`, geometry.js): two
// exactly-coplanar faces z-fight, so a seated part sinks a sub-visible
// hundredth into what carries it. A private copy — makeCase keeps its own at
// function scope.
const SEAT_EMBED = 0.01 / UNIT_MM;
// The back glass's retaining LIP (makeCase's `lipT`: §3's stack, kept).
const LIP_T = 0.6 / UNIT_MM;
// The two crowns stand 1.5 mm proud of the band (makeCase's tube rule: a crown
// has to be gripped clear of the band); the collar is that reach's outer
// 0.5 mm (centre at 1.25 mm — makeCase's `alongAt(R_OUT) + 1.25 / UNIT_MM`).
const TUBE_PROUD = 1.5 / UNIT_MM;
const COLLAR_H = 0.5 / UNIT_MM;
const COLLAR_CENTRE = TUBE_PROUD - COLLAR_H / 2;
// Round holes and the discs that sit in them share ONE segment count, so a
// glass's edge ring and its channel's wall are the same polygon (two
// tessellations of one circle cross each other by their sagitta).
const ROUND_SEG = 96;

// A ray from `base` along `dir`, both [x, y] in the loop's frame: the FARTHEST
// distance at which it crosses an edge of the closed loop — the exit, for a
// base inside the loop. −Infinity when it never crosses. Pure: the sleeves'
// ends and the probes read one law.
export function rayExit(loop, dir, base = [0, 0]) {
  let tMax = -Infinity;
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = loop[i], [qx, qy] = loop[(i + 1) % n];
    const ex = qx - px, ey = qy - py;
    const den = dir[0] * ey - dir[1] * ex;          // cross(dir, edge); 0 = parallel
    if (Math.abs(den) < 1e-12) continue;
    const wx = px - base[0], wy = py - base[1];
    const t = (wx * ey - wy * ex) / den;            // along the ray
    const s = (wx * dir[1] - wy * dir[0]) / den;    // along the edge, 0..1 on it
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) tMax = Math.max(tMax, t);
  }
  return tMax;
}

// The four loops every part of the case is cut from, each one grow of the
// plate's shape (the rules in the header; `form` is a caseShapeOf shape, and
// `loop({ grow })` its true offset). Pure, so an instrument reads the same
// loops the build does.
//
// The rounded bezel (below) is swept round the outer loop, so every wall INSIDE
// it — bore, crystal, opening — is the outer loop's exact PARALLEL OFFSET by its
// own depth (`inward`, a mitre at each vertex), not a fresh sampling of the
// shape grown: one vertex per vertex, so the rounds, the seat the crystal is
// pressed into and the crystal itself are one polygon at each depth, and the
// hairlines (formCaseLines) lie on the metal's own vertices.
export function formCaseLoops(form) {
  const G = CASE_CLEAR + CASE_BAND_T;
  const outer = form.loop({ grow: G });
  const ring = (t) => inward(outer, t);
  return {
    plate: form.loop({ grow: 0 }),
    bore: ring(CASE_BAND_T),
    outer,
    opening: ring(G + 1 / UNIT_MM),
    crystal: ring(G + 0.5 / UNIT_MM),
    ring,   // the outer loop offset inward by t
  };
}
// A closed CCW convex polygon offset inward by t: each vertex moves along its
// mitre, p − t·(n₁ + n₂)/(1 + n₁·n₂), with n₁, n₂ the outward unit normals of its
// two edges — so every edge of the result is its edge moved exactly t inward.
// Held at the build: a depth past the loop's tightest curvature folds an edge
// over, which the caller's convexity check reads.
export function inward(pts, t) {
  const n = pts.length, en = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n], L = Math.hypot(bx - ax, by - ay) || 1e-12;
    en.push([(by - ay) / L, -(bx - ax) / L]);
  }
  return pts.map(([x, y], i) => {
    const a = en[(i + n - 1) % n], b = en[i], k = 1 + a[0] * b[0] + a[1] * b[1];
    return [x - t * (a[0] + b[0]) / k, y - t * (a[1] + b[1]) / k];
  });
}
// §289/§292 under a form — THE ROUNDED BEZEL'S PROFILE, makeCase's frontRun read
// as (depth inward from the outer loop, z) rather than (radius, z): the bore up
// to the crystal seat's floor, the seat wall, the lip's underside, STOCK_MIN_U of
// straight bore, the lip's quarter round onto the face, the flat, and the outer
// quarter ELLIPSE (reach `roundW` across the top, height bezelR down to the seat
// plane zBandFront, where the band's wall takes over tangent). The radii are
// CASE_DIMS' own (bezelR, bezelLipR) and the flat is the round case's
// (bezelFlat, BEZEL_FLAT_MM); only the reach is re-derived, because the face is
// the form's own width — the outer loop to the opening, G + 1 mm — so the reach
// is what that face leaves once the lip's round and the flat are taken out,
// makeCase's derivation on this face. Returns the profile as RUNS, each smooth
// along itself (shared vertices give it smooth normals), the corners between
// them sharp.
export function formBezelProfile(dims) {
  const { zBandFront, zCrystInner, zCrystOuter, zBezelOuter, bezelR, bezelLipR, bezelFlat } = dims;
  const G = CASE_CLEAR + CASE_BAND_T, face = G + 1 / UNIT_MM;
  const tBore = CASE_BAND_T, tCryst = G + 0.5 / UNIT_MM, tOpen = face;
  const roundW = face - bezelLipR - bezelFlat;
  const quarter = (ct, cz, rt, rz, a0, a1, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([ct - rt * Math.cos(a), cz + rz * Math.sin(a)]); }
    return pts;
  };
  // (t = depth inward, z): makeCase's radius r reads t = R_out − r, so its angles carry over with the t axis flipped
  const lip = quarter(tOpen - bezelLipR, zBezelOuter + bezelLipR, bezelLipR, bezelLipR, Math.PI, 1.5 * Math.PI, 3);
  const outer = quarter(roundW, zBezelOuter + bezelR, roundW, bezelR, 1.5 * Math.PI, 2 * Math.PI, 12);
  const runs = [
    [[tBore, zBandFront], [tBore, zCrystInner]],                 // the bore, up to the seat's floor
    [[tBore, zCrystInner], [tCryst, zCrystInner]],                // the seat's floor
    [[tCryst, zCrystInner], [tCryst, zCrystOuter]],               // the seat wall (the crystal's edge)
    [[tCryst, zCrystOuter], [tOpen, zCrystOuter]],                // the lip's underside, over the crystal's face
    [[tOpen, zCrystOuter], ...lip, ...outer],                     // the bore, the lip round, the flat (lip's end to the round's start), the outer round
    [[0, zBandFront], [tBore, zBandFront]],                       // the seat plane, shared with the band (inside the metal)
  ];
  // §292's measured wall: the nearest the outer round comes to the seat and the bore behind it
  const segD = ([pt, pz], [at, az], [ct, cz]) => { const dt = ct - at, dz = cz - az, k = Math.max(0, Math.min(1, ((pt - at) * dt + (pz - az) * dz) / (dt * dt + dz * dz)));
    return Math.hypot(pt - at - k * dt, pz - az - k * dz); };
  const inner = [[tBore, zBandFront], [tBore, zCrystInner], [tCryst, zCrystInner], [tCryst, zCrystOuter], [tOpen, zCrystOuter]];
  let minWall = Infinity;
  for (const p of quarter(roundW, zBezelOuter + bezelR, roundW, bezelR, 1.5 * Math.PI, 2 * Math.PI, 400))
    for (let i = 0; i + 1 < inner.length; i++) minWall = Math.min(minWall, segD(p, inner[i], inner[i + 1]));
  return { runs, roundW, lipR: bezelLipR, flat: bezelFlat, minWall, tOpen, tCryst, tBore };
}
// A profile run swept round a loop: ring(t) at each run point, quads between
// consecutive rings, indexed so the run is smooth along itself and round the loop.
function sweepRun(ring, run) {
  const rings = run.map(([t, z]) => ring(t).map(([x, y]) => [x, y, z]));
  const n = rings[0].length, pos = new Float32Array(rings.length * n * 3), idx = [];
  rings.forEach((r, j) => r.forEach((p, i) => pos.set(p, (j * n + i) * 3)));
  for (let j = 0; j + 1 < rings.length; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + (i + 1) % n, d = (j + 1) * n + i;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// Every turn of a closed CCW loop left (a fold reads as a right turn).
function loopConvex(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[(i + n - 1) % n], [bx, by] = pts[i], [cx, cy] = pts[(i + 1) % n];
    if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) < -1e-9) return false;
  }
  return true;
}
// Turn a non-indexed body inside-out in place: swap each triangle's last two
// vertices and negate the normals.
function flipWinding(g) {
  const p = g.attributes.position.array, nr = g.attributes.normal?.array;
  for (let t = 0; t < p.length; t += 9) for (let k = 0; k < 3; k++) {
    const a = t + 3 + k, b = t + 6 + k; [p[a], p[b]] = [p[b], p[a]];
    if (nr) [nr[a], nr[b]] = [nr[b], nr[a]];
  }
  if (nr) for (let i = 0; i < nr.length; i++) nr[i] = -nr[i];
  g.attributes.position.needsUpdate = true;
}
// Signed volume of a geometry, indexed or not: the sum over triangles of the
// scalar triple product over six (makeCase's volume check). Negative is a
// body wound inside-out — FrontSide culling hides it while every instrument
// still measures it solid (TODO 123).
export function signedVolume(geo) {
  const p = geo.attributes.position, idx = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), x = new THREE.Vector3();
  const nT = idx ? idx.count : p.count;
  let v = 0;
  for (let t = 0; t < nT; t += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(t) : t);
    b.fromBufferAttribute(p, idx ? idx.getX(t + 1) : t + 1);
    c.fromBufferAttribute(p, idx ? idx.getX(t + 2) : t + 2);
    v += a.dot(x.crossVectors(b, c)) / 6;
  }
  return v;
}

// Concatenate geometries into one body — a private copy of makeCase's
// `mergeGeos` (geometry.js; it is function-scoped there). No
// BufferGeometryUtils is vendored; §81's weldTree indexes whatever reaches the
// scene, so emitting non-indexed costs nothing.
function mergeGeos(geos) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of flat) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let w = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, w);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, w);
    w += g.attributes.position.count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// Flat annulus extruded along +Z, centred on z = 0 — a private copy of
// geometry.js's unexported `ringExtrude` (the tubes' capped sleeve, makeCase's
// own choice: "a CAPPED SLEEVE, not a bore surface").
function ringExtrude(outerR, innerR, thickness, seg = 32) {
  const s = new THREE.Shape();
  s.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -thickness / 2);
  return g;
}

// A loop as a THREE.Shape (outer, CCW as formLoop emits it) with optional
// holes: each a loop wound the other way (CW), or a round hole { r } about the
// origin. Extruded between two z planes, whichever order they come in.
const toVec2 = (loop) => loop.map(([x, y]) => new THREE.Vector2(x, y));
function prism(outer, holes, zA, zB, { seg = ROUND_SEG } = {}) {
  const shape = new THREE.Shape(toVec2(outer));
  for (const h of holes) {
    if (Array.isArray(h)) shape.holes.push(new THREE.Path(toVec2(h.slice().reverse())));
    else { const p = new THREE.Path(); p.absarc(0, 0, h.r, 0, Math.PI * 2, true); shape.holes.push(p); }
  }
  const zLo = Math.min(zA, zB), zHi = Math.max(zA, zB);
  const g = new THREE.ExtrudeGeometry(shape, { depth: zHi - zLo, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, zLo);
  return g;
}
// A round disc about the origin between two z planes, on ROUND_SEG.
function disc(r, zA, zB) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  const zLo = Math.min(zA, zB), zHi = Math.max(zA, zB);
  const g = new THREE.ExtrudeGeometry(s, { depth: zHi - zLo, bevelEnabled: false, curveSegments: ROUND_SEG });
  g.translate(0, 0, zLo);
  return g;
}
const holdWound = (geo, what) => {
  const v = signedVolume(geo);
  if (!(v > 0))
    console.warn(`makeFormCase: ${what} is wound inside-out (signed volume ${v.toFixed(2)} ≤ 0) — `
      + 'FrontSide culling will hide it while every instrument measures it solid');
  return geo;
};

// makeFormCase — the form case as a group `main.js` consumes exactly as it
// consumes makeCase's: `name` 'case', three assemblies (middle, back, front)
// under `userData.assemblies`, the same mesh names, `userData.lugPlans`, and
// `userData.casePart` on every mesh (the §62 keep-sweep opt-out). `dims` is
// main.js's CASE_DIMS; `form` is layout.js's `caseShapeOf` shape in the movement frame.
export function makeFormCase({ dims, form, material, crystalMaterial }) {
  const {
    UNIT_MM: U, z0, zMidBack, zStep, zBandFront, zCrystInner, zCrystOuter, zBezelOuter,
    crystT, tubeD, pusherD, stemAz, alarmAz, pusherAz, pusherOff, stemZ, alarmZ, pusherZ,
    lugSpanInner, apertureR, glassEdgeR, formApertureGrow = null, formGlassGrow = null,
  } = dims;
  // §307 landing 2 — THE BACK'S WINDOW IS THE PLATE'S SHAPE: main.js derives
  // it as grows of the plate's outline (the three-quarter plate's measured
  // swell plus the margin of sight; the glass one glass thickness past it), so
  // the lip's bore and the glazing channel are formLoop offsets like every
  // other wall here. The round apertureR/glassEdgeR stand only if not given.
  const apHole = formApertureGrow === null ? { r: apertureR } : form.loop({ grow: formApertureGrow });
  const glassLoop = formGlassGrow === null ? null : form.loop({ grow: formGlassGrow });
  if (U !== undefined && Math.abs(U - UNIT_MM) > 1e-12)
    console.warn(`makeFormCase: dims.UNIT_MM ${U} is not layout.js's ${UNIT_MM}`);
  const loops = formCaseLoops(form);
  const G = CASE_CLEAR + CASE_BAND_T;        // the outer wall's grow: clearance plus band wall
  const g = new THREE.Group();
  g.name = 'case';

  // THE WIDTH CAP (layout.js: the owner's 40 mm, crown excluded). The band's
  // short side is x, so its half-width is the plate's plus the two grows.
  const halfW = form.hw + G;
  if (!(halfW <= CASE_WIDTH_MAX))
    console.warn(`makeFormCase: the band's half-width ${halfW.toFixed(3)} u (${(halfW * UNIT_MM).toFixed(2)} mm) `
      + `is over CASE_WIDTH_MAX ${CASE_WIDTH_MAX.toFixed(3)} u`);

  // CASE MIDDLE — the band and the bezel as ONE body, the round case's one
  // turning. The walls are the round profile's frontRun on the form's loops:
  //   · the LIP, zBezelOuter..zCrystOuter, bored to the OPENING (dial − 1 mm):
  //     the metal that covers the crystal's edge;
  //   · the SEAT, zCrystOuter..zCrystInner, bored to the CRYSTAL loop: the
  //     crystal's own edge wall (R_CRYST on both sides in makeCase — the
  //     crystal is pressed into its seat and trapped under the lip, no floor);
  //   · the BAND, zCrystInner..z0, bored to the BORE (plate + CASE_CLEAR): the
  //     0.3 mm step to zBandFront and the band behind it are one bore here.
  // The face the sweep and the band share at zBandFront is doubled inside the
  // metal, the sector caps' own precedent in makeCase. Not cut: the midcase step
  // at zStep (prototype — one outer plane from the bezel's round to the back).
  //
  // §289/§292 — AND THE BEZEL IS THE ROUND CASE'S ROUNDED ONE: everything in
  // front of the seat plane zBandFront is formBezelProfile swept round the outer
  // loop (the round case's lathe, read along the form), and the band is the
  // prism behind it. The runs are wound one way; the merged body's signed volume
  // says which, and the whole is turned once if it came out inside-out.
  const bezel = formBezelProfile(dims);
  if (!(bezel.flat > 0) || !(bezel.roundW > 0) || !(bezel.lipR > 0))
    console.warn(`makeFormCase §289: the ${form.kind}'s rounded bezel — outer round ${bezel.roundW.toFixed(3)}, lip round ${bezel.lipR.toFixed(3)}, flat ${bezel.flat.toFixed(3)} — needs all three > 0`);
  if (!(bezel.minWall >= STOCK_MIN_U))
    console.warn(`makeFormCase §292: the ${form.kind}'s bezel round leaves ${bezel.minWall.toFixed(3)} u of metal over the crystal seat, under §50's floor ${STOCK_MIN_U.toFixed(3)}`);
  {
    const deepest = loops.ring(bezel.tOpen);
    if (!(loopConvex(deepest)))
      console.warn(`makeFormCase §289: the ${form.kind}'s outer loop offset ${bezel.tOpen.toFixed(3)} inward folds over — the bezel's opening is deeper than the outline's tightest curvature`);
  }
  const sweep = mergeGeos(bezel.runs.map((run) => { const r = sweepRun(loops.ring, run); r.computeVertexNormals(); return r; }));
  if (signedVolume(sweep) < 0) flipWinding(sweep);
  const middleGeo = mergeGeos([sweep, prism(loops.outer, [loops.bore], zBandFront, z0)]);
  holdWound(middleGeo, 'the case middle');
  // §289 — the bezel's metal is the part in front of the seat plane
  // zBandFront, and the brush shader (materials.js, CASE_POLISH_ATTR) polishes
  // exactly that: each vertex (1, the signed distance in front of the plane),
  // linear in position so a straddling triangle interpolates it exactly.
  {
    const p = middleGeo.attributes.position, n = p.count, a = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a[2 * i] = 1; a[2 * i + 1] = zBandFront - p.getZ(i); }
    middleGeo.setAttribute(CASE_POLISH_ATTR, new THREE.BufferAttribute(a, 2));
  }
  const middle = new THREE.Mesh(middleGeo, material);
  middle.name = 'caseMiddle';
  const middleAsm = new THREE.Group();
  middleAsm.name = 'caseMiddleAssembly';
  middleAsm.add(middle);
  g.add(middleAsm);
  const backAsm = new THREE.Group();
  backAsm.name = 'caseBackAssembly';
  g.add(backAsm);
  const frontAsm = new THREE.Group();
  frontAsm.name = 'caseCrystalAssembly';
  g.add(frontAsm);

  // THE FRONT CRYSTAL: the crystal loop, zCrystOuter..zCrystInner, its edge on
  // the seat's wall and its outer face under the lip — makeCase's crystal
  // (`[R_CRYST, zCrystOuter]..[R_CRYST, zCrystInner]`) on the loop.
  const crystal = new THREE.Mesh(holdWound(prism(loops.crystal, [], zCrystOuter, zCrystInner), 'the crystal'), crystalMaterial);
  crystal.name = 'caseCrystal';
  frontAsm.add(crystal);

  // THE BACK — PROTOTYPE: a plain plate of the outer loop, z0 back to
  // zMidBack, with the display aperture; no thread and no gasket (the round
  // case's threaded ring, its skirt and its I-ring are not built here, so
  // the §187 claims — a back that unscrews, a sealed face — are NOT made).
  // Two prisms merged: the retaining LIP (z0 − LIP_T..z0, bored to the
  // aperture) and the glazing CHANNEL below it (zMidBack..z0 − LIP_T, bored
  // to the glass's edge: the glass locates on the wall directly, there being
  // no gasket to locate it on).
  const zCrystOut = z0 - LIP_T;              // the glass's outer face, under the lip
  const zCrystIn = zCrystOut - crystT;       // its inner face — the band's back plane when z0 = zMidBack + 1.2 mm (CASE_DIMS)
  if (!(zCrystIn >= zMidBack - 1e-9))
    console.warn(`makeFormCase: the back glass's inner face ${zCrystIn.toFixed(3)} stands ${(zMidBack - zCrystIn).toFixed(3)} u `
      + `below the plate's inner face ${zMidBack.toFixed(3)} — into the back envelope's margin`);
  if (formGlassGrow === null && !(glassEdgeR > apertureR + STOCK_MIN_U))
    console.warn(`makeFormCase: the lip over the back glass is ${(glassEdgeR - apertureR).toFixed(3)} u wide, under §50's ${STOCK_MIN_U.toFixed(3)}`);
  const backGeo = mergeGeos([
    prism(loops.outer, [apHole], zCrystOut, z0),
    prism(loops.outer, [glassLoop ?? { r: glassEdgeR }], zMidBack, zCrystOut),
  ]);
  holdWound(backGeo, 'the case back');
  const back = new THREE.Mesh(backGeo, material);
  back.name = 'caseBack';
  backAsm.add(back);
  // The back glass: a disc of the channel's radius, crystT thick, pressed
  // SEAT_EMBED UNDER the lip — the press idiom with the sign that presses
  // (makeCase's back pane; the inspect.js row `caseBackCrystal ⇄ caseBack`
  // declares exactly this). Flat: the round case's raised step over the alarm
  // tower is not built (prototype — the plate stands at zMidBack everywhere).
  const backCrystal = new THREE.Mesh(holdWound(glassLoop ? prism(glassLoop, [], zCrystIn, zCrystOut + SEAT_EMBED) : disc(glassEdgeR, zCrystIn, zCrystOut + SEAT_EMBED), 'the back glass'), crystalMaterial);
  backCrystal.name = 'caseBackCrystal';
  backAsm.add(backCrystal);

  // THE TUBES — makeCase's `tubeAt` on the loops. A capped sleeve on each
  // stem's own line at the stem's own z: `az` the line's azimuth, `off` its
  // perpendicular offset from the centre (the pusher runs PARALLEL to a
  // radius, ALARM_PUSH_CHORD off it; both crowns are radial, off = 0).
  //   · The INBOARD end stops short of the plate by CLEAR_MARGIN: the plate
  //     loop's exit along the tube's axis AND its two in-plane rim lines (the
  //     end face's extreme points against a prismatic wall — makeCase's
  //     "the rim's nearest point clears the plate" rule), the farthest taken,
  //     swelled by the plate's extrude bevel (PLATE_BEVEL_F — the round
  //     plate's fraction, standing in until the form plate's own bevel is
  //     measured; CASE_DIMS.tubeClearR's rule). A flush bore instead lands
  //     SEAT_EMBED into the BORE wall (makeCase §187: the pusher's sleeve
  //     lines the band's own hole and nothing more).
  //   · The OUTBOARD end is the axis's exit from the OUTER loop
  //     (makeCase's `alongAt(R_OUT)`), plus TUBE_PROUD for a crown; flush for
  //     the pusher.
  // TODO (§307, prototype): the band is NOT bored for them — the sleeve
  // stands in solid band metal, the same declared CSG debt the round case
  // carries for its radial bores.
  const tubeAt = (az, d, z, name, flush = false, off = 0) => {
    const r = d / 2, rw = r + TUBE_WALL;
    const dir = [Math.cos(az), Math.sin(az)], perp = [-Math.sin(az), Math.cos(az)];
    const lineAt = (k) => [perp[0] * (off + k), perp[1] * (off + k)];
    let inboard;
    if (flush) {
      inboard = rayExit(loops.bore, dir, lineAt(0)) - SEAT_EMBED;
    } else {
      let reach = -Infinity;
      for (const k of [-rw, 0, rw]) reach = Math.max(reach, rayExit(loops.plate, dir, lineAt(k)));
      inboard = reach * (1 + PLATE_BEVEL_F) + CLEAR_MARGIN;
    }
    const outerExit = rayExit(loops.outer, dir, lineAt(0));
    const outboard = flush ? outerExit : outerExit + TUBE_PROUD;
    const len = outboard - inboard;
    if (!(len > 0))
      console.warn(`makeFormCase: ${name} has no length — its inboard standoff (${inboard.toFixed(3)}) `
        + `has passed its outboard end (${outboard.toFixed(3)}); the opening is off the band`);
    // The stems' own convention (makeCase): cylinder axis Y, the pivot's
    // z-rotation maps +Y outboard along the azimuth, and the pivot steps
    // sideways onto the opening's real line (+X is the perpendicular).
    const pivot = new THREE.Group();
    pivot.rotation.z = az - Math.PI / 2;
    pivot.position.z = z;
    pivot.position.x = perp[0] * off;
    pivot.position.y = perp[1] * off;
    const sleeve = new THREE.Mesh(ringExtrude(rw, r, Math.max(len, 1e-6), 20), material);
    sleeve.geometry.rotateX(-Math.PI / 2);  // ringExtrude runs +Z; the stems run +Y
    sleeve.position.y = inboard + len / 2;
    sleeve.name = `${name}Sleeve`;
    pivot.add(sleeve);
    if (!flush) {
      // The collar: the tube's outer flange, bored to the sleeve's r (a flange
      // on a tube is an annulus), the outer 0.5 mm of the proud reach.
      const collar = new THREE.Mesh(ringExtrude(r + COLLAR_PROUD, r, COLLAR_H, 20), material);
      collar.geometry.rotateX(-Math.PI / 2);
      collar.position.y = outerExit + COLLAR_CENTRE;
      collar.name = `${name}Collar`;
      pivot.add(collar);
    }
    const grp = new THREE.Group();
    grp.add(pivot);
    grp.name = name;
    grp.userData.tube = { az, off, inboard, outboard, len, d, z };   // the drawing (formCaseLines) reads the built tube, never the dims again
    middleAsm.add(grp);
    return grp;
  };
  tubeAt(stemAz, tubeD, stemZ, 'caseCrownTube');
  tubeAt(alarmAz, tubeD, alarmZ, 'caseAlarmTube');
  tubeAt(pusherAz, pusherD, pusherZ, 'casePusherBore', true, pusherOff);

  // THE LUGS, at the shape's ±y extremes (12–6 o'clock): the
  // round case's §280 lug block, each lug ONE OUTLINE from caseLugPlan on
  // its `flat` path — welded to the end wall's plane, which stands
  // rOut (the outer shape's exit along ±y at the centreline) from the pair
  // axis's origin. The pair
  // axis runs through the SHAPE's centreline x = form.cx (the strap is
  // centred on the case, not on the hands), so every x below carries it.
  const lugPlans = [];
  const lugCtrSpan = lugSpanInner + CASE_LUG_T;   // the dims quantity is the INTERIOR gap
  // §308 — THE END WALL, read off the OUTER shape (the form grown G) for any
  // kind: along ±y from the pair axis's base (x, 0) the ray's exit is where the
  // band's outer wall stands at that x. The lug is welded to the plane through
  // the wall at the centreline (rOut); a curved end (the cushion's, a rect's
  // corner round) FALLS away from that plane toward the lugs' outboard faces,
  // and a fall past CLEAR_MARGIN — the one margin, under which two surfaces
  // read as touching — is a flat lug standing proud of the curve it is said
  // to be welded to: warned with the numbers, never absorbed.
  const outerShape = form.grown(G);
  const endAt = (lugAz, x) => outerShape.exit(lugAz, lugAz > 0 ? -x : x);   // the wall's distance from y = 0 at x
  const need = lugCtrSpan / 2 + CASE_LUG_T / 2;
  for (const lugAz of [Math.PI / 2, -Math.PI / 2]) {
    const rC = endAt(lugAz, form.cx);
    const fall = rC - Math.min(endAt(lugAz, form.cx - need), endAt(lugAz, form.cx + need));
    if (!(fall <= CLEAR_MARGIN))
      console.warn(`makeFormCase: the ${form.kind}'s ${lugAz > 0 ? '+y' : '−y'} end wall falls ${fall.toFixed(3)} u from the lug plane `
        + `at the lugs' outboard faces (${need.toFixed(3)} u off the centreline) — over CLEAR_MARGIN ${CLEAR_MARGIN}: the flat lugs stand proud of a curved end`);
  }
  for (const lugAz of [Math.PI / 2, -Math.PI / 2]) {
    const u = { x: Math.cos(lugAz), y: Math.sin(lugAz) };
    const perp = { x: -u.y, y: u.x };
    const rOut = endAt(lugAz, form.cx);   // the end wall at the centreline, from the origin along u
    const rBore = rOut - CASE_BAND_T;                         // the bore wall behind it
    const plan = caseLugPlan({ rOut, rBore, off: lugCtrSpan / 2,
      zWallLo: zStep, zWallHi: zMidBack, zBack: z0, flat: true });
    for (const w of plan.warn) console.warn(`makeFormCase §280 lug: ${w}`);
    lugPlans.push({ ...plan, az: lugAz });   // the azimuth placed it, so the drawing (formCaseLines) places the same outline
    const shape = new THREE.Shape(plan.outline.map(([pu, pz]) => new THREE.Vector2(pu, pz)));
    const hole = new THREE.Path();
    hole.absarc(plan.hole.u, plan.hole.z, plan.hole.r, 0, 2 * Math.PI, true);
    shape.holes.push(hole);
    const rc = CASE_LUG_EDGE_R;
    // The lug's frame (makeCase): u along the pair axis, z the world's, the
    // extrusion across the strap — u × ẑ = −perp keeps the basis right-handed.
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(u.x, u.y, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-perp.x, -perp.y, 0));
    for (const s of [-1, 1]) {
      const off = s * lugCtrSpan / 2;
      const geo = makeRoundedSlab(shape, { thickness: CASE_LUG_T, edgeR: rc });
      geo.applyMatrix4(basis);
      geo.translate(perp.x * off + form.cx, perp.y * off, 0);
      const lug = new THREE.Mesh(geo, material);
      lug.name = 'caseLug';
      middleAsm.add(lug);
    }
    // The spring bar as makeCase makes it: a Ø1.5 TUBE between the facing
    // walls and a Ø0.8 tip PIN at each end, bored one CLEAR_MARGIN over the
    // pin; the spring between the pins is not modelled.
    const bodyR = CASE_SPRING_BAR_D / 2, tipR = CASE_SPRING_BAR_TIP_D / 2;
    const boreR = tipR + CLEAR_MARGIN;
    const hl = lugSpanInner / 2, tl = CASE_LUG_T - rc;
    if (!(bodyR - boreR >= STOCK_MIN_U))
      console.warn(`makeFormCase §280: the spring bar's tube wall ${(bodyR - boreR).toFixed(4)} is under §50's ${STOCK_MIN_U.toFixed(4)}`);
    const dir = { x: perp.x, y: perp.y };
    const tubeGeo = new THREE.LatheGeometry([
      new THREE.Vector2(boreR, -hl), new THREE.Vector2(bodyR, -hl),
      new THREE.Vector2(bodyR, hl), new THREE.Vector2(boreR, hl), new THREE.Vector2(boreR, -hl)], 12);
    const bar = new THREE.Mesh(tubeGeo, material);
    bar.geometry.rotateZ(-Math.PI / 2);   // axis → X
    bar.rotation.z = lugAz + Math.PI / 2; // X → the strap direction
    bar.position.set(u.x * plan.uBar + form.cx, u.y * plan.uBar, plan.zB);
    bar.name = 'caseSpringBar';
    middleAsm.add(bar);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(tipR, tipR, 2 * tl, 12), material);
      tip.geometry.rotateZ(-Math.PI / 2);
      tip.rotation.z = lugAz + Math.PI / 2;
      const c = hl;                                 // half in the lug, half guided in the tube
      tip.position.set(u.x * plan.uBar + dir.x * s * c + form.cx, u.y * plan.uBar + dir.y * s * c, plan.zB);
      tip.name = 'caseSpringBarTip';
      middleAsm.add(tip);
    }
  }
  g.userData.lugPlans = lugPlans;

  // The §62 keep sweep enrolls any mesh whose box crosses the three-quarter
  // plate's z-band as material the plate must carry; the case encloses the
  // plate BY DESIGN, so its meshes opt out here, on the part (makeCase's
  // rule). No `userData.r`: the schematic's rotor pass would draw a CIRCLE
  // for a part that is a rectangle, and a generic glyph is a claim (§78).
  g.traverse((o) => { if (o.isMesh) o.userData.casePart = true; });
  g.userData.form = form;
  g.userData.loops = loops;
  g.userData.bezel = bezel;   // §289 — the swept profile, for formCaseLines and the record (minWall)
  g.userData.assemblies = { middle: middleAsm, back: backAsm, front: frontAsm };
  return g;
}

// §307 landing 3 — THE FORM CASE AS LINES: what the schematic tier (main.js,
// §66/§71) draws for the housing under ?case=<kind>, read off the BUILT group
// makeFormCase returned and the same CASE_DIMS it was cut to — so the drawing
// cannot drift from the metal because there is nothing to drift FROM (the round
// drawing's own rule, which this block kept breaking: until landing 3 the tier
// drew the round case's CASE_DIMS circles round a form movement, the residue
// §307's record named). Lines only, no fills, the round drawing's convention —
// a case occluder would hide the very movement the tier exists to explain.
//
// Every ring is one of the loops a wall was cut from, at a z where that wall
// ENDS (an edge the metal has — the drawing says nothing the solid does not):
//   · outer   at zBandFront and z0: the one outer wall, from where the bezel's
//     round ends on it to the back (no midcase step — the prototype cuts none);
//   · bezel   at zBezelOuter, twice: the flat's two edges, where the outer round
//     and the lip's round leave it (§289, the round drawing's own two rings);
//   · opening at zBezelOuter + lipR and zCrystOuter: the lip's bore;
//   · crystal at zCrystOuter and zCrystInner: the seat wall's two ends, the
//     crystal's two faces;
//   · bore    at zCrystInner (the seat's floor steps out to it) and zMidBack
//     (the band's bore meets the back's inner face — a concave edge);
//   · aperture at z0 and z0 − LIP_T, glass at z0 − LIP_T and the glass's inner
//     face (and the channel's floor at zMidBack when the glass stops short of it).
// GENERATORS run down the outer wall at its four extremes (±x, ±y; on a straight
// side, the side's midpoint — the mean of the vertices sharing the extreme).
// TUBES are read from each tube group's own `userData.tube`: two lines at ±d/2
// (the bore's walls, the round drawing's convention) from the built inboard end
// to the built outboard end, on the tube's own line (`off` carries the pusher's
// chord). LUGS are the plans makeFormCase built (`userData.lugPlans`, each with
// the azimuth that placed it): the outline and the hole at each lug's centre
// plane — makeRoundedSlab's straight wall, so the outline IS the section there
// — and the spring bar as its AXIS between the two lugs (an axis line, the one
// line here that is inside metal rather than on it).
//
// Returns [{ what, closed, pts: [[x, y, z], …] }] in the movement frame, the
// frame the group stands in. Pure: an instrument reads the same list the tier
// draws, and holds every point to the solid (probe-schematic-form-case.mjs).
export function formCaseLines(g, dims) {
  const { form, loops, lugPlans } = g.userData;
  const { z0, zMidBack, zCrystInner, zCrystOuter, zBezelOuter, crystT, apertureR, glassEdgeR,
          formApertureGrow = null, formGlassGrow = null, lugSpanInner } = dims;
  const out = [];
  const ring = (what, loop, z) => out.push({ what, closed: true, pts: loop.map(([x, y]) => [x, y, z]) });
  const seg = (what, a, b) => out.push({ what, closed: false, pts: [a, b] });
  // A round hole's ring, on the segment count the solid's absarc holes use.
  const circle = (r) => { const pts = []; for (let k = 0; k < ROUND_SEG; k++) { const a = 2 * Math.PI * k / ROUND_SEG; pts.push([r * Math.cos(a), r * Math.sin(a)]); } return pts; };
  // The middle: the band's prism, and the rounded bezel swept in front of it
  // (§289 — the round drawing's three bezel rings: where the outer round meets
  // the flat, where the flat meets the lip's round, where that round meets the
  // bore; the outer wall's ring stands where the round ends on it, the seat plane).
  const { zBandFront } = dims, B = g.userData.bezel;
  ring('outer', loops.outer, zBandFront); ring('outer', loops.outer, z0);
  ring('bezel', loops.ring(B.roundW), zBezelOuter);
  ring('bezel', loops.ring(B.tOpen - B.lipR), zBezelOuter);
  ring('opening', loops.opening, zBezelOuter + B.lipR); ring('opening', loops.opening, zCrystOuter);
  ring('crystal', loops.crystal, zCrystOuter); ring('crystal', loops.crystal, zCrystInner);
  ring('bore', loops.bore, zCrystInner); ring('bore', loops.bore, zMidBack);
  // The back (its two prisms and the glass), the same stations makeFormCase cut.
  const zCrystOut = z0 - LIP_T, zCrystIn = zCrystOut - crystT;
  const apLoop = formApertureGrow === null ? circle(apertureR) : form.loop({ grow: formApertureGrow });
  const glLoop = formGlassGrow === null ? circle(glassEdgeR) : form.loop({ grow: formGlassGrow });
  ring('aperture', apLoop, z0); ring('aperture', apLoop, zCrystOut);
  ring('glass', glLoop, zCrystOut); ring('glass', glLoop, zCrystIn);
  if (zCrystIn - zMidBack > 1e-9) ring('glass', glLoop, zMidBack);
  // Generators at the outer wall's four extremes.
  for (const [i, sgn] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
    let ext = -Infinity;
    for (const p of loops.outer) ext = Math.max(ext, sgn * p[i]);
    const at = loops.outer.filter((p) => sgn * p[i] >= ext - 1e-9);
    const x = at.reduce((a, p) => a + p[0], 0) / at.length, y = at.reduce((a, p) => a + p[1], 0) / at.length;
    seg('generator', [x, y, zBandFront], [x, y, z0]);
  }
  // The tubes, as built.
  g.traverse((o) => {
    const t = o.userData?.tube;
    if (!t) return;
    const dir = [Math.cos(t.az), Math.sin(t.az)], perp = [-Math.sin(t.az), Math.cos(t.az)];
    for (const s of [-1, 1]) {
      const k = t.off + s * t.d / 2;
      seg('tube', [dir[0] * t.inboard + perp[0] * k, dir[1] * t.inboard + perp[1] * k, t.z],
                  [dir[0] * t.outboard + perp[0] * k, dir[1] * t.outboard + perp[1] * k, t.z]);
    }
  });
  // The lugs, as planned.
  const span = lugSpanInner + CASE_LUG_T;        // centre to centre — the dims quantity is the interior gap
  for (const plan of lugPlans) {
    const u = [Math.cos(plan.az), Math.sin(plan.az)], perp = [-u[1], u[0]];
    const at = (pu, pz, off) => [u[0] * pu + perp[0] * off + form.cx, u[1] * pu + perp[1] * off, pz];
    for (const s of [-1, 1]) {
      const off = s * span / 2;
      out.push({ what: 'lug', closed: true, pts: plan.outline.map(([pu, pz]) => at(pu, pz, off)) });
      const hole = [];
      for (let k = 0; k < 24; k++) { const th = 2 * Math.PI * k / 24; hole.push(at(plan.hole.u + plan.hole.r * Math.cos(th), plan.hole.z + plan.hole.r * Math.sin(th), off)); }
      out.push({ what: 'lugHole', closed: true, pts: hole });
    }
    seg('lugBar', at(plan.uBar, plan.zB, -span / 2), at(plan.uBar, plan.zB, span / 2));
  }
  return out;
}
