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
// The ONE structural margin (standing rule 1). The budget rows below still
// spell 0.15 inline, one per pair, because each is a per-pair statement that
// may legitimately differ; the free-annulus probe wants the project-wide
// default and should not add a fourth copy of the number.
import { CLEAR_MARGIN, UNIT_MM } from './layout.js';

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
    ['Minute jumper', 'plate'],              // its pivot stud rivets into the same dial-side face,
                                             // beside the motion works (jumping-minute setting)
    ['Yoke', 'plate'],                       // same dial-side stud mounting
    ['Set-up work', 'plate'],                // the set-up ratchet rides the drum arbor's lower
                                             // square just above the BASE plate (chronometer
                                             // practice — bench-only hardware lives on the lower
                                             // plate); its click's screws stand on that face.
                                             // STATIC in service — it holds the spring's
                                             // pre-tension for the life of the watch
    ['Maintaining detent', 'plate'],         // its cock's foot post stands on the base plate,
                                             // outside the great wheel's tip circle; the arm
                                             // overhangs the wheel to reach the maintaining ring
    ['Stop lever', 'plate'],                 // clevis bracket stands on the BASE plate in the
                                             // balance cut's open wedge (the crank see-saws in it)
    ['Hack rod', 'Setting lever'],           // pinned at the tail post, under the reset rod's pin
    ['Hack rod', 'Stop lever'],              // pinned at the crank's tail top
    ['Reset hammer', 'plate'],               // its arbor stands footed on the BASE plate — the whole
                                             // reset/hack linkage lives in the low band now
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
    // Alarm (§24): a second crown (a force source, like the winding 'crown')
    // sets a small disc through a 90° bevel pair. The crown's stem runs in a
    // rim bushing on the plate; the setting arbor pivots in the plate and
    // carries the disc's pointer through the dial well.
    ['Alarm crown', 'plate'],                // stem bushing at the case rim
    ['Alarm setting arbor', 'plate'],     // §25 C stage 3: the well-floor collar became a plate cock (post + arm + bush)
    ['Alarm disc', 'Hour wheel'],            // §25 C: the alarm tube RIDES the hour-wheel tube — that
                                             // running fit is its bearing (rattrapante centre stack)
    ['Alarm setting wheel', 'Alarm disc'],   // §25 C stage 3: friction-rides the alarm tube (bore 3.05 on 3.0)
    ['Alarm setting idler', 'plate'],        // §25 C stage 3: stud from the base plate's underside
    ['Alarm release disc', 'Hour wheel'],    // §29 step 2: friction hub riding the hour tube in the disc band — the seat is both bearing and drive
    ['Alarm release feeler', 'Dial'],        // §29 step 3: the bracket's lugs hang from the sheet's back face at the release azimuth
    ['Alarm selector', 'Dial'],              // §34 pass 2b: the ring's three guide posts hang from the sheet (az 60/220/300, outside the wheel's tips)
    ['Alarm link', 'Three-quarter plate'],   // §35: the link beak's post on the plate top
    ['Alarm link', 'plate'],                 // §35: the rod's bores (both plates) + the lay shaft's two hanger bushes

    ['Alarm winding train', 'plate'],        // §25 C winding: the climb arbor runs in the base plate's bore
    ['Alarm winding train', 'Three-quarter plate'], // …and its jeweled upper pivot + the idler studs
    ['Alarm lock', 'Three-quarter plate'],   // §25 B: brake-lever pivot post on the plate top
    ['Alarm switch', 'Three-quarter plate'], // §25 D: the column wheel's stud on the plate top
    // Alarm striker (§24): a gong fixed to the back plate by one foot (its far
    // end rings free) and a hammer pivoted beside it. The hammer IS driven now
    // — §25 built the striking works below and moved its pose into tick(), so
    // the 'alarmStrike' axis sweeps it like any other train.
    ['Alarm gong', 'Three-quarter plate'],   // the gong's single foot stands on the back plate
    ['Alarm hammer', 'Three-quarter plate'], // the hammer's pivot post stands on the back plate
    // Alarm striking works (§25 A): the power chain behind the hammer. Both
    // arbors stand on studs planted in the same plate-top face the gong and
    // hammer posts use — the only clear band on it.
    ['Alarm barrel', 'Three-quarter plate'],        // barrel arbor's boss stands on the back plate
    ['Alarm striking wheel', 'Three-quarter plate'], // pin wheel's bearing stud, likewise
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
                                               // plate bore → transfer wheel → winding SPUR at the
                                               // arbor's plate end, under the great wheel
    ['Fusee & great wheel', 'Maintaining detent'], // the maintaining ring's teeth tick past the
                                               // detent's beak as the train runs (never in reverse
                                               // — that is the whole point of the sandwich)
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
    ['Setting lever', 'Minute jumper'],      // the lost-motion lifter bar off the tail post drops the
                                             // jumper into the star when the crown is out
    ['Motion works', 'Minute jumper'],       // the star's teeth ride the seated beak (the detent that
                                             // quantizes setting to whole minutes)
    // Alarm setting (§24): the second crown turns the disc through the bevel
    // pair; the arbor turns the pointer. 'Alarm crown' is a force source only
    // reachable on the 'alarm' pose axis — nothing else writes it.
    ['Alarm crown', 'Alarm setting arbor'],  // 90° bevel mesh (crown PULLED OUT — set)
    ['Alarm crown', 'Alarm winding train'],  // §25 C: crown PUSHED IN (rest) — the bevel sits on the inner climb contrate
    ['Alarm winding train', 'Alarm barrel'], // §25 C: climb pinion → idlers → barrel rim (12/44)
    ['Alarm switch', 'Alarm lock'],          // §25 D: the column wheel blocks the lever's tail beak (column = OFF holds the brake)
    ['Alarm setting arbor', 'Alarm setting idler'], // §25 C stage 3: arbor pinion (10) → idler (31)
    ['Alarm setting idler', 'Alarm setting wheel'], // idler (31) → setting wheel (30) on the tube
    ['Alarm setting wheel', 'Alarm disc'],   // friction coupling: drives the tube when armed, slips when
                                             // the tube follows the heart (the cannon-pinion precedent)
    ['Hour wheel', 'Alarm disc'],            // §25 C stage 2: DISARMED, the heart cam on the hour
                                             // tube drives the tube home through the sprung follower
    ['Alarm setting wheel', 'Alarm disc'],   // §34: ARMED, the FACE CAM on the wheel drives the tube to the set
                                             // phase through the sprung pin-arm (an axial heart: the pin seeks the
                                             // cam's minimum and the slopes cam the rotation) — the coupling as geometry
    ['Alarm selector', 'Alarm disc'],        // §34 pass 2b: the ring's face tips the flange rocker (axial contact,
                                             // azimuth-independent) — the bias that picks which heart wins
    ['Alarm switch', 'Alarm link'],          // §35: the link beak ON the castellations, 120° around — the same
                                             // parity the brake beak reads, now carried away as metal
    ['Alarm link', 'Alarm selector'],        // §35: the centre crank on the ring's drive tab — the run's last
                                             // contact; the pusher press now moves the whole chain
    ['Hour wheel', 'Alarm release disc'],    // §29 step 2: the friction seat drives the disc with time…
    ['Alarm setting idler', 'Alarm release disc'], // …and i1's compound band pinion (i1b, 28) meshes the disc's rim (30)
                                                   // DIRECTLY — one mesh, the tube path's mirror ratio, re-phasing on set
    ['Alarm release disc', 'Alarm release feeler'], // §29 step 3: the raised track carries the pin; the notch's arrival
                                                    // under it IS the drop — the azimuth-independent detection
    ['Alarm release feeler', 'Alarm winding train'], // §29 step 4: the tail's beak in the climb's contrate band is the
                                                     // RELEASE DETENT — seated it holds the striking barrel through the
                                                     // 12/44 mesh; the pin's drop withdraws it and the train runs
    // Alarm striking works (§25 A): a SECOND force source — the alarm's own
    // mainspring, the counterpart of 'mainspring' for the going train. It
    // drives the pin wheel through a 4:1 step-up and the pins lift the hammer,
    // so the hammer's swing is reachable from a spring and from nothing else.
    ['alarm mainspring', 'Alarm barrel'],
    ['Alarm barrel', 'Alarm striking wheel'], // barrel's toothed wall → strike pinion
    ['Alarm striking wheel', 'Alarm hammer'], // pins lift the tail and let it go
  ],
  // Declared-but-unmodelled links: reported as TODO warnings.
  todo: [
    // §25 B: the RELEASE is derived from the real co-axial alignment (the
    // follower's nose entering the heart's notch) and the lock lever answers
    // it — but no physical linkage carries the drop. NOT a missing rod: the
    // feeler CO-ROTATES with the setting, so a pickup must be azimuth-
    // independent — the Memovox differential-disc architecture — and the
    // centre's z-budget (largest free gap 0.08) must be re-stratified first.
    // The full design, measured constraints and the dial-side contrate-pawl
    // lock that follows are §29 in the roadmap.
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
    // (The click story is CLOSED the honest way: a fusee needs NO winding
    // click — the escapement holds the wind through the train. The two
    // real ratchets are built instead: the STATIC set-up ratchet + click
    // on the drum arbor ('Set-up work', holding the spring's pre-tension)
    // and the MAINTAINING POWER sandwich at the great wheel, whose pawls
    // click during winding and whose plate detent ('Maintaining detent')
    // ticks as the train runs. See support/drive edges above.)
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
  ['Keyless works', 'Fusee & great wheel'],  // transfer wheel ⇄ winding spur (+ shared band under the great wheel)
  ['Maintaining detent', 'Fusee & great wheel'], // detent beak seated in the maintaining ring's teeth
  ['Set-up work', 'Mainspring drum'],        // the static arbor parts (square, collar, hook pin)
                                             // thread the rotating body and its lower-pivot furniture
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
  ['Minute jumper', 'Motion works'],         // beak seated in the minute star's teeth
  ['Minute jumper', 'Dial'],                 // same seat — the star is also a Dial-unit mesh through
                                             // the motion-works nesting (the jumper itself is a
                                             // movement child now, so this is star contact only)
  ['Minute jumper', 'Setting lever'],        // the lifter bar rides the tail post's pin
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
  // ('Balance cock' ⇄ 'Three-quarter plate' is NOT expected any more: the
  // cut is re-solved around the BUILT cock (the bridge-reveal pass in
  // main.js), so the plate never touches the bridge — the cock stands on
  // its own base-plate legs in open air. A clearance budget below holds
  // the gap.)
  // ('Stop lever' ⇄ 'Three-quarter plate' is NOT expected: the
  // blade runs under the plate at a held margin — see CLEARANCE_BUDGETS —
  // and its anchor post lands on the base plate, which is a structure node,
  // not a swept unit.)
  // The two rods share the tail post's pin stack in a 0.22-unit corridor
  // now — near the post their tubes converge and touch, as two levers on
  // one stud do; the angular spread to their destinations separates them
  // beyond it.
  ['Hack rod', 'Reset rod'],
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
  // Alarm (§24) — the mirror of the reserve/motion-works contacts:
  ['Alarm crown', 'Alarm setting arbor'], // the 90° bevel mesh (the one declared crown⇄arbor contact)
  ['Alarm disc', 'Hour wheel'],           // §25 C: alarm tube running on the hour-wheel tube (its bearing)
  ['Alarm setting wheel', 'Alarm disc'],  // §25 C stage 3: friction bore on the tube + retention against the carrier flange
  ['Alarm setting wheel', 'Dial'],        // retained 0.05 behind the dial sheet — deliberate proximity
  ['Alarm setting idler', 'Alarm setting wheel'], // gear mesh
  ['Alarm setting idler', 'Dial'],        // the SAME gear mesh re-attributed: the setting wheel is a
                                          // Dial-rooted descendant (the Dial ⇄ Hour wheel precedent);
                                          // the true Dial sheet is measured 0.05 clear of the idler
  ['Alarm setting idler', 'Alarm setting arbor'], // gear mesh (idler ⇄ arbor pinion)
  ['Alarm release disc', 'Hour wheel'],     // §29: the friction seat (bore +0.05 running fit on the tube)
  ['Alarm release disc', 'Dial'],           // the NESTING artifact, not a contact: collectUnits does no
                                            // nested-label exclusion, so the Dial unit contains the disc's
                                            // own meshes (the Dial ⇄ Hour wheel precedent); the disc's real
                                            // clearances to Dial furniture are boot-asserted analytically
  ['Alarm setting idler', 'Alarm release disc'],  // §29: the i1b ⇄ rim mesh (the re-phasing branch)
  ['Alarm release disc', 'Alarm release feeler'], // §29: the pin ON the track — the working read contact
  ['Alarm release feeler', 'Alarm winding train'], // §29: the beak IN the contrate band — the detent contact
  ['Alarm selector', 'Alarm disc'],         // §34: the sensing pin ON the ring's face — the selector's working contact
  ['Alarm switch', 'Alarm link'],           // §35: the beak riding the castellations' tops
  ['Alarm link', 'Alarm selector'],         // §35: the crank on the drive tab
  ['Alarm link', 'Dial'],                   // the SAME tab contact re-attributed through nesting: the ring
                                            // (and its tab) is a dialFace descendant, so the Dial's traverse
                                            // carries it (the Dial ⇄ Hour wheel precedent); the link's real
                                            // corridor past Dial furniture is ray-asserted at the build
  ['Alarm selector', 'Dial'],               // the nesting artifact + the posts' sheet anchors
  ['Alarm winding train', 'Dial'],          // the SAME detent contact re-attributed through nesting: the feeler
                                            // is a dialFace descendant, so the Dial's traverse carries its beak
                                            // (the Dial ⇄ Hour wheel precedent; collectUnits does no exclusion)
  ['Alarm release feeler', 'Dial'],         // the nesting artifact (dialFace descendant), like the disc's row
  ['Alarm winding train', 'Alarm crown'],   // §25 C: pulled-out bevel mesh
  ['Alarm winding train', 'Alarm barrel'],  // §25 C: idler ⇄ barrel rim mesh
  ['Alarm winding train', 'Three-quarter plate'], // jeweled pivot + studs
  ['Alarm winding train', 'Mainspring drum'], // i2's disc overflies the drum's plate-top band near the barrel
  ['Alarm lock', 'Alarm striking wheel'],  // §25 B: the brake pad ON the lock collar — the hold itself
  ['Alarm lock', 'Alarm switch'],          // §25 D: the tail beak riding the column wheel's castellations
  ['Alarm lock', 'Three-quarter plate'],   // pivot post
  ['Alarm switch', 'Three-quarter plate'], // guide stud
  ['Dial', 'Alarm disc'],                 // §25 C: alarm tube passes the enlarged centre bore
  ['Alarm gong', 'Three-quarter plate'],  // gong foot planted in the back plate top
  ['Alarm hammer', 'Three-quarter plate'],// hammer pivot post planted in the back plate top
  ['Alarm hammer', 'Alarm gong'],         // the strike — head onto the ringing end (touches at the strike, blind spot below)
  // Alarm striking works (§25 A) — the declared contacts of the power chain:
  ['Alarm barrel', 'Three-quarter plate'],        // arbor boss planted in the back plate top
  ['Alarm striking wheel', 'Three-quarter plate'],// bearing stud, likewise
  ['Alarm barrel', 'Alarm striking wheel'],       // the gear mesh (barrel wall ⇄ strike pinion)
  ['Alarm striking wheel', 'Alarm hammer'],       // a pin on the hammer's tail — the lift
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
  {
    // One full star pitch (60 s of movement time — the star turns 2° per
    // MINUTE, one point per minute-hand minute) with the crown pulled, so
    // the minute jumper is actually ENGAGED and riding the V profile —
    // neither 'crown' (tau pinned at 0.05, never turns the star) nor
    // 'train' (crownPullT pinned at 0, jumper held lifted clear) ever pose
    // this pair through a real point→valley→point cycle.
    name: 'jumperEngage',
    n: 120,
    pose: (f) => ({ tau: f * 60, crownPullT: 1, leverEngage: 0, tension: 1, windAccumTurns: 0 }),
  },
  {
    // §35 postmortem: HAND-SETTING is the only input that spins the keyless
    // setting path (setPathRot — crown rotation while pulled), and no other
    // axis writes it, so a rod standing in the minute wheel's spoke windows
    // passed every battery run. One full MINUTE-WHEEL revolution, crown
    // pulled — the setting wheel and the compound arbor sweep their whole
    // angular range past everything static.
    name: 'handSet',
    n: 120,
    pose: (f, clock) => ({
      tau: 0.05, crownPullT: 1, leverEngage: 0, tension: 1, windAccumTurns: 0,
      setPathRot: f * (clock ? clock.setPathPerMinuteWheelRev : 0),
    }),
  },
  {
    // One full revolution of the alarm disc (§24): the crown turned through a
    // complete 12 h of setting, so the disc, its bevel and the detent star
    // sweep their whole travel past the static click-spring, the dial well and
    // the plate. Neither 'crown' nor 'train' writes alarmCrownRotation, so this
    // is the only axis that exercises the alarm — and the disc is honestly
    // verified as driven by the alarm crown, and only by it.
    name: 'alarm',
    n: 96,
    // alarmOn: 1 — §25 C: ARMED, so the crown sweep actually swings the tube
    // (disarmed it would follow the fixed hour wheel and the axis would probe
    // nothing), and the follower nose rides the whole heart once per rev.
    // alarmCrownPullT: 1 — crown-sense swap: SET is the pulled-out path now.
    // (setPose(alarmCrownRotation) writes the set path directly, so the sweep
    // itself is clutch-independent; the pose records the honest state.)
    pose: (f) => ({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmCrownRotation: f * 2 * Math.PI, alarmOn: 1, alarmCrownPullT: 1 }),
  },
  {
    // A whole wind of the alarm barrel (§25): the barrel unwinds its full
    // travel, the striking wheel turns ALARM_STRIKE_RATIO times as far, and
    // every pin drives the hammer's tail through a complete lift → release →
    // strike → rebound. The other axes all pin the striking phase, so this is
    // the only one that poses the striker in motion — and posing it is what
    // proves the hammer is driven by the spring rather than animated beside
    // it. n is chosen COPRIME to the strike count (109 vs 28) on purpose: an
    // even multiple samples the same handful of phases inside every pin cycle
    // and steps straight over the strike, which is a fast excursion within
    // each pitch. (The pin⇄tail penetration budget re-sweeps this same axis on
    // its own, finer, sampling.)
    name: 'alarmStrike',
    n: 109,
    // alarmReleased: 1 — §25 B: a turning striking train IS a ringing one, so
    // the sweep runs with the brake lever LIFTED, exactly as the real ring
    // does (an engaged pad under a spinning collar would be a false dig).
    pose: (f, clock) => ({
      tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
      alarmStrikePhase: f * (clock ? clock.alarmStrikesPerWind : 28),
      alarmOn: 1, alarmReleased: 1,
    }),
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
    clock.setPose(axis.pose(f, clock)); // includes scene.updateMatrixWorld(true)
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
      clock.setPose(axis.pose(at.f, clock));
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
  // §25 B: with the brake LIFTED (the alarmStrike axis poses alarmReleased),
  // the pad must clear the turning collar through the entire ring.
  { a: 'Alarm lock', b: 'Alarm striking wheel', min: 0.15, axes: ['alarmStrike'] },
  { a: 'Stop lever', b: 'Balance', min: 0.15, axes: ['beat', 'reserve', 'train'] },
  // The crank's tall tail and the balance cock share the open wedge; the
  // two rods diverge from the same tail post and the hack rod overflies
  // the cock's free-sprung dress on its way to the crank — each of these
  // is a corridor the stop-work design depends on:
  { a: 'Stop lever', b: 'Balance cock', min: 0.15 },
  { a: 'Stop lever', b: 'Fork cock', min: 0.15 },
  { a: 'Stop lever', b: 'Pallet fork', min: 0.15 },
  // (Hack rod ⇄ Reset rod is EXPECTED contact now — shared post pin
  // stack in the low corridor; see EXPECTED_PAIRS.)
  { a: 'Hack rod', b: 'Balance cock', min: 0.15 },
  { a: 'Hack rod', b: 'Three-quarter plate', min: 0.15 },
  // The low corridor's guards: both rods cross UNDER the great wheel's
  // disc and thread past the transfer wheel and the centre arbor's
  // lower-pivot collar — the elbow scans place them, these rows keep
  // them placed.
  { a: 'Hack rod', b: 'Fusee & great wheel', min: 0.15 },
  { a: 'Hack rod', b: 'Keyless works', min: 0.15 },
  { a: 'Hack rod', b: 'Center wheel', min: 0.15 },
  { a: 'Reset rod', b: 'Keyless works', min: 0.15 },
  { a: 'Reset rod', b: 'Center wheel', min: 0.15 },
  { a: 'Reset rod', b: 'Heart cam (seconds reset)', min: 0.15 },
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
  // The bridge-reveal pass re-solves the plate cut around the BUILT cock
  // with the cut margin (0.5) — this row keeps that reveal from silently
  // eroding (the pair used to be EXPECTED-contact, which is how the plate
  // sat flush against and into the bridge unnoticed).
  { a: 'Balance cock', b: 'Three-quarter plate', min: 0.15 },
  // The reset/hack rods cross the plate top near the keyless corner —
  // ROD_Z_LIFT carries a derived term for the fusee's let-down square,
  // and this row holds it. (The set-up work is base-plate level now,
  // nowhere near the rods; the great wheel low band covers it instead.)
  { a: 'Reset rod', b: 'Fusee & great wheel', min: 0.15 },
  { a: 'Set-up work', b: 'Fusee & great wheel', min: 0.15 },
  // The maintaining detent's arm overhangs the great wheel and threads
  // between the drum, the chain's low wraps and the center wheel — the
  // azimuth scan places it, these rows keep it placed.
  { a: 'Maintaining detent', b: 'Mainspring drum', min: 0.15 },
  { a: 'Maintaining detent', b: 'Chain', min: 0.15 },
  { a: 'Maintaining detent', b: 'Center wheel', min: 0.15 },
  // Jumping-minute setting: the jumper lives in the thin slice between
  // the minute wheel and the hour wheel on the dial face — these rows
  // hold that slice and its neighbours. The Dial row excludes the crown
  // axis: crown out SEATS the beak in the minute star (a Dial-unit mesh
  // via the motion-works nesting) — that contact is the detent itself.
  { a: 'Minute jumper', b: 'Dial', min: 0.15, axes: ['beat', 'reserve', 'train'] },
  { a: 'Minute jumper', b: 'Hour wheel', min: 0.15 },
  { a: 'Minute jumper', b: 'Keyless works', min: 0.15 },
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
    .filter((n) => !['plate', 'pillars', 'mainspring', 'alarm mainspring', 'crown'].includes(n) && !groundingNames.has(n) && !MECH_GRAPH.todo.some(([a, b]) => a === n || b === n));

  // 2. Drive: empirical motion per axis vs force reachability.
  const fromSpring = reachable(MECH_GRAPH.drive, 'mainspring');
  const fromCrown = reachable(MECH_GRAPH.drive, 'crown');
  const fromAlarm = reachable(MECH_GRAPH.drive, 'Alarm crown'); // §24 alarm force source
  const fromAlarmSpring = reachable(MECH_GRAPH.drive, 'alarm mainspring'); // §25 striking-works force source
  const undriven = [];
  const sourceFor = (name) => (name === 'crown' ? fromCrown
    : name === 'alarm' ? fromAlarm
    : name === 'alarmStrike' ? fromAlarmSpring
    : fromSpring);
  const forceFor = (name) => (name === 'crown' ? 'crown'
    : name === 'alarm' ? 'Alarm crown'
    : name === 'alarmStrike' ? 'alarm mainspring'
    : 'mainspring');
  for (const axis of axes) {
    const source = sourceFor(axis.name);
    clock.setPose(axis.pose(0, clock));
    const sig0 = units.map(unitSignature);
    clock.setPose(axis.pose(0.63, clock));
    const sig1 = units.map(unitSignature);
    clock.setPose(axis.pose(1, clock));
    const sig2 = units.map(unitSignature);
    units.forEach((u, i) => {
      const moves = Math.abs(sig1[i] - sig0[i]) > 1e-6 || Math.abs(sig2[i] - sig0[i]) > 1e-6;
      if (moves && !source.has(u.name)) {
        undriven.push({ unit: u.name, axis: axis.name, expectedForce: forceFor(axis.name) });
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
  {
    // The fork's STEEL (body, arm bars, slotted heads — everything that is
    // not a ruby) must NEVER meet the wheel: only the stones are contact
    // surfaces. This is the guard the old fork lacked — its top web swept
    // through the teeth every beat, invisible because the unit pair is
    // expected-contact and the row above only watches the rubies.
    pair: ['Escape wheel', 'Pallet fork'],
    maxDepth: 0.02,
    axis: 'beat',
    nSamples: 150,
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
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && o.material.color.getHex() !== 0xb01326) out.push(o);
      });
      return out;
    },
  },
  {
    // Minute jumper's beak seated in the minute star (BUILT §1, PRs
    // #28/#29): EXPECTED contact (see EXPECTED_PAIRS above), but the depth
    // needs its own tight budget for the same reason the escape-wheel rows
    // do. This pair used to bury the beak 0.268 deep, because STAR_DEPTH
    // was styled (0.45) rather than derived: with STAR_POINTS forced to 180
    // by the motion works, that made each tooth 3.4× deeper than its own
    // pitch arc, and no beak of practical width could seat in the resulting
    // needle valley. Deriving the depth from the pitch (see STAR_FLANK in
    // main.js) took the worst case to 0.009 — the seated tip's own contact,
    // nothing more. maxDepth is set just over that so a future upstream
    // change (a different STAR_R, STAR_FLANK, or JMP_PIV_R) that reopens
    // the gap fails here instead of silently shipping.
    //
    // NOTE for anyone re-measuring this pair by hand: setting
    // window.requestAnimationFrame to a THROTTLED shim (e.g. a setTimeout
    // stand-in, the usual trick for driving sweeps with the preview pane
    // hidden) is NOT enough to get a repeatable number here — the live
    // loop is still running underneath and can nudge crownPullT/tau
    // between individual setPose calls in a slow (many-BVH-query) sweep,
    // so two back-to-back runs can report different worst poses (observed
    // 0.123 vs 0.191 for the identical built geometry). Set it to a no-op
    // (`() => {}`) to fully freeze the sim before sweeping this pair.
    pair: ['Motion works', 'Minute jumper'],
    maxDepth: 0.03,
    axis: 'jumperEngage',
    nSamples: 120,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'star') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'jumperBeak') out.push(o); });
      return out;
    },
  },
  {
    // Alarm cam ⇄ hammer nose (§25 A). This budget exists BECAUSE the overlap
    // sweep cannot see it: 'Alarm striking wheel' ⇄ 'Alarm hammer' is a
    // declared EXPECTED pair, and EXPECTED is granted per unit PAIR, so the
    // one intended contact excuses every other overlap between those two
    // units — including a flank driven straight through the lever it is meant
    // to lift. This pair is also the entry's design history: a PIN wheel was
    // built here first and this budget is what caught it, reporting 0.375 of
    // pin buried in the tail because a released pin cannot get out of a
    // falling hammer's way at this hammer's throw. The cam profile is
    // GENERATED from the lift law, so a correct build touches and never bites;
    // the budget is set just over the flat-facet error of the extruded
    // profile, and any later change to the tail length, rest angle, wheel
    // position or lift law that breaks the generation fails here instead of
    // shipping a cam sunk into a lever.
    //
    // CALIBRATION, because 0.12 looks loose for a pair that should touch and
    // not bite. A cam follower RIDES its cam, so this contact is tangential,
    // and mtvDepth resolves a tangential contact badly: its escape directions
    // are a fixed set, none of which lines up with a flank normal, so clearing
    // one costs far more travel than the real overlap. Measured by shrinking
    // the tail in place and re-running: a correct build reports 0.094, and the
    // number falls about 1:1 with the shrink, hitting 0 at 0.1 — i.e. 0.094 IS
    // the floor for touching here, not a bite. 0.12 therefore still fails on
    // about 0.03 of genuine penetration, which is the resolution this measure
    // can honestly claim. (The pin wheel it replaced reported 0.375.)
    pair: ['Alarm striking wheel', 'Alarm hammer'],
    maxDepth: 0.12,
    axis: 'alarmStrike',
    nSamples: 240,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmCam') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmTail') out.push(o); });
      return out;
    },
  },
  {
    // §25 C stage 2: the rattrapante follower's nose on the heart cam — a cam
    // contact between two units that are already EXPECTED (the tube rides the
    // hour tube), so the overlap sweep is structurally blind here, exactly the
    // striking-works precedent above. Swept on the ARMED alarm axis: the tube
    // turns under a fixed hour wheel, so the nose rides the entire heart once
    // per crown revolution. Budget matches the cam-follower calibration (0.12):
    // a follower TOUCHES, and mtvDepth resolves tangential contact badly.
    pair: ['Hour wheel', 'Alarm disc'],
    maxDepth: 0.12,
    axis: 'alarm',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmHeart') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmNose') out.push(o); });
      return out;
    },
  },
  {
    // §35: the link beak riding the castellations' tops — the §25 D click's
    // treatment for the new reader; swept on the strike axis (the column
    // steps through both parities as the alarm arms and re-arms).
    pair: ['Alarm switch', 'Alarm link'],
    maxDepth: 0.12,
    axis: 'alarmStrike',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmColWheel') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmLinkBeak') out.push(o); });
      return out;
    },
  },
  {
    // §35: the centre crank on the ring's drive tab — the run's last contact.
    pair: ['Alarm link', 'Alarm selector'],
    maxDepth: 0.12,
    axis: 'alarm',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmLinkCrankCentre') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmSelRing') out.push(o); });
      return out;
    },
  },
  {
    // §34 pass 2b: the rocker's sensing pin on the selector ring's face —
    // the fixed⇄co-rotating interface, riding at every azimuth as the tube
    // turns. Swept on the alarm axis (a full relative revolution).
    pair: ['Alarm disc', 'Alarm selector'],
    maxDepth: 0.12,
    axis: 'alarm',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmSelPin') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmSelRing') out.push(o); });
      return out;
    },
  },
  {
    // §34: follower-B's nose on heart-B — the armed coupling's working
    // contact, the exact mirror of the A pair below in §25 C's stage 2.
    // Swept on the alarm axis: setting turns the WHEEL (and heart-B) under
    // the armed-seated nose... and disarmed, the tube turns under a
    // stationary heart-B — both directions live on this axis.
    pair: ['Alarm setting wheel', 'Alarm disc'],
    maxDepth: 0.12,
    axis: 'alarm',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmFaceCam') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmPinB') out.push(o); });
      return out;
    },
  },
  {
    // §29 step 3: the feeler's pin ON the disc's raised track — a riding
    // contact between units that are EXPECTED (the read station), so the
    // sweep is structurally blind here (the follower-nose precedent above).
    // Swept on the alarm axis: setting turns the disc a full revolution
    // under the fixed pin, so the gap's edges pass under it — the ramp in
    // tick keeps the tip on the corner; the budget absorbs the tangential
    // graze the mtv resolves badly (same 0.12 as the cam-follower pair).
    pair: ['Alarm release disc', 'Alarm release feeler'],
    maxDepth: 0.12,
    axis: 'alarm',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmDiscTrack') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmFeelerPin') out.push(o); });
      return out;
    },
  },
  {
    // §29 step 4: the pawl's beak in the winding contrate's tooth band — a
    // detent riding a turning member (the climb spins on the strike axis's
    // back-spin and under winding), with the spring-steel tip following the
    // saw profile kinematically. Same blindness argument, same calibration.
    pair: ['Alarm winding train', 'Alarm release feeler'],
    maxDepth: 0.12,
    axis: 'alarmStrike',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmWindContrate') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmPawlBeak') out.push(o); });
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
      clock.setPose(axis.pose(f, clock));
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
      clock.setPose(axis.pose(f, clock));

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
      clock.setPose(axis.pose(useF, clock));
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
// Focused battery — the iterative-geometry convenience. The full entry points
// (runInspection / checkClearances) sweep EVERY unit pair across all six pose
// axes (~4-6 min) — the price of a clean-slate regression pass. During feature
// work you have just moved a handful of parts and only care about the pairs
// those parts touch. focusedCheck runs the same graph + support + penetration +
// clearance checks, but SCOPED: the support edges, penetration budgets and
// clearance budgets are filtered to rows where EITHER unit is in `unitNames`,
// and every sweep is confined to `axes` (default: all). On the pairs it does
// cover it is bit-identical to the full battery — same budgets, same sweep
// engine, same tolerances — it just skips the thousands of pair·pose
// evaluations that cannot involve the parts you changed, so it finishes in
// seconds instead of minutes. The full-battery entry points are unchanged;
// this is purely additive, and NOT a substitute for the pre-land clean run
// (it only sees the pairs you named — a change that breaks a pair you did not
// list is invisible to it).
//
// `axes` is a list of axis NAMES (['beat', 'alarmStrike']) — omitted ⇒ all six
// (axis objects are also accepted). A penetration or clearance budget whose
// axis is outside that set is dropped, so narrowing the axis set only ever
// REMOVES work — it never leaves a budget pointing at an axis that isn't there.
//
// Returns { units, axes, support, graph, penetration, clearances } — each field
// the verbatim return of the underlying check — so start()/status() stash and
// surface it the same way they do the individual checks.
// ---------------------------------------------------------------------------
export async function focusedCheck(clock, unitNames, { axes: axisArg } = {}) {
  const names = new Set(Array.isArray(unitNames) ? unitNames : [unitNames]);
  const axisNames = axisArg && axisArg.map((a) => (typeof a === 'string' ? a : a.name));
  const axes = axisNames ? AXES.filter((a) => axisNames.includes(a.name)) : AXES;
  const axisSet = new Set(axes.map((a) => a.name));
  const touches = (a, b) => names.has(a) || names.has(b);

  // Support: only the declared support edges that attach one of these units to
  // (or hang one of these units from) its fixture.
  const supportEdges = MECH_GRAPH.support.filter(([a, b]) => touches(a, b));
  const support = checkSupportGeometry(clock, { edges: supportEdges });

  // Graph is inherently whole-movement (grounding / drive / anchor / bridge /
  // pinion are global invariants), so it is run in full — but its per-axis
  // motion probe honours the axis filter, so a single-axis focus doesn't
  // re-pose all six.
  const graph = checkMechanicalGraph(clock, { axes });

  // Penetration: budgets whose pair touches a focus unit AND whose (single)
  // axis is in the focus set.
  const penBudgets = PENETRATION_BUDGETS.filter(
    (b) => touches(b.pair[0], b.pair[1]) && axisSet.has(b.axis));
  const penetration = checkPenetrationBudgets(clock, { budgets: penBudgets, axes });

  // Clearances: budgets whose pair touches a focus unit, swept only on the
  // focus axes (each budget's own `axes` scoping still applies on top).
  const clrBudgets = CLEARANCE_BUDGETS.filter((b) => touches(b.a, b.b));
  const clearances = await checkClearances(clock, { budgets: clrBudgets, axes });

  const result = { units: [...names], axes: [...axisSet], support, graph, penetration, clearances };
  window.__focusedReport = result;
  return result;
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
// ---------------------------------------------------------------------------
// FREE-ANNULUS PROBE (§38's siting question; a first slice of §36)
//
// "At world height z, is there a radius where a full RING of clearance
// exists — over every azimuth, and over every pose the movement can reach?"
// §38 needs it because the alarm's release notch can only narrow by moving
// OUTWARD (its angular width is floored by pin ÷ radius), and a ring gate has
// to be free all the way round.
//
// Why not the obvious probes. §35 burned three built-and-torn-out corridors
// on instruments with structural blind spots, and TODO items 5–7 name the
// classes. This one avoids them deliberately:
//
//   · NOT a bounding-box scan. Run naively over this scene, radial AABB
//     occupancy merges to a single 0..56 span, because the AABB of any large
//     flat part covers every radius. Bounding boxes cannot answer a radial
//     question about a disc.
//   · NOT a vertex scan. Vertex occupancy is blind to the interior of a big
//     face — slabs and wheel discs carry vertices only at hub and rim, which
//     is exactly how §35's route 1 "passed" while spearing the keyless works.
//   · NOT a ray bundle. The fusee chain is thin enough to thread between
//     rays; §35's route 2 passed 5-ray bundles and was still wrong.
//
// Instead it SLICES: every triangle that crosses the slab [z ± clearance]
// contributes its true footprint to a polar occupancy grid, tested per cell
// with point-in-triangle rather than by bounding box. Faces are therefore
// solid to it, and nothing thin can slip through.
//
// And it is SWEPT, not rest-pose. Every axis is sampled and the grids are
// OR-ed, so a turning wheel fills its own annulus — the §36 semantics: a
// corridor must never thread between the spokes of a moving wheel.
//
// Conservative by construction, in the safe direction: the slab is the full
// clearance thickness, the footprint is the whole triangle, and occupancy is
// dilated by the clearance afterwards. It will under-report free space before
// it ever over-reports it — so a ring it calls FREE is trustworthy, while a
// "nothing free" answer is a reason to refine (smaller dr, more azimuths)
// rather than a proof.
//
//   start(clock, 'freeAnnulus', { z: -6.0 });
//
export async function findFreeAnnulus(clock, {
  z,
  rMin = 2, rMax = null, dr = 0.25, nAz = 360,
  clearance = CLEAR_MARGIN,
  axes = AXES, perAxis = 5,
  exclude = [],
  yieldEvery = 8,
} = {}) {
  if (typeof z !== 'number') throw new Error('freeAnnulus needs a z (world height of the slice)');
  const rHi = rMax ?? clock.plateR;
  const nR = Math.max(1, Math.ceil((rHi - rMin) / dr));
  const dAz = (Math.PI * 2) / nAz;
  const occ = new Uint8Array(nR * nAz);

  // Which meshes to ignore: everything under the named units.
  const skip = new Set();
  for (const name of exclude) {
    const u = (clock.labelEntries || []).find((l) => l.name === name);
    if (u) u.obj.traverse((o) => skip.add(o));
  }

  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const box = new THREE.Box3();
  const zLo = z - clearance, zHi = z + clearance;

  const markTriangle = () => {
    if (Math.min(A.z, B.z, C.z) > zHi || Math.max(A.z, B.z, C.z) < zLo) return;
    // Polar bounds of the triangle's xy projection, then point-in-triangle
    // per cell inside them.
    const xs = [A.x, B.x, C.x], ys = [A.y, B.y, C.y];
    const xLo = Math.min(...xs), xHi = Math.max(...xs);
    const yLo = Math.min(...ys), yHi = Math.max(...ys);
    const spansOrigin = xLo <= 0 && xHi >= 0 && yLo <= 0 && yHi >= 0;
    const corners = [[xLo, yLo], [xLo, yHi], [xHi, yLo], [xHi, yHi]];
    const rFar = Math.max(...corners.map(([x, y]) => Math.hypot(x, y)));
    const cx = Math.min(Math.max(0, xLo), xHi), cy = Math.min(Math.max(0, yLo), yHi);
    const rNear = spansOrigin ? 0 : Math.hypot(cx, cy);
    let i0 = Math.floor((rNear - rMin) / dr), i1 = Math.ceil((rFar - rMin) / dr);
    if (i1 < 0 || i0 > nR - 1) return;
    i0 = Math.max(0, i0); i1 = Math.min(nR - 1, i1);
    // Marking is INTERIOR FILL + EDGE WALK, and it needs to be both.
    //
    // Centre-test fill alone silently misses anything thinner than a cell —
    // at r 35 with nAz 120 a cell spans 1.83 units while a 0.4 rod subtends
    // 0.65°, so the rod vanishes between samples. That is §35's ray-bundle
    // blind spot rebuilt in polar coordinates.
    //
    // Marking the whole polar bounding box instead is safe but far too blunt:
    // a tessellated rim is long chord triangles whose polar AABB reaches well
    // past the part, and on the dial-sheet control that ate three units of
    // genuinely free space outside r 39.49 and reported NOTHING free.
    //
    // So: fill the interior by cell centre, then walk the three edges and
    // mark every cell they pass through. A sliver too thin to contain a cell
    // centre is still caught, because its edges cross the cells it occupies.
    const mark = (x, y) => {
      const r = Math.hypot(x, y);
      const i = Math.floor((r - rMin) / dr);
      if (i < 0 || i >= nR) return;
      const j = ((Math.floor(Math.atan2(y, x) / dAz) % nAz) + nAz) % nAz;
      occ[i * nAz + j] = 1;
    };
    // interior
    const d0 = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    if (Math.abs(d0) > 1e-12) {
      for (let i = i0; i <= i1; i++) {
        const r = rMin + (i + 0.5) * dr;
        for (let j = 0; j < nAz; j++) {
          const idx = i * nAz + j;
          if (occ[idx]) continue;
          const th = (j + 0.5) * dAz, px = r * Math.cos(th), py = r * Math.sin(th);
          const u = ((B.y - C.y) * (px - C.x) + (C.x - B.x) * (py - C.y)) / d0;
          const v = ((C.y - A.y) * (px - C.x) + (A.x - C.x) * (py - C.y)) / d0;
          if (u >= 0 && v >= 0 && u + v <= 1) occ[idx] = 1;
        }
      }
    }
    // edges — step finer than one cell in whichever direction is tighter
    for (const [P, Q] of [[A, B], [B, C], [C, A]]) {
      const len = Math.hypot(Q.x - P.x, Q.y - P.y);
      if (len < 1e-9) { mark(P.x, P.y); continue; }
      const rNearSeg = Math.max(Math.min(Math.hypot(P.x, P.y), Math.hypot(Q.x, Q.y)), 1e-3);
      const step = Math.max(0.5 * Math.min(dr, rNearSeg * dAz), 0.01);
      const steps = Math.min(Math.ceil(len / step), 4000);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        mark(P.x + (Q.x - P.x) * t, P.y + (Q.y - P.y) * t);
      }
    }
  };

  let poses = 0;
  for (const axis of axes) {
    for (let s = 0; s < perAxis; s++) {
      clock.setPose(axis.pose(s / Math.max(1, perAxis - 1)));
      clock.scene.updateMatrixWorld(true);
      clock.scene.traverse((o) => {
        if (!o.isMesh || skip.has(o)) return;
        box.setFromObject(o);
        if (box.min.z > zHi || box.max.z < zLo) return;   // broad phase on the slab only
        const pos = o.geometry.getAttribute('position');
        const index = o.geometry.getIndex();
        const n = index ? index.count : pos.count;
        for (let t = 0; t < n; t += 3) {
          const a = index ? index.getX(t) : t, b = index ? index.getX(t + 1) : t + 1, c = index ? index.getX(t + 2) : t + 2;
          A.fromBufferAttribute(pos, a).applyMatrix4(o.matrixWorld);
          B.fromBufferAttribute(pos, b).applyMatrix4(o.matrixWorld);
          C.fromBufferAttribute(pos, c).applyMatrix4(o.matrixWorld);
          markTriangle();
        }
      });
      poses++;
      if (poses % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Dilate by the clearance: radially a fixed cell count, angularly an
  // r-dependent one (the same arc is fewer cells further out).
  const grown = new Uint8Array(occ);
  const kR = Math.ceil(clearance / dr);
  for (let i = 0; i < nR; i++) {
    const r = rMin + (i + 0.5) * dr;
    const kA = Math.ceil(clearance / Math.max(r * dAz, 1e-6));
    for (let j = 0; j < nAz; j++) {
      if (!occ[i * nAz + j]) continue;
      for (let di = -kR; di <= kR; di++) {
        const ii = i + di; if (ii < 0 || ii >= nR) continue;
        for (let dj = -kA; dj <= kA; dj++) grown[ii * nAz + ((j + dj) % nAz + nAz) % nAz] = 1;
      }
    }
  }

  // A ring is usable only if EVERY azimuth at that radius is clear.
  const perRadius = [];
  for (let i = 0; i < nR; i++) {
    let blocked = 0;
    for (let j = 0; j < nAz; j++) if (grown[i * nAz + j]) blocked++;
    perRadius.push({ r: +(rMin + (i + 0.5) * dr).toFixed(3), freeFrac: +(1 - blocked / nAz).toFixed(4) });
  }
  const bands = [];
  let run = null;
  for (const row of perRadius) {
    if (row.freeFrac === 1) { if (!run) run = { from: row.r, to: row.r }; else run.to = row.r; }
    else if (run) { bands.push(run); run = null; }
  }
  if (run) bands.push(run);
  for (const b of bands) b.width = +(b.to - b.from + dr).toFixed(3);
  bands.sort((a, b) => b.width - a.width);

  clock.resetInputs();
  return {
    z, rMin, rMax: rHi, dr, nAz, clearance, posesSampled: poses,
    freeRings: bands,
    widestFreeRing: bands[0] ?? null,
    tightestOccupied: perRadius.filter((p) => p.freeFrac < 1).sort((a, b) => b.freeFrac - a.freeFrac).slice(0, 8),
    perRadius,
  };
}

// ---------------------------------------------------------------------------
// SWEPT-VOLUME REGISTRY (§36 part one, and the assert §36 requires of it)
//
// The debt: §35 burned three built-and-torn-out corridors on probes that could
// not see what MOVES, and the battery's own axis sampling can pass a wheel
// spoke between two samples (TODO items 5–7). Every fix so far was a smarter
// one-off probe. A registry makes it structural: each part declares the hull
// of its geometry over its whole pose range ONCE, and questions get asked of
// the hull instead of of a sample.
//
// Volumes are DERIVED, not hand-authored — §36 says most of them should be,
// and a hand table is the thing that rots (§10's four ungrouped units, §16's
// twice-derived wheel radius). Derivation per mesh:
//
//   · Track its world vertices across every axis sample.
//   · Motionless ⇒ STATIC: the volume is the geometry itself.
//   · Moves, all vertex z constant, and the motion fits a circle about a
//     z-parallel axis ⇒ REVOLVE: an annulus sector (centre, r-band, z-band,
//     θ-range) — exact for a rotation, and pose-INDEPENDENT, which is the
//     whole point.
//   · Anything else (the §35 lay shaft turns about a RADIAL axis, the crown
//     stem about its own) ⇒ APPROX: the union of per-pose bounds, flagged, so
//     nobody mistakes it for a proven hull.
//
// The spoke rule, which is the reason this exists: if a part turns further
// between two consecutive samples than its own angular width, the samples do
// NOT overlap and the true swept arc is not their union — it is everything
// between. Such a part is promoted to a FULL revolve. That is exactly §36's
// "a revolve fills spoke gaps, which is the right semantics: a corridor must
// never thread between the spokes of a turning wheel."
//
//   start(clock, 'sweptRegistry');
//
// §36 JOB B — PATH HULLS, for compound movers.
//
// `Reset rod` and `Keyless works` are not oscillators. The reset rod
// TRANSLATES and SWINGS — both endpoints moving — so no rotation about any
// fitted axis bounds it, and job A's declared arc cannot help by construction.
// Part one's fallback for these was one AABB over every pose, which is so
// loose the registry refuses to claim anything built on it (`approx`).
//
// A path hull is the middle term: not one box over the whole motion, but a
// LIST of boxes, one per sample, each unioned with its successor so the gap
// between two samples is covered by the box that spans them. A part that moves
// smoothly is then bounded by a sleeve that follows it instead of by the
// bounding box of everywhere it has ever been.
//
// Consecutive boxes are only unioned WITHIN one pose axis. The frames are
// every axis's sweep concatenated, so at a boundary the pose jumps from one
// sweep's end to the next sweep's start — unioning across that would bridge
// two unrelated configurations and inflate the sleeve back to an AABB. This is
// the same boundary rule the spoke and oscillation tests already carry.
function buildPathHull(series, perAxis) {
  const boxes = [];
  const acc = (b, pts) => {
    for (let i = 0; i < pts.length; i += 3) {
      if (pts[i] < b[0]) b[0] = pts[i];       if (pts[i] > b[3]) b[3] = pts[i];
      if (pts[i + 1] < b[1]) b[1] = pts[i + 1]; if (pts[i + 1] > b[4]) b[4] = pts[i + 1];
      if (pts[i + 2] < b[2]) b[2] = pts[i + 2]; if (pts[i + 2] > b[5]) b[5] = pts[i + 2];
    }
  };
  for (let i = 0; i < series.length; i++) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    acc(b, series[i]);
    const sameAxis = (i + 1) % perAxis !== 0;
    if (sameAxis && i + 1 < series.length) acc(b, series[i + 1]);
    boxes.push(b);
  }
  // Drop any box wholly inside another — a part at rest on most axes produces
  // the same box many times over, and the overlap test pays for every one.
  const keep = [];
  for (const b of boxes) {
    if (keep.some((k) => b[0] >= k[0] && b[1] >= k[1] && b[2] >= k[2] && b[3] <= k[3] && b[4] <= k[4] && b[5] <= k[5])) continue;
    for (let i = keep.length - 1; i >= 0; i--) {
      const k = keep[i];
      if (k[0] >= b[0] && k[1] >= b[1] && k[2] >= b[2] && k[3] <= b[3] && k[4] <= b[4] && k[5] <= b[5]) keep.splice(i, 1);
    }
    keep.push(b);
  }
  return keep;
}

const THETA_BINS = 2048;                              // 0.0031 rad per bin
const THETA_BIN_W = (Math.PI * 2) / THETA_BINS;
const thetaBin = (a) => ((Math.floor(a / THETA_BIN_W) % THETA_BINS) + THETA_BINS) % THETA_BINS;

export async function buildSweptRegistry(clock, {
  axes = AXES, perAxis = 12, validatePerAxis = 29, eps = 1e-6, yieldEvery = 4,
} = {}) {
  // CANONICAL STATE FIRST — the registry's output must be a function of the
  // geometry, not of session history. start() already enforces this for every
  // battery check and fingerprintFull() for every pose, but the registry only
  // reset AFTERWARD (leaving the clock clean for the next caller), so a
  // DIRECT call sampled whatever the session had restored — an engaged alarm,
  // an open explode, a crown pull — and the run after it sampled the clean
  // state its own tail had produced. Same code, same page, different registry:
  // 468 rows then 475 in §40's census, and job A's static/approx counts
  // drifting between runs. setPose() cannot save this on its own, because it
  // assigns only the fields a pose names and everything else rides through.
  clock.resetInputs();
  // …and HOLD the frame loop for the whole build: canonical state at entry is
  // not enough, because the sweep yields between samples and any rAF frame in
  // a gap integrates the eased shown-values by a wall-clock dt setPose cannot
  // undo. try/finally so a throw cannot leave the mechanism frozen.
  if (clock.beginSweepHold) clock.beginSweepHold();
  try {
  const units = collectUnits(clock, { includeExcluded: true });
  // Sample every mesh's world vertices over a pose set.
  const samplePoses = async (n) => {
    const frames = [];
    for (const axis of axes) {
      for (let s = 0; s < n; s++) {
        clock.setPose(axis.pose(s / Math.max(1, n - 1)));
        clock.scene.updateMatrixWorld(true);
        const frame = new Map();
        for (const u of units) for (const m of u.meshes) {
          const pos = m.geometry.getAttribute('position');
          const pts = new Float64Array(pos.count * 3);
          const v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z;
          }
          frame.set(m, pts);
        }
        frames.push(frame);
        if (frames.length % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }
    return frames;
  };

  const frames = await samplePoses(perAxis);

  // Kåsa algebraic circle fit — centre of the arc a point travels on.
  const fitCircle = (xs, ys) => {
    const n = xs.length;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
    const mx = sx / n, my = sy / n;
    let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
    for (let i = 0; i < n; i++) {
      const u = xs[i] - mx, v = ys[i] - my;
      suu += u * u; svv += v * v; suv += u * v;
      suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
    }
    const det = 2 * (suu * svv - suv * suv);
    if (Math.abs(det) < 1e-12) return null;
    const uc = (svv * (suuu + suvv) - suv * (svvv + svuu)) / det;
    const vc = (suu * (svvv + svuu) - suv * (suuu + suvv)) / det;
    const cx = mx + uc, cy = my + vc;
    let rm = 0; for (let i = 0; i < n; i++) rm += Math.hypot(xs[i] - cx, ys[i] - cy);
    rm /= n;
    let resid = 0;
    for (let i = 0; i < n; i++) resid = Math.max(resid, Math.abs(Math.hypot(xs[i] - cx, ys[i] - cy) - rm));
    return { cx, cy, r: rm, resid };
  };

  const volumes = [];
  for (const u of units) {
    for (const m of u.meshes) {
      const series = frames.map((f) => f.get(m));
      const n0 = series[0].length / 3;
      // Does it move at all?
      let moves = false;
      for (const pts of series) {
        for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i] - series[0][i]) > eps) { moves = true; break; }
        if (moves) break;
      }
      let zLo = Infinity, zHi = -Infinity;
      for (const pts of series) for (let i = 2; i < pts.length; i += 3) { if (pts[i] < zLo) zLo = pts[i]; if (pts[i] > zHi) zHi = pts[i]; }
      if (!moves) {
        volumes.push({ unit: u.name, mesh: m, kind: 'static', zBand: [zLo, zHi] });
        continue;
      }
      // Planar? (every vertex holds its z)
      let planar = true;
      for (const pts of series) { for (let i = 2; i < pts.length && planar; i += 3) if (Math.abs(pts[i] - series[0][i]) > 1e-4) planar = false; if (!planar) break; }
      // Track one witness vertex's path and fit a circle to it.
      let fit = null;
      if (planar) {
        const wi = 0;
        const xs = series.map((p) => p[wi * 3]), ys = series.map((p) => p[wi * 3 + 1]);
        fit = fitCircle(xs, ys);
        if (fit && (fit.resid > Math.max(1e-3, fit.r * 1e-3) || fit.r < 1e-4)) fit = null;
      }
      if (!fit) {
        let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
        for (const pts of series) for (let i = 0; i < pts.length; i += 3) {
          if (pts[i] < xLo) xLo = pts[i]; if (pts[i] > xHi) xHi = pts[i];
          if (pts[i + 1] < yLo) yLo = pts[i + 1]; if (pts[i + 1] > yHi) yHi = pts[i + 1];
        }
        // §36B: a path hull instead of the single AABB this used to be. The
        // AABB is kept alongside as `box` so anything still reading it works,
        // but `kind` is now 'path' and the check CLAIMS it.
        volumes.push({
          unit: u.name, mesh: m, kind: 'path',
          box: [xLo, yLo, zLo, xHi, yHi, zHi],
          boxes: buildPathHull(series, perAxis),
          zBand: [zLo, zHi],
        });
        continue;
      }
      // REVOLVE about (cx, cy) ∥ z. r-band and per-frame θ extent.
      const { cx, cy } = fit;
      let rLo = Infinity, rHi = -Infinity;
      const arcs = [];
      for (const pts of series) {
        let aLo = Infinity, aHi = -Infinity;
        const base = Math.atan2(pts[1] - cy, pts[0] - cx);
        for (let i = 0; i < pts.length; i += 3) {
          const dx = pts[i] - cx, dy = pts[i + 1] - cy;
          const r = Math.hypot(dx, dy);
          if (r < rLo) rLo = r; if (r > rHi) rHi = r;
          let d = Math.atan2(dy, dx) - base;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (d < aLo) aLo = d; if (d > aHi) aHi = d;
        }
        arcs.push({ lo: base + aLo, hi: base + aHi, width: aHi - aLo });
      }
      // The spoke rule: if the part advances further between consecutive
      // samples than its own angular width, the sampled arcs do not overlap
      // and their union is NOT the swept set. Promote to a full revolve.
      let full = false, reason = null;
      const ownWidth = Math.max(...arcs.map((a) => a.width));
      // Consecutive samples are only comparable WITHIN one axis. The frames
      // are every axis's sweep concatenated, so at each axis boundary the
      // pose jumps from one sweep's end to the next sweep's start — which is
      // not motion the part performed. Comparing across that boundary made a
      // part that is monotonic within an axis and stationary elsewhere look
      // like it both jumped (spoke) and reversed (oscillates), and promoted
      // it to a full revolve for neither reason. `steps` carries null at each
      // boundary so both tests skip it.
      // §36 JOB A applies to the SPOKE rule too, and missing that was the
      // first version's bug. Both rules exist for the same reason — motion
      // between samples that the samples cannot see — so a declared travel
      // answers both. Checking it only on reversal meant the balance, the
      // hairspring and the reset hammer never consulted their declarations at
      // all: they step further than their own width, so they were promoted to
      // a full revolve as 'spoke' before the oscillation test ran.
      const declared = clock.declaredTravels && clock.declaredTravels.get(u.name);
      const bounded = declared && declared.rad > 0 && declared.rad < Math.PI * 2 ? declared.rad : 0;
      const steps = [];
      for (let i = 1; i < arcs.length; i++) {
        if (i % perAxis === 0) { steps.push(null); continue; }   // axis boundary: not a movement
        let step = arcs[i].lo - arcs[i - 1].lo;
        while (step > Math.PI) step -= Math.PI * 2;
        while (step < -Math.PI) step += Math.PI * 2;
        steps.push(step);
        if (Math.abs(step) > ownWidth && !bounded) { full = true; reason = 'spoke'; }
      }
      // OSCILLATORS cannot be bounded by sampling at all. A part that swings
      // out and back between two samples sweeps further than the interval
      // between them, and no sample count fixes it — the balance, the pallet
      // fork and the reset hammer all escaped their derived arc this way, and
      // that failure is the honest one: it is the very class §36 exists to
      // stop guessing at. So a series that REVERSES direction is bounded by
      // the full circle, which is safe but loose.
      //
      // Tightening these is the next increment and it is not derivable from
      // samples: it needs the pose law declared (FORK_BANK_DEG, the balance
      // amplitude), which is what §36 means by "declares, or derives from
      // MECH_GRAPH + its pose law". Until then they are marked so nobody
      // reads a full revolve as a measured travel.
      // §36 JOB A — a DECLARED travel replaces the full circle here, and only
      // here. The build states the arc it drives the part through
      // (`declareTravel` in main.js, at the site each constant is derived), so
      // for those parts the reversal is not an unknown: it is a bounded swing.
      //
      // The dilation is by the WHOLE declared travel in each direction, which
      // is looser than necessary but sound without assuming anything about
      // where the samples fell. Every true position and every sampled position
      // lie in one interval of width `travel`, so they differ by at most
      // `travel`; widening each sampled arc by that much therefore covers the
      // motion between samples, which is exactly what sampling cannot see.
      // For the pallet fork that is a few degrees against 360.
      let dilate = 0;
      if (!full) {
        for (let i = 1; i < steps.length; i++) {
          if (steps[i] === null || steps[i - 1] === null) continue;  // spans an axis boundary
          if (steps[i] * steps[i - 1] < -1e-12) {
            if (!bounded) { full = true; reason = 'oscillates'; }
            break;
          }
        }
      }
      // A declared part is dilated whether it tripped the spoke test, the
      // reversal test or neither — the travel is a property of the part, not
      // of which rule noticed it moving.
      if (!full && bounded) { dilate = bounded; reason = 'declared'; }
      // Angular coverage as a CIRCULAR BITMAP, not a [lo,hi] interval. Each
      // frame's bounds come from its own atan2 branch, so taking min/max
      // across frames silently mixes branches — that read as 74 containment
      // failures the first time this ran, every one of them an artefact of
      // the bookkeeping rather than a real escape. Bins also represent the
      // genuinely disjoint arcs a part can occupy on different pose axes,
      // which no single interval can.
      // A part that is itself a full annulus about its axis — every wheel
      // disc — is a full revolve the moment it turns at all, and binning it
      // is 2048 writes per frame for an answer already known.
      if (!full && ownWidth >= Math.PI * 2 - THETA_BIN_W) { full = true; reason = 'annular'; }
      let bins = null;
      if (!full) {
        bins = new Uint8Array(THETA_BINS);
        for (const a of arcs) {
          // A declared oscillator's arc is widened by the travel at BOTH ends;
          // for everything else `dilate` is 0 and this is the original union.
          const lo = a.lo - dilate, hi = a.hi + dilate;
          const span = hi - lo;
          const steps = Math.max(1, Math.ceil(span / THETA_BIN_W) + 1);
          for (let s = 0; s <= steps; s++) bins[thetaBin(lo + (span * s) / steps)] = 1;
        }
        if (bins.every((b) => b === 1)) { full = true; reason = 'covered'; }
      }
      // §36B: a part that REVERSES and has no declared travel is a compound
      // mover, not a rotator — the full circle part one gives it is what
      // produced every false static-vs-swept violation. A path hull bounds it
      // by where it actually went. Deliberately NOT applied to 'spoke' or
      // 'annular': those are genuine rotators, and for them the full circle is
      // the correct semantics — a corridor must never thread between the
      // spokes of a turning wheel.
      if (full && reason === 'oscillates') {
        volumes.push({
          unit: u.name, mesh: m, kind: 'path',
          box: null, boxes: buildPathHull(series, perAxis), zBand: [zLo, zHi],
          from: 'oscillates',
        });
        continue;
      }
      volumes.push({
        unit: u.name, mesh: m, kind: 'revolve', axis: [cx, cy],
        rBand: [rLo, rHi], zBand: [zLo, zHi],
        bins: full ? null : bins, full, reason,
        declaredRad: dilate || undefined,
        coverage: full ? 1 : +(bins.reduce((a, b) => a + b, 0) / THETA_BINS).toFixed(4),
      });
    }
  }

  // THE ASSERT §36 REQUIRES: every declared volume must CONTAIN its part at
  // every pose. Validated against a FINER, phase-shifted sample set than the
  // one the hull was derived from — checking a hull against its own samples
  // would be vacuous, and catching a hull that is merely stale is the point.
  const fine = await samplePoses(validatePerAxis);
  const tol = 1e-3;
  const escapes = [];
  for (const vol of volumes) {
    for (const frame of fine) {
      const pts = frame.get(vol.mesh);
      if (!pts) continue;
      let bad = null;
      for (let i = 0; i < pts.length; i += 3) {
        const x = pts[i], y = pts[i + 1], z = pts[i + 2];
        if (vol.kind === 'static') {
          if (z < vol.zBand[0] - tol || z > vol.zBand[1] + tol) { bad = 'z'; break; }
        } else if (vol.kind === 'approx') {
          if (x < vol.box[0] - tol || x > vol.box[3] + tol || y < vol.box[1] - tol
              || y > vol.box[4] + tol || z < vol.box[2] - tol || z > vol.box[5] + tol) { bad = 'box'; break; }
        } else if (vol.kind === 'path') {
          // §36 job B's sleeve: contained if the vertex is inside ANY of its
          // boxes. Adding this case is the fix for a hard crash — job B
          // introduced a FOURTH volume shape and this dispatch had three
          // arms, the last of which assumes revolve and reads vol.axis[0].
          // A path volume fell into it and threw on an axis it never has,
          // taking buildSweptRegistry down and with it every check built on
          // the registry.
          //
          // Worth naming the shape of the mistake: the bug was not the
          // missing field, it was an `else` standing in for "therefore
          // revolve". A dispatch whose default arm assumes one specific kind
          // silently inherits every kind added later.
          let inside = false;
          for (const b of vol.boxes) {
            if (x >= b[0] - tol && x <= b[3] + tol && y >= b[1] - tol
                && y <= b[4] + tol && z >= b[2] - tol && z <= b[5] + tol) { inside = true; break; }
          }
          if (!inside) { bad = 'sleeve'; break; }
        } else {
          const r = Math.hypot(x - vol.axis[0], y - vol.axis[1]);
          if (r < vol.rBand[0] - tol || r > vol.rBand[1] + tol) { bad = `r=${r.toFixed(3)}`; break; }
          if (z < vol.zBand[0] - tol || z > vol.zBand[1] + tol) { bad = `z=${z.toFixed(3)}`; break; }
          if (!vol.full) {
            // A vertex is contained if its bin, or either neighbour, is
            // covered — one bin of slack for the discretisation itself.
            const b = thetaBin(Math.atan2(y - vol.axis[1], x - vol.axis[0]));
            if (!vol.bins[b] && !vol.bins[(b + 1) % THETA_BINS] && !vol.bins[(b + THETA_BINS - 1) % THETA_BINS]) { bad = 'θ'; break; }
          }
        }
      }
      if (bad) {
        // A DERIVED arc that does not survive validation is widened to the
        // full circle rather than shipped. Deriving tight and validating
        // wider is only sound if the failure has somewhere safe to fall
        // back to — otherwise tightening the hulls just trades a loose
        // registry for a wrong one, which is worse. Recorded either way, so
        // the count stays a signal: it says how much of the registry cannot
        // be pinned from samples and is therefore waiting on a declared
        // pose law.
        // §36 job B, second pass at the sleeve fix. The FIRST attempt dilated
        // every box of every sleeve by 0.25x the inter-sample chord — sound
        // reasoning about arc sagitta, catastrophic economics: fast movers
        // have multi-unit chords, so every sleeve grew by up to a unit, raw
        // hull hits multiplied, and the confirm tier ground for 20+ minutes.
        // The check's own precedent is surgical: a revolve that escapes is
        // widened — THAT volume, not all of them. So an escaping sleeve is
        // dilated by ITS OWN measured overshoot (max distance of any escaping
        // vertex outside the sleeve, over the whole fine sweep), doubled for
        // headroom. The 90 sleeves that already hold stay exactly as tight as
        // before, which is what keeps the overlap check's raw-hit count sane.
        //
        // The dilation is derived from the same sweep that validates it, so
        // its containment there is partly self-fulfilling — the honest arbiter
        // is the second pass below, which re-checks widened sleeves and
        // DEMOTES whatever still fails, same as an unfixable revolve.
        escapes.push({ unit: vol.unit, kind: vol.kind, why: bad, widened: vol.kind === 'revolve' || vol.kind === 'path' });
        if (vol.kind === 'revolve') { vol.full = true; vol.bins = null; vol.reason = 'validation'; }
        else if (vol.kind === 'path') {
          let over = 0;
          for (const f2 of fine) {
            const q = f2.get(vol.mesh); if (!q) continue;
            for (let i = 0; i < q.length; i += 3) {
              let best = Infinity;
              for (const bx of vol.boxes) {
                const dx = Math.max(bx[0] - q[i], 0, q[i] - bx[3]);
                const dy = Math.max(bx[1] - q[i + 1], 0, q[i + 1] - bx[4]);
                const dz = Math.max(bx[2] - q[i + 2], 0, q[i + 2] - bx[5]);
                const dd = Math.max(dx, dy, dz);
                if (dd < best) best = dd;
                if (best === 0) break;
              }
              if (best > over && isFinite(best)) over = best;
            }
          }
          const grow = over * 2 + tol;
          for (const bx of vol.boxes) { bx[0] -= grow; bx[1] -= grow; bx[2] -= grow; bx[3] += grow; bx[4] += grow; bx[5] += grow; }
          vol.dilatedBy = +grow.toFixed(4);
          break;
        }
        break;
      }
    }
  }

  // Second pass over the widened set: whatever still escapes is a genuine
  // failure of the hull's SHAPE (its r or z band), not of its arc, and no
  // amount of angular widening fixes it. This is the number that must be 0.
  const stillEscaping = [];
  // Widened SLEEVES are re-checked here too — the dilation above was derived
  // from this same fine sweep, so passing it is partly self-fulfilling; what
  // this pass genuinely arbitrates is whether the doubled headroom holds. A
  // sleeve that STILL escapes demotes to approx over the union of its own
  // boxes, the registry saying plainly it cannot hull the part.
  for (const vol of volumes) {
    if (!(vol.kind === 'path' && vol.dilatedBy)) continue;
    let bad = false;
    for (const frame of fine) {
      const pts = frame.get(vol.mesh);
      if (!pts) continue;
      for (let i = 0; i < pts.length && !bad; i += 3) {
        let inside = false;
        for (const bx of vol.boxes) {
          if (pts[i] >= bx[0] - tol && pts[i] <= bx[3] + tol && pts[i+1] >= bx[1] - tol
              && pts[i+1] <= bx[4] + tol && pts[i+2] >= bx[2] - tol && pts[i+2] <= bx[5] + tol) { inside = true; break; }
        }
        if (!inside) bad = true;
      }
      if (bad) break;
    }
    if (bad) {
      let xLo = Infinity, yLo = Infinity, zL = Infinity, xHi = -Infinity, yHi = -Infinity, zH = -Infinity;
      for (const bx of vol.boxes) {
        if (bx[0] < xLo) xLo = bx[0]; if (bx[3] > xHi) xHi = bx[3];
        if (bx[1] < yLo) yLo = bx[1]; if (bx[4] > yHi) yHi = bx[4];
        if (bx[2] < zL) zL = bx[2];  if (bx[5] > zH) zH = bx[5];
      }
      stillEscaping.push({ unit: vol.unit, why: 'sleeve', demotedToApprox: true });
      vol.kind = 'approx'; vol.box = [xLo, yLo, zL, xHi, yHi, zH];
      delete vol.boxes; delete vol.hullBox;
    }
  }
  for (const vol of volumes) {
    if (vol.kind !== 'revolve' || !vol.full) continue;
    for (const frame of fine) {
      const pts = frame.get(vol.mesh);
      if (!pts) continue;
      let bad = null;
      for (let i = 0; i < pts.length; i += 3) {
        const r = Math.hypot(pts[i] - vol.axis[0], pts[i + 1] - vol.axis[1]);
        if (r < vol.rBand[0] - tol || r > vol.rBand[1] + tol) { bad = 'r'; break; }
        if (pts[i + 2] < vol.zBand[0] - tol || pts[i + 2] > vol.zBand[1] + tol) { bad = 'z'; break; }
      }
      if (bad) {
        // Its r or z band cannot hold it, so the motion is not really a
        // rotation about the fitted axis — the circle fit was a coincidence
        // of the sampled path. DEMOTE to approx: the registry says plainly
        // that it cannot hull this part, rather than shipping a hull that
        // does not contain it. Bounds come from the FINE sample set.
        let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, zL = Infinity, zH = -Infinity;
        for (const f2 of fine) {
          const q = f2.get(vol.mesh); if (!q) continue;
          for (let i = 0; i < q.length; i += 3) {
            if (q[i] < xLo) xLo = q[i]; if (q[i] > xHi) xHi = q[i];
            if (q[i+1] < yLo) yLo = q[i+1]; if (q[i+1] > yHi) yHi = q[i+1];
            if (q[i+2] < zL) zL = q[i+2]; if (q[i+2] > zH) zH = q[i+2];
          }
        }
        stillEscaping.push({ unit: vol.unit, why: bad, demotedToApprox: true });
        vol.kind = 'approx'; vol.box = [xLo, yLo, zL, xHi, yHi, zH];
        delete vol.axis; delete vol.rBand; delete vol.bins; vol.full = false;
        break;
      }
    }
  }

  clock.resetInputs();
  const byKind = volumes.reduce((a, v) => (a[v.kind] = (a[v.kind] || 0) + 1, a), {});
  return {
    derivedFrom: { axes: axes.length, perAxis, validatedAt: validatePerAxis },
    volumes: volumes.length, byKind,
    fullRevolves: volumes.filter((v) => v.full).length,
    approximate: volumes.filter((v) => v.kind === 'approx').map((v) => v.unit).filter((n, i, a) => a.indexOf(n) === i),
    containmentEscapes: escapes,
    widenedByValidation: escapes.filter((e) => e.widened).length,
    stillEscapingAfterWidening: stillEscaping,
    registry: volumes.map(({ mesh, bins, ...rest }) => rest),
    _volumes: volumes,   // with mesh + bins, for checkSweptOverlap (§36 part two)
  };
  } finally { if (clock.endSweepHold) clock.endSweepHold(); }
}

// §36 follow-up — VERIFY the low-corridor obstacle table.
//
// LOW_LINKAGE_OBSTACLES is the manual 2D prototype of the swept-volume idea:
// circles and stadium segments covering the low linkage's whole crown-stroke
// footprint, consumed by the balance-cock and pillar seat scans. §36 planned
// for the registry to subsume it. It CANNOT, structurally: the table is
// consumed MID-BUILD, before the registry can exist, and no amount of
// machinery moves an async pose sweep before the geometry it sweeps. What the
// registry's machinery CAN do is what §42 did for the shipped list — keep the
// hand-written input and fail loudly when it disagrees with sampled reality.
//
// The check sweeps every axis, samples the linkage units' world vertices,
// keeps those inside the corridor's z-band, and requires each to lie inside
// some table obstacle (small tolerance for tessellation). An escape means the
// table under-covers: a seat scan could place a leg inside the real swept
// path, which is precisely the silent rot this closes.
export async function checkLowCorridor(clock, {
  units = ['Setting lever', 'Reset rod', 'Hack rod', 'Reset hammer'],
  perAxis = 25, tol = 0.02, yieldEvery = 16,
} = {}) {
  const obstacles = clock.lowLinkageObstacles, band = clock.lowCorridorZBand;
  if (!obstacles || !band) return { error: 'clock does not expose lowLinkageObstacles / lowCorridorZBand' };
  const all = collectUnits(clock, { includeExcluded: true });
  const targets = all.filter((u) => units.includes(u.name));
  const dist = (o, x, y) => {
    if (o.ax === undefined) return Math.hypot(x - o.x, y - o.y) - o.r;
    const vx = o.bx - o.ax, vy = o.by - o.ay;
    const L2 = vx * vx + vy * vy || 1e-9;
    let t = ((x - o.ax) * vx + (y - o.ay) * vy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(x - o.ax - t * vx, y - o.ay - t * vy) - o.r;
  };
  if (clock.beginSweepHold) clock.beginSweepHold();
  const escapes = new Map();   // mesh -> worst escape
  let sampled = 0, inBand = 0, poses = 0;
  try {
    const v = new THREE.Vector3();
    for (const axis of AXES) {
      for (let sIdx = 0; sIdx < perAxis; sIdx++) {
        clock.setPose(axis.pose(sIdx / (perAxis - 1)));
        clock.scene.updateMatrixWorld(true);
        poses++;
        for (const u of targets) for (const m of u.meshes) {
          const pos = m.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            sampled++;
            if (v.z < band[0] || v.z > band[1]) continue;
            inBand++;
            let best = Infinity;
            for (const o of obstacles) { const d = dist(o, v.x, v.y); if (d < best) best = d; if (best <= tol) break; }
            if (best > tol) {
              const key = `${u.name} / ${m.name || '(unnamed)'}`;
              const prev = escapes.get(key);
              if (!prev || best > prev.escape)
                escapes.set(key, { escape: +best.toFixed(3), at: { axis: axis.name, f: +(sIdx / (perAxis - 1)).toFixed(3) },
                                   xy: [+v.x.toFixed(2), +v.y.toFixed(2)], z: +v.z.toFixed(2) });
            }
          }
        }
        if ((sIdx % yieldEvery) === yieldEvery - 1) await new Promise((r) => setTimeout(r, 0));
      }
    }
  } finally { if (clock.endSweepHold) clock.endSweepHold(); }
  clock.resetInputs();
  const rows = [...escapes.entries()].map(([mesh, e]) => ({ mesh, ...e }))
    .sort((a, b) => b.escape - a.escape);
  return {
    ok: rows.length === 0,
    units, poses, verticesSampled: sampled, verticesInBand: inBand,
    obstacleCount: obstacles.length, band, tol,
    escapes: rows,
  };
}

const CHECKS = {
  clearances: (clock, opts) => checkClearances(clock, opts),
  freeAnnulus: (clock, opts) => findFreeAnnulus(clock, opts),
  sweptRegistry: (clock, opts) => buildSweptRegistry(clock, opts),
  sweptOverlap: (clock, opts) => checkSweptOverlap(clock, opts),
  inspection: (clock, opts) => runInspection(clock, opts),
  support: (clock, opts) => checkSupportGeometry(clock, opts),   // sync, still fine
  graph: (clock, opts) => checkMechanicalGraph(clock, opts),
  penetration: (clock, opts) => checkPenetrationBudgets(clock, opts),
  lowCorridor: (clock, opts) => checkLowCorridor(clock, opts),
  // opts: { units: [...names], axes?: [...axisNames] } — the focused convenience.
  focused: (clock, opts = {}) => focusedCheck(clock, opts.units, opts),
};

export function start(clock, name, opts = {}) {
  const jobs = (window.__checks ||= {});
  if (!CHECKS[name]) return `unknown check "${name}" — have: ${Object.keys(CHECKS).join(', ')}`;
  const t0 = performance.now();
  // Canonical state per run (the §34 explode harvest, generalised): a check
  // must not inherit session accumulators — a leftover setPathRot, alarm
  // rotation or explode from earlier interaction (or from a PREVIOUS axis's
  // last pose) would silently move geometry under the sweep.
  clock.resetInputs();
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
  // 'focused' needs a unit list, so it is never part of the full regression pass.
  const names = Object.keys(CHECKS).filter((n) => n !== 'focused');
  for (const n of names) start(clock, n, opts[n] || {});
  return `started: ${names.join(', ')}`;
}

// ---------------------------------------------------------------------------
// Geometry fingerprint — the tool §13 (the layout refactor) is built against.
// A refactor that only reorganises WHERE numbers are computed, changing no
// geometry, must reproduce every part's world position bit-for-bit. The
// battery above proves the movement is still LEGAL (nothing collides, every
// support holds); this proves it is still the SAME. They answer different
// questions — a refactor could stay legal while nudging a part — so §13 wants
// both: capture fingerprint() on the pre-refactor tree, then diff after each
// mechanical step.
//
// It is a set of POSES (a rest pose plus one exercising each force input),
// each hashed from every labelled unit's world AABB, quantised to 1e-3 (finer
// than any real geometry change and coarser than float noise). fingerprint()
// returns { hash, poses, units } for a fast go/no-go; fingerprintFull() keeps
// the per-unit boxes so a mismatch can be localised to the part that moved.
//
// The poses deliberately drive all four inputs the movement has — the going
// train (tau), the crown pull/turn, the reserve, and both alarm axes — so a
// refactor that quietly changes how any ONE of them threads through is caught,
// not just the rest pose. Keep this list in sync with the AXES above: a new
// force input wants a pose here too, or the refactor of its path is unguarded.
// Baseline (§29 complete, rebased on §14+§27 main; 45 units, 44
// fingerprinted, 10 poses): 3868604154
// — verified IDENTICAL on a virgin boot, after running, and after a
// deliberately dirtied session, in one process. History: §29 step 0 found
// the previous baseline (2407965539) was an ATTRACTOR — it embedded
// updateExplode's frame-one teleport of the handsGroup (stale baseZ 2.5 vs
// the derived 3.2: the minute hand rode 0.7 below its designed plane in
// every session ever seen), and only frame-rendering sessions reached it.
// registerExplode boot-asserts baseZ now, resetInputs owns secondsZeroRef
// and the §29 crown-creep bank, console.warn collects into
// __clock.bootWarns, and the §29 feature (release disc, feeler, pawl,
// re-stratified centre, crisp heart, physical trip) moved the geometry to
// this value deliberately, step by verified step.
const FINGERPRINT_POSES = [
  { tau: 0, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 },
  { tau: 8 * 3600 * 0.37, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 },
  { tau: 0.05, crownPullT: 1, leverEngage: 1, tension: 1, windAccumTurns: 0 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.4, windAccumTurns: 0 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmCrownRotation: 2.0 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmStrikePhase: 7.3 },
  // §25 C: ARMED with the tube split from the hour wheel — poses the follower
  // mid-ride on the heart, the one configuration the other poses never reach.
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmCrownRotation: 2.0, alarmOn: 1 },
  // §25 C/D inputs added after the original list (the rule above demands a
  // pose per force input, or its path's refactors go unguarded):
  // — the alarm crown pulled to the SET position (the stem slid one throw,
  //   the sliding bevel at the setting corner);
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmCrownPullT: 1 },
  // — mid-RING: armed, released, part-wound — the brake lever lifted off the
  //   collar, the column wheel in a gap, the striker mid-cycle.
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmOn: 1, alarmReleased: 1, alarmStrikePhase: 5.2 },
];

// A stable string-hash (FNV-1a-ish, unsigned 32-bit) — no crypto dependency,
// and identical across browsers because it is pure integer arithmetic.
function strHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// The one unit the fingerprint must NOT read: the chain is display-only
// geometry that updateChain re-tessellates lazily (only when the reserve has
// visibly moved — see rebuildChain), so its mesh is PATH-DEPENDENT. Its AABB
// wobbles ~0.02 between a freshly rebuilt tessellation and a slightly stale
// one at the same tension, which is real mesh difference, not float noise, so
// it cannot be quantised away without also hiding real changes. It is not a
// layout element — nothing §13 refactors reaches it except through `tension`,
// which every other unit already captures — and its own correctness is covered
// by the battery (its two support edges and the overlap sweep). So it is
// excluded here by name rather than left to add noise to every hash.
const FINGERPRINT_EXCLUDE = new Set(['Chain']);

function fingerprintBoxes(clock, poses = FINGERPRINT_POSES) {
  const q = (n) => Math.round(n * 1000) / 1000 + 0; // +0 folds -0 → 0
  const box = new THREE.Box3();
  const rows = {};
  const entries = clock.labelEntries.filter((e) => !FINGERPRINT_EXCLUDE.has(e.name));
  const units = entries.map((e) => e.name).sort();
  poses.forEach((pose, pi) => {
    // Canonical inputs first, so a part the pose does not drive sits where a
    // fresh boot would put it rather than where the last save left it — the
    // fingerprint must not depend on session history (see resetInputs).
    clock.resetInputs();
    clock.setPose(pose);
    clock.scene.updateMatrixWorld(true);
    for (const e of entries) {
      box.setFromObject(e.obj);
      rows[`${e.name}#${pi}`] =
        [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map(q);
    }
  });
  clock.setPose(poses[0]); // leave it at rest
  return { rows, units, poseCount: poses.length };
}

// Go/no-go: one number. Same across two builds ⇒ every part is in the same
// place at every probed pose. Different ⇒ call fingerprintFull on both and
// diff `rows` to find which unit at which pose moved.
export function fingerprint(clock, poses) {
  const { rows, units, poseCount } = fingerprintBoxes(clock, poses);
  const canon = Object.keys(rows).sort().map((k) => k + ':' + rows[k].join(',')).join('|');
  return { hash: strHash(canon), poseCount, units: units.length };
}

// The same measurement with the per-unit boxes kept, for localising a
// mismatch. Returned rows are keyed 'Unit name#poseIndex'.
export function fingerprintFull(clock, poses) {
  return fingerprintBoxes(clock, poses);
}

// Diff two fingerprintFull() results (or a stored one against a live capture),
// returning only the rows that changed, with both values and the max delta.
export function fingerprintDiff(before, after) {
  const keys = new Set([...Object.keys(before.rows), ...Object.keys(after.rows)]);
  const changed = [];
  for (const k of keys) {
    const a = before.rows[k], b = after.rows[k];
    if (!a || !b) { changed.push({ key: k, before: a || null, after: b || null, delta: Infinity }); continue; }
    let d = 0;
    for (let i = 0; i < 6; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
    if (d > 0) changed.push({ key: k, before: a, after: b, delta: +d.toFixed(4) });
  }
  changed.sort((x, y) => y.delta - x.delta);
  return { changedCount: changed.length, changed };
}

// ---------------------------------------------------------------------------
// §36 PART TWO — pose-INDEPENDENT overlap against the swept registry.
//
// The existing battery samples poses, so it can pass a wheel spoke between two
// samples (TODO 7). This asks the question of the HULLS instead, so there is
// no sampling to under-do: if a fixed part lies inside the volume a mover can
// reach, they meet, and no pose schedule can hide it.
//
// THE SOUNDNESS LINE, which decides what this check may claim:
//
//   · STATIC vs REVOLVE is sound. The fixed part is always there and the mover
//     reaches every point of its hull, so an overlap IS a collision at some
//     reachable pose. This is exactly the §35 class — a rod standing in the
//     annulus a wheel turns through — and it is reported as a violation.
//
//   · REVOLVE vs REVOLVE is NOT sound as a claim, and saying so is the point.
//     Two hulls overlapping means a collision only if both parts can
//     INDEPENDENTLY reach the offending phases. In a going train they cannot:
//     phases are locked by the teeth, and every meshing pair's hulls overlap
//     BY CONSTRUCTION — that is what meshing is. Reporting those as violations
//     would bury the real ones under the movement's entire gear train. They
//     are counted separately as phase-dependent, for a human to read.
//
//   · Anything involving an `approx` volume is not claimed at all. Those are
//     per-pose bounding boxes, not hulls (part one's assert says so: all 55 of
//     its containment escapes are theirs), and a check built on them would be
//     asserting something the registry explicitly does not know.
//
// Declared contacts opt out via the same EXPECTED_PAIRS / IGNORED_PAIRS the
// pose battery uses, so this shares one vocabulary with it rather than
// inventing a second.
//
//   start(clock, 'sweptOverlap');
//
// §40 — STOCK CENSUS. The thinnest dimension carried by every part, in mm.
//
// THIS REPORTS. It does not gate. No minimum is declared, nothing fails, no
// part is called illegal — deliberately, for two reasons the entry gives: a
// hard thickness gate on a movement this developed would be switched off (§36
// part two arrived with 17 artifact violations), and a floor would take a side
// in the live argument about thinning parts to buy z that §2 is still having.
// A report hands the numbers to whoever is making that call.
//
// THE MEASURE is min(axial extent, radial extent) — the thinnest way through
// the part. That is kind-agnostic by construction, and it is the whole trick:
// a rod has a small radial extent and a long axial one, a wheel the reverse,
// so the minimum picks the right dimension for each WITHOUT anyone declaring
// which is which. No `kind` field to be confidently wrong about a thin arbor.
//
// SOURCED FROM §36's REGISTRY, not a second scan, so the census and the
// overlap check cannot disagree about the same part. What each hull kind can
// honestly answer differs, and the output says which was used:
//
//   revolve — FAITHFUL. rBand and zBand are real vertex extents measured
//             across poses, so radial width and axial height are the part's
//             own stock. True even when the hull is a full revolve: the
//             angular span is conservative, the r and z bands are not.
//   static  — measured from the mesh's OWN bounding box instead. A static
//             hull records only a zBand, and a part that never moves has an
//             exact bbox, so this is the more faithful ruler, not a fallback.
//   approx  — NOT MEASURED, and listed as such. That box spans every pose, so
//             its extents are inflated by motion; reporting it as stock is
//             exactly the "swept wedge in the list as though it were stock"
//             the entry forbids.
//
// PIVOTS: the census is per MESH, so a stepped arbor is covered per section
// only if its pivots are modelled as separate meshes. Where they are not, this
// measures BODIES ONLY and the header says so — a list that silently omits the
// thinnest feature on a part is the confident-but-incomplete artifact this
// project keeps closing.
export async function stockCensus(clock, opts = {}) {
  const reg = await buildSweptRegistry(clock, opts);
  const rows = [], unmeasured = [];
  const box = new THREE.Box3();
  // DEDUPE BY MESH, keeping the most specific unit. Units nest — 'Alarm disc'
  // is a labelled child inside the 'Dial' subtree, so collectUnits hands the
  // same mesh to both and the registry carries a volume for each. Left alone,
  // the census listed physical parts twice (the attribution overlap TODO 10
  // records for the minute star), corrupting every count and any ranking read
  // per part. The most specific unit is the one whose labelled object is the
  // NEAREST ANCESTOR of the mesh — walked, not assumed from list order.
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
  const hops = (mesh, name) => {
    const target = unitObj.get(name);
    let n = 0;
    for (let o = mesh; o; o = o.parent, n++) if (o === target) return n;
    return Infinity;
  };
  const byMesh = new Map();
  for (const v of reg._volumes) {
    const prev = byMesh.get(v.mesh);
    if (!prev || hops(v.mesh, v.unit) < hops(v.mesh, prev.unit)) byMesh.set(v.mesh, v);
  }
  for (const v of byMesh.values()) {
    const name = v.mesh.name || '(unnamed)';
    if (v.kind === 'approx') {
      unmeasured.push({ part: v.unit, mesh: name,
        why: 'approx hull — box spans every pose, so its extents are motion, not stock' });
      continue;
    }
    let axial = null, radial = null, source, via, thin, extents = null;
    if (v.kind === 'revolve') {
      axial = v.zBand[1] - v.zBand[0];
      radial = v.rBand[1] - v.rBand[0];
      source = 'registry-revolve';
      via = axial <= radial ? 'axial' : 'radial';
      thin = Math.min(axial, radial);
    } else {
      // §36's follow-up: static AND path parts measure in the mesh's OWN
      // frame, not the world's. A world AABB mixes axes under rotation — a
      // rod posed at 45° reports both x and y extents at ~(L+d)/√2, neither
      // of which is a dimension the part HAS — and for a path (compound
      // mover) the mix additionally changed with the reset pose. The
      // geometry-local box is pose-independent by construction: a cylinder
      // is (2r, h, 2r) wherever the pose loop left it. World scale is
      // applied per axis; builders here rarely scale, but a ruler should not
      // assume that. Remaining shared limit, stated: geometry with rotation
      // BAKED INTO ITS VERTICES (dial markers at azimuth, the monogram's
      // stroked quads) still mixes axes in its local box, so its row
      // UNDER-reports thinness rather than over-reporting it.
      v.mesh.geometry.computeBoundingBox();
      const lb = v.mesh.geometry.boundingBox;
      const ws = v.mesh.getWorldScale(new THREE.Vector3());
      extents = [
        (lb.max.x - lb.min.x) * Math.abs(ws.x),
        (lb.max.y - lb.min.y) * Math.abs(ws.y),
        (lb.max.z - lb.min.z) * Math.abs(ws.z),
      ].map((e) => +e.toFixed(4));
      thin = Math.min(...extents);
      via = 'local-' + ['x', 'y', 'z'][extents.indexOf(thin)];
      source = v.kind === 'path' ? 'geometry-local (path mover)' : 'geometry-local (static)';
    }
    // A zero (or effectively zero) extent is not thin stock — it is an OPEN
    // SURFACE in the mesh: a cylinder wall has every vertex at one radius, so
    // its r-band width is 0, and a flat ring has zero axial height. Real stock
    // cannot be zero thick; a mesh's can, and ranking it first as "0.0000 mm"
    // presents a modelling artefact as the thinnest part in the movement.
    // Listed as not-measured with the reason, per the entry's rule that the
    // report says so wherever its ruler is wrong.
    if (!(thin > 1e-3) || !isFinite(thin)) {
      unmeasured.push({ part: v.unit, mesh: name,
        why: `zero-thickness ${via} extent — open surface in the mesh, not stock` });
      continue;
    }
    rows.push({ part: v.unit, mesh: name, via, source,
      thinnestUnits: +thin.toFixed(4), thinnestMM: +(thin * UNIT_MM).toFixed(4),
      ...(axial !== null ? { axialUnits: +axial.toFixed(4), radialUnits: +radial.toFixed(4) } : { extentsUnits: extents }) });
  }
  // Thinnest first. Ties broken by name so the ORDER is reproducible too, not
  // just the values — the entry asks for a reproducible report, and a stable
  // sort over equal keys is part of that.
  rows.sort((a, b) => a.thinnestUnits - b.thinnestUnits ||
    a.part.localeCompare(b.part) || a.mesh.localeCompare(b.mesh));
  unmeasured.sort((a, b) => a.part.localeCompare(b.part) || a.mesh.localeCompare(b.mesh));
  // One row per PART, thinnest section standing for it, alongside the full list.
  const byPart = new Map();
  for (const r of rows) if (!byPart.has(r.part)) byPart.set(r.part, r);
  return {
    header: {
      unitMM: UNIT_MM,
      measure: 'min(axial extent, radial extent) — the thinnest way through the part',
      source: "§36 registry (revolve r/z bands); static and path parts from their GEOMETRY-LOCAL box, world scale applied — pose-independent, so a rotated pose cannot mix a part's axes",
      pivots: 'BODIES ONLY unless a pivot is modelled as its own mesh — the census is per mesh and does not subdivide an arbor',
      gates: 'none — this report cannot fail the battery',
      counted: rows.length, notMeasured: unmeasured.length,
      dedupe: 'one row per MESH, attributed to its most specific (nearest-ancestor) unit — nested units otherwise list the same part twice',
      naming: 'every PART (unit) is named; individual meshes are named only where the model names them — an (unnamed) row is identified by its unit and dimensions',
    },
    thinnestFirst: rows,
    perPart: [...byPart.values()],
    notMeasured: unmeasured,
  };
}

export async function checkSweptOverlap(clock, opts = {}) {
  // includeDeclared: run WITHOUT the EXPECTED/IGNORED opt-outs. Only for
  // validating the check itself — on a clean movement a violation count of
  // zero proves nothing, so the positive control is to drop the exclusions
  // and confirm the geometry test fires on pairs that are known to touch.
  const { includeDeclared = false, confirm = !includeDeclared, yieldEvery = 16 } = opts;
  const declared = (a, b) => !includeDeclared && (inList(EXPECTED_PAIRS, a, b) || inList(IGNORED_PAIRS, a, b));
  const reg = await buildSweptRegistry(clock, opts);
  const vols = reg._volumes;

  // 2D distance from a point to a triangle: 0 inside, else the nearest edge.
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    const t = L < 1e-16 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const inTri2 = (px, py, ax, ay, bx, by, cx2, cy2) => {
    const d = (by - cy2) * (ax - cx2) + (cx2 - bx) * (ay - cy2);
    if (Math.abs(d) < 1e-12) return false;
    const u = ((by - cy2) * (px - cx2) + (cx2 - bx) * (py - cy2)) / d;
    const v = ((cy2 - ay) * (px - cx2) + (ax - cx2) * (py - cy2)) / d;
    return u >= 0 && v >= 0 && u + v <= 1;
  };

  // Does any triangle of a static mesh lie inside a revolve's hull?
  const staticHitsRevolve = (stat, vol) => {
    const zLo = Math.max(stat.zBand[0], vol.zBand[0]), zHi = Math.min(stat.zBand[1], vol.zBand[1]);
    if (zLo > zHi) return null;                       // no shared height at all
    const [cx, cy] = vol.axis;
    const pos = stat.mesh.geometry.getAttribute('position');
    const index = stat.mesh.geometry.getIndex();
    const n = index ? index.count : pos.count;
    const V = new THREE.Vector3();
    const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    let worst = null;
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) {
        const idx = index ? index.getX(t + k) : t + k;
        P[k].fromBufferAttribute(pos, idx).applyMatrix4(stat.mesh.matrixWorld);
      }
      if (Math.min(P[0].z, P[1].z, P[2].z) > vol.zBand[1] || Math.max(P[0].z, P[1].z, P[2].z) < vol.zBand[0]) continue;
      const rs = P.map((p) => Math.hypot(p.x - cx, p.y - cy));
      const rMax = Math.max(...rs);
      const rMin = inTri2(cx, cy, P[0].x, P[0].y, P[1].x, P[1].y, P[2].x, P[2].y) ? 0
        : Math.min(segDist(cx, cy, P[0].x, P[0].y, P[1].x, P[1].y),
                   segDist(cx, cy, P[1].x, P[1].y, P[2].x, P[2].y),
                   segDist(cx, cy, P[2].x, P[2].y, P[0].x, P[0].y));
      if (rMax < vol.rBand[0] || rMin > vol.rBand[1]) continue;   // outside the annulus band
      if (!vol.full) {
        // Partial arc: the triangle must also fall inside the covered angles.
        let hit = false;
        for (let k = 0; k < 3 && !hit; k++) {
          const b = thetaBin(Math.atan2(P[k].y - cy, P[k].x - cx));
          if (vol.bins[b]) hit = true;
        }
        if (!hit) continue;
      }
      const depth = Math.min(rMax, vol.rBand[1]) - Math.max(rMin, vol.rBand[0]);
      if (!worst || depth > worst.depth) worst = { depth, rMin: +rMin.toFixed(3), rMax: +rMax.toFixed(3) };
    }
    return worst;
  };

  // §36B: does any triangle of a static mesh fall inside a path hull's sleeve?
  // Triangle AABB against each box: a superset test, so it can over-report but
  // never miss — the same direction of error the rest of this check accepts.
  // Triangle AABBs of a static mesh, in world space, computed ONCE. The first
  // version re-transformed every triangle for every (static, path) pair, which
  // is the same matrix multiply repeated a hundred-odd times per mesh.
  const triCache = new Map();
  const staticTris = (stat) => {
    let t = triCache.get(stat);
    if (t) return t;
    const pos = stat.mesh.geometry.getAttribute('position');
    const index = stat.mesh.geometry.getIndex();
    const n = index ? index.count : pos.count;
    const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const out = new Float64Array((n / 3) * 6);
    const all = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let w = 0;
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) {
        const idx = index ? index.getX(i + k) : i + k;
        P[k].fromBufferAttribute(pos, idx).applyMatrix4(stat.mesh.matrixWorld);
      }
      out[w] = Math.min(P[0].x, P[1].x, P[2].x); out[w + 3] = Math.max(P[0].x, P[1].x, P[2].x);
      out[w + 1] = Math.min(P[0].y, P[1].y, P[2].y); out[w + 4] = Math.max(P[0].y, P[1].y, P[2].y);
      out[w + 2] = Math.min(P[0].z, P[1].z, P[2].z); out[w + 5] = Math.max(P[0].z, P[1].z, P[2].z);
      for (let k = 0; k < 3; k++) { if (out[w + k] < all[k]) all[k] = out[w + k]; if (out[w + 3 + k] > all[3 + k]) all[3 + k] = out[w + 3 + k]; }
      w += 6;
    }
    t = { tris: out, count: w / 6, all };
    triCache.set(stat, t);
    return t;
  };
  // Each path hull's overall bounds, for the broad phase.
  for (const v of vols) {
    if (v.kind !== 'path' || !v.boxes || !v.boxes.length) continue;
    const a = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const b of v.boxes) for (let k = 0; k < 3; k++) { if (b[k] < a[k]) a[k] = b[k]; if (b[3 + k] > a[3 + k]) a[3 + k] = b[3 + k]; }
    v.hullBox = a;
  }
  const boxHit = (p, q) => !(p[3] < q[0] || p[0] > q[3] || p[4] < q[1] || p[1] > q[4] || p[5] < q[2] || p[2] > q[5]);

  const staticHitsPath = (stat, vol) => {
    if (!vol.boxes || !vol.boxes.length) return null;
    const S = staticTris(stat);
    // BROAD PHASE. Without it this test was O(statics x tris x boxes) with no
    // way out early, and the run went from ~3 min to over 15. Two gates: the
    // whole static against the whole sleeve, then each triangle against the
    // sleeve before it looks at any individual box.
    if (!boxHit(S.all, vol.hullBox)) return null;
    const tris = S.tris;
    let worst = null;
    for (let i = 0, w = 0; i < S.count; i++, w += 6) {
      if (tris[w + 3] < vol.hullBox[0] || tris[w] > vol.hullBox[3] ||
          tris[w + 4] < vol.hullBox[1] || tris[w + 1] > vol.hullBox[4] ||
          tris[w + 5] < vol.hullBox[2] || tris[w + 2] > vol.hullBox[5]) continue;
      for (const b of vol.boxes) {
        if (tris[w + 3] < b[0] || tris[w] > b[3] || tris[w + 4] < b[1] || tris[w + 1] > b[4] || tris[w + 5] < b[2] || tris[w + 2] > b[5]) continue;
        const depth = Math.min(
          Math.min(tris[w + 3], b[3]) - Math.max(tris[w], b[0]),
          Math.min(tris[w + 4], b[4]) - Math.max(tris[w + 1], b[1]),
          Math.min(tris[w + 5], b[5]) - Math.max(tris[w + 2], b[2]));
        if (!worst || depth > worst.depth) worst = { depth };
      }
    }
    return worst;
  };

  const statics = vols.filter((v) => v.kind === 'static');
  const revolves = vols.filter((v) => v.kind === 'revolve');
  const paths = vols.filter((v) => v.kind === 'path');
  const violations = [], phaseDependent = new Set(), unverified = new Set();
  const seen = new Set();
  let tested = 0;

  for (const vol of revolves) {
    for (const stat of statics) {
      if (stat.unit === vol.unit) continue;                       // same unit: TODO 5's blind spot, not this check's
      if (declared(stat.unit, vol.unit)) continue;
      const key = pairKey(stat.unit, vol.unit);
      if (seen.has(key)) continue;
      tested++;
      const hit = staticHitsRevolve(stat, vol);
      if (hit) { seen.add(key); violations.push({ pair: key, fixed: stat.unit, mover: vol.unit, overlap: +hit.depth.toFixed(3) }); }
    }
  }
  for (const vol of paths) {
    for (const stat of statics) {
      if (stat.unit === vol.unit) continue;
      if (declared(stat.unit, vol.unit)) continue;
      const key = pairKey(stat.unit, vol.unit);
      if (seen.has(key)) continue;
      tested++;
      const hit = staticHitsPath(stat, vol);
      if (hit) { seen.add(key); violations.push({ pair: key, fixed: stat.unit, mover: vol.unit, overlap: +hit.depth.toFixed(3), via: 'path' }); }
    }
  }
  for (const a of revolves) for (const b of revolves) {
    if (a.unit >= b.unit) continue;
    if (declared(a.unit, b.unit)) continue;
    const zOverlap = Math.min(a.zBand[1], b.zBand[1]) - Math.max(a.zBand[0], b.zBand[0]);
    if (zOverlap <= 0) continue;
    const d = Math.hypot(a.axis[0] - b.axis[0], a.axis[1] - b.axis[1]);
    if (d > a.rBand[1] + b.rBand[1] || d + Math.min(a.rBand[1], b.rBand[1]) < Math.max(a.rBand[0], b.rBand[0])) continue;
    phaseDependent.add(pairKey(a.unit, b.unit));
  }
  for (const v of vols) if (v.kind === 'approx') unverified.add(v.unit);

  // §36 JOB B — THE CONFIRMATION TIER. A hull overlap is a POSSIBLE collision,
  // not a collision: both hull shapes are supersets by design (a full revolve
  // for an undeclared spoke mover sweeps a disc the part never fills; a box
  // sleeve squares off a round rod, gaining (√2−1)·r at the corners). Measured
  // on the first complete run, that conservatism was the ENTIRE result — all
  // 11 hull violations refuted by pose-refined clearance, the Reset rod rows
  // clearing by 0.9–15.6 units.
  //
  // So every hull violation is re-measured with measureClearance (BVH, coarse
  // sweep + refinement near minima) and tiered:
  //   confirmed — refined gap ≤ 0: real contact. THE gate number.
  //   tight     — 0 < gap < CLEAR_MARGIN: no contact, but inside the one
  //               margin. The rod-in-bore case lands here (designed at
  //               exactly the margin, measures a tessellation hair under).
  //   refuted   — gap ≥ CLEAR_MARGIN: the hull over-claims; the refined gap
  //               and its pose are recorded so the claim is checkable.
  //
  // Pose refinement is still sampling (TODO 7): it cannot BOUND the motion,
  // so refuted keeps the hull's side of the story in the output rather than
  // deleting the row — the hull says "possible", the refinement says "not at
  // any refined pose", and both statements stand.
  let confirmed = violations, tightRows = [], refuted = [];
  if (confirm && violations.length) {
    confirmed = []; 
    for (const v of violations) {
      const m = await measureClearance(clock, v.fixed, v.mover, { yieldEvery });
      const row = { ...v, refinedMinGap: m.min, refinedAt: m.at };
      if (m.min <= 0) confirmed.push(row);
      else if (m.min < CLEAR_MARGIN) tightRows.push(row);
      else refuted.push(row);
    }
  }

  clock.resetInputs();
  return {
    sound: { staticVsSwept: {
      pairsTested: tested,
      violations: confirmed,
      tight: tightRows,
      refutedByRefinement: refuted,
      confirmTier: confirm ? 'on — violations are pose-confirmed contacts; tight/refuted carry the refined gap' : 'off — raw hull overlaps',
    } },
    notClaimed: {
      swept_vs_swept_phaseDependent: [...phaseDependent].sort(),
      approxUnitsExcluded: [...unverified].sort(),
    },
    registrySummary: reg.byKind,
  };
}
