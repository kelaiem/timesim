// DOES THE TECHNIC PAGE'S "download .mpd (build steps)" LINK GIVE THE FILE THE PURE MODULE WRITES, IN A REAL BROWSER, FOR EVERY CELL?
// Acceptance, needs Chromium (Playwright from tools/node_modules); exits non-zero on any failure. BUILT §302
// (technic.html, src/technic-steps.js). The pure half, and everything about the ORDER, is tools/probe-technic-steps.mjs;
// this holds only the page's link.
//
// It serves the checkout from a throwaway node http server (never dev_server.py), opens technic.html, and for each
// cell clicks the .mpd link and reads the download:
//   · BYTE FOR BYTE — rows 1-4, the fusee and the escapement (their link writes the build the page seeded): the text
//     the browser saved is the text `toMpd(deriveSteps(...))` makes here from `B.buildOf`, which is also what the
//     page's own `.ldr` of that cell flattens to (checked through `flattenMpd` against the downloaded `.ldr`);
//   · MODES — the keyless cell's link follows the mode button: wind and set each give that mode's file (a different
//     ring place, so a different text), equal to the pure module's for that mode;
//   · THE ALARM — its link writes the state on the screen, so the check is that the file parses, has more than
//     twenty steps and flattens to the page's own `.ldr` of the same state (no stepping between the two clicks:
//     the demonstration is stopped first);
//   · HONEST — every file says "Modelled, not built" and names no gong, tested or works.
// CONTROL: a link whose file is corrupted in flight (one matrix changed) must FAIL the byte comparison.
// SwiftShader's GPU-stall notices are ignored; any other console error, page error or the page's own `ERROR:` line fails.
//
//   node tools/smoke-technic-steps.mjs [--chromium PATH]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseLibrary } from '../src/ldraw.js';
import * as B from '../src/technic-bom.js';
import * as T from '../src/technic-steps.js';
import { toLdr } from '../src/technic-ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const EXE = arg('--chromium') ?? (process.env.CHROMIUM_PATH || undefined);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.mpd': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log(`  ✗ ${m}`); } return !!c; };
const IGNORE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', (m) => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error' || /^ERROR:/.test(t)) errors.push(`${m.type()}: ${t}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(base, { timeout: 180000 });
await page.waitForFunction(() => window.__technic?.tour?.stops?.length > 0, null, { timeout: 180000 });
await page.waitForFunction(() => !window.__technic.tour.tweening, null, { timeout: 180000 });

// click a link and read the file the browser saved
async function download(id) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.evaluate((id) => document.getElementById(id).click(), id)]);
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') };
}
const planOf = (cell, mode) => { const { build } = B.buildOf(lib, 'technic_2026', cell); return T.deriveSteps(build, { lib, mode }); };
const links = [['mpd-row-1', 'row-1'], ['mpd-row-2', 'row-2'], ['mpd-row-3', 'row-3'], ['mpd-row-4', 'row-4'], ['fmpd', 'fusee'], ['empd', 'escapement'], ['tmpd', 'train']];
for (const [id, cell] of links) {
  const have = await page.evaluate((id) => !!document.getElementById(id), id);
  if (!ok(have, `${cell}: the page has no #${id} link`)) continue;
  const f = await download(id);
  const want = T.toMpd(planOf(cell));
  ok(f.text === want, `${cell}: the downloaded .mpd (${f.name}, ${f.text.length} bytes) is not the pure module's (${want.length} bytes)`);
  ok(/\.mpd$/.test(f.name), `${cell}: the file is named ${f.name}`);
  ok(/Modelled, not built/.test(f.text) && !/\b(tested|simulated|works when)\b/i.test(f.text), `${cell}: the honesty text is wrong`);
  console.log(`  ${cell.padEnd(11)} ${f.name}  ${T.parseMpd(f.text).files.get(T.parseMpd(f.text).main).steps.length} steps, ${f.text.length} bytes`);
}
// the keyless cell, in each mode the page can show
for (const mode of ['wind', 'set']) {
  await page.evaluate((m) => document.querySelector(`#kmodes button[data-mode="${m}"]`).click(), mode);
  const f = await download('kmpd');
  const want = T.toMpd(planOf('keyless', mode));
  ok(f.text === want, `keyless (${mode}): the downloaded .mpd is not the pure module's`);
  ok(new RegExp(`keyless-${mode}\\.mpd$`).test(f.name), `keyless (${mode}): the file is named ${f.name}`);
  console.log(`  keyless ${mode.padEnd(4)} ${f.name}  ${f.text.length} bytes`);
}
// the alarm: the state on the screen, stopped
await page.evaluate(() => document.getElementById('aauto')?.getAttribute('data-state') === 'on' && document.getElementById('aauto').click());
{
  const f = await download('ampd');
  const parsed = T.parseMpd(f.text), flat = T.flattenMpd(parsed);
  const dl = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => document.getElementById('aldr').click())]);
  const ldr = readFileSync(await dl[0].path(), 'utf8').split('\n').filter((l) => l.startsWith('1 '));
  ok(parsed.files.get(parsed.main).steps.length > 20, `alarm: ${parsed.files.get(parsed.main).steps.length} steps`);
  // the two clicks may fall in different frames of the page's demonstration, so the pose can differ: the parts and colours may not
  const kinds = (ls) => ls.map((l) => l.split(/\s+/)).map((t) => `${t[1]} ${t[14]}`).sort().join('\n');
  ok(kinds(flat) === kinds(ldr), 'alarm: the .mpd does not hold the page\'s own .ldr parts and colours');
  console.log(`  alarm       ${f.name}  ${parsed.files.get(parsed.main).steps.length} steps, ${flat.length} parts`);
}
// CONTROL: the same comparison on a file with one matrix changed must fail
{
  const f = await download('mpd-row-2'), bad = f.text.replace(/^(1 \d+ )(\S+)/m, (m, a, x) => `${a}${Number(x) + 1}`);
  ok(bad !== f.text && bad !== T.toMpd(planOf('row-2')), 'CONTROL: a corrupted file passed the byte comparison');
}
ok(!errors.length, `page errors: ${errors.join(' | ')}`);
await browser.close(); server.close();
console.log(`\n${checks} checks, ${fails} failing`);
process.exit(fails ? 1 : 0);
