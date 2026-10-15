#!/usr/bin/env node
// §274 (the audit it left open) — DOES THE CHROME KEEP THE MODELLED / SIMULATED DISTINCTION?
//
// explain-i18n.mjs holds the HONESTY VOCABULARY on the two static pages (§241),
// but the chrome's own strings that say *modelled* or *simulated* — the
// inspection route's captions and the credit line's neighbours — were never
// read by anything: probe-chrome-coverage asks only whether a string is
// translated, and a fluent translation that renders *modelled* as *simulated*
// is translated. The same rule applies here: a CROSSED row (English asserts one
// word, the translation drops it and carries the other) FAILS; a row with
// NEITHER word is ABSENT and also fails here, because the chrome has so few of
// these strings (four) that a dropped honesty word is a finding, not noise.
//
// The stems are explain-i18n.mjs's HONESTY table, READ from that file's source
// (it is a script that boots a browser, so it cannot be imported), so the two
// readers of one vocabulary cannot drift: a locale with no row there is UNGATED
// and fails here too.
//
// The English matcher is NARROWER than the page gate's, on purpose: the page
// matcher's `models` alternative also reads the chrome's tagline "every part
// built from geometry, no models", where «models» are 3D asset files and every
// locale renders them correctly with its asset-model word. That is §241's
// narrow-matcher rule met from the other side: a matcher wide enough to swallow
// a noun reports the right translations as lost.
//
// The control is required before any locale is judged: each planted defect
// (stem swapped, word dropped, entry deleted) must be caught, so a probe that
// cannot see a crossed row passes every table.
//
//   node tools/probe-chrome-honesty.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const el = { setAttribute() {}, getAttribute() { return null; }, style: {}, classList: { add() {}, remove() {}, toggle() {} } };
globalThis.location = { search: '', href: 'http://localhost/', hash: '', pathname: '/' };
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'], language: 'en' }, configurable: true });
globalThis.document = { documentElement: el, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, createElement() { return el; }, body: el };
globalThis.window = globalThis; globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} }; globalThis.addEventListener = () => {};
const { TABLES, LOCALES } = await import(join(ROOT, 'src/i18n.js'));

const src = readFileSync(join(ROOT, 'tools/explain-i18n.mjs'), 'utf8');
const block = (start) => { const i = src.indexOf(start); if (i < 0) throw new Error(`cannot find ${start} in explain-i18n.mjs`); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 2); };
const HONESTY = new Function(`const EN_SIMULATED = /\\bsimulat/i, EN_MODELLED = /\\bmodell?(?:ed|s)\\b/i;\n${block('const HONESTY = {')}\nreturn HONESTY;`)();

const EN_M = /\bmodell?ed\b/i, EN_S = /\bsimulat/i;
const keys = Object.keys(TABLES.de).filter((k) => EN_M.test(k) || EN_S.test(k));

// → null, or the finding for one (key, translation) under one locale's stems.
const judge = (k, v, H) => {
  if (!v) return 'MISSING';
  const wantM = EN_M.test(k), wantS = EN_S.test(k), hm = H.m.test(v), hs = H.s.test(v);
  if (wantM && !wantS && !hm && hs) return 'CROSSED (modelled -> simulated)';
  if (wantS && !wantM && !hs && hm) return 'CROSSED (simulated -> modelled)';
  if ((wantM && !hm) || (wantS && !hs)) return 'ABSENT';
  return null;
};

let failed = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failed++; };
const roster = LOCALES.filter((L) => L.code !== 'en').map((L) => L.code);
if (keys.length === 0) fail('read 0 honesty-bearing chrome strings — the matcher or the table moved');

// The controls, on German and on a key that asserts each word. Swapping the word that carries the contrast reads ABSENT where the English asserts both.
const kM = keys.find((k) => EN_M.test(k) && !EN_S.test(k)), kS = keys.find((k) => EN_S.test(k));   // every chrome key that says simulated also says modelled (the contrast), so the swap reads ABSENT
const H = HONESTY.de;
const plant = [
  ['modelled stem swapped for the simulated one', kM, (v) => v.replace(/modelli\w*/gi, 'simuliert'), /CROSSED/],
  ['simulated stem swapped for the modelled one', kS, (v) => v.replace(/simul\w*/gi, 'modelliert'), /CROSSED|ABSENT/],
  ['the honesty word dropped', kM, (v) => v.replace(/modelli\w*/gi, 'beschrieben'), /ABSENT/],
  ['the entry deleted', kM, () => undefined, /MISSING/],
];
for (const [name, k, mut, want] of plant) {
  const f = k && judge(k, mut(TABLES.de[k] || ''), H);
  const ok = f && want.test(f);
  console.log(`${ok ? 'PASS' : 'FAIL'}  control: ${name} is ${ok ? f : 'NOT CAUGHT'}`);
  if (!ok) failed++;
}
const clean = keys.map((k) => judge(k, TABLES.de[k], H)).filter(Boolean);
console.log(`${clean.length ? 'FAIL' : 'PASS'}  control: the unmutated German table reads clean`);
if (clean.length) failed++;

let judged = 0;
for (const lang of roster) {
  if (!HONESTY[lang]) { fail(`[${lang}] no HONESTY row in explain-i18n.mjs — the chrome's honesty strings are UNGATED`); continue; }
  for (const k of keys) {
    judged++;
    const f = judge(k, TABLES[lang][k], HONESTY[lang]);
    if (f) fail(`[${lang}] ${f}: ${JSON.stringify(k.slice(0, 70))} -> ${JSON.stringify((TABLES[lang][k] || '').slice(0, 90))}`);
  }
}
console.log(failed ? `\nFAIL — ${failed} finding(s)` : `\nPASS — ${keys.length} honesty-bearing chrome string(s) x ${roster.length} locale(s) = ${judged} rows keep the two words apart; controls PASS`);
process.exit(failed ? 1 : 0);
