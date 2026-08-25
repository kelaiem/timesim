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
const srv = spawn('python3', ['-m', 'http.server', '8457', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8457/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  const out = [];
  const ax = I.AXES.find((a) => a.name === 'alarmPress');
  const cap = () => clock.scene.getObjectByName('alarmPusherCap');
  const caseMid = () => {
    let m = null;
    clock.labelEntries.find((x) => x.name === 'Case').obj.traverse((o) => { if (o.name === 'caseMiddle') m = o; });
    return m;
  };
  // R_OUT read off the metal, not restated
  const mid = caseMid();
  const p = mid.geometry.attributes.position, v = new THREE.Vector3();
  let rOut = -Infinity;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); mid.localToWorld(v); rOut = Math.max(rOut, Math.hypot(v.x, v.y)); }
  out.push(`R_OUT (measured off caseMiddle) ${rOut.toFixed(4)}`);
  out.push('  f      cap minR    minR - R_OUT');
  let worst = Infinity, worstF = null;
  for (let k = 0; k <= 20; k++) {
    const f = k / 20;
    clock.resetInputs();
    clock.setPose(ax.pose(f, clock));
    const c = cap();
    const q = c.geometry.attributes.position;
    let minR = Infinity;
    for (let i = 0; i < q.count; i++) {
      v.fromBufferAttribute(q, i); c.localToWorld(v);
      minR = Math.min(minR, Math.hypot(v.x, v.y));
    }
    if (minR < worst) { worst = minR; worstF = f; }
    if (k % 2 === 0 || minR < rOut)
      out.push(`  ${f.toFixed(2)}   ${minR.toFixed(4)}   ${(minR - rOut >= 0 ? '+' : '') + (minR - rOut).toFixed(4)}`);
  }
  out.push(`\nworst: f=${worstF} minR ${worst.toFixed(4)}, ${(worst - rOut).toFixed(4)} against R_OUT`);
  out.push(`CLEAR_MARGIN ${I.CLEAR_MARGIN ?? '(not exported)'}`);
  out.push(`standoff to add for R_OUT + 0.15: ${(rOut + 0.15 - worst).toFixed(4)} u`);
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
