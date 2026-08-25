# Modeling quality guidelines

Rules for keeping the movement's geometry mechanically honest. Each rule here was
paid for by a real shipped defect; the heart-cam ⇄ reset-hammer fix (see the
`fix/heart-cam-hammer-collision` history) is the reference example for most of them.

## Clearance math

### 1. Model the rendered outline, not the authored shape

`ExtrudeGeometry` bevels expand every outline in XY by `bevelSize`, and at sharp
corners the miter multiplies that expansion by `1/cos(θ/2)` (three.js clamps the
divisor at 0.1, so a sharp corner can stick out several times `bevelSize`). The
hammer head's corner expands ~2.3× its nominal bevel; clearance math that ignored
this under-measured a real penetration by 20%.

Pattern: part builders export their true 2D outline and bevel via `userData`
(`makeHammerLever` → `userData.{outline, bevel, rollerR, bossR}`, `makeHeartCam` →
`userData.bevel`), and every placement solver consumes those exports. Mesh and
math share one source of truth, so upstream dimension changes re-solve
automatically. Extend this pattern to any builder whose part participates in a
clearance.

**A builder that cannot export through `userData` exports a FUNCTION** — the
same rule where the consumer runs before the mesh exists. `gearOuterR` (§115) is
that case: plan-time declarations bound `makeGear` bodies thousands of lines
before they are built, and two of them wrote `module·(N/2 + 1) + bevel`, which
is not the radius `makeGear` reaches. Its addendum is 0.95·module, and its tooth
tip is RELIEVED through a control point at `TIP_RELIEF` past the tip circle, so
the metal stands outside the nominal addendum circle — measured, the 64T
governor wheel reaches 7.361 against a declared 7.308. The builder and the bound
now share `gearTipR`, `gearBevel` and `TIP_RELIEF`, so a change to any of the
three moves both. **Bevel is not the only thing that puts metal outside an
authored circle**; a tip relief, a tessellation chord or a mitered corner each
do it, and none of them appears in the dimension the part was designed to.

**And the same growth runs INWARD wherever the outline turns concave.** A
bevel expands the outline along its outward normal, and inside a NOTCH that
direction points INTO the slot: each wall creeps `bevelSize` back toward
whatever the notch holds. The pallet fork's set stone stood 0.046 inside its
own slot walls this way (a hand-set 0.05 gap against a 0.096 bevel), and §34's
alarm setting wheel hit the identical arithmetic (0.05 vs 0.045). The repair
is the rule: DERIVE the seat gap from the bevel — `gGap = armBevel +
SEAT_SHOW` (`src/geometry.js`, the fork's `stoneAndArm`) — so the two cannot
be edited apart. Since §121 the fixture-pair tier of `intraUnit` measures the
class (both members static, exactly what the mover/fixture split never
compared); the derivation remains the stronger guard, because an instrument
finds the defect after it is built and a derivation makes it uncuttable.

**A bevel is a DISTANCE, and it only reads as a radius where the normal is
radial.** `r(θ) + bevelSize` is the dilated outline exactly at a stationary
point of `r` — a notch floor, a lobe tip — and short everywhere the profile
slopes, by the cosine of the angle between the normal and the radial. The
seconds-reset heart's flanks lean 27° off radial at their steepest, and a
contact solved on `r(θ) + bevel` left a residual 0.001 of roller inside the
flank that no amount of solver resolution moved (TODO 47). The trap is that
the two models AGREE at the notch and the tip, which is where anyone
verifying against the mesh naturally measures. The repair is to stop treating
the bevel as part of the shape: the beveled body is the Minkowski sum of the
cut outline with a disc of radius `bevelSize`, so its distance field is the
outline's minus `bevelSize` — measure against the UNBEVELED curve and
subtract. That form is also the one that composes, because the other body's
own radius subtracts the same way.

### 2. Seat surface-to-surface, never center-to-surface

When part A rests on part B, the formula must sum **both** parts' surface offsets
— local radius *and* bevel of each. The hammer's roller was seated with its
*center* at the cam's notch-floor radius, sinking the roller body its full radius
into the cam. Correct form:

```
hammerPivotDist = rMin + camBevel + rollerR + armLen   // tangent contact
```

### 3. Assert contact poses for phased parts

Anything phased — cam notches, escape-tooth seating on pallet stones, gear-mesh
interleaving — can be wrong by a sign or by π while *looking* plausible, especially
where a display value is re-referenced rather than mechanically derived. The cam
notch pointed 180° away from the hammer for its whole life because the reset
visual still landed on zero. Verify phase by **measuring the contact pose**
(e.g. "roller sits at cam-local 0.0°"), not by watching the animation.

### 4. Sweep the full pose space

The rest pose proves nothing. The hammer/cam interpenetration existed only near
cam bearing ~326°, twice per minute, while running. A pair check must sweep the
full product of poses the pair can reach: cam revolution × crown states × lever
swings × wind states. Use `window.__clock.setPose(...)` / `step(dt)` to drive
poses deterministically.

### 5. One margin, bound exactly

Use a single named clearance margin per constraint (e.g. `HAMMER_SWING_MARGIN =
0.35`) and let solvers bind **exactly** at it. That makes verification
falsifiable: the post-fix sweep reads `+0.3500` — anything else means the solver
and the mesh disagree.

### 6. A part that changes SHAPE is a moving part

Some parts move without moving: the hairspring breathes and the mainspring
winds (TODO 1) by swapping a precomputed geometry frame while their matrix
stands still. Two consequences, both learned the expensive way.

**Build the states as distinct geometry objects, never by rewriting one
geometry's positions in place.** The inspector caches a BVH per
`BufferGeometry`. An in-place morph keeps the same object, so every sweep
after the first would measure the *boot pose's* surfaces — silently, with
every gate green. Distinct objects are what that cache keys on.

**And check that the instruments can still see it.** `intraUnit` derives its
mover/fixture split from each mesh's unit-relative matrix; a morphing part
reads as a FIXTURE there, and fixtures are only ever tested against movers.
Replacing a rigid rotation with an honest morph therefore *removes* the part
from the check unless the signature also carries `geometry.id` (it does now).
The same shape of question applies to any instrument keyed on pose: ship a
morph and ask which checks stop watching.

**And its DRAWING has to swap too** (§83). The §66 schematic tier gets a
posed part's proxy for free, because the proxy is parented to the group the
tick moves — a morph moves no group, so a proxy hangs there frozen while the
metal changes shape. Both morphing springs now publish their frames as
polylines (`userData.spiralFrames`, indexed by `userData.spiralFrame`) and
call the one writer, `writeSpiralLine`, from inside `setWind`. The hairspring
shipped drawn at rest for exactly this reason, with the residue declared in a
comment rather than fixed, while the mainspring beside it — same section, same
file — was already riding its frames. If a new morph is worth drawing,
publish its frames in the same shape; if it is not worth drawing, say so where
the glyph would have been.

### 7. Geometry reaches the scene INDEXED, and the weld is the pass that does it

`ExtrudeGeometry`, `toNonIndexed()` and hand-written triangle soup all store a
vertex once per adjacent triangle, and the inspector pays for the duplicates in
three places: `bvhFor` builds its tree over the raw position count,
`sampledVerdict` tests every vertex and every edge midpoint of both meshes in
both directions, and the §36 pose walk transforms every vertex at every
distinct pose state. §81 added `weldGeometry` / `weldTree` (`geometry.js`) and
runs the pass once over the scene at the end of boot; `weldAssert` warns —
standing rule 6 — if anything reaches the scene non-indexed after it.

Three things to know before shipping a new builder:

**The traversal only sees the graph.** Geometry built after boot, or held in a
pool with one member installed at a time, has to weld itself. The chain welds
its three TEMPLATES (it is N rigid copies of them, rebuilt every frame — welding
the output would move a boot cost into the frame loop) and the flute slider
welds each re-cut hand. The mainspring's and hairspring's wind frames need
nothing, because `weldTree` deliberately skips geometry that is already
indexed and `TubeGeometry` is.

**The key is the whole attribute tuple, not the position.** That is what keeps
a crease's two normals two vertices, so `facetFlat` in `makeHand` stays
flat-shaded and nothing about the finish moves. Measured over the scene's 488
distinct geometries, before and after the pass:

| | pre-weld | welded |
|---|---|---|
| raw vertices | 653,950 | 458,897 |
| distinct attribute tuples | 437,566 | **437,566** |
| distinct positions | 124,998 | **124,998** |

Both bottom rows are the acceptance, and they are equalities rather than
ratios. Tuples unchanged ⇒ not one split normal was merged or invented.
Positions unchanged ⇒ `sampledVerdict`'s sample set is exactly what it was,
which is the whole reason the battery's numbers can be required to be
identical. (Don't reach for a screenshot to check the first one: measured, the
same tree rendered twice through SwiftShader differs in 3.2% of its pixels —
the camera-preset tween and the software rasteriser are noisier than any weld,
so the control drowns the signal. Count tuples instead.)

It also caps what the weld can recover, and the cap is large: 653,950 → 458,897
is 29.8% removed, where position-only welding would reach 124,998 — 80.9%. That
whole difference is split normals. They are not duplicates; they are the model,
and this is the cheapest place in the codebase to mistake one for the other.

The welded copy also carries `geometry.type` forward, and that is load-bearing
rather than cosmetic: `meshLabel` names an unnamed mesh `${geometry.type}#${i}`
and `INTRA_UNIT_CONTACTS` is string-coupled to those labels, so a welded
`ExtrudeGeometry` becoming a plain `BufferGeometry` un-declares every joint
declared against it. Measured when it happened: 14 declared joints re-reported
as violations with not one distance changed. Read `type` as PROVENANCE — which
builder cut this surface — not as an instance test.

**Never weld to a tolerance.** Snapping positions can only ever UNDER-report a
clearance, by up to the tolerance, and under-reporting is the one error
direction no instrument downstream catches. Exact bit equality or no merge.

**A wire given volume is swept by hand, and both ends are capped.** Every
`TubeGeometry` in `geometry.js` is built `closed = false`, so it ships with two
OPEN ends — and an open mesh reads as a colliding one to `meshClearance`'s
parity raycast, whatever it is nowhere near. Both of the movement's swept
springs are therefore built directly: `makeHelicalSpring` (§164) and
`makeTorsionSpring` (§169) emit their own rings and close each end with a
triangle fan. §169's is the one to copy if a third arrives, for two reasons.
Its frame is PARALLEL TRANSPORT rather than §164's outward-from-the-axis
radial: that reference is exact for a bare helix and degenerate the moment the
path has a straight leg pointing at the axis, and a real spring is a leg, a
helix and a leg. And it publishes the DEVELOPED LENGTH it actually swept, so
the caller's rate solve reads what was cut instead of πDn — `makeHairspring`'s
rule, one sampling and one answer. The two differ by the chord error of a
polygonal coil (8.6e-5 at §169's sampling), which is small, real, and exactly
the size of thing a `1e-6` equality assert would fail on.

### 8. A line given volume is a new part, and its walk order is topology

A lever designed as a centreline (pivot → elbow → nose) becomes a mesh by
offsetting each segment by a half-width and walking the boundary. Which
offset side connects to which neighbour is a fact about the GEOMETRY at
each junction — where the arm runs nearly tangentially about its wheel,
its ±perp sides are nearly RADIAL, so "left of the walk" and "radially
inner" part company — and pairing them by construction order instead cut
the §101 click as a bowtie. The failure is SILENT and lands far from the
scene of the crime: earcut drops the unreachable ears without a word, the
caps ship with holes, and every parity-raycast instrument downstream reads
the open mesh as colliding with parts it is nowhere near (the handoff row
at −0.35, `intraUnit` reporting the pawl inside a post 0.71 clear — the
rule-1 trap of TODO 27, re-armed by a walk order). Two asserts now hold
the class at the click and belong beside every hand-walked outline: the
outline is SIMPLE (segment-pair crossing test at build), and the extrude
is COMPLETE (a bevel-free n-gon is exactly 4n − 4 triangles; the bowtie
measured 52 of 56, which is how it was found).

### 9. Cut engagement profiles FROM the mating surface, through the contact law's own mapping

A part that works INSIDE another's tooth space — a click's beak, a jumper
against its star — is not a generic glyph, and §101 retired two of them:
a straight blade fouls the adjacent tooth, and a narrow V measures green
everywhere while READING disengaged, because a point contact is invisible
at movement scale. Sample the engaging profile from the same analytic
curve the mating teeth were cut from (working edge parallel to the flank
it bears on, back relieved along the flank it rides), and route every
offset and relief THROUGH the mapping the contact law uses: the beak's
hairline face relief rotated +az, which read as "off the face" in the
unmirrored frame and INTO it under the reverse-cut mapping — 0.01 of
relief became 0.036 of interference at a pose only the settled state
reaches. Two acceptance measurements: the part parks at ZERO lift in its
settled pose, and — because nothing in the battery gates a ratchet's
DIRECTION — the tooth coordinate under the nose is traced across the
working motion (the §101 saw shipped mounted backward, winding up the
steep face, green under every gate; the flank assignment is derived from
the drive sign, du/d input, written at the cut).

## Derive, don't nudge

Clearance-bearing constants must be *derived* from the geometry with an explicit
margin, in a build-time closed form or small solver, so they survive upstream
changes. House examples: `FORK_BANK_DEG` (arc-length matching), `HACK_PRESS_DIST`
(largest anchor distance inside the plate), `HAMMER_TAIL_DELTA` (four-bar
calibration with fold-margin scoring), `HAMMER_SWING_RAD` (minimal retraction
clearing the swept cam). A hard-coded number that encodes a clearance is a latent
collision waiting for someone to resize a wheel.

### 10. A member that reaches toward a rotor must derive its reach FROM that rotor's swept disc

Rule 2 says seat surface-to-surface; this is the same discipline where the
"surface" is a region a wheel sweeps rather than a face you can point at, and
it is written separately because §104 and §107 BOTH got it wrong in the same
member, in opposite directions.

The governor anchor's arms were `BoxGeometry` bars ending at
`ALARM_GOV_PALLET_R − 0.3`. That single literal was carrying two unstated
relationships at once — *reach the blade you carry* and *stay out of the wheel
your blade works on* — and it satisfied neither: measured over the swing, the
arms ran **0.507 and 0.588 INSIDE the saw's tip circle** while one blade stood
**0.236 clear** of the arm meant to hold it. §107 then repaired the joint by
lengthening the arms, which pushed them to **0.665** inside the wheel — a
repair that made the unmeasured half worse, because nothing in the build stated
the second relationship at all.

The rule, then:

- **Name the swept region and clear it explicitly.** A rotor's tip circle is a
  surface. Any member entering its neighbourhood carries a term of the form
  `≥ R_tip + CLEAR_MARGIN` (plus half its own width, if the constraint is
  written on a centreline), evaluated **across the driven pose range** — the
  wheel centre MOVES in a swinging member's own frame, so a rest-pose check is
  not the check.
- **Where a straight member cannot satisfy it, the member is the wrong shape.**
  Between two pallets the tip circle bulges toward the anchor arbor by
  `R(1 − cos ε)` — 0.551 here — so a straight bar from hub to blade must cut
  through the teeth. A real anchor ARCHES around that bulge, and its classic
  silhouette *is* this constraint in metal. Reach for a walked outline
  (rule 8) before reaching for a bigger clearance.
- **Attach where there is room, and measure where that is.** Most of a pallet's
  back is itself inside the tip circle at some point in the swing — that is the
  blade's whole job. The carrier lands on the most-clear point, found by
  measurement, not at the geometric middle.

The general form: *if a constant encodes a relationship to a part that moves,
the pose range belongs inside its derivation.* "Derive, don't nudge" below is
the same lesson for static clearances; this is its moving-part case.

**And note what did NOT catch any of it.** Rule 8's asserts hold one part's own
topology — a simple outline, a complete extrude — and both would have passed a
bar sitting squarely inside a wheel. Prose in this file is not enforcement:
§107 read these notes, fixed the joint, and still deepened the collision,
because the build stated no clearance term for the wheel and no instrument
compared the pair (both were movers in one unit — TODO 5). What closed it was a
build-time assert that restates the constraint as a measurement, beside the cut.
Write that assert with the member.

## Intended contact is not a collision

Some contacts ARE the mechanism — never "fix" these to a gap:

- meshing gear/pinion teeth
- pallet stones locking escape teeth
- the impulse pin in the fork notch
- the hack pad braking the balance rim
- the reset hammer camming the heart cam **during the reset stroke** (its parked
  and seated states, by contrast, must be clear/tangent)

A future automated sweep needs these registered explicitly (pair + expected
contact: tangent vs. sweeping) so everything *else* can be flagged at any depth.

## Free-space probing (the §35 lessons)

Corridor and free-space questions are answered by RAYS and BOOLEAN BVH, never
by vertex sampling, and always across the pose sweeps:

- **Vertex-occupancy scans are structurally blind.** An extruded slab or a
  cylinder's disc keeps vertices only at its hub, rim, and corners — the face
  interior samples as empty space. Three §35 corridors passed vertex scans and
  speared wheels and slabs. Raycasts hit triangle interiors;
  `boundsTree.intersectsGeometry` is the primitive this codebase trusts.
- **Ray bundles under-sample thin movers.** The fusee chain threads between
  bundle rays spaced 0.27 apart. Anything thin (chains, springs, fingers) must
  be tested with boolean BVH against its actual mesh.
- **Probe across the pose axes, not the rest pose.** The chain's drum→fusee
  span sweeps a whole azimuth fan as the reserve runs down; the rest pose
  showed every column clean. Sweep the axis that moves the part (reserve for
  the chain, alarmStrike for the hammer, crown for the keyless).
- **Back probe offsets off the margin boundary by an epsilon.** An offset at
  exactly radius+CLEAR_MARGIN registers a legal at-margin fit as a hit; a
  0.001 graze once gated an entire 3000-solution search space shut.
- **`closestPointToGeometry` target points are unreliable at distance 0**
  (the tri-intersection short-circuit fills nothing meaningful). Use the
  points only when d > 0; identify contacts with `intersectsGeometry` per
  mesh pair.
- **Probe at the consumer's true radius.** A column probe whose rays span
  0.29 clears a 0.12 shaft but not the 0.26 bush ring around it — the §35
  jumper graze. Probe with the fattest part that will occupy the corridor.
- **Never start a probe ray inside geometry.** An upward ray started at the
  §35 bush floor sat inside the jumper's blade; its exit face was backface-
  culled and the station passed at 0.02 from contact. Cast DOWNWARD from
  known-free air (or two-sided) so entry faces are front faces.
- **Finish with a boolean proxy at the true margin.** Build a temporary
  margin-inflated mesh for the candidate (rod + CLEAR_MARGIN as one
  cylinder), BVH it, and `intersectsGeometry` it against every unit across
  the pose sweeps. This is the only §35 probe the chain never fooled — and
  it still caught a nick rays had passed, at one of 61 reserve tensions.

## Verification protocol

1. **Numeric first**: compute min separation across the pose sweep, before and
   after. Report signed depths.
2. **Visual second**: screenshot the *worst* pose, not the prettiest.
3. **Prove the served tree is current** before trusting browser evidence — fetch a
   file you just changed and grep for the change. A stale module cache once masked
   two real crashes behind a working-looking build. (`dev_server.py` sends
   no-store headers for this reason.)
4. **Configs fail loudly**: values feeding three.js must be validated at load.
   `THREE.Color` accepts `"#rrggbb"` but silently warns-and-defaults on
   `"0x..."` strings — an entire lighting rig degraded without an error.
5. **A vertex-min sweep is not a clearance measurement on long-flanked
   parts.** An extruded lever's flank carries vertices only at its ends, so
   sampling one mesh's vertices against the other's surface is blind to a
   face-to-face graze mid-flank — a 480-pose vertex sweep called the §101
   click's spring-post lane clear at 0.71 while the arm's flank grazed the
   post's head, and the `intraUnit` gate (surface-to-surface) caught what
   the probe missed. Measure clearance with `meshClearance`-class
   surface-to-surface queries, or trust the gate over the probe.

## Open follow-up

Promote the ad-hoc inspection scripts into a standing clearance harness: iterate
registered part pairs, sweep their pose space via `__clock`, assert margins (or
tangency for intended contacts). The sweep machinery from the heart-cam fix
verification is the starting point.
