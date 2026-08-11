// §104 — visual check: camera over the governor corner, mid-ring pose.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8453', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto('http://127.0.0.1:8453/index.html?schematic=0', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await page.evaluate(() => {
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
    alarmStrikePhase: 14.2, alarmOn: 1, alarmReleased: 1 });
  clock.camera.position.set(-33, -1, 42);
  clock.camera.up.set(0, 1, 0);
  clock.camera.lookAt(-31, 0, 12);
  clock.render();
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => window.__clock.render());
await page.screenshot({ path: '/tmp/claude-0/-home-user/135fcf6e-0ec5-50b1-958a-bf0b1f66644d/scratchpad/gov3.png' });
await page.evaluate(() => {
  const clock = window.__clock;
  clock.camera.position.set(-45, -25, 30);
  clock.camera.lookAt(-32, 0, 13);
  clock.render();
});
await page.screenshot({ path: '/tmp/claude-0/-home-user/135fcf6e-0ec5-50b1-958a-bf0b1f66644d/scratchpad/gov4.png' });
await browser.close(); srv.kill();
console.log('shots written');
