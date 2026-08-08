#!/bin/sh
# §88 — THE DEPLOYED PAYLOAD, DEFINED ONCE.
#
#   sh tools/payload.sh <ref> <destdir>
#
# Extracts the tracked files at <ref> that belong on a served site, into
# <destdir>. Both deploys call this and neither carries its own copy of the
# list: release.yml (SFTP to QA) and pages.yml (the three GitHub Pages
# environments) therefore serve the same bytes by construction rather than by
# two pathspecs someone remembers to keep in step.
#
# WHAT IS CUT, AND WHY EACH. The rule is "the app, its vendored dependencies,
# and the licences" — everything else is repository, not site:
#
#   .github .claude tools     CI and dev tooling; tools/ additionally must not
#                             ship because the app is dependency-free and its
#                             own build tooling is nobody's download
#   *.md                      README, CLAUDE.md, TODO.md, SPEC.md,
#                             AESTHETICS.md, docs/ — repo documentation. It
#                             describes the project to people working ON it,
#                             which is not what a deployed site is for.
#   .githooks .gitignore      clone-time tooling, meaningless over HTTP
#   dev_server.py             inert when served statically
#   test-geometry.html        a per-part visual smoke test. It was already a
#                             passenger rather than cargo: stamp-release.mjs
#                             never versioned it and sw.js never precached it,
#                             so it shipped with unversioned URLs and no
#                             offline support. Run it from a checkout.
#
# WHAT SURVIVES, DELIBERATELY. LICENSE and vendor/LICENSE-*.txt are
# extensionless and .txt, so the *.md rule misses them — but that is a
# coincidence, and a site shipping vendored three.js must carry its licences,
# so both deploys ASSERT their presence rather than trusting this comment.
#
# WHY PATHSPECS AND NOT .gitattributes export-ignore. export-ignore is the
# native mechanism and would need no arguments at all — but git reads it from
# the tree BEING ARCHIVED, and pages.yml archives old release tags. A tag cut
# before this file existed carries no such attributes, so its payload would
# silently stay wide. Pathspecs come from the caller, which is the checkout,
# which is main — the same reasoning that put the stamper there.
set -eu

ref=${1:?usage: payload.sh <ref> <destdir>}
dest=${2:?usage: payload.sh <ref> <destdir>}

mkdir -p "$dest"
git archive --format=tar "$ref" -- . \
  ':(exclude).github' \
  ':(exclude).claude' \
  ':(exclude)tools' \
  ':(exclude)*.md' \
  ':(exclude).githooks' \
  ':(exclude).gitignore' \
  ':(exclude)dev_server.py' \
  ':(exclude)test-geometry.html' \
  | tar -x -C "$dest"
