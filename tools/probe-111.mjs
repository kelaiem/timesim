// §111 — the governor anchor's derived section, its bored bearing, and the
// engagement debt, read off a real boot rather than off the model that
// predicted them.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8471';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const out = await page.evaluate(() => {
  const clock = window.__clock;
  const named = {};
  for (const n of ['Alarm governor', 'Alarm governor anchor']) {
    const u = clock.labelEntries.find((e) => e.name === n);
    if (!u) continue;
    u.obj.updateWorldMatrix(true, true);
    const meshes = [];
    u.obj.traverse((o) => {
      if (!o.isMesh || o.userData?.schematic) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      meshes.push({
        name: o.name,
        tris: o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3,
        indexed: !!o.geometry.index,
        box: [+(b.max.x - b.min.x).toFixed(4), +(b.max.y - b.min.y).toFixed(4), +(b.max.z - b.min.z).toFixed(4)],
      });
    });
    named[n] = meshes;
  }
  return { bootWarns: clock.bootWarns ?? null, named };
});
console.log('bootWarns:', JSON.stringify(out.bootWarns));
for (const [unit, meshes] of Object.entries(out.named)) {
  console.log(`\n${unit}`);
  for (const m of meshes) console.log(`  ${m.name.padEnd(22)} tris ${String(m.tris).padStart(5)} idx=${m.indexed} box ${m.box.join(' × ')}`);
}
await browser.close(); srv.kill();
