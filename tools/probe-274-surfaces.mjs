#!/usr/bin/env node
// §274 — DO THE DECLARED-SURFACE GATES MEASURE ANYTHING? Pure Node, no browser.
//
// tools/locale-surfaces.mjs judges a locale's `surfaces` declaration both ways,
// and a gate nobody has seen fire is a comment. This plants the defects and
// requires each to be caught, and the clean twin of each to pass — the
// undeclared-must-be-empty half is proved by the SAME planted locale with the
// block removed, so the failure is attributable to the block and to nothing else.
//
//   node tools/probe-274-surfaces.mjs
//
// Also holds the roster: every shipped LOCALES row declares all three surfaces
// (by omission), and src/i18n.js's boot assert fires on a bad declaration.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeSurface } from './locale-surfaces.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// Stubs for a browser module, as l10n-review-packets.mjs does.
const el = { setAttribute() {}, getAttribute() { return null; }, style: {}, classList: { add() {}, remove() {}, toggle() {} } };
globalThis.location = { search: '', href: 'http://localhost/', hash: '', pathname: '/' };
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'], language: 'en' }, configurable: true });
globalThis.document = { documentElement: el, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, createElement() { return el; }, body: el };
globalThis.window = globalThis;
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.addEventListener = () => {};

// 1. Undeclared must be EMPTY. The pair: one stray block fails, none passes.
const thin = (n, page = 'explain') => judgeSurface({ page, lang: 'xx', surfaces: ['chrome'], live: 100, translated: 0, tableSize: n });
check("chrome-only locale with one explainer block translated FAILS as stale", thin(1).problems.length === 1 && /STALE/.test(thin(1).problems[0]));
check('the same locale with the block removed passes', thin(0).problems.length === 0, thin(0).verdict);
check('the same holds for an undeclared primer', thin(1, 'primer').problems.length === 1 && thin(0, 'primer').problems.length === 0);

// 2. An ESSENTIAL page (the primer) is complete when declared. 99% fails; 100% passes; empty fails.
const pr = (live, translated, size) => judgeSurface({ page: 'primer', lang: 'xx', surfaces: ['chrome', 'primer'], live, translated, tableSize: size });
check('a declared primer at 99% FAILS', pr(100, 99, 99).problems.length === 1);
check('a declared primer at 100% passes', pr(100, 100, 100).problems.length === 0);
check('a declared primer with an empty table FAILS', pr(100, 0, 0).problems.length >= 1);

// 3. The EXPLAINER is partial-OK: a stated gap is reported, never a failure, but an empty table is not a translation.
const ex = (live, translated, size) => judgeSurface({ page: 'explain', lang: 'xx', surfaces: ['chrome', 'explainer'], live, translated, tableSize: size });
check('a declared explainer at 90% passes, and says what is untranslated', ex(100, 90, 90).problems.length === 0 && /10 of 100/.test(ex(100, 90, 90).verdict), ex(100, 90, 90).verdict);
check('a declared explainer with an empty table FAILS', ex(100, 0, 0).problems.length >= 1);
check('declaring the primer does not declare the explainer: an explainer table under chrome+primer is stale',
  judgeSurface({ page: 'explain', lang: 'xx', surfaces: ['chrome', 'primer'], live: 10, translated: 3, tableSize: 3 }).problems.length === 1);

// 4. The roster needs the module graph's globals.
const { LOCALES, SURFACES, surfacesOf } = await import(join(ROOT, 'src/i18n.js'));

// 5. The roster: every shipped row carries all three surfaces, by omission.
const thinRows = LOCALES.filter((L) => L.surfaces);
check('every shipped LOCALES row declares all three surfaces', LOCALES.every((L) => SURFACES.every((s) => surfacesOf(L.code).includes(s))) && thinRows.length === 0,
  `${LOCALES.length} rows, ${thinRows.length} with an explicit declaration`);

// 6. The boot assert fires on a bad declaration (a copy of i18n.js with one row edited).
const src = readFileSync(join(ROOT, 'src/i18n.js'), 'utf8');
const warns = async (edit, tag) => {
  const f = join(ROOT, 'src', `i18n.__probe274_${tag}.js`);
  writeFileSync(f, edit(src));
  const seen = [], w = console.warn; console.warn = (m) => seen.push(String(m));
  try { await import(f); } finally { console.warn = w; rmSync(f, { force: true }); }
  return seen.filter((m) => /surfaces/.test(m));
};
const deRow = "{ code: 'de', face: 'Deutsch',";
check('control: the shipped file boots with no surfaces warning', (await warns((s) => s, 'clean')).length === 0);
check("a row naming an unknown surface warns", (await warns((s) => s.replace(deRow, `{ code: 'de', surfaces: ['chrome', 'poster'], face: 'Deutsch',`), 'bad')).length === 1);
check("a row that drops the chrome warns", (await warns((s) => s.replace(deRow, `{ code: 'de', surfaces: ['primer'], face: 'Deutsch',`), 'nochrome')).length === 1);
check("a chrome-first row (['chrome']) is legal and silent", (await warns((s) => s.replace(deRow, `{ code: 'de', surfaces: ['chrome'], face: 'Deutsch',`), 'thin')).length === 0);

console.log(failed ? `\nFAIL — ${failed} control(s)` : '\nPASS — every planted defect is caught and every clean twin passes');
process.exit(failed ? 1 : 0);
