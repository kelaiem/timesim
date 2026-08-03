import { chromium } from '/home/user/timesim/tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const SRC = '/home/user/timesim/src/main.js';
const orig = readFileSync(SRC, 'utf8');
const port = 8552;
const state = mkdtempSync(join(tmpdir(), 'pf-'));
const srv = spawn('python3', ['dev_server.py', String(port)], { cwd: '/home/user/timesim', env: { ...process.env, TMPDIR: state }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1400));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  for (const R of [10, 11, 12]) {
    writeFileSync(SRC, orig.replace('const balanceWheel = G.makeBalanceWheel({\n  radius: 9,', `const balanceWheel = G.makeBalanceWheel({\n  radius: ${R},`));
    for (const az of [null, 90]) {
      const page = await browser.newPage();
      const warns = [];
      page.on('console', m => { if (m.type() === 'warning' && !/WebGL|GL Driver|GroupMarker/.test(m.text())) warns.push(m.text()); });
      await page.goto(`http://localhost:${port}/index.html` + (az === null ? '' : `?alarmaz=${az}`));
      let ok = true;
      try { await page.waitForFunction(() => globalThis.__clock, null, { timeout: 40000 }); } catch { ok = false; }
      await page.waitForTimeout(400);
      const o = ok ? await page.evaluate(() => window.__clock.oscillator).catch(() => null) : null;
      console.log(`R ${R} alarmaz ${String(az ?? 'default').padEnd(7)} boot ${ok ? 'ok  ' : 'FAIL'} warns ${warns.length}` +
        (o ? `  ribbon ${o.spring.h_mm.toFixed(4)}mm f ${o.fImpliedHz.toFixed(3)}Hz` : '') +
        (warns.length ? '\n     → ' + warns.slice(0,2).map(w=>w.slice(0,100)).join('\n     → ') : ''));
      await page.close();
    }
  }
} finally { writeFileSync(SRC, orig); await browser.close(); srv.kill(); rmSync(state, { recursive: true, force: true }); }
