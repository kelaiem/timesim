# Runners runbook (battery runner)

This page documents safe procedures for enabling and operating the self-hosted battery runner controlled by the repository variable `BATTERY_RUNS_ON`. It focuses on safe rollout, quick checks, cleanup of orphaned runners, and emergency rollback.

## Purpose / scope
- The workflow routes trusted owner-triggered runs to the label named by `vars.BATTERY_RUNS_ON`. Untrusted runs (forks, non-owner actors) must remain on `ubuntu-latest`.
- This runbook assumes the runner implementation mints an ephemeral VM per job and registers it with a runner name/label such as `timesim-battery`.

## Quick emergency checklist (top of page)
1. If CI is blocked: remove the repo variable immediately (see Emergency rollback).
2. Cancel queued runs if needed (see Cancel queued runs).
3. Clean orphaned runner records with the API (see Orphaned runner cleanup).
4. Check host-level VM images and storage for leaked snapshots.

-- Replace OWNER/REPO below with your repo owner and name when running commands --

## Before you set `BATTERY_RUNS_ON` (safe rollout)
1. Verify label and at least one runner:
   - Confirm the host(s) are registered and show the expected label(s).
2. Canary test the runs-on expression:
   - Run a small canary workflow (owner-triggered) that prints the evaluated contexts and runner selection for representative events:
     - PR from fork
     - PR synchronize by collaborator
     - Owner push
     - dependabot / scheduled / workflow_dispatch
   - Do this before setting the variable globally.
3. Set during a low-traffic window and notify maintainers.
4. Add monitoring/alerting for queue growth and runner offline events.

## How to set or remove the repository variable
- GitHub UI: Settings → Variables → Repository variables → Add variable `BATTERY_RUNS_ON`.
- GH CLI / REST (example creating):
  - curl example:
    curl -X PUT -H "Authorization: token $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      https://api.github.com/repos/OWNER/REPO/actions/variables/BATTERY_RUNS_ON \
      -d '{"value":"timesim-battery"}'
- To delete (undo):
  - gh api --method DELETE repos/OWNER/REPO/actions/variables/BATTERY_RUNS_ON
  - or remove it in the UI.

## How to check for queued jobs (targeting a label)
1. List queued workflow runs:
   gh api repos/OWNER/REPO/actions/runs?status=queued --jq '.workflow_runs[] | {id, name, event, head_repository:.head_repository.full_name}'
2. For each queued run, inspect jobs (to see runner labels):
   gh api repos/OWNER/REPO/actions/runs/RUN_ID/jobs --jq '.jobs[] | {id, name, labels, status}'
3. Quick script (bash + jq) to surface queued jobs that require a given label:
   LABEL=timesim-battery
   gh api repos/OWNER/REPO/actions/runs?status=queued --jq '.workflow_runs[].id' \
     | while read RUN_ID; do
         gh api repos/OWNER/REPO/actions/runs/$RUN_ID/jobs \
           --jq --raw-output '.jobs[] | select(.labels | index("'"$LABEL"'")) | "\(.id) \(.name) run:\('\"$RUN_ID"\')"'
       done

## Cancel queued runs
- Cancel a run by ID:
  gh api --method POST repos/OWNER/REPO/actions/runs/RUN_ID/cancel
- Cancel multiple: iterate over queued runs and call the above.

## Inspect runners and recent check-ins
- List runners and labels:
  gh api repos/OWNER/REPO/actions/runners --jq '.runners[] | {id, name, os, status, busy, labels}'
- Look at `status`/`busy` and the `labels` array to confirm a runner matches the label and is online.

## Orphaned-runner cleanup (remove runner records)
1. Find runner ID by name or label:
   gh api repos/OWNER/REPO/actions/runners --jq '.runners[] | select(.name=="battery-123" or (.labels[].name=="timesim-battery")) | {id,name}'
2. Delete runner record:
   gh api --method DELETE repos/OWNER/REPO/actions/runners/RUNNER_ID
   - Note: deleting the runner record removes it from the repo; ensure the actual host is also cleaned.
3. If the host recreated itself with the same name but different ID, delete by ID (safer).

## Emergency rollback (fastest recovery)
1. Remove the repository variable (immediate effect):
   gh api --method DELETE repos/OWNER/REPO/actions/variables/BATTERY_RUNS_ON
   - This returns the workflow logic to the fallback `ubuntu-latest` immediately (or set it explicitly to `ubuntu-latest`).
2. Cancel any queued jobs (see Cancel queued runs) if they must be aborted immediately.
3. If a host is misbehaving, delete its runner record (see Orphaned-runner cleanup).
4. Communicate: post to team Slack/issue that the variable was removed and why.

## Post-incident checklist
- Check job logs for failures or VM/runner leaks.
- Inspect the host for leftover VM clones, disk usage, or root-owned artifacts.
- If runner records were orphaned, verify there are no duplicate names that will confuse future runs.
- Normalize and pin any runner.arch values used in cache keys (to avoid unexpected cache misses).
- Run the canary tests again before re-enabling the variable.

## Naming and logging policy
- Runner names and logs are public for a public repo. Use non-sensitive, non-host-specific names (e.g., `battery-<id>`) and avoid embedding internal hostnames or addresses.

## Notes & contact
- If you are unsure, do not enable the variable. Contact the runner operators / repo owner listed in this repository before changing `BATTERY_RUNS_ON`.
