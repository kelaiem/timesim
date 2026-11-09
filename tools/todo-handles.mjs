#!/usr/bin/env node
// TODO handles — holds docs/todo/HANDLES.md to TODO.md's generated index.
//
// A HANDLE is a two-to-four-word nickname for an item, so a conversation or a
// commit message can name one in fewer words than its title takes (TODO 293 is
// "spring tip overhang"). The number stays the permanent ID; the handle is for
// talking, not for addressing, and it lives in one file rather than in each
// item's heading because a TODO heading's title is IDENTITY to
// check-item-numbers.mjs — prefix 294 headings and that gate reads 294
// collisions — and because item-docs.mjs generates the index's Title column
// from those same headings.
//
// A naming choice has no derivation to be held to, so this gates the four
// things that CAN be held, which is what HANDLES.md's own preamble promised
// and nothing enforced:
//
//   * every item in the index has exactly ONE row here (a newly filed item
//     owes its handle, and that is the failure this tool exists for);
//   * no row names a number the index does not carry (a renumbered or deleted
//     item leaves its handle behind, pointing at nothing);
//   * every handle is UNIQUE, compared case-insensitively on collapsed
//     whitespace — two items answering to one name is the one defect that
//     makes handles worse than numbers;
//   * every handle is non-empty and at most HANDLE_WORD_MAX words. The point
//     of a handle is brevity: a sixth word is a title growing back.
//
// A missing row is reported WITH the item's title from the index, because the
// next thing anyone does about it is write a handle, and the title is what
// they need to write one.
//
// Every rule carries a CONTROL: the judge is re-run against a copy of the real
// inputs with that defect planted, and the run FAILS if the planted defect is
// not reported. A gate nobody has watched fail is a comment.
//
// An ACCEPTANCE test: exits non-zero when a rule is broken.
//
// Usage: node tools/todo-handles.mjs [--check]   (--check is the default and
// the only mode; a handle is authored, never generated, so there is no
// --write to drift out of date.)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = 'TODO.md';
const FILE = 'docs/todo/HANDLES.md';
const HANDLE_WORD_MAX = 4;

// The index's generated rows: `| [293](docs/todo/0293.md) | OPEN | Title |`.
const indexItems = (text) => {
  const out = [];
  for (const m of text.matchAll(/^\| \[(\d+)\]\(docs\/todo\/\d+\.md\)[^|]*\|([^|]*)\|(.*?)\|?\s*$/gm))
    out.push({ n: Number(m[1]), title: m[3].trim() });
  return out;
};

// HANDLES.md's own rows: `| 293 | spring tip overhang |`. The header and the
// separator are not rows, and the file's prose carries no pipes at a line head.
const handleRows = (text) => {
  const rows = [], malformed = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\|/.test(line)) continue;
    if (/^\|\s*item\s*\|/i.test(line) || /^\|[\s|:-]+\|?\s*$/.test(line)) continue;
    const m = /^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!m) { malformed.push({ line: i + 1, text: line.trim().slice(0, 72) }); continue; }
    rows.push({ n: Number(m[1]), handle: m[2], line: i + 1 });
  }
  return { rows, malformed };
};

const norm = (h) => h.toLowerCase().replace(/\s+/g, ' ').trim();

// The judge, pure over its two inputs so a control can feed it a planted copy.
function judge(items, parsed) {
  const { rows, malformed } = parsed;
  const byNum = new Map();
  const dupNums = [];
  for (const r of rows) {
    if (byNum.has(r.n)) dupNums.push({ n: r.n, line: r.line, first: byNum.get(r.n).line });
    else byNum.set(r.n, r);
  }
  const indexed = new Set(items.map((i) => i.n));
  const missing = items.filter((i) => !byNum.has(i.n)).map((i) => ({ n: i.n, title: i.title }));
  const orphans = rows.filter((r) => !indexed.has(r.n)).map((r) => ({ n: r.n, handle: r.handle, line: r.line }));
  const seen = new Map();
  const dupHandles = [];
  for (const r of rows) {
    const k = norm(r.handle);
    if (!k) continue;                       // empty is the `tooLong`/empty tier's business
    if (seen.has(k)) dupHandles.push({ handle: r.handle, n: r.n, first: seen.get(k) });
    else seen.set(k, r.n);
  }
  const empty = rows.filter((r) => !norm(r.handle)).map((r) => ({ n: r.n, line: r.line }));
  const tooLong = rows.filter((r) => norm(r.handle).split(' ').filter(Boolean).length > HANDLE_WORD_MAX)
    .map((r) => ({ n: r.n, handle: r.handle, words: norm(r.handle).split(' ').filter(Boolean).length }));
  const failures = { malformed, missing, orphans, dupNums, dupHandles, empty, tooLong };
  const total = Object.values(failures).reduce((a, x) => a + x.length, 0);
  return { ok: total === 0, total, failures, counted: rows.length, indexed: items.length };
}

const idxText = readFileSync(join(ROOT, INDEX), 'utf8');
const fileText = readFileSync(join(ROOT, FILE), 'utf8');
const items = indexItems(idxText);
if (!items.length) { console.error(`FAIL: no item rows read from ${INDEX} — the index's generated table moved, and an empty index would pass every rule below for that reason alone`); process.exit(1); }
const parsed = handleRows(fileText);
const r = judge(items, parsed);

// The controls. Each plants ONE defect in a copy and names the tier that must
// catch it; a tier that stays empty under its own planted defect is the
// failure this block exists to find.
const clone = () => ({ rows: parsed.rows.map((x) => ({ ...x })), malformed: [...parsed.malformed] });
const controls = [];
const control = (name, tier, mutate) => {
  const p = clone(); const its = items.map((x) => ({ ...x }));
  const used = mutate(p, its) ?? its;
  const got = judge(used, p);
  const caught = got.failures[tier].length > 0;
  controls.push({ name, tier, caught });
  return caught;
};
control('a dropped row', 'missing', (p) => { p.rows.shift(); });
control('a handle on a number the index does not carry', 'orphans', (p) => { p.rows.push({ n: 999999, handle: 'no such item', line: -1 }); });
control('two items under one handle', 'dupHandles', (p) => { p.rows[1].handle = p.rows[0].handle.toUpperCase(); });
control('one number twice', 'dupNums', (p) => { p.rows.push({ ...p.rows[0], line: -1 }); });
control('an empty handle', 'empty', (p) => { p.rows[0].handle = '   '; });
control('a handle a word over the ceiling', 'tooLong', (p) => { p.rows[0].handle = 'one two three four five'; });
control('a malformed table row', 'malformed', (p) => { p.malformed.push({ line: -1, text: '| not a row' }); });
const controlsOk = controls.every((c) => c.caught);

const label = {
  malformed: 'table rows that are not `| number | handle |`',
  missing: 'indexed items with no handle',
  orphans: 'handles naming a number the index does not carry',
  dupNums: 'numbers appearing twice',
  dupHandles: 'handles shared by two items',
  empty: 'empty handles',
  tooLong: `handles over ${HANDLE_WORD_MAX} words`,
};
for (const [tier, rows] of Object.entries(r.failures)) {
  if (!rows.length) continue;
  console.error(`\n${label[tier]}: ${rows.length}`);
  for (const row of rows.slice(0, 20)) console.error(`   ${JSON.stringify(row)}`);
  if (rows.length > 20) console.error(`   … and ${rows.length - 20} more`);
}
if (!controlsOk) {
  console.error('\ncontrols that did NOT fire:');
  for (const c of controls.filter((x) => !x.caught)) console.error(`   ${c.name} → ${c.tier} stayed empty`);
}
console.log(`\n${FILE}: ${r.counted} handles against ${r.indexed} indexed items`);
console.log(`controls: ${controls.filter((c) => c.caught).length}/${controls.length} planted defects caught`);
if (r.ok && controlsOk) {
  console.log(`PASS — every indexed item has exactly one handle, every handle is unique and at most ${HANDLE_WORD_MAX} words, and no handle names a number the index does not carry`);
  process.exit(0);
}
console.error(`\nFAIL: ${r.total} problem(s)${controlsOk ? '' : ' and a control that did not fire'}`);
process.exit(1);
