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
2. **Everything else** — a push to `main`, a `workflow_dispatch` (collaborators
   only), a pull request from a branch of this repository — runs on the label
   the repository variable `BATTERY_RUNS_ON` names, and on `ubuntu-latest`
   when it is unset.

The variable is a single runner **label**, not JSON and not a list:
`timesim-battery` is what `tools/self-hosted-runner.sh` registers. A bare word
cannot fail to parse, and a label no online runner carries makes the job
*queue*, which is visible, rather than run on the wrong host, which is not.

Every run writes which runner took it into the job summary (name, OS,
architecture, the variable's value, and whether the event was trusted or a
fork). The pointer is read off the run; nobody has to remember it.

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

## Setting a host up

```bash
tools/self-hosted-runner.sh install
```

Defaults: name = the host's short hostname, label = `timesim-battery`,
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
and online whenever a trusted PR or a merge lands, or that run queues for up
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
