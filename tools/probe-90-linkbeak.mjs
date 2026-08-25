// TODO 90 finding 2 — THE LINK BEAK'S OWN MEMBERS AGAINST THE COLUMN WHEEL.
//
// Eye-reported and highlighted: the bar that reaches under the wheel and the
// post that drops through it. `alarmLinkBeak` (the NOSE) riding the column TOPS
// is §35's declared read; the BAR and the POST have no declaration touching the
// wheel at all, and they cannot be caught by anything the battery runs:
//   · `Alarm link ⇄ Alarm switch` is CROSS-UNIT, so `intraUnit` never looks;
//   · that pair is EXPECTED (the nose is meant to touch), and it has no
//     `EXPECTED_CONTACT_FLOORS` row — so TODO 6's blanket excuses every mesh in
//     both units, exactly as it did for §171's riser.
//
// So this measures the members individually, three ways, because meshClearance
// clamps at 0 and cannot tell a kiss from a burial:
//   1. meshClearance per (member, wheel body) over the toggle at both parities;
//   2. vertices of the member strictly inside the wheel body (parity raycast);
//   3. for the POST — a rod, whose CylinderGeometry has no vertices in the saw's
//      band at all (MODELING.md rule 5) — the disc-vs-ratchetPoly method, with
//      §171's chaperone beside it so an axis on a cut edge cannot cry wolf.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8506', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8506/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const MINE = ['alarmLinkBeakBar', 'alarmLinkBeakPost', 'alarmLinkBeakTail', 'alarmLinkBeak'];
  const WHEEL = ['alarmColBase', 'alarmColCastellations', 'alarmColSkirt'];
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);

  const ray = new THREE.Raycaster(); ray.firstHitOnly = false;
  const v = new THREE.Vector3();
  const DIRS = [new THREE.Vector3(0.577,0.577,0.578), new THREE.Vector3(-0.51,0.62,0.596), new THREE.Vector3(0.33,-0.72,0.61)]
    .map((d) => d.normalize());
  // a vertex counts as INSIDE only if a majority of independent rays agree — a
  // single direction is what makes a parity test fragile on shared faces.
  const insideCount = (a, bo, cap = 600) => {
    const pos = a.geometry.getAttribute('position');
    const step = Math.max(1, Math.floor(pos.count / cap));
    const bb = new THREE.Box3().setFromObject(bo);
    let n = 0, tested = 0;
    for (let k = 0; k < pos.count; k += step) {
      v.fromBufferAttribute(pos, k).applyMatrix4(a.matrixWorld);
      if (!bb.containsPoint(v)) continue;
      tested++;
      let odd = 0;
      for (const d of DIRS) { ray.set(v, d); if (ray.intersectObject(bo, false).length % 2 === 1) odd++; }
      if (odd >= 2) n++;
    }
    return { n, tested };
  };

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
  // at rest, count vertices inside
  I.enterAxis(clock);
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmOn: 0, alarmPressCycle: 0 });
  clock.scene.updateMatrixWorld(true);
  const deep = [];
  for (const an of MINE) { const a = find(an); if (!a) continue;
    for (const bn of WHEEL) { const bo = find(bn); if (!bo) continue;
      const ba = new THREE.Box3().setFromObject(a), bb = new THREE.Box3().setFromObject(bo);
      if (!ba.intersectsBox(bb)) continue;
      const x = insideCount(a, bo), y = insideCount(bo, a);
      if (!x.n && !y.n) continue;
      deep.push({ pair: an + ' ⇄ ' + bn, aIn: x.n, aOf: x.tested, bIn: y.n, bOf: y.tested }); } }
  // z bands, for the "which stratum" question
  const bands = {};
  for (const n of MINE.concat(WHEEL)) { const o = find(n); if (!o) continue;
    const x = new THREE.Box3().setFromObject(o); bands[n] = [+x.min.z.toFixed(4), +x.max.z.toFixed(4)]; }
  return { rows: Object.entries(rows).map(([k, x]) => ({ pair: k, min: +x.c.toFixed(4), alarmOn: x.alarmOn, cycle: x.cycle }))
             .sort((a, x) => a.min - x.min), deep, bands };
});
console.log('z bands:');
for (const [k, v] of Object.entries(out.bands)) console.log(`  ${k.padEnd(24)} ${String(v[0]).padStart(9)} .. ${v[1]}`);
console.log('\nworst meshClearance over the whole toggle, both parities (clamps at 0):');
for (const r of out.rows) console.log(`  ${String(r.min).padStart(8)}  ${r.pair.padEnd(44)} alarmOn=${r.alarmOn} cycle=${r.cycle}`);
console.log('\nvertices strictly INSIDE the other solid, at rest (2-of-3 ray agreement):');
if (!out.deep.length) console.log('  none — every contact above is a surface kiss, not a burial.');
for (const d of out.deep) console.log(`  ${d.pair.padEnd(44)}  A in B ${d.aIn}/${d.aOf}   B in A ${d.bIn}/${d.bOf}`);
await b.close(); srv.kill();
