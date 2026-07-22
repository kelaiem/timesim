# Lever Escapement — 3D Mechanical Clock Simulation

A browser-based, physically-laid-out 3D simulation of a fusee movement with a
Swiss lever escapement: mainspring drum → chain → fusee & great wheel → center →
third → fourth wheel → escape wheel ⇄ pallet fork ⇄ balance wheel + hairspring,
plus a dial with correctly driven hour/minute hands and a small-seconds sub-dial.

**Tornado layout** — the movement is composed as a face design on a flat
(~32-unit front-to-back, down from ~45) construction: crown and barrel exit at
~1:50, the fourth wheel sits exactly at 6 o'clock so its arbor carries the
small-seconds display directly (no fake linkage), the escapement trails to
~6:25 with the balance at 8, and the power-reserve sub-dial answers at 12.
The going train packs on a 2.1-unit wheel stride under compact bridges, and
the fusee cone is squashed to 4.5 units tall with a tighter groove pitch.

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
  on an AUF/AB sub-dial at 12 o'clock plus an hours readout in the panel.
- **Small seconds**: the seconds hand rides a sub-dial at 6 o'clock centred
  exactly on the fourth wheel's axis — its display arbor (the heart cam's
  slip-coupled arbor, extended as a real rod through the wheel's bore and the
  plate) is coaxial with the actual 1-rev/min fourth wheel.
- **Fusee & chain**: the movement is a fusee movement — the mainspring lives
  in a plain drum off to the side, and a chain runs to a helically-grooved
  cone on the great-wheel arbor. Fully wound, the chain pulls at the cone's
  small radius; as the spring weakens it pays off toward the large radius,
  so torque delivered to the train stays level (see the Spring/Train torque
  bars in the panel — the cone profile satisfies S(t)·r_f(t) = const). The
  chain visibly migrates between drum and cone as the reserve changes.
- **Fast-forward**: a ~5400× mode that rips through the whole 30 h reserve in
  seconds so you can watch the chain pay off, the reserve hand fall, and the
  movement run flat; auto-disengages at zero. Winding restarts the balance.
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

`window.__clock.step(dt)` in the console single-steps the simulation deterministically
(useful because background tabs throttle requestAnimationFrame).

## Realism inspector

`src/inspect.js` sweeps the mechanism deterministically through its phase axes
(one beat cycle, the crown stroke, the full reserve) via `__clock.setPose()`
and reports every pair of functional units whose meshes intersect (exact
triangle tests via the vendored `three-mesh-bvh`). Pairs with intended
mechanical contact (gear meshes, pallet lock, chain-on-cone…) are classified
EXPECTED and reported separately; everything else that touches is FORBIDDEN
— a defect. Run it from the console:

```js
document.getElementById('btn-pause').click();
const { runInspection, checkMechanicalGraph, checkPenetrationBudgets } = await import('./src/inspect.js');
await runInspection(window.__clock);           // overlap report → window.__inspectReport
checkMechanicalGraph(window.__clock);          // grounding/drive/anchor report → window.__mechReport
checkPenetrationBudgets(window.__clock);       // per-pair depth budgets → window.__penetrationReport
window.__inspect.show('<pair>', '<axis>');     // jump camera to a hit pose
```

`checkPenetrationBudgets` is the contact-policy layer (milestone 2, started):
being on `EXPECTED_PAIRS` only proves contact was *intended*, not that its
depth is reasonable — a stone visibly buried 0.33 units inside an
escape-wheel tooth still sailed through `runInspection` as "EXPECTED,
contact detected." Each entry in `PENETRATION_BUDGETS` selects the specific
engaging meshes (not the whole unit) and fails if the worst true interior
penetration over the pair's axis exceeds a maxDepth. Currently covers
`Escape wheel ⇄ Pallet fork` (the ruby stones); TODO: extend to
`Pallet fork ⇄ Balance` (impulse pin in the notch) and
`Chain ⇄ Fusee & great wheel` (chain in the cone grooves), add phase-window
budgets (near-zero depth required OUTSIDE the lock/impulse window), a
pose-continuity check, and a known-good baseline so re-runs only flag
regressions.

## A note on the styling

The finishing and layout follow the **Glashütte school** of watchmaking: a
three-quarter plate, Glashütte striping across that plate and the escape
bridge, perlage on the base plate, screwed gold chatons over the upper pivot
jewels, blued steel screws and hands, and a power reserve graduated
**AUF/AB** — German for "up/down", the conventional marking for a German
reserve indicator.

These are traditional techniques and conventions, in general use across
German horology for well over a century. They belong to the craft, not to any
one maker.

The movement itself is an original parametric model: every part is generated
from its own dimensions and constraints in `src/geometry.js`, not traced or
measured from any manufacturer's caliber. No maker's name, logo, or trademark
appears in this project or on the dial.

This project is not affiliated with, endorsed by, or a product of any watch
manufacturer. If the result puts you in mind of a particular Glashütte house,
that is the shared vocabulary of the school, borrowed admiringly.

## License

Copyright 2026 kelaiem. Licensed under the [Apache License, Version
2.0](LICENSE); you may not use this project except in compliance with it.

The Apache grant covers this project's own code — `src/`, `index.html`,
`dev_server.py`, `test-geometry.html`, and the documentation. It does **not**
cover `vendor/`, which is third-party code redistributed verbatim under its own
MIT terms:

| File | Package | Version | License |
|---|---|---|---|
| `vendor/three.module.js` | [three.js](https://github.com/mrdoob/three.js) | r165 | MIT, © 2010-2024 three.js authors — [text](vendor/LICENSE-three.txt) |
| `vendor/OrbitControls.js` | three.js addons | r165 | MIT, © 2010-2024 three.js authors — [text](vendor/LICENSE-three.txt) |
| `vendor/three-mesh-bvh.module.js` | [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 0.7.8 | MIT, © 2018 Garrett Johnson — [text](vendor/LICENSE-three-mesh-bvh.txt) |

See [`vendor/README.md`](vendor/README.md) for provenance, checksums, and how to
verify or refresh these files.
