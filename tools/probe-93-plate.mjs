import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Derived, not hardcoded: a probe must run from the worktree that OWNS it, the
// way ci-battery.mjs resolves its own ROOT. The absolute path this replaced was
// one machine's worktree, so every one of these probes was unrunnable anywhere
// else — including from a fresh clone of the branch that ships them. Set ROOT=
// to take the same numbers against a base worktree.
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8461', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8461/index.html', { waitUntil: 'load', timeout: 90000 });
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
  const ext = (m) => {
    const p = m.geometry.attributes.position, v = new THREE.Vector3();
    let rMin = Infinity, rMax = -Infinity, zMin = Infinity, zMax = -Infinity, sx = 0, sy = 0;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); m.localToWorld(v);
      const r = Math.hypot(v.x, v.y);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
      sx += v.x; sy += v.y;
    }
    return `r ${rMin.toFixed(2)}–${rMax.toFixed(2)}, z ${zMin.toFixed(2)}–${zMax.toFixed(2)}, az ${(Math.atan2(sy, sx) * 180 / Math.PI).toFixed(1)}°`;
  };
  const A = unit('Case'), B = unit('Three-quarter plate');
  out.push(`plateR ${clock.plateR.toFixed(3)}`);
  for (const a of meshesOf(A)) for (const b of meshesOf(B)) {
    const ba = new THREE.Box3().setFromObject(a), bb = new THREE.Box3().setFromObject(b);
    if (!ba.intersectsBox(bb)) continue;
    const d = I.meshClearance(a, b, Infinity);
    if (d > 0.001) continue;
    out.push(`CONTACT ${a.name || a.geometry.type} ⇄ ${b.name || b.geometry.type}`);
    out.push(`   case  ${ext(a)}`);
    out.push(`   plate ${ext(b)}`);
  }
  if (out.length === 1) out.push('(no mesh-level contact at beat f=0)');
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
