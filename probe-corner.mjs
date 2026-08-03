import { chromium } from '/home/user/timesim/tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const port = 8550;
const state = mkdtempSync(join(tmpdir(), 'cn-'));
const srv = spawn('python3', ['dev_server.py', String(port)], { cwd: '/home/user/timesim', env: { ...process.env, TMPDIR: state }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1400));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const az of [null, 45, 60, 90, 120, 150, 180, 240, 300]) {
  const page = await browser.newPage();
  const warns = [];
  page.on('console', m => { if (m.type() === 'warning' && !/WebGL|GL Driver|GroupMarker/.test(m.text())) warns.push(m.text()); });
  await page.goto(`http://localhost:${port}/index.html` + (az === null ? '' : `?alarmaz=${az}`));
  let ok = true;
  try { await page.waitForFunction(() => globalThis.__clock, null, { timeout: 40000 }); } catch { ok = false; }
  await page.waitForTimeout(400);
  console.log(`alarmaz ${String(az ?? 'default').padEnd(8)} boot ${ok ? 'ok  ' : 'FAIL'} warns ${warns.length}${warns.length ? ' → ' + warns[0].slice(0, 95) : ''}`);
  await page.close();
}
await browser.close(); srv.kill(); rmSync(state, { recursive: true, force: true });
