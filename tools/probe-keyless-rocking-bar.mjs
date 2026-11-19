#!/usr/bin/env node
// THE KEYLESS FUSEE'S ROCKING BAR, IN A LINE (TODO 318, roadmap §334) — acceptance, pure Node.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar.mjs
//
// src/keyless-rocking-bar.js designs the bar that keeps the crown still while the watch runs: the winding wheels
// ride a bar pivoted on the transfer wheel's arbor, a spring holds it out of mesh with the fusee's winding spur,
// and a friction carry swings it in when the crown is turned to wind. This holds each row to the constraint it is
// derived from, for both variants (one carried wheel, two), and each rule has a control that must fail:
//   RB1  engaged at full depth; neutral stands the tips CLEAR_MARGIN apart.
//        CONTROL: half the swing leaves them closer than the margin
//   RB2  no two non-meshing members of the two-wheel bar come within CLEAR_MARGIN, engaged or neutral.
//        CONTROL: the straight (unbent) bar does
//   RB3  turning the crown to wind carries the bar from neutral to engaged.
//        CONTROL: the mirrored bar is carried the other way
//   RB4  under winding load the teeth push the bar onto its depth banking, at every pressure-angle corner.
//        CONTROL: on the mirrored bar they push it out
//   RB5  the teeth load the bar identically winding and back-driven (why no torque-sensing part can tell them
//        apart, and why a one-way cannot either). CONTROL: reversing the TORQUE reverses it (at zero pressure angle)
//   RB6  sense and ratio: the two-wheel bar keeps the direct routing's winding sense, the one-wheel bar reverses
//        it; the idlers cancel from the ratio
//   RB7  the window, with the metal: the bar's weight < the spring at neutral < at engaged < the carry at the
//        friction band's low corner < at its high corner < the carry's ceiling, three equal ratio margins.
//        CONTROL: landing 2's first draft (the blade on the first wheel, at the plate floor) closes it
//   RB8  released, the bar lets go of a positive crown-side drag (reported)
//   RB9  a fork of the centre distance re-derives every row. CONTROL: out of reach, the bar refuses
//   RB10 the bar's in-plane section carries its worst load (bending and axial) at or under yield, floored at §50.
//        CONTROL: a thousandfold load is load-governed and works exactly at yield
//   RB11 each carried wheel's pin by TODO 193's law, the last also taking the banking. CONTROL: likewise
//   RB12 the return blade's preload and rate give the window's spring at both bankings, under the ribbons' alloy
//   RB13 the friction clip's grip gives the carry at both ends of muPlain's band; its interference is REPORTED
//   RB14 a tip landing on a tip slides off under the winding torque (and the crown turn that costs)
//   RB15 the banking slot's ends stand the swing apart
import { solveRockingBar, ROCKING_BAR_INPUTS } from '../src/keyless-rocking-bar.js';
import { CLEAR_MARGIN, STOCK_MIN_U, UNIT_MM, SPRING_SIGMA_Y_PA, FRICTION, PIVOT_BORE_CLEAR } from '../src/layout.js';

const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };
const deg = (r) => (r * 180 / Math.PI).toFixed(3);
const f = (v, n = 4) => Number(v).toPrecision(n);

for (const v of ['one', 'two']) {
  const B = solveRockingBar(v), M = solveRockingBar(v, {}, -solveRockingBar(v).side);
  ok(`[${v}] solves`, B.feasible, B.why || '');
  if (!B.feasible) continue;

  ok(`[${v}] RB1 engaged at full depth`, Math.abs(B.engaged.depthErr) < 1e-9, `depth error ${B.engaged.depthErr.toExponential(1)} u`);
  ok(`[${v}] RB1 neutral tips CLEAR_MARGIN apart`, Math.abs(B.neutral.gap - CLEAR_MARGIN) < 1e-9, `gap ${f(B.neutral.gap, 6)} u after a ${deg(B.swing)}° swing`);
  const half = B.gapLF(B.centres(B.engaged.phi + B.side * B.swing / 2, B.beta));
  ok(`[${v}] RB1 CONTROL half the swing is short of the margin`, half < CLEAR_MARGIN, `gap ${f(half)} u`);

  if (v === 'two') {
    ok(`[${v}] RB2 non-meshing members clear, engaged`, B.engaged.clear.gap >= CLEAR_MARGIN, `worst ${f(B.engaged.clear.gap)} u (${B.engaged.clear.pair.slice(0, 2).join('T and ')}T), bend ${deg(B.beta)}°`);
    ok(`[${v}] RB2 non-meshing members clear, neutral`, B.neutral.clear.gap >= CLEAR_MARGIN, `worst ${f(B.neutral.clear.gap)} u`);
    const phi0 = B.engagedAt(0, B.side);
    const g0 = phi0 === null ? -Infinity : B.pairClear(B.centres(phi0, 0)).gap;
    ok(`[${v}] RB2 CONTROL the straight bar fouls`, g0 < CLEAR_MARGIN, phi0 === null ? 'cannot engage at all' : `worst ${f(g0)} u`);
  }

  ok(`[${v}] RB3 winding carries the bar in`, B.carrySense === B.inputs.windSense, `carry ${B.carrySense}, wind ${B.inputs.windSense}`);
  ok(`[${v}] RB3 CONTROL the mirrored bar is carried away`, M.carrySense !== M.inputs.windSense);

  ok(`[${v}] RB4 the load holds the bar on its depth banking`, B.kMin > 0, `k ${f(B.kMin)}–${f(B.kMax)} per unit torque, over ${B.corners.length} pressure-angle corners`);
  ok(`[${v}] RB4 CONTROL on the mirrored bar the load kicks it out`, M.kMax < 0, `k ${f(M.kMin)}–${f(M.kMax)}`);

  ok(`[${v}] RB5 the same force system winding and back-driven`, B.sameForceSystem < 1e-12, `max |k_wind − k_run| ${B.sameForceSystem.toExponential(1)}`);
  // at zero pressure angle on every mesh: reversing the torque flips each tooth force whole there, while at a
  // tilted corner the part that presses the teeth apart stays a push, so only this corner negates exactly
  const al = B.corners.find((r) => r.alphas.every((x) => x === 0)).alphas;
  const kw = B.kAt(B.engaged.centres, al, 'wind'), kr = B.kAt(B.engaged.centres, al, 'torqueReversed');
  ok(`[${v}] RB5 CONTROL reversing the torque reverses the moment`, Math.abs(kw + kr) < 1e-12 && Math.abs(kw) > 1e-3, `${f(kw)} against ${f(kr)}`);

  const ratio = B.chain.slice(0, -1).reduce((p, n, i) => p * n / B.chain[i + 1], 1);
  ok(`[${v}] RB6 the idlers cancel from the ratio`, Math.abs(ratio - B.ratio) < 1e-12, `${f(ratio)} = ${B.chain[0]}/${B.chain.at(-1)}`);
  ok(`[${v}] RB6 winding sense at the crown`, B.sense.sameAsDirect === (v === 'two'),
    `${B.sense.meshes} meshes: ${B.sense.sameAsDirect ? 'the direct routing\'s sense' : 'REVERSED against the direct routing (right only where an idler already routes it)'}`);

  const W = B.window;
  const chain = [W.Mg_Nmm, W.Ms_Nmm, W.MsE_Nmm, W.MfLo_Nmm, W.MfHi_Nmm, W.MfMax_Nmm];
  const ordered = chain.every((x, i) => i === 0 || chain[i - 1] < x);
  const rel = (a, b) => Math.abs(a / b - 1) < 1e-9;
  const equal = rel(W.Ms_Nmm / W.Mg_Nmm, W.q) && rel(W.MfLo_Nmm / W.MsE_Nmm, W.q) && rel(W.MfMax_Nmm / W.MfHi_Nmm, W.q)
    && rel(W.MsE_Nmm / W.Ms_Nmm, W.rise) && rel(W.MfHi_Nmm / W.MfLo_Nmm, W.muSpread);
  ok(`[${v}] RB7 weight < spring (neutral, engaged) < carry (low, high μ) < ceiling, equal ratio margins`, ordered && equal && W.q > 1,
    `${chain.map((x) => f(x)).join(' < ')} N·mm; margins ×${f(W.q, 3)}, spring rise ×${f(W.rise, 3)}, friction spread ×${f(W.muSpread, 3)}`);
  const draft = solveRockingBar(v, { bladeAt: 'firstWheel', bladeH_u: STOCK_MIN_U });
  ok(`[${v}] RB7 CONTROL landing 2's first draft (blade on the first wheel, at the plate floor) has no window`, draft.window.q < 1,
    `q ${f(draft.window.q, 3)}: the blade's moment rises ×${f(draft.window.rise, 4)} over the swing`);

  // RB10 the bar's section
  const M_ = B.metal, sigY = SPRING_SIGMA_Y_PA / 1e6;
  ok(`[${v}] RB10 the bar's section carries its worst load at or under yield`, M_.sigma <= sigY * (1 + 1e-9) && M_.w >= STOCK_MIN_U * UNIT_MM - 1e-12,
    `width ${f(M_.w * 1000)} µm (${M_.wLoad > STOCK_MIN_U * UNIT_MM ? 'load' : '§50 floor'}), ${f(M_.sigma)} MPa against ${sigY}; M ${f(M_.Mmax)} N·mm, N ${f(M_.Nmax)} N`);
  const big = B.sizeMetal(B.window.Tw_Nmm * 1e3);
  ok(`[${v}] RB10 CONTROL a thousandfold load is load-governed and works exactly at yield`, big.wLoad > STOCK_MIN_U * UNIT_MM && rel(big.sigma, sigY),
    `width ${f(big.w * 1000)} µm at ${f(big.sigma)} MPa`);

  // RB11 the pins (TODO 193's law)
  const pinSig = (F, L, d) => 32 * F * L / (Math.PI * Math.pow(d, 3));
  const pinsOk = M_.pins.every((p, i) => pinSig(p.F_N + (i === M_.pins.length - 1 ? M_.Fbank : 0), M_.lever, p.d_mm) <= sigY * (1 + 1e-9));
  ok(`[${v}] RB11 every carried wheel's pin at or under yield, the last carrying the banking`, pinsOk,
    M_.pins.map((p) => `⌀${f(p.d_mm * 1000)} µm for ${f(p.F_N)} N`).join(', ') + `; banking ${f(M_.Fbank)} N`);
  const bigLast = big.pins.at(-1);
  ok(`[${v}] RB11 CONTROL under a thousandfold load the last pin works exactly at yield`,
    rel(pinSig(bigLast.F_N + big.Fbank, big.lever, bigLast.d_mm), sigY), `⌀${f(bigLast.d_mm * 1000)} µm`);

  // RB12 the return blade
  const Bl = B.blade;
  const mN = Bl.k_Npmm * Bl.preload_mm * Bl.lever_mm, mE = Bl.k_Npmm * (Bl.preload_mm + Bl.swing_mm) * Bl.lever_mm;   // rate × deflection × lever
  ok(`[${v}] RB12 the blade's preload and rate give the window's spring at both bankings`,
    rel(mN, B.window.Ms_Nmm) && rel(mE, B.window.MsE_Nmm) && rel(Bl.swing_mm, Bl.lever_mm * B.swing),
    `bearing at ${f(Bl.lever_mm)} mm from D; ${f(Bl.L_mm)} mm × ${f(Bl.h_mm * 1000)} µm, rate ${f(Bl.k_Npmm)} N/mm, preload ${f(Bl.preload_mm * 1000)} µm, swing ${f(Bl.swing_mm * 1000)} µm`);
  ok(`[${v}] RB12 the blade works under the ribbons' alloy at full swing`, Bl.sigmaE <= Bl.sigmaLimit, `${f(Bl.sigmaE)} MPa against ${Bl.sigmaLimit}`);

  // RB13 the friction carry
  const C_ = B.clip, mu = FRICTION.muPlain;
  ok(`[${v}] RB13 the clip's grip gives the carry at both ends of the friction band`,
    rel(mu.favourable * C_.N_N * C_.r_mm, B.window.MfLo_Nmm) && rel(mu.adverse * C_.N_N * C_.r_mm, B.window.MfHi_Nmm) && C_.sigma <= C_.sigmaLimit * (1 + 1e-9),
    `grip ${f(C_.N_N)} N at r ${f(C_.r_mm)} mm, jaws ${f(C_.jawL_mm)} mm × ${f(C_.h_mm * 1000)} µm at ${f(C_.sigma)} MPa`);
  ok(`[${v}] RB13 the clip's interference (REPORT)`, true, `${f(C_.interference_mm * 1000)} µm a jaw: tight to hold; a longer jaw would ease it and is the fold's to find`);

  // RB14 tip on tip
  ok(`[${v}] RB14 a tip landing on a tip slides off under the winding torque`, B.tip.margin > 1,
    `the carry pushes ${f(B.tip.push_N * 1000)} mN; its tip friction needs ${f(B.tip.tipTorqueAtD_Nmm)} N·mm at the transfer against ${f(W.Tw_Nmm)} (×${f(B.tip.margin)}); at worst ${f(B.tip.crownTurnDeg)}° more crown turn before it drops in`);

  // RB15 the banking slot
  const Sl = B.slot;
  ok(`[${v}] RB15 the slot's ends stand the swing apart, its width the pin's with running clearance`,
    rel(Sl.travel_mm / Sl.r_mm, B.swing) && rel(Sl.width_mm, Sl.pinD_mm + 2 * PIVOT_BORE_CLEAR * UNIT_MM),
    `radius ${f(Sl.r_mm)} mm, travel ${f(Sl.travel_mm * 1000)} µm, width ${f(Sl.width_mm * 1000)} µm`);

  ok(`[${v}] RB8 released, the bar lets go of crown-side drag`, W.releaseLimit_Nmm > 0,
    `up to ${f(W.releaseLimit_Nmm)} N·mm at the transfer wheel, ${(100 * W.releaseLimit_Nmm / W.Tw_Nmm).toFixed(2)}% of the ${f(W.Tw_Nmm)} N·mm winding torque there (REPORT: the movement models no load-independent crown drag)`);

  const c = B.inputs.module * (B.chain[0] + B.chain[1]) / 2 + B.inputs.module * (B.chain.at(-2) + B.chain.at(-1)) / 2;
  const reach = v === 'one' ? c : Infinity;
  const forkD = ROCKING_BAR_INPUTS.centreDistance_u.v * 1.35;
  const K = solveRockingBar(v, { centreDistance_u: forkD });
  ok(`[${v}] RB9 a fork of the centre distance re-derives`, K.feasible && Math.abs(K.engaged.depthErr) < 1e-9 && Math.abs(K.neutral.gap - CLEAR_MARGIN) < 1e-9 && K.kMin > 0,
    K.feasible ? `at ${f(forkD)} u: engaged ${deg(K.engaged.phi)}°, swing ${deg(K.swing)}°, k ≥ ${f(K.kMin)}` : K.why);
  if (Number.isFinite(reach)) {
    const out = solveRockingBar(v, { centreDistance_u: reach + 0.1 });
    ok(`[${v}] RB9 CONTROL out of reach the bar refuses`, !out.feasible, `at ${f(reach + 0.1)} u, reach ${f(reach)} u`);
  }
}

console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join('; ')}` : '\nall rows hold');
process.exit(fails.length ? 1 : 0);
