#!/usr/bin/env node
// §277 part F — does every locale carry the Inspect route's captions and stop
// titles, and does each keep what the English CLAIMS?
//
// WHY THIS EXISTS. The route's strings are ordinary `t()` keys, so a missing
// entry falls back to English VISIBLY and nothing else notices: the chrome-coverage
// probe reads the DOM at boot, and the route's captions are not on the glass until
// someone runs it. Rewriting a caption therefore invalidates its translation in all
// twenty-two tables without a line of them changing — the same staleness
// explain-i18n polices for the pages, with no gate here until now.
//
// WHAT IT HOLDS, per (locale, string), against the English read out of
// `INSPECT_STEPS` itself (never retyped, so editing the English fails every
// locale loudly instead of quietly):
//   PRESENT   the table has the key and it is not the English echoed back;
//   DIGITS    the multiset of digit glyphs equals the English (the numbers are the
//             evidence: 0.118, 29%, 3096, TODO 77 …), all Western, none localized;
//   TODO      the identifiers `TODO <n>` and `TODO.md` survive verbatim;
//   HONESTY   a caption asserting MODELLED carries that locale's modelled stem and
//             one asserting SIMULATED its simulated stem — `HONESTY` in
//             explain-i18n.mjs, read from its source so the two cannot drift.
// The honesty rows are what a fluent translation erases while every other check
// stays green, so the run ends with a MUTATION CONTROL: plant a changed digit, a
// dropped TODO id and a modelled→simulated swap in a copy of one locale and FAIL
// if any slips through.
//
// ACCEPTANCE: exits non-zero on any miss. Pure Node, no browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// i18n.js reads the page's location/storage at import; a stub is enough for the tables.
globalThis.location = { search: '', hash: '', href: 'http://localhost/' };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
globalThis.document = { documentElement: {}, addEventListener() {} };
const { TABLES } = await import(path.join(root, 'src/i18n.js'));

// --- the English: every title and caption in the step table, as written.
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const a = main.indexOf('const INSPECT_STEPS = [');
const b = main.indexOf('\n];', a);
if (a < 0 || b < 0) throw new Error('INSPECT_STEPS not found in src/main.js');
const EN = [...main.slice(a, b).matchAll(/\b(?:title|caption): '((?:[^'\\]|\\.)*)'/g)]
  .map((m) => m[1].replace(/\\'/g, "'"));
if (EN.length < 20) throw new Error(`read only ${EN.length} route strings — the step table changed shape`);

// --- the honesty stems, from the source that gates the pages.
const exSrc = fs.readFileSync(path.join(root, 'tools/explain-i18n.mjs'), 'utf8');
const h0 = exSrc.indexOf('const EN_MODELLED');
const h1 = exSrc.indexOf('\n};', exSrc.indexOf('const HONESTY = {')) + 3;
const HONESTY = new Function(`${exSrc.slice(h0, h1)}\nreturn HONESTY;`)();
const AR_MARKS = /[ً-ْٰـ]/g;
const EN_M = HONESTY.en.m, EN_S = HONESTY.en.s;

const digits = (s) => (s.match(/[0-9]/g) || []).sort().join('');
const strayDigits = (s) => /[٠-٩۰-۹०-९]/.test(s);
const count = (s, re) => (s.match(re) || []).length;

function judge(lang, en, tr) {
  const out = [];
  if (typeof tr !== 'string' || !tr) return ['MISSING'];
  if (tr === en && en.length > 6) return ['ENGLISH ECHO'];  // 'End' is a short shared chrome key
  if (digits(tr) !== digits(en)) out.push(`DIGITS ${digits(en)} -> ${digits(tr)}`);
  if (strayDigits(tr)) out.push('NON-WESTERN DIGITS');
  const ids = /TODO(?: \d+|\.md)/g;
  const eid = (en.match(ids) || []).sort().join('|'), tid = (tr.match(ids) || []).sort().join('|');
  if (eid !== tid) out.push(`TODO ids ${eid || '-'} -> ${tid || '-'}`);
  const row = HONESTY[lang];
  if (!row) out.push('NO HONESTY ROW (UNGATED)');
  else {
    const body = lang === 'ar' || lang === 'fa' ? tr.replace(AR_MARKS, '') : tr;
    if (EN_M.test(en) && !row.m.test(body)) out.push('dropped MODELLED');
    if (EN_S.test(en) && !row.s.test(body)) out.push('dropped SIMULATED');
  }
  return out;
}

let bad = 0, rows = 0;
const langs = Object.keys(TABLES);
for (const lang of langs) {
  const T = TABLES[lang];
  for (const en of EN) {
    rows++;
    const f = judge(lang, en, T[en]);
    if (f.length) { bad++; console.log(`FAIL ${lang} :: ${en.slice(0, 48)}…  ${f.join('; ')}`); }
  }
}

// --- mutation control: the checks must see what they claim to see.
const ctl = langs.includes('de') ? 'de' : langs[0];
const victim = EN.find((e) => EN_M.test(e) && /TODO \d+/.test(e) && /\d\.\d/.test(e));
const good = TABLES[ctl][victim];
const mutations = {
  digit: good.replace(/\d/, (d) => String((+d + 1) % 10)),
  todo: good.replace(/TODO/, 'AUFGABE'),
  honesty: good.replace(HONESTY[ctl].m, 'simul'),
  echo: victim,
};
let slipped = 0;
for (const [k, v] of Object.entries(mutations)) {
  const f = judge(ctl, victim, v);
  console.log(`  control ${k.padEnd(8)} ${f.length ? 'caught: ' + f[0] : 'SLIPPED'}`);
  if (!f.length) slipped++;
}
if (judge(ctl, victim, good).length) { console.log('  control clean copy FAILED'); slipped++; }

const nStr = EN.length;
console.log(`\n${langs.length} locales × ${nStr} strings = ${rows} rows, ${bad} failing; controls ${slipped ? 'FAIL' : 'PASS'}`);
process.exit(bad || slipped ? 1 : 0);
