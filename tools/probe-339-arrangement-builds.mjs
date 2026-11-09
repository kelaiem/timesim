// WHAT DOES A BARREL STEP DO TO EVERY BUILD THE ARRANGEMENT REACHES? A REPORT (BACKLOG §339 2b′: it judges nothing).
//
//   node tools/probe-339-arrangement-builds.mjs [--step 0] [--par N] [--json FILE] ['<query>' …]
//
// layout.js' ARRANGEMENT (barrelStepDeg −20 today) is every build's that names none of its keys, so a step measured on one
// build is adopted only once every build the arrangement reaches is read at it. WHAT THIS CANNOT SEE: a collision. It reads
// BUILD warnings, and a part through another is the battery's sweep finding, not a warning: 0° gave the alarm-free fitted
// case 8.7% back here with no new warning, and puts the great wheel through the third wheel's arbor (13.59 between the
// axes against the 17.43 ARRANGEMENT's comment derives, which the step first reaches at −19°). A step this reads clean is
// a CANDIDATE for the battery, never a landing. Each query below is booted twice, with the arrangement's keys NAMED both times
// (a URL naming one takes none of the others, so both carry all four): once at ARRANGEMENT's own values (the control,
// which must read exactly what the bare query builds: the same build warnings and the same case area) and once with
// barrelstep set to --step. Per build it prints the case area (formFootprint.fitAreaMm2 on a form case, null on the
// round), the boot's BUILD warnings (__clock.buildWarns, rule 6's set: the live loop's runWarns are not the build's), and
// which warnings the step adds or retires, matched with their numbers masked (a warning that only moves its figures is
// the same row). A bare boot is read for the control only on the first query, the identity build.
//
// The default queries are the arrangement-reaching spec points of tools/ci-battery.mjs' SPEC_POINTS (every point that
// does not pass arrangement=designed) and the form cases with and without the alarm: the gong seats are generated PER
// ARRANGEMENT (src/gong-seats.js), so an alarm form build at a new step reads the seat table's absence, which is a row
// this report names rather than hides.
import { writeFileSync } from 'node:fs';
import { bootMany, perfCores } from './boot-pool.mjs';
import { ARRANGEMENT } from '../src/layout.js';

const args = process.argv.slice(2);
const take = (flag) => { const i = args.indexOf(flag); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const STEP = Number(take('--step') ?? 0), PAR = Number(take('--par')) || perfCores(), JSON_OUT = take('--json');
const QUERIES = args.length ? args : ['', 'case=rect', 'case=cushion', 'case=tonneau', 'case=fitted',
  'alarm=0', 'alarm=0&case=rect', 'alarm=0&case=cushion', 'alarm=0&case=tonneau', 'alarm=0&case=fitted',
  'frame=pillars', 'case=fitted&frame=pillars', 'vph=28800', 'reserveh=48', 'arrest=geared&reserveh=24', 'arrest=geared&reserveh=36'];
// the arrangement's keys, as the URL spells them (src/spec-fields.js)
const KEY = { barrelStepDeg: 'barrelstep', rsvAzDeg: 'rsvaz', alarmModAzDeg: 'alarmmod', rsvIdlers: 'rsvidl' };
const keys = (o) => Object.entries(o).map(([k, v]) => `${KEY[k]}=${v}`).join('&');
const join = (q, k) => [q, k].filter(Boolean).join('&');
const AT = keys(ARRANGEMENT), STEPPED = keys({ ...ARRANGEMENT, barrelStepDeg: STEP });
const EXPR = `({ warns: window.__clock.buildWarns ?? null, area: window.__clock.formFootprint?.fitAreaMm2 ?? null })`;
const jobs = [{ q: QUERIES[0], tag: 'bare' }, ...QUERIES.flatMap((q) => [{ q: join(q, AT), tag: 'at', base: q }, { q: join(q, STEPPED), tag: 'step', base: q }])];
console.log(`ARRANGEMENT ${AT}; stepped: barrelstep ${STEP}; ${jobs.length} boots, ${PAR} at once`);
const rs = await bootMany(jobs.map((j) => j.q), EXPR, { concurrency: PAR });
const mask = (w) => String(w).replace(/[-+]?\d+(\.\d+)?(e[-+]?\d+)?/gi, '#');
const read = (r) => (r.bootError || !r.extra ? { error: r.bootError ?? 'no reading' } : { area: r.extra.area, warns: (r.extra.warns ?? []).map(String) });
const res = jobs.map((j, i) => ({ ...j, ...read(rs[i]), unknownKeys: rs[i].unknownKeys ?? null }));
const f = (a) => (a == null ? 'round' : `${a.toFixed(1)} mm²`);
let controlOk = true;
const bare = res[0], at0 = res[1];
if (bare.error || at0.error) { console.log(`CONTROL: a boot failed (${bare.error ?? at0.error})`); controlOk = false; }
else {
  const same = bare.area === at0.area && JSON.stringify(bare.warns.map(mask).sort()) === JSON.stringify(at0.warns.map(mask).sort());
  console.log(`CONTROL: the identity build bare and with ARRANGEMENT's keys named ${same ? 'read the same' : 'DIFFER'} (${f(bare.area)}, ${bare.warns.length} build warnings)`);
  controlOk = same;
}
const rows = [];
for (const q of QUERIES) {
  const a = res.find((r) => r.tag === 'at' && r.base === q), s = res.find((r) => r.tag === 'step' && r.base === q);
  const name = q || '(identity)';
  if (a.error || s.error || a.unknownKeys?.length || s.unknownKeys?.length) {
    console.log(`${name}: ${a.error ? `at −20 FAILED (${a.error})` : ''}${s.error ? ` at ${STEP} FAILED (${s.error})` : ''}${a.unknownKeys?.length ? ' unknown keys ' + a.unknownKeys : ''}`);
    rows.push({ q, at: a, step: s }); continue;
  }
  const ma = new Set(a.warns.map(mask)), ms = new Set(s.warns.map(mask));
  const added = s.warns.filter((w) => !ma.has(mask(w))), retired = a.warns.filter((w) => !ms.has(mask(w)));
  const d = a.area != null && s.area != null ? ` (${s.area < a.area ? '−' : '+'}${Math.abs(s.area - a.area).toFixed(1)}, ${((s.area / a.area - 1) * 100).toFixed(1)}%)` : '';
  console.log(`${name}: ${f(a.area)} → ${f(s.area)}${d}; build warnings ${a.warns.length} → ${s.warns.length}, ${added.length} added, ${retired.length} retired`);
  for (const w of added) console.log(`    + ${w.slice(0, 220)}`);
  for (const w of retired) console.log(`    − ${w.slice(0, 220)}`);
  rows.push({ q, at: { area: a.area, warns: a.warns }, step: { area: s.area, warns: s.warns }, added, retired });
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ arrangement: ARRANGEMENT, step: STEP, controlOk, rows }, null, 1));
process.exit(0);
