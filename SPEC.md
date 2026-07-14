# Mechanical Clock Simulation — Architecture Spec

Browser-based 3D simulation (Three.js, ES modules, no build step) of a going-barrel
movement with a **Swiss lever escapement** and balance wheel.

## Files

- `index.html` — already written. Loads `src/main.js` as a module. Importmap maps
  `three` → `./vendor/three.module.js` and `three/addons/controls/OrbitControls.js` →
  `./vendor/OrbitControls.js`.
- `src/geometry.js` — **Agent A**. Pure geometry/mesh builders. No animation, no scene.
- `src/materials.js` — **Agent A**. Shared PBR materials.
- `src/main.js` — **Agent B**. Scene, lighting, camera, movement assembly, escapement
  state machine, gear-train kinematics, UI panel, render loop.

Agent A must not touch `main.js`; Agent B must not touch `geometry.js`/`materials.js`.
Agent B codes strictly against the API below and may stub builders while testing.

## Units & conventions

- 1 unit = 1 mm. Movement is watch-like but oversized for legibility: plate diameter ~100.
- All wheels/parts are built **lying in the XY plane, rotating about local +Z**, centered
  at origin, pivot axis = z-axis. Assembly positions/rotates them.
- `THREE` imported as `import * as THREE from 'three'`.

## `src/materials.js` exports

```js
export const MATS = {
  brass,        // polished brass (gears, plates) — MeshPhysicalMaterial
  steel,        // polished steel (pinions, arbors, fork, spring)
  blueSteel,    // blued screws / hands
  ruby,         // translucent red (pallet jewels, impulse pin, bearing jewels)
  nickel,       // plates variant
  silver,       // dial
  dark,         // background parts
};
```

## `src/geometry.js` exports

Every builder returns a `THREE.Group` (or Mesh) with `.userData.r` = pitch/functional
radius where meaningful. Use `BufferGeometry` via `ExtrudeGeometry`/`LatheGeometry`/
`Shape` — real tooth profiles, not cylinders with bumps.

```js
// Involute-ish spur gear. pitchRadius = module*teeth/2 (store in userData.r).
// spokes: number of crescent cutouts (0 = solid). Crossings like real clock wheels.
export function makeGear({ module, teeth, thickness, boreR = 1, spokes = 5,
                           material, hub = true })

// Small solid steel pinion (leaves, no spokes).
export function makePinion({ module, teeth, thickness, material })

// 15-tooth club-tooth escape wheel (Swiss lever style): slanted impulse faces,
// undercut locking faces, light spoked center. userData.r = tip radius.
export function makeEscapeWheel({ teeth = 15, radius, thickness })

// Pallet fork pivoted at origin: anchor body, entry & exit pallet arms with ruby
// pallet stones (angled impulse faces), long lever with fork horns + notch + guard pin
// pointing along -Y. userData: { entryPos, exitPos } (Vector3 of stone centers).
export function makePalletFork({ span, leverLength, thickness })

// Balance: bi-metallic-look rim with timing screws, 2-3 arms, roller table underneath
// with ruby impulse pin at radius rollerR (store userData.rollerR), safety roller.
export function makeBalanceWheel({ radius, thickness })

// Archimedean-spiral hairspring with `coils` turns, terminal curve, collet at center,
// stud at outside. Flat ribbon cross-section. Group so it can be rotated as a whole.
export function makeHairspring({ innerR, outerR, coils = 12, height })

// Going barrel: drum + toothed rim (it IS the great wheel: give it `teeth`,`module`),
// cutaway sector (~90°) in the lid revealing a spiral mainspring inside, hook at wall,
// arbor at center. Expose `spring` child (name='spring') so sim can wind/unwind it,
// plus ratchet wheel + click on top.
export function makeBarrel({ radius, height, teeth, module })

// Plates & structure: shaped back plate, smaller top plate/cocks (balance cock with
// regulator), pillars. Jewel = red donut in gold chaton (name bearing positions later).
export function makeBackPlate({ radius, thickness })
export function makeCock({ length, width })         // generic bridge/cock
export function makeJewelSetting({ r })             // chaton + ruby
export function makePillar({ height })

// Dial side: dial with printed-look minute track + numerals (CanvasTexture),
// hour/minute/second hands (blued, counterweighted shapes, pivot at origin, point +Y).
export function makeDial({ radius })
export function makeHand({ length, kind })          // kind: 'hour'|'minute'|'second'
```

## Gear train (Agent B assembles & animates)

Kinematic chain, driven from the balance (see escapement). Tooth counts chosen so
ratios are exact and everything meshes with `module` consistent per mesh pair:

| Stage | Wheel (teeth) | drives Pinion (teeth) | Ratio | Result |
|---|---|---|---|---|
| Barrel (great wheel) 80 | → center pinion 10 | 8:1 | barrel 1 rev / 8 h |
| Center wheel 75 | → third pinion 10 | 7.5:1 | center = 1 rev/h (minute hand) |
| Third wheel 80 | → fourth pinion 10 | 8:1 | fourth = 1 rev/min (second hand) |
| Fourth wheel 80 | → escape pinion 8 | 10:1 | escape wheel = 6 s/rev |
| Escape wheel 15 teeth | ⇄ pallet fork ⇄ balance | — | 5 beats/s (2.5 Hz, 18 000 bph) |

Wheel+its pinion co-rotate on one arbor. Adjacent meshed wheels counter-rotate.
Center distance of a mesh = sum of pitch radii. Motion works for the hour hand may be
computed (hourAngle = minuteAngle/12) rather than modeled, but a visible cannon
pinion/hour wheel stack under the dial is a plus.

## Escapement behavior (Agent B — the centerpiece)

Balance is the oscillator: `θ_b(t) = A·sin(2π·f·t + φ)`, A ≈ 270° visually scaled to
~40–50° actual rotation of the mesh for readability (expose both; default readable).
Per half-swing state machine synced to balance phase:

1. **Locked** — escape tooth rests on pallet locking face; fork against banking pin.
2. **Unlock** — impulse pin enters fork notch, rotates fork ~±10°; escape wheel recoils
   ~1° (draw) then releases.
3. **Impulse** — tooth slides across pallet impulse face: escape wheel advances 12°
   (half of 24° tooth pitch) with an eased ramp; fork pushes the pin, "impulsing" balance.
4. **Drop & lock** — wheel advances tiny drop, next tooth locks on opposite pallet.

Implement as phase-driven keyframing (robust), not rigid-body physics: given balance
phase, derive fork angle and escape-wheel advance count + partial. Escape wheel total
rotation = f(beats) → drives whole train backwards through ratios above (train angles
are pure functions of escape rotation — never drift). Hairspring: rotate ±small angle
and radially breathe (scale ~±4%) in sync with balance.

Mainspring: barrel advances per the train; spring spiral child slowly relaxes
(scale/rotation on the 'spring' object), "Wind" button re-tightens.

## Scene / UI (Agent B)

- Dark studio backdrop, 2–3 shadowed directional/spot lights + soft env (RoomEnvironment
  not available offline — use hemisphere + lights; `renderer.physicallyCorrectLights`
  fine). Tone mapping ACES.
- OrbitControls, initial ¾ view of the escapement side. Camera preset buttons:
  **Escapement / Train / Dial / Free**.
- Minimal custom HTML control panel (no external libs): pause, time-scale slider
  0.02×–1× real-time (default 0.15× so the 2.5 Hz beat is watchable), "Wind",
  exploded-view slider (parts translate along +Z by layer), labels toggle
  (CSS2D-like sprites naming: Balance, Hairspring, Pallet fork, Escape wheel, 4th/3rd/
  Center wheels, Barrel/Mainspring).
- Beat counter + simulated clock time readout.
- Handle resize; `renderer.setPixelRatio(min(devicePixelRatio,2))`.

## Quality bar

60 fps on a laptop: reuse geometries where possible, merged static parts, shadows only
where they matter. No console errors. Everything visible actually moves correctly:
tooth flanks of meshed gears must not visually interpenetrate at rest (phase-offset each
wheel so teeth interleave: rotate driven wheel by half tooth pitch as needed).
