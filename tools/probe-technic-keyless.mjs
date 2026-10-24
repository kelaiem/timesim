// DOES THE LEGO KEYLESS WORKS CHANGE OVER, AND DOES EACH BRANCH CARRY THE
// STEEL RATIO? Acceptance, pure Node, no browser, no network; exits non-zero
// on any failure. §219 tier three (b), landings D, E and F.
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
//     it); and the ring stands where the catch puts it, re-derived here from
//     the samples rather than read from the build — at the middle of the
//     catch's in-flange surface at neutral, and in wind and set on its stroke's
//     end with that middle within the catch's PLAY of it (the bulb pushes the
//     ring ahead of itself onto the web) — so the ring's position is an output
//     of the lever's angle;
//   · PULL (landing F) — the rack drives the selector through the 28T: at
//     each mode the posed angle stands strictly inside the pinion's BACKLASH
//     against the rack at the rack's slide (both edges measured off the parts),
//     the pinion's teeth reach below the rack's tips, the pinion works only the
//     rack's toothed span, and the rack rests on its tiles;
//   · DETENT (landing F) — the declared wheel re-derived (the SURVEY: the
//     catalogue spur whose one tooth leaves the ring nearest its web as a
//     fraction of the catch's play) and its mount, pivot height and band sense
//     re-derived (the PLACEMENT search); in the build every rest a NOTCH, the
//     three one tooth apart, the notch's flanks within 30% of each other (a
//     detent, not a ratchet), the arm posed at its seat and the follower placed
//     at the arm's far hole;
//   · CLEAR (landing F) — the pull's moving parts' sampled surfaces stay over a
//     sampling step from every placed part they do not bear on, in every mode.
//
// The build probe (probe-technic-build.mjs) holds the rest of the assembly in
// every mode: seated, through, on the axle, meshed, the file.
//
// WHAT THIS DOES NOT CLAIM: a FORCE. The detent's rests are measured off the
// parts, but the band that presses the follower is drawn posed and nothing
// here weighs it, nor the detent's hold, nor what a hand must pull. The rack's
// position per mode is a rest of the detent read through the mesh (tooth for
// tooth, the pinion in the middle of its backlash), not a motion integrated.
// The ring's lugs are posed in the MIDDLE of their play, and at neutral the
// catch's bulb is centred in the groove, where the parts allow anywhere across
// either (which side depends on the mode it came from).
//
// CONTROLS: the ring placed 0.8 mm short of its stroke must fail STROKE; the
// ring turned 45° on the joiner must fail KEYED; a clutch gear turned 45° on
// the ring must fail DOGGED; a winding chain with one mesh
// changed must fail ROWS; the idle branch's output turning, or the engaged
// branch's at twice its ratio, must fail RATIOS; the selector one plate lower
// must fail LEVER (the bulb into the groove's floor), and so must the
// selector left at neutral while the ring stands at its wind stroke; the rack
// slid half a tooth along the pinion must fail PULL; the selector posed half a
// wheel tooth off its rest must fail DETENT; the wheel mounted half a tooth
// round must fail STROKE (the notch moves, and the ring with it, into a gear);
// the detent's arm slid onto the wheel's face must fail CLEAR.
//
//   node tools/probe-technic-keyless.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, walk, LDU_MM } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { CATALOGUES, TECHNIC_KEYLESS, TECHNIC_CLUTCH_GEAR, technicKeylessTargets, technicKeylessErrors,
  solveRatio, ratStr } from '../src/layout.js';
import { frameKeyless, KEYLESS_PARTS, KEYLESS_DIM_MM as K, KEYLESS_DOGS, LEGO_DIM_MM, KEYLESS_DETENT, KEYLESS_PULL_DIM_MM as PD,
  PULL_PINION_TEETH, GEAR_TIP_MM } from '../src/technic-frame.js';
import { ldrawBuild, placedParts, dogPhase, catchInRingFrame, surfaceSamples, followerSeat, detentRest, pinionWindow, catchHold,
  gearInYZ } from '../src/technic-ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = loadPack();   // vendor/ldraw/technic-parts.mpd (BUILT §309: or with TECHNIC_SUBSTITUTE's one swap)
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
// no mesh OF THE BRANCH drives anything from, reached from that branch's
// clutch (landing G's motion works rides on from the setting branch's output,
// the minute axle; probe-technic-motion.mjs holds it)
function branchOutput(build, which) {
  let k = build.shafts.indexOf(clutchOf(build, which));
  for (;;) { const m = build.meshes.find((x) => x.a === k && x.branch !== 'motion'); if (!m) return k; k = m.b; }
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
      if (!Number.isFinite(s[which])) { errs.push(`${mode}: the ring has no position (the catch holds nothing)`); continue; }
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
    // the ring where the catch holds it. Without a pull (landing E) it stands
    // at the middle of the catch's in-flange surface. With one (landing F) the
    // detent's rest decides the angle, and in wind and set the bulb PUSHES the
    // ring ahead of its middle by up to the play onto the web: so the ring must
    // stand at the middle at neutral, and in wind and set on its stroke's end
    // with the bulb's flanks both clear of the groove's — the middle within
    // the play of the ring, re-derived here from the samples.
    const off = (lo + hi) / 2, play = grooveHalf - (hi - lo) / 2;
    if (!build.pull || mode === 'neutral') {
      if (Math.abs(off) > 1e-6) errs.push(`${mode}: the ring stands ${(off * LDU_MM).toFixed(3)} mm off the catch's centre`);
    } else if (!(Math.abs(off) <= play + 1e-9)) errs.push(`${mode}: the catch's middle stands ${(off * LDU_MM).toFixed(3)} mm off the ring, outside its ${(play * LDU_MM).toFixed(3)} mm play`);
    report.push(`${mode} ${(theta * 180 / Math.PI).toFixed(2)}°: engaged ${((flangeR - rmin) * LDU_MM).toFixed(2)} mm, floor clear ${((rmin - floorR) * LDU_MM).toFixed(2)} mm, `
      + (build.pull ? `bulb ${(off * LDU_MM).toFixed(2)} mm off the ring of ±${(play * LDU_MM).toFixed(2)} play` : `play ${((grooveHalf - Math.max(-lo, hi)) * LDU_MM).toFixed(2)} mm a side`));
  }
  return { errs, report };
}

// ── PULL (landing F): the rack drives the selector through the 28T ─────────
// At each mode the pinion stands inside its BACKLASH against the rack at the
// rack's slide — both edges measured off the parts (the pinion's teeth against
// the rack's tooth profile), the posed angle strictly between them — and its
// teeth reach below the rack's tips (it is meshed, not merely clear). The rack
// rests on its tiles in every mode: each tile's top at its underside, inside
// its length.
const deg = (v) => v * 180 / Math.PI;
const PULL_TIP = GEAR_TIP_MM[KEYLESS_PARTS.pinion];
function pullErrors(build, f) {
  const errs = [], report = [];
  const pl = build.pull, sel = build.shafts.find((x) => x.shaft === 'selector');
  if (!pl) return { errs: ['no pull in the build'], report };
  const rack = build.shafts.find((x) => x.shaft === 'rack');
  const yc = rack.origin[2] * LDU_MM, tipZ = f.pull.pitchZ + PD.rackAddendum;
  const tiles = build.statics.filter((p) => p.role === 'tile').map((p) => ({ y: p.m[2] * LDU_MM, top: -p.m[1] * LDU_MM }));
  if (!tiles.length) errs.push('the rack rests on no tile');
  for (const mode of build.modes) {
    const th = sel.pose[mode], s = rack.parts[0].slide[mode] * LDU_MM;
    const w = pinionWindow(lib, f.selector, f.pull, yc, s, th);
    if (!w) { errs.push(`${mode}: the pinion stands in the rack's teeth`); continue; }
    if (!(w[0] < th && th < w[1])) errs.push(`${mode}: the selector at ${deg(th).toFixed(3)}° is outside the pinion's backlash ${deg(w[0]).toFixed(3)}…${deg(w[1]).toFixed(3)}°`);
    let low = Infinity;
    for (const [y, z] of gearInYZ(lib, KEYLESS_PARTS.pinion, f.selector.y, f.selector.z, th)) if (Math.abs(y - f.selector.y) < PD.rackPitch) low = Math.min(low, z);
    if (!(low < tipZ)) errs.push(`${mode}: the pinion's teeth stop ${(low - tipZ).toFixed(3)} mm above the rack's tips — not meshed`);
    for (const t of tiles) {
      if (Math.abs(t.top - f.pull.bottom) > 1e-6) errs.push(`${mode}: a tile's top at ${t.top.toFixed(3)} mm, the rack's underside at ${f.pull.bottom}`);
      if (Math.abs(t.y - (yc + s)) + LEGO_DIM_MM.stud / 2 > PD.rackHalfLength + 1e-6) errs.push(`${mode}: the tile at y ${t.y} is not under the rack`);
    }
    // the pinion works the rack's toothed span: its teeth's reach along the
    // rack, in the rack's own X, inside the first and last tooth
    const reachLo = f.selector.y - (yc + s) - PULL_TIP, reachHi = f.selector.y - (yc + s) + PULL_TIP;
    if (reachLo < PD.rackTeethLo || reachHi > PD.rackTeethHi) errs.push(`${mode}: the pinion reaches the rack at X ${reachLo.toFixed(2)}…${reachHi.toFixed(2)} mm, its teeth run ${PD.rackTeethLo}…${PD.rackTeethHi}`);
    report.push(`${mode} rack ${s >= 0 ? '+' : ''}${s.toFixed(2)} mm, selector ${deg(th).toFixed(2)}° in backlash ${(deg(th - w[0])).toFixed(2)}°/${(deg(w[1] - th)).toFixed(2)}°, teeth ${(tipZ - low).toFixed(2)} mm into the rack`);
  }
  return { errs, report };
}

// ── DETENT (landing F): the follower on the detent wheel ─────────────────────
// The wheel's declared tooth count re-derived (the SURVEY: of the catalogue's
// spurs, the one whose single tooth lands the catch nearest the ring's web as a
// fraction of the play there); its declared mount, pivot height and band sense
// re-derived (the PLACEMENT: the best of every height and sense, and both
// mounts where a quarter turn is not whole teeth); and in the build every rest
// a NOTCH (the follower stands farther from the wheel's axis a quarter degree
// either side), the three rests one tooth apart, the notch's two flanks within
// 30% of each other's steepness (a detent, not a ratchet), and the detent body
// placed where the seat says (its follower at the arm's far hole).
const travelMM = (f) => f.ringTravel;
function surveyWheel(gen, f) {
  const rise = L(f.selector.rise), rows = [];
  for (const c of CATALOGUES[gen].counts.filter((r) => r.kind === 'spur')) {
    const h = catchHold(lib, 2 * Math.PI / c.teeth, rise), off = (h.centre * LDU_MM) - travelMM(f), play = h.play * LDU_MM;
    // a tooth so coarse the catch leaves the groove holds nothing (no in-flange surface)
    rows.push({ teeth: c.teeth, part: c.part, off, play, out: !Number.isFinite(off), seats: Math.abs(off) <= play, score: Math.abs(off) / play });
  }
  const best = rows.filter((r) => r.seats).sort((a, b) => a.score - b.score)[0];
  return { rows, best };
}
const SLOPE_N = 48;
function notchProfile(det, wz, rest) {
  const step = 2 * Math.PI / det.wheel.teeth, ds = [];
  for (let i = 0; i <= SLOPE_N; i++) ds.push(followerSeat(lib, det, wz, rest - step / 2 + (i * step) / SLOPE_N)?.d ?? NaN);
  const dt = deg(step / SLOPE_N), k = SLOPE_N / 2;
  let sl = 0, sr = 0;
  for (let i = 1; i <= SLOPE_N; i++) { const g = (ds[i] - ds[i - 1]) / dt; if (i <= k) sl = Math.max(sl, -g); else sr = Math.max(sr, g); }
  return { lift: Math.max(...ds) - followerSeat(lib, det, wz, rest).d, sl, sr };
}
function placementScore(f, det) {
  const wz = f.selector.z, rise = L(f.selector.rise), step = 2 * Math.PI / det.wheel.teeth, T = travelMM(f);
  const r0 = detentRest(lib, det, wz, 0);
  if (r0 === null) return null;
  const pr = notchProfile(det, wz, r0);
  if (!(Math.max(pr.sl, pr.sr) / Math.min(pr.sl, pr.sr) <= 1.3)) return null;
  const at = (t) => { const h = catchHold(lib, t, rise); return { c: h.centre * LDU_MM, play: h.play * LDU_MM }; };
  const n = at(r0), w = at(r0 + step), st = at(r0 - step);
  const sc = Math.max(Math.abs(n.c) / (T - K.recessDepth), Math.abs(w.c - T) / w.play, Math.abs(-st.c - T) / st.play);
  return Number.isFinite(sc) ? sc : null;                   // a rest that takes the catch out of the groove places nothing
}
function placementSearch(gen, f) {
  const N = KEYLESS_DETENT[gen].teeth, base = f.pull.detent;
  const mounts = (90 * N / 360) % 1 ? [0, 90] : [0];
  let best = null;
  for (const mount of mounts) for (let plates = 1; plates <= 8; plates++) for (const sense of [1, -1]) {
    const det = { ...base, sense, wheel: { ...base.wheel, mount }, pivot: { ...base.pivot, z: f.selector.z + plates * LEGO_DIM_MM.plateH } };
    const sc = placementScore(f, det);
    if (sc !== null && (!best || sc < best.score - 1e-12)) best = { mount, plates, sense, score: sc };
  }
  return best;
}
function detentErrors(build, f) {
  const errs = [], report = [];
  const pl = build.pull, det = f.pull.detent, wz = f.selector.z, step = 2 * Math.PI / det.wheel.teeth;
  const sel = build.shafts.find((x) => x.shaft === 'selector'), body = build.shafts.find((x) => x.shaft === 'detent');
  if (!body) return { errs: ['no detent in the build'], report };
  // one tooth apart, to the resolution a notch's bottom can be found at: the
  // follower's height is flat there (quadratic), so the seat solve's ~1e-11 rad
  // locates the minimum to its square root's order, ~1e-5 rad
  for (const [md, k] of [['wind', 1], ['set', -1]]) if (Math.abs(sel.pose[md] - sel.pose.neutral - k * step) > 1e-4)
    errs.push(`${md}: the rest stands ${deg(sel.pose[md] - sel.pose.neutral).toFixed(4)}° from neutral, not one tooth (${deg(k * step).toFixed(4)}°)`);
  for (const mode of build.modes) {
    const th = sel.pose[mode], here = followerSeat(lib, det, wz, th);
    if (!here) { errs.push(`${mode}: the follower does not reach the wheel`); continue; }
    const q = 0.25 * Math.PI / 180;
    for (const d of [-q, q]) { const o = followerSeat(lib, det, wz, th + d); if (!(o && o.d > here.d)) errs.push(`${mode}: the rest is not a notch — the follower stands no farther ${d > 0 ? 'ahead' : 'behind'}`); }
    if (Math.abs(body.pose[mode] - here.psi) > 1e-9) errs.push(`${mode}: the arm is posed at ${deg(body.pose[mode]).toFixed(4)}°, its seat is ${deg(here.psi).toFixed(4)}°`);
    const fol = placedParts({ ...build, statics: [], shafts: [body] }, 0, mode).find((p) => p.role === 'follower');
    const fy = fol.m[2] * LDU_MM, fz = -fol.m[1] * LDU_MM, A = PD.armHoles;
    const ey = det.pivot.y + A * Math.cos(here.psi), ez = det.pivot.z + A * Math.sin(here.psi);
    if (Math.hypot(fy - ey, fz - ez) > 1e-6) errs.push(`${mode}: the follower is placed ${Math.hypot(fy - ey, fz - ez).toFixed(4)} mm from its seat`);
  }
  const pr = notchProfile(det, wz, sel.pose.neutral);
  if (!(Math.max(pr.sl, pr.sr) / Math.min(pr.sl, pr.sr) <= 1.3)) errs.push(`the notch's flanks are ${pr.sl.toFixed(3)} and ${pr.sr.toFixed(3)} mm/° — a ratchet, not a detent`);
  if (!(pr.lift > 0)) errs.push('the follower does not rise between notches');
  report.push(`rests ${build.modes.map((m) => `${m} ${deg(sel.pose[m]).toFixed(3)}°`).join(', ')}; the follower rises ${pr.lift.toFixed(3)} mm between notches, flanks ${pr.sl.toFixed(3)}/${pr.sr.toFixed(3)} mm/°`);
  return { errs, report };
}

// ── CLEAR (landing F): the pull's moving parts against everything else ──────
// Every part of the rack, the detent's body and the selector's two new gears
// (pinion, detent wheel), its surface sampled every LDU and placed, against
// every other placed part in the build, in every mode: the nearest two
// surfaces come is held over one LDU — over the sampling's own spacing, so two
// surfaces that crossed could not read clear. Parts of one body turn together
// and are skipped; so are the contacts the design MAKES, by role: the follower
// on the wheel, the pinion in the rack, the rack on its tiles and between its
// walls, each axle in what it carries or runs through.
const CLEAR_LDU = 1;
const CONTACTS = [['follower', 'detent'], ['pinion', 'rack'], ['rack', 'tile'], ['rack', 'brick'],
  ['axle', 'arm'], ['axle', 'follower'], ['axle', 'technicBrick'], ['arm', 'follower']];
const contact = (a, b) => CONTACTS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const staticClouds = new Map();
const staticCloud = (p) => { const k = `${p.part}|${p.m.join(',')}`; if (!staticClouds.has(k)) staticClouds.set(k, cloud(p)); return staticClouds.get(k); };
function cloud(p) {
  const pts = surfaceSamples(lib, p.part, 1), m = p.m, out = new Float64Array(pts.length * 3);
  let k = 0;
  for (const [x, y, z] of pts) {
    out[k++] = m[0] + m[3] * x + m[4] * y + m[5] * z; out[k++] = m[1] + m[6] * x + m[7] * y + m[8] * z; out[k++] = m[2] + m[9] * x + m[10] * y + m[11] * z;
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < out.length; i += 3) for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], out[i + d]); hi[d] = Math.max(hi[d], out[i + d]); }
  return { pts: out, lo, hi };
}
function gap(A, B) {
  const reach = CLEAR_LDU * 4;
  if ([0, 1, 2].some((d) => A.lo[d] > B.hi[d] + reach || B.lo[d] > A.hi[d] + reach)) return Infinity;
  const C = 2, grid = new Map(), key = (x, y, z) => `${Math.floor(x / C)},${Math.floor(y / C)},${Math.floor(z / C)}`;
  for (let i = 0; i < B.pts.length; i += 3) {
    const x = B.pts[i], y = B.pts[i + 1], z = B.pts[i + 2];
    if (x < A.lo[0] - reach || x > A.hi[0] + reach || y < A.lo[1] - reach || y > A.hi[1] + reach || z < A.lo[2] - reach || z > A.hi[2] + reach) continue;
    const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(x, y, z);
  }
  if (!grid.size) return Infinity;
  let best = Infinity;
  for (let i = 0; i < A.pts.length; i += 3) {
    const x = A.pts[i], y = A.pts[i + 1], z = A.pts[i + 2];
    const cx = Math.floor(x / C), cy = Math.floor(y / C), cz = Math.floor(z / C);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!cell) continue;
      for (let j = 0; j < cell.length; j += 3) { const d = Math.hypot(cell[j] - x, cell[j + 1] - y, cell[j + 2] - z); if (d < best) best = d; }
    }
  }
  return best;
}
function clearErrors(build) {
  const errs = [], worst = new Map();
  const movers = new Set(['pinion', 'detent', 'rack', 'arm', 'follower']);
  for (const mode of build.modes) {
    const all = [];
    build.statics.forEach((p) => all.push({ p, body: 'static', c: staticCloud(p) }));
    build.shafts.forEach((sh, i) => placedParts({ ...build, statics: [], shafts: [sh] }, 0, mode).forEach((p) => all.push({ p, body: i })));
    const clouds = all.map((x) => ({ c: null, ...x }));
    const C = (x) => (x.c ??= cloud(x.p));
    const pull = new Set(build.shafts.map((sh, i) => (['rack', 'detent'].includes(sh.shaft) ? i : -1)).filter((i) => i >= 0));
    for (const A of clouds) {
      if (!(pull.has(A.body) || movers.has(A.p.role))) continue;
      for (const B of clouds) {
        if (A === B || A.body === B.body || contact(A.p.role, B.p.role)) {
          // an axle bears on the bricks it runs THROUGH; the follower's axle
          // (off the pivot's line) runs through none, so it is judged
          const axle = A.p.role === 'axle' ? A.p : B.p.role === 'axle' ? B.p : null;
          if (!(axle?.offLine && [A.p.role, B.p.role].includes('technicBrick'))) continue;
        }
        if ((pull.has(B.body) || movers.has(B.p.role)) && clouds.indexOf(B) < clouds.indexOf(A)) continue;   // each pair once
        const g = gap(C(A), C(B)), name = `${A.p.role} ${A.p.part} ⇄ ${B.p.role} ${B.p.part}`;
        if (g < (worst.get(name)?.g ?? Infinity)) worst.set(name, { g, mode });
        if (g < CLEAR_LDU) errs.push(`${mode}: ${name} come ${(g * LDU_MM).toFixed(3)} mm apart`);
      }
    }
  }
  const near = [...worst].sort((a, b) => a[1].g - b[1].g).slice(0, 4).map(([n, { g, mode }]) => `${n} ${(g * LDU_MM).toFixed(2)} mm (${mode})`);
  return { errs: [...new Set(errs)], near };
}

// ── per generation ──────────────────────────────────────────────────────────
console.log('\nbuilds:');
const ctl = { stroke: true, keyed: true, dogged: true, ratio: true, lever: true, pull: true, notch: true, mount: true, clear: true };
for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) {
  const f = frameKeyless(gen);
  if (!f.framed) { fail(`${gen}: not framed — ${f.reason}`); continue; }
  const build = ldrawBuild(f, lib);
  const dg = dogErrors(build), lv = leverErrors(build), pu = pullErrors(build, f), dt = detentErrors(build, f), cl = clearErrors(build);
  const errs = [...strokeErrors(build), ...keyedErrors(build), ...dg.errs, ...ratioErrors(build), ...lv.errs, ...pu.errs, ...dt.errs, ...cl.errs];
  // the wheel and its placement, re-derived
  const sv = surveyWheel(gen, f), decl = KEYLESS_DETENT[gen];
  if (sv.best?.teeth !== decl.teeth) errs.push(`the survey's wheel is ${sv.best?.teeth ?? 'none'}T, ${decl.teeth}T is declared`);
  const ps = placementSearch(gen, f);
  if (!ps || ps.mount !== decl.mount || ps.plates !== decl.plates || ps.sense !== decl.sense)
    errs.push(`the placement search answers ${ps ? `mount ${ps.mount}°, ${ps.plates} plates, sense ${ps.sense}` : 'nothing'}; declared mount ${decl.mount}°, ${decl.plates} plates, sense ${decl.sense}`);
  const s = Object.fromEntries(build.modes.map((m) => [m, stroke(build, m)]));
  const mm = (v) => `${(v * LDU_MM).toFixed(2)}`;
  console.log(`  ${errs.length ? 'FAIL' : 'ok  '} ${gen.padEnd(16)} ring travel ±${f.ringTravel} mm; into winding/setting gear (mm): `
    + build.modes.map((m) => `${m} ${mm(s[m].winding)}/${mm(s[m].setting)}`).join(', '));
  console.log(`       dogs: ${dg.play.join('; ')}`);
  console.log(`       lever (selector ${f.selector.risePlates} plates over the stem): ${lv.report.join('; ')}`);
  console.log(`       pull: ${pu.report.join('; ')}`);
  console.log(`       clear (the pull's moving parts within 1.6 mm of anything they do not bear on): ${cl.near.join('; ')}`);
  console.log(`       detent wheel survey (one tooth; the ring off its web / the catch's play, mm): ${sv.rows.map((r) => (r.out ? `${r.teeth}T out of the groove ✗` : `${r.teeth}T ${r.off >= 0 ? '+' : ''}${r.off.toFixed(2)}/${r.play.toFixed(2)}${r.seats ? '' : ' ✗'}`)).join(', ')} → ${sv.best?.teeth}T`);
  console.log(`       detent (${decl.teeth}T at ${decl.mount}°, pivot ${decl.plates} plates up, sense ${decl.sense}; placement score ${ps?.score.toFixed(3)}): ${dt.report.join('; ')}`);
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
  // the rack half a pitch along: the pinion's teeth in the rack's
  const shifted = structuredClone(build);
  shifted.shafts.find((x) => x.shaft === 'rack').origin[2] += L(PD.rackPitch / 2);
  if (!pullErrors(shifted, f).errs.length) ctl.pull = false;
  // the selector half a tooth off its rest: not a notch
  const offRest = structuredClone(build);
  offRest.shafts.find((x) => x.shaft === 'selector').pose.neutral += Math.PI / f.pull.detent.wheel.teeth;
  if (!detentErrors(offRest, f).errs.length) ctl.notch = false;
  // the wheel mounted half a tooth round: the notch at neutral moves half a
  // tooth, and the ring follows it into a gear
  const fm = structuredClone(f);
  fm.pull.detent.wheel.mount += 180 / fm.pull.detent.wheel.teeth;
  const bm = ldrawBuild(fm, lib);
  if (!strokeErrors(bm).length) ctl.mount = false;
  // the detent's arm slid onto the wheel's face: CLEAR must see it
  const onFace = structuredClone(build);
  for (const p of onFace.shafts.find((x) => x.shaft === 'detent').parts) if (p.role === 'arm') p.m[0] += L(PD.followerHalfWidth + PD.armHalfThick);
  if (!clearErrors(onFace).errs.length) ctl.clear = false;
}
const ctls = [['a winding chain with one mesh changed', ctlRows], ['the ring 0.8 mm short of its stroke', ctl.stroke],
  ['the ring turned 45° on the joiner', ctl.keyed], ['a clutch gear turned 45° on the ring', ctl.dogged],
  ['the idle setting branch turning, or the winding branch at twice its ratio', ctl.ratio],
  ['the selector a plate lower, or left at neutral with the ring at its wind stroke', ctl.lever],
  ['the rack slid half a tooth along the pinion', ctl.pull], ['the selector posed half a wheel tooth off its rest', ctl.notch],
  ['the detent wheel mounted half a tooth round', ctl.mount], ['the detent arm slid onto the wheel\'s face', ctl.clear]];
console.log('\ncontrols:');
for (const [n, ok] of ctls) { console.log(`  ${ok ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!ok) fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nthe pull sets each mode at a detent rest, the ring engages one gear at a time and each branch carries its steel ratio');
process.exit(fails ? 1 : 0);
