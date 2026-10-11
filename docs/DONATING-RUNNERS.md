# Donating a self-hosted runner

You have a machine and want it to run this repository's battery
(`battery.yml`, 13–34 minutes of single-threaded browser work per run). This
page says what that means, what works today, and what does not. It is the
donor-facing companion to `docs/RUNNERS.md`, which is the design record; where
the two disagree, RUNNERS.md and the workflow file win.

## Read this first: today there is no donor path without admin

Both runner scripts (`tools/self-hosted-runner.sh`, `tools/tart-battery-runner.sh`)
mint their registration through `gh api` and **refuse to run unless the `gh`
account is an admin on the repository**. A registration token is an admin
capability. So today a donated host exists in exactly one of two ways:

1. **The owner runs the scripts on your machine's behalf** (you give them a
   shell, or they are you). Nothing to ask of this repository.
2. **You are made a repository admin.** Do not do this for a runner. Admin
   also means secrets, branch protection and release control, which is a vastly
   larger grant than "lend CPU".

What a donor flow would need, none of it built: a script mode that takes a
one-hour registration token (or a JIT config) minted by the owner and handed
over out of band, and a per-donor label (see *Routing* below). File that in the
private roadmap if you want it; do not work around the admin check in the
scripts, because it is the thing standing between a stranger's machine and the
merge gate.

## What you are agreeing to

**Your machine runs the owner's pull-request code.** The runner executes
whatever `battery.yml` says on whatever tree the PR carries: `npm ci`, a
Playwright Chromium, `apt` installs (`--with-deps`, passwordless sudo on the
Linux path). The routing rule (below) limits this to runs the repository owner
triggered, so the code is the owner's, not a stranger's. That is the whole of
the trust you extend, and it is real: treat the host as one that will execute
that code.

**What the public can see.** Every job log here is public. A runner prints into
it: its **name**, the machine's **hostname**, the **working directory**
(`/home/<user>/…`), and the **OS and architecture**. It does not print your IP
(the runner only connects outward) or anything outside the job's working
directory. If those four lines should not name you or your house, use the VM
path: the guest owns all four, and the log says `battery-N`, `runner`,
`/home/runner`, `Linux/ARM64`. RUNNERS.md "Privacy" is the table.

**No secrets reach the job.** The battery uses the read-scoped `GITHUB_TOKEN`
and the Actions cache only. `release.yml` (SFTP key) and `pages.yml` (deploy)
are never routed to a host. If a change ever asks to route one, refuse it.

## What your machine must be

- **Online and awake whenever an opted-in PR lands.** A job that asks for the
  host while it is gone queues up to 24 hours. Since §251 the `route` job asks
  GitHub whether a runner is online under the label and falls back to
  `ubuntu-latest` if none is, but only if the `RUNNER_READ_TOKEN` secret exists;
  without it the answer is UNKNOWN and the job queues anyway. A laptop that
  sleeps is worse than no host.
- **About 6 vCPU / 8 GB per job slot.** One job averages ~2.5 cores; two
  overlapping jobs each ran ~30 % slower on a ten-core host. RAM below 6 GB
  per slot is not measured.
- **One architecture, on purpose.** The §152 incremental baseline is keyed by
  platform. The owner's host is `Linux/ARM64` (Tart on Apple silicon); hosted is
  `Linux/X64`. A donated host of a *third* kind needs its own seeding dispatch
  and, if two kinds share the label, they will trade cache entries and send
  PRs whole. See *Routing* before you register anything with the existing label.
- **Outbound HTTPS** to GitHub, npm and the Playwright CDN. No inbound ports.

## Setting it up (owner-run, per the section above)

Prefer the throwaway VM. It is the privacy answer and the isolation answer in
one mechanism.

```bash
# Apple silicon Mac
brew trust cirruslabs/cli && brew install cirruslabs/cli/tart
tools/tart-battery-runner.sh build                      # golden Ubuntu 24.04 image, once
tools/tart-battery-runner.sh once --max-wait 75         # one bounded test cycle
tools/tart-battery-runner.sh install-service --keep-awake --cpu 5 --memory 6144
tools/tart-battery-runner.sh status                     # read the READY / NOT READY verdict
```

Each job gets a fresh clone of the image, a just-in-time runner good for one
job, and the clone is deleted afterwards. Nothing enters the guest but that
configuration (no SSH key, no password, no token). The guest only reaches out.

Bare metal (`tools/self-hosted-runner.sh install`) works on macOS and Linux
and registers a long-lived runner under your user. It is the honest minimum, not
the recommendation: run it as a dedicated standard user, or inside a container
or VM you can snapshot. It leaks hostname and home path into public logs.

Neither script sets `vars.BATTERY_RUNS_ON`; both print the command. Do not flip
it until `status` says READY.

Updates arrive by `build --rebuild`, never by mutating a running guest. The
build removes `unattended-upgrades` on purpose: it killed a waiting runner
in the first week and the loop waited on the corpse for three days.

## Routing: what actually reaches your host

`battery.yml`'s `runs-on` is decided in this order, and none of it is yours to
change:

1. A PR from a **fork** always runs on `ubuntu-latest`.
2. A run the **repository owner** did not trigger runs on `ubuntu-latest`
   (`github.actor` against `github.repository_owner`).
3. A run goes to a host **only when asked**: the `self-hosted-battery` label,
   `[self-hosted]` in the title, a dispatch with `runner: self-hosted`, or the
   08:00 UTC nightly. A push to `main` never asks.
4. And only while `vars.BATTERY_RUNS_ON` is set.

Consequences for a donor:

- **You will see only the owner's jobs.** Your machine is never exposed to a
  contributor's fork, however the PR is labelled.
- **The variable is ONE label, owned by the owner**, and the existing runners
  register as `timesim-battery`. Registering a donated host under that same
  label puts it in the same pool as the owner's, with no way to say "mine
  first" or "not for the nightly". A donor-specific label needs a workflow
  change that does not exist. Until it does, donated capacity and the owner's
  are interchangeable, which is acceptable only if the platforms match.
- **Two hosts are not a split.** The `battery-matrix` split wants two idle
  runners and today means two slots of one Mac. Two machines would make
  roadmap §127 tier 3's "second host" row real, but that is a measurement to
  take, not a number to assume.

## Reading your own host

- `tools/tart-battery-runner.sh status` (or `self-hosted-runner.sh status`):
  VMs, service state, runners GitHub lists, the variable, and the verdict.
- `gh workflow run runner-ready.yml` asks GitHub the same question without
  queueing a battery. It has no schedule on purpose.
- Every battery run's job summary names the runner that took it.
- The loop's own log is `~/.timesim-tart/loop.log`.

## Shard count is yours to measure, and you should

The harness runs its checks across K browser contexts, read from
`BATTERY_SHARDS` in the runner's `.env`. K=3 is right on the owner's host;
K=4 was +28.7 % worse on `ubuntu-latest`'s four vCPUs. Do not copy a number.
Run the same tree at two or three values across several runs, with nothing
else on the machine, and write the winner with `--shards K`. Never measure
beside a live service while PRs may opt in: a measurement run cost a real
one 1528 s where an idle host does ~780.

## Taking it back

- Stop taking jobs: `touch ~/.timesim-tart/stop` ends the loop between jobs.
- Retire it: `tools/tart-battery-runner.sh uninstall-service` (or
  `self-hosted-runner.sh uninstall`), which unregisters and removes the
  offline record.
- **Tell the owner to unset `BATTERY_RUNS_ON`** if yours was the only host,
  or the next opt-in has nothing to land on:
  `gh variable delete BATTERY_RUNS_ON --repo kelaiem/timesim`.
  Donating is easy to stop and expensive to stop silently.

## Checklist for the owner accepting a donation

- [ ] The donor is not a repository admin; registration was done by you, or
      the donor-token mode exists.
- [ ] The host is a VM or container, or a dedicated standard user on a machine
      the donor does not mind running owner-triggered code.
- [ ] Platform matches the existing host, or a seeding dispatch has run for the
      new one and the label is not shared.
- [ ] `RUNNER_READ_TOKEN` is set, so an absent host falls back instead of
      queueing.
- [ ] `status` reads READY *before* the variable is flipped, and the donor knows
      how to take the host back out.
