<!--
A LAYOUT, not a checklist to satisfy. The repo's commit-message rule — explain
why the number changed, not just that it did, because the reasoning is the
artifact — is this template's rule too, one level up.

Delete a section that genuinely does not apply. A section kept and answered
"none" is worth more than one quietly deleted: "no new waivers" is a claim
someone can check.
-->

## What this changes, and why

<!--
The CONSTRAINT each new or moved number derives from (standing rule 1) — not
what it was changed to, which the diff already says. If a number moved because
it looked right, it is a bug in waiting and this section will not write.
-->

## Instruments

<!--
Paste the lines, with their numbers. `node tools/ci-battery.mjs` locally or
CI's summary; the focused checks while iterating do not replace it.

The PASS/FAIL column is not the whole answer for a performance change. A gate
reports only whether its failure list is empty, so a report that MOVED while
staying empty passes every gate and is still a regression — `--report FILE`
and diff it against the base. §80 and §81 were both accepted that way.
-->

- Battery — `N/M gates pass`:
- `--report` diffed against the base (only if this change could move a report):

### Where the battery ran

<!--
CI and local are DIFFERENT EVIDENCE, so say which you have. Same harness, but
CI is the merge gate, and since §200 it may run on a self-hosted host — the
job summary's first line names the runner that took it; say which. A fork PR
always runs the ubuntu-latest / SwiftShader path nothing else exercises. A
local run is pre-flight — and, on a PR the filter below caught, it is the only
battery evidence that exists.

Tick both if both. Neither is a claim too, and an honest one.
-->

- [ ] **CI** — this PR's Battery job
- [ ] **Locally** — `node tools/ci-battery.mjs` (say on what, roughly)
- [ ] **Not run** — why, and what was run instead

<!--
Two things a local run does NOT license.

  · Its TIMINGS are not CI's, in either direction. battery.yml measured a 1.66×
    spread between two CI runs on the SAME tree, and offline.yml's header
    records the dev container being an order of magnitude slower than CI on a
    job whose premise said the opposite. Never re-derive the `cost` column, the
    job cap or the per-check guard from one run, local or not.
  · Green focused checks are not a green battery — CLAUDE.md says so, and this
    is the failure mode: an automated pane throttles the sweeps' own yields, so
    a focused check driven by tooling without the sweep hold reports poses the
    rAF loop moved underneath it. Rows appear that the harness does not see.
-->

### Battery: did it run in CI, and should it have?

<!--
THERE IS NO BOX HERE THAT SKIPS THE RUN, on purpose. `.githooks/commit-msg`
enforces the session-link rule rather than asking, and `offline.yml` filters by
path rather than trusting a note, both for the reason §88 wrote down: a
convention loses that argument every time. A PR body cannot skip a job — only
`battery.yml`'s trigger can — so this section records an OUTCOME, not a choice.

Tick whichever is true:
-->

- [ ] **It ran.** Line pasted above.
- [ ] **`battery.yml` filtered it out**, and that is right — the invariant that
      makes this change unable to move the built scene is: <!-- e.g. "explain.html
      and primer.html are sim-code-free (CLAUDE.md), so a page landing cannot
      touch the battery" / "docs only" --> <!-- and if you ran it locally anyway,
      that is the only battery evidence on this PR: paste the line above. -->
- [ ] **It ran and I believe it should not have.** Say which path class is
      battery-irrelevant and what makes that true. That is a change to
      `battery.yml`'s filter, in its own PR — not a skip taken here.

<!--
Three traps, if you are extending that filter:

  · `paths-ignore` skips only when EVERY changed file matches, so an unknown
    path still runs the job. That is the safe direction; keep it.
  · `AESTHETICS.md` is documentation and `src/aesthetics.json` is the build.
    The pair looks symmetric and is not. Same for `explain.html` and
    `primer.html` (separate pages) against `index.html`.
  · A GLOB REACHES FURTHER THAN THE FILES YOU MEANT. `src/*i18n*.js` is the
    obvious entry for the two pages' translation tables and it also matches
    `src/i18n.js`, which `src/main.js` imports — one character between a
    correct list and one that skips the battery for every chrome change. The
    battery now checks this itself (it fails if anything the list ignores is on
    `index.html`'s module graph), which is why extending the filter runs the
    job: `.github/workflows/**` is deliberately not ignored.
-->

## Debt

<!--
New waivers only. A waiver is accepted debt citing a TODO item WITH A FIX PATH,
visible in the report — never a pass, and never bought by widening a tolerance
or a budget to green a row.
-->

- New waivers (`stockFloor`, `penetration`, `intraUnit`, `assembly`,
  `expectedContacts`, `alarmHandoffs`, `restoring`), each with the item it
  cites:
- Filed rather than fixed, and why the fix was not in scope:

## Record

<!--
Which of these the change owes, and where it landed. A plan left describing an
abandoned approach is worse than no plan.
-->

- [ ] `TODO.md` — honesty debt this change closed, opened, or re-measured
- [ ] `docs/BUILT.md` — a shipped roadmap entry, reconciled with what was
      actually built and moved over from the private roadmap repo
- [ ] `explain.html` — a mechanism shipped or changed, with its plate numbers
      re-quoted and its open TODO debt stated rather than hidden
- [ ] `primer.html` — the same mechanism in the reader's register, if it has an
      entry there: rounded quantities with units, no source identifiers, and
      the same modelled-vs-simulated honesty the technical page owes
      (both pages: `node tools/explain-quotes.mjs` and
      `node tools/explain-i18n.mjs --check`)
- [ ] Nothing above applies

<!--
No session links. `.githooks/commit-msg` strips them from commit messages and
purge-session-links.yml fixes this body in place, but neither is a reason to
paste one.
-->
