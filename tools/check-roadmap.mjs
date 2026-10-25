#!/usr/bin/env node
// The public-roadmap gate (§272). docs/ROADMAP.md lists the work that is IN
// PROGRESS and has been deliberately published; this holds it true.
//
//   node tools/check-roadmap.mjs                  # structural checks gate; staleness is REPORTED
//   node tools/check-roadmap.mjs --gate-stale     # the nightly: staleness gates too
//   node tools/check-roadmap.mjs --self-test      # plant each defect, require the gate to catch it
//
// WHY A CHECKER. The private roadmap's README records the failure this repeats
// by construction: a shipped entry takes two edits in two places and the
// second is the forgettable one — forgotten five times before a watcher
// existed. Here the second edit is "delete the row", and the rule is that a
// number cannot be both in progress and shipped, so landing the BUILT section
// without deleting the row is red in the same PR.
//
// WHAT IT CANNOT HOLD, stated rather than implied: whether a row's TEXT is safe
// to publish. BACKLOG.md is private on purpose and was purged from history, and
// no parse can know what a person meant to keep private. PRIVATE_MARKERS and
// MAX_CELL below are a tripwire for pasting an entry wholesale, not a proof;
// the human step is the PR template's, and the row is written fresh.
//
// STALE_DAYS is a derived number (standing rule 1). Constraint: an in-progress
// row must not outlive the work. Measured 2026-10-11 over the 77 merge-commit
// merges to main since 2026-06-01, oldest branch commit to merge: median 1 h,
// p90 13 h, max 26 h. 7 days is 6.5x the longest and so is a stalled branch
// rather than a slow one. The sample is the merge-commit PRs only (squash
// merges leave no second parent to measure), so it is a floor on how long
// real work runs; re-derive it from the PR API if rows start tripping it.
// "Last commit" is the branch tip's committer date, so a merge of main into a
// stalled branch resets it — a lenient reading, accepted, because the
// alternative (author dates) would flag a freshly rebased live branch.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { itemText, treeSource } from './item-docs.mjs';   // docs/todo/ and docs/built/, one file per item
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
export const STALE_DAYS = 7;
export const MAX_CELL = 400;   // an item's public line is a sentence or two, not an entry
export const PRIVATE_MARKERS = [
  /feasibility\s*[·|:]/i, /\bcost\s*[·|:]/i, /timesim-roadmap/i, /BACKLOG/,
  /\bpriorit(y|ies)\b/i, /dependency map/i, /status index/i,
];

const SECTION = (name) =>
  new RegExp(`<!-- roadmap:${name} -->([\\s\\S]*?)<!-- /roadmap:${name} -->`);
const ID = /^(§|TODO\s+)(\d+)$/;

function tableRows(block) {
  // Header and separator are the first two table lines; every later `|` line is data.
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  return lines.slice(2).map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
}

function parseId(cell) {
  const m = ID.exec(cell);
  if (!m) return null;
  return { ns: m[1] === '§' ? 'BUILT' : 'TODO', n: Number(m[2]), text: cell };
}

// Pure: everything it reads is passed in, so --self-test can plant defects.
//   doc       docs/ROADMAP.md text
//   claims    Set of 'NS-0123' claim file stems
//   built     Set of § numbers with a `## §n` section in docs/BUILT.md
//   todo      Map of TODO number -> heading title
//   branches  Map of branch name -> last commit unix seconds
//   now       unix seconds
export function check({ doc, claims, built, todo, branches, now }) {
  const failures = [];
  const stale = [];
  const fail = (m) => failures.push(m);

  const prog = SECTION('rows').exec(doc);
  const stop = SECTION('stopped').exec(doc);
  if (!prog) fail('docs/ROADMAP.md has no <!-- roadmap:rows --> … <!-- /roadmap:rows --> block');
  if (!stop) fail('docs/ROADMAP.md has no <!-- roadmap:stopped --> … <!-- /roadmap:stopped --> block');
  if (!prog || !stop) return { failures, stale, rows: 0, stopped: 0 };

  const rows = tableRows(prog[1]);
  const stopped = tableRows(stop[1]);
  const seen = new Map();

  const privacy = (where, cells) => {
    for (const c of cells) {
      if (c.length > MAX_CELL) fail(`${where}: a cell is ${c.length} chars (cap ${MAX_CELL}) — a public line is a sentence or two, written fresh, not a pasted entry`);
      for (const re of PRIVATE_MARKERS) if (re.test(c)) fail(`${where}: reads like private-roadmap text (${re}) — rewrite it for the public`);
    }
  };

  for (const cells of rows) {
    const where = `in progress "${cells[0] || '?'}"`;
    if (cells.length !== 5) { fail(`${where}: ${cells.length} cells, want 5 (Item | What | Status | Branch | Since)`); continue; }
    const [item, what, status, branchCell, since] = cells;
    const id = parseId(item);
    if (!id) { fail(`${where}: Item must be "§N" or "TODO N"`); continue; }
    const key = `${id.ns}-${id.n}`;
    if (seen.has(key)) fail(`${where}: listed twice`);
    seen.set(key, true);
    if (!what || !status) fail(`${where}: What and Status may not be empty`);
    privacy(where, [what, status]);

    const stem = `${id.ns}-${String(id.n).padStart(4, '0')}`;
    if (!claims.has(stem)) fail(`${where}: no claim file docs/item-numbers/${stem}.md — run tools/claim-item.mjs`);

    if (id.ns === 'BUILT') {
      // A § in both files is a partial ship (§10, §36). Only a row that says so may stay.
      if (built.has(id.n) && !/^continues\b/i.test(status))
        fail(`${where}: §${id.n} already has a docs/BUILT.md section — shipped. Delete the row, or start Status with "Continues" if more of it is genuinely still being built`);
    } else {
      const title = todo.get(id.n);
      if (title === undefined) fail(`${where}: TODO.md has no item ${id.n}`);
      else if (/\bCLOSED\b/.test(title)) fail(`${where}: TODO ${id.n} is CLOSED — delete the row`);
    }

    const branch = /^`([^`]+)`$/.exec(branchCell)?.[1];
    if (!branch) fail(`${where}: Branch must be a branch name in backticks`);
    else if (!branches.has(branch)) fail(`${where}: branch ${branch} does not exist — merged? delete the row. Abandoned? move it to Stopped with a reason`);
    else {
      const days = (now - branches.get(branch)) / 86400;
      if (days > STALE_DAYS) stale.push(`${where}: ${branch} last committed ${days.toFixed(1)} days ago (window ${STALE_DAYS})`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(Date.parse(since))) fail(`${where}: Since must be YYYY-MM-DD`);
    else if (Date.parse(since) / 1000 > now + 86400) fail(`${where}: Since is in the future`);
  }

  for (const cells of stopped) {
    const where = `stopped "${cells[0] || '?'}"`;
    if (cells.length !== 4) { fail(`${where}: ${cells.length} cells, want 4 (Item | What | Why it stopped | Stopped)`); continue; }
    const [item, what, why, when] = cells;
    const id = parseId(item);
    if (!id) { fail(`${where}: Item must be "§N" or "TODO N"`); continue; }
    if (seen.has(`${id.ns}-${id.n}`)) fail(`${where}: also listed in progress`);
    if (!why) fail(`${where}: a stopped item says why`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(when)) fail(`${where}: Stopped must be YYYY-MM-DD`);
    privacy(where, [what, why]);
  }
  return { failures, stale, rows: rows.length, stopped: stopped.length };
}

// ---- reading the real tree -------------------------------------------------

function readTree() {
  const doc = readFileSync(join(ROOT, 'docs/ROADMAP.md'), 'utf8');
  const claimDir = join(ROOT, 'docs/item-numbers');
  const claims = new Set(readdirSync(claimDir).filter((f) => /^[A-Z]+-\d+\.md$/.test(f)).map((f) => f.replace(/\.md$/, '')));
  const built = new Set();
  for (const l of (itemText('BUILT', treeSource(ROOT)) || '').split('\n')) {
    const m = /^## (?:§)?(\d+)(?:\s*[—–-]\s*|\.[ \t]*|\s+)/.exec(l);
    if (m) built.add(Number(m[1]));
  }
  const todo = new Map();
  for (const l of (itemText('TODO', treeSource(ROOT)) || '').split('\n')) {
    const m = /^## (\d+)\.[ \t]*(.*)$/.exec(l);
    if (m) todo.set(Number(m[1]), m[2]);
  }
  const branches = new Map();
  const out = execFileSync('git', ['for-each-ref', '--format=%(refname) %(committerdate:unix)', 'refs/heads', 'refs/remotes/origin'],
    { cwd: ROOT, encoding: 'utf8' });
  for (const l of out.split('\n').filter(Boolean)) {
    const [ref, ts] = l.split(' ');
    const name = ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/origin\//, '');
    branches.set(name, Math.max(branches.get(name) || 0, Number(ts)));
  }
  return { doc, claims, built, todo, branches, now: Number(process.env.NOW) || Math.floor(Date.now() / 1000) };
}

// ---- the control: every defect planted must be caught ----------------------

function selfTest() {
  const now = 1_800_000_000;
  const day = 86400;
  const wrap = (rows, stopped = '') => `<!-- roadmap:rows -->
| Item | What | Status | Branch | Since |
|---|---|---|---|---|
${rows}
<!-- /roadmap:rows -->
<!-- roadmap:stopped -->
| Item | What | Why it stopped | Stopped |
|---|---|---|---|
${stopped}
<!-- /roadmap:stopped -->`;
  const good = '| §900 | A thing | Started | `feat/a` | 2027-01-01 |';
  const base = {
    claims: new Set(['BUILT-0900', 'TODO-0050']),
    built: new Set([1]),
    todo: new Map([[50, 'An open item'], [51, 'A done item — CLOSED (§5)']]),
    branches: new Map([['feat/a', now - day], ['feat/old', now - 9 * day]]),
    now,
  };
  const cases = [
    ['control: a clean row passes', wrap(good), (r) => r.failures.length === 0 && r.stale.length === 0],
    ['empty tables pass', wrap(''), (r) => r.failures.length === 0],
    ['unclaimed number', wrap(good.replace('§900', '§901')), (r) => r.failures.some((f) => /no claim file/.test(f))],
    ['shipped §', wrap('| §1 | A thing | Started | `feat/a` | 2027-01-01 |'), (r) => r.failures.some((f) => /already has a docs\/BUILT/.test(f))],
    ['"Continues" waives a partial ship', wrap('| §1 | A thing | Continues: part two | `feat/a` | 2027-01-01 |'), (r) => !r.failures.some((f) => /already has a docs\/BUILT/.test(f))],
    ['closed TODO', wrap('| TODO 51 | A thing | Started | `feat/a` | 2027-01-01 |'), (r) => r.failures.some((f) => /CLOSED/.test(f))],
    ['missing TODO', wrap('| TODO 52 | A thing | Started | `feat/a` | 2027-01-01 |'), (r) => r.failures.some((f) => /no item 52/.test(f))],
    ['missing branch', wrap(good.replace('feat/a', 'feat/gone')), (r) => r.failures.some((f) => /does not exist/.test(f))],
    ['stale branch is reported, not failed', wrap(good.replace('feat/a', 'feat/old')), (r) => r.stale.length === 1 && !r.failures.some((f) => /feat\/old/.test(f))],
    ['duplicate row', wrap(`${good}\n${good}`), (r) => r.failures.some((f) => /twice/.test(f))],
    ['malformed row', wrap('| §900 | only three | cells |'), (r) => r.failures.some((f) => /want 5/.test(f))],
    ['bad id', wrap(good.replace('§900', 'item 900')), (r) => r.failures.some((f) => /must be "§N"/.test(f))],
    ['bad date', wrap(good.replace('2027-01-01', 'soon')), (r) => r.failures.some((f) => /YYYY-MM-DD/.test(f))],
    ['private marker', wrap(good.replace('A thing', 'Feasibility · medium')), (r) => r.failures.some((f) => /private-roadmap/.test(f))],
    ['pasted entry (too long)', wrap(good.replace('A thing', 'x'.repeat(MAX_CELL + 1))), (r) => r.failures.some((f) => /cap/.test(f))],
    ['stopped without a reason', wrap('', '| §900 | A thing |  | 2027-01-01 |'), (r) => r.failures.some((f) => /says why/.test(f))],
    ['both in progress and stopped', wrap(good, '| §900 | A thing | Dropped | 2027-01-01 |'), (r) => r.failures.some((f) => /also listed/.test(f))],
    ['missing block', 'nothing here', (r) => r.failures.some((f) => /no <!-- roadmap:rows/.test(f))],
  ];
  let bad = 0;
  for (const [name, doc, ok] of cases) {
    const r = check({ ...base, doc });
    const pass = ok(r);
    if (!pass) bad++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  }
  console.log(bad ? `\n${bad} control(s) FAILED — the gate is not catching what it claims to` : `\nall ${cases.length} controls pass`);
  return bad === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  if (!existsSync(join(ROOT, 'docs/ROADMAP.md'))) { console.error('docs/ROADMAP.md is missing'); process.exit(1); }
  const r = check(readTree());
  const gateStale = argv.includes('--gate-stale');
  console.log(`roadmap: ${r.rows} in progress, ${r.stopped} stopped`);
  for (const s of r.stale) console.log(`${gateStale ? 'FAIL' : 'STALE (reported)'}  ${s}`);
  for (const f of r.failures) console.log(`FAIL  ${f}`);
  process.exit(r.failures.length || (gateStale && r.stale.length) ? 1 : 0);
}
