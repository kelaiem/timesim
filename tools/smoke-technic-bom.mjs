// IS EACH PICTURE IN THE TECHNIC PAGE'S PARTS LIST THE PART IT IS LABELLED, IN A REAL BROWSER, AT A DESKTOP AND AT A PHONE'S WIDTH: NON-BLANK, ITS SILHOUETTE THE SIZE THE PART'S PROJECTED BOUNDS SAY, THE TOTALS THE PURE MODULE'S, THE CSV AND THE BRICKLINK WANTED LIST THE LIST, AND NOTHING OVERFLOWING?
// Acceptance, needs Chromium (Playwright from tools/node_modules); exits
// non-zero on any failure. BUILT §300 (technic.html, src/technic-bom.js,
// src/technic-bom-view.js). The pure half is tools/probe-technic-bom.mjs.
//
// It serves the checkout from a throwaway node http server (never dev_server.py),
// walks every stop of the tour, opens its cell's parts list through the bar's
// "parts" button, and for every picture decodes the PNG in the page and reads the
// bounding box of its opaque pixels. The expectation is computed HERE, in Node,
// from the vendored pack alone (`viewBounds`: the part's triangles projected on
// the picture camera, an independent read of the part the page rendered):
//   · NON-BLANK — at least 0.3% of the picture's pixels are opaque;
//   · THE SAME PART — the silhouette's width and height in pixels equal the box's
//     times the fitting scale (size / 2·half), within 3 px (an edge line and the
//     antialiasing add a pixel a side), and the aspect agrees within 5% where both
//     sides are over 30 px;
//   · TOTALS — each cell's "N parts in M lines" is the pure module's, over all
//     eight builds (technic_2026), and the technic_classic toggle on a cell
//     re-lists it (its own total, no 7785 or 7861);
//   · CSV — the download is the list: its quantities sum to the total and it
//     carries the modelled-not-built note;
//   · ALTERNATIVES (BUILT §309) — every line shows exactly the pure module's
//     alternatives and its "substitutes judged" summary, and the CSV's column is them;
//   · WANTED (BUILT §306) — for row 2 and the fusee, the BrickLink wanted-list
//     download is byte for byte `wantedListXml` computed here, at condition any and
//     after choosing new, and the list carries its not-checked-against-stock note;
//   · LAYOUT — no horizontal overflow of the page or the panel, and the tour bar
//     (with its new button) stays inside the screen, at both widths.
//
// CONTROL: two pictures swapped under each other's labels (a plate under a gear's
// label) must FAIL the same check, and so must a picture blanked out.
// SwiftShader's GPU-stall notices are ignored; any other console error, page error
// or the page's own `ERROR:` line fails.
//
//   node tools/smoke-technic-bom.mjs [--shots DIR] [--chromium PATH]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseLibrary } from '../src/ldraw.js';
import * as B from '../src/technic-bom.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('--shots'), EXE = arg('--chromium') ?? (process.env.CHROMIUM_PATH || undefined);
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.mpd': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, path === '/' ? 'technic.html' : path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/technic.html`;

const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
console.log('reading the expected lists from the pure module...');
const want = B.allBoms(lib);
const wantCell = (gen, cell) => want[gen].find((c) => c.cell === cell);

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log(`  ✗ ${m}`); } return !!c; };
const IGNORE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// the opaque bounding box of each picture of a cell's list, read in the page
const MEASURE = async (page, cell) => page.evaluate(async (cell) => {
  const imgs = [...document.querySelectorAll(`details.bom[data-cell="${cell}"] .bom-line img`)];
  const out = [];
  for (const img of imgs) {
    await img.decode().catch(() => {});
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, x1 = -1, y0 = H, y1 = -1, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    out.push({ part: img.dataset.part, colour: Number(img.dataset.colour), W, H, x0, x1, y0, y1, n, src: img.src.length });
  }
  return out;
}, cell);
// the verdict on one measured picture against its label: returns the problems
const SIZE_TOL = 3, ASPECT_TOL = 0.05;
function problems(m) {
  const bad = [];
  if (!(m.W > 0 && m.H > 0)) return ['no image'];
  if (m.n < 0.003 * m.W * m.H) { bad.push(`blank (${m.n} opaque pixels)`); return bad; }
  const vb = B.viewBounds(lib, m.part), s = m.W / (2 * vb.half);
  const pw = m.x1 - m.x0 + 1, ph = m.y1 - m.y0 + 1;
  if (Math.abs(pw - vb.w * s) > SIZE_TOL) bad.push(`width ${pw}px, the part's box says ${(vb.w * s).toFixed(1)}`);
  if (Math.abs(ph - vb.h * s) > SIZE_TOL) bad.push(`height ${ph}px, the part's box says ${(vb.h * s).toFixed(1)}`);
  if (pw > 30 && ph > 30 && Math.abs(pw / ph / vb.aspect - 1) > ASPECT_TOL) bad.push(`aspect ${(pw / ph).toFixed(2)} vs ${vb.aspect.toFixed(2)}`);
  return bad;
}

async function open(ctx, query, errors) {
  const page = await ctx.newPage();
  page.on('console', (m) => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error' || /^ERROR:|^carousel:/.test(t)) errors.push(`${m.type()}: ${t}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${base}${query}`, { timeout: 180000 });
  await page.waitForFunction(() => window.__technic?.tour?.stops?.length > 0, null, { timeout: 180000 });
  await page.waitForFunction(() => !window.__technic.tour.tweening, null, { timeout: 180000 });
  return page;
}
const ready = (page, cell, gen) => page.waitForFunction(([c, g]) => document.querySelector(`details.bom[data-cell="${c}"] .bom-body`)?.dataset.ready === g, [cell, gen], { timeout: 240000 });

for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844, mobile: true }]) {
  console.log(`\n== ${vp.name} ${vp.width}x${vp.height}`);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await open(ctx, '', errors);
  const stops = await page.evaluate(() => window.__technic.tour.stops.map((s) => ({ id: s.id, cell: s.cell })));
  console.log(`  ${stops.length} stops: ${stops.map((s) => s.id).join(' ')}`);
  ok(stops.length === 10, `${stops.length} stops`);
  ok(await page.locator('#tour-parts').isVisible(), 'the tour bar has no parts button');
  let pictures = 0, nonBlank = 0;
  const seen = new Set();
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    await page.evaluate((i) => window.__technic.tour.go(i, { instant: true }), i);
    await page.waitForFunction(() => !window.__technic.tour.tweening);
    // the bar with its button stays inside the screen
    const geo = await page.evaluate(() => { const b = document.getElementById('tour').getBoundingClientRect(); return { l: b.left, r: b.right, vw: innerWidth, sw: document.scrollingElement.scrollWidth }; });
    ok(geo.l >= 0 && geo.r <= geo.vw + 0.5 && geo.sw <= geo.vw, `${s.id}: the tour bar leaves the screen ${JSON.stringify(geo)}`);
    await page.click('#tour-parts');
    const first = !seen.has(s.cell);
    if (first) await ready(page, s.cell, 'technic_2026');
    seen.add(s.cell);
    ok(await page.evaluate((c) => document.querySelector(`details.bom[data-cell="${c}"]`).open, s.cell), `${s.id}: the parts button did not open ${s.cell}'s list`);
    if (!first) continue;   // motion shares the keyless list, strike the alarm's
    const w = wantCell('technic_2026', s.cell);
    const text = await page.evaluate((c) => document.querySelector(`details.bom[data-cell="${c}"] .bom-body`).innerText, s.cell);
    ok(new RegExp(`\\b${w.bom.total} parts in ${w.bom.lines.length} lines`).test(text), `${s.cell}: the list does not say "${w.bom.total} parts in ${w.bom.lines.length} lines"`);
    const lines = await page.evaluate((c) => [...document.querySelectorAll(`details.bom[data-cell="${c}"] .bom-line`)].map((l) => ({ part: l.dataset.part, colour: Number(l.dataset.colour), qty: Number(l.dataset.qty), alts: [...l.querySelectorAll('.alt')].map((a) => a.textContent), judged: l.querySelector('.alt-judged')?.textContent ?? null })), s.cell);
    ok(lines.length === w.bom.lines.length && lines.every((l, k) => l.part === w.bom.lines[k].part && l.colour === w.bom.lines[k].colour && l.qty === w.bom.lines[k].qty), `${s.cell}: the listed lines are not the pure module's`);
    ok(lines.reduce((n, l) => n + l.qty, 0) === w.bom.total, `${s.cell}: listed quantities do not sum to the total`);
    // BUILT §309: each line shows exactly the pure module's alternatives and its judged summary
    ok(lines.every((l, k) => l.alts.join('|') === w.bom.lines[k].alternatives.map((a) => `alternative: ${a}`).join('|')
      && l.judged === (w.bom.lines[k].substitutes.candidates ? `substitutes judged: ${w.bom.lines[k].alternativesJudged}` : null)), `${s.cell}: the alternatives shown are not the pure module's`);
    const nAlt = lines.reduce((n, l) => n + l.alts.length, 0);
    if (nAlt) console.log(`  ${s.cell}: ${nAlt} alternative(s) shown on ${lines.filter((l) => l.alts.length).length} line(s)`);
    // §304: each list links its build's booklet, in the generation the list is for
    const bk = await page.evaluate((c) => document.querySelector(`details.bom[data-cell="${c}"] a[data-booklet]`)?.getAttribute('href') ?? null, s.cell);
    ok(bk === `./booklet.html?cell=${encodeURIComponent(s.cell)}&gen=technic_2026`, `${s.cell}: the list's booklet link is ${bk}`);
    ok(/Modelled, not built/.test(text) && /LDraw\.org library, CC BY 4\.0/.test(text), `${s.cell}: the honesty or attribution text is missing`);
    ok(w.bom.lines.length && B.NOT_IN_MODEL[w.kind].every((n) => text.includes(n.item)), `${s.cell}: a not-in-the-model item is missing`);
    ok(!/\b(works?|tested|simulated)\b/i.test(text.replace(/keyless works|motion works/gi, '')), `${s.cell}: the list says a forbidden word`);
    // the pictures
    const ms = await MEASURE(page, s.cell);
    ok(ms.length === lines.length, `${s.cell}: ${ms.length} pictures for ${lines.length} lines`);
    let bad = 0;
    for (const m of ms) { pictures++; const pr = problems(m); if (pr.length) { bad++; ok(false, `${s.cell} ${m.part}/${m.colour}: ${pr.join('; ')}`); } else nonBlank++; }
    console.log(`  ${s.cell.padEnd(11)} ${String(w.bom.total).padStart(3)} parts, ${String(lines.length).padStart(2)} lines, ${ms.length - bad}/${ms.length} pictures are their parts`);
    // overflow
    const ov = await page.evaluate(() => { const p = document.getElementById('panel'); return { pw: p.scrollWidth, pc: p.clientWidth, sw: document.scrollingElement.scrollWidth, vw: innerWidth }; });
    ok(ov.pw <= ov.pc + 1 && ov.sw <= ov.vw, `${s.cell}: horizontal overflow ${JSON.stringify(ov)}`);
    // the CSV: its quantities are the list's
    if (s.cell === 'fusee' || s.cell === 'keyless') {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`details.bom[data-cell="${s.cell}"] a[data-csv]`)]);
      const csv = B.parseCsv(readFileSync(await dl.path(), 'utf8')), head = csv[0], q = head.indexOf('quantity');
      const blank = csv.findIndex((r) => r.length === 1 && r[0] === '');
      ok(dl.suggestedFilename() === `technic_2026-${s.cell}.csv` && csv.slice(1, blank).reduce((n, r) => n + Number(r[q]), 0) === w.bom.total
        && csv.slice(1, blank).every((r, k) => r[head.indexOf('alternatives')] === w.bom.lines[k].alternatives.join(' | ')) && csv.some((r) => r[0] === 'note' && /^Modelled, not built\./.test(r[1])), `${s.cell}: the downloaded CSV is not the list (${dl.suggestedFilename()})`);
    }
    // BUILT §306: the BrickLink wanted list is the pure function's XML, byte for byte, at any and at new
    if (s.cell === 'fusee' || s.cell === 'row-2') {
      const sel = `details.bom[data-cell="${s.cell}"] a[data-wanted-xml]`;
      for (const cond of ['X', 'N']) {
        if (cond !== 'X') await page.selectOption(`details.bom[data-cell="${s.cell}"] [data-wanted] select`, cond);
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click(sel)]);
        const xml = readFileSync(await dl.path(), 'utf8'), expect = B.wantedListXml(w, 'technic_2026', { condition: cond });
        ok(dl.suggestedFilename() === `technic_2026-${s.cell}-bricklink-wanted.xml` && xml === expect, `${s.cell}: the downloaded wanted list (${cond}) is not wantedListXml's (${dl.suggestedFilename()}, ${xml.length} vs ${expect.length} bytes)`);
        console.log(`  ${s.cell}: wanted list (${cond}) ${B.parseWantedXml(xml).length} lots, identical to wantedListXml`);
      }
      // the copy button puts the same text on the clipboard (BrickLink's upload page takes it pasted), at the chosen condition
      await page.evaluate(() => navigator.clipboard.writeText('(empty)'));
      await page.click(`details.bom[data-cell="${s.cell}"] button[data-wanted-copy]`);
      await page.waitForFunction((c) => /copied/.test(document.querySelector(`[data-wanted-copied="${c}"]`)?.textContent ?? ''), s.cell, { timeout: 5000 }).catch(() => {});
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      const expectN = B.wantedListXml(w, 'technic_2026', { condition: 'N' });
      ok(clip === expectN, `${s.cell}: the copied wanted list is not wantedListXml's at the chosen condition (${clip.length} vs ${expectN.length} chars)`);
      ok(clip !== B.wantedListXml(w, 'technic_2026', { condition: 'X' }), `${s.cell}: (control) the copy ignores the condition picker`);
      console.log(`  ${s.cell}: copy for BrickLink put ${B.parseWantedXml(clip).length} lots on the clipboard, identical to wantedListXml (N)`);
      ok(/not checked against stock or prices/.test(text) && text.includes(B.WANTED_NOTE.slice(0, 40)), `${s.cell}: the wanted list's note is missing`);
    }
    if (SHOTS && ['fusee', 'keyless', 'alarm'].includes(s.cell)) {
      await page.evaluate((c) => document.querySelector(`details.bom[data-cell="${c}"]`).scrollIntoView({ block: 'start' }), s.cell);
      await page.screenshot({ path: join(SHOTS, `bom-${vp.name}-${s.cell}.png`) });
    }
  }
  ok(seen.size === 8, `${seen.size} builds had a list opened, expected 8`);
  ok(pictures >= 140 && nonBlank === pictures, `${nonBlank} of ${pictures} pictures read as their parts`);
  console.log(`  ${nonBlank} of ${pictures} pictures are non-blank and the size of their parts' projected bounds`);

  // CONTROL: the check must fail a wrong part under a label, and a blank picture
  {
    const cell = 'row-1';
    const ctl = await page.evaluate(async (cell) => {
      const imgs = [...document.querySelectorAll(`details.bom[data-cell="${cell}"] .bom-line img`)];
      // two pictures of different shape: a plate (3024) and a gear (3647 / 3649) or any pair whose parts differ
      const pick = (re) => imgs.find((i) => re.test(i.dataset.part));
      const a = pick(/^3024$/) ?? imgs[0], b = pick(/^(3647|3649|4019|3811|3867)$/) ?? imgs[imgs.length - 1];
      const sa = a.src, sb = b.src;
      a.src = sb; b.src = sa;           // each label now shows the other's picture
      return { a: a.dataset.part, b: b.dataset.part };
    }, cell);
    const swapped = (await MEASURE(page, cell)).filter((m) => m.part === ctl.a || m.part === ctl.b);
    ok(swapped.length >= 2 && swapped.some((m) => problems(m).length > 0), `CONTROL: ${ctl.a} and ${ctl.b} swapped under each other's labels were NOT caught`);
    console.log(`  CONTROL ${ctl.a}/${ctl.b} swapped: ${swapped.map((m) => problems(m).length).join('/')} problems each (must be > 0 for at least one)`);
    const blank = await page.evaluate(async (cell) => {
      const img = document.querySelector(`details.bom[data-cell="${cell}"] .bom-line img`);
      const c = document.createElement('canvas'); c.width = c.height = 160; img.src = c.toDataURL('image/png'); await img.decode().catch(() => {});
      return img.dataset.part;
    }, cell);
    const blanked = (await MEASURE(page, cell)).find((m) => m.part === blank);
    ok(blanked && problems(blanked).some((p) => /blank/.test(p)), 'CONTROL: a blanked picture was NOT caught');
    console.log('  CONTROL blanked picture: caught');
  }

  // the other generation: toggle on a cell that is cheap to build (row-3 differs between the two)
  {
    await page.evaluate(() => window.__technic.tour.go(2, { instant: true }));
    await page.click('#tour-parts');
    await page.click('details.bom[data-cell="row-3"] .gen button[data-gen="technic_classic"]');
    await ready(page, 'row-3', 'technic_classic');
    const w = wantCell('technic_classic', 'row-3');
    const text = await page.evaluate(() => document.querySelector('details.bom[data-cell="row-3"] .bom-body').innerText);
    ok(new RegExp(`\\b${w.bom.total} parts in ${w.bom.lines.length} lines`).test(text) && !/7785|7861/.test(text), `row-3 classic: the toggle did not re-list (${w.bom.total} parts expected)`);
    const ms = await MEASURE(page, 'row-3');
    ok(ms.length === w.bom.lines.length && ms.every((m) => problems(m).length === 0), 'row-3 classic: a picture is not its part');
    // and the 2026 list shows the unofficial flag where it is placed
    await page.evaluate(() => window.__technic.tour.go(4, { instant: true }));
    const flagged = await page.evaluate(() => [...document.querySelectorAll('details.bom[data-cell="keyless"] .bom-line')].filter((l) => /^(7785|7861)$/.test(l.dataset.part)).map((l) => /unofficial/.test(l.innerText)));
    ok(flagged.length === 2 && flagged.every(Boolean), `keyless: the unofficial gears are not both flagged (${flagged})`);
  }
  if (SHOTS) { await page.evaluate(() => window.__technic.tour.go(5, { instant: true })); await page.click('#tour-parts'); await page.waitForTimeout(300); await page.screenshot({ path: join(SHOTS, `bom-${vp.name}-fusee-bar.png`) }); }
  ok(errors.length === 0, `console/page errors: ${errors.slice(0, 4).join(' | ')}`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
