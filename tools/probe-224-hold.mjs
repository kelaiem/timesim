// TODO 224 — DOES A WIND HOLD THE MAINTAINING RING, AND DOES THE TRAIN STOP AT
// HARRISON'S STOP? Acceptance. Before TODO 224 the ring rode the great wheel at
// offset 0 through a wind: the detent never held, the blade never deflected and
// the stop was never reached. This probe measures the posed hold three ways:
//
//   1. THE LAW, off the cut (`__clock.maintHoldLaw`): the face the recoil
//      stands on, the worst recoil (the crest's share of a pitch), and that it
//      is inside the spring's run; then the recoil over one whole tooth of
//      drive-off instants, each at most the crest's and 0 on the face.
//   2. THE BLADE, posed from the pin (MAINT_BLADE): the torque it puts on the
//      great wheel over the whole run, from the going torque at s = 0 down to
//      its preload at the stop — which must not fall under the FLOOR the spring
//      was sized to deliver to the last of its run (TODO 219's nominal-corner
//      floor). This is the number TODO 219's linear law (k·(θ_work − s)) could
//      not see: the pin swings on its circle and its station slides toward the
//      blade's root, so the posed torque is not the linear one.
//   3. THE LIVE PATH, through step(): a wind banked tick by tick takes the drive
//      off (the hold engages, the ring recoils onto the beak by exactly the
//      law's recoil), the great wheel runs on the spring, the train STOPS at
//      τ_stop and stays stopped however long the wind goes on, and the first
//      tick that banks nothing picks the ring up — offset 0, the running pose.
//
// CONTROLS. (a) Before any wind the hold is null and the ring's offset is
// exactly 0 — the running watch is untouched. (b) A pose with no `maintHold`
// key after resetInputs reads null: a pose never edges the wind-start state.
//
// Run: cd tools && node probe-224-hold.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 8481;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
let failed = 0;
try {
  await p.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
  const out = await p.evaluate(async () => {
    const c = window.__clock, L = c.maintHoldLaw;
    let pin = null; c.scene.traverse((o) => { if (o.name === 'maintSpringPin') pin = o; });
    const ringRot = () => pin.parent.rotation.z;
    const r = { law: { holdNet: L.holdNet, dHold: L.dHold, rCrest: L.rCrest, pitch: L.pitch, run: L.run, frames: L.frames, frameStep: L.frameStep } };
    // 1 — the recoil over one tooth of drive-off instants (τ such that the
    // great wheel crosses one ring pitch: 120/7 h per turn / 35 teeth).
    const toothS = (c.hoursPerFuseeTurn * 3600) / (2 * Math.PI / L.pitch);
    let maxRec = 0, onFace = 0, n = 0, overCrest = 0;
    for (let i = 0; i < 240; i++) {
      const H = L.begin(1000 + (toothS * i) / 240);
      n++; if (H.onFace) { onFace++; if (H.recoil !== 0) overCrest++; }
      if (H.recoil > L.rCrest + 1e-12) overCrest++;
      maxRec = Math.max(maxRec, H.recoil);
    }
    r.recoil = { maxRec, onFaceShare: onFace / n, violations: overCrest };
    // 2 — the posed torque over the run
    let minTau = Infinity, minAt = 0, prev = Infinity, rises = 0;
    const N = 128;
    for (let i = 0; i <= N; i++) {
      const s = (L.run * i) / N, t = L.tauAt(s);
      if (t < minTau) { minTau = t; minAt = s; }
      if (t > prev) rises++;
      prev = t;
    }
    r.torque = { atZero: L.tauAt(0), tauGo: L.tauGo, minTau, minAt, atStop: L.stop.tau_Nm, floor: L.tauFloor, rises };
    // controls
    c.resetInputs();
    c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.5 });
    r.control = { hold: c.maintHold, rho: ringRot() };
    // 3 — the live path. Wind a hair per tick (well under the arrest).
    c.resetInputs();
    c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.5 });
    let rot = c.crownRotation, sign = 0;
    // which way winds: try a nudge and see whether the bank rose
    const t0 = c.tension;
    c.setCrownRotation(rot + 0.01); c.step(1 / 60);
    sign = c.tension > t0 ? 1 : -1;
    const H0 = c.maintHold;
    if (!H0) {   // the nudge was the wrong way — reset and wind the other way
      c.resetInputs(); c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.5 });
      rot = c.crownRotation; c.setCrownRotation(rot - 0.01); c.step(1 / 60); sign = -1;
    }
    const H1 = c.maintHold;
    r.live = { engaged: !!H1, recoil: H1 && H1.recoil, rhoAfterFirst: ringRot(), tauStop: H1 && H1.tauStop };
    rot = c.crownRotation;
    let steps = 0, tauPrev = c.tau, stoppedAt = null, rateAtStop = null;
    while (steps < 20000) {
      rot += sign * 1e-4; c.setCrownRotation(rot); c.step(0.25); steps++;
      const H = c.maintHold;
      if (!H) { r.live.lostHold = steps; break; }
      if (H.atStop && stoppedAt === null) { stoppedAt = c.tau; }
      if (stoppedAt !== null && steps % 40 === 0) { rateAtStop = c.balanceRate; if (c.tau !== stoppedAt) { r.live.creptPastStop = c.tau - stoppedAt; break; } }
      if (stoppedAt !== null && steps > 400 + (stoppedAt - 0.13) * 4) break;
      tauPrev = c.tau;
    }
    const Hs = c.maintHold;
    r.live.stoppedAt = stoppedAt; r.live.travelAtStop = Hs && Hs.travel; r.live.rhoAtStop = ringRot(); r.live.balanceRateHeld = rateAtStop;
    // pick-up: a tick that banks nothing
    c.step(0.25);
    r.live.afterPickup = { hold: c.maintHold, rho: ringRot() };
    // and the train runs again
    const tp = c.tau; for (let i = 0; i < 200; i++) c.step(0.25);
    r.live.resumed = c.tau - tp;
    c.resetInputs();
    return r;
  });
  const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failed++; };
  console.log('\nTODO 224 — the maintaining hold\n');
  console.log('1. THE LAW, off the cut');
  ok(out.law.rCrest < out.law.pitch && out.law.rCrest < out.law.run,
    `worst recoil ${out.law.rCrest.toFixed(5)} rad (${(out.law.rCrest / out.law.pitch).toFixed(4)} of the ${out.law.pitch.toFixed(5)} pitch) is inside the run ${out.law.run.toFixed(5)} — ${(out.law.run - out.law.rCrest).toFixed(5)} rad of wheel advance left after it`);
  console.log(`       face reached ${out.law.dHold.toFixed(6)} rad back from the seat (holdNet ${out.law.holdNet.toFixed(6)})`);
  ok(out.recoil.violations === 0 && Math.abs(out.recoil.maxRec - out.law.rCrest) < out.law.pitch / 200,
    `over one tooth of drive-off instants: recoil ≤ the crest's at every one (max ${out.recoil.maxRec.toFixed(5)}), 0 on the face (${(100 * out.recoil.onFaceShare).toFixed(1)}% of the pitch)`);
  console.log('2. THE BLADE, posed from the pin');
  ok(Math.abs(out.torque.atZero - out.torque.tauGo) <= 1e-9 * out.torque.tauGo,
    `at s = 0 the posed blade carries the going torque: ${(out.torque.atZero * 1e3).toFixed(6)} vs ${(out.torque.tauGo * 1e3).toFixed(6)} N·mm`);
  ok(out.torque.minTau >= out.torque.floor,
    `the posed torque never falls under the floor over the run: min ${(out.torque.minTau * 1e3).toFixed(4)} N·mm at s ${out.torque.minAt.toFixed(5)} against ${(out.torque.floor * 1e3).toFixed(4)} (at the stop ${(out.torque.atStop * 1e3).toFixed(4)}, ${(100 * out.torque.atStop / out.torque.floor).toFixed(2)}%)`);
  ok(out.torque.rises === 0, `and it falls monotonically from the going torque to the stop (${out.torque.rises} rises over 128 steps)`);
  console.log('3. THE LIVE PATH');
  ok(out.control.hold === null && out.control.rho === 0, `control: a pose with the drive on holds nothing and the ring's offset is exactly 0 (${out.control.rho})`);
  ok(out.live.engaged, `the first tick that banks takes the drive off (recoil ${out.live.recoil?.toFixed(5)} rad, ring offset ${out.live.rhoAfterFirst?.toFixed(5)}, τ_stop ${out.live.tauStop?.toFixed(2)} s)`);
  ok(out.live.stoppedAt !== null && Math.abs(out.live.stoppedAt - out.live.tauStop) < 1e-6 && !out.live.creptPastStop,
    `the train stops at τ_stop and stays stopped while the wind goes on (stopped at ${out.live.stoppedAt?.toFixed(4)}, travel ${out.live.travelAtStop?.toFixed(5)} of the run; balance rate ${out.live.balanceRateHeld?.toFixed(4)})`);
  ok(out.live.afterPickup.hold === null && out.live.afterPickup.rho === 0, `the first tick that banks nothing picks the ring up — offset ${out.live.afterPickup.rho}`);
  ok(out.live.resumed > 0, `and the train runs again (${out.live.resumed.toFixed(3)} s of movement time over 50 s)`);
} finally {
  await b.close(); srv.kill();
}
console.log(failed ? `\n${failed} FAILED` : '\nPASS');
process.exit(failed ? 1 : 0);
