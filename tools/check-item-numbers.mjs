#!/usr/bin/env node
// The item-number gate. See docs/item-numbers/README.md for why it exists.
//
// TODO.md items and docs/BUILT.md sections are permanent IDs cited from source
// comments, cross-references and commit messages. Both were allocated by
// reading `max + 1` off a branch — safe with one branch open, unsafe with two,
// because each reads the same max and neither can see the other's claim. This
// gate checks the claim files that replace that rule.
//
// It reads the BASE ref for what is already taken, so it needs origin/main
// fetched (or --base <ref>). No browser, well under a second: its own workflow
// rather than a battery step, the same reasoning explain-i18n.yml gives.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const CLAIMS = join(ROOT, 'docs/item-numbers');
const argv = process.argv.slice(2);
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'origin/main';

// THE TWO DOCUMENTS DO NOT HAVE THE SAME SHAPE, and pretending they do is how
// this check would produce false failures on its first run:
//
//   TODO.md   `## 96. Title`. One heading per item, so a repeat is a genuine
//             defect and a changed title under the same number is a collision.
//
//   BUILT.md  `## §172 — Title`, plus 17 legacy pre-§ entries still written
//             `## 24. Title` (the two notations are disjoint — one sequence).
//             A § LEGITIMATELY repeats: `## §36 part one` / `part two`, and
//             `### §35 postscript`. So neither uniqueness nor title-equality
//             holds here, and only the claim rule applies.
const DOCS = {
  TODO: {
    file: 'TODO.md',
    heading: /^## (\d+)\.[ \t]*(.*)$/,
    unique: true,        // a number appearing twice is ambiguous to every citation
    titleIsIdentity: true, // same number + different title across refs = collision
  },
  BUILT: {
    file: 'docs/BUILT.md',
    heading: /^## (?:§)?(\d+)(?:\s*[—–-]\s*|\.[ \t]*|\s+)(.*)$/,
    unique: false,
    titleIsIdentity: false,
  },
};

const fail = [];
const headings = (text, re) => {
  const out = [];
  for (const line of text.split('\n')) {
    const m = re.exec(line);
    if (m) out.push({ n: Number(m[1]), title: (m[2] || '').trim() });
  }
  return out;
};
const gitShow = (ref, path) => {
  try { return execFileSync('git', ['show', `${ref}:${path}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch { return null; }
};

// ---- claim files -----------------------------------------------------------
const CLAIM_NAME = /^(TODO|BUILT)-(\d{4})\.md$/;
const claims = new Map();
if (existsSync(CLAIMS)) {
  for (const file of readdirSync(CLAIMS).sort()) {
    if (file === 'README.md') continue;
    const m = CLAIM_NAME.exec(file);
    if (!m) { fail.push(`claim file "${file}" is not <TODO|BUILT>-NNNN.md`); continue; }
    const [, ns, pad] = m;
    const body = readFileSync(join(CLAIMS, file), 'utf8');
    const num = /^number:\s*(\d+)\s*$/m.exec(body);
    const nsIn = /^namespace:\s*(\S+)\s*$/m.exec(body);
    const title = /^title:\s*(.*)$/m.exec(body);
    if (!num || !nsIn || !title) { fail.push(`claim ${file}: needs number:, namespace: and title: lines`); continue; }
    // The FILENAME is the reservation — it is what collides as an add/add in
    // git. If the body disagrees, which number was reserved is undefined.
    if (Number(num[1]) !== Number(pad)) fail.push(`claim ${file}: says number ${num[1]}, filename says ${Number(pad)}`);
    if (nsIn[1] !== ns) fail.push(`claim ${file}: says namespace ${nsIn[1]}, filename says ${ns}`);
    claims.set(`${ns} ${Number(pad)}`, { ns, n: Number(pad), file, title: title[1].trim() });
  }
}

// ---- per document ----------------------------------------------------------
let checked = 0;
for (const [ns, cfg] of Object.entries(DOCS)) {
  const path = join(ROOT, cfg.file);
  if (!existsSync(path)) { console.log(`  ${cfg.file}: absent, skipped`); continue; }
  const here = headings(readFileSync(path, 'utf8'), cfg.heading);

  if (cfg.unique) {
    const seen = new Map();
    for (const h of here) {
      if (seen.has(h.n)) fail.push(`${cfg.file}: item ${h.n} appears twice — "${seen.get(h.n)}" and "${h.title}"`);
      else seen.set(h.n, h.title);
    }
  }

  const baseText = gitShow(BASE, cfg.file);
  if (baseText === null) {
    // Refusing is the safe direction: with no base, EVERY number looks new and
    // the gate would either pass vacuously or demand claims for all of them.
    fail.push(`${cfg.file}: cannot read ${BASE}:${cfg.file}. Fetch the base (git fetch origin main) or pass --base <ref>.`);
    continue;
  }
  const base = new Map();
  for (const h of headings(baseText, cfg.heading)) if (!base.has(h.n)) base.set(h.n, h.title);

  const fresh = new Set();
  for (const h of here) {
    checked++;
    if (!base.has(h.n)) {
      // The numbers this branch INVENTS are exactly the ones that can race.
      if (!claims.has(`${ns} ${h.n}`)) fresh.add(h.n);
    } else if (cfg.titleIsIdentity && base.get(h.n) !== h.title) {
      // If the other branch merged first there is no add/add conflict left to
      // find — the base simply owns your number now. This is the only place
      // that collision still shows.
      fail.push(`${cfg.file}: item ${h.n} is "${h.title}" here but "${base.get(h.n)}" on ${BASE}. `
        + `Two different items cannot share one permanent ID — renumber this one `
        + `(node tools/claim-item.mjs --namespace ${ns} --title "${h.title}" allocates a free number) `
        + `and move its cross-references.`);
    }
  }
  for (const n of [...fresh].sort((a, b) => a - b)) {
    const h = here.find((x) => x.n === n);
    // --number, not bare: the item ALREADY has this number, and the plain
    // form would allocate the next free one and quietly disagree with it.
    fail.push(`${cfg.file}: item ${n} ("${h.title}") is new on this branch and unclaimed. `
      + `node tools/claim-item.mjs --namespace ${ns} --number ${n} --title "${h.title}"`);
  }
  const newCount = here.filter((h) => !base.has(h.n)).length;
  console.log(`  ${cfg.file}: ${here.length} heading(s), ${newCount} new on this branch`);
}

console.log(`  claims: ${claims.size}`);
if (fail.length) {
  console.error(`\nitem-numbers: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`\nitem-numbers: OK (${checked} heading(s) against ${BASE}, ${claims.size} claim(s))`);
