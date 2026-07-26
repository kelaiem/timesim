# TODO — mechanical realism backlog

Open work on the movement's mechanical honesty, kept here because it was
previously living only in chat transcripts and a session-local task list.

Most of these came out of a mechanical-engineering realism review that ranked
the movement's gaps by how badly they undermine "could this watch actually be
built". The support-structure findings (items 2, 3, 4, 7 of that review) are
closed — see *Recently closed* at the end. What remains is listed here.

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

## 1. The mainspring is not a force source (HALF CLOSED)

The spring spiral is a child of the drum whose rotation/scale are a direct
*readout* of tension (`main.js`, `springChild` in `tick()`).

CLOSED half: the inner-end anchor and set-up ratchet now exist — the
`Set-up work` unit puts a static collar + hook pin on the drum arbor at the
spiral's heart, and the arbor ends in a plate-top square carrying the
classic set-up ratchet + click (static in service, exactly like the real
thing). The drum→chain torque path now closes on a fixture.

REMAINING half: the spiral's wind state is still a scale/rotation readout
rather than a keyframed morph whose inner boundary follows the (now
anchored) arbor and whose outer end follows the drum wall — the
makeHairspring wind-keyframe trick would close it.

## 3. CLOSED — `handSetOffset` derived through the setting path

Closed by the jumping-minute setting (BUILT §1): the hand-set value is
now `rawSetOffset`, computed forward from the crown's rotation through
the real tooth counts (windPinion → settingWheel → minuteArbor compound →
cannon), then quantized to whole minutes by the star + jumper while the
crown is out (the snap folding into a persistent correction on push-in).
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
  `PENETRATION_BUDGETS` to pin-in-notch and chain-on-cone; allowed phase
  windows per budget; a continuity check for linkage branch flips; a
  known-good baseline so re-runs only flag regressions.

## 5. The inspector cannot see INSIDE a unit

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

## 6. `EXPECTED` is granted per PAIR, not per contact

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

**Fix, in two parts.** The instance: re-solve the star's root diameter
or the tube's outer radius so the gap is a derived margin rather than
an accident — the star's tooth depth already derives from its pitch
(PR #33), so this is the same solve extended to the sleeve. The
structural half: EXPECTED should name the CONTACT, not just the pair —
either a region/part qualifier, or a paired `CLEARANCE_BUDGETS` floor
that says "these two units may touch HERE, and must keep the margin
everywhere else." The second form is cheaper and uses machinery that
already exists.

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

## 8. The alarm cannot ring under fast-forward

**The whole trip is gated off.** `if (!fastForward && syncPhase !==
'catchup')` opens at `main.js` ~9594 and closes ~9670, and inside it sit
the pin-drop computation, the release gate and `alarmReleased = true`.
So with FF on, the feeler is never evaluated, the pin never moves, and
no release can fire.

**The block's own comment says the opposite.** §29 step 5 reads: "One-
shot per drop (alarmDropSpent re-arms when the pin lifts), which also
makes FF/catch-up jumps honest: landing mid-window rings once, exactly
as the skipped time would have." Nothing can land mid-window when the
section does not run. The code and the comment describing it disagree,
which is the tell that one of them was changed without the other.

**Measured, on a clean load with no test scaffolding:** mainspring
wound, alarm wound (barrel 1.75) and armed, target 12:00, fast-forward
on — 30 sim-hours elapsed, which crosses the coincidence twice, and
`alarmPinDrop` never leaves 0.0 and `alarmReleased` stays false. The
same setup with FF off rings. That A/B is the whole bug.

**Why it is not merely cosmetic.** Fast-forward is the ONLY control
that reaches the alarm time in reasonable wall-clock: the time-scale
slider spans 0.001x..1x and cannot speed the movement up at all. So the
one path a viewer would take to watch their alarm fire is the one path
on which it cannot.

**Not obviously a simple deletion.** The `syncPhase !== 'catchup'` half
probably IS deliberate — firing during a §9 catch-up would ring for a
time the viewer is skipping THROUGH rather than arriving at. The FF
half looks like it was carried along with it. Whoever fixes this should
decide the two separately, and say which semantic they want: does a
fast-forward THROUGH an alarm time ring once (the comment's claim), or
not at all (today's behaviour)?

**Sizing note for whoever takes it.** At FF the sim advances ~1.5
sim-minutes per tick, and the pin's full-drop plateau is ~2.76 minutes
wide, so a tick is guaranteed to land inside it — simply ungating may
be sufficient, with no crossing-detection needed. Verify that before
building anything more elaborate. But note the margin is only 1.8x, so
it is worth asserting rather than assuming, and it SHRINKS with any
change that narrows the notch — which is exactly what §38 proposes.

## Recently closed

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
