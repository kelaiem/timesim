// src/geometry.js — horological geometry builders (Agent A).
// Every builder returns a THREE.Group (or Mesh) built lying in the XY plane,
// centered at the origin, rotating about local +Z. userData.r = pitch/functional
// radius where meaningful. Real tooth profiles via Shape/ExtrudeGeometry.
import * as THREE from 'three';
import { MATS } from './materials.js';
import { aesthetics } from './aesthetics.js';
import { STOCK_MIN_U, CLEAR_MARGIN, SLENDER_TARGET } from './layout.js'; // §50/TODO 12: build to the stock floor; §25 D's flat top clears the margin like everything else; §54's build-to proportion caps the fusee crest (TODO 40)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function pitchRadius(module, teeth) {
  return (module * teeth) / 2;
}

// ---------------------------------------------------------------------------
// §81 tranche A — THE EXACT WELD
//
// The big meshes here come from `ExtrudeGeometry`, from `toNonIndexed()` and
// from hand-written triangle soup, and all three emit NON-INDEXED geometry:
// every triangle carries its own three vertices, so a contour vertex is stored
// once per adjacent triangle. On the shipped tree that was 147 meshes holding
// 93.6% of the scene's vertices, and the inspector pays for the duplicates
// three separate ways: `bvhFor` builds its tree (and its side-effect index)
// over the raw position count, `sampledVerdict` tests EVERY vertex of both
// meshes in both directions, and §80's pose walk transforms every vertex at
// every distinct pose state. (three.js's own indexed primitives — Tube, Lathe,
// Cylinder, Torus — already share their vertices and are not the problem.)
//
// The weld deduplicates vertex SLOTS and emits an index. Three properties make
// it exact rather than an approximation, and they are the whole argument for
// needing no waiver anywhere downstream:
//
//   1. Two slots merge only when EVERY component of EVERY attribute is
//      bit-equal. Nothing moves. Tolerance welding is forbidden here — it
//      would shift positions, which can only UNDER-report a clearance, and
//      under-reporting is the error direction nothing downstream catches.
//   2. The triangle list is unchanged: same triangles, same winding, same
//      count, just referred to by index. No mesh opens, so the parity raycast
//      in `sampledVerdict` — which assumes a closed solid, and which TODO 27
//      caught being wrong about an opened chain — sees exactly what it saw.
//   3. As a SET, the sampled points are unchanged. `sampledVerdict` takes a
//      MIN over vertices and an OR over containment, and duplicates
//      contribute nothing to either; its edge midpoints come from the
//      triangle list, which (2) preserves. So its verdict is invariant, which
//      is why the battery's numbers can be — and are — required to be
//      identical across this change.
//
// Split normals survive by construction, because the key is the full
// attribute tuple: a crease's two normals are two different tuples at the same
// position and stay two vertices. That is what keeps `facetFlat` in makeHand
// flat-shaded, and it is why the key is not position-only.
//
// IT IS ALSO WHAT CAPS THE SAVING, and by a lot — measured, the pass takes the
// scene 729,594 → 591,481 vertices, where welding on POSITION alone would take
// the 458,897 vertices its 488 distinct geometries hold down to 124,998. The
// missing 72.8% is entirely split normals: `ExtrudeGeometry` calls
// `computeVertexNormals` on soup, which hands every triangle its own face
// normal, so two quads meeting along a contour edge share a position and
// disagree about the normal. They are not duplicates — they are the shading
// model — and merging them would smooth every crease in the movement. So the
// honest ceiling on a render-safe weld is well under 2x, which is a smaller
// number than the plan for this work assumed.
//
// It also retires a trap: "three-mesh-bvh crashes on non-indexed geometry —
// indexing is a side effect of bvhFor". A welded scene hands the BVH a real
// index instead of the identity one `ensureIndex` used to bolt on.
const _weldF32 = new Float32Array(1);
const _weldU32 = new Uint32Array(_weldF32.buffer);

// Returns a NEW indexed BufferGeometry — never mutates its input, and never
// returns it. Geometry OBJECT IDENTITY stands for geometry CONTENT throughout
// the inspector (`bvhFor` caches by it, MODELING rule 6 requires it), so a
// weld that edited in place would leave a stale BVH keyed to changed content.
// Returns the input unchanged only when it cannot weld it exactly: a
// non-Float32 or interleaved attribute would make the bit comparison either
// lossy or wrong, and a wrong merge is the one outcome with no safe direction.
export function weldGeometry(geo) {
  const attrs = Object.entries(geo.attributes);
  const pos = geo.getAttribute('position');
  if (!pos || !attrs.length) return geo;
  for (const [, a] of attrs)
    if (a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array)) return geo;

  const n = pos.count;
  // Open hashing over a 32-bit FNV-1a of the tuple's raw BITS, with an exact
  // component compare on every hash hit — the hash only chooses who to
  // compare, so a collision costs a comparison and can never cause a merge.
  const head = new Map();          // hash → head of that bucket's chain
  const chain = new Int32Array(n).fill(-1);  // new index → next new index in bucket
  const keep = new Uint32Array(n); // new index → the old slot it was taken from
  const remap = new Uint32Array(n);// old slot → new index
  let m = 0;
  const same = (i, j) => {
    for (const [, a] of attrs) {
      const s = a.itemSize, arr = a.array;
      for (let k = 0; k < s; k++) if (arr[i * s + k] !== arr[j * s + k]) return false;
    }
    return true;
  };
  for (let i = 0; i < n; i++) {
    let h = 0x811c9dc5;
    for (const [, a] of attrs) {
      const s = a.itemSize, arr = a.array;
      for (let k = 0; k < s; k++) {
        _weldF32[0] = arr[i * s + k];
        h = Math.imul(h ^ _weldU32[0], 0x01000193);
      }
    }
    let hit = -1;
    for (let c = head.has(h) ? head.get(h) : -1; c !== -1; c = chain[c])
      if (same(i, keep[c])) { hit = c; break; }
    if (hit === -1) {
      hit = m;
      keep[m] = i;
      chain[m] = head.has(h) ? head.get(h) : -1;
      head.set(h, m);
      m++;
    }
    remap[i] = hit;
  }

  const out = new THREE.BufferGeometry();
  for (const [name, a] of attrs) {
    const s = a.itemSize, src = a.array, dst = new Float32Array(m * s);
    for (let v = 0; v < m; v++) {
      const o = keep[v] * s;
      for (let k = 0; k < s; k++) dst[v * s + k] = src[o + k];
    }
    out.setAttribute(name, new THREE.BufferAttribute(dst, s, a.normalized));
  }
  const src = geo.index;
  const count = src ? src.count : n;
  // Uint16 while it fits — half the index buffer, and the BVH reads either.
  const idx = m > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  for (let t = 0; t < count; t++) idx[t] = remap[src ? src.getX(t) : t];
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const g of geo.groups) out.addGroup(g.start, g.count, g.materialIndex);
  // CARRY THE TYPE TAG, and the reason is a measured one rather than a tidy
  // one. `meshLabel` in inspect.js names an unnamed mesh `${geometry.type}#${i}`,
  // and two hand-written tables are string-coupled to those labels —
  // INTRA_UNIT_CONTACTS above all. A welded ExtrudeGeometry is a plain
  // BufferGeometry, so without this line every `ExtrudeGeometry#N` declaration
  // stops matching and its declared joint reports as a fresh violation:
  // measured, 14 of them, with not one distance changed. That was this
  // change's only difference against the pre-weld report, which is worth
  // recording — the weld was geometrically exact on the first run and still
  // moved a gate, through a NAME.
  //
  // So `type` here is PROVENANCE — which builder cut this surface — not a
  // constructor name. Nothing reads it as an instance test (checked: the two
  // readers in the tree both build labels), and provenance is exactly what the
  // weld does not change.
  out.type = geo.type;
  return out;
}

// Weld every mesh under `root`, in place on the scene graph: each mesh's
// geometry is REPLACED by its welded copy and the original disposed. Returns
// the census, which is what the boot assert and the acceptance both read.
//
// This is a traversal rather than a hook inside the builders because there is
// no chokepoint to hook — 315 `new THREE.Mesh(...)` sites across two files,
// no factory. The cost of that is stated plainly: a traversal only sees
// geometry that is IN the graph when it runs, so anything built later or held
// in a pool must weld itself. `weldAssert` below is what stops that from
// being a silent gap.
// It welds only what arrives NON-INDEXED, which is both the whole census this
// entry is about (147 meshes holding 93.6% of the scene's vertices) and the
// rule that keeps the pass out of trouble. three.js's own indexed primitives
// — Tube, Lathe, Cylinder, Torus — already share their vertices, and two of
// them are held in POOLS the traversal cannot see all of: the mainspring's and
// the hairspring's wind frames are a run of geometry objects with one member
// installed at a time. Replacing the installed member would weld one frame of
// a pool and leave the rest, so the pass leaves indexed geometry alone and
// nothing has to know about frame pools at all.
//
// Geometries SHARED by several meshes are welded once and shared again: two
// trees where there was one would give `bvhFor` two entries to build and hold
// for a part that is one part, which is the opposite of the point.
export function weldTree(root) {
  const done = new Map();
  let meshes = 0, before = 0, after = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const old = o.geometry;
    meshes++;
    before += old.attributes.position.count;
    if (old.index) { after += old.attributes.position.count; return; }
    let welded = done.get(old);
    if (!welded) { welded = weldGeometry(old); done.set(old, welded); }
    if (welded !== old) o.geometry = welded;
    after += welded.attributes.position.count;
  });
  for (const [old, welded] of done) if (welded !== old) old.dispose();
  return { meshes, before, after };
}

// Standing rule 6, for the weld: a mesh reaching the scene non-indexed is a
// builder that ran after (or around) the pass, and it costs every
// vertex-walking instrument silently. Names the worst offender so the warning
// points at the builder rather than at the traversal.
export function weldAssert(root) {
  let worst = null, count = 0, verts = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    if (o.geometry.index) return;
    const v = o.geometry.attributes.position.count;
    count++; verts += v;
    if (!worst || v > worst.v) worst = { name: o.name || o.parent?.name || '(unnamed)', v };
  });
  if (count)
    console.warn(`weld: ${count} mesh(es) reached the scene non-indexed, holding ${verts} vertices `
      + `(worst: ${worst.name} at ${worst.v}) — every vertex-walking check pays for the duplicates`);
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
// The smallest tooth count that is still a WHEEL at this module and bore.
// DERIVED from makeGear's own radii, so the guard and the builder cannot
// drift: rootR = module·(teeth/2 − 1.15) has to clear the bore, or the
// "gear" is a ring of air with its teeth hanging off nothing.
//
// The floor also has a hard lower leg at 3, and that one is not aesthetic:
// below it `gearOutlineShape` emits no curves at all, and `Shape.closePath()`
// then reads `curves[curves.length - 1].getPoint` off undefined — a
// TypeError during module evaluation, which kills the whole build. A boot
// that does not happen has no `__clock`, so every instrument in the battery
// is unreachable and nothing can say WHY (TODO 30's failure class, TODO 35's
// instance of it).
export function minGearTeeth(module, boreR = 1) {
  return Math.max(3, Math.ceil(2 * (boreR / module + 1.15)));
}
export function makeGear({ module, teeth, thickness, boreR = 1, spokes = 5,
                           material, hub = true, bevel: bevelOn = true }) {
  const mat = material || MATS.brass;
  // THE TRAP DISARMED AT THE SOURCE (§81's weldAssert precedent). A caller
  // that computes its tooth count — and since §74 Tier B the alarm winding
  // idler does — can hand this builder a count that is not a gear. Warned
  // with the achieved and required numbers per rule 6, then CLAMPED so the
  // build survives to report it: a loud wrong wheel is inspectable, a
  // TypeError is not. Callers should not rely on the clamp; it is the
  // backstop, and the derivation is where the floor belongs.
  const floor = minGearTeeth(module, boreR);
  if (!Number.isFinite(teeth) || teeth < floor) {
    console.warn(`makeGear: ${teeth} teeth is not a wheel at module ${module}, bore ${boreR} `
      + `— need ≥ ${floor} (root radius must clear the bore); clamped to ${floor}`);
    teeth = floor;
  }
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
  // TODO 11 tranche five — THE HUB'S WALL IS STOCK. `boreR * 1.6` is a
  // proportion, and a proportion of a small bore is a thin ring: at the
  // boreR 0.5 the alarm winding idlers, the motion-works minute wheel and
  // both power-reserve wheels are cut with, the wall came out 0.30 u
  // (0.1137 mm) — under §50's floor, and reported as such by five census
  // rows across two debts. The proportion stays (it is what makes a hub look
  // pared rather than sized), with the floor under it as the third term: a
  // ring around a bore is a member, so its WALL answers to STOCK_MIN_U, not
  // to whatever fraction of the bore it happened to be.
  const hubR = hub ? Math.max(boreR * 1.6, boreR + STOCK_MIN_U, pitchR * 0.085) : boreR * 1.6;
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
  const CURVE_SEGS = 3;   // the tessellation of the quadratics above — shared with the §83 outline below
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: CURVE_SEGS,
  });
  geo.translate(0, 0, -thickness / 2);
  g.add(new THREE.Mesh(geo, mat));
  g.add(new THREE.Mesh(ringExtrude(hubR, boreR, thickness * 1.3, 20), mat));
  g.userData.r = radius;
  // §83 — THE BOUNDARY OF THE CUT, exported so the schematic can draw the
  // TEETH. The tier's generic rotor glyph is a pitch circle plus a spoke, which
  // for this wheel lands a plain circle exactly on the tooth tips and states
  // "a rotor of radius `radius`" — true, and the least interesting true thing
  // about the one wheel in the train whose entire content is its profile: the
  // club heel, the slanted impulse face, the undercut locking hook and the
  // scallop between them are what the pallet stones are cut against (§16), and
  // the escapement is the mechanism a viewer opens the schematic to watch.
  // This is `shape` itself at the extrude's own curveSegments, so the line and
  // the metal are one description; closePath() already carries the loop back to
  // its first point, so the polyline is closed as it stands. z is the wheel's
  // MID-PLANE (the translate above centres the extrude), which is where a
  // section line belongs — one line per wheel, not a face pair.
  g.userData.profile = {
    poly: shape.getPoints(CURVE_SEGS).map((p) => [p.x, p.y]),
    hubR, boreR,
  };
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
  const SCREW_N = 16;
  const screwR1 = thickness * 0.20, screwR2 = thickness * 0.24;
  const screwRC = rimO - (screwLen / 2 - SCREW_PROTRUSION); // tip lands at rimO + PROTRUSION
  const screwGeo = new THREE.CylinderGeometry(screwR1, screwR2, screwLen, 10);
  for (let i = 0; i < SCREW_N; i++) {
    const a = (i / SCREW_N) * Math.PI * 2;
    const sc = new THREE.Mesh(screwGeo, MATS.blueSteel);
    sc.rotation.z = a - Math.PI / 2; // cylinder Y-axis -> radial
    sc.position.set(Math.cos(a) * screwRC, Math.sin(a) * screwRC, 0);
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
  // TODO 25 tier one — the INERTIA-BEARING DIMENSIONS, published so the
  // oscillator arithmetic in main.js can weigh this wheel without restating
  // a single number the builder already knows (rule 1's single source). Units,
  // not SI: geometry.js stays unit-space and main.js converts through §39's
  // UNIT_MM. Harvesting these by traversing children would be the wrong
  // answer twice over — the §66 schematic tier appends Line proxies to this
  // very group, and a traversal cannot tell a rim from a roller.
  g.userData.rim = { rO: rimO, rI: rimI, h: thickness * 0.55 };            // brass annulus
  g.userData.arm = { x: rimI * 2, y: thickness * 0.5, z: thickness * 0.4 }; // steel bar across the middle (= 2 arms)
  g.userData.screws = { n: SCREW_N, rc: screwRC, len: screwLen, r1: screwR1, r2: screwR2 };
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
export function makeColumnWheel({ columns = 6, baseR = 1.5, baseH = 0.3, colH = 0.55, colInner = 0.95, boreR = 0.3, material, riderNoseR = 0.28 }) {
  const mat = material || MATS.blueSteel;
  const g = new THREE.Group();
  const base = new THREE.Mesh(ringExtrude(baseR, boreR, baseH, 48), mat);
  g.add(base);
  const pitch = (Math.PI * 2) / columns;
  // TODO 28 — DUTY AND FLANK ARE DERIVED NOW. Both were bare literals
  // (`0.5` and `0.18 * pitch`) with nothing behind them but the look of the
  // result: standing rule 1's exact failure case, and between them they made
  // each column 72% ramp — a flat top NARROWER than either flank, so the
  // "columns" read as triangular ridges rather than pillars with plateaus.
  //
  // DUTY is forced, not chosen. One actuation indexes the wheel HALF a pitch
  // (the caller's ALARM_COL_STEP), so the two stable states are half a pitch
  // apart. For a rider to sit centred on a column in one state and centred in
  // a gap in the other, column and gap must be equal — which is duty 0.5 and
  // can be nothing else while the index is half a pitch.
  const duty = 0.5;
  // FLANK is a CONSEQUENCE of the flat top, and the flat top is what a
  // rider's nose needs to rest on: half of it must clear the nose's own
  // radius plus the margin, measured as arc at the radius the noses ride.
  // The chamfer is then whatever is left of the column's half-arc. (At the
  // shipped numbers this lands within 0.12° of the old literal, which is why
  // the old one looked right — it was right, and undeclared.)
  const edge = (duty * pitch) / 2;                       // column half-arc
  const flatHalf = (riderNoseR + CLEAR_MARGIN) / baseR;   // arc → radians at the ridden radius
  const flank = edge - flatHalf;
  if (!(flank > 0))
    console.warn(`§25 D column wheel: a nose of r ${riderNoseR} needs ${(2 * flatHalf * 180 / Math.PI).toFixed(1)}° of flat, `
      + `more than the column's ${(2 * edge * 180 / Math.PI).toFixed(1)}° arc — no chamfer is left`);
  // TODO 20 — THE FLANK IS CUT, NOT NARRATED. The columns used to be
  // bevel-less angular-sector extrusions: vertical cliffs, while profileAt
  // below returned a trapezoid with a 10.8° ramp — a surface that existed
  // only in the function, so the beak's whole ride was against geometry
  // nothing had cut (the §29 raised-relief lesson, unlearned here). The
  // castellations are now ONE ring whose top surface is colH·profileAt(θ),
  // sampled finely enough that the flank is faithful (48 segments per pitch
  // ⇒ ~9 across each flank): the mesh and the law come from the same
  // function and cannot drift. Gaps are the absence of height, columns its
  // presence — visually the same castellations, with the chamfered
  // rise/fall a real column wheel's beak actually climbs.
  {
    const prof = (a) => {
      let rel = ((a % pitch) + pitch) % pitch;
      if (rel > pitch / 2) rel = pitch - rel;
      if (rel <= edge - flank) return 1;
      if (rel >= edge) return 0;
      return (edge - rel) / flank;
    };
    // TODO 28 — PILLARS, NOT A HEIGHT FIELD. TODO 20's invariant is kept
    // exactly: the top of every column still IS colH·profileAt(θ), one
    // function for the cut surface and the ridden law. What that fix left
    // behind was the SHAPE of the body carrying it — a single ring spanning
    // the whole circle, so across every GAP the inner wall, the outer wall
    // and the top surface were all still emitted, at zero height. Between
    // each pair of columns the part was a degenerate strip of zero area, and
    // the floor triangles had to be skipped there to stop them z-fighting the
    // base disc, which is the tell that was sitting in this comment all along.
    //
    // Each column is now its own closed solid spanning only its own arc.
    // Where there is no column there is no geometry, and a gap's floor is the
    // base disc's top face — which is what a real column wheel has. The two
    // ends of each pillar are where the chamfer meets the base: the top
    // surface and the floor converge there, so the body closes on that edge
    // and no end cap is needed (an emitted one would have zero area, which is
    // the very thing this change exists to remove).
    const SEG_PER_FLANK = 9;    // TODO 20's fidelity, expressed against the derived flank
    const M = Math.max(2, Math.round(SEG_PER_FLANK * (edge / flank)));  // samples per column half-arc
    const pos = [], idx = [];
    for (let c = 0; c < columns; c++) {
      const centre = c * pitch;
      const base0 = pos.length / 3;
      for (let i = 0; i <= 2 * M; i++) {
        const a = centre - edge + (i / (2 * M)) * 2 * edge;
        const ca = Math.cos(a), sa = Math.sin(a);
        const top = colH * prof(a);
        pos.push(ca * colInner, sa * colInner, 0);        // 0: inner floor
        pos.push(ca * baseR, sa * baseR, 0);              // 1: outer floor
        pos.push(ca * colInner, sa * colInner, top);      // 2: inner top
        pos.push(ca * baseR, sa * baseR, top);            // 3: outer top
      }
      // A pillar's two ends are knife edges — the chamfer runs down to meet
      // the base, so at the extreme ring the top vertices COINCIDE with the
      // floor ones and any quad spanning that ring contributes one zero-area
      // triangle. Those are exactly what this rebuild exists to remove, so
      // each triangle is emitted only if its three vertices are distinct
      // POSITIONS. The shape is unchanged; the degenerate slivers are not
      // drawn, and the body still closes because the surfaces genuinely meet
      // along that edge.
      const same = (u, v) => Math.abs(pos[u * 3] - pos[v * 3]) < 1e-9
        && Math.abs(pos[u * 3 + 1] - pos[v * 3 + 1]) < 1e-9
        && Math.abs(pos[u * 3 + 2] - pos[v * 3 + 2]) < 1e-9;
      // TODO 4 — AND THE ORIENTATION IS REVERSED, in ONE place. Each quad
      // below is written in the order that reads naturally along the sweep
      // (this ring → next ring, inner → outer), and that order winds every
      // face CLOCKWISE seen from outside the pillar: the top surface came out
      // with normal θ̂ × r̂ = −ẑ where a column's top must face +z, and all
      // four families were reversed alike. With the default `side:
      // FrontSide` the outward faces were culled, so the columns rendered as
      // holes with their far inner walls showing through — "missing surfaces
      // on the columns", the whole of it. Flipping here rather than
      // re-ordering eight quads is deliberate: one reversal is provably
      // uniform, eight orderings are eight chances to get one wrong.
      const tri = (x, y, z) => { if (!same(x, y) && !same(y, z) && !same(x, z)) idx.push(x, z, y); };
      for (let i = 0; i < 2 * M; i++) {
        const b = base0 + i * 4, n = base0 + (i + 1) * 4;
        tri(b + 2, n + 2, n + 3); tri(b + 2, n + 3, b + 3); // top surface, faces +z
        tri(b + 0, n + 0, n + 2); tri(b + 0, n + 2, b + 2); // inner wall, faces −r
        tri(b + 1, b + 3, n + 3); tri(b + 1, n + 3, n + 1); // outer wall, faces +r
        tri(b + 0, n + 1, n + 0); tri(b + 0, b + 1, n + 1); // floor, faces −z
      }
    }
    // Each pillar closes on its two knife edges, so the castellations are a
    // union of closed bodies and their signed volume is exactly the test:
    // positive for the CCW-seen-from-outside winding three.js treats as
    // front-facing. Cheap, closed-form, and it is the only thing standing
    // between this mesh and a silent regression — no check in the battery
    // reads winding at all, which is how the reversal above shipped.
    const signedVol = (() => {
      let v = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        v += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
            + pos[a + 1] * (pos[b + 2] * pos[c] - pos[b] * pos[c + 2])
            + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
      }
      return v;
    })();
    if (!(signedVol > 0))
      console.warn(`TODO 4 column wheel: the castellations are wound inside-out (signed volume ${signedVol.toFixed(3)} ≤ 0) — FrontSide culling hides the columns`);
    const colGeo = new THREE.BufferGeometry();
    colGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    colGeo.setIndex(idx);
    colGeo.computeVertexNormals();
    colGeo.translate(0, 0, baseH / 2);
    g.add(new THREE.Mesh(colGeo, mat));
  }
  // Lower RATCHET skirt — one saw tooth per STEP (2 per column): what the
  // case pusher's pawl indexes. Real column wheels are driven exactly here.
  {
    const teethN = columns * 2;
    const rr = baseR * 0.9, tip = baseR * 1.12;
    // SAW DIRECTION — mirrored in y (owner's call, and the measurement agrees).
    // As first cut, each tooth fell tip→root with rising angle, so its cliff
    // caught a pawl travelling +theta: the teeth were cut to be driven CCW
    // while the wheel indexes CW and the pusher's pawl (§43 postscript) drives
    // CW. Two of three agreed and the teeth were the odd one out. Negating y
    // reverses the saw so the cliff faces the pawl that actually pushes it,
    // and makes userData.ratchetDrive below true rather than aspirational.
    const shape = new THREE.Shape();
    for (let i = 0; i < teethN; i++) {
      const a0 = (i / teethN) * Math.PI * 2, a1 = ((i + 1) / teethN) * Math.PI * 2;
      if (i === 0) shape.moveTo(Math.cos(a0) * tip, -Math.sin(a0) * tip);
      else shape.lineTo(Math.cos(a0) * tip, -Math.sin(a0) * tip);
      shape.lineTo(Math.cos(a1) * rr, -Math.sin(a1) * rr); // saw flank
    }
    shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: STOCK_MIN_U, bevelEnabled: false, curveSegments: 2 }); // TODO 11 tail: the pusher's pawl indexes here — floor stock, growing downward where the call site's raised seat left a full margin
    geo.translate(0, 0, -baseH / 2 - STOCK_MIN_U);
    g.add(new THREE.Mesh(geo, mat));
    // §33 (pusher handle) — the saw's OUTLINE, exported the way profileAt
    // is: the caller derives the pawl's park by casting against this same
    // polygon, so the parked kiss cannot drift from the cut teeth (the
    // park used to be a measured-once constant, valid only at the one
    // azimuth it was measured at). Local frame, y-mirrored as built.
    const ratchetPoly = [];
    for (let i = 0; i < teethN; i++) {
      const a0 = (i / teethN) * Math.PI * 2, a1 = ((i + 1) / teethN) * Math.PI * 2;
      ratchetPoly.push({ x: Math.cos(a0) * tip, y: -Math.sin(a0) * tip });
      ratchetPoly.push({ x: Math.cos(a1) * rr, y: -Math.sin(a1) * rr });
    }
    g.userData.ratchetPoly = ratchetPoly;
  }
  g.userData.columns = columns;
  g.userData.colH = colH;
  // The saw teeth above run tip→root as the angle RISES, so their cliff faces
  // +theta and a pawl can only drive the wheel in −z. Exported so the caller's
  // pawl geometry can derive its side from the teeth instead of agreeing with
  // them by luck — it did not (§43 postscript).
  g.userData.ratchetDrive = -1;
  // Beak lift at wheel angle `a` (beak azimuth 0): 1 on a column, 0 in a gap,
  // linear on the flanks. Column i is centred at i·pitch.
  g.userData.profileAt = (a) => {
    let rel = ((a % pitch) + pitch) % pitch;             // distance past the nearest column centre
    if (rel > pitch / 2) rel = pitch - rel;              // fold to [0, pitch/2]
    if (rel <= edge - flank) return 1;
    if (rel >= edge) return 0;
    return (edge - rel) / flank;
  };
  // The derived profile's own numbers, exported so a caller (or a check) can
  // quote them rather than re-deriving them and drifting.
  g.userData.colDuty = duty;
  g.userData.colFlank = flank;
  g.userData.colFlatHalf = edge - flank;
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
// TODO 25 tier two — the spiral's DEVELOPED LENGTH as a pure function of its
// plan, exported so the RATE SOLVE can ask how long the spring will be before
// the spring exists. Length depends only on the coil plan (radii and turns),
// never on the ribbon's section, so there is no circularity: main.js solves
// the section from this length, then builds. Same sampling as the builder
// below — one formula, one answer, no drift between the solve and the metal.
export function hairspringSegs(coils) { return Math.max(coils * 48, 96); }
export function hairspringDevLen({ innerR, outerR, coils = 12 }) {
  const segs = hairspringSegs(coils), S0 = coils * Math.PI * 2;
  let len = 0, px = 0, py = 0;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = t * S0, r = innerR + t * (outerR - innerR);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) len += Math.hypot(x - px, y - py);
    px = x; py = y;
  }
  return len;
}

// §83 — ONE writer for the schematic's spiral line, shared by both morphing
// springs (this one and makeBarrel's ribbon). The line's position buffer is
// allocated from a frame's polyline and every frame of a given spring has the
// same point count — the sampling is a property of the plan, not of the wind
// state — so a swap is a rewrite in place: no reallocation, and no bounding
// sphere left describing the frame before. A spring with no line attached (a
// caller that draws nothing) is the silent no-op rather than a branch at each
// call site.
export function writeSpiralLine(line, pts) {
  if (!line || !pts) return;
  const pos = line.geometry.attributes.position;
  for (let j = 0; j < pts.length; j++) pos.setXYZ(j, pts[j][0], pts[j][1], 0);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

export function makeHairspring({ innerR, outerR, coils = 12, height,
                                 windFrames = 41, windMaxRad = 1.0, ribbonR: ribbonROverride = null }) {
  const g = new THREE.Group();
  // TODO 25 tier two: the section is SOLVED BY THE CALLER from the balance it
  // must beat with (main.js owns the physics, this file owns the metal). The
  // legibility rule below survives only as the fallback for callers that have
  // no rate to hit — test-geometry.html's part smoke test being the one.
  const ribbonR = ribbonROverride ?? Math.max(((outerR - innerR) / coils) * 0.12, 0.05);
  const segs = hairspringSegs(coils);
  const S0 = coils * Math.PI * 2; // unwound span; outer end angle ≡ S0

  // TODO 25 tier one: the DEVELOPED LENGTH of the as-built (θ = 0) spiral,
  // accumulated as the same polyline the tube is swept along rather than
  // re-integrated from the spiral's closed form — one sampling, one answer.
  // Captured at θ = 0 exactly: windFrames is ODD, so frame (windFrames−1)>>1
  // lands on −windMaxRad + 0.5·2·windMaxRad = 0 in exact arithmetic, and that
  // middle frame is the one `tube` is built with below. The wind frames each
  // bunch or spread the coils (±1.6% in length at ±1 rad); the REST frame is
  // the spring as cut, which is what a rate is computed from.
  let restDevLen = 0;
  // §83 — the frames' own POLYLINES, kept alongside the tubes. The schematic
  // draws this spring from `spiralFrames` (see writeSpiralLine below), and the
  // only honest source for "the shape it is wearing right now" is the very
  // sampling the tube for that frame was swept along. Pushed from inside
  // spiralGeo so the two can never be built from different sweeps; the frame
  // loop below is its only caller, which is what keeps index k aligned.
  const framePolys = [];
  const spiralGeo = (theta) => {
    const pts = [];
    let len = 0;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const a = theta + t * (S0 - theta); // inner (turned) → outer (fixed)
      const r = innerR + t * (outerR - innerR);
      const p = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
      if (i) len += p.distanceTo(pts[i - 1]);
      pts.push(p);
    }
    if (theta === 0) restDevLen = len;
    framePolys.push(pts.map((p) => [p.x, p.y]));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, ribbonR, 4, false);
  };
  const frames = [];
  for (let k = 0; k < windFrames; k++) {
    frames.push(spiralGeo(-windMaxRad + (k / (windFrames - 1)) * 2 * windMaxRad));
  }
  const REST_FRAME = (windFrames - 1) >> 1;   // θ = 0 exactly — see the restDevLen note above
  const tube = new THREE.Mesh(frames[REST_FRAME], MATS.blueSteel);
  tube.scale.z = Math.max(height / (ribbonR * 2), 1); // stand the ribbon on edge
  g.add(tube);
  let curFrame = REST_FRAME;
  g.userData.setWind = (theta) => {
    const t = Math.max(-windMaxRad, Math.min(windMaxRad, theta));
    const k = Math.round(((t + windMaxRad) / (2 * windMaxRad)) * (windFrames - 1));
    if (k === curFrame) return;
    curFrame = k;
    tube.geometry = frames[k];
    // §83: the drawn line rides the swap with the metal. The index is published
    // rather than only consumed, so a consumer that attaches AFTER boot still
    // draws the frame the spring is actually wearing.
    g.userData.spiralFrame = k;
    writeSpiralLine(g.userData.spiralLine, framePolys[k]);
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
  // §78 part two — THE SPIRAL'S PLAN, exported so the schematic can quote it.
  // The tier used to draw this group's userData.r as a pitch circle plus a
  // spoke, which states that the oscillator's restoring element is a ROTOR of
  // radius outerR. It is a flat spiral, and its content is the three numbers
  // below — the same three TODO 25's solve turns on. Exported in the
  // ArchimedeanSpiral parametrisation the tube above is swept along at θ = 0
  // (r linear in t, angle t·coils·2π), so one polyline serves the glyph and
  // the geometry cannot drift from it.
  g.userData.spiral = { innerR, outerR, coils };
  // §83 — ...and the WIND STATES, so the glyph BREATHES. §78 shipped this
  // spring's line as a static quote of the plan above and declared the residue
  // in writing: "the glyph is drawn at REST; the breathing swaps a precomputed
  // geometry frame rather than posing a group, so the proxy cannot ride it for
  // free." The mainspring closed exactly that residue in the same section by
  // publishing its frames and writing the line on each swap; this is the same
  // close for the oscillator, which is the one spring a viewer watches move.
  // The plan stays the REST spiral (the three numbers TODO 25's rate solve
  // turns on); `spiralFrames` is what the metal is actually wearing.
  g.userData.spiralFrames = framePolys;
  g.userData.spiralFrame = REST_FRAME;
  // TODO 25 tier one — the SECTION AS CUT, not as imagined. TubeGeometry with
  // radialSegments 4 cuts a RHOMBUS, not a rectangle: the 4-gon's diagonals
  // ride the Frenet frame's normal (radial — the bending direction) and
  // binormal (axial), so the half-diagonals are ribbonR and, after the
  // scale.z above stands the ribbon on edge, max(height/2, ribbonR) — the
  // floor mirrors scale.z's own Math.max, which is why this is not simply
  // height/2. Second moment about the axial diagonal: the width at radial
  // offset x is 2c(1 − |x|/a), so ∫x² dA = a³c/3 — a quarter of the
  // bounding rectangle's, and the honest number for a rate that goes as
  // section I. Units^4; main.js converts through §39's UNIT_MM.
  g.userData.devLen = restDevLen;
  g.userData.section = (() => {
    const a = ribbonR, c = Math.max(height / 2, ribbonR);
    return { shape: 'rhombus4', a, c, I_u4: (a ** 3) * c / 3 };
  })();
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
  click.name = 'barrelClickPawl'; // TODO 11 triage: an integral click is spring-tempered pawl stock — declared, not thickened
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

// grooveW / grooveD / bandZ0 / bandSpan (§61): the CUT groove the chain
// actually seats in, all in world units, derived by the caller from the
// chain's own stock (main.js) — no dimension here is free to disagree with
// the chain that rides it. rSmall/rLarge remain the ENVELOPE (land-crest)
// radii: with the groove cut exactly one plate half-width deep, the chain's
// centreline lies ON the envelope, so these stay the torque radii the
// S(t)·r_f(t) equalisation was solved against.
// envR (TODO 40 row 1): the land-crest envelope as a function of band
// fraction, supplied by the caller because the CURVE is the equalisation's,
// not this builder's — a straight generator cannot level a linear spring's
// product, so the shipped cone hands in r = K / S(t) and the flank comes out
// concave, as a real fusee's is. Omitted (test pages), the envelope falls
// back to the straight generator between the two end radii.
//
// reliefHalf (TODO 40 row 1, the cut): half the chain's axial stack. The
// chain is an axis-aligned box train — pin axes parallel to the arbor, as on
// the real thing — so each wrap's box spans ±reliefHalf in z around its
// groove point, and on a steep flank the box's LOWER half overhangs metal
// the radial-depth cut left standing: a radial cut only fits while
// |dr/dz| ≤ grooveD / reliefHalf (0.66/0.33 = 2.0 in the shipped stock —
// the 2.42 this first said was a slip of arithmetic), and the equalising
// 1/√ flank runs 10.44 at its base (TODO 32's law; the hyperbola it
// replaced ran 5.28 — the relief is slope-agnostic, so only these prose
// numbers moved). So the floor at height z is
// relieved to clear the box of the HIGHEST wrap covering z (the envelope
// falls with z, so that wrap is the binding one):
//
//   floorAt(z) = env(clamp((z − bandZ0 + reliefHalf) / bandSpan, 0, 1)) − grooveD
//
// — the envelope sheared down by half a stack, minus the same depth. At
// reliefHalf = 0 this is exactly the un-relieved law, which is why the
// legacy/test path needs no second branch. The ideal wrap box touches this
// floor along its bottom-inner corner and clears it everywhere else, which
// is what the §61 seating row now measures (userData.groove.floorAt below).
export function makeFusee({ rSmall, rLarge, height, grooveTurns = 5,
                            grooveW, grooveD, bandZ0, bandSpan, envR = null,
                            reliefHalf = 0 }) {
  const g = new THREE.Group();
  // Legacy proportions when the caller doesn't specify the cut (test pages).
  if (grooveD === undefined) grooveD = Math.min((rLarge - rSmall) * 0.1, 0.5);
  if (grooveW === undefined) grooveW = (0.88 * height) / grooveTurns * 0.8;
  if (bandZ0 === undefined) bandZ0 = height * 0.06;
  if (bandSpan === undefined) bandSpan = height * 0.88;
  const env = envR || ((f) => rLarge + (rSmall - rLarge) * f); // land-crest envelope
  // The relieved groove floor — ONE law for the seat, the band and the tip
  // runout (the clamp handles all three), shared with the §61 seating
  // instrument via userData.groove so the cut and the check cannot drift
  // apart: they hold the same closure.
  const floorAt = (z) =>
    env(Math.min(Math.max((z - bandZ0 + reliefHalf) / bandSpan, 0), 1)) - grooveD;
  // The core is lathed at NCORE stations; a straight generator is exact at
  // any count, a curved one is not, so the count is what decides how much of
  // the curve survives. Measured on the shipped 1/√ flank (TODO 32), worst
  // chord sag against the true profile:
  //   12 → 0.0394   24 → 0.0117   48 → 0.0048   96 → 0.0028
  // Below 48 the worst chord sits near the base, where the curve bends
  // hardest; from 48 up it moves to the relief clamp's kink near the band's
  // top (an O(h) corner no station count removes — the smooth-region sag at
  // 48 is 0.0032 and still falling as N²). 48 lands the whole table an order
  // of magnitude inside the 0.08 the §61 chain-seating budget works to, so
  // the facets cannot be what a seating row is measuring. The straight case
  // keeps 12: exact is exact.
  const NCORE = envR ? 48 : 12;
  // GROOVED core (§61). The old build ran a smooth core at the envelope with
  // a proud wire ridge whose "channel between adjacent flange turns,
  // comfortably wider than the chain's diameter" was false arithmetic —
  // the channel measured ~0.19 against a 0.66 chain stack, and the chain's
  // inner half was buried in the core besides. What a real fusee has is a
  // helical groove CUT into the cone: here the core is lathed at the GROOVE
  // FLOOR (envelope − grooveD), and the land between adjacent wraps is a
  // helical crest ribbon standing grooveD back up to the envelope. The
  // chain's inner edge rides the floor; the wrap stands proud of the land
  // by its outer half, as on the real thing.
  const pts = [];
  // Base seat: kept INSIDE the bottom wrap's inner edge — the old 1.12·rLarge
  // disc passed straight through the chain's lowest turn once the chain was
  // drawn at true scale (its underside overhangs the base plane; the
  // maintaining sandwich below is derived off exactly that overhang).
  // floorAt(0), not rLarge − grooveD: the bottom wrap's box reaches
  // reliefHalf below its groove point, so the seat plane z = 0 is already
  // inside that box's span and owes it the same relief as the band.
  const seatR = floorAt(0) - 0.02;
  pts.push(new THREE.Vector2(seatR, 0));
  for (let i = 0; i <= NCORE; i++) {
    const z = bandZ0 + bandSpan * (i / NCORE);
    pts.push(new THREE.Vector2(floorAt(z), z));
  }
  pts.push(new THREE.Vector2(floorAt(height - 0.02), height - 0.02));
  pts.push(new THREE.Vector2(rSmall * 0.45, height));
  // LatheGeometry revolves about +Y; every arbor here spins about +Z, so
  // stand the cone up (profile height axis Y → Z).
  const geo = new THREE.LatheGeometry(pts, 48);
  geo.rotateX(Math.PI / 2);
  const cone = new THREE.Mesh(geo, MATS.brass);
  g.add(cone);

  // The LAND: a helical crest ribbon between adjacent groove turns — the
  // uncut material of the cut-groove model. Its centreline runs half a
  // groove pitch above the groove helix; radially it spans floor → envelope.
  // Cross-section: landW wide (what the pitch leaves over after the groove),
  // grooveD tall. Built as an indexed quad strip: inner/outer rails at the
  // two axial faces, outer face closing the crest.
  const pitch = bandSpan / grooveTurns;
  const landW = Math.max(pitch - grooveW, 0.02);
  // The crest exists BETWEEN wraps: grooveTurns grooves have grooveTurns−1
  // lands, so the helix stops half a pitch short of the band's top — a
  // full-length run poked 0.2 past the cone's tip and it was the plate
  // floor's boot assert that caught it.
  const SEG = (grooveTurns - 1) * 48;
  const pos = [], idx = [];
  // 4 rails per station: (floor,lo) (env,lo) (env,hi) (floor,hi)
  for (let i = 0; i <= SEG; i++) {
    const t = i / (grooveTurns * 48);
    const a = t * grooveTurns * Math.PI * 2;
    const zc = bandZ0 + bandSpan * t + pitch / 2;         // land centreline
    // Envelope evaluated at the land's OWN z, not the groove's t below it —
    // half a pitch up a cone this steep is ~0.6 of radius, and sampling the
    // lower station left the crest that far proud on the uphill side.
    const fLand = t + (pitch / 2) / bandSpan;
    // Inner rail on the RELIEVED floor; outer rail at the envelope, capped by
    // §54's build-to proportion (SLENDER_TARGET · width — layout.js, the same
    // number the slenderness check enforces). Un-relieved, full height is
    // grooveD and the cap never binds (0.66 < 27·0.025). Relieved, the crest
    // at the steep base would be grooveD + relief ≈ 1.6 over a 0.024 width —
    // λ ≈ 65 against §54's 30 (TODO 32's flank bends harder at the base than
    // the hyperbola this first shipped against) — so it honestly stops short of the envelope
    // there: on that stretch the chain is retained by the step of the turn
    // below (the un-relieved metal between wraps) and by its own departing
    // tangent, which is what the base of a real steep-flanked fusee looks
    // like. A fin nobody could cut is not a land.
    const rIn = floorAt(zc);
    const rOut = Math.min(env(fLand), rIn + SLENDER_TARGET * landW);
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const [r, dz] of [[rIn, -landW / 2], [rOut, -landW / 2], [rOut, landW / 2], [rIn, landW / 2]])
      pos.push(ca * r, sa * r, zc + dz);
  }
  for (let i = 0; i < SEG; i++) {
    const b = i * 4, c = b + 4;
    for (const k of [0, 1, 2]) idx.push(b + k, c + k, c + k + 1, b + k, c + k + 1, b + k + 1);
  }
  const landGeo = new THREE.BufferGeometry();
  landGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  landGeo.setIndex(idx);
  landGeo.computeVertexNormals();
  g.add(new THREE.Mesh(landGeo, MATS.brass));

  g.userData.rSmall = rSmall;
  g.userData.rLarge = rLarge;
  g.userData.height = height;
  g.userData.grooveTurns = grooveTurns;
  // §61 — the cut, exported for the chain-seating instrument. Since TODO 40
  // the export carries floorAt ITSELF — the closure the lathe just consumed —
  // so "the check measures the same analytic floor this geometry was built
  // from" is true by identity rather than by a re-derivation kept in step.
  // (The first hyperbolic cut proved the distinction: the check went on
  // reconstructing a straight chord from rLarge/rSmall and measured against
  // a floor ~1.3 outside the metal at mid-band.)
  g.userData.groove = { bandZ0, bandSpan, grooveD, grooveW, floorAt };
  return g;
}

// ---------------------------------------------------------------------------
// THE MAINSPRING AS A WIND MORPH — TODO 1's remaining half.
//
// A mainspring has TWO fixed ends: the inner one hooked to the barrel arbor
// (static here — the set-up ratchet holds it, which is the half TODO 1 closed
// first) and the outer one to the drum wall, which turns. So winding is a
// change of GEOMETRY, exactly as makeHairspring's is: the same length of steel
// redistributed across a different number of turns between the same two radii.
// It is not a rigid rotation and it is not a scale, which is what the drum's
// spiral used to be — hence "a readout of tension", not a spring.
//
// THE FAMILY. Let A be the total angle the ribbon sweeps from its inner end to
// its outer end. Turning the drum by dθ changes A by −dθ and nothing else: both
// end RADII are pinned, so the only freedom left is how radius is distributed
// along the sweep. Two constraints fix it, and neither is a taste:
//
//   r(a) = innerR + (p/2π)·a + S·(a/A)^k          a ∈ [0, A]
//
//   · p = 2·ribbonR is COIL BIND — the ribbon's own radial thickness, the
//     closest two turns can lie without merging. The affine term carries it
//     everywhere, so NO wind state can draw the coils through each other, and
//     the leftover S = (outerR − innerR) − p·A/2π is the spring's CAPACITY:
//     S > 0 says the annulus can still hold this many turns at bind, and it is
//     the quantity that decides whether a reserve fits in a drum at all.
//   · k is SOLVED per frame (bisection; length falls monotonically with k) so
//     every frame's DEVELOPED LENGTH equals the free ribbon's. Steel does not
//     grow. k > 1 packs the turns onto the arbor and leaves one long sweep out
//     to the wall — a wound spring; k < 1 would bunch them against the wall.
//     k = 1 is the plain Archimedean spiral, so the FREE state (`coils` turns
//     of even pitch — the ribbon as coiled) is a member of the family rather
//     than a special case, and the geometry at zero wind is unchanged.
//
// HANDEDNESS IS DERIVED, not chosen. The drum's rotation.z RISES as the reserve
// falls, so the ribbon must LOSE sweep as the drum turns +z: the spiral runs
// clockwise outward (angle(t) = A·(1 − t), outer end at drum-local 0). Wind the
// other way and the spring would gain turns while it drove — the sense error
// that stayed invisible for as long as the whole spiral rotated rigidly.
//
// WHY KEYFRAMES rather than one geometry morphed in place: the inspector caches
// a BVH per BufferGeometry, so rewriting a geometry's positions between poses
// would leave every sweep measuring the boot pose's surfaces. Distinct geometry
// objects are what that cache keys on — the same reason makeHairspring
// precomputes, arrived at from the other end.
// ---------------------------------------------------------------------------
// setup (TODO 32): pre-tension wound in at the bench and held by the set-up
// ratchet for the life of the watch — the SERVICE band therefore spans
// [A_free + setup, A_free + setup + sweep], and that is the band the frames
// cover. The free coil (A_free, k = 1) stays the LENGTH REFERENCE — it is
// the ribbon as cut, and devLen must be measured where the distribution law
// is exactly Archimedean (the open-quadrature note below is why) — but it is
// no longer a frame: no service state ever shows it. Default 0 keeps the
// alarm barrel (§89) exactly as it was.
export function mainspringFrames({ innerR, outerR, coils, ribbonR, sweep, setup = 0 }) {
  const pBind = ribbonR * 2;              // coil bind — see above
  const P = pBind / (Math.PI * 2);        // ...as radius gained per radian
  const A_free = coils * Math.PI * 2;     // the ribbon as coiled: even pitch, k = 1
  const A_down = A_free + setup;          // run down IN SERVICE: the set-up still holds
  const A_full = A_down + sweep;          // fully wound: the drum has taken `sweep` more off the static arbor
  const slack = (A) => (outerR - innerR) - P * A;   // S — what is left over for the distribution
  const radiusAt = (A, k, S, a) => innerR + P * a + S * Math.pow(a / A, k);

  // LENGTH, from the integrand rather than from a chord sum: ∫₀^A √(r² + r′²).
  // Composite 2-point Gauss-Legendre, which is both accurate (converged to 1e-9
  // by 128 panels, where a chord sum still wants 20 000 samples) and, more
  // importantly, OPEN — it never evaluates a = 0.
  //
  // That is not an optimisation, it is a correctness requirement. r′(0) is
  // discontinuous in k across k = 1: at k = 1 exactly the distribution term
  // contributes S/A there, and for any k > 1 it contributes nothing (0^ε = 0).
  // A closed rule samples that point, so the FREE frame's length picks up an
  // endpoint bump every wound frame lacks — measured, 5.5e-4 of phantom
  // difference, in a quantity whose whole job is to be identical. The
  // discontinuity is one point of a curve and means nothing physically; a
  // quadrature that cannot see it is the honest instrument.
  //
  // One rule for the solve, the reference and the assert, so "every frame is
  // the same length" is one measurement compared with itself. (Comparing two
  // different measures was this function's first bug: 0.09% of apparent
  // stretch that was entirely the gap between a t-uniform integral and an
  // arc-length-resampled chord sum.)
  const QN = 128, GX = 1 / Math.sqrt(3);
  const arcLen = (A, k) => {
    const S = slack(A), h = A / QN;
    const f = (a) => Math.hypot(radiusAt(A, k, S, a), P + (S * k * Math.pow(a / A, k - 1)) / A);
    let s = 0;
    for (let i = 0; i < QN; i++) {
      const c = (i + 0.5) * h, e = (h / 2) * GX;
      s += f(c - e) + f(c + e);
    }
    return s * (h / 2);
  };
  const DENSE = 2000;                     // sampling the frame that is actually cut
  const walk = (A, k, n) => {
    const S = slack(A);
    const pts = new Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const a = (A * i) / n;
      const r = radiusAt(A, k, S, a);
      const ang = A - a;                  // clockwise outward — the handedness note above
      pts[i] = [Math.cos(ang) * r, Math.sin(ang) * r];
    }
    return pts;
  };
  const devLen = arcLen(A_free, 1);
  const solveK = (A) => {
    let lo = 0.02, hi = 60;               // brackets the whole family; L(k) is monotone falling
    for (let i = 0; i < 44; i++) {
      const m = (lo + hi) / 2;
      if (arcLen(A, m) > devLen) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  };
  // SEGMENTATION is a property of the metal, not of the wind state: the
  // polyline is resampled at equal ARC LENGTH, and its chord may sag at most a
  // tenth of the bind gap into it at the tightest radius the ribbon ever takes
  // (the inner coil). sagitta ≈ chord²/8r, so chord = √(8·s·r).
  const SAG_FRAC = 0.1;
  const segs = Math.max(Math.ceil(devLen / Math.sqrt(8 * SAG_FRAC * pBind * innerR)), coils * 48);
  const frameAt = (A) => {
    const k = solveK(A);
    const pts = walk(A, k, DENSE);
    const cum = [0];
    for (let i = 1; i <= DENSE; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[DENSE];
    const out = new Array(segs + 1);
    for (let i = 0, j = 0; i <= segs; i++) {
      const s = (L * i) / segs;
      while (j < DENSE - 1 && cum[j + 1] < s) j++;
      const f = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
      out[i] = [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
    }
    let cut = 0;
    for (let i = 1; i <= segs; i++) cut += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]);
    return { pts: out, k, curveLen: arcLen(A, k), cutLen: cut };
  };
  // FRAME COUNT, derived from the same ribbon: no point of the spiral may move
  // further than the ribbon's own thickness between adjacent frames — a step
  // that jumps a coil past itself is a step the eye reads as a jump. The
  // sensitivity |dP/dA| is MEASURED (it peaks mid-radius, not at the inner end
  // where the analytic guess put it — 2.12 against 1.63 as built), sampled at
  // both extremes and the middle, and the achieved step is asserted below.
  const h = sweep / 512;
  const sens = (A) => {
    const a = frameAt(A - h).pts, b = frameAt(A + h).pts;
    let m = 0;
    for (let i = 0; i <= segs; i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
    return m / (2 * h);
  };
  const dPdA = Math.max(sens(A_down + h), sens((A_down + A_full) / 2), sens(A_full - h));
  const nFrames = Math.max(Math.ceil((sweep * dPdA) / pBind) + 1, 3);

  const frames = [], cutLens = [];
  let maxStep = 0, minPitch = Infinity, lenErr = 0;
  for (let i = 0; i < nFrames; i++) {
    const A = A_full - (sweep * i) / (nFrames - 1);   // frame 0 = fully wound; frame last = A_down (service run-down)
    const f = frameAt(A);
    if (i) for (let j = 0; j <= segs; j++) {
      const q = frames[i - 1];
      maxStep = Math.max(maxStep, Math.hypot(f.pts[j][0] - q[j][0], f.pts[j][1] - q[j][1]));
    }
    lenErr = Math.max(lenErr, Math.abs(f.curveLen - devLen) / devLen);
    cutLens.push(f.cutLen);
    // radial gap between turn n and turn n+1, measured on the built law
    const S = slack(A);
    for (let a = 0; a + Math.PI * 2 <= A; a += A / 256)
      minPitch = Math.min(minPitch, radiusAt(A, f.k, S, a + Math.PI * 2) - radiusAt(A, f.k, S, a));
    frames.push(f.pts);
  }
  return {
    frames, segs, devLen, sweepFree: A_free, sweepDown: A_down, sweepFull: A_full,
    setupSweep: setup,
    capacity: slack(A_full),
    pBind, maxStep, minPitch, lenErr, dPdA,
    // The CUT ribbon is an inscribed chord run, so it is always a little
    // shorter than the curve it follows, by an amount that rides the local
    // curvature and therefore varies with the wind. The curve length above is
    // the constraint; this is the tessellation's residue on it, and the bound
    // it is held to is the ribbon's own thickness — no wind state's metal may
    // be a ribbon thicker or thinner than another's.
    cutSpread: Math.max(...cutLens) - Math.min(...cutLens),
  };
}

// ---------------------------------------------------------------------------
// Going barrel — drum + toothed great-wheel rim, mainspring, ratchet + click.
// With `plain: true` it becomes a fusee-style spring DRUM: smooth wall, no
// gear teeth, no ratchet/click (the fusee arbor carries those instead).
// ---------------------------------------------------------------------------

// THE ARBOR'S RADIUS, as a proportion of the body. Exported because a barrel
// that runs on a FIXED arbor needs the number BEFORE the body exists — the
// bore the body turns on is an argument to the builder below — and a
// proportion that lives in two places is a proportion that will disagree with
// itself.
export const barrelArborR = (radius) => radius * 0.09;

// arborH: full length of the central arbor (centred on the body's
// mid-plane) — the caller sizes it to reach its actual bearings; the
// default reproduces the old fixed proportion.
// arbor: the going/fusee form carries its arbor INSIDE the body, so the two
// turn together. Pass `arbor: false` when the barrel runs on an arbor the
// caller plants in the FRAME (the alarm barrel, §89): a static member cannot
// live in a rotating group, so the builder leaves that metal to the caller and
// bores the body for it instead.
// arborBoreR: the bore the body turns on — floor and lid are opened to it,
// and it is REQUIRED with `arbor: false` (a body with no arbor and no bore is
// a body sitting on the metal it is supposed to run on). The caller owns the
// number because the fit is a BEARING (its running clearance), not a
// proportion of the drum.
// ratchet: the going-barrel form carries a ratchet + click on its lid by
// default. Pass `ratchet: false` when the caller has not built the winding
// path yet — a click riding round with the barrel it is supposed to HOLD is a
// display fiction, and an unwound barrel is better shown with no click at all
// than with one that turns.
// springArborR / springWindSweep: pass BOTH to get the wind morph above
// instead of a spiral posed once. springArborR is the radius of the static
// seat the inner coil bears on — the going drum's arbor collar, the alarm
// barrel's arbor itself — so the inner radius is DERIVED from what is actually
// there rather than a fraction of the drum; springWindSweep is the relative
// rotation the body makes against that seat over a full reserve. Omit them and
// the spiral is built exactly as before: one rigid coil that stores nothing,
// which is what BOTH barrels used to be and is now only the fallback for a
// caller with no second member to wind against (test-geometry.html's part
// smoke test being the one).
// springSetupSweep (TODO 32): pre-tension under the whole service band —
// see mainspringFrames. Default 0, so the alarm barrel (§89) is untouched.
export function makeBarrel({ radius, height, teeth, module, plain = false, arborH = null,
                             ratchet = !plain, springArborR = null, springWindSweep = 0,
                             springSetupSweep = 0,
                             arbor = true, arborBoreR = null }) {
  const g = new THREE.Group();
  if (!arbor && arborBoreR === null)
    console.warn('makeBarrel: arbor: false without arborBoreR — the body has nothing to turn on and no bore to turn on it');
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

  // Floor disc. Its bore is the body's own when the arbor turns with it, and
  // the BEARING the caller asked for when the arbor is fixed — a body that
  // runs on a static arbor is bored for it through both faces, or it is
  // sitting on the very metal it turns on.
  const bodyBoreR = arborBoreR ?? radius * 0.05;
  const floorGeo = ringExtrude(rootR, bodyBoreR, height * 0.12, 48);
  floorGeo.translate(0, 0, -height / 2 + height * 0.06);
  g.add(new THREE.Mesh(floorGeo, MATS.brass));

  // Lid with a ~90° pie cutaway revealing the mainspring inside.
  const lidShape = new THREE.Shape();
  lidShape.absarc(0, 0, rootR, Math.PI * 0.5, Math.PI * 2, false); // omit 0..90deg
  if (arborBoreR !== null) lidShape.absarc(0, 0, arborBoreR, Math.PI * 2, Math.PI * 0.5, true); // the same bore, the other face
  else lidShape.lineTo(0, 0);
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
  const sCoils = 5;
  // The ribbon's section, and with it the inner radius. Legacy form: the inner
  // radius is a fraction of the drum and the section follows. Morph form: the
  // inner coil BEARS ON the arbor collar, so springInner = arborR + sRibbon and
  // the section solves out of its own definition —
  //   rib = (0.1/coils)(outerR − arborR − rib)  ⇒  rib = q(outerR − arborR)/(1 + q)
  // — which also closes a 0.036 burial of the ribbon in the collar that the
  // fraction had left standing (an EXPECTED pair, so nothing measured it).
  const morph = springArborR !== null && springWindSweep > 0;
  const q = 0.1 / sCoils;
  const sRibbon = morph
    ? Math.max((q * (springOuter - springArborR)) / (1 + q), 0.08)
    : Math.max(((springOuter - radius * 0.16) / sCoils) * 0.1, 0.08);
  const springInner = morph ? springArborR + sRibbon : radius * 0.16;
  const wind = morph ? mainspringFrames({
    innerR: springInner, outerR: springOuter, coils: sCoils, ribbonR: sRibbon,
    sweep: springWindSweep, setup: springSetupSweep,
  }) : null;
  const tubeOf = (pts) => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0))),
    wind.segs, sRibbon, 4, false);
  const windGeos = morph ? wind.frames.map(tubeOf) : null;
  const sGeo = morph ? windGeos[windGeos.length - 1] : new THREE.TubeGeometry(
    new ArchimedeanSpiral(springInner, springOuter, sCoils),
    sCoils * 48,
    sRibbon,
    4,
    false
  );
  const springMesh = new THREE.Mesh(sGeo, MATS.steel);
  springMesh.name = 'mainspringRibbon'; // TODO 12 triage: SPRING stock — the coil IS the mainspring (real ones 0.05–0.20 mm); named so §50's kind table sees it
  // §78 part two — the ribbon's own winding, exported for the schematic. The
  // §66 blade pass finds this mesh by its name and drew a 9-point zigzag along
  // its longest local axis, which is the glyph for a straight LEAF spring:
  // wrong about the one thing a coiled ribbon is. These are the exact
  // arguments the ArchimedeanSpiral above is swept along, so the line and the
  // tube are the same curve at different fidelities.
  // (Morph form: `spiral` stays the FREE plan — the ribbon as coiled, which is
  // what the three-spring tripwire counts — and `spiralFrames` carries the
  // wind states' real polylines so the drawn line rides the morph instead of
  // quoting a plan the metal has left behind. Consumers that find frames must
  // use them: the linear parametrisation is only true at k = 1.)
  springMesh.userData.spiral = { innerR: springInner, outerR: springOuter, coils: sCoils };
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
  oh.position.set(springOuter, 0, 0);   // drum-local azimuth 0 — the morph's fixed outer end
  spring.add(oh);
  g.add(spring);

  if (morph) {
    // The wind state, and everything the caller needs to place the OTHER end.
    // The inner end sits at drum-local angle A, so its azimuth in the frame the
    // drum turns in is A + drumRot ≡ sweepFull — constant, which is the whole
    // claim: that end is bolted to a static arbor and the drum turns under it.
    // The arbor's hook lug therefore goes at `innerAnchorAz`, DERIVED, not
    // placed by eye.
    const last = windGeos.length - 1;
    let cur = last;
    const setWind = (A) => {
      const f = (A - wind.sweepDown) / springWindSweep;         // 0 run down (set-up held) … 1 fully wound
      const i = Math.max(0, Math.min(last, Math.round((1 - f) * last)));
      if (i === cur) return;
      cur = i;
      springMesh.geometry = windGeos[i];
      springMesh.userData.spiralFrame = i;
      writeSpiralLine(springMesh.userData.spiralLine, wind.frames[i]); // §83: one writer, shared with the hairspring
    };
    springMesh.userData.spiralFrames = wind.frames;
    springMesh.userData.spiralFrame = last;
    spring.userData.mainspring = {
      setWind,
      sweepFree: wind.sweepFree, sweepDown: wind.sweepDown, sweepFull: wind.sweepFull,
      setupSweep: wind.setupSweep,
      innerAnchorAz: wind.sweepFull % (Math.PI * 2),
      innerR: springInner, outerR: springOuter, ribbonR: sRibbon, pBind: wind.pBind,
      height: height * 0.7, frames: windGeos.length, segs: wind.segs,
      devLen: wind.devLen, capacity: wind.capacity, minPitch: wind.minPitch,
      maxStep: wind.maxStep, lenErr: wind.lenErr, cutSpread: wind.cutSpread,
      // TODO 32 — the SECTION AS CUT, the hairspring's TODO 25 publish
      // verbatim: radialSegments 4 cuts a RHOMBUS whose half-diagonals are
      // ribbonR (radial — the bending direction) and, after scale.z stands
      // the ribbon on edge, max(height·0.7/2, ribbonR) — the floor mirrors
      // scale.z's own Math.max. I about the axial diagonal = a³c/3, a
      // quarter of the bounding rectangle's b·h³/12 sketch. Units^4;
      // main.js converts through §39's UNIT_MM for the EQUALISATION record.
      section: (() => {
        const a = sRibbon, c = Math.max((height * 0.7) / 2, sRibbon);
        return { shape: 'rhombus4', a, c, I_u4: (a ** 3) * c / 3 };
      })(),
    };
    setWind(wind.sweepFull);   // built fully wound, which is where the sim boots
    // Rule 6 asserts — every one of them a constraint the family above claims.
    // Two of them can bite and two are tripwires, and the difference is worth
    // stating. CAPACITY and LENGTH are the real gates: run the reserve spec up
    // and the annulus eventually cannot hold the turns (capacity), and before
    // that the k-solve stops reaching the ribbon's length (lenErr) — which is
    // what "this spring is too short for this reserve" looks like as a number.
    // COIL BIND cannot fail while the affine term exists, since that term IS
    // the bind; it is kept as a regression tripwire on the radial law, not as
    // a design gate. Measured across the spec's whole 12–48 h range, the wound
    // sweep runs 5.704 → 7.814 turns and the tightest gap 0.579 → 0.2698: at
    // 48 h the spring is exactly coil-bound, which is the honest report that
    // the drum is then completely full.
    if (wind.capacity <= 0)
      console.warn(`TODO 1: the drum's annulus (${(springOuter - springInner).toFixed(3)}) cannot hold ${(wind.sweepFull / (Math.PI * 2)).toFixed(3)} turns of ${wind.pBind.toFixed(4)}-thick ribbon at coil bind — capacity ${wind.capacity.toFixed(3)}`);
    if (wind.lenErr > 1e-6)
      console.warn(`TODO 1: mainspring wind frames differ in developed length by ${(wind.lenErr * 100).toFixed(4)}% — the k-solve is not reaching ${wind.devLen.toFixed(3)}, so the ribbon is being stretched rather than wound`);
    if (wind.cutSpread > wind.pBind)
      console.warn(`TODO 1: the CUT mainspring varies ${wind.cutSpread.toFixed(3)} in length across the wind range against a ${wind.pBind.toFixed(4)} ribbon — ${wind.segs} segments is too coarse a tessellation to hold the length constraint`);
    if (wind.minPitch < wind.pBind)
      console.warn(`TODO 1: mainspring coils close to ${wind.minPitch.toFixed(4)} against a ${wind.pBind.toFixed(4)} ribbon — the turns pass through each other`);
    if (wind.maxStep > wind.pBind)
      console.warn(`TODO 1: mainspring wind steps ${wind.maxStep.toFixed(4)} between frames against a ${wind.pBind.toFixed(4)} ribbon — ${windGeos.length} frames is too few for the measured ${wind.dPdA.toFixed(3)} u/rad`);
  }

  // Central arbor — only where it TURNS WITH the body (see the `arbor` note).
  if (arbor) {
    const aR = barrelArborR(radius);
    const arborGeo = new THREE.CylinderGeometry(aR, aR, arborH ?? height * 2.4, 16);
    arborGeo.rotateX(Math.PI / 2);
    g.add(new THREE.Mesh(arborGeo, MATS.steel));
  }

  // Ratchet wheel + click on top (going-barrel form only — a plain fusee
  // drum has its ratchet on the fusee arbor instead).
  if (ratchet) {
    const rc = makeRatchetAndClick({ radius: radius * 0.34, teeth: 24, thickness: Math.max(height * 0.12, STOCK_MIN_U) }); // TODO 11/12: ratchet at floor stock — it sits on the barrel top, free upward
    rc.position.z = height / 2;
    g.add(rc);
  }

  g.userData.r = pitchR;
  g.userData.drumR = radius;
  // The cavity the spring lives in, body-local: what a part standing on the
  // static arbor INSIDE the drum has to clear. Exported rather than
  // re-derived by the caller — the floor's 0.12·h and the lid's 0.1·h are
  // this builder's business, and a second copy of them is a second thing to
  // forget when either moves.
  g.userData.cavity = {
    innerR: drumInnerR,
    boreR: bodyBoreR,
    floorTopZ: -height / 2 + height * 0.12,
    lidBotZ: height / 2 - height * 0.1,
  };
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
//
// sectors: annular-sector openings {cx, cy, r0, r1, a0, a1, pad} — ONE
// opening for a lever that crosses the plate with more than one stud on the
// same arm (§87: the setting lever's tail post and the hack rod's own pin).
// Two stadiums cannot express that: their paths OVERLAP long before the studs
// do, and overlapping holes in a THREE.Shape are not a wider opening but a
// broken one — measured, the inner stud came out with 0.05 of clearance where
// its own slot asked for 0.17, and the land between them would have been a
// 0.276 sliver of a 2-thick plate even if the triangulation had held. A
// sector is the swept region itself: the arm's radial band r0…r1 over the
// angles a0…a1, dilated by `pad` (the stud's radius plus its margin) at every
// edge — which at the inner radius costs more ANGLE for the same metal, so
// the angular pad is taken there.
export function makeBackPlate({ radius, thickness, holes = [], slots = [], sectors = [] }) {
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
  for (const sc of sectors) {
    const pad = sc.pad + bevelSize;
    const r1 = sc.r1 + pad, r0 = Math.max(1e-6, sc.r0 - pad);
    const da = pad / r0;                       // widest angular cost is at the inner edge
    // Unwrap before ordering: a sweep that straddles ±π has a1 < a0 by 2π and
    // a raw min/max would cut the COMPLEMENT of the sector — the whole plate
    // but the bit the lever needs.
    let a1u = sc.a1;
    while (a1u - sc.a0 > Math.PI) a1u -= Math.PI * 2;
    while (sc.a0 - a1u > Math.PI) a1u += Math.PI * 2;
    const a0 = Math.min(sc.a0, a1u) - da, a1 = Math.max(sc.a0, a1u) + da;
    const p = new THREE.Path();
    // Clockwise, like every other opening here: the outer arc backwards, the
    // inner arc forwards, closed across the two ends.
    p.absarc(sc.cx, sc.cy, r1, a1, a0, true);
    p.absarc(sc.cx, sc.cy, r0, a0, a1, false);
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
//   holes circular openings — the barrel/drum, the pivot bores (cut at the
//         SETTING's diameter, with the bearing land put back under the
//         counterbore by the caller), and the pillar seats, which are the
//         same construction for a screw head: the caller passes the seat
//         diameter and puts the head's land back the same way. That
//         sentence used to name the pillar seats and never receive one —
//         TODO 27's stale claim; they arrive now.
//   slots stadium-shaped openings for parts that SWEEP through the plate
//         (the setting lever's tail post and its ramp collar) — the swept
//         union of a circle of radius r along the segment a → b.
//   windows §62's openworked openings — arbitrary closed polygons
//         `{ pts: [[x, y], …] }`, already SOLVED by the caller against the
//         silhouettes they frame and the material the plate must keep. A
//         polygon rather than another parametric primitive because a window
//         is not one shape: an annular sector broken by webs, a span, a disc.
//         The builder stays what it is — a description turned into material.
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

// Grow a closed polygon by `d` along its own outward normals — the MITER
// offset, so a corner lands where the two offset edges actually meet rather
// than being rounded or cut off. Used to pre-grow §62's window outlines by the
// bevel size, exactly as holes and slots grow by it: the caller solved its
// webs against the FINISHED edge, and a bevelled extrusion eats `bevelSize`
// of material into every opening.
//
// Sign-safe: the outward direction is taken from the polygon's own signed
// area, so a window may be wound either way. The miter length blows up as a
// vertex approaches a 180° reversal (a degenerate spike), so the turn is
// clamped — a spike in a window outline is a caller bug, and quietly
// producing a finite offset for it beats producing Infinity.
export function offsetPolygon(pts, d) {
  const n = pts.length;
  if (n < 3 || d === 0) return pts.map((p) => [p[0], p[1]]);
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  const s = area2 >= 0 ? 1 : -1; // CCW: outward normal of (dx,dy) is (dy,−dx)
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1e-9;
    nrm.push([(s * dy) / L, (-s * dx) / L]);
  }
  return pts.map((p, i) => {
    const n1 = nrm[i], n0 = nrm[(i + n - 1) % n];
    const dot = Math.max(-0.9, n0[0] * n1[0] + n0[1] * n1[1]); // clamp: no infinite miter
    const k = d / (1 + dot);
    return [p[0] + k * (n0[0] + n1[0]), p[1] + k * (n0[1] + n1[1])];
  });
}

// The plate's edge bevel — the anglage chamfer. Exported because §62's web
// sections are quoted against it: the caller's asked-for outline lands at the
// plate's MID-thickness, and each face edge is this much inside it, so a web
// asked for at 0.80 measures 0.80 through its body and 0.68 across its top
// face. A number the caller has to reason about is not an implementation
// detail of this builder.
export const PLATE_BEVEL = 0.06;

export function makeThreeQuarterPlate({ radius, thickness, cut: cutIn, holes = [], slots = [], windows = [] }) {
  // A bevelled extrusion grows its material OUTWARD from the drawn profile by
  // bevelSize — into every hole and into the balance cut. The caller solved
  // its clearances against the finished EDGES, so shrink the drawn outline
  // and grow the drawn openings by exactly that much and the mesh lands where
  // it was asked to.
  const bevelSize = PLATE_BEVEL;
  radius -= bevelSize;
  const cut = { ...cutIn, radii: cutIn.radii.map((r) => r + bevelSize) };
  holes = holes.map((h) => ({ ...h, r: h.r + bevelSize }));
  slots = slots.map((s) => ({ ...s, r: s.r + bevelSize }));
  windows = windows.map((w) => ({ ...w, pts: offsetPolygon(w.pts, bevelSize) }));
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
  // §62's windows. Wound CLOCKWISE here whatever the solver handed over —
  // ExtrudeGeometry reads a hole's winding, and a window emitted the other way
  // round triangulates into a patch of solid plate rather than an opening
  // (the same failure the slots' arc directions are commented for).
  for (const w of windows) {
    let area2 = 0;
    for (let i = 0; i < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[(i + 1) % w.pts.length];
      area2 += a[0] * b[1] - b[0] * a[1];
    }
    const pts = area2 > 0 ? [...w.pts].reverse() : w.pts;
    const p = new THREE.Path();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
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
  // The foot screw's head, needed twice: once by the boss that has to be
  // bored for its shank, once by the screw itself further down.
  const footHeadR = (n) => n.r * 0.62 * 0.6;   // = legR · 0.6
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
    } else if (n.foot) {
      // A FOOT boss, and the foot screw runs down through it — so it is a
      // tube, bored one seat fit over the shank (TODO 27: the screw's shaft
      // used to be drawn inside solid nickel with nothing cut for it).
      const t2 = thickness / 2, br = screwBoreR(footHeadR(n));
      const pts = [
        new THREE.Vector2(br, -t2), new THREE.Vector2(br, t2),
        new THREE.Vector2(n.r, t2), new THREE.Vector2(n.r, -t2),
        new THREE.Vector2(br, -t2),
      ];
      const tubeG = new THREE.LatheGeometry(pts, 28);
      tubeG.rotateX(Math.PI / 2);
      disc = new THREE.Mesh(tubeG, slabMat);
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
  const footScrews = [];
  for (const n of chain) {
    if (!n.foot) continue;
    const legR = n.r * 0.62;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 1.15, footDrop, 20), slabMat);
    leg.geometry.rotateX(Math.PI / 2);
    leg.position.set(n.x, n.y, -thickness / 2 - footDrop / 2);
    g.add(leg);
    // Spread pad where it lands on the base plate, and the screw that holds
    // the whole bridge down: shank through the slab plus a PROUD blued head
    // seated on the top face (the old version sank the whole screw inside
    // the slab, leaving the bridge visually unfastened — the same pattern
    // as the balance cock's T-foot screws).
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(legR * 1.5, legR * 1.5, thickness * 0.5, 20), slabMat);
    pad.geometry.rotateX(Math.PI / 2);
    pad.position.set(n.x, n.y, -thickness / 2 - footDrop + thickness * 0.25);
    g.add(pad);
    // §20: slotted like every screw now (was a bare cylinder — "visually
    // unfastened" fixed, but with nothing to turn). Same head, same seat.
    // TODO 27: the head BEARS on the top face — it used to be placed 0.11
    // above a gap that its own §50 thickening then swallowed, ending 0.048
    // INSIDE a slab with no seat cut for it. Nothing here is flush-mounted
    // (that convention belongs to the three-quarter plate, which has rods
    // sweeping over it), so the honest seat is the face itself, and the
    // opening the screw needs is the bore through the boss above.
    footScrews.push({ x: n.x, y: n.y, z: thickness / 2 + STOCK_MIN_U,
                      a: Math.atan2(n.y, n.x), headR: footHeadR(n), shank: thickness });
  }
  if (footScrews.length) g.add(makeScrews({ at: footScrews, headT: STOCK_MIN_U }));
  for (const j of jewels) {
    // Rubbed-in jewel, seated in its counterbore. Every face is kept OFF
    // the surrounding boss: the outer wall a hair inside the counterbore
    // wall, the top a hair below the bridge face, the bottom a hair above
    // the counterbore floor. Coincident faces here z-fought — the ruby and
    // the nickel boss share a plane at the same depth, which flickered as a
    // red/white checkerboard and read as a stone lying IN the surface
    // rather than set into a bore. (The plate jewels avoid this with the
    // same margins.)
    const seatGap = SEAT_FIT;   // TODO 27: the one named fit for a set part
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
// exactly why a movement with a three-quarter plate and a power reserve
// should have them.
//
// Local frame: z = 0 is the chaton's TOP face (flush with the plate's), the
// body hanging down `thickness`. userData.outerR is the counterbore radius
// the caller must cut; userData.screwR/screwAt place the screws in the plate.
// ---------------------------------------------------------------------------
// TODO 27 — AN OPENING IS PART OF ITS FASTENER, not scenery around it.
// ONE fit for everything that has to DROP INTO a recess someone cut for it:
// a jewel into its counterbore, a screw head into its seat, a screw's body
// through its clearance hole. This is the 0.08 the bridge and plate jewels
// were already set with, named once so the same job never grows a second
// number. (It is NOT CLEAR_MARGIN's business: that is the structural margin
// between parts that must never touch, and these parts are assembled
// touching.)
export const SEAT_FIT = 0.08;
// A screw's body against its head. Watch screw heads run about twice the
// thread across — a cheese head on a 0.25 mm thread measures around 0.5 mm —
// so the shank is half the head's radius, and its hole one seat fit larger.
export const screwShankR = (headR) => headR / 2;
export const screwBoreR = (headR) => screwShankR(headR) + SEAT_FIT;
// What is NOT drawn, and therefore not cut: the thread, and the tapped hole
// it takes. A seated screw hides both in the real movement too — pass
// `shank` only as far as the fastener's own drawn body goes, which is the
// last face it comes out of.
// ---------------------------------------------------------------------------
// §20 — SLOTTED SCREWS, shared and MERGED. Every screw in the movement is
// the same object: a blued tapered head with a dark slot sunk across it —
// the vocabulary makeChaton established. This factors it so a site cannot
// draw a bare cylinder and call it a screw, and it merges: §14/§41 measured
// draw calls as the render cost that matters (the crown knurl alone was 69),
// so N screws cost TWO draw calls (one heads mesh, one slots mesh), not 2N.
// at: [{x, y, z, a, headR?, shank?}] — head axis +z, TOP FACE at z
// (flush-mount convention: pass the face the head must not stand above),
// slot azimuth a. `shank` is how far the screw's body runs BELOW the head,
// drawn at screwShankR(headR): pass it wherever the shank crosses drawn
// stock, and cut the host for it — see SEAT_FIT.
export function makeScrews({ at, headR, headT, taper = 0.92, seg = 16 }) {
  const heads = [], slots = [], shanks = [];
  for (const p of at) {
    const r = p.headR ?? headR;
    heads.push(new THREE.CylinderGeometry(r, r * taper, headT, seg)
      .rotateX(Math.PI / 2).translate(p.x, p.y, p.z - headT / 2));
    // Slot proportions are the chaton's: 1.7r long (inside the 2r head),
    // 0.28r wide, sunk 0.28·headT below the top face — never proud.
    slots.push(new THREE.BoxGeometry(r * 1.7, r * 0.28, headT * 0.35)
      .rotateZ(p.a || 0).translate(p.x, p.y, p.z - headT * 0.28));
    if (p.shank) {
      const sr = screwShankR(r);
      shanks.push(new THREE.CylinderGeometry(sr, sr, p.shank, Math.max(8, seg / 2))
        .rotateX(Math.PI / 2).translate(p.x, p.y, p.z - headT - p.shank / 2));
    }
  }
  const g = new THREE.Group();
  const headsMesh = new THREE.Mesh(mergeGeos(heads), MATS.blueSteel);
  headsMesh.name = 'screwHeads';
  g.add(headsMesh);
  // Named for §50's kind table: a slot is a RECESS rendered as a dark
  // inlay — void, not stock — the same class as the disc's printed track.
  const slotsMesh = new THREE.Mesh(mergeGeos(slots), MATS.dark);
  slotsMesh.name = 'screwSlots';
  g.add(slotsMesh);
  if (shanks.length) {
    const shanksMesh = new THREE.Mesh(mergeGeos(shanks), MATS.blueSteel);
    shanksMesh.name = 'screwShanks';
    g.add(shanksMesh);
  }
  return g;
}

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
  // over the chaton, half biting the plate outside the counterbore. Sunk,
  // not proud: nothing on this face may stand above the plate — the hack
  // blade passes 0.18 over it. (§20: the shared merged builder — this loop
  // was its template, and each chaton's screws dropped from 6 meshes to 2.)
  const headR = Math.max(0.22, outerR * 0.19), headT = t * 0.5;
  g.add(makeScrews({
    at: Array.from({ length: screwCount }, (_, i) => {
      const a = screwPhase + (i / screwCount) * Math.PI * 2;
      return { x: Math.cos(a) * outerR, y: Math.sin(a) * outerR, z: 0, a };
    }),
    headR, headT,
  }));

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
  const seatGap = SEAT_FIT;              // same fit the bridge uses (TODO 27)
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
// strokes are 0.922 u = 0.349 mm wide standing 0.175 mm proud (§39's
// UNIT_MM = 0.379). That is engraving scale and among the thinnest detail on
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
// §88 — the SHAPES, split out of the mesh so ONE construction serves two
// outputs. `tools/make-favicon.mjs` renders these same outlines to
// `favicon.svg`: a favicon drawn by eye would be a second definition of the
// house mark, free to drift from the crown the moment either was touched.
// Nothing below changed when it moved out here — the mesh builder now calls
// this and extrudes what it returns.
export function brandMarkShapes({ r, tubeR }) {
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

  // r and tubeR travel with the shapes because FIT scaled them: every consumer
  // needs the FITTED figures, not the caller's budget.
  return { shapes, r, tubeR, H, sw, depth };
}

export function makeBrandMark({ r, tubeR, material = MATS.steel, curveSegments = 10 }) {
  const m = brandMarkShapes({ r, tubeR });
  const geos = m.shapes.map((sh) => {
    const g = new THREE.ExtrudeGeometry(sh, { depth: m.depth, bevelEnabled: false, curveSegments });
    g.translate(0, -m.H / 2, -m.depth / 2); // centre the monogram on the face, half-embedded
    return g;
  });
  const merged = mergeGeos(geos);
  const mesh = new THREE.Mesh(merged, material);
  mesh.userData = { r: m.r, tubeR: m.tubeR, height: m.H, strokeWidth: m.sw, proud: m.tubeR };
  return mesh;
}

// Minimal geometry merge — the three examples' BufferGeometryUtils is not
// vendored. Position+normal only, which is all ExtrudeGeometry produces here.
// Callers: the ∞ monogram and makeScrews' three batched bodies.
//
// §81: it concatenates as triangle soup (that is the cheap way to merge
// unlike geometries) and then WELDS, so it emits indexed output. It is the
// in-house builder of exactly the mesh class tranche A exists for, and it
// merges REPEATED bodies — every screw head is the same lathe — so the weld
// has more to find here than anywhere else.
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
  const soup = new THREE.BufferGeometry();
  soup.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  soup.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  for (const g of parts) g.dispose();
  const out = weldGeometry(soup);
  if (out !== soup) soup.dispose();
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
  // unchanged from the knurl era. The chamfer's drop is named rather than
  // spelled twice: the face mark below sizes itself against this same rim, and
  // the §83 schematic profile draws it, so one number now serves three readers.
  const CAP_DROP = 0.35;
  const capTopR = bodyR - CAP_DROP;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(capTopR, bodyR, CAP_H, RADIAL_SEGS, 1), material);
  cap.geometry.rotateX(Math.PI / 2);
  cap.position.z = bodyH + CAP_H / 2;
  g.add(cap);

  // Face mark: stroke first, then the span it leaves room for. The stroke
  // is 0.085·bodyR — well under the 0.16·bodyR the axial envelope allows
  // for its proud half (asserted below) — and the mark's half-width is
  // whatever fits inside the cap's face rim (capTopR) leaving one
  // stroke-width of quiet border reveal: markR + tubeR (ink edge) +
  // tubeR (reveal) = face rim.
  const tubeR = bodyR * 0.085;
  const markR = capTopR - 2 * tubeR;
  const mark = makeBrandMark({ r: markR, tubeR, material });
  mark.position.z = faceZ; // half-embedded: centreline on the face plane
  g.add(mark);

  g.userData.r = knurlSeat + KNURL_R; // widest point: the knurl crests — ON the budget by construction
  g.userData.totalH = faceZ + tubeR;  // tallest point: face + the mark's proud half
  // §83 — THE KNOB'S PROFILE, exported so the schematic stops calling a crown a
  // gear. A crown carries userData.r, so the tier's generic rotor pass enrolled
  // it and drew a pitch circle plus a spoke in the plane ⊥ the stem: the glyph
  // for "a wheel of this radius", on the one part of the movement a hand turns.
  // The word it wants is a BARREL — two rims, a chamfered face, and meridians
  // that make the winding spin legible — and these are the numbers it is cut
  // from. The barrel radius is the KNURL CREST, not bodyR: the crests are the
  // silhouette an eye sees and the radius every clearance row is written
  // against (R_BUDGET above), so drawing bodyR would understate the part by the
  // 0.112 the ridges stand proud.
  g.userData.crown = { rimR: g.userData.r, bodyH, capR: capTopR, faceZ };
  if (g.userData.r > R_BUDGET + 1e-9 || g.userData.totalH > H_BUDGET + 1e-9)
    console.warn(`makeCrown §27 envelope exceeded: r ${g.userData.r.toFixed(3)} (budget ${R_BUDGET.toFixed(3)}), totalH ${g.userData.totalH.toFixed(3)} (budget ${H_BUDGET.toFixed(3)})`);
  return g;
}

// ---------------------------------------------------------------------------
// Dial & hands
// ---------------------------------------------------------------------------

// Sub-dial face artwork, painted around (cx, cy) at radius sr (canvas px).
// `scale` carries the graduation the CALLER owns: for the reserve well,
// { sweepDeg, hours } — see the `kind === 'reserve'` branch for why they
// cannot be literals here.
function paintSubdialFace(ctx, scx, scy, sr, kind, scale = {}) {
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
  // The well's NAME, set STRAIGHT below the pivot — a caption, not another
  // graduation, so it does not fan along an arc the way the scale's own
  // lettering does. Type is the MEASUREMENT overlay's (§49's size-comparison
  // readout, `font:11px/1.35 ui-monospace,monospace` on #scale-ref): these
  // captions name an instrument, the way that panel names a dimension, so
  // they carry its voice rather than the dial's Helvetica. Lightly tracked —
  // monospace already sets its own advance, so this only opens the word.
  // Both wells caption at the same depth, dy = 0.40·sr:
  // clear of the busiest hand tail below the pivot (the small-seconds
  // hand's counterweight reaches 0.26·0.8·sr + its own radius ≈ 0.24·sr)
  // and clear of the deepest figure below it (the seconds track's 30,
  // centred at 0.62·sr, half its 0.19·sr height = top edge at 0.525·sr).
  const caption = (txt) => {
    ctx.save();
    ctx.font = `400 ${sr * 0.08}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.fillStyle = '#1c1c22';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const track = sr * 0.01;
    const widths = [...txt].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((s, w) => s + w + track, -track);
    let x = scx - total / 2;
    for (let i = 0; i < widths.length; i++) {
      ctx.fillText(txt[i], x + widths[i] / 2, scy + sr * 0.40);
      x += widths[i] + track;
    }
    ctx.restore();
  };
  if (kind === 'reserve') {
    // Graduated arc: math angle 180° (empty, left) sweeping `sweepDeg` to
    // 30° (full, right) over `hours` of reserve. Both arrive from the
    // CALLER — main.js owns them, because the same two numbers set the
    // indicator hand's travel and the reduction train's ratio, and the
    // three drifting apart is exactly how TODO 18 happened: the arc was
    // widened 120° → 150° here while the gearing kept the old figure.
    // Major ticks every 12 hours (0/12/24), one minor per HOUR (at 150°
    // that is 5° each), slimmed to keep the comb fine.
    // Defaults reproduce the shipped face for a bare makeDial() call
    // (test-geometry.html) — main.js always passes them.
    const { sweepDeg = 150, hours = 30 } = scale;
    const angAt = (h) => 180 - (h / hours) * sweepDeg;
    for (let h = 0; h <= hours; h += 1) {
      const major = h % 12 === 0;
      tickAt(angAt(h), sr * 0.92, sr * (major ? 0.2 : 0.09), sr * (major ? 0.055 : 0.022)); // empty end anchored at 9 o'clock — the sweep sits asymmetric
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Hour figures at the majors, inboard of the tick ends — ARABIC, so the
    // reserve reads as an instrument scale rather than as more of the hour
    // chapter. Two glyphs at the widest ('12', '24') where Roman needed four
    // ('XXIV'), which is what buys the larger figure: 0.11·sr sets '24' about
    // as wide as 'XXIV' was at 0.09·sr, inside the same 0.64·sr band.
    // Arabic also retires the invented zero the Roman set needed here (an
    // N with a vinculum overbar, after the medieval computus tables' "nulla")
    // — this system has a 0 of its own.
    ctx.font = `500 ${sr * 0.11}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    // One figure per MAJOR tick, however many the graduation carries — a
    // 48 h scale reads 0/12/24/36/48 where the 30 h default reads 0/12/24
    // (identical to the fixed list this generalises).
    for (let h = 0; h <= hours; h += 12) arcLabel(String(h), angAt(h), sr * 0.64);
    // No AB / AUF bookending the arc: the German pair was the Glashütte
    // marking for a Roman-figured reserve, and with the scale figured 0→24
    // in Arabic the words name what the numbers already say. The empty end
    // is where 0 is; the caption below names the complication.
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
    arcLabel('WATCH SIMULATOR', -90, sr * (1 - 1.5 * 0.075), true);
    caption('POWER RESERVE');
  } else if (kind === 'seconds') {
    // Small-seconds track: 60 ticks, heavier every fifth, ARABIC quarter
    // figures (15/30/45/60). The hour chapter stays Roman; a running-seconds
    // count is read at a glance, and two digits do that where XLV asks to be
    // parsed. Two glyphs also lift the size cap the Roman set imposed —
    // 0.19·sr sets '45' narrower than 'XLV' was at 0.17·sr.
    for (let s = 0; s < 60; s++) {
      const major = s % 5 === 0;
      tickAt(90 - s * 6, sr * 0.92, sr * (major ? 0.16 : 0.09), sr * (major ? 0.045 : 0.022));
    }
    // Quarters fanned along an invisible circle inside the tick band,
    // bezel-convention oriented: 60/15/45 on the upper reaches keep tops
    // outward; 30 on the lower arc flips tops toward the pivot so it
    // reads upright rather than inverted.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${sr * 0.19}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    for (const [sec, mathDeg, inward] of [['60', 90, false], ['15', 0, false], ['30', -90, true], ['45', 180, false]]) {
      arcLabel(sec, mathDeg, sr * 0.62, inward);
    }
    caption('SECONDS');
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
// Each entry becomes a real recessed WELL: a blind pocket `subdialRecess`
// deep, machined into the plate's front, its floor carrying the painted
// sub-dial face and pierced by one bore for the hand's arbor. The caller adds
// its hand inside the well at the same local position. Any hour numeral whose
// marker would land on a sub-dial is skipped automatically (computed,
// replacing the old hard-coded VI omission).
// centerBoreR: hole at the dial centre for the motion works' hand arbors —
// the hour-wheel TUBE (carrying the hour hand) and the cannon pinion inside
// it have to physically reach the front of the dial. Without it the hands
// were mounted in front of an unbroken disc with nothing passing through.
// thickness: the plate's stock. 0 builds the printed sheet alone (the
// per-part smoke test's bare call) — every other consumer gives the dial its
// matter, and the plate spans local 0 (face) to −thickness (back).
// edgeBreak: the chamfer taken off both faces at the rim (TODO 26 — the
// dial's thickness is a profile, not one number).
// subdialBoreR: the arbor bore through each pocket floor. ONE size for both
// wells — one drill — so the caller derives it from the largest member that
// passes through any of them.
// The applied hour markers' radial band, as FACTORS of the dial radius.
// Exported because the HOUR HAND's length is derived from it (main.js): the
// hand is sized to the markers' inner edge, so the two cannot drift apart.
// They were previously a literal here and a hand-sampled "r ≈ 23.1" comment
// there — correct on the day it was measured, and exactly the arrangement
// that goes stale the first time the dial is re-proportioned.
export const DIAL_MARKER_OUTER_F = 0.795; // markers hug the railroad track
export const DIAL_MARKER_H_F = 0.21;      // cap height (tall proportion)
export const DIAL_MARKER_INNER_F = DIAL_MARKER_OUTER_F - DIAL_MARKER_H_F; // = 0.585

// --- The dial plate's own geometry kit (TODO 26) ---------------------------
// A plate with BLIND POCKETS cannot be extruded: ExtrudeGeometry cuts one
// outline clean through, which is exactly the defect TODO 26 shipped with —
// wells that were holes with a floor hung in them. So the plate is built
// surface by surface, and these three helpers are what keep that build a
// SOLID rather than a pile of sheets.
//
// `circleLoop` is the reason it is watertight. Every circle in the plate is
// generated ONCE and the same point array feeds the cap that ends on that
// edge and the wall that starts from it. Two different tessellations of one
// circle — a 96-gon cap against a 48-gon wall — leave chord-shaped slivers,
// and a parity raycast crawls straight through them (CLAUDE.md's open-mesh
// trap, one step further on: a mesh can be closed as authored and still leak
// at a seam its two halves disagree about).
//
// `mode` is the other half of honesty here. An INSCRIBED polygon is smaller
// than the circle it stands for, which is what an outer silhouette wants (the
// part is never bigger than nominal) and what a HOLE must never be: a bore
// drilled to clear a hub by CLEAR_MARGIN would clear it by less than that on
// every flat. Holes are CIRCUMSCRIBED so the nominal radius is the closest
// any flat comes to the axis.
function circleLoop(cx, cy, r, n, mode = 'in') {
  const rr = mode === 'out' ? r / Math.cos(Math.PI / n) : r;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector2(cx + rr * Math.cos(a), cy + rr * Math.sin(a)));
  }
  return pts;
}

// Reverse an indexed geometry's faces (winding + normals) — for the one cap
// of a solid that faces away from the builder's +z.
function flipFaces(g) {
  const idx = g.index;
  for (let i = 0; i < idx.count; i += 3) {
    const t = idx.getX(i);
    idx.setX(i, idx.getX(i + 2));
    idx.setX(i + 2, t);
  }
  idx.needsUpdate = true;
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

// A flat face at z, bounded by `outer` and pierced by `holes` — all of them
// point arrays from circleLoop, so the face's edges are the same polygons its
// walls are built from. ShapeGeometry over a Shape made of straight segments
// adds no vertices of its own (CurvePath.getPoints uses one division per
// LineCurve), which is what makes that guarantee hold.
function plateCap(outer, holes, z, facing) {
  const shape = new THREE.Shape(outer);
  for (const h of holes) shape.holes.push(new THREE.Path(h.slice().reverse()));
  const geo = new THREE.ShapeGeometry(shape);
  geo.translate(0, 0, z);
  return facing < 0 ? flipFaces(geo) : geo;
}

// The wall between two coaxial loops — A in front (zA), B behind (zB), same
// point count. Straight when the radii match, a cone (a chamfer) when they do
// not. `outward` faces a rim; otherwise the normals face the axis, which is
// what a bore or a pocket wall is seen from.
function plateWall(cx, cy, A, zA, B, zB, outward) {
  const n = A.length;
  const rA = Math.hypot(A[0].x - cx, A[0].y - cy);
  const rB = Math.hypot(B[0].x - cx, B[0].y - cy);
  // Profile normal in (r, z): perpendicular to the profile tangent
  // (Δr, Δz), taken on the side that points away from the material.
  const dr = rB - rA, dz = zB - zA;
  const len = Math.hypot(dr, dz) || 1;
  const s = outward ? 1 : -1;
  const nr = (s * -dz) / len, nz = (s * dr) / len;
  const pos = new Float32Array(n * 18), nrm = new Float32Array(n * 18);
  let o = 0;
  const put = ([p, r, z]) => {
    pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = z;
    nrm[o] = ((p.x - cx) / r) * nr; nrm[o + 1] = ((p.y - cy) / r) * nr; nrm[o + 2] = nz;
    o += 3;
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ai = [A[i], rA, zA], aj = [A[j], rA, zA], bi = [B[i], rB, zB], bj = [B[j], rB, zB];
    // Outward winding is (A_i, B_i, A_j) / (A_j, B_i, B_j); inward reverses.
    const tris = outward ? [ai, bi, aj, aj, bi, bj] : [ai, aj, bi, aj, bj, bi];
    for (const v of tris) put(v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geo;
}

export function makeDial({
  radius, subdials = [], subdialRecess = 0.5, centerBoreR = 0, thickness = 0,
  edgeBreak = 0, subdialBoreR = 1.0,
}) {
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
        const msg = 'WATCH SIMULATOR';
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

  // SEG is the one tessellation of every circle in the dial — the face's
  // printed sheet, the plate under it, the wells and their bores all read the
  // same polygon, so no two of them disagree about where a circle is.
  const SEG = 96;
  // The plate's front FLAT. `edgeBreak` is a chamfer, so the flat stops one
  // break short of the nominal radius (see the plate build below); the printed
  // face and the applied chapter ring are finish laid ON that flat, so they
  // end where it does.
  const faceR = radius - edgeBreak;
  // Every circle the plate and its finish share, generated once. The pocket
  // and bore loops are in the DIAL's frame, not each well's, because the
  // finish meshes below are built from these same arrays and must land on the
  // machined surfaces BIT for bit — see FINISH_ORDER.
  const wells = subdials.map((sd) => ({
    pocket: circleLoop(sd.x, sd.y, sd.r, SEG, 'out'),
    bore: circleLoop(sd.x, sd.y, subdialBoreR, SEG, 'out'),
  }));
  // Printing and plating lie ON the plate's own surfaces — the same plane, the
  // same polygon — so which one the viewer sees is decided by draw order under
  // a LESS-EQUAL depth test, and the finish must be drawn last. Two things
  // make that hold, and both are needed: the finish geometry is BAKED at the
  // same coordinates as the matter (a mesh positioned by its matrix instead
  // rounds differently and the two surfaces shred each other — measured, on
  // the sub-dial faces), and the order is DECLARED here rather than inherited
  // from the accident that three.js sorts opaque draws by material id.
  const FINISH_ORDER = 1;

  // Dial disc — the PRINTING, a zero-thickness sheet on the plate's front
  // flat, with a circular hole at each sub-dial (the pocket is machined and
  // printed on its own floor) and one at the centre for the hand arbors.
  let discGeo;
  if (subdials.length || centerBoreR > 0) {
    const discShape = new THREE.Shape(circleLoop(0, 0, faceR, SEG));
    for (const w of wells) discShape.holes.push(new THREE.Path(w.pocket.slice().reverse()));
    if (centerBoreR > 0) discShape.holes.push(new THREE.Path(circleLoop(0, 0, centerBoreR, SEG, 'out').reverse()));
    discGeo = new THREE.ShapeGeometry(discShape);
    // ShapeGeometry UVs are raw local coordinates — remap to the 0..1 disc
    // mapping CircleGeometry uses, so the canvas texture lands identically.
    // Normalised by the NOMINAL radius, not the flat's: the printed image is
    // painted in world units (the minute hand's length is derived from where
    // the railroad lands), so breaking the plate's edge may clip the sheet —
    // it may not rescale what is on it.
    const uv = discGeo.attributes.uv, pos = discGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, pos.getX(i) / (2 * radius) + 0.5, pos.getY(i) / (2 * radius) + 0.5);
    }
  } else {
    discGeo = new THREE.CircleGeometry(faceR, SEG);
  }
  const disc = new THREE.Mesh(discGeo, mat);
  disc.renderOrder = FINISH_ORDER;
  g.add(disc);

  // TODO 26 — THE DIAL AS MATTER, AND THE WELLS AS POCKETS IN IT.
  // The sheet above is the dial's printing; this is the plate it is printed
  // on — one closed brass solid spanning local 0 (face) to −thickness (back),
  // whose BACK the caller lands on Z_DIAL, the datum every dial-side work
  // already stands off. That is why giving the dial substance moved nothing
  // behind it: the plate grew forward, into z nothing was using.
  //
  // Two things this build says that the extrusion it replaces could not:
  //
  //  · A SUB-DIAL IS A BLIND POCKET. An extrusion of the printed outline is
  //    cut clean through at every well, so the recess had to be drawn as a
  //    floor hung in the hole — TODO 26's own filing, "a recess drawn as a
  //    PROTRUSION". Machined instead: the pocket is sunk `subdialRecess` into
  //    the FRONT and leaves `thickness − subdialRecess` of brass behind it,
  //    pierced only by the bore the hand's arbor actually needs.
  //  · THE PLATE IS THINNER AT ITS RIM. A turned brass plate carries an edge
  //    break; `edgeBreak` is that chamfer, taken off both faces, so the rim's
  //    straight land is `thickness − 2·edgeBreak` and the front flat stops at
  //    `faceR`. The pocket MOUTH is deliberately left sharp: the crisp turned
  //    corner is what reads as sunk, and a bright chamfer ring around each
  //    well is the raised-bezel failure the wall material exists to avoid.
  //
  // The face keeps its own flat mesh rather than becoming the solid's front
  // cap: the canvas texture is painted for a disc mapping, and re-deriving
  // that from a cap's UVs would put the dial's whole printed face at the mercy
  // of a geometry detail. Same for the two sub-dial faces, which lie on their
  // pocket floors exactly as the big sheet lies on the front flat. The solid
  // is plain brass — a dial's edge and back are not silvered.
  if (thickness > 0) {
    // Boot asserts (standing rule 6), both stating the constraint they hold:
    const floorT = thickness - subdialRecess;
    if (subdials.length && floorT <= 0)
      console.warn(`dial: sub-dial pocket punches through the plate — floor ${floorT.toFixed(3)}, need > 0 (thickness ${thickness.toFixed(3)}, recess ${subdialRecess})`);
    if (thickness - 2 * edgeBreak <= 0)
      console.warn(`dial: the edge break eats the stock — rim land ${(thickness - 2 * edgeBreak).toFixed(3)}, need > 0 (thickness ${thickness.toFixed(3)}, break ${edgeBreak})`);

    const face = circleLoop(0, 0, faceR, SEG);           // front/back flats' edge
    const rim = circleLoop(0, 0, radius, SEG);           // the nominal silhouette
    const bore = centerBoreR > 0 ? circleLoop(0, 0, centerBoreR, SEG, 'out') : null;
    const zF = 0, zB = -thickness, b = edgeBreak;
    // A sub-dial with no recess is a plain aperture, not a well — the pocket
    // walls below would be zero deep and its floor would land on the face.
    const sunk = subdialRecess > 0;
    const parts = [
      plateCap(face, [...(bore ? [bore] : []), ...wells.map((w) => w.pocket)], zF, +1),
      plateCap(face, [...(bore ? [bore] : []), ...wells.map((w) => (sunk ? w.bore : w.pocket))], zB, -1),
      plateWall(0, 0, face, zF, rim, zF - b, true),        // front edge break
      plateWall(0, 0, rim, zF - b, rim, zB + b, true),     // the rim's land
      plateWall(0, 0, rim, zB + b, face, zB, true),        // back edge break
    ];
    if (bore) parts.push(plateWall(0, 0, bore, zF, bore, zB, false));
    subdials.forEach((sd, i) => {
      const { pocket, bore: hole } = wells[i];
      if (!sunk) { parts.push(plateWall(sd.x, sd.y, pocket, zF, pocket, zB, false)); return; }
      parts.push(
        plateWall(sd.x, sd.y, pocket, zF, pocket, -subdialRecess, false),   // pocket wall
        plateCap(pocket, [hole], -subdialRecess, +1),                       // pocket floor
        plateWall(sd.x, sd.y, hole, -subdialRecess, hole, zB, false),       // arbor bore
      );
    });
    const body = new THREE.Mesh(mergeGeos(parts), MATS.brass);
    body.name = 'dialPlate';
    g.add(body);
  }
  // Slight raised chapter ring for depth — applied on the front flat, so it
  // ends where the flat does rather than overhanging the broken edge.
  const ring = new THREE.Mesh(ringExtrude(faceR, radius * 0.97, radius * 0.02, SEG), MATS.silver);
  ring.position.z = radius * 0.01;
  g.add(ring);

  // The wells' FINISH. The well itself is matter — a pocket machined into the
  // plate above, floor and wall both brass — and these two meshes are what is
  // printed and plated onto it: the painted sub-dial face on the pocket floor,
  // the matte silvering up its wall. Both are built from `wells[i]`, the same
  // loops the pocket was cut with, and carry FINISH_ORDER.
  if (subdials.length && subdialRecess > 0) {
    // Matte and darker than the dial: the wall is the SHADOWED side of a
    // recess. A polished/metallic wall catches highlights and reads as a
    // raised bezel ring from oblique angles — the opposite of sunk.
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x8f8d85, metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide,
    });
    subdials.forEach((sd, i) => {
      let floorMat = null;
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        // Sub-dial legibility has TWO axes, and the well's radius is only
        // one of them. This canvas is a FIXED size at any world radius, and
        // every feature paintSubdialFace draws is a fraction of sr = px/2 —
        // so the reserve's hour figures (0.11·sr) and its caption (0.08·sr)
        // are described by the same texel count however large the well is.
        // Growing the well spreads those texels wider: the print gets bigger
        // without getting sharper, and screen-px-per-texel does not improve
        // at all. At 512 the caption was 20 px of type magnified over ~24
        // world units, and it read soft. 1024 is the axis that actually
        // sharpens it; it changes no geometry, so the fingerprint is
        // untouched and this stays a finish change (P4).
        const px = 1024;
        const cv = document.createElement('canvas');
        cv.width = cv.height = px;
        const fctx = cv.getContext && cv.getContext('2d');
        if (fctx) {
          // Default: slightly darker than the dial, reads as shadowed. A
          // sub-dial may pass its own `face` colour to blend in instead.
          fctx.fillStyle = sd.face || '#d6d6ca';
          fctx.fillRect(0, 0, px, px);
          paintSubdialFace(fctx, px / 2, px / 2, px / 2, sd.kind, sd.scale);
          const ftex = new THREE.CanvasTexture(cv);
          ftex.colorSpace = THREE.SRGBColorSpace;
          ftex.anisotropy = 8;
          // Same lacquered finish as the main dial face.
          floorMat = new THREE.MeshPhysicalMaterial({ map: ftex, roughness: 0.35, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.07 });
        }
      }
      if (!floorMat) floorMat = MATS.silver;

      // The printed face, laid on the machined floor: the pocket's own loop
      // and bore, baked at the dial's coordinates (no mesh offset), so the two
      // surfaces are the same plane to the last bit.
      const floorShape = new THREE.Shape(wells[i].pocket);
      floorShape.holes.push(new THREE.Path(wells[i].bore.slice().reverse()));
      const floorGeo = new THREE.ShapeGeometry(floorShape);
      floorGeo.translate(0, 0, -subdialRecess);
      const fuv = floorGeo.attributes.uv, fpos = floorGeo.attributes.position;
      for (let k = 0; k < fuv.count; k++) {
        fuv.setXY(k, (fpos.getX(k) - sd.x) / (2 * sd.r) + 0.5, (fpos.getY(k) - sd.y) / (2 * sd.r) + 0.5);
      }
      const floor = new THREE.Mesh(floorGeo, floorMat);
      // §94 — named per well, because a floors row has to be able to SAY
      // "the arbor's standoff from the printed face". It is a decal plane,
      // not stock: zero volume, laid on the machined floor at the same
      // coordinates, so a clearance measured against it is measured against
      // a print (the Dial unit's alarmIndexWedge row makes the same point).
      floor.name = `${sd.kind}SubdialFace`;
      floor.renderOrder = FINISH_ORDER;
      g.add(floor);

      // The silvering up the wall — the pocket wall's own surface, so the same
      // call with the same loops the plate cut it with.
      const wall = new THREE.Mesh(
        plateWall(sd.x, sd.y, wells[i].pocket, 0, wells[i].pocket, -subdialRecess, false), wallMat);
      wall.renderOrder = FINISH_ORDER;
      g.add(wall);
    });
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
export function makeHand({ length, kind, boreR = 0, bossR: bossROverride = null, bossH: bossHOverride = null,
  namePrefix = null }) {
  // §94 — namePrefix NAMES this hand's four meshes. inspect.js couples by
  // `.name`, and an unnamed mesh only has an index label, which no
  // EXPECTED_CONTACT_FLOORS row can select — so a hand whose contacts a
  // floors row has to declare asks for one. Per-hand rather than per-kind
  // because `kind` is not unique: the alarm hand is an 'hour' and the
  // reserve hand is a 'minute', so kind-derived names would collide across
  // units and a row naming one would silently excuse the other.
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
    if (namePrefix) shaft.name = `${namePrefix}Shaft`;
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
    if (namePrefix) tip.name = `${namePrefix}Tip`;
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
    // rBase ≥ (0.10 mm + a hair) / UNIT_MM / 1.5 = 0.176 → 0.18 puts the blade
    // at 0.102 mm against real hands' 0.10–0.20. Sub-dial hands ride the floor;
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
    if (namePrefix) cw.name = `${namePrefix}Counterweight`;
    g.add(cw);
  }

  const bossR = bossROverride ?? length * config.bossSizeFactor;
  if (bossHOverride !== null) bossH = bossHOverride;
  const boss = boreR > 0
    ? new THREE.Mesh(ringExtrude(bossR, boreR, bossH, 24), MATS.bluedHand) // bored collet (already axis-z)
    : (() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(bossR, bossR, bossH, 18), MATS.bluedHand); m.rotateX(Math.PI / 2); return m; })();
  if (namePrefix) boss.name = `${namePrefix}Boss`;
  g.add(boss);

  g.userData.length = length;
  g.userData.kind = kind;
  return g;
}
