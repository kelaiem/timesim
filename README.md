# Lever Escapement — 3D Mechanical Clock Simulation

A browser-based, physically-laid-out 3D simulation of a fusee movement with a
Swiss lever escapement: mainspring drum → chain → fusee & great wheel → center →
third → fourth wheel → escape wheel ⇄ pallet fork ⇄ balance wheel + hairspring,
plus an alarm complication with its own barrel and gong, and a dial with
correctly driven hour/minute hands, a small-seconds sub-dial, a power-reserve
sub-dial and a 12 h alarm-setting ring.

**Tornado layout** — the movement is composed as a face design on a flat
construction: crown and barrel exit at ~1:50, the fourth wheel sits exactly
at 6 o'clock so its arbor carries the small-seconds display directly (no fake
linkage), the escapement trails to ~6:25 with the balance at 8, and the
power-reserve sub-dial answers at 12. The going train no longer runs a uniform
stride: the z-stack is solved bottom-up (`src/layout.js`), the escape wheel
drops *below* the train while its pinion stays up in the fourth wheel's plane,
and the fusee cone is squashed to ~3 units — the height four turns of
true-scale chain actually need — which is what lets the three-quarter plate
floor come down. The whole assembly, hands to alarm barrel, measures ~26.4
units front-to-back; at the scale pinned in §39 (0.379 mm/unit, derived from
real fusee-chain pitch) that is ≈10 mm deep on a 32.5 mm plate.

## Run

Use the dev server, which also serves the `/__state` endpoint the save/load
buttons persist to and sends `Cache-Control: no-store` so edited modules
aren't served stale:

```sh
python3 dev_server.py        # :8347
```

then open http://localhost:8347/ — no build step, no network access needed
(Three.js 0.165 is vendored in `vendor/`). A plain static server
(`python3 -m http.server 8347`) also works; state then falls back to
`localStorage`.

## Deployed environments

Three of them, published to GitHub Pages by `.github/workflows/pages.yml`
(§88). GitHub Pages gives a repository one site, so they are three paths
under it rather than three sites — which works only because release URLs are
relative (see §28 in `docs/BUILT.md`), and so the app never needs to know how
deep under the origin it is being served.

| Environment | URL | What it is | Moved by |
|---|---|---|---|
| production | https://kelaiem.github.io/timesim/ | the promoted release | running the Pages workflow with `promote: <version>` |
| testing | https://kelaiem.github.io/timesim/testing/ | the newest release — the same tree QA gets over SFTP | `release.yml`, which dispatches the Pages workflow when it publishes |
| development | https://kelaiem.github.io/timesim/development/ | the tip of `main` | any merge to `main` |

So the ladder is **merge → cut a release → promote**, and every pointer is a
git ref: `main`, the newest `major.minor.patch` tag, and a `production`
branch the promote step moves. Nothing about which environment serves what
lives outside the repository.

The Pages workflow itself only ever runs from `main` — each environment's
tree comes from its own ref, but the tooling that stamps them comes from the
checkout, so pinning that to one place is what makes a rebuild reproducible.

Each carries the version it was built with, readable without a fetch:

```sh
curl -s https://kelaiem.github.io/timesim/development/version.json
# {"version":"2.1.9-28-g4b64e7d","environment":"development"}
```

Development's version is `git describe` — literally "28 commits past 2.1.9",
which is what the tip of `main` is. Testing and production name their release
tag. Only production is indexable; the other two are served `noindex`.

Every deploy — Pages and the SFTP release alike — ships the payload defined
by `tools/payload.sh`: the app, `vendor/`, and the licences, and nothing
else. Repo documentation (every `*.md`, including `docs/`), `dev_server.py` and
the git hooks describe the project to people working on it and are not site
content, so they stay in the repository. Both workflows assert both halves —
no doc leaks in, no licence goes missing.

## Simulation vs. model — how this project uses the words

Two words carry precise, different claims here, and the honesty ledger
(`TODO.md`) trades on the difference:

- **The model** is the description: parametric geometry generated from its
  own dimensions and constraints, constants derived from stated
  relationships, and declared structure (`MECH_GRAPH` — what supports what,
  what drives what). The model exists at boot, motionless. Saying a thing
  is *modelled* claims only that it is described — a spring can be
  modelled as matter yet have no force law.
- **The simulation** is the model advanced through time by causality:
  `step(dt)` carrying force from its sources (mainspring, crown) through
  drive edges to every display. Saying a thing is *simulated* is the
  stronger claim — its behavior is **driven**, not posed. The negative
  space has names of its own: a part that animates with no force path is
  a *simulation fiction* (the `graph` check's term), and a run whose
  members are *posed from the output* rather than driven from the input
  (TODO 20) is modelled truthfully but not yet simulated.

"The sim" is shorthand for the running artifact — model, simulation,
rendering and panel together. The schematic view's motto ("draw the
model, not the metal") uses *model* in a narrower, idealized sense: the
pitch circles, ratios and laws the solids embody.

## What's simulated

- **Balance**: 2.5 Hz torsional oscillator (18,000 bph, 5 beats/s).
- **Escapement**: per-beat lock → unlock (with draw recoil) → impulse → drop state
  machine; the escape wheel advances exactly 12° (half a tooth pitch of the 15-tooth
  club-tooth wheel) per beat with an eased impulse ramp.
- **Train**: all wheel angles are closed-form functions of the escape-wheel angle —
  barrel 80T→10 center pinion, center 75T→10, third 80T→10, fourth 80T→8 escape
  pinion; fourth wheel = 1 rev/min, center = 1 rev/h, barrel = 1 rev/8 h. No drift.
- **Mainspring**: visible coil in the barrel cutaway relaxes over ~30 simulated
  hours. Winding goes through the keyless chain, whether you drag the crown or
  press Wind (which turns it for you); a one-way click means only forward turns
  bank reserve, and at full wind the cone stops however hard you crank.
- **Maintaining power**: drive runs cone → base ratchet → pawls on the
  maintaining wheel → maintaining spring → great wheel, so the train keeps
  going while you wind instead of stopping dead — the standard fusee answer to
  losing power at the one moment you are adding it.
- **Power reserve (functional)**: the movement runs on its own "movement time"
  that stalls when the spring is spent — balance amplitude sags as tension
  drops (like a real watch), and at zero the balance stops dead-centre with the
  train locked and hands frozen until the next wind. The indicator is driven
  off the state of wind through a visible reduction train (below) and reads on
  a sub-dial at 12 o'clock — a 150° arc graduated 0 → 30 h, figured 0/12/24 in
  Arabic — plus an hours readout in the panel.
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
- **Alarm**: a second, independent complication with its own crown, barrel
  (1.75 turns of wind), striking wheel, hammer and coiled gong. The setting
  disc is read against a 12 h ring on the dial at quarter-hour marks; a
  release feeler drops into the disc's notch at the set time, unlocking the
  striking train for ≈28 strikes (~12 s) on one wind. The arming run is
  forward-driven end to end: a press advances the column wheel (its
  parity IS the on/off), the beak rides castellations cut from the same
  function the tick reads, the rod stands between its two contacts, and
  a crank pin rides a forked tab's groove to drive the selector ring
  positively both ways — the `alarmHandoffs` check measures all six
  hand-offs closed, zero waivers. (The one filed gap: the pawl's index
  stroke is a transient the pose-based instrument cannot reach; TODO
  20's closing status carries it.)
- **Keyless works**: knurled crown → stem → winding pinion → crown wheel →
  ratchet + click; the winding train turns with true tooth ratios when you
  wind, and the fusee chain migrates as the cone takes it up.
- **Setting-lever linkage (visible hacking actuation)**: the stem carries a
  grooved collar pair; the setting lever's pin rides in it, so pulling the
  crown rotates the lever. Its tall tail post presses the hack spring — a
  long blued blade reaching across the movement whose ruby pad lands exactly
  on the balance rim — and drives the reset-hammer rod; a separate yoke
  tracks the sliding pinion's hub between the winding and setting meshes.
- **Power-reserve gear train**: a visible two-mesh reduction across three
  arbors (8T/36T × 10T/20T = 1/9) whose first pinion sits slip-coupled on the
  barrel arbor and whose last wheel shares the indicator hand's arbor. The
  ratio is derived, not chosen: the arbor makes 3.75 turns over the 30 h
  reserve and the hand sweeps 150°, so R = 1350/150 = 9 — and a build-time
  assert holds the graduation, the hand's travel and the tooth counts to each
  other, because for a while they disagreed (TODO 18).

## Controls

Pause/play, time-scale (a log slider, 0.02×–1×; starts at 1× — around 0.15× is
where the unlock-impulse-drop sequence becomes followable by eye), Wind,
fast-forward, sync-to-wall-clock, sound, camera presets (plus orbit/zoom),
exploded view (whole-movement slider or one assembly at a time), part labels,
x-ray, power-flow highlighting, a measurement overlay with an in-scene mm
ruler, a guided tour and an inspection route, a control HUD, a reconfigure
mode (§33: drag either crown, the pusher (which carries the whole alarm module with it), the barrel, escapement or balance to propose a new
arrangement — dragging the crown re-solves the keyless cluster around a
decoupled stem, idler and all; the pure solvers shadow-solve each candidate live,
warnings and all, specs apply at reload and are refused with reasons where
they cannot work, a Trial boot button reads a candidate's full boot-assert
verdict from a hidden throwaway boot without committing the view, and named
variants with history-based undo make the spec a document), save/load of the
whole scene state, and the beat counter, simulated clock, reserve and alarm
readouts. The alarm has its own crown and pusher. `?inspect=1` and `?cycle=1`
deep-link into the inspection and alarm-cycler routes; an Advanced panel
exposes the finish parameters from `src/aesthetics.json`.

## Files

- `src/layout.js` — the layout contract: tooth counts, the z-stack, the
  one clearance margin, the unit→mm pin, and `solveLayout` (the planar solve
  as a pure function of its spec).
- `src/geometry.js` — parametric part builders (gears with crescent crossings,
  club-tooth escape wheel, pallet fork with ruby stones, balance with timing screws,
  Archimedean hairspring, cutaway barrel, plates, dial, hands).
- `src/materials.js` — shared PBR materials (brass, steel, blued steel, ruby…).
- `src/main.js` — scene, studio lighting + procedural PMREM environment, movement
  assembly (mesh distances from pitch radii), escapement kinematics, UI.
- `src/inspect.js` — the realism inspector (below).
- `src/state.js` — state persistence via the dev server's `/__state`, falling
  back to `localStorage`.
- `src/aesthetics.js`, `src/aesthetics.json` — finish parameters; see
  `AESTHETICS.md` for the reasoning.
- `dev_server.py` — the static server plus `/__state` and `no-store`.
- `test-geometry.html` — standalone visual smoke-test page for every part builder.
- `SPEC.md` (architecture contract), `docs/BUILT.md` (how each shipped
  feature was designed, numbered §n and cited from source comments),
  `docs/MODELING.md` (geometry conventions), `TODO.md` (mechanical-realism
  debt), `CLAUDE.md` (working rules).

`window.__clock.step(dt)` in the console single-steps the simulation deterministically
(useful because background tabs throttle requestAnimationFrame).

## Realism inspector

`src/inspect.js` sweeps the mechanism deterministically through eight phase
axes — `beat`, `crown`, `reserve`, `train`, `jumperEngage`, `handSet`, `alarm`,
`alarmStrike` — via `__clock.setPose()` and reports every pair of functional
units whose meshes intersect (exact triangle tests via the vendored
`three-mesh-bvh`). Pairs with intended mechanical contact (gear meshes, pallet
lock, chain-on-cone…) are classified EXPECTED and reported separately;
everything else that touches is FORBIDDEN — a defect.

Run it from the console with `start()`/`status()`, **never** by awaiting a
sweep directly: full runs take 100 s+ and will blow a browser-eval timeout.

```js
document.getElementById('btn-pause').click();
const I = await import('./src/inspect.js');
I.start(__clock, 'inspection', { includeExcluded: true });  // then poll I.status()
I.start(__clock, 'support');                                // 0 failures
I.start(__clock, 'clearances');                             // 0 violations
window.__inspect.show('<pair>', '<axis>');                  // jump camera to a hit pose
```

Beyond overlap the module carries `checkMechanicalGraph` (is every part
grounded and driven), `checkPenetrationBudgets` (how *deep* an intended
contact goes — being on `EXPECTED_PAIRS` proves contact was intended, not
that its depth is reasonable; budgeted pairs run from the ruby stones to the
alarm linkage), `checkAlarmHandoffs` (does each claimed contact of the §35
arming run actually *close* — signed gap-or-burial at both toggle parities,
with out-of-band rows carried as waived debt citing their TODO items),
`checkSweptOverlap` against a swept-volume registry, `checkStockFloor` and
`checkSlenderness` (a part can be thick enough and still be a noodle),
`checkLowCorridor`, `auditOscillators`, `stockCensus` and `fingerprint` for
determinism. `focusedCheck(clock, names)` runs the same budgets scoped to the
parts you just moved, in seconds rather than minutes.

CI runs the whole bar on every PR: `.github/workflows/battery.yml` drives
`tools/ci-battery.mjs` under headless Chromium, plus a boot-silence check and
a double-boot fingerprint comparison. `node tools/ci-battery.mjs` runs the
same gate locally (needs `npm ci` in `tools/` and a Playwright Chromium).

Two things the sweep structurally cannot see, both written up in `TODO.md`
(items 5 and 6): a part colliding with another part of the *same* unit, and
any second overlap between a pair that already has one declared contact.
`checkAlarmHandoffs` closes both blind spots for the one run that was hiding
in them — its rod⇄tail and rod⇄crank rows are intra-unit contacts the pair
sweep can never enumerate.

## A note on the styling

The finishing and layout follow the **Glashütte school** of watchmaking: a
three-quarter plate, a separate balance cock screwed to it, Glashütte
striping across that plate and the escape bridge, perlage on the base plate,
screwed gold chatons over the upper pivot jewels, and blued steel screws and
hands.

**The dial no longer speaks German.** It used to: the power reserve was
graduated **AUF/AB** — "up/down", the conventional marking for a German
reserve indicator. That scale is now figured 0 → 24 in Arabic numerals, and
both sub-dials are captioned in English (POWER RESERVE, SECONDS), so the
words that named the school on the *front* of the watch are gone. Removing
them is not a claim to have left the school. The movement behind the dial is
where the vocabulary actually lives, and every item in the list above is
still there — the three-quarter plate and its cock are the layout, not a
decoration applied to it.

These are traditional techniques and conventions, in general use across
German horology for well over a century. They belong to the craft, not to any
one maker. Nothing in the list is exclusive to one house, and none of it is
borrowed from a specific caliber.

**"Swiss lever" names the escapement's design, not its passport.** The term
means the straight-line layout (escape-wheel centre, pallet pivot and balance
centre collinear — this build measures exactly 180.0° at the fork, from the
layout solve's own positions) with a club-tooth escape wheel splitting the
impulse between tooth face and pallet stone — as opposed to the English
lever's right-angle layout and pointed teeth. A German-styled movement
carrying a Swiss lever is the industry's norm, Glashütte's included; the
historical Glashütte lever escapement (*Glashütter Ankerhemmung*) is a
distinct variant of the lever family and is not what is built here.

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
