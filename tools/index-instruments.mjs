// THE INSTRUMENT INDEX — generated from the probes' own headers, never typed.
//
// WHY THIS EXISTS. `tools/` holds 119 scripts and CLAUDE.md names 14. The rest
// are named for the SECTION that produced them (`probe-106-stud.mjs`), which
// records WHEN a question was asked and not WHAT it answers — so you find one
// only if you already know which § went looking. Measured: `probe-106-stud`
// has exactly one commit in its history. Written, used once, never found
// again.
//
// That is not a tidiness problem. §173 rebuilt `probe-106-stud`'s free-disc
// stud scan from scratch, badly, twice — and its first cut left the plates in
// the obstacle set, which ranked the candidate positions over the plate's
// CUTAWAY as the roomiest, the exact inverse of the question. The header of
// the probe it did not find warns about that class of error in its own words.
//
// GENERATED, NOT MAINTAINED. A hand-written index is a second thing to keep
// true, and this repo has enough of those. The summary is each file's own
// leading comment, verbatim — so it is the author's words, and a probe whose
// header is silent shows up as silent rather than being described by someone
// who did not write it.
//
//   node tools/index-instruments.mjs            # write tools/INDEX.md
//   node tools/index-instruments.mjs --check    # fail if it is stale
//
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'INDEX.md');

// The leading comment block, unwrapped to one line. Stops at the first line
// that is not a `//` comment, which is where every one of these files starts
// its imports.
const header = (src) => {
  const out = [];
  let lines = src.split('\n');
  // A shebang comes BEFORE the header, and stopping on it reported eight
  // files — `ci-battery.mjs` among them — as having nothing to say about
  // themselves when each carries a full one. Silence is the honest answer for
  // a file with no header; it is a lie about a file that has one.
  if (lines[0] && lines[0].startsWith('#!')) lines = lines.slice(1);
  for (const line of lines) {
    if (!line.startsWith('//')) break;
    out.push(line.replace(/^\/\/ ?/, '').trim());
  }
  // Blank comment lines are paragraph breaks; the first paragraph is the claim.
  const first = [];
  for (const l of out) { if (!l && first.length) break; if (l) first.push(l); }
  return first.join(' ').replace(/\s+/g, ' ').trim();
};

// THE CATALOGUE DESCRIBES THE REPOSITORY, NOT THE WORKING DIRECTORY. This
// walked the directory, so anything a contributor left lying about got a row —
// and `.gitignore` already reserves `tools/_*.mjs` for exactly that scratch
// work. The failure is not cosmetic and it is not local: the index is
// regenerated here, committed, and then `--check` re-derives it on a runner
// that never had the scratch file, so the row is missing on one side and the
// job fails as STALE. Which is what happened — a throwaway `_boot-diag.mjs`
// used to chase a port collision rode into INDEX.md and reddened CI on a PR
// whose own local `--check` passed, because locally the file was still there.
//
// So ask git what it tracks. `--others --exclude-standard` lists untracked
// files git would keep; anything untracked AND ignored is scratch and is
// skipped. Falling back to the plain listing if git is unavailable keeps the
// tool usable outside a checkout — the old behaviour, but only as a fallback.
let ignored = new Set();
try {
  ignored = new Set(
    execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--', '.'],
      { cwd: HERE, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean),
  );
} catch { /* not a checkout, or no git — index everything, as before */ }
const files = readdirSync(HERE)
  .filter((f) => f.endsWith('.mjs') && f !== 'index-instruments.mjs' && !ignored.has(f))
  .sort();
const rows = files.map((f) => {
  const src = readFileSync(join(HERE, f), 'utf8');
  const m = /^probe-(\d+)/.exec(f);
  return {
    file: f,
    section: m ? `§${m[1]}` : '',
    // An ACCEPTANCE instrument decides and exits non-zero; a REPORT prints and
    // leaves the judgement to a reader. Choosing the wrong kind is how a
    // measurement gets mistaken for a verdict, so it is in the index.
    //
    // `process.exitCode = 1` is the OTHER way to exit non-zero, and the one an
    // instrument that prints a summary should prefer, because `process.exit()`
    // can truncate stdout mid-flush. Matching only the call misfiled seven
    // instruments as reports — five of §152's acceptance probes and
    // `ci-battery.mjs`, the battery gate itself — in the one document whose
    // job is to tell a reader which kind they are looking at.
    kind: /process\.exit\(|process\.exitCode\s*=/.test(src) ? 'acceptance' : 'report',
    summary: header(src) || '(no header — this file says nothing about what it answers)',
  };
});

const esc = (s) => s.replace(/\|/g, '\\|');
const body = [
  '<!-- GENERATED by tools/index-instruments.mjs — do not edit.',
  '     Every summary is the file\'s own leading comment. Regenerate after adding a probe;',
  '     `node tools/index-instruments.mjs --check` fails if this file is stale. -->',
  '',
  '# The instruments',
  '',
  `${rows.length} scripts. **${rows.filter((r) => r.kind === 'acceptance').length} are ACCEPTANCE tests** — they decide and exit non-zero.`,
  `**${rows.filter((r) => r.kind === 'report').length} are REPORTS** — they print and leave the judgement to you. Choosing the wrong kind is how`,
  'a measurement gets mistaken for a verdict.',
  '',
  '**Grep this file by what you want to know, not by section number.** The names encode',
  'when a question was asked; the summaries are what it answered.',
  '',
  '| instrument | § | kind | what it answers, in its own words |',
  '|---|---|---|---|',
  ...rows.map((r) => `| \`${r.file}\` | ${r.section} | ${r.kind} | ${esc(r.summary)} |`),
  '',
].join('\n');

if (process.argv.includes('--check')) {
  let have = null;
  try { have = readFileSync(OUT, 'utf8'); } catch { /* missing counts as stale */ }
  if (have === body) { console.log(`instrument index OK — ${rows.length} instruments`); process.exit(0); }
  console.log('instrument index is STALE — run `node tools/index-instruments.mjs`');
  if (have !== null) {
    const a = have.split('\n'), b = body.split('\n');
    const changed = b.filter((l) => !a.includes(l)).slice(0, 8);
    const gone = a.filter((l) => !b.includes(l)).slice(0, 8);
    for (const l of changed) console.log('  + ' + l.slice(0, 150));
    for (const l of gone) console.log('  - ' + l.slice(0, 150));
  }
  process.exit(1);
}
writeFileSync(OUT, body);
console.log(`wrote tools/INDEX.md — ${rows.length} instruments `
  + `(${rows.filter((r) => r.kind === 'acceptance').length} acceptance, ${rows.filter((r) => r.kind === 'report').length} report)`);
