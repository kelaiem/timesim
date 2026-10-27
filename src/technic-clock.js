// BUILT §312, landing L1 — THE LEGO ALARM CLOCK AS ONE CELL: the modules that
// stand on technic.html as separate cells (the fusee, the going train's two
// rows, the escapement, the keyless and motion works, the alarm) placed on ONE
// baseplate, each shared axle ONE keyed body. Pure: no three.js, no DOM.
// tools/probe-technic-clock.mjs holds it.
//
// MODELLED, NOT SIMULATED, and DISPLAY ONLY. Nothing here drives anything: the
// cell is the modules' own builds, each posed by its own laws, placed rigidly
// and joined where an axle passes from one into the next. No force is weighed
// and nothing is integrated. What the clock still lacks is filed in BACKLOG
// §312's later landings: the alarm SET (a slip member in the release chain,
// L2), a WEIGHT in place of the cone (L3), the loop on the page (L4) and every
// measurement (L5). And one coupling §312 did not list, found by this landing:
// the going train does not yet turn the hands. The centre arbor and the minute
// axle are two lines here, because setting the hands through a KEYED centre
// arbor would have to turn the escapement backwards; real clocks put a
// friction (the cannon pinion's) between them, and that slip belongs with L2's.
//
// THE LINES (TECHNIC_CLOCK.lines) say which body of which module is which axle:
//   · CENTRE — the fusee's centre pinion IS the centre→fourth row's first
//     arbor (the steel's centre wheel, 1 rev/h);
//   · FOURTH — that row's last arbor IS the fourth→escape row's first;
//   · ESCAPE — that row's last arbor IS the escapement's escape arbor;
//   · MINUTE — the keyless works' minute axle (the setting branch's output, the
//     hour wheel's bearing) IS the alarm's hour axle (the release chain's input).
// A line is COLLINEAR: one x, one height, the two modules in tandem along it.
//
// THREE THINGS ARE DERIVED, none chosen:
//   · THE HEIGHT. Every module carries its axles at the lowest height its own
//     frame admits, and they differ (the fusee and the fourth→escape row at
//     24.8 mm, the escapement at 28.0, the rest at 34.4). A module can be LIFTED
//     on fillers but never lowered below its own frame, so every module of a
//     joined group is lifted to the group's highest line; a lift is a whole
//     number of plates (every frame hole stands at 5.6 + 3.2n mm), so fillers
//     can make it.
//   · THE HALF STUD. A line's x is fixed in both its modules, and a module
//     moved by whole studs keeps the class of every axle (on the grid, or half
//     a stud off it, which each frame takes with a jumper). Where a line pairs
//     the two classes (the fusee's centre pinion half a stud off, the row's arbor
//     on), one module stands HALF A STUD over: its 1×1 feet become jumpers and
//     its jumpers 1×1 plates — the frames' own rule, applied in the clock's
//     coordinates. A module whose feet cannot be re-footed that way refuses it.
//   · THE PLACE. Modules are slid apart along their lines, a stud at a time,
//     until no part of one comes within an LDU of another in PLAN (the parts'
//     boxes, every turning body swept through a whole turn): a plan gap is a
//     3D gap, so this is sufficient, and the probe measures the parts after it.
//     Of every arrangement that frames (each module turned 0° or 180° about the
//     vertical, each group on either side), the one on the fewest baseplate
//     studs is the answer.
//
// THE JOINT where a line crosses from one module into the next is one axle
// through both when a stock length spans both modules' columns, else two axles
// keyed in a ridged joiner (18948, the keyless stem's own) standing in the gap
// between the columns, each axle entering the joiner's bore short of its web.
// Either way the line is one keyed body: the gears of both modules turn as one.
//
// THE PHASE. Merging two bodies forces one angle on both, so the modules are
// re-phased with ldrawBuild's own mesh law (a driven gear's gap facing its
// driver's tooth, each part's tooth phase MEASURED). The going train is phased
// from the escapement at its own rest, back up the train to the fusee's great
// wheel, whose angle is set through the fusee's own law (its ratchet angle
// phiM, which turns the great wheel with it) to the nearest that meshes. The
// minute line is phased from the alarm's state (its disc sets the hour axle
// through the release chain) and the keyless works re-phased from it, each
// clutch gear idle or locked to the stem as the mode says.
import { LDU_MM, bounds } from './ldraw.js';
import { LEGO_DIM_MM as D, FRAME_PARTS, AXLE_PARTS, KEYLESS_PARTS, KEYLESS_DIM_MM, frameFork, frameKeyless, frameRow, frameFindings } from './technic-frame.js';
import { CATALOGUES, catalogueMesh, ratQ, ratMul, ratEq } from './layout.js';
import { ldrawBuild, toothPhase, rotZ, rotX } from './technic-ldraw.js';
import { solveFusee, frameFusee, fuseeBuild, TECHNIC_FUSEE_SPRING, goingSense, BAND_LAG_DEG, FUSEE_PARTS } from './technic-fusee.js';
import { frameAlarm, alarmStates, alarmBuild } from './technic-alarm.js';
import { frameEscapement, escapementBuild } from './technic-escapement.js';

const L = (mm) => mm / LDU_MM;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const TAU = 2 * Math.PI;
const mod = (a, m) => ((a % m) + m) % m;
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const ROT_Y180 = [-1, 0, 0, 0, 1, 0, 0, 0, -1];
const ROT_X_TO_Z = [0, 0, -1, 0, 1, 0, 1, 0, 0];   // an axle's X onto LDraw Z (technic-ldraw's)
const at = (X, Y, Z, r = I3) => [X, Y, Z, ...r];
const mul3 = (A, B) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]));
const apply3 = (A, p) => [0, 1, 2].map((i) => A[i * 3] * p[0] + A[i * 3 + 1] * p[1] + A[i * 3 + 2] * p[2]);
// a placement m (x y z a..i) turned by A about the origin
const turn = (A, m) => [...apply3(A, m.slice(0, 3)), ...mul3(A, m.slice(3))];
const EPS = 1e-6;

// One LDU: the clearance every technic probe holds a part to (CLEAR_LDU) and
// the collinearity the probe holds a line to.
export const CLOCK_CLEAR_LDU = 1;
// The axle's half width (3705's section, ±6 LDU) and a stock axle's length,
// 20·N − 1 LDU (the library trims half an LDU each end).
const AXLE_R = L(D.axleR);
const axleLDU = (n) => 20 * n - 1;
const STOCK = Object.keys(AXLE_PARTS).map(Number).sort((a, b) => a - b);

// ── THE DECLARATION ──────────────────────────────────────────────────────────
// Each module by key, and each line as the two bodies it joins. A body is named
// the way its module's build names it: a row's shafts by index ('last' is its
// output), the fusee's and the alarm's and the escapement's by name, the
// keyless works' minute axle by its frame's motion works.
export const TECHNIC_CLOCK = Object.freeze({
  modules: Object.freeze(['fusee', 'centre→fourth', 'fourth→escape', 'escapement', 'keyless', 'alarm']),
  lines: Object.freeze([
    Object.freeze({ key: 'centre', why: 'the fusee\'s centre pinion is the centre wheel\'s arbor (1 rev/h)', a: ['fusee', 'centre'], b: ['centre→fourth', 0] }),
    Object.freeze({ key: 'fourth', why: 'the centre→fourth row\'s output is the fourth→escape row\'s input (1 rev/min)', a: ['centre→fourth', 'last'], b: ['fourth→escape', 0] }),
    Object.freeze({ key: 'escape', why: 'the fourth→escape row\'s output is the escape arbor', a: ['fourth→escape', 'last'], b: ['escapement', 'escape'] }),
    Object.freeze({ key: 'minute', why: 'the setting branch\'s output, the hour wheel\'s bearing, is the release chain\'s input', a: ['keyless', 'minute'], b: ['alarm', 'hour'] }),
  ]),
  // the states the cell is drawn and held in: the alarm's three × the keyless works' three
  alarmStates: Object.freeze(['armed', 'ringing', 'off']),
  keylessModes: Object.freeze(['wind', 'set', 'neutral']),
  rest: Object.freeze({ alarm: 'armed', keyless: 'wind' }),
});

// ── THE MODULES, as their own builds ─────────────────────────────────────────
// Each module is read through the same functions its own cell uses, so the
// clock adds nothing to any of them. `builds` are its poses (one per state it
// has); `frame` what the build was made from.
// `pre` hands in what a caller already built (technic.html builds every cell
// before the clock), by module key: { frame, build, run?, states? }; anything
// not handed in is built here the same way its cell builds it.
export function clockModules(lib, gen, pre = {}) {
  const rowKeys = { 'centre→fourth': 0, 'fourth→escape': 1 };
  let frames = null, out = {};
  for (const [key, i] of Object.entries(rowKeys)) {
    const f = pre[key]?.frame ?? (frames ??= frameFork(gen))[i];
    if (!f.framed) return { framed: false, reason: `${key}: ${f.reason}` };
    out[key] = { key, kind: 'row', frame: f, build: pre[key]?.build ?? ldrawBuild(f, lib) };
  }
  const kf = pre.keyless?.frame ?? frameKeyless(gen);
  if (!kf.framed) return { framed: false, reason: `keyless works: ${kf.reason}` };
  out.keyless = { key: 'keyless', kind: 'keyless', frame: kf, build: pre.keyless?.build ?? ldrawBuild(kf, lib) };
  const run = pre.fusee?.run ?? solveFusee(TECHNIC_FUSEE_SPRING).best, ff = run && (pre.fusee?.frame ?? frameFusee());
  if (!run || !ff.framed) return { framed: false, reason: `fusee: ${run ? ff.reason : 'no run'}` };
  out.fusee = { key: 'fusee', kind: 'fusee', frame: ff, run, build: pre.fusee?.build ?? fuseeBuild(ff, lib, { run }) };
  const af = pre.alarm?.frame ?? frameAlarm();
  if (!af.framed) return { framed: false, reason: `alarm: ${af.reason}` };
  const st = pre.alarm?.states ?? alarmStates(lib, af);
  out.alarm = { key: 'alarm', kind: 'alarm', frame: af, states: st,
    builds: Object.fromEntries(TECHNIC_CLOCK.alarmStates.map((s) => [s, alarmBuild(af, lib, st[s])])) };
  out.alarm.build = out.alarm.builds[TECHNIC_CLOCK.rest.alarm];
  const ef = pre.escapement?.frame ?? frameEscapement();
  if (!ef.framed) return { framed: false, reason: `escapement: ${ef.reason}` };
  out.escapement = { key: 'escapement', kind: 'escapement', frame: ef, build: pre.escapement?.build ?? escapementBuild(ef, lib) };
  // THE LINES, and an ADAPTER where a line pairs the two grid classes and
  // neither of its modules can stand half a stud over (its columns stand a
  // stud apart, so re-footed jumpers would collide): the line is then two
  // lines through a half-stud adapter (solveAdapter) between them.
  const order = [...TECHNIC_CLOCK.modules], lines = [];
  const cls = (mk, sel) => { const m = out[mk], g = lineGeometry(lib, m, lineBody(m, sel)); return onGrid(g.x) ? 0 : 1; };
  const canShift = (mk) => standModule(lib, out[mk], { rot: 0, tx: 10, tz: 0, lift: 0, shift: 1 }).ok;
  for (const ln of TECHNIC_CLOCK.lines) {
    const [mA, sA] = ln.a, [mB, sB] = ln.b;
    if (cls(mA, sA) === cls(mB, sB) || canShift(mA) || canShift(mB)) { lines.push(ln); continue; }
    const ad = solveAdapter(gen);
    if (!ad) return { framed: false, reason: `the ${ln.key} line pairs the two grid classes and no half-stud adapter frames` };
    const key = `adapter:${ln.key}`;
    out[key] = { key, kind: 'row', adapter: ln.key, frame: ad.frame, chain: ad.chain, build: ldrawBuild(ad.frame, lib) };
    order.splice(order.indexOf(mB), 0, key);
    lines.push({ key: ln.key, why: ln.why, a: ln.a, b: [key, 0] });
    lines.push({ key: `${ln.key} (adapted)`, why: `the half-stud adapter's output carries the ${ln.key} line on: ${ad.why}`, a: [key, 'last'], b: ln.b });
  }
  return { framed: true, gen, modules: out, order, lines };
}

// ── THE HALF-STUD ADAPTER ────────────────────────────────────────────────────
// A line that must step half a stud sideways keeps its rate and its sense
// through TWO meshes whose product is 1 (an even number of external meshes
// turns the output the input's way) and whose centre distances sum to an odd
// number of half studs (≡ 4 mod 8 mm: the step from one grid class to the
// other). Of every such pair of catalogue meshes that frames clean as a row
// (frameRow, frameFindings), the fewest teeth wins (solveRatio's tiebreak),
// then the smallest base. Pure arithmetic over a dozen counts and a frame each.
export function solveAdapter(gen) {
  const cat = CATALOGUES[gen], G = cat.counts.filter((c) => !c.slips && ['spur', 'doubleBevel'].includes(c.kind));
  const pairs = [];
  for (const a of G) for (const b of G) { const m = catalogueMesh(a, b, cat); if (m?.class === 'parallel') pairs.push({ a: a.teeth, b: b.teeth, cd: m.cd }); }
  let best = null;
  for (const p of pairs) for (const q of pairs) {
    if (!ratEq(ratMul(ratQ(p.a, p.b), ratQ(q.a, q.b)), ratQ(1))) continue;
    if (mod(p.cd + q.cd, 2 * cat.lattice_mm) !== cat.lattice_mm) continue;
    const chain = [[p.a, p.b], [q.a, q.b]], f = frameRow(gen, { key: 'half-stud adapter', chains: { [gen]: chain } });
    if (!f.framed || frameFindings(f).length) continue;
    const rank = [p.a + p.b + q.a + q.b, f.base.studsX * f.base.studsY, p.cd + q.cd];
    const i = best ? rank.findIndex((v, k) => v !== best.rank[k]) : -1;
    if (!best || (i >= 0 && rank[i] < best.rank[i])) best = { chain, frame: f, rank, offset: p.cd + q.cd };
  }
  return best && { ...best, why: `${best.chain.map(([a, b]) => `${a}:${b}`).join(' × ')} = 1, ${best.offset} mm across (half a stud off the grid), two meshes so the sense is kept` };
}

// The body a line names, as an index into the module build's shafts.
export function lineBody(mod_, sel) {
  const sh = mod_.build.shafts;
  if (mod_.kind === 'row') {
    const want = sel === 'last' ? mod_.frame.shafts.length - 1 : sel;
    return sh.findIndex((s) => s.shaft === want);
  }
  if (mod_.kind === 'keyless' && sel === 'minute') {
    const mi = mod_.frame.motion?.minute;
    return sh.findIndex((s) => s.shaft === mi && !s.idles && !s.clutch);
  }
  return sh.findIndex((s) => s.shaft === sel);
}

// ── PART GEOMETRY ────────────────────────────────────────────────────────────
const boundsCache = new WeakMap();
const partBounds = (lib, part) => {
  let m = boundsCache.get(lib);
  if (!m) { m = new Map(); boundsCache.set(lib, m); }
  if (!m.has(part)) m.set(part, bounds(lib, `${part}.dat`));
  return m.get(part);
};
// the eight corners of a part's box placed by m
function corners(lib, part, m, { body = false } = {}) {
  const b = partBounds(lib, part), out = [];
  // a static's BODY box starts at its top face (y 0): its studs reach into the
  // part above, which is a stack, not an overlap
  const y0 = body ? Math.max(0, b.lo[1]) : b.lo[1];
  for (const x of [b.lo[0], b.hi[0]]) for (const y of [y0, b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) {
    const p = apply3(m.slice(3), [x, y, z]);
    out.push([p[0] + m[0], p[1] + m[1], p[2] + m[2]]);
  }
  return out;
}
export function boxOf(lib, part, m, opts) {
  const c = corners(lib, part, m, opts), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of c) for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], p[d]); hi[d] = Math.max(hi[d], p[d]); }
  return { lo, hi };
}

// ── EACH LINE IN ITS MODULE ──────────────────────────────────────────────────
// x and height off the body's own origin; the SPAN the line's columns hold it
// over, read off the Technic bricks the line passes through (their outer faces).
export function lineGeometry(lib, mod_, bi) {
  const s = mod_.build.shafts[bi];
  if (!s) return null;
  const [x, y] = s.origin;
  const bricks = mod_.build.statics.map((p, i) => ({ p, i })).filter(({ p }) => p.part === FRAME_PARTS.technicBrick1x1 && (() => {
    const b = boxOf(lib, p.part, p.m, { body: true });
    return x > b.lo[0] + EPS && x < b.hi[0] - EPS && y > b.lo[1] + EPS && y < b.hi[1] - EPS && Math.abs(p.m[3] - 1) < EPS;   // a brick turned along x holds another line
  })());
  if (!bricks.length) return { x, y, height: -y * LDU_MM, bricks: [], span: null };
  const zs = bricks.flatMap(({ p }) => { const b = boxOf(lib, p.part, p.m, { body: true }); return [b.lo[2], b.hi[2]]; });
  return { x, y, height: r6(-y * LDU_MM), bricks: bricks.map((b) => b.i), span: [Math.min(...zs), Math.max(...zs)] };
}

// ── THE GROUND, AND STANDING ON IT ───────────────────────────────────────────
// A module's GROUND CONTACTS: its statics whose underside is on its baseplate
// (LDraw y = 0). The frames stand on exactly three: a 1×1 plate on the grid, a
// jumper half a stud off it, and (the escapement's knife stacks) a 1×2 plate.
const FOOT = Object.freeze({ plate1: FRAME_PARTS.plate1x1, jumper: FRAME_PARTS.jumper1x2, plate2: '3023b', brick2: '3004', brick1: FRAME_PARTS.brick1x1 });
export function groundContacts(lib, build) {
  return build.statics.map((p, i) => ({ p, i })).filter(({ p }) => p.role !== 'baseplate' && Math.abs(boxOf(lib, p.part, p.m).hi[1]) < 0.5);
}
// A contact moved to clock x X (LDU): the foot the frames' rule gives there.
// On the grid (X ≡ 0 mod 20 LDU) a 1×1 column stands on a 1×1 plate, half a
// stud off on a jumper; a 1×2 plate's two studs must land on the grid.
const onGrid = (X) => Math.abs(mod(X + 10, 20) - 10) < EPS;
const halfOff = (X) => Math.abs(mod(X, 20) - 10) < EPS;
export function refoot(part, X) {
  if (part === FOOT.plate1 || part === FOOT.jumper) return onGrid(X) ? FOOT.plate1 : halfOff(X) ? FOOT.jumper : null;
  if (part === FOOT.plate2) return halfOff(X) ? FOOT.plate2 : null;
  return null;
}
// Whether a part standing ON the baseplate stands on its studs at clock x X:
// a 1×1 (plate or brick) on the grid, a jumper half a stud off, a 1×2 (plate
// or brick, along x) centred half a stud off so its two studs are on it.
export function footStands(part, X) {
  if (part === FOOT.plate1 || part === FOOT.brick1) return onGrid(X);
  if (part === FOOT.jumper || part === FOOT.plate2 || part === FOOT.brick2) return halfOff(X);
  return false;
}
// The fillers under a foot lifted `lift` mm: bricks then plates, of the foot's
// own footprint (1×1 under a 1×1 plate, 1×2 along x under a jumper or a 1×2).
export function fillers(foot, lift) {
  const n = Math.round(lift / D.plateH);
  if (Math.abs(n * D.plateH - lift) > EPS || n < 0) return null;
  const wide = foot !== FOOT.plate1, k = Math.floor(n / 3), p = n - 3 * k, out = [];
  for (let i = 0; i < p; i++) out.push({ part: wide ? FOOT.plate2 : FOOT.plate1, h: D.plateH });
  for (let i = 0; i < k; i++) out.push({ part: wide ? FOOT.brick2 : FOOT.brick1, h: D.brickH });
  return out;
}

// ── WHERE EVERY PART CAN BE ──────────────────────────────────────────────────
// Every part as a box (LDraw x, y, z, LDU) in its module's own frame, over
// every pose the cell can take. A static: its body box. A body turning about z:
// each part swept through a whole turn (the box of its farthest corner's radius
// about the axis) — a gear, a rotor and a lever alike, which is safe for all of
// them; the escapement's balance is the one body swept through its measured
// swing window only (a whole turn of its 32 mm arms would claim a disc it
// never fills), and a body that rides another's pin (the alarm's pawl on the
// driver, the fusee's click on the ratchet) is swept about the axis that
// carries it. A body turning about x (the keyless selector and its detent arm)
// is taken at each mode's pose, and a body that slides (the rack, the pusher)
// over its travel. The alarm's other states are added as poses of their own.
const SWING_DEG = 8;          // the escapement's swing window's upper end (swingWindow's `hi`)
const CARRIED_BY = Object.freeze({ alarm: Object.freeze({ pawl: 'column wheel' }), fusee: Object.freeze({ 'click pawl': 'maintaining' }) });
const unionBox = (list) => ({ lo: [0, 1, 2].map((d) => Math.min(...list.map((b) => b.lo[d]))), hi: [0, 1, 2].map((d) => Math.max(...list.map((b) => b.hi[d]))) });
function bodyBoxes(lib, mod_, b, bi, poses, tag = '') {
  const out = [], name = `${mod_.key}/${b.shaft}#${bi}${tag}`;
  const carrier = CARRIED_BY[mod_.kind]?.[b.shaft];
  const centre = carrier ? mod_.build.shafts.find((s) => s.shaft === carrier).origin : b.origin;
  const placed = (p, R, dx = 0, slide = 0) => { const m = turn(R, p.m); return [m[0] + b.origin[0] + dx, m[1] + b.origin[1], m[2] + b.origin[2] + slide, ...m.slice(3)]; };
  for (const [pi, p] of b.parts.entries()) {
    const who = `${name}.${pi}:${p.role}`;
    let box;
    if (b.axis === 'x' || b.slider || b.slides) box = unionBox(poses.map((pose) => boxOf(lib, p.part, placed(p, b.axis === 'x' ? rotX(b.phi + (pose.pose ?? 0)) : I3, pose.dx ?? 0, p.slide?.[pose.mode] ?? 0))));
    else if (mod_.kind === 'escapement' && b.shaft === 'balance') {
      const list = [];
      for (let a = -SWING_DEG; a <= SWING_DEG; a += 1) list.push(boxOf(lib, p.part, placed(p, rotZ(b.phi + a * Math.PI / 180))));
      box = unionBox(list);
    } else {
      // a whole turn about the axis that carries it
      const cs = corners(lib, p.part, placed(p, rotZ(b.phi)));
      const r = Math.max(...cs.map((q) => Math.hypot(q[0] - centre[0], q[1] - centre[1])));
      const zs = cs.map((q) => q[2]);
      box = { lo: [centre[0] - r, centre[1] - r, Math.min(...zs)], hi: [centre[0] + r, centre[1] + r, Math.max(...zs)] };
    }
    out.push({ ...box, who, moves: true, body: bi, part: pi, role: p.role, partId: p.part });
  }
  return out;
}
export function moduleBoxes(lib, mod_) {
  const out = [];
  for (const [i, p] of mod_.build.statics.entries()) {
    if (p.role === 'baseplate') continue;
    out.push({ ...boxOf(lib, p.part, p.m, { body: true }), who: `${mod_.key}/static#${i}:${p.role}`, moves: p.role === 'cord' || p.role === 'cordEnd', static: i, role: p.role, partId: p.part });
  }
  const modes = mod_.kind === 'keyless' ? TECHNIC_CLOCK.keylessModes : [null];
  for (const [bi, b] of mod_.build.shafts.entries()) {
    let poses = modes.map((md) => ({ mode: md, pose: md && b.pose ? b.pose[md] : 0 }));
    if (b.slides === 'x' && mod_.kind === 'alarm') { const d = L(Math.abs(mod_.frame.pusher.stroke) + 1); poses = [{ dx: -d }, { dx: d }, { dx: 0 }]; }
    out.push(...bodyBoxes(lib, mod_, b, bi, poses));
  }
  if (mod_.kind === 'alarm') for (const [s, bld] of Object.entries(mod_.builds)) {
    if (s === TECHNIC_CLOCK.rest.alarm) continue;
    for (const [bi, b] of bld.shafts.entries()) out.push(...bodyBoxes(lib, { ...mod_, build: bld }, b, bi, [{}], `@${s}`));
  }
  return out;
}

// ── CAN A LINE LEAVE ITS MODULE? ─────────────────────────────────────────────
// Beyond its span, a line's axle would run along x, y of the line at the axle's
// half width. Every part of the module whose box (above, over every pose) meets
// that corridor beyond the span's end, on each side, other than the line's own
// body and its own Technic bricks, BLOCKS that side; the nearest is reported.
// A line both of whose sides are blocked cannot be joined along its axis.
export function lineExits(lib, mod_, bi, boxes = moduleBoxes(lib, mod_)) {
  const g = lineGeometry(lib, mod_, bi);
  if (!g?.span) return { geometry: g, front: { blocked: 'no Technic brick holds the line' }, back: { blocked: 'no Technic brick holds the line' } };
  const r = AXLE_R + CLOCK_CLEAR_LDU, own = new Set(g.bricks);
  const inCorridor = (b) => b.lo[0] < g.x + r && b.hi[0] > g.x - r && b.lo[1] < g.y + r && b.hi[1] > g.y - r;
  const side = (dir) => {
    let best = null;
    for (const b of boxes) {
      if (b.body === bi || own.has(b.static) || !inCorridor(b)) continue;
      const d = dir > 0 ? b.lo[2] - g.span[1] : g.span[0] - b.hi[2];
      if (d < -EPS && (dir > 0 ? b.hi[2] <= g.span[1] + EPS : b.lo[2] >= g.span[0] - EPS)) continue;   // wholly inside the span: the module's own business
      if (dir > 0 ? b.hi[2] <= g.span[1] + EPS : b.lo[2] >= g.span[0] - EPS) continue;
      const dist = Math.max(0, d);
      if (!best || dist < best.dist) best = { dist, who: b.who, partId: b.partId };
    }
    return best ? { blocked: `${best.who} (${best.partId}) ${(best.dist * LDU_MM).toFixed(2)} mm past the span`, at: best.dist, who: best.who } : { blocked: null };
  };
  return { geometry: g, front: side(-1), back: side(1) };
}

// ── A MODULE PLACED ──────────────────────────────────────────────────────────
// { rot: 0 | 1 (turned 180° about the vertical), tx, tz (LDU), lift (mm) }:
// a point p of the module goes to R·p + (tx, −lift, tz).
export const placeR = (pl) => (pl.rot ? ROT_Y180 : I3);
export function placePoint(pl, p) { const q = apply3(placeR(pl), p); return [q[0] + pl.tx, q[1] - L(pl.lift), q[2] + pl.tz]; }
export function placeBox(pl, b) {
  const dy = -L(pl.lift);
  if (!pl.rot) return { ...b, lo: [b.lo[0] + pl.tx, b.lo[1] + dy, b.lo[2] + pl.tz], hi: [b.hi[0] + pl.tx, b.hi[1] + dy, b.hi[2] + pl.tz] };
  return { ...b, lo: [pl.tx - b.hi[0], b.lo[1] + dy, pl.tz - b.hi[2]], hi: [pl.tx - b.lo[0], b.hi[1] + dy, pl.tz - b.lo[2]] };
}
// Two boxes conflict when they overlap or, if either moves, stand nearer than
// an LDU. Two statics may touch (columns side by side, a stack). `plan` reads
// x and z only: a plan gap is a 3D gap, so a placement whose modules clear in
// plan clears in space whatever their heights.
export function boxesConflict(a, b, { plan = false, margin = CLOCK_CLEAR_LDU } = {}) {
  const g = (a.moves || b.moves) ? margin : 0;
  for (const d of plan ? [0, 2] : [0, 1, 2]) if (Math.min(a.hi[d], b.hi[d]) - Math.max(a.lo[d], b.lo[d]) <= -g + EPS) return false;
  return true;
}

// ── THE JOINT ────────────────────────────────────────────────────────────────
// A line from module A into module B along +d (world z, LDU): A's span ends at
// aNear facing B, B's starts at bNear; aFar and bFar are their other ends.
// ONE AXLE when a stock length covers both spans and the gap between them —
// laid as the frames lay theirs, half an LDU in from each far face, and when
// the stock is a stud longer (there is no 11L) overhanging the far end that is
// free. Otherwise TWO AXLES in a ridged joiner in the gap: the joiner an LDU
// clear of both modules' facing bricks, each axle from its far face into the
// joiner's bore, short of its web (landing D's rule for the keyless stem); of
// the joints that fit, the one whose shallower axle goes deepest.
const J = KEYLESS_DIM_MM, JH = L(J.joinerHalf), JS = L(J.joinerStop), JR = L(J.joinerR);
export function solveJoint({ aFar, aNear, bNear, bFar, d, freeOverhang = { a: false, b: false } }) {
  const gap = d * (bNear - aNear);
  if (gap < -EPS) return null;
  const total = d * (bFar - aFar), k = Math.round(total / 20);
  const one = STOCK.find((n) => n >= k);
  if (one !== undefined && one - k <= 1 && Math.abs(total - 20 * k) < EPS) {
    const over = 20 * (one - k);
    const ends = !over ? [aFar, bFar] : freeOverhang.b ? [aFar, bFar + d * over] : freeOverhang.a ? [aFar - d * over, bFar] : null;
    if (ends) {
      const [e0, e1] = ends.map((e, i) => e + (i ? -1 : 1) * d * 0.5);
      return { kind: 'axle', axles: [{ part: AXLE_PARTS[one], lenStuds: one, z0: Math.min(e0, e1), z1: Math.max(e0, e1) }], joiner: null, gap };
    }
  }
  if (gap < 2 * JH + 2 * CLOCK_CLEAR_LDU - EPS) return null;
  let best = null;
  for (const nA of STOCK) for (const nB of STOCK) {
    const eA = aFar + d * (axleLDU(nA) + 0.5), eB = bFar - d * (axleLDU(nB) + 0.5);
    // the joiner's middle jc: its faces an LDU off both bricks, each axle's end
    // inside its own half of the bore, short of the web
    const lo = Math.max(d * aNear + CLOCK_CLEAR_LDU + JH, d * eA + JS, d * eB - JH + EPS);
    const hi = Math.min(d * bNear - CLOCK_CLEAR_LDU - JH, d * eA + JH - EPS, d * eB - JS);
    if (d * eA < d * aNear - EPS || d * eB > d * bNear + EPS || lo > hi + EPS) continue;
    // the deepest the shallower axle can go: engagement = JH − |end − jc| on each side
    const jc = Math.min(hi, Math.max(lo, (d * eA + d * eB) / 2));
    const eng = Math.min(JH - (jc - d * eA), JH - (d * eB - jc));
    if (!best || eng > best.eng + EPS || (Math.abs(eng - best.eng) < EPS && nA + nB < best.n)) best = { nA, nB, jc: d * jc, eA, eB, eng, n: nA + nB };
  }
  if (!best) return null;
  const ax = (far, end, n) => ({ part: AXLE_PARTS[n], lenStuds: n, z0: Math.min(far + d * 0.5, end), z1: Math.max(far + d * 0.5, end) });
  return { kind: 'joiner', axles: [ax(aFar, best.eA, best.nA), { ...ax(bFar, best.eB, best.nB), z0: Math.min(bFar - d * 0.5, best.eB), z1: Math.max(bFar - d * 0.5, best.eB) }],
    joiner: { part: KEYLESS_PARTS.joiner, z: best.jc, engagement: best.eng }, gap };
}
// the joint's parts as boxes on the line (x, y), outside both spans only: inside
// a span the joint's axle lies where the module's own did
export function jointBoxes(j, x, y, spans) {
  const out = [], outside = (z0, z1) => {
    const cuts = [];
    let segs = [[z0, z1]];
    for (const [s0, s1] of spans) segs = segs.flatMap(([a, b]) => (b <= s0 + EPS || a >= s1 - EPS ? [[a, b]] : [[a, Math.min(b, s0)], [Math.max(a, s1), b]].filter(([p, q]) => q - p > EPS)));
    return segs.concat(cuts);
  };
  for (const a of j.axles) for (const [z0, z1] of outside(a.z0, a.z1)) out.push({ lo: [x - AXLE_R, y - AXLE_R, z0], hi: [x + AXLE_R, y + AXLE_R, z1], who: `joint axle ${a.part}`, moves: true, joint: true });
  if (j.joiner) out.push({ lo: [x - JR, y - JR, j.joiner.z - JH], hi: [x + JR, y + JR, j.joiner.z + JH], who: `joint joiner ${j.joiner.part}`, moves: true, joint: true });
  return out;
}

// ── THE LAYOUT ───────────────────────────────────────────────────────────────
// The lines that can be joined split the modules into GROUPS; each group is a
// tree of tandem joints, placed from its first module. A module joins its
// neighbour on the neighbour's free side, turned 0° or 180° so that its own
// free side faces back; its x is the line's (so its half stud is derived), its
// lift the group's, and it is slid away from the neighbour a stud at a time
// until it clears, in plan, every module already placed and its joint can be
// made and clears in space. Then the groups are set side by side, each turned
// either way, at the arrangement on the fewest baseplate studs.
const SLIDE_STUDS = 24;       // how far apart two modules on a line are tried: past it the line's joiner and two 12L axles could not span the gap anyway
const sideOf = (pl, localSide) => (pl.rot ? -localSide : localSide);
export function joinableLines(lib, M, boxes, lines) {
  const ok = [], refused = [];
  for (const ln of lines) {
    const ends = [ln.a, ln.b].map(([mk, sel]) => { const m = M[mk], bi = lineBody(m, sel); return { mk, sel, bi, ex: lineExits(lib, m, bi, boxes[mk]) }; });
    const blocked = ends.find((e) => e.ex.front.blocked && e.ex.back.blocked);
    if (blocked) refused.push({ ...ln, ends, reason: `${blocked.mk}'s ${blocked.sel === 'last' ? 'output' : blocked.sel} arbor is closed at both ends: in front by ${blocked.ex.front.blocked}, behind by ${blocked.ex.back.blocked}` });
    else ok.push({ ...ln, ends });
  }
  return { ok, refused };
}
// heights: every module of a group lifted to its highest line (whole plates)
function groupLifts(groups, lines) {
  const lift = {};
  for (const g of groups) {
    const h = Math.max(...lines.filter((ln) => g.includes(ln.ends[0].mk)).flatMap((ln) => ln.ends.map((e) => e.ex.geometry.height)));
    for (const ln of lines) for (const e of ln.ends) if (g.includes(e.mk)) {
      const want = r6(h - e.ex.geometry.height);
      if (e.mk in lift && Math.abs(lift[e.mk] - want) > EPS) return { reason: `${e.mk} carries two lines at different heights` };
      lift[e.mk] = want;
    }
  }
  return { lift };
}
const conflictsAny = (A, B, plan) => { for (const a of A) for (const b of B) if (boxesConflict(a, b, { plan })) return [a, b]; return null; };
export function solveClockLayout(lib, Mods, { slide = SLIDE_STUDS } = {}) {
  const M = Mods.modules;
  const boxes = Object.fromEntries(Object.entries(M).map(([k, m]) => [k, moduleBoxes(lib, m)]));
  const { ok: lines, refused } = joinableLines(lib, M, boxes, Mods.lines);
  // groups: connected modules over the joinable lines (a module on no line is not in the cell)
  const adj = new Map();
  for (const ln of lines) { const [a, b] = ln.ends.map((e) => e.mk); for (const [p, q] of [[a, b], [b, a]]) { if (!adj.has(p)) adj.set(p, []); adj.get(p).push({ to: q, ln }); } }
  const seen = new Set(), groups = [];
  for (const k of Mods.order) if (adj.has(k) && !seen.has(k)) {
    const g = [], st = [k]; seen.add(k);
    while (st.length) { const u = st.pop(); g.push(u); for (const { to } of adj.get(u)) if (!seen.has(to)) { seen.add(to); st.push(to); } }
    groups.push(g);
  }
  const lifts = groupLifts(groups, lines);
  if (lifts.reason) return { framed: false, reason: lifts.reason, refused };
  // one group's placements: a search over each module's turn and side
  const placeGroup = (g) => {
    const root = g.find((k) => Mods.order.indexOf(k) === Math.min(...g.map((x) => Mods.order.indexOf(x))));
    // the order modules are reached in from the root, with the line that reaches each
    const order = [{ mk: root, via: null }], got = new Set([root]);
    for (let i = 0; i < order.length; i++) for (const { to, ln } of adj.get(order[i].mk)) if (g.includes(to) && !got.has(to)) { got.add(to); order.push({ mk: to, via: ln, from: order[i].mk }); }
    const results = [];
    const rec = (i, placed, joints) => {
      if (i === order.length) { results.push({ placed: { ...placed }, joints: [...joints] }); return; }
      const { mk, via, from } = order[i];
      for (const rot of [0, 1]) {
        // the first module may stand on the grid or half a stud over (whichever lets its partners stand)
        if (!via) { for (const shift of [0, 1]) { const p0 = { rot, tx: 10 * shift, tz: 0, lift: lifts.lift[mk] ?? 0, shift }; if (standModule(lib, M[mk], p0).ok) rec(i + 1, { [mk]: p0 }, joints); } continue; }
        const eA = via.ends.find((e) => e.mk === from), eB = via.ends.find((e) => e.mk === mk), pA = placed[from];
        const gA = eA.ex.geometry, gB = eB.ex.geometry;
        for (const sA of [-1, 1]) {
          // A's side sA in the world must be free in A's own frame, and B's facing side free in B's
          if (eA.ex[sideOf(pA, sA) > 0 ? 'back' : 'front'].blocked) continue;
          const sBlocal = sideOf({ rot }, -sA);
          if (eB.ex[sBlocal > 0 ? 'back' : 'front'].blocked) continue;
          const X = placePoint(pA, [gA.x, gA.y, 0])[0];
          const tx = r6(X - (rot ? -gB.x : gB.x));
          const shift = Math.abs(mod(tx, 20)) < EPS ? 0 : Math.abs(mod(tx, 20) - 10) < EPS ? 1 : null;
          if (shift === null) continue;
          // A's span in the world
          const aSpan = [gA.span[0], gA.span[1]].map((z) => placePoint(pA, [gA.x, gA.y, z])[2]).sort((p, q) => p - q);
          const aNear = sA > 0 ? aSpan[1] : aSpan[0], aFar = sA > 0 ? aSpan[0] : aSpan[1];
          for (let n = 0; n <= slide; n++) {
            // B's facing end at aNear + sA·20n
            const bLocal = gB.span.map((z) => (rot ? -z : z)).sort((p, q) => p - q);
            const bNear0 = sA > 0 ? bLocal[0] : bLocal[1];
            const tz = r6(aNear + sA * 20 * n - bNear0);
            const pB = { rot, tx, tz, lift: lifts.lift[mk] ?? 0, shift };
            if (n === 0 && !standModule(lib, M[mk], pB).ok) break;   // its feet cannot stand at this x: no slide changes that
            const bSpan = bLocal.map((z) => z + tz), bNear = sA > 0 ? bSpan[0] : bSpan[1], bFar = sA > 0 ? bSpan[1] : bSpan[0];
            const boxesB = boxes[mk].map((b) => placeBox(pB, b));
            const others = Object.entries(placed).flatMap(([k, p]) => boxes[k].map((b) => ({ ...placeBox(p, b), mk: k })));
            if (conflictsAny(boxesB, others, true)) continue;
            const freeFar = (e, pl, sFar) => !e.ex[sideOf(pl, sFar) > 0 ? 'back' : 'front'].blocked;
            const j = solveJoint({ aFar, aNear, bNear, bFar, d: sA, freeOverhang: { a: freeFar(eA, pA, -sA), b: freeFar(eB, pB, sA) } });
            if (!j) continue;
            const Y = placePoint(pA, [gA.x, gA.y, 0])[1];
            const jb = jointBoxes(j, X, Y, [aSpan, bSpan]);
            // the joint against every part placed (B's included), but a line's own bodies and bricks
            const own = (b) => (b.mk === from && (b.body === eA.bi || gA.bricks.includes(b.static))) || (b.mk === mk && (b.body === eB.bi || gB.bricks.includes(b.static)));
            const all = [...others, ...boxesB.map((b) => ({ ...b, mk }))].filter((b) => !own(b));
            if (conflictsAny(jb, all, false)) continue;
            rec(i + 1, { ...placed, [mk]: pB }, [...joints, { line: via.key, a: from, b: mk, joint: j, x: X, y: Y, aSpan, bSpan, d: sA }]);
            break;   // the nearest that frames
          }
        }
      }
    };
    rec(0, {}, []);
    return results;
  };
  const perGroup = groups.map((g) => ({ g, options: placeGroup(g) }));
  const failed = perGroup.find((p) => !p.options.length);
  if (failed) return { framed: false, reason: `no arrangement joins ${failed.g.join(', ')} along their lines`, refused };
  // a group's plan boxes in a common frame, and its extent
  const groupBoxes = (opt) => Object.entries(opt.placed).flatMap(([k, p]) => boxes[k].map((b) => ({ ...placeBox(p, b), mk: k })));
  const extentOf = (bs) => ({ x0: Math.min(...bs.map((b) => b.lo[0])), x1: Math.max(...bs.map((b) => b.hi[0])), z0: Math.min(...bs.map((b) => b.lo[2])), z1: Math.max(...bs.map((b) => b.hi[2])) });
  // the area a set of plan boxes needs, in baseplate studs (the bounding rectangle, whole studs)
  const studsOf = (e) => Math.ceil((e.x1 - e.x0) / 20 - EPS) * Math.ceil((e.z1 - e.z0) / 20 - EPS);
  // group 0's best option first; each further group set beside what is placed
  let best = null;
  const combos = perGroup.reduce((acc, p) => acc.flatMap((c) => p.options.map((o) => [...c, o])), [[]]);
  for (const combo of combos) {
    let placed = groupBoxes(combo[0]), place = [{ dx: 0, dz: 0, rot: 0 }];
    let okc = true;
    for (let gi = 1; gi < combo.length && okc; gi++) {
      let bestHere = null;
      for (const rot of [0, 1]) {
        const raw = groupBoxes(combo[gi]).map((b) => (rot ? placeBox({ rot: 1, tx: 0, tz: 0, lift: 0 }, b) : b));
        const E = extentOf(placed), e = extentOf(raw);
        // beside it on each side, slid along that side a stud at a time
        const cand = [];
        const span = (a0, a1, b0, b1) => { const out = []; for (let v = a0 - (b1 - b0); v <= a1; v += 20) out.push(v); return out; };
        for (const dz of span(E.z0, E.z1, e.z0, e.z1)) { cand.push({ dx: E.x1 - e.x0, dz: dz - e.z0 }); cand.push({ dx: E.x0 - e.x1, dz: dz - e.z0 }); }
        for (const dx of span(E.x0, E.x1, e.x0, e.x1)) { cand.push({ dx: dx - e.x0, dz: E.z1 - e.z0 }); cand.push({ dx: dx - e.x0, dz: E.z0 - e.z1 }); }
        for (const c of cand) {
          // whole studs, and an LDU apart where anything moves: round outward
          const dx = Math.round(c.dx / 20) * 20, dz = Math.round(c.dz / 20) * 20;
          const moved = raw.map((b) => ({ ...b, lo: [b.lo[0] + dx, b.lo[1], b.lo[2] + dz], hi: [b.hi[0] + dx, b.hi[1], b.hi[2] + dz] }));
          if (conflictsAny(moved, placed, true)) continue;
          const area = studsOf(extentOf([...placed, ...moved]));
          if (!bestHere || area < bestHere.area) bestHere = { area, dx, dz, rot, moved };
        }
      }
      if (!bestHere) { okc = false; break; }
      placed = [...placed, ...bestHere.moved]; place.push({ dx: bestHere.dx, dz: bestHere.dz, rot: bestHere.rot });
    }
    if (!okc) continue;
    const area = studsOf(extentOf(placed));
    if (!best || area < best.area) best = { area, combo, place };
  }
  if (!best) return { framed: false, reason: 'the groups do not fit beside each other', refused };
  // compose each group's module placements with its group placement, and judge
  // the whole by the one law a declared placement is judged by
  const placement = {};
  best.combo.forEach((opt, gi) => {
    const G = best.place[gi];
    for (const [k, p] of Object.entries(opt.placed)) {
      const q = G.rot ? { rot: 1 - p.rot, tx: -p.tx, tz: -p.tz } : { rot: p.rot, tx: p.tx, tz: p.tz };
      placement[k] = [q.rot, r6(q.tx + G.dx), r6(q.tz + G.dz)];
    }
  });
  return { ...layoutFrom(lib, Mods, placement, { boxes }), areaStuds: best.area };
}

// THE LAYOUT FROM A PLACEMENT: { module: [rot, x, z] } (LDU) — the solve's
// answer, or a declared one (CLOCK_PLACEMENT, which the page reads because the
// solve takes half a minute). The lifts and the half studs are derived from it,
// the joints made, and the whole judged: every line's two halves on one x and
// one height, every module standing, no two modules within an LDU in plan,
// every joint made and clear in space. A finding is a sentence; none, framed.
export function layoutFrom(lib, Mods, placed, { boxes = null } = {}) {
  const M = Mods.modules;
  boxes ??= Object.fromEntries(Object.entries(M).map(([k, m]) => [k, moduleBoxes(lib, m)]));
  const { ok: lines, refused } = joinableLines(lib, M, boxes, Mods.lines);
  const groups = [], seen = new Set();
  for (const k of Mods.order) if (placed[k] && !seen.has(k)) {
    const g = [k], st = [k]; seen.add(k);
    while (st.length) { const u = st.pop(); for (const ln of lines) { const [a, b] = ln.ends.map((e) => e.mk); const v = a === u ? b : b === u ? a : null; if (v && placed[v] && !seen.has(v)) { seen.add(v); g.push(v); st.push(v); } } }
    groups.push(g);
  }
  const lifts = groupLifts(groups, lines.filter((ln) => ln.ends.every((e) => placed[e.mk])));
  if (lifts.reason) return { framed: false, reason: lifts.reason, refused, findings: [lifts.reason] };
  const placement = {}, findings = [];
  for (const [k, [rot, tx, tz]] of Object.entries(placed)) {
    const shift = Math.abs(mod(tx, 20)) < EPS ? 0 : Math.abs(mod(tx, 20) - 10) < EPS ? 1 : null;
    if (shift === null || Math.abs(mod(tz, 20)) > EPS) findings.push(`${k} stands off the half-stud lattice`);
    placement[k] = { rot, tx, tz, lift: lifts.lift[k] ?? 0, shift: shift ?? 0 };
    const st = standModule(lib, M[k], placement[k]);
    if (!st.ok) findings.push(st.reason);
  }
  const P = Object.fromEntries(Object.keys(placement).map((k) => [k, boxes[k].map((b) => ({ ...placeBox(placement[k], b), mk: k }))]));
  const ks = Object.keys(P);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const c = conflictsAny(P[ks[i]], P[ks[j]], true);
    if (c) findings.push(`${c[0].who} and ${c[1].who} stand within an LDU in plan`);
  }
  const joints = [];
  for (const ln of lines) {
    const [eA, eB] = ln.ends;
    if (!placement[eA.mk] || !placement[eB.mk]) continue;
    const pA = placement[eA.mk], pB = placement[eB.mk], gA = eA.ex.geometry, gB = eB.ex.geometry;
    const [XA, YA] = placePoint(pA, [gA.x, gA.y, 0]), [XB, YB] = placePoint(pB, [gB.x, gB.y, 0]);
    if (Math.abs(XA - XB) > EPS || Math.abs(YA - YB) > EPS) { findings.push(`the ${ln.key} line's halves stand ${(Math.hypot(XA - XB, YA - YB) * LDU_MM).toFixed(3)} mm apart`); continue; }
    const span = (p, g) => g.span.map((z) => placePoint(p, [g.x, g.y, z])[2]).sort((a, b) => a - b);
    const aSpan = span(pA, gA), bSpan = span(pB, gB), d = bSpan[0] >= aSpan[1] - EPS ? 1 : aSpan[0] >= bSpan[1] - EPS ? -1 : 0;
    if (!d) { findings.push(`the ${ln.key} line's two spans overlap`); continue; }
    const side = (e, p, s) => e.ex[sideOf(p, s) > 0 ? 'back' : 'front'];
    if (side(eA, pA, d).blocked) findings.push(`${eA.mk} leaves the ${ln.key} line on its closed side`);
    if (side(eB, pB, -d).blocked) findings.push(`${eB.mk} meets the ${ln.key} line on its closed side`);
    const [aNear, aFar] = d > 0 ? [aSpan[1], aSpan[0]] : [aSpan[0], aSpan[1]], [bNear, bFar] = d > 0 ? [bSpan[0], bSpan[1]] : [bSpan[1], bSpan[0]];
    const j = solveJoint({ aFar, aNear, bNear, bFar, d, freeOverhang: { a: !side(eA, pA, -d).blocked, b: !side(eB, pB, d).blocked } });
    if (!j) { findings.push(`no joint makes the ${ln.key} line across its ${((d * (bNear - aNear)) * LDU_MM).toFixed(1)} mm gap`); continue; }
    const own = (b) => (b.mk === eA.mk && (b.body === eA.bi || gA.bricks.includes(b.static))) || (b.mk === eB.mk && (b.body === eB.bi || gB.bricks.includes(b.static)));
    const all = Object.values(P).flat().filter((b) => !own(b));
    const c = conflictsAny(jointBoxes(j, XA, YA, [aSpan, bSpan]), all, false);
    if (c) findings.push(`the ${ln.key} line's ${c[0].who} meets ${c[1].who}`);
    joints.push({ line: ln.key, a: eA.mk, b: eB.mk, joint: j, x: XA, y: YA, aSpan, bSpan, d });
  }
  return { framed: !findings.length, reason: findings[0], findings, placement, joints, lines, refused, groups, boxes };
}

// ── STANDING A MODULE ON THE CLOCK'S BASEPLATE ───────────────────────────────
// Its statics placed, its feet re-footed for where they now stand, fillers
// under them for its lift, its own baseplate dropped. Refused when a foot has
// no form at its new x, or when a re-footed foot (a jumper is a stud wider than
// a 1×1 plate) would stand in a neighbour.
export function standModule(lib, mod_, pl) {
  const R = placeR(pl), ground = new Set(groundContacts(lib, mod_.build).map((c) => c.i)), out = [];
  for (const [i, p] of mod_.build.statics.entries()) {
    if (p.role === 'baseplate') continue;
    const m0 = turn(R, p.m), m = [m0[0] + pl.tx, m0[1] - L(pl.lift), m0[2] + pl.tz, ...m0.slice(3)];
    if (!ground.has(i)) { out.push({ ...p, m, module: mod_.key, static: i }); continue; }
    const foot = refoot(p.part, m[0]);
    if (!foot) return { ok: false, reason: `${mod_.key}: its ${p.part} foot has no form at x ${(m[0] * LDU_MM).toFixed(1)} mm` };
    out.push({ ...p, part: foot, m: foot === p.part ? m : [m[0], m[1], m[2], ...I3], module: mod_.key, static: i, refooted: foot !== p.part ? p.part : undefined });
    const fill = fillers(foot, pl.lift);
    if (!fill) return { ok: false, reason: `${mod_.key}: a lift of ${pl.lift} mm is not whole plates` };
    let z = 0;
    for (const f of fill) { z += f.h; out.push({ role: f.h > D.plateH ? 'brick' : 'plate', part: f.part, m: [m[0], -L(z), m[2], ...I3], module: mod_.key, filler: i }); }
  }
  // a re-footed foot against its neighbours
  const refooted = out.filter((s) => s.refooted);
  if (refooted.length) {
    const box = (s) => boxOf(lib, s.part, s.m, { body: true });
    for (const s of refooted) for (const o of out) if (o !== s && !o.filler && boxesConflict({ ...box(s), moves: false }, { ...box(o), moves: false })) return { ok: false, reason: `${mod_.key}: a re-footed ${s.part} stands in a ${o.part}` };
  }
  return { ok: true, statics: out };
}

// ── THE PHASE ────────────────────────────────────────────────────────────────
// ldrawBuild's mesh law, solved for either member: with each gear's tooth
// angle measured from the line of centres toward the other gear, a pair meshes
// when Na·a + Nb·b ≡ π (mod 2π). Every body reached from a FIXED one across a
// mesh takes the angle that law gives (the representative nearest its own, a
// keyed gear being free by whole teeth); FROZEN bodies are not moved.
const phaseCache = new WeakMap();
const phaseOf = (lib, part, n) => {
  let m = phaseCache.get(lib);
  if (!m) { m = new Map(); phaseCache.set(lib, m); }
  const k = `${part}/${n}`;
  if (!m.has(k)) m.set(k, toothPhase(lib, part, n).theta);
  return m.get(k);
};
export function meshAngle(lib, known, kg, other, og, phiKnown) {
  const ax = known.origin, bx = other.origin, Nk = kg.teeth, No = og.teeth;
  const toO = Math.atan2(bx[1] - ax[1], bx[0] - ax[0]), toK = toO + Math.PI;
  const a = phiKnown + phaseOf(lib, kg.part, Nk) - toO;
  // No·b ≡ π − Nk·a
  const b = (Math.PI - Nk * a) / No;
  return b + toK - phaseOf(lib, og.part, No);
}
const nearest = (v, ref, step) => ref + mod(v - ref + step / 2, step) - step / 2;
export function rephase(lib, build, fixed, frozen = new Set()) {
  const phi = build.shafts.map((s) => s.phi), known = new Set();
  for (const [i, v] of fixed) { phi[i] = v; known.add(i); }
  for (const i of frozen) known.add(i);
  const q = [...fixed.keys()];
  while (q.length) {
    const i = q.shift();
    for (const m of build.meshes ?? []) {
      const [k, o, kp, op] = m.a === i ? [m.a, m.b, m.ga, m.gb] : m.b === i ? [m.b, m.a, m.gb, m.ga] : [];
      if (k === undefined || known.has(o)) continue;
      const K = build.shafts[k], O = build.shafts[o], og = O.parts[op];
      phi[o] = nearest(meshAngle(lib, K, K.parts[kp], O, og, phi[k]), O.phi, TAU / og.teeth);
      known.add(o); q.push(o);
    }
  }
  return phi;
}
// The keyless works at a mode, its minute axle at `phiMinute`: the setting
// branch and the motion works follow the minute axle (a clutch gear that idles
// is turned by its mesh like any gear); in SET the stem follows the setting
// clutch gear, locked to it by the ring's dogs; the stem and the winding branch
// stand as built otherwise (they are not on the minute line).
export function keylessPhases(lib, mod_, mode, phiMinute) {
  const b = mod_.build, f = mod_.frame, bi = lineBody(mod_, 'minute');
  const branch = (s) => (s.clutch ? s.clutch : s.shaft === 0 ? 'stem' : typeof s.shaft === 'number' ? f.shafts[s.shaft]?.branch : 'pull');
  const frozen = new Set(b.shafts.map((s, i) => [s, i]).filter(([s]) => ['stem', 'winding', 'pull'].includes(branch(s))).map(([, i]) => i));
  const phi = rephase(lib, b, new Map([[bi, phiMinute]]), frozen);
  if (mode === 'set') {
    const si = b.shafts.findIndex((s) => s.clutch === 'setting'), stem = b.shafts.findIndex((s) => s.shaft === 0 && !s.clutch);
    const delta = b.shafts[si].phi - b.shafts[stem].phi;      // the dog lock, as ldrawBuild set it
    // the ring's four dogs: the stem may stand any quarter turn off the gear's lock; the nearest is taken
    phi[stem] = nearest(phi[si] - delta, b.shafts[stem].phi, TAU / 4);
  }
  return phi;
}

// ── THE CELL ─────────────────────────────────────────────────────────────────
// The clock at one state ({ alarm, keyless }): a build in ldrawBuild's shape
// (statics, shafts, meshes) in the clock's own frame, plus what the probe and
// the page read — the lines and their joints, each module's placement, the
// baseplates.
const BASEPLATE_STUDS = 32;
export function clockBaseplates(statics, lib) {
  const feet = statics.filter((s) => Math.abs(boxOf(lib, s.part, s.m).hi[1]) < 0.5);
  const ext = feet.map((s) => boxOf(lib, s.part, s.m, { body: true }));
  const x0 = Math.min(...ext.map((b) => b.lo[0])), x1 = Math.max(...ext.map((b) => b.hi[0]));
  const z0 = Math.min(...ext.map((b) => b.lo[2])), z1 = Math.max(...ext.map((b) => b.hi[2]));
  // a plate's edge stands half a stud past its outer stud, the studs on the grid: edges at 10 mod 20 LDU
  const edge = (v) => Math.floor((v - 10) / 20 + EPS) * 20 + 10, W = 20 * BASEPLATE_STUDS;
  const ex = edge(x0), ez = edge(z0), nx = Math.ceil((x1 - ex) / W - EPS), nz = Math.ceil((z1 - ez) / W - EPS);
  const plates = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) plates.push({ role: 'baseplate', part: KEYLESS_PARTS.baseplate32, m: at(ex + W * (i + 0.5), 0, ez + W * (k + 0.5)) });
  return { plates, studsX: nx * BASEPLATE_STUDS, studsZ: nz * BASEPLATE_STUDS, feet: { x0, x1, z0, z1 } };
}
export function clockBuild(lib, Mods, layout, state = TECHNIC_CLOCK.rest) {
  const M = Mods.modules, P = layout.placement, keys = Object.keys(P);
  const sgn = (k) => (P[k].rot ? -1 : 1);
  // ── each module's build at this state, and its phases
  const build = {}, phi = {};
  for (const k of keys) build[k] = M[k].kind === 'alarm' ? M[k].builds[state.alarm] : M[k].build;
  const end = (key, mk) => { const ln = layout.lines.find((l) => l.key === key); return ln.ends.find((e) => e.mk === mk); };
  // THE PHASES walk the joints from each group's GIVEN module: the fusee as
  // built (its ratchet at phiM 0), the alarm at its state (its disc sets its
  // hour axle). Each line hands its angle on in the world; the next module
  // takes it in its own frame (a module turned 180° about the vertical sees a
  // turn about z reversed) and is re-phased from that body by the mesh law.
  for (const k of keys) phi[k] = build[k].shafts.map((s) => s.phi);
  const given = new Set(keys.filter((k) => ['fusee', 'alarm', 'escapement'].includes(M[k].kind)));
  const done = new Set(given), q = [...given];
  while (q.length) {
    const from = q.shift();
    for (const j of layout.joints) {
      const to = j.a === from ? j.b : j.b === from ? j.a : null;
      if (!to || done.has(to)) continue;
      const ef = end(j.line, from), et = end(j.line, to), v = sgn(to) * sgn(from) * phi[from][ef.bi];
      phi[to] = M[to].kind === 'keyless' ? keylessPhases(lib, M[to], state.keyless, v) : rephase(lib, build[to], new Map([[et.bi, v]]));
      done.add(to); q.push(to);
    }
  }
  const lineOf = (key) => layout.joints.find((j) => j.line === key);
  // ── the statics
  const statics = [];
  for (const k of keys) {
    const st = standModule(lib, { ...M[k], build: build[k] }, P[k]);
    if (!st.ok) throw new Error(`clock: ${st.reason}`);
    statics.push(...st.statics);
  }
  const base = clockBaseplates(statics, lib);
  statics.unshift(...base.plates);
  // ── the bodies, each in the clock's frame, posed for the state
  const shafts = [], where = {};          // where[k][bi] = { body, offset } in shafts
  for (const k of keys) {
    const R = placeR(P[k]), s0 = sgn(k), mode = M[k].kind === 'keyless' ? state.keyless : build[k].modes?.[0];
    where[k] = [];
    build[k].shafts.forEach((b, bi) => {
      const o = placePoint(P[k], b.origin);
      const pose = b.axis === 'x' ? (b.pose?.[mode] ?? 0) : 0;
      const parts = b.parts.map((p) => {
        const m = turn(R, [p.m[0], p.m[1], p.m[2] + (p.slide?.[mode] ?? 0), ...p.m.slice(3)]);
        const { slide, ...rest } = p;
        return { ...rest, m, module: k };
      });
      where[k][bi] = { body: shafts.length, offset: 0 };
      shafts.push({ shaft: `${k}/${b.shaft}`, module: k, origin: o, axis: b.axis, phi: s0 * (phi[k][bi] + pose), speed: 0, parts,
        ...(b.idles ? { idles: b.idles } : {}), ...(b.clutch ? { clutch: b.clutch } : {}) });
    });
  }
  // ── the lines: B's body merged into A's, both modules' axles on the line
  // replaced by the joint's; one body, one angle
  const lines = [];
  for (const j of layout.joints) {
    const ea = end(j.line, j.a), eb = end(j.line, j.b);
    const A = shafts[where[j.a][ea.bi].body], B = shafts[where[j.b][eb.bi].body];
    if (Math.abs(A.phi - B.phi) > 1e-9) throw new Error(`clock: the ${j.line} line's two halves stand at different angles (${A.phi}, ${B.phi})`);
    const dz = B.origin[2] - A.origin[2];
    const keepA = A.parts.filter((p) => p.role !== 'axle'), keepB = B.parts.filter((p) => p.role !== 'axle').map((p) => ({ ...p, m: [p.m[0], p.m[1], p.m[2] + dz, ...p.m.slice(3)] }));
    const jp = j.joint.axles.map((a) => ({ role: 'axle', part: a.part, m: at(0, 0, (a.z0 + a.z1) / 2 - A.origin[2], ROT_X_TO_Z), module: 'clock', joint: j.line }));
    if (j.joint.joiner) jp.push({ role: 'joiner', part: j.joint.joiner.part, m: at(0, 0, j.joint.joiner.z - A.origin[2]), module: 'clock', joint: j.line });
    const offB = keepA.length + jp.length;
    A.parts = [...keepA, ...jp, ...keepB];
    A.shaft = `line ${j.line}`; A.line = j.line;
    // B's body is gone: its index now points at A, its parts offset
    const bIdx = where[j.b][eb.bi].body;
    B.parts = []; B.merged = j.line;
    where[j.b][eb.bi] = { body: where[j.a][ea.bi].body, offset: offB, removed: B };
    lines.push({ key: j.line, why: layout.lines.find((l) => l.key === j.line).why, a: j.a, b: j.b, body: where[j.a][ea.bi].body, x: j.x, y: j.y, joint: j.joint, spans: [j.aSpan, j.bSpan], gone: bIdx });
  }
  // drop the emptied bodies, renumbering
  const keep = shafts.map((s, i) => (s.merged ? -1 : i)), idx = new Map();
  const finalShafts = [];
  shafts.forEach((s, i) => { if (keep[i] >= 0) { idx.set(i, finalShafts.length); finalShafts.push(s); } });
  // each module's meshes, renumbered into the cell (a part index on a merged
  // body is recounted against the parts it kept)
  const meshes = [];
  for (const k of keys) for (const m of build[k].meshes ?? []) {
    const map = (bi, pi) => {
      const w = where[k][bi], orig = build[k].shafts[bi].parts, kept = orig.slice(0, pi + 1).filter((p) => p.role !== 'axle').length - 1;
      const merged = w.offset || finalShafts[idx.get(w.body)]?.line;
      return { body: idx.get(w.body), part: merged ? (w.offset ? w.offset + kept : kept) : pi };
    };
    const a = map(m.a, m.ga), b = map(m.b, m.gb);
    meshes.push({ a: a.body, ga: a.part, b: b.body, gb: b.part, module: k });
  }
  for (const ln of lines) ln.body = idx.get(ln.body);
  return { key: 'clock', gen: Mods.gen, statics, shafts: finalShafts, meshes, modes: [`${state.alarm}, ${state.keyless}`], state,
    lines, refused: layout.refused, placement: P, base, unplaced: Mods.order.filter((k) => !P[k]) };
}

// THE DECLARED PLACEMENT, per generation: { module: [turned 180°?, x, z] } in
// LDU, the answer solveClockLayout gives (half a minute of search, which the
// page does not spend). tools/probe-technic-clock.mjs re-solves both and FAILS
// when either differs, so this cannot go stale against the modules; the page
// reads it through layoutFrom, the solve's own judge.
export const CLOCK_PLACEMENT = Object.freeze({
  technic_2026: Object.freeze({ fusee: [0, 0, 0], 'centre→fourth': [0, 130, 380], 'fourth→escape': [1, 330, 380], keyless: [0, 160, 700], 'adapter:minute': [0, 80, 1000], alarm: [1, 300, 1260] }),
  technic_classic: Object.freeze({ fusee: [0, 0, 0], 'centre→fourth': [0, 130, 380], 'fourth→escape': [1, 290, 300], keyless: [0, 120, 740], 'adapter:minute': [0, 40, 1040], alarm: [1, 260, 1300] }),
});
export function clockLayout(lib, Mods, placement = CLOCK_PLACEMENT[Mods.gen]) {
  if (!placement) return { framed: false, reason: `no placement declared for ${Mods.gen}` };
  return layoutFrom(lib, Mods, placement);
}
