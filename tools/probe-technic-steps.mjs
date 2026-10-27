// IS THE ORDER THE LEGO BUILDS GO TOGETHER IN A VALID ONE: EVERY PLACEMENT IN EXACTLY ONE STEP, EVERY PART AFTER THE PARTS IT RESTS ON AND PASSES THROUGH, EVERY STEP'S PARTS INSERTABLE INTO WHAT IS ALREADY THERE, AND THE .MPD THE PAGE OFFERS THE SAME BUILD?
// Acceptance, pure Node (the vendored three.js and three-mesh-bvh load through tools/three-node-loader.mjs, no browser,
// no network); exits non-zero on any failed row. BUILT §302 (src/technic-steps.js, the swept validator in
// tools/technic-steps-sweep.mjs, technic.html's .mpd link). Not probe-technic-build.mjs (that holds the PLACEMENTS: seated,
// through, meshed) and not probe-technic-bom.mjs (that holds the parts LIST); this holds the ORDER.
//
//   · COVERAGE — per build, per mode, per generation: every placement appears in exactly one step, a sub-assembly's
//     parts are exactly its steps' parts and its `place` step adds none, and replaying the steps in order reproduces
//     a fresh `placedParts` placement for placement (id, role, matrix, as JSON). CONTROLS: a part dropped from a
//     step, a part listed in two.
//   · TOPOLOGY — the order is a valid topological order of the SUPPORT GRAPH, read off the placements and the
//     library's own geometry and not off the plan: SEATED (each part of a column rests on the one under it, its
//     underside on that part's top face, bounds read from the pack) and THROUGH (each Technic brick whose hole faces
//     lie on an axle's line precedes the axle) and GAP (a part standing on the axle between its two bricks cannot
//     be slid on once the axle is through, so it precedes the axle). CONTROLS: a Technic brick moved ahead of the
//     plate under it; an axle threaded before the gear it passes through.
//   · INSERTION — each step's parts are swept along their declared directions (tools/technic-steps-sweep.mjs) against
//     what is already placed; a part no straight, turned-to-mesh or two-leg path clears is FLAGGED. A flagged step
//     is a FINDING (this build, as modelled, has a part its neighbours' geometry will not let in), and the closed
//     inventory FLAGGED below names every one with the TODO that owns it: a flagged step not in it fails, and a row
//     whose step has cleared is stale and fails. CONTROLS: the axle slid through its two Technic bricks before the
//     gear is in the gap (the gear can no longer be lowered), a brick pushed into its neighbour (must read over
//     the tolerance), a brick set beside it (must read as touching).
//   · THE FILE — the .mpd parses back (src/ldraw.js), has a `0 STEP` after every main-model step, its steps in the
//     plan's order, every sub-assembly a `0 FILE` the main file places at the identity, and flattening it gives the
//     .ldr's part lines exactly (same text, the .ldr's colours and matrices). CONTROLS: two steps swapped in the
//     text, a matrix changed, a sub-assembly's file removed.
//   · WORDS — no step says a build works, was tested or was simulated; the cells whose forces are posed carry a
//     step that says so beside the part that adds them.
//   · DERIVED — deriving twice is the same plan; the three modes of the keyless cell (and the alarm's three) are
//     the same ORDER.
//
// THE TOLERANCE (TOL_LDU) is derived, not tuned: it must exceed the exact-fit FLOOR this probe measures (the deepest
// final-pose reading of an axle in a Technic brick or in a gear's bore, where the surfaces are meant to be tangent)
// and stay below the depth a part pushed one stud into its neighbour reads. Both are printed.
//
//   node tools/probe-technic-steps.mjs            all builds, both generations (about ten minutes)
//   node tools/probe-technic-steps.mjs row-2      one cell (row-1..row-4, keyless, fusee, alarm, escapement, train)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, placements, compose } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { LDU_MM } from '../src/ldraw.js';
import * as B from '../src/technic-bom.js';
import { placedParts, toLdr } from '../src/technic-ldraw.js';
import { frameAlarm, alarmStates, alarmBuild } from '../src/technic-alarm.js';
import * as T from '../src/technic-steps.js';
import * as S from './technic-steps-sweep.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = loadPack();   // vendor/ldraw/technic-parts.mpd (BUILT §309: or with TECHNIC_SUBSTITUTE's one swap)
const only = process.argv[2] ?? null;
const t0 = performance.now();
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`  ✗ ${msg}`); } return !!cond; };
const controls = [];
const control = (name, caught) => { controls.push([name, !!caught]); };
const EPS = 1e-6;
const near = (a, b, t = EPS) => Math.abs(a - b) <= t;
const dat = (p) => `${p}.dat`;
const bcache = new Map();
const Bd = (p) => (bcache.has(p) || bcache.set(p, bounds(lib, dat(p))), bcache.get(p));

// ── THE CLOSED INVENTORY of flagged steps. A row is `build|part|blocker` (LDraw ids; the blocker is the part the best
// attempt met), found by running this probe over every build, both generations and every mode; it fails when a
// flagged step is not here and when a row here has cleared. NO ROW MAY BE ADDED: a newly flagged step is a
// regression of the derivation or of the model. Every row cites the TODO that owns it.
const FLAGGED = Object.freeze({   // value: the TODO that owns the row
  // EMPTY since §305: TODO 264's 27 rows each cleared at its root (BUILT §305 names how), and the inventory stays
  // closed — a flagged step now fails as a regression.
});

// ── THE BUILDS
const CELLS = ['row-1', 'row-2', 'row-3', 'row-4', 'keyless', 'fusee', 'alarm', 'escapement', 'train'];   // §312: the going train, per generation
const SHARED = ['fusee', 'alarm', 'escapement'];              // the same build in both generations
const targets = [];
for (const gen of B.GENERATIONS) for (const cell of CELLS) {
  if (only && cell !== only) continue;
  if (SHARED.includes(cell) && gen !== B.GENERATIONS[0]) continue;
  targets.push({ gen, cell });
}
function plansOf(gen, cell) {
  if (cell === 'alarm') {
    const af = frameAlarm(), st = alarmStates(lib, af);
    return ['armed', 'ringing', 'off'].map((mode) => { const build = alarmBuild(af, lib, st[mode]); return { mode, build }; });
  }
  const { build } = B.buildOf(lib, gen, cell);
  return (build.modes?.length > 1 ? build.modes : [build.modes?.[0]]).map((mode) => ({ mode, build }));
}

// ── INDEPENDENT SUPPORT GRAPH (the topology instrument). Read off the placements and the pack, not the plan.
function supportEdges(build, parts) {
  const edges = [], bad = [];
  const ns = build.statics.length;
  const base = parts.findIndex((p) => p.role === 'baseplate');
  const cols = new Map();
  for (let i = 0; i < ns; i++) {
    if (parts[i].role === 'baseplate' || B.CORD_ROLES.includes(parts[i].role)) continue;
    const k = `${parts[i].m[0].toFixed(3)},${parts[i].m[2].toFixed(3)}`;
    if (!cols.has(k)) cols.set(k, []);
    cols.get(k).push(i);
  }
  // §312: a stack may stand on a part of ANOTHER spot (a knife stack centred on a stud stands on a jumper half a
  // stud off it): its bottom part then rests on the static whose top face is its underside and whose footprint it
  // overlaps, read off the pack's bounds
  const foot = (i) => { const q = Bd(parts[i].part), xs = [], zs = [];
    for (const x of [q.lo[0], q.hi[0]]) for (const z of [q.lo[2], q.hi[2]]) { const w = compose(parts[i].m, [x, 0, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); xs.push(w[0]); zs.push(w[2]); }
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; };
  const overlaps = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1;
  for (const stack of cols.values()) {
    stack.sort((a, b) => parts[b].m[1] - parts[a].m[1]);                         // bottom first (+Y is down)
    let floorY = 0, below = base;
    for (const [n, i] of stack.entries()) {
      const under = parts[i].m[1] + Bd(parts[i].part).hi[1];                        // this part's underside, from the pack
      if (n === 0 && !near(under, 0, 1e-4)) {
        const fi = foot(i), on = [...Array(ns).keys()].find((j) => j !== i && j !== base && !B.CORD_ROLES.includes(parts[j].role) && near(parts[j].m[1], under, 1e-4) && overlaps(foot(j), fi));
        if (on === undefined) bad.push(`part ${i} (${parts[i].part}) underside at Y ${under.toFixed(3)} stands on nothing`);
        else edges.push([on, i, 'seated']);
        floorY = parts[i].m[1]; below = i; continue;
      }
      if (!near(under, floorY, 1e-4)) bad.push(`part ${i} (${parts[i].part}) underside at Y ${under.toFixed(3)}, not on ${floorY.toFixed(3)}`);
      edges.push([below, i, 'seated']);
      floorY = parts[i].m[1]; below = i;
    }
  }
  // THROUGH and GAP, from the bricks' hole faces (the pack's peghole/connhole sub-files)
  const techs = [];
  for (let i = 0; i < ns; i++) if (parts[i].role === 'technicBrick')
    techs.push({ i, faces: placements(lib, dat(parts[i].part), /^(peghole|connhol\w*)\.dat$/).map((h) => compose(parts[i].m, h.m)) });
  for (let a = ns; a < parts.length; a++) {
    if (parts[a].role !== 'axle') continue;
    const p = parts[a], b = Bd(p.part), u = [p.m[3], p.m[6], p.m[9]], o = [p.m[0], p.m[1], p.m[2]];
    const t = (w) => (w[0] - o[0]) * u[0] + (w[1] - o[1]) * u[1] + (w[2] - o[2]) * u[2];
    const perp = (w) => Math.hypot(...[0, 1, 2].map((k) => { const d = [w[0] - o[0], w[1] - o[1], w[2] - o[2]]; return d[(k + 1) % 3] * u[(k + 2) % 3] - d[(k + 2) % 3] * u[(k + 1) % 3]; }));
    const through = techs.filter(({ faces }) => faces.length && faces.every((w) => perp(w) < 0.5) && Math.max(...faces.map(t)) > b.lo[0] + 1 && Math.min(...faces.map(t)) < b.hi[0] - 1);
    for (const { i } of through) edges.push([i, a, 'through']);
    if (through.length > 1) {
      const lo = Math.min(...through.flatMap(({ faces }) => faces.map(t))), hi = Math.max(...through.flatMap(({ faces }) => faces.map(t)));
      for (let q = ns; q < parts.length; q++) {
        if (q === a || parts[q].role === 'axle' || B.CORD_ROLES.includes(parts[q].role)) continue;
        const tq = t([parts[q].m[0], parts[q].m[1], parts[q].m[2]]);
        if (perp([parts[q].m[0], parts[q].m[1], parts[q].m[2]]) < 0.5 && tq > lo + 1 && tq < hi - 1) edges.push([q, a, 'gap']);
      }
    }
  }
  return { edges, bad };
}
// the position of each placement in a plan: the step that puts it in the main model (a sub-assembly's parts at its `place`)
function positions(plan, steps = plan.steps) {
  const pos = new Map(), within = new Map();
  const subPlace = new Map(plan.subs.map((s) => [s.id, steps.findIndex((x) => x.places === s.id)]));
  steps.forEach((st, at) => {
    st.parts.forEach((i, k) => { pos.set(i, st.sub ? subPlace.get(st.sub) : at); within.set(i, st.sub ? -1 : k); });
  });
  return { pos, within };
}
function topoFailures(plan, edges, steps = plan.steps) {
  const { pos, within } = positions(plan, steps), bad = [];
  for (const [a, b, why] of edges) {
    const pa = pos.get(a), pb = pos.get(b);
    if (pa === undefined || pb === undefined) { bad.push(`${why}: part ${pa === undefined ? a : b} is in no step`); continue; }
    if (pa < pb || (pa === pb && within.get(a) < within.get(b))) continue;
    bad.push(`${why}: part ${a} (${plan.parts[a].part}) is at step ${pa + 1}, not before part ${b} (${plan.parts[b].part}) at ${pb + 1}`);
  }
  return bad;
}
function coverageFailures(plan, steps = plan.steps) {
  const bad = [], seen = new Array(plan.parts.length).fill(0);
  for (const st of steps) for (const i of st.parts) seen[i]++;
  seen.forEach((n, i) => { if (n !== 1) bad.push(`placement ${i} (${plan.parts[i].part}) is in ${n} steps`); });
  for (const s of plan.subs) {
    const inSteps = steps.filter((x) => x.sub === s.id).flatMap((x) => x.parts).sort((a, b) => a - b), want = [...s.parts].sort((a, b) => a - b);
    if (inSteps.join() !== want.join()) bad.push(`sub-assembly ${s.id}: its steps hold ${inSteps.length} parts, it declares ${want.length}`);
    const pl = steps.find((x) => x.places === s.id);
    if (!pl || pl.parts.length) bad.push(`sub-assembly ${s.id}: its place step is missing or adds parts`);
  }
  return bad;
}
function replayFailures(plan, build, steps = plan.steps) {
  const fresh = placedParts(build, 0, plan.mode), bad = [];
  for (const st of steps) for (const i of st.parts) if (JSON.stringify(fresh[i]) !== JSON.stringify(plan.parts[i])) bad.push(`placement ${i} replays differently`);
  return bad;
}

// ── THE PLACED POSE'S OWN OVERLAPS. The sweep lets a part end as deep in a neighbour as the library moulds it to
// (a friction pin's ridges, 1.0 LDU in a beam, is the deepest) and the order cannot be judged against a pair that
// is IN each other at rest. A pair deeper than OVERLAP_CEILING_LDU, neither a drawn cord (a flexible string lying
// in a groove as straight segments) nor a part moulded to be pressed, is a model fact the validator surfaces:
// two solids of the build in each other. The closed inventory OVERLAPS names each, citing the TODO that owns it.
const OVERLAP_CEILING_LDU = 1.0;
const OVERLAPS = Object.freeze({   // value: the TODO that owns the row
  // EMPTY since §305: TODO 264's six pairs each cleared in the solver that placed them (BUILT §305).
});
const overlapsSeen = new Map();
function placedOverlaps(label, cell, parts) {
  const bodies = parts.map((p) => S.placedBody(lib, p)), out = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    const [x, y] = [parts[a], parts[b]];
    if (B.CORD_ROLES.includes(x.role) || B.CORD_ROLES.includes(y.role) || !bodies[a].box.intersectsBox(bodies[b].box)) continue;
    const d = S.depthOf(bodies[a], bodies[a].M, bodies[b]).depth;
    if (d <= OVERLAP_CEILING_LDU) continue;
    const key = `${cell}|${[`${x.role}${x.part}`, `${y.role}${y.part}`].sort().join('|')}`;
    out.push({ key, d });
    overlapsSeen.set(key, Math.max(overlapsSeen.get(key) ?? 0, d));
  }
  return out;
}

const FORBIDDEN = /\b(works|working|tested|simulated|simulation|guarantee[ds]?|proven|verified)\b/i;
const report = [], flaggedSeen = new Map();
let tolFloor = 0;
const exactFit = (build, parts) => {                                             // axle in a Technic brick / in a gear's bore, at the placed pose
  const bodies = parts.map((p) => S.placedBody(lib, p));
  let worst = 0;
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    const [x, y] = [parts[a], parts[b]];
    const pair = (x.role === 'axle' && (y.role === 'technicBrick' || (y.teeth && y.role !== 'pawl'))) || (y.role === 'axle' && (x.role === 'technicBrick' || (x.teeth && x.role !== 'pawl')));
    if (!pair || !bodies[a].box.intersectsBox(bodies[b].box)) continue;
    const d = S.depthOf(bodies[a], bodies[a].M, bodies[b]).depth;
    if (d <= OVERLAP_CEILING_LDU) worst = Math.max(worst, d);      // a deeper pair is an overlap (OVERLAPS), not a fit
  }
  return worst;
};

console.log('THE LEGO BUILD ORDER — steps derived from the model, judged by a swept insertion (modelled, not built)\n');
console.log(`tolerance ${S.TOL_LDU} LDU (${(S.TOL_LDU * LDU_MM).toFixed(2)} mm); sample step ${S.STEP_LDU} LDU\n`);
let planCache = new Map();
for (const { gen, cell } of targets) {
  const variants = plansOf(gen, cell);
  const sigs = [];
  for (const { mode, build } of variants) {
    const label = `${gen === B.GENERATIONS[0] && SHARED.includes(cell) ? 'both generations' : gen} ${cell}${mode && variants.length > 1 ? ` (${mode})` : ''}`;
    const plan = T.deriveSteps(build, { lib, mode });
    sigs.push(plan.steps.map((s) => `${s.kind}:${s.parts.length}`).join());
    const bad = [];
    // DERIVED
    const again = T.deriveSteps(build, { lib, mode });
    if (JSON.stringify(again.steps.map((s) => [s.kind, s.parts, s.title])) !== JSON.stringify(plan.steps.map((s) => [s.kind, s.parts, s.title]))) bad.push('deriving twice gives two plans');
    if (plan.unmatched.length) bad.push(...plan.unmatched);
    if (plan.leftover.length) bad.push(`bodies no recipe named: ${plan.leftover.join(', ')}`);
    // COVERAGE
    bad.push(...coverageFailures(plan), ...replayFailures(plan, build));
    // TOPOLOGY
    const { edges, bad: seatBad } = supportEdges(build, plan.parts);
    bad.push(...seatBad, ...topoFailures(plan, edges));
    // WORDS
    for (const st of plan.steps) if (FORBIDDEN.test(`${st.title} ${st.text} ${st.notes.join(' ')}`)) bad.push(`step ${st.n} says ${FORBIDDEN.exec(`${st.title} ${st.text} ${st.notes.join(' ')}`)[0]}`);
    if (['fusee', 'alarm'].includes(cell) && !plan.steps.some((s) => s.kind === 'note' && s.posed && /POSED/.test(s.text))) bad.push('no step says the forces are posed');
    if ((cell === 'escapement' || cell === 'train') && !plan.steps.some((s) => /analogue/i.test(s.text))) bad.push(`the ${cell}'s analogue caption is not on a step`);
    if (!/Modelled, not built/.test(plan.steps[plan.steps.length - 1].title)) bad.push('the last step does not say modelled, not built');
    // THE FILE
    const mpd = T.toMpd(plan);
    const parsed = T.parseMpd(mpd), flat = T.flattenMpd(parsed);
    const want = toLdr(build, 0, mode).split('\n').filter((l) => l.startsWith('1 '));
    if ([...flat].sort().join('\n') !== [...want].sort().join('\n')) bad.push('flattened .mpd is not the .ldr\'s part lines');
    const mainFile = parsed.files.get(parsed.main), nMain = plan.steps.filter((x) => !x.sub).length;
    if (mainFile.steps.length !== nMain) bad.push(`the main file has ${mainFile.steps.length} STEPs for ${nMain} main-model steps`);
    mainFile.steps.forEach((grp, k) => {
      const st = plan.steps.filter((x) => !x.sub)[k];
      const got = grp.map((l) => l.file).join(), exp = st.places ? plan.subs.find((x) => x.id === st.places).id + '.ldr' : st.parts.map((i) => `${plan.parts[i].part}.dat`).join();
      if (got !== exp) bad.push(`main-file step ${k + 1} places ${got || 'nothing'}, the plan's step ${st.n} adds ${exp || 'nothing'}`);
    });
    const libMpd = parseLibrary(mpd);
    for (const [name, f] of libMpd) for (const l of f.lines) if (l.type === 1 && !libMpd.has(l.file) && !lib.has(l.file)) bad.push(`${name} places ${l.file}, which neither the file nor the pack holds`);
    // THE PLACED POSE'S OVERLAPS (once per build, not per mode)
    if (mode === variants[0].mode) for (const o of placedOverlaps(label, cell, plan.parts)) if (!(o.key in OVERLAPS)) bad.push(`OVERLAP, not in the inventory: ${o.key} ${o.d.toFixed(2)} LDU`);
    // INSERTION
    const t1 = performance.now();
    const v = S.validatePlan(plan, lib);
    tolFloor = Math.max(tolFloor, exactFit(build, plan.parts));
    const strat = {};
    for (const r of v.steps) for (const it of r.parts) {
      strat[it.strategy] = (strat[it.strategy] ?? 0) + 1;
      if (it.strategy !== 'flagged') continue;
      const p = plan.parts[it.idx[0]], blk = it.blockedBy?.part;
      const key = `${cell}|${it.idx.length > 1 ? 'unit' : p.part}|${blk ? blk.part : '-'}`;
      flaggedSeen.set(key, (flaggedSeen.get(key) ?? 0) + 1);
      if (!(key in FLAGGED)) bad.push(`FLAGGED, not in the inventory: step ${r.n} ${key} (${it.label}, depth ${it.blockedBy?.depth.toFixed(2)} over ${it.blockedBy?.allow.toFixed(2)})`);
    }
    report.push({ label, steps: plan.steps.length, partSteps: plan.steps.filter((s) => s.parts.length).length, chapters: plan.chapters.length, subs: plan.subs.length, flagged: v.flagged, strat });
    const failed = bad.length;
    for (const b of bad) ok(false, `${label}: ${b}`);
    ok(!failed, `${label}`);
    console.log(`  ${failed ? 'FAIL' : 'ok  '} ${label.padEnd(36)} ${String(plan.steps.length).padStart(3)} steps, ${plan.chapters.length} chapters, ${plan.subs.length} sub-assemblies, ${v.flagged} flagged `
      + `${JSON.stringify(strat)} (${Math.round(performance.now() - t1)} ms)`);
    planCache.set(label, { plan, build, edges, mpd });
  }
  // The keyless modes differ only in where the ring stands: one order. The alarm's states move the lever, the
  // hammer and the driver, which stand in other chapters' corridors, so its chapter order may differ by state
  // (a cycle in the corridor graph is broken by position); that is reported, not gated.
  if (sigs.length > 1 && cell !== 'alarm') ok(new Set(sigs).size === 1, `${gen} ${cell}: the modes are not the same order`);
  if (sigs.length > 1 && cell === 'alarm') console.log(`  (the alarm's ${sigs.length} states give ${new Set(sigs).size} chapter orders)`);
}

// ── CONTROLS. Each is seen to fail; a probe that cannot see these has measured nothing.
console.log('\nCONTROLS');
{
  // The controls are written against a gear-train row (a layer to swap, an axle threaded through a gap, two coplanar
  // gears), so they run on row 2's plan whichever cells were asked for: run for one other cell (`escapement`, `alarm`),
  // they used to take that cell's plan, and crashed or reported controls missed on the unmutated tree (BUILT §309).
  let label = [...planCache.keys()].find((k) => /row-2/.test(k));
  if (!label) {
    const { build } = B.buildOf(lib, B.GENERATIONS[0], 'row-2'), plan = T.deriveSteps(build, { lib, mode: build.modes?.[0] });
    label = `${B.GENERATIONS[0]} row-2 (for the controls)`;
    planCache.set(label, { plan, build, edges: supportEdges(build, plan.parts).edges, mpd: T.toMpd(plan) });
  }
  if (label) {
    const { plan, build, edges, mpd } = planCache.get(label);
    // COVERAGE: a part dropped from a step; a part listed twice
    const dropped = plan.steps.map((s, k) => (k === 3 ? { ...s, parts: s.parts.slice(1) } : s));
    control('a part dropped from a step fails the coverage', coverageFailures(plan, dropped).length > 0);
    const twice = plan.steps.map((s, k) => (k === 3 ? { ...s, parts: [...s.parts, plan.steps[2].parts[0]] } : s));
    control('a part listed in two steps fails the coverage', coverageFailures(plan, twice).length > 0);
    control('the unmutated plan passes the coverage', coverageFailures(plan).length === 0);
    // TOPOLOGY: a Technic brick moved ahead of the plate under it (the last two layers swapped)
    const layers = plan.steps.map((s, k) => [s, k]).filter(([s]) => s.kind === 'layer');
    const top = layers[layers.length - 1][1], under = layers[layers.length - 2][1];
    const swapped = plan.steps.slice(); [swapped[top], swapped[under]] = [swapped[under], swapped[top]];
    control('a Technic brick put ahead of the part under it fails the topology', topoFailures(plan, edges, swapped).some((b) => /seated/.test(b)));
    const kThread = plan.steps.findIndex((s) => s.kind === 'thread'), kGap = plan.steps.findIndex((s) => s.kind === 'gap');
    const sw2 = plan.steps.slice(); [sw2[kThread], sw2[kGap]] = [sw2[kGap], sw2[kThread]];
    control('an axle threaded before the gear it passes through fails the topology', topoFailures(plan, edges, sw2).some((b) => /gap|through/.test(b)));
    control('the unmutated plan passes the topology', topoFailures(plan, edges).length === 0);
    // INSERTION: the same swap, judged by the sweep. The gear cannot be lowered into a gap an axle already crosses.
    const vSwap = S.validatePlan({ ...plan, steps: sw2 }, lib);
    control('the axle slid through its bricks before the gear is in the gap leaves the gear unable to go in', vSwap.steps.some((r) => r.kind === 'gap' && !r.ok));
    const vOk = S.validatePlan(plan, lib);
    control('the unswapped plan clears every step', vOk.flagged === 0);
    // the pair readings: a brick pushed into its neighbour reads over the tolerance, bricks side by side read as touching
    const brick = (x) => S.placedBody(lib, { part: '6541', role: 'technicBrick', m: [x, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] });
    const hit = S.depthOf(brick(0), brick(0).M, brick(10)), touch = S.depthOf(brick(0), brick(0).M, brick(20));
    console.log(`  a 1×1 Technic brick pushed 10 LDU into its neighbour reads ${hit.depth.toFixed(3)} LDU; set beside it (touching) ${touch.depth.toFixed(3)}`);
    control('a brick pushed half its width into its neighbour reads over the tolerance', hit.depth > S.TOL_LDU * 4);
    control('a brick set against its neighbour reads as touching', touch.depth <= S.TOL_LDU);
    // §305: THE PIN'S LIP, measured: a pin drawn along its own axis into a 6541's hole reads its lip (the press it
    // may carry, along its own axes only); a plain axle drawn the same way reads none — the reading is the pin's
    const lip = S.pinLip(lib, '3673'), axleLip = S.pinLip(lib, '3705');
    console.log(`  a 3673 pin drawn into a 6541's hole reads its lip at ${lip.toFixed(3)} LDU (a 4L axle the same way: ${axleLip.toFixed(3)}); no fit in the pack is deeper than ${OVERLAP_CEILING_LDU}`);
    control('a plain axle drawn into a pin hole reads no lip', axleLip <= S.TOL_LDU && lip > S.TOL_LDU && lip <= OVERLAP_CEILING_LDU);
    // §305: THE OVERLAP MEASURE sees a pair: a gear of this build pushed 12 LDU across onto its neighbour
    {
      const gi = plan.parts.findIndex((p) => p.teeth), q = { ...plan.parts[gi], m: [...plan.parts[gi].m] };
      const nb = plan.parts.findIndex((p, k) => k !== gi && p.teeth && Math.abs(p.m[2] - q.m[2]) < 2 && Math.hypot(p.m[0] - q.m[0], p.m[1] - q.m[1]) > 1);
      const dx = plan.parts[nb].m[0] - q.m[0], dy = plan.parts[nb].m[1] - q.m[1], dl = Math.hypot(dx, dy);
      q.m[0] += 12 * dx / dl; q.m[1] += 12 * dy / dl;
      const a = S.placedBody(lib, q), b = S.placedBody(lib, plan.parts[nb]);
      control('a gear pushed 12 LDU onto its neighbour reads as an overlap', S.depthOf(a, a.M, b).depth > OVERLAP_CEILING_LDU);
    }
    // THE TOLERANCE: above the exact-fit floor, below the collision
    console.log(`  the exact-fit floor (an axle in a brick or a bore, at the placed pose) reads ${tolFloor.toFixed(3)} LDU; the tolerance is ${S.TOL_LDU}`);
    control('the tolerance exceeds the exact-fit floor', S.TOL_LDU > tolFloor);
    // THE FILE: two steps swapped in the text, a matrix changed, a sub-assembly's file removed
    const parsed = T.parseMpd(mpd), want = toLdr(build, 0, plan.mode).split('\n').filter((l) => l.startsWith('1 '));
    const lines = mpd.split('\n'), iStep = lines.findIndex((l, k) => l === '0 STEP' && k > 12);
    const bad1 = lines.slice(); const a0 = bad1.findIndex((l) => /^0 \/\/ step 2:/.test(l)), a1 = bad1.findIndex((l) => /^0 \/\/ step 3:/.test(l));
    const sa = bad1.slice(a0, a1), sb = bad1.slice(a1, bad1.findIndex((l, k) => k > a1 && /^0 \/\/ step 4:/.test(l)));
    bad1.splice(a0, sa.length + sb.length, ...sb, ...sa);
    const stepOrder = (text) => T.parseMpd(text).files.get(T.parseMpd(text).main).steps.map((s) => s.map((l) => l.file).join());
    control('two steps swapped in the .mpd text change its step order', stepOrder(bad1.join('\n')).join('|') !== stepOrder(mpd).join('|'));
    const bad2 = mpd.replace(/^(1 \d+ )(\S+)/m, (m, a, x) => `${a}${Number(x) + 1}`);
    control('a matrix changed in the .mpd no longer flattens to the .ldr', [...T.flattenMpd(T.parseMpd(bad2))].sort().join('\n') !== [...want].sort().join('\n'));
    void iStep; void parsed;
    const withSub = [...planCache.values()].find((x) => x.plan.subs.length);
    if (withSub) {
      const noFile = withSub.mpd.replace(/\n0 FILE [^\n]*\.ldr[\s\S]*$/, '\n');
      control('a sub-assembly\'s file removed leaves the .mpd unflattenable', (() => { try { const p = T.parseMpd(noFile); const f = T.flattenMpd(p); return f.some((l) => /\.ldr$/.test(l)); } catch { return true; } })());
    }
  }
}
for (const [name, caught] of controls) ok(caught, `control not caught: ${name}`);
console.log(controls.map(([n, c]) => `  ${c ? 'ok  ' : 'MISS'} ${n}`).join('\n'));

// ── THE INVENTORY, judged both ways (only when every cell ran)
console.log('\nFLAGGED STEPS (a part no straight, turned or two-leg path lets in)');
if (!only) for (const k of Object.keys(FLAGGED)) ok(flaggedSeen.has(k), `FLAGGED row ${k} has cleared (stale)`);
for (const [k, n] of [...flaggedSeen].sort()) console.log(`  ${k}  ×${n}`);
console.log(`\nPLACED-POSE OVERLAPS deeper than ${OVERLAP_CEILING_LDU} LDU (two solids of the build in each other; neither a drawn cord nor a pressed part)`);
if (!only) for (const k of Object.keys(OVERLAPS)) ok(overlapsSeen.has(k), `OVERLAPS row ${k} has cleared (stale)`);
for (const [k, d] of [...overlapsSeen].sort()) console.log(`  ${k}  ${d.toFixed(2)} LDU`);
console.log('\nSUMMARY');
for (const r of report) console.log(`  ${r.label.padEnd(36)} ${String(r.steps).padStart(3)} steps (${r.partSteps} add parts), ${r.chapters} chapters, ${r.subs} sub-assemblies, ${r.flagged} flagged`);
console.log(`\n${checks} checks, ${fails} failing, ${controls.length} controls, ${Math.round((performance.now() - t0) / 1000)} s`);
process.exit(fails || !targets.length ? 1 : 0);
