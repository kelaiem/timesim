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
import { judgeSurface, judgeInventory, ARRIVAL_UNTRANSLATED } from './locale-surfaces.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const none = {};   // an inventory with no arrival debt: the thin locale owes zero

// Stubs for a browser module, as l10n-review-packets.mjs does.
const el = { setAttribute() {}, getAttribute() { return null; }, style: {}, classList: { add() {}, remove() {}, toggle() {} } };
globalThis.location = { search: '', href: 'http://localhost/', hash: '', pathname: '/' };
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'], language: 'en' }, configurable: true });
globalThis.document = { documentElement: el, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, createElement() { return el; }, body: el };
globalThis.window = globalThis;
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.addEventListener = () => {};

// 1. Undeclared must be EMPTY. The pair: one stray block fails, none passes.
const thin = (n) => judgeSurface({ page: 'explain', lang: 'xx', surfaces: ['chrome'], live: 100, translated: 0, tableSize: n, arrival: none });
check("chrome-only locale with one explainer block translated FAILS as stale", thin(1).problems.length === 1 && /STALE/.test(thin(1).problems[0]));
check('the same locale with the block removed passes', thin(0).problems.length === 0, thin(0).verdict);

// 2. Declared must be complete. 99% fails; 100% passes; an empty table fails.
const full = (live, translated, size, arrival = none) => judgeSurface({ page: 'primer', lang: 'xx', surfaces: ['chrome', 'primer'], live, translated, tableSize: size, arrival });
check('a declared primer at 99% FAILS', full(100, 99, 99).problems.length === 1);
check('a declared primer at 100% passes', full(100, 100, 100).problems.length === 0);
check('a declared primer with an empty table FAILS', full(100, 0, 0).problems.length >= 1);
check('declaring primer does not declare explainer: an explainer table under chrome+primer is stale',
  judgeSurface({ page: 'explain', lang: 'xx', surfaces: ['chrome', 'primer'], live: 10, translated: 3, tableSize: 3, arrival: none }).problems.length === 1);

// 3. The arrival inventory is a RATCHET: over it fails, under it is stale, on it passes.
const inv = { explain: { xx: 5 } };
const ex = (translated) => judgeSurface({ page: 'explain', lang: 'xx', surfaces: ['chrome', 'primer', 'explainer'], live: 100, translated, tableSize: 90, arrival: inv });
check('on the arrival inventory passes', ex(95).problems.length === 0, ex(95).verdict);
check('one NEW untranslated block over the inventory FAILS', ex(94).problems.length === 1);
check('a block translated UNDER the inventory is stale debt and FAILS', ex(96).problems.length === 1 && /STALE DEBT/.test(ex(96).problems[0]));

// 4. The inventory's own rows must name real locales and live debt (needs the roster).
const { LOCALES, SURFACES, surfacesOf } = await import(join(ROOT, 'src/i18n.js'));
const codes = LOCALES.filter((L) => L.code !== 'en').map((L) => L.code);
check('inventory names only listed locales, no zero rows', judgeInventory(codes).length === 0, judgeInventory(codes).join('; '));
check('control: an inventory row for a locale LOCALES lacks FAILS', judgeInventory(codes, { explain: { zz: 3 } }).length === 1);
check('control: a zeroed inventory row FAILS', judgeInventory(codes, { explain: { de: 0 } }).length === 1);

// 5. The roster: every shipped row carries all three surfaces, by omission.
const thinRows = LOCALES.filter((L) => L.surfaces);
check('every shipped LOCALES row declares all three surfaces', LOCALES.every((L) => SURFACES.every((s) => surfacesOf(L.code).includes(s))) && thinRows.length === 0,
  `${LOCALES.length} rows, ${thinRows.length} with an explicit declaration`);
check('the inventory covers exactly the explainer locales whose pages it measured', Object.keys(ARRIVAL_UNTRANSLATED.explain).length === codes.length);

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
