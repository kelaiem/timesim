import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const ROOT = '/Users/willmon/Documents/dev/timesim/.claude/worktrees/case-schematic';
const srv = spawn('python3', ['-m', 'http.server', '8456', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8456/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  const out = [];
  const meshesOf = (e) => { const m = []; e.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) m.push(o); }); return m; };
  const extent = (m) => {
    const p = m.geometry.attributes.position, v = new THREE.Vector3();
    let rMin = Infinity, rMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); m.localToWorld(v);
      const r = Math.hypot(v.x, v.y);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
    }
    return `r ${rMin.toFixed(2)}–${rMax.toFixed(2)}, z ${zMin.toFixed(2)}–${zMax.toFixed(2)}`;
  };
  for (const [axName, f, other] of [['alarmPress', 0.5, 'Alarm switch'], ['crown', 0.25, 'Setting lever']]) {
    const ax = I.AXES.find((a) => a.name === axName);
    if (!ax) { out.push(`${axName}: NO SUCH AXIS`); continue; }
    clock.resetInputs();
    if (I.enterAxis) I.enterAxis(clock, ax); else clock.setPose(ax.pose(0, clock));
    clock.setPose(ax.pose(f, clock));
    const unit = (n) => clock.labelEntries.find((x) => x.name === n);
    const cm = meshesOf(unit('Case'));
    const om = meshesOf(unit(other));
    out.push(`\n=== ${other} at ${axName} f=${f} ===`);
    let any = false;
    for (const A of cm) for (const B of om) {
      const bA = new THREE.Box3().setFromObject(A), bB = new THREE.Box3().setFromObject(B);
      if (!bA.intersectsBox(bB)) continue;
      const d = I.meshClearance(A, B, Infinity);
      if (d > 0.001) continue;
      any = true;
      out.push(`  ${A.name || A.geometry.type} ⇄ ${B.name || B.geometry.type}`);
      out.push(`      case  ${extent(A)}`);
      out.push(`      part  ${extent(B)}`);
    }
    if (!any) out.push('  (no mesh-level contact)');
  }
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
