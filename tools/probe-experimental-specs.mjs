// DOES EVERY OPTION THE EXPERIMENTAL BUILD GROUP OFFERS BUILD WHAT IT SAYS, SILENTLY? Acceptance (exit 1 on any failure).
//
//   node --import ./tools/native/loader.mjs tools/probe-experimental-specs.mjs
//
// src/experimental-specs.js is the table the panel's Appearance → Advanced → Experimental build group is generated from,
// and its rule is that a feature is offered only where one of its builds is CLEAN. So for every row and every value but
// the off one, this applies the value and its requirements to an empty query exactly as the panel does
// (experimentalSearch), boots the result natively, and holds three things:
//   1. the spec REFUSED nothing (layout.js SPEC_REFUSALS empty): the requirements are the resolver's own conditions,
//   2. the option adds NO WARNING to the build it is picked on: its boot warns exactly what the same query without the
//      row's key warns (the fitted case's own rows, say, when the sliding hands put the case there), and the row's
//      `cleanAt` build, the one that earns it a place in the group, boots SILENT (rule 6),
//   3. the row reads its own value back off the RESOLVED spec (row.current), so the control shows the build it made.
// Each boot is its own process, because the spec is read once, when layout.js is first imported.
//
// CONTROLS, which must FAIL the same tests, or the probe is measuring nothing:
//   C1 the double barrel with its requirements stripped (?barrels=2 alone) must be refused, and read back as off;
//   C2 the double barrel at the default beat (its needs less the 36,000) must boot with warnings: the reason the option
//      sets the beat at all.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv[2] === '--one') {
  // the child: boot one query, then read the resolved spec off the very module instance the build imported
  const { bootNative } = await import('./native/host.mjs');
  const r = await bootNative({ query: process.argv[3] ?? '' });
  const L = await import('../src/layout.js');
  const X = await import('../src/experimental-specs.js');
  const current = Object.fromEntries(X.EXPERIMENTAL_SPECS.map((row) => [row.id, row.current(L.SPEC)]));
  process.stdout.write('\n@@' + JSON.stringify({ warns: r.warns, refusals: L.SPEC_REFUSALS.map((r) => r.text), current }) + '\n');
  process.exit(0);
}

const { EXPERIMENTAL_SPECS, experimentalSearch } = await import('../src/experimental-specs.js');
// the loader guards its own registration through an environment variable, which a spawned child inherits: drop it, or the
// child's loader skips registering and `three` resolves to nothing
const childEnv = { ...process.env };
delete childEnv.__TIMESIM_NATIVE_LOADER__;
const boot = (query) => new Promise((done) => {
  const p = spawn(process.execPath, ['--import', './tools/native/loader.mjs', 'tools/probe-experimental-specs.mjs', '--one', query], { cwd: ROOT, env: childEnv });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => {
    const i = out.lastIndexOf('\n@@');
    if (code !== 0 || i < 0) return done({ error: `boot of '${query}' failed (exit ${code}): ${err.slice(-400)}` });
    done(JSON.parse(out.slice(i + 3)));
  });
});

const jobs = [];
for (const row of EXPERIMENTAL_SPECS)
  for (const [value] of row.options) if (value !== '')
    jobs.push({ row, value, query: experimentalSearch('', row, value, { caseShape: null }).search });
const baseOf = (j) => { const p = new URLSearchParams(j.query); p.delete(j.row.param); return p.toString(); };
const dbl = EXPERIMENTAL_SPECS.find((r) => r.id === 'double-barrel');
const controls = [
  { name: 'C1', row: dbl, query: 'barrels=2' },
  { name: 'C2', row: dbl, query: new URLSearchParams(Object.entries(dbl.requires[2]).filter(([k, v]) => v !== null && k !== 'vph').concat([['barrels', '2']])).toString() },
];

// three boots at a time: each is one main thread, and the container's cores are few
const all = [...new Set([...jobs.flatMap((j) => [j.query, baseOf(j)]), ...EXPERIMENTAL_SPECS.map((r) => r.cleanAt), ...controls.map((c) => c.query)])];
const results = new Map();
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (next < all.length) { const q = all[next++]; results.set(q, await boot(q)); } }));

let fail = 0;
const row = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fail++; };
for (const j of jobs) {
  const r = results.get(j.query), tag = `${j.row.id}=${j.value} ('${j.query}')`;
  if (r.error) { row(false, `${tag}: ${r.error}`); continue; }
  row(r.refusals.length === 0, `${tag}: nothing refused${r.refusals.length ? ` — ${r.refusals.join(' | ').slice(0, 300)}` : ''}`);
  const b = results.get(baseOf(j));
  // a warning is the same ROW when it opens with the same name (the text before its first colon: the battery's own
  // declared-warning rule, matchDeclaredWarns, which never compares the measured numbers). A row present in both whose
  // TEXT moved is reported, not failed: the option made the base's own finding larger or smaller, and says by how much.
  const nameOf = (w) => w.split(':')[0];
  const added = b.error ? null : r.warns.filter((w) => !b.warns.some((x) => nameOf(x) === nameOf(w)));
  for (const w of b.error ? [] : r.warns.filter((w) => !b.warns.includes(w) && !added.includes(w)))
    console.log(`     (reported) ${j.row.id}=${j.value} moves its base's row: ${w.slice(0, 160)}`);
  row(added !== null && added.length === 0, `${tag}: adds no warning over '${baseOf(j)}' (${r.warns.length} vs ${b.warns?.length})${added?.length ? ` — ${added.map((w) => w.slice(0, 80)).join(' | ')}` : ''}`);
  row(r.current[j.row.id] === j.value, `${tag}: reads back as '${r.current[j.row.id]}'`);
}
for (const r0 of EXPERIMENTAL_SPECS) {
  const r = results.get(r0.cleanAt);
  row(!r.error && r.warns.length === 0 && r.refusals.length === 0 && r.current[r0.id] !== '',
    `${r0.id}: its clean build '${r0.cleanAt}' boots silent, refuses nothing and has the feature${r.warns?.length ? ` — ${r.warns.length}: ${r.warns.map((w) => w.slice(0, 80)).join(' | ')}` : ''}`);
}
const c1 = results.get(controls[0].query), c2 = results.get(controls[1].query);
row(!c1.error && c1.refusals.length > 0 && c1.current['double-barrel'] === '', `C1 control: '${controls[0].query}' is refused and reads back off (${c1.refusals?.length} refusal)`);
row(!c2.error && c2.warns.length > 0, `C2 control: '${controls[1].query}' (the default beat) boots with warnings (${c2.warns?.length})`);
console.log(fail ? `\n${fail} FAILED` : `\nall ${jobs.length * 3 + EXPERIMENTAL_SPECS.length + 2} rows pass`);
process.exit(fail ? 1 : 0);
