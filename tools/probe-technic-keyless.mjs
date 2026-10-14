// DOES THE LEGO KEYLESS WORKS CHANGE OVER, AND DOES EACH BRANCH CARRY THE
// STEEL RATIO? Acceptance, pure Node, no browser, no network; exits non-zero
// on any failure. §219 tier three (b), landings D and E.
//
// The steel stem's sliding pinion is LEGO's own transmission: two 16T clutch
// gears (18946) idle on the stem, a ridged joiner (18948) is keyed between
// them, and a driving ring (18947) slides on it into one gear's recess or the
// other's. `TECHNIC_KEYLESS` (layout.js) declares each branch from that clutch
// gear, `frameKeyless` (technic-frame.js) frames it and `ldrawBuild`
// (technic-ldraw.js) places it with a mode per ring position. This holds:
//
//   · ROWS — each branch's chain is the solver's answer from the clutch gear
//     (shortest, then fewest teeth), and multiplies EXACTLY to the target
//     derived from the steel counts: winding 5/12, setting 1/3;
//   · STROKE — read off the PLACED parts' own bounds, never the table: in
//     `wind` the ring's end stands in the winding gear's recess exactly the
//     recess's depth (seated on its web) and short of the setting gear's face;
//     in `set` the mirror; in `neutral` short of both. So the ring engages at
//     most ONE gear in every mode, and exactly one in wind and set;
//   · DOGGED — the four lugs on the ring's end and the four in the gear's
//     recess, each read off its part (its surface at the lugs' radius, and the
//     polygons that carry it for their axial run): in the engaged mode the two
//     sets OVERLAP axially and sit angularly between each other, with the play
//     printed; in the idle mode they are axially clear. Radially the ring's
//     tube passes the gear's hub and lugs and its lugs pass the gear's wall,
//     so only the angles can keep them apart;
//   · KEYED — the ring's internal ribs (its surface inside the joiner's ridge
//     radius) lie in the joiner's slots at the angle they are placed, so the
//     ring turns with the stem;
//   · RATIOS — turning the input, each branch's last body turns by exactly its
//     target × the input in its own mode, read off the placed matrices, while
//     the other branch stands still; in `neutral` both stand still;
//   · LEVER (landing E) — the selector's catch (6641), its SURFACE sampled
//     (every face subdivided, so an edge's interior counts) and hung at the
//     selector's posed angle: in every mode it stands clear of the ring, the
//     clutch gears and the joiner, each taken as its own body of revolution
//     read off its sampled surface; its bulb reaches inside the flanges (the
//     ENGAGEMENT, printed) and clears the groove's floor (the ring turns under
//     it); and the ring stands exactly where the catch's in-flange surface is
//     centred, re-derived here from the samples rather than read from the
//     build — so the ring's position is an output of the lever's angle.
//
// The build probe (probe-technic-build.mjs) holds the rest of the assembly in
// every mode: seated, through, on the axle, meshed, the file.
//
// WHAT THIS DOES NOT CLAIM: that anything turns the selector. Its angle per
// mode is the INPUT — posed, as the page poses it — and the ring follows from
// it. The ring is posed with its lugs in the MIDDLE of their play, and the
// catch's bulb centred in the groove, where the parts allow anywhere across
// either. No detent holds the selector at its three angles.
//
// CONTROLS: the ring placed 0.8 mm short of its stroke must fail STROKE; the
// ring turned 45° on the joiner must fail KEYED; a clutch gear turned 45° on
// the ring must fail DOGGED; a winding chain with one mesh
// changed must fail ROWS; the idle branch's output turning, or the engaged
// branch's at twice its ratio, must fail RATIOS; the selector one plate lower
// must fail LEVER (the bulb into the groove's floor), and so must the
// selector left at neutral while the ring stands at its wind stroke.
//
//   node tools/probe-technic-keyless.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, walk, LDU_MM } from '../src/ldraw.js';
import { CATALOGUES, TECHNIC_KEYLESS, TECHNIC_CLUTCH_GEAR, technicKeylessTargets, technicKeylessErrors,
  solveRatio, ratStr } from '../src/layout.js';
import { frameKeyless, KEYLESS_PARTS, KEYLESS_DIM_MM as K, KEYLESS_DOGS, LEGO_DIM_MM } from '../src/technic-frame.js';
import { ldrawBuild, placedParts, dogPhase, catchInRingFrame, surfaceSamples } from '../src/technic-ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
const EPS = 1e-6, ANGLES = [0.37, 1.9, 7.3, -2.2];
const L = (mm) => mm / LDU_MM;
const B = (p) => bounds(lib, `${p}.dat`);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mod = (a, m) => ((a % m) + m) % m;
const angleOf = (m) => Math.atan2(m[6], m[3]);   // a part's turn about LDraw Z, off its placed matrix

let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const targets = technicKeylessTargets();

// ── ROWS ────────────────────────────────────────────────────────────────────
function rowErrors(gen, row, chain) {
  const errs = technicKeylessErrors(gen, row.key, chain, targets[row.key]);
  const sol = solveRatio(targets[row.key], CATALOGUES[gen], { first: TECHNIC_CLUTCH_GEAR });
  const solved = sol && sol.chain.map((p) => [p.a.teeth, p.b.teeth]);
  if (JSON.stringify(solved) !== JSON.stringify(chain)) errs.push(`${gen} ${row.key}: declared ${JSON.stringify(chain)}, the solver says ${JSON.stringify(solved)}`);
  return errs;
}
console.log('THE LEGO KEYLESS WORKS — two clutch gears on the stem, a driving ring between them\n');
console.log('rows (targets derived from the steel counts):');
for (const row of TECHNIC_KEYLESS.rows) for (const gen of Object.keys(row.chains)) {
  const errs = rowErrors(gen, row, row.chains[gen]);
  console.log(`  ${errs.length ? 'FAIL' : 'ok  '} ${gen.padEnd(16)} ${row.key.padEnd(8)} ${ratStr(targets[row.key]).padEnd(5)} ${row.chains[gen].map(([a, b]) => `${a}:${b}`).join(' × ')}`);
  for (const e of errs) fail(e);
}
const wRow = TECHNIC_KEYLESS.rows.find((r) => r.key === 'winding');
const altered = wRow.chains.technic_2026.map((p, i) => (i === 1 ? [p[0], 20] : p));
const ctlRows = rowErrors('technic_2026', wRow, altered).length > 0;

// ── the build's measurements ───────────────────────────────────────────────
const ringB = B(KEYLESS_PARTS.ring), clutchB = B(KEYLESS_PARTS.clutch), joinerB = B(KEYLESS_PARTS.joiner);
const stemOf = (build) => build.shafts.find((s) => s.shaft === 0 && !s.clutch);
const clutchOf = (build, which) => build.shafts.find((s) => s.clutch === which);
// a body's last-placed gear part index chain: the branch's OUTPUT is the body
// no mesh drives anything from, reached from that branch's clutch
function branchOutput(build, which) {
  let k = build.shafts.indexOf(clutchOf(build, which));
  for (;;) { const m = build.meshes.find((x) => x.a === k); if (!m) return k; k = m.b; }
}
function partOn(build, body, role, input, mode) {
  return placedParts({ ...build, statics: [], shafts: [build.shafts[body]] }, input, mode).find((p) => p.role === role || (role === 'gear' && p.teeth));
}

// STROKE: the ring's end against each clutch gear's face and recess, in LDU
function stroke(build, mode) {
  const stem = build.shafts.indexOf(stemOf(build));
  const ring = partOn(build, stem, 'ring', 0, mode);
  const rz0 = ring.m[2] + ringB.lo[2], rz1 = ring.m[2] + ringB.hi[2];
  const out = {};
  for (const which of ['winding', 'setting']) {
    const g = partOn(build, build.shafts.indexOf(clutchOf(build, which)), 'gear', 0, mode);
    const gz0 = g.m[2] + clutchB.lo[2], gz1 = g.m[2] + clutchB.hi[2];
    // the depth the ring's end stands INSIDE this gear past its near face (< 0: short of it)
    out[which] = g.m[2] > ring.m[2] ? rz1 - gz0 : gz1 - rz0;
  }
  return out;
}
function strokeErrors(build) {
  const errs = [], depth = L(K.recessDepth);
  for (const mode of build.modes) {
    const s = stroke(build, mode);
    for (const which of ['winding', 'setting']) {
      const engaged = (mode === 'wind' && which === 'winding') || (mode === 'set' && which === 'setting');
      if (engaged && Math.abs(s[which] - depth) > EPS) errs.push(`${mode}: the ring stands ${(s[which] * LDU_MM).toFixed(3)} mm into the ${which} gear, its recess is ${K.recessDepth} mm deep`);
      if (!engaged && s[which] > -EPS) errs.push(`${mode}: the ring reaches ${(s[which] * LDU_MM).toFixed(3)} mm into the idle ${which} gear`);
    }
  }
  return errs;
}

// KEYED: the ring's surface inside the joiner's ridge radius (its RIBS) must
// lie in the joiner's SLOTS. Both read off the parts: a slot is where the
// joiner's surface steps down from its ridge radius (its floor, the joiner's
// points less than one LDU under the ridges), its half-width the angle from
// that floor to the nearest ridge point; a rib is in a slot when it stands
// within that half-width of a floor and no deeper than the floor.
function surfacePts(part) {
  const pts = []; walk(lib, `${part}.dat`, (k, ps) => { if (k === 'tri' || k === 'quad') pts.push(...ps); }); return pts;
}
const ridgeR = Math.max(joinerB.hi[0], joinerB.hi[1]);
const joinerPts = surfacePts(KEYLESS_PARTS.joiner), ringPts = surfacePts(KEYLESS_PARTS.ring);
const ridgeAngles = joinerPts.filter((p) => Math.hypot(p[0], p[1]) > ridgeR - 1e-3).map((p) => Math.atan2(p[1], p[0]));
const floors = joinerPts.filter((p) => { const r = Math.hypot(p[0], p[1]); return r < ridgeR - 1e-3 && r > ridgeR - 1; })
  .map((p) => ({ a: Math.atan2(p[1], p[0]), r: Math.hypot(p[0], p[1]) }));
const slotHalf = Math.min(...floors.map((f) => Math.min(...ridgeAngles.map((r) => Math.abs(wrap(r - f.a))))));
const ribs = ringPts.filter((p) => Math.hypot(p[0], p[1]) < ridgeR - 1e-3);
function keyedErrors(build, extraTurn = 0) {
  const stem = build.shafts.indexOf(stemOf(build));
  const ring = partOn(build, stem, 'ring', 0, 'neutral'), joiner = partOn(build, stem, 'joiner', 0, 'neutral');
  const turn = angleOf(ring.m) - angleOf(joiner.m) + extraTurn;
  if (!ribs.length || !floors.length) return ['no ribs on the ring or no slots in the joiner — nothing to key'];
  for (const p of ribs) {
    const a = Math.atan2(p[1], p[0]) + turn, r = Math.hypot(p[0], p[1]);
    const f = floors.find((fl) => Math.abs(wrap(a - fl.a)) < slotHalf - 1e-6);
    if (!f) return [`a ring rib at ${(wrap(a) * 180 / Math.PI).toFixed(1)}° stands on a joiner ridge`];
    if (r < f.r - 1e-6) return [`a ring rib at r ${(r * LDU_MM).toFixed(3)} mm digs below the slot floor (${(f.r * LDU_MM).toFixed(3)})`];
  }
  return [];
}

// DOGGED: the lugs, axially and angularly, read off each placed part
const polysOf = (part) => { const out = []; walk(lib, `${part}.dat`, (k, ps) => { if (k === 'tri' || k === 'quad') out.push(ps); }); return out; };
const dog = dogPhase(lib);
const rr = (q) => Math.hypot(q[0], q[1]);
// a part's lug points (at the lug radius) and the axial run of the polygons
// carrying them, on the face toward +Z (the other face mirrors it)
function lugs(part, atR) {
  const polys = polysOf(part).filter((ps) => ps.some((q) => Math.abs(rr(q) - atR) < 1e-3 && q[2] > 0));
  const zs = polys.flatMap((ps) => ps.map((q) => q[2]));
  const pts = polys.flatMap((ps) => ps).filter((q) => Math.abs(rr(q) - atR) < 1e-3 && q[2] > 0);
  return { z0: Math.min(...zs), z1: Math.max(...zs), angles: pts.map((q) => Math.atan2(q[1], q[0])) };
}
const ringLugs = lugs(KEYLESS_PARTS.ring, dog.rLug), gearLugs = lugs(KEYLESS_PARTS.clutch, dog.rIn);
function dogErrors(build) {
  const errs = [], play = [];
  const stem = build.shafts.indexOf(stemOf(build));
  for (const mode of build.modes) for (const which of ['winding', 'setting']) {
    const engaged = (mode === 'wind' && which === 'winding') || (mode === 'set' && which === 'setting');
    const ring = partOn(build, stem, 'ring', 0, mode), g = partOn(build, build.shafts.indexOf(clutchOf(build, which)), 'gear', 0, mode);
    const side = Math.sign(g.m[2] - ring.m[2]);              // which of the ring's ends faces this gear
    const rz = [ring.m[2] + side * ringLugs.z0, ring.m[2] + side * ringLugs.z1];
    const gz = [g.m[2] - side * gearLugs.z1, g.m[2] - side * gearLugs.z0];   // the gear's face toward the ring
    const overlap = Math.min(Math.max(...rz), Math.max(...gz)) - Math.max(Math.min(...rz), Math.min(...gz));
    if (!engaged) { if (overlap > -EPS) errs.push(`${mode}: the ring's lugs reach the idle ${which} gear's (${(overlap * LDU_MM).toFixed(3)} mm)`); continue; }
    if (overlap < EPS) { errs.push(`${mode}: the ring's lugs do not reach the ${which} gear's (${(overlap * LDU_MM).toFixed(3)} mm)`); continue; }
    // angles: each part's lugs as placed, as ARCS — a lug's points grouped by
    // the lug pitch about that part's folded lug angle. Each part is mirror-
    // symmetric through its middle plane, so the face toward the ring carries
    // the same angles as the +Z face these were read off.
    const k = (2 * Math.PI) / KEYLESS_DOGS;
    const arcs = (as, theta) => {
      const out = Array.from({ length: KEYLESS_DOGS }, () => [Infinity, -Infinity]);
      for (const a of as) {
        const i = mod(Math.round(wrap(a - theta) / k), KEYLESS_DOGS), off = wrap(a - theta - i * k);
        out[i][0] = Math.min(out[i][0], off); out[i][1] = Math.max(out[i][1], off);
      }
      return out.map(([lo, hi], i) => ({ mid: theta + i * k + (lo + hi) / 2, half: (hi - lo) / 2 }));
    };
    const R = arcs(ringLugs.angles, dog.ringLugs.theta).map((x) => ({ ...x, mid: x.mid + angleOf(ring.m) }));
    const G = arcs(gearLugs.angles, dog.gearLugs.theta).map((x) => ({ ...x, mid: x.mid + angleOf(g.m) }));
    let minGap = Infinity;
    for (const r of R) for (const q of G) minGap = Math.min(minGap, Math.abs(wrap(r.mid - q.mid)) - r.half - q.half);
    if (minGap < EPS) errs.push(`${mode}: a ring lug stands on a ${which} gear lug (gap ${(minGap * 180 / Math.PI).toFixed(2)}°)`);
    play.push(`${mode} ${(overlap * LDU_MM).toFixed(2)} mm deep, ±${(minGap * 180 / Math.PI).toFixed(1)}° play`);
  }
  if (!(K.ringTubeIn > K.recessIn && K.ringTubeOut < K.gearLugR && K.gearLugR < K.ringLugR && K.ringLugR < K.recessOut))
    errs.push(`radially the lugs do not interleave: tube ${K.ringTubeIn}–${K.ringTubeOut}, gear lugs in to ${K.gearLugR}, ring lugs out to ${K.ringLugR}, wall ${K.recessOut} mm`);
  return { errs, play };
}

// RATIOS: each branch's output turns by target × input in its own mode, the
// other branch stands still, both stand still in neutral
function ratioErrors(build) {
  const errs = [];
  const outs = { winding: branchOutput(build, 'winding'), setting: branchOutput(build, 'setting') };
  for (const mode of build.modes) for (const which of ['winding', 'setting']) {
    const engaged = (mode === 'wind' && which === 'winding') || (mode === 'set' && which === 'setting');
    const t = targets[which], want = engaged ? Number(t.n) / Number(t.d) : 0;
    const a0 = angleOf(partOn(build, outs[which], 'gear', 0, mode).m);
    for (const input of ANGLES) {
      const turned = wrap(angleOf(partOn(build, outs[which], 'gear', input, mode).m) - a0);
      const expect = [want, -want].map((w) => Math.abs(wrap(turned - w * input)));
      if (Math.min(...expect) > 1e-9) { errs.push(`${mode}: the ${which} output turns ${turned.toFixed(6)} for ${input} at the input, ${engaged ? `want ±${ratStr(t)}` : 'want still'}`); break; }
    }
  }
  return errs;
}

// LEVER: the catch against the stem's bodies of revolution, per mode
const BIN = 0.25;
function profile(part) {   // max radius of a part's sampled surface per axial bin (its own Z)
  const m = new Map();
  for (const [x, y, z] of surfaceSamples(lib, part)) { const k = Math.round(z / BIN); m.set(k, Math.max(m.get(k) ?? 0, Math.hypot(x, y))); }
  // a bin's radius is the most of it and its two neighbours: conservative by a quarter LDU along the axis
  return (a) => { const k = Math.round(a / BIN); return Math.max(m.get(k - 1) ?? 0, m.get(k) ?? 0, m.get(k + 1) ?? 0); };
}
const ringProf = profile(KEYLESS_PARTS.ring), clutchProf = profile(KEYLESS_PARTS.clutch), joinerProf = profile(KEYLESS_PARTS.joiner);
const flangeR = L(K.ringR), floorR = ringProf(0);
// the groove's half-width: the nearest the flange's full radius comes to the ring's middle
let grooveHalf = Infinity;
for (const [x, y, z] of surfaceSamples(lib, KEYLESS_PARTS.ring)) if (Math.hypot(x, y) > flangeR - 1e-3) grooveHalf = Math.min(grooveHalf, Math.abs(z));
function leverErrors(build, riseOverride) {
  const errs = [], report = [];
  const sel = build.shafts.find((x) => x.shaft === 'selector');
  if (!sel) return { errs: ['no selector in the build'], report };
  const stem = build.shafts.indexOf(stemOf(build));
  const rise = riseOverride ?? (build.shafts[stem].origin[1] - sel.origin[1]);
  for (const mode of build.modes) {
    const theta = sel.pose[mode];
    const ring = partOn(build, stem, 'ring', 0, mode);
    const s0 = ring.m[2] - sel.origin[2];                       // the ring's centre along the stem, from the pivot's plane
    const bodies = [['ring', ringProf, s0], ['joiner', joinerProf, partOn(build, stem, 'joiner', 0, mode).m[2] - sel.origin[2]]];
    for (const w of ['winding', 'setting']) bodies.push([`${w} clutch gear`, clutchProf, partOn(build, build.shafts.indexOf(clutchOf(build, w)), 'gear', 0, mode).m[2] - sel.origin[2]]);
    let rmin = Infinity, lo = Infinity, hi = -Infinity;
    const hits = new Map();
    for (const [a, r] of catchInRingFrame(lib, theta, rise)) {
      for (const [name, prof, c] of bodies) if (r < prof(a - c) - EPS) hits.set(name, (hits.get(name) ?? 0) + 1);
      if (r < flangeR) { rmin = Math.min(rmin, r); lo = Math.min(lo, a - s0); hi = Math.max(hi, a - s0); }
    }
    for (const [name, n] of hits) errs.push(`${mode}: the catch stands in the ${name} (${n} surface samples)`);
    if (!(rmin < flangeR)) { errs.push(`${mode}: the catch does not reach inside the flanges`); continue; }
    if (!(rmin > floorR)) errs.push(`${mode}: the catch touches the groove's floor`);
    // the ring where the catch holds it: the middle of its in-flange surface
    if (Math.abs((lo + hi) / 2) > 1e-6) errs.push(`${mode}: the ring stands ${(((lo + hi) / 2) * LDU_MM).toFixed(3)} mm off the catch's centre`);
    report.push(`${mode} ${(theta * 180 / Math.PI).toFixed(2)}°: engaged ${((flangeR - rmin) * LDU_MM).toFixed(2)} mm, floor clear ${((rmin - floorR) * LDU_MM).toFixed(2)} mm, play ${((grooveHalf - Math.max(-lo, hi)) * LDU_MM).toFixed(2)} mm a side`);
  }
  return { errs, report };
}

// ── per generation ──────────────────────────────────────────────────────────
console.log('\nbuilds:');
const ctl = { stroke: true, keyed: true, dogged: true, ratio: true, lever: true };
for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) {
  const f = frameKeyless(gen);
  if (!f.framed) { fail(`${gen}: not framed — ${f.reason}`); continue; }
  const build = ldrawBuild(f, lib);
  const dg = dogErrors(build), lv = leverErrors(build);
  const errs = [...strokeErrors(build), ...keyedErrors(build), ...dg.errs, ...ratioErrors(build), ...lv.errs];
  const s = Object.fromEntries(build.modes.map((m) => [m, stroke(build, m)]));
  const mm = (v) => `${(v * LDU_MM).toFixed(2)}`;
  console.log(`  ${errs.length ? 'FAIL' : 'ok  '} ${gen.padEnd(16)} ring travel ±${f.ringTravel} mm; into winding/setting gear (mm): `
    + build.modes.map((m) => `${m} ${mm(s[m].winding)}/${mm(s[m].setting)}`).join(', '));
  console.log(`       dogs: ${dg.play.join('; ')}`);
  console.log(`       lever (selector ${f.selector.risePlates} plates over the stem): ${lv.report.join('; ')}`);
  for (const e of errs) fail(`${gen}: ${e}`);
  // controls
  const short = structuredClone(build);
  for (const p of stemOf(short).parts) if (p.slide) p.slide.wind -= L(0.8);
  if (!strokeErrors(short).length) ctl.stroke = false;
  if (!keyedErrors(build, Math.PI / 4).length) ctl.keyed = false;
  const turned = structuredClone(build);
  clutchOf(turned, 'winding').phi += Math.PI / KEYLESS_DOGS;
  if (!dogErrors(turned).errs.length) ctl.dogged = false;
  const sel = build.shafts.find((x) => x.shaft === 'selector');
  if (!leverErrors(build, build.shafts[build.shafts.indexOf(stemOf(build))].origin[1] - sel.origin[1] - L(LEGO_DIM_MM.plateH)).errs.length) ctl.lever = false;
  const idle = structuredClone(build);
  idle.shafts.find((x) => x.shaft === 'selector').pose.wind = 0;
  if (!leverErrors(idle).errs.length) ctl.lever = false;
  const slip = structuredClone(build);
  slip.shafts[branchOutput(slip, 'setting')].speeds.wind = 1 / 3;   // the idle branch's output turning
  const wrong = structuredClone(build);
  wrong.shafts[branchOutput(wrong, 'winding')].speeds.wind *= 2;    // the engaged branch at twice its ratio
  if (!ratioErrors(wrong).length) ctl.ratio = false;
  if (!ratioErrors(slip).length) ctl.ratio = false;
}
const ctls = [['a winding chain with one mesh changed', ctlRows], ['the ring 0.8 mm short of its stroke', ctl.stroke],
  ['the ring turned 45° on the joiner', ctl.keyed], ['a clutch gear turned 45° on the ring', ctl.dogged],
  ['the idle setting branch turning, or the winding branch at twice its ratio', ctl.ratio],
  ['the selector a plate lower, or left at neutral with the ring at its wind stroke', ctl.lever]];
console.log('\ncontrols:');
for (const [n, ok] of ctls) { console.log(`  ${ok ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!ok) fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nthe ring engages one gear at a time and each branch carries its steel ratio');
process.exit(fails ? 1 : 0);
