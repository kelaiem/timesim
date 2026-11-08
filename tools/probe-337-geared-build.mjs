#!/usr/bin/env node
// §337 landing 2b, stage 2 — THE GEARED GENEVA'S METAL, measured off a boot of ?arrest=geared. A REPORT (it prints and judges nothing;
// stage 3 gates what it shows).
//
// At each tension across the wind (full, 3/4, 1/2, 1/4, empty) it poses the movement and reads:
//   · the boot's warnings (the build's own asserts), the cone wheel ⇄ pinion gap (a mesh: a small positive clearance is a meshed
//     pair, zero a tooth on tooth, negative a clash), the pin ⇄ star gap (the pin in a slot sits its running fit from the walls),
//     the star's pose against the Geneva law (open slot centred on the pin's line through every passage),
//   · the stop-work's clearances to the cock, the plate, the chain and the centre wheel, and the cock's to the plate (the branch arm
//     stands in the bulge the plate was cut with).
//   node tools/probe-337-geared-build.mjs [reserve hours …]   (default 24)
import { bootMany } from './boot-pool.mjs';
const hours = process.argv.slice(2).map(Number).filter(Boolean);
if (!hours.length) hours.push(24);
const EXPR = `(async () => {
  const I = await import('./src/inspect.js');
  const c = window.__clock, out = { rows: [] };
  const meshesOf = (name) => { const r = []; c.scene.traverse((o) => { if (o.name === name) o.traverse((q) => { if (q.isMesh) r.push(q); }); }); return r; };
  const byName = (name) => { const r = []; c.scene.traverse((o) => { if (o.isMesh && o.name === name) r.push(o); }); return r; };
  const min2 = (A, B) => { let d = Infinity; for (const a of A) for (const b of B) d = Math.min(d, I.meshClearance(a, b)); return d; };
  for (const tension of [1, 0.75, 0.5, 0.25, 0]) {
    c.setPose({ tension });
    c.scene.updateMatrixWorld(true);
    const row = { tension };
    row.coneWheelPinion = min2(meshesOf('gearedConeWheel'), meshesOf('gearedPinion'));
    row.pinStar = min2(byName('stopworkPin'), byName('stopworkStar'));
    row.crankStar = min2(byName('gearedCrank'), byName('stopworkStar'));
    row.lockStar = min2(byName('stopworkLockDisc'), byName('stopworkStar'));
    for (const other of ['Fusee cock', 'Three-quarter plate', 'Chain', 'Center wheel', 'Fusee & great wheel'])
      row['unit⇄' + other] = I.clearanceAt(c, 'Winding stop-work', other);
    row['cock⇄plate'] = I.clearanceAt(c, 'Fusee cock', 'Three-quarter plate');
    out.rows.push(row);
  }
  out.sw = c.windArrest.stopwork;
  return out;
})()`;
const rs = await bootMany(hours.map((h) => `arrest=geared&reserveh=${h}`), EXPR, { concurrency: 1 });
for (let i = 0; i < hours.length; i++) {
  const r = rs[i];
  console.log(`\n== ${hours[i]} h ==  boot ${r.bootError ?? 'ok'}, ${r.warnings.length} warning(s)`);
  for (const w of r.warnings.slice(0, 30)) console.log('  warn:', String(w).slice(0, 220));
  if (!r.extra) continue;
  const f = (x) => (Number.isFinite(x) ? x.toFixed(4) : String(x));
  const sw = r.extra.sw;
  console.log(`  stop-work: n${sw.n} m${sw.m} ratio ${f(sw.ratio)} r1 ${f(sw.r1)} lock arcs ±${f(sw.lockArcDeg)}° unlocked ${f(sw.unlockedDeg)}° (disc open ${f(sw.discOpenDeg)}° in ${sw.discRuns} run(s), relief min ${f(sw.reliefMin)}, lock R ${f(sw.lockR)}) finger stud r ${f(sw.studFr)} branch ${f(sw.branchW)}`);
  const keys = Object.keys(r.extra.rows[0]).filter((k) => k !== 'tension');
  console.log('  tension  ' + keys.join('  '));
  for (const row of r.extra.rows) console.log('  ' + row.tension.toFixed(2) + '     ' + keys.map((k) => f(row[k])).join('  '));
}
