// IS THE LEGO GOING TRAIN ONE TRAIN, FROM THE FUSEE'S GREAT WHEEL TO THE BALANCE: ITS COUNTS THE ROWS', ITS PLACE
// THE SOLVE'S, EVERY MESH ON THE LATTICE AND PHASED, EVERY PART SEATED AND CLEAR, AND EVERY ANGLE CARRIED FROM ONE
// STATE THROUGH THE TEETH? Acceptance, pure Node, no browser, no network; exits non-zero on any failed row.
// BUILT §312 (src/technic-train.js, technic.html's ninth cell). Per generation:
//
//   · CHAIN — the meshes are FUSEE_CENTRE's and TECHNIC_FORK's two rows, read and never typed: the centre→fourth
//     row as declared, the fourth→escape row's two meshes the other way round, its product unchanged, its last
//     driven gear the escape wheel's count at a whole number of plates; the ratio from the great wheel to the escape
//     wheel is the product of the PLACED parts' tooth counts (read off the build's mesh list) and equals the
//     steel train's three targets, the centre pinion's 5 × technicForkTargets()' 60 × 15/2.
//   · RATE — one escape tooth a period: the fourth turns once a minute and the centre once an hour at the row's
//     1 s; the great wheel once in five hours; the going time a wind is the cone's run (coneTurnTotal, the POSED
//     stand-in table) through that ratio — printed at 1 s and at the balance's solved period.
//   · SOLVE — solveTrain re-searched; TECHNIC_TRAIN is the first of its ranking whose derived step order the
//     swept insertion (technic-steps-sweep.mjs) clears, every train ranked above it flagged; and the frame's
//     findings (trainFindings: the solve's own clearance law over every pair, the drive's way in, every mesh at its
//     centre distance in one layer, the hole heights) are empty.
//   · BUILD — SEATED (every static's underside on the baseplate's top or on the top face of a static under it, a
//     bottom part on the stud grid, a jumper's centre on a half stud), THROUGH (each new or moved arbor — the centre,
//     every train arbor, the escape arbor — has two Technic bricks on its line and its axle fills both; the drive its
//     knife's brick and its escape columns', two or three),
//     ON THE AXLE (each gear's bore on its axle's line, inside its span), MESHED (every mesh in the build's list,
//     each gear's tooth angle measured off its placed geometry at five turns of the great wheel), the MODULES
//     unchanged (every fusee placement is fuseeBuild's but the centre's axle and its new driver; every escapement
//     placement is escapementBuild's carried to its place), and THE FILE (.ldr parsed back).
//   · STATE (standing rule 2) — trainPose at times across a beat, a minute, an hour and past a run-down: every mesh
//     phased at the posed angles, the great wheel the same angle read two ways (the train's speed and the fusee's
//     loop), the escape wheel one tooth on per period, the great wheel 2π/(ratio × teeth) on per period.
//   · CLEAR — every placed part's sampled surface (cloudGap) a CLEAR_LDU off every part it does not bear on, at
//     three poses; bearing by design and skipped: a body's own parts, an axle in a Technic brick on its line, a
//     meshing pair, a turning part flush on its own line's column, an axle's end flush on a frame block on its own
//     line (the solve's law, reported), and — the rows' law, reported — a train part on
//     a neighbour's column.
//   · ESCAPEMENT — §287's, raised: the period read off the train's balance equals the standalone balance's, and
//     the cycle the train drives (its sense) escapes one tooth a period with the lock over F2's play.
//
// CONTROLS, each seen to fail: a placed gear one tooth off (the ratio); half a pitch on each driven train body
// (MESHED); a Technic brick lifted a plate (SEATED); an arbor posed by itself, a third of a pitch off its law
// (STATE); a 1×1 brick half a clearance off the drive's driven gear (CLEAR); the layout's drive moved a lattice step (the
// solve's answer and the findings).
//
//   node tools/probe-technic-train.mjs [technic_classic|technic_2026]
import { bounds, walk, placements, compose, LDU_MM } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { CATALOGUES, TECHNIC_FORK, TECHNIC_ESCAPE_TEETH, technicForkTargets, ratQ, ratMul, ratEq, ratStr } from '../src/layout.js';
import { FRAME_PARTS, LEGO_DIM_MM, GEAR_WIDTH_MM } from '../src/technic-frame.js';
import { placedParts, toLdr, placedCloud, cloudGap } from '../src/technic-ldraw.js';
import { TECHNIC_FUSEE_SPRING, solveFusee, fuseeBuild, fuseeLoopModel, coneTurnTotal, FUSEE_CENTRE } from '../src/technic-fusee.js';
import { frameEscapement, escapementBuild, cycleModel, beatMeasures, escapementModel, escSpec, framedBalance, balanceMoments, TECHNIC_ESCAPEMENT,
  BEAT_PERIOD_S, ESC_SWING_DEG, F2_PLAY_MM } from '../src/technic-escapement.js';
import { deriveSteps } from '../src/technic-steps.js';
import * as SW from './technic-steps-sweep.mjs';
import { trainChain, frameTrain, trainBuild, trainFindings, trainContacts, solveTrain, trainModel, trainPose, goingTime, TECHNIC_TRAIN, TRAIN_CLEAR } from '../src/technic-train.js';

const lib = loadPack();
const only = process.argv[2] ?? null;
const GENS = Object.keys(CATALOGUES).filter((g) => CATALOGUES[g] && (!only || g === only));
const run = solveFusee(TECHNIC_FUSEE_SPRING).best;
const D_AXLE_R = LEGO_DIM_MM.axleR;   // an axle's cross section (its end face meets a block across all of it)
const EPS = 1e-6, PHASE_TOL = 1e-3, CLEAR_LDU = TRAIN_CLEAR / LDU_MM, TAU = 2 * Math.PI;
const L = (mm) => mm / LDU_MM;
const near = (a, b, t = EPS) => Math.abs(a - b) <= t;
const mod = (a, m) => ((a % m) + m) % m;
const dat = (p) => `${p}.dat`;
let fails = 0;
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const controls = [];
const control = (name, caught) => controls.push([name, !!caught]);
const bc = new Map();
const Bx = (p) => (bc.has(p) || bc.set(p, bounds(lib, dat(p))), bc.get(p));
const hr = (s) => `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')} min`;

// a gear's tooth angle about LDraw Z as placed: its tips folded by N (probe-technic-build's reading)
const tipCache = new Map();
function tips(part) {
  if (tipCache.has(part)) return tipCache.get(part);
  const pts = []; let r = 0;
  walk(lib, dat(part), (k, ps) => { if (k === 'tri') for (const p of ps) { pts.push(p); r = Math.max(r, Math.hypot(p[0], p[1])); } });
  const out = pts.filter((p) => Math.hypot(p[0], p[1]) > r - 1e-6); tipCache.set(part, out); return out;
}
function placedPhase(p) {
  let c = 0, s = 0;
  for (const q of tips(p.part)) {
    const x = p.m[3] * q[0] + p.m[4] * q[1] + p.m[5] * q[2], y = p.m[6] * q[0] + p.m[7] * q[1] + p.m[8] * q[2];
    const a = p.teeth * Math.atan2(y, x); c += Math.cos(a); s += Math.sin(a);
  }
  return Math.atan2(s, c) / p.teeth;
}
// the build with every body at an angle (`phi[k]`, null keeps the build's)
const posed = (b, phi) => ({ ...b, shafts: b.shafts.map((s, k) => (phi[k] === null || phi[k] === undefined ? s : { ...s, phi: phi[k], speed: 0 })) });
const bodyParts = (b, k, u = 0) => placedParts({ ...b, statics: [], shafts: [b.shafts[k]] }, u);
function meshResidues(b, u = 0) {
  return b.meshes.map((m) => {
    const a = bodyParts(b, m.a, u)[m.ga], c = bodyParts(b, m.b, u)[m.gb];
    if (!a?.teeth || !c?.teeth || !near(a.m[2], c.m[2], 1e-4)) return { m, w: Infinity, why: 'no coplanar pair' };
    const al = Math.atan2(c.m[1] - a.m[1], c.m[0] - a.m[0]);
    const r = mod(a.teeth * (placedPhase(a) - al) + c.teeth * (placedPhase(c) - al - Math.PI) - Math.PI, TAU) / TAU;
    const d = Math.hypot(c.m[0] - a.m[0], c.m[1] - a.m[1]) * LDU_MM;
    return { m, w: Math.min(r, 1 - r), d, want: (a.teeth + c.teeth) / 2 };
  });
}

console.log('THE LEGO GOING TRAIN — the fusee\'s great wheel to the knife-edge balance, one build\n');
const standalone = balanceMoments(lib, framedBalance(frameEscapement(), lib));
for (const gen of GENS) {
  console.log(`${gen}:`);
  // ── CHAIN
  const chain = trainChain(gen);
  if (!chain.ok) { fail(`${gen}: ${chain.reason}`); continue; }
  const rows = Object.fromEntries(TECHNIC_FORK.rows.map((r) => [r.key, r.chains[gen]]));
  const pairs = (key) => chain.meshes.filter((m) => m.row === key).map((m) => [m.ta, m.tb]);
  if (JSON.stringify(pairs('centre→fourth')) !== JSON.stringify(rows['centre→fourth'])) fail('the centre→fourth meshes are not the row as declared');
  const esc = pairs('fourth→escape'), decl = rows['fourth→escape'];
  if (JSON.stringify([...esc].sort()) !== JSON.stringify([...decl].sort()) || !chain.escRowHeld) fail('the fourth→escape meshes are not the row\'s, or their product moved');
  const last = chain.meshes[chain.meshes.length - 1];
  if (last.tb !== TECHNIC_ESCAPE_TEETH || !near(last.cd / 3.2, Math.round(last.cd / 3.2))) fail(`the last mesh ${last.ta}:${last.tb} does not end on the ${TECHNIC_ESCAPE_TEETH}T at whole plates`);
  if (JSON.stringify(pairs('great→centre')) !== JSON.stringify([[40, FUSEE_CENTRE.teeth]])) fail('the first mesh is not the great wheel into FUSEE_CENTRE');
  const T = technicForkTargets(), want = ratMul(ratMul(ratQ(40, FUSEE_CENTRE.teeth), T['centre→fourth']), T['fourth→escape']);
  if (!ratEq(chain.product, want)) fail(`the chain multiplies to ${ratStr(chain.product)}, the steel targets to ${ratStr(want)}`);
  console.log(`  CHAIN ${chain.meshes.map((m) => `${m.ta}:${m.tb}`).join(' × ')} = ${ratStr(chain.product)} (the targets: 5 × ${ratStr(T['centre→fourth'])} × ${ratStr(T['fourth→escape'])}); the escape row as ${esc.map(([a, c]) => `${a}:${c}`).join(' × ')}, declared ${decl.map(([a, c]) => `${a}:${c}`).join(' × ')}`);

  // ── SOLVE AND FRAME
  const t0 = Date.now(), sol = solveTrain(gen, lib, { run });
  const decl2 = TECHNIC_TRAIN[gen], same = (p, q) => JSON.stringify(p) === JSON.stringify(q);
  // THE ANSWER: the first of the solve's ranking whose derived build order clears the swept-insertion validator
  // (tools/technic-steps-sweep.mjs, which needs three.js and so is a tool's, not the solve's)
  const rank = sol.ranked.findIndex((r) => same(r.layout, decl2));
  const goesTogether = (layout) => { const bb = trainBuild(frameTrain(gen, layout), lib, { run }), plan = deriveSteps(bb, { lib }); return SW.validatePlan(plan, lib).flagged === 0; };
  if (!sol.best) fail(`no train framed (${JSON.stringify(sol.stats)})`);
  else if (rank < 0) fail(`TECHNIC_TRAIN is not among the solve's ${sol.ranked.length} framed trains`);
  else {
    for (let i = 0; i < rank; i++) if (goesTogether(sol.ranked[i].layout)) fail(`the solve's #${i + 1} goes together too, and ranks before TECHNIC_TRAIN`);
    if (!goesTogether(decl2)) fail('TECHNIC_TRAIN\'s build order does not clear the swept insertion');
  }
  const frame = frameTrain(gen);
  if (!frame.framed) { fail(`not framed: ${frame.reason}`); continue; }
  const findings = trainFindings(frame, lib, { run });
  for (const f of findings) fail(f);
  const contacts = trainContacts(frame, lib, { run });
  console.log(`  SOLVE ${sol.stats.tried} placements tried, ${sol.ranked.length} framed (${sol.stats.pruned} branches bounded); TECHNIC_TRAIN is #${rank + 1}, the first whose build order the swept insertion clears (${rank} before it flagged), in ${((Date.now() - t0) / 1000).toFixed(0)} s: `
    + `${frame.arbors.map((a) => `${a.key} (${a.x}, ${a.z})`).join(', ')}, the drive (${frame.drive.x}, ${frame.drive.z}), the escape arbor ${frame.zE} mm up, the escapement ${frame.o > 0 ? 'as laid out' : 'turned half round'}, driven in sense ${frame.sense}`);
  console.log(`  FRAME findings ${findings.length}; base ${frame.base.studsX}×${frame.base.studsY} studs on a ${frame.base.plate.studs}×${frame.base.plate.studs} (${frame.base.plate.part}); `
    + `REPORT: ${contacts.length} faces of a turning part within ${TRAIN_CLEAR} mm of a neighbour's column (the rows' law allows it; the shapes' count)`);
  { // CONTROL: the drive one lattice step along — the solve's answer no longer, or a finding
    const moved = { ...decl2, drive: { ...decl2.drive, dx: -decl2.drive.dx } };
    const f2 = frameTrain(gen, moved);
    control(`${gen}: the drive on the fourth's other side`, !f2.framed || trainFindings(f2, lib, { run }).length > 0 || JSON.stringify(sol.best?.layout) !== JSON.stringify(moved));
  }

  // ── BUILD
  const b = trainBuild(frame, lib, { run });
  const R = meshResidues(b);
  const placedRatio = R.reduce((r, x) => ratMul(r, ratQ(bodyParts(b, x.m.a)[x.m.ga].teeth, bodyParts(b, x.m.b)[x.m.gb].teeth)), ratQ(1));
  if (!ratEq(placedRatio, chain.product)) fail(`the placed teeth multiply to ${ratStr(placedRatio)}, the chain to ${ratStr(chain.product)}`);
  if (!near(Math.abs(b.shafts[b.index.escape].speed), Number(chain.product.n) / Number(chain.product.d), 1e-9)) fail('the escape arbor\'s speed is not the ratio');
  { // CONTROL: a placed gear one tooth off
    const k = R[2].m.b, gi = R[2].m.gb, bad = structuredClone(b); bad.shafts[k].parts[gi].teeth += 1;
    const r2 = bad.meshes.reduce((r, m) => ratMul(r, ratQ(bodyParts(bad, m.a)[m.ga].teeth, bodyParts(bad, m.b)[m.gb].teeth)), ratQ(1));
    control(`${gen}: a placed gear one tooth off`, !ratEq(r2, chain.product));
  }
  for (const u of [0, 0.37e-3, 1.9e-3, 7.3e-3, 41.1e-3]) for (const x of meshResidues(b, u)) {
    if (!(x.w <= PHASE_TOL)) fail(`mesh ${b.shafts[x.m.a].shaft}→${b.shafts[x.m.b].shaft} at u ${u}: ${x.w.toFixed(4)} of a turn off (${x.why ?? ''})`);
    if (!near(x.d, x.want, 1e-6)) fail(`mesh ${b.shafts[x.m.a].shaft}→${b.shafts[x.m.b].shaft}: centres ${x.d} mm apart, want ${x.want}`);
  }
  console.log(`  MESHED ${b.meshes.length} meshes, worst ${Math.max(...R.map((x) => x.w)).toExponential(1)} of a turn at five turns of the great wheel; the placed teeth multiply to ${ratStr(placedRatio)}`);
  for (const x of R.slice(1)) { // CONTROL: half a pitch on each driven body
    const c = structuredClone(b); c.shafts[x.m.b].phi += Math.PI / c.shafts[x.m.b].parts[x.m.gb].teeth;
    control(`${gen}: half a pitch on ${b.shafts[x.m.b].shaft}`, meshResidues(c).find((y) => y.m.b === x.m.b && y.m.a === x.m.a).w > PHASE_TOL);
  }
  // SEATED: every static on the baseplate or on the top face of a static under it
  const base = b.statics[0], seatErrs = (bb) => {
    const errs = [], st = bb.statics.map((p, i) => ({ p, i })).filter(({ p }) => p.role !== 'baseplate' && p.role !== 'cord' && p.role !== 'cordEnd');
    const box = (p) => { const q = Bx(p.part), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const x of [q.lo[0], q.hi[0]]) for (const y of [q.lo[1], q.hi[1]]) for (const z of [q.lo[2], q.hi[2]]) { const w = compose(p.m, [x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], w[d]); hi[d] = Math.max(hi[d], w[d]); } }
      return { lo, hi }; };
    for (const { p } of st) {
      const under = p.m[1] + Bx(p.part).hi[1];
      if (near(under, 0, 1e-4)) {
        const jumper = p.part === FRAME_PARTS.jumper1x2, dx = mod(p.m[0] - base.m[0] - 10, 20), dz = mod(p.m[2] - base.m[2] - 10, 20);
        const wide = Math.abs(box(p).hi[0] - box(p).lo[0]) > 30;            // a 1×2 along X (a knife stack's plate) straddles a half stud
        if (!near(dz, 0, 1e-4) || !near(dx, jumper || wide ? 10 : 0, 1e-4)) errs.push(`${p.part} at (${p.m[0]}, ${p.m[2]}) is off the baseplate's stud grid`);
        continue;
      }
      const pb = box(p), on = st.find(({ p: q }) => q !== p && near(q.m[1], under, 1e-4) && (() => { const qb = box(q); return Math.min(pb.hi[0], qb.hi[0]) - Math.max(pb.lo[0], qb.lo[0]) > 1 && Math.min(pb.hi[2], qb.hi[2]) - Math.max(pb.lo[2], qb.lo[2]) > 1; })());
      if (!on) errs.push(`${p.role} ${p.part} at (${p.m[0].toFixed(1)}, ${p.m[2].toFixed(1)}): its underside at Y ${under.toFixed(2)} stands on nothing`);
    }
    return errs;
  };
  const se = seatErrs(b);
  for (const e of se) fail(`SEATED: ${e}`);
  { const c = structuredClone(b); c.statics.find((p, i) => i > b.fusee.statics.length && p.part === FRAME_PARTS.technicBrick1x1).m[1] -= 8; control(`${gen}: a train Technic brick lifted a plate`, seatErrs(c).length > se.length); }
  // THROUGH and ON THE AXLE, for the bodies this landing adds or moves
  const techs = b.statics.filter((p) => p.role === 'technicBrick').map((t) => ({ t, faces: placements(lib, dat(t.part), /^(peghole|connhol\w*)\.dat$/).map((h) => compose(t.m, h.m)) }));
  const checked = b.shafts.map((s, k) => ({ s, k })).filter(({ s }) => s.module === 'train' || s.shaft === 'centre' || (s.module === 'escapement' && s.shaft === 'escape'));
  // every axle of every body on its line (a brick belongs to the axle on its line NEAREST it: two arbors may stand
  // end to end on one line, as the classic train's second arbor does on the centre's — probe-technic-build's rule)
  const spans = b.shafts.flatMap((s, k) => bodyParts(b, k).filter((p) => p.role === 'axle' && near(p.m[0], s.origin[0], 1e-3) && near(p.m[1], s.origin[1], 1e-3))
    .map((ax) => { const h = (Bx(ax.part).hi[0] - Bx(ax.part).lo[0]) / 2; return { k, x: s.origin[0], y: s.origin[1], z0: ax.m[2] - h, z1: ax.m[2] + h }; }));
  const gap = (sp, lo, hi) => Math.max(sp.z0 - hi, lo - sp.z1, 0);
  for (const { s, k } of checked) {
    const parts = bodyParts(b, k), axles = parts.filter((p) => p.role === 'axle');
    if (axles.length !== 1) { fail(`${s.shaft}: ${axles.length} axles`); continue; }
    const ax = axles[0], half = (Bx(ax.part).hi[0] - Bx(ax.part).lo[0]) / 2, z0 = ax.m[2] - half, z1 = ax.m[2] + half;
    const me = spans.find((sp) => sp.k === k), mates = spans.filter((sp) => near(sp.x, me.x, 1e-3) && near(sp.y, me.y, 1e-3));
    const mine = techs.filter(({ faces }) => faces.length && faces.every((w) => near(w[0], s.origin[0], 1e-3) && near(w[1], s.origin[1], 1e-3)))
      .filter(({ faces }) => { const zs = faces.map((w) => w[2]), lo = Math.min(...zs), hi = Math.max(...zs); return mates.every((o) => o === me || gap(o, lo, hi) > gap(me, lo, hi)); });
    // (two, but the drive's are its knife's brick and its escape columns' holes: two threaded from in front, three from behind)
    const want = s.shaft === 'drive' ? frame.drive.local.cols.length : 2;
    if (mine.length !== want) fail(`${s.shaft}: ${mine.length} Technic bricks on its line, not ${want}`);
    for (const { t } of mine) { const tb = Bx(t.part), e = [compose(t.m, [0, 0, tb.lo[2], 1, 0, 0, 0, 1, 0, 0, 0, 1])[2], compose(t.m, [0, 0, tb.hi[2], 1, 0, 0, 0, 1, 0, 0, 0, 1])[2]];
      if (z0 > Math.min(...e) + 0.5 + EPS || z1 < Math.max(...e) - 0.5 - EPS) fail(`${s.shaft}: its axle (${z0.toFixed(1)}…${z1.toFixed(1)}) does not fill the brick at ${Math.min(...e).toFixed(1)}…${Math.max(...e).toFixed(1)}`); }
    for (const g of parts.filter((p) => p.teeth)) {
      if (!near(g.m[0], s.origin[0], 1e-3) || !near(g.m[1], s.origin[1], 1e-3)) fail(`${s.shaft}: its ${g.teeth}T is off the axle line`);
      if (g.m[2] < z0 || g.m[2] > z1) fail(`${s.shaft}: its ${g.teeth}T at ${g.m[2].toFixed(1)} is beyond its axle ${z0.toFixed(1)}…${z1.toFixed(1)}`);
    }
  }
  // THE MODULES UNCHANGED: the fusee's placements, the escapement's carried
  { const fb = fuseeBuild(frame.fusee, lib, { run }), fp = placedParts(fb), tp = placedParts(b);
    const key = (p) => `${p.part}|${p.m.map((v) => v.toFixed(4)).join(',')}`, have = new Set(tp.map(key));
    const centreBody = fb.shafts.find((s) => s.shaft === 'centre'), cAxle = centreBody.parts.find((p) => p.role === 'axle');
    const missing = fp.filter((p) => p.role !== 'baseplate' && !(p.part === cAxle.part && near(p.m[0], centreBody.origin[0]) && near(p.m[1], centreBody.origin[1]))).filter((p) => !have.has(key(p)));
    if (missing.length) fail(`${missing.length} fusee placements are not in the train (first ${missing[0].part})`);
    const P = frame.escapement, eb = escapementBuild(P.ef, lib), o = P.o;
    const carryM = (m) => [L(P.X) + o * m[0], m[1], L(P.Y) + o * m[2], o * m[3], o * m[4], o * m[5], m[6], m[7], m[8], o * m[9], o * m[10], o * m[11]];
    const missE = eb.statics.filter((p) => p.role !== 'baseplate').map((p) => ({ ...p, m: carryM(p.m) })).filter((p) => !have.has(key(p)));
    if (missE.length) fail(`${missE.length} escapement statics are not carried to their place`);
    for (const es of eb.shafts) {
      const ts = b.shafts.find((s) => s.module === 'escapement' && s.shaft === es.shaft), oc = carryM([...es.origin, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      if (!ts || ![0, 1, 2].every((d) => near(ts.origin[d], oc[d], 1e-6))) { fail(`the escapement's ${es.shaft} is not carried to its place`); continue; }
      const turn = (m) => [o * m[0], m[1], o * m[2], o * m[3], o * m[4], o * m[5], m[6], m[7], m[8], o * m[9], o * m[10], o * m[11]];
      if (ts.parts.length !== es.parts.length || ts.parts.some((q, i) => q.part !== es.parts[i].part || turn(es.parts[i].m).some((v, k) => !near(v, q.m[k], 1e-9)))) fail(`the escapement's ${es.shaft} carries other parts than §287's`);
    }
    console.log(`  BUILD ${b.statics.length + b.shafts.reduce((n, s) => n + s.parts.length, 0)} placements; SEATED ${se.length ? 'FAILS' : 'every static'}; THROUGH ${checked.length} arbors in two bricks each; the fusee's ${fp.length - 1} placements and the escapement's statics where their modules put them`); }
  // THE FILE
  { const lines = toLdr(b).split('\n').filter((l) => l.startsWith('1 ')).map((l) => l.split(/\s+/)), want = placedParts(b);
    if (lines.length !== want.length) fail(`.ldr: ${lines.length} parts, build ${want.length}`);
    else lines.forEach((t, i) => { const m = t.slice(2, 14).map(Number); if (`${want[i].part}.dat` !== t[14] || m.some((v, k) => Math.abs(v - want[i].m[k]) > 1e-4) || !lib.has(t[14])) fail(`.ldr line ${i + 1} is not placement ${i + 1}`); }); }

  // ── ESCAPEMENT: §287's, raised
  const mo = balanceMoments(lib, framedBalance(frame.escapement.ef, lib));
  if (!near(mo.T, standalone.T, 1e-9)) fail(`the train's balance swings ${mo.T} s, §287's ${standalone.T}`);
  const model = escapementModel(lib, { ...escSpec(lib), sense: frame.sense }), bm = beatMeasures(model, ESC_SWING_DEG);
  if (!bm.ok || !(bm.lockMM > F2_PLAY_MM)) fail(`the escapement driven in sense ${frame.sense}: ${bm.ok ? `lock ${bm.lockMM} mm` : bm.why}`);
  console.log(`  ESCAPEMENT §287's, the knife ${frame.escapement.ef.zK} mm up on ${frame.escapement.ef.plates} plates (jumpered: the knife line on a stud), period ${mo.T.toFixed(6)} s (§287's ${standalone.T.toFixed(6)}); driven in sense ${frame.sense} it advances ${bm.advance.toFixed(5)} teeth a period, its lock ${bm.lockMM.toFixed(3)} mm against ${F2_PLAY_MM} mm of play`);

  // ── RATE
  const ratio = b.ratio, gt1 = goingTime(run, ratio, TECHNIC_ESCAPE_TEETH, BEAT_PERIOD_S), gtS = goingTime(run, ratio, TECHNIC_ESCAPE_TEETH, mo.T);
  if (!near(gt1.centreTurnS, 3600, 1e-6) || !near(gt1.greatTurnS, 5 * 3600, 1e-6)) fail(`at ${BEAT_PERIOD_S} s the centre turns in ${gt1.centreTurnS} s and the great wheel in ${gt1.greatTurnS} s`);
  if (!near(gt1.seconds, coneTurnTotal(run) / TAU * 5 * 3600, 1e-6)) fail('the going time is not the cone\'s run through the ratio');
  console.log(`  RATE at ${BEAT_PERIOD_S} s: escape ${60 / (TECHNIC_ESCAPE_TEETH * BEAT_PERIOD_S)} turns a minute, the fourth once a minute, the centre once an hour, the great wheel once in ${gt1.greatTurnS / 3600} h; `
    + `a wind (the cone's ${gt1.greatTurns.toFixed(4)} turns, POSED law) lasts ${gt1.hours.toFixed(3)} h (${hr(gt1.seconds)}), ${gtS.hours.toFixed(3)} h at the solved ${mo.T.toFixed(4)} s`);

  // ── STATE: one state, every angle
  const cyc = cycleModel(lib, { spec: { ...TECHNIC_ESCAPEMENT, sense: frame.sense } }); cyc.T = mo.T;
  const loop = fuseeLoopModel(frame.fusee, lib, run, b.fusee);
  const tm = trainModel(b, cyc, loop);
  const runDown = (loop.T / (2 * Math.PI)) * ratio * TECHNIC_ESCAPE_TEETH * mo.T;
  let worstState = 0;
  const poseAt = (t) => { const p = trainPose(tm, t), phi = p.phi.map((v) => v), lp = p.loop;
    b.shafts.forEach((s, k) => { if (s.module === 'fusee' && !['great', 'centre'].includes(s.shaft)) phi[k] = null; });
    return { p, phi, lp }; };
  for (const t of [0, 0.13, 0.5, 0.77, 5.4, 61.3, 3600, runDown * 0.98, runDown * 1.02, runDown * 1.4]) {
    const { p, phi, lp } = poseAt(t);
    for (const x of meshResidues(posed(b, phi))) { worstState = Math.max(worstState, x.w); if (!(x.w <= PHASE_TOL)) fail(`at t ${t.toFixed(2)} s mesh ${b.shafts[x.m.a].shaft}→${b.shafts[x.m.b].shaft} is ${x.w.toFixed(4)} of a turn off`); }
    if (!near(mod(lp.phiG - phi[b.index.great] + Math.PI, TAU) - Math.PI, 0, 1e-9)) fail(`at t ${t.toFixed(2)} s the great wheel stands ${lp.phiG} by the loop and ${phi[b.index.great]} by the train`);
    if (!(p.dG >= 0)) fail(`at t ${t} the great wheel has run backwards from full wind (${p.dG})`);
  }
  { const per = [0, 1, 7, 100].map((k) => trainPose(tm, 0.3 + k * mo.T)), pitch = TAU / TECHNIC_ESCAPE_TEETH;
    for (let i = 1; i < per.length; i++) { const k = [0, 1, 7, 100][i], dth = (per[i].theta - per[0].theta) * cyc.sigma, ddg = per[i].dG - per[0].dG;
      if (!near(dth, k * pitch, 1e-9)) fail(`${k} periods move the escape wheel ${dth / pitch} teeth`);
      if (!near(ddg, k * pitch / ratio, 1e-12)) fail(`${k} periods move the great wheel ${ddg}, not ${k} × ${pitch / ratio}`); } }
  { const { phi } = poseAt(0.77), k = b.shafts.findIndex((s) => s.module === 'train');
    phi[k] += TAU / (3 * b.shafts[k].parts.find((p) => p.teeth).teeth);
    control(`${gen}: ${b.shafts[k].shaft} posed by itself a third of a pitch off`, meshResidues(posed(b, phi)).some((x) => x.w > PHASE_TOL)); }
  console.log(`  STATE one time drives every angle: at ten times from 0 to ${(runDown * 1.4 / 3600).toFixed(1)} h (past a run-down at ${(runDown / 3600).toFixed(2)} h) every mesh within ${worstState.toExponential(1)} of a turn; the great wheel read by the train and by the fusee's loop agree; a period moves the escape wheel one tooth and the great wheel 2π/${ratio * TECHNIC_ESCAPE_TEETH}`);

  // ── CLEAR, on the parts' surfaces
  const clear = (bb, phi) => {
    const B = posed(bb, phi), errs = [], all = [], rows2 = new Map(), ends = new Set();
    const nF = b.fusee.statics.length - 1, nT = frame.arbors.reduce((n, a) => n + a.columns.reduce((k, c) => k + c.boxes.length, 0), 0);
    B.statics.forEach((p, i) => { if (!['baseplate', 'cord', 'cordEnd'].includes(p.role)) all.push({ p, body: 'static', train: i >= 1 + nF && i < 1 + nF + nT }); });
    const trainBody = (s) => s.module === 'train' || s.shaft === 'centre';
    B.shafts.forEach((s, k) => placedParts({ ...B, statics: [], shafts: [s] }).forEach((p) => all.push({ p, body: k, train: trainBody(s), line: s.origin })));
    // a column's LINES: the heights of its Technic bricks' holes (each 10 LDU under the brick's top face), by spot;
    // a body stands flush on a column of its own line, and its axle runs in that column's brick
    const spot = (p) => `${p.m[0].toFixed(3)},${p.m[2].toFixed(3)}`, lines = new Map();
    for (const { p } of all) if (p.role === 'technicBrick' && all.find((x) => x.p === p).body === 'static') { const k = spot(p); if (!lines.has(k)) lines.set(k, []); lines.get(k).push(p.m[1] + 10); }
    const columnLine = (st, mv) => mv.line && near(st.p.m[0], mv.line[0], 1e-3) && (lines.get(spot(st.p)) ?? []).some((y) => near(y, mv.line[1], 1e-3));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const A = all[i], C = all[j];
      if (!A.train && !C.train) continue;
      if (A.body === C.body || (A.body === 'static' && C.body === 'static')) continue;
      const [st, mv] = A.body === 'static' ? [A, C] : C.body === 'static' ? [C, A] : [null, null];
      if (st && columnLine(st, mv)) continue;                                              // an axle in its brick, a body flush on its own column
      if (st && mv.p.role === 'axle' && mv.line && near(st.p.m[0], mv.line[0], 1e-3) && st.p.m[1] < mv.line[1] + L(D_AXLE_R) && st.p.m[1] + 24 > mv.line[1] - L(D_AXLE_R)) { ends.add(`${mv.p.part}`); continue; }   // an axle's END flush on a frame block on its line (the solve's law)
      if (st && A.train && C.train) { rows2.set(`${mv.p.role} ${mv.p.part}`, 1); continue; } // the rows' law (reported)
      if (b.meshes.some((m) => ((m.a === A.body && m.b === C.body) || (m.a === C.body && m.b === A.body))) && A.p.teeth && C.p.teeth) continue;
      const ca = cloud(A.p), cb = cloud(C.p);
      if ([0, 1, 2].some((d) => ca.lo[d] > cb.hi[d] + CLEAR_LDU || cb.lo[d] > ca.hi[d] + CLEAR_LDU)) continue;
      const g = cloudGap(ca, cb, { reach: 4, cell: 2 });
      if (g < CLEAR_LDU) errs.push(`${A.p.role} ${A.p.part} (${A.body === 'static' ? 'frame' : B.shafts[A.body].shaft}) ⇄ ${C.p.role} ${C.p.part} (${C.body === 'static' ? 'frame' : B.shafts[C.body].shaft}) ${(g * LDU_MM).toFixed(3)} mm`);
    }
    return { errs, rowsLaw: rows2.size, ends: ends.size };
  };
  const clouds = new Map(), cloud = (p) => { const k = p.part + p.m.map((v) => v.toFixed(3)).join(','); if (!clouds.has(k)) clouds.set(k, placedCloud(lib, p, 0.5)); return clouds.get(k); };
  const cr = [];
  for (const t of [0, 0.5, 61.3]) {
    const { phi, lp } = poseAt(t);
    b.shafts.forEach((s, k) => { if (s.module === 'fusee') phi[k] = { barrel: lp.phiB, fusee: lp.phiF, maintaining: lp.phiM, great: lp.phiG, centre: phi[k] }[s.shaft] ?? null; });
    const c = clear(b, phi); cr.push(c);
    for (const e of c.errs) fail(`CLEAR at t ${t} s: ${e}`);
  }
  { // CONTROL: a 1×1 brick set on the drive's line half a clearance off its driven gear's face (a module's block,
    // not the drive's own column): the clearance must read it
    const c = structuredClone(b), k = c.shafts.findIndex((s) => s.shaft === 'drive'), g = c.shafts[k].parts.find((p) => p.teeth && p.teeth !== 24);
    const gp = placedParts({ ...c, statics: [], shafts: [c.shafts[k]] }).find((p) => p.part === g.part);
    const half = L(GEAR_WIDTH_MM[g.part] ?? GEAR_WIDTH_MM.default) / 2, bh = L(LEGO_DIM_MM.stud) / 2;
    const m = [gp.m[0], gp.m[1] - L(LEGO_DIM_MM.brickH) / 2, gp.m[2] - (half + bh + CLEAR_LDU / 2), 1, 0, 0, 0, 1, 0, 0, 0, 1];
    c.statics = [...c.statics, { role: 'brick', part: FRAME_PARTS.brick1x1, m, colour: 71 }];
    control(`${gen}: a brick half a clearance off the drive's ${g.teeth}T`, clear(c, b.shafts.map(() => null)).errs.some((e) => /^brick .*drive/.test(e)));
  }
  console.log(`  CLEAR every new part ${TRAIN_CLEAR} mm off the parts it does not bear on, at three times: ${cr.map((c) => c.errs.length).join('/')} too close; REPORT: ${cr[0].rowsLaw} turning parts flush on a neighbour's column (the rows' law), ${cr[0].ends} axle ends flush on a frame block on their own line`);
  console.log('');
}
console.log('controls:');
for (const [n, c] of controls) { console.log(`  ${c ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!c) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nthe fusee's great wheel drives the escape wheel through ${GENS.length > 1 ? 'both generations\' trains' : 'the train'}, every mesh phased and every angle carried from one state; the going time a wind is the POSED law's`);
process.exit(fails ? 1 : 0);
