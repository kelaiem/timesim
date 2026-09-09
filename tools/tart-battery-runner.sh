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
#            --max-idle SECONDS   (recycle a runner that has waited this long with no job; 21600)
#            --poll SECONDS       (how often the host checks on a waiting runner; 60)
#            --slot N             (a second, independent loop on the same host; 1)
#
# TWO JOBS ON ONE HOST — `--slot N`. Each slot is its own loop, service, state
# directory, VM name prefix and runner name (`battery-N-…`, and the guest is
# renamed `battery-N` at clone time so the public logs say which), all cloning
# the one golden image. GitHub hands a queued job to whichever slot's runner is
# free, so a second opted-in PR starts at once instead of waiting a run. With
# `once`/`loop`/`install-service`, --cpu and --memory size THAT SLOT'S CLONES
# (`tart set` after the clone, the image untouched): a 10-core / 16 GB host
# carries two slots at 5 vCPU / 6 GB — one job at K=3 averages ~2.5 cores
# (1977 s of checks over 781 s of wall, measured), and 8 GB twice would leave
# the host itself squeezed. Slot 1 keeps the paths it always had.
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
#
# THE FIRST WEEK'S LESSON, which shaped `once` (docs/RUNNERS.md has the trail).
# A waiting runner sat for days, and on 2026-09-05 at 06:29 UTC Ubuntu's own
# unattended-upgrade ran inside the clone, restarted the guest agent under
# the exec session carrying the runner, and the runner died of the cancel. The
# host's `tart exec` never learned it — the agent restarted beneath its stream
# and the exit never arrived — so the loop waited on a corpse for three days,
# GitHub dropped the just-in-time registration, and the owner's next opt-in
# queued into nothing. Three rules follow, each a mechanism below:
#   · A THROWAWAY VM DOES NOT UPDATE ITSELF. The build removes
#     unattended-upgrades and masks the apt-daily timers; updates arrive by
#     --rebuild, never by mutating under a live runner.
#   · THE EXEC STREAM IS NOT THE SIGNAL. While a runner waits, the host asks
#     every --poll seconds whether GitHub still lists it and whether the guest
#     still has a Runner.Listener process, and recycles the clone the moment
#     either says no. The stream is only ever the FAST path.
#   · A WAIT HAS A CEILING. A runner idle past --max-idle is recycled anyway:
#     a JIT registration is meant for one job, not for days of waiting, and a
#     fresh clone bounds whatever drifted. A BUSY runner is never recycled.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cmd=${1:-}; shift || true
case "$cmd" in build|once|loop|install-service|uninstall-service|status) ;; *)
  sed -n '2,42p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

IMAGE=ghcr.io/cirruslabs/ubuntu:24.04
BASE=timesim-battery-base
LABEL=timesim-battery
CPU=6; MEMORY=8192; SHARDS=""; REPO=""; REBUILD=0; KEEP_AWAKE=${KEEP_AWAKE:-0}; MAX_WAIT=""; VM_PID=""; JOB_PID=
MAX_IDLE=${MAX_IDLE:-21600}; POLL=${POLL:-60}
SLOT=${SLOT:-1}; CPU_SET=0; MEMORY_SET=0
while [ $# -gt 0 ]; do
  case "$1" in
    --cpu) CPU=$2; CPU_SET=1; shift 2 ;;  --memory) MEMORY=$2; MEMORY_SET=1; shift 2 ;;
    --slot) SLOT=$2; shift 2 ;;
    --shards) SHARDS=$2; shift 2 ;;  --repo) REPO=$2; shift 2 ;;
    --rebuild) REBUILD=1; shift ;;  --keep-awake) KEEP_AWAKE=1; shift ;;
    --max-wait) MAX_WAIT=$2; shift 2 ;;
    --max-idle) MAX_IDLE=$2; shift 2 ;;  --poll) POLL=$2; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
[[ "$SLOT" =~ ^[1-9][0-9]*$ ]] || { echo "--slot wants a positive integer" >&2; exit 2; }
# Slot 1 keeps the names it always had; every other slot is suffixed, so two
# loops never share a state dir, a service label, or a VM name pattern.
if [ "$SLOT" = 1 ]; then
  STATE="$HOME/.timesim-tart"; SERVICE=com.timesim.tart-battery
  VM_PREFIX=timesim-battery-; VM_RE='^timesim-battery-[0-9]+$'; TAG="§200 tart"
else
  STATE="$HOME/.timesim-tart/slot-$SLOT"; SERVICE=com.timesim.tart-battery-$SLOT
  VM_PREFIX="timesim-battery-s$SLOT-"; VM_RE="^timesim-battery-s$SLOT-[0-9]+\$"; TAG="§200 tart[slot $SLOT]"
fi
GUEST_HOST=battery-$SLOT
mkdir -p "$STATE"
PLIST="$HOME/Library/LaunchAgents/$SERVICE.plist"
# Clone sizing for once/loop/install-service: --cpu/--memory given here, or
# SLOT_CPU/SLOT_MEMORY from the service's plist. Empty means the image's own.
case "$cmd" in once|loop|install-service)
  [ "$CPU_SET" = 1 ] && SLOT_CPU=$CPU; [ "$MEMORY_SET" = 1 ] && SLOT_MEMORY=$MEMORY ;;
esac
SLOT_CPU=${SLOT_CPU:-}; SLOT_MEMORY=${SLOT_MEMORY:-}

ROOT=$(cd "$(dirname "$0")/.." && pwd)
# The checkout the service should run from: a worktree under .claude/worktrees
# is deleted after its PR merges, and a LaunchAgent pointing into it respawns
# a failing shell forever. The main checkout's copy is used when it has one.
# `--git-common-dir` answers RELATIVE to the cwd when the answer is `.git`
# (the main checkout) and absolute from a worktree — so it is resolved from
# inside $ROOT, not from wherever the script was invoked. The first version
# cd'd from the caller's directory, passed its test from a worktree, and
# died on line one in the main checkout the day the fix merged.
MAIN_ROOT=$(cd "$ROOT" && cd "$(git rev-parse --git-common-dir 2>/dev/null || echo .git)/.." && pwd)
log() { printf '%s %s: %s\n' "$(date -u +%FT%TZ)" "$TAG" "$*"; }
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
# launchd unloads a service asynchronously: `bootout` returns before the loop
# has finished its teardown, and a `bootstrap` in that window fails with an
# I/O error while a sweep in it sees a live `tart run` and skips the clone.
# Both callers wait for the service to be gone first.
wait_gone() {
  local i
  for i in $(seq 1 45); do
    launchctl print "gui/$(id -u)/$SERVICE" >/dev/null 2>&1 || return 0
    sleep 2
  done
  log "WARNING: $SERVICE still listed by launchd after 90 s"
}
# Runner records this slot left offline: a teardown cut short leaves one.
forget_orphans() {
  local id
  for id in $(gh api "repos/$REPO/actions/runners" --jq ".runners[] | select(.name | startswith(\"$GUEST_HOST-\")) | select(.status==\"offline\") | .id" 2>/dev/null || true); do
    gh api -X DELETE "repos/$REPO/actions/runners/$id" >/dev/null 2>&1 && log "removed orphaned offline runner record #$id" || true
  done
}
# Clones from a previous crash: anything named like a job VM that no live
# `tart run` on this host owns. A crash leaves no process; a running loop (or
# a test cycle beside it) has one, and is left alone.
sweep_stale() {
  local vm
  for vm in $(tart list --quiet 2>/dev/null | grep -E "$VM_RE" || true); do
    pgrep -f "tart run $vm " >/dev/null 2>&1 && continue
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
# A throwaway VM does not update itself: on 2026-09-05 unattended-upgrade
# restarted the guest agent under a waiting runner and killed it. Updates
# arrive by --rebuild.
apt-get purge -y -q unattended-upgrades >/dev/null 2>&1 || true
systemctl disable --now apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1 || true
systemctl mask apt-daily.service apt-daily-upgrade.service >/dev/null 2>&1 || true
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
test "$(systemctl is-enabled apt-daily-upgrade.timer 2>&1)" != enabled
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
  local vm="$VM_PREFIX$(date +%s)" name jit rc=0 dog=""
  name="$GUEST_HOST-$(printf '%04x' $((RANDOM % 65536)))"
  # Whatever ends this cycle — the job, a signal, a bounded wait — the clone
  # goes, and so does any runner record GitHub still holds for its name: a
  # JIT runner that never got its job lingers as `offline` otherwise.
  trap 'teardown "$vm"; forget_runner "$name"' RETURN   # for the die() paths above; cleared before the normal return
  trap 'log "signal — tearing $vm down"; [ -n "$JOB_PID" ] && kill "$JOB_PID" 2>/dev/null; teardown "$vm"; forget_runner "$name"; exit 130' INT TERM
  tart clone "$BASE" "$vm"
  [ -n "$SLOT_CPU" ] && tart set "$vm" --cpu "$SLOT_CPU"
  [ -n "$SLOT_MEMORY" ] && tart set "$vm" --memory "$SLOT_MEMORY"
  VM_PID=""; boot "$vm"
  # The image is built as battery-1; another slot renames its guest so the
  # machine name the public logs print says which slot ran the job.
  [ "$SLOT" != 1 ] && tart exec "$vm" sudo hostnamectl set-hostname "$GUEST_HOST" >/dev/null 2>&1
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
  # THE WATCHDOG. The exec stream is the fast path; these checks are the
  # signal. Every $POLL seconds while the runner is waiting: does GitHub
  # still list it, does the guest still have a listener process, has it
  # waited past --max-idle (or --max-wait) with no job? Any "no" ends the
  # cycle. A BUSY runner is left alone whatever the clock says.
  local t0 now elapsed rec reason="" guest
  t0=$(date +%s)
  while kill -0 "$JOB_PID" 2>/dev/null; do
    sleep "$POLL"; kill -0 "$JOB_PID" 2>/dev/null || break
    now=$(date +%s); elapsed=$((now - t0))
    rec=$(gh api "repos/$REPO/actions/runners" --jq ".runners[] | select(.name==\"$name\") | \"\(.status) \(.busy)\"" 2>/dev/null || echo "api-error")
    case "$rec" in
      "api-error") ;;                                   # GitHub unreachable: not a verdict
      "") reason="GitHub no longer lists runner '$name'"; break ;;
      *" true") continue ;;                              # busy: a job is running, hands off
    esac
    guest=$(tart exec "$vm" sh -c 'pgrep -x Runner.Listener >/dev/null && echo alive || echo dead' 2>/dev/null || echo "agent-down")
    case "$guest" in
      dead) reason="no Runner.Listener process left in $vm (the exec stream never said so)"; break ;;
      agent-down) ;;                                     # the agent itself is silent: the stream will tell, or the API will
    esac
    if [ -n "$MAX_WAIT" ] && [ "$elapsed" -ge "$MAX_WAIT" ]; then reason="waited ${elapsed}s (--max-wait)"; break; fi
    if [ "$elapsed" -ge "$MAX_IDLE" ]; then reason="idle ${elapsed}s (--max-idle $MAX_IDLE)"; break; fi
  done
  if [ -n "$reason" ] && kill -0 "$JOB_PID" 2>/dev/null; then
    log "recycling: $reason"; kill "$JOB_PID" 2>/dev/null
  fi
  wait "$JOB_PID" || rc=$?
  JOB_PID=""
  log "runner '$name' exited ($rc); tearing $vm down"
  # A RETURN trap outlives the function that set it, and `vm` does not: the
  # loop's own return on the stop file fired this cycle's teardown a second
  # time with no cycle to tear down ("vm: unbound variable", harmless, seen at
  # the 2026-09-09 handover). Teardown is done explicitly here and the trap
  # cleared, so the function's return is the only thing that returns.
  trap - RETURN
  teardown "$vm"; forget_runner "$name"
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
  local SCRIPT="$MAIN_ROOT/tools/tart-battery-runner.sh"
  if [ ! -f "$SCRIPT" ]; then
    SCRIPT="$ROOT/tools/tart-battery-runner.sh"
    log "WARNING: $MAIN_ROOT has no copy of this script yet (pull main); the service will point into $ROOT, which a worktree cleanup deletes"
  fi
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$SERVICE</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>$SCRIPT</string><string>loop</string>
    <string>--repo</string><string>$REPO</string><string>--slot</string><string>$SLOT</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>KEEP_AWAKE</key><string>$KEEP_AWAKE</string>
    <key>SLOT_CPU</key><string>$SLOT_CPU</string>
    <key>SLOT_MEMORY</key><string>$SLOT_MEMORY</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <!-- A cycle's teardown (stop the VM, delete it, remove the runner record)
       takes longer than launchd's default grace before SIGKILL; cut short, it
       leaves a stopped clone and an offline record — measured at the 09-09
       slot-1 resize. 90 s covers tart's own 30 s stop timeout with room. -->
  <key>ExitTimeOut</key><integer>90</integer>
  <key>StandardOutPath</key><string>$STATE/loop.log</string>
  <key>StandardErrorPath</key><string>$STATE/loop.log</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)/$SERVICE" >/dev/null 2>&1 || true
  wait_gone
  # bootstrap can still refuse for a few seconds after the old instance is
  # gone; the first version tried once and exited in silence under set -e,
  # which is how a resize left slot 1 with no service and nothing said.
  local i
  for i in 1 2 3 4 5; do
    launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>"$STATE/bootstrap.err" && break
    log "launchctl bootstrap attempt $i failed: $(tr -d '\n' < "$STATE/bootstrap.err"); retrying in 3 s"
    [ "$i" = 5 ] && die "launchctl bootstrap failed five times — $SERVICE is NOT running"
    sleep 3
  done
  rm -f "$STATE/bootstrap.err"
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
  wait_gone
  rm -f "$PLIST"; sweep_stale; forget_orphans
  log "service removed; golden image $BASE kept (tart delete $BASE to drop it)"
  log "if vars.BATTERY_RUNS_ON still names '$LABEL', unset it:  gh variable delete BATTERY_RUNS_ON --repo $REPO"
}
status() {
  log "VMs:"; tart list 2>/dev/null | sed 's/^/    /'
  log "service:"; launchctl print "gui/$(id -u)/$SERVICE" 2>/dev/null | grep -E 'state|pid' | sed 's/^/    /' || echo "    not installed"
  log "runners GitHub sees for $REPO:"
  gh api "repos/$REPO/actions/runners" --jq '.runners[] | "    \(.name)\t\(.status)\t\(.os)\t[\([.labels[].name]|join(","))]"' 2>/dev/null || true
  log "routing: BATTERY_RUNS_ON=$(gh variable get BATTERY_RUNS_ON --repo "$REPO" 2>/dev/null || echo '<unset — battery runs on ubuntu-latest>')"
  # THE VERDICT: would a PR that opts in right now be picked up? Three
  # witnesses must agree — GitHub lists an online runner under the label, a
  # job VM is running, and that VM has a listener process. The September
  # outage had a running VM, a waiting loop, and none of the other two.
  local online vm listener
  online=$(gh api "repos/$REPO/actions/runners" --jq "[.runners[] | select(.status==\"online\" and any(.labels[]; .name==\"$LABEL\"))] | length" 2>/dev/null || echo 0)
  # `|| true`: with no job VM the grep finds nothing, and under set -e an
  # assignment from a failing pipeline ends the script one line before the
  # verdict that would have said NOT READY.
  vm=$(tart list --quiet 2>/dev/null | grep -E "$VM_RE" | head -1 || true)
  listener=none
  [ -n "$vm" ] && listener=$(tart exec "$vm" sh -c 'pgrep -x Runner.Listener >/dev/null && echo alive || echo dead' 2>/dev/null || echo "agent-down")
  if [ "${online:-0}" -ge 1 ] && [ -n "$vm" ] && [ "$listener" = alive ]; then
    log "READY — an opt-in PR would be picked up (GitHub: $online online under '$LABEL'; $vm: listener alive$( [ -n "$SLOT_CPU$SLOT_MEMORY" ] && echo ", clones at ${SLOT_CPU:-image} cpu / ${SLOT_MEMORY:-image} MB"))"
  else
    log "NOT READY — GitHub online under '$LABEL': ${online:-0}; job VM: ${vm:-none}; listener: $listener. An opt-in PR would QUEUE (up to 24 h)."
  fi
}

case "$cmd" in
  install-service) install_service ;;  uninstall-service) uninstall_service ;;
  *) "$cmd" ;;
esac
