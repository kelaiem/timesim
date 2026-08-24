import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const ROOT = '/Users/willmon/Documents/dev/timesim/.claude/worktrees/case-schematic';
const srv = spawn('python3', ['-m', 'http.server', '8454', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8454/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose(I.AXES[0].pose(0, clock));
  const unit = (n) => clock.labelEntries.find((x) => x.name === n);
  const meshesOf = (e) => { const m = []; e.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) m.push(o); }); return m; };
  const out = [];
  const P = clock.P || {};
  out.push(`plateR ${clock.plateR.toFixed(3)}`);
  const cm = meshesOf(unit('Case'));
  const mid = cm.find((m) => m.name === 'caseMiddle');
  // cylindrical extent of a mesh's own vertices, in world
  const extent = (m) => {
    const g = m.geometry, p = g.attributes.position;
    const v = new THREE.Vector3();
    let rMin = Infinity, rMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    const azs = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); m.localToWorld(v);
      const r = Math.hypot(v.x, v.y);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
      azs.push(Math.atan2(v.y, v.x));
    }
    return { rMin, rMax, zMin, zMax, azMin: Math.min(...azs), azMax: Math.max(...azs) };
  };
  const fmt = (e) => `r ${e.rMin.toFixed(2)}–${e.rMax.toFixed(2)}, z ${e.zMin.toFixed(2)}–${e.zMax.toFixed(2)}`;
  out.push(`caseMiddle: ${fmt(extent(mid))}`);
  for (const other of ['Keyless works', 'Alarm crown', 'Alarm switch', 'Setting lever']) {
    const E = unit(other);
    if (!E) continue;
    out.push(`\n=== ${other} ===`);
    for (const B of meshesOf(E)) {
      const bA = new THREE.Box3().setFromObject(mid), bB = new THREE.Box3().setFromObject(B);
      if (!bA.intersectsBox(bB)) continue;
      const d = I.meshClearance(mid, B, Infinity);
      if (d > 0.001) continue;
      out.push(`  caseMiddle ⇄ ${B.name || B.geometry.type}: ${fmt(extent(B))}`);
    }
  }
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
