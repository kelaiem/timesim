// §107 — the anchor fork, close up, and MEASURED against the saw it works on.
// The question this answers: now that the arms reach into their blades, does
// any part of the anchor foul the saw's teeth, or is the only metal-to-metal
// the pallet face the mechanism is built on?
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/135fcf6e-0ec5-50b1-958a-bf0b1f66644d/scratchpad';
const srv = spawn('python3', ['-m', 'http.server', '8467', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8467/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => document.querySelector('[data-cam="Free"]')?.click());
await new Promise((r) => setTimeout(r, 1200));

// the anchor's own axis, from its arbor mesh
const anchor = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  let m = null;
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (!m && o.isMesh && o.name === 'alarmGovAnchorArbor') m = o; });
  m.updateWorldMatrix(true, false);
  const p = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
  return [p.x, p.y, p.z];
});
console.log('anchor axis at', anchor.map((v) => v.toFixed(2)).join(', '));

// MEASURE: min clearance from each anchor member to the saw, swept over a
// whole tooth period. The pallet face is the working contact and is expected
// to touch; nothing else may.
const measured = await page.evaluate(async ([ax]) => {
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { const out = []; for (const e of clock.labelEntries) e.obj.traverse((o) => { if (o.isMesh && o.name === n) out.push(o); }); return out; };
  const saw = find('alarmGovSaw')[0];
  const groups = { pallet: find('alarmGovPallet'), arm: find('alarmGovAnchorArm'), hub: find('alarmGovAnchor'), arbor: find('alarmGovAnchorArbor') };
  const worst = {};
  for (let k = 0; k <= 24; k++) {
    // one full tooth period of the governor, in 24 steps
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
      alarmStrikePhase: 14 + k / 24 * (2 * Math.PI / 40) * 8, alarmOn: 1, alarmReleased: 1 });
    for (const [name, meshes] of Object.entries(groups)) {
      for (const m of meshes) {
        let d = Infinity;
        try { d = I.meshClearance(m, saw, Infinity); } catch { d = NaN; }
        if (!(name in worst) || d < worst[name]) worst[name] = d;
      }
    }
  }
  void ax;
  return worst;
}, [anchor]);
console.log('min clearance to the saw over a tooth period:');
for (const [k, v] of Object.entries(measured)) console.log(`  ${k.padEnd(7)} ${typeof v === 'number' ? v.toFixed(4) : v}`);

const shoot = async (name, sch, from) => {
  const url = await page.evaluate(([f, a, l]) => {
    const clock = window.__clock;
    clock.camera.layers.set(l ? 1 : 0);
    clock.camera.up.set(0, 1, 0);
    clock.camera.position.set(a[0] + f[0], a[1] + f[1], a[2] + f[2]);
    clock.camera.lookAt(a[0], a[1], a[2]);
    clock.camera.updateProjectionMatrix();
    clock.render();
    return document.querySelector('canvas').toDataURL('image/png');
  }, [from, anchor, sch]);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
};
// tight plan view on the fork, then the same in the line tier
await shoot('107-fork-solid', 0, [0, 0, 9]);
await shoot('107-fork-line', 1, [0, 0, 9]);
await shoot('107-fork-solid-wide', 0, [0, 0, 15]);
await shoot('107-fork-line-wide', 1, [0, 0, 15]);
await browser.close(); srv.kill();
