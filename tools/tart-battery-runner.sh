#!/usr/bin/env bash
# tools/tart-battery-runner.sh — §200: the battery runner as a THROWAWAY LINUX VM
# per job, on Apple Virtualization via Tart.
#
#   tools/tart-battery-runner.sh build              build the golden image (idempotent; --rebuild to redo)
#   tools/tart-battery-runner.sh once               one cycle: clone → boot → one job → delete
#   tools/tart-battery-runner.sh loop               `once` forever; touch $STATE/stop to exit between jobs
#   tools/tart-battery-runner.sh install-service    a LaunchAgent that runs `loop` (--keep-awake: caffeinate)
#   tools/tart-battery-runner.sh uninstall-service
#   tools/tart-battery-runner.sh status
#
#   options: --cpu N (6)  --memory MB (8192)  --shards K  --repo OWNER/REPO  --rebuild  --keep-awake
#            --max-wait SECONDS   (`once` only: give up waiting for a job — a bounded test cycle)
#
# WHY A VM PER JOB, on a public repository (docs/RUNNERS.md has the long form):
#   · PRIVACY — every job log is public, and a self-hosted runner prints the
#     machine's hostname, the working directory and the platform into it. Here
#     all three belong to the guest: hostname `battery-1`, user `runner`,
#     paths under /home/runner, platform Linux/ARM64.
#   · ISOLATION — GitHub's guidance for reused hardware is a just-in-time
#     runner in a clean environment. Each cycle clones the golden image (an
#     APFS copy-on-write clone, instant), mints a one-job JIT configuration
#     through `gh api` (never stored, never in the image), runs the runner
#     until it has done exactly one job, then deletes the clone.
#   · NOTHING ENTERS THE GUEST BUT THAT CONFIG. No SSH key, no password, no
#     token: commands reach the guest through `tart exec`, the guest agent the
#     Cirrus images ship, with stdin attached.
#
# WHAT THE GOLDEN IMAGE HOLDS (the `build` step, once): Ubuntu 24.04 ARM64,
# the `runner` user with passwordless sudo (battery.yml's --with-deps step
# apt-installs, exactly as on ubuntu-latest), Node 22 verified against
# nodejs.org's SHASUMS256, the actions/runner tarball verified against the
# SHA256 its release notes embed (refused if absent), the runner's own
# dependency script, and the pinned Playwright Chromium with its apt deps —
# so the workflow's install steps find everything present. Registered to
# nothing. BATTERY_SHARDS goes into the runner's .env if --shards is given:
# a host's shard count is a MEASURED property of that host (ci-battery.mjs's
# K=4 revert), and this VM is the host.
#
# WHAT IT DELIBERATELY DOES NOT DO: set `vars.BATTERY_RUNS_ON`. It prints the
# command. Pointing the merge gate at a machine is the owner's decision.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cmd=${1:-}; shift || true
case "$cmd" in build|once|loop|install-service|uninstall-service|status) ;; *)
  sed -n '2,42p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

IMAGE=ghcr.io/cirruslabs/ubuntu:24.04
BASE=timesim-battery-base
GUEST_HOST=battery-1
LABEL=timesim-battery
CPU=6; MEMORY=8192; SHARDS=""; REPO=""; REBUILD=0; KEEP_AWAKE=${KEEP_AWAKE:-0}; MAX_WAIT=""; VM_PID=""; JOB_PID=
STATE="$HOME/.timesim-tart"; mkdir -p "$STATE"
SERVICE=com.timesim.tart-battery
PLIST="$HOME/Library/LaunchAgents/$SERVICE.plist"
while [ $# -gt 0 ]; do
  case "$1" in
    --cpu) CPU=$2; shift 2 ;;  --memory) MEMORY=$2; shift 2 ;;
    --shards) SHARDS=$2; shift 2 ;;  --repo) REPO=$2; shift 2 ;;
    --rebuild) REBUILD=1; shift ;;  --keep-awake) KEEP_AWAKE=1; shift ;;
    --max-wait) MAX_WAIT=$2; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "$0")/.." && pwd)
log() { printf '%s §200 tart: %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "needs $1 on PATH"; }
if [ -z "$REPO" ]; then
  REPO=$(git -C "$ROOT" remote get-url origin 2>/dev/null | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
  [ -n "$REPO" ] || die "cannot read owner/repo from origin; pass --repo"
fi
have_vm() { tart list --quiet 2>/dev/null | grep -qx "$1"; }

# Boots a VM detached and waits until the guest agent answers. Prints nothing;
# the caller owns the `tart run` pid in $VM_PID.
boot() {
  tart run "$1" --no-graphics >"$STATE/$1.run.log" 2>&1 &
  VM_PID=$!
  local i
  for i in $(seq 1 90); do
    [ -n "$(tart ip "$1" 2>/dev/null || true)" ] && break; sleep 2
    kill -0 "$VM_PID" 2>/dev/null || die "tart run $1 exited early — see $STATE/$1.run.log"
  done
  for i in $(seq 1 60); do
    tart exec "$1" true >/dev/null 2>&1 && return 0; sleep 2
  done
  die "guest agent in $1 never answered (is this a Cirrus image with tart-guest-agent?)"
}
# Graceful stop, then delete. Never fails: teardown must not abort a loop.
teardown() {
  local vm=$1
  tart stop "$vm" --timeout 30 >/dev/null 2>&1 || true
  [ -n "${VM_PID:-}" ] && { wait "$VM_PID" 2>/dev/null || true; }
  tart delete "$vm" >/dev/null 2>&1 || true
  rm -f "$STATE/$vm.run.log"
}
# A runner record left at GitHub by a cycle that never ran its job. Its
# process is dead by the time this runs, but GitHub reports it `online` for
# ~20 s more (measured), so the record is removed by NAME whatever its status,
# with a short retry for the window in which the API still refuses.
forget_runner() {
  local id i
  for i in 1 2 3 4 5 6; do
    id=$(gh api "repos/$REPO/actions/runners" --jq ".runners[] | select(.name==\"$1\") | .id" 2>/dev/null | head -1)
    [ -n "$id" ] || return 0
    if gh api -X DELETE "repos/$REPO/actions/runners/$id" >/dev/null 2>&1; then
      log "removed runner record '$1' (#$id)"; return 0
    fi
    sleep 10
  done
  log "could not remove runner record '$1' (#$id); it will read offline in the runner list" >&2
}
# Clones from a previous crash: anything named like a job VM that is not ours.
sweep_stale() {
  local vm
  for vm in $(tart list --quiet 2>/dev/null | grep -E '^timesim-battery-[0-9]+$' || true); do
    log "sweeping stale job VM $vm"; VM_PID=""; teardown "$vm"
  done
}

build() {
  for t in tart gh curl git tar; do need "$t"; done
  gh auth status >/dev/null 2>&1 || die "gh is not logged in"
  [ "$(gh api "repos/$REPO" --jq '.permissions.admin')" = true ] || die "the gh account is not an admin on $REPO"
  if [ "$REBUILD" = 1 ] && have_vm "$BASE"; then log "deleting $BASE for --rebuild"; tart delete "$BASE"; fi
  if have_vm "$BASE"; then log "$BASE exists — nothing to build (use --rebuild)"; return 0; fi

  # Everything the guest will verify is fetched HERE, where gh is, and handed
  # in as environment: the guest never talks to GitHub's API.
  local rver rsha nver nsha
  rver=$(gh api repos/actions/runner/releases/latest --jq '.tag_name' | sed 's/^v//')
  rsha=$(gh api "repos/actions/runner/releases/tags/v$rver" --jq '.body' \
    | sed -n 's/.*<!-- BEGIN SHA linux-arm64 -->\([0-9a-f]\{64\}\)<!-- END SHA linux-arm64 -->.*/\1/p' | head -1)
  [ -n "$rsha" ] || die "actions/runner v$rver publishes no SHA256 for linux-arm64; refusing"
  nver=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c '
import sys,json
print(next(r["version"][1:] for r in json.load(sys.stdin) if r["version"].startswith("v22.")))')
  nsha=$(curl -fsSL "https://nodejs.org/dist/v$nver/SHASUMS256.txt" | awk -v f="node-v$nver-linux-arm64.tar.xz" '$2==f{print $1}')
  [ -n "$nsha" ] || die "nodejs.org publishes no SHA256 for node-v$nver-linux-arm64"
  log "runner v$rver ($rsha), node v$nver ($nsha), image $IMAGE, $CPU cpu / $MEMORY MB"

  tart clone "$IMAGE" "$BASE"
  tart set "$BASE" --cpu "$CPU" --memory "$MEMORY"
  VM_PID=""; boot "$BASE"
  log "guest up; provisioning"
  # The harness's pin travels in: package.json + lock decide the browser build.
  tar -C "$ROOT/tools" -cf - package.json package-lock.json \
    | tart exec -i "$BASE" sudo sh -c 'mkdir -p /opt/timesim-tools && tar -xf - -C /opt/timesim-tools'
  tart exec -i "$BASE" sudo env \
      RUNNER_VER="$rver" RUNNER_SHA="$rsha" NODE_VER="$nver" NODE_SHA="$nsha" \
      GUEST_HOST="$GUEST_HOST" SHARDS="$SHARDS" bash -s <<'GUEST'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
hostnamectl set-hostname "$GUEST_HOST" 2>/dev/null || echo "$GUEST_HOST" > /etc/hostname
if command -v cloud-init >/dev/null; then
  mkdir -p /etc/cloud/cloud.cfg.d; echo 'preserve_hostname: true' > /etc/cloud/cloud.cfg.d/99-timesim.cfg
fi
id runner >/dev/null 2>&1 || useradd -m -s /bin/bash runner
echo 'runner ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/runner; chmod 440 /etc/sudoers.d/runner
apt-get update -q
apt-get install -y -q curl git python3 ca-certificates xz-utils jq
# Node 22, verified.
cd /tmp && curl -fsSL -o node.tar.xz "https://nodejs.org/dist/v$NODE_VER/node-v$NODE_VER-linux-arm64.tar.xz"
echo "$NODE_SHA  node.tar.xz" | sha256sum -c -
tar -xJf node.tar.xz -C /usr/local --strip-components=1 && rm node.tar.xz
# The runner, verified, unregistered.
sudo -u runner -H bash -euo pipefail -c '
  mkdir -p ~/actions-runner && cd ~/actions-runner
  curl -fsSL -o r.tgz "https://github.com/actions/runner/releases/download/v'"$RUNNER_VER"'/actions-runner-linux-arm64-'"$RUNNER_VER"'.tar.gz"
  echo "'"$RUNNER_SHA"'  r.tgz" | sha256sum -c -
  tar xzf r.tgz && rm r.tgz'
/home/runner/actions-runner/bin/installdependencies.sh
[ -n "$SHARDS" ] && echo "BATTERY_SHARDS=$SHARDS" > /home/runner/actions-runner/.env
# Everything under the runner's directory must be the runner's: its first
# start writes _diag/, and a root-owned _diag/ makes .NET abort (exit 134)
# with no message the job log keeps — the first cycle ever run died of it.
chown -R runner:runner /home/runner/actions-runner
# The pinned browser, and its apt deps, where battery.yml's own step will look.
chown -R runner /opt/timesim-tools
sudo -u runner -H bash -euo pipefail -c 'cd /opt/timesim-tools && npm ci --no-audit --no-fund >/dev/null && npx playwright install-deps chromium && npx playwright install chromium'
apt-get clean; rm -rf /var/lib/apt/lists/*
# The version read AS runner, so the _diag/ it creates is runner's too.
echo "provisioned: $(hostname) node $(node --version) runner $(sudo -u runner -H /home/runner/actions-runner/bin/Runner.Listener --version) chromium $(ls /home/runner/.cache/ms-playwright)"
test "$(stat -c %U /home/runner/actions-runner/_diag)" = runner
GUEST
  log "powering the golden image off"
  tart exec "$BASE" sudo poweroff >/dev/null 2>&1 || true
  wait "$VM_PID" 2>/dev/null || true
  log "built $BASE. Try one cycle:  $0 once"
}

once() {
  for t in tart gh; do need "$t"; done
  have_vm "$BASE" || die "no golden image — run: $0 build"
  sweep_stale
  local vm="timesim-battery-$(date +%s)" name jit rc=0 dog=""
  name="$GUEST_HOST-$(printf '%04x' $((RANDOM % 65536)))"
  # Whatever ends this cycle — the job, a signal, a bounded wait — the clone
  # goes, and so does any runner record GitHub still holds for its name: a
  # JIT runner that never got its job lingers as `offline` otherwise.
  trap 'teardown "$vm"; forget_runner "$name"' RETURN
  trap 'log "signal — tearing $vm down"; [ -n "$JOB_PID" ] && kill "$JOB_PID" 2>/dev/null; teardown "$vm"; forget_runner "$name"; exit 130' INT TERM
  tart clone "$BASE" "$vm"
  VM_PID=""; boot "$vm"
  # A JIT configuration is good for exactly one job and is never written down:
  # it goes from gh's stdout to the guest's stdin and nowhere else.
  jit=$(gh api -X POST "repos/$REPO/actions/runners/generate-jitconfig" \
        -f name="$name" -F runner_group_id=1 -f "labels[]=$LABEL" --jq .encoded_jit_config)
  log "$vm up as runner '$name' [$LABEL]; waiting for one job"
  local wrap=""; [ "$KEEP_AWAKE" = 1 ] && wrap="caffeinate -i"
  printf '%s' "$jit" | $wrap tart exec -i "$vm" sudo -u runner -H bash -c \
    'cd ~/actions-runner && c=$(cat) && exec ./run.sh --jitconfig "$c"' \
    >"$STATE/$vm.job.log" 2>&1 &
  JOB_PID=$!
  # macOS has no coreutils `timeout`; a watchdog subshell does the same job.
  if [ -n "$MAX_WAIT" ]; then ( sleep "$MAX_WAIT"; kill "$JOB_PID" 2>/dev/null ) & dog=$!; fi
  wait "$JOB_PID" || rc=$?
  JOB_PID=""; [ -n "$dog" ] && { kill "$dog" 2>/dev/null; wait "$dog" 2>/dev/null; } || true
  log "runner '$name' exited ($rc); tearing $vm down"
  tail -3 "$STATE/$vm.job.log" | sed 's/^/    /' || true
  rm -f "$STATE/$vm.job.log"
  return 0
}

loop() {
  rm -f "$STATE/stop"
  log "loop started (repo $REPO, label $LABEL, keep-awake=$KEEP_AWAKE); touch $STATE/stop to end it"
  while [ ! -e "$STATE/stop" ]; do
    once || { log "cycle failed; retrying in 60 s"; sleep 60; }
  done
  log "stop file seen; loop ended"
}

install_service() {
  need tart; have_vm "$BASE" || die "build the golden image first: $0 build"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$SERVICE</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>$ROOT/tools/tart-battery-runner.sh</string><string>loop</string>
    <string>--repo</string><string>$REPO</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>KEEP_AWAKE</key><string>$KEEP_AWAKE</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$STATE/loop.log</string>
  <key>StandardErrorPath</key><string>$STATE/loop.log</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)/$SERVICE" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  log "service $SERVICE installed and started (log: $STATE/loop.log)"
  cat <<EOF
§200: the battery still runs on ubuntu-latest until the repository variable names this label.
      Read docs/RUNNERS.md "Before you flip it", then:
        gh variable set BATTERY_RUNS_ON --repo $REPO --body '$LABEL'
      and back:
        gh variable delete BATTERY_RUNS_ON --repo $REPO
EOF
}
uninstall_service() {
  touch "$STATE/stop"
  launchctl bootout "gui/$(id -u)/$SERVICE" >/dev/null 2>&1 || true
  rm -f "$PLIST"; sweep_stale
  log "service removed; golden image $BASE kept (tart delete $BASE to drop it)"
  log "if vars.BATTERY_RUNS_ON still names '$LABEL', unset it:  gh variable delete BATTERY_RUNS_ON --repo $REPO"
}
status() {
  log "VMs:"; tart list 2>/dev/null | sed 's/^/    /'
  log "service:"; launchctl print "gui/$(id -u)/$SERVICE" 2>/dev/null | grep -E 'state|pid' | sed 's/^/    /' || echo "    not installed"
  log "runners GitHub sees for $REPO:"
  gh api "repos/$REPO/actions/runners" --jq '.runners[] | "    \(.name)\t\(.status)\t\(.os)\t[\([.labels[].name]|join(","))]"' 2>/dev/null || true
  log "routing: BATTERY_RUNS_ON=$(gh variable get BATTERY_RUNS_ON --repo "$REPO" 2>/dev/null || echo '<unset — battery runs on ubuntu-latest>')"
}

case "$cmd" in
  install-service) install_service ;;  uninstall-service) uninstall_service ;;
  *) "$cmd" ;;
esac
