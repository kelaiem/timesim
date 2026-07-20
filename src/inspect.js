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
// runInspection({ includeExcluded: true }) sweeps them too — used as a
// second pass per phase, since real hazards live inside excluded units
// (dial feet vs keyless/motion works, hands vs sub-dial bezels).
const EXCLUDED_UNITS = ['Dial', 'Power reserve', 'Small seconds'];

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
    ['Mainspring drum', 'Three-quarter plate'], // ...and in a plain bushing in the upper plate
    ['Fusee & great wheel', 'plate'],        // fusee arbor pivots plate/bridge
    ['Center wheel', 'plate'],
    ['Third wheel', 'plate'],
    ['Fourth wheel', 'plate'],
    ['Escape wheel', 'plate'],               // lower pivot; the UPPER one is in its own bridge
    ['Pallet fork', 'plate'],                // lower pivot; the UPPER one is on the escapement bridge
    // The three train bridges are GONE — a Glashutte-style three-quarter
    // plate supersedes them (see makeThreeQuarterPlate / the plate build in
    // main.js). It is the movement's upper structure: it carries the upper
    // pivot of every train arbor and of the pallet fork, stands on the
    // pillars, and the balance cock is screwed to its top face (the cock
    // used to float 17.5 units above the plate it claimed to be mounted
    // on; the old hack spring, once also on this plate's top face, later ran
    // BELOW the plate and stands on the base plate instead).
    ['Three-quarter plate', 'pillars'],
    ['pillars', 'plate'],
    ['Fusee & great wheel', 'Three-quarter plate'], // upper pivots, jewelled bores
    ['Center wheel', 'Three-quarter plate'],
    ['Third wheel', 'Three-quarter plate'],
    ['Fourth wheel', 'Three-quarter plate'],
    // ...but NEITHER the escape wheel NOR the pallet fork: they share a
    // combined pallet-and-escape bridge that stands on the BASE plate on its
    // own legs and comes up through a window cut in the three-quarter plate.
    // That is Glashutte practice, and it buys two things — the escapement
    // becomes a self-contained assembly that can be fitted and adjusted
    // without disturbing the plate or any other train pivot, and it stays
    // VISIBLE from the back instead of being buried under plate.
    ['Escape wheel', 'Three-quarter plate'], // pivots in the plate like the rest of the train
    ['Pallet fork', 'Fork cock'],            // its own standalone cap...
    ['Fork cock', 'plate'],                  // ...whose leg lands on the base plate
    ['Balance cock', 'plate'],               // its leg lands on the BASE plate: the whole
                                             // balance assembly (cock, spring, balance)
                                             // comes off with the escapement, and the
                                             // three-quarter plate lifts independently
    ['Balance', 'Balance cock'],             // staff's upper pivot in the cock jewel
    ['Balance', 'plate'],                    // staff's LOWER pivot: rubbed-in jewel in the base plate
    ['Hairspring', 'Balance'],               // collet on the staff (inner end)
    ['Hairspring', 'Balance cock'],          // outer terminal clamped in the stud hanging from the cock
                                             // (free-sprung: the stud carrier is the spring's ONLY fixture)
    ['Chain', 'Mainspring drum'],            // hooked to the drum wall
    ['Chain', 'Fusee & great wheel'],        // hooked to the cone
    ['Keyless works', 'plate'],              // stem-bushing foot hung from the plate's BACK face
                                             // + the winding transfer arbor running in its bore:
                                             // the whole keyless works lives on the DIAL side now
    ['Setting lever', 'plate'],              // stud planted in the plate's back face (dial side)
    ['Yoke', 'plate'],                       // same dial-side stud mounting
    ['Winding click', 'plate'],              // its own post standing on the plate's top face —
                                             // the plate-fixed mount a click needs to actually
                                             // hold the ratchet (closed TODO.md item 2)
    ['Stop lever', 'plate'],                 // clevis bracket stands on the BASE plate in the
                                             // balance cut's open wedge (the crank see-saws in it)
    ['Hack rod', 'Setting lever'],           // pinned at the tail post, under the reset rod's pin
    ['Hack rod', 'Stop lever'],              // pinned at the crank's tail top
    ['Reset hammer', 'Three-quarter plate'], // its arbor runs in a bore in the plate
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
    ['Small seconds', 'Dial'],               // seconds sub-dial bezel/hand on the dial face
    // Motion works: the minute wheel/pinion ride a stud on the dial side;
    // the hour wheel rides its own tube over the cannon pinion, which is
    // friction-fit on the centre arbor. Declaring these makes the hour
    // hand's support and drive visible to the checks — it was previously
    // folded anonymously into 'Dial' and so exempt from both.
    ['Motion works', 'plate'],               // stud riveted to the plate's dial side
    ['Hour wheel', 'Motion works'],          // tube runs in the motion-works stud plate
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
    ['Keyless works', 'Fusee & great wheel'],  // winding: crown wheel → transfer arbor through the
                                               // plate bore → transfer wheel → ratchet (the ratchet
                                               // now sits at the arbor's plate end, under the great wheel)
    ['Fusee & great wheel', 'Winding click'],  // ratchet teeth kick the plate-fixed click as they pass
    ['crown', 'Setting lever'],                // the PULL, via the stem groove
    ['Setting lever', 'Yoke'],                 // ganged clutch shift (yoke tracks the pinion)
    ['Setting lever', 'Hack rod'],             // the rod rides the lever's tail post
    ['Hack rod', 'Stop lever'],                // rigid rod rocks the stop crank
    ['Setting lever', 'Reset rod'],
    ['Reset rod', 'Reset hammer'],
    ['Reset hammer', 'Heart cam (seconds reset)'],
    // Motion works — the hour hand's 12:1 now comes from two real meshes
    // (cannon → minute wheel 3:1, minute pinion → hour wheel 4:1) instead of
    // dividing the minute angle by 12.
    ['Center wheel', 'Motion works'],        // cannon pinion friction-fit on the centre arbor
    ['Motion works', 'Hour wheel'],
    ['Keyless works', 'Motion works'],       // SETTING: the arbor's cap pinion meshes the minute wheel
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
    // (The hairspring-stud item is CLOSED: the stud lives on the cock's
    // stud-carrier arm, the spring's outer end is angle-fixed by setWind,
    // and the ['Hairspring','Balance cock'] support row above measures the
    // clamp for real. Free-sprung, no curb pins to confuse the story.)
    // (The click item is CLOSED: the click is its own labelled unit now —
    // 'Winding click' — standing on a plate-fixed post beside the ratchet,
    // which itself moved to the fusee arbor's plate end when the keyless
    // works went dial-side. See its support/drive edges above.)
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
    {
      // Mirror of the top anchor: the staff's LOWER end must actually
      // reach its base-plate jewel (the balance ran without any lower
      // bearing for a long time and nothing noticed — this makes that
      // impossible to regress silently).
      name: 'balance staff bottom in the plate jewel',
      unit: 'Balance',
      target: 'plate',
      tol: 1.6,
      point(unitEntry) {
        const box = new THREE.Box3().setFromObject(unitEntry.obj);
        return new THREE.Vector3(unitEntry.obj.getWorldPosition(new THREE.Vector3()).x,
          unitEntry.obj.getWorldPosition(new THREE.Vector3()).y, box.min.z);
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
      name: 'stop lever pad reaches the balance rim',
      unit: 'Stop lever',
      target: 'Balance',
      tol: 2.5,
      point: nearestMeshCenter,
    },
    {
      name: 'small-seconds display arbor reaches the sub-dial pivot',
      unit: 'Heart cam (seconds reset)',
      target: 'Small seconds',
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
    'Fork cock',
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
  // (The Regulator unit is GONE — free-sprung conversion: no index, no
  // curb pins, no swan neck. The stud carrier and shock setting remain,
  // as parts of the Balance cock unit.)
  ['Balance cock', 'Hairspring'],            // the cock's hanging stud CLAMPS the terminal — its support edge
  ['Balance', 'Stop lever'],                 // brake pad on the rim (crown out)
  ['Heart cam (seconds reset)', 'Reset hammer'], // roller on the cam
  ['Keyless works', 'Fusee & great wheel'],  // transfer wheel ⇄ ratchet (+ shared band under the great wheel)
  ['Winding click', 'Fusee & great wheel'],  // click beak seated in the ratchet's teeth
  ['Keyless works', 'Setting lever'],        // beak pin in the stem groove
  ['Keyless works', 'Yoke'],                 // prongs on the sliding-pinion hub
  ['Chain', 'Fusee & great wheel'],          // chain lies in the cone grooves
  ['Chain', 'Mainspring drum'],              // chain wraps the drum
  ['Power-reserve train', 'Fusee & great wheel'], // p0 slip-coupled on the arbor
  ['Hack rod', 'Setting lever'],             // rod pinned to the post (its support edge)
  ['Hack rod', 'Stop lever'],                // rod pinned to the crank's tail top
  ['Setting lever', 'Reset rod'],            // rod pinned to the post
  ['Reset rod', 'Reset hammer'],             // rod pinned to the tail
  ['Hour wheel', 'Motion works'],            // minute pinion ⇄ hour wheel — the second 12:1 mesh
  ['Hour wheel', 'Dial'],                    // tube runs through the dial's centre bore, over the cannon pinion
  ['Keyless works', 'Motion works'],         // SETTING: the arbor's cap pinion meshes the minute wheel's
                                             // real teeth — the drive edge above IS this contact
  // 'Motion works' is a labelled child of the dialFace group, so every one of
  // its meshes also belongs to the 'Dial' unit and self-intersects across the
  // pair (the same label nesting Power reserve / Small seconds already have,
  // and those pairs are EXPECTED for the same reason). The real contacts are
  // by design anyway: stud and wheels sit against the dial's back.
  ['Dial', 'Motion works'],
  // The three-quarter plate replaced the three train bridges. It TOUCHES
  // what it holds: each upper pivot's jewel setting closes on the staff
  // running in its bore, the balance cock is screwed to its
  // top face, and the reset hammer's arbor turns in it. Everything else in
  // the movement must CLEAR it — which is the point of listing these
  // explicitly rather than excluding the plate from the sweep.
  ['Fusee & great wheel', 'Three-quarter plate'],
  // The pillars are a labelled unit now (they were a bare structure node,
  // invisible to this sweep — which is how a re-seated pillar ended up
  // inside the hack collar's swing without a single check firing). The one
  // contact that IS the design: the plate sits on their caps.
  ['Three-quarter plate', 'pillars'],
  ['Mainspring drum', 'Three-quarter plate'],
  ['Center wheel', 'Three-quarter plate'],
  ['Third wheel', 'Three-quarter plate'],
  ['Fourth wheel', 'Three-quarter plate'],
  ['Escape wheel', 'Three-quarter plate'],   // staff's upper pivot in the plate's jewel
  ['Pallet fork', 'Fork cock'],              // the fork's, in its standalone cap
  ['Balance cock', 'Three-quarter plate'],
  // ('Stop lever' ⇄ 'Three-quarter plate' is NOT expected: the
  // blade runs under the plate at a held margin — see CLEARANCE_BUDGETS —
  // and its anchor post lands on the base plate, which is a structure node,
  // not a swept unit.)
  ['Reset hammer', 'Three-quarter plate'],
  // Small-seconds display arbor (tornado): the through rod runs coaxially
  // inside the fourth wheel/pinion bores (this contact IS the friction
  // coupling), passes the third-fourth bridge's fourth-end pivot pad, exits
  // through the dial's arbor hole, and carries the hand hub the sub-dial
  // hand rides on. The last two pairs only arise in the includeExcluded
  // sweep ('Dial'/'Small seconds' are excluded from the normal one).
  ['Fourth wheel', 'Heart cam (seconds reset)'],
  ['Heart cam (seconds reset)', 'Dial'],
  ['Heart cam (seconds reset)', 'Small seconds'],
  // Dial-side mounts and pass-throughs — only swept with includeExcluded.
  // Each is the physical contact its support/anchor declaration requires:
  ['Dial', 'Power reserve'],           // bezel + hand pivot sit on the dial face
  ['Dial', 'Small seconds'],           // bezel sits on the dial face
  ['Dial', 'Power-reserve train'],     // hand arbor passes through the dial's hole
  ['Dial', 'Keyless works'],           // settingCap meshes the cannon pinion (a Dial child)
  ['Power reserve', 'Power-reserve train'], // reserve hand rides the w2 output arbor
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
const _matRev = new THREE.Matrix4();
function meshesIntersect(a, b) {
  const bvhA = bvhFor(a);
  const bvhB = bvhFor(b); // intersectsGeometry needs the other side indexed; building its tree indexes it
  _mat.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
  if (!bvhA.intersectsGeometry(b.geometry, _mat)) return false;
  // CROSS-CHECK a positive before believing it. The tree-vs-tree
  // intersectsGeometry path has an observed FALSE-POSITIVE mode at specific
  // relative transforms (2026-07: balance rim ⇄ fork-cock boss — two parts a
  // provable 0.69 apart in XY, radially inscribed circles, flagged as
  // intersecting at exactly 5 of 303 sweep poses; the same query run in
  // REVERSE said clear, the raw-triangle path said clear, and
  // closestPointToGeometry measured 0.699). So the boolean is only trusted
  // when BOTH directions agree; on disagreement the exact distance query
  // arbitrates — its tri-tri distance errs toward EXTRA zeros (the false-0
  // mode documented at meshClearance below), so a genuine contact cannot
  // slip through this branch as a non-zero.
  _matRev.copy(b.matrixWorld).invert().multiply(a.matrixWorld);
  if (bvhB.intersectsGeometry(a.geometry, _matRev)) return true;
  const hit = bvhA.closestPointToGeometry(b.geometry, _mat, {}, {}, 0, 1e-4);
  return !!hit && hit.distance < 1e-4;
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
// Clearance measurement — the TODO item "clearance monitoring (gaps that
// must stay small-but-positive)", now real. Exact BVH closest-point
// distances between two labelled units, at the current pose or swept
// across pose axes. Until now every clearance question (pad↔rim, pad↔
// timing screws, blade↔reset rod, marker↔sub-dial…) was answered by a
// hand-written vertex-sampling console script — approximate, slow to
// rewrite, and rewritten per audit. closestPointToGeometry is exact on
// the meshes and cached via the same BVH the intersection tests use. All
// movement transforms are unit-scale, so bvh-local distance == world
// distance.
// ---------------------------------------------------------------------------
function boxDistance(a, b) {
  // Min distance between two AABBs (0 if overlapping) — cheap lower bound
  // used to skip mesh pairs that cannot beat the current best.
  const dx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0);
  const dy = Math.max(a.min.y - b.max.y, b.min.y - a.max.y, 0);
  const dz = Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0);
  return Math.hypot(dx, dy, dz);
}

// Exact vertex→surface fallback: every vertex of each mesh queried against
// the OTHER mesh's tree (closestPointToPoint — the single-tree path, which
// has never misbehaved), both directions. Slightly conservative (it can
// only see vertex-to-face distances, not face-interior-to-face-interior),
// but immune to the tri-to-tri failure it exists to guard against.
const _sampleV = new THREE.Vector3();
function sampledClearance(a, b, upperBound = Infinity) {
  let best = upperBound;
  for (const [src, dst] of [[b, a], [a, b]]) {
    const tree = bvhFor(dst);
    _mat.copy(dst.matrixWorld).invert().multiply(src.matrixWorld);
    const pos = src.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _sampleV.fromBufferAttribute(pos, i).applyMatrix4(_mat);
      const hit = tree.closestPointToPoint(_sampleV, {}, 0, best);
      if (hit && hit.distance < best) best = hit.distance;
    }
  }
  return best;
}

function meshClearance(a, b, upperBound = Infinity) {
  const bvh = bvhFor(a);
  bvhFor(b);
  _mat.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
  const hit = bvh.closestPointToGeometry(b.geometry, _mat, {}, {}, 0, upperBound);
  let d = hit ? hit.distance : Infinity; // Infinity ⇒ nothing within upperBound
  // Cross-check near-zeros. closestPointToGeometry's tri-to-tri distance
  // short-circuits to 0 through its own triangle-intersection test, and
  // that test can FALSELY report an intersection for plainly separated
  // meshes at specific relative transforms (observed: a balance timing
  // screw vs the escape bridge's fork jewel — true separation ~0.2,
  // reported 0 at exactly one beat pose, sane at its neighbours). Same
  // lesson as the pallet-stone MTV story: the boolean BVH intersection is
  // the primitive this codebase trusts — so a near-zero that the boolean
  // test CONTRADICTS is re-measured with exact vertex→surface queries.
  if (d < 0.05 && !meshesIntersect(a, b)) {
    d = Math.max(d, sampledClearance(a, b, upperBound));
  }
  return d;
}

const _cbA = new THREE.Box3(), _cbB = new THREE.Box3();
function unitClearance(A, B, upperBound = Infinity) {
  let best = upperBound, pair = null;
  for (const a of A.meshes) {
    _cbA.setFromObject(a);
    for (const b of B.meshes) {
      _cbB.setFromObject(b);
      if (boxDistance(_cbA, _cbB) >= best) continue;
      const d = meshClearance(a, b, best);
      if (d < best) { best = d; pair = [a, b]; }
    }
  }
  return { d: best, pair };
}

function unitByName(clock, name) {
  const u = collectUnits(clock, { includeExcluded: true }).find((x) => x.name === name);
  if (!u) throw new Error(`no unit labelled "${name}"`);
  return u;
}

// Distance between two labelled units at the CURRENT pose — the interactive
// one-liner: clearanceAt(__clock, 'Stop lever', 'Balance').
export function clearanceAt(clock, nameA, nameB) {
  const A = unitByName(clock, nameA), B = unitByName(clock, nameB);
  // Scoped matrix refresh: only the two subtrees (plus ancestors), not the
  // whole 170-mesh scene.
  A.obj.updateWorldMatrix(true, true);
  B.obj.updateWorldMatrix(true, true);
  const { d } = unitClearance(A, B);
  return d;
}

// Shared sweep engine: measure MANY unit pairs over pose axes in ONE pass —
// each pose is evaluated once (setPose + matrix update amortised across all
// pairs), coarse-to-fine: sample every `coarse`-th pose, then refine only
// the intervals whose coarse samples come within `refineBand` of that
// pair's running minimum. refineBand is the Lipschitz-style assumption —
// a dip narrower than a coarse step AND deeper than the band could in
// principle be missed; the default band (1.0) is generous for parts moving
// a few units per axis, and coarse: 1 restores the exact dense sweep.
// setPose itself refreshes world matrices, so no extra update is needed
// per pose. Per-pair running minima feed the BVH query's upper bound
// (best + refineBand during the coarse pass, so band-relevant values stay
// exact; anything farther clamps to Infinity and is skipped).
async function sweepClearances(clock, pairs, { axes = AXES, coarse = 4, refineBand = 0.4, yieldEvery = 16 } = {}) {
  // pairs: [{ A, B, axes?: [names] }] — resolved units, optional axis filter.
  const state = pairs.map(() => ({ min: Infinity, at: null }));
  let poseCount = 0;
  const evalPose = (axis, i, refined) => {
    const f = i / axis.n;
    clock.setPose(axis.pose(f)); // includes scene.updateMatrixWorld(true)
    poseCount++;
    for (let p = 0; p < pairs.length; p++) {
      const pr = pairs[p];
      if (pr.axes && !pr.axes.includes(axis.name)) continue;
      const st = state[p];
      // The query bound is where all the time goes: closestPointToGeometry
      // against the plate's ~21k-triangle extrusion costs ~180ms UNBOUNDED
      // (profiled — 6 of 13 budgets touch the plate, ≈ the whole 355s
      // sweep), but the BVH prunes almost all of it given a finite cap. A
      // budget pair only ever needs exact distances near its floor, so cap
      // at refineFloor + band: pairs comfortably clear return "≥ cap" in
      // ~1ms instead of an exact number nobody needs. Exact mode
      // (measureClearance, no refineFloor) is uncapped as before.
      const cap = pr.refineFloor !== undefined ? pr.refineFloor + refineBand : Infinity;
      const bound = Math.min(refined ? st.min : st.min + refineBand, cap);
      const { d } = unitClearance(pr.A, pr.B, bound);
      if (d < st.min) { st.min = d; st.at = { axis: axis.name, f: +f.toFixed(4) }; }
      (pr._samples ||= {})[i] = d; // per-axis scratch, reset below
    }
  };
  for (const axis of axes) {
    const live = pairs.some((pr) => !pr.axes || pr.axes.includes(axis.name));
    if (!live) continue;
    for (const pr of pairs) pr._samples = {};
    // Coarse pass (always includes both endpoints).
    const coarseIdx = [];
    for (let i = 0; i <= axis.n; i += coarse) coarseIdx.push(i);
    if (coarseIdx[coarseIdx.length - 1] !== axis.n) coarseIdx.push(axis.n);
    for (const i of coarseIdx) {
      evalPose(axis, i, false);
      if (poseCount % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
    }
    if (coarse > 1) {
      // Refine every skipped index adjacent to a coarse sample that came
      // within refineBand of its pair's minimum (union across pairs). A
      // pair with a refineFloor (its budget's required margin) skips
      // refinement entirely while its coarse min stays comfortably above
      // the floor — a uniformly-distant pair (e.g. blade⇄fork at ~5.5)
      // would otherwise qualify EVERY interval and degrade to dense.
      const fine = new Set();
      for (let p = 0; p < pairs.length; p++) {
        const pr = pairs[p];
        if (pr.axes && !pr.axes.includes(axis.name)) continue;
        if (pr.refineFloor !== undefined && state[p].min > pr.refineFloor + refineBand) continue;
        for (const i of coarseIdx) {
          const d = pr._samples[i];
          if (d === undefined || d > state[p].min + refineBand) continue;
          for (let j = Math.max(0, i - coarse + 1); j < Math.min(axis.n, i + coarse); j++) {
            if (pr._samples[j] === undefined) fine.add(j);
          }
        }
      }
      for (const i of [...fine].sort((a, b) => a - b)) {
        evalPose(axis, i, true);
        if (poseCount % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }
    for (const pr of pairs) delete pr._samples;
  }
  return { state, poseCount };
}

// Worst-case (minimum) clearance between two units swept across pose axes.
// Returns { min, at: {axis, f} } plus show() to pose and frame the
// offending configuration, mirroring runInspection's __inspect.show.
export async function measureClearance(clock, nameA, nameB, { axes = AXES, coarse = 4, refineBand = 0.4, yieldEvery = 16 } = {}) {
  const A = unitByName(clock, nameA), B = unitByName(clock, nameB);
  const { state } = await sweepClearances(clock, [{ A, B }], { axes, coarse, refineBand, yieldEvery });
  const { min, at } = state[0];
  return {
    min: +min.toFixed(4),
    at,
    show() {
      const axis = axes.find((a) => a.name === at.axis);
      clock.setPose(axis.pose(at.f));
      const box = new THREE.Box3().setFromObject(A.obj).union(new THREE.Box3().setFromObject(B.obj));
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      clock.camera.position.set(c.x + size * 0.5, c.y - size * 0.7, c.z + size * 0.7);
      clock.controls.target.copy(c);
      clock.controls.update();
      clock.render();
      return `${nameA} ⇄ ${nameB}: ${min} @ ${at.axis} f=${at.f}`;
    },
  };
}

// Standing clearance budgets — pairs whose worst-case gap must stay ABOVE a
// margin (the complement of PENETRATION_BUDGETS' "may touch, but not this
// deep"). axes narrows which pose axes apply: the stop pad ⇄ balance pair
// legitimately TOUCHES at full crown engagement, so its budget covers only
// the released axes. Seeded from the hack audit (2026-07-18); add a row
// here whenever an audit derives a clearance worth keeping.
const CLEARANCE_BUDGETS = [
  { a: 'Stop lever', b: 'Balance', min: 0.15, axes: ['beat', 'reserve', 'train'] },
  // The crank's tall tail and the balance cock share the open wedge; the
  // two rods diverge from the same tail post and the hack rod overflies
  // the cock's free-sprung dress on its way to the crank — each of these
  // is a corridor the stop-work design depends on:
  { a: 'Stop lever', b: 'Balance cock', min: 0.15 },
  { a: 'Stop lever', b: 'Fork cock', min: 0.15 },
  { a: 'Stop lever', b: 'Pallet fork', min: 0.15 },
  { a: 'Hack rod', b: 'Reset rod', min: 0.15 },
  { a: 'Hack rod', b: 'Balance cock', min: 0.15 },
  { a: 'Hack rod', b: 'Three-quarter plate', min: 0.15 },
  { a: 'Hack rod', b: 'Fusee & great wheel', min: 0.15 }, // overflies the cone by the derived lift
  // Three-quarter plate binds (2026-07-18). Every one of these is a place
  // where the plate's z-stack or one of its openings was solved to land
  // exactly on the shared margin, so they are exactly the numbers that a
  // later change to the Z-stack would silently eat:
  { a: 'Balance', b: 'Three-quarter plate', min: 0.15 },      // the cut edge tucks UNDER the rim
  { a: 'Reset rod', b: 'Three-quarter plate', min: 0.15 },    // rod re-planed to clear the plate's top
  { a: 'Setting lever', b: 'Three-quarter plate', min: 0.15 },   // tail post swings through the plate's arc slot
  { a: 'Hairspring', b: 'Three-quarter plate', min: 0.15 },
  // The escape bridge's length is solved from exactly this gap: it overhangs
  // the pivot it carries, toward the balance, and sits inside the balance's
  // z band while doing it.
  { a: 'Balance', b: 'Fork cock', min: 0.15 },
  // The bridge's legs drop through the plate's escapement window without
  // touching it — the window is measured off the bridge's own footprint, so
  // this row is the check on that measurement.
  { a: 'Fork cock', b: 'Three-quarter plate', min: 0.15 },
  // Dial-side keyless works (2026-07-19): the lever and yoke bodies now
  // hang in the plate→dial gap, their pivot-boss undersides solved to hold
  // exactly the margin over the dial's face — these rows pin that budget
  // (and would catch a dial foot wandering back into the keyless corridor,
  // since the feet belong to the 'Dial' unit).
  { a: 'Setting lever', b: 'Dial', min: 0.15 },
  { a: 'Yoke', b: 'Dial', min: 0.15 },
];

// ---------------------------------------------------------------------------
// Support-geometry verification — "is this part actually held by what the
// graph says holds it?"
//
// checkMechanicalGraph's GROUNDING check verifies the declared support
// EDGES form a connected graph reaching 'plate'. That is a statement about
// strings, not geometry: ['Pallet fork','plate'] passes whether or not any
// part of the fork comes within a mile of the plate. MECH_GRAPH.anchors was
// meant to close that gap but covers 5 of ~24 support edges (its own TODO
// says "extend to every support edge") — which is how a floating pallet
// fork, bottomless arbors and an unattached hack-spring boss all coexisted
// with a clean graph report.
//
// This replaces the per-edge bespoke point() functions with one rule that
// needs no hand-authoring: a support is REAL only if the supported unit's
// meshes actually reach the fixture's meshes. Distance is the same exact
// BVH closest-point measure the clearance tooling uses — a support edge is
// simply a clearance constraint with an UPPER bound instead of a lower one.
// Structural fixtures that aren't labelled units ('plate', pillars) resolve
// by mesh name (set in main.js).
// ---------------------------------------------------------------------------
const STRUCTURE_NODES = {
  plate: 'backPlate',
  pillars: 'pillar',
  // 'Three-quarter plate' is ALSO a labelled unit in main.js (it belongs in
  // the overlap sweep — it is full of clearance holes that have to be
  // verified), so resolveNode finds it as a unit first; this entry keeps the
  // structural-node path working if that label is ever dropped.
  'Three-quarter plate': 'threeQuarterPlate',
};
// Nodes that ARE the ground, for the direct-mount rule below: a cock screwed
// to the three-quarter plate is mounted on the movement's structure, not
// stacked on another bridge.
const GROUND_NODES = ['plate', 'Three-quarter plate'];
const SUPPORT_TOL = 0.5; // a mounted part touches (0) or is set into its fixture

function resolveNode(clock, allUnits, name) {
  const unit = allUnits.find((u) => u.name === name);
  if (unit) return unit;
  const meshName = STRUCTURE_NODES[name];
  if (!meshName) return null;
  const meshes = [];
  clock.movement.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.attributes.position && o.name === meshName) meshes.push(o);
  });
  return meshes.length ? { name, obj: clock.movement, meshes } : null;
}

export function checkSupportGeometry(clock, { tol = SUPPORT_TOL, edges = MECH_GRAPH.support } = {}) {
  clock.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.scene.updateMatrixWorld(true);
  const allUnits = collectUnits(clock, { includeExcluded: true });
  const rows = [];
  for (const [aName, bName] of edges) {
    const A = resolveNode(clock, allUnits, aName);
    const B = resolveNode(clock, allUnits, bName);
    if (!A || !B) {
      rows.push({ edge: `${aName} → ${bName}`, gap: null, ok: false,
        note: !A ? `unresolved: ${aName}` : `unresolved: ${bName}` });
      continue;
    }
    const { d } = unitClearance(A, B);
    rows.push({ edge: `${aName} → ${bName}`, gap: +d.toFixed(3), ok: d <= tol,
      note: d <= tol ? '' : 'FLOATING — declared support has no geometry' });
  }
  rows.sort((x, y) => (x.ok === y.ok ? (y.gap ?? 0) - (x.gap ?? 0) : x.ok ? 1 : -1));
  console.table(rows);
  const failures = rows.filter((r) => !r.ok);
  console.log(`${failures.length}/${rows.length} declared supports are not backed by geometry (tol ${tol})`);
  return { failures, rows };
}

export async function checkClearances(clock, { budgets = CLEARANCE_BUDGETS, axes = AXES, coarse = 4, refineBand = 0.4, yieldEvery = 16 } = {}) {
  // All budgets ride ONE sweep: each pose is set up once and every pair
  // measured at it (per-budget axis scoping handled inside the engine) —
  // previously this re-swept the full pose space once per budget.
  const pairs = budgets.map((bud) => ({
    A: unitByName(clock, bud.a),
    B: unitByName(clock, bud.b),
    axes: bud.axes,
    refineFloor: bud.min, // exact minima only needed near the budget line
  }));
  const { state } = await sweepClearances(clock, pairs, { axes, coarse, refineBand, yieldEvery });
  const results = budgets.map((bud, i) => {
    // min === Infinity ⇒ every query pruned at the cap: the pair never came
    // within refineFloor + band of its floor anywhere in pose space. That
    // IS the verdict a budget exists for — report it as the bound proven,
    // not a number we never measured.
    const capped = !isFinite(state[i].min);
    return {
      pair: `${bud.a} ⇄ ${bud.b}`,
      min: capped ? `≥ ${(bud.min + refineBand).toFixed(2)}` : +state[i].min.toFixed(4),
      required: bud.min,
      at: capped ? '(never within band)' : `${state[i].at.axis} f=${state[i].at.f}`,
      ok: capped || state[i].min >= bud.min,
    };
  });
  console.table(results);
  return { violations: results.filter((r) => !r.ok), results };
}

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
    .filter((n) => !['plate', 'pillars', 'mainspring', 'crown'].includes(n) && !groundingNames.has(n) && !MECH_GRAPH.todo.some(([a, b]) => a === n || b === n));

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
    // Targets may also be STRUCTURE nodes ('plate' — the balance staff's
    // lower jewel anchor) — resolveNode handles both.
    const target = resolveNode(clock, allUnits, spec.target);
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
      .filter(([a, b]) => GROUND_NODES.includes(a) || GROUND_NODES.includes(b))
      .map(([a, b]) => (GROUND_NODES.includes(a) ? b : a))
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
  // intersectsGeometry needs the other side INDEXED; building its (otherwise
  // unused) tree indexes it — same trick meshesIntersect relies on. Without
  // this, ExtrudeGeometry stones (non-indexed) crash inside the BVH walk —
  // a latent break since the pallet stones stopped being BoxGeometry.
  bvhFor(meshB);
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

export async function runInspection(clock, { axes = AXES, yieldEvery = 8, includeExcluded = false } = {}) {
  const units = collectUnits(clock, { includeExcluded });
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

// ---------------------------------------------------------------------------
// Background runner — the full checks take tens of seconds on this scene, and
// a browser-automation eval that waits for them trips its own 30s timeout. The
// workaround (kick the promise off, stash the result on window, poll) got
// hand-written once per session; this is it, once, properly.
//
// Do NOT "fix" a timeout by passing yieldEvery: Infinity. That removes the
// cooperative yields, which blocks the main thread for the whole sweep and
// wedges the tab — strictly worse than the timeout it avoids. The yields are
// what keep the page alive; note that a BACKGROUNDED tab throttles setTimeout
// to ~1s, so a sweep runs far slower when its tab isn't fronted.
//
//   start(clock, 'clearances');            // returns immediately
//   … poll …  status()                     // {state:'running'|'done'|'error'}
//
// Multiple named jobs can run at once; results live on window.__checks.
// ---------------------------------------------------------------------------
const CHECKS = {
  clearances: (clock, opts) => checkClearances(clock, opts),
  inspection: (clock, opts) => runInspection(clock, opts),
  support: (clock, opts) => checkSupportGeometry(clock, opts),   // sync, still fine
  graph: (clock, opts) => checkMechanicalGraph(clock, opts),
  penetration: (clock, opts) => checkPenetrationBudgets(clock, opts),
};

export function start(clock, name, opts = {}) {
  const jobs = (window.__checks ||= {});
  if (!CHECKS[name]) return `unknown check "${name}" — have: ${Object.keys(CHECKS).join(', ')}`;
  const t0 = performance.now();
  jobs[name] = { state: 'running', startedAt: t0 };
  Promise.resolve()
    .then(() => CHECKS[name](clock, opts))
    .then((result) => {
      jobs[name] = { state: 'done', ms: Math.round(performance.now() - t0), result };
    })
    .catch((err) => {
      jobs[name] = { state: 'error', ms: Math.round(performance.now() - t0), error: String(err && err.stack || err) };
    });
  return `started ${name}`;
}

// Compact poll target: one line per job, plus the payload of finished ones.
export function status(name) {
  const jobs = window.__checks || {};
  if (name) return jobs[name] || { state: 'missing' };
  return Object.fromEntries(Object.entries(jobs).map(([k, v]) => [k, v.state === 'running'
    ? `running ${Math.round((performance.now() - v.startedAt) / 100) / 10}s`
    : v]));
}

// Everything at once, for a full regression pass.
export function startAll(clock, opts = {}) {
  for (const n of Object.keys(CHECKS)) start(clock, n, opts[n] || {});
  return `started: ${Object.keys(CHECKS).join(', ')}`;
}
