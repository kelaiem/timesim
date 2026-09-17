#!/usr/bin/env node
// REPORT — WHAT OCCUPIES THE ANNULUS AROUND THE ALARM RELEASE DISC, BY AZIMUTH.
//
// TODO 144's hold needs a GROUNDED seat under the disc (a pad alone reacts on
// the turning hour wheel and nets nothing — probe-144-set-hold.mjs prices it),
// and a grounded seat is a bracket hung from the dial sheet with a web passing
// under the disc. Whether that fits is a fact about where every other unit's
// metal is, over the pose net, and nothing but a measurement knows it. This
// walks every mesh's edges (probe-117-fork-room's method, 0.05 steps) through
// 42 poses (every axis at 0, ½, 1) and buckets the samples by 10° of WORLD
// azimuth about the dial centre into four cells, all in dial-local z (negative
// toward the movement):
//   LUG   r 5.30–6.20, z −4.30…−0.05 — a bracket's lugs, outside the hour
//         wheel's tips (5.1) and the selector ring, from the sheet down past the disc
//   PAD   r 3.40–4.05, z −3.05…−2.75 — above the disc's face, outboard of the
//         reader ring, under the alarm release sleeve's envelope
//   WEB   r 2.60–4.75, z −4.30…−3.53 — under the disc, where a thrust plate goes
//         (the hour wheel and minute pinion are listed apart: they are what a
//         re-stratification moves)
//   under the hour wheel, r 2.60–5.20, z < −4.48 — the room to lower it into,
//         and the nearest metal there (the minute jumper star and minute wheel)
// The disc itself is excluded (it is the part being seated). A cell reading
// "—" at an azimuth has no metal from any other unit at any pose; the hour
// wheel's own top face is read off `mwHourWheel` directly. A REPORT: it
// prints occupancy and leaves the placement to the reader.
//
// cd tools && node probe-144-disc-room.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8567);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const b = await chromium.launch(); const page = await b.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await page.evaluate(async () => {
  const THREE = await import('three'); const I = await import('/src/inspect.js'); const C = window.__clock;
  const cx = C.P.dial.x, cy = C.P.dial.y, ZD = -8.4;
  // unit name per mesh
  const owner = new Map();
  for (const e of C.labelEntries) e.obj.traverse((o) => { if (o.isMesh) owner.set(o, e.name); });
  const CELLS = {
    LUG: { r: [5.30, 6.2], z: [-4.30, -0.05] },     // dial-local z; a bracket's lugs from the sheet down past the disc
    PAD: { r: [3.40, 4.05], z: [-3.05, -2.75] },    // above the disc's face, outboard of the reader ring
    WEB: { r: [2.60, 4.75], z: [-4.30, -3.53] },
    STACK: { r: [2.60, 5.20], z: [-5.80, -4.48] },   // under the hour wheel: the room to lower it into    // under the disc: where a grounded thrust plate would sit
  };
  const NB = 36; const occ = {}; for (const k in CELLS) occ[k] = Array.from({ length: NB }, () => ({}));
  const zmaxHW = Array(NB).fill(-Infinity); const zmaxUnder = Array(NB).fill(-Infinity); const whoUnder = Array(NB).fill(''); // hour wheel's dial-most local z per azimuth (for the stratum)
  const poses = []; for (const ax of I.AXES) for (const f of [0, 0.5, 1]) poses.push(ax.pose(f, C));
  const v = new THREE.Vector3(); const box = new THREE.Box3();
  const meshes = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData.schematic && owner.has(o)) meshes.push(o); });
  const STEP = 0.05;
  const inCell = (c, r, z) => r >= c.r[0] && r <= c.r[1] && z >= c.z[0] && z <= c.z[1];
  for (const p of poses) {
    I.enterAxis(C); C.setPose(p); C.scene.updateMatrixWorld(true);
    for (const m of meshes) {
      const name = owner.get(m); if (name === 'Alarm release disc') continue;
      box.setFromObject(m);
      const zl0 = ZD - box.max.z, zl1 = ZD - box.min.z; if (zl1 < -5.9 || zl0 > 0) continue;
      const rmin = Math.max(0, Math.hypot(Math.max(box.min.x - cx, 0, cx - box.max.x), Math.max(box.min.y - cy, 0, cy - box.max.y)));
      if (rmin > 6.1) continue;
      const pos = m.geometry.attributes.position, idx = m.geometry.index ? m.geometry.index.array : null, cnt = idx ? idx.length : pos.count;
      for (let i = 0; i + 2 < cnt; i += 3) for (const [a, q] of [[0, 1], [1, 2], [2, 0]]) {
        v.fromBufferAttribute(pos, idx ? idx[i + a] : i + a).applyMatrix4(m.matrixWorld); const ax = v.x, ay = v.y, az = v.z;
        v.fromBufferAttribute(pos, idx ? idx[i + q] : i + q).applyMatrix4(m.matrixWorld); const bx = v.x, by = v.y, bz = v.z;
        const len = Math.hypot(bx - ax, by - ay, bz - az), n = Math.max(1, Math.ceil(len / STEP));
        for (let t = 0; t <= n; t++) {
          const x = ax + (bx - ax) * t / n - cx, y = ay + (by - ay) * t / n - cy, z = ZD - (az + (bz - az) * t / n);
          const r = Math.hypot(x, y); if (r > 6.1 || z < -5.9 || z > 0) continue;
          const bin = Math.floor(((Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / NB));
          if (m.name === 'mwHourWheel' && r >= 2.6 && r <= 4.75) zmaxHW[bin] = Math.max(zmaxHW[bin], z);
          if (name !== 'Hour wheel' && r >= 2.6 && r <= 5.2 && z < -4.48 && z > zmaxUnder[bin]) { zmaxUnder[bin] = z; whoUnder[bin] = name; }
          for (const k in CELLS) if (inCell(CELLS[k], r, z)) occ[k][bin][name] = (occ[k][bin][name] || 0) + 1;
        }
      }
    }
  }
  return { occ, zmaxHW, zmaxUnder, whoUnder, poses: poses.length, meshes: meshes.length };
});
await b.close(); srv.kill();
console.log(`poses ${out.poses}, meshes scanned ${out.meshes}`);
console.log('az°   LUG r5.3–6.2 z[-4.3,-0.05]                 | PAD r3.4–4.05 z[-3.05,-2.75]   | WEB r2.6–4.75 z[-4.3,-3.53] [HW/MW]   | HW top   | under the HW (r2.6–5.2, z<-4.48): nearest');
for (let i = 0; i < 36; i++) {
  const f = (o, excl = []) => { const ks = Object.keys(o).filter((k) => !excl.includes(k)); return ks.length ? ks.join(',') : '—'; };
  const web = out.occ.WEB[i]; const webX = ['Hour wheel', 'Motion works'].filter((k) => web[k]).join('+');
  console.log(`${String(i * 10).padStart(3)}°  ${f(out.occ.LUG[i]).padEnd(44)} | ${f(out.occ.PAD[i]).padEnd(30)} | ${f(web, ['Hour wheel', 'Motion works']).padEnd(14)} [${webX.padEnd(22)}] ${out.zmaxHW[i] === -Infinity ? '   —  ' : out.zmaxHW[i].toFixed(3)} | ${out.zmaxUnder[i] === -Infinity ? '— (nothing to -5.8)' : out.zmaxUnder[i].toFixed(3) + ' ' + out.whoUnder[i]}`);
}
