#!/usr/bin/env node
// SMOKE: gong-bench.html (BUILT §310's bench, hosted beside technic.html) in Chromium, 1280 and 390 wide. Exits
// non-zero on any failure. Checks: the page loads its generated data and the build's own modules with no page
// error and no console error; every case kind is offered and draws; the build's seats load as presets and ring
// their generated f₁ (src/gong-seats.js' `f`, to 0.5% — the bench samples the curve the build sweeps); the
// solver, in its module worker on src/gong-solve.js with the hammer on its lever, returns at least one bar; and
// at 390 wide nothing scrolls sideways. The f₁ readout is the page's own two-decimal kHz, so the tolerance is
// that display's rounding plus the curve's quarter-unit sampling.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GONG_SEATS } from '../src/gong-seats.js';
import { solveVolume, VOLUME_INPUTS } from '../src/alarm-volume.js';
const VOL = solveVolume();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = createServer(async (req, res) => { try { const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const body = await readFile(join(ROOT, p === '/' ? 'gong-bench.html' : p)); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }).end(body); } catch { res.writeHead(404).end(); } });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const fails = [];
const ok = (name, pass, detail = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!pass) fails.push(name); };
for (const width of [1280, 390]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/gong-bench.html`);
  await page.waitForFunction(() => window.__gongBench?.ready, null, { timeout: 60000 });
  await page.waitForFunction(() => !/computing/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  const kinds = await page.evaluate(() => [...document.getElementById('kind').options].map((o) => o.value));
  ok(`${width}: every case kind is offered`, ['rect', 'cushion', 'tonneau'].every((k) => kinds.includes(k)), kinds.join(', '));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${width}: nothing scrolls sideways`, wide <= 0, `${wide} px`);
  if (width === 1280) for (const kind of kinds) for (const mode of ['bar', 'spiral']) {
    const row = GONG_SEATS[kind]?.[mode]; if (!row) continue;
    const f1 = await page.evaluate(async ([k, m]) => { const sel = document.getElementById('kind'); sel.value = k; sel.dispatchEvent(new Event('change'));
      document.getElementById(m === 'bar' ? 'p-bar' : 'p-seat-spiral').click();
      await new Promise((r) => setTimeout(r, 50)); for (let i = 0; i < 400 && /computing/.test(document.getElementById('status').textContent); i++) await new Promise((r) => setTimeout(r, 50));
      return parseFloat(document.getElementById('o-f1').textContent.replace(/[^\d.]/g, '')) * (/kHz/.test(document.getElementById('o-f1').textContent) ? 1000 : 1); }, [kind, mode]);
    ok(`${kind} ${mode} seat: the bench rings the build's f₁`, Math.abs(f1 / row.f[0] - 1) < 0.005, `${f1} Hz against ${row.f[0]}`);
  }
  if (width === 1280) {
    const n = await page.evaluate(async () => { const sel = document.getElementById('kind'); sel.value = 'rect'; sel.dispatchEvent(new Event('change'));
      for (const [id, v] of [['s-edge', true], ['s-col', false], ['s-any', true], ['s-spiral', false], ['s-lever', true]]) document.getElementById(id).checked = v;
      document.getElementById('s-run').click();
      for (let i = 0; i < 2400 && document.getElementById('s-run').disabled; i++) await new Promise((r) => setTimeout(r, 100));
      return document.getElementById('s-results').rows.length; });
    // the bar families tools/gong-seats.mjs searches (along a flat edge, and anywhere it fits): on §308 landing 5's
    // arrangement the lever stands on the top edge and no flat-edge bar reaches it, so the rect's bar seat is an arc
    ok('the solver (module worker, the hammer on its lever) returns bars for the rect', n > 0, `${n} rows`);
  }
  // §320 — the volume prototype: the page offers the line spec's own settings (src/alarm-volume.js, solved here in
  // Node too), selecting one moves the drawn hammer to its station and the readout to its level, and the spec
  // table carries every input row
  const vol = await page.evaluate(async () => { const B = window.__gongBench.volume, btns = [...document.querySelectorAll('#vol-set button')];
    const hammerX = () => { const r = [...document.querySelectorAll('#vol-chain rect')].find((e) => e.getAttribute('fill') && !/none/.test(e.getAttribute('fill')) && +e.getAttribute('height') < 2); return r ? +r.getAttribute('x') + +r.getAttribute('width') / 2 : NaN; };
    const x0 = hammerX(), db0 = document.getElementById('vol-db').textContent; btns.at(-1).click(); await new Promise((r) => setTimeout(r, 30));
    const x1 = hammerX(), db1 = document.getElementById('vol-db').textContent, pressed = btns.at(-1).getAttribute('aria-pressed');
    const rows = document.querySelectorAll('#vol-spec tr:not(.sub)').length, curvePts = document.querySelectorAll('#vol-curve polyline').length;
    B.select(0); return { n: btns.length, N: B.V.N, L: B.V.wire.L_mm, x0, x1, db0, db1, pressed, rows, curvePts, inset0: B.V.stations[0].inset_mm, insetQ: B.V.stations.at(-1).inset_mm }; });
  ok(`${width}: the volume prototype offers the line spec's settings`, vol.n === VOL.N && vol.N === VOL.N, `${vol.n} buttons, ${VOL.N} settings solved in Node`);
  ok(`${width}: selecting the quietest moves the drawn hammer to its station and the readout to its level`,
    Math.abs((vol.L - vol.x0) - VOL.stations[0].inset_mm) < 1e-6 && Math.abs((vol.L - vol.x1) - VOL.stations.at(-1).inset_mm) < 1e-6 && vol.pressed === 'true'
    && vol.db1 === `${VOL.stations.at(-1).dB >= 0 ? '+' : '−'}${Math.abs(VOL.stations.at(-1).dB).toFixed(1)} dB` && vol.db0 !== vol.db1,
    `hammer at ${(vol.L - vol.x0).toFixed(3)} → ${(vol.L - vol.x1).toFixed(3)} mm in, readout ${vol.db0} → ${vol.db1}`);
  ok(`${width}: the spec table carries every input row and the curves are drawn`, vol.rows >= Object.keys(VOLUME_INPUTS).length + 10 && vol.curvePts === 3, `${vol.rows} rows, ${vol.curvePts} curves`);
  ok(`${width}: no page or console error`, errs.length === 0, errs.slice(0, 2).join(' | '));
}
await browser.close(); srv.close();
console.log(fails.length ? `\nFAIL: ${fails.length}` : '\nPASS: every check');
process.exit(fails.length ? 1 : 0);
