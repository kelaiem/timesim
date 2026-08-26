#!/usr/bin/env node
// Reserve the next item number, and write the claim file that reserves it.
//
//   node tools/claim-item.mjs --namespace TODO  --title "What it actually does"
//   node tools/claim-item.mjs --namespace BUILT --title "..."  [--dry-run]
//
// WHY THIS EXISTS RATHER THAN "read max + 1 yourself": that is the rule that
// collided. It reads one branch. This reads every ref it can see — both
// documents on every local and remote branch, plus every claim file on them —
// so a number another branch has already spoken for is not offered to you.
//
// It still cannot see an UNPUSHED claim on someone else's machine, and it does
// not pretend to: that residue is what the claim FILE is for. Two branches
// that both allocate 97 create the same path, and git reports an add/add
// conflict at merge — which is the signal, and the reason the claim is one
// file per number rather than a line appended to a shared ledger.
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

// Every ref we can see, not just this one. This is the whole point.
const refs = ['HEAD'];
if (!NO_REMOTE) {
  const list = git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes');
  if (list) for (const r of list.split('\n').filter(Boolean)) if (!r.endsWith('/HEAD')) refs.push(r);
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
const next = max + 1;
const pad = String(next).padStart(4, '0');
const file = join(CLAIMS, `${NS}-${pad}.md`);

console.log(`${NS}: ${taken.size} number(s) seen across ${refs.length} ref(s), high-water ${max}`);
if (existsSync(file)) { console.error(`refusing: ${file} already exists`); process.exit(1); }
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
