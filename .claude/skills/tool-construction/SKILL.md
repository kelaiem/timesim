---
name: tool-construction
description: Build a timesim tool or probe that boots the movement (tools/*.mjs) so it runs fast and measures the build you meant. Covers picking the harness, running boots in parallel (tools/boot-pool.mjs, the measured core-count knee), checking that the spec query took effect, what a probe may leave out, and the macOS run environment. Use when writing or speeding up a tool that boots builds, scans a parameter, or loops over specs. For FINDING an existing instrument and the traps that make one read clean, use the instruments skill first; this one is how to construct one.
---

# Tool construction

The `instruments` skill answers "is there one already, and will mine measure
anything". This one answers "how do I build it so it runs in seconds, not
minutes, and boots the spec I asked for". Read `instruments` first.

## 1. Pick the harness by what the question needs

| question needs | harness | cost |
|---|---|---|
| only `layout.js` / a pure module (`src/*-arrest.js`, `src/technic-*.js`) | plain Node, no browser | milliseconds |
| one booted build, read through `__clock` | `tools/boot-form.mjs` (`bootForm(query, expr)`) | ~14 s a boot on an M2 Max |
| many booted builds (a scan over a key, several arrangements) | `tools/boot-pool.mjs` (`bootMany(queries, expr)`) | ~2.7 s a boot at 8 at once |
| the battery's checks, poses, sweeps | `tools/ci-battery.mjs` flags, or a probe on `virginBoot` (see `probe-75-drum-az.mjs`) | minutes to an hour |

Design a new mechanism as a pure module first (CLAUDE.md's "design in a line"):
its probe is then pure Node, runs in under a second, and every row can carry a
control. Boot only for questions about the FOLDED build.

## 2. Run boots in parallel, up to the performance-core count

Boots are independent, so a loop of boots is wasted wall time. Measured
2026-11-03 on an M2 Max (8 performance + 4 efficiency cores, 32 GB), the lands
preview:

| boots at once | wall | per boot |
|---|---|---|
| 1 | 14.0 s | 14.0 s |
| 4 | 15.9 s | 4.0 s |
| 8 | 21.6 s | 2.7 s |
| 12 | 49.2 s | 4.1 s |
| 16 | 149.6 s | 9.4 s |

Every run read the identical area, so concurrency did not change a result. Past
the performance cores, throughput FALLS. So:

- **Use `bootMany` / `pool` from `tools/boot-pool.mjs`.** Its default
  concurrency is `perfCores()` (macOS reports the core classes; elsewhere it
  takes half the logical CPUs). Results come back in input order.
- **Measure a new machine, never assume.** `node tools/boot-pool.mjs --bench
  1,4,8,12` prints that table for the host it runs on, and says if any two
  boots read differently.
- **One browser per boot, not contexts in one browser.** One browser shares one
  GPU process, and its pages serialise on SwiftShader.
- **Never run two writers of one file at once.** `tools/free-outline.mjs
  --write` rewrites `src/free-outlines.js`; two fits in parallel race and one
  silently wins. Keep writers serial, or give each worker its own tree
  (`BOOT_ROOT` in `boot-form.mjs` serves another checkout). Restore what a tool
  writes in a `finally`, as `probe-75-drum-az.mjs` does.
- **Pure-Node brute force** (a nested parameter scan) is also embarrassingly
  parallel, but nothing here measures `worker_threads` yet. First make the scan
  smaller: solve one dimension in closed form or by bisection instead of a
  grid. §329's coupler scan spent 2 minutes on a grid where a root-find per
  point would do.

Worked example: `tools/probe-329b-site.mjs` takes several specs. Four drum
directions ran in **16.7 s** through the pool. The serial loop it replaced ran
past **400 s**, and one of its boots timed out.

## 3. Prove the boot is the spec you asked for

**A query key the page does not read is ignored, silently, and you get the
default's build.** §329 landing 3b measured `barrel=-140` for a whole probe;
the key is `barrelstep`, so every number described the wrong arrangement and
looked plausible. `bootForm` now returns `unknownKeys` (any key that is not in
`__WATCH_SPEC_KEYS` and not a page parameter), its CLI prints a loud line, and
`probe-329b-site.mjs` skips such a spec. In a new tool:

- check `unknownKeys` and refuse to report a boot that has any;
- copy arrangement queries from a record, never type them. The lands preview is
  `case=free&alarm=0&barrelstep=-140&rsvaz=0&rsvidl=2&frame=lands`
  (`docs/built/0075.md`);
- read back one quantity the key must move (`__clock.drum.azSpec` for
  `drumaz`) and print it beside the result.

## 4. Decide what a probe leaves out, and say why

Leaving a part out of an obstacle scan is a claim that it cannot be in the way.
§329 landing 3b left the fusee cone out as "the lock disc's seat" and so never
saw that the Geneva star's teeth swing to 1.41 from the cone's axis, through
cone metal that reaches 2.5–3.3. The `instruments` skill's rule "the ground is
not an obstacle" has a twin: **a part you expect to touch can still be in the
way somewhere else.** When you exclude a part, report it separately:
its own reach in the band, against the excluded part's envelope over the whole
motion, not only at rest.

And sample surfaces, not vertices (MODELING.md rule 5): `probe-329b-site.mjs`
cuts every triangle with the band's planes and walks the cut, which is the
pattern to copy.

## 5. The run environment on this Mac

- Booting needs `NODE_OPTIONS=--experimental-detect-module
  DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/icu4c/74.2/lib`.
- **BSD `sed -i` takes a suffix argument**: `sed -i 's/a/b/' f` reads the script
  as the suffix and fails, or edits nothing. Edit files with the editor tool or
  a short `python3` script.
- A command over two minutes is moved to the background. Start a long run
  backgrounded on purpose and wait for its notification; don't poll it with
  `sleep`.
- Scratch scripts go in the job's tmp directory, or `tools/_*.mjs` (gitignored),
  never `/tmp`.

## 6. Ship it

- Write the header as the summary someone will grep for (what it answers, not
  which § asked). `node tools/index-instruments.mjs` regenerates
  `tools/INDEX.md`; `--check` fails if you forget.
- Say in the header whether it is ACCEPTANCE (exits non-zero; every row has a
  control that must fail) or a REPORT (prints, judges nothing).
- If it boots several builds, take them as arguments and run them through the
  pool, so the next caller gets the speed for free.
