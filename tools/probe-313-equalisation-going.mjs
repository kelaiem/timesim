// TODO 313 — DOES THE EQUALISATION GATE HOLD THE GOING TRAIN ON AN ALARM-FREE BUILD, AND DOES AN ABSENT RECORD FAIL?
// Acceptance. Before TODO 313 the whole TODO 32 record was computed inside buildAlarm(), so `?alarm=0` published none
// and checkEqualisation returned ok on the empty payload, holding nothing. Boots `alarm=0` natively, in this process,
// and holds:
//   1. the build publishes equalisation.going with its energy column, and equalisation.alarm is null;
//   2. its going half is the round default's, read off the same build laws (the going train does not depend on the
//      alarm): the record a default boot publishes, compared key for key (a second process);
//   3. the gate PASSES there with its going rows read (the energy column in its payload) and the alarm half STANDING
//      DOWN by the build's word (clock.modules.alarm false), named in `standDown`;
//   4. controls — the same judge fed broken copies of the clock (each a prototype child, so every other surface is the
//      real build's), each of which must FAIL:
//      (a) no going record (the regression TODO 313 removed: equalisation { going: undefined });
//      (b) no record at all (equalisation undefined);
//      (c) the alarm record missing on a build whose word says it carries the alarm (modules.alarm true).
//   node --import ./tools/native/loader.mjs tools/probe-313-equalisation-going.mjs      (exit 1 on any claim)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[2] === '--default-going') {
  const { bootNative } = await import('./native/host.mjs');
  const r = await bootNative({ query: '' });
  process.stdout.write('\n@@' + JSON.stringify(r.clock.equalisation.going) + '\n');
  process.exit(0);
}
const fails = [];
const say = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
// the default boots first, in its own process, before this one installs the native host
const child = spawnSync(process.execPath, ['--import', './tools/native/loader.mjs', fileURLToPath(import.meta.url), '--default-going'],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26,
    // the loader marks the environment once it has registered (loader.mjs), so the child must not inherit the mark
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== '__TIMESIM_NATIVE_LOADER__')) });
const { bootNative } = await import('./native/host.mjs');
const r = await bootNative({ query: 'alarm=0' });
const clock = r.clock, E = clock.equalisation;
say(!!(E && E.going && E.going.energy && E.going.energy.amplitude) && E.alarm === null,
  `1. alarm=0 publishes equalisation.going with its energy column, alarm null (going ${E && E.going ? 'present' : 'MISSING'}, alarm ${E ? JSON.stringify(E.alarm) : '—'})`);
const line = (child.stdout || '').split('\n').find((l) => l.startsWith('@@'));
const sortKeys = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
if (!line) console.log('    (the default boot printed no record: ' + (child.stderr || '').split('\n').filter((l) => /Error|Cannot|url|code/.test(l)).slice(0, 4).join(' / ').slice(0, 400) + ')');
else if (sortKeys(JSON.parse(line.slice(2))) !== sortKeys(JSON.parse(JSON.stringify(E.going)))) {
  const a = JSON.parse(line.slice(2)), b = JSON.parse(JSON.stringify(E.going));
  const diff = (x, y, path = '') => { if (JSON.stringify(x) === JSON.stringify(y)) return [];
    if (x && y && typeof x === 'object' && typeof y === 'object') return [...new Set([...Object.keys(x), ...Object.keys(y)])].flatMap((k) => diff(x[k], y[k], path + '.' + k));
    return [`${path}: default ${JSON.stringify(x)?.slice(0, 80)} vs alarm=0 ${JSON.stringify(y)?.slice(0, 80)}`]; };
  for (const d of diff(a, b).slice(0, 8)) console.log('    ' + d);
}
say(!!line && sortKeys(JSON.parse(line.slice(2))) === sortKeys(JSON.parse(JSON.stringify(E.going))),
  '2. its going half equals the round default\'s, key for key');
const { checkEqualisation } = await import('../src/inspect.js');
const real = checkEqualisation(clock);
say(real.ok === true && real.failures.length === 0 && !!(real.going && real.going.energy)
  && Array.isArray(real.standDown) && real.standDown.some((s) => s.half === 'alarm') && real.alarm === null,
  `3. the gate passes with its going rows read and the alarm half standing down: ${real.summary}`);
const child2 = (over) => Object.create(clock, Object.fromEntries(Object.entries(over).map(([k, v]) => [k, { value: v }])));
const cases = [
  ['(a) no going record', { equalisation: Object.freeze({ going: undefined, alarm: null }) }],
  ['(b) no record at all', { equalisation: undefined }],
  ['(c) the alarm record missing where the build says it carries the alarm', { modules: { ...clock.modules, alarm: true } }],
];
for (const [what, over] of cases) {
  let res; try { res = checkEqualisation(child2(over)); } catch (e) { res = { ok: false, threw: e.message }; }
  say(res.ok === false, `4${what}: the gate FAILS (${res.threw ? 'threw: ' + res.threw.slice(0, 80) : (res.failures || []).map((f) => f.what).join(', ')})`);
}
process.exit(fails.length ? 1 : 0);
