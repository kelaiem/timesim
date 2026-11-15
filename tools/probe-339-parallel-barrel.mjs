// §339 landing 3b — THE PARALLEL SECOND BARREL'S LINE SPEC: does the declared PARALLEL_BARREL (layout.js) re-derive
// from its stated rule, hold its laws, and have a seat on the build it is declared for? Acceptance.
//
//   node tools/probe-339-parallel-barrel.mjs [--cache FILE]          (exit 1 on any failed row)
//
// It boots the round default (the reference record: today's ribbon, its two wind angles, the fusee's wind record) and
// the declared seat's build (PARALLEL_BARREL.seatSpec, the round alarm-free one), and does everything else in Node,
// through the build's own ribbon solve (src/twin-barrel.js → src/ribbon-solve.js) and the seat law
// (tools/second-barrel-seats.mjs, the one copy tools/probe-339-second-barrel.mjs reads too). Rows, each with a control:
//   1. REFERENCE: today's drum (R 10.71) through the pure solve reproduces the booted ribbon to 1e-12; a drum 0.01
//      smaller does not.
//   2. THE PICK: pickParallelBarrel's rule (the smallest B whose power multiple at the same reserve reaches
//      POWER_TARGET) reproduces the declared integers. Control: every candidate with a smaller B falls short of it.
//   3. THE LAWS of the pick: the hook's law linear over A's own angles to 1e-12; n = zA/zB = NB/clicks_A exactly
//      (B's set-up a whole number of clicks); both ribbons at r/e ≥ MAINSPRING_ALPHA_MIN and on the stress limit at full
//      wind, never over it; the module at or over MODULE_MIN_U; the multiple at or over the target.
//   4. THE SEAT: on the seat's build, drum A stands at the build's own centre (float noise), and the declared azimuth
//      is a seat (B's wall over the drum band's field, its tips over the coupling band's, both sides of the span clear)
//      and the widest of them. Control: B one unit larger at the same azimuth is no seat, or the field read nothing.
// Moving parts are read at rest, so the seat is a CANDIDATE for the fold's sweeps; this probe places no metal.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMany } from './boot-pool.mjs';
import { EXPR as ROOM_EXPR } from './probe-twin-barrel-room.mjs';
import { seatField, bootExpr, REF_EXPR } from './second-barrel-seats.mjs';
import { drumRibbon, pickParallelBarrel, parallelBarrel, POWER_TARGET } from '../src/twin-barrel.js';
import { MODULE_MIN_U } from '../src/geared-geneva.js';
import { PARALLEL_BARREL, MAINSPRING_ALPHA_MIN, MAINSPRING_SIGMA_Y_PA } from '../src/layout.js';
import { installDetMath } from '../src/det-math.js';
installDetMath(Math);   // the pure solves read the repository's maths, as the build does (§338 landing 2)

const argOf = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const cache = argOf('--cache'), SEAT = PARALLEL_BARREL.seatSpec;
let boots;
if (cache && existsSync(cache)) boots = JSON.parse(readFileSync(cache, 'utf8'));
else {
  const [[ref], [tgt]] = await Promise.all([bootMany([''], `({ ref: ${REF_EXPR} })`), bootMany([SEAT], bootExpr(ROOM_EXPR))]);
  for (const [q, r] of [['(default)', ref], [SEAT, tgt]])
    if (r.unknownKeys?.length || r.bootError || !r.extra) { console.log(`FAIL boot ${q}: ${r.bootError ?? 'unknown keys ' + r.unknownKeys}`); process.exit(1); }
  boots = { ref: ref.extra.ref, room: tgt.extra.room };
  if (cache) writeFileSync(cache, JSON.stringify(boots));
}
let fail = 0;
const row = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
const f = (x, d = 3) => (+x).toFixed(d), rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const R0 = boots.ref, fw = R0.fw, c = R0.section.c, setup = R0.wind[0], sweep = R0.wind[1] - R0.wind[0];

// 1. REFERENCE
const RA = 10.71;   // DRUM_R_ACTUAL — checked, not trusted
const same = (x) => x && rel(x.k, R0.k) <= 1e-12 && rel(x.a, R0.section.a) <= 1e-12 && rel(x.L, R0.devLen) <= 1e-12;
row(same(drumRibbon({ R: RA, c, setup, sweep })), `1. reference: the pure solve at R ${RA} reproduces the booted ribbon (k ${R0.k.toExponential(6)})`);
row(!same(drumRibbon({ R: RA - 0.01, c, setup, sweep })), '1. control: a drum 0.01 smaller does not');

// 2. THE PICK
const { pick, candidates } = pickParallelBarrel({ fw, c, RA, setup, sweep });
const D = PARALLEL_BARREL;
row(!!pick && pick.NB === D.NB && pick.zA === D.zA && pick.zB === D.zB,
  `2. the rule (the smallest B reaching ×${POWER_TARGET}) reproduces PARALLEL_BARREL ${D.NB} clicks, ${D.zA}:${D.zB}${pick ? ` (got ${pick.NB}, ${pick.zA}:${pick.zB}: R_B ${f(pick.RB)}, ×${f(pick.mult, 4)})` : ' (got none)'}`);
const smaller = candidates.filter((x) => pick && x.RB < pick.RB - 1e-9);
row(smaller.length > 0 && smaller.every((x) => x.mult < POWER_TARGET),
  `2. control: all ${smaller.length} smaller candidates fall short of ×${POWER_TARGET} (the nearest, R_B ${smaller.length ? f(Math.max(...smaller.map((x) => x.RB))) : '—'}, ×${smaller.length ? f(smaller.reduce((a, x) => (x.RB > a.RB ? x : a)).mult, 4) : '—'})`);

// 3. THE LAWS
const X = parallelBarrel({ NB: D.NB, zA: D.zA, zB: D.zB, fw, c, RA, setup, sweep });
row(X.feasible && X.lawDev <= 1e-12, `3. the hook's law (k_A + n²·k_B)·θ linear to ${X.lawDev?.toExponential(1)} over A's own angles`);
row(X.feasible && Math.abs(X.n - D.NB / fw.setupClicks) <= 1e-12 && Number.isInteger(D.NB),
  `3. n = zA/zB = ${f(X.n, 6)} = NB/clicks_A ${D.NB}/${fw.setupClicks}: B's set-up is a whole number of clicks`);
for (const [tag, Rb] of [['A', X.A], ['B', X.B]])
  row(!!Rb && Rb.alpha >= MAINSPRING_ALPHA_MIN - 1e-9 && Rb.sigmaFull <= MAINSPRING_SIGMA_Y_PA * (1 + 1e-9) && Rb.sigmaFull >= MAINSPRING_SIGMA_Y_PA * (1 - 1e-6),
    `3. ribbon ${tag}: r/e ${Rb ? f(Rb.alpha, 2) : '—'} ≥ ${MAINSPRING_ALPHA_MIN}, σ at full wind ${Rb ? f(Rb.sigmaFull / 1e6, 1) : '—'} MPa on the ${MAINSPRING_SIGMA_Y_PA / 1e6} MPa limit, ${Rb?.sol?.coils} coils`);
row(X.m >= MODULE_MIN_U, `3. module ${f(X.m, 4)} ≥ §50's floor ${f(MODULE_MIN_U, 4)}`);
row(X.mult >= POWER_TARGET, `3. power at the same reserve ×${f(X.mult, 4)} ≥ ×${POWER_TARGET} (E_A ${f(X.A.energyJ * 1e3)} + E_B ${f(X.B.energyJ * 1e3)} mJ)`);

// 4. THE SEAT
const F = seatField({ room: boots.room, fw, RA, rpA: X.rpA });
row(F.centreOff <= 1e-6, `4. on ${SEAT}, drum A stands at the build's own centre (off by ${F.centreOff.toExponential(1)})`);
const seats = F.seatsAt(X.RB, X.m), here = F.marginAt(X.RB, X.m, D.barrelAzDeg);
const widest = seats.reduce((a, s) => (!a || s.margin > a.margin ? s : a), null);
row(here.margin >= 0 && widest && Math.abs(widest.az - D.barrelAzDeg) < 1e-9,
  `4. the declared ${D.barrelAzDeg}° round A is a seat (margin ${f(here.margin)}) and the widest of ${seats.length} (${seats[0]?.az}°–${seats.at(-1)?.az}°), B at (${f(here.B.x, 2)}, ${f(here.B.y, 2)})`);
row(F.marginAt(X.RB + 1, X.m, D.barrelAzDeg).margin < here.margin - 0.5,
  `4. control: B one unit larger at the same azimuth reads ${f(F.marginAt(X.RB + 1, X.m, D.barrelAzDeg).margin)} (the field moves with the barrel)`);
console.log(`PARALLEL_BARREL: B R ${f(X.RB)}, ${D.zA}:${D.zB} at m ${f(X.m, 4)}, n ${f(X.n, 4)}, centres ${f(X.centreDistance)} apart; power ×${f(X.mult, 4)} at the same reserve; k_hook ${X.kHook.toExponential(4)} N·m/rad`);
process.exit(fail ? 1 : 0);
