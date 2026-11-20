// THE EXPERIMENTAL BUILD GROUP IN A BROWSER: does the panel offer what src/experimental-specs.js declares, show the build it
// made, ask before a pick changes another setting, and say so when a link asked for something the spec refused?
// Acceptance (exit 1 on any failure). Chromium, four boots.
//
//   node tools/smoke-experimental-specs.mjs
//
// tools/probe-experimental-specs.mjs holds the TABLE to the builds (each option's build silent, natively); this holds the
// PAGE: the controls generated from the table, their values read off the resolved spec, the confirmation, the reload, and
// the spec panel's verdict row for a refused request (layout.js SPEC_REFUSALS).
//   1 the default: one dropdown per row, each at its off value, each with its tier on an attribute, the verdict row hidden
//   2 picking the double barrel asks first, naming the alarm and the beat rate; cancelling leaves the URL and the dropdown
//   3 accepting reloads into the double barrel's build: the dropdown reads it, the main beat-rate menu shows 36,000 rather
//     than a blank, and the verdict row stays hidden because nothing was refused
//   4 CONTROL — a link asking for ?barrels=2 alone (refused: the alarm is on) shows the dropdown off and the verdict row
//     naming the refusal; without step 1 of this work the row stayed hidden and this failed
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { EXPERIMENTAL_SPECS } from '../src/experimental-specs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright/index.js'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

let fail = 0;
const ok = (msg, pass, detail = '') => { console.log(`${pass ? 'OK  ' : 'FAIL'} ${msg}${detail ? ` — ${detail}` : ''}`); if (!pass) fail++; };
const booted = (page) => page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 400000 });
// the panel as it stands once the verdict row's deferred tick has run
const read = (page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 200));
  const v = document.getElementById('spec-verdict');
  return {
    bootError: window.__bootError ? String(window.__bootError.message ?? window.__bootError) : null,
    rows: [...document.querySelectorAll('#experimental-body select')].map((s) => ({ id: s.id, value: s.value, options: [...s.options].map((o) => o.value),
      tier: s.parentElement.querySelector('.exp-tier')?.dataset.tier ?? null })),
    vph: document.getElementById('spec-vph').value,
    vphText: document.getElementById('spec-vph').selectedOptions[0]?.textContent ?? '',
    verdict: v.style.display === 'none' ? null : v.textContent,
    search: location.search,
  };
});
const pick = (page, id, value) => page.evaluate(([i, v]) => { const s = document.getElementById(i); s.value = v; s.dispatchEvent(new Event('change')); }, [id, value]);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}?trial=1&sync=0`);
  await booted(page);
  const d = await read(page);
  ok('1 the default boots', !d.bootError, d.bootError ?? '');
  ok('1 one dropdown per table row, in order', d.rows.map((r) => r.id).join() === EXPERIMENTAL_SPECS.map((r) => `exp-${r.id}`).join(), d.rows.map((r) => r.id).join());
  ok('1 every dropdown offers exactly its row\'s values', EXPERIMENTAL_SPECS.every((r, i) => d.rows[i]?.options.join() === r.options.map(([v]) => v).join()));
  ok('1 every dropdown reads off on the default', d.rows.every((r) => r.value === ''), d.rows.map((r) => `${r.id}=${r.value}`).join(', '));
  ok('1 every row carries its tier as an attribute', EXPERIMENTAL_SPECS.every((r, i) => d.rows[i]?.tier === r.tier));
  ok('1 the verdict row is hidden on the default', d.verdict === null, d.verdict ?? '');

  // 2 — cancel
  let asked = null;
  page.once('dialog', (dl) => { asked = dl.message(); dl.dismiss(); });
  await pick(page, 'exp-double-barrel', '2');
  await page.waitForTimeout(300);
  const c = await read(page);
  ok('2 picking the double barrel asks first', !!asked, JSON.stringify(asked));
  ok('2 the question names the alarm and the beat rate', !!asked && /Alarm/.test(asked) && /36/.test(asked), JSON.stringify(asked));
  ok('2 cancelling leaves the URL and the dropdown as they were', c.search === d.search && c.rows[0].value === '', `${c.search} ${c.rows[0].value}`);

  // 3 — accept
  page.once('dialog', (dl) => dl.accept());
  await Promise.all([page.waitForNavigation({ timeout: 60000 }), pick(page, 'exp-double-barrel', '2')]);
  await booted(page);
  const a = await read(page);
  const q = new URLSearchParams(a.search);
  ok('3 accepting reloads with the double barrel and its needs', q.get('barrels') === '2' && q.get('vph') === '36000' && q.get('alarm') === '0', a.search);
  ok('3 the double barrel\'s build boots', !a.bootError, a.bootError ?? '');
  ok('3 its dropdown reads it back', a.rows.find((r) => r.id === 'exp-double-barrel')?.value === '2');
  ok('3 the main beat-rate menu shows 36,000, not a blank', a.vph === '36000' && /36/.test(a.vphText), `${a.vph} '${a.vphText}'`);
  ok('3 nothing was refused, so the verdict row stays hidden', a.verdict === null, a.verdict ?? '');

  // 4 — control: a refused request
  await page.goto(`${BASE}?trial=1&sync=0&barrels=2`);
  await booted(page);
  const r = await read(page);
  ok('4 control: ?barrels=2 with the alarm on reads off', r.rows.find((x) => x.id === 'exp-double-barrel')?.value === '');
  ok('4 control: the verdict row names the refusal', !!r.verdict && /not built as asked/.test(r.verdict) && /barrels=2/.test(r.verdict), r.verdict ?? 'hidden');
} finally {
  await browser.close().catch(() => {});
  srv.close();
}
console.log(fail ? `\n${fail} FAILED` : '\nall pass');
process.exit(fail ? 1 : 0);
