#!/usr/bin/env node
// WRITES src/alarm-link-sites.js: the alarm link's SITE and the constants its chain is cut to there, per
// configuration whose link cannot keep the measured site (ALARM_LINK_MEASURED_SITE, k 1 run 6 tab 87).
//
//   node tools/alarm-link-sites.mjs --write     every configuration in CONFIGS (a few boots per candidate site)
//   node tools/alarm-link-sites.mjs --check     re-derive and compare with the committed file (same cost)
//   node tools/alarm-link-sites.mjs --write 'alarmmirror=diag&alarmaz=-30'   one configuration (merged into the file)
//
// WHY A TABLE. The link's chain constants (the shaft's body length, the selector rod's length, the guides' reach)
// are QUOTED before the site solve that decides them, because the solve's own scoring reads them (§169's COILS
// convention: quote, re-derive live, warn where the two part). So a site other than the one they were measured at
// needs its own quotations, and they cannot be derived in one pass: they are converged here, on the site's own
// built metal, and committed — tools/gong-seats.mjs' idiom for the same ordering problem.
//
// PER CONFIGURATION:
//   1. boot it with ?linkscan=1: the solve's ranking of every site it scored (unpruned), and its warnings;
//   2. a configuration whose own build is clean of every link warning needs no row (the measured site serves);
//   3. otherwise each site the solve admits (at or over CLEAR_MARGIN), NEAREST THE MEASURED SITE first, is FORCED (?linksite=) and its quotations
//      iterated (?linkconst=) to the fixed point the build's own drift guards measure — the body length and the
//      guides' reach rounded UP to 1e-4 (the guards' convention: a quotation may cover the metal, never fall short
//      of it), the rod's length to 1e-4;
//   4. the first converged site whose boot carries NO link warning (the drift guards, the §112 floor, the arming
//      spring's force window, the beak's and the cranks' stresses — P0/P1 of the link) and no other warning the
//      configuration's own build lacks (digits folded) is the row.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLEAR_MARGIN } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/alarm-link-sites.js');
const ARGS = process.argv.slice(2), WRITE = ARGS.includes('--write'), CHECK = ARGS.includes('--check');
if (WRITE === CHECK) { console.error('usage: node tools/alarm-link-sites.mjs --write | --check [query …]'); process.exit(2); }
// the configurations the repository builds whose link needs a row (each a query string, as index.html reads it)
const CONFIGS = ['alarmmirror=diag&alarmaz=-30'];
const ONLY = ARGS.filter((a) => !a.startsWith('--'));
const LIST = ONLY.length ? ONLY : CONFIGS;
const MAX_CANDIDATES = 6, MAX_ITER = 6;
// the link's own warnings: the drift guards, the site and its floor, the chain's force window and its stresses
const LINK_WARN = /§308|§234|§261 2c|TODO 20[4-6]|TODO 222|TODO 240|TODO 174|§278 landing 6|§112|§137 transfer|§125 dial rim|alarm link:/;
const RUNTIME = /§38\/TODO 8: the alarm's coincidence was crossed/;
const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL|Failed to load resource/i;
const fold = (w) => w.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, '#');
const up4 = (v) => Math.ceil(v * 1e4 - 1e-6) / 1e4, r4 = (v) => Math.round(v * 1e4) / 1e4;

const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
let tableText = null;   // the table the page is served while a row is being judged (null: the file on disk)
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = p === '/src/alarm-link-sites.js' && tableText !== null ? tableText : await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const boot = async (q) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage(), warnings = [];
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&${q}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 900000, polling: 1000 });
  const out = await page.evaluate(() => window.__bootError ? { bootError: String(window.__bootError.message ?? window.__bootError) } : { link: JSON.parse(JSON.stringify(window.__clock.alarmLink)) });
  await ctx.close();
  return { ...out, warnings: warnings.filter((w) => !RUNTIME.test(w)) };
};

const tableOf = (rows) => `// GENERATED by tools/alarm-link-sites.mjs — never edit by hand; re-run the tool (--check re-derives it).
//
// Per configuration whose alarm link cannot keep its measured site (ALARM_LINK_MEASURED_SITE, k 1 run 6 tab 87):
// the site the link takes instead and the constants its chain is cut to there, each converged on that site's own
// built metal (bodyLen, the shaft's body t3 − t1; rodLen, the selector rod; guideHalfT, the guides' tangential
// reach, rounded UP). Keyed by layout.js configKey of the spec with the link's own handles and the case fit dropped.
export const ALARM_LINK_SITES = Object.freeze(${JSON.stringify(rows, null, 1).replace(/\n\s*/g, ' ')});
`;
const loadRows = (text) => { const m = text.match(/ALARM_LINK_SITES = Object\.freeze\(([\s\S]*)\);\s*$/); return m ? JSON.parse(m[1]) : {}; };

const committed = loadRows(readFileSync(OUT, 'utf8'));
const rows = ONLY.length ? { ...committed } : {};
let failed = false;
for (const q of LIST) {
  console.log(`== ${q}`);
  tableText = tableOf({});   // the configuration's own build, as the measured site would leave it
  const base = await boot(`${q}&linkscan=1`);
  if (base.bootError) { console.error(`  boot failed: ${base.bootError}`); failed = true; continue; }
  const key = base.link.key;
  const linkW = base.warnings.filter((w) => LINK_WARN.test(w));
  console.log(`  its own build: site k ${base.link.site.k} run ${base.link.site.run} tab ${base.link.site.tabDeg}°, ${base.warnings.length} warning(s), ${linkW.length} the link's`);
  if (!linkW.length) { console.log('  the measured site serves: no row'); continue; }
  const baseKinds = new Set(base.warnings.filter((w) => !LINK_WARN.test(w)).map(fold));
  // NEAREST THE MEASURED SITE first, not roomiest: the chain's proportions (the arming spring's force window, the
  // beak's lever arms) were designed at the measured site, and the first run of this tool measured them leaving
  // their windows monotonically as the tab walked away from it (seat force 1.1 mN at tab 3, 4.1 at tab 12, against
  // 5–50). Distance is the tab's arc at the ring's tab radius, then the run and the parity step; clearance breaks ties.
  const M = { k: 1, run: 6, tabDeg: 87 };   // ALARM_LINK_MEASURED_SITE (main.js)
  const dTab = (c) => Math.abs(((c.tabDeg - M.tabDeg + 540) % 360) - 180);
  const cands = (base.link.ranking ?? []).filter((c) => c.c >= CLEAR_MARGIN)
    .sort((a, b) => dTab(a) - dTab(b) || Math.abs(a.run - M.run) - Math.abs(b.run - M.run) || Math.abs(a.k - M.k) - Math.abs(b.k - M.k) || b.c - a.c)
    .slice(0, MAX_CANDIDATES);
  console.log(`  ${cands.length} site(s) nearest the measured one, at or over ${CLEAR_MARGIN}: ${cands.map((c) => `k${c.k}/run${c.run}/tab${c.tabDeg} ${c.c}`).join(', ')}`);
  let row = null;
  for (const c of cands) {
    const site = `${c.k},${c.run},${c.tabDeg}`;
    let quote = { ...base.link.quote }, b = null, converged = false;
    for (let it = 1; it <= MAX_ITER; it++) {
      b = await boot(`${q}&linksite=${site}&linkconst=${quote.bodyLen},${quote.rodLen},${quote.guideHalfT}`);
      if (b.bootError || b.link.bodyLen === null || b.link.rodLen === null || b.link.guideHalfT === null) { console.log(`    k${c.k}/run${c.run}/tab${c.tabDeg}: ${b.bootError ? `boot failed (${b.bootError})` : 'the chain was not cut (no built constants)'}`); break; }
      const next = { bodyLen: up4(b.link.bodyLen), rodLen: r4(b.link.rodLen), guideHalfT: up4(b.link.guideHalfT) };
      if (next.bodyLen === quote.bodyLen && next.rodLen === quote.rodLen && next.guideHalfT === quote.guideHalfT) { converged = true; break; }
      quote = next;
    }
    if (!converged) { console.log(`    k${c.k}/run${c.run}/tab${c.tabDeg}: did not converge in ${MAX_ITER} boots`); continue; }
    const lw = b.warnings.filter((w) => LINK_WARN.test(w));
    const extra = b.warnings.filter((w) => !LINK_WARN.test(w) && !baseKinds.has(fold(w)));
    console.log(`    k${c.k}/run${c.run}/tab${c.tabDeg}: converged at body ${quote.bodyLen}, rod ${quote.rodLen}, guides ${quote.guideHalfT}; ${lw.length} link warning(s), ${extra.length} new elsewhere`);
    for (const w of [...lw, ...extra].slice(0, 4)) console.log(`      ${w.slice(0, 200)}`);
    if (lw.length || extra.length) continue;
    row = { site: { k: c.k, run: c.run, tabDeg: c.tabDeg }, consts: quote, clear: c.c, boundBy: c.who, query: q };
    break;
  }
  if (!row) { console.error(`  ${q}: no ranked site converges clean`); failed = true; delete rows[key]; continue; }
  console.log(`  row: k ${row.site.k} run ${row.site.run} tab ${row.site.tabDeg}°`);
  rows[key] = row;
}
await browser.close(); srv.close();
const text = tableOf(rows);
if (CHECK) {
  if (readFileSync(OUT, 'utf8') !== text) { console.error('FAIL: src/alarm-link-sites.js is not what the tool derives — run `node tools/alarm-link-sites.mjs --write`'); process.exit(1); }
  console.log('PASS: src/alarm-link-sites.js re-derives');
} else { await writeFile(OUT, text); console.log(`wrote ${OUT} (${Object.keys(rows).length} row(s))`); }
process.exit(failed ? 1 : 0);
