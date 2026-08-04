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
  `PENETRATION_BUDGETS` to pin-in-notch (chain-on-cone and chain-on-drum
  landed with §61's true groove seating); allowed phase windows per
  budget; a continuity check for linkage branch flips; a known-good
  baseline so re-runs only flag regressions.

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
than one to two orders below it.

**Still open, deliberately: the 36:1 beak lever.** Shortening the tail arm
means re-siting the rod, whose plate bores are literals carrying drift
asserts (`ALARM_LINK_ROD_XY`), so it is a §35-corridor change, not a
section change. The tail is also the chain's remaining weakest member —
it still bends 42% of its stroke at 20 mN, against the shaft's 7% — so if
anything here gets more work, it is that lever, and the two are the same
problem: the tail is long *because* the rod is far away.

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

### CLOSED — the stepped arbor

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

## 26. MOSTLY CLOSED — the dial is a plate now; the works stand behind it

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

**What keeps this MOSTLY closed rather than closed**: the dial's back face
is flat where it matters but the sub-dial apertures are still through-holes
with a floor hung in them rather than a blind pocket machined into the
plate, and the dial's thickness is one constant rather than a profile (a
real dial is thinner at its rim). Neither reaches into any lane, so neither
is load-bearing — filed here so the next reader knows the difference.

**Do NOT waive this by widening the setting run's clearances** — the run
is correctly placed for the dial it was given. The dial is the defect.

Filed rather than fixed because step 2 is the whole dial side, and doing
it under a §76 balance-growth banner would bury an architectural change
inside a layout experiment. §76's wall one now cites this item.

## 27. Fasteners are modelled; the openings and heads they need are not

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

### What closing this looks like

Rows 1 and 2 are the same edit twice: pass the seats as holes. The plate's
screw seats join `tqHoles` (they are already solved — `pillarSeats` — and
§62's `seatClearance` already reads the windows, so the ordering exists),
and the link plate's stadium gains two `shape.holes` at the rivet centres it
already names. Both want the counterbore convention the chatons use: cut
through at the head diameter, put the bearing land back underneath, so the
recess has a floor rather than being a bare hole.

Row 3 is a shape change, not an opening: the pin gains an upset head at each
end — a short flare proud of the outer face — or the outer plate gains a
countersink and the pin a matching taper. Either way the number to state is
how far proud, derived from real chain practice rather than chosen.

**Do not close this by widening a clearance or waiving a row** — nothing is
currently failing, which is the point. The fix has to add geometry, and the
instrument gap has to be closed separately or the next instance will be just
as invisible as this one.

## 28. The column wheel: zero-thickness gaps, a ramp where a pillar should be, and a lock that animates instead of being lifted

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
