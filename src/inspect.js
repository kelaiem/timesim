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
//    fork ⇄ Balance); chain-on-cone and chain-on-drum landed with §61;
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
import { CLEAR_MARGIN, UNIT_MM, Z_DIAL, SLENDER_MAX as SLENDER_MAX_U, CHAIN_PITCH } from './layout.js';

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
// Exported for §58's tethers: explore mode draws a link between a displaced
// unit and each drive partner it has been separated from, and the drive list
// IS that data — main.js dynamic-imports this module when explore mode first
// turns on (never at boot, so the boot bundle and its silence are untouched).
export const MECH_GRAPH = {
  // node 'plate' is the ground; 'mainspring' and 'crown' are force sources.
  support: [
    // §100 (TODO 39): the drum is supported BY ITS ARBOR — the body's bored
    // floor and lid run on the set-up work's static arbor, so the support
    // path is drum → set-up work → plates. The old rows grounded the drum
    // on both plates through pivot furniture that was parented to the
    // ROTATING group — shafts that were not pivots but the arbor's own
    // ends, drawn on the wrong member.
    ['Mainspring drum', 'Set-up work'],      // body runs on the static arbor (floor + lid bores)
    ['Set-up work', 'Three-quarter plate'],  // the arbor's top stands in the plate's plain bushing
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
                                             // beside the motion works (minute quick-set)
    ['Yoke', 'plate'],                       // same dial-side stud mounting
    ['Winding clutch', 'Keyless works'],     // TODO 50: rides the stem's square (the keyed
                                             // joint) and the yoke's fork — the clutch has no
                                             // bearing of its own, which is the real part's truth
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
    // §87: the hack rod no longer shares the reset rod's tail post at every
    // spec. It is pinned to the setting lever's own HACK-ROD PIN — the same
    // stud, the same stock, seated in the same lever body at HACK_PIN_K of
    // the tail arm, where HACK_PIN_K is derived from the coupling this
    // movement's station achieves (main.js, onHackPin). Where the coupling
    // affords the full stroke that fraction is 1 and the pin IS the tail
    // post, which is what the shipped movement builds. The pin is a stud of
    // the LEVER, not a unit: it has no motion of its own to detect and no
    // fixture of its own to reach, exactly like the beak pin and the post
    // beside it, so its support and its drive are declared on these two rows.
    ['Hack rod', 'Setting lever'],           // pinned at the lever's hack-rod pin, inboard of the reset rod's
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
    ['Alarm release sleeve', 'Dial'],        // §45: the sleeve's three guide posts hang from the sheet (az 105/250/345, the selector's pattern one band deeper)
    ['Alarm release lifter', 'plate'],       // §45: bracket post + mid-guide post stand on the base plate's dial-side face (the alarm arbor's cock pattern)
    ['Alarm silence rocker', 'Dial'],        // §45 stage 2: the pivot bracket's lugs hang from the sheet's back face (the feeler bracket's pattern)
    ['Alarm link', 'Three-quarter plate'],   // §35: the link beak's post on the plate top
    ['Alarm link', 'plate'],                 // §35: the rod's bores (both plates) + the lay shaft's two hanger bushes

    ['Alarm winding train', 'plate'],        // §25 C winding: the climb arbor runs in the base plate's bore; §112 — the idler studs plant beside it now, and the jeweled upper pivot RETIRED (the climb never reaches the plate)
    ['Alarm click', 'plate'],  // §99/§112: the click's shoulder screw and the spring's post stand on the BASE plate (the idler-stud convention, one plate down)
    ['Alarm winding arrest', 'plate'],  // §106/§129: FOUR plate-top columns now — the subtractor's arbor, the compound idler's, the Geneva's own arbor and the cross's stud, all the idler-stud convention
    ['Winding arrest', 'Three-quarter plate'], // §47: the bracket hangs the whole group from the plate's UNDERSIDE, top face flush (§29's lug idiom inverted)
    ['Alarm lock', 'Three-quarter plate'],   // §25 B: brake-lever pivot post on the plate top
    ['Alarm switch', 'Three-quarter plate'], // §25 D: the column wheel's stud on the plate top
    // Alarm striker (§24): a gong fixed to the back plate by one foot (its far
    // end rings free) and a hammer pivoted beside it. The hammer IS driven now
    // — §25 built the striking works below and moved its pose into tick(), so
    // the 'alarmStrike' axis sweeps it like any other train.
    ['Alarm gong', 'Three-quarter plate'],   // the gong's single foot stands on the back plate
    ['Alarm hammer', 'Three-quarter plate'], // the hammer's pivot post stands on the back plate
    // Alarm striking works (§25 A, re-grounded by §112's tier-split): the
    // power tiers live UNDER the three-quarter plate now, their studs and
    // bosses planted in the BASE plate; the strike arbor alone reaches the
    // top face, through the plate's bore — which is a bearing, so the
    // striking wheel is carried by BOTH plates.
    ['Alarm barrel', 'plate'],        // §112: barrel arbor's floor boss stands in the base plate
    ['Alarm striking wheel', 'plate'], // §112: the stud plants in the base plate...
    ['Alarm striking wheel', 'Three-quarter plate'], // ...and the rotor's sleeve runs in the plate's bore (§112 — the tier-split's cut)
    ['Alarm governor', 'plate'],       // §112: stud in the base plate
  ['Alarm governor anchor', 'plate'],   // §107's own stud, §112's face — planted beside the governor's
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
    ['crown', 'Winding clutch'],               // TODO 50: the stem square keys the clutch — the
                                               // hand's input enters the movement HERE
    ['Winding clutch', 'Keyless works'],       // …and the saw coupling hands it to the fixed
                                               // winding pinion (one-way: faces drive, ramps cam;
                                               // the run-down back-drive closes the same faces
                                               // from the pinion's side, so the edge is two-way
                                               // in §126's sense while the RATCHET sense is real)
    ['Keyless works', 'Fusee & great wheel'],  // winding: crown wheel → transfer arbor through the
                                               // plate bore → transfer wheel → winding SPUR at the
                                               // arbor's plate end, under the great wheel
    ['Fusee & great wheel', 'Maintaining detent'], // the maintaining ring's teeth tick past the
                                               // detent's beak as the train runs (never in reverse
                                               // — that is the whole point of the sandwich)
    ['crown', 'Setting lever'],                // the PULL, via the stem groove
    ['Setting lever', 'Yoke'],                 // ganged clutch shift (the yoke tracks the clutch)
    ['Yoke', 'Winding clutch'],                // TODO 50: the fork slides the clutch — pull out to
                                               // the setting mesh, and the spring re-seats through
                                               // the same prongs after a cam-over
    ['Setting lever', 'Hack rod'],             // §87: the rod rides the lever's own pin — the tail arm at
                                               // HACK_PIN_K, so the stroke it takes is r/SL_TAIL of the post's
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
    ['Alarm winding train', 'Alarm barrel'], // §99: climb pinion → idlers → the ARBOR's winding wheel (12/44 — W takes the rim's count, so the ratio survived the re-route)
    ['Alarm barrel', 'Alarm click'],         // §99: the arbor ratchet's saw drives the click's rock (winding cams it out; the face holds the return — the maintaining detent's row, alarm-side)
    // §129 — TWO drive edges from one unit, which is the point of the whole
    // re-gearing. The arbor's 44 t wind wheel drives leg A direct; the BODY's
    // 44 t rim drives leg B through a compound idler, arriving reversed. The
    // spider subtracts them, so what leaves the differential is the WIND and
    // not either member — §106 read the arbor alone and the cross never reset
    // (TODO 55). The cage's 16 t wheel then drives the Geneva's 8 t pinion, and
    // the cross is turned by the finger's pin and nothing else.
    ['Alarm barrel', 'Alarm winding arrest'],
    ['Chain', 'Winding arrest'],             // §47: the arriving coil cams the finger's pad — a LEAF of the drive graph on purpose, the §104 precedent: an arrest consumes, it drives nothing downstream
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
    ['Alarm crown', 'Alarm release lifter'], // §45: the stem's bevel collar cams the lifter's head down on the pull
                                             // (the keyless sliding-pinion idiom — the ratio is the machined taper)
    ['Alarm release lifter', 'Alarm release sleeve'], // §45: the fork's plates on the sleeve's tab — positive both ways
    ['Alarm release sleeve', 'Alarm disc'],  // §45: the 45° cone on the follower's tail pin, at ANY tube azimuth —
                                             // lifting follower A releases the tube to the §25 C friction coupling:
                                             // the hider's second input, and the hand SWEEPS while being set
    ['Alarm release lifter', 'Alarm silence rocker'], // §45 stage 2: the run's underside presses the rocker's paddle
    ['Alarm silence rocker', 'Alarm release feeler'], // §45 stage 2: the finger captures the tail — no rise, no drop, no ring
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
    ['Alarm striking wheel', 'Alarm governor'],
  ['Alarm governor', 'Alarm governor anchor'], // §107: the saw drives the anchor, tooth face on pallet face — the escapement's own edge, one level down // §104: the strike arbor's 64T wheel → the governor pinion.
                                              // A LEAF of the drive graph on purpose — a brake consumes,
                                              // it drives nothing downstream.
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
      // §45: the tol RIDES Z_DIAL — the anchor's nearest 'Dial' mesh is the
      // sheet, which moves with every dial-band strata spend, while the cap
      // itself still lands flush beside the cannon's plate-side end (world-
      // fixed: the chain grows exactly what Z_DIAL deepens). 3.5 was the
      // frozen −7.5-era figure — the same stale-absolute class §51 enumerated.
      tol: 3.5 + (-7.5 - Z_DIAL),
      point: nearestMeshCenter,
    },
    {
      name: "yoke's prongs reach the sliding clutch's hub collars",
      unit: 'Yoke',
      target: 'Winding clutch',   // TODO 50: the collars moved to the clutch with the split
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
  ['Set-up work', 'Mainspring drum'],        // §100: the static arbor and everything on it (square,
                                             // collar, hook pin) thread the rotating body — the
                                             // body's bored floor and lid RUN on the arbor now
  ['Keyless works', 'Setting lever'],        // beak pin in the stem groove
  ['Keyless works', 'Yoke'],                 // the fork's body still crosses the stem's band
                                             // (the prong⇄collar ride moved to the clutch pair)
  ['Winding clutch', 'Keyless works'],       // TODO 50: the saw coupling, the stem square in the
                                             // rim's bore, and the pulled setting mesh
  ['Winding clutch', 'Yoke'],                // prongs riding the clutch's hub collars
  ['Chain', 'Fusee & great wheel'],          // chain lies in the cone grooves
  ['Chain', 'Mainspring drum'],              // chain wraps the drum
  ['Power-reserve train', 'Fusee & great wheel'], // p0 slip-coupled on the arbor
  ['Hack rod', 'Setting lever'],             // rod pinned to the lever's hack-rod pin (its support edge)
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
  // §100 (TODO 39): the drum row became a SET-UP WORK row — the member in
  // the plate's bushing is the static arbor now, and the drum itself has
  // nothing that reaches the plate. (An EXPECTED grant on a pair that can
  // no longer touch is a standing excuse; the swap keeps the list true.)
  ['Set-up work', 'Three-quarter plate'],
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
  // The two rods run a 0.22-unit corridor and touch where their routes
  // converge; the angular spread to their destinations separates them
  // beyond that. At the shipped spec that convergence is the tail post
  // itself — one stud, two eyes, as two levers stacked on one stud are —
  // and where §87 gives the hack rod its OWN pin they no longer share a
  // stud, but they still meet in the corridor (measured 0 at both, over
  // the whole crown stroke). The pair has no EXPECTED_CONTACT_FLOORS row,
  // so it still takes TODO 6's blanket excuse rather than a per-contact
  // floor — this entry's own residue, unchanged by §87.
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
  ['Alarm release sleeve', 'Dial'],         // §45: the same nesting artifact + the sleeve posts' sheet anchors
  ['Alarm release sleeve', 'Alarm disc'],   // §45: the cone ⇄ tail-pin working contact (setting parity)
  ['Alarm release lifter', 'Alarm release sleeve'], // §45: the fork's running fit on the tab
  ['Alarm release lifter', 'Alarm crown'],  // §45: the head riding the stem collar
  ['Alarm release lifter', 'Dial'],         // §45: the fork grips a dialFace descendant — the tab re-attributed
                                            // through nesting (the Alarm link ⇄ Dial precedent)
  ['Alarm release lifter', 'Alarm silence rocker'], // §45 stage 2: the run ⇄ paddle working contact (every parity)
  ['Alarm silence rocker', 'Alarm release feeler'], // §45 stage 2: the finger ⇄ tail working contact (setting parity)
  ['Alarm silence rocker', 'Dial'],         // §45 stage 2: nesting artifact + the lugs' sheet anchors
  ['Alarm winding train', 'Dial'],          // the SAME detent contact re-attributed through nesting: the feeler
                                            // is a dialFace descendant, so the Dial's traverse carries its beak
                                            // (the Dial ⇄ Hour wheel precedent; collectUnits does no exclusion)
  ['Alarm release feeler', 'Dial'],         // the nesting artifact (dialFace descendant), like the disc's row
  ['Alarm winding train', 'Alarm crown'],   // §25 C: pulled-out bevel mesh
  ['Alarm winding train', 'Alarm barrel'],  // §99: idler ⇄ arbor-wheel mesh (was the rim; the floors row below names the contact)
  ['Alarm click', 'Alarm barrel'],          // §99: the click's beak parked on the arbor ratchet's saw — the hold itself
  ['Alarm click', 'plate'],   // §99/§112: the click stud and spring post stand on the base plate
  ['Alarm winding arrest', 'Alarm barrel'],  // §106/§129: leg A in mesh with the arbor's winding wheel, and the compound idler's wheel in mesh with the BODY's rim — two meshes onto one unit, which is how the difference gets read
  ['Alarm winding arrest', 'plate'],         // §106/§129: all four columns stand on the base plate
  ['Winding arrest', 'Three-quarter plate'],  // §47: the bracket's top face flush on the plate's underside — the support joint
  ['Winding arrest', 'Chain'],                // §47: the arriving coil ON the pad near full wind — the throw itself
  ['Winding arrest', 'Fusee & great wheel'],  // §47: beak on stop lug at full wind — the arrest itself
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
  ['Alarm barrel', 'plate'],        // §112: arbor boss planted in the base plate
  ['Alarm striking wheel', 'plate'],// §112: the stud's base, likewise
  ['Alarm striking wheel', 'Three-quarter plate'],// §112: the rotor's sleeve in the plate's bore
  ['Alarm barrel', 'Alarm striking wheel'],       // the gear mesh (barrel wall ⇄ strike pinion)
  ['Alarm striking wheel', 'Alarm hammer'],       // a pin on the hammer's tail — the lift
  ['Alarm governor', 'plate'],      // §104's stud, §112's face (§107 took the anchor's stud into the anchor's own unit)
  ['Alarm governor', 'Alarm striking wheel'],     // §104: the ×8 mesh (64T wheel ⇄ governor pinion)
  ['Alarm governor anchor', 'plate'],// §107's stud, §112's face
  ['Alarm governor', 'Alarm governor anchor'],    // §107: the saw's tooth face on the pallet face — the governing contact itself
];
// Same rigid assembly / coaxial stacks — not meaningful to test.
const IGNORED_PAIRS = [
  ['Balance', 'Hairspring'],
  ['Fusee & great wheel', 'Mainspring drum'], // far apart; the drum body's AABB meets the wheel's during explode only (§100 moved the tall arbor to Set-up work)
];

const pairKey = (a, b) => [a, b].sort().join(' ⇄ ');
const inList = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

function collectUnits(clock, { includeExcluded = false } = {}) {
  const units = [];
  for (const { name, obj } of clock.labelEntries) {
    if (!includeExcluded && EXCLUDED_UNITS.includes(name)) continue;
    const meshes = [];
    // §71: prune the §66 schematic tier wherever it roots — the tier is
    // display, never metal, the same trust the fingerprint already extends
    // (its per-unit boxes skip the flag). This is what lets an occluder
    // MESH live inside a labelled unit (the 3/4 plate's silhouette) without
    // joining the sweeps: "invisible to all instruments" becomes structural
    // in the one collector every unit-based check flows through, instead of
    // resting on where a proxy happens to be parented.
    const walk = (o) => {
      if (o.userData && o.userData.schematic) return;
      if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o);
      for (const c of o.children) walk(c);
    };
    walk(obj);
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
  if (SWEEP_CENSUS.on) {
    const c = SWEEP_CENSUS.c;
    c.exactCalls++;
    const t0 = performance.now();
    const r = _meshesIntersectInner(a, b);
    c.exactMs += performance.now() - t0;
    if (r) c.boolTrue++; else c.boolFalse++;
    return r;
  }
  return _meshesIntersectInner(a, b);
}
function _meshesIntersectInner(a, b) {
  const bvhA = bvhFor(a);
  bvhFor(b); // intersectsGeometry needs the other side indexed; building its tree indexes it
  _mat.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
  if (!bvhA.intersectsGeometry(b.geometry, _mat)) return false;
  // A POSITIVE is never trusted raw. The tree-vs-tree path has a measured
  // false-positive mode at specific relative transforms (2026-07: balance
  // rim ⇄ fork-cock boss, 0.69 apart, one direction lying; 2026-08: alarm
  // hand ⇄ hour tube, 2.32 apart, BOTH directions lying — which retired the
  // both-directions cross-check this function used to run, and with it the
  // closestPointToGeometry arbitration, whose own false-0 mode rubber-
  // stamped the lie). sampledVerdict arbitrates: a contained sample (vertex
  // or edge midpoint, parity raycast) proves the crossing; otherwise the
  // sampled distance decides, and only a genuine running fit reads as
  // contact.
  const v = sampledVerdict(a, b, 1e-3);
  return v.inside || v.d < 1e-4;
}

function unitsIntersect(A, B) {
  const cen = SWEEP_CENSUS.on ? SWEEP_CENSUS.c : null;
  for (const a of A.meshes) {
    for (const b of B.meshes) {
      // Cheap per-mesh AABB gate before the triangle test.
      if (cen) cen.aabbTests++;
      if (!new THREE.Box3().setFromObject(a).intersectsBox(new THREE.Box3().setFromObject(b))) continue;
      if (cen) cen.aabbPass++;
      if (meshesIntersect(a, b)) return true;
    }
  }
  return false;
}

// Phase axes. Each pose object feeds __clock.setPose(), which assigns ONLY
// the keys the object NAMES — so a pose is a DELTA from the state the clock
// is already in, never a description of the scene.
//
// TODO 54: that second clause used to read "unspecified state keeps its prior
// value, so every axis pins the others to a fixed default." The first half was
// true and the second was false, which is the worst pairing — a comment that
// names the hazard and then claims it is handled. setPose accepts twelve keys;
// six of the eleven axes below name four of them; and no sweep reset between
// axes (start() resets once per CHECK). So each axis inherited the tail pose of
// the axis DECLARED ABOVE IT: handSet's setPathRot rode into all four alarm
// axes, and alarmToggle — whose whole subject is the parity — swept it with the
// alarm barrel at full wind and a strike phase parked wherever alarmStrike
// stopped. Every sweep's coverage was a function of this array's ORDER.
//
// THE CONTRACT NOW: a pose is a delta, and every sweep ENTERS each axis from
// canonical state (enterAxis, below the array). An axis that wants a state must
// NAME it — which is what turns an inherited accident into a decision, and what
// lets §127 sweep two axes in two browser contexts and merge the results.
export const AXES = [
  {
    name: 'beat',
    n: 96,
    pose: (f) => ({ tau: f * 0.4, crownPullT: 0, leverEngage: 0, tension: 1 }),
  },
  {
    name: 'crown',
    n: 48,
    pose: (f) => ({ tau: 0.05, crownPullT: f, leverEngage: f, tension: 1 }),
  },
  {
    name: 'reserve',
    n: 60,
    pose: (f) => ({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 - f }),
  },
  {
    // TODO 38 W4 — the GOING WIND, closing the item's last tranche: before
    // this axis the winding pose was pinned at full everywhere, so the whole
    // winding chain — crown wheel, ratchet, click, the fusee turning
    // BACKWARD, the chain re-wrapping upward, the maintaining detent riding
    // its saw — was swept in exactly one direction, the one it travels while
    // running down. The pose law is a CYCLE, not a line: a full wind from
    // empty and the run back down (w = 1−|2f−1|), because the registry's
    // reversal test is within-axis by design (an axis boundary is not motion
    // the part made) — a monotone wind axis would cover the states and still
    // leave the fusee's genuine two-way drive unobserved, exactly the
    // §48-population gap whose retired declarations name this axis as their
    // way back in. §47 collapsed the pair this axis used to move by hand
    // (tension + windAccumTurns): the fusee's angle is DERIVED from the bank
    // now, so one knob sweeps the coupled motion by law, the span still
    // reading live off the spec (`fuseeWrapTurns` inside the clock's own
    // pose law) — a `?reserveh=` boot sweeps the wind that spec performs,
    // and no caller can de-couple the pair again.
    // n: the train axis's own standard is 96 samples per fusee revolution
    // (its stated purpose — slow-orbit arbor parts — is exactly this arbor);
    // the pre-§124 3.75 rev each way at that density was 360 + 360 = 720,
    // kept — at 1.75 rev it is denser, never sparser. The finer
    // features on this path (the §99-class ratchet tooth pitch, 24/rev) are
    // budget-tier work with their own nSamples override, not this axis's to
    // carry. The measured cost of this n, and what it did to the guard
    // arithmetic, is quoted in TODO 38's closing record — sized by
    // derivation, priced by measurement, per the item's own rule.
    name: 'wind',
    n: 720,
    pose: (f) => ({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 - Math.abs(2 * f - 1) }),
  },
  {
    // TODO 71 — the ARREST'S OWN reversal: the arming band, cycled. The wind
    // axis is already a tension cycle, but the registry samples every axis on
    // its own inclusive 12-pose grid, and 1 − |2·(k/11) − 1| tops out at
    // tension 0.909 — below the pad's touch (solved at boot; ≈ 0.87 at the
    // §151 fold, and the fallback errs high on purpose: too high only
    // narrows the cycle toward full wind, never past it), so the
    // arm never MOVED in any registry sample and §48's stale rule flagged a
    // declaration its population could not see (the TODO 56 lesson: ship the
    // mechanism's own axis or its audit passes in silence). The band starts
    // the lift-shape assert's own seated margin (0.03) below the solved
    // touch, read live off the clock like stemSlip's pitch, so the axis
    // tracks the solve instead of a stale copy of it. n: a leg spans
    // 1 − (touch − 0.03) of tension (≈ 0.16 at the §151 fold) and the lift
    // law's finest feature is its fine-grid staircase step,
    // (1 − LAW_T0)/480 ≈ 0.0012 — 96 samples over the cycle lands within a
    // few steps per sample, denser through the band than the wind axis's
    // own 0.0028, and the features this axis exists for (the arm's
    // reversal, its travel arc) are far coarser than either.
    name: 'arrest',
    n: 96,
    pose: (f, clock) => {
      const t0 = Math.max((clock?.windArrest?.tTouch ?? 0.97) - 0.03, 0);
      return { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: t0 + (1 - t0) * (1 - Math.abs(2 * f - 1)) };
    },
  },
  {
    // TODO 50 — the STEM'S OWN reversal: the saw coupling's relative angle
    // (windStemSlip), which no other axis can move — `tension` sweeps the
    // bank and the slip rides ALONG with it by definition (the clutch and
    // the pinion turn together while the faces bear). The pose law is a
    // CYCLE over exactly ONE COUPLING PITCH of backward slip and back —
    // the wind axis's within-axis-reversal rule, applied to the clutch: a
    // monotone ramp would sweep the lift's poses and still leave the
    // camming's genuine reversal unobserved, the §48-population gap TODO 56
    // documents on the alarm side. One pitch is the mechanism's whole
    // period (the lift law is periodic by construction), so more buys
    // nothing. n: the ride's finest feature is the backlash flat, 0.15 of
    // a pitch; 96 samples puts ~14 of them inside it and ~53 on the ramp —
    // the wind axis's own per-feature density, at this axis's scale. The
    // slip enters through setPose's `windStemSlip` key (canonical entry
    // zeroes it, so every other axis still sweeps the seated coupling).
    name: 'stemSlip',
    n: 96,
    pose: (f, clock) => ({
      tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
      windStemSlip: -(clock?.stemSawPitch ?? Math.PI / 4) * (1 - Math.abs(2 * f - 1)),
    }),
  },
  {
    // One full revolution of the FUSEE arbor — catches slow-orbit collisions
    // (e.g. arbor-mounted parts sweeping past static keyless parts) that the
    // short beat axis never rotates far enough to reach. Fast wheels are
    // effectively phase-randomised across samples, which is fine: any
    // sampled pose is a reachable pose. §124: the revolution's LENGTH is the
    // first mesh's ratio, read live off the clock (120/7 h at the default
    // spec) — the old literal 8 h was that ratio hard-coded, and when §124
    // re-geared the mesh this axis silently shrank to 0.47 of an orbit: the
    // maintaining detent's beak (which ticks over the ring once per tooth of
    // ABSOLUTE arbor rotation) fell out of the reversal population, and the
    // §48 restoring audit's stale rule caught the declaration it orphaned.
    name: 'train',
    n: 96,
    pose: (f, clock) => ({ tau: f * (clock?.hoursPerFuseeTurn ?? 120 / 7) * 3600, crownPullT: 0, leverEngage: 0, tension: 1 }),
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
    pose: (f) => ({ tau: f * 60, crownPullT: 1, leverEngage: 0, tension: 1 }),
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
      tau: 0.05, crownPullT: 1, leverEngage: 0, tension: 1,
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
    pose: (f) => ({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: f * 2 * Math.PI, alarmOn: 1, alarmCrownPullT: 1 }),
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
      tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
      alarmStrikePhase: f * (clock ? clock.alarmStrikesPerWind : 28),
      alarmOn: 1, alarmReleased: 1,
    }),
  },
  {
    // TODO 38 — THE WIND ITSELF, SWEPT. alarmStrike above is the only other
    // axis that turns this barrel's members, and it runs RELEASED and
    // ringing (alarmReleased: 1, §25 B); a hand winds in the OTHER state —
    // striker parked, §29 lock engaged (alarmOn: 0, alarmReleased: 0).
    // §99 changed WHAT MOVES under this axis, and the coverage claim moved
    // with it: winding turns the ARBOR (wheel, ratchet, hook, winding
    // train, crown) while the body and the whole strike side stand parked
    // — the §25 C era's phase back-out (strike pins riding backward) was
    // the rim-wound barrel's story and retired with it. What this axis
    // uniquely sweeps now is the WIND side in its honest state: the arbor's
    // full 1.75-turn travel under the parked companion state, and the
    // CLICK riding the ratchet's 1.75 × 32 = 56 saw cam-outs — the working
    // direction TODO 38 built this axis to police before the click existed.
    //
    // The axis poses the winding INPUT, not the output (TODO 20's law): the
    // crown's pushed-in rotation over one full wind from empty. setPose
    // derives alarmBarrelWind from it through ALARM_WIND_RATIO — the same
    // derived constant tick()'s interactive wind path integrates — so the
    // axis and a user's hand share one ratio chain (rule 2: angles travel
    // the gears). The span is ALARM_BARREL_TURNS / ALARM_WIND_RATIO crown
    // turns = 1.75 / (12 / 44) — §99 re-based the ratio onto the arbor
    // wheel, whose W is the rim's own count, so the value and this fallback
    // survived verbatim; the literal below is that SAME expression, term
    // for term, because the §36 registry walks call pose(f) without a
    // clock and the two paths must land bit-identical poses.
    //
    // n = 109: prime, so coprime to every cycle count this sweep crosses —
    // the §25 C sizing argued it against 28 strike-pin cycles, and §99's
    // ride argues it against the ratchet's 56 (gcd(109, 56) = 1): the
    // cam-out is a fast excursion within each tooth pitch, and an n
    // sharing a factor with the cycle count would resample the same
    // in-pitch phases and step over it. ~5.8° of arbor per step, ~1.9
    // samples per saw pitch at distinct in-pitch phases.
    name: 'alarmWind',
    n: 109,
    pose: (f, clock) => ({
      tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
      alarmWindRotation: f * (clock ? clock.alarmWindCrownTurns : 1.75 / (12 / 44)) * 2 * Math.PI,
      alarmOn: 0, alarmReleased: 0, alarmCrownPullT: 0,
    }),
  },
  {
    // TODO 29 — THE PARITY ITSELF, SWEPT. Every other alarm axis PINS
    // `alarmOn` (the `alarm` axis at 1 for its whole run, `alarmStrike`
    // likewise), so before this one no axis anywhere varied it — and the
    // §48 audit's population comes from the §36 registry's `reversed` flag,
    // which is measured over these axes. A part whose only motion is the
    // toggle therefore never moved during a sweep, never registered as
    // reversing, and was never asked what restores it. The alarm LOCK is
    // exactly that part: its lift tracks `alarmOn`, so across every previous
    // axis it was constant — armed on `alarm`, released everywhere else.
    //
    // RELEASED → ARMED → RELEASED, because one step is not a reversal: the
    // registry calls a volume reversed when successive steps change sign, so
    // a monotonic 0→1 would sweep the same swept volume as a part that only
    // ever moves one way. The wheel is genuinely bistable and both states are
    // reachable by pressing the pusher, so visiting them in that order is a
    // real sequence, not a contrivance.
    //
    // setPose writes the parity, not just the flag: it nudges `alarmColSteps`
    // to the requested parity and re-derives `alarmOn` from it, so this axis
    // turns the COLUMN WHEEL and everything the wheel drives — which is the
    // point. And the tick snaps `alarmLockLiftT` to its target when `rawDt`
    // is 0, so the lock's 0.08 s ease does not silently freeze the lever at
    // its start value under a pose sweep (CLAUDE.md's zero-dt trap, which
    // would otherwise make this axis measure nothing).
    name: 'alarmToggle',
    n: 48,
    pose: (f) => ({
      tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
      alarmOn: f > 0.25 && f < 0.75 ? 1 : 0,
    }),
  },
];

// ---------------------------------------------------------------------------
// CANONICAL AXIS ENTRY (TODO 54). Call this at the top of every axis, before
// the axis's first pose. It is what makes an axis's sweep a function of
// (geometry, axis) instead of a function of AXES' declaration order.
//
// WHY A RESET AND NOT A "TOTAL POSE". TODO 54 prescribed a declared base pose
// merged into each axis's delta, so that every pose object names all twelve
// keys. Reading setPose closely, that fix does not hold, and the reasons are
// in setPose's own comments:
//
//   · The writers OVERLAP. `alarmWindRotation` assigns alarmCrownRotation as
//     well as the barrel wind, and it is applied AFTER `alarmCrownRotation` —
//     so a base naming the latter and an axis naming the former do not merge,
//     they fight, and the base wins. The alarm axis would silently sweep an
//     unturned crown.
//   · A base `alarmBarrelWind` SILENTLY RE-MEANS the strike axis. setPose
//     derives the wind from `alarmStrikePhase` only when the pose does not
//     state it (the honest ring trajectory, §99); a base that states it binds
//     instead, and alarmStrike would ring a barrel pinned at the base value.
//   · And no pose object can reach the accumulator that matters. `alarmOn`
//     NUDGES alarmColSteps one step toward the requested parity (TODO 20 —
//     the wheel is the state), so the column's ANGLE is a function of how many
//     flips came before, not of the parity asked for. Only a reset zeroes it.
//
// resetInputs is the exact statement of "canonical", it is the same one the
// FINGERPRINT already makes before every pose it hashes (fingerprintBoxes:
// "the fingerprint must not depend on session history"), and the sweeps are
// the half of the codebase that never learned it. The residue this leaves is
// WITHIN an axis: alarmToggle's own parity flips still accumulate across its
// samples, so an axis is reproducible from its start but an index range inside
// one is not — which is why §127 slices between axes and not inside them.
//
// checkAxisEntry gates that this guarantee holds over every ordered pair of
// axes, and REPORTS what rides through without it.
// ---------------------------------------------------------------------------
export function enterAxis(clock) { clock.resetInputs(); }

// Axes may be named rather than passed (§127): an axis carries a `pose`
// FUNCTION, which cannot cross page.evaluate, so a harness driving a sliced
// sweep from Node can only send strings. Names are resolved against AXES in
// ITS order, never the caller's, so a slice's rows sort where a whole run's
// would. An unknown name throws rather than silently narrowing the sweep —
// the string-coupling trap this file is already full of, and a mistyped slice
// that quietly swept nothing would report a clean partition of no work.
export function resolveAxes(arg = AXES) {
  const names = arg.map((a) => (typeof a === 'string' ? a : a.name));
  const missing = names.filter((n) => !AXES.some((a) => a.name === n));
  if (missing.length) throw new Error(`unknown axis name(s): ${missing.join(', ')}`);
  return AXES.filter((a) => names.includes(a.name));
}

// ---------------------------------------------------------------------------
// §152 — THE RESTRICTION OPT. `pairsTouching: ['Unit A', 'Unit B']` narrows a
// sweep to the pairs that involve at least one named unit, and every other
// pair keeps the verdict a previous full run measured for it.
//
// WHY IT LIVES HERE rather than in the harness, which is where a caller would
// naturally filter. Three of the four tables it filters are MODULE-PRIVATE:
// `CLEARANCE_BUDGETS`, `PENETRATION_BUDGETS` and `EXPECTED_PAIRS` are not
// exported, so `focusedCheck` can filter them and ci-battery.mjs cannot. The
// entry that scoped this recorded the restriction on `clearances` as "free
// today — the existing `budgets` opt", and that is true of the function next
// door and false of CI. One opt, resolved once, in the module that owns the
// tables.
//
// IT THROWS ON A NAME IT DOES NOT KNOW, and that is resolveAxes' rule for
// resolveAxes' reason: "a mistyped slice that quietly swept nothing would
// report a clean partition of no work." Here the failure is worse than a
// wasted run — a typo'd unit name that silently matched nothing would restrict
// every sweep to nothing at all and report a green battery of no work done.
//
// WHAT IT DOES NOT NARROW. The pair loop only; never `collectUnits`. A
// restricted `inspection` must collect the same units a whole run collects,
// because mergeInspection throws on a unit-list disagreement between slices
// and that throw is the thing standing between §127's partition and a merge
// that papers over a build difference.
//
// AND IT CANNOT NARROW THE BROAD PHASE, which the scoping entry hoped it
// might. A pair survives if EITHER unit is named, so every unit in the scene
// is in some surviving pair — paired with a named one — and every unit's box
// is therefore still needed at every pose. The rebuild was measured at 0.28%
// of `inspection`'s wall, so nothing is lost; what is worth keeping is that
// it is impossible rather than merely not worth doing.
// ---------------------------------------------------------------------------
export function resolvePairsTouching(clock, names) {
  if (names === undefined || names === null) return null;
  const list = Array.isArray(names) ? names : [names];
  const known = new Set(clock.labelEntries.map((e) => e.name));
  const missing = list.filter((n) => !known.has(n));
  if (missing.length) {
    throw new Error(`pairsTouching: unknown unit name(s): ${missing.join(', ')} `
      + '— a name that matches nothing would restrict every sweep to no work and report it green');
  }
  const set = new Set(list);
  // The predicate every consumer below shares, so "touching" has one meaning.
  set.touches = (a, b) => set.has(a) || set.has(b);
  return set;
}

// The side-channel a restricted run carries so the harness can UNION it back
// against a baseline: which units were named, and which rows of the declared
// table survived, BY INDEX. Indices rather than pair strings because a pair
// name is not a key — two budget rows may name the same pair with different
// axes — and because the union has to rebuild the table's ORDER, which is the
// full run's order and not the surviving subset's.
//
// It is attached ONLY when a restriction was applied, so a full run's payload
// is byte-identical to the one it produced before this landing existed. That
// identity is the acceptance for the whole entry.
function restrictionRecord(touching, keptIndices) {
  return { units: [...touching].sort(), keptIndices };
}
// ---------------------------------------------------------------------------
// checkAxisEntry (TODO 54) — two tiers over every ORDERED PAIR of axes.
//
// GATED: entering an axis the way a sweep now enters it reproduces that axis's
// pose EXACTLY, whatever ran before it. That is the property §127's partition
// stands on — a slice in a fresh browser context starts from canonical, so it
// must land the poses the whole-run sweep lands — and it is not a tautology
// about resetInputs: resetInputs is a hand-maintained list that has been
// INCOMPLETE twice already (§34's explode and §58's drags were both added
// after a sweep ran on displaced geometry). A new banked input that nobody
// adds to it fails here, on the pair that banks it.
//
// REPORTED: the same hand-off WITHOUT the entry — the state the sweeps
// actually carried before TODO 54, measured per unit. The item filed the leak
// from a source read and said plainly that whether any CURRENT finding
// depended on it was unmeasured; these rows are that measurement, and they are
// a report because a leak is not a defect, it is a pose nobody declared.
// ---------------------------------------------------------------------------
export function checkAxisEntry(clock, { axes = AXES, fractions = [0, 1] } = {}) {
  const key = (axis, f) => `${axis.name}@${f}`;
  const poseAt = (axis, f) => clock.setPose(axis.pose(f, clock));  // setPose ends in updateMatrixWorld

  // What each (axis, f) looks like entered from canonical — the reference.
  const canon = new Map();
  for (const axis of axes) for (const f of fractions) {
    enterAxis(clock); poseAt(axis, f);
    canon.set(key(axis, f), unitBoxRows(clock));
  }

  // Per-unit worst corner displacement, worst first. Quantised at 1e-3 by
  // unitBoxRows, so a row here is real geometry, not float noise.
  const diffRows = (a, b) => {
    const out = [];
    for (const n of Object.keys(a)) {
      let d = 0;
      for (let i = 0; i < 6; i++) d = Math.max(d, Math.abs(a[n][i] - b[n][i]));
      if (d > 0) out.push({ unit: n, delta: +d.toFixed(4) });
    }
    return out.sort((x, y) => y.delta - x.delta);
  };

  const violations = [], leaks = [];
  let pairsTested = 0;
  for (const prev of axes) for (const axis of axes) {
    if (prev === axis) continue;
    for (const f of fractions) {
      // (a) the guarantee: prev to its tail, then ENTER axis as a sweep does.
      enterAxis(clock); poseAt(prev, 1);
      enterAxis(clock); poseAt(axis, f);
      pairsTested++;
      const held = diffRows(canon.get(key(axis, f)), unitBoxRows(clock));
      if (held.length) violations.push({
        prev: prev.name, axis: axis.name, f, unitsMoved: held.length, worst: held[0],
      });

      // (b) the leak: the same hand-off with no entry, which is what ran here
      //     for every sweep before TODO 54.
      enterAxis(clock); poseAt(prev, 1);
      poseAt(axis, f);
      const leaked = diffRows(canon.get(key(axis, f)), unitBoxRows(clock));
      if (leaked.length) leaks.push({
        prev: prev.name, axis: axis.name, f, unitsMoved: leaked.length,
        worst: leaked[0], moved: leaked.slice(0, 5),
      });
    }
  }

  // Which units the leak actually moved, and how far at worst — the compact
  // form of "what was the movement worth", so the report answers the question
  // without anyone re-deriving it from 220 rows.
  //
  // The CAP is named rather than hidden: this ranks over each row's five
  // worst-displaced units (`moved`), so a unit that is never in a hand-off's
  // top five does not appear here. Every row still carries its own untruncated
  // `unitsMoved` count, so the rows are the authority and this is the summary.
  const byUnit = new Map();
  for (const r of leaks) for (const m of r.moved) {
    const cur = byUnit.get(m.unit);
    if (!cur || m.delta > cur.worst) byUnit.set(m.unit, { worst: m.delta, pairs: (cur?.pairs ?? 0) + 1 });
    else byUnit.set(m.unit, { worst: cur.worst, pairs: cur.pairs + 1 });
  }
  const leakUnits = [...byUnit.entries()]
    .map(([unit, v]) => ({ unit, worst: v.worst, pairs: v.pairs }))
    .sort((a, b) => b.worst - a.worst);

  enterAxis(clock);
  return {
    ok: violations.length === 0,
    gate: 'GATING: with canonical entry, every axis reproduces its own pose whatever ran before it. '
      + 'The leak tier is a REPORT — the undeclared state the sweeps carried before TODO 54.',
    axes: axes.map((a) => a.name), fractions, pairsTested,
    violations,
    leak: { pairsLeaking: leaks.length, units: leakUnits, rows: leaks },
  };
}

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

// --- The ARBITER the tri-tri machinery finally forced (TODO 6 pass) --------
// Two failure modes are now MEASURED, in opposite directions, on live pairs:
//   · intersectsGeometry said TRUE in BOTH directions and
//     closestPointToGeometry said 0 for the alarm hand ⇄ hour tube — parts
//     a provable 2.32 apart radially (the both-directions cross-check the
//     2026-07 balance-rim case justified is defeated here).
//   · the vertex-only ruler said 0.85 CLEAR for the minute star ⇄ hour
//     tube while the star's tooth FLANKS pass through the tube's wall 0.22
//     deep — a vertex in the bore's open air measures a positive distance
//     to the surface it crossed between samples (the same blindness that
//     let TODO 6's original probe under-report a standing collision as
//     "0.0084 from touching").
// So near-zeros are arbitrated by a sampler that neither mode can fool:
// samples = vertices PLUS EDGE MIDPOINTS (edges see what vertices cannot),
// each tested for distance (closestPointToPoint, the trusted single-tree
// path) AND for containment (parity raycast against the other mesh's own
// tree — every geometry this codebase builds is a closed extrude, lathe or
// primitive, so odd crossing parity means inside). Any contained sample is
// a genuine crossing; otherwise the min sampled distance stands.
const _parityRay = new THREE.Ray();
function pointInsideTree(tree, pLocal) {
  _parityRay.origin.copy(pLocal);
  _parityRay.direction.set(0.317, 0.591, 0.741).normalize(); // fixed oblique direction — axis-aligned rays graze coaxial walls
  const hits = tree.raycast(_parityRay, THREE.DoubleSide);
  let n = 0;
  for (const h of hits) if (h.distance > 1e-9) n++;
  return (n % 2) === 1;
}
function sampledVerdict(a, b, upperBound = Infinity) {
  if (SWEEP_CENSUS.on) {
    const c = SWEEP_CENSUS.c;
    c.verdictCalls++;
    const t0 = performance.now();
    const r = _sampledVerdictInner(a, b, upperBound);
    c.verdictMs += performance.now() - t0;
    return r;
  }
  return _sampledVerdictInner(a, b, upperBound);
}
// §122 fix one — THE VERDICT'S TWO LAPS ARE BOUNDED BY EXACT CUTS. Both skip
// only work whose result is provable from the skip condition itself:
//   · DISTANCE skip: box distance is a true lower bound of mesh distance, so
//     boxD ≥ best means the bounded closestPointToPoint(…, 0, best) could
//     not have produced hit.distance < best; `best` after the sample is
//     identical either way, so all later pruning and the final d are
//     BIT-IDENTICAL — held over 7,042,573 samples across 681 near pairs
//     with zero counterexamples (the §122 dissection probe). This is the
//     cut that matters at meshClearance's running-best bound (up to ~0.55
//     in clearances — the loosest in the file; the census measured those
//     verdicts at 1023 ms per call).
//   · PARITY skip: a sample strictly outside the dst tree's bounding box
//     cannot be inside the dst mesh (mesh ⊆ box, a geometric fact), so
//     pointInsideTree's TRUE answer for it is false and skipping cannot
//     change a sound OR. What the same dissection MEASURED is that the
//     baseline was not always sound: the fixed oblique parity ray returns
//     ODD for some samples up to 13 u outside the other mesh's bounds —
//     a grazing-count lie, the third measured lying mode in this
//     instrument family (§82's vendor patches record the other two). So
//     this cut is exact with respect to truth and NOT byte-identical with
//     respect to the baseline: where the two differ, the baseline verdict
//     was a false "inside" on a provably-outside sample, and the skip
//     corrects it. Every report row that moves under this landing is
//     enumerated in the landing's diff and owes its justification to that
//     evidence — a moved row without a boxD witness is a defect, exactly
//     as §122's envelope demands.
// The box comes from the TREE, not geometry.boundingBox, deliberately:
// bvhFor caches per geometry and never invalidates, so for a morphing mesh
// the tree is frozen at first build — a box derived from the tree is exactly
// as fresh as the verdict already is, and adds no staleness of its own.
const _bvhBoxCache = new WeakMap();
function bvhBox(tree) {
  let box = _bvhBoxCache.get(tree);
  if (!box) { box = tree.getBoundingBox(new THREE.Box3()); _bvhBoxCache.set(tree, box); }
  return box;
}
function _sampledVerdictInner(a, b, upperBound = Infinity) {
  let best = upperBound, inside = false;
  const e0 = new THREE.Vector3(), e1 = new THREE.Vector3();
  for (const [src, dst] of [[b, a], [a, b]]) {
    const tree = bvhFor(dst);
    bvhFor(src); // indexing side effect — edge extraction below reads the index
    const box = bvhBox(tree); // dst-local, same frame as the transformed samples
    _mat.copy(dst.matrixWorld).invert().multiply(src.matrixWorld);
    const pos = src.geometry.attributes.position;
    const test = (v) => {
      const boxD = box.distanceToPoint(v); // 0 inside/on the box
      if (boxD < best) {
        const hit = tree.closestPointToPoint(v, {}, 0, best);
        if (hit && hit.distance < best) best = hit.distance;
      }
      if (!inside && boxD === 0 && pointInsideTree(tree, v)) inside = true;
    };
    for (let i = 0; i < pos.count; i++) test(_sampleV.fromBufferAttribute(pos, i).applyMatrix4(_mat));
    const idx = src.geometry.index;
    if (idx) {
      for (let t = 0; t < idx.count; t += 3) {
        for (const [i0, i1] of [[0, 1], [1, 2], [2, 0]]) {
          e0.fromBufferAttribute(pos, idx.getX(t + i0));
          e1.fromBufferAttribute(pos, idx.getX(t + i1));
          test(_sampleV.addVectors(e0, e1).multiplyScalar(0.5).applyMatrix4(_mat));
        }
      }
    }
    if (inside) return { inside: true, d: 0 };
  }
  return { inside, d: inside ? 0 : best };
}

// ---------------------------------------------------------------------------
// §108's EXPERIMENT — the sweep census. The roadmap entry proposes a
// render-based pre-filter for the four pair sweeps and mandates one
// measurement before any renderer exists: per check, how many pairs are
// considered, how many survive the AABB gate, how many reach an exact
// query, where the time inside those queries goes, and what the queries
// come back with — because a pre-filter only pays if it beats boxDistance
// at skipping pairs the exact tier would call clearly apart. REPORT-ONLY:
// the four checks attach the snapshot to their payloads as `census`; no
// gate reads it. Off outside those checks, so intraUnit/assembly (which
// share the primitives) never contaminate the attribution — checks run
// sequentially per browser context.
export const SWEEP_CENSUS = { on: false, c: null };
export function censusStart() {
  SWEEP_CENSUS.on = true;
  SWEEP_CENSUS.c = {
    aabbTests: 0, aabbPass: 0,           // mesh-pair AABB gate: evaluations, survivors (events, pose-summed)
    exactCalls: 0, exactMs: 0,           // meshClearance + meshesIntersect: the exact tier
    verdictCalls: 0, verdictMs: 0,       // sampledVerdict: the arbitration tier (inside the exact tier's time)
    out: { pruned: 0, far: 0, mid: 0, near: 0, contact: 0 },  // meshClearance outcomes:
    // pruned = nothing within the caller's bound (the BVH proved "apart" cheaply)
    // far ≥ 0.4 · mid ≥ 0.05 · near < 0.05 (arbitrated) · contact ≤ 0
    boolTrue: 0, boolFalse: 0,           // meshesIntersect outcomes
  };
}
export function censusStop() {
  SWEEP_CENSUS.on = false;
  const c = SWEEP_CENSUS.c;
  SWEEP_CENSUS.c = null;
  if (c) { c.exactMs = +c.exactMs.toFixed(1); c.verdictMs = +c.verdictMs.toFixed(1); }
  return c;
}

export function meshClearance(a, b, upperBound = Infinity) {
  if (SWEEP_CENSUS.on) {
    const c = SWEEP_CENSUS.c;
    c.exactCalls++;
    const t0 = performance.now();
    const d = _meshClearanceInner(a, b, upperBound);
    c.exactMs += performance.now() - t0;
    if (d === Infinity || d >= upperBound) c.out.pruned++;
    else if (d <= 0) c.out.contact++;
    else if (d < 0.05) c.out.near++;
    else if (d < 0.4) c.out.mid++;
    else c.out.far++;
    return d;
  }
  return _meshClearanceInner(a, b, upperBound);
}
function _meshClearanceInner(a, b, upperBound = Infinity) {
  // BUILT §82 — closestPointToGeometry returned NON-MINIMAL distances that
  // depended on WHICH QUERIES RAN BEFORE: measured at one pose, sleeve
  // lathe ⇄ rocker box read 0.1066 cold, 0.1404 after the transposed query,
  // 0.4110 after an unrelated one — while a vertex of one mesh sat 0.1066
  // from the other, and a correct closest-point search can never exceed a
  // sampled point pair. The lie is an OVER-estimate, the unsafe direction
  // for a clearance instrument, and it sails over the 0.05 near-zero guard
  // below. Root cause, found and PATCHED in the vendored library
  // (vendor/README.md documents both diffs): shapecast never consults
  // intersectsBounds for the ROOT node, and the dual-tree path only seeds
  // its inner-scorer OBB inside intersectsBounds(isLeaf) — so any query
  // whose outer tree is a single leaf (the rocker's 12-triangle box) ran
  // its whole inner traversal pruning against WHATEVER OBB THE PREVIOUS
  // QUERY LEFT in the shared module temp. A second, independent defect in
  // OrientedBox.distanceToBox (box edge segments built with max[f2] where
  // max[f3] belongs, missing edge-edge minima) is patched alongside. This
  // comment is the record of why the vendor is no longer verbatim; every
  // meshClearance consumer inherits the corrections.
  const bvh = bvhFor(a);
  bvhFor(b);
  _mat.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
  const hit = bvh.closestPointToGeometry(b.geometry, _mat, {}, {}, 0, upperBound);
  let d = hit ? hit.distance : Infinity; // Infinity ⇒ nothing within upperBound
  // Cross-check near-zeros. closestPointToGeometry's tri-to-tri distance
  // short-circuits to 0 through its own triangle-intersection test, and
  // that test can FALSELY report an intersection for plainly separated
  // meshes at specific relative transforms (first observed: a balance
  // timing screw vs the escape bridge's fork jewel; later the alarm hand ⇄
  // hour tube, 2.32 apart, where the boolean lied in BOTH directions too —
  // so the boolean can no longer arbitrate). Near-zeros go to
  // sampledVerdict: a contained sample proves the contact genuine; none,
  // and the sampled minimum stands.
  if (d < 0.05) {
    const v = sampledVerdict(a, b, upperBound);
    d = v.inside ? Math.min(d, 0) : Math.max(d, v.d);
  }
  return d;
}

const _cbA = new THREE.Box3(), _cbB = new THREE.Box3();
// A mesh's diagnostic label: its registered name when it has one, else its
// geometry type plus its index within the unit — enough to find the surface
// in the build without demanding that every part be named (TODO 10).
function meshLabel(unit, mesh) {
  return mesh.name || `${mesh.geometry.type}#${unit.meshes.indexOf(mesh)}`;
}

function unitClearance(A, B, upperBound = Infinity, exclude = null) {
  let best = upperBound, pair = null;
  const cen = SWEEP_CENSUS.on ? SWEEP_CENSUS.c : null;
  for (const a of A.meshes) {
    _cbA.setFromObject(a);
    for (const b of B.meshes) {
      if (exclude && exclude(a, b)) continue; // TODO 6 — a declared contact is not this measurement's business
      _cbB.setFromObject(b);
      if (cen) cen.aabbTests++;
      if (boxDistance(_cbA, _cbB) >= best) continue;
      if (cen) cen.aabbPass++;
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
export async function sweepClearances(clock, pairs, { axes = AXES, coarse = 4, refineBand = 0.4, yieldEvery = 16 } = {}) {
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
      const { d, pair: meshPair } = unitClearance(pr.A, pr.B, bound, pr.exclude);
      if (d < pr._axisMin) pr._axisMin = d;   // §127 tier 2a — the refinement reference, per axis (see the axis loop)
      if (d < st.min) {
        st.min = d; st.at = { axis: axis.name, f: +f.toFixed(4) };
        // TODO 10 — carry WHICH SURFACES set the minimum, not just which
        // units: unitClearance always knew; this row is where it was dropped.
        st.meshes = meshPair ? [meshLabel(pr.A, meshPair[0]), meshLabel(pr.B, meshPair[1])] : null;
      }
      (pr._samples ||= {})[i] = d; // per-axis scratch, reset below
    }
  };
  for (const axis of axes) {
    const live = pairs.some((pr) => !pr.axes || pr.axes.includes(axis.name));
    if (!live) continue;
    enterAxis(clock);   // TODO 54 — canonical entry; this sweep is clearances + expectedContacts
    // §127 tier 2a — THE REFINEMENT DECISION MAY READ ONLY THIS AXIS'S OWN
    // STATE. A slice of this sweep runs one axis in its own browser context,
    // so it can only reproduce a whole run's rows if it refines the same
    // intervals — and until here the two decisions below consulted the
    // CUMULATIVE per-pair minimum, which earlier axes had already lowered. A
    // slice starting fresh therefore qualified a SUPERSET of intervals and
    // could find a genuinely lower minimum the whole run's heuristic skipped,
    // which is a report that moves with the partition. TODO 54 established
    // exactly this rule for POSES (enterAxis, above); `_axisMin` is the same
    // rule for the refinement heuristic — the sweep's last cross-axis
    // coupling. The query BOUND below stays cumulative on purpose: it is pure
    // speed and it is sound either way, since a pruned query returns a value
    // ≥ the bound ≥ the running minimum and anything below the bound comes
    // back exact, so pruning can never hide a lower true minimum.
    //
    // Consequence, stated because it moves numbers: a WHOLE run now refines a
    // superset of what it used to, so a reported minimum can only stay or
    // DROP. A row that moves is increased accuracy — the old heuristic was
    // skipping that interval — not a regression.
    for (const pr of pairs) { pr._samples = {}; pr._axisMin = Infinity; }
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
        // Both tests read `pr._axisMin`, never the cumulative `state[p].min` —
        // §127 tier 2a's rule, argued at the reset above.
        if (pr.refineFloor !== undefined && pr._axisMin > pr.refineFloor + refineBand) continue;
        for (const i of coarseIdx) {
          const d = pr._samples[i];
          if (d === undefined || d > pr._axisMin + refineBand) continue;
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
    for (const pr of pairs) { delete pr._samples; delete pr._axisMin; }
  }
  return { state, poseCount };
}

// Worst-case (minimum) clearance between two units swept across pose axes.
// Returns { min, at: {axis, f} } plus show() to pose and frame the
// offending configuration, mirroring runInspection's __inspect.show.
export async function measureClearance(clock, nameA, nameB, { axes = AXES, coarse = 4, refineBand = 0.4, yieldEvery = 16 } = {}) {
  const A = unitByName(clock, nameA), B = unitByName(clock, nameB);
  const { state } = await sweepClearances(clock, [{ A, B }], { axes, coarse, refineBand, yieldEvery });
  const { min, at, meshes } = state[0];
  return {
    min: +min.toFixed(4),
    at,
    meshes, // TODO 10 — the two surfaces that set the minimum, by name (or geometry type when unnamed)
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
  // TODO 53 (closed): the chain's top coil at full wind runs under the
  // plate, and the plate floor now carries the chain's closed-form reach
  // (CHAIN_TQ_REACH) — this row is the independent check from the other
  // side, over the sweep rather than the one built pose. Full wind IS
  // swept: the reserve axis reaches tension 1 at f = 0, and the beat,
  // train and crown axes pin tension 1 throughout.
  { a: 'Chain', b: 'Three-quarter plate', min: 0.15 },
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
  // Minute quick-set: the jumper lives in the thin slice between
  // the minute wheel and the hour wheel on the dial face — these rows
  // hold that slice and its neighbours. The Dial row excludes the crown
  // axis: crown out SEATS the beak in the minute star (a Dial-unit mesh
  // via the motion-works nesting) — that contact is the detent itself.
  { a: 'Minute jumper', b: 'Dial', min: 0.15, axes: ['beat', 'reserve', 'train'] },
  { a: 'Minute jumper', b: 'Hour wheel', min: 0.15 },
  { a: 'Minute jumper', b: 'Keyless works', min: 0.15 },
];

// ---------------------------------------------------------------------------
// TODO 6 — EXPECTED names the PAIR; these rows name the CONTACT. One declared
// mesh used to grant a whole unit pair blanket immunity: the minute star ran
// 0.0084 from the hour tube under the 12:1's blanket, and §45's post-mortems
// added two more (the follower bar 0.108 into the heart's lobe, the lobe
// sweeping through the pivot post) — four shipped defects in the class. Each
// row here re-arms the margin for an EXPECTED pair: its `contacts` are the
// pair's DECLARED touching mesh pairs (each citing the instrument that owns
// that contact), excluded from the measurement; everything else between the
// two units owes `min`. Mesh matching is by `.name` (string-coupled, like
// every other table here); name a mesh rather than widening a row.
export const EXPECTED_CONTACT_FLOORS = [
  {
    a: 'Alarm disc', b: 'Hour wheel', min: CLEAR_MARGIN,
    contacts: [
      ['alarmNose', 'alarmHeart'],        // §29 working contact — penetration budget + alarmHandoffs own it
      ['alarmFollowerBar', 'alarmHeart'], // §45 flank sweep owns this at the 0.03 working figure
      ['alarmTailPin', 'alarmHeart'],     // same lever, same band — the flank sweep's geometry bounds it
      ['alarmTubeBody', 'hourTube'],      // the §25 C running seat: bore 3.05 on the 3.0 tube IS the coupling
      ['alarmPivotPost', 'alarmHeart'],   // §45: post inner edge DERIVED as lobe + working 0.03
      ['alarmIndexLine', 'alarmHeart'],   // §34 first slice: the index line is DECLARED proud 0.02 into the
                                          // flange→heart margin — this check measured the declared 0.13 exactly
    ],
  },
  {
    a: 'Hour wheel', b: 'Motion works', min: CLEAR_MARGIN,
    contacts: [
      ['mwHourWheel', 'mwMinutePinion'],  // the 12:1's second mesh — the row EXPECTED was written for
    ],
    // TODO 21 CLOSED — the waiver is deleted, not renewed. This row's first
    // run found the minute wheel's and star's teeth standing inside the hour
    // tube's wall 0.22 deep at every pose, so the 12:1's first mesh happened
    // THROUGH the tube; the motion works has since been re-stacked with the
    // hour wheel dial-most, the way a watch is built, and the tube now rises
    // from that plane crossing nothing but coaxial bores. Measured after:
    // 0 vertices inside the wall band, from 568.
  },
  // §94 tier A — THE SMALL-SECONDS STATION'S OWN PAIRS. `d4` became a spec
  // key, so this station MOVES, and it moves the fourth arbor, its display
  // rod and the sub-dial well through a dial-side neighbourhood none of
  // these three pairs had ever been measured across: all three were
  // EXPECTED, so TODO 6's blanket excused everything between them. The
  // reserve station's pairs are deliberately NOT seeded here — nothing in
  // this tier moves that station, and §94's tier C is where it earns its
  // rows.
  {
    // The station's mount, at the dial end. The 'Small seconds' unit is
    // only the HAND: the well, its bezel and its printed face are Dial
    // meshes, so the pair's whole real content is the hand on its arbor.
    a: 'Heart cam (seconds reset)', b: 'Small seconds', min: CLEAR_MARGIN,
    contacts: [
      ['secondsArborHub', 'smallSecondsBoss'],   // the hand's collet ON the hub — the display joint
      ['secondsArborHub', 'smallSecondsShaft'],  // the blade crosses the axis over that hub
      ['secondsArborRod', 'smallSecondsShaft'],  // …and over the rod's last 0.15 behind it
      ['secondsArborRod', 'smallSecondsBoss'],   // same joint, collet side
    ],
  },
  {
    // The same arbor against the DIAL: partly the joint above re-attributed
    // through nesting (the hand is a dialFace descendant, so the Dial unit
    // carries its meshes — the Dial ⇄ Hour wheel precedent), partly the
    // real pass-through, the hub going up through the pocket floor's bore.
    a: 'Heart cam (seconds reset)', b: 'Dial', min: CLEAR_MARGIN,
    contacts: [
      ['secondsArborHub', 'smallSecondsBoss'],   // the four rows above, re-attributed
      ['secondsArborHub', 'smallSecondsShaft'],
      ['secondsArborRod', 'smallSecondsShaft'],
      ['secondsArborRod', 'smallSecondsBoss'],
      ['secondsArborHub', 'dialPlate'],          // the hub passes the well floor's bore (SUBDIAL_BORE_R is derived from its radius)
      ['secondsArborRod', 'dialPlate'],          // and the rod behind it through the same bore
      ['secondsArborHub', 'secondsSubdialFace'], // the hub's standoff from the PRINT on that floor —
                                                 // hubZ derives it as exactly CLEAR_MARGIN, and the face
                                                 // is a zero-volume decal, not stock
    ],
  },
  {
    // No contact at all, which is the finding: this pair is EXPECTED for a
    // touch that does not exist between these two units. What it owes is a
    // CLEARANCE — the hand over its well — and that is what this row asks.
    // TODO 41 CLOSED the waiver this row shipped with: the hand's standoff
    // is now derived mid-band from its own section (wellHandZ in main.js —
    // keel + the margin below, blade top sunk above), so the row measures
    // clear of the floor with real slack, not float luck.
    a: 'Dial', b: 'Small seconds', min: CLEAR_MARGIN,
    contacts: [],
  },
  {
    // The reserve well's copy of the row above, seeded by TODO 41's fix
    // pass when it measured the pair nothing had ever asked about: the
    // reserve hand — a 'minute' whose central width law hung its keel
    // 0.299 below its plane — rode 0.0014 over its well floor, invisible
    // because an EXPECTED pair without a floors row still gets TODO 6's
    // blanket. Same claim as the seconds row: no contact exists between
    // these two units, so what the pair owes is clearance everywhere.
    // §153 — the hand rides mostly PROUD of the barely-recessed sector
    // now, its plane ceiling-anchored one margin under the rattrapante
    // blade's sweep lane, so this row measures CLEAR_MARGIN plus the
    // recess derivation's 0.01-grid residue over the floor by
    // construction (≈ 0.158 — see the hand's build in main.js).
    a: 'Dial', b: 'Power reserve', min: CLEAR_MARGIN,
    contacts: [],
  },
  // §94 tier C — THE RESERVE STATION'S TRAIN PAIRS, two of the three rows
  // tier A left on the shelf ("nothing in tier A moves that station; tier C
  // is where it earns its rows"). `rsvr` is a spec key now, so this station
  // moves — the hand, its arbor and the well through the same dial-side
  // neighbourhood the seconds rows police one station over. The third
  // shelf row, `Dial ⇄ Power reserve`, was seeded by TODO 41's fix pass
  // (above) in the same landing window — tier C measured the same 0.0014
  // that pass fixed, and the fixed row needs no waiver.
  {
    // The station's mount: the w2 output arbor rises through the well
    // floor's bore and the hand's bored collet seats on it — that joint
    // is the display coupling, and it is the pair's whole content.
    a: 'Power reserve', b: 'Power-reserve train', min: CLEAR_MARGIN,
    contacts: [
      ['reserveBoss', 'rsvHandArbor'],   // the collet ON the arbor — the display joint
      ['reserveShaft', 'rsvHandArbor'],  // the blade crosses the axis over that collet
    ],
  },
  {
    // The same arbor against the DIAL: the joint above re-attributed
    // through nesting (the hand is a dialFace descendant, so the Dial unit
    // carries its meshes — the seconds rows' precedent), plus the real
    // pass-through of the arbor in the well floor's bore.
    a: 'Dial', b: 'Power-reserve train', min: CLEAR_MARGIN,
    contacts: [
      ['reserveBoss', 'rsvHandArbor'],   // the two rows above, re-attributed
      ['reserveShaft', 'rsvHandArbor'],
      ['rsvHandArbor', 'dialPlate'],         // the arbor passes the sector floor's bore (SUBDIAL_BORE_R is derived from its radius) and stands out of the plate to the proud hand (§153)
      ['rsvHandArbor', 'reserveSubdialFace'], // …and crosses the printed floor's plane inside that bore (the face is a zero-volume decal)
    ],
  },
  {
    a: 'Alarm release sleeve', b: 'Alarm disc', min: CLEAR_MARGIN,
    contacts: [
      ['alarmSleeveSkirt', 'alarmTailPin'], // §45 working contact — handoffs row + band asserts own it
      ['alarmSleeveFlat', 'alarmTailPin'],  // the flat's bore: rest flank + working 0.03, derived
      ['alarmSleeveWeb', 'alarmTailPin'],   // the web rides the same derivation chain as the bore
    ],
  },
  // §99 — the winding pair's blanket excuse retired: the ONE contact is the
  // idler⇄arbor-wheel mesh; everything else between the units (i2's disc
  // over the body's lid at the tier's derived margin+ε, the climb pinion,
  // the studs) owes the floor.
  {
    a: 'Alarm winding train', b: 'Alarm barrel', min: CLEAR_MARGIN,
    contacts: [
      ['alarmWindIdler', 'alarmArborWheel'], // §99 working mesh — the chain solve phases it, the battery's mesh checks own it
    ],
  },
  // §99 — the hold: the beak parks ON the saw (the handoffs row measures the
  // kiss; the alarmWind penetration budget polices the ride), and nothing
  // else of the click may touch the barrel anywhere in the cycle.
  {
    a: 'Alarm click', b: 'Alarm barrel', min: CLEAR_MARGIN,
    contacts: [
      ['alarmClickPawl', 'alarmArborRatchet'], // the parked kiss + the ratcheting ride
    ],
  },
  // §104 — the governor's EXPECTED pair gets its floors row on arrival (no
  // blanket excuse): the ONE contact is the ×8 mesh; the saw clears the 64T
  // wheel's band by the derived margin, the studs and arbors stand clear,
  // and every one of them owes the floor everywhere in the cycle.
  {
    a: 'Alarm striking wheel', b: 'Alarm governor', min: CLEAR_MARGIN,
    contacts: [
      ['alarmGovWheel', 'alarmGovPinion'], // the ×8 stage — a working gear mesh
      // §112 band swap: an 8-leaf pinion's root stands 0.02 over its own
      // arbor, so the wheel's working tip rides ~0.03 from the arbor by
      // the mesh's tip-root arithmetic (0.25·m of clearance to the root,
      // and the arbor IS nearly the root). The region is the mesh's own —
      // the gear gauges and the mesh's tip assert own it, exactly like the
      // pinion row above; real 8-leaf trains run this close by design.
      ['alarmGovWheel', 'alarmGovArbor'],
    ],
  },
  // §107 — the pair the anchor's promotion created. Its declared contact is
  // the governing one (a tooth tip riding a generated pallet face); every
  // other approach between the two units is held to the one margin.
  {
    a: 'Alarm governor', b: 'Alarm governor anchor', min: CLEAR_MARGIN,
    contacts: [
      ['alarmGovSaw', 'alarmGovPallet'],
    ],
  },
  // §47 — the winding arrest's three pairs, each with exactly the contact
  // its design claims; everything else between them owes the one margin.
  {
    a: 'Winding arrest', b: 'Three-quarter plate', min: CLEAR_MARGIN,
    contacts: [
      ['windArrestBracket', 'threeQuarterPlate'], // the flush hang — the support joint
    ],
  },
  {
    a: 'Winding arrest', b: 'Chain', min: CLEAR_MARGIN,
    axes: ['beat', 'reserve', 'train', 'crown'], // the wind axis legitimately closes the pad's gap through its whole ramp; these axes pin tension where the pair owes clearance everywhere
    contacts: [
      ['windArrestPad', 'chainRun'],              // the coil under the pad
    ],
  },
  {
    a: 'Winding arrest', b: 'Fusee & great wheel', min: CLEAR_MARGIN,
    axes: ['beat', 'reserve', 'train', 'crown'],
    contacts: [
      ['windArrestBeak', 'windArrestLug'],        // beak on the stop lug
    ],
  },
  // TODO 50 — the stem clutch's EXPECTED pairs get their floors rows on
  // arrival (no blanket excuse). The declared contacts are the coupling
  // itself, the keyed square in the clutch's bores, and the pulled setting
  // mesh; everything else of the clutch owes the margin everywhere in the
  // cycle, at both parities of the coupling.
  {
    a: 'Winding clutch', b: 'Keyless works', min: CLEAR_MARGIN,
    contacts: [
      ['clutchSaw', 'windPinionSaw'],   // the coupling: faces bear seated, ramps ride camming
      ['clutchSleeve', 'stemSquare'],   // the keyed joint: the square in the sleeve's square bore
      // (no clutchSleeve ⇄ windStem row: the stem is a TURNED part — its
      // round journal starts outboard of the square section, past the
      // sleeve's whole ride band, so the pipe never reaches it)
      ['clutchRim', 'settingWheel'],    // pulled out: the setting mesh the old pinion carried
    ],
  },
  {
    a: 'Winding clutch', b: 'Yoke', min: CLEAR_MARGIN,
    contacts: [
      ['clutchHubCollarIn', 'yokeProng'],   // the fork rides between the collars —
      ['clutchHubCollarOut', 'yokeProng'],  // both faces are the working pair
    ],
  },
];

// TODO 6's check: sweep each row's unit pair with its declared contacts
// EXCLUDED, and hold the remainder to the row's floor. REPORT-first (§50's
// arc: report, triage, then gate) — `ok` is per-row and the caller decides.
export async function checkExpectedContacts(clock, { rows = EXPECTED_CONTACT_FLOORS, axes = AXES, coarse = 4, refineBand = 0.4, yieldEvery = 16, pairsTouching } = {}) {
  // §152 — same shape as checkClearances next door: filter the declared rows,
  // keep their indices in the FULL table for the harness's union.
  const touching = resolvePairsTouching(clock, pairsTouching);
  const keptIndices = touching
    ? rows.map((r, i) => (touching.touches(r.a, r.b) ? i : -1)).filter((i) => i >= 0)
    : null;
  if (touching) rows = keptIndices.map((i) => rows[i]);
  const pairs = rows.map((row) => {
    const A = unitByName(clock, row.a), B = unitByName(clock, row.b);
    // §94 — THE NESTED PAIRS, made measurable. Several EXPECTED pairs are a
    // LABEL NESTING rather than two disjoint assemblies: 'Small seconds',
    // 'Power reserve' and 'Motion works' are labelled children of the
    // dialFace group, so every one of their meshes is ALSO a 'Dial' mesh
    // (collectUnits does no nested-label exclusion — see the Dial ⇄ Hour
    // wheel note in EXPECTED_PAIRS). The pair loop therefore measures the
    // shared meshes against EACH OTHER: the small-seconds hand's blade
    // against its own tip, 0 at every pose. That is an INTRA-unit question,
    // which TODO 5's check owns and this one has no standing over, and
    // before §94 it made a floors row on a nested pair unwritable — the row
    // would have had to declare a part's own meshes as contacts with each
    // other before it could ask the real question, which is what those
    // meshes clear in the parts the OTHER unit does not share.
    const shared = new Set(A.meshes.filter((m) => B.meshes.includes(m)));
    return {
      A, B,
      axes: row.axes,
      refineFloor: row.min,
      exclude: (ma, mb) => (shared.has(ma) && shared.has(mb)) || row.contacts.some(([na, nb]) =>
        (ma.name === na && mb.name === nb) || (ma.name === nb && mb.name === na)),
    };
  });
  // a contact name that matches NOTHING is a silent hole — report it, the
  // string-coupling convention's own failure mode
  const unmatched = [];
  rows.forEach((row, i) => {
    const names = new Set([...pairs[i].A.meshes, ...pairs[i].B.meshes].map((m) => m.name).filter(Boolean));
    for (const c of row.contacts) for (const n of c) if (!names.has(n)) unmatched.push({ pair: `${row.a} ⇄ ${row.b}`, name: n });
  });
  censusStart();   // §108's experiment — report-only, see the census block
  const { state } = await sweepClearances(clock, pairs, { axes: resolveAxes(axes), coarse, refineBand, yieldEvery });  // §152 — see checkClearances
  const census = censusStop();
  const results = rows.map((row, i) => {
    const capped = !isFinite(state[i].min);
    const meets = capped || state[i].min >= row.min;
    return {
      pair: `${row.a} ⇄ ${row.b}`,
      min: capped ? `≥ ${(row.min + refineBand).toFixed(2)}` : +state[i].min.toFixed(4),
      floor: row.min,
      at: capped ? '(never within band)' : `${state[i].at.axis} f=${state[i].at.f}`,
      meshes: capped ? undefined : (state[i].meshes ? state[i].meshes.join(' ⇄ ') : undefined),
      contactsExcluded: row.contacts.length,
      waived: !meets && row.waived ? row.waived : undefined, // §50's convention: visible debt, cited
      ok: meets,
    };
  });
  console.table(results);
  return {
    violations: results.filter((r) => !r.ok && !r.waived),
    waivedCount: results.filter((r) => !r.ok && r.waived).length,
    unmatched, results, census,
    // §127 tier 2a — raw minima on a narrowed run only; see checkClearances.
    ...(resolveAxes(axes).length < AXES.length ? { rawMins: state.map((st) => (isFinite(st.min) ? st.min : null)) } : {}),
    ...(touching ? { restriction: restrictionRecord(touching, keptIndices) } : {}),
  };
}

// ---------------------------------------------------------------------------
// TODO 5 — the sweep cannot see INSIDE a unit, and units bundle a FIXED
// mount with the thing that MOVES on it: exactly the pair most likely to
// foul, hidden twice (the pair loop skips same-unit; the unit's own AABB
// contains both). The stop-lever bracket carried 0.685 of penetration at
// every pose through every battery run in the project's history this way.
// The check DERIVES its populations instead of naming parts: pose the sweep
// axes, diff each mesh's matrix RELATIVE TO ITS UNIT ROOT — meshes that
// never move relative to their unit are its fixtures, the rest its movers —
// then test for genuine intersection (the honest meshesIntersect:
// parity-raycast arbitrated). Designed running fits have CLEARANCE and read
// as apart; only real interpenetration flags. Intended contacts are declared
// in INTRA_UNIT_CONTACTS with the instrument or derivation that owns them.
//
// §121 — THREE TIERS, because the mover/fixture split alone leaves two of
// the four pair classes unwatched, and both bit before they were built:
//   MF  movers vs their unit's fixtures, at every pose (the 2026-08-01
//       interim — the stop-lever class).
//   FF  fixtures vs fixtures, ONCE: fixtures never move relative to their
//       unit by the classification's own definition, so one pose is the
//       whole answer. The pallet fork's ruby-in-slot bevel defect (0.046 of
//       steel inside the stone it holds, geometry.js's stoneAndArm) lived
//       here — both meshes static, so the split never looked at the pair.
//   MM  movers vs movers ACROSS RIGID FRAMES, at every pose. Movers on ONE
//       frame are one part — checkAssembly's connectivity domain, and their
//       mutual overlap is a joint by definition — so the tier compares only
//       across frames: §107's anchor arm through the saw (0.51–0.67, three
//       times in one landing, found by the owner in a screenshot) was
//       exactly a cross-frame pair inside the pre-promotion governor unit.
//       Frames come from the same world-motion-delta signature checkAssembly
//       clusters by (see sameFrame below); a MORPHING mesh is always its own
//       frame, because two matrix-still morphs would otherwise merge and
//       drop out of comparison — MODELING.md rule 6's silent-exclusion class
//       in a new coat.
// The fourth class — same-frame mover pairs — is checkAssembly's, gated
// inside ASSEMBLY_SCOPE and reported outside it (§107's filed widening).
// ---------------------------------------------------------------------------
export const INTRA_UNIT_CONTACTS = [
  // { unit, a, b, why } — labels are meshLabel outputs (name, or Type#index
  // within the unit); string-coupled like every table here. Every row below
  // was inspected on the first run (centre-aligned concentric fits, riveted
  // anchors, sprung bites) — a rotating part ON its arbor models the joint
  // as coincident solids, which is what an assembly IS; the check exists
  // for parts that foul, not parts that join.
  // TODO 50's split renumbered this unit's anonymous meshes (the pinion's
  // saw ring lands before the stem in traversal), and re-reading the pairs
  // corrected a why: the #5⇄#0 row had been excusing the winding pinion's
  // teeth overlapping the crown wheel's rim — the working bevel-style mesh
  // — under the name of the square joint, which lives on the CLUTCH pair's
  // floors row now.
  { unit: 'Keyless works', a: 'ExtrudeGeometry#5', b: 'ExtrudeGeometry#0', why: 'winding pinion teeth overlap the crown wheel rim — the working mesh, bevel-style' },
  // 'CylinderGeometry#7' until TODO 50 named the stem's round journal (the
  // turned-part split — see the strike sleeve above for why that stales a row).
  { unit: 'Keyless works', a: 'windStem', b: 'BoxGeometry#31', why: 'stem in its bushing block' },
  // (A pre-split row 'CylinderGeometry#28 ⇄ ExtrudeGeometry#0' — "arbor
  // through the winding pinion" — is retired: TODO 50's roster changes
  // re-numbered the unit and its selectors landed on a detent collar and
  // the crown wheel's teeth, two parts that never touch. An
  // accidentally-matched selector is worse than an unmatched one: it
  // excuses a pair silently. The joint it once named is same-frame metal
  // the MM clustering already merges.)
  // TODO 53's landing: the fusee arbor's windTop continuation welds into the
  // upper-pivot staff at the plate's mid-plane. The two caps used to
  // COINCIDE exactly (a knife-edge no instrument can arbitrate); the plate
  // rise moved the abutment's phase into this check's sight, and the joint
  // is now an overlap with its name — one arbor, two meshes.
  { unit: 'Fusee & great wheel', a: 'fuseeTopShaft', b: 'fuseeUpperStaff', why: 'one arbor in two meshes — the windTop continuation welds into the pivot staff at the plate mid-plane' },
  // Both were 'ExtrudeGeometry#32' until TODO 50 named the setting wheel
  // (the clutch pair's floors row needed the name): the wheel — the
  // crown-class collar the old why meant — laps the stem bushing at the
  // plate rim, and a numeric selector over a roster the split re-numbered
  // is exactly the stale-row trap.
  { unit: 'Keyless works', a: 'settingWheel', b: 'TorusGeometry#30', why: 'setting wheel at its bushing torus' },
  { unit: 'Keyless works', a: 'settingWheel', b: 'BoxGeometry#31', why: 'setting wheel at the bushing block face' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#36', b: 'CylinderGeometry#37', why: 'setting wheel on its stud' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#44', b: 'CylinderGeometry#39', why: 'minute-arbor wheel on its arbor' },
  // TODO 38 W4's wind axis lifted the fixture-vs-fixture blindness on the
  // fusee stack: the ratchet and the great wheel became MOVERS the moment an
  // axis wound them, and two standing contacts that were always there became
  // visible at the rest pose. Both measured (d = 0.0000, seated not buried)
  // and both are the assembly, not a foul:
  { unit: 'Fusee & great wheel', a: 'ExtrudeGeometry#2', b: 'ExtrudeGeometry#1', why: 'the great wheel plate and its own hub ring — one part, two meshes (makeGear builds the hub as a separate solid riveted through the plate)' },
  { unit: 'Fusee & great wheel', a: 'ratchet', b: 'maintPawl', why: 'the maintaining pawl SEATED in its saw — the working joint the maintaining-power block exists for. (Two meshes in this unit share each name — the base ratchet and the maintaining ratchet, the pawl and its mate — so this row excuses the label pair; the far combination measures 0.1955 clear and never needs the excuse.)' },
  { unit: 'Stop lever', a: 'BoxGeometry#0', b: 'CylinderGeometry#9', why: 'crank bar on the hinge pin — the pivot joint (the repaired TODO 5 unit; its own build assert owns the bracket)' },
  { unit: 'Stop lever', a: 'BoxGeometry#2', b: 'CylinderGeometry#9', why: 'drop leg on the same hinge pin' },
  { unit: 'Mainspring drum', a: 'mainspringHook', b: 'ExtrudeGeometry#0', why: 'the hook is riveted INTO the drum wall — the anchor TODO 1 closed. Since the wind morph the hook is a FIXTURE (it rides the drum and nothing else), so this row is no longer reachable by a mover-vs-fixture check; the geometry is unchanged and the declaration is kept as the record of it' },
  { unit: 'Mainspring drum', a: 'mainspringRibbon', b: 'mainspringHook', why: 'the ribbon\'s outer end is riveted into the wall hook — TODO 1\'s fixed end, and now the only intersection the ribbon has inside its own unit. (The old row against the drum WALL is gone with the readout that caused it: the retired law scaled the whole spiral 6% at empty, which put the outer coil at r 9.027 against a wall bored to 8.680 — 0.347 of standing penetration in a ribbon built 0.164 clear. The morph pins that end instead of stretching it.)' },
  // TODO 11 tranche five gave this mesh a name, which MOVED ITS LABEL: an
  // index label is what a mesh gets for having none, so naming one silently
  // stales every row that referenced it (`unit.meshes.indexOf` is over the
  // whole unit, so no OTHER row renumbers — only the named mesh's own). This
  // check is what caught it. Naming also let the row say what the joint is:
  // it was recorded as the collar, and the collar is the separate row below.
  { unit: 'Alarm striking wheel', a: 'alarmStrikeSleeve', b: 'CylinderGeometry#0', why: 'the sleeve is a turned step ON the strike arbor — one shaft, two meshes' },
  { unit: 'Alarm striking wheel', a: 'alarmStrikePinion', b: 'CylinderGeometry#0', why: 'strike pinion pressed on the same arbor (named by §112\'s placement gate — the row followed the name)' },
  // §89 split the alarm barrel into a fixed arbor and a body wound at its
  // teeth, so its rows changed shape the way the drum's did at TODO 1. The
  // arbor row is kept as the record of a joint that is still there and no
  // longer REACHABLE by a mover-vs-fixture check: arbor and boss are now both
  // fixtures (the arbor stands in the frame, planted in the boss's bore), and
  // the label moved from an index to a name in the same change.
  { unit: 'Alarm barrel', a: 'alarmBarrelArbor', b: 'LatheGeometry#0', why: '§99: the arbor RUNS in its bored boss now (PIVOT_BORE_CLEAR fit, so the pair measures clear rather than joined); the row is the bearing\'s record — §89\'s "both fixtures, unreachable" flipped to mover-vs-fixture the day the arbor became the wound member, and the boss became a lathe when it gained its bore' },
  { unit: 'Alarm barrel', a: 'mainspringRibbon', b: 'alarmBarrelArbor', why: '§89: the inner coil BEARS ON the arbor — springInner is arborR + one ribbon radius by construction, so the coil\'s inner surface and the arbor\'s are the same surface. §99 made both sides MOVERS (the arbor winds, the ribbon morphs), so the mover-vs-fixture check no longer reaches this pair — the row stays as the joint\'s record (TODO 5\'s mover-vs-mover residue)' },
  { unit: 'Alarm barrel', a: 'mainspringRibbon', b: 'alarmSpringArborHook', why: '§89: the ribbon\'s inner END butts the arbor hook\'s flank — TODO 1\'s anchor. §99 moved the hook onto the arbor ROTOR (the inner end tracks the arbor: setWind\'s sweep is the relative angle), so both sides are movers and the pair sits in TODO 5\'s residue; the row stays as the anchor\'s record' },
  { unit: 'Alarm barrel', a: 'alarmArborWheel', b: 'alarmBarrelArbor', why: '§99: the winding wheel pressed on the arbor — bore cut at the arbor\'s own radius, the drive fit IS the joint (the power-reserve train\'s "wheel pressed on its arbor" convention)' },
  { unit: 'Alarm barrel', a: 'alarmArborRatchet', b: 'alarmBarrelArbor', why: '§99: the ratchet keyed on the arbor\'s filed square (across-corners = the arbor\'s diameter — the set-up ratchet\'s convention)' },
  { unit: 'Alarm winding train', a: 'alarmWindIdler', b: 'CylinderGeometry#5', why: 'idler 1 on its stud (§99 named the idler meshes for the winding pair\'s floors row; the stud keeps its index label)' },
  { unit: 'Alarm winding train', a: 'alarmWindIdler', b: 'CylinderGeometry#8', why: 'idler 2 on its stud' },
  // §47 — JOINTS THE COLLAPSE MADE VISIBLE, and that is the point rather
  // than the cost. Before it, the crown wheel, its companion and the
  // transfer wheel moved on NO axis (the winding path's raw accumulator
  // was pinned 0 everywhere), and the maintaining pawls' frame moved with
  // their own pins — so `intraUnit` could not judge any of them: §121's
  // "a part no axis MOVES is a part it cannot judge", met here by parts
  // becoming visible rather than by a waiver. Every row below is a rigid
  // joint by construction, measured at the pose the check reports.
  { unit: 'Keyless works', a: 'ExtrudeGeometry#0', b: 'CylinderGeometry#3', why: '§47: the crown wheel keyed on its arbor — the arbor passes through the wheel it drives (index labels: the wheels and the arbor are coaxial at the winding station)' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#0', b: 'CylinderGeometry#4', why: '§47: the same wheel seated on the arbor\'s collar below it — the axial seat that seats the wheel on its shoulder' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#1', b: 'CylinderGeometry#3', why: '§47: the crown wheel\'s companion body on the same arbor, one keyed stack' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#1', b: 'CylinderGeometry#4', why: '§47: that body on the same collar — the stack is seated as one' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#2', b: 'CylinderGeometry#3', why: '§47: the TRANSFER wheel at the plate-top end of the same arbor — keyed to it, which is why tick() poses the two wheels from one angle' },
  { unit: 'Fusee & great wheel', a: 'maintPawl', b: 'CylinderGeometry#14', why: '§47: a maintaining pawl on its own pivot pin — the pawl rides the pin it rocks about (both pawls carry the same mesh name, so this row covers the pair the check reports)' },
  { unit: 'Fusee & great wheel', a: 'maintPawl', b: 'CylinderGeometry#16', why: '§47: the second maintaining pawl on its own pin — the same joint at the other station' },
  // §47 — the arrest's own declared joints: the finger on its stud (a bored
  // hub, running clearance), under its retaining head, seated on its bank
  // by the blade whose fixed end bears its post.
  { unit: 'Winding arrest', a: 'windArrestPawl', b: 'windArrestStud', why: '§47: the finger\'s bored hub on the hanging stud — the running joint' },
  { unit: 'Winding arrest', a: 'windArrestPawl', b: 'windArrestStudHead', why: '§47: the hub over its retaining head — axial retention, faces sharing the plane' },
  { unit: 'Winding arrest', a: 'windArrestBeakArm', b: 'windArrestBank', why: '§47: the arm seated on the bank pin — the blade\'s rest, kiss at the seat pose' },
  { unit: 'Winding arrest', a: 'windArrestSpring', b: 'windArrestSpringPost', why: '§47: the blade\'s fixed end on its post — the torsion arc\'s reaction point' },
  { unit: 'Alarm click', a: 'alarmClickPawl', b: 'alarmClickStud', why: '§99: the click on its shoulder screw (the hook carries no bore — the blade seats on the stud, the set-up click\'s own construction)' },
  { unit: 'Alarm click', a: 'alarmClickPawl', b: 'alarmClickScrewHead', why: '§99: the click under its screw head — the head retains it axially, faces sharing the plane' },
  { unit: 'Alarm click', a: 'alarmClickPawl', b: 'alarmClickSpring', why: '§99: the spring\'s torus kisses the click\'s flank by construction (tube tangent at the local half-width) — §48-declared spring contact, kept as a row because a float hair puts a kiss on either side of zero' },
  { unit: 'Alarm lock', a: 'BoxGeometry#0', b: 'CylinderGeometry#6', why: 'lock lever on its pivot post (index moved 4→6 when TODO 24 added the beak riser+nose to the lever)' },
  { unit: 'Alarm lock', a: 'BoxGeometry#2', b: 'CylinderGeometry#6', why: 'lever tail on the same post' },
  { unit: 'Alarm lock', a: 'BoxGeometry#0', b: 'alarmLockSpring', why: '§102: the return blade\'s tip pressing the arm\'s wheel-side flank — the §48-declared spring contact (a 0.05 preload overlap at the lifted pose, deeper as the column presses the lever engaged)' },
  { unit: 'Alarm switch', a: 'alarmColWheel', b: 'CylinderGeometry#3', why: 'column wheel on its stud' },
  { unit: 'Alarm switch', a: 'BoxGeometry#4', b: 'CylinderGeometry#6', why: 'click arm on its pivot stud' },
  { unit: 'Alarm switch', a: 'BoxGeometry#4', b: 'CylinderGeometry#7', why: 'click arm at its second stud' },
  { unit: 'Alarm switch', a: 'BoxGeometry#4', b: 'switchClickSpring', why: 'the detent blade pressing the click arm — §48-declared spring contact' },
  // Both were 'CylinderGeometry#0' until TODO 11 tranche five named the post
  // (see the strike sleeve above for why that stales a row).
  { unit: 'Alarm link', a: 'alarmLinkBeakBar', b: 'alarmLinkBeakPost', why: 'beak lever on its pivot post' },
  { unit: 'Alarm link', a: 'alarmLinkBeakTail', b: 'alarmLinkBeakPost', why: 'beak tail on the same post' },
  { unit: 'Alarm link', a: 'alarmLinkShaft', b: 'LatheGeometry#9', why: 'lay shaft in hanger bush 1 — the running bearing (TODO 16 owns the stations)' },
  { unit: 'Alarm link', a: 'alarmLinkShaft', b: 'LatheGeometry#11', why: 'lay shaft in hanger bush 2' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#43', b: 'CylinderGeometry#39', why: 'the minute-arbor pair\'s other wheel, same shaft as #44 (this row measures MARGINAL — flag flips run-to-run at the d≈1e-4 boundary; the joint is real either way)' },
  // §99 found the other two joints of the same cluster, the same way the
  // declared row below found its first: the two wheels keyed to the long
  // keyless arbor sit at the measurement boundary and the flag flips
  // run-to-run (measured on pristine main: present in one run, absent in
  // the next, wandering across poses). The joints are real — wheels
  // pressed on their arbor, the power-reserve convention — and declaring
  // them is what stops the battery flickering on float noise.
  { unit: 'Keyless works', a: 'ExtrudeGeometry#41', b: 'CylinderGeometry#38', why: 'crown-end wheel pressed on the long keyless arbor (d≈1e-4 marginal, like its neighbour row)' },
  { unit: 'Keyless works', a: 'ExtrudeGeometry#42', b: 'CylinderGeometry#38', why: 'centre-end wheel pressed on the same arbor (same marginal cluster)' },
  { unit: 'Maintaining detent', a: 'click', b: 'CylinderGeometry#3', why: 'click on its pivot stud' },
  { unit: 'Dial', a: 'alarmIndexWedge', b: 'ShapeGeometry#3', why: '§34\'s index wedge stands proud THROUGH the face sheet by design — the face is a zero-volume decal plane, not stock (note: parity containment is undefined on open sheets; the crossing itself is real)' },
  { unit: 'Minute jumper', a: 'jumperBeak', b: 'CylinderGeometry#3', why: 'beak lever on its pivot stud' },
  { unit: 'Minute jumper', a: 'BoxGeometry#1', b: 'CylinderGeometry#3', why: 'lever body on the same stud' },
  { unit: 'Minute jumper', a: 'jumperBeak', b: 'jumperClickSpring', why: 'return spring bearing on the beak — §48-declared spring contact' },
  { unit: 'Minute jumper', a: 'BoxGeometry#1', b: 'jumperClickSpring', why: 'spring coil around the lever body at the stud' },
  { unit: 'Minute jumper', a: 'jumperTailPin', b: 'jumperClickSpring', why: 'the tail pin the spring\'s working end presses' },
  { unit: 'Power-reserve train', a: 'ExtrudeGeometry#0', b: 'CylinderGeometry#1', why: 'input wheel pressed on its arbor' },
  { unit: 'Power-reserve train', a: 'ExtrudeGeometry#2', b: 'CylinderGeometry#5', why: 'intermediate wheel on its stud' },
  { unit: 'Power-reserve train', a: 'ExtrudeGeometry#4', b: 'CylinderGeometry#5', why: 'its pinion, same stud — the wheel+pinion pair' },
  // §94 tier C named the arbor for the floors rows, and this row's `b`
  // followed it: the selector was the mesh's index label (CylinderGeometry#8)
  // only because the mesh had no name, and a label is not a stable ID —
  // the full battery caught the stale selector as an undeclared
  // intersection the moment the name landed (the couple-by-string trap,
  // fired exactly as designed).
  { unit: 'Power-reserve train', a: 'ExtrudeGeometry#6', b: 'rsvHandArbor', why: 'differential wheel on its stud' },
  { unit: 'Alarm setting idler', a: 'ExtrudeGeometry#1', b: 'CylinderGeometry#3', why: 'idler wheel on its stud' },
  { unit: 'Alarm hammer', a: 'alarmHammerArm', b: 'alarmHammerPost', why: 'hammer arm riveted to the arbor boss' },
  { unit: 'Alarm hammer', a: 'alarmTail', b: 'alarmHammerPost', why: 'hammer tail on the same boss' },
  { unit: 'Alarm hammer', a: 'alarmHammerSpring', b: 'alarmHammerSpringStud', why: 'hammer spring anchored on its stud — §48-declared' },
  { unit: 'Alarm striking wheel', a: 'alarmLockCollar', b: 'CylinderGeometry#0', why: 'lock collar pressed on the strike arbor' },
  { unit: 'Alarm release lifter', a: 'alarmLifterBlade', b: 'CylinderGeometry#8', why: 'return blade root anchored at the bracket post — §48\'s slaved-blade convention' },
  { unit: 'Alarm switch', a: 'alarmColWheel', b: 'alarmPusherPawl', why: 'the pawl PARKS ON the kiss — its leading face is derived onto the saw outline (ratchetPoly) and alarmHandoffs asserts the kiss every run' },
  // Surfaced the moment the signature above started reading geometry swaps
  // (TODO 1). Both are the hairspring's two ends, and both were always there:
  // the breathing spiral is a mover by morph, and the parts it is pinned
  // BETWEEN are exactly the parts a spiral has to be pinned between.
  { unit: 'Hairspring', a: 'TubeGeometry#0', b: 'CylinderGeometry#1', why: 'the spiral\'s inner coil is pinned to the COLLET it turns with — makeHairspring starts the curve at the collet radius, so the two share that surface by construction' },
  { unit: 'Hairspring', a: 'TubeGeometry#0', b: 'TubeGeometry#2', why: 'the raised terminal curve continues from the spiral\'s outer end — one ribbon, two meshes, joined end to end at the fixed outer angle' },
  // §104 — the governor's declared joints. Two axes, each the striking
  // side's own idiom: rotating members drawn coincident over their static
  // studs (the strike sleeve's "one shaft, two meshes"), and the strike
  // arbor's stud grown by a second turned length behind its new wheel.
  { unit: 'Alarm striking wheel', a: 'alarmGovSleeve', b: 'CylinderGeometry#0', why: '§104: the governor-wheel sleeve is the strike arbor\'s next turned step over its stud — one shaft, two meshes; §112: the sleeve over the stud, one full-column post since the tier-split retired the upper length (§121 collapsed the two duplicate rows into this one, both citations kept)' },
  { unit: 'Alarm striking wheel', a: 'alarmGovWheel', b: 'CylinderGeometry#0', why: '§104/§112: the 64T wheel\'s hub ring around the stud it turns on — running fit drawn coincident at the hub\'s inner band' },
  // §111 — these three rows used to say "coincident solids are the bearing".
  // They no longer have to: both governor arbors are BORED, the way every
  // upper pivot in the going train is, so each stud occupies a real hole and
  // what these rows declare is the side-shake of a running fit rather than
  // two bodies sharing space. The gap is PIVOT_BORE_CLEAR, under CLEAR_MARGIN
  // by design, which is why the declaration is still owed.
  { unit: 'Alarm governor', a: 'alarmGovArbor', b: 'alarmGovStud', why: '§111: the governor arbor turns on its stud in a bore cut PIVOT_BORE_CLEAR wider than it — addUpperPivot\'s fit, on the movement\'s fastest arbor. §120 turned the stud into a POST: the arbor now runs between a foot collar and a formed head, floating half of ALARM_GOV_END_SHAKE off each, so this row is a running fit in three directions rather than two' },
  { unit: 'Alarm governor', a: 'alarmGovPinion', b: 'alarmGovStud', why: '§111: the pinion is driven on that arbor and shares its bore, so it clears the stud by the same PIVOT_BORE_CLEAR — the running fit at the leaf root; §120: and it stands clear over the post\'s foot collar, which is what the arbor beneath it lands on' },
  { unit: 'Alarm governor anchor', a: 'alarmGovAnchorArbor', b: 'alarmGovAnchorStud', why: '§111: the anchor\'s arbor turns on its own stud in the same bore, ring below and anchor above (§107 moved the row with the unit: stud and arbor are both the anchor\'s now). §120: the same turned post — collar, bearing length, head — so the anchor is located axially too' },

  // §121 — the FF and MM tiers' first triage, the alarm complex (the gated
  // INTRA_TIER_SCOPE). Every row below was measured before it was declared:
  // tools/probe-121-depth.mjs re-took each flagged pair with the check's own
  // parity and reports the contained fraction and depth its why cites, so
  // "lapped"/"seated"/"kiss" are readings, not impressions. Zero rows in
  // this population are defects — the alarm complex has been through the
  // §29→§120 instrument passes, and what those left are joints and working
  // contacts nobody had to declare while no instrument could see them.
  //
  // Alarm setting arbor — the §22/§23 setting-cock furniture:
  { unit: 'Alarm setting arbor', a: 'CylinderGeometry#3', b: 'alarmArborCockArm', why: '§121: the setting cock\'s arm pressed on its pillar (0.13 of the pillar 0.15 deep in the arm — a seated post, TODO 12\'s cock idiom)' },
  { unit: 'Alarm setting arbor', a: 'alarmArborCockArm', b: 'alarmArborCockBush', why: '§121: the bush pressed into the cock arm\'s eye — §23\'s bearing-cock convention, arm ends at its ring' },
  // Alarm release lifter — §103's derived guide stack:
  { unit: 'Alarm release lifter', a: 'CylinderGeometry#8', b: 'BoxGeometry#9', why: '§121: guide pin seated in its bracket arm (kiss at d<1e-4 — a designed seat, not a foul)' },
  { unit: 'Alarm release lifter', a: 'CylinderGeometry#12', b: 'BoxGeometry#14', why: '§121: the mid-guide post in its upper cheek block (§103\'s stack — the cheek is one of the two guidance stations)' },
  { unit: 'Alarm release lifter', a: 'CylinderGeometry#12', b: 'BoxGeometry#15', why: '§121: the same post socketed in the lower cheek block (0.44 of the post in the block — the socket)' },
  { unit: 'Alarm release lifter', a: 'alarmLifterPlunger', b: 'alarmLifterBlade', why: '§121: the blade rooted in the plunger — §103: the stack derives downward, blade root rides the stub' },
  { unit: 'Alarm release lifter', a: 'CylinderGeometry#2', b: 'alarmLifterBlade', why: '§121: the plunger EYE the blade runs through — §103\'s first guidance station; a working slide, not a joint' },
  // Alarm gong — §56:
  { unit: 'Alarm gong', a: 'alarmGongArc', b: 'alarmGongPost', why: '§121: the wire\'s foot brazed to its post — the gong\'s ONLY fixing (§56: the far end rings free, and the clamped-free bar is the voice)' },
  // Alarm click — §99's click on its post:
  { unit: 'Alarm click', a: 'alarmClickSpring', b: 'CylinderGeometry#4', why: '§121: the click spring\'s coiled anchor around its post (§99\'s click — the spring is the pawl\'s return)' },
  { unit: 'Alarm click', a: 'alarmClickSpring', b: 'CylinderGeometry#5', why: '§121: the same coiled anchor against the post\'s cap collar above it' },
  { unit: 'Alarm click', a: 'CylinderGeometry#4', b: 'CylinderGeometry#5', why: '§121: post and cap collar — one turned piece modeled as two, stacked flush (deep 0 both ways)' },
  // Alarm lock — §102's return:
  { unit: 'Alarm lock', a: 'alarmLockSpringStud', b: 'alarmLockSpring', why: '§121: §102\'s return blade riding its stud (kiss) — the blade the column works against; restoring\'s sprung row for this unit' },
  // Alarm switch — §28/§33's column work and pusher:
  { unit: 'Alarm switch', a: 'CylinderGeometry#6', b: 'CylinderGeometry#7', why: '§121: the detent post and its second turned step — one post, two diameters' },
  { unit: 'Alarm switch', a: 'CylinderGeometry#6', b: 'switchClickSpring', why: '§121: the switch click spring anchored on the detent post (kiss)' },
  { unit: 'Alarm switch', a: 'CylinderGeometry#9', b: 'alarmPusherRiser', why: '§121: the riser lapped onto the pusher stem (0.5 of the riser 0.21 into the stem — the joint that carries the push)' },
  { unit: 'Alarm switch', a: 'CylinderGeometry#9', b: 'TorusGeometry#14', why: '§121: the return coil seated round the pusher stem (§33\'s handle return)' },
  { unit: 'Alarm switch', a: 'alarmPusherPawl', b: 'alarmPusherReach', why: '§121: the pawl lapped on the reach bar (flush faces, deep 0)' },
  { unit: 'Alarm switch', a: 'alarmPusherRiser', b: 'alarmPusherReach', why: '§121: the riser lapped on the reach bar — the pusher\'s own three-piece assembly' },
  { unit: 'Alarm switch', a: 'alarmColWheel', b: 'BoxGeometry#4', why: '§121: the detent arm riding the column wheel (kiss) — §28\'s column work; a working contact, bounded by the TODO 59 read assert at the click build and swept through a whole pitch by tools/probe-59-click' },
  // TODO 59: this row USED to say "its budget the switch's own asserts", and no
  // such assert had ever been written — a declaration pointing at a check that
  // does not exist reads as triaged, which is worse than an admitted gap. The
  // assert exists now (it holds the two things the mechanism CLAIMS: fully out
  // over a column, fully home in a gap), and the depth through the flank — the
  // part no pose can reach, since setPose banks the wheel to integer steps — is
  // measured by probe-59-click: 0 buried samples of 121 across a full pitch,
  // worst clearance 0.0052, against 30 of 121 and a worst burial of 0.699 under
  // the height-as-radius law this replaced.
  { unit: 'Alarm switch', a: 'alarmColWheel', b: 'SphereGeometry#5', why: '§121: the detent BALL on the column wheel\'s ramps (kiss) — the star detent that indexes the column; TODO 59 re-derived its radius from the wall and the top corner it rides, and probe-59-click sweeps the pitch' },
  // Alarm link — §45's corner stations and the crank:
  { unit: 'Alarm link', a: 'LatheGeometry#9', b: 'BoxGeometry#10', why: '§121: corner post socketed in its turned foot — §45\'s bevel-corner station, the motion-works arbor\'s template' },
  { unit: 'Alarm link', a: 'LatheGeometry#11', b: 'BoxGeometry#12', why: '§121: the second corner, same construction' },
  { unit: 'Alarm link', a: 'alarmLinkBeakTail', b: 'alarmLinkRod', why: '§121: the beak\'s tail formed on the rod (kiss under the alarm pose) — one member, two meshes' },
  { unit: 'Alarm link', a: 'alarmLinkCrankRim', b: 'alarmLinkRod', why: '§121: the rod\'s end in the crank rim\'s eye — the crank joint the arming run turns' },
  // Alarm disc — the §34/§48 follower assembly on the flange:
  { unit: 'Alarm disc', a: 'CylinderGeometry#4', b: 'BoxGeometry#5', why: '§121: the follower bar lapped on its pivot rivet' },
  { unit: 'Alarm disc', a: 'CylinderGeometry#4', b: 'BoxGeometry#7', why: '§121: the follower\'s nose bar lapped on the same rivet — the bar\'s two pieces share it' },
  { unit: 'Alarm disc', a: 'LatheGeometry#1', b: 'BoxGeometry#10', why: '§121: the follower-spring stud block seated on the flange ring' },
  { unit: 'Alarm disc', a: 'alarmPivotPost', b: 'alarmFollowerBar', why: '§121: the follower bar turning ON its post — the §48 follower\'s bearing (0.16 of the post in the bar\'s eye)' },
  { unit: 'Alarm disc', a: 'LatheGeometry#1', b: 'alarmFollowerSpringStud', why: '§121: the stud flush on the flange ring (deep 0 — a planted foot)' },
  // Alarm selector — §34's fork on its post:
  { unit: 'Alarm selector', a: 'alarmSelTab', b: 'alarmSelPost', why: '§121: the tab lapped on the selector post' },
  { unit: 'Alarm selector', a: 'alarmSelForkBracket', b: 'alarmSelPost', why: '§121: the fork bracket lapped on the same post — the selector\'s two riders share their pivot' },
  // Alarm setting idler — §15's chain:
  { unit: 'Alarm setting idler', a: 'alarmSetIdler', b: 'alarmSetIdler', why: '§121: the i1⇄i2 working mesh (tooth kiss, deep 0) — TODO 15\'s phase solve owns it; both gears carry one name, which is why one row names it twice' },
  // Alarm silence rocker — §94's rocker:
  { unit: 'Alarm silence rocker', a: 'BoxGeometry#0', b: 'BoxGeometry#5', why: '§121: a fork prong rooted in the rocker bar' },
  { unit: 'Alarm silence rocker', a: 'BoxGeometry#0', b: 'BoxGeometry#6', why: '§121: the second prong, same root' },
  { unit: 'Alarm silence rocker', a: 'BoxGeometry#0', b: 'alarmSilPivot', why: '§121: the rocker bar on its pivot (kiss — the running fit)' },
  { unit: 'Alarm silence rocker', a: 'BoxGeometry#0', b: 'alarmSilBlade', why: '§121: the blade rooted in the rocker bar' },
  // Alarm hammer — §48's return:
  { unit: 'Alarm hammer', a: 'alarmTail', b: 'alarmHammerSpring', why: '§121: the return spring pressing the tail (0.5 of the spring\'s tip 0.05 into the tail\'s face band) — §48\'s sprung row; the spring law is TODO 14\'s open note' },
  // Alarm barrel — TODO 1's morphing ribbon, the tier\'s singleton-frame rule at work:
  { unit: 'Alarm barrel', a: 'ExtrudeGeometry#1', b: 'mainspringRibbon', why: '§121: the wound coil bearing on the drum wall — where a mainspring\'s outer coil rests by design; the ribbon is a MORPH, always its own frame, which is exactly how this pair reached the MM tier' },
  { unit: 'Alarm barrel', a: 'mainspringHook', b: 'mainspringRibbon', why: '§121: the hook formed on the ribbon\'s outer end — the drum\'s mirror row (mainspringHook ⇄ ExtrudeGeometry#0 above) made the same argument' },
  // Alarm winding train — TODO 15's solved chain:
  // §129 — the subtractor's own working contacts. Each is a mesh or a bearing
  // this unit is BUILT around, so each is a declared joint rather than a foul:
  // the two legs into the spider, the spider's planets on both sides, the cage
  // out to the Geneva, and the pin in the cross's slot — which is the one the
  // whole mechanism exists to make.
  { unit: 'Alarm winding arrest', a: 'genevaFingerPin', b: 'alarmArrestCross', why: '§129: the Geneva pin in its slot — the working contact the stop-work IS, measured shut at the bank (pin⇄cross 0 at the ceiling) and clear of the metal everywhere else in the travel' },
  { unit: 'Alarm winding arrest', a: 'genevaFingerDisc', b: 'alarmArrestCross', why: '§129: the LOCKING half of the same mechanism — between indexings the finger\'s disc rides in the cross\'s hollow and holds it still, which is what stops a Geneva drifting off station. makeGenevaFinger cuts that disc TO the cross\'s swept envelope, so the pair touches at zero by construction: measured 0 containment and 0 depth both ways at alarmStrike f=0.75 (§121\'s kiss, a designed seat)' },
  { unit: 'Alarm winding arrest', a: 'spiderSideA', b: 'spiderPlanet0', why: '§129: side A on a planet — the differential mesh; α = ½ is this contact and its mirror' },
  { unit: 'Alarm winding arrest', a: 'spiderSideA', b: 'spiderPlanet1', why: '§129: side A on the second planet, same mesh at the other end of the cross' },
  { unit: 'Alarm winding arrest', a: 'spiderSideB', b: 'spiderPlanet0', why: '§129: side B on a planet — the other half of the subtraction' },
  { unit: 'Alarm winding arrest', a: 'spiderSideB', b: 'spiderPlanet1', why: '§129: side B on the second planet' },
  { unit: 'Alarm winding arrest', a: 'spiderPlanet0', b: 'spiderStub0', why: '§129: a planet running on its stub pin in the cage — a bearing, not a foul' },
  { unit: 'Alarm winding arrest', a: 'spiderPlanet1', b: 'spiderStub1', why: '§129: the second planet on its stub' },
  { unit: 'Alarm winding arrest', a: 'spiderCageWheel', b: 'subFingerPinion', why: '§129: the cage\'s wheel driving the Geneva\'s pinion — the ×2 output stage, TODO 15\'s phase solve owns it. The cage IS that wheel: the output cannot leave up the axis, because leg B\'s pinion is concentric with any such tube' },
  { unit: 'Alarm winding arrest', a: 'spiderCageWheel', b: 'alarmArrestArbor', why: '§129: the cage running on the tower\'s arbor — the bearing the whole differential turns on' },
  { unit: 'Alarm winding arrest', a: 'spiderSideA', b: 'spiderCageWheel', why: '§129: side A seated in the cage — a side gear runs inside its own cage, which is what a cage is for' },
  { unit: 'Alarm winding arrest', a: 'spiderCageWheel', b: 'spiderSideB', why: '§129: side B seated in the cage, the mirror of side A' },
  { unit: 'Alarm winding arrest', a: 'subIdlerPinion', b: 'subLegBPinion', why: '§129: the compound idler driving leg B — the mesh that carries the reversed sign into the spider' },
  { unit: 'Alarm winding train', a: 'alarmClimbPinion', b: 'alarmWindIdler', why: '§121: the climb pinion\'s working mesh into i1 — TODO 15\'s phase solve owns it (gap against tooth, measured)' },
  { unit: 'Alarm winding train', a: 'alarmWindIdler', b: 'alarmWindIdler', why: '§121: the i1⇄i2 working mesh, same solve — both idlers carry §99\'s one name, so the row names it twice' },
  // Alarm release feeler — §29's tail run:
  { unit: 'Alarm release feeler', a: 'BoxGeometry#8', b: 'BoxGeometry#9', why: '§121: the §29 tail RUN sliding through its cheek mid-guide (kiss at cam poses) — §103\'s second guidance station' },
];
// Accepted debt, §50's convention — red in the report, cited, not silenced:
export const INTRA_UNIT_WAIVERS = [
  // TODO 22 closed with the switch resize: the press axis rides above the
  // wheel's stack and the stem's inner end is press-swept derived — the
  // instrument measures the repair (0 rows).
  // TODO 23's nine rows are CLOSED: cock/guide arms now end at their
  // ring's outer wall, the setting cock's z derives against the bevel
  // above as well as the pinion below, and the lifter's lower guide —
  // measured unable to coexist with the blade stub's swept corridor —
  // was removed (the plunger eye + the run's cheek mid-guide are the
  // two guidance stations).
  // TODO 42's row is CLOSED (§103): the item's prescription — re-derive the
  // eye's z from the stub's rest top — had no solution with the stub held
  // at its first-cut station (the collar's pulled underside caps the
  // corridor at 0.255 against the 0.62 an eye needs; TODO 23's arithmetic,
  // one guide up, same verdict), so the whole stack derived downward
  // instead: eye top pinned to the plunger's full-depression top, stub top
  // one CLEAR_MARGIN under the eye's bottom at rest, blade root riding the
  // stub. The instrument measures the repair (0 rows).
  //
  // TODO 77 — the reserve train's two working meshes, the first rows this
  // tier gates outside the alarm complex. Both interpenetrate because
  // `gearOutlineShape` cuts straight-chord flanks with no pressure angle:
  // two non-conjugate outlines at their correct centre distance and correct
  // phase MUST interfere through the cycle, so this is the PROFILE's debt
  // (roadmap §136), not a placement error the phase solve could fix — TODO
  // 48's solve measures 0.07% of a pitch off anti-phase, which is right.
  // Measured radial overlap, swept over 41 wind states: 0.279 mm on stage
  // one, 0.621 mm on stage two. Waived rather than silenced so the unit can
  // be GATED: any interference here that is not these two rows now fails.
  { unit: 'Power-reserve train', a: 'ExtrudeGeometry#0', b: 'ExtrudeGeometry#2',
    debt: 'TODO 77: p0 ⇄ w1, the stage-one mesh — trapezoidal flanks cannot roll conjugate (roadmap §136); 0.279 mm radial overlap, measured' },
  { unit: 'Power-reserve train', a: 'ExtrudeGeometry#4', b: 'ExtrudeGeometry#6',
    debt: 'TODO 77: p1 ⇄ w2, the stage-two mesh — same profile debt (roadmap §136); 0.621 mm radial overlap, measured' },
];

// §121 — the units whose FF and MM tiers are GATED: the population this
// landing's triage actually inspected, row by row (ASSEMBLY_SCOPE's shape and
// §107's argument — what is gated is what the triage supports; everything
// else's FF/MM rows are REPORTED as `outOfScope`, §48's rows-are-the-product,
// and the widening is TODO 5's filed remainder). The MF tier stays gated over
// EVERY unit — its population was triaged when the tier landed (2026-08-01)
// and nothing that was gated may become ungated. The first §121 sweep found
// 259 rows across 46 unit×tier buckets, quadruple the 2026-08-01 session;
// the scope is the alarm complex — the §107 home turf where the class bit
// three times — plus the governor pair the item was prioritised over.
export const INTRA_TIER_SCOPE = [
  'Alarm governor', 'Alarm governor anchor', 'Alarm striking wheel',
  'Alarm barrel', 'Alarm click', 'Alarm winding train',
  'Alarm link', 'Alarm lock', 'Alarm hammer', 'Alarm gong',
  'Alarm switch', 'Alarm selector', 'Alarm disc',
  'Alarm release lifter', 'Alarm release feeler', 'Alarm silence rocker',
  'Alarm setting arbor', 'Alarm setting idler',
  // §129 — the subtractor put four rotating bodies on one arbor and three
  // stations in one unit, which is exactly the population this tier exists for
  // and exactly what the pair sweep cannot see. TODO 55 named adding it as
  // owed; it goes in WITH the re-gearing rather than before it, because the
  // tier goes red on the shipped fault the moment it is in scope.
  'Alarm winding arrest',
  // TODO 77 — the FIRST unit in this scope that is not part of the alarm
  // complex, added because the owner saw through the movement what the tier
  // had been reporting past: the reserve train's two meshes interpenetrate.
  // It goes in the way §129's entry above went in — knowing the tier goes
  // red on the shipped fault the moment the unit is in scope — with the two
  // rows waived against TODO 77 rather than the scope left narrow to keep
  // the report quiet. That is the trade this list exists to make: a fault
  // inside the gate and cited beats a fault outside it and counted.
  'Power-reserve train',
];
// The rigid-frame signature, shared by checkIntraUnit's MM tier and
// checkAssembly (hoisted from the latter, §121 — one predicate, two
// consumers). Under one rigid motion T every mesh of the body satisfies
// M_p = T · M_0, so the delta M_p · M_0⁻¹ is the SAME matrix for every
// member however far apart it sits. The comparison is a TOLERANCE, not
// string equality: the delta is only algebraically identical across a body —
// the cancellation is computed, so a member sitting further out carries more
// float error than one at the hub, and rounded-string keys measurably split
// real bodies (both anchor arms, the governor-wheel sleeve).
export const FRAME_TOL = 1e-4;
export const sameFrame = (p, q) => {
  for (let i = 0; i < p.length; i++) if (Math.abs(p[i] - q[i]) > FRAME_TOL) return false;
  return true;
};
// Cluster meshes into frames by their accumulated traces. `singletons` names
// meshes that must be their own frame regardless of matrix (§121: morphs —
// a mesh that swaps geometry moves its SURFACES without moving its matrix,
// so the matrix trace would merge two still morphs into one "frame" and the
// MM tier would never compare them).
export function clusterByFrame(meshes, trace, singletons = new Set()) {
  const groups = [];        // [{ rep, meshes }] — one entry per rigid frame
  for (const m of meshes) {
    if (singletons.has(m)) { groups.push({ rep: null, meshes: [m] }); continue; }
    const t = trace.get(m);
    const g = groups.find((x) => x.rep && sameFrame(x.rep, t));
    if (g) g.meshes.push(m); else groups.push({ rep: t, meshes: [m] });
  }
  return groups;
}

export async function checkIntraUnit(clock, { axes = AXES, samplesPerAxis = 5, yieldEvery = 16, contacts = INTRA_UNIT_CONTACTS } = {}) {
  const units = collectUnits(clock, { includeExcluded: true });
  const _m = new THREE.Matrix4();
  // A MORPH IS MOTION. The signature carries the mesh's geometry identity as
  // well as its unit-relative matrix, because a part can change where its
  // surfaces are without changing its matrix at all: the mainspring's ribbon
  // (TODO 1) redistributes its coils by swapping a precomputed wind frame, and
  // the hairspring breathes the same way. On the matrix alone both read as
  // FIXTURES, and this check only ever compares movers against fixtures — so
  // the moment TODO 1 replaced the ribbon's rigid rotation with the honest
  // morph, the ribbon would have dropped out of the instrument's sight
  // entirely. geometry.id is a monotonic per-BufferGeometry counter, so a swap
  // moves the signature by at least 1 and the 1e-6 threshold below sees it.
  const relSig = (unit, mesh) => {
    _m.copy(unit.obj.matrixWorld).invert().multiply(mesh.matrixWorld);
    let s = mesh.geometry.id;
    for (let i = 0; i < 16; i++) s += _m.elements[i] * (i + 1);
    return s;
  };
  // pose set: endpoints + interior samples of every axis (the stop-lever
  // class is present at EVERY pose; a coarse net catches standing fouls,
  // which is the interim's whole claim — transients stay item 7's business)
  const poses = [];
  for (const axis of axes) {
    for (let i = 0; i < samplesPerAxis; i++) poses.push([axis, i / (samplesPerAxis - 1)]);
  }
  // 1. classify: movers change their unit-relative matrix at ANY pose — and
  //    the same lap accumulates each mesh's WORLD-motion trace (M_p · M_0⁻¹,
  //    checkAssembly's signature) so the MM tier can cluster movers into
  //    rigid frames without a second walk, plus a `morphed` set (geometry.id
  //    changed vs base) for clusterByFrame's singleton rule.
  const base = new Map();
  const worldBase = new Map();  // mesh → M_0⁻¹, for the frame trace
  const baseGeoId = new Map();  // mesh → geometry.id at the base pose
  enterAxis(clock);             // TODO 54 — the base pose is canonical too, or every delta is measured from session history
  clock.setPose(poses[0][0].pose(0, clock));
  for (const u of units) for (const m of u.meshes) {
    base.set(m, relSig(u, m));
    worldBase.set(m, m.matrixWorld.clone().invert());
    baseGeoId.set(m, m.geometry.id);
  }
  const movers = new Set();
  const morphed = new Set();
  const trace = new Map();      // mesh → concatenated delta elements, pose by pose
  let n = 0;
  let axisNow = null;
  for (const [axis, f] of poses) {
    if (axis !== axisNow) { enterAxis(clock); axisNow = axis; }   // TODO 54 — canonical entry per axis
    clock.setPose(axis.pose(f, clock));
    for (const u of units) {
      for (const m of u.meshes) {
        _m.copy(m.matrixWorld).multiply(worldBase.get(m));
        const acc = trace.get(m) ?? [];
        for (let i = 0; i < 16; i++) acc.push(_m.elements[i]);
        trace.set(m, acc);
        if (m.geometry.id !== baseGeoId.get(m)) morphed.add(m);
        if (movers.has(m)) continue;
        if (Math.abs(relSig(u, m) - base.get(m)) > 1e-6) movers.add(m);
      }
    }
    if (++n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const allowed = (u, la, lb) => contacts.some((c) => c.unit === u
    && ((c.a === la && c.b === lb) || (c.a === lb && c.b === la)));
  // NEAREST-UNIT DEDUPE (§121). collectUnits does no nested-label exclusion —
  // a label inside another unit puts its meshes in BOTH (the Dial holds the
  // whole alarm-disc stack this way) — so without this, every pair inside a
  // nested unit is reported twice under two unit names and would need two
  // declared rows saying one thing. A pair belongs to the SMALLEST unit that
  // contains both meshes: that is where its parts live, where its declared
  // row is actionable, and the same argument RESTORING_WAIVERS records for
  // the parity axis ("22 are ALSO claimed by a nearer unit and are correctly
  // deduped away"). Strictly smaller, so a tie keeps both rather than
  // silently dropping one.
  const unitsOf = new Map();  // mesh → [units containing it]
  for (const u of units) for (const m of u.meshes) (unitsOf.get(m) ?? unitsOf.set(m, []).get(m)).push(u);
  const nearestElsewhere = (u, a, b) => unitsOf.get(a).some((v) => v !== u
    && v.meshes.length < u.meshes.length && unitsOf.get(b).includes(v));
  // The one arbitration guard all three tiers share. pointInsideTree throws
  // on geometry carrying no normals; a throw here must assume NOTHING —
  // checkAssembly's "assume joined" default exists because inventing a
  // fracture is ITS unsafe direction, and inventing a collision is this
  // check's, so an unmeasurable pair becomes a REPORTED row and never a
  // verdict in either direction.
  const unmeasurable = [];
  const verdict = (a, b, u, tier, la, lb) => {
    try { return meshesIntersect(a, b); }
    catch (e) {
      unmeasurable.push({ unit: u.name, tier, a: la, b: lb, err: String(e).slice(0, 80) });
      return false;
    }
  };
  // FF/MM pairs carry no mover-first asymmetry, so their keys sort the labels;
  // the MF key keeps its historical mover-first order (same rows as ever).
  const seen = new Map(); // key → row (first flagging pose kept)
  const tiers = { MF: 0, FF: 0, MM: 0 };  // candidate pairs per tier, the coverage figure

  // 2. tier MM prep: cluster each unit's movers into rigid frames (morphs
  //    always singleton), enumerate the CROSS-frame pairs once. Same-frame
  //    pairs are one part — checkAssembly's business, not this tier's.
  const mmPairs = new Map();   // unit → [ [meshA, meshB], … ]
  let frames = 0;
  for (const u of units) {
    const mov = u.meshes.filter((m) => movers.has(m));
    if (mov.length < 2) continue;
    const groups = clusterByFrame(mov, trace, morphed);
    frames += groups.length;
    if (groups.length < 2) continue;
    const pairs = [];
    for (let gi = 0; gi < groups.length; gi++) {
      for (let gj = gi + 1; gj < groups.length; gj++) {
        for (const a of groups[gi].meshes) for (const b of groups[gj].meshes) pairs.push([a, b]);
      }
    }
    tiers.MM += pairs.length;
    mmPairs.set(u, pairs);
  }

  // 3. tier FF, ONCE, at the net's base pose: fixtures never move relative
  //    to their unit (that is what being a fixture MEANS here), so one pose
  //    is the whole answer — which is also what keeps the Dial's C(147,2)
  //    pairs affordable. Boxes are precomputed per unit, so this loop never
  //    touches the shared _cbA/_cbB scratch pair from inside another loop.
  clock.setPose(poses[0][0].pose(0, clock));
  let sinceYield = 0;
  for (const u of units) {
    const fix = u.meshes.filter((m) => !movers.has(m));
    if (fix.length < 2) continue;
    tiers.FF += fix.length * (fix.length - 1) / 2;
    const boxes = fix.map((m) => new THREE.Box3().setFromObject(m));
    for (let i = 0; i < fix.length; i++) {
      for (let j = i + 1; j < fix.length; j++) {
        if (boxDistance(boxes[i], boxes[j]) > 0) continue;
        if (nearestElsewhere(u, fix[i], fix[j])) continue;
        const la = meshLabel(u, fix[i]), lb = meshLabel(u, fix[j]);
        const key = `${u.name} / ${[la, lb].sort().join(' ⇄ ')}`;
        if (seen.has(key) || allowed(u.name, la, lb)) continue;
        if (verdict(fix[i], fix[j], u, 'FF', la, lb)) {
          seen.set(key, { unit: u.name, tier: 'FF', a: la, b: lb, at: 'base' });
        }
        if (++sinceYield >= yieldEvery) { sinceYield = 0; await new Promise((r) => setTimeout(r, 0)); }
      }
    }
  }

  // 4. tiers MF and MM at every sampled pose
  n = 0;
  for (const [axis, f] of poses) {
    clock.setPose(axis.pose(f, clock));
    for (const u of units) {
      const fix = u.meshes.filter((m) => !movers.has(m));
      const mov = u.meshes.filter((m) => movers.has(m));
      if (fix.length && mov.length) {
        for (const a of mov) {
          _cbA.setFromObject(a);
          for (const b of fix) {
            _cbB.setFromObject(b);
            if (boxDistance(_cbA, _cbB) > 0) continue;
            if (nearestElsewhere(u, a, b)) continue;
            const la = meshLabel(u, a), lb = meshLabel(u, b);
            const key = `${u.name} / ${la} ⇄ ${lb}`;
            if (seen.has(key) || allowed(u.name, la, lb)) continue;
            if (verdict(a, b, u, 'MF', la, lb)) {
              seen.set(key, { unit: u.name, tier: 'MF', mover: la, fixture: lb, at: `${axis.name} f=${+f.toFixed(2)}` });
            }
          }
        }
      }
      for (const [a, b] of mmPairs.get(u) ?? []) {
        if (nearestElsewhere(u, a, b)) continue;
        _cbA.setFromObject(a);
        _cbB.setFromObject(b);
        if (boxDistance(_cbA, _cbB) > 0) continue;
        const la = meshLabel(u, a), lb = meshLabel(u, b);
        const key = `${u.name} / ${[la, lb].sort().join(' ⇄ ')}`;
        if (seen.has(key) || allowed(u.name, la, lb)) continue;
        if (verdict(a, b, u, 'MM', la, lb)) {
          seen.set(key, { unit: u.name, tier: 'MM', a: la, b: lb, at: `${axis.name} f=${+f.toFixed(2)}` });
        }
      }
    }
    if (++n % 2 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  // MF pair coverage, for the same population figure the other tiers report
  for (const u of units) {
    const f = u.meshes.filter((m) => !movers.has(m)).length;
    const mv = u.meshes.filter((m) => movers.has(m)).length;
    tiers.MF += f * mv;
  }

  // 5. the couple-by-string guard (§121, expectedContacts' convention): a
  //    declared row whose unit or labels match NOTHING is a stale selector —
  //    the exact failure MODELING.md rule 7 records (a welded geometry
  //    changing type un-declared 14 joints with not one distance moved).
  //    Gated at 0. A row that matches but never fires stays: several rows
  //    are deliberate records of joints that measure clear.
  const labelSets = new Map(units.map((u) => [u.name, new Set(u.meshes.map((m) => meshLabel(u, m)))]));
  const unmatchedSelectors = [];
  for (const [table, row] of [...contacts.map((c) => ['INTRA_UNIT_CONTACTS', c]),
    ...INTRA_UNIT_WAIVERS.map((w) => ['INTRA_UNIT_WAIVERS', w])]) {
    const ls = labelSets.get(row.unit);
    if (!ls) { unmatchedSelectors.push({ table, ...row, miss: 'unit' }); continue; }
    for (const k of ['a', 'b']) {
      if (!ls.has(row[k])) unmatchedSelectors.push({ table, ...row, miss: row[k] });
    }
  }

  const all = [...seen.values()];
  for (const v of all) {
    const va = v.a ?? v.mover, vb = v.b ?? v.fixture;
    const w = INTRA_UNIT_WAIVERS.find((x) => x.unit === v.unit
      && ((x.a === va && x.b === vb) || (x.a === vb && x.b === va)));
    if (w) v.waived = w.debt;
  }
  console.table(all);
  // The gate/report split (§121): MF everywhere (its 2026-08-01 triage holds
  // and nothing gated may become ungated); FF/MM inside INTRA_TIER_SCOPE.
  const inGate = (v) => v.tier === 'MF' || INTRA_TIER_SCOPE.includes(v.unit);
  const live = all.filter((v) => !v.waived);
  return {
    violations: live.filter(inGate),
    outOfScope: live.filter((v) => !inGate(v)),
    waived: all.filter((v) => v.waived),
    movers: movers.size, poses: poses.length,
    tiers, frames, unmeasurable, unmatchedSelectors,
    gate: 'GATING — 0 unwaived intersections (tier MF over every unit; FF/MM inside INTRA_TIER_SCOPE) AND 0 unmatched selectors; out-of-scope FF/MM rows and unmeasurable pairs are reported (§48), and the scope widening is TODO 5\'s filed remainder',
  };
}

// ---------------------------------------------------------------------------
// §107 — the ASSEMBLY check: a RIGID GROUP must be one body.
//
// This is TODO 5's other half, and until now nothing measured it. `intraUnit`
// above compares a unit's MOVERS against that unit's FIXTURES; two meshes that
// always move together are neither of those to each other, so no instrument in
// the battery ever looked at them. §104's governor anchor shipped through that
// gap: its hub, two arms and two pallet blades all ride one pivot group, and
// blade A stood 0.236 CLEAR of the arm that carries it — an anchor in three
// pieces, rendered as a fracture, past a fully green battery. The owner saw it
// on screen, which is the failure mode this check exists to retire.
//
// The predicate is derived, not authored: meshes whose unit-relative signature
// agrees at EVERY sampled pose ride one frame, so they are one PART — and a
// part is connected metal. Because the group shares a frame, connectivity is
// pose-independent, so it is measured once and the sweep stays cheap.
//
// Two bounds on that, both deliberate, both measured rather than assumed:
//
//   · Only a MOVING frame is evidence. Every fixture in the movement shares
//     the identity frame, so "these never move relative to each other" says
//     nothing about two studs, two jewels or four pillars — run against the
//     identity frame this check reports the whole movement and means none of
//     it. A group built onto a frame that genuinely turns IS evidence: those
//     meshes were parented together on purpose, so they are one part.
//   · The gate is SCOPED. Measured over the tree, moving frames still carry
//     rows this landing has not investigated (the centre wheel's group reads
//     3 bodies at 0.058, the fork's 3 at 0.05) — real questions, none of them
//     this change's mechanism. §48's rule therefore holds: `ok` is always
//     true and the ROWS are the product, and what is gated is what the
//     population supports — the units this landing owns. Widening the scope
//     is the follow-up, filed rather than bought by declaring rows silent.
//
// A body that rides a moving frame and is separate on purpose is DECLARED in
// ASSEMBLY_SPLITS with its reason — the stockFloor convention.
// ---------------------------------------------------------------------------
// A joint is metal meeting metal: the parts are built flush or lapped, so this
// only has to absorb the BVH measure's float noise. Any real crack is orders
// above it (the §104 fracture measured 0.236, and CLEAR_MARGIN itself is 0.15).
export const ASSEMBLY_JOIN_TOL = 1e-3;
export const ASSEMBLY_SPLITS = [
  // Seeded from a measured run — each row is a group that rides one MOVING
  // frame and is separate metal on purpose. `group` is the alphabetically
  // first member label, the same string convention INTRA_UNIT_CONTACTS uses.
];
// The units held to "a rigid group is one body". §107 seeds it with the two
// the landing owns; every other unit's rows are reported, not gated.
export const ASSEMBLY_SCOPE = ['Alarm governor', 'Alarm governor anchor', 'Alarm striking wheel'];
// Accepted debt, §50's convention — red in the report, cited, never silenced.
// (TODO 44's lock-collar waiver RETIRED by §112: the tier-split re-derived
// the strike sleeve to span from the wheel's hub to the cam's underside —
// the exact turned step the item prescribed — and it now passes through
// the collar's band, so the rotor is one body and the battery measures no
// striking-wheel split to waive.)
export const ASSEMBLY_WAIVERS = [];

export async function checkAssembly(clock, {
  axes = AXES, samplesPerAxis = 3, joinTol = ASSEMBLY_JOIN_TOL, splits = ASSEMBLY_SPLITS,
  scope = ASSEMBLY_SCOPE, waivers = ASSEMBLY_WAIVERS,
} = {}) {
  const units = collectUnits(clock, { includeExcluded: true });
  const _m = new THREE.Matrix4();
  const poses = [];
  for (const axis of axes) for (let i = 0; i < samplesPerAxis; i++) poses.push([axis, i / (samplesPerAxis - 1)]);

  // 1. group by FRAME, via each mesh's own world MOTION rather than its pose.
  //    Under one rigid motion T every mesh of the body satisfies
  //    M_p = T · M_0, so the delta M_p · M_0⁻¹ is the SAME matrix for every
  //    member however far apart they sit — which is exactly the equivalence
  //    "these meshes are one part". (Signing the mesh's own matrix instead
  //    would split a body into as many groups as it has members, and signing
  //    geometry.id would split it into one group per mesh: both make the
  //    check structurally incapable of reporting anything, which is how the
  //    first cut of this function passed a movement it had never measured.)
  const base = new Map(); // mesh → M_0⁻¹
  enterAxis(clock);       // TODO 54 — canonical base, same reason as checkIntraUnit's
  clock.setPose(poses[0][0].pose(0, clock));
  for (const u of units) for (const m of u.meshes) base.set(m, m.matrixWorld.clone().invert());
  const trace = new Map();  // mesh → concatenated delta elements, pose by pose
  const moves = new Set();  // meshes whose frame is not the identity somewhere
  const _id = new THREE.Matrix4();
  let n = 0;
  let axisNow = null;
  for (const [axis, f] of poses) {
    if (axis !== axisNow) { enterAxis(clock); axisNow = axis; }   // TODO 54 — canonical entry per axis
    clock.setPose(axis.pose(f, clock));
    for (const u of units) for (const m of u.meshes) {
      _m.copy(m.matrixWorld).multiply(base.get(m));
      const acc = trace.get(m) ?? [];
      for (let i = 0; i < 16; i++) acc.push(_m.elements[i]);
      trace.set(m, acc);
      if (!moves.has(m)) {
        for (let i = 0; i < 16; i++) {
          if (Math.abs(_m.elements[i] - _id.elements[i]) > 1e-6) { moves.add(m); break; }
        }
      }
    }
    if (++n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  // Cluster the traces with a TOLERANCE rather than by string equality —
  // sameFrame/clusterByFrame, hoisted to module scope by §121 so the MM tier
  // clusters by the SAME predicate (their rationale travels with them). The
  // delta is algebraically identical across one body (M_p·M_0⁻¹ = Pivot_p·
  // Pivot_0⁻¹, the member's own local transform cancelling), but only
  // algebraically: the cancellation is computed, so a member sitting further
  // out with its own rotation carries more float error than one at the hub.
  // Keyed on rounded strings, that error splits a body across keys — measured,
  // it dropped both anchor arms and the governor-wheel sleeve out of their own
  // groups, which reads as a smaller assembly rather than a broken one. The
  // predicate is "same rigid motion", so the comparison is a tolerance.
  // (No singleton set here: assembly's question is "who rides one frame",
  // and a matrix-still morph genuinely does ride its frame.)

  // 2. connectivity, once, at the net's first pose
  clock.setPose(poses[0][0].pose(0, clock));
  const rows = [], unmeasurable = [];
  for (const u of units) {
    const groups = clusterByFrame(u.meshes, trace);
    for (const { meshes: members } of groups) {
      if (members.length < 2) continue;
      if (!members.some((m) => moves.has(m))) continue;   // identity frame — no evidence, see the header
      const parent = members.map((_, i) => i);
      const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
      // Joined = the solids actually share metal, measured triangle to
      // triangle. Deliberately NOT meshClearance: every joint is a near-zero
      // by definition, and that is exactly the branch which hands the pair to
      // sampledVerdict's parity raycast — the expensive path, and the one
      // that throws on a geometry carrying no normals. meshesIntersect is the
      // same primitive intraUnit's declared joints are measured with, so a
      // lap and a butted flush face both read as one body here too.
      for (let i = 0; i < members.length; i++) {
        _cbA.setFromObject(members[i]);
        for (let j = i + 1; j < members.length; j++) {
          if (find(i) === find(j)) continue;
          _cbB.setFromObject(members[j]);
          if (boxDistance(_cbA, _cbB) > joinTol) continue;   // cannot touch
          let joined = false;
          try {
            // Two ways to be one body, because the triangle test declines
            // some genuinely flush faces: metal shared (intersection), or
            // metal touching within the joint tolerance (distance).
            joined = meshesIntersect(members[i], members[j])
              || meshClearance(members[i], members[j], joinTol * 10) <= joinTol;
          } catch (e) {
            unmeasurable.push({ unit: u.name, a: meshLabel(u, members[i]), b: meshLabel(u, members[j]), why: String(e).slice(0, 120) });
            joined = true; // never invent a fracture out of a measurement that failed
          }
          if (joined) parent[find(i)] = find(j);
        }
      }
      const comps = new Map();
      members.forEach((m, i) => {
        const r = find(i);
        comps.set(r, [...(comps.get(r) ?? []), m]);
      });
      if (comps.size < 2) continue;
      // the number that makes the row actionable: how far the nearest two
      // bodies of this one part actually stand apart
      // Only split groups pay for a distance, and the measure is guarded: a
      // fractured body is precisely where a mesh may be odd enough to break
      // the parity raycast, and losing the number must not lose the ROW.
      const parts = [...comps.values()];
      let sep = Infinity;
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        for (const a of parts[i]) for (const b of parts[j]) {
          try { sep = Math.min(sep, meshClearance(a, b, sep)); }
          catch { _cbA.setFromObject(a); _cbB.setFromObject(b); sep = Math.min(sep, boxDistance(_cbA, _cbB)); }
        }
      }
      const labels = parts.map((p) => p.map((m) => meshLabel(u, m)).sort());
      rows.push({
        unit: u.name,
        group: labels.flat().sort()[0],
        bodies: comps.size,
        members: labels.map((l) => l.join(' + ')),
        separation: sep === Infinity ? null : +sep.toFixed(4),
      });
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  for (const r of rows) {
    const d = splits.find((s) => s.unit === r.unit && s.group === r.group && r.bodies <= s.bodies);
    if (d) r.declared = d.why;
  }
  console.table(rows);
  for (const r of rows) {
    const w = waivers.find((x) => x.unit === r.unit && x.group === r.group);
    if (w) r.waived = w.debt;
  }
  const undeclared = rows.filter((r) => !r.declared && !r.waived);
  const violations = undeclared.filter((r) => scope.includes(r.unit));
  return {
    ok: true,   // §48's rule — a report, and the rows are the product
    violations,
    outOfScope: undeclared.filter((r) => !scope.includes(r.unit)),
    scope,
    gate: 'GATING (scoped) — 0 undeclared splits among ASSEMBLY_SCOPE units: meshes riding one MOVING frame are one part, and a part is connected metal. Out-of-scope rows are reported, not gated (§48).',
    joinTol, poses: poses.length,
    undeclared, declared: rows.filter((r) => r.declared),
    waived: rows.filter((r) => r.waived), rowsChecked: rows.length,
    // Pairs whose intersection test THREW. Reported, never silent: an
    // unmeasured pair is assumed joined above, so this list is the honest
    // bound on what the gate above actually saw.
    unmeasurable,
  };
}


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
  clock.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
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

export async function checkClearances(clock, { budgets = CLEARANCE_BUDGETS, axes = AXES, coarse = 4, refineBand = 0.4, yieldEvery = 16, pairsTouching } = {}) {
  // §152 — the declared table filters, keeping the surviving rows' INDICES in
  // the full table so the harness can rebuild that order against a baseline.
  const touching = resolvePairsTouching(clock, pairsTouching);
  const keptIndices = touching
    ? budgets.map((b, i) => (touching.touches(b.a, b.b) ? i : -1)).filter((i) => i >= 0)
    : null;
  if (touching) budgets = keptIndices.map((i) => budgets[i]);
  // All budgets ride ONE sweep: each pose is set up once and every pair
  // measured at it (per-budget axis scoping handled inside the engine) —
  // previously this re-swept the full pose space once per budget.
  const pairs = budgets.map((bud) => ({
    A: unitByName(clock, bud.a),
    B: unitByName(clock, bud.b),
    axes: bud.axes,
    refineFloor: bud.min, // exact minima only needed near the budget line
  }));
  censusStart();   // §108's experiment — report-only, see the census block
  // §152 — resolveAxes here too, so every check takes an axis list the same
  // way. These two took `axes` RAW and passed it to the sweep engine, which
  // reads `axis.n` and `axis.pose`: a list of axis NAMES therefore swept zero
  // poses and reported a clean result in milliseconds. Nothing in CI passed
  // names (the battery uses the default objects, and runInspection resolves),
  // so it had never fired — it fired on the first probe that restricted these
  // two by axis, which is what an acceptance probe is for. resolveAxes over
  // the default AXES returns the same objects in the same order, so a full
  // run measures exactly what it measured before.
  const { state } = await sweepClearances(clock, pairs, { axes: resolveAxes(axes), coarse, refineBand, yieldEvery });
  const census = censusStop();
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
      meshes: capped ? undefined : (state[i].meshes ? state[i].meshes.join(' ⇄ ') : undefined), // TODO 10
      ok: capped || state[i].min >= bud.min,
    };
  });
  console.table(results);
  // §127 tier 2a — a SLICE carries its raw minima beside the formatted rows.
  // The row's `min` is rounded to four decimals for the report, and the whole
  // run's own winner is decided on RAW floats (strict `<` at record time), so
  // a merge comparing formatted rows resolves display-precision ties by the
  // first-axis rule where the whole run had a strict raw order — caught at
  // full scale on the first 13-axis run: same 0.16 at `beat f=0` and
  // `alarmStrike f=0.6972`, wrong pose attributed. Only a narrowed run
  // carries the field, so a whole run's payload is byte-identical to what it
  // was; the merge REQUIRES it and deletes it from the merged payload.
  // Infinity does not survive JSON (page.evaluate serialises it to null), so
  // capped rows are carried as null and the merge reads null as Infinity.
  const sliced = resolveAxes(axes).length < AXES.length;
  return { violations: results.filter((r) => !r.ok), results, census,
    ...(sliced ? { rawMins: state.map((st) => (isFinite(st.min) ? st.min : null)) } : {}),
    ...(touching ? { restriction: restrictionRecord(touching, keptIndices) } : {}) };
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
    : name === 'alarm' || name === 'alarmWind' ? fromAlarm // §99: the wind axis's force is the alarm crown's hand (documentary while reachable() is undirected — every set is the connected component — but the honest source the day it grows a direction)
    : name === 'alarmStrike' ? fromAlarmSpring
    : fromSpring);
  const forceFor = (name) => (name === 'crown' ? 'crown'
    : name === 'alarm' || name === 'alarmWind' ? 'Alarm crown'
    : name === 'alarmStrike' ? 'alarm mainspring'
    : 'mainspring');
  for (const axis of axes) {
    const source = sourceFor(axis.name);
    enterAxis(clock);   // TODO 54 — canonical entry
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
  clock.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
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

// A working contact's tolerance, shared by the selector-family penetration
// budgets below and the alarmHandoffs check that owns the gap side: the
// tessellation-sag scale the finish already accepts as invisible
// (geometry.js RADIAL_SEGS: silhouette sagitta ≈ 0.03 at the largest radii).
// A truthfully modelled contact can miss exact touch by tri-tri slack of
// that order, and no more.
const HANDOFF_TRACK_TOL = 0.03;

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
    // §111 — THE GOVERNOR ESCAPEMENT'S MISSING BUDGET. The going escapement
    // has had one since the first of these rows; §104 shipped its twin one
    // train over with nothing measuring the depth of its contact at all, and
    // every cover that looks like it should have caught that has a hole in
    // exactly this shape: EXPECTED_PAIRS grants the pair a blanket excuse to
    // the overlap sweep, EXPECTED_CONTACT_FLOORS names alarmGovSaw⇄
    // alarmGovPallet as the working contact and therefore EXCLUDES it from
    // the floor, and §104's own boot assert sampled the saw's TIPS — one
    // point per tooth — so it read 0.0001 while a tooth BODY stood 0.245
    // inside pallet B for most of the cycle.
    //
    // §113 RETIRED THE WAIVER this row shipped with. §111 measured 0.286
    // against the inherited 0.1 and waived it citing TODO 45; §113 gave the
    // escapement drop (flat faces, solved swing, real free-run clearance)
    // and the row must now hold on its own: maxDepth stays the going
    // escapement's 0.1, inherited not chosen — a budget envelope is never
    // forkable (CLAUDE.md's fold rule).
    //
    // nSamples is 449 because of an aliasing trap this axis makes easy: one
    // wind is 28 strikes × ALARM_GOV_TEETH_PER_STRIKE (80) = 2240 tooth
    // periods, and the interference lives INSIDE one period. A sample count
    // sharing a factor with 2240 revisits the same handful of phases forever
    // — 240, the hammer row's count above, sees 15 of them. 449 is prime and
    // coprime to 2240, so the samples visit 449 distinct phases spread across
    // the period.
    pair: ['Alarm governor', 'Alarm governor anchor'],
    maxDepth: 0.1,
    axis: 'alarmStrike',
    nSamples: 449,
    // A = the saw wheel (the BVH side, as the escape wheel is above).
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmGovSaw') out.push(o); });
      return out;
    },
    // B = the two pallet blades, and only those: the anchor's hub, arches,
    // arbor and poising ring have no business near the wheel at all, and are
    // held to CLEAR_MARGIN by the expectedContacts row instead.
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmGovPallet') out.push(o); });
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
    // Budget DERIVED (was a bare 0.12 — 63% of the ring's 0.19 travel, wide
    // enough that touching and buried were the same measurement): a working
    // ride may interpenetrate by at most the tessellation-sag slack the
    // finish already treats as invisible, HANDOFF_TRACK_TOL. NOTE this axis
    // pins alarmOn: 1, so only the armed parity is swept here — the
    // alarmHandoffs check poses both parities and owns the gap side.
    pair: ['Alarm switch', 'Alarm link'],
    maxDepth: HANDOFF_TRACK_TOL,
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
    // §35's last contact, twice re-aimed: this row once policed the crank
    // against the RING (a mesh it never reached — clean 0 for the budget's
    // whole life), then the crank against the solid tab it transfixed.
    // TODO 20's fork made it honest: the centre PIN rides the fork's
    // groove at the ±0.01 working clearance, swept here across the full
    // co-rotating revolution. UNWAIVED — a burial past the tolerance
    // means the fork engagement broke.
    pair: ['Alarm link', 'Alarm selector'],
    maxDepth: HANDOFF_TRACK_TOL,
    axis: 'alarm',
    nSamples: 150,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmLinkCentrePin') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmSelTab') out.push(o); });
      return out;
    },
  },
  {
    // §34 pass 2b: the rocker's sensing pin on the selector ring's face —
    // the fixed⇄co-rotating interface, riding at every azimuth as the tube
    // turns. Swept on the alarm axis (a full relative revolution).
    // Budget derived (was 0.12; see the beak row): at 0.12 the pin's
    // measured 0.062 burial read as health for the life of the budget.
    // TODO 19 closed the burial — the contact is solved per tick and the
    // sweep must now hold it within the tessellation tolerance, unwaived.
    pair: ['Alarm disc', 'Alarm selector'],
    maxDepth: HANDOFF_TRACK_TOL,
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
  {
    // §99 — the click's ride over the arbor ratchet, swept on the axis that
    // exists for it (TODO 38 sequenced the axis before this click so the
    // working direction is policed from day one): 1.75 turns × 32 teeth =
    // 56 cam-outs per full wind. The pair is EXPECTED (the beak parks on
    // the saw), so the overlap sweep is structurally blind here. Budget at
    // HANDOFF_TRACK_TOL, the P2 rule — a working ride may interpenetrate by
    // at most the tessellation-sag slack the finish already treats as
    // invisible; the beak's full lift is ~1.2, so a 0.12 budget would grade
    // touching and buried as one measurement.
    pair: ['Alarm barrel', 'Alarm click'],
    maxDepth: HANDOFF_TRACK_TOL,
    axis: 'alarmWind',
    // Density inherited from the pin⇄tail row, the family's calibration:
    // 240 samples over 28 pin cycles = 8.57 per cycle; this ride has 56 saw
    // cycles, so 480 holds the same per-cycle net.
    nSamples: 480,
    // NOT mtvDepth — the §61 lesson at a click's scale: a beak seated in a
    // valley is locally wrapped, so a hair of edge contact resolves as the
    // full AXIAL pop-out (0.35 — the click's whole escape from the
    // ratchet's band, a number about the search space, not the fit).
    // Instead the pawl MESH is sampled against the ANALYTIC saw the teeth
    // were cut from (root→tip over 0.72 of the pitch, face over 0.28 —
    // main.js's sawRadiusAt twin), vertex-exact and conservative: the cut
    // chords sit BELOW the analytic profile, so mesh-vs-law reports at
    // least what metal-vs-metal would.
    measure(clock, unitA, unitB) {
      let rat = null;
      unitA.obj.traverse((o) => { if (!rat && o.isMesh && o.name === 'alarmArborRatchet') rat = o; });
      let pawl = null;
      unitB.obj.traverse((o) => { if (!pawl && o.isMesh && o.name === 'alarmClickPawl') pawl = o; });
      if (!rat || !pawl) throw new Error('click⇄ratchet ride: alarmArborRatchet or alarmClickPawl not found');
      const g = rat.parent;                        // makeRatchetAndClick's group carries teeth + r
      const N = g.userData.teeth, R = g.userData.r, rootR = R * 0.8;
      const pitch = (Math.PI * 2) / N;
      if (!rat.geometry.boundingBox) rat.geometry.computeBoundingBox();
      const zLo = rat.geometry.boundingBox.min.z, zHi = rat.geometry.boundingBox.max.z;
      const m = new THREE.Matrix4().copy(rat.matrixWorld).invert().multiply(pawl.matrixWorld);
      const pos = pawl.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      let worst = 0;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        if (v.z < zLo || v.z > zHi) continue;      // outside the saw's own band
        const r = Math.hypot(v.x, v.y);
        if (r >= R) continue;
        // §101: the arbor ratchet is a REVERSE cut, so the mesh-frame
        // mapping is u = (−az)/pitch — mirror the sign, keep the shape.
        let u = ((-Math.atan2(v.y, v.x) / pitch) % 1 + 1) % 1;
        const saw = u <= 0.72 ? rootR + ((R - rootR) * u) / 0.72 : R - ((R - rootR) * (u - 0.72)) / 0.28;
        if (saw - r > worst) worst = saw - r;
      }
      return worst;
    },
  },
  {
    // §61 — chain-on-cone, the row the file header owed since the escape-
    // wheel budgets landed (TODO 4). The pair is EXPECTED (the chain lies
    // in the cone's grooves), so the overlap sweep is structurally blind
    // here; this measures the SEATING.
    //
    // NOT mtvDepth: the chain ENCIRCLES the cone, and no translation
    // separates a ring from what it wraps — the MTV search returns
    // whichever large excursion first breaks all triangle contact (1.2+
    // measured), a number about the search space, not the fit. Instead
    // `measure` samples the chain mesh against the ANALYTIC groove floor
    // the cone was lathed from — since TODO 40, the LATHE'S OWN CLOSURE
    // (userData.groove.floorAt), not a reconstruction. This row used to
    // rebuild the floor as a straight chord from rLarge/rSmall, which was
    // the same law only while the flank was straight: on the equalising
    // hyperbola (convex, below every chord) the rebuilt floor sat ~1.3
    // OUTSIDE the metal at mid-band, and the row measured that gap as
    // burial. Holding the closure makes "the cut and the check share one
    // law" true by identity. Registration-free — a pure function of z —
    // which is also its honest limit: the wrap's rotational phase against
    // the cone's spiral is display-approximate (the chain is not torque-
    // coupled; TODO 1/7), so groove-vs-land axial registration is not
    // asserted here.
    //
    // Budget DERIVED, and SMALLER than it was. The old first term — the
    // rigid vertical stack's lower corner sitting slope·stack/2 =
    // (4.8/2.78)·0.33 = 0.57 below a floor that follows the flank — is
    // gone BY THE RELIEF'S DEFINITION: the floor is now cut to clear
    // exactly that corner (since §124, the corner-locus floor at the
    // link's own TILT — at β = 0 it is TODO 40's shear verbatim), so the
    // ideal wrap box touches it and owes it nothing. What remains:
    // (1) link chording — and §124 measured the honest chord: the outer
    // plates' stadium arc apexes reach 0.253 past each rivet, so the
    // rigid facet spans 2.41, not the 1.9 pitch. chord²/(8·r_min) =
    // 2.41²/(8·3.2133) = 0.226 at the smallest wrap radius (3.2133 =
    // FUSEE_TORQUE_K by the equalisation identity, since TODO 32's law,
    // re-solved by §150's conserving cut — the wrap's top, not the
    // runout tip); (2) HANDOFF_TRACK_TOL
    // tessellation slack, 0.03. The tilted wrap measures 0.218 at
    // reserve 0.883 — the chording bound minus what the tilt's deeper
    // curvature relief gives back — held at 0.25 so the row polices the
    // relationship, not float luck — the same round-up that held 0.76
    // at 0.8, at a third of the size.
    pair: ['Fusee & great wheel', 'Chain'],
    maxDepth: 0.25,
    axis: 'reserve',
    nSamples: 60,
    measure(clock, unitA, unitB) {
      let fus = null;
      unitA.obj.traverse((o) => { if (!fus && o.userData && o.userData.groove) fus = o; });
      let chain = null;
      unitB.obj.traverse((o) => { if (!chain && o.isMesh) chain = o; });
      // Loud, not NaN: a silent non-finite depth reads as a clean 0 in the
      // worst-tracking, which is exactly how this row's first run lied.
      if (!fus || !chain) throw new Error('chain-on-cone seating: groove userData or chain mesh not found');
      const { floorAt } = fus.userData.groove;
      // Loud again, and for the same reason: falling back to a rebuilt
      // straight-chord floor here is exactly the drift this row already
      // committed once.
      if (typeof floorAt !== 'function') throw new Error('chain-on-cone seating: userData.groove.floorAt missing — the cut and the check must hold one law');
      const toLocal = fus.matrixWorld.clone().invert().multiply(chain.matrixWorld);
      return sampleRadialDepth(chain.geometry, toLocal, floorAt, -Infinity, Infinity);
    },
  },
  {
    // §124 (TODO 46) — the FLOAT half of the cone seating. The row above is
    // max(floorAt − r): BURIAL only — a chain floating in open air reads as
    // a perfect seat, which is exactly how the base wrap shipped ringing the
    // cone with 1.9–2.5 u of daylight through every green battery run.
    // Nothing else in the battery asserts a force-transmitting contact
    // CLOSES outside the §35 arming run; this row is that assertion for the
    // chain on the cone. The metric is builder-declared: the chain's
    // geometry carries `userData.seat` (the welded outer template's
    // inner-edge CROWN indices + each judged wrap link's buffer base — the
    // metal §61's "inner edge on the floor" means, and nothing else). Per
    // link: MAX over its crowns of (r − floorAt) — how far the FARTHEST seat
    // point stands off, because "seated" for a face means every crown
    // touches. Not a MIN: the TODO 40 relief's shear cancels exactly at the
    // stack's bottom edge (floorAt(z − h + h) = env(z)), so the bottom-corner
    // crown reads ~0 BY THE RELIEF'S OWN DESIGN — a min measures that corner
    // kiss forever and the float stays invisible (measured: 0.065 on the
    // shipped tree, vs 3.49 = w·m the crowns actually stand off at the base).
    // And not a max over any WIDER vertex set: the outer half legitimately
    // stands grooveD + relief·m proud by §61's convention.
    // Budget: what a BEDDED chain owes — link chording at the honest
    // 2.41 effective chord (stadium apexes past the rivets, the burial
    // row's own §124 correction) + the base's lie-flat corner residual
    // (the flank there is 2.1617 since §150's conserving solve — past
    // the 63.43° cap's tan = 2, linearized daylight 0.0477, relieved by
    // the envelope's curvature) +
    // HANDOFF_TRACK_TOL tessellation slack 0.03. Measured 0.209 at the
    // bottom turn, held at 0.25 — the burial row's own round-up. §124
    // closed TODO 46 here: the leaning chain SEATS, and this row is
    // what holds it seated (it read 3.191 waived on the 8:1 cut).
    pair: ['Fusee & great wheel', 'Chain'],
    maxDepth: 0.25,
    axis: 'reserve',
    nSamples: 60,
    measure(clock, unitA, unitB) {
      let fus = null;
      unitA.obj.traverse((o) => { if (!fus && o.userData && o.userData.groove) fus = o; });
      let chain = null;
      unitB.obj.traverse((o) => { if (!chain && o.isMesh) chain = o; });
      if (!fus || !chain) throw new Error('chain-on-cone float: groove userData or chain mesh not found');
      const { floorAt } = fus.userData.groove;
      if (typeof floorAt !== 'function') throw new Error('chain-on-cone float: userData.groove.floorAt missing — the cut and the check must hold one law');
      const seat = chain.geometry.userData && chain.geometry.userData.seat;
      // Loud, not lenient: a rebuild that stops declaring its seat would
      // otherwise read as a perfectly bedded chain — the exact silence this
      // row exists to end.
      if (!seat || !seat.crownIdx || !seat.bases) throw new Error('chain-on-cone float: geometry.userData.seat missing — the builder and the check must hold one declaration');
      if (!seat.bases.length) return 0;   // no judged wrap links at this pose (near run-out) — nothing to hold
      const toLocal = fus.matrixWorld.clone().invert().multiply(chain.matrixWorld);
      const pos = chain.geometry.attributes.position;
      const v = new THREE.Vector3();
      let worst = 0;
      for (const base of seat.bases) {
        for (const ci of seat.crownIdx) {
          v.fromBufferAttribute(pos, base + ci).applyMatrix4(toLocal);
          const d = Math.hypot(v.x, v.y) - floorAt(v.z);
          if (d > worst) worst = d;
        }
      }
      return worst;
    },
  },
  {
    // §61 — chain-on-drum: the coil's seating on the drum wall, same
    // blindness argument and the same encircling-MTV disqualification as
    // the cone row. The wrap rides at DRUM_WRAP_R (wall + plate
    // half-width, inner edge kissing the wall), the wall is a straight
    // cylinder — no slope term — so the residual is chording alone:
    // 1.9²/(8·10.66) = 0.042, plus tessellation slack → 0.08. The hook's
    // claw-and-link junction is naturally outside this measure (it stands
    // proud of the wall): the end link dropped over the claw is the
    // hook's working contact, and the baked chain has no physical hole
    // for the claw — that fiction is TODO territory, not wall seating.
    pair: ['Mainspring drum', 'Chain'],
    maxDepth: 0.08,
    axis: 'reserve',
    nSamples: 60,
    measure(clock, unitA, unitB) {
      let drum = null;
      unitA.obj.traverse((o) => { if (!drum && o.userData && o.userData.chainSeat) drum = o; });
      let chain = null;
      unitB.obj.traverse((o) => { if (!chain && o.isMesh) chain = o; });
      if (!drum || !chain) throw new Error('chain-on-drum seating: chainSeat userData or chain mesh not found');
      const { wallR, halfH } = drum.userData.chainSeat;
      const toLocal = drum.matrixWorld.clone().invert().multiply(chain.matrixWorld);
      return sampleRadialDepth(chain.geometry, toLocal, () => wallR, -halfH, halfH);
    },
  },
  // §47 — the winding arrest's two working contacts on the `wind` axis,
  // budget-tier per the axis's own note (tooth-pitch-scale features are not
  // the axis's n to carry). maxDepth is HANDOFF_TRACK_TOL: the pad's full
  // ramp is 0.36 and the beak's throw 0.7, so a budget at the measurement
  // floor grades touching and buried as different states (the P2 rule —
  // working budgets sized SMALLER than the strokes they police).
  {
    // The pad against the whole chain. nSamples: the catch is per-LINK —
    // one plate pitch is ~29° of the top turn, and the active approach
    // (touch ≈ 0.81 → 1, both directions of the cycle) spans ~0.4 of the
    // axis; 480 samples puts ~13 samples on each link passage there, the
    // per-cycle net the §99 row's calibration used. gcd(480, links/turn)
    // does not bind: the sampling is in TENSION, not tooth phase.
    pair: ['Winding arrest', 'Chain'],
    maxDepth: HANDOFF_TRACK_TOL,
    axis: 'wind',
    nSamples: 480,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'windArrestPad') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'chainRun') out.push(o); });
      return out;
    },
    // BESPOKE, for §99's reason in a new place: MTV is the wrong instrument
    // for a flat face resting ON a chain. The pad's face beds against a run
    // of links that wraps it in two directions, so the minimum translation
    // that separates the meshes is a pop-out along the escape direction —
    // a number about the search space, not the fit — and it reported 0.094
    // at tension 0.98 for a pose with NOT ONE chain vertex inside the pad's
    // stock. The fit is what this measures: chain vertices carried into the
    // pad's OWN frame, and the deepest one's distance to the nearest face of
    // the pad's local box. A face-resting contact reads 0; metal actually
    // inside the member reads how far in.
    measure(clock, unitA, unitB) {
      let pad = null, chain = null;
      unitA.obj.traverse((o) => { if (!pad && o.isMesh && o.name === 'windArrestPad') pad = o; });
      unitB.obj.traverse((o) => { if (!chain && o.isMesh && o.name === 'chainRun') chain = o; });
      if (!pad || !chain) return 0;
      pad.updateWorldMatrix(true, false); chain.updateWorldMatrix(true, false);
      // TODO 51 — the tab's SHEAR, undone. Its lean is baked into the
      // geometry (a shear cannot ride a parent group without every BVH
      // distance query measuring in a sheared frame), so `geometry.boundingBox`
      // is a box the solid only half fills, and its empty corners would read
      // as metal — the same over-read the parent-group note above records,
      // arriving by the other route. The builder therefore publishes the
      // PRE-shear extents and the shear it applied; un-shearing the point
      // makes the box exact about the real solid again. Parts without the
      // declaration are unsheared and keep the geometry's own box.
      const fit = pad.userData.fitBox;
      if (!pad.geometry.boundingBox) pad.geometry.computeBoundingBox();
      const bb = fit
        ? { min: { x: fit.min[0], y: fit.min[1], z: fit.min[2] },
          max: { x: fit.max[0], y: fit.max[1], z: fit.max[2] } }
        : pad.geometry.boundingBox;
      const shear = pad.userData.fitShearYZ || 0;
      const inv = _mat.copy(pad.matrixWorld).invert().multiply(chain.matrixWorld);
      const pos = chain.geometry.attributes.position;
      const v = new THREE.Vector3();
      let worst = 0;
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(inv);
        v.y -= v.z * shear;
        if (v.x < bb.min.x || v.x > bb.max.x || v.y < bb.min.y || v.y > bb.max.y
          || v.z < bb.min.z || v.z > bb.max.z) continue;
        const d = Math.min(v.x - bb.min.x, bb.max.x - v.x, v.y - bb.min.y, bb.max.y - v.y,
          v.z - bb.min.z, bb.max.z - v.z);
        if (d > worst) worst = d;
      }
      return worst;
    },
  },
  {
    // Beak against the lug: contact exists only in the closing arc at the
    // very top of the axis (t ≥ ~0.989 of the wind), a once-per-cycle
    // event ~0.006 of the axis wide each way; 480 samples lands ~3 inside
    // it plus the exact endpoint (the axis's triangle law hits t = 1 at
    // f = 0.5 exactly), and the handoff row holds the kiss itself.
    pair: ['Winding arrest', 'Fusee & great wheel'],
    maxDepth: HANDOFF_TRACK_TOL,
    axis: 'wind',
    nSamples: 480,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'windArrestBeak') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'windArrestLug') out.push(o); });
      return out;
    },
  },
  // TODO 50 — the stem coupling's ride: the clutch's saw ring against the
  // pinion's, over the stemSlip axis (one full pitch of backward slip and
  // back, the coupling's whole period). The rings are cut KNOT-ALIGNED to
  // the same law the pose reads (sawCouplingLiftAt), so any depth past the
  // track tolerance is a real build-vs-law disagreement, never sampling
  // noise. nSamples: the finest feature is the backlash flat at 0.15 of a
  // pitch — 480 puts 72 samples inside it, the wind family's per-feature
  // density.
  {
    pair: ['Winding clutch', 'Keyless works'],
    maxDepth: HANDOFF_TRACK_TOL,
    axis: 'stemSlip',
    nSamples: 480,
    selectA(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'clutchSaw') out.push(o); });
      return out;
    },
    selectB(unit) {
      const out = [];
      unit.obj.traverse((o) => { if (o.isMesh && o.name === 'windPinionSaw') out.push(o); });
      return out;
    },
  },
];

// §61 helper — worst radial burial of a mesh below an axisymmetric surface
// r = floorAt(z), in the surface's own frame. Samples every vertex AND each
// triangle's centroid: the deepest point of a chording link is mid-edge,
// which vertices alone never visit (the drum row would read ~0 without
// centroids). zLo/zHi gate the band the surface claims; points outside it
// are someone else's business (the span, the hook).
function sampleRadialDepth(geometry, toLocal, floorAt, zLo, zHi) {
  const pos = geometry.attributes.position;
  const idx = geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let worst = 0;
  const probe = (v) => {
    if (v.z < zLo || v.z > zHi) return;
    const d = floorAt(v.z) - Math.hypot(v.x, v.y);
    if (d > worst) worst = d;
  };
  const triCount = (idx ? idx.count : pos.count) / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(toLocal);
    b.fromBufferAttribute(pos, i1).applyMatrix4(toLocal);
    c.fromBufferAttribute(pos, i2).applyMatrix4(toLocal);
    probe(a); probe(b); probe(c);
    probe(a.add(b).add(c).multiplyScalar(1 / 3)); // centroid (a is consumed last)
  }
  return worst;
}

export function checkPenetrationBudgets(clock, { budgets = PENETRATION_BUDGETS, axes = AXES } = {}) {
  const units = collectUnits(clock);
  const results = [];
  for (const budget of budgets) {
    const [nameA, nameB] = budget.pair;
    const unitA = units.find((u) => u.name === nameA);
    const unitB = units.find((u) => u.name === nameB);
    if (!unitA || !unitB) { results.push({ pair: pairKey(nameA, nameB), status: 'ERROR', error: 'unit missing' }); continue; }
    // A row either carries a bespoke `measure` (§61's radial seating rows —
    // MTV is meaningless for a chain that encircles what it wraps) or the
    // default MTV machinery over selected meshes.
    const meshesA = budget.measure ? [] : budget.selectA(unitA); // wheel-side (bvh)
    const meshesB = budget.measure ? [] : budget.selectB(unitB); // stone-side (translated)
    meshesA.forEach(bvhFor);
    const axis = axes.find((a) => a.name === budget.axis);
    const n = budget.nSamples ?? axis.n;
    let worst = 0, worstF = null;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      clock.setPose(axis.pose(f, clock));
      clock.scene.updateMatrixWorld(true);
      if (budget.measure) {
        const d = budget.measure(clock, unitA, unitB);
        if (isFinite(d) && d > worst) { worst = d; worstF = f; }
        continue;
      }
      for (const meshA of meshesA) {
        const bvh = bvhFor(meshA);
        for (const meshB of meshesB) {
          const d = mtvDepth(bvh, meshA.matrixWorld, meshB);
          if (isFinite(d) && d > worst) { worst = d; worstF = f; }
        }
      }
    }
    // §50's convention, extended here: a waived row is accepted debt citing
    // its TODO item, visible in the report, not a pass. The gate counts only
    // unwaived overages.
    results.push({
      pair: pairKey(nameA, nameB),
      maxDepth: budget.maxDepth,
      worstDepth: +worst.toFixed(3),
      worstAt: worstF === null ? null : `${budget.axis}=${worstF.toFixed(3)}`,
      status: worst <= budget.maxDepth ? 'OK' : budget.waived ? 'WAIVED' : 'EXCEEDS BUDGET',
      ...(budget.waived ? { waived: budget.waived } : {}),
    });
  }
  window.__penetrationReport = results;
  console.table(results);
  return results;
}

// ---------------------------------------------------------------------------
// ALARM HAND-OFF TRACKING — the instrument TODO 5 says is missing, built for
// the one run that hides in its blind spots.
//
// §35 claims the arming run is "an unbroken mechanical run… every hand-off is
// a contact between two parts". No check ever measured those contacts, for
// three structural reasons this file already documents separately:
//   1. The pair sweep enumerates DISTINCT unit pairs, so rod⇄tail and
//      rod⇄crank — both inside 'Alarm link' — are invisible (TODO 5).
//   2. The selector-side penetration budgets carried maxDepth 0.12, which is
//      63% of the ring's whole 0.19 travel: "touching", "0.12 apart" and
//      "0.12 buried" were indistinguishable to the gate.
//   3. No axis poses the DISARMED parity — 'alarm' and 'alarmStrike' both pin
//      alarmOn: 1 — so the beak-on-column state was never swept at all.
// This check closes all three for the arming run: it poses BOTH parities
// exactly (setPose, zero-dt), and measures the signed separation of each
// declared hand-off — exact BVH gap when clear, MTV depth when intersecting.
//
// The tolerance is HANDOFF_TRACK_TOL (defined with the penetration budgets,
// which share it): anything wider is a functional gap; anything deeper is a
// burial — either way the "contact" is a pose that happens to pass nearby,
// not a transmission.
// Both parities of the toggle, posed exactly. tau/crown/tension pins match
// the fingerprint's rest pose so the run is measured on canonical geometry.
const ALARM_HANDOFF_POSES = [
  ['disarmed', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 0, alarmCrownPullT: 0 }],
  ['armed', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 0 }],
  // §45 — the SETTING parity: alarm crown pulled, disarmed. The release run
  // (collar → lifter → sleeve → tail pin) must measure closed here, and the
  // sleeve must measure FREE of the pin at both crown-in parities — riding
  // must not feel the sleeve.
  ['setting', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 0, alarmCrownPullT: 1 }],
];
// The run as §35 states it, one row per claimed hand-off, in drive order.
// A `missing` row is a member the claim requires that has no geometry at all
// — reported, never silently skipped. A `waived` row is §50's convention:
// accepted debt citing its TODO item, visible in the report, not a pass.
const ALARM_HANDOFFS = [
  {
    // CORRECTED: the first filing of this row said "no pawl exists" — an
    // overclaim. The pawl bar and the ratchet skirt both exist (§43 cut the
    // saw teeth for this pawl and asserts their direction); what was absent
    // is CAUSALITY, and TODO 20 fixed that side: pressAlarmPusher() is the
    // primitive, the wheel's parity IS the state, alarmOn a readout. The
    // row now measures the pawl PARKED clear of the skirt at both
    // parities; the index STROKE itself is a transient the static poses
    // cannot reach, carried below as the row's remaining waiver.
    // TODO 20 (park) closed the STATIC half: the pawl rests on the tooth
    // it will drive, a click's bite (−0.025, measured every run — it was
    // parked 0.18 BURIED before). NOTE the row measures the PARK only:
    // the index STROKE — press travel 0.7 against a ~0.84 tooth arc at
    // the engagement radius, marginal — is a transient static poses
    // cannot reach; TODO 20's status block files that gap, and §43's
    // direction assert remains its only guard.
    label: 'pusher pawl ⇄ ratchet skirt',
    unitA: 'Alarm switch', meshA: 'alarmColWheel',
    unitB: 'Alarm switch', meshB: 'alarmPusherPawl',
  },
  {
    // §99 — THE HOLD TODO 37 BUILT: the click's beak parked on the arbor
    // ratchet's saw. The park is not a measured-once constant: tick's ride
    // law poses the beak ON sawRadiusAt (the builder's own cut, exported as
    // ratchetPoly), so the kiss holds at every parity and every wind — the
    // pusher-pawl row's convention on the wheel this movement was missing.
    // The ratcheting STROKE (winding cams the beak out tooth by tooth) is a
    // transient these static poses cannot reach; the alarmWind penetration
    // budget polices it over the full 56-cycle ride.
    label: 'click beak ⇄ arbor ratchet',
    unitA: 'Alarm barrel', meshA: 'alarmArborRatchet',
    unitB: 'Alarm click', meshB: 'alarmClickPawl',
  },
  {
    // TODO 24 closed: the LOCK side's read was law-only — the tail's z band
    // never overlapped the castellations, so 'blocked on a column' had no
    // matter behind it. The raised beak nose now kisses the column's OUTER
    // face at the disarmed parity and hangs over gap air armed — the link
    // beak's row, mirrored to the lock side.
    label: 'column outer face ⇄ lock beak',
    unitA: 'Alarm switch', meshA: 'alarmColWheel',
    unitB: 'Alarm lock', meshB: 'alarmLockBeak',
    expect: { disarmed: 'contact', armed: 'free' },
  },
  {
    // TODO 20 closed this row: the flank is cut (geometry.js), the nose
    // rests ON the column top plane at the disarmed parity (measured 0),
    // and armed it hangs at the seat over the gap — DESIGNED free, the
    // classic column-wheel beak ride. UNWAIVED both ways.
    label: 'column relief ⇄ beak nose',
    unitA: 'Alarm switch', meshA: 'alarmColWheel',
    unitB: 'Alarm link', meshB: 'alarmLinkBeak',
    expect: { disarmed: 'contact', armed: 'free' },
  },
  {
    // TODO 20 closed this row: the rod's top is BUILT to the tail's
    // underside and the tick derives its lift from the beak's lever —
    // measured 0 disarmed, −0.0009 armed. UNWAIVED.
    label: 'beak tail ⇄ rod top',
    unitA: 'Alarm link', meshA: 'alarmLinkBeakTail',
    unitB: 'Alarm link', meshB: 'alarmLinkRod',
  },
  {
    // TODO 20 closed this row and retired TODO 9's constants: the rim
    // finger presses with its TIP at a designed rest angle, the rod's foot
    // is read off that contact, and the shaft's roll is solved from it per
    // tick — measured +0.022/−0.014. UNWAIVED.
    label: 'rod foot ⇄ rim crank',
    unitA: 'Alarm link', meshA: 'alarmLinkRod',
    unitB: 'Alarm link', meshB: 'alarmLinkCrankRim',
  },
  {
    // TODO 20 (fork) closed this row: the drive tab is a FORK — two plates
    // flanking a groove — and the shaft ends short of it, only the centre
    // PIN reaching in. The pin runs at the fork's working clearance
    // (±0.01, which is what a running fit measures) and drives the ring
    // POSITIVELY BOTH WAYS, which retired both the transfixion (TODO 16's
    // "slot", now literal) and the phantom bias spring. UNWAIVED.
    label: 'centre pin ⇄ fork groove',
    unitA: 'Alarm link', meshA: 'alarmLinkCentrePin',
    unitB: 'Alarm selector', meshB: 'alarmSelTab',
  },
  {
    // TODO 19 closed this row: the rocker's angle is solved from the contact
    // (main.js), the pin re-hung to protrude on the ring side, and the row
    // measures kissing at both parities (−0.0007/−0.0024). UNWAIVED — a
    // regression here fails the gate.
    label: 'ring face ⇄ sensing pin',
    unitA: 'Alarm selector', meshA: 'alarmSelRing',
    unitB: 'Alarm disc', meshB: 'alarmSelPin',
  },
  // §45 — the release run, in drive order. The blade preloads the head onto
  // the collar at every parity (plateau or ramp), and the fork's plates run
  // at the TODO 20 working clearance, so both measure as contact everywhere;
  // the cone touches the tail pin ONLY at the setting parity — at rest the
  // whole skirt sits one ALARM_SLEEVE_GAP below the pin's tip, and armed the
  // sleeve does not move (the ring path owns that parity).
  {
    label: 'stem collar ⇄ lifter head',
    unitA: 'Alarm crown', meshA: 'alarmStemCollar',
    unitB: 'Alarm release lifter', meshB: 'alarmLifterHead',
  },
  {
    label: 'lifter fork ⇄ sleeve tab',
    unitA: 'Alarm release lifter', meshA: 'alarmLifterFork',
    unitB: 'Alarm release sleeve', meshB: 'alarmSleeveTab',
  },
  {
    label: 'sleeve cone ⇄ follower tail pin',
    unitA: 'Alarm release sleeve', meshA: 'alarmSleeveSkirt',
    unitB: 'Alarm disc', meshB: 'alarmTailPin',
    expect: { disarmed: 'free', armed: 'free', setting: 'contact' },
  },
  // §45 stage 2 — the silence run: the paddle is blade-biased onto the
  // run's underside at every parity; the finger touches the tail only at
  // the setting parity (riding must never feel the rocker — the rest cap
  // exceeds the full drop, asserted at the build).
  {
    label: 'lifter run ⇄ rocker paddle',
    unitA: 'Alarm release lifter', meshA: 'alarmLifterRun',
    unitB: 'Alarm silence rocker', meshB: 'alarmSilPaddle',
  },
  {
    label: 'rocker finger ⇄ feeler tail',
    unitA: 'Alarm silence rocker', meshA: 'alarmSilFinger',
    unitB: 'Alarm release feeler', meshB: 'alarmFeelerTail',
    expect: { disarmed: 'free', armed: 'free', setting: 'contact' },
  },
];

// §66 part two — the schematic tier's contact dots light from THESE rows,
// measured at the CURRENT pose (no setPose, no resetInputs: the caller is a
// live display, not a battery gate). Returns gap + the closest sample pair's
// midpoint so the dot sits where the measurement was taken. Sampling is the
// same vertex-against-tree primitive the arbiters trust; strided to cap cost.
// §47 — the going side's own hand-off rows: same schema, same checker
// (checkAlarmHandoffs takes poses and handoffs as options by design), its
// OWN pose table because the arrest's parities are wind states, not alarm
// states. `slack` is any tension below the touch solve's grid floor (0.80)
// — the pad must measure free there AND the lug is away from the beak (its
// only pass of the parked beak is at 1 − 1/FUSEE_WRAP_TURNS ≈ 0.43, clear
// by the build's own free-pass assert).
export const WIND_ARREST_POSES = [
  ['full', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 }],
  ['slack', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.5 }],
];
export const WIND_ARREST_HANDOFFS = [
  {
    label: 'coil ⇄ finger pad',
    unitA: 'Chain', meshA: 'chainRun',
    unitB: 'Winding arrest', meshB: 'windArrestPad',
    expect: { full: 'contact', slack: 'free' },
    // TODO 71, closed in three measured steps: the pad law samples the
    // BUILT chain buffer at each link's own parity (builtPtsNear), its
    // window reads every wrap link rather than six pitches of it, and the
    // pose is the lever's exact inverse instead of lift/padGain — the
    // −0.111 this row was waived at decomposed into 0.085 of window
    // under-read plus 0.060 of first-order-pose shortfall, and with both
    // gone it measures −0.021 at full, inside the ±0.03 kiss band, with
    // the waiver retired.
  },
  {
    label: 'beak ⇄ stop lug',
    unitA: 'Winding arrest', meshA: 'windArrestBeak',
    unitB: 'Fusee & great wheel', meshB: 'windArrestLug',
    expect: { full: 'contact', slack: 'free' },
  },
];

// TODO 50 — the stem clutch's handoff rows, a SIBLING registration in the
// windArrestHandoff pattern (never widen another mechanism's tables — its
// rows stay bit-identical under the report diff). The coupling is a
// one-sided constraint held CLOSED by the yoke spring at every relative
// angle — seated the drive faces bear, in the backlash the tip rides the
// valley flat, camming the ramps bear — so the pair expects CONTACT at all
// three engaged poses and FREE only pulled out. Slip values are the
// coupling's own fractions of its 2π/8 pitch (one saw tooth per leaf).
export const STEM_CLUTCH_POSES = [
  ['seated', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windStemSlip: 0 }],
  ['backlash', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windStemSlip: -0.075 * (Math.PI / 4) }],
  ['camming', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windStemSlip: -0.5 * (Math.PI / 4) }],
  ['pulled', { tau: 0.13, crownPullT: 1, leverEngage: 1, tension: 1, windStemSlip: 0 }],
];
export const STEM_CLUTCH_HANDOFFS = [
  {
    label: 'clutch saw ⇄ pinion saw (the stem\'s one-way)',
    unitA: 'Winding clutch', meshA: 'clutchSaw',
    unitB: 'Keyless works', meshB: 'windPinionSaw',
    expect: { seated: 'contact', backlash: 'contact', camming: 'contact', pulled: 'free' },
  },
];

export function measureHandoffsNow(clock, { tol = HANDOFF_TRACK_TOL, handoffs = ALARM_HANDOFFS } = {}) {
  const units = collectUnits(clock, { includeExcluded: true });
  clock.scene.updateMatrixWorld(true);
  const meshesIn = (unitName, meshName) => {
    const u = units.find((x) => x.name === unitName);
    if (!u) return [];
    const out = [];
    u.obj.traverse((o) => { if (o.isMesh && o.name === meshName) out.push(o); });
    return out;
  };
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _tmp = new THREE.Vector3();
  const _toB = new THREE.Matrix4();
  const closestPair = (a, b) => {
    bvhFor(a); const tree = bvhFor(b);
    _toB.copy(b.matrixWorld).invert().multiply(a.matrixWorld);
    const pos = a.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(pos.count / 400));
    let d = Infinity; const target = { point: new THREE.Vector3() };
    const bestA = new THREE.Vector3(), bestB = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += stride) {
      _tmp.fromBufferAttribute(pos, i).applyMatrix4(_toB);
      const hit = tree.closestPointToPoint(_tmp, target);
      if (hit && hit.distance < d) {
        d = hit.distance;
        bestA.copy(_tmp); bestB.copy(target.point);
      }
    }
    _pa.copy(bestA).applyMatrix4(b.matrixWorld);
    _pb.copy(bestB).applyMatrix4(b.matrixWorld);
    return { d, p: _pa.clone().add(_pb).multiplyScalar(0.5) };
  };
  const out = [];
  for (const h of handoffs) {
    if (h.missing) continue;
    const mA = meshesIn(h.unitA, h.meshA), mB = meshesIn(h.unitB, h.meshB);
    if (!mA.length || !mB.length) continue;
    let best = { d: Infinity, p: null };
    for (const a of mA) for (const b of mB) {
      const r = closestPair(a, b);
      if (r.d < best.d) best = r;
    }
    out.push({ label: h.label, tol, gap: best.d, point: best.p, waived: h.waived || null });
  }
  return out;
}

export function checkAlarmHandoffs(clock, { tol = HANDOFF_TRACK_TOL, poses = ALARM_HANDOFF_POSES, handoffs = ALARM_HANDOFFS } = {}) {
  const units = collectUnits(clock, { includeExcluded: true });
  const meshesIn = (unitName, meshName) => {
    const u = units.find((x) => x.name === unitName);
    if (!u) return [];
    const out = [];
    u.obj.traverse((o) => { if (o.isMesh && o.name === meshName) out.push(o); });
    return out;
  };
  const rows = [];
  for (const h of handoffs) {
    if (h.missing) {
      rows.push({ label: h.label, status: h.waived ? 'MISSING (waived)' : 'MISSING', note: h.missing, waived: h.waived || null });
      continue;
    }
    const mA = meshesIn(h.unitA, h.meshA);
    const mB = meshesIn(h.unitB, h.meshB);
    if (!mA.length || !mB.length) {
      rows.push({ label: h.label, status: 'ERROR', error: `mesh not found: ${!mA.length ? `${h.unitA}/${h.meshA}` : `${h.unitB}/${h.meshB}`}` });
      continue;
    }
    const row = { label: h.label, tol, waived: h.waived || null };
    let bad = false;
    for (const [poseName, pose] of poses) {
      clock.setPose(pose);
      clock.scene.updateMatrixWorld(true);
      let gap = Infinity, depth = 0;
      for (const a of mA) {
        for (const b of mB) {
          if (meshesIntersect(a, b)) {
            gap = 0;
            const d = mtvDepth(bvhFor(a), a.matrixWorld, b);
            if (isFinite(d) && d > depth) depth = d;
          } else if (gap > 0) {
            // EXACT distance, arbitrated by a Z-NUDGE BISECTION. Two
            // documented liars meet at a knife-edge contact: the BVH's
            // tri-tri distance measured this row's EXACTLY-COPLANAR
            // touching faces as a 0.186 gap (edge distance, not face
            // distance), and meshClearance's sampling fallback would keep
            // that number. The nudge is decisive where both guess: push B
            // along ±z (the working axis of every hand-off declared here)
            // and bisect the smallest offset that makes the boolean
            // intersect — that offset IS the axial separation. Falls back
            // to the exact/sampled arbitration only when no nudge within
            // 2·tol connects (the meshes genuinely stand apart).
            const bvhA = bvhFor(a); bvhFor(b);
            _mat.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
            const hit = bvhA.closestPointToGeometry(b.geometry, _mat, {}, {}, 0, gap);
            let d = hit ? hit.distance : Infinity;
            const tryDz = (dz) => stoneIntersectsWheel(bvhA, a.matrixWorld, b, b.geometry, new THREE.Vector3(0, 0, dz));
            let zSep = Infinity;
            for (const sgn of [1, -1]) {
              if (tryDz(sgn * 2 * tol)) {
                let lo = 0, hi = 2 * tol;
                for (let k = 0; k < 20; k++) {
                  const mid = (lo + hi) / 2;
                  if (tryDz(sgn * mid)) hi = mid; else lo = mid;
                }
                zSep = Math.min(zSep, hi);
              }
            }
            if (zSep < Infinity) d = Math.min(d, zSep);
            else if (d < 0.05) d = Math.max(d, sampledClearance(a, b, gap));
            if (d < gap) gap = d;
          }
        }
      }
      // One signed number per pose: + is a gap, − is a burial, 0 is touch.
      const sep = depth > 0 ? -depth : gap;
      row[poseName] = +sep.toFixed(4);
      // Per-pose expectation: 'contact' (|sep| ≤ tol) by default, or 'free'
      // (sep ≥ tol: genuinely clear, not buried and not grazing) for a
      // hand-off whose member is DESIGNED to hang off its partner in that
      // parity — the armed nose over a column gap being the case in point.
      const expect = (h.expect && h.expect[poseName]) || 'contact';
      if (expect === 'free' ? !(sep >= tol) : !(Math.abs(sep) <= tol)) bad = true;
    }
    row.status = !bad ? 'OK' : h.waived ? 'WAIVED' : 'FAIL';
    rows.push(row);
  }
  const unwaived = rows.filter((r) => r.status === 'FAIL' || r.status === 'MISSING' || r.status === 'ERROR');
  const waivedCount = rows.filter((r) => r.status === 'WAIVED' || r.status === 'MISSING (waived)').length;
  return {
    ok: unwaived.length === 0,
    gate: 'GATING: every hand-off within ±tol of touch at BOTH parities, or waived citing its TODO item; a waived row is accepted debt, visible above, not a pass',
    tol, rows, waivedCount, unwaived, unwaivedCount: unwaived.length,
  };
}

export async function runInspection(clock, { axes: axisArg = AXES, yieldEvery = 8, includeExcluded = false, pairsTouching } = {}) {
  const axes = resolveAxes(axisArg);   // §127 — a slice arrives as names; see resolveAxes
  // §152 — the pair loop narrows; the UNIT LIST does not (see resolvePairsTouching).
  const touching = resolvePairsTouching(clock, pairsTouching);
  const units = collectUnits(clock, { includeExcluded });
  const findings = new Map(); // pairKey -> { class, axes: {axisName: [f,...]} }
  censusStart();   // §108's experiment — report-only, see the census block
  let unitPairTests = 0, unitPairPass = 0;   // the unit-level broad phase, this check's own outer gate

  for (const axis of axes) {
    enterAxis(clock);   // TODO 54 — canonical entry, so this axis's findings do not depend on which axes ran before it (and §127 can run it in its own context)
    for (let i = 0; i <= axis.n; i++) {
      const f = i / axis.n;
      clock.setPose(axis.pose(f, clock));

      // Broad phase: unit AABBs at this pose.
      const boxes = units.map((u) => new THREE.Box3().setFromObject(u.obj));
      for (let ai = 0; ai < units.length; ai++) {
        for (let bi = ai + 1; bi < units.length; bi++) {
          const A = units[ai], B = units[bi];
          if (inList(IGNORED_PAIRS, A.name, B.name)) continue;
          if (touching && !touching.touches(A.name, B.name)) continue;   // §152
          unitPairTests++;
          if (!boxes[ai].intersectsBox(boxes[bi])) continue;
          unitPairPass++;
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

  const census = censusStop();
  if (census) Object.assign(census, { unitPairTests, unitPairPass });
  window.__inspectReport = { units: units.map((u) => u.name), report, axes: axes.map((a) => a.name), census };
  // Only when restricted, so a full run's payload is unchanged by this landing.
  if (touching) window.__inspectReport.restriction = restrictionRecord(touching, null);
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
  const axes = resolveAxes(axisArg || AXES);
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
//
// §80: the input is the list of PER-POSE BOXES, not the per-pose point sets.
// It always was, arithmetically — the old signature took the points and its
// first act was to reduce each pose to its six extremes. Taking the boxes is
// the same union of the same numbers with the vertices already dropped at the
// place they were measured, which is the whole of §80's point 1: a box is what
// this consumer READS, so a box is what the sweep should keep.
function buildPathHull(poseBoxes, perAxis) {
  const boxes = [];
  const acc = (b, o) => {
    if (o[0] < b[0]) b[0] = o[0];  if (o[3] > b[3]) b[3] = o[3];
    if (o[1] < b[1]) b[1] = o[1];  if (o[4] > b[4]) b[4] = o[4];
    if (o[2] < b[2]) b[2] = o[2];  if (o[5] > b[5]) b[5] = o[5];
  };
  // Both callers used to hand this the POINTS, and a 3n-long point array
  // reads as a box whose first six numbers happen to be vertices — wrong
  // sleeves, silently, with every downstream count still plausible. Six is
  // the contract, so six is checked.
  if (poseBoxes.length && poseBoxes[0].length !== 6) throw new Error('buildPathHull wants per-pose boxes, not points');
  for (let i = 0; i < poseBoxes.length; i++) {
    // A fresh PLAIN array per pose: poses a part stood still through SHARE one
    // box object upstream, and the sleeve dilation below mutates these in place.
    const o = poseBoxes[i];
    const b = [o[0], o[1], o[2], o[3], o[4], o[5]];
    const sameAxis = (i + 1) % perAxis !== 0;
    if (sameAxis && i + 1 < poseBoxes.length) acc(b, poseBoxes[i + 1]);
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

// ---------------------------------------------------------------------------
// §80 — A MESH'S POSE STATE, and why the sweep may trust it.
//
// The registry's bill was 369 poses x every vertex of every mesh, transformed
// into a Float64Array and HELD (measured: 640,558 vertices over 608 meshes, so
// ~15 MB per frame and ~5.7 GB alive at the peak — which is what "3.0x the
// vertices bought ~4x the wall clock" was really reporting). Most of those
// transforms compute a number the sweep already has: each axis PINS the state
// every other axis varies, so a part only the alarm crown moves stands
// perfectly still through the other eight sweeps and is re-transformed 300-odd
// times into the same place.
//
// A mesh's POSE STATE is its geometry object plus its world matrix. Equal at
// two poses ⇒ equal world vertices, to the last bit: the same arithmetic over
// the same inputs. So the sweep transforms once per state and shares the
// result — an EXACT reduction, not an approximation, and one that needs no
// waiver.
//
// It rests on geometry IDENTITY standing for geometry CONTENT — a part that
// rewrote one BufferGeometry's positions in place would keep its id and lie
// here. That is not a new trust: `bvhFor` caches by geometry the same way, and
// MODELING.md rule 6 already forbids the in-place morph for exactly that
// reason ("build the states as distinct geometry objects"). The mainspring and
// the hairspring obey it (a pool of wind frames), and so does the chain (a
// fresh geometry per rebuild) — so a morph reads here as a new state, which is
// what rule 6's "a part that changes SHAPE is a moving part" demands.
const _stateBits = new Float64Array(1);
const _stateWords = new Uint32Array(_stateBits.buffer);
function poseStateOf(store, mesh) {
  let s = store.get(mesh);
  if (!s) { s = { byHash: new Map(), sigs: [] }; store.set(mesh, s); }
  const e = mesh.matrixWorld.elements;
  const gid = mesh.geometry.id;
  let h = gid | 0;
  for (let k = 0; k < 16; k++) {                       // FNV-1a over the raw bits
    _stateBits[0] = e[k];
    h = Math.imul(h ^ _stateWords[0], 16777619) >>> 0;
    h = Math.imul(h ^ _stateWords[1], 16777619) >>> 0;
  }
  const bucket = s.byHash.get(h);
  if (bucket) {
    // The hash only nominates candidates; the sig comparison DECIDES. A hash
    // collision must not be able to make two different poses share a frame.
    outer: for (const id of bucket) {
      const sig = s.sigs[id];
      if (sig[0] !== gid) continue;
      for (let k = 0; k < 16; k++) if (sig[k + 1] !== e[k]) continue outer;
      return id;
    }
  }
  const sig = new Float64Array(17);
  sig[0] = gid;
  for (let k = 0; k < 16; k++) sig[k + 1] = e[k];
  const id = s.sigs.length;
  s.sigs.push(sig);
  if (bucket) bucket.push(id); else s.byHash.set(h, [id]);
  return id;
}

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
  const meshes = [];
  for (const u of units) for (const m of u.meshes) if (!meshes.includes(m)) meshes.push(m);
  const poseStates = new Map();                    // mesh → its distinct-state table
  const _wv = new THREE.Vector3();
  let vertexTransforms = 0, vertexTransformsNaive = 0;

  // THE POSE WALK, shared by both sweeps. Exactly TWO of these run per build
  // BEFORE anything else poses the clock, in the order they always have, and
  // that is not a stylistic choice: some of what setPose writes is CUMULATIVE
  // (TODO 20's alarm column advances a step each time a pose flips the
  // parity, so its angle depends on how many flips came before), so the pose
  // a walk lands on is a function of the walk history as well as of the axis
  // fraction. Inserting a walk between them — or reordering them — silently
  // re-poses those parts and moves the registry's numbers. Any new quantity a
  // sweep needs has to be accumulated inside the walk that is already
  // running, not bought with another lap. The ONE exception is APPENDED:
  // TODO 43's reversal-confirm mini-walks run after both standing walks
  // complete, so neither walk's history moves — they sample whatever
  // cumulative state the standing walks left, which is the right frame for
  // the yes/no they ask (a reciprocation reproduces at any parity; the
  // absolute pose does not matter to a sign).
  const walkPoses = async (n, visit) => {
    let k = 0;
    for (const axis of axes) {
      for (let s = 0; s < n; s++) {
        // setPose ends in scene.updateMatrixWorld(true) — the explicit second
        // call this used to make forced a whole-scene matrix rebuild per pose
        // for nothing.
        clock.setPose(axis.pose(s / Math.max(1, n - 1)));
        visit(k);
        k++;
        if (k % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }
    return k;
  };

  // THE COARSE SWEEP. Still materialised — the derivation below is mesh-major
  // (a circle fitted through one vertex's whole track, an arc per pose) and
  // cannot be folded into a pose-major walk without a second lap the paragraph
  // above forbids. What it no longer does is keep a COPY per pose: `stateAt`
  // maps pose → state and the frames are shared, so a part that never moves
  // holds one frame instead of 108.
  const sampleCoarse = async (n) => {
    const total = axes.length * n;
    const per = new Map();
    for (const m of meshes) per.set(m, { states: [], byId: new Map(), stateAt: new Int32Array(total) });
    await walkPoses(n, (k) => {
      for (const m of meshes) {
        const rec = per.get(m);
        const id = poseStateOf(poseStates, m);
        const pos = m.geometry.getAttribute('position');
        vertexTransformsNaive += pos.count;
        let slot = rec.byId.get(id);
        if (slot === undefined) {
          const pts = new Float64Array(pos.count * 3);
          const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
          for (let i = 0; i < pos.count; i++) {
            _wv.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            const x = _wv.x, y = _wv.y, z = _wv.z;
            pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z;
            if (x < box[0]) box[0] = x; if (x > box[3]) box[3] = x;
            if (y < box[1]) box[1] = y; if (y > box[4]) box[4] = y;
            if (z < box[2]) box[2] = z; if (z > box[5]) box[5] = z;
          }
          vertexTransforms += pos.count;
          slot = rec.states.length;
          rec.states.push({ pts, box, cen: null, arc: null });
          rec.byId.set(id, slot);
        }
        rec.stateAt[k] = slot;
      }
    });
    return per;
  };

  let coarse = await sampleCoarse(perAxis);

  // TODO 43 (2)/(3): one quantum for centroid dedup keys, in the coarse walk
  // and the confirm pass alike — the two must agree about what "the same
  // vertex" means. Constraint at its derivation site (the cen block below).
  const CEN_KEY_Q = 1e6;

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
    // TODO 43 (1): the degeneracy test is RELATIVE to the point spread, not
    // absolute. det and (suu+svv)² share the scale n²·L⁴, so their ratio is a
    // pure collinearity measure; the old absolute 1e-12 was calibrated to the
    // with-repeats moment sums, and removing ~10× repeat points shrank
    // healthy fits under it (points on a genuine short arc sit orders above
    // 1e-9 of their own spread; collinear sets sit at float noise, orders
    // below).
    const det = 2 * (suu * svv - suv * suv);
    if (Math.abs(det) < 1e-9 * Math.max(1e-24, (suu + svv) ** 2)) return null;
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
      const rec = coarse.get(m);
      const states = rec.states, stateAt = rec.stateAt;
      const series = Array.from(stateAt, (s) => states[s].pts);   // per pose, SHARED
      const poseBoxes = Array.from(stateAt, (s) => states[s].box);
      // Does it move at all? One pose state over the whole sweep IS "it never
      // moved" — the geometry and the world matrix were identical every time,
      // so no comparison can find a displacement. Otherwise compare the
      // distinct frames against pose 0, which is the same set of comparisons
      // the per-pose loop made with the repeats removed.
      let moves = false;
      if (states.length > 1) {
        const p0 = series[0];
        for (const st of states) {
          const pts = st.pts;
          for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i] - p0[i]) > eps) { moves = true; break; }
          if (moves) break;
        }
      }
      // z band from the per-pose boxes: min/max of a min/max, over the same
      // vertices.
      let zLo = Infinity, zHi = -Infinity;
      for (const st of states) { if (st.box[2] < zLo) zLo = st.box[2]; if (st.box[5] > zHi) zHi = st.box[5]; }
      if (!moves) {
        // §36 part three needs a static part's spatial extent, not just its z
        // band. It costs nothing to store — the part DOES NOT MOVE, so its
        // world AABB is exact rather than a hull — and without it structural
        // metal is invisible to the route check, which would make "through
        // structural metal is fine" vacuously true instead of evidenced.
        const b0 = poseBoxes[0];
        const bxLo = b0[0], byLo = b0[1], bxHi = b0[3], byHi = b0[4];
        volumes.push({ unit: u.name, mesh: m, meshName: m.name || undefined, kind: 'static',
                       box: [bxLo, byLo, zLo, bxHi, byHi, zHi], zBand: [zLo, zHi], reversed: false });
        continue;
      }
      // Planar? (every vertex holds its z) — over the distinct frames, same
      // reason as `moves` above.
      let planar = true;
      for (const st of states) { const pts = st.pts; for (let i = 2; i < pts.length && planar; i += 3) if (Math.abs(pts[i] - series[0][i]) > 1e-4) planar = false; if (!planar) break; }
      // Track one witness vertex's path and fit a circle to it — over the
      // DISTINCT states, not the per-pose series. TODO 43 (1): `series`
      // shares frames per pose, so a part that rests through nine axes and
      // moves in one had its fitted centre dragged toward ~100 copies of the
      // rest frame, and the angle track about that biased parametrization
      // flipped sign-change verdicts with the pose POPULATION — the 'Motion
      // works' star's reversal appeared and evaporated on inert pose
      // insertions while its matrices were bit-identical at every shared
      // pose. The registry's own convention ("repeats add nothing either
      // way") now covers its last holdout: repeats do not vote in the fit.
      let fit = null;
      if (planar) {
        const wi = 0;
        const xs = states.map((st) => st.pts[wi * 3]), ys = states.map((st) => st.pts[wi * 3 + 1]);
        fit = fitCircle(xs, ys);
        if (fit && (fit.resid > Math.max(1e-3, fit.r * 1e-3) || fit.r < 1e-4)) fit = null;
      }
      if (!fit) {
        let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
        for (const st of states) {
          if (st.box[0] < xLo) xLo = st.box[0]; if (st.box[3] > xHi) xHi = st.box[3];
          if (st.box[1] < yLo) yLo = st.box[1]; if (st.box[4] > yHi) yHi = st.box[4];
        }
        // §48: a compound mover has no angle to reverse, so the arc test
        // below never sees it — but a part that SLIDES out and back is
        // reciprocating just as surely as one that swings, and needs a
        // restoring element for the same reason. Reversal here is a sign
        // change in the CENTROID's direction of travel: consecutive step
        // vectors pointing against each other (dot < 0). Same axis-boundary
        // skip, since a pose jump between sweeps is not motion the part made.
        // Summed per DISTINCT frame and shared: two poses holding the same
        // vertices have the same centroid, down to the summation order.
        // TODO 43 (2): average over DISTINCT positions, not vertices. Builders
        // duplicate positions — three.js cylinders close their θ seam with a
        // repeated ring, flat-shaded boxes split every corner — and a
        // vertex-averaged centroid counts each copy, which put the 'track'
        // centroid ~2r/(segs·2+2) OFF the rotation axis (measured 0.031 on
        // the r 0.55 stem collar). That bias ROTATES with the mesh, so a pure
        // rotation read as a small circular translation, and at long-span
        // axes its aliased chords passed the deadband ('Alarm crown', TODO 43
        // (3) — a monotone spin read as out-and-back). Duplicates are EXACT
        // copies (same local floats through the same matrix), so exact keys
        // need no tolerance; paid once per distinct frame, like everything
        // else here.
        const cen = Array.from(stateAt, (s) => {
          const st = states[s];
          if (!st.cen) {
            const pts = st.pts;
            // The key is QUANTIZED, not exact: a builder's seam duplicate is
            // computed at θ = 2π rather than 0, so its sin component lands a
            // few ulps off zero (measured: the collar's seam pair differs by
            // ~1e-16·r) and exact keys miss exactly the copies this exists
            // to drop. The two populations are orders apart — float
            // duplicates coincide to ≤ ~1e-11 absolute at this scene's
            // coordinate scale, and genuinely distinct vertices sit ≥ the
            // §50 stock floors (~0.02 u) — so any quantum between splits
            // them; 1e-6 is the middle of that window.
            const seen = new Set();
            const q = CEN_KEY_Q;
            let sx = 0, sy = 0, sz = 0, n = 0;
            for (let i = 0; i < pts.length; i += 3) {
              const key = Math.round(pts[i] * q) + ',' + Math.round(pts[i+1] * q) + ',' + Math.round(pts[i+2] * q);
              if (seen.has(key)) continue;
              seen.add(key);
              sx += pts[i]; sy += pts[i+1]; sz += pts[i+2]; n++;
            }
            st.cen = n ? [sx/n, sy/n, sz/n] : [0, 0, 0];
          }
          return st.cen;
        });
        const dv = [];
        for (let i = 1; i < cen.length; i++) {
          if (i % perAxis === 0) { dv.push(null); continue; }
          dv.push([cen[i][0]-cen[i-1][0], cen[i][1]-cen[i-1][1], cen[i][2]-cen[i-1][2]]);
        }
        // THE DEADBAND, and why it is not optional. A rigid part that merely
        // TURNS has a centroid sitting still on its own axis, so its step
        // vectors are pure float noise and their directions flip essentially
        // at random — the first run of this called the chain, the fusee, both
        // train wheels, the dial and the power reserve reciprocators, which
        // they emphatically are not. Noise is only distinguishable from
        // motion by SCALE, so the track must go somewhere real before any of
        // its direction changes mean anything.
        //
        // Two gates, both self-scaling so neither is a magic number:
        //   1. the centroid track's extent must be a real fraction of the
        //      part's own size — a part whose centroid moves a thousandth of
        //      its own diagonal is rotating or static, not translating;
        //   2. within such a track, individual steps below a thousandth of
        //      that extent are noise and do not vote.
        let tLo = [Infinity, Infinity, Infinity], tHi = [-Infinity, -Infinity, -Infinity];
        for (const c of cen) for (let k = 0; k < 3; k++) {
          if (c[k] < tLo[k]) tLo[k] = c[k]; if (c[k] > tHi[k]) tHi[k] = c[k];
        }
        const trackExtent = Math.hypot(tHi[0]-tLo[0], tHi[1]-tLo[1], tHi[2]-tLo[2]);
        const partSize = Math.hypot(xHi-xLo, yHi-yLo, zHi-zLo);
        // TODO 43 (3): a flip is a CANDIDATE, not a verdict — collect the
        // axis each one fires in, for the confirm pass below. At 12 samples
        // a long-span axis aliases a genuine circular ORBIT (the crown's
        // knurl teeth under alarmWind: 210° per step, consecutive chords
        // pointing against each other while the spin is monotone), and no
        // local test can tell an aliased orbit from a true reversal — but a
        // finer look at the SAME axis can: the aliased flip evaporates when
        // the step rate resolves the path, the true reversal reproduces at
        // any rate.
        const flipAxes = new Set();
        if (trackExtent > Math.max(1e-4, partSize * 1e-3)) {
          const floor = trackExtent * 1e-3;
          let prev = null;
          for (let j = 0; j < dv.length; j++) {
            const b = dv[j];
            if (!b) { prev = null; continue; }             // axis boundary
            const lb = Math.hypot(b[0], b[1], b[2]);
            if (lb < floor) continue;                      // noise: no vote
            if (prev) {
              const la = Math.hypot(prev[0], prev[1], prev[2]);
              if ((prev[0]*b[0] + prev[1]*b[1] + prev[2]*b[2]) / (la*lb) < -1e-6) flipAxes.add(Math.floor((j + 1) / perAxis));
            }
            prev = b;
          }
        }
        const pathReversed = flipAxes.size > 0;
        // §36B: a path hull instead of the single AABB this used to be. The
        // AABB is kept alongside as `box` so anything still reading it works,
        // but `kind` is now 'path' and the check CLAIMS it.
        volumes.push({
          unit: u.name, mesh: m, meshName: m.name || undefined, kind: 'path',
          box: [xLo, yLo, zLo, xHi, yHi, zHi],
          boxes: buildPathHull(poseBoxes, perAxis),
          zBand: [zLo, zHi], reversed: pathReversed,
          reversedVia: pathReversed ? 'track' : undefined,   // centroid translated out and back
          _confirm: pathReversed ? { type: 'track', axes: [...flipAxes], partSize } : undefined,
        });
        continue;
      }
      // REVOLVE about (cx, cy) ∥ z. r-band and per-frame θ extent.
      // This is the ONE consumer that genuinely wants per-vertex data (§80's
      // point 2): an r band and an angular extent about an axis that is not
      // known until the fit above has run, so no reduction taken during the
      // walk could have served it. It is still paid once per distinct frame,
      // not once per pose — `st.arc` is keyed to the frame, and the r band is
      // a min/max, so repeats add nothing either way.
      const { cx, cy } = fit;
      let rLo = Infinity, rHi = -Infinity;
      for (const st of states) {
        const pts = st.pts;
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
        st.arc = { lo: base + aLo, hi: base + aHi, width: aHi - aLo };
      }
      const arcs = Array.from(stateAt, (s) => states[s].arc);
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
      // TODO 43: steps are the WITNESS VERTEX's angle about the fitted
      // centre, not the extent's `lo`. Under rigid rotation the witness
      // angle advances by exactly the rotation δ; `lo` only mostly does —
      // it is `base + aLo`, and for a body whose extent nears the full
      // circle, WHICH vertex sits just past the ±π wrap flips as the body
      // turns, so aLo occasionally jumps by one whole vertex gap. For the
      // train's slow wheels δ is far smaller than a 16-segment gap, so
      // every wrap crossing flipped a step's sign and promoted a monotone
      // rotor to 'oscillates'. The biased fit of the previous cut HID this:
      // an off-axis centre reads an annular body as a partial lobe with a
      // stable lo. The extent stays what it was for — coverage bins.
      const witA = Array.from(stateAt, (s) => {
        const st = states[s];
        if (st.witA === undefined) st.witA = Math.atan2(st.pts[1] - cy, st.pts[0] - cx);
        return st.witA;
      });
      const steps = [];
      for (let i = 1; i < witA.length; i++) {
        if (i % perAxis === 0) { steps.push(null); continue; }   // axis boundary: not a movement
        let step = witA[i] - witA[i - 1];
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
      // §48 CONSUMES THIS FACT, so it is now computed for every part rather
      // than only where the reversal test still had a decision to make. It
      // used to sit behind `if (!full)`, which meant a part already promoted
      // by the SPOKE rule never had its direction sampled at all — and the
      // spoke rule fires first for exactly the fast oscillators §48 is
      // hunting. Consuming that set would have quietly excluded them: a check
      // that searches for less than the thing it verifies. Same loop, same
      // epsilon, same axis-boundary skip; only the guard moved.
      // TODO 43 (3): as with the track test, a sign flip is a CANDIDATE tied
      // to its axis — the confirm pass re-samples that axis finer and only a
      // reproduced flip keeps the flag. Witness-angle steps alias exactly
      // like chords once an axis turns a part more than π per sample.
      // The sign chains across DWELLS rather than adjacent steps: a part
      // that parks between its two strokes (the fork on its bankings, most
      // of every beat) puts zero steps between the + and the −, and an
      // adjacent-step product never sees the flip — the finer the sampling,
      // the blinder that test gets, which is exactly backwards. A dwell
      // step neither votes nor resets; only an axis boundary resets. The
      // per-step floor is 1e-6 rad — the same bar the old product test set
      // (two steps at 1e-6 were its −1e-12), applied per step.
      const arcFlipAxes = new Set();
      {
        let prev = null;
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          if (s === null) { prev = null; continue; }         // axis boundary
          if (Math.abs(s) < 1e-6) continue;                  // dwell: no vote, no reset
          if (prev !== null && s * prev < 0) arcFlipAxes.add(Math.floor((i + 1) / perAxis));
          prev = s;
        }
      }
      let reversed = arcFlipAxes.size > 0;
      let dilate = 0;
      if (!full && reversed && !bounded) { full = true; reason = 'oscillates'; }
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
          unit: u.name, mesh: m, meshName: m.name || undefined, kind: 'path',
          box: null, boxes: buildPathHull(poseBoxes, perAxis), zBand: [zLo, zHi],
          from: 'oscillates', reversed,
          reversedVia: reversed ? 'arc' : undefined,         // turned one way then the other
          _confirm: reversed ? { type: 'arc', axes: [...arcFlipAxes], cx, cy } : undefined,
        });
        continue;
      }
      volumes.push({
        unit: u.name, mesh: m, meshName: m.name || undefined, kind: 'revolve', axis: [cx, cy],
        rBand: [rLo, rHi], zBand: [zLo, zHi],
        bins: full ? null : bins, full, reason, reversed,
        reversedVia: reversed ? 'arc' : undefined,
        declaredRad: dilate || undefined,
        coverage: full ? 1 : +(bins.reduce((a, b) => a + b, 0) / THETA_BINS).toFixed(4),
        _confirm: reversed ? { type: 'arc', axes: [...arcFlipAxes], cx, cy } : undefined,
      });
    }
  }

  // THE ASSERT §36 REQUIRES: every declared volume must CONTAIN its part at
  // every pose. Validated against a FINER, phase-shifted sample set than the
  // one the hull was derived from — checking a hull against its own samples
  // would be vacuous, and catching a hull that is merely stale is the point.
  //
  // §80: the fine sweep is STREAMED. It used to be materialised exactly like
  // the coarse one — 261 frames of every vertex of every mesh, ~4 GB alive —
  // and then read three times, by the containment pass, the sleeve dilation
  // and the demotion pass. But nothing downstream of it wants POINTS: those
  // three passes want a verdict, a worst overshoot and a pair of bands. So
  // each vertex is now transformed, asked its questions and dropped, and what
  // survives the pose is the handful of numbers below. Nothing is thrown away
  // that a later pass turns out to need — which is why the containment test no
  // longer stops at the first escaping vertex for the two kinds whose later
  // passes measure the whole sweep. Everything a lap of the walk could have
  // been asked for is asked for on that lap, because a second lap is not
  // available (see walkPoses).
  const tol = 1e-3;
  let coarseFrames = 0, coarseVertices = 0;
  for (const rec of coarse.values()) {
    coarseFrames += rec.states.length;
    for (const st of rec.states) coarseVertices += st.pts.length / 3;
  }
  coarse = null;                    // derivation is done: let the frames go

  const measureFine = (vol, m, pos) => {
    const mw = m.matrixWorld, n = pos.count;
    if (vol.kind === 'static') {
      const zl = vol.zBand[0] - tol, zh = vol.zBand[1] + tol;
      for (let i = 0; i < n; i++) {
        _wv.fromBufferAttribute(pos, i).applyMatrix4(mw);
        if (_wv.z < zl || _wv.z > zh) return { bad: 'z' };
      }
      return { bad: null };
    }
    if (vol.kind === 'approx') {
      const b = vol.box;
      for (let i = 0; i < n; i++) {
        _wv.fromBufferAttribute(pos, i).applyMatrix4(mw);
        if (_wv.x < b[0] - tol || _wv.x > b[3] + tol || _wv.y < b[1] - tol
            || _wv.y > b[4] + tol || _wv.z < b[2] - tol || _wv.z > b[5] + tol) return { bad: 'box' };
      }
      return { bad: null };
    }
    if (vol.kind === 'path') {
      // §36 job B's sleeve: contained if the vertex is inside ANY of its
      // boxes. Adding this case was the fix for a hard crash — job B
      // introduced a FOURTH volume shape and the dispatch had three arms, the
      // last of which assumed revolve and read vol.axis[0]. A path volume fell
      // into it and threw on an axis it never has, taking buildSweptRegistry
      // down and with it every check built on the registry.
      //
      // Worth naming the shape of the mistake: the bug was not the missing
      // field, it was an `else` standing in for "therefore revolve". A dispatch
      // whose default arm assumes one specific kind silently inherits every
      // kind added later.
      //
      // ONE number answers both questions the sleeve is asked. `best` is the
      // vertex's Chebyshev distance to the nearest box (0 inside), so
      // containment is `best <= tol` — the same test the old boolean loop ran,
      // with the same `break` the moment a box contains the point — and the
      // dilation's overshoot is the largest `best` over the sweep. Measuring
      // both at once is what lets the dilation be computed without the second
      // read of a stored fine sweep.
      const boxes = vol.boxes;
      let over = 0;
      for (let i = 0; i < n; i++) {
        _wv.fromBufferAttribute(pos, i).applyMatrix4(mw);
        const x = _wv.x, y = _wv.y, z = _wv.z;
        let best = Infinity;
        for (const b of boxes) {
          const dx = Math.max(b[0] - x, 0, x - b[3]);
          const dy = Math.max(b[1] - y, 0, y - b[4]);
          const dz = Math.max(b[2] - z, 0, z - b[5]);
          const dd = Math.max(dx, dy, dz);
          if (dd < best) best = dd;
          if (best === 0) break;
        }
        if (best > over && isFinite(best)) over = best;
      }
      return { bad: over > tol ? 'sleeve' : null, over };
    }
    // REVOLVE. `bad` is the containment verdict (r, then z, then the arc);
    // `rzWhy` is the same verdict with the ARC left out, which is the question
    // the demotion pass asks of a volume the arc test has already widened.
    const cx = vol.axis[0], cy = vol.axis[1];
    const rl = vol.rBand[0] - tol, rh = vol.rBand[1] + tol;
    const zl = vol.zBand[0] - tol, zh = vol.zBand[1] + tol;
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let rLo = Infinity, rHi = -Infinity, bad = null, rzWhy = null;
    for (let i = 0; i < n; i++) {
      _wv.fromBufferAttribute(pos, i).applyMatrix4(mw);
      const x = _wv.x, y = _wv.y, z = _wv.z;
      const r = Math.hypot(x - cx, y - cy);
      if (r < rLo) rLo = r; if (r > rHi) rHi = r;
      if (x < box[0]) box[0] = x; if (x > box[3]) box[3] = x;
      if (y < box[1]) box[1] = y; if (y > box[4]) box[4] = y;
      if (z < box[2]) box[2] = z; if (z > box[5]) box[5] = z;
      const rBad = r < rl || r > rh, zBad = z < zl || z > zh;
      if (!bad) {
        if (rBad) bad = `r=${r.toFixed(3)}`;
        else if (zBad) bad = `z=${z.toFixed(3)}`;
        else if (!vol.full) {
          // A vertex is contained if its bin, or either neighbour, is
          // covered — one bin of slack for the discretisation itself.
          const b = thetaBin(Math.atan2(y - cy, x - cx));
          if (!vol.bins[b] && !vol.bins[(b + 1) % THETA_BINS] && !vol.bins[(b + THETA_BINS - 1) % THETA_BINS]) bad = 'θ';
        }
      }
      if (!rzWhy) { if (rBad) rzWhy = 'r'; else if (zBad) rzWhy = 'z'; }
    }
    return { bad, rzWhy, rLo, rHi, box };
  };

  for (const vol of volumes) {
    vol._fine = { byState: new Map(), bad: null, over: 0, rzWhy: null,
                  rLo: Infinity, rHi: -Infinity,
                  box: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity] };
  }
  await walkPoses(validatePerAxis, () => {
    for (const vol of volumes) {
      const F = vol._fine;
      const m = vol.mesh, pos = m.geometry.getAttribute('position');
      vertexTransformsNaive += pos.count;
      // A verdict is all these two kinds ever produce, so once they have one
      // there is nothing left to measure. The other two are accumulating over
      // the whole sweep and must run it out.
      if (F.bad && (vol.kind === 'static' || vol.kind === 'approx')) continue;
      const id = poseStateOf(poseStates, m);
      let v = F.byState.get(id);
      if (v === undefined) {
        v = measureFine(vol, m, pos);
        vertexTransforms += pos.count;
        F.byState.set(id, v);
      }
      if (v.bad && !F.bad) F.bad = v.bad;             // folded in POSE order
      if (vol.kind === 'path') { if (v.over > F.over) F.over = v.over; }
      else if (vol.kind === 'revolve') {
        if (v.rzWhy && !F.rzWhy) F.rzWhy = v.rzWhy;
        if (v.rLo < F.rLo) F.rLo = v.rLo; if (v.rHi > F.rHi) F.rHi = v.rHi;
        for (let k = 0; k < 3; k++) {
          if (v.box[k] < F.box[k]) F.box[k] = v.box[k];
          if (v.box[3 + k] > F.box[3 + k]) F.box[3 + k] = v.box[3 + k];
        }
      }
    }
  });

  const escapes = [];
  for (const vol of volumes) {
    const F = vol._fine;
    if (!F.bad) continue;
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
    escapes.push({ unit: vol.unit, kind: vol.kind, why: F.bad, widened: vol.kind === 'revolve' || vol.kind === 'path' });
    if (vol.kind === 'revolve') { vol.full = true; vol.bins = null; vol.reason = 'validation'; }
    else if (vol.kind === 'path') {
      const grow = F.over * 2 + tol;
      for (const bx of vol.boxes) { bx[0] -= grow; bx[1] -= grow; bx[2] -= grow; bx[3] += grow; bx[4] += grow; bx[5] += grow; }
      vol.dilatedBy = +grow.toFixed(4);
    }
  }

  // Second pass over the widened set: whatever still escapes is a genuine
  // failure of the hull's SHAPE (its r or z band), not of its arc, and no
  // amount of angular widening fixes it. This is the number that must be 0.
  const stillEscaping = [];
  // Widened SLEEVES are re-checked here too. §80 makes this pass's standing
  // plain, and it is weaker than the old comment here claimed ("the honest
  // arbiter … what this pass genuinely arbitrates is whether the doubled
  // headroom holds"). Growing every box of the sleeve by g moves a vertex's
  // Chebyshev distance to the nearest box from `best` to max(0, best − g), so
  // "still outside" means best > g + tol; g is 2·over + tol and `over` is the
  // largest `best` the fine sweep produced, so best ≤ over < g and the test
  // CANNOT fire. It is vacuous by construction, not merely self-fulfilling.
  // Kept as written — it is the assertion the shape of the dilation earns, and
  // an assertion that cannot fail should say so rather than disappear — but
  // recorded as debt (TODO 34): a sleeve validated only against the sweep its
  // own dilation was measured from has not been validated by anything
  // independent. Reduced here to the one comparison that decided it, because
  // that is what makes the emptiness legible instead of hiding it behind a
  // per-vertex loop over a stored sweep.
  for (const vol of volumes) {
    if (!(vol.kind === 'path' && vol.dilatedBy)) continue;
    const bad = vol._fine.over > vol.dilatedBy + tol;
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
  // The same question of a full revolve — does its r or z band hold the part
  // over the whole fine sweep? — answered from what the walk measured rather
  // than from a stored copy of it. `rzWhy` is the first r-or-z escape in pose
  // then vertex order, which is the offender the per-frame loop used to report;
  // `box` is the fine sweep's own extent, which is where the demoted hull came
  // from. Note that this pass is NOT vacuous the way the sleeve pass above is:
  // an arc widened by the containment test leaves r and z untouched, so a
  // volume can still fail here — the registry says plainly it cannot hull the
  // part rather than shipping a hull that does not contain it.
  for (const vol of volumes) {
    if (vol.kind !== 'revolve' || !vol.full) continue;
    const bad = vol._fine.rzWhy;
    if (bad) {
      // Its r or z band cannot hold it, so the motion is not really a
      // rotation about the fitted axis — the circle fit was a coincidence
      // of the sampled path.
      const b = vol._fine.box;
      stillEscaping.push({ unit: vol.unit, why: bad, demotedToApprox: true });
      vol.kind = 'approx'; vol.box = [b[0], b[1], b[2], b[3], b[4], b[5]];
      delete vol.axis; delete vol.rBand; delete vol.bins; vol.full = false;
    }
  }
  for (const vol of volumes) delete vol._fine;

  // TODO 43 (3) — THE REVERSAL CONFIRM PASS, §36 job B's shape applied to
  // the `reversed` flag: a coarse-walk sign flip is a report, and only a
  // flip that REPRODUCES at a 4× finer look at its own axis becomes the
  // verdict §48 consumes. What this separates: a true reciprocation flips
  // at every sampling rate, while an ALIASED flip — a genuine circular
  // orbit stepped past its Nyquist rate, the crown's knurl teeth under
  // alarmWind's 6.42 turns at 210°/step — evaporates the moment the rate
  // resolves the path. Only the FLAG is patched: the hulls above were
  // validated as built, and a path hull is sound for a mover whether or
  // not it reciprocates, so kind and boxes stay exactly what the
  // containment walk approved. These mini-walks run AFTER both standing
  // walks so neither's pose history moves (the two-walk rule above); their
  // own poses land on whatever cumulative state the standing walks left,
  // which is the right frame for the question asked — reciprocation
  // reproduces at any parity, absolute pose does not matter to a sign.
  // TODO 7's caveat stands one level up: sampling still cannot BOUND
  // motion; this pass removes a class of false positives, not the class
  // of false negatives.
  {
    const pending = volumes.filter((v) => v._confirm);
    if (pending.length) {
      const nFine = perAxis * 4;
      const byAxis = new Map();
      for (const v of pending) {
        v._confirmedIn = new Set();
        for (const ai of v._confirm.axes) {
          if (!byAxis.has(ai)) byAxis.set(ai, []);
          byAxis.get(ai).push(v);
        }
      }
      for (const [ai, list] of byAxis) {
        const axis = axes[ai];
        const tracks = new Map(list.map((v) => [v, []]));
        let k = 0;
        for (let s = 0; s < nFine; s++) {
          clock.setPose(axis.pose(s / (nFine - 1), clock));
          for (const v of list) {
            const m = v.mesh;
            if (v._confirm.type === 'arc') {
              const pos = m.geometry.getAttribute('position');
              _wv.fromBufferAttribute(pos, 0).applyMatrix4(m.matrixWorld);
              tracks.get(v).push(Math.atan2(_wv.y - v._confirm.cy, _wv.x - v._confirm.cx));
            } else {
              const pos = m.geometry.getAttribute('position');
              const seen = new Set();
              let sx = 0, sy = 0, sz = 0, n = 0;
              for (let i = 0; i < pos.count; i++) {
                _wv.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
                const key = Math.round(_wv.x * CEN_KEY_Q) + ',' + Math.round(_wv.y * CEN_KEY_Q) + ',' + Math.round(_wv.z * CEN_KEY_Q);
                if (seen.has(key)) continue;
                seen.add(key);
                sx += _wv.x; sy += _wv.y; sz += _wv.z; n++;
              }
              tracks.get(v).push(n ? [sx / n, sy / n, sz / n] : [0, 0, 0]);
            }
          }
          if (++k % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
        }
        for (const v of list) {
          const t = tracks.get(v);
          let flips = false;
          if (v._confirm.type === 'arc') {
            // same dwell-chaining as the coarse test — a fork parked on its
            // banking between strokes must not launder the sign
            let prev = null;
            for (let i = 1; i < t.length && !flips; i++) {
              let step = t[i] - t[i - 1];
              while (step > Math.PI) step -= Math.PI * 2;
              while (step < -Math.PI) step += Math.PI * 2;
              if (Math.abs(step) < 1e-6) continue;           // dwell: no vote, no reset
              if (prev !== null && step * prev < 0) flips = true;
              prev = step;
            }
          } else {
            // the track test's own deadband, on this axis's fine track alone
            const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
            for (const c of t) for (let j = 0; j < 3; j++) { if (c[j] < lo[j]) lo[j] = c[j]; if (c[j] > hi[j]) hi[j] = c[j]; }
            const ext = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
            if (ext > Math.max(1e-4, v._confirm.partSize * 1e-3)) {
              const floor = ext * 1e-3;
              let prev = null;
              for (let i = 1; i < t.length && !flips; i++) {
                const b = [t[i][0] - t[i-1][0], t[i][1] - t[i-1][1], t[i][2] - t[i-1][2]];
                const lb = Math.hypot(b[0], b[1], b[2]);
                if (lb < floor) continue;
                if (prev) {
                  const la = Math.hypot(prev[0], prev[1], prev[2]);
                  if ((prev[0]*b[0] + prev[1]*b[1] + prev[2]*b[2]) / (la * lb) < -1e-6) flips = true;
                }
                prev = b;
              }
            }
          }
          if (flips) v._confirmedIn.add(ai);
        }
      }
      for (const v of pending) {
        if (!v._confirmedIn.size) {
          v.reversed = false;
          delete v.reversedVia;
          if (v.from === 'oscillates') v.from = 'oscillates-unconfirmed';
        }
        delete v._confirmedIn;
      }
    }
    for (const vol of volumes) delete vol._confirm;
  }

  clock.resetInputs();
  const byKind = volumes.reduce((a, v) => (a[v.kind] = (a[v.kind] || 0) + 1, a), {});
  return {
    derivedFrom: { axes: axes.length, perAxis, validatedAt: validatePerAxis },
    // §80 — what the sweep paid, against what it would have paid transforming
    // every mesh afresh at every pose (which is what it used to do). The ratio
    // is a property of the MOVEMENT, not of the code: it is how much of the
    // scene each pose axis leaves standing still, so it is worth reporting
    // rather than assuming. `coarseFrames` is the peak number of distinct
    // world-vertex frames held at once — the old figure was meshes x poses, for
    // the coarse sweep AND again, 2.4x larger, for the fine one, which now
    // holds none at all. `coarseVertices` x 24 bytes is that peak in memory.
    sampling: {
      vertexTransforms, vertexTransformsNaive,
      saved: +(1 - vertexTransforms / vertexTransformsNaive).toFixed(4),
      coarseFrames, coarseFramesNaive: meshes.length * axes.length * perAxis,
      coarseVertices, fineFrames: 0,
    },
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

// ---------------------------------------------------------------------------
// §36 PART THREE — ROUTING AS A SPEC.
//
// §35's corridor hunt was done BY HAND: two shafts, one knuckle, four
// ray-proved bush stations, and a great deal of probing to establish that a
// rod could get from the column wheel to the selector ring without hitting
// anything on the way. That hunt is the manual proof this automates — the
// drawn path becomes the SPEC and the parts are solved from it.
//
// THE RULE THAT MAKES IT A ROUTING PROBLEM AND NOT A COLLISION TEST:
//
//   * STRUCTURAL METAL IS DRILLABLE. A plate, a bridge, a pillar — a route
//     through one is legal, because a bore gets drilled. §35 did exactly
//     this: the selector rod passes a bore through BOTH plates.
//   * A SWEPT VOLUME IS REFUSED. Anything a moving part can reach is not
//     negotiable, because there is nothing to drill — the space is occupied
//     in time rather than in matter.
//
// The registry already draws that line and did not know it: a `static`
// volume is a part that never moves, and `revolve`/`path` are the swept ones.
// So the routing question is answerable from §36's own output with no new
// sampling, which is the whole reason this is a §36 part and not its own
// entry.
//
// REFUSAL IS PER-SEGMENT AND NAMES THE VOLUME, inheriting §33's vocabulary
// (refused / warned / proposed): a route that cannot be built should say
// which leg is impossible and what occupies it, not merely fail.
const ROUTE_SAMPLE_STEP = 0.25;      // units along a segment — a quarter of the stock floor's diameter

const _routeInRevolve = (v, p, clearance) => {
  const dx = p[0] - v.axis[0], dy = p[1] - v.axis[1];
  const r = Math.hypot(dx, dy);
  if (r < v.rBand[0] - clearance || r > v.rBand[1] + clearance) return false;
  if (p[2] < v.zBand[0] - clearance || p[2] > v.zBand[1] + clearance) return false;
  if (v.full || !v.bins) return true;                 // full revolve: every azimuth
  let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI * 2;
  const bin = Math.min(v.bins.length - 1, (a / (Math.PI * 2) * v.bins.length) | 0);
  return v.bins[bin] === 1;
};
const _routeInBoxes = (boxes, p, clearance) => {
  for (const b of boxes) {
    if (p[0] >= b[0] - clearance && p[0] <= b[3] + clearance &&
        p[1] >= b[1] - clearance && p[1] <= b[4] + clearance &&
        p[2] >= b[2] - clearance && p[2] <= b[5] + clearance) return true;
  }
  return false;
};

// What occupies a point, or null. Structural metal is reported but not
// refused — the caller decides, and the distinction is the entry's rule.
export function routeOccupantAt(reg, p, clearance = CLEAR_MARGIN, exclude = null) {
  const vols = reg._volumes || reg.registry || [];
  for (const v of vols) {
    // THE LINKAGE BEING ROUTED CANNOT BLOCK ITSELF. Without this the check is
    // useless for the only thing it is for: §35's real corridor came back
    // REFUSED, and every volume named was the alarm link's own — the rod
    // objecting to the space the rod occupies. Re-routing an existing linkage
    // means asking whether the space would be free once it is lifted out.
    if (exclude && exclude.has(v.unit)) continue;
    let hit = false;
    if (v.kind === 'revolve') hit = _routeInRevolve(v, p, clearance);
    else if (v.kind === 'path') hit = v.boxes ? _routeInBoxes(v.boxes, p, clearance)
                                : v.box ? _routeInBoxes([v.box], p, clearance) : false;
    else if (v.kind === 'static') hit = v.box ? _routeInBoxes([v.box], p, clearance)
                                : (p[2] >= v.zBand[0] - clearance && p[2] <= v.zBand[1] + clearance
                                   && v.rBand && _routeInRevolve({ ...v, full: true }, p, clearance));
    else if (v.kind === 'approx' && v.box) hit = _routeInBoxes([v.box], p, clearance);
    if (!hit) continue;
    return { unit: v.unit, mesh: v.meshName || null, kind: v.kind,
             swept: v.kind === 'revolve' || v.kind === 'path' || v.kind === 'approx' };
  }
  return null;
}

// THE CHECK. A polyline in world units; each segment judged on its own.
export async function checkRoute(clock, points, opts = {}) {
  const reg = opts.registry || await buildSweptRegistry(clock, opts);
  const clearance = opts.clearance ?? CLEAR_MARGIN;
  const exclude = opts.exclude ? new Set(opts.exclude) : null;
  const segs = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(2, Math.ceil(len / ROUTE_SAMPLE_STEP));
    const blocking = new Map(), drilled = new Map();
    let firstBlockAt = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const occ = routeOccupantAt(reg, p, clearance, exclude);
      if (!occ) continue;
      const key = `${occ.unit}${occ.mesh ? '/' + occ.mesh : ''}`;
      if (occ.swept) {
        if (!blocking.has(key)) blocking.set(key, { ...occ, atFraction: +t.toFixed(3) });
        if (firstBlockAt === null) firstBlockAt = +t.toFixed(3);
      } else if (!drilled.has(key)) drilled.set(key, occ);
    }
    const block = [...blocking.values()];
    segs.push({
      index: i, from: a, to: b, length: +len.toFixed(3),
      verdict: block.length ? 'refused' : 'legal',
      // §33's shape: a refusal states WHAT and WHERE, not just that it failed.
      refuse: block.length
        ? `leg ${i + 1} enters ${block.map((x) => x.unit + (x.mesh ? `/${x.mesh}` : '')).join(', ')}`
          + ` at ${(firstBlockAt * 100).toFixed(0)}% along — swept volume, nothing to drill`
        : null,
      blockedBy: block,
      drillsThrough: [...drilled.values()].map((d) => d.unit + (d.mesh ? `/${d.mesh}` : '')),
    });
  }
  const refused = segs.filter((s) => s.verdict === 'refused');
  return {
    ok: refused.length === 0,
    legs: segs.length, refusedLegs: refused.length,
    // Structural metal crossed by a LEGAL route is not a problem, it is a
    // bill of materials: every one of these is a bore somebody has to drill.
    bores: [...new Set(segs.flatMap((s) => s.drillsThrough))],
    verdict: refused.length ? refused[0].refuse : 'route is legal — every leg clears the swept volumes',
    segments: segs,
  };
}

// THE SYNTHESIS. A legal polyline is a spec; these are the parts it implies.
// §35 derived exactly this by hand and is the shape to match: straight arbors
// between knuckles, and bush stations wherever a run's surrounding column is
// clear enough to hang one.
export async function solveRoute(clock, points, opts = {}) {
  const reg = opts.registry || await buildSweptRegistry(clock, opts);
  const route = await checkRoute(clock, points, { ...opts, registry: reg });
  if (!route.ok) return { ok: false, route, arbors: [], knuckles: [], bushes: [] };
  const exclude = opts.exclude ? new Set(opts.exclude) : null;
  const bushR = opts.bushRadius ?? 0.45;   // §35's ray-proved bush radius
  const arbors = [], bushes = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    arbors.push({ index: i, from: a, to: b, length: +len.toFixed(3) });
    // A bush needs its own clearance, wider than the rod's: it is a ring
    // around the arbor, so it is tested at the BUSH's radius, which is what
    // §35's note means by "ray-proved AT THE BUSH'S 0.45 RADIUS".
    const n = Math.max(2, Math.ceil(len / ROUTE_SAMPLE_STEP));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      if (routeOccupantAt(reg, p, bushR, exclude)) continue;
      const prev = bushes[bushes.length - 1];
      // One station per clear stretch, not one per sample.
      if (prev && prev.arbor === i && Math.abs(prev.t - t) < 0.12) { prev.t = t; prev.at = p; continue; }
      bushes.push({ arbor: i, t: +t.toFixed(3), at: p });
    }
  }
  return {
    ok: true, route,
    arbors,
    knuckles: points.slice(1, -1).map((p, i) => ({ between: [i, i + 1], at: p })),
    bushes: bushes.map((b) => ({ arbor: b.arbor, at: b.at.map((v) => +v.toFixed(2)) })),
  };
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

// §50 — A DECLARED FLOOR ON STOCK THICKNESS. §40 measured; this asserts.
//
// The census's thin end was the alarm work at 0.0075-0.0487 mm against real
// going-train wheels at ~0.10-0.15. The thinnest row — 7.5 MICRONS — was
// identified first, per the entry, and it is a design rather than a defect:
// §34's alarmIndexLine, a registration MARKING deliberately proud only 0.02
// units into a declared margin chain. Which is why the floor is per KIND: a
// wheel, a pivot, a spring and a printed marking cannot honestly share one
// number, and a flat 0.12 would condemn a hairspring for being accurate.
//
// Every floor is CITED, not invented (rule 1 applied to floors):
export const STOCK_FLOORS = {
  //          mm       basis
  wheel:   { mm: 0.12,  basis: 'the entry\'s figure; sits at the thin end of the 0.10-0.15 mm band §40 measured for the going train. THE DEFAULT for any part that declares nothing.' },
  pivot:   { mm: 0.07,  basis: 'real train pivots run 0.07-0.12 mm' },
  spring:  { mm: 0.03,  basis: 'real hairsprings run 0.02-0.04 mm; flat springs thicker' },
  marking: { mm: 0.005, basis: 'printed/inlaid dial indices are a 5-10 micron film — relief, not stock' },
  hand:    { mm: 0.10,  basis: 'real blued-steel hands run 0.10-0.20 mm blade stock' },
  // §104 — the governor's poising ring gets its own kind rather than
  // borrowing the wheel's: a drawn-brass ring is wire stock, not sheet.
  // The window is 0.2–0.8 mm section: below 0.2 a ring at these diameters
  // loses its roundness to handling, above 0.8 it is plate bar. The floor
  // gates here; the UPPER bound is the equalisation gate's (the section is
  // SOLVED from I_a, so only that gate knows what the solve produced).
  ring:    { mm: 0.20,  basis: 'drawn-brass poising-ring stock runs 0.2-0.8 mm section; the solve must land inside it' },
};
// DEGENERATE floor — the unarguable tier, gating from day one: below this a
// solid is not thin metal but broken geometry (invisible, z-fighting, a
// hazard to the volume registry). Kind declarations cannot excuse it unless
// the kind's own cited floor is lower (marking is, deliberately).
export const DEGENERATE_STOCK_MM = 0.01;
// Kind declarations. Per PART, with per-MESH overrides for named exceptions —
// the same string-keyed table discipline as MECH_GRAPH, living beside it.
// Anything absent defaults to \'wheel\' and its 0.12 floor, and the report
// lists the default rows separately so the table\'s gaps are visible, not
// silent.
export const STOCK_KIND_BY_PART = {
  Hairspring: 'spring',
  Chain: 'pivot',            // link stock: pin-scale, not wheel-scale
  // TODO 12 tranche four: the sub-dial hand units contain only hand stock.
  'Small seconds': 'hand',
  'Power reserve': 'hand',
};
export const STOCK_KIND_BY_MESH = {
  alarmIndexLine: 'marking',       // §34 registration line, cited above
  alarmFeelerSpring: 'spring',     // §40\'s first honesty nominee — a real blade
  alarmDiscTrack: 'marking',       // printed track on the disc face
  // Triage additions — honest kinds, not escape hatches. The maintaining
  // spring and the alarm pin spring are real flat springs (0.052 both, above
  // the cited 0.03 spring floor, so declaring clears them legitimately); the
  // three alarm pins are pin-stock, though two still sit under even the
  // pivot floor and stay inside the debt below.
  maintSpring: 'spring',
  alarmHammerSpring: 'spring',     // §48/TODO 14 — flat blade at SPRING_FLAT_U
  alarmHammerSpringStud: 'pivot',  // ...and the grounded stud it hangs from
  alarmPinSpringB: 'spring',
  alarmFeelerPin: 'pivot',
  alarmSelPin: 'pivot',
  alarmPinB: 'pivot',
  alarmLinkCentrePin: 'pivot',    // TODO 20 fork — the crank pin riding the groove: pin stock (⌀ 0.105 mm ≥ the 0.07 pivot floor)
  // TODO 12 first tranche — honest kinds found during the thickening pass:
  shockLyreSpring: 'spring',   // the gold anti-shock lyre: real ones are 0.05-0.10 mm wire
  studPinScrew: 'pivot',       // the stud clamp's side pin: pin stock, clears the pivot floor
  // TODO 12 tranche two:
  setupClickSpring: 'spring',  // the set-up click's return spring — blued arc, 0.09 mm
  jumperClickSpring: 'spring', // the minute jumper's return spring — same construction, 0.075 mm
  mainspringRibbon: 'spring',  // the coil IS the mainspring
  mainspringHook: 'spring',    // its hook tab, same stock
  // TODO 1 — the ARBOR's hook, the ribbon's other end. Pin stock at 0.101 mm
  // (clears the 0.07 pivot floor). Its section is not a choice: it is one
  // ribbon thickness, because at full wind the second coil comes down to coil
  // bind and anything standing further proud of the collar is buried in it.
  mainspringArborHook: 'pivot',
  // §89 — the ALARM barrel's arbor hook, the same part on the smaller barrel
  // and the same argument: its section is one ribbon thickness (0.19024 u,
  // 0.0712 mm) because the second coil comes down to bind on it. Pin stock,
  // and it clears the 0.07 pivot floor by 0.0012 — the alarm work's
  // quarter-to-half scale (TODO 11) leaves nothing spare here.
  alarmSpringArborHook: 'pivot',
  barrelClickPawl: 'spring',   // integral click: spring-tempered pawl stock
  // §47 — the winding arrest:
  windArrestSpring: 'spring',     // the torsion blade (tube ⌀ 0.09 u) — spring stock
  windArrestStud: 'pivot',        // the hanging stud — pin-class
  windArrestStudHead: 'pivot',    // its retaining head
  windArrestBank: 'pivot',        // the seat pin
  windArrestSpringPost: 'pivot',  // the blade's anchor pin
  // §99 — the alarm barrel's own click:
  alarmClickPawl: 'spring',    // the click blade — same spring-tempered pawl stock as the going side's
  alarmClickSpring: 'spring',  // the solved-arc torus (tube ⌀ 0.2 u) — spring stock
  alarmClickStud: 'pivot',     // the shoulder screw's post — pin-class, ⌀ 1.0 u over the pivot floor
  yokeSpring: 'spring',        // TODO 50 — the clutch's restoring blade, an arc about the yoke's pivot
  yokeSpringPost: 'pivot',     // …and the pin its fixed end reacts on
  // §100 (TODO 39) — the going drum's FIXED arbor, now built where it is
  // static (Set-up work). Shaft stock, kinded as the striking arbor's
  // sleeve is: the census reports each mesh's extent, and both sections
  // clear the pivot floor by an order of magnitude (⌀ 1.8 u and 1.2 u).
  mainspringDrumArbor: 'pivot',
  mainspringDrumStaff: 'pivot',
  // TODO 11 tranche two:
  alarmNose: 'pivot',          // the follower's ruby nose-pin — pin stock (0.09 mm ≥ the 0.07 pivot floor); its 0.24 u height is §29-bound co-planar with the heart, declared not thickened
  switchClickSpring: 'spring', // the switch detent's blade — spring stock, though at 0.026 mm it stays in the debt even so
  alarmLockSpring: 'spring',   // §102 — the lock's return blade, the same SPRING_FLAT_U stock and the same standing debt
  alarmLockSpringStud: 'pivot', // ...and its plate-top anchor — pin stock over the pivot floor
  alarmSelPost: 'pivot',       // the selector's three guide posts — pin stock clearing the pivot floor
  // TODO 11 tranche five. Three parts that were being judged as WHEELS for
  // want of a name, each measured and kinded rather than thickened:
  alarmLockBeakRiser: 'pivot',       // the beak's post off the lock tail — ⌀ 0.1061 mm on its flats, over the pivot floor
  alarmFollowerSpringStud: 'pivot',  // the follower blade's grounded stud — ⌀ 0.1137 mm (alarmHammerSpringStud's twin)
  // The striking arbor's turned step between cam and pinion. Its row is the
  // STEP's length (0.3 u), not a section: the census does not subdivide an
  // arbor, so a shaft drawn in three meshes reports each one's extent. The
  // stock is the shaft — ⌀ 1.5 u, 0.57 mm.
  alarmStrikeSleeve: 'pivot',
  // §20 — every screw's merged slot inlay: a slot is a RECESS rendered as a
  // dark film over the head (the chaton convention), not stock. Same class
  // as alarmDiscTrack. The HEADS carry no entry on purpose: they are real
  // stock at STOCK_MIN_U and must keep answering to the wheel floor.
  screwSlots: 'marking',
  // §153 — the sub-dial pocket walls' SILVERING: a plated film laid on the
  // machined wall (makeDial builds it from the same loops the plate was cut
  // with — the wall's matter is the dialPlate solid, which keeps answering
  // to the wheel floor). Its bounding-box "thickness" is the pocket's
  // DEPTH, so the deep seconds well cleared the wheel floor by coincidence
  // (0.19 mm ≥ 0.12) and the reserve's barely-recessed sector (0.05 mm)
  // exposed the misclassification. Same class as screwSlots/alarmDiscTrack.
  reserveSubdialWall: 'marking',
  secondsSubdialWall: 'marking',
  // §45 — the release run's declared kinds, built to their floors (no new
  // waivers): the tail pin and sleeve posts are pin stock at/over the pivot
  // floor (the alarmSelPost precedent), the plunger and head are pin-class
  // rod (⌀ 0.114 mm), and the return blade is a real flat spring at
  // SPRING_FLAT_U. Everything else in both units is sheet at STOCK_MIN_U
  // and answers to the wheel floor with no entry, on purpose.
  alarmTailPin: 'pivot',
  alarmSleevePost: 'pivot',
  // §104 — the governor's kinds, declared on arrival (no defaults left to
  // the report): shafts and studs are shaft/pin stock; the solved ring is
  // its own kind above; the collar is a turned bush (pin-class wall, the
  // alarmClickStud convention). Wheel, pinion, saw, anchor plate, arms and
  // pallets are sheet/wheel stock and answer to the wheel floor with no
  // entry, on purpose.
  alarmGovStud: 'pivot',
  alarmGovAnchorStud: 'pivot',
  alarmGovSleeve: 'pivot',
  alarmGovArbor: 'pivot',
  alarmGovAnchorArbor: 'pivot',
  // §107 — three anchor meshes that declared nothing and took the 'wheel'
  // default in silence. The floor they land on is the same 0.12 mm; what
  // changes is that it is now a DECLARATION rather than a gap, so the census
  // stops listing them as parts nobody classified. TODO 45 owns the harder
  // half: the blades' true section is measured across the face and is thinner
  // than the AABB this census can see, so passing here is not a clean bill.
  alarmGovAnchor: 'wheel', alarmGovAnchorArm: 'wheel', alarmGovPallet: 'wheel',
  alarmGovRing: 'ring',
  alarmGovRingCollar: 'pivot',
  alarmLifterPlunger: 'pivot',
  alarmLifterHead: 'pivot',
  alarmLifterBlade: 'spring',
  // §45 stage 2:
  alarmSilPivot: 'pivot',
  alarmSilRiser: 'pivot',
  alarmSilFinger: 'pivot', // the finger's contact tip — pin stock, ⌀ 0.072 mm over the 0.07 floor
  alarmSilBlade: 'spring',
};

// §50 TRIAGE (2026-07-26) — every remaining violation dispositioned, none
// deleted. A waiver is ACCEPTED DEBT citing its TODO item, not a pass: the
// row stays in the report under 'waived' with the reference, and the gate
// counts only unwaived rows. Two debts:
//   TODO 11 — the alarm work is quarter-to-half-scale stock (0.015–0.10 mm):
//   §29 bought its z corridor WITH thickness, so the fix re-buys z — a design
//   task, not a multiplier.
//   TODO 12 — the 0.05–0.12 band (going-train stragglers, the balance cock's
//   jewel assembly and regulator furniture, jumper, small-seconds, set-up
//   work) wants a ~20–45% per-part thickening toward each part's free side.
// ---------------------------------------------------------------------------
// §54 — SLENDERNESS. A minimum thickness is not a minimum stiffness.
//
// §50 gave every part a floor on its thinnest dimension, and that closed a
// real class of defect: parts too thin to exist. It cannot see the next class
// at all, because STIFFNESS GOES AS t⁴/L³ and the floor knows nothing about L.
//
// The alarm link is the case that prompted this (TODO 16). Its beak tail is
// 0.12 mm section — EXACTLY `STOCK_MIN_U`, built deliberately to the floor —
// and 10.0 mm long, so it passes by construction while being 84× longer than
// it is thick. Meanwhile the same unit's centre crank, at 0.045 mm the
// THINNEST part in the movement's alarm work, is 280× STIFFER, because it is
// short. The thickness floor ranks these two exactly backwards.
//
// WHICH DIMENSION, and why not the thinnest. A flat lever is wide and thin on
// purpose: it bends easily out of plane and is stiff in the plane its load
// acts in, and judging it by its sheet thickness would flag every correctly
// made lever and spring in the movement. So slenderness is measured against
// the SECOND-smallest extent — the stiffest section dimension available. A
// part that is slender even in its stiff direction is slender however it is
// oriented, and there is no argument to have about it. That makes this test
// deliberately conservative: it under-reports rather than crying wolf.
//
// SPRINGS AND MARKINGS ARE EXEMPT BY KIND, not waived. A spring that is not
// slender is not a spring; a printed index is a film, not a member. Flagging
// them would be a category error, so they never enter the population.
//
// REPORT, NOT A GATE — §40's rule, and §50's own history. §50 reported, was
// triaged over four tranches, and only then gated. Arriving as a gate is how
// a check gets switched off. `ok` is always true; the rows are the product.
//
// TODO 78 — AND UNTIL TODO 78 IT WAS NEITHER, because it was never registered
// in CHECKS below: `start(clock, 'slenderness')` answered "unknown check", so
// it had no BATTERY row either and had not executed once since §52 put the
// battery in CI. Everything the paragraphs above promise was true of code
// nobody ran. What IS gated now is what can be held on day one — the
// synthetic control and every declared bearing table's validity — and the λ
// rows stay a report, 7 of them unwaived and untriaged.
//
// It also measured the wrong LENGTH: each mesh's bounding box end to end,
// which for a shaft running in bushes is not a free length. TODO 16's own
// "general lesson" had asked for L/t PER SEGMENT and §54 shipped only the L/t
// half. See userData.bearings and SLENDER_OVERHANG_K below.
export const SLENDER_MAX = SLENDER_MAX_U;   // layout.js owns it: geometry derives from the same number
export const SLENDER_BASIS =
  'real watch arbors and levers run L/t of roughly 5–20; 30 is generous headroom, '
  + 'set so nothing correctly proportioned trips it and only real outliers do';
// PER-KIND CEILINGS, for parts whose job IS to be long and thin. Found by
// running the check, not predicted: the small-seconds hand came back at λ 31.5
// and that is not a defect, it is what a hand is — real blued-steel seconds
// hands run λ 30–50 over a 0.10–0.20 mm blade. Flagging it would be the same
// category error as flagging a spring, just less obvious. A hand still gets a
// ceiling rather than an exemption: a hand at λ 200 would be a real finding.
export const SLENDER_MAX_BY_KIND = {
  hand: 50,   // real seconds hands are 0.10–0.20 mm blades at λ 30–50
};
const SLENDER_EXEMPT_KINDS = new Set(['spring', 'marking']);
// Accepted debt, citing the item that owns it — the STOCK_WAIVERS convention.
// A waived row is still reported; the waiver records that someone has looked.
// The alarm link's SHAFT is accepted debt. TODO 16 carries it.
//
// THE PREMISE THIS WAIVER USED TO CITE IS DEAD, and it stood here for two
// entries after src/main.js said so in capitals. It read: "two attempts to
// thicken it were rejected by CI (Alarm link ⇄ Minute jumper, overlap 0.312
// then 0.310), so section is not the lever". §112 re-solved the rod chord and
// that pair has been 13.32 u apart ever since; §137 measured the real wall
// (the alarm setting idler, max legal r 0.2850 over 89 stations) and took the
// section to its force floor.
//
// WHAT KEEPS IT WAIVED TODAY, measured rather than argued (TODO 78 registered
// the check that measures it): the governing free length is the ROD-END
// OVERHANG, 12.487 u at λₑ 127.6, and λ ≤ 30 there wants r ≥ 0.5244 against a
// corridor of 0.2850. The waiver also covers `alarmLinkRod` at λ 31.4. Its
// beak tail WAS fixed and is off this report on merit. TODO 79 owns the
// overhang, which is a chord-growth regression rather than a design.
export const SLENDER_WAIVERS = {
  'Alarm link': 'TODO 16',
};

// Young's modulus for the movement's steels/brasses, order of magnitude. The
// stiffness column is INFORMATIONAL: a first-order cantilever estimate, good
// to a factor of two, included because "λ = 84" means less to a reader than
// "10 N/m — it bends a tenth of a millimetre under a milligram-ish load".
//
// I IS THE RECTANGULAR SECOND MOMENT, ac³/12, for every part — this check reads
// a bounding box and a box cannot tell a round shaft from a square bar. For a
// cylinder that overstates I by 64/12π = 1.70×, so a round member's number here
// reads 1.7× STIFFER than it is. Inside the stated factor of two, and named
// because the alarm link's lay shaft is round and §137's force budget derives
// its own figures from πr⁴/4: the two are not the same number and neither is
// wrong (TODO 78 — the rod-end overhang is 36 N/m by this column and 21.2 N/m
// by πr⁴/4, which is the one comparable to §137's 2807 N/m drive end).
const SLENDER_E_PA = 200e9;

// §54 / TODO 78 — AN OVERHANG IS NOT A SPAN, and this is how much not.
//
// λ is a proxy for BENDING COMPLIANCE, and compliance goes as L³ over a
// coefficient that the END CONDITIONS set, not the length:
//
//   simply supported, load at midspan   k = 48EI/L³   ← between two bearings
//   cantilever, load at the free tip    k =  3EI/L³   ← past the last bearing
//
// Each free length is judged at its own most compliant load point, so the
// ratio is 48/3 = 16: an overhang is SIXTEEN times as flexible as a span of
// the same length. Equal compliance means equal L³/coefficient, so the length
// that makes an overhang as stiff as a span is the CUBE ROOT of that ratio.
//
// THE DATUM IS THE SPAN, because that is what SLENDER_MAX was calibrated on —
// SLENDER_BASIS' "real watch arbors and levers run L/t of roughly 5–20" is
// quoted pivot to pivot. Taking the cantilever as datum would instead DISCOUNT
// declared spans, and a rule that lets a part improve its number by declaring
// bearings is a laundering device. This one can only ever make a part read
// WORSE than its undeclared whole-stock λ, and that asymmetry is what makes a
// declaration safe to trust.
//
// WHY A MULTIPLIER AT ALL, when the banner above insists the measure stays
// geometric: without it the measure ranks the lengths BACKWARDS, which is the
// exact failure §54 exists to fix one level up. Measured on the alarm link's
// lay shaft (tools/probe-slenderness-bearings.mjs):
//
//   span     19.550 u   raw λ 79.3    88.4 N/m
//   overhang 12.487 u   raw λ 50.6    21.2 N/m   ← 4× the compliance
//
// Raw λ calls the span the problem; the stiffness column calls the overhang
// the problem. With K the overhang reads λ 127.6 and the two agree.
//
// IT IS A SIMPLIFICATION, AND IT ERRS THE SAFE WAY. A cantilever hanging past
// a simple support with a real back span deflects Pa²(L+a)/3EI at its tip, not
// Pa³/3EI, because the back span rotates — worse than this rule by a further
// ≈1.4× on this shaft. §54's charter is to under-report rather than cry wolf,
// so the simpler LOCAL rule is the right one: it judges each free length on
// its own terms, which is also what lets the validator judge a declaration
// without knowing its neighbours. A reader who computes the coupled figure
// should find that choice written here rather than meet it as a discrepancy.
//
// NOT the Euler column factors (K = 1 pinned-pinned, 2 fixed-free): this is a
// BENDING measure, not a buckling one — the stiffness column says which —
// and importing buckling's K would be a second, unrelated derivation wearing
// the same symbol.
export const SLENDER_OVERHANG_K = Math.cbrt(48 / 3);   // 2.5198

// "On the surface counts" — §77's INTERIOR_EPS value, for the same reason: a
// bearing sitting exactly on the metal's end face is a real construction (a
// plate bush at an arbor's very end), not a station off the part.
const SLENDER_BEARING_EPS = 1e-6;

// A mesh may DECLARE where it is held:
//
//   mesh.userData.bearings = { axis: 'x'|'y'|'z', stations: [ … ] }
//
// `stations` are GEOMETRY-LOCAL coordinates on that axis — the frame
// computeBoundingBox() measures in — so no pose, no parent rotation and no
// group azimuth can move a station off the metal it names.
//
// It rides the MESH, never the geometry, for two reasons and the second is
// load-bearing: which bearings hold a shaft is an INSTALLATION fact (two
// meshes can share one CylinderGeometry and be borne differently), and
// weldGeometry returns a fresh BufferGeometry without copying `userData`, so a
// geometry-level declaration would be silently deleted by weldTree at the end
// of boot — a clean report of work that did not happen.
//
// The axis is DECLARED and then validated against the box's longest extent
// rather than derived from it: deriving silently would hide a builder naming
// the wrong direction, validating makes it a failure. A malformed declaration
// is a GATED failure AND the mesh falls back to its whole-stock reading — a
// bad declaration must never quietly buy the shorter measurement. §77's
// sub-body tables are the precedent for both halves.
function validateBearings(decl, ext, longAxis, box) {
  const bad = (why) => ({ ok: false, why });
  if (!decl || typeof decl !== 'object' || Array.isArray(decl)) return bad('bearings is not an object');
  const { axis, stations } = decl;
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') return bad(`axis ${JSON.stringify(axis)} is not x, y or z`);
  if (axis !== longAxis)
    return bad(`axis '${axis}' is not the mesh's longest extent ('${longAxis}' is: ${ext[axis].toFixed(4)} vs ${ext[longAxis].toFixed(4)})`);
  if (!Array.isArray(stations) || !stations.length || !stations.every((s) => Number.isFinite(s)))
    return bad('stations is not a non-empty array of finite numbers');
  // Strictly ascending catches unsorted AND duplicated in one test.
  for (let i = 1; i < stations.length; i++)
    if (!(stations[i] > stations[i - 1]))
      return bad(`stations are not strictly ascending: ${stations[i]} follows ${stations[i - 1]}`);
  const lo = box.min[axis], hi = box.max[axis];
  for (const s of stations)
    if (s < lo - SLENDER_BEARING_EPS || s > hi + SLENDER_BEARING_EPS)
      return bad(`bearing at ${axis} ${s.toFixed(4)} is outside the mesh's own extent (${lo.toFixed(4)} … ${hi.toFixed(4)})`);
  return { ok: true, axis, stations, lo, hi };
}

// The free lengths a declaration cuts the metal into, with the end conditions
// that set each one's effective length. A zero-length end (a bearing sitting
// on the end face) is not an overhang and is dropped rather than reported as
// a length of nothing.
function slenderSegments(lo, hi, stations) {
  const cuts = [lo, ...stations, hi];
  const out = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const L = cuts[i + 1] - cuts[i];
    if (!(L > SLENDER_BEARING_EPS)) continue;
    const kind = (i === 0 || i === cuts.length - 2) ? 'overhang' : 'span';
    out.push({ kind, from: cuts[i], to: cuts[i + 1], L,
      effectiveL: kind === 'overhang' ? L * SLENDER_OVERHANG_K : L });
  }
  return out;
}

// POSITIVE CONTROL, synthetic and in-check — §77's rule, and ci-battery's own
// note beside `restoring`: a control that quietly stops passing is how this
// class of check dies. A 40 × 1 × 1 bar driven through the SAME
// validateBearings and slenderSegments the scene walk uses, because a control
// that exercises a copy proves nothing. It cannot be deleted by fixing the
// scene (TODO 27's lesson, cited in checkMeshIntegrity's own control).
function slendernessControl() {
  const fails = [];
  const box = new THREE.Box3(new THREE.Vector3(-20, -0.5, -0.5), new THREE.Vector3(20, 0.5, 0.5));
  const ext = { x: 40, y: 1, z: 1 };
  const near = (a, b) => Math.abs(a - b) <= 1e-9;

  // A bearing sitting exactly ON an end face is a real construction (a plate
  // bush at an arbor's very end) and must produce no zero-length overhang —
  // the case that would otherwise report a free length of nothing.
  {
    const e = validateBearings({ axis: 'x', stations: [-20, 10] }, ext, 'x', box);
    if (!e.ok) fails.push(`a bearing on the end face was rejected: ${e.why}`);
    else {
      const segs = slenderSegments(box.min.x, box.max.x, e.stations);
      if (segs.length !== 2) fails.push(`an end-face bearing produced ${segs.length} free lengths, expected 2`);
      else if (segs[0].kind !== 'span' || !near(segs[0].L, 30) || segs[1].kind !== 'overhang' || !near(segs[1].L, 10))
        fails.push('an end-face bearing mis-classified its free lengths');
    }
  }

  // Two bearings at ±10 cut 10 / 20 / 10 — and the 10-long OVERHANG must
  // outrank the 20-long span, which is the whole point of the multiplier and
  // the exact reversal this landing exists to surface.
  const v = validateBearings({ axis: 'x', stations: [-10, 10] }, ext, 'x', box);
  if (!v.ok) fails.push(`a valid declaration was rejected: ${v.why}`);
  else {
    const segs = slenderSegments(box.min.x, box.max.x, v.stations);
    if (segs.length !== 3) fails.push(`expected 3 free lengths, got ${segs.length}`);
    else {
      const worst = segs.reduce((a, b) => (b.effectiveL > a.effectiveL ? b : a));
      if (worst.kind !== 'overhang') fails.push('the 20-long span outranked a 10-long overhang — SLENDER_OVERHANG_K is not being applied');
      if (!near(worst.effectiveL, 10 * SLENDER_OVERHANG_K)) fails.push(`governing effective length ${worst.effectiveL} is not 10·K`);
      if (!near(segs[1].effectiveL, 20)) fails.push('a span was scaled — K must apply to overhangs only');
    }
  }

  // Every rejection the validator owes, each one a defect someone could ship.
  const rejects = [
    [{ axis: 'x', stations: [25] }, 'a station outside the extent'],
    [{ axis: 'x', stations: [10, -10] }, 'unsorted stations'],
    [{ axis: 'x', stations: [10, 10] }, 'duplicate stations'],
    [{ axis: 'y', stations: [0] }, 'an axis that is not the longest extent'],
    [{ axis: 'q', stations: [0] }, 'an axis that is not x, y or z'],
    [{ axis: 'x', stations: [] }, 'empty stations'],
    [{ axis: 'x', stations: [0, NaN] }, 'a non-finite station'],
    [[-10, 10], 'an array where an object is required'],
  ];
  for (const [decl, why] of rejects)
    if (validateBearings(decl, ext, 'x', box).ok) fails.push(`accepted ${why}`);

  return fails.length ? `FAIL — ${fails.join('; ')}` : `PASS (${rejects.length + 5} cases)`;
}

const _slBoxPt = new THREE.Vector3(), _slBox = new THREE.Box3();

export function checkSlenderness(clock, opts = {}) {
  const max = opts.max || SLENDER_MAX;
  // supportAt below reads matrixWorld to place a declared station in the
  // scene, and start()'s resetInputs may have moved parts since the last
  // paint — a check must not depend on a frame having been drawn.
  clock.scene.updateMatrixWorld(true);
  // Nearest-ancestor dedupe — §40's rule. Units nest, so without it a mesh
  // inside two labelled subtrees is reported twice and the second row is not
  // a duplicate but a FALSE attribution: it names a part that does not move.
  // Plus collectUnits' schematic-subtree prune (§71), which this check did
  // NOT have until TODO 78: it used a bare traverse, so §71's plate occluder
  // FILLS — real Meshes, parented inside labelled units — sat in its
  // population. A fourth copy of both idioms; consolidating the walks is
  // filed in TODO 4. (A traverse callback cannot prune a subtree, which is
  // why this is a recursive walk and not a traverse with a guard.)
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
  const hops = (mesh, name) => {
    const target = unitObj.get(name);
    let n = 0;
    for (let o = mesh; o; o = o.parent, n++) if (o === target) return n;
    return Infinity;
  };
  const byMesh = new Map();
  const walk = (o, unitName) => {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh && o.geometry?.attributes?.position) {
      const prev = byMesh.get(o);
      if (!prev || hops(o, unitName) < hops(o, prev.unit)) byMesh.set(o, { unit: unitName, mesh: o });
    }
    for (const c of o.children) walk(c, unitName);
  };
  for (const e of clock.labelEntries) walk(e.obj, e.name);

  // §48's no-spring guard, made GEOMETRIC. auditOscillators proves a declared
  // spring's NAME is in the scene; for a bearing the stronger test exists and
  // is the one that matters — is there METAL at the station. Restricted to the
  // declaring mesh's own unit: a bush is part of the part it holds, and a
  // neighbouring unit that happens to overlap the point is not a bearing.
  // Single-pose and box-wise, the mode every instrument in this file runs in.
  const supportAt = (mesh, unitName, axis, s) => {
    _slBoxPt.set(0, 0, 0);
    _slBoxPt[axis] = s;
    _slBoxPt.applyMatrix4(mesh.matrixWorld);
    const root = unitObj.get(unitName);
    let found = null;
    const seek = (o) => {
      if (found || (o.userData && o.userData.schematic)) return;
      if (o.isMesh && o !== mesh && o.geometry?.attributes?.position) {
        _slBox.setFromObject(o);
        if (_slBox.containsPoint(_slBoxPt)) { found = o; return; }
      }
      for (const c of o.children) seek(c);
    };
    if (root) seek(root);
    return found;
  };

  const rows = [], exempt = [], malformed = [], unsupported = [];
  let declaredMeshes = 0, declaredStations = 0;
  for (const { unit, mesh } of byMesh.values()) {
    const name = mesh.name || '(unnamed)';
    const kind = STOCK_KIND_BY_MESH[name] || STOCK_KIND_BY_PART[unit] || 'wheel';
    if (SLENDER_EXEMPT_KINDS.has(kind)) { exempt.push({ unit, mesh: name, kind }); continue; }
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    const ext = { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
    const d = [ext.x, ext.y, ext.z].sort((x, y) => x - y);
    const [tMin, tMid, len] = d;
    if (!(tMid > 1e-9) || !(len > 1e-9)) continue;          // degenerate: §50's business, not this one
    const ceiling = SLENDER_MAX_BY_KIND[kind] || max;
    const a = tMin * UNIT_MM * 1e-3, c = tMid * UNIT_MM * 1e-3;
    const I = (a * c * c * c) / 12;
    const kOf = (L_u, coeff) => +(coeff * SLENDER_E_PA * I / (L_u * UNIT_MM * 1e-3) ** 3).toFixed(1);

    const decl = mesh.userData && mesh.userData.bearings;
    if (!decl) {
      // UNDECLARED: today's statements exactly, with the segment machinery
      // skipped entirely rather than reproduced — a part nobody declared
      // cannot move because this landing exists.
      const lambda = len / tMid;
      if (lambda <= ceiling) continue;
      rows.push({
        unit, mesh: name, kind,
        lambda: +lambda.toFixed(1), ceiling,
        thin_mm: +(tMin * UNIT_MM).toFixed(4),
        section_mm: +(tMid * UNIT_MM).toFixed(4),
        length_mm: +(len * UNIT_MM).toFixed(3),
        cantileverStiffness_N_per_m: kOf(len, 3),
        waived: SLENDER_WAIVERS[unit] || null,
      });
      continue;
    }

    const longAxis = ext.x === len ? 'x' : ext.y === len ? 'y' : 'z';
    const v = validateBearings(decl, ext, longAxis, b);
    if (!v.ok) {
      malformed.push({ unit, mesh: name, why: v.why });
      const lambda = len / tMid;                    // fall back to whole stock
      if (lambda > ceiling) rows.push({
        unit, mesh: name, kind,
        lambda: +lambda.toFixed(1), ceiling,
        thin_mm: +(tMin * UNIT_MM).toFixed(4),
        section_mm: +(tMid * UNIT_MM).toFixed(4),
        length_mm: +(len * UNIT_MM).toFixed(3),
        cantileverStiffness_N_per_m: kOf(len, 3),
        waived: SLENDER_WAIVERS[unit] || null,
        declarationRejected: v.why,
      });
      continue;
    }
    declaredMeshes++;
    declaredStations += v.stations.length;
    for (const s of v.stations) {
      const held = supportAt(mesh, unit, v.axis, s);
      if (!held) unsupported.push({ unit, mesh: name, axis: v.axis, station: +s.toFixed(4),
        why: 'a declared bearing with no mesh at it — a support that does not exist as metal' });
    }
    const segs = slenderSegments(v.lo, v.hi, v.stations);
    const worst = segs.reduce((x, y) => (y.effectiveL > x.effectiveL ? y : x));
    const lambda = worst.effectiveL / tMid;
    if (lambda <= ceiling) continue;
    rows.push({
      unit, mesh: name, kind,
      lambda: +lambda.toFixed(1), ceiling,
      thin_mm: +(tMin * UNIT_MM).toFixed(4),
      section_mm: +(tMid * UNIT_MM).toFixed(4),
      length_mm: +(worst.L * UNIT_MM).toFixed(3),   // the GOVERNING free length
      stock_mm: +(len * UNIT_MM).toFixed(3),        // …of this much metal
      lambdaWholeStock: +(len / tMid).toFixed(1),   // what it would read undeclared
      bearings: v.stations.length,
      governing: { kind: worst.kind, L_u: +worst.L.toFixed(4), effectiveL_u: +worst.effectiveL.toFixed(4) },
      stiffnessModel: worst.kind === 'span' ? '48EI/L³' : '3EI/L³',
      cantileverStiffness_N_per_m: kOf(worst.L, worst.kind === 'span' ? 48 : 3),
      segments: segs.map((s) => ({
        kind: s.kind, from: +s.from.toFixed(4), to: +s.to.toFixed(4),
        L_u: +s.L.toFixed(4), L_mm: +(s.L * UNIT_MM).toFixed(4),
        lambdaRaw: +(s.L / tMid).toFixed(1), lambdaEffective: +(s.effectiveL / tMid).toFixed(1),
        stiffness_N_per_m: kOf(s.L, s.kind === 'span' ? 48 : 3),
      })),
      waived: SLENDER_WAIVERS[unit] || null,
    });
  }
  rows.sort((x, y) => y.lambda - x.lambda);
  const unwaived = rows.filter((r) => !r.waived);
  return {
    ok: true,                       // §40 rule: a REPORT. Nothing here can fail.
    gate: 'control PASS, 0 malformed and 0 unsupported bearing declarations — the λ rows are a REPORT (§40)',
    control: slendernessControl(),
    max, basis: SLENDER_BASIS,
    measuredAgainst: 'the SECOND-smallest extent — the stiffest section dimension available — over the longest FREE length, which is the whole mesh unless it declares userData.bearings',
    overhangK: +SLENDER_OVERHANG_K.toFixed(4),
    counted: byMesh.size, exemptByKind: exempt.length,
    over: rows.length, unwaived: unwaived.length,
    bearings: { declaredMeshes, stations: declaredStations, malformed, unsupported },
    rows,
  };
}

// ---------------------------------------------------------------------------
// §77 tiers 0+1 — MESH INTEGRITY: what a single mesh does to ITSELF.
//
// Every collision instrument above judges a mesh WHOLE — one mesh against
// another, a unit's movers against its fixtures, a mesh's extents. Nothing
// examines a mesh's own triangles, and that third blindness class has
// produced three measured defects (TODO 27's rivets through solid plate,
// TODO 28's zero-area gap strips, TODO 4/73's builder slivers) plus one
// live crash: a parity ray landing on a zero-area face hit the vendored
// raycast's unguarded null and sent an `assembly` row to `unmeasurable`
// (TODO 73 — the guard is the vendored file's third patch; this check is
// the instrument that holds the population it guards against).
//
// A REPORT, §40's rule: `ok` is always true, the rows are the product, and
// the battery row gates only what can be held on arrival — the in-check
// synthetic controls and the sub-body declaration table's validity. The
// zeroArea and inverted rows land red by design (the scene measures
// thousands of zero-area faces today) and are triaged into TODO.md, never
// waived at birth. NOTE the fingerprint is no regression guard for any of
// this: it hashes per-unit AABBs at 11 poses, and TODO 4 measured the
// inside-out castellations moving no AABB and no clearance verdict — only
// this check's own report diff watches this class.
//
// Tier 1's word is `zeroArea`, deliberately NOT "degenerate":
// `checkStockFloor` owns that word for a different measurement (a unit
// whose EXTENT collapses, gated as "0 degenerate") across its gate string,
// return field, the CI fails closure and four probes — and TODO 4/73 both
// already say "zero-area" for the triangle sense. Adopting their word
// resolves §77's collision clause with zero renames and no report movement.
//
// No memoization anywhere: the chain swaps in a new geometry per tension
// change (MODELING.md rule 6), so the walk reads whatever geometry each
// mesh holds at the reset pose, every run.

// Tier 1 threshold, DERIVED (rule 1) — tools/probe-77-threshold.mjs
// histograms every inspected triangle's geometry-local area: the defective
// population tops out in the 1e-15 decade (absarc seam twins, earcut
// hole-bridge slivers; 2 at 1e-22 are TODO 73's minimum) and the smallest
// INTENDED triangles start at 1e-10, a four-decade empty band. 1e-12 sits
// two decades from each bound; re-run the probe before moving it.
export const ZERO_AREA_MAX = 1e-12;
// Tier 0 floor: a genuinely inverted closed body measures MINUS its own
// volume — order bboxVol/10 — while an open or sheet-like body's signed sum
// is float noise around zero. 1e-3 of the bbox volume separates the two by
// orders of magnitude; a body flagged here is inside-out, not thin.
export const INVERTED_VOL_FRAC = 1e-3;

// Classify one triangle given its nine coords. Exported for the probe.
// `collapsed` = two vertex POSITIONS bit-identical (an edge of zero
// length); `collinear` = distinct points, exactly zero area; `sliver` =
// area below ZERO_AREA_MAX but nonzero — the float-seam class that an
// exact weld rightly refuses to merge (the absarc twins differ by ~1e-15)
// and a repeated-index test therefore finds NOTHING of.
function classifyTriangle(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  const qx = uy * vz - uz * vy, qy = uz * vx - ux * vz, qz = ux * vy - uy * vx;
  const area = 0.5 * Math.sqrt(qx * qx + qy * qy + qz * qz);
  if (area >= ZERO_AREA_MAX) return { area, kind: null };
  const same = (x1, y1, z1, x2, y2, z2) => x1 === x2 && y1 === y2 && z1 === z2;
  if (same(ax, ay, az, bx, by, bz) || same(bx, by, bz, cx, cy, cz) || same(ax, ay, az, cx, cy, cz))
    return { area, kind: 'collapsed' };
  return { area, kind: area === 0 ? 'collinear' : 'sliver' };
}

// §77 tier 3 (declared route) — INTERIOR MATERIAL between two sub-bodies of
// one mesh. Not tri-tri crossing: TODO 27's own formulation, generalized —
// sample one body's vertices and ask whether any sits strictly INSIDE the
// other body's closed surface, by parity along +z over that body's triangle
// range alone. Robust exactly where tri-tri is not: a rivet head sitting
// FLUSH in its counterbore shares surfaces without sharing interior, and a
// pin through a BORED plate threads void, not material — the bore itself is
// what makes the pair legal, which is the whole point of drilling it
// (TODO 27). Legal because every buried face is capped (weldGeometry
// property 2: no mesh opens); the strictness epsilon is TODO 27's own
// 1e-6 assert floor. Zero-area triangles are SKIPPED by the crossing
// counter — the chain carries 1,040 of them (TODO 74) and a parity count
// must not consult a face with no area (the vendored raycast's third patch
// holds the same rule one layer down).
const INTERIOR_EPS = 1e-6;
function rangeInteriorTest(pos, idx, bodyA, bodyB) {
  // Sample A's unique VERTICES plus unique EDGE MIDPOINTS: vertices alone
  // miss a through-piercing (a pin crossing a thin plate leaves no vertex
  // inside the slab — its side edges' midpoints are what land there, and
  // they are exactly what TODO 27's line-sampling assert walked). Still
  // sampling, not a proof — item 7's standing caveat — but the same mode
  // every sweep in this file accepts.
  const points = [];
  const verts = new Set(), edges = new Set();
  for (let t = bodyA.triStart * 3; t < (bodyA.triStart + bodyA.triCount) * 3; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    for (const v of [a, b, c]) if (!verts.has(v)) { verts.add(v); points.push([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]); }
    for (const [u, v] of [[a, b], [b, c], [a, c]]) {
      const key = u < v ? u * 0x100000 + v : v * 0x100000 + u;
      if (edges.has(key)) continue;
      edges.add(key);
      points.push([(pos[u * 3] + pos[v * 3]) / 2, (pos[u * 3 + 1] + pos[v * 3 + 1]) / 2, (pos[u * 3 + 2] + pos[v * 3 + 2]) / 2]);
    }
  }
  let insidePoints = 0, maxSpan = 0, sampled = 0;
  for (const [px, py, pz] of points) {
    sampled++;
    // Crossings of the vertical line (px,py) with B's triangles, above and
    // below pz — the TODO 27 assert's hitsAt, restricted to one range.
    let above = 0, below = 0, nearestUp = Infinity, nearestDown = Infinity, graze = false;
    for (let t = bodyB.triStart * 3; t < (bodyB.triStart + bodyB.triCount) * 3; t += 3) {
      const ia = idx[t] * 3, ib = idx[t + 1] * 3, ic = idx[t + 2] * 3;
      const ax = pos[ia] - px, ay = pos[ia + 1] - py;
      const bx = pos[ib] - px, by = pos[ib + 1] - py;
      const cx = pos[ic] - px, cy = pos[ic + 1] - py;
      const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(d) < 1e-12) continue;                    // edge-on or zero-area: no countable crossing
      const l1 = (bx * cy - cx * by) / d, l2 = (cx * ay - ax * cy) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue; // outside the triangle's shadow
      if (l1 < 1e-9 || l2 < 1e-9 || l3 < 1e-9) { graze = true; break; } // on an edge: parity unreliable, skip the point
      const z = l1 * pos[ia + 2] + l2 * pos[ib + 2] + l3 * pos[ic + 2];
      const dz = z - pz;
      if (Math.abs(dz) <= INTERIOR_EPS) { graze = true; break; }  // on B's surface: not strictly interior
      if (dz > 0) { above++; if (dz < nearestUp) nearestUp = dz; }
      else { below++; if (-dz < nearestDown) nearestDown = -dz; }
    }
    if (graze) continue;                                    // the safe direction: a grazed sample proves nothing
    if (above % 2 === 1 && below % 2 === 1) {               // odd both ways: strictly inside B
      insidePoints++;
      const span = Math.min(nearestUp, nearestDown);
      if (span > maxSpan) maxSpan = span;
    }
  }
  return { insidePoints, maxSpan, sampled };
}

export async function checkMeshIntegrity(clock, opts = {}) {
  const yieldEvery = opts.yieldEvery ?? 16;

  // Roster: nearest-ancestor mesh dedupe (checkSlenderness' rule — units
  // nest, and a second attribution is a FALSE one), plus collectUnits'
  // schematic-subtree prune (flagged display never joins an instrument;
  // §71). A third copy of both idioms, deliberately: §77 scope-guards out
  // changes to unit collection, and this is the one landing that must move
  // no other report — consolidating the three walks is filed in TODO 4's
  // smaller items. The other two copies: collectUnits, unitBoxRows.
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
  const hops = (mesh, name) => {
    const target = unitObj.get(name);
    let n = 0;
    for (let o = mesh; o; o = o.parent, n++) if (o === target) return n;
    return Infinity;
  };
  const byMesh = new Map();     // mesh -> nearest unit name
  const walk = (o, unitName) => {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh && o.geometry?.attributes?.position) {
      const prev = byMesh.get(o);
      if (!prev || hops(o, unitName) < hops(o, prev)) byMesh.set(o, unitName);
    }
    for (const c of o.children) walk(c, unitName);
  };
  for (const e of clock.labelEntries) walk(e.obj, e.name);

  // Then dedupe by GEOMETRY: shared geometries (every screw head is one
  // lathe, every knurl ridge one cylinder) would otherwise repeat identical
  // findings per instance. A geometry row carries its instance count and
  // its distinct unit attributions; the representative mesh is the nearest-
  // hop one, which is what keeps alarmColWheel's three same-named meshes
  // three distinct rows (three geometries), not one.
  const byGeo = new Map();      // geometry -> { unit, mesh, instances, units:Set }
  for (const [mesh, unit] of byMesh) {
    const rec = byGeo.get(mesh.geometry);
    if (!rec) byGeo.set(mesh.geometry, { unit, mesh, instances: 1, units: new Set([unit]) });
    else { rec.instances++; rec.units.add(unit); }
  }

  const census = [];
  const zeroRows = [];
  const invertedRows = [];
  const malformed = [];
  const pairRows = [];
  let triangles = 0, zeroTotal = 0, exactZero = 0, declaredGeometries = 0, declaredBodies = 0;
  let pairsCandidate = 0, pairsTested = 0, pairsSkippedDeclared = 0;
  let gi = 0;
  for (const [geo, rec] of byGeo) {
    if (++gi % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
    const pos = geo.attributes.position.array;
    const idx = geo.index ? geo.index.array : null;
    const n = idx ? idx.length : geo.attributes.position.count;
    const tris = Math.floor(n / 3);
    triangles += tris;
    const meshName = rec.mesh.name || '(unnamed)';
    census.push({
      unit: rec.unit, mesh: meshName, geometryType: geo.type, tris,
      instances: rec.instances,
      ...(rec.units.size > 1 ? { alsoUnder: [...rec.units].filter((u) => u !== rec.unit).sort() } : {}),
    });

    // Tier 1 walk + tier 0 signed volume in one pass over the index.
    let collapsed = 0, collinear = 0, sliver = 0, minNonzero = Infinity;
    let vol6 = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let t = 0; t < tris * 3; t += 3) {
      const ia = (idx ? idx[t] : t) * 3, ib = (idx ? idx[t + 1] : t + 1) * 3, ic = (idx ? idx[t + 2] : t + 2) * 3;
      const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
      const bx = pos[ib], by = pos[ib + 1], bz = pos[ib + 2];
      const cx = pos[ic], cy = pos[ic + 1], cz = pos[ic + 2];
      const cl = classifyTriangle(ax, ay, az, bx, by, bz, cx, cy, cz);
      if (cl.kind === 'collapsed') collapsed++;
      else if (cl.kind === 'collinear') collinear++;
      else if (cl.kind === 'sliver') { sliver++; if (cl.area < minNonzero) minNonzero = cl.area; }
      if (cl.area === 0) exactZero++;
      // divergence-theorem volume: sum A·(B×C)/6 — exact for a closed body
      vol6 += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
      if (ax < minX) minX = ax; if (ax > maxX) maxX = ax;
      if (ay < minY) minY = ay; if (ay > maxY) maxY = ay;
      if (az < minZ) minZ = az; if (az > maxZ) maxZ = az;
    }
    const zTotal = collapsed + collinear + sliver;
    if (zTotal) {
      zeroTotal += zTotal;
      zeroRows.push({
        unit: rec.unit, mesh: meshName, geometryType: geo.type, tris,
        instances: rec.instances, collapsed, collinear, sliver,
        ...(sliver ? { minSliverArea: +minNonzero.toExponential(3) } : {}),
      });
    }
    const vol = vol6 / 6;
    const bboxVol = (maxX - minX) * (maxY - minY) * (maxZ - minZ);
    if (bboxVol > 0 && vol < -INVERTED_VOL_FRAC * bboxVol) {
      invertedRows.push({
        unit: rec.unit, mesh: meshName, geometryType: geo.type, tris,
        signedVolume: +vol.toFixed(4), bboxVolume: +bboxVol.toFixed(4),
      });
    }

    // Sub-body declarations (§77's declared route): triangle ranges into
    // the index, weld-invariant where vertex ranges are not. Validated and
    // GATED on arrival — a malformed table is a stale selector, the
    // INTRA_UNIT_CONTACTS precedent — so tier 3 can trust every range it
    // is later handed. Non-tiling coverage is legal (declare what you
    // know); out-of-bounds, overlap and name reuse are not.
    const sb = geo.userData && geo.userData.subBodies;
    if (sb !== undefined) {
      const bad = (why) => malformed.push({ unit: rec.unit, mesh: meshName, why });
      if (!Array.isArray(sb) || sb.length === 0) bad('subBodies is not a non-empty array');
      else {
        declaredGeometries++;
        const names = new Set();
        const sorted = [...sb].sort((a, b) => (a.triStart ?? 0) - (b.triStart ?? 0));
        let prevEnd = 0, okAll = true;
        for (const b of sorted) {
          if (typeof b.name !== 'string' || !b.name) { bad('a sub-body has no name'); okAll = false; break; }
          if (names.has(b.name)) { bad(`sub-body name reused: '${b.name}'`); okAll = false; break; }
          names.add(b.name);
          if (!Number.isInteger(b.triStart) || !Number.isInteger(b.triCount) || b.triStart < 0 || b.triCount <= 0) {
            bad(`sub-body '${b.name}' has a non-integral or empty range`); okAll = false; break;
          }
          if (b.triStart < prevEnd) { bad(`sub-body '${b.name}' overlaps the previous range`); okAll = false; break; }
          if (b.triStart + b.triCount > tris) { bad(`sub-body '${b.name}' runs past the mesh (${b.triStart}+${b.triCount} > ${tris} tris)`); okAll = false; break; }
          prevEnd = b.triStart + b.triCount;
        }
        if (okAll) {
          declaredBodies += sb.length;
          // Tier 3 over the validated table: per-body AABBs prefilter the
          // pairs (bodies that share no box share no interior), then the
          // interior-material test runs BOTH directions — A's vertices in
          // B and B's in A, because a thin body can pierce a fat one
          // without a fat vertex entering the thin one. A builder may
          // declare an overlap INTENTIONAL (`userData.subBodyOverlapOk`,
          // name pairs — the ∞ monogram's strokes cross by design); a
          // listed name that matches no body is a malformed row, the
          // stale-selector rule again.
          const boxes = sorted.map((b) => {
            let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
            for (let t = b.triStart * 3; t < (b.triStart + b.triCount) * 3; t++) {
              const vi = idx[t] * 3;
              const x = pos[vi], y = pos[vi + 1], z = pos[vi + 2];
              if (x < x0) x0 = x; if (x > x1) x1 = x;
              if (y < y0) y0 = y; if (y > y1) y1 = y;
              if (z < z0) z0 = z; if (z > z1) z1 = z;
            }
            return { b, x0, y0, z0, x1, y1, z1 };
          });
          const okPairs = new Set();
          const declaredOk = geo.userData.subBodyOverlapOk;
          if (declaredOk !== undefined) {
            for (const [na, nb] of declaredOk) {
              if (!names.has(na) || !names.has(nb)) { bad(`subBodyOverlapOk names an unknown body: '${!names.has(na) ? na : nb}'`); continue; }
              okPairs.add(na < nb ? `${na}|${nb}` : `${nb}|${na}`);
            }
          }
          for (let i2 = 0; i2 < boxes.length; i2++) {
            for (let j2 = i2 + 1; j2 < boxes.length; j2++) {
              const A = boxes[i2], B = boxes[j2];
              if (A.x0 > B.x1 || B.x0 > A.x1 || A.y0 > B.y1 || B.y0 > A.y1 || A.z0 > B.z1 || B.z0 > A.z1) continue;
              pairsCandidate++;
              const key = A.b.name < B.b.name ? `${A.b.name}|${B.b.name}` : `${B.b.name}|${A.b.name}`;
              if (okPairs.has(key)) { pairsSkippedDeclared++; continue; }
              pairsTested++;
              const r1 = rangeInteriorTest(pos, idx, A.b, B.b);
              const r2 = rangeInteriorTest(pos, idx, B.b, A.b);
              if (r1.insidePoints || r2.insidePoints) {
                pairRows.push({
                  unit: rec.unit, mesh: meshName, a: A.b.name, b: B.b.name,
                  insidePoints: r1.insidePoints + r2.insidePoints,
                  maxSpan: +Math.max(r1.maxSpan, r2.maxSpan).toFixed(4),
                  sampled: r1.sampled + r2.sampled,
                });
              }
            }
            if (i2 % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
          }
        }
      }
    }
  }

  census.sort((a, b) => b.tris - a.tris || a.unit.localeCompare(b.unit) || a.mesh.localeCompare(b.mesh));
  zeroRows.sort((a, b) => (b.collapsed + b.collinear + b.sliver) - (a.collapsed + a.collinear + a.sliver)
    || a.unit.localeCompare(b.unit) || a.mesh.localeCompare(b.mesh));

  // Aggregate identical per-geometry patterns: nine consumers of one
  // shared builder carrying the same 8 slivers must read as ONE row with
  // nine examples, because the fix lives in the builder (TODO 4's "clear
  // every consumer at once"), not in nine parts.
  const agg = new Map();
  for (const r of zeroRows) {
    const key = `${r.collapsed}/${r.collinear}/${r.sliver}`;
    const a = agg.get(key) || { pattern: { collapsed: r.collapsed, collinear: r.collinear, sliver: r.sliver }, geometries: 0, examples: [] };
    a.geometries++;
    if (a.examples.length < 6) a.examples.push(`${r.unit} / ${r.mesh}`);
    agg.set(key, a);
  }
  const aggregates = [...agg.values()].sort((a, b) => b.geometries - a.geometries);

  // The controls, synthetic and in-check — they cannot be deleted by fixing
  // the scene geometry that motivated them (TODO 27's lesson: this entry's
  // original control, the un-bored rivets, was fixed out of the tree).
  // Four assertions through the same classifier and volume sum the real
  // walk uses: a sliver fires, a collapsed edge fires, a healthy triangle
  // is silent, and an inverted box measures negative where the upright one
  // measures +8 exactly (TODO 4's own control values).
  const control = (() => {
    const sliver = classifyTriangle(0, 0, 0, 1, 0, 0, 0.5, 1e-13, 0);           // area 5e-14 < 1e-12
    if (sliver.kind !== 'sliver') return `BROKEN — the synthetic sliver classified '${sliver.kind}' (area ${sliver.area})`;
    const collapsed = classifyTriangle(0, 0, 0, 0, 0, 0, 1, 0, 0);
    if (collapsed.kind !== 'collapsed') return `BROKEN — the synthetic collapsed edge classified '${collapsed.kind}'`;
    const healthy = classifyTriangle(0, 0, 0, 1, 0, 0, 0, 1, 0);
    if (healthy.kind !== null) return `BROKEN — a healthy triangle classified '${healthy.kind}'`;
    // A closed 2×2×2 box, wound outward: +8 exactly. Flip the winding and
    // the same sum reads −8.
    const P = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7]];
    const volOf = (faces) => faces.reduce((s, [a, b, c]) => {
      const A = P[a], B = P[b], C = P[c];
      return s + A[0] * (B[1] * C[2] - B[2] * C[1]) + A[1] * (B[2] * C[0] - B[0] * C[2]) + A[2] * (B[0] * C[1] - B[1] * C[0]);
    }, 0) / 6;
    const up = volOf(F), down = volOf(F.map(([a, b, c]) => [a, c, b]));
    if (Math.abs(up - 8) > 1e-12) return `BROKEN — the upright box control measured ${up}, expected +8`;
    if (Math.abs(down + 8) > 1e-12) return `BROKEN — the inverted box control measured ${down}, expected −8`;

    // Tier 3's control, the un-bored chain leaf REPLICA (a check-local
    // rebuild, not an import of the template builder — main.js imports this
    // module, so importing the builder back would be a cycle; the durable
    // rule is kept, the control lives here and no geometry fix can delete
    // it): a plate at the leaf's measured 0.145 thickness with a square pin
    // through it must FIRE with the pin's midpoints inside the slab, and
    // the same plate BORED — four boxes leaving a hole the pin threads —
    // must be SILENT, because the bore is what makes a chain joint legal
    // (TODO 27, whose assert validated itself the same two ways).
    const cpos = [], cidx = [];
    const box = (cx, cy, cz, hx, hy, hz) => {
      const v0 = cpos.length / 3;
      for (const [sx, sy, sz] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]])
        cpos.push(cx + sx * hx, cy + sy * hy, cz + sz * hz);
      for (const [a, b, c] of F) cidx.push(v0 + a, v0 + b, v0 + c);   // F is outward (volOf(F) = +8 above proves it); parity ignores winding but the control keeps its solids honest
      return 12;
    };
    const T = 0.145 / 2;                                    // the leaf's half-thickness, TODO 27's measured fire depth
    let tri0 = 0;
    const bodies = [];
    const add = (name, tris) => { bodies.push({ name, triStart: tri0, triCount: tris }); tri0 += tris; };
    // Un-bored: one solid plate + a square pin standing through it.
    add('plate', box(0, 0, 0, 1, 1, T));
    add('pin', box(0, 0, 0, 0.2, 0.2, 0.5));
    const posA = Float64Array.from(cpos), idxA = Uint32Array.from(cidx);
    const fire = rangeInteriorTest(posA, idxA, bodies[1], bodies[0]);
    if (!fire.insidePoints) return 'BROKEN — the un-bored leaf replica did not fire (a pin through solid plate went unseen)';
    if (Math.abs(fire.maxSpan - T) > 0.02) return `BROKEN — the replica fired at span ${fire.maxSpan.toFixed(4)}, expected ~${T} (the plate's half-thickness)`;
    // Bored: the same plate as four boxes around a 0.3-square hole.
    cpos.length = 0; cidx.length = 0; tri0 = 0; bodies.length = 0;
    let plateTris = 0;
    plateTris += box(0, -0.65, 0, 1, 0.35, T);
    plateTris += box(0, 0.65, 0, 1, 0.35, T);
    plateTris += box(-0.65, 0, 0, 0.35, 0.3, T);
    plateTris += box(0.65, 0, 0, 0.35, 0.3, T);
    add('plate', plateTris);
    add('pin', box(0, 0, 0, 0.2, 0.2, 0.5));
    const posB = Float64Array.from(cpos), idxB = Uint32Array.from(cidx);
    const clear = rangeInteriorTest(posB, idxB, bodies[1], bodies[0]);
    if (clear.insidePoints) return `BROKEN — the BORED replica fired (${clear.insidePoints} points): the engine cannot tell a bore from a burial`;

    return 'PASS — sliver and collapsed edge fire, a healthy triangle is silent, the box measures +8 upright and −8 inverted, the un-bored leaf replica fires at the plate\'s half-thickness and the bored one is silent';
  })();

  return {
    ok: true,                     // §40 rule: a REPORT. The battery row gates control + malformed only.
    control,
    basis: {
      zeroAreaMax: ZERO_AREA_MAX,
      zeroAreaDerivation: 'probe-77-threshold.mjs: defective decades top out at 1e-15, intended start at 1e-10 — 1e-12 is two decades from each bound',
      invertedVolFrac: INVERTED_VOL_FRAC,
    },
    geometries: byGeo.size, meshes: byMesh.size, triangles,
    zeroArea: { threshold: ZERO_AREA_MAX, total: zeroTotal, exactZero, geometries: zeroRows.length, rows: zeroRows },
    inverted: { rows: invertedRows },
    aggregates,
    subBodies: {
      declaredGeometries, bodies: declaredBodies, malformed,
      pairs: {
        candidates: pairsCandidate, tested: pairsTested,
        skippedDeclaredOverlap: pairsSkippedDeclared,
        rows: pairRows.sort((a, b) => b.maxSpan - a.maxSpan || a.unit.localeCompare(b.unit) || a.a.localeCompare(b.a)),
      },
    },
    census,
  };
}

// ---------------------------------------------------------------------------
// TODO 25 tier one — THE OSCILLATOR'S RATE, WEIGHED AGAINST THE SPEC'S.
// main.js computes the frequency the built balance and hairspring IMPLY
// (I from the wheel's own published dimensions, k from the spring's cut
// section and developed length); this check reports it against the rate the
// spec declares, and re-measures the METAL to make sure those published
// dimensions still describe it.
//
// A GATE since tier two (§50's arc completed: report, triage, then gate). The
// spring is now CUT to the balance it must beat with, so the two frequencies
// agreeing is not a coincidence to be tolerated but the build's own claim —
// and a claim that stops being true is a failure, not a report. What can break
// it: a spiral plan (coils, radii, height) changed without re-solving the
// section against the new length, or a balance whose inertia no longer matches
// the spring it was cut for.
//
// The stock window is gated with it. §50's spring floor cites the real range
// in its own basis — "real hairsprings run 0.02–0.04 mm" — and a solve that
// leaves it means this balance cannot be sprung to this beat out of real wire.
// That is a design finding, so it fails here rather than being clamped away.
//
// The cross-check is what earns this a place in the inspector rather than a
// readout: userData is a CLAIM about geometry, and a claim that stops matching
// the metal is exactly the drift every other check here exists to catch.
export function checkOscillator(clock) {
  const O = clock.oscillator;
  if (!O) return { ok: true, error: 'no oscillator payload on __clock (main.js TODO 25 block missing)' };
  const mismatches = [];
  const bal = clock.labelEntries.find((e) => e.name === 'Balance');   // string-coupled, verbatim
  const hs = clock.labelEntries.find((e) => e.name === 'Hairspring');
  // The rim as CUT: vertex radial extent and z-height of the balance's first
  // mesh child, against the dimensions the builder published.
  if (bal) {
    let rim = null;
    bal.obj.traverse((o) => { if (!rim && o.isMesh && !o.userData.schematic) rim = o; });
    const wheel = bal.obj.children.find((c) => c.userData && c.userData.rim);
    if (rim && wheel) {
      const pos = rim.geometry.attributes.position;
      let rMin = Infinity, rMax = 0, zMin = Infinity, zMax = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getY(i));
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (pos.getZ(i) < zMin) zMin = pos.getZ(i);
        if (pos.getZ(i) > zMax) zMax = pos.getZ(i);
      }
      const d = wheel.userData.rim;
      const near = (a, b) => Math.abs(a - b) <= 1e-3;
      if (!near(rMax, d.rO) || !near(rMin, d.rI) || !near(zMax - zMin, d.h))
        mismatches.push({ what: 'balance rim', declared: d,
          cut: { rO: +rMax.toFixed(4), rI: +rMin.toFixed(4), h: +(zMax - zMin).toFixed(4) } });
    }
  }
  // The spring's SECTION as cut: the tube's own radial/axial half-extents at
  // its mid-ring, against the rhombus the builder declared. (Path length is
  // not re-measured here: the tube is a CatmullRom resample of the polyline
  // the builder summed, and the two differ by ~1% by construction.)
  if (hs) {
    let grp = null, tube = null;
    hs.obj.traverse((o) => {
      if (!grp && o.userData && o.userData.section) grp = o;
      if (!tube && o.isMesh && !o.userData.schematic) tube = o;
    });
    const sec = grp && grp.userData.section;
    if (sec && tube) {
      // The ribbon is cut at radius `a` and then STOOD ON EDGE by the tube's
      // scale.z, so the axial half-diagonal the section claims must be exactly
      // what that scale produces: a·scale.z. This catches the real drift —
      // someone changing the ribbon's radius or the standing scale without
      // re-deriving the section the rate is computed from.
      const s = tube.scale.z || 1;
      if (Math.abs(sec.a * s - sec.c) > 1e-6 || Math.abs(sec.a - grp.userData.ribbonR) > 1e-9)
        mismatches.push({ what: 'hairspring section', declared: sec,
          cut: { ribbonR: grp.userData.ribbonR, scaleZ: s, axialHalf: sec.a * s } });
    }
  }
  const failures = [];
  if (!O.agrees) failures.push({ what: 'rate', impliedHz: O.fImpliedHz, specHz: O.fSpecHz, tolPct: O.agreeTolPct });
  if (!O.spring.inStock) failures.push({ what: 'spring stock', h_mm: O.spring.h_mm, window: O.stockWindowMm });
  for (const m of mismatches) failures.push({ what: 'declared vs cut', ...m });
  return {
    ok: failures.length === 0,       // a GATE since tier two — the spring is cut to the rate
    agrees: O.agrees, solved: O.solved,
    impliedHz: +O.fImpliedHz.toFixed(4), specHz: O.fSpecHz, ratio: +O.ratio.toFixed(4),
    tolPct: O.agreeTolPct,
    inertia: { I_kgm2: O.I_kgm2, ...O.terms },
    spring: { k_Nm_per_rad: O.k_Nm_per_rad, ...O.spring, windowMm: O.stockWindowMm },
    mismatches, failures,
    summary: `implied ${O.fImpliedHz.toFixed(3)} Hz vs spec ${O.fSpecHz} Hz (${O.ratio.toFixed(3)}×) — ${O.agrees ? 'the spring is cut to the beat' : 'DISAGREES'}; ribbon ${O.spring.h_mm.toFixed(4)} mm ${O.spring.inStock ? 'within' : 'OUTSIDE'} real stock ${O.stockWindowMm[0]}–${O.stockWindowMm[1]} mm`,
  };
}

// ---------------------------------------------------------------------------
// TODO 32 — THE EQUALISATION, HELD. main.js derives the going spring's torque
// law from the ribbon (M = k·θ, set-up as integer ratchet clicks) and cuts
// the fusee against it; this check holds the three claims that keep that
// derivation honest, and reports the arithmetic (the oscillator's
// report→gate arc, applied to the movement's other solved spring):
//
//  1. QUANTISATION — θ_s is a whole number of set-up ratchet clicks. The one
//     pinned number in the law is an integer detent count; a θ_s that stops
//     landing on the ratchet is an authored angle wearing the ratchet's
//     clothes, which is exactly the costume TODO 32 took off the old 0.35.
//  2. THE LEVEL PRODUCT — max |springTq(t)·r(t)/K − 1| over the sampled
//     reserve at float noise. The fusee's construction makes this an
//     IDENTITY, so the tolerance is not engineering slack but arithmetic
//     consistency: the pre-TODO-40 cone is what a violation looks like — a
//     flank cut to a law the torque display no longer obeyed.
//  3. DECLARED VS CUT — the section the record's k was computed from still
//     describes the metal, for BOTH ribbons (going drum and alarm barrel):
//     a = the tube's cut radius, c = a·scale.z (the standing-on-edge scale),
//     I = a³c/3, and the frozen record's numbers match the live build's.
//     The oscillator's cross-check, verbatim, because the drift it catches
//     is the same: someone re-cutting a ribbon without re-deriving the
//     record that quotes it.
//
// §104 — the ALARM half is HELD too, since the governor exists (TODO 32
// closed). Its rows are the striking side's mirror of 1–3 plus the rows
// only a governed cadence has:
//
//  4. ALARM SET-UP QUANTISATION — 80 clicks on the §99 arbor ratchet's
//     32-tooth saw, the going side's rule on the second barrel, and the
//     built ribbon's frames must carry exactly that sweep.
//  5. THE CEILING — total wind ≤ the ribbon's measured 4.25-turn usable
//     total (the k-solve reaches devLen at 4.3 and fails at 4.4, measured
//     at 0.1-turn granularity), with the builder's own capacity positive.
//  6. THE SOLVE — gap(designWind) lands the designed ALARM_STRIKE_GAP
//     within the oscillator's 0.5% (solve the part, never re-target the
//     beat), and the ring's solved section sits in real ring stock.
//  7. MEASURED ENDPOINTS — the gate steps the SHIPPED tick law at full and
//     near-empty wind and compares the strike rate it actually produces
//     against the record's law at the measured window's mid-wind. This is
//     the row that catches a record drifting from the tick, which the
//     solve alone cannot see.
//  8. THE HAMMER'S WINDOW — the fall (a time law, TODO 14) fits the cam's
//     free fraction at the FASTEST governed gap.
export function checkEqualisation(clock) {
  const E = clock.equalisation;
  if (!E) return { ok: true, error: 'no equalisation payload on __clock (main.js TODO 32 block missing)' };
  const failures = [];
  if (!E.going.setup.quantised)
    failures.push({ what: 'set-up quantisation', setup: E.going.setup });
  if (!(E.going.levelMaxDev <= 1e-9))
    failures.push({ what: 'level product', maxDev: E.going.levelMaxDev, tol: 1e-9 });
  // Declared vs cut, per ribbon. String-coupled to the label names, verbatim.
  const crossCheck = (unitName, record) => {
    const entry = clock.labelEntries.find((e) => e.name === unitName);
    if (!entry) { failures.push({ what: 'declared vs cut', unit: unitName, error: 'unit not found' }); return; }
    let ms = null, tube = null;
    entry.obj.traverse((o) => {
      if (!ms && o.userData && o.userData.mainspring) ms = o.userData.mainspring;
      if (!tube && o.isMesh && o.name === 'mainspringRibbon') tube = o;
    });
    if (!ms || !ms.section || !tube) { failures.push({ what: 'declared vs cut', unit: unitName, error: 'mainspring payload or ribbon mesh not found' }); return; }
    const sec = ms.section, s = tube.scale.z || 1;
    if (Math.abs(sec.a - ms.ribbonR) > 1e-9 || Math.abs(sec.a * s - sec.c) > 1e-6
        || Math.abs(sec.I_u4 - (sec.a ** 3) * sec.c / 3) > 1e-12)
      failures.push({ what: 'declared vs cut', unit: unitName, declared: sec,
        cut: { ribbonR: ms.ribbonR, scaleZ: s, axialHalf: sec.a * s } });
    // ...and the frozen record against the live declaration: the payload was
    // computed at boot, so a rebuilt ribbon leaves it quoting stale metal.
    if (Math.abs(record.section.I_u4 - sec.I_u4) > 1e-12 || Math.abs(record.devLen_u - ms.devLen) > 1e-9)
      failures.push({ what: 'record vs build', unit: unitName,
        record: { I_u4: record.section.I_u4, devLen_u: record.devLen_u },
        build: { I_u4: sec.I_u4, devLen_u: ms.devLen } });
  };
  crossCheck('Mainspring drum', E.going);
  crossCheck('Alarm barrel', E.alarm);
  const g = E.going, a = E.alarm;
  // §104 rows 4–6, 8 — held from the record:
  if (!a.setup || !a.setup.quantised)
    failures.push({ what: 'alarm set-up quantisation', setup: a.setup });
  if (!(a.totalWindTurns <= a.usableCeilingTurns + 1e-9))
    failures.push({ what: 'alarm total wind vs ribbon ceiling', totalTurns: a.totalWindTurns, usable: a.usableCeilingTurns });
  if (!(a.capacityLeft > 0))
    failures.push({ what: 'alarm ribbon capacity', capacityLeft: a.capacityLeft });
  const c = a.cadence;
  const measured = { gapFull: null, gapEmpty: null, lawFullAtMid: null, lawEmptyAtMid: null };
  if (!c || typeof c !== 'object' || !c.law) {
    failures.push({ what: 'alarm cadence law', cadence: c, note: 'the record no longer states a law — §104 regressed to an authored value' });
  } else {
    if (!(Math.abs(c.gapAtDesign_s / c.designGap_s - 1) * 100 <= 0.5))
      failures.push({ what: 'I_a solve vs designed gap', gapAtDesign_s: c.gapAtDesign_s, designGap_s: c.designGap_s, tolPct: 0.5 });
    if (!c.ring.inStock)
      failures.push({ what: 'poising-ring stock', section_mm: c.ring.section_mm, window: c.ring.stockWindowMm });
    if (!c.hammerWindow.ok)
      failures.push({ what: 'hammer window at fastest gap', ...c.hammerWindow });
    // §104 row 7 — ENDPOINTS MEASURED ON THE POSED METAL. Step the shipped
    // tick law and read the strike rate it actually produces: rate =
    // Δphase/Δt (phase is in strikes, so 1/rate IS the gap). The wind
    // drains honestly while we measure, so the law is evaluated at the
    // measured window's MID-wind rather than at the endpoint — that keeps
    // the tolerance a statement about dt granularity (0.5%), not about
    // drain drift.
    const gapBy = (phase) => {
      clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
        alarmStrikePhase: phase, alarmOn: 1, alarmReleased: 1 });
      const p0 = clock.alarmStrikePhase, w0 = clock.alarmBarrelWind;
      let t = 0;
      for (let i = 0; i < 60; i++) { clock.step(0.005); t += 0.005; }
      const dp = clock.alarmStrikePhase - p0;
      return { gap: dp > 0 ? t / dp : Infinity, midWind: (w0 + clock.alarmBarrelWind) / 2 };
    };
    // §113 — the record publishes ρ (the contact's lever ratio, driveArc/φ)
    // and the gate's own reconstruction must carry it, or the gate is
    // holding the sim to §104's ρ = 1 lumping the record no longer states.
    // `?? 1` is deliberately absent: a record without ρ IS the regression
    // this line exists to catch, and NaN here fails the row loudly.
    const lawAt = (w) => 2 * c.teethPerStrike
      * Math.sqrt(2 * c.phiRad * c.I_kgm2 / (a.k_Nm_per_rad * (a.setup.sweepRad + w * 2 * Math.PI) * c.meshEff / c.stepUp * c.rho));
    const full = gapBy(0);
    const empty = gapBy(clock.alarmStrikesPerWind - 2); // two strikes of travel left — still off the stall
    measured.gapFull = +full.gap.toFixed(5);
    measured.gapEmpty = +empty.gap.toFixed(5);
    measured.lawFullAtMid = +lawAt(full.midWind).toFixed(5);
    measured.lawEmptyAtMid = +lawAt(empty.midWind).toFixed(5);
    if (!(Math.abs(full.gap / lawAt(full.midWind) - 1) * 100 <= 0.5))
      failures.push({ what: 'measured gap (full) vs law', measured: full.gap, law: lawAt(full.midWind), tolPct: 0.5 });
    if (!(Math.abs(empty.gap / lawAt(empty.midWind) - 1) * 100 <= 0.5))
      failures.push({ what: 'measured gap (near empty) vs law', measured: empty.gap, law: lawAt(empty.midWind), tolPct: 0.5 });
  }
  return {
    ok: failures.length === 0,
    going: {
      k_Nm_per_rad: g.k_Nm_per_rad,
      setupClicks: g.setup.clicks, setupTeeth: g.setup.teeth,
      setupTurns: +(g.setup.sweepRad / (2 * Math.PI)).toFixed(5),
      windFullTurns: +(g.windFullRad / (2 * Math.PI)).toFixed(5),
      tqEmpty: +g.tqEmpty.toFixed(5), fuseeK: +g.fuseeK.toFixed(4),
      momentRange_Nmm: g.momentRange_Nmm.map((x) => +x.toFixed(4)),
      levelMaxDev: g.levelMaxDev,
    },
    alarm: {
      k_Nm_per_rad: a.k_Nm_per_rad,
      setupClicks: a.setup && a.setup.clicks, setupTeeth: a.setup && a.setup.teeth,
      setupTurns: a.setup && +(a.setup.sweepRad / (2 * Math.PI)).toFixed(5),
      totalWindTurns: a.totalWindTurns, usableCeilingTurns: a.usableCeilingTurns,
      capacityLeft: a.capacityLeft && +a.capacityLeft.toFixed(4),
      windRangeTurns: a.windRangeRad.map((x) => +(x / (2 * Math.PI)).toFixed(4)),
      momentRange_Nmm: a.momentRange_Nmm.map((x) => +x.toFixed(4)),
      cadence: c && typeof c === 'object' ? {
        law: c.law, designGap_s: c.designGap_s, gapAtDesign_s: c.gapAtDesign_s,
        gapFull_s: c.gapFull_s, gapEmpty_s: c.gapEmpty_s, ringSeconds: +c.ringSeconds.toFixed(4),
        I_kgm2: c.I_kgm2, ring: c.ring, hammerWindow: c.hammerWindow,
        measured,
      } : c,
    },
    failures,
    summary: `going k ${g.k_Nm_per_rad.toExponential(3)} N·m/rad, set-up ${g.setup.clicks}/${g.setup.teeth} clicks, `
      + `M ${g.momentRange_Nmm[0].toFixed(2)}–${g.momentRange_Nmm[1].toFixed(2)} N·mm, level |dev| ${g.levelMaxDev.toExponential(1)}; `
      + `alarm k ${a.k_Nm_per_rad.toExponential(3)} N·m/rad, set-up ${a.setup ? a.setup.clicks + '/' + a.setup.teeth : '—'} clicks, `
      + (c && typeof c === 'object'
        ? `gap ${c.gapFull_s.toFixed(3)}–${c.gapEmpty_s.toFixed(3)} s over the wind (design ${c.designGap_s} s held; measured ${measured.gapFull}/${measured.gapEmpty}), ring ${c.ring.section_mm.toFixed(3)} mm in stock — TODO 32 closed`
        : 'cadence NOT a law'),
  };
}

export const STOCK_WAIVERS = {
  'Alarm release feeler': 'TODO 11', 'Alarm disc': 'TODO 11', 'Alarm switch': 'TODO 11',
  'Alarm selector': 'TODO 11', 'Alarm setting wheel': 'TODO 11', 'Alarm link': 'TODO 11',
  'Alarm setting idler': 'TODO 11', 'Alarm barrel': 'TODO 11', 'Alarm release disc': 'TODO 11',
  'Alarm setting arbor': 'TODO 11', 'Alarm lock': 'TODO 11', 'Alarm striking wheel': 'TODO 11',
  'Alarm winding train': 'TODO 11', 'Hour wheel': 'TODO 11',   // its one violating mesh is alarmHeart
  'Balance cock': 'TODO 12', 'Set-up work': 'TODO 12', 'Minute jumper': 'TODO 12',
  'Small seconds': 'TODO 12', 'Escape wheel': 'TODO 12', 'Fork cock': 'TODO 12',
  'Motion works': 'TODO 12', 'Mainspring drum': 'TODO 12', 'Fusee & great wheel': 'TODO 12',
  'Balance': 'TODO 12', 'Power-reserve train': 'TODO 12', 'Reset hammer': 'TODO 12',
};

// REPORT → TRIAGE → DECLARE → GATE, in that order (§36 part two is the
// precedent). This check GATES only the degenerate tier; the horological
// tier REPORTS violations for the owner\'s triage, and becomes a gate only
// once the exceptions are declared. ok:false therefore means degenerate
// geometry, not thin-but-arguable stock.
export async function checkStockFloor(clock, opts = {}) {
  const census = await stockCensus(clock, opts);
  const degenerate = [], violations = [], waived = [], defaulted = new Set();
  for (const r of census.thinnestFirst) {
    const kind = STOCK_KIND_BY_MESH[r.mesh] || STOCK_KIND_BY_PART[r.part] || 'wheel';
    if (!STOCK_KIND_BY_MESH[r.mesh] && !STOCK_KIND_BY_PART[r.part]) defaulted.add(r.part);
    const floor = STOCK_FLOORS[kind];
    // `where` travels with the row: this list is where the triage happens, and
    // a waived row nobody can find in the source is a debt nobody can pay.
    const row = { part: r.part, mesh: r.mesh, kind, mm: r.thinnestMM, floorMM: floor.mm, where: r.where };
    if (r.thinnestMM < floor.mm) {
      if (r.thinnestMM < DEGENERATE_STOCK_MM && floor.mm >= DEGENERATE_STOCK_MM) degenerate.push(row);
      else if (STOCK_WAIVERS[r.part]) waived.push({ ...row, debt: STOCK_WAIVERS[r.part] });
      else violations.push(row);
    }
  }
  violations.sort((a, b) => a.mm - b.mm); waived.sort((a, b) => a.mm - b.mm);
  return {
    ok: degenerate.length === 0 && violations.length === 0,
    waived, waivedCount: waived.length,
    gate: 'GATING (triaged 2026-07-26): degenerate 0 AND unwaived 0 to pass; a waived row is accepted debt citing its TODO item, visible in the report, not a pass', 
    floors: STOCK_FLOORS, degenerateFloorMM: DEGENERATE_STOCK_MM,
    degenerate, violations,
    violationsByPart: [...violations.reduce((m, v) => (m.set(v.part, (m.get(v.part) || 0) + 1), m), new Map())]
      .map(([part, n]) => `${part} ×${n}`),
    partsOnDefaultKind: [...defaulted].sort(),
    rowsChecked: census.thinnestFirst.length,
  };
}

// ---------------------------------------------------------------------------
// TODO 40 row 3 — A CHAIN IS A FIXED LENGTH OF STEEL, and until this nothing
// in the battery said so. The row named the gap in as many words: "the chain
// is display-only, the sweeps see a rebuilt mesh as a mover and never compare
// its length across poses, and no check states that a chain is a fixed length
// of steel — the hole `devLen` closed for the mainspring in item 1."
//
// WHAT IT MEASURES. `clock.chainRunLength(t)` returns the arc length of the
// SHIPPED layout curve — `chainLayoutAt`, the one the display bakes and the
// arrest's contact law reads — so this compares the model against itself
// rather than against a second copy of the arithmetic. Sampling density is
// pinned (see that method's comment): the control-point count varies with
// tension, so a density tied to the curve's own parameterisation would read
// its control density as length drift. Measured convergence at the pinned
// 4000: the value moves 0.0025% between 500 and 8000 divisions and is stable
// to 1.5e-6 relative from 2000 up, four orders under the tolerance below.
//
// THE TOLERANCE IS DERIVED, from the builder's own rounding rule.
// `buildChainLinkGeometry` lays `N = max(round(len / CHAIN_PITCH), 2)` links,
// so a length change under HALF A PITCH cannot change N — the run lays the
// same chain, and the model's discretisation genuinely cannot see it. At half
// a pitch it crosses the rounding boundary and the run gains or loses a link,
// which is a different chain claiming to be the same one. Hence
// `tol = CHAIN_PITCH / 2`, and nothing here is free to widen it: the number
// belongs to the link, and the link is pinned to a manufactured 0.72 mm.
//
// The link census beside the spread is the corroborating measurement, taken
// from the same rule rather than from the mesh: two independent readings of
// one fact are what make the row hard to argue with.
// NO WAIVER any more (§150 closed TODO 40 row 3): the cone is cut from the
// span-aware conservation solve, so the run's spread measures 0.52 u against
// the 0.95 u tolerance and the census lays 43 links at every state of wind.
// The `waiver` parameter stays for TODO 34's control (a gate must be
// provably non-vacuous), but its default is none — this row GATES.
export function checkChainLength(clock, { n = 41, divisions = 4000, waiver = null } = {}) {
  if (typeof clock.chainRunLength !== 'function')
    return { ok: false, error: 'no chainRunLength on __clock (main.js TODO 40 exposure missing)' };
  const tol = CHAIN_PITCH / 2;
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const len = clock.chainRunLength(t, divisions);
    samples.push({ t: +t.toFixed(4), len, links: Math.max(Math.round(len / CHAIN_PITCH), 2) });
  }
  const lens = samples.map((s) => s.len);
  const min = Math.min(...lens), max = Math.max(...lens);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const spread = max - min;
  const linkCounts = [...new Set(samples.map((s) => s.links))].sort((a, b) => a - b);
  const meets = spread <= tol;
  const row = {
    what: 'chain run length across the reserve',
    spread: +spread.toFixed(4),
    tol: +tol.toFixed(4),
    spreadPct: +((spread / mean) * 100).toFixed(3),
    tolPct: +((tol / mean) * 100).toFixed(3),
    min: +min.toFixed(4), max: +max.toFixed(4), mean: +mean.toFixed(4),
    atMin: samples.find((s) => s.len === min).t,
    atMax: samples.find((s) => s.len === max).t,
    // The mesh-side reading of the same fact: if the run lays a different
    // number of links at different states of wind, it is a different chain.
    linkCounts,
    linksConstant: linkCounts.length === 1,
    waived: !meets && waiver ? waiver : undefined, // §50's convention: visible debt, cited
    ok: meets,
  };
  console.table([row]);
  return {
    rows: [row], samples,
    violations: (meets || waiver) ? [] : [row], // a waived row is DEBT, not a pass — it stays in rows/report
    waivedCount: !meets && waiver ? 1 : 0,
    gate: 'GATING — the run\'s length is constant across the reserve to half a link pitch '
      + '(the granularity at which buildChainLinkGeometry\'s link count rounds); '
      + 'a failing row is accepted debt only while it cites its TODO item',
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
  alarmHandoffs: (clock, opts) => checkAlarmHandoffs(clock, opts),
  // §47 — the same instrument pointed at the going side's two contacts; a
  // sibling registration rather than a widened alarm table, so the alarm's
  // rows stay bit-identical under the report diff.
  windArrestHandoff: (clock, opts) => checkAlarmHandoffs(clock,
    { poses: WIND_ARREST_POSES, handoffs: WIND_ARREST_HANDOFFS, ...opts }),
  // TODO 50 — the stem clutch's coupling, same instrument, own tables:
  // contact at every engaged parity (the spring holds the one-sided
  // constraint closed), free pulled out.
  stemClutchHandoff: (clock, opts) => checkAlarmHandoffs(clock,
    { poses: STEM_CLUTCH_POSES, handoffs: STEM_CLUTCH_HANDOFFS, ...opts }),
  expectedContacts: (clock, opts) => checkExpectedContacts(clock, opts), // TODO 6 — per-contact floors over EXPECTED pairs
  intraUnit: (clock, opts) => checkIntraUnit(clock, opts),               // TODO 5 — all three intra-unit tiers: MF, FF, MM across frames (§121)
  assembly: (clock, opts) => checkAssembly(clock, opts),                 // §107 — TODO 5's other half: a rigid group must be ONE body
  lowCorridor: (clock, opts) => checkLowCorridor(clock, opts),
  axisEntry: (clock, opts) => checkAxisEntry(clock, opts),               // TODO 54 — canonical axis entry holds over every ordered pair; the leak the sweeps used to carry is measured beside it
  stockFloor: (clock, opts) => checkStockFloor(clock, opts),
  // §54's slenderness ceiling. It was EXPORTED AND NEVER REGISTERED HERE, so
  // `start(clock, 'slenderness')` answered "unknown check", every λ quoted in
  // the source was a hand-run number nothing reproduced, and SLENDER_WAIVERS
  // waived rows in a report that was never produced. The `restoring` entry
  // below is the same bug, found first (TODO 29); this is the second instance,
  // which is why ci-battery now gates CHECKS against BATTERY rather than
  // trusting that someone remembers. §50's floor and this ceiling are one
  // pair — half of it had been running in CI since §52 and half had not.
  slenderness: (clock, opts) => checkSlenderness(clock, opts),
  meshIntegrity: (clock, opts) => checkMeshIntegrity(clock, opts),       // §77 tiers 0+1 — a mesh's own triangles: zeroArea + inverted bodies, a REPORT; gates its controls and the sub-body tables only
  oscillator: (clock, opts) => checkOscillator(clock, opts),             // TODO 25 tier two — the spring is cut to the beat; this gates that claim
  equalisation: (clock, opts) => checkEqualisation(clock, opts),         // TODO 32 (closed by §104) — both springs' derived laws hold; the alarm's cadence is measured against its law
  chainLength: (clock, opts) => checkChainLength(clock, opts),           // TODO 40 row 3 — a chain is a fixed length of steel; the run's closure, gated to half a link pitch
  // §48's no-spring audit. Named `restoring` rather than `oscillators`: one
  // character from `oscillator` above would be a trap, and the two answer
  // different questions — that one asks whether the hairspring is cut to the
  // beat, this one asks whether every part that RECIPROCATES has something
  // bringing it back. It was exported and never registered here, so
  // `start(clock, …)` answered "unknown check" and the only way to run §48's
  // instrument was to import the module and call it by hand (TODO 29).
  restoring: (clock, opts) => auditOscillators(clock, opts),
  // opts: { units: [...names], axes?: [...axisNames] } — the focused convenience.
  focused: (clock, opts = {}) => focusedCheck(clock, opts.units, opts),
};

// The roster, so the harness can hold ITSELF to it. Twice now a check has been
// written, exported and never registered above — §48's `restoring` (TODO 29)
// and §54's `slenderness` (TODO 78) — and both times the symptom was the worst
// kind: a clean battery that had simply not run the instrument. A missing
// registration is invisible from inside this file, so the closure gate lives in
// ci-battery.mjs and reads the roster from the PAGE, the way §127's slice gate
// reads AXES rather than trusting a second declaration of them.
export const CHECK_NAMES = Object.keys(CHECKS);

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
// Baseline (§126 + TODO 51 — the winding arrest and its accommodation;
// 53 units, 11 poses):
// 3145260817
//   moved from 2414545422 deliberately: TODO 51 re-solves where the arrest's
//   members STAND, without adding or removing one. The finger's plate drops
//   to hang under the lug's orbit rather than the bracket's arm alone; both
//   arms stop at a reach measured on the DISCRETE links and swept along their
//   whole chord over the law's real travel, so their stations move outboard;
//   the pad and beak tabs bridge back in, so PAD_T and BEAK_RAD are now the
//   gaps they span; the pad's lean became a shear rather than a rotation; and
//   `LUG_OUTER` is derived from the pivot ceiling √(Rb² + L_max²) instead of
//   borrowing the chain's proudness, which moves the lug on the cone. The
//   unit count is unchanged at 53 — nothing was added, everything was
//   re-sited. Measured by the battery's own double-boot gate.
// Previous baseline (§126 — the winding arrest's own unit and its lug on the
// cone; 53 units, 11 poses):
// 2414545422
//   moved from 2163870811 deliberately: §126 adds the 'Winding arrest' unit
//   (bracket, stud, finger, pad, beak, riser, blade and its post) and a lug
//   turning with the fusee. Measured by the battery's own double-boot gate
//   on CI, which is where this number came from.
// Previous baseline (§107 — the anchor's own unit and its arched arms;
// 52 units, 11 poses):
// 2163870811
// — moved from 827809538 deliberately, and for two reasons at once. The unit
// count goes 51 → 52: §107 promotes the anchor out of 'Alarm governor' into
// 'Alarm governor anchor', a movement SIBLING with its own stud, so the same
// meshes are now boxed as two units instead of one. And the anchor's own
// geometry moved: each arm stopped being a radial BoxGeometry ending at a
// literal and became a walked arch, derived to clear the saw's tip circle by
// CLEAR_MARGIN across the swing while lapping the blade it carries — which
// also re-solves the poising ring's section (0.45507 → 0.4549 mm) through the
// count that reads the arm's own outline. Verified by the battery's
// double-boot gate.
// Previous baseline (§104 — the alarm governor; 51 units, 11 poses):
// 827809538
// — moved from 284533079 deliberately: §104 adds the 'Alarm governor'
// unit (sixteen meshes across two axes — pinion, saw, generated pallets,
// anchor, poising ring, their arbors and studs) plus three meshes to the
// Alarm striking wheel (the 64T wheel, its sleeve, the stud's upper
// length), and the striking unit's box grows upward to the new tier.
// Verified by the battery's double-boot gate; the whole 19-gate run is
// green on the same boot.
// Previous baseline (§102 — the lock's return blade; 50 units, 11 poses):
// 284533079
// — moved from 949908343 deliberately: §102 adds the return blade and
// its anchor stud to the Alarm lock (two meshes, the unit's box grows on
// the pivot side) and derives ALARM_LOCK_LIFT down from the authored
// 0.085 to the pad clearance over the lever length (0.032) — the
// released lever parks 0.05 rad lower, which moves every lifted-pose
// box the lock appears in. Verified by the battery's double-boot gate.
// Previous baseline (§101 — the click faces the right way; 50 units,
// 11 poses):
// 949908343
// — moved from 3121848351 deliberately: §101 re-cut the click's outline
// (the valley-filling beak replaced the V-nose, arm slimmed) and mirrored
// the arbor ratchet's saw; the spring anchor's outboard re-station rode
// along inside the unit's existing AABB envelope, which is why the hash
// held constant across §101's own fix rounds — axis-aligned unit boxes
// are coarse, and a member can move inside one without the hash seeing
// it. Verified by the battery's double-boot gate.
// Previous baseline (§100 — the going drum's fixed arbor; 50 units, 11
// poses):
// 3121848351
// — moved from 3724996819 deliberately: §100 re-homes the drum arbor and
// its lower staff to the static Set-up work (two rotor meshes became
// static — the registry census says the same, revolve 212 → 210), bores
// the drum's floor and lid for the arbor they now run on, and deletes
// the rotating group's pivot furniture with its wrong-member jewel. Unit
// and pose counts unchanged; verified by the battery's double-boot gate.
// Previous baseline (§99 — the alarm barrel's own click; 50 units, 11
// poses):
// 3724996819
// — moved from 2134288613 (main's MEASURED value at 49 units, 10 poses)
// deliberately: §99 adds the 'Alarm click' unit, lifts the winding train
// to the arbor tier, shifts the barrel body's rest by 77.0 tooth pitches
// (the state law's split of strike phase from wind), and adds the
// wound-at-rest pose {alarmBarrelWind: 1.75} — the state class the split
// created. Verified by the battery's double-boot gate. NOTE: the
// previously RECORDED value below (3104989635, 47 units) had gone stale
// without a record — sections since §33 added two fingerprinted units
// and moved main to 2134288613 with this comment unrevised, exactly the
// drift this constant exists to catch. Re-measure and update it in the
// SAME change that moves geometry.
// Previous baseline (§33 handles + hardware parity; 47 units, 46
// fingerprinted, 10 poses):
// 3104989635
// — moved from 143293357 deliberately: the alarm crown's body height
// matched to the main crown's (growth outward from the builder's
// inner-face origin), and the pusher's pawl park DERIVED from the saw's
// exported outline (the measured-once 1.3557 retired; the pawl now
// parks at an exact kiss, 0/0 on its hand-off row, at any press
// azimuth a spec chooses). Verified by the battery's double-boot gate.
// Previous baseline (TODO 20 closed; 47 units, 46 fingerprinted, 10
// poses): 143293357
// — moved from 4164572423 by TODO 20's fork deliberately: the drive tab is
// a fork built on the pin's solved engagement (band outboard of the alarm
// setting wheel's rim, hung from a single upper bracket — the lower level
// has 0.03 of z inside the rim), the lay shaft ends short of it with the
// centre pin riding the groove, and the pusher's pawl parks on the tooth
// it drives. Verified identical across two virgin boots by the battery's
// double-boot gate.
// Previous baselines: 4164572423 (TODO 20 — cam cut, nose raised, rod
// rebuilt between contacts, keyed cranks), 2748333645 (TODO 19 — pin
// re-hung, rocker contact-solved), 1974757747 (§57 + TODO 18)
// — verified IDENTICAL across two virgin boots (state file and localStorage
// cleared first), boot silent. The §29-era value previously recorded here
// (3868604154) was moved deliberately by the sections landed since — §53's
// alarm-link restiffening through TODO 18's derived reserve reduction —
// which relaid geometry and added two fingerprinted units. CI's gate is
// double-boot determinism, not this constant; this number is the recorded
// go/no-go for refactors against the CURRENT tree, so re-measure and update
// it when a section legitimately moves geometry. History: §29 step 0 found
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
  { tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 },
  { tau: 8 * 3600 * 0.37, crownPullT: 0, leverEngage: 0, tension: 1 },
  { tau: 0.05, crownPullT: 1, leverEngage: 1, tension: 1 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.4 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: 2.0 },
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmStrikePhase: 7.3 },
  // §25 C: ARMED with the tube split from the hour wheel — poses the follower
  // mid-ride on the heart, the one configuration the other poses never reach.
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: 2.0, alarmOn: 1 },
  // §25 C/D inputs added after the original list (the rule above demands a
  // pose per force input, or its path's refactors go unguarded):
  // — the alarm crown pulled to the SET position (the stem slid one throw,
  //   the sliding bevel at the setting corner);
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownPullT: 1 },
  // — mid-RING: armed, released, part-wound — the brake lever lifted off the
  //   collar, the column wheel in a gap, the striker mid-cycle.
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmReleased: 1, alarmStrikePhase: 5.2 },
  // — §99: WOUND AT REST — the state class the wound-arbor split created
  //   (wind and phase independent: a full ribbon over a parked striker).
  //   The arbor stands a full 1.75 turns from its run-down angle, the click
  //   parked on a different tooth, the ribbon at coil bind — none of which
  //   any pose above reaches, and the wind path's refactors go unguarded
  //   without it (the list's own rule).
  { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmBarrelWind: 1.75 },
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

const _fpb = new THREE.Box3(); // fingerprint scratch
const _fpBox = new THREE.Box3();

// The labelled units the box measurement reads, in the order it reads them.
const boxEntries = (clock) => clock.labelEntries.filter((e) => !FINGERPRINT_EXCLUDE.has(e.name));

// Every labelled unit's world AABB AT THE CURRENT POSE, quantised — no reset
// and no setPose, because two callers want it at two different kinds of pose:
// the fingerprint (which poses canonically, below) and checkAxisEntry (whose
// whole subject is what the clock carries INTO a pose). Shared rather than
// copied so the §66 schematic skip and the 1e-3 quantum have one definition;
// they are the two rules that decide whether a hash means anything.
function unitBoxRows(clock, entries = boxEntries(clock)) {
  const q = (n) => Math.round(n * 1000) / 1000 + 0; // +0 folds -0 → 0
  const rows = {};
  for (const e of entries) {
    // setFromObject minus the §66 schematic tier: the line proxies DISPLAY
    // the model; the fingerprint guards the METAL. Without the skip the
    // tier's circles inflated unit boxes and moved the hash — the same
    // geometry the instruments (isMesh collections) never see.
    _fpBox.makeEmpty();
    (function walk(o) {
      if (o.userData && o.userData.schematic) return;
      if (o.geometry) {
        if (o.geometry.boundingBox === null) o.geometry.computeBoundingBox();
        _fpb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        _fpBox.union(_fpb);
      }
      for (const c of o.children) walk(c);
    })(e.obj);
    rows[e.name] =
      [_fpBox.min.x, _fpBox.min.y, _fpBox.min.z, _fpBox.max.x, _fpBox.max.y, _fpBox.max.z].map(q);
  }
  return rows;
}

function fingerprintBoxes(clock, poses = FINGERPRINT_POSES) {
  const rows = {};
  const entries = boxEntries(clock);
  const units = entries.map((e) => e.name).sort();
  poses.forEach((pose, pi) => {
    // Canonical inputs first, so a part the pose does not drive sits where a
    // fresh boot would put it rather than where the last save left it — the
    // fingerprint must not depend on session history (see resetInputs). The
    // sweeps did not make this call until TODO 54; see enterAxis.
    clock.resetInputs();
    clock.setPose(pose);
    clock.scene.updateMatrixWorld(true);
    const at = unitBoxRows(clock, entries);
    for (const e of entries) rows[`${e.name}#${pi}`] = at[e.name];
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
// §152 — THE PER-UNIT KEY: the digest that decides whether a check can be
// skipped because it provably cannot change its answer.
//
// A pair sweep's verdict is a function of exactly three things — the GEOMETRY
// of the two parts, the POSE NET they are swept over, and the CHECK CODE. If
// all three are identical to a run that already passed, so is the verdict.
// This function measures the first of the three, per unit, straight off the
// built scene.
//
// WHY NOT THE FINGERPRINT, which already hashes per-unit boxes. Two different
// meshes can share a bounding box, and the proof case is §77's own subject:
// TODO 4 records that the inside-out castellations moved NO AABB and no
// clearance verdict. A fingerprint-keyed skip would have skipped the sweep
// that had nothing to say and, on a different day, the one that did — a stale
// green, which is strictly worse than a slow gate.
//
// TWO HALVES, because the obvious one is only half the answer.
//
//   · SHAPE — the position and index buffers' BYTES. Bit patterns, not decimal
//     renderings: two builds differing in the last ulp are two geometries, and
//     that is the answer this wants rather than one a rounding would hide.
//   · PLACE — every mesh's world matrix, quantised to PLACE_Q. A vertex digest
//     alone is BLIND to a part that is moved but not re-cut, which is what
//     every §13-class layout re-solve does: same metal, new station, different
//     verdicts. The fingerprint's AABB is a lossy projection of this half; the
//     matrices are the thing itself.
//
// WALKED AT EVERY CANONICAL POSE, and that is not belt-and-braces. Four units
// install a DIFFERENT GEOMETRY at a different pose — the mainspring, the
// hairspring, the alarm barrel and the chain ride frame POOLS, and a
// traversal only ever sees the frame that happens to be installed (weldTree's
// own documented limit; MODELING.md rule 6). A one-pose walk would digest one
// frame of a wound ribbon and call the spring unchanged.
//
// IT IS NOT AT BOOT, and the entry that proposed this asked for it to be.
// Measured: 1046 ms for the eleven-pose walk against an 8.0 s boot, on a
// module main.js dynamic-imports for explore mode and NEVER at boot "so the
// boot bundle and its silence are untouched". A second of every visitor's
// boot spent on a CI feature is the wrong trade in both directions, so this
// is an export the harness calls through page.evaluate exactly as it calls
// every check.
// ---------------------------------------------------------------------------

// The quantum for the PLACE half. Six decimals is three orders finer than the
// fingerprint's 1e-3 box quantum — this half must resolve a station move that
// the AABB rounds away — and still far coarser than the float noise two boots
// of one tree produce (measured: 0 of 56 rows differ across two virgin
// contexts, the gate the harness gets from this).
export const DIGEST_PLACE_Q = 1e6;

// The one unit whose digest can never mean anything, named here rather than
// left to the caller. updateChain re-tessellates lazily — only when the
// reserve has visibly MOVED (see rebuildChain) — so the chain's mesh is
// PATH-DEPENDENT: its vertex count and its box both differ between a freshly
// rebuilt tessellation and a slightly stale one at the same tension. The
// fingerprint excludes it by name for exactly this reason. Two virgin boots
// DO reproduce its digest, because both walked the same path to get there,
// and that is a fact about the harness's protocol rather than about the mesh.
// So it is digested like everything else — and declared unconditionally
// changed, which costs 55 of 1540 pairs and one of the 18 hull candidates.
export const DIGEST_ALWAYS_CHANGED = ['Chain'];

// FNV-1a over raw bytes. Shares strHash's constants so the two hashes are
// visibly the same function over different input; a typed array is read as
// its underlying bytes rather than element-wise, so a Float32Array and a
// Uint16Array need no separate cases and no float is ever stringified.
function hashBytes(arr, h) {
  const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  for (let i = 0; i < b.length; i++) {
    h ^= b[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// The pose set the digest is measured at — DERIVED from AXES, not borrowed.
//
// A sweep's verdict is f(geometry, pose net, check code), and the key stands in
// for the first of those. Sampling it at the FINGERPRINT_POSES made the key a
// function of a pose list chosen for a different instrument (the fingerprint's
// rule is "a pose per force input"), and the sweeps run on AXES: a pose-law
// change in main.js/layout.js/state.js that leaves the eleven sampled points
// fixed and moves geometry BETWEEN them produces different sweep verdicts and
// an identical key — a stale green, the one failure §152 exists to prevent.
// Deriving the set from AXES here, in the module that owns AXES, also means a
// new axis cannot ship without digest coverage: no declared list to keep in
// step, so none to fall behind.
//
// THREE FRACTIONS PER AXIS — endpoints and midpoint. The cheapest set that
// samples every axis's mid-travel, and the one alarmToggle's step law needs
// (its parity is 1 on (0.25, 0.75) and 0 outside, so 0, 0.5, 1 lands both
// states exactly). Several pose laws read the clock (arrest's tTouch,
// stemSlip's pitch, train, handSet, alarmStrike, alarmWind), which is why this
// takes the clock rather than being a const.
//
// THE FINGERPRINT POSES RIDE ALONG, unioned in, because they cover COMBINED
// input states no single axis reaches — armed + released + mid-strike, wound
// at rest — and an axis-derived set is per-input by construction.
//
// AND IT IS STILL A SAMPLE. Three fractions cannot see a law change confined
// to an interior band (f ∈ (0.6, 0.7) moves geometry no pose here visits), so
// the key's honesty ceiling is unchanged in kind: the backstop remains the
// unfiltered push-to-main run, which is a whole verdict and never incremental.
// What this buys is coverage measured against the net the verdicts come from
// instead of coverage inherited from a neighbour.
export function digestPoses(clock) {
  const seen = new Set(), poses = [];
  const add = (p) => {
    // Pose objects are literals with stable key order, so stringify is a sound
    // identity here — two axes whose endpoints coincide (every axis that pins
    // tau at 0.13 with the crown in) contribute one walk, not two.
    const k = JSON.stringify(p);
    if (seen.has(k)) return;
    seen.add(k);
    poses.push(p);
  };
  for (const axis of AXES) for (const f of [0, 0.5, 1]) add(axis.pose(f, clock));
  for (const p of FINGERPRINT_POSES) add(p);
  return poses;
}

// Every labelled unit's SHAPE and PLACE digest across the derived poses.
//
// The population is collectUnits at includeExcluded — the widest one any
// check uses (`inspection` runs there, and the row-table checks reach their
// units by name out of the same list), so a unit that is invisible here is
// invisible to every consumer of the key.
//
// Returns { units: {name: {shape, place, key}}, poseCount, unitCount,
// alwaysChanged, placeQ }. The always-changed list travels WITH the payload
// rather than being restated in the harness: it is a fact about this scene's
// geometry, so it belongs to the tree that produced it, and the harness
// unions the two trees' lists rather than picking one.
export function unitDigests(clock, { poses } = {}) {
  // Resolved in the body, not in the parameter list: digestPoses reads the
  // clock, which the default-parameter position cannot name.
  poses = poses ?? digestPoses(clock);
  const shape = new Map(), place = new Map();
  const q = (n) => Math.round(n * DIGEST_PLACE_Q) / DIGEST_PLACE_Q + 0;  // +0 folds -0 → 0, unitBoxRows' precedent
  for (const pose of poses) {
    // Canonical inputs first, the fingerprint's rule: a part the pose does not
    // drive must sit where a fresh boot would put it, never where the last
    // interaction left it. Without this the key would depend on session
    // history and two runs of one tree could disagree.
    clock.resetInputs();
    clock.setPose(pose);
    clock.scene.updateMatrixWorld(true);
    for (const u of collectUnits(clock, { includeExcluded: true })) {
      let hs = shape.get(u.name) ?? 0x811c9dc5;
      let hp = place.get(u.name) ?? 0x811c9dc5;
      for (const m of u.meshes) {
        const g = m.geometry;
        hs = hashBytes(g.attributes.position.array, hs);
        if (g.index) hs = hashBytes(g.index.array, hs);
        // The vertex COUNT, so a buffer that is a prefix of another cannot
        // collide with it — a stream hash over bytes alone would.
        hs = hashBytes(new Uint32Array([g.attributes.position.count]), hs);
        for (const e of m.matrixWorld.elements) {
          const s = String(q(e));
          for (let i = 0; i < s.length; i++) {
            hp ^= s.charCodeAt(i);
            hp = (hp + ((hp << 1) + (hp << 4) + (hp << 7) + (hp << 8) + (hp << 24))) >>> 0;
          }
        }
      }
      shape.set(u.name, hs >>> 0);
      place.set(u.name, hp >>> 0);
    }
  }
  clock.resetInputs();
  const units = {};
  for (const name of [...shape.keys()].sort()) {
    const s = shape.get(name), p = place.get(name);
    units[name] = { shape: s, place: p, key: strHash(`${s}:${p}`) };
  }
  return {
    units,
    unitCount: Object.keys(units).length,
    poseCount: poses.length,
    placeQ: DIGEST_PLACE_Q,
    alwaysChanged: [...DIGEST_ALWAYS_CHANGED],
  };
}

// Which units differ between two digest payloads — the changed set every
// restriction below is derived from.
//
// Three ways a unit lands in it, and the last two are why this is a function
// rather than a diff someone writes inline: its key MOVED, it exists in only
// one of the two trees (a part added or deleted is changed in the only sense
// that matters), or it is on either tree's always-changed list. The lists are
// UNIONED rather than taken from the newer tree: a unit that was
// path-dependent in the base and is not any more still has a base verdict
// that was measured under that path-dependence.
export function digestChangedUnits(base, head) {
  const changed = new Set([...(base.alwaysChanged || []), ...(head.alwaysChanged || [])]);
  const names = new Set([...Object.keys(base.units || {}), ...Object.keys(head.units || {})]);
  for (const n of names) {
    const b = base.units?.[n], h = head.units?.[n];
    if (!b || !h || b.key !== h.key) changed.add(n);
  }
  return [...changed].sort();
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
// WHERE A ROW LIVES IN THE SOURCE — the census's own weak claim, strengthened.
//
// The header used to say an (unnamed) row "is identified by its unit and
// dimensions", and it is not: a unit is a subtree of dozens of meshes and a
// bounding box is three numbers that appear nowhere in the code. Every TODO 11
// tranche has paid the same toll — the entry records three identification
// probes for two winding-train posts, and 26 of the 56 rows it is still
// carrying were anonymous when tranche five opened them.
//
// What a builder actually writes is a CONSTRUCTOR CALL, so that is what this
// reports: the geometry's type and its numeric parameters, verbatim, plus the
// mesh's own local position. `new THREE.CylinderGeometry(0.16, 0.16, ...)` is
// greppable; "thin 0.1153 somewhere in Alarm link" is not. Parameters are
// three.js's own `geometry.parameters`, so a type that publishes none (an
// ExtrudeGeometry, a hand-built BufferGeometry) reports its type alone rather
// than a guess — the same "say so wherever the ruler is wrong" rule the rest
// of this census follows.
function whereOf(mesh) {
  const g = mesh.geometry;
  const p = g.parameters || {};
  const args = Object.entries(p)
    .filter(([, x]) => typeof x === 'number')
    .map(([k, x]) => `${k} ${+x.toFixed(4)}`);
  const at = mesh.position;
  return `${g.type}(${args.join(', ')}) at local `
    + `${[at.x, at.y, at.z].map((c) => +c.toFixed(3)).join(', ')}`;
}

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
      unmeasured.push({ part: v.unit, mesh: name, where: whereOf(v.mesh),
        why: 'approx hull — box spans every pose, so its extents are motion, not stock' });
      continue;
    }
    let axial = null, radial = null, source, via, thin, extents = null;
    if (v.kind === 'revolve') {
      axial = v.zBand[1] - v.zBand[0];
      // SOLID vs RING, and the factor of two between them. A ring's radial
      // stock is its wall — rHi − rLo — but a SOLID revolve's vertices reach
      // r = 0 at the cap centres, so its band width equals its RADIUS, which
      // is HALF the true thin-way-through. Two winding-train posts (r 0.30,
      // really ⌀ 0.225 mm) sat in the violation list at half size for three
      // identification probes because of this; rLo ≈ 0 is the tell.
      radial = v.rBand[0] < 0.02 ? 2 * v.rBand[1] : v.rBand[1] - v.rBand[0];
      source = v.rBand[0] < 0.02 ? 'registry-revolve (solid: ⌀)' : 'registry-revolve';
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
      unmeasured.push({ part: v.unit, mesh: name, where: whereOf(v.mesh),
        why: `zero-thickness ${via} extent — open surface in the mesh, not stock` });
      continue;
    }
    rows.push({ part: v.unit, mesh: name, via, source, where: whereOf(v.mesh),
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
      naming: "every PART (unit) is named; individual meshes are named only where the model names them — an (unnamed) row carries `where`, its geometry's constructor call and local position, which is greppable in src/",
    },
    thinnestFirst: rows,
    perPart: [...byPart.values()],
    notMeasured: unmeasured,
  };
}

// ---------------------------------------------------------------------------
// §48 — AUDIT THE OSCILLATORS THAT HAVE NO SPRING
//
// THE RULE, STATED ONCE. A part whose motion REVERSES needs one of exactly
// two things: a TWO-WAY DRIVE, where something pushes it each way, or a
// RESTORING ELEMENT — a spring, or gravity, declared as acting. A part with
// neither is ANIMATED, not driven: its return is asserted by the pose law
// rather than caused by the movement.
//
// The pallet fork is the control case and must PASS in the first category:
// the escape wheel impulses it alternately, so it is genuinely two-way driven
// and correctly carries no return spring. If the fork ever lands in the third
// bucket, this audit is broken, not the fork.
//
// THE POPULATION IS §36'S, NOT A SECOND PASS. §36 asks what VOLUME a reversal
// sweeps; this asks what FORCE causes it. Same set, different question — so
// this consumes `reversed` off the registry rather than re-sampling the pose
// laws, which also keeps the two honest about the same list. That is why
// `reversed` is computed unconditionally up there now.
//
// WHAT THIS CANNOT SEE, SAID PLAINLY. A declaration is a claim made by the
// build about its own pose law, and no static check can confirm that a force
// is what actually produces a return — the pose law is code, not a solver.
// What IS checked is the failure mode the entry names: a spring that exists
// only as GEOMETRY. A `spring` declaration must name a mesh that is really in
// the scene, so "there is a spring next to it" cannot be typed in and left to
// look like a mechanism. The `why` carries the rest, and it is a human claim.
//
// THIS IS A REPORT, NOT A GATE — the §40 rule. An audit that fails the battery
// on arrival gets switched off. It returns `ok: true` always; findings are
// triaged by hand and each restored-by-nothing part is filed to TODO.md
// against the part, which is where that debt lives.
export const RESTORING_KINDS = ['two-way', 'spring', 'gravity'];

// Accepted debt, citing the item that owns it — the STOCK_WAIVERS convention.
// A waived row is STILL REPORTED; the waiver records that someone has looked
// and that the fix is filed, not that the finding went away. Added with
// TODO 29, when the alarm-parity axis first made these parts reciprocate
// under a sweep and the audit could finally see them.
export const RESTORING_WAIVERS = {
  // ('Alarm lock' left this table when §102 built the return blade TODO 31
  // prescribed — the waiver was the finding, and deleting it MEANT adding
  // the spring: alarmLockSpring now exists as metal, declared beside its
  // build, and the audit's geometry guard holds the name to a mesh.)
  // TODO 29's own residue, and honestly the reason this waiver table has two
  // entries instead of one. Of the 23 reversing volumes the parity axis
  // attributes to 'Dial', 22 are ALSO claimed by a nearer unit (Alarm disc,
  // Alarm selector, Alarm release feeler, Power reserve) and are correctly
  // deduped away. One is not: an unnamed ExtrudeGeometry that no nearer unit
  // claims. Until it is identified this cannot be answered — it is either a
  // real dial-side part with no return, or the nesting artifact the audit's
  // own dedupe comment warns is a FALSE finding. Naming the mesh is the fix
  // (§54's lesson: a row that cannot name its member is not actionable).
  Dial: 'TODO 29',
};

// How load-bearing a part is: how much of the movement is downstream of it in
// MECH_GRAPH.drive, transitively. A missing return on the pallet fork would
// mis-state the whole train below it; a missing return on a dial-side flag
// mis-states itself. Sorting by this puts the consequential findings first
// rather than the alphabetically lucky ones.
function driveFanout(name) {
  const adj = new Map();
  for (const [a, b] of MECH_GRAPH.drive) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push(b);
  }
  const seen = new Set();
  const stack = [name];
  while (stack.length) {
    const n = stack.pop();
    for (const m of adj.get(n) || []) if (!seen.has(m)) { seen.add(m); stack.push(m); }
  }
  seen.delete(name);
  return seen.size;
}

export async function auditOscillators(clock, opts = {}) {
  const reg = opts.registry || await buildSweptRegistry(clock, opts);

  // DEDUPE BY MESH, keeping the most specific unit — §40's rule, and needed
  // here for the same reason and then one more. Units NEST: the feeler's
  // meshes are inside the 'Dial' subtree, so collectUnits hands each mesh to
  // both and the registry carries a volume per pairing. Left alone the audit
  // filed the feeler's reversal twice, once against the feeler and once
  // against the Dial — and the second is not merely a duplicate, it is a
  // FALSE finding: the dial does not reciprocate, its tenant does. The
  // acceptance rule "every reversing part appears exactly once" is precisely
  // this. Nearest ancestor by walking parents, never by list order.
  const rows = reg._volumes || reg.registry || reg.volumes || [];
  let deduped = rows;
  if (reg._volumes && clock.labelEntries) {
    const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
    const hops = (mesh, name) => {
      const target = unitObj.get(name);
      let n = 0;
      for (let o = mesh; o; o = o.parent, n++) if (o === target) return n;
      return Infinity;
    };
    const byMesh = new Map();
    for (const v of rows) {
      const prev = byMesh.get(v.mesh);
      if (!prev || hops(v.mesh, v.unit) < hops(v.mesh, prev.unit)) byMesh.set(v.mesh, v);
    }
    deduped = [...byMesh.values()];
  }

  // The reversal set, per UNIT. A unit reverses if any of its OWN meshes does
  // — the restoring element is declared against the part, not the mesh.
  const reversingUnits = new Map();
  for (const v of deduped) {
    if (!v.reversed) continue;
    if (!reversingUnits.has(v.unit)) reversingUnits.set(v.unit, []);
    reversingUnits.get(v.unit).push(
      `${v.meshName || v.mesh?.name || v.kind}${v.reason ? '/' + v.reason : ''}:${v.reversedVia || '?'}`);
  }

  const declared = clock.declaredRestoring || new Map();
  const scene = clock.scene;
  const twoWay = [], restored = [], unrestored = [], malformed = [];

  for (const [unit, kinds] of reversingUnits) {
    const d = declared.get(unit);
    const row = {
      unit,
      fanout: driveFanout(unit),
      sweptAs: kinds.filter((k, i, a) => a.indexOf(k) === i),
    };
    if (!d) { unrestored.push(row); continue; }
    row.kind = d.kind; row.why = d.why;
    if (!RESTORING_KINDS.includes(d.kind)) {
      malformed.push({ ...row, problem: `kind '${d.kind}' is not one of ${RESTORING_KINDS.join(', ')}` });
      continue;
    }
    // THE GEOMETRY-ONLY GUARD. A declared spring must name a mesh that is
    // actually in the scene. This does not prove the spring acts — nothing
    // static can — but it does stop an empty declaration from reading as a
    // mechanism, which is the specific failure the entry calls out.
    if (d.kind === 'spring') {
      if (!d.mesh) {
        malformed.push({ ...row, problem: 'spring declared without naming its mesh' });
        continue;
      }
      if (scene && !scene.getObjectByName(d.mesh)) {
        malformed.push({ ...row, problem: `declared spring mesh '${d.mesh}' is not in the scene` });
        continue;
      }
      row.mesh = d.mesh;
    }
    (d.kind === 'two-way' ? twoWay : restored).push(row);
  }

  // A declaration for a part that does NOT reverse is not a pass — it is a
  // stale claim, and it is exactly how this report would rot: the part gets
  // re-posed, stops reciprocating, and the declaration outlives the reason
  // for it. Report those too.
  const stale = [];
  for (const [unit] of declared) if (!reversingUnits.has(unit)) stale.push(unit);

  const bySeverity = (a, b) => b.fanout - a.fanout || a.unit.localeCompare(b.unit);
  unrestored.sort(bySeverity); twoWay.sort(bySeverity);
  restored.sort(bySeverity); malformed.sort(bySeverity);

  // The control case, asserted rather than hoped for.
  const control = twoWay.some((r) => r.unit === 'Pallet fork')
    ? 'PASS — the pallet fork is classified two-way driven'
    : `BROKEN — the pallet fork is not in the two-way bucket (it is ${
        unrestored.some((r) => r.unit === 'Pallet fork') ? 'restored-by-nothing'
        : restored.some((r) => r.unit === 'Pallet fork') ? 'restored-by-element'
        : reversingUnits.has('Pallet fork') ? 'misdeclared' : 'not reversing at all'})`;

  return {
    ok: true,                       // §40 rule: a REPORT. Nothing here can fail.
    control,
    population: reversingUnits.size,
    populationFrom: '§36 registry `reversed`',
    twoWayDriven: twoWay,
    restoredByDeclaredElement: restored,
    restoredByNothing: unrestored,
    // TODO 29 — the gateable split. §48's rule that this is a REPORT stands
    // (`ok` is still always true); what a gate can hold is that every
    // restored-by-nothing row is either fixed or WAIVED against a filed item.
    // Reported both ways so the debt stays visible in the payload rather than
    // being subtracted out of it.
    unwaived: unrestored.filter((r) => !RESTORING_WAIVERS[r.unit]),
    waived: unrestored.filter((r) => RESTORING_WAIVERS[r.unit])
      .map((r) => ({ ...r, waiver: RESTORING_WAIVERS[r.unit] })),
    malformedDeclarations: malformed,
    staleDeclarations: stale,
  };
}

export async function checkSweptOverlap(clock, opts = {}) {
  // includeDeclared: run WITHOUT the EXPECTED/IGNORED opt-outs. Only for
  // validating the check itself — on a clean movement a violation count of
  // zero proves nothing, so the positive control is to drop the exclusions
  // and confirm the geometry test fires on pairs that are known to touch.
  const { includeDeclared = false, confirm = !includeDeclared, yieldEvery = 16, pairsTouching } = opts;
  // §152 — the HULL tier runs whole (5.9 s measured, and its candidate list is
  // derived from this tree's own volumes, so it cannot be inherited); the
  // CONFIRM tier — 96.5% of this check — narrows to candidates touching a
  // changed unit. 18 candidates over 21 units on this movement, and 35 of the
  // 56 units appear in NONE of them, so a change confined to one of those
  // drops the tier entirely.
  const touching = resolvePairsTouching(clock, pairsTouching);
  const declared = (a, b) => !includeDeclared && (inList(EXPECTED_PAIRS, a, b) || inList(IGNORED_PAIRS, a, b));
  censusStart();   // §108's experiment — report-only; phase timers below split registry/hull/confirm
  const _t0 = performance.now();
  const reg = await buildSweptRegistry(clock, opts);
  const _tReg = performance.now();
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
  // §152 — the candidates this run will confirm, and the ones it declines to.
  // A separate binding rather than a filter over `violations`: that array is
  // the HULL tier's own output and stays whole, because the hull tier ran
  // whole and its list is what the skipped rows are looked up against.
  //
  // The declined rows are NOT dropped silently — the harness pairs each one
  // against the baseline's verdict for the same pair, and a candidate the
  // baseline never raised is a contradiction it fails on rather than papers
  // over (see battery-union.mjs's entitlement argument).
  const skippedByRestriction = touching ? violations.filter((v) => !touching.touches(v.fixed, v.mover)) : [];
  const toConfirm = touching ? violations.filter((v) => touching.touches(v.fixed, v.mover)) : violations;
  let confirmed = toConfirm, tightRows = [], refuted = [];
  if (confirm && toConfirm.length) {
    confirmed = [];
    // BUILT §82 levers 1 and 2 — the tier used to be fifteen sequential UNCAPPED
    // measureClearance calls, and that was 96% of the whole check: exact
    // distances of 15.69 and 12.88 computed at full BVH cost to answer a
    // question whose thresholds are 0 and CLEAR_MARGIN (chain ⇄ plate alone,
    // the scene's two largest meshes, was 87% of the tier). Now ONE batched
    // sweep (the pose walk paid once, not per pair) with each pair capped at
    // refineFloor + band: the classification needs exact numbers only below
    // the cap, and there they stay exact — confirmed (≤ 0) and tight
    // (< CLEAR_MARGIN) rows are untouched by construction, and a refuted row
    // below the cap keeps its true gap and pose. A pair the cap prunes
    // EVERYWHERE comes back at exactly the cap (unitClearance returns its
    // upper bound): that row's gap is "≥ cap", reported as such — the
    // documented price of lever 1, paid only on rows whose number nobody
    // gates. Two report consequences, both §82's own predictions: capped
    // rows lose their pose (the "minimum" is wherever the sweep looked
    // first), and batching unions the refinement index set across pairs, so
    // a sub-cap minimum can only tighten against the sequential measurement.
    const CONFIRM_BAND = 0.4;                       // sweepClearances' default refineBand, named so the cap arithmetic is visible
    const cap = CLEAR_MARGIN + CONFIRM_BAND;
    const pairs = toConfirm.map((v) => ({
      A: unitByName(clock, v.fixed), B: unitByName(clock, v.mover),
      refineFloor: CLEAR_MARGIN,
    }));
    // (§108 census: the hull tier ends here — everything after is confirm)
    SWEEP_CENSUS.c && (SWEEP_CENSUS.c.hullMs = +(performance.now() - _tReg).toFixed(1));
    // CANONICAL STATE FIRST (the registry's own rule, §40's precedent): the
    // sequential tier's fifteen walks each started from the residue the
    // PREVIOUS pair's walk left, so a residue-sensitive minimum (the alarm
    // sleeve rows TODO 38's landing filed as exactly this) was measured
    // under an accident of pair order. One walk, from the reset state — the
    // number a fresh session would measure.
    clock.resetInputs();
    const { state } = await sweepClearances(clock, pairs, { refineBand: CONFIRM_BAND, yieldEvery });
    for (let i = 0; i < toConfirm.length; i++) {
      const v = toConfirm[i], st = state[i];
      const capped = st.min >= cap - 1e-9;
      const row = capped
        ? { ...v, refinedMinGap: +cap.toFixed(4), gapIsAtLeast: true }
        : { ...v, refinedMinGap: +st.min.toFixed(4), refinedAt: st.at };
      if (!capped && st.min <= 0) confirmed.push(row);
      else if (!capped && st.min < CLEAR_MARGIN) tightRows.push(row);
      else refuted.push(row);
    }
  }

  clock.resetInputs();
  const census = censusStop();
  if (census) {
    census.registryMs = +(_tReg - _t0).toFixed(1);
    census.totalMs = +(performance.now() - _t0).toFixed(1);
    if (census.hullMs === undefined) census.hullMs = +(performance.now() - _tReg).toFixed(1);
    census.confirmMs = +(census.totalMs - census.registryMs - census.hullMs).toFixed(1);
  }
  return {
    census,
    sound: { staticVsSwept: {
      pairsTested: tested,
      violations: confirmed,
      tight: tightRows,
      refutedByRefinement: refuted,
      confirmTier: confirm ? 'on — violations are pose-confirmed contacts; tight/refuted carry the refined gap' : 'off — raw hull overlaps',
      ...(touching ? { skippedByRestriction } : {}),
    } },
    ...(touching ? { restriction: {
      ...restrictionRecord(touching, null),
      // The hull tier's own discovery order. Each confirm bucket is filled by
      // walking it, so a union that appends inherited rows would reorder them
      // — and the acceptance is byte-identity, which one swapped row fails.
      // Pair keys are unique here by construction (`seen` dedupes on them).
      candidateOrder: violations.map((v) => v.pair),
    } } : {}),
    notClaimed: {
      swept_vs_swept_phaseDependent: [...phaseDependent].sort(),
      approxUnitsExcluded: [...unverified].sort(),
    },
    registrySummary: reg.byKind,
  };
}
