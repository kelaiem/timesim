#!/usr/bin/env node
// §337 landing 1 — THE GEARED GENEVA'S LINE, HELD. ACCEPTANCE (exits non-zero on a failure).
//
// src/geared-geneva.js designs, for every reserve the spec offers, a Geneva stop-work whose finger is driven from the
// fusee's cone through a wheel pair (or, where the ratio is exactly one, rides the cone itself: §329's direct stop-work).
// This holds that line, each rule against a reading the line did not make itself:
//   W  every reserve has a line, each at its OWN stall torque: the fusee's level torque, read off a boot of that
//      reserve's default build (__clock.equalisation.going.energy.fuseeTorque_Nm), never the default's carried over;
//   E  EXACT: the finger's travel g·T, with g the two tooth counts' ratio and T the cone's wind, equals the star's
//      m + ½ + 1/n to float noise; and the star's own count, stepped slot by slot (stopwork-arrest.js simulateStops), travels
//      the same turns between its two stops;
//   C  CUTTABLE: the pinion has at least PINION_LEAVES_MIN leaves, the module is the §50 floor (a tooth π·module/2 thick at
//      its pitch line is STOCK_MIN_U), and the cone's wheel's root circle stands a §50 wall outside the cone's arbor
//      (TRAIN_STAFF_R, read from main.js's own text: one source);
//   G  the Geneva's floors hold at its orbit (a lock window, a hub round the star's bore), the star's tips clear the finger's
//      own hub by a margin, and the pin and stud, re-derived here as cantilevers at the line's free length, stand at or under
//      SPRING_SIGMA_Y_PA at the pin's load (stall / g / r1);
//   M  the orbit is the SMALLEST THE LINE MAY TAKE: one step (0.005) in is under the LOCK FLOOR, or fails a Geneva floor,
//      the hub clearance or a stress — and the probe names WHICH, per reserve, so an orbit that stops being the binding
//      floor is visible rather than merely red.
// Controls: a pair one tooth off misses the travel (E); a five-leaf pinion is refused (C); a module under the floor cuts a
// tooth thinner than stock (C); the orbit one step in fails (M).
//
// RULE M WAS STALE FROM §337 landing 2b's LOCK FIX until stage 3, and nothing ran this probe to say so. The fix made
// sizeGeneva start its scan at LOCK_R1_MIN, so the orbit the line takes is the smallest that holds the lock AS WELL as the
// floors — and at every one of the thirteen reserves it is now the lock floor exactly (2.700 at n = 4). M read only the
// floors, so "a step in still holds" was TRUE at all thirteen and this probe exited 1 on main for as long as the fix had
// been in. Stage 3 fixed the rule; the .github/workflows/battery.yml wiring that would keep it from recurring is written
// but NOT LANDED, so until it is, this probe is still a local boot and nothing fails when it goes red.
//   node tools/probe-337-geared-geneva.mjs [--par N]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootMany } from './boot-pool.mjs';
import { chooseGearedStopwork, gearPair, windTurns, lockR1Min, MODULE_MIN_U, DEDENDUM_F, LINE_LAYER_GAP_U } from '../src/geared-geneva.js';
import { simulateStops, travelTurns, genevaDims, floorsHold, PIN_FLOOR_U, STUD_FLOOR_U } from '../src/stopwork-arrest.js';
import { STOCK_MIN_U, PIVOT_MIN_U, CLEAR_MARGIN, PINION_LEAVES_MIN, SPRING_SIGMA_Y_PA, UNIT_MM } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const par = args.includes('--par') ? Number(args[args.indexOf('--par') + 1]) : undefined;
const HOURS = Array.from({ length: 13 }, (_, i) => 12 + 3 * i);
const staffM = /const TRAIN_STAFF_R = ([\d.]+);/.exec(readFileSync(join(ROOT, 'src/main.js'), 'utf8'));
if (!staffM) { console.error('could not read TRAIN_STAFF_R from src/main.js'); process.exit(2); }
const coneBoreR = Number(staffM[1]);

const boots = await bootMany(HOURS.map((h) => `reserveh=${h}`), '(() => window.__clock.equalisation?.going?.energy?.fuseeTorque_Nm ?? null)()', par ? { concurrency: par } : {});
let failed = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => { failed++; console.log(`FAIL  ${m}`); };
const f3 = (x) => x.toFixed(3);
const STEP = 0.005;                      // sizeGeneva's own scan step: what "one step in" means
const bindsAt = [];                      // M: which floor binds each reserve's orbit, so the rule reports and does not merely pass
const sigma = (F, L, r) => (32 * F * L * UNIT_MM) / (Math.PI * (2 * r * UNIT_MM) ** 3);   // N/mm² = MPa
const yieldMPa = SPRING_SIGMA_Y_PA / 1e6;

const lines = [];
for (let i = 0; i < HOURS.length; i++) {
  const h = HOURS[i], tq = boots[i]?.extra;
  if (!(tq > 0)) { fail(`W ${h} h: no stall torque read off its boot (${boots[i]?.bootError ?? 'null'})`); continue; }
  const { best } = chooseGearedStopwork(h, { stallNmm: tq * 1000, coneBoreR });
  if (!best) { fail(`W ${h} h: no line`); continue; }
  lines.push({ h, stallNmm: tq * 1000, b: best });
}
if (lines.length === HOURS.length) pass(`W every reserve has a line at its own stall (${f3(Math.min(...lines.map((l) => l.stallNmm)))}–${f3(Math.max(...lines.map((l) => l.stallNmm)))} N·mm over ${HOURS.length} reserves)`);

console.log('reserve  star     drive          g      r1     reach   pin F    pin r  (governs)');
for (const { h, stallNmm, b } of lines) {
  const g = b.geneva;
  console.log(`  ${String(h).padStart(2)} h  n ${b.n} m ${b.m}  ${b.direct ? 'direct        ' : `${String(b.zCone).padStart(2)} : ${String(b.zFinger).padEnd(2)}       `}  ${f3(b.g)}  ${f3(g.r1)}  ${f3(b.reach).padStart(6)}  ${f3(g.F)} N  ${f3(g.rPin)} (${g.governs.pin})`);
  // E
  const fingerTravel = b.g * windTurns(h), star = travelTurns(b.m, b.n), sim = simulateStops(b.m, b.n).travel / (2 * Math.PI);
  if (!(Math.abs(fingerTravel - star) < 1e-9 && Math.abs(sim - star) < 1e-9)) fail(`E ${h} h: finger ${fingerTravel} against star ${star} (simulated ${sim})`);
  // C
  if (!b.direct) {
    const rootR = (b.module * b.zCone) / 2 - DEDENDUM_F * b.module;
    if (!(Math.min(b.zCone, b.zFinger) >= PINION_LEAVES_MIN && Math.abs(b.module - (2 * STOCK_MIN_U) / Math.PI) < 1e-12 && rootR >= coneBoreR + STOCK_MIN_U - 1e-12))
      fail(`C ${h} h: ${b.zCone}:${b.zFinger} at module ${b.module}, root ${f3(rootR)} against the bore ${coneBoreR} + wall`);
  }
  // G
  const L = LINE_LAYER_GAP_U + STOCK_MIN_U / 2, hubR = PIVOT_MIN_U + STOCK_MIN_U, F = stallNmm / b.g / (g.r1 * UNIT_MM);
  const sPin = sigma(F, L, g.rPin), sStud = sigma(F, L, g.studR);
  if (!(floorsHold(g) && g.a - g.rTip >= hubR + CLEAR_MARGIN - 1e-12 && sPin <= yieldMPa * (1 + 1e-9) && sStud <= yieldMPa * (1 + 1e-9) && Math.abs(F - g.F) < 1e-9))
    fail(`G ${h} h: floors ${floorsHold(g)}, tip-to-hub ${f3(g.a - g.rTip - hubR)}, pin ${f3(sPin)} MPa, stud ${f3(sStud)} MPa (yield ${yieldMPa})`);
  // M: one step in — against ALL FOUR of the floors the line scans from, the lock's among them since landing 2b's fix
  const r1 = g.r1 - STEP, F1 = stallNmm / b.g / (r1 * UNIT_MM);
  const cr = (Fx) => Math.cbrt((32 * Fx * L * UNIT_MM) / (Math.PI * yieldMPa)) / 2 / UNIT_MM;
  const rPin1 = Math.max(PIN_FLOOR_U, cr(F1)), studR1 = Math.max(STUD_FLOOR_U, cr(F1));
  const d1 = genevaDims(b.n, r1, { rPin: rPin1, studR: studR1 });
  const binds = r1 < lockR1Min(b.n) - 1e-12 ? 'the lock floor'
    : !floorsHold(d1) ? 'a Geneva floor'
      : !(d1.a - d1.rTip >= hubR + CLEAR_MARGIN) ? 'the hub clearance'
        : (sigma(F1, L, rPin1) > yieldMPa * (1 + 1e-9) || sigma(F1, L, studR1) > yieldMPa * (1 + 1e-9)) ? 'a stress'
          : null;
  if (!binds) fail(`M ${h} h: the orbit ${f3(r1)}, a step in, breaks nothing — the line did not take the smallest`);
  else bindsAt.push(`${h} h ${binds}`);
}
if (!failed) pass(`E every finger travels exactly its star's m + ½ + 1/n, and every star's simulated count agrees`);
if (!failed) pass(`C every pair is cuttable: pinions ≥ ${PINION_LEAVES_MIN} leaves, module ${f3(MODULE_MIN_U)} (the §50 floor), the cone's wheel bored over its ${coneBoreR} arbor with a wall`);
if (!failed) pass(`G every Geneva holds its floors and clears its hub, its pin and stud at or under ${yieldMPa} MPa at the stall`);
if (!failed) pass(`M every orbit is the smallest the line may take, one ${STEP} step above what binds it — ${
  [...new Set(bindsAt.map((x) => x.split(' h ')[1]))].map((w) => `${w} at ${bindsAt.filter((x) => x.endsWith(w)).length} reserve(s)`).join(', ')}`);

// controls
{
  const { b } = lines.find((l) => !l.b.direct);
  const off = ((b.zCone + 1) / b.zFinger) * windTurns(b.reserveHours);
  const five = gearPair(b.reserveHours, b.m, b.n, { coneBoreR });   // the line never returns a pinion under the floor
  const thin = (Math.PI * (MODULE_MIN_U * 0.95)) / 2 < STOCK_MIN_U;
  if (Math.abs(off - travelTurns(b.m, b.n)) > 1e-3 && five.zFinger >= PINION_LEAVES_MIN && 5 < PINION_LEAVES_MIN && thin)
    pass(`controls: ${b.zCone + 1}:${b.zFinger} at ${b.reserveHours} h travels ${f3(off)} against ${f3(travelTurns(b.m, b.n))}; a five-leaf pinion is under the ${PINION_LEAVES_MIN}-leaf floor; a module 5% under the floor cuts a tooth thinner than stock`);
  else fail('controls: a wrong pair, a five-leaf pinion or a thin module read as right — the probe measured nothing');
}
console.log(failed ? `${failed} FAILURE(S)` : 'all PASS');
process.exit(failed ? 1 : 0);
