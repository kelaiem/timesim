// §152 Landing 4's GATE — is splitting the declaration tables out of
// src/inspect.js worth doing, or is it a refactor looking for a reason?
//
// The incremental path is available only when the CHECK CODE is unchanged, and
// probe-152-history.mjs measured what that costs: 56% of the last 80 merges
// touch src/inspect.js or the harness, so the path is available on 30%.
// src/inspect.js alone accounts for 39 of those 80.
//
// The proposed fix is structural: standing rule 3 sends every new part's
// DECLARATION into inspect.js, which is also where the sweep ENGINES live, so
// a landing that only adds a MECH_GRAPH edge or a budget row invalidates a key
// that describes code it never touched. Split the tables out and those merges
// stop voiding the engine digest.
//
// That argument is only as good as the share of inspect.js diffs it describes,
// which nobody had counted. This counts it: for every first-parent merge that
// touches src/inspect.js, does the diff fall ENTIRELY inside a top-level
// declaration table?
//
// The classification is deliberately GENEROUS to the split — a merge counts as
// table-only if every changed line lands in some ALL-CAPS top-level array or
// object literal, which is more than the tables a split would actually move.
// So the number it prints is a CEILING on what the split could recover, and a
// ceiling that does not justify the work settles the question.
//
//   node tools/probe-152-tables.mjs [N]     (default 80 first-parent commits)
import { execSync } from 'node:child_process';

const N = Number(process.argv[2] || 80);
const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Line ranges of every top-level ALL-CAPS declaration whose value is an array
// or object literal. Brace counting from the declaration line to the line that
// closes it at column zero — the file's own formatting, which is consistent
// enough for this and is checked by the fact that an unclosed declaration
// would swallow the rest of the file and make everything read as table-only.
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
function changedLines(sha, parent) {
  const d = git(`diff -U0 ${parent} ${sha} -- src/inspect.js`);
  const oldL = [], newL = [];
  for (const m of d.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const [, oa, oc, na, nc] = m;
    for (let k = 0; k < (oc === undefined ? 1 : Number(oc)); k++) oldL.push(Number(oa) + k);
    for (let k = 0; k < (nc === undefined ? 1 : Number(nc)); k++) newL.push(Number(na) + k);
  }
  return { oldL, newL };
}

const commits = git('log --first-parent --format="%H|%ad|%s" --date=short HEAD')
  .trim().split('\n').slice(0, N);
let touching = 0, tableOnly = 0, engine = 0, recoverable = 0;
const rows = [];
for (const line of commits) {
  const [sha, date, ...rest] = line.split('|');
  const files = git(`diff-tree -m --first-parent --no-commit-id --name-only -r ${sha}`).trim().split('\n');
  if (!files.includes('src/inspect.js')) continue;
  touching++;
  const parent = git(`rev-parse ${sha}^1`).trim();
  const { oldL, newL } = changedLines(sha, parent);
  const oldR = tableRanges(git(`show ${parent}:src/inspect.js`));
  const newR = tableRanges(git(`show ${sha}:src/inspect.js`));
  const only = oldL.every((n) => inRange(oldR, n)) && newL.every((n) => inRange(newR, n));
  // A table-only inspect.js diff recovers nothing if the same merge also moved
  // the HARNESS, which voids the key just as completely. Splitting the tables
  // out of one file does not split them out of the other two.
  const alsoHarness = files.some((f) => f === 'tools/ci-battery.mjs' || f === 'tools/battery-split.mjs');
  if (only) { tableOnly++; if (!alsoHarness) recoverable++; } else engine++;
  rows.push({ date, cls: only ? (alsoHarness ? 'TABLE+HARNESS' : 'TABLE-ONLY') : 'ENGINE',
    lines: oldL.length + newL.length, subject: rest.join('|').slice(0, 50) });
}
for (const r of rows) console.log(`${r.date} ${r.cls.padEnd(10)} ${String(r.lines).padStart(4)}L  ${r.subject}`);
console.log(`\n${commits.length} first-parent commits read; ${touching} touch src/inspect.js`);
console.log(`TABLE-ONLY ${tableOnly} (${(100 * tableOnly / touching).toFixed(0)}% of them) · ENGINE ${engine}`);
console.log(`of the ${tableOnly} table-only diffs, ${tableOnly - recoverable} also moved the harness `
  + '(which voids the key just as completely, so the split recovers nothing there)');
console.log(`CEILING on what the split could recover: ${recoverable} of ${commits.length} merges `
  + `= ${(100 * recoverable / commits.length).toFixed(0)} percentage points of eligibility, `
  + 'and generous — the classifier counts every ALL-CAPS top-level literal as a table, '
  + 'which is more than a split would actually move.');
