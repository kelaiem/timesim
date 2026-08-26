// §173 FOLD — WHAT OCCUPIES THE SAW'S Z BAND, AND WHERE IS THE FREE AZIMUTH?
//
// The jumper's tip belongs INSIDE the tooth space, so it overlaps the saw's
// annulus by design. What it must avoid is everything ELSE living in that band,
// and the product of this scan is the azimuth windows where nothing does.
//
// Two mistakes this probe was born from, both of which reported a CLEANER band
// than the truth — the dangerous direction for a scan whose answer is "there is
// room here":
//
//  1. A "near the wheel" filter of 12 units on the bounding box. At 5 it
//     excluded every part that matters, because they stand at r 6.5–7.8 — the
//     lock beak's riser and the link beak's post both vanished from a scan
//     whose whole purpose was to find them.
//  2. A z-filter on VERTICES. A CylinderGeometry rod carries vertices at its
//     two end rings and none in between, so any rod that CROSSES the band has
//     no vertex inside it and contributed nothing. MODELING.md rule 5, for the
//     sixth time in this cluster. Every vertex of a mesh whose bbox spans the
//     band now counts: conservative over-reporting is the safe direction here.
//
// And the keying is by UUID, not by name. Several unnamed CylinderGeometry
// meshes share one unit, so keying on 'name|unit' merged them into a single
// phantom row spanning 330° and r 0..7.09 — parts that are metres apart in the
// model presented as one obstruction, some of which §173 deletes anyway.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8521', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8521/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const skirt = find('alarmColSkirt'), base = find('alarmColBase');
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const sb = new THREE.Box3().setFromObject(skirt);
  const wc = new THREE.Box3().setFromObject(base).getCenter(new THREE.Vector3());
  const zLo = sb.min.z, zHi = sb.max.z;
  const unitOf = (m) => {
    let best = '(none)', h = Infinity;
    for (const e of clock.labelEntries) { let n = 0;
      for (let o = m; o; o = o.parent, n++) if (o === e.obj) { if (n < h) { h = n; best = e.name; } break; } }
    return best;
  };
  const occ = new Map();
  const v = new THREE.Vector3();
  for (const alarmOn of [0, 1]) for (let i = 0; i <= 16; i++) {
    I.enterAxis(clock);
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                    alarmOn, alarmPressCycle: (i / 16) * 2 });
    clock.scene.updateMatrixWorld(true);
    clock.scene.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry) return;
      if (/^alarmCol(Base|Skirt|Castellations)$/.test(o.name || '')) return;   // the wheel itself
      const bb = new THREE.Box3().setFromObject(o);
      if (bb.max.z < zLo - 1e-9 || bb.min.z > zHi + 1e-9) return;
      const dx = Math.max(bb.min.x - wc.x, 0, wc.x - bb.max.x);
      const dy = Math.max(bb.min.y - wc.y, 0, wc.y - bb.max.y);
      if (Math.hypot(dx, dy) > 12) return;
      const pos = o.geometry.getAttribute('position');
      let e = occ.get(o.uuid);
      if (!e) { e = { name: o.name || '(unnamed ' + o.geometry.type + ')', unit: unitOf(o),
                      rMin: Infinity, rMax: 0, angles: [] }; occ.set(o.uuid, e); }
      for (let k = 0; k < pos.count; k += 2) {
        v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
        const r = Math.hypot(v.x - wc.x, v.y - wc.y);
        if (r > 10) continue;
        e.angles.push(Math.atan2(v.y - wc.y, v.x - wc.x) * 180 / Math.PI);
        e.rMin = Math.min(e.rMin, r); e.rMax = Math.max(e.rMax, r);
      }
    });
  }
  const rows = [];
  for (const e of occ.values()) {
    if (!e.angles.length) continue;
    const s = e.angles.slice().sort((x, y) => x - y);
    let gapMax = 0, gapAt = 0;
    for (let i = 1; i < s.length; i++) { const g = s[i] - s[i - 1]; if (g > gapMax) { gapMax = g; gapAt = i; } }
    const wrapGap = 360 - (s[s.length - 1] - s[0]);
    let lo, hi;
    if (wrapGap >= gapMax) { lo = s[0]; hi = s[s.length - 1]; }
    else { lo = s[gapAt]; hi = s[gapAt - 1] + 360; }
    rows.push({ name: e.name, unit: e.unit, aLo: +lo.toFixed(1), aHi: +hi.toFixed(1),
                rMin: +e.rMin.toFixed(3), rMax: +e.rMax.toFixed(3) });
  }
  rows.sort((a, b) => a.aLo - b.aLo);
  return { zBand: [+zLo.toFixed(4), +zHi.toFixed(4)], rows };
});
console.log('the saw z band: ' + out.zBand[0] + ' .. ' + out.zBand[1]);
console.log('(a mesh is listed once per UUID, so two unnamed rods stay two rows)\n');
console.log('   azimuth span            radius           member');
for (const r of out.rows)
  console.log('  ' + String(r.aLo).padStart(7) + ' .. ' + String(r.aHi).padStart(7)
    + '   ' + String(r.rMin).padStart(6) + '..' + String(r.rMax).padEnd(7)
    + '  ' + r.name + '  [' + r.unit + ']');
await b.close(); srv.kill();
