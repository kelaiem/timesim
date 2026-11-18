#!/usr/bin/env node
// TODO 292 — AT A FAST RATE, WHICH BALANCE BOTH REACHES THE 200° TARGET AND STARTS ITSELF, AND
// WHAT STOPS IT WHEN NONE DOES? A REPORT. The fast rows (28,800, 36,000) carry `undriven` in place of
// a balance, so this boots the row PATCHED to carry one (tools/native/source-patch.mjs, each boot its
// own process) at each radius given, at the rim grid's lightest (0.235: the least the spring must
// drive, and the likeliest to start). The build re-solves the balance's escapement off BALANCE_R.
// It reads the balance's OWN model (`__clock.balanceDriveModel`, main.js BALANCE_DRIVE), which every
// build publishes: the alarm-free build carries no EQUALISATION record (TODO 313), so
// `amplitude.target` cannot be read there. From the model it takes the nominal corner's sustained
// swing hanging, and it re-runs BALANCE_DRIVE's own start call (balance-drive.js `selfStart`, the same
// arguments) on the very constants object. It prints why a start fails: the escapement's torque at
// rest (θ = 0, beat 0's impulse table) against the pivots' static friction, and the shake's CROSSING
// (`pinNotch.crossing`: how long the fork takes to cross the shake, how far the balance turns
// meanwhile, and where the impulse therefore begins).
//   node tools/probe-292-fast-start.mjs [--vph 36000] [--query 'alarm=0'] [--rim 0.235] [r …]
// DIAGNOSTIC patches (never a design, and the output is not the build's), by environment:
//   POWER=x    the spring's released energy ×x at the same reserve (main.js GOING_POWER), so the
//              fusee and escape torque, the per-beat delivery and the crossing all move: "more spring"
//   CROSS_T=x  only the torque driving the crossing ×x
//   CROSS_I=x  only the fork's and the reflected train's inertia the crossing moves ×x
// Controls: each boot must beat at vph/7200 Hz (the patched row took), and where an EQUALISATION
// record exists its `amplitude.target.nominalVertical` must equal the model's swing (the two readers
// agree); at 21,600 the probe reads the record's 200.71° and its start. WARNS=1 lists every warning.
import { spawn } from 'node:child_process';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[2] === '--child') {
  register('./native/source-patch.mjs', import.meta.url);
  const { bootNative } = await import('./native/host.mjs');
  const r = await bootNative({ query: process.argv[3] });
  // The balance's OWN model (main.js BALANCE_DRIVE, published on every build — the alarm-free build
  // carries no EQUALISATION record, whose amplitude.target the TODO 242 step test lives in): the
  // nominal corner's sustained swing for the balance as cut, and BALANCE_DRIVE's own start call
  // re-run here on the very constants object (balance-drive.js selfStart, the same arguments).
  const c = r.clock, o = c.oscillator, m = c.balanceDriveModel;
  const { selfStart } = await import('../src/balance-drive.js');
  const st = selfStart(m.K, { drive: true, brake: 0, friction: m.friction.vertical, weight: null });
  // the start's whole question at rest: the escapement's torque on the balance at θ = 0 (beat 0's
  // table, balance-drive.js impulseAt's rule, linear between frames) against the pivots' static friction
  const T = m.K.impulse, f0 = (0 - T.u0) / T.du;
  const tab = (u) => { const f = (u - T.u0) / T.du; if (!(f > 0 && f < T.y.length - 1)) return 0; const i = Math.floor(f), q = f - i; return T.y[i] * (1 - q) + T.y[i + 1] * q; };
  const rest = { escNm: tab(0), frictionNm: m.friction.vertical, peakNm: Math.max(...T.y), u0: T.u0, uEnd: T.u0 + T.du * (T.y.length - 1), halfLift: m.K.halfLift, inside: f0 > 0 && f0 < T.y.length - 1 };
  const t = c.equalisation?.going?.energy?.amplitude?.target ?? null;
  process.stdout.write('\n@@' + JSON.stringify({ warns: r.warns, hz: o.fImpliedHz, ribbon: o.spring.h_mm, inStock: o.spring.inStock,
    radius: c.balanceRadius ?? t?.radius ?? null, deg: m.sustainedDeg.vertical, flat: m.sustainedDeg.flat, starts: st.starts,
    start: st, rest, crossing: c.pinNotch?.crossing ? { endHalf: c.pinNotch.crossing.endHalf, ms: c.pinNotch.crossing.ms, sweptDeg: c.pinNotch.crossing.sweptDeg } : null, recordStarts: t ? t.starts : null, recordDeg: t ? t.nominalVertical : null }) + '\n');
  process.exit(0);
}
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const vph = Number(opt('--vph', '36000')), query = opt('--query', 'alarm=0'), rim = Number(opt('--rim', '0.235'));
const radii = args.length ? args.map(Number) : [5.5, 6, 6.5, 7, 7.5, 8];
const FROM = { 36000: "module: 'floor', undriven: 'TODO 292 — no balance the honest mainspring (TODO 291) drives to AMPLITUDE_TARGET_DEG and starts at this rate',",
  28800: "escPinion: 6, undriven: 'TODO 292 — no balance the honest mainspring (TODO 291) drives to AMPLITUDE_TARGET_DEG and starts at this rate' }, // 6/96" }[vph];
// §339 landing 3g: on ?barrels=2 the 36,000 row's balance is its `parallel` entry (rateBalanceRow), so the trial radius
// and rim go THERE too, or the boot would beat on the declared balance while the probe reported the trial one. The
// literal is the row's own text; a row that moves makes this patch fail loudly (source-patch: 0 occurrences).
const PAR = (r) => (vph === 36000 && /barrels=2/.test(query)
  ? [{ file: 'src/layout.js', from: 'parallel: { balanceR: 8.25, rimF: 0.240, claimDeg: 134, peakDeg: 305,', to: `parallel: { balanceR: ${r}, rimF: ${rim}, claimDeg: 100, peakDeg: 400,` }] : []);
const TO = (r) => FROM.replace(/undriven: '[^']*'/, `balanceR: ${r}, rimF: ${rim}, claimDeg: 100, peakDeg: 400`);
// Diagnostic only (never a design): CROSS_T scales the torque that drives the shake's crossing,
// CROSS_I the fork's and train's inertia it moves (main.js FORK_CROSSING_SOLVE), to find what the start needs.
const EXTRA = [];
// POWER scales the spring's released energy at the same reserve (main.js GOING_POWER), so the fusee
// torque, the escape torque, the per-beat delivery and the crossing all move with it: "more spring".
if (process.env.POWER) EXTRA.push({ file: 'src/main.js', from: '  const released_J = 0.5 * k * (Math.pow(SPRING_WIND_FULL, 2) - Math.pow(SETUP_SWEEP, 2));', to: `  const released_J = ${Number(process.env.POWER)} * 0.5 * k * (Math.pow(SPRING_WIND_FULL, 2) - Math.pow(SETUP_SWEEP, 2));` });
if (process.env.CROSS_T) EXTRA.push({ file: 'src/main.js', from: '  const T = GOING_POWER.escapeTorque_Nm;\n  const { notch, unlockHalf, liftHalf } = PIN_FORK;', to: `  const T = GOING_POWER.escapeTorque_Nm * ${Number(process.env.CROSS_T)};\n  const { notch, unlockHalf, liftHalf } = PIN_FORK;` });
if (process.env.CROSS_I) EXTRA.push({ file: 'src/main.js', from: '  const Ieff = (psi) => { const g = G(psi); return I_fork + I_wheel * g * g; };', to: `  const Ieff = (psi) => { const g = G(psi); return (I_fork + I_wheel * g * g) * ${Number(process.env.CROSS_I)}; };` });
const boot = (r) => new Promise((res) => {
  const p = spawn(process.execPath, ['--import', './tools/native/loader.mjs', fileURLToPath(import.meta.url), '--child', `${query}&vph=${vph}`],
    { cwd: ROOT, env: { ...process.env, TIMESIM_PATCH: JSON.stringify([{ file: 'src/layout.js', from: FROM, to: TO(r) }, ...PAR(r), ...EXTRA]) } });
  let out = '', err = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
  p.on('close', () => { const l = out.split('\n').find((x) => x.startsWith('@@')); res(l ? { r, ...JSON.parse(l.slice(2)) } : { r, fail: err.slice(-600) }); });
});
const pool = Number(process.env.POOL || 3), out = [];
for (let i = 0; i < radii.length; i += pool) out.push(...await Promise.all(radii.slice(i, i + pool).map(boot)));
for (const b of out) {
  if (b.dead) { console.log(`r ${b.r}: BUILD DIED — ${b.dead.slice(0, 400)}`); for (const w of b.warns) console.log(`    · ${w.slice(0, 220)}`); continue; }
  if (b.fail) { console.log(`r ${b.r}: BOOT FAILED ${b.fail}`); continue; }
  const own = b.warns.filter((w) => !/amplitude|AMPLITUDE|TODO 192|TODO 216|TODO 207\/242|TODO 242/.test(w));
  console.log(`r ${b.r} (rim ${rim}): ${b.deg.toFixed(2)}° nominal vertical, ${b.starts ? 'STARTS' : 'does NOT start'}`
    + `${b.start ? ` (beats ${b.start.beats}, stuck ${b.start.stuck}, peak ${(b.start.peakRad * 180 / Math.PI).toFixed(1)}°)` : ''}; ${b.hz} Hz, hairspring ${b.ribbon?.toFixed(4)} mm ${b.inStock ? 'in stock' : 'OUT of stock'}; `
    + `${b.warns.length} warnings, ${own.length} beyond the amplitude rows`);
  if (b.crossing) console.log(`    crossing: ${b.crossing.ms.toFixed(3)} ms, balance sweeps ${b.crossing.sweptDeg.toFixed(2)}°, impulse from ${(b.crossing.endHalf * 180 / Math.PI).toFixed(2)}°`);
  if (b.rest) console.log(`    at rest: escapement ${b.rest.escNm.toExponential(3)} N·m against pivot friction ${b.rest.frictionNm.toExponential(3)} (×${(b.rest.escNm / b.rest.frictionNm).toFixed(3)}); table peak ${b.rest.peakNm.toExponential(3)}, spans u ${b.rest.u0.toFixed(4)}…${b.rest.uEnd.toFixed(4)} rad, half-lift ${b.rest.halfLift.toFixed(4)}`);
  if (process.env.WARNS) for (const w of own) console.log(`    · ${w.slice(0, 220)}`);
  if (b.recordDeg !== null && Math.abs(b.recordDeg - b.deg) > 1e-6) console.log('    CONTROL FAILED: the model and the record disagree');
  if (Math.abs(b.hz - vph / 7200) > 1e-9) console.log(`    CONTROL FAILED: beats ${b.hz} Hz, not ${vph / 7200}`);
}
