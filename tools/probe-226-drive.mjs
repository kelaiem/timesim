// TODO 226 — is the escapement DRIVEN off the balance? Until 226 the
// fork and the escape wheel were posed off beat phase, two clocks that shared
// a period with the balance and nothing else: the pin sat 0.143 inside the
// horn at the impulse window's opening, every beat, under the EXPECTED blanket
// 'Pallet fork' ⇄ 'Balance' carries. This reads the BUILT groups at the posed
// movement — never the law's own functions — and asks four things, at three
// winds (§221's swing does not sag with wind, and neither may anything driven
// off it; reading three winds is how that is held rather than assumed):
//
//   1. ON THE LINE. While the fork is between its banks, the pin's centre lies
//      on the fork's slot centre line (the fork's local −y through its pivot),
//      to float noise. That is what "the fork's angle is read off the pin"
//      means as a measurement.
//   2. BANKED OUTSIDE. Whenever the pin is outside the lift, the fork lies on
//      a bank, and the bank it lies on is the side the pin left it.
//   3. THE WHEEL FOLLOWS THE FORK. The escape wheel is STILL while the fork
//      dwells on a bank, and over each balance period (two beats) it advances
//      exactly 2·BEAT_DEG. Since TODO 226 step 3 the wheel's angle inside a
//      beat is read off the stones' faces (src/escapement.js) — the recoil,
//      the impulse, the drop — and probe-131-escapement-slide holds that
//      contact; this holds the wheel to the fork and the count.
//   4. CENTRED. Every beat boundary (τ = n/2F) has the pin at ±LIFT/2 — the
//      let-offs symmetric about the line of centres. (The fork banks a RUN past
//      the let-off since TODO 226 step 3, so the pin meets the banked fork at
//      ±θ_B, a little outside the lift; check 2 reads the bank at θ_B.)
//
// Since TODO 226 step 3b the line check runs DIAL-FLAT too (the posed 292°,
// whose arc outside the lift is not the hanging law's) and in the LIVE LOOP
// (the driven balance stepped, at DU and CL), counting samples in the run and
// the unlock so a run that never reached them cannot pass; its control
// re-poses the flat balance by the pre-3b map (τ inverted inside the lift
// only) and must read the seam that map left.
//
// And it measures every mesh pair of the two units with inspect.js's own
// `meshClearance` over the same samples — the pairs the new
// EXPECTED_CONTACT_FLOORS row holds — and, separately, the pin against the
// blank WHILE THE PIN IS IN THE LIFT, beside a CONTROL: the same in-lift sweep
// with the fork re-posed by the retired law (§221's beat-phase window, recoil
// dip, smoothstep — the same balance, the same bank, the fork on its own
// clock), which must find the burial. A clearance sweep that cannot
// see 0.143 of ruby inside a horn has measured nothing.
//
// ACCEPTANCE: exits non-zero on any of 1–4, on the pin within CLEAR_MARGIN of
// the blank in the lift, on ANY pair under the margin (the drive landed with
// three `only:` debts; step 1's seat — the notch cut as the pin's swept path,
// one roller below the fork, the guard pin behind the floor — retired all
// three, so nothing is waived), or on a control that comes back clean.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8482);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?schematic=0`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock && window.__clock.boot?.done !== false, null, { timeout: 180000 });
await new Promise((r) => setTimeout(r, 2500));

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs();
  const entry = (n) => clock.labelEntries.find((e) => e.name === n).obj;
  const forkG = entry('Pallet fork'), balG = entry('Balance'), escG = entry('Escape wheel');
  let pin = null;
  balG.traverse((m) => { if (m.isMesh && m.name === 'balanceImpulsePin') pin = m; });
  if (!pin) return { error: 'no mesh named balanceImpulsePin under Balance' };
  const F = forkG.position, B = balG.position;
  const d = Math.hypot(F.x - B.x, F.y - B.y);
  const forkBase = Math.atan2((B.x - F.x) / d, -(B.y - F.y) / d);   // local −y onto the balance
  const pinAim = Math.atan2(F.y - B.y, F.x - B.x);                  // balance-local +x onto the fork
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const F_BAL = L.F_BALANCE, BEAT = L.BEAT_DEG * Math.PI / 180;
  const v = new THREE.Vector3();
  const meshesOf = (g) => { const a = []; g.traverse((m) => { if (m.isMesh && m.visible !== false) a.push(m); }); return a; };
  const forkMeshes = meshesOf(forkG), balMeshes = meshesOf(balG);

  // the fork's banks, read off the posed movement: the two most frequent
  // deflections over a beat are its dwells
  const readFork = () => wrap(forkBase - forkG.rotation.z);   // the swing, sign as main.js forkSwingRad
  // the balance's swing passes ±180° at §221's ±200°, so it is read UNWRAPPED:
  // rotation.z is PIN_AIM + θ, and PIN_AIM differs from pinAim only by turns
  clock.setPose({ tau: 1e-9, tension: 1 });
  const turns = 2 * Math.PI * Math.round((balG.rotation.z - pinAim) / (2 * Math.PI));
  const readTheta = () => balG.rotation.z - pinAim - turns;

  // TODO 226 step 3b — every configuration names its POSITION: hanging (CU,
  // the designed 200°) at three winds, and dial-flat (DU, the energy column's
  // 292°), where the posed balance runs a different arc outside the lift and
  // the fork, read off τ, must still follow the pin through the run and the
  // unlock. setPose assigns only the keys a pose names, so each row names its own.
  const W = [{ tension: 1, position: 'CU' }, { tension: 0.5, position: 'CU' }, { tension: 0, position: 'CU' }, { tension: 1, position: 'DU' }];
  const res = { winds: [] };
  let worstLine = 0, worstWheel = 0, worstBank = 0, worstCentre = 0;
  for (const { tension, position } of W) {
    const N = 480, beats = 4;
    const rows = [];
    for (let k = 0; k <= N; k++) {
      const tau = (k / N) * beats / (2 * F_BAL) + 1e-9;
      clock.setPose({ tau, tension, position });
      forkG.updateWorldMatrix(true, true); balG.updateWorldMatrix(true, true);
      const s = readFork(), th = readTheta();
      pin.getWorldPosition(v);
      // slot centre line: through F along the fork's local −y
      const a = forkG.rotation.z;
      const ax = { x: Math.sin(a), y: -Math.cos(a) };
      const off = (v.x - F.x) * ax.y - (v.y - F.y) * ax.x;
      const raw = tau * 2 * F_BAL, n = Math.floor(raw);
      rows.push({ tau, s, th, off, n, p: raw - n, esc: escG.rotation.z });
    }
    const bank = Math.max(...rows.map((r) => Math.abs(r.s)));
    const sense = Math.sign(rows[rows.length - 1].esc - rows[0].esc);
    // θ_B from the triangle, at the measured bank: where the pin meets the
    // banked fork. θ_L is the let-off, the cited lift's half.
    const r = Math.hypot(pin.position.x, pin.position.y);
    const thB = Math.asin(d * Math.sin(bank) / r) - bank;
    const thL = L.LIFT_DEG * Math.PI / 360;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const inLift = Math.abs(row.s) < bank * (1 - 1e-9);
      if (inLift) worstLine = Math.max(worstLine, Math.abs(row.off));
      else {
        // banked on the side the pin is on
        if (Math.sign(row.s) !== Math.sign(row.th)) worstBank = Math.max(worstBank, 1);
        if (Math.abs(row.th) < thB * (1 - 1e-6)) worstBank = Math.max(worstBank, thB - Math.abs(row.th));
        // the wheel stands still while the fork dwells
        const prev = rows[i - 1];
        if (prev && Math.abs(prev.s) >= bank * (1 - 1e-9) && Math.sign(prev.s) === Math.sign(row.s))
          worstWheel = Math.max(worstWheel, Math.abs(wrap(row.esc - prev.esc)));
      }
    }
    // and each balance period advances it exactly two beats
    for (const row of rows) {
      clock.setPose({ tau: row.tau + 1 / F_BAL, tension, position });
      worstWheel = Math.max(worstWheel, Math.abs(escG.rotation.z - row.esc - sense * 2 * BEAT));
    }
    // centred: at each beat boundary the pin stands at ±θ_L
    for (let n = 0; n < 4; n++) {
      clock.setPose({ tau: n / (2 * F_BAL), tension, position });
      worstCentre = Math.max(worstCentre, Math.abs(Math.abs(readTheta()) - thL));
    }
    const liftFrac = rows.filter((x) => Math.abs(x.s) < bank * (1 - 1e-9)).length / rows.length;
    res.winds.push({ tension, position, bankDeg: bank * 180 / Math.PI, liftDeg: 2 * thL * 180 / Math.PI, entryDeg: 2 * thB * 180 / Math.PI, liftFrac });
  }

  // CLEARANCE: every mesh pair of the two units, at the driven pose and at
  // the retired law's pose (the control), over a fine beat
  const BANK = res.winds[0].bankDeg * Math.PI / 180;
  const IW = L.IMPULSE_WIDTH, RF = 0.25, REC = 0.25 * BANK;
  const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const oldSwing = (tau) => {           // the law TODO 226 retired, verbatim in substance
    const raw = tau * 2 * F_BAL, n = Math.floor(raw), p = raw - n;
    const b0 = (n % 2 === 0) ? -1 : 1, b1 = -b0;
    if (p < IW) {
      const s = p / IW;
      if (s < RF) return b0 * BANK - Math.sign(b0) * Math.sin((s / RF) * Math.PI) * REC;
      return b0 * BANK + (b1 - b0) * BANK * smooth((s - RF) / (1 - RF));
    }
    return b1 * BANK;
  };
  const oldTheta = (tau) => {         // §221's balance, which the driven law keeps
    const amp = L.AMPLITUDE_POSED_DEG * Math.PI / 180;
    return amp * Math.sin(2 * Math.PI * F_BAL * (tau - IW / (4 * F_BAL)));
  };
  // per mesh pair: the minimum over the samples, and — for the pin on the
  // blank — the minimum while the pin is IN THE LIFT (the fork between its
  // banks; the retired law's window, for the control)
  const nm = (m) => m.name || '(unnamed)';
  const sweep = (control) => {
    const per = new Map();
    let lift = { min: Infinity, at: null };
    const blank = forkMeshes.find((m) => m.name === 'forkBlank');
    for (const { tension, position } of W) {
      const N = 240;
      for (let k = 0; k <= N; k++) {
        const tau = (k / N) * 2 / (2 * F_BAL) + 1e-9;
        clock.setPose({ tau, tension, position });
        let s;
        if (control) {
          s = oldSwing(tau);
          forkG.rotation.z = forkBase - s;
          balG.rotation.z = pinAim + oldTheta(tau);
        } else s = readFork();
        const raw = tau * 2 * F_BAL, p = raw - Math.floor(raw);
        const inLift = control ? p < IW : Math.abs(s) < BANK * (1 - 1e-9);
        forkG.updateWorldMatrix(true, true); balG.updateWorldMatrix(true, true);
        for (const a of forkMeshes) for (const b of balMeshes) {
          const c = I.meshClearance(a, b, 2);
          const key = `${nm(a)} ⇄ ${nm(b)}`;
          const cur = per.get(key);
          if (!cur || c < cur.min) per.set(key, { min: c, tension, tau });
          if (inLift && a === blank && b === pin && c < lift.min) lift = { min: c, at: { tension, tau } };
        }
      }
    }
    const pairs = [...per.entries()].filter(([, v]) => v.min < 2).sort((x, y) => x[1].min - y[1].min)
      .map(([k, v]) => ({ pair: k, min: +v.min.toFixed(4), tension: v.tension, tau: +v.tau.toFixed(4) }));
    return { pairs, lift };
  };
  res.driven = sweep(false);
  res.control = sweep(true);

  // TODO 226 step 3b — THE PASSAGE, held where it was broken. The line check
  // above runs dial-flat too; this is its CONTROL, and the live loop.
  // Control: re-pose the flat balance by the pre-3b map (τ inverted only
  // inside the LIFT, the flat arc outside it) and the line check must see the
  // fork read a different balance in the run and the unlock — a line check
  // that cannot see that seam has not measured the passage.
  const off = () => {
    forkG.updateWorldMatrix(true, true); balG.updateWorldMatrix(true, true);
    pin.getWorldPosition(v);
    const a = forkG.rotation.z, ax = { x: Math.sin(a), y: -Math.cos(a) };
    return (v.x - F.x) * ax.y - (v.y - F.y) * ax.x;
  };
  {
    const model = clock.balanceDriveModel, K = model.K;
    const A = model.posedDeg.flat * Math.PI / 180, Ap = L.AMPLITUDE_POSED_DEG * Math.PI / 180;
    const oldArc = (tau) => {
      const raw = tau * 2 * F_BAL, n = Math.floor(raw), p = raw - n, dir = n % 2 === 0 ? 1 : -1;
      if (p < K.IW) return dir * Ap * Math.sin(Math.PI * (p - K.IW / 2));
      const ae = Math.asin(K.halfLift / A), frac = (p - K.IW) / (1 - K.IW);
      return dir * A * Math.sin(ae + frac * (Math.PI - 2 * ae));
    };
    const bankC = res.winds[0].bankDeg * Math.PI / 180;
    let ctrl = 0;
    for (let k = 0; k <= 2000; k++) {
      const tau = (k / 2000) * 2 / (2 * F_BAL) + 1e-9;
      clock.setPose({ tau, tension: 1, position: 'DU' });
      if (!(Math.abs(readFork()) < bankC * (1 - 1e-9))) continue;
      balG.rotation.z = pinAim + turns + oldArc(tau);
      ctrl = Math.max(ctrl, Math.abs(off()));
    }
    res.passageControl = ctrl;
  }
  // Live: the driven balance, stepped, in a flat and a hanging position — the
  // fork read off τ must hold the pin on its line wherever the pin carries it
  // (the run and the unlock included, counted so a run that never reached
  // them cannot pass), with the balance shown where the integrator has it.
  res.live = [];
  for (const position of ['DU', 'CL']) {
    clock.resetInputs();
    clock.setBalancePosition(position);
    clock.setPose({ tau: 0.13, tension: 1, position });
    const bankL = res.winds[0].bankDeg * Math.PI / 180;
    let worst = 0, inLift = 0, inRunUnlock = 0;
    for (let k = 0; k < 600; k++) {   // 2 s of swing, ten beats, in ticks of 1/300 s
      clock.step(1 / 300);
      const s = readFork(), th = clock.balanceDrive.state.theta;
      if (!(Math.abs(s) < bankL * (1 - 1e-9))) continue;
      worst = Math.max(worst, Math.abs(off()));
      if (Math.abs(th) <= L.LIFT_DEG * Math.PI / 360) inLift++; else inRunUnlock++;
    }
    res.live.push({ position, worst, inLift, inRunUnlock });
  }
  clock.resetInputs();
  res.worst = { line: worstLine, wheelRad: worstWheel, bank: worstBank, centreRad: worstCentre };
  res.margin = I.CLEAR_MARGIN ?? L.CLEAR_MARGIN;
  return res;
});

if (out.error) { console.log('FAIL', out.error); await browser.close(); srv.kill(); process.exit(1); }
console.log(JSON.stringify(out, null, 2));
const f = [];
// the EXPECTED_CONTACT_FLOORS `only:` debts, by name: none since TODO 226 step 1
const WAIVED = new Set();   // TODO 226 step 1 retired all three: the seat leaves nothing under the margin
for (const w of out.winds) console.log(`tension ${w.tension}: bank ±${w.bankDeg.toFixed(4)}°, lift ${w.liftDeg.toFixed(3)}°, pin in the notch ${(100 * w.liftFrac).toFixed(1)}% of the beat`);
console.log(`1. on the line   worst ${out.worst.line.toExponential(2)}`);
console.log(`2. banked outside ${out.worst.bank ? 'FAILS ' + out.worst.bank : 'every sample'}`);
console.log(`3. wheel follows worst ${(out.worst.wheelRad * 180 / Math.PI).toExponential(2)}°`);
console.log(`4. centred        worst ${(out.worst.centreRad * 180 / Math.PI).toExponential(2)}°`);
console.log(`pin ⇄ blank in the lift: driven ${out.driven.lift.min.toFixed(4)}, control (the retired law) ${out.control.lift.min.toFixed(4)}`);
console.log('every fork ⇄ balance mesh pair within 2, driven:');
for (const r of out.driven.pairs) console.log(`  ${r.min.toFixed(4)}  ${r.pair}${WAIVED.has(r.pair) ? '   (waived: TODO 226 step 1)' : ''}`);
console.log(`passage control (the pre-3b map, flat): the line check reads ${out.passageControl.toFixed(4)} off the line`);
for (const l of out.live) console.log(`live ${l.position}: pin off the line worst ${l.worst.toExponential(2)} over ${l.inLift} samples in the lift and ${l.inRunUnlock} in the run and the unlock`);
if (out.worst.line > 1e-6) f.push(`pin off the slot centre line by ${out.worst.line}`);
if (!(out.passageControl > 1e-3)) f.push(`CONTROL clean: the pre-3b passage reads only ${out.passageControl} off the line — the check cannot see the seam it holds`);
for (const l of out.live) {
  if (l.worst > 1e-6) f.push(`live ${l.position}: the pin leaves the fork's line by ${l.worst}`);
  if (!(l.inRunUnlock > 0 && l.inLift > 0)) f.push(`live ${l.position}: the run never sampled the lift and the run/unlock both (${l.inLift}, ${l.inRunUnlock})`);
}
if (out.worst.bank) f.push('fork not banked on the pin\'s side outside the lift');
if (out.worst.wheelRad > 1e-7) f.push(`escape wheel moves while the fork dwells, or misses two beats a period, by ${out.worst.wheelRad} rad`);
if (out.worst.centreRad > 1e-9) f.push(`lift not centred on the line of centres (${out.worst.centreRad} rad)`);
if (!(out.driven.lift.min >= out.margin)) f.push(`the pin comes within ${out.driven.lift.min} of the blank in the lift — under CLEAR_MARGIN ${out.margin}`);
if (!(out.control.lift.min <= 0)) f.push(`CONTROL clean (${out.control.lift.min}) — the sweep cannot see the burial it exists for`);
for (const r of out.driven.pairs) if (!WAIVED.has(r.pair) && r.min < out.margin) f.push(`${r.pair} at ${r.min}, under CLEAR_MARGIN and not waived`);
for (const m of f) console.log('FAIL', m);
await browser.close(); srv.kill();
process.exit(f.length ? 1 : 0);
