// TODO 90 finding 1 — WHERE CAN THE BEAK'S RISER STAND?
//
// It must cross the saw's z band (beak above the castellations, pivot below
// the skirt, no stratum avoids it), so the only free direction is RADIUS, and
// the saw sets the floor: tip + CLEAR_MARGIN + its own radius = 6.674 against
// 6.15 built. But the floor is not automatically a home — §163 put the driver
// pawl's post at 7.067 with a 0.533 boss, so its boss sweeps the annulus
// 6.534..7.600 through 30° of azimuth on every press, and the riser's floor
// lands exactly on that inner edge.
//
// So this scans the whole radial corridor rather than assuming the floor is
// free: a probe cylinder at the riser's own azimuth and z span, swept over the
// press cycle at both parities, measured against every other alarm mesh.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8489', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8489/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);

  const riser = find('alarmLockBeakRiser');
  const lever = riser.parent;
  const riserR = riser.geometry.parameters.radiusTop;
  const rb = new THREE.Box3().setFromObject(riser);
  const zLo = rb.min.z, zHi = rb.max.z;
  const wheelC = new THREE.Box3().setFromObject(find('alarmColBase')).getCenter(new THREE.Vector3());

  // the riser's station in the LEVER's frame, and its distance from the wheel
  const local = riser.position.clone();
  const pivot = lever.getWorldPosition(new THREE.Vector3());
  const pivotToCol = Math.hypot(wheelC.x - pivot.x, wheelC.y - pivot.y);

  // every alarm mesh that shares the riser's z band, excluding the lock's own
  const obstacles = [];
  const v = new THREE.Vector3();
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry) return;
    if (o === riser) return;
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.max.z < zLo - 1e-9 || bb.min.z > zHi + 1e-9) return;
    const dx = Math.max(bb.min.x - wheelC.x, 0, wheelC.x - bb.max.x);
    const dy = Math.max(bb.min.y - wheelC.y, 0, wheelC.y - bb.max.y);
    if (Math.hypot(dx, dy) > 12) return;
    obstacles.push(o);
  });

  // the saw polygon, for the floor
  let wheelGroup = null;
  clock.scene.traverse((o) => { if (o.name === 'alarmColSkirt') wheelGroup = o.parent; });
  const poly = wheelGroup.userData.ratchetPoly;
  let tipR = 0; for (const q of poly) tipR = Math.max(tipR, Math.hypot(q.x, q.y));

  // sweep: for each candidate radius, the worst clearance from a probe
  // cylinder at that radius to any obstacle, over the whole press cycle
  const rows = [];
  for (let R = 6.30; R <= 8.20001; R += 0.05) {
    let worst = Infinity, worstName = null, worstAt = null;
    for (const alarmOn of [0, 1]) for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      I.enterAxis(clock);
      clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                      alarmOn, alarmPressCycle: f * 2 });
      clock.scene.updateMatrixWorld(true);
      lever.updateWorldMatrix(true, false);
      // the probe stands on the tail's line at wheel-distance R: same local
      // direction the riser uses, re-solved for the new radius
      const dir = Math.sign(local.x) || -1;
      const lx = dir * (pivotToCol - R);
      const wp = lever.localToWorld(new THREE.Vector3(lx, local.y, local.z));
      for (const o of obstacles) {
        const bb = new THREE.Box3().setFromObject(o);
        if (bb.max.z < zLo - 1e-9 || bb.min.z > zHi + 1e-9) continue;
        // plan distance from the probe's axis to the obstacle's nearest vertex
        const pos = o.geometry.getAttribute('position');
        let best = Infinity;
        for (let k = 0; k < pos.count; k += 2) {
          v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
          if (v.z < zLo - 1e-9 || v.z > zHi + 1e-9) continue;
          const d = Math.hypot(v.x - wp.x, v.y - wp.y) - riserR;
          if (d < best) best = d;
        }
        if (best < worst) { worst = best; worstName = o.name || o.geometry.type; worstAt = `alarmOn=${alarmOn} f=${(f * 2).toFixed(2)}`; }
      }
    }
    rows.push({ R: +R.toFixed(3), clear: +worst.toFixed(4), against: worstName, at: worstAt });
  }
  return { riserR, zBand: [+zLo.toFixed(4), +zHi.toFixed(4)], pivotToCol: +pivotToCol.toFixed(4),
           localX: +local.x.toFixed(4), builtR: +(pivotToCol - Math.abs(local.x)).toFixed(4),
           tipR: +tipR.toFixed(4), floor: +(tipR + 0.15 + riserR).toFixed(4),
           obstacles: obstacles.length, rows };
});
console.log(`riser ⌀${(out.riserR * 2).toFixed(3)}, z ${out.zBand[0]}..${out.zBand[1]}`);
console.log(`lock pivot stands ${out.pivotToCol} from the wheel; riser local x ${out.localX} → r ${out.builtR}`);
console.log(`saw tips ${out.tipR}; the riser's floor = tip + CLEAR_MARGIN + its own radius = ${out.floor}`);
console.log(`${out.obstacles} meshes share its z band within 12 of the wheel\n`);
console.log('   R      clear   against                          worst pose');
for (const r of out.rows) {
  const flag = r.R < out.floor ? ' <- under the saw floor' : (r.clear >= 0.15 ? ' <- LEGAL' : '');
  console.log(`  ${r.R.toFixed(2)}  ${String(r.clear).padStart(8)}   ${String(r.against || '').padEnd(30)} ${r.at || ''}${flag}`);
}
await b.close(); srv.kill();
