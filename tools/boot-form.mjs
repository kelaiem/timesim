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
  // everything after the launch runs under `finally`: a boot that throws (an expression reading a field the spec does not build, a
  // timeout) must still close its browser and its server, or each failure leaves both running (the instruments skill's orphan trap)
  try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const warnings = [];
  const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?trial=1&hud=0&sync=0${query ? '&' + query : ''}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 400000 });
  const out = await page.evaluate(async (ex) => window.__bootError ? { bootError: String(window.__bootError.message ?? window.__bootError) }
    : { ff: window.__clock.formFootprint, extra: ex ? await (0, eval)(ex) : null }, expr);
  // A query key the page does not read is IGNORED, silently, and the boot is the default's: `barrel=-140` for `barrelstep=-140`
  // measured the wrong arrangement for a whole probe (§329 landing 3b). So name every key that is neither a spec key
  // (index.html's SPEC_FIELDS, published as __WATCH_SPEC_KEYS) nor one of the page's own parameters.
  const known = await page.evaluate(() => globalThis.__WATCH_SPEC_KEYS ?? null);
  const PAGE_KEYS = ['trial', 'hud', 'sync', 'lang', 'reconf', 'cam', 'focus', 'tour', 'cell'];
  out.unknownKeys = known ? [...new URLSearchParams(query)].map(([k]) => k).filter((k) => !known.includes(k) && !PAGE_KEYS.includes(k)) : null;
  return { ...out, warnings };
  } finally { await browser.close().catch(() => {}); srv.close(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await bootForm(process.argv[2] ?? '', process.argv[3] ?? null);
  if (r.ff) { const { hull, ...ff } = r.ff; console.log(JSON.stringify(ff, null, 1)); }
  if (r.bootError) console.log('BOOT ERROR', r.bootError);
  if (r.unknownKeys?.length) console.log(`UNKNOWN QUERY KEY(S), IGNORED BY THE PAGE: ${r.unknownKeys.join(', ')} — this boot is NOT the spec you asked for`);
  if (r.extra !== null && r.extra !== undefined) console.log('extra', JSON.stringify(r.extra, null, 1));
  console.log(`${r.warnings.length} warning(s)`); for (const w of r.warnings) console.log('  ' + w.slice(0, 600));
}
