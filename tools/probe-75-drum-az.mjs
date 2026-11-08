// §75 step 1 — WHERE CAN THE MAINSPRING DRUM STAND, judged by the battery's own sweeps? A REPORT (it prints and judges nothing;
// the battery is the gate).
//   node tools/probe-75-drum-az.mjs '<base spec>' AZ [AZ …]      AZ is a ?drumaz= value, or `none` for the build as shipped
//   --fit      on a ?case=free spec, solve each point's free outline first (tools/free-outline.mjs --write --spec) and put
//              src/free-outlines.js back afterwards: without a row the free build falls back to a different path, so an
//              unfitted point would measure the fallback, not the drum
// For each point: a virgin boot (the harness's virginBoot/prepPage), then inspection, clearances and undeclaredClearance
// RESTRICTED to the units the drum carries with it (pairsTouching: the drum, the chain, the set-up work), with the harness's
// own opts. It prints each check's GATE rows (BATTERY's `fails`) that touch those units, the boot warnings, and the drum's
// placement (__clock.drum). Compare a point's rows with `none`'s: a row there too is the build's, not the move's.
//   --units 'A,B,…'   restrict to these units instead (§329 landing 4 sweeps the stop-work and the fusee with the drum's three)
// What it cannot see: pairs not touching the three units (a restricted run, §152's rule), the §35 rod corridor's own probe,
// and the TODO 207 size claim (a moved drum keeps the size solved along the default direction; the build warns if it no
// longer fits the plate).
import { createServer } from 'node:http';
import { readFile, copyFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { BATTERY, YIELD_EVERY, virginBoot, prepPage, runCheck } from './battery-checks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), FIT = args.includes('--fit');
const ui = args.indexOf('--units'), UNITS_ARG = ui >= 0 ? args.splice(ui, 2)[1] : null;
const [BASE, ...AZS] = args.filter((a) => a !== '--fit');
if (!BASE || !AZS.length) { console.error("usage: node tools/probe-75-drum-az.mjs [--fit] '<base spec>' AZ|none [AZ …]"); process.exit(2); }
const UNITS = UNITS_ARG ? UNITS_ARG.split(',').map((u) => u.trim()) : ['Mainspring drum', 'Chain', 'Set-up work'];
const CHECKS = ['inspection', 'clearances', 'undeclaredClearance'];
const { chromium } = createRequire(join(ROOT, 'tools/package.json'))('playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let body;
  try { body = await readFile(join(ROOT, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

const OUTLINES = join(ROOT, 'src/free-outlines.js'), SAVED = `${OUTLINES}.probe75`;
if (FIT) await copyFile(OUTLINES, SAVED);
const touchesUnits = (row) => UNITS.some((u) => JSON.stringify(row).includes(u));
try {
  for (const az of AZS) {
    const q = az === 'none' ? BASE : `${BASE}&drumaz=${az}`;
    console.log(`\n=== ${q}`);
    if (FIT && /(^|&)case=free(&|$)/.test(q)) {
      const spec = q.split('&').filter((kv) => !kv.startsWith('case=')).join('&');
      const r = spawnSync(process.execPath, [join(ROOT, 'tools/free-outline.mjs'), '--write', '--spec', spec], { encoding: 'utf8', cwd: ROOT });
      const last = (r.stdout + r.stderr).split('\n').filter((l) => /^round \d/.test(l)).pop() ?? '(no round printed)';
      console.log(`  fit: ${r.status === 0 ? 'settled' : 'DID NOT SETTLE'} — ${last.replace(/\(scan [^)]*\) /, '').slice(0, 160)}`);
    }
    const { context, page } = await virginBoot(browser, base, 400000, `?trial=1&${q}`);
    try {
      const warns = await prepPage(page);
      const drum = await page.evaluate(() => window.__clock.drum);
      console.log(`  drum: az ${drum.azDeg.toFixed(2)}°, centre (${drum.x.toFixed(2)}, ${drum.y.toFixed(2)}), dist ${drum.dist.toFixed(2)}`);
      console.log(`  boot warnings (${warns.length}):${warns.length ? '' : ' none'}`);
      for (const w of warns) console.log(`    · ${String(w).slice(0, 170)}`);
      for (const name of CHECKS) {
        const entry = BATTERY.find((e) => e.name === name);
        const { result, ms } = await runCheck(page, name, { ...entry.opts, yieldEvery: YIELD_EVERY, pairsTouching: UNITS }, 1800000);
        const rows = entry.fails(result).filter(touchesUnits);
        console.log(`  ${name}: ${rows.length} gate row(s) touching the drum's units (${(ms / 1000).toFixed(0)} s)`);
        for (const row of rows.slice(0, 12)) console.log(`    · ${JSON.stringify(row).slice(0, 220)}`);
      }
    } finally { await context.close(); }
  }
} finally {
  if (FIT) { await copyFile(SAVED, OUTLINES); await unlink(SAVED); }
  await browser.close();
  srv.close();
}
