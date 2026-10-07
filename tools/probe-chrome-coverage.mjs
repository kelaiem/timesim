#!/usr/bin/env node
// §249 (the wave's review) — DOES ANY CHROME STRING STILL READ IN ENGLISH, as rendered?
//
// The page gate holds explain.html and primer.html key by key, but nothing held
// the CHROME: a locale landing builds its table from an existing table's keys,
// so a UI string that NO table has is invisible to every landing, and a string
// the tables DO have but whose display site never runs t() or localizeTree() is
// invisible to every table review. Both kinds shipped. The review that wrote
// this found ten strings in no table (four part labels, a keyboard row, the
// route panel's hints, the canvas's screen-reader label re-worded after its key
// was taken) and a whole panel section built after the one localization pass.
//
// The measure is the live DOM. Boot index.html in English and collect every
// text node and readable attribute (title, placeholder, aria-label) — the set E.
// Boot each locale and collect the same. A string of E that reads IDENTICALLY
// under the locale is then classified against that locale's own table:
//   COGNATE      the table maps it to itself ('Camera' is Welsh too) — fine;
//   NEVER        declared below as never translated, with the reason — fine;
//   MISSING      no table entry — FAIL;
//   NOT APPLIED  the table translates it and the DOM still says English: the
//                display site never reached t() / localizeTree() — FAIL.
//
// The control is required before any locale is judged: German is booted a
// second time with one of its entries deleted in flight (the served i18n.js is
// rewritten), and that string must come back MISSING. A probe that cannot see a
// deleted key passes every table.
//
// Residue, named: the DOM at boot. A string built later (a tour caption, a
// toast, a label written on hover) is not on the page when it is read, and a
// collapsed section counts only because its markup exists while it is closed.
//
//   node tools/probe-chrome-coverage.mjs [--locales de,cy]
//
// Needs python3 (dev_server.py) and a Playwright Chromium, like ci-battery.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};

// Strings that are never translated, by rule rather than by omission. Each is a
// CLAIM: the display translates, values do not (CLAUDE.md), and these are
// values, names or keys a reader types.
const NEVER = [
  [/^[a-z][A-Za-z]*(\.[A-Za-z0-9]+)+( — applies on reload)?$/, 'an aesthetics key path, shown as the advanced row\'s tooltip — a value, not display'],
  [/^Watch Sim$/, 'the product name'],
  [/^\(?Space\)?$/, 'the name of a key the reader presses'],
  [/^[\d.,\s\u00a0\u202f]+\s?(mm|h|Hz|kHz|s|°|%)?$/, 'a number and its unit, formatted by fmtNum — it reads as English wherever the locale writes English\'s marks'],
];
// A display string is sometimes a key plus a suffix the code appends: §72's
// shortcut hint ("Menu (H)") and the reload mark on an advanced row ("… ⟳").
// The suffix is the code's, so the KEY is what the table must account for.
const keyOf = (s) => s.replace(/ \([A-Z?]\)$/, '').replace(/ ⟳$/, '');

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
// Isolated TMPDIR for probe-116's reason: dev_server.py keeps one /__state per
// temp dir, and a probe sharing the battery's can break its virgin boots.
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-chrome-cover-'));
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// One virgin boot: the strings on the page, and the locale's table and roster.
const boot = async (lang, dropKey) => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  if (dropKey) {
    await p.route('**/src/i18n.js*', async (route) => {
      const r = await route.fetch(); let body = await r.text();
      const q = (k) => `'${k.replace(/'/g, "\\'")}'`;
      const at = body.indexOf('const DE = {');
      const i = body.indexOf(`${q(dropKey)}:`, at);
      if (at < 0 || i < 0) throw new Error(`control: cannot find ${dropKey} in DE`);
      const end = body.indexOf(',', body.indexOf("'", body.indexOf(':', i) + 3) + 1);
      body = body.slice(0, i) + body.slice(end + 1);
      await route.fulfill({ response: r, body });
    });
  }
  await p.goto(`${base}/index.html${lang === 'en' ? '' : `?lang=${lang}`}`);
  await p.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
  const out = await p.evaluate(async (code) => {
    const m = await import('/src/i18n.js');
    const s = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.parentElement.closest('script,style')) continue;
      const t = n.nodeValue.trim(); if (t) s.add(t);
    }
    for (const el of [document.body, ...document.body.querySelectorAll('[title],[placeholder],[aria-label]')]) {
      for (const a of ['title', 'placeholder', 'aria-label']) { const v = el.getAttribute(a); if (v && v.trim()) s.add(v.trim()); }
    }
    return { strings: [...s], table: m.TABLES[code] || null, faces: m.LOCALES.map((L) => L.face), codes: m.LOCALES.map((L) => L.code),
      err: window.__bootError ? String(window.__bootError) : null };
  }, lang);
  await ctx.close();
  return out;
};

const en = await boot('en');
if (en.err) { console.log(`FAIL — English did not boot: ${en.err}`); process.exit(1); }
const E = new Set(en.strings.filter((s) => /\p{L}{2,}/u.test(s)));
const faces = new Set(en.faces);
const LOCALES = argOf('--locales', en.codes.filter((c) => c !== 'en').join(',')).split(',');
console.log(`English: ${E.size} distinct strings on the page at boot`);

const judge = (r, lang) => {
  const rows = { MISSING: [], 'NOT APPLIED': [], COGNATE: 0, NEVER: 0 };
  if (!r.table) { rows.MISSING.push(`(no table for ${lang})`); return rows; }
  for (const s of r.strings) {
    if (!E.has(s) || faces.has(s)) continue;
    if (NEVER.some(([re]) => re.test(s))) { rows.NEVER++; continue; }
    const k = keyOf(s);
    if (!(k in r.table)) rows.MISSING.push(k);
    else if (r.table[k] === k) rows.COGNATE++;
    else rows['NOT APPLIED'].push(s);
  }
  return rows;
};

// The control: German with one entry deleted in flight must report it MISSING.
const CONTROL_KEY = 'Time';
const ctl = judge(await boot('de', CONTROL_KEY), 'de');
const ctlOk = ctl.MISSING.includes(CONTROL_KEY);
console.log(`control: German with '${CONTROL_KEY}' deleted in flight reads it MISSING — ${ctlOk ? 'PASS' : 'FAIL'}`);
if (!ctlOk) { await browser.close(); server.kill(); process.exit(1); }

let failed = 0;
for (const lang of LOCALES) {
  const r = await boot(lang);
  if (r.err) { console.log(`[${lang}] did not boot: ${r.err}`); failed++; continue; }
  const rows = judge(r, lang);
  const bad = rows.MISSING.length + rows['NOT APPLIED'].length;
  console.log(`[${lang}] ${bad ? 'FAIL' : 'ok  '} · missing ${rows.MISSING.length} · not applied ${rows['NOT APPLIED'].length} · cognate ${rows.COGNATE} · never ${rows.NEVER}`);
  for (const k of ['MISSING', 'NOT APPLIED']) for (const s of rows[k]) console.log(`      ${k.padEnd(11)} ${JSON.stringify(s).slice(0, 120)}`);
  if (bad) failed++;
}
await browser.close(); server.kill();
console.log(failed ? `\nFAIL — ${failed} locale(s) show English the table does not account for`
  : `\nPASS — every string on the page at boot is translated, a declared cognate, or declared never translated, in ${LOCALES.length} locale(s)`);
process.exit(failed ? 1 : 0);
