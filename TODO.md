# TODO — mechanical realism backlog

Open work on the movement's mechanical honesty, kept here because it was
previously living only in chat transcripts and a session-local task list.

Most of these came out of a mechanical-engineering realism review that ranked
the movement's gaps by how badly they undermine "could this watch actually be
built". The support-structure findings (items 2, 3, 4, 7 of that review) are
closed — see *Recently closed* at the end. What remains is listed here.

## Status index

The heading convention: a bare `## N.` heading is OPEN; closed and
part-closed items say so in the heading and keep their text, edited in
place to record what was built. This table is the at-a-glance version,
refreshed 2026-08-26 — items with work left first, with what remains:

| item | state | what remains |
|---|---|---|
| 99 | CLOSED (§176) | `claim-item.mjs` reads `refs/heads` + `refs/remotes` and never fetches, so "every ref we can see" means every ref THIS CLONE HAS. Measured: a session with 2 of the remote's 206 branches was offered TODO 91, which `case-openings` already held; the same branch then hit an add/add on `BUILT-0174.md` at merge. The scheme caught both — the cost was two late renumbers, one after review. Three fixes in the item, cheapest first; the third (fetch behind the existing `--no-remote`) is what the tool already promises |
| 100 | PART DONE (§178) | Measured and now GATED — `outlines` is a battery check, 36/36. What remains is step 3, the design-time constraint. Nothing asks whether a cut outline is a simple polygon. The fork's crossed itself **5 times** for as long as the part existed and every gate passed it: `slenderness` reads a whole mesh's section so a local pinch does not register, `meshIntegrity`'s inverted rows are a different class (measured: all four are Lathe/Buffer, TODO 75's), the pair sweeps compare parts to other parts, and `fingerprint` hashes bounding boxes. §175's assert and probe gate cover the FORK only; the uncovered population is 30 `ExtrudeGeometry` sites in geometry.js and 23 in main.js, and whether any of them crosses is unmeasured — measure the class first, then gate it |
| 103 | CLOSED (§177) | Found by item 100's sweep: `alarmColDriver`'s outline crosses itself **31 times** — the only one of 176 extrudes that does. `makeColumnDriver`'s hull-of-discs emits a hub arc per arm pair and normalises `a1 < a0` with `while (a1 < a0) a1 += 2π`; but for arms closer than `th + thN` that inequality means THE HUB IS NOT EXPOSED between them, so the wrap draws it the long way and two arcs overlap over ≈164° of hub. Measured off the built mesh. The builder's existing assert guards the tangent ARITHMETIC (`hubR > tipR`), not the hull's spacing — an assert that guards the formula is not one that guards the shape |
| 104 | OPEN | A declared `INTRA_UNIT_CONTACTS` row SKIPS its pair before measurement, and the table is gated for name validity but never for geometric validity. It has stated something false twice — §169's stud 4.347 clear, §177's bore that was solid metal — both found by accident. Measured over 141 rows: 102 pairs actually overlap, but **nine declare a contact between parts 2.1 to 9.19 apart**, with an EMPTY 0.5–1.0 band that makes the cut a measured separation rather than a tuned number. A second figure needs its caveat: 96 rows excuse nothing under `contacts: []`, but that mixes genuinely-apart pairs with pairs `intraUnit` structurally never compares (same-frame movers are `checkAssembly`'s) — opposite defects, one symptom. Tier A gates the apart-rows; tier B needs a `kind` vocabulary per §137's transfers |
| 105 | OPEN | The lever's safety action, split out of item 98. The GEOMETRY is right and item 98's scope note was wrong about it — the crescent exists and is phased to the impulse pin (both at azimuth 0), and the guard pin rides at **0.2356–0.7455** over a beat, never touching, which is correct for a failsafe. What is wrong: none of those clearances is DERIVED (every one is a chosen number, so nothing can say whether 0.2356 is right), **no axis displaces the fork** so the failsafe is never exercised — §48's population argument again — and no horn-to-pin contact is measured, only pin-to-body at 0.0000 |
| 90 | OPEN | What the column wheel DRIVES has never been audited the way what drives it has. Findings 1-3 CLOSED (§171 the lock riser's station, §172 the link beak's post and bar, §173 the click replaced by a jumper on the saw). **Finding 4 MEASURED and CLOSED 2026-08-26 (§174)**: the suppressor's hold was a FLAG — `ALARM_LOCK_THETA` solved the pad to exact tangency so the pad gap measured **0.0000** at every engaged state, zero normal force, while `tick()` gated the barrel on a boolean; and a preload could not have rescued it, since µ 0.2 at that radius needs **364.6 mN** against the lock blade's **67.4 mN at its own yield**. The band is cut into a 12-tooth stop wheel with a RADIAL locking face (§99's saw drop stands 54° off radial and would cam a loaded finger out), the teeth stand OUTWARD so `ALARM_LOCK_ENGAGED` — the datum the whole switch cluster is laid out from — stays bit-identical, and the train now runs on the finger's real gap. **Finding 5 is MEASURED and OPEN, and its repair was SEARCHED and the obvious fix REFUTED** (`tools/probe-90-lockread.mjs`, three controls passing): the lever's READ is posed too — the beak's radial excursion is **0.00114**, 0.08% of the tier it is declared to read, because the wheel's centre stands ON the tail's line and a lever moves its beak perpendicular to the arm, so the column cannot block it and the lift carries it the wrong way. A real hold worked by a switch that cannot throw it. The beak cannot simply be moved: its station is QUANTIZED to whole column pitches (60°, the parity rule `ALARM_LINK_BEAK_OFF` already snaps to), the exact Thales optimum (φ 44.57°, gain **1.0000**) is mid-flank and so illegal, and both legal neighbours are taken — **−60° is the link beak's own station** (riser 0.0000) and **+60° wants a 0.6723 chamfer against a 0.6327 ceiling** and stands 0.1992 from the driver pawl. So the repair is a FOLD (an intermediate rocker at the free φ 0 station), not a re-siting. Two questions still filed unmeasured: the three riders' contacts priced as §137 rows against the column's own drive torque, and whether the selector ring's detent exists as metal |
| 87 | OPEN | The alarm toggle's action group, aggregated from four eye-reported symptoms. **Finding 1 is MEASURED since 2026-08-24** (`tools/probe-87-press.mjs`: 117.39% of a tooth and **0.39794 u** of overrun off the built tree, against 117.4% and 0.398 computed — steps 1 and 2 done — §160 put the stroke in the pose net as the `alarmPress` axis, so the overrun is a REGRESSION gate now and not only a reading). No axis varies `alarmPusherT`, so every sweep samples the pawl PARKED: the tick latches the wheel at one tooth (0.5236 rad) while the stroke runs to **0.6147**, putting **0.398 u = 0.151 mm** of travel into a tooth that has stopped — past `CLEAR_MARGIN` — and the return asks a rigid pawl to cam over a flank it has no freedom to cam over. Beside it, three declarations that answer for the wrong member: one `INTRA_UNIT_CONTACTS` row excuses the pawl against all three meshes named `alarmColWheel` at any depth; the pusher's only guide bores **0.24** against a **0.32** stem and is declared as a "return coil" that does not exist; and `restoring` answered for `Alarm switch` with the CLICK's blade, so the pusher's spring-less return was never asked about — a GRANULARITY gap where TODO 29/64 are population ones, **closed as a blind spot by §162** (declarations keyed by `(unit, member)`, bodies derived by `clusterByFrame`: 40 across the movement against 24 unit answers, and the pusher is one of four answered by nothing — waived, gated, and now a row that fails the moment the metal is built). The force half is TODO 82/79's, recorded not re-opened. **Finding 7 (2026-08-24) re-scopes step 3**: measured in the wheel's own plane the pawl stands INSIDE the root circle at the bottom of the stroke — 24/24 vertices in the saw, **0.7615 u** deep, 20× the z-capped figure — so the drive contact is not a contact and a pivot alone cannot fix it; `tools/probe-87-pawl.mjs` is the acceptance test |
| 4 | OPEN | A bucket of smaller findings; some rows closed by BUILT §61, the rest live |
| 5 | MOSTLY CLOSED (§121) | All three pair classes instrumented; the FF/MM gate covers `INTRA_TIER_SCOPE` (the alarm complex, 42 rows triaged against measured depths) and REPORTS 202 rows elsewhere — that triage is the remainder. Same-frame splits outside `ASSEMBLY_SCOPE` are §107's residue; transients are item 7's. **A third shape found 2026-08-25 (§169): the tiers gate on `intersectsGeometry`, so a FLUSH FACE is invisible** — two solids sharing exactly one plane do not intersect, and the alarm pawl ran 0.000 from the column wheel's base disc over the whole area it sweeps under it, at every pose, with every gate green. Overlap is not the only way metal can be wrong; see item 87 findings 8 and 9 for both this and the excuse a false `INTRA_UNIT_CONTACTS` row grants |
| 84 | OPEN | Every gear ships fatter than it was cut: three.js's `bevelSize` offsets the outline OUTWARD by more than the backlash the generator reserved (0.0748 u per flank against 0.0427 u for the pair at module 0.34). General to the movement; visible only where a unit is gated. Three candidate fixes in the item, none of them widening `cyBacklash` |
| 85 | OPEN | §136's residue: `makeBevelGear` and `makeBarrel` still cut trapezoids. The barrel's conversion is a §104 re-solve, not a geometry change; the bevels need a bevel spec. Also records the rule the mistake bought — a tooth-count floor must match the generator that cuts the member |
| 86 | OPEN | `gearTrueReach`'s miter takes a DIFFERENCE of the outward edge normals where the SUM is meant, and scales by the sine of the turn rather than of the half interior angle. Over-estimates, so the bound still bounds — 4.1451 against 3.9424 on the setting wheel. Correcting it un-binds `SLEEVE_TOP`'s setting-wheel cap and drops `clutchSleeve ⇄ settingWheel` to 0.1278 against 0.15, so the cap must be re-derived in the same landing |
| 83 | OPEN | The parity ray is still trusted inside the box; §122 silenced the measured outside-box lying population (166/166 on the fusee pair) but the same grazing mode could lie inside, where it would manufacture a contact. probe-122-verdict's genuineInside bucket is the tripwire |
| 77 | OPEN | The reserve train's two meshes still interpenetrate after §136 — 0.118 mm on stage one, measured polygon-against-polygon at the movement's own phases; stage two refused by the probe. The profile is NOT the cause (24/24 meshes roll at zero penetration in free space); the extrude's bevel is, which is item 84. Both rows stay waived in `INTRA_TIER_SCOPE`, so the debt is declared and new interference fails |
| 6 | MOSTLY CLOSED | An EXPECTED pair without an `EXPECTED_CONTACT_FLOORS` row still gets the blanket excuse (§94 tier A seeded the SMALL-SECONDS station's three pairs; item 41's closure seeded `Dial ⇄ Power reserve`; `Power reserve ⇄ Power-reserve train` is still unseeded; item 89 catalogues the three `Minute jumper` pairs as unseeded too) |
| 7 | OPEN | Sampling cannot BOUND motion — every sweep-based gate inherits this |
| 11 | OPEN | The alarm-stock residue after three tranches; the remaining waived rows are catalogued in the item |
| 12 | PART CLOSED | 11 rows of the 0.05–0.12 band remain, bound-or-band, catalogued per-row |
| 15 | PART CLOSED | Winding + setting chains closed; the alarm branch idler i1b remains. Its other named site, the power-reserve pair, closed with item 48 |
| 16 | PART CLOSED | The beak lever question (7.1×, not the 36:1 the text describes), and the SHAFT — but the SHAFT is now MEASURED rather than argued (§137: `probe-137-jumper-envelope.mjs`). The jumper is 13.32 u away and binds nothing since §112; the wall is the alarm setting idler at max legal r 0.285; the force budget is met at r 0.1232 (+2.7%). **TODO 82 re-took the chain: ROD-END-limited at ≈1.58 mN, not tail-limited at ≈48 mN — the stroke every earlier figure used was a deleted constant, and "in series" was a minimum. This item's ORIGINAL verdict (short by one to two orders of magnitude) is restored.** `SLENDER_WAIVERS['Alarm link']` cannot be retired by ANY legal section — §54's ceiling wants r 0.326 — so what remains is a third bush station, in position space |
| 17 | MOSTLY CLOSED | The hammer still strikes in-plane |
| 28 | MOSTLY CLOSED | Nothing — its last remainder (the lock's return) closed as item 31 (§102); the heading keeps MOSTLY CLOSED only because the profile/drive rebuild it records was never the whole item |
| 29 | MOSTLY CLOSED | The Dial row — the one entry left in `RESTORING_WAIVERS` |
| 30 | OPEN | §76's walls two and three (wall three was misdiagnosed; the crash is fixed, the wall stands) |
| 34 | OPEN | The §36 sleeve validation measures its dilation from the sweep that then approves it |
| 36 | TIER ONE BUILT | Higher tiers — a spec can change which PARTS EXIST, and liveness cannot see that (§87's addendum) |
| 40 | CLOSED (§150) | All three rows. Row 3's deferred ODE built: the cone is cut from the span-aware conservation solve (wrap helix + 3-D span + coil angle with the takeoff's walk, one length), the display's 0.05-turn wrap floor stopped minting chain, and `chainLength` GATES unwaived — spread 0.5167 u = 0.633% vs the 0.95 u half-link-pitch tolerance, 43 links at every state of wind |
| 46 | CLOSED (§124) | The chain rode the fusee base on one CORNER (1.9–2.5 u of daylight, invisible to the burial-only row). Closed by the layout: first stage re-geared 8:1 → 120/7 so the fusee runs 1.75 wraps over 2 grooves at pitch 1.389, set-up 17 → 23 clicks, level product held; links LEAN to the flank on the funded FUSEE_TILT_Z raise. Ideal torque law exact again; the new float row gates the seat at 0.202 unwaived (was 3.191 waived) |
| 47 | CLOSED | The zero reset's timing is the CONTACT now, not a `leverEngage` ease — the heart holds still until the roller reaches it, then rides the flank down. What is left is elsewhere: the seat still has no `EXPECTED_CONTACT_FLOORS` row, which is item 6's work |
| 48 | CLOSED | Re-measured by its own probe at 0.03–0.07% off anti-phase (was 47–49%): the gauge's threshold moved to the probe's percentile form, w1+p1 solved as one rigid blank (pair group), and the train is DRIVEN from p0's slip coupling with the hand arriving — same angles, forward |
| 49 | OPEN (unblocked by §150) | The fusee end of the chain is hooked to nothing — the drum end has a claw, the cone end has no metal while the support edge claims the joint. Its blocker (40 row 3's length closure) is CLOSED: path (a) — pin both ends — is open, the drum end's congruence branch margin is already boot-asserted as the template, and since §150 the cone at dead reserve is honestly bare, so the anchorage is also what would keep the last link attached at all |
| 50 | CLOSED (§149) | The going stem's one-way is metal: the dual-purpose pinion split into a fixed winding pinion and the sliding clutch, joined by a saw coupling one profile law cuts, rides and measures — the very split a parallel 2026-08-21 re-scope reached from measurement before this landed. `windStemSlip` is the coupling's relative index — persisted, with the two sub-pitch laws (forward take-up, drain pickup) and the `stemSlip` axis that lets §48 judge the clutch. The alarm instance is item 72 |
| 72 | OPEN | The alarm stem's one-way has no metal — a backward alarm crown does nothing at all, the free-slip at the stem⇄contrate bevel unmodelled. §149's coupling (`sawCouplingSpec`/`makeSawCoupling`, movement-independent by design) is the reuse path |
| 51 | CLOSED | Both rows clear, boot silent; the residue is worked through since. The beak window holds the beak's own arc plus a step (five legal steps, was two — the old demand was `2·BEAK_SCAN_STEP`, a two-sample target); the arm hold reads a 72-bin per-sector reach (`armStopAt`) instead of the compass max — stock only, riser in by 0.29; and the Fusee row's 0.1500 equality was tried against a §50 pivot-floor relief and REFUSED by measurement (the span's corridor covers every legal beak azimuth at the lower band) — the refusal is written at `HUB_Z2` |
| 52 | OPEN | `setPathRot` is not persisted, so the setting train re-phases on reload — the sibling §126 closed on the winding side by deriving rather than saving |
| 53 | CLOSED | The plate floor counts the chain now: `CHAIN_TQ_REACH` bounds the discrete top-of-wrap in closed form and joins `TQ_BOT_Z`'s max beside the spring — gap 0.117 → 0.187, the A2 assert holds the margin (not just the sign) plus the bound's conservativeness, and a `Chain ⇄ Three-quarter plate` budget row sweeps it independently. Cost priced: the cock sits ~0.07 down in the plate band |
| 54 | CLOSED (§127) | Every sweep calls `enterAxis` before each axis, and `axisEntry` gates all 110 ordered pairs at 0 violations. The leak the old order-dependent entry used to carry is measured and REPORTED beside the gate rather than dropped — that report is the record, not a remainder |
| 55 | CLOSED (§129) | The alarm stop-work counts the WIND now, not the arbor's absolute angle: a plate-mounted spider differential subtracts the barrel's two members, so the cross walks back as the spring empties. Residue is item 56 — a closed item is a bad place to keep live debt |
| 56 | OPEN | No axis winds, rings and winds again, so §48's audit takes its population from a `reversed` flag that never sees the reversal — the cross is driven both ways and the gate passes it in silence. Needs the axis first, the moved rows accepted per row, then the `'two-way'` declaration |
| 57 | CLOSED (§132, widened by §148) | Both fixes landed, in the order the item asked for: the prose was corrected first, and BUILT §132 then made the claim true — `makeChaton` is instantiated on the going train's three upper pivots and the README says which three. The plate's own "not viable" scope note is withdrawn in place: it was a reading objection, and the depth behind it was never derived. §148 then took the scope note's OTHER half — the escape wheel and the alarm striking arbor are chatoned too, because the screw stopped scaling with the chaton — and re-derived the stone, the rim, the counterbore fit and the screw against the movement instead of against the chaton itself |
| 58 | CLOSED | The word is gone from every claim site: the mechanism is a **minute quick-set with a detented display**, in `BUILT.md` §1's title, `main.js`' two section headers and `explain.html`. The inner defect is not fixed — it is now SAID, in the source beside the rounding and in the explainer's own ledger: the input is driven through the real tooth counts, the detent is `Math.round(…/MIN_PITCH)`, and the star turns with the ROUNDED value, so the beak follows a profile the display already chose. Roadmap §4 is where the stronger word would be earned. Paid as filed: three explain-page blocks × five locales re-translated (`--check` PASS, 596/596), and fifteen `src/i18n.js` rows for three tour captions — one more caption than filed, because *"the beak snaps the hand"* was the same overclaim in miniature |
| 59 | CLOSED | The nose's radius is solved against the surface it rides — the wall, and the top CORNER, whose roll-off branch (`baseR + √(noseR² − dz²)`) nobody had modelled; the transition is set by the nose radius and `dz/da`, not by the flank's whole 10.68°. Arm angle by law of cosines, not the old first-order chord. Measured over a pitch: old 30/121 samples buried worst 0.699, new **0/121**, worst clearance 0.0052. The row citing "the switch's own asserts" pointed at a check nobody wrote — one exists now, independent of the law |
| 60 | CLOSED | Three things, and only the first was filed. The arbor was sized to the tower's MIDDLE member, so 1.9 units of tower stood on nothing — side gear B AND its pinion, not the one wheel filed. The zero-height sleeve was a wrong constant: `halfHeight` is the swept ENVELOPE while the cone's hub face is `sideBoreR + faceWidth` (the bevel extrudes along z, then shears), so BOTH legs' sleeves ended 0.672 short in mid-air. Now `SUB_SPEC.hubFaceZ`. Plus a per-member reach assert at build, proven to fire |
| 61 | CLOSED | All three sites say what is cut (a trapezoidal stand-in, no conjugate action modelled, the escape wheel's club teeth the one designed surface); real cycloidal teeth stay roadmap §136. CI's fingerprint proved the comments-only claim (hash identical to main) |
| 62 | PART DONE | The GOING TRAIN is solved (backward from the escapement, pair groups per arbor, four runs at four modules) and the striking 64T ⇄ governor mesh with it. Remains: the four keyless runtime bases (two tick-driven chains, a TODO-48-sized solve each), the bevel sites (beyond the planar gauge — §135's instrument question), and §129's tower pinion |
| 63 | PART DONE | Stall re-taken from the built metal and then CORRECTED (§137): lever gain 7.1×, tail blade 305 N/m, and the 1.6 mN "shaft-limited" headline was a stiffness for a span §68 retired — at the measured 0.9286 mm overhang the shaft is 2518 N/m. **RE-TAKEN AGAIN by TODO 82 and this time computed rather than quoted: ROD-END-limited at ≈1.58 mN, BELOW the 5–50 mN band — the 48 mN rested on a deleted stroke constant and a minimum where compliances add.** The elbows' bending is COMPUTED (Gate A: rigid bend defensible at the derived sub-mN loads, δ ≤ 0.6% of stroke even at `ELBOW_E_MAX`) and all five force paths are priced in place. Remains: TODO 16's third bush station, and §137's own idiom record. **§173 closed the over-strained click blade by deleting the click — its sautoir's free length is solved from `SPRING_STRAIN_MAX`** |
| 64 | OPEN | `alarmCrownPullT` is never swept as an axis (pinned 1 on `alarm`, 0 on `alarmWind`), so `Alarm release lifter`, `Alarm release sleeve` and `Alarm silence rocker` never reciprocate and §48 cannot judge them. The rocker's return blade EXISTS in metal and is simply undeclared — the audit passes it for the wrong reason. Rule 4's own warning, a third time |
| 65 | CLOSED | `schematic` and `focusUnit` were emitted by `captureState()` and dropped by `sanitize()`'s allow-list, so §69's "only an explicit saved false turns it off" could not happen and `restoredFocus` was dead. Both added to `defaultState` and `sanitize()`. Emitting without allow-listing is silent by construction — check the two lists together when adding to `captureState` |
| 66 | OPEN | Four one-line untruths: `flute-slider` does not persist while `rib-pitch` and its own generated row do; six `lighting.*` leaves render live and have no applier line (liveness is judged per DOMAIN, not per leaf); `vendor/README.md` denied the two local patches its own header documents AND recorded upstream's hash as the shipped file's, so its own `cmp` step always failed (FIXED here — both hashes now recorded under their own headings); and this file's TODO 8 text describes a two-row alarm readout that no longer exists, against a premise BUILT §38 retired |
| 70 | OPEN | `makeJewelSetting`'s collar is wound inside out AND is an open shell — three in the scene, found by §148's own winding assert swept scene-wide. The winding is a two-line fix; the open profile is TODO 27's measured hazard and is the real work |
| 71 | CLOSED (§151) | The arrest armed on a fiction — up to +0.109 of daylight under the pad through the arming band, found by a user watching the sim. Five measured causes, all closed: link parity (every link read as outer, 0.085), node-sup bridging of real inter-link dips, a six-pitch window that missed the proudest link in the pad's band, a first-order pose 0.060 short of its own law, and a finger solve blind to the free SPAN (the re-sited fold parked the beak arm inside the flying chain). The pad law now samples the BUILT chain buffer, the pose is the lever's exact inverse, and a span corridor law gates the fold; the full-wind row measures 0 unwaived and the new `arrest` axis puts the arm in §48's population |
| 69 | OPEN | `TQ_T` = 0.303 mm, thinner than any plate a watch is built from and the one dimension in the frame with no derivation at all. §148 made it load-bearing: a chaton's fourth member — the ledge its screw heads clamp — needs `t ≥ 0.633` against a collar that caps `t` at 0.483, an EMPTY window, closed for now by countersinking the screw rather than thickening the plate. Raising `TQ_T` moves `TQ_TOP_Z` and everything above it |
| 67 | OPEN | `spiderSpec.halfHeight`'s trailing `margin` reads as `CLEAR_MARGIN` 0.150 and measures **0.027**: the `√½` treats `faceWidth` as normal to the pitch cone while `makeBevelGear` extrudes along z and shears, so 82% of the margin is silently spent. Matters because §129's siting solve spends `halfHeight` as a clearance band. One line of arithmetic, but the acceptance is a re-solve |
| 73 | PART DONE | Half 2 closed: the vendored raycast guards `getInterpolation`'s null (third `PATCHED (timesim)` diff — a zero-area face is no countable crossing; `check-bvh-patches.mjs` carries a synthetic sliver witness that throws unpatched and counts patched). Half 1 remains: cap the builders' degenerate faces — a shared-builder fix (`ringExtrude` reaches ~9 consumers), which moves the fingerprint and is its own landing; `meshIntegrity` (shipped) reproduces the 8 and the 6 as its column-wheel rows, so the fix and any regression are visible in the report diff |
| 74 | OPEN | The first triangle census (§77's `meshIntegrity`): **3,233 zero-area triangles across 125 of 568 geometries**, catalogued by cause — `alarmArrestCross` 1,160 collinear, `chainRun` 1,040 collapsed, the `ringExtrude` fleet's 4/8-sliver pattern across 85+ consumers, lathe cap fans on the fusee/pillars/studs. Fixes are per BUILDER and each moves the fingerprint; the census numbers may only go DOWN
| 75 | OPEN | Four bodies measure INSIDE-OUT by signed volume — two Fork-cock lathes at −56% and −73% of their own bboxes, a Balance-cock lathe, and `alarmFaceCam`. Item 4's fixed-pillars class, item 70's invisibility (nothing coplanar behind them). NOT item 70's collars — coordinates measured and do not match. `assertLatheOutward` exists to point at the three lathes
| 76 | OPEN | The chain's declared articulation fiction, measured by §77's declared tier: 91 adjacent link/rivet pairs interpenetrate (median 0.05 u, max 0.24 u at boot; BVH-confirmed), 0 non-adjacent. Adjacent pairs are `subBodyOverlapOk` citing this item, so the instrument keeps watching for corruption while the fiction is declared where it lives. Fix is real articulation — an owner's call on whether the fiction is worth closing |
| 78 | CLOSED | §54's `checkSlenderness` was exported and NEVER REGISTERED in `CHECKS` — `start()` answered "unknown check", so it had not run once since §52, its waiver waived rows in a report nothing produced, and three different λ values for one mesh accumulated in `main.js`. Second instance of the class (TODO 29 was the first), so `ci-battery` now GATES `CHECK_NAMES` (read from the page) against `BATTERY`. It also measured stock length, not free length: meshes may now declare `userData.bearings` and λ is taken per free length, an overhang scaled by `SLENDER_OVERHANG_K` = ∛16. Report (§40): **9 rows over ceiling, 7 unwaived and untriaged** |
| 79 | OPEN | The alarm link's lay shaft has a **12.487 u / 4.732 mm rod-end overhang at 21.2 N/m** — TODO 16's condemned 4.5 mm / 21 N/m cantilever returned at the other end. §68 sited the bushes at chord t 2.45/22 for short overhangs at both ends; §112 grew the chord ≈9 u and the two station literals did not travel with it. **MEASURED by TODO 82: the transfer IS rod-end-limited, at ≈1.58 mN — below the 5–50 mN band, and the rod-end overhang carries 72.4% of the whole chain's compliance while the fork-end the section was sized against carries 0.1%.** (The 3.3 mN first filed here was the free-cantilever value against a stroke that was itself a deleted constant; both are corrected in TODO 82.) Fix is position space and is NOT roadmap §156's third bush, which splits a span that does not govern |
| 80 | OPEN | `weldGeometry` returns a fresh `BufferGeometry` and does not copy `userData`, and `weldTree` assigns it at the end of boot — so a `geometry.userData.subBodies` declared on a non-indexed geometry is silently deleted before any check runs, reporting `declaredGeometries: 0`. §77's shipped tables survive by construction (`mergeGeos` declares after welding, and its output is indexed), which nothing states anywhere |
| 81 | OPEN | `meshIntegrity`'s sub-body census is a function of the SHARD SCHEDULE — 136/0 against 50/134 on one tree. Found by §127 tier 2a's landing, not caused by it: it is the RUNTIME half of item 80, whose boot-time half is `weldGeometry` dropping `geometry.userData`. Never compare this tier's counts across runs with different task partitions; a `--report` diff that does must cite this item |
| 82 | CLOSED | The pusher→ring stall had been written down four times (1.5 / 1.6 / 48 / 3.3 mN) and never computed. Two errors, same direction: the stroke every figure used was **`ALARM_LINK_ROD_TRAVEL = 0.42`, a constant `main.js` deletes as "referenced nowhere, and wrong"** (measured 0.09932 u = 0.0376 mm, 4.2× smaller, taken two ways that agree to five decimals); and "in series" was implemented as a **minimum** over members charged against different strokes, where compliances add as `n²/k` reflected to the ring. Computed: **k_eff 21.89 N/m, stall 1.58 mN** — ROD-END-limited, an order of magnitude BELOW the 5–50 mN band, restoring TODO 16's original verdict and refuting §137 Landing 2's 48 mN. The rod-end overhang is **72.4%** of the compliance; the fork-end the section was sized against is **0.1%**. `tools/probe-82-alarm-stall.mjs` |
| 88 | OPEN | All — the design is written in the item: derive `SET_BACKLASH` from the setting chain's mesh backlash and make the setting-time step the spring's equilibrium over the real V, replacing the `Math.round`; step 1 (the click spring's detent-force arithmetic, P1) stands alone. Roadmap §4 keeps the WHEN half and the word |
| 89 | PART DONE | The zero-movement half LANDED (fingerprint unmoved): four constants derived or named, the garbled `STAR_R` fragment gone, and two of the three promised asserts written and proven to fire — the third (valley seat) REFUSED as tautological, the lifter plane collapsed from three copies to one name. Two defects the measurements found: the jumper's station is **326°, not the 320°** everything claimed (§136's tooth-spec re-derivation silently re-sited it), and the detent latches at `crownPullT > 0.5` while the beak only reaches the star at **0.863** — quantizing the display across ~36% of the pull with the jumper out of contact. Remains: that engage fix (its assert lands with it), the movement-risking constants, the three unseeded floors pairs, and the ungated explain number |
| 98 | CLOSED (§175) | The fork is ONE blank of ONE thickness, lapped to `FORK_T` overall — the chamfer comes out of the stock instead of standing proud of it, which is what made the part 1.488 thick while `L_BALANCE` read 1.2. `FORK_HALF_Z` is a declaration in layout.js now and `main.js` asserts the blank against it, so the rim's 0.15 is the margin that exists. The belly is gone and its wheel-clearance bound became a build-time check over every extruded vertex, mitered, asking `CLEAR_MARGIN` instead of a hand-set 0.1. Two things the plan got wrong are written into the item: exact mirror arms cost 0.2361 of head width reaching at the wheel to hide the draw, and raising the balance to meet the fat blank threw six §47 warnings in the arrest — the builder was wrong, not the constant |

Closed in place, text kept as the record: 1 (torque became item 32), 3,
9, 10, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27 (closed with a
named residue — the instrument gap is roadmap §77's subject, not this
item's), 31 (§102 — the lock's return blade), 33, 35, 37 (§99 — the
wound arbor and its click, re-measured against the eye by §101: reverse
saw, valley-filling beak, the give-back enacted), 39 (§100 — the going
drum's fixed arbor), 41, 42 (§103 — the guide stack derived downward;
the item's own window was measured empty, TODO 23's verdict one guide
up), 43 (§105 — five detector artifacts fixed, ten units measured out
of the §48 population by the item's own arbiter), 38 (both winds swept;
the going axis is a cycle, and it found an undeclared reciprocator and
two blind-spot joints in its first hour), 32 (§104 — the striking
governor: the alarm's derived k finally produces the cadence, with an
80-click set-up so the ring stops instead of crawling), 44 (§112 — the
tier-split's re-derived sleeve span IS the turned step the item
prescribed; the striking rotor measures one body and the waiver is
gone), 45 (§111/§113/§120 — the governor anchor's review: the escapement
re-derived with real drop, both bearings bored and then LOCATED, and the
stone refused on the duty integral and on the pinion's root circle) — plus the
*Recently closed* bucket at the end (former items 2 and 8 live there).

**Verify any fix with the inspector** (`src/inspect.js`), not by eye:

```js
const I = await import('./src/inspect.js');
I.start(__clock, 'inspection', { includeExcluded: true });  // then poll I.status()
I.start(__clock, 'support');                                // must stay at 0 failures
I.start(__clock, 'clearances');                             // must stay at 0 violations
```

Use `start()`/`status()` rather than awaiting directly — the full sweeps take
100s+ and will blow a browser-eval timeout. Do **not** pass
`yieldEvery: Infinity` to "fix" that: it removes the cooperative yields, blocks
the main thread for the whole sweep, and wedges the tab.

---

## 1. CLOSED — the mainspring winds; its TORQUE is now item 32

The spring spiral was a child of the drum whose rotation/scale were a
direct *readout* of tension (`main.js`, `springChild` in `tick()`).

CLOSED half one: the inner-end anchor and set-up ratchet exist — the
`Set-up work` unit puts a static collar + hook on the drum arbor at the
spiral's heart, and the arbor ends in a plate-top square carrying the
classic set-up ratchet + click (static in service, exactly like the real
thing). The drum→chain torque path closes on a fixture.

**CLOSED half two, 2026-08-06 — the wind is a MORPH.** The remaining half
was "the spiral's wind state is still a scale/rotation readout rather than
a keyframed morph whose inner boundary follows the (now anchored) arbor
and whose outer end follows the drum wall". It is now exactly that
(`mainspringFrames` in `geometry.js`, `makeBarrel`'s `springArborR` /
`springWindSweep`).

**What a mainspring actually is, and what the model now says.** Two ends,
both fixed: the inner on the static arbor, the outer on the wall that
turns. So the only quantity that changes is **A**, the angle the ribbon
spans from one end to the other, and `dA = −dθ_drum`. Both end RADII are
pinned, so the one freedom left is how radius is distributed along the
sweep — and two constraints, neither of them a taste, fix it:

```
r(a) = innerR + (p/2π)·a + S·(a/A)^k        a ∈ [0, A]
```

- `p = 2·ribbonR = 0.2698` is **coil bind**: the ribbon's own radial
  thickness, the closest two turns can lie without merging. The affine
  term carries it at every `a`, so no wind state can draw the coils
  through each other. What is left, `S = (outerR − innerR) − p·A/2π`, is
  the spring's **capacity** — 4.9215 at full wind, and the number that
  says whether a reserve fits in a drum at all.
- `k` is **solved per frame** (bisection; length falls monotonically with
  k) so every frame's developed length is the free ribbon's **157.4889**.
  Steel does not grow. `k > 1` packs the turns onto the arbor and leaves
  one long sweep out to the wall — a wound spring — and `k = 1` is the
  plain Archimedean spiral, so the FREE coil (5 even turns, the ribbon as
  cut) is a member of the family rather than a special case.

**Handedness came out of the drum, not out of a preference.**
`drumGroup.rotation.z` RISES as the reserve falls, so the ribbon has to
LOSE sweep as the drum turns +z: the spiral runs clockwise outward. Wound
the other way, the spring would gain turns while it drove. Nothing could
see that error while the whole spiral rotated rigidly; the morph makes
the sense a fact about the geometry.

**The measured build**, all of it derived and all of it boot-asserted
(re-quoted 2026-08-09: items 40 and 32 moved the wind range — the re-cut
cone takes up different chain, and the service band now rides above item
32's set-up — so every row downstream of the range moved with them):

| quantity | value | where it comes from |
|---|---|---|
| wind range | 8.4101 rad = 1.3386 turns | `DRUM_ROT_FULL = CHAIN_ENGAGED / DRUM_WRAP_R` — all the chain, at the feed radius. One constant now, where the chain rebuild and the tick each wrote it out |
| sweep, run-down → full | 5.7083 → 7.0468 turns | free coil + item 32's 17-click set-up (0.7083 turns) + the range above — the free 5.000 coil is a BENCH state now, reachable only by letting the set-up down |
| innerR | 1.63490 | the arbor collar (1.5) + one ribbonR: the inner coil BEARS on it |
| ribbonR | 0.13490 | solved out of its own definition — `rib = q(outerR − arborR)/(1 + q)`, `q = 0.1/coils` — because innerR now depends on it |
| developed length | 157.4889, spread 3e-13 | the length constraint, measured on one quadrature so it is compared with itself |
| capacity S at full wind | 4.8438 | > 0, so the annulus holds 7.047 turns at bind |
| min coil pitch | 0.27175 vs 0.2698 bind | at full wind the spring is within 0.8% of coil-bound — the set-up wound the slack TODO 40 left back into the band, which its header note asked for |
| frames | 71 | no point may move more than one ribbon thickness between frames, at the MEASURED sensitivity |
| segments | 266 | the chord may sag at most a tenth of the bind gap into it at the tightest radius |
| cut-length spread | 0.0764 vs 0.2698 | the tessellation's residue on the length constraint, held to the ribbon's own thickness |

**Re-quoted at §150 (2026-08-21), two re-cuts later.** §124 re-geared the
first stage and deepened the set-up to 23 clicks, and §150 cut the cone
from the span-aware conservation solve, so the table above is this item's
LANDING record, not the shipped tree: today the wind range is
`DRUM_ROT_FULL` = u(1) − θ_s = 4.2279 rad = 0.6729 turns (no longer
`CHAIN_ENGAGED / DRUM_WRAP_R` — the drum also pays out the free span's
give and the takeoff's walk, §150), the service band runs 5.9583 → 6.6312
turns, frames 34, capacity S = 4.956, and the tightest coil pitch is
0.28763 against the same 0.2698 bind (6.6% clear). Every derivation in
the table stands; the numbers ride the two later sections.

**Swept across the reserve SPEC, not just the reserve.** §22 makes the
reserve a knob (12–48 h, clamped in `layout.js`), and it drives the wind
range through the chain, so the spring has to survive the whole menu.
Measured at boot for 12 / 24 / 30 / 48 h (under item 32's law): the wound
sweep runs 6.406 → 7.530 turns, frames 34 → 108, capacity 5.017 → 4.713
(always positive), length error ~3e-13 throughout, and the tightest coil
pitch 0.3132 → 0.26983. At 48 h that last number IS coil bind (0.26980):
the drum is exactly full, which is the honest report rather than a
failure. Boot stays silent at every setting except 48 h, where it emits
the §22/§61 fusee crest warning — pre-existing, reproduced identically on
`main`, and not this entry's.

**The residue of keyframing, stated rather than implied.** The wind is
quantised to 71 states (re-measured under item 32's law), so the "pinned"
inner end does not hold its world azimuth exactly — measured across the
reserve it wanders ±0.059 rad about `innerAnchorAz`, which at r 1.635 is
±0.096 of arc. That is the frame rule doing precisely what it was derived
to do (bounded by one ribbon thickness, 0.270), and it is smaller than
the ribbon's own half-thickness, so the end never leaves the hook it
butts. It is a quantisation, not a drift: the same tension always gives
the same frame.

**One implementation detail worth keeping, because it looked like a
defect in the mechanism and was not.** The length is integrated from
√(r² + r′²) with a composite 2-point Gauss rule, which is OPEN — it never
evaluates a = 0. That is a correctness requirement, not a speed one:
r′(0) is discontinuous in k across k = 1 (the distribution term
contributes S/A there at k = 1 exactly, and nothing at all for any
k > 1, since 0^ε = 0), so a closed rule gives the FREE frame an endpoint
bump every wound frame lacks — 5.5e-4 of phantom stretch in the one
quantity whose whole job is to be identical. The discontinuity is a
single point of a curve and means nothing physically. Picking the
quadrature that cannot see it also took the build from 2.6 s to 0.23 s
(the chord sum it replaced wanted 20 000 samples to reach what 128
panels reach exactly), so the honest instrument was the fast one.

**Three things the morph fixed that nothing had been measuring.**

1. **The old readout was driving the spring through the drum wall.** At
   empty the law scaled the whole spiral by 6%, putting the outer coil at
   r 9.027 against a wall bored to 8.680 — **0.347 of standing
   penetration**, in a ribbon built 0.164 clear. It was invisible because
   both parts are `Mainspring drum`, and it had been *declared* as an
   intra-unit joint ("the outer coil bears on the drum wall at the hook"),
   which is how a defect gets a certificate. The morph pins that end
   instead of stretching it and the row is gone.
2. **The ribbon was buried 0.036 in the collar it was supposed to sit
   on**, because `springInner` was a fraction of the drum (`radius·0.16`)
   and the collar's radius was a separate literal. Deriving one from the
   other makes them tangent by construction.
3. **The arbor hook could not have been a pin.** The old one was a 1.4-long
   radial pin reaching r 2.9. At full wind the turns lie at bind from
   1.635 — 1.635, 1.905, 2.175, 2.445, 2.715 — so that pin crosses **five
   coils**. A real barrel-arbor hook is a stub standing one ribbon
   thickness proud of the collar, with the ribbon's end FACE bearing on
   its flank, and that is what it is now; its azimuth is derived from the
   full-wind sweep rather than placed. The collar grew with it, 1.2 → 3.217
   against a 3.239 ribbon (the drum floor is what stops it being exact) —
   an inner coil standing on nothing for two thirds of its height was the
   other half of "anchored".

**Keyframes, not an in-place morph, for a reason worth keeping.** The
inspector caches a BVH per `BufferGeometry`. Rewriting one geometry's
positions between poses would leave every sweep measuring the boot pose's
surfaces — silently. Distinct geometry objects are what that cache keys
on. (~4 MB for 88 frames; the alternative is wrong, not just cheaper.)

**And it cost the instruments something, which is now repaired.**
`intraUnit` derived its mover/fixture split from each mesh's
unit-relative MATRIX. A morphing part's matrix never changes — so the
moment the ribbon stopped rotating rigidly it would have become a
"fixture" and dropped out of the check entirely, and this entry would
have closed by making the movement less watched. `relSig` now carries
`geometry.id` as well: **a morph is motion**. It immediately surfaced two
joints nobody had ever measured, both real and both declared — the
hairspring's spiral against its collet, and against its own terminal
curve. The hairspring breathes by the same mechanism and had been
invisible for the same reason.

**The §48 audit gained a member the same way, and this one is the
movement's clearest spring.** The retired readout rotated the spiral
rigidly with tension, which the §36 registry read as one more monotonic
rotor; the morph makes wound↔run-down a SHAPE change, the registry flags
`mainspringRibbon` reversing, and `Mainspring drum` appears in the
audit's population for the first time — as restored-by-nothing, until
declared. It is now `declareRestoring('Mainspring drum', 'spring', …,
'mainspringRibbon')`: the ribbon *is* the restoring element, and the
winding path (keyless → fusee → chain) is what carries it the other way,
which is the same two-way drive already declared on `Chain` and
`Fusee & great wheel`. Both instruments say the same thing about this
change — an honest law is one the battery can see.

Verified: `tools/ci-battery.mjs` locally, **14/14 gates, 3055 s** — boot
silent, support, graph, penetration, alarmHandoffs, stockFloor (507 rows,
64 waived, the same 64 `main` carries), intraUnit, expectedContacts,
oscillator, restoring, inspection 0 FORBIDDEN, clearances 0 violations
over 30 budgets, sweptOverlap **0 CONFIRMED** over 59 216 pairs (2 tight,
13 refuted), and the fingerprint identical across two virgin boots. Both
explainer gates pass too (i18n 100% in all three locales, 0 unmatched
keys; explain-quotes 0 disagreements). The schematic's spiral line rides
the morph rather than quoting a plan the metal has left behind — §78's
declared residue for this ribbon, closed in passing.

**What was NOT closed here — the spring's TORQUE — became
[item 32](#32-closed-104--both-springs-torque-laws-are-derived-from-their-ribbons-and-the-alarms-cadence-is-the-governors-arithmetic),
and is now closed there whole:** `springTorqueAt` is derived
from this ribbon's section and wind (with the 0.35 revealed as a 17-click
set-up on the ratchet this movement already builds), the fusee is cut
against the derived law, and the `equalisation` gate holds the solve. The
alarm's cadence — the item's last remainder — closed with §104's governor.

## 3. CLOSED — `handSetOffset` derived through the setting path

Closed by the minute quick-set (BUILT §1): the hand-set value is
now `rawSetOffset`, computed forward from the crown's rotation through
the real tooth counts (windPinion → settingWheel → minuteArbor compound →
cannon), then quantized to whole minutes while the crown is out (the step
folding into a persistent correction on push-in). Item 58 is where that
quantization's own honesty is accounted for: the DETENT is arithmetic and
the star + jumper follow it — what this item closed is the INPUT path.
Nothing about hand-setting is assigned any more — the number travels the
gears. (The reserve train keeps its own representational convention;
that's its entry, not this one.)

## 4. Smaller items

- **Hack-pad assembly note.** The stop pad sits radially *inside* the balance
  rim's annulus, so the crank cannot be dropped vertically into its clevis
  with the arm level — it goes in with the arm swung down (released pose) and
  rotates up under the rim. Trivial with the see-saw crank (the released pose
  IS the drop-clear pose), but worth a comment in the code so the constraint
  isn't lost.
- **Degenerate triangles in two of the column wheel's three meshes.** Found
  while measuring item 28's pillar rebuild, and NOT caused by it: the base
  disc carries **8** zero-area triangles out of 776 (from `ringExtrude`) and
  the ratchet skirt **6** out of 116 (from its saw-outline `ExtrudeGeometry`).
  The rebuilt castellations measure 1224 triangles and **0** degenerate, which
  is what makes the other two stand out. Neither is a zero-thickness REGION —
  both are triangulation slivers inside otherwise solid bodies, so nothing
  reads as sheet — but they are geometry a mesh should not carry, and
  `stockFloor`'s "0 degenerate" gate does not see them (it measures a mesh's
  extents, not its triangles: [item 27](#27-fasteners-are-modelled-the-openings-and-heads-they-need-are-not)'s third blindness class again). The fix
  belongs in the shared builders, so it would clear every consumer at once.
  **MEASURED SCENE-WIDE (§77's `meshIntegrity`, 2026-08-21): the two
  builders' 8+6 are a corner of the population.** The first triangle census
  reads **3,233 zero-area triangles across 125 of 568 geometries** — the
  `ringExtrude` pattern (4 or 8 slivers) across 85+ consumers exactly as
  predicted, and beside it whole populations nobody had seen: item 74 has
  the catalogue. The threshold is derived, not chosen: the defective
  decades top out at 1e-15 and the smallest intended triangles start at
  1e-10, so `ZERO_AREA_MAX = 1e-12` sits two decades from each bound
  (`tools/probe-77-threshold.mjs` re-derives it).
- **FIXED — the column wheel's pillars were wound INSIDE-OUT.** Reported as
  "missing surfaces on the columns", which is exactly what it looked like. NOT the
  degenerate triangles above, and not the sliver guard that skips them: a
  dropped zero-area triangle contributes no surface to miss. Every triangle
  the pillar loop emitted was wound the wrong way round, so with the
  material's default `side: FrontSide` the outward faces were culled and the
  columns read as holes with their far inner walls showing through.

  Measured by signed volume from the winding — positive for a body wound
  CCW seen from outside, which is three.js's front-face convention:

  | mesh of `makeColumnWheel` | tris | before | after |
  |---|---|---|---|
  | base disc (`ringExtrude`) | 776 | +70.44 | +70.44 |
  | castellations (item 28's pillars) | 1224 | **−27.52** | **+27.52** |
  | ratchet skirt (`ExtrudeGeometry`) | 116 | +31.20 | +31.20 |

  Controls run in the same probe to fix the sign: `BoxGeometry(2,2,2)` →
  +8.0000 exactly, `CylinderGeometry(1,1,2,24)` → +6.2117 against a true
  6.283 (faceted). The wheel's other two meshes come from stock builders and
  were always correct; only the hand-emitted pillars were reversed, and all
  four of their surface families alike — one consistent orientation error,
  not a mixed mesh. It confirms by hand: the top surface's
  `tri(b+2, n+2, n+3)` had normal θ̂ × r̂ = −ẑ where a column's top must
  face +z.

  **Fixed** by reversing the triple inside `tri()` — one reversal is
  provably uniform where eight quad re-orderings are eight chances to get
  one wrong. Verified per surface family at the mesh, not by eye: the
  plateau's 72 triangles all face +z, the floor's 312 all face −z, the inner
  wall's 300 (r 3.610) all face inward and the outer wall's 300 (r 5.700)
  all face outward. Magnitude is identical before and after because the
  triangles are the same ones.

  **The regression guard is local, because the battery has none.** No check
  anywhere reads winding — which is exactly how this shipped, and why
  positions being untouched (fingerprint and every clearance verdict
  unchanged) was no protection. `makeColumnWheel` now computes the signed
  volume at build time and `console.warn`s if it is not positive; each
  pillar closes on its two knife edges, so the castellations are a union of
  closed bodies and the test is exact rather than heuristic. The general
  case is still open: this lives inside a single mesh ([item 27](#27-fasteners-are-modelled-the-openings-and-heads-they-need-are-not)'s class),
  and "is this body inside-out?" is a cheap closed-form row for the
  roadmap's `meshIntegrity` instrument next to self-intersection.

- **Sweep runtime.** Post-restride the clearance sweep hit ~355 s; profiling
  showed ~all of it was ONE cost — unbounded closest-point queries against
  the plate's ~21k-triangle extrusion (180 ms/query, 6 of 13 budgets). Now
  capped at refineFloor + band (a budget only needs exact numbers near its
  floor): 355 s → 40 s, identical verdicts. If the layout refactor needs
  more: (a) a low-poly query proxy for the plate (its render mesh is 96-seg
  curves + bevels; a ~2k-tri hitbox is another ~5-10x on plate pairs);
  (b) only then WASM SIMD narrow phase — the profile says native code was
  the WRONG first move (setPose: 0.04 ms/pose; the myth that pose eval or
  matrix updates dominated died by measurement). runInspection still runs
  uncapped narrow phase and remains the slow one (~6 min).
- **Inspector milestones** (`src/inspect.js` header TODO): extend
  `PENETRATION_BUDGETS` to pin-in-notch (chain-on-cone and chain-on-drum
  landed with §61's true groove seating); allowed phase windows per
  budget; a continuity check for linkage branch flips; a known-good
  baseline so re-runs only flag regressions.

## 5. MOSTLY CLOSED (§121) — all three pair classes are instrumented; what remains is the triage the scoped gate reports

> **PRIORITISED by the owner (2026-08-12), on the evidence below.** §107 spent
> a whole landing inside this blind spot and hit it three separate times in one
> mechanism: a pallet blade floating 0.236 from the arm that carries it; both
> arms running 0.51–0.59 INSIDE the saw's tip circle, which is a collision, not
> a gap; and — after §107 lengthened the arms to fix the first — 0.665, i.e.
> the repair made the invisible defect worse and nothing said a word. Every one
> of those was a mover-vs-mover pair inside one unit. The arm-through-wheel foul
> was found by the OWNER LOOKING AT A SCREENSHOT, after 19 green gates; it only
> became gateable because §107 promoted the anchor to its own unit, at which
> point `expectedContacts` failed on it immediately and correctly. The interim
> instruments (`intraUnit`, and §107's `assembly`) each cover one slice; the
> item itself — all pairs inside a unit, over the pose net — is what would have
> caught all three at the build that introduced them.


Every check in `src/inspect.js` is a relation between two DIFFERENT
units. The sweep enumerates `for (let bi = ai + 1; …)` over the ~31
`registerLabel` names (~1229), and `CLEARANCE_BUDGETS`,
`PENETRATION_BUDGETS`, `EXPECTED_PAIRS`, `IGNORED_PAIRS` and every
`MECH_GRAPH` edge are keyed on PAIRS OF UNIT NAMES. The model is a
graph whose nodes are units, and the inside of a node is a black box.
A unit's own parts may interpenetrate arbitrarily and every sweep
still reports clean.

**This is not a forgotten pair — the grouping is the cause.** Units
were drawn to match the mechanical graph, so a unit usually bundles a
FIXED mount together with the thing that MOVES on it. That is exactly
the pair most likely to foul, because each moving part was solved
against its neighbours (the constraint the layout cared about) and
never against its own bracket. The broad phase hides it a second time:
a unit's AABB contains all of its own children, so there is no signal
at any stage.

**Confirmed instance (since REPAIRED — the gap that hid it is not).**
The 'Stop lever' bracket post stood on the hinge axis at the unit's
local origin with the crank hanging from the same origin straight down
through it: penetration 0.685 at full hack against a `CLEAR_MARGIN` of
0.15, present at every pose, and FIVE distinct overlapping pairs once
measured on a dense surface lattice rather than by axis stations (tail
bar, drop leg, pad arm and rod pin against the post; drop leg against
a clevis cheek at a constant 0.157). Every battery run in the
project's history was consistent with all five. The unit now solves
its bracket around the built crank's swept envelope and carries its
own build-time assert — but that assert is bespoke to this one unit,
which is the point: the next instance still has nothing watching it.
Candidates to check by
the same reasoning — any unit holding both a fixture and a mover:
Reset hammer (arbor foot vs hammer), Set-up work (ratchet vs click),
Maintaining detent (cock post vs arm), Minute jumper (pivot stud and
return spring vs lever), Keyless works (bushing foot vs the sliding
gang), Power-reserve train.

**Second confirmed instance (since REPAIRED) — and it breaks the
interim below.** The pallet fork's ruby stone sits in a slot broached
through its arm block, with a hand-set `gGap = 0.05` seat gap. The
arm's own extrude bevel is `t * 0.08` = 0.096 at `FORK_T = 1.2`, and a
bevel grows the outline along its outward normal — which, inside a
notch, points INTO the slot. So each wall stood 0.046 inside the ruby
it was holding. Found by drawing the fork ALONE in
`test-geometry.html`, where it showed as z-fighting on the stone's
face; unreadable in the movement at the Escapement framing, and
invisible to every battery run ever made. Repaired by DERIVING the gap
from the bevel (`gGap = armBevel + SEAT_SHOW`) rather than guessing
against it — a stronger guard than an assert, because the two can no
longer be edited apart. Same arithmetic as §34's alarm setting wheel
(0.05 gap vs 0.045 of bevel): twice now, so it is a CLASS — **any
extruded shape with a notch, whose bevel is not checked against what
sits in the notch.** MODELING.md rule 1 covers face-to-face growth; it
does not yet say this about notches.

Note what this instance does to the interim proposed below: the stone
and the arm block are BOTH fixtures — neither moves relative to the
other at any pose — so a mover-vs-fixture split would never have
looked at this pair. The interim is still worth building, but it is
not sufficient, and a bevel-vs-neighbour check is a separate, cheaper
idea that would have caught both this and §34's.

**Why it cannot simply be switched on.** Inside a unit, parts are
SUPPOSED to touch — a pivot in its bearing, a wheel on its arbor, a
screw in its seat. A naive intra-unit sweep would light up with
intended contact, and the EXPECTED/budget vocabulary that tames the
inter-unit sweep does not exist at part granularity: only 12 objects
in `main.js` carry a `.name` at all. That naming is the same missing
infrastructure a drill-down exploded view would have to build, so the
two should land together or at least share the vocabulary.

**Cheap interim that would have caught this one.** Do not name
anything — DERIVE the split. For each unit, pose the existing sweep
axes and diff each child's `matrixWorld` across the poses: children
that never move are the unit's fixtures, children that move are its
movers. Check movers against fixtures only. Intended contact between
those two sets is rare (a pivot's bearing surfaces are the main case),
so the budget list stays short, and no part needs a name for the check
to run. Report violations as `Unit/child` pairs.

**Status 2026-08-01 — the interim is BUILT** (`intraUnit` in
`src/inspect.js`, report-only). It derives the split exactly as above:
each child's unit-relative matrix is signatured across 40 poses (5
samples × every battery axis), children whose signature changes are
movers, the rest fixtures; mover×fixture pairs get an AABB gate then
the honest boolean (the arbitrated `meshesIntersect`, so tri-tri lies
don't fabricate findings). The full run flags 54 raw rows; triage
sorted them into `INTRA_UNIT_CONTACTS` (44 declared joints — wheels
seated on their arbors, pivots on their studs, the mainspring's hook
and ribbon anchors, spring bites, blade anchors — each row carrying
*why* the contact is a joint) and 11 real findings, waived: 2 citing
item 22 (the alarm pusher's bar in its own column wheel's disc band)
and 9 citing item 23 (bearing-cock arms modeled solid to the axis
they carry — a CLASS the first run surfaced at two stations; since
CLOSED — those 9 rows are repaired and their waivers deleted, so the
table now carries item 22's two rows only).
Runtime ~2.8 s, so it can gate. Two footnotes from the triage: one
keyless row (`ExtrudeGeometry#43 ⇄ CylinderGeometry#39`) sits at the
arbiter's d≈1e-4 boundary and flips run-to-run — declared, since the
joint is real at either reading; and parity containment is undefined
against zero-volume open sheets (the dial face), where only the
crossing itself is meaningful. What the interim still cannot see is
exactly what this entry predicted: fixture-vs-fixture pairs (the
ruby-in-slot instance above), and mover-vs-mover within one unit. The
naming infrastructure and the bevel-vs-neighbour check remain open;
this entry stays open at reduced scope until they exist.

**Status 2026-08-14 (§121) — the two missing tiers are BUILT, and the item is
MOSTLY CLOSED.** `checkIntraUnit` now measures all three derived pair classes:

- **FF (fixture × fixture), once** — fixtures cannot move relative to their
  unit by the classification's own definition, so one pose is the whole
  answer, which is what keeps the Dial's C(147,2) pairs affordable. This is
  the tier the ruby-in-slot instance above needed: both meshes static, so the
  mover/fixture split never compared them.
- **MM (mover × mover), across rigid frames only** — same-frame movers are
  one part (`assembly`'s connectivity domain, §107), so the tier clusters
  each unit's movers by the SAME world-motion-delta signature `assembly`
  uses (`sameFrame`, hoisted to module scope — one predicate, two consumers)
  and compares only across frames. A MORPH is always its own frame: two
  matrix-still morphs would otherwise merge and drop out of comparison —
  MODELING.md rule 6's silent-exclusion class, pre-empted rather than hit.
  §107's arm-through-saw was exactly a cross-frame pair.
- **And the declared table grew a spine**: a `INTRA_UNIT_CONTACTS` or
  `INTRA_UNIT_WAIVERS` row whose unit or labels match NOTHING is now a gated
  failure (`unmatchedSelectors`, `expectedContacts`' convention) — the
  MODELING.md rule 7 class (a welded geometry changing type un-declared 14
  joints in silence) fails loudly instead of vanishing. A NEAREST-UNIT
  dedupe routes each pair to the smallest unit containing both meshes, so
  nested labels (the Dial holds the whole alarm-disc stack) stop demanding
  two declarations for one fact.

The first sweep found **259 rows across 46 unit×tier buckets** — quadruple
the 2026-08-01 session, far past what one landing can triage row by row — so
the gate is SCOPED, §107's own precedent: `INTRA_TIER_SCOPE` (the alarm
complex, where this class bit three times) had its **42 rows triaged against
measured containment depths** (`tools/probe-121-depth.mjs`, the check's own
parity — every declared why cites a reading, not an impression; **zero were
defects**, all joints or working contacts), and the **202 rows elsewhere are
REPORTED in the payload, untriaged**. MF still gates every unit — nothing
that was gated became ungated.

**What keeps this MOSTLY closed, named:** (1) the out-of-scope triage — 202
reported rows (Balance's 23 screw seats, the plates' furniture, Keyless'
sliding gang…) each wanting a declared why or a repair, widening
`INTRA_TIER_SCOPE` as they land; (2) the naming sub-idea advanced but did not
finish — §121 named the meshes it could reach in one edit (`alarmGongArc`,
`alarmGongPost`, `alarmClimbPinion`, `alarmSetIdler`) and declared the rest by
`Type#index`, which the new selector gate at least converts from silent
fragility to a red gate; (3) transients between pose samples, item 7 as
always; (4) same-frame mover splits outside `ASSEMBLY_SCOPE`, §107's own
filed widening. The bevel-vs-notch sub-idea CLOSES: the FF tier measures the
class, and MODELING.md rule 1 now carries the inward sentence with the
derivation (`gGap = armBevel + SEAT_SHOW`) as the stronger guard.

## 6. MOSTLY CLOSED — `EXPECTED_CONTACT_FLOORS` names the contact; the instance became item 21

Item 5's blind spot has a sibling. Once two units appear in
`EXPECTED_PAIRS`, **every** overlap between them anywhere in the
movement is classified EXPECTED — not just the contact the entry was
written for. One declared mesh grants the whole pair blanket immunity.

**Confirmed instance: the minute star and the hour wheel's tube.**
`['Hour wheel', 'Motion works']` is EXPECTED because of the minute
pinion ⇄ hour wheel mesh — the second half of the 12:1
(`inspect.js` ~28). But the §1 minute star is also a `Motion works`
mesh, and it passes the hour wheel's tube (a `LatheGeometry` sleeve,
r 2.05 → 2.5, half-height 2.75) with a measured minimum clearance of:

| pose | star ⇄ tube |
|---|---|
| crown in (running) | **0.0127** |
| crown out (setting) | **0.0084** |

Swept over a full star pitch (one minute-hand minute) against all 4,356
star vertices. Not interpenetrating — but `CLEAR_MARGIN` is **0.15**,
so these are roughly **a twelfth of the margin**, in a place where
nothing declared they should be close at all. There is also NO entry
for this pair in `CLEARANCE_BUDGETS`, so no floor is asserted anywhere.
It is two hundredths of a unit from being a real collision, and nothing
in the battery would report it if it crossed.

**CORRECTED 2026-08-01 — it had already crossed, and this measurement
could not see it.** The vertex-based sweep above reports the closest
NON-CONTACT vertex; a tooth flank that passes through the tube's wall
leaves its tip vertex in the bore's open air, where its distance to the
surface it crossed between samples is POSITIVE. Measured with a
containment test (vertex + edge-midpoint samples, parity raycast): the
star has **304 vertices inside the tube's wall band, 0.225 deep**, and
the minute wheel 264 at 0.224 — a standing collision at every pose,
now filed with its numbers as **item 21**. The per-contact floors check
(this item's structural fix, `EXPECTED_CONTACT_FLOORS` in inspect.js)
carries the pair as a red row waived under that item.

**Fix, in two parts.** The instance: re-solve the star's root diameter
or the tube's outer radius so the gap is a derived margin rather than
an accident — the star's tooth depth already derives from its pitch
(PR #33), so this is the same solve extended to the sleeve. The
structural half: EXPECTED should name the CONTACT, not just the pair —
either a region/part qualifier, or a paired `CLEARANCE_BUDGETS` floor
that says "these two units may touch HERE, and must keep the margin
everywhere else." The second form is cheaper and uses machinery that
already exists.

**Status 2026-08-01 — the structural half SHIPPED.**
`EXPECTED_CONTACT_FLOORS` + `checkExpectedContacts` (inspect.js): each
row names an EXPECTED pair's declared touching mesh pairs (each citing
the instrument that owns that contact), excludes exactly those from a
clearance sweep, and holds everything else between the two units to the
margin. Report-first per §50's arc; waivers carry citations. Seeded
with the three highest-value pairs (the four-defect Alarm disc ⇄ Hour
wheel blanket, this item's instance pair, §45's sleeve pair). Its FIRST
RUN found: the §34 index line at its declared 0.13 (now a cited
contact), and the standing star/wheel ⇄ tube collision above (item 21).
Remaining scope: rows accrete like budgets — new EXPECTED pairs should
land with a floors row; gate once item 21 clears the last red.

**Second confirmed catch, 2026-08-13 (§112's band swap).** The
`Alarm barrel ⇄ Alarm striking wheel` blanket (granted for the barrel
wall ⇄ strike pinion mesh) hid the barrel ARBOR standing straight
through the 64T governor wheel's web — a full column at CD 8.25 inside
a wheel reaching 9.97, every band, every pose, found only by measuring
the wheel's radial occupancy by hand. Fixed at the root (the governor
mesh wears its own derived 0.22 module and the wheel underreaches the
arbor, asserted at its build), but the pair still has NO floors row —
the excuse that hid it is intact for whatever moves next between these
two units.

---

## 7. The battery samples poses — it cannot bound them

§35's build surfaced two more blindness classes, siblings of items 5
and 6. Both are SAMPLING failures: the battery proves "no collision at
the poses we visited," never "no collision anywhere in the range."

- **Thin features slip between samples.** The fusee chain threads
  between 5-ray probe bundles spaced 0.27 apart, and a wheel spoke
  ~1.5° wide can pass between a slow axis's 60 samples. §35 caught the
  chain only because a boolean BVH test happened to land on a hit
  fraction; the corridor had already passed the bundles.
- **A part's sweep exists only while its axis is being swept.** Every
  §35 corridor probe at the rest pose saw the chain parked and clean;
  the reserve axis owns its whole drum→fusee fan. Any probe run at ONE
  pose silently assumes every other axis is at rest.

The sharpest instance closed the loop on itself: the §35 rod first
measured "0.162 clear at 500 poses" — and every one of those poses,
like every battery axis, left hand-set rotation (setPathRot) at zero.
The minute wheel spins under that input, and its spokes swept through
the rod over ~24% of a revolution. The battery now has a handSet
axis and each check run starts from resetInputs(); the rod was
re-sited outside the wheel's whole tip circle. The general lesson
stands: "how close does this pair ever get, over all inputs" should
be a cheap, queryable fact, not a matter of which sweep someone
thought to run.

The structural fix is a SWEPT-VOLUME registry (filed in the roadmap):
per moving part, a conservative hull of its full pose range —
exact surfaces of revolution for rotors (which rightly fill spoke
gaps: never thread a corridor between the spokes of a turning wheel),
arc wedges for levers, the fan for the chain.
`LOW_LINKAGE_OBSTACLES` is this idea, done by hand, in 2D, for one
linkage; it wants generalising into the battery so pair checks become
pose-independent volume tests that cannot under-sample.

**Stale-note 2026-08-01: that registry has since SHIPPED** — §36
(`buildSweptRegistry`: exact annulus sectors for revolvers, per-pose
bound unions flagged approx for the rest) and the `sweptOverlap` gate
built on it (§36 job B, with pose-confirmation so hull contact must be
reproduced at a real pose before it counts). The two sampling classes
this entry names are therefore covered for pair overlap; what remains
open here is the narrower residue — the approx tier is a bounds union,
not a hull, and probe-style questions (ray bundles, corridor fits)
still sample unless they are rewritten against the registry.

## 9. CLOSED — `ALARM_LINK_ROD_SEAT` was measured, not derived; both retired

**Closed 2026-07-29, by TODO 20's registration solve.** The entry's open
question — "why is the lift not one travel" — is answered: the two crank
contacts have DIFFERENT effective radii, so the rod's travel is not the
ring's travel and never was; forcing both to 0.19 is exactly what held
the 0.07/0.039 gaps open, and why closing one end opened the other.
`ALARM_LINK_ROD_SEAT` and the `ALARM_LINK_ROD_FOOT` chain built on it
are deleted. The rim finger now presses with its TIP at a designed rest
angle (60° off its zenith, corridor side), the rod's foot is read off
that built contact, its top off the tail's underside, and the shaft's
roll is solved from the foot per tick. Measured after: **+0.022
disarmed / −0.014 armed** — the hand-off touches at both extremes for
the first time, and its `alarmHandoffs` row is UNWAIVED.

The original filing follows, kept for the record:

### (original text)

The alarm selector rod's foot is derived from the crank arm's own top
face (`ALARM_LINK_CRANK_OFF + ALARM_LINK_CRANK_T / 2`) minus one
`ALARM_SEL_TRAVEL` — the reasoning being that the tick lifts the rod by
exactly one travel at rest, so building it one travel low puts the foot
on the arm when disarmed and drives it down with the arm as it arms.

That reasoning is wrong by 0.079, and `ALARM_LINK_ROD_SEAT = 0.079` is
the leftover, read off the model and pasted back in. It is standing rule
1's exact failure case: a number that is there because it made the
picture right. It is commented as MEASURED so it cannot be mistaken for
a constraint, but the comment is a confession, not a fix.

**What is actually unknown**: why the lift is not one travel. The tick
sets `shaft.rotation.x = ALARM_LINK_CRANK_PHASE - (ALARM_SEL_TRAVEL /
0.35) * alarmSelShownT`, so the arm's contact point moves
`r·sin(travel/0.35)` while the rod moves `travel`. Those agree only at
`r = travel / sin(travel / 0.35) = 0.368`; the arm is built with its top
face at 0.28, a ~16% shortfall. The residual is the tracking error, and
the two extremes therefore cannot both be zero — which is why closing
one end opened the other.

**What was tried and did not work**: setting the arm's radius to 0.368
so the contact tracks 1:1. Measured, that made it WORSE — the spread
between the disarmed and armed gaps went from 0.031 to 0.077. So the
0.35 in the tick's divisor, or the assumption that `alarmSelShownT` runs
the full 0→1, is also not what it appears to be. That is the thread to
pull, and it should be pulled before the radius is touched again.

Until then the residual is carried at the REST end on purpose: slack
there shows as a gap, slack at the armed end would be penetration.

Measured on the current build: 0.07 disarmed, 0.039 armed, no
penetration. Note the battery cannot see any of this — every part
involved belongs to the `Alarm link` unit, which is item 5.

## 10. CLOSED — the 0.1500 is the released beak over the star, and the instrument now names surfaces

The pair is the tightest in the battery: **min 0.1500, required 0.15**.
`measureClearance` rounds to 4 decimals (neighbouring pairs report
0.2489, 0.1908), so that is the true value, not display rounding.

Three facts, all verified:

- The tight plane is **intentional**. The keyless/motion/reserve stacks
  leave no clear corridor along the post→tail-pin span, so the lifter
  plane is solved to bind on the margin:
  `Z_JMP_LIFTER = Z_DIAL + CLEAR_MARGIN + JMP_BIND_EPS + JMP_LIFTER_T/2`.
- `required: 0.15` is not the generic `CLEAR_MARGIN` falling through —
  it is an explicit per-pair budget row in `inspect.js`
  (`{ a: 'Minute jumper', b: 'Dial', min: 0.15, axes: [...] }`).
- The minute star is collected into **both** `Dial` and `Motion works`
  (confirmed by walking mesh ancestors against `labelEntries`). This is
  already known and handled: `['Minute jumper', 'Dial']` is in
  `EXPECTED_PAIRS` and its comment says so in as many words.

**The open question.** `JMP_BIND_EPS = 0.01` exists so a solved-to-bind
plane cannot flicker into a false violation on a float hair. If it
reached the measured contact this pair would read 0.16. It reads
0.1500. So either:

1. the binding contact is **not** the lifter bar's dial-side face — most
   likely the beak seated in the star, which is an INTENDED contact and
   would make 0.15 a seat depth rather than a clearance, leaving the
   epsilon correct but irrelevant to this number; or
2. the epsilon is lost between the derivation and the mesh.

Under (1) there is no defect here at all, only a misleading row. Under
(2) the guard does not guard. **These have not been distinguished**, and
the difference decides whether this entry is a bug or a documentation
fix.

**What settles it**: the identity of the closest mesh pair at
`beat f=0`. Three attempts failed, recorded so they are not repeated:

- World-AABB nearest-pair — returns 0 for any two overlapping boxes.
  A beak sitting near a star tooth overlaps in AABB with a real gap
  between the surfaces. This is the same error that once reported the
  alarm hand 0.32 from the markers when the true vertex radius was 0.96.
- `three-mesh-bvh` `closestPointToGeometry` driven by hand — returned
  distance 0 for every pair including obviously distant ones, so the
  call or the geometry-to-BVH matrix was wrong.
- `inspect.js` does not export `collectUnits`, and `measureClearance`
  returns only `{min, at}` — the battery knows the answer internally and
  does not surface it.

The cheap fix is to make the battery report it: have `measureClearance`
carry the mesh names of the minimum through to its result. That is
useful well beyond this row — every tight pair in the report currently
names two UNITS and leaves the actual surfaces to guesswork.

Found while verifying §35; pre-existing and unrelated to that branch.

**Status 2026-08-01 — CLOSED, both halves.** The cheap fix landed:
`unitClearance` always knew the minimum's mesh pair and `sweepClearances`
dropped it; the sweep state now carries it, `measureClearance` returns
`meshes`, and every `checkClearances` row names its surfaces (unnamed
meshes report as `GeometryType#index` within the unit). Run against this
row, the answer is **hypothesis (1), no defect**: within the budget's
axes the minimum is `jumperBeak ⇄ star` (the star's body reached through
the Dial nesting), at beat f=0 — the RELEASED beak over the star's
teeth. That clearance is its own solve (`JMP_LIFT_ROT`: retreat until
the beak's whole outline clears `STAR_R + CLEAR_MARGIN + JMP_BIND_EPS`),
and the measured 0.1500 is that 0.16 minus ~0.01 of tessellation sag on
the star's fine tooth tips — the same sag class HANDOFF_TRACK_TOL
exists for. The epsilon plane (`Z_JMP_LIFTER`, the lifter bar against
the dial face) is NOT the closest pair, so `JMP_BIND_EPS` guards
exactly what it was built to guard and this row was only ever
mislabelled in the report, never wrong in the geometry.

## 11. The alarm work is built at quarter-to-half-scale stock

§50's floor found it and the census had already predicted it: **every
alarm unit carries stock at 0.015–0.10 mm against the 0.12 mm wheel
floor** — the feeler spring at 0.015 (HALF the cited real-spring floor
of 0.03), the disc's selector fingers at 0.0187, the selector ring and
face cam at 0.0375, the column wheel at 0.0825, ~50 meshes in all
across fourteen units (including the alarm heart riding the Hour wheel).

**The bound, CORRECTED by probe (tranche one).** The original claim —
"§29 bought the z corridor with thickness" — was granted per part
wholesale and overclaimed: the alarm work splits by z into

- **plate-top rows (z 8.8–10.8), NOT corridor-bound**: the switch, the
  lock, the striking wheel's furniture, the barrel's ratchet, and the
  link's plate-top half sit in open air above the 3/4 plate.
  **Tranche one closed four of them** (the §35 beak bar and tail to
  floor stock in BOTH free dimensions — the first pass thickened z only
  and the census promptly made width the new thin dimension — and the
  lock lever's arm and tail), floored the shared barrel ratchet, and
  declared the integral click pawl the spring-tempered stock it is.
  **Tranche two** took the switch's click arm to the floor and honestly
  kinded two more: the switch detent's blade is spring stock (at
  0.026 mm it stays in the debt even so), and the follower's ruby nose
  is a pin — its 0.24 u height §29-bound co-planar with the heart, so
  declared, not thickened. **The plate-top tail closed** (three more rows): the column wheel's
  base plate and ratchet skirt took the floor — the probe showed the
  "mate-bound wedges" were never the thin rows; the castellations are
  0.55 and fine, and the stack grew with indexing verified unchanged at
  −30°/press — and the lock collar's sandwich took +0.02 after all
  (0.16 over the plate, 0.21 under the cam, both clearing the margin).
  Still open on the plate top: the lock pad (a solved brake mate
  against the collar) and **the winding pair, now identified**: not
  bevels and not a ruler artifact — two BUSHES with genuine 0.1125 mm
  walls (registry rings, rLo > 0), real thin stock wanting ordinary
  ring thickening. The identification came via a census ruler FIX: a
  solid revolve's rBand width equals its radius — half the true
  diameter — and correcting that (rLo ≈ 0 is the tell) cleared two
  genuine artifacts elsewhere (Balance's and Small seconds' 0.1125
  rows were solid posts at half-size) while the winding pair survived,
  proving them rings. The Motion-works and Power-reserve 0.1125 rows
  survived too: same class, real ring hubs.
- **dial-side strata rows (z −5 to −7), genuinely §29-bound** (~50):
  disc, selector, feeler, setting wheel, idler, release disc, arbor,
  the link's crank half, the heart. These are the real re-buy-z design
  task. **§51's strata spends (the finale) closed the feeler slices, both
hearts and the feeler spring** — the spring at real spring stock at
last (0.08 u = 0.03 mm, from the 0.015 that made it §40's first
nominee). **Two members are BLOCKED and reverted with their numbers:**
the disc body (0.13) collides with the selector guide posts at 0.32
(measured 0.246 against the 0.12 working budget — the §34 pass-2b post
corridors were solved for a 0.13 body), and the selector sheet (0.10)
cannot take 0.32 in its two-sided finger slot (0.192–0.246 in every
anchoring — the excess just moves between finger sides). **The enabling step is DONE**: the §29 arm-band literals (−0.505,
−0.53, −0.48, −0.23) are re-derived from the wheel's plate-side face
(`ALARM_WHEEL_BOT_B` → `ALARM_BAND_FLOOR_B` → `ALARM_ARMB_Z`), the §34
cam-band assert derives with them, and the disc ⇄ selector working
engagement measured **0.062 against its 0.12 budget** after the change
— the derivation healed the drift the frozen family had accumulated.
**And with the family derived, both blocked spends LANDED** (disc body
and selector sheet at floor stock; TODO 11 waived 60 → 53). The two
keys, each a working-face rule: the ring's anchor pins its UNDERSIDE
(the face that presses the rocker — the endstone precedent, stock grows
away from the solved contact), and the §35 shaft rides the ring's
MID-plane, not its top face (the top-face relationship was an artifact
of the thin sheet; centre-on-centre cleared the keyless floor by 0.229
where top-face left 0.069, and the floor's own derived tripwire is what
said so).

**Tranche three named and declared the selector's three guide posts**
  (pin stock at 0.105 mm, clearing the pivot floor — zero geometry
  moved). Remaining honest-pin candidates: the disc's unnamed 0.22 u
  pin. The strata sheets (selector ring/tab at 0.0375 u, the disc
  fingers, the face cam) are the re-buy-z core.

**Tranche four bought the two sub-floor springs** — the last rows that
  were under the floor *for their own declared kind*. Both are flat
  blades (a feeler return, a click detent), and the spring floor's own
  basis says why 0.03 mm was never their target: "real hairsprings run
  0.02–0.04 mm; **flat springs thicker**". They are now sized at
  `SPRING_FLAT_U` = 0.05 mm, the low end of real flat-spring stock, so
  they clear on merit rather than grazing the line. Waived rows 59 → 57.

  The feeler blade is the instructive one: §51 had already tried to buy
  it, raising its **z** 0.04 → 0.08, and the row survived — because its
  thin axis was **y** at 0.06. Thickening a dimension that was not the
  thinnest changes nothing the census measures. Both flexing dimensions
  now carry the stock.

**Tranche five re-derived the 0.3 family — 16 rows closed** (13 of this
  item's, 3 of TODO 12's in passing): waived 64 → 48, this item 56 → 43.
  Not one of them was the re-buy-z design task. 0.3 u is 0.1137 mm — 95%
  of the wheel floor — and it is what gets typed where a thickness was
  never derived; the rest were parts being judged as WHEELS for want of a
  name.

  - **The 0.3 literal, four sites.** The setting arbor's bearing cock
    (`COCK_T`, and its `BUSH_Z` re-solves with it rather than drifting —
    the bush drops 0.008 and spends its 1.38 of air over the setting
    pinion down to 1.37). The lock PAD, now the same `STOCK_MIN_U` as
    `alarmLockCollar`, so the pad and the band it brakes are one z-band by
    construction instead of two numbers that happened to be close. The
    selector's fork-bracket bar — its **width**; its thickness was already
    `ALARM_SEL_T`, tranche four's lesson arriving a second time. And the
    disc's friction hub, whose wall was the gap between two radii
    (`0.35 − 0.05`) and is now written `bore + STOCK_MIN_U`, so the wall
    reads as the thing being sized.
  - **`makeGear`'s hub wall — one derivation, five rows.** `hubR =
    boreR * 1.6` is a proportion, and a proportion of a small bore is a
    thin ring: at the boreR 0.5 that both alarm winding idlers, the
    motion-works minute wheel and both power-reserve wheels are cut with,
    the wall came out 0.30 u. The proportion stays — it is what makes a
    hub look pared rather than sized — with the floor under it as a third
    term: `max(boreR * 1.6, boreR + STOCK_MIN_U, pitchR * 0.085)`. A ring
    around a bore is a member, so its wall answers to the floor and not to
    whatever fraction of the bore it happened to be.
  - **Round bars measured across their FLATS, three sites.** The census
    reads the TESSELLATED stock, and that is a deliberate reading rather
    than a ruler bug — the n-gon is what every other instrument collides
    against too. A 10-gon bar's box is `2·r·cos(π/10)`, 4.9% under its
    nominal diameter, so a nominal ⌀ 0.121 mm post measures 0.1153 and
    lands in the debt. §45's `ALARM_A_PIN_R` was already derived this way
    and wrote the rule out longhand as a literal 0.0924; this tranche
    named the derivation `flatsR(thicknessU, segments)` in `layout.js`,
    put `PIVOT_MIN_U` and `STOCK_MIN_R10` beside it, re-expressed
    `ALARM_A_PIN_R` through it, and re-cut the three bars that were under:
    the link's beak post, the pusher's riser (whose reach bar stations off
    the riser's diameter and moved with it), and the follower's pin boss —
    whose HEIGHT was already floor stock, tranche four's lesson a third
    time.
  - **Three parts kinded, not thickened**, each measured first: the lock
    beak's riser (⌀ 0.1061 mm on its flats, over the pivot floor — the
    `alarmSelPost` precedent), the follower spring's grounded stud
    (⌀ 0.1137, `alarmHammerSpringStud`'s twin), and the striking arbor's
    sleeve, whose row was never a section at all. The census is per mesh
    and does not subdivide an arbor, so a shaft drawn as cam + sleeve +
    pinion reports the sleeve's 0.3 u STEP LENGTH between two derived
    stations. The stock there is the shaft: ⌀ 0.57 mm.

  **And the census now says WHERE.** Its header claimed an unnamed row
  "is identified by its unit and dimensions", and it is not — a unit is a
  subtree of dozens of meshes and a bounding box is three numbers that
  appear nowhere in the source. This item has paid that toll every
  tranche (three identification probes for two winding-train posts is in
  the record above), and 26 of the 56 rows it was carrying were
  anonymous. Every census row — and every waived row in
  `checkStockFloor`, which is where the triage actually happens — now
  carries `where`: the geometry's constructor call with its numeric
  parameters, plus the mesh's local position.
  `CylinderGeometry(radiusTop 0.16, …) at local 0, 0, 0` is greppable;
  "thin 0.1153 mm somewhere in Alarm link" is not. Naming a mesh is still
  better and the tranche named the nine it touched, but the report no
  longer depends on someone having done so.

  **What naming COSTS, since the tranche paid it.** An index label is what
  a mesh gets for having none, so NAMING one moves its label and stales
  every string-coupled row that referenced it. `intraUnit` failed on
  exactly three declared joints — the strike sleeve on its arbor, and the
  beak lever and its tail on the beak post — and it is the check that
  catches this class. Two things make it survivable and are worth knowing
  before the next naming pass: `meshLabel`'s index is
  `unit.meshes.indexOf`, over the WHOLE unit, so no OTHER row renumbers;
  and the failure is loud rather than silent, because a stale declaration
  stops excusing a real intersection instead of quietly excusing the wrong
  one. Naming also let one of those rows say what it is — it had been
  recorded as "collar pressed on the strike arbor", and the collar is a
  separate row.

  **The one thing tranche five found and did NOT fix: a BUSH reads as its
  outer diameter.** For a `static` or `path` part the census's ruler is
  the geometry-local BOX, and a ring's box is its OUTER extent — so a
  bush's wall, the one dimension that is actually stock, is invisible.
  `revolve`-kind parts do not have this problem: the registry measures
  their r-band and reports walls correctly, which is how the winding
  idlers' hubs above were caught at all.
  Measured, on the alarm link's two shaft bushes: `ringGeo(0.14, 0.26,
  0.3)` under a comment reading "the wall is stock-floor so the bush is
  itself a real part". That wall is 0.12 **units** — **0.0455 mm**, and
  `STOCK_MIN_U` is **0.3167 u**. The comment read the floor's 0.12 as
  units when it is millimetres, and nothing could catch it: the two rows
  report at 0.1137 mm (their HEIGHT), so the debt list understates them by
  2.5×. `ringGeo(0.5, 0.62, …)` on the setting idler's sleeve is the same
  class, at the same 0.12 u wall.
  This is filed rather than fixed because the fix is two separable pieces
  and only one of them is cheap. The RULER — measuring a static revolve's
  wall the way the registry already measures a rotating one's — can only
  make rows thinner, so it may open unwaived violations in units that
  carry no waiver today; that blast radius wants measuring before it
  lands, not after. The PARTS then want real walls: bore + `STOCK_MIN_U`
  takes the link's bushes from ⌀ 0.52 to ⌀ 0.91 u, which is a P3 packaging
  question in the dial-side strata, not a one-line edit.

Waived in `checkStockFloor` as accepted debt citing this item; the
waiver keeps every row visible in the report. Closing this item means
the alarm units clear their floors and their waivers are DELETED.


**The switch's real-scale layout, MEASURED 2026-08-02 — two walls, not
one.** The tranche's note said "move the station inboard (§33
machinery)"; the attempt was made and the measurement says the move is
§-scale, so the findings are filed instead of a half-fix:

1. **The tail's ray runs outboard.** The wheel stands on the lock
   tail's line (stand-off = tail + baseR + 0.3), and that line, from
   the pivot at the as-built 160° azimuth, POINTS AWAY from centre:
   the minimum reachable centre radius along it is 41.4 against a
   real-scale bound of 36.4 (plateR − margin − 1.12·baseR at
   baseR 5.7). No tail length fits; the pivot AZIMUTH (the 160°
   constant around the striking wheel) is the next legal knob.
2. **Every inboard azimuth hits the three-quarter plate.** The
   switch's stratum is collar-bound (ALARM_LOCK_Z 8.83 — the pad must
   press the strike collar's band), which hangs the wheel's ratchet
   skirt at z ≈ 8.4..8.7: below the plate's top face. That only
   works at the RIM, where the plate has ended — swept 0..360° at
   2° steps, every radius-viable station overlaps plate matter.
   Real scale therefore needs the §51 precedent: raise the wheel on
   its own bridge above the plate + margin, and REDESIGN how the
   lock tail reads it (the collar-bound lever cannot follow the
   wheel up) — which is also the honest fix for item 24 below.

**Both walls are DOWN — §68 landed (BUILT §68).** The pivot azimuth
re-derived 160° → 24° from a scored sweep; the wheel rose onto its
lengthened stud above the plate top (`ALARM_COL_RAISE`, asserted at
boot) with every rider's z-station riding the same constant; the
wheel now stands at Ø 4.32 mm (`ALARM_COL_BASE_R` 5.7) with the
TODO 24 handoff row green at both parities. The §35 rod re-sited
with it — diametrically opposite the lock beak, three whole pitches,
parity by construction — and the beak tail collapsed ~28 → 4.0
(~3:1), retiring §35's 36.5× displacement gain. What remains of this
item is the STOCK debt above (the waived rows), not scale.

## 24. CLOSED — the lock beak is matter now, and a handoff row measures it

Found by the TODO 11 layout measurement. The §25 D story is "beak on
a COLUMN → the tail is blocked"; the built tail's z band is
8.68..8.98 and the castellation ring's is 9.33..10.13 — THEY NEVER
OVERLAP. What the tail's end actually stands beside is the wheel's
smooth BASE DISC rim (8.7..9.25), which has no castellations and
gates nothing radially. The tick's `colBlock` law grants the block;
no geometry backs it, and no `alarmHandoffs` row measures it — the
lock side of the switch has the §35-class gap (a hand-off that never
touches) that TODO 20 closed for the LINK side.

Fix path: give the tail a raised BEAK NOSE whose z is derived into
the castellation band (the §35 link beak's `ALARM_COL_TOP_Z`
convention, already parameterized over the wheel's feature heights),
size the nose to the column/gap sector, and add the
`lock beak ⇄ castellations` row to `ALARM_HANDOFFS` with
expect contact-on-column / free-in-gap parity — the same shape as
the link beak's row. Closing item 11's layout § would rework this
joint anyway; whichever lands first carries it.

**Closed 2026-08-02, exactly along that path.** The nose rises off
the tail's end into the castellation band (mid-band, clear of the
base disc below and the tier's top), and its inward face lands on
the column's outer wall by the stand-off's own arithmetic —
face reach = stand-off − baseR = 2.3, R-independent. Width 0.5
against a 1.31 gap arc minus the lift's 0.20 tangential swing. The
new `alarmHandoffs` row 'column outer face ⇄ lock beak' expects
contact disarmed / free armed and measures green at both parities;
the two Alarm-lock joint rows in `INTRA_UNIT_CONTACTS` re-pointed to
the post's shifted index (string coupling, as documented). The lock
side now has what TODO 20 won for the link side: no hand-off in the
switch chain is law-only.

## 12. The 0.05–0.12 band — first tranche closed; the remainder is catalogued per-row

**Tranche four (shipped): 4 more rows — 11 remain, all bound-or-band.**
The mainspring's coil and hook are now NAMED at build and declared the
spring stock they are (the drum clears). Hands became a cited kind
(`hand`, 0.10 mm — real blued-steel hands run 0.10–0.20) with the
sub-dial hand units declared; the counterweight cleared on the kind
alone, and the blades through the builder: the second-hand bur rod's
0.14 visibility floor is now DERIVED from the hand floor (rBase ≥ 0.18,
blade = 1.5·rBase = 0.101 mm), sub-dial hands riding it while the
central seconds clears on its own width untouched. An aesthetics-default
change was tried first and reverted — the builder floor was the real
lever, and defaults stay defaults.

**Tranche three (shipped): 2 more rows — 15 remain, both cocks fully
clear.** Two shared-builder finds: `makeCock`'s leg screw head (0.22 u —
the fork cock's row, and every cock leg with it) took the floor, and
`makeJewelSetting`'s stone went from `d·0.8` (0.269 u) to a floored
depth that stays inside its collar wall — clearing the balance cock's
last row and deepening the fork cock's setting with it. `makeChaton`'s
pressed ruby also grew 0.62·t → 0.74·t (its underside landing exactly
where the oil sink begins), improving the plate chatons toward real
0.3+ mm stones even though no census row named them.

**Tranche two (shipped): 4 more rows — 17 remain.** The set-up work's
two heads took the floor (the click-screw head through its bound
formula, which promptly taught JMP_BIND_EPS's lesson again: solved
exactly to the bind it failed the sweep by a float hair, and now
carries the one explicit centi-unit — it rides AT its derived bound,
0.21 u, improved but honestly still under the floor). The reset
hammer's pivot foot took the floor free-upward. Two more return
springs were declared as the spring stock they are (set-up click,
jumper click — the same blued-arc construction as the shock lyre).

**Tranche one (shipped): 9 of 30 rows.** The balance cock went 9 → 1:
foot screw heads, stud-carrier ring/arm/boss and the ruby endstone
thickened to `STOCK_MIN_U` (the endstone growing UPWARD so its solved
0.17 endshake is untouched, the lyre riding it), plus two honest kind
declarations — the gold shock lyre IS spring stock (0.0525 mm against
real shock springs at 0.05–0.10) and the stud side-pin IS pin stock. The
minute jumper's lifter bar took the floor with its bind formula
re-deriving the corridor plane: `Minute jumper ⇄ Dial` still measures
exactly 0.15 after the change, which is the formula doing its job.

**Remainder (21 rows), each with its bound named — do not bulk-edit:**

- **z-stack-bound**: the minute star (`STAR_T` is DERIVED as the
  motion-works gap minus two margins — thickening it means re-solving
  that stack), and the set-up work's `headT` (a `Math.min` against a
  derived under-wheel clearance).
- **mate-bound**: the jumper's beak and tail share `JMP_W` (0.264 u),
  which must enter the star's tooth valleys — widening it is a
  star-pitch question, not a literal.
- **radial-band rows** (census `registry-revolve` source): Escape
  wheel, Balance, Power-reserve train ×2 — the thin dimension is a
  radial band width, so the fix is a radius change with its own
  clearance chain, not a slab bump.
- **still-to-locate**: a fusee step disc (r 1.914, h 0.292 u, computed
  literal — probe with a deeper parent chain), and the small-seconds
  0.0918 row, which matches no local mesh extent and is a
  registry-revolve band width (the swinging hand's swept band).
- **at its bound**: the set-up click-screw head now rides its derived
  under-wheel ceiling (0.21 u) — thicker only if the great-wheel gap is
  re-solved.

Waivers stay per part while any row remains; closing a part's last row
deletes its waiver.

## Recently closed

- **The alarm could not ring under fast-forward** (was item 8). The whole
  trip — pin drop, release gate, `alarmReleased` — sat inside
  `if (!fastForward && syncPhase !== 'catchup')`, so with FF on the feeler
  was never evaluated and no alarm could fire. Measured before the fix:
  armed, wound, target 12:00, 30 sim-hours crossing the coincidence twice,
  `alarmPinDrop` never leaving 0. It mattered because FF is the ONLY
  control that reaches an alarm time — the time-scale slider spans
  0.001×..1× and cannot speed the movement up — so the one path a viewer
  takes to watch the alarm fire was the one path where it could not.

  Closed by suppressing CATCH-UP only. The two are different cases: a §9
  catch-up skips THROUGH the time it covers, while fast-forward travels TO
  the alarm deliberately. The gate's own rationale was about SOUND, and
  sound already has its own gate earlier in the tick, so the trip had been
  suppressed by a rule that was never about it. Two things came with it:
  FF now DROPS OUT at the release (the move the reserve already makes when
  it runs flat), and the ring HOLDS for that one tick — the release tick
  still carries the fast-forward `rawDt`, and ringing on it alone spent 87%
  of the alarm's power before the drop-out could take effect. Rings at tick
  164 after 11.06 sim-hours where it previously never rang.

  **The residual is a margin, and it is now instrumented rather than
  assumed.** The pin only bottoms across the notch's flat floor (~2.76 min
  of the 12 h disc) while an FF tick advances ~1.5 sim-min: 1.8×, and it
  SHRINKS with any change that narrows the notch. §38 proposes a 0.92 min
  window, at which a tick would step clean over and the alarm would
  silently not ring — the same symptom this item just closed, from a
  different cause. A step-over guard warns once if the coincidence is
  crossed in one tick without the pin bottoming, so §38 will hear about it
  rather than ship it. (The guard's first version fired on the first alarm
  anyone SET, because the crown moves the disc too; it now ignores ticks
  where `alarmSetRot` moved. Its SECOND blind spot surfaced 2026-07-29:
  the boot sync moves scripted mega-motion — the 'pull' phase jumps
  `crownRotation` to the wall clock in one assignment, and the catch-up
  advances minutes per tick — so the guard fired on a **virgin boot
  whenever the boot's wall-clock path happened to cross the default
  coincidence: a boot-silence gate that failed at some hours of the day
  and passed at others**, which is why CI never saw it (and why the first
  fix, gating only `'catchup'`, passed interactively and failed in CI the
  same afternoon — the crossing had moved phases). It now ignores
  fast-forward, EVERY active sync phase, and ticks where the TIME crown's
  `setPathRot` moved — quick-setting swings the hour phase under the disc,
  so a set-drag crossing is the user's hand there too, exactly the
  `alarmSetRot` case it already knew about.)

  Also surfaced while fixing it: the panel showed only the ROUNDED fire
  time under the label "Set for", which reads like the hand position. It
  now shows both — "Hand at" (continuous, since the friction coupling has
  no detent) and "Rings at" (rounded to the quarter mark). A hand at 3:07
  fires at 3:00, and the gap between the two IS the mechanism's setting
  resolution, which is what §38 exists to improve.


- **Winding click is plate-fixed** (was item 2), closed as part of the
  keyless-works move to the dial side. The ratchet slid down the fusee
  arbor to just above the base plate (under the great wheel) so the
  dial-side winding path could cross the plate legally — and at that plane
  the honest click mount became trivial: its own labelled unit
  (`Winding click`) on a short post standing on the plate's top face, beak
  in the ratchet's teeth, at the builder's original azimuth (a multiple of
  the 15° tooth pitch, preserving the beak-in-valley registration).
  MECH_GRAPH: support `Winding click → plate`, drive
  `Fusee & great wheel → Winding click`; the graph's `todo` entry is gone.

- **Setting arbor terminates at the motion works' minute wheel** (was item
  1). The dial-centre stand-in — a pinion cap beside the cannon pinion,
  meshing nothing — is gone: the arbor's traverse now ends one mesh
  distance from the minute wheel's axis (on the keyless side, the short way
  in), rises to the minute wheel's own plane, and its 8-tooth cap engages
  the wheel's real teeth at module MW_MODULE_1. The MW_* constants are
  hoisted to the top of main.js with the layout constants (the documented
  TDZ hazard), and MECH_GRAPH gained the drive edge
  `Keyless works → Motion works`. This removed all three FORBIDDEN
  overlaps (Dial⇄Motion works, Hour wheel⇄Keyless works, Keyless
  works⇄Motion works). The cap's rotation is still driven by handSetOffset
  (item 3's representational convention), with a rest phase aimed at the
  wheel.

- **Hairspring terminal fixed; swan-neck regulator added** (was item 4). The
  stud no longer belongs to the spring: it hangs from the cock slab's
  underside and clamps the terminal's end, and the spring is re-anchored so
  that end lands on the cock's own axis. Winding is now a change of
  geometry, not a rigid rotation — `makeHairspring` precomputes wind
  keyframes (inner boundary follows the staff, outer end fixed) and `tick()`
  swaps them via `userData.setWind(θ)`. On the cock's top face: an index arm
  on a collar around the jewel, swept 0.45 rad so its two curb pins drop
  over the open cutaway and straddle the terminal curve at its midpoint,
  dressed with a swan-neck spring and opposing adjuster screw. The stud is
  carried by the regulator ASSEMBLY — a concentric stud-carrier ring whose
  arm cantilevers over the open cutaway (0.9 rad off the cock axis, past
  the index at 0.45) and drops the stud to the spring plane in plain view,
  side-pinned —
  and the staff's upper pivot got a visible shock setting: hole jewel in the
  cock, capped endstone over the staff tip (0.17 endshake) held by a gold
  lyre spring. Declared in MECH_GRAPH (`Hairspring → Balance cock`,
  `Regulator → Balance cock`); support 0 failures, clearances 0 violations.


- **Jewel style unified.** `makeJewelSetting` (the 9 base-plate lower pivots
  and the balance cock stone) is no longer a brass-ring-plus-torus appliqué:
  it now builds the same flush rubbed-in look as the 3/4 plate and escape
  bridge — a low nickel collar carrying the counterbore (rim a hair proud,
  since the host meshes have no real bore cut) with the ruby annulus sunk
  below the rim on the bridge's 0.08 seat margins.

- **Balance cock level with the 3/4 plate.** The whole escapement z-stack was
  re-stridden for it (wheels thinned great 2.4→1.4 … escape 1.5→0.8, pinions
  3→1.6; L_CENTER/THIRD/FOURTH/ESCAPE dropped ~2.5), solved top-down from the
  cock goal. The plate's underside now takes the hairspring stack into its
  floor measurement, so cock and plate share one underside BY CONSTRUCTION
  (both = spring top + margin); the cock is a stepped piece — slab flush in
  the band over the cutaway, low tail block screwed to the plate top at the
  cut edge. The impulse-pin plane, hack tangency (error 0) and released gap
  (0.604) all survived the drop; sweeps clean (0 violations, no new
  FORBIDDEN pairs).

- **Hour hand had no motion works.** Was `hourHand.rotation.z = minuteA / 12` —
  the only ratio in the movement produced by an arithmetic operator. Now a real
  cannon pinion → minute wheel → minute pinion → hour wheel train, the hand
  mounted on the hour wheel's tube, with a centre bore in the dial for it to
  pass through. Verified 12.000000:1 through the tooth counts.
- **Nothing was properly supported.** 13 of 28 declared support edges had no
  geometry behind them (including all three train bridges and the balance cock,
  which floated 17.5 units off the plate it claimed to sit on). Fixed by lower
  pivots into the main plate for every arbor, a Glashütte-style three-quarter
  plate carrying the upper pivots, a base-plate-mounted combined escape/pallet
  bridge, and grounding for the lever furniture. Now 0 failures / 37 edges.
- **Pillars supported nothing**, rising to a top plate that did not exist. They
  now carry the three-quarter plate.

`checkSupportGeometry()` exists precisely because this class of defect was
invisible: the grounding check verified that declared edges formed a connected
graph, not that any geometry existed at the other end. Keep new parts declared
in `MECH_GRAPH` so they stay accountable.

## 18. CLOSED — the power-reserve reduction turned 25% faster than its arbor

The reduction's tooth counts still encoded a 120° indicator scale that no
longer existed.

`rsvArbor0` carries `reservePinion0` on the barrel-arbor axis, coaxial with
`barrelArbor` and described in its own build comment as slip-coupled to it. A
slip coupling transmits rotation and slips only at the end stops, so over one
wind-to-empty cycle that pinion must turn what the arbor under it turns:
`RESERVE_BARREL_TURNS` = 3.75 (30 h at 1 rev/8 h).

It turned **4.6875**. The train is posed backwards from the hand —
`rsvArbor1` takes `hand × (W2/P1)`, `rsvArbor0` takes `that × (W1/P0)` — so
p0 swept `hand travel × 11.25`, and at a 150° sweep that is 1687.5° = 4.6875
turns. Off by exactly 1.25 = 150/120.

**Why 11.25 was once right.** It was derived, for a 120° arc: 3.75 ÷ 11.25 =
⅓ rev = 120° exactly. The arc was later widened to 150° ("more angular travel
per hour = finer reading") and the ratio was not re-derived with it. Two
comments still asserted the retired figure, which is why it survived — every
local reading agreed with itself. Nothing overlapped and nothing warned,
because `rsvArbExt`, the visible barrel-arbor extension, is parented to
`reserveTrain` rather than to `rsvArbor0`, so the two rotations were never
displayed against each other. Rule 2, same family as the old `minuteA / 12`
hour hand: the display quantity was the input and the gears were drawn to
agree with it.

**The fix.** R must be 9 (3.75 rev = 1350°, ÷ 9 = 150°). `rsvTeethP1` 8 → 10
makes the second stage 20/10 = 2, so R = 4.5 × 2 = 9. Measured after:
p0 turns **3.75** over a full reserve, matching the arbor.

Two things the filing got wrong, both corrected by measuring:

- It claimed p1 8→10 was cheapest because "only p1's pitch radius moves."
  Wrong — the centre distance is fixed and both live options give a 2:1
  second stage, so `p1 8→10` and `w2 20→16` produce **identical** pitch
  radii (p1 2.037 → 2.376, w2 5.092 → 4.753). Only the module differs
  (0.475 vs 0.594).
- It then guessed `w2 20→16` was better on stock-floor grounds. Also wrong:
  this unit's two waived §50 rows are 0.3-unit **radial bands** that the
  module does not reach — measured at 0.1125 mm before and after, unchanged,
  with `stockFloor` still 0 degenerate / 0 unwaived. Stock was not a
  discriminator at all.

With stock neutral the tie-break is watchmaking vocabulary: 10 leaves is a
standard pinion count, and taking the wheel down to 16 would push it toward
pinion territory while cutting the coarsest module in the movement.

**The gate.** Three quantities have to agree — the arc the well is graduated
to, the hand's travel over it, and the reduction — and they were three
separate literals. They are now one pair of constants, `RESERVE_SWEEP_DEG`
and `RESERVE_SCALE_HOURS`, which the dial (passed through `makeDial`'s
sub-dial `scale`), the hand, and a build-time assert all read. The assert was
confirmed to fire by reverting p1 to 8:

```
§39/TODO 18: reserve reduction 11.25 puts 4.6875 turns on p0 over a 150°
sweep, but the barrel arbor it is slip-coupled to turns 3.75. R must be 9.
```

The dial's painted face is unchanged — the parametrised arc renders
byte-identical textures to the old literals, and a bare `makeDial()`
(test-geometry.html) reproduces the shipped face from the defaults.

**Not verified here:** p1's pitch radius grows 0.34 units, and w1 and
`rsvPost1` sit inside the recessed reserve well's footprint — that post was
once shortened to stay clear of the well floor. `stockFloor` and boot silence
are clean; the clearance and overlap sweeps are the owner's gate run.

## 13. CLOSED — three followers are held to their cams by nothing (§48)

`auditOscillators` classifies every reversing part as two-way driven,
restored by a declared element, or **restored by nothing**. Three land in
the third bucket, and all three fail the same way: the pose law computes
the follower's position from the CAM PROFILE, so the return is whatever
the profile says next. Nothing presses the follower against the cam, and
a follower that is not pressed is *glued* — it would ride up a flank and
stay there, or leave the cam entirely on the falling side.

Each already has a spring MESH. That is exactly what §48 exists to
distinguish: a spring next to a part is not a mechanism.

| Part | Spring modelled | Pose law | Fanout |
|---|---|---|---|
| Alarm release feeler | `alarmFeelerSpring` | position from the cam profile | 4 |
| Minute jumper | `jumperClickSpring` | `max(ride * crownPullT, lift)` from the star profile | 0 |
| Maintaining detent | `maintSpring` | `MAINT_DET_BASE + SIGN * lift` from the saw profile | 0 |

Closing this means the spring APPEARS IN THE LAW as the thing producing
the return — the follower seeks the cam because the spring pushes it,
rather than because the profile was evaluated. It does not mean modelling
spring RATE or force: §48's scope guard puts that outside this work, and
so does this item.

The feeler is first by fanout, and it is also the one whose failure is
visible — it drives the alarm release.

**CLOSED.** The law for all three is now a ONE-SIDED CONSTRAINT rather
than a placement. The spring drives the follower toward a *seat* it can
never reach, and the cam stands in the way: `seek the seat, stop at the
cam`. The seat is preloaded one `CLEAR_MARGIN` of travel past the deepest
the cam can go, which is what keeps the follower loaded at the bottom of
the profile instead of merely kissing it — a spring that goes slack in
the valley has lifted off.

Geometry is unchanged by this, and that is the point rather than a
caveat: while contact holds, the constraint evaluates to the cam, same
pose every frame. What changes is what the law MEANS, and what it would
do if the cam fell away — the follower drops to its seat instead of
tracking a profile that is no longer there.

The feeler needed a second fix. Its blade was a child of
`alarmFeelerLever` — travelling with the very arm it exists to press,
which is the §43 postscript's defect found a second time in a different
part. It now hangs from its own stud on the static unit, and the frame
law keeps its free end on the arm while its root stays put.

Verified by the audit that filed the item: `restoredByNothing` is
**empty** and all three sit in `restoredByDeclaredElement` — feeler ←
`alarmFeelerSpring`, jumper ← `jumperClickSpring`, detent ←
`maintSpring`. Boot silent; focused battery over the three plus Dial,
fusee and plate: support 0, graph 0, penetration none over budget,
clearances 0.

Out of scope here, as in §48: spring RATE. These springs act; none of
them yet sets a force.

## 14. CLOSED — the alarm hammer's fall is a spring law with no spring (§48)

`alarmHammerAngle()`'s free swing is
`ALARM_DRAW_RAD * cos(ALARM_HAMMER_W * t)`, decaying exponentially after
the strike. That is a **spring-and-inertia law** — `ALARM_HAMMER_W` is an
angular frequency, and it is derived so the hammer reaches the wire
exactly at `ALARM_FALL_S`.

So the pose law is not missing a restoring element; it *asserts* one. The
movement has no hammer spring modelled. §48 reports this as a MALFORMED
declaration rather than a finding, because the build now declares the
spring the law implies (`declareRestoring('Alarm hammer', 'spring', …,
'alarmHammerSpring')`) and the audit answers that no such mesh exists.

This is the inverse of item 13 and the more interesting half: there, a
spring exists and does nothing; here, a spring does something and does
not exist. Closing it means a real hammer spring in the geometry, seated
against the hammer's tail and grounded to the plate — the §43 postscript
lesson, that a return spring has one end fixed and one end bearing.

Note that §25 recorded the lobes lifting the hammer and left the fall
unexplained. The fall was in fact always explained; what was missing was
the part.

**CLOSED.** `alarmHammerSpring` is a flat blade at `SPRING_FLAT_U`,
grounded on its own stud standing from the plate to the gong plane, and
bearing on the tail at 45% of its length — inboard of the nose, so it
never fouls the cam. The push direction is DERIVED as minus the
derivative of the bearing point with respect to the hammer angle, with
the draw's own sign deciding which way that is, so a change to
`ALARM_DRAW_RAD` carries the spring rather than silently inverting it. A
build-time tripwire re-checks that the torque opposes the draw.

The blade's free end tracks the tail each frame while its anchored root
stays put, so the spring is seen to work against the draw — the §43
postscript's lesson applied on purpose this time rather than after the
fact.

Verified: root moved **0.000000** while the hammer swung **0.3162 rad**,
tip-to-tail gap **0.0000** across the whole strike axis, and the measured
torque (−5.954) opposes a draw of +0.27. The audit closes its own
finding: the alarm hammer moved out of `malformedDeclarations` into
`restoredByDeclaredElement ← alarmHammerSpring`, leaving that bucket
empty. Boot silent; `stockFloor` green (the blade clears the spring floor
on its own, waived unchanged at 57); focused battery over hammer, gong,
striking wheel, lock, barrel, plate and balance: support 0, graph 0,
penetration none over budget, clearances 0.

What is NOT closed, and is deliberately out of scope: `ALARM_HAMMER_W`
still comes from the strike timing rather than from this blade's
stiffness. §48's scope guard puts spring RATE and force modelling
outside that entry, and it stays outside this item too. The spring now
exists and acts; it does not yet SET the frequency.

## 15. CLOSED (winding + setting chains) — mesh phase solved from measurement; two sites remain

Reported by eye from the running sim: the two alarm winding idlers
appear to **interlock tooth-on-tooth rather than tooth-into-gap** — the
meshing pair is half a tooth pitch out of phase, so the teeth collide at
the pitch circle instead of interleaving.

Not yet instrument-confirmed. The battery would not catch it on its own:
it asks whether volumes overlap, and two gears meshing out of phase
overlap exactly as much as two meshing correctly — this is a KINEMATIC
lie of the same family as the pawl that drove backwards and the saw cut
the wrong way, all three of which were caught by eye rather than by the
inspector.

Where to look: the idlers' build-time angular offsets. A correct mesh
needs each wheel's tooth phase set from its own tooth count and the
centre-line azimuth between the pair, so that one wheel's tooth lands in
the other's gap. An offset that is right for one pair and copied to the
other, or one that ignores odd/even tooth-count parity, produces exactly
this half-pitch error.

Worth checking whether the same derivation is shared with any other
meshing pair before fixing it in one place only.

**Progress, and where it stopped.** Branch `claude/todo-15-idler-phase`
carries the diagnosis and a fix for the I1⇄I2 mesh only. The cause was in
plain sight: BOTH idlers were built with `rotation.z = Math.PI / teeth`,
half of their OWN pitch, with no reference to the line of centres between
them — which says nothing about where a wheel's teeth fall relative to
its neighbour. `gearMeshPhase()` now solves I2 against I1, with a
build-time tripwire on the anti-phase condition.

**The setting wheel ⇄ I1 mesh is ALSO wrong** (reported by eye, second
screenshot) and is NOT fixed. It is harder than the idler pair for a
reason worth writing down before anyone attempts it:

- The setting wheel is a **`dialFace` child**; the idlers are **`movement`
  children**. Their positions are in different frames, so a line-of-centres
  azimuth cannot be taken between them without transforming first.
- `dialFace` is **Y-FLIPPED** (`dial-local (x,y) ↔ world (P.dial.x − x,
  P.dial.y + y)`). A Y-flip MIRRORS the gear, which reverses the direction
  its tooth pattern advances. So the setting wheel's effective phase in
  world terms is not its `rotation.z`, and the sign of the pitch step
  flips. Getting this wrong produces a fix that looks derived and is still
  half a pitch out.
- The setting wheel currently has **no explicit `rotation.z` at all**
  (phase 0), so it is the natural datum — but only once expressed in the
  frame the idlers live in.

The right shape is a CHAIN solved from one datum — setting wheel → I1 →
I2 → arbor pinion — since a gear's phase is determined by its mesh with
the previous wheel, not chosen. Fixing pairs independently cannot work: I1
cannot satisfy two meshes with two freely-chosen phases.

**The chain solve is now written** (same branch). Setting wheel is the
datum; i1 is solved against it, i2 against i1. Every wheel's tooth
direction is READ from its own world matrix after it is built, and the
sign of its response to `rotation.z` is measured by bumping it — so the
dialFace frame, the Y-flip and the mirroring all come out in the wash
instead of being reasoned about by hand. Two tripwires per mesh:
anti-phase, and centre distance against the pitch-circle sum.

Both tripwires are SILENT, and the centre-distance one is independent of
the phase solve — it confirms the pairs genuinely mesh, which the phase
result would be meaningless without.

**Verification is the other open half.** The tripwire checks the formula
against its own terms, which is not independent. An attempt to measure the
built geometry failed twice because it could not SELECT the meshing pair —
only one spin group sits under the `Alarm setting idler` label. Any
instrument for this has to be able to name the two wheels before it can
measure them, and that naming gap should be closed first. The battery
cannot substitute: gears meshing out of phase sweep the same volumes as
gears meshing correctly.

The naming gap has a CAUSE, now known: `makeGear` returns a **Group**
(rim mesh plus optional hub mesh), not a mesh. Both the first chain-solve
attempt and both measurement attempts looked for `isMesh` and found
nothing or found the wrong thing — the solve crashed the build outright,
and the measurements silently compared the wrong pair of wheels and
produced confident nonsense (a tip-circle gap of −9.05 for a meshing
pair). A per-gear handle that returns exactly one geometry per wheel is
the prerequisite for any real instrument here; a vertex-level pass still
double-counts, because more than one extruded mesh sits under a single
gear.

---

### CORRECTION — the branch fixes the WRONG TRAIN

Both reports were about the **`Alarm winding train`** (`registerLabel` at
`main.js:6705`). Branch `claude/todo-15-idler-phase` solves the **`Alarm
setting`** chain instead — a different unit. That is exactly why its
tripwires pass while the screenshots plainly disagree: they measure
wheels the reports were never about. **Do not merge it as a fix for
this.**

**The actual site is `main.js:6756`:**

```js
w.rotation.z = Math.PI / ALARM_WIND_IDLER_TEETH;
```

Same bug, same shape: half of the wheel's OWN angular pitch, with no
reference to the line of centres to its neighbour.

**It is an IDIOM repeated across the file**, which is why fixing one
place kept not being enough. Known sites:

| Line | Wheels |
|---|---|
| 4870–4871 | power-reserve wheels 1 and 2 |
| 5696 | alarm branch idler i1b |
| 6756 | **alarm winding idlers — what was reported** |

The chain-solve machinery on the branch (`worldToothPhase`, `alignGear`,
`meshPhaseTarget`, and the two per-mesh tripwires) is written to be
reusable and is the right tool — it measures each wheel's world tooth
direction and the sign of its response to `rotation.z`, so frames, flips
and mirroring need no hand reasoning. Point it at the winding train, then
at the other sites, rather than writing a fourth bespoke fix.

**Prerequisite, still unmet:** a per-gear handle returning exactly one
geometry per wheel. `makeGear` returns a **Group** (rim plus optional
hub). That single fact caused a build crash and two confidently wrong
measurements, and it is why no independent instrument for mesh phase
exists yet. The battery cannot substitute — gears meshing out of phase
sweep the same volumes as gears meshing correctly.

### The tripwire now FIRES, and that is the finding

Pointed at the winding train (`solveGearChain` is now reusable; both
trains run through it). Boot reports:

```
alarm setting: setting wheel ⇄ idler 1   0.2% of a pitch off
alarm setting: idler 1 ⇄ idler 2        35.1% off
alarm winding: climb pinion ⇄ idler 1   29.6% off
alarm winding: idler 1 ⇄ idler 2        34.7% off
```

**The earlier silence was a FALSE PASS.** The old check read each wheel's
phase as `local +x` transformed — the same assumption on both sides of
the comparison — so it agreed with itself by construction. That is the
session's recurring lesson in its purest form: *a check that searches for
less than the thing it verifies always passes.* Measuring tooth position
from the VERTICES breaks the circularity, and the disagreement appears
immediately. The screenshots were right and the instrument was wrong.

**But the solve is NOT converging.** `alignGear` sets each phase from the
same measured function the tripwire then re-reads, so a working solve
would leave ≈0% residual, not 35%. One of the two is still faulty. The
most likely cause is tip selection inside `measuredToothPhase`: vertices
within 0.5% of max radius are treated as tooth tips, but `makeGear`
bevels its teeth, so that band may be a nearly-uniform ring rather than
the tips — and a circular average over a uniform ring has no direction,
returning noise. Worth printing the tip-vertex count and the resultant
vector's LENGTH (near zero ⇒ no usable direction) before trusting any
number this function returns.

**Boot is no longer silent on this branch**, deliberately: the warnings
are an accurate report of a real defect. They must be resolved, not
silenced, before anything here merges.

### The diagnostic ran — the instrument returns NOISE, and the percentages meant nothing

Probing idler 1 of the winding train, sweeping the assumed tooth count:

| N | tip verts | total verts | resultant length | phase° |
|---|---|---|---|---|
| 12 | 1224 | 11304 | **0** | 1.442 |
| 14 | 1224 | 11304 | **0** | −11.415 |
| 15 | 1224 | 11304 | **0** | −10.558 |
| 16 | 1224 | 11304 | **0** | −9.808 |
| 18 | 1224 | 11304 | **0** | 1.442 |
| 20 | 1224 | 11304 | **0** | 1.442 |

**The resultant vector is zero at every tooth count.** A circular average
whose resultant has no length has no direction: `measuredToothPhase`
returns pure noise, which is why `phase_deg` skitters between −11.4° and
+1.4° depending on a parameter that should barely matter.

The cause is exactly as predicted, and the vertex COUNT shows it: 1224 of
11304 vertices sit within 0.5% of max radius — about 11% of the whole
wheel. Tooth tips of a ~16-tooth gear should be a hundred or so. That
band is a continuous bevel ring, not the tips, and a uniform ring
averages to nothing.

**So the percentages in the previous entry — 29.6%, 34.7%, 35.1% — are
NOT evidence of misalignment. They are readings from a broken gauge, and
should not be quoted.** What still stands is the screenshots, which is
observation rather than instrumentation, and the code fact that
`rotation.z = Math.PI / teeth` cannot express a mesh relationship.

What the previous entry got right is narrower than it claimed: the
`local +x` reader was self-referential and could never fail. Replacing it
with a broken gauge did not fix that; it swapped a check that always
passes for one that always fires.

**Next, and do this before anything else here:** find the real tip
vertices. The tip land is `tipFrac = 0.18` of a pitch either side of
tooth centre, at `tipR = pitchR + module * 0.95`, with the bevel taken
off the FACE — so tips must be selected by radius AND by z (the flat
face, not the bevel chamfer), or better, taken from
`gearOutlineShape`'s own parameters rather than rediscovered from a vertex
soup. A working gauge must show `resultantLen` near 1 for the true tooth
count and near 0 for wrong ones — that ratio is itself the self-test, and
it is the thing to build first.

### The gauge, third attempt: a SPECTRUM — right shape, insufficient confidence

Stop hunting for "tip vertices" at all. Sample the gear's silhouette
radius as a function of azimuth, `R(θ)`, and the tooth pattern is a
periodic signal: its **N-th Fourier component** gives the phase from its
argument and a **confidence from its amplitude**. Convention-independent,
bevel-tolerant, and — the part the first two gauges lacked — **it says
how much to trust itself**. The true tooth count should stand out as a
clear spectral peak; if no N stands out, the reading is refused rather
than returned.

Measured on winding idler 1, sweeping N from 6 to 40:

| N | amplitude |
|---|---|
| **28** | 0.03802 |
| 16 | 0.02913 |
| 35 | 0.01766 |
| 24 | 0.01708 |

**It fails its own bar.** Best-to-second ratio is **1.31** — a real tooth
count should tower over its neighbours, not edge past one. And only
**699 of 2048** azimuth bins are populated.

That second number is the cause and it is not subtle: raw VERTICES
undersample the silhouette. A gear's vertices cluster at tooth corners
and leave two thirds of the azimuth range empty, so `R(θ)` is a sparse,
irregularly-spaced signal and the Fourier estimate aliases. The gauge is
sound; its input is not.

**The fix is to sample the silhouette properly** — walk the geometry's
TRIANGLES and interpolate each edge across the azimuth bins it spans,
rather than dropping in isolated vertices. Every bin then gets a value
and `R(θ)` becomes the continuous outline it is meant to be. Expect the
ratio to go from 1.31 to something unambiguous; that ratio is the
acceptance test, and until it passes, no phase number from any of this
should be quoted.

**Three gauges, three failure modes, worth keeping as a set:**

1. **`local +x`** — self-referential. Same assumption on both sides, so
   it always passed.
2. **Tip-vertex circular average** — resultant length 0. Averaged a
   uniform bevel ring, so it always fired.
3. **Silhouette spectrum** — the right idea, honestly under-confident.
   Says "I don't know" instead of lying, which is the only one of the
   three that is safe to build on.

### Edge interpolation fixed the sampling — and exposed the real problem

Walking every triangle EDGE across the azimuth bins it spans works
exactly as intended: **2048 of 2048 bins populated**, up from 699. The
sparse-signal aliasing is gone.

But the spectrum did not sharpen — it **collapsed**:

| N | amplitude |
|---|---|
| 8 | 0.00008 |
| 32 | 0.00007 |
| 16 | 0.00004 |

Ratio 1.14, amplitudes ~0.008% of mean radius. With the sampling fixed,
`R(θ)` came out **essentially CONSTANT** — a circle. There is no tooth
modulation in the silhouette at all.

**That is not a gauge failure; it is a finding about the object.** A
toothed wheel's outer radius must swing by roughly a module between tip
and root — several percent, not eight thousandths of one. A silhouette
this flat means the max-radius outline is dominated by something
**circular sitting at or beyond the tooth tips**. Consistent with the
earlier probe, which found 1224 vertices bunched within 0.5% of max
radius — that was never a bevel band on the teeth; it reads like a ring.

So one of two things is true, and they are cheap to tell apart:

1. the handle (`spin.userData.gear`) is not the toothed wheel, or carries
   more than it, or
2. there is a genuine circular part — a rim, collar or washer — at the
   tip radius, in which case the mesh the screenshots show cannot be the
   part this handle points at.

**Next: list every mesh under the handle with its own max radius and
vertex count.** One call, and it distinguishes the two immediately.
Measure the toothed mesh ALONE and the spectrum should snap to the true
tooth count — the ratio is still the acceptance test.

Each attempt has moved the unknown one step outward: the check was
circular, then the input was sparse, and now the input is clean and the
OBJECT is wrong. That is progress, but the phase question remains
unanswered and nothing here should be quoted as a measurement yet.

### RESOLVED — the fourth gauge works, and the chains are solved

The gap gauge (silhouette by outline-edge interpolation → threshold →
count gaps → circular mean folded into one pitch) passes every self-test
and closed the loop:

- **51/51 gaps** found on each winding idler, matching
  `ALARM_WIND_IDLER_TEETH` — the spectrum before it swept N only to 48,
  below the true count; the constant was one grep away.
- confidence **0.9997**; centre distance 15.300 = pitch-circle sum 15.300
- measured the reported defect at **35.8% of a pitch** out of phase,
  matching the screenshots; after the chain solve the same independent
  gauge reads **0.00%**, and the teeth visibly interleave.

Three build-time traps are now encoded in the gauge, each found by a
failed measurement: face-triangulation chords that mask gaps (skip edges
spanning ≥ half a pitch), stale child `matrixWorld` before first render
(`updateWorldMatrix(true, true)` — the setting wheel passed with stale
matrices only because it sits on the centre axis), and a slope-probe bump
smaller than the gauge's own bin quantisation.

`solveGearChain` refuses to solve on a non-credible reading (gap count ≠
declared teeth, or weak resultant), loudly — a skipped chain is a boot
warning, not a silent fallback.

**Remaining sites, still `Math.PI / teeth`:** the power-reserve pair
and the alarm branch idler i1b (the line numbers this once quoted have long
moved; grep the idiom). The power-reserve half is now MEASURED — 47–49% of
a pitch off anti-phase at three winds — and has its own item, **48**, which
also carries two findings this item's machinery could not have surfaced: the
gap gauge's min-to-max threshold misreads an 8-leaf pinion, and that train's
angles are solved backwards from its hand. Same fix shape: name
the chain, pick the datum, call `solveGearChain`. Also note i1b shares an
arbor with setting i1, whose phase the solve now moves — if the two are
meant to be one rigid part, their relative phase is a constraint nobody
has stated yet.

### The barrel report exposed the real bug: the invariant was the wrong one

Extending the winding chain past idler 2 to the **barrel** and on to the
**striking pinion** was the easy half — the barrel is not a terminus but
a wheel with two meshes, and stopping at idler 2 is the same
"fixed one pair, ignored the next" mistake one link further down.

The hard half is that the mesh condition itself was **wrong**, and the
barrel report is what surfaced it. Measuring at the built pose gave 0.00%
while measuring the *rendered* scene gave 13.67% — with a spin ratio of
exactly −1, which is correct for two 51-tooth wheels. Correct rotation,
drifting mesh: the condition could not be a property of the mesh.

Let `uP` be where P's tooth pattern sits on the centre line as a fraction
of its pitch, `uQ` the same for Q from the opposite direction. Meshing
gears **counter-rotate**: turn P by +θ and Q goes −θ·(NP/NQ), under which
`uP` decreases by θ/pP while `uQ` **increases** by the same. Therefore

- `uQ − uP` changes continuously as the train runs — not a property of the
  mesh at all;
- `uP + uQ` is **invariant**, and the condition is `frac(uP + uQ) = 0.5`.

The solve had been targeting `uQ = uP + 0.5` — the difference. That is
true at exactly one rotational instant and false everywhere else, which
is precisely the reported symptom: right at rest, tooth-on-tooth in the
running sim. Every "verified 0.00%" before this measured the built pose
only, so the wrong invariant was never exercised.

**The test that separates right from lucky** is invariance: measure at
the build pose, as rendered, and at an arbitrary third pose, and require
agreement. Now **0.01% at all three** (spin ±7.938 and ±1.234), gap
counts 51/51, boot silent, all five links credible.

A build-pose-only check could never have caught this — it is a check that
searches for less than the thing it verifies, arrived at from a new
direction: not a too-small search *range* this time, but a single sample
of a quantity that only reveals itself in motion.

## 16. PART CLOSED — the alarm link was thickness-legal and structurally impossible

Reported by eye: the horizontal lay shaft looks too thin. It is, and
measuring it showed the check that should have caught it cannot see this
class of defect at all.

### The feature-size checks DO reach these segments — and still pass them

Every mesh in the unit is enumerated by `stockCensus`. Two things blunt
that:

1. **`STOCK_WAIVERS['Alarm link'] = 'TODO 11'` is a UNIT-level waiver.**
   One entry excuses every segment, so a 0.09 mm hair and a marginally
   thin decorative bracket read identically in the report.
2. **More fundamental: the stock floor is a THICKNESS test with no notion
   of SLENDERNESS.** The beak tail is 0.12 mm section — exactly
   `STOCK_MIN_U`, i.e. built deliberately *to* the floor — and 10.0 mm
   long. It passes by construction while being **84× longer than it is
   thick**.

Stiffness goes as t⁴/L³, so the floor ranks these backwards. Measured
cantilever stiffnesses in this one unit:

| part | section | length | stiffness | deflection @ 1 mN |
|---|---|---|---|---|
| centre crank | **0.045 mm** (thinnest) | 0.42 mm | **2843 N/m** | 0.0004 mm |
| beak tail | 0.12 mm (at floor) | 10.05 mm | **10.2 N/m** | 0.098 mm |

**The thinnest part in the unit is 280× stiffer than the one that passes
the floor.** Thickness alone predicts nothing.

### The shaft and its pillars

- lay shaft **0.09 mm diameter, 9.05 mm long — L/d = 100.5**. A human
  hair is about 0.07 mm.
- bushes sit at shaft stations **−0.06 and +9.94** on a shaft running
  ±12.06 — **both supports cluster at the rod end**.
- the **centre crank, which drives the selector ring, overhangs 4.5 mm**
  past the nearest bush: stiffness **21 N/m**.

### Force transfer, pusher → ring: it divides force twice and bends

- **beak lever** — nose arm 0.735 u, tail arm 26.79 u ⇒ displacement gain
  **36.5×**, so force at the tail is **2.7%** of what the column applies
  at the nose.
- **beak tail** deflects 0.098 mm/mN against a required rod travel of
  **0.158 mm**.
- **shaft drive end** deflects 0.047 mm/mN against a selector travel of
  **0.071 mm**.

Two compliant members in series, each absorbing ~two-thirds of its own
working stroke per millinewton, downstream of a 36:1 force reduction.
**Stall force ≈ 1.5 mN** — the load at which the whole stroke goes into
bending and nothing reaches the ring. A detented selector ring plausibly
needs 5–50 mN, so this is short by one to two orders of magnitude.

(First-order solid-steel cantilever estimates. The absolute numbers carry
maybe a factor of two; the *ratios* — deflection against stroke — are what
the conclusion rests on, and they are not close.)

### What to fix

- **Move the pillars.** Both bushes sit at one end. Stations near t≈2 and
  t≈22 would give a long span and short overhangs at both ends, killing
  the 4.5 mm cantilever. NOTE the existing comment: those two stations
  were chosen because pose-swept ray probes found their vertical columns
  clean, so any new station must be re-probed the same way.
- **Thicken the shaft and the beak tail**, and derive both from a
  SLENDERNESS budget rather than the thickness floor.
- **Shorten the beak's tail arm** or re-site the rod: 36:1 is a
  displacement gain nobody asked for; the rod only needs 0.42 u of travel.

### The general lesson, and the check it implies

§50 gave every part a minimum thickness. Nothing gives them a minimum
*stiffness*, and stiffness is what "constructible" actually means for a
lever or an arbor. A `checkSlenderness` in the §50 mould — report L/t per
segment, waivers citing an item, gate on nothing at first — would catch
this class everywhere rather than only where someone happens to look. The
alarm link would be its first customer; the winding-train hangers
(0.075 mm × 4.7 u) are probably its second.

**DELIVERED, in two halves, seven years of § numbers apart.** §54 built
`checkSlenderness` and shipped the L/t half. It did **not** ship the *per
segment* half this paragraph asked for — it measured each MESH's bounding box
end to end, which for a shaft running in bushes is not a free length at all —
and it was never registered in `inspect.js`'s `CHECKS`, so `start()` answered
"unknown check" and the instrument had not executed once since §52. Every λ
quoted about this item was hand-run and then went stale in place. TODO 78
registered it, gave it the per-segment measurement this paragraph specified,
and re-took the numbers below.

### FIXED — sections derived from §54's budget; one item deliberately left

**The pillar move was investigated and REJECTED on evidence.** Probing
every station along the chord showed the whole inboard run is under
dial-side hardware — which is *why* the two bushes sit where they do. The
4.5 mm cantilever cannot be shortened, so the fix had to be section, not
position. That is the opposite of what this item originally proposed, and
the probe is the reason.

**Both members are now derived from `SLENDER_TARGET`**, so they are sized
by the same number §54 measures them against:

| member | was | now |
|---|---|---|
| `alarmLinkShaft` | 0.09 mm, λ 100.5, **21 N/m** at the drive end | 0.335 mm, λ 27, **4075 N/m** |
<!-- TODO 78: the "now" column is a plan that was reverted on the same day
     (see the postscript below and §137 Landing 2). The shipped shaft is
     r 0.1233 → 0.0934 mm section, λₑ 127.6 measured, 2807 N/m at the drive
     end and 21.2 N/m at the ROD end. -->
| `alarmLinkBeakTail` | 0.12 mm square, λ 83.7, **10.2 N/m** | 0.12 × 0.372 mm blade, λ 27, **305 N/m** |

The tail is now a **blade, not a fatter square**: the load is vertical, so
the section grew in Z where the force acts and stayed at floor stock in Y.
That is what a real lever looks like, and it is what §54 rewards — depth
where it is loaded rather than fat everywhere.

The shaft's radius fell out of two independent budgets agreeing: §54's
ceiling (d ≥ chord/30) and the load path (holding the drive end's
deflection to a tenth of the selector stroke under a ~20 mN detent needs
≈ 2800 N/m). Geometry budget and force budget landing on the same
number is why it is trustworthy rather than tuned.

Cascade handled by the existing derivation chain: the crank's radial
offset had to become derived (`SHAFT_R + CRANK_T/2`) because at the old
literal 0.22 an arm would now sit *inside* its own arbor, and
`ALARM_LINK_ROD_FOOT` follows `CRANK_TOP` automatically, as §51 set it up
to. Cranks and hangers also went to floor stock, which took `stockFloor`
waived rows **57 → 53**.

**Force transfer, restored:** stall force ≈ **1.5 mN → ≈ 48 mN**
(tail-limited), which is in the plausible band for a detented ring rather

> **RE-TAKEN AND REFUTED BY TODO 82.** Every figure in this passage rests on
> two errors that push the same way: the "0.158 mm" rod travel is
> `ALARM_LINK_ROD_TRAVEL = 0.42`, a constant `src/main.js` deletes as
> *"referenced nowhere, and wrong"* (measured: **0.09932 u = 0.0376 mm**), and
> "in series … with the weakest member setting it" is a MINIMUM over members
> charged against different strokes, where reflected compliances add as
> `n²/k`. Computed properly: **k_eff 21.89 N/m, stall ≈ 1.58 mN,
> ROD-END-limited, an order of magnitude BELOW the 5–50 mN band.** The
> rod-end overhang carries 72.4% of the compliance and appears in none of
> these paragraphs; the fork-end cantilever they are all sized against
> carries 0.1%. `tools/probe-82-alarm-stall.mjs`.

than one to two orders below it.

> **CORRECTION (TODO 63's re-take, 2026-08-20): the shaft half of this fix
> was REVERTED and the paragraph above no longer describes the shipped
> tree.** Two attempts to keep the thickened shaft were rejected by CI on
> `Alarm link ⇄ Minute jumper` (overlaps 0.312 and 0.310 — the jumper's
> swept envelope, which a virgin boot's pulled crown puts in the shaft's
> path); `ALARM_LINK_SHAFT_R` ships at the original 0.12 u (0.091 mm
> diameter — the hair), the declaration's own comment records why, and the
> `SLENDER_WAIVERS` entry stands. The TAIL's blade half SURVIVED — 305 N/m
> against the built metal, tail-stall ≈ 48 mN. Re-measured whole:
> the chain is **SHAFT-limited at ≈ 1.6 mN** (crank overhang 22 N/m ×
> 0.071 mm selector stroke) — the original headline number, restored
> through the OTHER member. The prerequisite for any next attempt is
> unchanged: measure the jumper's swept envelope along the shaft's
> stations first.

### MEASURED (§137 Landing 1, 2026-08-22) — the prescribed probe is taken, and it refutes the diagnosis both reverts were made under

`tools/probe-137-jumper-envelope.mjs` is the measurement this item has been
prescribing since the first revert. It boots virgin against `http.server`,
**asserts the crown reads PULLED** off the setting lever's own angle (the
hole the second revert fell into — a local run with a saved pose measured
this pair clean while CI measured it CONFIRMED), and walks the shaft's
chord station by station against `buildSweptRegistry`'s hulls — the same
hulls `sweptOverlap` judges, so a radius sized against these numbers
predicts CI by construction rather than by resemblance. Five things came
back, and four of them were not what the two reverts assumed:

1. **The minute jumper is not near this shaft.** Nearest alarm-link member
   to the jumper's swept hull is `alarmLinkCentrePin` at **13.32 u**
   (`clearanceAt` reads 13.49 at the pulled pose); `alarmLinkShaft`'s own
   hull stands 14.56 off. **§112 re-solved the rod site and the drive tab's
   azimuth ONE DAY after the revert post-mortem was written** (commit
   802a1df, 2026-08-13, against 718ffa9) — the post-mortem's premise died
   the next morning and nobody re-read it.
2. **The wall that actually binds is the `Alarm setting idler`**, over 89
   of the chord's stations, at a max legal radius of **0.2850** — a
   constant 0.435 gap. No shaft-radius table would ever have shown it: it
   is not the pair anybody was looking at, which is exactly why 0.447 →
   0.373 moved the overlap by 0.002.
3. **No station forbids the as-built 0.12.** The one row tighter than the
   idler, `Dial/alarmSelTab` at 0.1457 over 10 stations, is the DECLARED
   working contact (MECH_GRAPH's `Alarm link ⇄ Alarm selector` edge), and
   it reproduces the section block's own hand-probed 0.297 at 0.2957.
4. **The 4.5 mm cantilever this item's "FIXED" section derives from is
   gone.** "The pillar move was investigated and REJECTED on evidence"
   below describes the pre-§68 chord; §68's re-scan found the inboard
   pocket and the bushes now stand at chord stations 2.45 and 22, so the
   drive-end overhang is **0.9286 mm**. The pillar move happened — it just
   happened in a different entry.
5. **The force budget is therefore nearly met as built.** At 0.9286 mm,
   `3EI/L³` gives **2518 N/m** — 90% of the 2800 N/m target — and
   **r 0.1232 (+2.7%) meets it outright**, against a corridor that permits
   0.285. Re-derived at the real span, the chain is **TAIL-limited at
   ≈ 48 mN** (see TODO 63's correction), inside the 5–50 mN band.

> **RE-TAKEN AND REFUTED BY TODO 82.** Every figure in this passage rests on
> two errors that push the same way: the "0.158 mm" rod travel is
> `ALARM_LINK_ROD_TRAVEL = 0.42`, a constant `src/main.js` deletes as
> *"referenced nowhere, and wrong"* (measured: **0.09932 u = 0.0376 mm**), and
> "in series … with the weakest member setting it" is a MINIMUM over members
> charged against different strokes, where reflected compliances add as
> `n²/k`. Computed properly: **k_eff 21.89 N/m, stall ≈ 1.58 mN,
> ROD-END-limited, an order of magnitude BELOW the 5–50 mN band.** The
> rod-end overhang carries 72.4% of the compliance and appears in none of
> these paragraphs; the fork-end cantilever they are all sized against
> carries 0.1%. `tools/probe-82-alarm-stall.mjs`.


**What this leaves, and it is why the waiver stays.** §54's ceiling wants
λ ≤ 30 over the 19.55 u bush-to-bush span, i.e. **r 0.3258**, and the
corridor's binding wall tops out at **0.2850** — 0.041 short. **No section
legal in this chord meets the ceiling**, so `SLENDER_WAIVERS['Alarm link']`
cannot be retired by a section change at all: it needs a **THIRD BUSH
STATION**, which is position space, probed the same way the existing two
were. That is a layout change to file, not a section to re-argue — and it
is now a measured impossibility rather than a re-argued one, which is the
whole point of having taken the measurement.

> **TODO 78 re-took this paragraph with the instrument actually running, and
> the span it names is not the one that governs.** `checkSlenderness` had
> never executed (unregistered in `CHECKS`), and it measured each mesh end to
> end, so "λ over the 19.55 u bush-to-bush span" was a hand calculation the
> check did not perform. Registered and taught this shaft's two bushes, it
> measures three free lengths:
>
> | free length | L | λ raw | λ effective | k |
> |---|---|---|---|---|
> | overhang, rod end | 12.487 u / 4.732 mm | 50.6 | **127.6** | **21.2 N/m** |
> | span, bush to bush | 19.550 u / 7.408 mm | 79.3 | 79.3 | 150 N/m |
> | overhang, fork end | 1.350 u / 0.512 mm | 5.5 | 13.8 | 28479 N/m |
>
> (λ effective applies `SLENDER_OVERHANG_K` = ∛16 to an overhang — a
> cantilever is sixteen times the compliance of a span of the same length;
> the derivation is at the constant. k is by πr⁴/4, comparable with the
> 2518/2807 N/m figures above; the check's own column uses the rectangular
> ac³/12 and so reads 1.7× stiffer for a round shaft.)
>
> So a third bush splitting the 19.550 span moves the reported λ by **nothing**,
> and the shortfall is not 0.041: λ ≤ 30 on the rod-end overhang wants
> **r ≥ 0.5244** against the corridor's 0.2850. The waiver stands — at
> **λ 127.6**, not 135.4 — and the roadmap entry needs re-deriving around the
> overhang rather than the span.
>
> **And that overhang is a regression, not a design.** Item 16's own "Move the
> pillars" prescription asked for "a long span and short overhangs at both
> ends", and t 2.45 / 22 delivered exactly that on the chord that existed then
> (a shaft running ±12.06). §112 re-solved the rod site and the chord grew
> ≈ 9 u; the two station literals did not travel with it. The 4.5 mm / 21 N/m
> cantilever this item condemned at the fork end came back at the ROD end, at
> 4.73 mm / 21.2 N/m — the same defect, the same number, the other end, and no
> instrument said so because the only one that could had never run. Filed as
> **TODO 79**.

**Still open, deliberately: the 36:1 beak lever.** Shortening the tail arm
means re-siting the rod, whose plate bores are literals carrying drift
asserts (`ALARM_LINK_ROD_XY`), so it is a §35-corridor change, not a
section change. The tail is also the chain's remaining weakest member —
it still bends 42% of its stroke at 20 mN, against the shaft's 7% — so if
anything here gets more work, it is that lever, and the two are the same
problem: the tail is long *because* the rod is far away.

> **Two numbers in that paragraph have since moved, and the conclusion
> survives both.** The lever is no longer 36:1 — §68 re-sited the rod and
> TODO 63 measured the built arms at nose 1.395 u / tail 9.95 u, a **7.1×**
> displacement gain. And the shaft's 7% was the retired 4.5 mm span; at the
> measured 0.9286 mm overhang it is **11%** (20 mN ÷ 2518 N/m = 0.0079 mm
> against the 0.071 mm selector stroke). The tail is still the weakest
> member at 42%, so "if anything here gets more work, it is that lever"
> stands — it is now a 7.1× lever rather than a 36× one, which is a smaller
> problem than this paragraph describes, not a different one.

### Postscript — the lever was also inverted (§54 postscript 2)

Separately from the sections: `beakArm` set its aim on `rotation.z` and its
lever action on `rotation.y` under the default `'XYZ'` order, so the tilt
applied about world-Y *before* the aim. At this arm's 122.4° aim that
scaled the throw by cos(122.4°) — **negative** — inverting the lever and
costing 46% of its travel. The tail drove down onto a rod the same frame
moved up. `rotation.order = 'ZYX'` fixes it; tail tip and rod now track
1:1 (+0.19 each) with the nose falling as the tail rises.

The lay shaft twelve lines below already carried this exact fix, with a
comment explaining it. The arm did not.

### The shaft chronicle (moved home — §137)

(The four sections below were filed under item 17 by accident — a
whole shaft narrative living in the gong item. Moved here unchanged,
in their original order; §137 found them while retiring their
premise, see the measurement block above.)

### CORRECTION — the shaft thickening was REVERTED; CI rejected it

The section fix above landed for the beak tail and was **reverted for the
shaft**. Thickening it to `SLENDER_TARGET` (r 0.12 → 0.447) put it into the
minute jumper: **`Alarm link ⇄ Minute jumper`, FORBIDDEN across the whole
beat axis, overlap 0.312** — almost exactly the 0.327 the radius grew by.
The corridor has no room at all.

**Why the local evidence looked clean, and was.** An exhaustive vertex scan
puts the nearest non-contact neighbour **0.97** away and the jumper **2.86**.
Both true; both irrelevant. The minute jumper is a **MOVER**, and the
fattened shaft sits in the arc its blade sweeps. Only a swept check can see
that — which is precisely why `sweptOverlap` is a gate and a single-pose
probe is not. (An AABB probe was tried first and was worse than useless: the
shaft is a long diagonal member whose box overlaps half the movement.)

**Still standing from that work:** the beak tail is a 0.12 × 0.372 mm blade
at λ 27 (was 0.12 mm square at λ 83.7, 10.2 → 305 N/m), and the inverted
lever is fixed. Those are movement-side and unaffected.

**Reverted:** shaft r → 0.12, crank section and offset, bush bore, hanger
section. `SLENDER_WAIVERS['Alarm link']` is restored — accepted debt, not an
oversight.

**What the shaft actually needs** is a **stepped arbor**: turned down through
the jumper's sweep, full section in the free span and the drive-end
overhang. Bending stiffness is set by the span, so that recovers most of the
4075 N/m while keeping the thin sections where the corridor demands them.
That is a real change to a part with a §35-corridor history, and it wants
its own pass rather than being bolted onto this one.

### Why z cannot be stolen: the shaft threads the ring it drives

Proposed: give the shaft more z room instead of reverting. Measured, and
it does not work — but the reason is worth having, because it also
retires the wrong diagnosis above.

**The minute jumper's tail pin is not the obstruction.** Swept across
`crownPullT` and the whole setting path, it never comes closer than
**2.886** to the shaft axis. The earlier attribution came from an AABB
test on a long diagonal member, whose box spans half the movement — the
third time that instrument misled this work.

**The obstruction is the selector ring**, and it is symmetric:

| direction from the shaft plane | nearest thing | gap |
|---|---|---|
| above | `Dial/alarmSelRing` | **0.16** |
| below | `Dial/alarmSelRing` | **0.16** |

The shaft passes through the ring's own plane — the ring it exists to
drive — with 0.16 to the faces either side and a 0.12 radius, so about
0.04 of real gap. **Stealing z buys nothing**: move the shaft up and it
hits the ring's upper face, down and it hits the lower. There is no
direction to steal from, because the clearance is not a stack-up, it is a
slot.

So the fat-shaft attempt failed at the ring, not at the jumper, and the
overlap CI reported was the enlarged **bush** dropping through it.

**This settles the shape of the fix.** A stepped arbor is not one option
among several, it is the only one: turned down to something near the
present 0.12 where it threads the ring, full section in the free span and
the drive-end overhang, where the exhaustive scan shows 0.97–8.3 of room.
Bending stiffness is set by the span, so most of the 4075 N/m survives.
The neck length is bounded by the ring's own thickness plus margin.

### The stepped arbor, as designed — built, then CI-rejected (next section)

(This section recorded a CLOSED that did not survive: the design below was
built and the gates listed at its end did pass — from a session whose saved
pose had the jumper out of the star. The virgin-boot story is the next
section. The numbers stay because they are the candidate design any future
attempt starts from.)

Necked at **both** ends, full section between. Necking both rather than one
is not a compromise, it is the better shape: **both cranks sit on the thin
sections**, so their radial offsets and the whole `ROD_FOOT` chain derived
from them do not move at all, and §25's tab engagement and §35's corridor
are untouched.

| | |
|---|---|
| body | r 0.373, 20.13 u long, **λ 27** |
| necks | r 0.12 × 2.0 u at each end — as-was, where it threads the ring |
| body radius | derived from the BODY's own length, not the chord |

**Stiffness at the drive end, computed by unit-load over the stepped
section rather than assumed:**

| | N/m |
|---|---|
| original uniform r 0.12 | 21 |
| **stepped (built)** | **1387** |
| uniform r 0.373 (CI rejected it) | 1980 |

**65× the original, and 70% of the unbroken ideal.** My first note in the
code said the tip neck would cost "very little" — wrong: it is 17% of the
length but **30% of the compliance**, because I falls 93× where it is
turned down. Under a 20 mN detent the drive end now deflects **20% of the
selector's stroke**, against **1324%** before.

**Verified against the gates that rejected the last attempt:**
`sweptOverlap` 525 volumes, **0 confirmed, 0 tight, no Alarm link rows**;
`inspection` **0 FORBIDDEN**; `stockFloor` ok, 0 degenerate, 0 unwaived;
alarm link entirely off the §54 report and `SLENDER_WAIVERS` **empty**
again — earned this time rather than reverted.

Remaining in this item: only the **36:1 beak lever**, which needs the rod
re-sited and is a §35-corridor change.

### The stepped arbor was built, and CI rejected it too — read this first

Two attempts, and the second is what matters:

| attempt | shaft | result |
|---|---|---|
| uniform | r 0.447 | `Alarm link ⇄ Minute jumper`, overlap **0.312** |
| stepped | body r 0.373, necks 0.12 | the same pair, overlap **0.310** |

**Dropping the radius barely moved the number.** That refutes the
diagnosis this item previously recorded: if the shaft's SECTION were the
binding thing, 0.447 → 0.373 would have shown in the overlap. It did not.
The alarm link's swept volume enters the minute jumper's swept region *at
all*, and the depth reported is set by that region's shape, not by how fat
the shaft is. **The "selector ring is the obstruction" conclusion above is
therefore wrong** — the ring measurement was real but it was not this.

**A local `sweptOverlap` said clean at r 0.373, and the disagreement is
the lesson.** CI boots **virgin**; boot now runs `syncStart()`, which pulls
the crown — and a pulled crown puts the minute jumper **in the star**. The
local session carried persisted state with the jumper elsewhere. A swept
check is only as good as the poses it starts from, and *"it passed
locally"* meant *"it passed from my saved pose"*. Any future attempt must
be validated from a virgin boot, not a working session.

**What the next attempt needs, before touching geometry:** measure the
minute jumper's **swept envelope** along the shaft's stations, from a
virgin boot with the crown pulled. Only then is there a number to size
against. Guessing costs a 15-minute CI run per iteration, and has now cost
two.

Reverted to the section that passes CI; `SLENDER_WAIVERS['Alarm link']`
restored. The **beak tail** fix and the **inverted lever** fix stand — both
movement-side, both verified, neither implicated.
## 17. MOSTLY CLOSED (§56) — the gong's sound is not derived from the gong

`sndTone(1760, …)` + `sndTone(880, …)` — an **octave pair**, chosen
musically ("A6-ish, a small bell" says the comment). The gong's actual
dimensions imply something quite different.

Wire 0.375 mm diameter, arc radius 13.125 mm, 90° of arc = **20.617 mm
developed length**, L/d = 55. As a clamped–free steel bar (E 200 GPa,
ρ 7850, bar wave speed 5048 m/s):

| mode | frequency | ratio |
|---|---|---|
| fundamental | **623 Hz** | 1.00 |
| 2nd | **3904 Hz** | 6.27 |
| 3rd | 10932 Hz | 17.55 |

Two mismatches, and the second is the interesting one:

1. **Neither synthesised tone is a mode of this gong.** 880 Hz is 1.41× the
   fundamental and 1760 Hz is 2.83× — the geometry offers 1× and 6.27×.
2. **A struck bar's overtones are INHARMONIC.** 1 : 6.27 : 17.55, not
   1 : 2 : 3. The octave pair models a *bell*, and the reason a steel wire
   gong sounds like a "ting" rather than a pitched chime is precisely that
   its partials are not harmonically related. Modelling it as an octave is
   the one thing that removes the character being modelled.

There is also a **design** question underneath the audio one: 623 Hz is
low for an alarm. Real alarm-watch gongs (Memovox, Cricket) ring bright,
in the low kHz, because that is what carries and what wakes someone. At
these dimensions the fundamental is a low hum and the ring the ear would
actually hear is the 3.9 kHz second mode. To put the FUNDAMENTAL in
alarm territory (~2.5 kHz) the arc would need to be **45° instead of 90°**
(10.3 mm developed), or the wire 1.50 mm thick at the current length —
which is absurd for a gong. So the arc is roughly **twice as long as an
alarm gong should be**.

Closing this means deriving the tone from the geometry — `f_n = (β_nL)²
·(d/4)·√(E/ρ) / (2πL²)`, struck at the modes the hammer actually excites —
rather than picking notes. Note the hammer strikes IN-PLANE (radially at
the free end), and a curved bar's in-plane modes sit somewhat above the
straight-bar figures above, so the derivation should carry the curvature
term rather than reuse this estimate.

Filed rather than fixed: this is an audio-model change and a gong-geometry
change, and the two want deciding together.

**Mostly closed by §56.** The tone is now computed from the wire's own
dimensions and the arc is a live parameter, so the pitch tracks the
geometry (90° → 626/3922 Hz, 45° → 2514 Hz). The octave pair is gone and
the inharmonic 1 : 6.27 ratio is what is sounded.

Still open: the hammer strikes **in-plane**, and a curved bar's in-plane
modes sit above the straight-bar figures used here — `gongModes()` should
carry the curvature term. And the DESIGN question is now exposed rather
than answered: the 90° default still rings low for an alarm; whether the
default arc should move to ~45° is a decision, not a bug.

## 19. CLOSED — the selector's sensing pin never touched the ring it read

**Closed 2026-07-29.** Three defects, one contact — the third was found
only when the fix for the first two made it measurable:

1. `rotation.order = 'ZYX'` set, so the see-saw tips about the
   tangential axis §34 specifies (the §54 beak-arm trap).
2. The fitted `0.12` amplitude is GONE: the rocker's angle is now
   solved per tick from the contact constraint itself — the pin's cap
   on the ring's riding face, `A·sinθ + B·cosθ + C = faceZ(T)`, the
   three constants captured once from the built geometry (an exact
   three-probe fit of the rotation's true form, not a regression) and
   the face plane derived from the REST constants, never the live mesh
   (a restored session's first tick can find the ring armed — §34's
   canonical-state lesson). Two passes aim the flat cap's leading EDGE,
   the way the heart follower iterates its cam contact.
3. **The pin was built pointing away from the face.** The dialFace flip
   maps rocker-local −z to world +z, so the pin hung toward the
   movement, its ROOT cap doing the grazing and the ruby decorative —
   and with the old under-rotating law the arm itself entered the
   ring's slab when armed. The pin is re-hung THROUGH the arm,
   protruding 0.06 on the ring side (derived: > the ±0.03 hand-off
   tolerance, so pin-contact and arm-clearance are distinguishable
   measurements).

Measured after: pin⇄ring **−0.0007 disarmed / −0.0024 armed** (kissing,
edge contact), arm clear of the annulus 0.04–0.08 at both parities.
The `alarmHandoffs` row and the `Alarm disc ⇄ Alarm selector`
penetration budget are both UNWAIVED — a regression fails the gate.
Fingerprint moved deliberately, 1974757747 → 2748333645, re-verified
across two virgin boots.

The original filing follows, kept for the record:

### (original text)

The §34 design hinges on one interface: the rocker's ruby pin riding the
selector ring's face — "the one contact a fixed member can make on a
co-rotating one at every azimuth". Measured (BVH signed separation, both
parities, virgin-boot geometry): the pin is **buried 0.024 in the ring
disarmed and 0.062 armed**. It does not ride the face; it passes through
it, and the burial *changes* with state, so it is not even a constant
registration error.

Two causes, both in the tick's rocker law
(`alarmRocker.rotation.y = -0.12 * (alarmSelShownT * 2 - 1)`):

- **The rocker never sets `rotation.order`.** Its group carries
  `rotation.z = ALARM_ROCKER_AZ` (−155°), so the default `'XYZ'` order
  makes the tick's `rotation.y` tip it about the tube-frame Y axis, not
  the tangential axis the §34 design comment specifies. This is the §54
  postscript's Euler-order trap, fixed for the beak arm
  (`beakArm.rotation.order = 'ZYX'`, `main.js`) and unfixed here, twelve
  hundred lines away.
- **The amplitude `0.12` is a bare literal** (rule 1 failure). Worked
  through the actual frames, the pin's z-travel over the full toggle is
  **0.152 against the ring's 0.19** — 20% short, so the pin cannot stay
  on the face at both ends no matter where it starts. And the sign is
  right only by accident: `cos(−155°)` flips the throw, so correcting
  the Euler order *alone* sends the pin **up** while the ring goes down
  (separating by 0.358). The coefficient was fitted to the render with
  the bug in place.

The fix must therefore do both at once: set the pivot axis honestly
(`'ZYX'`, per the §54 precedent) and derive the amplitude from the
geometry it serves — pin arm reach and ring travel — with the constraint
in the comment. Until then the row is **waived, not passed**: the
`alarmHandoffs` check and the tightened `Alarm disc ⇄ Alarm selector`
penetration budget (was 0.12, now `HANDOFF_TRACK_TOL`) both carry this
item as accepted debt.

## 20. CLOSED — the arming run is driven from its input, contact by contact, from the pawl to the ring

The original filing said §35's arming run was "false as implemented, and
not by one defect but as the run's *architecture*" — every member posed
from the one scalar `alarmSelShownT`, causality reversed at the head. That
was true. It is now false in every link, closed 2026-08-04 with the last
one.

**The chain, input to output.** A press drives the head in at a finger's
rate; the pawl's travel carries the column wheel about its own moment arm
until the tooth completes; the click banks it; the beak rides the cam the
flank actually cut and falls when a gap arrives; the rod rides the beak's
tail through its lever ratio; the rim finger follows its contact with the
rod's foot by envelope solve; the ring stands where the fork's groove holds
its pin. `alarmSelShownT` is a READOUT of the ring's travel, `alarmColSteps`
a readout of the wheel, `alarmOn` a readout of the parity. Nothing in the
run carries a time constant of its own — the only rate left is how fast a
finger presses.

**The last link, and why it could not be closed until now.** The wheel's
angle was eased toward a counter:

```js
const colTarget = alarmColSteps * ALARM_COL_STEP;
alarmColShownA += (colTarget - alarmColShownA) * (1 - Math.exp(-rawDt / 0.10));
```

`pressAlarmPusher()` incremented the counter and the wheel wore the answer.
Replacing that needed the pawl to be able to finish a tooth, and for most of
this item's life it could not: the hand-set throw of 0.7 carried 83% of one,
so a pawl-driven wheel would have stalled mid-index. §68 sized the wheel to
real chronograph scale (Ø 4.32 mm) and TODO 11's switch tranche derived
`ALARM_PUSH_TRAVEL` from the tooth pitch arc — and only then was this
arithmetic available. `ALARM_PAWL_SWEEP` now asserts it so it cannot regress
silently.

| quantity | value |
|---|---|
| moment arm, wheel axis → pawl's line of travel | 4.376 (`ALARM_PUSH_CHORD`) |
| one press carries (`travel / arm`) | 0.6147 rad |
| one tooth (`ALARM_COL_STEP`, 12 saw teeth) | 0.5236 rad |
| delivered | **117% of a tooth** |

The press also had to become a STROKE: it snapped `alarmPusherT` to 1, which
left the pawl nothing to carry the wheel through. Measured after — the carry
is LINEAR at 0.0854 rad/frame, exactly `(1/60)/0.12 × 2.690/4.376`, latching
at one step, where the old ease was exponential. Battery 13/13, boot silent,
fingerprint unchanged at 3682902459 (the geometry did not move; only what
drives it).

`setPose` still lands the parity exactly and now lands the click's station
with it — without that the next tick reads a held angle from before the pose
and walks the wheel back.

**Postscript, 2026-08-04 — the one time constant that survived this close.**
"Nothing in the run carries a time constant of its own" was true of every
member except the pusher's own return, which decayed
`alarmPusherT *= Math.exp(-rawDt / 0.15)` — a rate derived from nothing, and,
worse, an ASYMPTOTE. Two readers ask "is the head still off its seat?" by
testing `alarmPusherT > 1e-6`: `pressAlarmPusher`, to refuse a second press,
and the tick, to re-arm the click on the next tooth. Against an exponential
that threshold is not a position, it is a TIMEOUT of `0.15·ln(1e6)` = 2.07 s.
Measured on the shipped tree, a second press landed at a 2.0 s gap and was
swallowed at every gap ≤ 1.5 s — with the head sitting visibly home and no
feedback of any kind. That was the whole of "the alarm pusher doesn't work
consistently". The return is now a SETTLING TIME derived from the stroke it
undoes — `ALARM_RETURN_S = ALARM_PRESS_S`, an unloaded return spring being at
least as fast as a deliberate press — decaying linearly and clamping ON zero,
so the threshold means what it reads. Measured after: both presses land at a
0.24 s gap (stroke + return, as designed) and the second is refused below it.
The only rate left in the run is now genuinely how fast a finger presses.

**What is NOT claimed.** This is a kinematic chain, not a dynamic one: no
force, friction or spring rate appears anywhere in it, and the pawl "carries"
the wheel because the geometry says where the contact goes, not because a
force was integrated. The run is *driven* in this repo's sense — causality
enters at the input and arrives at the output through contacts that measure
shut — and that is the whole of what the word claims here.

**A note on this entry's history**, because it cost real time twice. Every
stale claim in it shared one cause: numbers written against a tree that then
moved underneath them. The "~0.84 tooth arc, marginal" figure predated the
wheel reaching its position bound; the 2026-08-03 reconciliation was itself
first drafted against a rolled-back checkout, asserted a hand-set 0.7 that
had already been derived away, and had to be re-measured. Quote a measurement
with its date and the tree it came from, or expect to re-take it.

## 21. CLOSED — the hour wheel went dial-most, and the 12:1's first mesh stopped happening through the tube

Found by `checkExpectedContacts`' first run (item 6's structural fix),
proven analytically with a containment sampler, invisible to every
instrument before it and to two deliberate measurements:

- The hour tube spans world z −11.60..−2.78 (hour wheel plane → hands),
  wall r 2.05..2.50 — THROUGH the minute wheel's band (−4.75..−3.82)
  and the minute star's (−3.67..−3.40).
- The minute wheel's teeth reach within r 1.20 of the dial axis (tip
  circle 4.8 about the stud at 6), the star's likewise — both cross the
  tube's wall: **264 wheel vertices and 304 star vertices inside the
  wall band, 0.22 deep, at rest, at every pose.**
- The cannon ⇄ minute-wheel mesh — the 12:1's first stage, §29's "real
  mesh" — therefore happens THROUGH the tube's wall: the wheel's tips
  interleave with the cannon's leaves at r 1.2–1.8, inside the tube's
  bore, having passed through its wall to get there.

**Why nothing ever saw it.** The pair sweep: `['Hour wheel', 'Motion
works']` is EXPECTED for the 12:1's second mesh — blanket immunity
(item 6, fifth confirmed defect of that class). Item 6's own probe:
vertex-based — a tooth tip standing in the bore's open air measures a
POSITIVE distance to the wall its flanks crossed, so the sweep reported
"0.0084 clear" over a standing intersection. The eye: buried at r 2 in
the centre stack behind the dial, occluded from both sides.

**The architecture is the defect.** In a real watch the hour wheel sits
DIAL-WARD of the minute wheel: its tube rises from its own plane toward
the dial and never shares z with the minute wheel's teeth. Here §29's
z-chain lands the hour wheel PLATE-WARD of the minute wheel (MW_Z2
below MW_Z1), so the tube must cross the minute wheel's and star's
bands to reach the hands — and no radius can thread that crossing (the
teeth reach 1.2; any tube is fatter). Candidate fixes, in order of
honesty:

1. **Re-stack the motion works the real way**: hour wheel at the
   dial-most plane (MW_Z1 and MW_Z2 swap roles), tube rising clear of
   both toothed bands. Touches the §29 chain, the star's slice, the
   cannon's length, and every consumer of MW_Z1/MW_Z2 — a §-scale
   re-derivation, but the chain is derived precisely so this class of
   move can be made (the §45 stage-0 precedent, again).
2. A crescent relief in the wheel/star at the tube's azimuth is NOT
   available — both parts rotate; the crossing is at all azimuths in
   turn.

**CLOSED** by candidate 1, the re-stack. The chain now lands on the HOUR
wheel — one margin plus its own bevelled half-thickness below the disc body
— and the minute wheel hangs the same 1.5 behind it, so the tube rises from
the dial-most plane and crosses nothing that is not coaxial with it. What
made this affordable is that the alarm stack above IS coaxial (every bore ≥
`ALARM_TUBE_INNER` = `HOUR_TUBE_OUTER` + 0.1): the tube was always allowed
through that band, and never through the two parts on the offset stud.

Measured after, same sampler as above: **0 vertices inside the wall band,
from 568**; the tube spans −12.66..−4.28 instead of −12.66..−2.78. Boot
silent, battery 13/13, `inspection` down to 72 contacting pairs from 74, and
`expectedContacts` at **0 waived** — that row's waiver is DELETED, not
renewed, which is what closing an item is supposed to look like.

Three consequences worth knowing, because each removes a future footgun:

- `CANNON_T` is DERIVED from the plane it must cover. It had chased the
  chain downward by hand five times (2.0 → 2.1 → 2.5 → 2.9 → 3.35 → 4.25)
  and this re-stack would have been the sixth. The leaves now reach past the
  minute wheel and are the deepest thing on the centre axis, so that end has
  its own floor against the plate, asserted.
- The star slice changed SIDES and is now named for the faces that bound it
  (`_mwSliceBot`/`_mwSliceTop`) rather than for the parts, so a future
  re-order cannot leave it reading backwards while still computing a
  positive thickness.
- `MW_TOP` names the motion works' dial-most face once. The two band asserts
  that each re-spelled that expression consume it, so they follow a re-stack
  by construction instead of silently guarding the wrong wheel — which is
  the specific way this defect stayed invisible.

## 22. CLOSED — the press axis rides above the wheel; the stem's end is press-swept derived

Found by `intraUnit`'s first run (item 5's interim), confirmed by
direct per-mesh measurement and by screenshot: within the Alarm switch
unit, the pusher's press bar (`CylinderGeometry#9` — a 4.15 × 1.8 ×
0.64 slab at roughly (−41.2, 14.3), z 8.70..9.34) runs toward the
column wheel and its end face stops **0.9 from the wheel's axis** —
well inside the wheel's disc silhouette, in the disc's own z band
(8.94..9.26 vs the bar's 8.70..9.34). The wheel's crown torus
(`TorusGeometry#12`) shares the band and overlaps the same bar. Two
parts of one action group (§43's pusher → pawl → column chain)
occupy the same matter at every pose; no inter-unit sweep could see it
(item 5's exact blindness — both meshes live in one unit).

This is a P2 finding — the group disagrees with itself — so the fix is
in mechanism space, not a waiver-forever: the press geometry (§43)
must end the bar CLEAR of the disc, either by shortening the bar to
stop at the pawl it actually presses (the bar's job ends at the pawl
tail; nothing it does requires reaching the wheel) or by dropping the
bar's z to a stratum the disc doesn't occupy, re-deriving the pawl
contact height with it. Until then the two `INTRA_UNIT_WAIVERS` rows
in `src/inspect.js` cite this item; closing it deletes both.

**Closed 2026-08-01, absorbed into TODO 11's switch tranche.** The press
AXIS now rides above the wheel's whole stack (castellation top + margin
+ stem radius, derived), so stem and guide boss can never meet the
wheel at any press depth; the stem's inner end carries the full press
travel's radial clearance for its pawl dropper; the pawl reaches the
skirt on a real carrier (dropper + reach bar). The travel itself is now
derived — one ratchet tooth arc at the saw tips (was a hand-set 0.7
that under-swept even the old wheel). Both waiver rows deleted;
`intraUnit` measures 0. The same tranche took the wheel to its POSITION
BOUND (tip = plate edge − margin, Ø 1.9 mm), real feature depths
(base 0.21 mm, tier 0.30 mm), and derived the click's arm length,
bear point, and every rider z-station from the wheel's named constants.
Full real scale (Ø 4+ mm) is blocked by the station itself — the
wheel's centre stands 2.95 from the plate edge — recorded in TODO 11
as layout work (§33 machinery), not absorbed here.

## 23. CLOSED — bearing-cock arms end at their rings; the lifter's lower guide was evicted by measurement

Item 5's interim surfaced this as a CLASS on its first full run: a
bearing cock is modeled as post + arm + bush, the bush RING carries a
real bore around the running member — and the box ARM behind the ring
runs all the way to the axis, uncut, because `BoxGeometry` cannot
carry a hole. The member the cock exists to bear therefore passes
through the arm's solid matter at every pose. Two stations, nine
measured overlaps, all waived in `INTRA_UNIT_WAIVERS` citing this
item:

- **Alarm setting arbor** (the §25 C lower cock): the arm (1.4 × 0.7
  × 0.3 at bush z −6.3) spans post → arbor AXIS, so the 0.4-radius
  rod runs through its end — the bush ring beside it (bore 0.45) is
  the only part actually cut. And the disc bevel's teeth bottom at
  −6.16 against the arm's top at −6.15: a 0.01 graze, because
  `BUSH_Z` was derived against the pinion below ("top −6.70 with
  clearance to spare") and never against the bevel above.
- **Alarm release lifter** (the §45 guide bracket): BOTH guide arms
  reach the plunger's axis — the eyes' 0.17 bores (0.02 running
  clearance over the 0.15 plunger) are decoration on solid arms. The
  head and plunger pass through the upper arm's end, the plunger
  through the lower's; and the lower guide's whole assembly shares z
  with the moving stub/blade stack (stub into the lower arm and eye
  face by 0.04 at rest, blade across the arm's top corner by 0.03 —
  growing with drop travel).

The fix is derivation, not nudging (rule 1): an arm ends at its
ring's OUTER radius (`armLen = span − ringROut`, butting the ring it
carries), and a guide's z-station derives against EVERY moving
neighbour that crosses it — both the pinion below and the bevel
above for the setting cock, the stub/blade stack's full travel for
the lifter's lower guide. Closing this item deletes the nine waiver
rows; `intraUnit` then measures the repair.

**Closed 2026-08-01.** Both stations re-derived, one member evicted:

- **Setting cock**: the arm now spans bush-ring outer wall (0.85) →
  post (outer end unchanged), so the rod runs only through the ring's
  real bore; and `BUSH_Z` derives as `bevel underside (−6.158, tooth
  tips out to r 1.41) − CLEAR_MARGIN − stock/2` — the first cut's
  −6.3 was placed against a stale pinion reading ("top −6.70"; the
  built pinion's top is −7.99, 1.38 below the new station).
- **Lifter**: the upper guide arm ends at the eye ring's outer wall
  (0.49). The LOWER guide could not be re-derived into legality: the
  corridor between the blade stub's swept bottom (−5.68) and the
  run's swept top (−6.09) is 0.413, and the guide's 0.32 stock plus
  two `CLEAR_MARGIN`s needs 0.62 — no z-station exists. It was
  matter that could not do its claimed job (its bore was crossed by
  the stub at rest), so it was REMOVED; guidance keeps two stations
  without it (the plunger eye, the run's cheek mid-guide).

All nine waiver rows deleted; `intraUnit` measures the repair (0
unwaived, only item 22's two rows remain). The class lesson stands in
MODELING.md's territory: a box cannot carry a bore — model the arm to
the ring, never through it.
## 25. CLOSED — the spring is cut to the balance, and the beat is a consequence

Rule 2 says angles travel the gears, and the train obeys it — every wheel
angle is a closed-form function of the escape wheel's, arriving at 12:1
because tooth counts multiply to it. The OSCILLATOR does not obey the same
principle. `F_BALANCE = SPEC.vph / 7200` (`layout.js`): the frequency is
declared, and `balanceTheta(tau) = amp * sin(2*pi*F_BALANCE*tau)` reads it
back. Nothing in the codebase computes a moment of inertia or a spring
rate; grep for `inertia` returns one comment about the alarm hammer.

So the balance wheel is MODELLED and not SIMULATED, in exactly the sense
the README now defines: its rim, its 2.5 mm section, its timing screws and
its arms are real geometry that contributes NOTHING causally. This is the
escapement's version of `hourAngle = minuteA / 12` — the shortcut rule 2
exists to forbid, surviving in the one place the train's discipline never
reached.

**Measured, 2026-08-02.** Booting the movement at balance radii 9 / 10 /
11 / 12 / 14 (everything else untouched) changes the beat not at all: the
watch keeps 18 000 A/h at every size, because the rate never consulted the
wheel. A real watch does the opposite and loudly — period is
`2*pi*sqrt(I/k)`, and for a rim-dominant wheel `I` climbs about with the
CUBE of the radius (rim mass grows with radius, and each gram sits further
out), so a third again of radius would run the watch grossly slow until
the hairspring was re-sprung to match. That trade is the whole reason
balance size is a design decision: more inertia buys rate stability
against disturbance, and is paid for in torque and reserve.

What the same sweep DID break is instructive by contrast, and belongs to
layout rather than to this item: at +11% the three-quarter plate's cut
(sized `balanceR * 1.35`) reaches a pivot it has to carry; at +33% the
plate grows and pulls the alarm winding train out of mesh (item 15's
asserts fire); at +56% the fork cock finds no footing and boot fails. The
escapement itself follows a bigger balance without complaint — `rollerR`,
the escape-to-balance distance, the lever, the notch and `FORK_BANK_DEG`
all re-derive, and the bank moves only 2.57 deg to 2.35 deg from R 9 to
R 12, because it is a ratio of two quantities that both scale.

**Two tiers, and the first is cheap.**

- **Tier one, a TRIPWIRE (report, do not drive).** Compute `I` from the
  built balance (rim annulus at `BAL_T` 2.5 and `balanceR` 9, plus the
  timing screws as point masses at their own radii) and `k` from the built
  hairspring (`makeHairspring`: ribbon section, `coils` 10, `innerR`
  ~1.5, `outerR` `balanceR * 0.88`, developed length from the spiral), in
  SI through the section 39 unit pin (`UNIT_MM` 0.379) and a declared
  steel density and modulus. Report the IMPLIED frequency beside the
  spec'd one and warn when they disagree by more than a stated tolerance.
  This is the section 54 move — file the arithmetic, let the number
  argue — and it converts "the balance is decoration" into a measurable
  claim without touching the layout contract.
- **Tier two, DERIVE.** Make the spec's vph a TARGET rather than an
  input: the hairspring's developed length (or section) is solved so
  `sqrt(k/I)` lands on it, the way a regleur actually vibrates a balance
  to a spring. Then a bigger balance genuinely runs slow until re-sprung,
  and the sweep above becomes a real experiment rather than a null one.

**The trap that makes tier two a layout change, named so nobody
discovers it mid-fix**: `F_BALANCE` is a LAYOUT INPUT, not a leaf. The
train's tooth counts are derived from it (the fourth wheel must turn once
a minute at whatever the beat is, see layout.js), so reversing the
dependency touches `SPEC.md`'s contract and `solveLayout`. Tier one has
no such reach and should land first regardless.

**Adjacent, in the same honesty family**: `AMPLITUDE_VISUAL_DEG` 45 is
what the mesh performs while `AMPLITUDE_TRUE_DEG` 270 is the physical
reference nothing consumes. Any inertia arithmetic must state which
amplitude it means, and a derived rate would make the true swing
consumable for the first time.

**Tier one LANDED (2026-08-02) — and the number it produced.** The
arithmetic is built and reporting: `makeBalanceWheel` and
`makeHairspring` now publish the dimensions a rate is computed from
(`rim`/`arm`/`screws`, and `devLen`/`section`), main.js weighs them into
an `OSCILLATOR` payload, and the inspector's `oscillator` check reports
it. Measured, from the built geometry:

| Quantity | Value |
|---|---|
| `I` (rim 84.7%, screws 10.5%, arms 4.8%; neglected 0.38%) | 5.00e-10 kg·m² |
| `k` (rhombic section, E 200 GPa) | 1.68e-6 N·m/rad |
| **implied f = √(k/I)/2π** | **9.23 Hz** |
| spec'd `F_BALANCE` | 2.5 Hz |
| **ratio** | **3.69×** |

**The wheel is not the problem.** 5.0 mg·cm² is a realistic inertia for
a 6.8 mm balance, and the spring rate a regleur would fit to it —
1.23e-7 N·m/rad — is a realistic hairspring rate. The disagreement is
almost entirely the SPRING'S SECTION, and it is legibility debt, not
physics debt: `ribbonR = max(((outerR − innerR) / coils) · 0.12, 0.05)`
sizes the ribbon at 12% of the coil gap so the spiral READS on screen —
0.058 mm thick where a real hairspring runs 0.02–0.04 mm (the figure
`layout.js`'s own §50 spring-floor citation already carries) — and
thickness enters `k` CUBED. A second, smaller factor is that the cut
section is a RHOMBUS, not the rectangle a `b·h³/12` would assume:
`TubeGeometry(..., radialSegments 4)` puts the 4-gon's diagonals on the
Frenet normal and binormal, so the true second moment is `a³c/3` — a
quarter of the bounding rectangle's, and the honest number to use.

So the rate is 3.69× high because the spring is 13.6× too stiff for its
wheel. That is written here rather than tuned away, which is tier one's
whole point: **no constant of the balance or the spring was touched**.

**Where the two numbers live, and why not in one place.** Rule 6 forbids
a boot that warns forever, and a spec-vs-implied warn would do exactly
that. So the comparison against the spec is an inspector ROW
(`I.start(__clock, 'oscillator')`) — report-only, `agrees: false`,
citing this item, the §50 arc — while the BOOT tripwire guards
regression instead of agreement: `OSC_F_IMPLIED_RECORDED` pins the
implied rate as built, and boot speaks only if reshaping the balance or
spring moves it more than 0.5%, which is rule 6's own semantics. It is
pinned to `f_implied` and not to the ratio, because `?vph=` moves the
spec while the geometry stands still. Verified by negative test:
`radius: 10` warns with 9.0931 against the recorded 9.2308 and is the
only thing that makes it speak.

The check also re-measures the METAL against those published dimensions
(rim radii and height; the ribbon's radius against the scale that stands
it on edge), because `userData` is a claim about geometry and a claim
that stops matching is the drift every other check here exists to catch.

**What tier two now owns**, unchanged by this landing: solving the
spring's section or length so `√(k/I)` lands on the spec'd beat, at
which point `checkOscillator` flips from report to gate (its payload is
already gate-shaped — `agrees` plus its numbers) and `OSC_F_IMPLIED_RECORDED`
is replaced by the spec comparison. The layout-contract trap above still
applies.

**Tier two LANDED (2026-08-02) — CLOSED.** The spring is now fitted to the
wheel. The build order runs balance → inertia → SOLVE → spring: `OSC_I` is
computed from the dimensions `makeBalanceWheel` publishes, the rate the spec
demands of that wheel fixes `k = I·ω²`, the spiral's own developed length
(a function of the coil plan alone — `hairspringDevLen`, exported so the
solve can ask before the spring exists, and no circularity because length
never depended on section) fixes `I_sec = k·L/E`, and the rhombic section
`I_sec = a³c/3` gives the ribbon's radius as a cube root.
`HAIRSPRING_RIBBON_R` is that solve. The legibility rule it replaced —
12% of the coil gap — survives only as `makeHairspring`'s fallback for
callers with no rate to hit.

**The number it produced, and why it is the honest one**: 0.0244 mm thick,
inside the 0.02–0.04 mm window §50's spring floor cites in its own basis.
The rate arrives at 2.5000 Hz — not as a claim, as an arithmetic
consequence. The fear that drove the old constant (a real hairspring is too
thin to see) was tested before it was believed: rendered at the solved
section the spiral still reads clearly.

**A bigger balance is now a real design question**, which was the whole
point of the item. Swept with the solve live: R 9 → I 5.00e-10, ribbon
0.0244 mm; R 11 → I 9.30e-10, ribbon 0.0318 mm; R 12 → I 1.22e-9, ribbon
0.0357 mm — the wheel grows, the spring thickens to match, and the watch
keeps time, exactly as a re-sprung watch would. Past that the ribbon leaves
real hairspring stock and the build says so rather than clamping. (The
LAYOUT still fails first — the plate cut at +11%, the alarm train out of
mesh at +33%, the fork cock footless at ~+45% — so both walls now exist and
are separately reported.)

**The instrument changed shape with it.** `checkOscillator` is a GATE now,
not a report (§50's arc completed), and it joins the battery — 13 gates.
It fails on three things: the solve not delivering the beat, the ribbon
leaving real stock, and `userData` drifting from the metal it describes.
The tier-one boot tripwire (`OSC_F_IMPLIED_RECORDED`, which pinned a
disagreement against regression) is GONE — there is no disagreement left to
pin, and the boot assert now says the plainer thing: if the solved spring
does not deliver the spec'd beat, the section was solved against a spiral
plan the built spring no longer has.

**The fingerprint moved** (2476672552 → 641449485), correctly and for the
first time in this item's history: tier one weighed the metal and changed
none of it; tier two re-cut the spring.

`SPEC.md`'s gear-train section now says the beat is a target the oscillator
is built to hit rather than a number the movement is told, and CLAUDE.md's
rule 4 carries the new gate. Rule 2's discipline finally reaches the
oscillator: the rate travels the metal.

**Acceptance.** Tier one: a boot-time report (or inspector row) that
states the balance's implied frequency from its own geometry, agreeing
with the spec'd 2.5 Hz within a declared tolerance, with `I`, `k` and
every material constant derived and commented per rule 1 — and the
disagreement, if there is one, WRITTEN DOWN here rather than tuned away.
Tier two: `F_BALANCE` consumed from the spring/balance solve, the sweep
above re-run to show the rate actually moving with radius, and SPEC.md's
gear-train section updated to say the beat is a target the regulator
hits rather than a number the movement is told.

## 26. CLOSED — the dial is a plate, and the wells are pockets machined into it

The dial is a zero-thickness sheet: one `ShapeGeometry` plane, measured at
world z −8.40, with the applied markers and the minute track laid on its
front and everything else behind it. A real dial is a brass plate about
0.35–0.5 mm thick — at §39's pin (0.379 mm/unit) that is **1.0–1.3 units**
of matter this movement does not have.

**What the fiction is paying for.** The dial-side stack is packed against
that plane with a 0.05 gap: `ALARM_SET_Z = Z_DIAL + 0.05 + ALARM_SET_T/2`
puts the alarm setting train's gear band at −8.35..−8.17, five hundredths
behind a dial that occupies no space at all. Measured, the slab a
flat-backed dial of even HALF real thickness would fill (−8.40..−7.90)
currently contains **fifteen units**: the alarm setting train, selector,
disc, release sleeve, feeler and silence rocker, both sub-dial hands, the
minute jumper, the heart cam, the setting lever and the power-reserve
train. They are not badly placed — they are placed correctly against a
dial that isn't there.

**The sub-dial wells are the tell.** They are the ONE piece of dial
furniture modelled at its true depth: `makeDial` builds each well as a
floor sunk `subdialRecess` (0.5) behind the sheet plus a cylindrical wall
bridging −8.40 → −7.90. That is a recess drawn as a PROTRUSION, which is
the only way to sink something into a plane with no thickness. And because
the wells alone reach back into the works' lane, they alone collide with
them — which is exactly the wall §76 hit: the alarm setting run's corridor
audit reports i1 fouling the reserve well's ring at −1.62 to −3.34 for
every corner azimuth but the shipped one. The wells are not an unlucky
obstacle. They are the dial's thickness, showing up in the one place it
was modelled.

**Why this is an honesty item and not a feature.** Nothing here is
missing; something here is LYING. A dial you can see through in section,
whose sub-dials hang off the back like cups, is not how a watch is built,
and the layout it permits — a setting train 0.05 behind the dial — is a
layout no real movement could assemble.

**What a fix costs, measured before filing.** The dial cannot simply grow.
Backwards it swallows those fifteen units. Forwards (−8.95..−8.45) it
meets its own applied markers, the alarm setting ring (a real part riding
the dial face, out to r 20.4), the hour tube and the power-reserve hand.
So giving the dial its thickness IS a dial-side re-stratification — §51's
move, one stratum further out — and the honest sequence is:

1. Decide the dial's true thickness and its FLAT back plane (a real plate:
   front face carries the markers, back face is one z for the whole dial,
   sub-dial recesses cut INTO the front and never through).
2. Re-derive the dial-side z-chain from that back face the way §51 derived
   the alarm band from the wheel's plate-side face — every consumer of
   `Z_DIAL` re-solved, not nudged.
3. Delete the wells' protruding wall/floor construction in favour of a
   recess within the plate, at which point §76's wall one may evaporate on
   its own: with the wells no longer reaching into the works' lane, the
   alarm setting run's corridor is bounded by the dial's back face alone.

**LANDED 2026-08-02 — the dial is matter.** `DIAL_T` = 0.4 mm / `UNIT_MM` =
1.056 u, derived from real brass dial stock (0.35–0.5 mm) with its floor
stated where it is minted: a dial must be at least as thick as the recess it
carries, or the wells punch through its back — the defect this item filed.

The plate grows FORWARD, into z in front of the dial that nothing was using,
so its BACK FACE lands on `Z_DIAL` — the datum every dial-side work already
stands off — and **nothing behind the dial moved**. The re-stratification
this entry feared was not needed; the z budget grew instead. Measured: plate
−9.456..−8.400, well floor −8.96 (was −7.90, protruding 0.5 past `Z_DIAL`
into the alarm setting train's lane).

**Three findings came out of it, each the same lie in a different place.**

1. `dialFace` was TWO FRAMES WEARING ONE NAME — the dial's furniture and ten
   dial-side WORKS that merely borrow its flipped frame. Moving it shifted
   the works and broke the §35 registration and §37's tab stop by exactly
   `DIAL_T`. The furniture has its own frame (`dialPlateFace`) now.
2. EVERY ARBOR THAT CROSSES THE DIAL GREW — hour tube, small-seconds hub,
   reserve indicator arbor, and the alarm tube. That last one is the
   instructive case: it is ONE part spanning the dial, flange and sensing pin
   working behind, hand read in front, so a thicker dial makes it LONGER.
   Moving it whole instead pulled the sensing pin |1.02| off the selector
   ring against a 0.709 budget, which TODO 19's rocker rows caught.
3. THE ALARM INDEX WEDGE stood 0.175 PAST the dial's plane — free through a
   sheet with no substance, a collision against a plate. Its tip is bounded
   by the dial's back face now, derived rather than hand-set.

**And the payoff, which was the point.** With the wells living inside the
plate's own thickness, they are 0.606 clear of the alarm setting run's lane
— so the corridor audit's well-ring walls, a 2D test that never knew about
z, were measuring a wall that is no longer there. Gated on the measured
overlap (not deleted: move either stratum back into contact and it wakes
up), and the alarm crown corner is FREE at azimuths it could never occupy:
45°, 90° and 120° all boot silent where every one of them used to foul the
reserve well by −1.2 to −3.3.

That takes down §76's wall one. Measured with the corner at 90°: a balance
at **R 10 boots silent** (+11%) and **R 11 boots silent** (+22%), where both
warned twice before — and §76's own acceptance line asked for R ≥ 10.8. The
spring re-solves to each wheel (0.0281 / 0.0318 mm, inside real stock, 2.500
Hz). R 12 reaches §76's wall TWO, the alarm winding train's mesh, which this
item never claimed.

**Do NOT waive this by widening the setting run's clearances** — the run
is correctly placed for the dial it was given. The dial is the defect.

Filed rather than fixed because step 2 is the whole dial side, and doing
it under a §76 balance-growth banner would bury an architectural change
inside a layout experiment. §76's wall one now cites this item.

### The two rows that kept it MOSTLY closed — both paid, 2026-08-06

They were filed as: the sub-dial apertures are still through-holes with a
floor hung in them rather than a blind pocket machined into the plate, and
the dial's thickness is one constant rather than a profile. Neither reached
into a lane, so neither was load-bearing — which is exactly why they are
worth reading as a pair: what closed them was not clearance work.

**1. The wells are pockets now.** The plate was an `ExtrudeGeometry` of the
PRINTED outline, and an extrusion cuts one outline clean through — so every
sub-dial was a hole all the way to the back, with the painted floor hung in
it as a separate sheet. Giving the dial thickness had moved that sheet
forward without ever making it matter. `makeDial` builds the plate surface by
surface instead: front and back flats, rim, and per well a pocket sunk
`SUBDIAL_RECESS` 0.5 into the FRONT, leaving **0.556 u (0.21 mm) of brass**
behind each one — the floor `DIAL_T` was minted to guarantee and never
actually had. Measured on the built mesh, 4000 points sampled across the
plate's own box: **73.2%** land inside the solid, against **68.0%** for the
same outline cut through at the wells — the 5.2 points being precisely the
two pocket columns that had no brass in them. The solid's volume, by the
divergence theorem, is 4798 u³ = **261 mm³**, which is a number only a closed
mesh has at all.

The pocket floors are pierced by ONE bore, and it is derived rather than
literal: **1.05 = 0.9 + CLEAR_MARGIN**, the seconds display arbor's hand hub
being the larger of the two members that pass a floor (the reserve indicator
arbor is 0.4). The old floor sheet's hole was a flat 1.0 with a comment that
the hubs are "r ≤ 0.9" — 0.10 of clearance where the movement's one margin
says 0.15, in a sheet with no depth for it to matter through. Both radii are
named constants now (`SECONDS_HUB_R`, `RSV_HAND_ARBOR_R`) consumed by their
own build sites, so the hole cannot drift from what goes through it. Nothing
else crosses that band: swept by clipping every triangle edge in the scene to
the pocket-floor→back slab inside each well circle, exactly two bodies appear,
those two, at r 0.9 and r 0.4.

**2. The plate is thinner at its rim — by the profile a dial really has.**
The filing guessed at a taper. A dial plate is parallel-faced over its field;
what it carries at the rim is an EDGE BREAK, the chamfer that takes the arris
off a turned brass edge. `DIAL_EDGE_BREAK` = 0.05 mm = 0.132 u, off both
faces, so the rim's straight land is 0.792 u (0.30 mm, 75% of stock) and the
front flat stops one break short of nominal — the printed sheet and the
applied chapter ring end there with it, since both are finish laid ON that
flat. `makeDial` boot-asserts the rule (the break must leave a land, the
pocket must leave a floor) rather than the numbers. The stepped and sector
dials that really are thinner in places are a STYLE, not this dial; its
raised chapter ring stays applied, which is the other real way to get that
look.

**Three things came out of the build.**

1. WATERTIGHT IS NOT THE SAME AS CLOSED. A plate with blind pockets cannot be
   extruded, so it is assembled from caps and walls — and two different
   tessellations of one circle (a 96-gon cap against a 48-gon wall) leave
   chord-shaped slivers that a parity raycast walks straight through. That is
   the open-mesh trap one step on: a mesh can be closed as authored and still
   leak at a seam its two halves disagree about. Every circle in the dial is
   now generated ONCE and shared by the cap that ends on it and the wall that
   starts from it. Verified the way the trap deserves: 4000 points across the
   plate's box, five ray directions each, **0 disagreements**.
2. A HOLE MUST BE CIRCUMSCRIBED. An inscribed polygon is smaller than the
   circle it stands for, which is what an outer silhouette wants and what a
   bore must never be — a bore drilled to clear a hub by CLEAR_MARGIN clears
   it by 0.1494 on every flat. Holes take the polygon that circumscribes, so
   the nominal radius is the closest any flat comes to the axis and the
   margin binds exactly.
3. FINISH ON MATTER NEEDS ITS ORDER DECLARED. Printing and plating lie ON the
   plate's own surfaces — same plane, same polygon — so the depth test alone
   cannot choose between them. The first cut shredded both sub-dial faces
   into brass stripes, because the painted sheet was positioned by its matrix
   while the machined floor had its coordinates baked, and the two rounded
   differently. The finish is baked at the same coordinates now and carries
   an explicit `renderOrder`, instead of inheriting the accident that three.js
   sorts opaque draws by material id — which is all that was ever holding the
   dial's main face in front of its own plate.

## 27. CLOSED — every opening is cut: seats bored, joints drilled, and the rivet is a formed head

All three rows landed, each measured before and after. What follows is the
original filing, edited in place to record what was built and what it cost;
the one thing that did NOT close is the instrument gap, and it says so at
the end.

**Measured after, by the raycast that found the defect and then by a wider
one** — every screw head in the movement against its own unit's solid, first
down the head's axis and then over its whole FOOTPRINT (centre plus twelve
azimuths at 0.95 of the head radius, so a seat that was merely too narrow
would show):

| site | head into solid host, before | after |
|---|---|---|
| Three-quarter plate ×4 | 0.317 (40% of the plate) | **0** |
| Balance cock ×2 | 0.048 | **0** |
| Fork cock ×1 | 0.048 | **0** |

(The original filing says "Balance cock ×8". There are TWO screws there — one
per T-foot leg, which is what the builder writes and what the re-measurement
finds; the 8 was that measurement's own clustering splitting one 1.35-radius
head into several. The depths were right, which is what mattered.)

**The two answers are different because the constraints are.** A head that
may not stand proud has to be SUNK, and a sunk head needs a recess: the
plate screws are counterbored (`tqHoles` gains the four solved seats at
head diameter + `SEAT_FIT`, with the bearing land put back underneath and
bored for the shank — the chatons' construction, exactly). A head that may
stand proud BEARS on the face: the cock and bridge screws sit their
undersides on the top face and their hosts are bored for the shank that
passes through — the T-foot crossbar became an extrusion with two clearance
holes instead of a solid box, and the bridge's foot boss became a tube
instead of a disc with a shaft drawn inside it.

**What is deliberately still not drawn**, stated so the next reader does not
file it again: the thread, and the tapped hole it takes. `shank` is passed
only as far as the fastener's own drawn body goes — through the plate, or
through the bar — and below that last face the screw threads into the pillar
or the leg. A tapped hole under a seated screw is invisible in the real
movement too.

### (original filing)

Three sites, one cause: the movement draws a fastener where a fastener
goes, and never cuts the feature the fastener needs to be there. Found by
reading, confirmed by measurement, and filed together because the fix is one
idea applied three times — **the opening is part of the fastener, not
scenery around it.** The jewel settings already do it right and are the
worked precedent: `tqHoles` opens each pivot right through at the
counterbore diameter and the bearing collar is put back under the
counterbore's floor, so the recess a chaton sits in is genuinely cut.

**1. Screw seats are not bored — the head is drawn inside solid stock.**
Measured, every screw in the movement, by raycasting each head's axis
against its own unit:

| site | head reaches INTO solid host | bore cut for it |
|---|---|---|
| Three-quarter plate ×4 | **0.317** (of a 0.800 plate — 40%) | none |
| Balance cock ×8 | 0.048 | none |
| Fork cock ×1 | 0.048 | none |

`tqHoles` is fully enumerated at the plate build: one bore per upper pivot
plus the §35 selector-rod bore. Pillar/screw seats appear in neither
`tqHoles` nor `tqSlots`, and `makeScrews` only builds two merged meshes — it
cuts nothing. §20 records the plate screws as "head FLUSH with the face" and
verified the position ("plate 4 heads flush at z 8.508 against the 8.51
face"); flush was achieved by PLACEMENT, with nothing cut for the head to be
flush *in*. The cock and bridge screws at 0.048 are the milder version:
essentially proud, with a hair of overlap.

**A stale claim goes with it.** `makeThreeQuarterPlate`'s docstring says its
holes are "(barrel/drum, pivot bores, **pillar seats**)". Pillar seats are
named there and have never been passed. Fix the code or the sentence; do not
leave a comment describing an intent the builder does not implement.

**2. The chain's rivet holes are not cut either.** `chainPlatePairTemplate`
builds each link plate as a stadium from two `absarc` calls and extrudes it;
`shape.holes` is never populated. The comment on that very line reads
`// stadium: rivet-hole centres at ±half` — it names the holes in order to
locate them, and cuts none. Every `CHAIN_PIN_R` = 0.27 pin therefore passes
through solid plate, at all 211 joints of the shipped chain.

**3. The chain's rivets are flush-cut, where a real rivet is upset.**
Derived from the stock constants, exactly, because `CHAIN_PIN_LEN` IS the
joint's stack height by definition and the plate offsets are derived
backwards from it:

```
pin spans          −0.3300 .. +0.3300     (CHAIN_PIN_LEN = 0.66)
outer plate spans   0.1850 ..  0.3300     (CHAIN_PLATE_T = 0.145)
RIVET PROUD PER END = 0.000000
```

Not approximately flush — the pin end and the outer plate face are the same
plane. A real fusee-chain rivet is upset over the outer plate and stands
proud of it, or is seated in a countersink; a cylinder cut off level with
its plate is the one form that needs no riveting at all. The build says
"the pins run flush to the outer faces, their ends READING AS rivet heads",
which is honest about what was drawn — it claims appearance, not
construction — but it is declared only in a source comment, and nothing
asserts it.

### Why no instrument has ever seen any of this

Each site is invisible for its own reason, and the second one is the finding
worth keeping:

- **Screws**: a screw and its host are the same labelled unit, so both are
  FIXTURES. That is item 5's explicitly named residue — "still invisible:
  fixture-vs-fixture" — and `intraUnit` only checks movers against fixtures.
  A 0.317 interpenetration sits under a green battery because no check looks
  at that pair.
- **The chain**: worse, and OUTSIDE the map rather than in a named blind
  spot. The whole chain is ONE merged `BufferGeometry`, so the pin and the
  plate it pierces are not separate meshes at all. Nothing in the battery
  examines self-intersection WITHIN a single mesh. Items 5 and 6 catalogue
  blindness between units and between meshes of a unit; this is a third
  class — blindness *inside* a mesh — and it is not written down anywhere
  else. **That gap is arguably the more valuable half of this item**: it is
  a whole category of geometry the instruments structurally cannot judge,
  and merged buffers are used wherever draw calls matter (§20's own screw
  merge, §41's crown).

  **The instrument for it is filed as roadmap §77** — as a capability, not
  here, on the §36/§40 precedent: this file names a blindness, the roadmap
  builds the check that ends it, exactly as item 7 named pose-sampling and
  §36 built the swept registry. Three instances seed it (this item's rivets,
  item 28's rebuilt gaps as the regression case, item 4's degenerate
  builders), and it must FIRE on the rivets on arrival or the check is
  wrong.

### How the chain closed — and why the rivet ended up FLUSH

The joint is drilled and riveted now: every leaf carries the two bores its
own outline is drawn from, and the outer pair is counterbored for the head
with the bearing land put back underneath — the chatons' construction, in
`chainPlatePairTemplate`. The three numbers are in `layout.js` beside the
rest of the chain's stock:

| | value | where it comes from |
|---|---|---|
| `CHAIN_RIVET_FIT` | 0.013 u (0.005 mm) | the inner pair TURNS on the pin, so its bore is one running fit over it — 0.01 mm diametral, a real watch pivot's shake in its jewel, at this pin's 0.20 mm |
| `CHAIN_RIVET_HEAD_R` | 0.405 u (0.31 mm dia) | 1.5× the shank, the formed-rivet proportion; leaves 0.255 u (0.097 mm) of plate around the recess in the 0.66 outer leaf |
| `CHAIN_RIVET_HEAD_T` | 0.072 u | half the outer leaf, so the formed head and the land it bears on are the same thickness and neither is the weaker member |

**Row 3 asked "how far proud"; the movement answered ZERO, and that is the
finding.** The fusee's groove land is `FUSEE_LAND_W` ≈ 0.025 over a 0.02
crest floor — 0.005 u of extra chain width the axial budget can afford,
0.0025 a side — and successive drum coils lie `CHAIN_COIL_PITCH` = stack +
0.03 apart. No head worth forming fits in that. A rivet that may not stand
proud is COUNTERSUNK, which is what flush riveting exists for: the head is
formed inside the leaf, in a recess, and the pin is captured by a head
rather than being a cylinder cut off level with its plate. The stated number
moved from "how far proud" to the recess it is formed in, and the axial
budget is the derivation.

**The bore is polygonal and so is the pin**, so the fit is stated as the
pin's circumscribed radius against the bore's INSCRIBED one. That is not
pedantry: sizing an 8-gon bore by circumradius would have closed it on the
pin's flats by cos(π/8) — 7.6% of the radius, five times the fit itself.

**What it cost, measured**: the chain went 45,996 → 138,432 vertices (one
mesh still, so no new draw call), and the per-rebuild cost went 2.24 ms →
3.32 ms — less than the geometry, because the rebuild stopped allocating two
megabyte-scale `Float32Array`s per frame and now keeps them. That
reallocation was affordable at the old size and would not have been at this
one; `total` only changes when the run gains or loses a link.

**A face nobody can SEE is still a face the instruments READ** — learned by
breaking it. Four of the rivet's six caps are enclosed by the joint (the
shank's ends butt against the heads; each head's inner face lies on the
counterbore floor), so they were built open-ended to save 6% of the chain's
vertices. `sweptOverlap` promptly went red on `Chain ⇄ Set-up work`: a
CONFIRMED contact with `setupClickSpring`, a part whose box is **3.7 units
away in z** with not one chain vertex inside it. The cause is in
`meshClearance`'s own comment — `closestPointToGeometry` short-circuits to 0
through a triangle-intersection test that is known to lie, and the guard
against it is `sampledVerdict`, which is a PARITY RAYCAST. Parity counts
crossings, so it assumes a closed solid; open the pins and the count goes
odd. With the caps restored the pair measures 5.0125 at reserve f = 1 —
identical to `main`. The caps stay, and cheap invisible geometry is not free
when a check downstream depends on the solid being solid.

**And it cost the battery, which is the part worth reading.** `sweptOverlap`
went **352 s → ~1400 s** on the same CI runner class and blew the harness's
20-minute per-check guard — while reporting the same green result (0
CONFIRMED, 59,216 pairs). The guard is raised to 45 minutes with the
measurement written at the constant. That is a stopgap and it is labelled as
one: the cost is the §36 registry's, not the chain's. `samplePoses`
transforms every vertex of every mesh at every pose into Float64 and holds
all 108 frames at once, to produce **one AABB per pose** — 3.0× the vertices
bought ~4× the wall clock, which is memory pressure, not arithmetic. Filed as
roadmap §80, which is required to put the guard back to 20 minutes when it
lands. What was NOT done: trim the joint until the clock fit. The geometry is
right; the instrument is what should change.

### The instrument gap did NOT close, and §77's control had to move

There is now a build-time assert at the chain template — run the rivet's own
surface down its axis through the leaves and require no plate material where
the rivet is — and it FIRES on the shipped defect: un-bore either leaf and
boot reports `the rivet runs 0.1450 u through solid plate`, which is exactly
the leaf's thickness. That is a check of ONE part's template, not of the
class. Blindness inside a merged mesh is still real and still roadmap §77's
to end.

**And this item removed §77's positive control.** That entry seeds itself on
the rivets and says the check "must FIRE there on arrival or the check is
wrong" — true when it was written, false now. §77 has been edited: the chain
becomes a second REGRESSION case (a merged buffer that must come back
silent), and the control it needs is a synthetic one — an un-bored copy of
the template, which is how the assert above was validated.

### What closing this looked like

Rows 1 and 2 were the same edit twice: pass the seats as holes. The plate's
screw seats join `tqHoles` (they were already solved — `pillarSeats` — but
were solved AFTER the plate was cut, so the seat solve moved above the plate
build; it must stay this side of the push, since a pillar may not avoid its
own screw's seat), and the link plate's stadium gained two `shape.holes` at
the rivet centres it already named. Both took the counterbore convention the
chatons use: cut through at the head diameter, put the bearing land back
underneath, so the recess has a floor rather than being a bare hole.

Row 3 was a shape change, not an opening: the pin gains an upset head at
each end — a short flare proud of the outer face — or the outer plate gains
a countersink and the pin a matching taper. Either way the number to state
is how far proud, derived from real chain practice rather than chosen. (The
countersink is the one that survived the movement's axial budget; see above.)

**Do not close this by widening a clearance or waiving a row** — nothing was
failing, which was the point. The fix had to add geometry, and the
instrument gap has to be closed separately or the next instance will be just
as invisible as this one. Nothing here is waived, and no budget moved.

**The stale claim is fixed too.** `makeThreeQuarterPlate`'s docstring named
"pillar seats" among its holes and had never been passed one. It is passed
them now, and the sentence says what the construction is.

## 28. MOSTLY CLOSED — pillars, a derived profile, and a lock the column actually lifts

Reported by eye ("the columns are zero thickness and the riders seem to have
superficial state-change animations"), and both halves survive measurement —
the first in a narrower and sharper form than reported, the second for the
one rider that matters most.

### The tier is a HEIGHT FIELD on one ring, not six pillars

`makeColumnWheel` builds the castellations as a single ring whose top surface
is `colH · profileAt(θ)`. That was TODO 20's fix and it was the right one:
before it, the columns were bevel-less sector extrusions with vertical
cliffs while `profileAt` returned a ramp, so the beak rode a surface nothing
had cut. Mesh and law now come from one function. What the fix carried in
with it is that the columns stopped being BODIES:

- **In the gaps the ring has zero thickness.** `prof(a) = 0` there, so
  `top = 0`, the inner and outer walls have zero height, and the floor
  triangles are deliberately skipped — the builder's own comment says why:
  "skipped in the gaps, where floor and top would coincide and z-fight the
  base's own top face". So between every pair of columns the part is a
  degenerate strip of zero area. That is the reported defect, exactly, and
  it is in the source as an acknowledged consequence rather than a finding.
- **A real column wheel has discrete pillars** standing on a base disc with
  air between them, and the gap's floor IS the disc's top face. Here the
  inner and outer walls run unbroken around the full circle at zero height.

`stockFloor` gates "0 degenerate" and does not see this: the census measures
a mesh's extents, not per-region collapse. Another instance of item 27's
third blindness class — one mesh, judged whole.

### The column is 72% ramp, from two undeviated literals

Measured from the built profile at `ALARM_COL_COLUMNS` = 6:

| | arc | at the outer radius |
|---|---|---|
| flat top | **8.40°** | 0.836 u |
| each flank | 10.80° | 1.074 u |
| raised total | 30.0° | — |

So each column's raised arc is **21.6° of ramp against 8.4° of flat** — the
flat top is narrower than either flank, and the column reads as a triangular
ridge rather than a pillar with a plateau. A real chronograph column is a
squared pillar whose sides are near-radial walls with a chamfer for the beak
to climb, not a chamfer with a hint of pillar between.

Both numbers are bare literals in `geometry.js` with nothing behind them:

```js
const duty = 0.5;             // column arc fraction of a pitch
const flank = 0.18 * pitch;   // rise/fall arc — what the beak visibly climbs
```

Standing rule 1's exact failure case — numbers that are there because they
looked right. The flank should derive from what the beak must climb (its
nose radius and the lift it has to deliver over the wheel's step time), and
the duty from the gate the beak has to hold; neither is a free parameter.

### Three riders, three different levels of honesty — and the LOCK is the fiction

Not all riders are animations. Sorted by how much the column actually does:

1. **The §35 link beak — genuinely driven.** `noseDrop = colH · (1 − profile)`
   and the arm's angle is `noseDrop / beakLen`, then forward through rod →
   rim contact → roll → ring. A real geometric solve with no amplitude
   constant anywhere. This is TODO 20's closed work and it is the template
   the other two should meet.
2. **The click arm — driven, with a derived amplitude.**
   `ALARM_CLICK_BASE + ALARM_CLICK_SWING · colBlock`, where
   `ALARM_CLICK_SWING = (ALARM_CLICK_OUT − ALARM_CLICK_SEAT) / ALARM_CLICK_L`
   is a chord over a lever length. Acceptable: the profile drives it and the
   scale is derived.
3. **The lock lever — a tween on a FLAG, gated by the column.** This is the
   defect:

```js
const liftTarget = alarmOn ? 1 : 0;
alarmLockLiftT += (liftTarget - alarmLockLiftT) * (1 - Math.exp(-rawDt / 0.08));
alarmLockLever.rotation.z = ALARM_LOCK_ENGAGED + ALARM_LOCK_LIFT * alarmLockLiftT * (1 - colBlock);
```

The column does not lift this lever. A boolean does, on an 0.08 s
exponential ease, and the column's only role is to MULTIPLY the result by
`(1 − colBlock)` — a veto, not a drive. The amplitude is
`ALARM_LOCK_LIFT = 0.085` rad, commented "~0.4 of radial air at the collar
when released": a fraction of the space available, not a lift the column
height and the beak's lever ratio produce. Change `colH` and this lever's
travel does not move.

That is a simulation fiction in the README's precise sense — the part
animates with no force path — and it is the rider that matters most, because
the lock is what physically holds the alarm train.

### What closing this looks like

- **Pillars, not a height field.** Build the castellations as N discrete
  bodies on the base disc so a gap is absence of matter rather than absence
  of height, and the degenerate strip disappears with it. Keep TODO 20's
  invariant — the ridden law and the cut surface stay one function — by
  deriving each pillar's flank from `profileAt` rather than re-typing it.
- **Derive `duty` and `flank`.** State the constraint in the comment: the
  flank from the beak nose's climb, the duty from the gate the beak holds.
- **Drive the lock from its beak**, as the §35 link beak already is: lever
  angle from the contact height at the beak's own azimuth, so `ALARM_LOCK_LIFT`
  and the 0.08 s ease both disappear. If a return spring is what closes it,
  model the spring (§48's class) rather than easing a flag.

**Do not close this by re-tuning 0.18 or 0.085.** Both are the symptom.
The wheel is currently a correct-looking silhouette with a ramp profile
nothing designed and a lock that is posed from a boolean.

### CLOSED — three of the four, each measured

**1. Pillars, not a height field.** Each column is now its own closed solid
spanning only its own arc; where there is no column there is no geometry, and
a gap's floor is the base disc's top face. TODO 20's invariant is untouched —
the top of every column still IS `colH · profileAt(θ)`, one function for the
cut surface and the ridden law.

Measured on the castellation mesh: **1224 triangles, 0 degenerate.** The
zero-area strip between every pair of columns is gone. A pillar's two ends are
knife edges where the chamfer meets the base, so a quad spanning the extreme
ring would still contribute one zero-area sliver; those are dropped by a
vertex-distinctness test rather than being drawn, which is why the count is a
clean zero rather than "small".

*(Two degenerate counts remain nearby and are NOT this item's: 8 in the base
disc from `ringExtrude` and 6 in the ratchet skirt's `ExtrudeGeometry`. Both
predate this work and neither is a zero-thickness region — they are
triangulation slivers in otherwise solid bodies. Recorded so the next reader
does not think this item missed them.)*

**2. `duty` and `flank` are derived.** DUTY is forced: one actuation indexes
the wheel HALF a pitch, so the two stable states are half a pitch apart, and a
rider can only sit centred on a column in one and centred in a gap in the
other if column and gap are equal. `duty = 0.5` and can be nothing else while
the index is half a pitch — it was a bare literal describing a constraint.

FLANK is now a CONSEQUENCE of the flat top, and the flat top is what a rider's
nose needs to rest on: `flatHalf = (riderNoseR + CLEAR_MARGIN) / baseR`, and
the chamfer is whatever is left of the column's half-arc. The click's nose is
the binding one (the largest of the riders) and is hoisted above the wheel
build so the wheel cannot be cut before it exists.

| | before (literal) | after (derived) |
|---|---|---|
| flat, total | 8.400° | **8.645°** |
| flank, each | 10.800° | **10.678°** |

The old numbers were within 0.12° of the derivation, which is why they looked
right — they WERE right, and undeclared. That is the outcome rule 1 predicts:
deriving a good guess mostly confirms it and takes away its ability to drift.

**3. The column lifts the lock; a boolean used to.** The 0.08 s exponential
ease on `alarmOn` is deleted, `alarmLockLiftT` is retired, and the lever's
angle is now a pure function of where the castellations stand at its beak's
azimuth — engaged on a column, lifted over a gap, and PARTLY lifted on the
flank, riding the chamfer the way the §35 link beak already does. Measured
across the parity: the lever swings **0.08500 rad**, and it swings *because
the wheel turned*. The motion is still smooth: the easing belongs to the
WHEEL, which is the thing that physically moves.

### What keeps this MOSTLY closed — the lock's RETURN

The linkage is now honest in one direction and still silent in the other. The
column PUSHES the lever to engaged; nothing pulls it back when the gap
arrives. §48's audit agrees — `Alarm lock` is still `restoredByNothing`, and
its waiver in `RESTORING_WAIVERS` still cites this item.

Closing it means modelling the return spring: a blade grounded to its own stud
and bearing on the lever's arm, biasing it toward LIFTED so the column has
something to work against — the construction `switchClickSpring` already uses
two units away, and which §48's geometry guard will check by name. It was left
out of this pass deliberately: it is new plate-top geometry with its own
clearance consequences, and it is a cleaner change on its own than bolted to a
profile rebuild.

`ALARM_LOCK_LIFT = 0.085` is also still a chosen fraction of the collar's air
rather than a derived travel. It should fall out of the pad's required
clearance over the lever's length once the spring gives the lift a load path
to be derived against.

## 29. MOSTLY CLOSED — §48's audit is wired in, the parity is swept, and the lock's debt is now VISIBLE

The instrument that exists to catch "a part that reciprocates with nothing
restoring it" cannot be reached by the battery, and the part item 28 filed
as the movement's clearest instance of exactly that would not appear in it
even if it could.

**It is not registered, so nothing can run it.** `auditOscillators` is
`export`ed from `inspect.js` and is absent from the `CHECKS` registry, so
`start(clock, 'oscillators')` answers `unknown check`. `tools/ci-battery.mjs`
never names it either. The only way to run §48's audit today is to import
the module and call the function by hand — which is how the numbers below
were obtained.

**Run by hand it is HEALTHY, which is why nobody noticed.** Measured on the
shipped build: control **PASS** ("the pallet fork is classified two-way
driven"), population **18** units that reverse, **0** restored-by-nothing,
0 malformed, 0 stale, 12 two-way and 6 restored by a declared element. A
clean report from an instrument nothing runs is the worst of both worlds:
it looks like coverage and is not.

**The alarm lock is missing from that population, for two separate reasons,
and either alone would hide it:**

1. **Nothing is declared.** Neither `Alarm lock` nor `Alarm switch` has a
   `declareRestoring` entry — grep returns zero for both. Eighteen other
   units have one.
2. **No axis moves it.** The audit's population comes from the §36
   registry's `reversed` flag, which is measured over `AXES`. Every axis
   that touches the alarm pins the parity: `alarm` poses
   `alarmOn: 1` for its whole sweep, and **no axis anywhere varies
   `alarmOn`** (0 matches for a swept parity across the whole table). The
   lock lever's lift is `ALARM_LOCK_LIFT · alarmLockLiftT · (1 − colBlock)`
   with `alarmLockLiftT` tracking `alarmOn ? 1 : 0`, so across every sweep
   it is CONSTANT — armed on the alarm axis, released everywhere else. A
   part that never changes never reverses, and a part that never reverses is
   never asked what restores it.

So item 28's finding — the lock is posed from a boolean rather than lifted
by its column — is not merely unasserted; it is outside the reach of the one
check designed to assert it. That is the same shape as items 5, 6 and 27:
the defect is not hidden by subtlety, it is hidden by the instrument's
population.

**`lowCorridor` is in the same position, less severely.** It IS in `CHECKS`
(so it can be run) but is absent from `tools/ci-battery.mjs`, so CI never
runs it either. Worth confirming against §36's own claim that it is a
battery check — one of the two is out of date.

### What closing this looks like

- Register `auditOscillators` in `CHECKS` and add it to the battery. §48's
  own rule is that it is a REPORT, not a gate ("`ok` is always true; the rows
  are the product") — so gate the thing that can be gated: **0
  restoredByNothing, 0 malformed, 0 stale**, with the control asserted PASS.
  A control that silently stops passing is how this class of check dies.
- Add an **alarm-parity pose axis** so the toggle is swept rather than
  pinned, and the lock, the click and the §35 link beak all reverse under it.
  Note the CLAUDE.md trap: `setPose` ticks with zero dt, so the lock's
  0.08 s ease cannot run under a pose sweep — the tick already snaps
  `alarmLockLiftT` to its target when `rawDt` is 0, which is what makes a
  parity axis viable at all. Confirm that before relying on it.
- Give `Alarm lock` and `Alarm switch` their `declareRestoring` entries —
  honestly. If the lock's return is a spring, the spring has to be in the
  scene (§48's geometry-only guard checks the named mesh exists); if it is
  driven both ways by the column, it is `two-way` and item 28's rebuild is
  what makes that true.

Closing this and item 28 together is the cheaper order: the axis and the
declaration make the lock's defect FAIL, and then the rebuild fixes it
against a check that can see it.

### CLOSED, and what each step actually found

**The check is registered and gated.** `auditOscillators` is in `CHECKS` as
`restoring` — named for what it checks, and deliberately NOT `oscillators`,
which is one character from TODO 25's `oscillator` and asks a different
question. `tools/ci-battery.mjs` gates it at **0 unwaived, 0 malformed,
0 stale, control PASS**, and CLAUDE.md's rule 4 lists it. §48's rule that the
audit is a REPORT is kept intact: `ok` is still always true, and the gate
holds only the part that can be held.

**The parity is swept.** A new `alarmToggle` axis runs RELEASED → ARMED →
RELEASED. One step would not do: the registry calls a volume reversed when
successive steps change sign, so a monotonic 0→1 sweeps the same volume as a
part that only ever moves one way. `setPose` writes the PARITY rather than
just the flag, so the axis turns the column wheel and everything it drives.

**What the axis surfaced, measured: population 18 → 23.** Five units
reciprocated for the first time. Four resolved to mechanisms that were
already there and had simply never been asked:

| unit | answer | why |
|---|---|---|
| Alarm switch | `spring` | the click arm's own blade, `switchClickSpring` — a real mesh, which §48's geometry guard checks. **§173: the geometry guard checked that the mesh EXISTS, not that it touches; TODO 90 finding 3 measured 2.0963 of air between them. The row is now `alarmJumperBlade` restoring `alarmJumperBlade` — the sautoir IS its own spring, so the two cannot part** |
| Alarm link | `two-way` | TODO 20's forked tab drives the chain both ways; this is the very thing that retired its phantom bias spring |
| Alarm selector | `two-way` | same solve — the centre pin in the groove pushes and pulls the ring |
| **Alarm lock** | **WAIVED, TODO 28** | restored by nothing, because nothing restores it |

The lock is the point. Its debt is now a row in a gated check citing the
item that fixes it, rather than a sentence in a file. **Do not green it by
declaring a spring** — the audit's geometry guard would demand the mesh, and
inventing one is the exact dishonesty §48 exists to catch. Item 28's rebuild
is what deletes this waiver.

### What keeps this MOSTLY closed — the Dial row

The fifth unit is unresolved and waived under this item. Of the 23 reversing
volumes the axis attributes to `Dial`, **22 are also claimed by a nearer unit**
(Alarm disc, Alarm selector, Alarm release feeler, Power reserve) and are
correctly deduped away. **One is not**: an unnamed `ExtrudeGeometry` that no
nearer unit claims. It is either a real dial-side part with no return, or the
nesting artifact the audit's own dedupe comment calls a FALSE finding — and
which of those it is cannot be decided without naming the mesh.

Naming it IS the fix, and §54 already wrote the rule this breaks: a row that
cannot name its member is not actionable. Closing this item means giving that
mesh a name at its build, re-running `restoring`, and then either declaring
its restoring element or deleting the `Dial` waiver as the artifact it turns
out to be.

### The general lesson, worth more than the fix

**The audit's population is whatever the axes move.** A part with its own
input that no axis exercises is not judged clean — it is not judged. Before
this item, the alarm parity was pinned at 1 by the `alarm` axis and at 0
everywhere else, so the movement's clearest no-spring case sat outside a
healthy-looking instrument for its whole life. That is the same shape as
items 5, 6 and 27: the defect was hidden by the instrument's population, not
by any subtlety in the geometry. Rule 4 now says so where someone adding a
mechanism will read it.

## 30. §76's walls two and three exist only as roadmap prose

The balance-growth entry (§76, roadmap) records three walls. Wall one is
down — [item 26](#26-mostly-closed--the-dial-is-a-plate-now-the-works-stand-behind-it) took it down when the dial gained real thickness, and a
balance at R 11 now boots silent. The other two are real, measured, and
written down **only inside a roadmap entry in another repository**, where
nobody reading `TODO.md` will find them and no instrument covers them.
Filed here so they are visible to the repo whose geometry they constrain.

**Wall two — the alarm winding stations do not derive from the plate they
sit on.** `plateR` takes the balance's outline as `balanceR × 1.35`, so
growing the balance grows the plate: at R 12 it goes 42.92 → 45.36
(movement Ø 32.5 → 34.4 mm) and the alarm winding chain, stationed against
the rim at radii that were correct for one plate size, stops meshing —
idler 1 ⇄ idler 2 centre distance 15.541 against a pitch-circle sum of
15.300, idler 2 ⇄ barrel 14.509 against 14.250, plus `alarm setting i2
fouls the winding climb: clearance −0.25`. TODO 15's asserts catch it, which
is the system working; the defect is that the stations are placed rather
than derived. **This is standing rule 1 at station scale** and it is worth
fixing whether or not the balance ever grows.

**Wall three — the fork cock's seat search gives up instead of reporting.**
At R 13 the boot FAILS outright: `fork cock: no clear footing for its leg`,
followed by a null dereference downstream (`TypeError: Cannot read
properties of null (reading 'x')`). The scan looks for a landing clear of the
balance's swept radius and the plate's cut, and past R 12 no seat survives.
Two separate defects in one line: the search has no fallback, and its failure
mode is a crash rather than a diagnosis. **A solver that cannot find an
answer should report its best near-miss with numbers** — the pillar seat
scan's `no seat found near` warn is the precedent in this same file, and it
does not take the boot down with it.

**And the diagnosis does not survive the crash.** The warn reaches
`console.warn`, but `__clock.bootWarns` never exists, because boot dies
before publishing it. So every instrument that reads `bootWarns` — the CI
battery, §33's trial-boot panel — sees NOTHING AT ALL, not a failure: a
`waitForFunction` timeout with no message attached. A build that cannot boot
is invisible to the very machinery meant to report on boots, which makes
this a third defect in the same line and the reason the fallback matters more
than it looks. Publishing `bootWarns` incrementally (or in a `finally`)
would make the crash legible even without fixing the search.

### Re-measured 2026-08-05 — one wall softened, one unchanged, one NEW

The paragraph that used to stand here said neither wall had been re-measured
since item 26. Both have now been, on merged `main`, sweeping balance radius
at the shipped corner and at 45° (roadmap §76's Layer 4 carries the full
table):

- **Wall two is partly down, and only at 45°.** At the shipped corner R 12
  still gives the whole breakdown above. At 45° only `alarm setting i2 fouls
  the winding climb: clearance −0.25` survives — the two centre distances
  mesh. The placed-not-derived defect is unchanged; the SIZE of the job at
  the corner §76 wants is one clearance, not a broken train.
- **Wall three is unchanged and corner-independent** — R 13 dies identically
  at both corners.
- **A wall that was DOWN came back, and then went down again.** §62's
  openworked plate shipped after §76's wall-one measurement and put a new
  warning at R 10, 11 and 12: `§62 window 'escapement': edge leaves a 0.798
  land against another opening — need 0.800`, from the window outline being
  interpolated between per-degree solved bearings. Fixed (BUILT §62's
  postscript); R 10 and R 11 boot silent again at 45°. Recorded here because
  it is the general lesson these two rows exist to carry: **a wall list is a
  measurement with a date on it, and every landing can add a wall to
  somebody else's entry.**

### Why these are TODO rows and not just roadmap prose

Wall two is a placed-not-derived station set: rule 1, in the shipped build,
today, at the current balance size. Wall three is a solver that crashes
instead of reporting: a defect in an instrument, not a layout preference.
Both are honesty debt in what exists — they would be worth closing if §76
were abandoned tomorrow, which is the test for belonging here rather than
in the roadmap.

### The crash is FIXED, the diagnosis is published — and wall three was misdiagnosed

Two of this item's three defects are closed. Wall two is untouched and still
open; what follows is measured, not argued.

**The warn buffer is published from main.js's first lines, on its own
surface.** `window.__bootWarns` (and `window.__bootError`, filled by an
`error` listener while `__clock` is still absent) go up beside the
`console.warn` capture, ~18k lines before `window.__clock` is assigned.

The one trap here is worth stating, because the obvious fix is the wrong
one: **`__clock`'s EXISTENCE is the boot-complete handshake.**
`ci-battery.mjs` waits on `!!window.__clock` and §33's trial-boot panel
polls the iframe for the same thing. Publishing a STUB named `__clock`
early would make both readers proceed on a half-built module and report
`silent` — the exact false-silence the buffer was added to kill in §29
step 0's postscript. So the warns get a separate name, which means "there
are warns" and never "the boot finished".

Both readers now say what happened instead of timing out blind.
`virginBoot` catches its own `waitForFunction` timeout and reports the
fatal error, the warns, and the page errors — the last of which it was
*already collecting* and discarding, because the timeout threw before the
`if (errors.length)` check could run. The trial panel reads the same two
values off the iframe before `reconfKillTrial` removes it.

**The fork cock's seat scan reports and continues.** Its three walls (plate
radius, swept-disc floor, the bar's edge against the balance) are now graded
as signed margins instead of tested, so the scan keeps its least-short
candidate and names which wall bound it and by how much. The feasibility
test is unchanged — a seat clears iff all three margins are ≥ 0, which is
exactly the three `continue`s it replaces — and the fingerprint is
byte-identical to HEAD's at the shipped size (1436114427, 49 units,
10 poses, measured both ways). When nothing clears it seats on the
near-miss and warns that the cock is KNOWN BAD, on the precedent of the
pillar seat scan's `no seat found near`: rule 6 still makes the warn a
failure, but the boot completes and every other assert gets to speak.

**What R 13 says now, where it used to say nothing at all.** Eight warns
instead of a `TypeError` and an empty buffer — this item's whole point, and
it immediately produced a correction to §76:

```
fork cock: no clear footing for its leg — best near-miss is short by 0.689
at (19.09, -32.72), reach 16.00, bearing 304.6°; bound by a swept disc below
the seat [margins: plate 7.680, floor -0.689, bar 1.736; each needs ≥ 0]
3/4 plate: the cut reaches a pivot it has to carry at 17.1 0.0 — edge 13.81 vs 9.81   (×2)
alarm setting i2 fouls the winding climb: clearance -0.84
alarm winding chain: i2 failed to close on the barrel mesh distance
TODO 15: alarm winding: idler 1 ⇄ idler 2 centre distance 15.947 vs pitch-circle sum 15.300
TODO 15: alarm winding: idler 2 ⇄ barrel centre distance 14.943 vs pitch-circle sum 14.250
§39: balance 13.78 mm outside the 6–13 mm wristwatch envelope
```

**Read the near-miss: `reach 16.00` is the scan's own ceiling, and `plate
7.680` says there was plate left.** Measured — raise `reach <= 16` to 26 at
R 13 and a seat is found; the fork cock warn disappears and the other seven
remain. So wall three's recorded cause, "past R 12 no seat survives", is
WRONG. What runs out at R 13 is not footing, it is the scan's undeclared
compactness cap. `16` is a magic number: the comment says the scan takes the
nearest feasible seat "which keeps the bridge compact", so compactness is
the intent, but no constraint derives the number — rule 1, sitting inside
the solver this item was filed against.

**That is a re-diagnosis, NOT wall three coming down**, and the difference
matters. A seat past reach 16 is a much longer bar, which has P1 duties
(§50's section floors on a longer unsupported span) and P3 consequences (the
bar sweeps more of the plate, in the slab z-band the balance already
shares). None of that is measured. Raising the ceiling to green a warn
before deriving it would be swapping one magic number for a larger one.

**What is left on this item**, in the order that suits §76:

- **Derive the reach ceiling** from what actually limits the bridge — the
  bar's own section against its unsupported span — and re-measure R 12/R 13
  against the derived cap. Only then is it known whether wall three is a
  layout wall or was never one.
- **Wall two, untouched.** The R 13 rows above show it: the winding chain's
  link lengths are `ALARM_TRAIN_MODULE × tooth counts` with
  `ALARM_WIND_IDLER_TEETH = 51` carrying its constraint in a COMMENT
  ("sized so the 3-mesh chain … spans the SHORTER inner-climb → barrel
  run") — evaluated once by hand and pasted, while the span it must cover
  grows with `plateR`. The setting train has the same shape: the comment
  states `m·(30 + 2·31 + 10)/2 = ALARM_CD → m ≈ 0.302` and the code ships
  `ALARM_SET_MODULE = 0.30`. So wall two is not "stations placed at radii"
  as filed above — when this was written the climb station followed the
  plate through `ALARM_CD ← RESERVE_LOCAL.y ← dialRadius ← plateR` (§94
  tier B then split the corner from the reserve station, and §125 pinned
  its default to `ALARM_CORNER_R` outright, so the corner no longer follows
  the plate at all — the spans these constants cover are now fixed unless
  `?alarmr=` moves them). It is two constants
  whose derivations live in prose instead of in code. Fix them where they
  are declared, and note the tooth counts are integers, so the module
  absorbs the residue against TODO 15's asserts.
- **`§39: balance 13.78 mm outside the 6–13 mm wristwatch envelope`** is a
  bound §76 should record whatever the layout does: R 13 is out of spec as a
  wristwatch before any wall is consulted.

### Wall two got smaller again, and the reason is worth keeping

§76's wall-one restructure (roadmap Layer 7) landed the setting run's real
wall list, and in doing so it separated two things this item had filed
together. **The setting run is solved at the shipped corner** — its 25-wall
audit measures 0.210 clear, which is the ceiling the whole family shares, so
`ALARM_SET_I1_BEARING = 18°` is already optimal. What remains of wall one at
the shipped corner is the three-quarter plate's cut reaching the alarm
winding pivot, which is a different wall from anything in this item.

Wall two is unchanged and still open: `ALARM_WIND_IDLER_TEETH = 51` and
`ALARM_SET_MODULE = 0.30` both carry their derivations in comments rather
than in code, while the span they must cover grows with `plateR`.

**The general lesson, which is this item's own lesson repeating.** The
setting run's walls were split between an audit that ran at the route and
asserts that ran 500 lines downstream, with three walls in neither — so the
route was solved against a subset and the leftovers could only complain
afterwards. That is the same shape as the instrument gaps in items 5, 6, 27
and 29: **the defect was not hidden by subtlety, it was hidden by what the
instrument was allowed to look at.** A wall the solver cannot see is not a
wall, it is a post-mortem.

**Battery: 14/14, fingerprint unchanged.** `node tools/ci-battery.mjs`,
3055 s. Every gate green — `inspection` 0 FORBIDDEN (50 units, 72 contacting
pairs), `clearances` 0 violations, `sweptOverlap` 0 CONFIRMED (59 216 pairs,
2 tight, 13 refuted), `restoring` 0 unwaived with control PASS,
`stockFloor` 507 rows / 64 waived, `oscillator` 2.5 Hz on a 0.0244 mm
ribbon — and the fingerprint is 1436114427 across both virgin boots, the
same hash HEAD produces. That last number is the load-bearing one for this
change: the seat scan was refactored from three `continue`s to three graded
margins, and an identical fingerprint is what says the refactor picks the
same seat rather than a similar one.

One thing the battery does NOT cover, stated rather than implied: the new
reporting paths only execute when a boot fails, which a green run never
does. `virginBoot`'s timeout handler and the trial panel's dead-frame read
were exercised directly instead — the boot-failure case by booting R 13
under a patched balance radius, and the handler's four report shapes
(wedged, absent buffer, warns present, no warns) by driving the branch
logic on its own. A wedged page is the one shape with no live test; it is
why that read is raced against 10 s rather than awaited.

## 31. CLOSED (§102) — the lock has its return: a blade the column works against

**Closed as prescribed, part for part.** The flat return blade exists as
metal (`alarmLockSpring`, `SPRING_FLAT_U` stock on its own plate-top
stud — `switchClickSpring`'s construction one unit over), bears on the
arm's wheel-side flank with a 0.05 preload at the lifted pose, and is
declared with `declareRestoring('Alarm lock', 'spring', …)`. The
`RESTORING_WAIVERS` row is DELETED — the waiver was the finding, and
deleting it meant adding the spring. The spring-only rest state is LOCK
LIFTED (beak seated in a gap, pad off the collar); a column overcomes
the blade to hold the brake on, which is what a column wheel is for.

**And `ALARM_LOCK_LIFT` became derivable, as promised**: 0.085 ("~0.4 of
the radial air", the one number item 28 could not fix) is now
`(CLEAR_MARGIN + 0.01) / ALARM_LOCK_L` = 0.032 rad — the pad's required
clearance at the collar over the lever's length, the float-bind
centi-unit included. The beak's width bound only loosened (its
tangential swing fell 0.20 → 0.07).

**The bear station is derived in position space**: the blade shares the
collar's z band, so the wheel-ward lane is scarce — the bear point goes
at the smallest arm fraction that clears the pivot's own hardware
(anchor fully off the post + margin), which is also the station farthest
from the collar; both lanes asserted at boot. P1 filed in the build
comment (TODO 16's format): tip-force order single mN with no
counterforce at the gap, three orders under the column's pusher-driven
press — the blade is sized by its stock convention, the HOLD is the
column's.

The original filing, kept as the record:

### The alarm lock has no return — the column can push it, nothing pulls it back (original)

The direct remainder of [item 28](#28-mostly-closed--pillars-a-derived-profile-and-a-lock-the-column-actually-lifts), and what `Alarm lock`'s waiver in
`RESTORING_WAIVERS` points at. Item 28 made the lever move BECAUSE the wheel
moved — the 0.08 s ease on a boolean is gone and the angle is now a pure
function of the castellations at the beak's azimuth. That fixed the direction
the column drives. It did not give the lever a way back.

**The linkage is honest one way and silent the other.** A column presses the
beak and holds the lever engaged; when the gap arrives, nothing lifts it. The
pose law says it rises, and no element in the movement does the rising. §48's
audit agrees and says so every run: `Alarm lock` sits in `restoredByNothing`,
gated but waived. That waiver is the finding, not a suppression — deleting it
means adding the spring, and greening it any other way would be inventing one.

**What to build.** A flat return blade, grounded to its own stud on the plate
top and bearing on the lever's arm, biasing it toward LIFTED so the column has
something to work against. The construction already exists two units away:
`switchClickSpring` is the same part doing the same job for the click arm, at
`SPRING_FLAT_U` stock, and §48's geometry guard will check the named mesh is
really in the scene. Declare it with `declareRestoring('Alarm lock', 'spring',
…, 'alarmLockSpring')` and the waiver comes out.

Note the sense before building it: the spring pushes toward RELEASED and the
column overcomes it to ENGAGE. That is what a column wheel does — the column
holds the lever against its spring — but it means the spring-only rest state
is "lock lifted", which is worth stating out loud rather than discovering from
a screenshot.

**And then `ALARM_LOCK_LIFT` becomes derivable.** It is 0.085 rad, commented
"~0.4 of radial air at the collar when released" — a chosen fraction of the
space available, which is the one number item 28 could not fix because a lift
with no load path has nothing to be derived FROM. With the spring in, the
travel falls out of the pad's required clearance over the lever's length:
`lift = (pad clearance at the collar) / ALARM_LOCK_L`, with the constraint
written in the comment.

**Why this is its own item rather than item 28's tail.** It is new geometry on
the plate top with its own clearance consequences (the §62 window solve and the
pillar seats both live up there), so it wants its own battery run and its own
record. Item 28 is finished as a profile-and-drive rebuild; this is a part that
does not exist yet.

## 32. CLOSED (§104) — both springs' torque laws are derived from their ribbons, and the alarm's cadence is the governor's arithmetic

**The going train's half is CLOSED (2026-08-09).** `springTq = 0.35 +
0.65·t` — the last authored number in the fusee mechanism, and since item
40 the load-bearing one — is gone. The law is now solved from the ribbon
item 1 built, the fusee is cut against the solved law (the third re-cut,
the one item 40's closing note predicted), and a battery gate holds the
derivation. What follows records the as-built solve, because two of the
entry's own sketch numbers turned out wrong in instructive ways.

**The derivation (`main.js`, the law block).** Three laws close on each
other: the ribbon `M = k·(θ_s + C/R_wrap)`, the equalisation
`M(t)·r(t) = const`, and the chain feed `dC/dt = 2π·W·r(t)`. Substitute
`u = θ_s + C/R_wrap` and the system integrates in one line:

```
u(t) = √(θ_s² + β·t)      β = 4π·W·r₀·θ_s / R_wrap    (k cancels)
r(t) = r₀·θ_s / u(t)      the flank — inverse square root, not a hyperbola
C(t) = R_wrap·(u(t) − θ_s)
```

`k` cancels from everything geometric — the entire cone, chain and drum
accounting is pure shape — and comes back only in the published absolute
arithmetic (below). One state variable `u` carries the spring's angle, the
drum's rotation and the chain's whereabouts; the tick's existing
`setWind(sweepFull − drumRot)` lands the ribbon at exactly `A_free + u(t)`
with no tick change at all.

**The set-up finding held; the click count did not.** The entry predicted
the 0.35 was a set-up in disguise, and it is — but its 23-click figure was
solved against the pre-item-40 wind range (11.0516 rad) with the naive
`θ_s/(θ_s + range)` criterion. Re-run SELF-CONSISTENTLY (θ_s changes β
changes the range changes S(0)) against the re-cut cone's geometry, the
ratchet click whose solved empty-end fraction lands nearest the authored
0.35 is **17 clicks = 0.70833 turns = 4.45059 rad → S(0) = 0.34606**
(18 clicks gives 0.35484 — the answer is still within half a click, which
was the entry's real claim). The one pinned number in the law is that
INTEGER, `SETUP_CLICKS = 17`; the quantisation is the 24-tooth set-up
ratchet's, and the ratchet build now consumes the same constant.

**The entry's `I = b·h³/12` was the bounding rectangle, not the section.**
TubeGeometry with radialSegments 4 cuts a RHOMBUS — the correction item 25
already made for the hairspring, factor 4 — so the solve uses the as-cut
`I = a³c/3` (a = 0.13490, c = 1.61965), now published as
`userData.mainspring.section` on both mainsprings, hairspring-style.

**The as-built numbers** (all in the frozen `EQUALISATION` record on
`__clock`, computed where E and the sections live):

- k = 9.159e-5 N·m/rad; arbor moment 0.408 → 1.178 N·mm over the service
  band — inside the real small-barrel range, the scale-pin sanity anchor.
- u(1) = 12.8609 rad; `DRUM_ROT_FULL` = 8.4101 rad = 1.3386 turns;
  `CHAIN_ENGAGED` = 89.65 u.
- `FUSEE_TORQUE_K = r₀·S(0)` = 2.5608 — still the level product as a
  radius, still r_min at the wrap's top by identity; tip 2.4889.
- Service band 5.7083 → 7.0468 turns: at full wind the coils sit 0.8%
  off bind, so the set-up wound back the slack the item-40 header note
  flagged ("the barrel is no longer sized tight to its own wind" — it is
  again).
- HUD: `springTorqueAt` bottoms at `SPRING_TQ_EMPTY` 0.34606, DERIVED,
  where 0.35 was authored; `trainTq` measures 1.000000 at every reserve.
- **Re-quoted at §150 (2026-08-21)** — §124 (23 clicks, 120/7 first
  stage) and §150 (the span-aware conservation solve) both re-cut the
  cone since this record: today u(1) = 10.2493 rad, `DRUM_ROT_FULL` =
  4.2279 rad = 0.6729 turns, `CHAIN_ENGAGED` = 44.554 u (the wrap's
  helix integral — no longer `R_wrap·(u − θ_s)`), `FUSEE_TORQUE_K` =
  3.2133, tip 3.0744, `SPRING_TQ_EMPTY` = 0.58749, service band
  5.9583 → 6.6312 turns at 6.6% off bind. Every identity claim above
  still holds — `trainTq` still measures 1.000000 at every reserve, and
  the level product is still exact algebra over §150's solved table.

**The instrument** is the `equalisation` battery gate (`checkEqualisation`,
oscillator-pattern): θ_s must sit on an integer ratchet click, the level
product `springTq·r/K` must hold at float noise over the sampled reserve
(measured 2.2e-16 — the pre-item-40 cone, a flank cut to a law the display
no longer obeyed, is exactly what this catches), and both ribbons'
published sections must still describe the cut metal, with the frozen
record cross-checked against the live build.

### CLOSED (§104, 2026-08-11) — the ALARM barrel's cadence is the governor's

The paragraph below is the remainder as it stood; §104 built exactly the
governor it names, and the closure is one line of `tick()` changing owners.
The alarm ribbon's arithmetic had been computed and published on the same
terms as the going spring's — the `EQUALISATION` record carried
k = 1.472e-5 N·m/rad from its as-cut section (a = 0.09512, c = 0.455,
L = 96.511) — and READ BY NOTHING: the cadence was one literal,
`ALARM_STRIKE_GAP = 0.42`, and `ALARM_RING_SECONDS` a product of it, so
the ring's time base rested on a number no spring produced.

Since §104 the k has its consumer. An unsprung recoil anchor at a ×8
stage off the strike arbor (×32 from the barrel) flutters on a 40-tooth
saw wheel — 80 teeth per strike — and the rate law
`gap(θ) = 160·√(2φ·I_a/(M(θ)·η/32))` runs ∝ 1/√M. The anchor's
poising-ring inertia is SOLVED so the designed 0.42 s lands at mid
strike travel (the oscillator's solve-never-retarget convention);
`tick()` spends the barrel at the law's instantaneous rate (0.374 s full
→ 0.488 s empty — the ring audibly slows); `ALARM_RING_SECONDS` is the
law's integral over the 28 strikes (11.86 s against the literal era's
11.76). The "in passing" note closed with it: the spring gained the
SET-UP the item asked for — 80 integer clicks (2.5 turns) on the §99
arbor ratchet, held under the ribbon's measured 4.3-turn ceiling — so
M(0) is 0.231 N·mm, not zero, and the last strikes stop at the set-up
floor instead of crawling toward stall. The `equalisation` gate's alarm
half grew from a report to HELD rows: set-up quantisation, ceiling,
the I_a solve at the design point, the ring's section inside real ring
stock, the hammer's fall window at the fastest gap, and the cadence
endpoints MEASURED by stepping the shipped tick law against the record.
The full record is `docs/BUILT.md` §104. Not absorbed: item 14's note
that `ALARM_HAMMER_W` comes from the strike timing rather than the
hammer spring's stiffness — cross-referenced there, still that item's
open scope. The saw wheel itself advances uniformly with the train; the
anchor's recoil is not kicked back through the wheel, the same accepted
class as the escape wheel's absent draw recoil (item 43's closing note).

## 33. CLOSED — the wells are bounded inboard again, by the bore instead of a wheel they no longer reach

`makeDial` cuts each sub-dial well as a pocket loop and the centre stack as
its own bore, both holes in one plate, and nothing checked they were disjoint.
Past `dial.subdials.radiusFactor` ≈ 1.196 the pockets **overlapped the centre
bore** and the build said nothing at all.

**Measured before the fix.** `centerBoreR = ALARM_TUBE_OUTER + 0.2 = 3.20`;
the reserve well's inner edge is `RESERVE_LOCAL.y − subDialR =
15.401 − 10.201·factor`. The two meet at 1.196. Booted across the range, the
dial's triangle count quietly fell as the triangulator dropped the
overlapping region, with **zero boot warnings at every step**:

| factor | subDialR | reserve inner edge | vs bore 3.20 | dial tris | boot warns |
|---|---|---|---|---|---|
| 1.00 | 10.20 | 5.20 | clear | 5392 | 0 |
| 1.15 | 11.73 | 3.67 | clear | 5392 | 0 |
| 1.20 | 12.24 | 3.16 | **breach** | 5384 | 0 |
| 1.30 | 13.26 | 2.14 | **breach** | 5320 | 0 |
| 1.50 | 15.30 | 0.10 | **breach** | 5306 | 0 |

**The battery could not catch it either.** At factor 1.30 — pockets 1.06 into
the bore — `support` reported 0 failures, `clearances` 0 violations, and
`inspection { includeExcluded: true }` 0 FORBIDDEN. It is a degeneracy INSIDE
one part's geometry, so it fell in the blind-spot family of items 5 and 6:
the pair sweep compares units, and this was one unit disagreeing with itself.
Rule 6 was the only instrument with standing, which is why the fix is a boot
assert and not a check.

**How the guard went missing**, which is the part worth keeping. The wells
DID have an inboard bound — §25 C's `−5.2`, against the central setting
wheel's tip — and it was correct for as long as the well WALLS descended
through the setting lane. Item 26 gave the dial real thickness and moved the
pockets inside it; the rings stopped reaching that lane, `wellsInLane` went
false, and the assert went dormant. Nothing was done wrong: the guard simply
stopped applying, as a SIDE EFFECT of a change made for another reason, and
no one owed a replacement because no one noticed one was owed.

### What shipped

Landed with §74 Tier A, because the same staleness that removed the guard was
also holding the wells 16% smaller than the movement allows.

- **The ceiling, re-derived against what binds now** and written in that form,
  per rule 1 — `subDialR ≤ min(stations) − (centerBoreR + WALL_HALF +
  CLEAR_MARGIN)` = `15.401 − 3.55` = **11.85**, where the stale form gave
  10.20. §25 C's version is kept in the comment rather than deleted: move the
  dial's stratum or the setting lane back into contact and it binds again.
- **The assert**, reporting the achieved web against the required margin per
  rule 6. Verified in both directions: silent at factor 1.0, and it fires at
  **1.02** (`reserve … web −0.09, need 0.15`) — the solve now sits exactly on
  its ceiling, which is what `radiusFactor`'s max of 1.0 has always claimed
  and, until this, no longer meant.
- **The centre stack moved to `layout.js`** (`HOUR_TUBE_*`, `ALARM_TUBE_*`,
  `DIAL_CENTER_BORE_R`, `DIAL_WALL_HALF`, `SUBDIAL_INBOARD_CLEAR`), so the
  solve that SIZES the wells and the geometry that CUTS the bore read one
  source. That duplication is precisely what let the old ceiling go stale, so
  fixing the number without fixing the split would have re-armed the trap.

**Two more copies of the well geometry existed, and both were wrong.** The
§34 selector's corridor assert carried the rings as literals — centres
(0, ±15.4) and radius 10.2, with the seconds centre already 0.1 stale (it is
at −15.5, on the fourth wheel's axis). It had been asserting a wall that
stopped existing the moment the wells resized. Read from the solve, it now
catches a selector post fouling the seconds well at factor 1.1 that the
literals missed entirely — a live bound recovered, not just tidier code.

### What this cost elsewhere, recorded because it was not predicted

Growing the wells **moved a mechanism part**. `JMP_AZ` — the minute jumper's
bearing — is *scanned* for clearance against the well rings, so re-sizing them
re-ran the scan and the bearing moved **304° → 320°**. Re-siting a station is
the sanctioned position-space resolution, and the old bearing stays legal at
the new radius (0.48 clear against the 0.15 margin; the scan simply prefers
320°) — but a DIAL parameter reaching a jumper through an obstacle scan means
this was never a finish-only change. The scan's comment now says so.

That move then made §48's audit surface a reversal **that was always real**:
the star is indexed by a sprung jumper, so it reciprocates by design, but no
axis had ever sampled it *through* the reversal, so the §36 registry never set
`reversed` and `restoring` had nothing to judge. It is declared against the
click spring the jumper unit already names. This is item 29's failure mode
reached from the other side — not a part no axis moves, but a part the axes
move and do not sample finely enough — and the general lesson is that the
audit's population is a function of the ARRANGEMENT, so a layout change can
hand it parts it never had.

**Verified**: 15/15 battery gates on the rebased tree, fingerprint
2217227919 deterministic across virgin boots, `restoring` 8 sprung → 9 (this
declaration and nothing else).

## 34. The §36 sleeve validation cannot fail — the dilation is measured from the sweep that then approves it

`buildSweptRegistry`'s path hulls are validated against a finer, phase-shifted
pose set than the one they were derived from, which is the right shape: a hull
checked only against its own samples proves nothing. A sleeve that escapes that
finer sweep is not thrown away — it is **dilated by its own measured overshoot,
doubled** — and a second pass then re-checks the dilated sleeve and demotes
whatever still escapes. The comment at that second pass has always conceded
half the problem ("partly self-fulfilling") while claiming the pass redeems it:
*"the honest arbiter is the second pass below … what this pass genuinely
arbitrates is whether the doubled headroom holds."*

**It arbitrates nothing.** §80 reduced the pass to the single comparison that
decides it, and the algebra is then plain. Growing every box of a sleeve by `g`
takes a vertex's Chebyshev distance to the nearest box from `best` to
`max(0, best − g)`, so "still outside" means `best > g + tol`. But `g` is
`2·over + tol` where `over` is the largest `best` the same fine sweep produced,
so `best ≤ over < g` for every vertex it measured. The test cannot fire. On the
shipped tree it does not: 43 sleeves are dilated and `stillEscapingAfterWidening`
is empty, and it would be empty for any geometry whatsoever.

**Why that matters and is not merely tidy.** The registry's whole claim is that
a volume CONTAINS its part at every pose. For the 43 dilated sleeves that claim
currently rests on one sample set both deriving the correction and grading it —
the containment is true of those 261 poses by construction and is an
extrapolation everywhere else. Every one of the 43 feeds `sweptOverlap`'s
static-vs-swept test as a hull, so an under-sized sleeve is an under-report, in
the one error direction §36 says it will not accept.

**What to build.** Give the dilated set an arbiter that did not set its own
homework. Cheapest honest form: a THIRD pose set — a different `validatePerAxis`
with a different phase offset, walked only over the dilated sleeves (a small
population, so the lap is cheap) — and demote what escapes it. Note the
constraint §80 documents at `walkPoses`: some of what `setPose` writes is
cumulative, so an extra lap re-poses those parts and moves the registry's
numbers. The third sweep therefore has to be designed as part of the walk
sequence, and the before/after report compared with that expected difference
understood, not asserted away. Second option, stronger and more work: bound the
sleeve from the part's DECLARED travel the way §36 job A bounds a revolve's arc,
so the correction stops being a sample statistic at all.

Until then the dilation is an honest measurement graded by itself, and the
second pass is kept — with the algebra written at it — because an assertion
that cannot fail should say so rather than quietly disappear.

## 35. CLOSED — a derived tooth count went to zero, and a gear with no teeth killed the build

`?alarmaz=175` and `180` did not boot: `Cannot read properties of undefined
(reading 'getPoint')`, thrown during module evaluation, so there was no
`__clock` and every instrument in the battery was unreachable.

**This entry was filed with the wrong cause, and the correction is the
point.** It originally said the defect "reproduces on `main`" and was
"unrelated to Tier B". Both were wrong. It was measured on a working tree
that already carried §74 Tier B step 1, and step 1 is what introduced it —
verified after the fact by booting `?alarmaz=175` against the commit before
it (`65ea7bb`), where it builds fine. The filing generalised from one tree to
"main" without checking, which is exactly the kind of claim this file exists
to stop people making about the movement.

**The real chain, from the stack rather than from a guess.** Step 1 made the
winding idler's tooth count DERIVED from the span it must cross:

    I ≥ (wSpan − (m/2)(B + P)) / (2m)

That expression answers "how many teeth to SPAN this run" and knows nothing
about a tooth count also being a piece of matter. Swing the alarm corner
round to ~175° and the climb arbor lands near the barrel: the span collapses
from 38.63 to **7.91**, the reach floor goes negative, and `Math.ceil` returns
**0**. `makeGear` then built a 0-tooth wheel — `gearOutlineShape` iterates
`for (i = 0; i < teeth; i++)`, so it emitted no curves at all, and
`Shape.closePath()` read `curves[curves.length - 1].getPoint` off `undefined`.

A TypeError, during evaluation, from a spec value the UI offers as a drag.

### What shipped, in three layers

**The floor belongs in the derivation, so that is where it went.** The count
is now the larger of the two floors — enough teeth to reach, and enough to be
a wheel at all. At the shipped corner both give 51, so the identity build is
bit-exact (fingerprint 2217227919).

**The trap is disarmed at the source** (§81's `weldAssert` precedent).
`makeGear` now refuses a count that is not a wheel, derived from its own radii
so the guard cannot drift from the builder: `rootR = module·(teeth/2 − 1.15)`
must clear the bore, with a hard leg at 3 below which the outline has no
curves to close. It warns with achieved and required numbers and CLAMPS, so a
future caller that computes a bad count gets a loud wrong wheel rather than a
dead page — inspectable instead of invisible. It is the backstop; the
derivation is the fix, and the guard is currently unexercised because of that.

**The closure's other bound is asserted too.** Step 1 checked only
`d ≤ r1 + r2`. A two-circle intersection also needs `|r1 − r2| ≤ d`, and a run
that is too SHORT is as unbuildable as one that is too long — no tooth count
fixes it, because growing the idler moves both bounds outward together. That
condition now has a name at the point it occurs:

    alarm winding chain: i1 → barrel 5.215 is INSIDE the chain's minimum
    reach 5.700 — the span (7.91) is too SHORT for a 3-mesh chain here;
    this run wants fewer idlers, not smaller ones

### Verified

`?alarmaz=` 175 and 180 now BOOT, reporting 9 named warnings each — the
corridor conflicts that were always there at those azimuths and were
previously hidden behind the crash. Identity boots silent at fingerprint
2217227919. The former crash band no longer differs in kind from any other
unreachable arrangement: it is red, and it says why.

### What this does not close

The refusal §33 promises at the UI layer is still not consulted by the
URL/spec path — a deep link or a saved variant still reaches the builders
directly. That is now a QUALITY question rather than a liveness one, because
the builders no longer die; it is worth doing, and it is not this item.

**And the general lesson, which outlives the bug.** A derived quantity
inherits every constraint its expression does not mention. This one was
derived from a distance and consumed as matter, and the gap between those two
readings was a whole dead build. When a constant becomes a derivation, the
question is not only "is the formula right" but "what did the old literal
also quietly guarantee" — 51 was never going to be 0.

## 36. TIER ONE BUILT — nothing in CI ever booted a non-identity spec

Every gate in the battery boots the DEFAULT spec. `?crownaz=`, `?alarmaz=`,
`?alarmmod=`, `?stemaz=`, `?barrelstep=`, `?escstep=`, `?balstep=`,
`?reserveh=`, `?vph=`, and every saved §33 variant reach the builders through
a path **no automated check has ever executed**. Six §33 handles, the §22
knobs, deep links and stored variants: the whole reconfigure surface is
uncovered.

**This is not hypothetical debt — it has already cost a shipped defect.**
Item 35 was a build that did not boot at all for `?alarmaz=` 175–180, shipped
in a PR whose battery was 15/15 green, and found only because §74 Tier B
happened to sweep corner azimuths by hand. A build that cannot boot has no
`__clock`, so *every* instrument is unreachable and nothing can distinguish
"this arrangement is illegal" from "the app is broken" — item 30's failure
class, arriving from a spec value rather than a code change.

**The machinery already exists**, which is what makes this cheap. §33
addendum 3's trial boot loads a candidate spec in a hidden same-origin
iframe with `?trial=1`, builds the REAL geometry, runs the REAL asserts and
reads `bootWarns` — and its own record notes it "is the CI battery's own
pattern (virgin page → read `bootWarns`), ~15 s per verdict". `state.js`
already guarantees a `?trial=1` page neither reads nor writes the session
state, so trials boot on virgin defaults: the battery's own verdict standard,
and deterministic.

**What to build — and note the assertion is NOT "boot is silent".** A moved
station legitimately warns; that is the true verdict, and demanding silence
would gate the wrong thing. So:

- **Tier one, liveness.** Every spec point in a declared set must produce a
  `__clock`. Unambiguous, no baseline to rot, and it catches item 35's whole
  class. A dozen points at ~15 s is ~3 minutes against `sweptOverlap`'s ~26,
  and it shards like everything else.
- **Tier two, characterisation.** Each point's boot-warning SET matches a
  recorded baseline, in §81's `--report` spirit: a gate that only checks
  "list empty" cannot see a report that moved. Worth having, but it is a
  snapshot test — it needs updating whenever a warning legitimately changes,
  and a stale baseline trains people to bulk-refresh it, which is how these
  die. Build tier one first and live with it a while.

**Choosing the spec set is the real design work.** It should cover each
handle's range including the corners that historically broke (the alarm
corner's 175–180 band, `d4` past 16 where the keyless side sign goes
degenerate), and it should be a DECLARED list in the repo rather than a
sweep, so a point that is expected to warn can say so beside itself.

**One caveat for whoever builds it.** A refusal and a crash must stay
distinguishable in the report. The point of item 35 was that they were not:
the check should say "spec X does not build" separately from "spec X builds
and warns", because the first is always a defect and the second is often the
honest answer.

### Tier one shipped: `spec boots`

A declared set of 12 spec points, each booted `?trial=1` in its own context,
asserting **liveness only**. `--spec-only` runs the tier alone (~51 s) so
iterating on the set does not cost a full battery.

**It caught its own motivating defect on the first run, and one more.** Run
against `5379d32` — the commit before item 35's fix — the gate fails and
names three dead points:

| spec | outcome |
|---|---|
| `?crownaz=90` | never produced a `__clock` |
| `?alarmaz=175` | never produced a `__clock` |
| `?alarmaz=180` | never produced a `__clock` |

**`?crownaz=90` is the one nobody knew about.** Item 35 was found by
hand-sweeping the ALARM corner, so it documented a 175–180 band; the crown
azimuth collapses the same winding span by a different route and died the
same way. The fix already covered it — the floor is in the derivation, so it
does not care which spec shortened the run — but nothing had ever ASKED, and
the entry for item 35 therefore understates the blast radius. This is the
argument for a declared set over a hand sweep, made by the set on day one.

Each failure reports the fatal message, the boot warns recorded before death,
and the page errors, because item 30's diagnosis machinery (`__bootError`,
`__bootWarns` published from main.js's first lines) was already there to read.

**What it deliberately does not assert.** Not silence: 10 of the 12 points
warn, and that is their true verdict, not a defect. The identity control is
held separately and tighter — if the default spec warns *here* while every
other gate finds it silent, the trial path differs from the real one, and
that is worth knowing on its own.

**Tier two — the warning-set baseline — is still unbuilt**, deliberately.
Live with tier one first; a snapshot test adopted early is a snapshot test
nobody trusts later.

### Addendum (§87) — a spec can now change which PARTS EXIST, and liveness cannot see that

§87 gave the hack rod its own pin on the setting lever, at a radius DERIVED
from the coupling each station achieves and capped at 1. The shipped movement
is the capped case: the pin lands on the tail post, which already carries that
eye, so **no stud is built and the identity fingerprint is unchanged**. At
`?escstep=-77.9`, `?escstep=-66.7` and `?balstep=27.6` the fraction is
0.696–0.761 and a real stud IS built — with its own §50 stock, its own
clearance through the base plate (which is cut as ONE sector for both studs,
because two slots overlap), and its own row in `LOW_LINKAGE_OBSTACLES`.

**Every instrument that would judge that stud runs at the identity spec only,
where it does not exist.** Tier one boots those specs and asks whether they
LIVE, which they do. Nothing asks whether the new part clears anything. The
gap was closed for §87 by hand — stud vs base plate 0.170 across the whole
crown stroke at every moved spec (the same 0.17 the tail post gets), closest
unit after the rod it carries is the reset rod at 0.61–0.97 — and a
measurement made by hand once is exactly the kind this file exists to name.

This does not change tier two's design; it widens what tier two is FOR. A
warning-set baseline compares words. What a spec-conditional part needs is a
per-point *structural* pass — at minimum `support` and `clearances` at two or
three declared points — and the honest reason not to have built it here is
cost, not doubt: those two checks are ~5½ minutes of the battery's wall at
one spec, and there are twelve points.

## 37. CLOSED (§99) — the alarm barrel holds its own wind: wound arbor, ratchet, and a click one mesh from the spring

§89 split this barrel into a fixed arbor and a body wound at its rim, which
is a real arrangement — this movement's own going drum is the other one —
and it is deliberately NOT the arrangement a textbook alarm barrel has.
A going barrel winds its ARBOR and a click holds it; the body delivers.

What that costs here was written into the build comment at the winding
train, and had been since §25 C — in a form §89 falsified:

> No click is modelled: in §25 A's single-member barrel (rotation IS wound
> state) a barrel click would block the ring itself; the hold is stage B's
> striking-wheel lock.

§89 removed that reason (rotation is no longer the wound state — the ribbon
is) and did not remove the consequence, so the comment has been rewritten
on the grounds that survive: a click must hold the member the winding torque
enters, which here is the toothed BODY — the same member the spring drives
the strike train from, so holding it holds the ring. **Nothing in the alarm
barrel holds its own wind.** What stops the body running back through the winding train
is the striking wheel's lock, four meshes downstream, and a wound alarm
whose lock is lifted for any other reason unwinds through the crown. The
crown's documented backward free-spin while ringing is the same fact seen
from the other end.

**The fix is the other split, and it is layout work, not mechanism work.**
Give the arbor a ratchet and a click, and re-route the winding train's last
mesh from the barrel's rim onto that ratchet: a different centre distance,
so `ALARM_WIND_IDLER_TEETH`'s reach solve re-runs against a new target, the
i1/i2 two-circle closure moves, and the upper-plate lane both idlers cross
(vertex-probed clear at z 10.1–11.6) has to be re-probed for wherever they
land. The click and its spring are two more parts in a band that is already
`LOW_LINKAGE_OBSTACLES`-adjacent.

Filed rather than done because §89's own priority note applies to it: the
spring is honest now without it, and this is a change whose only currency
is position space. Do it when the alarm's winding side is opened for
another reason.

**CLOSED by §99, the day after TODO 38's axis landed — the sequencing the
build plan ordered, so the click's working direction was policed from its
first boot.** What was built, against this entry's own predictions:

- **The "different centre distance" did not survive contact with the
  layout.** The arbor is COAXIAL with the rim the mesh was leaving, so the
  winding wheel takes the rim's own tooth count (`ALARM_WIND_W = 44`) and
  the reach solve, the i1/i2 two-circle closure, and the 12/44 crown ratio
  are bit-identical; the entire re-route is a STRATUM change — the arbor
  tier at z 11.61–12.97, each band derived body-top + `CLEAR_MARGIN` + the
  float-bind centi-unit. The lane re-probe this entry demanded came back
  EMPTY: zero foreign meshes cross the lifted band.
- **The state split is the real work.** `alarmBarrelWind` (relative
  arbor-vs-body wind) and `alarmStrikePhase` decoupled: the body's angle is
  a pure function of phase — which put the body⇄striking-wheel mesh on the
  coupled family at EVERY state, where the wind-derived law had the rest
  pose ~0.3 pin off-family, invisible to the pin⇄tail budget — and the
  arbor rides body + wind. Winding parks the striker; ringing parks the
  crown (both §25 C fictions retired). The `alarmWind` axis's phase
  back-out went with them, and its coverage claim was rewritten to what it
  now sweeps: the arbor's travel and the click's 56-cycle saw ride, n = 109
  coprime to 56 as it was to 28.
- **Two measured redesigns inside the click itself**, both of the class
  instruments exist for: `makeClick`'s straight blade fouls a 32-tooth saw
  at every park (its inner edge crosses the annulus over more than one
  pitch; the set-up click ships this invisibly because both its sides are
  fixtures) — the click is HOOKED, arm boot-asserted outside the tips, a
  V-nosed point the only dipping vertex. And the detent's fixed-azimuth
  ride shortcut parked that nose 0.24 inside a tooth (the nose's azimuth
  moves with its own lift) — the contact is SOLVED per tick, a coarse
  scan plus bisection for the smallest lift that clears the V's whole
  underside (Newton diverges at the tooth face's slope; the point alone
  misses a V edge on a tooth corner). Park kiss measured 0.0115, green
  against `HANDOFF_TRACK_TOL`. The ratchet's R took a third lesson: the
  grounding stud must also clear the arbor WHEEL's addendum plus its
  extrude bevel, which binds over the body's tip circle — R 5.9 → 6.0.
- **The hold is arithmetic** (TODO 16's format, in the build comment):
  ≈71 mN at the flank from the equalisation record's own M_max, carried by
  a face 15.4° off radial into the pivot side — the same closing geometry
  the set-up and maintaining clicks ship at 20.6°; the spring only
  re-seats after cam-out. The equalisation record reports the hold
  quantum: 2π/32 of arbor angle, half a strike's stored travel.

**§101 re-measured this mechanism against the eye** (a user report: "the
click doesn't interlock, worst while winding") and found three things the
instruments structurally could not: the saw was cut BACKWARD — winding
climbed the steep face and slid down the ramp, the exact mirror of a
ratchet's one-way, green under every gate because nothing gates
DIRECTION — fixed by `makeRatchetAndClick`'s new `reverse` cut with the
mapping's sign mirrored at every consumer; the V-nose's point contact was
invisible at the movement's scale — the beak is now cut TO the tooth
space (leading edge parallel to the face it holds against, back relieved
along the ramp + 0.02, only the point touching, arm slimmed 0.25 → 0.18);
and the deferred give-back is ENACTED (`settleAlarmClick`): on the wind's
falling edge and once at boot for a restored wound state, the arbor
recoils the parked fraction of one pitch — ≤ 2π/32, the hold quantum the
equalisation record was already publishing — as a STATE change that
travels the gears. Measured at landing: winding rides root→tip on the
ramp and snaps off the face; settle 0.0254 turns < the 0.03125 quantum,
seat at u = 0 exactly; park kiss 0.0164; pawl⇄saw penetration 0 over the
fine ride. The user's "collides with the post" was REAL — the arm's
flank grazed the spring HEAD face-to-face at high lift, invisible to a
vertex-sampled sweep and caught by the intraUnit gate — so the anchor
post's station is now derived from the arm's swept lane (asserted at
boot) and the spring's radius from its own chord.

Remaining honest residue, stated rather than hidden: the interactive
`aDelta > 0` guard is still the software edge of the one-way — the click's
metal now stands behind it (the saw's face geometry closes, and since §101
it faces the right way), but back-driving torque through the train to a
camming click is not simulated, only modelled; same class as the crown's
free-slip convention. The going side's set-up click and the maintaining
ratchet have never had their saw DIRECTIONS exercised either — both are
static or bench-only today, but §101's lesson (nothing gates one-way-ness)
applies to them the day either moves.

## 38. CLOSED — both winds are swept; the going axis is a CYCLE, and it found an undeclared reciprocator in its first hour

**The going tranche landed the way the item prescribed — after §82 shrank
the confirm tier — and the axis is a cycle, which the filing's own
"cheap version" almost talked itself out of.** The `wind` axis performs
a full wind from empty and the run back down within ONE axis
(w = 1−|2f−1|), because the registry's reversal test is within-axis by
design (an axis boundary is not motion the part made): a monotone wind
would have covered the states and still left the fusee's genuine
two-way drive unobserved. `tension` and `windAccumTurns` move as the
coupled pair they are, the span reads the live spec (`fuseeWrapTurns` =
reserveHours/8 — a `?reserveh=` boot sweeps the wind that spec
performs), and n = 720 is derived, not chosen: the train axis's own
standard is 96 samples per fusee revolution, and the wind turns that
arbor 3.75 revolutions each way. The ratchet-tooth-pitch features
(24/rev) are budget-tier work with their own `nSamples` override —
TODO 37's click will bring that budget.

**What the axis did, measured, in its first hour:**

- The §105-retired declarations returned exactly as their retirement
  comments promised: 'Fusee & great wheel' and 'Power reserve' re-entered
  the §48 population two-way and SURVIVED the confirm tier's 4×
  re-sampling — measured membership, not artifact.
- **It found an undeclared reciprocator**: 'Power-reserve train' entered
  restored-by-nothing the moment an axis performed the cycle it lives in
  — the gearing between the slip-coupled arbor and the hand, driven up
  by winding and down by running, TODO 29's alarm-lock story re-run in
  miniature. Declared two-way on the same grounds as both its neighbours.
- **It lifted the fixture-vs-fixture blindness on the fusee stack**
  (TODO 5's documented residue): the ratchet and great wheel became
  MOVERS the moment an axis wound them, and two standing rest-pose
  contacts became visible — the maintaining pawl seated in its saw
  (d = 0.0000, the working joint the maintaining-power block exists
  for) and the great wheel plate against its own makeGear hub ring (one
  part, two meshes). Both measured seated-not-buried and declared in
  `INTRA_UNIT_CONTACTS`; the restoring audit reads 19 units, 8 two-way,
  11 sprung, 0 unwaived, 0 stale, control PASS.

**The bill, paid knowingly.** The 720 poses grew every dense sweep —
`inspection` 719 → 991 s, `clearances` 534 → 744 s, `sweptOverlap`
352 → 428 s, same machine — and the guard pair re-derived by its own
arithmetic to 35/50 (the constant's comment carries it). Part of §82's
win, spent on coverage: the n is derived, so the number that could come
down is inspection's per-pose cost, roadmap-scale work if anyone wants
the minutes back. The projection the filing parked on — "sweptOverlap's
CI worst past an hour" — priced only the confirm tier; §82 fixed that
tier, and the dense sweeps' share is what remained.

**Stated residue:** the raw winding INPUT (`windPathRot` — the crown
wheel's own spin while winding) is still posed by no axis; `setPose`
has no field for it, the crown-side winding wheels are round rotors
whose hulls a spin barely moves, and nothing reciprocates there (the
click is one-way by design). Rule-4's population caveat covers it: a
part no axis moves is a part the audit cannot judge — filed here so
nobody mistakes the silence for a verdict.

The original filing, kept as the record:

### The alarm wind is swept (`alarmWind`); the going tranche remains (original)

The §36 registry, and everything sourced from it (the §48 restoring audit's
whole population), measures over `AXES`. Two axes touch the alarm's power:
`alarmStrike` poses `alarmStrikePhase`, and `setPose` derives
`alarmBarrelWind` from it — full to empty, monotonically. `alarm` poses the
setting crown. **Neither poses a wind-up**, and no other axis writes
`alarmBarrelWind` at all.

So the whole alarm winding chain — crown, climb arbor, two idlers, the
barrel's rim, and now (§89) the ribbon that stores the result — is swept in
exactly one direction, the one it travels while ringing. The direction a
user's hand drives it is uncovered. The going train has the same shape of
gap in a milder form: `reserve` sweeps tension 1 → 0 and `windAccumTurns`
is pinned at 0 on every axis.

This is the failure mode standing rule 4 already names for the restoring
audit — "a part no axis MOVES is a part it cannot judge" — one step out:
a part no axis moves BACKWARD is a part whose return nothing has swept.
TODO 29 is the precedent for what closing it looks like (`alarmToggle`
exists because nothing varied `alarmOn`), and it is also the warning: an
axis is not free. `sweptOverlap`'s confirm tier re-measures every candidate
over ALL axes, it is the battery's slowest check by an order of magnitude,
and its wedge guard already sits at 1.24× the worst observed run. A wind
axis has to be sized against that, and the honest sizing is not "n = 96
because the others are".

**The cheap version, if the budget is the problem:** the wind-up traverses
the same one-dimensional pose manifold `alarmStrike` already sweeps, in the
other direction. An axis that revisits those poses adds no NEW pose to any
collision check — only a direction change, which is the one thing the
registry cannot infer from a monotone run. That argues for a small n
chosen to keep the per-step hulls no coarser than `alarmStrike`'s, and for
measuring `sweptOverlap` before and after with `--report` rather than
assuming the cost.

**What this does NOT cost, measured at §89:** the restoring audit is not
blind here in the way it was for the alarm lock. The registry's `reversed`
flag is read from the step-to-step change in a mesh's own angular BOUND, so
a MORPHING part can trip it under a perfectly monotone axis: as the coils
redistribute, the extent the bound is measured from wanders rather than
advancing, and the sign of the step changes. The alarm ribbon trips it on
`alarmStrike` alone (the only axis that moves `alarmBarrelWind` at all),
which is why §89 could declare this barrel's spring without first adding an
axis. That is also the limit of the consolation, and worth stating plainly:
what the sweep sees is the ribbon changing shape, not the chain being driven
backwards through it. Every member of the winding train is a plain rotor,
and plain rotors stay monotone in every axis there is.

**Build plan — filed 2026-08-10, audited against the shipped `AXES`.**
One correction to this entry's own "cheap version" first, because it
changes what the axis is FOR: a plain rotor's swept hull over a span is
direction-independent, so revisiting `alarmStrike`'s poses backwards
would indeed add nothing to any hull — but the wind does not happen in
`alarmStrike`'s COMPANION STATE. That axis runs released and ringing
(`alarmReleased: 1`, §25 B's honest ring); a wind happens with the
striker PARKED and the §29 lock ENGAGED, and the strike pins backing
past the engaged pawl — the saw-tooth cam-out that IS the ratcheting a
real wind produces, the shipped model's own story for why a held pawl
still permits winding — is a pose combination no axis has ever swept.
The axis adds new poses after all; the entry's "only a direction
change" undersold its own subject.

- **W1 — baseline.** The current `main` battery `--report` is the
  acceptance base (one exists from §97/§98's landing). Nothing starts
  without it.
- **W2 — the `alarmWind` axis.** Poses the winding INPUT, not the
  output (TODO 20's law): the crown's pushed-in rotation over one full
  wind, `alarmBarrelWind` rising THROUGH the climb/idler/barrel ratios
  (rule 2 — the angles travel the gears; setPose gains the input field
  and derives the chain). Companion state is the honest wind:
  `alarmOn: 0, alarmReleased: 0`, striker parked, lock engaged. n
  matches `alarmStrike`'s per-step angular density over the same barrel
  span (its 109-over-28-cycles reasoning transfers verbatim, coprime
  argument included) — NOT "96 because the others are", per this
  entry's own warning.
- **W3 — cost, measured not assumed.** `sweptOverlap`'s confirm tier
  re-measures candidates over ALL axes; a ~109-pose axis grows the pose
  set ~14%. Run the full battery with `--report`, diff against W1:
  expected movement is `sweptOverlap`'s pairsTested/timings, the §36
  registry summary (revolve/path counts), and possibly `restoring`
  ROWS — parts newly driven both ways change class, which is the
  audit's population becoming more true, not noise. Re-measure the
  wedge guard's basis and re-derive its constant from the new worst
  run; the cost column follows the measured `ms`.
- **W4 — the going-train tranche, separately sized.** The milder gap
  (`reserve` sweeps tension 1 → 0, `windAccumTurns` pinned 0 on every
  axis) is the same shape but a different bill: winding the FUSEE
  re-wraps the chain, a morphing part with real hull churn. Measure a
  candidate axis's cost before committing to it in the same tranche;
  splitting the item is better than sneaking an unmeasured sweep in.
- **W5 — records.** This item closes (or narrows to the going tranche)
  with the before/after report diff quoted; no BUILT § — an axis is
  instrument work, TODO 29's `alarmToggle` being the precedent and the
  record format.

**Order against TODO 37, and why 38 goes first.** 37's fix is layout
work — the arbor ratchet, a click and click spring (new parts: MECH_GRAPH
rows, a `restoring` row for the spring, §50 sections), and the winding
train's last mesh re-routed onto the ratchet. A click is a
direction-dependent mechanism; landing it while the sweeps still only
run the ring-down direction would leave its working engagement — the
exact thing it exists for — unswept. Build 38's axis first and 37's
click lands with its working direction policed from day one.

**What landed — filed 2026-08-10, the same day, measured.** The
`alarmWind` axis exists (`src/inspect.js`, between `alarmStrike` and
`alarmToggle` — that station is load-bearing: its parity flip falls
exactly where `alarmToggle`'s first flip fell in the old walk, so the
column wheel's cumulative angle is bit-identical at every pose the old
walk had). It poses the winding INPUT as planned: `setPose` gained
`alarmWindRotation` — the crown's pushed-in rotation banked from empty,
the closed form of tick()'s own wind path through `ALARM_WIND_RATIO`,
assigned rather than integrated because a sweep revisits fractions
non-monotonically. n = 109 by `alarmStrike`'s transferred reasoning
(same 1.75-turn span, same 28 pin cycles, coprime, ~3.9 samples per pin
pitch). One correction to the plan's own correction, measured: the
saw-tooth cam-out was NOT the new coverage — the pin's withdrawal is a
physical ease no zero-dt sweep integrates, so the pawl rides the saw
under `alarmStrike` too. What is new is the companion-state combination
(lock engaged over a turning collar; the backing phase range below
`ALARM_PHASE_REST`) — the axis comment states it precisely.

**The before/after report diff, every moved row explained.** Baseline
19/19 (fingerprint 2134288613); landing run 19/19, fingerprint
bit-identical, both boots. `sweptOverlap`: pairsTested 59762 → 59372 and
registry path 196 → 186 / revolve 196 → 206 (ten Alarm-crown meshes
promoted to full revolves by the spoke rule at 210°/registry-step — true
semantics for a crown a wind spins); tight 2 → 4 (the two baseline rows
persist bit-identically; `feeler ⇄ sleeve` 0.1251 and `sleeve ⇄ silence
rocker` 0.1066 became measurable once poses stopped inheriting the
pulled-crown displacement — reports, real reachable clearances); refuted
19 → 19 (two Keyless-works hull overlaps entered and were refuted at 2.1
and 4.8). `intraUnit` 45 → 50 poses: the axis UNMASKED a standing foul at
the as-booted rest pose (TODO 42 — the first pose anywhere to name
`alarmCrownPullT: 0`). `restoring` 26 → 25: 'Alarm crown' entered
(declared two-way on the hand's grounds), 'Motion works' and 'Dial' left
— both had been carried by detector artifacts (TODO 43; ground truth
measured: star matrices bit-identical across walks, angle steps monotone
in every axis). The retired 'Motion works' declaration and the new
'Alarm crown' one carry the full reasoning at their sites. Wedge guard
45 → 59 min and the cost column re-derived from the measured runs, the
arithmetic in `ci-battery.mjs`'s comment (1.24 × 36.4 CI-worst × 1.295
measured workload growth).

**The going tranche stays open, and now has its bill.** Measured
(120-pose probes, same machine): a candidate `wind` axis (tension +
`windAccumTurns` rising together through the crown→ratchet chain) costs
1.27 ms/pose against `reserve`'s 1.45 — per-pose cost is NOT the
problem; the chain re-bakes every pose under both (121 distinct
geometries in 121 poses). The bill is the honest n: `windBack =
−windAccumTurns·2π` turns the fusee 3.75 revolutions over a full wind,
so the `train` axis's own density standard (96/rev) wants n ≈ 360 —
+40% on the total axis-sample count (1262/902), which projects the
sweptOverlap CI worst past an hour and moves the guard/job-cap pair
again. Land it after roadmap §82 shrinks the confirm tier, or accept
the hour explicitly; either way the number is now measured, not
assumed.

## 39. CLOSED (§100) — the going drum turns ON its arbor; the arbor and its ends live with the set-up work

**Closed as filed, with one prediction sharpened.** The fix was exactly the
two `makeBarrel` arguments §89 built (`arbor: false`, `arborBoreR` =
`barrelArborR + PIVOT_BORE_CLEAR`) plus the member move this item priced:
the arbor cylinder, its lower staff (the 0.6 the set-up square was always
filed onto — `SQ` across-corners quoted that staff's diameter from the
day it was built), and the three-quarter plate's bore registration all
belong to `Set-up work` now, built beside the collar, hook, square,
ratchet and click that always claimed to sit on them. The old
`addLowerPivot`/`addUpperPivot` calls on the rotating group are deleted —
and the lower JEWEL went with them: a jewel bears a rotating staff, and
this staff no longer rotates (the plain-seat arrangement the fusee's own
"no chaton" comment already argued). Measured: the arbor's world matrix is
bit-identical across the `reserve` axis while the body's moves, and the
member is continuous from the base plate's seat (−1) through the square
band to the plate bushing (8.107).

**The support edges moved as priced, and the graph now tells the fusee
story**: `Mainspring drum → Set-up work` (the body's bored floor and lid
run on the arbor — measured gap 0 through the ribbon-on-collar contact)
and `Set-up work → Three-quarter plate` (the arbor's top in the plate's
plain bushing, gap 0.05 = `PIVOT_BORE_CLEAR`) replace the two rows that
grounded the drum on both plates through furniture drawn on the wrong
member. The drum's EXPECTED grant against the plate became a Set-up work
row for the same reason.

**Residue, stated**: the arbor⇄square and arbor⇄collar joints are
fixture-vs-fixture inside one unit — TODO 5's still-invisible class, so
they are recorded here rather than as dead `INTRA_UNIT_CONTACTS` rows no
instrument can reach. The drum-bore⇄arbor bearing is cross-unit inside an
EXPECTED pair with no floors row — TODO 6's catalogued residue, not new
debt.

The original filing, kept as the record:

### The going drum's arbor turns with the drum it is supposed to hold (original)

The mainspring's inner end is genuinely pinned — TODO 1 built that, and the
parts it is pinned to are static: the collar and its hook lug belong to the
`Set-up work` unit, which does not rotate. The claim underneath that, the one
the explainer states in a sentence, is that the drum's ARBOR is held by the
set-up ratchet and the drum turns around it. This is a fusee movement, so it
is the right claim: a fusee's going barrel has a fixed arbor with set-up work
on it, which is exactly why the collar is where it is.

**The arbor cylinder does not model it.** `makeBarrel` builds the arbor inside
the group it returns, that group is a child of `drumGroup`, and `tick()` writes
`drumGroup.rotation.z`. Measured over the `reserve` axis, every mesh in the
`Mainspring drum` unit changes its world matrix, the arbor and its pivot staffs
included. The unit contains no static part at all.

**Nothing can see it and nothing measures it**, which is the whole reason to
write it down. A cylinder rotating about its own axis is visually identical to
one standing still, so no screenshot shows it; `intraUnit` compares movers
against fixtures *within* a unit and this unit has no fixtures; the collar it
is supposed to be held by lives in another unit, so their overlap is an
EXPECTED pair. A wrong claim that no instrument can reach is exactly what this
file is for.

**§89 built the fix and used it on the other barrel.** `makeBarrel` now takes
`arbor: false` (it stops putting an arbor in the rotating group) and
`arborBoreR` (floor and lid are bored for a fixed one, `PIVOT_BORE_CLEAR` over
its radius), and the alarm barrel is assembled that way: static arbor in the
unit, body turning on it. The going drum needs the same two arguments and one
thing the alarm barrel did not:

- **its pivots move with the arbor.** `addLowerPivot(drumGroup, …)` and
  `addUpperPivot(drumGroup, …)` hang the plate engagements on the ROTATING
  group. On a fixed arbor those are not pivots at all — they are the arbor's
  own ends planted in the plates, and they belong to whatever static parent the
  arbor gets (the set-up work is the natural one: it already owns the collar
  and the hook at that axis, and the set-up ratchet is what holds the arbor in
  the first place).
- **that moves a support edge.** `MECH_GRAPH` grounds `Mainspring drum` on
  `plate` and `Three-quarter plate` through those very meshes, measured at gaps
  of 0 and 0.05. With them re-parented the drum is supported BY THE ARBOR and
  the edge has to say so, which is a graph change and a re-run of the support
  sweep, not a rename.

So it is cheap in geometry and not free in declarations, which is why it is
filed rather than folded into §89: that landing had no reason to touch the
going train, and a change that moves support edges deserves its own battery
run and its own record.

## 40. CLOSED (§150) — the fusee equalises, and the chain is a fixed length of steel

**All three rows are CLOSED.** Rows 1 and 2 cut the cone to the equalising
law and made the readout read the radius the chain is on; row 3 — the
deferred ODE — landed as §150: the cone is cut from the span-aware
conservation solve, the `chainLength` gate holds the run to 0.5167 u =
0.633% over the reserve (tolerance 0.95 u, half a link pitch) with 43
links at every state of wind, and the waiver is deleted. The text below
is the item's record, kept in place per the heading convention.

Three arithmetic gaps in one mechanism, found by plotting the shipped
expressions in `explain.html`'s fusee plates (BUILT §91) rather than
drawing a picture of them. They share a cause — every one of them quotes
a fusee radius that is not the radius the chain is on — so they are one
item, with three rows that can be fixed independently.

The cone build states the goal in as many words:

```
// The cone profile and the spring model are chosen so S(t)·r_f(t) is
// constant: S = 0.35 + 0.65·t (linear spring), r_f = lerp(rLarge, rSmall, t),
// with rLarge/rSmall = S(1)/S(0) = 2.857.
```

The ratio is right and the conclusion does not follow.

**Row 1 — CLOSED. A straight generator cannot level a linear spring.** With `S`
linear rising and `r_f` linear falling, the product is a downward parabola:
it matches at the two ends by construction (that is all `rLarge/rSmall =
S(1)/S(0)` buys) and bulges everywhere between. Measured on the HUD's own
line, `trainTq = springTq · fuseeR / FUSEE_R_SMALL`:

| reserve | springTq | fuseeR (HUD) | trainTq |
|---|---|---|---|
| 1.000 | 1.000 | 2.6 | 1.000 |
| 0.502 | 0.676 | 4.992 | **1.298** |
| 0.000 | 0.350 | 7.4 | 0.996 |

...and against the radius the chain is really on (row 2), the peak is
**1.340** at reserve 0.553. A ±15% swing, from a mechanism whose entire
reason to exist is that there is no swing. What a level product needs is
`r(t) = FUSEE_R_SMALL / S(t)` — a HYPERBOLA, 7.4286 → 2.6, which is why
the endpoint ratio looked like a proof. At mid-reserve it wants 3.852
where the cone offers 5.15.

**What was built.** `fuseeEnvR(f) = FUSEE_TORQUE_K / springTorqueAt(f /
FUSEE_F_ACTIVE)` — the hyperbola — and `makeFusee` lathes it, taking the
law from the caller through a new `envR` argument rather than restating it.
`fuseeGrooveAt` reads the same function, so the cut, the chain path and the
HUD are one expression. Measured, `trainTq` is **1.000000 at every reserve**
where it ran 0.996 → 1.340 → 1.115 before.

**Only one number was free, and it is not the small radius.**
`FUSEE_R_LARGE` is a layout constant — the drum's station is derived from
it — so the constant product follows as `FUSEE_TORQUE_K = FUSEE_R_LARGE ·
SPRING_TQ_MIN` = 2.59, and `FUSEE_R_SMALL` stops being a choice: 2.4824 at
the band's top, 2.59 where the wrap ends. The hand-picked 2.6 was within
0.4% of the second, which is exactly how far the `S(1)/S(0)` = 2.857
reasoning got — right about the ends, silent about everything between. The
lathe's station count went 12 → 48 with it: a straight generator is exact
at any count and a curve is not (worst chord sag 0.0400 → 0.0030, against
the 0.08 the §61 seating budget works to).

**The curve forced the cut to change too — and caught the instrument
measuring a floor nobody had lathed.** A radial-depth groove fits a flank
only while `|dr/dz| ≤ grooveD / (chain half-stack)` = 0.66/0.33 = 2.42; the
hyperbola runs 5.28 at its base (79.3° from the axis, against the straight
cone's 59.9°), so metal half a stack below the groove stood up to 1.22 into
the chain's lower half — the §61 seating row went red at 1.989 against its
0.8 budget. Two defects were stacked in that number. The real one: the cut.
`makeFusee` now RELIEVES the floor — `floorAt(z) = env(clamp((z − bandZ0 +
reliefHalf)/bandSpan, 0, 1)) − grooveD`, the envelope sheared down half a
chain-stack — so the ideal wrap box touches the floor at its bottom-inner
corner and owes it nothing; at `reliefHalf = 0` the law reduces to the old
cut, which is the legacy path's proof. The crest between wraps stands on the
relieved floor capped at §54's `SLENDER_TARGET · landW` (a 0.025-wide fin
1.2 tall is λ 48 against the ceiling of 30), so at the steep base it
honestly stops short of the envelope and the chain there is retained by the
step of the turn below, as on a real steep-flanked fusee. The instrument
one: the seating row was RECONSTRUCTING its floor as a straight chord from
`rLarge/rSmall` — right only while the flank was straight; on the convex
hyperbola its floor sat ~1.3 outside the metal at mid-band. It now holds
`userData.groove.floorAt`, the lathe's own closure, and its budget
re-derives SMALLER: the slope term (0.57) dies with the relief, leaving
chording at the new smallest wrap radius (1.9²/(8·2.59) = 0.174) plus
HANDOFF_TRACK_TOL 0.03 — sum 0.204, held at 0.25 where 0.8 stood. Measured
after: worstDepth 0.133 at reserve 0.033, OK.

**Re-cut by item 32, as predicted.** The flank was solved FROM
`springTq`, so an exactly equalising cone was exact arithmetic on an
authored law — and deriving the law from the ribbon re-cut this cone a
third time, the same work rather than a separate errand: the hyperbola
`K/S(t)` became the inverse square root `r₀·θ_s/u(t)` (r_min 2.5608, tip
2.4889), the NCORE sag table and the relief prose were re-measured (base
slope 5.28 → 10.44), and the §61 budget's chording term re-derived at
the new r_min (0.174 → 0.176, sum 0.206, still held at 0.25). Item 32's
entry records the derivation; the `equalisation` gate holds the level
product at float noise.

**Row 2 — CLOSED. The equalisation multiplied by a radius the chain never
reaches.** The HUD's `fuseeR = FUSEE_R_LARGE + (FUSEE_R_SMALL −
FUSEE_R_LARGE) * reserveShown` swept the FULL 7.4 → 2.6 band. The chain's
own take-off does not: `rebuildChain` puts the active groove at
`fuseeGrooveAt(tension * FUSEE_F_ACTIVE)`, and `FUSEE_F_ACTIVE` is 0.9375
(3.75 wrap turns over 4 cut groove turns), so at full wind the chain pulls
at **2.9**. The tip's 2.6 carries the runout and nothing else. The readout
now calls `fuseeGrooveAt(reserveShown * FUSEE_F_ACTIVE).r` — the same
function the geometry is cut from, so there is one expression for the
quantity instead of two that drifted 11.5% apart at full wind.

It made the bulge WORSE, as predicted: the product now reads 1.115 wound
rather than 1.000. That is the honest direction — the old number flattered
the cone by quoting a lever it does not have — and the flattening itself is
row 1's problem, not this row's.

**And it exposed a display claim nobody had measured.** The bar is
`clamp(trainTq * 100, 0, 100)`, and BOTH the old and the new expression
exceed 1 everywhere except at empty, where they agree — so the rendered
width did not change by a pixel, and the train-torque bar has been PEGGED
at 100% across essentially the whole reserve. It shows "level" by
saturating, not because the mechanism levels it, and its CSS class is
literally `.flat`. Filed here rather than fixed: what that bar's scale
should mean (a window around 1? the ±15% swing at full deflection?) is a
display decision, and the honest version of it is only worth designing
after row 1 decides what the number is going to be.

**Row 3 — the drum's rotation is linear in the reserve where the chain's
take-up is quadratic, so the chain changes length.** The cone gathers
`2π · turns · r̄` of chain, and `r̄` is the mean of the radii the wrap
spans — `(7.4 + 2.9)/2 = 5.15`, not the `FUSEE_AVG_R` 5.0 that
`CHAIN_ENGAGED` books it at. Worse than the 3% that costs at the endpoint
(`DRUM_ROT_FULL` = 1.759 turns where the chain wants 1.812), the
relationship is not linear at all: chain on the cone goes as
`174.36·t − 53.02·t²` while the drum pays out `117.81·t`. The drawn path
is therefore ~160 u at both ends of the reserve and ~172 u in the middle.

**This one is measurable on the shipped mesh, not just on paper.**
`rebuildChain` sets the link count from the curve's own length, so the
chain physically gains and gives back links as the watch runs down —
vertex counts over `setPose({ tension })`:

| reserve | 0 | 0.25 | 0.5 | 0.75 | 1 |
|---|---|---|---|---|---|
| chain mesh vertices | 64,552 | 68,226 | 70,744 | 69,196 | 66,100 |

+9.6% at mid-reserve against empty, ~8 links appearing and disappearing.

**MOSTLY BUILT with row 1.** `fuseeChainTo(t)` is the wrap integral in
closed form and `drumRotAt(t) = (CHAIN_ENGAGED − fuseeChainTo(t)) /
DRUM_WRAP_R` replaced `(1 − t)·DRUM_ROT_FULL`, so the two SPOOLS balance by
construction at every state rather than only at the ends. Re-measured the
same way:

| reserve | 0 | 0.25 | 0.5 | 0.75 | 1 |
|---|---|---|---|---|---|
| chain mesh vertices | 56,812 | 55,842 | 55,842 | 55,842 | 56,812 |

1.7% peak-to-peak, and flat across the whole middle.

**What was left was ONE named term: the free span — and §150 absorbed
it.** Its length is `√(D² − (DRUM_WRAP_R − r(t))²)` plus a z leg, so it
shortens as the take-off radius falls — 0.84 u planar, measured — and
item 32 deliberately did NOT absorb it, for the reason its derivation
made concrete: the closed form `u(t) = √(θ_s² + β·t)` integrates
`dC/dt = 2π·W·r` with every unit of chain exchanged cone↔drum, and
adding the span's give makes the solve an ODE with no closed form. §150
built exactly that ODE (fixed-step RK4 at boot, bit-reproducible, the
closed form kept as its S′ ≡ 0 control) — and found the row had
under-counted: the DRAWN coil's angle also carries the takeoff tangent's
WALK around the drum wall (`dθT/dr = 1/S_planar`, ~1.4 u over the
reserve, the span's own order with the opposite lever), and the display's
0.05-turn wrap floor was minting 1.72 u of chain at dead reserve that no
bookkeeping could pay for. The solve conserves all three ledgers — wrap
helix, 3-D span, coil angle — and the fear filed here ("`D` also drags
the drum's STATION into the wind accounting") did not materialise:
holding `FUSEE_LEVEL_P` and the set-up pins r(0), so D is a constant of
the ODE and no layout fixed point exists. `DRUM_ROT_FULL` is
u(1) − θ_s = 0.6729 turns under the solved law (the 1.3386 this row once
quoted was the pre-§124 value).

**The instrument now exists, and it reports WORSE than this row estimated.**
`chainLength` (`checkChainLength`, registered in `CHECKS` and in the battery
at cost 1 — 38 ms) sweeps the reserve at 41 poses and measures the shipped
layout curve through `__clock.chainRunLength`, so it compares the model
against itself rather than against a second copy of the arithmetic.

| | measured |
|---|---|
| run length, min → max | 81.1598 → 82.7791 u |
| spread | **1.6193 u = 1.984%** |
| tolerance (half a link pitch) | 0.95 u = 1.164% |
| link count over the reserve | **43 and 44** — not constant |
| worst at | max at reserve 0 (run flat), min at 0.1 |

**1.984%, not the 1.1% this row predicted.** The old figure came from vertex
count, which is quantised to whole links and therefore under-reports; the
curve's own length is nearly double it. The link census beside it is the same
fact read from the mesh side — the run lays 43 links at some states of wind
and 44 at others, so it is demonstrably a different chain.

**The tolerance is derived, and is not free to move.**
`buildChainLinkGeometry` lays `N = max(round(len / CHAIN_PITCH), 2)`, so a
length change under half a pitch cannot change `N` and the model genuinely
cannot see it; at half a pitch the run gains or loses a link. `CHAIN_PITCH`
is itself pinned to a manufactured 0.72 mm, so the number belongs to the
chain rather than to this check. Sampling is pinned at 4000 divisions for a
reason written at the exposure: the control-point count varies with tension,
so a density tied to the curve's own parameterisation would read its control
density as length drift. Convergence measured — 0.0025% between 500 and 8000
divisions, stable to 1.5e-6 relative from 2000 up, four orders under the
tolerance.

**The row is GREEN and gated since §150 — the waiver is deleted.** The
same check now measures spread 0.5167 u = 0.633% against the unchanged
0.95 u tolerance, min 81.4618 at reserve 0.025, max 81.9785 at 0.975, and
the link census reads **43 at every state of wind** — the two independent
readings agreeing that the run is one chain. What remains of the spread is
the drawn path's own residue (spline sag inside the control polygon, the
hook congruence's bounded fractional redistribution), named here and well
inside the tolerance the link pitch derives. TODO 49 is UNBLOCKED by this
closure: pinning the chain's fusee end has its exact-length prerequisite.

## 41. CLOSED — both well hands ride a plane derived from their own section; the reserve hand was 0.0014 off its floor

Found by seeding §94 tier A's `EXPECTED_CONTACT_FLOORS` rows: `Dial ⇄ Small
seconds` measured **0.12** at every pose, against `CLEAR_MARGIN` 0.15, and
the row shipped WAIVED citing this item.

The number was not a collision and not a near miss — it was the same figure
everywhere, because it was a standoff someone typed:

```js
smallSecondsHand.position.z = -(SUBDIAL_RECESS - 0.3);
```

0.3 above the pocket floor, and the hand's bur rod is a keeled triangular
section whose keel hangs `rBase` below the mounting plane — 0.18 at this
hand's `rBase` 0.18 (§50's hand floor, TODO 12). 0.30 − 0.18 = **0.12**,
and the one clearance margin is 0.15. Rule 1: the 0.3 stated no
constraint, and the constraint it happened to be spending was the margin.

**Why this pair could not say so before §94.** `Dial ⇄ Small seconds` is
EXPECTED, so TODO 6's blanket covered it, and the pair is also a LABEL
NESTING — the hand is a `dialFace` descendant, so every Small-seconds mesh
is also a Dial mesh and the pair loop was measuring the hand against
itself, 0 at every pose. §94 excludes the shared meshes (an intra-unit
question, item 5's, not this check's), which is what let the real
clearance be read at all. Worth noting what the EXPECTED grant was ever
FOR: there is no contact between these two units — the well, its bezel and
its printed face are Dial meshes and the unit contains only the hand.

**The check-the-other-hands pass found the worse case.** The reserve hand
is a `'minute'`, so its blade inherited the CENTRAL minute hand's width
law — `length·widthFactor·0.35`, tuned on a hand ~3× as long — giving
`rBase` 0.2986 at sub-dial length. Measured before the fix, its keel rode
**0.0014** over its well floor and its boss dipped 0.088 below the floor
plane into the bore, with no instrument on the pair: it is EXPECTED and
had no floors row, exactly this item's residue warning. The 0.5 pocket
mathematically cannot hold that blade at the margin (it caps `rBase` at
(0.5 − 0.15)/1.5 ≈ 0.233), so the section was the defect, not the
standoff: TODO 12's tranche four had already declared the class rule —
"sub-dial hands ride the floor" (`rBase` 0.18) — and only the `'second'`
builder branch was applying it. `makeHand` now takes `subdial`, which puts
an hour/minute-kind hand on the same §50 floor section (`HAND_RBASE_FLOOR`
in `geometry.js`); the reserve hand passes it, and slims from a blade the
pocket could not hold to the one its well-mate already wears.

**The fix is the derivation the item asked for.** `makeHand` exports the
section's facts on `userData` (`floorDrop`, `topRise`, `bossR`/`bossH`),
and `wellHandZ` (`src/main.js`, beside the small-seconds hand) derives the
plane from two constraints instead of a number: keel-side, `lift ≥
floorDrop + CLEAR_MARGIN` over the pocket floor (whose printed face lies
on it at zero offset); face-side, `lift ≤ SUBDIAL_RECESS − topRise` so the
open metal stays sunk below the dial surface. The hand rides the middle of
that band — equal slack both ways, no free number, and the floors-row gate
(a strict `min ≥ CLEAR_MARGIN` over float32 meshes) is held off float
equality by construction. The boss is outside both figures as the joint's
own member: its below-keel column is excused by the bore it rides over
(asserted: `bossR + CLEAR_MARGIN ≤ SUBDIAL_BORE_R`), and it stands proud
of the dial face by `bossH/2 − (SUBDIAL_RECESS − lift)` — sinking the
collet too would need recess ≈ 0.57, a dial z-stack renegotiation this
close does not own. Both budget asserts warn per rule 6, which is the
`SUBDIAL_RECESS` re-measure the item called for: the pocket must hold
`floorDrop + CLEAR_MARGIN + topRise` (0.47 for the seconds hand, 0.42 for
the reserve, against 0.5).

Measured after: seconds keel 0.165 over the floor (lift 0.345), reserve
keel 0.19 (lift 0.37); everything but the collets sunk below the face.
The `Dial ⇄ Small seconds` waiver is deleted, and the pass seeded `Dial ⇄
Power reserve` as the same claim — no contact exists between the units, so
the pair owes clearance everywhere (TODO 6's index row records what that
leaves unseeded).

**The central hands were checked and left alone.** The minute hand's 2.3
and the hour/alarm planes are z-stack quantities datumed against
`ALARM_HAND_Z`'s derived lane (the `handsGroupZOffset` record in
`aesthetics.json` documents that derivation), not floor standoffs of this
class; their pairs have no wells to scrape and their crossing envelope is
bounded where the rod widths are set (`makeHand`'s crossing note).

*(§153 postscript: the RESERVE half of this item's fix moved on. The
reserve sector went barely-recessed — `RESERVE_RECESS` = 0.25, under
this item's own 0.42 section bound — so its hand left `wellHandZ`'s
band: it rides mostly proud of the dial face, its plane
ceiling-anchored one margin under the §25 C rattrapante blade's sweep
lane, keel margin-plus-residue over the shallow floor, boss keeping
this item's ride-the-bore excuse and its assert. The SECONDS hand
keeps this item's derivation verbatim, and `makeHand`'s `subdial`
section law — the substantive half of the fix — carries both hands
unchanged.)*

## 42. CLOSED (§103) — the guide stack derives downward: the item's own window was empty

**The prescription had no solution, and proving that was the work.** This
item asked for `ez ≥ (stub z) + STOCK_MIN_U + CLEAR_MARGIN` with the stub
held at its first-cut station — but the bound it told the mover to check
("the collar above") caps that corridor: from the stub's rest top (−5.14)
to the collar's pulled underside (−4.87, the fat radius under the corner)
there is 0.25 of air, and an eye needs `STOCK_MIN_U + 2·CLEAR_MARGIN` =
0.62. That is TODO 23's arithmetic, one guide up, with the same verdict —
no station exists for the eye between the stub and the collar.

**So the stack derives DOWNWARD from the corridor's top instead**
(`ALARM_LIFT_EYE_Z` / `ALARM_LIFT_STUB_Z` / `ALARM_LIFT_BLADE_Z`, each
constraint in its comment). The eye's top face sits exactly where the
plunger's top arrives at full depression — the highest station at which
the bore holds plunger at EVERY pose, which also keeps the head out of the
bore (measured: flush at exactly full travel, 0.00) and finally makes the
build comment's "riding clear of it across the full travel" claim true.
The stub drops to hold this item's inequality at equality below the eye
(measured 0.150 at rest, the closest approach — the L's whole travel is
downward, so travel only opens it, to 0.375 pulled), and the blade root
keeps its as-built bearing relation to the stub, bottom faces flush, made
exact instead of rounded. Boot asserts hold the stack's two open ends with
the achieved numbers: collar-over-eye 0.250 at both parities,
blade-over-chord 0.184 (pose-invariant — tip and chord co-travel). The
`INTRA_UNIT_WAIVERS` row is DELETED; the instrument measures the repair.

The original filing, kept as the record:

### The lifter's blade stub stands 0.167 into its own guide eye at rest — and the instrument only just gained the pose that shows it (original)

Found by TODO 38's `alarmWind` axis, which is the first pose anywhere to
NAME `alarmCrownPullT: 0`. That matters because the pose net carries
residue: fields a pose does not name ride through from the previous pose,
and the `alarm` axis (which precedes everything alarm-side in `AXES`)
poses `alarmCrownPullT: 1`. Every `intraUnit` measurement pass therefore
inherited a pulled alarm crown, and the release lifter — whose L slides
down when the head reads the stem collar's fat plateau — was only ever
measured DEPRESSED (blade stub at z −5.52, clear of everything). The wind
axis resets the pull, the measurement pass finally sees the REST pose, and
there the stub stands inside the eye.

**The numbers.** The stub (r 0.3 cylinder on the sliding L, built at
z −5.3, `STOCK_MIN_U` thick) tops out at −5.14; the guide eye
(`ringGeo(0.17, …)` at `ez = −5.15`, same stock) spans −5.31..−4.99. That
is 0.167 of z overlap with radial metal crossing from the bore (0.17) to
the stub's rim (0.30) — at the AS-BOOTED pose, the worst case, since the
L's whole travel is downward from rest. The build's own comment claims the
blade bears "under the guide eye, riding clear of it across the full
travel"; measured, it does not ride clear at the top of that travel.

**Why it was invisible.** `intraUnit`'s classification pass DOES visit the
rest pose (its base signature is taken right after `resetInputs`) — but
classification only marks movers; the measurement pass re-walks the poses
with residue, and residue kept the L off its rest station. Not a sampling
gap: a state-coverage gap of exactly TODO 38's kind, one field over.

**The fix is the eye's station, not the stub.** TODO 23 already did this
arithmetic for the guide it removed ("0.04 into the stub at rest" was that
guide's verdict); the surviving eye wants the same treatment: derive `ez`
from the constraint that its lower face clears the stub's top at rest —
`ez ≥ (stub z) + STOCK_MIN_U + CLEAR_MARGIN` — and re-site the carrier arm
with it (the plunger is long; the eye still has plunger to guide at the
raised station, but the head's rest bottom and the collar above bound how
far up it may go — check both when moving it). Until then the row is
waived in `INTRA_UNIT_WAIVERS` citing this item.

## 43. CLOSED (§105) — the detector stopped lying: five artifact mechanisms fixed, ten units measured out of the population

**Closed with two more mechanisms than it filed.** The three filed fixes
landed as prescribed — the witness-circle fit runs over DISTINCT states
(repeats no longer vote, the registry's own convention covering its last
holdout), the track centroid dedups positions by QUANTIZED key (the
builder's seam copy is computed at θ = 2π, one ulp of sin away from the
θ = 0 original, so the exact-match dedupe this item imagined would have
missed exactly the copies that matter), and long-span aliasing died with
the CONFIRM PASS below. Fixing them exposed two more of the same class,
both now also fixed and worth the record:

- **The fit's degeneracy test was calibrated to the artifact.** Kåsa's
  `|det| < 1e-12` was ABSOLUTE, sized against with-repeats moment sums;
  fitting distinct states shrank the sums ~10× and healthy fits started
  null-rejecting into the path branch. The test is now RELATIVE
  (`det/(suu+svv)²`, a pure collinearity measure) — scale cannot move it.
- **The extent's `lo` is not a phase, and the biased centre was hiding
  that.** Steps were `arcs[i].lo` differences; about the TRUE centre a
  wheel disc's extent covers the full circle and WHICH vertex sits past
  the ±π wrap flips as it turns, so `lo` jumps by whole vertex gaps —
  promoting monotone train wheels to 'oscillates'. Steps now come from
  the WITNESS VERTEX's own angle, which advances by exactly the rotation.
  And the sign chains across DWELLS: the fork parks on its bankings
  between strokes, so adjacent-step products laundered its ± through the
  zeros — the finer the sampling, the blinder that test got. A dwell step
  neither votes nor resets.

**Aliasing closed by confirmation, not by hope (§36 job B's shape).** A
coarse-walk sign flip is now a CANDIDATE tied to its axis; a deferred
mini-walk re-samples that axis at 4× and only a reproduced flip becomes
the verdict. A true reciprocation flips at every sampling rate; an
aliased orbit — the crown's knurl teeth under `alarmWind`'s 210°/step,
this item's case 3 — evaporates the moment the rate resolves the path.
The mini-walks run AFTER both standing walks so neither's cumulative
pose history moves, and they patch only the `reversed` flag: hulls stay
exactly what the containment walk validated.

**Measured outcome, by the item's own arbiter.** TEN units left the
population (mesh-level 27 → 17; audit population 26 → 16): Alarm crown,
Alarm setting arbor, Escape wheel, Fusee & great wheel, Heart cam,
Power reserve, Reset hammer, Setting lever, Third wheel, Yoke — every
one verified MONOTONE in every axis from its own matrices at 4× the
registry's rate (the star's ground-truth method, applied wholesale).
Zero units entered. The pallet fork — §48's asserted control — stays
two-way, and the registry is bit-stable across repeated builds. The ten
stale declarations are retired with their mechanism truth kept in place
as comments (the 'Motion works' precedent): most were true of the WATCH
(the hand does turn the crown both ways; a real escape wheel does
recoil) and never of the pose net, which is §48's population rule doing
its job — they return the day an axis performs the cycle they describe
(TODO 38's parked going-wind tranche is exactly that axis for the fusee
and the reserve).

TODO 7's caveat stands, narrowed: sampling still cannot BOUND motion —
the confirm pass removes a class of false positives; false negatives
remain the sampling tier's residue.

The original filing, kept as the record:

### The §36 registry's `reversed` flag is a function of walk composition, not just of motion — three measured artifacts (original)

TODO 38's axis changed `restoring` verdicts for two units whose geometry
tracks were BIT-IDENTICAL at every shared pose (measured: 0 differing
matrix elements across the whole double walk). Both flips were detector
artifacts, and both mechanisms are worth writing down because any future
axis — W4's going-train wind first among them — will stir them again:

1. **The witness-circle fit weights per-pose duplicates.** `series` is
   per-POSE ("per pose, SHARED"), and `fitCircle` runs over it — so a part
   that rests through nine axes and moves in one has its fitted centre
   dragged toward ~100 copies of the rest frame. The registry's own header
   states the convention this violates: "repeats add nothing either way"
   — arcs and r-bands are per-frame, the fit is the one consumer where
   repeats still vote. The 'Motion works' star lived on this: its
   ~1e-4 rad beat steps, parametrized about the biased centre, flipped
   sign-change verdicts with the pose population; adding 12 inert poses
   evaporated the reversal that TODO 33's resample had conjured. Ground
   truth (angle steps from the star's own matrix): monotone in every axis
   — the jumper's back-off is the SNAP, an ease, invisible at zero dt.
   Fix: fit over distinct states. This will move rows for every planar
   mover with a resting majority — re-derive against a fresh `--report`
   diff, not the PASS column.
2. **Seam vertices bias vertex-averaged centroids off-axis.** three.js
   cylinders duplicate the θ=0 ring vertex, so the 'track' path's centroid
   sits ~2r/(segs·2+2) off the rotation axis (measured 0.031 on the
   r 0.55 stem collar) and ROTATES with the mesh — a pure rotation reads
   as a small circular translation.
3. **Long-span axes alias the step direction.** At the registry's 12
   samples, `alarmWind`'s 6.42 crown turns are 210° per step; consecutive
   chords of the seam-bias circle then point against each other and the
   deadband passes them (the track extent is real). 'Alarm crown' entered
   the population exactly this way — a monotone spin read as out-and-back.
   The unit IS hand-driven both ways, so its new `two-way` declaration is
   true on the mechanism's grounds and the landing is honest — but the
   detector said so for the wrong reason, and the next unit this fires on
   may have no true declaration to give.

The registry's §80 comment already owns the walk-history sensitivity for
POSES ("the pose a walk lands on is a function of the walk history");
this item extends it to VERDICTS, with the three concrete mechanisms.
None of this weakens what `reversed` is for — the §48 population — but a
population whose membership can flip on inert pose insertions will keep
spending diagnosis time exactly like TODO 38's landing did. Fix order:
(1) is the load-bearing one, (2) and (3) mostly matter because they feed
it and the track test.

## 44. CLOSED (§112) — the lock collar is held to the striking arbor by parentage, not by metal

Found by §107's `assembly` check on the run that landed it — the first
thing that instrument reported which was not the defect it was written
for, which is the argument for having written it.

**Measured.** Every mesh on `alarmStrikeRotor` rides one moving frame, so
they are one part: cam, both sleeves, the pinion and §104's 64T governor
wheel are connected metal. `alarmLockCollar` is not. Its nearest approach
to any other rotating member is **0.2117** — the axial gap between its top
face (8.98) and the cam's underside (9.20). The collar turns because it is
a child of the rotor group, and for no other reason; nothing that turns
touches it.

**Why nothing caught it before.** `intraUnit` compares a unit's MOVERS
against that unit's FIXTURES (TODO 5's interim). The collar and the cam are
both movers, so no pair the battery measured ever contained them. The one
declared contact the collar has is with `CylinderGeometry#0` — the STATIC
stud it surrounds — which is the bearing idiom, not a drive joint. A part
whose only declared metal is the fixture it rotates around is exactly the
shape of this defect.

**Fix, with its arithmetic.** The same turned step this shaft already uses
one level up: `alarmStrikeSleeve` exists precisely to be the 0.3 u step
between the cam's top and the pinion's underside, and its comment says so.
The collar wants its twin — a step at the shaft's own ⌀ (r 0.75, well
inside both the collar's 3.2 and the cam's radius, so neither of §25 B's
derived clearances is touched: 0.17 over the plate top and 0.22 under the
cam are DISC-face clearances at large radius). It needs an
`INTRA_UNIT_CONTACTS` row against the stud on the coincident-solids idiom,
a shaft stock kind, and it moves the fingerprint.

**Why it was not fixed in §107.** It belongs to §25 B's mechanism, not to
the governor §107 was landing, and the repo's own order says a finding
outside the group is filed with its arithmetic rather than absorbed into
an unrelated landing. The row is waived in `ASSEMBLY_WAIVERS` citing this
item, so it stays red in the report until someone spends it.

**CLOSED by §112 (2026-08-13), and almost by accident.** The tier-split
re-derived the strike sleeve's span — hub of the 64T wheel up to the
cam's underside — which is the turned step this item prescribed, running
straight through the collar's band: the assembly check now measures the
striking-wheel rotor as ONE body over the pose net (no split to waive),
and the stale `ASSEMBLY_WAIVERS` row is removed. "Almost by accident"
because the sleeve moved for the band swap's stacking arithmetic, not
for this item — the closure was noticed when the waiver's group label
stopped matching and no violation surfaced behind it.

## 45. CLOSED (§120) — the escapement has drop, the bearings are located, and the stone question is answered twice over

Opened by §107's fracture investigation as "the blades are too thin", widened
by the owner (2026-08-12), re-founded by §111 (which measured the real defect
underneath: the engagement itself), largely closed by §113, which re-derived
the escapement as a flat-faced recoil anchor with real drop, and CLOSED WHOLE
by §120, which located both bearings axially and answered the stone. Where
each strand ended:

| strand | state |
|---|---|
| **One** — saw teeth and pallet blades occupy the same space | **CLOSED by §113** — the escapement has drop; the `penetration` waiver is retired. Residue below. |
| **Two** — the pallet FACES: should they be ruby? | Answered: no. Leave them steel; the number is below. |
| **Three** — the PIVOTS | Bore CLOSED by §111. **Endshake, retention and the oil sink CLOSED by §120; the stone answered NO, on two independent measurements.** |
| The blade SECTION (§107's original finding) | CLOSED by §111; §113's flat face then made the section structural (= the offset) so the trap cannot recur. |

### Finding one — CLOSED by §113: the escapement has drop

§111's diagnosis was that the interference could not be cut away because it
WAS the design: §104 generated each face as the engaged tip's entire
trajectory ("contact closed at every instant"), which forces the pallet half
a tooth pitch into a wheel whose teeth are one pitch apart. Measured then:
0.286 u by MTV, 0.245 u by polygon depth, all cycle long, with the cheap
cures ruled out by number.

§113 rebuilt the engagement as the real thing — a short FLAT face at a
solved incline, contact closed during impulse and OPEN during drop — and
every quantity in the design is derived (src/main.js, the §113 block):

| quantity | value | derivation |
|---|---|---|
| anchor distance D | 7.051 | = tip circle + hub + `CLEAR_MARGIN` — the §111 bearing stack's room floor; measured, interference worsens with distance, so the floor is the optimum |
| landing ε | pitch/4 | the half-integer landing rule, re-derived from cycle closure (multiples of pitch/2 are anti-phase: the second pallet never lands) |
| face length L | `STOCK_MIN_U` | every paddle dimension clears §50's wheel floor BY CONSTRUCTION |
| strip back | `STOCK_MIN_U + ARM_LAP` | one floor of WORKING section plus the SHANK the arm grips — the joint lives outside the pair's stay-out band (see the expectedContacts bullet: the first cut did not, and measured 0.011) |
| face incline ψ | ≈ 11.6°, SOLVED at boot | the incline that lands the poising ring a centi-mm inside the top of its stock window — interference is monotone in ψ, the ring window binds from below |
| half-swing h | SOLVED at boot (φ = 2h ≈ 0.0806 rad = 4.62°) | closure bisection: land at +h, release at −h, unilateral contact verified every step |
| drive / drop | 42.2% / **7.8%** of the pitch | outputs of the closure march |
| lever ratio ρ | 0.822 | driveArc/φ — now IN the tick law (`I_a = t²·Γ·ρ/(2φ)`); §104 lumped ρ = 1 |

The two §111 instruments this was built to satisfy, both now green:
`penetration`'s governor row reads **OK, 0.032 against the inherited 0.1 —
waiver retired**, and the boot cycle sweep's budget tightened **0.25 →
0.033** (measured 0.0314 at the solved point; §111's tighten-never-widen
rule, 7.6×). The cadence record survived exactly as the referred-torque
derivation predicted: measured endpoints 0.375/0.478 s unchanged, only
`I_a` (×3.06) and the ring's section (0.455 → 0.790 mm, still in stock)
moved.

**Residue, filed not hidden:** drop is GEOMETRIC here, not temporal — the
model's wheel is quasi-static (no wheel-side inertia), so the wheel crosses
the drop arc in ~zero time and the anchor DWELLS rather than overswinging.
Same accepted class as the ledger's "wheel recoil not modelled"; the
roadmap files drop-time-with-wheel-inertia as the follow-on. And the
working-contact grade is 0.033 u, not zero: the passing teeth run 0.031
from the parked paddles at the closest approach of the cycle, which is the
price of a face long enough to satisfy §50 and a swing small enough to
poise (the trade is written at `ALARM_GOV_ENGAGE_DEBT`).


### The blade SECTION — CLOSED by §111, and its "unfixable" was wrong

This was §107's original finding and the reason the item exists. §104 offset
the blade's stock along the wheel's radial by a literal `0.45`, and because
the tooth-tip trajectory's tangent runs only ~26° off that radial, the offset
landed nearly edgewise: 0.046–0.099 mm of real blade, pallet B under the
0.12 mm `STOCK_FLOORS.wheel` by 2.6×. `stockFloor` could not see it — its
thinness is a geometry-local AABB minimum, so an extruded blade reports its
0.40 u extrude DEPTH (0.152 mm) and passes. **That blindness is still real and
still unfixed**; a future blade will pass the same way.

§111 replaced the literal with a solve: bisect the offset until the thinnest
perpendicular crossing of the CUT polygon lands on `STOCK_MIN_U` (the same
0.12 mm, imported from `layout.js` so geometry is built to the number the
check enforces). It lands at **0.776**, giving pallet A **0.134 mm** and
pallet B **0.120 mm**, both asserted at boot against the polygon actually cut.
The §107 arch's attach clearance on the blade's back rises with it, 0.45 →
0.78 against the 0.40 it needs.

**And the reason this was thought impossible was a geometry error, corrected
here rather than left in the file.** The item used to say that scaling the
offset by 1/cos θ needs ≈1.58 u and "swallows the anchor's own pivot",
reasoning that the face sits 6.0 from the wheel centre while the anchor's axis
is at 7.335. It does not: the offset direction runs nearly TANGENTIAL to the
pallet circle, so the blade's back moves from 3.08 to only 3.12 from the
anchor axis as the offset goes 0.45 → 1.2 — it never heads for the pivot at
all. Measured true sections: 0.080/0.061 mm at 0.45, 0.155/0.146 mm at 0.90,
0.202/0.219 mm at 1.20.

Note what this did NOT change: the polygon-depth interference reads 0.2453 at
§104's 0.45 offset and 0.2448 at §111's solved 0.776. **The section and the
interference are independent**, which is the evidence for finding one's
diagnosis. (The MTV figure does move with the section — a bigger blade needs a
bigger separating translation for the same overlap — so 0.286 is the number
for the geometry as it now stands.)


### Finding two — the pallet FACES: leave them steel, and here is the number

Asked directly: should the pallets be ruby, to cut friction and wear at 190 Hz?
**No, and wear is the argument against, not for.**

Per ring the governor takes 28 strikes × 80 teeth (`ALARM_GOV_TEETH_PER_STRIKE`,
`src/main.js:10016`) = 2,240 tooth contacts, alternating between two pallets →
**1,120 impacts per pallet per ring**. The escapement's stones take
2·`F_BALANCE`·86400 = 432,000 beats/day, alternating → **216,000 per stone per
day**. That is **193×**. A year of daily alarms puts ~409,000 impacts on a
governor pallet — what an escape-wheel stone passes in **1.9 days**. Real
striking-train governors are plain steel for exactly this reason, and the duty
cycle here reproduces it. **The current steel is not a lie; do not "fix" it.**

Two consequences worth carrying forward:

- **A stone would still be defensible — but on structural grounds, not
  wear's.** A set stone turns the geometry from a wafer-thin ribbon into a
  properly-sectioned arm carrying a small hard stone. That was the argument
  while the section was the debt; **§111 closed the section with a solve
  instead**, so the argument is now weaker, not stronger — a stone would have
  to earn its place against finding one, and finding one is not a section
  problem. Either way the 193× above is in this item so nobody reaches for the
  wear argument. The seat would follow the pallet fork's own precedent
  (`src/geometry.js:719`, where `MATS.ruby` is noted as load-bearing).
- **Stones are not free to the cadence.** The gap law is inertial —
  `gap ∝ √(2φ·I_a/(M·η/32·ρ))` (`src/main.js:10428`, ρ since §113) — with mesh efficiency
  `η = 0.9²` inside it. Lower friction raises η and SHORTENS the gap, so any
  jewelling forces `I_a` to be re-solved to hold the designed 0.42 s at the
  design wind. `equalisation` is the gate that holds that. Solve the part; never
  re-target the beat.

### Finding three — the PIVOTS: the BORE is closed by §111, the stones are not

This is the strand with the strongest case, and it was invisible until someone
asked about rubies. **Its first half is now built.** §111 stopped the two
governor arbors being solids coincident with the studs they turn on — the
arbor was, absurdly, LARGER than its own post — and derived them as bearings:

```
ALARM_GOV_ARBOR_BORE = ALARM_GOV_STUD_R + PIVOT_BORE_CLEAR   = 0.400
ALARM_GOV_ARBOR_R    = ALARM_GOV_ARBOR_BORE + PIVOT_MIN_U    = 0.585
```

— the going train's own side-shake and a wall at the 0.07 mm pivot floor.
Both arbors are cut with `ringGeo`, the closed lathe tube the plate's bearing
collars use, so each stud genuinely occupies a hole. The two members bored to
the arbor followed from their own floors rather than from literals that
happened to clear the old 0.45: `ALARM_GOV_HUB_R` = arbor + `STOCK_MIN_U` =
0.901, `ALARM_GOV_COLLAR_R` = arbor + `PIVOT_MIN_U` = 0.769. The hub is the
widest thing on that axis inside the saw's band and now stands 0.434 off the
tip circle, asserted at boot; the `INTRA_UNIT_CONTACTS` rows say "a bore" where
they used to say "coincident solids are the bearing".

**What was still open was the STONE** — answered NO by §120, on two
independent measurements, and the working-out is the subsection after next.
The cock and depth-envelope paragraphs below are what that answer had to get
past, so they are kept as the argument rather than deleted as spent.

**The movement already jewels bearings, and it already has the vocabulary.**
`addUpperPivot(arbor, { staffR, jewelR, boreR })` (`src/main.js:1456`) grows a
staff to the plate and registers the seat in `tqPivots` (`:1451`), which the
plate builder counterbores; the jewels are dished faces (`jewelFaceGeo`,
`:1438`) in screwed gold chatons (`:1413`).

**And the convention it encodes is real horology**: the fast train is jewelled,
the slow high-torque arbors are not. The going train's four arbors take the
default `jewelR: 1.3` (`:1473-1475`) and §25 C's alarm winding climb arbor takes
`jewelR: 1.0` (`:1455`) — while the **barrel** arbor (`:1487`) and the **set-up
work** (`:4466`) are registered with **`jewelR: 0`**, i.e. a bearing with a plain
bore and deliberately no stone.

**By that convention the governor is the most jewellable thing in the watch, and
it is the one place running bare.** The saw wheel turns 4.76 rev/s against the
escape wheel's 0.167 — roughly **28×** faster — and the anchor reverses at
**190 Hz**, more reversals than any pivot in the movement sees. Yet both
governor arbors run as coincident solids on plain steel studs: `alarmGovArbor`
on `alarmGovStud`, and `alarmGovAnchorArbor` on `alarmGovAnchorStud`, declared
in `INTRA_UNIT_CONTACTS` (`src/inspect.js`) as the strike sleeve's
"coincident solids are the bearing" idiom. Neither calls `addUpperPivot`.

**The complication to solve, not to skip.** `addUpperPivot` grows a staff UP to
`TQ_MID_Z` — it assumes the arbor ends in the three-quarter plate. The governor
does not, and **§112 moved which side of that plate it is on**: the tier-split
took the alarm's power tiers UNDER the three-quarter plate, so both governor
studs are planted in the BASE plate now (`studBase = ALARM_U_FLOOR − 0.5`) and
the unit occupies z 0.35 … 4.05 against the plate's underside at 7.71. (This
paragraph said "§107 sited it ABOVE that plate, on studs planted in the plate
top" until §115 corrected it; a strand that argues from the wrong side of a
plate reaches the wrong answer about what carries a stone.) So a jewelled upper
pivot here needs a COCK over the governor — standing in the under-plate band,
not on the plate top — which the movement has vocabulary for (the balance cock
and fork cock), or the stones go in the base plate as lower bearings. That
choice is the first thing this strand has to decide, and the room it has is now
the under-plate band's own: the governor's tallest rider tops at 4.05 with the
plate's underside at 7.71, so there is **3.66** of air over it, and §115's
window means a cock in that band is also the thing a viewer would see through
the plate. Measure it rather than dropping the strand quietly.

### CLOSED (§120) — the stone is refused twice, and the bearing gets what it was actually missing

Measured, not preferred. The strand argued from RATE — "the saw wheel turns
4.76 rev/s against the escape wheel's 0.167, roughly 28× faster, and the
anchor reverses at 190 Hz" — and concluded the governor is the most jewellable
thing in the watch. **Wear is not a rate, it is a rate times a time**, and this
governor's time is 11.8 seconds a day (28 strikes × the 0.42 s designed gap).
Integrate and the conclusion inverts:

| bearing | its own work | the jewelled arbor it is compared to | ratio |
|---|---|---|---|
| governor saw arbor | **56 rev per ring**, once a day | escape wheel, **14,400 rev/day** | **×257 less** |
| governor anchor pivot | **2,240 reversals per ring** | balance staff, **432,000 reversals/day** | **×193 less** |

That ×193 is not a coincidence and it is worth naming: it is the SAME number
finding two got for the pallet FACES, because the count of tooth contacts and
the count of anchor reversals are the same count. **The pivot question and the
face question had one answer all along**, and this item measured it twice
without noticing until the two arithmetics were written down side by side.
Real striking-train governors are plain steel at both places for exactly this
reason, and the movement's own convention — `jewelR: 0` on the barrel arbor
and the set-up work — is that judgement already made about a different axis.

**And on the governor arbor a stone is not merely unwarranted, it does not
fit.** That arbor turns inside its own 8-leaf pinion, and a hole jewel's own
wall is what decides the question. Measured on the built pinion, the ROOT
CIRCLE stands at **0.671** against an arbor of 0.585 — **0.086 of pinion body
outside the bearing**. Real hole jewels carry 0.25–0.45 mm of ruby around the
hole; the thinnest of those is 0.660 u, which puts the arbor at **1.245**,
past the pinion's root circle by 0.574. There is no pinion left. Jewelling
this axis is not a bearing change, it is a re-cut of the ×8 mesh, its centre
distance and the tier that carries it — for a bearing that turns 56 times a
day. (The ANCHOR arbor could take one geometrically, at the price of +0.66 on
the hub and so on `ALARM_GOV_ANCHOR_D` and the whole §113 closure behind it —
but jewelling the slower of the two axes while the faster one runs bare
inverts the very convention the strand argued from, so the geometry settles
both.)

**What the bearing was actually missing was axial.** §111 cut the bore and set
the side-shake and left the other direction undefined: each arbor was a tube
standing on a plain post with nothing above it and nothing under it, so
dial-down the wheel simply leaves the movement, and "where in z the arbor
sits" was the builder's choice rather than the bearing's. §120 turns each post
instead of cutting it from bar:

- **A foot collar and a formed head, both at `ALARM_GOV_ARBOR_R`** — one
  derivation, used twice: a collar has to overhang the bore by metal that can
  bear, which is the arbor's own wall (`PIVOT_MIN_U`), and bore + wall IS the
  arbor's radius. §77's rivet rule one level up — the formed head and the land
  it bears on are the same stock. One lathe, one body, so nothing here is a
  joint anything has to declare.
- **`ALARM_GOV_END_SHAKE = 2 · PIVOT_BORE_CLEAR`** = 0.1 u = **0.038 mm**, the
  arbor floating half of it off each collar. Derived, not chosen: a bench sets
  a wheel's endshake at about its side-shake, and side-shake is measured across
  the bore — the diametral play, twice the radial fit the bore is cut to. One
  fit, read the two ways a bench reads it, landing inside the real 0.02–0.04 mm
  band.
- **The oil sink in the COLLAR faces, not the bore mouths**, and the reason is
  §111's own derivation: `ALARM_GOV_ARBOR_R = bore + PIVOT_MIN_U` puts that
  wall exactly ON §50's pivot floor, so countersinking the bore takes it under
  and growing the arbor re-opens the hub, D and §113's closure behind them. The
  other end of the same oil film is the collar face, which is FIXED metal with
  stock to spare: an annulus from the post out to the bore's own radius, one
  `PIVOT_BORE_CLEAR` wide by construction and one deep, so the drop it holds
  stands in the running clearance itself and none of the land the arbor bears
  on is lost.

**What it cost, in position space and nowhere else.** Retaining the governor
rotor puts a collar on top of the governor post, and the poising ring sweeps
past that post at 0.133 of its stock ceiling — 0.017 under the margin. Both
members are in ONE action group, so P2 forbids paying for it out of either,
and it did not have to be paid there: the ring's radius and section are the two
quantities the I_a solve owns and both are RADIAL, so the ring's FLOOR rises
0.225 to clear the head it passes (1.967 → 2.192) and the cadence solve does
not move at all. Two boot asserts hold that answer, because a z-stack answer to
a radial near-miss is only honest while the z gap is asserted.

**What §120 did NOT close, filed rather than hidden:** `stockFloor` still has
no `jewel` kind, because nothing jewelled landed to need one — the trap named
below is unchanged, and the next set stone anywhere in the movement will still
be judged against the 0.12 mm `wheel` floor. And the movement still carries no
ruby outside the going escapement and the balance, which is the right answer
twice over but is worth knowing before someone reads it as an omission.


### What the review owes the instruments

(§120 added one row to this list and paid it: `intraUnit` — the two governor
rows now describe a THREE-way running fit, bore plus two collars, instead of
a bore, and the posts stayed one lathe each so no new joint was declared
anywhere. Nothing else on the list moved, because nothing jewelled landed.)

- `penetration` — the governor row (§111) now reads **OK, 0.032 / 0.1,
  unwaived** (§113). Its `nSamples: 449` is load-bearing: one wind is 28
  strikes × 80 tooth periods = 2240, and a count sharing a factor with 2240
  revisits the same handful of phases forever. Keep it coprime.
- the boot cycle sweep — `ALARM_GOV_ENGAGE_DEBT` in `src/main.js`, the
  polygon-depth twin of that row over one tooth period. §111 set it AT the
  measured debt (0.25) with the tighten-never-widen instruction; §113
  tightened it to 0.033 (measured 0.0314 at the solved design point). It
  remains the number that must not rise.
- `expectedContacts` — the governor pair's floors row was the tightest in
  the check at §107 (0.0099 of headroom), went to 0.4269 at §111, and is
  re-measured by every landing that touches the anchor. **It earned that
  keep at §113**: the first cut of the flat-face arm aimed at the pallet
  strip's mid-point and measured 0.011 from a passing tooth — through a
  silent boot, because the build assert held the arm to the working grade
  instead of the margin. The pallet now carries a SHANK
  (`ALARM_GOV_PALLET_BACK`) the arm grips outside the stay-out band, and
  the boot assert holds the arm to `CLEAR_MARGIN` so the gate never has
  to find it twice.
- `stockFloor` — the edgewise SECTION was invisible to it by construction
  (AABB minimum vs an extruded blade). §113 removed this anchor's exposure
  (flat faces: section = offset; L = the floor itself), but the census
  blindness is general and a way to see a true section is still owed.
  §113 also hit the census's OTHER reading: a swinging radial bar is
  classified as a revolve and its LENGTH read as a ring's wall — the arm is
  rooted at the arbor so the honest number passes, but the classification
  is worth knowing.
- `equalisation` — if `I_a` moves for any reason (stones, a re-cut face, a
  jewelled pivot changing the counted steel), the cadence endpoints must be
  re-measured, and the check's own `clock.step(0.005)` step size is itself
  underived (see §109 in the roadmap). Scale, from §113: the ring now sits
  at 0.790 mm — a centi-mm under its 0.8 stock ceiling BY CONSTRUCTION (ψ
  solves to put it there), so anything that RAISES `I_a` (lower η, softer
  spring) pushes the ring out of stock and the gate fires. That is the
  designed early-warning, not fragility.
- `assembly` (§107) — any new seat is a new joint; a stone set in an arm must
  share metal with it or the anchor is two bodies again.
- `intraUnit` — a stone seated in an arm is a declared joint, not an
  intersection to be discovered.
- **`stockFloor` has no `jewel` kind at all**, and this is the sharpest trap in
  the item: every unnamed ruby in the movement is judged as `'(unnamed)'`
  against the 0.12 mm `wheel` floor — *the same floor the section finding above
  is about, and the one `stockFloor` still cannot see edgewise*. A
  set stone dropped in here would be measured by the very number this item
  exists to correct. `ring` (`src/inspect.js:4740`) is the precedent for adding
  a kind, and §104 added it on exactly this kind of argument.
- **The schematic tier does NOT pick a new stone up for free.** `jewelLines`
  (`src/main.js:15146`) does select by `material === MATS.ruby`, but it is
  invoked for two units only — `jewelLines('Pallet fork')` and
  `jewelLines('Balance')` (`:15156-15157`). A governor stone needs an explicit
  third call or it draws no glyph. (An earlier draft of this item said it joined
  automatically; it does not.) Note also `:15163` assumes the FIRST ruby found
  in `'Balance'` is the impulse pin — an order-dependent assumption not worth
  copying.
- **`penetration` finds rubies by COLOUR, not by name** — `selectB` matches
  `0xb01326` (`src/inspect.js:2295-2307`) with the guard that the fork's steel
  "must NEVER meet the wheel: only the stones are contact surfaces". That is the
  pattern a governor set-stone wants; the hazard is that the selector is
  unit-scoped to `['Escape wheel','Pallet fork']`, so it will not extend itself.
- §39's depth envelope bounds the whole strand — 11.95 mm against 12 mm.

### Vocabulary that already exists, so none of this needs inventing

- **Set stone in a broached slot**, seat gap DERIVED rather than guessed:
  `gGap = armBevel + SEAT_SHOW` — bevel first, then the seat line that survives
  it — with `wallW = 0.55` of steel each side and `m = 0.4·stoneL` of ruby proud
  of the nose (`src/geometry.js:725-770`). The slot is a notch walked into the
  outline, not a boolean. `SEAT_FIT` (`src/geometry.js:2844`) is the one named
  fit for a set part.
- **The ARM BAR right beside it** (`src/geometry.js:772-784`) is almost a direct
  answer to the section finding's closing need: *"the head must be CARRIED by the fork,
  not hang off its ruby — a bar from the pivot boss out to the slotted head, the
  way a real anchor's arms run."*
- **Rubbed-in hole jewel in a real counterbore** over a bearing collar:
  `PIVOT_BORE_CLEAR = 0.05`, `CHATON_DEPTH`, `chatonOuterFor`, `jewelFaceGeo`'s
  dished face and oil sink (`src/main.js:1405-1438`, `:5619-5637`).
- **`makeChaton`** (`src/geometry.js:2952`) — a screwed gold chaton with pressed
  ruby and oil sink — is complete, documented, and called by nothing. The plate
  went back to a flush rubbed-in stone because it was too thin for a proud
  chaton (`src/main.js:5626-5633`); the governor is UNDER that plate since
  §112's tier-split (this line said "above" until §115 corrected it), so the
  constraint that retired it — nothing may stand proud of the plate's top face,
  where the reset and hack rods run — does not reach the governor's own band at
  all. Whatever carries a stone there answers to the under-plate band instead.

### The measurement the review should not have skipped — now taken

This section used to read: *the bearing as built is not merely unjewelled, it
is barely a bearing* — `ALARM_GOV_STUD_R = 0.35` against
`ALARM_GOV_ARBOR_R = 0.45`, the arbor LARGER than the stud it turns on, two
coincident steel solids with no bore, no side-shake, no endshake, no oil sink,
held together by an `INTRA_UNIT_CONTACTS` row. §111 cut the bore (finding three
above), and it then named the three things still missing so the next pass could
not think it was done: **endshake** (nothing set the arbor's axial play against
a shoulder), an **oil sink**, and the stone itself. §120 answered all three —
the first two built, the third refused with the duty integral and the pinion's
root circle — and this item closes on that list being empty.

**The lesson worth keeping, above any of the three.** This strand reached the
wrong conclusion for six sections because it compared RATES between bearings
whose DUTIES differ by four orders of magnitude, and nothing in the battery
compares duties — no instrument in this project measures how long a part
actually runs. Both governor bearings are on the movement's steepest rate curve
and its shallowest work curve at the same time, and only one of those was ever
written down. When the next review argues "this is the fastest X in the
movement", the follow-up question is *for how many seconds a day*.

## 46. CLOSED (§124) — the first stage re-geared so the ideal cut carries its chain; the float row gates it seated

**Status 2026-08-15 — CLOSED, by the layout.** The owner rejected path (b)
after it was implemented and measured (a 32% torque sag over the bottom 14%
of reserve, the level product up 25%, and a physically impossible 45°→81°
tilt cliff at the regime boundary — the working tree of that attempt was
discarded; its arithmetic is § history now), and chose the layout exit. The
decisive discovery en route: path (a) alone cannot close either, because
the groove pitch (0.694) was barely above the chain's stack (0.66) — in the
slope window m ∈ [0.4, 1.7] NO chain pose exists: an upright link gaps
2h·m off the floor, and a link leaned far enough to seat sweeps a footprint
that fouls the adjacent turn (the turn-to-turn offset runs along the plate
diagonal there, so even a finer chain does not escape). Every lever inside
the old gearing was priced and failed: a 12:1 first stage still needs a
43-click set-up (empty fraction 0.75), the band cannot grow (0.0044 of
land slack, zero chain-to-centre-wheel slack), and an everywhere-gentle
cone needs 51 clicks. The one lever that closes it is the first mesh
itself — hours-per-fusee-turn IS that ratio, and it was hard-coded as
`/ 8` in two places.

**What shipped (§124).** `TRAIN.barrel` 0.36/80/10 → module 2·16.2/127
(centre distance HELD — the center arbor does not move), 120 teeth, 7-leaf
pinion: the fusee turns once per 120/7 h, so the 30 h reserve is **1.75
wraps over TWO grooves at pitch 1.389** — twice the stack, and the
seat/separation window closes. SETUP_CLICKS 17 → 23 (minimum integer whose
full-band best-pose seat residual clears the float budget with 10%
standoff: 22 → 0.200 ✗ vs 0.198, 23 → 0.146 ✓); the level product
P = r₀·θ_s = 32.9344 is HELD as `FUSEE_LEVEL_P` so the train's drive
torque is bit-identical and r₀ = P/θ_s = 5.46955 stops being the bare 7.4.
Path (a) then lands on top: links LEAN to `fuseeBetaAt(f)` (≤ 63.43° at
the base), the cut's floor is the corner-locus law at the link's own tilt
(TODO 40's shear is its β = 0 case), the tilt's extra down-reach
√(h²+w²) − h = 0.40790 is funded once in position space
(`FUSEE_TILT_Z`: groove floor and upper stratum rise together, FUSEE_BAND
and the centre-wheel margin spent nowhere), and the reserve indicator
re-geared with its arbor (R = 4.2 = 28/8 × 12/10 — TODO 18's assert is
why it could not be missed). The torque law is the ideal closed form
again, exact (level dev 2.2e-16); the declared fiction is articulation —
per-joint twist up to 36.3° at the wrap departure, recorded at the ramp.

**Measured at closure**: §61 float row **3.191 waived → 0.202 unwaived**
(budget 0.25, worst at the bottom turn — chording at the honest 2.41
effective chord plus the base's 0.024 lie-flat corner residual); burial
0.217, drum 0.061, both in budget; `probe-chain-daylight` means
1.90/1.90/2.45 → **0.91/0.91/1.16** (the residual is the probe's
horizontal-ray artifact under the cone plus chording — the float row is
the gate); boot silent including the two new §124 asserts (tilt
affordability ∀f, adjacent-turn stack separation ≥ 0.02 at each station's
own tilt).

The original filing follows, unchanged.

---

Filed 2026-08-15 from the owner's observation ("the chain seems to float at
the largest radius — the fusee has a big gap from the chain, possibly
insufficient thickness at the base"), confirmed by measurement before filing.
The float is real, it is at the bottom (largest-radius) wrap turn, and it is
there at EVERY reserve state, not only run down.

### What was measured

Three instruments, in order of what they can see
(`tools/probe-chain-daylight.mjs` is the committed one):

- **3D closest approach** (BVH, chain wrap vertices → fusee meshes): the
  bottom turn reads 0.001–0.05 across the wind — the chain's inner-BOTTOM
  CORNER genuinely kisses the relieved groove floor, which is why the §61
  seating row and every sweep are green.
- **Radial daylight** (a ray from each bottom-turn chain vertex, horizontally
  inward to the first fusee surface): **mean 1.90 u at full wind, 1.90 at
  half, 2.45 near run-down; worst 6.1 u; only 0.2% of rays land within
  0.05.** The body of the chain rings the cone in open air; only the corner
  under it touches.
- **The eye** (screenshots, low side rake through the plate gap): the bottom
  wrap visibly encircles the cone with daylight all round — the owner's
  report, reproduced.

### Why — the cut's own arithmetic, already written at the builder

This is not a bug in the chain path; it is the collision of two §-numbered
truths, and the numbers are in the source comment at the `makeFusee` call:

- TODO 40 row 1 handed the cut the equalising hyperbola. Its flank at the
  base falls at **|dr/dz| = 5.28** (79.3° from the axis).
- A radial-depth groove can carry a chain of finite height only while
  **|dr/dz| ≤ grooveD / half-stack = 0.66 / 0.33 = 2.42**. Past that, either
  the metal under the groove stands INTO the chain's lower half (the §61
  seating row's old red 1.989) — or, after TODO 40's half-stack relief
  fixed exactly that, the flank falls away INBOARD of the chain's upper
  half. The relief traded a burial for a float: the chain's centreline
  stays on the envelope (the torque law the equalisation gate holds), the
  corner seats, and everything above the corner hangs in air that deepens
  at 5.28 per unit of chain height.

The owner's "insufficient thickness at the base" is the right instinct one
level down: the base is not too thin as stock — the LAW makes it too steep
to also be a bearing surface for the chain that rides it.

### Why every instrument missed it

`sampleRadialDepth` (the §61 chain-on-cone seating row) returns
`max(floorAt(z) − r)` — **burial only**. A vertex standing OFF the floor is
negative and never registers; a chain floating in mid-air reads as a clean
0, indistinguishable from a perfect seat. The same asymmetry runs through
the battery: penetration budgets bound depth, clearance budgets bound
minima, and contact-closure rows (`alarmHandoffs`' touching/apart/buried
grade) exist only for the §35 arming run. Nothing anywhere asserts the
chain TOUCHES the cone it hauls on — a force-transmitting contact with no
closure instrument, the exact gap rule 4's hand-off grading was built to
close on the alarm side.

### What closing this looks like

Three paths, not exclusive; (c) is owed under any of them:

- **(a) Tilt the chain to the flank** — the honest mechanical fix. A real
  fusee chain lies against the cone surface, its link plane tilting with
  the local flank; this build lays every link with a vertical stack axis,
  which is what leaves only a corner touching a 79° flank. Give the wrap
  section per-point frames tilted to the local envelope slope
  (`buildChainLinkGeometry` takes the curve; the tilt is
  `atan(dr/dz)` from `fuseeEnvR`, known at every wrap point). The chain
  then bears on its face, the daylight collapses to the seating clearance,
  and the groove's carrying limit stops binding. Costs: the chain builder
  learns a frame field; the §61 rows re-measure; sweptOverlap's chain hull
  re-takes (the chain is already fingerprint-excluded, so no hash churn).
- **(b) Bound the flank at what a groove can carry** — cap |dr/dz| at 2.42
  and let the torque law deviate at the run-down tail. This spends P0
  truth (the equalisation gate holds springTq·r/K level over the reserve
  and would fire), so it is only honest as a DECLARED deviation: real
  fusees do not equalise to the last turn either, and roadmap §47's
  stop-work vocabulary (bound the usable band instead of cutting an
  uncarryable flank) is the movement-honest shape of it. Do not take this
  path by quietly widening the equalisation tolerance.
- **(c) The instrument, under any path** — the §61 cone row grows a FLOAT
  half: alongside `max(floorAt − r)` (burial), grade the wrap's worst
  standoff `max(r − floorAt)` over vertices that should seat, the
  touching/apart/buried convention the hand-off rows already own. Land it
  first as a report with the measured 1.9–2.5, then gate at the value the
  chosen fix achieves — tighten-never-widen, §111's rule. Until the row
  exists, this float class is invisible by construction to every battery
  run, which is how it shipped.

The §61 convention itself — "inner edge on the floor, centreline on the
envelope" — stays: it is the torque law's honest anchor, and (a) preserves
it exactly (a tilted stack's centreline still rides the envelope; only the
stack's ATTITUDE changes).

---

## 47. CLOSED — the heart cam turned before the roller reached it

Reported by eye from the running sim: pull the crown and **the heart cam
starts moving while the reset hammer is still travelling toward it**. The
seconds hand is already a third of the way home before anything touches
the cam.

The cause was in the tick law, not in the geometry. The cam's angle is
carried by `secondsZeroRef` (the display arbor is friction-slipped, so
"camming to zero" re-references the small-seconds hand rather than
back-driving a locked train — that part is sound and unchanged). But
where that reference LANDED was:

```js
if (leverEngage > 0.001) {
  secondsZeroRef += Math.round(...) * 2 * Math.PI;               // whole turns out
  secondsZeroRef += (fourthA - secondsZeroRef) * leverEngage
                    * (1 - Math.exp(-rawDt / CAM_SNAP_TAU));     // ease the rest
}
```

Both halves are the same mistake in the same direction. The **gate** opens
on the first frame of the crown's travel — `leverEngage` is an eased
0→1 ramp on the crown, not a contact — and the **rate** is scaled by
`leverEngage` rather than by any distance, so the cam is driven hardest
exactly while the hammer is still in the air. Measured on the shipped
easing (60 fps, crown pulled at t = 0):

| t (s) | hammer through its stroke | cam through its reset |
|---|---|---|
| 0.017 | 11.5% | **3.1%** |
| 0.083 | 49.2% | **33.4%** |
| 0.150 | 72.5% | 66.1% |

Nothing was touching the cam for the first third of that. This is a
simulation fiction of the exact kind the README's vocabulary exists to
name: the reset was *modelled* (there is a hammer, a roller, a cut heart)
and animated on a time constant, not *simulated* — no force path, and the
one number that decided the motion was a UI ramp.

### CLOSED — the law is the contact

`heartFreeAngleAt(d)` (in `main.js`, beside the hammer's build) answers
the only question the tick law needs: with the roller's CENTRE standing
`d` from the cam axis, how far may the heart's notch stand off the
roller's azimuth before the two are in each other? Then each tick:

- solve the hammer's rotation from the setting-lever post through the rod
  (unchanged — it was already a real four-bar), and take the roller's
  centre from it;
- if the heart stands further off its notch than the profile allows at
  that distance, put it back on the profile, moving |θ| DOWN — the
  shortest path, which is why a heart cam can never be driven more than
  half a turn however long the watch has run. (The old `2πk`
  renormalisation existed to impose that bound on a residual that had no
  such bound; the new law is modulo by construction.)
- otherwise leave it alone. The cam holds perfectly still under a parked
  hammer, and holds where the hammer left it when the crown goes back in.

Nothing is eased: the snap's speed is the hammer's own travel. That also
makes it exact under `setPose`'s zero-dt path, where the old ease could
not move at all — posing `crownPullT: 1` used to seat the hammer through
a cam that had not been reset, i.e. straight into the lobe.

**Three things were derived on the way, each of which changed a number:**

1. **Tangency, not a radial reading.** Solving the profile RADIUS along
   the roller's centre ray is one line and is wrong by the angle between
   that ray and the surface normal: measured, it buries the roller 0.08
   into the flank mid-ride — 11% of the roller. The shipped solve is the
   real one (largest offset angle at which the roller's circle still
   clears every point of the outline), run once at BUILD time into a
   256-step table over the stroke and read back by interpolation, so no
   per-frame minimisation happens.
2. **The inside/outside sign is the whole check.** Distance to the
   outline alone reports a roller centre buried in the lobe as 1.6 clear
   of the far edge — the first pass declared the heart free to turn at
   the seat and the cam never moved at all. The heart is star-shaped
   about its axis, so the test is one radius comparison at the roller's
   own azimuth.
3. **The bevel is a distance, not a radius.** Extrude dilates the outline
   along its own NORMAL. Adding `bevel` to r(θ) agrees with the mesh only
   where that normal is radial — the notch and the lobe tip, which are
   exactly the two places the mesh was measured, so the radial model
   looked verified. On the flanks the normal leans up to 27° off radial,
   and the residue was 0.001 of roller-in-flank that no table resolution
   moved. The beveled body is the Minkowski sum of the cut outline with a
   disc of radius `bevel`, so the solve measures against the UNBEVELED
   curve and subtracts `bevel` with the roller's radius.

### Verified — `tools/probe-reset-contact.mjs`

An INDEPENDENT gap: the roller's centre from the hammer's own world
matrix, the heart's outline from its mesh VERTICES, so nothing in the
check goes through `heartFreeAngleAt`. Six cam phases round the turn,
each pulled and pushed through the shipped easing:

```
reference moved while the roller was clear: 0/6
reference drifted after the hammer lifted:  0/6
roller buried past the faceting band:       0/6
seat did not zero the hand (±0.02 s):       0/6
```

Closest approach through the whole ride reads |gap| ≤ 1e-4 against a
faceting band of ±0.018 (the roller is a 14-gon inscribed in its radius),
i.e. the two ride tangent from first touch to the seat. Boot stays
silent: three build asserts hold the table's two ends to the stroke's two
ends (free at the retracted stand-off, shut at the seat) and hold it
monotone.

`node tools/ci-battery.mjs` locally: **20/20 gates pass**, 1973.1 s over
2 shards — including `sweptOverlap` 0 CONFIRMED (67911 pairs, tight 3,
refuted 21), `clearances` 0 violations, `inspection` 0 FORBIDDEN,
`restoring` 0 unwaived, the identity spec point silent, and the
fingerprint deterministic across virgin boots at 1450081387. The pose net
now exercises this law rather than sleeping through it: the `crown` axis
poses `crownPullT` directly, and because the new law needs no dt, the cam
actually reaches its reset positions under `setPose` — poses the old ease
could not produce at all.

### What this does NOT close

- The seat's own **penetration budget** is untouched: `Heart cam ⇄ Reset
  hammer` is an EXPECTED pair with no `EXPECTED_CONTACT_FLOORS` row, so
  it still takes item 6's blanket excuse. The measurement above is what a
  floors row for it would gate; seeding one is item 6's work.
- The hammer is still driven **only** by the crown. Real chronograph
  reset is a spring-driven fall released by a lever; here the rod pushes
  it both ways, which §48's audit accepts as "driven both ways" (see
  TODO 43 on why the four reset-linkage units left the reciprocator
  population). That is a different claim from this item's.

---

---

## 48. CLOSED — the power-reserve train's two meshes sat tooth ON tooth; solved, driven forward, and re-measured at 0.03–0.07%

**Closed 2026-08-20, both halves in one landing as the item required.**
`tools/probe-reserve-mesh.mjs` (taught the new pair-group structure) reads
the same three winds it filed the defect at: **worst credible reading
0.07% of a pitch off anti-phase** (was 47–49%), both meshes, gauges
credible at [8,28]/[10,12] gaps. What landed:

- `measuredToothPhase`'s min-to-max threshold replaced with the probe's
  10th/90th-percentile threshold (finding 1 — the 56-gaps-at-0.94 failure
  is closed at the gauge, not worked around);
- w1+p1 wrapped in a rigid PAIR group (`rsvPair1`) — the one-blank
  constraint made structural, answering the question TODO 15 left open
  for the alarm's i1/i1b — and the chain solved as two `solveGearChain`
  runs with the pair held, one per module, p0 the datum;
- the half-pitch idiom lines deleted;
- the train DRIVEN FORWARD (finding 2): p0 takes the barrel arbor's wind
  angle through its slip coupling (the constant term is the coupling's
  SET — assembly zeroing the indicator by slipping the friction), each
  mesh counter-rotates by its real ratio, and the hand ARRIVES.
  RESERVE_SWEEP_DEG·ratio = FUSEE_WRAP_TURNS·360 by TODO 18's shared
  derivation, so the hand sweeps the same graduated arc — the same
  angles, arrived at forwards.

The body below is kept as the record of the measurement that filed it.


> **Re-confirmed by triage 2026-08-19**, when "fix the gear meshing on the
> power reserve indicator" came in as a fresh request. It is this item,
> already measured and already sited, so no second item was opened — a
> duplicate would split the measurement from the fix path. Nothing below
> changed; this note exists so the request is not filed a third time.

Reported by eye from the running sim: **the power-reserve train's gear
meshes don't engage each other.** They do not interleave — a tooth of one
wheel meets a tooth of the next on the line of centres, where a gap
should be.

This is the last un-fixed instance of TODO 15's idiom (that item named it
as one of two remaining sites, from code reading and screenshots). It is
now MEASURED, by an instrument written not to share TODO 15's machinery:
`tools/probe-reserve-mesh.mjs` re-implements the gap gauge and reads the
built scene.

```
pose           mesh      credible  gaps      confidence      off anti-phase   centre dist
full wind      p0 ⇄ w1   true      [8,28]    [1,0.9999]         47.18%          6.12
full wind      p1 ⇄ w2   true      [10,12]   [1,1]              48.94%          8.4888
tension 0.55   p0 ⇄ w1   true      [8,28]    [1,0.9999]         47.09%          6.12
tension 0.55   p1 ⇄ w2   true      [10,12]   [1,1]              48.94%          8.4888
tension 0.17   p0 ⇄ w1   true      [8,28]    [1,0.9999]         47.18%          6.12
tension 0.17   p1 ⇄ w2   true      [10,12]   [1,1]              48.89%          8.4888
```

0% is a tooth into a gap; **50% is tooth onto tooth**. Both meshes sit
within 3% of the worst value it is possible to have, and the reading is
stable across three winds — the SUM invariant `frac(uP + uQ) = 0.5` is a
property of the mesh, so a static build-phase error reads the same at
every pose (which is also what makes these three rows evidence rather
than one lucky sample).

**The centre distances are exactly right** — 6.12 against the stage-one
pitch-circle sum 0.34·(8+28)/2, and 8.4888 against stage two's, both by
construction from `rsvModule0`/`rsvModule1`. The wheels reach each other
perfectly. Only the phase is wrong, which is why every clearance sweep
has always been green here: two gears meshing out of phase sweep exactly
the same volumes as two meshing correctly.

**The site is two lines** (`src/main.js`, at the reserve train's build):

```js
// Half-tooth mesh phasing so teeth interleave rather than clash at rest.
rsvWheel1.rotation.z = Math.PI / rsvTeethW1;
rsvWheel2.rotation.z = Math.PI / rsvTeethW2;
```

Half of the wheel's OWN angular pitch, with no reference to the line of
centres to its neighbour — and the comment states the intent the code
cannot express. The train's line of centres runs barrel → w1 station →
sub-dial pivot at arbitrary azimuths, so a phase measured from local +x
is right only by coincidence.

### What closing this looks like

`solveGearChain(label, chain, module)` is already in `main.js` and is
written to be reusable — it measures each wheel's world tooth direction
from its VERTICES and the sign of its response to `rotation.z` by
bumping it, so frames, mirroring and the `dialFace` Y-flip need no hand
reasoning, and it refuses to solve on a reading whose gap count
disagrees with the declared tooth count. Point it at this train:

- the chain is **p0 → w1 → p1 → w2**, four wheels and *three* links, not
  two independent pairs. w1 and p1 are one rigid arbor, so solving w1
  against p0 fixes p1's phase too — their relative phase is a
  CONSTRAINT (they are turned from one blank), and the solve must move
  the pair together rather than phasing p1 freely. TODO 15 flagged the
  same question for the alarm's i1/i1b and never answered it; this train
  is where it has to be answered, because here the two wheels are
  unambiguously one part.
- the datum is **p0**: it is slip-coupled to the barrel arbor and has no
  upstream mesh of its own.
- `solveGearChain` takes ONE module for its centre-distance tripwire, and
  this train has two (`rsvModule0` for stage one, the solved
  `rsvModule1` for stage two). Either pass the module per link or run it
  twice with the arbor pair held; do not paper over it by passing one
  module and accepting a false tripwire.

**Two instrument findings came out of measuring this, both worth keeping:**

1. **The gap gauge's threshold does not survive a small pinion.**
   `measuredToothPhase` thresholds the silhouette midway between its
   smallest and largest populated bin. On the 8-leaf `reservePinion0` a
   handful of bins see only bore geometry, the floor collapses from the
   root radius 1.04 to 0.51, the threshold lands INSIDE the root land and
   the gauge returns **56 gaps for 8 teeth at 0.94 confidence** — a bad
   reading wearing a credible confidence, which is the one failure mode
   the four-gauge history was supposed to have retired. The probe uses
   the 10th/90th percentiles of the populated bins instead, which reads
   every wheel in this train correctly. **`measuredToothPhase` in
   `main.js` still has the min-to-max threshold.** `solveGearChain`'s
   credibility test does catch it — 56 ≠ 8 refuses the reading and skips
   the chain loudly, which is the right failure — but that refusal is
   exactly what will block this fix on its first run, so the threshold has
   to move in the same landing. Note which half of the test did the work:
   the confidence was **0.94**, so the `conf > 0.9` half would have passed
   this garbage on its own, and only the gap count caught it. A gauge whose
   two credibility signals disagree that far is one to distrust until it is
   fixed.
2. **The train is posed from its OUTPUT, not driven from its input** —
   standing rule 2, in `tick()`:

   ```js
   reserveShown = tension;
   reserveHand.rotation.z = (90 - reserveShown * RESERVE_SWEEP_DEG) * DEG2RAD;
   const rsvOut = -reserveHand.rotation.z;
   rsvArbor2.rotation.z = rsvOut;
   rsvArbor1.rotation.z = -rsvOut * (rsvTeethW2 / rsvTeethP1);
   rsvArbor0.rotation.z = -rsvArbor1.rotation.z * (rsvTeethW1 / rsvTeethP0);
   ```

   The HAND is written first, from `tension`, and the three arbors are
   solved backwards through the ratios to agree with it. The ratios are
   the real ones and the resulting angles are numerically the same as
   driving forward would give, so this is not a wrong picture — it is a
   wrong DIRECTION, the same shape as TODO 20's arming run being posed
   from its output. Forward is available and cheap: p0 is slip-coupled to
   the barrel arbor, so `rsvArbor0` should take the barrel's own angle
   and the hand should ARRIVE at the far end. Doing that first also makes
   the phase solve honest — it is hard to argue a mesh interleaves
   correctly when the wheels' angles are computed from the wrong end of
   it.

Both halves belong in one landing: fixing the phase without fixing the
direction leaves a correctly-cut mesh whose two wheels are still told
where to be by the pointer they are supposed to drive.

---

## 49. The fusee end of the chain is hooked to nothing

**What the model claims.** `MECH_GRAPH.support` carries
`['Chain', 'Fusee & great wheel']`, and the comment beside it says the
chain is hooked to the cone. The DRUM end has real metal for that claim —
`drumHookClaw`, a pin the end link drops over, built with the drum and
solved to the wrap's own departure. The cone end has none: `makeFusee`
builds no hook, no claw, no anchoring slot, and `rebuildChain` simply
starts the wrap at whatever azimuth `thetaT` puts it at for the current
tension. The wrap's bottom end therefore DRIFTS around the cone as the
reserve changes, attached to nothing, while the support edge asserts a
joint.

**Why it matters now.** §47's arrest reads the chain's arrival as a pure
function of tension, which is legitimate *because* the wrap's law is one
law shared by the display and the mechanism. That law is honest about
where the chain IS and silent about what holds its end. The arrest does
not depend on the hook — but the support edge does, and the edge is what
a reader is entitled to believe.

**The fix.** Cut the hook: a claw on the cone's base collar, at the
station the wrap starts from (`fuseeGrooveAt(0)`), with the wrap's first
control point pinned to it the way the drum end's `HOOK_A` pins the last
one — the fractional-turn congruence `rebuildChain` already solves at the
drum, run at the other end. Then the wrap's bottom stops drifting and the
support edge names metal. Costs: a small body on the cone (the fingerprint
moves), one solve in `rebuildChain`, and the §61/§124 seating rows
re-measure at the bottom station.

**BLOCKED on TODO 40 row 3, and the fix above is not the one to run.** Scoped
2026-08-19. Two of the end's three coordinates are ALREADY pinned — the wrap
starts at `fuseeGrooveAt(0)`, which is `rLarge` 5.4696 at the band's bottom,
at every state of wind (measured: z 4.41 across the reserve). Only the
AZIMUTH floats, and it sweeps the full 1.75 turns: 70.7° → −56.5° → 144.1°
→ −14.8° → −173.3° at reserve 0.05 / 0.25 / 0.5 / 0.75 / 1.

The proposed fix — run the drum's fractional-turn congruence at the other end
— rests on a symmetry that is not there. At the drum, the residual is absorbed
by `drumTurns = round(baseTurns − frac) + frac`: up to half a turn of COIL, a
display quantity nothing depends on. The cone has no such absorber. Its wrap
count is `wraps = tension · FUSEE_WRAP_TURNS`, and that is load-bearing —
`windArrest.engageTurns` = 1.75 is asserted at boot against
`RESERVE_BARREL_TURNS`, and §126's argument that the lug can be CUT to its
angle rather than calibrated rests on it. Rounding at the cone would put up to
half a turn at `rLarge` — about 17 u, an eighth of the whole run — into the
first link.

So the only remaining absorber is the chain's LENGTH, which is exactly what
TODO 40 row 3 defers. `chainLength` now measures it: the run spreads 1.984%
across the reserve against a 1.164% tolerance, and lays 43 links at some
states and 44 at others. Pin both ends and that closure becomes load-bearing,
so this item cannot land before it.

**What to write instead of the current fix.** Either (a) do 40 row 3 first and
then pin both ends, deriving `wraps` from the closure and making `tension` a
readout of the wrap rather than its input — which is how a real fusee actually
closes — or (b) cut the hook as honest metal and CORRECT the support edge to
stop claiming a joint. Do not do (b) in the belief that it closes this item:
it converts an invisible false claim into a visible one, metal the chain
demonstrably misses.

**Filed by §47's scope guard**, which named it rather than absorbing it.

**Re-verified 2026-08-21 — still blocked, and the cost list has grown.** Every
claim above still describes the code (the azimuth still floats, the drum's
congruence and claw are unchanged, `chainLength` still reports the same
1.984% spread against 1.164% waived, and the wrap count is still asserted
against `RESERVE_BARREL_TURNS`). What changed since the scope: two more
instruments now consume the shipped chain layout, so path (a) — pin both
ends and derive `wraps` from the closure — re-measures more than the §61/§124
seating rows. TODO 53's `CHAIN_TQ_REACH` is a closed-form bound on the
discrete top-of-wrap that the plate floor (`TQ_DESIGN_MAX`) carries, with its
own conservativeness assert and a `Chain ⇄ Three-quarter plate` budget row;
TODO 51's `armStopAt` is a per-sector reach table built from the same
discrete layout, and its `HUB_Z2` refusal note binds the span ("must move
the SPAN, not the pad"). Changing where the run lies moves all of them —
price them with the fix, and diff the battery `--report` against the base
when it lands.

**UNBLOCKED by §150, later the same day.** TODO 40 row 3 closed: the cone
is cut from the span-aware conservation solve, `chainLength` gates the run
at 0.5167 u spread with 43 links at every state of wind, and the waiver is
gone. Path (a) is therefore open — pin both ends with the closure exact —
and §150 sharpened its terms: the wrap's bottom still floats in azimuth
only (the solve conserves LENGTH; it does not pin the wrap's start), the
`wraps = tension·FUSEE_WRAP_TURNS` law is still load-bearing and still
fenced, and the hook-congruence branch margin at the drum end is now
boot-asserted, which is the same instrument a cone-end pin will need.
Note also §150 removed the 0.05-turn wrap floor: at dead reserve the cone
is honestly bare, so the anchorage this item wants to cut is now also the
only thing that would keep the last link attached to the cone at all.

## 50. CLOSED (§149) — the going stem's one-way is a saw coupling at the sliding clutch

**Closed by §149** (`docs/BUILT.md`): the dual-purpose `windPinion` split
into the fixed winding pinion (poses from the bank, always meshing the
crown wheel) and the sliding clutch — its own unit, keyed to the stem's
square, the yoke's fork tracking its collars — joined by the Breguet-style
saw coupling `sawCouplingSpec`/`makeSawCoupling` cut, ridden and measured
by ONE profile law. `windStemSlip` is the coupling's relative index now: a
consequence of a modelled contact, persisted (the parked sub-pitch lives
in the stem's free angle, not the bank), with the two sub-pitch laws the
metal demanded (forward take-up of the parked gap; the knob holding
through the drain until the drive face picks it up) and the `stemSlip`
axis that lets the sweeps and §48's audit see the clutch move. The alarm
stem's instance of the same class moved to item 72 — a closed item is a
bad place to keep live debt. The corrected filing below is kept as the
record of the premise this item had to fix in itself first.

### The filing as corrected (history)

§47 collapsed the winding path onto the banked reserve, so every wheel
from the crown wheel inward now poses from `barrelWindTurns` and the
whole train stops together at the arrest. What the stem does when the
wheel cannot move is carried by `windStemSlip`: a scalar that absorbs the
backward free-wheel at the plate-top click and the spins the clutch takes
out of mesh. The knob therefore turns while the train holds — correct
behaviour — but the JOINT that permits it is not modelled. The alarm side
states the same debt in the same words ("a backward crown free-slips at
the stem⇄contrate bevel without unbanking"), so this is one class with two
instances.

**The fix — corrected, because the first filing cited metal that does not
exist.** This item used to send the click to "the plate-top ratchet the
winding spur's own comment already describes", and no such ratchet exists:
the `windTop` block deleted it deliberately (a fixed pawl on a
bidirectional arbor was a display fiction — the fusee arbor turns both
ways, the wind held by the escapement through the train), and four stale
comments kept describing it anyway. Those comments are corrected and the
`RATCHET_TEETH` alias retired; the ratio sites read `WIND_SPUR_TEETH`,
the wheel that actually turns.

Nor can ANY wheel of the winding train host a fixed click: §126 declared
the keyless train two-way driven (the mainspring back-drives the same
teeth through the fusee arbor on run-down), so a plate click anywhere in
it would block the run-down — the same objection that deleted the old
one. The only joint where backward slip physically happens is the STEM
interface: the winding pinion ⇄ crown wheel coupling, which is exactly
what `windStemSlip` absorbs ("backward free-wheel … and the spins the
clutch takes out of mesh" — both cases are that one coupling's two
disengagements).

**So the metal is a saw-tooth one-way COUPLING at the sliding pinion**,
the real keyless-works site: split the dual-purpose `windPinion` into a
fixed winding pinion (always meshing the crown wheel, posed from the
bank) and a sliding clutch keyed to the stem, Breguet saw faces between
them, the yoke's fork tracking the clutch with a real yoke spring as the
restoring element (the yoke has none today). Crown forward drives
through the closed faces; crown backward cams the clutch axially one
snap per pitch — the slip; run-down back-drive closes the faces from the
pinion's side and drags the knob, which is the pose law's existing
backward creep given its mechanism. The shipped accumulation law is
already this coupling's law at pitch scale; what it owes is the two
sub-pitch corrections (forward take-up of a parked gap before banking;
knob hold through the drain until the face picks it up), persistence of
`windStemSlip` (the parked sub-pitch lives in the stem's free angle, so
no bank give-back à la `settleAlarmClick` — the bank is held by the
escapement and the arrest, not by this coupling), and the axis that
exercises the reciprocation (`setPose` never writes the slip, so today
no sweep and no §48 audit can see the clutch move — the TODO 56 lesson).
After that, `windStemSlip` is the coupling's relative angle — a
consequence of a modelled contact rather than a bookkeeping term.

The alarm stem states the same debt (a backward alarm crown does nothing
at all, `main.js`'s alarm wind routing) and stays its own instance: the
coupling builder and its lift law should be written movement-independent
so the alarm side can consume them when its turn comes.

### The parallel re-scope (2026-08-21) — the same joint, reached from measurement

The scope below landed on `main` while §149 was in flight, written against
the ORIGINAL filing (its "the fix above" means the old plate-top-ratchet
text, not the corrected filing kept above). It reached the same
conclusion independently — no winding wheel can host the one-way, the
collapsed stem coupling is the unique honest site — and adds what the
history above argues from structure: the measured regimes (the 3-turns-
per-barrel-turn back-drive, the 9.6e-8 stall, the 1:1 backward slip) and
the regime table showing the shipped laws already ARE the coupling's.
Everything it files to build IS built by §149, with two shape differences:
the coupling's cut lives in `sawCouplingSpec`/`makeSawCoupling` (its own
spec solver, not a `sawRadiusAt` twin), and the fork rides a pin-in-groove
on the clutch rather than the stem's own groove. Kept whole as the
record's second derivation:

**The fix above names a site that was deliberately removed, and no winding
wheel can host the one-way at all.** Scoped 2026-08-21. The plate-top ratchet
this item leans on does not exist: `RATCHET_TEETH` is an alias for
`WIND_SPUR_TEETH` (24), the spur is an involute `makeGear` wheel, and the
comment saying the saw-toothed ratchet "now sits on the plate top … where
its teeth serve only the click" is STALE (its twin in the keyless build says
the same). The windTop block both point at answers them three times over:
"There is deliberately NO ratchet or click on this arbor any more: the arbor
turns BOTH ways … and a fixed pawl on a bidirectional ratchet is
impossible." Correct both stale comments when this lands — they are what
made this item read "already described."

**Since §126 that impossibility covers the whole winding train.** Every
winding wheel poses from the bank and the bank drains with τ, so the crown
wheel counter-rotates during run-down — in the SAME direction a backward
crown turn would drive it. A pawl anywhere from the spur to the crown wheel
cannot tell the two apart, and would block a drive direction the §48 audit
declares on purpose (`declareRestoring('Keyless works', 'two-way', …)`: "the
mainspring back-drives the same teeth through the fusee arbor and its spur
as the watch runs down"). Measured headless on the shipped build: the stem
spinner's spin is a pure function of the bank at exactly 3 knob turns per
barrel turn (the 24:8 ratio — 5.25 knob turns over the full reserve, the
knob creeping backward as the watch runs down); a backward crown turn of
1.234 rad at mid-reserve moved the knob 1.2340 with the bank untouched, and
the slip is CONTINUOUS — no quantum anywhere; a forward turn at the arrest
moved the knob 9.6e-8, a dead stall.

**The one joint that can be a one-way is the one the model collapsed.**
`windPinion` "IS the sliding pinion" — one piece where a real keyless works
cuts two: a winding pinion free on the stem, always meshed with the crown
wheel, and a sliding (castle) pinion keyed to the stem, coupled to it by
saw-toothed breguet crowns on their mating faces. That coupling is the only
joint on the path where a backward crown turn and the run-down produce
OPPOSITE relative senses — the one distinction a one-way can make — and
every regime §126 already ships is exactly what that coupling would do:

| regime | stem vs winding pinion | breguet coupling | shipped law |
|---|---|---|---|
| forward wind, below the arrest | driving | faces engaged, 1:1 | bank advances, knob tracks |
| forward at the arrest | rigid | stem stalls dead | banks nothing, moves nothing, no slip (measured 9.6e-8) |
| backward crown turn | stem backs off | cams over — the zip | `windStemSlip` accumulates (measured 1:1, bank untouched) |
| run-down drain | pinion backs away | faces engage, back-drive the knob | knob = f(bank), 3 turns per barrel turn (measured) |
| pulled to SET | separated axially | free spin | the clutch-out slip branch |

The two-piece stem is not just the real-watch answer; it is the unique site
consistent with what §126 ships, and it makes BOTH slip branches
consequences of ONE modelled joint.

**What to build instead.** Split `windPinion`: the winding pinion stays at
crown-wheel mesh depth, free on the stem — it LEAVES the sliding
`windSpinner` group, a parenting change — and the sliding pinion keeps the
stem key, the axial ride and the setting mesh. Cut breguet crowns on the
mating faces (the cut law is `sawRadiusAt`'s axial twin — tooth HEIGHT over
azimuth rather than radius over azimuth); the backward-turn cam-over is an
axial lift of the sliding pinion against the yoke's detent spring (the yoke
already tracks its groove), with the lift law the §99 "smallest lift that
clears the metal" idiom. The crown count N and the ramp angle are design
parameters DERIVED from the detent-spring window (TODO 16's format: the
ramp's axial force under a finger's backward torque must beat the spring,
and the spring must re-seat from any parked ramp point), not chosen.

**The give-back is the piece a copy of §99 would get wrong.**
`settleAlarmClick` subtracts the parked ramp fraction out of the STORED
WIND — the arbor recoils to its seat. Here the wheel held the whole time;
that hold is the point. The going settle slides the STEM down the ramp to
the nearest seat: it adjusts `windStemSlip` by up to one coupling tooth
(quantum 2π/N of stem) and must never touch `barrelWindTurns`. The restore
seeding that rebuilds the slip from `crownRotation` must land on a seat for
the same reason.

**Costs, priced.** The fingerprint moves (a re-parented pinion, a new part).
The winding and sliding pinions are two movers in different frames inside
one unit, so the coupling enters `intraUnit`'s MM tier — a declared
`INTRA_UNIT_CONTACTS` joint plus the unit's own build asserts at the seat
(the §120 pattern: the tier covers the class, the asserts keep the per-cycle
instances) — and the seat wants the §99 package: a handoff row, the
vertex-against-analytic-saw penetration form (a beak in a valley is locally
wrapped, so `mtvDepth` pops it out sideways), `declareTravel`, and the
restoring declaration re-stated (the sliding pinion reciprocates axially;
its restoring element is the yoke spring, which must exist as a mesh). And
rule 4's §48 warning applies a fourth time (items 29, 56 and 64 are the
other three): no axis anywhere varies the going `crownRotation` — only
`alarmCrownRotation` is swept — so the cam-over lift would reciprocate on an
axis that does not exist. Ship the axis that exercises the backward
free-wheel, or the audit passes the new members in silence.

**The alarm instance stays the class's second row.** The alarm crown states
the same debt in the same words at its sliding bevel ⇄ contrate coupling;
the same two-piece treatment applies there, filed here and not absorbed.

---

## 51. CLOSED — the finger's accommodation is solved with the finger, not after it

`expectedContacts` measured the §126 arrest against two of its own declared
pairs at **min 0** — genuine contact where the row asks `CLEAR_MARGIN`, with
the declared working contacts excluded. Both were POSITION-space defects in
the finger's own members while the mechanism held: the beak⇄lug hand-off, the
pad⇄coil hand-off, the penetration budgets, the stock floors and the
intra-unit joints were all green.

Both rows are closed, and every arrest row now measures clear with a silent
boot:

| row | was | now | floor |
|---|---|---|---|
| `Winding arrest ⇄ Chain` | 0 (`windArrestBeakArm`) | **0.2256** (`windArrestPadArm`) | 0.15 |
| `Winding arrest ⇄ Fusee & great wheel` | 0 (`windArrestPad ⇄ windArrestLug`) | **0.1500** | 0.15 |
| `Winding arrest ⇄ Three-quarter plate` | 0.3596 | **0.1700** | 0.15 |

### What the first attempt got wrong, and what the reach really is

The item's earlier draft recorded a fix that drove both rows green and was
reverted because it opened four other gates. That attempt was right about the
symptom and wrong about the number. `ARM_STOP_R` was derived from the station
CONTINUUM, and the mesh lays straight links between rivets, so a polygon's
corners stand proud of the circle through its facet mids. Measured on the same
discrete layout `rebuildChain` lays and the pad's law already reads, the wrap's
demand at the plate's band is **4.45** where the stations said ~4.28.

Two corrections travel with that, and both were mistakes the first pass made
in the safe-looking direction:

- **A chain point demands a SPHERE of `CLEAR_MARGIN`, not a margin in r plus a
  margin in z.** A link a margin below the band is already clear; asking it for
  the full radial margin as well prices the same clearance twice. A point `dz`
  outside the band demands `√(margin² − dz²)` in radius.
- **A REACH is a shell radius, and that is a sound statement only about metal
  that WRAPS the cone.** The one link straddling the departure is half-way to
  the drum, and the free span crosses the plate's band at radii from 4.6 out to
  29 — a member is perfectly entitled to sit inboard of it. Fed to a reach law
  that link read **4.79** against the wrap's own 4.37, and the whole finger got
  shoved outboard to clear a corridor that was never in its way.
  `linkOuterPtsNear` gained `wrapOnly` for exactly that link; the pad's law
  still needs it (it is the top of the wrap, and the pad rides it), so the flag
  is opt-in. Fed the straddling link, the same law read **4.79**.

### The chord is the member, not its two ends

A straight bar between two points that both clear the wrap dips inside it: its
centreline's closest approach is `R·cos(Δaz/2)` and its own half-width takes
`ARM_W/2` more. Holding the arms' ENDS to `ARM_STOP_R` proved a clearance the
metal did not have — the beak arm's inner edge stood at **3.86**. Both arms now
solve their outboard station against the whole chord.

And the sweep runs over the finger's TRAVEL, which is **not** the designed
throw. `PAD_LIFT` is what the pad rises between rest and full wind, but the lift
law is a per-interval SUP, so a link phase reaching further than the one under
the face at exactly t = 1 lifts the pad past `PAD_LIFT` and swings the plate
past `PSI_FULL`. Measured, that over-swing carried the beak arm's outer corner
0.11 inside a stop that a seat-to-`PSI_FULL` sweep had just proved clear, and
the gate found it at t = 0.985. The travel is `LIFT_MAX/padGain` now, and
`declareTravel` quotes the measured ride instead of allowing 1.35 for it.

### Arms stay out, tabs reach in

An arm spans thirty-odd degrees, over which the wrap climbs to a fatter station;
a tab spans a few, where its radius barely moves. Both arms stop at
`ARM_STOP_R`; `PAD_T` and `BEAK_RAD` are the gaps their tabs bridge rather than
literals, so each member is one connected body and the only metal standing
inside the wrap at plate z is the pad's working face.

The pad's lean rides a **shear baked into the geometry**, not a rotation on a
parent group. At the stock a bridging tab needs, a rotation swings its corners
`PAD_T·sinθ − (h/2)(1 − cosθ)` ≈ 0.29 out of the band — spent out of exactly
the margin the stratum plan buys from the lug. The shear puts the working face
on the same plane (`r = const − z·lean`, which is what the law reads back) and
moves no vertex in z. It cannot ride a parent group: every BVH distance query
would then be measured in a sheared frame and return something that is not a
length. Baked in, the geometry's AABB is no longer tight — the very over-read
the §126 note warned about, arriving by the other route — so the tab publishes
its pre-shear box and its shear in `userData`, and the bespoke fit measure
un-shears the point before testing.

### The two ceilings, and the one dimension that was never derived

The bracket is the obvious ceiling over the finger's plate. The lug's underside
stands 0.035 lower and sweeps every azimuth once per cone turn, and the pad's
face is radially INSIDE that orbit by construction — it has to be, it reads the
coil the lug turns with — so nothing but z can separate them. The plate now
hangs under the lower ceiling.

Doing that honestly exposed the real blocker, which was not a clearance at all.
Two requirements meet at the finger's pivot:

- it must stand outside the wrap, hub rim and retaining head both —
  `studR ≥ ARM_BAND_REACH + HUB_R`;
- and the beak's lever must keep its designed ratio band AND an engaging
  reaction. With the beak at radius `Rb`, the stud at `Rs` and δ of azimuth
  between them, the reaction is engaging only while `Rs·cos δ ≤ Rb`, and the arm
  is inside its `2.2·R_PAD_ARM` ceiling only while
  `Rs² + Rb² − 2·Rs·Rb·cos δ ≤ L_max²`. Eliminate δ and they are compatible only
  for **`Rs ≤ √(Rb² + L_max²)`**.

At the lug's §126 proudness that ceiling was **4.79** against a floor of
**4.98** — an EMPTY window. And empty at EVERY legal pad azimuth, which the
ranked walk proves rather than assumes: both bounds are radii at the same
point, so no amount of turning the mechanism about the cone opens them. That
is why honestly clearing the pivot kept costing the beak scan its candidate,
and why the first attempt's four red gates were not bad luck.

`LUG_OUTER` was the one dimension in the mechanism derived from nothing that
binds: §126 gave the lug the CHAIN's proudness, a tidy tie. It is now sized by
inverting that ceiling — the proudness the stop needs so a pivot cleared of the
wrap can reach it on a lever of the designed ratio — and built to the greater of
that and the chain's, so it never stands less proud than the coil whose place it
takes. Growing it spends no P0/P1 quantity: the throw, the bite
(`ENGAGE = BEAK_THROW − (CLEAR_MARGIN + 0.02)`) and the ratio band are
untouched, and the lug's channel is runout, with nothing out there to foul.

### The solve chooses them together

The azimuth solve RANKS its candidates now instead of reducing to one, and each
is carried through the whole finger solve — window fixed point, three-way stud
shove, beak scan — until one comes out with a legal beak. Stud, arms, tabs and
beak are chosen together rather than in sequence, which is what the item's
earlier draft asked the next pass to do. Ordinary cost is one trial; the
best-scoring azimuth usually solves.

### Residue, named — and where each row went

All three rows were worked after the landing; two closed, one was attempted
and REFUSED by measurement, which is a better state than "left deliberately"
because the refusal is now a fact with a trace instead of a fear:

- **The two-step beak window — CLOSED.** The two-step width was a TARGET,
  not an accident: `LUG_OUTER`'s inversion grew the lug until the analytic
  window reached exactly `2 · BEAK_SCAN_STEP` (0.04 rad), while the comment
  above it already demanded "the beak's own tangential width plus a scan
  step". The demand is now that arc (`BEAK_TAN / Rb + BEAK_SCAN_STEP`
  ≈ 0.1 rad), which decouples freedom from resolution — the step appeared
  on BOTH sides of the old expression, so a finer scan NARROWED the built
  window. Cost: `LUG_OUTER` 4.086 → 4.231 (the lug's proudness is the
  priced currency; fin assert silent), and the shipped trace reads five
  legal steps (`…mmmm.....llll…`) instead of two. The trace remains the
  first thing to read when a boot warn names the scan.
- **`Winding arrest ⇄ Fusee & great wheel` at exactly 0.1500 — KEPT, with
  the relief now MEASURED as impossible on this fold.** Dropping the finger
  plate a §50 pivot floor (`HUB_Z2 = LUG_Z1 − CLEAR_MARGIN − PIVOT_MIN_U`)
  was tried on top of the widened window: the analytic window held exactly
  as designed, and the CHAIN'S DEPARTURE CORRIDOR then covered every legal
  beak azimuth at every one of 147 candidate pad azimuths — the trace's
  `c` rejects bridged straight into the `l` ceiling, the moment window
  never opened, and the solve fell to its unchecked fallback with a
  disengaging moment. The equality stays, with that refusal written at
  `HUB_Z2` in place of the old fear. Any future relief has to move the
  SPAN (the drum's hook plane or the departure azimuth), not the pad.
- **`ARM_STOP_R` azimuth-blind — CLOSED for the arms (the safe half).**
  The same sphere-of-margin loop now fills a 72-bin per-sector table
  (`WIND_ARREST.armReachBin`, 5° bins, neighbour-max lookup so a demand
  sphere's ~2° footprint cannot straddle past the query), floored
  everywhere by the lug's orbit, and the arm hold measures SLACK against
  `armStopAt(az)` instead of radius against the compass max. Stock only,
  as predicted: pad-arm end 4.695 → 4.631, riser 5.765 → 5.471, pad
  bridge 1.133 → 1.069; the beak scan and `STUD_FLOOR_R` deliberately
  keep the global — a floor the per-candidate pass could walk past would
  re-open the empty window it exists to close, which is the standing note
  at `STUD_FLOOR_R` and stays answered by not doing it.

---

## 52. `setPathRot` is not persisted, so the setting train re-phases on reload

The sibling of the defect §47 closed. `barrelWindTurns` is saved and the
winding train's angles are derived from it, so a reload lands the fusee,
spur and let-down square exactly where they were. The SETTING path still
accumulates `setPathRot`, which `captureState()` does not emit and
`sanitize()` does not whitelist — so the keyless minute wheel and
everything it drives snap back to base phase on every reload, while
`crownRotation` restores. The hands do not jump (the jumper's `jumpCorr`
covers the display), which is exactly why it has stayed invisible.

**The fix, in §47's own shape:** prefer DERIVING over persisting. If the
setting train's angle is a function of a quantity already saved, derive it
and delete the state; if it genuinely is not, persist `setPathRot`
alongside `crownRotation` and clamp it on restore.

**Investigated 2026-08-21 — the derivation branch fails honestly, so
persist is the path.** `setPathRot` accumulates only while the crown is
out, so it is a HISTORY INTEGRAL: no saved scalar reproduces it
(`crownRotation` restores the crown, not how much of its turning
happened pulled). Persist it in `captureState()`, whitelist it in
`sanitize()` — item 65's lesson: the two lists move together or the
field dies silently — and clamp on restore by wrapping to the setting
train's period (one minute-wheel revolution's worth), so the float
cannot grow without bound. Two couplings to keep whole: the alarm
re-solve watches `setPathRot` DELTAS, so its previous-value must be
initialized from the restored number or every reload fires a spurious
re-solve; and `jumpCorr` composes with the restored value — the reload
must land the keyless wheels on their phase AND keep the hands where
they were. Validation: the CI fingerprint double-boot (virgin state —
should be unaffected; confirm), plus a save/reload probe asserting the
setting-wheel/minute-arbor angles round-trip and the hands do not jump.

---

## 53. CLOSED — the plate floor counts the chain now, in closed form

§47 owed this measurement and took it: the gap between the top coil at
full wind and the plate's underside, measured over the discrete link
layout, was **0.117** against `CLEAR_MARGIN` 0.15 — a declared clearance
the movement did not honour at its tightest station, watched only by a
sign assert.

**The root cause was the plate-floor law's blindness, not the z-stack's
tightness.** `TQ_BOT_Z` was `max(measured under-plate boxes, hairspring
stack) + margin`, and the chain is nobody's measured box — the one
under-plate occupant that list could never see. The item's own framing
("either the plate rises or the cone's band drops") resolved to the plate,
decisively: the arrest's pad band is LUG-bound (`HUB_Z2` resolves to
`LUG_Z1 − CLEAR_MARGIN` by 0.115), `chainProudAt`'s stud ceiling already
stood above every chain point, so a plate rise moves NO arrest quantity —
measured, the beak window, candidate set and `LUG_OUTER` are bit-identical
— while a cone-band drop would have dragged the pad band, `F_PAD_WALL`,
the §104 equalisation solve and the §124 asserts all at once.

**The fix is the §51 pattern — the binding part is NAMED**: `CHAIN_TQ_REACH`
(with the fusee constants in `src/main.js`) bounds the discrete top-of-wrap
in closed form — the wrap-top groove station plus the ramp-leaned stadium
section's reach, `h·cosβ + max(w·sinβ, t_z·w)`, scanned over the top
pitches, the unleaned straddling link seeding it (legal because the hook
plane sits under the wrap top, asserted) — and joins `TQ_BOT_Z`'s max
beside the spring. The A2 measurement now holds it honest both ways every
boot: gap ≥ `CLEAR_MARGIN` (measures 0.187), and the discrete top under
the bound (`chainTqBoundSlack` ≈ 0.037 published — chording errs the
bound outward, the right side for a floor). A
`Chain ⇄ Three-quarter plate` row in `CLEARANCE_BUDGETS` is the
independent check from the sweep side (min 0.284 at full wind — the fusee
window keeps plate metal off the cone's zenith).

**The priced cost:** the plate rides the chain now, ~0.07 above the
spring bind, so the balance cock's slab sits that far down IN the plate
band instead of flush at its underside — the coupled cock/plate design
goal is spent knowingly, with the comment at the floor law re-worded to
say by whom. Residue: none — but any future entry that runs anything
else over the cone inherits `CHAIN_TQ_REACH` as its ceiling's precedent.

**Re-measured at §150** (the conserving solve re-cut the flank, so the
bound re-derived exactly as this item's price warned): gap 0.1808 against
the same 0.15 margin, `chainTqBoundSlack` 0.0308 — both asserts green,
and the plate band settled 0.0007 lower with the new reach. That hair of
z is also how §150's report diff found TODO 73 (a connectivity ray in the
alarm switch rolled onto a pre-existing degenerate triangle).

## 54. CLOSED — the sweeps enter every axis canonical, and the leak they used to carry is measured

`AXES`' own header states the invariant: *"Each pose object feeds
`__clock.setPose()`; unspecified state keeps its prior value, so every axis
pins the others to a fixed default."* The first clause is true and the
second is false, which is the worst possible pairing — a comment that names
the hazard and then claims it is handled.

**The mechanism.** `setPose` assigns only the keys its argument NAMES; every
other state variable rides through untouched. It accepts twelve — `tau`,
`crownPullT`, `leverEngage`, `tension`, `setPathRot`, `alarmCrownRotation`,
`alarmCrownPullT`, `alarmReleased`, `alarmOn`, `alarmBarrelWind`,
`alarmWindRotation`, `alarmStrikePhase` — and six of the eleven axes name
four of them. `start()` calls `clock.resetInputs()` once per CHECK, and
`runInspection` (like every other sweep) never resets between axes. So each
axis inherits the last pose of the axis DECLARED ABOVE IT:

| axis | names beyond the four | inherits |
|---|---|---|
| `beat`, `crown`, `reserve`, `wind`, `train`, `jumperEngage` | — | nothing (they precede every axis that writes anything else) |
| `handSet` | `setPathRot` | — |
| `alarm` | `alarmCrownRotation`, `alarmOn`, `alarmCrownPullT` | `setPathRot` at a full minute-wheel revolution |
| `alarmStrike` | `alarmStrikePhase`, `alarmOn`, `alarmReleased` | that, plus `alarmCrownRotation` at 2π |
| `alarmWind` | `alarmWindRotation`, `alarmOn`, `alarmReleased`, `alarmCrownPullT` | those, plus `alarmStrikePhase` at the end of a ring |
| `alarmToggle` | `alarmOn` | all of the above, **plus the alarm barrel at FULL WIND** |

**Why this is debt and not a curiosity.** Three reasons, none of them
hypothetical:

1. **The instrument's coverage claim is not what its comments say.**
   `alarmToggle`'s block is careful about what it uniquely sweeps (the
   parity, and therefore the column wheel and everything the wheel drives)
   and says nothing about running that sweep with a fully wound alarm
   barrel, a fully turned setting path, and a strike phase parked wherever
   the previous axis left it. An inherited pose is still a REACHABLE pose,
   so this is not a false green — it is a sweep whose state nobody
   declared, described by prose that implies somebody did.
2. **Every sweep-based report is a function of `AXES`' declaration order.**
   Reorder the array — or run a subset, which is what focused work and
   `probe-*` scripts routinely do — and the poses change. The §36 registry
   documents exactly this mechanism where it forced its own pose walk to run
   "in the order they always have," because "some of what setPose writes is
   CUMULATIVE (TODO 20's alarm column advances a step each time a pose flips
   the parity, so its angle depends on how many flips came before)" and
   "setPose() cannot save this on its own, because it assigns only the
   fields a pose names and everything else rides through." The fragility is
   written down in one place and contradicted in the other.
3. **It blocks the roadmap's battery-partition entry (§127).** A partition
   that runs axes in separate contexts starts each from `resetInputs()`, so
   the split cannot be report-identical until a pose is a function of its
   pose object. That entry's tier 0 is this item.

**The fix.** Make the poses TOTAL: a declared base pose merged with each
axis's delta, so every axis pins all twelve keys and no axis can observe
which one ran before it. Where an inherited state was worth having, keep it
by NAMING it — an axis that wants the alarm barrel wound says so in its
pose, which is this same fix from the other side and turns an accident into
a decision. Two things it does not fix on its own, to be recorded with it:
`alarmColSteps` is cumulative within an axis (a total base pose makes axis
order irrelevant, not an index range inside `alarmToggle` reproducible), and
the chain mesh is a baked path rebuilt only past a 0.0015 tension delta —
benign as measured (the two tension axes step 0.00278 and 0.0167, so every
pose re-bakes), and the class of state to re-check if either n or the
threshold moves.

**Expect the reports to MOVE, and accept them per row.** Pinning what the
axes leak changes the poses the §36 registry samples, and the registry's
`reversed` flag is the population of §48's restoring audit — so
`restoring`'s rows can move, and so can any sweep row whose finding lived on
an inherited pose. That is the opposite of a no-change landing: diff the
`--report`, and derive each moved row rather than re-basing the file.
Gate the property afterwards — sweeping `AXES` in reverse order must produce
the identical report — because "we checked the order didn't matter" is not a
thing a later session can verify.

---

### CLOSED (2026-08-17, with roadmap §127). What was built, and where it
### diverged from the fix prescribed above

**The guarantee is a canonical ENTRY, not a total pose** — `enterAxis(clock)`
in `src/inspect.js`, called at the top of every axis by all five sweeps that
walk `AXES` (`runInspection`, `sweepClearances` — which is `clearances` and
`expectedContacts` both — `checkMechanicalGraph`, `checkIntraUnit`,
`checkAssembly`). **The base-pose fix this item prescribed does not hold, and
the reasons are in `setPose`'s own comments**, so they are recorded here rather
than discovered again:

- **The writers OVERLAP.** `alarmWindRotation` assigns `alarmCrownRotation` as
  well as the barrel wind, and it is applied AFTER it — so a base naming the
  latter and an axis naming the former do not merge, they fight, and the base
  wins. The `alarm` axis would have swept an unturned crown.
- **A base `alarmBarrelWind` silently RE-MEANS the strike axis.** setPose
  derives the wind from `alarmStrikePhase` only when the pose does not state
  it (§99's honest ring trajectory); a base that states it binds instead.
- **No pose object can reach the accumulator that matters.** `alarmOn` NUDGES
  `alarmColSteps` one step toward the requested parity (TODO 20 — the wheel is
  the state), so the column's ANGLE is a function of how many flips came
  before, not of the parity asked for. Only a reset zeroes it.

`resetInputs` is the exact statement of canonical, and it is the same call the
FINGERPRINT already made before every pose it hashes — the sweeps were the half
of the codebase that had never learned it.

**The leak was real and it was large.** The item said plainly that whether any
current finding depended on an inherited pose was unmeasured; `checkAxisEntry`
measures it over all 220 ordered (prev → axis) hand-offs at two fractions, and
**106 of them moved geometry**: `Alarm disc` by 17.7 (in 54 pairs), `Hour
wheel` 7.917, `Alarm crown` 5.0, `Alarm striking wheel` 2.865, and nine more
alarm-side units below that. Those displacements are the poses the sweeps were
running on — reachable poses, but ones nobody declared, and an `Alarm disc`
17.7 out of place is not a rounding difference in what a sweep covers.

**The gate is that check's other tier**: with the entry, every one of the 220
pairs reproduces the entered axis exactly (0 violations). It is not a tautology
about `resetInputs` — that list is hand-maintained and has been incomplete
twice (§34's explode, §58's drags, both added after a sweep ran on displaced
geometry), so a new banked input nobody adds to it fails here, on the pair that
banks it.

**Residue, named.** Cumulative state WITHIN an axis is untouched:
`alarmToggle`'s own parity flips still accumulate across its samples, so an
axis is reproducible from its start and an index range inside one is not —
which is why §127 slices between axes and not inside them.
**`buildSweptRegistry` is deliberately NOT entered per axis.** Its own comment
argues that its walks want whatever cumulative state the standing walks left,
because a reciprocation reproduces at any parity and the absolute pose does not
matter to a sign. That reasoning is sound, and leaving it alone is what keeps
§48's `restoring` population still across this change.

**It does not keep `sweptOverlap` still, and that is worth stating precisely
because it is easy to get wrong from the file structure.** The registry and the
hull phase are untouched, but the CONFIRM tier re-measures each candidate
through `measureClearance`, which is `sweepClearances` — so it inherits
canonical entry exactly as `clearances` does, and its numbers move with them.
Five checks are entered; six can move.
## 55. CLOSED (§129) — the stop-work counts the WIND now, through a spider differential

§106 shipped a Maltese stop-work for the alarm barrel: an 11 t pinion on a
plate stud meshing the arbor's 44 t wind wheel, a single-pin finger, an
8-station cross, banking after 7 pinion turns = 1.75 arbor turns = 56
clicks. The mechanism is real, its bank is metal, and its station was
solved. **What it is geared to is wrong.**

A stop-work limits the WIND — the angle held in the ribbon between the
arbor and the barrel body. §106's train reads the ARBOR'S ABSOLUTE ANGLE.
Through a wind those two are the same number, because the click parks the
body; the moment the alarm rings they part company, because the click parks
the *arbor* while the body runs. `alarmArborRotor.rotation.z` is
`alarmBodyA + (alarmBarrelWind − ALARM_BARREL_TURNS)·2π`, and during a ring
`alarmBodyA` rises by exactly what the wind term loses. The arbor is
stationary, so the cross is stationary.

**Measured** (`tools/probe-106-reset.mjs`, which poses the states directly
and reads the three rotors off the scene):

```
  state                       wind   phase    arbor    body   cross°  station   pin⇄cross
  A  wound to the ceiling    1.75   -0.62  -0.0387 -0.0387    151.5       2          0
     ringing, 50% left      0.875   13.38  -0.0387  0.8363    151.5       2          0
  B  run right down             0   27.38  -0.0387  1.7112    151.5       2          0
  C  re-wound to 100%        1.75   27.38   1.7112  1.7112    106.5       3     0.5914

  the second wind, swept: deepest pin⇄cross -0.7369 at wind 0.0525
```

Row B is the reported symptom: the spring is empty and the stop-work still
sits at its full-wind bank, pin against the blank arm, gap 0. It cannot
reset, because nothing it is geared to ever comes back.

The row under the table is worse. The second wind *starts* at the bank, and
the angle law keeps indexing straight through it: the pin goes **0.7369
into the cross's metal** — four pin radii (`pinR` 0.1847) — and comes out
the far side at another station. So the part is not a stop-work at all. It
is a ONE-SHOT: it permits 1.75 arbor turns from assembly and every wind
after that is a collision. The only thing keeping the simulation out of
that collision is `clamp(alarmBarrelWind, 0, ARREST_WIND_CEILING)` in
`tick()` and `setPose` — **a number standing exactly where §106 claimed to
have put metal**, which is the substitution that entry exists to have
removed.

### Why nothing caught it

Both causes are named residue, and both are worth fixing whatever route the
mechanism takes:

- **`intraUnit` reports it, untriaged, and it is not an accident of pose
  order.** The row is in the payload of a clean 24/24 run on top of §127:
  `unit "Alarm winding arrest", tier MM, a genevaFingerPin, b
  alarmArrestCross, at alarmStrike f=0`. The MM and FF tiers GATE only
  `INTRA_TIER_SCOPE`, and `'Alarm winding arrest'` was never added to it, so
  the pair is reported rather than held. CLAUDE.md names this residue in as
  many words; this is the first defect it has cost. It survives canonical
  entry because `alarmStrike` reaches the state through its OWN declared pose:
  it names `alarmStrikePhase` and lets `setPose` derive the wind, which puts
  the body and the arbor at angles no wind-only pose produces — exactly the
  disagreement the arrest cannot see.
- **`axisEntry`'s leak tier fingerprints it from the other side.** In the same
  run, the worst-moved unit under the old order-dependent entry is `Alarm
  winding arrest`, 24 pairs, worst delta 0.732 — the largest in the movement.
  That is what a unit looks like when its pose is a function of two members no
  single axis pins together. The tier is a REPORT, so it named this and gated
  nothing; worth re-reading after the re-gearing, because a stop-work that
  reads one quantity should stop being the movement's most pose-sensitive
  unit.
- **`probe-106-bank.mjs` reconstructs instead of reading.**
  `arrestDebug.pinInCrossFrame(wind)` builds the arbor angle from
  `ALARM_PHASE_REST` — true for every wind-only pose and false the instant
  the alarm has rung. The probe's 4/4 is honest about the pose it takes and
  silent about the one it cannot. `arrestDebug.now()` (added with this item)
  reads the three rotors themselves; the bank probe should use it.

### The routes, with the arithmetic that closes three of them

The Geneva's own numbers: `a` 1.5743, `b` 3.8008, `d` 4.1140. The alarm
barrel: `ALARM_BARREL_TIP_R` 6.885, wind wheel 44 t at module 0.3, mesh
centre distance `ARREST_CD` 8.25.

- **A — differential: the pinion's stud moves into the barrel BODY.** Sun on
  the arbor, planet carried by the body: in the carrier's frame the train
  sees `arborA − bodyA` and nothing else, which is the wind exactly, with the
  4:1 step-up and every derived quantity in §106 untouched. The cost is
  position-space and probably fatal: the mesh sits at CD 8.25 against a tip
  radius of 6.885, so the carrier is a bridge projecting past the barrel's
  own rim, and the whole stop-work then ORBITS the barrel axis through 1.75
  turns — a swept annulus reaching about 8.25 + `d` + `b` = 16.2. That is a
  measurement to take before the route is judged, not a guess to accept.
- **B — the textbook site: stop-work on the barrel cover, 1:1.** Closed by
  arithmetic, sign-definite. The cross must clear whatever sits on the arbor
  (centre ≥ `b` + sun radius from the axis) and lie inside the cover
  (centre + `b` ≤ 6.885), so it needs `2b` + sunR ≤ 6.885 while `2b` alone is
  **7.602** — impossible before the sun is given any radius at all. This
  movement's alarm barrel is too small to carry its own stop-work at the §50
  floors that size the Geneva.
- **C — a plate-mounted subtractor.** Bring both coaxial angles — the arbor's
  44 t wind wheel and the barrel's 44 t rim — into one counter with OPPOSITE
  senses (a bevel/spider differential, or a reversing idler on one leg), and
  feed its output to the Geneva. The Geneva's proven spec and its solved
  station both survive; the cost is the subtractor's own parts, each with its
  own P1 duties. This is the route that keeps the most of §106.
- **D — no stop-work.** Hold over-winding with a slipping bridle, or with the
  click and the set-up alone, which is what most going barrels this size
  actually do. Cheapest and entirely honest; it costs §106's mechanism.
- **Closed: make the wind integral.** A 1:1 Geneva travels N−1 turns, so it
  would need `ALARM_BARREL_TURNS` to be an integer. Extra pins do not rescue
  1.75: the driving arc is π − 2π/N = 135° at N = 8, so two pins is the most
  that can be spaced without overlapping engagement, and (N−1)/2 = 1.75 gives
  N = 4.5. Moving `ALARM_BARREL_TURNS` itself is a change to §104's group —
  the ring integral, the governor's I_a solve, the cadence endpoints — and is
  not this item's to spend.

### What is owed whichever route is taken

1. Add `'Alarm winding arrest'` to `INTRA_TIER_SCOPE` so finger⇄cross is
   GATED. Do it with the fix, not before: the tier goes red on the row above
   the moment it is in scope, which is the correct behaviour and would block
   everything until the mechanism is right.
2. Point `probe-106-bank.mjs` at `arrestDebug.now()`, so it asks its question
   at the live pose rather than at a reconstructed one.
3. Ship the axis this needed: one that WINDS, RINGS, and WINDS AGAIN. No axis
   composes those three deliberately. `alarmStrike` stumbles into a state that
   exposes the fault — it names the phase and lets `setPose` derive the wind —
   which is why the `intraUnit` row exists at all, and it survives §127 for
   that reason. But an axis that reaches a defect as a side effect of posing
   something else cannot be relied on to keep reaching it: the sequence the
   mechanism is FOR (wind, ring, wind again) should be a declared axis, so the
   reset is swept rather than stumbled upon.
4. Reconcile §106 in `docs/BUILT.md` and its `explain.html` entry: both
   currently say the ceiling is a consequence of metal. It is a consequence
   of a clamp until this is closed.

---

### CLOSED (§129). What was built, and where it diverged from the fix above

**Route C was taken and it worked**: a plate-mounted subtractor. Leg A off the
arbor's wind wheel, leg B off the body's rim through a compound idler that
arrives reversed, a SPIDER differential taking their mean, and an output stage
doubling it back onto the Geneva's own arbor. Gain 4, so travel is still
4 × 1.75 = 7 = N−1 and §106's cross, clocking and 56-click bank were inherited
whole rather than re-derived. `docs/BUILT.md` §129 has the full record.

**The measurement that closes this item.** Run right down, the cross returns to
its booted-empty pose to the digit, and swept over the whole travel the pin's
deepest approach to the cross is 0 — it touches metal exactly at the ceiling and
enters it nowhere else. Driven PAST the ceiling it still buries in the blank arm
(bank 4/4), so the stop is metal and no longer a clamp standing where metal was
claimed.

**Three of the four routes above are closed by arithmetic, not by preference,
and the entry above priced them correctly.** Route B stays closed (2b = 7.602
against a barrel tip of 6.885). Route A's carrier-on-the-barrel is closed for
the reason given. The "make the wind integral" route stays closed. What the
entry did NOT anticipate is that route C's cost is not the subtractor's parts
but its SITING: the tower needed a fourth freedom in §106's solve, the group
needed checking against itself (P2, which the pair sweep structurally cannot
see), and the solve needed a ceiling, the click pawl's declared swing, and the
going train's rotors.

**Item 1 is done**: `'Alarm winding arrest'` is in `INTRA_TIER_SCOPE`, so the
FF/MM tiers GATE this unit instead of reporting it, with eleven working contacts
declared — each measured before it was declared, per §121.

**Item 2 turned out to be closed by the fix itself.** `pinInCrossFrame` no
longer reconstructs anything: the chain reads `arborA − bodyA`, so a wind names
the pose completely and the striker's phase cannot reach it. `arrestDebug.now()`
was added anyway and is what `probe-106-reset` reads.

**Item 3 is STILL OPEN and is now TODO 56**, which is where it lives rather
than inside a closed item. No pose axis reverses the wind within a sweep, so
§48's no-spring audit still cannot judge the cross. §106 claimed a two-way drive
it did not have; §129 has one, measured, which makes the axis MORE owed than
before rather than less.

## 56. §129's stop-work reverses, and no axis sweeps the reversal — so §48 still cannot judge it

Opened by §129's landing, and stated there rather than hidden. It is the
residue of TODO 55 and it gets its own number because a closed item is a bad
place to keep live debt.

**What changed under the instrument.** §106 claimed the arrest's cross was
"two-way driven across a wind-and-run-down cycle by the same finger". It was
not: that train read the arbor's absolute angle, and the arbor stands still
through a whole run-down. §129 re-geared it through a spider differential, so
the claim is TRUE now — measured, running right down returns the cross to its
booted-empty pose to the digit, and the same finger walks it back through
exactly the states a wind walked it forward through.

**Why the audit still cannot see it.** §48's no-spring audit takes its
population from the §36 registry's `reversed` flag, and that flag is measured
per AXIS: a part counts as reciprocating when successive steps of one sweep
change sign. No axis reverses the wind within a sweep. `alarmWind` runs it up
and `alarmStrike` runs it down; neither turns round. So the cross is invisible
to the audit, no restoring element is declared for it, and the gate passes it
in silence — which is precisely the failure mode rule 4 warns about in as many
words: *ship the mechanism and you must ship the axis that exercises it, or
this passes it in silence.*

This is the same shape as the hole TODO 29 closed for the alarm lock, where no
axis anywhere varied `alarmOn` and the movement's clearest no-spring case was
invisible for exactly that reason.

**The fix.** An axis that WINDS, RINGS and WINDS AGAIN — the sequence the
mechanism exists for. `setPose` already accepts both `alarmBarrelWind` and
`alarmStrikePhase`, and `tools/probe-129-reset` (via `probe-106-reset`) already
drives that sequence, so the poses are known-good and the work is declaring
them as an axis in `AXES` rather than discovering how.

Three things to get right when it lands:

1. **The three legs are not interchangeable.** Winding advances the arbor with
   the body parked; ringing advances the body with the arbor parked; the second
   wind starts from a body that a ring has already moved. An axis that only
   ramps the wind up and down with the phase derived sweeps two of the three.
2. **Expect the reports to MOVE**, and accept them per row. A new axis changes
   what the §36 registry samples, so `restoring`'s population can change and so
   can any sweep row whose finding lived on a pose no axis previously visited.
   Diff the `--report` and derive each moved row rather than re-basing it.
3. **Then, and only then, the declaration.** With the reversal swept, the cross
   becomes a part §48 can judge, and it is driven both ways by the same finger —
   `declareRestoring` with kind `'two-way'`, which was rejected as STALE twice
   before because the mechanism did not deserve it. It does now.

**Also owed, and smaller.** `axisEntry`'s leak tier named `Alarm winding
arrest` the movement's worst-moved unit under the old order-dependent entry (24
pairs, worst delta 0.732) — the fingerprint of a unit whose pose depended on two
members no single axis pinned together. Re-read that row after this axis lands:
a stop-work that reads one quantity should stop being the most pose-sensitive
unit in the movement, and if it has not, the reason is worth knowing.

## 57. CLOSED (§132) — the README claimed screwed gold chatons the movement did not have

**What it said when it was filed**, kept because the closure is only
legible against it. `README.md:305` listed **"screwed gold chatons over the
upper pivot jewels"** among the Glashütte-school features the finishing
follows, and `:314` compounded it: *"every item in the list above is still
there"* — a sentence whose whole job is to assert that the list is still
true after the dial's German markings came off. `makeChaton` was a complete,
documented builder — gold bezel, oil sink, pressed ruby, blued screws
straddling the rim — and it was **called by nothing**. Every jewel in the
built movement was a plain stone.

**And the movement had not merely skipped them; it REFUSED them, on
record.** The plate build argued the reversal in place: the three-quarter
plate is 0.8 thick, the hack and reset rods pass just above it, and nothing
may stand proud — so what was built was a gold RIM rising around a flush
stone (`ringGeo` at `TQ_T − CHATON_DEPTH`, then `jewelFaceGeo`), which is a
**rubbed-in** jewel setting. That is a different and older bearing than a
chaton, and it was the one this movement had chosen. The README named the
one it rejected.

`MATS.gold` was the tell that this was drift rather than a decision nobody
wrote down: its own docstring names the chatons as its reason to exist, and
its only live use was the balance's shock lyre spring. It has one now.

**The fix had two shapes, and both landed, in the order this item asked
for.**

1. **Correct the prose** — done first, and not wasted work: the README was
   never wrong in the interval between the two.
2. **Make the claim true** — BUILT §132. `makeChaton` is instantiated on the
   going train's three upper pivots (centre, third, fourth), and the README
   now names those three rather than claiming the whole set. The escape
   wheel's stone and the alarm train's stay flush rubbed-in jewels, which is
   a scope decision and is recorded in the source as one.

**The scope note this item published is WITHDRAWN, and the withdrawal is the
part worth keeping.** It read: three candidate sites, the fork cock and the
balance cock viable, the three-quarter plate **"not viable"**, and anyone
proposing the plate re-opening a settled argument. The plate is where the
chatons went. What was wrong with the note was not its conclusion but its
evidence — it inherited `src/main.js`'s own reasoning without measuring it:

- The stated objection was that **nothing may stand proud** of the plate, the
  rods running just over it. That is true and was never the obstacle:
  `makeChaton` is a FLUSH design — rim level with the face, heads sunk into
  it — and its own screw comment cites this plate's hack blade. The builder
  was written for this face.
- The real objection was a READING one: the stone looked sunk in a gold well.
  That followed from a depth nobody had derived. `CHATON_DEPTH` was 0.35
  "a little under half the plate", a preference; solved against the §50
  floors it is `TQ_T / (1 + CHATON_RUBY_FRAC)` = 0.4598, and the well closes.
- The old depth could not have carried a chaton at all: at 0.35 the pressed
  stone measures 0.098 mm against the 0.12 mm wheel floor. The refusal was
  never tested by an instrument because no chaton was ever instantiated.

The two cock sites remain unbuilt and are no longer this item's business —
they are candidates for a future entry, on their own merits, with the balance
cock's shock-setting boss (r 1.35, `src/main.js:5347`) still the constraint to
measure before assuming.

**What §132 also closed on the way**, both latent in a builder nothing
called: `makeChaton`'s screw heads were `t·0.5` thick, which no depth in a
0.8 plate could take over the floor (they now decouple to `STOCK_MIN_U`, §20's
own fix), and its oil sink was an `openEnded` cone — an OPEN mesh in the
scene, which is the class TODO 27 measured making `sweptOverlap` confirm an
overlap against a part 3.7 units away. The sink is now revolved into the
stone's own closed profile.

## 58. CLOSED — the documents call it a quick-set, and say what the detent actually is

Two separate defects stacked on one mechanism, and the outer one hides the
inner one.

**The outer defect: the documents disagree with each other.** A jumping
minute jumps once per minute *while the watch runs*. This one jumps only
while the crown is pulled out. `docs/BUILT.md:29` already knows that and
says so — *"This is setting-time jumping only"* — but the same file's §1
title (`:23`) is "Jumping-minute setting", `src/main.js:8440`'s section
header reads `JUMPING-MINUTE SETTING (BUILT §1)`, and `explain.html:1196`
states it flatly to a reader with no qualifier at all: *"The minute display
is a jumping minute."* The project's own vocabulary is already split against
itself — the roadmap calls the same mechanism "minute quick-set" in §19's
title while the source header calls it a jumping minute.

**The inner defect, which is the one that matters: the snap is posed, not
driven.** The crown does drive `setPathRot` continuously through the real
keyless tooth counts to `rawSetOffset` — that part is honest and is rule 2
working. But the jumper's contribution to the displayed angle is
`Math.round(… / MIN_PITCH) * MIN_PITCH` plus an exponential ease
(`src/main.js:25623–25626`). The star and the jumper are **posed alongside a
rounded display value**; they do not deliver the snap. In the README's own
vocabulary (`README.md:79–102`) that is *modelled*, not *simulated* — the
beak is described, and the detent it appears to enforce is arithmetic
running beside it. So the word "jumping" overclaims twice: once about WHEN
(running vs. setting) and once about WHAT DRIVES IT (a beak vs. a rounding).

**The fix.** Say **quick-set with a detented display** wherever the claim
appears, and point at roadmap §4 — "Full jumping-minute display", already
filed as the real thing — as what would earn the stronger word. Correcting
the words is cheap and does not wait on §4; conflating the two is what has
kept this unfiled.

**Where it appears, with the cost of each — this is not a three-line fix
and the item should not pretend otherwise:**

- `docs/BUILT.md:23` (§1's title) and `src/main.js:8440` — free, they are
  ours to rename. `src/main.js:2845` and `:17027` name the same works and
  should follow so the file reads consistently. The two `console.warn`
  strings at `:8455`/`:8468` are boot-assert text, not claims, and can be
  left or renamed with the rest.
- `explain.html:1196` — **costs five translations by design.** The block is
  keyed by its normalized `innerHTML` in all five `src/explain-i18n.*.js`
  tables, so editing the English invalidates every one of them and the
  paragraph renders English until re-translated. That is §73 tier two
  working as intended, not a problem to route around. Never retype a key:
  `node tools/explain-i18n.mjs --extract --page explain` regenerates them,
  and `--check` is the gate.
- **Two user-visible tour captions**, in `src/i18n.js` × five locales:
  *"The jumping-minute setting works, behind the dial"* (`:337, :562, :954,
  :1347, :1739`) and *"On the dial side, pull the crown and the
  jumping-minute works engage"* (`:347, :572, :964, :1357, :1749`). These
  are tier-one strings keyed by the English source, so changing the English
  means changing all ten rows in the same landing or the captions fall back
  to English visibly.

**One thing to keep while renaming.** The mechanism's honest half is worth
saying out loud rather than losing in a correction: the setting path IS
geared, the beak's clearance over the star is a solved release gap
(0.1500 — exactly one `CLEAR_MARGIN`), and `setPose` deliberately cannot
fake the ease through. The correction is to the word "jumping", not to the
claim that the works exist.

**CLOSED — and closed as a WORDS fix, which is what the item asked for.**
No mechanism changed, so no report can move; what changed is what the
project claims. The name everywhere is now *minute quick-set*, with
*detented display* where the quantization is the point.

**The outer defect is gone.** `docs/BUILT.md` §1 is retitled "Minute
quick-set, with a detented display" and carries the old name on the record
with both overclaims spelled out — the file no longer disagrees with its own
Goal paragraph. `src/main.js`' build header (`JUMPING-MINUTE SETTING`) and
its tick header (`JUMPING-MINUTE SETTING:`) are retitled the same way, as
are the lifter-plane comment, the quick-set state block, the `Setting`
preset's comment, `resetInputs`' note, both boot-assert strings, and
`inspect.js`' two comments. `explain.html`'s claim sentence is rewritten and
its summary line with it.

**The inner defect is NOT fixed, and is now stated where someone would be
misled instead.** It is a roadmap item, not a rename: the fix is a
once-per-minute release taken off the train with an energy story to pay for
it, which is roadmap §4 ("Full jumping-minute DISPLAY", still unscoped). So
three places now say what actually happens rather than implying otherwise —
the tick block's own comment beside the `Math.round`, §1's new note, and
`explain.html`'s honesty ledger: the INPUT is simulated (the crown's turn
carried through the real keyless and motion-works tooth counts, which is
what closed item 3), the DETENT is arithmetic, and because the star turns
with `mwMinuteA` — computed FROM the quantized value — the beak rides a
profile the display has already chosen. The star and jumper are MODELLED and
they follow; they do not deliver the step. Both words used in the README's
strict sense, which is the whole point of the item.

**What it cost, against the estimate.** The five explain-page translations
were paid as filed — but for THREE blocks each, not one: the claim
paragraph, the new honesty-ledger note, and the section's summary line, all
regenerated with `--extract` and never retyped. `--check --page explain` is
PASS at 596/596 per locale, 0 unmatched, 0 markup drift, 0 `<code>` drift,
0 plate-number drift, 0 new plate overflow. The tier-one bill came to
fifteen rows, not the ten filed: *"Turn to set — the beak snaps the hand one
exact minute per detent"* is the same overclaim in one caption's width, and
renaming the works around it while leaving the beak snapping the hand would
have kept the lie in the place most people actually read it. It now reads
*"the hand steps one exact minute per detent"*.

**Deliberately not renamed:** the unit `'Minute jumper'` and every
`jumperLever` / `jmp*` / `jumpDisp` identifier. The PART is a jumper — a
sprung detent lever — and that name was never the overclaim; `inspect.js`
couples by string, so a display-word correction must not reach values.

## 59. CLOSED — the click's nose is solved against the wall and the corner it rides

`profileAt` (`src/geometry.js:1216–1222`) returns a normalized 0→1 that is the
column top's **height** fraction across the chamfer. Two riders consume it and
only one of them is right.

The link beak consumes it as a height, correctly — `noseDrop = colH * (1 - profile)`
(`src/main.js:26296`). The click consumes the same number as a **radius**:

```js
alarmClickArm.rotation.z = ALARM_CLICK_BASE + ALARM_CLICK_SWING * colBlock;   // :26602
const ALARM_CLICK_SWING = (ALARM_CLICK_OUT - ALARM_CLICK_SEAT) / ALARM_CLICK_L;  // :15647
```

`ALARM_CLICK_SEAT` = 4.94 and `ALARM_CLICK_OUT` = `ALARM_COL_BASE_R + ALARM_CLICK_NOSE_R`
= 5.98 are both **radii** (`:15645–15646`), so `ALARM_CLICK_SWING` is a radial
chord over an arm length. The pillar's outer wall, meanwhile, stands at a
**constant** `ALARM_COL_BASE_R` = 5.7 across the pillar's whole arc — the
chamfer is cut in **z** only (`src/geometry.js:1101–1142`, `top = colH * prof(a)`).

**So mid-flank the click's nose is driven radially inward into a wall that has
not moved.** With the shipped constants, the nose centre sits at
`4.94 + 1.04·c`, radius 0.28, at the band mid-plane 0.7 above the base disc:

- z overlap once the pillar is taller than the nose's underside: `1.4·c > 0.42`, i.e. **c > 0.30**
- radial burial: `1.04·(1 − c)` — **0.52 at c = 0.5**, **0.73 at c = 0.30**

against `CLEAR_MARGIN` = 0.15. Only the two settled ends are clean: at c = 1
`ALARM_CLICK_OUT` is tangent to the wall **by construction**, and at c = 0 the
nose is dropped in a 30°-wide gap. Everything between is inside the metal —
and **71% of each column's half-arc is flank** (`flatHalf` 4.32° against
`flank` 10.68°, from `geometry.js:1057` at `ALARM_CLICK_NOSE_R` = 0.28).

**Derived from the constants, not measured on the built mesh** — say so when
fixing, and confirm with `meshesIntersect` at a live mid-flank pose. Which is
the next problem.

**Why nothing catches it — four independent reasons, each sufficient.**

1. **The declared contacts are blanket exemptions.** `INTRA_UNIT_CONTACTS`
   rows `src/inspect.js:2032` (detent arm) and `:2033` (detent ball) are
   matched by `allowed()`, which short-circuits **before** `verdict()` ever
   runs. Those pairs are exempt at any depth at every pose — not waived,
   *unmeasured*. `INTRA_UNIT_WAIVERS` is empty, so nothing shows in a report.
2. **Row `:2032` cites a budget that does not exist.** It says the pair's
   budget is *"the switch's own asserts"*. There is no such assert: every
   `console.warn` in the switch build (`main.js:15486–16959`) is a plate-edge,
   spring-lane, phase, saw-direction, ergonomic-floor or slot-drift check, and
   **none measures the click's nose or arm against the pillars through the
   flank.** A declaration table pointing at a check that was never written is
   worse than no declaration, because it reads as triaged.
3. **No pose can reach a mid-flank angle.** `setPose` jumps `alarmColSteps` by
   one and immediately sets `alarmColShownA = alarmColSteps * ALARM_COL_STEP`
   (`main.js:27228–27235`), so under every inspector pose `colBlock` is exactly
   1 or exactly 0. The transient exists only under the live `tick()` with
   `rawDt > 0`. This is TODO 7's territory, stated concretely.
4. **The one penetration budget on this wheel is the wrong pair on the wrong
   axis** — `PENETRATION_BUDGETS` has exactly one row touching `alarmColWheel`
   (`inspect.js:3119–3143`), for `['Alarm switch','Alarm link']` on axis
   `alarmStrike`, and its own comment concedes it sweeps one parity only. No
   budget row anywhere uses `axis: 'alarmToggle'`. And all three
   `EXPECTED_PAIRS` involving the switch have no `EXPECTED_CONTACT_FLOORS`
   row, so TODO 6's blanket excuse covers them too.

**This is a P2 finding — the group disagrees with itself — so the fix is in
mechanism space, not a waiver.** The precedent is TODO 22, which was the same
class (the pusher's press bar stopping 0.9 from the wheel's axis), was filed
in exactly those words, and was fixed rather than waived.

**The fix, in outline.** The click's radial position is not a linear function
of the chamfer's height; it is a function of whether pillar metal stands at
the nose's own height band at that azimuth. Derive the nose's path from the
pillar's *outer wall and top edge* — the surface it actually rides — the way
MODELING rule 9 requires (`docs/MODELING.md:209–227`, the §101 click's rule:
cut engagement profiles FROM the mating surface, through the contact law's own
mapping). Then give the pair a real budget instead of an exemption, sized
smaller than the stroke it polices, and add the missing footprint assert —
`alarmLinkReadClean()` (`main.js:16127–16142`) is the template and the link
beak already has one; the click and the lock beak do not.

**CLOSED.** The law is re-derived from the surface, the false budget claim is
retired, and the flank the pose net cannot reach is now measured.

**The new law, and why it has three branches.** In the (r, z) half-plane at one
azimuth the pillar is the rectangle `[colInner, baseR] × [0, zTop(a)]`, and the
nose is a sphere approaching from outside. The least radius its centre may take
is the distance-to-rectangle condition, with `dz = zNose − zTop(a)`:

| branch | condition | least centre radius |
|---|---|---|
| beside the WALL | `dz ≤ 0` | `baseR + noseR` |
| rolling over the top CORNER | `0 < dz < noseR` | `baseR + √(noseR² − dz²)` |
| pillar clear beneath it | `dz ≥ noseR` | free, to the seat |

The middle branch is the roll-off nobody had modelled, and it is the whole
correction: **the transition's width is set by the nose's radius and the flank's
`dz/da`, not by the flank's 10.68°**, which is what the old law spread it over.
Sampled across the nose's angular footprint (`asin(noseR/baseR)` = ±2.82°) and
taken at the maximum — `alarmLinkReadClean`'s shape, and §101's `clearAt` shape
one plane over: a rider clears a cut profile at its EDGES, not at a point.

**The arm angle is solved, not linearised.** The nose swings on an arc of
radius `ALARM_CLICK_L` about its pivot, so its distance from the wheel's axis
is a law of cosines. `(OUT − SEAT)/L` was that relation's first-order
approximation, and over a 12.7° swing that is not a rounding difference.
`ALARM_CLICK_SWING` is gone; the turn direction is MEASURED off the built frame
rather than assumed from the sign of anything.

**Measured, through a whole pitch** (`tools/probe-59-click.mjs`, 121 samples,
real surface-to-surface clearance against the pillars):

| | buried samples | worst |
|---|---|---|
| old law | **30 / 121** | **0.699** burial at 11.5° |
| new law | **0 / 121** | 0.0052 *clearance* at 2° |

The new law rides at ~0.005 over a column and drops to 0.42 in a gap, with the
lift-off at ~11.8° — which is where the derivation puts it (`prof < (zNose −
noseR)/colH` = 0.30), so the geometry and the measurement agree independently.

**The false claim is retired.** `INTRA_UNIT_CONTACTS`' row for the ball said
its budget was *"the switch's own asserts"*, and no such assert had ever been
written — thirteen `console.warn`s across the switch build and not one measures
the click against the pillars. **A declaration pointing at a check that does
not exist reads as triaged, which is worse than an admitted gap.** There is an
assert now, and it is deliberately INDEPENDENT of the law above: asserting that
`alarmClickNoseR` satisfies its own three branches would check a formula
against its own terms, which is exactly what TODO 15 warns about. It holds the
two things the MECHANISM claims — fully out over a column, fully home in a gap —
plus the seat clearing the inner wall it drops toward. Proven to fire: a nose
that cannot reach its column warns with the measured cause.

**What could NOT be done, and why it is not a dodge.** The item asked for "a
real budget instead of an exemption". There is no depth tier for an INTRA-unit
pair: `PENETRATION_BUDGETS` is per unit *pair*, and `intraUnit`'s only
vocabulary for a working contact inside one unit is the declared-contact
exemption. So the rows stay — what changed is that their `why` now cites
machinery that exists, and the depth through the flank is bounded by a
measurement that runs. Closing that structural gap (a depth budget for declared
intra-unit contacts) belongs with TODO 5's residue, not here.

**Still open, and inherited rather than caused.** `ALARM_CLICK_SEAT` is
`ALARM_COL_BASE_R * (1.30 / 1.5)` — a proportion kept through the §35 resize,
which its own comment admits, not a derivation from a constraint. It is
standing rule 1 debt sitting next to the law this item fixed; a correct seat
would come from the castellation floor plus the nose plus a margin, or from the
spring's preload travel.

## 60. CLOSED — the tower's arbor reaches its topmost member, and both sleeves end on metal

§129 fixed exactly this defect one member over — the finger's arbor stopped
short of its own output pinion, *"visible the moment the unit was rendered, and
invisible to every gate, because a wheel with no arbor under it collides with
precisely nothing"* (`src/main.js:15159–15164`). The instance was fixed. **The
sibling was not.**

**The sleeve is degenerate, and it is symbolic, not marginal.**

```js
const SUB_PIN_B_Z = SUB_CAGE_Z + SUB_SPEC.halfHeight + ALARM_WIND_WHEEL_T / 2;  // :14303
sleeve(pinBSpin, SUB_PIN_B_Z - ALARM_WIND_WHEEL_T / 2, SUB_CAGE_Z + SUB_SPEC.halfHeight, 'subSleeveB');  // :15105
```

Substitute the first line into the second and both arguments are
`SUB_CAGE_Z + SUB_SPEC.halfHeight` — the same expression. `tube()` then takes
`const h = Math.abs(zTo - zFrom)` = **0** (`main.js:15052`) and extrudes a ring
at `depth: 0`. Its sibling `subSleeveA` (`:15104`) takes two genuinely
different values; the asymmetry is the tell.

**And nothing else reaches the pinion.** The tower's arbor tops out at
`SUB_OUT_Z + ALARM_WIND_WHEEL_T / 2 + 0.2` = `SUB_CAGE_Z + 0.6`
(`main.js:15110–15111`), while leg B's pinion's lowest metal is at
`SUB_CAGE_Z + halfHeight`. At the shipped spider — 10 teeth, module 0.2036
(`docs/BUILT.md:13133`) — `halfHeight` = `R + module·0.85 + faceWidth·√½ + margin`
= 1.018 + 0.173 + 0.288 + 0.150 = **1.629**. So the pinion floats **1.03 above
the top of the only arbor that could pass through its bore**, with a
zero-height sleeve where the bridge should be. The conclusion does not depend
on the exact figure: `halfHeight ≥ R + margin` and `R ≥ hubR + margin + stockMin`,
so it exceeds 0.6 for any spec `spiderSpec` can return.

Compare `subIdlerArbor` one station over (`:15136–15137`), which runs past its
top wheel. **The tower arbor is the only column in the unit that stops below
its topmost member.**

**Derived from source, not from a boot.** The zero-height sleeve is exact
algebra and needs no measurement; the 1.03 should be confirmed against a live
build before it is published anywhere else.

**Why every gate passes it — and this is the reusable part.**

- A wheel with an empty bore collides with nothing, so no clearance sweep,
  hull overlap or penetration budget has anything to report.
- `assembly` (§107) asks whether a rigid frame is one connected body. The
  degenerate ring's two caps sit exactly on the pinion's bottom face and
  overlap it radially, so the pair measures at distance 0 and counts as
  connected. **A zero-height sleeve is the perfect connector**: it satisfies
  connectivity while occupying no space.
- `checkSupportGeometry` (`inspect.js:2644–2666`) is **unit-granular**. It
  takes the minimum distance between *any* mesh of unit A and *any* mesh of
  fixture B, at one pose, against `SUPPORT_TOL` = 0.5. The row
  `['Alarm winding arrest', 'plate']` passes the moment any ONE of the unit's
  four columns reaches the plate — its own comment says *"FOUR plate-top
  columns now"*. **Every wheel, sleeve, cross, finger and pin in that unit
  could be floating and the row would still read `gap 0.000, ok`.**
- The stricter tier, `MECH_GRAPH.anchors`, has six entries and none of them
  touches this unit.

**So there are two fixes, and the second is the one that matters.**

1. **The instance.** Give `subSleeveB` its real span, or run the tower's arbor
   past leg B's pinion the way `subIdlerArbor` runs past its wheel. Cheap.
2. **The class.** Nothing in the battery asks *"does every rotor have an arbor
   in its bore?"* — a per-MEMBER reach check, as opposed to `support`'s
   per-unit proximity check. The §129 siting solve already scores the two
   columns as pieces in their own right (`main.js:14360–14362`) and knows
   `TOWER_TOP` and `PIN_B` are different pieces at different heights
   (`:14608–14610`). **It scores them for clearance. Nothing scores them for
   reach.** Two instances of one defect in one mechanism in one session is the
   argument that this needs an instrument, not a third careful reading.

**The finger, separately, is a P1 question rather than a defect.** It does
have metal to the plate. What it has is a `ARREST_SPEC.arborR` = `PIVOT_MIN_U`
= 0.185 u (0.07 mm radius — a 0.14 mm wire) running roughly 8 units from a
plate-buried foot to a free top: a **~43:1 cantilever with no upper bearing**,
no cock and no bridge, and a `fingerBoreR = arborR + 0.05` running clearance so
the disc deliberately does not touch it. The section is derived and defended
(`main.js:14250–14255`: 182 MPa against hardened steel's ~600 MPa in shear),
but that derivation is a **torsion** check on the pinion's stall. Nothing
checks the column in **bending or buckling** over that slenderness, and no
watchmaker would leave a wheel arbor of that ratio unsupported at the top. That
is what "appears unsupported" is reading, and it is worth answering with
arithmetic rather than with a thicker column chosen by eye.

**CLOSED.** Three things were wrong, and only the first was filed.

**1. The arbor stopped at the tower's MIDDLE member.** It was sized to
`SUB_OUT_Z` — the cage — so it topped out at 5.9648 while the tower carries on
to 7.85. Both leg B's side gear AND its pinion turned with no arbor in their
bores: 1.9 units of tower on nothing, not the one wheel this item was filed
about. Now sized to the topmost member, `SUB_PIN_B_Z + T/2 + 0.2`, which is the
idler's own idiom — and because leg B's pinion shares the idler pinion's plane
BY MESHING, it lands at the same 7.9939 `subIdlerArbor` already occupies under
a green battery, rather than at a height nothing had tested.

**2. The zero-height sleeve was a symptom of a wrong constant, not a stray
line — and the first fix for it was WRONG.** The initial attempt deleted the
ring, on the reasoning that `SUB_PIN_B_Z` seats the pinion directly on the
spider's envelope so there was no span to bridge. That premise is false, and
the geometry says why: `makeBevelGear` extrudes the flat outline along z and
then SHEARS it (`v.z += hypot(v.x, v.y) * taper`, taper = 1 at 45°), so a
vertex at radius r lands at `z ∈ [r, r + faceWidth]`. The cone's back surface
is therefore `z = r + faceWidth`, and at the bore — the flat annulus a hub
actually butts against — that is `sideBoreR + faceWidth`. `halfHeight` is the
swept ENVELOPE and stands outboard of every point of metal.

Measured on the built scene: side gear B spans local 0.550 … 1.602, its hub
face is at 0.957, and leg B's pinion sits at 1.629. **The span is 0.672, and
leg A had the identical hole** — `subSleeveA` ended on `halfHeight` too and
stopped 0.672 short in mid-air, which nothing had noticed because a sleeve that
ends in air still has non-zero height. Both now end on `SUB_SPEC.hubFaceZ`, a
new derived field on `spiderSpec` carrying that derivation in its comment.
Measured after: sleeve A 3.0228 … 4.4076, sleeve B 6.3220 … 6.9939.

**3. The instrument, because this class shipped TWICE in one session.** §129's
first instance — the finger's arbor stopping below its own output pinion — was
caught by rendering the unit and looking; the second was not caught at all. A
build-time assert now asks the per-MEMBER question at the end of the tower's
build: for each rotor, does any other mesh of the unit contain its axis at its
own height? A rotor is coaxial with its arbor, so that is exactly "is there an
arbor in this bore", and a cylinder's box contains its own axis — the test is
exact for the case it exists for and conservative elsewhere, and it is the
false NEGATIVE direction that would matter. **It is proven to fire**: reverting
the arbor to its old height warns twice, naming `spiderSideB` and
`subLegBPinion`. `tools/probe-60-reach.mjs` is the same measurement over any
unit, and `tools/probe-60-checks.mjs` runs the six instruments this class of
change can move.

**Why the whole bar missed it, kept because it generalises.** A wheel with an
empty bore collides with NOTHING, so no clearance sweep, hull overlap or
penetration budget has anything to report. `assembly` asks whether a rigid
group is one connected body, and a zero-height ring satisfies that while
occupying no space — the perfect connector. And `checkSupportGeometry` is
UNIT-granular: `Alarm winding arrest → plate` passes the moment any ONE of four
columns reaches the plate, so every wheel in the unit could be floating and
that row would still read `gap 0.000, ok`. Three gates, three different reasons,
none of them a bug in the gate that missed it.

**Scope of the assert, stated rather than assumed.** It is scoped to this unit,
following §121's precedent of gating a named scope: elsewhere in the movement
wheels seat on shoulders and bridges this test does not model, and warning
across all of them would break rule 6 rather than find anything. Widening it is
worth doing behind a declared scope list, not by default.

## 61. CLOSED — `SPEC.md` and the gear builder name a tooth form the code does not cut

**Closed 2026-08-20, as filed: the documents now say what is cut.** All
three sites reworded in one landing — `SPEC.md`'s `makeGear` signature
block (the architecture contract), `makeGear`'s live header, and
`gearOutlineShape`'s own comment — each naming the trapezoidal
approximation, pointing at the escape wheel's club teeth as the one
designed working surface, and stating plainly that NO CONJUGATE ACTION is
modelled (the honest half neither document said). Real cycloidal teeth
remain roadmap §136, exactly as this item scoped. Nothing geometric moved;
the body below is kept as the record of what the docs used to claim.


Three files name one shape and two of them name a family the builder does not
produce.

- **`SPEC.md:47`** — the architecture contract — `// Involute-ish spur gear.`
- **`src/geometry.js:313`** — the live header on `makeGear` —
  `// Involute/cycloidal-ish spur gear.`
- **`src/geometry.js:236–238`** — the profile function itself —
  `repeated trapezoid-with-rounded-tip teeth approximating a clock (cycloidal) tooth`

**What is actually cut.** `gearOutlineShape` (`src/geometry.js:243–267`) is the
only tooth generator in the codebase, and `makeGear`, `makePinion` and
`makeBevelGear` all call it. Each flank is a **straight chord** — one
`lineTo` from a root-land point at `flankFrac·pitch` to a tip corner at
`tipFrac·pitch`. The only curve in the tooth is a single `quadraticCurveTo`
through a control point at `tipR · TIP_RELIEF` (1.02), which is a **tip
relief, not a working surface**, and it is tessellated at `curveSegments: 3`
(`geometry.js:412`). A whole tooth is about six straight segments. There is no
pressure angle anywhere in the file, and the proportions — addendum
0.95·module (`:357`), dedendum 1.15·module (`:381`) — are neither cycloidal
nor involute. **Two of these rolling together have no conjugate action at
all.**

The one genuine exception is `makeEscapeWheel` (`geometry.js:502–562`), which
really is club-toothed: a slanted impulse face, an undercut locking hook, and
a quadratic scallop between. The pinion is *not* a lantern or radial-flank
pinion — it is the same trapezoid at `{ tipFrac: 0.26, flankFrac: 0.42 }`.

**Why this is filed here rather than as a feature.** The defect is not that
the teeth are simplified — a simplified profile is a defensible modelling
choice and `SPEC.md:44`'s *"real tooth profiles, not cylinders with bumps"*
is fair as far as it goes. The defect is that **the two documents a reader
reaches first name the wrong family**, and one of them is the file CLAUDE.md
calls "the architecture contract. Read before changing structure." Someone
auditing tooth form against `SPEC.md` would be auditing against a promise
nothing keeps.

**The fix is cheap and should not wait on anything.** Say what is cut: a
trapezoidal approximation with a relieved tip, standing in for a clock
(cycloidal) tooth, with the escape wheel's club teeth as the one profile
designed as a working surface. Note in the same edit that no conjugate action
is modelled, because that is the honest half a reader needs and neither
document says it today. Cutting real cycloidal teeth is a separate,
much larger question and is filed as roadmap §136.

## 62. Mesh phase: the going train is SOLVED; the keyless idiom sites and the bevels remain

**Progress 2026-08-20 (after TODO 48 landed its threshold fix, the stated
prerequisite).** The largest block is done: the GOING TRAIN's four meshes
are chain-solved, backward from the escapement because that is where the
freedoms are — the escape wheel's phase belongs to the pallets (its own
convention, untouched), so the escape PINION is the datum; each arbor's
pinion+wheel rides a rigid pair group (TODO 48's structure, one knob per
blank), and the great wheel is its own knob on the fusee arbor. Four runs,
one per module, every tripwire live. The striking wheel 64T ⇄ governor
pinion mesh is solved in the same landing: the 64T rides a SLEEVE (a real
assembly freedom) so it is the knob, the governor pinion the datum, and
that idiom line's interleaving CLAIM is retired (the rotation stays as the
pinion's assembly position).

**What remains, re-scoped:**

- The four keyless bases (`windSpurBase`, `crownWheelBase`,
  `settingWheelBase`, `minuteWheelBase`) are RUNTIME phase offsets
  (`rotation.z = base + spin(t)` in tick), woven through two tick-driven
  chains — retiring each means solving the chain at build and reading the
  solved rotation back into the base, a TODO-48-sized job per chain
  (winding: sliding pinion → crown → transfer → spur; setting: pinion →
  setting wheel → minute wheel).
- The BEVEL sites (`BEVEL_PHASE` ×2 corners, `ALARM_BEVEL_PHASE`, the
  §129 spider's four planet meshes) are beyond the planar gauge:
  `measuredToothPhase` silhouettes about z, and a bevel pair's horizontal
  member has no z-silhouette to read. Retiring them needs the instrument
  question roadmap §135 files, not another call site.
- §129's tower: the compound idler's PINION ⇄ leg B's pinion is still
  unchained ('alarm arrest leg B:' phases the idler's wheel only).


TODO 15 closed the winding and setting chains and named **two** remaining
sites; TODO 48 carries one of them. The census is much larger than either item
implies, and the largest part of it is not the idiom at all.

**The good machinery, and its actual reach.** `solveGearChain`
(`src/main.js:10285–10346`) is right: it reads each wheel's tooth phase from
its **vertices** via a 2048-bin silhouette and turns each wheel until
`frac(uP + uQ) = 0.5` — the SUM invariant, with the code recording why the
difference form was wrong (*"true at exactly one rotational instant and false
everywhere else, which is precisely the reported symptom"*). It fires two
tripwires per mesh. It is called **six times, covering nine meshes, all on the
alarm side** (`main.js:10349`, `:13845`, `:13851`, `:15188`, `:15192`, `:15196`).

**Everything else is the idiom or nothing.** Nine `Math.PI / teeth` sites that
neither TODO 15 nor TODO 48 names:

| `main.js` | constant | mesh |
|---|---|---|
| 1259 | `windSpurBase` | transfer wheel ⇄ winding spur |
| 2506 | `crownWheelBase` | sliding pinion ⇄ crown wheel |
| 2614 | `settingWheelBase` | sliding pinion ⇄ setting wheel |
| 2619 | `minuteWheelBase` | setting wheel ⇄ minute wheel |
| 2674 | `BEVEL_PHASE` | both motion-works bevel corners |
| 8984 | `ALARM_BEVEL_PHASE` | alarm crown bevel pair |
| 13123 | governor pinion | striking wheel 64 t ⇄ governor pinion |

plus `geometry.js:2083` — the spider differential's planets against both side
gears, four bevel meshes, shipped in §129.

**And the going train has no phase at all.** `centerPinion`, `thirdPinion`,
`fourthPinion`, `escapePinion`, `centerWheel`, `thirdWheel` and `fourthWheel`
are built at `main.js:605–641` and parented at `:1274–1285`, and **not one
`rotation.z` is ever assigned to any of them**. So the four going-train meshes
are phased by wherever `gearOutlineShape` happens to put a tooth — at two
*different* `tipFrac` conventions between `makeGear` (0.18) and `makePinion`
(0.26). That is exactly the condition `main.js:10130–10134` warns about:
*"Reading `local +x` and trusting gearOutlineShape's convention is not good
enough here … nothing guarantees the two put a tooth at the same local
angle."* The warning was written, and the going train was never brought under
it.

Two more meshes inside §129's own tower are built but never chained: the
compound idler's **pinion** ⇄ leg B's pinion (declared a working contact at
`inspect.js:2078`), and the side gears onto the planets. `'alarm arrest leg B:'`
phases the idler's *wheel* against the barrel rim; nothing phases its *pinion*.

**Why every run has always been green** — `main.js:10124–10125`, and it is the
sentence this item exists to act on:

> *"The battery cannot see any of this and never could: two gears meshing out
> of phase sweep exactly the same volumes as two meshing correctly. This is the
> fourth kinematic lie caught by eye, which is the argument for the asserts
> below rather than for trusting a clean run."*

**The fix, and the order.** Extend `solveGearChain` over the going train
first — it is the largest block, it is the movement's primary train, and it
currently has no phase of any kind. Then retire the idiom site by site.
**Do not do this before TODO 48's second finding is fixed**: `measuredToothPhase`
thresholds midway between the smallest and largest populated bin
(`main.js:10205–10208`), which returns 56 gaps for an 8-leaf pinion at 0.94
confidence — so `solveGearChain`'s credibility test will refuse small pinions
and skip loudly on the first run. The probe's 10th/90th-percentile threshold is
the known-good replacement.

An instrument that would catch a wrong count or a wrong phase is filed as
roadmap §135; **no such instrument exists today**, and `inspect.js` has no
concept of a gear mesh as a pair at all.

## 63. PART DONE — the stall is re-taken (≈48 mN, TAIL-limited — SINCE REFUTED: TODO 82 computes ≈1.58 mN, ROD-END-limited), the elbows' bending is computed and the five force paths are priced; an over-strained blade and the §137 record remain

**Re-taken 2026-08-20, from the built metal, in TODO 16's own first-order
format.** The current chain: beak lever nose 1.395 u / tail 9.95 u —
displacement gain **7.1×** (not the 36.5× the old number assumed, and not
the ~3:1 this item's own text guessed from §68's prose; the built arms are
the record). Tail blade 0.12 × 0.14 mm over 3.77 mm: **305 N/m**,
tail-stall ≈ 48 mN — the blade half of TODO 16's fix survived. The stale
`alarmOn only turns the column wheel` line at the tube law is also
corrected (TODO 20 closed that debt).

> **CORRECTION (§137 Landing 1, 2026-08-22): the SHAFT half of that
> re-take was itself computed on a span the movement no longer has, and
> the chain is TAIL-limited, not shaft-limited.** The 22 N/m figure — and
> the ≈ 1.6 mN stall this item used to headline — is a cantilever
> stiffness for the **4.5 mm** drive-end overhang of the *pre-§68* chord.
> §68's re-scan found the inboard pocket and the bushes now stand at chord
> stations **2.45 and 22**, so the real drive-end overhang is **2.45 u =
> 0.9286 mm** (measured off the built unit by
> `tools/probe-137-jumper-envelope.mjs`, which reads the bush stations
> rather than assuming them). At that span the same `3EI/L³` gives
> **2518 N/m**, and 2518 N/m × 0.071 mm of selector stroke is a **179 mN**
> stall. The weakest member sets the stall, so it is the **beak tail's
> 305 N/m × 0.158 mm = ≈ 48 mN**, and the transfer is **TAIL-LIMITED at
> ≈ 48 mN — inside the movement's 5–50 mN detent band, at the top of it**,
> not one-to-two orders under it. Both halves are now written at the
> section block in `src/main.js` (grep `2800`). Anyone sizing against
> "≈ 1.6 mN, shaft-limited" is sizing against a retired span.
> **RE-TAKEN AND REFUTED BY TODO 82.** Every figure in this passage rests on
> two errors that push the same way: the "0.158 mm" rod travel is
> `ALARM_LINK_ROD_TRAVEL = 0.42`, a constant `src/main.js` deletes as
> *"referenced nowhere, and wrong"* (measured: **0.09932 u = 0.0376 mm**), and
> "in series … with the weakest member setting it" is a MINIMUM over members
> charged against different strokes, where reflected compliances add as
> `n²/k`. Computed properly: **k_eff 21.89 N/m, stall ≈ 1.58 mN,
> ROD-END-limited, an order of magnitude BELOW the 5–50 mN band.** The
> rod-end overhang carries 72.4% of the compliance and appears in none of
> these paragraphs; the fork-end cantilever they are all sized against
> carries 0.1%. `tools/probe-82-alarm-stall.mjs`.

**THE §137 RECORD, LANDED — and one more correction, this time to the
stroke.** The idiom record the correction above left open is in the
battery now: `declareTransfer` rows beside each corner, the `transfers`
gate re-verifying every row's own relations each run — click detent
≈14.7 mN computed in-window (agreeing with the ≈15 the comment above
derives), pawl ≈13.8 mN at the saw root, silence finger ≈51 mN, the bends
priced live (`priceRigidBentLink`: M = F·e, σ, Euler fraction, axial
give — the reset rod's solved offset is ZERO, so its bend does not exist;
the hack rod's dogleg gives ≈3–32% of its stroke across the load band).
And the tail-stall's **0.158 mm is itself a retired constant**: the
source's own trail (`ALARM_LINK_ROD_TRAVEL = 0.42 — solve OUTPUT,
alarmLinkParts.forward.rodTravel`) replaced the plan stroke with the
registration solve's measured travel, **0.099 u = 0.0376 mm**, so the
tail's stall is **≈ 11.5 mN — still TAIL-limited, still inside the
5–50 mN band, at the other end of it**. That was still not the end of
it: TODO 78 registering §54's check surfaced the shaft's ROD-END
OVERHANG (TODO 79), a second compliance in the same series an order
softer than the tail — 21.2 N/m against 304.8, derived here from the
same `ALARM_LINK_BUSH_T` the bearings declaration reads and agreeing
with 79's probe to the digit (12.487 u). The soft member binds, so the
chain is ROD-END-limited, and the transfers seed waiver is **restored
citing TODO 79** rather than retired — a round trip the staleness tier
made honest in both directions (a waiver with nothing left to waive
fails the battery; so does a missing one, by the envelope tier). The k
(305 N/m) stands and the stroke correction stands; what was missing was
a member.

**And then a second thing was missing: the ARITHMETIC.** This block once
read ≈ 0.42 mN, taking the softest member's stall as the answer. TODO 82
established that compliances in SERIES add, each reflected to the ring by
the displacement ratio at its own working point (n²/k) — a minimum is only
right when one member dominates utterly, and the bush-to-bush span carries
a quarter of it. Summed properly the chain delivers **≈ 1.588 mN**, still
rod-end-limited (73% of the compliance) and still an order under the floor,
so the waiver and the verdict both stand — but the number was wrong and the
model was wrong with it. The §137 row now computes the sum from live
constants and ASSERTS against 82's probe at boot, which is the only reason
the two agree rather than merely resembling each other. The
disarm-vs-silence terminology note is written at both rods' laws in the
source, where a fix would look.

**The elbows' bending is COMPUTED** (§137 Gate A, at the elbow-rod block —
grep `§137 GATE A`). Loads derived from the driven members by virtual work
rather than assumed: reset **0.83 mN** (the display arbor's friction
coupling, bounded by the going train's torque at the fourth arbor, which
`EQUALISATION.going` publishes), hack **0.18 mN** (the hairspring's peak
torque at the measured 3.067 mm pad radius, through the pad's measured
0.145 travel ratio). At `ELBOW_E_MAX` = 28 — the bound, so the finding
holds for any route the solver can pick — σ is 4.8 and 1.1 MPa, δ is 0.58%
and 0.25% of the measured strokes against the lay shaft's δ ≤ 0.1 × stroke
standard, and the chord shortening is ~2e-5 u against
`HAMMER_TAIL_DELTA`'s 0.08 u endpoint tolerance. **The rigid bend is
defensible at these loads** — and only at these loads: the δ standard
breaks at 7.2 mN on the hack rod, which is inside the detent band, so a
rod that ever drives a detented member re-opens this. Measured beside it:
the **reset rod's least-bend solve clears at e = 0.000000** — it is the
straight tube today, and the block's "a straight tube cannot clear them"
is corrected in place.

**The five force paths are priced**, each at its site and each copying a
named in-source template: finger→pusher (beside `PUSHER_HEAD_MM`), the
pawl at the saw root (beside `ALARM_PAWL_KISS_S`), the click's detent
(beside `switchClickSpring`), the §45 silence chain (beside
`ALARM_SIL_RATIO`) and the elbows (above).

**What remains.**

- ~~**A NEW finding the click's arithmetic produced, and it is real debt:**~~
  **CLOSED by §173 — the blade ceases to exist.** TODO 90 finding 3 measured
  that this blade never touched the arm it was declared to press (2.0963 at
  every pose), so the 15 mN below was never delivered either; §173 deletes the
  click and replaces it with a sautoir whose free length is SOLVED from
  `SPRING_STRAIN_MAX` at the crest — the fix this entry called for, arrived at
  because the part was redesigned rather than repaired. The original finding,
  kept because the diagnosis was right and is the reason the new blade is
  ten units long:
  the click's detent is the right SIZE — ≈ 15 mN at the nose, inside the
  5–50 mN band — but the blade that makes it is **over-strained**. The
  nose's 1.04 u ride deflects the blade 0.047 mm, 8.3% of its 1.5 u free
  length, for a root fibre of **≈ 2.2 GPa**, past even hardened blue
  steel's ~1.5 GPa elastic limit. The cause is the bear station: `bearFrac`
  hits its 0.12 floor because `_bearTan ≈ L` (the saw's tip circle plus the
  blade's depth reaches nearly the whole arm), so the spring works at the
  pivot end where the throw per unit of nose travel is worst. **The fix is
  position space** — a longer free length, or a bear station the tip circle
  does not crowd — not a fatter blade, which would only raise the detent it
  cannot hold.
- **The shaft's slenderness**, which is TODO 16's and is now measured
  rather than argued: the envelope permits r 0.285, §54's ceiling wants
  0.326, and closing that needs a third bush station. See TODO 16.
- **The disarm-vs-silence terminology note** below, which is a standing
  correction rather than a task.
- **The vocabulary and the idiom table** — every transfer around a bend
  named, with the choice justified against the load it carries. That is
  §137's own record and lands with it.

### (original filing, 2026-08-19 — citations re-pinned to SYMBOLS)

Kept whole, with one bullet struck at the end and every `file.js:NNN`
replaced by something a reader can grep: §149/§150 moved `main.js` by up to
650 lines in a single day, so a line number here is an approximate landmark
and never an address.

Two findings from a dogleg audit, both about force paths that were never
computed.

**The elbows are cosmetic.** `resetRod` and `hackRod` are each a rigid
two-segment link with a fixed bend, and the build says so plainly
(grep `--- ELBOW RODS`): *"each rod is a RIGID two-segment link with a fixed
bend … The link stays rigid — its pin-to-pin chord is the calibrated length —
so the two-circle pose solves are untouched; **only the mesh is bent.**"* The
lateral offset `e` is solved by scan up to `ELBOW_E_MAX` — 16 when this
was filed, **28 since §125 Tier B** (the mirrored hack rod's southern
dogleg runs ~22 of lateral), which only sharpens the finding: the deeper
the routing bend, the larger the moment nothing computes.

A real bent connecting rod carries a **bending moment proportional to that
offset**, and nothing anywhere computes it. A straight two-force link and a
link with 16 units of offset are the same object to every instrument in this
repo. That is the honest counter-example to the motion-works bevel corners,
which CLAUDE.md holds up as the template precisely because *"a plain rod
meeting another rod at an angle has nothing at the joint that could transmit
rotation around the corner"* (grep `a plain rod meeting another rod`) — the same argument, not
yet applied to displacement through a bend.

**TODO 16's headline is stale, in the favourable direction, and nobody
re-took it.** That item measured a **1.5 mN** stall against a 5–50 mN detent
budget, on a beak lever with a **36.5×** displacement gain. §68 then collapsed
that tail from ~28 to 4.0 — *"a ~3:1 lever someone would design, retiring the
§35 tail's 36.5× as measured debt"* (grep `a ~3:1 lever`). Meanwhile the
**shaft half was reverted**: two attempts to thicken `alarmLinkShaft` were
rejected by CI on `Alarm link ⇄ Minute jumper` (overlap 0.312 and 0.310), so
`ALARM_LINK_SHAFT_R` stands at 0.12 (grep it) and
`SLENDER_WAIVERS = { 'Alarm link': 'TODO 16' }` (grep `SLENDER_WAIVERS` in
`inspect.js` — NOT `STOCK_WAIVERS`, which is a different debt) is still the
table's only entry.

So the chain today has a **much better lever** and the **same thin shaft**, and
the 1.5 mN figure describes neither configuration. **Re-take the measurement
before anyone sizes anything against it.** TODO 16 already prescribes the
prerequisite: measure the minute jumper's swept envelope along the shaft's
stations from a virgin boot with the crown pulled, *"only then is there a
number to size against. Guessing costs a 15-minute CI run per iteration, and
has now cost two."*

**What has no force arithmetic at all**, and should have, in TODO 16's format:
the finger→pusher input force; the pawl's tangential force at the saw root;
**the click's detent torque** — the load that actually holds the column
indexed, and the thing a stall must overcome; the elbow rods' bending under
their offset; and the §45 silence chain, which has `ALARM_SIL_RATIO` (a
*displacement* ratio, grep `ALARM_SIL_RATIO`) and nothing else.

**One terminology correction worth keeping.** The rod the column wheel drives
is `alarmLinkRod`, and it **disarms** — it prevents the alarm ringing. The rod
that **silences a ringing alarm** is the §45 chain (crown collar → release
lifter → silence rocker → release feeler, grep `ALARM_SIL_RATIO` and walk
up), which the
column wheel does not drive. They are different mechanisms and conflating them
will send a fix to the wrong one.

~~**Also stale, one line:** the tube law still reads *"alarmOn only turns the
column wheel, and the column→ring run is §35's filed debt (MECH_GRAPH.todo
carries it)"*.~~ **DONE** — fixed in place before this item was re-read; the
line now says the column→ring run is DRIVEN, pawl to ring, and cites TODO 20
(grep `alarmOn turns the column wheel`). The only remaining `MECH_GRAPH.todo`
entry is still the keyless-works one.

## 64. Three linkages sit outside §48's population because no axis sweeps `alarmCrownPullT`

The same shape as TODO 29's original finding and TODO 56's live one, on a third
mechanism — and rule 4 warns about exactly this in as many words: *ship the
mechanism and you must ship the axis that exercises it, or this passes it in
silence.*

`alarmCrownPullT` appears in `AXES` **only pinned**: `1` on the `alarm` axis
(`inspect.js:871`) and `0` on `alarmWind` (`:935`). It is varied only inside
`ALARM_HANDOFF_POSES`' `'setting'` row (`:3669`), which is a pose list, not an
axis. Since §48's population comes from the §36 registry's `reversed` flag —
measured per axis, as successive steps of one sweep changing sign — three
parts never reciprocate under any sweep and so cannot be judged:

- `Alarm release lifter`
- `Alarm release sleeve`
- `Alarm silence rocker`

None has a `declareRestoring` entry and none has a waiver, so the audit passes
them in silence rather than reporting them.

**The silence rocker is the sharp case, because its spring EXISTS.**
`alarmSilBlade` (`main.js:11251–11256`) is a real return blade on the bracket,
biasing the paddle side down onto the run — modelled, in metal, and simply
never declared. The audit would pass it today for the wrong reason (invisible)
rather than the right one (declared and true).

**The fix.** An axis that pulls and releases the alarm crown, then the three
`declareRestoring` rows the sweep makes judgeable. Expect reports to MOVE and
accept them per row, exactly as TODO 29's landing did when it took the
population from 18 to 23 — a new axis changes what the registry samples, so
any sweep row whose finding lived on a pose no axis previously visited can
change with it. Diff the `--report` and derive each moved row rather than
re-basing it.

## 65. CLOSED — the schematic tier and the focused unit are saved now, not just emitted

`captureState()` emitted both (`src/main.js:23687–23688`). `saveState()` writes
`sanitize(state)`, and `sanitize()` (`src/state.js`) is an **allow-list** that
named neither — nor did `defaultState`. So `savedState.schematic` was always
`undefined`, `main.js:17199`'s `?? true` always yielded `true`, and §69's own
comment beside it — *"only an explicit saved false turns it off"* — described
something that could not happen through the UI. `restoredFocus`
(`main.js:17200`, applied `:25086`) was dead for the same reason.

The neighbouring field carries the warning that was missed, and it is why the
fix is a two-line one rather than an investigation: `state.js`'s `soundOn` reads
`// sound toggle — captureState() emits it, so it must round-trip`. **Emitting
without allow-listing is silent by construction** — no error, no warning, just a
setting that never comes back. Worth a glance at any future `captureState`
addition: the two lists are the contract, and only one of them is enforced by
anything.

Fixed by adding both keys to `defaultState` and to `sanitize()`, with the
reason written at each. The read path in `main.js` was already correct and is
untouched.

**What this deliberately does NOT do.** It does not change the boot default.
Schematic-on remains §69's decision, and the request that surfaced this bug —
"default to realistic, fall back on performance" — is a separate question that
now at least has a working preference to honour. The §93 subtlety in
`captureState` (`main.js:23683–23687`) is preserved untouched: while reconfigure
mode forces the solid tier, the value persisted is the tier it interrupted, so
an autosave mid-drag does not become the viewer's saved choice.

## 66. Four small things the code and the documents say that are not true

Filed together because each is a one-line correction whose consequence is real,
and none is big enough to carry its own item.

**1. `flute-slider` does not persist while its neighbour does.** Its handler
(`src/main.js:18817–18820`) writes `aesthetics.dial.hands.fluteFactor` and
re-cuts the hands, but never writes `localStorage['aestheticsOverrides']`.
`rib-pitch` twelve lines below (`:18832–18836`) does. The generated Advanced row
for the *same leaf* also does — so whether the value survives a reload depends
on which of two controls the viewer happened to touch. Add the write.

**2. Six appearance leaves render as live and are not.** Liveness is judged per
TOP-LEVEL DOMAIN (`src/main.js:18888–18890`: `const live = !!applier && …`), not
per leaf, so anything under `lighting` renders without the ⟳ marker. But
`APPLIERS.lighting` (`:18850–18858`) never touches `lighting.scene.fogColor`,
`lighting.backdrop.color/roughness/metalness`, `lighting.keyLight.shadowBias`
or `lighting.rimSpot.shadowBias` — all six are consumed once at boot
(`main.js:121`, `:178–185`). The panel's own comment states the standard it is
failing: *"a knob that does nothing until reload and does not say so would be
the panel lying about its own reach."* Either extend the applier or make
liveness a per-leaf fact; the second is the honest one, since the first hides
the question again the next time a leaf is added.

**3. FIXED — `vendor/README.md` contradicted its own header, and its hash
table made the contradiction unfalsifiable.** The header says
`three-mesh-bvh.module.js` *"carries two local patches (below), both marked
`PATCHED (timesim)` in place"*, verified by `node tools/check-bvh-patches.mjs`.
The Provenance paragraph said *"Every file is byte-identical to its published
upstream build — no local patches."*

The second half is the part worth recording, because it made the first half
impossible to catch by following the file's own instructions: the recorded
SHA-256 for that file was the **upstream** hash, not the shipped one.
Measured — shipped `089b8a82…`, recorded `434340fe…`. The document then told
you to `cmp` each file against upstream, so the bvh file always mismatched, and
a reader had no way to tell an expected patch from a corrupted download. A
verification procedure that always fails is not a weaker check than none; it
trains people to ignore the result.

Fixed by recording **both** hashes under their own headings — as-shipped and
as-upstream — correcting the Provenance sentence, and saying in the `cmp` step
that the bvh file MUST differ, at exactly two sites, with
`check-bvh-patches.mjs` as the thing that judges it. A credits section would
have quoted the false half (roadmap §143), which is how it surfaced.

**4. This file describes a panel that no longer exists.** TODO 8's text
(`TODO.md:1158–1162`) names a two-row alarm readout — "Hand at" and "Rings at" —
and argues that the gap between them *is* the mechanism's setting resolution,
which §38 exists to improve. The shipped panel has **one** readout
(`readout-alarm`, `main.js:17760`), and `docs/BUILT.md` §38 records the opposite
conclusion: the setting is **continuous**, the READOUT was what rounded, and the
ring was recommended against. A live item describing a removed control and a
retired premise is worse than a closed one — rewrite it to what remains, or
close it citing §38.

## 67. `spiderSpec.halfHeight` claims a margin it has almost entirely spent

Found while closing TODO 60, and filed rather than fixed because the fix
re-opens §129's siting solve.

`halfHeight = R + module*0.85 + faceWidth*√½ + margin` is the spider's declared
half-extent, and the `margin` term reads as `CLEAR_MARGIN` = 0.150 of air
around the cones. It is not. The `√½` treats `faceWidth` as measured
PERPENDICULAR to the pitch cone, but `makeBevelGear` extrudes along **z** and
shears, so the cone's axial extent is `faceWidth`, not `faceWidth·√½`. The
difference — `faceWidth·(1 − √½)` = 0.119 at the shipped spec — comes straight
out of the margin.

Measured on the built scene: side gear B's metal reaches local **1.602**
against a declared `halfHeight` of **1.629**. Real slack **0.027**, against the
0.150 the expression appears to promise — 82% of the margin is already spent,
silently.

**Why it matters beyond tidiness.** `halfHeight` is not only a label: the §129
siting solve spends it as a clearance band (`SPIDER = [SUB_CAGE_Z −
halfHeight, SUB_CAGE_Z + halfHeight]`), and `SUB_CAGE_Z`'s own first branch is
`SUB_WIND_TOP + CLEAR_MARGIN + halfHeight`. So a band that believes it carries
a full margin is being used to keep the differential clear of its neighbours.
Today the second branch binds (the barrel lid sets the apex), so nothing is
riding on the shortfall — but that is luck, not design, and it would change
with any spec point that moves the barrel.

**The fix** is to carry the axial extent honestly — `R + module*0.85 +
faceWidth + margin` — and then re-run §129's plane and station solve, because
raising `halfHeight` by 0.119 moves the band the solve searches. That is why
this is its own item: the arithmetic is one line, the acceptance is a re-solve.

## 68. CLOSED — the primer told the reader the seconds hand freezes; it flies to zero

`primer.html`'s keyless-works entry ends:

> Pulling the crown also brakes the balance ("hacking"): a sprung pad rises
> against the balance rim and holds it still, **so the seconds hand freezes**
> and the watch can be synchronised to a signal.

**Measured, not read.** Booted clean (dev state and `localStorage` cleared),
crown driven through the real linkage with the `btn-crown` control and
`step()` — never `setPose`, which cannot fake the pull. Drive the normalising
step off `leverEngage` rather than the button: at boot the button's
`data-state` can disagree with the mechanism, which reads the run backwards.

| | `leverEngage` | hammer seated | small-seconds angle |
|---|---|---|---|
| crown in, after running | 0 | no | **wherever it had got to** — 55.2°, and 43.2° re-measured after the rebase |
| crown out, settled | 1 | **yes** | **0.00°**, both runs |

The point is the second column, not the first: the free-running angle is
whatever the run length made it, and the hacked one is zero to the digit.

The hand does not freeze where it stands. The reset hammer falls onto the
heart cam and drives the display to zero, exactly as
`explain.html`'s *Zero reset — the heart cam's one low point* describes and
as `main.js`'s reset block computes (`secondsZeroRef` is re-banked whenever
`|off| > free`). So the sentence describes a plain hacking watch, and the
movement is a hacking watch **with zero-reset seconds** — a strictly more
capable and much rarer arrangement.

**The omission is the bigger half.** `primer.html` contains the strings
`zero`, `reset` and `heart` **zero times**. The one mechanism on the dial
side a first-time reader is most likely to *notice* — pull the crown and the
seconds hand jumps — is absent from the page whose whole job is to prepare
that reader, while the explainer gives it an entry and an animated plate.
The primer is the HUD's front door since §95, so this is the first
description most readers get.

**Adjacent, weaker, same sentence.** "a sprung pad rises against the balance
**rim**" is loose where the build is precise: the pad takes the rim's
*underside*, and `explain.html`'s *Hacking seconds* entry spends a whole
plate on why it cannot be the edge (the timing screws stand proud of it all
the way round). Not false — the underside is part of the rim — but it throws
away the one detail that makes the brake interesting, in the sentence that
already needs rewriting.

**Fixed, and what the fix actually cost.** The sentence now says the pad takes
the rim's *underside* — "not its edge, where the timing screws of the previous
entry stand proud all the way round" — and holds the wheel; the false "the
seconds hand freezes" clause is gone. A second paragraph beside it gives the
zero reset in the primer's own register: the companion shaft gripped by
friction, the heart-shaped cam whose radius falls all the way round to one low
point, the spring-loaded hammer, and the reason the shape does the thinking
(pressing anywhere on a falling spiral makes torque toward the low point, so
the cam seats wherever it started from). The primer's contract holds: no
identifiers, and the block adds no numbers at all.

**The localisation, measured rather than assumed.** Editing English orphans
its key in every locale table, and `unmatched` is the GATED count — so the
five stale rows were dropped from `src/primer-i18n.{de,fr,ja,zh,zh-Hant}.js`,
one entry each, 88 → 87. Verified in the browser against the English DOM with
the checker's own `collectTranslatable`, reproducing both of its counts:

| locale | `unmatched` (gated) | `missing` (reported) |
|---|---|---|
| de / fr / ja / zh / zh-Hant | **0** | 2 |

The 2 are the corrected paragraph and the new one. Loaded at `?lang=de` the
surrounding prose is German and those two blocks render English — the visible
fallback `explain-i18n.yml` calls "the honest failure" — with all five modules
importing clean. The identifier sweep was re-run locally against
`explain-quotes.mjs`'s own regexes: **no new ALL-CAPS token and no new
`<code>`**, so the delta contributes zero identifier claims.

**Still owed: the translations.** Two blocks in five languages. They are
`missing`, not `unmatched`, so nothing is red — but the page is at **90/92
(97.8%)** rather than 100% until someone who reads those languages writes them.
(Not 87/92: 87 is the TABLE's entry count after the drop, and coverage is not
the same number — several live keys share one entry, so 87 entries cover 90 of
the 92 keys. CI's own line is the one to quote.) Regenerate keys
with `node tools/explain-i18n.mjs --extract --page primer`. This machine had no
`node`, so `--check` and `explain-quotes.mjs` were reproduced by hand as above
and have not run in CI yet.

**Why this file has nothing else about the primer.** It doesn't — `primer.md`
/ `primer.html` appears in no other item. The explainer is held to source by
`tools/explain-quotes.mjs`, and the primer is held to the *opposite* contract
(zero identifiers) by the same tool; neither instrument can see whether the
primer's plain-English claims are TRUE of the movement, because it quotes no
constants by design. That gap is structural, and this item is its first
instance rather than a one-off typo.


## 69. The three-quarter plate is 0.303 mm thick, and §148 made that load-bearing

`TQ_T = 0.8` (`main.js`) is one of the few dimensions in this movement that
carries no derivation at all — no comment, no constraint, no citation. Through
`UNIT_MM` it is **0.303 mm**. Real three-quarter plates run 0.9–1.4 mm; a
0.3 mm plate is thinner than the *bridges* of a small calibre, let alone the
member the whole train pivots in.

Until §148 that was a quiet inaccuracy. It is now a hard infeasibility, and it
shows up as an empty window in a solve that has three other members in it.

**The arithmetic, at a chaton site.** §132 solved `CHATON_DEPTH` against two
members splitting the plate, both answering to `STOCK_MIN_U` (0.31662 u,
0.12 mm):

| member | thickness | bound |
|---|---|---|
| bearing collar | `TQ_T − t` | `t` ≤ **0.4834** |
| pressed stone | `CHATON_RUBY_FRAC · t` | `t` ≥ **0.4279** |

§148 adds the third: a screwed chaton is held DOWN, and what holds it is the
gold under the screw heads. A cheese head sinks its whole `headT` into the lap
it covers, and `headT` is itself floored at `STOCK_MIN_U` (it is real stock and
carries no kind entry, deliberately), so the ledge wants

    t − headT ≥ STOCK_MIN_U   →   t ≥ 2·STOCK_MIN_U = 0.6332

against a collar that caps `t` at 0.4834. **The window is empty.** No depth in
this plate carries collar, stone and a full-thickness ledge at once, and the
plate would have to reach `TQ_T ≥ 0.9498` (0.360 mm) before one exists — still
under any real plate, and only just enough.

**What §148 did instead, and why it is a workaround.** It made the chaton
screws COUNTERSUNK. A cone reaches full depth only on its own axis, so across
a lap of `CHATON_SCREW_LAP` it removes `headT·lap/(headR − shankR)` = 0.0455
rather than 0.3166, and the gold under the head survives at 0.4143 u =
**0.157 mm**, over the floor by 0.037. That is a real fastener and a real
construction — it is not a fudge — but it is the SCREW paying for the plate,
and it is the only reason the ledge exists at all. Anything else this plate is
later asked to carry through its thickness gets no such escape.

**What closing it means.** `TQ_T` is not a local number: `TQ_TOP_Z = TQ_BOT_Z
+ TQ_T`, and everything above the plate derives from `TQ_TOP_Z` — the lock
collar's z-stack, `Z_GONG` and with it the gong, the hammer (whose §148 head
section is `2·(Z_GONG − TQ_TOP_Z − margin)` and would GROW), the balance cock,
the hack and reset rods, the alarm complex's whole plane. Raising it should
move all of them together, which is the good case; what has to be measured is
the case, the overall height, and every gate that reads an absolute z. So this
is a LAYOUT change with a real acceptance bill, not a one-line edit, and it is
filed rather than taken.

**Do not close it by thinning something else.** The reason this item exists is
that the plate is thin, not that the chaton is fat: every member above is
already at its floor, and `CHATON_DEPTH` is the depth that EQUALISES the two
that were there first.

## 70. `makeJewelSetting`'s collar is wound inside out, and it is an open shell as well

> **Instrument note (2026-08-21).** §77's `meshIntegrity` tier 0 now
> measures signed volume per mesh scene-wide, and its four `inverted` rows
> (item 75) do NOT line up with this item's three collars: the negative-
> volume lathes sit at world (9.54, −22.25), (18.95, −29.28) and
> (17.69, −14.58) against this item's (9.58, −19.02), (19.62, −25.13) and
> (−13.27, 9.29) — no coordinate matches, and the barrel-arbor site has no
> negative-volume mesh at all. That is consistent rather than
> contradictory: these collars are OPEN shells, and an open surface's
> signed sum is path-dependent — inverted winding need not read negative.
> So the divergence tier cannot be this item's regression guard; the
> winding fix stays validated by `assertLatheOutward`, and closing the
> profile (this item's real work) is what will bring the collars into
> tier 0's domain.

Found by the instrument §148 added for its own defect (`assertLatheOutward`,
`src/geometry.js`), swept over the whole scene rather than over the chaton:
**three meshes besides the chaton's two have top faces whose normals point
DOWN**, and all three are `makeJewelSetting` collars — the fork cock's stone at
(9.58, −19.02), the setting at (19.62, −25.13), and the barrel arbor's lower
pivot at (−13.27, 9.29).

**Why it matters.** A LatheGeometry takes its profile's direction of travel as
the surface's orientation. Wound backwards, every normal points into the solid;
back-face culling then hides the faces you are looking at and shows whatever is
behind them, so the part renders as its own interior. On the chaton that showed
up as a gold ring shattered by the bearing collar it sits on — the two surfaces
were coplanar — and it went unnoticed from §132 until the ring was widened
enough to see through. These three have the same defect and the same
invisibility: nothing under them happens to be coplanar, so they merely look
subtly wrong.

The convention is `ringGeo`'s and it is one sentence: **start at the bore's
bottom and travel out, up, and back in.** `makeJewelSetting` travels
`(wallR, −d) → (wallR, rimTop) → (outerR, rimTop) → (outerR, −d − 0.1)`, which
is the other way round.

**The second half is worse and is why this is not a two-line fix.** That profile
is not closed — four points, and the fourth does not return to the first — so
the collar is a SHELL, not a solid. Reversing the winding only changes which
side of a surface you see. And an open mesh is TODO 27's measured hazard:
`meshClearance` guards its BVH near-zeros with a parity raycast, which counts
crossings and therefore assumes a closed solid. TODO 27 measured an open body
making `sweptOverlap` CONFIRM an overlap against a part **3.7 units away**. So
closing the profile is the fix, and the winding falls out of doing it properly.

**Do it with the assert on.** `assertLatheOutward` is deliberately called only
from `makeChaton` today, because pointing it at these would make boot noisy
before anyone had fixed them — which is rule 6 turned into a nag rather than a
gate. Fix the setting, then call it there too, and the class is closed for
every lathe in the movement that has a horizontal top face.

## 71. The arrest pad rode a model of the coil — CLOSED (§151)

**Found by §125 Tier B as a waived `windArrestHandoff` row, re-diagnosed
2026-08-21 after a user-visible symptom** — through the arming band the arm
swung with open daylight under the pad: measured on a 97-pose tension
ladder, **33 poses with the arm swung and more than the ±0.03 touch band of
daylight, up to +0.109** — the arrest ARMED on metal that was not there.
The daylight decomposed into four measured causes, each closed in §151:

1. **Parity.** The law modelled every link with the outer plates' stadium;
   the built chain alternates, an inner link's plates riding
   `CHAIN_END_R_OUT − CHAIN_END_R_IN = 0.085` lower — hover in exactly the
   parity period. (The original filing blamed a half-pitch phase offset;
   measured, both samplers index the same N-equal-arc joints — the phase
   story was the parity error wearing a disguise.)
2. **Node-sup bridging.** The lift table's node-±-interval sup bridged the
   wrap's REAL inter-link dips at 8× the fine grid's spacing, so the arm
   held its lift across gaps the coil genuinely opens. The table is now
   the fine grid itself, read as a per-interval max — the no-under-read
   guarantee at a quantum of ~0.001 of tension.
3. **The window's six-pitch memory.** The pad's reads stopped six pitches
   behind the departure; the top turn is ~13 pitches of arc, a leaned
   plate's corners reach ≈ 0.4 in z, and the cone widens down-arc — the
   proudest metal in the window at full wind was a link 6.5 pitches below
   the departure (4.081 vs 4.005), read as absent. The window now spans
   every wrap link, straddler included, span excluded.
4. **The first-order pose.** ψ = lift/padGain leaves a rigid face
   (1 − cos ψ) plus chord-tilt short of the plane the law claims — 0.060
   at full throw. The pose is now the lever's exact inverse (closed-form
   standoff of a plane rotated about the stud, boot-asserted to 1e-6 over
   the law's range).

And the law's SOURCE changed category: every pad-window read now samples
`buildChainLinkGeometry`'s own output buffer (`builtPtsNear` — the builder
records per-link vertex bases for it), so law-vs-mesh divergence is
impossible by construction; the analytic `linkOuterPtsNear` stays for the
REACH laws, where erring outward is the sound side.

**A fifth cause surfaced when the corrected occupancy re-sited the pad:**
the finger solve was blind to the free SPAN. Every feasibility law it
consulted lives on the cone (`chainProudAt` stations, the wrapOnly reach
tables), and the span — the chain's flight from the departure to the
drum — crosses the hub/tab bands at arm radii near full wind. The
re-solved fold parked the beak arm's corridor across it and the
`expectedContacts` floor row found the bar inside the flying chain's
link 25. Closed in position space, the ranked walk's own way: a span
corridor law (`spanPts`, sampled over the wind from the same
`chainLayoutAt` curve the mesh is built from) rejects any pad or beak
azimuth whose arm chord the span crosses, and a boot assert re-measures
the BUILT finger, lattice-sampled over its real throw, against the same
envelope.

**Closed state, measured:** the full-wind row reads 0 at both poses — an
exact kiss, the waiver retired; the wind-axis penetration row reads
worstDepth 0 (was 0.081 EXCEEDS); every arm and the riser clear the chain
by ≥ 0.22 against the 0.15 floor. Touch lands at t ≈ 0.870 and through
the arming band the pad rides the passing links with measured contact —
the ride genuinely CHATTERS (lift falls to 0 where the wrap opens a real
gap under the window and catches the next link as it arrives), which is
what a follower on discrete links does and what the §47 lift-shape
asserts accept: seated through the lug's free pass, home before the
closing arc. The §48 audit now SEES the arm: no registry sample on the
wind cycle's 12-pose grid reached the arming band (max tension 0.909 <
touch), so the `arrest` axis cycles the band itself and the stale flag is
gone. What remains above zero mid-band is the lift law's designed
conservatism (the staircase rides each fine interval's highest link) —
measured every battery run, not filed as debt.

---

## 72. The alarm stem's one-way has no metal

The alarm instance of the class item 50 named and §149 closed on the going
side. A backward alarm crown does nothing at all: the wind routing banks
only positive deltas, and the free-slip "at the stem⇄contrate bevel" the
comments describe has no metal behind it — there is not even a bookkeeping
scalar to make the omission visible, which is why this instance is CHEAPER
to miss than the going one was.

**The fix is a reuse, by design.** §149's saw coupling was written
movement-independent (`sawCouplingSpec`, `sawProfileAt`,
`sawCouplingLiftAt`, `makeSawCoupling` — spec math in `layout.js`, builder
in `geometry.js`) exactly so this stem could consume it: a fixed pinion at
the contrate mesh, a sliding clutch on the alarm stem, the coupling
between them, and the alarm side's own equivalents of the going landing's
obligations — the slip state and its persistence, the sub-pitch take-up
and pickup laws, the axis that reverses it (no alarm axis sweeps a
backward crown today, the same §48-population gap TODO 56 documents one
mechanism over), and the declaration set. The going landing's records
(`docs/BUILT.md` §149, `tools/probe-50-clutch.mjs`) are the template.

---

## 73. PART DONE — the raycast is guarded (half 2, the vendor patch); the fourteen zero-area triangles remain (half 1)

**Found by §150's report diff** — an `assembly` connectivity pair inside
`Alarm switch` went `unmeasurable` ("Cannot read properties of null
(reading 'dot')") on the new tree and not on the base, with the alarm side
untouched. The check did the right thing by design: an unmeasurable pair
is REPORTED and assumed joined (inventing a fracture is that check's
unsafe direction), so the gate stayed honest. The mechanism, measured:

- Two of the three `alarmColWheel` meshes carry **zero-area triangles** —
  8 of 776 in one, 6 of 116 in the other (min area 1.3e-22) — identical
  on base and §150's tree. Pre-existing cheap geometry, exactly the class
  the TODO 27 trap note warns about: a face nobody can see is still a
  face the instruments read.
- The vendored three-mesh-bvh's `checkBufferGeometryIntersection` calls
  `intersection.normal.dot(ray.direction)` without guarding
  `Triangle.getInterpolation` returning **null**, which is what it
  returns on a degenerate triangle. A parity ray that lands on one of the
  fourteen throws instead of counting.
- What §150 changed was one float, four decimals down: `CHAIN_TQ_REACH`
  re-measured on the new flank, the three-quarter plate's band moved
  0.0007 in z, and the alarm switch — hung from that stack — moved with
  it (world z 9.801883 → 9.801146). Same relative transforms inside the
  unit, epsilon-different world matrices, and one connectivity ray rolled
  onto the knife edge that was always there.

**The fix is at the source, in two independent halves.** (1) The column
wheel's builder should not emit zero-area triangles — and the cause is now
measured (roadmap §77's planning): they are NOT castellation corners but
two shared-builder seams — `absarc`'s duplicate endpoint (the two seam
points differ by ~1e-15, so the exact-bit weld rightly keeps them) and
earcut's hole-bridge slivers — so the fix lives in `ringExtrude` and the
skirt's extrude, clears ~9 consumers at once, moves the fingerprint, and
is its own landing. (2) **DONE** — the vendored raycast guards the null:
a zero-area face reads as "no countable crossing" instead of a throw.
The third `PATCHED (timesim)` diff, documented in vendor/README.md with
the as-shipped hash updated; `tools/check-bvh-patches.mjs` carries a
synthetic sliver witness (a triangle whose `getBarycoord` denominator
cancels to exactly 0 in float64 while `Ray.intersectTriangle` still hits
it — the wild fourteen's own float discrepancy, made deterministic) that
THROWS on the unpatched file with this item's exact error string and
counts correctly on the patched one. One correction to this item's
original text: three.js r165's own `Mesh.js` carries the SAME unguarded
dereference, so there was no upstream idiom to copy — the guard is this
repo's parity semantics. Half 1 is still owed, because a mesh with
zero-area faces is lying to every instrument that samples it, not just
to this one — and §77's `meshIntegrity` now MEASURES it every run: the
column wheel's two rows read `0/1/7` and `0/0/6` (collapsed/collinear/
sliver — the base disc's 8 and the skirt's 6, reproduced by the shipped
instrument), so half 1's fix will be visible as those two rows emptying
in the report diff, and any regression as their return.

## 74. The first triangle census: 3,233 zero-area triangles across 125 geometries, catalogued by cause

Filed from `meshIntegrity`'s arrival run (§77 tiers 0+1, 2026-08-21) — the
first time anything counted a mesh's own triangles. Item 4's two shared
builders (8 + 6) turn out to be a corner of the population; the fix for the
big rows is per BUILDER, exactly as item 4 argued, and every count below is
reproducible with `node tools/probe-77-census.mjs`.

The catalogue, by pattern (collapsed edge / collinear / sliver per geometry):

- **`alarmArrestCross` carries 1,160 COLLINEAR triangles** (of its 18,976) —
  the single largest population in the scene, in one `ExtrudeGeometry`. An
  exactly-zero-area triangle with three DISTINCT vertices is a triangulation
  artefact, not a float seam; the §129 cross's extrude is the place to look.
- **`chainRun` carries 1,040 COLLAPSED triangles** (of 23,464 at the boot
  tension) — repeated vertex positions inside the stamped buffer. The chain
  is TODO 27's own rebuilt body, so this is either the templates carrying
  collapsed faces (×N stamps) or the stamp duplicating a seam; at today's
  43-link chain that is ~24 per JOINT (1,040 over 44 rivets), which smells
  like cap fans on the pin template's three cylinders.
- **The `ringExtrude` family, 85+ geometries**: the `0/0/4` × 51 and
  `0/0/8` × 34 patterns — every gear hub, jewel ring, barrel wall/floor and
  the column-wheel base disc, all carrying the absarc-seam and earcut
  hole-bridge slivers item 4 measured on one consumer. One builder fix
  clears ~380 triangles across the whole fleet.
- **Lathes with collapsed cap fans**: the fusee body (96), four `pillar`
  lathes (48 each), the two governor studs (24 each) — `LatheGeometry`
  profiles that touch their own axis collapse the fan ring to zero-length
  edges. (`makeScrews`' tapped shanks avoided exactly this by construction —
  its comment says so — which is the fix pattern.)
- **Assorted extrudes**: the escape wheel (32 collapsed + 8 slivers),
  `genevaFingerDisc` (12), `chatonSeatLand` instances (8 or 4 each),
  `alarmCam` (4 + 4), `alarmIndexWedge` (3).

None of this is visible to any other instrument — `stockFloor` measures
extents, the fingerprint hashes AABBs (item 4 measured both blind) — so the
census IS the regression guard: these numbers may only go DOWN, and any row
that grows names the builder that regressed. The rows are a §40 report, not
gated and not waived; each builder fix moves the fingerprint (vertices move)
and is its own landing, item 73 half 1 being the first.

## 75. Four bodies measure INSIDE-OUT — over half the fork cock's volume is negative

Filed from `meshIntegrity` tier 0's arrival run (§77, 2026-08-21): the
divergence-theorem signed volume, measured per mesh with a floor of
`INVERTED_VOL_FRAC` (1e-3) of the bbox volume so open-shell float noise
cannot classify, names four bodies wound inside-out:

| unit / mesh | type | tris | signed vol | bbox vol |
|---|---|---|---|---|
| Fork cock / (unnamed) | Lathe | 480 | **−5.03** | 9.00 |
| Fork cock / (unnamed) | Lathe | 224 | **−7.09** | 9.64 |
| Balance cock / (unnamed) | Lathe | 192 | **−1.64** | 5.06 |
| Alarm setting wheel / `alarmFaceCam` | Buffer | 576 | **−0.27** | 6.08 |

The first two are 56% and 73% of their own bounding boxes — these are not
slivers of noise, they are whole solids presenting their interiors, the
same defect class as item 4's fixed column-wheel pillars ("missing surfaces"
that were really culled outward faces) and item 70's three collars. They
are NOT item 70's collars: the coordinates do not match (measured — see
item 70's instrument note), so these are four previously unreported bodies.
The two cocks render acceptably today only because nothing coplanar sits
behind them — item 70 records how that same invisibility hid the chaton's
collar for eleven sections.

Fix is per builder: find the lathe profiles wound backwards (the two cocks
and the balance cock's member are `LatheGeometry` — `assertLatheOutward`
exists and can be pointed at them) and `alarmFaceCam`'s hand-built winding.
Each fix moves the fingerprint and re-runs the sweeps; `meshIntegrity`'s
`inverted` rows emptying is the acceptance, and the check's synthetic
inverted-box control (+8 upright, −8 flipped) keeps the tier honest while
the rows drain.

## 76. The chain's declared articulation fiction, measured: adjacent bodies interpenetrate up to 0.24 u

The chain's build DECLARES its articulation a fiction — the frame loop in
`buildChainLinkGeometry` says so in as many words: wrap links carry up to
~36.3° of per-joint twist (measured over the reserve sweep) that a real
chain would shed by joint play, because each link is a rigid stamp posed by
its own curve frame rather than a body articulating about its pin. §77's
declared tier is the first instrument that could SEE the consequence, and
on arrival it measured it: **91 adjacent-body pairs interpenetrate at the
boot pose** — every link⇄link and link⇄rivet neighbour pair on the wound
chain — spans median 0.05 u, max **0.24 u** (a rivet head through its
leaf), cross-confirmed by BVH tri-tri on the same index ranges. Zero
NON-adjacent pairs fire, which is what says the stamps themselves are
sound: the burial lives exactly at the joints the fiction bends.

The declaration now lives where the fiction does: `buildChainLinkGeometry`
marks ADJACENT pairs `subBodyOverlapOk` citing this item, so
`meshIntegrity` skips them (reported as a count) and keeps every
non-adjacent pair live — a corrupted stamp or collapsed curve still rows.
`tools/probe-77-chain.mjs` holds the declaration honest at three tensions.

**The fix is the fiction's, not the instrument's**: real articulation —
links rotating only about their pins, lean shed over the free span by
distributed joint play — is chain-model work (the §124/§151 lineage), and
whether 0.24 u of joint burial is acceptable display fiction or debt worth
that work is an owner's call. Until then this item is the number: re-run
the probe after any chain-frame change, and if the max span GROWS, the
fiction deepened and this item's figures are stale.

## 77. The reserve train's two meshes interpenetrate — 0.118 mm after §136 cut them conjugate, because the extrude fattens what the generator cut

Owner-reported: the gears behind the power reserve "phase through each
other". They do, and the movement's own instruments have been saying so in
every green battery.

**Measured.** Radial overlap of one gear's vertices inside the other's
outline (silhouette test about each gear's own axis, 4096 bins), swept
over 41 wind states:

| mesh | worst overlap | at tension | vs tooth height (2.25·m) |
|---|---|---|---|
| p0 ⇄ w1 | 0.737 u = **0.279 mm** | 0.20 | ~96% |
| p1 ⇄ w2 | 1.637 u = **0.621 mm** | 0.475 | ~67% |

Radial overlap is an UPPER BOUND on the minimum-translation penetration
depth, not that depth itself — the honest reading is "a tooth stands
almost entirely inside the tooth it should be rolling against", which is
what the render shows.

**Why: the profile cannot do anything else.** `gearOutlineShape` cuts
straight-chord flanks with no pressure angle at `curveSegments: 3`. TODO 61
closed the documentation half — all three sites now say plainly that no
conjugate action is modelled — and roadmap §136 is the metal half, filed
and unbuilt. Two non-conjugate outlines placed at their correct centre
distance and correct phase MUST interfere through the mesh cycle; the
phase solve (TODO 48, `probe-reserve-mesh`, 0.07% of a pitch off
anti-phase) is measuring the right thing and cannot prevent this one.

**Why nothing caught it.** `intraUnit`'s MM tier DID catch it, both rows,
at `beat f=0` — and filed them under `outOfScope`, which is
`live.filter(v => !inGate(v))`: measured intersections outside
`INTRA_TIER_SCOPE`. That scope is the alarm complex, so the reserve train's
rows joined the 188 reported-and-untriaged. This is item 5's named
remainder arriving as a concrete fault rather than as a statistic, and it
is the second time the pattern has bitten (§129's own scope comment
predicted it: the tier goes red on the shipped fault the moment the unit is
in scope).

**What this landing did.** Put `'Power-reserve train'` in
`INTRA_TIER_SCOPE` and waived the two rows against this item. The fault is
now DECLARED debt, visible in the report and cited, and any *new*
interference in that unit fails the gate — which is the whole difference
between this and where it sat before.

**§136 landed, and the overlap did not go to zero — so this item stays open,
with both waivers kept.** What it did do is take the profile out of the
suspect list, and the measurement that says so is worth more than the number.

**The profile is now conjugate, and that is proven where it can be proven.**
`probe-136-roll` builds every one of the movement's 24 gear meshes from the
real generator, places them at their real centre distances and rolls them
through a full pitch at the conjugate ratio: **24/24 at ZERO penetration**,
with backlash left over (0.043 u on stage one, 0.134 on stage two). Both
reserve meshes are in that set. Whatever is still interfering in the
movement, it is not the flank shape.

**It is the EXTRUDE.** `makeGear` and `makePinion` extrude with
`bevelSize: bevel`, and three.js offsets the contour OUTWARD by that much
perpendicular to every edge — the fact §115 and §136 wrote `gearOuterR` and
`gearTrueReach` around. So the shipped tooth is the cut tooth grown all
round, and the growth is larger than the backlash the generator designed
into it:

| member | cut tip | bevel | shipped tip | designed backlash |
|---|---|---|---|---|
| p0, 8t, m 0.34 | 1.4207 | 0.0748 | 1.5167 | 0.0427 |
| w1, 28t, m 0.34 | 5.2003 | 0.0748 | 5.2756 | 0.0427 |
| p1, 10t, m 1.066 | 6.5896 | 0.2065 | 6.8441 | 0.134 |
| w2, 6t, m 1.066 | 3.8789 | 0.18 | 4.1053 | 0.134 |

Both flanks of a mesh grow, so the pair loses about twice the bevel against a
backlash that is smaller than one of them. A conjugate profile cannot survive
that, and no phase or centre-distance solve can pay for it. **That is
TODO 84**, and it is general — every gear in the movement is cut this way, not
just these two.

**Re-measured, both trees, one instrument.** `probe-reserve-mesh-overlap` now
carries three columns, because §136 pushed the fault under the resolution of
the one it had:

| mesh | radial (main) | radial (§136) | perpendicular (main) | perpendicular (§136) | exact (§136) |
|---|---|---|---|---|---|
| p0 ⇄ w1 | 0.279 mm | 0.187 mm | 0.102 mm | 0.046 mm | **0.118 mm** |
| p1 ⇄ w2 | 0.621 mm | 0.563 mm | 0.356 mm | 0.123 mm | refused |

Three things about that table, all of them limits rather than results.
**The radial columns are not comparable across §136** and must not be
subtracted: that measure runs along a ray from the mate's centre, and a
cycloidal pinion's flank below the pitch circle is RADIAL, so the ray lies in
the surface it is meant to cross and the reading inflates. The bias changed
when the profile did. **The perpendicular column** (distance to the boundary
polyline) drops that bias but still reads a binned silhouette, and at 3–17% of
bins carrying a sample the interpolation is worth about what it is measuring.
**The exact column** drops the bins: it rebuilds each member from the
generator, grows it by the extrude's bevel, registers it against the shipped
mesh on the tip lattice and measures polygon against polygon. It is believed
only when the reconstruction lands on the mesh's own measured tip radius —
which it does on stage one (5.2756 against 5.2756 on the wheel) and does not
on stage two, where a 6-tooth wheel at module 1.07 has corners sharp enough
that the probe's clamped miter and three.js's own handling part company by
0.105 u. Stage two is REFUSED rather than reported: the probe's limit, not a
finding.

**Do not widen a budget to green these rows, and do not re-solve the phase to
chase them** — TODO 48's solve measures 0.07% of a pitch off anti-phase and is
right. The fix is TODO 84: stop shipping teeth fatter than the generator cut
them. When that lands, re-run `probe-reserve-mesh-overlap` and expect the exact
column to go to the tessellation floor, which is what `probe-136-roll` already
reads in free space.

## 78. CLOSED — §54's ceiling had never been measured: the check was never registered, and it measured stock, not free length

Two defects in one instrument, both of the same class as TODO 29's: an
audit that exists, is exported, reads convincingly in the source — and does
not run.

### Half one: it was never registered

`checkSlenderness` shipped with §54 and was never added to `inspect.js`'s
`CHECKS`. `start(clock, 'slenderness')` answered `unknown check`, so it was
absent from `BATTERY` too and had not executed once since §52 put the
battery in CI. The consequences accumulated quietly:

- **`SLENDER_WAIVERS['Alarm link'] = 'TODO 16'` waived a row in a report
  nothing produced**, and its comment still cited a premise `src/main.js`
  declares dead in capitals ("two attempts to thicken it were rejected by
  CI" — the pair it names has been 13.32 u apart since §112).
- **Three different λ values for one mesh** accumulated in `src/main.js` —
  100.5, 135.4, and 139.1 in a parenthesis — none of them produced by a run.
- `docs/BUILT.md` §54's Result table recorded 8 rows over ceiling and 6
  unwaived. Registered today the movement measures **9 over, 7 unwaived**;
  nobody had looked in between.

This is the **second** instance (§48's `restoring` was the first, closed by
TODO 29), and the symptom both times is the worst available: a green battery
that had simply not run the instrument, which is indistinguishable from
coverage. `assertCosts` could not see it — it holds `BATTERY` against
`COSTS`, and a check absent from both is consistent with both. So the fix
carries a **closure gate**: `ci-battery.mjs` reads `window.__I.CHECK_NAMES`
from the page (§127's slice-gate idiom — never a second declaration in the
harness) and fails if any registered check has no battery row, excepting a
named `NOT_IN_BATTERY` map where each exclusion states why it is not a gate.
An empty roster fails too.

### Half two: λ measured stock length, not free length

`checkSlenderness` read each MESH's bounding box end to end. For a shaft
running in bushes that is not a free length at all, and the gap was not
theoretical: TODO 16's own "general lesson" paragraph had asked for a check
that reports **L/t per segment**, and §54 shipped only the L/t half.

A mesh may now declare where it is held:

```js
mesh.userData.bearings = { axis: 'x'|'y'|'z', stations: [ … ] }
```

Geometry-local coordinates on the declared axis — the frame
`computeBoundingBox()` measures in, so no pose, parent rotation or group
azimuth can move a station off the metal it names. On the **mesh**, never
the geometry: `weldGeometry` returns a fresh `BufferGeometry` without
copying `userData`, so a geometry-level declaration would be silently
deleted by `weldTree` at the end of boot. (That hazard is latent for §77's
`subBodies` too — filed as **TODO 80**.)

An overhang is not a span, so it is not judged as one.
`SLENDER_OVERHANG_K = ∛16 = 2.5198` comes from 48EI/L³ (simply supported,
load at midspan) against 3EI/L³ (cantilever, load at the tip), each free
length judged at its own most compliant load point; equal compliance means
equal L³/coefficient, so the equivalent length is the cube root of the
ratio. **The datum is the span**, because that is what `SLENDER_MAX` was
calibrated on — so declaring bearings can only ever make a part read
*worse* than its undeclared whole-stock λ, and a declaration can never
launder a number.

Without that multiplier the measure ranks the alarm link's own segments
backwards (raw λ 79.3 span vs 50.6 overhang, against 150 N/m vs 21.2 N/m) —
the exact failure §54 exists to fix one level up.

### What is gated, and what is not

A REPORT (§40), like `meshIntegrity` and for the same reason: 7 unwaived
rows land red on arrival, and arriving as a gate is how a check gets
switched off. Gated: the synthetic control, `0 malformed` and
`0 unsupported` bearing declarations. **"Unsupported" is §48's no-spring
rule made geometric** — `auditOscillators` proves a declared spring's *name*
is in the scene; for a bearing the stronger test exists and is the one that
matters, so a declared station with no mesh at it fails.

### Also fixed here, free

`checkSlenderness` used a bare `traverse` and so had no
`userData.schematic` prune. §71's plate occluder FILLS are real Meshes
parented inside labelled units, so two of them (three-quarter plate, dial)
were in its population — `counted` 617 → 615, measured, and no row moved.
It is now a recursive walk, because a `traverse` callback cannot prune a
subtree. Fourth copy of that idiom; consolidating them stays TODO 4's.

### What it found

| unit / mesh | λ | ceiling | k | waived |
|---|---|---|---|---|
| `Alarm link` / `alarmLinkShaft` | **127.6** | 30 | 36 N/m | TODO 16 |
| `Alarm release lifter` / `alarmLifterRun` | 71.3 | 30 | 16.5 N/m | — |
| `Hack rod` / (unnamed) | 65.0 | 30 | 48.4 N/m | — |
| `Reset rod` / (unnamed) | 48.8 | 30 | 114.4 N/m | — |
| `Keyless works` / (unnamed) | 40.4 | 30 | 190.9 N/m | — |
| `Hack rod` / (unnamed) | 37.7 | 30 | 248.1 N/m | — |
| `Alarm crown` / (unnamed) | 35.4 | 30 | 359.3 N/m | — |
| `Alarm release feeler` / (unnamed) | 35.1 | 30 | 43.7 N/m | — |
| `Alarm link` / `alarmLinkRod` | 31.4 | 30 | 367.3 N/m | TODO 16 |

**Seven unwaived rows are open debt this item does not close** — §50's arc
says report, triage, then gate, and nobody has looked at these. Six of the
nine cannot even be named: their meshes are anonymous, so the report
addresses them positionally. Do not add waivers to green this.

Probe: `tools/probe-slenderness-bearings.mjs`.

## 79. The alarm link's rod-end overhang is a chord-growth regression, and it is TODO 16's own condemned cantilever returned

TODO 16 diagnosed the lay shaft with **both bushes clustered at one end**
and a **4.5 mm / 21 N/m cantilever** carrying the drive, and prescribed
"stations near t≈2 and t≈22 [to] give a long span and short overhangs at
both ends". §68 did exactly that, and on the chord that then existed
(a shaft running ±12.06, so 24.12 u) it worked: overhangs 2.45 and 2.12.

Then §112 re-solved the rod site. The chord grew ≈ 9 u to 34.487 and
**the two station literals did not travel with it.** Measured today
(`tools/probe-slenderness-bearings.mjs`):

| free length | L | k, circular πr⁴/4 |
|---|---|---|
| overhang, fork end | 1.350 u / 0.512 mm | 16 778 N/m |
| span, bush to bush | 19.550 u / 7.408 mm | 88.4 N/m |
| **overhang, rod end** | **12.487 u / 4.732 mm** | **21.2 N/m** |

> **CORRECTED (TODO 82).** As first filed this table was captioned `k (πr⁴/4)`
> and **only its last row was**: the first two came from `checkSlenderness`'s
> **rectangular** column (`I = ac³/12`, which reads `64/12π = 1.6977×` stiffer
> for a round bar) and printed 28 479 and 150. The values above are all
> circular, so the column is now one model throughout and comparable with
> §137's own 2807 N/m. The headline never depended on the two bad rows — 21.2
> against 2807 was always apples-to-apples — but the table was not reusable as
> printed, and `tools/probe-82-alarm-stall.mjs` reproduces these figures.
>
> The rod-end row is also the FREE-cantilever value. In the working series it
> is softer still: a cantilever past a real back span deflects `Pa²(L+a)/3EI`
> because the back span rotates, so the coupled stiffness is
> `21.2 ÷ (L+a)/a = 21.2 ÷ 2.566 = 8.3 N/m`. Note that `(L+a)/a` is the
> **stiffness** factor; `SLENDER_OVERHANG_K`'s ≈1.4 is its λ-space cube root
> and is not interchangeable with it.

**That is TODO 16's condemned cantilever, to two significant figures, at
the other end of the same shaft** — and it carries `alarmLinkCrankRim` and
the rod drive at its free tip. Nothing reported it because §54's check was
unregistered until TODO 78 and measured stock length anyway.

### Why it matters beyond λ

§137 Landing 2 sized the section against the **fork-end** overhang
(0.9286 mm of load path → 2807 N/m) and concluded the transfer is
**tail-limited at ≈ 48 mN**, inside the 5–50 mN detent band. The rod end is
a second compliance in the same series, ~130× softer: **21.2 N/m over the
rod's 0.158 mm travel stalls at ≈ 3.3 mN**, below the band. If that holds
under a proper load-path measurement, the chain is **rod-end-limited**, not
tail-limited, and §137 Landing 2's conclusion and TODO 63's headline both
need re-taking a third time.

**That arithmetic is first-order and is NOT yet measured as a load path** —
it is the free length from the geometry times the repo's own cantilever
formula. Take it properly before acting on it.

> **TAKEN, by TODO 82 — the direction holds, the number does not.** The
> transfer IS rod-end-limited, and the rod-end overhang carries **72.4% of the
> whole chain's compliance** while the fork-end §137 sized the section against
> carries **0.1%**. But the stall is **≈1.58 mN, not 3.3**, because the 3.3
> above shares both of the errors it was meant to correct: it multiplies by
> the same deleted `ALARM_LINK_ROD_TRAVEL = 0.42` stroke (measured: 0.09932 u),
> and it uses the FREE-cantilever 21.2 N/m rather than the coupled 8.3 N/m.
> `k_eff = 21.89 N/m` over the ring's measured 0.19 u. §137 Landing 2's
> conclusion and TODO 63's headline are re-taken there.

### The fix is position space, and it is not a third bush

The roadmap's third-bush entry (§156) proposes splitting the 19.550 span.
That moves the reported λ by nothing and does not touch this. What this
needs is **station two moved outward**, or a station added out where the
load is. Re-probe the way §68 did, then re-derive the section against
whatever overhang survives. §54's doctrine holds: shorten the free length,
do not fatten the member.

> **CORRECTED (TODO 82) — and the correction makes the job bigger.** This
> paragraph first read: *"`src/main.js`'s own honest-band scan records
> t 16.75–24 as clean, so t 22 sits well inside a band with room above it,
> and t > 24 has never been probed at all."* That inherits a retired
> measurement. §68's scan was taken on §68's chord, whose plate bores
> `docs/BUILT.md` records at **(−9.80, 26.97)**; today's asserted bores are
> **(34.32, 16.89)**, because §112 re-solved *both* ends (the rod site **and**
> the tab azimuth that sets `ALARM_LINK_INNER_XY`). A chord parameter t is
> only an absolute position given a fixed chord, and this chord moved — so
> the bands `t 2.25–2.6` / `16.75–24`, the rooms **0.587** and **2.77**, and
> the wall names ("motion works' wheel inboard, reserve sector's inner edge
> outboard") are all facts about a line that no longer exists.
>
> **No hanger station on today's chord has ever been column-scanned** —
> not t 22, and not t 2.45 either. So the fix is not "extend the scan past
> t 24"; it is re-derive both bands on today's chord, which also re-judges
> station one.
>
> What is NOT at risk, so this stays proportionate: the battery is the real
> backstop for labelled units and is what caught §68's own t 12 (FORBIDDEN at
> 41/61 reserve poses). Today's stations are green across the pose net, so
> they are not silently fouling the reserve cluster or anything else the
> sweep can see. The residue is that the *room* figures are unverifiable
> prose, and that the base plate is **not a labelled unit** (`registerLabel`
> names only `'Three-quarter plate'`), so `collectUnits` never sees it and
> the pair sweep structurally cannot report a hanger fouling it.
>
> §68's column scan also exists nowhere in the repo as code — only as that
> prose — so re-deriving the bands means writing it. It must avoid the
> artifact §68 named: a vertex-cloud scan reads a wheel's *web* as empty and
> falsely green-lit t 12 and t 5.5. The machinery is already there —
> `buildSweptRegistry`'s `kind: 'revolve'` volumes carry a real `rBand`/
> `zBand` annulus measured across poses, which is exactly §68's "held to
> their annulus footprint, not their vertex cloud".

### The class, which is the part worth keeping

**A station literal measured along a solved length is a desync waiting for
the solve to move.** `ALARM_LINK_BUSH_T` is now one declaration feeding both
the hangers and the §54 bearing declaration (TODO 78), so those two can no
longer drift from each other — but neither is tied to `fullChordLen`, so
the chord can still move out from under both. The general fix is to derive
at least the outboard station from the chord (an end-relative station, not
an origin-relative one), which is a design change this item does not make
because the honest bands are absolute positions in the movement, not
fractions of a chord. Whoever re-sites this shaft should read that tension
before choosing.

## 80. `weldGeometry` drops `geometry.userData`, and §77's sub-body declarations ride on it

`weldGeometry` (`src/geometry.js`) builds `const out = new
THREE.BufferGeometry()` and copies attributes and the index — but not
`userData`. `weldTree` then assigns `o.geometry = welded` at the end of
boot.

So any builder that sets `geometry.userData.subBodies` on a **non-indexed**
geometry has it silently deleted before a single check runs, and the
symptom is `declaredGeometries: 0` — a clean report of work that did not
happen, the failure mode §127's slice gates exist for.

§77's shipped declarations survive by luck of construction, not by design:
`mergeGeos` sets `out.userData.subBodies` *after* calling `weldGeometry`,
and its output is indexed. Nothing states that requirement anywhere, and
the next builder to declare a sub-body table has no reason to know it.

TODO 78 sidestepped it for bearings by declaring on the **mesh**
(`mesh.userData.bearings`) — correct there for an independent reason
(which bearings hold a shaft is a per-instance installation fact), so it is
not a precedent for sub-bodies, which are genuinely a geometry fact.

Fix: copy `userData` in `weldGeometry`, and add the rule to
`docs/MODELING.md` beside rule 7. Cheap; the reason it is filed rather than
done is that copying `userData` changes what every welded geometry carries,
which wants its own report diff.

## 81. `meshIntegrity`'s sub-body census is a function of the SHARD SCHEDULE — 136/0 against 50/134 on one tree, and TODO 80 is why

**Found by §127 tier 2a's landing (2026-08-22), not caused by it. The runtime
half of TODO 80, which is the boot-time half of the same root.**

Repartitioning the battery — 31 tasks against 55, once `clearances` and
`expectedContacts` sliced — changed which checks share `meshIntegrity`'s
browser page, and its sub-body pair census moved wholesale on the SAME tree:

| schedule | checks before it on its page | tested | declared (skipped) | interior |
|---|---|---|---|---|
| 31 tasks | `axisEntry`, `penetration` | 39 | 136 | 0 |
| 55 tasks | `support`, `axisEntry`, `stemClutchHandoff` | 527 | 50 | 134 |
| 56 tasks | `support`, `axisEntry`, `stemClutchHandoff` | 527 | 50 | 134 |

Each is exactly reproducible under its own schedule (two runs of each agree
byte for byte), so this is not noise — **and the third row is what names the
variable**. Adding a check (§54's `slenderness`) re-partitioned 55 tasks into
56 and moved several checks between shards, but left `meshIntegrity`'s own
PREDECESSORS unchanged — and the census did not move by a single count. So
the carrier is not the task count, the shard count, or the partition: it is
**which checks ran before it on its page**, which is §81's invariant named
exactly. The tier's report is deterministic
*given the page's check history*, which is precisely what §81's invariant says
a check must never observe — "`start()` calls `resetInputs()` before every
check, so no check can observe which ones ran before it." The GATED fields
(the synthetic controls, malformed declarations) are schedule-independent and
did not move; every row that moved is in the REPORT tier.

**The mechanism is TODO 80's, one level later.** That item records that
`weldGeometry` does not copy `geometry.userData`, so a declared
`userData.subBodies` table does not survive being rebuilt into a fresh
`BufferGeometry`. TODO 80 catches it at BOOT (`weldTree` replacing a
non-indexed geometry); this catches the same loss at RUNTIME. `updateChain`
re-tessellates lazily and path-dependently — the reason `fingerprint` and
§152's digests both exclude `Chain` by name — and the rebuilt geometry arrives
without the declarations the old one carried. Whether a chain rebuild has
happened before `meshIntegrity` runs is a function of which checks preceded it
on that page, which is exactly the schedule dependence measured above. The
recorded rows name `Chain` / `chainRun` sub-bodies (`link#20` ⇄ `link#23`
and 133 more), and declared-skips falling 136 → 50 is the right shape and
roughly the right size for the chain's table going missing.

**What that does NOT explain, and it is the open part**: the 55-task run also
reports interior rows on the **Three-quarter plate**, whose geometry nothing
re-tessellates. Either a second carrier exists, or losing the chain's
declarations changes which pairs survive pruning far enough to reach the
plate — the two are distinguishable and the measurement below says how.

**The measurement that would close it**, in order of cost:

1. BISECT THE PREDECESSORS, which the third row above makes cheap: the two
   sets differ by `penetration` on one side against `support` and
   `stemClutchHandoff` on the other. Run `meshIntegrity` on a fresh page after
   each of those three alone and diff the per-unit candidate lists. If only
   `Chain` moves, the chain is the whole story and the plate rows are
   downstream of pruning.
2. Land TODO 80's fix (copy `userData` in `weldGeometry`) and re-run both
   schedules. If the two censuses converge, both items close together; if the
   plate rows persist, this item has its own carrier and keeps its number.

**Fix path for this half.** The tier should measure CANONICAL geometry rather
than whatever the page's history left installed: capture its sub-body
population at first run and assert stability, or force the known
path-dependent meshes to a canonical rebuild before measuring (the chain owns
a rebuild entry point), or read the declarations from a source a rebuild
cannot drop. Until then, treat cross-schedule diffs in this tier's counts as
expected — a `--report` diff across runs with different task partitions must
cite this item — and never compare its rows across partitions.

## 82. CLOSED — the alarm transfer's stall was prose, and its stroke was a constant the file had deleted

The pusher→ring force budget has been written down four times — TODO 16's
**1.5 mN**, TODO 63's **1.6 mN**, §137 Landing 2's **48 mN**, TODO 79's
**3.3 mN** — and never once computed. It lived as one prose paragraph in
`src/main.js` (`WHAT THE CHAIN STALLS AT`). There is now a probe:
`tools/probe-82-alarm-stall.mjs`.

### Error one: the stroke was a deleted constant

Every one of those four figures multiplies a stiffness by *"the rod's
0.158 mm travel"*. That is 0.42 u — `ALARM_LINK_ROD_TRAVEL`, which
`src/main.js` **deletes**, forty lines from the paragraph that depends on it:

> *"is DELETED: defined for the life of §35, referenced nowhere, and **wrong**
> (the tick moved the rod 0.19). The rod's travel is now a registration-solve
> OUTPUT, `alarmLinkParts.forward.rodTravel`."*

The `0.19` in that parenthesis is itself pre-TODO-20 (posed, not solved), and
TODO 20's own comment says *"the rod's travel is NOT the ring's"* — so the
stroke was not determinable from source at all. **Measured: 0.09932 u =
0.0376 mm**, 4.2× smaller than the figure in use.

Taken two ways and required to agree, per `probe-137-elbow`'s rule
(*agreement is the evidence; either number alone is a claim*): a `setPose`
sweep over the disarmed/armed parities, and a real `step(dt)` run driven from
`pressAlarmPusher` through the button — the only public door to the primitive.
Both give 0.09932 u, and all six measured travels agree to five decimals. That
matters here because `setPose` ticks with zero dt so an eased input cannot move
under it, and the registration solve's `solveEnv` is a bisection seeded from
the previous state.

### Error two: "in series" was implemented as a minimum

The paragraph charged each member against its **own** stroke at its **own**
point and took the smallest, with no lever ratio referring them to a common
point. Nothing in the repo computed `1/k_eff = Σ 1/k_i`. Compliances in series
add, and they must be *reflected*: for a member whose working point moves
`n = δ_member/δ_ring` per unit of ring travel, force scales as `1/n`, so its
compliance seen at the ring is `n²/k`. Every `n` is **measured** between the
two poses rather than derived from arm lengths — standing rule 2's habit
applied to displacements.

| member | k (N/m, circular) | n | share of compliance |
|---|---|---|---|
| beak tail blade | 304.8 | 0.523 | 2.0% |
| **shaft, ROD-END overhang** | **8.3** | 0.523 | **72.4%** |
| shaft, bush-to-bush span | 88.4 | 1.015 | 25.5% |
| shaft, fork-end overhang | 16 775 | 1.015 | 0.1% |

`k_eff = 21.89 N/m` over the ring's measured 0.19 u (0.072 mm) ⇒
**stall 1.58 mN**, against the movement's 5–50 mN detent band.

### What that means

- **The transfer is ROD-END-LIMITED and an order of magnitude below the band.**
  It does not sit inside it at 48 mN. TODO 16's original verdict — *"short by
  one to two orders of magnitude"* — is **restored**, and §137 Landing 2's
  correction that overturned it was the one in error. (The numerical
  coincidence with TODO 16's 1.5 mN is exactly that: its arithmetic used a
  10.2 N/m tail that has since been fixed to 305 N/m.)
- **The section is sized against the member that contributes 0.1%.**
  `ALARM_LINK_SHAFT_R = 0.1233` was solved to put 2807 N/m into the *fork-end*
  cantilever. Do **not** re-derive it against these numbers before TODO 79's
  stations are re-solved — that would spend metal on the wrong member twice.
- The rod-end figure is the **coupled** stiffness, `21.2 ÷ (L+a)/a = 8.3 N/m`,
  not the free cantilever. `(L+a)/a = 2.566` is the stiffness factor;
  `SLENDER_OVERHANG_K`'s ≈1.4 is its λ-space cube root and is not
  interchangeable.

### Things measured in passing, worth keeping

- **The shaft's roll is 0.34616 rad**, and `ALARM_FORK_PIN_ARM_R`'s own
  derivation requires *"span ≤ 0.35 rad"*. It holds, with 1% to spare —
  measured for the first time rather than asserted.
- The implied pin arm `ring/roll = 0.5489` against the declared
  `ALARM_FORK_PIN_ARM_R = 0.56` — 2%, the pin not staying exactly horizontal
  through the stroke. The implied rim arm `rod/roll = 0.2869` against
  `rimTipD = 0.425` is **not** a discrepancy: `rimTipD` is a radius, and the
  rod sees only the vertical component of the finger's arc.

### Checked and NOT filed

The two input-side contacts (`beak tail ⇄ rod top`, `rod foot ⇄ rim crank`)
are both unilateral, so it is fair to ask what pushes the rod **up** on the arm
stroke. `restoring` already classifies `Alarm link` as `twoWayDriven` with
fanout 2, so it is not an open no-spring row and no item is filed. The residual
question — whether two-way *driving* is physical across two compression-only
contacts, or is a modelled convenience — is the modelled-vs-simulated gap
CLAUDE.md names, and establishing it either way is more work than this item
did. Stated here rather than filed as a claim.

### One section model throughout

Circular, `I = πr⁴/4`, because the shaft is round and §137's 2807 N/m is
circular. `checkSlenderness`'s column is **rectangular** (`ac³/12`) and reads
`64/12π = 1.6977×` stiffer for a round bar. Mixing them is what put two wrong
rows in TODO 79's table; both are corrected there.

## 83. The parity ray still lies inside the box — §122 silenced only the provably-outside calls

§122's dissection measured the verdict family's third lying mode: the
fixed oblique parity ray (`pointInsideTree`) returns ODD for samples up
to 13 u OUTSIDE the other mesh's bounds — grazing-count false positives,
worst on `LatheGeometry` coaxial walls (166 of 166 odd samples on the
fusee's `CylinderGeometry#11 ⇄ LatheGeometry#3` pair were outside-box
lies; the phantom `Escape wheel ⇄ Three-quarter plate` contact at 0 was
another). The §122 cut removes every parity call whose sample is
provably outside the box, which silences that entire measured
population — but a sample INSIDE the box gets the same ray with the same
grazing fragility, and nothing guards it. The dissection saw zero
genuine inside-box odd samples in its populations, which bounds the
exposure but does not close it: a lie there would manufacture a contact
(`inside: true` → d = 0) that no instrument would question.

`tools/probe-122-verdict.mjs` is the instrument — its broad mode counts
inside-box odd samples (the `genuineInside` bucket) and any growth there
should be treated as this item firing. Candidate fixes, unmeasured:
multi-ray voting (2-of-3 oblique directions), or an epsilon-nudged
re-cast when hit counts include distances within 1e-6 of each other
(the grazing signature). Do not widen anything to work around a lie —
§82's rule: patch the instrument, then let the corrected verdicts land
with their witnesses.

## 84. Every gear ships fatter than it was cut: the extrude's bevel grows the tooth by more than its own backlash

§136 cut conjugate flanks and proved them: `probe-136-roll` builds all 24 of
the movement's gear meshes from the real generator, places them at their real
centre distances and rolls them a full pitch at the conjugate ratio, and
measures **zero penetration on every one**, with backlash left over. In the
movement, two of those same meshes still interfere (TODO 77's rows, still
waived). The difference is not the profile. It is what happens between
`cycloidalGearShape` and the mesh.

**The mechanism.** `makeGear` and `makePinion` extrude with
`bevelEnabled: true, bevelSize: bevel`, and three.js offsets the contour
OUTWARD by `bevelSize` perpendicular to every edge — the fact §115's
declared-versus-cut assert exists to bound and §136's `gearTrueReach` computes
the miter for. So the body a mesh check sees is the cut outline grown all
round by `gearBevel(module, thickness) = min(thickness·0.18, module·0.22)`,
while the tooth thickness it was cut with reserves only
`cyBacklash(module)` for the pair. Measured on the reserve train, where both
numbers are in hand:

| member | cut tip | bevel | shipped tip | pair backlash |
|---|---|---|---|---|
| p0, 8t, m 0.34 | 1.4207 | 0.0748 | 1.5167 | 0.0427 |
| w1, 28t, m 0.34 | 5.2003 | 0.0748 | 5.2756 | 0.0427 |
| p1, 10t, m 1.066 | 6.5896 | 0.2065 | 6.8441 | 0.134 |
| w2, 6t, m 1.066 | 3.8789 | 0.18 | 4.1053 | 0.134 |

Both flanks of a mesh grow, so a pair spends roughly **2·bevel** out of a
backlash smaller than one bevel. At module 0.34 that is 0.15 u of growth
against 0.043 u of clearance — three and a half times over. The generator is
not being ignored; it is being overruled downstream by a finish parameter.

**Why it is general.** Every gear in the movement is extruded this way, so
every mesh is in the same position; the reserve train is simply the only unit
whose rows are GATED (`INTRA_TIER_SCOPE`, TODO 77) and therefore the only one
where it is visible rather than reported. Expect it to be the reason behind
any other mesh-on-mesh row in the untriaged `outOfScope` population.

**Measured.** `probe-reserve-mesh-overlap`'s exact column — the generator's
outline grown by the bevel, registered against the shipped mesh on its tip
lattice, polygon against polygon at the movement's own centres and phases —
reads **0.31116 u = 0.118 mm** on the stage-one mesh. The reconstruction is
believed there because it reproduces the shipped wheel's measured tip radius
to four decimals (5.2756 against 5.2756).

**What the fix is, and what it is not.** It is NOT widening `cyBacklash` to
swallow the bevel: backlash is a share of the pitch with a reason, and sizing
it around a finish parameter would be rule 1 backwards. Three candidates, in
the order they should be tried:

1. **Cut the shape inset by the bevel**, so the grown body lands on the profile
   the generator designed. The offset is the same miter construction
   `gearTrueReach` already computes, run inward — the honest version, because
   what is then cut is what was designed.
2. **Extrude gears without a bevel** (`bevelOn: false` is already a parameter).
   Correct immediately and free, at a cost in finish (P4) — the bevel is what
   keeps a tooth from reading as a laser cut.
3. **Derive the bevel from the backlash** rather than from module and
   thickness — `bevel ≤ backlash/2` per member — which keeps a chamfer but
   makes it answer to the mesh instead of to the stock.

Whichever lands, every `gearOuterR` consumer moves with it: the bound feeds
station solves across the movement, so this is a landing with a battery run
in it, not an edit.

**Related debt already closed by measuring this.** `gearTrueReach` shipped in
§136 with its bisector wrong — a DIFFERENCE of the two outward edge normals
where the SUM is meant, which points 90° off the bisector, and a length that
is the sine of the turn angle rather than of the half interior angle. It
stayed green because `gearOuterR` takes `max(tipR + bevel, gearTrueReach)` and
the misdirected offset grew the radius less than the inflated length did, so
the bound stayed conservative over a reach it had not actually computed.
Fixed in the same landing that found it; the corrected construction is what
lets the probe above reproduce the shipped tip radius exactly, which is how it
was found.

## 85. §136's residue: two builders still cut trapezoids, and one of them is the barrel

§136 converted `makeGear` and `makePinion` to the cycloidal generator. Two
builders were deliberately left on `gearOutlineShape`, and the reasons are not
the same:

- **`makeBevelGear`.** The spider differential's sides and planets are BEVEL
  wheels, and `gearToothSpec` describes a spur tooth — a cycloidal spur
  profile on a bevel is a different lie from a trapezoid on one, not a smaller
  one. The right fix is a bevel spec (a crown/octoid tooth on a cone), which
  is its own piece of work. Until then `minGearTeeth`'s cycloidal floor must
  NOT be applied to these members: it was, once, during §136, and it demanded
  11 teeth where the trapezoid needs 10 and killed the arrest station's solve.
  **The floor must match the generator that cuts the member** — that is the
  rule the mistake bought.
- **`makeBarrel`.** Converting it moves the barrel's cavity by +0.226 u, which
  lands squarely in §104's equalisation solve — the going spring's torque law
  is derived from its ribbon and the fusee cut against it, and the alarm half's
  wind ceiling is measured against the same metal. So the conversion is not a
  builder change, it is a re-solve of §104, and it belongs in its own landing
  with `equalisation` re-run rather than bolted onto the profile work.

Neither is gated, and neither should be waived into looking finished: the
movement's two remaining trapezoidal tooth forms are debt, and this item is
where they are counted.

## 86. `gearTrueReach`'s miter is not a miter, and the setting wheel's clearance has been living on the error

§136 added `gearTrueReach` so `gearOuterR` could bound the metal an extrude's
bevel puts past the tip circle — the miter at the corner where the tip land
meets the epicycloidal face, which `TIP_RELIEF`'s 1.02 cushion used to swallow.
The construction it ships with is wrong in two places at once.

**What it computes.** The outline runs counter-clockwise, so an edge `(dx, dy)`
has outward normal `(dy, −dx)`, and the offset point leaves along the SUM of the
two edges' normals — a vector whose length is `2·sin(θ/2)` for the interior
angle θ, which is exactly the miter's denominator. The code takes a DIFFERENCE
instead. That is a direction 90° off the bisector, scaled by the sine of the
TURN angle rather than of the half interior angle — so a nearly straight run
(θ → π, which is most of a face) is treated as a cusp, and a real cusp as a
straight run.

**Why nothing caught it.** `gearOuterR` returns
`max(spec.tipR + bevel, gearTrueReach(spec, bevel))`, and the misdirected offset
grows the radius less than the inflated length does. The net is an
OVER-estimate, so the bound still bounds and §115's declared-versus-cut assert
still passes — over a reach it never actually computed. Measured on the keyless
setting wheel (20t, module 0.34, thickness 1.1): **4.1451 as shipped against
3.9424 from the correct construction**, a 0.2027 cushion nobody asked for.

**The second half, which is the reason this is filed rather than fixed.**
Correcting it was tried and reverted. `gearOuterR` feeds station solves, and
that 0.2027 is consumed by `SLEEVE_TOP`'s second cap in `src/main.js` — the one
that holds the clutch spine clear of the setting wheel at full pull. With the
honest bound, that cap loosens by 0.2027, stops binding, and the spine reaches
to the rim cap (`CLUTCH_RIM_T/2 − SAW_FIT` = 0.5) instead. `expectedContacts`
then measures `Winding clutch ⇄ Keyless works` / `clutchSleeve ⇄ settingWheel`
at **0.1278 against the 0.15 floor**, at `handSet f=0.9333` — a real violation,
in a battery that is otherwise 33/33.

So the cap has been passing on slack this error was lending it. Its stated
argument bounds the wheel by a sphere of radius `gearOuterR` about the wheel's
centre and the spine by `SLEEVE_TOP` along the stem, and neither is the
governing distance: measured at the failing pose, the closest metal is nowhere
near the wheel's rim. **Re-deriving that cap from the real closest approach is
the work**, and it must happen in the same landing as the miter fix or the fix
lands a red gate. Do not pay for it by shortening the spine to a number that
happens to work, and do not widen the floor — `CLEAR_MARGIN` is the one
clearance margin.

**Order of work.** Fix the bisector and the half-angle together (both are
one-line corrections and the probe that found them,
`tools/probe-reserve-mesh-overlap.mjs`, already carries the correct
construction — it reproduces the shipped 28-tooth reserve wheel's measured tip
radius to four decimals, 5.2756 against 5.2756, which is how the error was
found). Then re-derive `SLEEVE_TOP`'s setting-wheel cap against the real
geometry, and run the battery: `gearOuterR` moves for every gear in the
movement, so the blast radius is every station solve that consumes it, not just
this one.

## 87. The alarm toggle's press is not in the pose net, and its declarations answer for the wrong members

Reported by eye in one sitting, four symptoms: the pawl phases through the
column wheel; there is not enough force to toggle the selector; the pusher
looks unsupported; and the arbors carrying the wheel's turn into the selector
look unsupported. All four survive measurement. They are filed as ONE item
because they are not four independent defects — three of them fall out of two
causes, and either cause moves several symptoms at once:

- **The press STROKE is not a pose anything sweeps.** `resetInputs` and
  `setPose` both zero `alarmPusherT`, no axis varies it, and every sweep in the
  battery therefore samples the pawl PARKED. The hand-off row says so about
  itself in as many words (grep `pusher pawl ⇄ ratchet skirt`).
- **Every declaration in this group is keyed on a UNIT**, so one row routinely
  answers for a member it does not describe — `restoring` answers for
  `Alarm switch` with the CLICK's blade, and one `INTRA_UNIT_CONTACTS` row
  excuses the pawl against all three of the wheel's meshes at any depth.

**The group, and the two mechanisms it is not.** The action group is
pusher → pawl → column wheel, and then three outputs off the same
castellations: the §35 run (link beak → rod → lay shaft → cranks → selector
ring) that ARMS, the lock lever that brakes the striking train, and the click
that banks each tooth. What the pusher does NOT drive is the §45 chain —
collar → release lifter → release sleeve → silence rocker → release feeler —
which SILENCES a ringing alarm off `alarmCrownPullT`. TODO 63's standing
correction, restated because this item was scoped to cover both: *"They are
different mechanisms and conflating them will send a fix to the wrong one."*
The §45 chain's own open debt is TODO 64's (no axis sweeps its input), and this
item does not annex it; it appears below only where the two touch.

### 1. The pawl drives on after the wheel has stopped

`alarmPusherPawl` is a rigid child of `alarmPusherGroup`: its transform is set
once at build (grep `ALARM_PAWL_KISS_S`) and never written again, and the group
translates by `ALARM_PUSH_TRAVEL · alarmPusherT`. The tick clamps what the pawl
carries at one tooth and then latches (grep `alarmColLatched`), so the wheel
stops while the head keeps travelling. From the shipped constants:

| quantity | value |
|---|---|
| press travel (`ALARM_PUSH_TRAVEL`) | 2.686 u / **1.018 mm** |
| moment arm (`ALARM_PAWL_ARM`) | 4.370 u |
| one press carries (`ALARM_PAWL_SWEEP`) | **0.6147 rad** |
| one tooth (`ALARM_COL_STEP`) | 0.5236 rad |
| delivered | **117.4%** of a tooth |
| travel arriving AFTER the latch | **0.398 u = 0.151 mm** (14.8% of the stroke) |

> **MEASURED, and the arithmetic holds** (`tools/probe-87-press.mjs`,
> 2026-08-24, on the tree at `8bdb730`). Step 2 below, run: the shipped tick
> stepped through two presses at 1/480 with `beginSweepHold` up, every quantity
> taken off the built tree rather than re-quoted. The moment arm measures
> **4.370 u** as d(travel)/d(angle) while the pawl still carries; one tooth
> measures **0.523599 rad**, agreeing with the public `clickLaw.pitch / 2`; one
> press carries **0.61466 rad = 117.39%** of a tooth; and the travel arriving
> after the latch is **0.39794 u**. Both presses give the same figures, and
> 1/120 agrees with 1/480 to 2e-5, so the extremum is the trajectory's and not
> the sampling's.
>
> **Two things the probe had to get right to be worth quoting.** The latch
> falls BETWEEN frames, so the first frame at the final angle is already past
> it — snapping to the frame grid reads 0.30778 and understates the overrun by
> exactly one frame of travel; the latch point is taken as arm × tooth instead,
> both measured. And the containment depth is **capped at 0.0383** by geometry
> that has nothing to do with this finding: the pawl's 0.24 of z sits inside the
> skirt's band with 0.0383 to each face, so `closestPointToPoint` answers to a
> FACE and can never report more, however far the pawl advances in plane.
> Reading that number as a penetration depth would understate the overrun by an
> order. The pawl shares space with the skirt in **96 of 116 frames**, which is
> the qualitative claim; the in-plane advance is the 0.39794.

The overrun is larger than `CLEAR_MARGIN`, and it goes into the tooth the pawl
has just banked, because nothing in the pawl can yield. **The 117% is asserted
as a FLOOR and bounded from above by nothing**: the boot check reads
`if (ALARM_PAWL_SWEEP < ALARM_COL_STEP)`, which is the right constraint for
"the pawl must finish a tooth" and says nothing about what the surplus does.
That is rule 1's shape — a one-sided derivation whose other side was never
written — and the surplus is not free, it is displacement into metal.

**The return stroke is the second half, and the source already describes a
motion the part cannot make.** The build comment beside `ALARM_PAWL_KISS_S`
prices the back flank at 67.4° off radial and calls it *"the ramp the pawl cams
back over on the return stroke"*. There is no degree of freedom in which to cam
back over anything: no pivot, no spring, no lift. A rigid bar translating on a
straight line cannot follow a tooth travelling on an arc.

**Why no instrument reports it, three times over.** `alarmPusherT` does not
appear anywhere in `inspect.js`, so the stroke is not in the pose net at all —
it exists only in live frames, which is exactly where it was seen. The
`pusher pawl ⇄ ratchet skirt` hand-off measures the PARK and carries its own
note saying the index stroke is a transient static poses cannot reach (its
quoted `0.7` / `~0.84 tooth arc` figures are stale twice over — the travel has
been derived since TODO 20). And the `INTRA_UNIT_CONTACTS` row for
`alarmColWheel ⇄ alarmPusherPawl` is consulted BEFORE any measurement, so it is
a depth-free excuse rather than a budget — worse, `traverse` puts the name
`alarmColWheel` on the base disc, the castellations AND the ratchet skirt, so
that single row waives three pairs. This is item 5's class after its own fix:
the tier enumerates the pair correctly (pawl and wheel are in different motion
frames) and then discards it on a declaration.

> **CLOSED by §163, and the over-carry does not get absorbed — it ceases to
> exist.** The 117.39% was never a surplus to budget: it is exactly the ratio of
> a guessed number to a derived one, `4.370 / 5.130 = 85.2%`. §163 removes the
> guess twice over. First `ALARM_PUSH_CHORD` stopped being
> `1.15 · (baseR / 1.5)` and became `travel ÷ step`, which is the saw's own root
> circle — right for a rigid pawl on an arm, and the reason the 4.37 fell out as
> a ratio. Then the pawl stopped being rigid on the pusher: the driver pivots on
> the wheel's arbor and the pusher reaches it through a pin in a radial slot,
> which makes the driver's angle the pin's AZIMUTH and forces
>
>     d = travel / (2·tan(step/2)) = 5.01226
>
> with the stroke straddling the foot of the perpendicular. So the built offset
> is 2.30% inboard of the root circle and 5.13 is now an INTERMEDIATE — the
> moment arm of a member that no longer exists. The boot check is a two-sided
> equality where it was a floor (`|ALARM_PAWL_SWEEP − ALARM_COL_STEP| > 1e-12`),
> because with the offset derived from the coupling the two sides are the same
> number by construction, and the two directions fail differently: under-sweep
> leaves the pawl on a flank mid-index, over-sweep drives into a banked tooth.
>
> The carry law moved with it. `travel·T / arm` and the coupling's azimuth share
> their endpoints and disagree everywhere between, which is half the poses the
> `alarmPressCycle` axis visits — the middle of the press is where the wheel
> now stands somewhere different.
>
> **MEASURED, on the shipped tick** (`tools/probe-87-press.mjs`, the same probe
> that took the 117.39%): **100% of a tooth and 0 u after the latch**, at 1/120
> and 1/480, on both presses. Against the filing's 117.4% and 0.398.
>
> Getting there took two corrections to the probe and one to the tick, and the
> tick's is a defect of its own:
>
> - **It measured travel off the PAWL.** With the pawl rigid on the head its
>   displacement WAS the press travel and its return WAS the head's; §163's pawl
>   rotates on a driver and its position is the output of a seat solve, so the
>   two questions came apart and the probe reported "the head never came back to
>   its seat" four times. Travel and the return are read off `alarmPusherCap`
>   now; contact still off the nose.
> - **It took the latch travel as arm × tooth.** That is exact for a constant
>   arm and meaningless for a pin in a radial slot, whose arm runs 5.012 at the
>   foot to 5.372 at either end — so the "overrun" moved with the step rate
>   (0.134 at 1/120 against 0.022 at 1/480), the probe reporting its own model.
>   The latch travel is INTERPOLATED off the trajectory now, and the delivered
>   tooth is read off the WHEEL rather than off a travel divided by an arm,
>   which assumes nothing about the coupling.
> - **And the wheel lagged the head by exactly one tick.** `alarmPusherT` was
>   advanced 380 lines BELOW the carry block that reads it, so the wheel was
>   always turned with the previous tick's fraction: measured, the head reached
>   full travel 2.68606 with the wheel at 0.518383 of its 0.523599 tooth, and
>   the wheel only completed on the next frame with the head already returning.
>   The lag PREDATES this item — the 117.39% was measured through it — but "the
>   wheel goes exactly where its pawl has pushed it" is what TODO 20 and §163
>   both claim, and one frame of lag falsifies it at the frame scale. The
>   advance moved above the carry. It cannot move a battery report: `setPose`
>   assigns `alarmPusherT` directly, so no sweep comes through this path —
>   verified by diffing a full `--report` across the change.

### 2. The force is an order light, and it starves downstream — not at the pusher

Named here so the symptom is not chased to the wrong end. The INPUT side is
healthy and computed: the pusher's transfer row needs ≈**9.4 mN** at the pawl
to overcome the click's detent, against the **1–5 N** a finger delivers
(`CASE_PUSHER_INPUT_N`) — three orders of headroom, and the row says so.

What starves is the shaft: TODO 82 computed the pusher→ring stall at
**1.58 mN** against `SELECTOR_DETENT_WINDOW_MN`'s **5–50 mN**, rod-end-limited,
with the rod-end overhang carrying **72.4%** of the whole chain's compliance
and the fork end the section was sized against carrying **0.1%**. The
`alarm arming: lay shaft cranks` row misses its envelope and is waived citing
TODO 79. **This item does not re-open TODO 16, 79 or 82, or roadmap §156** — it
records that the owner's "not enough force to toggle the selector" is that
filed debt, visible on screen, and that a fix aimed at the pusher or the
column wheel would be aimed at the wrong member.

### 3. The pusher's only bearing is one boss, and the one row naming it calls it a spring

There is exactly one guide member (grep `Guide boss at the plate rim`), and its
own comment is honest about its status: it is the bearing *"until §3's case
takes over"*, and §3 is unbuilt. Three consequences, none of them currently
declared as debt:

- **One station cannot restrain a cantilever.** The boss sits at
  `plateR - 1.2`; the cap stands ~2.8 u outboard of the plate rim into empty
  air (BUILT §43 recorded the head **2.22 mm proud**, with no case to bore for
  it). A single point bearing fixes position, not tilt.
- **The bore was smaller than the stem — FIXED, and now measured.** The boss
  was a torus of ring radius 0.36 and tube 0.12, so its hole read **0.24**
  against `ALARM_PUSH_STEM_R` **0.32**: a **0.08 u = 0.030 mm** interference at
  every pose, in a joint whose whole job is to slide. Two literals that had
  never been checked against each other. The bore is derived from the stem now
  (`ALARM_PUSH_GUIDE_BORE = ALARM_PUSH_STEM_R + PIVOT_BORE_CLEAR`) and the ring
  radius follows it, so growing the fit grows the torus rather than eating the
  stem. Measured across the press axis afterwards: **0 samples inside at every
  fraction, gap 0.05 at each** — the running fit, at every pose.
- **And the row that covered it described a part that does not exist —
  CORRECTED.** The `INTRA_UNIT_CONTACTS` entry pairing the stem with that torus
  read *"the return coil seated round the pusher stem"*. There is no return
  coil: the return is `ALARM_RETURN_S` in the tick, a settling time with no
  metal behind it. So a bearing interference was waived under the name of a
  spring. The row now names the joint it is (`alarmPusherGuide`, the boss being
  named for the first time) and describes the running fit. The missing spring
  is step 5's, and step 5 turns out not to be cheap — see there.

### 4. `restoring` answers for the click, so the pusher's return is never asked about

`declareRestoring('Alarm switch', 'spring', …, 'switchClickSpring')` is true and
is about the CLICK ARM. The pusher is a second reciprocator inside the same
unit, and its return is the rate constant above. §48's audit takes one answer
per unit, so `Alarm switch` passes on the strength of a member that is not the
one in question.

**This is a third shape of the same failure, and it is worth naming apart from
the other two.** TODO 29 and TODO 64 are POPULATION gaps — no axis moves the
part, so the audit never asks. This is a GRANULARITY gap: the axis question
does not arise, because one declaration per unit cannot answer for two
reciprocators. Rule 4's warning covers the first; nothing covers this one.

> **CLOSED as a blind spot by §162, and the pusher's own row is now the debt.**
> `declaredRestoring` is keyed `(unit, member)`, so a unit may hold as many
> declarations as it has reciprocators, and the audit derives the bodies rather
> than taking a list: each unit's reversing meshes cluster into rigid frames by
> the same `clusterByFrame` signature `checkAssembly` and `intraUnit`'s MM tier
> use — one predicate, three consumers now.
>
> Measured on the first run, the movement holds **40 reciprocating bodies
> across 24 units**, where the unit-keyed audit saw 24 answers. `Alarm switch`
> splits into exactly the two this finding names: `switchClickArm` +
> `switchClickNose`, answered by `switchClickSpring`; and
> `alarmPusherStem` + `alarmPusherCap` + `alarmPusherPawl` + `alarmPusherRiser`
> + `alarmPusherReach`, answered by **nothing** — waived in
> `RESTORING_MEMBER_WAIVERS` citing this item, which is what step 5's second
> half exists to retire.
>
> **The residue is named and counted rather than triaged in one go**, §121's
> convention: the tier GATES `RESTORING_MEMBER_SCOPE` (`Alarm switch`) and
> REPORTS everywhere else — **20 bodies answered `'*'`** (a unit-wide claim,
> which is exactly what every declaration meant before the re-key) and **4
> answered by nothing** (`Mainspring drum`'s hook stack, `Alarm hammer`'s own
> blade, `Minute jumper`'s unnamed box, and — the one that is plainly a real
> body — the pusher). Two things are held everywhere, not only in scope: a
> member selector resolving to no mesh in its unit, and a waiver naming a body
> that turns out to be answered.
>
> **`'*'` is mostly a NAMING problem, and that is the next tranche's shape.** A
> declaration can only refine to a member the metal has a name for, and whole
> units reverse as unnamed `ExtrudeGeometry` — `Keyless works`, `Pallet fork`,
> `Balance`, `Power-reserve train`, most of `Fusee & great wheel`. §54's lesson,
> arriving at a second instrument: a row that cannot name its member is not
> actionable. Naming those meshes is the fix, and it is free of geometry —
> §162 named three (`switchClickArm`, `switchClickNose`, `alarmPusherStem`) to
> put `Alarm switch` in scope and the fingerprint did not move.

### 5. "Unsupported" and `support` 0 failures are both correct

`checkSupportGeometry` walks declared UNIT→UNIT edges and measures a gap ≤ tol.
It answers *is there metal under this unit*; it has never answered *is this
member restrained against its load*. What the group declares: `Alarm switch` →
the three-quarter plate, for the column wheel's stud (nothing about the
pusher); `Alarm link` → the plate, for the rod's bores and the lay shaft's two
hanger bushes; `Alarm selector` → the dial, for the ring's three guide posts.

Restraint truth lives in `userData.bearings` (§78's free-length declaration),
and **exactly one mesh in the movement declares it** — the lay shaft, two
stations, which is what exposes the **12.487 u** rod-end overhang item 79 owns.
The vertical rod runs through bores in both plates and declares nothing; the
pusher stem passes through its boss and a plate slot and declares nothing. So
the eye is reading something real that no check is looking for, and the answer
is not to widen `support` — it is that the group's members have never stated
where they are held.

### 6. The reach bar carries through the ratchet skirt — found by the axis, on its first run

**The press axis's first act was to fail a gate**, at a pose no sweep in the
movement's history had ever stood in. `intraUnit` MM, `Alarm switch`:
`alarmColWheel ⇄ alarmPusherReach`, at `alarmPress f = 0.5`. Not the pawl — the
CARRIER.

Mapped across the cycle, the bar is inside the skirt from **f 0.30 to 0.75**,
the middle half of the stroke, 12 sampled vertices at the bottom:

| what | value |
|---|---|
| reported depth | **0.03833**, flat at every pose — and NOT the number to read |
| why it is flat | the bar's 0.24 of z sits inside the skirt's 0.3166 band with 0.0383 to each face, so `closestPointToPoint` answers to a FACE (finding 1's cap, at a second member) |
| the in-plane figure | the bar's leading end starts **1.1 u** behind the pawl's kiss against a **2.686 u** stroke, so at the bottom it stands **~1.586 u** past the kiss, inside the tooth circle |

**The source said this could not happen.** The build comment by the carrier read
*"the PAWL, on its dropped carrier below the disc, is the only member that
reaches the teeth"*, and a second one said *"Only the pawl still lives at the
skirt band"*. Both are true of the STEM — which is what TODO 22 actually fixed —
and false of the reach bar, which shares the pawl's band by construction. Both
are corrected in place beside the metal, with the measurement.

This is item 22's class returned at a different member: two parts of one action
group occupying the same matter, invisible to every inter-unit sweep because
they live in one unit, and invisible to `intraUnit` too until an axis moved the
pusher. **That is the whole argument for step 1 in one row** — the gate did not
become stricter, the mechanism became reachable.

**The prescribed fix does not fit, and that is measured now rather than
assumed.** This item first said the carrier "wants to leave the skirt's z band
with the pawl hung from a dropper — the anatomy the source comment already
describes". Measured on the built tree, that band is CLOSED at this station:

| | z |
|---|---|
| three-quarter plate, top | **8.9945** |
| ratchet skirt, bottom | **9.1345** |
| free band between them | **0.140** |
| a 0.24-thick bar with a `CLEAR_MARGIN` each side needs | **0.540** |

Short by 0.4, and the bar cannot thin its way in either: its 0.24 of z is
already under the 0.317 stock floor (TODO 11's residue). So the carrier has
nowhere to go in z here.

**And the deeper reason is that renaming the member would not help.** The riser
stands just outside the saw's tip circle at full press by its own derivation
(`ALARM_PUSH_INNER` carries `+ ALARM_PUSH_TRAVEL` for exactly that), while the
pawl's leading face is ~1.97 inside it. Whatever spans those two stations is
inside the tooth circle at the bottom of the stroke — calling it "pawl" instead
of "reach bar" moves the label, not the metal.

**So the real fix is step 3, not a re-route**: a pawl that can LIFT out of the
tooth circle, with its carrier lifting with it, is the only arrangement that
clears the teeth on the return without moving the station or re-stratifying the
band (§51's machinery, if it comes to that). Until then the row is waived in
`INTRA_UNIT_WAIVERS` citing this item, deliberately not silenced, so `Alarm
switch` stays GATED: any other interference in that unit now fails.

> **CLOSED by §163, in position space — and this finding's own arithmetic was
> wrong in a way worth recording.** Two corrections and one fix.
>
> **The 0.140 was never 0.140.** The table above reads the plate's top off a
> vertex at z 8.9945, and that vertex is not the plate: it belongs to
> `screwSlots`, standing 0.01 proud, whose nearest vertex to the column wheel is
> **30.48 away**. The plate top is `threeQuarterPlate` at **8.9845** — which is
> `TQ_TOP_Z`, the constant `ALARM_COL_RAISE` is derived against — so the free
> band was **0.150** all along, exactly the `CLEAR_MARGIN` the raise exists to
> put there. The conclusion the row supported (a 0.24 bar with a margin each
> side wants 0.540 and does not fit) survives the correction unchanged; the
> number quoted for it did not, and a number measured against the wrong face is
> how a sound conclusion acquires a false witness.
>
> **The band is not 0.150 any more either.** `ALARM_COL_RAISE` is re-derived to
> open the DRIVER's own stratum — `CLEAR_MARGIN + STOCK_MIN_U + CLEAR_MARGIN` =
> **0.6166** — which grows the raise by 0.467. That is real movement height and
> it was priced before it was spent: the link's beak arm derives from
> `ALARM_COL_TOP_Z`, so the whole rider cluster goes up with the wheel (§68's
> own comment says so), and neither the under-plate route nor shortening the
> 1.4 castellation tier could pay for it — the first has 0.19 of largest gap
> against 2.417 needed, the second would spend two P0 contacts to buy at most
> 0.26.
>
> **And the bar does not go into that band at all.** It goes BELOW the plate, to
> the stem's own plane, where the plate itself stands between it and the driver.
> Measured over the whole stroke (`tools/probe-163-pin.mjs`), its nearest
> neighbour is that plate at **0.61** and the next thing in the movement is
> **1.95**. So the member does not cease to exist, as step 3 predicted it would
> — it changes stratum, which is the currency P3 allows and the only one it
> allows. Its section goes to `STOCK_MIN_U` in both directions on the way, the
> old 0.30 × 0.24 having been under §50's floor in both.

### 7. The pawl is inside the ratchet, not on it — and that re-scopes step 3

**Finding 1's depth was never the depth.** `probe-87-press` reports a
containment figure capped at 0.03833 by the z bands, and says so; the number
that matters — how far into the metal, in the wheel's own plane — had never
been taken. `tools/probe-87-pawl.mjs` takes it, projecting both members into
the wheel's frame and testing the pawl's vertices against the SAME
`userData.ratchetPoly` the teeth were cut from.

| pose | pawl's radius from the wheel axis | vertices inside the saw | in-plane depth |
|---|---|---|---|
| rest (f = 0) | 5.884 .. 7.197 — straddling the tip circle | 6 / 24 | **0** (the declared kiss) |
| bottom of stroke (f = 0.5) | **4.451 .. 5.378** | **24 / 24** | **0.7615** |

The saw's root circle is **5.13** and its tip circle 6.384. At the bottom of
the stroke the pawl's whole leading end stands INSIDE the root circle: it is
not fouling the teeth, it is ploughing through the body of the ratchet. Past
`CLEAR_MARGIN` from f 0.23 to f 0.96 — most of the cycle — and **20× the
z-capped figure, 5× the margin.**

**So the drive contact is not a contact.** The wheel's angle is computed
kinematically (`travel / arm`, TODO 20's carry) while the member said to be
driving it is buried inside it. That is §35's original audit finding — "every
hand-off is a contact" turning out to be false when measured — one member
further upstream than TODO 20 reached, and it is why the pawl⇄skirt row in
`INTRA_UNIT_CONTACTS` is not the excuse it looks like: the row says "the pawl
PARKS ON the kiss", which is true at rest and says nothing about the 2.686 u
that follow.

**What this does to step 3.** The step read "give the pawl the freedom a pawl
has — a pivot and a return spring, so it can cam over the teeth". That is
necessary and not sufficient: a pivot lets a NOSE ride a tooth back, and this
pawl is a 1.5-long box travelling 2.686 u along a straight chord through an
annulus. The redesign is a real drive contact — a short nose on a sprung,
pivoted lever whose engagement is SOLVED against `ratchetPoly` the way TODO
59's click nose is solved against `profileAt`, with the wheel's carry then
being the consequence of where that contact sits rather than a formula
evaluated beside it.

`probe-87-pawl.mjs` is that work's acceptance test, and it is written to be
one: a pawl that drives through a real contact reads **0 vertices inside at
every pose except the declared kiss, where it reads depth 0.**

> **CLOSED by §163 — the drive contact is a contact.** The pawl is a shaped
> member on a driver pivoted on the wheel's OWN ARBOR, and the architecture
> comes from that one fact: on the drive stroke driver and wheel turn about the
> same axis together, so relative to the teeth the driver does not move and
> there is nothing to plough through. Three other pivots were measured first and
> all three fail the same way — the number that decides it is how far the
> pawl's pivot advances in azimuth ABOUT THE WHEEL over the stroke, against the
> 30° the wheel must turn:
>
> | pivot carried by | advance | verdict |
> |---|---|---|
> | the riser (a straight line) | 11° of 30° | the arm supplies the rest by swinging, 53.4° → 95.5° off radial: past tangential, lying along a flank, −0.15 |
> | a fixed post outside the wheel, pulling | 0° of 30° | the nose slides off the cliff face |
> | an operating lever on its own arc | 0.09–9.86° of 30° | never completes the cycle |
> | **the wheel's own arbor** | **30° of 30°** | **works** |
>
> The return is the half that had to be measured rather than argued, because it
> is where the predecessor died. `tools/probe-163-driver.mjs` sweeps it against
> `userData.ratchetPoly` with the pawl's angle carried in the DRIVER's frame,
> the seat tracked from step to step rather than searched globally, and a
> positive control that lands at 2.66e-15. At the derived post radius —
> `tip + CLEAR_MARGIN + the pawl's BOSS` = 7.06710 — the pivot rises through the
> skirt's own band, so what stands there must clear the tips, and the largest
> thing on that pivot is the boss, not the post inside it — the pawl
> lifts 1.225 against the 1.224 it needs and the swept free region is 6.304 u².
>
> **A straight bar does not fit, and neither does a flood fill's path.** The
> free region proves SOME member exists by walking grid cells; a member somebody
> cuts is straight segments, and a straight segment cuts the corner the
> staircase went round — hand-simplifying it fouled by 0.1645. The probe now
> straightens the path greedily and verifies each run, and it re-maps the region
> requiring `w + CLEAR_MARGIN` rather than mere non-intersection, because the
> first outline that came out ran 0.0174 off a tooth tip, which is a hair and
> not a clearance. The outline that survives both is what the build cuts, and
> the build re-sweeps it: **0.1645 worst clearance over the whole return**,
> asserted at boot (§120's cycle-sweep precedent — the pose net covers the
> class, the group's own assert keeps the instance).
>
> The pawl's angle is SOLVED against the polygon at every pose, statelessly: it
> anchors at the spring's free angle — derived a full working stroke inside the
> metal, so the anchor is always blocked — and scans outward to the first free
> angle, which is the most-closed one. A tracking solve is what a probe can do
> and a tick cannot, since `setPose` visits poses in any order and a
> pose-dependent answer would make the wheel's stance a function of pose
> history, which is the residue TODO 54 exists to keep out.

### The group's other two outputs, recorded rather than re-filed

**The lock brake** is genuinely column-driven (`['Alarm switch', 'Alarm lock']`
is a drive edge) and §102 gave it the return blade TODO 31 prescribed, so the
lever is honest in both directions. Its remaining gap is upstream of this
group: the RELEASE — follower nose into the heart's notch — reaches the lever
through no linkage at all, which `MECH_GRAPH.todo` already declares (*"no
physical linkage carries the drop"*, with the co-rotation constraint and the
roadmap entry that owns the design). Named here so a reader auditing this group
finds it, not re-filed.

**The §45 silence chain** is crown-driven and out of this group. Its one
overlap with the work below: an axis that pulls and releases the alarm crown is
TODO 64's prerequisite, and an axis that presses the pusher is this item's, and
both are the same kind of change to `setPose`. Whoever writes the first should
read the other, because the second is then nearly free.

### What closing this looks like — the first step gates the rest

1. **DONE (§160) — the `alarmPress` axis.** The stroke is in the pose net: the
   tick's press law is a NO-OP at zero dt (it used to hard-assign, `: 1` while
   stroking and `else … = 0` otherwise, so every posed stroke was flattened to
   the seat AFTER the carry block had already turned the wheel with it — that
   clobber was the whole blocker), and `setPose` takes `alarmPressCycle`,
   spanning a whole actuation: 0 → 1 the head goes in, 1 → 2 its spring returns
   it. The bank is DERIVED from the cycle, never accumulated, which is what
   makes this axis index-sliceable where `alarmToggle` is not — proven, not
   asserted: visiting the axis's indices out of order without re-entering
   reproduces the forward walk exactly, and entering fresh at any index does
   too. **One key, not two, because the head at half travel is two different
   machines depending on its direction** — coming back, the wheel stands a
   whole tooth on from where it went in.

   Measured on the built tree as the axis walks it: travel peaks at
   `ALARM_PUSH_TRAVEL` (2.68606) mid-cycle and returns to 0, the wheel banks
   exactly one `ALARM_COL_STEP` (0.523599), parity flips once. The costs the
   filing predicted all landed — `axisEntry` 156 → **182** ordered pairs,
   `digestPoses` 39 → **43**, three slice rosters declared, swept poses
   1827 → **1892** — and the live path is untouched: `probe-87-press.mjs`'s
   trace is byte-identical before and after the tick change.
2. **DONE — `tools/probe-87-press.mjs`.** It steps the shipped tick through two
   presses and reports the pawl ⇄ skirt reading every frame, both strokes, and
   it confirmed finding 1's arithmetic to five figures (the blockquote above
   carries the numbers and the two methodological traps it had to clear). It
   needs no axis: `#btn-alarm` is the public door to `pressAlarmPusher`, and
   `step(dt)` feeds a real `rawDt` where `setPose` feeds zero. That does NOT
   retire step 1 — a probe measures one trajectory on demand, where an axis puts
   the stroke in the pose net so every sweep in the battery sees it, which is
   what makes the finding a REGRESSION gate rather than a one-off reading.
3. **DONE (§163) — the drive contact is a contact, and the member that was
   0.7615 inside the saw is gone.** The step read "give the pawl the freedom a
   pawl has — a pivot and a return spring", which finding 7 showed was
   necessary and nowhere near sufficient. What shipped is a sprung, shaped pawl
   on a DRIVER pivoted on the column wheel's own arbor, reached from the pusher
   by a PIN IN A RADIAL SLOT. Findings 1, 6 and 7 close with it; their own
   blocks carry the measurements.

   **Three things this step changed that the filing did not predict**, each of
   them a number that was chosen and turned out not to be free:

   - **The offset moved twice.** `travel ÷ step` = 5.13 is the right derivation
     for a rigid pawl and the wrong question for a coupling: a radial slot makes
     the driver's angle the pin's AZIMUTH, so one tooth needs
     `travel / (2·tan(step/2))` = 5.01226 with the stroke straddling the foot of
     the perpendicular. 5.13 would deliver 29.3415° of the 30.000° a tooth
     needs, minimised over every start position — a floor, not a placement.
   - **The spring is solved, and the first cut proved why.** Choosing its length
     and bear station measured a return drag of 3.89e-1 N·mm against the click's
     3.34e-2 N·mm detent — 11.6× over, a spring that would drag the wheel back
     on every release. Its bear station is the pivot boss's edge (a strain solve
     answered 0.1137, INSIDE the boss, where a blade would work at the boss's
     radius and make every number downstream a fiction), and its length is the
     greater of two floors — the drag budget's 3.987 and its own strain limit's
     4.287. The strain governs, so the drag lands at 3.73× the detent rather
     than the 3× minimum: what a governing constraint always buys.

     **SUPERSEDED by §169** — see findings 8 and 9 below. Every sentence above
     is still true of the blade and none of it answered the question the blade
     got wrong, which was where its ANCHOR went. The pawl is sprung by a
     torsion coil on its own post now: coaxial with the pivot, so there is no
     anchor arm to place and no bear arm in the force path, and the same two
     floors re-read as floors on developed length give 6.5 turns at 3.11× the
     detent.
   - **The pivot's azimuth on the driver is a P3 choice at a 30° quantum.** The
     seats sit at fixed azimuths in the wheel, so the branches are one tooth
     apart, and three of the twelve foul the metal already standing in the
     pawl's band. Measured, at the derived pivot radius:

     | branch | clearance |
     |---|---|
     | +9.35° | **−0.5216** |
     | −20.65° | **−0.4891** |
     | +39.35° | **−0.0957** |
     | **−50.65°** | **+2.9566** ← built |
     | the other eight | nothing within reach |

     The build sweeps the pawl through its whole return on EVERY branch and
     takes the most compact one that clears amply — position space, at the
     quantum the saw itself supplies. Clearance decides and compactness breaks
     the tie, because ranking eight equally-unreachable branches by distance
     picks whichever the polygon listed first, which is a choice made by
     iteration order.

   **And the two instruments that were agreeing with themselves.** Both were
   caught by measurement, and both are the same shape of error:

   - **The pivot's radius was derived against the POST** — `tip + CLEAR_MARGIN
     + STOCK_MIN_R10` = 6.70048 — when the largest thing centred on that pivot
     is the BOSS the post runs in. The built pawl measured **0.0956 inside the
     saw** at f 0.604. What let it through is that the build's own outline
     sweep swept the pawl's two body outlines and not its boss: a sweep that
     does not cover a member cannot see that member. Deriving a clearance from
     the wrong member of a joint is finding 6's own mistake at a different
     station. Re-derived at 7.06710, the return is *stronger* — free region
     7.136 u² against 6.304 — and the acceptance test reads 0 vertices inside
     at every pose.
   - **The branch scan was measuring air.** It collected obstacle vertices
     lying INSIDE the pawl's 0.317 band, and a post that crosses that band has
     vertices only at its two ends, both outside it — MODELING.md rule 5's trap,
     in the instrument rather than in a sweep. Every branch read equally clear
     and the "choice" was the polygon's listing order. It reads z RANGES now,
     an empty scan is itself a warning ("no obstacles" and "no measurement"
     look identical from outside), and the wheel's own bodies are excluded
     because the nose is *meant* to be in the teeth — left in, the saw
     saturates every branch at 0 and the scan chooses nothing.

   **Its acceptance test moved with it.** `tools/probe-87-pawl.mjs` selected one
   mesh named `alarmPusherPawl`; the pawl now ships as three bodies plus a nose
   disc (the arm is CLIPPED off its own pivot bore, since a post wider than a
   2w arm would pass through the arm's flanks whatever hole was cut), so the
   probe measures ALL of them and reports the nose apart as the declared
   contact. A member that clears the saw in three pieces and fouls it in a
   fourth has not cleared it.

4. **DONE — the blanket is split and both false rows are corrected.** The
   wheel's three bodies are named at the builder (`alarmColBase`,
   `alarmColCastellations`, `alarmColSkirt`), so the selectors say which body
   they mean: the stud carries the base, the pawl parks on the skirt, the click
   and the two beaks ride the castellations. **Splitting it immediately found a
   second joint the blanket had been covering** — the SKIRT's bore rides the
   same stud as the base's, which one row reading "column wheel on its stud"
   could not say and now two rows do. The castellations stand at `colInner`,
   clear of the stud, and get no row: the difference a blanket cannot express.

   The boss is a bearing now rather than a "return coil": `ALARM_PUSH_GUIDE_BORE
   = ALARM_PUSH_STEM_R + PIVOT_BORE_CLEAR`, with the ring radius following the
   bore instead of leading it. Measured after: **0 samples inside at every press
   fraction and a 0.05 gap at each**, where the literal pair bored 0.24 against
   a 0.32 stem. That also promotes finding 3's first half from arithmetic to
   measurement; its second half — the single bearing station and the cantilever
   past it — is untouched.
5. **Declare the pusher's return honestly — and the "cheap half" this step
   used to describe DOES NOT EXIST.** It read "a second `declareRestoring` is
   the cheap half". There is no second declaration: `declaredRestoring` is a
   Map keyed by unit NAME and its first line is
   `if (declaredRestoring.has(name)) console.warn('§48: … declared twice')`,
   so a second call for `Alarm switch` is boot noise, not a declaration. The
   audit structurally admits ONE restoring answer per unit.

   That is finding 4's granularity gap in the code rather than in prose, and it
   means the step has two real halves, neither cheap: **§48's model has to key
   by MEMBER, not by unit** (a change to the audit's data shape, its ~18
   existing declarations and its check), and **the pusher's return has to exist
   as metal** — today it is `ALARM_RETURN_S`, a settling time. The geometry is
   sited: a fixed abutment hanging from the plate's underside inboard of a
   collar on the stem, blade between them, which is how a case pusher's return
   actually works and what the stem's long free run between the riser (s ≈ 7.9)
   and the guide boss (s = `plateR − 1.2`) has room for.

   **Tier one is DONE (§162) — the audit asks per BODY now.** The key is
   `(unit, member)`, the bodies are derived by `clusterByFrame` rather than
   listed, and the movement measures 40 of them against the 24 answers the
   unit-keyed map held. The pusher is one of the four with no answer at all,
   waived citing this item, and `Alarm switch` is the tier's gated scope — so
   the second half is no longer a thing the instrument is silent about, it is a
   row that fails the moment its waiver is deleted. Finding 4 carries the
   numbers and the residue.

   **Tier two is DONE (§164) — the return is metal, and the waiver table is
   empty.** A collar on the stem, a fixed abutment hung off the plate's
   underside, and a spring between them, exactly as sited. Three corrections to
   the siting, all of them measured rather than argued:

   - **A COIL, not a blade.** The item said blade, and a blade must take the
     WHOLE press travel as its tip deflection: at `SPRING_FLAT_U` stock and
     `SPRING_STRAIN_MAX` that wants a free length of `sqrt(1.5·c·δ/ε)` =
     **11.53 u** against the **9.4** the run has, before any clearance. A helix
     stores the stroke in its pitch instead of one beam's curvature, which is
     why every real case pusher has one.
   - **The run is not the run this step measured.** §163 took the riser from
     the stem's inner end all the way in to the pin's station, so "between the
     riser (s ≈ 7.9) and the guide boss" now reads as between the STEM's inner
     end and the boss. Re-measured by `tools/probe-164-return.mjs`.
   - **The bracket cannot climb at the abutment's radius.** Between the stem's
     bore and the plate's underside there is 0.39, and a leg at §50's floor
     wants its own width plus a margin off each. It reaches out past the coil
     first and climbs in the corridor the probe measures at 2+ units clear.

   Every dimension is a consequence. The wire is the round analogue of the
   movement's own spring stock; the mean coil radius is the stem plus a running
   clearance plus half the wire; the **coil count is a FLOOR from the shear the
   wire may work to at full stroke** — `τ = K·G·d·δ / (π·D²·n)` falls as `n`
   rises, so **37 coils** is what the stress allows and not what fitted, solved
   to a fixed point because the deflection includes a preload that depends on
   the rate that depends on `n`. The **preload is `ALARM_SPRING_HEADROOM` × the
   5.65 mN the pawl's own spring drags back through §163's coupling** = 16.94 mN
   (§169 re-solved the pawl's spring as a torsion coil and this followed it — 35
   coils, 47.60 N/m and 14.15 mN were the figures against §163's blade).
   The free length is solid + preload + travel + one `CLEAR_MARGIN` of clash.

   | quantity | value |
   |---|---|
   | rate | **45.02 N/m** |
   | shear at full press | **454.5 MPa** against `SPRING_TAU_Y_PA` 461.9 |
   | press force at the bottom | **62.8 mN** against `CASE_PUSHER_INPUT_N`'s 1–5 N |
   | return time | **1.103 ms** |

   **And the settling time became arithmetic**, which is the half of this step
   that was never about geometry. `ALARM_RETURN_S` asserted that "an unloaded
   spring returns at least as fast as a deliberate press"; there is a spring
   now, so a quarter period on the pusher's own summed mass is 1.103 ms against
   the tick's 0.12 s — **conservative by 109×**. The tick keeps its human-scale
   bound, because a real return is damped by friction this movement does not
   model, but the claim is no longer an assertion.

   Two things worth recording about the build rather than the part. The coil is
   drawn as FRAMES (the mainspring's precedent) because the collar travels the
   whole stroke toward the abutment and a coil drawn once ends up a third of
   the way inside it — and a morph counts as motion, so the audit then asks
   what restores the coil itself. It answers `two-way`: captive between two
   faces it never leaves, its length a function of the press and not a state it
   can be left in. And the preload deflection came out in METRES (0.000229)
   while every length around it was model units (0.604), which under-counted
   the deflection the coil count is solved for and drew the spring at its free
   length — caught by, and now guarded by, a round-trip assert: squeezing the
   coil from free to installed must give back the force the drag budget asked
   for, or the two halves describe different springs.

**What this item measured and what it computed.** As filed, findings 1 and 3
were arithmetic on the shipped constants — re-run from `ALARM_PUSH_TRAVEL`,
`ALARM_PAWL_ARM`, `ALARM_COL_STEP`, `ALARM_PUSH_STEM_R` and the boss's own
torus parameters — and not measurements of the built mesh. **Finding 1 is now
MEASURED** (`tools/probe-87-press.mjs`, the blockquote in §1): 117.39% and
0.39794 u off the tree, against 117.4% and 0.398 computed, which is the
agreement this repo counts as evidence. **Finding 3 is still arithmetic** — the
0.08 u bore interference and the boss's single station have not been measured
on the built mesh, and saying so is the difference between this item and one
that quietly promotes everything because one number came back. Finding 2's
numbers are TODO 82's, measured there. Taken 2026-08-23; per TODO 20's own history note, quote a measurement
with the tree it came from or expect to re-take it.

### 8, 9 and 10 (2026-08-25) — three defects, two eye-reported, all CLOSED by §169

Filed here rather than as a new item because both are §163's, both were caught
by a reader looking at the movement rather than by any instrument, and both are
fixed; `docs/BUILT.md` §169 carries the build. What they are worth keeping in
this file is WHY the battery was green over them.

**8. The pawl's spring was anchored to nothing.** §163 solved both of the
blade's dimensions honestly and never derived WHERE its anchor went: at
`bear − springFree` along the pawl's own axis, and the pawl's nose points
inboard, so "behind the pivot" points outboard. The stud stood at **r 11.378**
from the arbor against a driver whose outline reaches **7.550** — measured
**4.347** clear of it in 3D, with a raycast down its own axis hitting the
driver **zero** times, hanging 0.15 above the plate and turning with neither.

The instrument lesson is the part to keep. `INTRA_UNIT_CONTACTS` carried
`alarmColDriver ⇄ alarmColPawlSpringStud`, *"the pawl spring's stud standing on
the driver"* — and **a declared joint is an EXCUSE as well as a claim**, so
that row took the one pair whose measurement would have shown the gap out of
the sweep. The table's stale tier catches a selector matching NOTHING; nothing
catches a selector matching two real meshes that are nowhere near each other.
A cheap tier that would: for every `INTRA_UNIT_CONTACTS` row, measure the pair
and REPORT any whose clearance exceeds a joint's plausible span at every pose.
Not filed as work here because it belongs with item 5's tiers, below.

**9. The saw band was a stock floor, so the pawl exactly filled it.** The
ratchet skirt was extruded at `STOCK_MIN_U`, the same floor the pawl that
indexes it is cut at, so the pawl's top face was coplanar with the base disc's
underside — **0.000** clearance over the whole area it sweeps under the disc,
at every pose, 0.15 below it and nothing above. §169 makes the band a
consequence of the member it swallows (`STOCK_MIN_U + 2·CLEAR_MARGIN`) with the
pawl centred in it; measured after, 0.000 → **0.150**.

**10. And the ruler for a swept solid was measuring its envelope.** Not
eye-reported — found by diffing §169's `--report` against `origin/main`'s,
which is the reason that diff is the acceptance rather than the PASS column.
`stockCensus` measures a static mesh from its geometry-local box, which is
right for a primitive and wrong for a wire swept along a path: it reports the
space a coil occupies as the metal it is made of. §169's torsion coil read
1.35 that way and **§164's compression coil 0.87, since it shipped** — against
a 0.05 mm wire, a third of the smaller. Both cleared §50's 0.12 floor while
their stock sat well under it, and the error runs in the direction that never
fails.

§163's blade was a `BoxGeometry` and so reported 0.05 mm honestly as a waived
row. Swapping it for a coil would have traded a VISIBLE debt for an invisible
one, which is the inverse of what a waiver is for. Builders now publish
`userData.stockSection` and the census prefers it, naming the ruler it used;
both springs are back in the report as accepted debt (48 waived, 0 unwaived),
held by `tools/probe-169-stock.mjs`. **Residue, named:** every other
hand-built `BufferGeometry` in the movement is still measured by its local
box, and nothing asserts that a mesh which NEEDS a declared section has one —
the census cannot tell a swept wire from a solid block. Today the two springs
are the only swept solids; a third would inherit the wrong ruler in silence.

This one is a THIRD shape of intra-unit blind spot, and it is recorded against
item 5 rather than here: `clearances` is cross-unit and both meshes are inside
`Alarm switch`; `intraUnit` gates on `intersectsGeometry`, and two solids
sharing exactly one plane do not intersect. The tier is built to catch overlap,
and **a zero-clearance running face is not overlap**.

## 88. The quick-set's detent is arithmetic — deliver the setting-time step through a derived compliance window

Item 58 closed as the words fix and said so in as many words: *"the
inner defect is NOT fixed, and is now stated where someone would be
misled instead."* This is the inner defect's own entry, with a design.
Today `target` is `Math.round((minuteBase + rawSetOffset +
jumpCorr)/MIN_PITCH)*MIN_PITCH` (the quick-set block in `tick` — grep
`TODO 58` in `src/main.js`), and the star turns with `mwMinuteA` —
computed FROM that quantized value — so the beak rides a profile the
display has already decided. The star, the beak and the click spring
exist as metal with an exact ride solve (`jmpRideForSeatRadius`) and a
one-sided seat law, and they FOLLOW. In the README's vocabulary:
modelled, not simulated — rule 2's own class of defect, one line below
the honest input path that closed item 3.

**Scope boundary first, because the word is spoken for.** Roadmap §4
owns "jumping minute" and its two-part bill: WHEN (a jump once per
minute while the watch RUNS — a release off the train plus an energy
story) and WHAT DRIVES IT. This item takes only the second half, at
SETTING time: the running display is untouched, no release, no
remontoir. Landing it edits §4's status note (the WHEN half remains; the
word stays unearned there) — that reconciliation is part of this item.

**Why the fix is not "settle to the nearest valley".** With rigid
gearing crown→minute wheel, a causal star simply FOLLOWS the crown
continuously — no step at all. The real mechanism steps because the star
can run ahead of the crown inside a COMPLIANCE WINDOW — the setting
chain's mesh backlash on the crown side, the cannon pinion's friction
coupling protecting the train side — and the click spring's tangential
component on the V flank spends that window snapping the star to the
valley. The missing quantity is the window, and it is derivable:

- `SET_BACKLASH` — the compliance at the minute wheel, summed from the
  per-mesh backlash allowances of the setting chain (setting wheel →
  minute-arbor compound → minute wheel), each a function of that mesh's
  module with the allowance convention named in the comment (rule 1),
  each reflected to the minute wheel through its ratio. A number someone
  can re-derive, not a knob. Boot assert beside it: `SET_BACKLASH <
  STAR_PITCH` at the minute wheel — a window wider than a pitch makes
  the equilibrium below ambiguous.

**The tick surgery is local to the `target` line.** `rawSetOffset` (the
simulated input) stays exactly as derived. `target` becomes the detent
EQUILIBRIUM: the nearest valley reachable within ±`SET_BACKLASH/2` of
the raw angle — and when no valley is in the window, the display is
PINNED at the window edge, riding the flank (the spring holds the beak
against the V; the crown holds the window). As the crown advances, the
valley leaves the window, the display climbs the flank pinned at the
edge, and when the next valley enters, the equilibrium jumps — a step
delivered by the spring across a real compliance band. The spring's
flank-side sign decides which valley when the window straddles a tip.
Everything else keeps its semantics verbatim: the `jumpDisp` ease stays
as the settle dynamic (`CAM_SNAP_TAU`, until the arithmetic below
derives it), the push-in fold into `jumpCorr` stays, and `jumpSnapIdx`
derives from the equilibrium's valley index — identical at rest to
today's, so the sound block's edge source does not move.

**Zero-dt and the sweeps are safe by construction.** The structure is
unchanged: `target` is a pure function of pose-visible inputs, and
`jumpDisp` is eased state that cannot move at zero dt — CLAUDE.md's trap
holds exactly as before, the `jumperEngage` axis keeps its meaning, and
`sweepHold` is untouched. The beak-ride block below the quantizer is
untouched too; what changes is its EPISTEMIC status: the star turns with
an angle that IS the spring-and-profile equilibrium, so cause and
follower agree by construction and the §48 declaration's text becomes
literally true.

**Step 1 stands alone even if nothing else lands: the detent-force
arithmetic** (P1, item 16's format; §137 priced five such paths in
place, each beside its site — the alarm `switchClickSpring` block is
the closest template — and the minute jumper's click spring still has
none). The spring's declared section (0.2 u ⌀ ≈ 0.075 mm wire,
`jumperClickSpring`, item 12-waived stock), its arc and working arm from
the build, deflection at the seat (`CLEAR_MARGIN/JMP_TIP_SEAT_R` of
over-travel), the 40° flank splitting radial from tangential → holding
torque at the star → reflected through `MW_RATIO_1` and the keyless
ratios to a detent torque at the crown, against the 5–50 mN real-detent
window. A number outside the window is a finding FILED HERE, not a
silent re-section. The same arithmetic prices the settle time, which is
what would let `CAM_SNAP_TAU = 0.06` stop being declared by feel.

**Validation, when the surgery lands.** The `Motion works ⇄ Minute
jumper` penetration row (maxDepth 0.03, axis `jumperEngage`) must be
re-measured per its own comment's rAF-freeze protocol — flank-pinned
states are NEW reachable poses; at snapped rest the star still sits on
pitch multiples, so the worst case should hold, and the `--report` diff
is the acceptance. Plus a `step(dt)` probe: drive `setCrownRotation`
slowly across three pitches; acceptance is the step profile
(flank-pinned climb, snap as the valley enters the window) and no
spring-back on push-in.

**Reconciliation owed on landing:** the §1 block header (grep
`MINUTE QUICK-SET, DETENTED DISPLAY`) and the tick comment that cites
item 58; a note
on item 58's record here; roadmap §4's status note; `explain.html`'s
honesty ledger (≈2 blocks × 5 locales — `--extract`, retranslate,
`--check`); a dated addendum on BUILT §1. The identifier freeze holds
throughout: `'Minute jumper'`, `jmp*`, `jumperLever`, `jumpDisp` are
load-bearing strings (`inspect.js` couples by string) and none of this
renames them.

## 89. BUILT §1's unpaid hardening bill — promised asserts, underived constants, uncovered instrument rows

A 2026-08-21 robustness pass over the minute quick-set (the same
investigation that filed item 88) found §1 carrying debt in four
denominations, catalogued per-row (item 12's convention — do not
bulk-edit). None of it moves geometry BY INTENT; the rows that could
move it are marked and each is its own `--report`-diffed landing.

### The asserts §1's own step 5 promised and never got — LANDED, with one refusal

**Done 2026-08-24.** Two of the three are written and each was PROVEN TO
FIRE before landing (item 60's standard): the aim's tip is re-checked
against the seat within `JMP_AIM_BAND` from outside the scan that produced
it, and the released beak's clearance is re-evaluated outside the lift
solve in the `+ JMP_BIND_EPS` form. **This item's own spec for that second
assert was WRONG and is corrected here**: it said
`≥ STAR_R + CLEAR_MARGIN`, but the solver accepts by
`≥ STAR_R + CLEAR_MARGIN + JMP_BIND_EPS`, so the filed form would have
passed on exactly the boot where the solve just failed and fell back.
The bound is one name now (`JMP_LIFT_CLEAR_R`) and `minRAt` is hoisted
(`jmpMinRAt`), so the check and the thing it checks cannot drift.

**The valley-seat assert was REFUSED, because it cannot fail.**
`minuteStar.rotation.z` is assigned `JMP_TIP_AZ − STAR_PITCH/2`, so the
tick's own `u` at `JMP_TIP_AZ` is 0.5 by algebra — measured
`0.500000000`. An assert that is true by construction is not a check, so
the seat is guarded where it CAN fail (the aim above) and the tautology
is written at the site so nobody re-files it.

**The lifter plane was three sites, not the two this item filed** — the
bar's centre, the setting lever's drop pin, and the jumper's tail pin.
Rather than assert that three copies agree, they now read one name
(`Z_JMP_PIN_FACE`).

### The asserts, as originally filed

`docs/BUILT.md` §1 step 5 asked for three boot asserts; only the third
(pitch × points ≡ one minute-hand minute) exists, as the `STAR_POINTS`
integer warn. The star's phase is set correct-by-construction
(`minuteStar.rotation.z = JMP_TIP_AZ − STAR_PITCH/2`) and then never
verified. Rule 6 form — `console.warn` with achieved vs required:

- **Valley seat**: at `mwMinuteA = 0`, evaluate the tick's own profile
  arithmetic — `u` at `JMP_TIP_AZ` must sit at 0.5 within tolerance,
  and the solved aim's tip radius on `JMP_TIP_SEAT_R` within the aim
  scan's own 0.02 acceptance band. Catches a re-phased star, a moved
  `JMP_TIP_AZ`, or an aim-scan fallback that today warns only from
  inside its IIFE on the boot where it first fires.
- **Crown-in lift**: re-evaluate the lift constraint
  (`minRAt(JMP_LIFT_SIGN·JMP_LIFT_ROT) ≥ STAR_R + CLEAR_MARGIN`)
  OUTSIDE the lift solver — its fallback branch returns an apex-only
  lift that explicitly does not meet the constraint, and only an
  external assert keeps that loud on every subsequent boot. Beside it,
  assert the two sites that derive the lifter plane (`Z_JMP_LIFTER` and
  the tail pin's end) still agree — the same expression lives in two
  places today.
- **Engage threshold vs the metal**: `jmpEngaged = crownPullT > 0.5` is
  a bare latch. Assert that at `crownPullT = 0.5` the beak's lifted tip
  is already inside the star's tip circle (the latch engages no earlier
  than the metal does), and write the true touch-fraction's derivation
  in the comment; if it lands far from 0.5, that is a row here.

  **IT LANDS FAR FROM 0.5, AND THIS IS THE ROW. MEASURED 2026-08-24:**
  the beak first reaches the star's tip circle at **crownPullT ≈ 0.8630**
  (`jmpMinRAt(JMP_LIFT_SIGN·(1−f)·JMP_LIFT_ROT) < STAR_R`, swept at
  f-step 0.0005), while the latch fires at **0.5**. So across roughly
  **36% of the crown's pull** the display is being QUANTIZED — the
  detent is "engaged", minutes snap to whole indices — while the jumper
  is measurably not touching the star. At the latch point the beak's
  nearest outline point stands at 4.0946 against a tip circle of 4.0312:
  **0.063 of clear air.** The mechanism's own honesty ledger says the
  star and beak follow the display rather than delivering it (item 88);
  this measures a pose range where they are not even in contact while it
  does so.

  **No assert was shipped for this, deliberately.** It would fire on a
  healthy tree, and boot silence is standing rule 6 — an assert is not
  the place to announce a known defect. The assert lands WITH the fix,
  which is one of: derive the latch from the touch fraction (cheap, but
  it changes when quantization starts, so it is a behaviour change and
  belongs with item 88's tick-law work), or re-derive the lift so the
  beak is in the star by half-pull (that MOVES geometry). Either way the
  number above is the target, and `jmpMinRAt` is now hoisted so the
  assert is two lines once the fix exists.

### Underived constants, split by risk

Zero-movement — derivable or nameable in place, one landing. **All four
LANDED 2026-08-24**, fingerprint unmoved; per-row notes inline below:

- `JMP_REACH = JMP_LEVER − JMP_W * 0.45`: the 0.45 IS `0.9/2` —
  `makeJumper`'s own tip-cone proportion. Export the fraction from the
  builder and consume it; the builder and the placement solve stop
  being able to drift apart, and the value is bit-identical.
- `JMP_TIP_SEAT_R`'s 0.5: name it (`STAR_SEAT_FRAC`) with its
  constraint — ride the flanks, never the root fillet — which the
  comment already argues.
- **DONE** (fragment deleted; the `0.35` stays rowed and is now
  DEFENDED-AS-UNDERIVED at the site, which is the honest outcome:
  `rootR` already subtracts the mate's addendum plus cycloidal clearance,
  so the 0.35 is EXTRA daylight below where the cannon pinion's teeth
  actually reach, and nothing reproduces its size — it is 2.3×
  `CLEAR_MARGIN`. Deriving it MOVES the star and everything scanned from
  it, so it is a re-solve, not a rename.)
- `STAR_R`'s ORIGINAL comment is GARBLED and is now also redundant:
  *"the star must never be / the mesh"* drops its verb, and §136 wrote a
  correct statement of the same constraint immediately below it while
  leaving the broken one standing — two comments, one of them a
  fragment. Delete the fragment. §136 also closed the arithmetic half of
  this row: the dedendum is no longer restated by hand as
  `MW_MODULE_1 · 1.15` but taken from `gearToothSpec(...).rootR`, which
  follows the mate graph. What survives is the trailing bare `0.35` —
  state its constraint honestly (radial daylight below the root land),
  or row it below.
- The bearing scan's tuning (obstacle pad 1.2, the `min(clr, 2)`
  saturation, the `capD · 0.02` tiebreak): write the constraints — what
  the pad must contain, why clearance saturates, the preference order —
  and pin the output: `JMP_AZ` must still scan to 320°.
  **DONE, and the pin found a defect: the station is 326°, not 320°.**
  §136 re-derived `STAR_R` from the cut spec's own root circle, which
  moved `JMP_PIV_R = STAR_R + 2.4`, which re-ran this scan — a
  TOOTH-PROFILE landing silently re-sited a mechanism part, and three
  source comments plus this file went on claiming 320°. The scan's own
  header warns that a DIAL parameter reaches a mechanism part through it;
  the reach is wider than that. The output is now a TRIPWIRE, not an
  equality gate — the scan is *allowed* to re-site the jumper, so it warns
  on the move with the measured value rather than forbidding it. The stale
  320° claims are corrected at the scan; the §33-era sentence at the wells
  is left as history.
  **Not fixed here: the lifter's run was never re-verified against the
  moved station**, which is what the tripwire exists to prompt.

Movement-risking — each its own landing, `--report` diff the acceptance:

- `JMP_PIV_R = STAR_R + 2.4` — "~2 beak lengths" is justification after
  the fact. A real derivation will not land on 2.4, and moving it
  re-runs the bearing scan, the aim scan, the lift solve and the 0.03
  penetration row.
- The tail bar / tail pin / stud / spring stretch (the run from
  `jumperTailPin`'s build to `jumperClickSpring`) — the least-derived
  run in the block. Item 12 already carries the jumper's stock rows;
  this is the geometry beside them.
- `JMP_BIND_EPS = 0.01` — item 10's closure records its effect as
  undistinguished from tessellation sag. Either distinguish it or
  retire it.

### The uncovered instrument rows

All three `Minute jumper` EXPECTED pairs (`⇄ Motion works`, `⇄ Dial`,
`⇄ Setting lever`) have no `EXPECTED_CONTACT_FLOORS` row — item 6's
blanket excuse, everywhere except the star⇄beak penetration budget.
Seed them per the table's discipline (measure FIRST, then declare):
contacts `star ⇄ jumperBeak` for the first two (the star reaches the
Dial pair through the nesting), the lifter bar ⇄ tail post for the
third. A sub-margin finding is a finding — waive citing its item or fix
it; never size the min to the defect.

### The claims nothing gates

- `explain.html` quotes the mechanism's headline number as "(0.1500,
  exactly one `CLEAR_MARGIN`)" — the number BEFORE the identifier,
  which matches none of `tools/explain-quotes.mjs`'s extractor
  patterns. The page's own header promises its numbers are compared
  against source; this one is not, and would drift silently if
  `CLEAR_MARGIN` or the `JMP_LIFT_ROT` solve ever moved. Reshape the
  sentence identifier-first (cost: that block × five locales,
  `--extract`, retranslate, `--check`).
- `docs/BUILT.md` §1's Mechanism bullet still says "60-point star"
  while its own next clause and the shipped code derive 180 — and §1 is
  still written in plan form; reconcile it when the step-5 asserts land
  (CLAUDE.md's reconciliation rule).
- `SPEC.md` declares no keyless works, no setting path, no
  `makeStarWheel`/`makeJumper` — the whole mechanism grew outside the
  architecture contract. Fold it in. The README's feature list omits
  the quick-set; one line.

## 90. What the column wheel DRIVES has never been audited the way what drives IT has

TODO 87 rebuilt the input side of the alarm toggle — the pusher, the driver,
the pawl and its spring — through three sections and eleven findings. **The
output side has had none of that.** The wheel's castellations carry three
riders (the LOCK beak, which is the alarm's suppressor; the CLICK, which
indexes and reads the state; the LINK beak, which arms the selector ring), and
each of those carries a chain onward. This item is that audit, opened with one
finding already measured.

### Finding 1 (2026-08-25, MEASURED — **CLOSED by §171**) — the lock beak's riser is inside the saw

Eye-reported as *"a phantom / vestigial steel arm that collides with the column
wheel every other toggle"*. Measured off the built tree with
`tools/probe-colwheel-foul.mjs` and `tools/probe-lockriser-depth.mjs`:

| | |
|---|---|
| `alarmLockBeakRiser` | ⌀ 0.28 rod, z **9.4028 .. 12.0374** |
| `alarmColSkirt` (the saw) | z **10.4407 .. 11.0574** |
| shared z | **0.6167** — the rod passes clean through the tooth band |
| worst in-plane depth, against `ratchetPoly` | **0.2144**, at press cycle 0.958 |
| parities | the same at `alarmOn` 0 and 1 |

The riser's AXIS crosses inside the polygon the teeth were cut from, so this is
not a graze — the rod occupies the saw's metal. It is a **cross-unit** pair
(`Alarm lock ⇄ Alarm switch`), so `intraUnit` never looks at it; and that pair
is **EXPECTED**, because the beak genuinely is meant to touch the castellations.
That grants the blanket excuse to *every* mesh in both units — which is
**TODO 6's named residue, arriving as a real defect**: an EXPECTED pair with no
`EXPECTED_CONTACT_FLOORS` row excuses metal that has no business anywhere near
the other unit. Seeding a floors row for this pair, with the beak⇄castellation
meshes named as the declared contact, is the fix that also closes the hole.

**Two method notes, because both cost a measurement here.** The riser is a
`CylinderGeometry` with `heightSegments 1`, so every vertex it owns sits at one
of the two end rings and NONE inside the saw's band: the first cut of the depth
probe read `0 of 0 vertices` and would have reported the defect as absent —
MODELING.md rule 5, in the instrument rather than the model, for the second time
this month (§169's `probe-87-pawl` fix was the first). The rod's footprint is a
DISC about its axis and that is what must be tested. And `meshClearance` clamps
at 0, so it cannot tell *touching* from *buried* — the depth had to be taken
against `ratchetPoly` in the wheel's own frame, `probe-87-pawl`'s method.

**Established since (same day), and it decides the fix.** The worst-over-the-
press reading is identical at both parities, and so is the reading AT REST —
which is the one that matters, because it is what a viewer sees between
presses, and because the saw has 12 teeth to the castellations' 6 columns, so
the SAW repeats every press while the LOCK, which reads columns, alternates. If
anything alternated it would show there. Nothing does:

| | alarmOn = 0 | alarmOn = 1 |
|---|---|---|
| worst over the press | 0.2144 | 0.2144 |
| **at rest** | **0.14**, axis INSIDE the saw at r 6.15 | **0.14**, axis INSIDE at r 6.15 |

So it **sits** in the teeth rather than moving through them, continuously, in
both alarm states. What the eye reads as "every other toggle" is the lock's own
swing making the same interpenetration more and less conspicuous — the defect
is not periodic and the repair is not a timing one.

**Which makes the fix radial, and §163 already wrote its derivation.** The riser
must cross the saw's z band — its beak is above the castellations and its pivot
below the skirt, so there is no stratum that avoids it. The only free direction
is radius, and the constraint is the one §163 derived for the pawl's own post:

```
riser radius ≥ ALARM_COL_TIP_R + CLEAR_MARGIN + its own radius
             = 6.384 + 0.15 + 0.14 = 6.674     against 6.15 today
```

0.524 outboard. The beak still has to reach the columns at ≈5.98, so it
overhangs INBOARD from a riser standing outside the tips — which is exactly the
anatomy §163 gave the driver's pawl (a post outside the tip circle carrying a
member that reaches in). Whatever this costs is a lock-lever geometry change,
so it is P0/P1 work on the `Alarm lock` group rather than a nudge.

**CLOSED by §171, at the derived station.** The riser stands at 6.674 and the
beak grew from 0.6 to `riserWheelR + riserR − ALARM_COL_BASE_R` = 1.114 to reach
back over the saw, so its inward face stays at 2.3 from the pivot and the
`alarmHandoffs` row `column outer face ⇄ lock beak` measures unchanged. The
corridor was scanned rather than assumed (`tools/probe-171-corridor.mjs`): open
from 6.674 out to ≈7.40 where the lock's own pivot post binds, so the floor is
the bottom of a 0.73-wide window rather than a squeeze. Measured after:
`meshClearance` to the skirt 0.1569, nearest skirt vertex leaving 0.15, and the
rod no longer appears in `probe-colwheel-foul`'s under-margin list at all.

**And the report diff carries the finding better than any single reading.**
`inspection`'s `Alarm lock ⇄ Alarm switch` row read *beat 97/97, crown 49/49,
reserve 61/61, wind 721/721, arrest 97/97, stemSlip 97/97, train 97/97* — in
contact at every pose of every axis, including axes that move neither unit. It
now reads *alarmPress: 10/65 poses (f 0.0781–0.2188)*: the window where the beak
kisses a column, and nothing else. That row was EXPECTED throughout, which is
precisely how `721/721` went unremarked — item 6's residue, stated as a number.

**Two things came out of the same session and belong here.** The eye report that
opened this finding also named a *second* member — `alarmSwitchBeak`, a
pre-§68 draft of the same read still bolted to the lever, wired to nothing in
`inspect.js` — deleted by §171. And deleting it broke both of the unit's
`INTRA_UNIT_CONTACTS` rows, which selected the lock's pivot post by mesh INDEX;
§171 named the post (`alarmLockPivotPost`) so those rows stop being claims about
what else the unit contains. Both are written up in `docs/BUILT.md` §171.

### Finding 2 (2026-08-25, MEASURED — **CLOSED by §172**) — the link beak's POST threads the wheel, and its BAR grazes the columns

Eye-reported and circled on the built tree: *"the part colliding"*, highlighted
as one L — a bar reaching under the wheel and a post dropping through it. That
is the `Alarm link` beak assembly, and it is finding 1's defect one rider over,
with the same two instruments blind to it for the same two reasons.

Measured with `tools/probe-90-linkbeak.mjs` (three methods, because
`meshClearance` clamps at 0 and cannot separate a kiss from a burial):

| member | z band | |
|---|---|---|
| `alarmColSkirt` (the saw) | 10.4407 .. 11.0574 | |
| `alarmColBase` | 11.0574 .. 11.7574 | |
| `alarmColCastellations` | 11.7574 .. **13.1574** | |
| `alarmLinkBeakPost` | **9.6028 .. 13.2674** | crosses the ENTIRE wheel stack |
| `alarmLinkBeakBar` | **13.1091** .. 13.4257 | bottom face 0.0483 BELOW the column tops |
| `alarmLinkBeak` (the nose) | 13.1574 .. 13.3774 | sits exactly ON the column top plane — §35's declared rest |

Worst over the whole toggle, both parities:

```
       0   alarmLinkBeakBar  ⇄ alarmColCastellations      <- undeclared
       0   alarmLinkBeak     ⇄ alarmColCastellations      <- TODO 20's declared read
  0.0929   alarmLinkBeakPost ⇄ alarmColSkirt              <- under CLEAR_MARGIN
  0.1836   alarmLinkBeakPost ⇄ alarmColBase
  0.1836   alarmLinkBeakPost ⇄ alarmColCastellations
    0.35   alarmLinkBeakTail ⇄ alarmColCastellations
```

**Neither is a burial.** With 2-of-3 independent ray agreement, ZERO vertices of
any of these members are strictly inside any wheel body: every row above is a
surface contact. That matters, because it is the difference between this and
finding 1 — the lock riser's axis was in the cut metal, and this rod is not.

**What it IS.** The post stands at wheel-radius **6.05** against saw tips at
`ALARM_COL_TIP_R` **6.384**, so it is inside the tip circle and threads the gaps
between the teeth and between the columns for the whole 3.66 of its height. It
clears — by 0.0929 at the tightest — but a rod inside the wheel's own silhouette
is what an eye correctly reads as a collision, and 0.0929 is under
`CLEAR_MARGIN` besides. §171's rule gives its floor as

```
ALARM_COL_TIP_R + CLEAR_MARGIN + its own radius = 6.384 + 0.15 + 0.1665 = 6.7005
```

**0.65 outboard of where it stands.** And the bar dips 0.0483 into the
castellation band, so the lever BODY rides the columns alongside the nose that
is supposed to be the only thing reading them. `alarmLinkBeakBar` appears in
`INTRA_UNIT_CONTACTS` only as *"beak lever on its pivot post"*; nothing declares
it touching the wheel.

**Why nothing caught either row** — the same pair of holes as finding 1, which
is the argument for closing them structurally rather than one rider at a time.
`Alarm link ⇄ Alarm switch` is CROSS-UNIT, so `intraUnit` cannot look at it; and
that pair is EXPECTED because the nose genuinely reads the columns, with no
`EXPECTED_CONTACT_FLOORS` row — so TODO 6's blanket excuses every mesh in both
units. Seeding a floors row for this pair, naming `alarmLinkBeak ⇄
alarmColCastellations` as the declared contact, closes the hole and the two rows
at once.

**CLOSED by §172, and the cause was one wrong face.** `pivDist` read
`ALARM_COL_BASE_R + CLEAR_MARGIN + 0.16 + 0.04` and its own comment said what it
meant — *"post r 0.16 fully clear of the wheel's SKIRT"* — but the skirt is the
saw, whose teeth reach `ALARM_COL_TIP_R` 6.384, and the margin was taken from
the base disc 0.684 inboard of it. That is TODO 87 finding 6's mistake a third
time (§163 measured against the pawl's post, §169 against its BOSS): the
constraint right, the face wrong. Re-derived as
`ALARM_COL_TIP_R + CLEAR_MARGIN + STOCK_MIN_R10` = 6.7005, and the unexplained
`+ 0.04` retired — a margin that needs a supplement is not the margin. The bar
was lifted off the columns in the same change, by a gap SWEPT from the wheel's
own `profileAt` rather than assumed (see below). Measured after:

| | before | after |
|---|---|---|
| `alarmLinkBeakPost ⇄ alarmColSkirt` | 0.0929 | **0.1502** |
| `alarmLinkBeakBar ⇄ alarmColCastellations` | 0 | **0.3529** |
| `alarmLinkBeak ⇄ alarmColCastellations` | 0 | **0** — TODO 20's read, unmoved |
| nose underside vs the column top plane | on it | **on it**, asserted to 1e-9 |

**The static margin was not enough, and the first cut of the fix proved it.**
Built at exactly one `CLEAR_MARGIN` over the column top plane the bar still
measured **0.1283** across the toggle. Two things eat it that a plane-to-plane
figure cannot see: the arm TILTS as the nose falls (`rotation.y =
noseDrop/beakLen`), dipping every point of the bar in proportion to its distance
from the pivot; and the bar is `STOCK_MIN_U` wide against the nose's 0.18, so
its corners overhang azimuths where the flank has not dropped as far as it has
under the nose. The lift is therefore stepped through a whole column pitch at
build time — §120's cycle-sweep precedent — against `geometry.js`'s own
`profileAt`, at every radius the columns occupy and at both edges of the bar. It
asks for **0.3747** where a flat margin gives 0.15, and it re-derives if the
columns, the tier height or the bar's section move.

**The spec quantity that moved, declared rather than absorbed.** The pivot is
collinear with the wheel→rod line by construction — that is what puts the tail
over a corridor-fixed rod — so `pivDist` sets BOTH arms, and correcting it moved
the lever ratio:

| | before | after |
|---|---|---|
| `pivDist` | 6.0500 | **6.7005** |
| `beakLen` | 1.3950 | **2.0455** |
| `tailLen` | 9.9500 | **9.2995** |
| ratio | 7.133:1 | **4.546:1** |
| tail depth (`tailLen`/`SLENDER_TARGET`) | 0.3685 | **0.3444** (floor 0.3167) |

That is a LINE SPEC change and it is a FORK, not a drift: the row re-derives
from the movement constraint that forced it — the post must clear the saw it
crosses — and the constraint is written at the constant. The chain follows
without re-targeting anything, because `seatNoseDrop` is derived FROM the ring's
own `rodTravel` through this ratio rather than assigned: the nose now falls
1.57× further for the same rod travel, against an available fall of `colH` 1.4.
The ENVELOPES are inherited and were not forked — §137's tail-stall row still
lands in the 5–50 mN detent band (the §54 rule makes the tail's stiffness
length-independent, since its depth is `tailLen/27` and `k ∝ w·h³/L³`), §50's
floor still clears, and boot is silent, which is where all of those assert.

**The cost, recorded rather than left in a report that cannot fail.** Raising
the arm 0.4230 lengthened the rod it drives: `alarmLinkRod` went 7.747 → 7.907
mm, λ 34.1 → **34.8** against §54's ceiling of 30, cantilever stiffness 287.4 →
270.3 N/m. That row was already over and is waived citing TODO 16, and
`slenderness` is a REPORT — which is precisely why it is written down. The rod
is 2% longer and 6% softer as the price of the bar clearing the columns, and
that belongs in TODO 78's catalogue as a debt this change added to, not as
something the gate's silence absorbed. Nothing else was paid: no waiver added or
removed, no tolerance or budget widened, and the swept lift is the minimum the
profile allows.

**Why the repair is not finding 1's.** §171 could re-site the lock's riser
because its station was a free parameter — the beak overhung to keep its contact
face fixed. This post's station is NOT free: `beakPiv` is derived from the beak
arm's own reach to the column tops, so moving it outboard re-solves §35's arm
rather than re-siting a post, and the arm's ratio (≈7:1, the built arms measure
9.95/1.395) is a LINE SPEC quantity. That makes it P0/P1 work on the `Alarm
link` group with a spec to measure back to, not a nudge — and the bar's 0.0483
has to come out of the same solve, since raising the bar clear of the columns
moves the nose that must still reach them.

### Finding 3 (2026-08-25, MEASURED — **CLOSED by §173**) — the switch click cannot index the wheel, and its spring is 2.1 units away from the arm it is declared to press

Eye-reported as *"touching the column wheel doesn't seem sufficient to hold it
in position when the pawl's moving around"*, which is exactly right and turns
out to be the mildest of four independent failures. This is not a clearance
defect to repair; the part cannot do its stated job in any state, and three
other pieces of arithmetic are judged against a force it does not produce.

**1. There is no detent at any of the twelve stops.** The wheel indexes 12
times per revolution — `ALARM_COL_STEP` = π/6, one saw tooth, 30° per press —
and the click rides **6 columns**. Worse than the count mismatch: a detent needs
a RESTORING TORQUE, which comes from the follower being driven radially out as
the wheel turns off the stop. Sampled from the cut profile over one 60° pitch:

```
####////////.........................////////####
 8 samples on a FLAT TOP · 23 on a FLAT GAP FLOOR · 18 on a ramp  (of 49)
```

(`tools/probe-90-click.mjs` prints exactly this, with two controls — a pair that
must intersect and a pair that must not — because a test that silently does
nothing reports clean. An earlier cut of it called a helper `inspect.js` does
not export, got `null` at every pose and announced "0 intersections" having
tested nothing.)

Both flats are concentric with the wheel's axis, so the ball's radius does not
change across either, and the surface pushes it out by nothing. The two parities
land the ball mid-top and mid-gap-floor — **on the flats, not the ramps** — so
the restoring torque at every stop the wheel actually uses is **zero**, whatever
the spring behind it is worth. The source calls this "the wheel's index (the two
stable states + the click)": it reasons in TWO states, and the wheel has TWELVE.

**2. The spring never touches the arm.** Measured over the whole toggle at both
parities:

| | z band |
|---|---|
| `switchClickArm` | 12.2991 .. 12.6157 |
| `switchClickSpring` | **10.0028 .. 10.2028** |

They do not overlap. The closest they ever come is **2.0963**, at every pose.
So `INTRA_UNIT_CONTACTS`' row *"the detent blade pressing the click arm — §48-declared spring contact"* is false, and
`declareRestoring('Alarm switch', 'switchClickArm', 'spring', …, 'switchClickSpring')`
names a restoring element two units below the body it restores. **§48's audit
passed on a declaration rather than on metal** — which is the one thing that
audit exists to prevent, and it is the sharpest instance yet of this file's
standing warning that a declared joint is an EXCUSE as well as a claim.

**3. The blade is over-strained even if it did touch** — the build says so
itself, at its own construction: the root fibre carries ≈2.2 GPa against
hardened blue steel's ~1.5 GPa elastic limit, so *"a real blade would take a set
and the 15 mN would decay with it"*. Filed at TODO 63 and still open.

**4. The arm interpenetrates the columns.** Triangle-level (`intersectsGeometry`,
the test `intraUnit` itself uses, with both controls passing):
`switchClickArm` intersects `alarmColCastellations` at **110 of 130 poses** —
85% of the cycle, both parities — while `switchClickNose`, the declared reader,
intersects at **0**. The arm's row in `INTRA_UNIT_CONTACTS` calls this *"the
detent arm riding the column wheel's castellations (kiss) — a working contact"*,
and being declared is what keeps `intraUnit` from looking.

**And the figure propagates, which is why this outranks a clearance fix.**
`ALARM_CLICK_FLANK_MN` is the declared §137 transfer load for the whole switch,
the value anchoring `SELECTOR_DETENT_WINDOW_MN`, and the reference §163's build
assert checks the driver pawl's return drag against — *"because a return that
drags the wheel back un-indexes it"*. Three separate pieces of arithmetic are
judged against a detent force that has no contact to act through and no geometry
to act on.

**The repair is a redesign, and the architecture is chosen: a JUMPER ON THE
SAW.** Real chronograph practice puts the sautoir on the ratchet the operating
pawl drives, not on the columns — the columns are for READING. The saw already
has 12 teeth, one per index step, so the tooth count matches the stop count by
construction rather than by luck, and the restoring torque derives from a flank
that was actually cut. The existing click is DELETED rather than rebuilt: its
second job, the visible ON/OFF flag, is already done by the lock beak and the
link beak, and a third rider carrying no force is a part that exists only to be
looked at — here, the source of three false declarations.

### §173's LINE SPEC, solved before any metal moved — **SHIPPED, with three rows corrected**

Derived from the saw's own cut polygon (`tools/probe-90-click.mjs`'s source, the
same `ratchetPoly` the teeth were made from), so every row below is a
consequence of geometry that already exists:

| the saw, measured | |
|---|---|
| teeth | 12 — one per index step, which is the whole point |
| tip / root circle | 6.384 / 5.13, depth 1.254 |
| pitch | 30° = 3.3427 of arc at the tip circle |
| drive flank | **0.00° off radial** — a true cliff |
| ride flank | **66.21° off radial** — the long ramp |

**The tip radius is solved, not chosen** — but the constraint below is the WRONG
ONE, and the line spec is corrected in place rather than left standing with two
numbers. What it said:

```
(seat radius − tip radius) − rootR  >=  CLEAR_MARGIN     →   rTip = 0.7566
```

That reads "located by the FLANKS, not by the tooth space's floor", and the
premise does not survive contact with the polygon: a saw tooth's root is a sharp
CORNER between the cliff and the next ramp, not a floor. **A circle in a sharp V
is flank-located at every radius**, so the condition is vacuous and any tip
satisfies it. What actually binds is the wheel's own STACK. The tip works in the
saw band, under the base disc; the blade that carries it is ten units long and
the only band with room for that is above the castellations' outer wall. So a
shank crosses both upper bodies at the tip's azimuth, and at the seat — the
innermost pose — it must pass them at one running margin:

```
seatR(tipR) − STOCK_MIN_R10  >=  ALARM_COL_BASE_R + CLEAR_MARGIN   →   rTip = 0.7421
```

A bigger tip cannot reach as deep into the V, so it seats further out and the
constraint is a FLOOR on the tip. The smallest satisfying it is taken: the
deepest seat this stack allows, the steepest ramp, and so the most restoring
torque per unit of blade force. Bisected at build time against `sawSeatAt`,
because the seat is a query against the cut and not a formula.

**The spring is NOT a torsion coil**, which is the second correction. The line
spec called for §169's pattern on a jumper's own post. Priced first, as the
order of work requires: a torsion coil on the movement's one spring wire reaches
**≈2.4 mN at the flank against a 5–50 mN window**, and kθ ∝ d⁴ means
`SPRING_FLAT_U` cannot be stretched to the envelope without a second spring
material. So the shipped part is a **SAUTOIR — one piece, no pivot and no
separate spring, the blade IS the jumper**, which is also what a real
chronograph carries. Findings 3.2 and 3.3 close differently as a result: the
spring cannot be two units from the body it presses when it IS that body, and
the free length is solved from the strain limit instead of inherited.

**The flat top is FROZEN, not re-sourced** — the third correction, and the
owner's call. `ALARM_CLICK_NOSE_R` was passed to `makeColumnWheel` as
`riderNoseR` and TODO 28 derived the castellations' flat top from it, so the
deleted click's ball set a feature the link beak stands on. Re-cutting the flat
to the surviving riders was deferred; the constant is renamed
`ALARM_COL_RIDER_NOSE_R`, no longer names a part that is gone, and carries a
build assert that the flat still clears every rider that IS left. **The debt is
open**: the flat is wider than any surviving rider needs, and a future rider
must move that number rather than discover the shortfall by burying itself.

| the jumper, as SHIPPED | |
|---|---|
| tip radius | **0.7421** (⌀ 0.562 mm — real jumper-tip scale) |
| seat / crest (tip centre) | 6.0165 / 7.1261 |
| throw, on the arc the tip travels | **1.1114** |
| shank | `STOCK_MIN_R10` — the constraint that set the tip, so it cannot be thinned without re-solving it |
| blade free length | **10.4874**, solved from `SPRING_STRAIN_MAX` at the crest |
| blade section | 0.1319 (`SPRING_FLAT_U`, bending) × **0.7035** (2.22× §50's floor) |
| preload | one working throw — §169's precedent, `springTheta = 2·stroke` |
| seated / cresting force | **11.18 / 22.36 mN**, each √5 = 2.236× clear of the window it faces |
| forward detent | **3.479e-2 N·mm** about the wheel's axis |
| `dr/dθ` at the seat, forward / backward | **1.541 / 57.49 — 37× steeper** |
| drive flank / ride flank | 0.00° / 66.21° off radial, asserted off `ratchetPoly` |

**THE TIP DOES NOT TRAVEL ON A RAY, and that is the correction the acceptance
probe earned.** It is carried at a fixed distance from the anchor, so it swings
on an arc and its azimuth about the wheel drifts 0.49° over the ride.
`sawSeatAt` answers a question about a ray; sizing the blade from it and then
posing on the arc put the tip **0.0253 INTO a tooth near the crest**, which
`tools/probe-173-jumper.mjs` measured before the solve replaced it. The pose law
is now a root find against `sawClear` — the smallest swing whose tip position
clears the teeth — and the blade's length, the anchor's place, the arc and the
throw are solved as a **FIXED POINT**, since each sets the next. It converges in
a handful of passes; a build assert fires if it ever does not.

**That asymmetry is the design, not a curiosity.** The restoring torque is
`F_spring × dr/dθ`, so against the direction the pawl's return drags the wheel
the jumper meets a face 0.00° off radial: there is no radial component to cam it
out, and the wheel cannot be un-indexed backward *at all*. §163's assert —
*"because a return that drags the wheel back un-indexes it"* — stops being a
numerical argument and becomes a structural impossibility. It now compares the
drag against the jumper's FORWARD detent, the weaker direction, which makes that
budget conservative rather than generous and keeps it comparing real numbers.

**What §173 retired:** the two `INTRA_UNIT_CONTACTS` rows on the castellations,
the two on the click's post, the `switchClickArm` restoring declaration,
`STOCK_KIND_BY_MESH`'s `switchClickSpring` row, `tools/probe-59-click.mjs`, and
TODO 63's over-strain entry for this blade (the blade ceases to exist).
`ALARM_CLICK_FLANK_MN` is REPLACED: the jumper publishes a **torque**
(`ALARM_JUMPER_DETENT_NMM`) rather than a force, so the four consumers that each
re-derived one from a force and a riding radius now read one number — three
fewer chances to quote a different radius.

**AND THE FOLD WAS WRONG THE FIRST TIME — an owner's eye report, measured.**
The anchor stud was placed at the three-quarter plate's TOP FACE LEVEL and
assumed to be standing on it. It was not: at (24.29, −7.82) it stood over the
balance cutaway, on nothing. **This is §169's own finding reproduced** — that
section caught a stud in this same cluster hanging over 4.347 of air while an
`INTRA_UNIT_CONTACTS` row declared it "standing on the driver" — and §173 had
read that comment and repeated the mistake anyway.

Two things made it invisible. `support` is declared per UNIT, so a single
floating mesh inside a unit that is otherwise seated passes it in silence; and
the first raycast written to check it **started just under the foot, i.e.
INSIDE the plate solid, so front-face culling dropped the only faces it could
have hit** and reported the plate absent under two control studs as well. The
test that works casts from above with the plate double-sided, and answers
`[8.9845, 8.1845]` for a seated stud and `[]` for this one.

The fix is position-space, as the ladder requires: the blade's HAND flips so it
runs toward rising azimuth, which moves the anchor to (35.03, 10.19) on solid
plate and **leaves the tip at the station the free-window measurement chose**.
Both hands were enumerated over all twelve step counts against
`inCutClearance` before choosing. That fold's consequence was real and was
followed rather than absorbed — and then undone with the fold, so read the next
entry before quoting any of it: the arc's drift added to the ramp instead of
subtracting from it, the forward detent rose 3.479e-2 → 3.899e-2 N·mm, and
§169's instruction ("re-derive the raise, never re-target the spring") took
`ALARM_PAWL_SPRING_COILS` 6.5 → 5.5. **The SHIPPED figures are 3.479e-2 N·mm
and 6.5 turns** — this fold did not survive the corridor.

**AND THE SECOND FOLD WAS WRONG TOO** — a second eye report, and the reason it
matters more than either defect: flipping the hand to find plate put the anchor
inside the ALARM HAMMER's swing, 0.000 clear of `alarmHammerArm` through the
strike. Two folds in a row, each chosen against ONE constraint and each fine
from inside it.

`tools/probe-173-fold.mjs` is what replaces choosing: all 24 (step, hand) pairs
against seating, corridor and band TOGETHER, over 16 poses, printing the whole
table rather than the winner — a search whose losers are invisible is a claim
nobody can re-check. Its own trap is recorded in it: the plates must be left
OUT of the corridor measurement, because the stud is meant to touch them, and
with them in the scan ranked the candidates over the CUTAWAY as roomiest.

Taken: **steps 5, hand −1** — tip at 269.2° inside the 161° free window, anchor
at (13.92, −1.60) on plate with **9.507** of corridor, blade sweeping 269° → 209°
in the band above the castellations, which is free precisely because §173
deleted the click that used to occupy 228.9°–276.9° there.

**One honest round trip, recorded rather than hidden.** The middle fold's mirror
made the arc's drift add to the ramp, the detent rose 3.479e-2 → 3.899e-2 N·mm,
and §169's coil solved one turn shorter — so `ALARM_PAWL_SPRING_COILS` went
6.5 → 5.5. The surviving fold runs the original way, so both figures return to
where they were. §169's instruction ("re-derive the raise, never re-target the
spring") was followed in both directions.

**Why the stud was at that z in the first place**, since the owner asked: it was
not avoiding the plate, it was aiming at it. The foot was set to `TQ_TOP_Z`,
copied from the deleted click's own post, and that constant is the plate's TOP
FACE. The height was deliberate and right; the (x, y) was never asked. **A
z-datum named after a plate reads like a seating guarantee and is only a
height** — which is the generalisable half of this finding, and why the assert
below tests the plane rather than the level.

**The assert that would have caught it now exists**: the anchor needs its own
foot radius plus a margin of solid plate by `inCutClearance`, and the same
against the plate's rim. Writing it is the structural half of the fix —
re-siting the stud without it would only move the class of failure.

**The cam disk was checked at the same time and is NOT a defect.** Measured
mesh-to-mesh rather than through the polygon law it was designed to: the built
tip's nearest approach to the built skirt is 2e-05 at worst and never negative,
and a parity raycast puts 0 of 144 samples inside the metal. It is SEATED —
touching two flanks is a detent's whole job — which at a shallow viewing angle
reads as overlap. The residue worth naming is the other way: near the crest the
tip's 24-segment cylinder stands up to 0.0143 clear of the metal the law has it
touching, which is the polygon approximating its own circle.

**What §173 leaves open**, named rather than absorbed:

- **The frozen flat top**, above.
- **The blade's mesh is rigid.** It rotates about its anchor so that its free
  end lands exactly where the solve puts it — the tip's POSITION is right at
  every pose and the FORCE law is the true 3EI/L³ — but a real cantilever bows,
  and the shipped mesh does not. The tip's slope is therefore wrong by the
  cantilever's 3/2, which nothing reads. A morphing blade would close it
  (`spiralFrames`' precedent) at the cost of a new MM frame in `intraUnit`.
- **`intersectsGeometry` is not symmetric here.** Shank-as-owner reports the
  shank meeting the skirt; skirt-as-owner reports it does not; the axis
  measurement says 0.5756 of clearance. `intersectsGeometry` falls back to a
  CONTAINMENT test when no triangles cross, and a small owner holding a large
  other answers that wrongly. `probe-173-jumper.mjs` requires both directions to
  agree and settles disagreements with an axis-segment measurement — but
  `intraUnit` and `sweptOverlap` call it one way. **Nothing here has measured
  how often that matters movement-wide**, and it is the kind of instrument bug
  that reports clean.

### The rest of the audit, unmeasured

Each of these is the same question TODO 87 asked of the input side, and none
has been asked of the output side. Filed as questions rather than findings
because none is measured yet:

1. **Is the suppressor's hold real?** — **MEASURED 2026-08-26, and the answer
   is neither of the two the question offered.** See the finding below.
2. **The three riders' contacts, priced.** `alarmHandoffs` asserts the lock
   beak's contact closes. Nothing prices what the castellation must PUSH
   against — the lock's spring, the click's detent, the link's chain — as a
   §137 transfer row. TODO 16's format; the column's own drive torque is the
   budget they all come out of, and it has never been summed.
3. **The selector ring's detent.** `declareRestoring('Alarm selector', …)`
   answers `two-way` honestly — the link's centre pin drives the fork both
   ways. But TODO 16's 5–50 mN detent envelope describes a ring that INDEXES,
   and it is worth establishing whether a detent exists as metal or only as
   the envelope the arithmetic is checked against.
4. **The riser class — ASKED by §171, and the answer is narrower than it
   looked.** `tools/probe-lockriser-depth.mjs` now measures the CLASS rather
   than one rod. `alarmLinkBeakPost` — the §35 arming chain's beak post —
   crosses the same 0.6167 of saw band and stands at r 6.05 against its own
   floor of 6.7005, so on the derivation it is 0.65 too far in. But it does not
   touch: `meshClearance` reads 0.1267 to the skirt at rest (0.0929 worst over
   the toggle) and the nearest skirt vertex in the shared band leaves 0.1675.
   **So this is a clearance shortfall under `CLEAR_MARGIN`, not an
   interpenetration** — a different repair from finding 1's, and unlike the lock
   riser its station is not a free parameter: `beakPiv` is derived from the beak
   arm's own reach to the column tops, so moving it outboard re-solves the §35
   arm rather than re-siting a post. That is the work this item still holds.

   **Finding 2 above now measures this rod in full** — it threads the wheel
   rather than touching it, and its bar grazes the columns; that finding
   carries the numbers and the repair, and this item is closed by it.

   **And the probe's first widened reading was wrong, which is the reusable
   part.** It reported the link post 0.1665 deep inside the saw at both
   parities. `inPoly` is a crossing test, so an axis landing ON a cut edge
   resolves arbitrarily, and when it resolves INSIDE with an edge distance of 0
   the depth formula `dEdge + rR` returns the rod's own radius as a
   penetration — 0.1665 is that rod's radius to four places. The probe now
   prints `meshClearance` and the nearest-vertex gap beside every polygon
   verdict and flags a row where they disagree. Finding 1's case rested on the
   same polygon test and was right; pointing it at a second rod produced a
   confident wrong number on the first try.

### Finding 4 (2026-08-26, MEASURED — **CLOSED the same day**) — the suppressor's hold is a flag, and the metal under it is the wrong IDIOM

Question 1 above asked whether the brake's hold is a modelled friction force or
a posed angle. It is neither, and the second half is the part that decides the
repair. Measured with `tools/probe-90-lockhold.mjs`, both controls passing —
the must-hit reproduces the lever's own closed-form pad distance to **1.8e-15**
over four poses, the must-miss reads 27.1 to `chainRun`.

**The pad reaches tangency and never passes it.** `ALARM_LOCK_THETA` is solved
by law of cosines so the pad centre lands at `3.2 + ALARM_LOCK_PAD_R` = 3.5 from
the striking axis — exact tangency, by construction. Swept over the whole toggle
at both parities:

| | colBlock | pad gap |
|---|---|---|
| most ENGAGED | 1.0000 | **0.0000** |
| most LIFTED | 0.0000 | 0.1519 |
| minimum over the sweep | 1.0000 | **0.0000** |

pad gap = (pad centre → strike axis) − collar r − pad r, so the sign carries the
answer (`meshClearance` clamps at 0 and could not). **Zero interference is zero
normal force is zero friction torque**, at every state the toggle reaches. The
lever's ANGLE is honest — §102/TODO 28 already made it a function of the
column's cut, and that fix stands. What is fictional is the HOLD: `tick()` gates
the barrel's spend on `alarmReleased`, a boolean, and no friction coefficient
exists anywhere in the alarm's path.

**And a preload would not rescue it, which is why this is not a clearance fix.**
The barrel's moment reflected through the 44/11 wall-to-pinion mesh arrives at
the collar as 0.0520 .. 0.0884 N·mm. At the collar's 1.2126 mm radius and µ 0.2
(`sawCouplingSpec`'s own steel-on-steel default, not a number invented here):

```
N ≥ T / (µ·r) = 0.08843 / (0.2 × 1.2126) = 364.6 mN     at full wind
```

against the lock's return blade — **the only elastic member in the lever** — at
5926 N/m over its 0.5684 mm free length, whose tip force **at its own yield** is
67.4 mN. The brake needs **5.4× the blade's absolute ceiling**, and 7.3× the top
of TODO 16's 5–50 mN detent envelope. No legal preload closes that.

**The build comment's own justification is the cleanest statement of the
defect.** `alarmLockCollar` is built smooth with a reason written beside it:

> *Smooth, not notched: a partial wind can park the train at ANY phase (the
> winding lockstep), so the hold is a friction brake — the stop-lever-on-
> balance-rim precedent.*

The objection is real — a stop must be able to catch at any phase — but the
precedent is not. A hack lever holds a balance against its HAIRSPRING:
**5.815e-4 N·mm** at 270°. This pad would hold a mainspring-fed train:
**0.08843 N·mm**, **152× more**. The idiom was borrowed from a member carrying
two orders less torque, and at this one the friction brake is not a marginal
choice, it is an unavailable one.

**Why nothing caught it.** `['Alarm lock', 'Alarm striking wheel']` is declared
in `EXPECTED_PAIRS` as *"the brake pad ON the lock collar — the hold itself"*,
and it is the striking train's ONLY declared hold — no pawl or detent exists on
that train in `MECH_GRAPH`. So the pair is EXPECTED (correctly — the pad is
meant to touch), TODO 6's blanket excuse covers it, and no instrument in the
battery asks whether a declared hold can carry its load. **`restoring` and
`alarmHandoffs` both ask whether a contact CLOSES; neither asks whether it can
take the torque behind it.** That is a new class beside TODO 5's and TODO 6's,
and it is the same shape as finding 3's: a declaration standing in for metal.

**The repair is an idiom change, not a number.** A hold at this torque is
form-locking in real horology — a blocking lever into a stop wheel, which is the
chronograph practice this movement already uses one unit over at the column
wheel. The collar's smooth band becomes a cut one and the pad becomes a finger;
the lever, its pivot, its §68 azimuth, the beak, the riser and the §102 blade
are all untouched, and the force at the stop stops being friction and becomes a
contact reaction the pivot post takes. The build comment's any-phase objection
is answered by the tooth COUNT — derived from how far the rotor may run before
catching, against `ALARM_CAM_LOBES` = 4 (one strike per lobe) — rather than by
abandoning the stop. That derivation, and whether the stop belongs on this rotor
at all rather than on the hammer or the governor, is a P0/P1 design choice on the
`Alarm lock` group and is the work this finding hands on.

**One number moved in passing, recorded rather than absorbed.** §102 derived
`ALARM_LOCK_LIFT = (CLEAR_MARGIN + 0.01) / ALARM_LOCK_L`, which buys 0.16 of
ARC at the pad — but the pad's clearance from the collar is RADIAL, and the two
stand 18.4° apart, so the released pad achieves **0.1519**, 94.94% of it. Still
over `CLEAR_MARGIN`, but it spends 81% of the 0.01 the constant added on
purpose, leaving 0.0019. The probe prints intended against achieved so the
projection cannot be forgotten if the lever's triangle is ever re-solved.

### Finding 5 (2026-08-26, MEASURED) — the lock's READ is posed too: the column cannot block the lever it is declared to block

Found while establishing whether `ALARM_LOCK_LIFT` was free to re-derive for
finding 4's repair. It is free — and the reason it is free is the defect.

`profileAt` returns a NORMALISED lift in [0..1]; the cut surface's height is
`colH · profileAt(θ)`. So the SHAPE of the lever's travel comes from the
column's cut — that much of TODO 28's fix is real and stands — but the
AMPLITUDE is `ALARM_LOCK_LIFT`, derived from the PAD's clearance need over the
arm. `ALARM_COL_H` never enters the lock lever's law. §102's own criticism of
the code it replaced — *"changing colH moved it not at all"* — is still true of
the code that replaced it.

Measured off the built tree (`tools/probe-90-lockhold.mjs`, same run, same
controls):

| | |
|---|---|
| castellation ring, in the wheel's frame | r **3.6100 .. 5.7000** |
| the beak's inward face | **5.7000** — flush on the ring's outer wall |
| beak → wheel axis over the whole sweep | 6.2570 .. 6.2581 |
| **radial excursion** | **0.00114** = **0.08%** of `ALARM_COL_H` 1.4 |
| clearance beak ⇄ castellations, colBlock 1 | **0.000000** (both parities) |
| clearance beak ⇄ castellations, colBlock 0 | 1.198376 (both parities) |

**The excursion is the second-order term and nothing else.** `L(1−cos θ)` at the
beak's 2.3 reach and the 0.032 lift is 0.00118; measured, 0.00114. The wheel's
centre stands ON the tail's line by construction — the build comment says so and
gives that as the REASON — but a lever pivoted at one end moves its beak
PERPENDICULAR to the arm, and at a point on the line to the wheel's centre the
perpendicular direction is the TANGENT. So siting the wheel on the arm's line is
not what makes the read radial; it is what makes it tangential, which is the one
geometry in which a castellation cannot lift a follower.

**And the lift carries the beak the wrong way.** The beak's face is flush at
5.7000 — the ring's own outer wall — and the excursion is OUTWARD as the lever
lifts, so the column is not even a stop against lifting: the beak slides off it.
Nothing in metal holds the lever engaged. The 1.198 at colBlock 0 is not the
beak moving clear; it is the WHEEL rotating the metal out from under a beak that
stayed where it was.

**So `alarmHandoffs`' row measures a real contact that constrains nothing.** The
face is flush — 0.000000, §169's third shape, the case item 5 records as
invisible to `intersectsGeometry` — and a handoff check asks whether a contact
CLOSES, which this one does, permanently. It cannot ask whether the contact can
transmit anything, which is finding 4's new class arriving at the other end of
the same lever.

**Both ends of this lever are now posed, and that is one repair, not two.**
Finding 4: the pad cannot hold the train it is declared to hold. Finding 5: the
column cannot work the lever that is declared to read it. Fixing only the hold
would put real metal on a switch that cannot throw it. The read's repair is
position-space and does not touch the hold's: the beak must approach the
castellations with a RADIAL component, which means the pivot comes off the
wheel-centre line (the §68 azimuth sweep chose that azimuth against clearance,
not against this) or the wheel presents a stepped outer profile the beak reads
as a snail. Either is a P0/P1 change on the `Alarm lock` group with `colH` as
the quantity that must finally reach the lever.

#### CLOSED — the band is cut, and the hold is geometry

The repair is the idiom change the finding prescribed, and it stayed local
because one choice kept it local.

**The teeth stand OUTWARD from the old band, and that is the whole reason
nothing else moved.** `ALARM_LOCK_ENGAGED` is not just the lever's pose — the
column wheel's station is placed off `alarmLockPivot` ALONG that azimuth, so
the engaged angle is the datum the entire switch cluster is laid out from. The
first cut put root at 2.883 and tip at the old 3.2, which seats the finger
0.3167 deeper, rotates the lever, and therefore MOVES THE COLUMN WHEEL:
measured, §112's link-rod solve fell to **0.041 against 0.15**, and §35's plate
bores and §43's riser slot all drifted off their derived sites. Standing the
teeth outward instead (root `3.2`, tip `3.2 + STOCK_MIN_U`) leaves the engaged
seat at the radius the pad already sat at — `ALARM_LOCK_ENGAGED` is
bit-identical, all five warnings vanish, and only the LIFT grows.

| | |
|---|---|
| `ALARM_STOP_TEETH` | `ALARM_CAM_LOBES × ⌈1/ALARM_FREE_FRAC⌉` = 4 × 3 = **12** |
| `ALARM_STOP_ROOT_R` / `TIP_R` | 3.2 / **3.5167**, depth `STOCK_MIN_U` |
| `ALARM_LOCK_LIFT` | 0.032 → **0.1068** rad |
| finger into the teeth, engaged | **0.3167** — the full depth |
| finger off the tips, released | **0.1500** — exactly `CLEAR_MARGIN` |

**Teeth, derived.** The stop must catch before the cam's next lift begins, so
the finger is never asked to arrest a hammer already loaded on a flank: at
least one tooth must fall inside every lobe's FREE window, which is
`m ≥ 1/ALARM_FREE_FRAC` teeth per lobe, taken as a whole multiple of
`ALARM_CAM_LOBES` so the phasing holds at every lobe instead of drifting.

**The locking face is RADIAL, and that is a departure from §99's saw law
rather than an oversight.** A click's saw is cut to be ratcheted past; at this
radius and count its 0.72/0.28 drop stands **54° off radial**, and µ 0.2 buys a
friction angle of only 11°, so a loaded finger would cam straight out. A stop
is never ratcheted past, so its face is cut at zero pressure angle — the
tangential load then has no radial component at all, which is exactly what lets
the finger be lifted out WHILE the train pushes on it.

**And the hold is geometry now.** `tick()` ran the striking train on `alarmOn`,
a boolean. It runs on `alarmStopClearAt(colBlock) >= 0` — the finger's real gap
against the tip circle — which is the same function of the ridden profile that
poses the lever, so hold and pose cannot drift apart. Switching off still
re-seats the lock, but by the route the metal takes: off steps the wheel, the
columns put the lever down, the finger enters the teeth.

**Two things the repair had to pay for, both in position space as the design
order requires.** The lift tripling swept the lever's arm onto
`alarmLockSpringStud` — `intraUnit` measured the arm ON it (0.000) at
colBlock 1, because the anchor's `0.34` stand-off was a literal that was only
ever enough while the lever barely moved. Re-derived against what the flank
actually sweeps at the stud's station, it now clears **0.1474** engaged and
0.2278 lifted; the stud moved, the lift did not, and the tooth kept its depth.
And the collar is **BORED** now: the old one was a solid disc with the arbor
buried inside it, so no surface of the two ever crossed and `assembly` read
them as two bodies 0.16 apart the moment the cut changed which triangles the
query found — the joint its `INTRA_UNIT_CONTACTS` row declares ("pressed on the
strike arbor") had no metal anywhere. The bore is one `SAW_FIT` under the
sleeve, this repo's own quantum for a weld spent as enclosed metal rather than
a running gap, and the row now measures 0.

**Two declarations were stale and are named rather than re-indexed.** That
`INTRA_UNIT_CONTACTS` row selected its other half as `CylinderGeometry#0` — a
position in the unit's cylinder list. The collar stopped being a
`CylinderGeometry`, so every index in that list shifted by one and the row
would have pointed at a different member in silence; it names
`alarmStrikeSleeve` now. And the schematic drew this collar as a plain circle,
on the stated ground that "the collar is deliberately smooth" — true when
written, false the moment it was cut. That glyph is RETRACTED and the part owns
its own (§78): it exports `userData.profile`, so §83's cut-outline pass draws
the teeth from the very polygon the Shape was extruded from. It also had to go
for a second reason worth keeping — it read `geometry.parameters.radiusTop`,
which only a `CylinderGeometry` carries, so the radius arrived `undefined` and
`addRing` wrote **NaN vertices into a schematic Line**. Invisible in the scene,
but `box.setFromObject(movement)` spans Lines too, so §39's assembly-depth
assert reported "NaN mm deep". A glyph that reads a builder's parameters is
coupled to that builder, and the coupling is silent until the builder changes.

`tools/probe-90-stophold.mjs` is the acceptance test and gates both halves:
the finger seats by the full depth and stands one margin clear, AND the alarm
still RINGS when armed (barrel spends 0.6219 turns over four seconds) and is
HELD when off (1.500 unmoved). The second half is the one that matters —
a hold that never releases is as wrong as one that never holds, and swapping a
gate is exactly how you get one.

**What this does NOT close: finding 5.** The lever's READ is still posed, so
this is a real hold worked by a switch that cannot throw it. That is why
finding 5 is filed beside this one rather than inside it.

#### The repair was SEARCHED, and the search refutes the obvious fix (2026-08-26)

Finding 5's own closing paragraph proposed moving the beak so it approaches the
castellations with a radial component. `tools/probe-90-lockread.mjs` searched
that, and **no station exists**. The result is worth more than the fix would
have been, because it says what the repair actually has to be.

**The geometry has an exact optimum, and it is not reachable.** The beak's
motion is purely radial when `PB ⊥ WB` — Thales' condition, so the station lies
on the circle of diameter (pivot, wheel centre):

```
|PB| = √(D² − readR²) = √(8² − 5.7²) = 5.6134     at φ = asin(5.7/8) = 44.57°
```

Measured there: radial gain **1.0000** (against 0.0000 today), riser 1.81 clear
of the driver pawl, nose clear, chamfer 0.5448 inside its ceiling. Everything a
station needs — except legality.

**The station is QUANTIZED to whole column pitches, and both neighbours are
taken.** A rider must sit centred on a column in one state and centred in a gap
in the other, so its azimuth is ≡ 0 (mod `2·ALARM_COL_STEP` = 60°) — the same
rule `ALARM_LINK_BEAK_OFF` already snaps to, for "identical parity". 44.57° is
mid-flank: a beak there reads a ramp, not a state. The legal stations:

| φ | gain | chamfer needed | riser corridor | |
|---|---|---|---|---|
| **0** | **0.0000** | — | — | today's — the defect |
| **−60°** | 0.9712 | 0.6723 | **0.0000** to `alarmLinkBeak` | the LINK beak's own station |
| **+60°** | 0.9712 | **0.6723** | 0.1992 to the driver pawl | over the chamfer ceiling, and 0.05 off `CLEAR_MARGIN` at the pawl |
| ±120°, 180° | ≤ 0.58 | — | — | arms of 11.9–13.7 from the pivot |

The chamfer ceiling is `readR − linkOuter − CLEAR_MARGIN` = 5.7 − 4.9173 − 0.15
= **0.6327**: the pillars' outer edge must ramp by exactly the beak's radial
travel, and it may not eat the band the link beak rides. At +60° the travel
wants 0.6723 and the metal allows 0.6327, so the one legal station with gain
**fails on the metal by 0.04** and on the corridor by 0.05.

**So the beak cannot be moved into a good station — something else must give.**
Three routes, in increasing blast radius:

1. **A FOLD — an intermediate rocker at φ = 0**, which is free, parity-correct
   and already has the declared contact. The lever's pivot is collinear with
   the wheel there; a rocker with its OWN pivot perpendicular to the radius at
   that station reads with gain ≈ 1 and pushes the lock lever's tail. This is
   CLAUDE.md's fold idiom exactly — position-space currency, one added part
   with its own P1 duties (spring, section, stall) and its own declarations.
2. **Re-site the LINK beak to −120°**, freeing −60° for the lock. Still over the
   chamfer ceiling, so it does not close on its own.
3. **Re-solve the lock lever's pivot off the collinear line.** This invalidates
   §68's swept azimuth, re-derives the pad triangle, and moves `ALARM_COL_POS`
   — which §174 measured as the datum the whole switch cluster is laid out from
   (cutting the stop teeth inward moved the wheel and dropped §112's link-rod
   solve to 0.041 against 0.15). The largest of the three by a distance.

**Route 1 is the recommendation**, and it is a landing of its own rather than a
continuation of §174's: a new member is a new row in `MECH_GRAPH`, `restoring`,
`INTRA_UNIT_CONTACTS` and the handoff table, and its section and stall are P1
work with the line-spec discipline that implies.

**The search's own method notes, because two of them cost a reading.** The
corridor to other UNITS is 11–15 everywhere along the sweep — the alarm cluster
is its own island, and what actually binds is the other RIDERS, which live in
the two units a cross-unit scan excludes. And the RISER and the NOSE must be
scanned as separate bodies in separate z bands: the riser crosses every band
from the tail up, but the nose lives only in the castellation band, and the
driver pawl works the SAW. Scanning both with one full-height body reported the
pawl as an obstacle to the nose — which it cannot be — and that false reading is
what made **both** parity-legal stations look blocked. All three of the probe's
controls pass (a body parked on the gong reads 0.0000, the same body 200 away
reads nothing, and φ = 0 recovers the 0.0000 gain that is the defect).

The instruments for all of this exist: `probe-colwheel-foul` sweeps the toggle
and reports everything within `CLEAR_MARGIN` of the wheel's three bodies with
each offender's unit, and `probe-colwheel-id` identifies them — geometry,
material, parent chain, whether they are NAMED, and per-parity behaviour.

`probe-90-lockhold` is finding 4's. It exits non-zero on its own CONTROLS only:
the three numbers a brake is judged on are a REPORT and must stay one, because
fixing the idiom is supposed to move them — gating on them would make "the brake
cannot hold" a claim the repo defends rather than a defect it is fixing.

## 98. The pallet fork is an assembly of six abutting solids where the metal is one blank — CLOSED (§175)

Eye-reported 2026-08-26: *"the pallet fork looks like different shapes were
squashed together haphazardly."* It is — and measuring the complaint turned up
a z-band derivation that is false as well, so this is honesty debt about what
was cut, not a finish item.

A Swiss lever is **one piece of steel**: pivot boss, both pallet arms, the
lever and the fork end with its horns and notch are a single blank, pressed or
wire-cut in one outline and lapped to one thickness. Only the two ruby stones
and (on many calibres) the guard dart are separate parts. `makePalletFork`
(`src/geometry.js:911`) instead emits **six steel solids** for that one blank
and lets them overlap:

| member | geometry | edge treatment | z-height |
|---|---|---|---|
| body outline — belly + lever + horns + notch + shoulder | `ExtrudeGeometry` | bevel `t·0.12` = 0.144 | **1.488** |
| pivot boss | `CylinderGeometry`, h = `t·1.3` | none (a cylinder) | **1.560** |
| pallet-arm block ×2 (entry, exit) | `ExtrudeGeometry` | bevel `t·0.08` = 0.096 | **1.392** |
| arm bar ×2 (boss → head) | `BoxGeometry` `t·0.95 × len × t` | **none** — square cut | **1.200** |

All figures measured off the built tree at `FORK_T = 1.2`, not read off the
source — `tools/probe-fork-blank.mjs` is the instrument and prints every number in
this item. The unit ships 11 meshes in total: the six above, two ruby stones,
the guard pin and the two pivots.

### Finding 1 — four thicknesses for one plate

1.200 / 1.392 / 1.488 / 1.560. World z, at rest: the bars occupy 4.3079–5.5079,
the arm blocks 4.2119–5.6039, the body 4.1639–5.6519, the boss 4.1279–5.6879.
Against the thinnest member the heights differ by **0.192, 0.288 and 0.360** —
0.096, 0.144 and 0.180 per side, since all six are centred on the same
mid-plane. Every one of those per-side steps is a visible ledge at a joint, and
the largest exceeds `CLEAR_MARGIN` (0.15) — the movement's one clearance
margin, spent inside a single part. A lever lapped to
one thickness has one number here; this one has four, and three of them exist
only because `ExtrudeGeometry`'s bevel and a cylinder's height were never asked
to agree. That is MODELING.md rule 1 in the z direction: the *rendered* solid
is not the authored one, and nothing downstream knows it.

### Finding 2 — the derivation `L_BALANCE` rests on is false, and only a lateral accident is holding it

`src/layout.js:542` reads

```js
// Balance mid-plane: fork body top (L_FORK + FORK_T/2) + margin + half the rim's own height.
export const L_BALANCE = L_FORK + FORK_T / 2 + CLEAR_MARGIN + RIM_H / 2;
```

`L_FORK + FORK_T/2` = **5.5079**. The fork's steel actually tops out at
**5.6879** — the pivot boss, `t·1.3` tall about the mid-plane — an overshoot of
**0.1800**. The balance rim's underside therefore lands at 5.6579, which is
**0.0300 *below* the top face of the boss**: the margin the constant reserves
is not reduced, it is negative. The parts do not touch only because the boss
and the rim happen not to overlap in XY — swept over a turn of the balance, the
boss's nearest balance mesh is **0.6001** away. (Sampled at one pose that
number reads anything from 0.60 to 0.73, which is why the probe sweeps: the
balance turns, so a single reading of it means nothing.) Nothing asserts that separation, nothing
derives it, and the comment claims a clearance the geometry does not have. This
is the honesty half of the item and it is independent of how the fork is
redrawn: the constant must bind against the fork's **true** reach, exported
from the builder the way `makeHammerLever` exports its outline and bevel
(MODELING.md rule 1's pattern), not against a nominal `FORK_T/2`.

### Finding 3 — the two arms are not the same part

The bars run pivot-boss → head-midpoint, and the two heads sit at the leans the
draw solve gives them (entry ≈ 237° fork-local, exit ≈ −33°). So the bars come
out **4.2782 and 4.8711 long — 12.2% apart**, and measured mesh-to-mesh the *exit*
arm block touches the body (clearance 0.0000) while the *entry* block stands
**0.9078 clear** of it, carried only by its bar. The same nominal member is
related to the body two different ways on the two sides. A real anchor's arms
are mirror images about the lever's axis; the drawing here has nothing that
says so, which is exactly what "squashed together" describes.

### Finding 4 — the body outline draws the arms a second time

Above the pivot the outline still carries the pre-§16 "belly + shoulder": full
width `2·shoulderX` = 4.32, closed by a concave top whose only derivation is a
clearance bound —

```js
const topY = D - (R + 0.15 + bankAllow) - 0.05; // the |p−W| bound at x = 0, with slack
```

— i.e. a shape that exists to *avoid* the escape wheel rather than to do a job,
and one carrying a bare `0.05` of "slack" against standing rule 1. Since §16
moved the arms out onto separate bars, that blob represents the arm region a
second time: the silhouette says *wide anchor top*, the bars say *two thin
arms*, and the render draws both, with the bars' square-cut ends butting
through the belly as a visible seam. Rendered alone (`fork3-front`), the fork
reads as a kite with two rectangular slabs glued on at unrelated angles.

### Why the instruments are all green on this

Worth writing down, because four of them look like they should have caught it.

- `assembly` (§107) asks whether a rigid group is **one connected body**, and
  these six solids *are* connected — the bars overlap the boss and the blocks.
  Connectivity is not integrity. In any case `Pallet fork` is not in
  `ASSEMBLY_SCOPE`, so its rows are reported, not gated — §107's own residue,
  arriving as a real defect.
- `intraUnit` (§121) compares movers against fixtures and fixture pairs; every
  one of these six rides the same frame and morphs not at all, so they are one
  part to the clustering and never compared. Same-frame mover splits outside
  `ASSEMBLY_SCOPE` are the named residue.
- The pair sweeps cannot see inside a unit at all (TODO 5).
- `stockFloor` and `slenderness` ask about sections, not about how many
  sections there are.

Nothing in the bar asks *"is this part one piece of metal, and is it one
thickness?"* — which is the general question this item raises and finding 1 is
the first instance of.

### The repair

**One outline, one thickness, one extrude**, with the ruby stones and the guard
pin the only separate solids. Concretely:

1. **Cut the blank as a single `THREE.Shape`.** Boss, both arms, the two
   slotted heads, the lever and the fork end are one closed polygon; each
   stone's slot is a notch in that polygon at the head, kept where
   `stoneAndArm` already puts it, with `gGap = armBevel + SEAT_SHOW` unchanged
   (that derivation is right and MODELING.md cites it). Nothing kinematic
   moves: horn tips, notch walls and floor, the `forkTop`/`forkY` anchors the
   bank-angle derivation reads, and every stone seat are all *outputs* of
   solves that stay as they are — this is a re-cut of the connecting metal
   only, and the fingerprint on the stones and the notch must not move.
2. **Make the arms mirror images by construction.** Draw one arm in the lever's
   own frame and reflect it; let the head's *lean* (which genuinely differs per
   stone, because draw differs) be a rotation applied to the slot inside a
   mirrored head, not a different arm.
3. **Replace the belly/shoulder with the arms themselves.** The wheel-clearance
   bound stops being a shape and becomes what it should have been — a check on
   the one outline, asserted, with the `0.05` slack either derived or deleted.
4. **Export the blank's true reach through `userData`** (outline, bevel, and
   the z half-height the bevel actually produces) and re-derive `L_BALANCE`
   from it, closing finding 2. If the boss must stand proud of the blank —
   real levers do have a boss — then it is *declared* as standing proud and the
   balance's elevation pays for it, instead of the comment claiming a face
   0.18 lower than the metal.

### Acceptance

- `tools/probe-fork-blank.mjs` shipped with this item as a REPORT — the member
  census, the z-heights, the derivation comparison and the arm figures, judging
  nothing, because a report saying `6 steel solids` has not failed anything.
  **§175 turned it into the acceptance form**, and what it gates is five
  things: the fork's steel is one solid beside the stones and the guard dart;
  one z-height across the blank; that height is `FORK_T`, the chamfer taken out
  of the stock rather than standing proud of it; the built top equals
  `L_FORK + FORK_HALF_Z`; and the balance rim clears it by exactly
  `CLEAR_MARGIN`. **This bullet asked for a sixth that was wrong** — "the two
  arms agree to float noise under reflection about the lever axis." They do not
  and should not; see correction 1 below. What is gated in its place is the
  relation that is actually true: the seats mirror exactly (residual 0.000000)
  and the leans break that mirror by exactly 2·DRAW_DEG (24.000°).
- Boot silent — the existing `pallet stone: …` and `pallet arm: steel within
  the wheel sweep` asserts must still hold on the re-cut outline, and the
  wheel-clearance bound of finding 4 joins them.
- Full battery clean per standing rule 4; `--report` diffed against the base,
  since the `Escape wheel ⇄ Pallet fork` and `Pallet fork ⇄ Balance` rows will
  move even where the gates stay empty.
- The fork's account is edited in place to describe the blank, not the
  assembly. §16 turned out to have no `docs/BUILT.md` section — it lives only
  as source comments, which is where the edit went; the landing's own record
  is §175.

### CLOSED by §175 — what was built, and where this item was wrong

The blank is one closed outline: down the lever's waisted left flank, round the
fork end, up the right flank, then the boss arc and the two arms with their
broached heads. Six steel solids became one, four z-heights became one, and
every kinematic vertex — horn tips, notch walls, the notch floor at
`forkTop + 0.7·t`, the `forkTop`/`forkY` anchors, both stone seats — is an
output of a solve that still runs exactly as it did.
`tools/probe-fork-blank.mjs` stopped being a report and became the acceptance
test for it.

**Two things this item proposed and §175 did not do**, recorded here rather
than quietly dropped, because both were wrong for reasons only building them
showed:

1. **Repair step 2 asked for mirror-image arms.** It should not have. The
   zero-draw frame `f0` and both seats ARE exactly mirror-symmetric — the gate
   holds them to the last bit — and draw then rotates both stones in the
   wheel's own sense, so the two leans differ from that mirror by exactly
   2·DRAW_DEG. That is the one asymmetry a lever escapement really has.
   Holding a leaned slot inside an unleaned block needs the head **0.2361
   wider** (derived from where the rotated slot's corners land), all of it on
   the side that reaches toward the wheel — steel spent to hide a real
   asymmetry. The arms come from one rule applied with sigma instead; what
   differs between them is the draw. Finding 3's DEFECT is still closed: the
   0.0000-vs-0.9078 split and the aimed boxes are gone because there are no
   separate members left to relate two ways.
2. **Repair step 4 asked for `L_BALANCE` to be re-derived from the blank's
   reach.** Done — but not in the direction this item assumed. Declaring
   `FORK_HALF_Z = FORK_T·(0.5 + FORK_BEVEL_FRAC)` and letting the balance rise
   0.144 to meet the metal threw **six §47 boot warnings** in the mainspring
   arrest: the balance carries the hairspring stack, the stack is the
   three-quarter plate's binding member, and the plate carries the arrest. The
   parameter is called `thickness` and every consumer read it as the finished
   part, so the BUILDER was wrong: `bevelThickness` stands proud at both faces,
   and the extrude now gets `FORK_T − 2·bevel` so the lapped blank measures
   exactly `FORK_T`. `FORK_HALF_Z` = `FORK_T/2` — arithmetically what the file
   said before, and no longer a coincidence, because `main.js` asserts the
   built blank against it.

**A third defect, found after this item was closed and fixed in the same
landing.** Reported by eye — *"the tail has one part that is impossibly
thin"* — and measured: the fork's outline CROSSED ITSELF, five times before
any of this work and twice after the blank's first cut, because the slot
(`notchHW` = t·0.7) was broached across a station where the bar (`leverHW` =
t·0.6) was narrower than the slot. Not this item's doing and not its scope as
filed, but the same metal, so it is closed here rather than deferred: the fork
end now flares to `notchHW + leverHW` before the slot begins, on the
constraint that the two horns together are as thick as the bar they continue.
§175 carries the measurement. What it costs this file to record is a warning
about item 78's instrument: `slenderness` reads a mesh's length against its
section as a WHOLE, so it cannot see a local pinch, and `Pallet fork` never
appeared in its over-ceiling rows at all.

**Residue, named rather than absorbed.** In XY the bevel still dilates the
authored outline outward, so the blank is wider than the shape it was cut from
— TODO 84's class, general to the movement, and left alone on purpose: closing
it for the fork alone would move the notch walls the impulse pin runs in. The
stone and the blank are still two meshes of one unit, so their seat remains
TODO 5's fixture-pair residue; `gGap = bevel + SEAT_SHOW` is what guards it,
reading the blank's one bevel now instead of a head block's own. And the
"Not in scope" paragraph below still stands untouched — the guard pin has no
dart and nothing measures a horn-to-pin contact.

**Not in scope**, so that it is not silently absorbed: the safety action —
guard pin, safety roller, horns — is a separate mechanism from how the lever
is cut. Filed as item 105.

**And this paragraph used to say something false**, corrected here rather than
left standing in a closed item. It read *"the guard pin is a cylinder with no
dart and no matching crescent on the safety roller"*. The crescent EXISTS:
`makeBalanceWheel` cuts it with `gap = 0.45`, and the missing sector is centred
on azimuth 0 — the same azimuth as the impulse pin at `(rollerR, 0, pinZ)`. That
phasing is the derivation that matters in a real lever escapement, because the
passing hollow has to be cut where the impulse pin is or the guard pin could
cross at the wrong moment. It was written from a glance at the fork and never
checked against the balance, which is the same mistake item 103's own "not in
scope" sentence made about the driver. Two for two: a scope note written in
passing is a claim about metal like any other.

## 99. `claim-item.mjs` cannot see a pushed claim the clone never fetched — CLOSED (§176)

The item-number scheme replaced "read the max and add one" because that rule
reads ONE branch and collides silently (`docs/item-numbers/README.md` has the
history). `tools/claim-item.mjs` reads every ref instead, and its own comment
says so: *"Every ref we can see, not just this one. This is the whole point."*

**"Can see" is a property of the clone, not of the repository**, and the tool
never says which it means. It enumerates with

```js
git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes')
```

— whatever this working copy happens to have fetched. It never fetches, and it
never compares that against the remote. The header warns about the residue it
does know: *"It still cannot see an UNPUSHED claim on someone else's machine."*
The one it does not name is larger and more ordinary: a claim that IS pushed,
by someone who did everything right, sitting on a ref this clone has never
pulled.

### Measured, 2026-08-26 — both collisions on one branch

A Claude Code session starts from a clone carrying the branches it needs. On
`claude/pallet-fork-geometry-dvs11s` that was **2 refs**; `git ls-remote
--heads origin | wc -l` said **206**. The tool printed its ref count honestly
and was believed:

| | with 4 refs visible | with all 209 |
|---|---|---|
| TODO high-water | 90 | **97** |
| offered | **91** | 98 |

TODO 91 was `case-openings`' — *"The plate seat ledge projects into the
dial-side keyless works"* — claimed the same day, with 92–97 behind it. The
same session then hit it a second time from the other direction: `BUILT 174`
was genuinely free when claimed and `worktree-todo-triage` merged its own 174
first, so `docs/item-numbers/BUILT-0174.md` came back as an add/add conflict at
merge.

**The scheme worked both times** — that is what the file-per-number path is
for, and the second collision was caught by git exactly as designed. What it
cost was two renumbers late, one of them after a PR had been opened and
reviewed against the wrong section number. The first was avoidable at the point
of claiming and was not avoided, because nothing in the output distinguishes
*"nobody has taken 91"* from *"nobody I can see has taken 91."*

### The fix, and the constraint it derives from

A claim is a statement about the REPOSITORY, so it must be checked against the
repository — not against a local cache of it. Three options, cheapest first;
the third is the one that matches what the tool promises.

1. **Say what was actually consulted.** Print the ref count beside
   `git ls-remote --heads origin | wc -l` and warn loudly when they differ.
   Cheap, honest, and would have caught this: `5 ref(s)` against 206 is not a
   number anyone reads past twice. It still allocates the wrong number.
2. **Refuse.** Exit non-zero when the local ref set is materially short of the
   remote, with `--no-remote` (which already exists) as the documented escape
   for an offline claim. Correct, and annoying in exactly the case the escape
   hatch covers.
3. **Fetch first.** `git fetch --quiet --all` before enumerating, behind the
   existing `--no-remote` opt-out. This is what "every ref we can see" already
   claims to mean, and it makes the claim true rather than merely honest.

Whichever lands, `docs/item-numbers/README.md`'s residue section gains the
unfetched-ref case beside the unpushed one, and `claim-item.mjs`'s header
stops implying the ref set is the repository's.

### CLOSED by §176 — and the item's own ranking was wrong

Options 1 and 3 both landed, because building 3 alone showed it insufficient.
Exercised against a deliberately short clone (`git clone --single-branch`, one
remote-tracking ref), **the fetch did not close the gap**: `--single-branch`
writes a restricted `remote.origin.fetch`, so `git fetch --all` returns only
that branch, and the allocator read a high-water of 98 against a true 100 —
it would have handed out an already-claimed number. This item called option 3
"the one that matches what the tool promises" and option 1 merely "honest";
in fact option 1 is the only one that covers a clone narrowed at birth, which
is a shape this repo will keep meeting. Both shipped: fetch for the ordinary
un-fetched clone, and a `git ls-remote` comparison that WARNS with both counts
when they disagree, plus a `[fetched]` / `[FETCH FAILED]` /
`[HEAD only (--no-remote)]` note on the report line.

**Not in scope.** The add/add conflict path stays exactly as it is. It is the
backstop that caught the BUILT collision, and no amount of fetching removes the
race between two branches claiming between one fetch and the next — see
`docs/item-numbers/README.md`.

## 100. Nothing asks whether a cut outline is sound — STEPS 1 AND 2 DONE (§178)

`makePalletFork`'s outline crossed itself for as long as the part existed —
**five self-intersections**, measured at the commit before §175 with a one-line
outline export patched into a worktree, the worst at (−0.9274, −8.0514). The
cause was one comparison: a slot `notchHW` = t·0.7 half-wide broached across a
station where the bar was `leverHW` = t·0.6 half-wide, so the walls it was meant
to leave had negative thickness and the outline inverted through itself.

**Every gate passed it, before and after.** That is the item. A
self-intersecting `THREE.Shape` triangulates, extrudes, welds, renders and
sweeps like any other, and each instrument misses it for its own reason:

- `slenderness` measures a mesh's length against its section AS A WHOLE, so a
  local pinch does not register — `Pallet fork` never appeared in its
  over-ceiling rows at all.
- `stockFloor` asks whether a section is above the floor, not whether the
  outline that produced it is a simple polygon.
- `meshIntegrity` reports zero-area and INVERTED bodies, and the fork was
  neither: measured on the merged tree, the four inverted rows are
  `LatheGeometry` and `BufferGeometry` (TODO 75's winding class), not a crossed
  extrude cap.
- `intraUnit` and the pair sweeps compare parts to other parts. A part folded
  through itself is one mesh and never compared to anything.
- `fingerprint` hashes per-unit BOUNDING BOXES at 12 poses, so it cannot see
  the shape inside the box at all.

An eye caught it. That is not a control.

### What exists now, and what it does not cover

§175 added two guards, and both are the fork's alone: a build-time assert in
`makePalletFork` over every non-adjacent pair of its sampled outline, and the
same test as a gate in `tools/probe-fork-blank.mjs`.

The population they do not cover: **30 `ExtrudeGeometry` call sites in
`src/geometry.js` and 23 more in `src/main.js`**, built from 29 `THREE.Shape`
outlines in the geometry module alone. None is checked. Whether any of them
crosses is UNMEASURED — the fork is the only instance anyone has looked at,
and it was found by eye rather than by search, so the count of others is
unknown rather than zero.

### MEASURED, 2026-08-27 — the class is one more part, not the movement

`tools/probe-outline-simple.mjs` is step 1, and it needed no builder changes:
`ExtrudeGeometry` keeps what it was handed in `parameters.shapes`, so the
AUTHORED curve rides on every built mesh. One line in `weldGeometry` carries
that through the weld (§81 rebuilt the geometry and dropped it, the same class
as item 80's `userData` loss); before that line, **570 of 573 geometries had no
readable shape** and the sweep answered `0 crossings` while looking at three
parts.

With it, the sweep covers the whole extrude population and accounts for the
rest: **176 geometries read, 397 rings tested, 0 extrudes missed** — the 397
unreadable are Cylinder/Box/Lathe/Buffer/Torus/Tube/Sphere, which never had an
authored shape. The probe FAILS on a missed extrude for exactly that reason.

**One part crosses itself: `Alarm switch / alarmColDriver`, 31 times** — filed
as item 103. So the fork was not unique and the class is real, but it is two
parts and not a movement-wide rot.

The weld line is the only source change the measurement needed, and it is
inert: battery **35/35**, fingerprint `1380256309` — the same hash as the tree
before it — and `--report` diffed against that tree is 18 of 22 checks
BYTE-IDENTICAL with the other four differing only in `*Ms`. Every non-timing
field matches. It carries a reference to an object the builder already
allocated and touches no vertex, which is what that diff says rather than
assumes.

**A signature that does not work, recorded because it looked obvious.** The
first cut of the probe read the CAP's triangulation instead — earcut winds a
simple polygon consistently, so |Σ signed| / Σ|signed| over the cap should be
1 for a sound outline and below 1 for a folded one. It is not. Measured, a
bowtie extrudes to no readable cap at all and a fork-shaped crossing reads
exactly 1.000000: earcut quietly reinterprets a self-crossing polygon rather
than emitting mixed windings. That version swept the movement and reported
"372 geometries, 0 folded" — a clean answer to a question it was not asking.
Its controls caught it, which is the whole reason it had them.

### The work

1. **Measure the class before fixing it.** DONE, above. Every builder that emits a
   `THREE.Shape` exports its sampled outline the way `makePalletFork` now does
   (`userData.blankOutline` — MODELING.md rule 1's pattern), and one probe
   sweeps the scene testing each for self-intersection. That measurement is the
   real deliverable: it says whether this is one part's defect or a class.
2. **Then gate it**, as a battery check over every exported outline rather than
   as an assert per builder. A `THREE.Shape` that crosses itself is not a
   shape, and unlike a clearance there is no budget and no waiver — it is not a
   tolerance, so the gate has no dial to widen. **DONE — §178.** `outlines`
   gates controls, crossings and coverage; battery 36/36, and its `fails`
   function was exercised against a folded outline, a missed extrude and a
   broken control to prove it can actually fail.
3. **And ask the question one level up**, which is what would have caught the
   fork at design time rather than at inspection: a builder that cuts a slot
   into a member must assert the member is wide enough to hold it. The fork's
   version of that constraint is `mouthHW = notchHW + leverHW` (§175 — the two
   horns together are as thick as the bar they continue). The general form is
   that a slot's half-width plus its walls is a bound on the outline at that
   station, and it is checkable at build wherever both numbers exist.

**Scope note.** The XY dilation of the extrude's bevel is item 84's and is not
this: 84 is about a correct outline shipping fatter than it was cut, this is
about an outline that was never a polygon.

## 103. `makeColumnDriver` wraps a hub arc a full turn, and it FILLED THE PIVOT BORE — CLOSED (§177)

Found by TODO 100's measurement pass — `tools/probe-outline-simple.mjs`, the
first sweep that has ever asked whether the movement's authored outlines are
simple polygons. **`Alarm switch / alarmColDriver` crosses itself 31 times.**
It is the only one of 176 extrudes that does, and it is a second instance of
the class §175 fixed on the pallet fork: a construction that assumes a spacing
it never checks.

### What is built

`makeColumnDriver` (`src/geometry.js`) cuts its outline as the HULL OF DISCS —
the hub, plus one tip disc per arm, joined by their external tangents. Per arm
it emits the arm's tip arc and then a hub arc across to the next arm:

```js
let a0 = a.az + th, a1 = nxt.az - thN;
while (a1 < a0) a1 += Math.PI * 2;
arc(0, 0, hubR, a0, a1);
```

`th = π/2 + asin((hubR − tipR)/reach)` is the correct external-tangent angle,
and is always **greater than 90°**. So when two arms sit closer together than
`th + thN`, their tangent points CROSS: `a1 < a0` is not a wrap, it is the
geometry saying *the hub is not exposed between these two arms at all*. The
`while` loop reads that as a negative sweep to be normalised and adds a full
turn, drawing the arc the long way round the back instead of omitting it.

### Measured, 2026-08-27

The driver has two arms — the pin slot at `az = 0` and the pawl post at
`postAz`, chosen by §163's branch scan, which currently lands about 40° away.
Sampled off the built mesh (`geometry.parameters.shapes`, 85 points):

| | |
|---|---|
| tip disc, post arm | r ≈ 7.05–7.55, az −43° … −35° |
| tip disc, slot arm | r ≈ 5.49–5.87, az −5.4° … +5.4° |
| hub arc 1 | r = 0.9667, sweeping ≈ 65° → 265° |
| hub arc 2 | r = 0.9667, sweeping ≈ 101° → 317° |
| overlap | ≈ 164° of hub drawn **twice**, in opposite directions |
| self-intersections | **31** |

Both hub arcs run across the back of the hub, so the outline doubles back
through itself and the boundary is not a simple closed curve.

### Why nothing saw it

The same reasons TODO 100 catalogues, plus one specific to this part: the
builder DOES assert something about its arms —

```js
if (hubR <= a.tipR) console.warn(`§163: ${name}'s hub … is not larger than the tip …`);
```

— which is the condition the TANGENT formula needs (`asin` of a ratio ≤ 1),
not the condition the HULL needs (arms far enough apart that hub is exposed
between them). The assert passes and the outline is still folded. An assert
that guards the arithmetic is not an assert that guards the shape.

### The repair

The `while` loop is the bug and deleting it is not the fix — an arc with
`a1 < a0` must be OMITTED, not normalised, because that is what "no hub
between these arms" means. Two arms whose tip discs are close enough should
be joined by their own mutual external tangent instead, which is the same
construction one level down and keeps the boundary arcs-and-tangents as the
header claims.

Then assert the condition that was missing, in the builder, next to the one
that is already there: for each adjacent pair, `nxt.az − a.az ≥ th + thN`, or
the hull is not the shape this code cuts.

**Open question worth measuring before choosing.** `postAz` comes from §163's
branch scan, which optimises clearance and knows nothing about this. If the
scan can return an azimuth that makes ANY legal arm pair too close, then
asserting is necessary but not sufficient and the scan needs the constraint
too — otherwise a future re-site trips a boot warning nobody can satisfy.

### CLOSED by §177 — and this item's own worst sentence is the finding

This item filed the following, and it was wrong:

> **Not in scope**: whether the folded outline changes what the driver DOES.
> `ExtrudeGeometry` triangulated it into a solid that has been passing every
> sweep, so this is a defect in the description, not a measured collision.

**It changed the metal.** A folded ring goes to earcut, earcut resolves the
fold however it likes, and a hole declared inside that ring can land on the
wrong side of the result. Measured on the shipped driver
(`tools/probe-column-driver.mjs`, 120 samples on a circle at 0.6·boreR):

| | bore interior | annulus just outside it |
|---|---|---|
| before | **120/120 FILLED** | 180/180 in metal |
| after | 0/120 | 180/180 in metal |

**The pivot bore was solid metal.** The driver had no hole to turn on — and
the part's whole job is to turn on `alarmColStud`, which
`INTRA_UNIT_CONTACTS` declares as a running fit at `PIVOT_BORE_CLEAR`. That
declaration is what excused the pair from the sweep, so the one instrument
positioned to notice had been told not to look. §169 wrote the same lesson
about a stud that measured 4.347 clear: *a declared joint is a claim*.

The open question about §163's branch scan is closed too, by arithmetic rather
than by measurement: `th = π/2 + asin(...)` is ALWAYS greater than π/2, so
`th_a + th_b` always exceeds π, so at most one of a driver's gaps can ever show
hub — at any azimuth, for any arm count. The old loop emitted one arc per arm
regardless, so with two arms at least one was always spurious. The scan needs
no constraint; the construction was unconditionally wrong.

The fix takes the boundary as what the header always called it: the convex
hull of the discs, walked as a monotone chain over sampled discs, which cannot
self-intersect and needs no case analysis about which gaps show hub. Cost: the
tangents are sampled rather than closed-form, under 1.3e-3 u of chord error on
the largest disc, against arcs the old code already sampled at 20 segments.
Net outline area 20.1711 → 23.2578, bbox unchanged at 6.941 × 5.899 — the part
does not reach further, it is simply whole. A new build warning fires if a disc
never reaches the hull, which is an arm asked for and not cut.

## 104. `INTRA_UNIT_CONTACTS` declarations are never audited against the metal — TIER A DONE (§182)

A declared row does not waive a measured overlap — it **skips the pair before
measurement**. `checkIntraUnit`'s `allowed()` is consulted inside the tier
loops and the pair `continue`s, so the check records nothing about it at all:

```js
const allowed = (u, la, lb) => contacts.some((c) => c.unit === u
  && ((c.a === la && c.b === lb) || (c.a === lb && c.b === la)));
…
if (seen.has(key) || allowed(u.name, la, lb)) continue;
```

The table is gated for **name** validity — `unmatchedSelectors` fails a row
naming a mesh that does not exist — and never for **geometric** validity.
Nothing asks whether a declared joint describes metal that is actually in
contact, or whether the contact it describes is the one that is there.

**It has stated something false twice, and both times were accidents.** §169
found `alarmColDriver ⇄ alarmColPawlSpringStud` naming a stud that measured
**4.347 clear** of the part declaring it — the row said the same thing about a
joint that was not there, and excused the pair from the sweep that would have
caught it. §177 found the other shape: `alarmColDriver ⇄ alarmColStud` declared
a running fit at `PIVOT_BORE_CLEAR`, and the bore was **solid metal** — 120 of
120 sample points filled, the part had no hole to turn on. The declaration was
right that the two overlap and wrong about what the overlap WAS. Neither was
found by an instrument aimed at it.

### Measured, 2026-08-27 — 141 rows over 29 units

Two runs, both off the built tree.

**What the declarations describe.** Resolving every row's labels the way
`collectUnits`/`meshLabel` do, and measuring `meshClearance` at rest:

| gap between the declared pair | rows |
|---|---|
| ≤ 0 — actually overlapping | **102** |
| 0 – 0.05 | 19 |
| 0.05 – 0.15 | 4 |
| 0.15 – 0.5 | 6 |
| **0.5 – 1.0** | **0** |
| 1 – 3 | 3 |
| > 3 | **6** |

unresolved: 1. So most rows do describe real contact, and **nine declare one
between parts that are 2.1 to 9.19 apart**:

```
9.1928  Alarm selector       alarmSelTab <-> alarmSelPost
8.2249  Alarm selector       alarmSelForkBracket <-> alarmSelPost
5.9792  Alarm winding train  alarmClimbPinion <-> alarmWindIdler
5.1643  Fusee & great wheel  maintPawl <-> CylinderGeometry#14
4.1442  Alarm winding train  alarmWindIdler <-> CylinderGeometry#5
4.0979  Alarm switch         alarmPusherStem <-> alarmPusherGuide
2.7140  Keyless works        settingWheel <-> TorusGeometry#30
2.3590  Alarm winding arrest spiderCageWheel <-> subFingerPinion
2.1367  Keyless works        settingWheel <-> BoxGeometry#31
```

These are NEW — §169's own row was retired when it was found. `CLEAR_MARGIN`
is 0.15, so a pair that never comes within 1.0 is not describing a contact.

**And a second number that needs its caveat, because it is easy to misread.**
Re-running `checkIntraUnit` with `contacts: []` — every excuse removed —
measures 220 intersecting pairs, and **96 declared rows are not among them**.
That is NOT 96 false rows. Two different things land in that bucket:

- pairs genuinely apart (the nine above, plus the running fits) — the table's
  own header says designed fits have CLEARANCE and read as apart, so a row
  documenting one is defensible;
- **pairs `intraUnit` structurally never compares.** Its tiers are MF, FF once,
  and MM ACROSS rigid frames. Same-frame mover pairs are `checkAssembly`'s
  domain by §121's own design, so a row declaring a wheel against its own
  arbor is inert *in this check* no matter how deeply the two interpenetrate.

That second class is a finding in its own right: **a declaration filed against
a check that cannot see the pair buys nothing and looks like diligence.** Those
rows arguably belong in `ASSEMBLY_WAIVERS` instead, and until someone decides,
they are 96 minus the apart-rows of unexamined paperwork.

### The work, in two tiers

**Tier A — a declaration must excuse something.** For each row, measure the
pair over the pose net rather than skipping it, and fail a row whose parts
never come within a threshold of each other. The empty 0.5–1.0 band is what
makes this gateable: the cut is insensitive to where in that band it sits, so
it is a measured separation and not a tuned number. Rows in the 0–0.5 cluster
are running fits and stay.

Two things this must get right or it will be switched off:
- **Sweep, do not sample.** The gaps above are REST pose. A pair apart at rest
  can close at another; nine rows at 2.1–9.19 will not, but a 0.4 row might.
- **Say which class a row is in.** A row inert because `intraUnit` never
  compares that pair must not be reported as a row whose parts are apart.
  Those are opposite defects and the same "excuses nothing" symptom.

**Tier B — the joint must be the one declared.** This is the half with teeth
for §177, and it needs a vocabulary: a `kind` per row from a closed set,
checked against its own invariant, exactly as `transfers` (§137) declares five
named idioms beside their metal. 79 of the 141 rows read as bore/stud-like from
their `why` text, and the `bore` invariant is the measurement that found §177 —
**the host must have a cavity there, and the pin must be inside the cavity
rather than the metal.**

Do NOT bulk-annotate the 141 rows with a `kind` inferred from their prose. A
wrong `kind` is a new false declaration, which is the defect this item exists
to catch.

**Not in scope**: `EXPECTED_CONTACT_FLOORS` and `RESTORING_WAIVERS` are the
same shape of question — a declaration nobody audits — and item 6 already
carries the first. Whether one instrument should judge all declaration tables
is worth asking once this one exists.

### Tier A, closed by §182

`checkIntraUnit` measures every declared row over the pose net now and fails
one whose parts never come within `DECLARED_CONTACT_REACH = 1.0`. Rows no tier
compares are REPORTED as their own class, as the item required; a row whose two
labels name the one same mesh is malformed and fails.

**It found two false declarations on its first run**, which is the tier's own
control — a check that has never caught anything has not been shown to work:

- `Alarm switch / alarmPusherStem ⇄ alarmPusherGuide`, **4.0979** apart. §170
  rotated the press line to run through the movement's centre; every member
  moved onto it except the guide boss, whose station kept the
  `+ _pushPerp·ALARM_PUSH_CHORD` term from when the line WAS the displaced
  radius. The pusher's outer bearing stood one `ALARM_DRIVE_OFFSET` beside the
  stem it bears. `tools/probe-182-guide-station.mjs` isolated it as purely
  lateral (perpendicular miss 5.0123; station and height both already right).
  Fixed in position space, plus two boot asserts — ON the line, and AROUND the
  shaft across the whole stroke — because the TODO 87 assert next to it holds
  the bore's SIZE against the stem's and never its PLACE.
- `Dial / alarmIndexWedge ⇄ ShapeGeometry#3`, **1.2056** apart, which is
  `DIAL_T + CLEAR_MARGIN` exactly. TODO 26 pulled the wedge's tip back to one
  margin behind the dial's BACK face when the dial stopped being a sheet; the
  row still read "stands proud THROUGH the face sheet by design". Retired.

**And the first cut of the audit was itself wrong, which is worth keeping.**
Resolving each row to a single mesh reported **10** apart rows. `allowed()`
excuses a LABEL PAIR, and a unit may carry several meshes under one label —
both maintaining pawls are `maintPawl`, both alarm-winding idlers
`alarmWindIdler`, both selector posts `alarmSelPost`, and `alarmSelTab` is four
meshes. Judged on the best matching combination the count is **2**; the other
eight were real joints measured against the wrong pawl. A false failure here
would have been a new false declaration — this item's own defect, pointed the
other way. Row `ratchet ⇄ maintPawl` says so in its own `why`, and the first
cut read past it.

### Residue tier A leaves, named

- **12 rows no tier compares** (`declaredNeverCompared` in the payload). Eleven
  are same-frame mover pairs and one is `alarmColPawlSpring ⇄ alarmColPawlPost`
  at 0.0484. Reported, never failed: nothing measured here establishes where
  such a row should live instead, and the item's own answer — `ASSEMBLY_WAIVERS`
  — is a decision, not a measurement. Whoever takes that decision has the list.
- **`nearestD` on a PASSING row is an upper bound, not a swept minimum.** The
  sweep stops refining a row once its verdict can no longer change. Rows that
  FAIL are re-measured unbounded, so the number anybody acts on is exact.
- Tier B is untouched.

## 108. `meshIntegrity`'s sub-body ranges are invalidated by any BVH build — CLOSED (§182)

`userData.subBodies` is a table of TRIANGLE RANGES — `{triStart, triCount}`
into the geometry's index buffer — and three-mesh-bvh's `computeBoundsTree`
**reorders that buffer in place** to group triangles spatially. So every range
names a different set of triangles after any check that raycasts.

`checkMeshIntegrity`'s tier 3 read the live index, which made its rows a
function of what ran before it in the shard. On one unmodified tree:

```
--only meshIntegrity           pairs  39 tested / 136 declared /   0 interior
--only support,meshIntegrity   pairs 527 tested /  50 declared / 134 interior
```

Both PASS. The gate holds *controls PASS and 0 malformed sub-body
declarations*; the pair counts and the 134 "interior overlap" rows are a
REPORT, so nothing was ever going to notice — and §81's sharding invariant,
that no check can observe which ones ran before it, was quietly false here.

**Measured, `tools/probe-182-subbody-index.mjs`.** 29 geometries carry a
sub-body table and none has a bounds tree at boot. After `support` runs, 16 do,
and all 16 have EVERY index entry moved — 576 of 576, 108 of 108, 2016 of 2016.

**Why it surfaced now.** It has been latent since sub-bodies existed. On `main`
the partition happens to put `support` and `meshIntegrity` on different shards;
§182 moved `intraUnit`'s cost column 3 → 11, the partition shifted, and they
landed on one shard. A cost column is not supposed to be able to change a
verdict — that is the whole basis of sharding — so this was fixed rather than
filed and left.

### Closed by §182

**The table and the order it indexes are ONE fact, so they are established
together.** `declareSubBodies(geo, bodies)` sets `userData.subBodies` and
captures the authored index order into `userData.subBodyIndex` in the same
call; both declaration sites go through it — `mergeGeos`' declared route and
the chain's rebuild. Tier 3 reads the snapshot. A geometry that has a bounds
tree AND no snapshot is reported malformed: the tier declines to answer rather
than answering from a shuffled buffer.

**A caller that HOLDS the authored order passes it**, and the chain must:
`chainBuf.idx` is a template buffer shared by every rebuild and handed straight
to the geometry's `BufferAttribute`, so a BVH reorders it in place and the next
rebuild emits from the shuffled template. `chainBuf.idxAuthored` is taken at the
stamp that writes the ranges, never handed to a geometry, and passed explicitly.
Boot's `weldTree` pass remains a BACKSTOP for a builder that assigns
`userData.subBodies` directly.

### It took two wrong fixes to get here, and both are worth keeping

**Anchoring the snapshot in boot's `weldTree`** covered 28 of 29 geometries and
missed the one that matters — `chainRun` never passes a boot-time traversal, so
its 87 bodies (the entire 174 → 87 drop) had no order to read. The acceptance
caught it as a gate FAILURE naming `Chain / chainRun`.

**Snapshotting at the declaration by reading the order back OFF the geometry**
was worse, and passed the acceptance I had. A snapshot EXISTS, so the malformed
guard stays quiet while the ranges describe a different tessellation: 0
malformed, 133 phantom interior rows, green gate. It survived because the pair I
tested could not see it — `support,meshIntegrity` reads 39/136/0 since nothing
rebuilds the chain in between. Add any pose-sweeping check and it reads
493/50/133; BOTH orderings of `support`/`axisEntry` fail, because
`resetInputs()` before `meshIntegrity` is itself enough of a rebuild once the
template is shuffled.

**The lesson is about the acceptance, not the code.** A single ordering is not
an order-independence test. Five are checked now:

| ordering | before | after |
|---|---|---|
| `meshIntegrity` | 39/136/0 | 39/136/0 |
| `support,meshIntegrity` | 527/50/134 | 39/136/0 |
| `support,axisEntry,meshIntegrity` | 493/50/133 | 39/136/0 |
| `axisEntry,support,meshIntegrity` | 493/50/133 | 39/136/0 |
| `intraUnit,meshIntegrity` | 39/136/0 | 39/136/0 |

The zero-area and inverted tiers are untouched: those are per-triangle
properties, invariant under a reordering, which is why their counts agreed in
both orders and only tier 3 moved.

**Residue.** Nothing else in the battery indexes geometry by triangle range
today. Anything that starts to must take its order from the same snapshot, and
this is the reason why.

## 105. The lever's safety action is modelled but not simulated

Split out of item 98, which cut the pallet fork as one blank and deliberately
left the safety action alone: it is a different mechanism from how the lever is
shaped. This is that mechanism.

**What is right, measured off the built tree 2026-08-27.** The geometry is
better than item 98's scope note claimed, and that note is corrected in place:

- **The crescent exists and is PHASED to the impulse pin.**
  `makeBalanceWheel` cuts the safety roller with `gap = 0.45`, so the missing
  sector spans −gap…+gap, centred on azimuth 0. The impulse pin sits at
  `(rollerR, 0, pinZ)` — azimuth 0. That is the derivation a real lever
  escapement needs: the passing hollow is cut where the impulse pin is, so the
  guard pin can only cross while the pin is engaging the fork.
- **The guard pin rides close and never touches.** Swept over a beat
  (48 samples), guard pin → safety roller reads **min 0.2356, max 0.7455**.
  Never touching is CORRECT for normal running — a safety action is a failsafe,
  not a working contact — and the ~0.51 of variation is the crescent passing.
- The impulse pin does reach the fork body: **0.0000**, the notch contact.

**So what is wrong is not the shape. Three things:**

### 1. None of the clearances are derived

`guardR = t·0.18`, the guard pin's seat at `(0, forkY + t·0.5, −t·0.7)`, the
roller's `srR = radius·0.2`, its `gap = 0.45`, the crescent's pull-in to
`srR·0.4` — every one is a chosen number. The measured 0.2356 is what they
happen to produce, not a clearance anyone asked for. Standing rule 1: the
governing constraint is that the guard pin must **clear the roller's full
radius in normal running and CATCH it when the fork is displaced**, which sets
a band the pin's radius and seat should be solved from. Nothing states that
band, so nothing can tell whether 0.2356 is generous, tight, or wrong.

### 2. The failsafe is never exercised, so nothing tests that it works

The safety action only acts when the fork is out of position, and **no axis
displaces the fork**. `AXES` moves the beat; it does not knock the lever off
its banking. So the guard pin's whole purpose is untested by construction, and
every sweep reports it clear because it is clear in the only situation anyone
samples.

This is TODO 29/§48's population argument exactly, and §48's own rule names it:
*ship a mechanism with its own input and you must ship the axis that exercises
it, or this passes it in silence.* Before TODO 29 no axis varied `alarmOn` and
the alarm lock was invisible for the same reason.

### 3. The horns are drawn but no horn-to-pin contact is measured

Item 98 got this one right. The fork's horns exist as metal and the impulse pin
passes between them, but the measured `0.0000` above is the pin against the
fork BODY as a whole — nothing isolates a horn. In a real escapement the horns
are the second half of the safety action: if the guard pin is passing the
crescent, it is the horn that catches the impulse pin. Whether these horns
could is unmeasured.

### The work

1. **Derive the band, then solve the pin to it.** The guard pin's radius and
   seat come out of "clears `srR` at every pose of normal running, fouls it at
   a displaced-fork pose", with both ends asserted at build.
2. **Add the axis that displaces the fork**, so the failsafe has a pose in
   which it must act. Without it, 1 is checkable only on the clearing half.
3. **Then measure the horn against the pin** as its own contact, the way
   `alarmHandoffs` measures the arming run's — a horn that cannot catch is a
   drawn horn.

Ordering matters: 2 before 1's second half, and 3 last, because a horn contact
is only meaningful once there is a pose where the guard pin has let the fork
move.

**Not in scope**: the dart. A real Swiss lever's guard is often a dart on the
fork's tail rather than a pin at the horns, and this is a pin. That is a design
choice, not a defect, and swapping it would change nothing this item measures.

## 97. Ambiguous mesh-name selectors excuse pairs nobody triaged

Filed 2026-08-25, from naming the selector's guide posts. One instance is
fixed in that landing; the class is not, and the class is the item.

**The mechanism.** `meshLabel` returns a mesh's NAME when it has one, and an
index only when it does not. Every table in `inspect.js` is string-coupled to
those labels. So when several meshes share a name, a selector naming it matches
ALL of them, and one declaration excuses every pair in the cross product.
`INTRA_UNIT_CONTACTS`' own header already says why that is the bad direction:
*"An accidentally-matched selector is worse than an unmatched one: it excuses a
pair silently."* A stale selector is a gate failure; an over-matching one is
invisible.

**Measured, over `INTRA_UNIT_CONTACTS` at the built tree: 18 of 144 rows match
more than one pair.**

| row | pairs excused |
|---|---|
| `alarmWindIdler(4) ⇄ alarmWindIdler(4)` | **16** |
| `alarmSelTab(4) ⇄ alarmSelPost(3)` | 12 (fixed in this landing) |
| `alarmWindIdler(4) ⇄ CylinderGeometry#5` | 4 |
| `alarmWindIdler(4) ⇄ CylinderGeometry#8` | 4 |
| `alarmClimbPinion ⇄ alarmWindIdler(4)` | 4 |
| `ratchet(2) ⇄ maintPawl(2)` | 4 |
| `alarmSetIdler(2) ⇄ alarmSetIdler(2)` | 4 |
| `alarmSelForkBracket ⇄ alarmSelPost(3)` | 3 (fixed) |
| ten more at 2 each | 20 |

**What the fixed instance cost, as the worked example.** The two selector rows
named `alarmSelPost`, and three meshes answered to it. Between them they
excused 15 pairs. Measured over the pose net, **four** ever touch — all on post
1 — while posts 2 and 3 stand **8.2 to 10.2 u away** and were being excused for
nothing. Naming the posts `alarmSelPost1..3` (the index in
`ALARM_SEL_POST_AZ`, so a reorder STALES the selector rather than silently
re-pointing it) took 15 down to 4.

**Blanket uniqueness is the wrong fix, and that is what makes this an item
rather than a chore.** Some collective names are CORRECT. `alarmSelTab` names
four meshes that ARE one fork — two plates flanking the groove and two side
webs — and two consumers legitimately want the group: the centre-pin handoff's
`selectB`, and the `centre pin ⇄ fork groove` floors row. Renaming those four
would break both. The `SLENDER` kind map has the same shape in reverse: it
keyed `alarmSelPost: 'pivot'` once for all three posts, which was RIGHT as a
class statement and had to become three entries when the posts were named.

So each site needs deciding, not sweeping: is this one part in several meshes
(keep the collective name, and the selector means the assembly), or several
parts wearing one name (name them, and the rows split)? `alarmWindIdler×4` is
the one to look at first — 16 pairs from a single row is the largest blanket in
the table, and four idlers in a train are almost certainly four parts.

**Unmeasured residue, named rather than implied.** Only
`INTRA_UNIT_CONTACTS` was counted. `EXPECTED_CONTACT_FLOORS`, the `transfers`
rows, the `restoring` table and the handoff selectors are all string-coupled to
the same labels and were NOT audited here; the same duplicate names are visible
to them. Whoever takes this should count those too before deciding the fix.

A cheaper structural option worth weighing against renaming: make `meshLabel`
disambiguate a repeated name by index (`alarmSelPost#12`), which turns every
existing ambiguous row into an unmatched — i.e. a LOUD failure — and forces
each to be re-declared as the pair someone actually inspected. That converts
this whole item into a one-time, gate-driven sweep, at the cost of moving every
label that currently repeats.

## 95. A sampling miss overrode a correct intersection, and published it as clearance

Filed 2026-08-25, and numbered 95 deliberately. 90 through 94 are spoken for
elsewhere: the watch-case branch files 90, 91 and 92 (band bores, seat ledge,
chord-mounted pusher) plus 93 and 94 from this same investigation, and they
land with PR #294.

**Note a collision that is already here, not hypothetical.** `main` now carries
its own **item 90** — the column wheel's output-side audit — while
`case-schematic` carries a different item 90 about the band's radial bores.
Two live branches, two item 90s, and TODO numbers are cited from source
comments and commit messages the way § numbers are. Whichever merges second
has to renumber, and the citations to it move too. Worth settling before #294
lands rather than during the merge.

`_meshClearanceInner` arbitrates a near-zero against `sampledVerdict`:

```js
if (d < 0.05) { const v = sampledVerdict(a, b, upperBound);
                d = v.inside ? Math.min(d, 0) : Math.max(d, v.d); }
```

The `Math.max` is right to exist — §82 records the vendor's tri-tri test
emitting FALSE ZEROS, and `probe-95-passthrough.mjs` enumerates about 200 of
them at one pose, including pairs 8 to 10 units apart. But it cannot tell a
false zero from a TRUE zero whose witness the sampling missed, and it resolves
that ambiguity towards CLEARANCE — the unsafe direction, and silent.

`sampledVerdict` samples POINTS: vertices and triangle-edge midpoints. A body
that passes CLEAN THROUGH another has none inside it — measured on the case
branch, a pusher stem whose vertices sit on its end caps in free space and
whose edge midpoints sit in a bore, crossing a wall 2.645 u thick. **No
refinement of point sampling fixes this**: the wall is thinner than the sample
spacing, which is the permanent condition of a pin through a plate.

**The fix is a SEGMENT test**, because no point test can work. A body passing
through crosses the other surface an EVEN number of times along one edge, and
that is the only witness its shape leaves. `segmentPierces` looks for two or
more distinct crossings strictly inside an edge, running only after point
sampling has come up empty, so the common case pays nothing. Its box cut is
exact in §122's sense, and crossings closer than 1e-7 are deduped — a ray
through a shared triangle edge can be reported twice, and two coincident
crossings are a graze, not a passage.

**What it makes visible here — six rows, every one PROVEN.** The geometry did
not change; these were all true of the shipped movement already.

| row | tier | shared grid points |
|---|---|---|
| `BoxGeometry#1 ⇄ alarmSelPost@12` | intraUnit MM | 12974 |
| `BoxGeometry#3 ⇄ alarmSelPost@13` | intraUnit MM | 12974 |
| `BoxGeometry#5 ⇄ alarmSelPost@14` | intraUnit MM | 12974 |
| `genevaFingerDisc ⇄ alarmArrestFingerArbor` | intraUnit MF | 3045 — real, but see TODO 107 |
| `alarmPusherStem ⇄ alarmPusherReturnSpring` | intraUnit MM | 793 |
| `Alarm disc ⇄ Hour wheel` (`ExtrudeGeometry#20 ⇄ hourTube`) | expectedContacts, min 0 vs floor 0.15 | 914 |

Proven by `tools/probe-95-grid.mjs`, which grids the two meshes' AABB
intersection and asks whether any point lies inside BOTH solids, voting five
oblique parity rays. It depends on neither the tri-tri test nor on
`segmentPierces`, so it judges the fix without circularity. **Do not validate
these with the raw library distance** — that is the instrument known to lie
about exactly this, and an earlier pass in this session did precisely that and
had to be retracted.

**But that probe asks parity of BOTH solids, and parity needs a CLOSED one** —
so before any of these rows could be trusted, the meshes had to be classified.
`tools/probe-95-interpenetration.mjs` does that first and then picks the only
witness the pair admits: both closed, sample each SURFACE against the other;
exactly one open, sample the OPEN one's surface against the CLOSED one; both
open, refuse and say so. Surfaces throughout, as a barycentric grid over every
triangle — never vertices.

| row | witness | verdict |
|---|---|---|
| `alarmSelBoss1 ⇄ alarmSelPost1` | both closed, both directions | REAL — post 0.0400 into the boss, boss 0.1087 into the post |
| `alarmSelBoss2 ⇄ alarmSelPost2` | both closed | REAL — 0.0400 / 0.1082 |
| `alarmSelBoss3 ⇄ alarmSelPost3` | both closed | REAL — 0.0400 / 0.1087 |
| `genevaFingerDisc ⇄ alarmArrestFingerArbor` | disc open, arbor closed | REAL, but NOT a joint — **TODO 107** |
| `alarmPusherStem ⇄ alarmPusherReturnSpring` | both closed | REAL, hair-thin — 0.0075 at closest against a 0.05 nominal fit |
| `ExtrudeGeometry#20 ⇄ hourTube` | both closed | REAL — 126 of 4800 tube-surface points inside the disc, **0.2885** deep |

**Row 6 was very nearly withdrawn on a false refutation, and that is the
expensive mistake to record.** It was measured 2.760 u clear radially about the
tube's own axis and written up as the witness's false positive — an instrument
defect to be fixed rather than a collision to be repaired. That 2.760 is the
disc's VERTEX span; its SURFACE reaches r 1.216, inside the tube's 2.050 bore.
CLAUDE.md records "vertices are not the surface" as a trap for PROOFS. Spent on
a REFUTATION it is worse, because nothing downstream re-examines a finding that
has already been called false.

**Row 4 is real too, and it is the one that is not a collision to fix in
place.** The pair is not an assembly and must not be declared as one:
`fingerBoreR = arborR + 0.05` (`src/geometry.js:2198`) is a designed running
fit, the same 0.05 the winding idlers use. The MESH does not honour it — rays
cast down the bore are blocked over 15.1% of its area, and over 4.3% of the
arbor's own footprint, by cap triangles spanning the hole. So the arbor's
surface genuinely crosses the disc's surface, exactly as the witness says,
while the drawing says 0.05 of air. Filed as **TODO 107**; its declaration must
come OUT of `INTRA_UNIT_CONTACTS` rather than shipping as an excuse.

**Two defects in the witness itself, both found by instrumenting it rather
than by reasoning about it.**

1. **The guard.** `segmentPierces` reads two crossings as "in, then out, so the
   segment was inside", and that argument holds only where the crossed surface
   BOUNDS a solid. Down an open tube's bore a segment crosses the wall twice
   and is inside no metal — which is what a bore is for; the same failure
   CLAUDE.md already records for the parity ray, inherited because both rest on
   the same premise. `boundsASolid` gates the witness on the DST surface being
   closed (edges keyed by POSITION — an index-keyed count calls a plain
   `BoxGeometry` open, 12 triangles and 24 "boundary" edges, and that mistake
   looks exactly like a fix). SRC may be open; what the argument needs is that
   the thing being CROSSED is closed.
2. **The hits come back unsorted.** `MeshBVH.raycast` returns them in traversal
   order, and the dedupe below it is a scan that assumed ascending. Measured on
   row 6: raw distances `3.4463, 2.9659, 7.1572, 7.6510`, and the scan dropped
   2.9659 as a duplicate of the crossing it had just passed. It can only ever
   UNDERCOUNT, so it cannot invent a passage — but hiding one is this witness's
   whole failure mode. Sorted before the scan now.

**Residue.** The `Math.max` stays, so a genuine tri-tri false positive with no
contained sample and no doubly-crossing edge still resolves towards clearance.
Closing that wants an exact triangle-triangle test at the library's reported
closest point, and is not taken here.

Beside it now sits a second one: **the guard trades a false positive for a
blind spot.** A pass-through between two meshes that are both open is invisible
again — the pre-TODO-95 behaviour, and the conservative direction, but only
because there is no sound witness to run, not because the pair was checked.
Measured (TODO 106), 34 of the movement's 717 meshes carry a genuine hole, so
that blind spot is small but not empty, and it is not distributed evenly: it
follows `ExtrudeGeometry` and the parts cut from outlines.

## 106. Open meshes silently degrade every parity witness in the repo — census the movement

Filed 2026-08-26, out of TODO 95. Every insideness test this repo owns —
`pointInsideTree`, `sampledVerdict`'s containment, `probe-95-grid`'s five-ray
vote, `segmentPierces`' two-crossing argument, and TODO 27's parity family —
works by counting ray crossings, and every one of them is valid **only against
a surface that bounds a solid**. CLAUDE.md states the trap ("An OPEN mesh reads
as a colliding one") and TODO 27 measured one instance of it. Nothing has ever
asked how many of the movement's surfaces qualify, so no instrument knows when
it is entitled to its own answer.

`tools/probe-106-open-census.mjs` asks. Measured over the built tree, 717
meshes:

| | meshes | what it means for parity |
|---|---|---|
| closed | 547 | sound |
| **holes** (an edge with 1 face) | **34** | **unsound** — a ray can enter and never leave |
| non-manifold only (an edge with 3+ faces) | 136 | usually two welded solids sharing a face; may still count correctly |

By geometry type the holes concentrate almost entirely in parts cut from
outlines: `BufferGeometry` 14, `TorusGeometry` 8, `TubeGeometry` 4,
`ShapeGeometry` 3, `ExtrudeGeometry` 3, `LatheGeometry` 2, and **0 of 143
`BoxGeometry` and 0 of 250 `CylinderGeometry`**. The 136 non-manifold meshes
are a different pathology and mostly the gear blanks — `ExtrudeGeometry` 128 of
them, where a tooth outline meets a hub.

### The finding this item exists to prevent repeating

**A boundary-edge census keyed on formatted coordinates is wrong, and it is
wrong in the direction that looks like a discovery.** The first run of this
census reported **484 of 717 meshes open (67.5%)**, including *every*
`CylinderGeometry` (250 of 250) and *every* `LatheGeometry` (67 of 67), each
with exactly 6 boundary edges. That number was about to be written up as the
headline of this item — a movement two-thirds unmeasurable.

It was an artifact of the census's own key. `(-1e-16).toFixed(5)` is
`"-0.00000"` and `(1e-16).toFixed(5)` is `"0.00000"`, so a lathe or cylinder
SEAM — where θ = 0 and θ = 2π produce the same point with opposite-signed zeros
— keys as two distinct positions, and every seam edge is counted once instead
of twice. The bodies were closed all along. Normalising through
`Math.round(v * 1e5)` with `-0 → 0` collapses them, and the count falls from
484 to 170. **The same key is in the shipped `boundsASolid`**, where it was
suppressing TODO 95's witness on 547 meshes that did not need suppressing.

Two general lessons, both already in `.claude/skills/instruments/SKILL.md`'s
catalogue in spirit and neither previously instanced there: a coordinate key is
a *tolerance decision* disguised as a string operation; and a census that
reports a shocking number should be run against a CONTROL whose answer is known
before it is believed — `BoxGeometry` was the control here, and the fact that
143 of 143 boxes came back closed while 250 of 250 cylinders came back open was
the whole tell.

### What is not done

1. **The 34 holed meshes are not triaged.** Which are holes that matter (a
   surface an instrument actually queries) and which are cosmetic is unknown.
2. **`boundsASolid` rejects non-manifold meshes too**, which is conservative
   and costs the witness 136 meshes. A 4-face edge (two solids sharing a welded
   face, both copies present) preserves parity; a 3-face edge does not. The
   check could split those cases instead of failing them together.
3. **No gate.** This is a REPORT. Making it a gate means deciding what the
   movement's target is, and 34 holed meshes is a repair bill, not a threshold.
4. **A pair whose sides are both open still has no witness at all.** That is
   TODO 95's named residue and this item bounds it rather than closing it.


## 107. The geneva finger disc's bore is not fully cut — cap triangles carry metal across the hole its arbor runs in

Filed 2026-08-26, out of TODO 95 row 4. **This is MODELING.md rule 1 in plan:
the rendered solid is not the authored one**, and it is the same failure
`makeGenevaFinger` already fought once and did not finish.

`ARREST_SPEC.fingerBoreR = arborR + 0.05` (`src/geometry.js:2198`) — a running
fit, the same 0.05 the winding idlers use for a wheel on a stud. The disc
should turn on `alarmArrestFingerArbor` with 0.05 of air all round. It does
not: `tools/probe-107-borecut.mjs` casts rays straight down the bore and finds

| | |
|---|---|
| bore area blocked by disc metal | **15.1%** (122 of 808 rays) |
| the ARBOR's own footprint blocked | **4.3%** (20 of 464) |
| where | a wedge at azimuth ≈ 240–276°, radius 0.156–0.166 |

So the arbor's side really does cross the disc's faces, which is what TODO 95's
pass-through witness reports — measured directly, the arbor's own side edges
cross the disc's surface at 0.6000 and 0.9167 along their length, exactly the
disc's two face planes, from a radius of 0.185 that is 0.05 inside the bore.

**The history matters, because the fix that is already there is the second
attempt.** `src/geometry.js` carries this comment above the hole:

```js
// The bore is written as an EXPLICIT POLYGON, not an absarc. This extrude
// runs at curveSegments: 1 … and at that setting an absarc is divided into a
// single segment — the hole collapses and the disc's metal closes over the
// arbor it is bored for.
```

The absarc was replaced by an explicit 64-gon and the symptom mostly went away
— from a bore fully closed to a bore 15% closed, which reads as fixed from
every angle anyone looked at. The remaining wedge is a TRIANGULATION failure,
not a path failure: the outline is a 1440-point polygon and the hole a
64-point one, and `ExtrudeGeometry`'s cap triangulator does not reliably
respect a hole that fine against an outline that fine.

### The repair

Not "add more segments" — that is tuning a symptom, and the last tuning is what
made this hard to see. Options, cheapest first:

1. **Match the hole's point count to the outline's angular resolution**, and
   derive it rather than fix it at 64 — the constraint being that no cap
   triangle may span the bore, which is checkable by the probe above.
2. **Cut the disc as a `Shape` whose hole is a real path and verify the cap**,
   asserting at build time that no cap triangle's centroid lies inside
   `fingerBoreR`. That is the MODELING.md rule 1 pattern: the builder exports
   what it actually cut.
3. **Drop the cap triangulator entirely** for this part and lathe the disc
   about its own axis, since it is a disc with a bore and a cutaway.

Whichever, the acceptance is `probe-107-borecut.mjs` reading 0 blocked rays
inside the arbor's footprint, and `intraUnit` no longer reporting the pair.

**Do NOT declare this pair in `INTRA_UNIT_CONTACTS`.** A declaration says "these
two are assembled and touching on purpose"; this pair is designed 0.05 apart
and is touching by accident. Declaring it would excuse the defect permanently
and silently, which is exactly what that table's own header warns about.

### Why every instrument missed it until now

The disc carries 135 bad edges — it is one of the 34 holed meshes TODO 106
counts, so parity witnesses were unsound on it, and a vertex-based radial span
reads the bore as correctly sized because **the bore's VERTICES are all at
0.2347**; only the faces between them carry the metal. It took a segment test
against the arbor, which is the one witness that reads faces rather than
points.

## 101. The alarm disc's arm runs through the hour tube — 0.29 u of steel, against a 0.15 floor

Filed 2026-08-26, out of TODO 95 row 6. Found by the pass-through witness, and
findable by nothing else in the bar: the `expectedContacts` row for
`Alarm disc ⇄ Hour wheel` had been reading a clean minimum for as long as it
has existed, because `meshClearance` was publishing the intersection as
clearance (TODO 95). **The geometry did not change — this was true of the
shipped movement already.**

`Alarm disc/ExtrudeGeometry#20` is the alarm hand's LEAF. Measured about the
hour tube's own axis, at the entered pose:

| mesh | world z | surface radius |
|---|---|---|
| the hand's BOSS (`ExtrudeGeometry#22`) | −10.76 … −10.36 | **2.667** … 3.300 |
| the hand's LEAF (`ExtrudeGeometry#20`) | −10.87 … −9.93 | **1.216** … 20.675 |
| `hourTube` | −12.86 … −4.28 | 2.050 … 2.500 |

126 of 4800 points sampled over the tube's SURFACE lie inside the leaf's metal,
**0.2885** at the deepest, against the row's 0.15 floor
(`tools/probe-95-interpenetration.mjs`).

Sampled the other way — 216 world points on the tube's wall (r 2.05 / 2.275 /
2.5 × 72 azimuths) at z = −10.40, inside the leaf's z span — **32 lie in the
leaf's metal**. So the leaf occupies part of the annulus the tube's wall needs,
at some azimuths and not others.

**What makes this worth reading rather than just fixing.** The boss's bore is
not an accident — `src/main.js:13354` derives it as
`(HOUR_TUBE_OUTER + CLEAR_MARGIN) / Math.cos(Math.PI / 24)`, and the comment
above it records exactly why:

> the bore is a 24-gon … its INSCRIBED radius is what faces the tube, so the
> vertex radius carries the 1/cos(π/24) correction — at a bare 2.65 the facet
> midpoints dipped to 0.1443 of margin (the expectedContacts floor row caught
> it).

So this pair has already been measured once, at the boss, with the faceting
correction derived properly and the instrument credited for catching it. The
LEAF sits in the same z band — it spans −10.87 … −9.93 against the boss's
−10.76 … −10.36, so the boss is a lip ON the leaf — and whatever opening the
leaf has around that axis is not the boss's 2.667. The part that got the
careful treatment is not the part that carries the metal.

**This is the shape of every finding in TODO 95**: a member of a pair gets
scrutiny, and the sibling mesh 0.1 away in z inherits none of it.

### Not yet established, and the fix should start here

**What the leaf's opening actually IS.** Two probes disagree about its inner
structure and the disagreement is unresolved: sampling the leaf's own surface
puts its minimum radius about the tube's axis at 1.216, while a parity walk
outward along one azimuth at z = −10.40 reads METAL at r = 0 and 0.5 and AIR
from r = 1.0 through 3.0 — which a closed surface cannot do without a boundary
inside 1.216. One of the two is measuring something other than what it says,
and **that must be settled before any metal moves**, because the repair
differs: a leaf with no opening wants a bore, a leaf with a small concentric
opening wants a bigger one, and a leaf whose opening is offset wants
re-centring. The collision itself does not depend on which — both witnesses,
and the 126-sample surface test, agree there is metal where the tube runs.

### The repair

The leaf must clear the tube by `CLEAR_MARGIN` with the same inscribed-radius
correction the boss already uses, and the constraint must be written once and
consumed twice rather than derived at each site. Either

1. **Cut leaf and boss from one bore constant** in `makeHand`, so a future
   correction cannot land on one and miss the other; or
2. **Lift the leaf clear in z**, if the hand's stack allows it — but
   `ALARM_HAND_Z` is a derived budget (§153 consumes this blade's keel height
   for the reserve sector's plane), so moving it is a layout change, not a
   local one, and P3's rule applies: solve it in position space or file it.

Acceptance: `expectedContacts` reports `Alarm disc ⇄ Hour wheel` at or above
0.15 with no waiver, and `probe-95-interpenetration.mjs` finds 0 tube-surface
points inside the leaf.

## 102. The pusher's return spring is tessellated inside its own running fit

Filed 2026-08-26, out of TODO 95 row 5. The alarm pusher's stem measures in
CONTACT with the spring wound around it, against a clearance the constants
derive correctly. **The design is right and the mesh is not** — MODELING.md
rule 1, and the whole error is one argument at one call site.

`src/main.js:22081` derives the coil's mean radius from the fit it must hold:

```js
const coilR = ALARM_PUSH_STEM_R + PIVOT_BORE_CLEAR + wireR;   // 0.32 + 0.05 + 0.066
```

so the wire's inner surface sits at `coilR − wireR` = 0.370 against a stem of
0.320 — **exactly `PIVOT_BORE_CLEAR`, 0.05.** Correct, and derived from the
constraint in the standing-rule-1 way.

Then `src/main.js:22213` builds it with `per: 6` — six path points per turn,
overriding `makeHelicalSpring`'s own default of 10. The coil's centreline is
therefore a HEXAGON of circumradius 0.436, and a hexagon's inradius is
`cos(π/6)` = 86.6% of that:

| `per` | path inradius | wire inner surface | clearance to the stem |
|---|---|---|---|
| **6 (as built)** | 0.3776 | 0.3116 | **−0.0084** |
| 7 | 0.3928 | 0.3268 | +0.0068 |
| 8 | 0.4028 | 0.3368 | +0.0168 |
| **10 (the builder's default)** | 0.4147 | 0.3487 | **+0.0287** |

The facet dip eats the entire 0.05 fit and 0.0084 more. `seg: 6` makes the WIRE
hexagonal in section too, which pushes the surface back out by up to 0.0088 at
its own facet midpoints — so the two faceting errors partly cancel and the pair
measures as a graze rather than a clear interference: 0 of 40,140 surface
samples inside, closest approach **0.0075**, and `meshClearance` reporting
contact. That near-cancellation is why it reads as noise instead of as a bug.

### The repair

Not "raise `per` until it passes" — `per` is a tessellation count and the
clearance is a constraint, so the constraint should pick the count:

```js
// the path polygon's inradius must not eat the running fit: coilR·(1 − cos(π/per)) < PIVOT_BORE_CLEAR
```

which needs `per ≥ 7` to clear at all and `per ≥ 10` to keep half the fit —
i.e. the builder's default was already right and the override is the defect.
Deleting `per: 6` is very likely the whole fix; deriving it is the fix that
survives the next spring. Check `seg` against the same rule while there, since
a hexagonal wire misstates the section `stockCensus` reads.

Acceptance: `intraUnit` reports no `alarmPusherStem ⇄ alarmPusherReturnSpring`
row unwaived, and the derived `per` is asserted at build time against the fit.
