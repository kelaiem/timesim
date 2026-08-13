import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8446', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8446/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.render();
  const out = [];
  const f = (n) => n.toFixed(3);
  const rowsOf = (name) => {
    const rows = [];
    clock.labelEntries.find((e) => e.name === name).obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o, true);
      if (!bb.isEmpty()) rows.push({ n: o.name || o.geometry.type, bb });
    });
    return rows;
  };
  const A = rowsOf('Alarm selector'), B = rowsOf('Alarm setting idler');
  const gap = (a, b) => {
    const dx = Math.max(a.bb.min.x - b.bb.max.x, b.bb.min.x - a.bb.max.x, 0);
    const dy = Math.max(a.bb.min.y - b.bb.max.y, b.bb.min.y - a.bb.max.y, 0);
    const dz = Math.max(a.bb.min.z - b.bb.max.z, b.bb.min.z - a.bb.max.z, 0);
    return Math.hypot(dx, dy, dz);
  };
  const pairs = [];
  for (const a of A) for (const b of B) pairs.push({ a: a.n, b: b.n, g: gap(a, b), abb: a.bb, bbb: b.bb });
  pairs.sort((p, q) => p.g - q.g);
  for (const p of pairs.slice(0, 6)) {
    out.push(`${p.a} ⇄ ${p.b}: box gap ${f(p.g)}`);
    out.push(`   A x ${f(p.abb.min.x)}..${f(p.abb.max.x)} y ${f(p.abb.min.y)}..${f(p.abb.max.y)} z ${f(p.abb.min.z)}..${f(p.abb.max.z)}`);
    out.push(`   B x ${f(p.bbb.min.x)}..${f(p.bbb.max.x)} y ${f(p.bbb.min.y)}..${f(p.bbb.max.y)} z ${f(p.bbb.min.z)}..${f(p.bbb.max.z)}`);
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
