// DOES A PARALLEL TWIN BARREL HOLD THE SINGLE DRUM'S ENERGY IN A SMALLER CHAIN DRUM, and which pair? Acceptance (BACKLOG
// §339 landing 1, the twin's line spec in free space; src/twin-barrel.js is the module it holds).
//
//   node tools/probe-twin-barrel.mjs          (exit 1 on any failed row)
//
// It boots TWO builds and does everything else in Node, through the build's own ribbon solve (src/ribbon-solve.js):
//   - the round default, for the inputs it must never type (the hook's set-up and sweep, the ribbon's half-height, and
//     the record's k, section and collar), and
//   - the target build `alarm=0&case=fitted` (§339: the width case holds only without the alarm), for the drum's
//     direction, its excursion past the rest of the counted metal on its worst side, and the largest free disc over
//     its band (tools/probe-twin-barrel-room.mjs' measurement, imported, not copied).
//
// Rows, each with its control:
//   1. REFERENCE: the pure solve at today's drum reproduces the booted record (k, half-thickness, length, collar) to
//      1e-12. Control: the same solve at a drum 0.01 smaller must NOT reproduce it.
//   2. THE PAIR, by a stated rule: the smallest chain drum R_A (a 0.25 grid refined to 0.05; the code says how) for which some drum B no larger than
//      the target build's free disc stores at least the single drum's energy; then the R_B storing most. Its rows:
//      the hook's law linear over the service band to 1e-12, each ribbon at r/e ≥ MAINSPRING_ALPHA_MIN and on the
//      stress limit at full wind, and the energy at least the single drum's.
//   3. SERIES CONTROL: two drums of today's size in series store less than the same two in parallel (§339's choice).
// REPORTED, not gated: the width the pair could give back on the target build (twice R_A's shrink along the drum's
// direction, capped at the drum's excursion; an ESTIMATE that landing 2's re-fit measures), the energy-maximum pair
// under the same disc (what TODO 292 would want), and B's ratio n.
import { bootMany } from './boot-pool.mjs';
import { EXPR as ROOM_EXPR } from './probe-twin-barrel-room.mjs';
import { drumRibbon, parallelTwin, seriesTwin } from '../src/twin-barrel.js';
import { MAINSPRING_ALPHA_MIN, MAINSPRING_SIGMA_Y_PA } from '../src/layout.js';

const REF_EXPR = `(() => { const g = window.__clock.equalisation.going;
  return { k: g.k_Nm_per_rad, wind: g.windRangeRad, section: g.section, devLen: g.devLen_u, packing: g.packing,
    drumR: window.__clock.drum.reachR }; })()`;
const TARGET = 'alarm=0&case=fitted';
const [[ref], [tgt]] = await Promise.all([
  bootMany([''], `({ ref: ${REF_EXPR} })`),
  bootMany([TARGET], `({ room: ${ROOM_EXPR} })`),   // an alarm-free build publishes no equalisation record
]);
for (const [q, r] of [['(default)', ref], [TARGET, tgt]]) {
  if (r.unknownKeys?.length || r.bootError || !r.extra) { console.log(`FAIL boot ${q}: ${r.bootError ?? 'unknown keys ' + r.unknownKeys}`); process.exit(1); }
}
const R0 = ref.extra.ref;
const setup = R0.wind[0], sweep = R0.wind[1] - R0.wind[0], c = R0.section.c;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
let fail = 0;
const row = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`); if (!ok) fail++; };

// 1. REFERENCE (today's drum: the record's packing names its collar; its radius is the drum the build cut)
const RA0 = 10.71;   // DRUM_R_ACTUAL — checked, not trusted: row 1 fails if it is not the drum the record was solved in
const S = drumRibbon({ R: RA0, c, setup, sweep });
const same = (x) => x && rel(x.k, R0.k) <= 1e-12 && rel(x.a, R0.section.a) <= 1e-12 && rel(x.L, R0.devLen) <= 1e-12 && rel(x.sol.collarR, R0.packing.collarR) <= 1e-12;
row(same(S), `reference: the pure solve at R ${RA0} reproduces the booted ribbon (k ${S?.k.toExponential(6)} vs ${R0.k.toExponential(6)}, collar ${S?.sol.collarR.toFixed(6)} vs ${R0.packing.collarR.toFixed(6)}), ${(S.energyJ * 1e3).toFixed(4)} mJ`);
row(!same(drumRibbon({ R: RA0 - 0.01, c, setup, sweep })), 'reference control: a drum 0.01 smaller does not reproduce it');

// the target build's space
const room = tgt.extra.room, D = room.reach;
const side = Object.entries(D.excursion).sort((p, q) => q[1] - p[1])[0];   // the drum group's worst side
const discCap = room.free.withDrumA.discs[0].r;
console.log(`target ${TARGET}: the drum group sets ${side[0]} by ${side[1].toFixed(2)} u; the largest free disc beside drum A is r ${discCap.toFixed(2)}`);

// 2. THE PAIR. A ribbon solve costs ~40 ms, so the search runs in two stages: a COARSE 0.25 grid finds the smallest
// R_A whose best B holds the energy, then a FINE 0.05 grid searches the coarse cell just below it (the coil count makes
// energy step-wise in R, so a finer grid can find a smaller R_A the coarse one stepped over). B runs over its whole
// range at the stage's step. The energy-maximum pair is the coarse stage's.
const grid = (lo, hi, step) => { const out = []; for (let x = hi; x >= lo - 1e-9; x -= step) out.push(+x.toFixed(2)); return out; };
const bestB = (RA, step) => {
  let b = null;
  for (const RB of grid(3, discCap, step)) { const P = parallelTwin({ RA, RB, c, setup, sweep }); if (P.feasible && (!b || P.energyJ > b.energyJ)) b = P; }
  return b;
};
// the solve warns on a candidate it cannot place (the build's rule 6); in a SEARCH that is the expected answer for most
// candidates, so the scan counts those warnings instead of printing them
const warn0 = console.warn; let refused = 0;
console.warn = (m, ...r) => (String(m).startsWith('TODO 291: no whole number') ? refused++ : warn0(m, ...r));
let pick = null, maxE = null;
for (const RA of grid(3, RA0, 0.25)) {
  const b = bestB(RA, 0.25);
  if (!b) continue;
  if (!maxE || b.energyJ > maxE.energyJ) maxE = b;
  if (b.energyJ >= S.energyJ) pick = b;   // the grid runs downward, so the last that holds is the smallest R_A
}
if (pick) for (const RA of grid(pick.RA - 0.25 + 0.05, pick.RA, 0.05)) {
  const b = bestB(RA, 0.05);
  if (b && b.energyJ >= S.energyJ && b.RA <= pick.RA && (b.RA < pick.RA || b.energyJ > pick.energyJ)) pick = b;
}
console.warn = warn0;
console.log(`search: ${refused} candidate drum(s) had no ribbon at r/e ≥ ${MAINSPRING_ALPHA_MIN} that fits and takes its wind`);
if (!pick) { row(false, 'no pair under the disc holds the single drum\'s energy'); process.exit(1); }
const pct = (P) => ((P.energyJ / S.energyJ) * 100).toFixed(1);
console.log(`pair: R_A ${pick.RA}, R_B ${pick.RB}, n ${pick.n.toFixed(4)}, centre distance ${pick.centreDistance.toFixed(2)} — ${pct(pick)}% of the single drum's energy, k at the hook ${pick.kHook.toExponential(4)} N·m/rad`);
for (const [nm, X] of [['A', pick.A], ['B', pick.B]])
  console.log(`  drum ${nm}: R ${X.R}, ${X.sol.coils} coils on a ${X.sol.collarR.toFixed(3)} collar, e ${(2 * X.a).toFixed(4)} u, L ${X.L.toFixed(1)}, α ${X.alpha.toFixed(2)}, binds ${X.sol.binds}, ${(X.energyJ * 1e3).toFixed(3)} mJ`);
row(pick.lawDev <= 1e-12, `the hook's law is linear over the service band (max deviation ${pick.lawDev.toExponential(2)})`);
row(pick.A.alpha >= MAINSPRING_ALPHA_MIN && pick.B.alpha >= MAINSPRING_ALPHA_MIN, `both ribbons at r/e ≥ ${MAINSPRING_ALPHA_MIN} (A ${pick.A.alpha.toFixed(2)}, B ${pick.B.alpha.toFixed(2)})`);
row(rel(pick.A.sigmaFull, MAINSPRING_SIGMA_Y_PA) <= 1e-9 && rel(pick.B.sigmaFull, MAINSPRING_SIGMA_Y_PA) <= 1e-9, `both ribbons on the stress limit at full wind (A ${(pick.A.sigmaFull / 1e6).toFixed(1)}, B ${(pick.B.sigmaFull / 1e6).toFixed(1)} MPa)`);
row(pick.energyJ >= S.energyJ, `the pair stores at least the single drum's energy (${pct(pick)}%)`);

// 3. SERIES CONTROL
const Pp = parallelTwin({ RA: RA0, RB: RA0, c, setup, sweep }), Ps = seriesTwin({ R: RA0, c, setup, sweep });
row(Ps.feasible && Pp.feasible && Ps.energyJ < Pp.energyJ, `series control: two ${RA0} drums store ${pct(Ps)}% in series against ${pct(Pp)}% in parallel (series ribbons α ${Ps.each?.alpha.toFixed(2)}, parallel ${Pp.A?.alpha.toFixed(2)})`);

// REPORTED
// shrinking R_A by ΔR moves drum A's centre ΔR in along its direction (FUSEE_DRUM_DIST = FUSEE_R_LARGE + R + 2.5) and
// its far edge 2ΔR, which the side's axis sees through the direction's component on it
const axis = side[0].endsWith('y') ? Math.abs(room.reach.drumDir[1]) : Math.abs(room.reach.drumDir[0]);
const giveBack = Math.min(Math.max(side[1], 0), 2 * (RA0 - pick.RA) * axis);
console.log(`REPORT width the pair could give back on ${side[0]} of ${TARGET}: ≤ ${giveBack.toFixed(2)} u (${(giveBack * 0.379).toFixed(2)} mm) — twice R_A's ${(RA0 - pick.RA).toFixed(2)} shrink along the drum's direction (×${axis.toFixed(4)} on that axis), capped at the excursion; an estimate landing 2's re-fit measures`);
console.log(`REPORT the energy-maximum pair under the same disc: R_A ${maxE.RA}, R_B ${maxE.RB} — ${pct(maxE)}% (what TODO 292's fast rates would want)`);
process.exit(fail ? 1 : 0);
