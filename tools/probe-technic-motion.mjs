// DOES THE LEGO MOTION WORKS TURN THE HOUR WHEEL A TWELFTH OF THE MINUTE HAND,
// THE SAME WAY, ON THE MINUTE HAND'S OWN AXLE, FROM THE CROWN? Acceptance, pure
// Node, no browser, no network; exits non-zero on any failure. §219 tier three
// (b), landing G.
//
// `TECHNIC_MOTION_WORKS` (layout.js) declares the chain from the minute axle —
// the keyless setting branch's output — back to the HOUR WHEEL, a round-bored
// 16T (18946) idling on that axle; `MOTION_WORKS_PLACEMENT` (technic-frame.js)
// says where its shafts and layers stand; `frameKeyless` frames it with the
// keyless works and `ldrawBuild` places it. This holds:
//
//   · ROWS — the declared chain and placement are what `solveMotionWorks`
//     answers (the fewest meshes, then the fewest new gears, new axles and
//     teeth, then the smallest baseplate, of every candidate that frames
//     clear), and the chain multiplies EXACTLY to 1/12, the reciprocal of the
//     fork's motion-works target, derived from the steel counts. The solver's
//     whole table is printed: per mesh count, the chains that close on the
//     minute axle by arithmetic, the placements tried, the ones that frame,
//     and the leading framed candidates;
//   · COAXIAL — the hour wheel's placed bore stands on the minute axle's line,
//     inside that axle's span;
//   · IDLES — the hour wheel is its own body (not keyed), and its part's bore
//     is ROUND: every surface point near its axis at one radius, at the cross
//     axle's farthest surface (both read off the parts, which draw a pin hole
//     and an axle at the same nominal 6 LDU — a running fit at zero drawn
//     clearance), each to a thousandth of an LDU;
//   · RATIOS AND SENSE — turning the crown (the stem), read off the placed
//     matrices: in `set` the minute axle turns ±1/3 of the crown (the setting
//     row) and the hour wheel exactly 1/12 of the minute axle, the SAME way;
//     in `wind` and `neutral` both stand still. The §4 MEASURE: crown turns per
//     hour-hand revolution, per generation, read off the same matrices;
//   · REACHED — the §4 MEASURE's second half: at each of the pull's three
//     positions (the detent's rests, the rack's slide), the ring's place on
//     the stem read off the placed parts' bounds — in the winding gear's
//     recess, short of both, in the setting gear's — and whether the hands
//     turn from the crown there (only in `set`);
//   · CLEAR — every motion-works part's sampled surface (every LDU) against
//     every placed part it does not bear on, in every mode and at two crown
//     angles in `set`: over one LDU apart. Skipped by role, as the design
//     MAKES them: a meshing pair, an axle in the Technic bricks it runs
//     through and the gears it carries, the hour wheel on the minute axle, a
//     gear flush against a column on its own axle's line (the frame stands
//     every column one gap outside its gears, so they bear axially there).
//
// probe-technic-build.mjs holds the rest (seated, through, on the axle,
// meshed, the file) and probe-technic-frame.mjs the frame (swept discs).
//
// WHAT THIS DOES NOT CLAIM: a going train. The module is driven from the crown
// in `set` only; no train turns the minute axle in `wind` or `neutral`, so the
// hands stand still there by construction, and the fork's going rows are
// separate builds. The hands themselves: the minute axle's and the hour
// wheel's angles ARE the readings, and no hand part is placed on either —
// nothing in the vendored catalogue keys to 18946's recess but the driving
// ring, which needs the joiner keyed to the very axle the hour wheel must idle
// on. The angles are derived through the meshes (rule 2), posed per crown
// angle: a kinematic model, not a force or a motion integrated.
//
// CONTROLS: a chain with one mesh changed must fail ROWS; the hour wheel moved
// one lattice step off the minute axle must fail COAXIAL; a keyed 16T (4019) in
// its place must fail IDLES; the hour wheel turning against the minute axle,
// or at a sixth of it, must fail RATIOS; the minute axle turning in `wind` must
// fail RATIOS; the second shaft's 24T slid one layer onto the first shaft's
// 16T must fail CLEAR.
//
//   node tools/probe-technic-motion.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, walk, LDU_MM } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { CATALOGUES, TECHNIC_MOTION_WORKS, technicMotionErrors, technicForkTargets, technicKeylessTargets, ratStr } from '../src/layout.js';
import { frameKeyless, solveMotionWorks, MOTION_WORKS_PLACEMENT, KEYLESS_PARTS, KEYLESS_DIM_MM as K, LEGO_DIM_MM } from '../src/technic-frame.js';
import { ldrawBuild, placedParts, surfaceSamples } from '../src/technic-ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = loadPack();   // vendor/ldraw/technic-parts.mpd (BUILT §309: or with TECHNIC_SUBSTITUTE's one swap)
const EPS = 1e-9, ANGLES = [0.37, 1.9, 7.3, -2.2];
const L = (mm) => mm / LDU_MM;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const angleOf = (m) => Math.atan2(m[6], m[3]);   // a part's turn about LDraw Z, off its placed matrix
const B = (p) => bounds(lib, `${p}.dat`);

let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const target = technicForkTargets()['motion works'];
const setting = technicKeylessTargets().setting;

// ── ROWS ────────────────────────────────────────────────────────────────────
console.log('THE LEGO MOTION WORKS — the minute hand on the setting branch\'s axle, the hour wheel idling on it\n');
const solved = {};
function rowErrors(gen, chain, place) {
  const errs = technicMotionErrors(gen, chain, target);
  const s = solved[gen] ??= solveMotionWorks(gen);
  const b = s?.best;
  if (!b) return [...errs, `${gen}: the solver frames no motion works`];
  if (JSON.stringify(b.chain) !== JSON.stringify(chain)) errs.push(`${gen}: declared ${JSON.stringify(chain)}, the solver says ${JSON.stringify(b.chain)}`);
  if (place && (JSON.stringify(b.x) !== JSON.stringify(place.x) || JSON.stringify(b.y) !== JSON.stringify(place.y)))
    errs.push(`${gen}: placed x ${JSON.stringify(place.x)} y ${JSON.stringify(place.y)}, the solver says x ${JSON.stringify(b.x)} y ${JSON.stringify(b.y)}`);
  return errs;
}
console.log(`rows (the hour wheel turns ${ratStr({ n: target.d, d: target.n })} of the minute axle — the fork's ${ratStr(target)}, read the other way):`);
for (const gen of Object.keys(TECHNIC_MOTION_WORKS.chains)) {
  const chain = TECHNIC_MOTION_WORKS.chains[gen], place = MOTION_WORKS_PLACEMENT[gen];
  const errs = rowErrors(gen, chain, place), s = solved[gen];
  console.log(`  ${errs.length ? 'FAIL' : 'ok  '} ${gen.padEnd(16)} ${chain.map(([a, b]) => `${a}:${b}`).join(' × ')}; shafts at x ${place.x.join('/')} mm off the minute axle, layers y ${place.y.join('/')} mm`);
  for (const st of s.stats) console.log(`       ${st.meshes} meshes: ${st.chains} chains close on the minute axle (${st.shared} sharing the setting minute wheel${st.shared ? `: ${st.sharedChains.map((c) => c.map(([a, b]) => `${a}:${b}`).join(' × ')).join(', ')}` : ''}), ${st.placements} placements tried, ${st.framed} frame clear`);
  for (const r of s.ranked.slice(0, 6))
    console.log(`         ${r === s.best ? '→' : ' '} ${r.chain.map(([a, b]) => `${a}:${b}`).join(' × ').padEnd(26)} x ${r.x.join('/').padEnd(12)} y ${r.y.join('/').padEnd(12)} ${r.gears} gears ${r.axles} axles ${r.teeth} teeth, base ${r.area} studs², top layer ${r.top}`);
  if (s.ranked.length > 6) console.log(`           … ${s.ranked.length - 6} more`);
  for (const e of errs) fail(e);
}
const c0 = TECHNIC_MOTION_WORKS.chains.technic_classic;
const ctlRows = technicMotionErrors('technic_classic', c0.map((p, i) => (i === 1 ? [p[0], 16] : p)), target).length > 0;

// ── the build's bodies ──────────────────────────────────────────────────────
const minuteOf = (build, f) => build.shafts.findIndex((s) => s.shaft === f.motion.minute && !s.clutch && !s.idles);
const hourOf = (build) => build.shafts.findIndex((s) => s.idles);
const one = (build, k, input, mode) => placedParts({ ...build, statics: [], shafts: [build.shafts[k]] }, input, mode);
const gearOf = (build, k, input, mode) => one(build, k, input, mode).find((p) => p.teeth);

// COAXIAL: the hour wheel's bore on the minute axle's line, inside its span
function coaxialErrors(build, f) {
  const mi = minuteOf(build, f), hi = hourOf(build);
  if (hi < 0) return ['no idling hour wheel in the build'];
  const axle = one(build, mi, 0, 'set').find((p) => p.role === 'axle'), hw = gearOf(build, hi, 0, 'set');
  const ab = B(axle.part), half = (ab.hi[0] - ab.lo[0]) / 2;
  const errs = [];
  const off = Math.hypot(hw.m[0] - axle.m[0], hw.m[1] - axle.m[1]);
  if (off > 1e-6) errs.push(`the hour wheel's bore stands ${(off * LDU_MM).toFixed(3)} mm off the minute axle's line`);
  if (hw.m[2] < axle.m[2] - half || hw.m[2] > axle.m[2] + half) errs.push('the hour wheel stands beyond the minute axle\'s end');
  return errs;
}

// IDLES: its own body, and a ROUND bore no smaller than the axle's cross
const surf = (p) => { const pts = []; walk(lib, `${p}.dat`, (k, ps) => { if (k === 'tri' || k === 'quad') pts.push(...ps); }); return pts; };
const BORE_TOL = 1e-3;   // LDU
function boreOf(part, axleR) {
  // the part's surface within an LDU of the axle's reach: its bore
  const near = surf(part).map((q) => Math.hypot(q[0], q[1])).filter((r) => r < axleR + 1);
  return near.length ? { lo: Math.min(...near), hi: Math.max(...near) } : null;
}
function idleErrors(build, f, part) {
  const errs = [];
  const mi = minuteOf(build, f), hi = hourOf(build);
  if (hi < 0 || build.shafts[hi].parts.some((p) => p.role === 'axle')) errs.push('the hour wheel is not a body of its own');
  const axle = build.shafts[mi].parts.find((p) => p.role === 'axle');
  const axleR = Math.max(...surf(axle.part).map((q) => Math.hypot(q[1], q[2])));   // an axle runs along its own X
  const b = boreOf(part, axleR);
  if (!b) errs.push(`${part}: no surface near its axis — no bore read`);
  else {
    // LDraw draws a pin hole and an axle's arm tips at the SAME nominal 6 LDU
    // (a running fit at zero drawn clearance); the hole's vertices land within
    // a few 1e-4 LDU of it. So the bore is held round, and at the axle's reach,
    // to BORE_TOL — a thousandth of an LDU, five times the vertices' scatter
    // and three orders under a keyed bore's (4019's cross reads 3.6–6.3 LDU)
    if (b.hi - b.lo > BORE_TOL) errs.push(`${part}: its bore runs ${(b.lo * LDU_MM).toFixed(3)}–${(b.hi * LDU_MM).toFixed(3)} mm from the axis — not round, so keyed`);
    if (b.lo < axleR - BORE_TOL) errs.push(`${part}: its bore (${(b.lo * LDU_MM).toFixed(3)} mm) is inside the axle's farthest surface (${(axleR * LDU_MM).toFixed(3)} mm)`);
  }
  return { errs, report: b && `bore ${(b.lo * LDU_MM).toFixed(4)}–${(b.hi * LDU_MM).toFixed(4)} mm (round to ${((b.hi - b.lo) * LDU_MM).toExponential(1)} mm), the cross axle's farthest surface ${(axleR * LDU_MM).toFixed(4)} mm` };
}

// RATIOS AND SENSE, read off the placed matrices
function ratioErrors(build, f) {
  const errs = [], mi = minuteOf(build, f), hi = hourOf(build);
  const wantM = Number(setting.n) / Number(setting.d), wantH = Number(target.d) / Number(target.n);
  let crownPerHour = null, crownPerMinute = null;
  for (const mode of build.modes) {
    const m0 = angleOf(gearOf(build, mi, 0, mode).m), h0 = angleOf(gearOf(build, hi, 0, mode).m);
    for (const input of ANGLES) {
      const dm = wrap(angleOf(gearOf(build, mi, input, mode).m) - m0), dh = wrap(angleOf(gearOf(build, hi, input, mode).m) - h0);
      if (mode !== 'set') {
        if (Math.abs(dm) > EPS || Math.abs(dh) > EPS) { errs.push(`${mode}: the hands turn (minute ${dm.toFixed(6)}, hour ${dh.toFixed(6)}) for ${input} at the crown, want still`); break; }
        continue;
      }
      const sm = Math.abs(wrap(dm - wantM * input)) < Math.abs(wrap(dm + wantM * input)) ? 1 : -1;
      if (Math.abs(wrap(dm - sm * wantM * input)) > EPS) { errs.push(`set: the minute axle turns ${dm.toFixed(6)} for ${input} at the crown, want ±${ratStr(setting)}`); break; }
      if (Math.abs(wrap(dh - dm * wantH)) > EPS) {
        errs.push(Math.abs(wrap(dh + dm * wantH)) < EPS ? `set: the hour wheel turns AGAINST the minute axle (${dh.toFixed(6)} for ${dm.toFixed(6)})`
          : `set: the hour wheel turns ${dh.toFixed(6)} for the minute axle's ${dm.toFixed(6)}, want ${ratStr({ n: target.d, d: target.n })} of it`);
        break;
      }
      crownPerHour = Math.abs(input / dh); crownPerMinute = Math.abs(input / dm);
    }
  }
  return { errs, crownPerHour, crownPerMinute };
}

// REACHED: the ring at each of the pull's positions, off the placed bounds
const ringB = B(KEYLESS_PARTS.ring), clutchB = B(KEYLESS_PARTS.clutch);
function reached(build) {
  const stem = build.shafts.findIndex((s) => s.shaft === 0 && !s.clutch);
  const rows = {};
  for (const mode of build.modes) {
    const ring = one(build, stem, 0, mode).find((p) => p.role === 'ring');
    const rz0 = ring.m[2] + ringB.lo[2], rz1 = ring.m[2] + ringB.hi[2];
    const depth = {};
    for (const which of ['winding', 'setting']) {
      const g = gearOf(build, build.shafts.findIndex((s) => s.clutch === which), 0, mode);
      const gz0 = g.m[2] + clutchB.lo[2], gz1 = g.m[2] + clutchB.hi[2];
      depth[which] = (g.m[2] > ring.m[2] ? rz1 - gz0 : gz1 - rz0) * LDU_MM;   // > 0: into that gear past its face
    }
    rows[mode] = { rack: build.pull.rackS[mode], selector: build.shafts.find((s) => s.shaft === 'selector').pose[mode] * 180 / Math.PI, depth };
  }
  return rows;
}
function reachedErrors(rows, hands) {
  const errs = [], R = K.recessDepth;
  const want = { wind: ['winding'], set: ['setting'], neutral: [] };
  for (const [mode, r] of Object.entries(rows)) for (const which of ['winding', 'setting']) {
    const engaged = want[mode].includes(which);
    if (engaged && Math.abs(r.depth[which] - R) > 1e-6) errs.push(`${mode}: the ring stands ${r.depth[which].toFixed(3)} mm into the ${which} gear, not on its web (${R} mm)`);
    if (!engaged && !(r.depth[which] < 0)) errs.push(`${mode}: the ring reaches ${r.depth[which].toFixed(3)} mm into the ${which} gear`);
  }
  if (!hands) errs.push('the hands do not turn from the crown in set');
  return errs;
}

// CLEAR: the motion works' parts against everything else, sampled surfaces
const CLEAR_LDU = 1;
const COLUMN_ROLES = new Set(['plate', 'brick', 'technicBrick']);
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
// a part's placed bounding box: its own box's eight corners through its
// matrix (a box of a box is never smaller than the part, so a pair whose boxes
// stand apart stands apart)
const boxCache = new Map();
function placedBox(p) {
  if (!boxCache.has(p.part)) boxCache.set(p.part, B(p.part));
  const b = boxCache.get(p.part), m = p.m, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of [b.lo[0], b.hi[0]]) for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) {
    const q = [m[0] + m[3] * x + m[4] * y + m[5] * z, m[1] + m[6] * x + m[7] * y + m[8] * z, m[2] + m[9] * x + m[10] * y + m[11] * z];
    for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], q[d]); hi[d] = Math.max(hi[d], q[d]); }
  }
  return { lo, hi };
}
function gap(A, Bc) {
  const reach = CLEAR_LDU * 4;
  if ([0, 1, 2].some((d) => A.lo[d] > Bc.hi[d] + reach || Bc.lo[d] > A.hi[d] + reach)) return Infinity;
  const C = 2, grid = new Map(), key = (x, y, z) => `${Math.floor(x / C)},${Math.floor(y / C)},${Math.floor(z / C)}`;
  for (let i = 0; i < Bc.pts.length; i += 3) {
    const x = Bc.pts[i], y = Bc.pts[i + 1], z = Bc.pts[i + 2];
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
function clearErrors(build, f) {
  const errs = [], worst = new Map();
  const mi = minuteOf(build, f), hi = hourOf(build);
  // the motion works' bodies: the hour wheel, every shaft the motion works
  // added, and the gears it keyed to the minute axle
  const motionShafts = new Set(f.shafts.map((s, i) => (s.branch === 'motion' ? i : -1)).filter((i) => i >= 0));
  const motionBody = (k) => k === hi || motionShafts.has(build.shafts[k].shaft);
  const motionGearZ = new Set(f.shafts[f.motion.minute].gears.filter((g) => g.branch === 'motion' && !g.idles).map((g) => Math.round(L(g.y) * 1e6)));
  const isMotion = (x) => (typeof x.body === 'number' && motionBody(x.body)) || (x.body === mi && x.p.teeth && motionGearZ.has(Math.round(x.p.m[2] * 1e6)));
  const meshed = new Set(build.meshes.flatMap((m) => [`${m.a}.${m.ga}|${m.b}.${m.gb}`, `${m.b}.${m.gb}|${m.a}.${m.ga}`]));
  const poses = [...build.modes.map((md) => [md, 0]), ['set', 0.9], ['set', 2.3]];
  for (const [mode, input] of poses) {
    const all = [];
    build.statics.forEach((p) => all.push({ p, body: 'static' }));
    build.shafts.forEach((sh, k) => one(build, k, input, mode).forEach((p, gi) => all.push({ p, body: k, gi })));
    for (const x of all) { x.c = null; x.box = placedBox(x.p); }
    const C = (x) => (x.c ??= cloud(x.p));
    const far = (a, b) => [0, 1, 2].some((d) => a.box.lo[d] > b.box.hi[d] + CLEAR_LDU || b.box.lo[d] > a.box.hi[d] + CLEAR_LDU);
    for (const A of all) {
      if (!isMotion(A)) continue;
      for (const Bx of all) {
        if (A === Bx || A.body === Bx.body) continue;
        if (isMotion(Bx) && all.indexOf(Bx) < all.indexOf(A)) continue;            // each pair once
        if (meshed.has(`${A.body}.${A.gi}|${Bx.body}.${Bx.gi}`)) continue;        // a meshing pair
        const roles = [A.p.role, Bx.p.role];
        if (roles.includes('axle') && roles.includes('technicBrick')) continue;   // an axle through its bricks
        if ((A.body === hi && Bx.body === mi && Bx.p.role === 'axle') || (Bx.body === hi && A.body === mi && A.p.role === 'axle')) continue;   // the hour wheel rides the minute axle
        // a gear against a column on its OWN axle's line: the frame stands each
        // column flush one gap outside its axle's gears, so a gear bears there
        // axially, as every gear of every row does
        const colOwn = (g, c) => g.p.teeth && c.body === 'static' && COLUMN_ROLES.has(c.p.role) && Math.abs(c.p.m[0] - build.shafts[g.body].origin[0]) < 1e-6;
        if (colOwn(A, Bx) || colOwn(Bx, A)) continue;
        if (far(A, Bx)) continue;                                                  // their placed boxes are over an LDU apart: so are they
        const g = gap(C(A), C(Bx)), name = `${A.p.teeth ? `${A.p.teeth}T` : A.p.role} ${A.p.part} ⇄ ${Bx.p.teeth ? `${Bx.p.teeth}T` : Bx.p.role} ${Bx.p.part}`;
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
const ctl = { coaxial: true, idles: true, ratio: true, still: true, clear: true };
for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) {
  const f = frameKeyless(gen);
  if (!f.framed) { fail(`${gen}: not framed — ${f.reason}`); continue; }
  if (!f.motion) { fail(`${gen}: the keyless frame carries no motion works`); continue; }
  const build = ldrawBuild(f, lib);
  const hwPart = TECHNIC_MOTION_WORKS.hourWheel.part;
  const co = coaxialErrors(build, f), id = idleErrors(build, f, hwPart), ra = ratioErrors(build, f);
  const rows = reached(build), re = reachedErrors(rows, ra.crownPerHour !== null), cl = clearErrors(build, f);
  const errs = [...co, ...id.errs, ...ra.errs, ...re, ...cl.errs];
  const added = f.shafts.flatMap((s) => s.gears.filter((g) => g.branch === 'motion'));
  console.log(`  ${errs.length ? 'FAIL' : 'ok  '} ${gen.padEnd(16)} ${added.length} gears on ${f.shafts.filter((s) => s.branch === 'motion').length} new axles and the minute axle; the hour wheel ${hwPart} coaxial, ${id.report}`);
  console.log(`       MEASURE: ${ra.crownPerHour?.toFixed(9)} crown turns per hour-hand revolution in set (${ra.crownPerMinute?.toFixed(9)} per minute-hand revolution × ${Number(target.n) / Number(target.d)}), the hour wheel turning WITH the minute axle; still in wind and neutral`);
  console.log(`       REACHED: ${Object.entries(rows).map(([m, r]) => `${m} — rack ${r.rack >= 0 ? '+' : ''}${r.rack.toFixed(2)} mm, selector ${r.selector.toFixed(2)}°, ring ${r.depth.winding.toFixed(2)}/${r.depth.setting.toFixed(2)} mm into the winding/setting gear`).join('; ')}`);
  console.log(`       clear (the motion works within 1.6 mm of anything it does not bear on): ${cl.near.join('; ')}`);
  for (const e of errs) fail(`${gen}: ${e}`);
  // controls
  const moved = structuredClone(build);
  moved.shafts[hourOf(moved)].origin[0] += L(LEGO_DIM_MM.stud / 2);
  if (!coaxialErrors(moved, f).length) ctl.coaxial = false;
  if (!idleErrors(build, f, '4019').errs.length) ctl.idles = false;
  const against = structuredClone(build);
  against.shafts[hourOf(against)].speeds.set *= -1;
  const sixth = structuredClone(build);
  sixth.shafts[hourOf(sixth)].speeds.set *= 2;
  if (!ratioErrors(against, f).errs.length || !ratioErrors(sixth, f).errs.length) ctl.ratio = false;
  const winds = structuredClone(build);
  winds.shafts[minuteOf(winds, f)].speeds.wind = 1 / 3;
  if (!ratioErrors(winds, f).errs.length) ctl.still = false;
  // the second motion shaft's driven gear (its 24T) slid one layer back onto
  // the first shaft's 16T
  const slid = structuredClone(build);
  const second = slid.shafts.find((s) => s.shaft === [...f.shafts.keys()].filter((i) => f.shafts[i].branch === 'motion')[1]);
  const g24 = second.parts.find((p) => p.teeth);
  g24.m[2] -= L(LEGO_DIM_MM.layer);
  if (!clearErrors(slid, f).errs.length) ctl.clear = false;
}
const ctls = [['a motion-works chain with one mesh changed', ctlRows], ['the hour wheel one lattice step off the minute axle', ctl.coaxial],
  ['a keyed 16T (4019) as the hour wheel', ctl.idles], ['the hour wheel turning against the minute axle, or at a sixth of it', ctl.ratio],
  ['the minute axle turning in wind', ctl.still], ['the second shaft\'s 24T slid one layer onto the first shaft\'s 16T', ctl.clear]];
console.log('\ncontrols:');
for (const [n, ok] of ctls) { console.log(`  ${ok ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!ok) fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nthe hour wheel idles on the minute axle and turns a twelfth of it, the same way, only from the crown in set');
process.exit(fails ? 1 : 0);
