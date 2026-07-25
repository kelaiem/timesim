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

## Open follow-up

Promote the ad-hoc inspection scripts into a standing clearance harness: iterate
registered part pairs, sweep their pose space via `__clock`, assert margins (or
tangency for intended contacts). The sweep machinery from the heart-cam fix
verification is the starting point.
