// §351 landing 0 — THE ONE SPEC SCHEMA, HELD: is every key the URL can carry declared once, resolved by its declared kind,
// and NEVER DROPPED IN SILENCE? Acceptance (exit 1 on any failure). Pure Node, no boot: layout.js imports only the table,
// so each query resolves in its own module instance in milliseconds.
//
//   node tools/probe-spec-schema.mjs
//
//   S1 the table: every row of src/spec-fields.js names a field (no two the same), a kind layout.js' specHonoured reads,
//      where it is offered ('menu' | 'experimental' | 'url') and what it accepts
//   S2 the arrangement key: arrangementSpec nulls exactly the rows marked `arrangement: false`, and that set is the seven
//      fields the generated gong-seat and arming tables are keyed without (src/gong-seats.js' GONG_SEATS_ARRANGED, main.js'
//      ALARM_PINB_SEAT_FIXED). Moving a key in or out of it re-keys those tables, so it fails here first
//   S3 the offerings agree with the pages that offer them: the 'experimental' rows are exactly the keys
//      src/experimental-specs.js sets, and usage.js' dropdown keys are exactly the rows not offered 'url'
//   S4 NOTHING SILENT: for every key, a value it does not take (and, for a clamped or snapped kind, a value outside its
//      window) leaves the build carrying something else AND a refusal naming that key; a value it takes, in the context it
//      needs, produces no refusal at all; and every CI spec point (tools/ci-battery.mjs' SPEC_POINTS queries) resolves
//      with no refusal from the honoured pass (a point may carry a stated refusal: vph=28800's is the point of that row)
//   CONTROLS: specHonoured judges a spec with the key's field dropped as NOT honoured (the rule can fail), and a query with
//      a nonsense case reaches SPEC_REFUSALS (the pass runs at all)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const F = await import(pathToFileURL(`${ROOT}/src/spec-fields.js`).href);
const X = await import(pathToFileURL(`${ROOT}/src/experimental-specs.js`).href);
const { SPEC_FIELDS, publishSpec } = F;

let fail = 0;
const ok = (msg, pass, detail = '') => { console.log(`${pass ? 'OK  ' : 'FAIL'} ${msg}${detail ? ` — ${detail}` : ''}`); if (!pass) fail++; };

// one query → its own layout.js instance (the spec is read once, at import)
let n = 0;
const quiet = console.warn;
async function resolveQuery(q) {
  delete globalThis.__WATCH_SPEC;
  publishSpec(q ? `?${q}` : '', globalThis);
  console.warn = () => {};
  try { return await import(pathToFileURL(`${ROOT}/src/layout.js`).href + `?probe=${n++}`); } finally { console.warn = quiet; }
}
const L0 = await resolveQuery('');

// S1
const rows = Object.entries(SPEC_FIELDS);
const fields = rows.map(([, r]) => r.field);
ok('S1 every row names a field, and no two the same', fields.every(Boolean) && new Set(fields).size === fields.length);
const badKind = rows.filter(([k]) => { try { L0.specHonoured(k, 1, L0.SPEC, L0.ROUTE_SPEC); return false; } catch { return true; } }).map(([k]) => k);
ok('S1 every row\'s kind is one specHonoured reads', badKind.length === 0, badKind.join(', '));
ok('S1 every row says where it is offered', rows.every(([, r]) => ['menu', 'experimental', 'url'].includes(r.offered)), rows.filter(([, r]) => !['menu', 'experimental', 'url'].includes(r.offered)).map(([k]) => k).join(', '));
ok('S1 every row says what it accepts', rows.every(([, r]) => typeof r.accepts === 'string' && r.accepts.length > 0));

// S2
const ARRANGEMENT_FREE = ['arrest', 'strapMm', 'formRectSpec', 'caseShape', 'frame', 'hands', 'gongSeat'];
const declared = rows.filter(([, r]) => r.arrangement === false).map(([, r]) => r.field).sort();
ok('S2 the arrangement-free rows are the seven the seat tables are keyed without', declared.join() === [...ARRANGEMENT_FREE].sort().join(), declared.join(', '));
const probeSpec = Object.fromEntries(fields.map((f) => [f, `v:${f}`]));
const arr = L0.arrangementSpec(probeSpec);
ok('S2 arrangementSpec nulls exactly those, and keeps every other field', fields.every((f) => (ARRANGEMENT_FREE.includes(f) ? arr[f] === null : arr[f] === `v:${f}`)));

// S3
const expKeys = new Set(X.EXPERIMENTAL_SPECS.map((r) => r.param));
const offeredExp = new Set(rows.filter(([, r]) => r.offered === 'experimental').map(([k]) => k));
ok('S3 the experimental rows are exactly the keys the Experimental build group sets', [...expKeys].sort().join() === [...offeredExp].sort().join(), `${[...expKeys]} vs ${[...offeredExp]}`);
const usage = readFileSync(`${ROOT}/src/usage.js`, 'utf8');
ok('S3 usage.js derives its dropdown keys from the table', /SPEC_DROPDOWNS = new Set\(Object\.keys\(SPEC_FIELDS\)\.filter\(\(k\) => SPEC_FIELDS\[k\]\.offered !== 'url'\)\)/.test(usage));

// S4 — a value each key does not take, and (for a kind that clamps or snaps) one outside its window
const BAD = { vph: ['12345', 'x'], reserveh: ['31', '60', 'x'], step: ['400', 'x'], angle: ['x'], number: ['x'], marker: ['other'],
  idlers: ['3', 'x'], choice: ['zz'], barrels: ['5', 'x'], pulley: ['x'], alarm: ['x'], strap: ['0', 'x'], formrect: ['bad'], route: ['bad'] };
const badFor = (k, r) => BAD[k] ?? BAD[r.kind];
for (const [k, r] of rows) {
  for (const v of badFor(k, r) ?? []) {
    const L = await resolveQuery(`${k}=${encodeURIComponent(v)}`);
    const named = L.SPEC_REFUSALS.some((x) => x.keys.includes(k));
    ok(`S4 ?${k}=${v} is named, never dropped in silence`, named, named ? '' : `SPEC.${r.field} = ${JSON.stringify(L.SPEC[r.field])}`);
  }
}
// values each key takes, in the context it needs: no refusal at all
const GOOD = ['vph=18000', 'vph=21600', 'reserveh=36', 'reserveh=24', 'crownaz=390', 'crownaz=-30', 'barrelstep=-180', 'escstep=-70', 'balstep=60',
  'alarmaz=175', 'alarmmod=200', 'alarmbarrelaz=10', 'alarmgovaz=5', 'alarmanchoraz=7', 'stemaz=200', 'd4=20', 'rsvr=20', 'rsvaz=36',
  'arrangement=designed', 'rsvidl=0', 'rsvidl=4', 'rsvsweep=90', 'arrest=stop-iron', 'arrest=trailing', 'arrest=geared', 'arrest=stopwork',
  'barrels=1', 'barrels=2&alarm=0&vph=36000', 'pulley=1', 'pulley=0', 'drumaz=140', 'strap=18', 'strap=19', 'strap=22', 'alarm=0', 'alarm=1',
  'alarmr=14', 'subdialr=8', 'dialr=46', 'studr=7', 'case=rect', 'case=round', 'case=fitted&formrect=-49,49,-43,43,0.8,0.02', 'case=rect&formrect=-47,47,-43,43',
  'frame=pillars', 'frame=lands', 'hands=slide&case=fitted', 'gong=bar', 'gong=spiral', 'route=1,2,3;4,5,6&routebush=0,0.5'];
for (const q of GOOD) {
  const L = await resolveQuery(q);
  ok(`S4 ?${q} builds as asked, with no refusal`, L.SPEC_REFUSALS.length === 0, L.SPEC_REFUSALS.map((x) => x.text).join(' | '));
}
const points = [...new Set([...readFileSync(`${ROOT}/tools/ci-battery.mjs`, 'utf8').matchAll(/\bq: '([^']*)'/g)].map((m) => m[1]))];
const pointRefused = [];
for (const q of points) { const L = await resolveQuery(q); const u = L.SPEC_REFUSALS.filter((x) => x.by === 'unused'); if (u.length) pointRefused.push(`${q}: ${u.map((x) => x.text).join(' | ')}`); }
ok(`S4 every CI spec point (${points.length}) resolves with no unused key`, points.length > 20 && pointRefused.length === 0, pointRefused.join(' || '));

// CONTROLS
const dropped = rows.filter(([k, r]) => !['marker', 'route', 'alarm', 'pulley', 'barrels', 'strap'].includes(r.kind)
  && L0.specHonoured(k, 7, { ...L0.SPEC, [r.field]: null }, L0.ROUTE_SPEC).ok).map(([k]) => k);
ok('CONTROL specHonoured judges a dropped field as not honoured, for every kind that reads the field', dropped.length === 0, dropped.join(', '));
const Lc = await resolveQuery('case=zz');
ok('CONTROL a nonsense case reaches SPEC_REFUSALS, so the pass runs', Lc.SPEC_REFUSALS.length === 1 && Lc.SPEC_REFUSALS[0].keys[0] === 'case' && Lc.SPEC_REFUSALS[0].by === 'unused' && Lc.SPEC.caseShape === null);
const Lr = await resolveQuery('arrangement=designed&vph=28800');
ok('CONTROL a stated refusal is told apart from an unused key', Lr.SPEC_REFUSALS.length === 1 && Lr.SPEC_REFUSALS[0].by === 'rule');

console.log(fail ? `\n${fail} FAILED` : '\nall pass');
process.exit(fail ? 1 : 0);
