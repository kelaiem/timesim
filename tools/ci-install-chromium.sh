#!/usr/bin/env bash
# Install the pinned Playwright Chromium for a CI job, with its system
# libraries bounded in time. Every workflow that needs a browser calls this one
# script, so the install is written once.
#
# WHY IT EXISTS. `npx playwright install --with-deps chromium` does two things:
# it apt-installs the shared libraries Chromium needs (which actions/cache
# cannot carry, so it runs every time) and it fetches the browser (which the
# cache does carry). On 2026-10-12 the apt half hung with nothing to stop it:
# the runner's Azure Ubuntu mirror stopped answering, apt fell back to
# archive.ubuntu.com, and `apt-get update` sat there until the job's own cap
# killed it — 8m35s on one Explainer run, 11m on main's push run 38263817128,
# both with the browser cache HIT. A healthy install takes 14–15 s.
#
# So the apt half is bounded twice: each request by apt's own timeouts (an
# unanswering mirror gives up and the next one is tried), and each attempt by
# `timeout`, retried, so one stuck connection costs one attempt rather than the
# job. Linux only — it is apt work, and on macOS (§200's self-hosted host)
# --with-deps was measured to download a codec the harness never uses and stall.
#
# AND THE PACKAGES ARE CACHED. Since 2026-10-22 neither hosted image carries the
# font packages install-deps wants (~25 MB on 26.04, the same set on 24.04), and
# the mirror served them at 80-250 kB/s on half of #762's and #766's runs, past
# the 3 x 90 s budget below. With APT_ARCHIVES set, apt downloads into that
# directory instead of /var/cache/apt/archives (which the image's docker-clean
# hook empties after every install), and .github/actions/install-chromium
# restores and saves it with actions/cache, so a run takes from the mirror only
# what no earlier run already fetched.
#
#   tools/ci-install-chromium.sh        (from anywhere; it cd's to tools/)
#   APT_ARCHIVES=~/.cache/apt-archives tools/ci-install-chromium.sh
set -euo pipefail
cd "$(dirname "$0")"

# 90 s per attempt: six times the healthy 14–15 s install, and three attempts
# fit the tightest job that calls this (explain-i18n, 10 min, whose checks
# take ~4.3 min after the install) with a minute to spare.
ATTEMPT_S=90
ATTEMPTS=3

if [ "$(uname -s)" = Linux ]; then
  # Per-request bounds: 20 s to connect or stall, three retries per file.
  #
  # And a lock wait of one attempt's length, because `timeout` cannot reach the
  # apt-get Playwright starts under sudo: a timed-out attempt leaves it running
  # and holding the dpkg lock, and without a wait every retry dies on that lock
  # in a second. Measured on PR #762, the first run on Ubuntu 26.04, where the
  # install needs 9 font packages (21.9 MB) the image lacks and the mirror served
  # them at ~180 kB/s: attempt 1 was killed at 90 s still downloading, and
  # attempts 2 and 3 failed at once on "lock held by process 2555 (apt-get)".
  # Waiting lets the orphan finish, and nothing is killed mid-dpkg.
  printf 'Acquire::Retries "3";\nAcquire::http::Timeout "20";\nAcquire::https::Timeout "20";\nDPkg::Lock::Timeout "%s";\n' "$ATTEMPT_S" \
    | sudo tee /etc/apt/apt.conf.d/99-ci-timeouts >/dev/null
  if [ -n "${APT_ARCHIVES:-}" ]; then
    # partial/ is where apt's _apt sandbox user writes downloads in flight.
    mkdir -p "$APT_ARCHIVES/partial"
    if id _apt >/dev/null 2>&1; then sudo chown _apt "$APT_ARCHIVES/partial"; fi
    printf 'Dir::Cache::Archives "%s";\n' "$APT_ARCHIVES" \
      | sudo tee /etc/apt/apt.conf.d/99-ci-archives >/dev/null
    echo "apt archives: $APT_ARCHIVES ($(find "$APT_ARCHIVES" -maxdepth 1 -name '*.deb' | wc -l) packages restored)"
  fi
  ok=
  for attempt in $(seq 1 "$ATTEMPTS"); do
    if timeout "$ATTEMPT_S" npx playwright install-deps chromium; then ok=1; break; fi
    echo "::warning::Chromium system libraries: attempt $attempt of $ATTEMPTS failed or passed ${ATTEMPT_S}s"
  done
  if [ -z "$ok" ]; then
    echo "::error::Chromium system libraries did not install in $ATTEMPTS attempts of ${ATTEMPT_S}s — an apt mirror is down, not the change under test"
    exit 1
  fi
fi

# The browser itself: a no-op on a cache hit, a download on a miss.
npx playwright install chromium
