// DOES THE BOOKLET SAY WHAT THE BUILD IS: EVERY STEP ON EXACTLY ONE PAGE IN ORDER, EACH CALLOUT THE PARTS ITS STEP ADDS, EACH PICTURE FRAMED ON ITS NEW PARTS, THE LAST PICTURE THE WHOLE BUILD, EVERY PAGE INSIDE ITS PAPER, EVERY STEP THE VALIDATOR COULD NOT CLEAR MARKED?
// Acceptance, pure Node (no browser, no network); exits non-zero on any failed row. BUILT §304 (src/technic-booklet.js, the
// printable booklet booklet.html). The PICTURES and the real page breaks are tools/smoke-technic-booklet.mjs (Chromium); this holds
// the DATA the page prints and the FLOW it prints it on, at both papers. Not probe-technic-steps.mjs (that holds the ORDER and
// the validator, minutes of Node) and not probe-technic-bom.mjs (the parts LIST): this reads their outputs and holds what the
// booklet does with them.
//
//   · COVERAGE — per build, per mode, per generation, at US Letter and A4: every plan step appears in exactly one flow item,
//     in plan order; the closing item is the plan's last step.
//   · CALLOUT — the callout of step n is recounted from the placements the step adds (an independent tally by LDraw id and role
//     colour, the cord's pieces one string) and equals the callout; the sum over steps equals the BOM line for line; a step that
//     adds no part (a note, the finished sub-assembly's lowering) has none.
//   · FRAMING — each step's frame holds every vertex of its new parts, and the arrows; its aspect is the picture's; a step's ghosts
//     are the parts the earlier steps built (a sub-assembly's own, within it) and share nothing with its new parts; the closing
//     picture's new parts are the whole build (id and matrix, as the placements) and the last part-adding main step leaves nothing
//     to place.
//   · FLOW — the pages the estimates break hold every item once, in order, each within the paper's content box; a chapter band is
//     never the last thing on a page; the cover, the parts list, the first chapter and the closing page begin pages; the three-
//     up rule (a chapter band and three two-line cards on the SHORTEST page) holds; the margin clears the printer's unprintable edge.
//   · MARKS — the generated verdicts (src/technic-booklet-flags.js) are the plan's own (signature), every flagged step carries a
//     flagged marker with its reason and no other does, a plan whose verdicts are another's marks EVERY part step unchecked,
//     posed steps and the escapement's analogue say so, an unofficial part is flagged on its callout and its step.
//   · WORDS — nothing the booklet or its page says claims a build works, was tested, was simulated, is guaranteed or proven;
//     the cover says modelled, not built; the LDraw attribution is on it; no LEGO logo or set number is named.
//
// CONTROLS (each seen to fail): a part dropped from a callout; a step's picture drawn with the step before's parts; a picture
// frame shrunk off its parts; a closing picture missing a part; a page overfilled; A4's pages judged on Letter's box; the flagged
// marker removed; the verdicts' signature changed; the unofficial flag removed; two steps swapped; a forbidden word planted.
//
//   node tools/probe-technic-booklet.mjs            every build, both generations, both papers (about two minutes)
//   node tools/probe-technic-booklet.mjs row-2      one cell
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary } from '../src/ldraw.js';
import * as B from '../src/technic-bom.js';
import * as T from '../src/technic-steps.js';
import * as K from '../src/technic-booklet.js';
import { LDRAW_COLOUR, placedParts } from '../src/technic-ldraw.js';
import { colourOf } from '../src/technic-colour.js';
import { BOOKLET_FLAGS } from '../src/technic-booklet-flags.js';
import { frameAlarm, alarmStates, alarmBuild } from '../src/technic-alarm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
const only = process.argv[2] ?? null;
const t0 = performance.now();
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`  ✗ ${msg}`); } return !!cond; };
const controls = [];
const control = (name, caught) => { controls.push([name, !!caught]); };
const CELLS = ['row-1', 'row-2', 'row-3', 'row-4', 'keyless', 'fusee', 'alarm', 'escapement', 'train'];
const SHARED = ['fusee', 'alarm', 'escapement'];
// §302's closed inventory, as the booklet shows it: the flagged STEP counts per build (plan steps whose part no path cleared).
// EMPTY since §305 cleared TODO 264's 27 rows: every build prints no flagged step, and one would fail here.
const FLAGGED_STEPS = Object.freeze({});
// §302's OVERLAPS inventory (two solids in each other at rest, TODO 264), as the booklet shows it: one marker each, on the
// step that completes the pair. EMPTY since §305 cleared the six.
const OVERLAP_MARKS = Object.freeze({});
const FORBIDDEN = /\b(works|working|worked|tested|simulated|simulation|guarantee[ds]?|proven|verified)\b/i;
// "keyless works" and "motion works" are the watch's own nouns (a works is a mechanism), not a claim; every other "works" is
const NOUN = /\b(keyless|motion) works\b/gi;

const variantsOf = (gen, cell) => {
  if (cell === 'alarm') { const af = frameAlarm(), st = alarmStates(lib, af); return ['armed', 'ringing', 'off'].map((mode) => ({ mode, built: { ...B.buildOf(lib, gen, cell), build: alarmBuild(af, lib, st[mode]) } })); }
  const built = B.buildOf(lib, gen, cell);
  return (built.build.modes?.length > 1 ? built.build.modes : [built.build.modes?.[0]]).map((mode) => ({ mode, built }));
};

// ── THE CHECKS, as functions of a booklet's parts so a control can hand one a broken copy.
const tally = (plan, idx) => {                                      // an independent recount: LDraw id + colour, a cord one string
  const m = new Map(); let cord = 0;
  for (const i of idx) {
    const p = plan.parts[i];
    if (B.CORD_ROLES.includes(p.role)) { cord++; continue; }
    const k = `${p.part}|${colourOf(LDRAW_COLOUR, p.role, p.part)}`; m.set(k, (m.get(k) ?? 0) + 1);
  }
  if (cord) m.set(`${plan.build.cord.string.part}|${LDRAW_COLOUR.cord}`, 1);
  return m;
};
const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

function coverageProblems(model, items) {
  const bad = [], seen = [];
  for (const it of items) if (it.type === 'step') seen.push(it.n); else if (it.type === 'final') seen.push(it.n);
  const want = model.plan.steps.map((s) => s.n);
  if (seen.join() !== want.join()) bad.push(`items carry steps ${seen.join(',')}, the plan has ${want.join(',')}`);
  if (new Set(seen).size !== seen.length) bad.push('a step appears twice');
  if (items.filter((x) => x.type === 'cover').length !== 1) bad.push('no single cover');
  if (model.plan.steps[model.plan.steps.length - 1].kind !== 'final') bad.push('the plan does not end in its final step');
  return bad;
}
function calloutProblems(model) {
  const bad = [], total = new Map();
  for (const s of model.steps) {
    const st = model.plan.steps[s.n - 1];
    const got = new Map(s.callout.map((c) => [`${c.part}|${c.colour}`, c.qty]));
    const want = tally(model.plan, st.parts);
    if (!sameMap(got, want)) bad.push(`step ${s.n} callout ${JSON.stringify([...got])} is not what it adds ${JSON.stringify([...want])}`);
    if (!st.parts.length && s.callout.length) bad.push(`step ${s.n} adds no part and has a callout`);
    for (const [k, v] of got) total.set(k, (total.get(k) ?? 0) + v);
  }
  const bom = new Map(model.bom.lines.map((l) => [`${l.part}|${l.colour}`, l.qty]));
  if (!sameMap(total, bom)) bad.push(`the callouts sum to ${[...total].length} lines, the parts list has ${bom.size} (or the quantities differ)`);
  return bad;
}
const world = (p, v) => [p.m[0] + p.m[3] * v[0] + p.m[4] * v[1] + p.m[5] * v[2], p.m[1] + p.m[6] * v[0] + p.m[7] * v[1] + p.m[8] * v[2], p.m[2] + p.m[9] * v[0] + p.m[10] * v[1] + p.m[11] * v[2]];
function framingProblems(model, views = model.views) {
  const bad = [], plan = model.plan, basis = B.viewBasis(), box = K.imageBox(model.paper), aspect = box.w / box.h;
  const mainBefore = new Set(), subBefore = new Map();
  for (const st of plan.steps) {
    const v = views.get(st.n);
    const fresh = st.kind === 'final' ? plan.parts.map((_, i) => i) : st.parts.length ? st.parts : (st.unit ?? []);
    if (st.kind === 'note') { if (v) bad.push(`note step ${st.n} has a picture`); continue; }
    if (!v) { bad.push(`step ${st.n} has no picture`); continue; }
    if ([...v.fresh].sort((a, b) => a - b).join() !== [...fresh].sort((a, b) => a - b).join()) bad.push(`step ${st.n} draws parts ${v.fresh.join(',')} as new, not the ones it adds (${fresh.join(',')})`);
    const wantGhost = st.kind === 'final' ? [] : st.sub ? [...(subBefore.get(st.sub) ?? [])] : [...mainBefore];
    if ([...v.ghost].sort((a, b) => a - b).join() !== wantGhost.sort((a, b) => a - b).join()) bad.push(`step ${st.n} ghosts are not what was built before it`);
    if (v.fresh.some((i) => v.ghost.includes(i))) bad.push(`step ${st.n} draws a part both new and built`);
    // the frame: every new vertex, every arrow point
    const f = v.frame;
    if (Math.abs(f.hw / f.hh - aspect) > 1e-9) bad.push(`step ${st.n} frame is not the picture's aspect`);
    let out = 0;
    for (const i of v.fresh) for (const vert of K.vertsOf(lib, plan.parts[i].part)) { const q = K.planePoint(world(plan.parts[i], vert), basis); if (!K.inFrame(f, q, 1e-6)) out++; }
    if (out) bad.push(`step ${st.n}: ${out} vertices of its new parts fall outside its frame`);
    for (const a of v.arrows) for (const im of a.img) if (im[0] < -1e-9 || im[0] > 1 + 1e-9 || im[1] < -1e-9 || im[1] > 1 + 1e-9) { bad.push(`step ${st.n}: an arrow leaves the picture`); break; }
    if (st.kind !== 'final') { if (st.sub) subBefore.set(st.sub, [...(subBefore.get(st.sub) ?? []), ...st.parts]); else for (const i of fresh) mainBefore.add(i); }
  }
  // the closing picture is the whole build, placement for placement
  const fin = views.get(plan.steps[plan.steps.length - 1].n), want = placedParts(plan.build, 0, plan.mode === 'armed' || plan.mode === 'ringing' || plan.mode === 'off' ? plan.build.modes?.[0] : plan.mode);
  const sig = (p) => `${p.part}|${p.m.map((x) => Math.round(x * 1e4)).join(',')}`;
  if (!fin || [...fin.fresh].map((i) => sig(plan.parts[i])).sort().join('\n') !== want.map(sig).sort().join('\n')) bad.push('the closing picture is not the build\'s placements');
  if (mainBefore.size !== plan.parts.length) bad.push(`the main steps have built ${mainBefore.size} of the ${plan.parts.length} placements when the closing page opens`);
  return bad;
}
const unprintableOk = (paper) => K.MARGIN_PX >= K.NONPRINTABLE_IN * K.PX_PER_IN + 1e-9 && K.contentBox(paper).w + 2 * K.MARGIN_PX <= paper.w + 1e-9 && K.contentBox(paper).h + 2 * K.MARGIN_PX + K.FOOT_PX <= paper.h + 1e-9;
function flowProblems(items, flow, capacity) {
  const bad = [], order = items.map((x) => x.id), byId = new Map(items.map((x) => [x.id, x]));
  if (flow.pages.flatMap((p) => p.items).join() !== order.join()) bad.push('the pages do not hold the items once each in order');
  flow.pages.forEach((p, k) => {
    const used = p.items.reduce((n, id) => n + byId.get(id).h, 0);
    if (used > capacity + 1e-9) bad.push(`page ${k + 1} holds ${used.toFixed(0)} of ${capacity.toFixed(0)}`);
    const last = byId.get(p.items[p.items.length - 1]);
    if (last.type === 'chapter') bad.push(`page ${k + 1} ends on a chapter band`);
    p.items.forEach((id, j) => { const it = byId.get(id); if ((it.newPage || it.own) && j !== 0) bad.push(`${id} should begin a page`); if (it.own && p.items.length > 1) bad.push(`${id} shares its page`); });
  });
  if (flow.overflow.length) bad.push(`items taller than a page: ${flow.overflow.join(',')}`);
  return bad;
}
function marksProblems(model, table = BOOKLET_FLAGS) {
  const bad = [], plan = model.plan;
  const key = model.meta.flagsKey, row = table[key];
  if (model.meta.flags !== 'ok') bad.push(`the verdicts for ${key} are ${model.meta.flags}`);
  const flaggedSteps = new Set(Object.entries(row?.steps ?? {}).filter(([, s]) => (s.items ?? []).some((i) => i.s === 'flagged')).map(([n]) => Number(n)));
  const overlapSteps = new Set(Object.entries(row?.steps ?? {}).filter(([, s]) => (s.items ?? []).some((i) => i.s === 'overlap')).map(([n]) => Number(n)));
  for (const s of model.steps) {
    const has = s.marks.filter((m) => m.kind === 'flagged');
    const ov = s.marks.filter((m) => m.kind === 'overlap');
    if (overlapSteps.has(s.n) !== (ov.length > 0)) bad.push(`step ${s.n}: the check says ${overlapSteps.has(s.n) ? 'two solids end in each other here' : 'no overlap'} and the page says the opposite`);
    for (const m of ov) if (!/TWO SOLIDS IN EACH OTHER/.test(m.text) || !/TODO 264/.test(m.text) || !m.item?.with) bad.push(`step ${s.n}'s overlap marker gives no reason`);
    if (flaggedSteps.has(s.n) && !has.length) bad.push(`step ${s.n} was flagged by the check and carries no marker`);
    if (!flaggedSteps.has(s.n) && has.length) bad.push(`step ${s.n} carries a flagged marker the check never gave`);
    for (const m of has) if (!/NOT CLEARED/.test(m.text) || !/TODO 264/.test(m.text) || !m.item?.part) bad.push(`step ${s.n}'s flagged marker gives no reason`);
    if (s.marks.some((m) => m.kind === 'unchecked')) bad.push(`step ${s.n} is unchecked`);
    if (s.kind === 'note' && !/Modelled, not built/.test(s.statement ?? '')) bad.push(`note step ${s.n} (a band, a gong, an analogue) does not say modelled, not built beside it`);
    for (const c of s.callout) if (c.status === 'unofficial' && !s.marks.some((m) => m.kind === 'unofficial')) bad.push(`step ${s.n} adds unofficial ${c.part} and does not say so`);
  }
  const want = FLAGGED_STEPS[`${model.meta.cell}|${plan.mode}`] ?? FLAGGED_STEPS[model.meta.cell] ?? 0;
  const got = model.steps.filter((s) => s.marks.some((m) => m.kind === 'flagged')).length;
  if (got !== want) bad.push(`${got} flagged steps on paper, §302's inventory has ${want}`);
  const gotOv = model.steps.reduce((n, s) => n + s.marks.filter((m) => m.kind === 'overlap').length, 0), wantOv = OVERLAP_MARKS[model.meta.cell] ?? 0;
  if (gotOv !== wantOv) bad.push(`${gotOv} overlap markers on paper, §302's OVERLAPS inventory has ${wantOv}`);
  if (['fusee', 'alarm'].includes(model.meta.cell) && !model.steps.some((s) => s.marks.some((m) => m.kind === 'posed' && /POSED/.test(m.text)))) bad.push('no step says the forces are posed');
  if (['fusee', 'alarm', 'escapement', 'train'].includes(model.meta.cell) && !model.honesty.some((t) => /forces are posed/.test(t))) bad.push('the cover and closing page do not say the forces are posed');
  if (['alarm', 'escapement', 'train'].includes(model.meta.cell) && !model.honesty.some((t) => /analogue/.test(t))) bad.push('the analogue line is not on the cover');
  if (model.meta.cell === 'escapement' && !model.steps.some((s) => s.marks.some((m) => m.kind === 'analogue'))) bad.push('the escapement\'s analogue caption is not on a step');
  return bad;
}
function wordProblems(model, extra = '') {
  const text = [model.meta.title, ...model.honesty, ...model.notes.map((n) => `${n.item} ${n.quantity} ${n.why}`), ...model.steps.flatMap((s) => [s.title, s.text, ...s.notes, ...s.marks.map((m) => m.text)]), extra].join('\n');
  const bad = [], hit = FORBIDDEN.exec(text.replace(NOUN, '$1 mechanism'));
  if (hit) bad.push(`the booklet says "${hit[0]}"`);
  if (!/^Modelled, not built\./.test(model.honesty[0])) bad.push('the cover does not say modelled, not built');
  if (!/LDraw/.test(model.honesty[model.honesty.length - 1]) || !/CC BY/.test(model.honesty[model.honesty.length - 1])) bad.push('no LDraw CC BY attribution');
  if (/\blogo\b|\bset (?:number|no\.?)\b|\b#\d{4,5}\b/i.test(text)) bad.push('names a logo or a set number');
  return bad;
}

// ── THE RUN
const targets = [];
for (const gen of B.GENERATIONS) for (const cell of CELLS) { if (only && cell !== only) continue; if (SHARED.includes(cell) && gen !== B.GENERATIONS[0]) continue; targets.push({ gen, cell }); }
const report = [], cache = new Map();
console.log('THE BOOKLET — a printable instruction book per LEGO build, at US Letter and A4 (modelled, not built)\n');
const box = (pid) => JSON.stringify({ content: K.contentBox(K.PAPERS[pid]), picture: K.imageBox(K.PAPERS[pid]) });
console.log(`US Letter ${K.PAPERS.letter.w}x${K.PAPERS.letter.h} px ${box('letter')}\nA4 ${K.PAPERS.a4.w.toFixed(1)}x${K.PAPERS.a4.h.toFixed(1)} px ${box('a4')}\nmargin ${K.MARGIN_PX} px, footer ${K.FOOT_PX} px, picture height ${K.LAYOUT.imgH} px\n`);
for (const { gen, cell } of targets) for (const { mode, built } of variantsOf(gen, cell)) {
  const plan = T.deriveSteps(built.build, { lib, mode }), bom = B.bomOf(built.build, lib);
  const label = `${SHARED.includes(cell) ? 'both generations' : gen} ${cell}${mode && !['run', 'swing', 'full wind'].includes(mode) ? ` (${mode})` : ''}`;
  const row = { label, steps: plan.steps.length, pages: {} };
  for (const pid of K.PAPER_IDS) {
    const paper = K.PAPERS[pid];
    const model = K.bookletOf({ lib, gen, cell, mode, built, plan, bom, flagsTable: BOOKLET_FLAGS, paper });
    const items = K.layoutItems(model, paper), flow = K.paginate(items, K.contentBox(paper).h);
    const bad = [...coverageProblems(model, items), ...calloutProblems(model), ...framingProblems(model), ...flowProblems(items, flow, K.contentBox(paper).h), ...marksProblems(model), ...wordProblems(model)];
    if (!unprintableOk(paper)) bad.push('the content box does not sit inside the printable area');
    for (const b of bad) ok(false, `${label} / ${pid}: ${b}`);
    ok(!bad.length, `${label} / ${pid}`);
    row.pages[pid] = flow.pages.length;
    row.flagged = model.steps.filter((s) => s.marks.some((m) => m.kind === 'flagged')).length;
    cache.set(`${label}|${pid}`, { model, items, flow, plan, built, bom, gen, cell, mode });
  }
  report.push(row);
  console.log(`  ${row.label.padEnd(40)} ${String(row.steps).padStart(3)} steps, ${row.flagged} flagged; pages: Letter ${row.pages.letter}, A4 ${row.pages.a4}`);
}

// ── THE GENERATED VERDICTS ARE THE PLANS' OWN: every row's signature is the signature of the plan it names (the flags file is
// re-derived by tools/booklet-flags.mjs --check; this holds that a plan which moved is noticed without the minutes of Node)
console.log('\nVERDICT SIGNATURES');
for (const { gen, cell } of targets) for (const { mode, built } of variantsOf(gen, cell)) {
  const key = `${SHARED.includes(cell) ? 'shared' : gen}|${cell}|${mode ?? '-'}`, plan = T.deriveSteps(built.build, { lib, mode });
  ok(BOOKLET_FLAGS[key]?.sig === K.planSig(plan), `verdicts ${key}: signature ${BOOKLET_FLAGS[key]?.sig} is not the plan's ${K.planSig(plan)}`);
}
if (!only) { const want = new Set(); for (const { gen, cell } of targets) for (const { mode } of variantsOf(gen, cell)) want.add(`${SHARED.includes(cell) ? 'shared' : gen}|${cell}|${mode ?? '-'}`); for (const k of Object.keys(BOOKLET_FLAGS)) ok(want.has(k), `verdict row ${k} names no build (stale)`); }

// ── THE DERIVATIONS
console.log('\nDERIVED');
{
  // three-up: a chapter band and three two-line cards fit the shortest page, and every paper shows three to a page
  const L = K.LAYOUT, two = { kind: 'gap', title: 'x'.repeat(40), text: 'y'.repeat(60), notes: [], marks: [], callout: [], sub: null };
  for (const pid of K.PAPER_IDS) {
    const paper = K.PAPERS[pid], cap = K.contentBox(paper).h, h = K.cardHeight({ ...two, callout: [{}, {}] }, paper);
    ok(L.chapterH + 3 * h <= cap - K.SLACK_PX + 1e-9, `${pid}: a band and three two-line cards (${(L.chapterH + 3 * h).toFixed(0)}) do not fit ${cap.toFixed(0)} less ${K.SLACK_PX}`);
  }
  ok(K.imageBox(K.PAPERS.a4).w < K.imageBox(K.PAPERS.letter).w, 'A4 is narrower than Letter, so its pictures are');
  ok(K.contentBox(K.PAPERS.a4).h > K.contentBox(K.PAPERS.letter).h, 'A4 is taller than Letter, so its pages hold more');
  ok(Math.abs(K.PAPERS.letter.w - 816) < 1e-9 && Math.abs(K.PAPERS.letter.h - 1056) < 1e-9 && Math.abs(K.PAPERS.a4.w - 793.7008) < 1e-3 && Math.abs(K.PAPERS.a4.h - 1122.5197) < 1e-3, 'the paper sizes are 8.5×11 in and 210×297 mm at 96 px an inch');
  ok(K.defaultPaper('en-US') === 'letter' && K.defaultPaper('en-CA') === 'letter' && K.defaultPaper('es-MX') === 'letter' && K.defaultPaper('en-GB') === 'a4' && K.defaultPaper('de-DE') === 'a4' && K.defaultPaper('fr') === 'a4' && K.defaultPaper(undefined) === 'a4', 'default paper by language region');
  // the same plan, two papers: A4 breaks at other places than Letter
  const a = [...cache.values()].find((x) => x.cell === 'alarm' && x.model.paper.id === 'letter'), b = [...cache.values()].find((x) => x.cell === 'alarm' && x.model.paper.id === 'a4');
  if (a && b) ok(a.flow.pages.map((p) => p.items.join()).join('|') !== b.flow.pages.map((p) => p.items.join()).join('|'), 'the alarm breaks onto the same pages on both papers');
}

// ── CONTROLS
console.log('\nCONTROLS');
{
  const base = cache.get([...cache.keys()].find((k) => k.startsWith('technic_2026 row-2') && k.endsWith('|letter')));
  const key2 = [...cache.keys()].find((k) => k.startsWith('both generations alarm (armed)') && k.endsWith('|letter')), alarm = cache.get(key2);
  const pick = base ?? [...cache.values()][0];
  if (pick) {
    const { model, items, flow } = pick;
    const cap = K.contentBox(model.paper).h;
    // a part dropped from a callout
    { const i = model.steps.findIndex((s) => s.callout.length); const m2 = { ...model, steps: model.steps.map((s, k) => (k === i ? { ...s, callout: s.callout.slice(1) } : s)) }; control('a part dropped from a step\'s callout is caught', calloutProblems(m2).length > 0); }
    // a step drawn with the step before's parts
    { const n = model.steps.find((s, k) => k > 2 && s.callout.length).n, v = new Map(model.views); v.set(n, { ...v.get(n), fresh: v.get(n - 1)?.fresh ?? [], ghost: v.get(n).ghost }); control('a step drawn with the step before\'s parts is caught', framingProblems(model, v).length > 0); }
    // a frame shrunk off its parts
    { const n = model.steps.find((s, k) => k > 3 && s.view && s.callout.length).n, v = new Map(model.views), o = v.get(n); v.set(n, { ...o, frame: { ...o.frame, hw: o.frame.hw / 4, hh: o.frame.hh / 4 } }); control('a frame shrunk off its new parts is caught', framingProblems(model, v).length > 0); }
    // a closing picture missing a part
    { const n = model.plan.steps[model.plan.steps.length - 1].n, v = new Map(model.views), o = v.get(n); v.set(n, { ...o, fresh: o.fresh.slice(1) }); control('a closing picture missing a part is caught', framingProblems(model, v).length > 0); }
    // a page overfilled
    { const bad = { pages: flow.pages.map((p, k) => (k === 3 ? { ...p, items: [...p.items, ...flow.pages[4].items] } : p)).filter((_, k) => k !== 4), overflow: [] }; control('a page overfilled is caught', flowProblems(items, { pages: bad.pages, overflow: [] }, cap).length > 0); }
    // A4's pages judged on Letter's box
    { const a4 = cache.get([...cache.keys()].find((k) => k === `${pick.model.meta.title}|a4`) ?? ''); const k4 = [...cache.keys()].find((k) => k.startsWith('technic_2026 row-2') && k.endsWith('|a4')); const x = cache.get(k4); control('A4\'s pages judged on Letter\'s content box are caught', x && flowProblems(x.items, x.flow, K.contentBox(K.PAPERS.letter).h).length > 0); void a4; }
    // two steps swapped
    { const sw = items.slice(); const i = sw.findIndex((x) => x.id === 'step-3'); [sw[i], sw[i + 1]] = [sw[i + 1], sw[i]]; control('two steps swapped are caught', coverageProblems(model, sw).length > 0); }
    // a forbidden word planted
    control('a planted "works" is caught', wordProblems(model, 'This build works when assembled.').length > 0);
    control('a missing modelled-not-built is caught', wordProblems({ ...model, honesty: ['This is a finished model.', ...model.honesty.slice(1)] }).length > 0);
  }
  if (alarm) {
    const { model } = alarm;
    // a band's note without its modelled-not-built
    { const i = model.steps.findIndex((s) => s.kind === 'note'); control('a note step without modelled-not-built beside it is caught', i >= 0 && marksProblems({ ...model, steps: model.steps.map((s, k) => (k === i ? { ...s, statement: null } : s)) }).length > 0); }
    // §305: no build has a flagged step any more, so the marker controls PLANT one — a verdict table whose row for
    // this plan flags a part step (as landing 2's did) — and the booklet built from it must carry the marker
    { const paper = model.paper, n = model.steps.find((s) => s.adds && !s.flexible).n, row0 = BOOKLET_FLAGS[model.meta.flagsKey];
      const tbl = { ...BOOKLET_FLAGS, [model.meta.flagsKey]: { ...row0, steps: { ...row0.steps, [n]: { ...(row0.steps[n] ?? {}), items: [{ s: 'flagged', part: '3673', by: '2712', depth: 1.5, allow: 1.4 }] } } } };
      const mf = K.bookletOf({ lib, gen: alarm.gen, cell: alarm.cell, mode: alarm.mode, built: alarm.built, plan: alarm.plan, bom: alarm.bom, flagsTable: tbl, paper });
      ok(mf.steps.find((s) => s.n === n).marks.some((m) => m.kind === 'flagged'), 'a planted flagged verdict is not printed as a marker');
      // the flagged marker removed
      { const m2 = { ...mf, steps: mf.steps.map((s) => (s.n === n ? { ...s, marks: s.marks.filter((m) => m.kind !== 'flagged') } : s)) }; control('the flagged marker removed from a step is caught', marksProblems(m2, tbl).some((b) => /carries no marker/.test(b))); }
      // a marker with no reason
      { const m2 = { ...mf, steps: mf.steps.map((s) => (s.n === n ? { ...s, marks: s.marks.map((m) => (m.kind === 'flagged' ? { ...m, text: 'no.' } : m)) } : s)) }; control('a flagged marker that gives no reason is caught', marksProblems(m2, tbl).some((b) => /gives no reason/.test(b))); }
      // and a flagged step is now a regression: the planted one is counted against the empty inventory
      control('a flagged step, against §305\'s empty inventory, is caught', marksProblems(mf, tbl).some((b) => /flagged steps on paper/.test(b))); }
    // verdicts of another plan: every part step unchecked, and the marks check refuses them
    { const paper = model.paper, tbl = { ...BOOKLET_FLAGS, [model.meta.flagsKey]: { ...BOOKLET_FLAGS[model.meta.flagsKey], sig: '00000000' } };
      const m2 = K.bookletOf({ lib, gen: alarm.gen, cell: alarm.cell, mode: alarm.mode, built: alarm.built, plan: alarm.plan, bom: alarm.bom, flagsTable: tbl, paper });
      const parted = m2.steps.filter((s) => s.adds && !s.flexible);
      ok(parted.length > 0 && parted.every((s) => s.marks.some((m) => m.kind === 'unchecked')), 'verdicts signed for another plan leave a part step unmarked as unchecked');
      control('verdicts signed for another plan are caught (every part step unchecked, the build refused)', m2.meta.flags === 'stale' && marksProblems(m2).length > 0);
      const m3 = K.bookletOf({ lib, gen: alarm.gen, cell: alarm.cell, mode: alarm.mode, built: alarm.built, plan: alarm.plan, bom: alarm.bom, flagsTable: {}, paper });
      control('a build with no verdicts at all is refused', m3.meta.flags === 'missing' && marksProblems(m3).length > 0); }
  }
  // the unofficial flag removed (technic_2026 keyless places 7785 and 7861)
  { const k = [...cache.keys()].find((x) => x.startsWith('technic_2026 keyless (wind)') && x.endsWith('|letter')), x = cache.get(k);
    if (x) {
      const i = x.model.steps.findIndex((s) => s.marks.some((m) => m.kind === 'unofficial'));
      ok(i >= 0, 'technic_2026 keyless shows no unofficial part');
      const m2 = { ...x.model, steps: x.model.steps.map((s, j) => (j === i ? { ...s, marks: s.marks.filter((m) => m.kind !== 'unofficial') } : s)) };
      control('the unofficial flag removed from a step is caught', marksProblems(m2).length > 0);
      ok(x.model.steps.some((s) => s.callout.some((c) => c.status === 'unofficial')), 'no callout pip is unofficial');
    }
    const kc = [...cache.keys()].find((y) => y.startsWith('technic_classic keyless (wind)') && y.endsWith('|letter')), xc = cache.get(kc);
    if (xc) ok(!xc.model.steps.some((s) => s.marks.some((m) => m.kind === 'unofficial')), 'technic_classic prints an unofficial flag'); }
}
// the page's own source, scanned the way a reader meets it
{
  const src = ['booklet.html', 'src/technic-booklet.js', 'src/technic-booklet-page.js', 'src/technic-booklet-view.js'].map((f) => readFileSync(join(ROOT, f), 'utf8'));
  const words = src.map((s) => s.replace(/\/\/[^\n]*/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
  ok(!words.some((s) => /\bsimulat/i.test(s)), 'the page or its modules say "simulated"');
  ok(!words.some((s) => FORBIDDEN.test(s.replace(NOUN, '$1 mechanism'))), 'the page or its modules say works, tested, proven or guaranteed');
}
for (const [name, caught] of controls) ok(caught, `control not caught: ${name}`);
console.log(controls.map(([n, c]) => `  ${c ? 'ok  ' : 'MISS'} ${n}`).join('\n'));
console.log('\nSUMMARY');
for (const r of report) console.log(`  ${r.label.padEnd(40)} ${String(r.steps).padStart(3)} steps, ${r.flagged} flagged, Letter ${r.pages.letter} pages, A4 ${r.pages.a4} pages`);
console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${checks} checks, ${controls.length} controls, ${fails} failed, ${Math.round((performance.now() - t0) / 1000)} s`);
process.exit(fails || !targets.length ? 1 : 0);
