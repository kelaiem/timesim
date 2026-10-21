// IS THE BOOKLET WHAT A READER GETS: A PAGE OF SHEETS THAT FIT THE PAPER, PICTURES THAT ARE THE STEPS, A PDF WITH AS MANY PAGES AS THE SHEETS, EVERY STEP THE CHECK COULD NOT CLEAR MARKED?
// Acceptance, needs Chromium (Playwright from tools/node_modules); exits non-zero on any failure. BUILT §304 (booklet.html,
// src/technic-booklet*.js). The data and the flow are tools/probe-technic-booklet.mjs (pure Node); this holds the page in a real
// browser. It serves the checkout from a throwaway node http server (never dev_server.py).
//
// For each (cell, paper):
//   · READY — every picture drawn (none missing, none failed), no console error, no page error;
//   · SHEETS — each sheet is the paper's size (US Letter 816×1056 CSS px, A4 793.7×1122.5), its content fits (nothing runs past the
//     box, no text clipped sideways), every step on exactly one sheet in order, the sheets are the pure layout's pages (the same
//     `paginate` over the MEASURED heights) and the page count is reported against the pure ESTIMATE;
//   · PICTURES — each is non-blank; the picture on the page is the step's spec drawn again (pixel for pixel), the new parts
//     differ from the same view drawn with everything pale, and the cover's and the closing page's pictures show the whole build;
//   · PDF — `page.pdf` with the page's own @page size has as many pages as there are sheets, and the paper's size (612×792 pt
//     for Letter, 595×842 for A4);
//   · PRINT — the chrome (controls, status) is gone in print media;
//   · MARKS — every step the validator could not clear carries a visible red marker with its reason, and nothing else does;
//     an unofficial part's pip says so; a posed band says modelled, not built beside it.
// CONTROLS (each seen to fail): a step drawn without its new parts; the displayed picture compared with the step before's; a blanked
// picture; a sheet's content overfilled; the paper size changed under the sheets; the flagged markers removed.
//
//   node tools/smoke-technic-booklet.mjs [--chromium PATH] [--all]      (default: row 2 at both papers, the fusee at Letter, the keyless works at A4)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve, pdfPages, LAUNCH } from './booklet-pdf.mjs';
import { BOOKLET_FLAGS } from '../src/technic-booklet-flags.js';
import * as K from '../src/technic-booklet.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const EXE = arg('--chromium') ?? (process.env.CHROMIUM_PATH || undefined);
const ALL = process.argv.includes('--all');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log(`  ✗ ${m}`); } return !!c; };
const controls = [];
const control = (name, caught) => { controls.push([name, !!caught]); };
const IGNORE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
const PDF_PT = { letter: [612, 792], a4: [595.28, 841.89] };
const SHARED = ['fusee', 'alarm', 'escapement'];

const { server, base } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, ...LAUNCH });
const ONE = arg('--run');                                          // cell:paper
const RUNS = ONE ? [{ cell: ONE.split(':')[0], paper: ONE.split(':')[1] }] : ALL
  ? ['row-1', 'row-2', 'row-3', 'row-4', 'keyless', 'fusee', 'alarm', 'escapement'].flatMap((cell) => ['letter', 'a4'].map((paper) => ({ cell, paper })))
  : [{ cell: 'row-2', paper: 'letter' }, { cell: 'row-2', paper: 'a4' }, { cell: 'fusee', paper: 'letter' }, { cell: 'keyless', paper: 'a4' }];
const measured = [];

async function open(cell, paper, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1300 } });
  const page = await ctx.newPage(), errors = [];
  page.on('console', (m) => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error') errors.push(`console: ${t}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const q = new URLSearchParams({ cell, gen: 'technic_2026', paper, ...extra });
  await page.goto(`${base}/booklet.html?${q}`, { timeout: 180000 });
  await page.waitForFunction(() => document.body.dataset.ready === '1' || ['unframed', 'nogl'].includes(window.__booklet?.stage), null, { timeout: 900000, polling: 500 });
  return { ctx, page, errors };
}

for (const { cell, paper } of RUNS) {
  const label = `${cell} / ${paper}`;
  const t = performance.now();
  const { ctx, page, errors } = await open(cell, paper);
  const st = await page.evaluate(() => ({ stage: window.__booklet.stage, errors: window.__booklet.errors, rendered: window.__booklet.rendered, total: window.__booklet.total, pages: window.__booklet.pages }));
  ok(st.stage === 'ready', `${label}: stage ${st.stage}`);
  ok(st.rendered === st.total && st.total > 0 && !st.errors.length, `${label}: ${st.rendered}/${st.total} pictures, errors ${st.errors.join('; ')}`);
  const P = K.PAPERS[paper], C = K.contentBox(P);

  // ---- SHEETS: geometry, fit, order
  const geo = await page.evaluate(() => {
    const out = { sheets: [], steps: [], overflow: [], clipped: [], itemsPerSheet: [] };
    for (const s of document.querySelectorAll('.sheet')) {
      const r = s.getBoundingClientRect(), c = s.querySelector('.content'), cr = c.getBoundingClientRect();
      out.sheets.push({ w: r.width, h: r.height, cw: cr.width, ch: cr.height, left: cr.left - r.left, top: cr.top - r.top, scrollH: c.scrollHeight, clientH: c.clientHeight, scrollW: c.scrollWidth, clientW: c.clientWidth });
      let worst = 0; for (const k of c.children) worst = Math.max(worst, k.getBoundingClientRect().bottom - cr.bottom);
      out.overflow.push(worst);
      out.itemsPerSheet.push([...c.children].map((k) => k.dataset.item));
      for (const k of c.querySelectorAll('h1,h2,h3,p,.mark,.pname,.pbl,li,.ct,.pip .pid')) if (k.scrollWidth > k.clientWidth + 1 && getComputedStyle(k).overflow === 'hidden' && !k.matches('.ct')) out.clipped.push(k.textContent.slice(0, 40));
      for (const k of c.querySelectorAll('.pic, .card, .prow, .chapter')) { const kr = k.getBoundingClientRect(); if (kr.right > cr.right + 1 || kr.left < cr.left - 1) out.clipped.push(`${k.className} ${(kr.right - cr.right).toFixed(1)}`); }
      for (const k of s.querySelectorAll('.card[data-step]')) out.steps.push(Number(k.dataset.step));
      const fin = s.querySelector('.final'); if (fin) out.steps.push(Number(fin.dataset.step));
    }
    return out;
  });
  const nSteps = await page.evaluate(() => window.__booklet.plan.steps.length);
  ok(geo.sheets.every((s) => Math.abs(s.w - P.w) < 1 && Math.abs(s.h - P.h) < 1), `${label}: a sheet is not ${P.w.toFixed(1)}×${P.h.toFixed(1)} (${geo.sheets.map((s) => `${s.w.toFixed(1)}×${s.h.toFixed(1)}`).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`);
  ok(geo.sheets.every((s) => Math.abs(s.cw - C.w) < 1 && Math.abs(s.ch - C.h) < 1 && Math.abs(s.left - K.MARGIN_PX) < 1), `${label}: a content box is not the derived one`);
  ok(geo.sheets.every((s) => s.scrollH <= s.clientH + 1 && s.scrollW <= s.clientW + 1), `${label}: a sheet's content runs past its box (${geo.sheets.map((s) => s.scrollH - s.clientH).join(',')})`);
  ok(geo.overflow.every((o) => o <= 0.5), `${label}: an item ends ${Math.max(...geo.overflow).toFixed(1)} px below the box`);
  ok(geo.clipped.length === 0, `${label}: text or a box clipped sideways: ${geo.clipped.slice(0, 3).join(' | ')}`);
  ok(geo.steps.join() === Array.from({ length: nSteps }, (_, i) => i + 1).join(), `${label}: the steps on the sheets are ${geo.steps.join(',')}, not 1..${nSteps} once each in order`);
  // the DOM's pages are `paginate` over the measured heights, and the estimate's pages are reported against them
  const flow = await page.evaluate(() => ({ dom: [...document.querySelectorAll('.sheet')].map((s) => [...s.querySelector('.content').children].map((k) => k.dataset.item)), pure: window.__booklet.flow.pages.map((p) => p.items), items: window.__booklet.items.map((i) => ({ id: i.id, type: i.type, own: !!i.own, newPage: !!i.newPage, keepNext: !!i.keepNext, est: i.est, h: i.h })) }));
  ok(JSON.stringify(flow.dom) === JSON.stringify(flow.pure), `${label}: the sheets are not the layout's pages`);
  const estPages = K.paginate(flow.items.map((i) => ({ ...i, h: i.est })), C.h).pages.length;   // the pure layout's page count: the same flags, the estimated heights
  ok(estPages >= geo.sheets.length, `${label}: the pure layout says ${estPages} pages and the browser needed ${geo.sheets.length}: the estimate is not conservative`);
  const under = flow.items.filter((i) => !['cover', 'final'].includes(i.id) && i.h > i.est + 1);
  measured.push({ label, sheets: geo.sheets.length, estimate: estPages, under: under.length, worst: under.reduce((m, i) => Math.max(m, i.h - i.est), 0), secs: Math.round((performance.now() - t) / 1000) });
  ok(under.length === 0, `${label}: the estimate is below the measured height for ${under.map((i) => `${i.id} (+${(i.h - i.est).toFixed(1)})`).slice(0, 8).join(', ')}`);

  // ---- PICTURES
  const pics = await page.evaluate(async () => {
    const out = [];
    for (const im of document.querySelectorAll('.pic img, .hero img')) {
      const hero = !!im.closest('.hero');
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data; let ink = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) ink++;
      const card = im.closest('[data-step]');
      out.push({ hero, n: hero ? (im.closest('.cover') ? 'cover' : 'final') : Number(card.dataset.step), w: im.naturalWidth, h: im.naturalHeight, ink: ink / (c.width * c.height), drawn: !!im.dataset.drawn });
    }
    return out;
  });
  ok(pics.every((p) => p.drawn && p.w > 0), `${label}: a picture is not drawn`);
  ok(pics.every((p) => p.ink > 0.01), `${label}: a blank picture: ${pics.filter((p) => p.ink <= 0.01).map((p) => p.n).join(',')}`);
  const box = K.imageBox(P);
  ok(pics.filter((p) => !p.hero).every((p) => p.w === box.w * K.RENDER_SCALE && p.h === box.h * K.RENDER_SCALE), `${label}: a step picture is not ${box.w * K.RENDER_SCALE}×${box.h * K.RENDER_SCALE}`);
  // the picture on the page is the step's spec drawn again; the new parts show against the pale view; the controls
  const probe = await page.evaluate(() => {
    const B = window.__booklet, r = B.renderer, out = { same: [], differ: [], ctl: {} };
    const pix = (spec) => r.pixels(spec);
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) n++; return n / (a.w * a.h); };
    const shown = (n) => { const im = document.querySelector(`.card[data-step="${n}"] .pic img`); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data }; };
    const cards = B.model.steps.filter((s) => s.view && s.kind !== 'final' && s.callout.length);
    const pick = cards.filter((_, i) => i % Math.max(1, Math.floor(cards.length / 6)) === 0).slice(0, 6);
    for (const s of pick) {
      const spec = s.view, a = pix(spec), d = diff(a, shown(s.n));
      out.same.push([s.n, d]);
      if (spec.ghost.length) { const pale = pix({ ...spec, ghost: [...spec.ghost, ...spec.fresh], fresh: [] }); out.differ.push([s.n, diff(a, pale)]); }
    }
    // controls: step n's picture against the one drawn with the step before's parts; a step drawn without its new parts
    const s = pick.find((x) => x.view.ghost.length) ?? pick[0], prev = B.model.steps.filter((x) => x.view && x.n < s.n && x.callout.length).pop();
    out.ctl.n = s.n; out.ctl.prev = prev?.n ?? null;
    if (prev) out.ctl.vsPrev = diff(pix(prev.view), shown(s.n));
    out.ctl.noNew = diff(pix({ ...s.view, ghost: [...s.view.ghost, ...s.view.fresh], fresh: [] }), pix({ ...s.view, ghost: [...s.view.ghost, ...s.view.fresh], fresh: [] }));
    return out;
  });
  ok(probe.same.length > 0 && probe.same.every(([, d]) => d < 0.002), `${label}: a displayed picture is not its spec drawn again: ${probe.same.filter(([, d]) => d >= 0.002).map(([n, d]) => `${n}:${d.toFixed(3)}`).join(' ')}`);
  ok(probe.differ.every(([, d]) => d > 0.004), `${label}: a step's new parts do not differ from the pale view: ${probe.differ.map(([n, d]) => `${n}:${d.toFixed(4)}`).join(' ')}`);
  if (probe.ctl.prev != null) control(`${label}: step ${probe.ctl.n}'s picture drawn with step ${probe.ctl.prev}'s parts differs from the page's`, probe.ctl.vsPrev > 0.002);
  control(`${label}: a step drawn without its new parts shows no highlight`, probe.ctl.noNew < 0.004);

  // ---- HONESTY and MARKS in the DOM
  const dom = await page.evaluate(() => {
    const txt = document.getElementById('book').innerText;
    const flagged = [...document.querySelectorAll('.card.hasflag')].map((c) => ({ n: Number(c.dataset.step), reason: [...c.querySelectorAll('.mark.flagged, .mark.overlap')].map((m) => m.textContent).join(' ') }));
    const notes = [...document.querySelectorAll('.card.k-note')].map((c) => c.textContent);
    return { cover: document.querySelector('.cover')?.innerText ?? '', txt, flagged, notes, unofficial: [...document.querySelectorAll('.pip.unofficial')].map((p) => p.querySelector('.pid').textContent), plan: window.__booklet.model.meta.flagsKey };
  });
  ok(/Modelled, not built/.test(dom.cover) && /CC BY/.test(dom.cover) && /LDraw/.test(dom.cover), `${label}: the cover lacks modelled-not-built or the LDraw attribution`);
  ok(!/\bsimulat/i.test(dom.txt) && !/\b(?:works when|tested|guarantee)/i.test(dom.txt), `${label}: the pages say simulated, works, tested or guaranteed`);
  ok(dom.notes.every((n) => /Modelled, not built/.test(n)), `${label}: a posed or not-in-model step does not say modelled, not built beside it`);
  const wantFlag = Object.entries(BOOKLET_FLAGS[dom.plan].steps).filter(([, s]) => (s.items ?? []).some((i) => i.s === 'flagged' || i.s === 'overlap')).map(([n]) => Number(n));
  ok(dom.flagged.map((f) => f.n).join() === wantFlag.join(), `${label}: flagged steps on the pages ${dom.flagged.map((f) => f.n)} are not the validator's ${wantFlag}`);
  ok(dom.flagged.every((f) => /(NOT CLEARED|TWO SOLIDS IN EACH OTHER)/.test(f.reason) && /TODO 264/.test(f.reason)), `${label}: a flagged step shows no reason`);
  if (cell === 'keyless') ok(dom.unofficial.length > 0 && dom.unofficial.every((t) => /unofficial/.test(t)), `${label}: unofficial parts are not flagged on their pips`);
  if (wantFlag.length) {
    // CONTROL: the flagged markers removed from the page; the same comparison must fail
    const after = await page.evaluate(() => { for (const m of document.querySelectorAll('.mark.flagged, .mark.overlap')) m.remove(); for (const c of document.querySelectorAll('.card.hasflag')) c.classList.remove('hasflag'); return [...document.querySelectorAll('.card.hasflag')].map((c) => Number(c.dataset.step)); });
    control(`${label}: the flagged markers removed are caught`, after.join() !== wantFlag.join());
  }

  // ---- PRINT: the PDF has the sheets' count and the paper's size; the chrome is gone in print media
  await page.emulateMedia({ media: 'print' });
  const chromeGone = await page.evaluate(() => getComputedStyle(document.getElementById('chrome')).display === 'none');
  ok(chromeGone, `${label}: the controls print`);
  if (wantFlag.length) await page.reload({ timeout: 180000 }).catch(() => {});      // markers were removed for the control above
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 900000, polling: 500 });
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const sheetsNow = await page.evaluate(() => document.querySelectorAll('.sheet').length);
  const pages = pdfPages(pdf), mb = /MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString('latin1'));
  ok(pages === sheetsNow, `${label}: the PDF has ${pages} pages for ${sheetsNow} sheets`);
  ok(mb && Math.abs(Number(mb[1]) - PDF_PT[paper][0]) < 1 && Math.abs(Number(mb[2]) - PDF_PT[paper][1]) < 1, `${label}: the PDF page is ${mb?.[1]}×${mb?.[2]} pt, not ${PDF_PT[paper].join('×')}`);
  measured[measured.length - 1].pdf = pages;
  await page.emulateMedia({ media: 'screen' });

  // ---- CONTROLS on the page itself
  if (cell === 'row-2' && paper === 'letter') {
    const blank = await page.evaluate(() => { const im = document.querySelector('.card[data-step="7"] .pic img'); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); im.src = c.toDataURL(); return new Promise((r) => { im.onload = () => { const d = g.getImageData(0, 0, 1, 1); const c2 = document.createElement('canvas'); c2.width = im.naturalWidth; c2.height = im.naturalHeight; const g2 = c2.getContext('2d', { willReadFrequently: true }); g2.drawImage(im, 0, 0); const dd = g2.getImageData(0, 0, c2.width, c2.height).data; let ink = 0; for (let i = 0; i < dd.length; i += 4) if (dd[i] < 245) ink++; void d; r(ink / (c2.width * c2.height)); }; }); });
    control('a blanked picture reads blank', blank <= 0.01);
    const over = await page.evaluate(() => { const c = document.querySelector('.sheet[data-page="5"] .content'); const d = document.createElement('div'); d.style.height = '300px'; c.append(d); return c.scrollHeight - c.clientHeight; });
    control('a sheet overfilled runs past its box', over > 1);
    const size = await page.evaluate(() => { document.documentElement.style.setProperty('--pw', '8.5in'); document.documentElement.style.setProperty('--ph', '11in'); const r = document.querySelector('.sheet').getBoundingClientRect(); return [r.width, r.height]; });
    void size;
  }
  if (cell === 'row-2' && paper === 'a4') {
    const letterOnA4 = await page.evaluate(() => { document.documentElement.style.setProperty('--pw', '8.5in'); document.documentElement.style.setProperty('--ph', '11in'); const r = document.querySelector('.sheet').getBoundingClientRect(); return [r.width, r.height]; });
    control('the paper size changed under the sheets is caught', !(Math.abs(letterOnA4[0] - P.w) < 1 && Math.abs(letterOnA4[1] - P.h) < 1));
  }
  ok(!errors.length, `${label}: ${errors.join(' | ')}`);
  console.log(`  ${label.padEnd(22)} ${String(st.pages).padStart(2)} sheets, ${st.total} pictures, ${Math.round((performance.now() - t) / 1000)} s`);
  await ctx.close();
}

// ---- A PHONE: the sheets are zoomed down to the screen and nothing scrolls sideways
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}/booklet.html?cell=row-2&gen=technic_2026&paper=a4`, { timeout: 180000 });
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 900000, polling: 500 });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sheet: document.querySelector('.sheet').getBoundingClientRect().width, chrome: document.getElementById('chrome').getBoundingClientRect().width }));
  ok(m.sw <= m.cw + 1, `a 390 px screen scrolls sideways (${m.sw} > ${m.cw})`);
  ok(m.sheet <= m.cw, `a sheet is wider than a 390 px screen (${m.sheet.toFixed(0)})`);
  await ctx.close();
}
// ---- THE CHROME: the controls change the URL; the paper select is the page's paper
{
  const { ctx, page } = await open('row-2', 'a4');
  await page.selectOption('#sel-paper', 'letter');
  await page.waitForURL(/paper=letter/, { timeout: 30000 });
  ok(/cell=row-2/.test(page.url()) && /gen=technic_2026/.test(page.url()), 'the paper control keeps the build in the URL');
  await ctx.close();
}
for (const [name, caught] of controls) ok(caught, `control not caught: ${name}`);
console.log(controls.map(([n, c]) => `  ${c ? 'ok  ' : 'MISS'} ${n}`).join('\n'));
console.log('\nSHEETS (the browser) against the pure estimate');
for (const m of measured) console.log(`  ${m.label.padEnd(22)} sheets ${m.sheets}, pdf ${m.pdf}, estimate ${m.estimate}${m.estimate !== m.sheets ? '  (differs)' : ''}, estimate low on ${m.under} items${m.under ? ` by up to ${m.worst.toFixed(1)} px` : ''}`);
console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${checks} checks, ${controls.length} controls, ${fails} failed`);
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
