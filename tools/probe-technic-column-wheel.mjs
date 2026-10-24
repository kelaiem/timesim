// DOES THE LEGO COLUMN WHEEL, PRESSED, STEP EXACTLY ONE REST ON A FULL PRESS AND
// NONE ON A HALF ONE, AND DOES THE LEVER READ IT — HELD ON A COLUMN, FREE IN A GAP?
// Acceptance, pure Node, no browser, no network; exits non-zero on any failure.
// BUILT §283 (src/technic-alarm.js, the press technic.html animates).
//
// MODELLED, NOT SIMULATED: the press is one state — the pusher's stroke s (since
// §288 the travel of a real rod, the driver following it: probe-technic-pusher.mjs), the
// wheel's stand, the tooth the pawl drives, the disc, the fly — and every body
// is read off it through landing I's laws (pawlRideSteps, followerModel,
// detentSettle, releaseStates, leverRest, lockPush, strikeTrace). Every rate is
// a display rate; the strike cadence and the wind are TECHNIC_ALARM_STRIKE's
// POSED table. Nothing is integrated but a display clock, and no force is weighed.
//
//   · MODEL — the pawl's ride is seat() at every sample; the PICK-UP (where the
//     ride drops the pawl behind a tooth's face) is bisected on seat() and
//     reported; while the wheel turns, the pawl stands at that face;
//   · STATIC — the first state is landing I's armed pose, body for body, and
//     its .ldr is the armed build's byte for byte; the off and ringing poses
//     land on alarmStates' (the fly to its vane's half-turn symmetry);
//   · PRESS — from each of the twelve rests a full press steps exactly one
//     rest and a half press none; a release a hair short of the near crest
//     falls back, a hair past it stands on the tooth's tip, a hair past the far
//     crest steps; the settled rest is landing I's `press` law's at every rest,
//     and the wheel's travel differs from it by the pick-up, reported;
//   · LEVER — the lever's rest is leverRest's at every degree of the disc
//     through the V, on a gap rest and on a column rest of each rotor; on a
//     column the beak holds it and the fly stays caught, in a gap it is free;
//   · CYCLE — twelve presses through the display's own sequencer come round to
//     the rest they began at, the reading alternating column, gap, column…;
//     every gap rings and no column does, each ring short of the POSED wind;
//     half presses between leave the reading where it was;
//   · CONTINUOUS — over a press and its return every body moves by less as the
//     display step halves (by half), except the pawl, whose one fall a full
//     press (none a half) is the ride's drop off a tooth;
//   · STRIKE & TRAINS — strikes per barrel turn counted through the state are
//     the module's; the trains' angles, travelled through the tooth counts,
//     stand in mesh at every pose sampled.
//
// WHAT THIS DOES NOT CLAIM: which way a wheel let go on the tooth's tip falls (it
// is drawn standing there, and the hour is not read); the bands' forces, the
// pusher's speed, the hand on the hour axle (display rates); the cadence (POSED);
// that the lever lifting a CAUGHT vane back against the train is free (the
// geometry says the vane is in contact; the hour axle is turned by hand).
// Not re-run: landing I's CLEAR sweep at the in-between poses (probe-technic-
// alarm.mjs holds it at the three states).
//
// CONTROLS, each seen to fail: a detent with no crest (a half press steps); the
// wheel half a column pitch off its rests (the readings swap); a bank stop short
// of the far crest (a full press does not step); the pawl taken as driving from
// the first degree (it drives with no tooth under it); the lever read off the
// pins alone (a column rings); a train turned at the wrong ratio (out of mesh); a
// drop made instantaneous (a body jumps).
//
//   node tools/probe-technic-column-wheel.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, LDU_MM } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { toLdr } from '../src/technic-ldraw.js';
import { starProfile, penetration } from '../src/technic-fusee.js';
import * as M from '../src/technic-alarm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = loadPack();   // vendor/ldraw/technic-parts.mpd (BUILT §309: or with TECHNIC_SUBSTITUTE's one swap)
const P = M.ALARM_PARTS;
const deg = (r) => (r * 180 / Math.PI).toFixed(2);
const mod = (a, m) => ((a % m) + m) % m;
const wrap = (a) => mod(a + Math.PI, 2 * Math.PI) - Math.PI;
const TAU = 2 * Math.PI, PITCH = TAU / 12;
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ctl = [];
const control = (name, caught) => { ctl.push([name, caught]); };

console.log('THE LEGO COLUMN WHEEL, PRESSED — the pawl, the wheel, the detent, the lever, the fly (MODELLED; every rate a display rate)\n');
const frame = M.frameAlarm();
const S = M.alarmStates(lib, frame);
const m = M.columnModel(lib, frame, S);
const sg = m.sigma;

// ── MODEL ───────────────────────────────────────────────────────────────────
console.log('model (the pawl\'s ride and its pick-up):');
{
  // the ride follows the pawl CONTINUOUSLY (each search from the last seat);
  // seat() searches from straight out. On the tooth's tip the two can rest on
  // different contacts of the same plateau, so they are compared and reported
  const diffs = [];
  for (let i = 0; i <= m.ride.n; i++) { const d = Math.abs(m.ride.table[i] - m.ride.model.seat(m.x0 + i * PITCH / m.ride.n)); if (d > 1e-9) diffs.push([i, d]); }
  const e = 1e-5, before = m.ride.model.seat(m.x0 + m.xDrop - e), after = m.ride.model.seat(m.x0 + m.xDrop + e);
  const jump = M.pawlSpecOn(frame.spec.pawlSense).sense * (after - before);
  console.log(`  RIDE: ${m.ride.n} samples over a 12T pitch; ${m.ride.n + 1 - diffs.length} are seat() to 1e-9 rad, ${diffs.length} on the tooth's tip rest on another contact of its plateau (${diffs.map(([i, d]) => `sample ${i} by ${deg(d)}°`).join(', ') || 'none'}), reported`);
  console.log(`  DROP: the pawl drops ${deg(jump)}° behind a tooth's face ${deg(m.xDrop)}° along its free way from its seat at rest (bisected on seat())`);
  if (!(jump > Math.PI / 180)) fail('the ride has no drop: the pawl never meets a tooth\'s face');
  if (diffs.some(([i]) => Math.abs(i - (m.xDrop / PITCH) * m.ride.n) < 1.5)) fail('the ride and seat() disagree beside the drop, where the pick-up is read');
  // the drawn seat across the drop's sample interval, against seat()
  let worstDrop = 0;
  for (let q = -10; q <= 10; q++) { if (!q) continue; const x = m.x0 + m.xDrop + q * PITCH / m.ride.n / 10; worstDrop = Math.max(worstDrop, Math.abs(m.pawlRel(x) - m.ride.model.seat(x))); }
  console.log(`  ACROSS THE DROP: the drawn seat, each side carried on from its own samples, stands within ${deg(worstDrop)}° of seat() (read between the samples it would stand ${deg(Math.abs(m.ride.at(m.x0 + m.xDrop) - after))}° off the face)`);
  if (worstDrop > 0.5 * Math.PI / 180) fail('the drawn seat leaves seat() across the drop');
  console.log(`  PICK-UP: from the driver's rest the pawl stands ${deg(m.pickup)}° of driver travel short of its tooth's face, so a full press (${deg(S.stroke)}°) turns the wheel ${deg(S.stroke - m.pickup)}°`);
}
// while the wheel turns, the pawl stands at its tooth's face: its relative
// angle is the ride's drop, the wall it locks against
function drivenAtFace(mm) {
  let worst = 0, n = 0;
  let st = M.columnStart(mm);
  for (let i = 1; i <= 400; i++) {
    st = M.columnStroke(mm, st, i / 400);
    const p = M.columnPose(mm, st);
    if (!p.driven) continue;
    n++;
    const x = p.thetaW - p.psiDriver, face = m.x0 + m.xDrop - PITCH;
    worst = Math.max(worst, Math.abs(mod(x - face + PITCH / 2, PITCH) - PITCH / 2));
  }
  return { worst, n };
}
{
  const r = drivenAtFace(m);
  console.log(`  WHILE IT DRIVES: over ${r.n} of 400 stroke samples the wheel turns, and at each the pawl stands at its tooth's face to ${r.worst.toExponential(1)} rad`);
  if (!(r.n > 0) || r.worst > 1e-9) fail('the wheel turns with the pawl away from a tooth\'s face');
  control('the pawl taken as driving from the first degree (it drives with no tooth\'s face under it)', drivenAtFace({ ...m, pickup: 0 }).worst > 1e-3);
}

// ── STATIC ──────────────────────────────────────────────────────────────────
console.log('\nstatic (the first state is landing I\'s armed pose):');
const FIELDS = ['theta', 'thetaW', 'psiDriver', 'psiLever', 'phiC', 'psiFollower', 'psiHammer'];
const poseDiff = (a, b, phiMod = false) => Math.max(...FIELDS.map((k) => (k === 'phiC' && phiMod ? Math.abs(wrap(2 * (a[k] - b[k])) / 2) : Math.abs(a[k] - b[k]))),
  Math.abs(a.pawl.pivot[0] - b.pawl.pivot[0]), Math.abs(a.pawl.pivot[1] - b.pawl.pivot[1]));
const pawlDiff = (a, b) => Math.abs(a.pawl.psi - b.pawl.psi);
{
  const st0 = M.columnStart(m), p0 = M.columnPose(m, st0);
  const dA = Math.max(poseDiff(p0, S.armed), pawlDiff(p0, S.armed));
  const ldrSame = toLdr(M.alarmBuild(frame, lib, p0)) === toLdr(M.alarmBuild(frame, lib, S.armed));
  const off = M.columnPose(m, M.columnCommand(m, st0, 'off')), ring = M.columnPose(m, M.columnCommand(m, st0, 'ringing'));
  const dO = poseDiff(off, S.off, true), dR = poseDiff(ring, S.ringing, true);
  console.log(`  s = 0: every body at landing I's armed angle to ${dA.toExponential(1)} rad; the .ldr ${ldrSame ? 'byte for byte the armed build\'s' : 'DIFFERS from the armed build\'s'}`);
  const qO = pawlDiff(off, S.off), qR = pawlDiff(ring, S.ringing);
  console.log(`  the off and ringing poses at alarmStates' to ${dO.toExponential(1)} and ${dR.toExponential(1)} rad (the fly to its half turn: its beam and its four pins are the same turned by π); the pawl to ${qO.toExponential(1)} and ${qR.toExponential(1)} (read between ride samples: rest 1 stands ${deg(Math.abs(m.restAngle(1) - m.restAngle(0) - PITCH))}° off a whole pitch from rest 0)`);
  if (dA > 1e-9 || !ldrSame) fail('the first state is not the armed build');
  if (dO > 1e-9 || dR > 1e-9 || qO > 1e-5 || qR > 1e-5) fail('the off or ringing pose is not alarmStates\'');
  if (p0.mode !== 'armed' || off.mode !== 'off' || ring.mode !== 'ringing') fail(`the modes read ${p0.mode}/${off.mode}/${ring.mode}`);
}

// ── PRESS ───────────────────────────────────────────────────────────────────
console.log('\npress (from each rest, driven a stroke at a time):');
// press to `aim`, then let the band return the driver; the drop runs on the
// display clock in between, so it completes
function pressTo(mm, st0, aim, steps = 400) {
  let st = { ...st0, home: mm.kBehind(M.columnWheel(mm, st0)), last: null };
  for (let i = 1; i <= steps; i++) st = M.columnStroke(mm, st, aim * i / steps);
  for (let i = steps - 1; i >= 0; i--) { st = M.columnStroke(mm, st, aim * i / steps); st = M.columnAdvance(mm, { ...st, act: 'idle' }, M.DROP_S / 20); }
  while (st.drop) st = M.columnAdvance(mm, st, M.DROP_S / 20);
  return { st, w: M.columnWheel(mm, st), k: mm.atRest(M.columnWheel(mm, st)) };
}
const aimFor = (mm, travel) => mm.sOf(travel + mm.pickup);   // the stroke (the pusher's travel, §288) that turns the wheel `travel` past its rest
const rows = [], pressErrs = [];
let worstLaw = 0;
const sigmaPress = S.sigma;
for (let k = 0; k < 12; k++) {
  const st0 = M.columnStart(m, { k });
  const full = pressTo(m, st0, 1), half = pressTo(m, st0, m.halfAim);
  if (full.k !== k + sg) pressErrs.push(`a full press from rest ${k} settles ${full.k === null ? 'at no rest' : 'at rest ' + full.k}`);
  if (half.k !== k) pressErrs.push(`a half press from rest ${k} settles ${half.k === null ? 'at no rest' : 'at rest ' + half.k}`);
  // landing I's press law: the wheel turned by the whole stroke, then settled
  const law = M.press(lib, { detent: frame.spec.detent, sigma: sigmaPress, wheelAt: m.restAngle(k), stroke: S.stroke }).settled;
  worstLaw = Math.max(worstLaw, Math.abs((law ?? NaN) - full.w));
  rows.push(`${k}→${full.k}`);
}
for (const e of pressErrs) fail(e);
console.log(`  FULL: from every rest one step (${rows.join(' ')}); HALF (the wheel ${deg(S.crest - M.PRESS_MARGIN)}°, an LDU of arc at the mesh short of the near crest): every one falls back`);
console.log(`  landing I's press law settles at the same rest every time (to ${worstLaw.toExponential(1)} rad); it turns the wheel ${deg(S.stroke)}°, the ride ${deg(S.stroke - m.pickup)}°: the pick-up it leaves out is ${deg(m.pickup)}°, and the far crest is still passed by ${deg(S.stroke - m.pickup - S.farCrest)}°`);
if (!(worstLaw < 1e-9)) fail('the animated press settles where landing I\'s press law does not');
// the crests: a hair either side of each
{
  const eps = 1e-3, st0 = M.columnStart(m, { k: 0 });
  const at = (t) => pressTo(m, st0, aimFor(m, t)).k;
  const a = at(S.crest - eps), b = at(S.crest + eps), c = at(S.farCrest - eps), d = at(S.farCrest + eps);
  console.log(`  CRESTS (±${deg(eps)}°): let go ${deg(S.crest)}° − ε → ${a === 0 ? 'back to rest 0' : a}; + ε → ${b === null ? 'on the tooth\'s tip, at no rest' : b}; far crest ${deg(S.farCrest)}° − ε → ${c === null ? 'on the tip' : c}; + ε → ${d === sg ? 'the next rest' : d}`);
  if (a !== 0 || b !== null || c !== null || d !== sg) fail('the crests do not divide fall-back, tip and step where detentRests puts them');
}
// controls
{
  const flat = M.columnModel(lib, frame, S, { ride: m.ride, restHook: (r) => ({ ...r, crestPlus: r.rest, crestMinus: r.rest - PITCH + 1e-6, farPlus: r.rest + PITCH, farMinus: r.rest - PITCH }) });
  control('a detent with no crest (a half press steps)', pressTo(flat, M.columnStart(flat), flat.halfAim).k !== 0);
  control('a bank stop short of the far crest (a full press stands on the tip)', pressTo(m, M.columnStart(m), aimFor(m, S.farCrest - 1e-3)).k !== sg);
}

// ── LEVER ───────────────────────────────────────────────────────────────────
console.log('\nlever (the pins, the beak, the fly):');
{
  let worst = 0, n = 0;
  const ks = [0, 1, 3];                  // a gap; a column of each rotor
  for (const k of ks) for (let i = -30; i <= 70; i += 2) {
    const th = Math.round((S.st.thetaNotch * 180 / Math.PI) + i) * Math.PI / 180, w = m.restAngle(k);
    const direct = M.leverRest(S.geo, { theta: th, thetaW: w }), tab = m.leverAt(th, w);
    worst = Math.max(worst, Math.abs(direct.psi - tab.psi)); n++;
    if (!direct.by.includes(tab.by)) fail(`at the disc's ${deg(th)}° on rest ${k} leverRest says ${direct.by}, the table ${tab.by}`);
  }
  console.log(`  THE TABLE: at ${n} disc angles through the V (a gap rest, a column of each rotor) the lever stands where leverRest puts it, to ${worst.toExponential(1)} rad`);
  if (worst > 1e-9) fail('the lever\'s table is not leverRest');
  const rd = [];
  for (let k = 0; k < 12; k++) {
    const L = m.leverAt(m.thetaNotch, m.restAngle(k)), lp = m.lockAt(L.psi), col = k % 2 === 1;
    rd.push(`${k}:${L.by === 'beak' ? 'held' : 'free'}`);
    if (col !== (L.by === 'beak')) fail(`rest ${k}: the lever is ${L.by === 'beak' ? 'held by the beak' : 'on the pins'} at the notch`);
    if (col && (lp.free || M.flyEngagement(S.geo, L.psi) < M.AX_CLEAR)) fail(`rest ${k}: on a column the fly is not held caught`);
    if (!col && !lp.free) fail(`rest ${k}: in a gap the fly is not let go`);
  }
  console.log(`  AT THE NOTCH: ${rd.join(' ')} — a column under the pin holds the lever (the fly caught), a gap lets it drop (the fly free); holds ${[1, 3].map((k) => deg(m.hold(k))).join('°/')}° (rotor A/B), the pins' drop ${deg(S.st.psiNotch)}°`);
  const shifted = M.columnModel(lib, frame, S, { ride: m.ride, shift: Math.PI / 6 });
  control('the wheel half a column pitch off its rests (the readings swap)', shifted.leverAt(m.thetaNotch, m.restAngle(0)).by === 'beak' && shifted.leverAt(m.thetaNotch, m.restAngle(1)).by === 'pins');
}

// ── CYCLE ───────────────────────────────────────────────────────────────────
console.log('\ncycle (twelve presses through the display\'s sequencer, the hour read after each):');
function cycle(mm, st0, cmd, dt = 1 / 30) {
  let st = M.columnCommand(mm, st0, cmd);
  if (!st) return null;
  let held = false, freed = false, t = 0;
  const strikes0 = st.strikes, keys = [];
  for (let i = 0; i < 4000; i++) {
    st = M.columnAdvance(mm, st, dt); t += dt;
    const p = M.columnPose(mm, st), ph = M.columnPhase(mm, st, p);
    if (keys[keys.length - 1] !== ph.key) keys.push(ph.key);
    if (st.act === 'hour' && p.leverBy[0] === 'beak') held = true;
    if (st.free) freed = true;
    if (st.act === 'idle') break;
  }
  return { st, held, freed, strikes: st.strikes - strikes0, t, keys, k: mm.atRest(M.columnWheel(mm, st)) };
}
{
  let st = M.columnStart(m), wrapW = M.columnWheel(m, st);
  const reads = [], cycErrs = [];
  let maxRing = 0, tSum = 0;
  for (let i = 0; i < 12; i++) {
    const c = cycle(m, st, 'press');
    if (!c) { cycErrs.push(`press ${i}: the sequencer refused it`); break; }
    const col = c.held;
    reads.push(`${c.k}:${col ? 'silent' : `rang ${c.strikes}`}`);
    if (c.k !== i + sg) cycErrs.push(`press ${i} settles at ${c.k}`);
    if (col !== (i % 2 === 0)) cycErrs.push(`press ${i}: the reading does not alternate`);
    if (col && (c.freed || c.strikes)) cycErrs.push(`press ${i}: a column rings`);
    if (!col && !(c.strikes > 0)) cycErrs.push(`press ${i}: a gap does not ring`);
    maxRing = Math.max(maxRing, c.strikes); tSum += c.t;
    st = c.st;
    // a half press between: nothing changes
    if (i === 3) { const h = cycle(m, st, 'half'); if (h.k !== c.k || h.held !== c.held) cycErrs.push('a half press changed the reading'); reads.push(`(half ${h.k}:${h.held ? 'silent' : `rang ${h.strikes}`})`); st = h.st; }
  }
  const back = M.columnWheel(m, st) - (wrapW + sg * TAU);
  for (const e of cycErrs) fail(e);
  console.log(`  ${reads.join(' ')}`);
  console.log(`  twelve presses come round: the wheel ${back.toExponential(1)} rad from a whole turn on; every ring at most ${maxRing} strikes, short of the POSED wind's ${m.perWind} (the display's hour turns past the notch before the band would run down); ${(tSum / 12).toFixed(1)} s a cycle at speed 1`);
  if (Math.abs(back) > 1e-9) fail('twelve presses do not come round');
  if (!(maxRing < m.perWind)) fail('a display ring reaches the POSED wind: the display would need a run-down it does not draw');
  const pinsOnly = { ...m, leverAt: (th, w) => ({ psi: m.leverPins(th), by: 'pins' }) };
  const c1 = cycle(pinsOnly, M.columnStart(pinsOnly), 'press');
  control('the lever read off the pins alone (a column rings)', c1 && c1.strikes > 0);
}

// ── CONTINUOUS ──────────────────────────────────────────────────────────────
console.log('\ncontinuous (a press and its return, at two display steps):');
function series(mm, cmd, dt, instantDrop = false) {
  let st = M.columnCommand(mm, M.columnStart(mm), cmd);
  const out = [];
  for (let i = 0; i < 20 / dt; i++) {
    st = M.columnAdvance(mm, st, dt);
    if (instantDrop && st.drop) st = { ...st, drop: { ...st.drop, u: 1 } };
    out.push(M.columnPose(mm, st));
    if (st.act !== 'pressing' && st.act !== 'returning') break;
  }
  return out;
}
const KEYS = { wheel: (p) => p.thetaW, driver: (p) => p.psiDriver, detent: (p) => p.psiFollower, lever: (p) => p.psiLever, pawl: (p) => p.pawl.psi };
// the pawl FALLS where its relative angle passes the ride's drop (the free way,
// upward): those steps are its falls, counted; every other step must halve
const dropIndex = (p) => Math.floor((p.thetaW - p.psiDriver - m.x0 - m.xDrop) / PITCH + 1e-6);   // (at the face it stands on the boundary, to float noise)
const jumps = (ps) => Object.fromEntries(Object.entries(KEYS).map(([k, f]) => {
  let mx = 0, falls = 0;
  for (let i = 1; i < ps.length; i++) {
    const d = Math.abs(f(ps[i]) - f(ps[i - 1]));
    if (k === 'pawl' && dropIndex(ps[i]) !== dropIndex(ps[i - 1])) { falls++; continue; }
    if (d > Math.PI / 180) falls++; else mx = Math.max(mx, d);
  }
  return [k, { mx, falls }];
}));
{
  const out = [];
  for (const cmd of ['press', 'half']) {
    const a = jumps(series(m, cmd, 1 / 200)), b = jumps(series(m, cmd, 1 / 400));
    for (const k of Object.keys(KEYS)) {
      const ratio = b[k].mx / (a[k].mx || 1);
      if (k !== 'pawl' && (a[k].falls || b[k].falls)) fail(`${cmd}: the ${k} jumps`);
      if (a[k].mx > 0 && !(ratio < 0.6)) fail(`${cmd}: the ${k}'s largest step does not halve with the display step (${ratio.toFixed(2)})`);
    }
    const want = cmd === 'press' ? 1 : 0;
    if (a.pawl.falls !== want || b.pawl.falls !== want) fail(`${cmd}: the pawl falls ${a.pawl.falls}/${b.pawl.falls} times, not ${want}`);
    out.push(`${cmd}: largest steps ${Object.keys(KEYS).map((k) => `${k} ${deg(a[k].mx)}→${deg(b[k].mx)}°`).join(', ')}; the pawl falls ${a.pawl.falls} (its drop off a tooth)`);
  }
  for (const l of out) console.log(`  ${l}`);
  const inst = jumps(series(m, 'press', 1 / 400, true));
  control('a drop made instantaneous (the wheel jumps)', inst.wheel.falls > 0);
}

// ── STRIKE & TRAINS ─────────────────────────────────────────────────────────
console.log('\nstrike and trains:');
{
  // strikes per barrel turn, counted through the state: the fly arbor run a
  // whole number of barrel turns from the lock
  const turns = 2, per = m.strikesBetween(S.armed.phiC, S.armed.phiC + frame.spec.run * turns * M.strikeRatio() * TAU) / turns;
  const mod16 = M.strikesPerBarrelTurn(lib, frame);
  console.log(`  ${per} strikes per barrel turn counted through the state (the module: ${mod16}); per wind the POSED table's ${m.perWind}, at the POSED ${M.TECHNIC_ALARM_STRIKE.standIn.strikeGap} s a strike`);
  if (per !== mod16) fail('the state counts strikes the module does not');
  // the trains: their angles through the tooth counts, in mesh at poses through a cycle
  const b0 = M.alarmBuild(frame, lib, S.armed);
  const pairs = [['fly', 'middle', P.spur8, P.spur16], ['middle', 'barrel', P.spur8, P.spur16], ['disc', 'S2', P.spur24, P.spur8], ['S2', 'S1', P.spur16, P.spur8], ['S1', 'hour', P.spur16, P.spur8]];
  const origin = Object.fromEntries(b0.shafts.map((s) => [s.shaft, [s.origin[0] * LDU_MM, s.origin[1] * LDU_MM]]));
  const meshDepth = (pose, ta) => {
    const phi = { fly: pose.phiC, disc: pose.theta, ...ta };
    return Math.max(...pairs.map(([a, bb, pa, pb]) => penetration(starProfile(lib, pa), origin[a], phi[a], starProfile(lib, pb), origin[bb], phi[bb])));
  };
  // a cycle from a column rest's neighbour, so it rings (rest 1 → 2, a gap)
  let worst = -Infinity, wrongWorst = -Infinity, n = 0, st = M.columnCommand(m, M.columnStart(m, { k: 1 }), 'press');
  for (let i = 0; i < 600 && st.act !== 'idle'; i++) {
    st = M.columnAdvance(m, st, 1 / 30);
    if (i % 6) continue;
    const p = M.columnPose(m, st), ta = M.trainAngles(b0, p);
    worst = Math.max(worst, meshDepth(p, ta)); n++;
    // the control: the middle arbor turned one for one with the fly, not 8:16
    wrongWorst = Math.max(wrongWorst, meshDepth(p, { ...ta, middle: ta.middle - (p.phiC - S.armed.phiC) / 2 }));
  }
  console.log(`  TRAINS: at ${n} poses through a ringing cycle every mesh interleaved, deepest ${worst.toFixed(3)} mm (≤ 0.05); the disc turned ${deg(st.theta - S.armed.theta)}°, the fly arbor ${deg(st.phiC ?? st.phi)}° on`);
  if (worst > 0.05) fail('a train stands out of mesh');
  control('a train turned at the wrong ratio (the middle arbor 1:1 with the fly: out of mesh)', wrongWorst > 0.5);
}

// ── CONTROLS ────────────────────────────────────────────────────────────────
console.log('\ncontrols:');
for (const [name, caught] of ctl) { console.log(`  ${caught ? 'caught ' : 'MISSED '} ${name}`); if (!caught) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nevery full press steps one rest and every half press none; the lever is held on a column and free in a gap; the pawl picks up ${deg(m.pickup)}° in — controls ${ctl.length}/${ctl.length}`);
process.exit(fails ? 1 : 0);
