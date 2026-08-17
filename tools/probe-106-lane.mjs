// §106 (alarm winding arrest) — THE LANE, re-probed. The entry's siting rests
// on §99's claim that the band 11.61..13.2 above the alarm barrel is empty of
// everything outside the arbor's own action group. That probe was taken at
// REST and before §104, §112 and §120 landed, and the entry itself names the
// lane as its risk — so this measures it again on the shipped tree, over the
// axes rather than at one pose.
//
// Reports, about the ALARM BARREL's axis:
//   · the arbor tier's own bands (wind wheel, ratchet, click) and the
//     governor's floor — the ceiling the entry says is already spoken for;
//   · every mesh from OUTSIDE the action group whose z overlaps the lane,
//     with the radius at which it stands, at each pose of each axis.
// A part that stands far out in radius is not in the way; the lane's real
// width is the radius at which the nearest intruder sits.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8491';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

// the action group: the units that legitimately live on this axis
const GROUP = (process.env.GROUP || 'Alarm barrel,Alarm click,Alarm winding train').split(',');
const LANE = [Number(process.env.LO || 11.4), Number(process.env.HI || 13.6)];

await page.evaluate(({ GROUP, LANE }) => {
  window.__G = GROUP; window.__LANE = LANE;
  const c = window.__clock;
  // collectUnits is internal to inspect.js; labelEntries is the public
  // surface and carries the same partition. Schematic display is pruned the
  // way collectUnits prunes it — flagged anywhere up the chain.
  window.__units = () => c.labelEntries.map(({ name, obj }) => {
    const meshes = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      for (let n = o; n; n = n.parent) if (n.userData && n.userData.schematic) return;
      meshes.push(o);
    });
    return { name, meshes };
  });
  window.__axisScan = () => ({ names: c.labelEntries.map((e) => e.name) });
}, { GROUP, LANE });

const info = await page.evaluate(() => window.__axisScan());
console.log('units on the tree:', info.names.length);
console.log('alarm-ish units:', info.names.filter((n) => /alarm/i.test(n)).join(' · '));
console.log('action group:', GROUP.join(' · '), '| lane', JSON.stringify(LANE));

const rows = await page.evaluate(async ({ GROUP, LANE }) => {
  const I = await import('./src/inspect.js');
  const c = window.__clock;
  const out = { bands: {}, intruders: {}, axes: [] };
  // the alarm barrel's axis, read off a mesh of the unit rather than guessed
  let ax = null;
  c.scene.updateMatrixWorld(true);
  c.scene.traverse((o) => {
    if (ax || !o.isMesh || o.name !== 'alarmBarrelBody') return;
    o.updateMatrixWorld(true);
    ax = { x: o.matrixWorld.elements[12], y: o.matrixWorld.elements[13] };
  });
  if (!ax) {
    const u = window.__units().find((x) => x.name === 'Alarm barrel');
    if (u && u.meshes[0]) { u.meshes[0].updateMatrixWorld(true);
      ax = { x: u.meshes[0].matrixWorld.elements[12], y: u.meshes[0].matrixWorld.elements[13] }; }
  }
  out.axis = ax;
  const cyl = (m) => {
    m.updateMatrixWorld(true);
    const pos = m.geometry.attributes.position, v = m.position.clone();
    let rLo = 1e9, zLo = 1e9, zHi = -1e9;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const w = m.localToWorld(v.clone());
      if (w.z < LANE[0] || w.z > LANE[1]) continue;          // only what is IN the lane
      rLo = Math.min(rLo, Math.hypot(w.x - ax.x, w.y - ax.y));
      zLo = Math.min(zLo, w.z); zHi = Math.max(zHi, w.z);
    }
    return rLo < 1e9 ? { r: rLo, z: [zLo, zHi] } : null;
  };
  const AXES = I.AXES;
  for (const axis of AXES) {
    const N = 5;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      c.resetInputs?.(); c.setPose(axis.pose(f));
      c.scene.updateMatrixWorld(true);
      for (const u of window.__units()) {
        if (GROUP.includes(u.name)) continue;
        for (const m of u.meshes) {
          const k = cyl(m);
          if (!k) continue;
          const key = `${u.name} :: ${m.name || m.geometry.type}`;
          const prev = out.intruders[key];
          if (!prev || k.r < prev.r)
            out.intruders[key] = { r: +k.r.toFixed(3), z: k.z.map((x) => +x.toFixed(3)), at: `${axis.name} f=${f.toFixed(2)}` };
        }
      }
    }
    out.axes.push(axis.name);
  }
  // the group's own bands, at rest
  c.resetInputs?.(); c.setPose({ tau: 0.13 });
  c.scene.updateMatrixWorld(true);
  for (const u of window.__units()) {
    if (!GROUP.includes(u.name)) continue;
    for (const m of u.meshes) {
      m.updateMatrixWorld(true);
      const pos = m.geometry.attributes.position, v = m.position.clone();
      let zLo = 1e9, zHi = -1e9, rHi = 0;
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const w = m.localToWorld(v.clone());
        zLo = Math.min(zLo, w.z); zHi = Math.max(zHi, w.z);
        rHi = Math.max(rHi, Math.hypot(w.x - ax.x, w.y - ax.y));
      }
      out.bands[`${u.name} :: ${m.name || m.geometry.type}`] =
        { z: [+zLo.toFixed(3), +zHi.toFixed(3)], rMax: +rHi.toFixed(3) };
    }
  }
  return out;
}, { GROUP, LANE });

console.log('\naxis (alarm barrel centre):', JSON.stringify(rows.axis));
console.log('axes swept:', rows.axes.join(', '));
console.log(`\n--- the action group's own bands (z, max radius from the axis) ---`);
for (const [k, v] of Object.entries(rows.bands).sort((a, b) => a[1].z[0] - b[1].z[0]))
  console.log(`  ${k.padEnd(46)} z ${JSON.stringify(v.z).padEnd(20)} rMax ${v.rMax}`);
const ints = Object.entries(rows.intruders).sort((a, b) => a[1].r - b[1].r);
console.log(`\n--- everything OUTSIDE the group crossing z ${JSON.stringify(LANE)} (nearest first) ---`);
if (!ints.length) console.log('  (none — the lane is clear of every other unit over every axis)');
for (const [k, v] of ints)
  console.log(`  r ${String(v.r).padStart(8)}  z ${JSON.stringify(v.z).padEnd(20)} ${k}   @${v.at}`);
await browser.close();
srv.kill();
