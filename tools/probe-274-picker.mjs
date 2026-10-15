#!/usr/bin/env node
// §274 — DOES THE PICKERS' "SHOW INCOMPLETE TRANSLATIONS" TOGGLE DO WHAT IT SAYS?
//
// The three language pickers (the panel's, explain.html's, primer.html's) fill
// themselves through one function, fillLanguagePicker in src/i18n.js. A locale
// that does not carry all three surfaces is hidden until the reader flips the
// last option; the current locale always stays listed; the choice persists
// across pages; and while every row is whole the pickers are unchanged. No
// shipped row is incomplete, so the probe PLANTS one in flight (the served
// i18n.js is rewritten, as probe-chrome-coverage's control does) and asserts
// each clause against the live <select>, with the unmodified file as the control.
//
//   node tools/probe-274-picker.mjs
//
// Needs python3 (dev_server.py) and a Playwright Chromium. The static pages are
// enough: the panel calls the same function, and a full boot is the battery's.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = await new Promise((res, rej) => { const s = createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
const base = `http://127.0.0.1:${port}`;
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: mkdtempSync(join(tmpdir(), 'timesim-picker-')) }, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const plant = (p) => p.route('**/src/i18n.js*', async (route) => {
  const r = await route.fetch(); const body = (await r.text()).replace("{ code: 'de', face: 'Deutsch',", "{ code: 'de', surfaces: ['chrome'], face: 'Deutsch',");
  if (!body.includes("surfaces: ['chrome'], face: 'Deutsch'")) throw new Error('control: the planted row did not take');
  await route.fulfill({ response: r, body });
});
const read = (p) => p.evaluate(() => [...document.querySelectorAll('#lang-select option')].map((o) => ({ v: o.value, s: o.dataset.state || null, t: o.textContent })));
const has = (o, v) => o.some((x) => x.v === v);
const open = async (ctx, page, lang, planted) => { const p = await ctx.newPage(); if (planted) await plant(p); await p.goto(`${base}/${page}?lang=${lang}`); await p.waitForSelector('#lang-select option', { state: 'attached' }); return p; };

// The control: the shipped roster has no incomplete row, so no toggle and no change.
{
  const ctx = await browser.newContext();
  const o = await read(await open(ctx, 'primer.html', 'en', false));
  check('control: with every row whole the picker lists every locale and carries no toggle', has(o, 'de') && !has(o, '__incomplete__') && o.length === 23, `${o.length} options`);
  await ctx.close();
}
for (const page of ['primer.html', 'explain.html']) {
  const ctx = await browser.newContext();
  const p = await open(ctx, page, 'fr', true);
  let o = await read(p);
  check(`${page}: an incomplete locale is hidden by default and the toggle is offered`, !has(o, 'de') && has(o, '__incomplete__') && o.find((x) => x.v === '__incomplete__').s === 'off');
  check(`${page}: the toggle reads in the page's own language`, o.find((x) => x.v === '__incomplete__').t === 'Afficher les traductions incomplètes', o.at(-1).t);
  await p.selectOption('#lang-select', '__incomplete__');
  o = await read(p);
  check(`${page}: flipping it lists the incomplete locale, marks the state, and keeps the reader's locale selected`,
    has(o, 'de') && o.find((x) => x.v === '__incomplete__').s === 'on' && await p.$eval('#lang-select', (s) => s.value) === 'fr');
  const q = await open(ctx, page === 'primer.html' ? 'explain.html' : 'primer.html', 'en', true);
  check(`${page}: the choice persists to the other page`, has(await read(q), 'de'));
  await p.selectOption('#lang-select', '__incomplete__');
  check(`${page}: flipping again hides it`, !has(await read(p), 'de'));
  await ctx.close();
}
{
  const ctx = await browser.newContext();
  const p = await open(ctx, 'primer.html', 'de', true);
  check('the reader\'s current locale stays listed even when it is incomplete and the toggle is off', has(await read(p), 'de') && await p.$eval('#lang-select', (s) => s.value) === 'de');
  await ctx.close();
}
await browser.close(); server.kill();
console.log(failed ? `\nFAIL — ${failed} clause(s)` : '\nPASS — every clause holds against the live pickers');
process.exit(failed ? 1 : 0);
