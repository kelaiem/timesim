import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const ROOT = '/Users/willmon/Documents/dev/timesim/.claude/worktrees/case-schematic';
const srv = spawn('python3', ['-m', 'http.server', '8452', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8452/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose(I.AXES[0].pose(0, clock));   // beat f=0 — where CI refined
  const unit = (n) => clock.labelEntries.find((x) => x.name === n);
  const meshesOf = (e) => { const m = []; e.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) m.push(o); }); return m; };
  const out = [];
  const C = unit('Case');
  const cm = meshesOf(C);
  out.push(`Case meshes (${cm.length}): ${[...new Set(cm.map((m) => m.name || m.geometry.type))].join(', ')}`);
  for (const other of ['Setting lever', 'Keyless works', 'Alarm crown', 'Alarm switch']) {
    const E = unit(other);
    if (!E) { out.push(`${other}: NO SUCH UNIT`); continue; }
    const om = meshesOf(E);
    out.push(`\n=== Case ⇄ ${other} (${om.length} meshes) ===`);
    const hits = [];
    for (const A of cm) for (const B of om) {
      const bA = new THREE.Box3().setFromObject(A), bB = new THREE.Box3().setFromObject(B);
      if (!bA.intersectsBox(bB)) continue;
      const d = I.meshClearance(A, B, Infinity);
      if (d > 0.001) continue;
      const inter = bA.clone().intersect(bB);
      const s = inter.getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3));
      hits.push(`  ${A.name || A.geometry.type} ⇄ ${B.name || B.geometry.type}: clearance ${d.toFixed(4)}, box-overlap ${s.join('×')}`);
    }
    out.push(hits.length ? hits.join('\n') : '  (no mesh-level contact at this pose)');
  }
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
