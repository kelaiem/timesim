# Handover — case openings (TODO 90 / 91 / 92)

**Committed on `feat/case-apertures` only, so it travels with the WIP.** It is
not part of the work — delete it in the commit that finishes the apertures, and
never let it reach a PR into `case-schematic` or `main`.

---

## 0. Starting on a different machine

```bash
git clone git@github.com:kelaiem/timesim.git        # or https://
cd timesim
git switch feat/case-apertures                     # the WIP; PR #296's branch is fix/case-openings

git config core.hooksPath .githooks                 # REQUIRED once per clone (CLAUDE.md):
                                                    #   pre-commit blocks BACKLOG.md
                                                    #   commit-msg strips session links
git config user.email "1231982+kelaiem@users.noreply.github.com"
                                                    # GitHub rejects the personal address

cd tools && npm ci && npx playwright install chromium && cd ..
```

Then `node tools/probe-case-closed.mjs` should print `CLOSED caseMiddle … 0`
in about 40 s. If it does, the toolchain is good.

Nothing else is machine-specific. The preview-server symlink mentioned in §7 is
a local convenience only — every probe and `ci-battery.mjs` spawn their own
correctly-rooted server.

---

## 1. Where things stand

Two branches, one shipped and one half-built.

| branch | state |
|---|---|
| `fix/case-openings` | **pushed**, [PR #296](https://github.com/kelaiem/timesim/pull/296) → `case-schematic`. Done and reviewable. |
| `feat/case-apertures` | **local only**, 1 WIP commit (`0bc8377`) on top of the above. Not pushed, no PR. |

`fix/case-open-bodies` is a dead earlier attempt with an over-wide history
rewrite in it. Nothing needs it — safe to delete.

The base branch `case-schematic` is **21 commits behind `main`** and has its own
open PR #294 → main. #296 deliberately targets `case-schematic`, not main, so
#294 stays the single feature PR.

---

## 2. PR #296 — finished, with one known-wrong line in it

Five commits, 11 files. Four defects in `makeCase`, all the same mistake —
metal described by its surface rather than its volume:

- `caseMiddle` and `caseBack` lathe contours never closed
- the three tubes were `openEnded` cylinders **at the bore radius**, so the
  tube's metal was never modelled at all
- the collars were solid discs the stems ran through
- the "flush" pusher was built proud, its collar inside the §43 head

Plus two that only became visible once those cleared: the head's standoff
(`stemOuterS` subtracted `hypot(_pushBase)` where the constraint wants its
projection on the push axis — equal only for a radial pusher), and the bore
drilled 1.66 mm beside the pusher because `tubeAt` treated an azimuth as
locating a radius.

**Battery: 32/35 on CI, 31/34 locally** (different gate counts; CI's run has one
more). Same three failures, same numbers both places:

```
gate FAIL  intraUnit: 0 unwaived        ← PRE-EXISTING on this base, not ours
gate FAIL  inspection: 0 FORBIDDEN      ← 84 contacting pairs; 4 pairs → 3
gate FAIL  sweptOverlap: 0 CONFIRMED    ← same pairs
```

`intraUnit`'s row (`Alarm switch` FF, `CylinderGeometry#9 ⇄ alarmPusherCap`) is
byte-identical to the row on untouched `case-schematic`. main already fixes it
(§162 names the stem so the selector matches), so it clears when the base
catches up. Against the same base the branch takes the battery 30/34 → 31/34.

### ⚠ One thing in #296 is known wrong and should be fixed before it merges

`TODO.md` item 90 contains a paragraph saying the **pusher does not need a band
aperture** — added in commit `13b0073` ("The pose net says two of the four pairs
were narrowed, not cleared"). That was written on the strength of a CLEAR
verdict from `meshClearance`, which turned out to be an artifact of the band
profile touching itself (see §4 below). **The pusher stem does cross the band**
— measured r 32.87–51.25 against `R_IN` 45.56 / `R_OUT` 48.20. Revert that
paragraph; the original claim was right.

---

## 3. `feat/case-apertures` — what works

The sector-lathe construction is real and functioning:

- `sectorLathe(pts, a0, a1, capPolys)` in `geometry.js` — partial revolution
  plus **both end caps**, triangulated from the profile polygon.
- `caseMiddle` is built as sectors: `whole` / `relieved` / `bored`, merged into
  one `BufferGeometry` by a local `mergeGeos` (no BufferGeometryUtils is
  vendored; §81's `weldTree` indexes it at boot).
- `CASE_SECTORS` in `main.js` **derives** the openings: it scans the movement
  for anything standing in the seat's own annulus, clusters the azimuths into
  arcs, and unions the stem bore windows in.

Verified: `caseMiddle` **closes** (0 boundary edges, 3360 verts), **boot is
silent**, seat bearing retained is **91.4%**, and

- `Case ⇄ Keyless works` — **no mesh-level contact** (was FORBIDDEN at every pose)
- `Alarm crown ⇄ Case` — **no mesh-level contact** (same)

Those two were the bulk of 90 and 91.

---

## 4. Two findings worth keeping regardless

**The seat step's outline was authored in the wrong rotational sense.** It went
`zSeatBot` before `zSeatTop` while the contour descends, so the profile doubled
back and touched itself at `(R_IN, zSeatTop)`. A lathe never asks whether its
polyline is a simple polygon, so it rendered correctly for as long as it was
only ever revolved. earcut asks: it returned 15 triangles where 17 were needed
and holed every cap around that step. Fixed on the WIP branch — the bore
narrows to `R_SH` below the plate's face and opens to `R_IN` above it.

**That malformed outline was corrupting the parity test inside the band.** This
is why the pusher stem read CLEAR when the geometry plainly said it crossed the
band, and why item 90 got edited to say the pusher needed nothing. With the
outline corrected the contact reports normally. Treat any "surprisingly clear"
verdict near the band on the old profile as suspect.

---

## 5. `feat/case-apertures` — what is still wrong

Dump the sector list (temporarily `console.warn` `out` at the end of
`CASE_SECTORS`) and it shows all three at once:

```
r107.0..109.0  w109.0..127.6  r127.6..140.7  b140.7..149.3  r149.3..149.5
w149.5..249.0  r249.0..251.0  w251.0..355.5  r355.5..355.7
b355.7..364.3  b361.4..367.4  r367.4..371.0  w371.0..467.0
```

1. **Overlapping bore windows.** `b355.7..364.3` (alarm) and `b361.4..367.4`
   (pusher) share 2.9°, so two bored pieces are stacked there. Windows must be
   merged *before* sectors are emitted, not after.
2. **`hackRodPin` gets no relief.** It crosses the seat at ~165.5°
   (r 39.89–40.79, z −5.10..1.42) and sits inside `w149.5..249.0`. The scan now
   walks triangle **edges** rather than vertices — which is why a pin crossing
   the band can be seen at all — but it still is not finding this one. Debug
   the edge/band intersection for that mesh specifically.
3. **Sliver arcs.** 2°-wide reliefs at 108° and 250° are single-point hits, not
   openings. Relief arcs want a minimum width or they are noise.
4. **The pusher's window is a plain azimuth range.** Its line is a **chord**, so
   it meets the wall obliquely: the crossing azimuth is `ALARM_PUSH_AZ +
   asin(off/R)` — **5.50°** at `R_IN`, **5.20°** at `R_OUT`, with
   `off = 4.370 u`. The window should span both, not be centred on one.

Current residual fouls at beat f=0: `caseMiddle ⇄ hackRodPin` and
`caseMiddle ⇄ alarmPusherStem`.

---

## 6. Numbers already measured — don't re-derive

| quantity | value |
|---|---|
| `plateR` | 42.923 |
| `R_SH` (seat inner) | 40.284 = `plateR − 1 mm` |
| `R_IN` | 45.562 = `plateR + CASE_CLEAR` |
| `R_OUT` | 48.2007 |
| seat band z | −4.112 .. −2.000 |
| seat relief arcs (measured) | keyless 128.4°–147.6°, alarm 358.0°–2.1° |
| crown bore half-angle | ±4.32° at `R_IN` |
| pusher chord offset | 4.370 u (1.66 mm) |
| `ALARM_PUSH_TRAVEL` | 2.686 u (one ratchet tooth) |
| bearing retained after relief | 91.4% |

The winding crown (az 145.0°) falls **inside** the keyless relief arc and the
alarm crown (−0.1°) inside the alarm arc — so 90 and 91 genuinely are one cut.

---

## 7. Environment notes

- **`git push` over SSH is broken.** The agent lists the key but cannot sign
  (`communication with agent failed`). Workaround that works:
  `git -c credential.helper='!gh auth git-credential' push https://github.com/kelaiem/timesim.git <branch>`
- **Author email** is set repo-locally to `1231982+kelaiem@users.noreply.github.com`
  (in `/Users/willmon/Documents/dev/timesim/.git/config`, shared by all
  worktrees). Global is untouched. GitHub rejects the personal address.
- **Battery is ~8.5 min at `BATTERY_SHARDS=6`** on this M2 Max, vs ~16 at the
  default 3. Verified equivalent: K=3 vs K=6 differ only in telemetry (census
  counters/timings, plus `meshIntegrity.subBodies.pairs.*` which is TODO 81's
  known shard-schedule dependence). **No verdict moves.** Do not change the
  default — CI measured K=4 *losing* on its 4-vCPU runner.
- **`dev_server.py` accept backlog** was raised to 128 (from socketserver's
  default 5) on `fix/case-openings`. That was capping shard count *and* causing
  four runs of spec-boot flakiness — those DEAD points were connection resets,
  not timeouts.
- **The preview server is mis-rooted in this worktree.** `preview_start` pins
  cwd to the session launch dir, so CLAUDE.md's documented
  `/.claude/worktrees/<name>/index.html` 404s. There is a symlink
  `trusting-khayyam-66e751/wt-case-schematic → case-schematic` making
  `http://localhost:8347/wt-case-schematic/index.html` work. All probes and
  `ci-battery.mjs` spawn their own correctly-rooted server, so measurements
  were never affected.

---

## 8. Probes available (all committed on `fix/case-openings`)

| probe | answers |
|---|---|
| `probe-case-closed.mjs` | boundary edges per Case body — 0 on a solid. Prints edge locations when open. **~40 s, use this first on any geometry change.** |
| `probe-boot-warns.mjs` | what boot says (rule 6), without the battery |
| `probe-90-fouls.mjs` | per-mesh Case ⇄ unit contacts at beat f=0 |
| `probe-90-extent.mjs` | cylindrical extents of whatever is touching |
| `probe-91-relief.mjs` | which parts stand in the seat band, and their arcs |
| `probe-92-standoff.mjs` | pusher head clearance across the press |
| `probe-92-pose.mjs` | the two pose-specific fouls |
| `probe-93-plate.mjs` | Case ⇄ three-quarter plate |

Run from the worktree root (`node tools/probe-*.mjs`); they need
`tools/node_modules` (`npm ci` in `tools/`) and a Playwright Chromium.

---

## 9. Suggested order on resume

1. **Fix the TODO 90 pusher paragraph on `fix/case-openings`** and push. That is
   a known-wrong claim sitting in an open PR; it is independent of everything else.
2. Decide #296's fate — merge into `case-schematic`, or rebase it onto a
   main-merged base first (which would also clear the `intraUnit` failure).
3. On `feat/case-apertures`, rework the region algebra as one pass: merge
   windows before emitting, give arcs a minimum width, make the bore window
   offset-aware. Verify with `probe-case-closed` after every change.
4. Then chase `hackRodPin` specifically.
5. Full battery at `BATTERY_SHARDS=6`, and `--report` diffed against
   `fix/case-openings` as the base.

### A caveat that bit twice

Vertex sampling misses surfaces. A cylinder's vertices sit on its end caps, so
a pin crossing a band carries no vertex inside it, and a lathe's surface exists
between profile points where there are no vertices at all. Both cost real time
tonight. Test **surfaces**, not vertex sets — and when a probe disagrees with
plain geometric reasoning about the band, suspect the probe.
