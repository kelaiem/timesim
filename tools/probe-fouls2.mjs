import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8441', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8441/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose(I.AXES[0].pose(0, clock));   // beat f=0
  const e = clock.labelEntries.find((x) => x.name === 'Fusee & great wheel');
  const meshes = [];
  e.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) meshes.push(o); });
  const label = (m) => m.name || `${m.geometry.type}#${meshes.filter((x) => x.geometry.type === m.geometry.type).indexOf(m)}`;
  const byLabel = {};
  meshes.forEach((m) => { byLabel[label(m)] = m; });
  const out = [];
  const ratchets = meshes.filter((m) => m.name === 'ratchet');
  const pawls = meshes.filter((m) => m.name === 'maintPawl');
  ratchets.forEach((R, ri) => pawls.forEach((P, pi) => {
    const d = I.meshClearance(R, P, Infinity);
    const pr = R.getWorldPosition(new THREE.Vector3()), pp = P.getWorldPosition(new THREE.Vector3());
    const sr = new THREE.Box3().setFromObject(R).getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2));
    const sp = new THREE.Box3().setFromObject(P).getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2));
    out.push(`ratchet[${ri}] (z ${pr.z.toFixed(2)}, ${sr.join('x')}) ⇄ maintPawl[${pi}] (z ${pp.z.toFixed(2)}, ${sp.join('x')}): d ${d === Infinity ? 'Inf' : d.toFixed(4)}`);
  }));
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
