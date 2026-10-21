#!/usr/bin/env node
// PRINTS A LEGO BOOKLET TO PDF (BUILT §304): opens booklet.html in Chromium (Playwright from tools/node_modules),
// waits for every picture, and writes the PDF the browser's own Print → Save as PDF would, at the paper's size
// (`@page` carries it, so `preferCSSPageSize`). A dev tool for the owner and for the smoke test's page counts —
// not a CI step, and not a dependency of the page.
//
//   node tools/booklet-pdf.mjs --out DIR [--cell row-2|all] [--paper letter|a4|both] [--gen technic_2026] [--mode wind]
//                              [--png] [--chromium PATH]
//
// Writes DIR/<gen>-<cell>[-<mode>]-<paper>.pdf and prints `pages` for each (the PDF's own count, read from its
// /Type /Page objects, and the sheets the page set; a dev tool, it exits non-zero only on a bad invocation, so the index files it
// as acceptance); with --png also DIR/<same>-p<N>.png of each sheet.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const CELLS = ['row-1', 'row-2', 'row-3', 'row-4', 'keyless', 'fusee', 'alarm', 'escapement'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.mpd': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

export async function serve(root = ROOT) {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      const body = await readFile(join(root, path === '/' ? 'booklet.html' : path));
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
export const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
export const LAUNCH = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = arg('--out'); if (!out) { console.error('usage: --out DIR [--cell C|all] [--paper letter|a4|both] [--gen G] [--mode M] [--png]'); process.exit(2); }
  await mkdir(out, { recursive: true });
  const cells = arg('--cell', 'row-2') === 'all' ? CELLS : [arg('--cell', 'row-2')];
  const papers = arg('--paper', 'both') === 'both' ? ['letter', 'a4'] : [arg('--paper')];
  const gen = arg('--gen', 'technic_2026'), mode = arg('--mode');
  const { server, base } = await serve();
  const browser = await chromium.launch({ executablePath: arg('--chromium') ?? (process.env.CHROMIUM_PATH || undefined), ...LAUNCH });
  for (const cell of cells) for (const paper of papers) {
    const page = await (await browser.newContext({ viewport: { width: 1000, height: 1200 } })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const q = new URLSearchParams({ cell, gen, paper }); if (mode) q.set('mode', mode);
    await page.goto(`${base}/booklet.html?${q}`, { timeout: 180000 });
    await page.waitForFunction(() => document.body.dataset.ready === '1' || ['unframed', 'nogl'].includes(window.__booklet?.stage), null, { timeout: 900000, polling: 500 });
    const name = `${gen}-${cell}${mode ? `-${mode}` : ''}-${paper}`;
    const info = await page.evaluate(() => ({ stage: window.__booklet.stage, sheets: document.querySelectorAll('.sheet').length, errors: window.__booklet.errors }));
    if (info.stage !== 'ready') { console.log(`${name}: ${info.stage}`); continue; }
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await writeFile(join(out, `${name}.pdf`), pdf);
    console.log(`${name}: ${info.sheets} sheets, pdf ${pdfPages(pdf)} pages, ${(pdf.length / 1e6).toFixed(1)} MB${info.errors.length || errors.length ? ` ERRORS ${[...info.errors, ...errors].join('; ')}` : ''}`);
    if (has('--png')) { await page.emulateMedia({ media: 'print' }); }
    if (has('--png')) for (let k = 1; k <= info.sheets; k++) await page.locator(`.sheet[data-page="${k}"]`).screenshot({ path: join(out, `${name}-p${k}.png`) });
    await page.context().close();
  }
  await browser.close(); server.close();
}
