// Every number §169's record quotes, read off the built tree in one place.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8483', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
const msgs = [];
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') msgs.push(m.text()); });
p.on('pageerror', (e) => msgs.push('PAGEERROR ' + String(e)));
await p.goto('http://127.0.0.1:8483/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
for (const m of msgs) if (!/WebGL|GroupMarker|404|swiftshader|ReadPixels/i.test(m)) console.log('WARN ' + m.slice(0, 400));
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const c = window.__clock;
  const find = (n) => { let r = null; c.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  let drive = null, ret = null;
  c.scene.traverse((o) => {
    if (o.userData && o.userData.drive) drive = o.userData.drive;
    if (o.name === 'alarmPusherReturnSpring' && o.userData.solve) ret = o.userData.solve();
  });
  c.resetInputs(); c.scene.updateMatrixWorld(true);
  const z = (n) => { const o = find(n); if (!o) return null;
    const x = new THREE.Box3().setFromObject(o); return [+x.min.z.toFixed(4), +x.max.z.toFixed(4)]; };
  const rows = {};
  for (const n of ['alarmColDriver', 'alarmColPawlSpringPin', 'alarmColPawlSpring', 'alarmColPawl',
                   'alarmColSkirt', 'alarmColBase', 'alarmColCastellations', 'alarmLinkBeakTail'])
    rows[n] = z(n);
  return { spring: drive && drive.spring, ret, z: rows,
           torsion: find('alarmColPawlSpring').userData.torsion };
});
console.log(JSON.stringify(out, null, 1));
await b.close(); srv.kill();
