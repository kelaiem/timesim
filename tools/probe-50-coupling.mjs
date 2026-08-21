// Boot test-geometry.html headless and report the build log + a lift-law sanity table.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = '/home/user/timesim';
const PORT = 8481;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto(`http://127.0.0.1:${PORT}/test-geometry.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const built = await page.evaluate(() => {
    const p = window.parts?.makeSawCoupling;
    if (!p) return { ok: false, why: 'not in window.parts' };
    let tris = 0, open = 0;
    p.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry, ix = g.getIndex().array;
      tris += ix.length / 3;
      // edge-manifold check: every edge must be shared by exactly 2 triangles
      const e = new Map();
      for (let i = 0; i < ix.length; i += 3) {
        for (const [a, b] of [[ix[i], ix[i + 1]], [ix[i + 1], ix[i + 2]], [ix[i + 2], ix[i]]]) {
          const k = a < b ? a + '_' + b : b + '_' + a;
          e.set(k, (e.get(k) ?? 0) + 1);
        }
      }
      for (const n of e.values()) if (n !== 2) open++;
    });
    return { ok: open === 0, tris, openEdges: open };
  });
  console.log('build:', JSON.stringify(built));
  const lift = await page.evaluate(async () => {
    const G = await import('./src/geometry.js');
    const spec = G.sawCouplingSpec({ rOut: 1.0, rIn: 0.65, teeth: 8 });
    const rows = [];
    for (let k = 0; k <= 10; k++) {
      const d = (k / 10) * spec.pitch;
      rows.push([+(d / spec.pitch).toFixed(2), +G.sawCouplingLiftAt(spec, d).toFixed(4)]);
    }
    return { spec: { toothH: spec.toothH, pitch: spec.pitch, backlashFrac: spec.backlashFrac }, rows };
  });
  console.log(JSON.stringify(lift, null, 1));
} finally {
  await browser.close();
  srv.kill();
}
