// ACCEPTANCE — DOES THE ALARM STILL RING AT THE TIME IT IS SET TO?
//
// TODO 117's fold moves the trip. The disc used to carry hour + set and be read
// by a pin fixed at the release azimuth; it now carries the SET alone and the
// READER carries the hour round to meet it. That is a change to WHICH TWO
// ANGLES COINCIDE, and nothing in the battery measures a time — every gate
// there measures geometry.
//
// The item names the invariant that must survive and it is not an arithmetic
// one: THE PIN BOTTOMS WHEN THE HOUR HAND'S WORLD AZIMUTH MEETS THE ALARM
// HAND'S. Both hands are metal, so this measures the metal — the azimuth of
// each hand's OWN TIP, found as the farthest vertex from the dial centre in the
// unit that carries it, at the pose where the pin is fully down.
//
// WHY THIS IS NOT probe-handedness.mjs's law tier. That one sweeps tau and asks
// whether the pin's plateau is EVEN about its own centre — a question about the
// notch's cut, which the fold does not touch. It would pass just as happily
// with the alarm ringing six hours late, because it never looks at a hand. The
// in-tick assert that used to ask this question became an IDENTITY when the
// fold made the notch one expression (both its sides now descend from
// alarmNotchA), so it cannot ask it either. This is where the question lives
// now: rule 6, a claim about a POSE belongs in an instrument.
//
// THE BAR IS A CONSTANT, NOT A ZERO. A fixed offset between the two tips is a
// build phase — where the notch is cut relative to the hand, where the hand is
// pressed on its tube — and it is absorbed by ALARM_RELEASE_PHASE. What would
// be a defect is an offset that MOVES with the setting: that means the trip is
// reading a different difference than the hands display. So the test is the
// SPREAD across settings, against the sampling resolution of the sweep.
//
// CONTROLS, and the third is the one that makes the first two mean anything:
//   · must-hit  — the three settings must trip at DIFFERENT taus, or the sweep
//     is measuring one alarm three times.
//   · must-hit  — the pin must actually bottom at every setting; a sweep that
//     never trips has nothing to report and must say so rather than average an
//     empty set.
//   · must-fail — the same spread, computed against a FIXED azimuth instead of
//     the alarm hand's, must be large. If a constant offset came back for that
//     too, the test is insensitive to what it claims to measure.
//
// cd tools && node probe-117-trip.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8537);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = window.__clock;
  const cx = C.P.dial.x, cy = C.P.dial.y;
  const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // A HAND'S AZIMUTH IS ITS TIP'S, and the tip is found rather than named: the
  // farthest vertex from the dial centre inside the unit that carries it. That
  // survives a rename and cannot be satisfied by a rotation nobody applied to
  // metal — the failure mode the reverted step-1 hand-off probe walked into.
  const v = new THREE.Vector3();
  const tipAz = (unitName) => {
    const e = C.labelEntries.find((x) => x.name === unitName);
    if (!e) return null;
    e.obj.updateWorldMatrix(true, true);
    let best = -1, az = null;
    e.obj.traverse((m) => {
      if (!m.isMesh) return;
      const pos = m.geometry?.attributes?.position; if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const r = Math.hypot(v.x - cx, v.y - cy);
        if (r > best) { best = r; az = Math.atan2(v.y - cy, v.x - cx); }
      }
    });
    return { az, r: best };
  };

  const base = { crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 0 };
  const SPAN = 12 * 3600, N = 3000;
  const settings = [0, 0.7, 1.9].map((turns) => turns * Math.PI * 2);

  const rows = [];
  for (const rot of settings) {
    // Find the plateau: every sample where the pin is fully down, then its
    // centre. Taking the first sample instead would read the notch's leading
    // edge and make the offset depend on the sweep's direction.
    const hits = [];
    let peak = 0;
    for (let i = 0; i < N; i++) {
      C.setPose({ ...base, alarmCrownRotation: rot, tau: (i / N) * SPAN });
      const d = C.alarmPinDrop;
      if (d > peak) { peak = d; hits.length = 0; }
      if (d >= peak - 1e-12) hits.push(i);
    }
    if (!hits.length || peak <= 0) { rows.push({ rot, tripped: false }); continue; }
    const mid = hits[Math.floor(hits.length / 2)];
    const tau = (mid / N) * SPAN;
    C.setPose({ ...base, alarmCrownRotation: rot, tau });
    const hour = tipAz('Hour wheel');
    const alarm = tipAz('Alarm disc');
    rows.push({
      rot, tripped: true, peak, tau, plateau: hits.length,
      hourAz: hour?.az ?? null, hourR: hour?.r ?? null,
      alarmAz: alarm?.az ?? null, alarmR: alarm?.r ?? null,
      offset: (hour && alarm) ? wrapPi(hour.az - alarm.az) : null,
      // the must-fail control's quantity: the hour tip against a FIXED azimuth
      offsetFixed: hour ? wrapPi(hour.az - 0) : null,
    });
  }
  return { rows, N, SPAN, resolution: (SPAN / N) };
});
await browser.close(); srv.kill();

const rows = out.rows;
const checks = [];
const push = (what, ok, got, want) => checks.push({ what, ok, got, want });
const spread = (xs) => {
  if (xs.some((x) => x === null || x === undefined)) return null;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let worst = 0;
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++)
    worst = Math.max(worst, Math.abs(wrap(xs[i] - xs[j])));
  return worst;
};

console.log(`\n  DOES THE ALARM RING WHEN IT IS SET TO? (TODO 117) — ${out.N} samples over 12 h\n`);
console.log('   crown turns   tripped   trip tau (s)   plateau   hour tip az     alarm tip az    offset');
for (const r of rows) {
  const t = (r.rot / (Math.PI * 2)).toFixed(2).padStart(6);
  if (!r.tripped) { console.log(`  ${t}          NO`); continue; }
  console.log(`  ${t}         yes   ${r.tau.toFixed(1).padStart(11)}   ${String(r.plateau).padStart(7)}   ${r.hourAz.toFixed(5).padStart(11)}   ${r.alarmAz.toFixed(5).padStart(12)}   ${r.offset.toFixed(5)}`);
}

// The hour hand advances 2π over 12 h, so one sample of tau is this much hand
// angle — the floor under any offset spread this sweep can resolve.
const angRes = (2 * Math.PI) * (out.resolution / out.SPAN);
push('every setting trips — the sweep has something to measure',
  rows.every((r) => r.tripped), rows.map((r) => (r.tripped ? 'yes' : 'NO')).join(' '), 'all yes');
push('CONTROL the settings trip at DIFFERENT times, so this is three alarms and not one',
  new Set(rows.filter((r) => r.tripped).map((r) => r.tau.toFixed(1))).size === rows.filter((r) => r.tripped).length,
  rows.filter((r) => r.tripped).map((r) => r.tau.toFixed(0)).join(', ') + ' s', 'all different');
const sp = spread(rows.filter((r) => r.tripped).map((r) => r.offset));
push('the hour hand meets the alarm hand at a CONSTANT offset across settings',
  sp !== null && sp <= 3 * angRes,
  `spread ${sp === null ? 'n/a' : sp.toFixed(5)} rad`, `≤ ${(3 * angRes).toFixed(5)} (3 samples of hand angle)`);
const spF = spread(rows.filter((r) => r.tripped).map((r) => r.offsetFixed));
push('CONTROL against a FIXED azimuth the same spread is large, so the test can say no',
  spF !== null && spF > 20 * angRes, `spread ${spF === null ? 'n/a' : spF.toFixed(5)} rad`, `> ${(20 * angRes).toFixed(5)}`);

let bad = 0;
console.log('');
for (const c of checks) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.what}`);
  console.log(`       got ${c.got}   want ${c.want}`);
}
console.log(`\n  ${checks.length} rows, ${bad} failing\n`);
process.exit(bad ? 1 : 0);
