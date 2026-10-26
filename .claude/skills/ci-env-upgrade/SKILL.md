---
name: ci-env-upgrade
description: Upgrading the CI environment under the battery — a runner image change (ubuntu-latest moving), a Playwright/Chromium bump, or any change that swaps the JS engine the build runs in. Use when a hosted image moves and browser installs break, when bumping Playwright, or when the same source suddenly builds different metal (fingerprint, lineSpec) on a new browser.
---

# Upgrading the CI environment (image, Playwright, Chromium)

Drafted from TODO 265 (#762 → #766/#767 → #772 → #775 → #777 → #780, October
2026): GitHub moved `ubuntu-latest` to 26.04, Playwright 1.56.1 could not
install Chromium there, and the Chromium that could (156) built different
alarm-strike metal from the same source. Two problems arrived as one, and the
work went fastest once they were separated.

## 1. Separate the two upgrades before fixing either

An image move and a browser bump fail differently, and a PR that does both
cannot tell you which one broke what.

- **The image** breaks the INSTALL: `install-deps` refuses the host, apt hangs,
  fonts are missing. It never changes the metal.
- **The browser** changes the BUILD: a new V8 rounds transcendental `Math.*`
  results differently in the last ULP, and any ill-conditioned build step
  amplifies that into a visible change (TODO 265: 2.8e-3 in `lineSpec`, against
  a 1e-6 tolerance).

So: **pin the image first** to unblock `main` (a `TEMPORARY pin (#nnn)` comment
on every site, citing the issue and the exit condition), then **probe the new
browser on the OLD image** in a draft PR. If the probe is red on the pinned
image, the browser is the cause and the image is not.

A battery difference that is bit-identical across two hosts (self-hosted ARM64
and hosted x64 gave the same fingerprint) is a pure function of the JS engine.
Say so in the TODO; it rules out GPU, OS and font explanations in one line.

## 2. Pin every site, and find them again by search, not memory

- `grep -rn "runs-on" .github/workflows` and pin each browser job. A ROUTED job
  (`runs-on: ${{ needs.route.outputs.host }}`) needs the mapping form
  `host == 'ubuntu-latest' && 'ubuntu-24.04' || host`, so self-hosted routing
  still works.
- New jobs written while the pin stands COPY the pin (#776 added a sixth). When
  un-pinning, grep for the pin's comment text, not for the count you remember.
- To un-pin exactly, read what the pin replaced:
  `git log -S"TEMPORARY pin" --reverse -- .github/workflows`, then `git show` the
  first commit. Restore those lines verbatim.

## 3. Make the browser install survive a bad mirror

All of this is already in `tools/ci-install-chromium.sh` and
`.github/actions/install-chromium`. Keep it when touching them.

- Bound each apt attempt with `timeout` and retry. But `timeout` cannot kill the
  `apt-get` that Playwright starts under `sudo`: the orphan keeps the dpkg lock
  and every retry dies on it in a second. `DPkg::Lock::Timeout` equal to one
  attempt's length lets the orphan finish instead.
- Cache the downloaded `.deb` files, not the install: point
  `Dir::Cache::Archives` outside the image's docker-clean hook, restore the
  newest set for this OS/arch/release, and SAVE EVEN WHEN THE INSTALL FAILED, so
  a slow mirror's partial download is not lost.
- Key the cache off `/etc/os-release` read in a shell step. The `env` context in
  a composite action does not hold the runner's `ImageOS`.
- Caches are scoped by ref. A `workflow_dispatch` run cannot restore a PR
  branch's cache. That is not a bug.
- Watchdogs that time a phase must mark per boot, not per phase: offline-check's
  false STUCK came from four boots under one mark on a slower image.

## 4. When the new browser builds different metal: reproduce it locally

The container usually cannot download the new Chromium (`cdn.playwright.dev` is
blocked), so imitate an engine change on the old one.

- **Nudge `Math.*` per input, not uniformly.** Wrap each transcendental in a
  `page.addInitScript` that moves the result by -1, 0 or +1 ULP, chosen by a
  hash of the argument bits and a seed. Multiplying every result by
  (1 + 2⁻⁵²) preserves comparison order and reproduced NOTHING; the per-input
  hash reproduced 156's exact four rows at seed 2.
- Try several seeds: a knife-edge flips only for some.
- **Bisect by function** (sin…cbrt → atan/atan2 → atan2), then by CALL SITE.
  Filter on the caller's file and line from `new Error().stack`. This is slow:
  run it in the background. Do not name a variable in the init script the same
  as one in its inner closure (`lo` shadowed `lo` and the boot died with a TDZ
  error).
- Then read what the failing rows MEASURE before reading the build: all four
  failing rows went through one helper (the cam's vertex-mean centre), which
  pointed straight at the outline.
- `pkill -f <pattern>` can match its own shell and kill the command that ran
  it. Kill by PID or by a pattern that cannot match the caller.

## 5. The usual culprit: one point computed twice

TODO 265's step was a SEAM WRITTEN TWICE. Two pieces of an outline each emitted
the same point, equal in algebra but computed two ways (one through `atan2`).
three.js `getPoints()` drops a point only when it EXACTLY equals the previous
one, so the engine's last ULP decided which copies survived as 1e-10 slivers.
Those slivers made degenerate triangles, an uneven per-lobe count, and a
vertex mean that moved 3e-3.

- **Fix by construction**: emit each seam point once, from the piece that owns
  it. Never fix it with a dedupe tolerance.
- **Guard it at boot** with a threshold read off the geometry itself (half the
  finest intended step), never a typed epsilon.
- **Probe it with a control** (`tools/probe-265-ulp.mjs`): the shipped tree
  passes under several seeds, and a `mutantTree` that restores the doubled
  seams FAILS the same rows under the seed that found it.
- **Survey the class** before declaring victory: walk every extruded shape's
  raw curves for consecutive points under 1e-9. TODO 265 found 60 more,
  fingerprint-only. Record that residue in the TODO; do not silently widen the
  PR to fix it.
- A previous browser passing can be LUCK: 141's two survivors sat 180° apart
  and cancelled. Say so in the record.
- Nudging every `Math` function at once also exposes boot asserts that sit on
  a threshold (exact-zero tests, bracketing solves). Record them as residue.

## 6. Land it in order

1. **Fix PR on the old browser.** Its battery proves the fix moves nothing else.
   Compare `meshIntegrity`'s triangle and zero-area counts: they should fall by
   exactly the slivers removed.
2. **Merge the fix into the draft bump probe.** Its battery on the new browser
   proves the fix is enough. Expect point sweeps skipped by the PR ceiling
   ("UNVERIFIED THIS RUN", not clean) and a fingerprint that still differs.
3. **Bump PR**: the version, the lockfile `npm` generated (unchanged), and the
   un-pin. A workflow change runs the battery WHOLE, so this is the full proof
   on the new image. Boot yield's ceilings were measured on the old host. If
   one trips, post the numbers and leave the ceiling to the owner; never widen
   it.
4. **After merge**: `main`'s push run re-seeds the baseline on the new browser.
   Check that it ran whole (`restricted=false`) and seeded.
5. **Close the TODO** in its own file (`docs/todo/NNNN.md`): `— DONE` on its
   heading and a closing paragraph, keeping the residue written in the item.
   The `TODO.md` index is generated from the headings
   (`node tools/item-docs.mjs --write`), so never edit its row by hand.

## 7. CI traps hit along the way

- **No checks at all on a PR usually means a merge conflict.**
  `mergeable_state: dirty` runs no `pull_request` workflows. Merge `main` in
  and regenerate generated files with their tool (`tools/INDEX.md` via
  `index-instruments.mjs`), never by hand.
- **The PR body footer is rewritten with a session link on create.** Update the
  body right after creating it, and re-read it before reporting.
- **`main` moves between your CI run and the merge.** Trial-merge locally
  (`git merge --no-commit --no-ff origin/main`, then abort) and read what the
  new commits touch before merging on an old green.
- **Artifact downloads are blocked by the container's proxy.** Read results
  from job logs (`get_job_logs` with `tail_lines`). The gate summary sits about
  200 to 330 lines from the end, before the post-battery probes.
- **A fast push run is not necessarily a skipped one**: with the spec/points/
  probes jobs fanned out, a whole battery took 9 minutes. Check
  `restricted=false` and the gate count before trusting the speed, and before
  doubting it.
- Never re-run a failed job, push an empty commit, or close and reopen a PR to
  kick CI. Merging and ceiling changes are the owner's call.
