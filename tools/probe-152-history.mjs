// §152 probe four — HOW OFTEN COULD AN INCREMENTAL RUN ACTUALLY FIRE?
//
// The saving is real only on merges the incremental path can take, and the
// entry's framing ("the class of change this repo actually makes most often")
// had never been counted. Three classes, decided from the changed file set of
// each first-parent commit:
//
//   SKIP     battery.yml's own paths-ignore already skips the job entirely
//   FULL     the change touches CHECK CODE — src/inspect.js (which holds the
//            sweep engines, AXES, and every declaration table standing rule 3
//            sends a new part to) or the harness that schedules them. The
//            verdict is a function of the check code, so a changed check code
//            invalidates every stored verdict and the run must be whole
//   ELIGIBLE everything else that reaches the built scene — the class a
//            per-unit digest can restrict
//
// It is a FILE-LEVEL classification and says so: it bounds how often the
// incremental path is available, not how much any one merge would save (that
// depends on how many UNITS moved, which only a boot of both trees measures).
//
//   node tools/probe-152-history.mjs [N]     (default 80 first-parent commits)
//
// Needs enough history to be meaningful: a shallow clone will silently measure
// only what it has, so the count it read is printed with the verdict.
import { execSync } from 'node:child_process';

const N = Number(process.argv[2] || 80);
const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' });

// battery.yml's list, read from the workflow rather than restated — the same
// rule the harness's own skip-list gate follows, and for the same reason.
const yml = execSync('git show HEAD:.github/workflows/battery.yml', { encoding: 'utf8' });
const block = yml.match(/paths-ignore:\n((?:\s*-\s*'[^']*'\n)+)/);
if (!block) { console.error('could not read battery.yml paths-ignore'); process.exit(2); }
const ignored = [...block[1].matchAll(/-\s*'([^']*)'/g)].map((m) => m[1]);
const toRe = (pattern) => {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (pattern[i] === '*') re += '[^/]*';
    else re += pattern[i].replace(/[.+^${}()|[\]\\?]/, '\\$&');
  }
  return new RegExp(`^${re}$`);
};
const IGN = ignored.map(toRe);
const CHECKCODE = [/^src\/inspect\.js$/, /^tools\/ci-battery\.mjs$/, /^tools\/battery-split\.mjs$/];

const commits = git('log --first-parent --format="%H|%ad|%s" --date=short HEAD')
  .trim().split('\n').slice(0, N);
const counts = { SKIP: 0, FULL: 0, ELIGIBLE: 0 };
const rows = [];
for (const line of commits) {
  const [h, date, ...rest] = line.split('|');
  // -m --first-parent, because `git show --name-only` on a merge prints NO
  // files at all and every merge would classify as an empty change set.
  const files = git(`diff-tree -m --first-parent --no-commit-id --name-only -r ${h}`)
    .trim().split('\n').filter(Boolean);
  if (!files.length) continue;
  const cls = files.every((f) => IGN.some((r) => r.test(f))) ? 'SKIP'
    : files.some((f) => CHECKCODE.some((r) => r.test(f))) ? 'FULL' : 'ELIGIBLE';
  counts[cls]++;
  rows.push({ date, cls, files: files.length, subject: rest.join('|').slice(0, 56) });
}
const n = rows.length;
const pct = (k) => `${counts[k]} (${(100 * counts[k] / n).toFixed(0)}%)`;
for (const r of rows) console.log(`${r.date} ${r.cls.padEnd(9)} ${String(r.files).padStart(3)}f  ${r.subject}`);
console.log(`\n${n} first-parent commits read (asked for ${N})`);
console.log(`SKIP ${pct('SKIP')} · FULL, check code touched ${pct('FULL')} · ELIGIBLE ${pct('ELIGIBLE')}`);
