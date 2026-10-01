// §251 — IS THE SELF-HOSTED BATTERY HOST READY, ASKED FROM OFF THE HOST?
// Acceptance: exit 0 READY, 1 NOT READY, 2 CANNOT TELL (no token, API error).
//
// `tart-battery-runner.sh status` answers this on the host, from three
// witnesses. Only one of them is visible from anywhere else — GitHub lists an
// ONLINE runner carrying the routing label — and it is the one that decides
// whether a queued job is ever picked up: the 09-06 opt-in queued sixteen
// minutes into nothing because no runner under the label was online, which
// this reads directly. The criterion is the host script's own first witness,
// `status == "online"` and the label among the runner's labels, so the two
// cannot disagree about what "online under the label" means. Busy counts as
// ready: a busy runner takes the next job when it finishes.
//
// It RETRIES before saying NOT READY, because the host's loop is between
// registrations for the seconds a clone boots and a just-in-time runner is
// minted, and a single read there would route a healthy host away.
//
// Three outcomes, never two. A missing token or a failed API call is not a
// verdict either way (the host script's own rule: "a silent GitHub API is not
// a verdict"), so it is reported as CANNOT TELL and the caller decides; the
// battery workflow keeps its old routing on it rather than guessing.
//
// The token needs the repository's "Administration: read" permission — the
// workflow's GITHUB_TOKEN cannot list self-hosted runners — and is read from
// RUNNER_READ_TOKEN. Writes `verdict`, `online`, `busy` to GITHUB_OUTPUT and a
// line to GITHUB_STEP_SUMMARY when those exist.
//
//   RUNNER_READ_TOKEN=… node tools/runner-ready.mjs [--repo owner/name] [--label L] [--attempts N] [--every S]
import { appendFileSync } from 'node:fs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const REPO = arg('repo', process.env.GITHUB_REPOSITORY || 'kelaiem/timesim');
const LABEL = arg('label', process.env.BATTERY_RUNS_ON || 'timesim-battery');
// 6 reads 15 s apart: 75 s of window, longer than a clone-boot-mint cycle
// between jobs (seconds, per docs/RUNNERS.md) with room for a slow boot.
// A dispatch input is free text, so a value that is not a number falls back
// to the default rather than becoming NaN reads.
const num = (v, dflt, min) => (Number.isFinite(+v) && +v >= min ? Math.floor(+v) : dflt);
const ATTEMPTS = num(arg('attempts', 6), 6, 1);
const EVERY_S = num(arg('every', 15), 15, 0);
const TOKEN = process.env.RUNNER_READ_TOKEN || '';

const report = (verdict, detail, extra = {}) => {
  const line = `§251 runner readiness: ${verdict} — ${detail}`;
  console.log(line);
  if (process.env.GITHUB_OUTPUT) {
    const kv = { verdict, ...extra };
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(kv).map(([k, v]) => `${k}=${v}\n`).join(''));
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
};

if (!TOKEN) {
  report('UNKNOWN', 'RUNNER_READ_TOKEN is not set, so nothing off the host can list runners (needs "Administration: read")');
  process.exit(2);
}

const read = async () => {
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/runners?per_page=100`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GET runners: HTTP ${res.status}${res.status === 403 || res.status === 404 ? ' (the token needs "Administration: read" on this repository)' : ''}`);
  const runners = (await res.json()).runners || [];
  const mine = runners.filter((r) => r.status === 'online' && (r.labels || []).some((l) => l.name === LABEL));
  return { online: mine.length, busy: mine.filter((r) => r.busy).length, names: mine.map((r) => r.name) };
};

let last = null;
for (let a = 1; a <= ATTEMPTS; a++) {
  try {
    last = await read();
  } catch (e) {
    report('UNKNOWN', `${e.message} — not a verdict either way`);
    process.exit(2);
  }
  if (last.online > 0) {
    report('READY', `${last.online} online under '${LABEL}' (${last.busy} busy): ${last.names.join(', ')} — read ${a} of ${ATTEMPTS}`,
      { online: last.online, busy: last.busy });
    process.exit(0);
  }
  if (a < ATTEMPTS) await new Promise((r) => setTimeout(r, EVERY_S * 1000));
}
report('NOT_READY', `no runner online under '${LABEL}' in ${ATTEMPTS} reads over ${(ATTEMPTS - 1) * EVERY_S} s — an opt-in would queue (up to 24 h)`,
  { online: 0, busy: 0 });
process.exit(1);
