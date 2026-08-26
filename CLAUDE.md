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
| `.github/pull_request_template.md` | The PR body's layout. Read before opening one — see Conventions. |

`test-geometry.html` is a per-part visual smoke test, separate from the
inspector.

`explain.html` is the mechanism explainer (§65, plates for every
mechanism as of §67), styled as the HUD. §95 made the PRIMER the HUD's
front door, so the explainer is one click further — from the primer's
header, not from the panel. When a
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
page-colored silhouettes of the base, three-quarter and dial plates):
`collectUnits` in `inspect.js` prunes anything flagged
`userData.schematic` wherever it is parented, so flagged display never
joins the sweeps — the same trust the fingerprint extends. Flag every
schematic object directly; an unflagged child of a flagged parent is
NOT protected.

Two §78 rules govern what the tier is allowed to SAY. **A generic glyph
is a claim, so a part may opt out of one**: the opt-out is the named set
`OWN_GLYPH`, consulted through `SCHEMATIC.ownGlyph` by both the rotor
pass (which would call the part a wheel) and the §48 blade pass (which
would call it a leaf spring). Three words so far — `userData.spiral =
{ innerR, outerR, coils }` (a wound ribbon), `userData.profile =
{ poly, hubR, boreR }` (§83 — a wheel whose content is its cut outline,
the escape wheel's club teeth), `userData.crown` (§83 — a knurled knob a
hand turns). Each member is drawn by its own pass instead, which is the
pattern to follow when the generic vocabulary would state something
false: overdrawing leaves the wrong glyph in place underneath, so the
generic pass must SKIP. A morphing part draws its current frame, not its
plan — `spiralFrames` + `writeSpiralLine` is how both the mainspring and
(since §83) the hairspring ride their own wind. **And x-ray means one
thing in both views**: `setXray` empties `SCHEMATIC.occluderFills`,
which holds exactly the two fills the realistic view glasses (the
three-quarter plate and the dial). The base plate's fills live in
`SCHEMATIC.baseFills` and no toggle reads them — its occlusion is the
line drawing's only partition between the dial-side works and the
train. Both halves are boot-asserted.

The chrome is LOCALIZED (§73 tier one, §116 — English, German, French,
Japanese, and Chinese in both scripts):
`src/i18n.js` holds one table keyed by the English source string, so the
app keeps authoring its UI in English and `t()` / `localizeTree()`
resolve at the display site; a missing entry falls back to English
VISIBLY. The roster is ONE declaration — `LOCALES` in `src/i18n.js`, which the
three pickers render, `_norm` resolves through and `LANG_TAG` reads. **Its array
order is the resolution ladder and it is boot-asserted**, because a script
subtag has to be tested before the bare language it refines: get `zh-Hant`
below `zh` and a Taiwanese reader silently gets Simplified, with nothing
thrown and nothing blank. Two rules when touching UI text. **State is an attribute, never
the text**: toggles carry `data-state="on|off"` (`setBtnState`), §72's
`aria-pressed` observer watches that attribute, and no code may compare
button text to `'On'`. **Display translates, values do not**: option
`value`, `data-cam`, unit and group names in `MECH_GRAPH`, persisted
state and deep-link params stay canonical English — `t()` only ever
reaches `textContent`, `title`, `placeholder` and `aria-label`. Numbers
go through `fmtNum`/`fmtInt` at the display layer only (German reads
`30,0 h` and `18.000 A/h`, French `18 000 A/h` with a NARROW NO-BREAK SPACE;
the stored value keeps its `.`). Locale is
reload-tier (§22's precedent), so there is exactly one path that builds
a localized panel. **The static pages are localized too** (§73 tier two,
§95 tier two): `src/page-i18n.js` is the ENGINE — the walk and the swap, one
copy — and each page adds a dozen-line module naming its own tables
(`src/explain-i18n.js`, `src/primer-i18n.js`), one per locale, keyed by the
English source. Rich blocks are keyed by their normalized `innerHTML`, so a
sentence's inline markup travels with it. EDITING THE ENGLISH INVALIDATES ITS
TRANSLATION BY DESIGN: the key stops matching and that block renders English
until re-translated, which beats a stale paragraph confidently describing
changed prose. Never retype a key —
`node tools/explain-i18n.mjs --extract --page <name>` regenerates them from the
DOM. **The tool takes its locale roster from the page module's own
`allTables()` keys**, so adding a locale is one entry in that module's
`LOADERS` map and the harness cannot fall behind it; `MARKS` beside it is a
per-locale FACT (which characters that locale groups and points with), and a
missing row is a hard failure rather than a skipped check. `--check` is the gate and with no `--page` it checks EVERY page (0
unmatched keys, 0 markup/`<code>`/id drift, 0 number drift, and no label
overrunning its plate against the English baseline). **A translated header must
not wrap**: both bars are `position: fixed` above a constant body padding, so a
second line covers the first paragraph — every item is `nowrap` and the stamp
is the one that yields (ellipsis, then hidden under 820 px). German found it;
§116 re-measured all six locales × both pages × eight widths straddling that
breakpoint and added `tools/probe-116-locale-fit.mjs`, which is also where the
chrome-bar and 150 px HUD-label numbers now come from — none of that is gated,
so it is measured on purpose rather than assumed.

A second instrument, `node tools/explain-quotes.mjs`, answers the
older question `explain.html`'s header promises — do its numbers still match
`src/*.js`? — comparing every quoted constant against the source (literals
and expressions it can resolve; the rest reported, never silently passed).
The same instrument holds `primer.html` to the OPPOSITE promise: zero source
identifiers, scanned as a reader sees the page (markup and text whole, a
script contributing only its string literals — machinery is not a claim).
Both run in one fast CI workflow, separate from the battery.

**The two pages disagree about numbers on purpose, and each page DECLARES its
rule** (its i18n module's `NUMBERS` export; the checker reads it rather than
assuming). The explainer's numbers stay in SOURCE form in every language —
identifiers being quoted, not quantities being read aloud, which is the one
place tier one's `fmtNum` rule deliberately does not apply. The primer quotes
no identifiers, so its numbers ARE quantities and tier one's rule applies
normally: German reads `0,024 mm` and `18.000`, and the gate compares parsed
VALUES, so the punctuation is free to localize and the quantity is not.

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
   failures, graph clean, `axisEntry` **0 violations** (TODO 54/§127 — every
   ordered pair of pose axes reproduces the entered axis exactly, which is
   what makes a sweep's findings a function of the geometry rather than of
   `AXES`' declaration order, and what lets §127 sweep one axis per browser
   context; the leak tier beside it is a REPORT, not a gate),
   penetration within budgets (waived rows are
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
   item, visible in the report), and `intraUnit` **0 unwaived and 0
   unmatched selectors** (TODO 5/§121 — three tiers inside each unit:
   movers vs fixtures over EVERY unit, fixture pairs and cross-frame
   mover pairs inside `INTRA_TIER_SCOPE`, out-of-scope FF/MM rows
   reported; declared joints live in `INTRA_UNIT_CONTACTS`, a stale
   selector in that table is itself a failure, waived rows cite their
   TODO), and `assembly` **0 undeclared unwaived splits among
   `ASSEMBLY_SCOPE`** (§107 — a rigid group is one connected body;
   out-of-scope rows reported),
   and `expectedContacts` **0 unwaived and 0 unmatched selectors**
   (TODO 6 — per-contact clearance floors across EXPECTED pairs, the
   declared meshes excluded; same waiver convention), and `oscillator`
   **0 failures** (TODO 25 tier two — the hairspring's section is SOLVED
   from the balance's inertia so `√(k/I)` lands on `F_BALANCE`; the gate
   holds that solve true and holds the ribbon inside real hairspring
   stock, 0.02–0.04 mm. Change the spiral's plan — coils, radii, height —
   and re-solve; never re-target the beat to match a spring),
   and `equalisation` **0 failures** (TODO 32, closed whole by §104 — the
   going spring's torque law is DERIVED from its ribbon and the fusee cut
   against it: the set-up must land on an integer set-up-ratchet click,
   the level product springTq·r/K must hold at float noise over the
   reserve, and both mainspring ribbons' published sections must still
   describe the cut metal. The ALARM half is held too since §104: its
   80-click set-up on the arbor ratchet's integer detent, total wind
   under the ribbon's measured 4.25-turn usable ceiling, the governor's
   I_a solve landing the designed gap at the design wind point within
   the oscillator's 0.5% — solve the part, never re-target the beat —
   the poising ring's section inside real ring stock, the hammer's fall
   window at the fastest gap, and the cadence endpoints MEASURED by
   stepping the shipped tick law against the record),
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
   reason),
   and `transfers` **0 malformed, 0 stale, 0 mismatched, 0 unwaived
   envelope misses, control PASS** (§137 — every corner is one of five
   named idioms declared beside its metal with its force arithmetic, in
   TODO 16's format; the check re-verifies each row's own relations from
   the frozen payload and holds envelope membership against layout.js's
   declared windows — the 5–50 mN detent band is a CONSTANT now, never
   forkable. A waived row cites its TODO and a waiver naming a site with
   no envelope miss is itself a failure — the seed waiver, the lay
   shaft's, made a round trip on that rule: retired when §137's span and
   stroke corrections read the chain in-window, then restored citing
   TODO 79 when the shaft's rod-end overhang turned out to be a second
   series compliance an order softer than the tail. **A row whose figure
   an instrument also computes must ASSERT against it, not resemble it**:
   the same site then had its arithmetic corrected a second time — a
   minimum where series compliances ADD, reflected by n²/k — and now
   re-derives TODO 82's sum from live constants with a boot warning if the
   two paths part or a different member governs. Four earlier records of
   that one number were each honest on the inventory they had; the fifth
   had the whole inventory and combined it wrongly, which is the failure
   an assert catches and a careful reader does not),
   and `slenderness` **0 stale waivers** (§54's report, reachable at last —
   its rows stay a REPORT by §54's own covenant and the unwaived residue is
   TODO 78's catalogue; what gates is a `SLENDER_WAIVERS` entry naming a
   unit with no over-ceiling row, so deleting a fix's waiver is
   structurally part of the fix).
5. **Parts near the low corridor consume `LOW_LINKAGE_OBSTACLES`** — the
   single source for that band's swept footprint.
6. **Boot is silent.** Build-time asserts `console.warn` with the achieved
   and required numbers; a warning at boot means something regressed.
7. **A digest is a claim about the metal, so it is anchored like one.** §152's
   per-unit key must reproduce across two virgin boots — gated beside
   `fingerprint`'s — because a digest that drifts turns every skip taken on it
   into an unfounded one. Ship a part whose mesh is rebuilt lazily and it
   belongs on `DIGEST_ALWAYS_CHANGED`, not in a tolerance.

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
cannot see this, so `intraUnit`'s three tiers (§121) hold it at the pose
net inside `INTRA_TIER_SCOPE`, and each group's own build asserts hold it
FINER than the net (the §120 saw⇄pallet cycle sweep, the stop-lever
lattice: the tier covers the class, the asserts keep the tight per-cycle
instances) — and
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

`pages.yml` (§88) publishes to GitHub Pages in three
environments — `development` ← tip of `main`, `testing` ← the newest
release tag, `production` ← the `production` branch, which only that
workflow's `promote: <version>` input moves. **Every pointer is a git
ref**; nothing about which environment serves what lives in Actions
settings. Pages replaces the WHOLE site per deploy, so the workflow
rebuilds all three from their current pointers every run — a partial
deploy does not exist there, and that is why it is shaped that way.
`tools/build-pages.mjs` finishes each tree: it runs the same
`stamp-release.mjs` (the environments are stamped releases, not a
second kind of build — do not fork the stamper) and adds the
environment's own marks.

**The deployed payload is `tools/payload.sh`, and it is the ONLY
definition** — both `release.yml` (SFTP to QA) and `pages.yml` call it,
so the two deploys serve the same bytes by construction rather than by
two pathspec lists someone keeps in step. The rule is "the app,
`vendor/`, and the licences"; everything else is repository, not site —
every `*.md` (including `docs/`), `.githooks`, `.gitignore` and
`dev_server.py` are cut. Add a doc anywhere and it stays unpublished by
default, which is the intended direction. `test-geometry.html` DOES ship,
and §88 made it a third STAMPED document when it decided so — it had been
shipping unstamped since §28, the one page in a release whose URLs could go
stale. Ship a new page and stamp it in the same change.

Both deploys ASSERT both halves, because a pathspec breaks silently and
the symptom — a release quietly carrying the repo's documentation —
looks exactly like a healthy one: no doc may appear in the payload, and
`LICENSE` plus both `vendor/LICENSE-*.txt` must. That second half is not
paranoia: those files survive the `*.md` rule only by being
extensionless and `.txt`, and a build shipping vendored three.js must
carry its licences.

**`pages.yml` only ever runs from `main`, and that is load-bearing.**
Each environment's TREE comes from its own ref via `git archive`, but
that archive excludes `tools/` — so the STAMPER comes from the
checkout. `release.yml` therefore DISPATCHES the workflow on `main`
rather than `pages.yml` carrying a `release:` trigger, which would
check out the tag and make "which stamper built production" depend on
what woke the run. Do not add a `release:` or `push: tags:` trigger
back: besides the ambiguity, no tag predating §88 contains
`build-pages.mjs`, so those refs cannot build these environments at
all. The consequence to know is that the site is a function of the
three refs PLUS main's tooling — editing the stamper moves
production's bytes without production's ref moving, which is why
`offline.yml` gates that file.

**Anything served under a path shares its origin with the other two.**
Cache Storage is partitioned by origin, not path, so `sw.js` names its
cache for its SCOPE as well as its version; a flat name let each
environment's activation evict the others'. `tools/offline-check.mjs`
holds that: it stands up two stamped releases on one origin and boots
both offline. **`offline.yml` now runs it on PRs that touch those files**
(`sw.js`, the two documents, `stamp-release.mjs`, `build-pages.mjs`,
`offline-check.mjs`) — separate from the battery, which runs the source
tree and so deliberately has no worker at all. Run it by hand when
iterating; the paths filter keeps it off every other PR.

## Inspecting

Verify with `src/inspect.js`, not by eye:

```js
const I = await import('./src/inspect.js');   // worktree: /.claude/worktrees/<name>/src/inspect.js
I.start(__clock, 'inspection', { includeExcluded: true });  // poll I.status()
I.start(__clock, 'support');                                // 0 failures
I.start(__clock, 'clearances');                             // 0 violations
```

CI runs this whole bar on every PR that could move it (§52):
`.github/workflows/battery.yml` drives `tools/ci-battery.mjs` — headless
Chromium, plus boot-silence and a fingerprint-determinism double-boot.
`node tools/ci-battery.mjs` runs the same gate locally (needs `npm ci` in
`tools/` and a Playwright Chromium). It enforces rule 4; it does not replace
the focused checks below while iterating.

**"That could move it" is a `paths-ignore` list, and every entry on it claims
the battery cannot SEE that file** — markdown, the two static pages and their
i18n modules, `test-geometry.html`, `sw.js`, repository furniture. The list
never has to be complete, only true: `paths-ignore` skips only when EVERY
changed file matches, so an unclassified path still runs the job. Deliberately
absent, because four of them look ignorable: `tools/**` (changing the harness
is the change that most needs the harness), `.github/workflows/**`,
`dev_server.py`, `src/aesthetics.json` (the BUILD — `AESTHETICS.md` beside it
is documentation and IS ignored; the pair looks symmetric and is not) and
`vendor/*.js`. **The battery now holds that list true itself**: it walks
`index.html`'s transitive module graph and fails if anything the list ignores
is on it, and fails equally if it could not read the list — an empty list
intersects nothing and would otherwise pass for that reason alone. The near
miss it exists for is one character wide: `src/*i18n*.js` is the obvious glob
for the pages' tables and it also matches `src/i18n.js`, which `main.js`
imports. The check lives in the harness because editing the list touches
`.github/workflows/**`, which the list does not ignore — so the change that
could break it always runs the job that judges it.

Since §81 the harness SHARDS: it partitions the work across K browser
contexts by the measured `cost` column in `BATTERY` (`--shards`, default 2)
so the wall is max(shard) rather than sum(checks). That is sound because
`start()` calls `clock.resetInputs()` before every check, so no check can
observe which ones ran before it — **if a report ever moves between
`--shards 1` and `--shards 2`, the check that moved has broken that
invariant and is the bug.** Two rules follow. Keep the cost column
roughly true (`--report` writes the times back out as `ms`); a stale
number costs wall clock, never a verdict. And when a check gets much
faster or slower, re-read the partition before concluding anything about
the battery's wall.

**Since §127 the atom is a TASK, not a check** — a check whose outer loop is
`for (const axis of AXES)` declares `slices` and is scheduled as one task per
axis, so the wall is no longer floored by the slowest single check.
`inspection`, `clearances` and `expectedContacts` are split today (the two
extrema sweeps since §127 tier 2a landed alongside §152: their merge is a
per-row MINIMUM that keeps the winning slice's row verbatim, first axis
winning a tie — not `inspection`'s union — and what made them sliceable at
all is that the sweep engine's refinement decision now reads a per-axis
minimum rather than the cross-axis one, TODO 54's rule applied to the
engine's last cross-axis coupling; the query bound stays cumulative because
pruning is sound). `--no-split` runs each whole and is the reference
the split must agree with, exactly as `--shards 1` is for the grouping. Three
things hold it up, and all three are gates rather than conventions: the
declared slice list is asserted to BE the page's `AXES` (an axis nobody sliced
would silently never be swept), every slice must produce a payload before the
merge runs (a dead shard would otherwise union into a clean report of work
that did not happen), and the merged payload is byte-identical to a whole
run's — `tools/probe-127-split.mjs` proves that on two axes in about a minute,
which is the loop to use while iterating.

**And since §127 tier 3 the harness can ASSEMBLE ACROSS PROCESSES.**
`--matrix i/N --tasks-out FILE` runs the browser half for the shards worker `i`
owns and writes what it measured, evaluating no gates and writing no report;
`--collect FILE…` runs the assembly half over those files — the same gates in
the same order, `--report`, and no browser at all. Nothing coordinates them:
`buildTasks` and `partition` are pure functions of in-repo data, so every
worker and the collector derive the identical partition independently, which
is what lets the collector NAME work that never arrived. The failure to keep
refusing is a healthy-looking smaller run, and it is refused three ways —
`every expected shard was collected` (a new gate that exists only under
`--collect`; in one process the shard list IS what ran, so the reference run's
gate count is unchanged), six THROWS for files that are not one run (wrong
format version, disagreeing shape, shards a worker was not owed, a shard or
task key arriving twice, workers restricted to different unit sets, a baseline
on one side of the seam only), and worker 0 alone carrying the indivisible
anchors — fingerprint A, boot B with the digest pair, the two rosters, and
(until Landing C) the spec-boot tier. **The single-process path is the
reference and must stay untouched**, exactly as `--shards 1` and `--no-split`
are, and the assembly half is CALLED by both paths rather than copied — a
second gate loop would be two definitions of standing rule 4.
`tools/probe-127-matrix.mjs` proves the three identities in ~11 min via
`--only`, a probe flag CI never passes (its key space is every declared check
and every slice a check declares — read from `BATTERY`, since a projected slice
has no `COSTS` row — and it throws on anything else). No workflow uses any of this yet: the matrix itself
is Landing B, to be sized on CI rather than on a dev container.

**What makes slicing legal at all is TODO 54's canonical axis entry.** A slice
runs in its own browser context and starts from `resetInputs()`, so it can only
match a whole run if entering an axis reproduces that axis's poses whatever ran
before it. `setPose` assigns ONLY the keys a pose names, so before TODO 54 each
axis inherited the tail of the axis declared above it and every sweep's
coverage was a function of `AXES`' order. Every sweep now calls `enterAxis`
before each axis; the `axisEntry` check gates that over all 182 ordered pairs
and REPORTS, beside it, what used to ride through.

**Since §152 a PR run can be INCREMENTAL, and the rule is that a check runs
only when it can change its answer.** A sweep's verdict is
`f(geometry, pose net, check code)`. `unitDigests()` measures the first per
unit — SHAPE over the position/index bytes, PLACE over the per-mesh world
matrices, both at `digestPoses()`: a set DERIVED from `AXES` (every axis at
f ∈ {0, 0.5, 1}, unioned with the 12 canonical poses for the combined states,
43 total) rather than borrowed from the fingerprint — measured, the borrowed
set left 61% of moving (unit, axis) pairs blind to a pose-law change, and
`tools/probe-152-pose-coverage.mjs` demonstrates the miss and the catch. Four
units install a different geometry at a different pose, which is why every
pose is walked. The pose net and the check code ride
file digests (`AXES` lives in `inspect.js`), and **any difference in
`src/inspect.js`, `tools/battery-checks.mjs`, `tools/battery-split.mjs` or
`tools/battery-union.mjs` runs the whole battery** — the four files that
produce or reshape inheritable rows; `tools/ci-battery.mjs` is deliberately
absent because everything left in it (spec points, gates, the partition, the
`COSTS` map) runs fresh every run and cannot stale a stored row. Measured,
the check-code rule voids 56% of merges, so the incremental path is
available on ~37% of them. The changed set narrows four sweeps through one
`pairsTouching` opt that **throws on a unit name it does not know**
(`resolveAxes`' precedent — a typo that matched nothing would report a green
battery of no work), and the restricted payload is **UNIONED** with the
baseline's rows before any gate reads it, so the bar is still the whole
movement's. `Chain` is unconditionally in the changed set: its mesh is
re-tessellated lazily and is path-dependent, which is why `fingerprint`
excludes it by name.

**The baseline is the push-to-`main` run, which already existed.** That
trigger is deliberately unfiltered and never incremental — a baseline must be
a whole verdict or errors would chain through the cache — so every merged tree
still gets a full battery, and `battery.yml` now keeps its `--report` and
digests under the commit SHA for the next PR to read. **That is also why there
is no nightly**: §152 was scoped with one as mandatory, and building it
established that the push run bounds a key error to minutes rather than a day
and fires per merge rather than per date. Every uncertainty — no cache hit, an
unreadable file, a moved check-code digest, a union that cannot be justified —
resolves towards MORE work and says so in the log. `--no-incremental` is the
reference an incremental run must agree with, and `tools/probe-152-restrict.mjs`
proves on two cheap axes that a restricted run unions back to a full one byte
for byte.

`--report FILE` writes every check's FULL payload as JSON. **That, not the
PASS/FAIL column, is what a performance change is accepted against**: a
gate reports only whether its failure list is empty, so a report that
moved while staying empty passes every gate and is still a regression.
§80 and §81 were both landed by diffing one of these before and after.

Use `start()`/`status()`, never `await` the sweep directly — full runs take
100 s+ and blow a browser-eval timeout. Do **not** pass
`yieldEvery: Infinity` to work around it: that removes the cooperative
yields and wedges the tab. Driving the browser through tooling changes the
arithmetic entirely — see the yield-throttling trap below before starting a
sweep that way.

### Finding the instrument before writing one

`tools/` holds 119 measuring scripts and this file names 14. The rest are named for the
SECTION that produced them — `probe-106-stud.mjs` records WHEN a question was
asked, not WHAT it answers — so the one you need is usually there and
unfindable. That is a correctness problem, not a tidiness one: §173 rebuilt
`probe-106-stud`'s free-disc stud scan from scratch, twice, and got it wrong
both times; the probe it never found warns about one of those exact errors in
its own header.

**`tools/INDEX.md` is the catalogue and it is GENERATED** — every summary is
that file's own leading comment, so it is the author's words and a probe with
no header shows up as silent rather than as described by someone who did not
write it. `node tools/index-instruments.mjs` writes it; `--check` fails if it
is stale and rides the Explainer workflow (fast, browser-free, about a
document). Grep it by **what you want to know**, never by section number — the
vocabulary drifts, so `stud` / `post` / `anchor` / `pillar` are the same part
in four sections.

The index also carries the split that decides how to read a result: **45 of
them are ACCEPTANCE tests** that exit non-zero, and **74 are REPORTS** that
print and leave the judgement to you. A report saying `0 violations` has not
passed anything.

**`.claude/skills/instruments/SKILL.md` is the method** — how to search, which
kind to write, and the catalogue of ways an instrument comes back CLEAN while
measuring nothing (missing controls, the ground counted as an obstacle, a ray
cast from inside a solid, vertices mistaken for the surface,
`intersectsGeometry`'s asymmetry, tangency read as intersection, a rotated
bounding box). Read it before writing a probe; every entry cost this repo real
time at least once.

### Two blind spots, now partially instrumented

Both are written up in `TODO.md` (items 5 and 6), and both produced
real defects that every clean run missed. Each now has an instrument in
the battery — with known residue:

- **Inside a unit.** The pair sweep cannot see it; `intraUnit` (TODO 5,
  §121) checks all three derived pair classes over the pose net: each
  unit's movers against its own fixtures, fixture pairs (once — fixtures
  cannot move relative to their unit), and mover pairs ACROSS rigid
  frames (same-frame movers are one part, `assembly`'s connectivity
  domain). A MORPH COUNTS AS MOTION twice over — the mover signature
  carries `geometry.id`, and a morph is always its OWN frame in the MM
  clustering, or two matrix-still morphs would merge and drop out of
  comparison; see MODELING.md rule 6 before shipping another one.
  Residue, named: the FF/MM tiers GATE only `INTRA_TIER_SCOPE` (the
  alarm complex — 42 rows triaged against measured depths); everywhere
  else their rows are REPORTED (202 at §121, visible in the payload,
  untriaged), and same-frame mover splits outside `ASSEMBLY_SCOPE` are
  §107's own reported residue. Transients between pose samples stay
  item 7's.
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
  **Disarmed at the source by §81**: every mesh now reaches the scene
  INDEXED (`weldTree` runs once at the end of boot; `weldAssert` warns if
  one does not), so `bvhFor` gets a real index rather than bolting on an
  identity one. The defensive `bvhFor(src)` calls stay — the trap is
  disarmed, not the discipline, and a builder that ships after the pass
  can still re-arm it. See MODELING.md rule 7 before adding one.
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

**PRs are written to `.github/pull_request_template.md`**, which GitHub
prefills into the body. It is a LAYOUT, not a checklist to satisfy: the
commit-message rule one level up, so "What this changes, and why" wants the
CONSTRAINT each new or moved number derives from (rule 1), not what it was
changed to — the diff already says that. Four things about it that are easy
to get wrong, all of them written in the template's own comments:

- **A section answered "none" is worth more than one quietly deleted.** "No
  new waivers" is a claim someone can check; a missing Debt section is not.
  Delete only what genuinely does not apply.
- **Paste the instrument lines with their numbers**, and say WHERE the battery
  ran — CI and local are different evidence, and CI runs the
  ubuntu-latest/SwiftShader path nothing else exercises. For anything that
  could move a report, `--report` diffed against the base is the acceptance,
  not the PASS/FAIL column (see Inspecting).
- **No box skips the battery.** A PR body cannot skip a job — only
  `battery.yml`'s trigger can — so that section records an OUTCOME. If the
  path filter took the job out, name the invariant that makes the change
  unable to move the built scene; if you think it ran and should not have,
  that is a change to the filter in its own PR, not a skip taken here.
- **The Record section is this file's reconciliation rule as a checkbox**:
  `TODO.md`, `docs/BUILT.md`, `explain.html` — whichever the change owes.

Keep the template and this file in step. It cites standing rule 1, rule 4's
instruments and the session-link rule below; edit one of those and the
template is the second place to look.

**Never put a session link in a commit message or PR body.** No
`Claude-Session:` trailer and no `claude.ai/code/session…` URL — anywhere in
this repo's history or pull requests. A `Co-Authored-By: Claude` trailer is
fine and welcome; the session link is not, because it leaks a private
session identifier into public history. This holds regardless of any default
tooling behaviour that would otherwise append it.

**This one is enforced, not just asked for**, because the tooling appends it
by default and a convention loses that argument every time.
`.githooks/commit-msg` PURGES both patterns from commit messages — it strips
rather than rejects, so nobody is trained to reach for `--no-verify` (which
would skip the `BACKLOG.md` guard next door), and it reports on stderr what
it took out. `Co-Authored-By: Claude` is untouched. A hook cannot reach a PR
body — that text is composed on GitHub after every hook has run — so
`.github/workflows/purge-session-links.yml` covers the other half: it FIXES
the body and title in place, and separately GATES commit messages, failing
with the offending SHAs. Fix-vs-gate splits on who can act: CI may rewrite a
PR body, and must never rewrite history behind a contributor.

When a `BACKLOG.md` entry lands, reconcile the entry with what was actually
built rather than only marking it BUILT — then move the whole section from
the private roadmap repo into `docs/BUILT.md` here, which is the public
record; a plan left describing an abandoned approach is worse than no plan.

**§ numbers and `TODO.md` item numbers are permanent IDs, and they are
CLAIMED, not counted.** Never reuse or renumber them: source comments cite
shipped sections as `BUILT §N` (`src/main.js`, `src/state.js`,
`src/inspect.js`), `TODO.md` cross-references items by number, and commit
messages cite both — so a duplicate silently breaks every one of those
references.

The old rule was `max(§ in the roadmap repo, § in docs/BUILT.md) + 1`, and
**it cannot work with more than one branch open**: each branch reads the same
max, neither can see the other's claim, and nothing detects the collision
until long after both are written. That is not hypothetical — `main` merged a
column-wheel audit as TODO 90 while `fix/case-openings` carried a band-bore
item also numbered 90, filed a day earlier; and two branches were on §173 at
once. Both sides followed the rule correctly.

Allocate with the tool instead, which reads every ref it can see rather than
the one you have checked out:

```bash
node tools/claim-item.mjs --namespace TODO --title "What it actually does"
```

It writes `docs/item-numbers/<NS>-NNNN.md` — one file per number, so two
branches claiming the same number create the same PATH and git reports an
add/add conflict, while different numbers merge silently. That file is the
reservation; the item's content still lives in `TODO.md` / `docs/BUILT.md`.
`tools/check-item-numbers.mjs` gates it in `item-numbers.yml` (the hook only
warns — see `docs/item-numbers/README.md` for why, and for the residue the
scheme does not cover).

`BACKLOG.md` must never be committed here — `.gitignore` excludes it and
`.githooks/pre-commit` hard-fails on it. Enable the hook once per clone:
`git config core.hooksPath .githooks`.
