#!/usr/bin/env node
// §325 landing 5 — WHERE THE FUSEE STANDS WITHOUT THE ALARM: a scan of the going train's barrel step (solveLayout's
// barrelStepDeg, the bearing from the barrel's arbor to the centre wheel's — the fusee and its drum swung round the
// rest of the train) for the free outline of the movement built without the alarm. A REPORT: it ranks, it lands
// nothing; tools/free-outline.mjs is what settles a row.
//
// Each bearing is BOOTED (?case=free&alarm=0&barrelstep=…&rsvaz=0&rsvidl=2, the arrangement's other keys named so it
// stays the arrangement's: a URL that names one of ARRANGEMENT's keys takes none of the others) on the stand-in box —
// no generated row exists for it — and its counted metal's plan hulls, pins and ports are fitted the way the build
// fits them (layout.js fitFreeCase, the strap axis searched as tools/free-outline.mjs searches it). A bearing whose
// boot warns past the set every free build without a row carries (§186's form-plate fit, §261's depth, §325's "no
// row") is REFUSED and named with its warnings: the layout did not close there.
//
// The area is ROUND 1 of the fixed point — the metal as the stand-in box seats it (pillars, feet), which the settled
// row then pulls in (the declared arrangement: 842.7 at round 1, 813.9 settled). It ranks bearings; it is not the
// settled area.
//
//   node tools/free-arrangement-scan.mjs [--from -180 --to 180 --step 20] [--par 2] [--extra 'k=v&…']
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { fitFreeCase, UNIT_MM } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const FROM = Number(arg('--from', -180)), TO = Number(arg('--to', 180)), STEP = Number(arg('--step', 20)), PAR = Number(arg('--par', 2));
const EXTRA = arg('--extra', '');
const EXPECTED = /^§186: the rim-to-bore fit|^§261: cased assembly|^§325: no free outline is generated/;
const mm2 = UNIT_MM * UNIT_MM, SCAN_U = 2.5, TOL_U = 0.05;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL|no saved state|Failed to load resource/i;
const boot = async (q) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage(), warnings = [];
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(m.text()); });
  page.on('pageerror', (e) => warnings.push('PAGEERROR ' + e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&${q}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 900000, polling: 1000 });
  const out = await page.evaluate(() => (window.__bootError ? { bootError: String(window.__bootError.message || window.__bootError) }
    : { free: JSON.parse(JSON.stringify(window.__clock.formFootprint.free)), depth: window.__clock.casedDepthMm }));
  await ctx.close();
  return { ...out, warnings };
};
// the strap axis: tools/free-outline.mjs's scan then golden section, on the build's own fit
const solveAxis = (F) => {
  let lo = Infinity, hi = -Infinity;
  for (const P of F.polys) for (const [x] of P) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  const mid = (lo + hi) / 2, half = Math.max(SCAN_U, (hi - lo) / 2 - F.need);
  const fit = (c) => { try { return fitFreeCase(F.polys, { margin: F.margin, rc: F.rc, need: F.need, c, pins: F.pins.map(([x, y, n]) => [x, y, n]), ports: F.ports }).area; } catch { return Infinity; } };
  const scan = [];
  for (let c = mid - half; c <= mid + half + 1e-9; c += SCAN_U) scan.push([c, fit(c)]);
  let k = 0; for (let i = 1; i < scan.length; i++) if (scan[i][1] < scan[k][1]) k = i;
  const g = (Math.sqrt(5) - 1) / 2;
  let a = scan[Math.max(0, k - 1)][0], b = scan[Math.min(scan.length - 1, k + 1)][0];
  let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = fit(x1), f2 = fit(x2);
  while (b - a > TOL_U) {
    if (f1 <= f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = fit(x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = fit(x2); }
  }
  return Math.min(f1, f2, scan[k][1]) === scan[k][1] ? { c: scan[k][0], area: scan[k][1] } : f1 <= f2 ? { c: x1, area: f1 } : { c: x2, area: f2 };
};

const bearings = [];
for (let d = FROM; d <= TO + 1e-9; d += STEP) bearings.push(d);
const rows = [];
const run = async (d) => {
  const q = `case=free&alarm=0&barrelstep=${d}&rsvaz=0&rsvidl=2${EXTRA ? `&${EXTRA}` : ''}`;
  const b = await boot(q);
  if (b.bootError) { rows.push({ d, refused: `boot failed: ${b.bootError}` }); console.log(`${d}°  BOOT FAILED ${b.bootError.slice(0, 160)}`); return; }
  const extra = b.warnings.filter((w) => !EXPECTED.test(w));
  const ax = solveAxis(b.free);
  const row = { d, area: ax.area * mm2, c: ax.c, depth: b.depth, warns: extra };
  rows.push(row);
  console.log(`${String(d).padStart(5)}°  ${Number.isFinite(row.area) ? row.area.toFixed(1) : '—'} mm² (c ${ax.c.toFixed(2)}), depth ${b.depth?.toFixed(3)} mm`
    + (extra.length ? `  REFUSED: ${extra.length} warning(s): ${extra.map((w) => w.slice(0, 110)).join(' | ')}` : ''));
};
for (let i = 0; i < bearings.length; i += PAR) await Promise.all(bearings.slice(i, i + PAR).map(run));
await browser.close(); srv.close();
const ok = rows.filter((r) => Number.isFinite(r.area) && !r.warns?.length).sort((a, b) => a.area - b.area);
console.log(`\nranked (closed layouts, round-1 area): ${ok.map((r) => `${r.d}° ${r.area.toFixed(1)}`).join(', ')}`);
console.log(`refused: ${rows.filter((r) => !ok.includes(r)).map((r) => `${r.d}°`).join(', ') || 'none'}`);
