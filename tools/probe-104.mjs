// §104 siting survey — what actually stands around the alarm striking corner.
// Reports every mesh whose XY footprint comes within reach of the strike
// arbor, with world AABBs, so the governor's fold is chosen against measured
// space rather than read prose. Run: cd tools && node probe-104.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8443', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'warning') console.log('BOOTWARN', m.text()); });
await page.goto('http://127.0.0.1:8443/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.render();
  const out = [];
  // The strike arbor's station: the striking wheel unit's rotor origin.
  const sw = clock.labelEntries.find((e) => e.name === 'Alarm striking wheel');
  let swPos = null;
  sw.obj.traverse((o) => { if (!swPos && o.isGroup && o.children.some((c) => c.name === 'alarmCam')) swPos = o.getWorldPosition(new THREE.Vector3()); });
  out.push(`strike arbor at (${swPos.x.toFixed(3)}, ${swPos.y.toFixed(3)}), az from centre ${(Math.atan2(swPos.y, swPos.x) * 180 / Math.PI).toFixed(1)}°, R ${Math.hypot(swPos.x, swPos.y).toFixed(2)}`);
  out.push(`plateR ${clock.plateR.toFixed(3)}, dialR ${clock.dialRadius.toFixed(3)}`);
  const REACH = 27; // wheel CD 10.8 + anchor CD ~8.5 + ring reach ~7 + margin
  const rows = [];
  for (const e of clock.labelEntries) {
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o);
      if (bb.isEmpty()) return;
      // XY distance from the strike arbor to the box (0 if the box covers it)
      const dx = Math.max(bb.min.x - swPos.x, swPos.x - bb.max.x, 0);
      const dy = Math.max(bb.min.y - swPos.y, swPos.y - bb.max.y, 0);
      const d = Math.hypot(dx, dy);
      if (d > REACH) return;
      if (bb.max.z < 7.5) return; // only the striking band above the 3/4 plate top
      rows.push({ unit: e.name, mesh: o.name || o.geometry.type, d,
        x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z });
    });
  }
  rows.sort((a, b) => a.z0 - b.z0);
  out.push('--- meshes within reach (sorted by z0): unit | mesh | dXY | x[..] y[..] z[..]');
  for (const r of rows) {
    out.push(`${r.unit} | ${r.mesh} | d ${r.d.toFixed(2)} | x ${r.x0.toFixed(2)}..${r.x1.toFixed(2)} y ${r.y0.toFixed(2)}..${r.y1.toFixed(2)} z ${r.z0.toFixed(2)}..${r.z1.toFixed(2)}`);
  }
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
