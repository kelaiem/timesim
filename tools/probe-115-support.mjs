// §115 — the two support rows that moved, localised to the mesh pair that
// produced them. The gate only says "within tol"; this says WHICH metal.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8491';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const clock = window.__clock;
  const I = await import('./src/inspect.js');
  clock.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.scene.updateMatrixWorld(true);
  const meshesOf = (name) => {
    const u = clock.labelEntries.find((e) => e.name === name);
    const out = [];
    u.obj.traverse((o) => { if (o.isMesh && !o.userData?.schematic) out.push(o); });
    return out;
  };
  const res = {};
  for (const [a, b] of [['Center wheel', 'Three-quarter plate'], ['Alarm link', 'Three-quarter plate']]) {
    const A = meshesOf(a), B = meshesOf(b);
    let best = { d: Infinity };
    for (const m of A) for (const n of B) {
      const d = I.meshClearance(m, n);
      if (d < best.d) best = { d, am: m.name || '(unnamed)', bm: n.name || '(unnamed)',
        atris: m.geometry.index ? m.geometry.index.count / 3 : 0,
        btris: n.geometry.index ? n.geometry.index.count / 3 : 0 };
    }
    res[`${a} → ${b}`] = best;
  }
  // the plate's own triangle count, since a new hole re-triangulates its face
  const plate = meshesOf('Three-quarter plate').find((m) => m.name === 'threeQuarterPlate');
  res._plate = { tris: plate.geometry.index.count / 3, verts: plate.geometry.attributes.position.count };
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.kill();
