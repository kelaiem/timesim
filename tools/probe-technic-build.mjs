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
//     the library trims off each axle end;
//   · ON THE AXLE — every gear's bore on its axle's line and inside its span;
//   · MESHED — per pair, each gear's tooth angle MEASURED off its placed
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
import { frameFork, FRAME_PARTS } from '../src/technic-frame.js';
import { ldrawBuild, placedParts, toLdr } from '../src/technic-ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
const EPS = 1e-6, PHASE_TOL = 1e-3, AXLE_TRIM = 0.5;          // LDU; pitches (the tips are measured off polygons)
const ANGLES = [0, 0.37, 1.9, 7.3, 41.1];
const dat = (p) => `${p}.dat`;
const bcache = new Map();
const B = (p) => (bcache.has(p) || bcache.set(p, bounds(lib, dat(p))), bcache.get(p));
const near = (a, b, t = EPS) => Math.abs(a - b) <= t;
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

function judge(build, frame) {
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
    const half = 160;
    if (Math.abs(bottom.m[0] - base.m[0]) > half - 10 || Math.abs(bottom.m[2] - base.m[2]) > half - 10) bad.push(`column ${k} is off the baseplate`);
  }
  // THROUGH and ON THE AXLE
  for (const [i, s] of build.shafts.entries()) {
    const placed = placedParts({ ...build, statics: [], shafts: [s] });
    const axle = placed.find((p) => p.role === 'axle');
    const ab = B(axle.part);                            // along the axle's own X, turned onto Z
    const half = (ab.hi[0] - ab.lo[0]) / 2, z0 = axle.m[2] - half, z1 = axle.m[2] + half;
    const bricks = build.statics.filter((p) => p.part === FRAME_PARTS.technicBrick1x1 && near(p.m[0], s.origin[0]));
    if (bricks.length !== 2) bad.push(`shaft ${i}: ${bricks.length} Technic bricks on its line, not 2`);
    for (const t of bricks) {
      for (const h of placements(lib, dat(t.part), /^(peghole|connhol\w*)\.dat$/)) {
        const w = compose(t.m, h.m);
        if (!near(w[0], s.origin[0]) || !near(w[1], s.origin[1])) bad.push(`shaft ${i}: a hole face at (${w[0].toFixed(3)}, ${w[1].toFixed(3)}), axle at (${s.origin[0]}, ${s.origin[1]})`);
      }
      // the axle must fill the brick's hole end to end, less the half LDU the
      // library trims off each axle end (an N-stud axle is 20·N − 1 LDU)
      const tb = B(t.part), b0 = t.m[2] + tb.lo[2], b1 = t.m[2] + tb.hi[2];
      if (z0 > b0 + AXLE_TRIM + EPS || z1 < b1 - AXLE_TRIM - EPS) bad.push(`shaft ${i}: the axle (${z0}…${z1}) does not fill the hole of the brick at Z ${b0}…${b1}`);
    }
    for (const g of placed.filter((p) => p.teeth)) {
      if (!near(g.m[0], s.origin[0]) || !near(g.m[1], s.origin[1])) bad.push(`shaft ${i}: ${g.teeth}T off the axle line`);
      if (g.m[2] < z0 || g.m[2] > z1) bad.push(`shaft ${i}: ${g.teeth}T at Z ${g.m[2]} beyond its axle`);
    }
  }
  // MESHED
  const worst = [];
  for (let i = 1; i < build.shafts.length; i++) {
    let w = 0;
    for (const input of ANGLES) {
      const placed = placedParts(build, input);
      const gearsOn = (k) => placed.filter((p) => p.teeth && near(p.m[0], build.shafts[k].origin[0]) && near(p.m[1], build.shafts[k].origin[1]));
      const a = gearsOn(i - 1).find((p) => near(p.m[2], gearsOn(i)[0].m[2]));
      const b = gearsOn(i).find((p) => near(p.m[2], a?.m[2]));
      if (!a || !b) { bad.push(`shafts ${i - 1}→${i}: no coplanar pair`); break; }
      const A = placedPhase(a), Bp = placedPhase(b);
      const r = mod(a.teeth * A + b.teeth * (Bp - Math.PI) - Math.PI, 2 * Math.PI) / (2 * Math.PI);
      w = Math.max(w, Math.min(r, 1 - r));
    }
    worst.push(w);
    if (w > PHASE_TOL) bad.push(`shafts ${i - 1}→${i}: teeth ${w.toFixed(4)} of a turn off mesh`);
  }
  return { bad, worst };
}

let fails = 0, rows = 0;
console.log('THE LEGO BUILD — placements measured against the vendored LDraw parts\n');
for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) for (const f of frameFork(gen)) {
  if (!f.framed) continue;
  rows++;
  const build = ldrawBuild(f, lib);
  const { bad, worst } = judge(build, f);
  // controls
  // half a pitch on ONE driven shaft at a time, read on that shaft's own mesh:
  // shifting them all at once can cancel across a compound shaft (an 8T driven
  // with a 40T driver comes back 6π, a whole number of turns, on the next mesh)
  let hp = true;
  for (let i = 1; i < build.shafts.length; i++) {
    const c = structuredClone(build);
    c.shafts[i].phi += Math.PI / f.shafts[i].gears[0].teeth;
    if (!judge(c, f).bad.some((m) => m.startsWith(`shafts ${i - 1}→${i}: teeth`))) hp = false;
  }
  const lifted = structuredClone(build);
  const col = lifted.statics.find((p) => p.part === FRAME_PARTS.technicBrick1x1); col.m[1] -= 8;
  const lf = judge(lifted, f).bad.some((m) => /underside/.test(m));
  // THE FILE: the .ldr the page offers, parsed back, is the same placements
  // (to its 4-decimal print) in the same order, each a part the pack holds
  const lines = toLdr(build).split('\n').filter((l) => l.startsWith('1 ')).map((l) => l.split(/\s+/));
  const want = placedParts(build, 0);
  if (lines.length !== want.length) bad.push(`.ldr: ${lines.length} parts, build ${want.length}`);
  else lines.forEach((t, i) => {
    const m = t.slice(2, 14).map(Number), p = want[i];
    if (`${p.part}.dat` !== t[14] || m.some((v, k) => Math.abs(v - p.m[k]) > 1e-4) || !lib.has(t[14])) bad.push(`.ldr line ${i + 1} is not placement ${i + 1} (${t[14]})`);
  });
  const ok = !bad.length && hp && lf;
  if (!ok) fails++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${gen.padEnd(16)} ${f.key.padEnd(18)} ${build.statics.length + build.shafts.reduce((n, s) => n + s.parts.length, 0)} parts, `
    + `meshes worst ${worst.map((w) => w.toExponential(1)).join(' ')} of a turn`);
  for (const b of bad) console.log(`         ${b}`);
  if (!hp) console.log('         CONTROL: half a pitch on a driven shaft was NOT read off mesh');
  if (!lf) console.log('         CONTROL: a Technic brick lifted one plate was NOT caught');
}
console.log(`\n${rows} builds, ${fails} failing`);
process.exit(fails || !rows ? 1 : 0);
