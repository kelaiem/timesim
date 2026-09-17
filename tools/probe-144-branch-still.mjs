// ACCEPTANCE — IS THE ALARM SETTING TRAIN REALLY CROWN-ONLY?
//
// TODO 117 took the hour out of the alarm disc: it carries the SET alone and
// stands still, and the hour reaches the trip by carrying the READER round
// instead. TODO 144 is the half of that which was left behind — the setting
// train's members (`alarmRotor`, `alarmSetI1Spin`, `alarmSetI2Spin`) kept a
// back-drive term `_bd = ALARM_BD_SIGN · hourDialA`, whose own comment named
// its source as "the hour's back-drive THROUGH THE DISC'S FRICTION SEAT". With
// no hour at the disc there is no such back-drive, so those members were being
// turned by a law with no input: six sim-hours moved the idler 3.3660 and the
// arbor 9.4248 — exactly 30/28 and 30/10 of the hour's own π — while the disc
// and the setting wheel, which were already crown-only, stood still.
//
// This holds the fixed state: under the HOUR ALONE, nothing in that train
// moves at all.
//
// WHY IT IS MEASURED IN WORLD AND NOT IN rotation.z. The first draft of this
// read each unit's CHILDREN's local rotations, and reported the whole chain
// still — including under the alarm crown, where it certainly is not. Two of
// these units carry their angle on the unit's OWN object (`alarmDiscGroup`,
// `alarmSetWheelGroup`) and the reader carries its orbit on an ANCESTOR
// (`hourWheelGroup`), so a local-rotation reading structurally cannot see the
// motion this probe exists to judge, and would have passed the defect it was
// written to catch. Every row is world matrices now.
//
// CONTROLS, and they are the reason a zero here means anything:
//   · must-hit — the READER moves under the hour. It is hour-carried, so if it
//     reads still the sweep did not advance the hour and every other zero is
//     vacuous.
//   · must-hit — the SAME members, measured the SAME way, move under the alarm
//     crown. A probe that cannot see this train move cannot claim it is still.
//   · must-hit — the going train moves under the hour, so the pose is real.
//
// cd tools && node probe-144-branch-still.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8565);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const C = window.__clock;
  // The setting train, crown to hand: everything the crown drives and the hour
  // must not. `Alarm release disc` is in it because the branch drives its rim.
  const TRAIN = ['Alarm crown', 'Alarm setting arbor', 'Alarm setting idler',
                 'Alarm setting wheel', 'Alarm release disc'];
  const READER = 'Alarm release reader';
  const GOING = 'Hour wheel';
  const ALL = [...TRAIN, READER, GOING];

  const meshesOf = (name) => {
    const e = C.labelEntries.find((x) => x.name === name);
    if (!e) return null;
    const out = [];
    e.obj.traverse((o) => { if (o.isMesh) out.push(o); });
    return out;
  };
  const M = {};
  for (const n of ALL) M[n] = meshesOf(n);
  const missing = ALL.filter((n) => !M[n] || !M[n].length);

  const snap = () => {
    C.scene.updateMatrixWorld(true);
    const s = {};
    for (const n of ALL) s[n] = M[n].map((m) => Array.from(m.matrixWorld.elements));
    return s;
  };
  const worst = (a, b, n) => {
    let w = 0;
    for (let i = 0; i < a[n].length; i++)
      for (let j = 0; j < 16; j++) w = Math.max(w, Math.abs(b[n][i][j] - a[n][i][j]));
    return w;
  };
  const base = { crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 0, alarmCrownRotation: 0 };

  // Leg 1 — the HOUR alone, over a span long enough that any surviving
  // back-drive term is unmistakable rather than near the noise.
  C.setPose({ ...base, tau: 0 });
  const h0 = snap();
  C.setPose({ ...base, tau: 6 * 3600 });
  const h1 = snap();
  const hour = {}; for (const n of ALL) hour[n] = +worst(h0, h1, n).toFixed(6);

  // Leg 2 — the alarm CROWN alone, same members, same metric.
  C.setPose({ ...base, tau: 0 });
  const c0 = snap();
  C.setPose({ ...base, tau: 0, alarmCrownRotation: Math.PI });
  const c1 = snap();
  const crown = {}; for (const n of ALL) crown[n] = +worst(c0, c1, n).toFixed(6);

  return { hour, crown, missing, TRAIN, READER, GOING };
});
await browser.close(); srv.kill();

if (out.missing.length) { console.log('FATAL — units not found:', out.missing.join(', ')); process.exit(1); }

const rows = [];
const push = (what, ok, got, want) => rows.push({ what, ok, got, want });
// A world matrix element moves by more than this only if the member moved;
// the leg-2 figures are order 1, so the gap is three orders, not a tuned bar.
const STILL = 1e-6;

console.log('\n  IS THE ALARM SETTING TRAIN CROWN-ONLY? (TODO 144)\n');
console.log('  unit                        under the HOUR      under the alarm CROWN');
for (const n of [...out.TRAIN, out.READER, out.GOING]) {
  const tag = out.TRAIN.includes(n) ? '' : (n === out.READER ? '  ← hour-carried' : '  ← going train');
  console.log(`  ${n.padEnd(26)} ${out.hour[n].toFixed(6).padStart(12)}   ${out.crown[n].toFixed(6).padStart(12)}${tag}`);
}

for (const n of out.TRAIN) {
  push(`${n} is STILL under the hour`, out.hour[n] < STILL,
    `${out.hour[n].toFixed(6)}`, `< ${STILL}`);
}
push('CONTROL the reader MOVES under the hour — it is hour-carried, so a still one means the sweep did nothing',
  out.hour[out.READER] > STILL, `${out.hour[out.READER].toFixed(6)}`, `> ${STILL}`);
push('CONTROL the going train MOVES under the hour, so the pose is real',
  out.hour[out.GOING] > STILL, `${out.hour[out.GOING].toFixed(6)}`, `> ${STILL}`);
const movers = out.TRAIN.filter((n) => out.crown[n] > STILL);
push('CONTROL the same members MOVE under the alarm crown, measured the same way',
  movers.length >= 3, `${movers.length} of ${out.TRAIN.length} move: ${movers.join(', ')}`, '≥ 3');

let bad = 0;
console.log('');
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
  console.log(`       got ${r.got}   want ${r.want}`);
}
console.log(`\n  ${rows.length} rows, ${bad} failing\n`);
process.exit(bad ? 1 : 0);
