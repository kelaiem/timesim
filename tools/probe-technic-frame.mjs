// DOES THE TECHNIC FORK'S FRAME HOLD ITS GEARS WITHOUT ANY PART FOULING
// ANOTHER? Acceptance, pure Node, no browser; exits non-zero on any failed row.
//
// `src/technic-frame.js` lays out every TECHNIC_FORK row as shafts in
// millimetres and builds a studded frame round them: one column per axle end, a
// 1×1 Technic brick on top holding the axle, a jumper plate under any column
// half a stud off the grid. This asks whether that frame is a BUILD, per
// generation, per row:
//
//   · every hole stands exactly at its axle's height, and every axle has a
//     part of a length LEGO makes;
//   · no two frame parts occupy the same space (box against box, every layer);
//   · every gear's SWEPT disc — its measured tip radius (GEAR_TIP_MM), over
//     its face width — clears the
//     baseplate's studs, every OTHER shaft's axle along that axle's span, and
//     every column it does not stand on;
//   · no gear's swept disc reaches a gear on another shaft it does not mesh;
//   · every meshing pair stands exactly its catalogue centre distance apart.
//
// Rows the module refuses (a right-angle mesh, a turntable off the lattice)
// are printed with the module's own reason and counted, not failed: they are
// the next landing's, and a refusal is a finding.
//
// CONTROLS, so a clean result is evidence and not an absence of looking:
//   · must-fail OVERLAP — the nearest column of another shaft slid to half a stud off its neighbour;
//   · must-fail SWEEP — every column one brick shorter, so the tips reach the
//     studs (or the frame below them);
// each must turn its row red, on every row that framed;
//   · must-fail GEAR — every gear folded into one layer must give at least one
//     gear-against-gear finding across the fork.
//
// The dimensions it measures with are the module's tables, which
// `probe-technic-ldraw.mjs` holds to the vendored LDraw parts. This probe holds
// the topology on top of them.
//
//   node tools/probe-technic-frame.mjs
import { CATALOGUES } from '../src/layout.js';
import { frameFork, frameKeyless, frameFindings, LEGO_DIM_MM as D } from '../src/technic-frame.js';

// The judge is the module's own (frameFindings, moved there in landing G so
// the motion works' solver reads the same law this probe holds).
const judge = frameFindings;

// controls: copies of a framed row with one deliberate defect
const clone = (f) => JSON.parse(JSON.stringify(f));
function slideColumn(f) {
  const g = clone(f);
  // the two nearest columns on different shafts; the first slid toward the
  // second until it stands half a stud off it (a keyless stem's neighbour is
  // not always shaft 1's column, so the pair is found, not assumed)
  let best = null;
  for (const a of g.columns) for (const b of g.columns) {
    if (a.shaft === b.shaft) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (!best || d < best.d) best = { a, b, d };
  }
  const { a, b, d } = best, k = (d - D.stud / 2) / d;
  for (const bx of a.boxes) { bx.x0 += (b.x - a.x) * k; bx.x1 += (b.x - a.x) * k; bx.y0 += (b.y - a.y) * k; bx.y1 += (b.y - a.y) * k; }
  return g;
}
function shortenColumns(f) {
  const g = clone(f);
  g.axleZ -= D.brickH;
  for (const c of g.columns) for (const b of c.boxes) { b.z0 -= b.part === c.boxes[0].part && b === c.boxes[0] ? 0 : 0; }
  // drop every column's stack one brick: remove nothing, just lower the hole —
  // the hole check is not the point here, the sweep is, so re-seat the holes
  for (const c of g.columns) for (const b of c.boxes) if (b.hole) { b.z0 -= D.brickH; b.z1 -= D.brickH; }
  for (const a of g.axles) a.z = g.axleZ;
  return g;
}

// every gear into one layer: a non-meshing pair on different shafts then shares
// a slab, and the gear-against-gear test must see at least one across the fork
function oneLayer(f) {
  const g = clone(f);
  for (const s of g.shafts) for (const gr of s.gears) gr.y = 0;
  return g;
}
let gearGearSeen = 0;

let fails = 0, framed = 0, refused = 0;
console.log('THE TECHNIC FORK\'S FRAME — columns of 1×1 bricks, a Technic brick on top, a jumper under half-stud axles');
console.log(`dimensions: ${D.verified ? 'VERIFIED against the LDraw library' : 'UNVERIFIED (the module\'s table; the library landing checks them)'}\n`);
for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) {
  for (const f of [...frameFork(gen), frameKeyless(gen)]) {
    if (!f.framed) { refused++; console.log(`  —    ${gen.padEnd(16)} ${f.key.padEnd(18)} not framed: ${f.reason}`); continue; }
    framed++;
    const bad = judge(f);
    const ctlOverlap = f.shafts.length > 1 ? judge(slideColumn(f)).length > 0 : true;
    const ctlSweep = judge(shortenColumns(f)).length > 0;
    gearGearSeen += judge(oneLayer(f)).filter((m) => /T sweeps shaft \d+ \d+T/.test(m)).length;
    const ok = !bad.length && ctlOverlap && ctlSweep;
    if (!ok) fails++;
    const shape = `${f.shafts.length} axles, axle height ${f.axleZ.toFixed(1)} mm (${f.column.k} brick${f.column.k === 1 ? '' : 's'} + ${f.column.p + 1} plate${f.column.p ? 's' : ''}), base ${f.base.studsX}×${f.base.studsY} studs, `
      + `${f.columns.filter((c) => !c.onGrid).length / 2} on jumpers, axles ${f.axles.map((a) => a.lenStuds).join('/')}L`;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${gen.padEnd(16)} ${f.key.padEnd(18)} ${shape}`);
    for (const b of bad) console.log(`         ${b}`);
    if (!ctlOverlap) console.log('         CONTROL: a column slid into its neighbour was NOT caught');
    if (!ctlSweep) console.log('         CONTROL: columns a brick short were NOT caught');
  }
}
if (!gearGearSeen) { console.log('CONTROL: gears folded into one layer gave no gear-against-gear finding'); fails++; }
else console.log(`\ncontrol: gears folded into one layer — ${gearGearSeen} gear-against-gear findings`);
console.log(`\n${framed} rows framed, ${refused} refused with their reason, ${fails} failing`);
process.exit(fails || !framed ? 1 : 0);
