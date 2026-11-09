#!/usr/bin/env node
// TODO 294 — WHAT DOES A CAPPED CI JOB ACTUALLY WALL, and is the newest row an
// OUTLIER or a CHANGE? It prints the walls, their running average and spread,
// what the cap rule makes of them, and which reading the series supports. About
// the CAPS it is a REPORT: it judges none of them and exits 0 whatever it reads,
// because the cap is the owner's number and a quiet API is not a measurement.
// The index lists it as acceptance because its own `--self-test` gates, which is
// the only thing in here that can fail.
//
//   node tools/cap-walls.mjs                            # every capped job in battery.yml
//   node tools/cap-walls.mjs 'battery geared invariant'  # one job, by its `name:`
//   node tools/cap-walls.mjs --runs 40 --factor 1.66     # a longer window, another factor
//   node tools/cap-walls.mjs --json                      # one JSON line per job
//   node tools/cap-walls.mjs --self-test                 # plant each series, require the reading
//
// WHY THIS EXISTS. battery.yml's cap blocks used to carry the samples as prose,
// and in two days that cost three pull requests: every CI run produced a new
// wall, and three times the new wall falsified a sentence written for the ones
// before it. Two runs agreed on a step to the second and the block called the
// probe steady; the third took the agreement away. Three sat inside 1.10x and
// the block called that tidy; the fourth took the tidiness away. The walls were
// never the problem — GitHub keeps them for as long as it keeps the runs — the
// problem was COPYING them into a file that cannot notice when they move. So
// the file keeps the RULE and this keeps the NUMBERS.
//
// THE RULE IT APPLIES, which is battery.yml's and not this file's: a cap is the
// slowest wall times FACTOR, rounded up to the minute. FACTOR is 1.66, the
// same-tree spread measured on `battery probes` (eight samples, 487-811 s) and
// corroborated by boot-pool.mjs' runner bench; it is a span, not a safety
// margin, and it is why a cap is never read off one run.
//
// OUTLIER OR CHANGE — the distinction the prose kept getting wrong, and the
// only judgement here that is more than arithmetic:
//
//   * An OUTLIER is one row the series does not support. Measured by the
//     MODIFIED Z-SCORE off the MEDIAN, z = 0.6745 * (x - median) / MAD, with
//     |z| > 3.5 the flag (Iglewicz & Hoaglin's rule). Median and MAD are used
//     rather than mean and standard deviation because two slow runs out of five
//     drag a mean and an SD far enough to hide themselves.
//   * A CHANGE is the series moving. Measured by splitting the runs in half by
//     TIME and comparing the halves' medians; a shift wider than SHIFT_MADS
//     (1.5) MAD-scales is a change, not noise.
//
// A single high row with a quiet half behind it is an outlier and the cap
// should not chase it. Two or three high rows in the newest half are a change
// and the cap should follow, upward. Both can be true at once, and when they
// are this says so rather than picking.
//
// WHAT IT CANNOT TELL YOU, stated rather than implied. WHY a job got slower:
// a runner image, a dependency, GitHub's own load and the probe's own work all
// look identical from here. It reads the wall of the JOB and of its slowest
// STEP, and the difference is setup and the runner's book-ends, nothing more.
// It also cannot see a run GitHub has expired, so a long window silently
// becomes a short one; `rows` in the output is what was actually read.
//
// The token is the usual one: GH_TOKEN or GITHUB_TOKEN if set, else
// `gh auth token`. Without any of them it says so and exits 0 — not a verdict.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const num = (v, d, min) => (Number.isFinite(+v) && +v >= min ? +v : d);

const REPO = opt('repo', process.env.GITHUB_REPOSITORY || 'kelaiem/timesim');
const WORKFLOW = opt('workflow', 'battery.yml');
const RUNS = Math.floor(num(opt('runs', 30), 30, 1));
const FACTOR = num(opt('factor', 1.66), 1.66, 1);
const Z_FLAG = 3.5; // Iglewicz & Hoaglin
const SHIFT_MADS = 1.5;
const JSON_OUT = flag('json');

// ---------------------------------------------------------------- statistics
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// The modified z-score. MAD of 0 (every row identical, or a 2-row series with
// one repeat) cannot scale anything, so it falls back to the mean absolute
// deviation and, failing that, declares no spread rather than dividing by zero.
export const zScores = (xs) => {
  const med = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - med)));
  // FLOOR, 5 % of the median. On few rows a tight cluster collapses the MAD —
  // seven `battery probes` rows once gave MAD 17 s, which made an 804 s wall
  // read as a 6-sigma outlier although the job's own eight-sample band is
  // 487-811 s. Dispersion finer than a twentieth of the thing it is judging is
  // not a yardstick, so the scale never falls below it.
  const floor = 0.05 * med;
  const scale = Math.max(mad, floor) || 0;
  return { med, mad, scale, z: xs.map((x) => (scale ? (0.6745 * (x - med)) / scale : 0)) };
};

// Split by TIME, oldest half against newest half. An odd row count gives the
// middle row to neither side: it is the one row that cannot say which half it
// belongs to.
export const splitShift = (ordered) => {
  if (ordered.length < 4) return null;
  const h = Math.floor(ordered.length / 2);
  const older = ordered.slice(0, h);
  const newer = ordered.slice(ordered.length - h);
  const shift = median(newer) - median(older);
  const { scale } = zScores(ordered);
  return { older: median(older), newer: median(newer), shift, mads: scale ? shift / scale : 0 };
};

export const summarise = (rows, { factor = FACTOR } = {}) => {
  // rows: [{ wall, step, run, sha, when }] oldest first
  const walls = rows.map((r) => r.wall);
  if (!walls.length) return { rows: 0 };
  const { med, mad, scale, z } = zScores(walls);
  const flagged = rows.map((r, i) => ({ ...r, z: z[i], outlier: Math.abs(z[i]) > Z_FLAG }));
  const kept = flagged.filter((r) => !r.outlier);
  const cap = (xs) => (xs.length ? Math.ceil((Math.max(...xs.map((r) => r.wall)) * factor) / 60) : null);
  const shift = splitShift(walls);
  return {
    rows: walls.length,
    min: Math.min(...walls),
    max: Math.max(...walls),
    mean: +mean(walls).toFixed(1),
    median: med,
    mad,
    scale: +scale.toFixed(1),
    span: +(Math.max(...walls) / Math.min(...walls)).toFixed(3),
    outliers: flagged.filter((r) => r.outlier),
    capAll: cap(flagged),
    capKept: cap(kept),
    shift,
    reading: reading(flagged, shift),
    flagged,
  };
};

// The one judgement: what does this series support? Reported, never acted on.
export const reading = (flagged, shift) => {
  const out = flagged.filter((r) => r.outlier);
  const moved = shift && Math.abs(shift.mads) > SHIFT_MADS;
  if (out.length && moved) return 'BOTH — the newest half has moved AND at least one row stands outside the series; read the rows, do not take one number';
  if (out.length) return `OUTLIER — ${out.length} row(s) the series does not support; a cap should not chase them`;
  if (moved) return `CHANGE — the newest half's median moved ${shift.shift > 0 ? 'UP' : 'DOWN'} ${Math.abs(shift.shift).toFixed(0)} s (${Math.abs(shift.mads).toFixed(1)} scales); a cap should follow it${shift.shift > 0 ? ', upward' : ' only after six rows agree'}`;
  return `STEADY — no row stands outside the series and the halves are within ${SHIFT_MADS} scales of each other; nothing here asks for a cap to MOVE, which is a different question from whether the one on file is right`;
};

// ------------------------------------------------------------------- the caps
// battery.yml's own caps, read from the file rather than typed here. No YAML
// parser is installed (and a workflow is the one file that must not depend on
// one), so this reads the two-space job keys and the keys under them, which is
// all a cap needs: a job's `name:` and its `timeout-minutes:`.
// A `name:` or a `timeout-minutes:` can be an EXPRESSION — battery.yml's own
// `battery` job carries both (`format('battery worker {0}/2', …)` and a cap of
// 125, 95 or 150 by event). Neither can be resolved from the file, so such a
// job is reported as unreadable rather than guessed at. The trap this closes:
// `battery-collect` is literally named `battery`, so a reader that keys on the
// display name alone pairs the `battery` job's walls with battery-collect's
// 10-minute cap and announces that the file is 41 minutes low. A wall belongs
// to the job it was measured in, and nothing else establishes that.
export const capsFrom = (yaml) => {
  const jobs = [];
  let job = null;
  let inJobs = false;
  for (const line of yaml.split('\n')) {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (/^[A-Za-z]/.test(line)) inJobs = /^jobs:/.test(line);
    if (!inJobs) continue;
    const start = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (start) {
      if (job) jobs.push(job);
      job = { key: start[1], name: start[1], cap: null, rawCap: null };
      continue;
    }
    if (!job) continue;
    const name = /^ {4}name:\s*(.+?)\s*$/.exec(line);
    if (name) job.name = name[1].replace(/^['"]|['"]$/g, '');
    const cap = /^ {4}timeout-minutes:\s*(.+?)\s*$/.exec(line);
    if (cap) {
      job.rawCap = cap[1].replace(/^['"]|['"]$/g, '');
      job.cap = /^\d+$/.test(job.rawCap) ? +job.rawCap : null;
    }
  }
  if (job) jobs.push(job);
  const capped = jobs.filter((j) => j.rawCap !== null);
  const seen = new Map();
  for (const j of capped) seen.set(j.name, (seen.get(j.name) || 0) + 1);
  return capped.map((j) => ({
    ...j,
    computedName: j.name.includes('${{'),
    computedCap: j.cap === null,
    ambiguous: seen.get(j.name) > 1,
  }));
};

// --------------------------------------------------------------------- GitHub
const token = () => {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const api = async (tok, path) => {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status}`);
  return res.json();
};

const secs = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 1000);

const walls = async (tok, names) => {
  const runs = (await api(tok, `repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=${RUNS}`)).workflow_runs || [];
  const found = new Map(names.map((n) => [n, []]));
  for (const run of [...runs].reverse()) {
    if (run.status !== 'completed') continue;
    const jobs = (await api(tok, `repos/${REPO}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`)).jobs || [];
    for (const j of jobs) {
      if (!found.has(j.name) || j.conclusion !== 'success') continue;
      const steps = (j.steps || []).filter((s) => s.started_at && s.completed_at);
      const worst = steps.length ? Math.max(...steps.map((s) => secs(s.started_at, s.completed_at))) : null;
      found.get(j.name).push({
        run: run.id,
        sha: (run.head_sha || '').slice(0, 8),
        when: j.completed_at,
        wall: secs(j.started_at, j.completed_at),
        step: worst,
      });
    }
  }
  return found;
};

// ------------------------------------------------------------------- printing
const show = (name, cap, s) => {
  if (!s.rows) {
    console.log(`${name}: cap ${cap} min — NO ROWS in the last ${RUNS} runs of ${WORKFLOW} (a cap with no wall behind it is still a guess)`);
    return;
  }
  console.log(`\n== ${name} ==  cap ${cap} min`);
  for (const r of s.flagged) {
    console.log(
      `  ${String(r.wall).padStart(5)} s  step ${String(r.step ?? '?').padStart(5)} s   z ${r.z.toFixed(2).padStart(6)}` +
        `${r.outlier ? '  OUTLIER' : '        '}  ${r.sha}  run ${r.run}`,
    );
  }
  console.log(
    `  rows ${s.rows}   ${s.min}-${s.max} s, span ${s.span}x   mean ${s.mean} s   median ${s.median} s   MAD ${s.mad} s`,
  );
  if (s.shift) console.log(`  halves: older median ${s.shift.older} s -> newer ${s.shift.newer} s  (${s.shift.shift >= 0 ? '+' : ''}${s.shift.shift.toFixed(0)} s, ${s.shift.mads.toFixed(1)} scales)`);
  const rule = (c, label) => `${label}: slowest x ${FACTOR} = ${Math.round(Math.max(...(label === 'all rows' ? s.flagged : s.flagged.filter((r) => !r.outlier)).map((r) => r.wall)) * FACTOR)} s -> ${c} min`;
  console.log(`  ${rule(s.capAll, 'all rows')}`);
  if (s.capKept !== s.capAll) console.log(`  ${rule(s.capKept, 'outliers dropped')}`);
  // THE ASK IS TAKEN OFF THE ROWS THE SERIES SUPPORTS, so one freak slow run
  // does not buy a cap five minutes of slack it will never need. The asymmetry
  // is in what is DONE with the ask, not in the ask: a cap under it is a job
  // that can be killed mid-measurement and is called out in capitals, while a
  // cap over it is slack that costs nothing but a late failure, and this never
  // recommends cutting that. Every time this workflow's prose tightened a cap
  // toward its fast rows it was wrong inside a day.
  const want = s.capKept ?? s.capAll;
  console.log(`  the rule asks for ${want} min; the file says ${cap} min — ${want > cap ? 'THE FILE IS LOW' : want < cap ? 'the file is generous, which is allowed and is not an invitation to cut it' : 'they agree'}`);
  console.log(`  ${s.reading}`);
};

// ----------------------------------------------------------------- self-test
const selfTest = () => {
  const mk = (xs) => xs.map((w, i) => ({ wall: w, step: w - 20, run: i, sha: 'x', when: i }));
  let bad = 0;
  const check = (what, got, want) => {
    const ok = String(got) === String(want);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : ` — got ${got}, wanted ${want}`}`);
    if (!ok) bad++;
  };

  // A quiet series with one spike: the spike is the outlier, the halves agree.
  const spike = summarise(mk([300, 305, 298, 302, 900, 301, 299, 303]));
  check('a lone spike is flagged as an outlier', spike.outliers.length, 1);
  check('the spike is the 900 s row', spike.outliers[0].wall, 900);
  check('a spike does not read as a change', spike.reading.startsWith('OUTLIER'), true);
  check('dropping it lowers the cap the rule asks for', spike.capKept < spike.capAll, true);

  // A step change: no row is an outlier, the halves disagree.
  const step = summarise(mk([300, 305, 298, 302, 448, 452, 450, 455]));
  check('a step change flags no outliers', step.outliers.length, 0);
  check('a step change reads as a change', step.reading.startsWith('CHANGE'), true);
  check('the change is upward and about 150 s', Math.round(step.shift.shift), 150);

  // Steady: nothing to say.
  check('a steady series reads STEADY', summarise(mk([300, 305, 298, 302, 301, 299])).reading.startsWith('STEADY'), true);

  // Degenerate series must not invent dispersion or divide by zero.
  check('identical rows give no outliers', summarise(mk([300, 300, 300, 300])).outliers.length, 0);
  check('identical rows give a finite cap', Number.isFinite(summarise(mk([300, 300, 300, 300])).capAll), true);
  check('one row still derives a cap', summarise(mk([360])).capAll, 10);
  check('one row has no halves to compare', summarise(mk([360])).shift, null);
  check('no rows is not a summary', summarise([]).rows, 0);

  // The cap reader, against a workflow shape rather than a YAML parser.
  const caps = capsFrom(
    [
      'on:',
      '  push:',
      '    branches: [main]',
      'jobs:',
      '  route:',
      '    name: route',
      '  battery-probes:',
      '    name: battery probes',
      '    timeout-minutes: 23',
      '  battery:',
      "    name: ${{ matrix.worker && 'battery worker' || 'battery' }}",
      "    timeout-minutes: \"${{ github.event_name == 'pull_request' && 125 || 150 }}\"",
      '    steps:',
      '      - name: a step',
      '        timeout-minutes: 99',
      '  battery-collect:',
      '    name: battery',
      '    timeout-minutes: 10',
    ].join('\n'),
  );
  check('a job with no cap is not listed', caps.some((j) => j.key === 'route'), false);
  check('the probes cap is read by display name', caps.find((j) => j.name === 'battery probes')?.cap, 23);
  check("a STEP's timeout is not mistaken for a job's", caps.find((j) => j.key === 'battery-probes')?.cap, 23);
  check('a computed cap is not a number', caps.find((j) => j.key === 'battery')?.computedCap, true);
  check('a computed name is marked', caps.find((j) => j.key === 'battery')?.computedName, true);
  check('two jobs sharing a display name are both ambiguous', caps.filter((j) => j.ambiguous).length, 0);
  check('nothing outside jobs: is read as a job', caps.some((j) => j.key === 'push'), false);
  const dup = capsFrom(['jobs:', '  a:', '    name: battery', '    timeout-minutes: 3', '  b:', '    name: battery', '    timeout-minutes: 4'].join('\n'));
  check('a genuinely duplicated display name is refused', dup.every((j) => j.ambiguous), true);

  console.log(bad ? `\n${bad} FAILED` : '\nall PASS');
  return bad ? 1 : 0;
};

// --------------------------------------------------------------------- main
// Importing this file runs nothing (battery-plan.mjs' rule): the statistics
// and the cap reader are exported so a test can hold them without the API.
const RUN_AS_MAIN = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (!RUN_AS_MAIN) {
  // imported — nothing to do
} else if (flag('self-test')) {
  process.exit(selfTest());
} else {
  await main();
}

async function main() {
const yaml = readFileSync(new URL(`../.github/workflows/${WORKFLOW}`, import.meta.url), 'utf8');
const all = capsFrom(yaml);
for (const j of all.filter((x) => x.computedName || x.computedCap || x.ambiguous)) {
  const why = j.computedName
    ? `its name is computed per run (${j.name}), so no wall can be matched to it from here`
    : j.ambiguous
      ? 'another job in this workflow carries the same display name, and a wall belongs to the job it was measured in'
      : `its cap is computed per run (${j.rawCap}), so there is no one number to compare against`;
  console.log(`skipping ${j.key}: ${why}`);
}
const caps = all.filter((x) => !x.computedName && !x.computedCap && !x.ambiguous);
const asked = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--runs' && argv[argv.indexOf(a) - 1] !== '--factor' && argv[argv.indexOf(a) - 1] !== '--repo' && argv[argv.indexOf(a) - 1] !== '--workflow');
const wanted = asked.length ? caps.filter((j) => asked.includes(j.name) || asked.includes(j.key)) : caps;
if (!wanted.length) {
  console.log(`no readable capped job in ${WORKFLOW} matches ${asked.join(', ') || '(nothing)'} — readable: ${caps.map((j) => j.name).join(', ') || '(none)'}`);
  return;
}

const tok = token();
if (!tok) console.log('no GH_TOKEN, GITHUB_TOKEN or `gh auth token` — reading the API unauthenticated, which is rate-limited and cannot see a private repository');

let found;
try {
  found = await walls(tok, wanted.map((j) => j.name));
} catch (e) {
  console.log(`the jobs API gave nothing back (${e.message}) — not a measurement, and not a verdict about any cap`);
  return;
}

const out = [];
for (const job of wanted) {
  const rows = found.get(job.name) || [];
  const s = summarise(rows);
  if (JSON_OUT) out.push(JSON.stringify({ name: job.name, cap: job.cap, ...s, flagged: undefined, outliers: s.outliers?.map((r) => r.run) }));
  else show(job.name, job.cap, s);
}
if (JSON_OUT) console.log(out.join('\n'));
}
