# Architecture

A map of what lives where and why, for someone reading this codebase for the
first time. It is deliberately a *navigation* document: it states the shape of
the system and points at the file that owns each detail, rather than restating
it. The authoritative long-form sources are:

| Source | What it holds |
|---|---|
| `CLAUDE.md` | Standing rules, run/release/inspect procedure, the traps that have cost real time |
| `docs/BUILT.md` | The permanent record — one `§N` section per shipped change, 111 of them |
| `docs/MODELING.md` | Geometry-honesty rules, each paid for by a real shipped defect |
| `TODO.md` | The open debt ledger; every waiver in the code cites an item here |
| `AESTHETICS.md` | What `src/aesthetics.json` may configure, and what it may not |
| `SPEC.md` | The original two-agent build spec. **Historical** — it predates the fusée, `layout.js` and the current scale, and is kept as a record, not as a description of today's tree |

## The shape of the thing

A browser-based 3D simulation of a fusée movement with a Swiss lever
escapement. Three properties drive nearly every architectural decision:

1. **No build step.** `index.html` loads `src/main.js` as an ES module and an
   importmap resolves bare `three` specifiers to `vendor/`. What you edit is
   what the browser runs, which is why the dev server sends
   `Cache-Control: no-store` and why release stamping (rather than bundling)
   is how staleness is solved.
2. **The app has zero runtime dependencies.** Three.js 0.165 and
   three-mesh-bvh are vendored under `vendor/`. Everything with an npm
   dependency lives under `tools/` so it can never enter the release payload.
3. **Correctness is enforced by instruments, not by review.** The movement is
   claimed to be mechanically plausible, so that claim is gated: a headless
   battery drives the real geometry through its phase axes and fails on
   interference, unsupported parts, undeclared drive paths and non-determinism.

## Boot sequence

```
index.html
  │  inline pre-module script  ──►  globalThis.__WATCH_SPEC   (?vph, ?reserveh, ?crownaz)
  │      must run BEFORE any module: layout.js derives the train from it at import time
  ▼
src/main.js  (module graph entry)
  ├─► src/layout.js      pure data + solvers   — no THREE, no scene, no meshes
  ├─► src/geometry.js    part builders          — returns Groups/Meshes in XY, about +Z
  ├─► src/materials.js   shared PBR materials
  ├─► src/aesthetics.js  aesthetics.json + session overrides (crash-guarded)
  ├─► src/i18n.js        chrome strings; UI_LANG resolves once at import
  └─► src/state.js       /__state, falling back to localStorage
  ▼
assembly: parts positioned off the solved Z-stack, each registered via registerLabel()
  ▼
weldTree()  — every mesh reaches the scene INDEXED (§81), so BVH queries are sound
  ▼
build asserts  — console.warn with achieved vs required; boot is SILENT when healthy
  ▼
window.__clock = { … }   ← the boot-complete handshake every tool waits on
  ▼
render loop: frame() → fixed-timestep accumulator → tick(dt) × budget → render()
```

Two things about that diagram are load-bearing. The pre-module script exists
because geometry-tier knobs must be readable before `layout.js` evaluates;
everything else that a URL can pose goes through `applyDeepLink()` *after*
boot. And `window.__clock` is not a debug convenience bolted on — it is the
documented inspection surface that the entire verification layer drives.

## Layers

```
  ┌───────────────────────────────────────────────────────────┐
  │  pages        index.html · explain.html · primer.html     │
  │               test-geometry.html                          │
  ├───────────────────────────────────────────────────────────┤
  │  app          main.js   (scene, assembly, tick, UI)       │
  ├──────────────────────────┬────────────────────────────────┤
  │  build        geometry.js│ materials.js · aesthetics.js   │
  ├──────────────────────────┴────────────────────────────────┤
  │  model        layout.js  (constants + solvers, pure)      │
  ├───────────────────────────────────────────────────────────┤
  │  services     state.js · i18n.js · page-i18n.js · sw.js   │
  ├───────────────────────────────────────────────────────────┤
  │  verify       inspect.js  ⇄  tools/ci-battery.mjs         │
  └───────────────────────────────────────────────────────────┘
```

Dependencies point downward only, with one deliberate exception: `inspect.js`
reads the *running scene* through `window.__clock` rather than importing the
app, which is what lets it be loaded from a console against any deployed build.

## File map

### `src/` — the application

| File | Lines | Role |
|---|---|---|
| `main.js` | 30,426 | Scene, lighting, camera, full movement assembly, escapement state machine, train kinematics, keyless works, alarm complication, HUD/panel, deep links, render loop. Exports nothing; its public surface is `window.__clock`. |
| `geometry.js` | 6,184 | Horological part builders (`makeDial`, `makeFusee`, `makeBarrel`, `makePalletFork`, `makeThreeQuarterPlate`, …). Every builder returns a Group/Mesh lying in XY, centred at the origin, rotating about local +Z, with `userData.r` = pitch or functional radius. No animation, no scene access. |
| `inspect.js` | 8,690 | The instrument layer: `MECH_GRAPH` (declared support/drive structure), `AXES` (the phase axes a sweep walks), `EXPECTED_PAIRS`, budget and waiver tables, and ~20 checks behind a `CHECKS` registry. |
| `layout.js` | 2,037 | Pure model: kinematic constants and the whole Z-stack, each derived from a stated constraint, plus the solvers (`solveLayout`, `solveKeyless`, `solveStopWork`, `solveElbow`). Reads only its arguments and `__WATCH_SPEC` — no `THREE`, no aesthetics import (§97). |
| `materials.js` | 283 | Shared `MeshPhysicalMaterial` set, so the movement reads as one coherent finish. Metals sit at `metalness ≈ 1` and render black without `scene.environment`. |
| `aesthetics.js` | 91 | Loads `aesthetics.json`, merges session overrides from the tuning panel, and carries the crash-recovery guard that drops overrides which killed the previous build. |
| `aesthetics.json` | 250 | The visual configuration of record. **It is part of the build**, not documentation — the battery does not ignore it. |
| `state.js` | 180 | Persistence. `/__state` primary, `localStorage` fallback, plus the `?trial=1` guard that stops a throwaway verdict boot from reading or writing the session's state. |
| `i18n.js` | 1,828 | Tier one — the chrome's strings, keyed by the English source, five locales. Resolution order: `?lang` → `localStorage` → `navigator.language` → English. Missing entries fall back to English *visibly*. |
| `page-i18n.js` | 93 | Tier two engine — the DOM walk and swap shared by the static pages. |
| `explain-i18n*.js`, `primer-i18n*.js` | ~3,300 | Tier two tables, one module per page plus one per locale. The explainer does **not** localize numbers (it quotes source constants); the primer does (it reads quantities aloud). |

### Root

| File | Role |
|---|---|
| `index.html` | The sim. Importmap, pre-module spec script, `#app` mount. |
| `explain.html` | Hand-maintained mechanism explainer; quotes real constants from `src/*.js`, and `tools/explain-quotes.mjs` gates that promise. |
| `primer.html` | Horological primer. |
| `test-geometry.html` | Geometry harness page. It **ships** in releases and is stamped — a new page must be stamped in the same change. |
| `sw.js` | Service worker (§79). Cache-first over the precached release set, network-only otherwise; `version.json` and `/__state` are explicit pass-throughs. In a source tree `VERSION` is `null` and the worker dismantles itself. |
| `dev_server.py` | Static server on `:8347` plus the `/__state` GET/PUT/DELETE endpoint, and `no-store` on every response. Loopback only. |
| `manifest.webmanifest`, `favicon.*`, `apple-touch-icon.png` | PWA furniture. `favicon.svg` is generated from the real crown monogram by `tools/make-favicon.mjs`. |

### `tools/` — never shipped

| File | Role |
|---|---|
| `ci-battery.mjs` | The battery as an exit code. Boots the sim in headless Chromium against `dev_server.py`, runs every gate standing rule 4 names, plus boot-silence and a two-virgin-boot geometry fingerprint. Everything in this file runs fresh every run. |
| `battery-checks.mjs` | **Digested.** What a check is asked to compute (`BATTERY`, `runCheck`, `virginBoot`, `prepPage`, `RESTRICTABLE`). An incremental run may inherit a stored row only when this file's digest is unchanged, which is why the fresh/inheritable boundary is a file boundary. |
| `battery-split.mjs` | The partition atom: turns a check with a per-axis outer loop into one task per axis, and reassembles the payload byte-identically to a whole run's. |
| `battery-union.mjs` | Merges a restricted run's fresh rows with a baseline's untouched rows, so gates always run over a payload describing every pair. |
| `payload.sh` | **The only definition of the deployed payload** — the app, `vendor/`, the licences. Both deploys call it. |
| `stamp-release.mjs` | §28 — stamps every asset URL `?v=<version>`, emits `version.json`, bakes `sw.js`'s `VERSION`/`PRECACHE` from the same walk. |
| `build-pages.mjs` | Finishes one extracted payload tree into one Pages environment, using the same stamper. |
| `offline-check.mjs` | Stands up two stamped releases on one origin behind a repointed symlink and boots both offline. Exercises release machinery the battery deliberately never runs. |
| `explain-i18n.mjs`, `explain-quotes.mjs` | Tier-two coverage/extraction, and the gate that the explainer still quotes the source. |
| `check-bvh-patches.mjs` | Verifies the three local patches in `vendor/three-mesh-bvh.module.js` still hold. **Run after any vendor bump, before trusting a clearance number.** |
| `three-node-loader.mjs` | Resolves the app's bare `three` specifiers under Node, so a tool can drive the real builders instead of a copy of their arithmetic. |
| `make-favicon.mjs` | Renders the favicon from `brandMarkShapes` in `src/geometry.js`. |
| `probe-*.mjs` (80 files) | One-off measurement scripts, each cited from `TODO.md` / `docs/BUILT.md` as the evidence for a specific number. **None run in CI**, so treat any given probe as unverified until you run it. |

## Conventions that the code assumes

- **Units.** Geometry is authored in units; `UNIT_MM = CHAIN_PITCH_MM / CHAIN_PITCH ≈ 0.379 mm/unit`, derived from real fusée-chain pitch (§39). The whole assembly is ~26.4 units deep, ≈10 mm on a 32.5 mm plate. (`SPEC.md`'s "1 unit = 1 mm" is the historical scale.)
- **Orientation.** Parts are built lying in XY, centred at the origin, rotating about local +Z. Assembly positions and rotates them.
- **`dialFace` is Y-flipped**: dial-local `(x, y)` ↔ world `(P.dial.x − x, P.dial.y + y)`, and a movement-frame arbor carries the *negated* rotation of the hand it drives.
- **Constants are derived, with the constraint in the comment** (standing rule 1). `CLEAR_MARGIN = 0.15` is the one clearance margin.
- **Angles travel the gears** (standing rule 2). No display quantity is ever assigned a value a real train would produce; the hour hand arrives at 12:1 because tooth counts multiply to it.
- **`inspect.js` couples by string.** Every name in `MECH_GRAPH`, `EXPECTED_PAIRS`, the budget tables and the anchors must match a `registerLabel()` name in `main.js` *verbatim*. A stale selector is itself a battery failure.
- **Every mesh must be closed.** The clearance path guards BVH near-zeros with a parity raycast, which counts crossings and therefore assumes a closed solid. An open body reads as colliding with parts nowhere near it. Cap every face, including ones buried inside a joint.
- **Boot is silent** (standing rule 6). A warning at boot means something regressed.
- **`§N` numbers are permanent IDs**, cited from source comments. Never reuse or renumber.

## The simulation step

`tick(dt)` is the single causal step, and its ordering is a contract: lever
engagement → crown clutch selection (by physical position, not by the raw
target) → wind input through the keyless chain with one-way click and arrest →
mainspring relaxation and maintaining power → escapement beat state machine
(lock → unlock with draw recoil → impulse → drop) → alarm complication →
display posing. Train angles are closed-form functions of the escape-wheel
angle, so no wheel can drift.

`frame()` owns wall clock: `REAL_DT_CLAMP` caps a stalled tab to one slow
frame, a fixed `1/240` accumulator feeds `tick`, and a per-frame `tickBudget`
means a slow machine gets *fewer* ticks with the remainder consumed in coarse
strides — never more work.

The distinction the project's vocabulary rests on: the **model** is the
description (parametric geometry, derived constants, declared structure), and
the **simulation** is that model advanced by causality. A part that animates
with no force path is a *simulation fiction*, and the `graph` check names it.

## Verification architecture

```
window.__clock ──► src/inspect.js  CHECKS registry (+ CHECK_NAMES roster)
                        ▲
                        │ in-page start()/status() protocol
                        │
tools/ci-battery.mjs ───┤  fresh every run: partition, cost column, spec boots,
   (the harness)        │  fingerprint + digest anchors, paths-ignore gate, logging
                        │
tools/battery-checks.mjs┘  DIGESTED: what a check computes, the virgin boot,
                           which checks may be narrowed
```

Roughly twenty checks run as gates: `support`, `graph`, `axisEntry`,
`penetration`, `alarmHandoffs`, `stockFloor`, `slenderness`, `meshIntegrity`,
`intraUnit`, `assembly`, `expectedContacts`, `inspection`, `clearances`,
`sweptOverlap`, `oscillator`, `equalisation`, `chainLength`, `restoring`, plus
the two handoff checks and a `focused` convenience that is never part of a full
pass. Standing rule 4 in `CLAUDE.md` states each gate's bar.

Four structural properties are worth knowing before you touch any of it:

- **`start()` calls `clock.resetInputs()`** before every check, so no check can
  observe which ran before it. That invariant is what makes sharding legal — if
  a report ever moves between `--shards 1` and `--shards 2`, the check that
  moved is the bug.
- **The roster is gated against the page.** Twice a check was written,
  exported and never registered, and the symptom was a clean battery that had
  simply not run the instrument. The harness now reads `CHECK_NAMES` from the
  running page rather than trusting a second declaration.
- **`--no-split` and `--shards 1` are references, not legacy.** The split and
  the partition must agree with them.
- **The `paths-ignore` list is held true by the battery itself.** It walks
  `index.html`'s transitive module graph and fails if anything the list ignores
  is on it. `tools/**`, `.github/workflows/**`, `dev_server.py`,
  `src/aesthetics.json` and `vendor/*.js` are deliberately *not* ignored.

Debt that cannot be fixed yet is **waived**, never hidden: a waiver row cites
its `TODO.md` item, is reported in the battery output, and still fails any
*new* interference. `INTRA_UNIT_WAIVERS`, `SLENDER_WAIVERS`, `STOCK_WAIVERS`,
`RESTORING_WAIVERS` and `ASSEMBLY_WAIVERS` are the tables.

## Deployment

Every pointer is a git ref; nothing about which environment serves what lives
outside the repository.

| Environment | Ref | Moved by |
|---|---|---|
| `development` | tip of `main` | any merge to `main` |
| `testing` | newest `major.minor.patch` tag | `release.yml`, which dispatches Pages on publish |
| `production` | the `production` branch | Pages workflow with `promote: <version>` |

`pages.yml` only ever runs from `main`, which is load-bearing: each
environment's *tree* comes from its own ref via `git archive`, but that archive
excludes `tools/`, so the *stamper* always comes from `main`'s checkout. The
consequence to hold in your head is that the site is a function of the three
refs **plus** `main`'s tooling — editing the stamper moves production's bytes
without production's ref moving, which is why `offline.yml` gates that file.

All three environments share one origin, and Cache Storage is partitioned by
origin rather than path, so `sw.js` names its cache for its scope as well as
its version.

## Known architectural debt

Recorded here so a newcomer is not surprised by it, and so nobody assumes the
current shape is the intended one:

- `main.js` is a 30k-line module that exports nothing, with ~1,425 module-scope
  bindings (188 of them mutable). Nothing inside it is reachable by a test.
- `tick()` is ~1,357 lines and the file reaches 31 levels of indentation.
- There is no unit-test layer. The battery is an excellent integration gate but
  it is the only gate, and it costs minutes.
- There is no linter, formatter or type checking.
- The 80 `probe-*.mjs` scripts are cited as evidence but nothing runs them.
- Gate semantics are restated in prose in three places (`CLAUDE.md` rule 4,
  the PR template, `tools/battery-checks.mjs`) and kept in step by hand.

The safe way to attack the first two is leaf-first extraction verified by the
existing fingerprint check, which proves a move changed no part's position —
that is exactly how §13 pulled `layout.js` out of `main.js`'s evaluation order.
