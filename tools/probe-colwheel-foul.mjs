// EYE REPORT: "a phantom / vestigial steel arm collides with the column wheel
// every other toggle."
//
// "Every other toggle" is a PARITY, which is the tell: the wheel indexes half
// a column pitch per press, so a rider that fouls on one parity and clears on
// the other is reading the castellations rather than the saw. Every gate is
// green over this, so whatever it is, it is in one of the battery's declared
// blind spots — an EXPECTED-pair blanket, an out-of-scope intraUnit tier, or a
// transient between pose samples (TODO 7).
//
// This asks the question directly: over the whole toggle cycle, at fine steps,
// what comes within CLEAR_MARGIN of any of the column wheel's three bodies?
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8488', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8488/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const WHEEL = ['alarmColBase', 'alarmColCastellations', 'alarmColSkirt'];
  const wheels = WHEEL.map(find).filter(Boolean);

  // everything with metal near the wheel, excluding the wheel itself and the
  // driver group (whose contacts §169 already holds)
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const wc = new THREE.Box3().setFromObject(find('alarmColBase')).getCenter(new THREE.Vector3());
  const near = [];
  const v = new THREE.Vector3();
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry) return;
    if (/^alarmCol/.test(o.name || '')) return;
    const bb = new THREE.Box3().setFromObject(o);
    const dx = Math.max(bb.min.x - wc.x, 0, wc.x - bb.max.x);
    const dy = Math.max(bb.min.y - wc.y, 0, wc.y - bb.max.y);
    if (Math.hypot(dx, dy) > 10) return;
    near.push(o);
  });

  // sweep the toggle at fine steps, both parities of the press cycle
  const rows = {};
  const N = 65;
  for (const alarmOn of [0, 1]) for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    I.enterAxis(clock);
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                    alarmOn, alarmPressCycle: f * 2 });
    clock.scene.updateMatrixWorld(true);
    for (const a of near) for (const w of wheels) {
      const c = I.meshClearance(a, w);
      if (c > 0.15) continue;                       // CLEAR_MARGIN — only report what is close
      const k = (a.name || a.geometry.type) + ' ⇄ ' + w.name;
      if (!rows[k] || c < rows[k].c) rows[k] = { c, alarmOn, cycle: +(f * 2).toFixed(3) };
    }
  }
  // which unit does each offender belong to, and is that pair EXPECTED?
  const unitOf = (mesh) => {
    let best = null, bestHops = Infinity;
    for (const e of clock.labelEntries) {
      let n = 0;
      for (let o = mesh; o; o = o.parent, n++) if (o === e.obj) { if (n < bestHops) { bestHops = n; best = e.name; } break; }
    }
    return best;
  };
  const byName = new Map(near.map((o) => [o.name || o.geometry.type, o]));
  return {
    nearCount: near.length,
    rows: Object.entries(rows).map(([k, x]) => ({
      pair: k, min: +x.c.toFixed(4), alarmOn: x.alarmOn, cycle: x.cycle,
      unit: unitOf(byName.get(k.split(' ⇄ ')[0])) || '(none)',
    })).sort((a, x) => a.min - x.min),
  };
});
console.log(`${out.nearCount} non-wheel meshes have metal within 10 of the column wheel\n`);
if (!out.rows.length) console.log('  nothing comes within CLEAR_MARGIN of the wheel over the whole toggle.');
for (const r of out.rows)
  console.log(`  ${String(r.min).padStart(9)}  ${r.pair.padEnd(48)} [${r.unit}]  alarmOn=${r.alarmOn} cycle=${r.cycle}`);
await b.close(); srv.kill();
