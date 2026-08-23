# Contributing

This project claims that a movement described here could actually be built, and
almost every rule below exists to keep that claim honest. Read
[ARCHITECTURE.md](ARCHITECTURE.md) for the shape of the code; `CLAUDE.md` holds
the long-form procedure and the traps; this file is what to do, in order.

## First five minutes

```sh
git clone https://github.com/kelaiem/timesim.git
cd timesim
git config core.hooksPath .githooks     # REQUIRED — see below
python3 dev_server.py                   # :8347
```

Open <http://localhost:8347/>. There is no build step and no install step for
the app itself — Three.js 0.165 is vendored.

**Enable the hooks on every clone.** They are not optional decoration:

- `.githooks/pre-commit` hard-fails if `BACKLOG.md` is staged. The feature
  roadmap is private (`kelaiem/timesim-roadmap`) and was purged from this
  history; `.gitignore` alone does not survive `git add -f`.
- `.githooks/commit-msg` strips `Claude-Session:` trailers and
  `claude.ai/code/session…` URLs from commit messages. It *strips* rather than
  rejects, specifically so nobody learns to reach for `--no-verify` — which
  would skip the `BACKLOG.md` guard next door.

Only needed for the verification tooling:

```sh
cd tools && npm ci && npx playwright install chromium
```

`python3` must be on `PATH` for the harness too — it starts `dev_server.py`
itself.

## Running it

The dev server also serves `/__state`, which is where the save/load buttons
persist, and sends `Cache-Control: no-store` so edited ES modules are never
served stale. A plain `python3 -m http.server 8347` works too; state then falls
back to `localStorage`.

Two things that have cost people time:

- **In a git worktree the preview server still serves the main checkout.**
  Worktrees live under the served root, so load the worktree's build directly:
  `http://localhost:8347/.claude/worktrees/<name>/index.html`.
- **Back up state before clearing it**: `GET /__state`, keep the JSON, `PUT` it
  back when you are done. Camera pose, wind and τ live there.

Useful URL parameters: `?vph=` and `?reserveh=` (geometry tier, read before any
module loads), `?crownaz=`, `?lang=`, `?tau=`, `?sync=`, `?trial=1`.

## The rules a review will hold you to

The full text is `CLAUDE.md`'s standing rules. In short:

1. **A constant is derived from a constraint, and the comment states the
   constraint.** A number that appears because it looked right is a bug in
   waiting. Do not introduce a second clearance margin — `CLEAR_MARGIN` is the
   one.
2. **Angles travel the gears.** Never assign a display quantity that a real
   train would produce. The hour hand is not `minuteA / 12`; it arrives at 12:1
   because the tooth counts multiply to it. Closing that class of shortcut is
   most of `TODO.md`'s history.
3. **Every new part is declared in `MECH_GRAPH`** — what supports it, what
   drives it. A part that animates with no force path is a *simulation
   fiction*, and the `graph` check will say so.
4. **The battery is clean before anything lands.** See below.
5. **Parts near the low corridor consume `LOW_LINKAGE_OBSTACLES`** — the single
   source for that band's swept footprint.
6. **Boot is silent.** A `console.warn` at boot means a build assert regressed.
7. **A digest is a claim about the metal**, so §152's per-unit key must
   reproduce across two virgin boots.

Read `docs/MODELING.md` before you build geometry. Every rule in it was paid
for by a shipped defect — bevel expansion at sharp corners, capping faces
nobody can see, indexing before a BVH query.

## Verifying your change

**While iterating**, run focused checks from the browser console:

```js
const I = await import('./src/inspect.js');   // worktree: /.claude/worktrees/<name>/src/inspect.js
I.start(__clock, 'support');                       // 0 failures
I.start(__clock, 'clearances');                    // 0 violations
I.start(__clock, 'inspection', { includeExcluded: true });
I.status();                                        // poll
```

`I.CHECK_NAMES` lists every check. Run the two long sweeps **one at a time**,
never via `startAll` — and note that under automation `setTimeout(0)` throttles
to ~1 s, so a default run is almost entirely idle. `yieldEvery: 64` is the
measured value that works; 384 wedged a tab.

**Before opening a PR**, run the whole gate:

```sh
node tools/ci-battery.mjs --report /tmp/report.json
```

Useful flags: `--shards N` (default 3, partitioned by the measured cost column),
`--no-split` (run divisible checks whole — the reference the split must agree
with), `--baseline FILE` + `--digests-base FILE` (inherit untouched rows),
`--no-incremental`. Expect minutes, not seconds: the measured check work is
≈1,400 s before sharding.

Two invariants to know before you debug a surprising result:

- If a report moves between `--shards 1` and `--shards 2`, **the check that
  moved is the bug** — `start()` resets inputs before every check, so no check
  may observe which ran before it.
- If a gate passes but its *numbers* moved, that is still a regression. The
  PASS/FAIL column is not the acceptance; `--report` diffed against the base
  is.

### If you cannot fix it yet

Waive it, do not hide it. A waiver row cites its `TODO.md` item, appears in the
battery output as declared debt, and still fails any *new* interference. The
tables are `INTRA_UNIT_WAIVERS`, `SLENDER_WAIVERS`, `STOCK_WAIVERS`,
`RESTORING_WAIVERS`, `ASSEMBLY_WAIVERS`. **Never widen a tolerance to green a
row** — that converts a measured defect into a silent one.

## What CI runs

| Workflow | Trigger | What it gates |
|---|---|---|
| `battery.yml` | PRs (with a `paths-ignore` list), every push to `main`, manual | The whole of standing rule 4, plus boot silence and a two-virgin-boot fingerprint. Pushes to `main` produce the baseline that later PRs run incrementally against. |
| `offline.yml` | PRs touching `sw.js`, the documents, the i18n modules, the stampers, `manifest.webmanifest` | Two stamped releases on one origin, both booted offline. |
| `explain-i18n.yml` | PRs touching `explain.html`, `primer.html`, their i18n modules | Tier-two coverage, and that the explainer still quotes real source constants. |
| `pages.yml` | Push to `main`, or manual with `promote: <version>` | Publishes all three Pages environments. Only ever runs from `main` — see ARCHITECTURE.md for why that is load-bearing. |
| `release.yml` | Manual only | Bumps the tag on the tip of `main`, publishes a Release, deploys to QA over SFTP, dispatches Pages. |
| `purge-session-links.yml` | PR opened/edited | Fixes session links out of PR bodies and titles; gates commit messages. |

Force a whole run on a PR with the `full-battery` label or `[full battery]` in
the title.

**The `paths-ignore` list is a claim, not a convenience**: every entry on it
asserts the battery cannot *see* that file, and the harness itself walks
`index.html`'s module graph and fails if an ignored path is on it.
`tools/**`, `.github/workflows/**`, `dev_server.py`, `src/aesthetics.json` and
`vendor/*.js` are deliberately absent from the list even though four of them
look ignorable. Changing the list is its own PR.

## Branches, commits, PRs

- **Branch for the work; do not commit to `main`.**
- **Commit messages explain *why* the number changed**, not just that it did —
  the reasoning is the artifact. Keep the subject line short enough to survive
  a git UI and put the argument in the body.
- **Never put a session link in a commit message or PR body.** A
  `Co-Authored-By: Claude` trailer is welcome; the session URL and the
  `Claude-Session:` trailer are not, because this history is public. Both
  halves are enforced rather than merely asked for.
- **PRs follow `.github/pull_request_template.md`**, which GitHub prefills. It
  is a layout, not a checklist to satisfy. Three things people get wrong:
  - A section answered "none" is worth more than one quietly deleted. "No new
    waivers" is a claim someone can check; a missing Debt section is not.
  - Paste the instrument lines *with their numbers*, and say **where** the
    battery ran. CI and local are different evidence — CI runs the
    ubuntu-latest / SwiftShader path nothing else exercises.
  - No PR body can skip the battery; only the trigger can. If the path filter
    took the job out, name the invariant that makes your change unable to move
    the built scene.

## Recording what landed

- `docs/BUILT.md` is the public record — one `§N` section per shipped change.
  **`§` numbers are permanent IDs**; source comments cite them. Never reuse or
  renumber one. A new entry takes `max(§ anywhere) + 1`.
- `TODO.md` is the mechanical-honesty ledger. Reconcile the entry with what was
  actually built rather than only marking it closed; a plan left describing an
  abandoned approach is worse than no plan.
- `explain.html` is maintained, not generated: when a significant mechanism
  ships or changes, add or update its entry. `tools/explain-quotes.mjs` gates
  the page's promise that its numbers are the real constants.
- `BACKLOG.md` must never be committed here. Shipped roadmap entries move from
  the private repo into `docs/BUILT.md`.

## Recipes

### Adding a part

1. Build it in `src/geometry.js` — lying in XY, centred at the origin, rotating
   about local +Z, `userData.r` set where a pitch or functional radius means
   something. **Cap every face**, including ones buried inside a joint: an open
   body makes the parity raycast count odd and reports contact with parts
   nowhere near it.
2. Derive its dimensions in `src/layout.js` if they can be computed from
   literals and other values in that file alone. The moment a value needs a
   measured bounding box or a solved position, it stays in `main.js`.
3. Assemble it in `src/main.js` and `registerLabel()` it. **`inspect.js` couples
   by string** — every graph, pair and budget entry must match that name
   verbatim.
4. Declare it in `MECH_GRAPH`: what supports it, what drives it.
5. If it reciprocates, ship the restoring element *and* an axis in `AXES` that
   exercises it — the `restoring` audit's population comes from the sweep
   registry, so a part no axis moves is a part it cannot judge.
6. Run the battery. Expect `stockFloor`, `slenderness`, `intraUnit` and
   `clearances` to have opinions.

### Adding a check

Write it, export it, **and register it in the `CHECKS` table** in
`src/inspect.js`. Twice a check was written and exported but never registered,
and the symptom was the worst kind — a clean battery that had simply not run
the instrument. Then add its row to `BATTERY` in `tools/battery-checks.mjs`
with the gate it enforces, and a `COSTS` row in `tools/ci-battery.mjs` (a stale
cost costs wall clock, never a verdict). If its outer loop is
`for (const axis of AXES)`, declare `slices` so it can be scheduled per axis.

### Adding or changing UI text

Author in English. Tier one (`src/i18n.js`) is keyed by the English source, so
editing the English invalidates its translations *on purpose* — that block
renders English until someone retranslates, which beats a stale paragraph
confidently describing changed prose. Never retype a key by hand; extract it:
`node tools/explain-i18n.mjs --extract`, and `--check` for coverage.

Numbers: tier one localizes them via `fmtNum`. The explainer does **not**
(it quotes source identifiers); the primer does (it reads quantities aloud).
The checker enforces the difference.

### Adding a page

It must be added to `tools/payload.sh` if it should ship, **and stamped in the
same change** — `test-geometry.html` shipped unstamped for sixty sections and
was the one page in a release whose URLs could go stale. A new page also needs
`scene.environment` if it renders metal: materials sit at `metalness ≈ 1` and
render black without a PMREM studio.

### Bumping `vendor/`

Run `node tools/check-bvh-patches.mjs` and do not trust a single clearance
number until it passes. `vendor/three-mesh-bvh.module.js` carries three local
patches, documented in `vendor/README.md`; one of them fixes a shared-temp bug
that made an identical query return 0.1066 cold and 0.4110 warm.

## Code style

There is no linter or formatter in the repo yet, so match the surrounding file:
two-space indent, semicolons, single quotes, `const` by default. The house style
that matters more than any of that is the comment convention — comments say
*why*, cite the `§` or `TODO` item that made the decision, and carry the
measured numbers that justify it. A diff that changes a constant without
changing its constraint comment will be asked about.

Before reaching for a magic number, check whether `src/layout.js` already
derives it.
