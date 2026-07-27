// src/geometry.js — horological geometry builders (Agent A).
// Every builder returns a THREE.Group (or Mesh) built lying in the XY plane,
// centered at the origin, rotating about local +Z. userData.r = pitch/functional
// radius where meaningful. Real tooth profiles via Shape/ExtrudeGeometry.
import * as THREE from 'three';
import { MATS } from './materials.js';
import { aesthetics } from './aesthetics.js';
import { STOCK_MIN_U } from './layout.js'; // §50/TODO 12: build to the stock floor

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
// bevel: false (§25 C) — a gear whose z-budget to its neighbour is smaller
// than the extrude bevel's expansion (bevelThickness ≈ 0.18·t) must be cut
// CRISP: the rendered outline is what collides, not the authored one
// (docs/MODELING.md rule 1). Default true — every existing gear unchanged.
export function makeGear({ module, teeth, thickness, boreR = 1, spokes = 5,
                           material, hub = true, bevel: bevelOn = true }) {
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

  const bevel = bevelOn ? Math.min(thickness * 0.18, module * 0.22) : 0;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevelOn,
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

// beatRad / bankRad: the escape wheel's advance per beat and the fork's
// half-swing — the impulse faces are CUT from them (the tooth tip's sliding
// path in the fork frame is their vector mix), so the caller must pass the
// same values that drive the animation.
export function makePalletFork({ span, leverLength, thickness, stoneZReach, beatRad, bankRad }) {
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

  // §16 — the wheel geometry this fork is CUT TO, derived ONCE and shared by
  // the body outline, the stone seats and the clearance asserts. All three
  // used to re-derive it: `Rwheel`/`Dwheel` up here and `R`/`D` down in the
  // stone block, from character-identical expressions, with both pairs live
  // inside the same closure (the asserts inside stoneAndArm read `Rwheel`
  // while its seats read `R`). Two names for one quantity is a divergence
  // waiting for the first person who tunes one of them. Likewise the bank
  // default, which was spelled `bankRad ?? 0.045` in three places.
  const EMBRACE_DEG = 42;  // lever embrace — a horological constant, like DRAW_DEG below
  const R = span / (2 * Math.sin(THREE.MathUtils.degToRad(EMBRACE_DEG)));
  const D = span / 2 + Math.sqrt(Math.max(R * R - (span / 2) ** 2, 0));
  const bank = bankRad ?? 0.045;

  // Single crafted body: belly + lever + fork horns + notch, topped by a
  // LOW shoulder line. The old outline reached arm blobs up beside the
  // wheel and spanned them with a concave web whose midpoint sat INSIDE
  // the escape wheel's tooth-tip circle — the teeth swept straight through
  // the fork's steel every beat (masked by the expected-contact pair; only
  // the ruby stones were penetration-budgeted). The body now STOPS below
  // the wheel: its top edge is bounded by |p − W| ≥ R + swing + margin
  // (W = wheel centre at (0, D); the fork's ±bank swing moves an outline
  // point by ~bank·|p|), and the pallet ARMS are separate bars from the
  // pivot boss out to the slotted stone heads — the real anchor shape.
  // Every KINEMATIC vertex is untouched: horn tips, notch walls and floor,
  // and the forkTop/forkY anchors the bank-angle derivation uses.
  const waistHW = leverHW * 0.62;              // narrowest point of the lever
  const yWaist = (-t * 0.4 + forkTop) / 2;     // mid-length
  const shoulderX = t * 1.8;
  const bankAllow = bank * Math.hypot(shoulderX, D - R); // swing sweep of a top point
  const topY = D - (R + 0.15 + bankAllow) - 0.05; // the |p−W| bound at x = 0, with slack
  const s = new THREE.Shape();
  s.moveTo(-shoulderX, topY); // 1 left shoulder
  s.quadraticCurveTo(-t * 1.4, t * 0.2, -leverHW, -t * 0.4); // 2 belly -> lever
  s.quadraticCurveTo(-waistHW, yWaist, -leverHW, forkTop); // 3 waisted lever, left flank
  s.lineTo(-forkHW, forkY + t * 0.15); // 4 left horn outer
  s.lineTo(-notchHW - t * 0.15, forkY); // 5 left horn tip
  s.lineTo(-notchHW, forkTop + t * 0.9); // 6 notch inner left
  s.quadraticCurveTo(0, forkTop + t * 0.5, notchHW, forkTop + t * 0.9); // 7 notch floor
  s.lineTo(notchHW + t * 0.15, forkY); // 8 right horn tip
  s.lineTo(forkHW, forkY + t * 0.15); // 9 right horn outer
  s.quadraticCurveTo(waistHW, yWaist, leverHW, forkTop); // 10 waisted lever, right flank (up)
  s.lineTo(leverHW, -t * 0.4); // 11
  s.quadraticCurveTo(t * 1.4, t * 0.2, shoulderX, topY); // 12 belly right -> shoulder
  s.quadraticCurveTo(0, topY - t * 0.5, -shoulderX, topY); // 13 concave top, dipping AWAY from the wheel
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

  // -------------------------------------------------------------------------
  // Ruby pallet stones — REAL construction: each stone is a leaning
  // rectangular prism seated in a slot cut through a pallet-arm block, its
  // locking corner ON the wheel's tooth circle and its impulse face CUT
  // from the tooth tip's actual sliding path. Everything below is DERIVED
  // from the wheel geometry the caller already fixed (no seat offsets, no
  // tuned angles — this replaces the old pentagon stones whose placement
  // was three rounds of MTV penetration-nudging):
  //
  //   · The wheel centre sits fork-local at W = (0, D) with D = the same
  //     palletStoneDist the caller uses, re-derived here from the span
  //     (R = span / 2sin42°, D = span/2 + sqrt(R² − (span/2)²)). The
  //     nominal corners C_σ = (σ·span/2, span/2) sit on the tooth-tip
  //     circle at the fork's NEUTRAL pose — but the tooth only ever RESTS
  //     on a stone at the BANKED pose, when the fork's swing has carried
  //     the corner bank·|C| toward the wheel. So each stone is seated at
  //     its banked CONTACT point, C_σ + bank·|C|·û_σ: at lock the dipped
  //     corner lands exactly back on the tip circle and the phased tooth
  //     tip rests precisely on it (the caller's tip-at-corner phasing
  //     becomes exact, not approximate). Seating at the nominal C instead
  //     started the impulse slide 0.19 outside the corner and drove the
  //     tooth through the locking face — the inspector's penetration
  //     budget measured exactly that (0.194 vs the 0.1 allowance).
  //   · LEAN (draw): a locking face perpendicular to the pivot→corner
  //     line would hold the tooth with zero torque about the fork pivot.
  //     Rotating that face by DRAW_DEG in the wheel's rotation sense gives
  //     both stones real draw — the tooth's pressure pulls the fork INTO
  //     the banking, which is what keeps a real lever safely locked. The
  //     two stones come out at visibly different leans relative to their
  //     arms (entry ≈ 237° fork-local, exit ≈ −33°), like a real fork.
  //   · IMPULSE FACE: during the impulse window the wheel advance
  //     (beatRad) and the fork swing (2·bankRad) ride the SAME smoothstep
  //     (see main.js escapeDeltaDeg/forkSwingRad), so in the fork frame
  //     the tooth tip slides along the fixed direction
  //       p = R·beatRad·t̂ + 2·bankRad·|C|·û
  //     (t̂ = tooth-motion tangent, û = wheel radial at the corner). The
  //     impulse face is the plane through the locking corner containing p:
  //     the let-off corner's setback Δ is solved per stone from that line,
  //     so entry and exit faces come out at their own angles. Residual
  //     contact error is bounded by the two arc sagittas (≈0.03) — inside
  //     the inspector's 0.1 penetration budget by construction.
  // -------------------------------------------------------------------------
  const DRAW_DEG = 12; // horological constant, like the EMBRACE_DEG above
  const pitchArc = (2 * Math.PI * R) / 15;
  const stoneW = 0.32 * pitchArc;  // well under one tooth spacing
  const stoneL = 0.9 * pitchArc;   // slot-buried tail included
  const cornerLen = Math.hypot(span / 2, span / 2); // |C|
  const beat = beatRad ?? THREE.MathUtils.degToRad(12);
  const entryPos = new THREE.Vector3(-ax, sy, 0);
  const exitPos = new THREE.Vector3(ax, sy, 0);

  // Stone cross-section (stone-local: origin = locking corner, +Y = lean
  // axis pointing away from the wheel into the slot, body at −X — the
  // downstream side of the locking face, where the arm's material backs
  // the stone against the tooth's push):
  //   (0,0) → (−w, Δ) → (−w, ℓ) → (0, ℓ);  x = 0 face = LOCKING face,
  //   the angled (0,0)→(−w,Δ) end = IMPULSE face.
  function stoneAndArm(sigma) {
    const C = new THREE.Vector2(sigma * span / 2, span / 2);
    const u = new THREE.Vector2(C.x - 0, C.y - D).divideScalar(R);      // wheel radial at the corner
    const tHat = new THREE.Vector2(-u.y, u.x);                          // tooth-motion tangent (ẑ×û)
    const cHat = C.clone().divideScalar(cornerLen);                     // pivot radial
    // Zero-torque face direction: the perp of ĉ on the away-from-wheel
    // branch, then + draw in the wheel's (+z) rotation sense.
    let f0 = new THREE.Vector2(-cHat.y, cHat.x);
    if (f0.dot(u) < 0) f0.negate();
    const drawRad = THREE.MathUtils.degToRad(DRAW_DEG);
    const tau = f0.clone().rotateAround(new THREE.Vector2(), drawRad);  // stone lean axis
    const thetaTau = Math.atan2(tau.y, tau.x);
    // Impulse slide direction in the fork frame (see header comment).
    const p = tHat.clone().multiplyScalar(R * beat)
      .add(u.clone().multiplyScalar(2 * bank * cornerLen));
    // Into stone-local (rotate by −(θτ − 90°)) and solve the let-off
    // corner's setback: face through (0,0) along p meets x = −w at Δ.
    const pLoc = p.clone().rotateAround(new THREE.Vector2(), -(thetaTau - Math.PI / 2));
    const delta = Math.abs(pLoc.x) > 1e-6 ? -stoneW * (pLoc.y / pLoc.x) : stoneW * 0.5;
    if (!(delta > 0.02 && delta < stoneL * 0.8))
      console.warn('pallet stone: impulse setback out of range', sigma, delta.toFixed(3));
    // Draw sanity: the tooth's normal push on the locking face must torque
    // the fork INTO this stone's banking (deeper lock). Face outward
    // normal (toward the tooth) = stone-local +X mapped to world.
    const n = new THREE.Vector2(Math.cos(thetaTau - Math.PI / 2), Math.sin(thetaTau - Math.PI / 2));
    const torque = C.x * -n.y - C.y * -n.x; // (C × (−n))_z — force on the FORK is −n
    if (sigma * torque < 0)
      console.warn('pallet stone: draw torque sign wrong for stone', sigma);

    const zOff = -(stoneZReach ?? 0);
    const rotZ = thetaTau - Math.PI / 2;
    // Banked contact seat (see header): the corner goes where the tooth
    // actually rests at lock.
    const seat = new THREE.Vector2(C.x + bank * cornerLen * u.x, C.y + bank * cornerLen * u.y);

    // The stone itself.
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(-stoneW, delta);
    sh.lineTo(-stoneW, stoneL);
    sh.lineTo(0, stoneL);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -t / 2);
    const stone = new THREE.Mesh(geo, MATS.ruby); // MATS.ruby is load-bearing: the
    // inspector's penetration budget finds the stones by this material's colour.
    stone.position.set(seat.x, seat.y, zOff);
    stone.rotation.z = rotZ;
    g.add(stone);

    // Pallet-arm block: the slotted arm the stone is SET INTO — a real
    // fork's arm is exactly this, a block with a slot broached through it,
    // the stone protruding past the arm's nose. Drawn in the same
    // stone-local frame: outer walls one wallW around the slot (slot =
    // stone footprint + seat gap g all around), nose edge at m along the
    // lean axis (the stone shows m of ruby past the arm), notch open at
    // the nose.
    // §16 — the seat gap must CLEAR the arm's own extrude bevel. The bevel
    // grows the outline along its outward normal, and inside a notch that
    // direction points INTO the slot, so each wall creeps armBevel back
    // toward the ruby it is meant to hold. At FORK_T = 1.2 that is 0.096
    // against a hand-set 0.05 gap — 0.046 of steel standing inside the
    // stone, which renders as z-fighting on the ruby's face and which the
    // battery CANNOT see: arm and stone are the same unit, and same-unit
    // overlap is the sweep's documented blind spot (CLAUDE.md, TODO.md
    // item 5). This is MODELING.md rule 1, and the same arithmetic §34 hit
    // on the alarm setting wheel (0.05 gap vs 0.045 of bevel). There the
    // answer was a crisp face; here the arm keeps its softened edge, so the
    // GAP is DERIVED from the bevel rather than guessed against it.
    const armBevel = t * 0.08;
    const SEAT_SHOW = 0.05;               // the seat line the stone should actually show
    const gGap = armBevel + SEAT_SHOW;    // bevel first, then the gap that survives it
    const m = 0.4 * stoneL;               // ruby protrusion past the arm's nose
    const wallW = 0.55;
    const sxL = -stoneW - gGap - wallW, sxR = gGap + wallW; // block outer x
    const nx0 = -stoneW - gGap, nx1 = gGap;                 // slot walls
    const yN = m, yF = stoneL + gGap, yB = yF + wallW;      // nose / slot floor / block back
    const ash = new THREE.Shape();
    ash.moveTo(sxR, yN);
    ash.lineTo(sxR, yB);
    ash.lineTo(sxL, yB);
    ash.lineTo(sxL, yN);
    ash.lineTo(nx0, yN);
    ash.lineTo(nx0, yF);
    ash.lineTo(nx1, yF);
    ash.lineTo(nx1, yN);
    ash.closePath();
    const armGeo = new THREE.ExtrudeGeometry(ash, {
      depth: t, bevelEnabled: true, bevelThickness: armBevel, bevelSize: armBevel,
      bevelSegments: 1, curveSegments: 1,
    });
    armGeo.translate(0, 0, -t / 2);
    const arm = new THREE.Mesh(armGeo, MATS.steel);
    arm.position.set(seat.x, seat.y, 0); // arm stays in the fork's own plane
    arm.rotation.z = rotZ;
    g.add(arm);

    // ARM BAR: the head must be CARRIED by the fork, not hang off its
    // ruby — a bar from the pivot boss out to the slotted head, the way a
    // real anchor's arms run. The straight boss→head line stays a full
    // unit outside the wheel's swept teeth (asserted below with the rest).
    const headMid = new THREE.Vector2(
      seat.x + tau.x * (yN + yB) / 2,
      seat.y + tau.y * (yN + yB) / 2);
    const barLen = headMid.length();
    const barDir = headMid.clone().divideScalar(barLen || 1);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(t * 0.95, barLen, t), MATS.steel);
    bar.position.set(headMid.x / 2, headMid.y / 2, 0);
    bar.rotation.z = Math.atan2(barDir.y, barDir.x) - Math.PI / 2;
    g.add(bar);

    // Clearance sanity: no STEEL of this arm may enter the wheel's swept
    // tooth annulus, at any point of the fork's ±bank swing. Checked at
    // the governing points (head nose corners, bar edges nearest the
    // wheel); the inspector's steel-vs-wheel penetration budget is the
    // permanent guard.
    const W = new THREE.Vector2(0, D);
    const worldPt = (lx, ly) => new THREE.Vector2(
      seat.x + Math.cos(rotZ) * lx - Math.sin(rotZ) * ly,
      seat.y + Math.sin(rotZ) * lx + Math.cos(rotZ) * ly);
    for (const [lx, ly] of [[sxL, yN], [sxR, yN], [sxL, yB], [sxR, yB]]) {
      const p = worldPt(lx, ly);
      const clr = p.distanceTo(W) - R - bank * p.length();
      if (clr < 0.1)
        console.warn('pallet arm: steel within the wheel sweep', sigma, clr.toFixed(3));
    }
  }
  stoneAndArm(-1); // entry
  stoneAndArm(1);  // exit

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

// staffTop/staffBottom: the staff's reach UP and DOWN from the wheel's
// mid-plane. They exist (rather than one symmetric staffHeight) because the
// cock jewel above and the roller stack below are NOT symmetric about the
// wheel — with the flat, low balance cock the staff reaches barely 3 up but
// must still run down past the safety roller; a symmetric staff would poke
// out through the cock. Defaults preserve the old symmetric behaviour.
// pinDrop: wheel mid-plane → impulse-pin mid-plane distance. The pin's WORLD
// plane is pinned by the pallet fork's notch (it must not move when the
// balance is re-planed), so the caller passes L_BALANCE − pin plane here.
// The roller table stays 0.2·t above the pin and the safety roller 0.4·t
// below it, as before; default −t·1.8 keeps the old hard-coded stack.
export function makeBalanceWheel({ radius, thickness, staffHeight = thickness * 6,
                                   staffTop = null, staffBottom = null,
                                   pinDrop = thickness * 1.8 }) {
  const g = new THREE.Group();
  const rimO = radius;
  const rimI = radius - thickness * 0.5;

  // Slim annular rim — 0.5·t wide × 0.55·t tall (down from 0.8 × 0.75,
  // itself already down from 1.3 × 1.0): a light precision ring. The
  // proportions are mirrored in main.js (HACK_RIM_I, RIM_H) — the stop
  // work's pad annulus is derived from them, so they must move together.
  const rim = new THREE.Mesh(ringExtrude(rimO, rimI, thickness * 0.55, 48), MATS.brass);
  g.add(rim);

  // Two arms (a single diameter bar = 2 arms), matched to the finer rim —
  // kept inside the rim's own z-band.
  const armGeo = new THREE.BoxGeometry(rimI * 2, thickness * 0.5, thickness * 0.4);
  g.add(new THREE.Mesh(armGeo, MATS.steel));

  // Central staff along Z. Asymmetric (staffTop/staffBottom) when the caller
  // says so; staffHeight remains the symmetric fallback.
  const sTop = staffTop ?? staffHeight / 2;
  const sBot = staffBottom ?? staffHeight / 2;
  const staffGeo = new THREE.CylinderGeometry(thickness * 0.35, thickness * 0.35, sTop + sBot, 16);
  staffGeo.rotateX(Math.PI / 2);
  const staff = new THREE.Mesh(staffGeo, MATS.steel);
  staff.position.z = (sTop - sBot) / 2;
  g.add(staff);

  // 16 timing screws radially around the rim. Outward PROTRUSION trimmed
  // to 0.3: the tips set the balance's true swept radius against the
  // balance cock's T-foot legs, the fork-pivot boss and the plate's
  // cutaway edge — every 0.1 of protrusion is 0.1 every one of those must
  // stand off. Head radii sized to the slimmer rim (base 0.24·t < the
  // rim's 0.275·t half-height, so the screws stay inside the rim's z-band
  // and the HACK_SCREW_DROP mirror in main.js stays positive). Embedment
  // (screwLen − protrusion = 0.16·t = 0.4) is solved from the stop-work
  // pad's annulus: pad top diameter = rim width − embedment − standoff
  // must stay ≥ 0.7. HACK_SCREW_IN_R in main.js mirrors the inner tips.
  const SCREW_PROTRUSION = 0.3;
  const screwLen = SCREW_PROTRUSION + thickness * 0.16;
  const screwGeo = new THREE.CylinderGeometry(thickness * 0.20, thickness * 0.24, screwLen, 10);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sc = new THREE.Mesh(screwGeo, MATS.blueSteel);
    sc.rotation.z = a - Math.PI / 2; // cylinder Y-axis -> radial
    const rc = rimO - (screwLen / 2 - SCREW_PROTRUSION); // tip lands at rimO + PROTRUSION
    sc.position.set(Math.cos(a) * rc, Math.sin(a) * rc, 0);
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
  // The whole roller stack hangs off the PIN's plane (see pinDrop above):
  // table 0.2·t above it, safety roller 0.4·t below it.
  const pinZ = -pinDrop;
  const rollerZ = pinZ + thickness * 0.2;
  const rtGeo = new THREE.CylinderGeometry(radius * 0.15, radius * 0.15, thickness * 0.5, 32);
  rtGeo.rotateX(Math.PI / 2);
  rtGeo.translate(0, 0, rollerZ);
  g.add(new THREE.Mesh(rtGeo, MATS.steel));

  // Ruby impulse pin at the roller's edge, in the roller-table plane itself so
  // it seats between the fork horns (the fork plane is level with the roller).
  const pinGeo = new THREE.CylinderGeometry(thickness * 0.22, thickness * 0.22, thickness * 1.2, 12);
  pinGeo.rotateX(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeo, MATS.ruby);
  pin.position.set(rollerR, 0, pinZ);
  g.add(pin);

  // Crescent-notched safety roller (smaller disc under the impulse roller).
  const srR = radius * 0.2;
  const srZ = pinZ - thickness * 0.4;
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

// rMin override (§25 C): a heart pressed onto a TUBE needs its notch floor
// outside the tube's bore — the classic 0.32·radius would fall inside it.
// Default preserves the seconds-reset heart bit-for-bit.
export function makeHeartCam({ radius, thickness, boreR = 0.6, rMin: rMinOverride = null, bevel: bevelOn = true }) {
  const g = new THREE.Group();
  const rMin = rMinOverride ?? radius * 0.32;
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

  // bevel: false (§29) — CRISP faces: the extrude bevel expands the band
  // ±bevel in z AND the outline +bevel in XY (MODELING.md rule 1); §29's
  // margin-exact centre stack budgets the AUTHORED thickness, and the
  // dropped feeler arm's clearance was eaten by exactly this expansion.
  // Default (true) preserves the seconds-reset heart bit-for-bit.
  const bevel = bevelOn ? Math.min(thickness * 0.2, radius * 0.05) : 0;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevelOn,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geo.translate(0, 0, -thickness / 2);
  g.add(new THREE.Mesh(geo, MATS.blueSteel));
  g.userData.r = radius;
  g.userData.rMin = rMin;
  g.userData.bevel = bevel; // bevelSize EXPANDS the outline in XY — clearance math must add it
  return g;
}

// ---------------------------------------------------------------------------
// Column wheel (§25 D) — the chronograph switch: a castellated crown whose
// raised columns alternately block or admit a lever's beak. One actuation
// advances it HALF a column pitch, flipping beak-on-column ⇄ beak-in-gap.
// userData.profileAt(angle) returns the beak lift [0..1] at a given wheel
// angle for a beak standing at angle 0 — the SAME function the caller's
// tick() poses against, so the cut columns and the ridden profile cannot
// drift apart (the §25 A cam convention).
// ---------------------------------------------------------------------------
export function makeColumnWheel({ columns = 6, baseR = 1.5, baseH = 0.3, colH = 0.55, colInner = 0.95, boreR = 0.3, material }) {
  const mat = material || MATS.blueSteel;
  const g = new THREE.Group();
  const base = new THREE.Mesh(ringExtrude(baseR, boreR, baseH, 48), mat);
  g.add(base);
  const pitch = (Math.PI * 2) / columns;
  const duty = 0.5;             // column arc fraction of a pitch
  const flank = 0.18 * pitch;   // rise/fall arc — what the beak visibly climbs
  for (let i = 0; i < columns; i++) {
    const a0 = i * pitch - (duty * pitch) / 2;
    const shape = new THREE.Shape();
    const steps = 8;
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (k / steps) * duty * pitch;
      const x = Math.cos(a) * baseR, y = Math.sin(a) * baseR;
      if (k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    for (let k = steps; k >= 0; k--) {
      const a = a0 + (k / steps) * duty * pitch;
      shape.lineTo(Math.cos(a) * colInner, Math.sin(a) * colInner);
    }
    shape.closePath();
    const colGeo = new THREE.ExtrudeGeometry(shape, { depth: colH, bevelEnabled: false, curveSegments: 2 });
    colGeo.translate(0, 0, baseH / 2);
    g.add(new THREE.Mesh(colGeo, mat));
  }
  // Lower RATCHET skirt — one saw tooth per STEP (2 per column): what the
  // case pusher's pawl indexes. Real column wheels are driven exactly here.
  {
    const teethN = columns * 2;
    const rr = baseR * 0.9, tip = baseR * 1.12;
    const shape = new THREE.Shape();
    for (let i = 0; i < teethN; i++) {
      const a0 = (i / teethN) * Math.PI * 2, a1 = ((i + 1) / teethN) * Math.PI * 2;
      if (i === 0) shape.moveTo(Math.cos(a0) * tip, Math.sin(a0) * tip);
      else shape.lineTo(Math.cos(a0) * tip, Math.sin(a0) * tip);
      shape.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr); // saw flank
    }
    shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false, curveSegments: 2 });
    geo.translate(0, 0, -baseH / 2 - 0.22);
    g.add(new THREE.Mesh(geo, mat));
  }
  g.userData.columns = columns;
  g.userData.colH = colH;
  // Beak lift at wheel angle `a` (beak azimuth 0): 1 on a column, 0 in a gap,
  // linear on the flanks. Column i is centred at i·pitch.
  g.userData.profileAt = (a) => {
    let rel = ((a % pitch) + pitch) % pitch;             // distance past the nearest column centre
    if (rel > pitch / 2) rel = pitch - rel;              // fold to [0, pitch/2]
    const edge = (duty * pitch) / 2;
    if (rel <= edge - flank) return 1;
    if (rel >= edge) return 0;
    return (edge - rel) / flank;
  };
  return g;
}

// ---------------------------------------------------------------------------
// Reset hammer — pivoted lever whose hardened-steel roller presses against
// a heart cam's flank, camming it to the zero/notch position as it closes.
// ---------------------------------------------------------------------------

export function makeHammerLever({ length, width }) {
  const g = new THREE.Group();
  const hw = width / 2;
  // 2D outline (pre-bevel) — single source of truth for the mesh AND for
  // clearance solvers in main.js (exported via userData below).
  const outline = [
    [-hw, 0],
    [-hw * 0.5, length * 0.85],
    [-hw * 1.4, length],
    [hw * 1.4, length],
    [hw * 0.5, length * 0.85],
    [hw, 0],
  ];
  const s = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
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
  g.userData.outline = outline;      // pre-bevel 2D profile, local frame
  g.userData.bevel = width * 0.08;   // bevelSize EXPANDS the outline in XY
  g.userData.rollerR = hw * 0.7;     // roller at (0, length) — plain cylinder, no bevel
  g.userData.bossR = hw * 1.3;       // pivot boss at the origin
  return g;
}

// ---------------------------------------------------------------------------
// Setting lever — the keyless-works detent. Flat steel plate pivoted at the
// origin: a beak arm (+Y) whose upright pin rides the stem's groove (between
// its two collars), and a tail arm (−Y) carrying a tall post that does the
// ganged work — pressing the hack spring and driving the reset-hammer rod.
// ---------------------------------------------------------------------------

// Tail-post radius — exported so clearance solvers (hack-blade standoff in
// main.js) use the same value the mesh is built with.
export const SETTING_LEVER_POST_R = 0.45;

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
  const postGeo = new THREE.CylinderGeometry(SETTING_LEVER_POST_R, SETTING_LEVER_POST_R, postH, 12);
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
// Hack pad proportion — shared by the stop work's ruby pad in main.js (the
// pad's flared cap: top radius over its post radius). The old blade-and-
// ramp-collar hacking builders that lived here are gone with that design;
// the stop crank is assembled from primitives at its solve site in main.js.
// ---------------------------------------------------------------------------
export const HACK_RUBY_FLARE = 1.15;  // ruby cap's top radius over the post radius

// ---------------------------------------------------------------------------

// An oscillator's spring has ONE moving end: the collet turns with the
// staff; the outer terminal is pinned to the balance cock through its stud
// and does not move. So winding is a change of GEOMETRY (the coils bunch
// and spread as the inner boundary rotates), not a rigid rotation of the
// whole spiral — which is what this used to be: the entire group, stud
// included, turned with the balance, meaning the spring never actually
// stored anything (TODO item 4). The spiral is now precomputed as wind
// keyframes: frame k is the Archimedean spiral whose inner end is rotated
// by θ_k with the outer end FIXED at its stud angle; tick() swaps frames
// via userData.setWind(θ). The stud itself is gone from this group — it
// belongs to the COCK (main.js builds it there); userData tells the
// caller where the terminal ends so stud and curb pins can meet it.
export function makeHairspring({ innerR, outerR, coils = 12, height,
                                 windFrames = 41, windMaxRad = 1.0 }) {
  const g = new THREE.Group();
  const ribbonR = Math.max(((outerR - innerR) / coils) * 0.12, 0.05);
  const segs = Math.max(coils * 48, 96);
  const S0 = coils * Math.PI * 2; // unwound span; outer end angle ≡ S0

  const spiralGeo = (theta) => {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const a = theta + t * (S0 - theta); // inner (turned) → outer (fixed)
      const r = innerR + t * (outerR - innerR);
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, ribbonR, 4, false);
  };
  const frames = [];
  for (let k = 0; k < windFrames; k++) {
    frames.push(spiralGeo(-windMaxRad + (k / (windFrames - 1)) * 2 * windMaxRad));
  }
  const tube = new THREE.Mesh(frames[(windFrames - 1) >> 1], MATS.blueSteel);
  tube.scale.z = Math.max(height / (ribbonR * 2), 1); // stand the ribbon on edge
  g.add(tube);
  g.userData.setWind = (theta) => {
    const t = Math.max(-windMaxRad, Math.min(windMaxRad, theta));
    const k = Math.round(((t + windMaxRad) / (2 * windMaxRad)) * (windFrames - 1));
    if (tube.geometry !== frames[k]) tube.geometry = frames[k];
  };

  // Collet at center (turns with the staff; a cylinder, so no visual spin).
  const colletGeo = new THREE.CylinderGeometry(innerR, innerR, height * 1.1, 20);
  colletGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(colletGeo, MATS.steel));

  // Raised terminal end-curve from the fixed outer coil end up toward the
  // stud (which the cock provides). This part never moves.
  const termPts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = S0 + t * 0.9;
    const r = outerR + t * ribbonR * 3;
    termPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, height * 0.55 * t));
  }
  const termGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(termPts), 24, ribbonR, 4, false);
  g.add(new THREE.Mesh(termGeo, MATS.blueSteel));

  g.userData.r = outerR;
  g.userData.ribbonR = ribbonR;
  g.userData.endAngle = S0 + 0.9;                 // local angle where the STUD must sit
  g.userData.termEndR = outerR + ribbonR * 3;     // ...at this radius
  g.userData.termEndZ = height * 0.55;            // ...and this height above mid-plane
  // (termMid — the curb-pin straddle point — is gone with the regulator:
  // the balance is FREE-SPRUNG, timed by its screws alone; the terminal
  // runs uninterrupted from the outer coil to the stud.)
  return g;
}

// ---------------------------------------------------------------------------
// Ratchet wheel + click — standalone so both the going-barrel and the fusee
// arbor can carry one. Ratchet extrudes upward from z=0; the click and its
// screw sit just above it. Children named 'ratchet' / 'click'.
// ---------------------------------------------------------------------------

// STAR WHEEL — symmetric V-points (a detent star, not a saw ratchet:
// the jumper must ride identically in both directions). Points at
// u = 0 of each pitch, valleys at u = 0.5. Extruded 0-based.
export function makeStarWheel({ radius, points, thickness, depth, boreR = 0.5 }) {
  const s = new THREE.Shape();
  const rootR = radius - depth;
  for (let i = 0; i < points; i++) {
    const aTip = (i / points) * Math.PI * 2;
    const aVal = ((i + 0.5) / points) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.cos(aTip) * radius, Math.sin(aTip) * radius);
    else s.lineTo(Math.cos(aTip) * radius, Math.sin(aTip) * radius);
    s.lineTo(Math.cos(aVal) * rootR, Math.sin(aVal) * rootR);
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
  const mesh = new THREE.Mesh(geo, MATS.steel);
  mesh.name = 'star';
  return mesh;
}

// JUMPER — detent lever: pivot boss at the origin, tapered arm along +x
// ending in a V beak. Extruded 0-based; callers place and aim it.
export function makeJumper({ reach, thickness, width = 0.9 }) {
  const w2 = width / 2;
  // Outline kept as data so placement solvers work on the RENDERED shape
  // (mesh and solver share one source of truth — no bevel here, so the
  // outline is exact).
  const outline = [
    [0, w2],
    [reach * 0.6, w2 * 0.6],
    [reach - 0.01, w2 * 0.28],
    [reach + w2 * 0.9, 0], // the V beak's point
    [reach - 0.01, -w2 * 0.28],
    [reach * 0.6, -w2 * 0.6],
    [0, -w2],
  ];
  const s = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, MATS.blueSteel);
  mesh.name = 'jumperBeak';
  mesh.userData.outline = outline;
  return mesh;
}

// The click body alone (beak along +x, pivot hole at the origin end),
// extruded 0-based — callers place and aim it. Shared by the composite
// builder below and the plate-top click unit in main.js.
export function makeClick({ radius, thickness }) {
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
  const clickGeo = new THREE.ExtrudeGeometry(clickShape, {
    depth: thickness,
    bevelEnabled: false,
  });
  const click = new THREE.Mesh(clickGeo, MATS.blueSteel);
  click.name = 'click';
  return click;
}

export function makeRatchetAndClick({ radius, teeth = 24, thickness, includeClick = true, squareBore = null }) {
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
  if (squareBore != null) {
    // Square hole for a filed arbor square (drive fit + 0.03 assembly play).
    const h = (squareBore + 0.03) / 2;
    ratHole.moveTo(-h, -h);
    ratHole.lineTo(-h, h);
    ratHole.lineTo(h, h);
    ratHole.lineTo(h, -h);
    ratHole.closePath();
  } else {
    ratHole.absarc(0, 0, radius * 0.28, 0, Math.PI * 2, true);
  }
  rShape.holes.push(ratHole);
  const ratGeo = new THREE.ExtrudeGeometry(rShape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 2,
  });
  const ratchet = new THREE.Mesh(ratGeo, MATS.steel);
  ratchet.name = 'ratchet';
  g.add(ratchet);
  if (!includeClick) {
    g.userData.r = radius;
    g.userData.teeth = teeth;
    return g;
  }

  // Click / pawl — pivoted just outside the ratchet, beak seated in a valley.
  // Click sits BELOW the ratchet, on the wheel side — where the part that
  // carries it (great wheel / barrel lid) actually is.
  const click = makeClick({ radius, thickness: thickness * 0.75 });
  click.geometry.translate(0, 0, -thickness * 0.9);
  click.position.set(radius * 1.28, 0, 0);
  click.rotation.z = Math.PI * 0.778; // aim the beak at the valley point
  g.add(click);
  const cw2 = radius * 0.11;
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

// arborH: full length of the central arbor (centred on the body's
// mid-plane) — the caller sizes it to reach its actual bearings; the
// default reproduces the old fixed proportion.
// ratchet: the going-barrel form carries a ratchet + click on its lid by
// default. Pass `ratchet: false` when the caller has not built the winding
// path yet — a click riding round with the barrel it is supposed to HOLD is a
// display fiction, and an unwound barrel is better shown with no click at all
// than with one that turns.
export function makeBarrel({ radius, height, teeth, module, plain = false, arborH = null,
                             ratchet = !plain }) {
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
  springMesh.name = 'mainspringRibbon'; // TODO 12 triage: SPRING stock — the coil IS the mainspring (real ones 0.05–0.20 mm); named so §50's kind table sees it
  springMesh.scale.z = Math.max((height * 0.7) / (sRibbon * 2), 1);
  const spring = new THREE.Group();
  spring.name = 'spring';
  spring.add(springMesh);
  // Outer hook to the barrel wall.
  const oh = new THREE.Mesh(
    new THREE.BoxGeometry(wallModule * 1.5, sRibbon * 2.2, height * 0.55),
    MATS.steel
  );
  oh.name = 'mainspringHook'; // TODO 12 triage: the spring's own hook tab — spring stock with the ribbon it belongs to
  oh.position.set(springOuter, 0, 0);
  spring.add(oh);
  g.add(spring);

  // Central arbor.
  const arborGeo = new THREE.CylinderGeometry(radius * 0.09, radius * 0.09, arborH ?? height * 2.4, 16);
  arborGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(arborGeo, MATS.steel));

  // Ratchet wheel + click on top (going-barrel form only — a plain fusee
  // drum has its ratchet on the fusee arbor instead).
  if (ratchet) {
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

// holes: circular through-bores {x, y, r}; slots: stadium-shaped through
// openings {ax, ay, bx, by, r} for parts that SWEEP through the plate (the
// setting lever's tail post crossing to the dial side) — same conventions as
// makeThreeQuarterPlate. The bevel grows material INTO every drawn opening,
// so openings are drawn oversized by bevelSize and the finished edges land
// on the caller's requested radii.
export function makeBackPlate({ radius, thickness, holes = [], slots = [] }) {
  const bevelSize = radius * 0.008;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  for (const h of holes) {
    const p = new THREE.Path();
    p.absarc(h.x, h.y, h.r + bevelSize, 0, Math.PI * 2, true); // CW: a hole
    shape.holes.push(p);
  }
  for (const sl of slots) {
    const r = sl.r + bevelSize;
    const dx = sl.bx - sl.ax, dy = sl.by - sl.ay;
    const d = Math.hypot(dx, dy);
    const ux = d > 1e-9 ? dx / d : 1, uy = d > 1e-9 ? dy / d : 0;
    const ang = Math.atan2(uy, ux);
    const p = new THREE.Path();
    // Clockwise stadium; each cap bulges away from the other end (see
    // makeThreeQuarterPlate for the arc-direction reasoning).
    p.absarc(sl.bx, sl.by, r, ang + Math.PI / 2, ang - Math.PI / 2, true);
    p.absarc(sl.ax, sl.ay, r, ang - Math.PI / 2, ang - Math.PI * 1.5, true);
    p.closePath();
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.15,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 72,
  });
  geo.translate(0, 0, -thickness / 2);
  // Perled: circular graining on the movement-side face (the shader gates
  // to upward-facing surfaces; the dial-side face and edge stay plain).
  const m = new THREE.Mesh(geo, MATS.perledNickel);
  m.userData.r = radius;
  return m;
}

// ---------------------------------------------------------------------------
// Glashütte-style THREE-QUARTER PLATE.
//
// The upper plate of the movement: one disc, coplanar with nothing else,
// carrying the UPPER pivot of every train arbor and the pallet fork, with a
// quarter of its area cut away so the balance can hang in the open under its
// own cock. Everything about the outline is passed in already SOLVED by the
// caller (main.js measures the parts it has to clear) — this builder only
// turns that description into material:
//
//   cut   the balance + escapement opening. A wedge of half-angle `phiOpen`
//         about `aim` (the plate-centre → balance-centre direction) is open
//         all the way to the rim; outside that wedge the edge follows
//         `cut.radii`, a per-degree table the caller measures. That table is
//         why this is not a circular hole: the opening also has to expose the
//         escape wheel, the pallet fork and the bridge that carries them,
//         which stand off to one side of the balance — see the TQ_CUT solve
//         in main.js.
//   holes circular openings (barrel/drum, pivot bores, pillar seats).
//   slots stadium-shaped openings for parts that SWEEP through the plate
//         (the setting lever's tail post and its ramp collar) — the swept
//         union of a circle of radius r along the segment a → b.
//
// Style follows makeBackPlate: nickel, bevelled edge, extruded about z = 0.
// ---------------------------------------------------------------------------
// The cut's edge radius at bearing `phi` off `cut.aim`, read from the caller's
// per-degree table (cut.radii[0..359], index = degrees CCW from the aim) with
// linear interpolation. A table rather than a formula because the opening is
// not one shape: it is the balance's clearance circle UNIONED with a window
// measured off the escapement's own geometry, and only the caller can measure
// that. See the TQ_CUT solve in main.js.
export function cutEdgeRadius(cut, phi) {
  const deg = (phi * 180) / Math.PI;
  const t = ((deg % 360) + 360) % 360;
  const i = Math.floor(t), f = t - i;
  const a = cut.radii[i % 360], b = cut.radii[(i + 1) % 360];
  return a + (b - a) * f;
}

export function makeThreeQuarterPlate({ radius, thickness, cut: cutIn, holes = [], slots = [] }) {
  // A bevelled extrusion grows its material OUTWARD from the drawn profile by
  // bevelSize — into every hole and into the balance cut. The caller solved
  // its clearances against the finished EDGES, so shrink the drawn outline
  // and grow the drawn openings by exactly that much and the mesh lands where
  // it was asked to.
  const bevelSize = 0.06;
  radius -= bevelSize;
  const cut = { ...cutIn, radii: cutIn.radii.map((r) => r + bevelSize) };
  holes = holes.map((h) => ({ ...h, r: h.r + bevelSize }));
  slots = slots.map((s) => ({ ...s, r: s.r + bevelSize }));
  // Where the wedge's two edges leave the rim: |C + t·d| = radius, t > 0.
  const rimHit = (ang) => {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const b = cut.x * dx + cut.y * dy;
    const c = cut.x * cut.x + cut.y * cut.y - radius * radius;
    const t = -b + Math.sqrt(Math.max(b * b - c, 0));
    return { x: cut.x + dx * t, y: cut.y + dy * t };
  };
  const angP = cut.aim + cut.phiOpen, angM = cut.aim - cut.phiOpen;
  const EP = rimHit(angP), EM = rimHit(angM);
  const thP = Math.atan2(EP.y, EP.x);
  let thM = Math.atan2(EM.y, EM.x);
  while (thM < thP) thM += Math.PI * 2; // travel CCW from E+ the long way round

  // A slot may reach PAST the rim — the setting lever's ramp collar hangs
  // over the plate's edge — and a hole that crosses the outer contour is not
  // a hole at all (ExtrudeGeometry triangulates it into garbage: the collar
  // came out embedded in solid plate at every crown pose). Those become
  // NOTCHES: the rim is walked in small steps and pulled in wherever a slot
  // eats into it, and only the fully-enclosed slots stay as holes.
  const segDist = (px, py, sl) => {
    const vx = sl.bx - sl.ax, vy = sl.by - sl.ay;
    const L2 = vx * vx + vy * vy || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - sl.ax) * vx + (py - sl.ay) * vy) / L2));
    return Math.hypot(px - sl.ax - t * vx, py - sl.ay - t * vy) - sl.r;
  };
  const reachesRim = (sl) => {
    for (const [x, y] of [[sl.ax, sl.ay], [sl.bx, sl.by]]) if (Math.hypot(x, y) + sl.r > radius) return true;
    return false;
  };
  const notches = slots.filter(reachesRim);
  slots = slots.filter((sl) => !reachesRim(sl));
  const rimRadiusAt = (th) => {
    const dx = Math.cos(th), dy = Math.sin(th);
    let R = radius;
    for (const sl of notches) {
      let lo = null;
      for (let t = 0; t <= radius; t += 0.4) {
        if (segDist(dx * t, dy * t, sl) <= 0) { lo = Math.max(0, t - 0.4); break; }
      }
      if (lo === null) continue;
      let hi = lo + 0.4;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        if (segDist(dx * m, dy * m, sl) <= 0) hi = m; else lo = m;
      }
      R = Math.min(R, lo);
    }
    return R;
  };

  const s = new THREE.Shape();
  s.moveTo(EP.x, EP.y);
  if (notches.length) {
    // Adaptive: a notch's angular edges are near-radial steps (43.7 → 36 in a
    // fraction of a degree), and a straight chord across one of those cuts
    // the corner off the opening — measurably (0.02 into the ramp collar's
    // clearance) at a uniform 0.5°.
    const emit = (th0, R0, th1, R1, depth) => {
      const thm = (th0 + th1) / 2;
      const Rm = rimRadiusAt(thm);
      if (depth < 7 && Math.abs(R1 - R0) > 0.05) {
        emit(th0, R0, thm, Rm, depth + 1);
        emit(thm, Rm, th1, R1, depth + 1);
        return;
      }
      s.lineTo(Math.cos(th1) * R1, Math.sin(th1) * R1);
    };
    const steps = Math.max(72, Math.round(((thM - thP) / (Math.PI * 2)) * 720));
    let thPrev = thP, Rprev = rimRadiusAt(thP);
    for (let i = 1; i <= steps; i++) {
      const th = thP + ((thM - thP) * i) / steps;
      const R = rimRadiusAt(th);
      emit(thPrev, Rprev, th, R, 0);
      thPrev = th; Rprev = R;
    }
  } else {
    s.absarc(0, 0, radius, thP, thM, false); // rim, CCW, material on the left
  }
  // ...in along the −phiOpen edge, around the balance the short way (φ
  // decreasing, i.e. clockwise about the balance so the opening stays a
  // hole in the material), then back out along the +phiOpen edge.
  const STEP = 2 * Math.PI / 180;
  const N = Math.max(2, Math.round((2 * (Math.PI - cut.phiOpen)) / STEP));
  for (let i = 0; i <= N; i++) {
    const phi = -cut.phiOpen - (i / N) * 2 * (Math.PI - cut.phiOpen);
    const r = cutEdgeRadius(cut, phi);
    s.lineTo(cut.x + Math.cos(cut.aim + phi) * r, cut.y + Math.sin(cut.aim + phi) * r);
  }
  s.lineTo(EP.x, EP.y);
  s.closePath();

  for (const h of holes) {
    const p = new THREE.Path();
    p.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true); // CW: a hole
    s.holes.push(p);
  }
  for (const sl of slots) {
    const dx = sl.bx - sl.ax, dy = sl.by - sl.ay;
    const d = Math.hypot(dx, dy);
    const ux = d > 1e-9 ? dx / d : 1, uy = d > 1e-9 ? dy / d : 0;
    const ang = Math.atan2(uy, ux);
    const p = new THREE.Path();
    // Clockwise stadium. Each cap must bulge AWAY from the other end: going
    // clockwise from +90° to −90° sweeps through the segment's own direction,
    // so that arc belongs to the FAR end (b) and the −90° → −270° one to a.
    p.absarc(sl.bx, sl.by, sl.r, ang + Math.PI / 2, ang - Math.PI / 2, true);
    p.absarc(sl.ax, sl.ay, sl.r, ang - Math.PI / 2, ang - Math.PI * 1.5, true);
    p.closePath();
    s.holes.push(p);
  }

  // `thickness` is the plate's TOTAL depth, bevel included — the caller's
  // z-budget is measured against its real faces, and ExtrudeGeometry adds the
  // bevel OUTSIDE the extrusion depth (the back plate's bevel quietly does
  // the same; here it would have put the plate's underside 0.16 into the
  // pallet fork).
  const bevelT = thickness * 0.15;
  const depth = thickness - 2 * bevelT;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 72,
  });
  geo.translate(0, 0, -depth / 2);
  // Striped: the material's world-space bands continue across the escape
  // bridge, which shares it — see MATS.ribbedNickel in materials.js.
  const m = new THREE.Mesh(geo, MATS.ribbedNickel);
  m.userData.r = radius;
  m.userData.thickness = thickness;
  return m;
}

// `thickness` is the slab's TOTAL depth, bevels included (same convention as
// makeThreeQuarterPlate) — the caller budgets real z-faces, and
// ExtrudeGeometry adds its bevel OUTSIDE the extrusion depth. The default
// (width·0.5 total = width·0.4 core + 2·width·0.05 bevel) reproduces the old
// fixed proportions exactly; the flat Glashütte-style balance cock passes a
// much thinner slab.
// jewelAt: the pivot jewel's position as a fraction of length from the slab
// centre (+ = toward the rounded head). At 0.5 the jewel sits at the head
// arc's own centre, so the slab ends exactly one half-width past the staff —
// the classic round-head cock, with no dead overhang beyond the bearing.
export function makeCock({ length, width, thickness = width * 0.5, studHole = null, jewelAt = 0.12 }) {
  const g = new THREE.Group();
  const hw = width / 2;
  const s = new THREE.Shape();
  s.moveTo(hw, -length * 0.5);
  s.quadraticCurveTo(hw * 0.55, 0, hw, length * 0.5); // right waisted side
  s.absarc(0, length * 0.5, hw, 0, Math.PI, false); // rounded top
  s.quadraticCurveTo(-hw * 0.55, 0, -hw, -length * 0.5); // left waisted side
  s.absarc(0, -length * 0.5, hw, Math.PI, Math.PI * 2, false); // rounded foot
  s.closePath();

  // Spy hole toward the head — slid down out of the way of a stud hole
  // punched above it AND of a high-set jewel (overlapping holes break the
  // extrude; the jewel setting's collar reaches width·0.16·1.6 around
  // jewelAt·length).
  const h1 = new THREE.Path();
  let h1y = length * 0.42;
  if (studHole) h1y = Math.min(h1y, studHole.y - studHole.r - width * 0.12 - 0.25);
  h1y = Math.min(h1y, length * jewelAt - width * 0.16 * 1.6 - width * 0.12 - 0.25);
  h1.absarc(0, h1y, width * 0.12, 0, Math.PI * 2, true);
  s.holes.push(h1);
  // STUD HOLE: a real bore for the hairspring stud to pass through the
  // slab — the traditional fit (the stud drops in and is pinned), and the
  // honest alternative to a post interpenetrating solid nickel.
  if (studHole) {
    const hS = new THREE.Path();
    hS.absarc(0, studHole.y, studHole.r, 0, Math.PI * 2, true);
    s.holes.push(hS);
  }
  const h2 = new THREE.Path();
  h2.absarc(0, -length * 0.42, width * 0.12, 0, Math.PI * 2, true);
  s.holes.push(h2);

  const bevelT = Math.min(width * 0.05, thickness * 0.2);
  const depth = thickness - 2 * bevelT; // core extrusion; bevels restore the total
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: width * 0.05,
    bevelSegments: 1,
    curveSegments: 20,
  });
  geo.translate(0, 0, -depth / 2);
  g.add(new THREE.Mesh(geo, MATS.nickel));

  // Sunk jewel setting at the pivot.
  const js = makeJewelSetting({ r: width * 0.16 });
  js.position.set(0, length * jewelAt, depth * 0.5);
  g.add(js);

  g.userData.length = length;
  return g;
}

// ---------------------------------------------------------------------------
// Combined PALLET-AND-ESCAPE BRIDGE — a separate cock spanning the escape
// wheel and pallet fork, standing on LEGS all the way down to the base plate
// (not on the three-quarter plate above it), so the whole escapement is one
// assembly that can be fitted, adjusted and lifted on its own, reached
// through the window cut in the three-quarter plate.
//
// `chain` is an ordered list of {x, y, r, foot} in bridge-local XY: the slab
// is the union of a disc at every link and a bar between consecutive links,
// which is how a real bridge is shaped (bosses joined by waisted arms) and
// what lets the caller SOLVE the leg positions against everything underneath
// instead of drawing a shape and hoping. Links marked foot:true get a leg
// dropping `footDrop` to the base plate, a spread foot pad at the bottom and
// a screw head on top. Slab is centred on local z = 0.
// ---------------------------------------------------------------------------
export function makeEscapeBridge({ chain, thickness, footDrop, jewels = [] }) {
  const g = new THREE.Group();
  // Striped like the plate it serves under — one world-space pattern, so
  // the lines run unbroken from plate to bridge (legs/walls stay plain:
  // the shader gates the stripes to upward-facing surfaces).
  const slabMat = MATS.ribbedNickel;
  for (const n of chain) {
    let disc;
    if (n.bore) {
      // A pivot boss: bored for the staff and COUNTERBORED from the top for
      // its chaton, so the jewel is set INTO the bridge the same way it is
      // set into the plate — a chaton lying on a surface is not a setting.
      const t2 = thickness / 2;
      const cbR = n.cbR ?? n.bore, cbD = n.cbDepth ?? 0;
      const pts = [
        new THREE.Vector2(n.bore, -t2),
        new THREE.Vector2(n.bore, t2 - cbD),
        new THREE.Vector2(cbR, t2 - cbD),
        new THREE.Vector2(cbR, t2),
        new THREE.Vector2(n.r, t2),
        new THREE.Vector2(n.r, -t2),
        new THREE.Vector2(n.bore, -t2),
      ];
      const bossG = new THREE.LatheGeometry(pts, 40);
      bossG.rotateX(Math.PI / 2); // lathe revolves about +Y; stand it along Z
      disc = new THREE.Mesh(bossG, slabMat);
    } else {
      disc = new THREE.Mesh(new THREE.CylinderGeometry(n.r, n.r, thickness, 28), slabMat);
      disc.geometry.rotateX(Math.PI / 2);
    }
    disc.position.set(n.x, n.y, 0);
    g.add(disc);
  }
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i], b = chain[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const w = 2 * Math.min(a.r, b.r) * 0.8; // waisted between the bosses
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, w, thickness), slabMat);
    bar.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
    bar.rotation.z = Math.atan2(dy, dx);
    g.add(bar);
  }
  for (const n of chain) {
    if (!n.foot) continue;
    const legR = n.r * 0.62;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 1.15, footDrop, 20), slabMat);
    leg.geometry.rotateX(Math.PI / 2);
    leg.position.set(n.x, n.y, -thickness / 2 - footDrop / 2);
    g.add(leg);
    // Spread pad where it lands on the base plate, and the screw that holds
    // the whole bridge down: shaft through the slab plus a PROUD blued head
    // seated on the top face (the old version sank the whole screw inside
    // the slab, leaving the bridge visually unfastened — the same pattern
    // as the balance cock's T-foot screws).
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(legR * 1.5, legR * 1.5, thickness * 0.5, 20), slabMat);
    pad.geometry.rotateX(Math.PI / 2);
    pad.position.set(n.x, n.y, -thickness / 2 - footDrop + thickness * 0.25);
    g.add(pad);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(legR * 0.35, legR * 0.35, thickness, 14), MATS.blueSteel);
    shaft.geometry.rotateX(Math.PI / 2);
    shaft.position.set(n.x, n.y, 0);
    g.add(shaft);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(legR * 0.6, legR * 0.6, STOCK_MIN_U, 14), MATS.blueSteel); // TODO 12: floor stock — screw head proud of the leg, free upward
    head.geometry.rotateX(Math.PI / 2);
    head.position.set(n.x, n.y, thickness / 2 + 0.11);
    g.add(head);
  }
  for (const j of jewels) {
    // Rubbed-in jewel, seated in its counterbore. Every face is kept OFF
    // the surrounding boss: the outer wall a hair inside the counterbore
    // wall, the top a hair below the bridge face, the bottom a hair above
    // the counterbore floor. Coincident faces here z-fought — the ruby and
    // the nickel boss share a plane at the same depth, which flickered as a
    // red/white checkerboard and read as a stone lying IN the surface
    // rather than set into a bore. (The plate jewels avoid this with the
    // same margins.)
    const seatGap = 0.08;
    const outerR = (j.cbR ?? j.boreR + 0.95) - 0.1; // inside the counterbore wall
    const jd = Math.max(j.depth - seatGap, j.depth * 0.6);
    // Dished face (flat seating rim, concave oil sink to the bore) instead
    // of a flat glossy annulus — same silhouette, nothing rises above the
    // stone's old top plane. See jewelFaceGeo in main.js for why.
    const pts = [
      new THREE.Vector2(j.boreR, -jd / 2), new THREE.Vector2(outerR, -jd / 2),
      new THREE.Vector2(outerR, jd / 2),
      new THREE.Vector2(outerR * 0.72, jd / 2),
      new THREE.Vector2(outerR * 0.48, jd * 0.18),
      new THREE.Vector2(j.boreR * 1.25, jd * 0.02),
      new THREE.Vector2(j.boreR, -jd * 0.05),
      new THREE.Vector2(j.boreR, -jd / 2),
    ];
    const dishGeo = new THREE.LatheGeometry(pts, 40);
    dishGeo.rotateX(Math.PI / 2);
    const jewel = new THREE.Mesh(dishGeo, MATS.ruby);
    jewel.position.set(j.x, j.y, thickness / 2 - seatGap - jd / 2);
    g.add(jewel);
  }
  g.userData.thickness = thickness;
  return g;
}

// ---------------------------------------------------------------------------
// SCREWED GOLD CHATON — the Glashütte/Lange signature, and the traditional
// way an upper pivot jewel is mounted.
//
// Two different fits, and they are not the same:
//  · the RUBY into the CHATON is a friction fit — pressed (or rubbed) into
//    the gold ring, permanent;
//  · the CHATON into the PLATE is SCREWED — it drops into a counterbore and
//    is held by 2–3 tiny blued screws whose heads overlap its rim.
// The screws are the point: jewels were expensive and fragile, and a screwed
// chaton could be lifted out to replace a cracked jewel or shimmed to set an
// arbor's endshake. Pressed-in (Seitz) jewels made that obsolete, so screwed
// chatons survive purely as a mark of traditional finishing — which is
// exactly why a movement with a three-quarter plate and an Ab/Auf reserve
// should have them.
//
// Local frame: z = 0 is the chaton's TOP face (flush with the plate's), the
// body hanging down `thickness`. userData.outerR is the counterbore radius
// the caller must cut; userData.screwR/screwAt place the screws in the plate.
// ---------------------------------------------------------------------------
export function makeChaton({ boreR, thickness = 0.35, screwCount = 3, screwPhase = 0 }) {
  const g = new THREE.Group();
  const rubyR = boreR + 0.4;
  const outerR = rubyR + 0.55;

  // Gold ring. Lathe profile, outer wall → rim → the OIL SINK: the underside
  // is dished out around the bore so oil is held at the pivot by surface
  // tension instead of creeping away along the plate.
  const t = thickness;
  const pts = [
    new THREE.Vector2(rubyR, 0),
    new THREE.Vector2(outerR, 0),
    new THREE.Vector2(outerR, -t),
    new THREE.Vector2(rubyR * 1.02, -t),
    new THREE.Vector2(rubyR * 1.02, -t * 0.55),
    new THREE.Vector2(rubyR, -t * 0.35),
    new THREE.Vector2(rubyR, 0),
  ];
  // LatheGeometry revolves about +Y — the profile's second coordinate comes
  // out as height in Y, so it has to be stood up along Z like every other
  // lathe part here (makePillar does the same).
  const ringG = new THREE.LatheGeometry(pts, 40);
  ringG.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(ringG, MATS.gold));

  // Ruby, pressed in: an annulus with the pivot's bore through it, its top
  // face slightly below the gold rim (as a set stone sits).
  // TODO 12: ruby at 0.74·t (was 0.62) — at the cock chaton's t = 0.434 that
  // is 0.321 u, clearing the 0.12 mm stock floor, and the underside lands
  // exactly where the oil sink begins, so the deepening costs no new mate.
  // Real pressed jewels are 0.3–0.6 mm; even the plate chatons' default
  // t = 0.35 improves from 0.217 to 0.259 u toward that.
  const rubyGeo = ringExtrude(rubyR, boreR, t * 0.74, 32);
  const jewel = new THREE.Mesh(rubyGeo, MATS.ruby);
  jewel.position.z = -t * 0.08 - (t * 0.74) / 2;
  g.add(jewel);
  // Oil sink cone on the ruby's pivot side — the classic dished seat, ridden
  // down with the thicker stone so the cone still starts at its underside.
  const sink = new THREE.Mesh(
    new THREE.CylinderGeometry(rubyR * 0.98, boreR * 1.05, t * 0.22, 32, 1, true), MATS.ruby);
  sink.geometry.rotateX(Math.PI / 2);
  sink.position.z = -t * 0.94;
  g.add(sink);

  // Blued screws, heads FLUSH with the top face and straddling the rim: half
  // over the chaton, half biting the plate outside the counterbore.
  const headR = Math.max(0.22, outerR * 0.19), headT = t * 0.5;
  for (let i = 0; i < screwCount; i++) {
    const a = screwPhase + (i / screwCount) * Math.PI * 2;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(headR, headR * 0.92, headT, 16), MATS.blueSteel);
    head.geometry.rotateX(Math.PI / 2);
    head.position.set(Math.cos(a) * outerR, Math.sin(a) * outerR, -headT / 2);
    g.add(head);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.7, headR * 0.28, headT * 0.35), MATS.dark);
    // Sunk, not proud: nothing on this face may stand above the plate — the
    // hack blade passes 0.18 over it.
    slot.position.set(Math.cos(a) * outerR, Math.sin(a) * outerR, -headT * 0.28);
    slot.rotation.z = a;
    g.add(slot);
  }

  g.userData.outerR = outerR;
  g.userData.rubyR = rubyR;
  g.userData.boreR = boreR;
  g.userData.screwOuterR = outerR + headR;
  return g;
}

// Flush rubbed-in jewel — the same vocabulary as the escape-bridge and
// 3/4-plate stones: a ruby annulus sunk in a shallow counterbore, every
// face held off its host by seat margins (coincident planes z-fight; see
// the bridge jewels). The hosts here are solid meshes with no real bore
// cut, so the counterbore is carried by a low nickel collar whose rim
// stands a hair proud of the surface (local z = 0 is the host's face):
// from above you read polished rim → recess → sunken ruby, matching the
// rubbed-in stones above. Replaces the old brass-ring-plus-torus
// appliqué that sat ON the surface like a donut.
export function makeJewelSetting({ r }) {
  const g = new THREE.Group();
  const rimTop = 0.1;                    // hair proud of the host face
  const seatGap = 0.08;                  // same margin the bridge uses
  const wallR = r * 1.15;                // counterbore wall
  const outerR = r * 1.6;
  const d = Math.max(r * 0.35, 0.3);     // recess depth into the host
  const pts = [
    new THREE.Vector2(wallR, -d),
    new THREE.Vector2(wallR, rimTop),
    new THREE.Vector2(outerR, rimTop),
    new THREE.Vector2(outerR, -d - 0.1),
  ];
  const collarG = new THREE.LatheGeometry(pts, 32);
  collarG.rotateX(Math.PI / 2); // stand the profile up along Z
  g.add(new THREE.Mesh(collarG, MATS.nickel));
  // TODO 12: the stone at floor stock. d·0.8 gave 0.269 u at the balance
  // cock's setting; the max floors it at 0.12 mm while staying inside the
  // collar's lathe wall, which reaches −d−0.1 (deepest stone bottom here is
  // rimTop − seatGap − STOCK_MIN_U = −0.30 against −0.436).
  const rubyDepth = Math.max(d * 0.8, STOCK_MIN_U);
  const ruby = new THREE.Mesh(ringExtrude(wallR - seatGap, r * 0.5, rubyDepth, 32), MATS.ruby);
  ruby.position.z = rimTop - seatGap - rubyDepth / 2; // top sits below the rim
  g.add(ruby);
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

// Brand mark (§27) — the house signature: a lemniscate of Bernoulli (∞)
// whose pinched crossing reads as an hourglass waist. One closed curve,
// two reads a quarter-turn apart: lobes horizontal = infinity, lobes
// vertical = hourglass — the §27 orientation question dissolves on a
// part that SPINS (the crown), and a static carrier just picks its read
// by rotation at placement.
//
// SHARED and parameterised so a caseback or buckle can carry the same
// mark later — call it, never inline a copy. The mesh lies in the XY
// plane, lobes along ±X, centreline at z = 0, spanning 2·r wide by
// 2·r·aspect tall with a round stroke of radius tubeR. The CALLER embeds
// it: half-embedding (centreline ON the host surface, proud by exactly
// tubeR) is the house relief convention — see the makeCrown header.
class LemniscateCurve extends THREE.Curve {
  constructor(a, yScale) { super(); this.a = a; this.yScale = yScale; }
  getPoint(t, target = new THREE.Vector3()) {
    // Lemniscate of Bernoulli: x = a·cosθ/(1+sin²θ), y = a·sinθcosθ/(1+sin²θ).
    const th = t * 2 * Math.PI;
    const s = Math.sin(th), c = Math.cos(th), d = 1 + s * s;
    return target.set((this.a * c) / d, (this.a * s * c * this.yScale) / d, 0);
  }
}
// §41 — the brand mark is a WS monogram (Watch Sim), replacing §27's ∞.
//
// SIGNATURE UNCHANGED. §27's acceptance required this be "parameterised and
// CALLED, not inlined, so a second part could reuse it". That held: makeCrown
// is the only call site, it passes { r, tubeR, material }, and it reads none
// of the returned userData. So this is a body swap with ZERO call-site edits,
// which is the test §41 was written to run. `aspect` and the tube-tessellation
// arguments are gone because they described a lemniscate; nothing passed them.
//
// STROKE WIDTH AND RELIEF, derived — not eyeballed. The house relief
// convention half-embeds the mark: centreline on the host surface, proud half
// standing off it. makeCrown budgets exactly `tubeR` of proud height for this
// mark (`g.userData.totalH = faceZ + tubeR`), so the relief is fixed by the
// caller and the only free choice is stroke WIDTH. Take it from the shape the
// ∞ already proved inside the envelope: its stroke was a round tube of radius
// tubeR, i.e. 2·tubeR wide standing tubeR proud. Keeping that ratio —
//
//     stroke width = 2 × proud height
//
// — means the relief is never a knife edge: at engraving scale a stroke
// narrower than twice its relief cannot be cut, and reads as a scratch rather
// than a mark. On the winding crown (bodyR 5.425) tubeR is 0.461 units, so the
// strokes are 0.922 u = 0.346 mm wide standing 0.173 mm proud (§39's
// UNIT_MM = 0.375). That is engraving scale and among the thinnest detail on
// the part, as §41 predicted; §40's census is the check on whether it is too
// fine.
//
// THE COUNTER. The S's counter — the gap its arcs enclose — is held at one
// full stroke width. Below that the two arcs read as a filled blob at crown
// size, which is the specific way a monogram fails.
//
// The crown ROTATES and WS is not symmetric, so it sits upside down for half
// of every turn. Accepted, per §41: real crowns carry brand marks and they
// spin. §27's ∞ read the same either way; this deliberately trades that for
// brand specificity.
export function makeBrandMark({ r, tubeR, material = MATS.steel, curveSegments = 10 }) {
  // FIT. The call site sizes its budget for the ∞, which was a wide, flat curve
  // using almost none of the vertical box. Two upright letters use ALL of it,
  // so filling the same budget crowds the cap rim and the quiet reveal
  // disappears. Both glyphs are therefore drawn inside a box scaled by FIT.
  //
  // Scaling r AND tubeR together, rather than the layout alone, is what keeps
  // this honest: stroke width stays 2 × proud height, and the counter-to-
  // stroke ratio the legibility assert tests is scale-invariant, so a smaller
  // mark cannot quietly become an illegible one. Standing less proud than the
  // caller budgeted is safe — makeCrown's totalH is a ceiling, not an equality.
  const FIT = 0.72;
  r = r * FIT; tubeR = tubeR * FIT;
  const sw = 2 * tubeR;              // stroke width, per the derivation above
  const depth = 2 * tubeR;           // half-embedded: extruded symmetrically about z = 0
  // Cap height. The ∞'s 0.52 aspect described its CENTRELINE; its ink stood one
  // tube radius proud of that at top and bottom, so the height it really
  // occupied was 2·r·0.52 + 2·tubeR. Taking the centreline figure gave the S
  // 0.92 units less room than the mark being replaced, and the counter assert
  // below caught it firing on both crowns. Match the ink, not the spine.
  const H = 2 * r * 0.52 + 2 * tubeR;
  // INK BUDGET. makeCrown sizes markR so the mark's ink edge plus one stroke
  // of quiet reveal lands on the cap's face rim: it assumes a half-width of
  // r + tubeR, exactly as the ∞'s tube gave. Both glyphs live inside that.
  const halfW = r + sw / 2;
  const gap = r * 0.10;                              // breathing space between the letters
  const wHalf = (halfW * 2 - gap) * 0.30;            // W is the wider glyph
  const sHalf = (halfW * 2 - gap) * 0.20;
  const wCx = -halfW + wHalf;                        // W packed left
  const sCx = halfW - sHalf;                         // S packed right
  const shapes = [];

  // --- W: four strokes, each stroked individually --------------------------
  // The first cut wrote the W as ONE closed outline, offsetting the inner
  // return in x only. That is not a constant-width stroke on a slanted limb —
  // the offset has to run along the segment's NORMAL — so the outline
  // self-intersected and triangulated into slivers: on screen the W was a few
  // stray edges. Stroking each segment separately and letting the quads
  // overlap at the joints is exact for the limb width and needs no mitre
  // solve; the overlaps are interior to opaque metal and never show.
  const midY = H * 0.34;                             // centre peak stops short of the cap line
  const X = (t) => wCx + t * wHalf;                  // t in [-1, 1] spans the glyph
  const spine = [[X(-1), H], [X(-0.5), 0], [X(0), midY], [X(0.5), 0], [X(1), H]];
  for (let i = 0; i < spine.length - 1; i++) {
    const [x0, y0] = spine[i], [x1, y1] = spine[i + 1];
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;                  // along the limb
    const nx = -uy * (sw / 2), ny = ux * (sw / 2);   // across it
    // Extend each end by half a stroke so consecutive quads close the vertex.
    const ex = ux * (sw / 2), ey = uy * (sw / 2);
    // WINDING. ExtrudeGeometry takes its face orientation from the outline's
    // winding, and this quad's winding flips with the limb's direction — the
    // W's down-going limbs came out inverted, so their faces pointed into the
    // crown and only the silhouette edges showed. absarc always emits CCW,
    // which is why the S was unaffected and the bug looked like a W-only
    // problem. Force CCW by signed area rather than by reasoning about which
    // limbs slope which way.
    let quad = [[x0 - ex + nx, y0 - ey + ny], [x1 + ex + nx, y1 + ey + ny],
                [x1 + ex - nx, y1 + ey - ny], [x0 - ex - nx, y0 - ey - ny]];
    const area2 = quad.reduce((acc, q, k) => {
      const w2 = quad[(k + 1) % 4];
      return acc + (q[0] * w2[1] - w2[0] * q[1]);
    }, 0);
    if (area2 < 0) quad = quad.slice().reverse();
    const sh = new THREE.Shape();
    sh.moveTo(quad[0][0], quad[0][1]);
    for (let k = 1; k < 4; k++) sh.lineTo(quad[k][0], quad[k][1]);
    sh.closePath();
    shapes.push(sh);
  }

  // --- S: two arcs with a counter -----------------------------------------
  // Each half is an ANNULAR SECTOR — outer arc out, inner arc back — exact
  // rather than a polyline approximation, and the stroke width IS the
  // difference of the two radii, so it cannot drift from the W's.
  //
  // sR is SOLVED, not chosen: two stacked bowls whose centres sit one stroke
  // half-height from each cap line must be 2·sR apart for the spine to run
  // continuously, which gives (H − sw) − 2·sR = 2·sR.
  const sR = Math.min((H - sw) / 4, sHalf - sw / 2);
  // §41's legibility floor: the counter is the hole each bowl encloses, and
  // below one stroke width the two arcs read as a filled blob at crown size.
  const counter = 2 * (sR - sw / 2);
  if (counter < sw)
    console.warn(`§41 monogram: S counter ${counter.toFixed(3)} < one stroke ${sw.toFixed(3)} — the bowls will fill in at crown scale`);
  const bowl = (cy, a0, a1, cw) => {
    const sh = new THREE.Shape();
    sh.absarc(sCx, cy, sR + sw / 2, a0, a1, cw);
    sh.absarc(sCx, cy, sR - sw / 2, a1, a0, !cw);
    sh.closePath();
    return sh;
  };
  // The two bowls must be TANGENT AT THE JOIN or the letter is just two arcs.
  // With centres 2·sR apart the upper circle's bottom (−90°) and the lower
  // circle's top (+90°) are the same point, so each arc has to START there and
  // sweep away. The first cut had them opening at unrelated angles and ending
  // 1.36·sR apart — on screen it read as a 3, not an S.
  //   upper: free end upper-right, CCW over the top and down the left to the join
  //   lower: from the join, clockwise round the right and down to the lower-left
  const cyTop = H - sR - sw / 2, cyBot = sR + sw / 2;
  const FREE = Math.PI * 0.25;                       // where each tail stops
  shapes.push(bowl(cyTop, FREE, Math.PI * 1.5, false));
  shapes.push(bowl(cyBot, Math.PI * 0.5, -Math.PI * 0.75, true));

  const geos = shapes.map((sh) => {
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments });
    g.translate(0, -H / 2, -depth / 2);   // centre the monogram on the face, half-embedded
    return g;
  });
  const merged = mergeGeos(geos);
  const mesh = new THREE.Mesh(merged, material);
  mesh.userData = { r, tubeR, height: H, strokeWidth: sw, proud: tubeR };
  return mesh;
}

// Minimal geometry merge — the three examples' BufferGeometryUtils is not
// vendored, and the monogram is the only caller. Non-indexed, position+normal
// only, which is all ExtrudeGeometry produces here.
function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of parts) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    const p = g.getAttribute('position'), q = g.getAttribute('normal');
    pos.set(p.array.subarray(0, p.count * 3), o * 3);
    if (q) nrm.set(q.array.subarray(0, q.count * 3), o * 3);
    o += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  for (const g of parts) g.dispose();
  return out;
}

// Winding crown (§27) — traditional knurled barrel, brand-marked face.
// The knurl-era grip (a ring of ~60 fine bur-prism ridges plus a six-rod
// face rosette; see git history for burPrismGeo) read as prickly light-
// noise and cost ~69 draw calls. §27's first cut replaced the whole
// barrel with an hourglass lathe; the owner kept the TRADITIONAL shape
// instead — straight barrel, chamfered cap — with the knurling ENLARGED:
// fewer, larger, ROUND ridges (soft smooth-shaded scallops, not keels),
// and makeBrandMark's ∞ raised on the flat outer face, half-embedded per
// the house relief convention (centreline ON the host surface, so it
// reads as machined, not glued on). The mark needs no orientation
// choice: the crown spins when wound, so infinity and hourglass are the
// same mark a quarter-turn apart.
//
// Base sits at z = 0, the face points along +Z (per the builder
// convention; main.js tips it onto the stem).
//
// ENVELOPE BUDGET — the constraint the constants below derive from: the
// redesign must stay INSIDE the knurl-era proven swept envelope, radius
// ≤ bodyR + 0.112 (the old keels' proud height: ridge section 0.16,
// seated 0.3 sunk) and axial length ≤ bodyH + CAP_H + 0.16·bodyR (the
// retired rosette rods' proud radius) — because every standing
// clearance/penetration row in the inspector battery was proven against
// that envelope, so staying inside it cannot create a new contact
// anywhere in the pose space. Asserted at the bottom (boot is silent —
// a warn means the envelope regressed).
export function makeCrown({ bodyR = 3.1, bodyH = 2.6, material = MATS.steel }) {
  const g = new THREE.Group();
  const CAP_H = 0.55;            // chamfer band height — unchanged from the knurl era
  const R_BUDGET = bodyR + 0.112;            // knurl-era proven radial envelope
  const H_BUDGET = bodyH + CAP_H + bodyR * 0.16; // knurl-era proven axial envelope
  const faceZ = bodyH + CAP_H;   // face plane — where the knurl-era cap face sat,
                                 // so the stem-axis layout at both call sites is untouched
  const RADIAL_SEGS = 28; // barrel/cap silhouette sagitta at bodyR 5.4 ≈ 0.03 — invisible;
                          // trimmed from the old 48 to buy the knurl its triangles (budget below)

  const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyR, bodyR, bodyH, RADIAL_SEGS, 1), material);
  body.geometry.rotateX(Math.PI / 2); // cylinder axis Y → Z
  body.position.z = bodyH / 2;
  g.add(body);

  // Enlarged knurl: round rods along the barrel, smooth-shaded — broad
  // scallops where the old keels prickled. Count still derives from the
  // circumference at the knurl-era pitch/ridge ratio (3.5), so the duty
  // cycle — the classic coin-edge look — survives the size change and any
  // future bodyR change. KNURL_R is the one styled number ("larger", the
  // owner's brief), FLOORED by the tri budget: at 8-seg rods (32 tris
  // each) the 4.0 alarm knob must keep count ≤ 12 for its total to stay
  // under its knurl-era spend (945 tris) → pitch ≥ 2π·4/12 → KNURL_R ≥
  // 0.60. Crest sits EXACTLY on the proven envelope: seat = R_BUDGET −
  // KNURL_R, so the exposed dome is the 0.112 the old keels stood proud.
  const KNURL_R = 0.61;
  const rimN = Math.round((2 * Math.PI * bodyR) / (KNURL_R * 3.5));
  const knurlSeat = R_BUDGET - KNURL_R;
  const ridgeLen = bodyH * 0.9;
  const ridgeGeo = new THREE.CylinderGeometry(KNURL_R, KNURL_R, ridgeLen, 8, 1);
  ridgeGeo.rotateX(Math.PI / 2); // rod axis Y → Z (along the barrel)
  for (let i = 0; i < rimN; i++) {
    const a = (i / rimN) * 2 * Math.PI;
    const ridge = new THREE.Mesh(ridgeGeo, material);
    ridge.position.set(Math.cos(a) * knurlSeat, Math.sin(a) * knurlSeat, bodyH / 2);
    g.add(ridge);
  }

  // Chamfered cap closing the outer face (top radius < bottom radius) —
  // unchanged from the knurl era.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(bodyR - 0.35, bodyR, CAP_H, RADIAL_SEGS, 1), material);
  cap.geometry.rotateX(Math.PI / 2);
  cap.position.z = bodyH + CAP_H / 2;
  g.add(cap);

  // Face mark: stroke first, then the span it leaves room for. The stroke
  // is 0.085·bodyR — well under the 0.16·bodyR the axial envelope allows
  // for its proud half (asserted below) — and the mark's half-width is
  // whatever fits inside the cap's face rim (bodyR − 0.35) leaving one
  // stroke-width of quiet border reveal: markR + tubeR (ink edge) +
  // tubeR (reveal) = face rim.
  const tubeR = bodyR * 0.085;
  const markR = (bodyR - 0.35) - 2 * tubeR;
  const mark = makeBrandMark({ r: markR, tubeR, material });
  mark.position.z = faceZ; // half-embedded: centreline on the face plane
  g.add(mark);

  g.userData.r = knurlSeat + KNURL_R; // widest point: the knurl crests — ON the budget by construction
  g.userData.totalH = faceZ + tubeR;  // tallest point: face + the mark's proud half
  if (g.userData.r > R_BUDGET + 1e-9 || g.userData.totalH > H_BUDGET + 1e-9)
    console.warn(`makeCrown §27 envelope exceeded: r ${g.userData.r.toFixed(3)} (budget ${R_BUDGET.toFixed(3)}), totalH ${g.userData.totalH.toFixed(3)} (budget ${H_BUDGET.toFixed(3)})`);
  return g;
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
    // 150-degree arc riding near the well's edge (was 120 at 0.84): more
    // angular travel per hour = finer reading, and the face's centre opens
    // up for the figures.
    // One minor per HOUR (the 150-degree sweep gives each its 5 degrees),
    // slimmed to keep the comb fine; majors every 12 h as before.
    for (let h = 0; h <= 30; h += 1) {
      const major = h % 12 === 0;
      tickAt(180 - (h / 30) * 150, sr * 0.92, sr * (major ? 0.2 : 0.09), sr * (major ? 0.055 : 0.022)); // empty end anchored at 9 o'clock — the sweep sits asymmetric, 180 to 30
    }
    // AB / AUF painted ALONG the graduation arc, at the tick band's radius
    // (sr·0.76, mid-band), set clear of the end ticks (22° beyond the arc
    // ends, vs the old 16°) so the words read as bookends rather than
    // crowding the outermost indicators.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Tiny hour figures at the majors, inboard of the tick ends — Roman
    // where Rome allows (XII, XXIV); the empty end is 0, a numeral Rome
    // never had.
    ctx.font = `500 ${sr * 0.09}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    // Zero, for a numeral system that never had one — an INVENTED glyph
    // with real ancestry: medieval computus tables (Bede, ~725 AD) wrote N
    // for "nulla" (none) where Roman reckoning needed a zero; the vinculum
    // overbar is the Roman mark that says "this character is a NUMERAL,
    // not a letter". So: N-bar.
    {
      const aN = (180 * Math.PI) / 180, rN = sr * 0.64, fh = sr * 0.09;
      ctx.save();
      ctx.translate(scx + Math.cos(aN) * rN, scy - Math.sin(aN) * rN);
      ctx.rotate(Math.PI / 2 - aN);
      ctx.fillText('N', 0, 0);
      ctx.fillRect(-fh * 0.38, -fh * 0.70, fh * 0.76, fh * 0.05);
      ctx.restore();
    }
    arcLabel('XII', 120, sr * 0.64);
    arcLabel('XXIV', 60, sr * 0.64);
    ctx.font = `600 ${sr * 0.16}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    arcLabel('AB', 196, sr * 0.76);
    arcLabel('AUF', 16, sr * 0.76);
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
  } else if (kind === 'alarm') {
    // Alarm hour ring (§24): a light 12-hour scale the alarm pointer sets
    // against — majors at each hour, a longer/heavier mark at XII, minors at
    // the quarter-hour marks between (the friction-set disc is read to the
    // nearest of these). Math angle 90° = 12 o'clock at the top; hours run
    // clockwise, so hour h sits at 90° − h·30°.
    for (let q = 0; q < 48; q++) {                 // 48 quarter-hour marks over 12 h
      const onHour = q % 4 === 0;
      const h = q / 4;
      const noon = onHour && h === 0;
      const len = noon ? sr * 0.20 : onHour ? sr * 0.15 : sr * 0.07;
      const w = noon ? sr * 0.05 : onHour ? sr * 0.035 : sr * 0.018;
      tickAt(90 - (q / 48) * 360, sr * 0.92, len, w);
    }
    // The twelve Arabic hour figures, small, inboard of the tick band — a
    // clock face in miniature. Roman would crowd this little dial; the alarm
    // is a utility scale, so plain numerals read fastest.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${sr * 0.15}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    for (let h = 0; h < 12; h++) {
      const a = (90 - h * 30) * Math.PI / 180;
      const label = h === 0 ? 12 : h;
      ctx.fillText(String(label), scx + Math.cos(a) * sr * 0.66, scy - Math.sin(a) * sr * 0.66);
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
// centerBoreR: hole at the dial centre for the motion works' hand arbors —
// the hour-wheel TUBE (carrying the hour hand) and the cannon pinion inside
// it have to physically reach the front of the dial. Without it the hands
// were mounted in front of an unbroken disc with nothing passing through.
// The applied hour markers' radial band, as FACTORS of the dial radius.
// Exported because the HOUR HAND's length is derived from it (main.js): the
// hand is sized to the markers' inner edge, so the two cannot drift apart.
// They were previously a literal here and a hand-sampled "r ≈ 23.1" comment
// there — correct on the day it was measured, and exactly the arrangement
// that goes stale the first time the dial is re-proportioned.
export const DIAL_MARKER_OUTER_F = 0.795; // markers hug the railroad track
export const DIAL_MARKER_H_F = 0.21;      // cap height (tall proportion)
export const DIAL_MARKER_INNER_F = DIAL_MARKER_OUTER_F - DIAL_MARKER_H_F; // = 0.585

export function makeDial({ radius, subdials = [], subdialRecess = 0.5, centerBoreR = 0 }) {
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
      // Enamelled/lacquered dial: a deep glossy clearcoat over the painted
      // face — low metalness (fired enamel is glass, not metal), tightened
      // base roughness, near-mirror coat.
      mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.35,
        clearcoat: 1.0,
        clearcoatRoughness: 0.07,
      });
    }
  }
  if (!mat) mat = MATS.silver;

  // Dial disc — with a circular hole cut through it at each sub-dial.
  let discGeo;
  if (subdials.length || centerBoreR > 0) {
    const discShape = new THREE.Shape();
    discShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    for (const sd of subdials) {
      const h = new THREE.Path();
      h.absarc(sd.x, sd.y, sd.r, 0, Math.PI * 2, true);
      discShape.holes.push(h);
    }
    if (centerBoreR > 0) {
      const bore = new THREE.Path();
      bore.absarc(0, 0, centerBoreR, 0, Math.PI * 2, true);
      discShape.holes.push(bore);
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
          // Same lacquered finish as the main dial face.
          floorMat = new THREE.MeshPhysicalMaterial({ map: ftex, roughness: 0.35, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.07 });
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
    const H = radius * DIAL_MARKER_H_F;   // cap height (tall proportion)
    const w = H * markerAesthetics.strokeWidthFactor;
    const D = Math.max(H * markerAesthetics.reliefDepthFactor, markerAesthetics.reliefDepthMin);
    const rc = radius * DIAL_MARKER_OUTER_F - H / 2; // markers hug the railroad track
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

// boreR / bossR / bossH: stacked-hand overrides (§25 C). A hand riding an
// OUTER tube of a co-axial stack needs its boss to be a bored COLLET — wide
// enough to seat on its own tube's annular face, bored so the inner tubes
// pass through, and short so it tucks under the hand above. Defaults preserve
// the classic solid boss bit-for-bit for every existing hand.
export function makeHand({ length, kind, boreR = 0, bossR: bossROverride = null, bossH: bossHOverride = null }) {
  const g = new THREE.Group();
  const handAesthetics = aesthetics.dial.hands;
  const config = handAesthetics[kind];

  const tail = length * config.tailFactor;
  const depth = Math.max(length * config.depthFactor, config.depthMin);
  let bossH = depth * 1.6;

  // Bur rod, shared by all three hands: a TRIANGULAR section, keel edge
  // down at the dial, whose top face is CONCAVE — a shallow flute dished
  // between the two top corners, the hollow a graver leaves when its face
  // is ground on the wheel. The corners catch twin edge-highlights and
  // the dish carries a moving inner gleam. The flute runs THROUGH the
  // point: the tip fan's apex sits at the DISH FLOOR's height, so the
  // hollow narrows and dives into the point instead of filling flat.
  // Concavity only removes material below the corner plane, so the
  // crossing envelope still matches the old cylinders — the 2.3
  // hour/minute plane gap in main.js still bounds rHour + rMinute
  // (≈ 2.10 at current widths).
  const facetFlat = (geo) => {
    // Extrude output is already non-indexed; toNonIndexed() would warn and
    // return the same geometry (which the dispose below would then free).
    const flat = geo.index ? geo.toNonIndexed() : geo;
    flat.computeVertexNormals();
    if (flat !== geo) geo.dispose();
    return flat;
  };
  const burRod = (rBase) => {
    const grp = new THREE.Group();
    const tipLen = rBase * 2.6; // curved taper: a little longer so the ease reads
    const shaftLen = tail + length - tipLen;
    const apothem = rBase * 0.5; // corner height of the top face
    const halfW = rBase * (Math.sqrt(3) / 2);
    const crown = rBase * (handAesthetics.fluteFactor ?? -0.3); // <0 dishes into a flute, >0 crowns (UI-adjustable)
    // Cross-section in (x = width, y = toward viewer): keel down, top an
    // arc bowing `crown` above the corners (quadratic midpoint = a+crown).
    const sec = new THREE.Shape();
    sec.moveTo(0, -rBase);
    sec.lineTo(halfW, apothem);
    sec.quadraticCurveTo(0, apothem + 2 * crown, -halfW, apothem);
    sec.closePath();
    const shaftGeo = new THREE.ExtrudeGeometry(sec, {
      depth: shaftLen, bevelEnabled: false, curveSegments: 12,
    });
    // extrusion axis → local +Y (hand length), section +y → local +Z (viewer)
    shaftGeo.rotateX(Math.PI / 2);
    shaftGeo.rotateZ(Math.PI);
    shaftGeo.translate(0, -tail, 0);
    const shaft = new THREE.Mesh(facetFlat(shaftGeo), MATS.bluedHand);
    // Tip: a LOFT scaled about the TOP-FACE PLANE (y = apothem), not the
    // axis — so the fluted upper surface runs dead STRAIGHT through to
    // the tip while the width and the keel sweep up to meet it (the
    // graver grind, again). The taper is near-linear; the roundness is
    // only a soft landing at the nose — a polish that takes the edge
    // off, not a dome.
    const raw = sec.getPoints(12);
    if (raw.length > 1 && raw[0].equals(raw[raw.length - 1])) raw.pop();
    const K = 9;                                  // taper rings
    const noseS = 0.1;                            // what survives at the nose
    const ease = (t) => Math.pow(1 - t, 0.85);    // near-straight sides, soft landing
    const ringAt = (k) => {
      const t = k / K;
      const s = noseS + (1 - noseS) * ease(t);
      return raw.map((p) => [p.x * s, apothem - (apothem - p.y) * s, t * tipLen]);
    };
    const tri = [];
    let prev = ringAt(0);
    for (let k = 1; k <= K; k++) {
      const cur = ringAt(k);
      for (let i = 0; i < raw.length; i++) {
        const j = (i + 1) % raw.length;
        tri.push(...prev[i], ...prev[j], ...cur[j]);
        tri.push(...prev[i], ...cur[j], ...cur[i]);
      }
      prev = cur;
    }
    let capY = 0;                                 // nose cap: barely proud, edge-broken
    for (const p of prev) capY += p[1];
    capY /= prev.length;
    for (let i = 0; i < raw.length; i++) {
      const j = (i + 1) % raw.length;
      tri.push(...prev[i], ...prev[j], 0, capY, tipLen + rBase * 0.03);
    }
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    tipGeo.computeVertexNormals();
    tipGeo.rotateX(Math.PI / 2);
    tipGeo.rotateZ(Math.PI);
    tipGeo.translate(0, length - tipLen, 0);
    const tip = new THREE.Mesh(tipGeo, MATS.bluedHand);
    grp.add(shaft, tip);
    return grp;
  };

  if (kind === 'hour' || kind === 'minute') {
    const rBase = length * config.widthFactor * 0.35;
    g.add(burRod(rBase));
    bossH = rBase * 2 * 1.3; // boss must swallow the rod's full diameter
  } else {
    // second: same bur rod, slimmer. Floor on the radius — originally 0.14 so
    // a sub-dial-length rod would not vanish, now DERIVED from §50's hand
    // floor instead (TODO 12): the keeled section is 1.5·rBase thick, so
    // rBase ≥ (0.10 mm + a hair) / UNIT_MM / 1.5 = 0.18 puts the blade at
    // 0.101 mm against real hands' 0.10–0.20. Sub-dial hands ride the floor;
    // the central seconds (length·widthFactor·0.5 ≈ 0.195) clears it on its
    // own and is untouched.
    const rBase = Math.max(length * config.widthFactor * 0.5, 0.18);
    g.add(burRod(rBase));
    // Counterweight tail disc.
    const cw = new THREE.Mesh(
      new THREE.CylinderGeometry(length * config.counterweightSizeFactor, length * config.counterweightSizeFactor, depth, 16),
      MATS.bluedHand
    );
    cw.rotateX(Math.PI / 2);
    cw.position.set(0, -tail * config.counterweightOffsetFactor, 0);
    g.add(cw);
  }

  const bossR = bossROverride ?? length * config.bossSizeFactor;
  if (bossHOverride !== null) bossH = bossHOverride;
  const boss = boreR > 0
    ? new THREE.Mesh(ringExtrude(bossR, boreR, bossH, 24), MATS.bluedHand) // bored collet (already axis-z)
    : (() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(bossR, bossR, bossH, 18), MATS.bluedHand); m.rotateX(Math.PI / 2); return m; })();
  g.add(boss);

  g.userData.length = length;
  g.userData.kind = kind;
  return g;
}
