#!/usr/bin/env node
// Which branches are FINISHED, and so safe to delete — a REPORT for the owner,
// who deletes merged branches by hand (the repository's auto-delete is off).
// It deletes nothing and exits 0 whatever it finds, apart from a broken
// self-test or a git error.
//
//   node tools/branches-finished.mjs                 # fetch --prune, then report
//   node tools/branches-finished.mjs --no-fetch      # report on the refs this clone has
//   node tools/branches-finished.mjs --commands      # also print the delete commands (never runs them)
//   node tools/branches-finished.mjs --self-test     # plant each case, require the classifier to get it right
//
// A branch is FINISHED when all of these hold:
//   · its tip is already on main (`git branch -r --merged origin/main`), so
//     deleting it loses no commit;
//   · no in-progress row of docs/ROADMAP.md names it (that row is the
//     roadmap's word that work continues there: §349's branch was deleted
//     after its first landing and the nightly went red on it);
//   · no open pull request has it as its head, when `gh` can say so — when it
//     cannot, the report says OPEN PRS UNCHECKED rather than guessing;
//   · it is not one of KEEP, the branches the workflows use as pointers.
// Everything else is HELD BACK and the report says why, or is unmerged and
// left alone: an unmerged branch carries commits main does not have.
//
// The agent that pushed a branch declares it in its pull request's Branch line
// (.github/pull_request_template.md): "finished" or "continues (what, where)".
// This report is the check before acting on that word, not a replacement for it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roadmapBranches } from './check-roadmap.mjs';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

// Pointer branches, never finished however merged they look. `production` is
// moved only by pages.yml's promote step and is always on main's history, so
// a "merged" test alone would offer it for deletion. The self-test fails if
// pages.yml stops naming it, so this list cannot silently outlive its reason.
export const KEEP = Object.freeze({
  main: 'the default branch',
  production: 'the production site\'s pointer (.github/workflows/pages.yml moves it)',
});

// Pure, so the self-test can plant every case.
//   remote   branch names on origin
//   merged   Set of those whose tip is on main
//   rows     Map branch -> roadmap item, or null if the roadmap could not be read
//   openPRs  Map branch -> PR number, or null when unchecked
export function classify({ remote, merged, rows, openPRs }) {
  const finished = [], held = [], unmerged = [];
  for (const b of [...remote].sort()) {
    if (Object.hasOwn(KEEP, b)) { held.push({ b, why: KEEP[b] }); continue; }
    if (!merged.has(b)) { unmerged.push(b); continue; }
    if (rows === null) { held.push({ b, why: 'the roadmap could not be read' }); continue; }
    if (rows.has(b)) { held.push({ b, why: `roadmap row ${rows.get(b)} names it: work continues there` }); continue; }
    if (openPRs && openPRs.has(b)) { held.push({ b, why: `open PR #${openPRs.get(b)}` }); continue; }
    finished.push(b);
  }
  return { finished, held, unmerged };
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function readOpenPRs() {
  try {
    const out = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '500', '--json', 'number,headRefName'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Map(JSON.parse(out).map((p) => [p.headRefName, p.number]));
  } catch { return null; }
}

function selfTest() {
  const pagesNamesProduction = /\bproduction\b/.test(readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8'));
  const r = classify({
    remote: ['main', 'production', 'done', 'live-row', 'live-pr', 'unmerged'],
    merged: new Set(['main', 'production', 'done', 'live-row', 'live-pr']),
    rows: new Map([['live-row', '§900']]),
    openPRs: new Map([['live-pr', 1234]]),
  });
  const heldFor = (b) => r.held.find((h) => h.b === b)?.why || '';
  const blind = classify({ remote: ['done'], merged: new Set(['done']), rows: null, openPRs: null });
  const cases = [
    ['control: a merged branch nothing names is finished', r.finished.join() === 'done'],
    ['a branch a roadmap row names is held back', /§900/.test(heldFor('live-row'))],
    ['a branch with an open PR is held back', /#1234/.test(heldFor('live-pr'))],
    ['an unmerged branch is never offered', r.unmerged.join() === 'unmerged' && !r.finished.includes('unmerged')],
    ['main and production are never offered, however merged', /default/.test(heldFor('main')) && /production/.test(heldFor('production'))],
    ['an unreadable roadmap holds everything back', blind.finished.length === 0 && /roadmap/.test(blind.held[0]?.why || '')],
    ['pages.yml still names the production pointer KEEP protects', pagesNamesProduction],
  ];
  for (const [name, ok] of cases) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  const bad = cases.filter(([, ok]) => !ok).length;
  console.log(bad ? `\n${bad} control(s) FAILED` : `\nall ${cases.length} controls pass`);
  return bad === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  if (!argv.includes('--no-fetch')) git('fetch', '-q', '--prune', 'origin');
  const remote = git('for-each-ref', '--format=%(refname:lstrip=3)', 'refs/remotes/origin')
    .split('\n').filter((b) => b && b !== 'HEAD');
  const merged = new Set(git('branch', '-r', '--format=%(refname:lstrip=3)', '--merged', 'refs/remotes/origin/main')
    .split('\n').filter(Boolean));
  let rows = null;
  try { rows = roadmapBranches(readFileSync(join(ROOT, 'docs/ROADMAP.md'), 'utf8')); } catch { rows = null; }
  const openPRs = readOpenPRs();
  const { finished, held, unmerged } = classify({ remote, merged, rows, openPRs });

  console.log(`branches on origin: ${remote.length} — finished ${finished.length}, held back ${held.length}, unmerged ${unmerged.length}`);
  if (openPRs === null) console.log('OPEN PRS UNCHECKED — `gh` is not available or not signed in, so a merged branch with an open PR could be listed as finished');
  console.log(`\nFINISHED (on main, no roadmap row${openPRs ? ', no open PR' : ''}): safe to delete`);
  for (const b of finished) console.log(`  ${b}`);
  console.log('\nHELD BACK');
  for (const { b, why } of held) console.log(`  ${b} — ${why}`);
  console.log(`\nUNMERGED: ${unmerged.length} branch(es) with commits main does not have; not offered (git branch -r --no-merged origin/main lists them)`);
  if (argv.includes('--commands') && finished.length) {
    console.log('\n# Delete commands — review, then run them yourself:');
    for (const b of finished) console.log(`git push origin --delete ${b}`);
  }
}
