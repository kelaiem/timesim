// A CHAIN PULLEY AND ONE BARREL: does a springless chain drum geared to one barrel in the free disc hold the single
// drum's energy, and at what pulley? Acceptance (BACKLOG §339 landing 2a', the owner's choice 2026-11-08 over the twin as
// landing 1 specified it; src/twin-barrel.js' pulleyBarrel is the line spec it holds).
//
//   node tools/probe-pulley-barrel.mjs [--cache FILE]   (exit 1 on any failed row; --cache keeps the two boots' reads;
//                                                        ~7 min, nearly all of it the ~10,000 geometries under the pick)
//
// Landing 2a found the chain drum's angles scale as 1/R_wrap (the chain coils on it), so a small chain drum's own spring
// stores little: the twin's drum A held 1.8 of 22 mJ. So drum A carries no spring here, and the set-up is the barrel's.
// The design's integers are (zA, zB, NB): A's and B's teeth on their walls, and B's set-up clicks on the build's set-up
// ratchet. The cone is held the SAME cone (θ_s·R_wrap,A = θ_s₀·R_wrap₀), which fixes the module, and with it both radii.
//
// It boots TWO builds (tools/probe-twin-barrel.mjs' pair: the round default for the record's laws, and
// `alarm=0&case=fitted` for the free disc) and does everything else in Node, through the build's own solves.
// Rows, each with its control:
//   1. REFERENCE: the ribbon solve and the fusee solve, re-run from the booted inputs, reproduce the record to the bit
//      (ribbon to 1e-12). Controls: a drum 0.01 smaller reproduces neither.
//   2. THE PICK, by a stated rule: over every reduced ratio n = p/q (q ≤ 60) and B's set-up clicks, the geometry the
//      invariant fixes (R_A = Q·n/θ_sB − c_end, the flange's pitch r_pA = R_A + 2·c_end + CLEAR_MARGIN, R_B = r_pA/n)
//      that passes the floors —
//        B's tooth tips (R_B + m) inside the target build's free disc;
//        A's chain no tighter than the cone's own smallest wrap (R_A + c_end ≥ P/u(1), a bend the chain already takes);
//        a module m ≥ MODULE_MIN_U (§50's floor) with at least CENTRE_PINION_LEAVES teeth on A, the module the one of
//          those nearest the great wheel's (TRAIN.barrel.module, the mesh carrying the same torque class);
//      — the smallest R_A whose barrel drives the train at least as hard as today's drum (the fusee's level torque
//      k_hook·P/R_wrap ≥ k₀·P₀/R_wrap₀), and of those the one nearest today's, so the balance, its rim and the
//      amplitude rows (TODO 207, solved at today's drive) are not re-opened by a stronger spring. Then B's ribbon
//      height is cut to the train's demand (k ∝ c at a fixed stress), so the drive is today's to float noise.
//      Its rows: the cone invariant to 1e-12, the hook's law proportional to 1e-12, the ribbon at r/e ≥ the floor and on
//      the stress limit at full wind, and the energy at least the single drum's.
//   3. CONTROL for the invariant: the same integers on a pulley 1% larger break it.
// REPORTED: the width estimate.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMany } from './boot-pool.mjs';
import { EXPR as ROOM_EXPR } from './probe-twin-barrel-room.mjs';
import { drumRibbon, chainDrumAngles, chainDrumAnglesAt, pickPulleyBarrel } from '../src/twin-barrel.js';
import { MAINSPRING_ALPHA_MIN, MAINSPRING_SIGMA_Y_PA, PULLEY_BARREL, TRAIN } from '../src/layout.js';
import { installDetMath } from '../src/det-math.js';
// the build computes with the repository's maths (§338 landing 2), so the pure solves here must too: a row that
// holds Node's solve to the booted record to the bit is otherwise comparing two engines' last ulps
installDetMath(Math);

const ci = process.argv.indexOf('--cache'), cache = ci >= 0 ? process.argv[ci + 1] : null;
const REF_EXPR = `(() => { const g = window.__clock.equalisation.going;
  return { k: g.k_Nm_per_rad, wind: g.windRangeRad, section: g.section, devLen: g.devLen_u, packing: g.packing,
    fw: window.__clock.fuseeWind }; })()`;
const TARGET = 'alarm=0&case=fitted';
let boots;
if (cache && existsSync(cache)) boots = JSON.parse(readFileSync(cache, 'utf8'));
else {
  const [[ref], [tgt]] = await Promise.all([bootMany([''], `({ ref: ${REF_EXPR} })`), bootMany([TARGET], `({ room: ${ROOM_EXPR} })`)]);
  for (const [q, r] of [['(default)', ref], [TARGET, tgt]])
    if (r.unknownKeys?.length || r.bootError || !r.extra) { console.log(`FAIL boot ${q}: ${r.bootError ?? 'unknown keys ' + r.unknownKeys}`); process.exit(1); }
  boots = { ref: ref.extra.ref, room: tgt.extra.room };
  if (cache) writeFileSync(cache, JSON.stringify(boots));
}
const R0 = boots.ref, fw = R0.fw, room = boots.room;
const setup = R0.wind[0], sweep = R0.wind[1] - R0.wind[0], c = R0.section.c;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
let fail = 0;
const row = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`); if (!ok) fail++; };

// 1. REFERENCE
const RA0 = 10.71;   // DRUM_R_ACTUAL — checked, not trusted: both rows fail if it is not the drum the record was solved in
const S = drumRibbon({ R: RA0, c, setup, sweep });
const same = (x) => x && rel(x.k, R0.k) <= 1e-12 && rel(x.a, R0.section.a) <= 1e-12 && rel(x.L, R0.devLen) <= 1e-12 && rel(x.sol.collarR, R0.packing.collarR) <= 1e-12;
row(same(S), `reference: the ribbon solve at R ${RA0} reproduces the booted ribbon (k ${S?.k.toExponential(6)}), ${(S.energyJ * 1e3).toFixed(4)} mJ`);
row(!same(drumRibbon({ R: RA0 - 0.01, c, setup, sweep })), 'reference control: a drum 0.01 smaller does not reproduce it');
const A0 = chainDrumAngles({ R: RA0, clicks: fw.setupClicks, fw });
row(A0.full === fw.full && A0.full === R0.wind[1], `reference: the fusee solve at R ${RA0}, ${fw.setupClicks} clicks reproduces the full wind to the bit (${A0.full})`);
row(chainDrumAngles({ R: RA0 - 0.01, clicks: fw.setupClicks, fw }).full !== fw.full, 'reference control: at a drum 0.01 smaller it does not');

// the target build's space
const discCap = room.free.withDrumA.discs[0].r;
const side = Object.entries(room.reach.excursion).sort((p, q) => q[1] - p[1])[0];
console.log(`target ${TARGET}: the drum sets ${side[0]} by ${side[1].toFixed(2)} u; the largest free disc beside drum A is r ${discCap.toFixed(2)}`);

// 2. THE PICK (twin-barrel.js' pickPulleyBarrel: the rule lives with the line spec, and layout.js DECLARES its answer)
const warn0 = console.warn; let refused = 0;
console.warn = (m, ...r) => (String(m).startsWith('TODO 291: no whole number') ? refused++ : warn0(m, ...r));
const { pick, full, tried, candidates, rMin, trainOf } = pickPulleyBarrel({ fw, k0: R0.k, c, discCap });
console.warn = warn0;
console.log(`candidates: ${candidates.count} geometries pass the floors (R_A ${candidates.raMin?.toFixed(3)}–${candidates.raMax?.toFixed(3)}); the cone's smallest wrap r ${rMin.toFixed(4)}`);
console.log(`search: ${tried} geometries solved, ${refused} with no ribbon at r/e ≥ ${MAINSPRING_ALPHA_MIN} that fits and takes its wind`);
if (!pick) { row(false, 'no pulley and barrel under the disc holds the single drum\'s energy'); process.exit(1); }
const pct = (E) => ((E / S.energyJ) * 100).toFixed(1);
console.log(`pick: zA ${pick.zA}, zB ${pick.zB} (n ${pick.n.toFixed(4)}), module ${pick.m.toFixed(4)} (great wheel ${TRAIN.barrel.module.toFixed(4)}), B's set-up ${pick.NB} clicks of ${fw.setupTeeth}`);
console.log(`  pulley A: R ${pick.RA.toFixed(4)}, flange pitch r ${pick.rpA.toFixed(4)} (wrap ${pick.chain.Rw.toFixed(4)}, ρ ${pick.chain.rho.toFixed(4)}), centre ${pick.chain.D.toFixed(4)} from the fusee; the hook winds ${pick.chain.setup.toFixed(4)} → ${pick.chain.full.toFixed(4)} rad (${(pick.chain.sweep / (2 * Math.PI)).toFixed(3)} turns of chain on A)`);
console.log(`  barrel B: R ${pick.RB.toFixed(4)}, ${pick.B.sol.coils} coils on a ${pick.B.sol.collarR.toFixed(3)} collar, e ${(2 * pick.B.a).toFixed(4)} u, L ${pick.B.L.toFixed(1)}, binds ${pick.B.sol.binds}, winds ${pick.setupB.toFixed(4)} → ${(pick.setupB + pick.n * pick.chain.sweep).toFixed(4)} rad; centre distance ${pick.centreDistance.toFixed(3)}`);
row(pick.zA === PULLEY_BARREL.zA && pick.zB === PULLEY_BARREL.zB && pick.NB === PULLEY_BARREL.NB, `the declared PULLEY_BARREL (layout.js) is the rule's answer: zA ${PULLEY_BARREL.zA}, zB ${PULLEY_BARREL.zB}, NB ${PULLEY_BARREL.NB}`);
row(Math.abs(pick.invariant) <= 1e-12, `the cone's invariant θ_s·R_wrap = θ_s₀·R_wrap₀ holds (${pick.invariant.toExponential(2)})`);
row(pick.lawDev <= 1e-12, `the hook's law is proportional over the service band (max deviation ${pick.lawDev.toExponential(2)})`);
row(pick.B.alpha >= MAINSPRING_ALPHA_MIN, `the ribbon at r/e ≥ ${MAINSPRING_ALPHA_MIN} (${pick.B.alpha.toFixed(2)})`);
row(rel(pick.B.sigmaFull, MAINSPRING_SIGMA_Y_PA) <= 1e-9, `the ribbon on the stress limit at full wind (${(pick.B.sigmaFull / 1e6).toFixed(1)} MPa)`);
row(pick.energyJ >= S.energyJ, `the barrel stores at least the single drum's energy (${pct(pick.energyJ)}%, ${(pick.energyJ * 1e3).toFixed(3)} mJ)`);

// 3. CONTROL: the invariant must read a wrong pulley
{
  const Q = fw.inputs.SETUP_SWEEP * fw.inputs.DRUM_WRAP_R;
  const RA = pick.RA * 1.01;
  const ch = chainDrumAnglesAt({ R: RA, setup: pick.setupB / pick.n, fw });
  const inv = (ch.setup * ch.Rw) / Q - 1;
  row(Math.abs(inv) > 1e-6, `invariant control: the same integers on a pulley 1% larger read ${inv.toExponential(2)}`);
}

// REPORTED
row(Math.abs(trainOf(pick) - 1) <= 1e-12, `the train's torque is today's: ${(trainOf(pick) * 100).toFixed(6)}% (k_hook·P/R_wrap; ${(trainOf(full) * 100).toFixed(2)}% at the drum's full height, B's ribbon ${(pick.cB * 2).toFixed(4)} u tall against ${(c * 2).toFixed(4)})`);
const axis = side[0].endsWith('y') ? Math.abs(room.reach.drumDir[1]) : Math.abs(room.reach.drumDir[0]);
const giveBack = Math.min(Math.max(side[1], 0), 2 * (RA0 - pick.RA) * axis);
console.log(`REPORT width the pulley could give back on ${side[0]} of ${TARGET}: ≤ ${giveBack.toFixed(2)} u (${(giveBack * 0.379).toFixed(2)} mm), an estimate the fold's re-fit measures; B's own placement is the fold's`);
process.exit(fail ? 1 : 0);
