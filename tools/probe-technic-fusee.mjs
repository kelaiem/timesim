// DOES THE LEGO FUSEE LEVEL ITS SPRING AS WELL AS A STAIRCASE CAN, AND DOES ITS
// MAINTAINING POWER DRIVE THE GREAT WHEEL THE RIGHT WAY WHILE IT IS WOUND?
// Acceptance, pure Node, no browser, no network; exits non-zero on any
// failure. §219 tier three (b), landing H (src/technic-fusee.js).
//
// MODELLED, NOT SIMULATED: every reading below is geometry read off the
// vendored LDraw parts, and the spring's law is a POSED table (a stand-in for
// a measurement nobody has made). Nothing is integrated and no force is
// weighed; where a pawl LOCKS, that is a direction read off the teeth.
//
//   · SPRING — the table says POSED and names its source as still to be
//     measured; its stand-in is the steel ribbon's law at the steel's set-up
//     and band, and the three numbers it is built from (SETUP_CLICKS,
//     SETUP_RATCHET_TEETH, SPRING_TQ_EMPTY's recorded value) are read back off
//     main.js' TEXT — a stand-in that drifts from the law it names fails;
//   · PARTS — every figure in FUSEE_DIM_MM re-read off the parts: each
//     pulley's cord SEAT (grooveSeat: the cord's circle resting in the groove),
//     rim, side-by-side capacity, floor and half width; each string's length
//     between its end studs; the cord's section; the end stud's and the hook
//     plate's figures; the 40T's off-centre axle holes; the joiner; the arm's
//     middle hole;
//   · STEPS — the declared barrel and steps are what solveFusee answers from
//     the table (every barrel and every descending set of grooved steps, the
//     least spread of torque × radius); the step radii against the ideal r(θ),
//     the LEVEL PRODUCT's spread over the run against the bare spring's and
//     against the steel fusee's gate (its level product held at 1e-9);
//   · CORD — the cord's length per step and per piece, the string the solve
//     picks and the dead wrap it leaves on the barrel (inside the barrel's one
//     groove with the run), the path's length EQUAL to the string's, the span's
//     fleet angle, and each WRAP resting in its own groove (its centreline a
//     cord radius from that part's surface) and clear of every other part;
//   · MAINTAINING — the going sense read off the cord's pull; the click's and
//     the detent's lock directions read off the teeth (pawlLock); the band's
//     moment on the great wheel; and from those, per mode, which way each
//     member turns: while WINDING the fusee runs back, the click frees, the
//     detent holds the ratchet and the band drives the great wheel FORWARD;
//     while GOING the click drives the ratchet and the detent frees. The
//     declared click sense and detent pivot are what solveMaintaining answers;
//   · BUILD — every column contiguous from the baseplate, its hole at its
//     axle's height; every wheel's bore on its axle's line inside its span;
//     each pawl's 8T touching its wheel and not in it; each hook's end stud on
//     its plate's stud; CLEAR — every placed part over an LDU from every part it
//     does not bear on, at three turns of the maintaining axle; and the .ldr
//     round trip.
//
// WHAT THIS DOES NOT CLAIM: a force, a torque in N·mm, a rate, a run time; the
// cord's crossings between steps and its legs to the hooks BEAR on rims and
// groove walls, which the model places and does not measure; the chain fusee
// (unproven until the sprocket-crossing experiment is run).
//
// CONTROLS, each seen to fail: a seat perturbed; a declared step set other
// than the solver's; a band the declared steps cannot carry; a wrap sunk an LDU into
// its groove, and one slid onto its neighbour's plane; the click on its other
// side; the detent with its band reversed; the band with the great wheel AHEAD
// of the ratchet; and a re-solve from a different (measured-looking) table that
// moves the answer with no code change — the spring-agnostic claim, shown;
// the click's 8T slid onto the column it clears; the detent's 8T turned into
// the ratchet.
//
//   node tools/probe-technic-fusee.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, placements, LDU_MM } from '../src/ldraw.js';
import { LEGO_DIM_MM as D, GEAR_TIP_MM } from '../src/technic-frame.js';
import { placedParts, toLdr, surfaceSamples } from '../src/technic-ldraw.js';
import {
  TECHNIC_FUSEE_SPRING, STEEL_STAND_IN, springTorque, springBand, FUSEE_PULLEYS, FUSEE_STRINGS, FUSEE_PARTS, FUSEE_DIM_MM,
  grooveSeat, fuseeRun, solveFusee, idealAgainst, TECHNIC_FUSEE, cordChoice, frameFusee, cordPath, pathLength,
  goingSense, spanTangent, bandMoment, BAND_LAG_DEG, MAINTAINING, clickSpec, detentSpec, pawlLock, pawlModel, solveMaintaining,
  axleHoleOffsets, fuseeBuild, AX_CLEAR,
} from '../src/technic-fusee.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8');
const lib = parseLibrary(PACK);
const L = (mm) => mm / LDU_MM;
const B = (p) => bounds(lib, `${p}.dat`);
const deg = (r) => (r * 180 / Math.PI).toFixed(2);
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ctl = [];
const control = (name, caught) => { ctl.push([name, caught]); };

console.log('THE LEGO FUSEE — a cord on a stepped cone, a barrel, two hooks and Harrison\'s maintaining power (MODELLED)\n');

// ── SPRING ──────────────────────────────────────────────────────────────────
const T = TECHNIC_FUSEE_SPRING;
console.log(`spring: ${T.status} — ${T.source}`);
if (T.status !== 'POSED') fail('the spring table does not say it is POSED');
if (!/to be measured/.test(T.source)) fail('the spring table does not name its source as still to be measured');
const MAIN = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const textNum = (re) => { const m = re.exec(MAIN); return m ? Number(m[1]) : NaN; };
const fromMain = {
  setupClicks: textNum(/const SETUP_CLICKS = (\d+);/),
  ratchetTeeth: textNum(/const SETUP_RATCHET_TEETH = (\d+);/),
  emptyFraction: textNum(/const SPRING_TQ_EMPTY = SETUP_SWEEP \/ SPRING_WIND_FULL; \/\/ ([0-9.]+)/),
};
for (const k of ['setupClicks', 'ratchetTeeth', 'emptyFraction'])
  if (!(STEEL_STAND_IN[k] === fromMain[k])) fail(`the stand-in's ${k} is ${STEEL_STAND_IN[k]}, main.js' text says ${fromMain[k]}`);
const uS = STEEL_STAND_IN.setupClicks / STEEL_STAND_IN.ratchetTeeth, uF = uS / STEEL_STAND_IN.emptyFraction;
for (const [t, m] of T.rows) if (Math.abs(m - (uS + t) / uF) > 1e-6) fail(`row ${t}: torque ${m}, the stand-in law gives ${((uS + t) / uF).toFixed(6)}`);
if (!T.rows.every((r, i) => i === 0 || (r[0] > T.rows[i - 1][0] && r[1] >= T.rows[i - 1][1]))) fail('the table is not ascending in turns with torque rising');
console.log(`  stand-in: ${T.standIn.law}, set up ${STEEL_STAND_IN.setupClicks}/${STEEL_STAND_IN.ratchetTeeth} turn, torque at run-down ${STEEL_STAND_IN.emptyFraction} of full (main.js: ${fromMain.setupClicks}, ${fromMain.ratchetTeeth}, ${fromMain.emptyFraction}); band ${springBand(T).toFixed(6)} barrel turns over ${T.rows.length} rows`);

// ── PARTS ───────────────────────────────────────────────────────────────────
console.log('\nparts (each figure re-read off the vendored parts):');
const F = FUSEE_DIM_MM;
const near = (a, b, t = 1e-4) => Math.abs(a - b) <= t;
function partErrors(dims) {
  const errs = [];
  for (const p of FUSEE_PULLEYS) {
    const g = grooveSeat(lib, p), b = B(p);
    if (!near(g.seat, dims.seat[p])) errs.push(`${p}: seat ${g.seat.toFixed(5)} mm, table ${dims.seat[p]}`);
    if (!near(g.rim, dims.rim[p])) errs.push(`${p}: rim ${g.rim.toFixed(5)} mm, table ${dims.rim[p]}`);
    if (g.capacity !== dims.capacity[p]) errs.push(`${p}: holds ${g.capacity} cords side by side, table ${dims.capacity[p]}`);
    if (!near((g.floor[1] - g.floor[0]) / 2, dims.floorHalf[p], 0.02)) errs.push(`${p}: floor ±${((g.floor[1] - g.floor[0]) / 2).toFixed(3)} mm, table ${dims.floorHalf[p]}`);
    if (!near((b.hi[2] - b.lo[2]) * LDU_MM / 2, dims.halfWidth[p])) errs.push(`${p}: half width ${((b.hi[2] - b.lo[2]) * LDU_MM / 2).toFixed(4)}, table ${dims.halfWidth[p]}`);
  }
  for (const s of Object.values(FUSEE_STRINGS)) {
    const e = placements(lib, `${s}.dat`, /71149k01/).map((q) => q.m);
    const len = e.length === 2 ? Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1], e[1][2] - e[0][2]) * LDU_MM : NaN;
    if (!near(len, dims.string[s])) errs.push(`${s}: ${len} mm between its end studs, table ${dims.string[s]}`);
  }
  const seg = B(FUSEE_PARTS.cordSegment);
  if (!near((seg.hi[1] - seg.lo[1]) * LDU_MM / 2, dims.cordR)) errs.push(`cord: radius ${(seg.hi[1] - seg.lo[1]) * LDU_MM / 2}, table ${dims.cordR}`);
  const end = B(FUSEE_PARTS.cordEnd);
  if (!near(end.hi[0] * LDU_MM, dims.endR) || !near(end.hi[1] * LDU_MM, dims.endH) || !near(-end.lo[1] * LDU_MM, dims.endStudH)) errs.push('the end stud\'s radius, body or stud height differs from the table');
  const segY = placements(lib, `${Object.values(FUSEE_STRINGS)[0]}.dat`, /71149k02/)[0].m[1] * LDU_MM;
  if (!near(segY, dims.endCord)) errs.push(`the cord leaves its end stud ${segY} mm under its top, table ${dims.endCord}`);
  const plate = B(FUSEE_PARTS.hookPlate), studs = placements(lib, `${FUSEE_PARTS.hookPlate}.dat`, /stud10/);
  if (!near(plate.hi[1] * LDU_MM, dims.plateH)) errs.push(`the hook plate is ${plate.hi[1] * LDU_MM} mm thick, table ${dims.plateH}`);
  if (studs.length !== 4 || studs.some((q) => !near(Math.hypot(q.m[0], q.m[2]) * LDU_MM, dims.plateStud))) errs.push('the hook plate\'s four studs do not stand at the table\'s radius');
  const holes = axleHoleOffsets(lib, FUSEE_PARTS.ratchet);
  if (holes.length !== 4 || holes.some((h) => !near(Math.hypot(...h), dims.wheelHole))) errs.push(`the 40T's off-centre axle holes stand at ${holes.map((h) => Math.hypot(...h).toFixed(4)).join(', ')} mm, table ${dims.wheelHole}`);
  const w40 = B(FUSEE_PARTS.ratchet), w16 = B(FUSEE_PARTS.clickWheel), j = B(FUSEE_PARTS.connector);
  if (!near((w40.hi[2] - w40.lo[2]) * LDU_MM / 2, dims.wheelHalf)) errs.push('the 40T\'s half width differs');
  if (!near((w16.hi[2] - w16.lo[2]) * LDU_MM / 2, dims.clickHalf)) errs.push('the 16T\'s half width differs');
  if (!near(j.hi[0] * LDU_MM, dims.connectorHalf) || !near(j.hi[1] * LDU_MM, dims.connectorR)) errs.push('the joiner\'s length or radius differs');
  const armHoles = placements(lib, `${FUSEE_PARTS.arm}.dat`, /peghole|axlehol/).map((q) => q.m[2]);
  if (!armHoles.some((z) => near(z * LDU_MM, dims.armMid))) errs.push('the arm has no hole at its middle');
  const arm = B(FUSEE_PARTS.arm);
  if (!near(arm.hi[0] * LDU_MM, dims.armHalfWidth)) errs.push('the arm\'s half width differs');
  return errs;
}
const pe = partErrors(F);
for (const p of FUSEE_PULLEYS) { const g = grooveSeat(lib, p); console.log(`  ${p.padEnd(7)} seat ${g.seat.toFixed(4)} mm, rim ${g.rim.toFixed(4)}, floor ±${((g.floor[1] - g.floor[0]) / 2).toFixed(3)}, ${g.capacity} cord${g.capacity > 1 ? 's' : ''} side by side`); }
console.log(`  strings ${Object.entries(FUSEE_STRINGS).map(([n, s]) => `${n}L ${s} ${F.string[s]} mm`).join(', ')}; cord radius ${F.cordR} mm; the 40T's axle holes ${F.wheelHole} mm out`);
for (const e of pe) fail(e);
control('a cord seat perturbed by 0.01 mm', partErrors({ ...F, seat: { ...F.seat, '4185a': F.seat['4185a'] + 0.01 } }).length > pe.length);

// ── STEPS ───────────────────────────────────────────────────────────────────
console.log('\nsteps (solveFusee over every barrel and every descending set of grooved steps):');
const solved = solveFusee(T), run = solved.best;
for (const r of solved.ranked.slice(0, 6))
  console.log(`  ${r === run ? '→' : ' '} barrel ${r.barrel.padEnd(6)} steps ${r.steps.join(' > ').padEnd(16)} base wrap ${r.f.toFixed(3)} turn, spread ${(r.spread * 100).toFixed(2)}%`);
console.log(`    … ${solved.ranked.length} runs fit their tables; the bare spring's spread over the band is ${(run.bare * 100).toFixed(2)}%`);
const stepsErr = (spec) => (run && spec.barrel === run.barrel && JSON.stringify(spec.steps) === JSON.stringify(run.steps) ? [] : [`declared barrel ${spec.barrel}, steps ${spec.steps.join('>')}; the solve says ${run?.barrel}, ${run?.steps.join('>')}`]);
for (const e of stepsErr(TECHNIC_FUSEE)) fail(e);
control('a declared step set other than the solver\'s', stepsErr({ barrel: TECHNIC_FUSEE.barrel, steps: ['3736', '3482'] }).length > 0);
// THE IDEAL r(θ) and the level product
for (const s of idealAgainst(run)) console.log(`  step ${s.part.padEnd(6)} seat ${s.seat.toFixed(3)} mm over θ ${s.from.toFixed(4)}–${s.to.toFixed(4)} turns; ideal r there ${s.idealFrom.toFixed(3)} → ${s.idealTo.toFixed(3)} mm`);
const INSPECT = readFileSync(join(ROOT, 'src/inspect.js'), 'utf8');
const steelTol = Number(/what: 'level product', maxDev: [^,]+, tol: ([0-9.e-]+)/.exec(INSPECT)?.[1]);
console.log(`  LEVEL PRODUCT: torque × radius spreads ${(run.spread * 100).toFixed(2)}% (${run.lo.toFixed(4)}–${run.hi.toFixed(4)} of full-wind torque × mm, mean ${run.mean.toFixed(4)}) over the run; the bare spring ${(run.bare * 100).toFixed(2)}%; the steel fusee's level product is gated at a deviation of ${steelTol} (inspect.js equalisation) — the staircase is ${(run.spread / steelTol).toExponential(2)} times that`);
if (!(run.spread < run.bare)) fail('the staircase does not level the spring at all');
if (!Number.isFinite(steelTol)) fail('the steel gate\'s tolerance was not found in inspect.js');
control('a band the declared steps cannot carry (three times as long) is refused, never stretched', !fuseeRun({ ...T, rows: T.rows.map(([t, m]) => [3 * t, m]) }, run.barrel, run.steps).ok);
// SPRING-AGNOSTIC: a table that looks measured (a rubber band's twist: soft at
// first, then stiffening — no steel law at all, three turns) re-solves with no
// code change, and the answer moves
const bandish = { ...T, status: 'CONTROL', rows: [[0, 0.30], [0.5, 0.38], [1, 0.47], [1.5, 0.58], [2, 0.72], [2.5, 0.86], [3, 1]] };
const alt = solveFusee(bandish, { capacity: { ...F.capacity, '3736': 3 } }).best;
console.log(`  a measured-looking table (a band's twist, 0.30 → 1 over 3 turns, the barrel given room) re-solves to barrel ${alt?.barrel}, steps ${alt?.steps.join(' > ')}, spread ${alt ? (alt.spread * 100).toFixed(2) : '—'}% (bare ${alt ? (alt.bare * 100).toFixed(2) : '—'}%)`);
control('a different table re-solves to a different answer, no code change', !!alt && (alt.barrel !== run.barrel || JSON.stringify(alt.steps) !== JSON.stringify(run.steps)));

// ── FRAME, CORD ─────────────────────────────────────────────────────────────
const frame = frameFusee();
if (!frame.framed) { fail(`not framed: ${frame.reason}`); }
const cord = cordPath(frame, run);
console.log(`\ncord (at full wind; the barrel ${run.barrel} at x 0, the fusee ${frame.cd} mm off, axles ${frame.axleZ} mm up):`);
const wrapLens = run.segs.map((s) => `${s.kind} on ${run.steps[s.step]} ${s.len.toFixed(2)} mm`);
console.log(`  on the cone: ${wrapLens.join(', ')} — ${run.cordOnCone.toFixed(2)} mm, ${(run.cordOnCone / (2 * Math.PI * run.rb)).toFixed(4)} barrel turns (the band is ${run.band.toFixed(4)})`);
console.log(`  legs: cone ${(pathLength(cord.path.slice(0, 4))).toFixed(2)} mm, barrel ${cord.legB.toFixed(2)} mm; span ${Math.hypot(cord.span.len2d, frame.barrel.y - frame.fusee.steps.at(-1).wrapY).toFixed(2)} mm, its fleet angle ${deg(Math.atan2(Math.abs(frame.barrel.y - frame.fusee.steps.at(-1).wrapY), cord.span.len2d))}° at full wind, ${deg(Math.atan2(Math.abs(frame.barrel.y - frame.fusee.steps[0].wrapY), cord.span.len2d))}° at run-down`);
console.log(`  strings: ${cord.choice.opts.map((o) => `${o.studs}L ${o.length} mm (dead ${o.dead.toFixed(2)})`).join(', ')}; the barrel's groove has room for ${cord.choice.room.toFixed(2)} mm dead → ${cord.string ? `${cord.string.studs ?? ''}L ${cord.string.part}, ${cord.string.dead.toFixed(2)} mm dead on the barrel` : 'NONE FITS'}`);
if (!cord.string) fail('no string reaches the path with its spare length inside the barrel\'s groove');
if (cord.string && !near(cord.length, cord.string.length, 1e-6)) fail(`the path is ${cord.length.toFixed(6)} mm, the string ${cord.string.length}`);
// THE WRAPS: centreline samples against every part's sampled surface
const build = fuseeBuild(frame, lib, { run });
const placed = placedParts(build);
const solid = placed.filter((p) => !['cord', 'cordEnd', 'baseplate'].includes(p.role));
const cloudCache = new Map();
function cloud(p) {
  const key = `${p.part}|${p.m.join(',')}`;
  if (cloudCache.has(key)) return cloudCache.get(key);
  const m = p.m, out = surfaceSamples(lib, p.part, 0.5).map(([x, y, z]) => [m[0] + m[3] * x + m[4] * y + m[5] * z, m[1] + m[6] * x + m[7] * y + m[8] * z, m[2] + m[9] * x + m[10] * y + m[11] * z]);
  const c = boxed(out); cloudCache.set(key, c); return c;
}
function boxed(pts) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const q of pts) for (let d = 0; d < 3; d++) { if (q[d] < lo[d]) lo[d] = q[d]; if (q[d] > hi[d]) hi[d] = q[d]; }
  return { pts, lo, hi };
}
const ldu = (q) => [L(q[0]), -L(q[2]), L(q[1])];   // frame mm → LDraw LDU
function wrapGap(points, part) {
  return gap(boxed(points), cloud(part)) * LDU_MM;
}
// the surface is sampled every half LDU, so the nearest sample can stand up to
// ~0.1 mm beyond the true surface: a wrap RESTS when its own groove's nearest
// sample is within that of the cord's radius, and is CLEAR of a part when the
// nearest sample is over a cord radius off
const SAMPLE_TOL = 0.1;
function wrapErrors(wraps) {
  const errs = [], rows = [];
  for (const w of wraps) {
    const own = solid.find((p) => p.part === w.part && p.role === w.role && Math.abs(p.m[2] - L(w.y)) < 1e-6 + L(F.halfWidth[w.part]));
    const pts = w.pts.map(ldu);
    const g = own ? wrapGap(pts, own) : NaN;
    if (!(Math.abs(g - F.cordR) <= SAMPLE_TOL)) errs.push(`the wrap on ${w.part} stands ${g.toFixed(3)} mm from its own groove's surface, not resting on it (cord radius ${F.cordR})`);
    let nearest = { g: Infinity };
    for (const p of solid) {
      if (p === own) continue;
      const gg = wrapGap(pts, p);
      if (gg < nearest.g) nearest = { g: gg, who: `${p.role} ${p.part}` };
    }
    if (!(nearest.g > F.cordR)) errs.push(`the wrap on ${w.part} comes within ${nearest.g.toFixed(3)} mm of ${nearest.who} — inside the cord`);
    rows.push(`${w.part}: on its seat (${g.toFixed(3)} mm to its groove), ${Number.isFinite(nearest.g) ? `nearest other part ${nearest.who} ${(nearest.g - F.cordR).toFixed(2)} mm clear of the cord` : `no other part within 0.8 mm of the cord`}`);
  }
  for (let i = 1; i < wraps.length; i++) if (Math.abs(wraps[i].y - wraps[i - 1].y) < 2 * F.cordR) errs.push(`the wraps on ${wraps[i - 1].part} and ${wraps[i].part} are ${Math.abs(wraps[i].y - wraps[i - 1].y).toFixed(3)} mm apart along the axle, under a cord's diameter`);
  return { errs, rows };
}
const circle = (x0, r, y, n = 120) => Array.from({ length: n }, (_, k) => [x0 + r * Math.cos(2 * Math.PI * k / n), y, frame.axleZ - r * Math.sin(2 * Math.PI * k / n)]);
const wraps = frame.fusee.steps.map((s) => ({ part: s.part, role: 'pulley', y: s.wrapY, pts: circle(frame.cd, s.seat, s.wrapY) }));
const barrelWrap = { part: frame.barrel.part, role: 'barrel', y: frame.barrel.y, pts: circle(0, frame.barrel.seat, frame.barrel.y) };
const we = wrapErrors([...wraps]), wb = wrapErrors([barrelWrap]);
console.log(`  the wraps: ${[...we.rows, ...wb.rows].join('; ')}`);
for (const e of [...we.errs, ...wb.errs]) fail(e);
control('a wrap sunk an LDU into its groove', wrapErrors([{ ...wraps[0], pts: circle(frame.cd, frame.fusee.steps[0].seat - 0.4, wraps[0].y) }]).errs.length > 0);
control('a wrap slid onto its neighbour\'s plane', wrapErrors([wraps[0], { ...wraps[1], y: wraps[0].y + 0.5, pts: circle(frame.cd, frame.fusee.steps[1].seat, wraps[0].y + 0.5) }]).errs.length > 0);

// ── MAINTAINING ─────────────────────────────────────────────────────────────
console.log('\nmaintaining power (directions read off the teeth; every force posed):');
const going = goingSense(frame);
const tp = spanTangent(frame, frame.fusee.steps.at(-1).seat);
console.log(`  GOING SENSE: the cord leaves the top step at (${tp.pC.map((v) => v.toFixed(2)).join(', ')}) mm toward the barrel, so it turns the fusee ${going > 0 ? '+' : '−'} about the axles (LDraw's rotZ sense)`);
const sm = solveMaintaining(lib, frame);
const lockStr = (l) => `+ ${l.plus.map((v) => v.toFixed(1)).join('/')} · − ${l.minus.map((v) => v.toFixed(1)).join('/')}`;
for (const c of sm.click) console.log(`  click, band ${c.sense > 0 ? '+' : '−'}: seats at ${deg(c.lock.seat)}°, steepest lift rate dψ/dθ (coarse/fine) ${lockStr(c.lock)} → locks ${c.lock.locks > 0 ? '+' : c.lock.locks < 0 ? '−' : 'neither way'}`);
console.log(`  detent: ${sm.candidates} pivots on the lattice clear of the click's sweep (${sm.sweep.toFixed(2)} mm), ${sm.seated} seat; tried in rank order:`);
for (const t of sm.tried) console.log(`    pivot (${t.dx}, ${t.dz}) mm, band ${t.sense > 0 ? '+' : '−'}: ${lockStr(t.lock)} → ${t.lock.locks > 0 ? 'locks +' : t.lock.locks < 0 ? 'locks −' : 'a slope, not a lock'}${t === sm.tried.at(-1) && sm.pick ? '  ←' : ''}`);
function maintErrors(declared, solve, { lagDeg = BAND_LAG_DEG, clickLocks = solve.click.find((c) => c.sense === declared.click.sense)?.lock.locks, detentLocks = solve.pick?.lock.locks } = {}) {
  const errs = [];
  if (!solve.clickPick || declared.click.sense !== solve.clickPick.sense) errs.push(`the click's band is declared ${declared.click.sense}, the solve says ${solve.clickPick?.sense}`);
  if (!solve.pick || declared.detent.pivot[0] !== solve.pick.dx || declared.detent.pivot[1] !== solve.pick.dz || declared.detent.sense !== solve.pick.sense)
    errs.push(`the detent is declared at (${declared.detent.pivot}) band ${declared.detent.sense}, the solve says (${solve.pick?.dx}, ${solve.pick?.dz}) band ${solve.pick?.sense}`);
  const band = bandMoment(solve.going, { lagDeg });
  // WINDING: the fusee runs −going; against the ratchet that is −going, the
  // click's free way when it locks +going. The band pulls the ratchet
  // band.ratchet; the detent must lock that way. The great wheel gets band.great.
  const winding = { clickFree: clickLocks === solve.going, detentHolds: detentLocks === band.ratchet, great: band.great };
  if (!winding.clickFree) errs.push('winding: the click does not free the fusee to run back');
  if (!winding.detentHolds) errs.push('winding: the detent does not hold the ratchet against the band');
  if (winding.great !== solve.going) errs.push(`winding: the band turns the great wheel ${winding.great > 0 ? '+' : '−'}, against the going sense`);
  // GOING: the fusee drives the ratchet through the click (it locks the going
  // way), and the ratchet runs the going way, which the detent must free
  if (clickLocks !== solve.going) errs.push('going: the click does not carry the fusee\'s drive to the ratchet');
  if (detentLocks === solve.going) errs.push('going: the detent stops the ratchet running forward');
  return { errs, band, winding };
}
const me = maintErrors(MAINTAINING, sm);
console.log(`  BAND: the great wheel lags the ratchet ${BAND_LAG_DEG}° (posed), so the band turns it ${me.band.great > 0 ? '+' : '−'} and pulls the ratchet ${me.band.ratchet > 0 ? '+' : '−'}`);
console.log(`  WINDING (the fusee turned ${going > 0 ? '−' : '+'}): click ${me.winding.clickFree ? 'free' : 'LOCKED'}, ratchet ${me.winding.detentHolds ? 'held by the detent' : 'NOT HELD'}, great wheel driven ${me.winding.great === going ? 'FORWARD (the going sense)' : 'BACKWARD'}`);
console.log(`  GOING (the fusee turned ${going > 0 ? '+' : '−'}): click locked, ratchet turns with the fusee, detent free, great wheel driven forward through the band`);
for (const e of me.errs) fail(e);
control('the click on its other side', maintErrors({ ...MAINTAINING, click: { sense: -MAINTAINING.click.sense } }, sm, { clickLocks: sm.click.find((c) => c.sense === -MAINTAINING.click.sense).lock.locks }).errs.length > 0);
const revD = pawlLock(lib, detentSpec(MAINTAINING.detent.pivot, -MAINTAINING.detent.sense), 40);
control('the detent with its band reversed', maintErrors({ ...MAINTAINING, detent: { ...MAINTAINING.detent, sense: -MAINTAINING.detent.sense } }, sm, { detentLocks: revD.locks }).errs.length > 0);
control('the band with the great wheel ahead of the ratchet', maintErrors(MAINTAINING, sm, { lagDeg: -BAND_LAG_DEG }).errs.length > 0);

// ── BUILD ───────────────────────────────────────────────────────────────────
console.log('\nbuild:');
function buildErrors(f, b) {
  const errs = [];
  // columns: contiguous from the baseplate, the hole at the axle's height
  for (const c of f.columns) {
    let z = 0;
    for (const bx of c.boxes) { if (Math.abs(bx.z0 - z) > 1e-6) errs.push(`${c.shaft} ${c.end}: a gap under its ${bx.part}`); z = bx.z1; }
    const hole = c.boxes.find((bx) => bx.hole), axle = f.axles.find((a) => a.shaft === c.shaft);
    if (!hole || Math.abs(hole.z0 + D.holeZ - axle.z) > 1e-6) errs.push(`${c.shaft} ${c.end}: its hole is not at its axle's height`);
    if (axle && (c.y - 4 < axle.y0 - 1e-6 || c.y + 4 > axle.y1 + 1e-6)) errs.push(`${c.shaft} ${c.end}: its axle does not fill its brick`);
  }
  // every wheel and pulley's bore on its body's axis, inside its axle's span
  const P = placedParts(b);
  for (const sh of b.shafts) for (const p of sh.parts) {
    if (!['pulley', 'barrel', 'hook', 'click', 'ratchet', 'great', 'knob'].includes(p.role)) continue;
    const q = P.find((x) => x.part === p.part && Math.abs(x.m[0] - sh.origin[0]) < 1e-6 && Math.abs(x.m[1] - sh.origin[1]) < 1e-6 && Math.abs(x.m[2] - p.m[2]) < 1e-6);
    if (!q) { errs.push(`${p.role} ${p.part}: not on its body's axis`); continue; }
    const ax = sh.parts.find((x) => x.role === 'axle' && Math.abs(x.m[0]) < 1e-9 && Math.abs(x.m[1]) < 1e-9);
    if (ax) { const half = (B(ax.part).hi[0] - B(ax.part).lo[0]) / 2; if (q.m[2] < ax.m[2] - half || q.m[2] > ax.m[2] + half) errs.push(`${p.role} ${p.part}: beyond its axle's end`); }
  }
  // the pawls: touching, not in
  for (const [name, spec, theta, psi] of [['click', clickSpec(MAINTAINING.click.sense), b.pose.phiF - b.pose.phiM, b.pose.psiC], ['detent', detentSpec(MAINTAINING.detent.pivot, MAINTAINING.detent.sense), b.pose.phiM, b.pose.psiD]]) {
    if (psi === null) { errs.push(`the ${name} pawl does not seat`); continue; }
    const m = pawlModel(lib, spec), d = m.depth(psi, theta);
    if (!(d <= 1e-6 && d > -0.05)) errs.push(`the ${name} pawl's 8T stands ${(-d).toFixed(4)} mm off its wheel (or in it)`);
  }
  // the hooks: each end stud on a hook plate stud
  const plates = P.filter((x) => x.role === 'hook'), ends = P.filter((x) => x.role === 'cordEnd');
  for (const e of ends) {
    const ok = plates.some((pl) => placements(lib, `${pl.part}.dat`, /stud10/).some((s) => {
      const w = [pl.m[0] + pl.m[3] * s.m[0] + pl.m[4] * s.m[1] + pl.m[5] * s.m[2], pl.m[1] + pl.m[6] * s.m[0] + pl.m[7] * s.m[1] + pl.m[8] * s.m[2], pl.m[2] + pl.m[9] * s.m[0] + pl.m[10] * s.m[1] + pl.m[11] * s.m[2]];
      return Math.hypot(w[0] - e.m[0], w[1] - e.m[1]) < 1e-3 && Math.abs(w[2] - (e.m[2] - L(F.endH))) < 1e-3;
    }));
    if (!ok) errs.push('a hook\'s end stud is not on a hook plate\'s stud');
  }
  return errs;
}
const be = buildErrors(frame, build);
console.log(`  ${frame.columns.length} columns, ${frame.axles.length} axles (${frame.axles.map((a) => `${a.shaft} ${a.lenStuds}L`).join(', ')}), base ${frame.base.studsX}×${frame.base.studsY} studs; ${build.statics.length + build.shafts.reduce((n, s) => n + s.parts.length, 0)} placements, ${build.statics.filter((p) => p.role === 'cord').length} of them cord segments`);
console.log(`  pose at full wind: fusee ${deg(build.pose.phiF)}°, barrel ${deg(build.pose.phiB)}°, ratchet ${deg(build.pose.phiM)}°, great wheel ${deg(build.pose.phiG)}°, click arm ${deg(build.pose.psiC)}°, detent arm ${deg(build.pose.psiD)}°`);
for (const e of be) fail(e);
// CLEAR: every placed part's sampled surface over an LDU from every part it
// does not bear on, at three turns of the maintaining axle (the click rides
// round with it, re-seated each time). Bearing by design, and so skipped: a
// body's own parts; an axle in a Technic brick, a joiner, an arm's hole or a
// wheel's hole; a pawl's 8T in its wheel (the pawl model's own measure); a
// wheel flush against a joiner or a column on its own line; two axles end to
// end in a joiner; a hook's end
// stud on its plate and against the base step's face.
const CLEAR_LDU = 1;
function gap(A, Bc) {
  const reach = 4;
  if ([0, 1, 2].some((d) => A.lo[d] > Bc.hi[d] + reach || Bc.lo[d] > A.hi[d] + reach)) return Infinity;
  const C = 2, grid = new Map(), key = (x, y, z) => `${Math.floor(x / C)},${Math.floor(y / C)},${Math.floor(z / C)}`;
  for (const q of Bc.pts) {
    if (q[0] < A.lo[0] - reach || q[0] > A.hi[0] + reach || q[1] < A.lo[1] - reach || q[1] > A.hi[1] + reach || q[2] < A.lo[2] - reach || q[2] > A.hi[2] + reach) continue;
    const k = key(...q); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(q);
  }
  let best = Infinity;
  for (const q of A.pts) {
    const cx = Math.floor(q[0] / C), cy = Math.floor(q[1] / C), cz = Math.floor(q[2] / C);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!cell) continue;
      for (const s of cell) { const d = Math.hypot(s[0] - q[0], s[1] - q[1], s[2] - q[2]); if (d < best) best = d; }
    }
  }
  return best;
}
const LINE = new Set(['pulley', 'hook', 'click', 'ratchet', 'great', 'knob', 'barrel', 'joiner']);
function clearErrors(b) {
  const errs = [], worst = new Map();
  const all = [];
  b.statics.forEach((p) => { if (!['cord', 'baseplate'].includes(p.role)) all.push({ p, body: 'static' }); });
  b.shafts.forEach((sh, k) => placedParts({ ...b, statics: [], shafts: [sh] }).forEach((p) => all.push({ p, body: k, sh })));
  const onLine = (x, y) => Math.abs(x.p.m[0] - y.p.m[0]) < 1e-6 && Math.abs(x.p.m[1] - y.p.m[1]) < 1e-6;
  const COL = new Set(['plate', 'brick', 'technicBrick']);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = all[i], Bx = all[j];
    if (A.body === Bx.body && A.body !== 'static') continue;
    if (A.body === 'static' && Bx.body === 'static') continue;          // the columns: frame-checked, and the cord's ends below
    const r = [A.p.role, Bx.p.role];
    const has = (a, c) => (r[0] === a && r[1] === c) || (r[0] === c && r[1] === a);
    if (r.includes('axle') && (r.includes('technicBrick') || r.includes('joiner') || r.includes('arm') || r.includes('ratchet') || r.includes('great') || r.includes('pawl'))) continue;
    if (has('click', 'pawl') || has('ratchet', 'pawl')) continue;
    if (has('axle', 'axle') && onLine(A, Bx)) continue;                 // two axles end to end in a joiner (each trimmed half an LDU)
    if (has('cordEnd', 'hook') || has('cordEnd', 'pulley') || has('cordEnd', 'barrel')) continue;
    if (LINE.has(r[0]) && LINE.has(r[1]) && onLine(A, Bx)) continue;    // face to face on one line (each one LDU or flush by the frame)
    if ((LINE.has(r[0]) && COL.has(r[1]) || LINE.has(r[1]) && COL.has(r[0])) && Math.abs((LINE.has(r[0]) ? A : Bx).p.m[0] - (COL.has(r[1]) ? Bx : A).p.m[0]) < 1e-6) continue;
    const ca = cloud(A.p), cb = cloud(Bx.p);
    if ([0, 1, 2].some((d) => ca.lo[d] > cb.hi[d] + CLEAR_LDU || cb.lo[d] > ca.hi[d] + CLEAR_LDU)) continue;
    const g = gap(ca, cb), name = `${A.p.role} ${A.p.part} ⇄ ${Bx.p.role} ${Bx.p.part}`;
    if (g < (worst.get(name) ?? Infinity)) worst.set(name, g);
    if (g < CLEAR_LDU) errs.push(`${name} come ${(g * LDU_MM).toFixed(3)} mm apart`);
  }
  return { errs: [...new Set(errs)], near: [...worst].sort((a, b2) => a[1] - b2[1]).slice(0, 5).map(([n, g]) => `${n} ${(g * LDU_MM).toFixed(2)} mm`) };
}
const clearRows = [];
for (const phiM of [0, 2 * Math.PI / 3, 4 * Math.PI / 3]) {
  const b = fuseeBuild(frame, lib, { run, phiM });
  const c = clearErrors(b);
  clearRows.push(`ratchet at ${deg(phiM)}°: ${c.errs.length ? `${c.errs.length} too close` : 'clear'}; nearest ${c.near.slice(0, 3).join('; ')}`);
  for (const e of c.errs) fail(`ratchet at ${deg(phiM)}°: ${e}`);
}
for (const r of clearRows) console.log(`  CLEAR ${r}`);
{ // CLEAR's control: the click's 8T slid one clearance forward, flush onto the
  // fusee's back column (where it stood before the click wheel was set off it)
  const b = fuseeBuild(frame, lib, { run, phiM: 2 * Math.PI / 3 });
  const pw = b.shafts.find((s) => s.shaft === 'click pawl').parts.find((p) => p.role === 'pawl');
  pw.m[2] -= L(AX_CLEAR);
  control('the click\'s 8T slid onto the fusee\'s back column', clearErrors(b).errs.length > 0);
  // BUILD's control: the detent's arm turned 0.05 rad further into the ratchet
  const b2 = fuseeBuild(frame, lib, { run });
  b2.pose = { ...b2.pose, psiD: b2.pose.psiD + MAINTAINING.detent.sense * 0.05 };
  control('the detent\'s 8T turned into the ratchet', buildErrors(frame, b2).length > be.length);
}
// THE FILE: the .ldr parsed back, the same placements, every part in the pack
const ldr = toLdr(build), lines = ldr.split('\n').filter((l) => l.startsWith('1 '));
const want = placedParts(build);
if (lines.length !== want.length) fail(`the .ldr has ${lines.length} parts, the build ${want.length}`);
for (const [k, l] of lines.entries()) {
  const t = l.split(/\s+/), file = t[14];
  if (!lib.get(file)) { fail(`the .ldr names ${file}, which the pack does not hold`); break; }
  if (`${want[k].part}.dat` !== file || t.slice(2, 14).some((v, i) => Math.abs(Number(v) - want[k].m[i]) > 1e-4)) { fail(`the .ldr's line ${k + 1} is not the build's placement`); break; }
}
console.log(`  the .ldr: ${lines.length} parts, each a placement of the build, every file in the pack`);

console.log('\ncontrols:');
for (const [n, ok] of ctl) { console.log(`  ${ok ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!ok) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nthe staircase levels torque × radius from ${(run.bare * 100).toFixed(2)}% to ${(run.spread * 100).toFixed(2)}% on a POSED law, and while it is wound the band drives the great wheel the going way, held off the detent`);
process.exit(fails ? 1 : 0);
