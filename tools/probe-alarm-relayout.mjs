// Relayout feasibility: if the BARREL SIDE (fusee cone, mainspring drum,
// chain, set-up work) vacated its sector, would a pocket open under the
// three-quarter plate big enough to take the alarm striking module?
//
// Reports (a) every under-plate unit as a station + footprint radius + z band,
// so the packing problem has numbers, and (b) the free-height map recomputed
// with the barrel side removed, plus the largest free disc at the depth the
// module actually needs.
// Run: cd tools && node probe-alarm-relayout.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8443', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8443/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.render();
  const out = [];
  const f = (n) => n.toFixed(2);
  const plate = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  const TQ_BOT = new THREE.Box3().setFromObject(plate.obj).min.z;
  const MODULE = ['Alarm gong', 'Alarm hammer', 'Alarm striking wheel', 'Alarm barrel',
    'Alarm governor', 'Alarm governor anchor', 'Alarm click', 'Alarm lock',
    'Alarm switch', 'Alarm link', 'Alarm winding train'];
  const BARREL_SIDE = ['Fusee & great wheel', 'Mainspring drum', 'Chain', 'Set-up work'];

  const all = [];
  for (const e of clock.labelEntries) {
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o, true);   // precise — see probe-alarm-under-plate
      if (!bb.isEmpty()) all.push({ unit: e.name, bb });
    });
  }
  // --- the packing inputs: every under-plate unit as station + radius + band
  out.push('=== under-plate units: station, footprint radius, z band ===');
  const byUnit = new Map();
  for (const m of all) {
    if (m.bb.min.z > TQ_BOT || m.bb.max.z < 0) continue;
    const cur = byUnit.get(m.unit) || new THREE.Box3();
    cur.union(m.bb); byUnit.set(m.unit, cur);
  }
  for (const [name, b] of [...byUnit].sort((a, c) => (c[1].max.x - c[1].min.x) - (a[1].max.x - a[1].min.x))) {
    const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
    const r = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) / 2;
    const tag = MODULE.includes(name) ? ' [alarm]' : BARREL_SIDE.includes(name) ? ' [BARREL SIDE]' : '';
    out.push(`  ${name.padEnd(24)} at (${f(cx).padStart(7)},${f(cy).padStart(7)}) r ${f(r).padStart(6)}`
      + `  z ${f(Math.max(b.min.z, 0)).padStart(5)}..${f(Math.min(b.max.z, TQ_BOT))}${tag}`);
  }

  // --- the map, with the barrel side removed
  const R = clock.plateR, N = 45, step = (2 * R) / N;
  const obstacles = all.filter((o) => !MODULE.includes(o.unit) && !BARREL_SIDE.includes(o.unit)
    && o.unit !== 'Three-quarter plate' && o.bb.min.z <= TQ_BOT && o.bb.max.z >= 0);
  const fill = [];
  for (let j = 0; j < N; j++) {
    fill.push([]);
    for (let i = 0; i < N; i++) {
      const x0 = -R + i * step, y0 = -R + j * step;
      let top = 0;
      for (const o of obstacles) {
        if (o.bb.max.x < x0 || o.bb.min.x > x0 + step || o.bb.max.y < y0 || o.bb.min.y > y0 + step) continue;
        top = Math.max(top, Math.min(o.bb.max.z, TQ_BOT));
      }
      fill[j][i] = top;
    }
  }
  out.push(`=== free height under the plate WITH THE BARREL SIDE REMOVED (band 0..${f(TQ_BOT)}) ===`);
  out.push('  # <1   + 1-2   o 2-4   . 4-6   (blank) >6   · off the plate');
  for (let j = N - 1; j >= 0; j--) {
    let line = '  ';
    for (let i = 0; i < N; i++) {
      const cx = -R + (i + 0.5) * step, cy = -R + (j + 0.5) * step;
      if (Math.hypot(cx, cy) > R) { line += '·'; continue; }
      const free = TQ_BOT - fill[j][i];
      line += free < 1 ? '#' : free < 2 ? '+' : free < 4 ? 'o' : free < 6 ? '.' : ' ';
    }
    out.push(line);
  }
  // largest free disc at the depth the module needs (6.71 of metal + 2 margins)
  for (const need of [7.01, 6.0, 5.0, 4.0]) {
    let best = null;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const cx = -R + (i + 0.5) * step, cy = -R + (j + 0.5) * step;
      if (Math.hypot(cx, cy) > R) continue;
      let r = 0;
      for (let rr = step; rr <= R; rr += step) {
        let ok = true;
        for (let jj = 0; jj < N && ok; jj++) for (let ii = 0; ii < N && ok; ii++) {
          const px = -R + (ii + 0.5) * step, py = -R + (jj + 0.5) * step;
          if (Math.hypot(px - cx, py - cy) > rr) continue;
          // a cell off the plate is NOT free space — the disc must stay on the movement
          if (Math.hypot(px, py) > R || TQ_BOT - fill[jj][ii] < need) ok = false;
        }
        if (!ok) break;
        r = rr;
      }
      if (r > 0 && (!best || r > best.r)) best = { r, cx, cy };
    }
    out.push(best
      ? `  free disc with >= ${need} clear: radius ${f(best.r)} at (${f(best.cx)}, ${f(best.cy)}), az ${(Math.atan2(best.cy, best.cx) * 180 / Math.PI).toFixed(0)}deg, R ${f(Math.hypot(best.cx, best.cy))}`
      : `  free disc with >= ${need} clear: NONE`);
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
