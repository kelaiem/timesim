# Adding an in-progress item to the public roadmap

`docs/ROADMAP.md` is the public list of work in progress (§272). The feature
backlog (`BACKLOG.md`, in `kelaiem/timesim-roadmap`) is private and was purged
from this history on purpose, so **publishing an item is a deliberate act per
item, never a mirror**. An item you do not publish stays private.

```
BACKLOG (private) → ROADMAP row (public, in progress) → BUILT section (public, shipped)
                                  └→ Stopped (public, with a reason)
```

## Adding a row

1. **Decide to publish.** Mark the private BACKLOG entry `Public: yes`. This is
   the owner's call and it is outward-facing: once pushed, the text is public
   and may be cached or forked.
2. **Have a claimed number.** The row cites it, and it is what links the row to
   its eventual BUILT section: `node tools/claim-item.mjs --namespace BUILT --title "…"`
   (or the item's TODO number). An item already claimed in the backlog keeps its §.
3. **Open the branch** the work will land from.
4. **Write the row fresh** in the first PR for the work. Do not paste from the
   backlog entry; a public line is a sentence or two on what and why. Leave out
   feasibility and cost estimates, priority, and the dependency map.

   | Item | What | Status | Branch | Since |
   |---|---|---|---|---|
   | §N or TODO N | one public-safe sentence | one milestone phrase | `branch-name` | YYYY-MM-DD |

5. **Update Status at milestones only** (battery clean, awaiting review), not
   as a diary.

## Finishing

- **It ships:** the PR that adds the `docs/BUILT.md` section deletes the row.
  The checker fails if both exist. If more of the same § is genuinely still
  being built (a partial ship), start Status with `Continues`.
- **It stops:** move the row to *Stopped* with a reason and the date. A stale
  "in progress" is the same kind of false claim this repo polices elsewhere.

## What the checker holds, and what it cannot

`node tools/check-roadmap.mjs` (workflow `roadmap.yml`, on PRs touching these
files, on pushes to `main`, and nightly) fails when a row has no claim file, its
§ already has a BUILT section (or its TODO is CLOSED), its branch does not
exist, it is listed twice, or a cell is malformed. A branch with no commit in
`STALE_DAYS` (7, derivation in the script) is **reported on PRs** so an unrelated
PR is not blocked by someone else's row, and **fails the nightly**.

It cannot judge whether your text is safe to publish. A length cap and a short
list of private-roadmap phrases catch pasting an entry wholesale; that is a
tripwire, not a review. `node tools/check-roadmap.mjs --self-test` plants each
defect and fails if the gate misses one.
