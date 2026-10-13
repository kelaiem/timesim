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
//   · every TURNTABLE's tooth count, read off its tips (the count at which the
//     outermost points cohere), is the catalogue's, and unambiguously so; the
//     60T's profile on its base is printed — what landing C2 read to refuse it.
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
import { LEGO_DIM_MM, GEAR_WIDTH_MM, GEAR_TIP_MM, FRAME_PARTS, AXLE_PARTS, TURNTABLE_BASES, frameFork, frameKeyless,
  KEYLESS_PARTS, KEYLESS_DIM_MM, KEYLESS_DOGS } from '../src/technic-frame.js';
import { TECHNIC_CLUTCH_GEAR } from '../src/layout.js';
import { dogPhase } from '../src/technic-ldraw.js';

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
const gears = [...new Map([...Object.values(CATALOGUES).filter(Boolean).flatMap((c) => c.counts), TECHNIC_CLUTCH_GEAR]
  .filter((r) => r.kind === 'spur' || r.kind === 'doubleBevel').map((r) => [r.part, r])).values()];

// §219 tier three (b) landing D — THE KEYLESS PARTS, each figure read off its
// part's SURFACE (triangles and quads; an edge line is not metal). Each part's
// own Z is its axis. The bands each reading takes are named beside it.
const surf = (p) => { const pts = []; walk(lib, dat(p), (k, ps) => { if (k === 'tri' || k === 'quad') pts.push(...ps); }); return pts; };
const rOf = (q) => Math.hypot(q[0], q[1]);
const KW = (() => {
  const J = surf(KEYLESS_PARTS.joiner), R = surf(KEYLESS_PARTS.ring), C = surf(KEYLESS_PARTS.clutch), W = surf(KEYLESS_PARTS.crown);
  const zMax = (ps) => Math.max(...ps.map((q) => q[2]));
  const ringR = Math.max(...R.map(rOf));
  const flangeZ = Math.max(...R.filter((q) => rOf(q) > ringR - 1e-3).map((q) => q[2]));
  const ringEnd = R.filter((q) => q[2] === zMax(R));                    // the end face
  const webZ = Math.min(...C.filter((q) => q[2] > 0 && rOf(q) > 9.5 && rOf(q) < 14).map((q) => q[2]));   // the recess's floor
  const dog = dogPhase(lib);
  return {
    joinerHalf: mm(zMax(J)), joinerR: mm(Math.max(...J.map(rOf))),
    ringHalf: mm(zMax(R)), ringR: mm(ringR), ringFlangeHalf: mm(flangeZ),
    ringTubeIn: mm(Math.min(...ringEnd.map(rOf))), ringTubeOut: mm(Math.max(...ringEnd.map(rOf))), ringLugR: mm(dog.rLug),
    recessDepth: mm(zMax(C) - webZ),
    // the hub: the clutch's largest radius inside the ring's bore, off the web
    recessIn: mm(Math.max(...C.filter((q) => q[2] >= webZ && rOf(q) < Math.min(...ringEnd.map(rOf))).map(rOf))),
    // the wall: its cylinder, the largest radius inside the recess short of the teeth
    recessOut: mm(Math.max(...C.filter((q) => q[2] >= webZ && q[2] < zMax(C) && rOf(q) < dog.rLug + 1.2).map(rOf).filter((v) => v < 14.75))),
    gearLugR: mm(dog.rIn),
    crownR: mm(Math.max(...W.map(rOf))), crownWidth: mm(zMax(W) - Math.min(...W.map((q) => q[2]))),
    dogs: { ring: dog.ringLugs.coherence, gear: dog.gearLugs.coherence },
  };
})();
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
  // the keyless parts (landing D)
  for (const [k, v] of Object.entries(T.K)) if (!(Math.abs(v - KW[k]) <= TOL)) bad.push(`keyless ${k}: table ${v} mm, parts ${KW[k]?.toFixed(6)} mm`);
  // four lugs a side: each set's tips fold coherently by KEYLESS_DOGS (a lug is
  // two points ±6.4° apart, so cos(4·6.4°) ≈ 0.90 is a whole set, not a stray)
  for (const [who, c] of Object.entries(KW.dogs)) if (!(c > 0.85)) bad.push(`keyless: the ${who}'s lugs do not repeat ${T.N} times round (coherence ${c.toFixed(3)})`);
  // the baseplate covers every framed row
  const side = mm(base.hi[0] - base.lo[0]);
  for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) for (const f of [...frameFork(gen), frameKeyless(gen)]) if (f.framed) {
    const span = Math.max(f.base.x1 - f.base.x0, f.base.y1 - f.base.y0);
    if (span > side + TOL) bad.push(`${gen} ${f.key}: base ${span} mm wider than the ${side} mm baseplate`);
  }
  return bad;
}

// ── the turntables: their tooth counts gate, their profile is reported ──────
// The count is read off the tips the way toothPhase reads a gear: the points
// at the largest radius, folded by every candidate N; the right N coheres and
// every other cancels. It must be the catalogue's count and unambiguous.
const turntables = [...new Map(Object.values(CATALOGUES).filter(Boolean).flatMap((c) => c.counts)
  .filter((r) => r.kind === 'turntable' || r.kind === 'turntableBevel').map((r) => [r.part, r])).values()];
const ttRows = turntables.map((r) => {
  const pts = [];
  walk(lib, dat(r.part), (k, ps) => { if (k === 'tri') for (const q of ps) pts.push(q); });
  const rad = (q) => Math.hypot(q[0], q[2]);            // a turntable turns about LDraw Y
  const rMax = Math.max(...pts.map(rad));
  const tip = pts.filter((q) => rad(q) > rMax - 0.01);
  const coh = (N) => { let c = 0, s2 = 0; for (const q of tip) { const a = N * Math.atan2(q[2], q[0]); c += Math.cos(a); s2 += Math.sin(a); } return Math.hypot(c, s2) / tip.length; };
  // A pattern N-fold coheres at 2N, 3N… too (its harmonics), so the count is
  // the FUNDAMENTAL: the smallest N that coheres strongly. It is unambiguous
  // when no count that is not a multiple of it coheres at all. The first
  // version took the strongest N, read the 60T's second harmonic (0.240) as a
  // rival, and once its range was widened let 224 = 4 × 56 win outright.
  const scores = []; for (let N = 8; N <= 240; N++) scores.push([N, coh(N)]);
  const strong = scores.filter(([, v]) => v >= 0.5);
  const N = strong.length ? strong[0][0] : NaN, best = strong.length ? strong[0][1] : 0;
  const rival = scores.filter(([M]) => M % N !== 0).sort((a, b) => b[1] - a[1])[0] ?? [NaN, 0];
  return { ...r, N, best, next: rival[1], nextN: rival[0], tipMm: mm(rMax) };
});
for (const t of ttRows) {
  if (t.N !== t.teeth) packBad.push(`turntable ${t.part}: its tips repeat ${t.N} times, the catalogue says ${t.teeth}`);
  if (!(t.best >= 0.5 && t.next < 0.05)) packBad.push(`turntable ${t.part}: the tooth count is ambiguous (${t.best.toFixed(3)} against ${t.next.toFixed(3)})`);
}
// The 60T's profile against its base, about the face the two parts share
// (LDraw y = 0): the toothed band, whether its gaps run through, and how far
// the body above and the base below stand from the axis. Landing C2 read these
// and refused the mount (layout.js' catalogueMesh says why); they remain a
// report so the reason can be re-read: the base's underside recess (its
// ceiling one stud height above the bottom, which is where a pinned brick's
// stud would stand) and where the recess's rim begins, against how far out a
// 1×1 Technic brick pinned into the base's hole reaches with its stud.
function ttProfile(top, base) {
  const prof = (p, f) => walk(lib, dat(p), (k, ps) => { if (k === 'tri') for (const q of ps) f(q); });
  const N = 60, pitch = 2 * Math.PI / N;
  const tipPts = []; prof(top, (q) => tipPts.push(q));
  const rTip = Math.max(...tipPts.map((q) => Math.hypot(q[0], q[2])));
  let c = 0, s2 = 0; for (const q of tipPts) if (Math.hypot(q[0], q[2]) > rTip - 0.01) { const a = N * Math.atan2(q[2], q[0]); c += Math.cos(a); s2 += Math.sin(a); }
  const t0 = Math.atan2(s2, c) / N;
  let bandLo = Infinity, bandHi = -Infinity, gapMax = 0, aboveR = 0, baseR = 0;
  for (const q of tipPts) {
    const r = Math.hypot(q[0], q[2]);
    let d = Math.atan2(q[2], q[0]) - t0; d = ((d % pitch) + pitch * 1.5) % pitch - pitch / 2;
    if (Math.abs(d) < pitch * 0.1 && r > rTip - 0.3 * 2.5) { bandLo = Math.min(bandLo, q[1]); bandHi = Math.max(bandHi, q[1]); }
  }
  for (const q of tipPts) {
    const r = Math.hypot(q[0], q[2]);
    let d = Math.atan2(q[2], q[0]) - t0; d = ((d % pitch) + pitch * 1.5) % pitch - pitch / 2;
    if (q[1] >= bandLo && q[1] <= bandHi && Math.abs(d) > pitch * 0.4) gapMax = Math.max(gapMax, r);
    if (q[1] < bandLo - 1) aboveR = Math.max(aboveR, r);
  }
  prof(base, (q) => { if (q[1] > bandLo && q[1] < bandHi + 2) baseR = Math.max(baseR, Math.hypot(q[0], q[2])); });
  const holes = placements(lib, dat(base), /^connhol\w*\.dat$/);
  // the underside: the base's lowest wide face, and the level one stud height
  // above it — the recess a pinned brick's stud would rise into
  let bottomY = -Infinity, ceilR = 0;
  prof(base, (q) => { if (mm(Math.hypot(q[0], q[2])) > 25 && q[1] > bottomY && mm(q[1]) < 6) bottomY = q[1]; });   // radii in mm: an LDU-for-mm slip first read a deeper face
  const ceilY = bottomY - LEGO_DIM_MM.studH / LDU_MM;
  prof(base, (q) => { if (Math.abs(q[1] - ceilY) < 1e-6) ceilR = Math.max(ceilR, Math.hypot(q[0], q[2])); });
  const holeOut = holes.length ? Math.max(...holes.map((h) => Math.abs(h.m[0]))) : NaN;   // the lug's hole, outward along X
  return { rTip: mm(rTip), band: [mm(-bandHi), mm(-bandLo)], gapMax: mm(gapMax), aboveR: mm(aboveR), baseR: mm(baseR), holes: holes.length,
    holeDown: holes.length ? mm(holes[0].m[1]) : NaN, recessDepth: LEGO_DIM_MM.studH, recessRimR: mm(ceilR) };
}
const tt60 = ttRows.find((t) => t.teeth === 60);
const profile60 = tt60 && TURNTABLE_BASES[tt60.part] && lib.has(dat(TURNTABLE_BASES[tt60.part])) ? ttProfile(tt60.part, TURNTABLE_BASES[tt60.part]) : null;
if (tt60 && !profile60) packBad.push(`turntable ${tt60.part}: its base is not in the pack`);

const TABLES = { D: LEGO_DIM_MM, W: GEAR_WIDTH_MM, T: GEAR_TIP_MM, F: FRAME_PARTS, A: AXLE_PARTS, K: KEYLESS_DIM_MM, N: KEYLESS_DOGS };
const bad = [...packBad, ...judge(TABLES)];

// controls: perturb one entry at a time; each must fail
const controls = [];
for (const k of Object.keys(MEASURED)) controls.push([`${k} + 0.1 mm`, { ...TABLES, D: { ...LEGO_DIM_MM, [k]: LEGO_DIM_MM[k] + 0.1 } }]);
controls.push(['gear default width − 0.8 mm', { ...TABLES, W: { ...GEAR_WIDTH_MM, default: GEAR_WIDTH_MM.default - 0.8 } }]);
controls.push(['12T tip = module-1 (7 mm)', { ...TABLES, T: { ...GEAR_TIP_MM, 69778: 7 } }]);
controls.push(['24T width = default', { ...TABLES, W: { default: GEAR_WIDTH_MM.default } }]);
controls.push(['axle 4L ⇄ 5L', { ...TABLES, A: { ...AXLE_PARTS, 4: AXLE_PARTS[5], 5: AXLE_PARTS[4] } }]);
for (const k of ['recessDepth', 'ringLugR', 'joinerR']) controls.push([`keyless ${k} + 0.1 mm`, { ...TABLES, K: { ...KEYLESS_DIM_MM, [k]: KEYLESS_DIM_MM[k] + 0.1 } }]);
controls.push(['brick ⇄ Technic brick', { ...TABLES, F: { ...FRAME_PARTS, brick1x1: FRAME_PARTS.technicBrick1x1, technicBrick1x1: FRAME_PARTS.brick1x1 } }]);
const silent = controls.filter(([, T]) => judge(T).length === 0).map(([n]) => n);
// the turntable count's own control: a catalogue claiming two teeth more
for (const t of ttRows) if (t.N === t.teeth + 2) silent.push(`turntable ${t.part} at ${t.teeth + 2} teeth`);
controls.push(...ttRows.map((t) => [`turntable ${t.part} at ${t.teeth + 2} teeth`]));

console.log('THE TECHNIC FRAME\'S TABLES AGAINST THE LDraw PARTS (vendor/ldraw/technic-parts.mpd)\n');
for (const [k, v] of Object.entries(MEASURED)) console.log(`  ${k.padEnd(7)} parts ${v.toFixed(4).padStart(8)} mm   table ${String(LEGO_DIM_MM[k]).padStart(5)}`);
console.log('\n  gear  part    face mm  tip mm  module-1 tip  status');
for (const g of gearM) console.log(`  ${String(g.teeth).padStart(3)}T  ${g.part.padEnd(6)} ${g.width.toFixed(3).padStart(7)} ${g.tip.toFixed(3).padStart(7)} ${String(g.teeth / 2 + 1).padStart(13)}  ${/Unofficial/.test(g.org ?? '') ? 'UNOFFICIAL (in review)' : 'official'}${/^~Moved/.test(g.title ?? '') ? ` — ${g.title}` : ''}`);
console.log('\n  keyless part figure     parts mm   table mm');
for (const k of Object.keys(KEYLESS_DIM_MM)) console.log(`  ${k.padEnd(20)} ${KW[k].toFixed(4).padStart(9)} ${String(KEYLESS_DIM_MM[k]).padStart(10)}`);
console.log(`  lugs fold by ${KEYLESS_DOGS}: ring ${KW.dogs.ring.toFixed(3)}, gear ${KW.dogs.gear.toFixed(3)}`);
console.log(`\n  axles ${Object.keys(AXLE_PARTS).join('/')}L, frame parts ${Object.values(FRAME_PARTS).join(' ')}`);
console.log('\n  turntable  teeth (catalogue)  tips repeat  coherence (best rival count)  tip mm');
for (const t of ttRows) console.log(`  ${t.part.padEnd(9)}  ${String(t.teeth).padStart(15)}  ${String(t.N).padStart(11)}  ${t.best.toFixed(3)} (${t.nextN}: ${t.next.toFixed(3)})  ${t.tipMm.toFixed(3).padStart(7)}`);
if (profile60) {
  const p = profile60;
  console.log(`  60T on its base (${TURNTABLE_BASES[tt60.part]}), heights from the face they share, + up — a REPORT, what landing C2 refused the mount on:`);
  console.log(`    toothed band ${p.band[0].toFixed(2)} … ${p.band[1].toFixed(2)} mm, tips ${p.rTip.toFixed(2)} mm, gaps open to ${p.gapMax.toFixed(2)} mm through the band`);
  console.log(`    body above the band within ${p.aboveR.toFixed(2)} mm of the axis, base beside it within ${p.baseR.toFixed(2)} mm; ${p.holes} pin holes, ${(-p.holeDown).toFixed(2)} mm below the face`);
  // a 1×1 Technic brick on a 2-stud pin out of the base's lug: the lug's face at
  // 20 mm (2.5 studs), the brick's centre a half stud beyond, its stud's edge
  // one stud radius further — against the recess rim the stud would rise into
  const studReach = 20 + LEGO_DIM_MM.stud / 2 + 2.4;
  console.log(`    underside recess ${p.recessDepth} mm deep (a stud's height), its rim from ${p.recessRimR.toFixed(2)} mm; a pinned brick's stud reaches ${studReach.toFixed(2)} mm`
    + ` — ${studReach > p.recessRimR ? `${(studReach - p.recessRimR).toFixed(2)} mm into the rim, why landing C2 refused the 60T` : 'clear'}`);
}
for (const b of bad) console.log(`  ✗ ${b}`);
console.log(`\ncontrols: ${controls.length - silent.length}/${controls.length} perturbations caught${silent.length ? ` — NOT caught: ${silent.join(', ')}` : ''}`);
const fails = bad.length + silent.length;
console.log(fails ? `\n${fails} FAILED` : '\nevery table entry matches the parts');
process.exit(fails ? 1 : 0);
