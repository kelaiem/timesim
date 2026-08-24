// src/geometry.js — horological geometry builders (Agent A).
// Every builder returns a THREE.Group (or Mesh) built lying in the XY plane,
// centered at the origin, rotating about local +Z. userData.r = pitch/functional
// radius where meaningful. Real tooth profiles via Shape/ExtrudeGeometry.
import * as THREE from 'three';
import { MATS } from './materials.js';
import { aesthetics } from './aesthetics.js';
import { STOCK_MIN_U, CLEAR_MARGIN, SLENDER_TARGET, FORK_BEVEL_FRAC,
  mmForArcmin, RESOLVE_ARCMIN, GLANCE_ARCMIN, CAP_PER_EM } from './layout.js'; // §50/TODO 12: build to the stock floor; §25 D's flat top clears the margin like everything else; §54's build-to proportion caps the fusee crest (TODO 40)

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
  // …and CARRY THE SOURCE SHAPE for the same reason, one step further (TODO
  // 100). `ExtrudeGeometry` keeps what it was handed in `parameters.shapes`,
  // which is the only record anywhere of the outline a part was actually cut
  // from — the builders do not export it, and once the weld drops it the
  // authored curve is unrecoverable from the mesh. Measured: with this line
  // absent, 570 of 573 geometries had no readable shape, so a sweep asking
  // "does any outline cross itself?" answered `0 crossings` while looking at
  // three parts. It is a reference to a small object the builder already
  // allocated, so it costs nothing, and like `type` above it is PROVENANCE —
  // the weld changes vertices, never the curve they were cut from.
  if (geo.parameters) out.parameters = geo.parameters;
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
// TODO 108 (§182) — A SUB-BODY RANGE ONLY MEANS ANYTHING IN THE INDEX ORDER IT
// WAS AUTHORED IN. `userData.subBodies` is {triStart, triCount} into the index
// buffer, and three-mesh-bvh's computeBoundsTree REORDERS that buffer in place
// to group triangles spatially. Measured: 29 geometries carry a sub-body table
// and none has a bounds tree at boot; after `support` runs, 16 do — and all 16
// have EVERY index entry moved (576 of 576, 2016 of 2016). So every range
// afterwards names a different set of triangles.
//
// meshIntegrity's tier 3 read the live index, so its rows were a function of
// what ran before it in the shard: on one tree `--only meshIntegrity` reports
// `39 tested / 136 declared / 0 interior` and `--only support,meshIntegrity`
// reports `527 / 50 / 134`. Both PASS — those rows are a REPORT — so nothing
// was ever going to notice, and §81's sharding invariant (no check can observe
// which ones ran before it) was quietly false for this one.
//
// The authored order is captured HERE because this is the last thing boot does
// to a geometry and no check has run yet. The zero-area and inverted tiers are
// unaffected — those are per-triangle properties, invariant under a reordering
// — which is why their counts agree in both orders and only tier 3 moved.
// The table and the order it indexes are ONE fact, so they are established
// together: `declareSubBodies` is the only way to say a geometry has
// sub-bodies. Boot's weldTree pass below is a BACKSTOP for a builder that
// assigns `userData.subBodies` directly — it fills in a missing snapshot for
// anything still in the graph — but it cannot reach a mesh built lazily, and
// that is not hypothetical: `chainRun` is re-tessellated on every tension
// change and never passes through it, so the pass alone left the chain's 87
// bodies unreadable the moment anything raycast them.
// `order` is the authored index order when the caller HOLDS it — which the
// chain does and must pass, because its index lives in a template buffer
// shared by every rebuild and handed straight to the geometry: three-mesh-bvh
// reorders that buffer IN PLACE, so the next rebuild emits from the shuffled
// template and reading the order back off the geometry snapshots the shuffle
// faithfully. That failure is worse than no snapshot at all — one EXISTS, so
// the malformed guard stays quiet while the ranges describe a different
// tessellation. Measured: `support,meshIntegrity` reads 39/136/0 and
// `support,axisEntry,meshIntegrity` 493/50/133, the difference being only
// whether anything rebuilt the chain after a tree was built.
export function declareSubBodies(geo, bodies, order) {
  geo.userData.subBodies = bodies;
  if (order) geo.userData.subBodyIndex = order;   // held by the caller, never handed to a geometry
  else snapshotSubBodyIndex(geo);
  return geo;
}
function snapshotSubBodyIndex(geo) {
  if (!geo || !geo.index || !geo.userData || !geo.userData.subBodies) return;
  // Never snapshot an order a BVH has already shuffled: an absent snapshot is
  // a REPORTED defect, a wrong one is a silent lie.
  if (geo.boundsTree) return;
  geo.userData.subBodyIndex = geo.index.array.slice();
}

export function weldTree(root) {
  const done = new Map();
  let meshes = 0, before = 0, after = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const old = o.geometry;
    meshes++;
    before += old.attributes.position.count;
    if (old.index) { after += old.attributes.position.count; snapshotSubBodyIndex(old); return; }
    let welded = done.get(old);
    if (!welded) { welded = weldGeometry(old); done.set(old, welded); }
    if (welded !== old) o.geometry = welded;
    after += welded.attributes.position.count;
    snapshotSubBodyIndex(o.geometry);
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
// HONESTY (TODO 61): each flank is one straight chord and the only curve is
// the tip relief, so NO CONJUGATE ACTION exists between two of these — there
// is no pressure angle anywhere in this file, and the 0.95/1.15 addendum/
// dedendum proportions are neither cycloidal nor involute. This is the one
// tooth generator in the codebase (makeGear, makePinion and makeBevelGear
// all call it); the single profile designed as a working surface is
// makeEscapeWheel's club tooth. Cutting real cycloidal teeth is roadmap §136.
// How far the relieved tip's control point stands past the tip circle. It is
// the one number gearOuterR's bound turns on, so the outline and the bound
// read it from here rather than from two copies of "1.02".
const TIP_RELIEF = 1.02;
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
    const TC = P(tipR * TIP_RELIEF, c); // tip round control (relieved)
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

// ---------------------------------------------------------------------------
// §136 — THE CYCLOIDAL TOOTH, DERIVED (Landing 1: the generator exists and is
// proven in free space by tools/probe-136-roll.mjs; nothing consumes it until
// Landing 2 folds the movement onto it).
//
// The per-member Willis law, which is what makes every constant below a
// derivation rather than a choice. In a mesh (X, Y), the circle of radius
// R_X/2 — half of X's OWN pitch radius — rolling inside X's pitch circle
// generates X's flank as a hypocycloid that DEGENERATES TO A STRAIGHT RADIUS;
// that degeneracy is the Willis constraint and the reason R_X/2 is not a free
// number. The same circle rolling outside Y's pitch circle generates Y's
// addendum face as the epicycloid conjugate to X's radial flank. So:
//   · every member's flanks are RADIAL, unconditionally — the flank is
//     mesh-independent and conflict-free;
//   · all mate-dependence lives in the FACE, whose generating radius is
//     m·N_mate/4 (half the mate's pitch radius);
//   · wheel⇄wheel meshes are the same law, not a special case, and no tooth
//     needs different profiles on its two sides — conjugacy is a property of
//     the surface pair, and reversing drive only swaps which flank works.
//
// THE NINE CONSTRAINTS, each with its formula (rule 1 at profile scale):
//  1 FLANK — a radial segment, root circle → pitch circle (the degeneracy).
//  2 FACE_GEN_R = m·min(mates' teeth)/4 — the MIN-MATES rule, and it is
//    derived, not chosen: near its cusp an epicycloid retreats from the
//    radial line as ~h^1.5/√ρ, so the SMALLEST mate's circle cuts the
//    THINNEST face, which lies strictly inside every larger mate's exact
//    conjugate — every non-smallest mesh errs on the CLEARANCE side and
//    interference is impossible by construction (probe-136-profile verifies
//    this numerically over the movement's eleven multi-mate cases;
//    pitch-line clearances measure 0.0002–0.065 u).
//  3 ADDENDUM from arc of action, wheel-face-first: the contact arc must
//    cover CR_TARGET·p where p = π·m and CR_TARGET = 1 + 0.02 + 2ε/p — the
//    1 is carry-before-release, the 0.02 is solveGearChain's own residual
//    bar (main.js, TODO 15's tripwire), the 2ε is the tessellation's spend.
//    One face's contribution, capped by its height h: the contact point
//    rides the generating circle held tangent at the pitch point, so
//      arc = ρ·acos( ((R+ρ)² + ρ² − (R+h)²) / (2ρ(R+ρ)) ).
//    The larger member's face grows first — recess-first in the power
//    direction, the classical low-friction split; two-way trains accept
//    approach action in their second direction exactly as real trains do.
//  4 ADDENDUM FLOOR — h ≥ 0.05 + ε: a mesh green on the centre-distance
//    tripwire (±0.05 u) must still be engaged.
//  5 THICKNESS/BACKLASH — t = p/2 − B/2 with B = 0.02·p + 2ε. Deliberately
//    NOT CLEAR_MARGIN: 0.15 u would be a quarter of a pitch at the train's
//    modules — backlash is a MESH clearance, scaled by the mesh's own module
//    and anchored to what the phase instrument can guarantee, and rule 1
//    forbids a second structural margin anyway.
//  6 DEDENDUM — d = max(mates' addenda) + c, root clearance c = 0.05 + ε
//    (a mesh inside the tripwire cannot bottom). Replaces 1.15·m.
//  7 ROOT FILLET — radius c, tangent to the radial flank and the root
//    circle; it lives inside the clearance crescent the mate's tip can
//    never enter, so it needs no conjugacy argument.
//  8 TIP — the face is truncated at R+h; a face pair that would meet in a
//    point is capped where the remaining land just holds a representable
//    round (radius 2ε). A mesh whose CR_TARGET is unreachable even at the
//    cap warns at boot (rule 6): that is a design finding — too few teeth
//    for the module — not something to absorb.
//  9 TESSELLATION — chord error ε = 0.01·π·m, HALF the phase instrument's
//    guaranteed slack: chords of a convex face lie INSIDE the metal, so
//    tessellation errs clearance-side and spends only backlash, which is
//    why the budget is instrument-anchored rather than collision-anchored.
//    Faces are emitted as computed polylines (sagitta-checked), and the
//    root land as an arc whose edges each span under π/(2N) of azimuth —
//    aimed at measuredToothPhase's outline filter, which discards edges
//    spanning ≥ π/N and once cost a 12-tooth wheel its gap outlines (§112).
//
// LOCALITY, stated. `mates` is an array of descriptors {teeth, mates} — one
// level deep — because a member's dedendum must clear each mate's SOLVED
// addendum, and a mate's addendum can be driven by its own third mesh (the
// alarm arbor wheel's face is sized by the arrest leg it drives, and the
// winding idler that also meshes it must clear THAT face). One level is
// exact for every addendum/dedendum in the movement; the only approximation
// is a grand-mate's floor-arc share of a mate's CR solve, bounded well under
// the root clearance c and stated here rather than hidden. A bare number n
// in `mates` is shorthand for {teeth: n, mates: [own teeth]} — exact for
// members whose mate has no other mesh.
const cyEps = (m) => 0.01 * Math.PI * m;
const cyBacklash = (m) => 0.02 * Math.PI * m + 2 * cyEps(m);
const cyClear = (m) => 0.05 + cyEps(m);
const cyHFloor = (m) => 0.05 + cyEps(m);
const cyCRTarget = (m) => 1 + 0.02 + (2 * cyEps(m)) / (Math.PI * m);
// Epicycloid of a circle rho rolling outside a pitch circle R, cusp at
// azimuth 0 on the pitch circle; psi is the rolling centre's angle.
const cyEpi = (R, rho, psi) => {
  const k = (R + rho) / rho;
  const x = (R + rho) * Math.cos(psi) - rho * Math.cos(k * psi);
  const y = (R + rho) * Math.sin(psi) - rho * Math.sin(k * psi);
  return [x, y, Math.hypot(x, y) - R, Math.atan2(y, x)];
};
const cyPsiAtH = (R, rho, h) => {
  if (h <= 0) return 0;
  let lo = 0, hi = (Math.PI * rho) / (R + rho);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cyEpi(R, rho, mid)[2] < h) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
};
const cyRetreat = (R, rho, h) => cyEpi(R, rho, cyPsiAtH(R, rho, h))[3];
const cyArc = (R, rho, h) => {
  if (h <= 0) return 0;
  const c = ((R + rho) ** 2 + rho ** 2 - (R + h) ** 2) / (2 * rho * (R + rho));
  if (c <= -1) return rho * Math.PI;
  if (c >= 1) return 0;
  return rho * Math.acos(c);
};
// The pair solve: both members' faces on the PAIR's exact conjugate circles,
// larger member first. Returns the two addenda.
const cyPairSolve = (m, Na, Nb) => {
  const mk = (N, mate) => {
    const Rp = (m * N) / 2, rho = (m * mate) / 4;
    const halfThick = ((Math.PI * m) / 2 - cyBacklash(m) / 2) / 2 / Rp;
    // pointed-tip cap, less the land a 2ε round needs
    let lo = 0, hi = 2 * rho;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const land = halfThick - cyRetreat(Rp, rho, mid) - (2 * cyEps(m)) / (Rp + mid);
      if (land > 0) lo = mid; else hi = mid;
    }
    return { N, Rp, rho, hCap: (lo + hi) / 2, h: Math.min(cyHFloor(m), (lo + hi) / 2) };
  };
  const A = mk(Na, Nb), B = mk(Nb, Na);
  const [W, P] = A.N >= B.N ? [A, B] : [B, A];
  const target = cyCRTarget(m) * Math.PI * m;
  const arc = () => cyArc(W.Rp, W.rho, W.h) + cyArc(P.Rp, P.rho, P.h);
  for (const G of [W, P]) {
    if (arc() >= target) break;
    let lo = G.h, hi = G.hCap;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2; G.h = mid;
      if (arc() < target) lo = mid; else hi = mid;
    }
    G.h = Math.min(hi, G.hCap);
  }
  return { hA: A.h, hB: B.h, cr: arc() / (Math.PI * m), feasible: arc() >= target - 1e-9 };
};
// The spec: everything a builder (or a bound, or a probe) needs, derived.
export function gearToothSpec({ module: m, teeth, mates }) {
  const norm = mates.map((x) => (typeof x === 'number' ? { teeth: x, mates: [teeth] } : x));
  const Rp = (m * teeth) / 2;
  const faceGenR = (m * Math.min(...norm.map((x) => x.teeth))) / 4;
  // my addendum: the max my own pair-solves assign me
  let h = cyHFloor(m), infeasible = [];
  for (const mate of norm) {
    const pair = cyPairSolve(m, teeth, mate.teeth);
    h = Math.max(h, pair.hA);
    if (!pair.feasible) infeasible.push(mate.teeth);
  }
  // each mate's own solved addendum (its pair-solves over ITS mates), for my root
  let mateH = cyHFloor(m);
  for (const mate of norm) {
    let hm = cyHFloor(m);
    for (const mm of mate.mates) hm = Math.max(hm, cyPairSolve(m, mate.teeth, mm).hA);
    mateH = Math.max(mateH, hm);
  }
  const ded = mateH + cyClear(m);
  return {
    module: m, teeth, pitchR: Rp, faceGenR,
    addendum: h, dedendum: ded, tipR: Rp + h, rootR: Rp - ded,
    halfThickAng: ((Math.PI * m) / 2 - cyBacklash(m) / 2) / 2 / Rp,
    backlash: cyBacklash(m), clearance: cyClear(m), chordErr: cyEps(m),
    infeasible,
  };
}
// The outline: computed polylines only (no curveSegments dependence), the
// root land arc sampled under π/(2N) per edge for the phase gauge.
export function cycloidalGearShape(spec) {
  const { teeth: N, pitchR: Rp, faceGenR: rho, addendum: h, rootR, tipR,
    halfThickAng: th, clearance: c, chordErr: eps, module: m } = spec;
  if (spec.infeasible.length)
    console.warn(`§136 tooth spec ${N}t m${m}: contact ratio unreachable against mate(s) `
      + `${spec.infeasible.join(', ')} even at the pointed-tip cap — too few teeth for the module`);
  const psiTop = cyPsiAtH(Rp, rho, h);
  // face sampling: double until every chord's sagitta ≤ ε
  let faceSegs = 2;
  for (; faceSegs <= 64; faceSegs *= 2) {
    let ok = true;
    for (let i = 0; i < faceSegs; i++) {
      const a = cyEpi(Rp, rho, (psiTop * i) / faceSegs);
      const b = cyEpi(Rp, rho, (psiTop * (i + 1)) / faceSegs);
      const mid = cyEpi(Rp, rho, (psiTop * (i + 0.5)) / faceSegs);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L = Math.hypot(dx, dy) || 1;
      if (Math.abs((mid[0] - a[0]) * dy - (mid[1] - a[1]) * dx) / L > eps) { ok = false; break; }
    }
    if (ok) break;
  }
  faceSegs = Math.min(faceSegs, 64);
  const topAz = cyRetreat(Rp, rho, h);
  const filletAz = c / Rp;             // fillet's azimuthal reach at the root
  const pts = [];
  const put = (r, a) => pts.push([r * Math.cos(a), r * Math.sin(a)]);
  const pitch = (2 * Math.PI) / N;
  for (let i = 0; i < N; i++) {
    const cAz = i * pitch;
    // right side of the tooth (lower azimuth): fillet, flank, face up
    put(rootR, cAz - th - filletAz);
    put(rootR + c, cAz - th);
    for (let k = 1; k <= faceSegs; k++) {
      const e = cyEpi(Rp, rho, (psiTop * k) / faceSegs);
      // flank is the radial segment root→pitch; the face starts AT the pitch
      // point, so k = 0 (the cusp) is the flank's top and needs no echo.
      if (k === 1) put(Rp, cAz - th);
      put(Rp + e[2], cAz - th + e[3]);
    }
    // tip land between the two face ends (the cap guarantees it holds a 2ε round)
    put(tipR, cAz - th + topAz);
    put(tipR, cAz + th - topAz);
    // left side down (mirror)
    for (let k = faceSegs; k >= 1; k--) {
      const e = cyEpi(Rp, rho, (psiTop * k) / faceSegs);
      put(Rp + e[2], cAz + th - e[3]);
      if (k === 1) put(Rp, cAz + th);
    }
    put(rootR + c, cAz + th);
    put(rootR, cAz + th + filletAz);
    // root land arc to the next tooth, each edge under π/(2N) of azimuth
    const a0 = cAz + th + filletAz, a1 = cAz + pitch - th - filletAz;
    const segs = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / (2 * N))));
    for (let k = 1; k < segs; k++) put(rootR, a0 + ((a1 - a0) * k) / segs);
  }
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
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

// Trapezoidal-approximation spur gear (see gearOutlineShape — straight chord
// flanks, relieved tip; NOT involute, NOT cycloidal, and no conjugate action
// is modelled — TODO 61 caught both this header and SPEC.md naming a family
// the code does not cut; real cycloidal teeth are roadmap §136).
// pitchRadius = module*teeth/2 (userData.r).
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
// §136 — EVERY cut gear declares what it meshes, and a caller that forgets is
// not quietly given a plausible wheel. The face is an epicycloid generated by
// `m·min(mates)/4` and the root clears `max(mates' addenda)`, so a wrong mate
// list is a wrong SURFACE, not a cosmetic difference — and the failure mode it
// would otherwise take is the one this repo keeps cataloguing: a build that
// looks right and interferes. Warning (not throwing) keeps rule 6's contract —
// boot is silent, so this fails CI's boot-silence gate — while still producing
// an inspectable wheel. The self-Willis fallback is a DISPLAY form: correct as
// a shape, and not a claim that anything meshes it.
const gearMates = (mates, teeth, who) => {
  if (Array.isArray(mates) && mates.length) return mates;
  console.warn(`${who}: ${teeth} teeth cut with no mates declared — falling back to `
    + `self-Willis (mates: [${teeth}]). The profile is a DISPLAY form, not a mesh claim.`);
  return [teeth];
};
export function minGearTeeth(module, boreR = 1, mates = null) {
  // §136 — the dedendum is no longer one constant, so this can no longer BE
  // one. `gearToothSpec`'s root is `pitchR − (max(mates' addenda) + clearance)`,
  // which depends on the mate graph, so the floor is SOLVED against the same
  // spec the builder cuts rather than re-stating a factor beside it. That is
  // the identity the comment above protects, kept by construction: search up
  // from the hard leg for the first count whose cut root clears the bore.
  // Measured, the new dedendum spans ~0.4·m to ~1.53·m against the old flat
  // 1.15·m, so a copied factor would be wrong in BOTH directions.
  if (!mates) return Math.max(3, Math.ceil(2 * (boreR / module + 1.15)));
  for (let n = 3; n <= 400; n++) {
    if (gearToothSpec({ module, teeth: n, mates }).rootR >= boreR) return n;
  }
  return 400;
}
// §115 — THE RADIUS A makeGear BODY ACTUALLY REACHES, for the plan-time
// declarations that have to bound it before the mesh exists. It is NOT
// `module·(N/2 + 1) + bevel`, which is what two of them said, and the two
// errors in that expression pull opposite ways so the sum looked right:
//
//  - the addendum here is 0.95·module, not one module (tipR below), which
//    makes the true tip circle SMALLER than the nominal one;
//  - but the tooth tip is RELIEVED — gearOutlineShape draws it as a
//    quadratic through a control point at tipR·1.02 — and that curve stands
//    PROUD of the tip circle between the two tip corners, by more than the
//    addendum difference gives back.
//
// The bound is the Bézier's own control hull: a quadratic lies inside the
// convex hull of its three control points, so no part of the tip can pass
// tipR·1.02, whatever `curveSegments` samples. Then the extrude's bevel
// grows the outline, and the greatest-radius point sits on the CURVED tip
// where that growth is exactly bevelSize rather than a corner's miter.
//
// Conservative by construction and measured against the metal by §115's
// declared-versus-cut assert, which is what caught this: the 64T governor
// wheel was declared at 7.308 and reaches 7.361.
// ONE expression each, and makeGear below consumes these rather than repeating
// them — a bound that re-derives its subject from a copy goes stale the moment
// the subject moves, which is the drift this whole function exists to catch.
const gearBevel = (module, thickness, on) => (on ? Math.min(thickness * 0.18, module * 0.22) : 0);
// §136 — THE BEVEL'S MITER, which TIP_RELIEF used to hide. The extrude offsets
// the outline outward by `bevel` PERPENDICULAR TO EACH EDGE, so at a convex
// vertex the offset point lands on the bisector at `bevel / sin(θ/2)`, not at
// `bevel`. On an arc that excess is nil; at the corner where the tip land meets
// the epicycloid face it is not. The trapezoid never had to care: its bound
// carried TIP_RELIEF = 1.02, a ~0.145 cushion on the governor wheel that
// swallowed a ~0.0006 miter whole. A cycloidal face ends ON its tip circle, so
// the cushion is gone and the miter is what §115 reads as metal past the
// declaration — measured, exactly the 7.2924-vs-7.293 it reported.
//
// Computed from the SAME outline the builder cuts, so the bound cannot drift
// from its subject, and memoised because the station solves call it in loops.
const _reachCache = new Map();
const gearTrueReach = (spec, bevel) => {
  const key = `${spec.module}|${spec.teeth}|${spec.faceGenR}|${spec.addendum}|${bevel}`;
  let r = _reachCache.get(key);
  if (r !== undefined) return r;
  const pts = cycloidalGearShape(spec).getPoints(1);
  r = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
    let ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
    const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
    ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    // THIS IS NOT THE MITER, AND THE COMMENT SAYS SO ON PURPOSE — TODO 86.
    // The outline runs counter-clockwise, so an edge (dx, dy) has outward normal
    // (dy, −dx) and the true offset direction is the SUM of the two, whose
    // length is 2·sin(θ/2) for the interior angle θ. What is computed here is a
    // DIFFERENCE: a direction 90° off that bisector, scaled by the sine of the
    // TURN angle rather than of the half interior angle. The consequence is an
    // OVER-estimate — measured on the keyless setting wheel, 4.1451 against the
    // 3.9424 the correct construction gives — so `gearOuterR` still bounds the
    // metal and §115's declared-versus-cut assert still holds; it simply holds
    // over more room than the tooth needs.
    //
    // It is left wrong rather than fixed here because correcting it is not a
    // profile change. `gearOuterR` feeds station solves, and the 0.2027 it
    // returns to the setting wheel un-binds `SLEEVE_TOP`'s setting-wheel cap in
    // src/main.js — at which point the clutch sleeve reaches to the rim cap
    // instead and `expectedContacts` measures `clutchSleeve ⇄ settingWheel` at
    // 0.1278 against a 0.15 floor. That is its own finding: the cap has been
    // passing on slack this error was lending it, and re-deriving it needs the
    // real closest-approach geometry rather than the sphere-about-the-centre
    // the current cap assumes. TODO 86 carries both halves.
    let nx = uy - vy, ny = vx - ux;
    const ln = Math.hypot(nx, ny);
    const sinHalf = ln / 2 || 1;
    const off = ln > 1e-9 ? bevel / Math.max(sinHalf, 0.2) : bevel;   // clamped: a cusp is not infinite metal
    const bx = b.x + (ln > 1e-9 ? (nx / ln) * off : 0), by = b.y + (ln > 1e-9 ? (ny / ln) * off : 0);
    r = Math.max(r, Math.hypot(bx, by));
  }
  _reachCache.set(key, r);
  return r;
};
export function gearOuterR({ module, teeth, thickness, bevel: bevelOn = true, mates }) {
  // §136 — the tip is the SPEC's tip. It used to be `pitchR + 0.95·m` scaled by
  // TIP_RELIEF, because the trapezoid's tip round bulged past the tip circle by
  // that factor; a cycloidal face ends ON its tip circle, so the 1.02 is gone
  // from this bound (TIP_RELIEF itself stays — `gearOutlineShape` still cuts
  // the two members left on the trapezoid, and it is that outline's constant).
  const spec = gearToothSpec({ module, teeth, mates: gearMates(mates, teeth, 'gearOuterR') });
  const bevel = gearBevel(module, thickness, bevelOn);
  return Math.max(spec.tipR + bevel, gearTrueReach(spec, bevel));
}

export function makeGear({ module, teeth, thickness, boreR = 1, spokes = 5,
                           material, hub = true, bevel: bevelOn = true, mates }) {
  const mat = material || MATS.brass;
  mates = gearMates(mates, teeth, 'makeGear');
  // THE TRAP DISARMED AT THE SOURCE (§81's weldAssert precedent). A caller
  // that computes its tooth count — and since §74 Tier B the alarm winding
  // idler does — can hand this builder a count that is not a gear. Warned
  // with the achieved and required numbers per rule 6, then CLAMPED so the
  // build survives to report it: a loud wrong wheel is inspectable, a
  // TypeError is not. Callers should not rely on the clamp; it is the
  // backstop, and the derivation is where the floor belongs.
  const floor = minGearTeeth(module, boreR, mates);
  if (!Number.isFinite(teeth) || teeth < floor) {
    console.warn(`makeGear: ${teeth} teeth is not a wheel at module ${module}, bore ${boreR} `
      + `— need ≥ ${floor} (root radius must clear the bore); clamped to ${floor}`);
    teeth = floor;
  }
  // §136 — the cut is the spec. Flanks are radial (the Willis degeneracy),
  // faces are epicycloids from `m·min(mates)/4`, and the root clears the
  // deepest addendum any mate reaches. Every radius below reads THIS object,
  // so nothing downstream can re-state a factor that has moved.
  const spec = gearToothSpec({ module, teeth, mates });
  const pitchR = spec.pitchR;
  const rootR = spec.rootR;
  const shape = cycloidalGearShape(spec);

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

  const bevel = gearBevel(module, thickness, bevelOn);
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

export function makePinion({ module, teeth, thickness, material, boreR = null, mates }) {
  const mat = material || MATS.steel;
  mates = gearMates(mates, teeth, 'makePinion');
  // §136 — same generator as the wheel, and that is the point: a pinion leaf
  // was a SEPARATE trapezoid here (+0.85·m / −0.95·m, fatter tipFrac/flankFrac)
  // chosen so fat leaves read as leaves. Conjugacy is a property of the PAIR,
  // so the leaf's face is the epicycloid the wheel's pitch circle generates and
  // there is no second set of proportions to keep in step. Low counts land
  // their contact in APPROACH, which is what a real pinion does.
  const spec = gearToothSpec({ module, teeth, mates });
  const pitchR = spec.pitchR;
  const shape = cycloidalGearShape(spec);
  const bore = new THREE.Path();
  // boreR override (TODO 50): a pinion whose arbor carries a sliding square
  // must be bored past the square's half-diagonal, not to the default shaft
  bore.absarc(0, 0, boreR ?? Math.max(module * 0.35, 0.4), 0, Math.PI * 2, true);
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
//
// TODO 98 — THE FORK IS ONE BLANK. A Swiss lever is a single piece of steel:
// pivot boss, both pallet arms, the lever and the fork end with its horns and
// notch are cut in one outline and lapped to one thickness, and only the ruby
// stones and the guard dart are separate parts. This builder used to emit SIX
// steel solids for that one blank — a body extrude, a boss cylinder, two
// slotted head blocks and two `BoxGeometry` arm bars — each with its own edge
// treatment, so they stood at four different z-heights (1.200 / 1.392 / 1.488
// / 1.560 at FORK_T = 1.2) and met at per-side ledges of up to 0.180, which is
// larger than CLEAR_MARGIN. Three things followed from that and all three are
// closed here:
//
//   · The BARS were the giveaway. Each ran boss→head-centre as a plain box, so
//     the two came out 4.2782 and 4.8711 long (12.2% apart) and the exit head
//     touched the body while the entry head stood 0.9078 clear of it, carried
//     only by its bar. The arms are cut from the blank now, by ONE rule
//     applied with sigma: a bar of half-width `leverHW` leaving the boss
//     circle — the SAME construction as the lever's own flanks, so the arm and
//     the tail are the same kind of member — opening out to the head's inner
//     face. What difference remains between the two arms is the draw lean the
//     escapement demands, not an artifact of how a box was aimed.
//   · The BELLY drew the arms a second time. Since the arms became separate
//     bars, the outline above the pivot was a vestigial `2·shoulderX` blob
//     closed by a concave top whose only derivation was a wheel-clearance
//     bound plus a bare 0.05 of slack (standing rule 1). It is gone: the metal
//     above the pivot is the boss and the two arms, and the wheel-clearance
//     bound became what it should always have been — a CHECK on the one
//     outline (`bladeClear` below), run over every vertex the extrude actually
//     produces, against the miter the bevel opens at each corner.
//   · `L_BALANCE` was derived from `FORK_T / 2`, a face no metal occupied.
//     `FORK_HALF_Z` in layout.js is the blank's real reach and the elevation
//     reads that; the boss is part of the flat blank, so nothing stands proud
//     of it any more.
//
// The kinematics are untouched by all of this: horn tips, notch walls, the
// notch floor at `forkTop + 0.7·t` that `FORK_BANK_DEG` is solved against, the
// `forkTop`/`forkY` anchors, and every stone seat are outputs of solves that
// still run exactly as they did.
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
  const bossR = t * 1.1;   // the blank's boss, cut in the outline (was a cylinder)

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
  const W = new THREE.Vector2(0, D);   // wheel centre, fork-local

  // ONE bevel in the part, because there is one part. The fraction is
  // declared in layout.js because `L_BALANCE` has to know the z it produces
  // before this builder ever runs (MODELING.md rule 1's exported-function
  // case); reading it back here is what keeps the chamfer and the balance's
  // elevation from being edited apart.
  //
  // And the chamfer comes OUT of the stock, which is the second half of
  // TODO 98. `bevelThickness` stands proud of the extrude at BOTH faces, so
  // the old `depth: t` shipped a body t + 2·bevel = 1.488 thick under a
  // balance whose elevation had been derived from t/2. A lever lapped to `t`
  // is `t` overall, chamfer included — so the extrude gets the stock that
  // survives the lapping and the finished blank measures exactly `t`.
  const bevel = t * FORK_BEVEL_FRAC;
  const stock = t - 2 * bevel;   // what is left to extrude once the chamfer is taken off

  const waistHW = leverHW * 0.62;              // narrowest point of the lever
  // The lever's flanks are the lines x = ±leverHW, so they meet the boss
  // circle here — the same join the arms use below, which is what makes the
  // tail and the arms one family of member rather than two.
  const yJoin = -Math.sqrt(Math.max(bossR * bossR - leverHW * leverHW, 0));

  // THE FORK END, and the impossible geometry it used to be cut with.
  // Eye-reported as "the tail has one part that is impossibly thin", and it
  // was thinner than that: the outline CROSSED ITSELF, five times in the
  // pre-TODO-98 build and twice after the blank's first cut.
  //
  // The cause is one comparison. The notch is `notchHW` = t·0.7 half-wide and
  // its closed end sits at `forkTop + 0.9·t`; the lever is `leverHW` = t·0.6
  // half-wide, and the horns only flared BELOW `forkTop`. So the slot was
  // broached across a station where the bar was NARROWER than the slot — the
  // walls it was supposed to leave had negative thickness, and the outline
  // inverted through itself at (−0.9274, −8.0514). Nothing could see it:
  // `slenderness` measures a mesh's length against its section as a whole and
  // reads no local pinch, and a self-intersecting outline still triangulates.
  //
  // The fix is the constraint that was missing: THE FORK END IS NOT A WEAK
  // POINT. Each horn's wall carries at least the lever's own half-section, so
  // the two horns together are exactly as thick as the bar they continue, and
  // the outline at the notch's closed end stands at `notchHW + leverHW`. The
  // flank flares into that point directly — one curve from boss to fork end,
  // rather than a flank that stopped at `forkTop` and left the slot hanging
  // outside it. Every kinematic surface is untouched: the notch walls are
  // still at ±notchHW, its closed end is still the V through
  // `forkTop + 0.7·t` that `FORK_BANK_DEG` is solved against, and the horn
  // tips and `forkY` are where they were. `forkTop` stays what it always
  // was — a datum for those, not a vertex of the silhouette.
  const notchTopY = forkTop + t * 0.9;         // where the slot's walls begin
  const hornWall = leverHW;                    // see above: the horns are the bar
  const mouthHW = notchHW + hornWall;          // outline at the slot's closed end
  const yWaist = (yJoin + notchTopY) / 2;      // mid-length

  // -------------------------------------------------------------------------
  // Ruby pallet stones — REAL construction: each stone is a leaning
  // rectangular prism seated in a slot BROACHED THROUGH THE BLANK's arm head,
  // its locking corner ON the wheel's tooth circle and its impulse face CUT
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
  //     Note what that asymmetry IS: the zero-draw direction f0 is exactly
  //     mirror-symmetric between the two stones (it is the perpendicular of
  //     the pivot radial, and the seats mirror), and the draw rotates both
  //     in the SAME sense, so the two leans differ from mirror symmetry by
  //     exactly 2·DRAW_DEG. The arms inherit that and nothing else.
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

  // §16 — the seat gap must CLEAR the blank's own extrude bevel. The bevel
  // grows the outline along its outward normal, and inside a notch that
  // direction points INTO the slot, so each wall creeps `bevel` back toward
  // the ruby it is meant to hold. At FORK_T = 1.2 that is 0.144 against a
  // hand-set 0.05 gap — steel standing inside the stone, which renders as
  // z-fighting on the ruby's face and which the battery CANNOT see: blank and
  // stone are the same unit, and same-unit overlap is the sweep's documented
  // blind spot (CLAUDE.md, TODO.md item 5). This is MODELING.md rule 1, and
  // the same arithmetic §34 hit on the alarm setting wheel (0.05 gap vs 0.045
  // of bevel). There the answer was a crisp face; here the blank keeps its
  // softened edge, so the GAP is DERIVED from the bevel rather than guessed
  // against it. TODO 98 moved the term from the head block's own `armBevel`
  // to the blank's `bevel` — one bevel in the part means one term here.
  const SEAT_SHOW = 0.05;          // the seat line the stone should actually show
  const gGap = bevel + SEAT_SHOW;  // bevel first, then the gap that survives it
  const m = 0.4 * stoneL;          // ruby protrusion past the arm's nose
  const wallW = 0.55;              // steel around the broached slot
  const sxL = -stoneW - gGap - wallW, sxR = gGap + wallW; // head outer x
  const nx0 = -stoneW - gGap, nx1 = gGap;                 // slot walls
  const yN = m, yF = stoneL + gGap, yB = yF + wallW;      // nose / slot floor / head back

  // The arm head, in the stone's own frame, wound CCW. This ONE polygon is
  // both heads: sigma only decides where it is placed and which of its two
  // side faces the arm arrives on, so the entry and exit heads are the same
  // cut metal. The slot is a notch in the nose edge, not a hole — a broach
  // enters from the nose, and an open notch is also what lets the stone be
  // set from outside.
  const HEAD_LOCAL = [
    [sxR, yB], [sxL, yB], [sxL, yN],
    [nx0, yN], [nx0, yF], [nx1, yF], [nx1, yN],   // the broached slot
    [sxR, yN],
  ];

  // Stone cross-section (stone-local: origin = locking corner, +Y = lean
  // axis pointing away from the wheel into the slot, body at −X — the
  // downstream side of the locking face, where the arm's material backs
  // the stone against the tooth's push):
  //   (0,0) → (−w, Δ) → (−w, ℓ) → (0, ℓ);  x = 0 face = LOCKING face,
  //   the angled (0,0)→(−w,Δ) end = IMPULSE face.
  function solveStone(sigma) {
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

    const rotZ = thetaTau - Math.PI / 2;
    // Banked contact seat (see header): the corner goes where the tooth
    // actually rests at lock.
    const seat = new THREE.Vector2(C.x + bank * cornerLen * u.x, C.y + bank * cornerLen * u.y);
    const cos = Math.cos(rotZ), sin = Math.sin(rotZ);
    const toWorld = (lx, ly) => new THREE.Vector2(
      seat.x + cos * lx - sin * ly,
      seat.y + sin * lx + cos * ly);
    return { sigma, seat, rotZ, delta, toWorld };
  }

  // The arm that CARRIES a head. One rule, applied with sigma: leave the boss
  // circle as a bar of half-width `leverHW` — the lever's own section — on the
  // line to the head's centre, and open out to the two ends of the head's
  // INNER face (the side that looks back at the pivot). The head's long axis
  // is perpendicular to the pivot radial by construction (f0 is the perp of
  // ĉ), so the arm always meets a head on its side, never on its back — which
  // is why the old boss→head-centre box read as a strut glued to a slab.
  function armOf(st) {
    const world = HEAD_LOCAL.map(([lx, ly]) => st.toWorld(lx, ly));
    // Which side face looks at the pivot?
    const midR = st.toWorld(sxR, (yN + yB) / 2), midL = st.toWorld(sxL, (yN + yB) / 2);
    const innerIsR = midR.length() < midL.length();
    // In HEAD_LOCAL's CCW winding the inner face runs (sxR,yN)→(sxR,yB) on the
    // right and (sxL,yB)→(sxL,yN) on the left, so the traversal that leaves
    // that face spanned by the arm starts at the vertex FOLLOWING it.
    const start = innerIsR ? 0 : 2;
    const ring = world.slice(start).concat(world.slice(0, start));
    const headC = st.toWorld((sxL + sxR) / 2, (yN + yB) / 2);
    const dHat = headC.clone().normalize();
    const pHat = new THREE.Vector2(-dHat.y, dHat.x);
    const base = dHat.clone().multiplyScalar(Math.sqrt(Math.max(bossR * bossR - leverHW * leverHW, 0)));
    const side = (v) => Math.sign(dHat.x * (v.y - base.y) - dHat.y * (v.x - base.x));
    const first = ring[0], last = ring[ring.length - 1];
    if (side(first) === side(last))
      console.warn('pallet arm: the head\'s inner face does not straddle its arm', st.sigma);
    const rootFor = (v) => base.clone().add(pHat.clone().multiplyScalar(side(v) * leverHW));
    return { ring, rootIn: rootFor(first), rootOut: rootFor(last) };
  }

  const stones = [solveStone(-1), solveStone(1)];
  const arms = stones.map(armOf);

  // -------------------------------------------------------------------------
  // THE BLANK — one closed outline, wound CCW, cut in one piece.
  // Order: down the lever's left flank, round the fork end, up the right
  // flank, then the boss and the two arms in CCW order round the pivot.
  // -------------------------------------------------------------------------
  const ang = (v) => Math.atan2(v.y, v.x);
  const leverRight = ang(new THREE.Vector2(leverHW, yJoin));
  const leverLeft = ang(new THREE.Vector2(-leverHW, yJoin));
  // The lever's flanks end ON the boss circle, and so does every arc that
  // follows — so both must be spelled the SAME way or they differ in the last
  // bit and the outline carries a twin. `Path.absellipse` computes its start
  // as `r·(cos a, sin a)`; this is that formula, used for the flank ends too,
  // which is what lets the closing arc land exactly on the `moveTo` and makes
  // `closePath()` unnecessary. (`getPoints` drops consecutive duplicates with
  // `equals()`, i.e. EXACTLY, and never compares the last point to the first —
  // so a 1-ulp twin and a wrap-around twin both survive, and each becomes
  // collapsed triangles in the extrude wall. Measured: three twins, eight
  // zero-area triangles, on a movement that already has TODO 74's 8191.)
  const onBoss = (a) => new THREE.Vector2(bossR * Math.cos(a), bossR * Math.sin(a));
  const joinL = onBoss(leverLeft), joinR = onBoss(leverRight);
  // CCW distance from the lever's right flank, so the arms are laid down in
  // the order the outline actually walks them rather than by sigma.
  const ccw = (a) => { let d = a - leverRight; while (d < 0) d += 2 * Math.PI; return d; };
  arms.sort((p, q) => ccw(ang(p.rootIn)) - ccw(ang(q.rootIn)));

  const s = new THREE.Shape();
  s.moveTo(joinL.x, joinL.y);
  s.quadraticCurveTo(-waistHW, yWaist, -mouthHW, notchTopY); // waisted lever flaring into the fork end
  s.lineTo(-forkHW, forkY + t * 0.15); // left horn outer
  s.lineTo(-notchHW - t * 0.15, forkY); // left horn tip
  s.lineTo(-notchHW, notchTopY); // notch inner left
  s.quadraticCurveTo(0, forkTop + t * 0.5, notchHW, notchTopY); // notch floor — the V at forkTop + 0.7t
  s.lineTo(notchHW + t * 0.15, forkY); // right horn tip
  s.lineTo(forkHW, forkY + t * 0.15); // right horn outer
  s.lineTo(mouthHW, notchTopY); // right side of the fork end — the mirror of the left
  s.quadraticCurveTo(waistHW, yWaist, joinR.x, joinR.y); // waisted lever, right flank (up)
  let at = leverRight;
  for (const arm of arms) {
    s.absarc(0, 0, bossR, at, ang(arm.rootIn), false); // boss, CCW
    for (const v of arm.ring) s.lineTo(v.x, v.y);
    // No `lineTo` back to the root: the NEXT arc joins itself to the head with
    // a line to its own start point, so the root exists once instead of twice.
    at = ang(arm.rootOut);
  }
  s.absarc(0, 0, bossR, at, leverLeft, false);  // lands exactly on the moveTo

  // Curve resolution: the boss arcs and the notch floor are load-bearing
  // surfaces, and 4 segments (what the old belly outline used) turns a 67°
  // arc into a visible chamfer.
  const CURVE_SEGS_FORK = 12;
  // Sample the path ONCE and extrude that polyline, so the outline the asserts
  // read below and the outline the metal is cut from are the same array rather
  // than two calls that could drift. It is also the only place the wrap-around
  // twin can be removed: the closing arc lands exactly on the `moveTo`, so the
  // loop's last point IS its first, and `ExtrudeGeometry` reads the list as
  // closed and would cut a zero-length edge there.
  const pts = s.getPoints(CURVE_SEGS_FORK);
  if (pts.length > 1 && pts[pts.length - 1].equals(pts[0])) pts.pop();
  const bodyGeo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: stock,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: CURVE_SEGS_FORK,
  });
  bodyGeo.translate(0, 0, -stock / 2);   // the bevel caps carry it out to ±t/2
  g.add(new THREE.Mesh(bodyGeo, MATS.steel));

  // NO STEEL IN THE WHEEL'S SWEEP — the bound the old outline paid for with a
  // shape. Every vertex of the blank as EXTRUDED (not as authored) must stand
  // CLEAR_MARGIN outside the annulus the teeth sweep, at any point of the
  // fork's ±bank swing: the bevel dilates the outline along its outward normal
  // and a corner miters that by 1/cos(θ/2) (three.js clamps the divisor at
  // 0.1 — MODELING.md rule 1), and the swing moves a point by ~bank·|p|.
  // Replaces the old four-corner check on the head blocks, which could not see
  // the belly it shared a part with; the belly is what used to sweep through
  // the teeth (§16).
  // THE OUTLINE MUST NOT CROSS ITSELF. A self-intersecting shape still
  // triangulates, still extrudes, still renders, and every gate in the
  // battery passes it — the fork carried five crossings for as long as it has
  // existed and only an eye caught them. This is the cheap check that says so
  // at build: every pair of non-adjacent edges of the sampled outline.
  {
    const X = (p1, p2, q1, q2) => {
      const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
      const d2x = q2.x - q1.x, d2y = q2.y - q1.y;
      const den = d1x * d2y - d1y * d2x;
      if (Math.abs(den) < 1e-14) return null;
      const tt = ((q1.x - p1.x) * d2y - (q1.y - p1.y) * d2x) / den;
      const uu = ((q1.x - p1.x) * d1y - (q1.y - p1.y) * d1x) / den;
      return (tt > 1e-9 && tt < 1 - 1e-9 && uu > 1e-9 && uu < 1 - 1e-9)
        ? { x: p1.x + tt * d1x, y: p1.y + tt * d1y } : null;
    };
    const n = pts.length;
    let crossings = 0, first = null;
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const hit = X(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]);
        if (hit) { crossings++; if (!first) first = hit; }
      }
    }
    if (crossings)
      console.warn('pallet blank: the outline crosses itself', crossings, 'time(s), first at',
        `${first.x.toFixed(4)},${first.y.toFixed(4)}`);
  }

  {
    let worst = Infinity, worstAt = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      const d1 = b.clone().sub(a), d2 = c.clone().sub(b);
      if (d1.lengthSq() < 1e-12 || d2.lengthSq() < 1e-12) continue;
      d1.normalize(); d2.normalize();
      const cosHalf = Math.max(Math.sqrt(Math.max((1 + d1.dot(d2)) / 2, 0)), 0.1);
      const miter = bevel / cosHalf;                       // how far the cut edge grows
      const clr = b.distanceTo(W) - miter - R - bank * (b.length() + miter);
      if (clr < worst) { worst = clr; worstAt = b; }
    }
    if (worst < CLEAR_MARGIN)
      console.warn('pallet blank: steel within the wheel sweep', worst.toFixed(4),
        'needs', CLEAR_MARGIN, 'at', worstAt && `${worstAt.x.toFixed(2)},${worstAt.y.toFixed(2)}`);
  }

  // The stones, set into the slots the blank was cut with. MATS.ruby is
  // load-bearing: the inspector's penetration budget splits the fork's ruby
  // from its steel by this material's colour, so the two budgets that share
  // the `Escape wheel ⇄ Pallet fork` pair still divide correctly now that the
  // steel is one mesh.
  for (const st of stones) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(-stoneW, st.delta);
    sh.lineTo(-stoneW, stoneL);
    sh.lineTo(0, stoneL);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -t / 2);
    const stone = new THREE.Mesh(geo, MATS.ruby);
    stone.position.set(st.seat.x, st.seat.y, -(stoneZReach ?? 0));
    stone.rotation.z = st.rotZ;
    g.add(stone);
  }

  // Guard pin at the fork tip just under the notch, protruding toward the
  // safety roller (-Z) so it rides close to the roller's crescent edge. A real
  // dart is a separate part too, so this stays its own solid.
  const guardGeo = new THREE.CylinderGeometry(t * 0.18, t * 0.18, t * 1.4, 12);
  guardGeo.rotateX(Math.PI / 2);
  const guard = new THREE.Mesh(guardGeo, MATS.steel);
  guard.position.set(0, forkY + t * 0.5, -t * 0.7);
  g.add(guard);

  g.userData.entryPos = entryPos;
  g.userData.exitPos = exitPos;
  g.userData.span = span;
  // MODELING.md rule 1's export: the blank's own outline and the two numbers
  // that say how far past it the rendered solid stands. `blankHalfZ` is what
  // layout.js's FORK_HALF_Z must equal — main.js asserts the pair (TODO 98).
  g.userData.blankOutline = pts.map((p) => [p.x, p.y]);
  g.userData.blankBevel = bevel;
  g.userData.blankHalfZ = stock / 2 + bevel;   // = t/2, and asserted against FORK_HALF_Z
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
export function makeColumnWheel({ columns = 6, baseR = 1.5, baseH = 0.3, colH = 0.55, colInner = 0.95, boreR = 0.3, material, riderNoseR = 0.28, skirtH = STOCK_MIN_U, rCham = 0 }) {
  const mat = material || MATS.blueSteel;
  const g = new THREE.Group();
  // TODO 87 step 4 — THE THREE BODIES ARE NAMED APART. They used to be
  // nameless, and main.js's traverse gave all three the single name
  // `alarmColWheel`, so ONE declaration excused the pawl against the base
  // disc, the castellations and the ratchet skirt alike — a depth-free
  // blanket over three different questions. Named here, at the builder that
  // knows which is which, rather than guessed at by geometry type downstream.
  const base = new THREE.Mesh(ringExtrude(baseR, boreR, baseH, 48), mat);
  base.name = 'alarmColBase';
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
        // TODO 90 finding 5 — THE OUTER EDGE RAMPS TOO, and it is the SAME
        // function that ramps the top. A column wheel's pillars differ from its
        // gaps in Z, so a follower that moves AXIALLY (the §35 link beak, which
        // rides the tops) is cammed by `top` and a follower that moves RADIALLY
        // is cammed by nothing: at a fixed z the pillar's outer wall is a
        // constant-radius cylinder with square azimuthal ends, and a radial
        // beak that dropped into a gap gets hit flat by the next pillar's side
        // instead of being lifted out. `rCham` gives the outer edge the same
        // profile the top already has, so ONE law cuts both surfaces — TODO
        // 20's invariant, extended to the second follower rather than
        // duplicated for it. rCham = 0 leaves every existing caller's geometry
        // untouched, which is why it defaults there.
        const rOut = baseR - rCham * (1 - prof(a));
        pos.push(ca * colInner, sa * colInner, 0);        // 0: inner floor
        pos.push(ca * rOut, sa * rOut, 0);                // 1: outer floor
        pos.push(ca * colInner, sa * colInner, top);      // 2: inner top
        pos.push(ca * rOut, sa * rOut, top);              // 3: outer top
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
    const colMesh = new THREE.Mesh(colGeo, mat);
    colMesh.name = 'alarmColCastellations';   // TODO 87 step 4
    g.add(colMesh);
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
    // §169 — THE BAND'S HEIGHT IS THE CALLER'S, and it is a derived number
    // there rather than a stock floor here. It was `STOCK_MIN_U` — the same
    // floor the pawl that indexes it is cut at — so the two bands were
    // IDENTICAL and the pawl's top face was coplanar with the base disc's
    // underside: 0.000 clearance over the whole area the pawl sweeps under the
    // disc, at every pose. `intraUnit` gates on intersectsGeometry and two
    // solids sharing one plane do not intersect, and `clearances` is
    // cross-unit, so nothing in the battery could see it. The floor stays the
    // default for callers with no pawl to swallow (test-geometry.html's smoke
    // test); main.js derives its own from the member that runs in the band.
    const geo = new THREE.ExtrudeGeometry(shape, { depth: skirtH, bevelEnabled: false, curveSegments: 2 }); // TODO 11 tail: the pusher's pawl indexes here — growing downward where the call site's raised seat left it room
    geo.translate(0, 0, -baseH / 2 - skirtH);
    const skirtMesh = new THREE.Mesh(geo, mat);
    skirtMesh.name = 'alarmColSkirt';         // TODO 87 step 4 — what the pawl indexes
    g.add(skirtMesh);
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
    // §173 — THE SEAT IS READ FROM THE CUT, NOT NARRATED. The sautoir's tip is
    // a cylinder of radius `tipR` whose centre rides a ray fixed in the
    // movement while the wheel turns under it. Its radius at wheel angle `a`
    // is therefore the SMALLEST radius at which that circle still clears the
    // saw outline — a query against `ratchetPoly`, the very polygon the skirt
    // above is extruded from, so the jumper's rise and fall cannot drift from
    // the metal the pawl indexes. That is TODO 20's rule ("the flank is cut,
    // not narrated") applied to the second member riding these teeth; §33 set
    // the precedent when the pawl's park stopped being a measured-once
    // constant and became a cast against this same polygon.
    //
    // Frame convention is profileAt's exactly — `a` is a LOCAL azimuth and a
    // caller adds its own member's azimuth offset, because main.js turns the
    // mesh by −a. Returns the tip-CENTRE radius.
    //
    // Bisection, because closed form is not available: the tip seats against
    // whichever flank is nearer and which one that is changes across a pitch,
    // and on a crest it is a tooth POINT rather than either flank. What makes
    // the bracket a bracket is that the saw is star-shaped about its axis, so
    // the clearance field is monotone in r along any ray out of it.
    const sawClear = (x, y) => {
      let best = Infinity, inside = false;
      for (let i = 0; i < ratchetPoly.length; i++) {
        const a = ratchetPoly[i], b = ratchetPoly[(i + 1) % ratchetPoly.length];
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
        best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
        if ((a.y > y) !== (b.y > y) && x < a.x + ((y - a.y) / (b.y - a.y)) * dx) inside = !inside;
      }
      return inside ? -best : best;
    };
    g.userData.sawClear = sawClear;
    g.userData.sawSeatAt = (a, tipR) => {
      const c = Math.cos(a), s = Math.sin(a);
      let lo = 0, hi = tip + tipR + 1;   // lo: the axis, inside the teeth; hi: clear of every tooth
      for (let i = 0; i < 40; i++) {     // ⇒ ~1e-11 u, four orders under CLEAR_MARGIN
        const m = (lo + hi) / 2;
        if (sawClear(c * m, s * m) >= tipR) hi = m; else lo = m;
      }
      return hi;
    };
  }
  g.userData.columns = columns;
  g.userData.skirtH = skirtH;      // §169 — the band's height, so a caller siting a member in it reads it here
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
  // TODO 90 finding 5 — the RADIAL twin of profileAt, exported for the same
  // reason: the rider that reads the outer wall must pose against the very law
  // the wall was cut from, not against a copy of it. The lock's rocker seats on
  // this radius at every wheel angle, flanks included, which is §173's jumper
  // convention (`sawSeatAt` → a triangle solve) applied one tier up.
  g.userData.rOutAt = (a) => baseR - rCham * (1 - g.userData.profileAt(a));
  g.userData.colRCham = rCham;
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

export function makeYoke({ armLen, width, thickness, prongGap = 3.2, prongH = 2.6, prongR = 0.4 }) {
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

  const prongGeo = new THREE.CylinderGeometry(prongR, prongR, prongH, 10);
  prongGeo.rotateX(Math.PI / 2);
  // prongGap 0 asks for a SINGLE pin — the groove-and-pin fork real yokes
  // ride a sliding pinion's neck with (two coincident posts would be one
  // part drawn twice).
  for (const px of prongGap === 0 ? [0] : [-prongGap / 2, prongGap / 2]) {
    const prong = new THREE.Mesh(prongGeo, MATS.steel);
    prong.name = 'yokeProng'; // TODO 50: the clutch's floors row names the prong⇄collar ride
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

// ---------------------------------------------------------------------------
// GENEVA / MALTESE STOP-WORK (§106) — a finger with one pin indexing a slotted
// cross, and the cross's un-slotted arm banking the finger at the end of
// travel. Three exports: the SPEC (pure arithmetic, so consumers that run
// before the meshes exist share one derivation — MODELING rule 1's
// export-a-function case), and the two bodies.
//
// THE RELATION, because getting it backwards is silent. At entry the pin's
// velocity is perpendicular to the crank and must lie along the slot, which is
// radial on the cross — so the right angle is AT THE PIN, and the angle at the
// CROSS's centre is β = π/N, half the index. The crank radius is the side
// OPPOSITE β:
//
//     a = d·sin(π/N)   the finger's pin circle — the SMALL radius
//     b = d·cos(π/N)   the cross's slot-tip radius — the LARGE one
//
// a² + b² = d² holds for the swap too, which is exactly how an inverted pair
// passes an eyeball check: it is the right-angle half of the condition and
// says nothing about the index. The test that catches it is the ANGLE —
// 2·asin(a/d) must be the index 2π/N — and it is asserted below rather than
// trusted. (The §106 filing carried the swap; built as filed the index came
// out 135°, i.e. 2.667 stations, so the cross could not have an integer slot
// count at all. tools/probe-106-geneva.mjs is the line spec.)
// ---------------------------------------------------------------------------

// The derived dimensions of an N-station stop-work, from the floors of the
// stock it is cut from. Every radius here is a consequence; the only inputs
// are the count and the section floors the movement already owns.
export function genevaSpec({ N, stockMin, pivotMin, margin, studR, arborR }) {
  const beta = Math.PI / N;
  // THE FINGER TURNS ON ITS ARBOR, so its bore is not the arbor's radius, and
  // what the cross's horn passes is this BORE LIP — not the bare arbor. Sizing
  // the horn floor against the arbor put the lip 0.14 from the horn against a
  // 0.15 margin, and left the disc's own bore 0.0098 off the arbor, which
  // `intraUnit` reads as the intersection it is. 0.05 is the running fit this
  // movement already uses for a wheel on a stud (the winding idlers' 0.5 bore
  // on a 0.45 stud).
  const fingerBoreR = arborR + 0.05;
  const slotW = 2 * pivotMin + 0.06;          // the pin's ⌀ at the pivot floor, plus running clearance
  const hubR = studR + stockMin;              // the cross's hub: a floor wall over its own stud
  // THREE FLOORS SET d, and neither of the obvious two binds.
  //   · rim pitch — each of the N stations must carry a slot and two walls:
  //       2πb/N ≥ slotW + 2·stockMin,  b = d·cos β
  //   · arm web — the slots cut inward to where the pin bottoms at d − a, and
  //     what holds the arms onto the hub is the metal between the hub and
  //     those slot bottoms:
  //       d − a − hubR ≥ stockMin,  a = d·sin β
  //   · THE HORN AGAINST THE DRIVER'S OWN ARBOR. Mid-engagement the cross's
  //     rim runs right past the driver's centre — d − b is only 7.6% of d at
  //     N = 8 — so the arbor the finger is keyed to has to fit through the
  //     gap. The nearest METAL is not the slot's centreline (that is the gap
  //     the pin rides in) but the HORN beside it, at α = asin((slotW/2)/b)
  //     off the slot axis:
  //       hypot(d − b·cos α, b·sin α) ≥ arborR + margin
  // This is the §34 class of finding — a member sweeping through another's
  // pivot — and it is the floor that actually governs: at the web's own floor
  // the horn passes 0.265 from the driver's axis, which no arbor at the §50
  // pivot floor can survive. Solved by bisection because α depends on b.
  const dFromPitch = ((slotW + 2 * stockMin) * N) / (2 * Math.PI) / Math.cos(beta);
  const dFromWeb = (hubR + stockMin) / (1 - Math.sin(beta));
  const hornAt = (dd) => {
    const bb = dd * Math.cos(beta), al = Math.asin(Math.min(1, (slotW / 2) / bb));
    return Math.hypot(dd - bb * Math.cos(al), bb * Math.sin(al));
  };
  const hornFloor = fingerBoreR + margin;
  let lo = Math.max(dFromPitch, dFromWeb), hi = lo;
  while (hornAt(hi) < hornFloor && hi < 200) hi *= 1.5;
  for (let i = 0; i < 160; i++) {
    const mid = (lo + hi) / 2;
    if (hornAt(mid) >= hornFloor) hi = mid; else lo = mid;
  }
  const dFromHorn = hi;
  const d = Math.max(dFromPitch, dFromWeb, dFromHorn);
  const a = d * Math.sin(beta);
  const b = d * Math.cos(beta);
  // The finger's locking disc fills the cross's hollows while the cross is
  // locked. It stops where the pin begins — any larger and the pin stops
  // standing proud of the rim it has to present itself from.
  const lockR = a - pivotMin;
  return {
    N, beta, d, a, b, slotW, hubR, studR, lockR, arborR, fingerBoreR, hornFloor,
    // A WHEEL TURNS ON ITS STUD, so its bore is not its stud's radius. Boring
    // the cross to studR exactly makes the two solids coincident, which the
    // instruments read as what it is — an intersection — and no declaration
    // should paper over it: the running clearance is the honest dimension, and
    // it is the one the movement's other studded wheels already carry.
    boreR: studR + 0.01,
    floors: { pitch: dFromPitch, web: dFromWeb, horn: dFromHorn },
    horn: hornAt(d),                  // the cross's nearest metal to the driver's axis
    pinR: pivotMin,
    // THE BANK ANGLE, and it is NOT the slot-entry angle. The pin ENTERS a
    // slot when its CENTRE reaches b — the slot is a gap sized to swallow it —
    // but it BANKS on the blank arm with its SURFACE, so contact happens a
    // little earlier, when the centre is still pinR outside the rim:
    //     a² + d² − 2ad·cos θ = (b + pinR)²
    // Carrying that difference in the REGISTRATION rather than in the metal is
    // what keeps the arm at plain rim radius. Making the arm proud by pinR
    // instead — the fat arm a continuously-running Geneva carries — buries the
    // pin at the ceiling rather than stopping it there, because the pin
    // arrives from OUTSIDE: measured, −0.2945 into metal at the stop.
    bankTh: Math.acos((a * a + d * d - (b + pivotMin) ** 2) / (2 * a * d)),
    slotInner: d - a,                 // where the pin bottoms
    hollowR: lockR + margin * 0.5,    // the hollow is cut over the disc, with running room
    web: d - a - hubR,
    index: 2 * Math.PI / N,           // the cross's advance per engagement
    driverSweep: 2 * (Math.PI / 2 - beta), // driver rotation while engaged
    // The bank: the un-slotted station has no slot for the pin to enter, and
    // the pin's own circle passes INSIDE the rim (d − a < b), so the pin butts
    // against that arm's flank — the same face that is a slot wall everywhere
    // else. Reported so the consumer can assert it rather than assume it.
    banks: d - a < b,
  };
}

// The cross: rim at b, N−1 slots, one un-slotted arm (the bank), a hollow at
// each station midpoint for the finger's locking disc, bored for its stud.
//
// The outline is traced from an exact signed-distance field rather than
// written as a radial function, because it genuinely is not one: a slot has
// PARALLEL walls, so a ray leaving the centre a few degrees off a slot's axis
// crosses metal, then the slot, then metal again out to the rim. Sampling
// r(θ) would fill that outer sliver in and quietly fatten every arm.
export function makeGenevaCross({ spec, thickness, blankAt = 0, material }) {
  const { N, d, b, slotW, slotInner, hubR, hollowR, studR, boreR } = spec;
  const H = [];                                  // hollow centres, in cross-local coords
  for (let j = 0; j < N; j++) {
    const phi = ((j + 0.5) / N) * Math.PI * 2;
    H.push([Math.cos(phi) * d, Math.sin(phi) * d]);
  }
  const slots = [];                              // every station but the blank
  for (let j = 0; j < N; j++) {
    if (j === blankAt) continue;
    const psi = (j / N) * Math.PI * 2;
    slots.push([Math.cos(psi), Math.sin(psi)]);
  }
  // Positive INSIDE the metal. Each term is a true signed distance, so the
  // marching-squares interpolation below lands on the real boundary rather
  // than on the grid.
  const f = (x, y) => {
    const r = Math.hypot(x, y);
    let v = Math.min(b - r, r - boreR);
    for (const [hx, hy] of H) v = Math.min(v, Math.hypot(x - hx, y - hy) - hollowR);
    for (const [ux, uy] of slots) {
      const along = x * ux + y * uy, across = Math.abs(-x * uy + y * ux);
      const t = along - slotInner;
      const sdDisc = Math.hypot(x - ux * slotInner, y - uy * slotInner) - slotW / 2;
      const sdSlab = t >= 0 ? across - slotW / 2 : Math.hypot(t, Math.max(0, across - slotW / 2));
      v = Math.min(v, Math.min(sdDisc, sdSlab));
    }
    return v;
  };
  const loops = traceField(f, b + 0.05, 0.01);
  loops.sort((p, q) => Math.abs(polyArea(q)) - Math.abs(polyArea(p)));
  const s = new THREE.Shape();
  loops[0].forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  for (const hole of loops.slice(1)) {
    const p = new THREE.Path();
    hole.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
    p.closePath();
    s.holes.push(p);
  }
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 1 }),
    material || MATS.steel);
  mesh.name = 'genevaCross';
  mesh.userData.outline = loops[0];   // MODELING rule 1: solvers read the RENDERED outline
  mesh.userData.spec = spec;
  mesh.userData.hubR = hubR;
  mesh.userData.blankAt = blankAt;
  // §134 — the schematic tier's own word for "I am a Geneva cross". Neither
  // this nor makeGenevaFinger records `userData.r`, so no generic pass ever
  // claimed either of them and there is no wrong glyph to retire: this is the
  // §107 BLANK, not the §78 wrong-word. Declaring the word here rather than
  // hand-writing the drawing in main.js is §107's own lesson — the opt-out
  // half being generic while the drawing half is not is how a part loses its
  // glyph and gains nothing.
  mesh.userData.geneva = { spec, blankAt, thickness };
  return mesh;
}

// The finger: the locking disc on the driver's arbor, carrying one pin at a.
// The disc is cut away over the engagement, and the cutaway is the CROSS'S OWN
// SWEPT ENVELOPE mapped into the finger's frame — not a chosen sector. A disc
// that merely "looks cut enough" is the §35 failure mode in miniature: it
// would read clear at rest and foul mid-engagement, where no static pose
// looks.
export function makeGenevaFinger({ spec, thickness, boreR, material }) {
  const { a, b, d, beta, lockR, pinR, slotInner } = spec;
  const SEG = 1440;
  const env = new Array(SEG).fill(lockR);        // finger-local max radius, per bin
  const sweep = Math.PI / 2 - beta;
  for (let k = 0; k <= 600; k++) {
    const th = -sweep + (2 * sweep * k) / 600;   // driver angle, 0 = crank pointing at the cross
    // The cross's rotation is what the slot demands of it at this driver angle.
    const gam = Math.atan2(a * Math.sin(th), a * Math.cos(th) - d);
    // Sample the cross's rim and the mouths of the two slots nearest the pin;
    // the rim is what can foul the disc, so it is what the cutaway is cut to.
    // The rim near the ENGAGING slot is what can foul the disc — the cross's
    // centre is at +d, so the near rim is sampled about `gam` itself. (Sampling
    // gam − π reads the far rim, which never comes near the driver at all, so
    // the envelope stays at lockR and the disc ships uncut: a cutaway that
    // looks right at rest and buries itself mid-engagement, where no static
    // pose looks.)
    for (let m = 0; m <= 480; m++) {
      const lam = gam + ((m / 480) - 0.5) * spec.index * 2;
      const px = d + Math.cos(lam) * b, py = Math.sin(lam) * b;   // cross rim point, driver frame
      const rr = Math.hypot(px, py);
      if (rr > lockR) continue;                                    // outside the disc anyway
      // into the FINGER's frame: the finger turns with the driver angle
      let ang = Math.atan2(py, px) - th;
      ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const bin = Math.round((ang / (Math.PI * 2)) * SEG) % SEG;
      // Smear across neighbouring bins, so the cut is conservative at the
      // cutaway's steep edges rather than a comb: a consumer sampling between
      // two bins would otherwise read a radius from one side of the step.
      const SMEAR = Math.ceil(SEG / 240);        // ±1.5°
      for (let o = -SMEAR; o <= SMEAR; o++) {
        const i = (bin + o + SEG) % SEG;
        env[i] = Math.min(env[i], rr - CLEAR_MARGIN_G);
      }
    }
  }
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const ang = (i / SEG) * Math.PI * 2;
    // The cut may run right down to the arbor — at N = 8 the cross's horn
    // passes within a margin of it — so the floor here is the arbor itself,
    // not a comfortable ring around it. spec.horn is what guarantees the
    // arbor survives that; this clamp only keeps the outline valid.
    const r = Math.max(boreR, env[i]);
    pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
  }
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  // The bore is written as an EXPLICIT POLYGON, not an absarc. This extrude
  // runs at curveSegments: 1 (the outline is already a fine polygon and does
  // not want re-tessellating), and at that setting an absarc is divided into a
  // single segment — the hole collapses and the disc's metal closes over the
  // arbor it is bored for. Measured: intraUnit reported genevaFingerDisc ⇄
  // alarmArrestArbor intersecting, with a bore nominally 0.01 CLEAR of it.
  const hole = new THREE.Path();
  for (let i = 0; i < 64; i++) {
    const t = -(i / 64) * Math.PI * 2;              // reversed, so the hole winds against the outline
    const x = Math.cos(t) * boreR, y = Math.sin(t) * boreR;
    if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
  }
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 1 }),
    material || MATS.steel);
  disc.name = 'genevaFingerDisc';
  g.add(disc);
  // The pin stands the full height of the cross's slot plus this disc, so the
  // two overlap in z wherever they overlap in plan — a pin that only reached
  // its own disc would index nothing.
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinR, pinR, thickness * 2, 14),
    material || MATS.steel);
  pin.name = 'genevaFingerPin';
  pin.rotation.x = Math.PI / 2;
  pin.position.set(a, 0, thickness);
  g.add(pin);
  g.userData.spec = spec;
  g.userData.outline = pts;
  g.userData.slotInner = slotInner;
  g.userData.genevaFinger = { spec, thickness };   // §134, see makeGenevaCross
  return g;
}

// Marching squares over a signed field, returning closed loops in CCW order.
// Corner values are interpolated, so with a true SDF the traced boundary is
// accurate to far better than the cell — the grid sets cost, not fidelity.
function traceField(f, extent, h) {
  const n = Math.ceil((2 * extent) / h);
  const at = (i, j) => f(-extent + i * h, -extent + j * h);
  const grid = [];
  for (let i = 0; i <= n; i++) { grid.push([]); for (let j = 0; j <= n; j++) grid[i].push(at(i, j)); }
  const segs = [];
  const lerp = (x0, y0, v0, x1, y1, v1) => {
    const t = v0 / (v0 - v1);
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = -extent + i * h, y0 = -extent + j * h, x1 = x0 + h, y1 = y0 + h;
    const v = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
    const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    let mask = 0;
    for (let k = 0; k < 4; k++) if (v[k] > 0) mask |= 1 << k;
    if (mask === 0 || mask === 15) continue;
    const cuts = [];
    for (let k = 0; k < 4; k++) {
      const l = (k + 1) % 4;
      if ((v[k] > 0) !== (v[l] > 0)) cuts.push(lerp(c[k][0], c[k][1], v[k], c[l][0], c[l][1], v[l]));
    }
    for (let k = 0; k + 1 < cuts.length; k += 2) segs.push([cuts[k], cuts[k + 1]]);
  }
  // chain the segments into loops by endpoint identity, on a grid finer than
  // any real feature so two distinct boundaries cannot be welded together
  const key = ([x, y]) => `${Math.round(x / (h * 1e-3))},${Math.round(y / (h * 1e-3))}`;
  const adj = new Map();
  for (const [p, q] of segs) {
    for (const [u, w] of [[p, q], [q, p]]) {
      const k = key(u);
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push(w);
    }
  }
  const used = new Set(), loops = [];
  for (const [p, q] of segs) {
    const sk = `${key(p)}|${key(q)}`;
    if (used.has(sk)) continue;
    const loop = [p];
    let cur = p, next = q;
    for (let guard = 0; guard < segs.length * 2 + 8; guard++) {
      used.add(`${key(cur)}|${key(next)}`); used.add(`${key(next)}|${key(cur)}`);
      loop.push(next);
      const outs = (adj.get(key(next)) || []).filter((w) => !used.has(`${key(next)}|${key(w)}`));
      if (!outs.length) break;
      cur = next; next = outs[0];
      if (key(next) === key(loop[0])) break;
    }
    if (loop.length > 8) loops.push(polyArea(loop) < 0 ? loop.slice().reverse() : loop);
  }
  return loops;
}

function polyArea(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % n];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

const CLEAR_MARGIN_G = 0.15;   // the ONE margin (rule 1); geometry.js's local copy of main's

// ---------------------------------------------------------------------------
// SPIDER DIFFERENTIAL (BUILT §129) — the one member that can SUBTRACT two
// angles, which is what a stop-work on a going barrel has to do.
//
// The alarm's wind is `arborA − bodyA`, and both members are real coaxial
// wheels of the same tooth count. No rigid plate-mounted train reads that: a
// wheel's angle is a fixed multiple of its one driving chain, and a single
// body meshing both coaxial wheels is over-constrained — it would LOCK the
// barrel, not measure it. Subtraction needs two degrees of freedom.
//
// WHY THIS SHAPE AND NOT AN EPICYCLIC, which is arithmetic rather than taste.
// Every three-port epicyclic obeys `out = alpha·in1 + (1 − alpha)·in2` — the
// coefficients SUM TO ONE whatever the tooth counts. Two legs of equal
// magnitude therefore subtract only at alpha = 1/2 exactly, and alpha = 1/2 is
// this: two equal side gears facing each other with planets between, carrier =
// (thetaA + thetaB)/2. A sun-planet-annulus cannot reach it (it would need
// annulus teeth equal to sun teeth), which is why the reserve-de-marche
// differential is a spider in real movements too.
//
// GEOMETRY. Four bevels sharing ONE pitch apex on the carrier's axis: the two
// side gears open away from that apex along ±Z, the planets along ±X on the
// cage's cross pin. Equal side and planet counts put every cone at 45°, which
// is makeBevelGear's own default and its documented mounting convention —
// origin AT the shaft intersection, local +Z back into the gear's own shaft.
//
// The planets are DRIVEN, not decorative: in the cage's frame the two sides
// counter-rotate, so a planet turns −(sideTeeth/planetTeeth)·(thetaA −
// thetaB)/2 about its own axis. `spinPlanets` is that law, exported with the
// part so no caller has to restate it (rule 2 — the angle travels the gears).
// ---------------------------------------------------------------------------
export function spiderSpec({ arborR, stockMin, margin = CLEAR_MARGIN_G,
                             tipBudget, preferTeeth = 10, fit = 0.05,
                             thickness = 0 }) {
  // EVERYTHING HERE IS FORCED FROM THE INSIDE OUT, and the order is the point.
  //
  // The cage runs on the arbor, so its bore is the arbor plus a running fit and
  // its hub is that plus a §50 wall. The planets ride stubs in that hub, so
  // their bore has to clear the hub by the margin. Their rim is stock again, so
  // the PITCH RADIUS is settled before any tooth count is chosen — and the side
  // gears share it, because equal side and planet counts are what put every
  // cone at 45° and what makes the carrier the plain mean of its two inputs.
  //
  // Only then does the count get picked, from what is left over OUTSIDE: the
  // tip must fit the budget the surrounding metal leaves, and tip = pitch +
  // 0.85·module, so the budget buys the module and the module buys the count.
  // Choosing the count first is what put the rim 0.003 under the floor the
  // first time this was written.
  const cageBoreR = arborR + fit;
  const hubR = cageBoreR + stockMin;
  const planetBoreR = hubR + margin;
  const R = planetBoreR + stockMin;
  // THE BUDGET IS SPENT ON THE SWEPT RADIUS, NOT THE TIP. A 45° cone's rim is a
  // circle standing one tip radius OFF the cage's axis as well as one tip
  // radius out along its own, so a planet's farthest point from that axis is
  // √2·tip — the same lesson as a rotor's footprint being its annulus rather
  // than its resting silhouette, one dimension down. Sizing to the tip put the
  // planets 1.63 into a corner that leaves 1.16 and told the siting solve 1.15.
  const budgetR = tipBudget !== undefined ? tipBudget / Math.SQRT2 : undefined;
  const moduleMax = budgetR !== undefined ? (budgetR - R) / 0.85 : Infinity;
  // A TOOTH IS A SECTION TOO, so the §50 floor reaches it. A standard tooth is
  // π·module/2 thick at the pitch line, and nothing in this movement is cut
  // thinner than stockMin — which puts a hard floor under the module and
  // therefore a ceiling on the count. Without it, a spec asked to fit a budget
  // it cannot fit will happily shrink the module until it does: this returned a
  // 114-tooth wheel at module 0.018 (0.007 mm teeth) and called it a solution.
  const moduleMin = stockMin / (Math.PI / 2);
  const teeth = Math.max(preferTeeth, Math.ceil((2 * R) / moduleMax));
  const module = (2 * R) / teeth;
  const faceWidth = Math.max(stockMin, module * 2);
  // The side gears run OUTSIDE the cage's own wheel, not on the same shoulder:
  // their cones start at |z| equal to their bore, so a bore inside the wheel's
  // half-thickness puts the cone's inner edge inside the wheel's metal.
  const sideBoreR = Math.max(cageBoreR, thickness / 2 + margin);
  return {
    module, sideTeeth: teeth, planetTeeth: teeth, faceWidth, margin, stockMin,
    cageBoreR, hubR, planetBoreR, sideBoreR, arborR, fit,
    R, planetR: R,
    pinR: stockMin / 2,                 // the stub is a section, not a fraction
    tipR: R + module * 0.85,
    // what the assembly actually SWEEPS about the cage's axis — the number the
    // siting solve and the budget must both be given
    sweptR: (R + module * 0.85) * Math.SQRT2,
    // half the axial extent of the CONES — what the z-stack above and below has
    // to be given. The sleeves start here, not at the apex: a side gear's hub
    // extends AWAY from the planets in a real differential, and running it
    // inward instead is what had the two sleeves meeting in the middle of the
    // gear set with the planets driven straight through them.
    halfHeight: R + module * 0.85 + faceWidth * Math.SQRT1_2 + margin,
    // WHERE A HUB ACTUALLY SEATS, which is NOT halfHeight (TODO 60).
    // makeBevelGear extrudes the flat outline along z and then shears it
    // (`v.z += hypot(v.x, v.y) * taper`, taper = 1 at 45°), so a vertex at
    // radius r lands at z in [r, r + faceWidth]. The cone's back surface is
    // therefore z = r + faceWidth, sloping from the bore outward — and at the
    // BORE it is the flat annulus a sleeve butts against. halfHeight is the
    // swept ENVELOPE and stands outboard of every point of metal, so a sleeve
    // ended there stops in mid-air: measured, 0.672 short on both legs, which
    // is exactly the hole TODO 60 found under leg B's deleted ring.
    hubFaceZ: sideBoreR + faceWidth,
    teethOk: teeth >= minGearTeeth(module, planetBoreR),   // §136: BEVEL — trapezoid floor, see makeBevelGear
    moduleMin,
    cuttable: module >= moduleMin - 1e-12,
    fitsBudget: module >= moduleMin - 1e-12
      && (tipBudget === undefined || (R + module * 0.85) * Math.SQRT2 <= tipBudget),
    // the differential relation itself, as a function rather than a comment
    carrierOf: (thetaA, thetaB) => (thetaA + thetaB) / 2,
    planetOf: (thetaA, thetaB) => -(thetaA - thetaB) / 2,
  };
}

// The cage IS the output wheel, and that is not a shortcut — it is the only
// place the output can leave from. A tube up the axis cannot work: the leg
// pinion above is concentric with it and must cross its radius, so the two
// occupy the same metal at every height. A real differential takes its drive
// off a rim at the gear set's own plane, carried on arms that pass BETWEEN the
// planets, and that is what this builds — a two-spoke wheel whose crossings
// are where the planets sit.
// §136 — `outMates` crosses the module boundary because it has to: the cage
// wheel meshes the FINGER PINION, whose count is a `main.js` constant this file
// cannot see. The caller holds both, so the caller declares the mesh; inventing
// a default here would cut a wheel against a wheel nobody chose.
export function makeSpiderDifferential({ spec, planets = 2, outModule, outTeeth,
                                         outMates, thickness, material }) {
  const mat = material || MATS.steel;
  const { module, sideTeeth, planetTeeth, faceWidth } = spec;
  if (!spec.teethOk)
    console.warn(`spider differential: ${sideTeeth} teeth at module ${module.toFixed(3)} on a `
      + `${spec.planetBoreR.toFixed(3)} planet bore is under minGearTeeth `
      + `${minGearTeeth(module, spec.planetBoreR)} — the wheel would have no rim`);
  if (!spec.fitsBudget)
    console.warn(`spider differential: the cones reach ${spec.tipR.toFixed(3)}, outside the `
      + 'budget the surrounding metal leaves');

  const g = new THREE.Group();
  // One mount per gear: a group whose local +Z is that gear's own shaft
  // direction (makeBevelGear's convention), holding a SPIN group inside it so
  // the gear's rotation is always about its own axis whatever the mount did.
  const mount = (axis, teeth, bore, phase) => {
    const m = new THREE.Group();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    const spin = new THREE.Group();
    const gear = makeBevelGear({ teeth, module, faceWidth, boreR: bore, material: mat });
    gear.rotation.z = phase;
    spin.add(gear);
    m.add(spin);
    return { m, spin, gear };
  };

  // The cage: a two-spoke wheel at the gear set's plane. Its ARMS lie on ±X
  // (makeGear puts them on the crossing boundaries) and its two crossings are
  // the open ground on ±Y where the planets live.
  const cage = new THREE.Group(); cage.name = 'spiderCageSpin';
  const wheel = makeGear({
    module: outModule, teeth: outTeeth, mates: outMates, thickness,
    boreR: spec.cageBoreR, spokes: 2, material: MATS.brass,
  });
  wheel.traverse((o) => { if (o.isMesh && !o.name) o.name = 'spiderCageWheel'; });
  cage.add(wheel);

  // The two sides, on the cage's own axis, opening away from the shared apex.
  // They are INSIDE the cage group so the apex stays one point however the cage
  // turns; each carries only its angle relative to the cage, and pose() adds
  // the rest back.
  const A = mount(new THREE.Vector3(0, 0, -1), sideTeeth, spec.sideBoreR, 0);
  const B = mount(new THREE.Vector3(0, 0, 1), sideTeeth, spec.sideBoreR, 0);
  A.gear.children[0].name = 'spiderSideA';
  B.gear.children[0].name = 'spiderSideB';
  const sideA = A.spin, sideB = B.spin;
  sideA.name = 'spiderSideASpin'; sideB.name = 'spiderSideBSpin';
  cage.add(A.m, B.m);

  const planetSpins = [];
  for (let i = 0; i < planets; i++) {
    // …in the CROSSINGS, a quarter turn off the arms.
    const a = Math.PI / 2 + (i / planets) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const stubLen = spec.planetBoreR + faceWidth - spec.hubR;
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.pinR, spec.pinR, stubLen, 12), mat);
    stub.name = `spiderStub${i}`;
    stub.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    stub.position.copy(dir).multiplyScalar(spec.hubR + stubLen / 2);
    cage.add(stub);
    const P = mount(dir, planetTeeth, spec.planetBoreR, Math.PI / planetTeeth);
    P.gear.children[0].name = `spiderPlanet${i}`;
    cage.add(P.m);
    // EVERY planet takes the SAME spin about its OWN outward axis, which is
    // opposite senses in world for a pair on one line. That is not a fudge: a
    // 180° rotation about the cage axis maps planet i to planet i+1 and leaves
    // both side gears alone, so it is a symmetry of the whole assembly, and
    // under it an angular velocity about +X maps to one about −X of the same
    // magnitude. Signing them per index instead is the plausible-looking error.
    planetSpins.push(P.spin);
  }

  g.add(cage);
  g.userData.sideA = sideA;
  g.userData.sideB = sideB;
  g.userData.cage = cage;
  g.userData.wheel = wheel;
  g.userData.spec = spec;
  // Rule 2, made impossible to get wrong at the call site: one function poses
  // every member of the differential from its two inputs.
  g.userData.pose = (thetaA, thetaB) => {
    const c = spec.carrierOf(thetaA, thetaB);
    cage.rotation.z = c;
    // Side A's mount lays local +Z onto world −Z (it opens downward from the
    // apex), so a rotation about its own axis reads NEGATED in world; side B's
    // mount is the identity and does not. Get this pair the wrong way round
    // and the differential still turns — it just stops subtracting.
    sideA.rotation.z = -(thetaA - c);
    sideB.rotation.z = thetaB - c;
    const p = spec.planetOf(thetaA, thetaB);
    for (const s of planetSpins) s.rotation.z = p;
  };
  return g;
}

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

// The tip cone's proportion: the apex stands off the outline's `reach` by
// this fraction of the half-width, so a caller that wants the APEX at a
// solved radius sets `reach = R − (W/2)·JUMPER_TIP_CONE_F`. Exported
// because the placement solve consumes it too (main.js' JMP_W and
// JMP_REACH) — it was a bare 0.9 at all three sites, free to drift apart
// from the outline it describes (TODO 89). NOT the same number as
// makeJumper's `width` default, which is only a fallback size and is
// unrelated.
export const JUMPER_TIP_CONE_F = 0.9;
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
    [reach + w2 * JUMPER_TIP_CONE_F, 0], // the V beak's point
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
// ---------------------------------------------------------------------------
// Saw coupling — a Breguet-style one-way FACE coupling: two rings on one
// axis, each carrying N axial saw teeth, drive faces bearing in one relative
// sense and ramps camming the pair apart in the other. This is the stem's
// one-way in a real keyless works (winding pinion ⇄ sliding pinion), filed
// by timesim's TODO 50; the builder is deliberately MOVEMENT-INDEPENDENT so
// the alarm stem's instance of the same debt can consume it later.
//
// The spec is solved here (genevaSpec's pattern) and every quantity carries
// its constraint:
//   · toothH is DERIVED from the ramp angle, never chosen: the ramp must cam
//     decisively rather than marginally, so tan α = rampOverFriction · μ
//     (twice the friction cone by default — at the cone's edge camming and
//     jamming are the same event), and the rise across the ramp's own arc at
//     the mean radius is toothH = tan α · (2π·rMean/N) · rampFrac.
//   · valleyFrac > tipFrac ON PURPOSE: the tooth is narrower than its socket
//     by (valleyFrac − tipFrac) of a pitch, which is the coupling's BACKLASH
//     — under drive the faces bear and the ramps hold daylight, so the only
//     coplanar working contact is the pair the consumer declares. A
//     zero-backlash cut would seat ramp-on-ramp and face-on-face at once,
//     the coplanar-solids case every proximity instrument misreads.
//   · the same profile law feeds the BUILDER, the consumer's tick law and
//     any battery measure (sawCouplingLiftAt) — one arithmetic, so pose and
//     metal cannot disagree (§61/§99's rule).
// ---------------------------------------------------------------------------
// The SPEC and its two laws live in layout.js (the dimensions module) —
// layout's keyless solve needs the tooth height to place the sliding
// clutch's stroke, and geometry.js already imports layout, so the one
// arithmetic sits at the bottom of that edge. Re-exported here so builder
// consumers keep a single import surface.
import { sawCouplingSpec, sawProfileAt, sawCouplingLiftAt } from './layout.js';
export { sawCouplingSpec, sawProfileAt, sawCouplingLiftAt };

// The coupling ring as a closed, indexed solid: an annulus rIn..rOut of
// thickness baseT with the saw profile standing on its +Z face. Every body
// capped (the parity-raycast rule — an open mesh reads as a colliding one);
// the drive face falls out of the sweep naturally as the duplicated-azimuth
// quad where the profile steps. Mount the mate facing (π about a diameter);
// `sense: -1` mirrors the profile for a pair whose drive direction must run
// the other way without a flip.
// rIn/rOut overrides: the MATING ring of a pair is cut radially INSET (a
// male/female fit) so the two rings' cylindrical walls never share a
// surface — identical radii put both walls on one cylinder through the
// interleaved band, and coincident surfaces are the case every proximity
// instrument misarbitrates (the pair read as buried by its own interleave).
// The PROFILE still comes from the shared spec, so complementarity holds.
export function makeSawCoupling({ spec, baseT, material, sense = 1, name = 'sawCoupling',
                                  rIn = spec.rIn, rOut = spec.rOut }) {
  const { teeth } = spec;
  const pos = [], idx = [];
  const ring = [];                              // [{theta, z}] — duplicated theta at each drive face
  // KNOT-ALIGNED azimuth samples: the profile is piecewise linear, so a
  // sample set that lands exactly on its knees (valley→ramp, ramp→tip)
  // makes the built surface EQUAL to sawProfileAt everywhere, not a chord
  // of it — the law the tick and the battery read is the metal, to the
  // vertex. Uniform sampling would leave the knees proud of the law by a
  // chord's height, which is exactly the build-vs-law drift §99's relief
  // discipline exists to keep out.
  // Sample plan per tooth: the valley flat's midpoint, the ramp's facets
  // (knee-aligned), the tip flat's midpoint, the drive face's TOP at the
  // pitch boundary, and its BOTTOM a hairline of arc past it — §99's
  // faceRelief idiom. The lean does two jobs at once: the face stays a
  // real (near-vertical) surface instead of a duplicated azimuth, so
  // every quad in the sweep is non-degenerate — a zero-area sliver at a
  // duplicated azimuth flips the parity raycast that arbitrates every
  // boolean intersection, exactly the way an open mesh does (measured:
  // the cammed poses read BURIED by their own interleave, tracking
  // H − lift, with the metal 0.003 clear) — and it cuts the metal
  // strictly INSIDE the shared profile law, the conservative side for
  // every contact the instruments measure against it.
  const FACE_LEAN = 0.004; // rad of arc the face's foot trails its crest — a hairline, an order under any working tolerance
  const fr = [];
  fr.push(spec.valleyFrac / 2);                                 // valley flat
  const RSUB = 8;                                               // ramp facets (straight law — cosmetic count only)
  for (let s = 0; s <= RSUB; s++) fr.push(spec.valleyFrac + (s / RSUB) * spec.rampFrac);
  fr.push(1 - spec.tipFrac / 2);                                // tip flat
  for (let t = 0; t < teeth; t++) {
    for (const v of fr) {
      const theta = sense * ((t + v) / teeth) * Math.PI * 2;
      ring.push({ theta, z: baseT + sawProfileAt(spec, v) });
    }
    const thetaF = sense * ((t + 1) / teeth) * Math.PI * 2;
    ring.push({ theta: thetaF - sense * FACE_LEAN, z: baseT + spec.toothH }); // face crest, pulled the hairline BACK from the boundary (metal stays inside the law)
    ring.push({ theta: thetaF, z: baseT });                                   // face foot, on the pitch boundary
  }
  const S = ring.length;
  // 4 vertices per sample: (rIn,0) (rOut,0) (rOut,zTop) (rIn,zTop)
  for (const smp of ring) {
    const c = Math.cos(smp.theta), s = Math.sin(smp.theta);
    pos.push(rIn * c, rIn * s, 0, rOut * c, rOut * s, 0,
             rOut * c, rOut * s, smp.z, rIn * c, rIn * s, smp.z);
  }
  const quad = (a, b, c, d) => { idx.push(a, b, c, a, c, d); };
  for (let i = 0; i < S; i++) {
    const j = (i + 1) % S;
    const A = i * 4, B = j * 4;
    quad(A + 1, A + 0, B + 0, B + 1);   // bottom cap (faces −z)
    quad(A + 2, A + 3, B + 3, B + 2);   // top surface / drive face
    quad(A + 0, A + 3, B + 3, B + 0);   // inner wall (faces −r)
    quad(A + 1, B + 1, B + 2, A + 2);   // outer wall (faces +r)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material || MATS.steel);
  m.name = name;
  return m;
}

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

// ---------------------------------------------------------------------------
// COLUMN-WHEEL DRIVE (§163) — the two members that stand between a case
// pusher's straight stroke and a column wheel's index.
//
// The DRIVER pivots on the wheel's own arbor, so on the drive stroke it and
// the wheel turn together about one axis and there is no relative motion to
// foul. It is reached by a PIN IN A RADIAL SLOT: a radial slot makes the
// driver's angle the pin's AZIMUTH about that arbor, which is what fixes the
// pusher's offset (the consumer derives it — d = travel / (2·tan(step/2)) —
// and the slot's radii here are the pin's own reach over the stroke). Its
// second arm carries the PAWL's pivot post, which has to stand outside the
// saw's tip circle because it rises through the tooth band to reach it.
//
// The PAWL is a shaped member, not a bar. It is the only part of the driver
// inside the tooth annulus, and on the return it sweeps a whole tooth
// backwards relative to the wheel — out over one tip, into the next corner.
// A straight bar cannot do that (measured: it fouls at every workable pivot
// radius); the centreline that can is mapped through the swept free region
// and arrives here as data, so the metal and the measurement cannot drift
// apart. `userData.outline` is the cut shape, which is what an instrument
// should sweep — not a proxy for it.
// ---------------------------------------------------------------------------

// Thicken a centreline into a simple closed outline, MITRED at the joins.
// Mitring is exact for a polyline (the offset lines' intersection), unlike a
// round join it adds no sampling, and unlike a per-segment box it puts no
// corner outside the offset — the outline is exactly the half-plane
// intersection the segments define. The inner miter reaches w/sin(θ/2) into
// the corner, so a segment shorter than that would fold: asserted, because a
// folded outline extrudes into a solid nobody can measure.
export function thickenPolyline(nodes, w, name = 'polyline') {
  const n = nodes.length;
  const seg = [];
  for (let i = 0; i + 1 < n; i++) {
    const [x0, y0] = nodes[i], [x1, y1] = nodes[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    seg.push({ len, nx: -(y1 - y0) / len, ny: (x1 - x0) / len });
  }
  for (let i = 1; i + 1 < n; i++) {
    const a = seg[i - 1], b = seg[i];
    const d = 1 + a.nx * b.nx + a.ny * b.ny;
    const reach = w * Math.hypot(a.nx + b.nx, a.ny + b.ny) / d;
    if (reach > Math.min(a.len, b.len))
      console.warn(`§163: ${name}'s miter at node ${i} reaches ${reach.toFixed(3)} into segments of ${Math.min(a.len, b.len).toFixed(3)} — the outline folds`);
  }
  const side = (sgn) => {
    const out = [[nodes[0][0] + sgn * w * seg[0].nx, nodes[0][1] + sgn * w * seg[0].ny]];
    for (let i = 1; i + 1 < n; i++) {
      const a = seg[i - 1], b = seg[i];
      const d = 1 + a.nx * b.nx + a.ny * b.ny;
      out.push([nodes[i][0] + sgn * w * (a.nx + b.nx) / d, nodes[i][1] + sgn * w * (a.ny + b.ny) / d]);
    }
    out.push([nodes[n - 1][0] + sgn * w * seg[n - 2].nx, nodes[n - 1][1] + sgn * w * seg[n - 2].ny]);
    return out;
  };
  return side(1).concat(side(-1).reverse());
}

// The DRIVER: a hub bored for the wheel's arbor, one arm out to the pawl
// post's boss, and a radial SLOT cut in that arm for the pusher's pin. The
// outline is the hull of the two discs — the two external tangent lines plus
// each disc's own arc, which is the shape a lever between two bearings has.
export function makeColumnDriver({ boreR, hubR, arms, slot,
                                   thickness, material = MATS.blueSteel, name = 'columnDriver' }) {
  // The outline is the HULL OF DISCS: the hub, plus one tip disc per arm —
  // the shape a lever between bearings has.
  //
  // TODO 103 — IT USED TO BE CUT BY A RULE THAT CANNOT HOLD. The old
  // construction walked the arms in azimuth order and, per arm, emitted the
  // arm's tip arc and then a hub arc across to the next arm's tangent:
  //
  //     let a0 = a.az + th, a1 = nxt.az - thN;
  //     while (a1 < a0) a1 += Math.PI * 2;      // ← the defect
  //
  // `th = π/2 + asin((hubR − tipR)/reach)` is the right external-tangent
  // angle and is ALWAYS greater than π/2, so `th_a + th_b` always exceeds π.
  // A hub arc is exposed in a gap only when the gap is wider than that sum,
  // and the gaps around a driver sum to 2π — so **at most one gap can ever
  // show hub**, whatever the arms' azimuths and however many there are. The
  // loop emitted one arc per arm regardless, and `a1 < a0` — which is the
  // geometry saying "no hub between these two" — was read as a negative sweep
  // to be normalised, so the arc got drawn the long way round the back.
  // Measured on the shipped two-armed driver: 31 self-intersections, two hub
  // arcs overlapping across ≈164° of hub (TODO 100's sweep found it; the fork
  // in §175 was the same class).
  //
  // Note what the old assert below did NOT cover. `hubR > tipR` is the
  // condition the `asin` needs — it guards the ARITHMETIC — and it passed on
  // a folded outline every time. There is no spacing condition to assert in
  // its place, because there is no spacing that makes the old rule right.
  //
  // So the boundary is taken as what it was always described as: the convex
  // hull of the discs. Each disc is sampled and the hull of the cloud is
  // walked (monotone chain), which cannot self-intersect — a convex polygon
  // is simple by construction — and needs no case analysis about which gaps
  // show hub. The cost is that the tangents are now sampled rather than
  // closed-form; at DISC_SEGS the chord error is below 1.3e-3 u on the
  // largest disc here, against arcs the old code already sampled at 20
  // segments. An exact gift-wrap over the discs would remove even that, and
  // would be worth it only if a tangent ever became a working surface.
  const A = arms.slice().sort((a, b) => a.az - b.az);
  for (const a of A) if (hubR <= a.tipR) console.warn(`§163: ${name}'s hub ${hubR.toFixed(3)} is not larger than the tip ${a.tipR.toFixed(3)} of its arm at ${(a.az * 180 / Math.PI).toFixed(1)}° — the tangent construction assumes it`);
  const DISC_SEGS = 96;
  const discs = [{ cx: 0, cy: 0, r: hubR, what: 'hub' }];
  for (const a of A) discs.push({ cx: a.reach * Math.cos(a.az), cy: a.reach * Math.sin(a.az),
    r: a.tipR, what: `arm at ${(a.az * 180 / Math.PI).toFixed(1)}°` });
  const cloud = [];
  for (const d of discs) for (let i = 0; i < DISC_SEGS; i++) {
    const t = (2 * Math.PI * i) / DISC_SEGS;
    cloud.push([d.cx + d.r * Math.cos(t), d.cy + d.r * Math.sin(t)]);
  }
  // Monotone chain, wound CCW.
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sorted = cloud.slice().sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  const pts = lower.concat(upper);
  // A disc that never reaches the hull is an arm swallowed by the body — the
  // caller asked for a feature that does not exist in the metal, and no sweep
  // downstream can tell that from a part that was never asked for.
  for (const d of discs) {
    const onHull = pts.some(([x, y]) => Math.abs(Math.hypot(x - d.cx, y - d.cy) - d.r) < 1e-6);
    if (!onHull) console.warn(`§163/TODO 103: ${name}'s ${d.what} does not reach the outline — it is inside the hull of the others, so the arm was asked for and not cut`);
  }
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  // The SLOT: a capsule along its arm's azimuth, its ends the pin's own reach
  // at either end of the stroke. Traced rather than absarc'd so the hole stays
  // a polyline, and wound against the shape as a hole must be.
  const { az, inner, outer, halfW } = slot;
  const sp = [];
  const cap = (r, a0) => { for (let i = 0; i <= 12; i++) { const a = a0 + Math.PI * (i / 12); sp.push([r * Math.cos(az) + halfW * Math.cos(az + a), r * Math.sin(az) + halfW * Math.sin(az + a)]); } };
  cap(outer, -Math.PI / 2);
  cap(inner, Math.PI / 2);
  sp.reverse();
  const hole = new THREE.Path();
  sp.forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.userData.outline = pts;
  mesh.userData.slot = { ...slot };
  return mesh;
}

// The PAWL: the mapped centreline thickened, with a bored pivot boss at one
// end and a rounded nose at the other. The nose's radius is the one the free
// region was mapped with — change it and the map no longer describes it.
export function makeColumnPawl({ nodes, pivot, nose, w, noseR, boreR, bossR, thickness,
                                 material = MATS.blueSteel, name = 'columnPawl' }) {
  // The PIVOT BORE is cut, not declared. The repo's older convention is to let
  // a lever's metal swallow its stud and name the overlap in
  // INTRA_UNIT_CONTACTS, and that is a real convention with rows behind it —
  // but here the joint's own running clearance is the number the §137 row
  // quotes, so a solid pawl would have the arithmetic claiming a fit the metal
  // does not have.
  //
  // Which means the ARM cannot run through the pivot. It is 2w across and the
  // post is wider than that, so a centreline through the origin puts the post
  // through the arm's flanks whatever hole is cut in it. The boss is the member
  // that carries the bore; the arm is CLIPPED off a disc of boreR + w around
  // the pivot, so its metal starts exactly where the bore ends, and the runs on
  // either side (the tail, and the arm proper) become their own bodies — still
  // one part, because each still laps well inside the boss.
  const clipR = boreR + w;
  const dOf = (q) => Math.hypot(q[0] - pivot[0], q[1] - pivot[1]);
  const runs = [];
  let cur = [];
  for (let i = 0; i < nodes.length; i++) {
    const inHere = dOf(nodes[i]) >= clipR;
    if (inHere) cur.push(nodes[i]);
    if (i + 1 === nodes.length) break;
    const inNext = dOf(nodes[i + 1]) >= clipR;
    if (inHere === inNext) continue;
    // bisect the crossing so the clipped end lands ON the disc
    let a = nodes[i], b = nodes[i + 1];
    for (let k = 0; k < 24; k++) {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if ((dOf(m) >= clipR) === inHere) a = m; else b = m;
    }
    const cut = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (inHere) { cur.push(cut); runs.push(cur); cur = []; } else cur = [cut];
  }
  if (cur.length > 1) runs.push(cur);
  const bodies = runs.filter((r) => r.length > 1).map((r, i) => {
    const outline = thickenPolyline(r, w, `${name}#${i}`);
    const sh = new THREE.Shape();
    outline.forEach(([x, y], k) => (k === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y)));
    sh.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: thickness, bevelEnabled: false }), material);
    m.name = i === 0 ? `${name}Tail` : name;
    m.userData.outline = outline;
    m.userData.centreline = r;
    return m;
  });
  if (bodies.length !== 2)
    console.warn(`§163: ${name}'s centreline clipped into ${bodies.length} runs around its bore, not the tail and the arm — the spring has nothing to bear on, or the arm is severed`);
  const end = nodes[nodes.length - 1];
  if (Math.hypot(nose[0] - end[0], nose[1] - end[1]) > w + noseR)
    console.warn(`§163: ${name}'s nose at (${nose}) is ${Math.hypot(nose[0] - end[0], nose[1] - end[1]).toFixed(3)} from its body's last node — more than w + noseR ${(w + noseR).toFixed(3)}, so the nose is not attached`);
  if (bossR <= clipR)
    console.warn(`§163: ${name}'s boss ${bossR.toFixed(3)} does not reach its clipped arms at ${clipR.toFixed(3)} — the pawl is three parts`);
  const bossShape = new THREE.Shape();
  bossShape.absarc(pivot[0], pivot[1], bossR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(pivot[0], pivot[1], boreR, 0, Math.PI * 2, true);
  bossShape.holes.push(hole);
  const boss = new THREE.Mesh(new THREE.ExtrudeGeometry(bossShape, { depth: thickness, bevelEnabled: false }), material);
  boss.name = `${name}Boss`;
  const noseM = new THREE.Mesh(new THREE.CylinderGeometry(noseR, noseR, thickness, 16), material);
  noseM.name = `${name}Nose`;
  noseM.rotation.x = Math.PI / 2;
  noseM.position.set(nose[0], nose[1], thickness / 2);
  return { bodies, mesh: bodies[bodies.length - 1], tail: bodies[0], boss, nose: noseM, bore: boreR };
}

// ---------------------------------------------------------------------------
// HELICAL COMPRESSION SPRING (§164) — the pusher's return, and the first coil
// in this movement that is a helix rather than a planar spiral.
//
// Swept by hand rather than by TubeGeometry, for one reason: every TubeGeometry
// in this repo is built with `closed = false`, which leaves both ends OPEN, and
// an open mesh reads as a COLLIDING one — meshClearance guards its BVH
// near-zeros with a parity raycast, so an odd crossing count reports contact
// with parts nowhere near it (TODO 27 measured exactly that on the chain, at
// 3.7 units of separation). A spring threaded down the middle of the movement
// is the last part that should ship open, so this one caps both ends.
//
// The frame is built from the tangent and the OUTWARD RADIAL rather than by
// Frenet transport: a helix's Frenet normal points at the axis and rolls the
// section as the curve climbs, which twists a round wire harmlessly and would
// twist anything else. Built along local +z; the caller aims it.
export function makeHelicalSpring({ coilR, wireR, coils, length, material = MATS.blueSteel,
                                    name = 'helicalSpring', seg = 6, per = 10 }) {
  const N = Math.max(8, Math.round(coils * per));
  const at = (t) => {
    const a = coils * Math.PI * 2 * t;
    return [coilR * Math.cos(a), coilR * Math.sin(a), length * t];
  };
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [cx, cy, cz] = at(t);
    const e = 0.5 / N;
    const [ax, ay, az] = at(Math.min(1, t + e)), [bx, by, bz] = at(Math.max(0, t - e));
    let tx = ax - bx, ty = ay - by, tz = az - bz;
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let rx = cx, ry = cy, rz = 0;                       // outward from the axis…
    const dp = rx * tx + ry * ty + rz * tz;             // …orthogonalised against the tangent
    rx -= dp * tx; ry -= dp * ty; rz -= dp * tz;
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    const nx = ty * rz - tz * ry, ny = tz * rx - tx * rz, nz = tx * ry - ty * rx;
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2, ca = Math.cos(a) * wireR, sa = Math.sin(a) * wireR;
      pos.push(cx + rx * ca + nx * sa, cy + ry * ca + ny * sa, cz + rz * ca + nz * sa);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < seg; k++) {
      const a = i * seg + k, b = i * seg + (k + 1) % seg;
      const c = (i + 1) * seg + (k + 1) % seg, d = (i + 1) * seg + k;
      idx.push(a, b, c, a, c, d);
    }
  }
  const c0 = pos.length / 3; { const [x, y, z] = at(0); pos.push(x, y, z); }
  const c1 = pos.length / 3; { const [x, y, z] = at(1); pos.push(x, y, z); }
  for (let k = 0; k < seg; k++) idx.push(c0, (k + 1) % seg, k);
  for (let k = 0; k < seg; k++) idx.push(c1, N * seg + k, N * seg + (k + 1) % seg);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.userData.helix = { coilR, wireR, coils, length };
  // §169 — the STOCK this is wound from, for stockCensus: a swept wire's
  // geometry-local box is the coil's envelope, not its section.
  mesh.userData.stockSection = 2 * wireR;
  return mesh;
}

// §169 — A TORSION SPRING: a close-wound helix about a post, with one straight
// leg at each end. The mechanism it exists for is the column wheel's driving
// pawl, where the restoring moment has to act ABOUT the pawl's own pivot; a
// cantilever blade cannot, and §163's did the job through a bear arm off an
// anchor that (measured, §169) stood on nothing at all.
//
// Swept by hand for the same reason §164's compression coil is: every
// TubeGeometry in this file is built `closed = false` and so ships OPEN ends,
// which meshClearance's parity raycast reads as a collision with whatever
// shares its bounding box. Both ends are CAPPED here.
//
// The frame is PARALLEL TRANSPORT, not makeHelicalSpring's outward-from-the-
// axis radial. That reference is exact for a helix and degenerate for a
// straight leg pointing at the axis, and this path is not a helix — it is a
// leg, a helix and a leg. Transporting one normal along the whole path is the
// one rule that holds over all three.
//
// Close-wound, so the height is `coils · 2 · wireR` and the caller owns
// whether that fits its stratum. `coils` is an INTEGER here, which puts both
// leg roots at the same azimuth; a leg that has to end somewhere else is
// BENT, which is what a real torsion spring's legs do and what keeps the
// turn count — the thing the stratum is bought for — a whole number.
//
// Local frame: origin on the coil's axis in the plane of its BOTTOM end, z up
// the axis. `legA` / `legB` are POLYLINES in that frame, listed from the coil
// OUTWARD — one point for a straight leg, two or more for a bent one.
export function makeTorsionSpring({ coilR, wireR, coils, startAz = 0, sense = 1,
                                    legA = [], legB = [], material = MATS.blueSteel,
                                    name = 'torsionSpring', seg = 6, per = 24 }) {
  const height = coils * 2 * wireR;
  const azOf = (t) => startAz + sense * coils * Math.PI * 2 * t;
  const N = Math.max(16, Math.round(coils * per));
  const path = [];
  const coilPt = (t) => [coilR * Math.cos(azOf(t)), coilR * Math.sin(azOf(t)), height * t];
  for (let i = legA.length - 1; i >= 0; i--) path.push([...legA[i]]);   // listed coil-outward, walked inward
  for (let i = 0; i <= N; i++) path.push(coilPt(i / N));
  for (const q of legB) path.push([...q]);
  // Drop any duplicate consecutive point: a zero-length segment has no
  // tangent, and the transport below would carry a NaN frame the whole way.
  const pts = path.filter((p, i) => i === 0
    || Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1], p[2] - path[i - 1][2]) > 1e-9);
  const tan = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(...v) || 1;
    return [v[0] / L, v[1] / L, v[2] / L];
  });
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (v) => { const L = Math.hypot(...v) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  // seed a normal perpendicular to the first tangent, from whichever axis is
  // least parallel to it
  let seed = Math.abs(tan[0][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let nrm = unit(cross(tan[0], seed));
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    if (i) {
      // rotate the carried normal by the same rotation that takes tan[i-1] to
      // tan[i] — the discrete rotation-minimising frame
      const ax = cross(tan[i - 1], tan[i]);
      const s = Math.hypot(...ax);
      if (s > 1e-12) {
        const k = unit(ax), th = Math.atan2(s, dot(tan[i - 1], tan[i])), c = Math.cos(th), sn = Math.sin(th);
        const kn = cross(k, nrm), kd = dot(k, nrm);
        nrm = unit([nrm[0] * c + kn[0] * sn + k[0] * kd * (1 - c),
                    nrm[1] * c + kn[1] * sn + k[1] * kd * (1 - c),
                    nrm[2] * c + kn[2] * sn + k[2] * kd * (1 - c)]);
      }
    }
    const bin = cross(tan[i], nrm);
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2, ca = Math.cos(a) * wireR, sa = Math.sin(a) * wireR;
      pos.push(pts[i][0] + nrm[0] * ca + bin[0] * sa,
               pts[i][1] + nrm[1] * ca + bin[1] * sa,
               pts[i][2] + nrm[2] * ca + bin[2] * sa);
    }
  }
  for (let i = 0; i + 1 < pts.length; i++)
    for (let k = 0; k < seg; k++) {
      const a = i * seg + k, b = i * seg + (k + 1) % seg;
      const c = (i + 1) * seg + (k + 1) % seg, d = (i + 1) * seg + k;
      idx.push(a, b, c, a, c, d);
    }
  const last = (pts.length - 1) * seg;
  const c0 = pos.length / 3; pos.push(...pts[0]);
  const c1 = pos.length / 3; pos.push(...pts[pts.length - 1]);
  for (let k = 0; k < seg; k++) idx.push(c0, (k + 1) % seg, k);
  for (let k = 0; k < seg; k++) idx.push(c1, last + k, last + (k + 1) % seg);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  // The DEVELOPED LENGTH of the coil alone, accumulated along the very
  // polyline that was swept rather than re-integrated from πDn — one
  // sampling, one answer (makeHairspring's rule). It is what the caller's
  // rate solve turns on, so the two cannot drift.
  let devLen = 0;
  for (let i = 1; i <= N; i++) {
    const a = coilPt((i - 1) / N), b = coilPt(i / N);
    devLen += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  mesh.userData.torsion = { coilR, wireR, coils, height, devLen, startAz, sense };
  mesh.userData.stockSection = 2 * wireR;   // §169 — see makeHelicalSpring: the wire, not the envelope
  return mesh;
}

// `reverse` mirrors the saw (teeth lean the other way): a ratchet's
// orientation is not a style — the RAMP must be the flank the working
// direction climbs and the steep FACE the flank that catches the reverse,
// and which way round that is depends on the consumer's own drive sign.
// §101 added it when the alarm arbor's ratchet measured BACKWARD: winding
// climbed the face and slid down the ramp, and no instrument gates
// one-way-ness, so every check stayed green while the saw ran inverted.
// The mirror maps (x, y) → (x, −y) with the point order reversed, so the
// outline still winds the same way and the extrude's normals are untouched.
export function makeRatchetAndClick({ radius, teeth = 24, thickness, includeClick = true, squareBore = null, reverse = false }) {
  const g = new THREE.Group();
  const rShape = new THREE.Shape();
  const outline = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.72) / teeth) * Math.PI * 2;
    outline.push([Math.cos(a0) * radius * 0.8, Math.sin(a0) * radius * 0.8]);
    outline.push([Math.cos(a1) * radius, Math.sin(a1) * radius]);
  }
  if (reverse) { for (const p of outline) p[1] = -p[1]; outline.reverse(); }
  rShape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) rShape.lineTo(outline[i][0], outline[i][1]);
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
    // §99 — the saw's OUTLINE, exported the way the column wheel's is: a
    // caller derives its click's parked kiss by casting against the same
    // polygon the teeth were cut from (a park measured once is valid only
    // at the azimuth it was measured at), and a caller that wants the
    // schematic to draw the CUT rather than a pitch-circle claim builds its
    // userData.profile from this. Root→tip chord over 0.72 of the pitch,
    // face over the last 0.28 — main.js's sawRadiusAt is the analytic twin
    // (a `reverse` cut mirrors the mapping's sign, not the shape function).
    g.userData.ratchetPoly = outline.map((p) => [p[0], p[1]]);
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
//
// tiltAt (§124, TODO 46): the chain's tilt law β(f) — the caller's
// fuseeBetaAt — and with it the cut stops assuming a vertical stack. A
// β-tilted stack (half-stack h = reliefHalf along the pin, half-width
// w = grooveD across the plates, top tipping INBOARD so the plates lie on
// the flank) has its meridian rectangle rotated by β, and the single-valued
// lathe law that accepts every such box is the INNER-BOTTOM-CORNER LOCUS:
//
//   station z_c solves  z_c = z + w·sinβ(z_c) + h·cosβ(z_c)
//   floorAt(z) = env(f(z_c)) − (w·cosβ(z_c) − h·sinβ(z_c))
//
// At β = 0 this is EXACTLY the vertical law above (z_c = z + h, depth w), so
// it is a generalization, not a second branch. Why the corner locus is the
// whole law (verified against a brute-force min-over-boxes envelope, worst
// deviation < 1e-3 everywhere the chain rides): at lie-flat (β = atan m) the
// stack's inner face is PARALLEL to the locus and contains the corner, so
// cutting the locus seats the face — both crown edges touch; where the cap
// β* = atan(w/h) binds (m > w/h, the first ~2% of the band) the corner is
// the deepest feature and the inner-top crown stands off w·cosβ*·(m − w/h)
// ≈ 0.024 measured (0.032 linearized), inside the §61 float budget. The
// envelope's own convexity keeps every face chord OUTSIDE the locus between
// its corners. The station domain deliberately runs PAST f = 1 into the tip
// runout (env is evaluated there; β clamps to the band edge) so the top
// wrap's box is accepted by real stations rather than a flat clamp; the
// runout's own fictional boxes over-tilt slightly (β held while the flank
// flattens) but no chain ever rides above f = F_ACTIVE, so that residue is
// cosmetic by construction.
export function makeFusee({ rSmall, rLarge, height, grooveTurns = 5,
                            grooveW, grooveD, bandZ0, bandSpan, envR = null,
                            reliefHalf = 0, tiltAt = null }) {
  const g = new THREE.Group();
  // Legacy proportions when the caller doesn't specify the cut (test pages).
  if (grooveD === undefined) grooveD = Math.min((rLarge - rSmall) * 0.1, 0.5);
  if (grooveW === undefined) grooveW = (0.88 * height) / grooveTurns * 0.8;
  if (bandZ0 === undefined) bandZ0 = height * 0.06;
  if (bandSpan === undefined) bandSpan = height * 0.88;
  const env = envR || ((f) => rLarge + (rSmall - rLarge) * f); // land-crest envelope
  // The relieved groove floor — ONE law for the seat, the band and the tip
  // runout, shared with the §61 seating/float instruments via userData.groove
  // so the cut and the check cannot drift apart: they hold the same closure.
  // With tiltAt it is the corner-locus law derived in the header; without it,
  // the vertical-stack shear (the corner-locus law at β ≡ 0, kept as its own
  // closed form so the legacy/test path stays bit-identical).
  const floorAt = tiltAt
    ? (z) => {
        const h = reliefHalf, w = grooveD;
        let zc = z + Math.hypot(h, w), b = 0;
        for (let i = 0; i < 4; i++) {   // fixed point: drop(β) varies slowly, 4 iterations land < 1e-9
          b = tiltAt(Math.min(Math.max((zc - bandZ0) / bandSpan, 0), 1));
          zc = z + w * Math.sin(b) + h * Math.cos(b);
        }
        return env(Math.max((zc - bandZ0) / bandSpan, 0)) - (w * Math.cos(b) - h * Math.sin(b));
      }
    : (z) => env(Math.min(Math.max((z - bandZ0 + reliefHalf) / bandSpan, 0), 1)) - grooveD;
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
  const NCORE = tiltAt ? 96 : envR ? 48 : 12;
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
  // §124: under the tilt law the floor is CURVED below bandZ0 too (the low
  // boxes' faces govern the collar), so the tilted profile is lathed from
  // z = 0; the vertical law is flat there and keeps its band-only stations.
  const zProfile0 = tiltAt ? 0 : bandZ0;
  for (let i = 0; i <= NCORE; i++) {
    const z = zProfile0 + (bandZ0 + bandSpan - zProfile0) * (i / NCORE);
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
  // §124 (TODO 46): the channel each wrap claims is its tilted stack's
  // z-footprint, ±drop(β) = ±(w·sinβ + h·cosβ) about the groove point (at
  // β = 0 this is ±reliefHalf, i.e. the passed grooveW = stack + clearance),
  // plus the same seating clearance grooveW carries over the vertical stack.
  // The land is what the pitch leaves between the wrap below and the wrap
  // above — an ASYMMETRIC window, since β falls with height — and near the
  // base the tilted footprint (~1.48 at the cap) exceeds the 1.389 pitch:
  // the channels MERGE and there is honestly no land to cut there. The §124
  // adjacent-turn boot assert (main.js) is what holds the CHAINS apart on
  // that stretch, exactly as the header note below says the base of a real
  // steep-flanked fusee works.
  const h = reliefHalf, w = grooveD;
  const seatClear = (grooveW - 2 * reliefHalf) / 2;   // = 0.005 on the shipped stock
  const dropAt = (f) => {
    if (!tiltAt) return reliefHalf;
    const b = tiltAt(Math.min(Math.max(f, 0), 1));
    return w * Math.sin(b) + h * Math.cos(b);
  };
  // The crest exists BETWEEN wraps: grooveTurns grooves have grooveTurns−1
  // lands, so the helix stops half a pitch short of the band's top — a
  // full-length run poked 0.2 past the cone's tip and it was the plate
  // floor's boot assert that caught it.
  const SEG = (grooveTurns - 1) * 48;
  const pos = [], idx = [];
  // 4 rails per station: (floor,lo) (env,lo) (env,hi) (floor,hi).
  // `open` tracks strip continuity: a merged-channel station emits nothing
  // and breaks the quad strip, so no degenerate slivers bridge the gap.
  let open = false;
  for (let i = 0; i <= SEG; i++) {
    const t = i / (grooveTurns * 48);
    const a = t * grooveTurns * Math.PI * 2;
    const zg = bandZ0 + bandSpan * t;                     // groove point of the wrap below
    const zLo = zg + dropAt(t) + seatClear;               // top of the lower wrap's channel
    const zHi = zg + pitch - dropAt(t + 1 / grooveTurns) - seatClear; // bottom of the upper wrap's
    if (zHi - zLo < 0.02) { open = false; continue; }     // channels merged — no land here
    const zc = (zLo + zHi) / 2;
    // Envelope evaluated at the land's OWN z, not the groove's t below it —
    // half a pitch up a cone this steep is ~0.6 of radius, and sampling the
    // lower station left the crest that far proud on the uphill side.
    const fLand = (zc - bandZ0) / bandSpan;
    // Inner rail on the RELIEVED floor (at zHi, the shallower end, so the
    // rail meets the floor there and embeds at zLo — a crest never floats);
    // outer rail at the envelope, capped by §54's build-to proportion
    // (SLENDER_TARGET · width — layout.js, the same number the slenderness
    // check enforces). Un-relieved, full height is grooveD and the cap never
    // binds (0.66 < 27·0.025). Relieved, the crest at the steep base would
    // be grooveD + relief over a hairline width — λ far past §54's 30
    // (TODO 32's flank bends harder at the base than the hyperbola this
    // first shipped against) — so it honestly stops short of the envelope
    // there: on that stretch the chain is retained by the step of the turn
    // below (the un-relieved metal between wraps) and by its own departing
    // tangent, which is what the base of a real steep-flanked fusee looks
    // like. A fin nobody could cut is not a land.
    const rIn = floorAt(zHi);
    const rOut = Math.min(env(fLand), rIn + SLENDER_TARGET * (zHi - zLo));
    const ca = Math.cos(a), sa = Math.sin(a);
    const base = pos.length / 3;
    for (const [r, z] of [[rIn, zLo], [rOut, zLo], [rOut, zHi], [rIn, zHi]])
      pos.push(ca * r, sa * r, z);
    if (open) {
      const b = base - 4, c = base;
      for (const k of [0, 1, 2]) idx.push(b + k, c + k, c + k + 1, b + k, c + k + 1, b + k + 1);
    }
    open = true;
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
  // §124: envAt (the land-crest envelope closure) and tiltAt ride along so
  // probes can re-derive the wrap's radial window from the live cut instead
  // of quoting stale literals (tools/probe-chain-daylight.mjs).
  g.userData.groove = { bandZ0, bandSpan, grooveD, grooveW, floorAt, envAt: env, tiltAt };
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
    // §104 — held at float noise, not at strict <: the affine term IS the
    // bind, so analytically pitch = pBind + S·[((a+2π)/A)^k − (a/A)^k] ≥
    // pBind always (S > 0, the bracket is monotone). At deep winds the
    // k-solve runs the distribution term to underflow on the inner coils
    // ("the coils come down to bind and simply stay there"), and the
    // measured difference is pure cancellation noise — the alarm barrel's
    // 4.25-turn set-up total measures minPitch − pBind = −1.9e-16 against a
    // 0.19 ribbon. 1e-9 is the equalisation level product's own float-noise
    // convention; a REAL pass-through (a law change, not an underflow) is
    // orders of magnitude past it.
    if (wind.minPitch < wind.pBind - 1e-9)
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

export function makeThreeQuarterPlate({ radius, thickness, cut: cutIn, holes = [], slots = [], windows = [], polyHoles = [] }) {
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
  // polyHoles are openings whose outline is not a circle, a stadium or a
  // §62 window: today, the chaton counterbores, each drawn as ONE closed
  // curve merging the chaton's bore with its screw seats (§132). They are
  // deliberately NOT `windows` — `checkPlateWindows` gates that list for
  // reveal edges and TQ_LAND_MIN webs, and a counterbore is neither — and
  // deliberately not three overlapping circular `holes`, because
  // ExtrudeGeometry triangulates overlapping holes into phantom plate rather
  // than failing, which is the failure mode the web check below exists to
  // catch. Same bevel treatment as a window: the opening grows outward.
  polyHoles = polyHoles.map((w) => ({ ...w, pts: offsetPolygon(w.pts, bevelSize) }));
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
  for (const w of [...windows, ...polyHoles]) {
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
// §148 — AND THERE ARE TWO HOLES, because there are two joints. A screw that
// PASSES THROUGH a member wants a CLEARANCE hole: the member is not what
// holds it, and screwBoreR is that hole. A screw that THREADS INTO a member
// wants a TAPPED hole, and a tapped hole is not a clearance hole — the
// thread's flanks bear on the metal, so the hole is the thread's own radius
// and the two parts are assembled TOUCHING, the way every other seat in this
// movement is. §148 found the chaton screws boring the second joint as the
// first: a screw standing in a hole one seat fit too wide to grip, which is
// what "no thread to tighten into" looks like when you cut it.
export const screwTapR = (headR) => screwShankR(headR);
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
// §148 — a TAPPED shank is DRAWN threaded. Not as a helix: a helix is a great
// deal of geometry for a 0.4 mm screw, and it would be the only helix in the
// movement. What is drawn is the thread's CRESTS — the rings a thread's
// section shows, which is what a thread looks like cut through and reads as
// one from any angle. Pitch is the fine-screw proportion, a quarter of the
// thread's diameter (a real 0.4 mm watch screw runs 0.1 mm), and the depth is
// ISO's 0.61·pitch, so the crests come out exactly at screwShankR and the
// tapped hole bored at that radius meets them.
const THREAD_PITCH_PER_DIA = 0.25;
const THREAD_DEPTH_PER_PITCH = 0.61;
export function makeScrews({ at, headR, headT, taper = 0.92, seg = 16 }) {
  const heads = [], slots = [], shanks = [];
  // §77 — sub-body names for mergeGeos' declaration: each merged mesh's
  // bodies are per SCREW, so the name is the screw's index in `at`. A
  // tapped shank pushes core + crests under one name and mergeGeos
  // coalesces the consecutive run into one range — one screw, one body.
  const headNames = [], slotNames = [], shankNames = [];
  for (let si = 0; si < at.length; si++) {
    const p = at[si];
    const r = p.headR ?? headR;
    heads.push(new THREE.CylinderGeometry(r, r * taper, headT, seg)
      .rotateX(Math.PI / 2).translate(p.x, p.y, p.z - headT / 2));
    headNames.push(`screw#${si}`);
    // Slot proportions are the chaton's: 1.7r long (inside the 2r head),
    // 0.28r wide, 0.35·headT deep.
    //
    // §148 — AND IT BREAKS THE SURFACE, which it never did. The box was
    // centred 0.28·headT below the top face, so its own top face came out
    // 0.033 UNDER the head's: a dark inlay buried inside an opaque solid,
    // drawn for every screw in the movement and visible on none of them.
    // Every screw here has rendered as a featureless disc since §20, which is
    // why they read as bored holes rather than as fasteners. The slot is a
    // RECESS shown as a dark film (`STOCK_KIND_BY_MESH`: marking, not stock),
    // so what it wants is to be flush with the face it is cut into — and a
    // hair proud of it rather than coplanar, because coplanar faces z-fight
    // (makeJewelSetting's rim is set the same way). The hair is §102's
    // float-bind centi-unit, and it is two orders under the 0.18 the hack
    // blade passes over this face.
    const slotD = headT * 0.35;
    slots.push(new THREE.BoxGeometry(r * 1.7, r * 0.28, slotD)
      .rotateZ(p.a || 0).translate(p.x, p.y, p.z - slotD / 2 + 0.01));
    slotNames.push(`screw#${si}`);
    if (p.shank) {
      const sr = screwShankR(r);
      if (!p.tapped) {
        shanks.push(new THREE.CylinderGeometry(sr, sr, p.shank, Math.max(8, seg / 2))
          .rotateX(Math.PI / 2).translate(p.x, p.y, p.z - headT - p.shank / 2));
        shankNames.push(`screw#${si}`);
      } else {
        // Core at the thread's ROOT, crests as rings on it: closed solids
        // both, so the shank stays one welded body and no lathe runs to its
        // own axis (three.js collapses that to zero-area faces, and TODO 27's
        // parity raycast is not something to hand degenerate triangles).
        const pitch = 2 * sr * THREAD_PITCH_PER_DIA;
        const depth = THREAD_DEPTH_PER_PITCH * pitch;
        const core = sr - depth;
        shanks.push(new THREE.CylinderGeometry(core, core, p.shank, Math.max(8, seg / 2))
          .rotateX(Math.PI / 2).translate(p.x, p.y, p.z - headT - p.shank / 2));
        shankNames.push(`screw#${si}`);
        // Each crest OVERLAPS the core rather than sitting tangent on it: a
        // ring whose inner extent lands exactly on the core's surface is two
        // coincident cylinders, which is the artefact this whole entry has
        // been chasing. Outer extent is still exactly `sr`, which is what the
        // tapped hole is bored to.
        for (let z = pitch / 2; z < p.shank; z += pitch) {
          shanks.push(new THREE.TorusGeometry(core + depth / 4, depth * 0.75, 6, Math.max(8, seg / 2))
            .translate(p.x, p.y, p.z - headT - z));
          shankNames.push(`screw#${si}`);
        }
      }
    }
  }
  const g = new THREE.Group();
  const headsMesh = new THREE.Mesh(mergeGeos(heads, headNames), MATS.blueSteel);
  headsMesh.name = 'screwHeads';
  g.add(headsMesh);
  // Named for §50's kind table: a slot is a RECESS rendered as a dark
  // inlay — void, not stock — the same class as the disc's printed track.
  const slotsMesh = new THREE.Mesh(mergeGeos(slots, slotNames), MATS.dark);
  slotsMesh.name = 'screwSlots';
  g.add(slotsMesh);
  if (shanks.length) {
    const shanksMesh = new THREE.Mesh(mergeGeos(shanks, shankNames), MATS.blueSteel);
    shanksMesh.name = 'screwShanks';
    g.add(shanksMesh);
  }
  return g;
}

// Chaton PROPORTIONS, exported because the plate has to cut the counterbore
// before any chaton exists to measure: `main.js`'s opening radius was
// `boreR + 0.95` with a comment naming this builder, i.e. a hand-copy of two
// numbers that live here — standing rule 1's own failure mode, harmless only
// while the builder was called by nothing (§132). One definition, and every
// consumer reads it.
//
// §148 — THE STONE IS ONE STONE, and it is a property of the PIVOT, not of
// the mounting. A chaton and a rubbed-in setting are two ways of holding the
// SAME pressed jewel: the ruby is bought to a size, and screwing it into gold
// rather than rubbing it into nickel does not make it a smaller ruby. This
// was two independent numbers — the flush settings cut their counterbore at
// `boreR + 0.95` while the chaton pressed a `boreR + 0.40` stone — so §132's
// three chatons SHRANK their stones by a third at the moment they landed,
// which is what they visibly did. One definition now, and its value is the
// flush setting's, so the stone does not move.
export const JEWEL_RIM_W = 0.95;         // stone's rim outside the pivot bore
export const jewelOuterR = (boreR) => boreR + JEWEL_RIM_W;
// TODO 12's stone thickness, as a fraction of the chaton's own. It is a
// CONSTRAINT INPUT, not decoration: the host's counterbore depth is solved
// against it (see CHATON_DEPTH at the three-quarter plate), so a change here
// moves that solve.
export const CHATON_RUBY_FRAC = 0.74;
// The gold RING outside that stone, and its width is the PRESS FIT'S.
//
// Two floors bear on it and neither one sizes it — that is the distinction
// this constant exists to keep. The ring must be at least STOCK_MIN_U of hoop
// (a friction fit is a hoop in tension, and a hoop thinner than the floor is
// not metal you could turn) plus at least CHATON_SCREW_LAP of ledge for the
// heads to lap. Their sum is 0.397 u — 0.150 mm of gold around a 1.137 mm
// stone — and built to it the chaton is a gold OUTLINE: invisible from
// overhead and nothing like the ring a chaton is. Floors say what a part may
// not go below. They are not an answer to how big it is.
//
// What answers that is the fit the ring exists to make. A pressed stone loads
// its ring in HOOP TENSION and Lamé prices the wall directly: the peak hoop
// stress at the bore is p·(b² + a²)/(b² − a²), which is 8.5p at b = 1.125a,
// 4.6p at 1.25a, 2.6p at 1.5a and 1.7p at 2a. The knee is at 1.5, which is
// also the standard interference-fit rule for a ring's outside diameter
// against its bore — and it is where real chatons sit (1.5–1.8 × the stone),
// so the number arrives from the stress and from the practice at once. Taken
// at the knee, which is the thin end of the real band.
export const CHATON_RING_RATIO = 1.5;
export const chatonOuterR = (boreR) => jewelOuterR(boreR) * CHATON_RING_RATIO;
export const chatonRimW = (boreR) => chatonOuterR(boreR) - jewelOuterR(boreR);
// §148 — AND THE COUNTERBORE IS NOT THE CHATON. A chaton is the definitive
// case of TODO 27's rule — a part that DROPS INTO a recess someone cut for it
// — so the recess is cut SEAT_FIT larger, exactly as a jewel is into its
// counterbore and a screw head into its seat. §132 cut the plate at the
// chaton's own radius, which is a press fit for a part meant to lift out and
// two coincident walls for the renderer; there was nothing to SEE because
// there was no well, only a gold disc ending where the nickel began.
export const chatonBoreR = (boreR) => chatonOuterR(boreR) + SEAT_FIT;
// §148 — THE SCREW IS SOLVED, and it is ONE screw at every chaton.
//
// A chaton screw does two things that pull opposite ways. Its body must be in
// METAL — that is what "screwed" means, and §132's screws had no body at all
// because a hole at the counterbore's own rim would have been half void. And
// its head must reach BACK over the chaton's rim, because the head is the
// only thing holding the chaton down. Written out, with R_s the screw
// circle's radius about the pivot:
//
//   the tapped hole clears the COUNTERBORE by a wall of STOCK
//       R_s = chatonBoreR + STOCK_MIN_U + screwTapR(headR)
//   the head laps the CHATON's rim by a RETENTION overlap
//       headR − (R_s − outerR) ≥ SEAT_FIT
//
// and those two are measured to different circles on purpose: the wall is
// plate between two cuts, so it is measured to the cut; the lap is metal the
// head must reach, so it is measured to the metal. The seat fit between them
// is what the chaton's own drop-in costs.
//
// The lap is SEAT_FIT and not a stock floor, and the difference matters —
// it is what sizes the screw. The gold under the head is the ring at its full
// width; the lap is a PLAN dimension, not a section, so §50 has nothing to
// say about it. What it must survive is the chaton sitting as far off centre
// as its own seat allows, which is SEAT_FIT by definition: lap any smaller
// and a chaton pushed to one side is a chaton one screw no longer holds.
//
// screwTapR(headR) = headR/2 (a watch screw's head runs about twice its
// thread across, and a TAPPED hole is the thread's own radius — no clearance,
// because the flanks are what grips), so the two collapse to
//
//   headR/2 − STOCK_MIN_U − SEAT_FIT ≥ SEAT_FIT
//   headR ≥ 2·STOCK_MIN_U + 4·SEAT_FIT
//
// The SMALLEST screw that does the job is the one to fit — every unit of head
// is plate the site does not keep, and at the escape pivot that is the
// difference between a chaton and none — so the inequality is taken at
// equality: 0.9532 u, a 0.72 mm head on a 0.36 mm thread. It is no longer a
// proportion of the chaton at all, which is the point: the going train's 0.55
// bore and the strike arbor's 0.80 take the SAME screw, so widening the
// family cost the movement one part instead of two.
export const CHATON_HEAD_R = 2 * STOCK_MIN_U + 4 * SEAT_FIT;
export const chatonScrewR = (boreR) => chatonBoreR(boreR) + STOCK_MIN_U + screwTapR(CHATON_HEAD_R);
// What falls out of that solve: how far the head laps the chaton's rim. It is
// SEAT_FIT by construction — the equality above.
export const CHATON_SCREW_LAP = CHATON_HEAD_R - SEAT_FIT - STOCK_MIN_U - screwTapR(CHATON_HEAD_R);
// The two floors the press fit has to clear, held rather than assumed: the
// ring is hoop PLUS the ledge the heads lap, and the fit's wall must contain
// both or the number that sizes it is not the one that binds.
for (const boreR of [0.55, 0.80]) {
  const spare = chatonRimW(boreR) - (STOCK_MIN_U + CHATON_SCREW_LAP);
  if (spare < 0)
    console.warn(`§148: the chaton's press-fit wall at bore ${boreR} is ${chatonRimW(boreR).toFixed(4)}, `
      + `under its own floors (hoop ${STOCK_MIN_U.toFixed(4)} + lap ${CHATON_SCREW_LAP.toFixed(4)}) by `
      + `${(-spare).toFixed(4)}`);
}
// A chaton screw is COUNTERSUNK, and the taper is not a look: it is the only
// head that can be flush here. A cheese head sinks its full thickness into
// whatever it laps, and headT ≥ STOCK_MIN_U against a chaton only
// CHATON_DEPTH deep would leave the gold under it 0.054 mm — well under the
// floor, on a plate too thin to solve for (see CHATON_DEPTH in `main.js`: no
// depth exists that gives collar, stone AND a full-thickness ledge, which is
// TODO 69). A cone only reaches full depth at its own axis, so across the lap
// it takes 0.0455 instead of 0.3166 and the gold under it survives at 0.157
// mm — see the chamfer solved in makeChaton, which is asserted there rather
// than assumed here. The taper is the shank's radius over the head's, because
// a countersunk head IS the cone the shank opens into:
// screwShankR(headR)/headR = 1/2.
export const CHATON_SCREW_TAPER = screwShankR(CHATON_HEAD_R) / CHATON_HEAD_R;

// §148 — the assert that would have caught the above at the moment it was
// written. A closed revolve's top face must point UP; if more of its topmost
// normals point down than up, the profile was travelled backwards and the part
// is inside out. Cheap, and run at build time on the geometry as it is handed
// over (after the rotateX that stands the profile along z, so the axis is z).
function assertLatheOutward(geo, what) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  let top = -Infinity;
  for (let i = 0; i < p.count; i++) top = Math.max(top, p.getZ(i));
  let up = 0, down = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < top - 1e-4) continue;
    const nz = n.getZ(i);
    if (nz > 0.5) up++; else if (nz < -0.5) down++;
  }
  if (down > up)
    console.warn(`§148: ${what} is wound inside out — ${down} of its ${up + down} top-face normals point `
      + 'DOWN. Reverse the profile; ringGeo\'s direction (bore bottom → out → up → back in) is the convention');
}

// `screwShank` is how far a screw's body runs below its head — the plate's
// remaining thickness under the seat, passed by the host because only the
// host knows it (SEAT_FIT's rule: draw the fastener as far as its own drawn
// body goes, and cut the host for it).
export function makeChaton({ boreR, thickness = 0.35, screwCount = 3, screwPhase = 0, screwShank = 0 }) {
  const g = new THREE.Group();
  const rubyR = jewelOuterR(boreR);
  const outerR = chatonOuterR(boreR);
  const t = thickness;
  // The screws first: the chaton's rim is CUT for them, so their dimensions
  // are inputs to its profile rather than furniture added afterwards.
  //
  // headT is DECOUPLED from t, and it has to be. A screw head is real stock
  // and carries no kind entry on purpose (`STOCK_KIND_BY_MESH`: "they are
  // real stock at STOCK_MIN_U and must keep answering to the wheel floor"),
  // so at t·0.5 the members splitting a 0.8 plate cannot all clear the floor:
  // the head would want t ≥ 0.633 while the bearing collar under the chaton
  // caps t at 0.483. §20 hit exactly this on the plate screws and decoupled
  // the same way. Proportional where the host is thick enough to afford it,
  // floored where it is not.
  const headR = CHATON_HEAD_R, headT = Math.max(STOCK_MIN_U, t * 0.5);
  const screwR = chatonScrewR(boreR);
  // §148 — THE CHAMFER THE HEADS SIT IN, solved rather than styled.
  //
  // A countersunk head is a cone: at distance ρ from its own axis its
  // underside stands at −headT·(headR − ρ)/(headR − r0), so it only reaches
  // full depth at r0 = screwShankR. Along the line of centres a point at
  // chaton-radius r is ρ = screwR − r from the screw's axis, and the head's
  // inner edge lands exactly on r = outerR − CHATON_SCREW_LAP. So the gold
  // the heads occupy is a CONE about the chaton's own axis running from
  // nothing at that radius to this depth at the rim — a turned chamfer, which
  // is what it is on the lathe and what it looks like from above.
  //
  // Everywhere OFF that line the head's ρ is larger and its cone shallower,
  // while the chamfer is turned to the deepest case, so the chamfer clears
  // the head at every azimuth. That is the whole reason the head is a cone: a
  // cheese head would take headT of gold across the lap and leave 0.054 mm
  // under it.
  //
  // §148 — AND IT IS SUNK ONE SEAT FIT DEEPER THAN THAT, which is not a
  // detail. Cut to the head's own cone the two surfaces do not merely touch
  // at a point: they COINCIDE along the whole line of centres and lie within
  // microns of each other either side of it, which is a grazing pair over an
  // area — and the renderer shows that as the chaton being shattered by a
  // surface passing through it. Real countersunk heads do bear on their
  // seats, so the coincidence is honest and the artefact is the modelling
  // problem; SEAT_FIT is this movement's answer to exactly that ("every face
  // held off its host by seat margins — coincident planes z-fight; see the
  // bridge jewels"), and it is the fit these two parts already assemble on.
  const chamferD = headT * CHATON_SCREW_LAP / (headR - screwShankR(headR)) + SEAT_FIT;
  if (t - chamferD < STOCK_MIN_U)
    console.warn(`§148: chaton ledge under the screw heads is ${(t - chamferD).toFixed(4)} u, `
      + `under the ${STOCK_MIN_U.toFixed(4)} stock floor — the host is too thin to carry a screwed chaton`);

  // Gold ring. Lathe profile: the chamfered rim the heads clamp, the outer
  // wall, then the OIL SINK — the underside is dished out around the bore so
  // oil is held at the pivot by surface tension instead of creeping away
  // along the plate.
  //
  // §148 — AND IT TRAVELS THE OTHER WAY, which was not a style question. A
  // lathe profile's DIRECTION is the surface's orientation: written from the
  // top face outward, as this was, every normal comes out pointing INTO the
  // solid. Back-face culling then hides the faces you are looking at and shows
  // the ones behind them — so the ring rendered as its own UNDERSIDE, which in
  // this movement is coplanar with the bearing collar it bottoms on, and the
  // pair z-fought into a shattered gold band. Both of this builder's lathes
  // were written that way and had been since §132; it took a ring wide enough
  // to see through for anyone to notice, which is the whole argument for the
  // assert below. The convention is `ringGeo`'s and it is one sentence: start
  // at the bore's bottom, travel OUT, UP, and back IN.
  const pts = [
    new THREE.Vector2(rubyR, 0),
    new THREE.Vector2(rubyR, -t * 0.35),
    new THREE.Vector2(rubyR * 1.02, -t * 0.55),
    new THREE.Vector2(rubyR * 1.02, -t),
    new THREE.Vector2(outerR, -t),
    new THREE.Vector2(outerR, -chamferD),
    new THREE.Vector2(outerR - CHATON_SCREW_LAP, 0),  // the turned chamfer the heads sink into
    new THREE.Vector2(rubyR, 0),
  ];
  // LatheGeometry revolves about +Y — the profile's second coordinate comes
  // out as height in Y, so it has to be stood up along Z like every other
  // lathe part here (makePillar does the same).
  const ringG = new THREE.LatheGeometry(pts, 40);
  ringG.rotateX(Math.PI / 2);
  assertLatheOutward(ringG, "the chaton's gold ring");
  // NAMED, with the stone below and the plate's own lands beside them: an
  // unnamed mesh cannot be reached by `STOCK_KIND_BY_MESH` at all, so it
  // takes the wheel default in silence — §107's lesson, paid here in advance.
  const bezel = new THREE.Mesh(ringG, MATS.gold);
  bezel.name = 'chatonBezel';
  g.add(bezel);

  // Ruby, pressed in: its top face slightly below the gold rim (as a set
  // stone sits), the pivot's bore through it, and the OIL SINK dished into
  // its underside — ONE closed lathe solid, which is the §132 fix.
  //
  // It was an extruded annulus plus a separate `openEnded` cone standing in
  // for the dish, and that cone was two defects at once. It was an OPEN
  // surface, which `meshClearance` reads as a colliding one — its parity
  // raycast counts crossings and so assumes a closed solid (TODO 27 measured
  // an open body CONFIRM an overlap against a part 3.7 units away). And its
  // AABB thin axis was 0.22·t, a third of the wheel floor, on a mesh nothing
  // had kinded. Revolving the dish into the stone's own profile removes the
  // mesh rather than declaring it: a jewel with a sink cut in it is what the
  // part IS.
  //
  // TODO 12: stone at CHATON_RUBY_FRAC·t (was 0.62). Its AABB section is
  // that full height; at the bore the sink leaves 0.52·t, which is the sink
  // doing its job and is why real pressed jewels are dimensioned on their rim.
  const zT = -t * 0.08, zB = zT - t * CHATON_RUBY_FRAC, zS = zB + t * 0.22;
  const rubyPts = [
    new THREE.Vector2(boreR, zT),
    new THREE.Vector2(boreR, zS),
    new THREE.Vector2(boreR * 1.05, zS),   // the dish, falling from the bore
    new THREE.Vector2(rubyR * 0.98, zB),
    new THREE.Vector2(rubyR, zB),
    new THREE.Vector2(rubyR, zT),
    new THREE.Vector2(boreR, zT),
  ];
  const rubyG = new THREE.LatheGeometry(rubyPts, 32);
  rubyG.rotateX(Math.PI / 2);
  assertLatheOutward(rubyG, "the chaton's stone");
  const jewel = new THREE.Mesh(rubyG, MATS.ruby);
  jewel.name = 'chatonJewel';
  g.add(jewel);

  // Blued screws, heads FLUSH with the top face and lapping the rim: the head
  // reaches CHATON_SCREW_LAP back over the chaton's chamfer, and its body
  // runs down a tapped hole in solid plate outside the counterbore. Sunk, not
  // proud: nothing on this face may stand above the plate — the hack blade
  // passes 0.18 over it. (§20: the shared merged builder — this loop was its
  // template, and each chaton's screws cost TWO meshes, not 2N.)
  //
  // §148 — and the body EXISTS. §132's screws stood on the counterbore's own
  // rim, where half of any hole would have been void, so they were heads with
  // nothing under them: a decoration in the shape of a fastener. The screw
  // circle is solved out to where its hole is entirely in metal
  // (chatonScrewR), and the host cuts that hole and bores the seat's land for
  // it — the pillar screws' construction, which is the movement's one way of
  // seating a screw.
  g.add(makeScrews({
    at: Array.from({ length: screwCount }, (_, i) => {
      const a = screwPhase + (i / screwCount) * Math.PI * 2;
      return { x: Math.cos(a) * screwR, y: Math.sin(a) * screwR, z: 0, a,
        shank: screwShank || undefined, tapped: true };
    }),
    headR, headT, taper: CHATON_SCREW_TAPER,
  }));

  g.userData.outerR = outerR;
  g.userData.rubyR = rubyR;
  g.userData.boreR = boreR;
  g.userData.screwR = screwR;
  g.userData.screwOuterR = screwR + headR;
  g.userData.headR = headR;
  g.userData.headT = headT;
  g.userData.chamferD = chamferD;
  g.userData.thickness = t;
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
  const merged = mergeGeos(geos, m.shapes.map((_, i) => `stroke#${i}`));
  // The monogram's strokes CROSS by design — an ∞ is its crossings — so
  // every stroke pair is declared expected-overlap (meshIntegrity skips
  // declared pairs and reports the skip; an undeclared overlap would be a
  // real finding, but here there is no such thing as an illegal crossing).
  merged.userData.subBodyOverlapOk = m.shapes.flatMap((_, i) =>
    m.shapes.slice(i + 1).map((_, j) => [`stroke#${i}`, `stroke#${i + 1 + j}`]));
  const mesh = new THREE.Mesh(merged, material);
  mesh.userData = { r: m.r, tubeR: m.tubeR, height: m.H, strokeWidth: m.sw, proud: m.tubeR };
  return mesh;
}

// Minimal geometry merge — the three examples' BufferGeometryUtils is not
// vendored. Position+normal only, which is all ExtrudeGeometry produces here.
// Callers: makeScrews' three batched bodies, the ∞ monogram, and makeDial's
// dialPlate (a caller this comment omitted for a year — §77's audit found
// the list stale, which is its own small argument for the declaration
// below: a table the instruments VALIDATE cannot rot the way a comment can).
//
// §81: it concatenates as triangle soup (that is the cheap way to merge
// unlike geometries) and then WELDS, so it emits indexed output. It is the
// in-house builder of exactly the mesh class tranche A exists for, and it
// merges REPEATED bodies — every screw head is the same lathe — so the weld
// has more to find here than anywhere else.
//
// §77 — the DECLARED route's source of truth. When `names` is given (one
// per input geometry; consecutive equal names coalesce, which is how a
// tapped shank's core-plus-crests stay ONE body), the output carries
// `userData.subBodies = [{ name, triStart, triCount }]` — TRIANGLE ranges
// into the index, never vertex ranges, because the weld preserves the
// triangle list exactly (count, order, winding) while it compacts vertices
// by first occurrence: a later body's duplicate vertex remaps into an
// earlier body's slot range, so a vertex range is not weld-invariant and a
// triangle range is. `meshIntegrity` validates every table it finds
// (bounds, overlap, name reuse) and GATES a malformed one — declare
// beside the cut or not at all.
function mergeGeos(geos, names) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of parts) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  const subBodies = names ? [] : null;
  for (let i = 0; i < parts.length; i++) {
    const g = parts[i];
    const p = g.getAttribute('position'), q = g.getAttribute('normal');
    pos.set(p.array.subarray(0, p.count * 3), o * 3);
    if (q) nrm.set(q.array.subarray(0, q.count * 3), o * 3);
    if (subBodies) {
      const triStart = o / 3, triCount = p.count / 3;
      const last = subBodies[subBodies.length - 1];
      if (last && last.name === names[i]) last.triCount += triCount;
      else subBodies.push({ name: names[i], triStart, triCount });
    }
    o += p.count;
  }
  const soup = new THREE.BufferGeometry();
  soup.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  soup.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  for (const g of parts) g.dispose();
  const out = weldGeometry(soup);
  if (out !== soup) soup.dispose();
  if (subBodies) declareSubBodies(out, subBodies);   // TODO 108 — the ranges and the index order they mean are one fact
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
// The maker's mark's words, ONE copy: makeDial's reserve-less branch sets the
// same signature on the dial itself, and the reserve well's notch sets it
// there — they were the same string typed twice until §158.
export const MARK_TEXT = 'WATCH SIMULATOR';
// The reserve comb's own fractions, module-scope and EXPORTED since §158,
// because three things outside the paint derive from them: the figure band
// (inside, one line down from the ticks), §159's zone sectors, and the reserve
// HAND's width floor (main.js — a pointer may not be finer than the marks it
// indexes). All were free to restate 0.92 / 0.20 / 0.055 in their own
// arithmetic, which is the drifted-copy failure rule 1 exists for: lengthen a
// major tick and the figures must move with it, widen it and the hand must
// follow.
export const SUBDIAL_TICK_OUTER_F = 0.92;   // tick circle, as a fraction of the well radius
export const SUBDIAL_MAJOR_LEN_F = 0.20, SUBDIAL_MINOR_LEN_F = 0.09;
export const SUBDIAL_MAJOR_W_F = 0.055, SUBDIAL_MINOR_W_F = 0.022;

function paintSubdialFace(ctx, scx, scy, sr, kind, scale = {}, ground = null) {
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
    return total;   // the arc it occupied, in radians — callers that must FIT
  };                // inside a gap assert against it rather than eyeballing
  // The well's NAME, set STRAIGHT below the pivot — a caption, not another
  // graduation, so it does not fan along an arc the way the scale's own
  // lettering does. Type is the INSTRUMENT voice the chrome uses wherever it
  // states a measured quantity — `ui-monospace, monospace`, tabular figures:
  // `#clock-ui .readout` in the panel, `#ctl-hud .hud-ro-val` in the corner.
  // These captions name an instrument, the way those readouts name a
  // dimension, so they carry its voice rather than the dial's Helvetica.
  // (This cited `#scale-ref`'s own font until §110 item 5 deleted that panel.
  // The typeface is unchanged — it was always the chrome's readout voice, and
  // the coin diagram was one place it appeared, not its source.)
  // Lightly tracked — monospace already sets its own advance, so this only
  // opens the word.
  // Captions sit at dy = 0.40·sr below the pivot: clear of the busiest hand
  // tail there (the small-seconds hand's counterweight reaches 0.26·0.8·sr +
  // its own radius ≈ 0.24·sr) and clear of the deepest figure below it (the
  // seconds track's 30, centred at 0.62·sr, half its 0.19·sr height = top
  // edge at 0.525·sr). The SECONDS well is the only caller since §158 — the
  // reserve's arc now sweeps through this spot, so its caption arcs into the
  // 12 o'clock notch instead and is set at its own site.
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
    // Graduated arc, SYMMETRIC about the well's vertical — and since §158 it
    // hangs from the DOWN end of that vertical: empty at math −90° +
    // sweepDeg/2, full at −90° − sweepDeg/2, a U opening at 12 o'clock with
    // the un-swept remainder as a notch centred on the well's 12 (60° at the
    // shipped 300°). §153's rule is untouched — one symmetry rule, stated
    // independently at the two sites that need it (here, and the friction
    // coupling's SET in main.js's tick) — the ANCHOR simply names which end
    // of the vertical the notch sits on. The sweep and hours arrive from the
    // CALLER, because those same two numbers set the hand's travel and the
    // reduction train's ratio and the three drifting apart is how TODO 18
    // happened (the arc was widened 120° → 150° here while the gearing kept
    // the old figure). NOTE the anchor is a phase, not a width: it moves the
    // notch, never the sweep, so it cannot reach the ratio at all.
    // Major ticks every 12 hours (0/12/24), one minor per HOUR (10° each at
    // the shipped 300°), slimmed to keep the comb fine.
    const { sweepDeg = 300, hours = 30, mmPerSr = null } = scale;
    const TICK_OUTER_F = SUBDIAL_TICK_OUTER_F, MAJOR_LEN_F = SUBDIAL_MAJOR_LEN_F;
    const MINOR_LEN_F = SUBDIAL_MINOR_LEN_F;
    const MAJOR_W_F = SUBDIAL_MAJOR_W_F, MINOR_W_F = SUBDIAL_MINOR_W_F;
    const angAt = (h) => -90 + sweepDeg / 2 - (h / hours) * sweepDeg;
    // §159 — THE SCALE'S TWO ZONES, painted UNDER the comb so the ticks read
    // over them and the graduation stays the thing being read. A zone says at
    // a glance what the figures cannot say at arm's length: the figures stand
    // 8 arcmin (§158) and a coloured sector has no size at all — it is a
    // region, and a region is legible as long as it is bigger than the eye's
    // limit, which at 120° and 10° of arc both are by orders of magnitude.
    //  · WARNING, at the empty end, RESERVE_WARN_HOURS wide. 12 h because the
    //    majors fall every 12 h, so the zone ENDS on a graduation that already
    //    exists rather than introducing an edge of its own — and because the
    //    meaningful quantity is hours of running left, not a fraction of the
    //    scale, it stays 12 h when ?reserveh= re-specs the movement and its
    //    ANGLE re-derives (120° at the 30 h default, 90° at 48 h).
    //  · MAXIMUM, at the full end, ONE HOUR DIVISION wide. The scale resolves
    //    one hour; a mark finer would claim a precision the graduation has
    //    not got, and a mark wider would name a range where the point of it
    //    is a single value — the total the movement holds.
    const RESERVE_WARN_HOURS = 12;
    const sector = (h0, h1, fill) => {
      const a0 = (-angAt(h0) * Math.PI) / 180, a1 = (-angAt(h1) * Math.PI) / 180;  // canvas angles: y is flipped
      ctx.save();
      ctx.beginPath();
      ctx.arc(scx, scy, sr * TICK_OUTER_F, a0, a1, false);
      ctx.arc(scx, scy, sr * (TICK_OUTER_F - MAJOR_LEN_F), a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    };
    // THE TONE IS SOLVED, NOT PICKED. A zone has two neighbours with opposite
    // demands — the ground it sits on (which it must differ from) and the ink
    // printed over it (which must still read) — so the tone is the mix of its
    // hue with that ground which stands furthest from BOTH: a max-min over
    // one parameter, ternary-searched because the objective is unimodal in it.
    // Solved at PAINT time, so §157's live recolour re-solves both zones for
    // the new ground instead of leaving two fixed swatches on a moved face.
    const zoneTone = (hue) => {
      if (!ground) return hue;              // no ground given: nothing to solve against
      const score = (t) => {
        const c = mixHex(hue, ground, t);
        return Math.min(contrastRatio(c, ground), contrastRatio(c, DIAL_TRACK_INK));
      };
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (score(m1) < score(m2)) lo = m1; else hi = m2;
      }
      return mixHex(hue, ground, (lo + hi) / 2);
    };
    const warnTone = zoneTone(RESERVE_WARN_HUE), fullTone = zoneTone(RESERVE_FULL_HUE);
    sector(0, RESERVE_WARN_HOURS, warnTone);
    sector(hours - 1, hours, fullTone);
    if (ground) {
      for (const [what, tone] of [['warning', warnTone], ['maximum', fullTone]]) {
        const vsGround = contrastRatio(tone, ground), vsInk = contrastRatio(tone, DIAL_TRACK_INK);
        if (Math.min(vsGround, vsInk) < DIAL_INK_CONTRAST_MIN)
          console.warn(`reserve face: the ${what} zone's best tone on this ground holds only `
            + `${vsGround.toFixed(2)}:1 against the face and ${vsInk.toFixed(2)}:1 against the ticks `
            + `— need ${DIAL_INK_CONTRAST_MIN.toFixed(1)}:1 of both (WCAG 2.1 SC 1.4.11). `
            + `Ground ${ground} leaves this hue no room.`);
      }
    }
    for (let h = 0; h <= hours; h += 1) {
      const major = h % 12 === 0;
      tickAt(angAt(h), sr * TICK_OUTER_F, sr * (major ? MAJOR_LEN_F : MINOR_LEN_F),
        sr * (major ? MAJOR_W_F : MINOR_W_F));
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // §158 — THE FIGURES ARE SIZED BY ACUITY, AND SO IS THE BAND THEY SIT ON.
    // Both were literals (0.11·sr of type on a 0.64·sr circle) and both were
    // wrong for the same reason: nothing in them names the distance a watch
    // is read from. Measured on the built well — 7.02 mm across — that type
    // stood 2.72 arcmin at the wrist, against the 5 a character needs to be
    // told apart at all. The figures now meet the GLANCE floor, and the band
    // radius falls out of it rather than being chosen beside it:
    //
    //   cap  = mmForArcmin(GLANCE_ARCMIN) / mmPerSr        (≈ 0.232·sr here)
    //   band = tick circle − major length − gap − cap/2    (≈ 0.575·sr)
    //
    // reading the SAME fractions the comb above is drawn from, so a longer
    // major tick pushes the figures in instead of colliding with them. The
    // gap is one arcmin — the acuity limit itself, because a space the eye
    // cannot resolve is not a space. Arc width never enters: majors sit 12 h
    // apart, which is 120° of azimuth at the shipped sweep, and reading a
    // figure's WIDTH as the binding constraint is what made this look
    // impossible the first time it was costed.
    // mmPerSr is the well's printed radius in real mm; a caller that cannot
    // say how big the well IS (the bare makeDial() smoke test) gets the
    // pre-§158 fraction, since an acuity solve without a physical scale is
    // not a solve.
    const capF = mmPerSr ? mmForArcmin(GLANCE_ARCMIN) / mmPerSr : 0.11 * CAP_PER_EM;
    const gapF = mmPerSr ? mmForArcmin(RESOLVE_ARCMIN) / mmPerSr : 0.02;
    const figBandF = TICK_OUTER_F - MAJOR_LEN_F - gapF - capF / 2;
    // Hour figures at the majors — ARABIC, so the reserve reads as an
    // instrument scale rather than as more of the hour chapter, and (since
    // §158) large enough that the claim survives being looked at. One figure
    // per MAJOR tick, however many the graduation carries: a 48 h scale reads
    // 0/12/24/36/48 where the 30 h default reads 0/12/24. Bezel convention,
    // the seconds track's own rule: tops radially outward, and a figure whose
    // centre falls below the horizontal flips tops toward the pivot so it
    // never renders upside-down — with the arc hanging from the DOWN vertical
    // that is now the middle figure rather than the two end ones.
    ctx.font = `500 ${sr * (capF / CAP_PER_EM)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    for (let h = 0; h <= hours; h += 12) {
      const aDeg = angAt(h);
      arcLabel(String(h), aDeg, sr * figBandF, Math.sin((aDeg * Math.PI) / 180) < 0);
    }
    // No AB / AUF bookending the arc: the German pair was the Glashütte
    // marking for a Roman-figured reserve, and with the scale figured 0→24
    // in Arabic the words name what the numbers already say. The empty end
    // is where 0 is; the caption names the complication.
    //
    // §158 — BOTH LINES OF LETTERING MOVE INTO THE NOTCH, stacked, and both
    // radii are derived. The flip put the comb through the 6 o'clock gap the
    // two of them shared, so neither can stay:
    //  · the CAPTION was set STRAIGHT below the pivot, which the hand now
    //    rests on at half charge — the most-read state of the indicator, with
    //    the hand splitting POWER | RESERVE. It takes the outer line, at the
    //    mark's own old radius law (centre-line at sr − 1.5·typeH, leaving a
    //    type-height of air to the wall), tops outward as an upper-arc label.
    //  · the MARK arced along the bottom edge and needed 54.6° of comb-free
    //    arc. It takes the inner line. It is NOT deleted and NOT enlarged:
    //    §157 already settled that a maker's mark is discreet by design (it
    //    reports its contrast rather than gating it), and this dial has
    //    nowhere else to print one — 6 o'clock is the seconds well, and the
    //    12 o'clock arc at MARK_RADIAL_F falls inside the applied markers'
    //    own band. Measured, it stands 1.85 arcmin at the wrist at its set
    //    size and 1.61 after the solve below, against the 5 a character needs
    //    to be told apart — accepted rather than fixed, because enlarging a
    //    signature is not what the acuity rule is for. The hour figures and
    //    the hand are where legibility was bought.
    // The inner line's radius is CENTRED in the air it has — equal gaps to
    // the figures' tops below and to the caption's ink above — so neither
    // line is placed by eye, and the gap is the same one-arcmin resolvable
    // space the figure band uses.
    const CAPTION_EM_F = 0.08, MARK_EM_MAX_F = 0.075;
    const capR = 1 - 1.5 * CAPTION_EM_F;
    const notchRad = ((360 - sweepDeg) * Math.PI) / 180;
    // The arc a string occupies at a given em, as a fraction of sr — MEASURED
    // with the real metrics, since the tracking arcLabel adds does NOT scale
    // with the type and a proportional estimate is wrong by exactly that much.
    const markArcWidth = (em) => {
      ctx.font = `400 ${sr * em}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      const w = [...MARK_TEXT].map((ch) => ctx.measureText(ch).width);
      return w.reduce((a, b) => a + b + sr * 0.008, -sr * 0.008) / sr;
    };
    const markRadiusFor = (em) => {
      const lo = (figBandF + capF / 2) + gapF + (em * CAP_PER_EM) / 2;
      const hi = (capR - (CAPTION_EM_F * CAP_PER_EM) / 2) - gapF - (em * CAP_PER_EM) / 2;
      return { lo, hi, r: (lo + hi) / 2 };
    };
    const markFits = (em) => {
      const { lo, hi, r } = markRadiusFor(em);
      return hi > lo && (markArcWidth(em) + 2 * gapF) / r <= notchRad;
    };
    // SOLVED, not chosen: the largest em that fits, never larger than the size
    // the mark has always been set at. Bisection because the two constraints
    // pull opposite ways — a bigger em widens the arc AND thickens the line
    // whose gaps the radius band has to absorb.
    let markEm = MARK_EM_MAX_F;
    if (!markFits(markEm)) {
      let lo = 0, hi = MARK_EM_MAX_F;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (markFits(mid)) lo = mid; else hi = mid; }
      markEm = lo;
    }
    const markR = markRadiusFor(markEm).r;
    ctx.fillStyle = '#1c1c22';
    ctx.font = `400 ${sr * CAPTION_EM_F}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    const capArc = arcLabel('POWER RESERVE', 90, sr * capR, false);
    ctx.font = `400 ${sr * markEm}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = '#8a887e';
    const markArc = arcLabel(MARK_TEXT, 90, sr * markR, false);
    // The caption is NOT solved — it is the line that names the complication,
    // so it keeps its size and the mark yields around it. Both are asserted
    // against the notch, which is a function of the SWEEP: a re-spec that
    // widens the arc closes the notch on them exactly as this flip closed the
    // 6 o'clock gap, and says so with both numbers rather than overprinting
    // in silence. (This is also the arithmetic that refuses a 330° sweep: a
    // 30° notch holds neither line at any size worth printing.)
    const notchDeg = 360 - sweepDeg;
    for (const [what, arc, r] of [['caption', capArc, capR], ["maker's mark", markArc, markR]]) {
      const needDeg = ((arc + 2 * (gapF / r)) * 180) / Math.PI;
      if (needDeg > notchDeg + 1e-9)
        console.warn(`reserve face: the ${what} needs ${needDeg.toFixed(1)}° of notch and a `
          + `${sweepDeg}° sweep leaves ${notchDeg.toFixed(1)}° — it will overprint the comb`);
    }
    if (markEm < MARK_EM_MAX_F * 0.5)
      console.warn(`reserve face: the maker's mark solved down to ${markEm.toFixed(4)}·sr `
        + `(from ${MARK_EM_MAX_F}) to fit a ${notchDeg.toFixed(1)}° notch — under half its `
        + `set size it is no longer a signature, it is a smudge; give it somewhere else to live`);
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
// Each entry becomes a real recessed WELL: a blind pocket machined into the
// plate's front, its floor carrying the painted sub-dial face and pierced by
// one bore for the hand's arbor. Depth is `subdialRecess` unless the entry
// carries its own `recess` (§153 — the reserve's barely-recessed sector
// against the seconds' deep well), so each pocket owns its depth through
// both the cut and the finish. The caller adds
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

// §125 step 5 — the PRINTED face's own frame, exported for the same reason
// as the marker band above: the MINUTE HAND's length is derived from the
// railroad it points at, so the two cannot drift apart. The print lives on a
// square canvas mapped to the dial's diameter; its silvered disc fills
// DIAL_CANVAS_FILL_F of the canvas size (radius = S·0.46, so a printed
// fraction f of that disc lands at world f · 2·0.46 · dialRadius), and the
// chemin de fer's two rails sit at these fractions of the printed disc. The
// hand length in main.js was 0.83·dialRadius with a comment quoting "world
// r ≈ 31.5 / 34.2" — absolute measurements of the face on the day it was
// sampled, the arrangement that goes stale the first time the dial is
// re-proportioned (and §125 re-proportioned it).
export const DIAL_CANVAS_FILL_F = 0.46;   // printed disc radius / canvas size
export const DIAL_RAIL_OUT_F = 0.94;      // railroad outer rail / printed disc
export const DIAL_RAIL_IN_F = 0.87;       // railroad inner rail / printed disc

// §154 — the dial's silvered face is a three-stop radial gradient around ONE
// editable base tone (aesthetics.dial.face.color) instead of three
// independent literals. DIAL_TINT_RATIO_{IN,OUT} are the shipped inner/outer
// stops (#f4f2ec, #d3d1c8) divided channel-by-channel by the shipped middle
// stop (#e7e5dd) — so the shipped default base tone reproduces those exact
// literals, and any other base tone keeps the same soft vignette shape
// rather than a flat recolor. Kept private; dialTintAt below is the public
// surface a caller outside this module needs.
const DIAL_TINT_RATIO_IN = [244 / 231, 242 / 229, 236 / 221];
const DIAL_TINT_RATIO_OUT = [211 / 231, 209 / 229, 200 / 221];
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(rgb) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}
// §159 — a straight linear blend, t = 0 keeping all of `a`, t = 1 all of `b`.
// Channel-linear rather than perceptual on purpose: the caller that uses it
// (the reserve's zone solve) does not care where on the ramp it lands, only
// that the ramp is continuous and that it can measure the CONTRAST of the
// result, which it does with the WCAG luminance below.
function mixHex(a, b, t) {
  const [ra, ga, ba] = hexToRgb(a), [rb, gb, bb] = hexToRgb(b);
  return rgbToHex([ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t]);
}
// t is the canvas gradient's own parameter (0 at the inner stop, 0.75 at the
// base tone, 1 at the outer stop) — linear on each side of the base tone, so
// it lands on the ratio exactly at both ends and on identity at 0.75.
function dialTintStop(baseColor, t) {
  const base = hexToRgb(baseColor);
  const ratio = t <= 0.75
    ? DIAL_TINT_RATIO_IN.map((r) => r + (1 - r) * (t / 0.75))
    : [0, 1, 2].map((i) => 1 + (DIAL_TINT_RATIO_OUT[i] - 1) * ((t - 0.75) / 0.25));
  return rgbToHex(base.map((c, i) => c * ratio[i]));
}
// Public surface: `radialFraction` is a fraction of the printed disc's own
// radius (the gradient runs from 0.1x that radius to 1x it — see makeDial),
// so a caller wanting "the dial's own tone at world radius f·dialRadius" can
// ask directly instead of re-deriving the gradient's span. Used by main.js
// to keep a sub-dial's blend-in `face` tone in step with the editable base
// tone rather than a hand-sampled literal.
export function dialTintAt(baseColor, radialFraction) {
  const t = Math.max(0, Math.min(1, (radialFraction - 0.1) / 0.9));
  return dialTintStop(baseColor, t);
}

// §157 — CAN THE PRINTING STILL BE READ ON THIS GROUND? Roadmap item 140's
// third ask, and the reason it asked: `dial.face.color` is free taste, but
// the ink printed on it is FIXED, so a dark enough tone silently swallows
// the minute track. Measured, at the rail radius: the shipped tone holds
// 11.96:1 against the track, and a #1a1a1a dial collapses it to 1.02:1 —
// invisible, with every other gate green. Nothing in the tree measured this
// (the two existing "legibility" asserts are geometric: the crown monogram's
// counter floor and the sub-dial texel density).
//
// The metric is WCAG 2.1's relative luminance and contrast ratio, used
// because it is the standard, citable answer to "can a mark be told from its
// ground" — the alternative was inventing a number, which rule 1 exists to
// forbid. sRGB relative luminance per WCAG 2.1 §relative-luminance; the ratio
// is (L_lighter + 0.05) / (L_darker + 0.05).
function srgbLuminance(hex) {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
export function contrastRatio(hexA, hexB) {
  const a = srgbLuminance(hexA), b = srgbLuminance(hexB);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}
// The FLOOR is 3.0:1 — WCAG 2.1 SC 1.4.11 (Non-text Contrast), which is the
// clause covering graphical objects a user must perceive, and the minute
// track is exactly that: a graphic, not type. Not 4.5 (SC 1.4.3, normal
// TEXT) because the track carries no glyphs.
export const DIAL_INK_CONTRAST_MIN = 3.0;
// The printed inks, quoted where they are used below so the assert and the
// paint cannot drift: the chemin-de-fer rails and ticks, and the maker's
// mark. Exported so the published measurement beside the gate reads the
// same constants the canvas paints with.
export const DIAL_TRACK_INK = '#1a1a1a';
export const DIAL_MARK_INK = '#8a887e';
// §159 — THE RESERVE SCALE'S TWO ZONE HUES. Hue is the only part of a zone
// that is a convention rather than a derivation: red for "running out" is the
// one colour meaning every reader already holds (fuel, battery, oil), and its
// opposite marks the other end. What is NOT left to taste is the LIGHTNESS —
// paintSubdialFace solves each of these toward the well's own ground until it
// stands as far as it can from BOTH the ground it sits on and the ticks
// printed over it, and asserts the result against DIAL_INK_CONTRAST_MIN.
// The pair is deliberately REDUNDANT with position and width (one zone is at
// the empty end and 12 h wide, the other at full and one division wide), so a
// reader who cannot separate the two hues loses nothing but the reminder.
export const RESERVE_WARN_HUE = '#b81f1f';
export const RESERVE_FULL_HUE = '#1f7a3d';

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
  // §157 — the repaint hooks the live tier needs. Each is filled in only if
  // this environment actually has a canvas; `repaintFace` stays null in the
  // no-DOM path (test harnesses), and the caller must tolerate that rather
  // than assume a dial can always be recoloured in place.
  let repaintFace = null;
  const repaintWells = [];

  // The MAKER'S MARK's radius, hoisted out of the paint because the §157
  // contrast measurement quotes the ground at exactly this fraction — a
  // number the assert and the paint must not be able to disagree about.
  const MARK_RADIAL_F = 0.78;

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (ctx) {
      const S = 1024;
      const C = S / 2;
      const R = S * DIAL_CANVAS_FILL_F; // = S·0.46 — see the export above; main.js derives the minute hand from this frame
      // §157 — the whole paint is a FUNCTION now, so the live tier can re-run
      // it against a new base tone without rebuilding one triangle. Geometry
      // is untouched by a recolour by construction, which is what keeps the
      // fingerprint still while the dial changes colour.
      const paintFace = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, S, S);
        // Silvered base with a soft radial vignette, around the editable base
        // tone (§154 — see DIAL_TINT_RATIO_{IN,OUT} above for the derivation).
        const faceColor = aesthetics.dial.face.color;
        const grad = ctx.createRadialGradient(C, C, R * 0.1, C, C, R);
        grad.addColorStop(0, dialTintStop(faceColor, 0));
        grad.addColorStop(0.75, faceColor);
        grad.addColorStop(1, dialTintStop(faceColor, 1));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(C, C, R, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(C, C);
        // Railroad ("chemin de fer") minute track: two concentric rails with a
        // crossing tick every minute, heavier sleepers on the five-minute marks.
        const rOut = R * DIAL_RAIL_OUT_F;
        const rIn = R * DIAL_RAIL_IN_F;
        ctx.strokeStyle = DIAL_TRACK_INK;
        ctx.fillStyle = DIAL_TRACK_INK;
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
          ctx.fillStyle = DIAL_MARK_INK;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const msg = MARK_TEXT;   // §158 — one copy of the signature, shared with the well's
          const extra = 2; // px of tracking between characters
          const widths = [...msg].map((ch) => ctx.measureText(ch).width);
          const rSig = R * MARK_RADIAL_F;
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
      };
      paintFace();

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
      repaintFace = () => { paintFace(); tex.needsUpdate = true; };
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
    // §153 — the recess is PER WELL: an entry's own `recess` overrides the
    // plate-wide default. Resolved once here so the plate's cut and the
    // finish laid on it below read the same depth by construction.
    recess: sd.recess ?? subdialRecess,
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
    // Boot asserts (standing rule 6), both stating the constraint they hold
    // (per well since §153 — each pocket carries its own depth):
    for (const w of wells) {
      const floorT = thickness - w.recess;
      if (floorT <= 0)
        console.warn(`dial: sub-dial pocket punches through the plate — floor ${floorT.toFixed(3)}, need > 0 (thickness ${thickness.toFixed(3)}, recess ${w.recess})`);
    }
    if (thickness - 2 * edgeBreak <= 0)
      console.warn(`dial: the edge break eats the stock — rim land ${(thickness - 2 * edgeBreak).toFixed(3)}, need > 0 (thickness ${thickness.toFixed(3)}, break ${edgeBreak})`);

    const face = circleLoop(0, 0, faceR, SEG);           // front/back flats' edge
    const rim = circleLoop(0, 0, radius, SEG);           // the nominal silhouette
    const bore = centerBoreR > 0 ? circleLoop(0, 0, centerBoreR, SEG, 'out') : null;
    const zF = 0, zB = -thickness, b = edgeBreak;
    // A sub-dial with no recess is a plain aperture, not a well — the pocket
    // walls below would be zero deep and its floor would land on the face.
    // Decided per well (§153), like the depth it is the zero case of.
    // §77 — every surface named for mergeGeos' sub-body declaration: the
    // dial plate is the richest merged body outside the chain, and a name
    // per member is what lets the declared tier later ask "does the pocket
    // floor cross the back cap" instead of sweeping a 5k-triangle blob
    // against itself.
    const parts = [], partNames = [];
    const part = (name, g) => { parts.push(g); partNames.push(name); };
    part('front-cap', plateCap(face, [...(bore ? [bore] : []), ...wells.map((w) => w.pocket)], zF, +1));
    part('back-cap', plateCap(face, [...(bore ? [bore] : []), ...wells.map((w) => (w.recess > 0 ? w.bore : w.pocket))], zB, -1));
    part('front-break', plateWall(0, 0, face, zF, rim, zF - b, true));
    part('rim-land', plateWall(0, 0, rim, zF - b, rim, zB + b, true));
    part('back-break', plateWall(0, 0, rim, zB + b, face, zB, true));
    if (bore) part('centre-bore', plateWall(0, 0, bore, zF, bore, zB, false));
    subdials.forEach((sd, i) => {
      const { pocket, bore: hole, recess } = wells[i];
      if (!(recess > 0)) { part(`aperture#${i}`, plateWall(sd.x, sd.y, pocket, zF, pocket, zB, false)); return; }
      part(`pocket-wall#${i}`, plateWall(sd.x, sd.y, pocket, zF, pocket, -recess, false));
      part(`pocket-floor#${i}`, plateCap(pocket, [hole], -recess, +1));
      part(`arbor-bore#${i}`, plateWall(sd.x, sd.y, hole, -recess, hole, zB, false));
    });
    const body = new THREE.Mesh(mergeGeos(parts, partNames), MATS.brass);
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
  if (wells.some((w) => w.recess > 0)) {
    // Matte and darker than the dial: the wall is the SHADOWED side of a
    // recess. A polished/metallic wall catches highlights and reads as a
    // raised bezel ring from oblique angles — the opposite of sunk.
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x8f8d85, metalness: 0.05, roughness: 0.9, side: THREE.DoubleSide,
    });
    subdials.forEach((sd, i) => {
      const recess = wells[i].recess;
      if (!(recess > 0)) return;   // an un-sunk aperture carries no floor or wall to finish
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
          // §157 — THE WELL'S BLEND TONE IS DERIVED FROM ITS OWN STATION.
          // §154 made this a derivation (`dialTintAt`) instead of the literal
          // '#eeece5' it had been, but the caller still passed a hand-typed
          // 0.39 as the radial fraction — the same hand-sampled number one
          // level up, correct only while both wells sat where they sat. It is
          // computed here now, from the well's actual distance off centre over
          // the PRINTED disc's world radius (2·DIAL_CANVAS_FILL_F·radius — the
          // frame that export exists to publish), so a moved station
          // (?d4=, ?rsvr=) re-derives its own tone. A well may still pass an
          // explicit `face` to opt out and read as a separate instrument.
          const wellR = Math.hypot(sd.x, sd.y) / (2 * DIAL_CANVAS_FILL_F * radius);
          const paintWell = () => {
            fctx.setTransform(1, 0, 0, 1, 0, 0);
            fctx.clearRect(0, 0, px, px);
            // ONE expression for this well's ground: it fills the canvas AND
            // it is what §159's zone tones are solved against, so the two
            // cannot be given different answers by a second transcription.
            const wellGround = sd.face || dialTintAt(aesthetics.dial.face.color, wellR);
            fctx.fillStyle = wellGround;
            fctx.fillRect(0, 0, px, px);
            paintSubdialFace(fctx, px / 2, px / 2, px / 2, sd.kind, sd.scale, wellGround);
          };
          paintWell();
          const ftex = new THREE.CanvasTexture(cv);
          ftex.colorSpace = THREE.SRGBColorSpace;
          ftex.anisotropy = 8;
          // Same lacquered finish as the main dial face.
          floorMat = new THREE.MeshPhysicalMaterial({ map: ftex, roughness: 0.35, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.07 });
          // Only a well that DERIVES its tone follows a live recolour; one
          // that passed an explicit `face` asked for a fixed colour and keeps
          // it, which is the same opt-out the paint above honours.
          if (!sd.face) repaintWells.push(() => { paintWell(); ftex.needsUpdate = true; });
        }
      }
      if (!floorMat) floorMat = MATS.silver;

      // The printed face, laid on the machined floor: the pocket's own loop
      // and bore, baked at the dial's coordinates (no mesh offset), so the two
      // surfaces are the same plane to the last bit.
      const floorShape = new THREE.Shape(wells[i].pocket);
      floorShape.holes.push(new THREE.Path(wells[i].bore.slice().reverse()));
      const floorGeo = new THREE.ShapeGeometry(floorShape);
      floorGeo.translate(0, 0, -recess);
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
      // call with the same loops the plate cut it with. Named (§153) so the
      // stock census can kind it honestly: this is a plated FILM on the
      // machined wall (the screwSlots / alarmDiscTrack class), and its
      // bounding-box "thickness" is the pocket's DEPTH, not a section — the
      // deep well cleared the wheel floor by coincidence (0.19 mm ≥ 0.12),
      // and the barely-recessed sector (0.05 mm) exposed the misclassification.
      const wall = new THREE.Mesh(
        plateWall(sd.x, sd.y, wells[i].pocket, 0, wells[i].pocket, -recess, false), wallMat);
      wall.name = `${sd.kind}SubdialWall`;
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

  // §157 — THE LEGIBILITY GATE, and the measurement beside it.
  //
  // ASSERTED: the chemin-de-fer against its ground, at BOTH rails. The ink
  // is fixed and the ground is free taste, so this is the pair that a colour
  // choice can actually break — and it is assertable because both sides are
  // flat, known sRGB values composited in the canvas, with no lighting in
  // between. Worst case is the OUTER rail: the vignette darkens outward, so
  // that is where a light dial's contrast is thinnest; both are checked
  // rather than reasoned about, because a dark base tone inverts which one
  // is worst (the ink is nearly black, so a dark ground fails inner-first).
  // ONE copy of the check, called at build and again on every live recolour —
  // a second transcription of a threshold is a second place for it to rot.
  const assertInkLegible = () => {
    const face = aesthetics.dial.face.color;
    for (const [name, f] of [['outer', DIAL_RAIL_OUT_F], ['inner', DIAL_RAIL_IN_F]]) {
      const ground = dialTintAt(face, f);
      const ratio = contrastRatio(ground, DIAL_TRACK_INK);
      if (ratio < DIAL_INK_CONTRAST_MIN)
        console.warn(`dial: the minute track is not legible on this face colour — ${name} rail `
          + `${ratio.toFixed(2)}:1 (ground ${ground} vs ink ${DIAL_TRACK_INK}), `
          + `need ${DIAL_INK_CONTRAST_MIN.toFixed(1)}:1 (WCAG 2.1 SC 1.4.11, non-text contrast). `
          + `Face colour ${face} is too close to the printed track.`);
    }
  };
  assertInkLegible();
  // PUBLISHED, NOT GATED: the maker's mark. It measures 2.82:1 on the shipped
  // tone — deliberately under the 3:1 floor above, because a maker's mark on
  // a real dial IS discreet, and it is printed at all only on a reserve-less
  // dial (the shipped one sets it inside the reserve well instead). Asserting
  // 3:1 here would force a design change nobody asked for; lowering the floor
  // to admit it would be widening a budget to green a row, which is the move
  // this repo forbids. So it is reported and left alone. Note the two pull in
  // OPPOSITE directions — darkening the dial lifts the mark's contrast while
  // collapsing the track's — so no single threshold serves both, which is the
  // second reason only the track is gated.
  //
  // Also published rather than asserted: the applied markers (MATS.steel,
  // 0xd6d9dd) and the hands (MATS.bluedHand, 0x2450b5). Those are METALS at
  // metalness 0.8–1.0, so what reaches the eye is the studio environment
  // reflected off them, not their base colour — a contrast ratio computed
  // from the base hex would be a number that looks like a check and tests
  // nothing. materials.js:85-99 records the one time this bit for real (the
  // old navy "read as black" under the original rig, fixed in the material),
  // and that failure is exactly the kind a flat-colour assert would miss.
  g.userData.inkContrast = () => {
    const face = aesthetics.dial.face.color;
    const at = (f) => dialTintAt(face, f);
    return {
      face,
      gated: {
        trackOuter: contrastRatio(at(DIAL_RAIL_OUT_F), DIAL_TRACK_INK),
        trackInner: contrastRatio(at(DIAL_RAIL_IN_F), DIAL_TRACK_INK),
        floor: DIAL_INK_CONTRAST_MIN,
      },
      reported: {
        makersMark: contrastRatio(at(MARK_RADIAL_F), DIAL_MARK_INK),
        markersBase: contrastRatio(at(DIAL_MARKER_OUTER_F), '#d6d9dd'),
        handsBase: contrastRatio(at(DIAL_RAIL_IN_F), '#2450b5'),
        note: 'markers and hands are metals — their rendered luminance is the '
          + 'environment, not these base colours; ratios are indicative only',
      },
    };
  };

  // §157 — the live-recolour hook the aesthetics panel drives. Repaints the
  // face canvas and every well that DERIVES its tone, then re-runs the gate
  // above so a live drag into an illegible colour warns exactly as a boot
  // into one would. Returns false where no canvas exists (no-DOM harnesses),
  // so the caller can fall back to the reload tier instead of assuming.
  g.userData.recolourFace = () => {
    if (!repaintFace) return false;
    repaintFace();
    for (const w of repaintWells) w();
    assertInkLegible();
    return true;
  };
  return g;
}

// boreR / bossR / bossH: stacked-hand overrides (§25 C). A hand riding an
// OUTER tube of a co-axial stack needs its boss to be a bored COLLET — wide
// enough to seat on its own tube's annular face, bored so the inner tubes
// pass through, and short so it tucks under the hand above. Defaults preserve
// the classic solid boss bit-for-bit for every existing hand.
// §50's hand floor (TODO 12): the keeled bur-rod section is 1.5·rBase thick,
// so rBase ≥ (0.10 mm + a hair) / UNIT_MM / 1.5 = 0.176 → 0.18 puts the blade
// at 0.102 mm against real hands' 0.10–0.20.
const HAND_RBASE_FLOOR = 0.18;

export function makeHand({ length, kind, boreR = 0, bossR: bossROverride = null, bossH: bossHOverride = null,
  namePrefix = null, subdial = false, halfWidth = null }) {
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
  // crossing envelope is the hour blade's corner plane (rBase/2 up) against
  // the minute blade's keel (rBase down) — 0.66 + 1.13 ≈ 1.79 at §125's
  // lengths, inside the 2.3 hour/minute plane gap in main.js. (The old
  // note bounded rHour + rMinute ≈ 2.10 as if both were cylinders; the
  // §125 hands grew that sum past 2.3 while the true envelope stayed
  // clear, which is why the honest expression is written out now.)
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
    // §158 — WIDTH AND DEPTH ARE TWO QUESTIONS, and the equilateral section
    // answered them with one number. The keel depth is a STOCK question
    // (§50's floor, and §153 derived the reserve well's whole recess from it
    // — floorDrop and the boss that swallows the rod both scale with rBase,
    // so a wider hand cut this way demands a deeper pocket the z-stack has
    // not got). The width is a READING question. A caller that has derived
    // its own half-width passes it and the section goes wide WITHOUT going
    // deep, which is what a real hand is: flat stock, not a chunky prism.
    // Everything below already reads halfW for x and rBase for y, so this
    // separates two axes that were only ever coupled by the default.
    const halfW = halfWidth ?? rBase * (Math.sqrt(3) / 2);
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

  let rBase;
  if (kind === 'hour' || kind === 'minute') {
    // TODO 41: a SUB-DIAL hand does not inherit the central width law.
    // length·widthFactor was tuned on hands ~3× this long, and at sub-dial
    // length it makes a blade (1.5·rBase thick) the 0.5 pocket cannot hold
    // at the one margin — the recess caps rBase at (0.5 − 0.15)/1.5 ≈ 0.233,
    // and the reserve hand's inherited 0.299 left its keel 0.0014 off the
    // well floor. Sub-dial hands ride §50's floor section instead — the rule
    // TODO 12's tranche four declared for the class, which only the 'second'
    // branch below had been applying.
    rBase = subdial ? HAND_RBASE_FLOOR : length * config.widthFactor * 0.35;
    g.add(burRod(rBase));
    bossH = rBase * 2 * 1.3; // boss must swallow the rod's full diameter
  } else {
    // second: same bur rod, slimmer. Floor on the radius — originally 0.14 so
    // a sub-dial-length rod would not vanish, now DERIVED from §50's hand
    // floor instead (TODO 12): see HAND_RBASE_FLOOR above. Sub-dial hands
    // ride the floor; the central seconds (length·widthFactor·0.5 ≈ 0.195)
    // clears it on its own and is untouched.
    rBase = Math.max(length * config.widthFactor * 0.5, HAND_RBASE_FLOOR);
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
  // TODO 41 — the section's facts, exported for the placement site so a
  // standoff derived "off the hand's own section" reads the builder rather
  // than restating its arithmetic:
  //   floorDrop — deepest metal below the mounting plane, boss excluded:
  //     the bur rod's keel at rBase, and the second kind's counterweight
  //     disc at depth/2 (0.14 < 0.18 today, kept in the max so a depth
  //     change cannot silently take the governing role unannounced);
  //   topRise — tallest metal above the plane, boss excluded: the blade's
  //     corner plane at rBase/2 (a positive crown bows the flute above it
  //     by `crown`), and the same counterweight;
  //   bossR/bossH — the collet, deliberately NOT in either figure: it is a
  //     centred cylinder ±bossH/2 when unbored (a collet extruded 0..bossH
  //     when bored), and where it dips or stands is the placement site's
  //     question — over a bore, on a hub — not the open section's.
  const crown = rBase * (handAesthetics.fluteFactor ?? -0.3);
  const cwHalf = kind === 'second' ? depth / 2 : 0;
  g.userData.rBase = rBase;
  g.userData.halfW = halfWidth ?? rBase * (Math.sqrt(3) / 2);   // §158 — the built half-width, for the placement site's asserts
  g.userData.floorDrop = Math.max(rBase, cwHalf);
  g.userData.topRise = Math.max(rBase * 0.5 + Math.max(0, crown), cwHalf);
  g.userData.bossR = bossR;
  g.userData.bossH = bossH;
  return g;
}

// ---------------------------------------------------------------------------
// Backlog (watch case) — THE SOLID CASE. makeCase builds the housing as real
// closed metal, BACK-LOADING like the real construction: the movement enters
// from the back, the plate's dial-side rim face rests on the case middle's
// seat, and the screw-down back closes behind it.
//
// Z CONVENTION, learned the hard way on the first cut of this builder: the
// DIAL side is −z (the Dial unit reaches −13.84; Z_DIAL = −7) and the back
// — the alarm barrel's side — is +z. The first cut assumed the reverse and
// put the caseback through the dial.
//
// Parts: the case middle (band + seat + bezel + back-wall flange, ONE lathe
// profile — the bore, plate seat, gasket groove, crystal seat, bezel lip
// and screw flange come off the same turning, which is how a real case
// middle is made), the screw-fixed EXHIBITION back (owner call over the
// screw-down: a flat plate on the back face, six screws into the flange,
// the window glazed from inside against the turned retaining lip; the
// plate's screw holes and the flange's threads are declared debt, same
// CSG-free family as the band's radial bores: the case unit is
// deliberately outside INTRA_TIER_SCOPE until that approach lands), the
// gasket cord half-seated in its back-face groove, the front crystal, the
// exhibition back crystal, lugs and spring bars, crown tubes and the flush
// alarm-pusher bore. Every face capped; each part its own named mesh so
// the unit labels and fingerprints like any other.
// dims — all measured/derived by the caller (main.js); nothing recomputed.
// ---------------------------------------------------------------------------
export function makeCase({ dims, material = MATS.steel, crystalMaterial }) {
  const {
    UNIT_MM, R_IN, R_OUT, R_CRYST, R_BEZEL_IN, R_SH, R_FL, R_SCR, R_G, R_WIN, R_PLATE,
    z0, zMidBack, zFlangeIn,
    zSeatBot, zSeatTop, zBandFront, zCrystInner, zCrystOuter, zBezelOuter,
    gasketD, gasketSeat, crystT, screwN, screwShaftD, screwHeadD, tubeD, pusherD,
    stemAz, alarmAz, pusherAz, stemZ, alarmZ, pusherZ,
    lugSpan,
  } = dims;
  const g = new THREE.Group();
  g.name = 'case';
  // A lathe is a SURFACE of revolution, so it is a SOLID only if its profile
  // closes in the r–z half-plane: either the last point returns to the first,
  // or both ends sit on the axis (r = 0), where the revolution closes itself.
  // Anything else leaves an open annulus where the contour should have shut.
  //
  // That is not a cosmetic defect. `meshClearance` guards its BVH near-zeros
  // with `sampledVerdict`, a PARITY RAYCAST — it counts crossings, so it
  // assumes a closed solid (CLAUDE.md's trap list; TODO 27 measured the same
  // failure on the chain's opened rivets). Through a missing face the count
  // goes odd and the body reads as solid everywhere behind it: the first cut
  // of this builder shipped `caseMiddle` and `caseBack` open, and `inspection`
  // duly called four pairs FORBIDDEN — the movement's setting wheel, three
  // extrusions, a torus and a box all "inside" a band whose bore they sit a
  // clear millimetre inside of.
  //
  // The guard is here, at the helper, rather than in the check: the check
  // stays generic, and the next lathe body cannot ship open in silence.
  const lathe = (pts, seg = 96) => {
    const [rA, zA] = pts[0], [rB, zB] = pts[pts.length - 1];
    const closed = (Math.abs(rA - rB) < 1e-9 && Math.abs(zA - zB) < 1e-9)
      || (rA === 0 && rB === 0);
    if (!closed)
      console.warn(`makeCase: lathe profile is OPEN — ends (${rA.toFixed(3)}, ${zA.toFixed(3)}) and `
        + `(${rB.toFixed(3)}, ${zB.toFixed(3)}) neither coincide nor both sit on the axis (r = 0); `
        + `the parity raycast will read this body as solid behind the missing face`);
    const geo = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg);
    geo.rotateX(Math.PI / 2); // lathe axis Y → +Z, house convention
    return geo;
  };

  // Case middle: bore from the flange's inner face → plate seat shoulder →
  // bore → crystal seat chamfer → seat ledge → bezel wall → lip over the
  // crystal → bezel outer face → outer wall → back face (with the gasket
  // groove) → the back-wall flange that carries the back screws. One closed
  // profile, one turning — which is how a real case middle comes off the
  // lathe.
  const middle = new THREE.Mesh(lathe([
    [R_IN, zFlangeIn],
    [R_IN, zSeatBot], [R_SH, zSeatBot], [R_SH, zSeatTop], [R_IN, zSeatTop],
    [R_IN, zBandFront],
    [R_CRYST, zCrystInner], [R_CRYST + 1 / UNIT_MM, zCrystInner],
    [R_BEZEL_IN + 0.3 / UNIT_MM, zCrystOuter],
    [R_BEZEL_IN, zCrystOuter], [R_BEZEL_IN, zBezelOuter],
    [R_OUT, zBezelOuter], [R_OUT, zMidBack],
    [R_G + 0.35 / UNIT_MM, zMidBack],
    [R_G + 0.35 / UNIT_MM, zMidBack - gasketSeat / 2],
    [R_G - 0.35 / UNIT_MM, zMidBack - gasketSeat / 2],
    [R_G - 0.35 / UNIT_MM, zMidBack],
    [R_FL, zMidBack], [R_FL, zFlangeIn],
    [R_IN, zFlangeIn],   // ...and back to the start along the flange's INNER
                         // annular face, the one the movement passes through:
                         // the turning's last cut, and what shuts the contour
  ]), material);
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

  // Screw-fixed exhibition back (owner call, over the thread: simpler bench
  // work — no thread to single-point, no wrench teeth, and the axial stack
  // the thread needed is simply gone). A flat plate sitting ON the middle's
  // back face, 1.2 mm thick = lip (0.6) + crystal (0.6), the window glazed
  // from inside against the retaining lip — the standard exhibition stack.
  // The screw holes through the plate and the threads in the flange are
  // declared CSG debt, same family as the band's radial bores.
  const lipW = 1.2 / UNIT_MM;          // retaining-lip radial width
  const lipT = 0.6 / UNIT_MM;          // retaining-lip thickness
  const zCrystOut = z0 - lipT;         // back crystal outer face, lip-flush
  const zCrystIn = zCrystOut - crystT; // ≈ zMidBack: flush with the plate's underside
  const SEAT_EMBED = 0.01 / UNIT_MM;   // the plate's underside sinks a
  // hundredth into the back face — exact-coplanar contact faces z-fight
  // (the front crystal escapes this because its seat ledge never overlaps
  // it radially); a sub-visible embed is the press-contact idiom.
  const zSeat = zMidBack - SEAT_EMBED;
  const back = new THREE.Mesh(lathe([
    [R_WIN - lipW, z0], [R_PLATE, z0], [R_PLATE, zSeat],
    [R_WIN, zSeat], [R_WIN, zCrystOut], [R_WIN - lipW, zCrystOut],
    [R_WIN - lipW, z0],  // the retaining lip's own BORE, back up to the outer
                         // face — the window's edge is metal, and it is what
                         // closes this contour
  ]), material);
  back.name = 'caseBack';
  backAsm.add(back);
  // The back crystal itself — same stock as the front (CASE_CRYSTAL_T),
  // seated against the lip; it travels WITH the plate in the explode.
  const backCrystal = new THREE.Mesh(lathe([
    [0, zCrystIn], [R_WIN, zCrystIn], [R_WIN, zCrystOut], [0, zCrystOut],
  ]), crystalMaterial);
  backCrystal.name = 'caseBackCrystal';
  backAsm.add(backCrystal);
  // The screws: heads flush in a 0.4 mm counterbore, shafts through the
  // plate and 0.7 mm of thread engagement in the 1.0 mm flange. They hold
  // the plate, so they travel with it.
  const headT = 0.4 / UNIT_MM;
  const screwEng = 0.7 / UNIT_MM;
  for (let i = 0; i < screwN; i++) {
    const a = (i / screwN) * Math.PI * 2;
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(screwHeadD / 2, screwHeadD / 2, headT, 20), material);
    head.geometry.rotateX(Math.PI / 2);            // axis → Z
    head.position.set(Math.cos(a) * R_SCR, Math.sin(a) * R_SCR, z0 - headT / 2);
    head.name = 'caseBackScrew';
    backAsm.add(head);
    const shaftTop = z0 - headT, shaftBot = zMidBack - screwEng;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(screwShaftD / 2, screwShaftD / 2, shaftTop - shaftBot, 12), material);
    shaft.geometry.rotateX(Math.PI / 2);
    shaft.position.set(Math.cos(a) * R_SCR, Math.sin(a) * R_SCR, (shaftTop + shaftBot) / 2);
    shaft.name = 'caseBackScrew';
    backAsm.add(shaft);
  }
  // Gasket: the cord half-seated in the back-face groove, the plate
  // squeezing it to the stated 20% (the stack that makes the rating claim
  // honest — compression now comes from the screws, not a thread).
  const gasket = new THREE.Mesh(
    new THREE.TorusGeometry(R_G, gasketD / 2 * 0.8, 10, 96), MATS.dark);
  gasket.name = 'caseGasket';
  gasket.position.z = zMidBack;
  backAsm.add(gasket);

  // Crystal: flat mineral disc with relieved edge, seated on the ledge.
  const crystal = new THREE.Mesh(lathe([
    [0, zCrystInner], [R_CRYST, zCrystInner], [R_CRYST, zCrystOuter], [0, zCrystOuter],
  ]), crystalMaterial);
  crystal.name = 'caseCrystal';
  frontAsm.add(crystal);

  // Crown tubes (Ø2.0 mm) and the flush alarm-pusher bore (Ø1.2 mm), each AT
  // ITS STEM'S OWN Z (a tube at mid-band would sleeve nothing): from inside
  // the bore to 1.5 mm proud of the band, with a 0.5 mm collar. The band's
  // radial bores they pass through are the same CSG debt as the thread
  // grooves.
  // The tube's own metal. COLLAR_PROUD is the flange's radius over the bore
  // and predates this; TUBE_WALL is derived FROM it by the constraint that a
  // flange has to stand proud of the wall it flanges — 0.3 mm of wall under a
  // 0.4 mm collar leaves 0.1 mm of shoulder, and 0.3 mm is ordinary tube stock
  // for a Ø2.0 mm bore. Assert rather than assume: swap the two and the collar
  // silently becomes a groove.
  const COLLAR_PROUD = 0.4 / UNIT_MM;
  const TUBE_WALL = 0.3 / UNIT_MM;
  if (TUBE_WALL >= COLLAR_PROUD)
    console.warn(`makeCase: tube wall ${(TUBE_WALL * UNIT_MM).toFixed(2)} mm is not under the collar's `
      + `${(COLLAR_PROUD * UNIT_MM).toFixed(2)} mm proud radius — the collar is no longer a flange`);
  // `flush` is the pusher's case, and it is the difference between a crown
  // TUBE and a pusher BORE — the two things this builder was making the same
  // way. A crown tube stands 1.5 mm proud and carries a collar, because a
  // crown has to be gripped clear of the band; a flush bore stops AT the band
  // and has neither, which is what "discreet" (the owner's word, layout.js)
  // means in metal. Built proud, its collar landed inside the §43 pusher head
  // — a 2 mm cap whose inner face is at R_OUT + 1 mm, exactly where the collar
  // began — so the two occupied the same 0.5 mm of the pusher's axis.
  const tubeAt = (az, d, z, name, flush = false) => {
    const r = d / 2;
    const outboard = flush ? R_OUT : R_OUT + 1.5 / UNIT_MM;
    const len = outboard - (R_IN - 1 / UNIT_MM);
    // The stems' own convention (windSpinner et al.): cylinder axis Y, the
    // pivot's z-rotation maps +Y outboard along the azimuth. No intermediate
    // holder — a rotated frame would throw the radial offsets into z.
    const pivot = new THREE.Group();
    pivot.rotation.z = az - Math.PI / 2;
    pivot.position.z = z;
    // A CAPPED SLEEVE, not a bore surface. This was an open-ended cylinder at
    // the bore radius: a wall of no thickness, open at both ends — which is a
    // SURFACE, and `d` is the tube's BORE (layout.js), so the metal it stands
    // for was never modelled at all. The parity raycast reads an unclosed body
    // as solid behind it, so all three of these read as fouling the stems they
    // are supposed to sleeve. ringExtrude caps both ends by construction.
    const sleeve = new THREE.Mesh(ringExtrude(r + TUBE_WALL, r, len, 20), material);
    sleeve.geometry.rotateX(-Math.PI / 2);  // ringExtrude runs +Z; the stems run +Y
    sleeve.position.y = (R_IN - 1 / UNIT_MM) + len / 2;
    sleeve.name = `${name}Sleeve`;
    pivot.add(sleeve);
    // Collar: the tube's outer flange, 0.5 mm tall, 0.4 mm proud radius —
    // BORED to the same r as the sleeve it flanges. It was a solid disc, so
    // the stem it exists to sleeve ran through its metal: a flange on a tube
    // is an annulus, and the bore does not stop because the wall got thicker.
    // A flush bore has no flange at all — there is nothing standing proud for
    // one to sit on.
    if (!flush) {
      const collar = new THREE.Mesh(ringExtrude(r + COLLAR_PROUD, r, 0.5 / UNIT_MM, 20), material);
      collar.geometry.rotateX(-Math.PI / 2);  // ringExtrude runs +Z; the stems run +Y
      collar.position.y = R_OUT + 1.25 / UNIT_MM;
      collar.name = `${name}Collar`;
      pivot.add(collar);
    }
    const grp = new THREE.Group();
    grp.add(pivot);
    grp.name = name;
    middleAsm.add(grp);
    return grp;
  };
  tubeAt(stemAz, tubeD, stemZ, 'caseCrownTube');
  tubeAt(alarmAz, tubeD, alarmZ, 'caseAlarmTube');
  tubeAt(pusherAz, pusherD, pusherZ, 'casePusherBore', true);   // flush — a bore, not a tube

  // Lugs at 12 and 6, spring-bar span per dims; each lug a prism
  // chord-tangent to the band and ROOTED 0.8 mm into it (the brazed
  // stamped-lug truth — a watchmaker solders the lug foot to the band,
  // so the prism must visibly sink into the wall, not kiss it; the
  // first-cut 0.3 mm embed read as a floating gap at screen scale and
  // let the tips breach the 40 mm width cap). The Ø1.5 mm spring bar
  // spans each pair.
  const lugT = 1.2 / UNIT_MM;            // lug thickness across the strap
  const lugH = 2.5 / UNIT_MM;            // radial reach out of the band
  const lugW = 3.0 / UNIT_MM;            // height along z
  const LUG_ROOT = 0.8 / UNIT_MM;        // embed into the band at the lug's own station
  for (const lugAz of [Math.PI / 2, -Math.PI / 2]) {
    const u = { x: Math.cos(lugAz), y: Math.sin(lugAz) };
    const perp = { x: -u.y, y: u.x };
    for (const s of [-1, 1]) {
      const off = s * lugSpan / 2;
      // The pair's lugs stay PARALLEL (the strap's sides are parallel), but
      // each one stands ±lugSpan/2 off the pair axis, where the band has
      // fallen away from R_OUT to the chord depth sqrt(R_OUT² − off²) —
      // 6+ units at an 18 mm span. Root the foot 0.8 mm past THAT surface
      // (the brazed stamped-lug truth: the foot is bent to the band radius
      // and soldered), keep the tip at R_OUT + lugH − LUG_ROOT (52.7 u ≈
      // 39.9 mm across — inside the 40 mm cap), and let the length derive.
      const surfR = Math.sqrt(Math.max(R_OUT * R_OUT - off * off, 0));
      const root = surfR - LUG_ROOT, tip = R_OUT + lugH - LUG_ROOT;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(lugT, tip - root, lugW), material);
      lug.position.set(u.x * (root + tip) / 2 + perp.x * off,
                       u.y * (root + tip) / 2 + perp.y * off,
                       zSeatTop + lugW / 2 + 0.5 / UNIT_MM);
      lug.rotation.z = lugAz - Math.PI / 2;
      lug.name = 'caseLug';
      middleAsm.add(lug);
    }
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75 / UNIT_MM, 0.75 / UNIT_MM, lugSpan - lugT, 12), material);
    bar.geometry.rotateX(Math.PI / 2);   // axis → Z
    bar.geometry.rotateY(Math.PI / 2);   // axis → X
    bar.rotation.z = lugAz + Math.PI / 2; // X → the strap direction
    bar.position.set(u.x * (R_OUT + lugH - LUG_ROOT - 0.3 / UNIT_MM),
                     u.y * (R_OUT + lugH - LUG_ROOT - 0.3 / UNIT_MM),
                     zSeatTop + lugW / 2 + 0.5 / UNIT_MM);
    bar.name = 'caseSpringBar';
    middleAsm.add(bar);
  }

  // The §62 keep sweep enrolls any mesh whose box crosses the three-quarter
  // plate's z-band as "material the plate must carry". The case band
  // encloses the plate BY DESIGN — it is the world's fixture, not a load on
  // the plate — so its meshes opt out here, on the part, where the claim is
  // made, rather than in the check, which stays generic.
  g.traverse((o) => { if (o.isMesh) o.userData.casePart = true; });
  g.userData.r = R_OUT;
  g.userData.assemblies = { middle: middleAsm, back: backAsm, front: frontAsm };
  return g;
}
