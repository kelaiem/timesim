// TODO 257 — THE HACK PAD BRAKES WHEN IT TOUCHES THE RIM, NOT WHEN THE CROWN MOVES.
//
// ACCEPTANCE (exits non-zero on a failed claim or a failed control). Before TODO
// 257 the live loop braked the balance by `leverEngage · brakeNm`, with
// leverEngage an eased scalar that left 0 on the first frame of the crown's
// travel — so at a reduced time scale the wheel visibly slowed while the pad
// was still most of a stroke below the rim. The brake is now the pad's own
// contact (main.js `HACK_PAD`): zero until the pad's top reaches the rim
// underside, built over the rod's priced give (a fraction of a micrometre of
// pad rise), full at the crown's stroke end.
//
// What it holds, in the LIVE loop (`step`, since a pose integrates nothing):
//   1. BEFORE TOUCH THE BALANCE IS UNTOUCHED. The same state is run twice from
//      one deterministic start, once with the crown left in and once pulled; at
//      every sample until the pad is within the contact window the two balances
//      are the same to float. (They would not be: the old law had taken 18% of
//      the swing's speed by the time the pad was half way.)
//   2. THE CONTROL: the old law, run on the very same balance model with the very
//      same leverEngage timeline, DOES deviate from the free run before touch by
//      more than the tolerance — so (1) is a check that can fail.
//   3. AT TOUCH IT STOPS, and holds: omega is exactly 0 within STOP_S of arrival
//      and theta does not move for HOLD_S more.
//   4. THE PAD'S OWN NUMBERS are consistent: engagement is 0 above the window,
//      1 at the rim, monotone between; the window is the rod's give at the
//      holding load (virtual work through the crank), a fraction of the stroke.
//   5. RELEASE LETS GO: pushing the crown in drops engagement to 0 inside a few
//      frames and the balance is swinging again within RESTART_S.
//
// Run from tools/: `node probe-257-hack-contact.mjs`
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const port = process.env.PORT || '8498';
const STOP_S = 0.25, HOLD_S = 1.0, RESTART_S = 1.5, FLOAT = 1e-9;
const srv = spawn('python3', [join(ROOT, 'dev_server.py'), port], { cwd: ROOT, env: { ...process.env, TMPDIR: mkdtempSync(join(tmpdir(), 'p257-')) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling'] });
let R;
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 240000 });
  R = await page.evaluate(async ({ STOP_S, HOLD_S, RESTART_S }) => {
    if (window.__bootError) return { error: String(window.__bootError) };
    const C = window.__clock;
    const BD = await import('./src/balance-drive.js');
    const dt = 1 / 240;
    const settle = () => { C.setPose({ crownPullT: 0, tension: 1, tau: 0.13, leverEngage: 0 }); for (let i = 0; i < 480; i++) C.step(dt); };
    const snap = () => { const s = C.balanceDrive.state; return { theta: s.theta, omega: s.omega }; };
    const hp = C.hackPad;
    // ---- run A: crown stays in; run B: crown pulled. Same start, same dt.
    const runA = [], runB = [], lever = [], pad = [], pull = [];
    settle();
    for (let i = 0; i < 120; i++) { C.step(dt); runA.push(snap()); }
    settle();
    C.setCrownOut(true);
    let arrive = null;
    for (let i = 0; i < 120; i++) {
      C.step(dt); runB.push(snap()); lever.push(C.leverEngage); pad.push(C.padEngage);
      if (arrive === null && C.padEngage > 0) arrive = i;
    }
    // ---- 1: until the first frame the pad engages the balances agree
    let worst = 0;
    const upto = arrive === null ? runB.length : arrive;
    for (let i = 0; i < upto; i++) worst = Math.max(worst, Math.abs(runA[i].theta - runB[i].theta), Math.abs(runA[i].omega - runB[i].omega));
    // ---- 2: the old law on the same model: brake = leverEngage (the recorded timeline)
    const M = C.balanceDriveModel, K = M.K;
    settle();
    const st0 = C.balanceDrive.state;
    const st = BD.seed(K, 0, Math.abs(st0.ampEst));
    st.theta = st0.theta; st.omega = st0.omega;   // the settled state of the live balance
    const flat = BD.FLAT_POSITIONS.has(C.balanceDrive.position);
    const stOld = JSON.parse(JSON.stringify(st)), stFree = JSON.parse(JSON.stringify(st));
    let oldWorst = 0;
    for (let i = 0; i < upto; i++) {
      const env = { drive: true, friction: flat ? M.friction.flat : M.friction.vertical, weight: M.weight(C.balanceDrive.position) };
      BD.step(K, stFree, dt, { ...env, brake: 0 });
      BD.step(K, stOld, dt, { ...env, brake: lever[i] });
      oldWorst = Math.max(oldWorst, Math.abs(stFree.omega - stOld.omega));
    }
    // ---- 3: stop and hold
    const omegaAt = (n) => runB[Math.min(runB.length - 1, n)].omega;
    const stopIdx = arrive === null ? null : arrive + Math.ceil(STOP_S / dt);
    // ---- 4: the pad's numbers
    const psiEnd = 0;
    // the pad's own engagement at pad gaps of 10, 3, 1.5, 1, 0.5, 0.1 and 0 windows (gap ≈ dz·|ψ| at the rim)
    const engAt = [10, 3, 1.5, 1, 0.5, 0.1, 0].map((m) => hp.engagementAt(Math.sign(hp.psi0) * m * hp.gapWindow_u / hp.dz));
    // ---- 5: hold, then release (the old-law control above re-seeded the balance, so pull again and let it stop)
    settle();
    C.setCrownOut(true);
    for (let i = 0; i < Math.ceil((0.5 + STOP_S) / dt); i++) C.step(dt);
    for (let i = 0; i < Math.ceil(HOLD_S / dt); i++) C.step(dt);
    const held0 = snap();
    for (let i = 0; i < Math.ceil(HOLD_S / dt); i++) C.step(dt);
    const held1 = snap();
    C.setCrownOut(false);
    let relIdx = null;
    for (let i = 0; i < 60; i++) { C.step(dt); if (C.padEngage === 0 && relIdx === null) relIdx = i; }
    let moving = false;
    for (let i = 0; i < Math.ceil(RESTART_S / dt); i++) { C.step(dt); if (Math.abs(C.balanceDrive.state.omega) > 1) moving = true; }
    return { dt, arrive, upto, worst, oldWorst, omegaStop: stopIdx === null ? null : omegaAt(stopIdx), held0, held1, relIdx, moving,
      pad: { gapWindow_u: hp.gapWindow_u, dPin_u: hp.dPin_u, nHold_mN: hp.nHold_N * 1e3, fRod_mN: hp.fRod_N * 1e3 },
      engAt,
      engLive: [pad[0], pad[Math.max(0, (arrive ?? 1) - 1)], pad[arrive ?? 0]], leverAtArrive: arrive === null ? null : lever[arrive] };
  }, { STOP_S, HOLD_S, RESTART_S });
} finally { await browser.close(); srv.kill(); }
if (R.error) { console.log('BOOT FAILED', R.error); process.exit(2); }

let bad = 0;
const row = (ok, what, detail) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`); };
console.log(`TODO 257 — the hack pad's contact, in the live loop (dt 1/${Math.round(1 / R.dt)} s)\n`);
console.log(`pad: contact window ${R.pad.gapWindow_u.toExponential(3)} u of pad rise (the rod's give ${R.pad.dPin_u.toExponential(3)} u at the pin), holding load ${R.pad.nHold_mN.toFixed(3)} mN at the pad / ${R.pad.fRod_mN.toFixed(3)} mN in the rod`);
console.log(`the pad first engages on frame ${R.arrive} (${R.arrive === null ? '—' : (R.arrive * R.dt).toFixed(3)} s after the pull); the lever's own ease reads ${R.leverAtArrive === null ? '—' : R.leverAtArrive.toFixed(3)} then\n`);
row(R.arrive !== null, 'the pad reaches the rim within 0.5 s of the pull');
row(R.worst < FLOAT, `1. before touch the balance is untouched (worst |Δθ|,|Δω| against the crown-in run over ${R.upto} frames)`, R.worst.toExponential(2));
row(R.oldWorst > 1e-3, '2. CONTROL: the old law (brake = leverEngage) on the same model does deviate before touch', `worst |Δω| ${R.oldWorst.toExponential(2)} rad/s`);
row(R.omegaStop === 0, `3. omega is exactly 0 within ${STOP_S} s of touch`, `ω = ${R.omegaStop}`);
row(Math.abs(R.held1.theta - R.held0.theta) < FLOAT && R.held1.omega === 0, `3. and holds for ${HOLD_S} s`, `θ ${R.held0.theta.toFixed(6)} → ${R.held1.theta.toFixed(6)}`);
row(R.engAt[0] === 0 && R.engAt[R.engAt.length - 1] === 1 && R.engAt.every((e, i, a) => i === 0 || e >= a[i - 1]), '4. engagement is 0 above the window, 1 at the rim, monotone between', R.engAt.map((e) => e.toFixed(2)).join(' '));
row(R.pad.gapWindow_u > 0 && R.pad.gapWindow_u < 0.01, '4. the window is a small fraction of the stroke', `${R.pad.gapWindow_u.toExponential(2)} u`);
row(R.relIdx !== null && R.relIdx < 30, '5. releasing the crown lets the pad go inside a few frames', `frame ${R.relIdx}`);
row(R.moving, `5. the balance is swinging again within ${RESTART_S} s of release`);
console.log(bad ? `\nFAIL — ${bad} row(s)` : '\nAll rows hold.');
process.exit(bad ? 1 : 0);
