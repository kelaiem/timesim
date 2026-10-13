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
// WHAT IS NOT FRAMED, by name rather than by omission: a 90° mesh, or a pair
// off the lattice. No declared row has either since landing C1 held the 56T
// turntable to the lattice and landing C2 took the 60T out of going trains
// (layout.js' catalogueMesh: its base cannot be pinned to the frame's bricks
// without their studs cutting the base's rim). Both refusals stay as guards.
//
// THE DIMENSIONS BELOW ARE MEASURED (landing B). Each is read off the LDraw
// part files vendored in vendor/ldraw/technic-parts.mpd, and
// `tools/probe-technic-ldraw.mjs` re-reads every one and FAILS on any that
// differ. Landing A wrote this table from LEGO's commonly quoted figures and
// two were wrong: a stud stands 1.6 mm, not 1.7, and a Technic brick's hole
// is 5.6 mm above its bottom, not 5.8. Its gear widths were wrong too (7.2 and
// 3.6 mm; every gear but one is 8). Each of those moved the solved frame.
import { CATALOGUES, TECHNIC_FORK, TECHNIC_KEYLESS, TECHNIC_CLUTCH_GEAR, catalogueMesh } from './layout.js';

export const LEGO_DIM_MM = Object.freeze({
  verified: true,           // held by probe-technic-ldraw.mjs against the vendored parts
  stud: 8,                  // stud pitch: 3024's footprint, 20 LDU
  plateH: 3.2,              // a plate's height: 3024's body, 8 LDU
  brickH: 9.6,              // a brick's height: 3005's body, 24 LDU
  studH: 1.6,               // a stud's height: 3024 above its top face, 4 LDU
  holeZ: 5.6,               // 6541's hole centre above its bottom: the pin hole sits 10 LDU under the top of a 24 LDU body
  axleR: 2.4,               // half the cross axle's width: 3705's section, ±6 LDU
  layer: 8,                 // the axial step between a shaft's gears (technic.html's LAYER), one gear face
});
// Gear face widths along the axle, per catalogue part: each gear's extent
// along its own axle. Every gear in both catalogues is 20 LDU but the 24T,
// whose LDraw file is 19.25 LDU.
export const GEAR_WIDTH_MM = Object.freeze({ default: 8, '3648': 7.7 });
// Gear TIP radii, per part, as the parts measure — the swept disc the frame
// clears. Not teeth/2 + 1: centre distance is module 1 (that is how LEGO
// pitches its gears, and how the catalogue meshes them), but the tip is a fact
// about each part, and two of them stand OUTSIDE the module-1 tip (the 12T by
// 0.084 mm, the 20T by 0.045), so a formula would sweep less than the metal.
// Each is the surface's farthest point from the axis, to the micron.
export const GEAR_TIP_MM = Object.freeze({
  3647: 4.979878, 69778: 7.083767, 4019: 8.665331, 69779: 11.044774, 3648: 12.959951, 46372: 14.724781,
  32498: 18.803417, 3649: 20.942965, 7785: 7.886509, 7786: 9.885220, 7861: 32.641350,
  18946: 8.717182,   // landing D's clutch gear (TECHNIC_CLUTCH_GEAR)
});
// The parts the frame uses, by role. Each part's title and footprint are held
// by the probe.
export const FRAME_PARTS = Object.freeze({
  plate1x1: '3024', jumper1x2: '3794b', brick1x1: '3005', technicBrick1x1: '6541', baseplate16: '3867',
});
// The 60T turntable's BASE, vendored beside its top. Landing C2 measured the
// mount off it and refused the turntable; probe-technic-ldraw.mjs still reads it.
export const TURNTABLE_BASES = Object.freeze({ 18938: '18939' });
// Cross axles by length in studs: each is titled "Technic Axle N" and is
// 20·N − 1 LDU long (the library shortens each end half an LDU).
export const AXLE_PARTS = Object.freeze({
  2: '32062', 3: '4519', 4: '3705', 5: '32073', 6: '3706', 7: '44294', 8: '3707',
  9: '60485', 10: '3737', 12: '3708',
});

// §219 tier three (b), landing D — THE KEYLESS WORKS' OWN PARTS, by role:
// the 16T clutch gear (layout.js' TECHNIC_CLUTCH_GEAR), the ridged joiner keyed
// to the stem, the driving ring that slides on it, and a wedge belt wheel as
// the crown. Every figure in KEYLESS_DIM_MM is read off those parts' LDraw
// files (each part's own Z is its axis), off the SURFACE to the micron — a
// polygon's vertex reads a few microns off the primitive's nominal radius —
// and held by probe-technic-ldraw.mjs.
export const KEYLESS_PARTS = Object.freeze({ clutch: TECHNIC_CLUTCH_GEAR.part, joiner: '18948', ring: '18947', crown: '4185a' });
export const KEYLESS_DIM_MM = Object.freeze({
  joinerHalf: 12,          // 18948: Z ±30 LDU, a 3L joiner
  joinerR: 3.800077,       // 18948: its farthest surface, the collar at its middle (9.5 LDU)
  ringHalf: 11.2,          // 18947: Z ±28 LDU
  ringR: 7.200182,              // 18947: the flanges either side of the groove, 18 LDU
  ringFlangeHalf: 6.8,     // 18947: the flanges end 17 LDU off the ring's middle; past them only the tube
  ringTubeIn: 3.799964,         // 18947: the end tube's bore, 9.5 LDU
  ringTubeOut: 4.750120,       // 18947: the end tube's outside between its lugs, 11.875 LDU
  ringLugR: 5.433235,      // 18947: the four LUGS on each end tube, out to 13.583 LDU
  recessDepth: 3.2,        // 18946: each face's annular recess, from the face (10 LDU) to the web (2)
  recessIn: 3.600091,           // 18946: the recess's inner wall (the hub), 9 LDU
  recessOut: 5.890596,     // 18946: the recess's outer wall, 14.73 LDU at its vertices
  gearLugR: 5.321136,      // 18946: the four LUGS inside each recess's mouth, in to 13.303 LDU
  crownR: 12.000726,       // 4185a: its farthest surface, 30.0018 LDU
  crownWidth: 4,           // 4185a: Z ±5 LDU
});
// THE DOG CLUTCH, read radially: the ring's tube passes the gear's hub and its
// lugs, and the ring's lugs reach past the gear's (ringTubeIn > recessIn,
// ringTubeOut < gearLugR < ringLugR < recessOut), so the two sets of lugs can
// only pass each other ANGULARLY interleaved. Four lugs a side; the build turns
// each clutch gear so the ring's lugs sit midway between its own (ldrawBuild's
// `dogPhase`), which the keyless probe measures off the placed parts.
export const KEYLESS_DOGS = 4;
// THE RING'S TRAVEL is derived, not chosen: a clutch gear stands against each
// end of the joiner, so the ring, centred, slides until its end tube meets the
// web at the bottom of that gear's recess. travel = joinerHalf + recessDepth −
// ringHalf = 4 mm. At rest (centred) each tube end stands joinerHalf − ringHalf
// = 0.8 mm short of its gear's face, so NEUTRAL is a real third position.
export const KEYLESS_RING_TRAVEL = KEYLESS_DIM_MM.joinerHalf + KEYLESS_DIM_MM.recessDepth - KEYLESS_DIM_MM.ringHalf;

const D = LEGO_DIM_MM;
const tipOf = (row) => GEAR_TIP_MM[row.part];
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
export function rowLayout(gen, chain, { first = null } = {}) {
  const cat = CATALOGUES[gen];
  const find = (t) => cat.counts.find((c) => c.teeth === t);
  const shafts = [{ x: 0, gears: [] }];
  const meshes = [];
  for (let i = 0; i < chain.length; i++) {
    const [ta, tb] = chain[i];
    const a = i === 0 && first ? (first.teeth === ta ? first : null) : find(ta), b = find(tb), m = a && b && catalogueMesh(a, b, cat);
    if (!m) return { framed: false, reason: `${ta}:${tb} is not an admissible mesh` };
    if (m.class === 'right-angle')
      return { framed: false, reason: `${ta}:${tb} is a 90° mesh — the frame builds parallel axles only` };
    if (m.cd % cat.lattice_mm !== 0)
      return { framed: false, reason: `${ta}:${tb} stands ${m.cd} mm apart, off the ${cat.lattice_mm} mm lattice` };
    if (tipOf(a) === undefined || tipOf(b) === undefined)
      return { framed: false, reason: `${ta}:${tb} has a gear with no measured tip in GEAR_TIP_MM` };
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
  const clearsColumn = (row, cd) => tipOf(row) <= cd - D.stud / 2;
  let y = 0;
  for (let i = 0; i < meshes.length; i++) {
    if (i > 0) {
      const prev = meshes[i - 1], cur = meshes[i];
      const oneLayer = clearsColumn(cur.a, prev.cd) && clearsColumn(prev.b, cur.cd);
      y += oneLayer ? D.layer : 2 * D.layer;
    }
    const { a, b, ta, tb, cd } = meshes[i];
    const s = shafts[shafts.length - 1];
    s.gears.push({ teeth: ta, part: a.part, kind: a.kind, y, width: widthOf(a), tip: tipOf(a) });
    shafts.push({ x: s.x + cd, gears: [{ teeth: tb, part: b.part, kind: b.kind, y, width: widthOf(b), tip: tipOf(b) }] });
  }
  // every mesh, as [shaft, gear] of its driver and of its driven gear
  const meshList = shafts.slice(1).map((s, i) => ({ a: [i, shafts[i].gears.length - 1], b: [i + 1, 0] }));
  return { framed: true, shafts, meshes: meshList };
}

// The frame for one row: the axle height, every column's stack and footprint,
// every axle's span and part, and the baseplate's extent. Grid: stud centres
// sit at multiples of the pitch in x and y, so an axle at x ≡ 0 (mod 8) is ON
// the grid and one at x ≡ 4 is half a stud off it.
export function frameRow(gen, row) {
  const lay = rowLayout(gen, row.chains[gen]);
  if (!lay.framed) return { key: row.key, gen, framed: false, reason: lay.reason };
  return frameShafts(gen, row.key, lay);
}

// The frame round any set of parallel shafts: `lay.shafts` ({ x, gears,
// extras? }) and `lay.meshes`. A shaft's EXTRAS are its non-gear bodies (the
// keyless stem's joiner, ring and crown): discs of radius `tip` over `width`,
// framed and swept exactly as gears are.
function frameShafts(gen, key, lay) {
  const row = { key };
  const bodies = (s) => [...s.gears, ...(s.extras ?? [])];
  // an OUTBOARD body (the crown) stands beyond the shaft's columns: it sets
  // the axle's length, not where the columns stand
  const inboard = (s) => bodies(s).filter((g) => !g.outboard);
  const maxTip = Math.max(...lay.shafts.flatMap((s) => bodies(s).map((g) => g.tip)));
  const col = columnFor(maxTip);
  if (!col) return { key: row.key, gen, framed: false, reason: `no column of up to 12 bricks reaches a ${maxTip} mm tip` };
  const half = D.stud / 2;
  const columns = [], axles = [];
  for (const [i, s] of lay.shafts.entries()) {
    const onGrid = ((s.x % D.stud) + D.stud) % D.stud === 0;
    if (!onGrid && ((s.x % half) + half) % half !== 0)
      return { key: row.key, gen, framed: false, reason: `shaft ${i} at x ${s.x} is on neither the stud grid nor its half` };
    // The axle's own gears decide its span; its columns stand one gap outside.
    const lo = Math.min(...inboard(s).map((g) => g.y - g.width / 2));
    const hi = Math.max(...inboard(s).map((g) => g.y + g.width / 2));
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
    const out = bodies(s).filter((g) => g.outboard);
    const a0 = Math.min(yFront - half, ...out.map((g) => g.y - g.width / 2));
    const a1 = Math.max(yBack + half, ...out.map((g) => g.y + g.width / 2));
    const spanMm = a1 - a0;
    const studs = spanMm / D.stud;
    const len = Object.keys(AXLE_PARTS).map(Number).sort((a, b) => a - b).find((n) => n >= studs);
    axles.push({ shaft: i, x: s.x, z: r6(col.z), y0: a0, y1: a1, studs, part: len ? AXLE_PARTS[len] : null, lenStuds: len ?? null });
  }
  const xs = columns.flatMap((c) => c.boxes.map((b) => [b.x0, b.x1])).flat();
  const ys = columns.flatMap((c) => [c.y - half, c.y + half]);
  const base = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  base.studsX = (base.x1 - base.x0) / D.stud; base.studsY = (base.y1 - base.y0) / D.stud;
  return { key: row.key, gen, framed: true, axleZ: r6(col.z), column: col, maxTip, shafts: lay.shafts, meshes: lay.meshes, columns, axles, base };
}

export const frameFork = (gen) => TECHNIC_FORK.rows.map((row) => frameRow(gen, row));

// §219 tier three (b), landing D — THE KEYLESS WORKS' FRAME. One STEM (shaft 0)
// carries, along its axle: the crown, the setting clutch gear, the joiner with
// the ring on it, the winding clutch gear. Each branch is `rowLayout` of its
// TECHNIC_KEYLESS chain from the clutch gear (its shaft 0 IS the stem), moved
// so that gear stands against its end of the joiner: the winding branch
// leaves along +x and climbs +y from the joiner's +y end; the setting branch
// leaves along −x and climbs +y from its −y end. Only POSITIONS are mirrored
// (x → −x), never a part: every gear is still placed in its own frame.
//
// The crown stands one stud gap outside the stem's front column, so the
// column carries the stem between the crown and the works.
//
// The ring is framed at its whole stroke (centred, ± the travel), so the sweep
// holds every pose it takes against the branches.
export function frameKeyless(gen) {
  const key = 'keyless works';
  const K = KEYLESS_DIM_MM;
  const clutchW = GEAR_WIDTH_MM.default;
  const yW = K.joinerHalf + clutchW / 2, yS = -yW;          // the two clutch gears' centres
  const [wRow, sRow] = ['winding', 'setting'].map((k) => TECHNIC_KEYLESS.rows.find((r) => r.key === k));
  const w = rowLayout(gen, wRow.chains[gen], { first: TECHNIC_CLUTCH_GEAR });
  const st = rowLayout(gen, sRow.chains[gen], { first: TECHNIC_CLUTCH_GEAR });
  if (!w.framed) return { key, gen, framed: false, reason: `winding: ${w.reason}` };
  if (!st.framed) return { key, gen, framed: false, reason: `setting: ${st.reason}` };
  const move = (lay, sx, dy, branch) => lay.shafts.map((s) => ({ x: sx * s.x, branch,
    gears: s.gears.map((g) => ({ ...g, y: g.y + dy, branch })) }));
  const W = move(w, 1, yW, 'winding'), S = move(st, -1, yS, 'setting');
  const half = D.stud / 2;
  // the stem's front column stands one gap outside the setting clutch gear;
  // the crown one gap outside that column (rowLayout's own spacing rule)
  const frontCol = Math.floor((yS - clutchW / 2 - half) / D.stud) * D.stud;
  const crownY = frontCol - half - D.stud + K.crownWidth / 2;
  const stem = {
    x: 0, branch: 'stem',
    gears: [{ ...S[0].gears[0], clutch: 'setting' }, { ...W[0].gears[0], clutch: 'winding' }],
    extras: [
      { role: 'joiner', part: KEYLESS_PARTS.joiner, y: 0, width: 2 * K.joinerHalf, tip: K.joinerR },
      // the ring in its two measured sections, each over the whole stroke
      { role: 'ring', part: KEYLESS_PARTS.ring, y: 0, width: 2 * (K.ringFlangeHalf + KEYLESS_RING_TRAVEL), tip: K.ringR, slides: KEYLESS_RING_TRAVEL },
      { role: 'ring tube', y: 0, width: 2 * (K.ringHalf + KEYLESS_RING_TRAVEL), tip: K.ringLugR, slides: KEYLESS_RING_TRAVEL },
      { role: 'crown', part: KEYLESS_PARTS.crown, y: crownY, width: K.crownWidth, tip: K.crownR, outboard: true },
    ],
  };
  const shafts = [stem, ...W.slice(1), ...S.slice(1)];
  const idx = (lay, i) => (i === 0 ? 0 : lay === w ? i : W.length - 1 + i);
  const remap = (lay, m) => ({ a: [idx(lay, m.a[0]), m.a[0] === 0 ? (lay === w ? 1 : 0) : m.a[1]], b: [idx(lay, m.b[0]), m.b[1]] });
  const meshes = [...w.meshes.map((m) => remap(w, m)), ...st.meshes.map((m) => remap(st, m))];
  const f = frameShafts(gen, key, { shafts, meshes });
  return { ...f, ringTravel: KEYLESS_RING_TRAVEL, modes: ['wind', 'set', 'neutral'] };
}
