// §152 — THE FRESH/PAYLOAD BOUNDARY, MEASURED AND INDUCED.
//
// CHECK_CODE_FILES makes one claim: a stored row may be inherited only when
// the code that PRODUCED it is unchanged. Digesting the whole harness made
// that claim true and made it expensive, because most of ci-battery.mjs runs
// FRESH every run — the spec boots, the paths-ignore gate, the anchors, the
// partition, the cost column, the logging — and nothing any of it produces is
// ever stored for a later run to inherit. Splitting the digested side out
// (tools/battery-checks.mjs) narrows the claim to what it was always about.
//
// A narrowing is a soundness argument, so it is measured rather than asserted,
// three ways:
//
//   (a) HISTORY — over the last N first-parent merges, how many harness diffs
//       fall entirely in fresh regions, judged against each commit's OWN file
//       versions. Two numbers come out: what the split recovers standing
//       alone, and how much of roadmap §152 Landing 4's ceiling it unblocks.
//   (b) SENSITIVITY, INDUCED — patch a cost and no digested file's hash may
//       move; patch a check's opts and one must. Both directions, in the
//       tree, restored in a finally.
//   (c) THE COSTS ASSERTS — the column and the battery are two lists in two
//       files now, so assertCosts is what keeps them one. It must pass the
//       shipped tables and throw on each way they can drift.
//
// Node only, no browser, seconds to run:
//
//   node tools/probe-152-fresh.mjs [N]      (default 84 first-parent commits)
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BATTERY } from './battery-checks.mjs';
import { assertCosts } from './battery-split.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(TOOLS, '..');
const N = Number(process.argv[2] || 84);
// stderr is piped rather than inherited: `git show` at a revision predating a
// file is an EXPECTED outcome here (showOrNull below), and its fatal line on
// the console would read like a probe failure.
const git = (cmd) => execSync(`git ${cmd}`,
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const fail = [];

// ---- (a) HISTORY ---------------------------------------------------------
//
// The harness as it was for the whole window measured — battery-checks.mjs did
// not exist, so a historical diff cannot touch it.
const HARNESS = ['tools/ci-battery.mjs', 'tools/battery-split.mjs', 'tools/battery-union.mjs'];

// What counted as PAYLOAD in that era, per file, judged against the version of
// the file the commit itself had. Everything else in the harness is fresh.
//
//   · ci-battery.mjs — the BATTERY table (what a check is asked to compute),
//     runCheck (the in-page protocol that computes it) and virginBoot (the
//     boot it is measured on). Exactly what §152's third landing moved out.
//   · battery-split.mjs — all of it, EXCEPT the measured `ms:` values inside
//     INSPECTION_SLICES: the merge reassembles a payload and the slice facts
//     decide what is swept, but the cost column is wall clock.
//   · battery-union.mjs — all of it. It shapes the merged payload every gate
//     then reads, which is why the same landing put it on the digest list.
//
// A side that cannot be read counts as payload: an unreadable file is an
// uncertainty, and every uncertainty here resolves towards voiding the key.
function payloadTest(file, src) {
  if (src === null) return () => true;
  const lines = src.split('\n');
  if (file === 'tools/battery-union.mjs') return () => true;
  if (file === 'tools/battery-split.mjs') {
    const fresh = new Set();
    let inSlices = false;
    for (let i = 0; i < lines.length; i++) {
      if (/const INSPECTION_SLICES = \[/.test(lines[i])) inSlices = true;
      else if (inSlices && /^\];/.test(lines[i])) inSlices = false;
      if (inSlices && /\bms:\s*\d+/.test(lines[i])) fresh.add(i + 1);
    }
    return (n) => !fresh.has(n);
  }
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^const BATTERY = \[|^async function runCheck\(|^async function virginBoot\(/.test(lines[i])) continue;
    for (let j = i; j < lines.length; j++) {
      if (/^[\]}];?$/.test(lines[j])) { ranges.push([i + 1, j + 1]); i = j; break; }
    }
  }
  return (n) => ranges.some(([a, b]) => n >= a && n <= b);
}

// Line ranges of every top-level ALL-CAPS declaration whose value is an array
// or object literal — probe-152-tables.mjs's classifier, replicated rather
// than imported because that file runs its measurement at import. Keep the two
// in step: this probe's Landing-4 number is only comparable to that probe's
// ceiling if both classify an inspect.js diff the same way.
function tableRanges(src) {
  const lines = src.split('\n');
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^(export )?const [A-Z][A-Z_0-9]* = [[{]/.test(lines[i])) continue;
    for (let j = i; j < lines.length; j++) {
      if (/^[\]}]\)?;/.test(lines[j])) { ranges.push([i + 1, j + 1]); i = j; break; }
    }
  }
  return ranges;
}
const inRange = (ranges, n) => ranges.some(([a, b]) => n >= a && n <= b);

// Changed line numbers on both sides, from a zero-context diff.
function changedLines(sha, parent, file) {
  const d = git(`diff -U0 ${parent} ${sha} -- ${file}`);
  const oldL = [], newL = [];
  for (const m of d.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const [, oa, oc, na, nc] = m;
    for (let k = 0; k < (oc === undefined ? 1 : Number(oc)); k++) oldL.push(Number(oa) + k);
    for (let k = 0; k < (nc === undefined ? 1 : Number(nc)); k++) newL.push(Number(na) + k);
  }
  return { oldL, newL };
}
const showOrNull = (rev, file) => { try { return git(`show ${rev}:${file}`); } catch { return null; } };

const commits = git('log --first-parent --format="%H|%ad|%s" --date=short HEAD')
  .trim().split('\n').slice(0, N);

let harnessTouching = 0, harnessOnly = 0, recoverable = 0;
let tablePlusHarness = 0, landing4 = 0;
const rows = [];
for (const line of commits) {
  const [sha, date, ...rest] = line.split('|');
  const files = git(`diff-tree -m --first-parent --no-commit-id --name-only -r ${sha}`).trim().split('\n');
  const touched = HARNESS.filter((f) => files.includes(f));
  if (!touched.length) continue;
  harnessTouching++;
  const parent = git(`rev-parse ${sha}^1`).trim();

  // Fresh iff EVERY changed line on BOTH sides misses every payload region.
  let freshOnly = true;
  const where = [];
  for (const f of touched) {
    const { oldL, newL } = changedLines(sha, parent, f);
    const wasPayload = payloadTest(f, showOrNull(parent, f));
    const isPayload = payloadTest(f, showOrNull(sha, f));
    const hits = oldL.filter(wasPayload).length + newL.filter(isPayload).length;
    if (hits) { freshOnly = false; where.push(`${f.replace('tools/', '')}:${hits}L payload`); }
  }

  const alsoInspect = files.includes('src/inspect.js');
  if (!alsoInspect) { harnessOnly++; if (freshOnly) recoverable++; }
  else {
    // probe-152-tables.mjs's TABLE+HARNESS class: an inspect.js diff that
    // falls entirely inside a top-level declaration table, on a merge that
    // also moved the harness. That merge recovered nothing before, because
    // the harness voided the key just as completely; it recovers whatever
    // Landing 4 recovers as soon as its harness diff is fresh-only.
    const { oldL, newL } = changedLines(sha, parent, 'src/inspect.js');
    const oldR = tableRanges(showOrNull(parent, 'src/inspect.js') ?? '');
    const newR = tableRanges(showOrNull(sha, 'src/inspect.js') ?? '');
    const tableOnly = oldL.every((n) => inRange(oldR, n)) && newL.every((n) => inRange(newR, n));
    if (tableOnly) { tablePlusHarness++; if (freshOnly) landing4++; }
  }
  rows.push({ date, cls: freshOnly ? 'FRESH' : 'PAYLOAD',
    with: alsoInspect ? '+inspect.js' : 'harness-only',
    why: where.join(' ') || '—', subject: rest.join('|').slice(0, 44) });
}

console.log('(a) HISTORY — how a harness diff would be classified by the split\n');
for (const r of rows) {
  console.log(`${r.date} ${r.cls.padEnd(7)} ${r.with.padEnd(12)} ${r.why.padEnd(28)} ${r.subject}`);
}
console.log(`\n${commits.length} first-parent merges read; ${harnessTouching} touch the harness `
  + `(${HARNESS.map((f) => f.replace('tools/', '')).join(', ')})`);
console.log(`RECOVERED STANDING ALONE: ${recoverable} of ${harnessOnly} harness-only merges have an `
  + 'entirely FRESH harness diff');
console.log('  definition: the merge touches no src/inspect.js, and every changed harness line falls '
  + 'outside that era\'s BATTERY / runCheck / virginBoot, outside battery-union.mjs, and outside '
  + 'battery-split.mjs except its `ms:` values — so nothing it changed can stale a stored row.');
console.log(`LANDING 4 COMPOSITION: ${landing4} of ${tablePlusHarness} TABLE+HARNESS merges have an `
  + 'entirely FRESH harness diff');
console.log('  definition: probe-152-tables.mjs counts these as recovering nothing because the harness '
  + 'voided the key too; the ones counted here stop doing so, and become table-only-equivalent the '
  + 'moment Landing 4 splits inspect.js\'s tables out.');

// ---- (b) DIGEST SENSITIVITY, INDUCED -------------------------------------
//
// The list is READ from ci-battery.mjs rather than restated here, so this
// probe cannot drift from the harness it is measuring — and a regex that stops
// matching yields an empty list, which would compare clean and pass for that
// reason alone (the paths-ignore gate's own failure mode). So an unreadable
// list is a hard failure, not an empty one.
function checkCodeFiles() {
  const src = readFileSync(join(TOOLS, 'ci-battery.mjs'), 'utf8');
  const m = src.match(/const CHECK_CODE_FILES = \[([\s\S]*?)\];/);
  const files = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  if (!files.length) throw new Error('ci-battery.mjs: CHECK_CODE_FILES did not parse — this probe would then compare nothing and pass for that reason alone');
  return files;
}
const CHECK_CODE_FILES = checkCodeFiles();
const digest = () => Object.fromEntries(CHECK_CODE_FILES.map((f) =>
  [f, createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex')]));

// Patch in place and restore in a finally: the point is to measure the real
// files the harness hashes, and a probe that leaves the tree edited would be
// worse than no probe.
function withPatch(file, patch, fn) {
  const path = join(TOOLS, file);
  const before = readFileSync(path, 'utf8');
  const after = patch(before);
  if (after === before) throw new Error(`${file}: the patch matched nothing — this case measures nothing`);
  try { writeFileSync(path, after); return fn(); } finally { writeFileSync(path, before); }
}

console.log('\n(b) DIGEST SENSITIVITY, induced\n');
const base = digest();

// A cost refresh — the recurring harness edit this landing exists for. It must
// move NO digested hash.
{
  const after = withPatch('ci-battery.mjs',
    (s) => s.replace(/^(\s*'support': )(\d+)(,)$/m, (_, a, n, c) => `${a}${Number(n) + 1}${c}`),
    digest);
  const moved = CHECK_CODE_FILES.filter((f) => after[f] !== base[f]);
  console.log(`  COSTS['support'] +1  →  ${moved.length ? `MOVED ${moved.join(', ')}` : 'no digested file moved'}`);
  if (moved.length) fail.push({ case: 'cost refresh', why: `it moved ${moved.join(', ')} — a cost is wall clock, never a verdict, and must not void a stored row` });
}

// A check's opts — what the sweep is asked to compute. It must move exactly
// the file that carries it.
{
  const after = withPatch('battery-checks.mjs',
    (s) => s.replace(/^export const YIELD_EVERY = 64;$/m, 'export const YIELD_EVERY = 65;'),
    digest);
  const moved = CHECK_CODE_FILES.filter((f) => after[f] !== base[f]);
  console.log(`  yieldEvery 64 → 65   →  ${moved.length ? `MOVED ${moved.join(', ')}` : 'NOTHING MOVED'}`);
  if (!moved.includes('tools/battery-checks.mjs')) {
    fail.push({ case: 'opts edit', why: 'it did not move tools/battery-checks.mjs — an edit to what a check computes must void every stored row' });
  }
}

// And the tree is back exactly as it was, which is worth checking rather than
// trusting: everything above hashed a file this probe had rewritten.
{
  const now = digest();
  const drift = CHECK_CODE_FILES.filter((f) => now[f] !== base[f]);
  console.log(`  restored             →  ${drift.length ? `STILL PATCHED: ${drift.join(', ')}` : 'every digested file back to its original bytes'}`);
  if (drift.length) fail.push({ case: 'restore', why: `the probe left ${drift.join(', ')} edited` });
}

// ---- (c) THE COSTS ASSERTS -----------------------------------------------
//
// COSTS is a plain literal on purpose, so it can be read from source here the
// way the file list is: the shipped column, not a copy of it.
function shippedCosts() {
  const src = readFileSync(join(TOOLS, 'ci-battery.mjs'), 'utf8');
  const m = src.match(/^const COSTS = \{$([\s\S]*?)^\};$/m);
  if (!m) throw new Error('ci-battery.mjs: COSTS did not parse — this probe would then check an empty table');
  return new Function(`return {${m[1]}};`)();
}
const COSTS = shippedCosts();

console.log('\n(c) THE COSTS ASSERTS\n');
const threw = (what, mutate) => {
  const c = { ...COSTS };
  mutate(c);
  let err = null;
  try { assertCosts(BATTERY, c); } catch (e) { err = e.message; }
  console.log(`  ${what.padEnd(34)} ${err ? `throws — ${err}` : 'DID NOT THROW'}`);
  if (!err) fail.push({ case: what, why: 'assertCosts accepted a table it must refuse' });
};
{
  let err = null;
  try { assertCosts(BATTERY, COSTS); } catch (e) { err = e.message; }
  console.log(`  the shipped tables                 ${err ? `THREW — ${err}` : 'pass'}`);
  if (err) fail.push({ case: 'shipped tables', why: err });
}
threw('a check with no cost', (c) => { delete c.support; });
threw('a cost naming no check', (c) => { c.notACheck = 1; });
threw('a slice cost naming no axis', (c) => { c['inspection:notAnAxis'] = 1; });
threw('a slice cost on an unsliced check', (c) => { c['clearances:crown'] = 1; });
console.log(`  ${Object.keys(COSTS).length} cost rows over ${BATTERY.length} checks`);

if (fail.length) { console.error('\nFAILED:', JSON.stringify(fail, null, 1)); process.exitCode = 1; }
else console.log('\nPASS — a cost refresh cannot void the key, an opts edit does, and the column is held to the battery');
