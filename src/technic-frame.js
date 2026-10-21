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
import { CATALOGUES, TECHNIC_FORK, TECHNIC_KEYLESS, TECHNIC_CLUTCH_GEAR, TECHNIC_MOTION_WORKS, catalogueMesh,
  ratQ, ratMul, ratEq } from './layout.js';

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
export const KEYLESS_PARTS = Object.freeze({ clutch: TECHNIC_CLUTCH_GEAR.part, joiner: '18948', ring: '18947', crown: '4185a',
  catch: '6641',
  // landing F — the pull: a 28T pinion on the selector, a 1×14 rack it drives,
  // the rack's guides (tiles to slide on); the detent's follower (a half bush,
  // round) on a thin liftarm, pressed on a small gear on the selector axle (the
  // DETENT WHEEL, KEYLESS_DETENT); the frame outgrows a 16×16 base
  pinion: '46372', rack: '18942', tile: '3070b', detentArm: '6632', follower: '32123a', baseplate32: '3811' });
export const KEYLESS_DIM_MM = Object.freeze({
  joinerHalf: 12,          // 18948: Z ±30 LDU, a 3L joiner
  joinerR: 3.800077,       // 18948: its farthest surface, the collar at its middle (9.5 LDU)
  joinerStop: 0.8,         // 18948: its two axle holes end 2 LDU either side of its middle — a web between them that no axle passes (§305)
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
// §219 tier three (b) landing E — THE SELECTOR'S PARTS. The changeover catch
// (6641) is a rocker: an axle hole along its own X through a boss, and below
// it a blade whose rounded bulb rides in the ring's groove. Read off the parts
// (catch: its Z axis runs from the bulb up through the boss), held by
// probe-technic-ldraw.mjs.
export const KEYLESS_SELECTOR_DIM_MM = Object.freeze({
  catchPivot: -8,          // 6641: the pivot hole's centre on the catch's own Z, −20 LDU
  catchTip: 10.4,          // 6641: the bulb's edge 26 LDU below the pivot
  catchHalfWidth: 4,       // 6641: the blade and boss span its X ±10 LDU, one stud
  catchHalfThick: 3.6,     // 6641: the boss spans its Y ±9 LDU
  grooveFloorR: 4.800256,  // 18947: the groove's floor, 12.0006 LDU from the axis
});
// THE PIVOT'S HEIGHT above the stem is not chosen: both axles stand in Technic
// bricks on the same baseplate, so their difference is a whole number of
// plates. The bulb must clear the groove's floor (the ring turns under it) and
// stand inside the flanges (or it cannot push them), and exactly one plate
// count does both: n·plateH − catchTip in (grooveFloorR, ringR). 4 plates puts
// the bulb 2.8 mm from the axis, inside the floor; 5 puts it at 5.6 mm; 6 at
// 8.8, past the flanges.
export function selectorRise() {
  const S = KEYLESS_SELECTOR_DIM_MM;
  const ok = [];
  for (let n = 1; n <= 12; n++) {
    const tip = n * LEGO_DIM_MM.plateH - S.catchTip;
    if (tip > S.grooveFloorR && tip < KEYLESS_DIM_MM.ringR) ok.push(n);
  }
  return ok.length === 1 ? { plates: ok[0], mm: ok[0] * LEGO_DIM_MM.plateH } : { plates: null, candidates: ok };
}

// §219 tier three (b) landing F — THE PULL AND ITS DETENT, read off the parts
// (held by probe-technic-ldraw.mjs). The rack (18942) lies teeth up: its teeth
// are toothr primitives every 8 LDU along its X, root 22.5 LDU and tip 27.5 LDU
// above its underside's datum, its underside 9 LDU below that datum. They do
// NOT run its whole length: 32 of them from X −112 to +136 LDU, and the −X end
// carries a round boss 1.5 LDU proud of the tips instead — so the pinion must
// work the toothed span (probe-technic-keyless.mjs' PULL holds that).
export const KEYLESS_PULL_DIM_MM = Object.freeze({
  rackPitch: 3.2,          // 18942: one tooth every 8 LDU
  rackPitchToBottom: 13.6, // 18942: the tooth's mid-height (25 LDU up) over the underside (9 LDU down)
  rackAddendum: 1.0,       // 18942: tip 2.5 LDU above the mid-height
  rackDedendum: 1.0,       // 18942: root 2.5 LDU below it
  rackHalfLength: 55.6,    // 18942: X ±139 LDU
  rackHalfWidth: 4,        // 18942: Z ±10 LDU
  rackTeethLo: -44.8,      // 18942: its first tooth at X −112 LDU
  rackTeethHi: 54.4,       // 18942: its last at X +136 LDU
  armHoles: 16,            // 6632: its two END axle holes 40 LDU apart (a round hole between)
  armHalfThick: 2,         // 6632: 10 LDU thick
  followerR: 3.600091,     // 32123a: its flanges' radius, 9 LDU (a vertex reads it 0.2 µm out) — round, so it rides a wheel the same both ways
  followerHalfWidth: 2,    // 32123a: Z ±5 LDU
});
export const PULL_PINION_TEETH = 28;
// THE DETENT IS A WHEEL ON THE SELECTOR AXLE, one tooth per mode. Landing F
// measured the alternative first: a detent on the RACK clicks at every rack
// tooth, a mode is two of them (28T), and the click between leaves the ring
// 1.96 of its 4 mm in — 1.16 mm past the clutch gear's face, half engaged — and
// the 8T keyed on an arm that the plan named is a RATCHET there (it meshes the
// rack and locks pushed toward its pivot). So each generation's wheel is the
// catalogue spur whose ONE tooth lands the catch nearest the ring's web, as a
// fraction of the catch's play at that angle (16T: 0.57 mm short, out of play;
// 12T: 0.46 mm over of 0.91; 14T: 0.05 short of 0.53 — the 2026 catalogue's
// alone). `mount` is the turn the wheel goes onto its axle at (a quarter turn
// is 3.5 teeth of a 14T, so it is a real choice; 3 of a 12T, so it is not),
// `plates` the follower's pivot height over the selector's axis and `sense`
// the way the follower's band turns its arm onto the wheel. They are the
// placement whose THREE RESTS — the notch's minimum and one tooth either side —
// leave the ring nearest where it belongs, as a fraction of what it may miss
// by: at neutral short of both gears' faces (travel − recess depth, 0.8 mm), at
// wind and set within the catch's play of the web; among notches symmetric to
// 30%, pivot above the axis. Classic's lands −1.11° off neutral (the ring
// 0.34 and 0.59 mm over the web, of 0.79 and 1.04 mm play), the 2026's +0.34°.
// tools/probe-technic-keyless.mjs re-runs the survey and the placement search
// and fails when either answers otherwise.
export const KEYLESS_DETENT = Object.freeze({
  technic_classic: { teeth: 12, mount: 0, plates: 2, sense: 1 },
  technic_2026: { teeth: 14, mount: 90, plates: 3, sense: -1 },
});
// The follower's pivot is two studs toward the rack's side (−y) of the
// selector's axis, so one arm (the 1×3 thin liftarm, 16 mm between its end
// holes) serves both wheels: on that line the search above finds a symmetric
// notch near neutral for each, where a one-stud pivot and the 1×2 arm leaves
// classic's 4.5° off.
export const DETENT_PIVOT = Object.freeze({ dyStuds: -2 });
// THE RACK'S HEIGHT: it slides on tiles, so its underside is a lattice height
// (whole plates). The pinion's pitch circle and the rack's pitch line may
// stand apart by d: d > 0 is a shallower mesh. It must stay above −(rack
// dedendum − pinion addendum), or the pinion's tips hit the rack's roots, and
// below rack addendum + pinion addendum, or the teeth part. The lattice leaves
// exactly one d in that window; this returns it.
export function pullRackLift(selectorZ, pinionTip = GEAR_TIP_MM[KEYLESS_PARTS.pinion]) {
  const P = KEYLESS_PULL_DIM_MM, r = PULL_PINION_TEETH / 2, add = pinionTip - r;
  const lo = -(P.rackDedendum - add), hi = P.rackAddendum + add;
  const ok = [];
  for (let n = 0; n <= 40; n++) {
    const bottom = n * LEGO_DIM_MM.plateH, d = r6(selectorZ - r - (bottom + P.rackPitchToBottom));
    if (d > lo && d < hi) ok.push({ bottom: r6(bottom), d, plates: n });
  }
  return ok.length === 1 ? ok[0] : null;
}

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
  // §305 (TODO 264) — AN AXLE LONGER THAN ITS SPAN overhangs it, and the overhang is metal: the part is
  // lenStuds whole studs, so y0…y1 are moved to the PART's extent. Where it overhangs is not free — landing D's
  // 11-stud minute axle is a 12L, centred, and its front half-stud ran 1.60 LDU into the setting branch's 24T.
  // So the part stands centred if its overhang meets nothing, else flush with the end whose overhang does not
  // (another shaft's body — its tip disc — or another shaft's column within the axle's reach).
  const reachesAxle = (a, y0, y1) => lay.shafts.some((o, j) => j !== a.shaft && bodies(o).some((g) =>
    Math.min(y1, g.y + g.width / 2) - Math.max(y0, g.y - g.width / 2) > 1e-9 && Math.abs(o.x - a.x) - D.axleR < g.tip - 1e-9))
    || columns.some((c) => c.shaft !== a.shaft && c.boxes.some((b) => Math.min(y1, b.y1) - Math.max(y0, b.y0) > 1e-9
      && Math.hypot(Math.max(b.x0 - a.x, 0, a.x - b.x1), Math.max(b.z0 - a.z, 0, a.z - b.z1)) < D.axleR - 1e-9));
  for (const a of axles) {
    if (!a.lenStuds || a.lenStuds * D.stud <= a.y1 - a.y0 + 1e-9) continue;
    const over = a.lenStuds * D.stud - (a.y1 - a.y0);
    const place = [[a.y0 - over / 2, a.y1 + over / 2], [a.y0, a.y1 + over], [a.y0 - over, a.y1]]
      .find(([y0, y1]) => !reachesAxle(a, y0, a.y0) && !reachesAxle(a, a.y1, y1));
    if (!place) return { key: row.key, gen, framed: false, reason: `shaft ${a.shaft}'s ${a.lenStuds}L axle overhangs its ${a.studs}-stud span into a part at either end` };
    a.span = [a.y0, a.y1];                                     // the span the part covers (its columns' outer faces)
    [a.y0, a.y1] = place.map(r6);
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
//
// §219 tier three (b) landing G — THE MOTION WORKS rides the setting branch's
// output axle (the minute axle). `motion` is { chain, x, y } (MOTION_WORKS_PLACEMENT
// and TECHNIC_MOTION_WORKS by default; null frames the keyless works alone):
// mesh i at layer y[i], its driven gear on a shaft x[i] off the minute axle,
// the last driven gear the round-bored hour wheel idling ON the minute axle.
// The pull's placement is decided by the keyless works alone (its reach
// excludes the motion works), so landing F's derived rack, wheel and pivot do
// not move with it: the motion works must clear them, and frameFindings holds
// it to the rack's swept box.
export function frameKeyless(gen, motionArg) {
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
  const place = MOTION_WORKS_PLACEMENT[gen];
  const motion = motionArg !== undefined ? motionArg
    : place ? { chain: TECHNIC_MOTION_WORKS.chains[gen], ...place } : null;
  let mw = null;
  if (motion) {
    mw = addMotionWorks(gen, shafts, meshes, shafts.indexOf(S[S.length - 1]), motion);
    if (mw.reason) return { key, gen, framed: false, reason: `motion works: ${mw.reason}` };
  }
  const f = frameShafts(gen, key, { shafts, meshes });
  if (!f.framed) return f;
  // §305 (TODO 264) — THE STEM IS TWO AXLES. The joiner is not a tube: its axle holes end joinerStop either side
  // of its middle, with a web between them (landing D's one 8L stem ran through it, 1.17 LDU into the web). So the
  // stem is an axle from each END of its span (flush, as the one axle was, so each fills its column's hole) into
  // the joiner's bore: the shortest that enters the bore past the joiner's face and stops short of the web. Each is
  // keyed to the joiner, which turns them together.
  {
    const st = f.axles[0], lens = Object.keys(AXLE_PARTS).map(Number).sort((a, b) => a - b), trim = 0.2;
    const piece = (end, sg) => {                               // sg −1: the crown's end, +1: the winding end
      const n = lens.find((v) => { const far = end - sg * (v * D.stud - trim); return sg * far < K.joinerHalf && sg * far >= K.joinerStop; });
      return n === undefined ? null : sg < 0 ? { y0: end, y1: end + n * D.stud, part: AXLE_PARTS[n], lenStuds: n } : { y0: end - n * D.stud, y1: end, part: AXLE_PARTS[n], lenStuds: n };
    };
    const pieces = [piece(st.y0, -1), piece(st.y1, 1)];
    if (pieces.some((p) => !p)) return { key, gen, framed: false, reason: 'no axle reaches from an end of the stem into the joiner\'s bore short of its web' };
    f.axles[0] = { ...st, part: pieces.map((p) => p.part).join('+'), lenStuds: pieces.map((p) => p.lenStuds).join('+'), pieces };
  }
  // LANDING E — THE SELECTOR: a horizontal axle along x over the ring's
  // neutral centre (y = 0), the catch keyed to it at x = 0, its bulb in the
  // groove. Its columns stand on the +x side (the setting branch's 8T sits at
  // y = 0 on −x), the first one gap clear of the ring's flanges, the second
  // beside it. (Landing E's knob on the axle's end is gone: landing F's pull
  // turns the selector, through the pinion on its other end.)
  const rise = selectorRise();
  if (!rise.plates) return { key, gen, framed: false, reason: `no whole number of plates seats the catch's bulb in the groove (${rise.candidates.join(', ') || 'none'})` };
  const SD = KEYLESS_SELECTOR_DIM_MM;
  const z = r6(f.axleZ + rise.mm);
  const plates = Math.round((z - D.holeZ) / D.plateH);          // plate-heights under the hole
  const k = Math.floor((plates - 1) / 3), p = plates - 1 - 3 * k;
  if (Math.abs(columnHoleZ(p, k) - z) > 1e-6) return { key, gen, framed: false, reason: `the selector's hole at ${z} mm is off the plate lattice` };
  const x1 = Math.ceil((K.ringR + half) / D.stud) * D.stud, x2 = x1 + D.stud;
  const selCols = [x1, x2].map((xc, i) => {
    const stack = [{ part: FRAME_PARTS.plate1x1, h: D.plateH }];
    for (let n = 0; n < p; n++) stack.push({ part: FRAME_PARTS.plate1x1, h: D.plateH });
    for (let n = 0; n < k; n++) stack.push({ part: FRAME_PARTS.brick1x1, h: D.brickH });
    stack.push({ part: FRAME_PARTS.technicBrick1x1, h: D.brickH, hole: true, turned: true });
    let zz = 0;
    const boxes = stack.map((b) => { const o = { part: b.part, x0: xc - half, x1: xc + half, y0: -half, y1: half, z0: zz, z1: zz + b.h, hole: !!b.hole, turned: !!b.turned }; zz += b.h; return o; });
    return { shaft: 'selector', end: i ? 'outer' : 'inner', x: xc, y: 0, onGrid: true, boxes, holeZ: z };
  });
  // LANDING F — THE PULL. The selector's 28T pinion stands on −x past the
  // farthest reach of the setting branch (its columns and its gears' tips),
  // one gap clear; the detent wheel one stud outboard of it; the rack lies
  // under the pinion along y, sliding on tiles between two walls; the
  // follower's arm pivots outboard of the wheel on a column pair of turned
  // bricks. The selector axle runs from the wheel's outer face to the outer
  // selector column's.
  const P = KEYLESS_PULL_DIM_MM, gearW = GEAR_WIDTH_MM.default;
  const DT = KEYLESS_DETENT[gen];
  if (!DT) return { key, gen, framed: false, reason: `no detent wheel declared for ${gen}` };
  const wheel = CATALOGUES[gen].counts.find((c) => c.kind === 'spur' && c.teeth === DT.teeth);
  if (!wheel) return { key, gen, framed: false, reason: `the ${gen} catalogue has no ${DT.teeth}T spur for the detent wheel` };
  // (the keyless works' own reach: a motion-works shaft, its columns and the
  // gears it adds to the minute axle are not counted, so the pull stands where
  // landing F derived it whether or not the motion works is framed)
  const ownShaft = (i) => f.shafts[i].branch !== 'motion';
  const reach = -Math.min(...f.columns.filter((c) => ownShaft(c.shaft)).flatMap((c) => c.boxes.map((b) => b.x0)),
    ...f.shafts.filter((sh) => sh.branch !== 'motion').flatMap((sh) => [...sh.gears, ...(sh.extras ?? [])].filter((g) => g.branch !== 'motion').map((g) => sh.x - g.tip)));
  const xp = -Math.ceil((reach + half + gearW / 2) / D.stud) * D.stud, xw = xp - D.stud;
  const ax0 = xw - gearW / 2, axSpan = x2 + half - ax0;
  const lenStuds = axSpan / D.stud;
  if (!AXLE_PARTS[lenStuds]) return { key, gen, framed: false, reason: `no ${lenStuds}L axle spans the wheel to the selector's columns` };
  const ax1 = ax0 + lenStuds * D.stud;
  const selector = { y: 0, z, rise: rise.mm, risePlates: rise.plates, columns: selCols,
    axle: { x0: ax0, x1: ax1, part: AXLE_PARTS[lenStuds], lenStuds }, catchX: 0, pinionX: xp,
    wheel: { x: xw, part: wheel.part, teeth: wheel.teeth, tip: GEAR_TIP_MM[wheel.part], mount: DT.mount } };
  const lift = pullRackLift(z);
  if (!lift) return { key, gen, framed: false, reason: 'no lattice height meshes the rack with the selector\'s pinion' };
  const pitchZ = r6(lift.bottom + P.rackPitchToBottom);
  // the rack's centre at neutral: on the crown's side of the pinion, so its
  // pulled end is the one a hand reaches (the build trims it by under half a
  // tooth to mesh). Its stroke is the wheel's one tooth rolled off the
  // pinion tooth for tooth: N_pinion/N_wheel rack pitches.
  const stroke = r6(PULL_PINION_TEETH * P.rackPitch / wheel.teeth), rackY = -3 * D.stud;
  // a column on the stud grid: plates and bricks up to `top`, its last member given
  const column = (xc, yc, top, last, tag) => {
    const units = Math.round(top / D.plateH);
    const lastUnits = Math.round(last.h / D.plateH), below = units - lastUnits;
    if (Math.abs(units * D.plateH - top) > 1e-6 || below < 1) return null;
    const k = Math.floor((below - 1) / 3), p = below - 1 - 3 * k;
    const stack = [{ part: FRAME_PARTS.plate1x1, h: D.plateH }];
    for (let n = 0; n < p; n++) stack.push({ part: FRAME_PARTS.plate1x1, h: D.plateH });
    for (let n = 0; n < k; n++) stack.push({ part: FRAME_PARTS.brick1x1, h: D.brickH });
    stack.push(last);
    let zz = 0;
    const boxes = stack.map((b) => { const o = { part: b.part, x0: xc - half, x1: xc + half, y0: yc - half, y1: yc + half, z0: zz, z1: zz + b.h, hole: !!b.hole, turned: !!b.turned }; zz += b.h; return o; });
    return { shaft: tag, end: `${xc},${yc}`, x: xc, y: yc, onGrid: true, boxes, holeZ: last.hole ? r6(zz - D.brickH + D.holeZ) : undefined };
  };
  // the rack's supports: where the rack covers them over its whole stroke,
  // a tile on top at the rack's underside; walls either side, a brick taller
  const cover = P.rackHalfLength - stroke - P.rackPitch / 2;    // the build trims the rack by under half a tooth
  const supportYs = [rackY - 4 * D.stud, rackY + 4 * D.stud].filter((y) => Math.abs(y - rackY) + half <= cover);
  const pullCols = [];
  for (const y of supportYs) {
    pullCols.push(column(xp, y, lift.bottom, { part: KEYLESS_PARTS.tile, h: D.plateH }, 'rack support'));
    for (const xw2 of [xp - D.stud, xp + D.stud]) pullCols.push(column(xw2, y, lift.bottom + D.brickH, { part: FRAME_PARTS.brick1x1, h: D.brickH }, 'rack wall'));
  }
  // THE FOLLOWER: the half bush CENTRED on the wheel's outer face — its inner
  // flange (the 1.2 mm that bears, 32123a's |Z| 2–5 LDU) wholly on the wheel,
  // its outer half beyond it, so the arm outboard of it stands half a bush
  // (2 mm) clear of the turning wheel's face rather than rubbing it. A 2L axle
  // through the arm's far hole and the bush; the pivot axle through the arm's
  // near hole and on outboard through two turned bricks, the first on the stud
  // grid clear of the arm's outer face.
  const fx = ax0, armX = fx - P.followerHalfWidth - P.armHalfThick, armOut = armX - P.armHalfThick;
  const pivotY = DETENT_PIVOT.dyStuds * D.stud, pivotZ = r6(z + DT.plates * D.plateH);
  const fAxle0 = fx + P.followerHalfWidth - 2 * D.stud;                 // the 2L ends at the bush's inner face
  const c0 = Math.floor((armOut - half) / D.stud) * D.stud, colX = [c0, c0 - D.stud];
  for (const xc of colX)
    pullCols.push(column(xc, pivotY, pivotZ - D.holeZ + D.brickH, { part: FRAME_PARTS.technicBrick1x1, h: D.brickH, hole: true, turned: true }, 'detent pivot'));
  if (pullCols.some((c) => !c)) return { key, gen, framed: false, reason: 'a pull column is off the plate lattice' };
  const pivotX0 = Math.min(...colX) - half, pivotX1 = armX + P.armHalfThick;   // through both bricks and the arm
  const detent = { wheel: selector.wheel, sense: DT.sense, pivot: { x0: pivotX0, x1: pivotX1, y: pivotY, z: pivotZ },
    arm: { x: armX }, follower: { x: fx, axleX0: fAxle0, axleX1: fAxle0 + 2 * D.stud } };
  const pull = { x: xp, y: rackY, bottom: lift.bottom, d: lift.d, plates: lift.plates, pitchZ, stroke, detent, columns: pullCols };
  const columns = [...f.columns, ...selCols, ...pullCols];
  const xs = columns.flatMap((c) => c.boxes.flatMap((b) => [b.x0, b.x1]));
  const ys = columns.flatMap((c) => c.boxes.flatMap((b) => [b.y0, b.y1]));
  const base = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys, f.base.y0), y1: Math.max(...ys, f.base.y1) };
  base.studsX = (base.x1 - base.x0) / D.stud; base.studsY = (base.y1 - base.y0) / D.stud;
  // the rack's SWEPT box over its whole stroke (the build trims its centre by
  // under half a tooth): a moving body with no column, held by frameFindings
  // against every gear and column so the motion works cannot be framed into it
  const reachY = P.rackHalfLength + stroke + P.rackPitch / 2;
  const obstacles = [{ who: 'rack (swept)', part: KEYLESS_PARTS.rack, x0: xp - P.rackHalfWidth, x1: xp + P.rackHalfWidth,
    y0: rackY - reachY, y1: rackY + reachY, z0: lift.bottom, z1: r6(pitchZ + P.rackAddendum) }];
  return { ...f, columns, base, selector, pull, obstacles, ringTravel: KEYLESS_RING_TRAVEL, modes: ['wind', 'set', 'neutral'],
    ...(mw ? { motion: mw } : {}) };
}

// §219 tier three (b) landing G — THE MOTION WORKS' PLACEMENT, per generation:
// mesh i stands in layer y[i] (mm along the axles) with its driven gear on the
// shaft x[i] mm off the minute axle (0 for the last mesh: the hour wheel, ON
// that axle). Where a mesh's shaft and gear already exist (the setting
// branch's own minute wheel, its 8T meshing the minute axle's 16T at y 0), the
// mesh is the setting branch's, not a second copy: the motion works SHARES the
// setting train's minute wheel, as the steel's does. The solve tries that and
// neither generation takes it (classic closes no such chain in four meshes,
// 2026's two on the 64T do not frame), so both answer a new 8T on the minute
// axle, three new shafts, the third an IDLER. Solved with the chain by
// solveMotionWorks; probe-technic-motion.mjs re-solves both and fails when
// either answers otherwise.
export const MOTION_WORKS_PLACEMENT = Object.freeze({
  technic_classic: Object.freeze({ x: [12, 28, 16, 0], y: [32, 40, 64, 64] }),
  technic_2026: Object.freeze({ x: [12, 28, 16, 0], y: [32, 40, 64, 64] }),
});

// Adds the motion works to a keyless frame's shafts and meshes in place, from
// the minute axle `mi`. Returns { reason } when the spec cannot be laid out as
// parts, else what it added: the minute axle, the hour wheel ([shaft, gear]),
// and its meshes (each [shaft, gear] of driver and driven, the shared ones
// marked).
function addMotionWorks(gen, shafts, meshes, mi, { chain, x, y }) {
  const cat = CATALOGUES[gen], hw = TECHNIC_MOTION_WORKS.hourWheel;
  if (!chain || chain.length !== x.length || chain.length !== y.length) return { reason: 'the chain and its placement differ in length' };
  if (x[x.length - 1] !== 0) return { reason: 'the last mesh does not come back to the minute axle' };
  const xM = shafts[mi].x;
  const gearRow = (t, i, end) => {
    const r = end ? hw : cat.counts.find((c) => c.teeth === t);
    return r && { teeth: t, part: r.part, kind: r.kind, width: widthOf(r), tip: tipOf(r), branch: 'motion' };
  };
  // an existing shaft carrying exactly this gear in this layer (the shared
  // minute wheel); any other shaft on the line is a different axle, which
  // frameFindings holds apart from it along the line
  const shaftAt = (xs, ys, t) => shafts.findIndex((s) => s.x === xs && s.gears.some((g) => g.y === ys && g.teeth === t));
  const out = { minute: mi, meshes: [] };
  let cur = mi;
  for (let i = 0; i < chain.length; i++) {
    const [ta, tb] = chain[i], last = i === chain.length - 1;
    // the driver: a gear of this count in this layer on the current shaft
    // (the previous mesh's driven gear when the shaft is an idler), else a new one
    let ga = shafts[cur].gears.findIndex((g) => g.y === y[i] && g.teeth === ta);
    if (ga < 0) {
      if (shafts[cur].gears.some((g) => Math.abs(g.y - y[i]) < g.width / 2 + D.layer / 2 - 1e-9)) return { reason: `two gears in one layer on the shaft at x ${shafts[cur].x}` };
      const g = gearRow(ta, i, false);
      if (!g) return { reason: `no ${ta}T in the ${gen} catalogue` };
      shafts[cur].gears.push({ ...g, y: y[i] });
      ga = shafts[cur].gears.length - 1;
    }
    // the driven gear: the hour wheel on the minute axle, a gear the frame
    // already has (shared), or a new shaft
    let sb, gb, shared = false;
    if (last) {
      sb = mi;
      if (shafts[mi].gears.some((g) => Math.abs(g.y - y[i]) < g.width / 2 + D.layer / 2 - 1e-9)) return { reason: 'the hour wheel shares a layer with a gear keyed to the minute axle' };
      const g = gearRow(tb, i, true);
      shafts[mi].gears.push({ ...g, y: y[i], idles: true, role: 'hour wheel' });
      gb = shafts[mi].gears.length - 1;
    } else {
      sb = shaftAt(xM + x[i], y[i], tb);
      if (sb >= 0) {
        gb = shafts[sb].gears.findIndex((g) => g.y === y[i] && g.teeth === tb);
        shared = true;
      } else {
        const g = gearRow(tb, i, false);
        if (!g) return { reason: `no ${tb}T in the ${gen} catalogue` };
        shafts.push({ x: xM + x[i], branch: 'motion', gears: [{ ...g, y: y[i] }] });
        sb = shafts.length - 1; gb = 0;
      }
    }
    const m = { a: [cur, ga], b: [sb, gb], branch: 'motion' };
    const same = (p, q) => p[0] === q[0] && p[1] === q[1];
    const known = meshes.some((e) => (same(e.a, m.a) && same(e.b, m.b)) || (same(e.a, m.b) && same(e.b, m.a)));
    if (shared && !known) return { reason: `the gear at x ${xM + x[i]} is not meshed by the one driving it` };
    if (!known) meshes.push(m);
    out.meshes.push({ ...m, shared: known });
    cur = sb;
  }
  out.hour = [mi, shafts[mi].gears.length - 1];
  return out;
}

// DOES A FRAME FOUL ITSELF? Every finding as a sentence, [] when none: holes at
// their axles' heights and every axle a part LEGO makes; no two column parts in
// one space; every gear's (and every carried body's) SWEPT disc — its measured
// tip over its face width — clear of the baseplate's studs, every other shaft's
// axle along that axle's span, every column it does not stand on and every
// moving obstacle's swept box; no gear sweeping a gear on another shaft it does
// not mesh; every mesh at its catalogue centre distance in one layer. Moved
// here from tools/probe-technic-frame.mjs (landing G) so the motion works'
// solver and the probe read ONE law.
export function frameFindings(f) {
  const EPS = 1e-9, bad = [];
  const overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;
  const boxesOverlap = (a, b) => overlap1(a.x0, a.x1, b.x0, b.x1) && overlap1(a.y0, a.y1, b.y0, b.y1) && overlap1(a.z0, a.z1, b.z0, b.z1);
  const distToRect = (px, pz, b) => Math.hypot(Math.max(b.x0 - px, 0, px - b.x1), Math.max(b.z0 - pz, 0, pz - b.z1));
  for (const c of f.columns) {
    const hole = c.boxes.find((b) => b.hole);
    if (!hole) continue;                                   // a rack support or wall (landing F): no axle to hold
    const z = hole.z0 + D.holeZ, want = c.holeZ ?? f.axleZ;   // the keyless selector's columns hold their own axle
    if (Math.abs(z - want) > 1e-6) bad.push(`shaft ${c.shaft} ${c.end}: hole at ${z.toFixed(3)}, axle at ${want}`);
  }
  for (const a of f.axles) if (!a.part) bad.push(`shaft ${a.shaft}: no axle of ${a.studs} studs or more`);
  const all = f.columns.flatMap((c) => c.boxes.map((b) => ({ ...b, who: `shaft ${c.shaft} ${c.end}` })));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
    if (all[i].who !== all[j].who && boxesOverlap(all[i], all[j])) bad.push(`overlap: ${all[i].who} ${all[i].part} ⇄ ${all[j].who} ${all[j].part}`);
  // a moving obstacle (landing F's rack, swept) against every column it does
  // not slide on: its tiles and walls touch it face to face, which is not overlap
  for (const o of f.obstacles ?? []) for (const b of all) if (boxesOverlap(o, b)) bad.push(`overlap: ${o.who} ⇄ ${b.who} ${b.part}`);
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
    for (const b of [...all, ...(f.obstacles ?? [])]) {
      if (!overlap1(y0, y1, b.y0, b.y1)) continue;
      const d = distToRect(s.x, f.axleZ, b);
      if (d < tip - EPS) bad.push(`shaft ${si} ${label(g)} sweeps ${b.who} ${b.part} (${d.toFixed(3)} < tip ${tip})`);
    }
  }
  // gear against gear: two gears on different shafts whose slabs share a layer
  // may only overlap in plan if they are the meshing pair (tip circles
  // interpenetrate by design there, a module each side). The meshing pairs are
  // the frame's own list (`f.meshes`, [shaft, gear] per member).
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
  for (const m of f.meshes) {
    const a = f.shafts[m.a[0]], b = f.shafts[m.b[0]];
    const ga = a.gears[m.a[1]], gb = b.gears[m.b[1]];
    const want = (ga.teeth + gb.teeth) / 2 * CATALOGUES[f.gen].module_mm;
    if (Math.abs(Math.abs(b.x - a.x) - want) > 1e-9 || ga.y !== gb.y) bad.push(`mesh ${ga.teeth}:${gb.teeth} not at ${want} mm in one layer`);
  }
  // §305: an axle's whole PART (its overhang past its span included) against every column of another shaft
  for (const a of f.axles) for (const c of f.columns) {
    if (c.shaft === a.shaft) continue;
    for (const b of c.boxes) if (overlap1(a.y0, a.y1, b.y0, b.y1) && distToRect(a.x, a.z ?? f.axleZ, b) < D.axleR - EPS) bad.push(`shaft ${a.shaft}'s axle runs into shaft ${c.shaft} ${c.end} ${b.part}`);
  }
  // two axles on ONE line (same x, same height) are two parts only end to end:
  // their spans must not meet (their columns are held apart by the box test)
  for (let i = 0; i < f.axles.length; i++) for (let j = i + 1; j < f.axles.length; j++) {
    const a = f.axles[i], b = f.axles[j];
    if (a.x === b.x && a.z === b.z && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > -EPS) bad.push(`shafts ${a.shaft} and ${b.shaft} meet on one axle line`);
  }
  return bad;
}

// THE MOTION WORKS' SOLVE: the chain and its placement together, because
// whether a coaxial chain is a BUILD depends on where its shafts stand.
//   · THE CHAIN — from the minute axle back to the hour wheel on it: an even
//     number of meshes (the hands turn one way), each an admissible
//     going-train mesh of the catalogue's spurs and double bevels (a
//     turntable's top runs on its own base, not on an axle; the clutch-on-both-
//     sides 18T slips), the last driving the round-bored hour wheel, the
//     product exactly 1/12. The first mesh is either the setting branch's own
//     (the minute axle's 16T into the minute wheel's 8T — the steel's shared
//     minute wheel) or a new gear keyed to the minute axle.
//   · THE PLACE — every shaft on the frame's 4 mm lattice in its one plane,
//     the signed centre distances closing on the minute axle; the layers rising
//     along the axles, each intermediate shaft carrying its driven gear and its
//     driver one to `maxStep` layers apart, or ONE gear as an IDLER (same layer,
//     same count); a new first gear one to `maxStep` layers past the minute
//     axle's setting gear.
// Every candidate is framed WITH the keyless works and kept only when
// frameFindings is empty. Ranked: fewest meshes (backlash and friction are per
// mesh, solveRatio's first rule), then fewest new gears, then fewest new axles
// (parts), then fewest teeth among the new gears (solveRatio's second), then
// the smallest baseplate footprint, then the lowest top layer (the shortest
// axles); the first is the answer. `meshes` caps the even counts tried; the
// search stops at the first count that frames anything.
export function solveMotionWorks(gen, { maxMeshes = 6, maxStep = 4, reach = 64 } = {}) {
  const cat = CATALOGUES[gen], hw = TECHNIC_MOTION_WORKS.hourWheel;
  const base = frameKeyless(gen, null);
  if (!base.framed) return null;
  const target = ratQ(1, 12), kq = (r) => `${r.n}/${r.d}`;
  const kinds = new Set(['spur', 'doubleBevel']);
  const G = cat.counts.filter((c) => kinds.has(c.kind) && !c.slips);
  const pairs = [], closers = [];
  for (const a of G) {
    const mh = catalogueMesh(a, hw, cat);
    if (mh?.class === 'parallel') closers.push({ a: a.teeth, cd: mh.cd, r: ratQ(a.teeth, hw.teeth) });
    for (const b of G) {
      const m = a.teeth !== b.teeth && catalogueMesh(a, b, cat);
      if (m?.class === 'parallel') pairs.push({ a: a.teeth, b: b.teeth, cd: m.cd, r: ratQ(a.teeth, b.teeth) });
    }
  }
  // THE RATIO PRUNE: S[k] holds every product the last k meshes can make, so a
  // branch whose remainder is in no S[k] is never walked
  const S = [null, new Set(closers.map((c) => kq(c.r)))];
  for (let k = 2; k <= maxMeshes; k++) {
    const s = new Set();
    for (const p of pairs) for (const v of S[k - 1]) { const [n, d] = v.split('/').map(BigInt); s.add(kq(ratMul(p.r, ratQ(n, d)))); }
    S.push(s);
  }
  const needs = (val, k) => S[k].has(kq(ratQ(target.n * val.d, target.d * val.n)));
  // the minute axle and the setting mesh into it (its driver on the minute wheel)
  const mi = base.shafts.findIndex((s, i) => s.branch === 'setting' && !base.meshes.some((m) => m.a[0] === i));
  const xM = base.shafts[mi].x;
  const into = base.meshes.find((m) => m.b[0] === mi);
  const mGear = base.shafts[mi].gears[into.b[1]], wGear = base.shafts[into.a[0]].gears[into.a[1]], xW = base.shafts[into.a[0]].x - xM;
  const yTop = Math.max(...base.shafts[mi].gears.map((g) => g.y));
  // chains with their shafts' places: (chain, x) closing on the minute axle
  const chains = [];
  const walk = (n, chain, xs, val, cx) => {
    const k = chain.length;
    if (k === n - 1) {
      for (const c of closers) if (Math.abs(cx) === c.cd && ratEq(ratMul(val, c.r), target)) chains.push({ chain: [...chain, [c.a, hw.teeth]], x: [...xs, 0] });
      return;
    }
    for (const p of pairs) {
      const v = ratMul(val, p.r);
      if (!needs(v, n - k - 1)) continue;
      for (const sg of [1, -1]) {
        const nx = cx + sg * p.cd;
        if (nx === 0 || Math.abs(nx) > reach || xs.includes(nx)) continue;
        walk(n, [...chain, [p.a, p.b]], [...xs, nx], v, nx);
      }
    }
  };
  // layers for one (chain, x): y[0] fixed by the first mesh, then each step
  const layerings = (c, y0s) => {
    const out = [];
    const rec = (i, ys) => {
      if (i === c.chain.length) { out.push(ys); return; }
      const prev = ys[i - 1], steps = [];
      // an idler: the previous driven gear drives this mesh, so one gear, one layer
      if (i > 0 && c.chain[i][0] === c.chain[i - 1][1] && !(i === 1 && c.shared)) steps.push(0);
      for (let s = 1; s <= maxStep; s++) steps.push(s * D.layer);
      for (const s of steps) rec(i + 1, [...ys, prev + s]);
    };
    for (const y0 of y0s) rec(1, [y0]);
    return out;
  };
  const ranked = [], stats = [];
  let tried = 0, framedCount = 0;
  for (let n = 2; n <= maxMeshes && !ranked.length; n += 2) {
    chains.length = 0;
    const t0 = tried, f0 = framedCount;
    // (A) the shared minute wheel
    const v0 = ratQ(mGear.teeth, wGear.teeth);
    if (n >= 2 && needs(v0, n - 1)) walk(n, [[mGear.teeth, wGear.teeth]], [xW], v0, xW);
    const nShared = chains.length;
    for (const c of chains) c.shared = true;
    // (B) a new gear keyed to the minute axle
    walk(n, [], [], ratQ(1), 0);
    for (const [ci, c] of chains.entries()) {
      const y0s = ci < nShared ? [mGear.y] : Array.from({ length: maxStep }, (_, s) => yTop + (s + 1) * D.layer);
      for (const y of layerings(c, y0s)) {
        tried++;
        const cand = { chain: c.chain, x: c.x, y };
        const f = frameKeyless(gen, cand);
        if (!f.framed || frameFindings(f).length) continue;
        framedCount++;
        const added = f.shafts.flatMap((s) => s.gears.filter((g) => g.branch === 'motion'));
        ranked.push({ ...cand, meshes: n, gears: added.length, axles: f.shafts.filter((s) => s.branch === 'motion').length,
          teeth: added.reduce((t, g) => t + g.teeth, 0), area: f.base.studsX * f.base.studsY, top: y[y.length - 1] });
      }
    }
    stats.push({ meshes: n, chains: chains.length, shared: nShared, sharedChains: chains.slice(0, nShared).map((c) => c.chain), placements: tried - t0, framed: framedCount - f0 });
  }
  const key = (s) => [s.meshes, s.gears, s.axles, s.teeth, s.area, s.top];
  ranked.sort((p, q) => { const a = key(p), b = key(q); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return JSON.stringify(p) < JSON.stringify(q) ? -1 : 1; });
  return { best: ranked[0] ?? null, tried, framed: framedCount, ranked, stats };
}
