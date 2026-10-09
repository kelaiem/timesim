// §246 tier one — THE POSITIONAL RATE, MODELLED: what does the watch's
// position in gravity do to its rate? Reports, for the six positions a
// chronometer test uses (dial up/down, crown up/down/left/right) and at each of
// the energy column's three friction corners, the rate the free balance keeps
// in seconds per day, split into what moves it:
//
//   · ISOCHRONISM at the swing that position sustains. The energy column
//     (`equalisation.going.energy.corners[*].sustainedDeg`) already solves a
//     different amplitude dial-flat and vertical, because the pivot's friction
//     radius differs; the elastica's torque law then gives a different rate at
//     each (§245's method, `probe-245-stud-isochronism.mjs`).
//   · THE HAIRSPRING'S OWN WEIGHT. In a vertical position the spring's centre
//     of mass acts on the balance, and it moves as the spring breathes. Read
//     off the elastica's own frames, never assumed: the generalised torque on
//     the balance is m_s·g·d(ĝ·c(θ))/dθ, the quasi-static derivative of the
//     spring's potential (its own sag under its weight is neglected — the
//     weight is five orders under the elastic forces). Dial-flat, ĝ is along
//     the staff and the term is zero.
//   · POISE, as a SENSITIVITY. The balance is poised by construction (sixteen
//     symmetric timing screws), so the derived unbalance is zero and choosing
//     one would be a number that looked right (rule 1). What is reported is
//     the rate per µg·mm of unbalance, heavy point low at rest, at each swing
//     — Airy's J₁(A)/A, changing sign near 220°.
//
// What it does NOT model, and says so: the balance is still POSED in the sim
// (balanceTheta is a sine), so every number here is the oscillator swung freely
// on its own torque law, not a simulation — tier two of §246 is that. No
// escapement impulse or its position dependence, no coil contact (the elastica
// lets coils pass at the largest dial-flat swings), no temperature.
//
// Controls, load-bearing:
//   1. a LINEAR torque table through the same integrator reads 0 s/day;
//   2. a SYNTHETIC unbalance on a linear spring reproduces Airy's closed form
//      m·g·e·J₁(A)/(A·k) at three swings, including its sign flip near 220° —
//      the known answer that proves the integrator sees gravity at all;
//   3. a FROZEN centroid (the rest value held for every θ) gives a spring-weight
//      term of exactly zero — the term is the centroid's MOTION, nothing else;
//   4. MUST-HIT, and it reads ĝ: the spring-weight term is not negligible
//      (over 0.1 s/day in some vertical position — a probe that read no
//      gravity would pass control 3 by reading zero everywhere), it flips with
//      gravity (CU = −CD and CL = −CR to 5%, the term being first order in ĝ),
//      and it doubles with the spring's mass to 2% (first order in m_s·g).
//
// A finding the first draft got wrong, kept because it is the physics: that
// draft's must-hit expected the OVERCOIL to remove this term and the flat
// spiral to carry ten times it. Measured, they carry it at the same order
// (nominal corner: 15.4 against 18.0 s/day at worst). Phillips's condition
// puts the REST centroid on the axis, which is what makes the spring develop
// concentrically and keeps the stud's force off the pivots; it says nothing
// about how the centroid MOVES with θ, which is a weighted sum in which each
// element turns by its own share of the wind. The overcoil changes which
// positions the term lands in, not its size. The flat spiral's figures stay
// in the report for exactly that comparison.
// Plus: the table covers every swing it is asked about, and every elastica
// point converged. Exit 1 on any failure; the positional table is a REPORT.
//
// Run: cd tools && node probe-246-positional-rate.mjs
//      ROOT=/path/to/other/checkout node probe-246-positional-rate.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8570 + Math.floor(Math.random() * 40);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`http://127.0.0.1:${PORT}/index.html?sync=0`, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });

const out = await p.evaluate(async () => {
  const G = await import('./src/geometry.js');
  const { UNIT_MM } = await import('./src/layout.js');
  const U_M = UNIT_MM / 1000;                                   // m per model unit — §39's one conversion
  const C = window.__clock;
  const O = C.oscillator, E = C.equalisation.going.energy;
  const kSI = O.k_Nm_per_rad, I = O.I_kgm2, g = E.balance.g_mps2, mS = O.spring.mass_kg;
  const hs = C.labelEntries.find((e) => e.name === 'Hairspring');
  let grp = null;
  hs.obj.traverse((o) => { if (!grp && o.userData && o.userData.spiralFrames) grp = o; });
  const Ud = grp.userData;
  const { innerR, outerR, coils } = Ud.spiral;
  const { turns, raise, kneeR, studR } = Ud.overcoil;

  // --- gravity directions in the spring's own (plan) frame ------------------
  // The watch's positions are named by the crown and the dial. The crown's
  // direction is read off the built knob (the one mesh carrying userData.crown,
  // §83's glyph word) from the dial's centre; the dial faces −z (Z_DIAL < 0),
  // so a viewer of the dial looks along +z. "Crown left" is the crown on that
  // viewer's left with the watch hanging: up × toward-viewer is the viewer's
  // right, so crown-left has up = crown × n, and ĝ = −up.
  let crownObj = null;
  C.scene.traverse((o) => { if (!crownObj && o.userData && o.userData.crown) crownObj = o; });
  const V = grp.position.constructor, Q = grp.quaternion.constructor;
  const crownW = crownObj.getWorldPosition(new V());
  const cx = crownW.x - C.P.dial.x, cy = crownW.y - C.P.dial.y, cl = Math.hypot(cx, cy);
  const c = new V(cx / cl, cy / cl, 0), n = new V(0, 0, -1);
  const cross = (a, b2) => new V().crossVectors(a, b2);
  const qInv = grp.getWorldQuaternion(new Q()).invert();
  const det = grp.matrixWorld.determinant();
  const toLocal = (v) => v.clone().applyQuaternion(qInv);
  const positions = {
    CD: toLocal(c.clone()),                    // crown down: gravity toward the crown
    CU: toLocal(c.clone().negate()),
    CL: toLocal(cross(n, c)),                  // ĝ = −(c × n) = n × c
    CR: toLocal(cross(c, n)),
  };

  // --- the elastica tables -------------------------------------------------
  const d = 0.01, TH = 8.2, M = Math.ceil(TH / d);           // ±8.2 rad, past the 455° peak (7.94)
  const table = (plan) => {
    const el = G.spiralElastica(G.hairspringRest(plan));
    const tq = new Float64Array(2 * M + 1), cxs = new Float64Array(2 * M + 1), cys = new Float64Array(2 * M + 1);
    let conv = true;
    for (const sgn of [1, -1]) {
      let w = null;
      for (let i = 0; i <= M; i++) {
        const r = el.solve(sgn * i * d, w); w = r; conv = conv && r.converged;
        let L = 0, sx = 0, sy = 0;
        for (let j = 1; j < r.pts.length; j++) {
          const l = Math.hypot(r.pts[j][0] - r.pts[j - 1][0], r.pts[j][1] - r.pts[j - 1][1]);
          L += l; sx += l * (r.pts[j][0] + r.pts[j - 1][0]) / 2; sy += l * (r.pts[j][1] + r.pts[j - 1][1]) / 2;
        }
        tq[M + sgn * i] = r.torque * el.L; cxs[M + sgn * i] = sx / L; cys[M + sgn * i] = sy / L;
      }
    }
    const k0 = (tq[M + 1] - tq[M - 1]) / (2 * d);
    return { tq, cxs, cys, k0, conv };
  };
  const lerp = (arr, th) => { const x = th / d + M, i = Math.floor(x), f = x - i; return arr[i] * (1 - f) + arr[i + 1] * f; };
  // spring-weight torque per unit kSI, for a local gravity direction gl, in the
  // RESTORING sign the tables use (τ_restoring = −τ_gs = −m·g·d(ĝ·c)/dθ)
  const weightTq = (T, gl, frozen = false) => {
    const h = new Float64Array(2 * M + 1);
    for (let i = 0; i < h.length; i++) {
      const xx = frozen ? T.cxs[M] : T.cxs[i], yy = frozen ? T.cys[M] : T.cys[i];
      h[i] = gl.x * xx + gl.y * yy;                            // ĝ·c, model units
    }
    const out2 = new Float64Array(2 * M + 1);
    for (let i = 1; i < h.length - 1; i++) out2[i] = -mS * g * ((h[i + 1] - h[i - 1]) / (2 * d)) * U_M / kSI;
    return out2;
  };

  // --- the swing ----------------------------------------------------------
  // θ'' = −restoring(θ), time in units of 1/ω₀ so the linear period is 2π.
  const sPerDay = (P) => -(P / (2 * Math.PI) - 1) * 86400;
  const period = (restoring, A) => {
    const acc = (x) => -restoring(x);
    let th = A, v = 0, t = 0; const h = 2e-3, cross0 = [];
    for (let s = 0; s < 60000 && cross0.length < 3; s++) {
      const k1v = acc(th), k1x = v, k2v = acc(th + h / 2 * k1x), k2x = v + h / 2 * k1v;
      const k3v = acc(th + h / 2 * k2x), k3x = v + h / 2 * k2v, k4v = acc(th + h * k3x), k4x = v + h * k3v;
      const th2 = th + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), v2 = v + h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (th < 0 && th2 >= 0) cross0.push(t + h * (-th) / (th2 - th));
      th = th2; v = v2; t += h;
    }
    return cross0.length === 3 ? cross0[2] - cross0[1] : NaN;
  };
  const rateOf = (T, extra, A) => sPerDay(period((th) => lerp(T.tq, th) / T.k0 + (extra ? lerp(extra, th) : 0), A));

  const plan = { innerR, outerR, coils, overcoil: { turns, raise, kneeR, studR } };
  const T = table(plan);
  const Tflat = table({ innerR, outerR, coils });

  // --- controls -----------------------------------------------------------
  const deg = (x) => x * Math.PI / 180;
  const linear = sPerDay(period((th) => th, deg(270)));
  // Airy: an unbalance sized to move the rate ~10 s/day at small swing, on a
  // linear spring, heavy point low at rest: τ = −m·g·e·sin θ.
  const mge = 2 * 10 / 86400;                                  // per unit k: Δf/f ≈ mge/(2k) at A → 0
  const airyRows = [150, 219.5, 270].map((A) => {
    const a = deg(A);
    const num = sPerDay(period((th) => th + mge * Math.sin(th), a));
    let J1 = 0; for (let m = 0; m < 40; m++) { let f = 1; for (let q = 1; q <= m; q++) f *= q; let f2 = 1; for (let q = 1; q <= m + 1; q++) f2 *= q; J1 += ((m % 2 ? -1 : 1) / (f * f2)) * (a / 2) ** (2 * m + 1); }
    const ana = mge * J1 / a * 86400;
    return { A, numeric: num, analytic: ana };
  });
  const doubled = (() => {
    const A = deg(200), gl = positions.CL, w1 = weightTq(T, gl), w2 = w1.map((x) => 2 * x);
    const base = rateOf(T, null, A);
    return { pos: 'CL at 200°', ratio: (rateOf(T, w2, A) - base) / (rateOf(T, w1, A) - base) };
  })();
  const frozenRows = Object.entries(positions).map(([pos, gl]) => {
    const A = deg(200);
    return { pos, delta: rateOf(T, weightTq(T, gl, true), A) - rateOf(T, null, A) };
  });

  // --- the positional table ----------------------------------------------
  const corners = Object.keys(E.corners);
  const report = corners.map((cn) => {
    const sus = E.corners[cn].sustainedDeg;
    const flatA = deg(sus.flat), vertA = deg(sus.vertical);
    const iso = { flat: rateOf(T, null, flatA), vertical: rateOf(T, null, vertA) };
    const rows = { DU: iso.flat, DD: iso.flat };
    const weight = {};
    for (const [pos, gl] of Object.entries(positions)) {
      rows[pos] = rateOf(T, weightTq(T, gl), vertA);
      weight[pos] = rows[pos] - iso.vertical;
    }
    const flatWeight = {};
    for (const [pos, gl] of Object.entries(positions)) flatWeight[pos] = rateOf(Tflat, weightTq(Tflat, gl), vertA) - rateOf(Tflat, null, vertA);
    const vert = ['CU', 'CD', 'CL', 'CR'].map((k) => rows[k]);
    return { corner: cn, ampDeg: sus, iso, rows, weight, flatWeight,
      spreadVertical: Math.max(...vert) - Math.min(...vert),
      flatMinusVertical: iso.flat - vert.reduce((s, x) => s + x, 0) / 4 };
  });
  // poise sensitivity: s/day per µg·mm (1e-12 kg·m), heavy point low at rest, at each corner's vertical swing
  const poise = corners.map((cn) => {
    const a = deg(E.corners[cn].sustainedDeg.vertical), me = 1e-12;
    const extraArr = new Float64Array(2 * M + 1);
    for (let i = 0; i < extraArr.length; i++) extraArr[i] = (me * g / kSI) * Math.sin((i - M) * d);
    return { corner: cn, ampDeg: E.corners[cn].sustainedDeg.vertical, sPerDayPerUgMm: rateOf(T, extraArr, a) - rateOf(T, null, a) };
  });
  const maxAmpDeg = Math.max(...corners.flatMap((cn) => [E.corners[cn].sustainedDeg.flat, E.corners[cn].sustainedDeg.vertical]));
  return {
    kSI, I, g, mS, det, spring: O.spring, crownDir: [c.x, c.y], positionsLocal: Object.fromEntries(Object.entries(positions).map(([k, v]) => [k, [v.x, v.y, v.z]])),
    conv: T.conv && Tflat.conv, tableMaxDeg: TH * 180 / Math.PI, maxAmpDeg,
    linear, airyRows, frozenRows, doubled, report, poise,
  };
});
await b.close();

const fails = [];
const row = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails.push(name); };
const f1 = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);
console.log(`balance I ${out.I.toExponential(4)} kg·m², spring k ${out.kSI.toExponential(4)} N·m/rad, g ${out.g}`);
console.log(`hairspring ${(out.mS * 1e9).toFixed(1)} µg — ribbon ${out.spring.h_mm.toFixed(4)} × ${out.spring.b_mm.toFixed(4)} mm (${out.spring.shape}), ${out.spring.L_mm.toFixed(2)} mm long`);
console.log(`crown direction from the dial centre (world xy) ${out.crownDir.map((v) => v.toFixed(3)).join(', ')}; spring frame determinant ${out.det.toFixed(3)}`);
row('the spring frame is a rotation (no mirror between the plan and the world)', Math.abs(out.det - 1) < 1e-6, `det ${out.det.toFixed(6)}`);
row('every positional gravity vector lies in the balance plane', Object.values(out.positionsLocal).every((v) => Math.abs(v[2]) < 1e-9));
row('control 1: a linear torque table reads 0 s/day at 270°', Math.abs(out.linear) < 0.01, `${out.linear.toExponential(2)} s/day`);
for (const r of out.airyRows) {
  const ok = Math.abs(r.analytic) < 0.2 ? Math.abs(r.numeric - r.analytic) < 0.05 : Math.abs(r.numeric / r.analytic - 1) < 0.02;
  row(`control 2: an unbalance reproduces Airy's J₁(A)/A at ${r.A}°`, ok, `numeric ${f1(r.numeric)} vs analytic ${f1(r.analytic)} s/day`);
}
row('control 2: the poise term changes sign across 219.5°', Math.sign(out.airyRows[0].numeric) !== Math.sign(out.airyRows[2].numeric));
row('control 3: a frozen centroid gives a spring-weight term of exactly zero', out.frozenRows.every((r) => Math.abs(r.delta) < 1e-6),
  out.frozenRows.map((r) => `${r.pos} ${r.delta.toExponential(1)}`).join(', '));
const nom = out.report.find((r) => r.corner === 'nominal') || out.report[0];
const W = nom.weight, wMax = Math.max(...Object.values(W).map(Math.abs));
row('control 4 (must-hit): the spring-weight term is not negligible', wMax > 0.1, `worst vertical position ${wMax.toFixed(3)} s/day, ${nom.corner} corner`);
const anti = (a2, b2) => Math.abs(a2 + b2) <= 0.05 * Math.max(Math.abs(a2), Math.abs(b2));
row('control 4: the term flips with gravity (CU = −CD, CL = −CR)', anti(W.CU, W.CD) && anti(W.CL, W.CR),
  `CU ${f1(W.CU)} / CD ${f1(W.CD)}, CL ${f1(W.CL)} / CR ${f1(W.CR)} s/day`);
row('control 4: the term doubles with the spring\'s mass', Math.abs(out.doubled.ratio - 2) < 0.04, `×${out.doubled.ratio.toFixed(4)} at ${out.doubled.pos}`);
row('every elastica point converged', out.conv);
row('the torque table covers every swing asked about', out.tableMaxDeg >= out.maxAmpDeg, `table ±${out.tableMaxDeg.toFixed(0)}°, largest swing ${out.maxAmpDeg.toFixed(1)}°`);

console.log('\nreport · rate by position (s/day, + gains), free balance on the elastica at the swing the energy column sustains there');
console.log('corner        swing flat/vert    DU/DD     CU      CD      CL      CR    vert spread  flat − vert');
for (const r of out.report)
  console.log(`${r.corner.padEnd(12)}  ${r.ampDeg.flat.toFixed(1).padStart(6)}°/${r.ampDeg.vertical.toFixed(1).padStart(6)}°  ${f1(r.rows.DU).padStart(7)} ${['CU', 'CD', 'CL', 'CR'].map((k) => f1(r.rows[k]).padStart(7)).join(' ')}   ${r.spreadVertical.toFixed(3).padStart(7)}     ${f1(r.flatMinusVertical).padStart(7)}`);
console.log('\nreport · of which the hairspring\'s own weight (s/day): overcoil vs the same plan as a flat spiral');
for (const r of out.report)
  console.log(`${r.corner.padEnd(12)}  overcoil ${['CU', 'CD', 'CL', 'CR'].map((k) => `${k} ${r.weight[k].toExponential(2)}`).join('  ')}\n${''.padEnd(14)}flat     ${['CU', 'CD', 'CL', 'CR'].map((k) => `${k} ${r.flatWeight[k].toExponential(2)}`).join('  ')}`);
console.log('\nreport · poise sensitivity, s/day per µg·mm of unbalance, heavy point low at rest (Airy; zero near 220°)');
for (const r of out.poise) console.log(`${r.corner.padEnd(12)}  at ${r.ampDeg.toFixed(1)}° vertical: ${r.sPerDayPerUgMm.toExponential(3)}`);

console.log(fails.length ? `\nFAIL — ${fails.length}: ${fails.join('; ')}` : '\nPASS — controls hold; the positional table above is a report');
process.exit(fails.length ? 1 : 0);
