# Where the battery runs

`battery.yml` is the merge gate and the one job in this repository worth
hosting yourself: 13–34 minutes of single-threaded browser work per run on
`ubuntu-latest`, on a runner whose own header records a 1.66× spread between
two runs of the same tree. §200 lets that job run on a machine you own. The
other workflows stay where they are — `release.yml` holds an SFTP key and
`pages.yml` deploys, and neither is routed by anything below.

## The rule: routed by trust first, by a variable second

The job's `runs-on` is one expression, and it reads in this order:

1. **A pull request from a fork runs on `ubuntu-latest`. Always.** This is a
   public repository, and GitHub's guidance is that self-hosted runners
   "should almost never be used for public repositories", because a fork's
   pull request runs its own workflow code on the host. The expression tests
   the head repository before it reads anything else, so no variable, label or
   later edit lower in the file can route a fork onto your machine.
2. **A run the repository owner did not trigger runs on `ubuntu-latest`.**
   `github.actor` is the user whose action caused *this* run. On a pull
   request's `synchronize` that is whoever pushed the commits being tested,
   not whoever opened the PR, so a collaborator pushing to your branch sends
   that run to GitHub; so does their merge or their dispatch. It is compared
   against `github.repository_owner`, not a login, so no name lives in the
   file and a transfer to an organisation matches nobody, which is the safe
   side.
3. **The host is never the default.** A run goes there only when the event
   itself asks: a pull request carrying the label `self-hosted-battery` or
   `[self-hosted]` in its title, or a manual dispatch whose `runner` input
   says `self-hosted`. A push to `main` never asks, so merges always run
   GitHub-hosted, which also keeps main's baseline on the platform ordinary
   PRs inherit from.
4. **And only while the variable permits.** `BATTERY_RUNS_ON` names the
   label and is the availability switch, not the router: unset it and every
   opt-in lands on `ubuntu-latest` in silence.

Asking for the host, at creation or later:

```bash
gh pr create --title '[self-hosted] …'            # in the payload from the first run
gh pr edit NNN --add-label self-hosted-battery     # starts a new run; the hosted one is cancelled
```

The title marker is the reliable one at creation: `gh pr create --label`
applies the label a moment after the PR opens, so the opening run's payload
may not carry it. A label added to an open PR works because the workflow
listens for the `labeled` event; only the two routing labels
(`self-hosted-battery`, `full-battery`) start a run that way, and the
cancel-in-progress rule retires the hosted run the label supersedes.

The variable is a single runner **label**, not JSON and not a list:
`timesim-battery` is what both runner scripts register. A bare word
cannot fail to parse, and a label no online runner carries makes the job
*queue*, which is visible, rather than run on the wrong host, which is not.

Every run writes which runner took it into the job summary (name, OS,
architecture, who triggered it, whether and how the host was asked for, and
which tier decided). The pointer is read off the run; nobody has to remember
it.

One edge the actor test does not close, named rather than hidden: a
collaborator's commit pushed to your branch runs hosted, but your *next* push
to that branch tests the combined tree on your host. A collaborator with write
access already has that much trust; the test bounds the host to your own
activity, it does not audit the commits underneath it.

**Why a variable, when `pages.yml`'s rule is "every pointer is a git ref".**
That rule is about content: which bytes an environment serves must be
auditable from history. This pointer chooses a *host*, and it never touches a
byte the battery judges — same harness, same gates, same tree. What it changes
is operational. A laptop that closes its lid leaves every trusted job queued,
and GitHub holds a queued job for 24 hours before cancelling it. The fix for
that has to be a settings flip, because a revert through a pull request would
have its own battery queued behind the outage.

## What holds the fork rule, and what you should set beside it

- **The routing expression** above. It is the load-bearing half.
- **The approval policy for outside contributors.** The repository is on
  `first_time_contributors` today, which means a contributor with one merged
  PR runs workflows without approval. Their fork PRs still go to
  `ubuntu-latest` by the rule above, so this is defence in depth rather than
  the defence — but `all_external_contributors` costs nothing on a repository
  with two collaborators and no forks. Settings → Actions → General →
  "Fork pull request workflows from outside collaborators".
- **No secrets reach the job.** The battery uses the read-scoped
  `GITHUB_TOKEN` and the Actions cache, nothing else. Do not add a secret to
  this job; if a step ever needs one, that step belongs in a workflow that
  stays GitHub-hosted.
- **The host's own isolation.** The runner executes as the user who installed
  it, with that user's files. A dedicated standard user account on the host is
  the honest minimum; a VM you can snapshot is better. The script does not
  create either for you — it cannot without root, and which one you want is
  yours to decide.

## Privacy: what a public repository's logs say about the host

Every job log and step summary on this repository is **public**. A
self-hosted runner puts the host into them in four places, and only one of
those is something the workflow controls:

| what shows | where | who controls it |
|---|---|---|
| the runner's **name** | "Set up job", the §200 summary line | you, at registration (`--name`; the script defaults to `battery-1`, never the hostname) |
| the **machine name** — the OS hostname | "Set up job", printed by the runner itself | the OS; not configurable in the runner |
| the **working directory** — `/Users/<user>/…` or `/home/<user>/…` | checkout, the `report written to …` line, every stack trace | the account the runner runs as |
| **OS and architecture** | the cache-key lines (`…-macOS-ARM64-…`), the summary line | the host you chose |

Not shown anywhere public: the host's IP (the runner only makes outbound
connections), its other users, and anything outside the job's working
directory. Timestamps in logs are GitHub's, in UTC.

Three levels of containment, in increasing order of how much they hide:

1. **A neutral runner name.** Free, and the script's default. Closes the first
   row only.
2. **A dedicated account and a neutral hostname.** Create a standard user
   named `runner` (its home becomes `/Users/runner`, which is exactly what
   GitHub's own macOS images use, so the paths say nothing) and install as
   that user; set the machine's hostname to something neutral in System
   Settings → General → Sharing. Both are system changes the script cannot
   make. Closes rows two and three; row four still says "an Apple Silicon
   Mac".
3. **A Linux container or VM with the runner inside it — recommended.** The
   hostname is the container's, the user is `runner`, the paths are
   `/home/runner`, and the platform reads `Linux/ARM64` like any other box.
   It closes every row at once, and it is also the isolation the security
   section asks for: an `--ephemeral` runner in a container that is
   recreated per job is the "clean environment" GitHub recommends for
   reused hardware. It costs one tool this Mac does not have today
   (OrbStack or Docker Desktop for containers; Tart for a full VM) and a
   Linux/ARM64 Playwright Chromium, which exists. This host would then never
   share a baseline with `ubuntu-latest` (X64), which the platform-carrying
   cache key already handles.

Whichever level you pick, the workflow does not change; only the host does.
The third level is built: the next section.

## The built path: a throwaway Linux VM per job, on Apple Virtualization

`tools/tart-battery-runner.sh` runs the battery in a fresh Ubuntu 24.04
ARM64 guest for every job, on Apple's Virtualization.framework through
[Tart](https://github.com/cirruslabs/tart) — the Swift tool on that
framework, licensed under the Functional Source License 1.1 (internal use
permitted; converts to Apache 2.0 after two years). It is the privacy answer
and the isolation answer in one mechanism:

- **Everything the public logs print belongs to the guest.** Hostname
  `battery-1`, user `runner`, paths under `/home/runner`, platform
  `Linux/ARM64`. The Mac's name, account and kind appear nowhere.
- **Every job gets a clean machine.** Each cycle clones the golden image (an
  APFS copy-on-write clone, instant), mints a **just-in-time** runner
  configuration through `gh api` — good for exactly one job, never written
  to disk, never in the image — boots the guest, runs the runner until it
  has done that one job, and deletes the clone. That is the "clean
  environment" GitHub asks for on reused hardware, literally.
- **Nothing enters the guest but that configuration.** Commands reach it
  through `tart exec`, the guest agent the Cirrus images ship, with stdin
  attached. No SSH key, no password, no token. The guest never calls
  GitHub's API; the host does, as `gh`, and hands in what it verified.
- **The guest only ever reaches out.** NAT networking: no inbound path from
  the LAN, and the host's IP is seen only by GitHub, npm and the Playwright
  CDN, as it would be from any runner.

```bash
brew trust cirruslabs/cli && brew install cirruslabs/cli/tart   # once
tools/tart-battery-runner.sh build            # the golden image, once
tools/tart-battery-runner.sh once --max-wait 75   # one cycle, foreground, giving up after 75 s idle
tools/tart-battery-runner.sh install-service  # a LaunchAgent running `loop`
tools/tart-battery-runner.sh status
```

**The golden image** holds Ubuntu 24.04, the `runner` user with
passwordless sudo (battery.yml's `--with-deps` step apt-installs, exactly as
on `ubuntu-latest`), Node 22 verified against nodejs.org's SHASUMS256, the
`actions/runner` tarball verified against the SHA256 its release notes
embed (refused if absent), the runner's own dependency script, and the
pinned Playwright Chromium with its apt dependencies — so the workflow's
install steps find everything present and finish in seconds. It is
registered to nothing. `--cpu` and `--memory` size it (6 and 8192 by
default on a 10-core, 16 GB host); `--shards K` writes `BATTERY_SHARDS`
into the runner's `.env`, because the VM is the host whose K gets measured.
`--rebuild` throws it away and builds again — that is how the runner, Node
or the browser pin get updated. Measured on the M4 host: 75 s from `build`
to a powered-off golden image, image pull excluded.

`once --max-wait N` is the bounded test: it does a whole cycle but gives up
waiting for a job after N seconds, then tears down and removes the runner
record GitHub would otherwise keep as `offline`. Without the flag a cycle
waits for its job indefinitely, which is what the loop wants.

**The loop** is `once` forever: sweep any job VM a crash left behind, clone,
boot, mint, run one job, tear down. Between jobs there is no online runner
for the few seconds a clone and boot take, so a job that lands then queues
briefly. A cycle that fails waits a minute and tries again; `touch
~/.timesim-tart/stop` ends the loop between jobs. The service is a
LaunchAgent, which runs while this user is logged in; `--keep-awake` wraps
each cycle in `caffeinate -i` so the Mac does not idle-sleep with a runner
online — on a laptop, decide that on purpose.

**Reading it.** `~/.timesim-tart/loop.log` is the loop; each cycle's runner
output lives beside it only until the cycle ends. `status` lists the VMs,
the service, the runners GitHub currently sees (a JIT runner exists only
between mint and its one job) and the routing variable.

The name GitHub shows for each runner is `battery-1-` plus four hex digits,
because a JIT runner's name must be unique among online runners and the
previous cycle's may still be draining when the next one registers. The
machine name it prints beside it is the guest's, `battery-1`.

## Setting a host up (bare metal)

```bash
tools/self-hosted-runner.sh install
```

Defaults: name = `battery-1` (neutral on purpose — see Privacy above), label = `timesim-battery`,
directory = `~/actions-runner-timesim` (outside the checkout on purpose — the
runner's `_work` holds its own clones). What it does, in order: checks the
host's tools and that `gh` is logged in as a repo admin; downloads the
`actions/runner` release for this OS and architecture and **verifies it
against the SHA256 the release notes publish for that asset** (it refuses a
release that publishes none); pre-installs the pinned Playwright Chromium so
the workflow's own install step is a no-op; registers with a one-hour token
minted through `gh api` and never stored; installs and starts the service
(a LaunchAgent on macOS, which runs while that user is logged in; a systemd
unit on Linux, which is why that path uses `sudo`). Every step is idempotent;
re-run it to repair a half-finished host.

It ends by printing the one command it deliberately does not run:

```bash
gh variable set BATTERY_RUNS_ON --repo kelaiem/timesim --body 'timesim-battery'
```

**Before you flip it**, on a laptop especially: the machine has to be awake
and online whenever a PR that asked for it lands, or that run queues for up
to a day. A host that is only sometimes there is worse than `ubuntu-latest`,
because the failure looks like a slow battery rather than an absent one.
Unset the variable the moment the host is going away:

```bash
gh variable delete BATTERY_RUNS_ON --repo kelaiem/timesim
```

`tools/self-hosted-runner.sh status` shows what GitHub thinks is registered,
the service's state on this host, and the variable. `uninstall` stops the
service and unregisters, and reminds you about the variable.

## What a host is allowed to decide for itself: its shard count

`ci-battery.mjs` runs its checks across K browser contexts, and K is a
**measured property of the host** — the harness's header records K=4 being
+28.7% worse than K=3 on `ubuntu-latest`'s four vCPUs after a dev container
had predicted the opposite sign. The workflow therefore never states K. The
harness reads `BATTERY_SHARDS` from the environment, and the runner loads its
own `.env` file into every job, so a host's K lives on the host:

```bash
tools/self-hosted-runner.sh install --shards 4
```

Measure before you write it. Run the same tree at two or three values and
compare the summary's wall and check-time lines across several runs, not one;
the `cost` column, the per-check guard and the job cap all carry the same
warning, and `battery.yml`'s header is the record of what a single green run
gets wrong.

## What stays the same on any host

- **The job cap (50 min) and the per-check guard (35 min).** Both are sized by
  the slow tail of the runner they were measured on, and both files say to
  re-derive them together from several runs. A faster host makes them loose,
  which costs nothing; do not tighten them from one run.
- **The baseline cache key carries the platform.** A §152 baseline's rows are
  inherited verbatim into a PR's report, so they must come from the same
  browser build on the same architecture. A push run on macOS/arm64 seeds only
  macOS/arm64 PRs; a fork PR on `ubuntu-latest` finds no baseline and runs
  whole, which is the safe verdict for a fork anyway. Flipping the variable
  costs one whole run per PR until the next merge re-seeds the new platform.
- **The Playwright cache lists both browser directories** (`~/.cache` on
  Linux, `~/Library/Caches` on macOS), and `--with-deps` is passed only on
  Linux, where it is the apt work the comment describes. On macOS it was
  measured to download a codec the harness never uses and then stall.

## Not built, and where it would go

- **A second host, and a matrix across them.** Roadmap §127 tier 3 prices two
  hosts at −41% of job wall with the sweeps sliced, and Landing A already made
  the harness assemble across processes (`--matrix`, `--collect`). A
  self-hosted host makes that fleet heterogeneous, which is one more reason
  the shard count lives on the host. Landing B is the workflow that carries
  worker files as artifacts; it is not this.
- **Routing `offline.yml`.** Two and a half minutes on `ubuntu-latest`; not
  worth a host's attention until the battery has run there for a while.
