import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const ROOT = process.argv[2] ?? '/home/user/timesim';
const PORT = Number(process.argv[3] ?? 8489);
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__clock, null, { timeout: 60000 });
  const res = await page.evaluate(async () => {
    const I = await import('./src/inspect.js');
    I.start(window.__clock, 'intraUnit', { yieldEvery: 64 });
    for (let i = 0; i < 6000; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const s = I.status('intraUnit');
      if (s.state && s.state !== 'running') return s.result;
    }
    return 'TIMEOUT';
  });
  console.log('violations:', JSON.stringify(res.violations));
  const fgw = (res.rows ?? []).filter?.((r) => r.unit === 'Fusee & great wheel');
  console.log('tiers:', JSON.stringify(res.tiers), 'movers:', res.movers, 'frames:', res.frames);
} finally { await browser.close(); srv.kill(); }
