// DO THE TECHNIC FRAME'S DIMENSIONS MATCH THE REAL PARTS? Acceptance, pure
// Node, no browser, no network; exits non-zero on any mismatch.
//
// `src/technic-frame.js` solves the frame from four tables — LEGO_DIM_MM,
// GEAR_WIDTH_MM, FRAME_PARTS, AXLE_PARTS — and marks them verified. This is
// what makes that word true: every entry is re-read off the LDraw part files
// vendored in vendor/ldraw/technic-parts.mpd, through `src/ldraw.js`, and
// compared at 1e-6 mm. Landing A wrote the table from quoted figures and two
// were wrong (stud height, hole height), which no amount of reasoning about
// the frame would have caught.
//
// WHAT IS READ, and from where (1 LDU = 0.4 mm; LDraw's +Y points down):
//   · stud pitch, plate and brick heights, stud height — 3024's and 3005's
//     bounds: footprint, body below the top face, stud above it;
//   · the hole height — WHERE 6541 places its pin-hole primitives, measured up
//     from the brick's bottom; and that hole runs through the brick along one
//     horizontal axis;
//   · the axle's half-width — 3705's section;
//   · every axle part's title ("Technic Axle N") and length (20·N − 1 LDU);
//   · every catalogue gear's face width — its extent along its own axle (the
//     part's smallest extent) — against GEAR_WIDTH_MM;
//   · every gear's TIP radius, its surface's farthest point from its axis,
//     against GEAR_TIP_MM — the disc the frame sweeps. The module-1 tip
//     (teeth/2 + 1) is printed beside it: the 12T and 20T stand outside it,
//     which is why the frame does not sweep the formula;
//   · the jumper puts ONE stud at its centre, on a 2-stud footprint;
//   · the baseplate covers every framed row's base.
// Turntables are not framed (the frame module refuses their rows), so their
// widths and tips are not judged; their parts are still in the pack.
//
// And the pack itself: every section an LDraw file, no HTTP header anywhere.
//
// CONTROLS: every table entry is perturbed in turn (a dimension by 0.1 mm, a
// gear's width, an axle's part number swapped for its neighbour's) and the
// comparison must FAIL on each. A table this probe cannot fail is a table it
// did not read.
//
//   node tools/probe-technic-ldraw.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, placements, walk, LDU_MM } from '../src/ldraw.js';
import { CATALOGUES } from '../src/layout.js';
import { LEGO_DIM_MM, GEAR_WIDTH_MM, GEAR_TIP_MM, FRAME_PARTS, AXLE_PARTS, frameFork } from '../src/technic-frame.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8');
const lib = parseLibrary(PACK);
// THE PACK IS PART DATA AND NOTHING ELSE. Every section's first line is an
// LDraw meta line and no line anywhere is an HTTP header: the first pack
// committed nothing else but carried the server's response headers, cookies
// included, at the head of all 246 files — invisible to the parser, which
// skips lines it does not know, and so to every measurement here.
const packBad = [];
for (const sec of PACK.split(/^0 FILE /m).slice(1)) {
  const [name, first] = sec.split('\n');
  if (!/^0( |$)/.test(first ?? '')) packBad.push(`${name}: first line "${(first ?? '').slice(0, 40)}" is not LDraw`);
}
if (/^(HTTP\/\d|set-cookie:|cf-ray:|date:)/im.test(PACK)) packBad.push('an HTTP header line is in the pack');
const TOL = 1e-6;
const mm = (ldu) => ldu * LDU_MM;
const dat = (p) => `${p}.dat`;
const B = (p) => bounds(lib, dat(p));

// ── the measurements, taken once ─────────────────────────────────────────────
const plate = B(FRAME_PARTS.plate1x1), brick = B(FRAME_PARTS.brick1x1), tech = B(FRAME_PARTS.technicBrick1x1);
const axle4 = B(AXLE_PARTS[4]);
const holes = placements(lib, dat(FRAME_PARTS.technicBrick1x1), /^(peghole|connhol\w*)\.dat$/);
// studs on the TOP face only (y ≤ 0): `stud3`/`stud4` below it are the
// underside's tubes, which a first count read as a second stud
const jumperStuds = placements(lib, dat(FRAME_PARTS.jumper1x2), /^stud\w*\.dat$/).filter((p) => p.m[1] <= 0);
const jumper = B(FRAME_PARTS.jumper1x2), base = B(FRAME_PARTS.baseplate16);
const MEASURED = {
  stud: mm(plate.hi[0] - plate.lo[0]),
  plateH: mm(plate.hi[1]),                     // top face at y = 0, body below it
  brickH: mm(brick.hi[1]),
  studH: mm(-plate.lo[1]),
  holeZ: holes.length ? mm(tech.hi[1] - holes[0].m[1]) : NaN,
  axleR: mm(axle4.hi[1]),
};
const gears = [...new Map(Object.values(CATALOGUES).filter(Boolean).flatMap((c) => c.counts)
  .filter((r) => r.kind === 'spur' || r.kind === 'doubleBevel').map((r) => [r.part, r])).values()];
const gearM = gears.map((r) => {
  const b = B(r.part), ext = [0, 1, 2].map((k) => b.hi[k] - b.lo[k]);
  const axis = ext.indexOf(Math.min(...ext));
  // the TIP is the farthest surface point from the axis — not the bounding
  // box's extreme, which reads short whenever no tooth points along a box axis
  // (the 8T's box says 12.43 LDU, its tips stand 12.45 out)
  const [u, v] = [0, 1, 2].filter((k) => k !== axis);
  let tipL = 0;
  walk(lib, dat(r.part), (kind, ps) => { if (kind === 'tri') for (const p of ps) tipL = Math.max(tipL, Math.hypot(p[u], p[v])); });
  return { ...r, width: mm(ext[axis]), tip: mm(tipL), title: lib.get(dat(r.part)).title, org: lib.get(dat(r.part)).org };
});

// ── the judgement, a function of the tables so the controls can perturb them ─
function judge(T) {
  const bad = [];
  for (const k of Object.keys(MEASURED)) {
    if (!(Math.abs(T.D[k] - MEASURED[k]) <= TOL)) bad.push(`${k}: table ${T.D[k]} mm, parts ${MEASURED[k].toFixed(6)} mm`);
  }
  if (Math.abs(T.D.stud - T.D.layer) > TOL) bad.push(`layer ${T.D.layer} is not one stud`);
  // the hole: one through-hole, both faces, centred, on a horizontal axis
  if (holes.length !== 2) bad.push(`${FRAME_PARTS.technicBrick1x1}: ${holes.length} pin-hole primitives, expected 2 (one per face)`);
  else if (holes.some((h) => Math.abs(h.m[0]) > TOL || Math.abs(h.m[1] - holes[0].m[1]) > TOL)) bad.push(`${FRAME_PARTS.technicBrick1x1}: its two hole faces are not on one horizontal axis`);
  // the frame parts' identities and footprints
  const titled = (p, re) => { const t = lib.get(dat(p))?.title ?? ''; if (!re.test(t)) bad.push(`${p} is "${t}", expected ${re}`); };
  titled(T.F.plate1x1, /^Plate 1 x 1$/); titled(T.F.brick1x1, /^Brick 1 x 1$/);
  titled(T.F.technicBrick1x1, /^Technic Brick 1 x 1 with Hole$/); titled(T.F.jumper1x2, /^Plate 1 x 2 .*1 Centre Stud$/);
  titled(T.F.baseplate16, /^Baseplate 16 x 16$/);
  if (Math.abs(mm(tech.hi[1]) - T.D.brickH) > TOL) bad.push(`${T.F.technicBrick1x1} is not a brick high`);
  if (jumperStuds.length !== 1 || Math.abs(jumperStuds[0].m[0]) > TOL || Math.abs(mm(jumper.hi[0] - jumper.lo[0]) - 2 * T.D.stud) > TOL)
    bad.push(`${T.F.jumper1x2}: ${jumperStuds.length} studs, not one centred on a two-stud plate`);
  // axles
  for (const [n, p] of Object.entries(T.A)) {
    const f = lib.get(dat(p)), b = f && B(p);
    if (!f) { bad.push(`axle ${n}L: ${p} is not in the pack`); continue; }
    if (!new RegExp(`^Technic Axle +${n}( |$)`).test(f.title)) bad.push(`axle ${n}L: ${p} is "${f.title}"`);
    const len = b.hi[0] - b.lo[0];
    if (Math.abs(len - (20 * n - 1)) > TOL) bad.push(`axle ${n}L: ${p} is ${len} LDU, not ${20 * n - 1}`);
  }
  // gears: width against the table, tip under the module-1 sweep
  for (const g of gearM) {
    const want = T.W[g.part] ?? T.W.default;
    if (Math.abs(g.width - want) > TOL) bad.push(`${g.teeth}T ${g.part}: face ${g.width.toFixed(4)} mm, table ${want}`);
    if (!(Math.abs(g.tip - T.T[g.part]) <= TOL)) bad.push(`${g.teeth}T ${g.part}: tip ${g.tip.toFixed(6)} mm, table ${T.T[g.part]}`);
  }
  // the baseplate covers every framed row
  const side = mm(base.hi[0] - base.lo[0]);
  for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) for (const f of frameFork(gen)) if (f.framed) {
    const span = Math.max(f.base.x1 - f.base.x0, f.base.y1 - f.base.y0);
    if (span > side + TOL) bad.push(`${gen} ${f.key}: base ${span} mm wider than the ${side} mm baseplate`);
  }
  return bad;
}

const TABLES = { D: LEGO_DIM_MM, W: GEAR_WIDTH_MM, T: GEAR_TIP_MM, F: FRAME_PARTS, A: AXLE_PARTS };
const bad = [...packBad, ...judge(TABLES)];

// controls: perturb one entry at a time; each must fail
const controls = [];
for (const k of Object.keys(MEASURED)) controls.push([`${k} + 0.1 mm`, { ...TABLES, D: { ...LEGO_DIM_MM, [k]: LEGO_DIM_MM[k] + 0.1 } }]);
controls.push(['gear default width − 0.8 mm', { ...TABLES, W: { ...GEAR_WIDTH_MM, default: GEAR_WIDTH_MM.default - 0.8 } }]);
controls.push(['12T tip = module-1 (7 mm)', { ...TABLES, T: { ...GEAR_TIP_MM, 69778: 7 } }]);
controls.push(['24T width = default', { ...TABLES, W: { default: GEAR_WIDTH_MM.default } }]);
controls.push(['axle 4L ⇄ 5L', { ...TABLES, A: { ...AXLE_PARTS, 4: AXLE_PARTS[5], 5: AXLE_PARTS[4] } }]);
controls.push(['brick ⇄ Technic brick', { ...TABLES, F: { ...FRAME_PARTS, brick1x1: FRAME_PARTS.technicBrick1x1, technicBrick1x1: FRAME_PARTS.brick1x1 } }]);
const silent = controls.filter(([, T]) => judge(T).length === 0).map(([n]) => n);

console.log('THE TECHNIC FRAME\'S TABLES AGAINST THE LDraw PARTS (vendor/ldraw/technic-parts.mpd)\n');
for (const [k, v] of Object.entries(MEASURED)) console.log(`  ${k.padEnd(7)} parts ${v.toFixed(4).padStart(8)} mm   table ${String(LEGO_DIM_MM[k]).padStart(5)}`);
console.log('\n  gear  part    face mm  tip mm  module-1 tip  status');
for (const g of gearM) console.log(`  ${String(g.teeth).padStart(3)}T  ${g.part.padEnd(6)} ${g.width.toFixed(3).padStart(7)} ${g.tip.toFixed(3).padStart(7)} ${String(g.teeth / 2 + 1).padStart(13)}  ${/Unofficial/.test(g.org ?? '') ? 'UNOFFICIAL (in review)' : 'official'}${/^~Moved/.test(g.title ?? '') ? ` — ${g.title}` : ''}`);
console.log(`\n  axles ${Object.keys(AXLE_PARTS).join('/')}L, frame parts ${Object.values(FRAME_PARTS).join(' ')}`);
for (const b of bad) console.log(`  ✗ ${b}`);
console.log(`\ncontrols: ${controls.length - silent.length}/${controls.length} perturbations caught${silent.length ? ` — NOT caught: ${silent.join(', ')}` : ''}`);
const fails = bad.length + silent.length;
console.log(fails ? `\n${fails} FAILED` : '\nevery table entry matches the parts');
process.exit(fails ? 1 : 0);
