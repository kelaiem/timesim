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
import { frameFork, frameKeyless, LEGO_DIM_MM as D } from '../src/technic-frame.js';

const EPS = 1e-9;
const overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;
const boxesOverlap = (a, b) => overlap1(a.x0, a.x1, b.x0, b.x1) && overlap1(a.y0, a.y1, b.y0, b.y1) && overlap1(a.z0, a.z1, b.z0, b.z1);
// distance in the xz plane from a point to a box's rectangle
const distToRect = (px, pz, b) => Math.hypot(Math.max(b.x0 - px, 0, px - b.x1), Math.max(b.z0 - pz, 0, pz - b.z1));

function judge(f) {
  const bad = [];
  // holes and axles
  for (const c of f.columns) {
    const hole = c.boxes.find((b) => b.hole);
    const z = hole.z0 + D.holeZ;
    if (Math.abs(z - f.axleZ) > 1e-6) bad.push(`shaft ${c.shaft} ${c.end}: hole at ${z.toFixed(3)}, axle at ${f.axleZ}`);
  }
  for (const a of f.axles) if (!a.part) bad.push(`shaft ${a.shaft}: no axle of ${a.studs} studs or more`);
  // part against part
  const all = f.columns.flatMap((c) => c.boxes.map((b) => ({ ...b, who: `shaft ${c.shaft} ${c.end}` })));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
    if (all[i].who !== all[j].who && boxesOverlap(all[i], all[j])) bad.push(`overlap: ${all[i].who} ${all[i].part} ⇄ ${all[j].who} ${all[j].part}`);
  // gear sweeps — and every non-gear body a shaft carries (the keyless stem's
  // joiner, ring over its whole stroke, and crown), swept the same way
  const bodies = (s) => [...s.gears, ...(s.extras ?? [])];
  const label = (g) => (g.teeth ? `${g.teeth}T` : g.role);
  for (const [si, s] of f.shafts.entries()) for (const g of bodies(s)) {
    const tip = g.tip, y0 = g.y - g.width / 2, y1 = g.y + g.width / 2;
    if (f.axleZ - tip < D.studH - EPS) bad.push(`shaft ${si} ${label(g)}: tips ${(f.axleZ - tip).toFixed(3)} over the plate, studs ${D.studH}`);
    for (const a of f.axles) {
      if (a.shaft === si || !overlap1(y0, y1, a.y0, a.y1)) continue;
      const d = Math.abs(a.x - s.x) - D.axleR;
      if (d < tip - EPS) bad.push(`shaft ${si} ${label(g)} sweeps shaft ${a.shaft}'s axle (${d.toFixed(3)} < tip ${tip})`);
    }
    for (const b of all) {
      if (!overlap1(y0, y1, b.y0, b.y1)) continue;
      const d = distToRect(s.x, f.axleZ, b);
      if (d < tip - EPS) bad.push(`shaft ${si} ${label(g)} sweeps ${b.who} ${b.part} (${d.toFixed(3)} < tip ${tip})`);
    }
  }
  // gear against gear: two gears on different shafts whose slabs share a layer
  // may only overlap in plan if they are the meshing pair (tip circles
  // interpenetrate by design there, a module each side)
  // The meshing pairs are the frame's own list (`f.meshes`, [shaft, gear]
  // per member), so a keyless stem meshing two branches is judged like a row.
  const meshKey = (sa, ga, sb, gb) => `${sa}.${ga}|${sb}.${gb}`;
  const meshing = new Set(f.meshes.flatMap((m) => [meshKey(...m.a, ...m.b), meshKey(...m.b, ...m.a)]));
  const gears = f.shafts.flatMap((s, si) => bodies(s).map((g, gi) => ({ ...g, si, gi, x: s.x })));
  for (let i = 0; i < gears.length; i++) for (let j = i + 1; j < gears.length; j++) {
    const a = gears[i], b = gears[j];
    if (a.si === b.si || !overlap1(a.y - a.width / 2, a.y + a.width / 2, b.y - b.width / 2, b.y + b.width / 2)) continue;
    if (a.teeth && b.teeth && meshing.has(meshKey(a.si, a.gi, b.si, b.gi)) && a.y === b.y) continue;
    const d = Math.abs(a.x - b.x), reach = a.tip + b.tip;
    if (d < reach - EPS) bad.push(`shaft ${a.si} ${label(a)} sweeps shaft ${b.si} ${label(b)} (${d.toFixed(3)} < ${reach})`);
  }
  // meshes at their centre distance
  for (const m of f.meshes) {
    const a = f.shafts[m.a[0]], b = f.shafts[m.b[0]];
    const ga = a.gears[m.a[1]], gb = b.gears[m.b[1]];
    const want = (ga.teeth + gb.teeth) / 2 * CATALOGUES[f.gen].module_mm;
    if (Math.abs(Math.abs(b.x - a.x) - want) > 1e-9 || ga.y !== gb.y) bad.push(`mesh ${ga.teeth}:${gb.teeth} not at ${want} mm in one layer`);
  }
  return bad;
}

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
