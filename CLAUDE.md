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
   failures, graph clean, penetration within budgets, clearances 0
   violations, full `inspection { includeExcluded: true }` 0 FORBIDDEN.
5. **Parts near the low corridor consume `LOW_LINKAGE_OBSTACLES`** — the
   single source for that band's swept footprint.
6. **Boot is silent.** Build-time asserts `console.warn` with the achieved
   and required numbers; a warning at boot means something regressed.

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
const I = await import('/src/inspect.js');   // worktree: /.claude/worktrees/<name>/src/inspect.js
I.start(__clock, 'inspection', { includeExcluded: true });  // poll I.status()
I.start(__clock, 'support');                                // 0 failures
I.start(__clock, 'clearances');                             // 0 violations
```

Use `start()`/`status()`, never `await` the sweep directly — full runs take
100 s+ and blow a browser-eval timeout. Do **not** pass
`yieldEvery: Infinity` to work around it: that removes the cooperative
yields and wedges the tab.

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
