// probe-colwheel-foul named six meshes touching the column wheel at 0. Two are
// declared rider contacts. This identifies the rest — what they are, where
// they were built, what material, whether they are NAMED, whether anything
// DECLARES the contact, and how the gap behaves across the toggle's two
// parities (the eye report says "every other toggle", so parity is the tell).
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
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };

  // the offenders, by the labels probe-colwheel-foul printed
  // (§173 took the click's two names off this list — the part is gone, and a
  // suspect that cannot be found reads as a suspect that came back clean.)
  const SUSPECTS = ['alarmLockBeakRiser', 'alarmLockBeak', 'alarmJumperBlade',
                    'alarmLinkBeakBar', 'alarmLinkBeak', 'alarmLinkBeakPost',
                    'alarmJumperShank', 'alarmJumperTip'];
  const wheelNames = ['alarmColBase', 'alarmColCastellations', 'alarmColSkirt'];
  const wheels = wheelNames.map(find);

  // …plus every UNNAMED mesh in the alarm units, which is where the report's
  // "phantom" would live: nameless metal is metal no declaration can reach.
  const unnamed = [];
  for (const e of clock.labelEntries) {
    if (!/^Alarm/.test(e.name)) continue;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || o.name) return;
      unnamed.push({ unit: e.name, obj: o });
    });
  }
  const matName = (m) => {
    for (const k of ['steel', 'nickel', 'blueSteel', 'brass', 'gold', 'ruby', 'plate'])
      if (window.__mats && window.__mats[k] === m) return k;
    return `#${m.id} ${m.color ? '#' + m.color.getHexString() : ''}`;
  };
  const describe = (o, unit) => {
    const bb = new THREE.Box3().setFromObject(o);
    const c = bb.getCenter(new THREE.Vector3());
    const chain = [];
    for (let q = o; q; q = q.parent) chain.push(q.name || q.type);
    return {
      label: o.name || `(unnamed ${o.geometry.type})`, unit,
      geom: o.geometry.type,
      params: o.geometry.parameters
        ? Object.entries(o.geometry.parameters).filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => `${k} ${+v.toFixed(4)}`).join(', ') : '',
      centre: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)],
      size: bb.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)),
      material: matName(o.material),
      parents: chain.slice(1, 4).join(' < '),
    };
  };

  // per-parity behaviour over the toggle
  const track = [];
  const targets = SUSPECTS.map(find).filter(Boolean).map((o) => ({ o, unit: null }))
    .concat(unnamed.map((u) => ({ o: u.obj, unit: u.unit })));
  for (const t of targets) {
    const row = { info: describe(t.o, t.unit), byParity: {} };
    for (const alarmOn of [0, 1]) {
      let best = Infinity, at = null, which = null;
      for (let i = 0; i <= 32; i++) {
        const f = i / 32;
        I.enterAxis(clock);
        clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                        alarmOn, alarmPressCycle: f * 2 });
        clock.scene.updateMatrixWorld(true);
        for (let w = 0; w < wheels.length; w++) {
          const c = I.meshClearance(t.o, wheels[w]);
          if (c < best) { best = c; at = +(f * 2).toFixed(3); which = wheelNames[w]; }
        }
      }
      row.byParity[alarmOn] = { min: +best.toFixed(4), cycle: at, body: which };
    }
    track.push(row);
  }
  // and what the declarations say about each
  const declared = I.INTRA_UNIT_CONTACTS.filter((r) => /alarmCol/.test(r.a) || /alarmCol/.test(r.b))
    .map((r) => `${r.unit}: ${r.a} ⇄ ${r.b}`);
  return { track, declared, unnamedCount: unnamed.length };
});
console.log(`unnamed meshes across the Alarm units: ${out.unnamedCount}\n`);
for (const r of out.track) {
  const i = r.info;
  const p0 = r.byParity[0], p1 = r.byParity[1];
  const parity = Math.abs(p0.min - p1.min) > 0.02 ? '  ← PARITY-DEPENDENT' : '';
  console.log(`${i.label}${i.unit ? '  [' + i.unit + ']' : ''}`);
  console.log(`    ${i.geom}(${i.params})  ${i.material}  under ${i.parents}`);
  console.log(`    centre ${i.centre.join(', ')}  size ${i.size.join(' × ')}`);
  console.log(`    alarmOn=0: ${String(p0.min).padStart(8)} vs ${p0.body} @ ${p0.cycle}`);
  console.log(`    alarmOn=1: ${String(p1.min).padStart(8)} vs ${p1.body} @ ${p1.cycle}${parity}`);
  console.log('');
}
console.log('INTRA_UNIT_CONTACTS rows naming a column-wheel body:');
for (const d of out.declared) console.log('   ' + d);
await b.close(); srv.kill();
