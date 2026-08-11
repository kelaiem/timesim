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
