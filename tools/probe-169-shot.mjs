import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const OUT = '/tmp/claude-0/-home-user/5f85f71c-087d-5cd6-a3a2-a9bcb3fb8917/scratchpad';
const srv = spawn('python3', ['-m', 'http.server', '8482', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8482/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => document.querySelector('[data-cam="Free"]')?.click());
await new Promise((r) => setTimeout(r, 1500));
const at = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const c = window.__clock; c.resetInputs(); c.scene.updateMatrixWorld(true);
  let s = null; c.scene.traverse((o) => { if (o.name === 'alarmColPawlSpring') s = o; });
  const b = new THREE.Box3().setFromObject(s);
  return b.getCenter(new THREE.Vector3()).toArray();
});
console.log('spring centre', at.map((v) => v.toFixed(2)).join(', '));
const shoot = async (name, from) => {
  const url = await page.evaluate(([f, a]) => {
    const c = window.__clock;
    c.camera.layers.set(0); c.camera.up.set(0, 0, 1);
    c.camera.position.set(a[0] + f[0], a[1] + f[1], a[2] + f[2]); c.camera.lookAt(a[0], a[1], a[2]);
    c.camera.updateProjectionMatrix(); c.render();
    return document.querySelector('canvas').toDataURL('image/png');
  }, [from, at]);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
};
await shoot('169-coil-rake', [2.2, -3.4, 1.6]);
await shoot('169-coil-edge', [0.5, -4.2, 0.4]);
await shoot('169-group', [6, -9, 6]);
await browser.close(); srv.kill();
