// §106 — WHICH FRAME did the filing's z numbers come from? The entry quotes a
// ratchet band at 12.77–13.17 and a lane at 11.61–13.2; the shipped tree puts
// the alarm arbor's ratchet at world z 1.407–1.807. Before any siting work
// rests on those figures, establish whether they are the same numbers in a
// different frame or simply stale — the entry's survey was taken on the §104
// tree and §112 swapped this tier's bands afterwards.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8492';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await page.evaluate(() => {
  const c = window.__clock;
  c.scene.updateMatrixWorld(true);
  const r = { groups: [], bands: {} };
  // every ancestor transform between an arbor mesh and the scene
  let m = null;
  c.scene.traverse((o) => { if (!m && o.isMesh && o.name === 'alarmArborRatchet') m = o; });
  for (let n = m; n; n = n.parent)
    r.groups.push({ type: n.type, name: n.name || '(unnamed)', z: +n.position.z.toFixed(4) });
  const band = (nm) => {
    let g = null; c.scene.traverse((o) => { if (!g && o.isMesh && o.name === nm) g = o; });
    if (!g) return null;
    g.updateMatrixWorld(true);
    const p = g.geometry.attributes.position, v = g.position.clone();
    let lo = 1e9, hi = -1e9, loL = 1e9, hiL = -1e9;
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const w = g.localToWorld(v.clone());
      lo = Math.min(lo, w.z); hi = Math.max(hi, w.z);
      loL = Math.min(loL, v.z); hiL = Math.max(hiL, v.z);
    }
    return { world: [+lo.toFixed(3), +hi.toFixed(3)], local: [+loL.toFixed(3), +hiL.toFixed(3)] };
  };
  for (const nm of ['alarmArborRatchet', 'alarmArborWheel', 'alarmClickPawl',
    'alarmGovWheel', 'alarmGovSaw', 'alarmBarrelBody', 'alarmWindIdler'])
    r.bands[nm] = band(nm);
  return r;
});
console.log('--- ancestor chain of alarmArborRatchet (mesh → scene) ---');
for (const g of out.groups) console.log(`  ${g.type.padEnd(8)} ${g.name.padEnd(24)} position.z ${g.z}`);
console.log('\n--- bands, world vs mesh-local ---');
for (const [k, v] of Object.entries(out.bands))
  console.log(`  ${k.padEnd(22)} world ${JSON.stringify(v?.world ?? null).padEnd(20)} local ${JSON.stringify(v?.local ?? null)}`);
console.log(`\nThe filing quotes: ratchet 12.77–13.17, wind wheel 11.68–12.61, lane 11.61–13.2, governor floor 13.53.`);
await browser.close();
srv.kill();
