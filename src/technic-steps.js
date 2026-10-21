// BUILT §302 — THE STEP ORDER: in what sequence each LEGO Technic build goes together, derived from the
// model's own structure and nothing typed per placement. Pure: no three.js, no DOM, so the probe that
// holds it (tools/probe-technic-steps.mjs) and the page that offers its file read one module. (The
// swept-insertion VALIDATOR that judges an order needs triangles and a bounds tree; it lives in
// tools/technic-steps-sweep.mjs and this module never imports it.)
//
// WHAT A PLAN IS. `placedParts` (src/technic-ldraw.js) is the flat list of a build's placements. A PLAN
// is the same list partitioned into STEPS, every placement in exactly one. It is MODELLED, not built:
// nobody has put one together, the steps are checked against the part geometry only, and a step whose
// part the validator cannot get in says so (`tools/probe-technic-steps.mjs` names it) rather than being
// dropped. Each part-adding step carries the directions it is to be inserted along, in order of
// preference (`cand`); the validator takes the first that clears.
//
// WHAT DERIVES THE ORDER (rule 1: each is a constraint read off the placements, not a list):
//   FRAME   the baseplate, then the columns BOTTOM-UP, one step per layer across every column (a column
//           is a stack on the baseplate; a part rests on the one under it, so a layer cannot precede
//           the layer below it).
//   MODULE  an axle threaded through Technic bricks. A part standing on the axle where it cannot be slid
//           in from either end — a frame part in the way of its whole footprint on both sides — is HELD
//           IN THE GAP and lowered first (`gap`); the axle is then threaded through brick, parts,
//           brick (`thread`); what can be slid on from a free end then is (`slide`), nearest the
//           bricks first. Which bricks the axle passes through, and which end is clear for each part,
//           is read from the placements and the bounds of the pack's parts, not from a shaft table.
//   NESTED  two parts on one line whose extents overlap (a ring over a joiner) cannot go in one after the
//           other: they are put together off the model and lowered as one sub-assembly.
//   FLOATING AXLE  an axle no brick holds, standing on a mounted axle's line (the fusee's maintaining
//           axle between the cone's and the great wheel's): carried by its joiners, assembled with them
//           off the model, lowered between the bricks BEFORE the axles that join it are threaded.
//   UNIT    a body with no brick on its axle (a pawl on its arm, the balance on its knife edge) is
//           assembled OFF the model as a sub-assembly (a `0 FILE` of its own in the .mpd) and placed whole.
//   TRAVEL  a part that moves along its shaft between modes (the keyless ring) goes in last among the
//           parts around it, at the neutral place, and is slid to its mode's: the step declares it.
//   SHAFTS  in the order the build's MESHES hand the phase on (a shaft is added after the one that drives
//           it); chapters with no mesh list take RECIPES' order, then the chapters are put in an order
//           in which no part is added behind one that stands in its only clear corridor.
//   TURN TO MESH  a toothed part put in next to a meshed neighbour already placed is judged with the
//           meshed chain turned (the validator's rule); the step carries the shaft angle φ the build
//           placed it at, so the builder turns the pair to it.
//   §305 (TODO 264), each with the case that forced it beside its code: a part is on a line by a HOLE as well
//           as its origin; a part whose free end is shut by its own group is held; the works of a group go in
//           an order read off their corridors over every mode; a hosted body after its host, an axle after the
//           parts on its own line; pins in a held part go in with it, a unit under another first; an axle shut
//           at both ends is lowered beside its bricks with what it carries and slid; an axle in pieces is one
//           module; a body pivoting on a unit's peg rides in the unit; no gear goes in between two meshes;
//           a travelling part is nested at neutral; in a sub-assembly the arms go on in order along their axle.
//
// THE ONE HAND-WRITTEN TABLE, RECIPES, orders and names CHAPTERS for the cells whose bodies are not joined
// by a mesh list (the fusee, the alarm, the escapement) and for the keyless cell's selector, by SHAFT KEY
// (the name the builder gave the body) and never by placement index. A key no body answers, or a body no
// recipe names, is reported by the probe.
import { bounds, placements, compose, LDU_MM as LDU_MM_STEPS } from './ldraw.js';
import { LDRAW_COLOUR, placedParts } from './technic-ldraw.js';
import { colourOf } from './technic-colour.js';
import { HONESTY, CORD_ROLES } from './technic-bom.js';

export const DOWN = Object.freeze([0, 1, 0]);                // LDraw +Y is down: a stud-seated part is lowered along +Y
const AXES6 = Object.freeze([[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]);

// A part is "on" a line when its origin is within this many LDU of it (the hole faces and the
// gear bores in the pack are placed on the line to float noise; half an LDU is a quarter of an
// axle arm). A brick is "through" an axle when its hole faces overlap the axle's span by more
// than a LDU (an axle ends half an LDU short of a hole face).
export const ON_LINE_LDU = 0.5, THROUGH_OVERLAP_LDU = 1;
// A toothed pair meshes at (Na + Nb)/2 millimetres between centres (the pack's 1 mm module): 1.25 LDU
// a tooth. This much slack either way, and coplanar to within TWO LDU, finds the pairs.
export const MESH_SLACK_LDU = 4, MESH_COPLANAR_LDU = 2, LDU_PER_TOOTH = 1.25;
// The pack's hole primitives (a hole runs along the primitive's own Y): axle holes, pin holes, beam holes.
const HOLE_RE = /^(axl\w*hol\w*|axl\w*ho\d+|axlehol\w*|peghole\w*|npeghol\w*|connhol\w*|beamhol\w*)\.dat$/;

// ---------------------------------------------------------------------------
// THE RECIPES. Chapters, in order, naming bodies by their shaft key. `nth` picks one of several
// bodies that share a key (the fusee's two joiners). A chapter's bodies are built as one group:
// the order inside it is derived (above), only WHICH bodies and in WHAT ORDER ARE CHAPTERS is
// written here. `notes` are steps that add NO part and say what the model does not hold.
const BAND = 'A rubber band goes here. Its count, size and length are not in the model: the force it stands for is POSED, not measured.';
export const RECIPES = Object.freeze({
  'keyless works': [
    { id: 'selector', title: 'The selector, the pull and the detent', take: ['selector', 'detent', 'rack'],
      notes: [{ text: `${BAND} It holds the detent's follower on its wheel (landing F posed its force).`, posed: true }] }],
  fusee: [
    { id: 'barrel', title: 'The barrel', take: ['barrel'],
      notes: [{ text: `${BAND} The barrel's band stands in for the going spring; its law is POSED (TECHNIC_FUSEE_SPRING), only a built model could measure it.`, posed: true }] },
    { id: 'line', title: 'The fusee, the maintaining ratchet and the great wheel on one line', take: ['maintaining', { key: 'joiner', nth: 0 }, { key: 'joiner', nth: 1 }, 'fusee', 'great'],
      notes: [{ text: `${BAND} The maintaining band carries the ratchet to the great wheel; its force is POSED.`, posed: true }] },
    { id: 'pawls', title: 'The two pawls', take: ['click pawl', 'detent pawl'] },
    { id: 'centre', title: 'The centre pinion', take: ['centre'] }],
  alarm: [
    { id: 'wheel', title: 'The column wheel, its detent and the driver', take: ['column wheel', 'detent', 'driver'],
      notes: [{ text: `${BAND} It holds the detent on the column wheel; the force is POSED.`, posed: true }] },
    { id: 'lever', title: 'The release lever', take: ['lever'] },
    { id: 'pusher', title: 'The pusher and the pawl', take: ['pawl', 'pusher'] },
    { id: 'disc', title: 'The release disc', take: ['disc'] },
    { id: 'strike', title: 'The strike train and the fly', take: ['fly', 'middle', 'barrel', 'S2', 'S1', 'hour'],
      notes: [{ text: `${BAND} The strike barrel's band, the strike cadence and the strikes per wind are POSED (TECHNIC_ALARM_STRIKE). The fly is a different mechanism from the steel anchor.`, posed: true }] },
    { id: 'hammer', title: 'The hammer', take: ['hammer'],
      notes: [{ text: 'There is no gong: no LEGO part rings. The hammer strikes a tile, which is in the parts list.', posed: false }] }],
  escapement: [
    { id: 'escape', title: 'The escape wheel', take: ['escape'] },
    { id: 'balance', title: 'The balance on its knife edge', take: ['balance'],
      notes: [{ text: `${HONESTY.analogue}`, posed: false }] }],
});

// ---------------------------------------------------------------------------
// vector helpers over a placement's 3×4 (LDraw order x y z a b c d e f g h i; a part's own X is
// the first COLUMN (a, d, g), its Y (b, e, h), its Z (c, f, i))
const axisX = (m) => [m[3], m[6], m[9]], axisY = (m) => [m[4], m[7], m[10]], axisZ = (m) => [m[5], m[8], m[11]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const norm = (u) => { const n = Math.hypot(...u); return n > 1e-12 ? u.map((v) => v / n) : u; };
const parallel = (u, v) => Math.hypot(...cross(u, v)) < 1e-6;
const perpDist = (p, o, u) => Math.hypot(...cross(sub(p, o), u));       // u a unit vector
const at3 = (m, l) => [m[0] + m[3] * l[0] + m[4] * l[1] + m[5] * l[2], m[1] + m[6] * l[0] + m[7] * l[1] + m[8] * l[2], m[2] + m[9] * l[0] + m[10] * l[1] + m[11] * l[2]];
const origin = (m) => [m[0], m[1], m[2]];
const same = (u, v) => Math.hypot(...sub(u, v)) < 1e-9;

const ROLE_NAME = Object.freeze({
  baseplate: 'baseplate', plate: 'plate', brick: 'brick', technicBrick: 'Technic brick', tile: 'tile', axle: 'axle', spur: 'spur gear', doubleBevel: 'double bevel gear',
  joiner: 'joiner', ring: 'driving ring', crown: 'crown', catch: 'changeover catch', pinion: 'pinion', rack: 'rack', detent: 'detent wheel', arm: 'arm', follower: 'half bush', knife: 'knife-edge slope',
  cord: 'string', cordEnd: 'end stud', barrel: 'barrel pulley', hook: 'hook plate', knob: 'knob', pulley: 'grooved pulley', click: 'click wheel', ratchet: 'ratchet', pawl: 'pawl', great: 'great wheel',
  centre: 'centre pinion', lever: 'lever', pin: 'pin', rotor: 'column rotor', wheel: 'wheel', driver: 'driver', stub: 'stub axle', pushTip: 'push tip', collar: 'collar', button: 'button',
  beam: 'beam', gear: 'gear', mass: 'mass', pallet: 'pallet' });
const nameOf = (p) => `${p.teeth ? `${p.teeth}T ` : ''}${ROLE_NAME[p.role] ?? p.role}`;
// "an 8T gear", "an arm", "a 16T gear": by the sound of the first word
const article = (w) => (/^(?:[aeiou]|8\d*T|1[18]T)/i.test(w) ? 'an' : 'a');
const countNames = (ps) => {
  const c = new Map();
  for (const p of ps) c.set(nameOf(p), (c.get(nameOf(p)) ?? 0) + 1);
  return [...c].map(([k, n]) => (n > 1 ? `${n} × ${k}` : `${article(k)} ${k}`)).join(', ');
};
export const dirName = (v) => {
  for (const [n, a] of [['down', DOWN], ['up', [0, -1, 0]], ['+x', [1, 0, 0]], ['−x', [-1, 0, 0]], ['+z', [0, 0, 1]], ['−z', [0, 0, -1]]]) if (same(v, a)) return n;
  return `(${v.map((x) => x.toFixed(2)).join(', ')})`;
};

// ---------------------------------------------------------------------------
// THE PLAN. `deriveSteps(build, { lib, mode })` -> { key, gen, mode, parts, steps, chapters, subs, ... }.
export function deriveSteps(build, { lib, mode = build.modes?.[0], recipes = RECIPES } = {}) {
  const parts = placedParts(build, 0, mode);
  const B = new Map();
  const bnd = (id) => (B.has(id) || B.set(id, bounds(lib, `${id}.dat`)), B.get(id));
  const nStatic = build.statics.length;
  // which body a placement belongs to, and its position in it
  const bodyOf = new Array(parts.length).fill(-1), partOfBody = [];
  { let i = nStatic; for (const [b, s] of build.shafts.entries()) { partOfBody[b] = []; for (let k = 0; k < s.parts.length; k++) { bodyOf[i] = b; partOfBody[b].push(i); i++; } } }

  const steps = [], chapters = [], subs = [];
  let chapter = null;
  const openChapter = (id, title) => { chapter = { id, title, from: steps.length, to: steps.length }; chapters.push(chapter); };
  const emit = (st) => {
    st.n = steps.length + 1; st.chapter = chapter?.id ?? null;
    st.parts ??= []; st.notes ??= [];
    steps.push(st); if (chapter) chapter.to = steps.length;
    return st;
  };

  // ── FRAME. The baseplate, then the columns bottom-up.
  const frameIdx = [], cordIdx = [];
  for (let i = 0; i < nStatic; i++) (CORD_ROLES.includes(parts[i].role) ? cordIdx : frameIdx).push(i);
  const baseIdx = frameIdx.filter((i) => parts[i].role === 'baseplate'), colIdx = frameIdx.filter((i) => parts[i].role !== 'baseplate');
  openChapter('frame', 'The baseplate and the columns');
  for (const i of baseIdx) emit({ kind: 'baseplate', title: 'Place the baseplate', text: `Lay the ${nameOf(parts[i])} flat. Every column stands on its studs.`, parts: [i], cand: { [i]: [DOWN] } });
  const cols = new Map();
  for (const i of colIdx) {
    const k = `${parts[i].m[0].toFixed(3)},${parts[i].m[2].toFixed(3)}`;
    if (!cols.has(k)) cols.set(k, []);
    cols.get(k).push(i);
  }
  for (const stack of cols.values()) stack.sort((a, b) => parts[b].m[1] - parts[a].m[1]);   // bottom first (+Y is down)
  const levels = Math.max(0, ...[...cols.values()].map((s) => s.length));
  for (let L = 0; L < levels; L++) {
    const here = [...cols.values()].filter((s) => s.length > L).map((s) => s[L]);
    emit({ kind: 'layer', level: L + 1, title: `Columns, layer ${L + 1} of ${levels}`,
      text: `On ${here.length} column${here.length > 1 ? 's' : ''}, press on ${countNames(here.map((i) => parts[i]))}.`,
      parts: here, cand: Object.fromEntries(here.map((i) => [i, [DOWN]])) });
  }

  // ── GEOMETRY OF THE AXLES. Every Technic brick: where its hole is and which way it runs. For an
  // axle part: its line and span. A brick is THROUGH an axle when its hole is on the axle's line and
  // its faces overlap the axle's span; every brick on the line, through or not, is an obstacle to
  // sliding a part along it (the fusee's axle and the great wheel's stand end to end on one line,
  // so a click wheel between their bricks can only be lowered, never slid).
  const bricks = frameIdx.filter((i) => parts[i].role === 'technicBrick').map((i) => {
    const p = parts[i], b = bnd(p.part), c = at3(p.m, [0, 1, 2].map((k) => (b.lo[k] + b.hi[k]) / 2)), z = axisZ(p.m), half = (b.hi[2] - b.lo[2]) / 2;
    return { i, centre: c, axis: z, half };
  });
  const lineOf = (i) => {
    const p = parts[i], b = bnd(p.part), u = norm(axisX(p.m)), o = origin(p.m);
    return { i, o, u, t0: b.lo[0], t1: b.hi[0] };
  };
  const bricksOn = (ln) => bricks.filter((br) => parallel(br.axis, ln.u) && perpDist(br.centre, ln.o, ln.u) < ON_LINE_LDU)
    .map((br) => ({ ...br, t: dot(sub(br.centre, ln.o), ln.u) })).sort((a, b) => a.t - b.t);
  const throughOf = (ln, on) => on.filter((br) => Math.min(ln.t1, br.t + br.half) - Math.max(ln.t0, br.t - br.half) > THROUGH_OVERLAP_LDU);
  const boxOf = (i, pp = parts) => {
    const p = pp[i], b = bnd(p.part), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [b.lo[0], b.hi[0]]) for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) {
      const w = at3(p.m, [x, y, z]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); }
    }
    return { lo, hi };
  };
  const boxes = new Map();
  const boxCached = (i) => (boxes.has(i) || boxes.set(i, boxOf(i)), boxes.get(i));
  const SHRINK_LDU = 0.5;                                      // flush faces are contact, not obstruction
  const hitsBox = (A, B) => [0, 1, 2].every((k) => A.lo[k] < B.hi[k] - SHRINK_LDU && B.lo[k] < A.hi[k] - SHRINK_LDU);
  const sweptBox = (i, dir) => {                               // the part's box dragged a long way along dir
    const b = boxCached(i), L = 1e4, lo = [...b.lo], hi = [...b.hi];
    for (let k = 0; k < 3; k++) { if (dir[k] > 1e-9) hi[k] += L; else if (dir[k] < -1e-9) lo[k] -= L; }
    return { lo, hi };
  };
  // the space a part passes through on its way in from `from` (a unit direction), BEYOND its own placed box —
  // its own place holds its fits and meshes, not its corridor (§305)
  // (§305: the works' order is read over EVERY mode's placements at once — a box in any mode — so the modes,
  // which move the selector, the follower and the ring, order alike)
  const modeParts = (build.modes?.length > 1 ? build.modes : [mode]).map((md) => (md === mode ? parts : placedParts(build, 0, md)));
  const modeBoxes = modeParts.map((pp) => new Map());
  const boxIn = (k, i) => (modeBoxes[k].has(i) || modeBoxes[k].set(i, boxOf(i, modeParts[k])), modeBoxes[k].get(i));
  const hitsAnyMode = (i, from, j) => modeParts.some((_, k) => hitsBox(beyondBox(boxIn(k, i), from), boxIn(k, j)));
  const beyondBox = (b, from) => {
    const L = 1e4, lo = [...b.lo], hi = [...b.hi];
    for (let k = 0; k < 3; k++) { if (from[k] > 1e-9) { lo[k] = b.hi[k]; hi[k] = b.hi[k] + L; } else if (from[k] < -1e-9) { hi[k] = b.lo[k]; lo[k] = b.lo[k] - L; } }
    return { lo, hi };
  };
  const beyond = (i, from) => {
    const b = boxCached(i), L = 1e4, lo = [...b.lo], hi = [...b.hi];
    for (let k = 0; k < 3; k++) { if (from[k] > 1e-9) { lo[k] = b.hi[k]; hi[k] = b.hi[k] + L; } else if (from[k] < -1e-9) { hi[k] = b.lo[k]; lo[k] = b.lo[k] - L; } }
    return { lo, hi };
  };
  // §305: a side of part i along line ln is shut too where a part of its own GROUP (`idxs`) off the line stands in
  // the corridor beyond it (the keyless follower's arm on the detent wheel's free end, the wheel on the arm's):
  // whichever went in first would shut the other's only way, so such a part is held in the gap and threaded
  const groupShut = (idxs, i, ln, from) => idxs.some((j) => j !== i && !CORD_ROLES.includes(parts[j].role) && perpDist(origin(parts[j].m), ln.o, ln.u) >= ON_LINE_LDU && hitsBox(beyond(i, from), boxCached(j)));
  // the sides of a part along a line it can be slid in from: blocked by a FRAME part in the way, or
  // met by n parts ALREADY PLACED (off the line) it would have to pass — a part not yet placed is
  // not in the way, it will have to find its own way past this one
  const sideReport = (i, ln, dir, groupSet, placedSet = null) => {
    const sw = sweptBox(i, dir);
    const frame = frameIdx.some((j) => parts[j].role !== 'baseplate' && hitsBox(sw, boxCached(j)));
    let others = 0;
    for (const j of (placedSet ?? done)) if (j >= nStatic && j !== i && !groupSet.has(j) && perpDist(origin(parts[j].m), ln.o, ln.u) >= ON_LINE_LDU && hitsBox(sw, boxCached(j))) others++;
    return { frame, others };
  };
  // EVERY frame part the line runs through — a Technic brick (through its hole), a pillar of plain
  // bricks standing across it — is something a part cannot be slid past along the line. Each as the
  // interval of the line inside its box (slab test on the part's bounds, world frame).
  const blockerBoxes = frameIdx.filter((i) => parts[i].role !== 'baseplate').map((i) => {
    const p = parts[i], b = bnd(p.part), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [b.lo[0], b.hi[0]]) for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) {
      const w = at3(p.m, [x, y, z]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); }
    }
    return { i, lo, hi };
  });
  const blockersOn = (ln) => {
    const out = [];
    for (const bx of blockerBoxes) {
      let t0 = -Infinity, t1 = Infinity;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(ln.u[k]) < 1e-9) { if (ln.o[k] < bx.lo[k] - 1e-6 || ln.o[k] > bx.hi[k] + 1e-6) { t0 = Infinity; break; } continue; }
        const a = (bx.lo[k] - ln.o[k]) / ln.u[k], b = (bx.hi[k] - ln.o[k]) / ln.u[k];
        t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
      }
      if (t1 - t0 > 0.5) out.push({ i: bx.i, lo: t0, hi: t1 });
    }
    return out.sort((a, b) => a.lo - b.lo);
  };
  // a part's extent along a line it sits on: its own axis that runs parallel to it, its bounds on that axis
  const extentOn = (i, ln) => {
    const p = parts[i], b = bnd(p.part), tc = dot(sub(origin(p.m), ln.o), ln.u);
    for (const [k, ax] of [axisX(p.m), axisY(p.m), axisZ(p.m)].entries()) if (parallel(ax, ln.u)) {
      const sg = dot(ax, ln.u) > 0 ? 1 : -1;
      return { tc, e0: tc + (sg > 0 ? b.lo[k] : -b.hi[k]), e1: tc + (sg > 0 ? b.hi[k] : -b.lo[k]) };
    }
    return { tc, e0: tc, e1: tc };
  };

  // A part is ON a line when its origin is, or when one of its HOLES is, coaxial (§305: the changeover catch
  // hangs from a pivot hole 20 LDU off its origin, so landing 2 read it as off the selector axle and attached it
  // after the axle was threaded, where nothing can reach it). The holes are the pack's own hole primitives.
  const holeCache = new Map();
  const holesOf = (i) => {
    if (!holeCache.has(i)) holeCache.set(i, placements(lib, `${parts[i].part}.dat`, HOLE_RE).map((h) => compose(parts[i].m, h.m)));
    return holeCache.get(i);
  };
  const onLine = (i, ln) => perpDist(origin(parts[i].m), ln.o, ln.u) < ON_LINE_LDU
    || holesOf(i).some((h) => perpDist(origin(h), ln.o, ln.u) < ON_LINE_LDU && parallel(norm(axisY(h)), ln.u));
  const overlap = (x, ln) => Math.min(ln.t1, x.e1) - Math.max(ln.t0, x.e0) > THROUGH_OVERLAP_LDU || (x.e0 === x.e1 && x.tc >= ln.t0 && x.tc <= ln.t1);
  const mountedOf0 = (idxs) => idxs.filter((i) => parts[i].role === 'axle').map(lineOf).map((ln) => { const on = bricksOn(ln); return { ...ln, on, blk: blockersOn(ln), br: throughOf(ln, on) }; }).filter((ln) => ln.br.length);
  // AN AXLE IN PIECES (§305: the keyless stem, two axles meeting in the joiner's web) is ONE module: the pieces of
  // one body on one line share its held parts (the ring's nest travels into the far piece's clutch gear, so it
  // must be held after it), each piece threaded through its own brick. Merged here, in the first piece's frame.
  const mountedOf = (idxs) => {
    const out = [];
    for (const ln of mountedOf0(idxs)) {
      const host = out.find((m) => bodyOf[m.i] === bodyOf[ln.i] && parallel(m.u, ln.u) && perpDist(ln.o, m.o, m.u) < ON_LINE_LDU);
      if (!host) { out.push({ ...ln, pieces: [ln] }); continue; }
      const sh = dot(sub(ln.o, host.o), host.u), sg = dot(ln.u, host.u) > 0 ? 1 : -1;
      const [a, b] = [sh + sg * ln.t0, sh + sg * ln.t1].sort((p, q) => p - q);
      host.t0 = Math.min(host.t0, a); host.t1 = Math.max(host.t1, b);
      host.br = [...host.br, ...ln.br.filter((x) => !host.br.some((y) => y.i === x.i))].map((x) => ({ ...x, t: dot(sub(x.centre, host.o), host.u) }));
      host.pieces.push(ln);
    }
    return out;
  };

  // ── MESH PARTNERS. A toothed part and every toothed part already placed it meshes with.
  const toothed = (i) => !!parts[i].teeth;
  const meshes = (a, b) => {
    const pa = parts[a], pb = parts[b];
    if (!pa.teeth || !pb.teeth || bodyOf[a] === bodyOf[b] || !parallel(axisZ(pa.m), axisZ(pb.m))) return false;
    const u = axisZ(pa.m), d = sub(origin(pb.m), origin(pa.m)), ax = dot(d, u);
    if (Math.abs(ax) > MESH_COPLANAR_LDU) return false;
    const r = Math.hypot(...sub(d, u.map((v) => v * ax)));
    return Math.abs(r - (pa.teeth + pb.teeth) * LDU_PER_TOOTH) < MESH_SLACK_LDU;
  };
  const radialAway = (i, doneSet) => {
    const out = [];
    for (const j of doneSet) if (toothed(j) && meshes(i, j)) {
      const u = axisZ(parts[i].m), d = sub(origin(parts[i].m), origin(parts[j].m));
      const v = norm(sub(d, u.map((w) => w * dot(d, u))));
      if (!out.some((w) => same(w, v))) out.push(v);
    }
    return out;
  };
  const ownAxes = (i) => { const m = parts[i].m; return [axisX(m), axisY(m), axisZ(m)].flatMap((a) => [a, a.map((v) => -v)]).map(norm); };
  const uniq = (list) => { const o = []; for (const v of list) if (!o.some((w) => same(w, v))) o.push(v); return o; };
  const turnNote = (i, doneSet) => {
    if (!toothed(i)) return null;
    const partner = [...doneSet].find((j) => toothed(j) && meshes(i, j));
    if (partner === undefined) return null;
    const s = build.shafts[bodyOf[i]], phi = s ? (((s.phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) * 180 / Math.PI : null;
    return { i, partner, phi, text: `Turn the ${nameOf(parts[i])} on its axle until a tooth sits in a gap of the ${nameOf(parts[partner])} it meshes with${phi === null ? '' : ` (the modelled shaft angle is φ = ${phi.toFixed(1)}°)`}.` };
  };

  // ── GROUPS. Bodies partitioned by shaft key (a body that idles on a shaft shares its key), in the
  // order the mesh list hands the phase on, else the recipe's.
  const keyOf = (b) => build.shafts[b].shaft;
  const groupsByKey = new Map();
  for (let b = 0; b < build.shafts.length; b++) {
    const k = String(keyOf(b));
    if (!groupsByKey.has(k)) groupsByKey.set(k, { key: keyOf(b), bodies: [] });
    groupsByKey.get(k).bodies.push(b);
  }
  const groupOfBody = (b) => groupsByKey.get(String(keyOf(b)));
  const chaptersPlan = [];                                     // { id, title, groups: [{ key, bodies, nth? }], notes }
  const takenBody = new Set();
  const take = (g, only = null) => {                           // the group's bodies not yet taken (or one of them)
    const bs = (only === null ? g.bodies : [g.bodies[only]]).filter((b) => b !== undefined && !takenBody.has(b));
    for (const b of bs) takenBody.add(b);
    return bs.length ? { key: g.key, bodies: bs, ...(only !== null ? { nth: only } : {}) } : null;
  };
  const recipe = recipes[build.key];
  // (1) the mesh walk: the root is the group of body 0; a group is added after the group whose gear drives it
  if (build.meshes?.length) {
    const order = [], label = new Map(), root = groupOfBody(0);
    const hasClutch = build.shafts.some((s) => s.clutch);
    order.push(root); label.set(root, hasClutch ? 'stem' : 'train');
    for (let again = true; again;) {
      again = false;
      for (const m of build.meshes) {
        const ga = groupOfBody(m.a), gb = groupOfBody(m.b);
        if (!label.has(ga) || label.has(gb)) continue;
        // the branch a group belongs to: the mesh's own tag (motion), else the clutch the root hands it from, else its parent's
        label.set(gb, m.branch ?? (ga === root ? build.shafts[m.a].clutch : null) ?? label.get(ga));
        order.push(gb); again = true;
      }
    }
    const NAMES = { stem: 'The input shaft', winding: 'The winding branch', setting: 'The setting branch', motion: 'The motion works', train: 'The gear train' };
    for (const g of order) {
      const lab = label.get(g), tg = take(g);
      if (!tg) continue;
      const last = chaptersPlan[chaptersPlan.length - 1];
      if (last && last.label === lab) last.groups.push(tg);
      else chaptersPlan.push({ id: lab, label: lab, title: NAMES[lab] ?? `The ${lab} branch`, groups: [tg], notes: [] });
    }
  }
  // (2) the recipe's chapters
  const unmatched = [];
  if (recipe) for (const ch of recipe) {
    const gs = [];
    for (const t of ch.take) {
      const key = typeof t === 'object' ? t.key : t, nth = typeof t === 'object' ? t.nth : null;
      const g = groupsByKey.get(String(key));
      if (!g) { unmatched.push(`${build.key}: recipe names ${JSON.stringify(t)} and no body answers`); continue; }
      if (nth !== null && g.bodies[nth] === undefined) { unmatched.push(`${build.key}: recipe names ${JSON.stringify(t)} and the key has ${g.bodies.length} bodies`); continue; }
      const tg = take(g, nth);
      if (tg) gs.push(tg); else unmatched.push(`${build.key}: recipe names ${JSON.stringify(t)} and it was already taken`);
    }
    const bodies = [...new Set(gs.flatMap((x) => x.bodies))].sort((a, b) => a - b);
    chaptersPlan.push({ id: ch.id, label: ch.id, title: ch.title, groups: bodies.length ? [{ key: ch.id, bodies }] : [], notes: ch.notes ?? [] });
  }
  // (3) anything left, as one chapter apiece, last (the probe reports it)
  const leftover = [];
  for (const g of groupsByKey.values()) { const tg = take(g); if (tg) { leftover.push(tg); chaptersPlan.push({ id: `other-${g.key}`, label: 'other', title: `Shaft ${g.key}`, groups: [tg], notes: [], leftover: true }); } }

  // ── THE ORDER OF CHAPTERS. A part that can be slid in from only ONE end of its line (the other end
  // is shut by a frame part) must go in BEFORE whatever stands in its corridor: that part would
  // otherwise have to be passed. Each such pair is an edge between chapters; the chapters are put in
  // the recipe's (or the mesh walk's) order except where an edge says otherwise (a stable
  // topological order; a cycle is kept in the old order and reported).
  const chapterOfPart = new Map();
  chaptersPlan.forEach((c, ci) => { for (const g of c.groups) for (const b of g.bodies) for (const i of partOfBody[b]) chapterOfPart.set(i, ci); });
  const edges = chaptersPlan.map(() => new Set());
  chaptersPlan.forEach((c, ci) => {
    for (const g of c.groups) {
      const idxs = g.bodies.flatMap((b) => partOfBody[b]);
      for (const ax of mountedOf(idxs)) {
        const lanes = (i, ln) => {                              // the sides of part i along ln not shut by a frame part
          const sides = [];
          for (const dir of [ln.u.map((v) => -v), ln.u]) if (!sideReport(i, ln, dir, new Set(), new Set()).frame) sides.push(dir);
          return sides;
        };
        // (the chapters' order reads a part on a line by its ORIGIN, as landing 2 did: a part hung on a line by an
        // off-origin hole — §305's catch — is held, not slid, so it opens no corridor between chapters)
        const items = idxs.filter((i) => parts[i].role !== 'axle' && !CORD_ROLES.includes(parts[i].role) && perpDist(origin(parts[i].m), ax.o, ax.u) < ON_LINE_LDU)
          .map((i) => ({ i, ...extentOn(i, ax) })).filter((x) => overlap(x, ax)).map((x) => x.i);
        for (const q of items) {
          const sides = lanes(q, ax);
          if (!sides.length) continue;                          // shut at both ends: it is lowered, not slid
          // the end it will use is the one with the fewest other chapters' parts in its corridor
          const hits = sides.map((d) => { const box = sweptBox(q, d), hit = []; for (const [r, cj] of chapterOfPart) if (cj !== ci && hitsBox(box, boxCached(r))) hit.push(cj); return hit; });
          const best = hits.reduce((a, b) => (b.length < a.length ? b : a));
          for (const cj of best) edges[ci].add(cj);
        }
      }
    }
  });
  const orderIdx = [], remaining = new Set(chaptersPlan.map((_, k) => k)), cyc = [];
  while (remaining.size) {
    const inc = (k) => [...remaining].filter((j) => j !== k && edges[j].has(k)).length;
    const ready = [...remaining].filter((k) => inc(k) === 0);
    // a cycle (two chapters each in the other's corridor, e.g. interleaved layers) is broken at the
    // chapter with the fewest others still owed before it, earliest first, and reported
    const pick = ready.length ? Math.min(...ready) : (() => { const m = Math.min(...[...remaining].map(inc)); const k = Math.min(...[...remaining].filter((x) => inc(x) === m)); cyc.push(k); return k; })();
    orderIdx.push(pick); remaining.delete(pick);
  }
  const reordered = orderIdx.map((k) => chaptersPlan[k]);
  chaptersPlan.splice(0, chaptersPlan.length, ...reordered);
  const chapterCycles = cyc.length;

  // ── EACH GROUP -> OPS
  const done = new Set(frameIdx);                              // the main model so far, as a set, for the mesh test
  const stepTitleFor = {
    gap: (ps) => `Hold ${countNames(ps)} in the gap between the Technic bricks`,
    thread: (ax, ps) => `Slide the ${nameOf(ax)} through the brick${ps ? `, the held part${ps > 1 ? 's' : ''}` : ''} and the other brick`,
    slide: (ps) => `Slide ${countNames(ps)} onto the axle from its free end`,
    attach: (ps) => `Attach ${countNames(ps)}`,
    place: (ps) => `Place ${countNames(ps)}`,
  };
  const runs = (idxs) => {                                     // consecutive identical (role, part) placements -> one step
    const out = [];
    for (const i of idxs) {
      const last = out[out.length - 1], p = parts[i];
      if (last && parts[last[0]].role === p.role && parts[last[0]].part === p.part && last.length < 4) last.push(i); else out.push([i]);
    }
    return out;
  };
  const chunks = (idxs, n = 4) => { const out = []; for (let k = 0; k < idxs.length; k += n) out.push(idxs.slice(k, k + n)); return out; };
  const noteFor = (idxs, doneSet) => idxs.map((i) => turnNote(i, doneSet)).filter(Boolean);
  const mainStep = (kind, idxs, title, cand, extra = {}) => {
    const notes = noteFor(idxs, done);
    const st = emit({ kind, title, text: title + '.', parts: idxs, cand, notes: notes.map((n) => n.text), meshes: notes.map((n) => ({ part: n.i, partner: n.partner, phi: n.phi })), ...extra });
    for (const i of idxs) done.add(i);
    return st;
  };

  // a sub-assembly: built off the model in steps of its own, then placed whole
  const emitUnit = (subId, title, order, ch, bodyHint, twoLeg = null) => {
    const sub = { id: subId, title, body: bodyHint, parts: order, steps: [] };
    subs.push(sub);
    for (const r of runs(order)) {
      const st = emit({ kind: 'assemble', sub: subId, title: `Sub-assembly, ${stepTitleFor.attach(r.map((i) => parts[i]))}`, text: `Off the model: attach ${countNames(r.map((i) => parts[i]))}.`,
        parts: r, cand: Object.fromEntries(r.map((i) => [i, uniq([...ownAxes(i), DOWN, ...AXES6])])) });
      sub.steps.push(st.n);
    }
    const st = emit({ kind: 'place', places: subId, title: `Place the sub-assembly: ${title}`, text: `Lower the finished sub-assembly (${countNames(order.map((i) => parts[i]))}) into place.`,
      parts: [], unit: order, cand: { unit: uniq([DOWN, ...AXES6]) }, ...(twoLeg ? { twoLeg: { unit: twoLeg } } : {}) });
    for (const i of order) done.add(i);
    sub.place = st.n;
    return sub;
  };

  // §305 (TODO 264) — A GEAR IS NOT LOWERED BETWEEN TWO MESHES. A gear whose mesh partners already in stand on
  // OPPOSITE sides of it (the motion works' 16T between the 8T it meshes and the hour wheel, all three on one line)
  // can only come in tangentially to both at once, which no turn of the chain clears; with one partner in, it comes
  // in across that one mesh. So within a chapter such a gear's group goes in before the group of a partner that the
  // mesh walk had put ahead of it. "Opposite": the two lines of centres more than 120° apart.
  const partnersIn = (i, inSet) => [...inSet].filter((j) => toothed(j) && meshes(i, j));
  const opposed = (i, js) => {
    const c = origin(parts[i].m), d = js.map((j) => norm(sub(origin(parts[j].m), c)));
    return d.some((u, a) => d.some((v, b) => b > a && dot(u, v) < -0.5));
  };
  const absorbed = new Set();                                  // parts a sub-assembly of another chapter carries (§305's riders)
  const prior = new Set(done);                                 // the parts of every earlier chapter
  for (const ch of chaptersPlan) {
    const gs = ch.groups, partsOfG = (g) => g.bodies.flatMap((b) => partOfBody[b]);
    for (let pass = 0; pass < gs.length * gs.length; pass++) {
      let moved = false;
      const before = new Set(prior);
      for (let k = 0; k < gs.length && !moved; k++) {
        for (const i of partsOfG(gs[k]).filter(toothed)) {
          const ps = partnersIn(i, before);
          if (ps.length < 2 || !opposed(i, ps)) continue;
          const h = gs.findIndex((g, n) => n < k && partsOfG(g).some((j) => ps.includes(j)));
          if (h < 0) continue;
          gs.splice(h, 0, gs.splice(k, 1)[0]); moved = true; break;
        }
        for (const j of partsOfG(gs[k])) before.add(j);
      }
      if (!moved) break;
    }
    for (const g of gs) for (const j of partsOfG(g)) prior.add(j);
  }
  for (const ch of chaptersPlan) {
    openChapter(ch.id, ch.title);
    for (const g of ch.groups) {
      const idxs = g.bodies.flatMap((b) => partOfBody[b]).filter((i) => !absorbed.has(i));
      const used = new Set();
      // the mounted axles of this group: each with the bricks it passes through
      const mounted = mountedOf(idxs);
      // A FLOATING AXLE: an axle no brick holds, standing on a mounted axle's line (the fusee's
      // maintaining axle between the cone's and the great wheel's). The joiners at its ends carry it,
      // so it is assembled WITH them, off the model, and lowered between the bricks as one unit
      // before the axles that join it are threaded.
      const floating = idxs.filter((i) => parts[i].role === 'axle' && !mounted.some((m) => m.pieces.some((pc) => pc.i === i)) && mounted.some((m) => onLine(i, m) && parallel(norm(axisX(parts[i].m)), m.u)));
      for (const f of floating) {
        if (used.has(f)) continue;
        const ln = lineOf(f);
        const near = idxs.filter((i) => !used.has(i) && i !== f && parts[i].role !== 'axle' && onLine(i, ln) && overlap({ i, ...extentOn(i, ln) }, ln));
        const body = bodyOf[f];
        const own = partOfBody[body].filter((i) => i !== f && !used.has(i));
        const lineItems = [...new Set([...near, ...own.filter((i) => parts[i].role !== 'axle' && onLine(i, ln))])];
        const offLine = own.filter((i) => !lineItems.includes(i));
        const t = (i) => Math.abs(extentOn(i, ln).tc - (ln.t0 + ln.t1) / 2);
        // §305 (TODO 264): A BODY THAT PIVOTS ON THE UNIT rides in it — the fusee's click pawl, its arm's middle
        // hole on the ratchet's peg. Placed after the unit, its arm had to come onto the peg past the joiner that
        // stands 3.4 mm in front of it (the arm's edge passes 3.8 mm from the axis, the joiner is 4 mm round), so
        // nothing could reach it. In the unit it goes on after its peg and before the JOINERS, which close the
        // unit's ends (whatever rides in their gaps goes on first).
        const pegs = offLine.filter((i) => parts[i].role === 'axle').map(lineOf);
        const riders = [];
        for (let b2 = 0; b2 < partOfBody.length; b2++) {
          if (b2 === body || takenBody.has(`rider${b2}`)) continue;
          const ps = partOfBody[b2];
          if (!ps.length || mountedOf0(ps).length || !ps.some((i) => parts[i].role === 'arm' && pegs.some((pg) => onLine(i, pg)))) continue;
          takenBody.add(`rider${b2}`);
          riders.push(...ps.filter((i) => parts[i].role !== 'axle'), ...ps.filter((i) => parts[i].role === 'axle'));
        }
        for (const i of riders) absorbed.add(i);
        const joiners = lineItems.filter((i) => parts[i].role === 'joiner'), rest0 = lineItems.filter((i) => parts[i].role !== 'joiner');
        const order = riders.length ? [f, ...rest0.sort((a, b) => t(a) - t(b)), ...offLine, ...riders, ...joiners.sort((a, b) => t(a) - t(b))]
          : [f, ...lineItems.sort((a, b) => t(a) - t(b)), ...offLine];
        for (const i of order) used.add(i);
        emitUnit(`${build.key}-${ch.id}-line${f}`, `${ch.title}: the ${nameOf(parts[f])} on its joiners${riders.length ? `, with ${countNames(riders.filter((i) => parts[i].role !== 'axle').map((i) => parts[i]))} on its peg` : ''}`, order, ch, body);
      }
      // PLAN each mounted axle's work — which parts are held in the gap, threaded and slid on — before any is
      // emitted, so the works can be put in an order (§305, below).
      const works = [];
      const thrBlocked = (ax, dir) => { const sw = sweptBox(ax.i, dir); return frameIdx.some((j) => parts[j].role !== 'baseplate' && !ax.br.some((b) => b.i === j) && hitsBox(sw, boxCached(j))); };
      for (const ax of mounted) {
        // the parts threaded on this axle: on its line, overlapping its span
        const items = idxs.filter((i) => !used.has(i) && parts[i].role !== 'axle' && !CORD_ROLES.includes(parts[i].role) && onLine(i, ax))
          .map((i) => ({ i, ...extentOn(i, ax) })).filter((x) => overlap(x, ax));
        // enclosed between bricks on the line -> held in the gap; else it slides on from the free end
        // (each side judged on the part's whole footprint dragged along the line, not on the line alone)
        // (§305: a side shut by the part's own group is shut too: groupShut)
        const entry = new Map();
        for (const x of items) {
          const lo = sideReport(x.i, ax, ax.u.map((v) => -v), new Set()), hi = sideReport(x.i, ax, ax.u, new Set());
          if (groupShut(idxs, x.i, ax, ax.u.map((v) => -v))) lo.frame = true;
          if (groupShut(idxs, x.i, ax, ax.u)) hi.frame = true;
          const open = [[-1, lo], [1, hi]].filter(([, r]) => !r.frame).sort((a, b) => a[1].others - b[1].others);
          entry.set(x.i, open.length ? open[0][0] : 0);          // -1: enters from the low end, +1 from the high end, 0: neither
        }
        const travels = (x) => Math.abs(parts[x.i].slide?.[mode] ?? 0) > 1e-9;            // a part that slides on its shaft between modes (the ring) goes in last
        const gap = items.filter((x) => entry.get(x.i) === 0).sort((a, b) => (travels(a) - travels(b)) || (a.tc - b.tc)).map((x) => x.i);
        const fromLow = items.filter((x) => entry.get(x.i) === -1).sort((a, b) => b.tc - a.tc).map((x) => x.i);   // nearest the bricks first
        const fromHigh = items.filter((x) => entry.get(x.i) === 1).sort((a, b) => a.tc - b.tc).map((x) => x.i);
        for (const x of [...gap, ...fromLow, ...fromHigh]) used.add(x);
        for (const pc of ax.pieces ?? [ax]) used.add(pc.i);
        // §305 (TODO 264): an axle SHUT AT BOTH ENDS by frame parts on its line (the escape arbor, between the two
        // knife stacks) cannot be threaded from either. It is lowered into the free length of its line beside its
        // bricks, then slid along the line through them — carrying the held parts that stand OUTSIDE its bricks on
        // the side it comes from (the escape wheel in front of its columns: they are put on it off the model, a
        // sub-assembly), while those between the bricks are held as ever. The slide is the least that puts the
        // lowered axle's leading end clear of its first brick, and the lowered unit must fit between the frame
        // parts that shut its line; both read off the placements, never chosen.
        let carry = null;
        if (ax.pieces.length === 1 && thrBlocked(ax, ax.u) && thrBlocked(ax, ax.u.map((v) => -v))) {
          const bl = Math.min(...ax.br.map((b) => b.t - b.half)), bh = Math.max(...ax.br.map((b) => b.t + b.half));
          const walls = ax.blk.filter((bk) => !ax.br.some((b) => b.i === bk.i));
          const opts = [];
          for (const sg of [1, -1]) {
            const out = gap.filter((i) => { const e = extentOn(i, ax); return sg > 0 ? e.e1 <= bl + 1e-6 : e.e0 >= bh - 1e-6; });
            const inner = gap.filter((i) => !out.includes(i)).map((i) => extentOn(i, ax));
            const s2 = sg > 0 ? ax.t1 - Math.min(bl, ...inner.map((e) => e.e0)) : Math.max(bh, ...inner.map((e) => e.e1)) - ax.t0;
            const ext = [[ax.t0, ax.t1], ...out.map((i) => { const e = extentOn(i, ax); return [e.e0, e.e1]; })];
            const lo = Math.min(...ext.map((e) => e[0])) - (sg > 0 ? s2 : -s2), hi = Math.max(...ext.map((e) => e[1])) - (sg > 0 ? s2 : -s2);
            const fits = walls.every((w2) => w2.hi <= lo + 1e-6 || w2.lo >= hi - 1e-6) && !walls.some((w2) => w2.lo < hi - 1e-6 && w2.hi > lo + 1e-6);
            if (fits) opts.push({ sg, s: s2, out });
          }
          opts.sort((a, b) => a.s - b.s);
          if (opts.length) { const o = opts[0]; carry = { parts: o.out, d2: ax.u.map((v) => v * o.sg), s: o.s }; gap.splice(0, gap.length, ...gap.filter((i) => !o.out.includes(i))); }
        }
        // §305 (TODO 264): PINS IN A HELD PART go in with it. A pin pressed into a part held in the gap (the alarm's
        // release disc: a pin in each end hole of its front beam, a long pin in its back beam) sticks out of it
        // along the axle; once the part is held and the axle through, every way along the pin's own axis meets the
        // frame or the work's own parts (the rotors in front, the disc's 24T and the column behind). So the pins
        // are pressed in OFF the model and the part lowered with them, as a nest is. Each pin's host is the held
        // part its box overlaps most.
        const hosted = new Map();
        const vol = (a, b) => [0, 1, 2].reduce((v, k) => v * Math.max(0, Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k])), 1);
        for (const i of idxs) {
          if (used.has(i) || parts[i].role !== 'pin' || onLine(i, ax)) continue;
          let best = null, bv = 0;
          for (const j of gap) { const v = vol(boxCached(i), boxCached(j)); if (v > bv) { bv = v; best = j; } }
          if (best === null) continue;
          if (!hosted.has(best)) hosted.set(best, []);
          hosted.get(best).push(i); used.add(i);
        }
        works.push({ kind: 'axle', ax, items, gap, fromLow, fromHigh, carry, hosted });
      }
      // what is left, body by body
      for (const b of g.bodies) {
        const rest = partOfBody[b].filter((i) => !used.has(i) && !absorbed.has(i));
        if (rest.length) works.push({ kind: 'body', b, rest, hosted: partOfBody[b].some((i) => used.has(i)) });
      }
      // ── THE ORDER OF WORKS IN A GROUP (§305, TODO 264). The chapters' corridor rule, one level down: a work
      // whose part comes in along a corridor (a held part or a lowered body from above, a slid part from its free
      // end, an axle from the end it threads from) goes in BEFORE a work with a part standing in that corridor.
      // Landing 2 took them in placement order, which slid the keyless detent wheel on behind the follower's arm
      // and lowered the rack under a pinion already meshed above it. A cycle keeps the old order.
      const UP = DOWN.map((v) => -v);
      const lanesOf = (w) => w.kind === 'body' ? w.rest.map((i) => [i, UP])
        : [...w.gap.map((i) => [i, UP]), ...w.fromLow.map((i) => [i, w.ax.u.map((v) => -v)]), ...w.fromHigh.map((i) => [i, w.ax.u]),
          ...(w.ax.pieces ?? [w.ax]).map((pc) => [pc.i, [pc.u.map((v) => -v), pc.u].find((d) => !thrBlocked(pc, d.map((v) => -v))) ?? UP])];
      const partsOf = (w) => w.kind === 'body' ? w.rest : [...(w.ax.pieces ?? [w.ax]).map((pc) => pc.i), ...w.gap, ...w.fromLow, ...w.fromHigh];
      const wEdges = works.map((w) => new Set(works.flatMap((v, k) => (v !== w && lanesOf(w).some(([i, from]) => partsOf(v).some((j) => hitsAnyMode(i, from, j))) ? [k] : []))));
      // a HOSTED body's rest (the follower's axle and bush in its arm's far hole) goes in after the work that puts
      // its host in (the arm, held and threaded on the pivot)
      works.forEach((w, k) => { if (w.kind === 'body' && w.hosted) works.forEach((v, j) => { if (v !== w && partsOf(v).some((i) => bodyOf[i] === w.b)) wEdges[j].add(k); }); });
      const wOrder = [], wLeft = new Set(works.map((_, k) => k));
      while (wLeft.size) {
        const inc = (k) => [...wLeft].filter((j) => j !== k && wEdges[j].has(k)).length;
        const ready = [...wLeft].filter((k) => inc(k) === 0);
        const pick = ready.length ? Math.min(...ready) : Math.min(...wLeft);
        wOrder.push(pick); wLeft.delete(pick);
      }
      for (const w of wOrder.map((k) => works[k])) {
        if (w.kind === 'body') {
          const { b, rest, hosted } = w;
          if (hosted || rest.length === 1) {
            // §305: an axle among the rest goes in AFTER the parts on its own line (it is pushed through its host's
            // hole and them, as through a brick and a held part — the follower's bush sits between the arm and
            // the detent wheel, where nothing slides onto its axle's end)
            const axl = rest.filter((i) => parts[i].role === 'axle').map(lineOf);
            const onAx = (i) => parts[i].role !== 'axle' && axl.some((ln) => onLine(i, ln));
            const ordered = [...rest.filter(onAx), ...rest.filter((i) => !onAx(i))];
            for (const r of runs(ordered)) mainStep(hosted ? 'attach' : 'part', r, (hosted ? stepTitleFor.attach : stepTitleFor.place)(r.map((i) => parts[i])),
              Object.fromEntries(r.map((i) => [i, uniq([...ownAxes(i), DOWN, ...AXES6])])));
            continue;
          }
          // a UNIT: assembled off the model, axles first, then placed whole. §305: then every ARM, then the rest
          // in placement order — a pin joins the arms it passes through, so both arms are on before any pin (the
          // balance's −u pallet arm went on after the +u arm's pin, which closed its way in from every side).
          // And the arms go on IN ORDER ALONG THE AXLES (the first axle's direction), so none is shut between two
          // already on (the balance's −u pallet arm sits between the anchor's drop and the +u pallet arm).
          const axl = rest.filter((i) => parts[i].role === 'axle'), d = axl.length ? norm(axisX(parts[axl[0]].m)) : DOWN;
          const arms = rest.filter((i) => parts[i].role === 'arm').sort((a, b) => dot(origin(parts[b].m), d) - dot(origin(parts[a].m), d));
          const order = [...axl, ...arms, ...rest.filter((i) => parts[i].role !== 'axle' && parts[i].role !== 'arm')];
          emitUnit(`${build.key}-${String(keyOf(b)).replace(/\W+/g, '-')}-b${b}`, `${ch.title}: ${String(keyOf(b))}`, order, ch, b);
          continue;
        }
        const { ax, items, gap, fromLow, fromHigh } = w;
        // a part that travels along its shaft between modes sits at the mode's end of its travel: it can be
        // lowered at the neutral place and slid there (the ring into a clutch gear's recess)
        const twoLegFor = (i) => { const sl = parts[i].slide?.[mode] ?? 0; return Math.abs(sl) > 1e-9 ? [{ d1: DOWN, d2: [0, 0, Math.sign(sl)], s: Math.abs(sl) }] : []; };   // placedParts adds the slide to the world Z
        // NESTED parts — extents overlapping along the line, a ring over a joiner — cannot go in one
        // after the other: the outer is slid over the inner OFF the model, and the pair is lowered whole.
        // (§305: a part that travels between modes is nested where it stands at NEUTRAL — its slide taken off — so
        // every mode nests and orders alike; in set the ring had stood in the setting gear's recess and was nested
        // with the gear instead of its joiner, and that unit could not go in)
        const ext = new Map(items.map((x) => { const d = (parts[x.i].slide?.[mode] ?? 0) * ax.u[2]; return [x.i, { ...x, e0: x.e0 - d, e1: x.e1 - d }]; }));
        const nests = [];
        for (const i of gap) {
          const x = ext.get(i), hit = nests.find((g2) => g2.some((j) => { const y = ext.get(j); return Math.min(x.e1, y.e1) - Math.max(x.e0, y.e0) > THROUGH_OVERLAP_LDU; }));
          if (hit) hit.push(i); else nests.push([i]);
        }
        const radius = (i) => { const b = bnd(parts[i].part), p = parts[i]; let r = 0; for (const [k, a] of [axisX(p.m), axisY(p.m), axisZ(p.m)].entries()) if (!parallel(a, ax.u)) r = Math.max(r, Math.abs(b.lo[k]), Math.abs(b.hi[k])); return r; };
        // the unit whose ring travels into a gear's recess goes in AFTER the gear it engages, so that the ring can be slid in
        const travelling = (g2) => g2.some((i) => Math.abs(parts[i].slide?.[mode] ?? 0) > 1e-9);
        nests.sort((x, y) => travelling(x) - travelling(y));
        // (§305: and a held unit is lowered BEFORE one standing in the space above it — the alarm disc's back beam
        // carries a long pin forward past the front beam's side, which in some states hangs under the front beam)
        {
          const UPd = DOWN.map((v) => -v), withPins = (g2) => [...g2, ...g2.flatMap((i) => w.hosted.get(i) ?? [])];
          const under = (x, y) => !travelling(x) && !travelling(y) && withPins(x).some((i) => withPins(y).some((j) => hitsAnyMode(i, UPd, j)));   // (a travelling unit keeps its own rule, above)
          const left = [...nests], out = [];
          while (left.length) { const k = left.findIndex((x) => !left.some((y) => y !== x && under(y, x))); out.push(...left.splice(k < 0 ? 0 : k, 1)); }
          nests.splice(0, nests.length, ...out);
        }
        let pend = [];
        const flush = () => { for (const r of chunks(pend)) mainStep('gap', r, stepTitleFor.gap(r.map((i) => parts[i])),
          Object.fromEntries(r.map((i) => [i, uniq([DOWN, ...radialAway(i, done), ...AXES6])])), { carrier: ax.i, twoLeg: Object.fromEntries(r.map((i) => [i, twoLegFor(i)])) }); pend = []; };
        for (const g2 of nests) {
          if (g2.length === 1 && w.hosted.has(g2[0])) {
            flush();
            const order = [g2[0], ...w.hosted.get(g2[0])];
            emitUnit(`${build.key}-${ch.id}-pins${g2[0]}`, `${ch.title}: ${countNames(order.map((i) => parts[i]))}, the pins pressed in`, order, ch, bodyOf[g2[0]]);
            continue;
          }
          if (g2.length === 1) { pend.push(g2[0]); continue; }
          flush();
          const order = g2.sort((a, b) => radius(a) - radius(b));
          const tl = order.filter((i) => Math.abs(parts[i].slide?.[mode] ?? 0) > 1e-9).flatMap((i) => twoLegFor(i).map((t) => ({ ...t, members: [i] })));
          emitUnit(`${build.key}-${ch.id}-nest${order[0]}`, `${ch.title}: ${countNames(order.map((i) => parts[i]))}, one slid over the other`, order, ch, bodyOf[order[0]], tl.length ? tl : null);
        }
        flush();
        // the axle goes in from the end its footprint finds clear (its own bricks are the holes it passes); an axle in
        // pieces, each piece from its own end, until it meets the web of the part they join
        if (w.carry) {
          const { carry } = w, order = [ax.i, ...carry.parts];
          const sub = emitUnit(`${build.key}-${ch.id}-arbor${ax.i}`, `${ch.title}: ${countNames(order.map((i) => parts[i]))}, lowered beside its bricks`, order, ch, bodyOf[ax.i],
            [{ d1: DOWN, d2: carry.d2, s: carry.s, members: order }]);
          const pl = steps[sub.place - 1];
          pl.text = `Both ends of the axle's line are shut by the frame, so lower the finished sub-assembly (${countNames(order.map((i) => parts[i]))}) beside its bricks and slide it ${(carry.s * LDU_MM_STEPS).toFixed(1)} mm along its line through them.`;
        }
        for (const pc of w.carry ? [] : ax.pieces ?? [ax]) {
          const thrOthers = (dir) => { const sw = sweptBox(pc.i, dir); let n = 0; for (const j of done) if (j >= nStatic && j !== pc.i && perpDist(origin(parts[j].m), pc.o, pc.u) >= ON_LINE_LDU && hitsBox(sw, boxCached(j))) n++; return n; };
          const ends = [pc.u, pc.u.map((v) => -v)].map((d) => ({ d, b: thrBlocked(pc, d), n: thrOthers(d) })).sort((a, b) => (a.b - b.b) || (a.n - b.n));
          const many = (ax.pieces?.length ?? 1) > 1;
          const joinedBy = many ? gap.find((i) => { const e = extentOn(i, ax), m = extentOn(pc.i, ax); return e.e0 < m.e1 && e.e1 > m.e0 && parts[i].role === 'joiner'; }) : undefined;
          const title = many ? `Slide the ${nameOf(parts[pc.i])} through its brick${gap.length ? ' and the held parts' : ''} into the ${joinedBy !== undefined ? nameOf(parts[joinedBy]) : 'part that joins the pieces'}, up to the web in its middle`
            : stepTitleFor.thread(parts[pc.i], gap.length);
          mainStep('thread', [pc.i], title, { [pc.i]: ends.map((e) => e.d) }, { carrier: pc.i, bricks: pc.br.map((b) => b.i) });
        }
        for (const [dir, list] of [[1, fromLow], [-1, fromHigh]]) if (list.length) for (const r of chunks(list)) {
          const inward = ax.u.map((v) => v * dir);               // slid on from the free end, toward the bricks
          mainStep('slide', r, stepTitleFor.slide(r.map((i) => parts[i])), Object.fromEntries(r.map((i) => [i, uniq([inward, inward.map((v) => -v)])])), { carrier: ax.i });
        }
      }
    }
    // notes: steps that add no part
    for (const nt of ch.notes) emit({ kind: 'note', title: nt.posed ? 'Posed, not measured' : 'Not in the model', text: nt.text, parts: [], posed: !!nt.posed });
  }

  // ── THE STRING, last: a flexible cord is laid by hand, not slid, and is not swept.
  if (cordIdx.length) {
    openChapter('string', 'The string');
    const st = emit({ kind: 'string', title: 'Lay the string', flexible: true, parts: cordIdx,
      text: 'Hook one end on the barrel, wind it up the cone one wrap a step and hook the other end. The model places it as straight segments and two end studs; the part to buy is one string.',
      cand: {} });
    for (const i of cordIdx) done.add(i);
    void st;
  }

  // ── THE END
  openChapter('done', 'Finished');
  emit({ kind: 'final', title: 'Modelled, not built', parts: [], text: HONESTY.modelled });

  const rolesPosed = build.key === 'fusee' || build.key === 'alarm' || build.key === 'escapement';
  return { key: build.key, gen: build.gen, mode, build, parts, bodyOf, steps, chapters, subs, unmatched,
    leftover: leftover.map((g) => String(g.key)), posedForces: rolesPosed || steps.some((s) => s.posed), chapterCycles };
}

// Do two placements mesh (two toothed parts of different bodies, coplanar, at their pitch distance)?
// The test the derivation uses, for a validator that must turn a meshed chain.
export function meshing(plan, a, b) {
  const pa = plan.parts[a], pb = plan.parts[b];
  if (!pa.teeth || !pb.teeth || plan.bodyOf[a] === plan.bodyOf[b] || !parallel(axisZ(pa.m), axisZ(pb.m))) return false;
  const u = axisZ(pa.m), d = sub(origin(pb.m), origin(pa.m)), ax = dot(d, u);
  if (Math.abs(ax) > MESH_COPLANAR_LDU) return false;
  return Math.abs(Math.hypot(...sub(d, u.map((v) => v * ax))) - (pa.teeth + pb.teeth) * LDU_PER_TOOTH) < MESH_SLACK_LDU;
}

// Counts for a report.
export function planCounts(plan) {
  const adds = plan.steps.filter((s) => s.parts.length);
  return { steps: plan.steps.length, partSteps: adds.length, notes: plan.steps.filter((s) => s.kind === 'note').length, chapters: plan.chapters.length, subs: plan.subs.length,
    placements: plan.parts.length };
}

// ---------------------------------------------------------------------------
// THE .MPD. One file, the main model first, a `0 FILE` per sub-assembly; `0 STEP` after each step.
// A sub-assembly's placements keep their WORLD matrices (the sub-model is placed at the identity), so
// flattening it back is exact: every line of a flattened .mpd is a line the .ldr carries.
const fmt = (v) => String(Math.round(v * 1e4) / 1e4);
export const partLine = (p) => `1 ${colourOf(LDRAW_COLOUR, p.role, p.part) ?? 16} ${p.m.map(fmt).join(' ')} ${p.part}.dat`;
const IDENT = '0 0 0 1 0 0 0 1 0 0 0 1';
const subFile = (plan, s) => `${s.id}.ldr`;
const comment = (s) => `0 // ${s}`;
export function toMpd(plan) {
  const name = `${plan.gen}-${plan.key.replace(/\W+/g, '-')}${plan.build.modes?.length > 1 ? `-${plan.mode}` : ''}`;
  const out = [`0 FILE ${name}.mpd`, `0 timesim technic fork — ${plan.gen} ${plan.key}${plan.build.modes?.length > 1 ? ` (${plan.mode})` : ''}, build steps`, `0 Name: ${name}.mpd`,
    '0 Author: src/technic-steps.js (derived from src/technic-frame.js)', '0 !LICENSE parts: LDraw.org, CC BY 4.0', comment(HONESTY.modelled)];
  if (plan.posedForces) out.push(comment(HONESTY.posed));
  const subOf = new Map(plan.subs.map((s) => [s.id, s]));
  let chap = null;
  const files = [];
  for (const st of plan.steps) {
    if (st.chapter !== chap && !st.sub) { chap = st.chapter; out.push('', comment(`chapter: ${plan.chapters.find((c) => c.id === chap)?.title ?? chap}`)); }
    if (st.sub) continue;                                      // a sub-assembly's steps live in its own file
    out.push(comment(`step ${st.n}: ${st.title}`));
    if (st.places) { const s = subOf.get(st.places); out.push(`1 16 ${IDENT} ${subFile(plan, s)}`); }
    else for (const i of st.parts) out.push(partLine(plan.parts[i]));
    for (const n of st.notes) out.push(comment(n));
    if (st.kind === 'note') out.push(comment(st.text));
    out.push('0 STEP');
  }
  for (const s of plan.subs) {
    files.push('', `0 FILE ${subFile(plan, s)}`, `0 Name: ${subFile(plan, s)}`, comment(`sub-assembly: ${s.title}`));
    for (const n of s.steps) { const st = plan.steps[n - 1]; files.push(comment(`step: ${st.title}`)); for (const i of st.parts) files.push(partLine(plan.parts[i])); files.push('0 STEP'); }
  }
  return [...out, ...files, ''].join('\n');
}

// Reading an .mpd back: { files: Map(name -> { steps: [[ {color, m, file} ]] , comments }) , main }. A step ends at `0 STEP`; the
// trailing group (parts after the last STEP) is kept if non-empty so a file with no final STEP still parses.
export function parseMpd(text) {
  const files = new Map(); let cur = null, order = [];
  const close = () => { if (cur && cur.cur.length) cur.steps.push(cur.cur); if (cur) cur.cur = []; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const t = line.split(/\s+/);
    if (t[0] === '0' && t[1] === 'FILE') { close(); cur = { name: t.slice(2).join(' ').toLowerCase(), steps: [], cur: [], comments: [] }; files.set(cur.name, cur); order.push(cur.name); continue; }
    if (!cur) continue;
    if (t[0] === '0' && t[1] === 'STEP') { cur.steps.push(cur.cur); cur.cur = []; continue; }
    if (t[0] === '0') { cur.comments.push(line); continue; }
    if (t[0] === '1') { const n = t.slice(1).map(Number); cur.cur.push({ color: n[0], m: n.slice(1, 13), file: t.slice(14).join(' ').toLowerCase(), line }); }
  }
  close();
  return { files, main: order[0], order };
}
// Every part line of the model after its sub-assemblies are expanded in place (identity placement only), in
// the order the steps put them.
export function flattenMpd(parsed, name = parsed.main) {
  const out = [], f = parsed.files.get(name);
  if (!f) throw new Error(`mpd: no file ${name}`);
  for (const step of f.steps) for (const l of step) {
    if (parsed.files.has(l.file)) {
      if (l.color !== 16 || l.m.join(' ') !== IDENT.split(' ').map(Number).join(' ')) throw new Error(`mpd: ${l.file} is not placed at the identity`);
      out.push(...flattenMpd(parsed, l.file));
    } else out.push(l.line);
  }
  return out;
}
