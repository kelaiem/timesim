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

## 9. `ALARM_LINK_ROD_SEAT` is measured, not derived

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

## 10. `Minute jumper ⇄ Dial` measures exactly 0.1500 and nobody knows which surface sets it

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

## 11. The alarm work is built at quarter-to-half-scale stock

§50's floor found it and the census had already predicted it: **every
alarm unit carries stock at 0.015–0.10 mm against the 0.12 mm wheel
floor** — the feeler spring at 0.015 (HALF the cited real-spring floor
of 0.03), the disc's selector fingers at 0.0187, the selector ring and
face cam at 0.0375, the column wheel at 0.0825, ~50 meshes in all
across fourteen units (including the alarm heart riding the Hour wheel).

**Why it is not a bulk scale-up.** §29's re-stratification bought the
alarm's z corridor **with thickness** — these parts are thin because
the dial-side band they occupy is thin. Thickening them in place
overflows the corridor §29 solved; the honest fix re-buys z (a
different stratification, or accepting a taller movement) and is a
design task, not a multiplier.

Waived in `checkStockFloor` as accepted debt citing this item; the
waiver keeps every row visible in the report. Closing this item means
the alarm units clear their floors and their waivers are DELETED.

## 12. The 0.05–0.12 band — first tranche closed; the remainder is catalogued per-row

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
- **still-to-locate free candidates**: the drum's mainspring hook rib
  (0.298 u — the coil and hook are the MAINSPRING, i.e. spring stock;
  name the meshes at build and declare, don't thicken), a fusee step
  disc (0.292 u, computed literal), the small-seconds boss (0.28 u) and
  hand blades (0.21 u — the measured depth does not match `depthMin`,
  so the hand builder needs reading before an aesthetics change).
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
  where `alarmSetRot` moved.)

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
