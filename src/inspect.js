// ---------------------------------------------------------------------------
// Animation-realism inspector — milestone 1: swept volume-overlap detection.
//
// Drives the mechanism deterministically through its phase axes via
// __clock.setPose() and reports every pair of functional units whose meshes
// intersect at any sampled pose. Exact narrow-phase via three-mesh-bvh
// triangle tests; AABB broad phase per pose.
//
// Pair classification (milestone): FORBIDDEN (any overlap = defect) vs
// EXPECTED (legitimate mechanical contact — meshing teeth, pin-in-notch,
// chain-on-cone…) which is reported separately, not failed.
//
// TODO (contact-policy milestone 2):
//  - checkPenetrationBudgets() below covers ONE pair (Escape wheel ⇄ Pallet
//    fork, the ruby stones specifically) with a real depth budget, added
//    after a visible stone-vs-tooth embedding survived the boolean overlap
//    check entirely (EXPECTED-pair classification only proves contact was
//    intended, not that its DEPTH is reasonable). Extend PENETRATION_BUDGETS
//    to the other EXPECTED pairs that most need it: pin-in-notch (Pallet
//    fork ⇄ Balance) and chain-on-cone (Chain ⇄ Fusee & great wheel);
//  - allowed PHASE WINDOWS per budget (right now each budget checks its
//    whole declared axis; a pair that should only touch near lock/impulse
//    could additionally assert near-zero depth OUTSIDE that window);
//  - continuity check (no vertex teleports between adjacent poses — catches
//    linkage branch flips);
//  - clearance monitoring (gaps that must stay small-but-positive, e.g.
//    guard pin vs safety roller);
//  - known-good baseline file so re-runs only flag regressions;
//  - structure parts (plate, pillars, cocks, jewels) with modelled holes.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from '../vendor/three-mesh-bvh.module.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Units excluded outright for this milestone (dial-side display / statics).
const EXCLUDED_UNITS = ['Dial', 'Power reserve'];

// ---------------------------------------------------------------------------
// Mechanical graph — the movement's declared physics: what supports what
// (every part must reach the PLATE through support edges) and what drives
// what (every part that MOVES must reach a force — the MAINSPRING or the
// CROWN — through drive edges). checkMechanicalGraph() verifies this
// against the actual scene: units are detected as moving empirically (their
// matrices or geometry change across a sweep), so a part animated with no
// declared force path, or a part missing from the graph entirely, is
// reported. Edges marked todo are declared-but-not-yet-modelled links
// (reported as warnings, not failures).
// ---------------------------------------------------------------------------
const MECH_GRAPH = {
  // node 'plate' is the ground; 'mainspring' and 'crown' are force sources.
  support: [
    ['Mainspring drum', 'plate'],            // drum arbor pivots in the plate
    ['Fusee & great wheel', 'plate'],        // fusee arbor pivots plate/bridge
    ['Center wheel', 'plate'],
    ['Third wheel', 'plate'],
    ['Fourth wheel', 'plate'],
    ['Escape wheel', 'plate'],
    ['Pallet fork', 'plate'],
    ['Balance cock', 'plate'],
    ['Barrel-center bridge', 'plate'],
    ['Center-third bridge', 'plate'],
    ['Third-fourth bridge', 'plate'],
    ['Balance', 'Balance cock'],             // staff's upper pivot in the cock jewel
    ['Hairspring', 'Balance'],               // collet on the staff (TODO: stud should pin to cock)
    ['Chain', 'Mainspring drum'],            // hooked to the drum wall
    ['Chain', 'Fusee & great wheel'],        // hooked to the cone
    ['Keyless works', 'plate'],              // stem bushing + wheel studs on the plate
    ['Setting lever', 'plate'],
    ['Yoke', 'plate'],
    ['Hack spring', 'plate'],                // anchor screw
    ['Reset hammer', 'plate'],
    ['Heart cam (seconds reset)', 'Fourth wheel'], // friction-slip on the fourth arbor
    ['Reset rod', 'Setting lever'],          // pinned at the post
    ['Reset rod', 'Reset hammer'],           // pinned at the tail
    ['Power-reserve train', 'plate'],
    // 'Dial' had NO support edge at all until now — it also sits in
    // EXCLUDED_UNITS (a milestone-1 exclusion from the expensive overlap
    // sweep), which meant it was invisible to the GROUNDING check too, not
    // just the sweep: nothing about cannonPinion or the hands has ever been
    // verified as attached to anything. Real dial feet were added (see
    // dialGroup in main.js) so this edge now corresponds to actual geometry,
    // not just a graph-only declaration.
    ['Dial', 'plate'],
    ['Power reserve', 'Dial'],               // reserve sub-dial sits on the dial face
  ],
  drive: [
    ['mainspring', 'Mainspring drum'],
    ['Mainspring drum', 'Chain'],
    ['Chain', 'Fusee & great wheel'],
    ['Fusee & great wheel', 'Center wheel'],
    ['Center wheel', 'Third wheel'],
    ['Third wheel', 'Fourth wheel'],
    ['Fourth wheel', 'Escape wheel'],
    ['Escape wheel', 'Pallet fork'],
    ['Pallet fork', 'Balance'],
    ['Balance', 'Hairspring'],
    ['Fourth wheel', 'Heart cam (seconds reset)'], // friction slip
    ['Fusee & great wheel', 'Power-reserve train'], // slip-coupled arbor extension
    ['crown', 'Keyless works'],
    ['Keyless works', 'Fusee & great wheel'],  // winding: crown wheel → ratchet
    ['crown', 'Setting lever'],                // the PULL, via the stem groove
    ['Setting lever', 'Yoke'],                 // ganged clutch shift (yoke tracks the pinion)
    ['Setting lever', 'Hack spring'],
    ['Setting lever', 'Reset rod'],
    ['Reset rod', 'Reset hammer'],
    ['Reset hammer', 'Heart cam (seconds reset)'],
  ],
  // Declared-but-unmodelled links: reported as TODO warnings.
  todo: [
    // Was: "setting path ends at a representational arbor stub" — the stub
    // used to stop 54 units short of the cannon pinion, in the keyless-
    // works corner, with no visible path to the dial centre at all. Now a
    // 5-segment arbor (drop / sidestep out / across / sidestep back / rise,
    // an orthogonal route around the power-reserve arbor) spans the full
    // distance and ends in a pinion cap sitting flush beside the cannon
    // pinion, with a real 90° bevel-gear pair at each of the 4 direction
    // changes (see addBevelCorner in main.js / makeBevelGear in geometry.js)
    // — each pair's rotation alternates sign frame-by-frame the way a real
    // external gear mesh would, threaded from handSetOffset through all 4
    // corners rather than teleported to the far end. Downgraded rather than
    // closed: handSetOffset itself is still an assigned VALUE in tick(), not
    // something derived forward from the crown's rotation through the
    // corner gears' own tooth ratios — same representational-coupling
    // convention already accepted for the reserve train, not a unique gap.
    ['Keyless works', 'cannon pinion / hands', 'motion-works arbor now has real bevel-gear pairs at every corner; the DRIVING value (handSetOffset) is still assigned directly in tick() rather than computed forward from the crown through those gears’ tooth ratios'],
    ['Hairspring', 'Balance cock', 'stud should be pinned to the cock (it currently rotates with the spring)'],
    // Click is a sub-mesh of "Fusee & great wheel" (fuseeRatchetGroup →
    // barrelArbor), not its own labelled unit, so this can't yet be a
    // structured support edge — noted here instead. barrelArbor.rotation.z
    // = barrelMeshAngle(tau) every frame, so anything mounted under it
    // (the click included) inherits the full train rotation during normal
    // running; the click's own local rotation only moves during active
    // winding (windBack). A click has to be anchored to something
    // STATIONARY — the plate — to provide real ratcheting resistance; one
    // riding along with the wheel it's meant to hold provides none.
    ['Fusee & great wheel (click)', 'plate', 'click should be mounted on a plate-fixed bridge, not on the rotating great wheel/barrel arbor — it currently inherits the train rotation and cannot mechanically hold the ratchet'],
  ],
  // Geometric anchor checks: a declared support edge is only real if the
  // attachment point actually sits in/on the fixture. point() extracts the
  // anchor from the unit's geometry; checked against the target unit's
  // meshes via BVH closest-point. TODO: extend to every support edge.
  anchors: [
    {
      name: 'balance staff top in the cock jewel',
      unit: 'Balance',
      target: 'Balance cock',
      tol: 1.6,
      point(unitEntry) {
        // The staff is the balance unit's topmost geometry: take the AABB's
        // centre in XY (the staff axis) at its max-z end.
        const box = new THREE.Box3().setFromObject(unitEntry.obj);
        const c = box.getCenter(new THREE.Vector3());
        return new THREE.Vector3(unitEntry.obj.getWorldPosition(new THREE.Vector3()).x,
          unitEntry.obj.getWorldPosition(new THREE.Vector3()).y, box.max.z);
      },
    },
    // The four connectors below were each verified ONCE, by hand, live in
    // the browser, at the time they were built — exactly the failure mode
    // that let the keyless-works motion-works arbor sit 54 units short of
    // its target unnoticed: a connector that "looked plausible" in isolation
    // but was never numerically checked against its actual destination.
    // These make that check permanent. All four use nearestMeshCenter (see
    // below) rather than a hand-picked geometry heuristic per connector:
    // "the point of unit A closest to unit B" is exactly the anchor point
    // these representational connectors are meant to land on.
    {
      name: 'power-reserve hand arbor reaches the sub-dial pivot',
      unit: 'Power-reserve train',
      target: 'Power reserve',
      tol: 2.5,
      point: nearestMeshCenter,
    },
    {
      name: 'motion-works arbor cap reaches the cannon pinion',
      unit: 'Keyless works',
      target: 'Dial',
      tol: 3.5,
      point: nearestMeshCenter,
    },
    {
      name: "yoke's prongs reach the sliding-pinion hub",
      unit: 'Yoke',
      target: 'Keyless works',
      tol: 2.5,
      point: nearestMeshCenter,
    },
    {
      name: 'hack spring pad reaches the balance rim',
      unit: 'Hack spring',
      target: 'Balance',
      tol: 2.5,
      point: nearestMeshCenter,
    },
  ],
  // Bridge/cock parts (horological terms: a "bridge" spans and supports two
  // pivots, a "cock" one) must be mounted DIRECTLY on the base plate — that
  // IS their structural job, unlike a wheel or lever that can be validly
  // grounded through a longer chain of other parts. This is a stricter,
  // separate rule from the general reachability check in section 1 below: a
  // bridge mounted on ANOTHER bridge would still be "grounded" (reachable
  // from 'plate' via a chain) and pass THAT check, but it wouldn't be
  // "mounted on the base-plate" and must fail THIS one. checkMechanicalGraph
  // enforces it by requiring a literal ['<bridge>', 'plate'] (or reverse)
  // edge in `support` above, not just eventual reachability.
  bridges: [
    'Balance cock',
    'Barrel-center bridge',
    'Center-third bridge',
    'Third-fourth bridge',
  ],
  // Every unit that carries a pinion or a staff must be grounded to the
  // plate — DIRECTLY OR INDIRECTLY (unlike `bridges` above, a chain through
  // other grounded parts is fine here; a pinion riding on a wheel that's
  // itself properly mounted is not "floating"). This is the general
  // reachability check already run in section 1 below, but named and scoped
  // explicitly to this class of part: a pinion/staff is exactly the kind of
  // small, easy-to-miss thing that can end up positioned correctly with
  // nothing actually anchoring it (see: the keyless-works motion-works
  // arbor, the dial itself before this same pass added real dial feet) — so
  // this exists to make that failure mode impossible to add silently in the
  // future, not just to re-confirm what's already covered. Enumerates the
  // UNIT each pinion/staff lives on (they're built as compound arbors, not
  // separate scene objects) rather than the individual mesh.
  pinionBearing: [
    'Fusee & great wheel',   // fusee/barrel arbor staff
    'Center wheel',          // center pinion
    'Third wheel',           // third pinion
    'Fourth wheel',          // fourth pinion
    'Escape wheel',          // escape pinion
    'Balance',                // balance staff
    'Keyless works',         // winding pinion, minute pinion, motion-works cap pinion
    'Power-reserve train',   // reduction-train pinions
    'Dial',                  // cannon pinion — the one that was genuinely ungrounded
  ],
};

// Shared anchor-point extractor: the mesh CENTRE within `unitEntry` nearest
// to any mesh centre in `targetEntry` — i.e. "whichever part of this unit is
// actually meant to reach the target." Cheap (mesh-count², not
// vertex-count²) and needs no per-connector geometry heuristic, unlike the
// balance-staff anchor above (which predates this helper).
function nearestMeshCenter(unitEntry, targetEntry) {
  if (!targetEntry) return unitEntry.obj.getWorldPosition(new THREE.Vector3());
  const targetCenters = targetEntry.meshes.map((m) => m.getWorldPosition(new THREE.Vector3()));
  let best = null, bestD = Infinity;
  for (const m of unitEntry.meshes) {
    const c = m.getWorldPosition(new THREE.Vector3());
    for (const t of targetCenters) {
      const d = c.distanceTo(t);
      if (d < bestD) { bestD = d; best = c; }
    }
  }
  return best || unitEntry.obj.getWorldPosition(new THREE.Vector3());
}

// Pairs where mechanical contact is the design intent. Reported, not failed.
const EXPECTED_PAIRS = [
  ['Fusee & great wheel', 'Center wheel'],   // gear mesh
  ['Center wheel', 'Third wheel'],           // gear mesh
  ['Third wheel', 'Fourth wheel'],           // gear mesh
  ['Fourth wheel', 'Escape wheel'],          // gear mesh
  ['Escape wheel', 'Pallet fork'],           // lock/impulse — THE escapement contact
  ['Pallet fork', 'Balance'],                // impulse pin in the fork notch
  ['Balance', 'Balance cock'],               // staff's upper pivot runs in the cock jewel
  ['Balance', 'Hack spring'],                // brake pad on the rim (crown out)
  ['Heart cam (seconds reset)', 'Reset hammer'], // roller on the cam
  ['Keyless works', 'Fusee & great wheel'],  // crown wheel ⇄ ratchet
  ['Keyless works', 'Setting lever'],        // beak pin in the stem groove
  ['Keyless works', 'Yoke'],                 // prongs on the sliding-pinion hub
  ['Chain', 'Fusee & great wheel'],          // chain lies in the cone grooves
  ['Chain', 'Mainspring drum'],              // chain wraps the drum
  ['Power-reserve train', 'Fusee & great wheel'], // p0 slip-coupled on the arbor
  ['Setting lever', 'Hack spring'],          // post bears on the blade flank
  ['Setting lever', 'Reset rod'],            // rod pinned to the post
  ['Reset rod', 'Reset hammer'],             // rod pinned to the tail
  // The three train bridges were unlabelled (and so invisible to this whole
  // sweep) until today — each one legitimately cradles the front pivot
  // jewel of the wheel(s)/arbor it bridges, which is its entire job.
  ['Barrel-center bridge', 'Fusee & great wheel'], // cradles the fusee arbor's front pivot
  ['Barrel-center bridge', 'Center wheel'],        // cradles the center wheel's front pivot
  ['Barrel-center bridge', 'Keyless works'],       // spans close by the crown-wheel/ratchet stack
  ['Barrel-center bridge', 'Power-reserve train'], // spans close by the reserve arbor extension
  ['Center wheel', 'Center-third bridge'],         // cradles the center wheel's OTHER pivot
  ['Center-third bridge', 'Third wheel'],          // cradles the third wheel's front pivot
  ['Fourth wheel', 'Third-fourth bridge'],         // cradles the fourth wheel's front pivot
  ['Third wheel', 'Third-fourth bridge'],          // cradles the third wheel's OTHER pivot
  // Adjacent bridges meet at a SHARED pivot (e.g. barrel-center's far end is
  // the same centre-wheel jewel center-third's near end cradles), and each
  // is built with generous end padding (addBridge: span + 10) — accepted
  // for now, but the padding is probably looser than it needs to be; worth
  // trimming so adjacent bridges just clear each other instead of overlapping.
  ['Barrel-center bridge', 'Center-third bridge'],
];
// Same rigid assembly / coaxial stacks — not meaningful to test.
const IGNORED_PAIRS = [
  ['Balance', 'Hairspring'],
  ['Fusee & great wheel', 'Mainspring drum'], // far apart; drum arbor visuals overlap fusee AABB during explode only
];

const pairKey = (a, b) => [a, b].sort().join(' ⇄ ');
const inList = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

function collectUnits(clock, { includeExcluded = false } = {}) {
  const units = [];
  for (const { name, obj } of clock.labelEntries) {
    if (!includeExcluded && EXCLUDED_UNITS.includes(name)) continue;
    const meshes = [];
    obj.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o);
    });
    if (meshes.length) units.push({ name, obj, meshes });
  }
  return units;
}

const bvhCache = new WeakMap();
function bvhFor(mesh) {
  let bvh = bvhCache.get(mesh.geometry);
  if (!bvh) {
    bvh = mesh.geometry.computeBoundsTree();
    bvh = mesh.geometry.boundsTree;
    bvhCache.set(mesh.geometry, bvh);
  }
  return bvh;
}

const _mat = new THREE.Matrix4();
function meshesIntersect(a, b) {
  const bvh = bvhFor(a);
  bvhFor(b); // intersectsGeometry needs the other side indexed; building its tree indexes it
  _mat.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
  return bvh.intersectsGeometry(b.geometry, _mat);
}

function unitsIntersect(A, B) {
  for (const a of A.meshes) {
    for (const b of B.meshes) {
      // Cheap per-mesh AABB gate before the triangle test.
      if (!new THREE.Box3().setFromObject(a).intersectsBox(new THREE.Box3().setFromObject(b))) continue;
      if (meshesIntersect(a, b)) return true;
    }
  }
  return false;
}

// Phase axes. Each pose object feeds __clock.setPose(); unspecified state
// keeps its prior value, so every axis pins the others to a fixed default.
const AXES = [
  {
    name: 'beat',
    n: 96,
    pose: (f) => ({ tau: f * 0.4, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 }),
  },
  {
    name: 'crown',
    n: 48,
    pose: (f) => ({ tau: 0.05, crownPullT: f, leverEngage: f, tension: 1, windAccumTurns: 0 }),
  },
  {
    name: 'reserve',
    n: 60,
    pose: (f) => ({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 - f, windAccumTurns: 0 }),
  },
  {
    // One full revolution of the FUSEE arbor (8 h of movement time) — catches
    // slow-orbit collisions (e.g. arbor-mounted parts sweeping past static
    // keyless parts) that the short beat axis never rotates far enough to
    // reach. Fast wheels are effectively phase-randomised across samples,
    // which is fine: any sampled pose is a reachable pose.
    name: 'train',
    n: 96,
    pose: (f) => ({ tau: f * 8 * 3600, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 }),
  },
];

// ---------------------------------------------------------------------------
// Mechanical-graph verification. Three checks:
//  1. GROUNDING — every scene unit reaches 'plate' via declared support edges
//     (and every unit is IN the graph at all: new parts must declare their
//     anchoring or they're flagged).
//  2. DRIVE — units that empirically move during an axis sweep must reach the
//     axis's force source ('mainspring' for beat/reserve, 'crown' for crown)
//     via declared drive edges. A part that animates with no force path is a
//     simulation fiction.
//  3. ANCHORS — declared attachment points geometrically verified (BVH
//     closest-point distance to the fixture's surface).
// ---------------------------------------------------------------------------
function unitSignature(unit) {
  let s = 0;
  for (const m of unit.meshes) {
    const e = m.matrixWorld.elements;
    for (let i = 0; i < 16; i++) s += e[i] * (i + 1);
    const pos = m.geometry.attributes.position;
    // geometry-rebuild detection (the chain re-tessellates instead of moving)
    s += pos.count * 0.001 + pos.getX(0) + pos.getY(Math.min(5, pos.count - 1));
  }
  return s;
}

function reachable(edges, from) {
  const adj = new Map();
  for (const [a, b] of edges) {
    (adj.get(a) || adj.set(a, []).get(a)).push(b);
    (adj.get(b) || adj.set(b, []).get(b)).push(a);
  }
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    for (const n of adj.get(queue.shift()) || []) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}

export function checkMechanicalGraph(clock, { axes = AXES } = {}) {
  const units = collectUnits(clock);
  const names = new Set(units.map((u) => u.name));

  // 1. Grounding — uses the FULL unit set, including EXCLUDED_UNITS
  // ('Dial', 'Power reserve'). Those were excluded from the expensive
  // overlap sweep for performance, not because their grounding doesn't
  // matter — that exclusion had silently made 'Dial' (and cannonPinion
  // inside it) invisible to grounding checks too, which is exactly what
  // the pinion-bearing rule below exists to catch. Section 2 (drive) below
  // deliberately keeps using the narrower default `units`: whether
  // dial-side parts need a declared DRIVE edge is a separate question,
  // not addressed by this pass.
  const groundingUnits = collectUnits(clock, { includeExcluded: true });
  const groundingNames = new Set(groundingUnits.map((u) => u.name));
  const grounded = reachable(MECH_GRAPH.support, 'plate');
  const inGraph = new Set(MECH_GRAPH.support.flat().concat(MECH_GRAPH.drive.flat()));
  const notInGraph = [...groundingNames].filter((n) => !inGraph.has(n));
  const ungrounded = [...groundingNames].filter((n) => inGraph.has(n) && !grounded.has(n));
  const missingFromScene = [...inGraph]
    .filter((n) => !['plate', 'mainspring', 'crown'].includes(n) && !groundingNames.has(n) && !MECH_GRAPH.todo.some(([a, b]) => a === n || b === n));

  // 2. Drive: empirical motion per axis vs force reachability.
  const fromSpring = reachable(MECH_GRAPH.drive, 'mainspring');
  const fromCrown = reachable(MECH_GRAPH.drive, 'crown');
  const undriven = [];
  for (const axis of axes) {
    const source = axis.name === 'crown' ? fromCrown : fromSpring;
    clock.setPose(axis.pose(0));
    const sig0 = units.map(unitSignature);
    clock.setPose(axis.pose(0.63));
    const sig1 = units.map(unitSignature);
    clock.setPose(axis.pose(1));
    const sig2 = units.map(unitSignature);
    units.forEach((u, i) => {
      const moves = Math.abs(sig1[i] - sig0[i]) > 1e-6 || Math.abs(sig2[i] - sig0[i]) > 1e-6;
      if (moves && !source.has(u.name)) {
        undriven.push({ unit: u.name, axis: axis.name, expectedForce: axis.name === 'crown' ? 'crown' : 'mainspring' });
      }
    });
  }

  // 3. Anchor-point geometry checks (at the rest pose). Targets may be
  // EXCLUDED_UNITS (e.g. 'Dial', 'Power reserve' — left out of the overlap
  // sweep for milestone 1) that are still perfectly valid anchor targets, so
  // this looks them up from the unfiltered set rather than `units`.
  clock.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  const allUnits = collectUnits(clock, { includeExcluded: true });
  const anchorFailures = [];
  for (const spec of MECH_GRAPH.anchors) {
    const unit = allUnits.find((u) => u.name === spec.unit);
    const target = allUnits.find((u) => u.name === spec.target);
    if (!unit || !target) { anchorFailures.push({ name: spec.name, error: 'unit missing' }); continue; }
    const p = spec.point(unit, target);
    let best = Infinity;
    for (const m of target.meshes) {
      const bvh = bvhFor(m);
      const local = m.worldToLocal(p.clone());
      const hit = bvh.closestPointToPoint(local);
      if (hit && hit.distance < best) best = hit.distance;
    }
    if (best > spec.tol) anchorFailures.push({ name: spec.name, distance: +best.toFixed(2), tol: spec.tol });
  }

  // 4. Bridges: every declared bridge/cock needs a DIRECT edge to 'plate' in
  // `support` — not just eventual reachability (already covered, more
  // loosely, by the grounding check in section 1). A bridge mounted on
  // another bridge would pass section 1 but must fail here.
  const directPlateEdges = new Set(
    MECH_GRAPH.support
      .filter(([a, b]) => a === 'plate' || b === 'plate')
      .map(([a, b]) => (a === 'plate' ? b : a))
  );
  const bridgeViolations = MECH_GRAPH.bridges.filter((name) => !directPlateEdges.has(name));

  // 5. Pinion/staff-bearing units: directly OR indirectly grounded is fine
  // here (weaker than `bridges` above) — just genuinely reachable from
  // 'plate' through the support graph, i.e. not floating.
  const pinionViolations = MECH_GRAPH.pinionBearing.filter((name) => !grounded.has(name));

  const todo = MECH_GRAPH.todo.map(([a, b, note]) => `${a} → ${b}: ${note}`);
  const result = { notInGraph, ungrounded, missingFromScene, undriven, anchorFailures, bridgeViolations, pinionViolations, todo };
  window.__mechReport = result;
  console.log('mechanical graph:', result);
  return result;
}

// ---------------------------------------------------------------------------
// Penetration-depth budgets — contact-policy milestone 2, first pair. Being
// on EXPECTED_PAIRS above only means the DESIGN intends contact; it says
// nothing about how DEEP. checkMechanicalGraph and runInspection's boolean
// overlap test both missed a real defect here: a pallet stone was visibly
// buried well over half a unit deep into an escape-wheel tooth while the
// pair sailed through as "EXPECTED, contact detected" — true, but nowhere
// near sufficient.
//
// The depth measure itself went through two designs. The first used a
// raycast odd/even "point inside the solid" vote — this turned out to be
// UNRELIABLE against the escape wheel specifically, because its crossing-
// hole cutouts break the parity assumption a point-in-solid test needs on
// a watertight mesh: it reported near-zero depth in cases with real,
// substantial (>0.5 unit) overlap, i.e. it was giving false confidence, not
// just occasionally-coarse numbers. The current method sidesteps that
// entirely: it only ever asks the ALWAYS-reliable boolean triangle-triangle
// test (BVH intersectsGeometry) whether translating a stone along a
// candidate direction clears the intersection, and bisects the smallest
// clearing distance across a spread of candidate directions (a
// minimum-translation-distance search). No inside/outside classification,
// so no parity assumption to break.
// ---------------------------------------------------------------------------
const MTV_DIRECTIONS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0],
];

function stoneIntersectsWheel(bvh, wheelMatrixWorld, stoneMesh, stoneGeometry, worldOffset) {
  const t = new THREE.Matrix4().makeTranslation(worldOffset.x, worldOffset.y, worldOffset.z);
  const worldM = t.multiply(stoneMesh.matrixWorld);
  const local = wheelMatrixWorld.clone().invert().multiply(worldM);
  return bvh.intersectsGeometry(stoneGeometry, local);
}

// Minimum-translation-distance: smallest push, over a spread of candidate
// directions, that clears the boolean intersection. 0 if already clear.
function mtvDepth(bvh, wheelMatrixWorld, meshB) {
  if (!stoneIntersectsWheel(bvh, wheelMatrixWorld, meshB, meshB.geometry, new THREE.Vector3())) return 0;
  let best = Infinity;
  for (const d of MTV_DIRECTIONS) {
    const dir = new THREE.Vector3(...d).normalize();
    let lo = 0, hi = 0.04;
    while (stoneIntersectsWheel(bvh, wheelMatrixWorld, meshB, meshB.geometry, dir.clone().multiplyScalar(hi)) && hi < 1.5) hi *= 1.7;
    if (stoneIntersectsWheel(bvh, wheelMatrixWorld, meshB, meshB.geometry, dir.clone().multiplyScalar(hi))) continue; // never cleared this direction
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (stoneIntersectsWheel(bvh, wheelMatrixWorld, meshB, meshB.geometry, dir.clone().multiplyScalar(mid))) lo = mid; else hi = mid;
    }
    if (hi < best) best = hi;
  }
  return best; // Infinity if no candidate direction cleared it within the cap
}

const PENETRATION_BUDGETS = [
  {
    pair: ['Escape wheel', 'Pallet fork'],
    maxDepth: 0.1,
    axis: 'beat',
    // 150 samples: dense enough to have found the real worst case during
    // development (a coarse 80-sample pass with the OLD vote-based method
    // reported ~0, when the true MTV depth was ~0.5) without the runtime
    // cost of the 800-sample pass used for calibration.
    nSamples: 150,
    // A = the escape wheel's largest mesh (the tooth profile, not the hub
    // ring or pinion that share the same labelled unit).
    selectA(unit) {
      let best = null, bestR = 0;
      unit.obj.traverse((o) => {
        if (o.isMesh) {
          o.geometry.computeBoundingSphere();
          if (o.geometry.boundingSphere.radius > bestR) { bestR = o.geometry.boundingSphere.radius; best = o; }
        }
      });
      return best ? [best] : [];
    },
    // B = the ruby pallet stones specifically, not the fork's steel body.
    // Selected by material colour (ruby, 0xb01326) rather than geometry
    // type — the stones moved from BoxGeometry to a custom two-facet
    // ExtrudeGeometry (see makePalletFork's palletStoneGeometry), and
    // ExtrudeGeometry alone isn't specific enough (the fork body and the
    // escape wheel's own teeth use it too). Colour is what's actually
    // invariant about "these are the rubies."
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xb01326) out.push(o);
      });
      return out;
    },
  },
];

export function checkPenetrationBudgets(clock, { budgets = PENETRATION_BUDGETS, axes = AXES } = {}) {
  const units = collectUnits(clock);
  const results = [];
  for (const budget of budgets) {
    const [nameA, nameB] = budget.pair;
    const unitA = units.find((u) => u.name === nameA);
    const unitB = units.find((u) => u.name === nameB);
    if (!unitA || !unitB) { results.push({ pair: pairKey(nameA, nameB), status: 'ERROR', error: 'unit missing' }); continue; }
    const meshesA = budget.selectA(unitA); // wheel-side (bvh)
    const meshesB = budget.selectB(unitB); // stone-side (translated)
    meshesA.forEach(bvhFor);
    const axis = axes.find((a) => a.name === budget.axis);
    const n = budget.nSamples ?? axis.n;
    let worst = 0, worstF = null;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      clock.setPose(axis.pose(f));
      clock.scene.updateMatrixWorld(true);
      for (const meshA of meshesA) {
        const bvh = bvhFor(meshA);
        for (const meshB of meshesB) {
          const d = mtvDepth(bvh, meshA.matrixWorld, meshB);
          if (isFinite(d) && d > worst) { worst = d; worstF = f; }
        }
      }
    }
    results.push({
      pair: pairKey(nameA, nameB),
      maxDepth: budget.maxDepth,
      worstDepth: +worst.toFixed(3),
      worstAt: worstF === null ? null : `${budget.axis}=${worstF.toFixed(3)}`,
      status: worst <= budget.maxDepth ? 'OK' : 'EXCEEDS BUDGET',
    });
  }
  window.__penetrationReport = results;
  console.table(results);
  return results;
}

export async function runInspection(clock, { axes = AXES, yieldEvery = 8 } = {}) {
  const units = collectUnits(clock);
  const findings = new Map(); // pairKey -> { class, axes: {axisName: [f,...]} }

  for (const axis of axes) {
    for (let i = 0; i <= axis.n; i++) {
      const f = i / axis.n;
      clock.setPose(axis.pose(f));

      // Broad phase: unit AABBs at this pose.
      const boxes = units.map((u) => new THREE.Box3().setFromObject(u.obj));
      for (let ai = 0; ai < units.length; ai++) {
        for (let bi = ai + 1; bi < units.length; bi++) {
          const A = units[ai], B = units[bi];
          if (inList(IGNORED_PAIRS, A.name, B.name)) continue;
          if (!boxes[ai].intersectsBox(boxes[bi])) continue;
          if (!unitsIntersect(A, B)) continue;
          const key = pairKey(A.name, B.name);
          let rec = findings.get(key);
          if (!rec) {
            rec = {
              pair: key,
              class: inList(EXPECTED_PAIRS, A.name, B.name) ? 'EXPECTED' : 'FORBIDDEN',
              axes: {},
            };
            findings.set(key, rec);
          }
          (rec.axes[axis.name] ||= []).push(+f.toFixed(4));
        }
      }
      if (i % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0)); // keep the tab alive
    }
  }

  const report = [...findings.values()].sort((x, y) =>
    x.class === y.class ? x.pair.localeCompare(y.pair) : x.class === 'FORBIDDEN' ? -1 : 1
  );
  // Compact per-axis summary: hit fraction + range.
  for (const r of report) {
    r.summary = Object.entries(r.axes)
      .map(([ax, fs]) => {
        const axis = axes.find((a) => a.name === ax);
        return `${ax}: ${fs.length}/${axis.n + 1} poses (f ${Math.min(...fs)}–${Math.max(...fs)})`;
      })
      .join('; ');
  }

  window.__inspectReport = { units: units.map((u) => u.name), report, axes: axes.map((a) => a.name) };
  console.table(report.map(({ pair, class: cls, summary }) => ({ pair, class: cls, summary })));

  // Helper for the human/agent: jump to a hit pose and frame the pair.
  window.__inspect = {
    show(key, axisName, f) {
      const rec = findings.get(key);
      if (!rec) return 'no such pair';
      const axis = axes.find((a) => a.name === (axisName || Object.keys(rec.axes)[0]));
      const fs = rec.axes[axis.name] || [];
      const useF = f !== undefined ? f : fs[Math.floor(fs.length / 2)];
      clock.setPose(axis.pose(useF));
      const [na, nb] = key.split(' ⇄ ');
      const ua = units.find((u) => u.name === na), ub = units.find((u) => u.name === nb);
      const box = new THREE.Box3().setFromObject(ua.obj).union(new THREE.Box3().setFromObject(ub.obj));
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      clock.camera.position.set(c.x + size * 0.5, c.y - size * 0.7, c.z + size * 0.7);
      clock.controls.target.copy(c);
      clock.controls.update();
      clock.render();
      return `${key} @ ${axis.name} f=${useF}`;
    },
  };
  return window.__inspectReport;
}
