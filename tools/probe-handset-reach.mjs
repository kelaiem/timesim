// HOW FAR DOWN THE HAND-SETTING CHAIN DOES THE `handSet` AXIS ACTUALLY REACH?
//
// TODO 135. The axis exists to sweep hand-setting, and it does move the keyless
// setting wheel and minute wheel through their whole travel. It does NOT move
// the cannon pinion, the motion works or the hands — under the walk every check
// performs. So `inspection:handSet`, `clearances:handSet` and
// `expectedContacts:handSet` sweep the hand-setting axis with the parts
// hand-setting drives pinned at the f = 0 pose, and `transmits` reports both
// motion-works rows `driver still` on it.
//
// The cause is a TIME-EASED tick law meeting a zero-dt pose. While the jumper
// is engaged (`crownPullT > 0.5`, which this axis pins at 1) the hands read
// `jumpDisp`, and `jumpDisp` approaches its target by
// `(target − jumpDisp)·(1 − exp(−rawDt/CAM_SNAP_TAU))` — which is identically
// zero when `rawDt` is zero, as it is under `setPose`. Only the first engaged
// tick after a reset moves it, via its `jumpDisp === null` initialiser. That is
// CLAUDE.md's "setPose ticks with zero dt" trap, reaching a whole sweep rather
// than one scripted write.
//
// REPORT, with the control that decides it — a frozen reading looks the same
// whether the axis is blind or the metal genuinely does not move:
//   A  enterAxis before EVERY sample (what a one-shot reading does)
//   B  enterAxis once, setPose per sample (what every sweep does)
//   C  as B, plus one step(dt) per sample so the ease can run
// B frozen while A and C move identifies the ease as the cause rather than
// leaving it a plausible story; the keyless rows beside them are the
// must-move control, since they read `setPathRot` directly and are unaffected.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8506', '--bind', '127.0.0.1'], { cwd: '/home/user/timesim', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8506/index.html', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
console.log(await p.evaluate(async () => {
  const C = window.__clock;
  const I = await import('./src/inspect.js');
  const axis = I.AXES.find((a) => a.name === 'handSet');
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const PARTS = ['cannonPinion', 'mwMinuteWheel', 'mwHourWheel', 'settingWheel', 'minuteWheel'];
  const run = (mode) => {
    const abs = Object.fromEntries(PARTS.map((n) => [n, 0]));
    const prev = {};
    if (mode !== 'A') I.enterAxis(C);
    for (let i = 0; i <= 64; i++) {
      if (mode === 'A') I.enterAxis(C);
      C.setPose(axis.pose(i / 64, C));
      if (mode === 'C') C.step(0.25);
      C.scene.updateMatrixWorld(true);
      for (const n of PARTS) {
        const a = C.rotorAzimuth(n).az;
        if (i > 0) abs[n] += Math.abs(wrap(a - prev[n]));
        prev[n] = a;
      }
    }
    return abs;
  };
  const A = run('A'), B = run('B'), Cc = run('C');
  C.resetInputs();
  const f = (x) => x.toFixed(5).padStart(11);
  return ['part              A: reset each   B: sweep-style   C: sweep + step']
    .concat(PARTS.map((n) => `  ${n.padEnd(16)}${f(A[n])}${f(B[n])}${f(Cc[n])}`))
    .concat([`\nVERDICT: motion works under a sweep-style walk: ${B.cannonPinion < 1e-9 ? 'FROZEN — the axis moves the keyless wheels and not the hands' : 'moves'}`,
             `CONTROL: with one step(dt) per sample it ${Cc.cannonPinion > 1e-9 ? 'MOVES — the ease is the cause' : 'is still frozen — the ease is NOT the cause'}`]).join('\n');
}));
await b.close(); srv.kill();
