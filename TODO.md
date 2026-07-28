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

Waived in `checkStockFloor` as accepted debt citing this item; the
waiver keeps every row visible in the report. Closing this item means
the alarm units clear their floors and their waivers are DELETED.

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
(4870–4871) and the alarm branch idler i1b (5696). Same fix shape: name
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

## 16. MOSTLY CLOSED — the alarm link was thickness-legal and structurally impossible

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

### FIXED — sections derived from §53's budget; one item deliberately left

**The pillar move was investigated and REJECTED on evidence.** Probing
every station along the chord showed the whole inboard run is under
dial-side hardware — which is *why* the two bushes sit where they do. The
4.5 mm cantilever cannot be shortened, so the fix had to be section, not
position. That is the opposite of what this item originally proposed, and
the probe is the reason.

**Both members are now derived from `SLENDER_TARGET`**, so they are sized
by the same number §53 measures them against:

| member | was | now |
|---|---|---|
| `alarmLinkShaft` | 0.09 mm, λ 100.5, **21 N/m** at the drive end | 0.335 mm, λ 27, **4075 N/m** |
| `alarmLinkBeakTail` | 0.12 mm square, λ 83.7, **10.2 N/m** | 0.12 × 0.372 mm blade, λ 27, **305 N/m** |

The tail is now a **blade, not a fatter square**: the load is vertical, so
the section grew in Z where the force acts and stayed at floor stock in Y.
That is what a real lever looks like, and it is what §53 rewards — depth
where it is loaded rather than fat everywhere.

The shaft's radius fell out of two independent budgets agreeing: §53's
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
than one to two orders below it.

**Still open, deliberately: the 36:1 beak lever.** Shortening the tail arm
means re-siting the rod, whose plate bores are literals carrying drift
asserts (`ALARM_LINK_ROD_XY`), so it is a §35-corridor change, not a
section change. The tail is also the chain's remaining weakest member —
it still bends 42% of its stroke at 20 mN, against the shaft's 7% — so if
anything here gets more work, it is that lever, and the two are the same
problem: the tail is long *because* the rod is far away.