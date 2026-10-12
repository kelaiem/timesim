import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const PORT = 8728;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: '/home/user/timesim', stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch(); const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html?sync=0`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 300000 });
const r = await page.evaluate(() => {
  const M = window.__clock.balanceDriveModel, K = M.K;
  const ser = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v instanceof Float64Array ? Array.from(v) : v)));
  return { K: ser(K), friction: M.friction, posedDeg: M.posedDeg, sustainedDeg: M.sustainedDeg, weight: Object.fromEntries(['CU', 'CL', 'DU'].map((p) => [p, ser(M.weight(p))])) };
});
writeFileSync('/tmp/claude-0/-home-user/7ba98a71-885e-5790-a8a2-ace1db19732f/scratchpad/drive-dump.json', JSON.stringify(r));
console.log('dumped');
await browser.close();
