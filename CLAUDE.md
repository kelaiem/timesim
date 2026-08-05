# Working on this repo

A browser 3D simulation of a fusee-and-chain watch movement with a Swiss
lever escapement. Everything is procedural — there are no model assets.

**The other docs, and when to read them:**

| File | What it is |
|---|---|
| `SPEC.md` | The architecture contract. Read before changing structure. |
| `docs/BUILT.md` | How shipped features were designed — numbered (§n); source comments cite these. |
| `BACKLOG.md` | Unshipped roadmap. **Private** — lives in `kelaiem/timesim-roadmap`, not this repo. |
| `TODO.md` | Mechanical-realism debt: honesty fixes to what exists. |
| `AESTHETICS.md`, `src/aesthetics.json` | Finish parameters and the reasoning behind them. |
| `docs/MODELING.md` | Geometry-building conventions. |

`test-geometry.html` is a per-part visual smoke test, separate from the
inspector.

`explain.html` is the mechanism explainer (§65, plates for every
mechanism as of §67) — linked from the HUD, styled as the HUD. When a
significant mechanism ships or changes, add or refresh its entry there
in the same landing; plate numbers quote the real source constants, and
entries state their mechanism's open TODO debt rather than hiding it.
The page is sim-code-free, so explainer landings don't touch the battery.

The sim's schematic mode (§66) is a parallel **Line-only** tier on
camera layer 1: any rotor whose builder records `userData.r` gets its
pitch-circle proxy for free, and contact dots are lit by
`measureHandoffsNow` — the same `ALARM_HANDOFFS` rows the battery
gates, measured at the current pose (a live display, not a gate). Two
invariants, both boot-asserted: the tier's proxies are never Meshes,
and the mode swaps by camera layer, never by `mesh.visible` (parts
whose visibility is a tick law must keep their state). The one meshy
exception is the plate OCCLUDERS (§71's hidden-line convention —
page-colored silhouettes of the base and three-quarter plates):
`collectUnits` in `inspect.js` prunes anything flagged
`userData.schematic` wherever it is parented, so flagged display never
joins the sweeps — the same trust the fingerprint extends. Flag every
schematic object directly; an unflagged child of a flagged parent is
NOT protected.

The chrome is LOCALIZED (§73 tier one — English, German, Chinese):
`src/i18n.js` holds one table keyed by the English source string, so the
app keeps authoring its UI in English and `t()` / `localizeTree()`
resolve at the display site; a missing entry falls back to English
VISIBLY. Two rules when touching UI text. **State is an attribute, never
the text**: toggles carry `data-state="on|off"` (`setBtnState`), §72's
`aria-pressed` observer watches that attribute, and no code may compare
button text to `'On'`. **Display translates, values do not**: option
`value`, `data-cam`, unit and group names in `MECH_GRAPH`, persisted
state and deep-link params stay canonical English — `t()` only ever
reaches `textContent`, `title`, `placeholder` and `aria-label`. Numbers
go through `fmtNum`/`fmtInt` at the display layer only (German reads
`30,0 h` and `18.000 A/h`; the stored value keeps its `.`). Locale is
reload-tier (§22's precedent), so there is exactly one path that builds
a localized panel. **`explain.html` is localized too** (§73 tier two):
`src/explain-i18n.js` + one table per locale, keyed by the English source —
rich blocks by their normalized `innerHTML`, so a sentence's inline markup
travels with it. EDITING THE ENGLISH INVALIDATES ITS TRANSLATION BY DESIGN:
the key stops matching and that block renders English until re-translated,
which beats a stale paragraph confidently describing changed prose. Never
retype a key — `node tools/explain-i18n.mjs --extract` regenerates them from
the DOM; `--check` is the gate (0 unmatched keys, 0 markup/`<code>`/id drift,
0 plate-number drift, and no label overrunning its plate against the English
baseline). A second instrument, `node tools/explain-quotes.mjs`, answers the
older question the page's header promises — do its numbers still match
`src/*.js`? — comparing every quoted constant against the source (literals
and expressions it can resolve; the rest reported, never silently passed).
Both run in one fast CI workflow, separate from the battery. The explainer's numbers stay
in SOURCE form in every language — they are identifiers being quoted, not
quantities being read aloud, which is the one place tier one's `fmtNum` rule
deliberately does not apply.

New feature → file it in `BACKLOG.md` in the private `timesim-roadmap`
repo, not here. Something already built is lying
about how a watch works → `TODO.md`. Both are written to be actionable by
someone who wasn't in the conversation; match that.

**Say "modelled" and "simulated" precisely** (README has the full
definitions): the MODEL is the description — geometry, derived constants,
declared structure — and *modelled* claims only that a thing is described;
the SIMULATION is the model advanced by causality through drive edges, and
*simulated* claims behavior is DRIVEN, not posed. Most honesty debt lives
exactly in the gap (a "simulation fiction" animates with no force path;
TODO 20's arming run WAS posed from its output and is now driven from its
input, pawl to ring — the worked example of closing that gap, not of
living with it). Claiming "simulated" for what is
merely modelled is the lie most of `TODO.md` exists to catch — don't write
it into prose either.

## Standing rules

1. **Constants are DERIVED from constraints, with the constraint written in
   the comment.** A number that appears because it looked right is a bug in
   waiting. `CLEAR_MARGIN = 0.15` is the *one* clearance margin — don't
   introduce a second.
2. **Angles travel the gears.** Never assign a display quantity that a real
   train would produce. The hour hand is not `minuteA / 12`; it arrives at
   12:1 because the tooth counts multiply to it. Hand-setting is derived
   forward from the crown through the keyless chain. Closing that class of
   shortcut is most of `TODO.md`'s history.
3. **Every new part is declared in `MECH_GRAPH`** (`src/inspect.js`) — what
   supports it, what drives it.
4. **The inspector battery is clean before anything lands**: support 0
   failures, graph clean, penetration within budgets (waived rows are
   accepted debt citing their TODO item, same convention as stockFloor),
   `alarmHandoffs` **0 unwaived** (every claimed contact of the §35
   arming run within ±tol of touch at both parities, or waived citing a
   TODO — currently every row measures green with zero waivers; do not
   widen a tolerance to green a row), clearances 0 violations, full
   `inspection { includeExcluded: true }` 0 FORBIDDEN,
   and `sweptOverlap` **0 CONFIRMED** (§36 job B — hull overlaps are
   pose-confirmed before they count; `tight` and `refuted` rows are
   reports, not failures), and `stockFloor` **0 degenerate and 0
   unwaived** (§50 — a waived row is accepted debt citing its TODO
   item, visible in the report), and `intraUnit` **0 unwaived**
   (TODO 5's interim — movers vs their own unit's fixtures; declared
   joints live in `INTRA_UNIT_CONTACTS`, waived rows cite their TODO),
   and `expectedContacts` **0 unwaived and 0 unmatched selectors**
   (TODO 6 — per-contact clearance floors across EXPECTED pairs, the
   declared meshes excluded; same waiver convention), and `oscillator`
   **0 failures** (TODO 25 tier two — the hairspring's section is SOLVED
   from the balance's inertia so `√(k/I)` lands on `F_BALANCE`; the gate
   holds that solve true and holds the ribbon inside real hairspring
   stock, 0.02–0.04 mm. Change the spiral's plan — coils, radii, height —
   and re-solve; never re-target the beat to match a spring),
   and `restoring` **0 unwaived, 0 malformed, 0 stale, control PASS**
   (§48's no-spring audit, gated by TODO 29 — every part that RECIPROCATES
   either has a restoring element that exists as a mesh, is driven both ways,
   or is waived citing its TODO. §48's rule that the audit is a REPORT is
   kept: `ok` is always true and the rows are the product, so the gate holds
   only what can be held. **Its population comes from the §36 registry's
   `reversed` flag over `AXES`, so a part no axis MOVES is a part it cannot
   judge** — ship a mechanism with its own input and you must ship the axis
   that exercises it, or this passes it in silence. That is not theoretical:
   before TODO 29 no axis anywhere varied `alarmOn`, and the alarm lock —
   the movement's clearest no-spring case — was invisible for exactly that
   reason).
5. **Parts near the low corridor consume `LOW_LINKAGE_OBSTACLES`** — the
   single source for that band's swept footprint.
6. **Boot is silent.** Build-time asserts `console.warn` with the achieved
   and required numbers; a warning at boot means something regressed.

## Design priority — the mechanism outranks its accommodation

An ACTION GROUP is the set of members that carry one input to one output
through MECH_GRAPH's drive edges — pusher→pawl→column→…→ring,
crown→keyless→hands, striker→hammer→gong. When work on a group conflicts
with the space around it, the priorities are, highest first:

**P0 — Mechanical truth within the group.** Causality enters at the input
and arrives at the output through closed contacts. Every hand-off measures
shut (±HANDOFF_TRACK_TOL); every member's pose derives from the member
that drives it, against a surface that was actually cut; no coefficient
exists because it made the picture right — rule 1, at mechanism scale.
Instruments: alarmHandoffs-class contact checks, graph, the §48
no-spring audits.

**P1 — Structural truth within the group.** The members can do the job as
matter: sections derived from load paths (§54's ceiling and §50's floors
as consequences, not targets), lever ratios someone would DESIGN, stall
forces inside the spring and detent budgets — filed as arithmetic,
TODO 16's 1.5 mN vs 5–50 mN being the format. A ratio inherited from
routing is a defect even while every sweep is green.

**P2 — The group agrees with itself.** Members of one group must not foul
each other anywhere in the action cycle — the pair sweep structurally
cannot see this (TODO 5), so it is asserted per group — and
working-contact budgets are sized SMALLER than the strokes they police
(0.12 against a 0.19 travel graded touching, apart, and buried as one
measurement). A geometric impossibility inside the group — §34's radial
cardioid sweeping through its own follower's pivot — is a P0/P2 finding
and rightly forces redesign; that authority is exactly what unrelated
parts don't get.

**P3 — The group fits the movement.** Zero contact with unrelated
components across every axis. Still a hard gate to LAND — but resolved in
POSITION space: move the station, renegotiate the stratum (§51's
precedent), re-site the obstacle, re-solve the layout (§13/§22/§33
machinery). Forbidden resolutions: stretching or shrinking a lever arm,
opening a contact, thinning a member below P1, geometry that exists only
in a function, widening a budget or waiver. If no arrangement exists
without spending P0–P2, that is a LAYOUT problem to file and solve, not a
mechanism problem to absorb.

**P4 — Finish** (AESTHETICS.md), last, as now.

**Why this is written down.** §35 ran the order backwards. Three corridor
routes were torn out on collision grounds; the only region offering a
short beak tail was corridor-unreachable, so the tail grew to 26.79 — a
36.5× displacement gain "nobody asked for," a 1.5 mN stall force against
a 5–50 mN detent, and a run in which, measured, NO hand-off touched —
while every collision gate stayed green. The corridors were satisfied;
the watch was not. Unrelated collisions keep their veto over LANDING and
lose their authority over DESIGN: a corridor problem is solved in
position space, never in mechanism space.

**Order of work this implies.** Prove the group at P0–P2 first — in free
space if necessary, its instruments red until the contacts genuinely
close — then hunt the corridor at P3 with the mechanism's dimensions held
fixed. A P3 conflict discovered late moves the group or the obstacle, or
files the layout change; it does not reach back into the group. Waivers
exist only at P0–P2 and only citing a TODO with a fix path; P3 is never
waived, and never paid for out of P0–P2.

**Design in a line, fold to fit.** "Free space" made physical, the way
real calibers are developed: a new action group is designed as a
STRAIGHT chain, input at one end, output at the other, no corridors —
in the line it is structurally impossible to pay for packaging with a
lever arm. The quantities the line establishes (mesh ratios, arm
lengths, displacement gains, stall forces) are its LINE SPEC, the
reference the folded build must measure back to (§70 in the roadmap
files the instrument). Packaging is then a FOLD, and a fold's only
currencies are position-space: azimuth about a mesh point, stratum,
stations, and corners/idlers — each fold-added part a real part with
its own P1 duties (the motion-works arbor's bevel corners are the
template). A fold that changes a spec quantity goes red UNLESS it is a
declared FORK: a named copy of the reference spec whose changed rows
each re-derive their value from the movement constraint that forced
them, written in place — rule 1 at mechanism scale. Budget ENVELOPES
(detent force windows, §50 section floors) are inherited from the
reference and are never forkable: §35's 26.79 tail fails as a fork
too, which is the point. References are movement-independent, so a
proven mechanism can be re-integrated — or forked again — into another
layout.

## Running it

Use the `.claude/launch.json` preview config named `clock` (python3
`dev_server.py` on :8347). Never start a dev server by hand.

**In a git worktree, the preview server still serves the MAIN checkout.**
Worktrees live under the served root, so load the worktree's build directly:

```
http://localhost:8347/.claude/worktrees/<name>/index.html
```

State (camera pose, wind, τ) persists via the dev server's `/__state` temp
file, falling back to `localStorage`. **Back it up before clearing it** —
`GET /__state`, keep the JSON, `PUT` it back when done.

## Releasing

`release.yml` runs from the Actions tab only: it bumps the
major.minor.patch tag on the tip of `main`, publishes a GitHub Release,
and deploys the tagged tree to QA over SFTP, repointing the QA symlink.
`tools/stamp-release.mjs` (§28) stamps every asset URL with
`?v=<version>` so browsers can't serve stale modules — paths stay
deliberately RELATIVE (the web root may be the symlink itself; an
absolute `/<releases>/<version>/` rebase 404s the whole app). All
dev/CI dependencies live under `tools/` so the app itself stays
dependency-free, and the release payload excludes `tools/`.

## Inspecting

Verify with `src/inspect.js`, not by eye:

```js
const I = await import('./src/inspect.js');   // worktree: /.claude/worktrees/<name>/src/inspect.js
I.start(__clock, 'inspection', { includeExcluded: true });  // poll I.status()
I.start(__clock, 'support');                                // 0 failures
I.start(__clock, 'clearances');                             // 0 violations
```

CI runs this whole bar on every PR (§52): `.github/workflows/battery.yml`
drives `tools/ci-battery.mjs` — headless Chromium, one check at a time,
plus boot-silence and a fingerprint-determinism double-boot. `node
tools/ci-battery.mjs` runs the same gate locally (needs `npm ci` in
`tools/` and a Playwright Chromium). It enforces rule 4; it does not
replace the focused checks below while iterating.

Use `start()`/`status()`, never `await` the sweep directly — full runs take
100 s+ and blow a browser-eval timeout. Do **not** pass
`yieldEvery: Infinity` to work around it: that removes the cooperative
yields and wedges the tab. Driving the browser through tooling changes the
arithmetic entirely — see the yield-throttling trap below before starting a
sweep that way.

### Two blind spots, now partially instrumented

Both are written up in `TODO.md` (items 5 and 6), and both produced
real defects that every clean run missed. Each now has an instrument in
the battery — with known residue:

- **Inside a unit.** The pair sweep cannot see it; `intraUnit` (TODO 5's
  interim) now checks each unit's movers against its own fixtures over
  the pose net. Still invisible: fixture-vs-fixture (the pallet's
  ruby-in-slot instance) and mover-vs-mover within one unit.
- **Anywhere between an EXPECTED pair.** `EXPECTED` is granted per unit
  *pair*; `expectedContacts` (TODO 6) holds the pairs declared in
  `EXPECTED_CONTACT_FLOORS` to `CLEAR_MARGIN` everywhere EXCEPT their
  named contact meshes. Only seeded pairs are covered — an EXPECTED
  pair without a floors row still gets the blanket excuse.

If you are checking a residue case — two fixtures, two movers of one
unit, or an EXPECTED pair with no floors row — measure it yourself.

## `window.__clock` — the inspection surface

`setPose({ tau, crownPullT, leverEngage, tension, windAccumTurns })` forces
an exact pose, `step(dt)` advances deterministically, plus `render()`,
`tau`, `displayTime`, `dialEpoch`, `balanceRate`, `crownRotation`,
`setCrownRotation`, `P`, `plateR`, `dialRadius`, `labelEntries`, `scene`,
`camera`.

## Traps that have cost real time

- **`setPose` ticks with zero dt**, so anything eased (the minute jumper's
  snap, `crownPullT`) cannot move under it. Use `step(dt)` in a loop when an
  ease has to run.
- **rAF throttles hard under automation.** A background pane drops to ~1 fps
  and `realDt` is clamped, so timed loops inside one browser eval measure
  nothing — the sim barely advances. Prefer `step()`; if you must observe
  `frame()` behaviour, sample across separate tool calls and force paints
  with screenshots.
- **So do the sweeps' own yields — and the fix has a cliff on both sides.**
  `sweepClearances`/`runInspection` stay responsive by pausing every
  `yieldEvery` poses via `setTimeout(0)`. An automated pane throttles that
  to ~1 s, so a default run is almost entirely *idle*: thousands of naps,
  hours of wall clock, and a status that reads `running` forever. Raising
  `yieldEvery` eats fewer naps but lengthens each blocking chunk, and too
  high wedges the tab — the same failure as `yieldEvery: Infinity`, just
  slower to arrive (384 wedged it; 64 is the value that works, clearances
  ~300 s and inspection ~46 s). Run the two long checks one at a time, not
  via `startAll`. None of this applies when a human has the tab in front of
  them: the default 16 is correct there.
- **`inspect.js` couples by string.** Every `MECH_GRAPH` / `EXPECTED_PAIRS` /
  anchors name must match a `registerLabel` name *verbatim*.
- **`dialFace` is Y-flipped**: dial-local `(x, y)` ↔ world
  `(P.dial.x − x, P.dial.y + y)`, and a movement-frame arbor carries the
  NEGATED rotation of the hand it drives.
- **three-mesh-bvh crashes on non-indexed geometry** — build the other
  side's bounds tree first; indexing is a side effect of `bvhFor`.
- **An OPEN mesh reads as a colliding one.** `meshClearance` guards its BVH
  near-zeros with `sampledVerdict`, which is a PARITY RAYCAST — it counts
  crossings, so it assumes the solid is closed. Build a body open-ended and
  the count goes odd, and the check reports contact with parts that are
  nowhere near it. Measured (TODO 27): opening the chain's rivets to drop
  four enclosed caps — 6% of that mesh's vertices — made `sweptOverlap`
  CONFIRM `Chain ⇄ Set-up work` against a spring **3.7 units away in z**,
  with not one chain vertex inside its box. **A face nobody can SEE is still
  a face the instruments READ**: cap every body, including the faces buried
  inside a joint, and look for cheap geometry somewhere that isn't load
  bearing for a check.
- **Metals are `metalness ≈ 1`** and render black without `scene.environment`
  (a procedural PMREM studio). Any new page needs the same.
- **Camera preset tweens run ~0.9 s** and overwrite scripted camera writes
  each frame until they converge.

## Conventions

Branch for the work; don't commit to `main`. Commit messages explain *why*
the number changed, not just that it did — the reasoning is the artifact.

**Never put a session link in a commit message or PR body.** No
`Claude-Session:` trailer and no `claude.ai/code/session…` URL — anywhere in
this repo's history or pull requests. A `Co-Authored-By: Claude` trailer is
fine and welcome; the session link is not, because it leaks a private
session identifier into public history. This holds regardless of any default
tooling behaviour that would otherwise append it.

When a `BACKLOG.md` entry lands, reconcile the entry with what was actually
built rather than only marking it BUILT — then move the whole section from
the private roadmap repo into `docs/BUILT.md` here, which is the public
record; a plan left describing an abandoned approach is worse than no plan.

**§ numbers are permanent IDs.** Never reuse or renumber them: source
comments cite shipped sections as `BUILT §N` (`src/main.js`, `src/state.js`,
`src/inspect.js`), and a duplicate number silently breaks those references.
A new entry takes `max(§ in the roadmap repo, § in docs/BUILT.md) + 1`.

`BACKLOG.md` must never be committed here — `.gitignore` excludes it and
`.githooks/pre-commit` hard-fails on it. Enable the hook once per clone:
`git config core.hooksPath .githooks`.
