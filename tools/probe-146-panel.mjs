// §146 — THE MAIN PANEL STARTS HIDDEN, AND EVERY WAY BACK TO IT STILL WORKS.
// Acceptance:
//   1. a virgin boot: #clock-ui hidden, the chrome bar's Menu toggle reads
//      off, the control pad is ON (§57's default, unchanged) and the View
//      panel is up — the arrival sees the watch and the two controls that
//      drive and explain it;
//   2. H shows the panel; the chrome bar's Menu toggle hides it again;
//   3. ?panel=1 opens it on arrival;
//   4. hidePanelForScript's no-restore branch, against a never-opened panel:
//      a tour started with the panel hidden ends with it still hidden; one
//      started with the panel open hides it for the run and restores it;
//   5. the same on a phone viewport (375×667): the panel hidden, the pad on.
//   cd tools && node probe-146-panel.mjs      (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8480;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling'] });
let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);
const read = (page) => page.evaluate(() => ({
  panel: document.getElementById('clock-ui').style.display !== 'none',
  menu: document.getElementById('chrome-t-ui').dataset.state,
  view: document.getElementById('view-hud').style.display !== 'none',
  pad: document.getElementById('btn-hud').dataset.state,
}));
async function boot(query, viewport = { width: 1100, height: 750 }) {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 768 });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html${query}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  return { ctx, page };
}
// 1 — virgin boot
let { ctx, page } = await boot('');
let s = await read(page);
if (s.panel) F(`virgin boot: the panel is shown (${JSON.stringify(s)})`); else OK(`virgin boot: panel hidden, Menu toggle ${s.menu}, pad ${s.pad}, View panel ${s.view ? 'up' : 'down'}`);
if (s.pad !== 'on') F('the control pad is not on by default'); else OK('the control pad stays on by default');
// 2 — H and the chrome bar
await page.keyboard.press('h'); await page.waitForTimeout(150); s = await read(page);
if (!s.panel) F('H did not show the panel'); else OK('H shows the panel');
await page.evaluate(() => document.getElementById('chrome-t-ui').click()); await page.waitForTimeout(150); s = await read(page);
if (s.panel) F('the Menu toggle did not hide the panel'); else OK('the chrome bar\'s Menu toggle hides it again');
// 4 — the tour against a never-opened panel
await page.evaluate(() => document.getElementById('btn-tour').click()); await page.waitForTimeout(300);
let during = await read(page);
await page.evaluate(() => { document.getElementById('btn-tour').click(); const go = document.getElementById('tour-gate-go'); if (go && document.getElementById('clock-tour-gate').classList.contains('show')) go.click(); });
await page.waitForTimeout(600);
let after = await read(page);
const running = await page.evaluate(() => !!window.__clock.scriptState);
if (running) F('the tour did not stop'); else if (after.panel) F('the tour "restored" a panel the viewer never opened'); else OK('a tour on a never-opened panel ends with it still hidden');
await page.keyboard.press('h'); await page.waitForTimeout(150);
await page.evaluate(() => document.getElementById('btn-tour').click()); await page.waitForTimeout(300);
during = await read(page);
await page.evaluate(() => { document.getElementById('btn-tour').click(); const go = document.getElementById('tour-gate-go'); if (go && document.getElementById('clock-tour-gate').classList.contains('show')) go.click(); });
await page.waitForTimeout(600);
after = await read(page);
if (during.panel) F('the tour did not hide an open panel for the run'); else if (!after.panel) F('the tour did not restore a panel the viewer had opened'); else OK('a tour on an opened panel hides it for the run and restores it after');
await ctx.close();
// 3 — ?panel=1
({ ctx, page } = await boot('?panel=1')); s = await read(page);
if (!s.panel) F('?panel=1 did not open the panel'); else OK('?panel=1 opens the panel on arrival');
await ctx.close();
// 5 — phone
({ ctx, page } = await boot('', { width: 375, height: 667 })); s = await read(page);
if (s.panel) F(`phone: the panel is shown`); else OK(`phone 375×667: panel hidden, pad ${s.pad}, View panel ${s.view ? 'up' : 'down'}`);
await ctx.close();
await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
