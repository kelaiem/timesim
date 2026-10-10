// §246 tier two — THE DRIVEN BALANCE, ACCEPTED: does the balance the live loop
// integrates keep the swing the energy column says it sustains, and the rate
// tier one's free-balance model says each position gives — and where it does
// not, is the difference the escapement's own, measured rather than assumed?
// ACCEPTANCE: exits non-zero unless
//
//   · the POSED law and the driven state agree at the posed swing: seeding the
//     integrator from τ and reading τ back (balance-drive.js seed / tauOf)
//     returns τ to 1e-12 over two beats, and the posed law at the designed
//     swing is the pre-§246 closed form A·sin(2πF(τ − τ0)) to 1e-12 — the
//     identity that keeps every hanging pose in the battery bit for bit;
//   · the integrator is CONVERGED: the rate does not move by more than
//     0.02 s/day between 400 and 100 sub-steps per period, or at fast-forward's
//     40 (BALANCE_FF_STEPS);
//   · AIRY'S KNOWN ANSWER: on a LINEAR spring with no losses the escapement's
//     impulse, symmetric about the balance's equilibrium, changes the rate by
//     nothing (under 0.01 s/day) — the control that the instrument can read a
//     zero;
//   · the swing EMERGES and lands on the energy column: at the live loop's
//     corner the driven balance settles to `sustainedDeg` (flat and vertical)
//     within 0.1% — the column solves loss = delivered for a sinusoid, the
//     integrator integrates it, and two readers of the same constants agree;
//   · the swing does not sag with the wind: the impulse is the fusee's level
//     torque, so the settled swing at tension 0.1 is the swing at 1 (0.01°);
//   · the RATE decomposes: for each position, the driven rate minus the
//     escapement's own error (the same impulse and losses on a LINEAR spring
//     with no weight, so only the escapement and the losses act) equals the
//     free balance's rate on the elastica at the swing it settled to (tier
//     one's method, same tables) within 0.1 s/day;
//   · the LIVE LOOP runs this model: __clock.step() in one hanging position
//     reads the module's rate to 0.05 s/day and its swing to 0.05°;
//   · the hack brakes it and the escapement restarts it: with the pad on the
//     balance stops (its swing under a degree within a second) and stays; off,
//     it picks back up to its settled swing — a lever escapement in beat is
//     self-starting; and with no torque (run down) the balance's own losses
//     stop it.
//
// REPORTS the positional table beside tier one's published one (BUILT §246),
// and the escapement's error per position — the term tier one did not model.
//
// Run: cd tools && node probe-246-driven-rate.mjs
//      ROOT=/path/to/other/checkout node probe-246-driven-rate.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8610 + Math.floor(Math.random() * 40);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`http://127.0.0.1:${PORT}/index.html?sync=0`, { waitUntil: 'load', timeout: 180000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 300000 });

const out = await p.evaluate(async () => {
  const BD = await import('./src/balance-drive.js');
  const C = window.__clock;
  C.resetInputs();
  const M = C.balanceDriveModel, K = M.K;
  const D = Math.PI / 180;
  const POS = BD.POSITIONS;
  const envFor = (pos, over = {}) => ({
    drive: true, brake: 0,
    friction: BD.FLAT_POSITIONS.has(pos) ? M.friction.flat : M.friction.vertical,
    weight: M.weight(pos), ...over,
  });
  // Settle, then time the beats: the rate is arithmetic on the integrator's
  // own time-stamped unlockings, never τ read at a step boundary.
  const run = (Kx, pos, { settle = 40, measure = 60, over = {}, A0 = null } = {}) => {
    const A = A0 ?? (BD.FLAT_POSITIONS.has(pos) ? M.posedDeg.flat : M.posedDeg.vertical) * D;
    const S = BD.seed(Kx, 0.1, A);
    const env = envFor(pos, over), dt = 1 / 240;
    for (let i = 0; i < settle / dt; i++) BD.step(Kx, S, dt, env);
    const n0 = S.n, t0 = S.entryT;
    let pk = 0;
    for (let i = 0; i < measure / dt; i++) { BD.step(Kx, S, dt, env); }
    pk = S.ampEst;
    return { sPerDay: (((S.n - n0) / (2 * Kx.F)) / (S.entryT - t0) - 1) * 86400, ampDeg: pk / D, beats: S.n - n0 };
  };
  // A linear spring with the same k, no weight: only the escapement and the losses act.
  const linearK = (Kx) => ({ ...Kx, spring: { ...Kx.spring, y: Float64Array.from(Kx.spring.y.map((_, i) => Kx.k * (Kx.spring.x0 + i * Kx.spring.dx))) } });
  const KL = linearK(K);
  // Tier one's free balance on the same tables: θ'' = (−spring + weight)/I, the
  // period between zero crossings at swing A.
  const lerp = (T, x) => { const f = (x - T.x0) / T.dx, i = Math.max(0, Math.min(T.y.length - 2, Math.floor(f))), t = f - i; return T.y[i] * (1 - t) + T.y[i + 1] * t; };
  const freeRate = (pos, A) => {
    const W = M.weight(pos);
    const acc = (x) => (-lerp(K.spring, x) + (W ? lerp(W, x) : 0)) / K.I;
    let th = A, v = 0, t = 0; const h = 1 / (K.F * 4000), cr = [];
    for (let s = 0; s < 4000 * 4 && cr.length < 3; s++) {
      const k1v = acc(th), k1x = v, k2v = acc(th + h / 2 * k1x), k2x = v + h / 2 * k1v;
      const k3v = acc(th + h / 2 * k2x), k3x = v + h / 2 * k2v, k4v = acc(th + h * k3x), k4x = v + h * k3v;
      const th2 = th + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), v2 = v + h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (th < 0 && th2 >= 0) cr.push(t + h * (-th) / (th2 - th));
      th = th2; v = v2; t += h;
    }
    return (1 / K.F / (cr[2] - cr[1]) - 1) * 86400;
  };

  // 1. the posed law and the seed are inverses at the posed swing
  let seedErr = 0, closedErr = 0;
  const tau0 = K.IW / (4 * K.F);
  for (let i = 0; i <= 400; i++) {
    const tau = 3 + i * (1 / K.F) / 400;
    const S = BD.seed(K, tau, K.Ap);
    seedErr = Math.max(seedErr, Math.abs(BD.tauOf(K, S) - tau));
    closedErr = Math.max(closedErr, Math.abs(BD.posedTheta(K, tau, K.Ap) - K.Ap * Math.sin(2 * Math.PI * K.F * (tau - tau0))));
  }
  // 2. convergence in the sub-step
  const conv = ['CL', 'DU'].map((pos) => {
    const r400 = run(K, pos, { over: { steps: 400 } }), r100 = run(K, pos, { over: { steps: 100 } }), r40 = run(K, pos, { over: { steps: 40 } });
    return { pos, r400: r400.sPerDay, r100: r100.sPerDay, r40: r40.sPerDay };
  });
  // 3. Airy: linear spring, no losses
  const lossless = { ...KL, c: 0 };
  const airy = run(lossless, 'DU', { over: { friction: 0 } });
  // 4–6. per position
  const rows = POS.map((pos) => {
    const d = run(K, pos);
    const e = run(KL, pos, { over: { weight: null } });
    const free = freeRate(pos, d.ampDeg * D);
    return { pos, driven: d.sPerDay, ampDeg: d.ampDeg, escapement: e.sPerDay, escAmpDeg: e.ampDeg, free, residual: d.sPerDay - e.sPerDay - free };
  });
  // 7. the live loop: step() for 40 s in CL against the module's own run —
  // and 5., the same at a tenth of the wind: the fusee's level torque means the
  // swing at tension 0.1 is the swing at 1 (the live loop is where tension
  // could reach the balance, so that is where it is measured)
  const liveAt = (tension) => {
    C.resetInputs();
    C.setPose({ tau: 0.1, tension, position: 'CL' });
    for (let i = 0; i < 240 * 40; i++) C.step(1 / 240);
    return C.balanceDrive.rate;
  };
  const live = liveAt(1), liveLow = liveAt(0.1);
  const sag = live && liveLow ? liveLow.ampDeg - live.ampDeg : NaN;
  const mod = run(K, 'CL', { settle: 10, measure: 30 });
  // 8. hack and restart, run-down — on the module, which is what tick() steps
  const hack = (() => {
    const S = BD.seed(K, 0.1, K.Ap), env = envFor('CU'), dt = 1 / 240;
    for (let i = 0; i < 240 * 10; i++) BD.step(K, S, dt, env);
    const before = S.ampEst;
    const benv = { ...env, brake: 1 };
    for (let i = 0; i < 240; i++) BD.step(K, S, dt, benv);
    const n1 = S.n, th1 = S.theta;
    for (let i = 0; i < 240 * 3; i++) BD.step(K, S, dt, benv);
    const held = S.n === n1 && Math.abs(S.theta - th1) < 1e-9, stoppedOmega = Math.abs(S.omega);
    for (let i = 0; i < 240 * 30; i++) BD.step(K, S, dt, env);
    return { before: before / D, held, stoppedOmega, thetaHeldDeg: th1 / D, after: S.ampEst / D };
  })();
  const rundown = (() => {
    const S = BD.seed(K, 0.1, K.Ap), env = { ...envFor('CU'), drive: false }, dt = 1 / 240;
    for (let i = 0; i < 240 * 120; i++) BD.step(K, S, dt, env);
    const n1 = S.n;
    for (let i = 0; i < 240 * 5; i++) BD.step(K, S, dt, env);
    return { n1, n2: S.n, peakDeg: Math.abs(S.theta) / D, omega: S.omega };
  })();
  return { K: { F: K.F, IW: K.IW, Q: K.Q, impulseJ: K.impulseJ, brakeNm: K.brakeNm, knockDeg: K.knockRad / D }, friction: M.friction,
    sustainedDeg: M.sustainedDeg, posedDeg: M.posedDeg, seedErr, closedErr, conv, airy, rows, sag, live, mod, hack, rundown };
});
await b.close();

const fails = [];
const row = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails.push(name); };
const f2 = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);
console.log(`driven balance: F ${out.K.F} Hz, Q ${out.K.Q}, impulse ${out.K.impulseJ.toExponential(4)} J per beat, pivot friction flat ${out.friction.flat.toExponential(3)} / hanging ${out.friction.vertical.toExponential(3)} N·m, brake ${out.K.brakeNm.toExponential(3)} N·m, knock ${out.K.knockDeg.toFixed(2)}°`);
row('the seed and τ are inverses at the posed swing', out.seedErr < 1e-12, `max |Δτ| ${out.seedErr.toExponential(2)} s`);
row('the posed law at the designed swing is the pre-§246 closed form', out.closedErr < 1e-12, `max |Δθ| ${out.closedErr.toExponential(2)} rad`);
for (const c of out.conv)
  row(`converged in the sub-step (${c.pos})`, Math.abs(c.r400 - c.r100) < 0.02 && Math.abs(c.r400 - c.r40) < 0.02, `400: ${f2(c.r400)}, 100: ${f2(c.r100)}, 40: ${f2(c.r40)} s/day`);
row("Airy's known answer: a symmetric impulse on a lossless linear spring keeps time", Math.abs(out.airy.sPerDay) < 0.01, `${out.airy.sPerDay.toExponential(2)} s/day at ${out.airy.ampDeg.toFixed(2)}°`);
for (const r of out.rows) {
  const flat = r.pos === 'DU' || r.pos === 'DD';
  const want = flat ? out.sustainedDeg.flat : out.sustainedDeg.vertical;
  row(`${r.pos}: the swing emerges on the energy column's solve`, Math.abs(r.ampDeg / want - 1) < 1e-3, `${r.ampDeg.toFixed(3)}° against ${want.toFixed(3)}°`);
  row(`${r.pos}: driven − escapement = the free balance at that swing`, Math.abs(r.residual) < 0.1,
    `${f2(r.driven)} − (${f2(r.escapement)}) vs ${f2(r.free)} s/day, residual ${r.residual.toExponential(2)}`);
}
row('the swing does not sag with the wind (the fusee delivers level torque)', Math.abs(out.sag) < 0.01, `tension 0.1 against 1: ${out.sag.toExponential(2)}°`);
row('the live loop runs this model (CL, 40 s of step())', !!out.live && Math.abs(out.live.sPerDay - out.mod.sPerDay) < 0.05 && Math.abs(out.live.ampDeg - out.mod.ampDeg) < 0.05,
  out.live ? `step(): ${f2(out.live.sPerDay)} s/day at ${out.live.ampDeg.toFixed(3)}°, module ${f2(out.mod.sPerDay)} at ${out.mod.ampDeg.toFixed(3)}°` : 'no live rate');
row('the hack pad stops the balance and holds it', out.hack.held && out.hack.stoppedOmega === 0, `held at ${out.hack.thetaHeldDeg.toFixed(2)}° from a ${out.hack.before.toFixed(1)}° swing`);
row('released, the escapement restarts it (self-starting in beat)', Math.abs(out.hack.after - out.hack.before) < 0.5, `${out.hack.after.toFixed(2)}° against ${out.hack.before.toFixed(2)}°`);
row('run down, the balance\'s own losses stop it', out.rundown.n1 === out.rundown.n2 && out.rundown.peakDeg < 25, `no beat in the last 5 s; resting ${out.rundown.peakDeg.toFixed(2)}°`);

console.log('\nreport · rate by position, s/day (+ gains), the driven balance at the nominal corner, settled');
console.log('pos   swing      driven   escapement   free (tier one\'s method)   tier one published');
const T1 = { DU: 2.68, DD: 2.68, CU: -3.14, CD: 6.86, CL: 17.28, CR: -13.55 };
for (const r of out.rows)
  console.log(`${r.pos}   ${r.ampDeg.toFixed(2).padStart(7)}°  ${f2(r.driven).padStart(7)}   ${f2(r.escapement).padStart(7)}      ${f2(r.free).padStart(7)}                    ${f2(T1[r.pos]).padStart(7)}`);
console.log(fails.length ? `\nFAIL — ${fails.length}: ${fails.join('; ')}` : '\nPASS — the driven balance holds; the table above is a report');
process.exit(fails.length ? 1 : 0);
