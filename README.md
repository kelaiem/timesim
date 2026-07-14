# Lever Escapement — 3D Mechanical Clock Simulation

A browser-based, physically-laid-out 3D simulation of a going-barrel movement with a
Swiss lever escapement: mainspring barrel → center → third → fourth wheel → escape
wheel ⇄ pallet fork ⇄ balance wheel + hairspring, plus a dial with correctly driven
hour/minute/second hands.

## Run

Any static file server from this directory, e.g.:

```sh
python3 -m http.server 8347
```

then open http://localhost:8347/ — no build step, no network access needed
(Three.js 0.165 is vendored in `vendor/`).

## What's simulated

- **Balance**: 2.5 Hz torsional oscillator (18,000 bph, 5 beats/s).
- **Escapement**: per-beat lock → unlock (with draw recoil) → impulse → drop state
  machine; the escape wheel advances exactly 12° (half a tooth pitch of the 15-tooth
  club-tooth wheel) per beat with an eased impulse ramp.
- **Train**: all wheel angles are closed-form functions of the escape-wheel angle —
  barrel 80T→10 center pinion, center 75T→10, third 80T→10, fourth 80T→8 escape
  pinion; fourth wheel = 1 rev/min, center = 1 rev/h, barrel = 1 rev/8 h. No drift.
- **Mainspring**: visible coil in the barrel cutaway relaxes over ~30 simulated
  hours; the Wind button re-tightens it.
- **Power reserve (functional)**: the movement runs on its own "movement time"
  that stalls when the spring is spent — balance amplitude sags as tension
  drops (like a real watch), and at zero the balance stops dead-centre with the
  train locked and hands frozen until the next wind. The indicator is geared
  mechanically off the barrel — 120° of hand per 3.75 barrel revolutions
  (1 rev/8 h × 30 h), referenced to the barrel angle at the last wind — shown
  on an AUF/AB sub-dial at 6 o'clock plus an hours readout in the panel.
- **Keyless works**: knurled crown → stem → winding pinion → crown wheel →
  ratchet + click; the chain spins with true tooth ratios when you wind.
- **Setting-lever linkage (visible hacking actuation)**: the stem carries a
  grooved collar pair; the setting lever's pin rides in it, so pulling the
  crown rotates the lever. Its tall tail post presses the hack spring — a
  long blued blade reaching across the movement whose ruby pad lands exactly
  on the balance rim — and drives the reset-hammer rod; a separate yoke
  tracks the sliding pinion's hub between the winding and setting meshes.
- **Power-reserve gear train**: a visible 3-stage reduction (8T/36T ×
  8T/20T = 1/11.25) mounted coaxially on the barrel arbor, geared so the
  first pinion turns exactly 3.75 times — matching RESERVE_BARREL_TURNS —
  over one full wind-to-empty cycle, ending at an arbor that matches the
  indicator hand's angle exactly.

## Controls

Pause/play, time-scale (0.02×–1×; default 0.15× so the beat is watchable), Wind,
camera presets (Escapement / Train / Dial / Free + orbit/zoom), exploded-view
slider, part labels toggle, beat counter and simulated clock readout.

## Files

- `src/geometry.js` — parametric part builders (gears with crescent crossings,
  club-tooth escape wheel, pallet fork with ruby stones, balance with timing screws,
  Archimedean hairspring, cutaway barrel, plates, dial, hands).
- `src/materials.js` — shared PBR materials (brass, steel, blued steel, ruby…).
- `src/main.js` — scene, studio lighting + procedural PMREM environment, movement
  assembly (mesh distances from pitch radii), escapement kinematics, UI.
- `test-geometry.html` — standalone visual smoke-test page for every part builder.
- `src/*.stub.js` — crude stand-in geometry used during parallel development; kept
  for reference, unused by the app.

`window.__clock.step(dt)` in the console single-steps the simulation deterministically
(useful because background tabs throttle requestAnimationFrame).
