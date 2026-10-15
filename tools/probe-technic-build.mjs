// IS THE LEGO BUILD OF THE TECHNIC FORK ASSEMBLED — every part seated, every
// axle through its holes, every pair of teeth meshed? Acceptance, pure Node, no
// browser, no network; exits non-zero on any failed row.
//
// `src/technic-ldraw.js` turns each framed row into LDraw placements, which
// technic.html draws and `toLdr` writes as a model file. This measures those
// placements against the REAL part geometry in vendor/ldraw/technic-parts.mpd,
// never against the frame's tables (probe-technic-ldraw.mjs holds those):
//
//   · SEATED — every 1×1 part's centre on a stud of the baseplate's grid (a
//     jumper's on the half-stud between two), and every part's underside, read
//     off its own bounds, exactly on the top face of the part below it (the
//     baseplate's top for the bottom plate);
//   · THROUGH — each Technic brick's two hole faces lie on its shaft's axle
//     line, and the axle fills each brick's hole end to end, less the half LDU
//     the library trims off each axle end. Where two axles stand end to end on
//     one line (landing G's motion works), each brick belongs to the nearer;
//   · ON THE AXLE — every gear's bore on its axle's line and inside its span
//     (a keyless clutch gear, its own body, on the stem's). Landing F's rack
//     has no axle (it slides on its tiles) and the detent's follower and its
//     axle ride the arm's far hole, off the pivot's line: probe-technic-keyless
//     holds both (PULL, DETENT);
//   · MESHED — per pair in the build's mesh list, each gear's tooth angle MEASURED off its placed
//     geometry (the tips' arg Σ e^{iNθ} / N), at five input angles turned the
//     way the page turns them: φ + speed·input per shaft. A pair meshes when
//     Na·A + Nb·(B − π) ≡ π (mod 2π); the residue is reported as a fraction
//     of a full turn of that folded angle (0 is meshed, ½ is tooth on tooth).
//
//   · THE FILE — the .ldr the page offers for download, parsed back, is the
//     same placements in the same order, every part one the pack holds.
//
// CONTROLS: half a pitch injected into each driven shaft in turn must read
// that shaft's mesh tooth on tooth, and a Technic brick lifted one plate must
// fail SEATED. A probe that cannot see either has measured nothing.
//
//   node tools/probe-technic-build.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, placements, walk, compose, LDU_MM } from '../src/ldraw.js';
import { CATALOGUES } from '../src/layout.js';
import { frameFork, frameKeyless, FRAME_PARTS, KEYLESS_SELECTOR_DIM_MM } from '../src/technic-frame.js';
import { ldrawBuild, placedParts, toLdr } from '../src/technic-ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
const EPS = 1e-6, PHASE_TOL = 1e-3, AXLE_TRIM = 0.5;          // LDU; pitches (the tips are measured off polygons)
const ANGLES = [0, 0.37, 1.9, 7.3, 41.1];
const dat = (p) => `${p}.dat`;
const bcache = new Map();
const B = (p) => (bcache.has(p) || bcache.set(p, bounds(lib, dat(p))), bcache.get(p));
const near = (a, b, t = EPS) => Math.abs(a - b) <= t;
const L = (mm) => mm / LDU_MM;
const mod = (a, m) => ((a % m) + m) % m;

// a gear's tooth angle about LDraw Z as placed: tips folded by N
const tipCache = new Map();
function tips(part) {
  if (tipCache.has(part)) return tipCache.get(part);
  const pts = []; let r = 0;
  walk(lib, dat(part), (k, ps) => { if (k === 'tri') for (const p of ps) { pts.push(p); r = Math.max(r, Math.hypot(p[0], p[1])); } });
  const out = pts.filter((p) => Math.hypot(p[0], p[1]) > r - 1e-6);
  tipCache.set(part, out); return out;
}
function placedPhase(p) {
  let c = 0, s = 0;
  for (const q of tips(p.part)) {
    const x = p.m[3] * q[0] + p.m[4] * q[1] + p.m[5] * q[2], y = p.m[6] * q[0] + p.m[7] * q[1] + p.m[8] * q[2];
    const a = p.teeth * Math.atan2(y, x); c += Math.cos(a); s += Math.sin(a);
  }
  return Math.atan2(s, c) / p.teeth;
}

function judge(build, frame, mode = build.modes?.[0]) {
  const bad = [];
  // SEATED: walk each column's stack upward from the baseplate
  const base = build.statics[0];
  const baseTop = base.m[1] + B(base.part).lo[1] + 4;   // the baseplate's top face (studs stand 4 above it)
  if (!near(baseTop, 0)) bad.push(`baseplate top at Y ${baseTop}, not 0`);
  const cols = new Map();
  for (const p of build.statics.slice(1)) {
    const k = `${p.m[0]},${p.m[2]}`;
    if (!cols.has(k)) cols.set(k, []);
    cols.get(k).push(p);
  }
  for (const [k, stack] of cols) {
    stack.sort((a, b) => b.m[1] - a.m[1]);            // bottom first (+Y is down)
    let floor = 0;                                      // Y of the surface the next part stands on
    for (const p of stack) {
      const under = p.m[1] + B(p.part).hi[1];          // the part's underside
      if (!near(under, floor)) { bad.push(`column ${k}: ${p.part} underside at Y ${under.toFixed(3)}, standing on ${floor.toFixed(3)}`); break; }
      floor = p.m[1];                                   // its top face (origin)
    }
    const bottom = stack[0], jumper = bottom.part === FRAME_PARTS.jumper1x2;
    // the baseplate's studs: base centre ± (10 + 20k); a 1×1 sits on one, a
    // jumper's centre on the half-stud between two along X
    const dx = mod(bottom.m[0] - base.m[0] - 10, 20), dz = mod(bottom.m[2] - base.m[2] - 10, 20);
    if (!near(dz, 0) || !near(dx, jumper ? 10 : 0)) bad.push(`column ${k}: ${bottom.part} is off the baseplate's stud grid (${dx}, ${dz})`);
    const bb = B(base.part), half = (bb.hi[0] - bb.lo[0]) / 2;   // 16×16 or (landing F) 32×32
    if (Math.abs(bottom.m[0] - base.m[0]) > half - 10 || Math.abs(bottom.m[2] - base.m[2]) > half - 10) bad.push(`column ${k} is off the baseplate`);
  }
  // THROUGH and ON THE AXLE. A body with no axle of its own (a keyless clutch
  // gear idling on the stem) is held to the axle of the body it shares a line
  // with. A body turns about LDraw Z, or (the keyless selector, landing E)
  // about X through Technic bricks turned a quarter: A is the axis coordinate,
  // P the two that place the line. A brick belongs to a line when both its hole
  // faces lie on it.
  const bodyParts = (k, input = 0) => placedParts({ ...build, statics: [], shafts: [build.shafts[k]] }, input, mode);
  const axisOf = (s) => (s.axis === 'x' ? { A: 0, P: [1, 2] } : { A: 2, P: [0, 1] });
  const ptAt = (m, z) => compose(m, [0, 0, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);   // a point on a part's own Z, placed
  const techs = build.statics.filter((p) => p.part === FRAME_PARTS.technicBrick1x1)
    .map((t) => ({ t, faces: placements(lib, dat(t.part), /^(peghole|connhol\w*)\.dat$/).map((h) => compose(t.m, h.m)) }));
  const spans = [];
  for (const [i, s] of build.shafts.entries()) {
    const { A, P } = axisOf(s);
    const placed = bodyParts(i);
    const axle = placed.find((p) => p.role === 'axle');
    if (!axle) continue;
    const ab = B(axle.part);                            // along the axle's own X, turned onto the body's axis
    const half = (ab.hi[0] - ab.lo[0]) / 2, z0 = axle.m[A] - half, z1 = axle.m[A] + half;
    spans.push({ i, s, A, P, z0, z1 });
  }
  // a brick on a line belongs to the axle on that line NEAREST it along the
  // line (landing G: two axles may stand end to end on one line, each in its
  // own pair of bricks); one axle alone on its line takes every brick there
  const lineOf = (sp) => spans.filter((o) => o.A === sp.A && o.P.every((k) => near(o.s.origin[k], sp.s.origin[k])));
  const gapTo = (sp, lo, hi) => Math.max(sp.z0 - hi, lo - sp.z1, 0);
  for (const sp of spans) {
    const { i, s, A, P, z0, z1 } = sp, mates = lineOf(sp);
    const bricks = techs.filter(({ faces }) => faces.length && faces.every((w) => P.every((k) => near(w[k], s.origin[k]))))
      .filter(({ faces }) => {
        const zs = faces.map((w) => w[A]), lo = Math.min(...zs), hi = Math.max(...zs);
        const d = gapTo(sp, lo, hi);
        return mates.every((o) => o === sp || gapTo(o, lo, hi) > d);
      });
    if (bricks.length !== 2) bad.push(`shaft ${i}: ${bricks.length} Technic bricks on its line, not 2`);
    for (const { t } of bricks) {
      // the axle must fill the brick's hole end to end, less the half LDU the
      // library trims off each axle end (an N-stud axle is 20·N − 1 LDU)
      const tb = B(t.part), e = [ptAt(t.m, tb.lo[2])[A], ptAt(t.m, tb.hi[2])[A]], b0 = Math.min(...e), b1 = Math.max(...e);
      if (z0 > b0 + AXLE_TRIM + EPS || z1 < b1 - AXLE_TRIM - EPS) bad.push(`shaft ${i}: the axle (${z0}…${z1}) does not fill the hole of the brick at ${'XYZ'[A]} ${b0}…${b1}`);
    }
  }
  for (const [i, s] of build.shafts.entries()) {
    if (s.slider) continue;                             // the pull's rack slides in its channel (PULL, probe-technic-keyless)
    // the axle on its line that carries it (an idling body, on the minute
    // axle's line beside another axle end to end: the one whose span holds it)
    const cands = spans.filter((a) => a.A === axisOf(s).A && a.P.every((k) => near(a.s.origin[k], s.origin[k])));
    const own = bodyParts(i).filter((g) => g.role !== 'axle' && !g.offLine);
    const on = cands.find((a) => a.i === i) ?? cands.find((a) => own.every((g) => g.m[a.A] >= a.z0 && g.m[a.A] <= a.z1)) ?? cands[0];
    if (!on) { bad.push(`body ${i}: no axle on its line`); continue; }
    for (const g of bodyParts(i)) {
      if (g.role === 'axle' || g.offLine) continue;   // the pawl's 8T rides its arm's far hole (SEATED there, probe-technic-keyless)
      // where a part takes its axle: its origin, or the catch's pivot hole
      const at0 = g.role === 'catch' ? ptAt(g.m, L(KEYLESS_SELECTOR_DIM_MM.catchPivot)) : g.m;
      const name = g.teeth ? `${g.teeth}T` : g.part;
      if (!on.P.every((k) => near(at0[k], s.origin[k]))) bad.push(`body ${i}: ${name} off the axle line`);
      if (at0[on.A] < on.z0 || at0[on.A] > on.z1) bad.push(`body ${i}: ${name} at ${'XYZ'[on.A]} ${at0[on.A]} beyond its axle`);
    }
  }
  // MESHED — every pair in the build's own mesh list
  const worst = [];
  for (const m of build.meshes) {
    let w = 0;
    for (const input of ANGLES) {
      const a = bodyParts(m.a, input)[m.ga], b = bodyParts(m.b, input)[m.gb];
      if (!a?.teeth || !b?.teeth || !near(a.m[2], b.m[2])) { bad.push(`mesh ${m.a}→${m.b}: no coplanar pair`); break; }
      const A = placedPhase(a), Bp = placedPhase(b);
      // the line of centres, as the build solved it: angles are measured from it
      const al = Math.atan2(b.m[1] - a.m[1], b.m[0] - a.m[0]);
      const r = mod(a.teeth * (A - al) + b.teeth * (Bp - al - Math.PI) - Math.PI, 2 * Math.PI) / (2 * Math.PI);
      w = Math.max(w, Math.min(r, 1 - r));
    }
    worst.push(w);
    if (w > PHASE_TOL) bad.push(`mesh ${m.a}→${m.b}: teeth ${w.toFixed(4)} of a turn off mesh`);
  }
  return { bad, worst };
}

let fails = 0, rows = 0;
console.log('THE LEGO BUILD — placements measured against the vendored LDraw parts\n');
for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) for (const f of [...frameFork(gen), frameKeyless(gen)]) {
  if (!f.framed) continue;
  rows++;
  const build = ldrawBuild(f, lib);
  // a keyless build is judged in each of its modes (the ring moves, the idle
  // branch stands still); a row has one
  for (const mode of build.modes) {
    const { bad, worst } = judge(build, f, mode);
    // controls
    // half a pitch on ONE driven body at a time, read on that body's own mesh:
    // shifting them all at once can cancel across a compound shaft (an 8T driven
    // with a 40T driver comes back 6π, a whole number of turns, on the next mesh)
    let hp = true;
    for (const m of build.meshes) {
      const c = structuredClone(build);
      c.shafts[m.b].phi += Math.PI / c.shafts[m.b].parts[m.gb].teeth;
      if (!judge(c, f, mode).bad.some((x) => x.startsWith(`mesh ${m.a}→${m.b}: teeth`))) hp = false;
    }
    const lifted = structuredClone(build);
    const col = lifted.statics.find((p) => p.part === FRAME_PARTS.technicBrick1x1); col.m[1] -= 8;
    const lf = judge(lifted, f, mode).bad.some((x) => /underside/.test(x));
    // THE FILE: the .ldr the page offers, parsed back, is the same placements
    // (to its 4-decimal print) in the same order, each a part the pack holds
    const lines = toLdr(build, 0, mode).split('\n').filter((l) => l.startsWith('1 ')).map((l) => l.split(/\s+/));
    const want = placedParts(build, 0, mode);
    if (lines.length !== want.length) bad.push(`.ldr: ${lines.length} parts, build ${want.length}`);
    else lines.forEach((t, i) => {
      const m = t.slice(2, 14).map(Number), p = want[i];
      if (`${p.part}.dat` !== t[14] || m.some((v, k) => Math.abs(v - p.m[k]) > 1e-4) || !lib.has(t[14])) bad.push(`.ldr line ${i + 1} is not placement ${i + 1} (${t[14]})`);
    });
    const ok = !bad.length && hp && lf;
    if (!ok) fails++;
    const name = build.modes.length > 1 ? `${f.key} (${mode})` : f.key;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${gen.padEnd(16)} ${name.padEnd(24)} ${want.length} parts, `
      + `meshes worst ${worst.map((w) => w.toExponential(1)).join(' ')} of a turn`);
    for (const b of bad) console.log(`         ${b}`);
    if (!hp) console.log('         CONTROL: half a pitch on a driven body was NOT read off mesh');
    if (!lf) console.log('         CONTROL: a Technic brick lifted one plate was NOT caught');
  }
}
console.log(`\n${rows} builds, ${fails} failing`);
process.exit(fails || !rows ? 1 : 0);
