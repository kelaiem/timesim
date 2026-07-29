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

New feature → file it in `BACKLOG.md` in the private `timesim-roadmap`
repo, not here. Something already built is lying
about how a watch works → `TODO.md`. Both are written to be actionable by
someone who wasn't in the conversation; match that.

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
   arming run within ±tol of touch at both parities, or waived — TODO
   19/20 carry the current debt; do not widen a tolerance to green a
   row), clearances 0 violations, full
   `inspection { includeExcluded: true }` 0 FORBIDDEN,
   and `sweptOverlap` **0 CONFIRMED** (§36 job B — hull overlaps are
   pose-confirmed before they count; `tight` and `refuted` rows are
   reports, not failures), and `stockFloor` **0 degenerate and 0
   unwaived** (§50 — a waived row is accepted debt citing its TODO
   item, visible in the report).
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

### Two things the battery structurally cannot see

Both are written up in `TODO.md` (items 5 and 6), and both have produced
real defects that every clean run missed:

- **Inside a unit.** The sweep enumerates *distinct* unit pairs, so a part
  colliding with another part of the same unit is invisible. A bracket post
  standing inside its own crank's swing survived every run this way.
- **Anywhere between an EXPECTED pair.** `EXPECTED` is granted per unit
  *pair*, not per contact, so one declared mesh excuses every other overlap
  between those two units.

If you are checking a fixture against the mover it carries, or two units
that already touch somewhere, measure it yourself.

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
