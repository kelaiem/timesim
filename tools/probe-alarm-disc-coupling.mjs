#!/usr/bin/env node
// REPORT — DOES THE 'Alarm disc' COUPLE TO AND DECOUPLE FROM THE 'Hour wheel'
// AS METAL, OR DOES IT FOLLOW AN ASSERTED TARGET?
//
// The centre stack's declaration (src/main.js, 'Alarm setting wheel') says the
// seat IS the coupling: "ARMED it turns the tube; DISARMED the tube follows the
// heart underneath it and slips, so the crown's set position is kept." The tick
// law implements that as a TERNARY on a target —
//   tubeTarget = (alarmSelShownT > 0.5 || alarmArmFreed) ? -alarmAngle : hourDialA
// — eased toward with an exponential. This measures what that produces at the
// metal, in the three regimes the declaration names, so the gap between the
// sentence and the law is a number rather than a reading of the source.
//
// NOTE THE LABELS: registerLabel('Alarm disc', alarmTubeGroup) — the unit named
// 'Alarm disc' is the TUBE carrying the alarm hand. The notched release disc is
// a different unit, 'Alarm release disc', and it is NOT what this measures.
//
// WHICH PROBES THIS IS NOT. probe-138-coupling.mjs walks the BEVEL corners
// (crown -> setting arbor), not the centre stack's seats. probe-50-clutch.mjs
// is the going stem's sliding pinion. probe-mesh-transmission.mjs walks the
// hour's back-drive through the RELEASE DISC's friction seat as one of two
// inputs to the setting chain — it measures mesh ratios along that chain and
// never asks whether the tube's own seat couples or slips. Nothing in
// tools/INDEX.md measures this seat.
//
// TODO 129's lesson is why this exists: no axis poses "disarmed, tau varying",
// so the whole alarm branch went a year keyed to the hour's old sign with every
// gate green. This probe drives exactly that combination, plus its two
// siblings, with step() rather than setPose() — the tube's transition EASES on
// rawDt and a zero-dt pose flattens it (CLAUDE.md's own trap).
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = process.env.PORT || '8468';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['dev_server.py', port], { cwd: root, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: [
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });


// ONE EVALUATE PER REGIME. The first cut ran all three in a single evaluate and
// the run never returned — the armed regime alone takes ~14 s (the alarm rings
// through it) and the setting loop ~40 s, and a single long evaluate is also a
// single opaque failure. Per-regime calls print as they go, so a slow regime
// reads as slow rather than as hung.
const ent = `(n) => window.__clock.labelEntries.find((e) => e.name === n)?.obj`;
const prelude = `
  const C = window.__clock;
  const ent = (n) => C.labelEntries.find((e) => e.name === n)?.obj;
  const hour = ent('Hour wheel'), disc = ent('Alarm disc'), relDisc = ent('Alarm release disc');
  const still = ent('Dial');
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
`;

const timeRegime = (pose, tauPerStep) => page.evaluate(([pose, tauPerStep]) => {
  const C = window.__clock;
  const ent = (n) => C.labelEntries.find((e) => e.name === n)?.obj;
  const hour = ent('Hour wheel'), disc = ent('Alarm disc'), still = ent('Dial');
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  C.resetInputs(); C.setPose(pose);
  for (let i = 0; i < 40; i++) C.step(1 / 30);   // let the ease settle before measuring
  const h0 = hour.rotation.z, d0 = disc.rotation.z, s0 = still.rotation.z;
  let tau = pose.tau;
  for (let i = 0; i < 60; i++) { tau += tauPerStep; C.setPose({ ...pose, tau }); C.step(1 / 30); }
  return { dHour: wrap(hour.rotation.z - h0), dDisc: wrap(disc.rotation.z - d0), dStill: wrap(still.rotation.z - s0) };
}, [pose, tauPerStep]);

const base = { crownPullT: 0, leverEngage: 0, tension: 1 };
const rows = [];
for (const [name, pose, want] of [
  ['DISARMED, tau advancing', { ...base, tau: 0.13, alarmOn: 0, alarmCrownPullT: 0 }, 'disc RIDES the hour (ratio 1)'],
  ['ARMED, tau advancing',    { ...base, tau: 0.13, alarmOn: 1, alarmCrownPullT: 0 }, 'disc HOLDS the set time (ratio 0)'],
]) {
  const t = Date.now();
  rows.push({ name, want, ...(await timeRegime(pose, 60)) });
  console.log(`  ... ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}

// SETTING — one evaluate per crown step, same reason.
const setting = [];
for (let k = 1; k <= 4; k++) {
  const r = await page.evaluate((k) => {
    const C = window.__clock;
    const ent = (n) => C.labelEntries.find((e) => e.name === n)?.obj;
    const hour = ent('Hour wheel'), disc = ent('Alarm disc');
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const p = { crownPullT: 0, leverEngage: 0, tension: 1, tau: 0.13, alarmOn: 1, alarmCrownPullT: 1 };
    C.resetInputs(); C.setPose({ ...p, alarmCrownRotation: 0 });
    for (let i = 0; i < 40; i++) C.step(1 / 30);
    const h0 = hour.rotation.z, d0 = disc.rotation.z;
    C.setPose({ ...p, alarmCrownRotation: k * 0.4 });
    for (let i = 0; i < 20; i++) C.step(1 / 30);
    return { crown: k * 0.4, dHour: wrap(hour.rotation.z - h0), dDisc: wrap(disc.rotation.z - d0) };
  }, k);
  setting.push(r);
  console.log(`  ... setting crown ${r.crown.toFixed(2)}`);
}
const out = { rows, setting, stillName: 'Dial' };

// THROW rather than process.exit: this is "the instrument could not measure",
// not "the claim failed". It still exits non-zero, and index-instruments.mjs
// keys the acceptance/report split on process.exit — so exiting here would file
// a REPORT in the catalogue as an acceptance test, which is how a measurement
// gets read as a verdict.
if (out.err) { await browser.close(); srv.kill(); throw new Error(`${out.err}: ${out.names?.slice(0, 40).join(', ')}`); }
const f = (x) => (x >= 0 ? ' ' : '') + x.toFixed(5);
console.log('\n  THE TWO TIME REGIMES — step() through advancing tau\n');
console.log('  regime                        dHour      dDisc      ratio   want');
for (const r of out.rows) {
  const ratio = Math.abs(r.dHour) < 1e-9 ? NaN : r.dDisc / r.dHour;
  console.log(`  ${r.name.padEnd(26)} ${f(r.dHour)}  ${f(r.dDisc)}  ${(Number.isNaN(ratio) ? '   —  ' : f(ratio))}   ${r.want}`);
}
console.log('\n  CONTROLS');
const moved = out.rows.every((r) => Math.abs(r.dHour) > 1e-6);
console.log(`   must-MOVE  the hour wheel turned in every regime : ${moved ? 'PASS' : 'FAIL — the sweep advanced nothing, so every row above is vacuous'}`);
const stillOk = out.rows.every((r) => Math.abs(r.dStill) < 1e-9);
console.log(`   must-HOLD  ${String(out.stillName)} never turned : ${stillOk ? 'PASS' : 'FAIL — the whole scene is drifting'}`);
console.log('\n  SETTING — alarm crown OUT and turning, tau frozen\n');
console.log('  crown      dHour      dDisc');
for (const s of out.setting) console.log(`  ${s.crown.toFixed(2)}   ${f(s.dHour)}  ${f(s.dDisc)}`);
console.log('\n  Read: a real seat gives ratio 1 disarmed (riding the hour) and 0 armed');
console.log('  (holding the set time). A target-follower gives whatever the ternary');
console.log('  selects, which is the same two numbers — so the RATIOS alone cannot');
console.log('  tell the two apart. What separates them is whether the tube can be');
console.log('  made to slip, which needs a torque the model does not carry.\n');
await browser.close();
// Reap explicitly. `process.on('exit')` alone does NOT get here: the live child
// keeps the event loop alive, so the process never exits to fire it and the run
// hangs after printing its whole report — a pass that looks like a timeout.
srv.kill();
