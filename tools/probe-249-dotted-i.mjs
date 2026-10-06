#!/usr/bin/env node
// §249 (Turkish) — DOES DISPLAY TEXT CASE-MAP IN ITS OWN LOCALE?
//
// Turkish has two i's: the capital of i is İ and the lower case of I is ı.
// JavaScript's toUpperCase / toLowerCase are locale-BLIND, so a translated
// string lowered in JS turns «KAPALI» into «kapali», and a capital raised in JS
// loses its dot. CSS text-transform is not blind — it reads the element's lang.
// Two halves, both gated:
//
//   1. THE CENSUS. Every toUpperCase / toLowerCase / toLocale*Case call in
//      src/*.js must be CLASSIFIED below, by file and by the text of its line:
//      either DISPLAY (it reaches a translated string, so it must be lowerUi /
//      a locale-aware call) or BLIND (it reads canonical English, a hex colour,
//      a locale tag or a key name, where locale-blind is the CORRECT answer — a
//      tag lowered by Turkish rules would turn 'IT' into 'ıt'). A new call
//      that matches no row FAILS, so the next site to case-map a translated
//      string has to be looked at, not merely added. A row that matches
//      nothing is STALE and fails too.
//   2. THE CSS. text-transform: uppercase on "i" under lang="tr" must render İ,
//      in an HTML box and in an SVG <text> (the plates' .lbl uppercases) —
//      measured on PIXELS against literal İ and I, because textContent never
//      shows a CSS transform. CONTROL: under lang="en" the same box must render
//      I. A probe that cannot tell the two apart measured nothing.
//
//   node tools/probe-249-dotted-i.mjs
//
// Needs a Playwright Chromium, like ci-battery.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

// ---- 1. the census -----------------------------------------------------------
// [file, a substring of the line, class, why]
const CLASSIFIED = [
  ['src/i18n.js', 'String(s).toLocaleLowerCase(LANG_TAG)', 'DISPLAY', 'lowerUi itself — the one display-layer lowering'],
  ['src/i18n.js', "v = String(v).toLowerCase().replace(/_/g, '-')", 'BLIND', '_norm: a locale TAG, which must not lower by any locale\'s rules'],
  ['src/aesthetics.js', '`#${m[1].toLowerCase()}`', 'BLIND', 'a hex colour'],
  ['src/glossary-links.js', "'v-' + english.toLowerCase()", 'BLIND', 'an anchor id built from the canonical English term'],
  ['src/main.js', "b.dataset.state = s.toLowerCase()", 'BLIND', "the template's canonical 'On' / 'Off' becoming a data-state value"],
  ['src/main.js', "e.key.length === 1 ? e.key.toLowerCase() : e.key", 'BLIND', 'a key name matched against KEYMAP'],
  ['src/main.js', "en: `${authored || ''} ${r.path.join('.')}`.toLowerCase()", 'BLIND', "the advanced filter's ENGLISH haystack (its translated haystack is lowerUi)"],
  ['src/main.js', 'qUi = lowerUi(raw), qEn = raw.toLowerCase()', 'BLIND', "the advanced filter's query, lowered the English way for the English haystack (and by lowerUi for the other)"],
];
const CALL = /\.(?:toUpperCase|toLowerCase|toLocaleUpperCase|toLocaleLowerCase)\s*\(/;
const hits = [];
for (const f of readdirSync(join(ROOT, 'src')).filter((x) => x.endsWith('.js'))) {
  const lines = readFileSync(join(ROOT, 'src', f), 'utf8').split('\n');
  lines.forEach((l, i) => { if (CALL.test(l) && !/^\s*\/\//.test(l)) hits.push({ file: `src/${f}`, line: i + 1, text: l }); });
}
const used = new Set();
console.log(`census: ${hits.length} case-mapping call(s) in src/*.js`);
for (const h of hits) {
  const row = CLASSIFIED.find(([file, sub]) => file === h.file && h.text.includes(sub));
  if (!row) { console.log(`  UNCLASSIFIED ${h.file}:${h.line}  ${h.text.trim().slice(0, 110)}`); failed++; continue; }
  used.add(row);
  console.log(`  ${row[2].padEnd(7)} ${h.file}:${h.line}  — ${row[3]}`);
}
for (const row of CLASSIFIED) if (!used.has(row)) { console.log(`  STALE row (matches no call): ${row[0]} «${row[1]}»`); failed++; }
// the display sites reach lowerUi, never a blind call
const lowerUiUses = readFileSync(join(ROOT, 'src/main.js'), 'utf8').match(/lowerUi\(/g)?.length ?? 0;
console.log(`  lowerUi( called ${lowerUiUses} time(s) in src/main.js — the announcer, and the filter's translated haystack and query`);
if (lowerUiUses < 3) { console.log('  FAIL: fewer lowerUi sites than the three display sites'); failed++; }

// ---- 2. the CSS, on pixels ---------------------------------------------------
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 300 } });
const shot = async (html) => {
  await p.setContent(`<html><body style="margin:0;background:#fff">${html}</body></html>`);
  return p.screenshot({ clip: { x: 0, y: 0, width: 120, height: 120 } });
};
const box = (inner, lang, svg) => svg
  ? `<div lang="${lang}"><svg width="120" height="120"><text x="10" y="100" style="font:80px monospace;text-transform:uppercase">${inner}</text></svg></div>`
  : `<div lang="${lang}" style="font:80px/1 monospace;text-transform:uppercase;padding:10px">${inner}</div>`;
const same = (x, y) => Buffer.compare(x, y) === 0;
for (const svg of [false, true]) for (const lang of ['en', 'tr']) {
  const up = await shot(box('i', lang, svg)), dot = await shot(box('İ', lang, svg)), plain = await shot(box('I', lang, svg));
  const reads = same(up, dot) ? 'İ' : same(up, plain) ? 'I' : '?';
  const want = lang === 'tr' ? 'İ' : 'I';
  const what = lang === 'en' ? 'control' : 'measure';
  console.log(`${what}: ${svg ? 'svg <text>' : 'html box  '} lang=${lang} — uppercase(i) renders ${reads} (want ${want}) — ${reads === want ? 'PASS' : 'FAIL'}`);
  if (reads !== want) failed++;
}
await b.close();
console.log(failed ? '\nFAIL' : '\nPASS — every case-mapping call classified, display text lowers in its own locale, CSS dots the capital under lang="tr"');
process.exit(failed ? 1 : 0);
