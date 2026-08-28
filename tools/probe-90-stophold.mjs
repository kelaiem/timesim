// TODO 90 finding 4, ACCEPTANCE — the stop wheel actually holds, and the
// alarm still rings.
//
// probe-90-lockhold measured the DEFECT: the brake pad reached exact tangency
// with a smooth collar, so its normal force was zero and `alarmReleased`, a
// boolean, was the only thing stopping the striking train. This holds the
// REPAIR true from now on. The collar is cut into a 12-tooth stop wheel and
// tick() runs the train on `alarmStopClearAt(arm) >= 0` — a real gap between
// the finger and the teeth (TODO 90 finding 5 changed that argument from the
// lever's normalised amplitude to its ARM ANGLE, when the fold made the pose a
// solve from the cut) — so the two claims worth gating are:
//
//   1. the finger is INSIDE the teeth when the columns put the lever down,
//      and one CLEAR_MARGIN clear of the tips when they lift it;
//   2. the alarm still RINGS when armed (the barrel spends, strikes advance)
//      and does NOT when the switch is off — the behaviour the boolean used
//      to provide, now arriving through the metal.
//
// (2) is the half that matters most, because a hold that never releases is as
// wrong as one that never holds, and swapping a gate is exactly how you get
// one. WHICH PROBE THIS IS NOT: probe-90-lockhold is the diagnosis and stays
// a report; this is the regression gate that the diagnosis is fixed.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8494', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8494/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  const pad = find('alarmLockPad'), collar = find('alarmLockCollar');
  const rotor = collar.parent;

  // 1 — the finger against the teeth, measured off the tree at both extremes.
  //
  // ROOT AND TIP COME FROM THE CUT OUTLINE, not from the mesh's vertex extremes.
  // The first cut of this probe took min/max radius over every vertex, which was
  // right on the day it was written and wrong the moment §174 BORED the collar
  // onto its arbor: the bore's rim became the minimum radius, so the "tooth
  // depth" read 2.8167 instead of 0.3167 and the seat test failed against a
  // depth no tooth has. The mechanism was never wrong — `intoTeeth` measured
  // 0.3167 throughout — the reference was. `userData.ratchetPoly` is the very
  // polygon the Shape was extruded from, so it cannot acquire a feature the
  // teeth do not have.
  const poly = collar.userData.ratchetPoly;
  if (!poly) return { err: 'alarmLockCollar exports no ratchetPoly to measure its teeth against' };
  let root = Infinity, tip = -Infinity;
  for (const [x, y] of poly) {
    const r = Math.hypot(x, y); root = Math.min(root, r); tip = Math.max(tip, r); }
  const padR = pad.geometry.parameters.radiusTop;
  const seat = [];
  for (const [alarmOn, cycle] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
                    windAccumTurns: 0, alarmOn, alarmPressCycle: cycle });
    clock.scene.updateMatrixWorld(true);
    const ax = world(rotor), pc = world(pad);
    const d = Math.hypot(pc.x - ax.x, pc.y - ax.y);
    seat.push({ alarmOn, cycle, colBlock: clock.alarmDebug.profNow,
                intoTeeth: tip - (d - padR),      // >0 = finger inside the tooth band
                offTips: (d - padR) - tip });     // >0 = finger clear of the tips
  }

  // 2 — does it still ring? Arm it, wind it, run it to the coincidence, and
  // watch the barrel actually spend. Then the same with the switch OFF.
  const run = (alarmOn) => {
    // `alarmPressCycle` DERIVES alarmOn from the banked step count, so the
    // two keys must not both be passed here — the cycle would win and park
    // the wheel at the parity it implies. alarmOn's own branch nudges the
    // wheel to the requested parity, which is what this test wants.
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
                    windAccumTurns: 0, alarmOn,
                    alarmBarrelWind: 1.5, alarmReleased: true });
    const w0 = clock.alarmDebug.alarmBarrelWind;
    const ph0 = clock.alarmDebug.alarmStrikePhase;
    for (let i = 0; i < 240; i++) clock.step(1 / 60);
    const d = clock.alarmDebug;
    return { alarmOn, wind0: w0, wind1: d.alarmBarrelWind, spent: w0 - d.alarmBarrelWind,
             released: d.alarmReleased, colBlock: d.profNow };
  };
  const ringOn = run(1), ringOff = run(0);
  return { root, tip, padR, seat, ringOn, ringOff };
});
await b.close(); srv.kill();

const f = (x, n = 4) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(n));
console.log('\nTODO 90 finding 4 — the stop wheel holds, and the alarm still rings\n');
console.log(`stop wheel: root ${f(out.root)}  tip ${f(out.tip)}  depth ${f(out.tip - out.root)}   finger r ${f(out.padR)}\n`);
console.log('1. the finger against the teeth');
for (const s of out.seat)
  console.log(`   alarmOn=${s.alarmOn} cycle ${s.cycle}  colBlock ${f(s.colBlock)}  into teeth ${f(s.intoTeeth)}  off tips ${f(s.offTips)}`);

const engaged = out.seat.filter((s) => s.colBlock > 0.999);
const lifted = out.seat.filter((s) => s.colBlock < 0.001);
const DEPTH = out.tip - out.root;
const okSeat = engaged.length > 0 && engaged.every((s) => s.intoTeeth >= DEPTH - 1e-6);
const okLift = lifted.length > 0 && lifted.every((s) => Math.abs(s.offTips - 0.15) < 1e-6);
console.log(`   engaged: finger in by the full ${f(DEPTH)} -> ${okSeat ? 'PASS' : 'FAIL'}`);
console.log(`   lifted : finger one CLEAR_MARGIN off the tips -> ${okLift ? 'PASS' : 'FAIL'}`);

console.log('\n2. the ring, driven through the new gate');
for (const r of [out.ringOn, out.ringOff])
  console.log(`   alarmOn=${r.alarmOn}  colBlock ${f(r.colBlock)}  wind ${f(r.wind0, 3)} -> ${f(r.wind1, 3)}  spent ${f(r.spent, 4)}  released ${r.released}`);
const okRings = out.ringOn.spent > 1e-4;
const okHolds = out.ringOff.spent <= 1e-9;
console.log(`   armed: the barrel spends -> ${okRings ? 'PASS' : 'FAIL'}`);
console.log(`   off  : the barrel is held -> ${okHolds ? 'PASS' : 'FAIL'}`);

const ok = okSeat && okLift && okRings && okHolds;
console.log(`\n${ok ? 'PASS' : 'FAIL'} — TODO 90 finding 4`);
process.exit(ok ? 0 : 1);
