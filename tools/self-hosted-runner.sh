#!/usr/bin/env bash
# tools/self-hosted-runner.sh — §200: put a self-hosted BATTERY runner on this host.
#
#   tools/self-hosted-runner.sh install   [--name NAME] [--label LABEL] [--home DIR]
#                                         [--version VER] [--shards K] [--repo OWNER/REPO]
#   tools/self-hosted-runner.sh status    [--home DIR]
#   tools/self-hosted-runner.sh uninstall [--home DIR] [--repo OWNER/REPO]
#
# WHAT `install` DOES, IN ORDER — every step is idempotent, so re-running
# repairs a half-finished host rather than duplicating anything:
#
#   1. Checks the host has what the battery job needs: bash, curl, tar, git,
#      python3 (dev_server.py), node, and a `gh` that is logged in as someone
#      with admin on the repo (registration tokens need it).
#   2. Downloads actions/runner's release tarball for this OS/arch and verifies
#      it against the SHA256 the release notes publish for that exact asset
#      (`<!-- BEGIN SHA osx-arm64 -->…`). A runner executes CI's code on this
#      machine, so its own bytes are checked before anything else is.
#   3. Pre-installs the harness's browser — `npm ci` in tools/ and
#      `npx playwright install chromium` (`--with-deps` on Linux only, where it
#      is apt work) — so battery.yml's own install step finds it present.
#   4. Registers the runner with a one-hour registration token minted through
#      `gh api` and never written to disk, under ONE custom label (default
#      `timesim-battery`). That label is what `vars.BATTERY_RUNS_ON` names.
#   5. Installs it as a service (launchd LaunchAgent on macOS, systemd on
#      Linux — `svc.sh`, which the runner ships) and starts it.
#   6. Optionally writes BATTERY_SHARDS into the runner's `.env`, the file the
#      runner loads into every job's environment: a host's shard count is a
#      MEASURED property of that host (ci-battery.mjs's K=4 revert is why),
#      and this is where it lives — on the host, not in the workflow.
#
# THE ONE THING IT DOES NOT DO is flip the repository variable that routes the
# battery here. It prints the command. Pointing production CI at a machine is a
# decision, and docs/RUNNERS.md says what to check first (lid, power, the
# approval policy for outside contributors).
#
# Runs OUTSIDE the checkout by default (~/actions-runner-timesim): the runner's
# _work directory holds its own clones and must not sit inside this one. On a
# public repo that path is PRINTED in every job log (checkout, the report
# path, any stack trace) — so run this as a user whose home reveals nothing,
# or inside a container; docs/RUNNERS.md "Privacy" says what shows and why.
set -euo pipefail

cmd=${1:-}; shift || true
case "$cmd" in install|status|uninstall) ;; *)
  sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

# NEUTRAL BY DEFAULT, never the hostname: this is a public repository, and the
# runner name is printed in every job's public "Set up job" log. So is the
# MACHINE NAME, which the runner reads from the OS and this script cannot
# change — docs/RUNNERS.md "Privacy" is the list of what the logs show and
# the three ways to keep a machine out of them.
NAME=battery-1
LABEL=timesim-battery
RUNNER_HOME="$HOME/actions-runner-timesim"
VERSION=""
SHARDS=""
REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --name)    NAME=$2; shift 2 ;;
    --label)   LABEL=$2; shift 2 ;;
    --home)    RUNNER_HOME=$2; shift 2 ;;
    --version) VERSION=${2#v}; shift 2 ;;
    --shards)  SHARDS=$2; shift 2 ;;
    --repo)    REPO=$2; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "$0")/.." && pwd)
say()  { printf '§200: %s\n' "$*"; }
die()  { printf '§200: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "needs $1 on PATH$2"; }

# The repo is read off the checkout's origin unless given, so a fork of this
# script registers against the fork and never against upstream by accident.
if [ -z "$REPO" ]; then
  url=$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)
  REPO=$(printf '%s' "$url" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
  [ -n "$REPO" ] || die "cannot read owner/repo from origin; pass --repo"
fi

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64)          ASSET=osx-arm64;   SVC_SUDO="" ;;
  Darwin/x86_64)         ASSET=osx-x64;     SVC_SUDO="" ;;
  Linux/x86_64)          ASSET=linux-x64;   SVC_SUDO=sudo ;;
  Linux/aarch64|Linux/arm64) ASSET=linux-arm64; SVC_SUDO=sudo ;;
  *) die "no actions/runner build for $(uname -s)/$(uname -m)" ;;
esac

status() {
  say "repo $REPO — runners GitHub knows about:"
  gh api "repos/$REPO/actions/runners" \
    --jq '.runners[] | "  \(.name)\t\(.status)\t\(.os)\t[\([.labels[].name] | join(","))]"' || true
  if [ -x "$RUNNER_HOME/svc.sh" ]; then
    say "service on this host ($RUNNER_HOME):"
    (cd "$RUNNER_HOME" && $SVC_SUDO ./svc.sh status) || true
  else
    say "no runner installed under $RUNNER_HOME"
  fi
  say "routing variable: BATTERY_RUNS_ON=$(gh variable get BATTERY_RUNS_ON --repo "$REPO" 2>/dev/null || echo '<unset — battery runs on ubuntu-latest>')"
}

uninstall() {
  [ -d "$RUNNER_HOME" ] || die "nothing installed under $RUNNER_HOME"
  cd "$RUNNER_HOME"
  if [ -x ./svc.sh ]; then
    $SVC_SUDO ./svc.sh stop || true
    $SVC_SUDO ./svc.sh uninstall || true
  fi
  if [ -f .runner ]; then
    tok=$(gh api -X POST "repos/$REPO/actions/runners/remove-token" --jq .token)
    ./config.sh remove --token "$tok"
  fi
  say "unregistered. The directory $RUNNER_HOME is left for you to delete."
  say "if vars.BATTERY_RUNS_ON still names this host's label, unset it:  gh variable delete BATTERY_RUNS_ON --repo $REPO"
}

install() {
  # 1 — host check. Each of these is something battery.yml runs on the host.
  for t in curl tar git python3 node gh shasum; do need "$t" ""; done
  gh auth status >/dev/null 2>&1 || die "gh is not logged in (gh auth login)"
  perm=$(gh api "repos/$REPO" --jq '.permissions.admin' 2>/dev/null || echo false)
  [ "$perm" = true ] || die "the gh account is not an admin on $REPO — registration tokens need that"
  say "host $(uname -s)/$(uname -m) → runner build $ASSET; repo $REPO; name '$NAME'; label '$LABEL'"

  # 2 — the runner itself, checksum-verified against the release notes.
  if [ -z "$VERSION" ]; then
    VERSION=$(gh api repos/actions/runner/releases/latest --jq '.tag_name' | sed 's/^v//')
  fi
  tarball="actions-runner-$ASSET-$VERSION.tar.gz"
  mkdir -p "$RUNNER_HOME"; cd "$RUNNER_HOME"
  if [ -x ./run.sh ] && [ "$(./bin/Runner.Listener --version 2>/dev/null)" = "$VERSION" ]; then
    say "runner $VERSION already unpacked in $RUNNER_HOME"
  else
    want=$(gh api "repos/actions/runner/releases/tags/v$VERSION" --jq '.body' \
      | sed -n "s/.*<!-- BEGIN SHA $ASSET -->\([0-9a-f]\{64\}\)<!-- END SHA $ASSET -->.*/\1/p" | head -1)
    [ -n "$want" ] || die "release v$VERSION publishes no SHA256 for $ASSET; refusing to install an unverifiable runner"
    say "downloading $tarball"
    curl -fsSL -o "$tarball" "https://github.com/actions/runner/releases/download/v$VERSION/$tarball"
    got=$(shasum -a 256 "$tarball" | cut -d' ' -f1)
    [ "$got" = "$want" ] || { rm -f "$tarball"; die "SHA256 mismatch for $tarball: got $got, release says $want"; }
    say "SHA256 verified ($got)"
    tar xzf "$tarball" && rm -f "$tarball"
  fi

  # 3 — the browser the harness pins, in the place the workflow's step looks.
  say "installing the pinned Playwright Chromium (tools/package.json)"
  (cd "$ROOT/tools" && npm ci --no-audit --no-fund >/dev/null \
    && if [ "$(uname -s)" = Linux ]; then npx playwright install --with-deps chromium; else npx playwright install chromium; fi)

  # 4 — register, unless this directory already is. `--replace` lets a
  # re-install of a dead host with the same name take over its slot.
  if [ -f .runner ]; then
    say "already registered as $(sed -n 's/.*"agentName": *"\([^"]*\)".*/\1/p' .runner)"
  else
    tok=$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)
    ./config.sh --unattended --replace \
      --url "https://github.com/$REPO" --token "$tok" \
      --name "$NAME" --labels "$LABEL" --work _work
  fi

  # 6 (before 5, so the first job sees it) — this host's measured shard count.
  if [ -n "$SHARDS" ]; then
    [[ "$SHARDS" =~ ^[1-9][0-9]*$ ]] || die "--shards wants a positive integer"
    grep -v '^BATTERY_SHARDS=' .env 2>/dev/null > .env.new || true
    echo "BATTERY_SHARDS=$SHARDS" >> .env.new && mv .env.new .env
    say "BATTERY_SHARDS=$SHARDS written to $RUNNER_HOME/.env (loaded into every job on this host)"
  fi

  # 5 — the service. macOS: a LaunchAgent for this user (it runs while this
  # user is logged in). Linux: a systemd unit, which is why svc.sh wants root.
  if [ "$(uname -s)" = Darwin ]; then
    ./svc.sh install 2>/dev/null || say "service already installed"
    ./svc.sh start || say "service already running"
  else
    $SVC_SUDO ./svc.sh install "$USER" 2>/dev/null || say "service already installed"
    $SVC_SUDO ./svc.sh start || say "service already running"
  fi

  say "done. GitHub now lists:"
  gh api "repos/$REPO/actions/runners" --jq '.runners[] | "  \(.name)\t\(.status)\t[\([.labels[].name] | join(","))]"'
  cat <<EOF
§200: the battery still runs on ubuntu-latest until the repository variable names this label.
      Read docs/RUNNERS.md ("Before you flip it"), then:

        gh variable set BATTERY_RUNS_ON --repo $REPO --body '$LABEL'

      and back, without touching a workflow file:

        gh variable delete BATTERY_RUNS_ON --repo $REPO
EOF
}

"$cmd"
