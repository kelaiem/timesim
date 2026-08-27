#!/usr/bin/env node
// Reserve the next item number, and write the claim file that reserves it.
//
//   node tools/claim-item.mjs --namespace TODO  --title "What it actually does"
//   node tools/claim-item.mjs --namespace BUILT --title "..."  [--dry-run]
//   node tools/claim-item.mjs --namespace TODO  --title "..." --number 95
//
// --number claims a SPECIFIC number instead of the next one. Two cases need it
// and neither is exotic: an item written before this scheme existed and now
// being brought under it, and a renumber, where the whole point is that the
// item is moving to a number you chose. Without it the checker's own advice —
// "item 95 is unclaimed, run claim-item.mjs" — hands you 97.
//
// WHY THIS EXISTS RATHER THAN "read max + 1 yourself": that is the rule that
// collided. It reads one branch. This reads every ref — both documents on
// every local and remote branch, plus every claim file on them — so a number
// another branch has already spoken for is not offered to you.
//
// IT FETCHES FIRST, and TODO 99 is why. "Every ref we can see" used to mean
// every ref THIS CLONE HAD: the enumeration below reads refs/heads and
// refs/remotes, and nothing made those the repository's. A Claude Code session
// starts from a clone carrying the branches it needs — measured, 2 of the
// remote's 206 — and with that ref set the TODO high-water read 90 against a
// true 97. It offered 91, which another branch had claimed the same day. The
// tool was not wrong about what it had read; it was wrong about what reading
// it meant, and it said `5 ref(s)` while meaning it. A claim is a statement
// about the REPOSITORY, so it is checked against the repository.
//
// `--no-remote` is the offline escape and now skips the fetch as well as the
// remote refs. Its output says which mode ran, because a number allocated
// against a stale ref set is exactly as dangerous as it was before and the
// only difference is whether you were told.
//
// It still cannot see an UNPUSHED claim on someone else's machine, and it does
// not pretend to: that residue is what the claim FILE is for. Nor can any
// fetch close the window between one claim and the next — two branches can
// still allocate 97 seconds apart. Both land in the same place: they create
// the same path, and git reports an add/add conflict at merge — which is the
// signal, and the reason the claim is one file per number rather than a line
// appended to a shared ledger.
import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const CLAIMS = join(ROOT, 'docs/item-numbers');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const NS = (opt('--namespace', 'TODO') || '').toUpperCase();
const TITLE = opt('--title', '');
const DRY = argv.includes('--dry-run');
const WANT = argv.includes('--number') ? Number(argv[argv.indexOf('--number') + 1]) : null;
if (WANT !== null && (!Number.isInteger(WANT) || WANT < 1)) {
  console.error(`--number wants a positive integer (got "${argv[argv.indexOf('--number') + 1]}")`);
  process.exit(2);
}
const NO_REMOTE = argv.includes('--no-remote');

const DOCS = {
  TODO:  { file: 'TODO.md',        heading: /^## (\d+)\.[ \t]*(.*)$/ },
  BUILT: { file: 'docs/BUILT.md',  heading: /^## (?:§)?(\d+)(?:\s*[—–-]\s*|\.[ \t]*|\s+)(.*)$/ },
};
if (!DOCS[NS]) { console.error(`--namespace must be TODO or BUILT (got "${NS}")`); process.exit(2); }
if (!TITLE.trim()) { console.error('--title is required — a reservation nobody can identify is not one'); process.exit(2); }

const git = (...a) => {
  try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch { return null; }
};

const taken = new Map();          // number → where it was seen (first wins, for the report)
const see = (n, where) => { if (!taken.has(n)) taken.set(n, where); };

// Every ref, not just this one — and the repository's, not this clone's cache
// of it (TODO 99). Fetch before enumerating, then say what was actually
// consulted: `git ls-remote` is the repository's answer and `for-each-ref` is
// ours, and a gap between them is the failure this whole file exists to stop.
const refs = ['HEAD'];
let refNote = 'HEAD only (--no-remote)';
if (!NO_REMOTE) {
  // Best effort: an offline clone still allocates, it just says so below.
  const fetched = git('fetch', '--quiet', '--all', '--prune') !== null;
  const list = git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes');
  if (list) for (const r of list.split('\n').filter(Boolean)) if (!r.endsWith('/HEAD')) refs.push(r);
  const remote = git('ls-remote', '--heads', 'origin');
  const nRemote = remote === null ? null : remote.split('\n').filter(Boolean).length;
  const nLocal = refs.filter((r) => r.startsWith('refs/remotes/')).length;
  refNote = fetched ? 'fetched' : 'FETCH FAILED — refs may be stale';
  if (nRemote !== null && nLocal < nRemote) {
    console.error(`WARNING: this clone has ${nLocal} remote-tracking ref(s) but origin `
      + `publishes ${nRemote}. A number claimed on a short ref set can collide with one `
      + `already pushed. ${fetched ? 'The fetch did not close the gap' : 'The fetch failed'}`
      + ` — resolve it before trusting the number below.`);
  }
}

for (const [ns, cfg] of Object.entries(DOCS)) {
  if (ns !== NS) continue;
  for (const ref of refs) {
    const text = git('show', `${ref}:${cfg.file}`);
    if (!text) continue;
    for (const line of text.split('\n')) {
      const m = cfg.heading.exec(line);
      if (m) see(Number(m[1]), ref === 'HEAD' ? cfg.file : ref);
    }
  }
}
// Claim files on every ref, including ones not yet merged anywhere.
for (const ref of refs) {
  const tree = git('ls-tree', '--name-only', ref, 'docs/item-numbers/');
  if (!tree) continue;
  for (const p of tree.split('\n').filter(Boolean)) {
    const m = /(TODO|BUILT)-(\d{4})\.md$/.exec(p);
    if (m && m[1] === NS) see(Number(m[2]), `claim on ${ref === 'HEAD' ? 'this branch' : ref}`);
  }
}
// …and uncommitted ones sitting in the working tree.
if (existsSync(CLAIMS)) for (const f of readdirSync(CLAIMS)) {
  const m = /^(TODO|BUILT)-(\d{4})\.md$/.exec(f);
  if (m && m[1] === NS) see(Number(m[2]), 'claim in working tree');
}

// NEVER FILL A GAP. A missing number usually means an item was removed, and
// citations to it can outlive it — CLAUDE.md's rule for § numbers is that they
// are permanent and never reused. Allocate above the high-water mark.
const max = taken.size ? Math.max(...taken.keys()) : 0;
const next = WANT ?? max + 1;
const pad = String(next).padStart(4, '0');
const file = join(CLAIMS, `${NS}-${pad}.md`);

console.log(`${NS}: ${taken.size} number(s) seen across ${refs.length} ref(s) [${refNote}], high-water ${max}`);
if (existsSync(file)) { console.error(`refusing: ${file} already exists`); process.exit(1); }

// A SPECIFIC number is checked, not trusted. Allocating the next one cannot
// collide by construction; picking one yourself can, so say where it is
// already spoken for. The exception is the number's OWN document — an item
// that already carries this number in TODO.md/BUILT.md is exactly the
// retroactive case --number exists for, so seeing it there is not a conflict.
if (WANT !== null) {
  const where = taken.get(WANT);
  const ownDoc = where === DOCS[NS].file;
  if (where && !ownDoc) {
    console.error(`refusing: ${NS} ${WANT} is already taken (${where}).`);
    console.error(`          Pick another, or drop --number to take ${max + 1}.`);
    process.exit(1);
  }
  if (ownDoc) console.log(`  ${NS} ${WANT} already appears in ${DOCS[NS].file} — claiming it retroactively.`);
  else console.log(`  ${NS} ${WANT} is free.`);
}
if (DRY) { console.log(`would claim ${NS} ${next} → docs/item-numbers/${NS}-${pad}.md`); process.exit(0); }

mkdirSync(CLAIMS, { recursive: true });
const branch = (git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown').trim();
const today = new Date().toISOString().slice(0, 10);
writeFileSync(file, `number: ${next}
namespace: ${NS}
title: ${TITLE.trim()}
branch: ${branch}
claimed: ${today}
`);
console.log(`claimed ${NS} ${next} → docs/item-numbers/${NS}-${pad}.md`);
console.log(`Write the item as "## ${NS === 'BUILT' ? `§${next} — ` : `${next}. `}${TITLE.trim()}" and commit the claim WITH it.`);
