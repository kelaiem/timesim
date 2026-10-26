// DOES THE LEGO ALARM SWITCH ON AND OFF ON EVERY FULL PRESS AND NEVER ON A HALF
// ONE, DROP ITS RELEASE AT THE NOTCH, AND STRIKE FOUR TIMES A TURN OF ITS FLY?
// Acceptance, pure Node, no browser, no network; exits non-zero on any failure.
// §219 tier three (b), landing I (src/technic-alarm.js).
//
// MODELLED, NOT SIMULATED: every reading below is geometry read off the
// vendored LDraw parts. Nothing is integrated and no force is weighed: where a
// pawl LOCKS or a pin LIFTS a tail, that is a direction or a slope read off the
// parts; every band is posed; the cadence and the strikes per wind are a POSED
// table. The governor is a FLY — air drag on two beams' vanes — a different
// mechanism from the steel anchor (an oscillator), and the probe says so.
//
//   · PARTS — every ALARM_DIM_MM figure re-read off the parts;
//   · COLUMN WHEEL — two 3-blade rotors, the second turned over, are SIX
//     columns 60° apart (read off their outline), which a quarter turn of one
//     alone breaks;
//   · RELEASE — the declared disc, column wheel and fly are what solveAlarm
//     answers; the lever's rim, its drop at the notch, the fly caught on the rim
//     and at a column's hold and passed at the notch, the vane's push into the
//     lever's supports, the unlock's window and its slope in minutes;
//   · INDEX — the detent's twelve rests, 30° apart, each a detent and not a
//     ratchet; the pawl LOCKS the way the press needs (pawlLock); the driver's
//     stroke between its two stacks inside the window; at every rest a FULL
//     press steps exactly one rest and turns the beak from column to gap or gap
//     to column (the lever held or dropped at the notch, read off the parts); a
//     HALF press — short of the near crest — falls back; twelve presses come
//     round (the 12T's tip carries two crests with a saddle between, and a
//     press must pass the FAR one);
//   · STRIKE — the hammer is the solve's; traced over a turn of the fly arbor at
//     two steps, the pins lift its tail on a held slope and it falls four times,
//     each fall a jump that survives extrapolation to a zero step; with the
//     train locked its tail is
//     clear of every pin; counted through the meshes, strikes per barrel turn
//     are the steel's (ALARM_CAM_LOBES × ALARM_BARREL_TEETH / ALARM_STRIKE_PINION_
//     TEETH, read off main.js' text); strikes per wind and the cadence are the
//     POSED table's, its stand-in read back off main.js;
//   · TRAINS — the release's 12:1 is the fork's classic motion-works row run the
//     other way; every mesh admissible and on the lattice at the build's own
//     centre distances; the strike's 4:1 is the steel's ratio;
//   · BUILD — every column contiguous, its hole at its axle's height, its axle
//     through both its bricks; every gear pair meshed (interleaved, not in each
//     other); CLEAR — every placed part over an LDU from every part it does not
//     bear on, in the armed, ringing and off states; the .ldr round trip.
//
// WHAT THIS DOES NOT CLAIM: a force, a torque, a rate in strikes per second,
// how long the alarm rings; how loud a brick sounds; the band's winding (no
// click is built: winding the barrel back would turn the train back with it);
// a going train (the hour axle is turned by hand here).
//
// CONTROLS, each seen to fail: a dimension perturbed; one rotor a quarter turn
// round alone; a declared disc other than the solve's; the notch filled (a pin
// in the fourth place); a fly placed where its push lifts the lever; the pawl
// on its other band; a press past the next far crest; a "half" press past the
// far crest; a press ending on the tooth's tip; the column wheel half a pitch
// off its rest under the beak; the strike train run the other way; a
// different POSED table moving strikes per wind with no code change; a gear
// turned half a tooth out of mesh; a column turned into the dropped beak.
//
//   node tools/probe-technic-alarm.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, placements, LDU_MM } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { LEGO_DIM_MM as D, GEAR_TIP_MM } from '../src/technic-frame.js';
import { placedParts, toLdr, surfaceSamples, placedCloud, cloudGap } from '../src/technic-ldraw.js';
import { pawlLock, starProfile, penetration } from '../src/technic-fusee.js';
import { CATALOGUES, TECHNIC_FORK, catalogueMesh, ratQ, ratMul, ratEq, ratStr } from '../src/layout.js';
import * as M from '../src/technic-alarm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = loadPack();   // vendor/ldraw/technic-parts.mpd (BUILT §309: or with TECHNIC_SUBSTITUTE's one swap)
const MAIN = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const L = (mm) => mm / LDU_MM;
const B = (p) => bounds(lib, `${p}.dat`);
const deg = (r) => (r * 180 / Math.PI).toFixed(2);
const rad = (d) => d * Math.PI / 180;
const A = M.ALARM_DIM_MM, P = M.ALARM_PARTS, S = M.TECHNIC_ALARM, g = M.AX_CLEAR;
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ctl = [];
const control = (name, caught) => { ctl.push([name, caught]); };
const near = (a, b, t = 1e-4) => Math.abs(a - b) <= t;
const mod = (a, m) => ((a % m) + m) % m;
const wrap = (a) => mod(a + Math.PI, 2 * Math.PI) - Math.PI;

console.log('THE LEGO ALARM — a column wheel, a release on a ring of pins, a striking train ending in a FLY, a hammer and a brick (MODELLED)\n');

// ── PARTS ───────────────────────────────────────────────────────────────────
console.log('parts (each figure re-read off the vendored parts):');
const radiusOver = (part, x0, x1) => { let m = 0; for (const [x, y, z] of surfaceSamples(lib, part, 0.25)) if (x >= x0 && x <= x1) m = Math.max(m, Math.hypot(y, z)); return m * LDU_MM; };
const holesOn = (part, re) => placements(lib, `${part}.dat`, re).map((q) => q.m[2] * LDU_MM);
function partErrors(dims) {
  const errs = [];
  const tip = M.unionProfile(M.profileOf(lib, P.rotor, M.Y_TO_Z), M.profileOf(lib, P.rotor, M.Y_TO_Z_FLIP)).tip;
  if (!near(tip, dims.rotorTip)) errs.push(`rotor: tip ${tip.toFixed(5)} mm, table ${dims.rotorTip}`);
  const rb = B(P.rotor);
  if (!near(rb.hi[1] * LDU_MM, dims.rotorBody) || !near(-rb.lo[1] * LDU_MM, dims.rotorStud)) errs.push('rotor: its body or its stud differs');
  if (placements(lib, `${P.rotor}.dat`, /stud/).length !== 3) errs.push('rotor: not three studs');
  if (!near(radiusOver(P.pin, 3, 17), dims.pinR)) errs.push('pin: the shaft\'s radius differs');
  if (!near(radiusOver(P.pin, 18, 20), dims.pinLipR) || !near(radiusOver(P.longPin, 28, 30), dims.pinLipR)) errs.push('pin: the lip\'s radius differs');
  // 6558's collar is drawn by a primitive scaled to 8.00053 LDU (its bounds say so), 0.0002 mm proud of 8: read to 1e-3
  if (!near(radiusOver(P.pin, -2, 2), dims.pinCollarR) || !near(radiusOver(P.longPin, -12, -8), dims.pinCollarR, 1e-3)) errs.push('pin: the collar\'s radius differs');
  if (!near(radiusOver(P.pin, -1.99, 1.99) - radiusOver(P.pin, 2.01, 3), dims.pinCollarR - dims.pinR) || !near(2 * LDU_MM, dims.pinCollarHalf)) errs.push('pin: the collar\'s width differs');
  if (!near(B(P.pin).hi[0] * LDU_MM, dims.pinHalf)) errs.push('pin: its half length differs');
  if (!near((-12 - B(P.longPin).lo[0]) * LDU_MM, dims.longPinShort) || !near((B(P.longPin).hi[0] - -8) * LDU_MM, dims.longPinLong)) errs.push('long pin: a side\'s length differs');
  const beamH = holesOn(P.beam, /connhole|axlehol/);
  if (!beamH.some((z) => near(z, dims.beamHoles)) || !beamH.some((z) => near(z, -dims.beamHoles))) errs.push('beam: its end holes do not stand at the table\'s spacing');
  if (!near(B(P.beam).hi[0] * LDU_MM, dims.beamHalfWidth) || !near((B(P.beam).hi[1] - B(P.beam).lo[1]) * LDU_MM, dims.beamThick)) errs.push('beam: its width or thickness differs');
  const levH = holesOn(P.lever, /axlehol/);
  if (!levH.some((z) => near(z, dims.leverHoles)) || !levH.some((z) => near(z, -dims.leverHoles))) errs.push('lever: its end holes differ');
  if (!near(B(P.lever).hi[0] * LDU_MM, dims.leverHalfWidth) || !near((B(P.lever).hi[1] - B(P.lever).lo[1]) * LDU_MM, dims.armThick)) errs.push('lever: its width or thickness differs');
  // the pawl's arm (6632): an end hole at its origin, its round middle hole armMid on, its far end hole twice that
  const pa = placements(lib, `${P.arm}.dat`, /peghole|axlehol/).map((q) => [q.file, q.m[2] * LDU_MM]);
  if (!pa.some(([f, z]) => /peghole/.test(f) && near(z, dims.armMid)) || !pa.some(([f, z]) => /axlehol/.test(f) && near(z, 2 * dims.armMid)) || !pa.some(([f, z]) => /axlehol/.test(f) && near(z, 0))) errs.push('arm: its middle round hole or its end holes differ');
  // the driver (11478) idles by its round middle hole, its end holes DRIVER_ARM either side; the pawl's 8T PAWL_ARM from its arm's middle
  if (!near(dims.leverHoles, M.DRIVER_ARM) || !near(dims.armMid, M.PAWL_ARM)) errs.push('the driver\'s or the pawl\'s arm is not a hole spacing of its part');
  if (!placements(lib, `${P.lever}.dat`, /peghole/).some((q) => near(q.m[2], 0))) errs.push('lever: no round hole at its middle');
  if (!near(B(P.tile).hi[1] * LDU_MM, dims.tileH)) errs.push('tile: its height differs');
  for (const p of [P.wheel, P.spur8, P.spur16]) if (!near((B(p).hi[2] - B(p).lo[2]) * LDU_MM, dims.gearWidth)) errs.push(`${p}: its width differs`);
  if (!near((B(P.spur24).hi[2] - B(P.spur24).lo[2]) * LDU_MM, dims.spur24Width)) errs.push('24T: its width differs');
  return errs;
}
const pe = partErrors(A);
console.log(`  rotor tip ${A.rotorTip} mm, body ${A.rotorBody}, stud ${A.rotorStud}; pin shaft ${A.pinR}, lip ${A.pinLipR}, collar ${A.pinCollarR}; beam holes ±${A.beamHoles}, half width ${A.beamHalfWidth}; lever holes ±${A.leverHoles}; arm middle hole ${A.armMid}`);
for (const e of pe) fail(e);
control('a dimension perturbed (the rotor\'s tip by 0.01 mm)', partErrors({ ...A, rotorTip: A.rotorTip + 0.01 }).length > pe.length);

// ── COLUMN WHEEL ────────────────────────────────────────────────────────────
console.log('\ncolumn wheel:');
function columnErrors(prof) {
  const cols = M.columnAngles(prof), errs = [];
  if (cols.length !== 6) errs.push(`${cols.length} columns, not six`);
  else for (let i = 0; i < 6; i++) { const d = mod(cols[(i + 1) % 6] - cols[i], 2 * Math.PI); if (Math.abs(d - Math.PI / 3) > rad(0.2)) errs.push(`columns ${i} and ${i + 1} stand ${deg(d)}° apart, not 60°`); }
  return { cols, errs };
}
const colP = M.columnWheelProfile(lib), ce = columnErrors(colP);
console.log(`  two rotors, the second turned over: columns at ${ce.cols.map(deg).join('°, ')}° (tip ${colP.tip.toFixed(4)} mm)`);
for (const e of ce.errs) fail(e);
{
  const q = M.profileOf(lib, P.rotor, M.mul3(M.rz(Math.PI / 2), M.Y_TO_Z_FLIP));
  control('one rotor a quarter turn round alone', columnErrors(M.unionProfile(M.profileOf(lib, P.rotor, M.Y_TO_Z), q)).errs.length > 0);
}

// ── THE SOLVE: RELEASE, STRIKE, INDEX ───────────────────────────────────────
console.log('\nthe solve (release, then the strike\'s run and hammer, then the index):');
const t0 = Date.now();
const sol = M.solveAlarm(lib);
console.log(`  solved in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const rel = sol.rel, st = rel.disc.st;
for (const d of rel.discs.slice(0, 3)) console.log(`    disc ${d.D}: rim ${deg(d.st.rimUp)}..${deg(d.st.rimDown)}°, notch ${deg(d.st.psiNotch)}°, drop not spent on the rim ${deg(d.st.margin - d.st.ripple)}°`);
for (const w of rel.wheels.slice(0, 3)) console.log(`    column wheel ${w.W}: beak clear ${w.clear.toFixed(3)} mm at the rim's lowest, a column holds the lever at ${deg(w.block)}°`);
for (const f of rel.flies.slice(0, 2)) console.log(`    fly ${f.C} run ${f.run > 0 ? '+' : '−'}: caught ${f.eBlock.toFixed(2)} mm at the hold, passed ${(-f.eNotch).toFixed(2)} mm at the notch; push moments ${f.pushes.map((p) => p.moment.toFixed(1)).join('/')} mm`);
console.log(`    strike: ${sol.strike.tried.map((t) => `run ${t.run > 0 ? '+' : '−'} ${t.candidates} hammers`).join(', ')}`);
const solved = { D: rel.disc.D, W: rel.wheel.W, C: rel.fly.C, run: sol.strike.run, hammer: sol.strike.hammer, detent: sol.index.pick?.detent, driver: sol.index.pick?.driver, lock: sol.lock.locks };
function declaredErrors(spec, s) {
  const errs = [], same = (a, b) => a && b && a.length === b.length && a.every((v, i) => near(v, b[i], 1e-6));
  if (!same(spec.D, s.D)) errs.push(`the disc is declared at ${spec.D}, the solve says ${s.D}`);
  if (!same(spec.W, s.W)) errs.push(`the column wheel is declared at ${spec.W}, the solve says ${s.W}`);
  if (!same(spec.C, s.C)) errs.push(`the fly is declared at ${spec.C}, the solve says ${s.C}`);
  if (spec.run !== s.run) errs.push(`the strike is declared to run ${spec.run}, the solve says ${s.run}`);
  if (spec.pawlLocks !== s.lock) errs.push(`the pawl is declared to lock ${spec.pawlLocks}, pawlLock reads ${s.lock}`);
  const h = s.hammer;
  if (!h || !same(spec.hammer.at, [h.hu, h.hv]) || spec.hammer.sense !== h.sense || spec.hammer.kHead !== h.kHead || spec.hammer.struck.u !== h.struck.u || spec.hammer.struck.plates !== h.struck.plates) errs.push('the hammer is not the solve\'s');
  const d = s.detent;
  if (!d || !same(spec.detent.pivot, d.pivot) || spec.detent.sense !== d.sense) errs.push(`the detent is declared at ${spec.detent.pivot} band ${spec.detent.sense}, the solve says ${d?.pivot} band ${d?.sense}`);
  const dr = s.driver;
  if (!dr || spec.driver.rest.u !== dr.rest.u || spec.driver.rest.plates !== dr.rest.plates || spec.driver.bank.u !== dr.bank.u || spec.driver.bank.plates !== dr.bank.plates) errs.push('the driver\'s stops are not the solve\'s');
  return errs;
}
const de = declaredErrors(S, solved);
for (const e of de) fail(e);
control('a declared disc other than the solve\'s', declaredErrors({ ...S, D: [32, 9.6] }, solved).length > de.length);

// ── RELEASE ─────────────────────────────────────────────────────────────────
console.log('\nrelease (the lever on the ring of pins; the fly on the lever):');
const frame = M.frameAlarm();
if (!frame.framed) fail(`not framed: ${frame.reason}`);
const geo = M.releaseGeometry(lib, { D: S.D, W: S.W, C: S.C, run: S.run });
console.log(`  radii in their bands: the disc's pins ${geo.rDisc.toFixed(4)} mm, the long pin ${geo.rLong.toFixed(4)}; the beak against rotor A ${geo.rBeakA.toFixed(4)}, rotor B ${geo.rBeakB.toFixed(4)}`);
console.log(`  RIM: the lever ${deg(st.rimUp)}..${deg(st.rimDown)}° (a ripple of ${deg(st.ripple)}° as the three pins pass); NOTCH: it drops to ${deg(st.psiNotch)}° — a DROP of ${deg(st.psiNotch - st.rimDown)}° below the rim's lowest, at disc angle ${deg(st.thetaNotch)}°`);
const block = rel.wheel.block;
const eAt = (p) => M.flyEngagement(geo, p);
// the unlock: over a turn of the disc, where the fly passes the lever
const unlock = st.pts.filter((p) => eAt(p.psi) < 0);
const windowDeg = unlock.length;                         // st.pts are a degree apart
const cross = st.pts.map((p, i) => [p, st.pts[(i + 1) % 360]]).filter(([a, b]) => eAt(a.psi) >= 0 && eAt(b.psi) < 0);
const slope = cross.length ? Math.abs(eAt(cross[0][1].psi) - eAt(cross[0][0].psi)) : NaN;   // mm of engagement per degree of disc
const minPerDeg = 12 * 60 / 360;
console.log(`  THE FLY: caught ${eAt(st.rimUp).toFixed(2)}..${eAt(st.rimDown).toFixed(2)} mm on the rim and ${eAt(block).toFixed(2)} mm where a column holds the lever; passed by ${(-eAt(st.psiNotch)).toFixed(2)} mm at the notch`);
console.log(`  THE UNLOCK: the fly is free over ${windowDeg}° of the disc's turn (${(windowDeg / 30).toFixed(2)} h of 12); the engagement falls ${slope.toFixed(3)} mm per degree of disc where it crosses, so an LDU of play moves the alarm ${(g / slope * minPerDeg).toFixed(1)} minutes`);
const relErrs = [];
if (!(eAt(st.rimDown) >= g && eAt(st.rimUp) >= g)) relErrs.push('the fly is not caught by AX_CLEAR all round the rim');
if (!(eAt(block) >= g)) relErrs.push('the fly is not caught where a column holds the lever');
if (!(eAt(st.psiNotch) <= -g)) relErrs.push('the fly is not passed at the notch');
if (cross.length !== 1) relErrs.push(`the fly is freed ${cross.length} times a turn, not once`);
const pushes = [st.rimUp, st.rimDown, block].map((p) => M.lockPush(geo, p, S.run));
console.log(`  THE LOCK'S PUSH (run ${S.run > 0 ? '+' : '−'}): moments ${pushes.map((q) => q.moment.toFixed(2)).join(' / ')} mm about the lever's pivot at the rim's top, its bottom and the column's hold — ${pushes.every((q) => q.intoSupports) ? 'all INTO the lever\'s supports' : 'NOT all into its supports'}`);
if (!pushes.every((q) => q.intoSupports)) relErrs.push('the fly\'s push lifts the lever off its supports somewhere');
for (const e of relErrs) fail(e);
{ // the notch filled: a fourth pin where the empty place is → the lever never drops
  const g4 = { ...geo, D: S.D }, fourth = (th) => [...M.releasePins(g4, th), { c: [S.D[0] + A.beamHoles * Math.cos(th + 1.5 * Math.PI), S.D[1] + A.beamHoles * Math.sin(th + 1.5 * Math.PI)], r: geo.rDisc }];
  let deepest = -Infinity;
  for (let i = 0; i < 360; i += 2) {
    const th = rad(i), seg = (psi) => M.leverSeg([0, 0], psi);
    let psi = -rad(45);
    while (fourth(th).every((p) => { const [a, b] = seg(psi); const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p.c[0] - a[0]) * dx + (p.c[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.c[0] - a[0] - t * dx, p.c[1] - a[1] - t * dy) > A.leverHalfWidth + p.r; }) && psi < rad(60)) psi += rad(0.25);
    deepest = Math.max(deepest, psi);
  }
  control('the notch filled (a pin in the fourth place): the fly is never freed', M.flyEngagement(geo, deepest) > 0);
}
{ // a fly placed where its push lifts the lever: below the lever's end, 12.8 mm
  // down (four plates), where it still catches the lever (engaged 6.44 mm); at
  // 22.4 mm down it misses the lever altogether, which tests nothing
  const q = M.lockPush({ ...geo, C: [36, 12.8] }, st.rimDown, S.run);
  control('a fly below the lever (its push lifts the lever off its supports)', !!q && !q.free && !q.intoSupports);
}

// ── INDEX ───────────────────────────────────────────────────────────────────
console.log('\nindex (the detent, the pawl, the driver; a full press and a half one at every rest):');
const states = M.alarmStates(lib, frame);
const det = M.detentSpec(S.detent.pivot, S.detent.sense);
const rests = [];
for (let k = 0; k < 12; k++) rests.push(M.detentRests(lib, det, states.gapRest.rest + k * Math.PI / 6));
const idxErrs = [];
if (rests.some((r) => !r)) idxErrs.push('a rest has no notch');
else {
  for (let k = 0; k < 12; k++) {
    const d = wrap(rests[k].rest - (states.gapRest.rest + k * Math.PI / 6));
    if (Math.abs(d) > rad(0.05)) idxErrs.push(`rest ${k} stands ${deg(d)}° off its 30° step`);
    if (!rests[k].symmetric) idxErrs.push(`rest ${k}: flanks ${rests[k].flanks.map((v) => v.toFixed(3)).join('/')} — a ratchet, not a detent`);
  }
}
const r0 = rests[0];
console.log(`  DETENT: a half bush on a 6632 about W + (${S.detent.pivot}) mm, band ${S.detent.sense > 0 ? '+' : '−'}: twelve rests 30° apart, near crests ${deg(r0.crestMinus - r0.rest)}°/${deg(r0.crestPlus - r0.rest)}°, far crests ${deg(r0.farMinus - r0.rest)}°/${deg(r0.farPlus - r0.rest)}° (the tooth's tip between, two peaks and a saddle), lift ${r0.lift.toFixed(3)} mm, flanks ${r0.flanks.map((v) => v.toFixed(3)).join('/')} mm/°`);
const lockR = pawlLock(lib, M.pawlSpecOn(S.pawlSense), 12), lockO = pawlLock(lib, M.pawlSpecOn(-S.pawlSense), 12);
const ls = (l) => `+ ${l.plus.map((v) => v.toFixed(1)).join('/')} · − ${l.minus.map((v) => v.toFixed(1)).join('/')}`;
console.log(`  PAWL (an 8T on a thin liftarm, ${M.PAWL_ARM} mm from its pivot ${M.DRIVER_ARM} mm out on the 5L driver): band ${S.pawlSense > 0 ? '+' : '−'} ${ls(lockR)} → locks ${lockR.locks > 0 ? '+' : lockR.locks < 0 ? '−' : 'neither way'}; band ${-S.pawlSense > 0 ? '+' : '−'} → locks ${lockO.locks > 0 ? '+' : lockO.locks < 0 ? '−' : 'neither way'}`);
if (lockR.locks !== S.pawlLocks) idxErrs.push('the pawl does not lock the way the press needs');
const sigma = states.sigma;
console.log(`  DRIVER: rests at ${deg(states.psiRest)}° on a ${S.driver.rest.plates}-plate stack, a press stops at ${deg(states.psiBank)}° on a ${S.driver.bank.plates}-plate one: a STROKE of ${deg(states.stroke)}°; the window is ${states.window.map(deg).join('..')}° (past the far crest at ${deg(states.farCrest)}°, short of the next rest's near crest, by an LDU of arc at the mesh)`);
if (!(states.stroke > states.window[0] && states.stroke < states.window[1])) idxErrs.push('the stroke is outside its window');
// the beak at a rest: held by a column, or dropped onto the pins, with the notch under the lever
const beakAt = (thetaW, gg = geo) => { const r = M.leverRest(gg, { theta: st.thetaNotch, thetaW }); return { on: !r.by.includes('beak'), psi: r.psi, by: r.by }; };
const pressFrom = (k, stroke) => M.press(lib, { detent: { pivot: S.detent.pivot, sense: S.detent.sense }, sigma, wheelAt: rests[k].rest, stroke }).settled;
const restIndex = (th) => { for (let k = 0; k < 12; k++) if (Math.abs(wrap(th - rests[k].rest)) < rad(0.1)) return k; return null; };
const fullStroke = states.stroke, halfStroke = states.crest - M.PRESS_MARGIN;
const rows = [];
let wheel = rests[0].rest, wrapCount = 0;
for (let k = 0; k < 12; k++) {
  const now = restIndex(wheel), beak = beakAt(wheel);
  const full = pressFrom(now, fullStroke), half = pressFrom(now, halfStroke);
  const kf = restIndex(full), kh = restIndex(half);
  const next = (now + (sigma > 0 ? 1 : 11)) % 12;
  // the rest a sigma-ward step reaches is rests[now] + sigma·30°: which index that is
  const expect = restIndex(rests[now].rest + sigma * Math.PI / 6);
  if (kf !== expect) idxErrs.push(`a full press from rest ${now} settles at ${kf === null ? deg(full) + '°' : 'rest ' + kf}, not the next`);
  if (kh !== now) idxErrs.push(`a half press from rest ${now} does not fall back (settles at ${kh})`);
  const after = beakAt(full);
  if (after.on === beak.on) idxErrs.push(`a full press from rest ${now} leaves the alarm ${beak.on ? 'on' : 'off'}`);
  rows.push(`${now}:${beak.on ? 'ON' : 'off'}`);
  wrapCount += sigma * wrap(full - wheel);
  wheel = full;
  void next;
}
// the presses all turn the wheel the one way, so twelve of them add to a whole turn
if (Math.abs(wrapCount - 2 * Math.PI) > rad(0.5)) idxErrs.push(`twelve presses turn the wheel ${deg(wrapCount)}°, not a whole turn`);
console.log(`  PRESSES: from each rest a full press (${deg(fullStroke)}°) steps exactly one rest; a half press (${deg(halfStroke)}°, an LDU of arc short of the crest) falls back; the alarm in turn ${rows.join(' ')}; twelve presses ${deg(wrapCount)}°`);
const onRest = beakAt(rests[0].rest), offRest = beakAt(rests[1].rest);
console.log(`  THE BEAK at the notch: on a GAP rest the lever drops to ${deg(onRest.psi)}° (held by the ${onRest.by}); on a COLUMN rest it is held at ${deg(offRest.psi)}° (by the ${offRest.by}), where the fly is still caught ${M.flyEngagement(geo, offRest.psi).toFixed(2)} mm`);
if (!onRest.on || offRest.on) idxErrs.push('the beak does not read gap → on, column → off at the first two rests');
if (!(M.flyEngagement(geo, offRest.psi) >= g)) idxErrs.push('on a column the fly is not held caught');
const clr = Math.min(...rests.map((r) => M.beakClearance(geo, st.rimDown)));
console.log(`  THE WHEEL TURNS UNDER A HELD LEVER: the beak clears every column by ${clr.toFixed(3)} mm with the lever at the rim's lowest`);
if (clr < g) idxErrs.push('the beak does not clear the columns under a held lever');
for (const e of idxErrs) fail(e);
// controls
control('the pawl on its other band (it locks the other way)', lockO.locks !== S.pawlLocks);
{
  const over = Math.PI / 6 + states.farCrest + M.PRESS_MARGIN;
  const k2 = restIndex(pressFrom(0, over));
  control('a press past the next crest (it steps two rests)', k2 !== restIndex(rests[0].rest + sigma * Math.PI / 6));
  const k1 = restIndex(pressFrom(0, states.farCrest + M.PRESS_MARGIN));
  control('a "half" press past the far crest (it steps, so it is not half)', k1 !== 0);
  const k3 = restIndex(pressFrom(0, (states.crest + states.farCrest) / 2));
  control('a press ending between the two crests (the wheel stands on the tooth\'s tip, at no rest)', k3 !== 0);
}
{ // the beak's pin moved round its line by half a column pitch: gap and column swap, the reading follows
  const moved = beakAt(rests[0].rest + Math.PI / 6);
  control('the column wheel a half pitch off its rest under the beak (the reading flips)', moved.on !== onRest.on);
}

// ── STRIKE ──────────────────────────────────────────────────────────────────
console.log('\nstrike (four pins on the fly arbor, a hammer, a brick):');
const h = M.alarmHammer(lib, frame);
const phiLock = states.armed.phiC;
const tr1 = M.strikeTrace(h, S.run, { step: 1, from: phiLock }), tr4 = M.strikeTrace(h, S.run, { step: 0.25, from: phiLock });
const strErrs = [];
console.log(`  HAMMER: pivot C + (${S.hammer.at}) mm, band ${S.hammer.sense > 0 ? '+' : '−'}, head ${S.hammer.kHead * 90}° round from the tail, resting on a ${S.hammer.struck.plates}-plate stack; the four pins' radius in the tail's band ${h.pinR.toFixed(4)} mm`);
console.log(`  over a turn of the fly arbor: steepest lift rate ${tr1.rate.toFixed(2)} (1° steps) / ${tr4.rate.toFixed(2)} (¼°); falls ${tr1.falls.map((f) => deg(f.drop)).join(', ')}° / ${tr4.falls.map((f) => deg(f.drop)).join(', ')}°; the head lifted up to ${(2 * 16 * Math.sin(tr4.maxLift / 2)).toFixed(2)} mm`);
if (tr1.jam || tr4.jam) strErrs.push('a pin meets the tail face-on (a jam)');
if (tr4.rate > M.RATE_HOLD * tr1.rate) strErrs.push(`the lift rate does not hold between steps (${tr1.rate.toFixed(2)} → ${tr4.rate.toFixed(2)}): a wall, not a slope`);
if (tr1.falls.length !== M.CAM_LOBES || tr4.falls.length !== M.CAM_LOBES) strErrs.push(`${tr1.falls.length}/${tr4.falls.length} falls a turn, not ${M.CAM_LOBES}`);
// A FALL is a jump the trace takes in one step, whatever the step: a slope's
// per-step drop shrinks with the step, so it extrapolates to nothing at a zero
// step, and a fall's to its whole height. Linear in the step: J = (4·d¼ − d1)/3.
else {
  const jumps = tr1.falls.map((f, i) => (4 * tr4.falls[i].drop - f.drop) / 3);
  console.log(`  each fall extrapolated to a zero step: ${jumps.map(deg).join(', ')}°`);
  if (jumps.some((j) => j < rad(1))) strErrs.push('a fall vanishes as the step shrinks: a slope, not a fall');
}
const tail0 = M.armSeg(h.Hm, h.psiRest);
const lockClear = Math.min(...M.camPins(S.C, phiLock, h.pinR).map((p) => {
  const [a, b] = tail0, dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p.c[0] - a[0]) * dx + (p.c[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.c[0] - a[0] - t * dx, p.c[1] - a[1] - t * dy) - A.leverHalfWidth - p.r;
}));
console.log(`  LOCKED (the fly on the lever, φ ${deg(phiLock)}°): the hammer rests on its stack, its tail ${lockClear.toFixed(2)} mm clear of every pin`);
if (lockClear < g) strErrs.push('with the train locked a pin bears on the tail');
// counted through the meshes
const textNum = (re) => { const m = re.exec(MAIN); return m ? Number(m[1]) : NaN; };
const steel = { lobes: textNum(/const ALARM_CAM_LOBES = (\d+);/), barrelTeeth: textNum(/const ALARM_BARREL_TEETH = (\d+);/), pinionTeeth: textNum(/const ALARM_STRIKE_PINION_TEETH = (\d+);/),
  turns: textNum(/const ALARM_BARREL_TURNS = ([0-9.]+);/), gap: textNum(/const ALARM_STRIKE_GAP = ([0-9.]+);/) };
const ratio = M.STRIKE_CHAIN.reduce((p, [a, b]) => ratMul(p, ratQ(a, b)), ratQ(1));
const perTurn = M.strikesPerBarrelTurn(lib, frame, { step: 1, from: phiLock });
const steelPerTurn = steel.lobes * steel.barrelTeeth / steel.pinionTeeth;
console.log(`  COUNTED: the barrel's 16T drives the middle arbor's 8T, its 16T the fly arbor's 8T — ${M.STRIKE_CHAIN.map(([a, b]) => `${a}:${b}`).join(' × ')} = ${ratStr(ratio)} turns of the fly arbor per barrel turn (the steel: ${steel.barrelTeeth}/${steel.pinionTeeth}); traced over them, ${perTurn} strikes per barrel turn (the steel's ${steel.lobes} lobes × ${steel.barrelTeeth}/${steel.pinionTeeth} = ${steelPerTurn})`);
if (!ratEq(ratio, ratQ(steel.barrelTeeth, steel.pinionTeeth))) strErrs.push(`the strike ratio ${ratStr(ratio)} is not the steel's ${steel.barrelTeeth}/${steel.pinionTeeth}`);
if (M.CAM_LOBES !== steel.lobes) strErrs.push(`${M.CAM_LOBES} lobes, the steel has ${steel.lobes}`);
if (perTurn !== steelPerTurn) strErrs.push(`${perTurn} strikes per barrel turn, the steel's ${steelPerTurn}`);
const T = M.TECHNIC_ALARM_STRIKE;
console.log(`  POSED: ${T.status} — ${T.source}`);
console.log(`    governor: ${T.governor}`);
console.log(`    stand-in: ${T.standIn.barrelTurns} barrel turns of wind and a ${T.standIn.strikeGap} s gap (main.js: ALARM_BARREL_TURNS ${steel.turns}, ALARM_STRIKE_GAP ${steel.gap}) → ${M.strikesPerWind(perTurn)} strikes per wind (the steel's ${steel.turns * steelPerTurn}), ${(M.strikesPerWind(perTurn) * T.standIn.strikeGap).toFixed(2)} s of ringing — POSED, to be measured`);
if (T.status !== 'POSED' || !/to be measured/.test(T.source)) strErrs.push('the strike table does not say it is POSED and still to be measured');
if (!/FLY/.test(T.governor) || !/not the steel anchor/.test(T.governor)) strErrs.push('the strike table does not say the governor is a fly and not the anchor');
if (T.standIn.barrelTurns !== steel.turns || T.standIn.strikeGap !== steel.gap) strErrs.push('the stand-in\'s numbers are not main.js\'');
for (const e of strErrs) fail(e);
{ const rev = M.strikeTrace(h, -S.run, { step: 1, from: phiLock }), rev4 = M.strikeTrace(h, -S.run, { step: 0.25, from: phiLock });
  control('the strike train run the other way (the pins meet the tail face-on)', rev.jam || rev4.jam || rev4.rate > M.RATE_HOLD * rev.rate || rev.falls.length !== M.CAM_LOBES); }
control('a different POSED table (2.5 turns of wind) moves strikes per wind with no code change', M.strikesPerWind(perTurn, { ...T, standIn: { ...T.standIn, barrelTurns: 2.5 } }) !== M.strikesPerWind(perTurn));

// ── TRAINS ──────────────────────────────────────────────────────────────────
console.log('\ntrains:');
const trainErrs = [];
const fork = TECHNIC_FORK.rows.find((r) => r.key === 'motion works').chains.technic_classic;
const reversed = [...fork].reverse().map(([a, b]) => [b, a]);
const relRatio = M.RELEASE_CHAIN.reduce((p, [a, b]) => ratMul(p, ratQ(a, b)), ratQ(1));
console.log(`  RELEASE: ${M.RELEASE_CHAIN.map(([a, b]) => `${a}:${b}`).join(' × ')} = ${ratStr(relRatio)} — the fork's classic motion-works pairs ${fork.map(([a, b]) => `${a}:${b}`).join(' × ')}, each run the other way; the disc turns once in 12 h off an hour axle turning once an hour`);
// the same three pairs, each run the other way (driver and driven swapped); their
// order along the train is the frame's, so they are compared as a multiset
const pairKeys = (c) => c.map(([a, b]) => `${a}:${b}`).sort().join(' ');
if (pairKeys(reversed) !== pairKeys(M.RELEASE_CHAIN)) trainErrs.push('the release chain is not the fork\'s motion-works pairs run the other way');
if (!ratEq(relRatio, ratQ(1, 12))) trainErrs.push(`the release chain is ${ratStr(relRatio)}, not 1/12`);
const sh = frame.shafts, cat = CATALOGUES.technic_classic, find = (t) => cat.counts.find((c) => c.teeth === t);
const meshAt = [['hour', sh.H0, 'S1', sh.S1, M.RELEASE_CHAIN[0]], ['S1', sh.S1, 'S2', sh.S2, M.RELEASE_CHAIN[1]], ['S2', sh.S2, 'disc', sh.D, M.RELEASE_CHAIN[2]],
  ['barrel', sh.B, 'middle', sh.I, M.STRIKE_CHAIN[0]], ['middle', sh.I, 'fly', sh.C, M.STRIKE_CHAIN[1]]];
for (const [na, pa, nb, pb, [ta, tb]] of meshAt) {
  const m = catalogueMesh(find(ta), find(tb), cat), d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
  if (!m || !near(m.cd, d, 1e-9)) trainErrs.push(`${na} → ${nb}: ${ta}:${tb} at ${d.toFixed(3)} mm, the mesh wants ${m?.cd}`);
}
console.log(`  every mesh admissible and at its centre distance: ${meshAt.map(([na, , nb, , [ta, tb]]) => `${na}→${nb} ${ta}:${tb}`).join(', ')}`);
for (const e of trainErrs) fail(e);

// ── BUILD ───────────────────────────────────────────────────────────────────
console.log('\nbuild:');
function frameErrors(f) {
  const errs = [];
  for (const c of f.columns) {
    const ax = f.axles.find((a) => a.shaft === c.shaft);
    if (Math.abs(c.top - D.brickH + D.holeZ - ax.z) > 1e-6) errs.push(`${c.shaft} ${c.end}: its hole is not at its axle's height`);
    if (c.slot - D.stud / 2 < ax.y0 - 1e-6 || c.slot + D.stud / 2 > ax.y1 + D.stud / 2 + 1e-6 || (c.slot + D.stud / 2 > ax.y1 + 1e-6 && c.slot - D.stud / 2 < ax.y1 - D.stud / 2)) {
      if (!(ax.y1 >= c.slot - D.stud / 2 + 2 && ax.y0 <= c.slot + D.stud / 2 - 2)) errs.push(`${c.shaft} ${c.end}: its axle does not pass its brick`);
    }
  }
  return errs;
}
const fe = frameErrors(frame);
for (const e of fe) fail(e);
console.log(`  ${frame.columns.length} columns and ${frame.stacks.length} stacks on a ${frame.base.studsX}×${frame.base.studsY}-stud base; the lever's axle at ${frame.zL} mm; axles ${frame.axles.map((a) => `${a.shaft} ${a.lenStuds}L`).join(', ')}`);
// MESHES: each placed gear pair interleaved (not in each other); half a tooth round, they are
const pairsOf = (b) => {
  const P2 = placedParts(b), gears = P2.filter((p) => p.teeth);
  const byBody = new Map(); for (const s of b.shafts) for (const p of s.parts) if (p.teeth) byBody.set(p, s);
  return { P2, gears };
};
const meshErr = (b, shift = 0) => {
  const bodies = Object.fromEntries(b.shafts.map((s) => [s.shaft, s]));
  const pairs = [['fly', 'middle', P.spur8, P.spur16, M.ALARM_Y.flyPinion], ['middle', 'barrel', P.spur8, P.spur16, M.ALARM_Y.strikeMid],
    ['disc', 'S2', P.spur24, P.spur8, M.ALARM_Y.trainA], ['S2', 'S1', P.spur16, P.spur8, M.ALARM_Y.trainB], ['S1', 'hour', P.spur16, P.spur8, M.ALARM_Y.trainC]];
  return pairs.map(([a, bb, pa, pb]) => {
    const A1 = bodies[a], B1 = bodies[bb];
    const ca = [A1.origin[0] * LDU_MM, A1.origin[1] * LDU_MM], cb = [B1.origin[0] * LDU_MM, B1.origin[1] * LDU_MM];
    return { pair: `${a}⇄${bb}`, depth: penetration(starProfile(lib, pa), ca, A1.phi, starProfile(lib, pb), cb, B1.phi + shift) };
  });
};
const armedBuild = M.alarmBuild(frame, lib, states.armed);
const me = meshErr(armedBuild);
console.log(`  MESHES: ${me.map((m) => `${m.pair} ${m.depth.toFixed(3)}`).join(', ')} mm (≤ 0: interleaved, not in each other)`);
for (const m of me) if (m.depth > 0.05) fail(`${m.pair}: the teeth stand ${m.depth.toFixed(3)} mm into each other`);
control('a gear turned half a tooth out of mesh', meshErr(armedBuild, Math.PI / 16).some((m) => m.depth > 0.5));
// CLEAR, at each state: every placed part's sampled surface over an LDU from every part it does not bear on
const CLEAR_LDU = 1;
// A placement's surface is a FLAT cloud (technic-ldraw's placedCloud: the
// part's samples kept once, transformed in flight), never a boxed point per
// sample per placement — the three states' 258 clouds were 3.8 GB that way and
// died at Node's default heap. The gap is cloudGap's: a 4 LDU reach, 2 LDU
// cells, the 27 around each sample, the same reading to the bit.
const cloudCache = new Map();
function cloud(p) {
  const key = `${p.part}|${p.m.join(',')}`;
  if (!cloudCache.has(key)) cloudCache.set(key, placedCloud(lib, p, 0.5));
  return cloudCache.get(key);
}
function gap(A1, B1) { return cloudGap(A1, B1, { reach: 4, cell: 2 }); }
// BEARING BY DESIGN, and so skipped: a body's own parts; the columns among
// themselves (frame-checked above); an axle in a Technic brick, in a pin hole
// it turns in (the driver on the column wheel's axle, the pawl on its pivot),
// in the lever's beak hole; the lever on the disc's pins (it rests on them),
// the lever and the fly's beam (the lock), the beak's pin on a column (off);
// the follower and the pawl's 8T in the 12T (seated); the driver on its rest
// stack; the hammer's head on its stack; a gear pair in mesh (held above);
// §288's pusher on the driver's half bush (its tip and the rod's end flush with
// it; probe-technic-pusher.mjs holds that contact on the parts).
const MESHED = new Set(['fly|middle', 'middle|barrel', 'disc|S2', 'S2|S1', 'S1|hour']);
function bears(a, b, mode) {
  const r = [a.p.role, b.p.role], sh2 = [a.sh?.shaft, b.sh?.shaft];
  const has = (x, y) => (r[0] === x && r[1] === y) || (r[0] === y && r[1] === x);
  const pair = (x, y) => (sh2[0] === x && sh2[1] === y) || (sh2[0] === y && sh2[1] === x);
  if (r.includes('axle') && r.includes('technicBrick')) return true;
  if (pair('driver', 'column wheel') && r.includes('axle') && r.includes('driver')) return true;
  if (pair('pawl', 'driver') && r.includes('axle') && (r.includes('arm') || r.includes('driver'))) return true;
  if (pair('lever', 'disc') && r.includes('lever') && r.includes('pin')) return true;
  if (pair('lever', 'fly') && r.includes('lever') && r.includes('beam') && mode !== 'ringing') return true;
  if (pair('lever', 'column wheel') && r.includes('pin') && r.includes('rotor') && mode === 'off') return true;
  if (pair('detent', 'column wheel') && has('follower', 'wheel')) return true;
  if (pair('pawl', 'column wheel') && has('pawl', 'wheel')) return true;
  if (sh2.includes('driver') && r.includes('tile') && r.includes('driver')) return true;
  if (sh2.includes('hammer') && r.includes('tile') && r.includes('arm')) return true;
  if (pair('pusher', 'driver') && r.includes('follower') && (r.includes('pushTip') || r.includes('axle'))) return true;
  if (MESHED.has(`${sh2[0]}|${sh2[1]}`) || MESHED.has(`${sh2[1]}|${sh2[0]}`)) if (r[0] === 'gear' && r[1] === 'gear' || has('gear', 'pawl')) return true;
  return false;
}
function clearErrors(b, mode) {
  const errs = [], worst = new Map(), all = [];
  b.statics.forEach((p) => { if (p.role !== 'baseplate') all.push({ p, body: 'static' }); });
  b.shafts.forEach((s, k) => placedParts({ ...b, statics: [], shafts: [s] }).forEach((p) => all.push({ p, body: k, sh: s })));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A1 = all[i], B1 = all[j];
    if (A1.body === B1.body) continue;
    if (bears(A1, B1, mode)) continue;
    const ca = cloud(A1.p), cb = cloud(B1.p);
    if ([0, 1, 2].some((d) => ca.lo[d] > cb.hi[d] + CLEAR_LDU || cb.lo[d] > ca.hi[d] + CLEAR_LDU)) continue;
    const gg = gap(ca, cb), name = `${A1.sh?.shaft ?? 'frame'} ${A1.p.role} ${A1.p.part} ⇄ ${B1.sh?.shaft ?? 'frame'} ${B1.p.role} ${B1.p.part}`;
    if (gg < (worst.get(name) ?? Infinity)) worst.set(name, gg);
    if (gg < CLEAR_LDU) errs.push(`${name} come ${(gg * LDU_MM).toFixed(3)} mm apart`);
  }
  return { errs: [...new Set(errs)], near: [...worst].sort((a, c) => a[1] - c[1]).slice(0, 4).map(([n, d]) => `${n} ${(d * LDU_MM).toFixed(2)} mm`) };
}
const builds = {};
for (const mode of ['armed', 'ringing', 'off']) {
  const b = mode === 'armed' ? armedBuild : M.alarmBuild(frame, lib, states[mode]);
  builds[mode] = b;
  const c = clearErrors(b, mode);
  console.log(`  CLEAR ${mode}: ${c.errs.length ? `${c.errs.length} too close` : 'clear'}; nearest ${c.near.join('; ')}`);
  for (const e of c.errs) fail(`${mode}: ${e}`);
}
{ // CLEAR's control: ringing, the beak stands in a gap; turn the column wheel half
  // a column pitch (30°) and a column stands where the beak's pin is
  const b = M.alarmBuild(frame, lib, states.ringing);
  const cw = b.shafts.find((s) => s.shaft === 'column wheel');
  cw.phi += Math.PI / 6;
  control('the column wheel turned half a column pitch under the dropped beak', clearErrors(b, 'ringing').errs.length > 0);
}
// THE FILE: the .ldr parsed back
const ldr = toLdr(armedBuild), lines = ldr.split('\n').filter((l) => l.startsWith('1 '));
const want = placedParts(armedBuild);
if (lines.length !== want.length) fail(`the .ldr has ${lines.length} parts, the build ${want.length}`);
for (const [k, l] of lines.entries()) {
  const t = l.split(/\s+/), file = t[14];
  if (!lib.get(file)) { fail(`the .ldr names ${file}, which the pack does not hold`); break; }
  if (`${want[k].part}.dat` !== file || t.slice(2, 14).some((v, i) => Math.abs(Number(v) - want[k].m[i]) > 1e-4)) { fail(`the .ldr's line ${k + 1} is not the build's placement`); break; }
}
console.log(`  the .ldr: ${lines.length} parts, each a placement of the build, every file in the pack`);

console.log('\ncontrols:');
for (const [n, ok] of ctl) { console.log(`  ${ok ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!ok) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nevery full press steps one rest and turns the alarm on or off, a half press falls back; the lever drops ${deg(st.psiNotch - st.rimDown)}° at the notch and frees the fly; ${perTurn} strikes per barrel turn, and per wind the POSED table's ${M.strikesPerWind(perTurn)} — controls ${ctl.length}/${ctl.length}`);
process.exit(fails ? 1 : 0);
