---
name: instruments
description: Find, choose, and write measuring instruments (tools/*.mjs probes) for the timesim watch movement. Use BEFORE writing a new probe — the repo has 119 and names them by the section that produced them, so the one you need is usually already there and unfindable. Also use when a probe comes back clean and you need to know whether it measured anything, or when a measurement disagrees with what you can see.
---

# Instruments

`tools/` holds 119 measuring scripts. `CLAUDE.md` names 14. The rest are named for the
SECTION that produced them — `probe-106-stud.mjs` records WHEN a question was
asked, not WHAT it answers — so you find one only if you already know which §
went looking.

**That is not a tidiness problem, it is a correctness problem.** §173 rebuilt
`probe-106-stud`'s free-disc stud scan from scratch, twice, and got it wrong
both times. The probe it never found warns about one of those exact errors in
its own header. `git log` says `probe-106-stud.mjs` has one commit: written,
used once, never found again.

## 1. Search before you write

```
node tools/index-instruments.mjs        # regenerate tools/INDEX.md
grep -i 'stud\|seat\|anchor' tools/INDEX.md
```

`tools/INDEX.md` is GENERATED from each file's own leading comment, so the
summaries are the authors' words and a probe with no header shows up as
silent rather than as described by someone who did not write it. Grep it by
**what you want to know**, never by section number.

Name the near-misses out loud before writing anything. "Nothing matched" after
one grep for one word is not a search — the vocabulary drifts (`stud` / `post`
/ `anchor` / `pillar` are all the same part in different sections).

If you do write a new one, say in its header which existing probe it is NOT,
and why. That is what makes the next search work.

## 2. Pick the kind deliberately

- **ACCEPTANCE** (45 of them) — decides, prints PASS/FAIL, exits non-zero.
  Write one when there is a claim to hold true from now on.
- **REPORT** (74) — prints and leaves the judgement to a reader. Write one when
  you are still finding out what is true.

Choosing the wrong kind is how a measurement gets mistaken for a verdict. A
report that says `0 violations` has not passed anything.

## 3. The traps that make an instrument report CLEAN

This is the whole point of the skill. Every one of these produced a confident
wrong answer in this repository, and clean is the dangerous direction.

**Controls, always both.** A must-hit pair and a must-miss pair, asserted, in
every probe that tests a predicate. `probe-90-click` called a helper
`inspect.js` does not export, got `null` at every pose, and announced
"0 intersections" having tested nothing. A must-hit control catches that in
one line — and pick a pair that genuinely overlaps: a bore on a stud is a
RUNNING FIT and does not intersect, which is how the first control here was
itself wrong.

**The ground is not an obstacle.** A stud is MEANT to touch the plate it
stands on, so its foot measures 0 to it by design. §173's fold scan left the
plates in and ranked the candidate positions over the plate's CUTAWAY as the
roomiest — nothing was under them at all. Exclude what the part is supposed to
touch, and ask the seating question separately (`inCutClearance`).

**A ray that starts inside a solid is front-face culled.** §173's first
seating test started just under the stud's foot — i.e. inside the plate — so
the only faces it could have hit were back faces, and it reported the plate
ABSENT under two control studs as well. Cast from outside, or set
`material.side = DoubleSide` for the cast. *A test whose controls fail the same
way as its subject has not tested anything.*

**Vertices are not the surface.** A `CylinderGeometry` rod carries vertices at
its two end rings and none between, so a rod that CROSSES a band has no vertex
in it and contributes nothing. MODELING.md rule 5; it cost the alarm cluster
six separate findings. Sample the surface, or take every vertex of any mesh
whose bbox spans the band.

**`intersectsGeometry` is not symmetric.** With no triangles crossing it falls
back to a CONTAINMENT test, which a small BVH owner holding a large other
answers wrongly: shank-as-owner said the shank met the skirt, skirt-as-owner
said it did not, and an axis measurement said 0.5756 clear. Run both
directions, require agreement, and settle disagreements by measuring — never
by whichever call you made first.

**Tangency is not intersection.** A working contact is DESIGNED to measure
zero, and triangle tests flap either side of it. Measure the gap (distance
minus radius) instead, and let the sign carry the answer.

**A bounding box inflates under rotation.** The AABB of a 0.7029-wide blade
standing at 217° reads 5.4815. Read `geometry.parameters` for a built section;
use boxes only to PRUNE, never to conclude.

**An OPEN mesh reads as colliding.** `meshClearance` guards BVH near-zeros
with a parity raycast, which assumes a closed solid. Four missing caps made
`sweptOverlap` CONFIRM a pair 3.7 units apart (TODO 27).

**`support` is declared per UNIT.** One floating mesh inside an otherwise
seated unit passes the whole battery in silence. It did.

**A z-datum named after a plate is a HEIGHT, not a seat.** `TQ_TOP_Z` puts a
foot at the plate's top face; whether there is any plate at that (x, y) is a
different question and needs `inCutClearance`.

**rAF and `setTimeout` throttle to ~1 fps under automation.** Timed loops
inside one browser eval measure nothing. Use `step()`, or sample across
separate tool calls. See CLAUDE.md's own trap list for the sweep-yield cliff.

## 4. Choose against every constraint at once

A search that satisfies constraints one at a time will find a position that is
perfect from inside the constraint it was chosen against and wrong from
outside it. §173 did this twice in a row — once against the free-azimuth
window (anchor over a cutaway), once against the plate (anchor inside the
hammer's swing).

**Print the whole table, not the winner.** A search whose losers are invisible
is a claim nobody can re-check.

## 5. Afterwards

Keep it if it holds a claim someone will want re-checked; delete it if it was
scratch — `tools/_*.mjs` is gitignored so an over-broad `git add tools/` cannot
commit one for you, which is how `_b.mjs` and `_boot.mjs` got in (and how
`_boot.mjs` got in a SECOND time, after §163 deleted it naming that cause).
Regenerate `tools/INDEX.md` in the same commit —
`node tools/index-instruments.mjs --check` fails if you forget.
