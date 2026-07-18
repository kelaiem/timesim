// src/geometry.js — horological geometry builders (Agent A).
// Every builder returns a THREE.Group (or Mesh) built lying in the XY plane,
// centered at the origin, rotating about local +Z. userData.r = pitch/functional
// radius where meaningful. Real tooth profiles via Shape/ExtrudeGeometry.
import * as THREE from 'three';
import { MATS } from './materials.js';
import { aesthetics } from './aesthetics.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function pitchRadius(module, teeth) {
  return (module * teeth) / 2;
}

// Flat annulus (ring) extruded along +Z, centered on z=0. Used for hubs, rims,
// jewel chatons — anything that needs a clean central bore.
function ringExtrude(outerR, innerR, thickness, seg = 32) {
  const s = new THREE.Shape();
  s.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: seg,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

// Build the outer contour of a spur-gear wheel: repeated trapezoid-with-rounded
// -tip teeth approximating a clock (cycloidal) tooth — angled flanks, relieved
// & rounded tips, root lands. Returns a THREE.Shape (caller adds crossings/bore).
function gearOutlineShape(teeth, rootR, pitchR, tipR, opts = {}) {
  const tipFrac = opts.tipFrac ?? 0.18; // half-width of tip land (fraction of pitch)
  const flankFrac = opts.flankFrac ?? 0.34; // where flank meets the root land
  const shape = new THREE.Shape();
  const pitch = (Math.PI * 2) / teeth;
  const P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < teeth; i++) {
    const c = i * pitch;
    const V = P(rootR, c - 0.5 * pitch); // valley (shared with previous tooth)
    const FL = P(rootR, c - flankFrac * pitch); // left root land / flank base
    const TL = P(tipR, c - tipFrac * pitch); // tip left corner
    const TC = P(tipR * 1.02, c); // tip round control (relieved)
    const TR = P(tipR, c + tipFrac * pitch); // tip right corner
    const FR = P(rootR, c + flankFrac * pitch); // right flank base
    if (i === 0) shape.moveTo(V[0], V[1]);
    else shape.lineTo(V[0], V[1]);
    shape.lineTo(FL[0], FL[1]);
    shape.lineTo(TL[0], TL[1]);
    shape.quadraticCurveTo(TC[0], TC[1], TR[0], TR[1]);
    shape.lineTo(FR[0], FR[1]);
    // straight run from FR to next valley forms the root land / valley floor
  }
  shape.closePath();
  return shape;
}

// Punch a central bore plus `spokes` crescent (annular-sector) cutouts into a
// wheel shape — the classic clock-wheel crossing. innerR/outerR bound the arms.
// armFrac is the fraction of the circumference kept as arm material: 0.15
// is skeleton-caliber openworking — the windows dominate and the wheel
// reads as rim + hub + slender spokes, yet 4–5 straight arms in
// compression/tension still close the load path from hub to rim.
function addCrossingHoles(shape, spokes, innerR, outerR, boreR, armFrac = 0.15) {
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  if (spokes > 0 && outerR > innerR) {
    const seg = (Math.PI * 2) / spokes;
    for (let i = 0; i < spokes; i++) {
      const a0 = i * seg + seg * armFrac * 0.5;
      const a1 = (i + 1) * seg - seg * armFrac * 0.5;
      const h = new THREE.Path();
      h.absarc(0, 0, outerR, a0, a1, false);
      h.absarc(0, 0, innerR, a1, a0, true);
      h.closePath();
      shape.holes.push(h);
    }
  }
}

// Archimedean spiral as a THREE.Curve for TubeGeometry (hairspring / mainspring).
class ArchimedeanSpiral extends THREE.Curve {
  constructor(innerR, outerR, coils, z = 0) {
    super();
    this.innerR = innerR;
    this.outerR = outerR;
    this.coils = coils;
    this.z = z;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const r = this.innerR + (this.outerR - this.innerR) * t;
    const a = t * this.coils * Math.PI * 2;
    return target.set(Math.cos(a) * r, Math.sin(a) * r, this.z);
  }
}

// ---------------------------------------------------------------------------
// Spur gear
// ---------------------------------------------------------------------------

// Involute/cycloidal-ish spur gear. pitchRadius = module*teeth/2 (userData.r).
export function makeGear({ module, teeth, thickness, boreR = 1, spokes = 5,
                           material, hub = true }) {
  const mat = material || MATS.brass;
  const pitchR = pitchRadius(module, teeth);
  const tipR = pitchR + module * 0.95;
  const rootR = pitchR - module * 1.15;
  const shape = gearOutlineShape(teeth, rootR, pitchR, tipR);

  // Skeleton-caliber proportions: hub pared to little more than the bore's
  // seat, wide windows, slender 15% arms (via addCrossingHoles' default) —
  // the windows dominate the face. The toothed rim keeps a 0.7·module band
  // beyond the root land: the earlier 0.45 push read paper-thin under the
  // bevel (0.22·module bite per edge left almost no flat face), so the rim
  // takes back a little meat while arms and hub stay at their leanest.
  const hubR = hub ? Math.max(boreR * 1.6, pitchR * 0.085) : boreR * 1.6;
  const innerR = Math.max(hubR + module * 0.35, boreR * 2.0);
  const outerR = rootR - module * 0.7;
  const useSpokes = outerR > innerR + module ? spokes : 0;
  addCrossingHoles(shape, useSpokes, innerR, outerR, boreR);

  const bevel = Math.min(thickness * 0.18, module * 0.22);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 3,
    steps: 1,
  });
  geo.translate(0, 0, -thickness / 2);

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  if (hub) {
    g.add(new THREE.Mesh(ringExtrude(hubR, boreR, thickness * 1.5, 24), mat));
  }
  g.userData.r = pitchR;
  return g;
}

// ---------------------------------------------------------------------------
// Pinion (small solid steel wheel with fat leaves)
// ---------------------------------------------------------------------------

export function makePinion({ module, teeth, thickness, material }) {
  const mat = material || MATS.steel;
  const pitchR = pitchRadius(module, teeth);
  const tipR = pitchR + module * 0.85;
  const rootR = pitchR - module * 0.95;
  const shape = gearOutlineShape(teeth, rootR, pitchR, tipR, {
    tipFrac: 0.26,
    flankFrac: 0.42,
  });
  const bore = new THREE.Path();
  bore.absarc(0, 0, Math.max(module * 0.35, 0.4), 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const bevel = Math.min(thickness * 0.15, module * 0.2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 3,
  });
  geo.translate(0, 0, -thickness / 2);

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  g.userData.r = pitchR;
  return g;
}

// ---------------------------------------------------------------------------
// Bevel gear — small conical gear for a shaft corner (default 45° half-angle,
// i.e. a standard miter pair for two shafts meeting at 90°). Built from the
// same flat tooth-outline as makePinion, then sheared so every vertex moves
// z += r·tan(coneAngle): the flat disc becomes a shallow cone whose apex sits
// at the local origin (r=0). Mount with the origin AT the shaft intersection
// and local +Z pointing back into the gear's own shaft (away from the other
// gear it meshes with) — same convention as a real bevel gear keyed to the
// end of its arbor, body trailing back along the shaft from the pitch point.
// ---------------------------------------------------------------------------
export function makeBevelGear({ teeth, module, coneAngleDeg = 45, faceWidth = 1.1, boreR = 0.4, material }) {
  const mat = material || MATS.steel;
  const pitchR = pitchRadius(module, teeth);
  const tipR = pitchR + module * 0.85;
  const rootR = pitchR - module * 0.95;
  const shape = gearOutlineShape(teeth, rootR, pitchR, tipR, { tipFrac: 0.26, flankFrac: 0.42 });
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: faceWidth, bevelEnabled: false, curveSegments: 3 });
  const taper = Math.tan(THREE.MathUtils.degToRad(coneAngleDeg));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.z += Math.hypot(v.x, v.y) * taper;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  g.userData.r = pitchR;
  return g;
}

// ---------------------------------------------------------------------------
// Escape wheel — 15 forward-leaning club teeth (Swiss lever style)
// ---------------------------------------------------------------------------

export function makeEscapeWheel({ teeth = 15, radius, thickness }) {
  const g = new THREE.Group();
  const mat = MATS.steel;
  const pitch = (Math.PI * 2) / teeth;
  const baseR = radius * 0.68;
  const P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const c = i * pitch;
    const V = P(baseR, c - 0.5 * pitch); // valley (scallop bottom)
    const cBack = P(baseR * 1.18, c - 0.12 * pitch); // concave back control
    const H = P(radius * 0.9, c + 0.03 * pitch); // club heel
    const T = P(radius, c + 0.22 * pitch); // club tip (leading, forward)
    const L = P(radius * 0.8, c + 0.17 * pitch); // locking-face foot (undercut hook)
    const cScal = P(baseR * 0.98, c + 0.34 * pitch); // scallop control
    const Vn = P(baseR, c + 0.5 * pitch); // next valley
    if (i === 0) shape.moveTo(V[0], V[1]);
    else shape.lineTo(V[0], V[1]);
    shape.quadraticCurveTo(cBack[0], cBack[1], H[0], H[1]); // rising back
    shape.lineTo(T[0], T[1]); // impulse face (slanted top of club)
    shape.lineTo(L[0], L[1]); // steep locking face / hook
    shape.quadraticCurveTo(cScal[0], cScal[1], Vn[0], Vn[1]); // deep scallop
  }
  shape.closePath();

  const boreR = Math.max(radius * 0.05, 0.5);
  const hubR = radius * 0.16;
  addCrossingHoles(shape, 4, hubR + radius * 0.05, baseR - radius * 0.06, boreR, 0.5);

  const bevel = Math.min(thickness * 0.25, radius * 0.02);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 3,
  });
  geo.translate(0, 0, -thickness / 2);
  g.add(new THREE.Mesh(geo, mat));
  g.add(new THREE.Mesh(ringExtrude(hubR, boreR, thickness * 1.3, 20), mat));
  g.userData.r = radius;
  return g;
}

// ---------------------------------------------------------------------------
// Pallet fork — pivots at origin, lever along -Y, anchor + ruby stones at +Y
// ---------------------------------------------------------------------------

export function makePalletFork({ span, leverLength, thickness, stoneZReach }) {
  const g = new THREE.Group();
  const t = thickness;
  const L = leverLength;
  const ax = span * 0.5; // stone x offset
  // Stone height above the pivot equals ax: when the assembly places the fork
  // pivot at (span/2 + sqrt(R^2 - (span/2)^2)) from the escape-wheel centre,
  // both stones land exactly ON the wheel rim (radius R), straddling it.
  const sy = ax;
  const leverHW = t * 0.6;
  const forkHW = t * 1.4;
  const notchHW = t * 0.7;
  const forkTop = -L * 0.8;
  const forkY = -L;

  // Single crafted body: anchor + belly + lever + fork horns + notch.
  const s = new THREE.Shape();
  s.moveTo(-ax - t * 0.7, sy + t * 0.4); // 1 left arm outer top
  s.lineTo(-ax + t * 0.5, sy - t * 0.5); // 2 left arm underside
  s.quadraticCurveTo(-t * 1.4, t * 0.2, -leverHW, -t * 0.4); // 3 belly -> lever
  s.lineTo(-leverHW, forkTop); // 4 lever left down
  s.lineTo(-forkHW, forkY + t * 0.15); // 5 left horn outer
  s.lineTo(-notchHW - t * 0.15, forkY); // 6 left horn tip
  s.lineTo(-notchHW, forkTop + t * 0.9); // 7 notch inner left
  s.quadraticCurveTo(0, forkTop + t * 0.5, notchHW, forkTop + t * 0.9); // 8 notch floor
  s.lineTo(notchHW + t * 0.15, forkY); // 9 right horn tip
  s.lineTo(forkHW, forkY + t * 0.15); // 10 right horn outer
  s.lineTo(leverHW, forkTop); // 11 lever right up
  s.lineTo(leverHW, -t * 0.4); // 12
  s.quadraticCurveTo(t * 1.4, t * 0.2, ax - t * 0.5, sy - t * 0.5); // 13 belly right
  s.lineTo(ax + t * 0.7, sy + t * 0.4); // 14 right arm outer top
  s.quadraticCurveTo(0, sy * 0.45, -ax - t * 0.7, sy + t * 0.4); // 15 concave top back to 1
  s.closePath();

  const bevel = t * 0.12;
  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: t,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  });
  bodyGeo.translate(0, 0, -t / 2);
  g.add(new THREE.Mesh(bodyGeo, MATS.steel));

  // Pivot boss at origin.
  const bossGeo = new THREE.CylinderGeometry(t * 1.1, t * 1.1, t * 1.3, 20);
  bossGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(bossGeo, MATS.steel));

  // Ruby pallet stones with angled impulse faces (entry differs from exit).
  const entryPos = new THREE.Vector3(-ax, sy, 0);
  const exitPos = new THREE.Vector3(ax, sy, 0);
  // Stones run deeper in Z than the fork body so they reach down into the
  // escape wheel's plane (the wheel sits slightly below the fork).
  // Sized against the escape wheel's own tooth PITCH (span subtends 3.5
  // pitches — see the caller's comment), not the fork's unrelated body
  // thickness: a real pallet stone is a thin blade, well under one tooth's
  // spacing, so it engages a single tooth's face without its box silhouette
  // swallowing the tooth or reaching its neighbours. At thickness=1.2 the
  // old t-based sizing (1.56×2.04×2.4) came out comparable to or bigger
  // than an entire tooth (pitch arc ≈ span/3.5) — this is why the rubies
  // visually swallowed teeth even though true mesh penetration was tiny.
  const toothPitchArc = (span / 3.5) || t * 4;
  // Real pallet stones have TWO distinct engaging faces — a locking face
  // (shallow, near-radial, holds the tooth during lock/draw) and an impulse
  // face (steeper, transfers torque during unlock) — meeting at an edge,
  // not one flat face. A plain box (the previous shape here) can only
  // present one. Built as a pentagon extrusion: the back and side edges
  // match the box exactly, the FULL-EXTENT front corner (impulse side) is
  // also unchanged from the box, and only the locking-side corner is pulled
  // inward/backward to create the second facet. Every vertex therefore
  // stays within the original box's footprint — a strict subset — so the
  // extensive MTV-calibrated position/rotation tuning below (three rounds,
  // converged to ~0.0004/~0.03 worst-case penetration) remains valid: this
  // can only reduce contact, never introduce a new protruding point.
  function palletStoneGeometry(bevelSign) {
    const hw = (toothPitchArc * 0.34) / 2;
    const d = toothPitchArc * 0.44;
    const thickness = toothPitchArc * 0.56;
    const frontY = d / 2, backY = -d / 2;
    const impulseX = bevelSign * hw;   // full-extent corner — unchanged from the box
    const lockX = -bevelSign * hw;     // locking-side corner — pulled inward
    const s = new THREE.Shape();
    s.moveTo(-hw, backY);
    s.lineTo(hw, backY);
    s.lineTo(impulseX, frontY);                      // impulse-side edge (matches the box)
    s.lineTo(bevelSign * hw * 0.3, frontY - d * 0.08); // impulse face → ridge (barely set back)
    s.lineTo(lockX, backY + d * 0.7);                 // locking face (steeper, set well back)
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -thickness / 2);
    return geo;
  }
  const entryStoneGeo = palletStoneGeometry(1);
  const exitStoneGeo = palletStoneGeometry(-1);
  // Seating nudge: the Y (radial engagement) component scales with the
  // STONE's own new size (not the fork's unrelated thickness `t`) — a fixed
  // t-based offset would embed a shrunken stone proportionally deeper than
  // intended. The Z component must exactly close the gap between the fork
  // body's own Z-plane and the escape wheel's Z-plane (L_FORK − L_ESCAPE in
  // main.js), or the stones only graze one edge of the wheel's thickness
  // instead of centering on it.
  const stoneSeat = new THREE.Vector3(0, toothPitchArc * 0.09, -(stoneZReach ?? toothPitchArc * 0.27));
  // Entry (+20°) and exit (−32°) stones have deliberately different face
  // angles (real pallet forks cut entry/exit stones differently — their
  // impulse faces aren't mirror images), so the SAME radial reach engages
  // them by different amounts.
  //
  // IMPORTANT: earlier passes measured penetration with a raycast odd/even
  // "inside the wheel" vote, which turned out to be UNRELIABLE against this
  // mesh — the wheel's crossing-hole cutouts break the parity assumption a
  // watertight-mesh point-in-solid test needs, so it reported near-zero
  // depth in cases with real, substantial (>0.5 unit) overlap. The
  // trustworthy measure is a minimum-translation-distance (MTV) search: try
  // clearing the boolean triangle-triangle intersection (BVH
  // intersectsGeometry — always reliable) along many candidate directions
  // and take the smallest that works. That search also showed the true
  // separating direction isn't purely radial (local Y) for either stone —
  // there's a real local-X component too, which is why early Y-only nudges
  // converged so slowly. entrySeat/exitSeat below are the result of three
  // rounds of MTV correction (re-measuring the worst pose after each,
  // since fixing one pose shifts which pose becomes worst) plus a ~20%
  // further size reduction, converging to worst-case penetration of
  // ~0.0004 (entry) and ~0.03 (exit) — down from an initial ~0.5–0.7.
  const entrySeat = new THREE.Vector3(0.004, -toothPitchArc * 0.102 - 0.598, stoneSeat.z);

  const entryStone = new THREE.Mesh(entryStoneGeo, MATS.ruby);
  entryStone.position.copy(entryPos).add(entrySeat);
  entryStone.rotation.z = THREE.MathUtils.degToRad(20);
  g.add(entryStone);

  const exitSeat = stoneSeat.clone().add(new THREE.Vector3(0.867, 0.287, 0));
  const exitStone = new THREE.Mesh(exitStoneGeo, MATS.ruby);
  exitStone.position.copy(exitPos).add(exitSeat);
  exitStone.rotation.z = THREE.MathUtils.degToRad(-32);
  g.add(exitStone);

  // Guard pin at the fork tip just under the notch, protruding toward the
  // safety roller (-Z) so it rides close to the roller's crescent edge.
  const guardGeo = new THREE.CylinderGeometry(t * 0.18, t * 0.18, t * 1.4, 12);
  guardGeo.rotateX(Math.PI / 2);
  const guard = new THREE.Mesh(guardGeo, MATS.steel);
  guard.position.set(0, forkY + t * 0.5, -t * 0.7);
  g.add(guard);

  g.userData.entryPos = entryPos;
  g.userData.exitPos = exitPos;
  g.userData.span = span;
  return g;
}

// ---------------------------------------------------------------------------
// Balance wheel — heavy rim + timing screws, 2 arms, staff, roller table
// ---------------------------------------------------------------------------

export function makeBalanceWheel({ radius, thickness, staffHeight = thickness * 6 }) {
  const g = new THREE.Group();
  const rimO = radius;
  const rimI = radius - thickness * 0.8;

  // Slim annular rim — was 1.3·thickness wide and a full thickness tall;
  // 0.8 wide × 0.75 tall reads as a light precision ring while the 16
  // timing screws (below, unchanged) keep the rim's visual mass where a
  // real balance carries it: at the periphery.
  const rim = new THREE.Mesh(ringExtrude(rimO, rimI, thickness * 0.75, 48), MATS.brass);
  g.add(rim);

  // Two arms (a single diameter bar = 2 arms), matched to the finer rim.
  const armGeo = new THREE.BoxGeometry(rimI * 2, thickness * 0.55, thickness * 0.5);
  g.add(new THREE.Mesh(armGeo, MATS.steel));

  // Central staff along Z (staffHeight lets the caller match the actual
  // wheel-plane → cock-jewel span instead of a proportion of thickness).
  const staffGeo = new THREE.CylinderGeometry(thickness * 0.35, thickness * 0.35, staffHeight, 16);
  staffGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(staffGeo, MATS.steel));

  // 16 timing screws radially around the rim.
  const screwGeo = new THREE.CylinderGeometry(thickness * 0.28, thickness * 0.34, thickness * 1.0, 10);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sc = new THREE.Mesh(screwGeo, MATS.blueSteel);
    sc.rotation.z = a - Math.PI / 2; // cylinder Y-axis -> radial
    sc.position.set(Math.cos(a) * rimO, Math.sin(a) * rimO, 0);
    g.add(sc);
  }

  // Roller table (disc) below the balance, carrying the ruby impulse pin.
  // rollerR sets the pin's actual swept arc-length (rollerR·Δθ) during the
  // escapement's impulse window; it must be sized against the fork's own
  // notch-reach and bank angle (FORK_BANK_DEG in main.js) or the pin and
  // notch trace mismatched arcs and never truly interlock — see that
  // constant's comment for the paired derivation. Kept well inside the
  // balance rim (real impulse rollers run small) so the disc itself stays
  // clear of the fork's lever as it swings past — only the PIN, protruding
  // past the disc's edge, is meant to reach the fork.
  const rollerR = radius * 0.18;
  const rollerZ = -thickness * 1.6;
  const rtGeo = new THREE.CylinderGeometry(radius * 0.15, radius * 0.15, thickness * 0.5, 32);
  rtGeo.rotateX(Math.PI / 2);
  rtGeo.translate(0, 0, rollerZ);
  g.add(new THREE.Mesh(rtGeo, MATS.steel));

  // Ruby impulse pin at the roller's edge, in the roller-table plane itself so
  // it seats between the fork horns (the fork plane is level with the roller).
  const pinGeo = new THREE.CylinderGeometry(thickness * 0.22, thickness * 0.22, thickness * 1.2, 12);
  pinGeo.rotateX(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeo, MATS.ruby);
  pin.position.set(rollerR, 0, rollerZ - thickness * 0.2);
  g.add(pin);

  // Crescent-notched safety roller (smaller disc under the impulse roller).
  const srR = radius * 0.2;
  const srZ = rollerZ - thickness * 0.6;
  const gap = 0.45;
  const srShape = new THREE.Shape();
  srShape.absarc(0, 0, srR, gap, Math.PI * 2 - gap, false);
  srShape.quadraticCurveTo(srR * 0.4, 0, Math.cos(gap) * srR, Math.sin(gap) * srR);
  srShape.closePath();
  const srGeo = new THREE.ExtrudeGeometry(srShape, {
    depth: thickness * 0.35,
    bevelEnabled: false,
    curveSegments: 24,
  });
  srGeo.translate(0, 0, srZ - thickness * 0.17);
  g.add(new THREE.Mesh(srGeo, MATS.steel));

  g.userData.r = radius;
  g.userData.rollerR = rollerR;
  return g;
}

// ---------------------------------------------------------------------------
// Hacking lever — brake arm that pivots a ruby-tipped pad against the
// balance rim to physically stall it when the crown is pulled.
// ---------------------------------------------------------------------------

export function makeHackingLever({ length, width }) {
  const g = new THREE.Group();
  const hw = width / 2;

  // Slim spring-steel arm from the pivot (origin, local +Y = toward tip) to
  // a wider brake-pad tip.
  const s = new THREE.Shape();
  s.moveTo(-hw * 0.85, 0);
  s.lineTo(-hw * 0.45, length * 0.82);
  s.lineTo(-hw * 1.15, length);
  s.lineTo(hw * 1.15, length);
  s.lineTo(hw * 0.45, length * 0.82);
  s.lineTo(hw * 0.85, 0);
  s.closePath();

  const depth = width * 0.6;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: width * 0.08,
    bevelSize: width * 0.08,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  g.add(new THREE.Mesh(geo, MATS.blueSteel));

  // Pivot boss + screw.
  const bossGeo = new THREE.CylinderGeometry(hw * 1.4, hw * 1.4, depth * 1.5, 16);
  bossGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(bossGeo, MATS.steel));
  const screwGeo = new THREE.CylinderGeometry(hw * 0.55, hw * 0.55, depth * 0.5, 10);
  screwGeo.rotateX(Math.PI / 2);
  const screw = new THREE.Mesh(screwGeo, MATS.blueSteel);
  screw.position.z = depth;
  g.add(screw);

  // Ruby friction pad at the tip — the surface that actually contacts and
  // brakes the balance rim.
  const pad = new THREE.Mesh(new THREE.SphereGeometry(hw * 0.9, 14, 10), MATS.ruby);
  pad.position.set(0, length, 0);
  g.add(pad);

  g.userData.length = length;
  return g;
}

// ---------------------------------------------------------------------------
// Heart cam — asymmetric return-to-zero cam for a chronograph-style reset
// hammer. r(θ) is smallest at θ=0 (the notch/point, where a roller pressed
// radially inward comes to rest) and largest at θ=π, so a roller pushed in
// at any other angle rides the rising flank and is cammed toward θ=0.
// ---------------------------------------------------------------------------

export function makeHeartCam({ radius, thickness, boreR = 0.6 }) {
  const g = new THREE.Group();
  const rMin = radius * 0.32;
  const shape = new THREE.Shape();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = rMin + (radius - rMin) * (1 - Math.cos(th)) / 2;
    const x = Math.cos(th) * r, y = Math.sin(th) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const bevel = Math.min(thickness * 0.2, radius * 0.05);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geo.translate(0, 0, -thickness / 2);
  g.add(new THREE.Mesh(geo, MATS.blueSteel));
  g.userData.r = radius;
  g.userData.rMin = rMin;
  return g;
}

// ---------------------------------------------------------------------------
// Reset hammer — pivoted lever whose hardened-steel roller presses against
// a heart cam's flank, camming it to the zero/notch position as it closes.
// ---------------------------------------------------------------------------

export function makeHammerLever({ length, width }) {
  const g = new THREE.Group();
  const hw = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(-hw * 0.5, length * 0.85);
  s.lineTo(-hw * 1.4, length);
  s.lineTo(hw * 1.4, length);
  s.lineTo(hw * 0.5, length * 0.85);
  s.lineTo(hw, 0);
  s.closePath();

  const depth = width * 0.6;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: width * 0.08,
    bevelSize: width * 0.08,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  g.add(new THREE.Mesh(geo, MATS.steel));

  const bossGeo = new THREE.CylinderGeometry(hw * 1.3, hw * 1.3, depth * 1.4, 16);
  bossGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(bossGeo, MATS.steel));

  // Hardened roller — sliding cam contact under spring load, not a
  // low-friction pivot jewel, so plain steel rather than ruby.
  const rollerGeo = new THREE.CylinderGeometry(hw * 0.7, hw * 0.7, depth * 1.1, 14);
  rollerGeo.rotateX(Math.PI / 2);
  const roller = new THREE.Mesh(rollerGeo, MATS.steel);
  roller.position.set(0, length, 0);
  g.add(roller);

  g.userData.length = length;
  return g;
}

// ---------------------------------------------------------------------------
// Setting lever — the keyless-works detent. Flat steel plate pivoted at the
// origin: a beak arm (+Y) whose upright pin rides the stem's groove (between
// its two collars), and a tail arm (−Y) carrying a tall post that does the
// ganged work — pressing the hack spring and driving the reset-hammer rod.
// ---------------------------------------------------------------------------

export function makeSettingLever({ beakLen, tailLen, width, thickness, beakPinH = 1.6, postH = 12 }) {
  const g = new THREE.Group();
  const hw = width / 2;

  const s = new THREE.Shape();
  s.moveTo(-hw, -tailLen);
  s.quadraticCurveTo(-hw * 1.8, 0, -hw * 0.55, beakLen * 0.85);
  s.lineTo(-hw * 0.32, beakLen);
  s.lineTo(hw * 0.32, beakLen);
  s.lineTo(hw * 0.55, beakLen * 0.85);
  s.quadraticCurveTo(hw * 1.8, 0, hw, -tailLen);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.12,
    bevelSize: thickness * 0.12,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -thickness / 2);
  g.add(new THREE.Mesh(geo, MATS.steel));

  // Pivot boss + blued screw.
  const bossGeo = new THREE.CylinderGeometry(hw * 1.5, hw * 1.5, thickness * 1.6, 16);
  bossGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(bossGeo, MATS.steel));
  const screwGeo = new THREE.CylinderGeometry(hw * 0.55, hw * 0.55, thickness * 0.5, 10);
  screwGeo.rotateX(Math.PI / 2);
  const screw = new THREE.Mesh(screwGeo, MATS.blueSteel);
  screw.position.z = thickness * 1.05;
  g.add(screw);

  // Beak pin — rides up into the stem's groove from below.
  const pinGeo = new THREE.CylinderGeometry(0.35, 0.35, beakPinH, 10);
  pinGeo.rotateX(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeo, MATS.steel);
  pin.position.set(0, beakLen, thickness / 2 + beakPinH / 2);
  g.add(pin);

  // Tail post — tall, so it can actuate parts on higher planes.
  const postGeo = new THREE.CylinderGeometry(0.45, 0.45, postH, 12);
  postGeo.rotateX(Math.PI / 2);
  const post = new THREE.Mesh(postGeo, MATS.steel);
  post.position.set(0, -tailLen, thickness / 2 + postH / 2);
  g.add(post);

  g.userData.beakLen = beakLen;
  g.userData.tailLen = tailLen;
  return g;
}

// ---------------------------------------------------------------------------
// Yoke — the clutch lever whose forked end straddles the sliding pinion's
// hub collars and shifts it between the winding and setting meshes. Flat arm
// (+Y from the pivot) passing under the stem; two upright prong pins at the
// tip rise to the hub's level.
// ---------------------------------------------------------------------------

export function makeYoke({ armLen, width, thickness, prongGap = 3.2, prongH = 2.6 }) {
  const g = new THREE.Group();
  const hw = width / 2;

  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(-hw * 0.5, armLen * 0.82);
  s.lineTo(-prongGap / 2 - 0.6, armLen);
  s.lineTo(prongGap / 2 + 0.6, armLen);
  s.lineTo(hw * 0.5, armLen * 0.82);
  s.lineTo(hw, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.12,
    bevelSize: thickness * 0.12,
    bevelSegments: 1,
    curveSegments: 4,
  });
  geo.translate(0, 0, -thickness / 2);
  g.add(new THREE.Mesh(geo, MATS.steel));

  const bossGeo = new THREE.CylinderGeometry(hw * 1.3, hw * 1.3, thickness * 1.5, 14);
  bossGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(bossGeo, MATS.steel));

  const prongGeo = new THREE.CylinderGeometry(0.4, 0.4, prongH, 10);
  prongGeo.rotateX(Math.PI / 2);
  for (const px of [-prongGap / 2, prongGap / 2]) {
    const prong = new THREE.Mesh(prongGeo, MATS.steel);
    prong.position.set(px, armLen, thickness / 2 + prongH / 2);
    g.add(prong);
  }

  g.userData.armLen = armLen;
  return g;
}

// ---------------------------------------------------------------------------
// Hack spring — the long, thin blued blade that reaches across the movement
// from the keyless works to the balance. Anchored (screwed) at the origin,
// gently bowed along its length, with the ruby brake pad at the tip. Local
// +X runs anchor → pad.
// ---------------------------------------------------------------------------

export function makeHackSpring({ length, width = 1.6, thickness = 0.8 }) {
  const g = new THREE.Group();
  const hw = width / 2;
  const sag = length * 0.055;

  const s = new THREE.Shape();
  s.moveTo(0, -hw);
  s.quadraticCurveTo(length * 0.5, -hw - sag, length, -hw * 0.55);
  s.lineTo(length, hw * 0.55);
  s.quadraticCurveTo(length * 0.5, hw - sag, 0, hw);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.translate(0, 0, -thickness / 2);
  g.add(new THREE.Mesh(geo, MATS.blueSteel));

  // Anchor boss + screw (the fixed end, screwed to the plate/bridge).
  const bossGeo = new THREE.CylinderGeometry(1.15, 1.15, thickness * 2.2, 14);
  bossGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(bossGeo, MATS.steel));
  const screwGeo = new THREE.CylinderGeometry(0.55, 0.55, thickness * 0.6, 10);
  screwGeo.rotateX(Math.PI / 2);
  const screw = new THREE.Mesh(screwGeo, MATS.blueSteel);
  screw.position.z = thickness * 1.35;
  g.add(screw);

  // Ruby brake pad at the free end.
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), MATS.ruby);
  pad.position.set(length, 0, 0);
  g.add(pad);

  g.userData.length = length;
  return g;
}

// ---------------------------------------------------------------------------
// Hairspring — Archimedean spiral tube (flat ribbon), collet, stud, terminal
// ---------------------------------------------------------------------------

export function makeHairspring({ innerR, outerR, coils = 12, height }) {
  const g = new THREE.Group();
  const ribbonR = Math.max(((outerR - innerR) / coils) * 0.12, 0.05);
  const curve = new ArchimedeanSpiral(innerR, outerR, coils);
  const segs = Math.max(coils * 48, 96);

  const tubeGeo = new THREE.TubeGeometry(curve, segs, ribbonR, 4, false);
  const tube = new THREE.Mesh(tubeGeo, MATS.blueSteel);
  tube.scale.z = Math.max(height / (ribbonR * 2), 1); // stand the ribbon on edge
  g.add(tube);

  // Collet at center.
  const colletGeo = new THREE.CylinderGeometry(innerR, innerR, height * 1.1, 20);
  colletGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(colletGeo, MATS.steel));

  // Outer stud block.
  const endA = coils * Math.PI * 2;
  const studGeo = new THREE.BoxGeometry(ribbonR * 4, ribbonR * 4, height * 1.2);
  const stud = new THREE.Mesh(studGeo, MATS.steel);
  stud.position.set(Math.cos(endA) * outerR, Math.sin(endA) * outerR, 0);
  g.add(stud);

  // Raised terminal end-curve running from the outer coil up to the stud.
  const termPts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = endA + t * 0.9;
    const r = outerR + t * ribbonR * 3;
    termPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, height * 0.55 * t));
  }
  const termGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(termPts), 24, ribbonR, 4, false);
  g.add(new THREE.Mesh(termGeo, MATS.blueSteel));

  g.userData.r = outerR;
  return g;
}

// ---------------------------------------------------------------------------
// Ratchet wheel + click — standalone so both the going-barrel and the fusee
// arbor can carry one. Ratchet extrudes upward from z=0; the click and its
// screw sit just above it. Children named 'ratchet' / 'click'.
// ---------------------------------------------------------------------------

export function makeRatchetAndClick({ radius, teeth = 24, thickness }) {
  const g = new THREE.Group();
  const rShape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.72) / teeth) * Math.PI * 2;
    const p0 = [Math.cos(a0) * radius * 0.8, Math.sin(a0) * radius * 0.8];
    const p1 = [Math.cos(a1) * radius, Math.sin(a1) * radius];
    if (i === 0) rShape.moveTo(p0[0], p0[1]);
    else rShape.lineTo(p0[0], p0[1]);
    rShape.lineTo(p1[0], p1[1]);
  }
  rShape.closePath();
  const ratHole = new THREE.Path();
  ratHole.absarc(0, 0, radius * 0.28, 0, Math.PI * 2, true);
  rShape.holes.push(ratHole);
  const ratGeo = new THREE.ExtrudeGeometry(rShape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 2,
  });
  const ratchet = new THREE.Mesh(ratGeo, MATS.steel);
  ratchet.name = 'ratchet';
  g.add(ratchet);

  // Click / pawl — pivoted just outside the ratchet, beak seated in a valley.
  const clickL = radius * 0.8;
  const cw2 = radius * 0.11;
  const clickShape = new THREE.Shape();
  clickShape.moveTo(0, cw2);
  clickShape.lineTo(clickL * 0.55, cw2 * 0.7);
  clickShape.lineTo(clickL, cw2 * 0.15);
  clickShape.lineTo(clickL, -cw2 * 0.15);
  clickShape.lineTo(clickL * 0.55, -cw2 * 0.7);
  clickShape.lineTo(0, -cw2);
  clickShape.closePath();
  // Click sits BELOW the ratchet, on the wheel side — where the part that
  // carries it (great wheel / barrel lid) actually is.
  const clickGeo = new THREE.ExtrudeGeometry(clickShape, {
    depth: thickness * 0.75,
    bevelEnabled: false,
  });
  clickGeo.translate(0, 0, -thickness * 0.9);
  const click = new THREE.Mesh(clickGeo, MATS.blueSteel);
  click.name = 'click';
  click.position.set(radius * 1.28, 0, 0);
  click.rotation.z = Math.PI * 0.778; // aim the beak at the valley point
  g.add(click);
  const clickScrew = new THREE.Mesh(
    new THREE.CylinderGeometry(cw2 * 1.1, cw2 * 1.1, thickness * 1.2, 12),
    MATS.blueSteel
  );
  clickScrew.rotation.x = Math.PI / 2;
  clickScrew.position.set(radius * 1.28, 0, -thickness * 1.4);
  g.add(clickScrew);

  g.userData.r = radius;
  g.userData.teeth = teeth;
  return g;
}

// ---------------------------------------------------------------------------
// Fusee — the torque-equalising cone. A helically-grooved cone: the chain
// pulls at the SMALL radius when the spring is strong (fully wound) and pays
// off toward the LARGE radius as it weakens, so torque delivered to the
// train stays level. Base flange at z=0, cone rising +Z, small end up.
// userData: rSmall, rLarge, height, grooveTurns.
// ---------------------------------------------------------------------------

export function makeFusee({ rSmall, rLarge, height, grooveTurns = 5 }) {
  const g = new THREE.Group();
  // Smooth cone core. The old version faked its grooves with annular
  // RIPPLES — rotationally symmetric rings, which no chain could actually
  // climb: a fusee's groove must be a HELIX, advancing axially as it goes
  // around, or the chain has no way up the cone. The core surface follows
  // exactly the r(f) = lerp(rLarge→rSmall) line the chain path rides
  // (main.js fuseeGrooveAt), so the chain stays seated on the cone.
  const pts = [];
  pts.push(new THREE.Vector2(rLarge * 1.12, 0));
  pts.push(new THREE.Vector2(rLarge * 1.12, height * 0.04));
  const NCORE = 12;
  for (let i = 0; i <= NCORE; i++) {
    const f = i / NCORE;
    pts.push(new THREE.Vector2(rLarge + (rSmall - rLarge) * f, height * (0.06 + 0.88 * f)));
  }
  pts.push(new THREE.Vector2(rSmall * 0.85, height * 0.97));
  pts.push(new THREE.Vector2(rSmall * 0.45, height));
  // LatheGeometry revolves about +Y; every arbor here spins about +Z, so
  // stand the cone up (profile height axis Y → Z).
  const geo = new THREE.LatheGeometry(pts, 48);
  geo.rotateX(Math.PI / 2);
  const cone = new THREE.Mesh(geo, MATS.brass);
  g.add(cone);

  // Helical guide flange — a screw-thread ridge standing slightly proud of
  // the core, making grooveTurns turns from the large end to the small end
  // over the same 0.06–0.94 band the chain occupies. The channel between
  // adjacent flange turns (axial pitch 0.88·height/turns, comfortably wider
  // than the chain's diameter) is the inclined groove that carries the
  // chain up the cone.
  const ridgeStand = Math.min((rLarge - rSmall) * 0.05, 0.24);
  class ConeHelix extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * grooveTurns * Math.PI * 2;
      const r = rLarge + (rSmall - rLarge) * t + ridgeStand;
      return target.set(Math.cos(a) * r, Math.sin(a) * r, height * (0.06 + 0.88 * t));
    }
  }
  const flangeGeo = new THREE.TubeGeometry(new ConeHelix(), grooveTurns * 32, ridgeStand * 0.9, 8, false);
  g.add(new THREE.Mesh(flangeGeo, MATS.brass));

  g.userData.rSmall = rSmall;
  g.userData.rLarge = rLarge;
  g.userData.height = height;
  g.userData.grooveTurns = grooveTurns;
  return g;
}

// ---------------------------------------------------------------------------
// Going barrel — drum + toothed great-wheel rim, mainspring, ratchet + click.
// With `plain: true` it becomes a fusee-style spring DRUM: smooth wall, no
// gear teeth, no ratchet/click (the fusee arbor carries those instead).
// ---------------------------------------------------------------------------

export function makeBarrel({ radius, height, teeth, module, plain = false }) {
  const g = new THREE.Group();
  const pitchR = plain ? radius : pitchRadius(module, teeth);
  const rootR = plain ? radius : pitchR - module * 1.15;
  const wallModule = module || radius * 0.06;
  const drumInnerR = Math.max(rootR - wallModule * 2.2, radius * 0.3);

  if (plain) {
    // Smooth drum wall — the chain wraps around this.
    const wallGeo = ringExtrude(radius, drumInnerR, height, 64);
    g.add(new THREE.Mesh(wallGeo, MATS.brass));
  } else {
    // Toothed wall — this IS the great wheel; the drum cavity is the central hole.
    const tipR = pitchR + module * 0.95;
    const shape = gearOutlineShape(teeth, rootR, pitchR, tipR);
    const hole = new THREE.Path();
    hole.absarc(0, 0, drumInnerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const bevel = Math.min(height * 0.06, module * 0.2);
    const wallGeo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 3,
    });
    wallGeo.translate(0, 0, -height / 2);
    g.add(new THREE.Mesh(wallGeo, MATS.brass));
  }

  // Floor disc.
  const floorGeo = ringExtrude(rootR, radius * 0.05, height * 0.12, 48);
  floorGeo.translate(0, 0, -height / 2 + height * 0.06);
  g.add(new THREE.Mesh(floorGeo, MATS.brass));

  // Lid with a ~90° pie cutaway revealing the mainspring inside.
  const lidShape = new THREE.Shape();
  lidShape.absarc(0, 0, rootR, Math.PI * 0.5, Math.PI * 2, false); // omit 0..90deg
  lidShape.lineTo(0, 0);
  lidShape.closePath();
  const lidGeo = new THREE.ExtrudeGeometry(lidShape, {
    depth: height * 0.1,
    bevelEnabled: false,
    curveSegments: 48,
  });
  lidGeo.translate(0, 0, height / 2 - height * 0.1);
  g.add(new THREE.Mesh(lidGeo, MATS.brass));

  // Spiral mainspring ribbon (tall in Z), hooked to wall & arbor. name='spring'.
  const springOuter = drumInnerR - wallModule * 0.5;
  const springInner = radius * 0.16;
  const sCoils = 5;
  const sRibbon = Math.max(((springOuter - springInner) / sCoils) * 0.1, 0.08);
  const sGeo = new THREE.TubeGeometry(
    new ArchimedeanSpiral(springInner, springOuter, sCoils),
    sCoils * 48,
    sRibbon,
    4,
    false
  );
  const springMesh = new THREE.Mesh(sGeo, MATS.steel);
  springMesh.scale.z = Math.max((height * 0.7) / (sRibbon * 2), 1);
  const spring = new THREE.Group();
  spring.name = 'spring';
  spring.add(springMesh);
  // Outer hook to the barrel wall.
  const oh = new THREE.Mesh(
    new THREE.BoxGeometry(wallModule * 1.5, sRibbon * 2.2, height * 0.55),
    MATS.steel
  );
  oh.position.set(springOuter, 0, 0);
  spring.add(oh);
  g.add(spring);

  // Central arbor.
  const arborGeo = new THREE.CylinderGeometry(radius * 0.09, radius * 0.09, height * 2.4, 16);
  arborGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(arborGeo, MATS.steel));

  // Ratchet wheel + click on top (going-barrel form only — a plain fusee
  // drum has its ratchet on the fusee arbor instead).
  if (!plain) {
    const rc = makeRatchetAndClick({ radius: radius * 0.34, teeth: 24, thickness: height * 0.12 });
    rc.position.z = height / 2;
    g.add(rc);
  }

  g.userData.r = pitchR;
  g.userData.drumR = radius;
  return g;
}

// ---------------------------------------------------------------------------
// Plates & structure
// ---------------------------------------------------------------------------

export function makeBackPlate({ radius, thickness }) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.15,
    bevelSize: radius * 0.008,
    bevelSegments: 2,
    curveSegments: 72,
  });
  geo.translate(0, 0, -thickness / 2);
  const m = new THREE.Mesh(geo, MATS.nickel);
  m.userData.r = radius;
  return m;
}

export function makeCock({ length, width }) {
  const g = new THREE.Group();
  const hw = width / 2;
  const s = new THREE.Shape();
  s.moveTo(hw, -length * 0.5);
  s.quadraticCurveTo(hw * 0.55, 0, hw, length * 0.5); // right waisted side
  s.absarc(0, length * 0.5, hw, 0, Math.PI, false); // rounded top
  s.quadraticCurveTo(-hw * 0.55, 0, -hw, -length * 0.5); // left waisted side
  s.absarc(0, -length * 0.5, hw, Math.PI, Math.PI * 2, false); // rounded foot
  s.closePath();

  const h1 = new THREE.Path();
  h1.absarc(0, length * 0.42, width * 0.12, 0, Math.PI * 2, true);
  s.holes.push(h1);
  const h2 = new THREE.Path();
  h2.absarc(0, -length * 0.42, width * 0.12, 0, Math.PI * 2, true);
  s.holes.push(h2);

  const depth = width * 0.4;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: width * 0.05,
    bevelSize: width * 0.05,
    bevelSegments: 1,
    curveSegments: 20,
  });
  geo.translate(0, 0, -depth / 2);
  g.add(new THREE.Mesh(geo, MATS.nickel));

  // Sunk jewel setting near the pivot end.
  const js = makeJewelSetting({ r: width * 0.16 });
  js.position.set(0, length * 0.12, depth * 0.5);
  g.add(js);

  g.userData.length = length;
  return g;
}

export function makeJewelSetting({ r }) {
  const g = new THREE.Group();
  const chaton = new THREE.Mesh(ringExtrude(r * 1.7, r * 0.7, r * 0.7, 24), MATS.brass);
  g.add(chaton);
  const jewel = new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, r * 0.35, 12, 24), MATS.ruby);
  g.add(jewel);
  g.userData.r = r;
  return g;
}

export function makePillar({ height }) {
  const rr = height * 0.09;
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(rr * 1.5, 0),
    new THREE.Vector2(rr * 1.5, height * 0.07),
    new THREE.Vector2(rr, height * 0.12),
    new THREE.Vector2(rr, height * 0.5),
    new THREE.Vector2(rr * 1.25, height * 0.55),
    new THREE.Vector2(rr, height * 0.6),
    new THREE.Vector2(rr, height * 0.88),
    new THREE.Vector2(rr * 1.5, height * 0.93),
    new THREE.Vector2(rr * 1.5, height),
    new THREE.Vector2(0, height),
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateX(Math.PI / 2); // stand pillar along Z
  geo.translate(0, 0, -height / 2);
  const m = new THREE.Mesh(geo, MATS.brass);
  m.userData.height = height;
  return m;
}

// ---------------------------------------------------------------------------
// Dial & hands
// ---------------------------------------------------------------------------

// Sub-dial face artwork, painted around (cx, cy) at radius sr (canvas px).
function paintSubdialFace(ctx, scx, scy, sr, kind) {
  ctx.strokeStyle = '#1c1c22';
  ctx.fillStyle = '#1c1c22';
  const tickAt = (mathDeg, r1, len, w) => {
    const a = (mathDeg * Math.PI) / 180;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(scx + Math.cos(a) * r1, scy - Math.sin(a) * r1);
    ctx.lineTo(scx + Math.cos(a) * (r1 - len), scy - Math.sin(a) * (r1 - len));
    ctx.stroke();
  };
  // Label fanned along an invisible circle of radius r centred on the
  // sub-dial: each character sits on the arc, upright, reading left→right.
  // Orientation follows the classic bezel/coin convention — tops point
  // radially OUTWARD by default (upper-arc labels), and `inward` flips
  // tops toward the pivot for lower-arc labels so nothing renders
  // upside-down. Caller sets font/fill first (widths are measured with the
  // active font).
  const arcLabel = (txt, centerMathDeg, r, inward = false) => {
    const widths = [...txt].map((ch) => ctx.measureText(ch).width);
    const extra = sr * 0.008;
    const total = widths.reduce((s, w) => s + w + extra, -extra) / r;
    const dir = inward ? 1 : -1; // reading direction along the arc
    let a = (centerMathDeg * Math.PI) / 180 - dir * (total / 2);
    [...txt].forEach((ch, i) => {
      a += dir * (widths[i] / 2) / r;
      ctx.save();
      ctx.translate(scx + Math.cos(a) * r, scy - Math.sin(a) * r);
      ctx.rotate(inward ? -a - Math.PI / 2 : Math.PI / 2 - a);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a += dir * ((widths[i] / 2 + extra) / r);
    });
  };
  if (kind === 'reserve') {
    // Graduated 120° arc: math angle 150° (empty, left) → 30° (full,
    // right), Ab/Auf Glashütte marking. Major ticks every 12 hours of
    // reserve (0/12/24), small minor ticks every 3 hours between them —
    // the minors also anchor the full end of the arc (30 h).
    for (let h = 0; h <= 30; h += 3) {
      const major = h % 12 === 0;
      tickAt(150 - (h / 30) * 120, sr * 0.84, sr * (major ? 0.2 : 0.11), sr * (major ? 0.055 : 0.031));
    }
    // AB / AUF painted ALONG the graduation arc, at the tick band's radius
    // (sr·0.76, mid-band), set clear of the end ticks (22° beyond the arc
    // ends, vs the old 16°) so the words read as bookends rather than
    // crowding the outermost indicators.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${sr * 0.16}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    arcLabel('AB', 172, sr * 0.76);
    arcLabel('AUF', 8, sr * 0.76);
    // Maker's mark, set INSIDE the well: a quiet arc hugging the lower edge
    // of the face — the region the graduation never enters and the hand
    // never sweeps (its tip stays on the upper arc, its tail well inside
    // this radius). Letters upright, tops toward the pivot, reading
    // left→right along the bottom arc; small, light-weight and near the
    // face tone so it whispers. Radius keeps the ink one type-height off
    // the wall: centre-line at sr − 1.5·typeH (outer ink at +typeH/2,
    // leaving a typeH gap to the edge).
    ctx.font = `400 ${sr * 0.075}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = '#8a887e';
    arcLabel('MADE WITH FABLE', -90, sr * (1 - 1.5 * 0.075), true);
  } else if (kind === 'seconds') {
    // Small-seconds track: 60 ticks, heavier every fifth, ROMAN quarter
    // numerals (XV/XXX/XLV/LX) to match the dial's hour indices. Slightly
    // smaller than the old arabic figures — XXX and XLV are wide glyphs.
    for (let s = 0; s < 60; s++) {
      const major = s % 5 === 0;
      tickAt(90 - s * 6, sr * 0.92, sr * (major ? 0.16 : 0.09), sr * (major ? 0.045 : 0.022));
    }
    // Quarters fanned along an invisible circle inside the tick band,
    // bezel-convention oriented: LX/XV/XLV on the upper reaches keep tops
    // outward; XXX on the lower arc flips tops toward the pivot so it
    // reads upright rather than inverted.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${sr * 0.17}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    for (const [sec, mathDeg, inward] of [['LX', 90, false], ['XV', 0, false], ['XXX', -90, true], ['XLV', 180, false]]) {
      arcLabel(sec, mathDeg, sr * 0.62, inward);
    }
  }
}

// subdials: [{ x, y, r, kind: 'seconds' | 'reserve' }] in dial-local units
// (same frame the numerals use: +y = 12 o'clock, +x = 3 o'clock as authored;
// the caller's dialFace Y-flip makes that read correctly from the front).
// Each entry becomes a real recessed WELL: a hole cut through the dial disc,
// a silvered cylindrical wall, and a floor sunk `subdialRecess` below the
// surface carrying the painted face (with a central bore for the hand
// arbor). The caller adds its hand inside the well at the same local
// position. Any hour numeral whose marker would land on a sub-dial is
// skipped automatically (computed, replacing the old hard-coded VI
// omission).
export function makeDial({ radius, subdials = [], subdialRecess = 0.5 }) {
  const g = new THREE.Group();
  let mat = null;

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (ctx) {
      const S = 1024;
      const C = S / 2;
      const R = S * 0.46;
      // Silvered base with a soft radial vignette.
      const grad = ctx.createRadialGradient(C, C, R * 0.1, C, C, R);
      grad.addColorStop(0, '#f4f2ec');
      grad.addColorStop(0.75, '#e7e5dd');
      grad.addColorStop(1, '#d3d1c8');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(C, C, R, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(C, C);
      // Railroad ("chemin de fer") minute track: two concentric rails with a
      // crossing tick every minute, heavier sleepers on the five-minute marks.
      const rOut = R * 0.94;
      const rIn = R * 0.87;
      ctx.strokeStyle = '#1a1a1a';
      ctx.fillStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, rOut, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, rIn, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.lineWidth = i % 5 === 0 ? 10 : 3;
        ctx.beginPath();
        ctx.moveTo(0, -rOut);
        ctx.lineTo(0, -rIn);
        ctx.stroke();
        ctx.restore();
      }
      // (Hour markers are applied 3D numerals — built below, not printed.)
      // Discreet maker's mark. When a power-reserve sub-dial exists the mark
      // is set INSIDE its well (painted by paintSubdialFace on the recessed
      // floor); only a reserve-less dial prints it here, on the classic
      // 6-o'clock arc.
      if (!subdials.some((sd) => sd.kind === 'reserve')) {
        ctx.font = '400 13px "Helvetica Neue", Helvetica, Arial, sans-serif';
        ctx.fillStyle = '#8a887e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const msg = 'MADE WITH FABLE';
        const extra = 2; // px of tracking between characters
        const widths = [...msg].map((ch) => ctx.measureText(ch).width);
        const rSig = R * 0.78;
        const totalArc = widths.reduce((s, cw) => s + cw + extra, -extra) / rSig;
        let a = (6 / 12) * Math.PI * 2 + totalArc / 2;
        [...msg].forEach((ch, i) => {
          a -= (widths[i] / 2) / rSig;
          ctx.save();
          ctx.rotate(a + Math.PI);
          ctx.fillText(ch, 0, rSig);
          ctx.restore();
          a -= (widths[i] / 2 + extra) / rSig;
        });
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // (Sub-dial faces are NOT painted here: each one lives on its own
      // recessed floor mesh, built below — the dial disc has a hole there.)

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 8;
      mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        color: 0xffffff,
        metalness: 0.15,
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
      });
    }
  }
  if (!mat) mat = MATS.silver;

  // Dial disc — with a circular hole cut through it at each sub-dial.
  let discGeo;
  if (subdials.length) {
    const discShape = new THREE.Shape();
    discShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    for (const sd of subdials) {
      const h = new THREE.Path();
      h.absarc(sd.x, sd.y, sd.r, 0, Math.PI * 2, true);
      discShape.holes.push(h);
    }
    discGeo = new THREE.ShapeGeometry(discShape, 96);
    // ShapeGeometry UVs are raw local coordinates — remap to the 0..1 disc
    // mapping CircleGeometry uses, so the canvas texture lands identically.
    const uv = discGeo.attributes.uv, pos = discGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, pos.getX(i) / (2 * radius) + 0.5, pos.getY(i) / (2 * radius) + 0.5);
    }
  } else {
    discGeo = new THREE.CircleGeometry(radius, 96);
  }
  const disc = new THREE.Mesh(discGeo, mat);
  g.add(disc);
  // Slight raised chapter ring for depth.
  const ring = new THREE.Mesh(ringExtrude(radius, radius * 0.97, radius * 0.02, 96), MATS.silver);
  ring.position.z = radius * 0.01;
  g.add(ring);

  // Recessed sub-dial wells: silvered wall down from the hole's edge, and a
  // floor sunk subdialRecess below the surface carrying the painted face.
  // The floor has a central bore for the hand arbor (r 1.0 — the arbors'
  // hand hubs in main.js are r ≤ 0.9).
  if (subdials.length && subdialRecess > 0) {
    // Matte and darker than the dial: the wall is the SHADOWED side of a
    // recess. A polished/metallic wall catches highlights and reads as a
    // raised bezel ring from oblique angles — the opposite of sunk.
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x8f8d85, metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide,
    });
    for (const sd of subdials) {
      let floorMat = null;
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const px = 512;
        const cv = document.createElement('canvas');
        cv.width = cv.height = px;
        const fctx = cv.getContext && cv.getContext('2d');
        if (fctx) {
          // Default: slightly darker than the dial, reads as shadowed. A
          // sub-dial may pass its own `face` colour to blend in instead.
          fctx.fillStyle = sd.face || '#d6d6ca';
          fctx.fillRect(0, 0, px, px);
          paintSubdialFace(fctx, px / 2, px / 2, px / 2, sd.kind);
          const ftex = new THREE.CanvasTexture(cv);
          ftex.colorSpace = THREE.SRGBColorSpace;
          ftex.anisotropy = 8;
          floorMat = new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.65, metalness: 0.08 });
        }
      }
      if (!floorMat) floorMat = MATS.silver;

      const floorShape = new THREE.Shape();
      floorShape.absarc(0, 0, sd.r, 0, Math.PI * 2, false);
      const bore = new THREE.Path();
      bore.absarc(0, 0, 1.0, 0, Math.PI * 2, true);
      floorShape.holes.push(bore);
      const floorGeo = new THREE.ShapeGeometry(floorShape, 48);
      const fuv = floorGeo.attributes.uv, fpos = floorGeo.attributes.position;
      for (let i = 0; i < fuv.count; i++) {
        fuv.setXY(i, fpos.getX(i) / (2 * sd.r) + 0.5, fpos.getY(i) / (2 * sd.r) + 0.5);
      }
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.set(sd.x, sd.y, -subdialRecess);
      g.add(floor);

      const wallGeo = new THREE.CylinderGeometry(sd.r, sd.r, subdialRecess, 48, 1, true);
      wallGeo.rotateX(Math.PI / 2);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(sd.x, sd.y, -subdialRecess / 2);
      g.add(wall);
    }
  }

  // Applied Roman-numeral hour markers: raised polished-brass indices built
  // from bar strokes (I/V/X are pure strokes, so no font assets needed),
  // shaped and "riveted" on top of the dial like real applied markers.
  // Radially oriented (base toward centre), horological IIII. Any numeral
  // whose marker centre falls on a sub-dial is skipped (computed below).
  {
    const markerAesthetics = aesthetics.dial.hourMarkers;
    const H = radius * 0.21;              // cap height (tall proportion)
    const w = H * markerAesthetics.strokeWidthFactor;
    const D = Math.max(H * markerAesthetics.reliefDepthFactor, markerAesthetics.reliefDepthMin);
    const rc = radius * 0.795 - H / 2;    // markers hug the railroad track
    const mat = MATS.steel;

    // All stroke END faces are horizontal in glyph-local space; letters are
    // then fanned radially along the marker arc, so every end lies tangent
    // to — parallel with — the dial perimeter. Every builder takes its
    // stroke width `sw` as a parameter: numerals are WEIGHT-BALANCED below,
    // so different numerals set different widths.
    const straight = (sw) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sw, H, D), mat);
      m.userData.clipDir = [0, 1]; // side edges are vertical
      return m;
    };
    // Parallelogram stroke: bottom edge centred at bx, top edge centred at
    // tx, both edges horizontal (this is what keeps V/X ends perimeter-true).
    const slant = (sw, bx, tx) => {
      const wh = sw * markerAesthetics.slantWidthFactor;
      const s = new THREE.Shape();
      s.moveTo(bx - wh / 2, -H / 2);
      s.lineTo(bx + wh / 2, -H / 2);
      s.lineTo(tx + wh / 2, H / 2);
      s.lineTo(tx - wh / 2, H / 2);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false });
      geo.translate(0, 0, -D / 2);
      const m = new THREE.Mesh(geo, mat);
      const len = Math.hypot(tx - bx, H);
      m.userData.clipDir = [(tx - bx) / len, H / len]; // along the side edges
      return m;
    };
    const letterI = (sw) => {
      const lg = new THREE.Group();
      lg.add(straight(sw));
      lg.userData.w = sw;
      return lg;
    };
    const letterV = (sw) => {
      const lg = new THREE.Group();
      const W = H * 0.52;
      lg.add(slant(sw, -sw * 0.3, -(W - sw) / 2), slant(sw, sw * 0.3, (W - sw) / 2));
      lg.userData.w = W;
      return lg;
    };
    const letterX = (sw) => {
      const lg = new THREE.Group();
      const W = H * 0.5;
      lg.add(slant(sw, -(W - sw) / 2, (W - sw) / 2), slant(sw, (W - sw) / 2, -(W - sw) / 2));
      lg.userData.w = W;
      return lg;
    };
    const LETTER = { I: letterI, V: letterV, X: letterX };
    const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

    // Per-numeral weight balancing. At one shared stroke width the many-
    // stroke numerals (VIII carries 5 strokes to II's 2) put ~2.5× the ink
    // on their quadrant and the dial reads lopsidedly heavy around 7–9.
    // Measure each numeral's "ink" (Σ stroke widths; slants count their
    // drawn width) against III — the heaviest numeral of the light quadrant,
    // which sets the look — and thin only the numerals ABOVE that reference,
    // by (ref/ink)^exponent. Exponent 0 = uniform width, 1 = strict equal
    // ink per numeral; the default 0.5 splits the difference so heavy
    // numerals slim down without going spindly.
    const inkOf = (ch) => (ch === 'I' ? 1 : 2 * markerAesthetics.slantWidthFactor);
    const REF_INK = 3; // = ink of 'III'
    const balExp = markerAesthetics.weightBalanceExponent;
    const numeralStrokeW = (name) => {
      const ink = [...name].reduce((s, ch) => s + inkOf(ch), 0);
      return w * Math.min(1, Math.pow(REF_INK / ink, balExp));
    };

    // Sub-dials no longer suppress a whole numeral: instead each numeral is
    // rendered and BISECTED at the sub-dial circle — the letters (or parts of
    // letters) that would sit over a sub-dial are trimmed off, leaving a clear
    // margin, while whatever clears the sub-dial stays. A numeral is dropped
    // in full only when it sits so squarely on a sub-dial that even its
    // least-covered letter keeps too little to read as anything but debris.
    const subdialMargin = radius * markerAesthetics.subdialMarginFactor;
    // Numeral-level: if even the best-kept letter falls below this fraction,
    // omit the whole numeral. 0.3 keeps XII and VI visible as outer stubs
    // (~0.42 kept) where the wells cut through the marker ring's middle.
    const MIN_KEEP_FRAC = markerAesthetics.minNumeralKeepFrac;
    const LETTER_MIN_FRAC = markerAesthetics.minLetterKeepFrac; // per-letter sliver cutoff

    // Clip a letter against the (margin-expanded) sub-dial circles, cutting
    // along the ARC itself: any vertex inside a circle slides ALONG ITS
    // STROKE'S OWN SIDE-EDGE direction (userData.clipDir) until it lands on
    // the circle's boundary. Sliding along the edge is what makes this a
    // true CLIP — the surviving portion keeps its exact outline, with only
    // its lower end cut off on the arc. (An earlier version clamped straight
    // up in +y, which pivots a slanted stroke's edges — the X/V glyphs
    // read as vertically squashed into the margin rather than cut.) All cut
    // points land on the same circle, so neighbouring letters of one
    // numeral still meet one continuous arc. Vertices outside every circle
    // are untouched.
    const clipLetterToArcs = (letterGroup, lx, ly, dth, subs) => {
      const cos = Math.cos(dth), sin = Math.sin(dth);
      letterGroup.traverse((o) => {
        if (!o.isMesh) return;
        // Stroke edge direction, letter-local -> numeral-local (the letter
        // carries rotation.z = -dth). Unit length is preserved by rotation.
        const [ex, ey] = o.userData.clipDir || [0, 1];
        const dxn = ex * cos + ey * sin;
        const dyn = -ex * sin + ey * cos;
        const pos = o.geometry.attributes.position;
        let touched = false;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i);
          let nx = x * cos + y * sin + lx;
          let ny = -x * sin + y * cos + ly;
          let moved = false;
          for (const s of subs) {
            const px = nx - s.sx, py = ny - s.sy;
            const inside = px * px + py * py - s.R * s.R;
            if (inside < 0) {
              // Slide by t along the edge to the circle: |p + t·d - c| = R.
              // p is interior, so the positive root always exists.
              const b = px * dxn + py * dyn;
              const t = -b + Math.sqrt(b * b - inside);
              nx += t * dxn;
              ny += t * dyn;
              moved = true;
            }
          }
          if (moved) {
            touched = true;
            const rx = nx - lx, ry = ny - ly; // back to letter-local
            pos.setX(i, rx * cos - ry * sin);
            pos.setY(i, rx * sin + ry * cos);
          }
        }
        if (touched) {
          pos.needsUpdate = true;
          o.geometry.computeVertexNormals();
          o.geometry.computeBoundingSphere();
        }
      });
    };

    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      const cosA = Math.cos(a), sinA = Math.sin(a);
      // Sub-dial centres in THIS numeral's local frame (the numeral sits at
      // radius rc, rotated by −a; invert that so a letter's local x can be
      // tested straight against the sub-dial circle).
      const localSubs = subdials.map((sd) => {
        const dx = sd.x - sinA * rc, dy = sd.y - cosA * rc;
        return { sx: dx * cosA - dy * sinA, sy: dx * sinA + dy * cosA, R: sd.r + subdialMargin };
      });

      // Weight-balanced stroke width for THIS numeral (gap scales with it so
      // letter spacing stays proportionate to the strokes it separates).
      const swNum = numeralStrokeW(ROMAN[h]);
      const gapNum = swNum * markerAesthetics.gapFactor;
      const letters = [...ROMAN[h]].map((ch) => LETTER[ch](swNum));
      const total = letters.reduce((s, l) => s + l.userData.w, 0) + gapNum * (letters.length - 1);
      // First pass: fan each letter and work out its clip line + how much of it
      // survives, before committing any of them to the numeral group.
      let sCur = -total / 2;
      const placed = [];
      let bestFrac = 0;
      for (const l of letters) {
        const dth = (sCur + l.userData.w / 2) / rc;
        sCur += l.userData.w + gapNum;
        const lx = Math.sin(dth) * rc, ly = Math.cos(dth) * rc - rc;
        // Top of the (margin-expanded) sub-dial circle directly below this
        // letter's x — the height at which the numeral must be cut here.
        let yBoundary = -Infinity;
        for (const s of localSubs) {
          const ddx = lx - s.sx;
          if (Math.abs(ddx) < s.R) yBoundary = Math.max(yBoundary, s.sy + Math.sqrt(s.R * s.R - ddx * ddx));
        }
        const yMinLetter = yBoundary === -Infinity ? -Infinity : yBoundary - ly;
        const keptFrac = yMinLetter === -Infinity
          ? 1
          : Math.max(0, (H / 2 - Math.max(yMinLetter, -H / 2)) / H);
        bestFrac = Math.max(bestFrac, keptFrac);
        placed.push({ l, lx, ly, dth, yMinLetter, keptFrac });
      }
      // Squarely on a sub-dial — nothing worth showing here.
      if (bestFrac < MIN_KEEP_FRAC) continue;

      const numeral = new THREE.Group();
      for (const p of placed) {
        if (p.keptFrac < LETTER_MIN_FRAC) continue; // fully/mostly covered letter
        // Arc-clip every surviving letter (no-op when nothing overlaps): the
        // keptFrac estimate samples the arc only at the letter's centre-line,
        // so a corner can still nick the circle even at keptFrac = 1.
        if (localSubs.length) clipLetterToArcs(p.l, p.lx, p.ly, p.dth, localSubs);
        p.l.position.set(p.lx, p.ly, 0);
        p.l.rotation.z = -p.dth;
        numeral.add(p.l);
      }
      numeral.position.set(sinA * rc, cosA * rc, 0.12 + D / 2);
      numeral.rotation.z = -a;
      g.add(numeral);
    }
  }

  g.userData.r = radius;
  return g;
}

export function makeHand({ length, kind }) {
  const g = new THREE.Group();
  const handAesthetics = aesthetics.dial.hands;
  const config = handAesthetics[kind];

  const tail = length * config.tailFactor;
  const depth = Math.max(length * config.depthFactor, config.depthMin);
  let bossH = depth * 1.6;

  if (kind === 'hour' || kind === 'minute') {
    // ROD hands: a constant-girth cylinder running tail → tip (cylinder
    // axis is already local +Y, the hand's pointing direction). Radius
    // derives from the old blade's width but at 0.3× so the hour and
    // minute rods clear each other where they cross — the minute hand
    // rides only 1.2 above the hour hand's plane (main.js), so
    // rHour + rMinute must stay under that with margin
    // (0.3: 0.54 + 0.48 ≈ 1.0 at current lengths).
    const rBase = length * config.widthFactor * 0.3;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(rBase, rBase, tail + length, 16),
      MATS.blueSteel
    );
    rod.position.y = (length - tail) / 2;
    g.add(rod);
    bossH = rBase * 2 * 1.3; // boss must swallow the rod's full diameter
  } else {
    // second: fine needle (unchanged flat blade)
    const w = length * config.widthFactor;
    const s = new THREE.Shape();
    s.moveTo(-w, -tail);
    s.lineTo(w, -tail);
    s.lineTo(w * 0.5, length);
    s.lineTo(-w * 0.5, length);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    g.add(new THREE.Mesh(geo, MATS.blueSteel));
    // Counterweight tail disc.
    const cw = new THREE.Mesh(
      new THREE.CylinderGeometry(length * config.counterweightSizeFactor, length * config.counterweightSizeFactor, depth, 16),
      MATS.blueSteel
    );
    cw.rotateX(Math.PI / 2);
    cw.position.set(0, -tail * config.counterweightOffsetFactor, 0);
    g.add(cw);
  }

  const bossR = length * config.bossSizeFactor;
  const boss = new THREE.Mesh(
    new THREE.CylinderGeometry(bossR, bossR, bossH, 18),
    MATS.blueSteel
  );
  boss.rotateX(Math.PI / 2);
  g.add(boss);

  g.userData.length = length;
  g.userData.kind = kind;
  return g;
}
