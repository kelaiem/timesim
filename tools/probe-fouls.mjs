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
  const out = [`unit meshes: ${meshes.map(label).join(', ')}`];
  for (const [a, b] of [['ExtrudeGeometry#2', 'ExtrudeGeometry#1'], ['ratchet', 'maintPawl']]) {
    const A = byLabel[a], B = byLabel[b];
    if (!A || !B) { out.push(`${a} ⇄ ${b}: MISSING (${!!A}/${!!B})`); continue; }
    const d = I.meshClearance(A, B, Infinity);
    const bA = new THREE.Box3().setFromObject(A), bB = new THREE.Box3().setFromObject(B);
    const inter = bA.clone().intersect(bB);
    const iSize = inter.isEmpty() ? [0, 0, 0] : inter.getSize(new THREE.Vector3()).toArray();
    out.push(`${a} ⇄ ${b}: clearance ${d === Infinity ? 'Inf' : d.toFixed(4)}, box-overlap ${iSize.map((x) => +x.toFixed(3)).join('×')}`);
    for (const [n, m] of [[a, A], [b, B]]) {
      const g = m.geometry;
      const p = m.getWorldPosition(new THREE.Vector3());
      const bb = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).toArray();
      out.push(`  ${n}: ${g.type} verts ${g.attributes.position.count}, world (${p.toArray().map((x) => +x.toFixed(2)).join(', ')}), size ${bb.map((x) => +x.toFixed(2)).join('×')}`);
    }
  }
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
