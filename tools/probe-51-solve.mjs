// TODO 51 — the arrest's solve, printed alone. Boots once and reports the
// solved quantities plus every boot warning, so a change to the azimuth /
// stud / beak sequence can be read in seconds instead of through a sweep.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8473';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
const warns = [];
page.on('console', (m) => { if (/^§|TODO/.test(m.text())) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await page.evaluate(() => {
  const c = window.__clock;
  const parts = {};
  c.scene.updateMatrixWorld(true);
  const C = { x: c.P.barrel.x, y: c.P.barrel.y };
  c.scene.traverse((o) => {
    if (!o.isMesh || !/windArrest/.test(o.name)) return;
    const pos = o.geometry.attributes.position; const v = o.position.clone();
    let rLo = 1e9, rHi = -1e9, zLo = 1e9, zHi = -1e9;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const w = o.localToWorld(v.clone());
      const r = Math.hypot(w.x - C.x, w.y - C.y);
      rLo = Math.min(rLo, r); rHi = Math.max(rHi, r);
      zLo = Math.min(zLo, w.z); zHi = Math.max(zHi, w.z);
    }
    parts[o.name] = { r: [+rLo.toFixed(3), +rHi.toFixed(3)], z: [+zLo.toFixed(3), +zHi.toFixed(3)] };
  });
  return { wind: c.windArrest, parts };
});
console.log(JSON.stringify(out.wind, null, 1));
for (const [k, v] of Object.entries(out.parts))
  console.log(`  ${k.padEnd(24)} r ${JSON.stringify(v.r).padEnd(18)} z ${JSON.stringify(v.z)}`);
console.log(warns.length ? `\nWARNINGS (${warns.length}):` : '\nboot silent (no §/TODO warnings)');
for (const w of warns) console.log(' ', w);
await browser.close();
srv.kill();
