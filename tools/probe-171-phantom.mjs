// THE PHANTOM, MEASURED — and since §171 landed, the ACCEPTANCE TEST for its
// repair. Eye-reported as "a phantom / vestigial steel arm that collides with
// the column wheel every other toggle", which named two members, not one.
//
// A PASSING RUN NOW READS: `alarmSwitchBeak` MISSING (deleted), the riser's
// worst clearance to `alarmColSkirt` at or over CLEAR_MARGIN 0.15 rather than
// clamped at 0, and `alarmLockBeak ⇄ alarmColCastellations` still 0 — that last
// one is the DECLARED kiss and a run where it stops touching is a regression,
// not an improvement.
//
// `alarmSwitchBeak` WAS a BoxGeometry(1.0, 0.4, 0.4) in MATS.steel on the lock
// lever, and its own comment described a wheel that had not existed since §68:
//
//   "the wheel stands 3.8 behind the pivot, so the beak's near face lands at
//    3.8 − 2.35 = 1.45 from the wheel axis — 0.05 of engagement into the
//    columns' outer face (1.5)"
//
// §68 took the column wheel to real chronograph scale — ALARM_COL_BASE_R 5.7,
// not 1.5 — and the pivot stands 8.0 behind, not 3.8. So a bar cut to engage
// 0.05 into a 1.5 ring was left sitting in a 5.7 one. TODO 24 had already built
// the read properly (alarmLockBeak on alarmLockBeakRiser, the nose whose inward
// face lands EXACTLY on the column's outer wall) and this bar was never
// removed: two beaks on one lever at the same station, one of them wired to
// nothing — it appeared in no MECH_GRAPH edge, no handoff row, no declared
// joint, and no table in inspect.js at all.
//
// The SECOND member the eye caught is the live one: alarmLockBeakRiser stood at
// wheel-radius 6.15 against saw tips at 6.384, its axis in the cut metal at
// rest in both alarm states. §171 moved it to tip + CLEAR_MARGIN + its own
// radius and grew the beak to reach back over the teeth.
//
// This measures all three against the wheel's three bodies so the report can
// say which member is which, and how close each one is.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8490', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8490/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const MINE = ['alarmSwitchBeak', 'alarmLockBeak', 'alarmLockBeakRiser'];
  const WHEEL = ['alarmColBase', 'alarmColCastellations', 'alarmColSkirt'];

  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const bands = {};
  for (const n of MINE.concat(WHEEL)) {
    const o = find(n); if (!o) { bands[n] = null; continue; }
    const x = new THREE.Box3().setFromObject(o);
    bands[n] = { z: [+x.min.z.toFixed(4), +x.max.z.toFixed(4)] };
  }
  // radial extent from the wheel's axis, at rest
  const wheelC = new THREE.Box3().setFromObject(find('alarmColBase')).getCenter(new THREE.Vector3());
  const v = new THREE.Vector3();
  for (const n of MINE) {
    const o = find(n); if (!o) continue;
    const pos = o.geometry.getAttribute('position');
    let lo = Infinity, hi = 0;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x - wheelC.x, v.y - wheelC.y);
      lo = Math.min(lo, r); hi = Math.max(hi, r);
    }
    bands[n].r = [+lo.toFixed(4), +hi.toFixed(4)];
  }
  // clearance over the toggle, both parities
  const rows = {};
  for (const alarmOn of [0, 1]) for (let i = 0; i <= 32; i++) {
    const f = i / 32;
    I.enterAxis(clock);
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                    alarmOn, alarmPressCycle: f * 2 });
    clock.scene.updateMatrixWorld(true);
    for (const an of MINE) { const a = find(an); if (!a) continue;
      for (const bn of WHEEL) { const bo = find(bn); if (!bo) continue;
        const c = I.meshClearance(a, bo), k = an + ' ⇄ ' + bn;
        if (!rows[k] || c < rows[k].c) rows[k] = { c, alarmOn, cycle: +(f * 2).toFixed(3) }; } }
  }
  return { bands, wheelBaseR: 5.7, tipR: +(1.12 * 5.7).toFixed(4),
    list: Object.entries(rows).map(([k, x]) => ({ pair: k, min: +x.c.toFixed(4), alarmOn: x.alarmOn, cycle: x.cycle }))
      .sort((a, x) => a.min - x.min) };
});
console.log('the wheel: base disc r 5.7, saw tips r ' + out.tipR + '\n');
for (const [k, v] of Object.entries(out.bands)) {
  if (!v) { console.log('  ' + k.padEnd(24) + ' MISSING'); continue; }
  console.log(`  ${k.padEnd(24)} z ${String(v.z[0]).padStart(8)}..${String(v.z[1]).padEnd(8)}`
    + (v.r ? `   r from the wheel's axis ${v.r[0]}..${v.r[1]}` : ''));
}
console.log('\nworst clearance over the toggle, both parities:');
for (const r of out.list)
  console.log(`  ${String(r.min).padStart(9)}  ${r.pair.padEnd(46)} alarmOn=${r.alarmOn} cycle=${r.cycle}`);
await b.close(); srv.kill();
