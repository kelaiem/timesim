# Claimed item numbers

`TODO.md` items and `docs/BUILT.md` sections (`§n`) are permanent IDs. Source
comments cite `BUILT §N`, `TODO.md` cross-references items by number, and
commit messages cite both — so a number that means two different things
silently breaks every one of those references.

Until now both were allocated by reading `max + 1` off whatever branch you had
checked out. **That rule cannot work with more than one branch open**: each
reads the same max, neither can see the other's claim, and nothing detects the
collision until long after both are written. It happened — `main` merged a
column-wheel audit as TODO 90 (PR #301) while `fix/case-openings` was carrying
a band-bore item also numbered 90, filed a day earlier. Neither side did
anything wrong. The rule did.

## How a number is claimed

One file per number, named `<NAMESPACE>-<number padded to 4>.md`:

```
docs/item-numbers/TODO-0096.md
docs/item-numbers/BUILT-0173.md
```

Claim one with the allocator, which picks the lowest free number and writes the
file for you:

```bash
node tools/claim-item.mjs --namespace TODO --title "What the thing actually does"
```

## Why a directory and not one ledger file

**Because the conflict has to fire exactly when there is a collision, and never
otherwise.**

A single appended ledger conflicts whenever two branches append at the end —
which is every concurrent claim, colliding or not. People would resolve those
conflicts mechanically, dozens of times, and the one that actually mattered
would be rubber-stamped along with the rest. A convention that cries wolf is
worse than none.

With one file per number, two branches claiming the same number create the
**same path**, which git reports as an add/add conflict — an unmissable signal
that means precisely "you two picked the same number". Two branches claiming
different numbers touch different paths and merge silently, as they should.

The claim file is the reservation, not the record: the item's actual content
lives in `TODO.md` or `docs/BUILT.md` as it always has.

## What is checked, and where

`tools/check-item-numbers.mjs`, run by `.github/workflows/item-numbers.yml`:

1. no duplicate `## N.` heading within a document;
2. every heading NOT already on `main` has a claim file — that is the set of
   numbers this branch is inventing, which is the set that can race;
3. a claim file's name agrees with the number and namespace inside it;
4. no number is claimed here that `main` already uses for a **different** item.

Check 4 is the one that catches a collision the merge order hid: if the other
branch merged first, there is no add/add conflict left to find — main simply
has your number, spoken for.

Numbers already on `main` need no claim file. Backfilling ~270 of them would
add noise without preventing anything: `main`'s documents are already the
authority for what is taken, and the checker reads them.

## Enforcement is a gate, and the hook only warns

`.githooks/pre-commit` prints a warning when a new heading has no claim file.
It does **not** reject, deliberately. `.githooks/commit-msg` strips session
links rather than rejecting them for a reason written down in CLAUDE.md — so
nobody is trained to reach for `--no-verify`, which would skip the `BACKLOG.md`
guard next door. A blocking hook here would train exactly that habit, to
protect against something CI can catch just as well a few minutes later.

The gate is CI. The hook is a courtesy that saves you the round trip.
