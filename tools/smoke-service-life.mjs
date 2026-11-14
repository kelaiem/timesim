#!/usr/bin/env node
// SMOKE: service-life.html (BUILT §344's service-life view) in Chromium, 1280 and 390 wide. Exits non-zero on
// any failure. Checks: the page loads its generated data with no page error and no console error; the finish it
// DRAWS (an arc of the record's radius inscribed in the outline's own two flanks) sets the tip back by exactly
// the cut-back the build recorded, which is the one place the page's geometry and the build's derivation could
// part; the readouts at year 100 are the record's own recessions and its allowance, and at year 0 nothing has
// worn; the worst case runs out of allowance in the year the record's √t law puts it; and at 390 wide nothing
// scrolls sideways. Since §346 the OIL too: the swing the page reads at a moment between two of the record's
// samples is the straight line between them, a service puts it back to the fresh corner's, the end of an
// interval reads the record's aged swing, and the page says the law is posed. `--shots DIR` saves a picture at
// each width.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const DATA = JSON.parse(readFileSync(join(ROOT, 'src/service-life-data.json'), 'utf8'));
const si = process.argv.indexOf('--shots'), SHOTS = si > 0 ? process.argv[si + 1] : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = createServer(async (req, res) => { try { const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const body = await readFile(join(ROOT, p === '/' ? 'service-life.html' : p)); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }).end(body); } catch { res.writeHead(404).end(); } });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const fails = [];
const ok = (name, pass, detail = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!pass) fails.push(name); };
const W = DATA.wear, U_M = DATA.unitMm / 1000, budget_um = W.budget_u * U_M * 1e6;
const um2 = (m) => (m * 1e6).toFixed(2);
if (SHOTS) await mkdir(SHOTS, { recursive: true });
for (const width of [1280, 390]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })).newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/service-life.html`);
  await page.waitForFunction(() => window.__serviceLife?.ready, null, { timeout: 30000 });
  const S = await page.evaluate(() => ({ drawn: window.__serviceLife.cutBackDrawn, record: window.__serviceLife.cutBackRecord }));
  ok(`${width}: the finish drawn sets the tip back by the build's own cut-back`, Math.abs(S.drawn / S.record - 1) < 1e-6, `${S.drawn} u drawn, ${S.record} u recorded`);
  const read = async (yr, c) => page.evaluate(([y, k]) => { window.__serviceLife.set(y, k);
    return { depth: document.getElementById('s-depth').textContent, services: document.getElementById('s-services').textContent,
      rows: [...document.querySelectorAll('#t-corners tr')].map((tr) => [...tr.cells].map((td) => td.textContent)) }; }, [yr, c]);
  const at100 = await read(100, 'nominal');
  ok(`${width}: at year 100 the nominal case reads the record's recession`, at100.depth === `${um2(W.corners.nominal.recession_m)} µm`, at100.depth);
  const rows = Object.fromEntries(at100.rows.map((r) => [r[0], r]));
  ok(`${width}: at year 100 each case reads its own recession`, rows['Best case']?.[2] === `${um2(W.corners.favourable.recession_m)} µm`
    && rows['Worst case']?.[2] === `${um2(W.corners.adverse.recession_m)} µm`, `${rows['Best case']?.[2]} / ${rows['Worst case']?.[2]}`);
  const outYear = W.years * Math.pow(budget_um / (W.corners.adverse.recession_m * 1e6), 2);
  ok(`${width}: the worst case runs out where the √t law puts it`, rows['Worst case']?.[4] === `year ${outYear.toFixed(0)}`, `${rows['Worst case']?.[4]} (law: ${outYear.toFixed(2)})`);
  ok(`${width}: the cases the record says hold, hold`, W.holdsAt.every((c) => rows[{ favourable: 'Best case', nominal: 'Nominal', adverse: 'Worst case' }[c]]?.[4] === `after ${W.years}`), W.holdsAt.join(', '));
  const at0 = await read(0, 'nominal');
  ok(`${width}: at year 0 nothing has worn and no service is done`, at0.depth === '0.00 µm' && at0.services === '0', `${at0.depth}, ${at0.services} services`);
  // §346 — the oil. Between samples the page reads the line between them; at a service, fresh; just before, aged.
  const O = DATA.oilAgeing, OS = O.samples, dt = O.intervalYears / O.intervals;
  const oil = async (yr) => page.evaluate((y) => { window.__serviceLife.set(y);
    return { age: document.getElementById('o-age').textContent, vert: document.getElementById('o-vert').textContent, flat: document.getElementById('o-flat').textContent }; }, yr);
  const midYr = 10 + 2.5 * dt, midV = (OS[2].vertical + OS[3].vertical) / 2, midF = (OS[2].flat + OS[3].flat) / 2;
  const mid = await oil(midYr);
  ok(`${width}: between two oil samples the swing is the line between them`, mid.vert === `${midV.toFixed(1)}°` && mid.flat === `${midF.toFixed(1)}°`,
    `${mid.vert} / ${mid.flat} at year ${midYr} (line ${midV.toFixed(2)}° / ${midF.toFixed(2)}°)`);
  const fresh = await oil(15), aged = await oil(15 - 1e-6);
  ok(`${width}: a service puts the swing back to the fresh corner's`, fresh.vert === `${OS[0].vertical.toFixed(1)}°` && fresh.age === '0.00 yr', `${fresh.vert}, ${fresh.age}`);
  ok(`${width}: just before a service the swing is the record's aged one`, aged.vert === `${OS[O.intervals].vertical.toFixed(1)}°` && aged.flat === `${OS[O.intervals].flat.toFixed(1)}°`, `${aged.vert} / ${aged.flat}`);
  const posed = await page.evaluate(() => /posed/i.test(document.querySelector('.oil').textContent) && /posed/i.test(document.getElementById('swing-cap').textContent));
  ok(`${width}: the page calls the oil law posed`, O.posed === true && posed);
  await read(100, 'nominal');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${width}: nothing scrolls sideways`, wide <= 0, `${wide} px`);
  const h = await page.evaluate(() => ['tip', 'chart', 'wheel', 'swing'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().height)));
  ok(`${width}: all four drawings stand`, h.every((v) => v > 100), h.join(' / '));
  ok(`${width}: no page or console error`, errs.length === 0, errs[0] ?? '');
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `service-life-${width}.png`), fullPage: true });
  await page.context().close();
}
await browser.close(); srv.close();
console.log(fails.length ? `\nFAIL — ${fails.length}` : '\nPASS — service-life.html draws the build\'s record');
process.exit(fails.length ? 1 : 0);
