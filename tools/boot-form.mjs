// Boot one build headless and print what it measured: `node tools/boot-form.mjs '<query>' [expr]`.
// A REPORT (§317): the form footprint, the warnings the
// build printed (rule 6), and optionally a JSON-able expression over __clock.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = process.env.BOOT_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');   // BOOT_ROOT serves another tree (a base checkout, to compare)
export async function bootForm(query, expr = null) {
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
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const warnings = [];
  const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?trial=1&hud=0&sync=0${query ? '&' + query : ''}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 400000 });
  const out = await page.evaluate(async (ex) => window.__bootError ? { bootError: String(window.__bootError.message ?? window.__bootError) }
    : { ff: window.__clock.formFootprint, extra: ex ? await (0, eval)(ex) : null }, expr);
  await browser.close(); srv.close();
  return { ...out, warnings };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await bootForm(process.argv[2] ?? '', process.argv[3] ?? null);
  if (r.ff) { const { hull, ...ff } = r.ff; console.log(JSON.stringify(ff, null, 1)); }
  if (r.bootError) console.log('BOOT ERROR', r.bootError);
  if (r.extra !== null && r.extra !== undefined) console.log('extra', JSON.stringify(r.extra, null, 1));
  console.log(`${r.warnings.length} warning(s)`); for (const w of r.warnings) console.log('  ' + w.slice(0, 600));
}
