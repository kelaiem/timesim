// TODO 251 — THE 7-LEAF CENTRE PINION, PRICED FROM ITS OWN CONTACT PATH.
//
// A REPORT with CONTROLS (the controls exit non-zero; the verdict does not).
//
// The question (issue #531, failure 8): is the great wheel → centre pinion
// (120/7) really the train's worst mesh, and by how much, once the loss is read
// off the path the §136 teeth actually contact on rather than off the
// closed-form `πμ(1/z₁ + 1/z₂)` that `going.energy` prices every mesh with?
//
// WHAT IS MEASURED. §136 cut the teeth cycloidal, so the contact point of a
// pair rides the GENERATING circles, each fixed in space: the driver's face
// meets the driven member's radial flank on the driven member's circle (the
// RECESS arc, after the pitch point) and the driven member's face meets the
// driver's radial flank on the driver's circle (the APPROACH arc, before it).
// Both circles pass through the pitch point P, and a cycloidal normal passes
// through P, so the force direction at every contact point is known without a
// pressure angle. Sliding speed there is (ω₁ + ω₂)·|QP|, and Coulomb friction
// at μ turns that into a loss. Efficiency at a point is the exact ratio
//     η = (F·v_driven) / (F·v_driver)        F = N·n̂ + μN·ŝ  (force on the driven)
// and a pitch's loss is that, averaged over the driver's rotation with the load
// shared equally between the pairs in contact (a stated assumption: a real
// pair's stiffness shares it unevenly).
//
// WHAT IT TAKES FROM THE SOURCE: TRAIN's counts and modules, and the addenda
// from geometry.js's gearToothSpec — the generator's own numbers, not a copy.
// The arc is then re-derived GEOMETRICALLY (the generating circle meets the
// mate's tip circle) and compared against the generator's closed-form arc
// (`cyArc`, restated below from its comment), so a disagreement is the probe's
// geometry or the generator's, and either is a finding.
//
// CONTROLS (each can fail; a probe that cannot is the catalogue's first entry):
//   C1  μ = 0 → η = 1 at every path point (the force is along the normal, the
//       contact kinematics leave no normal slip).
//   C2  power balance: P_in − P_out = F·v_slide at every point, with friction.
//   C3  sliding speed = (ω₁ + ω₂)·|QP| and η → 1 as Q → P.
//   C4  the contact has no NORMAL slip: n̂·v_slide = 0 on the whole path, which
//       is what fixes the approach arc below the line of centres and the recess
//       arc above it for a CCW driver. The mutation — the recess arc taken on
//       the wrong side — must break it, or C4 measures nothing.
//   C5  the geometric arc equals the generator's closed-form arc (1e-9).
//   C7  the path model's loss, as a fraction of πμ(1/z₁ + 1/z₂), equals the
//       classical contact-ratio factor (1 − ε + ε_a² + ε_r²) — Merritt's
//       correction, which the closed form drops by taking it as 1 — within 5%.
//       The two are independent derivations; this is the control that says the
//       0.5× ratio below is the gearing and not the probe.
//   C6  the contact ratio reaches the generator's own target (1.02 + 2ε/p).
//
// Run from tools/:  node --import ./three-node-loader.mjs probe-251-pinion-mesh.mjs

import { TRAIN, FRICTION } from '../src/layout.js';
import { gearToothSpec } from '../src/geometry.js';

const CORNERS = ['favourable', 'nominal', 'adverse'];
let failed = 0;
const control = (ok, what) => { if (!ok) { failed++; console.log(`  CONTROL FAILED: ${what}`); } return ok; };

// ---- the pair -------------------------------------------------------------
// Driver D (the larger wheel, power direction) turns CCW, driven V turns CW.
// O_D at the origin, O_V at (a, 0), P = (r_D, 0). Recess contact is on V's
// generating circle (centre (r_D + r_V/2, 0), radius r_V/2) above the line of
// centres; approach contact is on D's (centre (r_D/2, 0), radius r_D/2) below.
function pair({ m, zD, zV, hD, hV }) {
  const rD = m * zD / 2, rV = m * zV / 2, a = rD + rV;
  const rhoV = rV / 2, rhoD = rD / 2;
  const pitch = 2 * Math.PI / zD;                       // driver rotation per pitch
  const dist = (x, y, cx) => Math.hypot(x - cx, y);
  const bisect = (f, target) => {                       // f increasing on [0, π]
    let lo = 0, hi = Math.PI;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  // recess: φ = π − Δ on C_V; distance from O_D grows from r_D (Δ = 0) to a (Δ = π)
  const recQ = (d) => [rD + rhoV + rhoV * Math.cos(Math.PI - d), rhoV * Math.sin(Math.PI - d)];
  const dRec = bisect((d) => dist(...recQ(d), 0), rD + hD);
  // approach: φ = −Δ on C_D; distance from O_V grows from r_V to a
  const appQ = (d) => [rhoD + rhoD * Math.cos(-d), rhoD * Math.sin(-d)];
  const dApp = bisect((d) => dist(...appQ(d), a), rV + hV);
  // rolling without slip: the contact rides Δφ round a fixed circle of radius ρ
  // while the pitch circle it rolls on turns through ρΔφ of ARC, so the driver
  // turns ρΔφ/r_D (and the driven ρΔφ/r_V) — which also makes the angular
  // contact ratio equal the generator's arc ratio (ρΔφ summed over πm).
  const thRec = dRec * rhoV / rD;
  const thApp = dApp * rhoD / rD;
  return { m, zD, zV, rD, rV, a, rhoV, rhoD, pitch, dRec, dApp, thRec, thApp,
    arcRec: dRec * rhoV, arcApp: dApp * rhoD, recQ, appQ };
}

// ---- one contact point ----------------------------------------------------
// `side` is +1 for the real assignment; -1 plants the C4 mutation.
function point(P, kind, d, mu, side = 1) {
  const { a, rD, rV } = P;
  let [qx, qy] = kind === 'rec' ? P.recQ(d) : P.appQ(d);
  qy *= side;
  let nx, ny;
  if (kind === 'rec') { const L = Math.hypot(qx - a, qy), ux = (qx - a) / L, uy = qy / L; nx = uy; ny = -ux; }
  else { const L = Math.hypot(qx, qy), ux = qx / L, uy = qy / L; nx = -uy; ny = ux; }
  const wD = 1, wV = -rD / rV;
  const vDx = -wD * qy, vDy = wD * qx, vVx = -wV * qy, vVy = wV * (qx - a);
  const sx = vDx - vVx, sy = vDy - vVy, sl = Math.hypot(sx, sy);
  const fx = nx + (sl > 1e-15 ? mu * sx / sl : 0), fy = ny + (sl > 1e-15 ? mu * sy / sl : 0);
  const pIn = fx * vDx + fy * vDy, pOut = fx * vVx + fy * vVy;
  return { eta: pOut / pIn, pIn, pOut, slide: sl, pdist: Math.hypot(qx - rD, qy), balance: pIn - pOut - (fx * sx + fy * sy), nDotS: nx * sx + ny * sy };
}

// ---- the cycle ------------------------------------------------------------
// Pairs in contact at driver phase φ are those with path position φ + k·pitch in
// [0, thApp + thRec]; each carries 1/n of the load. Returns the mean loss.
function meshLoss(P, mu, steps = 4000) {
  const arc = P.thApp + P.thRec;
  const at = (p) => p < P.thApp
    ? point(P, 'app', (P.thApp - p) * P.rD / P.rhoD, mu)
    : point(P, 'rec', (p - P.thApp) * P.rD / P.rhoV, mu);
  let loss = 0, single = 0;
  for (let i = 0; i < steps; i++) {
    const ph = (i + 0.5) / steps * P.pitch;
    const ps = [];
    for (let k = 0; ph + k * P.pitch <= arc; k++) ps.push(ph + k * P.pitch);
    if (!ps.length) { loss += NaN; continue; }
    for (const p of ps) loss += (1 - at(p).eta) / ps.length;
  }
  const n = 2000;
  for (let i = 0; i < n; i++) single += 1 - at((i + 0.5) / n * arc).eta;
  return { loss: loss / steps, single: single / n, at };
}

// ---- the generator's closed-form arc, restated from its comment ------------
const cyArc = (R, rho, h) => {
  const c = ((R + rho) ** 2 + rho ** 2 - (R + h) ** 2) / (2 * rho * (R + rho));
  return c <= -1 ? rho * Math.PI : c >= 1 ? 0 : rho * Math.acos(c);
};

// ---- the meshes -----------------------------------------------------------
const rows = Object.entries(TRAIN).map(([key, t]) => {
  const w = gearToothSpec({ module: t.module, teeth: t.teeth, mates: [t.pinion] });
  const p = gearToothSpec({ module: t.module, teeth: t.pinion, mates: [t.teeth] });
  return { key, t, hD: w.addendum, hV: p.addendum, infeasible: [...w.infeasible, ...p.infeasible] };
});

function report(label, { m, zD, zV, hD, hV }, doControls) {
  const P = pair({ m, zD, zV, hD, hV });
  const cr = (P.arcRec + P.arcApp) / (Math.PI * m);
  const out = { label, P, cr, eta: {}, closed: {} };
  for (const c of CORNERS) {
    const mu = FRICTION.muTooth[c];
    out.eta[c] = 1 - meshLoss(P, mu).loss;
    out.closed[c] = 1 - Math.PI * mu * (1 / zD + 1 / zV);
  }
  if (doControls) {
    const mu = FRICTION.muTooth.nominal;
    const N = 60;
    let c1 = 0, c2 = 0, c3 = 0, nsMax = 0;
    for (const kind of ['app', 'rec']) {
      const dMax = kind === 'rec' ? P.dRec : P.dApp;
      for (let i = 0; i <= N; i++) {
        const d = dMax * i / N;
        const z = point(P, kind, d, 0), f = point(P, kind, d, mu);
        c1 = Math.max(c1, Math.abs(z.eta - 1));
        c2 = Math.max(c2, Math.abs(f.balance));
        c3 = Math.max(c3, Math.abs(f.slide - (1 + P.rD / P.rV) * f.pdist));
        nsMax = Math.max(nsMax, Math.abs(f.nDotS));
      }
    }
    control(c1 < 1e-12, `C1 μ=0 gives η=1 (worst |η−1| = ${c1.toExponential(2)})`);
    control(c2 < 1e-12, `C2 power balance (worst ${c2.toExponential(2)})`);
    control(c3 < 1e-12, `C3 sliding = (ω₁+ω₂)|QP| (worst ${c3.toExponential(2)})`);
    control(nsMax < 1e-12, `C4 no normal slip on the path (worst ${nsMax.toExponential(2)})`);
    const radii = (reverse) => {
      const rs = [];
      const q = (p) => p < P.thApp ? P.appQ((P.thApp - p) * P.rD / P.rhoD) : P.recQ((p - P.thApp) * P.rD / P.rhoV);
      for (let i = 0; i <= 400; i++) {
        const p = (reverse ? 1 - i / 400 : i / 400) * (P.thApp + P.thRec);
        const [x, y] = q(p);
        rs.push([Math.hypot(x, y), Math.hypot(x - P.a, y)]);
      }
      return rs;
    };
    const sweeps = (rs) => rs.every((r, i) => i === 0 || (r[0] >= rs[i - 1][0] - 1e-12 && r[1] <= rs[i - 1][1] + 1e-12));
    control(sweeps(radii(false)), 'C4 the driver\'s contact sweeps root→tip and the driven\'s tip→root along the path');
    control(!sweeps(radii(true)), 'C4 mutation (path read backwards) must break the sweep');
    const arcRec = cyArc(P.rD, P.rhoV, hD), arcApp = cyArc(P.rV, P.rhoD, hV);
    control(Math.abs(arcRec - P.arcRec) < 1e-9 && Math.abs(arcApp - P.arcApp) < 1e-9,
      `C5 geometric arc = generator's cyArc (recess ${P.arcRec.toFixed(6)} vs ${arcRec.toFixed(6)}, approach ${P.arcApp.toFixed(6)} vs ${arcApp.toFixed(6)})`);
    const eps = 0.01 * Math.PI * m, target = 1 + 0.02 + 2 * eps / (Math.PI * m);
    {
      const ea = P.thApp / P.pitch, er = P.thRec / P.pitch, fac = 1 - (ea + er) + ea * ea + er * er;
      const ratio = meshLoss(P, 0.01).loss / (Math.PI * 0.01 * (1 / zD + 1 / zV));
      out.factor = ratio;
      control(Math.abs(ratio / fac - 1) < 0.05, `C7 path loss / πμ(1/z₁+1/z₂) = ${ratio.toFixed(4)} vs classical factor ${fac.toFixed(4)} (ε_a ${ea.toFixed(3)}, ε_r ${er.toFixed(3)})`);
    }
    control(cr >= target - 1e-9, `C6 contact ratio ${cr.toFixed(4)} reaches the generator's target ${target.toFixed(4)}`);
  }
  return out;
}

console.log('TODO 251 — each going-train mesh priced from its own contact path (driver = the wheel)\n');
console.log('mesh (z_wheel/z_pinion)   module   h_wheel  h_pinion  CR      approach  recess  | η equal-share fav / nom / adv   | closed-form πμ law fav / nom / adv');
const results = [];
for (const r of rows) {
  const res = report(`${r.t.teeth}/${r.t.pinion}`, { m: r.t.module, zD: r.t.teeth, zV: r.t.pinion, hD: r.hD, hV: r.hV }, true);
  res.key = r.key; results.push(res);
  if (r.infeasible.length) console.log(`  (infeasible against ${r.infeasible.join(', ')})`);
  const P = res.P;
  const share = (x) => (x / (P.thApp + P.thRec) * 100).toFixed(0) + '%';
  console.log(`${res.label.padEnd(24)}  ${r.t.module.toFixed(4)}   ${r.hD.toFixed(4)}   ${r.hV.toFixed(4)}   ${res.cr.toFixed(3)}   ${share(P.thApp).padStart(5)}     ${share(P.thRec).padStart(5)}   | ${CORNERS.map((c) => res.eta[c].toFixed(4)).join(' / ')}  | ${CORNERS.map((c) => res.closed[c].toFixed(4)).join(' / ')}`);
}

const worst = (c) => [...results].sort((a, b) => a.eta[c] - b.eta[c]).map((x) => `${x.label} ${x.eta[c].toFixed(4)}`);
console.log('\nrank, worst first (equal-share path model):');
for (const c of CORNERS) console.log(`  ${c.padEnd(10)} ${worst(c).join('  <  ')}`);
const great = results.find((x) => x.key === 'barrel');
console.log(`\nloss as a fraction of the closed form (1.0 = the closed form is right): ` + results.map((x) => `${x.label} ${x.factor.toFixed(3)}`).join(', '));
console.log(`\n120/7 path model vs the closed form the energy column uses: ` +
  CORNERS.map((c) => `${c} ${great.eta[c].toFixed(4)} vs ${great.closed[c].toFixed(4)} (Δ ${((great.eta[c] - great.closed[c]) * 100).toFixed(2)} pts)`).join('; '));

const prod = (f) => CORNERS.map((c) => results.reduce((a, x) => a * f(x, c), 1));
console.log(`\nproduct of the four mesh efficiencies, fav / nom / adv — closed form ${prod((x, c) => x.closed[c]).map((v) => v.toFixed(4)).join(' / ')}; path model ${prod((x, c) => x.eta[c]).map((v) => v.toFixed(4)).join(' / ')}`);

// ---- sensitivity: pinion leaves at the great wheel's module and teeth ------
console.log('\nsensitivity — pinion leaf count with the great wheel (120 t) and its module held (nominal μ):');
console.log('  leaves   h_pinion   CR      η(path)   η(closed πμ)   note');
const base = TRAIN.barrel;
for (let zV = 6; zV <= 14; zV++) {
  const w = gearToothSpec({ module: base.module, teeth: base.teeth, mates: [zV] });
  const p = gearToothSpec({ module: base.module, teeth: zV, mates: [base.teeth] });
  const mu = FRICTION.muTooth.nominal;
  const P = pair({ m: base.module, zD: base.teeth, zV, hD: w.addendum, hV: p.addendum });
  const cr = (P.arcRec + P.arcApp) / (Math.PI * base.module);
  const eta = 1 - meshLoss(P, mu).loss;
  console.log(`  ${String(zV).padStart(4)}     ${p.addendum.toFixed(4)}    ${cr.toFixed(3)}   ${eta.toFixed(4)}    ${(1 - Math.PI * mu * (1 / base.teeth + 1 / zV)).toFixed(4)}         ${zV === base.pinion ? 'shipped' : ''}${(w.infeasible.length || p.infeasible.length) ? ' INFEASIBLE' : ''}`);
}

console.log(failed ? `\n${failed} CONTROL(S) FAILED — the readings above are not to be trusted.` : '\nAll controls passed. The verdict above is a REPORT; only the controls gate.');
process.exit(failed ? 1 : 0);
