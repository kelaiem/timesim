// BUILT §315 — THE LEGO GOING TRAIN, landing 1 of three: the four LEGO modules joined into one train, from the
// fusee's great wheel to the knife-edge balance. Pure: no three.js, no DOM. tools/probe-technic-train.mjs holds it.
//
// THE QUESTION. §219 tier three (b) built the fork's modules one at a time, each on its own baseplate: the fusee
// with its maintaining power and its centre pinion (landing H, §282, §285, §286), the going train's rows as
// stand-alone cells (landings A–C), and the escapement on its knife-edge balance (landing J, §287), which stood
// "standalone and kinematic: no drive" (docs/LEGO_FEASIBILITY.md §4 item 4, in the roadmap repo). This module
// CONNECTS them: one baseplate, one train, every mesh placed and phased off the parts' measured tooth phases, the
// escape wheel turned by the train and the train metered by the escapement. It is MODELLED, kinematic: the
// balance swings at its posed amplitude and its solved period (§287), the escape wheel's angle is the traced
// cycle's (cyclePose), and every other angle is read back from it through the tooth counts (standing rule 2). No
// torque is carried and nothing is integrated: the spring's law is still TECHNIC_FUSEE_SPRING's POSED stand-in,
// so the going time per wind below is that law's, never a measurement. Landings 2 and 3 (BUILT §315 scopes them)
// drive the escapement with torque and integrate the balance; this one does neither.
//
// THE CHAIN, read off the declared rows, never typed (trainChain):
//   · the fusee's great wheel (40T) into its centre pinion (FUSEE_CENTRE, §285: 8T, 5×);
//   · the centre pinion's arbor carries the centre→fourth row's first driver, and the row runs to the FOURTH
//     arbor as TECHNIC_FORK declares it per generation;
//   · the fourth→escape row, (24:8)(40:16) in both generations, IN THE OTHER ORDER: (40:16)(24:8), so that the
//     row's last driven gear is an 8T — and that 8T is the ESCAPE WHEEL ITSELF. The product is the row's (the
//     probe holds it), and the reason is the escapement's frame: its escape arbor stands between the pallets in
//     front and the back knife behind, and §287's arbor (a 4L axle through two columns behind the wheel) has no
//     room for a second gear without moving the back knife, which lengthens the crossbar and moves the period.
//     A 24:8 is 16 mm, five plates, so the 24T can stand STRAIGHT BELOW the wheel and drive it in the wheel's
//     own slab, its teeth at the wheel's bottom while the pallets work its top. Its arbor (the DRIVE) runs back
//     under the anchor, borne in a 1×2 Technic brick in a knife's stack and the escape columns' holes
//     (frameEscapement's driveZ and driveFrom), threaded from in front or, where the line in front runs into the
//     fusee, from behind.
//
// THE PLACE. Every axle is parallel to the fusee's, every mesh on the 4 mm lattice in its plane: across (x) by
// the centre distance, or straight up where the centre distance is a whole number of plates (a 24:8, 16 mm; the
// 2026 row's 64:16 may also go 24 across and 32 up). The layers climb along the axles a layer or two a stage,
// rowLayout's staircase. `solveTrain` searches every such placement — direction, layer step and the two columns
// of each arbor — and keeps those clear of each other and of both modules' measured parts; TECHNIC_TRAIN is its
// answer per generation, and the probe re-solves it.
//
// TWO CONSEQUENCES OF THE LATTICE, derived rather than chosen:
//   · THE KNIFE LINE IS ON A STUD. Every centre distance the train uses is 0 or 4 (mod 8) across, and the centre
//     arbor stands at 52 (≡ 4): the three ≡ 4 meshes of either generation's chain put the escape arbor on x ≡ 0.
//     §287's knife stacks straddle a half stud; here each stands on a 1×2 jumper (frameEscapement's x0).
//   · THE ESCAPE ARBOR STANDS WHERE THE TRAIN PUTS IT: 16 mm over the drive, which stands at the train's height
//     — the fusee's axle (24.8) in classic; in 2026 the 64T cannot stand there (its tips would cut the
//     baseplate), so the train climbs one 24:8 straight up at the centre arbor and the escape arbor stands 16 mm
//     over that. The escapement is §287's, raised by whole plates.
//
// THE SENSE. The escapement was solved driven in its going sense +1 (TECHNIC_ESCAPEMENT.sense). Each mesh
// reverses, so the escape wheel turns the great wheel's going sense times (−1)^meshes; where that is −1 the
// escapement is placed turned half round about the vertical (the anchor is symmetric, the balance is a body of
// revolution's cousin: nothing in it has a handedness the turn could break), so it is driven in its own +1.
import { LDU_MM, walk } from './ldraw.js';
import { CATALOGUES, TECHNIC_FORK, TECHNIC_ESCAPE_TEETH, catalogueMesh, ratQ, ratMul, ratStr } from './layout.js';
import { LEGO_DIM_MM, FRAME_PARTS, AXLE_PARTS, GEAR_TIP_MM, GEAR_WIDTH_MM, KEYLESS_PARTS } from './technic-frame.js';
import { flatSurfaceSamples, toothPhase } from './technic-ldraw.js';
import { frameFusee, fuseeBuild, solveFusee, TECHNIC_FUSEE_SPRING, FUSEE_CENTRE, FUSEE_PARTS, goingSense, centreRatio, coneTurnTotal, loopAdvance, loopStart, loopPose } from './technic-fusee.js';
import { frameEscapement, escapementBuild, cyclePose, TECHNIC_ESCAPEMENT, TECHNIC_BALANCE, ESC_SWING_DEG } from './technic-escapement.js';

const D = LEGO_DIM_MM;
const L = (mm) => mm / LDU_MM;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const TAU = 2 * Math.PI;
const mod = (a, m) => ((a % m) + m) % m;
const HALF = D.stud / 2;
const EPS = 1e-9;

export const TRAIN_KEY = 'going train';
// Clearance between a train part and a part of the fusee or the escapement it does not bear on, in the solve's
// analytic shapes: one LDU, the CLEAR tiers' own floor (the probe then measures the placed parts' surfaces).
export const TRAIN_CLEAR = 0.4;
// The posed swing the solve sweeps the balance over: §287's ±3°, and a degree more, as frameEscapement clears it.
export const SWEEP_DEG = ESC_SWING_DEG + 1;

// ── THE CHAIN ────────────────────────────────────────────────────────────────────────────────────────────────
// Every mesh from the great wheel to the escape wheel, [driver, driven], with each arbor's gears. Read off
// FUSEE_CENTRE and TECHNIC_FORK's two rows; the escape row re-ordered as the header says, its product held.
export function trainChain(gen) {
  const cat = CATALOGUES[gen];
  const find = (t) => cat.counts.find((c) => c.teeth === t);
  const row = (k) => TECHNIC_FORK.rows.find((r) => r.key === k).chains[gen];
  const c2f = row('centre→fourth'), f2e = row('fourth→escape');
  // the escape row's last mesh: its driven gear the escape wheel's count, its centre distance whole plates (so the
  // driver may stand straight under the wheel)
  const plates = (a, b) => { const m = catalogueMesh(find(a), find(b), cat); return m && Math.abs(m.cd / D.plateH - Math.round(m.cd / D.plateH)) < 1e-9; };
  const lastI = f2e.findIndex(([a, b]) => b === TECHNIC_ESCAPE_TEETH && plates(a, b));
  if (lastI < 0) return { gen, ok: false, reason: `no mesh of the ${gen} fourth→escape row ends on an ${TECHNIC_ESCAPE_TEETH}T at a whole number of plates` };
  const esc = [...f2e.slice(0, lastI), ...f2e.slice(lastI + 1), f2e[lastI]];
  const great = { teeth: 40, part: FUSEE_PARTS.greatWheel, kind: 'spur' };
  const pinion = { teeth: FUSEE_CENTRE.teeth, part: FUSEE_CENTRE.part, kind: 'spur' };
  const pairs = [[great, pinion], ...[...c2f, ...esc].map(([a, b]) => [find(a), find(b)])];
  const meshes = pairs.map(([a, b], i) => ({ i, a, b, ta: a.teeth, tb: b.teeth, cd: (a.teeth + b.teeth) / 2 * cat.module_mm,
    row: i === 0 ? 'great→centre' : i <= c2f.length ? 'centre→fourth' : 'fourth→escape' }));
  // the arbors: the great wheel's, then one per mesh's driven gear, each carrying the next mesh's driver
  const nF = c2f.length, keys = ['great', 'centre', ...Array.from({ length: nF - 1 }, (_, k) => `train ${k + 1}`), 'fourth',
    ...Array.from({ length: esc.length - 1 }, (_, k) => (k === esc.length - 2 ? 'drive' : `escape ${k + 1}`)), 'escape'];
  const arbors = keys.map((key, k) => ({ key, driven: k ? meshes[k - 1].b : null, driver: k < meshes.length ? meshes[k].a : null }));
  const product = meshes.reduce((r, m) => ratMul(r, ratQ(m.ta, m.tb)), ratQ(1));
  const rowProduct = (ch) => ch.reduce((r, [a, b]) => ratMul(r, ratQ(a, b)), ratQ(1));
  return { gen, ok: true, meshes, arbors, product, ratio: Number(product.n) / Number(product.d), escRow: esc, escRowDeclared: f2e,
    escRowHeld: ratStr(rowProduct(esc)) === ratStr(rowProduct(f2e)) };
}

// ── SHAPES: what the solve clears ────────────────────────────────────────────────────────────────────────────
// In the frame's millimetres (x across, y along the axles, z up from the baseplate's top). A DISC is a body of
// revolution about an axle line at (x, z) over y0…y1 (a gear's tip, an axle's reach, a pulley's rim — or a part
// swept round a line it turns about); a BOX is an axis-aligned block. Each carries the body it belongs to (pairs
// within one body never clash) and, for a gear, its mesh key (the two members of a declared mesh may overlap).
// Two shapes clash when they stand under `clr` apart along the axles AND under `clr` apart across them (a body
// beside another in the plane but a clearance off along the axles is clear, and so is one a clearance off in the
// plane): a 3D clearance read on the shapes' own two axes. At clr 0 it is frameFindings' touching law.
const yGap = (a, b) => Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
const yOver = (a, b, clr = 0) => yGap(a, b) < clr - EPS || (clr === 0 && yGap(a, b) < -EPS);
const rectDist = (x, z, b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
export function shapesClash(a, b, clr = 0) {
  if (clr === 0 ? !(yGap(a, b) < -EPS) : !(yGap(a, b) < clr - EPS)) return null;
  if (a.t === 'disc' && b.t === 'disc') { const d = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r; return d < clr - EPS ? d : null; }
  if (a.t === 'box' && b.t === 'box') {
    const o = Math.min(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
    return o > EPS ? -o : null;
  }
  const [c, x] = a.t === 'disc' ? [a, b] : [b, a];
  const d = rectDist(c.x, c.z, { ...x, z1: x.z1 + (x.stud ? D.studH : 0) }) - c.r;
  return d < clr - EPS ? d : null;
}

// THE MODULES' PARTS AS SHAPES, read off the placed LDraw parts (never a table): each part's sampled surface, in
// the frame's mm. A SPINNING body (it turns all the way round its line) gives each part's disc about that line;
// a SWINGING body (the balance, ±SWEEP_DEG about the knife; a pawl, through its ride) gives each part's box over
// the swing, and a gear on it a disc about its rest centre grown by the farthest its centre moves. A static part
// is its box. `pick(shaft)` names each body's kind.
const sampleBox = (lib, p, T = null) => {
  const s = flatSurfaceSamples(lib, p.part, 1), m = p.m, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < s.length; i += 3) {
    let X = m[0] + m[3] * s[i] + m[4] * s[i + 1] + m[5] * s[i + 2], Y = m[1] + m[6] * s[i] + m[7] * s[i + 1] + m[8] * s[i + 2], Z = m[2] + m[9] * s[i] + m[10] * s[i + 1] + m[11] * s[i + 2];
    if (T) [X, Y, Z] = T(X, Y, Z);
    const w = [X * LDU_MM, Z * LDU_MM, -Y * LDU_MM];               // frame (x, y, z)
    for (let d = 0; d < 3; d++) { if (w[d] < lo[d]) lo[d] = w[d]; if (w[d] > hi[d]) hi[d] = w[d]; }
  }
  return { lo, hi };
};
const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const compose3 = (A, m) => {
  const r = (i, j) => A[i * 3] * m[3 + j] + A[i * 3 + 1] * m[6 + j] + A[i * 3 + 2] * m[9 + j];
  const p = [0, 1, 2].map((i) => A[i * 3] * m[0] + A[i * 3 + 1] * m[1] + A[i * 3 + 2] * m[2]);
  return [...p, r(0, 0), r(0, 1), r(0, 2), r(1, 0), r(1, 1), r(1, 2), r(2, 0), r(2, 1), r(2, 2)];
};
const placeIn = (s, phi, p) => { const m = compose3(rotZ(phi), p.m); return { ...p, m: [m[0] + s.origin[0], m[1] + s.origin[1], m[2] + s.origin[2], ...m.slice(3)] }; };
export function moduleShapes(build, lib, pick, { tag = build.key } = {}) {
  const out = [];
  // a column is the statics standing on one spot; a Technic brick's hole is an axle's designed bearing, its line
  // read off the brick's own place (its hole stands holeZ over its underside, on its middle across the hole), and
  // every member of the column carries the lines of its holes (a body may stand flush against its own column)
  const spot = (p) => `${p.m[0].toFixed(3)},${p.m[2].toFixed(3)}`, lines = new Map();
  const boxes = build.statics.map((p) => (p.role === 'baseplate' ? null : sampleBox(lib, p)));
  build.statics.forEach((p, k) => { if (p.role === 'technicBrick') { const b = boxes[k]; if (!lines.has(spot(p))) lines.set(spot(p), []); lines.get(spot(p)).push({ x: r6((b.lo[0] + b.hi[0]) / 2), z: r6(b.lo[2] + D.holeZ) }); } });
  build.statics.forEach((p, k) => {
    if (p.role === 'baseplate') return;
    const b = boxes[k];
    out.push({ t: 'box', x0: b.lo[0], x1: b.hi[0], y0: b.lo[1], y1: b.hi[1], z0: b.lo[2], z1: b.hi[2], body: `${tag}/static`, who: `${tag} ${p.role} ${p.part}`, part: p, lines: lines.get(spot(p)) ?? [] });
  });
  build.shafts.forEach((s, k) => {
    const kind = pick(s), body = `${tag}/${s.shaft}#${k}`;
    if (kind.spin) {
      const ox = s.origin[0], oy = s.origin[1];
      for (const p of s.parts) {
        const smp = flatSurfaceSamples(lib, p.part, 1), m = p.m;
        let r = 0, z0 = Infinity, z1 = -Infinity;
        for (let i = 0; i < smp.length; i += 3) {
          const X = m[0] + m[3] * smp[i] + m[4] * smp[i + 1] + m[5] * smp[i + 2], Y = m[1] + m[6] * smp[i] + m[7] * smp[i + 1] + m[8] * smp[i + 2], Z = m[2] + m[9] * smp[i] + m[10] * smp[i + 1] + m[11] * smp[i + 2];
          r = Math.max(r, Math.hypot(X, Y)); z0 = Math.min(z0, Z); z1 = Math.max(z1, Z);
        }
        out.push({ t: 'disc', x: ox * LDU_MM, z: -oy * LDU_MM, r: r * LDU_MM, y0: (s.origin[2] + z0) * LDU_MM, y1: (s.origin[2] + z1) * LDU_MM, body, who: `${tag} ${s.shaft} ${p.role} ${p.part}`, part: p, spin: true });
      }
    } else {
      const angles = kind.angles ?? [s.phi];
      for (const p of s.parts) {
        if (kind.gearDisc && p.teeth) {
          const at0 = placeIn(s, s.phi, p), c = [at0.m[0] * LDU_MM, at0.m[2] * LDU_MM, -at0.m[1] * LDU_MM];
          const lever = Math.hypot(p.m[0], p.m[1]) * LDU_MM, swing = Math.max(...angles.map((a) => Math.abs(a - s.phi)));
          const tip = GEAR_TIP_MM[p.part] ?? null;
          if (tip !== null) { out.push({ t: 'disc', x: c[0], z: c[2], r: tip + 2 * lever * Math.sin(swing / 2), y0: c[1] - 4, y1: c[1] + 4, body, who: `${tag} ${s.shaft} ${p.role} ${p.part}`, part: p }); continue; }
        }
        const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (const a of angles) { const b = sampleBox(lib, placeIn(s, a, p)); for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], b.lo[d]); hi[d] = Math.max(hi[d], b.hi[d]); } }
        out.push({ t: 'box', x0: lo[0], x1: hi[0], y0: lo[1], y1: hi[1], z0: lo[2], z1: hi[2], body, who: `${tag} ${s.shaft} ${p.role} ${p.part}`, part: p, moves: true });
      }
    }
  });
  return out;
}

// ── THE ESCAPEMENT IN THE TRAIN ──────────────────────────────────────────────────────────────────────────────
// frameEscapement at the train's height, its knife line at local x = 0, a drive hole 16 mm under the arbor. In
// its LOCAL frame (the knife line at x 0, y as §287 lays it out): the DRIVE arbor straight under the wheel, its
// driver (the escape mesh's driver, the 24T) in the wheel's slab and its driven gear (the previous mesh's) in
// the first layer behind the front knife where the driving 40T, the escape row's other driver, clears the
// balance at its centre distance either side (`driveLayer`, measured off the parts, never chosen), and its axle
// from that gear's front face back through both escape columns.
// (`drop`, the escape mesh's centre distance: whole plates, trainChain)
export function escapementFor(zE, drop, from = 'front') {
  return frameEscapement(TECHNIC_ESCAPEMENT, TECHNIC_BALANCE, { x0: 0, zE, driveZ: r6(zE - drop), driveBrick: TRAIN_PARTS.driveBrick, driveFrom: from });
}
const lensUp = Object.keys(AXLE_PARTS).map(Number).sort((p, q) => p - q);
const axleLen = (n) => n * D.stud - 0.4;
// The drive arbor in the escapement's local frame, its driven gear in layer `w` (mm, the gear's middle).
export function driveArbor(ef, chain, w) {
  const m = chain.meshes, last = m[m.length - 1], prev = m[m.length - 2];
  const W = ef.slabs.wheel, wheelY = r6((W.y0 + W.y1) / 2), z = r6(ef.zE - last.cd);
  // its bearings: the columns with a drive hole (a knife's 1×2 Technic brick and the escape column or columns)
  const cols = ef.columns.filter((c) => c.boxes.some((b) => b.drive));
  const gw = (g) => GEAR_WIDTH_MM[g.part] ?? GEAR_WIDTH_MM.default;
  const gears = [{ ...prev.b, y: w, width: gw(prev.b), tip: GEAR_TIP_MM[prev.b.part], role: 'driven' }, { ...last.a, y: wheelY, width: gw(last.a), tip: GEAR_TIP_MM[last.a.part], role: 'driver' }];
  const a0 = Math.min(...gears.map((g) => g.y - g.width / 2), ...cols.map((c) => c.y - HALF)), a1 = Math.max(...gears.map((g) => g.y + g.width / 2), ...cols.map((c) => c.y + HALF));
  const n = lensUp.find((v) => v * D.stud >= a1 - a0 - EPS);
  const len = axleLen(n), y0 = r6((a0 + a1 - len) / 2);
  return { key: 'drive', x: 0, z, gears, cols: cols.map((c) => c.y), axle: { y0, y1: r6(y0 + len), part: AXLE_PARTS[n], lenStuds: n } };
}

// ── THE TRAIN'S OWN ARBORS AS SHAPES ─────────────────────────────────────────────────────────────────────────
// An arbor at (x, z) with its gears ({ y, tip, width }), its two columns (y centres on the stud grid) and its axle.
// A column on the stud grid stands on a 1×1 plate, half a stud off it on a jumper (frameRow's idiom); plates and
// bricks to the Technic brick whose hole is the axle.
export function columnStack(x, yc, holeZ) {
  const onGrid = mod(x, D.stud) === 0;
  const m = Math.round((holeZ - D.holeZ - D.plateH) / D.plateH);
  if (m < 0 || Math.abs(D.plateH * (1 + m) + D.holeZ - holeZ) > 1e-6) return null;
  const stack = [{ part: onGrid ? FRAME_PARTS.plate1x1 : FRAME_PARTS.jumper1x2, h: D.plateH, dx: onGrid ? HALF : D.stud }];
  const k = Math.floor(m / 3), p = m - 3 * k;
  for (let i = 0; i < p; i++) stack.push({ part: FRAME_PARTS.plate1x1, h: D.plateH, dx: HALF });
  for (let i = 0; i < k; i++) stack.push({ part: FRAME_PARTS.brick1x1, h: D.brickH, dx: HALF });
  stack.push({ part: FRAME_PARTS.technicBrick1x1, h: D.brickH, dx: HALF, hole: true });
  let zz = 0;
  return stack.map((s) => { const b = { part: s.part, x0: x - s.dx, x1: x + s.dx, y0: yc - HALF, y1: yc + HALF, z0: r6(zz), z1: r6(zz + s.h), hole: !!s.hole }; zz += s.h; return b; });
}
function arborShapes(a, body) {
  const out = [];
  for (const g of a.gears) out.push({ t: 'disc', x: a.x, z: a.z, r: g.tip, y0: g.y - g.width / 2, y1: g.y + g.width / 2, body, who: `${body} ${g.teeth}T`, gear: g, mesh: g.mesh });
  if (a.axle) out.push({ t: 'disc', x: a.x, z: a.z, r: D.axleR, y0: a.axle.y0, y1: a.axle.y1, body, who: `${body} axle`, axle: true });
  for (const c of a.columns ?? []) for (const b of c.boxes) out.push({ t: 'box', ...b, stud: true, body: `${body}/column`, who: `${body} column ${b.part}`, lines: [{ x: a.x, z: a.z }] });
  return out;
}
// The axle of an arbor: from the farthest gear or column face to the other, the shortest catalogue axle that
// spans it (each end may stand half an LDU short, the library's trim), centred if its overhang meets nothing,
// else flush with the end whose overhang would (frameShafts' rule, §305).
function axleFor(a, clear) {
  const lo = Math.min(...a.gears.map((g) => g.y - g.width / 2), ...a.columns.map((c) => c.y - HALF));
  const hi = Math.max(...a.gears.map((g) => g.y + g.width / 2), ...a.columns.map((c) => c.y + HALF));
  const n = lensUp.find((v) => v * D.stud >= hi - lo - EPS);
  if (!n) return null;
  const len = axleLen(n), over = len - (hi - lo);
  for (const [y0, y1] of [[(lo + hi - len) / 2, (lo + hi + len) / 2], [lo, lo + len], [hi - len, hi]]) {
    const ax = { y0: r6(y0), y1: r6(y1), part: AXLE_PARTS[n], lenStuds: n };
    if (over <= 0.4 + EPS || clear(ax)) return ax;
  }
  return null;
}

// ── THE SOLVE ────────────────────────────────────────────────────────────────────────────────────────────────
// The lattice moves a mesh of centre distance cd may take in the (x, z) plane: across either way, and straight
// up or down where cd is whole plates, and any (±4a, ±3.2b) with (4a)² + (3.2b)² = cd² — the only exact ones.
export function latticeMoves(cd) {
  const out = [];
  for (let b = -Math.floor(cd / D.plateH); b <= Math.floor(cd / D.plateH); b++) {
    const dz = r6(b * D.plateH), rest = cd * cd - dz * dz, a = Math.sqrt(Math.max(0, rest)) / 4;
    if (Math.abs(a - Math.round(a)) > 1e-9) continue;
    const dx = 4 * Math.round(a);
    for (const sx of dx ? [1, -1] : [1]) out.push({ dx: sx * dx, dz });
  }
  return out;
}
// the heights a column's hole can stand at, and the lowest an arbor's gears allow (tips over the stud tops)
const holeOK = (z) => { const m = (z - D.holeZ - D.plateH) / D.plateH; return m >= -1e-9 && Math.abs(m - Math.round(m)) < 1e-6; };
const clearsPlate = (z, gears) => gears.every((g) => z - g.tip >= D.studH - EPS);
// a gear's face width (frame's table)
const widthOf = (p) => GEAR_WIDTH_MM[p.part] ?? GEAR_WIDTH_MM.default;
// the column choices for an arbor's gears (y spans): two stud-grid slots clear of every gear, at its two ends,
// both in front, both behind, or one between two gears with one at an end
function columnChoices(gears) {
  const lo = Math.min(...gears.map((g) => g.y - g.width / 2)), hi = Math.max(...gears.map((g) => g.y + g.width / 2));
  const free = (c) => gears.every((g) => c + HALF <= g.y - g.width / 2 + EPS || c - HALF >= g.y + g.width / 2 - EPS);
  const f1 = Math.floor((lo - HALF + EPS) / D.stud) * D.stud, b1 = Math.ceil((hi + HALF - EPS) / D.stud) * D.stud;
  const out = [{ name: 'ends', ys: [f1, b1] }, { name: 'front', ys: [f1 - D.stud, f1] }, { name: 'back', ys: [b1, b1 + D.stud] }];
  for (let c = f1 + D.stud; c < b1; c += D.stud) if (free(c)) { out.push({ name: 'mid+front', ys: [f1, c] }, { name: 'mid+back', ys: [c, b1] }); break; }
  return out.filter((o) => o.ys.every(free));
}

// ── THE CONTEXT THE SOLVE CLEARS AGAINST ─────────────────────────────────────────────────────────────────────
// The fusee as built (fuseeBuild at full wind on the solved run) and the escapement at a height, each as shapes.
// The fusee's spinning bodies spin; its click pawl rides ROUND the main line with the ratchet (its disc is about
// that line, out to its farthest sample); its detent pawl swings through its ride; the balance through ±SWEEP_DEG.
const FUSEE_SPIN = new Set(['barrel', 'fusee', 'joiner', 'maintaining', 'great', 'centre']);
export function fuseeShapes(ff, fb, lib) {
  const out = moduleShapes(fb, lib, (s) => (FUSEE_SPIN.has(s.shaft) ? { spin: true } : s.shaft === 'detent pawl' ? { angles: [s.phi - 0.35, s.phi, s.phi + 0.1] } : { angles: [s.phi] }), { tag: 'fusee' });
  // the click pawl orbits the main line: its parts' discs about that line
  const k = fb.shafts.findIndex((s) => s.shaft === 'click pawl');
  if (k >= 0) {
    const s = fb.shafts[k], cx = L(ff.cd), cz = -L(ff.axleZ);
    for (let i = out.length - 1; i >= 0; i--) if (out[i].body === `fusee/click pawl#${k}`) out.splice(i, 1);
    for (const p of s.parts) {
      const q = placeIn(s, s.phi, p), smp = flatSurfaceSamples(lib, p.part, 1), m = q.m;
      let r = 0, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < smp.length; i += 3) {
        const X = m[0] + m[3] * smp[i] + m[4] * smp[i + 1] + m[5] * smp[i + 2], Y = m[1] + m[6] * smp[i] + m[7] * smp[i + 1] + m[8] * smp[i + 2], Z = m[2] + m[9] * smp[i] + m[10] * smp[i + 1] + m[11] * smp[i + 2];
        r = Math.max(r, Math.hypot(X - cx, Y - cz)); y0 = Math.min(y0, Z); y1 = Math.max(y1, Z);
      }
      out.push({ t: 'disc', x: ff.cd, z: ff.axleZ, r: r * LDU_MM, y0: y0 * LDU_MM, y1: y1 * LDU_MM, body: `fusee/click pawl#${k}`, who: `fusee click pawl ${p.role} ${p.part} (orbiting)`, part: p });
    }
  }
  return out;
}
// The escapement's shapes in its local frame at height zE (with the drive hole), the bodies tagged: its escape
// arbor spins, its balance swings. Cached per library and height.
const escMemo = new WeakMap();
export function escapementShapes(lib, zE, drop, from = 'front') {
  if (!escMemo.has(lib)) escMemo.set(lib, new Map());
  const memo = escMemo.get(lib), key = `${zE}/${drop}/${from}`;
  if (memo.has(key)) return memo.get(key);
  const ef = escapementFor(zE, drop, from);
  let out = null;
  if (ef.framed) {
    const eb = escapementBuild(ef, lib), sw = SWEEP_DEG * Math.PI / 180;
    const shapes = moduleShapes(eb, lib, (s) => (s.shaft === 'escape' ? { spin: true } : { angles: [-sw, -sw / 2, 0, sw / 2, sw], gearDisc: true }), { tag: 'escapement' });
    out = { ef, eb, shapes };
  } else out = { ef, eb: null, shapes: null };
  memo.set(key, out);
  return out;
}
// a local escapement shape placed: world x = X + o·u, y = Y + o·w (o = −1 is the half turn about the vertical)
export const placeShape = (s, X, Y, o) => (s.t === 'disc'
  ? { ...s, x: X + o * s.x, y0: o > 0 ? Y + s.y0 : Y - s.y1, y1: o > 0 ? Y + s.y1 : Y - s.y0 }
  : { ...s, x0: o > 0 ? X + s.x0 : X - s.x1, x1: o > 0 ? X + s.x1 : X - s.x0, y0: o > 0 ? Y + s.y0 : Y - s.y1, y1: o > 0 ? Y + s.y1 : Y - s.y0,
    ...(s.lines ? { lines: s.lines.map((l) => ({ x: X + o * l.x, z: l.z })) } : {}) });

// THE CLEARANCE LAW, one for the solve and the frame's findings. Two shapes clash when they come under `clr` of
// each other, unless the pair is designed to bear: the two gears of a declared mesh (`mesh`, the chain's index),
// an axle in a Technic brick's hole on its own line, the drive's 24T on the escape wheel. Within one body nothing
// clashes. Against the fusee or the escapement TRAIN_CLEAR, within the train touching (frameFindings' law).
const sameBody = (a, b) => a.body === b.body || (a.body && b.body && (a.body.startsWith(b.body + '/') || b.body.startsWith(a.body + '/')));
const onLine = (d, bx) => d.t === 'disc' && bx.t === 'box' && (bx.lines ?? []).some((l) => Math.abs(l.x - d.x) < 1e-6 && Math.abs(l.z - d.z) < 1e-6);
export function bears(a, b) {
  if (a.mesh !== undefined && a.mesh === b.mesh) return true;
  if (onLine(a, b) || onLine(b, a)) return true;              // an axle in its column's hole; a body flush on its own column
  const [d, e] = a.drive ? [a, b] : [b, a];
  return !!(d.drive === 'driver' && e.part?.role === 'wheel');
}
// THE TWO LAWS. Within the train — its arbors, their columns, the centre's driver, the drive — a turning part may
// stand face to face with a NEIGHBOUR'S COLUMN, the rows' law (frameFindings'; it is how rowLayout's staircase
// packs, a gear flush on the next column, and every row cell ships under it). Two turning parts of different
// bodies may not: a gear face rubbing another gear's at another speed is a brake the train would have to drive,
// so they stand TRAIN_CLEAR apart every way. Against the fusee's and the escapement's parts, TRAIN_CLEAR every way,
// the modules' own CLEAR tiers' floor; two blocks of a frame may stand face to face.
const isTrain = (s) => s.train || /^train\//.test(s.body);
const isBlock = (s) => s.t === 'box' && !s.moves;
// (and an axle's end may stand on a frame block's face: an axle stops half an LDU short of the next brick on its
// line, the library's trim, which is how every LEGO axle ends between two bricks)
export const clrOf = (a, b) => ((isBlock(a) && isBlock(b)) || (isTrain(a) && isTrain(b) && (isBlock(a) || isBlock(b)))
  || (a.axle && isBlock(b)) || (b.axle && isBlock(a)) ? 0 : TRAIN_CLEAR);
// the train's own FACE CONTACTS: pairs of two of its bodies standing under TRAIN_CLEAR apart (allowed by the rows'
// law, and counted, because each is a face that rubs: the solve ranks on it and the record reports it)
export function faceContacts2(news, olds) {
  let n = 0;
  for (const a of news) for (const b of olds) {
    if (sameBody(a, b) || bears(a, b) || (a.t === 'box' && b.t === 'box')) continue;
    if (shapesClash(a, b, TRAIN_CLEAR) !== null) n++;
  }
  return n;
}
export function faceContacts(shapes) {
  const out = [];
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i], b = shapes[j];
    if (sameBody(a, b) || bears(a, b) || (a.t === 'box' && b.t === 'box')) continue;
    const c = shapesClash(a, b, TRAIN_CLEAR);
    if (c !== null) out.push({ a: a.who, b: b.who, by: r6(c) });
  }
  return out;
}
export function clashes(news, olds, { first = false } = {}) {
  const out = [];
  for (const a of news) for (const b of olds) {
    if (sameBody(a, b) || bears(a, b)) continue;
    const c = shapesClash(a, b, clrOf(a, b));
    if (c !== null) { out.push({ a: a.who, b: b.who, by: r6(c) }); if (first) return out; }
  }
  return out;
}

// ── THE CONSTRUCTION: one law for the solve and the frame ─────────────────────────────────────────────────────
// The centre arbor: the fusee's pinion, its two columns, and the centre→fourth row's first driver one gap behind
// the back column (the arbor's other side faces the great wheel's slab, where the maintaining work stands).
// `side`: the driver one gap behind the back column ('back'), or in the first stud-grid layer in front of the
// pinion ('front', where the great wheel's slab ends and the maintaining work is beside it, not on this line)
export const CENTRE_SIDES = Object.freeze(['back', 'front']);
export function centreArbor(ff, chain, side = 'back') {
  const M = chain.meshes, C = ff.centre, cCols = ff.columns.filter((c) => c.shaft === 'centre'), wd = widthOf(M[1].a);
  // (in front, its back face a clearance off the great wheel's slab, which it overlaps in the plane: a gear's place
  // along its axle is not the stud grid's, only its columns are)
  const yD = side === 'front' ? r6(C.y - widthOf(M[0].b) / 2 - TRAIN_CLEAR - wd / 2)
    : Math.ceil((Math.max(...cCols.map((c) => c.y)) + HALF + wd / 2 - EPS) / D.stud) * D.stud;
  const a = { key: 'centre', x: C.x, z: ff.axleZ, columns: cCols.map((c) => ({ y: c.y, boxes: c.boxes, fusee: true })),
    gears: [{ ...M[0].b, y: C.y, width: widthOf(M[0].b), tip: GEAR_TIP_MM[M[0].b.part], mesh: 0 }, { ...M[1].a, y: yD, width: widthOf(M[1].a), tip: GEAR_TIP_MM[M[1].a.part], mesh: 1 }] };
  a.axle = axleFor(a, () => true);
  return a;
}
// Arbor k of the chain: the previous arbor at (x, z), its mesh layer y; the move, the step to this arbor's own
// driver's layer, the column choice by name. Null when the place is not a frame (a hole off the lattice, tips in
// the studs, gears that overlap on their own axle, a column choice the gears leave no room for).
export function arborAt(chain, k, x, z, y, mv, st, cols) {
  const A = chain.arbors, M = chain.meshes, m = M[k - 1], nm = M[k];
  const nx = r6(x + mv.dx), nz = r6(z + mv.dz);
  if (!holeOK(nz)) return null;
  const driven = { ...m.b, y, width: widthOf(m.b), tip: GEAR_TIP_MM[m.b.part], mesh: k - 1 };
  const driver = { ...nm.a, y: r6(y + st), width: widthOf(nm.a), tip: GEAR_TIP_MM[nm.a.part], mesh: k };
  const gears = [driven, driver];
  if (Math.abs(st) < (driven.width + driver.width) / 2 - EPS || !clearsPlate(nz, gears)) return null;
  const cc = columnChoices(gears).find((c) => c.name === cols);
  if (!cc) return null;
  const columns = cc.ys.map((yc) => ({ y: yc, boxes: columnStack(nx, yc, nz) }));
  if (columns.some((c) => !c.boxes)) return null;
  return { key: A[k].key, x: nx, z: nz, gears, columns, cols, move: mv, step: st };
}
const trainBody = (a) => `train/${a.key}`;
// ONE ARBOR TO A LINE: an arbor standing on another body's axle line (the same x and height) could only be threaded
// through that body's axle — the steps' swept insertion found the classic train's second arbor trapped on the
// centre's line that way — so the lines already taken (the fusee's axles, the arbors before) are refused.
export const fuseeLines = (ff) => ff.axles.map((a) => ({ x: a.x, z: a.z ?? ff.axleZ }));
const onTakenLine = (a, lines) => lines.some((l) => Math.abs(l.x - a.x) < EPS && Math.abs(l.z - a.z) < EPS);
const axleShape = (a, ax, body) => ({ t: 'disc', x: a.x, z: a.z, r: D.axleR, y0: ax.y0, y1: ax.y1, body, who: `${body} axle`, axle: true, train: true });
// its axle, against what is placed (frameShafts' overhang rule), and its shapes
export function fitArbor(a, placed) {
  const body = trainBody(a);
  const ax = axleFor(a, (x) => !clashes([axleShape(a, x, body)], placed, { first: true }).length);
  if (!ax) return null;
  a.axle = ax;
  return [...arborShapes({ ...a, axle: null }, body).map((s) => ({ ...s, train: true })), axleShape(a, ax, body)];
}
// THE ESCAPEMENT AT THE FOURTH: the drive straight under the escape wheel, across from the fourth by the escape
// row's first centre distance (`dx`), its driven gear in local layer `w`; the escapement turned by `o`. Returns
// the placement and its world shapes (the drive tagged as a train body), or null when the height is not one the
// escapement frames at.
// The placement alone (no library): the escapement's frame at the height, where it stands, the drive in it.
export function escapementPlace(chain, xF, zF, f40, dx, w, o, from = 'front') {
  const M = chain.meshes, mE = M[M.length - 1];
  const zE = r6(zF + mE.cd), ef = escapementFor(zE, mE.cd, from);
  if (!ef.framed) return { ef, framed: false, reason: ef.reason };
  return { ef, framed: true, X: r6(xF + dx), Y: r6(f40.y - o * w), o, zE, from, drive: { ...driveArbor(ef, chain, w), w } };
}
const driveShapes = (chain, drv) => { const iD = chain.meshes.length - 1; return arborShapes({ ...drv, columns: [] }, 'train/drive').map((s) => ({ ...s, train: true,
  ...(s.gear ? { mesh: s.gear.role === 'driven' ? iD - 1 : iD, drive: s.gear.role } : {}) })); };
export function escapementAt(chain, lib, xF, zF, f40, dx, w, o, from = 'front') {
  const P = escapementPlace(chain, xF, zF, f40, dx, w, o, from);
  if (!P.framed) return null;
  const E = escapementShapes(lib, P.zE, chain.meshes[chain.meshes.length - 1].cd, from);
  const dShapes = driveShapes(chain, P.drive);
  return { ...P, eb: E.eb, local: E.shapes, localDrive: dShapes, world: [...E.shapes, ...dShapes].map((s) => placeShape(s, P.X, P.Y, o)),
    way: placeShape(driveWay(P.drive, from), P.X, P.Y, o) };
}
// THE DRIVE'S WAY IN: its axle is threaded from beyond a knife (the front one, or the back one when it comes from
// behind), through the 1 × 2 Technic brick in that knife's stack. It can be lowered nowhere: a knife stack stands
// over each end of its line, and the gap between a knife and the escape columns is shorter than the axle. So the
// whole line beyond that brick is its corridor and must be clear of every other body — the swept insertion found
// the classic train's first drive threaded straight into the barrel's cord hook. (A disc on the axle's line from its
// end to past the largest baseplate's span, in the escapement's own frame; the drive's own body, so its gears are
// not in its way; the brick it starts in bears it, its line.) What it must clear is what stands when the drive goes in: the escape wheel and the balance
// go in after it, so `wayAgainst` leaves them out.
const wayFar = () => BASE_MAX_STUDS * D.stud;
const wayAgainst = (world) => world.filter((x) => !/^escapement\/(?:balance|escape)#/.test(x.body));
const driveWay = (drv, from = 'front') => ({ t: 'disc', x: drv.x ?? 0, z: drv.z, r: D.axleR,
  ...(from === 'back' ? { y0: drv.axle.y1, y1: r6(drv.axle.y1 + wayFar()) } : { y0: r6(drv.axle.y0 - wayFar()), y1: drv.axle.y0 }), body: 'train/drive/way', who: 'the drive axle\'s way in', axle: true, train: true });
// THE FRAMES' OWN BLOCKS, lib-free: the columns of a frame as boxes, each Technic brick with its hole's line —
// what an arbor's axle overhang is placed against (frameShafts' rule reads the frame, never the parts)
export const frameBoxes = (columns, body) => columns.flatMap((c) => { const lines = c.boxes.filter((b) => b.hole).map((b) => ({ x: r6((b.x0 + b.x1) / 2), z: r6(b.z0 + D.holeZ) }));
  return c.boxes.map((b) => ({ t: 'box', ...b, stud: true, body, who: `${body} ${c.shaft ?? ''} ${b.part}`, lines })); });
// THE SENSE. The escape wheel turns, in the world, the great wheel's going sense reversed at every mesh. The
// escapement stands either way round (o = +1 as §287 lays it out, −1 turned half round about the vertical), and
// is driven in its own frame in o × that: §287 solved it in +1, and the anchor escapes in either (solveEscapement:
// "both escape"); the probe traces the cycle in the sense the train gives it and holds it to one tooth a period.
export const worldSense = (chain, g) => g * (chain.meshes.length % 2 ? -1 : 1);
export const ORIENTATIONS = Object.freeze([1, -1]);
// the end its axle is threaded from: through the front knife (the bearings that knife and the front escape column),
// or from behind through the back knife and both escape columns (one more Technic brick, so ranked after it)
export const DRIVE_FROM = Object.freeze(['front', 'back']);
// the drive's layers: from the front knife's back face to the escape wheel's slab, a stud apart
export function driveLayers(ef, chain) {
  const M = chain.meshes, gw = widthOf(M[M.length - 2].b);
  const front = ef.columns.find((c) => c.shaft === 'knife' && c.end === 'front'), out = [];
  for (let w = front.y + HALF + gw / 2; w + gw / 2 <= ef.slabs.wheel.y0 + EPS; w += D.stud) out.push(r6(w));
  return out;
}

// ── THE SOLVE ────────────────────────────────────────────────────────────────────────────────────────────────
// Every placement of the arbors from the centre to the fourth (each mesh a lattice move, each arbor's driver a
// layer or two either way from its driven gear, its two columns any of columnChoices), then the drive under the
// escape wheel at the fourth's height on either side, its driven gear in any layer between the front knife and
// the wheel, the escapement turned as the sense requires and the drive threaded from in front or from behind
// (DRIVE_FROM). Kept: every shape clear (the rows' law within the
// train, TRAIN_CLEAR against the modules), one arbor to a line, the drive's way in clear, the escapement at a
// height it frames at, every column on one baseplate (BASEPLATES). Ranked: the smallest baseplate, the fewest
// face contacts, the fewest parts (columns' parts and axles: the gears are the chain's), the smallest footprint,
// the shortest train (Σ|dx|+|dz|), the lowest escape arbor, the escapement in §287's sense. The ANSWER
// (TECHNIC_TRAIN) is the first ranked train whose derived step order the swept insertion clears: that judge needs
// the parts' solids and minutes a candidate, so it is not in the walk — probe-technic-train.mjs re-derives it,
// and holds every train ranked above the answer to a flagged step.
// THE BASEPLATES: the smallest square plate that holds the whole base (ldrawBuild's rule, a stud's slack for the
// plate's half-stud snap). The pack held 16 × 16 (3867) and 32 × 32 (3811); the classic train needs 34 studs
// along its axles (the 12 mm meshes of its centre→fourth row climb a layer or two a stage, and none can fold back
// past the fusee's back columns), so this landing vendors the 48 × 48 (4186) for it, TRAIN_PARTS.
// The drive's knife-side bearing is a 1×2 Technic brick (3700) in a knife's stack (frameEscapement says why).
export const TRAIN_PARTS = Object.freeze({ baseplate48: '4186', driveBrick: '3700' });
export const BASEPLATES = Object.freeze([[16, FRAME_PARTS.baseplate16], [32, KEYLESS_PARTS.baseplate32], [48, TRAIN_PARTS.baseplate48]]);
export const plateFor = (base) => { const need = Math.max(base.studsX, base.studsY) + 1; const p = BASEPLATES.find(([n]) => need <= n + EPS); return p ? { studs: p[0], part: p[1] } : null; };
export const BASE_MAX_STUDS = BASEPLATES[BASEPLATES.length - 1][0];
export const STEPS = Object.freeze([8, -8, 16, -16, 24, -24]);
const COLS = Object.freeze(['ends', 'front', 'back', 'mid+front', 'mid+back']);
// the fusee's frame (columns) and the centre arbor's new gears and axle, lib-free: the geometry the train's axles
// are first placed against
export function trainGeo0(ff, centre) {
  return [...frameBoxes(ff.columns, 'fusee/frame'), ...arborShapes({ ...centre, columns: [] }, 'train/centre').map((s) => ({ ...s, train: true }))];
}
export function trainContext(gen, lib, { run = solveFusee(TECHNIC_FUSEE_SPRING).best, side = 'back' } = {}) {
  const chain = trainChain(gen), ff = frameFusee();
  const fb = fuseeBuild(ff, lib, { run });
  // (the great wheel is the chain's first driver: mesh 0 with the pinion)
  const cBody = `fusee/centre#${fb.shafts.findIndex((s) => s.shaft === 'centre')}`;
  const fshapes = fuseeShapes(ff, fb, lib).map((s) => (s.part?.role === 'great' ? { ...s, mesh: 0 } : s));
  const centre = centreArbor(ff, chain, side);
  // the centre arbor IS the fusee's centre body: its pinion, and its axle replaced by the train's (a longer reach)
  const cShapes = arborShapes({ ...centre, columns: [] }, cBody).map((s) => ({ ...s, train: true }));
  const placed0 = [...fshapes.filter((s) => s.body !== cBody), ...cShapes];
  return { gen, chain, ff, fb, run, side, fshapes, centre, cBody, cShapes, placed0, geo0: trainGeo0(ff, centre), g: goingSense(ff), ws: worldSense(chain, goingSense(ff)) };
}
function baseOf(boxes) {
  const xs = boxes.flatMap((b) => [b.x0, b.x1]), ys = boxes.flatMap((b) => [b.y0, b.y1]);
  const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  return { ...b, studsX: r6((b.x1 - b.x0) / D.stud), studsY: r6((b.y1 - b.y0) / D.stud) };
}
const partsOf = (arbors) => arbors.reduce((n, a) => n + a.columns.reduce((k, c) => k + c.boxes.length, 0) + 1, 0);
// the escapement's columns in the world (boxes), lib-free
const escColumnsWorld = (P) => P.ef.columns.map((c) => ({ ...c, shaft: `escapement ${c.shaft}`, boxes: c.boxes.map((b) => {
  const q = placeShape({ t: 'box', ...b }, P.X, P.Y, P.o); delete q.t; return q; }) }));
export function solveTrain(gen, lib, { run = solveFusee(TECHNIC_FUSEE_SPRING).best, steps = STEPS, sides = CENTRE_SIDES } = {}) {
  const ctxs = sides.map((side) => trainContext(gen, lib, { run, side }));
  const ctx = ctxs[0], { chain, ff } = ctx;
  const A = chain.arbors, M = chain.meshes;
  const iF = A.findIndex((a) => a.key === 'fourth');
  if (A[iF + 1]?.key !== 'drive' || A[iF + 2]?.key !== 'escape' || A.length !== iF + 3) throw new Error('technic-train: the solve wants fourth → drive → escape at the chain\'s end');
  const stats = { tried: 0, arbors: 0, escapements: 0, pruned: 0, centre: {} }, out = [];
  const fuseeCols = ff.columns.flatMap((c) => c.boxes);
  // BRANCH AND BOUND on the ranking's first two keys, both of which only grow as arbors are added: a partial
  // train already past the best whole one found is not walked further (stats.pruned counts them), nor one whose
  // columns already overrun the baseplate. `ranked` is every train that reached the escapement before its bound
  // passed it, in rank order (the answer is the first of them the insertion clears).
  let best = null;
  const worse = (pl, c, p) => best && (pl > best.plate || (pl === best.plate && (c > best.contacts || (c === best.contacts && p > best.parts))));
  const taken0 = fuseeLines(ff);
  const walk = (k, prev, y, placed, geo, arbors, path, contacts, parts, boxes) => {
    for (const mv of latticeMoves(M[k - 1].cd)) for (const st of steps) for (const cols of COLS) {
      stats.tried++;
      const a = arborAt(chain, k, prev.x, prev.z, y, mv, st, cols);
      if (!a || onTakenLine(a, [...taken0, ...arbors])) continue;
      const sh = fitArbor(a, geo);
      if (!sh || clashes(sh, placed, { first: true }).length) continue;
      stats.arbors++;
      const c2 = contacts + faceContacts2(sh, placed.filter((x) => x.train)), p2 = parts + a.columns.reduce((n, c) => n + c.boxes.length, 0) + 1;
      const b2 = [...boxes, ...a.columns.flatMap((c) => c.boxes)], pl = plateFor(baseOf(b2));
      if (!pl || worse(pl.studs, c2, p2)) { stats.pruned++; continue; }
      const path2 = path + Math.abs(mv.dx) + Math.abs(mv.dz);
      if (k < iF) { walk(k + 1, a, a.gears[1].y, [...placed, ...sh], [...geo, ...sh], [...arbors, a], path2, c2, p2, b2); continue; }
      const f40 = a.gears[1];
      for (const dmv of latticeMoves(M[iF].cd)) {
        if (dmv.dz) continue;                                      // the drive at the fourth's height
        const E0 = escapementShapes(lib, r6(a.z + M[iF + 1].cd), M[iF + 1].cd);
        if (!E0.shapes) continue;
        for (const from of DRIVE_FROM) for (const w of driveLayers(E0.ef, chain)) for (const o of ORIENTATIONS) {
          stats.escapements++;
          const E = escapementAt(chain, lib, a.x, a.z, f40, dmv.dx, w, o, from);
          if (!E) continue;
          if (clashes(E.localDrive, E.local, { first: true }).length) continue;
          if (clashes(E.world, [...placed, ...sh], { first: true }).length) continue;
          if (clashes([E.way], [...placed, ...sh, ...wayAgainst(E.world)], { first: true }).length) continue;
          const base = baseOf([...b2, ...escColumnsWorld(E).flatMap((c) => c.boxes)]), plate = plateFor(base);
          if (!plate) continue;
          const all = [...arbors, a];
          const contactsW = c2 + faceContacts2(E.world.filter((x) => x.train), [...placed, ...sh].filter((x) => x.train)), partsW = p2 + 1;
          const layout = { centre: side, moves: all.slice(1).map((x) => [x.move.dx, x.move.dz]), steps: all.slice(1).map((x) => x.step), cols: all.slice(1).map((x) => x.cols), drive: { dx: dmv.dx, w, o, from } };
          const r = { layout, plate: plate.studs, contacts: contactsW, parts: partsW, area: r6((base.x1 - base.x0) * (base.y1 - base.y0)), path: path2, zE: E.zE, sense: o * ws, base };
          out.push(r);
          if (!best || rank(r, best) < 0) best = r;
        }
      }
    }
  };
  let side = null, ws = null;
  for (const cx of ctxs) {
    // the centre arbor's driver and new axle against the fusee
    const c0 = clashes(cx.placed0.filter((s) => s.train), cx.placed0.filter((s) => !s.train), { first: true });
    stats.centre[cx.side] = c0.length ? `${c0[0].a} ⇄ ${c0[0].b}` : 'clear';
    if (c0.length) continue;
    side = cx.side; ws = cx.ws;
    walk(2, cx.centre, cx.centre.gears[1].y, cx.placed0, cx.geo0, [cx.centre], 0, 0, 0, fuseeCols);
  }
  out.sort(rank);
  return { ...ctx, best: out[0] ?? null, ranked: out, stats };
}
// (last, the escapement driven in the sense §287 traced it in, +1, before the other; then the drive threaded from
// in front before from behind)
const rankKey = (r) => [r.plate, r.contacts, r.parts, r.area, r.path, r.zE, r.sense === TECHNIC_ESCAPEMENT.sense ? 0 : 1, DRIVE_FROM.indexOf(r.layout.drive.from)];
function rank(p, q) { const a = rankKey(p), b = rankKey(q); for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return a[i] - b[i]; return JSON.stringify(p.layout) < JSON.stringify(q.layout) ? -1 : 1; }

// ── THE DECLARED TRAIN (solveTrain's answer per generation; the probe re-solves and fails when it answers
// otherwise). Per arbor from the centre's first follower to the fourth: its move from the arbor before ([dx, dz]
// mm), the step from its driven gear's layer to its driver's (mm along the axles), and its two columns; then the
// drive: across from the fourth (dx) and its driven gear's layer in the escapement's own frame (w).
export const TECHNIC_TRAIN = Object.freeze({
  technic_classic: Object.freeze({ centre: 'back', moves: [[12, 0], [12, 0], [-16, 0], [-24, 0]], steps: [16, 16, 16, 24], cols: ['front', 'front', 'back', 'back'], drive: Object.freeze({ dx: -28, w: 16, o: 1, from: 'back' }) }),
  technic_2026: Object.freeze({ centre: 'back', moves: [[0, 16], [24, 0], [40, 0]], steps: [16, 24, -16], cols: ['mid+back', 'back', 'ends'], drive: Object.freeze({ dx: 28, w: 16, o: -1, from: 'front' }) }),
});

// ── THE FRAME ────────────────────────────────────────────────────────────────────────────────────────────────
// The whole train as a frame, from a layout (TECHNIC_TRAIN's by default), lib-free: the fusee's frame as it
// stands, the centre arbor's new driver and axle, each arbor of the layout, the escapement at its place and the
// drive in it. `framed: false` with the reason when the layout is not a frame.
export function frameTrain(gen, layout = TECHNIC_TRAIN[gen]) {
  const key = TRAIN_KEY;
  const chain = trainChain(gen);
  if (!chain.ok) return { key, gen, framed: false, reason: chain.reason };
  if (!layout) return { key, gen, framed: false, reason: `no train is declared for ${gen}` };
  const ff = frameFusee();
  if (!ff.framed) return { key, gen, framed: false, reason: `the fusee: ${ff.reason}` };
  const A = chain.arbors, M = chain.meshes, iF = A.findIndex((a) => a.key === 'fourth');
  if (layout.moves.length !== iF - 1) return { key, gen, framed: false, reason: `the layout places ${layout.moves.length} arbors, the chain has ${iF - 1} from the centre to the fourth` };
  const centre = centreArbor(ff, chain, layout.centre ?? 'back');
  const geo = trainGeo0(ff, centre), arbors = [];
  let prev = centre, y = centre.gears[1].y;
  for (let k = 2; k <= iF; k++) {
    const [dx, dz] = layout.moves[k - 2];
    const a = arborAt(chain, k, prev.x, prev.z, y, { dx, dz }, layout.steps[k - 2], layout.cols[k - 2]);
    if (!a) return { key, gen, framed: false, reason: `${A[k].key}: not a frame at that move, step and column choice` };
    if (onTakenLine(a, [...fuseeLines(ff), ...arbors])) return { key, gen, framed: false, reason: `${A[k].key}: on a line another axle already takes` };
    const sh = fitArbor(a, geo);
    if (!sh) return { key, gen, framed: false, reason: `${A[k].key}: no axle spans it clear` };
    geo.push(...sh); arbors.push(a); prev = a; y = a.gears[1].y;
  }
  const g = goingSense(ff), o = layout.drive.o;
  if (!ORIENTATIONS.includes(o)) return { key, gen, framed: false, reason: `the escapement's orientation ${o} is neither way round` };
  const P = escapementPlace(chain, prev.x, prev.z, prev.gears[1], layout.drive.dx, layout.drive.w, o, layout.drive.from ?? 'front');
  if (!P.framed) return { key, gen, framed: false, reason: `the escapement: ${P.reason}` };
  const escCols = escColumnsWorld(P);
  // the drive in the world: its gears' layers and its axle carried by the placement
  const wy = (v) => r6(P.Y + o * v);
  const drive = { key: 'drive', x: P.X, z: P.drive.z, gears: P.drive.gears.map((gr) => ({ ...gr, y: wy(gr.y), mesh: gr.role === 'driven' ? M.length - 2 : M.length - 1 })),
    axle: { ...P.drive.axle, y0: Math.min(wy(P.drive.axle.y0), wy(P.drive.axle.y1)), y1: Math.max(wy(P.drive.axle.y0), wy(P.drive.axle.y1)) }, local: P.drive };
  const columns = [...ff.columns.map((c) => ({ ...c, module: 'fusee' })), ...arbors.flatMap((a) => a.columns.map((c, i) => ({ shaft: a.key, end: i ? 'back' : 'front', x: a.x, y: c.y, boxes: c.boxes, holeZ: a.z, module: 'train' }))),
    ...escCols.map((c) => ({ ...c, module: 'escapement' }))];
  const base = baseOf(columns.flatMap((c) => c.boxes)), plate = plateFor(base);
  if (!plate) return { key, gen, framed: false, reason: `the base is ${base.studsX}×${base.studsY} studs, past the largest baseplate (${BASE_MAX_STUDS}×${BASE_MAX_STUDS})` };
  base.plate = plate;
  return { key, gen, framed: true, chain, layout, fusee: ff, centre, arbors, drive, escapement: { ...P, columns: escCols }, columns, base, g, o,
    sense: o * worldSense(chain, g), zE: P.zE, ratio: chain.ratio };
}

// ── THE FRAME'S FINDINGS: does the framed train foul itself or either module? ────────────────────────────────────
// Every sentence a finding, [] when none. The solve's own law (clashes) over EVERY pair at once — the train's
// arbors among themselves and against the fusee's and the escapement's measured parts, the drive against the
// escapement's, the escapement against the fusee — plus every mesh at its catalogue centre distance in one layer,
// the escapement driven in its own sense, every column's hole at its axle's height.
// The framed train's shapes, by set: the fusee's parts, the centre arbor's new gears and axle, every arbor's, and
// the escapement placed (with the drive).
export function trainShapeSets(frame, lib, { run = solveFusee(TECHNIC_FUSEE_SPRING).best } = {}) {
  const ctx = trainContext(frame.gen, lib, { run, side: frame.layout.centre ?? 'back' });
  const sets = { fusee: ctx.placed0.filter((s) => !s.train), centre: ctx.cShapes, arbors: [] };
  for (const a of frame.arbors) sets.arbors.push(...arborShapes({ ...a, axle: null }, trainBody(a)).map((s) => ({ ...s, train: true })), axleShape(a, a.axle, trainBody(a)));
  const F = frame.arbors[frame.arbors.length - 1];
  sets.E = escapementAt(frame.chain, lib, F.x, F.z, F.gears[1], frame.layout.drive.dx, frame.layout.drive.w, frame.o, frame.layout.drive.from ?? 'front');
  return sets;
}
// the train's own face contacts (the rows' law allows them; the record counts them)
export function trainContacts(frame, lib, opts) {
  const S = trainShapeSets(frame, lib, opts);
  return faceContacts([...S.centre, ...S.arbors, ...(S.E ? S.E.world.filter((x) => x.train) : [])]);
}
export function trainFindings(frame, lib, opts = {}) {
  if (!frame.framed) return [`not framed: ${frame.reason}`];
  const bad = [];
  const chain = frame.chain, M = chain.meshes;
  const sets = trainShapeSets(frame, lib, opts), E = sets.E;
  if (!E) return ['the escapement does not frame at the train\'s height'];
  const say = (list, what) => { for (const c of list) bad.push(`${what}: ${c.a} ⇄ ${c.b} (${c.by.toFixed(3)} mm)`); };
  say(clashes(sets.centre, sets.fusee), 'the centre arbor');
  say(clashes(sets.arbors, [...sets.fusee, ...sets.centre]), 'an arbor against the fusee');
  for (let i = 0; i < frame.arbors.length; i++) for (let j = i + 1; j < frame.arbors.length; j++) {
    const bi = trainBody(frame.arbors[i]), bj = trainBody(frame.arbors[j]);
    say(clashes(sets.arbors.filter((s) => s.body.startsWith(bi)), sets.arbors.filter((s) => s.body.startsWith(bj))), 'two arbors');
  }
  say(clashes(E.localDrive, E.local), 'the drive in the escapement');
  say(clashes(E.world, [...sets.fusee, ...sets.centre, ...sets.arbors]), 'the escapement against the train and the fusee');
  say(clashes([E.way], [...sets.fusee, ...sets.centre, ...sets.arbors, ...wayAgainst(E.world)]), 'the drive\'s way in');
  // every mesh at its centre distance, coplanar: the great wheel and the escape wheel are the modules' gears, every
  // other member is tagged with its mesh's index in the chain
  const great = { x: frame.fusee.cd, z: frame.fusee.axleZ, y: frame.fusee.great.y };
  const wheel = { x: E.X, z: E.zE, y: r6(E.Y + E.o * (E.ef.slabs.wheel.y0 + E.ef.slabs.wheel.y1) / 2) };
  const tagged = [frame.centre, ...frame.arbors, frame.drive].flatMap((a) => a.gears.map((gr) => ({ x: a.x, z: a.z, y: gr.y, mesh: gr.mesh })));
  for (const [i, m] of M.entries()) {
    const pair = [...(i === 0 ? [great] : []), ...tagged.filter((q) => q.mesh === i), ...(i === M.length - 1 ? [wheel] : [])];
    if (pair.length !== 2) { bad.push(`mesh ${m.ta}:${m.tb} has ${pair.length} gears, not two`); continue; }
    const d = Math.hypot(pair[0].x - pair[1].x, pair[0].z - pair[1].z);
    if (Math.abs(d - m.cd) > 1e-6 || Math.abs(pair[0].y - pair[1].y) > 1e-6) bad.push(`mesh ${m.ta}:${m.tb} at ${d.toFixed(4)} mm (want ${m.cd}) in layers ${pair[0].y} and ${pair[1].y}`);
  }
  // the sense the escapement is driven in, in its own frame: the train's, through its orientation
  if (frame.sense !== frame.o * worldSense(chain, frame.g)) bad.push('the escapement\'s sense is not the one the train drives it in');
  for (const c of frame.columns) for (const b of c.boxes) if (b.hole) {
    const hz = r6(b.z0 + D.holeZ);
    const want = c.module === 'escapement' ? (b.drive ? frame.drive.z : frame.zE) : c.module === 'fusee' ? c.holeZ : c.holeZ;
    if (Math.abs(hz - want) > 1e-6) bad.push(`${c.shaft} ${c.end}: hole at ${hz}, its axle at ${want}`);
  }
  // the escapement's arbor and the drive: 16 mm, straight up (whole plates, its mesh)
  if (Math.abs(frame.zE - frame.drive.z - M[M.length - 1].cd) > 1e-9) bad.push('the escape arbor does not stand the escape mesh over the drive');
  return bad;
}

// ── THE BUILD (LDraw placements; landing B's conventions) ─────────────────────────────────────────────────────
// One baseplate under everything; the fusee as fuseeBuild places it (full wind), its centre body carrying the
// train's first driver on a longer axle; each arbor a body; the escapement as escapementBuild places it, carried
// to its place (turned half round about the vertical where `o` is −1: a proper rotation, LDraw's X and Z
// negated); the drive a body under the wheel. PHASE travels the meshes from the great wheel (ldrawBuild's law,
// each gear's tooth angle MEASURED off its part, `toothPhase`, carried through its placement), and every body's
// SPEED is its turn per turn of the great wheel (the great wheel 1, the centre pinion −5, …, the escape wheel
// ±2250), so placedParts(build, u) is the train with the great wheel turned u.
const ROT_X_TO_Z = [0, 0, -1, 0, 1, 0, 1, 0, 0];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const at = (X, Y, Z, r = I3) => [X, Y, Z, ...r];
const roleOfBox = (p) => (p === FRAME_PARTS.technicBrick1x1 ? 'technicBrick' : p === FRAME_PARTS.brick1x1 ? 'brick' : 'plate');
// a placement of the escapement's local frame carried to the world: LDraw X, Z negated by o, then shifted
const carry = (m, X, Z, o) => [L(X) + o * m[0], m[1], L(Z) + o * m[2], o * m[3], o * m[4], o * m[5], m[6], m[7], m[8], o * m[9], o * m[10], o * m[11]];
const turnPart = (m, o) => [o * m[0], m[1], o * m[2], o * m[3], o * m[4], o * m[5], m[6], m[7], m[8], o * m[9], o * m[10], o * m[11]];
const phaseMemo = new WeakMap();
// a gear's tooth angle about LDraw Z as its part is placed in its body (its own phase carried through the part's
// rotation: a part turned over reads π − τ)
export function placedToothPhase(lib, p) {
  if (!phaseMemo.has(lib)) phaseMemo.set(lib, new Map());
  const memo = phaseMemo.get(lib), k = `${p.part}/${p.teeth}`;
  if (!memo.has(k)) memo.set(k, toothPhase(lib, p.part, p.teeth).theta);
  const t = memo.get(k), m = p.m;
  return Math.atan2(m[6] * Math.cos(t) + m[7] * Math.sin(t), m[3] * Math.cos(t) + m[4] * Math.sin(t));
}
// the mesh law (ldrawBuild's): the driven body's φ such that its gear's gap faces the driver's tooth on the line of
// centres, Na·A + Nb·(B − π) ≡ π
export function meshPhi(lib, da, pa, db, pb) {
  const alpha = Math.atan2(db.origin[1] - da.origin[1], db.origin[0] - da.origin[0]);
  const Aang = da.phi + placedToothPhase(lib, pa);
  const Bang = alpha + Math.PI + (Math.PI - pa.teeth * (Aang - alpha)) / pb.teeth;
  return mod(Bang - placedToothPhase(lib, pb), TAU / pb.teeth);
}
export function trainBuild(frame, lib, { run = solveFusee(TECHNIC_FUSEE_SPRING).best } = {}) {
  if (!frame.framed) throw new Error(`${frame.key} is not framed: ${frame.reason}`);
  const ff = frame.fusee, fb = fuseeBuild(ff, lib, { run }), P = frame.escapement, o = frame.o;
  const eb = escapementBuild(P.ef, lib);
  const statics = [];
  // the baseplate: the smallest square plate the pack holds over the whole base, its studs on the frame's grid
  const midX = L((frame.base.x0 + frame.base.x1) / 2), midZ = L((frame.base.y0 + frame.base.y1) / 2);
  const snap = (v) => Math.round((v - 10) / 20) * 20 + 10;
  statics.push({ role: 'baseplate', part: frame.base.plate.part, m: at(snap(midX), 0, snap(midZ)) });
  statics.push(...fb.statics.filter((p) => p.role !== 'baseplate'));
  for (const a of frame.arbors) for (const c of a.columns) for (const b of c.boxes) statics.push({ role: roleOfBox(b.part), part: b.part, m: at(L((b.x0 + b.x1) / 2), -L(b.z1), L((b.y0 + b.y1) / 2)) });
  statics.push(...eb.statics.filter((p) => p.role !== 'baseplate').map((p) => ({ ...p, m: carry(p.m, P.X, P.Y, o) })));
  // BODIES
  const shafts = fb.shafts.map((s) => ({ ...s, parts: [...s.parts], module: 'fusee' }));
  const iG = shafts.findIndex((s) => s.shaft === 'great'), iC = shafts.findIndex((s) => s.shaft === 'centre');
  const axlePart = (ax) => ({ role: 'axle', part: ax.part, m: at(0, 0, L((ax.y0 + ax.y1) / 2), ROT_X_TO_Z) });
  const gearPart = (gr) => ({ role: gr.kind, part: gr.part, teeth: gr.teeth, m: at(0, 0, L(gr.y)) });
  // the centre body: the pinion as the fusee placed it, the train's axle and its first driver
  const C = frame.centre, pin = shafts[iC].parts.find((p) => p.role === 'centre');
  shafts[iC] = { ...shafts[iC], parts: [axlePart(C.axle), pin, gearPart(C.gears[1])] };
  const arborBodies = [...frame.arbors, frame.drive].map((a) => ({ shaft: a.key, origin: [L(a.x), -L(a.z), 0], phi: 0, speed: 0, module: 'train',
    parts: [axlePart(a.axle), ...a.gears.map(gearPart)] }));
  shafts.push(...arborBodies);
  const esc = eb.shafts.map((s) => ({ ...s, origin: carry([...s.origin, ...I3], P.X, P.Y, o).slice(0, 3), phi: o * s.phi, module: 'escapement', parts: s.parts.map((p) => ({ ...p, m: turnPart(p.m, o) })) }));
  shafts.push(...esc);
  const iE = shafts.findIndex((s) => s.module === 'escapement' && s.shaft === 'escape');
  // THE MESHES, in the chain's order: great → centre → … → drive → escape
  const chainBodies = [iG, iC, ...arborBodies.map((b) => shafts.indexOf(b)), iE];
  const gearOf = (k, teeth, layerY) => shafts[k].parts.findIndex((p) => p.teeth === teeth && (layerY === null || Math.abs(p.m[2] - L(layerY)) < 1e-6));
  const M = frame.chain.meshes, meshes = [];
  const layerOf = (i) => (i === 0 ? ff.great.y : i === M.length - 1 ? null : [C, ...frame.arbors, frame.drive].flatMap((a) => a.gears).find((gr) => gr.mesh === i).y);
  for (const [i, m] of M.entries()) {
    const ka = chainBodies[i], kb = chainBodies[i + 1], y = layerOf(i);
    const ga = gearOf(ka, m.ta, y), gb = i === M.length - 1 ? shafts[kb].parts.findIndex((p) => p.role === 'wheel') : gearOf(kb, m.tb, y);
    if (ga < 0 || gb < 0) throw new Error(`technic-train: mesh ${m.ta}:${m.tb} has no gear on a body`);
    meshes.push({ a: ka, b: kb, ga, gb, mesh: i });
  }
  // PHASE AND SPEED: the great wheel and the pinion as the fusee posed them; every later body solved off the one
  // that drives it (the centre's driver rides the pinion's body)
  shafts[iG].speed = 1;
  shafts[iC].speed = -M[0].ta / M[0].tb;
  for (const mh of meshes.slice(1)) {
    const da = shafts[mh.a], db = shafts[mh.b];
    db.phi = meshPhi(lib, da, da.parts[mh.ga], db, db.parts[mh.gb]);
    db.speed = -da.speed * da.parts[mh.ga].teeth / db.parts[mh.gb].teeth;
  }
  const bal = shafts.findIndex((s) => s.module === 'escapement' && s.shaft === 'balance');
  return { key: TRAIN_KEY, gen: frame.gen, recipe: `${TRAIN_KEY}/${frame.gen}`, statics, shafts, meshes, modes: ['run'], cord: fb.cord, fusee: fb, escapement: eb,
    index: { great: iG, centre: iC, escape: iE, balance: bal, chain: chainBodies }, o, g: frame.g, sense: frame.sense, ratio: Math.abs(shafts[iE].speed) };
}

// ── THE TRAIN RUNNING: one state ─────────────────────────────────────────────────────────────────────────────
// The state is TIME, t seconds of going. The escapement's traced cycle (§287's, cyclePose: the balance at its
// posed ±3° and its solved period, the escape wheel's angle read off the parts at every α) gives the escape
// wheel's angle θ(t); every other body's angle is θ carried back through the tooth counts — the great wheel's
// going turn dG = (θ − θ₀)/2250, each arbor its speed × the great wheel's — and the fusee's loop (§282) is put at
// that dG, so the cord, the barrel, the ratchet and both pawls stand where the great wheel's turn puts them
// (loopAt). Nothing is integrated and nothing here carries a torque: the escapement METERS the train because its
// cycle is posed at the period the balance's inertia gives, which is landing 1's whole claim.
// THE LOOP AT A GREAT-WHEEL TURN: §282's loop is the great wheel's, so it is put at dG by its own law
// (loopAdvance) from full wind. Its first cycle runs from full wind; every later cycle starts where the first ends
// and turns the great wheel exactly the cone's run, T (the going and the band's recharge both run the ratchet
// with it: a cycle is one wind).
export function loopAt(model, dG) {
  const { T, k, kr } = model, D1 = T + T / k + T / (k * (kr - 1));
  if (dG <= D1) return loopAdvance(model, loopStart(), Math.max(0, dG));
  const st2 = loopAdvance(model, loopStart(), D1), n = Math.floor((dG - D1) / T), r = dG - D1 - n * T;
  return loopAdvance(model, { ...st2, dM: st2.dM + n * T, dG: st2.dG + n * T, cycle: st2.cycle + n }, r);
}
// THE MODEL: the build, the escapement's cycle (cycleModel on the train's escapement frame), the fusee's loop
// (fuseeLoopModel on the build's fusee, its pawls' rides), and the offset that puts the escape wheel's least
// angle over the first period at the great wheel's zero (so dG ≥ 0 from t = 0, recoil included).
export function trainModel(build, cycle, loop) {
  const E = build.shafts[build.index.escape], sE = E.speed, g = build.g, o = build.o, pitch = TAU / build.escapement.shafts.find((s) => s.shaft === 'escape').parts.find((p) => p.role === 'wheel').teeth;
  // (the cycle's least angle in its own going sense: the escape wheel's farthest back, recoil included)
  const thMin = cycle.sigma > 0 ? Math.min(...cycle.steps.map((s) => s.theta)) : Math.max(...cycle.steps.map((s) => s.theta));
  const q = g * pitch / sE, c = g * (o * thMin - E.phi) / sE, n0 = q > 0 ? Math.floor(c / q) : Math.ceil(c / q);
  return { build, cycle, loop, g, o, sE, phiE0: E.phi, n0, pitch, T: cycle.T };
}
export function trainPose(model, t) {
  const { build, cycle, loop, g, o, sE, phiE0, n0, pitch } = model;
  const cp = cyclePose(cycle, t);
  const dG = g * (o * cp.theta - phiE0 - n0 * pitch) / sE, u = g * dG;
  const phi = build.shafts.map((s) => (s.module === 'escapement' ? null : s.phi + s.speed * u));
  phi[build.index.escape] = phiE0 + sE * u;
  phi[build.index.balance] = o * cp.alpha;
  const st = loop ? loopAt(loop, dG) : null, lp = st ? loopPose(loop, st) : null;
  return { t, alpha: cp.alpha, theta: cp.theta, kind: cp.kind, holder: cp.holder, cycle: cp.cycle, dG, u, phi, loopState: st, loop: lp };
}
// GOING TIME PER WIND, under the POSED spring law: a wind turns the great wheel the cone's run, T (fuseeRun's
// turns, from the stand-in table), and the escapement lets the escape wheel one tooth a period; so a wind lasts
// T/2π great-wheel turns × the train's ratio × the escape wheel's teeth × the period.
export function goingTime(run, ratio, teeth, periodS) {
  const greatTurns = coneTurnTotal(run) / TAU, escapeTurns = greatTurns * ratio, s = escapeTurns * teeth * periodS;
  return { greatTurns, escapeTurns, seconds: s, hours: s / 3600, greatTurnS: ratio * teeth * periodS, centreTurnS: ratio * teeth * periodS / centreRatio() };
}
