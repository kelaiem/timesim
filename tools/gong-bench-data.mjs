#!/usr/bin/env node
// WRITES src/gong-bench-data.json: what gong-bench.html lays its wire into — per form case, the measured free
// space at the gong wire's own height. The page cannot boot the movement (it is sim-code-free, like
// technic.html: the battery never sees it), so the space is GENERATED here from booted builds and committed,
// never typed, and --check re-derives it.
//
//   node tools/gong-bench-data.mjs --write     every kind (layout.js FORM_KINDS — §317 added the fitted tonneau); a few minutes
//   node tools/gong-bench-data.mjs --check     re-derive and compare with the committed file (same cost)
//
// Per kind and per committed seat (bar, spiral), the build booted at THAT seat's fit (src/gong-seats.js) — a
// seat is solved at its own fit, and the plate is cut to the fit, so each seat's space is read where it was
// solved — with ?gong=arc — the round
// build's ring, which the map leaves out — exactly as tools/gong-seats.mjs reads its first round: the same
// band (the wire's z, one wire radius and a margin either side), the same parts (GS.bandParts over the
// region model and the plates' tenants, the hammer and the pillars left out: the hammer is the seat's own,
// and since TODO 272 the gong sets the pillars), the same cell (RES) and the same law (GS.bandMap: a
// centreline may stand where no part is within the wire's need). One difference, the page's option: the
// map runs out to the case BORE (the plate's outline grown CASE_CLEAR), so a wire may be laid in the gap past
// the plate's edge, where the round build's own ring overhangs; the page's default view cuts it back to the
// plate's outline by the need, which is the seat generator's map.
//
// Also per fit: the plate's outline (the loop the page draws and cuts to), the hammer's and lifting lever's
// plan (the STRIKE mask, drawn so a wire is not laid through them), the pillars (the column family's anchors),
// the lever the build re-solves the hammer on, the wire's section, §197's band, and the fit the space was read at.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as GS from '../src/gong-solve.js';
import { formShapeOf, CASE_CLEAR, UNIT_MM, FORM_KINDS } from '../src/layout.js';
import { GONG_SEATS } from '../src/gong-seats.js';
import { defaultSeatMode } from '../src/case-shape.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/gong-bench-data.json');
const ARGS = process.argv.slice(2), WRITE = ARGS.includes('--write'), CHECK = ARGS.includes('--check');
if (WRITE === CHECK) { console.error('usage: node tools/gong-bench-data.mjs --write | --check'); process.exit(2); }
const KINDS = FORM_KINDS;
const BAND_HZ = [1000, 4000];   // §197, tools/gong-seats.mjs' BAND_HZ
const RES = 0.25;               // tools/gong-seats.mjs' cell
const r4 = (v) => Math.round(v * 1e4) / 1e4;

const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

// bits, least significant first, base64 (the page's unpack)
const pack = (bits) => { const bytes = new Uint8Array(Math.ceil(bits.length / 8)); for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7); return Buffer.from(bytes).toString('base64'); };

const data = { generatedFrom: 'each committed seat\'s fit (src/gong-seats.js), ?gong=arc', band: BAND_HZ, kinds: {} };
for (const kind of KINDS) for (const mode of ['bar', 'spiral']) {
  const fit = GONG_SEATS[kind]?.[mode]?.formrect;
  // a kind must have its DEFAULT seat (the spiral since §314, the bar where no spiral closes — §317's fitted
  // tonneau): the page opens on it, so a kind with neither is a table to regenerate, not a bench to draw
  if (!fit) { if (mode === defaultSeatMode(GONG_SEATS, kind)) { console.error(`${kind}: no committed ${mode} seat (its default) to read the fit from`); process.exit(1); } continue; }
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&case=${kind}&formrect=${fit.join(',')}&gong=arc`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 600000, polling: 1000 });
  const S = await page.evaluate(() => {
    if (window.__bootError) return { bootError: String(window.__bootError.message || window.__bootError) };
    const c = window.__clock, g = c.gongSeat, pillars = [];
    // §328: the frame's supports — a pillar, or (the default since §328 step 2) a land on the pillar's own seat and cap
    c.scene.traverse((o) => { if ((o.name !== 'pillar' && !o.userData.rimLand) || !o.isMesh) return;
      const w = o.getWorldPosition(o.position.clone()), pa = o.geometry.attributes.position, v = o.position.clone(); let capR = 0;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); capR = Math.max(capR, Math.hypot(v.x - w.x, v.y - w.y)); }
      pillars.push({ x: w.x, y: w.y, capR }); });
    return { regions: JSON.parse(JSON.stringify(c.regions)), tenants: JSON.parse(JSON.stringify(g.tenants)), lever: g.lever, wireR: g.wireR, wireD_m: g.wireD_m,
      zGong: g.zGong, footR: Math.max(...[10, 20, 30, 40, 50, 60, 70, 80].map((L) => g.postRFor(L))), pillars };
  });
  await ctx.close();
  if (S.bootError) { console.error(`${kind}: boot failed: ${S.bootError}`); process.exit(1); }
  const shape = formShapeOf(kind, fit);   // §317: the fitted tonneau's fit carries its two shape numbers after the bounds
  const need = S.wireR + S.lever.margin;
  const z0 = S.zGong - S.wireR, z1 = S.zGong + S.wireR;
  const parts = [...GS.bandParts(S.regions, z0, z1, S.lever.margin, new Set(['Alarm hammer', 'pillars'])), ...GS.bandParts(S.tenants, z0, z1, S.lever.margin)];
  // the grid covers the case bore (the plate grown CASE_CLEAR), one cell either side
  const B = shape.grown(CASE_CLEAR).bounds;
  const x0 = B.xMin - RES, y0 = B.yMin - RES, W = Math.ceil((B.xMax - B.xMin) / RES) + 2, H = Math.ceil((B.yMax - B.yMin) / RES) + 2;
  const map = GS.bandMap(parts, { x0, y0, W, H, RES, need, inset: (x, y) => shape.inset(x, y) + CASE_CLEAR });
  // the strike group's plan: the hammer's and lifting lever's own parts in the band, rasterised
  const sp = GS.bandParts(S.regions, z0, z1, S.lever.margin).filter((q) => q.unit === 'Alarm hammer' || q.unit === 'Alarm lifting lever');
  const strike = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) strike[j * W + i] = GS.bandNearest(sp, x0 + (i + 0.5) * RES, y0 + (j + 0.5) * RES, 0.01).d <= 0 ? 1 : 0;
  (data.kinds[kind] ??= {})[mode] = {
    fit, mm: [r4((fit[1] - fit[0]) * UNIT_MM), r4((fit[3] - fit[2]) * UNIT_MM)],
    grid: { x0: r4(x0), y0: r4(y0), W, H, RES }, need: r4(need), wireR: r4(S.wireR), wireD_m: S.wireD_m, footR: r4(S.footR),
    lever: Object.fromEntries(Object.entries(S.lever).map(([k, v]) => [k, typeof v === 'number' ? r4(v) : (v && typeof v === 'object' ? { x: r4(v.x), y: r4(v.y) } : v)])),
    loop: shape.loop().map(([x, y]) => [r4(x), r4(y)]),
    pillars: S.pillars.map((q) => ({ x: r4(q.x), y: r4(q.y), r: r4(q.capR + need) })),
    free: pack(map.free), strike: pack(strike),
    cells: { free: map.free.reduce((t, v) => t + v, 0), strike: strike.reduce((t, v) => t + v, 0), of: W * H },
  };
  const rec = data.kinds[kind][mode];
  console.log(`${kind} ${mode} fit [${fit.join(', ')}]: ${parts.length} parts in the band, ${rec.cells.free} of ${W * H} cells free, ${rec.cells.strike} under the strike group, ${S.pillars.length} pillars`);
}
await browser.close(); srv.close();
const text = JSON.stringify(data) + '\n';
if (CHECK) {
  const cur = readFileSync(OUT, 'utf8');
  if (cur !== text) { console.error('FAIL: src/gong-bench-data.json is not what the tool derives — run `node tools/gong-bench-data.mjs --write`'); process.exit(1); }
  console.log('PASS: src/gong-bench-data.json re-derives');
} else { await writeFile(OUT, text); console.log(`wrote ${OUT} (${(text.length / 1024).toFixed(1)} KB)`); }
