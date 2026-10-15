#!/usr/bin/env node
// §274 follow-up — THE RATCHET ON THE ESSENTIAL SURFACES: every locale carries every chrome key.
//
// §274 left the explainer's gap open on purpose (an allowed, reported shortfall), and the owner's
// ruling was that a ratchet, when it comes, belongs on the ESSENTIAL surfaces only: the chrome and
// the primer. Measured on arrival, neither has any debt to pin — all 22 primers are 146/146 and
// all 22 chrome tables carry the same 535 keys — so the ratchet is not an inventory of allowed
// gaps (there are none to list) but the invariant that keeps the count at zero, with nothing to
// lower. The primer half already gates in explain-i18n.mjs (a declared primer must be complete).
// The chrome half did not: probe-chrome-coverage boots every locale in a browser and is run by
// hand, "not in a workflow" by its own header, so a key added to one table and forgotten in
// another reached main unless someone ran it. This is the cheap half of that question, and it
// runs in CI in milliseconds with no browser:
//
//   · PARITY   every locale's table holds every key ANY locale's table holds. A key one table
//              has and another lacks is exactly the "added since that table was built" case the
//              coverage probe's header calls the blind spot of building from an older locale.
//   · FILLED   a value is a non-empty string.
//
// It does NOT say a key is on the page or that its display site runs t() — that is the browser
// probe's measurement, still run by hand at a locale landing. It says only that the tables
// agree with each other, which is what makes a new locale's table (built from an existing one's
// keys) complete by construction.
//
// The control is required before any locale is judged: a table with one key deleted, and one
// with a blank value, must each be caught in a COPY of the real tables, so a probe that cannot
// see a missing key passes every table.
//
//   node tools/probe-chrome-parity.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const el = { setAttribute() {}, getAttribute() { return null; }, style: {}, classList: { add() {}, remove() {}, toggle() {} } };
globalThis.location = { search: '', href: 'http://localhost/', hash: '', pathname: '/' };
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'], language: 'en' }, configurable: true });
globalThis.document = { documentElement: el, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, createElement() { return el; }, body: el };
globalThis.window = globalThis; globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} }; globalThis.addEventListener = () => {};
const { TABLES, LOCALES } = await import(join(ROOT, 'src/i18n.js'));

// → { missing: {lang: [key]}, blank: {lang: [key]}, union } over a TABLES-shaped object.
const judge = (tables) => {
  const union = new Set();
  for (const T of Object.values(tables)) for (const k of Object.keys(T)) union.add(k);
  const missing = {}, blank = {};
  for (const [lang, T] of Object.entries(tables)) {
    const m = [...union].filter((k) => !(k in T));
    const b = Object.keys(T).filter((k) => typeof T[k] !== 'string' || !T[k].trim());
    if (m.length) missing[lang] = m;
    if (b.length) blank[lang] = b;
  }
  return { missing, blank, union: union.size };
};

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// Controls, on copies. German with a key deleted, French with a value blanked.
const copy = Object.fromEntries(Object.entries(TABLES).map(([c, T]) => [c, { ...T }]));
const k0 = Object.keys(copy.de)[0], k1 = Object.keys(copy.fr)[1];
delete copy.de[k0]; copy.fr[k1] = '  ';
const ctl = judge(copy);
check('control: a key deleted from one table is reported MISSING in that table', ctl.missing.de?.includes(k0) && Object.keys(ctl.missing).length === 1);
check('control: a blank value is reported', ctl.blank.fr?.includes(k1));
check('control: the unmutated tables read clean', (() => { const r = judge(TABLES); return !Object.keys(r.missing).length && !Object.keys(r.blank).length; })());

// Every LOCALES row but English must have a table (the chrome is always carried, §274).
const roster = LOCALES.filter((L) => L.code !== 'en').map((L) => L.code);
const noTable = roster.filter((c) => !TABLES[c]);
check('every LOCALES row has a chrome table', noTable.length === 0, noTable.join(', ') || `${roster.length} rows`);
const orphan = Object.keys(TABLES).filter((c) => !roster.includes(c));
check('every chrome table belongs to a LOCALES row', orphan.length === 0, orphan.join(', '));

const r = judge(TABLES);
for (const [lang, ks] of Object.entries(r.missing)) check(`[${lang}] carries every chrome key`, false, `${ks.length} missing, e.g. ${JSON.stringify(ks[0].slice(0, 70))}`);
for (const [lang, ks] of Object.entries(r.blank)) check(`[${lang}] has no blank value`, false, `${ks.length}, e.g. ${JSON.stringify(ks[0].slice(0, 70))}`);
if (!Object.keys(r.missing).length && !Object.keys(r.blank).length)
  check('every locale carries all of the chrome keys', true, `${r.union} keys x ${Object.keys(TABLES).length} tables`);

console.log(failed ? `\nFAIL — ${failed} finding(s)` : '\nPASS — the chrome tables agree with each other; controls PASS');
process.exit(failed ? 1 : 0);
