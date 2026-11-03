// §329 landing 3 (option B) — HOLD THE GENEVA STOP-WORK'S LINE SPEC (src/stopwork-arrest.js). ACCEPTANCE: exits non-zero on any failure.
// Pure Node, no browser: the line is movement-independent, so it is judged in free space.
//   node tools/probe-329b-stopwork-line.mjs
// Each row says what it holds and carries a CONTROL that must fail:
//   G  geometry: r1 = a·sin(π/n) makes the pin enter every slot ALONG it (alignment 1), the star turning ±π/n across the engagement
//      control: a pin radius 5% off the law enters across the slot (alignment under 1)
//   Q  the count: a discrete simulation of the star (forward and backward passages, closed slots stopping) gives the closed form's
//      travel, (m + 1)·2π − E, and exactly m passages between the stops
//      control: a star with NO closed slot never stops, so the simulation cannot agree
//   T  the wind: at the default reserve (30 h → 1.75 turns) the fewest-trim stop-work is n = 4, m = 1 with ZERO trim; across the reserve
//      range every T it covers is reached with trim inside the stop face's reach, and the ones it cannot reach are REPORTED
//      control: a travel SHORT of the wind (T above every candidate) is refused, never rounded down
//   F  floors: the lock disc has a window (it reaches the star's tip circle and clears the slots), the slots' inner end leaves a hub
//      control: a pin radius that leaves no window is refused by the same predicate
import { TRAIN, SPEC } from '../src/layout.js';
import { STOCK_MIN_U, PIVOT_MIN_U } from '../src/layout.js';
import { genevaDims, engagementArc, travelTurns, trimMax, chooseStopwork, floorsHold, simulateStops, entryAlignment, starAngle, TAU } from '../src/stopwork-arrest.js';

let fails = 0;
const row = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); if (!ok) fails++; };
const control = (name, fired, detail) => { console.log(`${fired ? 'ok  ' : 'FAIL'}  control ${name} — ${detail}`); if (!fired) fails++; };
const f3 = (v) => v.toFixed(3);

const R1 = 4.214;   // the pin's orbit: the lug's, windArrest.lugOuter on the lands preview (4.214); the line holds for any r1, three are run below

// G
let gOk = true, gWorst = 0;
for (const n of [3, 4, 5, 6, 8]) for (const r1 of [2.5, R1, 5]) {
  const al = entryAlignment(n, r1), E = engagementArc(n);
  const dAng = Math.max(Math.abs(starAngle(n, r1, -E / 2, undefined) + Math.PI / n), Math.abs(starAngle(n, r1, E / 2) - Math.PI / n));
  gWorst = Math.max(gWorst, 1 - al, dAng); if (!(1 - al < 1e-12 && dAng < 1e-12)) gOk = false;
}
row('G geometry', gOk, `alignment 1 and star turn ±π/n over n 3..8, r1 2.5/${R1}/5: worst departure ${gWorst.toExponential(2)}`);
{ const n = 4, a = R1 / Math.sin(Math.PI / n), bad = entryAlignment(n, R1 * 1.05, a);
  control('G', bad < 1 - 1e-4, `a pin radius 5% over the law enters at alignment ${bad.toFixed(5)}`); }

// Q
let qOk = true, qDetail = [];
for (const [m, n] of [[1, 3], [1, 4], [2, 4], [2, 5], [3, 6]]) {
  const s = simulateStops(m, n), closed = travelTurns(m, n) * TAU;
  const ok = s.passages === m && s.lowerBlocked && s.upperBlocked && Math.abs(s.travel - closed) < 1e-9; if (!ok) qOk = false;
  qDetail.push(`(${m},${n}): ${s.passages} passages, ${f3(s.travel / TAU)} turns`);
}
row('Q count', qOk, qDetail.join('; '));
{ const s = simulateStops(3, 3); control('Q', !(s.passages === 3 && s.upperBlocked), `a star with no closed slot is never stopped (${s.passages} passages, stopped ${s.upperBlocked})`); }

// T
const T0 = SPEC.reserveHours / (TRAIN.barrel.teeth / TRAIN.barrel.pinion);
const c0 = chooseStopwork(T0, R1);
row('T default wind', !!c0 && c0.n === 4 && c0.m === 1 && Math.abs(c0.trim) < 1e-12 && Math.abs(T0 - 1.75) < 1e-9,
  `reserve ${SPEC.reserveHours} h = ${f3(T0)} turns → n ${c0?.n}, m ${c0?.m}, ${c0?.c} closed, travel ${c0 && f3(c0.travel)} turns, trim ${c0 && c0.trim.toExponential(1)}; a ${c0 && f3(c0.a)} centre distance, pin ${c0 && f3(c0.r1)}, star tip ${c0 && f3(c0.rTip)}`);
const cover = [];
for (let h = 12; h <= 48; h += 3) { const T = h / (TRAIN.barrel.teeth / TRAIN.barrel.pinion), c = chooseStopwork(T, R1); cover.push({ h, T, c }); }
console.log('reserve range (hours → turns → choice):');
for (const { h, T, c } of cover) console.log(`  ${String(h).padStart(2)} h  ${f3(T)}  ${c ? `n ${c.n} m ${c.m} trim ${f3(c.trim)} (reach ${f3(trimMax(c.n, R1))})` : 'NOT REACHABLE by a stop-work alone'}`);
control('T', chooseStopwork(9, R1) === null && chooseStopwork(T0 + 1e-3, R1) === null, 'a wind of 9 turns, and one a hair (0.001) over the default, are refused — a travel short of the wind is never rounded down');

// F
let fOk = true, fDetail = '';
for (const n of [4, 5, 6, 8, 12]) { const d = genevaDims(n, R1); const ok = floorsHold(d); if (!ok) fOk = false; fDetail += `n${n}: lock ${f3(d.lockLo)}..${f3(d.lockHi)}, slot inner ${f3(d.rIn)}; `; }
row('F floors', fOk, fDetail);
{ const d = genevaDims(3, R1); control('F3', !floorsHold(d), `n = 3 leaves the slots' inner end at ${f3(d.rIn)}, under a hub (${f3(PIVOT_MIN_U + STOCK_MIN_U)}) — refused, which is why the 48 h reserve is not covered`); }
{ const d = genevaDims(4, 0.6); control('F', !(d.lockLo <= d.lockHi && d.rIn >= PIVOT_MIN_U + STOCK_MIN_U), `a pin orbit of 0.6 leaves lock ${f3(d.lockLo)}..${f3(d.lockHi)}, slot inner ${f3(d.rIn)} — refused`); }

console.log(fails ? `\nFAIL — ${fails} row(s) or control(s)` : '\nPASS — the stop-work line holds, every control fired');
process.exit(fails ? 1 : 0);
