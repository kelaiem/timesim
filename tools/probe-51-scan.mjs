// TODO 51 — one pair, swept densely in tension, with the closest point
// reported in the cone's cylindrical frame. The gate reports a minimum and
// the axis position it happened at; this says WHICH part of which member and
// at what radius, which is what a position-space fix needs next.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const A = process.env.A || 'windArrestBeakArm';
const B = process.env.B || 'chainRun';
const N = Number(process.env.N || 200);
const port = process.env.PORT || '8475';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
await page.evaluate(() => {
  const c = window.__clock;
  window.__C = { x: c.P.barrel.x, y: c.P.barrel.y };
  window.__find = (n) => { let m = null; c.scene.traverse((o) => { if (!m && o.isMesh && o.name === n) m = o; }); return m; };
});
const rows = [];
for (let i = 0; i <= N; i++) {
  const t = i / N;
  const d = await page.evaluate(async ({ A, B, t }) => {
    const I = await import('./src/inspect.js');
    const c = window.__clock;
    c.resetInputs?.(); c.setPose({ tension: t });
    c.scene.updateMatrixWorld(true);
    const a = window.__find(A), b = window.__find(B);
    if (!a || !b) return null;
    const d0 = I.meshClearance(a, b);
    // the closest vertex of A to B's surface, reported cylindrically
    let worst = null;
    if (d0 < 0.4) {
      a.updateMatrixWorld(true); b.updateMatrixWorld(true);
      const pos = a.geometry.attributes.position; const v = a.position.clone();
      let lo = 1e9;
      for (let k = 0; k < pos.count; k++) {
        v.set(pos.getX(k), pos.getY(k), pos.getZ(k));
        const w = a.localToWorld(v.clone());
        const r = Math.hypot(w.x - window.__C.x, w.y - window.__C.y);
        if (r < lo) { lo = r; worst = { r: +r.toFixed(3), z: +w.z.toFixed(3),
          az: +(Math.atan2(w.y - window.__C.y, w.x - window.__C.x) * 180 / Math.PI).toFixed(1) }; }
      }
    }
    return { d: +d0.toFixed(4), worst };
  }, { A, B, t });
  rows.push({ t, ...d });
}
rows.sort((x, y) => x.d - y.d);
console.log(`${A} ⇄ ${B}, ${N + 1} tensions — the ten tightest:`);
for (const r of rows.slice(0, 10))
  console.log(`  t=${r.t.toFixed(3)}  d=${r.d}   innermost vertex ${r.worst ? `r=${r.worst.r} z=${r.worst.z} az=${r.worst.az}°` : '-'}`);
console.log(`min ${rows[0].d} at t=${rows[0].t.toFixed(3)}`);
await browser.close();
srv.kill();
