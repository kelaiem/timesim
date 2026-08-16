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
refreshed 2026-08-11 — items with work left first, with what remains:

| item | state | what remains |
|---|---|---|
| 4 | OPEN | A bucket of smaller findings; some rows closed by BUILT §61, the rest live |
| 5 | MOSTLY CLOSED (§121) | All three pair classes instrumented; the FF/MM gate covers `INTRA_TIER_SCOPE` (the alarm complex, 42 rows triaged against measured depths) and REPORTS 202 rows elsewhere — that triage is the remainder. Same-frame splits outside `ASSEMBLY_SCOPE` are §107's residue; transients are item 7's |
| 6 | MOSTLY CLOSED | An EXPECTED pair without an `EXPECTED_CONTACT_FLOORS` row still gets the blanket excuse (§94 tier A seeded the SMALL-SECONDS station's three pairs; item 41's closure seeded `Dial ⇄ Power reserve`; `Power reserve ⇄ Power-reserve train` is still unseeded) |
| 7 | OPEN | Sampling cannot BOUND motion — every sweep-based gate inherits this |
| 11 | OPEN | The alarm-stock residue after three tranches; the remaining waived rows are catalogued in the item |
| 12 | PART CLOSED | 11 rows of the 0.05–0.12 band remain, bound-or-band, catalogued per-row |
| 15 | PART CLOSED | Winding + setting chains closed; two sites remain |
| 16 | PART CLOSED | One item deliberately left, recorded in place |
| 17 | MOSTLY CLOSED | The hammer still strikes in-plane |
| 28 | MOSTLY CLOSED | Nothing — its last remainder (the lock's return) closed as item 31 (§102); the heading keeps MOSTLY CLOSED only because the profile/drive rebuild it records was never the whole item |
| 29 | MOSTLY CLOSED | The Dial row — the one entry left in `RESTORING_WAIVERS` |
| 30 | OPEN | §76's walls two and three (wall three was misdiagnosed; the crash is fixed, the wall stands) |
| 34 | OPEN | The §36 sleeve validation measures its dilation from the sweep that then approves it |
| 36 | TIER ONE BUILT | Higher tiers — a spec can change which PARTS EXIST, and liveness cannot see that (§87's addendum) |
| 40 | PART CLOSED | Rows 1 and 2 closed; row 3 most of the way, one named term left |
| 46 | CLOSED (§124) | The chain rode the fusee base on one CORNER (1.9–2.5 u of daylight, invisible to the burial-only row). Closed by the layout: first stage re-geared 8:1 → 120/7 so the fusee runs 1.75 wraps over 2 grooves at pitch 1.389, set-up 17 → 23 clicks, level product held; links LEAN to the flank on the funded FUSEE_TILT_Z raise. Ideal torque law exact again; the new float row gates the seat at 0.202 unwaived (was 3.191 waived) |

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
| Alarm switch | `spring` | the click arm's own blade, `switchClickSpring` — a real mesh, which §48's geometry guard checks |
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
  as filed above — the climb station *does* follow the plate through
  `ALARM_CD ← RESERVE_LOCAL.y ← dialRadius ← plateR`. It is two constants
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

## 40. The fusee equalises now — and the chain is nearly a constant length

**Rows 1 and 2 are CLOSED.** The cone is cut to the equalising hyperbola
and the readout reads the radius the chain is on. **Row 3 is most of the
way**: the two spools now balance exactly, and one named term is left.

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

**What is left is ONE named term: the free span.** Its length is
`√(D² − (DRUM_WRAP_R − r(t))²)`, so it shortens as the take-off radius
falls — ~1.4 of chain, ~1.1% of the run, that nothing takes up (measured
on the mesh under item 32's law: vertex count swings 1.10% over the
reserve, the same order as before). Item 32 opened the spring's
proportions and deliberately did NOT absorb this term, for a reason the
derivation makes concrete: the law's closed form `u(t) = √(θ_s² + β·t)`
integrates `dC/dt = 2π·W·r` with every unit of chain exchanged cone↔drum,
and adding the span's give turns the self-consistent solve into an ODE
with no closed form — a numerical integration whose output would then cut
the cone. That is buildable but is its own step with its own instrument
(`D` also drags the drum's STATION into the wind accounting), so it stays
filed. `DRUM_ROT_FULL` is 1.3386 turns under the derived law.

**And nothing asserts any of this.** The chain is display-only, the sweeps
see a rebuilt mesh as a mover and never compare its length across poses,
and no check states that a chain is a fixed length of steel — the hole
`devLen` closed for the mainspring in item 1. The instrument is the real
remainder of this row: assert the run's length is constant across the
reserve axis to a stated tolerance, and the 1.1% above is what it would
report on day one.

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

## 47. The fusee end of the chain is hooked to nothing

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

**Filed by §47's scope guard**, which named it rather than absorbing it.

## 48. The going stem's one-way has no metal

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

**The fix.** The going side's one-way lives at the plate-top ratchet the
winding spur's own comment already describes (`RATCHET_TEETH` is that
wheel's count). Give it the §99 treatment: a click with a generated
working face on the ratchet's cut law, its stud solved by the obstacle
scan, and the bank taken out of stored state the way `settleAlarmClick`
takes the alarm's give-back — after which `windStemSlip` is a consequence
of a modelled contact rather than a bookkeeping term.

## 49. `setPathRot` is not persisted, so the setting train re-phases on reload

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

## 50. Chain ⇄ three-quarter plate is 0.117, under the shared margin

§47 owed this measurement and took it: nothing in the battery had ever
measured the gap between the top coil at full wind and the plate's
underside, and the arrest needed the number to know whether anything could
pass over the coil. Measured over the discrete link layout the mesh
actually lays: **0.117**, against `CLEAR_MARGIN` 0.15. The build asserts
the SIGN (contact is the regression) and publishes the number as
`WIND_ARREST.chainTqGap`; the margin itself is not met.

It is not a collision and nothing rides there — the arrest's own members
keep clear of it by construction. But it is a declared clearance the
movement does not honour at its tightest station, and it bounds anything a
future entry might want to run over the cone. **The fix is z, and it is
the §51 pattern:** either the plate rises (its underside is set by
`TQ_MEASURED_MAX` against the hairspring stack — the binding part is
named, so the cost is priced) or the cone's band drops. Re-measure with
the same law after either move.

## 51. The winding arrest's finger fouls two neighbours it should clear

`expectedContacts` (the per-contact floors over EXPECTED pairs, TODO 6's
instrument) measures the §126 arrest against two of its own declared pairs
at **min 0** — genuine contact where the row asks for `CLEAR_MARGIN`, with
the declared working contacts excluded. Both are POSITION-space defects in
the finger's own members, not in the arrest's mechanics: the beak⇄lug
hand-off, the pad⇄coil hand-off, the penetration budgets, the stock floors
and the intra-unit joints are all green, so the mechanism holds and its
accommodation does not.

**Row one — `windArrestBeakArm ⇄ chainRun`, at beat f=0 (full wind).** The
arm's ends both stand outside the wrap's reach; the SEGMENT between them
does not. A straight bar between two clear points dips closer to the axis
than either end, and `ARM_STOP_R` is derived from the wrap's reach at the
arm's band and then applied only to the riser's station — so the chord
crosses the coil the endpoints avoid.

**Row two — `windArrestPad ⇄ windArrestLug`, at reserve f=0.6333.** The
finger's band is set under the BRACKET (`HUB_Z2 = BRK_BOT − PIN_GAP`), but
the pad rides at that band and the lug sweeps past it once per cone turn,
so the lug's orbit is the second ceiling and it is the lower one: measured,
0.035 separates them where the pair's row asks 0.15.

**The fix, both in position space (P3 — never out of the mechanism).**
Row one: solve the riser's station against the arm's CHORD-minimum radius
rather than its endpoints, flanks included. Row two: take the finger's band
as `min(BRK_BOT − PIN_GAP, LUG_Z1 − CLEAR_MARGIN)` so whichever ceiling is
lower wins. Both were attempted together in one pass and REVERTED unbuilt:
each moves `padZMid`, which moves the wall lean, the rest radius and the
stud — and the beak-azimuth scan then found no candidate at all. That is
the honest shape of the work: the two ceilings must be folded into the
azimuth solve as constraints it searches under, the way the webs, the
window rim and the drum's reach already are, rather than applied to a
geometry the solve has already fixed.
