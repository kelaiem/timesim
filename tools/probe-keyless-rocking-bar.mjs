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
//   RB7  the window: the bar's weight < spring < carry < carry ceiling, at equal ratio margins.
//        CONTROL: a bar thick enough to outweigh the span closes it
//   RB8  released, the bar lets go of a positive crown-side drag (reported)
//   RB9  a fork of the centre distance re-derives every row. CONTROL: out of reach, the bar refuses
import { solveRockingBar, ROCKING_BAR_INPUTS } from '../src/keyless-rocking-bar.js';
import { CLEAR_MARGIN } from '../src/layout.js';

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
  const ordered = W.Mg_Nmm < W.Ms_Nmm && W.Ms_Nmm < W.Mf_Nmm && W.Mf_Nmm < W.MfMax_Nmm;
  const equal = Math.abs(W.Ms_Nmm / W.Mg_Nmm - W.q) < 1e-9 * W.q && Math.abs(W.Mf_Nmm / W.Ms_Nmm - W.q) < 1e-9 * W.q && Math.abs(W.MfMax_Nmm / W.Mf_Nmm - W.q) < 1e-9 * W.q;
  ok(`[${v}] RB7 weight < spring < carry < ceiling, equal ratio margins`, ordered && equal && W.q > 1,
    `${f(W.Mg_Nmm)} < ${f(W.Ms_Nmm)} < ${f(W.Mf_Nmm)} < ${f(W.MfMax_Nmm)} N·mm, each ×${f(W.q, 3)}`);
  // the window spans q³ from weight to ceiling, and weight goes with thickness while the ceiling does not
  const thick = 1.1 * Math.pow(W.q, 3);
  const heavy = solveRockingBar(v, { stock_u: thick * ROCKING_BAR_INPUTS.stock_u.v });
  ok(`[${v}] RB7 CONTROL a bar ${thick.toFixed(0)}× thicker (just past the window's span) has none`, heavy.window.q <= 1, `q ${f(heavy.window.q, 3)}`);

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
