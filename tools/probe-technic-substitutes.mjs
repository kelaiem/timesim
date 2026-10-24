// ARE THE PARTS LIST'S ALTERNATIVES ONES THE MODEL ACCEPTS? Acceptance, pure Node (no browser;
// no network); exits non-zero on any failed row. BUILT §309.
//
//   · THE SUBSET — src/technic-rebrickable.js has one row per placed LDraw id (PART_IDS) and
//     every candidate is an A or M relative; given the downloads (`--rb DIR --parts P --codes K`)
//     it is RE-DERIVED from them byte for byte (tools/rebrickable-subset.mjs' own `derive`).
//   · THE TOOTH COUNT — `toothCount`, the measure the ratio judge uses, reads every placed gear's
//     catalogued count off its geometry (its control: a measure that cannot do that judged nothing).
//   · THE VERDICTS — every candidate has exactly one verdict and every verdict a candidate; each
//     verdict is RE-JUDGED: the checks before geometry re-run, and for a candidate that reached the
//     geometry every judge it names is run again with the candidate swapped in
//     (TECHNIC_SUBSTITUTE, tools/technic-pack.mjs), each must read the substitution, and must agree
//     with the file: a passing substitute passes every judge, a failing one fails the judge it names.
//     `--quick` skips the geometric re-runs and SAYS so (those verdicts are then unverified this run);
//     `--only P[,P]` limits to some placed ids.
//   · THE LIST — every alternative the parts list shows is a passing verdict, offered in a colour
//     BrickLink lists an element for; the CSV's two columns are the lines'; the words say
//     "official sets" and never stock.
//   · CONTROLS, each seen to fail (and one seen to pass: every judge called passes with NOTHING substituted, or no
//     failure could be the candidate's): a gear of another tooth count offered as a substitute (the ratio
//     judge refuses it, and the build probe's mesh judge fails it too); a verdict whose judge result is
//     FORGED (the comparison reports it); a substitute offered in a colour BrickLink does not list
//     (the list check reports it); a candidate with no element in any page colour (the bricklink
//     judge refuses it); and the overlay itself — a substituted part reads the candidate's bounds.
//
//   node tools/probe-technic-substitutes.mjs [--quick] [--only 3647] [--jobs 3] [--rb DIR --parts P --codes K]
import { readFileSync } from 'node:fs';
import { parseLibrary, bounds, walk } from '../src/ldraw.js';
import { MAIN_PACK, CANDIDATE_PACK, overlay } from './technic-pack.mjs';
import * as J from './technic-substitutes-judge.mjs';
import { PART_IDS } from '../src/technic-bom-ids.js';
import { REBRICKABLE } from '../src/technic-rebrickable.js';
import { SUBSTITUTE_VERDICTS } from '../src/technic-substitutes-verdicts.js';
import { BRICKLINK } from '../src/technic-bricklink.js';
import * as S from '../src/technic-substitutes.js';
import * as B from '../src/technic-bom.js';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const quick = args.includes('--quick'), only = flag('--only')?.split(',') ?? null, jobs = Number(flag('--jobs') ?? 3);
const t0 = Date.now();
let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log(`  ✗ ${m}`); } return !!c; };
const controls = [];
const control = (name, caught) => controls.push([name, !!caught]);
const libs = { main: parseLibrary(readFileSync(MAIN_PACK, 'utf8')), cand: parseLibrary(readFileSync(CANDIDATE_PACK, 'utf8')) };
console.log('SUBSTITUTE PARTS — Rebrickable alternates and mould variants, judged by the model (modelled, not built)\n');

// ── THE SUBSET
console.log('THE SUBSET');
ok(PART_IDS.every((id) => REBRICKABLE.lines[id]) && Object.keys(REBRICKABLE.lines).every((id) => PART_IDS.includes(id)), 'the subset\'s rows are not exactly PART_IDS');
for (const [id, l] of Object.entries(REBRICKABLE.lines)) for (const c of l.candidates) ok(['A', 'M'].includes(c.rel) && ['parent', 'child', 'sibling'].includes(c.dir), `${id}: candidate ${c.rb} is a ${c.rel}/${c.dir} relative`);
if (flag('--rb')) {
  const { derive } = await import('./rebrickable-subset.mjs');
  const d = await derive({ rb: flag('--rb'), parts: flag('--parts'), codes: flag('--codes'), date: REBRICKABLE.source.date });
  ok(JSON.stringify(d) === JSON.stringify(REBRICKABLE), 'the committed Rebrickable subset differs from the downloads');
  console.log('  re-derived from the downloads');
} else console.log('  (no --rb: the subset is held to its shape, not re-derived)');
const nCand = Object.values(REBRICKABLE.lines).reduce((n, l) => n + l.candidates.length, 0);
console.log(`  ${PART_IDS.length} placed ids, ${nCand} candidates (${Object.values(REBRICKABLE.lines).filter((l) => l.candidates.length).length} ids have any)`);

// ── THE TOOTH COUNT
console.log('\nTHE TOOTH COUNT (measured off the geometry)');
const idx = J.placedIndex(libs.main);
const gears = [...idx].filter(([, u]) => u.teeth.size);
for (const [id, u] of gears) ok(u.teeth.size === 1 && J.toothCount(libs.main, id) === [...u.teeth][0], `toothCount reads ${id} as ${J.toothCount(libs.main, id)}, the placement says ${[...u.teeth].join('/')}`);
console.log(`  ${gears.length} placed gears, each read at its catalogued count: ${gears.map(([id, u]) => `${id} ${[...u.teeth][0]}T`).join(', ')}`);
control('the tooth count of an axle is not a gear\'s (3705 reads neither 8 nor 16)', ![8, 16].includes(J.toothCount(libs.main, '3705')));

// ── THE VERDICTS
console.log('\nTHE VERDICTS');
const V = SUBSTITUTE_VERDICTS.verdicts;
for (const id of PART_IDS) {
  const cs = REBRICKABLE.lines[id].candidates, vs = V[id] ?? [];
  ok(vs.length === cs.length && cs.every((c) => vs.filter((v) => v.candidate === c.ldraw && v.rb === c.rb).length === 1), `${id}: the verdicts are not one per candidate`);
}
// the comparison of a recorded verdict with a fresh one (the forged-verdict control runs the same function)
const differs = (rec, fresh) => {
  const k = (v) => JSON.stringify([v.status, v.judge, (v.judges ?? []).map((j) => [j.run, j.ok]), Object.entries(v.cells ?? {}).map(([c, x]) => [c, x.status, x.judge])]);
  return k(rec) === k(fresh) ? null : `recorded ${rec.status}${rec.judge ? ` (${rec.judge})` : ''}, re-judged ${fresh.status}${fresh.judge ? ` (${fresh.judge})` : ''}`;
};
const fresh = new Map(), tasks = [], baseRuns = new Map();
let geometric = 0;
for (const id of Object.keys(V).sort()) {
  if (only && !only.includes(id)) continue;
  for (const rec of V[id]) {
    const c = REBRICKABLE.lines[id].candidates.find((x) => x.ldraw === rec.candidate && x.rb === rec.rb);
    const v = J.preJudge(id, c, idx.get(id), libs);
    v.sameItem = !!(c.bricklink && idx.get(id).lines.every((l) => l.purchase === c.bricklink.number));
    fresh.set(`${id}=${rec.candidate}`, v);
    if (v.status !== 'go') continue;
    geometric++;
    if (quick) { Object.assign(v, rec); v.unverified = true; continue; }
    v.runs = [];
    // the judges the file names AND the ones the cells call for (a judge dropped from the file is a difference)
    const runs = new Map(J.probeRuns(idx.get(id).cells).map((r) => [J.runName(r), r]));
    for (const j of rec.judges ?? []) if (!runs.has(j.run)) runs.set(j.run, { probe: j.run.split(' ')[0], arg: j.run.split(' ')[1] ?? null });
    for (const r of runs.values()) baseRuns.set(J.runName(r), r);
    for (const r of runs.values()) tasks.push(async () => { const res = await J.runProbe(r, id, rec.candidate); v.runs.push(res); console.log(`  ${res.ok ? 'pass' : res.error ? 'ERROR' : 'fail'} ${id}=${rec.candidate} ${res.run} (${Math.round(res.ms / 1000)} s)`); });
  }
}
// THE BASELINE (a control): every judge called, once, with nothing substituted, must pass — or a failure below could
// not be the candidate's
const baseRes = await J.pool([...baseRuns.values()].map((r) => () => J.runProbe(r, null, null)), jobs);
for (const r of baseRes) ok(r.ok, `baseline: ${r.run} fails with nothing substituted (${r.why.join(' | ')})`);
if (baseRes.length) console.log(`  baseline: ${baseRes.filter((r) => r.ok).length}/${baseRes.length} judges pass with nothing substituted`);
await J.pool(tasks, jobs);
for (const [key, v] of fresh) if (v.runs) { ok(v.runs.every((r) => r.substituted), `${v.candidate}: a judge did not read the substitution`); J.finish(v, [...idx.get(key.split('=')[0]).cells]); }
const mismatch = [];
for (const [key, v] of fresh) {
  const [id, cand] = key.split('='), rec = V[id].find((x) => x.candidate === cand);
  const d = differs(rec, v);
  ok(!d, `${key}: ${d}`);
  if (d) mismatch.push(key);
  ok(rec.sameItem === v.sameItem, `${key}: sameItem recorded ${rec.sameItem}, derived ${v.sameItem}`);
}
const all = [...fresh.values()], count = (s) => all.filter((v) => v.status === s).length;
console.log(`  ${all.length} verdicts re-judged: ${count('pass')} pass, ${count('fail')} fail, ${count('not judged')} not judged, ${count('skip')} skipped; `
  + `${quick ? `the ${geometric} geometric verdicts NOT re-run this time (--quick): UNVERIFIED` : `${geometric} through the geometric judges (${tasks.length} judge runs)`}`);

// ── THE LIST (per build: candidates / passed / failed by judge / not judged)
console.log('\nTHE LIST');
const FORBIDDEN = /\b(in stock|stock|available|works?|tested|simulated|verified)\b/i;
const listBad = (rows) => rows.filter((s) => !s.offer || !s.bricklink || !(s.offer.elements ?? []).length);
for (const gen of B.GENERATIONS) for (const cell of B.cellIds()) {
  const c = B.bomForCell(libs.main, gen, cell);
  if (!c.bom) continue;
  const n = { cand: 0, pass: 0, fail: {}, nj: {} };
  for (const l of c.bom.lines) {
    const r = l.substitutes;
    n.cand += r.candidates; n.pass += r.passed.length;
    for (const f of r.failed) n.fail[f.judge] = (n.fail[f.judge] ?? 0) + 1;
    for (const f of r.notJudged) n.nj[f.judge] = (n.nj[f.judge] ?? 0) + 1;
    ok(!listBad(r.passed).length, `${gen} ${cell} ${l.part}: an alternative offered in a colour BrickLink lists no element for`);
    for (const s of r.passed) ok(V[l.part].find((v) => v.candidate === s.ldraw).status === 'pass', `${gen} ${cell} ${l.part}: alternative ${s.ldraw} is not a passing verdict`);
    ok(l.alternatives.length === r.passed.length && l.alternatives.every((a) => /official sets? in this colour \(Rebrickable, /.test(a) && !FORBIDDEN.test(a)), `${gen} ${cell} ${l.part}: the alternatives' words`);
  }
  const csv = B.parseCsv(B.bomCsv(c, gen)), head = csv[0], ia = head.indexOf('alternatives'), ij = head.indexOf('alternatives_judged');
  const blank = csv.findIndex((r) => r.length === 1 && r[0] === '');
  ok(ia > 0 && ij > 0 && csv.slice(1, blank).every((r, k) => r[ia] === c.bom.lines[k].alternatives.join(' | ') && r[ij] === c.bom.lines[k].alternativesJudged), `${gen} ${cell}: the CSV's alternatives columns are not the lines'`);
  console.log(`  ${gen.padEnd(16)} ${cell.padEnd(11)} ${String(n.cand).padStart(3)} candidates, ${String(n.pass).padStart(2)} passed, failed ${JSON.stringify(n.fail)}, not judged ${JSON.stringify(n.nj)}`);
}
ok(!FORBIDDEN.test(S.SUBSTITUTE_HONESTY.replace(/not stock/, '')) && /not stock/.test(S.SUBSTITUTE_HONESTY) && /modelled, not built/.test(S.SUBSTITUTE_HONESTY), 'the honesty line');

// ── CONTROLS
console.log('\nCONTROLS');
{
  // a gear of another tooth count: 4019 (16T) offered for 3647 (8T)
  const fake = { rb: 'control', rel: 'A', dir: 'child', ldraw: '4019', name: 'control', bricklink: { number: '4019', name: 'control', elements: { 71: ['x'] } } };
  const pj = J.preJudge('3647', fake, idx.get('3647'), libs);
  control('a 16-tooth gear offered for the 8-tooth one is refused by the ratio judge', pj.status === 'fail' && pj.judge === 'ratio');
  // with its geometry swapped in anyway, the frame tables' judge fails it on the tip radius. (The build probe alone
  // PASSES it: its mesh judge folds the tips by the placement's count, and 16 tips fold by 8 as cleanly as 8 do —
  // which is why every candidate runs every judge of its cells, and why the ratio judge comes first.)
  const geo = await J.runProbe({ probe: 'ldraw', arg: null }, '3647', '4019');
  control('…and with its geometry swapped in anyway, the frame tables\' judge (probe-technic-ldraw) fails it on the tip', !geo.ok && !geo.error && geo.substituted && geo.why.some((w) => /3647: tip/.test(w)));
  // a forged verdict: one re-judged verdict with its recorded result flipped
  const anyGeo = all.find((v) => v.judges?.length) ?? all.find((v) => v.status !== 'skip');
  if (anyGeo) {
    const forged = { ...anyGeo, status: anyGeo.status === 'pass' ? 'fail' : 'pass', judge: anyGeo.status === 'pass' ? 'build' : null,
      judges: (anyGeo.judges ?? []).map((j, k) => (k === 0 ? { ...j, ok: !j.ok } : j)) };
    control(`a forged verdict (${anyGeo.candidate} recorded the other way) is reported by the comparison`, !!differs(forged, anyGeo));
  }
  // a substitute offered in a colour BrickLink does not list
  const pass = all.find((v) => v.status === 'pass');
  const somePassed = (() => { for (const gen of B.GENERATIONS) for (const cell of B.cellIds()) { const c = B.bomForCell(libs.main, gen, cell); for (const l of c.bom?.lines ?? []) if (l.substitutes.passed.length) return l.substitutes.passed[0]; } return null; })();
  if (somePassed) {
    const unlisted = Object.keys(BRICKLINK.colours).find((code) => !(REBRICKABLE.lines[Object.keys(V).find((id) => V[id].some((v) => v.candidate === somePassed.ldraw))].candidates.find((c) => c.ldraw === somePassed.ldraw).bricklink.elements[code] ?? []).length);
    const forgedRow = { ...somePassed, offer: { ...somePassed.offer, code: Number(unlisted), elements: [] } };
    control(`an alternative offered in ${BRICKLINK.colours[unlisted]?.name}, which BrickLink does not list it in, is reported by the list check`, listBad([forgedRow]).length === 1 && listBad([somePassed]).length === 0);
  } else control('a passing substitute exists to forge a colour on', false);
  void pass;
  // a candidate with no element in any page colour
  const none = { rb: 'control', rel: 'A', dir: 'child', ldraw: '10928', name: 'control', bricklink: { number: '10928', name: 'control', elements: {} } };
  const pn = J.preJudge('3647', none, idx.get('3647'), libs);
  control('a candidate BrickLink lists in no page colour is refused by the bricklink judge', pn.status === 'fail' && pn.judge === 'bricklink');
  control('…and offerColour has no colour to offer it in', S.offerColour(none, 71) === null);
  // the overlay: the substituted name reads the candidate's geometry, and its own name is untouched
  // (the two 8Ts have the same bounds, so the control reads the files' geometry lines, not a box)
  const before = JSON.stringify(libs.main.get('3647.dat').lines), sub = overlay(libs.main, libs.cand, '3647', '10928');
  const tri = (lib, n) => { let k = 0; walk(lib, n, (kind) => { if (kind === 'tri') k++; }); return k; };
  control('under TECHNIC_SUBSTITUTE=3647=10928, 3647.dat is 10928\'s geometry and the main pack\'s 3647 is untouched',
    JSON.stringify(sub.get('3647.dat').lines) === JSON.stringify(sub.get('10928.dat').lines) && JSON.stringify(sub.get('3647.dat').lines) !== before
    && tri(sub, '3647.dat') === tri(sub, '10928.dat') && tri(sub, '3647.dat') !== tri(libs.main, '3647.dat') && JSON.stringify(libs.main.get('3647.dat').lines) === before);
  void bounds;
}
for (const [n, c] of controls) ok(c, `control not caught: ${n}`);
console.log(controls.map(([n, c]) => `  ${c ? 'ok  ' : 'MISS'} ${n}`).join('\n'));
console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${checks} checks, ${controls.length} controls, ${fails} failed${quick ? ' (QUICK: geometric verdicts not re-run)' : ''}, ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(fails ? 1 : 0);
