// §245 — THE STUD RADIUS AGAINST ISOCHRONISM: does the default stud radius give
// the hairspring the smallest amplitude-dependent rate of any row on the stud
// menu? Reads, for every `?studr=` menu row, the rate the free spring alone
// adds at 45° (the drawn swing), 150°, 220° and 270° (the physical reference),
// in seconds per day, plus the pivot load at 270°, and fails unless the
// default row has the smallest |rate| at 270°.
//
// What it measures is the SPRING's isochronism and nothing else: the balance
// swings freely on the elastica's torque law, θ'' = −τ(θ)/I, with I set so the
// small-swing period is the linear one. No escapement, no pivot friction, no
// gravity, no temperature — each of those moves a real watch's rate with
// amplitude too, and none is modelled here. The overcoil's centroid condition
// (Phillips) makes the clamp ratio exactly 1 at every radius in the window, so
// the section and the linear rate do not move with the stud; what does is the
// SECOND-order residual — the stud's reaction at a real swing, and with it how
// far τ(θ) departs from linear. That residual is what this reads.
//
// The plan is read off the BUILT hairspring (`userData.spiral`/`overcoil`) and
// the rows off the panel's own `#spec-studr` menu, so nothing here restates a
// constant main.js owns; the elastica is geometry.js's own `spiralElastica`,
// imported in the page. A positive rate is a gain.
//
// Two controls, both load-bearing: a LINEAR torque table through the same
// integrator must read 0 s/day at 270° (the period extraction measures nothing
// else), and every row must read ~0 at 5° (the elastica is linear there, so a
// rate at small swing is a solver artefact, not isochronism).
//
// Exit 1 on any failure.
//
// Run: cd tools && node probe-245-stud-isochronism.mjs
//      ROOT=/path/to/other/checkout node probe-245-stud-isochronism.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8530 + Math.floor(Math.random() * 40);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`http://127.0.0.1:${PORT}/index.html?sync=0`, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });

const out = await p.evaluate(async () => {
  const G = await import('./src/geometry.js');
  const C = window.__clock;
  const hs = C.labelEntries.find((e) => e.name === 'Hairspring');
  let U = null;
  hs.obj.traverse((o) => { if (!U && o.userData && o.userData.spiralFrames) U = o.userData; });
  const { innerR, outerR, coils } = U.spiral;
  const { turns, raise, kneeR, studR: defaultR } = U.overcoil;
  const rows = [...document.querySelectorAll('#spec-studr option')].map((o) => Number(o.value));
  const AMPS = [5, 45, 150, 220, 270];
  const d = 0.01, M = Math.ceil(5.0 / d);   // table to ±5 rad, past 270° = 4.71
  const sPerDay = (P) => -(P / (2 * Math.PI) - 1) * 86400;
  // period of θ'' = −T(θ)/k0 from rest at A (ω0 = 1, so the linear period is 2π)
  const period = (T, k0, A) => {
    let th = A, v = 0, t = 0; const h = 2e-3, cross = [];
    const acc = (x) => -T(x) / k0;
    for (let n = 0; n < 40000 && cross.length < 3; n++) {
      const k1v = acc(th), k1x = v, k2v = acc(th + h / 2 * k1x), k2x = v + h / 2 * k1v;
      const k3v = acc(th + h / 2 * k2x), k3x = v + h / 2 * k2v, k4v = acc(th + h * k3x), k4x = v + h * k3v;
      const th2 = th + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), v2 = v + h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (th < 0 && th2 >= 0) cross.push(t + h * (-th) / (th2 - th));
      th = th2; v = v2; t += h;
    }
    return cross.length === 3 ? cross[2] - cross[1] : NaN;
  };
  const measure = (plan) => {
    const el = G.spiralElastica(G.hairspringRest(plan));
    const tq = new Float64Array(2 * M + 1), lam = new Float64Array(2 * M + 1);
    let conv = true;
    for (const sgn of [1, -1]) {
      let w = null;
      for (let i = 0; i <= M; i++) {
        const r = el.solve(sgn * i * d, w); w = r; conv = conv && r.converged;
        tq[M + sgn * i] = r.torque * el.L; lam[M + sgn * i] = Math.hypot(r.lam[0], r.lam[1]) * el.L * el.L;
      }
    }
    const k0 = (tq[M + 1] - tq[M - 1]) / (2 * d);
    const T = (th) => { const x = th / d + M, i = Math.floor(x), f = x - i; return tq[i] * (1 - f) + tq[i + 1] * f; };
    const i270 = Math.round((270 * Math.PI / 180) / d);
    return { k0, conv, lam270: Math.max(lam[M + i270], lam[M - i270]),
             rate: Object.fromEntries(AMPS.map((a) => [a, sPerDay(period(T, k0, a * Math.PI / 180))])) };
  };
  const linearControl = sPerDay(period((th) => th, 1, 270 * Math.PI / 180));
  const flat = measure({ innerR, outerR, coils });
  const res = rows.map((studR) => ({ studR, ...measure({ innerR, outerR, coils, overcoil: { turns, raise, kneeR, studR } }) }));
  return { defaultR, rows: res, flat, linearControl, AMPS };
});
await b.close(); srv.kill();

const fails = [];
const row = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails.push(name); };
const fmt = (r) => out.AMPS.filter((a) => a !== 5).map((a) => `${a}° ${r.rate[a] >= 0 ? '+' : ''}${r.rate[a].toFixed(1)}`).join('  ');
console.log(`flat spiral (no overcoil), clamp ×${out.flat.k0.toFixed(5)}:  ${fmt(out.flat)} s/day, pivot load ${out.flat.lam270.toFixed(3)} EI/L² at 270°`);
for (const r of out.rows)
  console.log(`report · stud r ${r.studR.toFixed(4)}${Math.abs(r.studR - out.defaultR) < 1e-12 ? ' (default)' : '          '}  clamp ×${r.k0.toFixed(6)}:  ${fmt(r)} s/day, pivot load ${r.lam270.toFixed(3)} EI/L² at 270°`);
row('control: a linear torque table reads 0 s/day at 270°', Math.abs(out.linearControl) < 0.01, `${out.linearControl.toExponential(2)} s/day`);
row('control: every row is isochronous at 5° (the elastica is linear there)', out.rows.every((r) => Math.abs(r.rate[5]) < 0.05), out.rows.map((r) => r.rate[5].toFixed(3)).join(', '));
row('every row converged on every table point', out.rows.every((r) => r.conv));
row('the default is a menu row', out.rows.some((r) => Math.abs(r.studR - out.defaultR) < 1e-12), `default r ${out.defaultR}`);
const best = out.rows.reduce((m, r) => (Math.abs(r.rate[270]) < Math.abs(m.rate[270]) ? r : m));
row('the default stud radius is the most isochronous menu row at 270°', Math.abs(best.studR - out.defaultR) < 1e-12,
  `best r ${best.studR.toFixed(4)} at ${best.rate[270].toFixed(2)} s/day`);
console.log(fails.length ? `\nFAIL — ${fails.length}: ${fails.join('; ')}` : '\nPASS — the stud sits where the spring is most isochronous');
process.exit(fails.length ? 1 : 0);
