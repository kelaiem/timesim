// TODO 156 (A1) — DOES CAP_SOLVE's OWN B GET JUDGED, EXACTLY ONCE, BY THE
// JUMPER'S SITING SOLVE — AND IS A REFUSAL RECORDED RATHER THAN SILENT?
//
// CAP_SOLVE picks B long before the minute jumper (JMP_SITE) exists, so
// nothing lets the jumper veto a candidate bearing; TODO 160 files the real
// fix (re-cut the fold, plate and reserve late, continuing CAP_SOLVE's own
// order). This probe holds the interim state honest: exactly the scan row
// CAP_SOLVE itself accepted (`clause: 'open'`, `d` matching the shipped
// CAP_BEARING) carries a `jumper` verdict, every earlier-refused row's
// `jumper` stays null (the jumper is never even asked about a B CAP_SOLVE
// already shut), and a refusal is a recorded fact rather than a warning
// nobody reads back.
//
// BOOT A (identity): the shipped tree. Exactly one scan row has `jumper`
// non-null and its `d` is CAP_SOLVE's own bearing; its verdict is 'accepts',
// with azDeg/clr equal to `__clock.jumperSite`'s own published station; boot
// is silent.
//
// BOOT B (the control): rewrites JMP_SITE's own acceptance threshold so NO
// station can pass — a real geometric demand (JMP_SITE_SAT, the solve's own
// clearance cap, plus HMIN) rather than a smaller margin, so the station
// GRID is untouched (a CLEAR_MARGIN rewrite would change it, which is why
// this probe does not touch CM). Then: the recorded verdict is 'refuses',
// jumperSite.clr is null, every candidate was tested (`tested === candidates`,
// 720 at 0.5°), and a boot warning names TODO 156 or TODO 160.
//
// Refuses (exit 1) if its own rewrite was a no-op — the exact line it
// targets not being found in src/main.js — so a drifted line number cannot
// make boot B silently re-run boot A and read as a control.
//
//   node tools/probe-156-jumper-veto.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = process.env.PORT || 8578;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const NEED_LINE = '    const need = Math.max(CM, best ? best.score - JMP_SITE_CAPD_W * cd + HMIN : CM);';
if (!MAIN.includes(NEED_LINE)) {
  console.error(`REFUSED: src/main.js no longer contains the exact line \`${NEED_LINE.trim()}\` — `
    + 'the control rewrites that line, so a drift here would silently re-serve boot A and call it a control.');
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

// blocks /__state writes: the dev server persists pose/camera on PUT, and a
// probe booting twice in a row must not leave the shared state file touched
async function blockState(page) {
  await page.route('**/__state*', (route) => (route.request().method() === 'PUT' ? route.fulfill({ status: 204 }) : route.continue()));
}

async function boot({ rewriteNeed }) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  await blockState(page);
  const warnings = [];
  page.on('console', (m) => {
    if (m.type() !== 'warning') return;
    const t = m.text();
    if (/WebGL|GroupMarker|GL Driver|swiftshader|Deprecation|coplanar/i.test(t)) return;
    warnings.push(t);
  });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 300)));
  if (rewriteNeed) await page.route('**/src/main.js*', async (route) => {
    const r = await route.fetch();
    route.fulfill({ body: (await r.text()).replace(NEED_LINE, '    const need = JMP_SITE_SAT + HMIN;'), contentType: 'text/javascript' });
  });
  let booted = true;
  await page.goto(`http://127.0.0.1:${PORT}/index.html?n=${Date.now()}`, { waitUntil: 'load', timeout: 90000 })
    .catch(() => { booted = false; });
  if (booted) await page.waitForFunction(() => !!(window.__clock && window.__clock.settingFold), null, { timeout: 180000 }).catch(() => { booted = false; });
  if (!booted) { await ctx.close(); return { booted: false, warnings }; }
  const R = await page.evaluate(() => {
    const c = window.__clock;
    return { F: c.settingFold, js: c.jumperSite };
  });
  await ctx.close();
  return { booted: true, warnings, ...R };
}

let bad = 0;
const fail = (s) => { bad++; console.log('  FAIL ' + s); };
const ok = (s) => console.log('  ok   ' + s);

console.log('BOOT A — the shipped tree:');
const A = await boot({ rewriteNeed: false });
if (!A.booted) { fail('did not boot'); }
else {
  const rows = A.F.scan.filter((r) => r.jumper !== null);
  if (rows.length !== 1) fail(`${rows.length} scan row(s) carry a jumper verdict — expected exactly 1`);
  else {
    const row = rows[0];
    if (Math.abs(row.d - A.F.bearingDeg) > 1e-6) fail(`the judged row's d (${row.d}) does not equal CAP_SOLVE's bearing (${A.F.bearingDeg})`);
    else ok(`exactly one scan row carries a jumper verdict, at d ${row.d}° = CAP_SOLVE's bearing`);
    if (row.jumper.verdict !== 'accepts') fail(`boot A's verdict is '${row.jumper.verdict}', expected 'accepts'`);
    else ok('verdict: accepts');
    if (Math.abs(row.jumper.azDeg - A.js.azDeg) > 1e-6) fail(`row.jumper.azDeg ${row.jumper.azDeg} != jumperSite.azDeg ${A.js.azDeg}`);
    else ok(`azDeg ${row.jumper.azDeg.toFixed(4)}° matches jumperSite`);
    if (row.jumper.clr !== A.js.clr) fail(`row.jumper.clr ${row.jumper.clr} != jumperSite.clr ${A.js.clr}`);
    else ok(`clr ${row.jumper.clr} matches jumperSite`);
  }
  if (A.warnings.length) for (const w of A.warnings) fail(`boot A warned: ${w}`);
  else ok('boot A silent');
}

console.log('\nBOOT B — CONTROL, JMP_SITE\'s own acceptance threshold rewritten so no station passes:');
const B = await boot({ rewriteNeed: true });
if (!B.booted) { fail('did not boot'); }
else {
  const rows = B.F.scan.filter((r) => r.jumper !== null);
  if (rows.length !== 1) fail(`${rows.length} scan row(s) carry a jumper verdict — expected exactly 1`);
  else {
    const row = rows[0];
    if (row.jumper.verdict !== 'refuses') fail(`boot B's verdict is '${row.jumper.verdict}', expected 'refuses'`);
    else ok('verdict: refuses');
  }
  if (B.js.clr !== null) fail(`jumperSite.clr is ${B.js.clr}, expected null (no station cleared)`);
  else ok('jumperSite.clr === null');
  if (B.js.tested !== B.js.candidates) fail(`tested ${B.js.tested} !== candidates ${B.js.candidates}`);
  else ok(`tested === candidates (${B.js.candidates})`);
  const named = B.warnings.some((w) => /TODO 156|TODO 160/.test(w));
  if (!named) fail(`no boot warning names TODO 156 or TODO 160 — warnings: ${JSON.stringify(B.warnings)}`);
  else ok('a boot warning names TODO 156/160');
}

await browser.close();
srv.kill();
console.log(bad ? `\nFAIL — ${bad} finding(s)` : '\nPASS — CAP_SOLVE\'s B is judged exactly once, and a refusal is recorded');
process.exit(bad ? 1 : 0);
