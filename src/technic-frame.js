// §219 tier three (b), landing A — THE FRAME THAT WOULD HOLD THE TECHNIC FORK,
// as topology in millimetres. Pure: no three.js, no DOM, no movement. It reads
// TECHNIC_FORK's rows and the catalogue from layout.js and answers, per row,
// where every axle sits, which parts hold it, and whether that row can be
// framed this way at all.
//
// THE CONSTRUCTION, one idiom for every parallel row, chosen because it is
// buildable on a stud grid AND reaches the half-stud spacings the catalogue
// admits (16:8 at 12 mm, 24:16 at 20 mm, 64:8 at 36 mm):
//
//   · each axle is held at BOTH ends by a COLUMN standing on a baseplate: a
//     bottom plate, then 1×1 bricks and plates to height, then a 1×1 Technic
//     brick with a hole the axle passes through;
//   · a column whose axle sits ON the stud grid stands on a 1×1 plate; one
//     whose axle sits half a stud OFF it stands on a JUMPER plate, whose single
//     stud is centred between two — LEGO's own half-stud offset;
//   · 1×1 columns are 8 mm wide, so two axles even 12 mm apart leave a gap
//     between their columns, which is what a 1×2 or a beam cannot do.
//
// THE STAIRCASE IS WHY AXLES ARE SHORT. A compound stage carries its driven
// gear and its driver one layer apart (8 mm, technic.html's LAYER), and the
// next shaft starts at the driver's layer — so the chain climbs one layer per
// stage. A full-width axle would put every shaft's metal in every layer, and a
// big driver sweeps its neighbour's axle (classic centre→fourth: the 40T's
// tips at 21 mm against an axle 16 mm away). So each axle spans only its own
// gears, its columns stand just outside them, and `probe-technic-frame.mjs`
// holds every gear's swept disc against every other axle and column.
//
// WHAT IS NOT FRAMED, by name rather than by omission: a right-angle mesh (the
// 60T turntable's face teeth) and a turntable on its own frame (56:14 at
// 35 mm, off the 4 mm lattice). Both need the turntable's mounting, which is
// LDraw geometry this landing does not have.
//
// THE DIMENSIONS BELOW ARE UNVERIFIED. They are LEGO's published or commonly
// quoted figures, and the next landing reads each from the LDraw part files
// and fails on any that differ — the feasibility note's first parts list was
// written from memory and was wrong in both directions, which is the reason
// this table says so rather than presenting itself as fact.
import { CATALOGUES, TECHNIC_FORK, catalogueMesh } from './layout.js';

export const LEGO_DIM_MM = Object.freeze({
  verified: false,          // landing B sets this by reading the .dat files
  stud: 8,                  // stud pitch
  plateH: 3.2,              // a plate's height
  brickH: 9.6,              // a brick's height (three plates)
  studH: 1.7,               // a stud's height above the surface it stands on
  holeZ: 5.8,               // a Technic brick's hole centre above its bottom face
  axleR: 2.4,               // half the cross axle's arm-to-arm width (4.8 across)
  layer: 8,                 // the axial step between a shaft's gears (technic.html's LAYER)
});
// Gear face widths along the axle, per catalogue part. UNVERIFIED, as above;
// the default is a full-width spur.
export const GEAR_WIDTH_MM = Object.freeze({ default: 7.2, '4019': 3.6 });
// The parts the frame uses, by role. UNVERIFIED LDraw/BrickLink numbers.
export const FRAME_PARTS = Object.freeze({
  plate1x1: '3024', jumper1x2: '3794b', brick1x1: '3005', technicBrick1x1: '6541',
});
// Cross axles by length in studs. UNVERIFIED.
export const AXLE_PARTS = Object.freeze({
  2: '32062', 3: '4519', 4: '3705', 5: '32073', 6: '3706', 7: '44294', 8: '3707',
  9: '60485', 10: '3737', 12: '3708',
});

const D = LEGO_DIM_MM;
const tipR = (teeth) => teeth / 2 + 1;             // module 1: addendum one module
const widthOf = (row) => GEAR_WIDTH_MM[row.part] ?? GEAR_WIDTH_MM.default;
const r6 = (v) => Math.round(v * 1e6) / 1e6;

// Where the axle's hole stands above the baseplate's top for a column of one
// bottom plate (a 1×1 or a jumper — the same height, which is what lets the two
// kinds share a row), p more plates and k bricks, then the Technic brick.
export const columnHoleZ = (p, k) => D.plateH * (1 + p) + D.brickH * k + D.holeZ;

// The lowest column whose hole clears a gear set's tips over the baseplate's
// studs: tips must pass ABOVE the stud tops, so the hole stands at least
// tip + studH up. Searched over the stack, smallest height first.
export function columnFor(maxTip) {
  let best = null;
  for (let k = 0; k <= 12; k++) for (let p = 0; p <= 2; p++) {
    const z = columnHoleZ(p, k);
    if (z >= maxTip + D.studH && (!best || z < best.z)) best = { p, k, z };
  }
  return best;
}

// One row's shafts, in the frame's own coordinates: x along the chain, y along
// the axles, z up from the baseplate's top. Same placement law as technic.html
// (a driven gear starts its shaft at the driver's layer; parallel successors
// stand one centre distance along the chain).
export function rowLayout(gen, chain) {
  const cat = CATALOGUES[gen];
  const find = (t) => cat.counts.find((c) => c.teeth === t);
  const shafts = [{ x: 0, gears: [] }];
  const meshes = [];
  for (let i = 0; i < chain.length; i++) {
    const [ta, tb] = chain[i];
    const a = find(ta), b = find(tb), m = a && b && catalogueMesh(a, b, cat);
    if (!m) return { framed: false, reason: `${ta}:${tb} is not an admissible mesh` };
    if (m.class === 'right-angle')
      return { framed: false, reason: `${ta}:${tb} is a right-angle mesh on the 60T turntable's face teeth — it needs the turntable's mounting, which is LDraw geometry` };
    if (m.cd % cat.lattice_mm !== 0)
      return { framed: false, reason: `${ta}:${tb} stands ${m.cd} mm apart, off the ${cat.lattice_mm} mm lattice — a turntable on its own frame` };
    meshes.push({ a, b, ta, tb, cd: m.cd });
  }
  // THE STEP BETWEEN STAGES. Shaft i carries its driven gear (stage i−1's) and
  // its driver (stage i's). Shaft i−1's back column stands one layer past
  // stage i−1, and shaft i+1's front column one layer before stage i — so with
  // a ONE-layer step each of those columns shares a layer with a gear on the
  // neighbouring shaft, one centre distance away. That is buildable only when
  // the gear's tip clears the column's near face (a 1×1, half a stud from its
  // axle); otherwise the step is TWO layers and the columns stand in the empty
  // layer between. Both are written as the constraint, not chosen per row.
  const clearsColumn = (teeth, cd) => tipR(teeth) <= cd - D.stud / 2;
  let y = 0;
  for (let i = 0; i < meshes.length; i++) {
    if (i > 0) {
      const prev = meshes[i - 1], cur = meshes[i];
      const oneLayer = clearsColumn(cur.ta, prev.cd) && clearsColumn(prev.tb, cur.cd);
      y += oneLayer ? D.layer : 2 * D.layer;
    }
    const { a, b, ta, tb, cd } = meshes[i];
    const s = shafts[shafts.length - 1];
    s.gears.push({ teeth: ta, part: a.part, kind: a.kind, y, width: widthOf(a) });
    shafts.push({ x: s.x + cd, gears: [{ teeth: tb, part: b.part, kind: b.kind, y, width: widthOf(b) }] });
  }
  return { framed: true, shafts };
}

// The frame for one row: the axle height, every column's stack and footprint,
// every axle's span and part, and the baseplate's extent. Grid: stud centres
// sit at multiples of the pitch in x and y, so an axle at x ≡ 0 (mod 8) is ON
// the grid and one at x ≡ 4 is half a stud off it.
export function frameRow(gen, row) {
  const lay = rowLayout(gen, row.chains[gen]);
  if (!lay.framed) return { key: row.key, gen, framed: false, reason: lay.reason };
  const maxTip = Math.max(...lay.shafts.flatMap((s) => s.gears.map((g) => tipR(g.teeth))));
  const col = columnFor(maxTip);
  if (!col) return { key: row.key, gen, framed: false, reason: `no column of up to 12 bricks reaches a ${maxTip} mm tip` };
  const half = D.stud / 2;
  const columns = [], axles = [];
  for (const [i, s] of lay.shafts.entries()) {
    const onGrid = ((s.x % D.stud) + D.stud) % D.stud === 0;
    if (!onGrid && ((s.x % half) + half) % half !== 0)
      return { key: row.key, gen, framed: false, reason: `shaft ${i} at x ${s.x} is on neither the stud grid nor its half` };
    // The axle's own gears decide its span; its columns stand one gap outside.
    const lo = Math.min(...s.gears.map((g) => g.y - g.width / 2));
    const hi = Math.max(...s.gears.map((g) => g.y + g.width / 2));
    // Column centres on the y stud grid, the nearest that leaves the gears clear.
    const yFront = Math.floor((lo - half) / D.stud) * D.stud;
    const yBack = Math.ceil((hi + half) / D.stud) * D.stud;
    for (const [end, yc] of [['front', yFront], ['back', yBack]]) {
      const stack = [{ part: onGrid ? FRAME_PARTS.plate1x1 : FRAME_PARTS.jumper1x2, h: D.plateH,
        dx: onGrid ? half : D.stud }];
      for (let n = 0; n < col.p; n++) stack.push({ part: FRAME_PARTS.plate1x1, h: D.plateH, dx: half });
      for (let n = 0; n < col.k; n++) stack.push({ part: FRAME_PARTS.brick1x1, h: D.brickH, dx: half });
      stack.push({ part: FRAME_PARTS.technicBrick1x1, h: D.brickH, dx: half, hole: true });
      let z = 0;
      const boxes = stack.map((s2) => {
        const b = { part: s2.part, x0: s.x - s2.dx, x1: s.x + s2.dx, y0: yc - half, y1: yc + half, z0: z, z1: z + s2.h, hole: !!s2.hole };
        z += s2.h; return b;
      });
      columns.push({ shaft: i, end, x: s.x, y: yc, onGrid, boxes, holeZ: r6(col.z) });
    }
    const spanMm = (yBack + half) - (yFront - half);
    const studs = spanMm / D.stud;
    const len = Object.keys(AXLE_PARTS).map(Number).sort((a, b) => a - b).find((n) => n >= studs);
    axles.push({ shaft: i, x: s.x, z: r6(col.z), y0: yFront - half, y1: yBack + half, studs, part: len ? AXLE_PARTS[len] : null, lenStuds: len ?? null });
  }
  const xs = columns.flatMap((c) => c.boxes.map((b) => [b.x0, b.x1])).flat();
  const ys = columns.flatMap((c) => [c.y - half, c.y + half]);
  const base = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  base.studsX = (base.x1 - base.x0) / D.stud; base.studsY = (base.y1 - base.y0) / D.stud;
  return { key: row.key, gen, framed: true, axleZ: r6(col.z), column: col, maxTip, shafts: lay.shafts, columns, axles, base };
}

export const frameFork = (gen) => TECHNIC_FORK.rows.map((row) => frameRow(gen, row));
