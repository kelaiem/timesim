#!/usr/bin/env node
// WRITES src/technic-booklet-flags.js: what the swept-insertion validator (BUILT §302,
// tools/technic-steps-sweep.mjs) said about every step of every LEGO build, in a form the BROWSER can read.
// The booklet page cannot run the validator (it needs three-mesh-bvh and minutes of Node), but it must not
// show a step the validator could not clear as if it were buildable, so the verdicts are GENERATED here and
// committed, never typed. Each row is keyed `${generation}|${cell}|${mode}` (the fusee, alarm and escapement
// are one build in both generations and sit under `shared`) and carries the plan's signature (planSig), so a
// derivation that has moved since the file was written is a MISMATCH the booklet and its probe both refuse.
//
//   node tools/booklet-flags.mjs --write            all builds, both generations, every mode (about ten minutes)
//   node tools/booklet-flags.mjs --check            re-derive and compare with the committed file (same cost)
//   node tools/booklet-flags.mjs --write row-2      one cell (rows are merged into the committed file)
//
// What is kept per step: the direction the validator's chosen path started along (`d`), the strategy
// (straight, turn, two-leg, flagged) and for each non-straight part its particulars: the turn in degrees, the
// second leg, or, for a FLAGGED part, the blocker it met and the depth it reached over what was allowed; and any
// OVERLAP (two solids in each other at rest) the step brings in, on the step that completes the pair. A
// straight step with the default direction down is stored as nothing. Honest history: TODO 264's closed
// FLAGGED inventory is what this file lists on paper; a row appearing here that is not in that inventory is
// the probe's failure to report, not this file's.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseLibrary } from '../src/ldraw.js';
import * as B from '../src/technic-bom.js';
import * as T from '../src/technic-steps.js';
import { planSig } from '../src/technic-booklet-sig.js';
import { frameAlarm, alarmStates, alarmBuild } from '../src/technic-alarm.js';
import * as S from './technic-steps-sweep.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/technic-booklet-flags.js');
const CELLS = ['row-1', 'row-2', 'row-3', 'row-4', 'keyless', 'fusee', 'alarm', 'escapement', 'train'];
export const SHARED = ['fusee', 'alarm', 'escapement'];

export function variantsOf(lib, gen, cell) {
  if (cell === 'alarm') {
    const af = frameAlarm(), st = alarmStates(lib, af);
    return ['armed', 'ringing', 'off'].map((mode) => ({ mode, build: alarmBuild(af, lib, st[mode]) }));
  }
  const { build } = B.buildOf(lib, gen, cell);
  return (build.modes?.length > 1 ? build.modes : [build.modes?.[0]]).map((mode) => ({ mode, build }));
}
export const keyOf = (gen, cell, mode) => `${SHARED.includes(cell) ? 'shared' : gen}|${cell}|${mode ?? '-'}`;

// A pair of solids standing in each other at REST deeper than a part is moulded to (a friction pin's ridges reach 1.0 LDU in a
// beam, the deepest of any fit in the pack) is a fact about the MODEL, not about a step: tools/probe-technic-steps.mjs lists
// them (its OVERLAPS inventory, TODO 264) and the booklet marks the step that brings the second solid in. A drawn cord (a
// string lying in a groove as straight segments) is excluded, as the probe excludes it.
export const OVERLAP_CEILING_LDU = 1.0;
export function overlapsOf(plan, lib) {
  const bodies = plan.parts.map((p) => S.placedBody(lib, p)), entry = new Map();   // part index -> the step it enters the main model at
  const placeOf = new Map(plan.subs.map((x) => [x.id, x.place]));
  for (const st of plan.steps) for (const i of st.parts.length ? st.parts : (st.unit ?? [])) if (!st.places) entry.set(i, st.sub ? placeOf.get(st.sub) : st.n);
  const ownStep = new Map(); for (const st of plan.steps) for (const i of st.parts) ownStep.set(i, st.n);
  const out = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    const [x, y] = [plan.parts[a], plan.parts[b]];
    if (B.CORD_ROLES.includes(x.role) || B.CORD_ROLES.includes(y.role) || !bodies[a].box.intersectsBox(bodies[b].box)) continue;
    const d = S.depthOf(bodies[a], bodies[a].M, bodies[b]).depth;
    if (d <= OVERLAP_CEILING_LDU) continue;
    const ea = entry.get(a), eb = entry.get(b);
    const later = ea !== eb ? (ea > eb ? [a, b] : [b, a]) : (ownStep.get(a) >= ownStep.get(b) ? [a, b] : [b, a]);
    out.push({ n: Math.max(ea, eb), s: 'overlap', part: plan.parts[later[0]].part, with: plan.parts[later[1]].part, depth: +d.toFixed(2) });
  }
  return out;
}

// One plan's verdicts.
export function verdicts(plan, lib) {
  const v = S.validatePlan(plan, lib), steps = {};
  for (const r of v.steps) {
    if (!r.parts.length) continue;
    const first = r.parts[0], items = [];
    for (const it of r.parts) {
      const p = plan.parts[it.idx[0]];
      if (it.strategy === 'flagged') items.push({ s: 'flagged', part: it.idx.length > 1 ? 'unit' : p.part, by: it.blockedBy?.part?.part ?? null, depth: it.blockedBy ? +it.blockedBy.depth.toFixed(2) : null, allow: it.blockedBy ? +it.blockedBy.allow.toFixed(2) : null });
      else if (it.strategy === 'turn') items.push({ s: 'turn', part: p.part, deg: +(it.turn * 180 / Math.PI).toFixed(1) });
      else if (it.strategy === 'two-leg') items.push({ s: 'two-leg', part: it.idx.length > 1 ? 'unit' : p.part, along: T.dirName(it.slide.dir), ldu: it.slide.s });
    }
    const d = first.dir ? T.dirName(first.dir) : null;
    if (items.length || (d && d !== 'down')) steps[r.n] = { ...(d ? { d } : {}), ...(items.length ? { items } : {}) };
  }
  for (const { n, ...it } of overlapsOf(plan, lib)) { steps[n] ??= {}; (steps[n].items ??= []).push(it); }
  return { sig: planSig(plan), steps };
}

export function generate(lib, only = null) {
  const out = {};
  for (const gen of B.GENERATIONS) for (const cell of CELLS) {
    if (only && cell !== only) continue;
    if (SHARED.includes(cell) && gen !== B.GENERATIONS[0]) continue;
    for (const { mode, build } of variantsOf(lib, gen, cell)) {
      const plan = T.deriveSteps(build, { lib, mode });
      const t = performance.now();
      out[keyOf(gen, cell, mode)] = verdicts(plan, lib);
      console.log(`  ${keyOf(gen, cell, mode).padEnd(40)} ${String(plan.steps.length).padStart(3)} steps ${Math.round(performance.now() - t)} ms`);
    }
  }
  return out;
}

export const render = (rows) => `// GENERATED by tools/booklet-flags.mjs — do not edit. BUILT §304.
// What the swept-insertion validator (BUILT §302) said about every step of every LEGO build, for the booklet
// to print beside the step: a step it could not clear is MARKED, never shown as buildable. Keyed
// \`\${generation}|\${cell}|\${mode}\` (\`shared\` for the fusee, alarm and escapement, one build in both
// generations); \`sig\` is the plan it was measured on (planSig), so a plan that has moved is a mismatch the
// booklet refuses. \`npm run\`-free: \`node tools/booklet-flags.mjs --check\` re-derives it.
export const BOOKLET_FLAGS = ${JSON.stringify(Object.fromEntries(Object.entries(rows).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1)};
`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), only = args.find((a) => CELLS.includes(a)) ?? null;
  const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
  if (args.includes('--write')) {
    let base = {};
    if (only && existsSync(OUT)) base = (await import(pathToFileURL(OUT).href)).BOOKLET_FLAGS;
    const rows = { ...base, ...generate(lib, only) };
    writeFileSync(OUT, render(rows));
    console.log(`wrote ${OUT}: ${Object.keys(rows).length} rows`);
  } else if (args.includes('--check')) {
    const have = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    const want = render(generate(lib, null));
    if (have !== want) { console.error('FAIL — src/technic-booklet-flags.js is not what the validator says now; run --write'); process.exit(1); }
    console.log('OK — the committed verdicts are re-derived');
  } else { console.log('usage: --write [cell] | --check'); process.exit(2); }
}
