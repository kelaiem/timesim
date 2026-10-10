#!/bin/sh
# §152 / §200 / §263 — WHO MAY SEED A BATTERY BASELINE, AND WHAT IS KEPT.
#
#   sh tools/battery-seed.sh may    (env: EVENT REF DEFAULT_BRANCH PLATFORM [REFUSE])
#   sh tools/battery-seed.sh keep   (env: ALREADY PLATFORM)
#
# battery.yml carries the reasoning, above the steps that call this. The rule
# lives here because two jobs now apply it. The single process seeds from its
# own leg, and since §263 a split run seeds from its collector. That file's own
# line is that a seeding rule spelled out twice is one that will disagree with
# itself.
#
# `may` writes `may=true|false` to $GITHUB_OUTPUT and says why in the summary.
# REFUSE, when set, is a reason this run may not seed whatever its event is. The
# collector uses it when the workers' platform is not the one its cache key
# would name.
#
# `keep` copies .battery-out/{report,digests,points}.json into
# .battery-baseline, refusing a restricted report, a missing key, and a
# platform that already has a baseline for this commit.
set -u

say() { echo "$1" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
note() { echo "$1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; echo "$1"; }

case "${1:-}" in
  may)
    may=false; why="a pull request inherits a baseline, it does not write one"
    if [ "$EVENT" = push ]; then
      may=true; why="a push to $REF — this run IS the baseline"
    elif [ "$EVENT" = workflow_dispatch ] && [ "$REF" = "$DEFAULT_BRANCH" ]; then
      may=true; why="a dispatch on the default branch — seeding $PLATFORM"
    elif [ "$EVENT" = schedule ] && [ "$REF" = "$DEFAULT_BRANCH" ]; then
      may=true; why="the nightly on the default branch — seeding $PLATFORM"
    elif [ "$EVENT" = workflow_dispatch ]; then
      why="a dispatch on '$REF', not the default branch — a PR restores by base.sha, so nothing would read it"
    fi
    if [ "$may" = true ] && [ -n "${REFUSE:-}" ]; then
      may=false; why="$REFUSE"
    fi
    echo "may=$may" >> "${GITHUB_OUTPUT:-/dev/null}"
    say "§152: may seed a baseline: $may — $why"
    ;;
  keep)
    if ! node -e "process.exit(JSON.parse(require('fs').readFileSync('.battery-out/report.json')).restrictedTo?1:0)"; then
      note "§152: this report is restricted — refusing to cache it as a baseline"
      exit 1
    fi
    # §263 — a split run's key is written by its collector, so its absence is
    # now a path that exists. A baseline without one is one every later PR
    # reads as "no usable baseline", so it fails here, out loud.
    if [ ! -f .battery-out/digests.json ]; then
      note "§152: this run wrote no digests — refusing to cache a baseline nothing can restrict against"
      exit 1
    fi
    if [ "$ALREADY" = "true" ]; then
      note "§152: $PLATFORM already has a baseline for $GITHUB_SHA — leaving it alone"
      exit 0
    fi
    mkdir -p .battery-baseline
    cp .battery-out/report.json .battery-out/digests.json .battery-baseline/
    # TODO 186 — the points' whole payloads ride the same entry. A run that
    # wrote none (a dead tier) still seeds the default's baseline; the next
    # PR's points then sweep FULL, under the ceiling, and say so.
    if [ -f .battery-out/points.json ]; then
      cp .battery-out/points.json .battery-baseline/
    else
      note "§186: no points file from this run — the next PR's points sweep full"
    fi
    ls -l .battery-baseline | sed 's/^/§152 baseline: /' >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    ;;
  *)
    echo "usage: sh tools/battery-seed.sh may|keep" >&2
    exit 2
    ;;
esac
