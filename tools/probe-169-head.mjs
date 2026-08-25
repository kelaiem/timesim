// P3 before P0 is the wrong order, but knowing the CEILING before spending it
// is not: how much z is free above the alarm column wheel's castellations
// before something unrelated is in the way?
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8479', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8479/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const clock = window.__clock;
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  let wheel = null;
  clock.scene.traverse((o) => { if (o.name === 'alarmColCastellations') wheel = o; });
  const wb = new THREE.Box3().setFromObject(wheel);
  const cx = (wb.min.x + wb.max.x) / 2, cy = (wb.min.y + wb.max.y) / 2;
  const R = 9;                        // the column wheel's whole neighbourhood in plan
  const top = wb.max.z;
  const rows = [];
  const v = new THREE.Vector3();
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry) return;
    if (/^alarmCol/.test(o.name)) return;
    const pos = o.geometry.getAttribute('position'); if (!pos) return;
    let lo = Infinity, near = Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x - cx, v.y - cy);
      if (r > R) continue;
      if (v.z > top + 1e-6 && v.z < lo) lo = v.z;
      near = Math.min(near, r);
    }
    if (Number.isFinite(lo)) rows.push({ name: o.name || o.geometry.type, lowestAbove: +lo.toFixed(4),
      headroom: +(lo - top).toFixed(4), nearestR: +near.toFixed(2) });
  });
  rows.sort((x, y) => x.headroom - y.headroom);
  return { centre: [+cx.toFixed(3), +cy.toFixed(3)], castellationTop: +top.toFixed(4), rows: rows.slice(0, 14) };
});
console.log('column wheel centre', out.centre, ' castellation top z =', out.castellationTop);
console.table(out.rows);
await b.close(); srv.kill();
