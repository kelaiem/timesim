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
  pinion; fourth wheel = 1 rev/min, center = 1 rev/h, barrel = 1 rev per
  120/7 h (§124). No drift.
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
  arbors (8T/28T × 10T/12T = 1/4.2) whose first pinion sits slip-coupled on
  the barrel arbor and whose last wheel shares the indicator hand's arbor.
  The ratio is derived, not chosen: the arbor makes 1.75 turns over the 30 h
  reserve (§124's first-stage re-gear) and the hand sweeps 150°, so
  R = 630/150 = 4.2 — and a build-time assert holds the graduation, the
  hand's travel and the tooth counts to each other, because for a while
  they disagreed (TODO 18).

## Controls

Pause/play, time-scale (a log slider, 0.02×–1×; starts at 1× — around 0.15× is
where the unlock-impulse-drop sequence becomes followable by eye), Wind,
fast-forward, sync-to-wall-clock, sound, camera presets (plus orbit/zoom),
exploded view (whole-movement slider or one assembly at a time), part labels,
x-ray, power-flow highlighting, a measurement overlay with an in-scene mm
ruler, a guided tour and an inspection route, a control HUD (which carries
the clock and alarm-time readouts with it, so the alarm can be set without
the panel), a reconfigure
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

The chrome is localised — English, German, French, Japanese and Chinese in
both scripts — selectable in the panel or by `?lang=fr` / `?lang=zh-Hant`
(a script subtag, so `zh-TW`, `zh-HK` and `zh-MO` all resolve to Traditional).
`primer.html` and `explain.html`, the mechanism explainer linked from
the HUD, are translated in all six. A released build also **loads with
the network gone**: a service worker precaches the release, so a page that
has been visited online once boots offline, deep links included. Neither
applies to a source tree, which registers no worker at all so that an edit is
never shadowed by a cache.

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
- `src/i18n.js` — the UI localisation, keyed by the English source string.
  `src/page-i18n.js` is the shared engine for the two static pages, and
  `src/explain-i18n*.js` / `src/primer-i18n*.js` are their per-locale tables.
- `explain.html` — the mechanism explainer: a plate per mechanism, quoting the
  real source constants, linked from the HUD and styled as it.
- `sw.js`, `manifest.webmanifest`, `favicon.svg` — the offline worker (inert in
  a source tree; baked at release time), the web-app manifest, and the icon,
  which `tools/make-favicon.mjs` generates from the same monogram the winding
  crown carries.
- `dev_server.py` — the static server plus `/__state` and `no-store`.
- `test-geometry.html` — standalone visual smoke-test page for every part builder.
- `SPEC.md` (architecture contract), `docs/BUILT.md` (how each shipped
  feature was designed, numbered §n and cited from source comments),
  `docs/MODELING.md` (geometry conventions), `TODO.md` (mechanical-realism
  debt), `CLAUDE.md` (working rules).

`window.__clock.step(dt)` in the console single-steps the simulation deterministically
(useful because background tabs throttle requestAnimationFrame).

## Realism inspector

`src/inspect.js` sweeps the mechanism deterministically through nine phase
axes — `beat`, `crown`, `reserve`, `train`, `jumperEngage`, `handSet`, `alarm`,
`alarmStrike`, `alarmToggle` — via `__clock.setPose()` and reports every pair of functional
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
determinism, plus the three that answer the blind spots below —
`intraUnit` (all three pair classes inside a unit — movers vs fixtures,
fixture pairs, movers across rigid frames), `expectedContacts`
(per-contact clearance floors across declared pairs) and `restoring` (§48's
no-spring audit: anything that reciprocates has a restoring element, is
driven both ways, or is waived citing its TODO). `focusedCheck(clock, names)`
runs the same budgets scoped to the parts you just moved, in seconds rather
than minutes.

CI runs the whole bar on every PR: `.github/workflows/battery.yml` drives
`tools/ci-battery.mjs` under headless Chromium, plus a boot-silence check and
a double-boot fingerprint comparison. `node tools/ci-battery.mjs` runs the
same gate locally (needs `npm ci` in `tools/` and a Playwright Chromium).

Two things the pair sweep structurally cannot see, both written up in
`TODO.md` (items 5 and 6): a part colliding with another part of the *same*
unit, and any second overlap between a pair that already has one declared
contact. `checkAlarmHandoffs` closed both for the one run that was hiding in
them — its rod⇄tail and rod⇄crank rows are intra-unit contacts the pair sweep
can never enumerate — and each now has a general instrument as well
(`intraUnit`, `expectedContacts`), each with known residue: `intraUnit`'s
fixture-pair and cross-frame mover tiers gate only `INTRA_TIER_SCOPE` (the
alarm complex) and REPORT everywhere else, same-frame mover splits gate only
`ASSEMBLY_SCOPE`, and an EXPECTED pair with no declared floors row still gets
the blanket excuse. If you are checking one of those cases, read the
reported rows — or measure it yourself.

## A note on the styling

The finishing and layout follow the **Glashütte school** of watchmaking: a
three-quarter plate, a separate balance cock screwed to it, Glashütte
striping across that plate and the escape bridge, perlage on the base plate,
screwed gold chatons over the going train's upper pivot jewels — three of
them, on the centre, third and fourth wheels; the escape wheel's stone and
the alarm train's are flush rubbed-in jewels, which is the older bearing and
also a Glashütte one — and blued steel screws and hands.

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

**An acknowledged influence.** Bartosz Ciechanowski's *Mechanical Watch*
(<https://ciechanow.ski/mechanical-watch/>) is an inspiration for this
project's explanatory side — the conviction that a mechanism is best
explained by letting someone move it, and that the explanation deserves the
same care as the thing explained. `explain.html`, `primer.html` and the
schematic view all exist because of that conviction. Nothing here is copied
from it: no geometry, no code, no text, and the movement is a different one
(a fusee-and-chain caliber with an alarm). The debt is one of ambition, and
it is gladly acknowledged.

## Sources

The influence above is one of *ambition*. This section is the other kind of
debt — the descriptions of how these mechanisms actually work, which the
movement was built from. Nothing here was traced, measured or copied: these
are the accounts that were read, and the ones to check this movement against.

**Fusee & chain.** SJX Watches is the reference for the mechanism and for what
it is *for* — that a mainspring's torque is usable only across its flat middle,
and that the cone trades radius against that decay so the train sees a level
input. Which is exactly the claim `equalisation` gates and *Fusee & chain*
plate 2 draws.

- SJX, [*Insight: The Chain and Fusée*](https://watchesbysjx.com/2026/06/fusee-chain-in-depth.html)
- SJX, [*Explaining the Ups and Downs of Constant Force Mechanisms*](https://watchesbysjx.com/2015/08/monday-lessons-explaining-the-ups-and-downs-of-constant-force-mechanisms-in-mechanical-movements.html)
- SJX, [*Explaining the Microscopic Chain Inside the A. Lange & Söhne Pour le Mérite*](https://watchesbysjx.com/2018/02/explaining-the-microscopic-chain-inside-the-a-lange-sohne-pour-le-merite.html)
  — the reason the chain is built here as riveted inner/outer plate pairs
  rather than a cord, and the reason `CHAIN_PITCH_MM = 0.72` is pinned to a
  manufactured standard instead of chosen (it is what sets `UNIT_MM`, so the
  whole movement is dimensioned off a real chain).
- A. Lange & Söhne, [*The fusée-and-chain transmission*](https://www.alange-soehne.com/gb-en/timepieces/selections/the-fusee-and-chain-transmission)

**Maintaining power.** A fusee loses its drive while being wound — the arbor
turns the wrong way — so the great wheel runs loose and is fed by a spring held
against a detent for the duration. That is John Harrison's arrangement (1730s),
standard on fusee marine chronometers; Lange solves the same problem with
planetary gearing under the ratchet wheel instead. It is why this movement has
a maintaining detent at all, and why the escapement cannot run backwards during
a wind.

**The lever escapement.** George Daniels, *Watchmaking* (rev. ed., Philip
Wilson) is the standard treatment of the phases *Swiss lever escapement* names
— lock, draw, impulse and drop — and of why the locking face's lean is what
holds the fork on its banking. The build asserts the sign of that draw torque
at boot; Daniels is where the requirement comes from. Donald de Carle,
*Practical Watch Repairing*, is the everyday reference for the keyless works
and the motion works.

**Tooth form.** Watch and clock wheels are cut cycloidal, not involute —
Ciechanowski's gear-train section is the accessible statement of why, and
Daniels the practical one. This movement does **not** cut either: see
`TODO.md` item 61, which says so at length rather than letting the citation
imply otherwise.

**The gong.** The partial ratios in *The gong's voice* are the Euler–Bernoulli
clamped-free beam's, not a horological source: the mode constants
`(βₙL)² = 3.516, 22.03` are standard, and the ~6.3× second partial they give is
why a struck bar clangs where a string sings.

A note on what these citations do and do not license. They describe
mechanisms; they are not evidence that this movement reproduces them. What
holds the movement to its own claims is the instrument battery and `TODO.md`,
not this list — and where a source describes something the build does not do,
the honest place to find that out is the debt item, which is why two entries
above point at one.

## Made with Claude

This project was made possible by **Claude**, Anthropic's AI model. The
movement, the layout solver, the inspector and every document in this
repository — this file included — were designed and built in collaboration
with it, and the reasoning behind each shipped decision is recorded in
`docs/BUILT.md` rather than left implicit.

That is a statement about *authorship*, not a warranty. Nothing here asks to
be believed because of who wrote it: the constants are derived from stated
constraints, the derivations are written next to them, and the checks above
are what hold them — which is exactly why so much of this repository is
instruments and so much of `TODO.md` is the gap between what is modelled and
what is genuinely simulated.

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
