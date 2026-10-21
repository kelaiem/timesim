// §307 — THE FORM CASE: a RECTANGULAR case for the form movement, built the
// way `makeCase` (geometry.js) builds the round one, with the lathe's one
// profile replaced by ONE outline law. Every wall here is an OFFSET of the
// plate's own rectangle — `formLoop(form, { grow })` (layout.js), the loop the
// plate, the dial and the opening are all cut from — so the band, the bezel,
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
  caseLugPlan, formLoop,
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
// plate's rectangle (the rules in the header). Pure, so an instrument reads
// the same loops the build does.
export function formCaseLoops(form) {
  return {
    plate: formLoop(form, { grow: 0 }),
    bore: formLoop(form, { grow: CASE_CLEAR }),
    outer: formLoop(form, { grow: CASE_CLEAR + CASE_BAND_T }),
    opening: formLoop(form, { grow: -1 / UNIT_MM }),
    crystal: formLoop(form, { grow: -0.5 / UNIT_MM }),
  };
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
// main.js's CASE_DIMS; `form` is layout.js's `formRect` in the movement frame.
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
  const apHole = formApertureGrow === null ? { r: apertureR } : formLoop(form, { grow: formApertureGrow });
  const glassLoop = formGlassGrow === null ? null : formLoop(form, { grow: formGlassGrow });
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
  // turning. Three prisms of the outer loop, each the next z band down the
  // round profile's frontRun, merged:
  //   · the LIP, zBezelOuter..zCrystOuter, bored to the OPENING (dial − 1 mm):
  //     the metal that covers the crystal's edge;
  //   · the SEAT, zCrystOuter..zCrystInner, bored to the CRYSTAL loop: the
  //     crystal's own edge wall (R_CRYST on both sides in makeCase — the
  //     crystal is pressed into its seat and trapped under the lip, no floor);
  //   · the BAND, zCrystInner..z0, bored to the BORE (plate + CASE_CLEAR): the
  //     0.3 mm step to zBandFront and the band behind it are one bore here.
  // The faces two prisms share at a plane are doubled inside the metal, the
  // sector caps' own precedent in makeCase. Not cut: the midcase step at
  // zStep (prototype — one outer plane from the bezel to the back).
  const middleGeo = mergeGeos([
    prism(loops.outer, [loops.opening], zBezelOuter, zCrystOuter),
    prism(loops.outer, [loops.crystal], zCrystOuter, zCrystInner),
    prism(loops.outer, [loops.bore], zCrystInner, z0),
  ]);
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
    grp.userData.tube = { az, off, inboard, outboard, len };
    middleAsm.add(grp);
    return grp;
  };
  tubeAt(stemAz, tubeD, stemZ, 'caseCrownTube');
  tubeAt(alarmAz, tubeD, alarmZ, 'caseAlarmTube');
  tubeAt(pusherAz, pusherD, pusherZ, 'casePusherBore', true, pusherOff);

  // THE LUGS, at the SHORT ends (the long side is y, 12–6 o'clock): the
  // round case's §280 lug block, each lug ONE OUTLINE from caseLugPlan on
  // its `flat` path — welded to the end wall's plane, which stands
  // rOut = (yMax or −yMin) + G from the pair axis's origin along ±y. The pair
  // axis runs through the RECTANGLE's centreline x = form.cx (the strap is
  // centred on the case, not on the hands), so every x below carries it.
  const lugPlans = [];
  const lugCtrSpan = lugSpanInner + CASE_LUG_T;   // the dims quantity is the INTERIOR gap
  // The end wall is flat only between its corner rounds (formLoop's grown
  // corner, cornerR + G); a lug past that run would be welded to a curve the
  // flat plan does not describe.
  {
    const flatHalf = form.hw - form.cornerR;      // (hw + G) − (cornerR + G)
    const need = lugCtrSpan / 2 + CASE_LUG_T / 2;
    if (!(need <= flatHalf + 1e-9))
      console.warn(`makeFormCase: the lugs' outboard faces reach ${need.toFixed(3)} u off the centreline, past the end wall's `
        + `flat run ${flatHalf.toFixed(3)} u — the outer lugs stand on the corner rounds`);
  }
  for (const lugAz of [Math.PI / 2, -Math.PI / 2]) {
    const u = { x: Math.cos(lugAz), y: Math.sin(lugAz) };
    const perp = { x: -u.y, y: u.x };
    const rOut = (lugAz > 0 ? form.yMax : -form.yMin) + G;   // the end wall's plane, from the origin along u
    const rBore = rOut - CASE_BAND_T;                         // the bore wall behind it
    const plan = caseLugPlan({ rOut, rBore, off: lugCtrSpan / 2,
      zWallLo: zStep, zWallHi: zMidBack, zBack: z0, flat: true });
    for (const w of plan.warn) console.warn(`makeFormCase §280 lug: ${w}`);
    lugPlans.push(plan);
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
  g.userData.assemblies = { middle: middleAsm, back: backAsm, front: frontAsm };
  return g;
}
