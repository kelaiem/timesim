// §36 Apply — the acceptance, and the only place the APPLIED tree is judged.
//
// The battery's gates all run on the identity movement, and the two route
// SPEC_POINTS it boots check silence, not geometry. So nothing in the battery
// measures an applied route's metal — its slenderness declaration, its support
// claim, its graph row, its sections. That gap is this probe's whole reason to
// exist, and it is worth stating sharply because the numbers look reassuring
// either way: on the identity tree `slenderness` reports
// "0 unsupported, 1 declare 2 bearings" and every one of those bearings is the
// ALARM LINK's. It would print exactly that if this entry's declaration were
// nonsense.
//
//   node tools/probe-36-apply.mjs [route] [routebush]
//
// The default is the canonical route, the same one SPEC_POINTS boots: two legs
// meeting at a bend, crossing the back plate once, carrying one bush. It is
// the least route that exercises every part of the solve — a bore, a knuckle,
// a bearing declaration, and a free span shorter than its own leg.
//
// What it asserts, in the order a failure would matter:
//   1. the unit exists, and its meshes are the ones the solve described
//   2. every declared bearing station has METAL at it (§54's `unsupported`
//      tier — supportAt seeks a SIBLING mesh whose box contains the station,
//      which is why the bushes belong to the route's unit and not the plate)
//   3. the graph row's support claim measures real (`support`, 0 failures)
//   4. the declaration and the build agree (`graph`, every list empty)
//   5. the sections clear §50's floor with no waiver (`stockFloor`)
//   6. nothing the route added intersects the movement (`inspection`, on the
//      axes cheap enough to iterate against)
//
// The throttling trap is why the launch carries --disable-background-timer-
// throttling and why the poll lives in NODE rather than in the page: an
// automated pane throttles setTimeout to ~1 s, so a status loop written inside
// page.evaluate sleeps for twenty minutes and reports nothing. Every probe
// here launches the same way for the same reason.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ROUTE = process.argv[2] || '26,0,-6;26,0,3;31,0,3';
const BUSH = process.argv[3] ?? '0,0.33';
const port = process.env.PORT || '8471';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: [
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });
const page = await browser.newPage();
const warns = [];
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GroupMarker/.test(m.text())) warns.push(m.text()); });

const q = `?route=${encodeURIComponent(ROUTE)}${BUSH ? `&routebush=${encodeURIComponent(BUSH)}` : ''}`;
await page.goto(`http://127.0.0.1:${port}/index.html${q}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
// BOOT warnings are the ones rule 6 is about, so they are snapshotted HERE,
// before a single check runs. The first cut of this probe collected console
// warnings for the whole session and then reported them as the boot's: what it
// actually caught was three-mesh-bvh's "Triangles are coplanar" notice, emitted
// by the INSPECTION sweep long after boot. A silence claim that includes the
// instruments' own chatter is not a silence claim about the build.
const bootWarns = warns.splice(0, warns.length);
await page.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
await page.evaluate(() => window.__clock.beginSweepHold());

const run = async (name, opts) => {
  await page.evaluate(([n, o]) => window.__I.start(window.__clock, n, o), [name, opts]);
  for (let i = 0; i < 900; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate((n) => {
      const s = window.__I.status(n);
      return s.state === 'running' ? { state: 'running' } : s;
    }, name);
    if (st.state === 'done') return st.result;
    if (st.state === 'error') throw new Error(`${name} threw:\n${st.error}`);
  }
  throw new Error(`${name} did not finish`);
};

const fail = [];
const check = (ok, what, detail) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `   ${detail}` : ''}`); if (!ok) fail.push(what); };

console.log(`\n§36 Apply — route ${ROUTE}${BUSH ? `  bush ${BUSH}` : ''}\n`);

// 1 — the metal exists, and it is the metal the solve described.
const unit = await page.evaluate((n) => {
  const e = window.__clock.labelEntries.find((x) => x.name === n);
  if (!e) return null;
  const meshes = [], bearings = [];
  e.obj.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o.name || '(unnamed)');
    if (o.userData && o.userData.bearings) bearings.push({ mesh: o.name, ...o.userData.bearings });
  });
  return { meshes, bearings };
}, 'Applied route');
check(!!unit, 'the unit is registered and built');
if (!unit) { console.log('\nnothing further can be measured'); await browser.close(); srv.kill(); process.exit(1); }
console.log(`        meshes: ${unit.meshes.join(', ')}`);
check(unit.meshes.every((m) => m !== '(unnamed)'), 'every mesh is named (§54 rows must name their member)');
check(new Set(unit.meshes).size === unit.meshes.length,
  'every mesh name is DISTINCT', '(a shared name collapses report rows — §137)');
check(unit.bearings.length > 0, 'the arbor declares its bearings', JSON.stringify(unit.bearings.map((b) => [b.mesh, b.stations.length])));

// 2 — the declaration against the metal. THE point of this probe.
const sl = await run('slenderness', {});
const uns = sl.bearings.unsupported || [], mal = sl.bearings.malformed || [];
check(uns.length === 0, 'every declared bearing has metal at it (§54 unsupported)', uns.length ? JSON.stringify(uns) : '');
check(mal.length === 0, 'no malformed bearing declaration', mal.length ? JSON.stringify(mal) : '');
console.log(`        declared: ${sl.bearings.declaredMeshes} mesh(es), ${sl.bearings.stations} station(s) — the alarm link contributes 1 and 2`);
const routeRows = (sl.rows || []).filter((r) => r.unit === 'Applied route');
check(routeRows.length === 0, 'no route member is over §54\'s ceiling',
  routeRows.length ? JSON.stringify(routeRows.map((r) => [r.mesh, r.lambda])) : '(sections were sized by that ceiling)');

// 3/4 — the claims the graph row makes.
const sup = await run('support', {});
check((sup.failures || []).length === 0, 'support: every claim measures real metal',
  (sup.failures || []).length ? JSON.stringify(sup.failures.slice(0, 3)) : '');
const g = await run('graph', {});
const gv = Object.entries(g).filter(([k, v]) => Array.isArray(v) && v.length && k !== 'todo');
check(gv.length === 0, 'graph: declared and built agree', gv.length ? JSON.stringify(gv.map(([k, v]) => [k, v.length])) : '');

// 5 — the sections.
const sf = await run('stockFloor', {});
const sfRoute = (sf.violations || []).filter((r) => r.unit === 'Applied route');
check((sf.degenerate || []).length === 0, 'stockFloor: nothing degenerate');
check(sfRoute.length === 0, 'stockFloor: the route clears the floor UNWAIVED',
  sfRoute.length ? JSON.stringify(sfRoute.slice(0, 3)) : '(zero kind rows, zero waivers — the §35 lesson)');

// 6 — the route against the rest of the movement.
const insp = await run('inspection', { axes: ['crown', 'alarmToggle'], yieldEvery: 64 });
const forb = (insp.report || []).filter((r) => r.class === 'FORBIDDEN');
check(forb.length === 0, 'inspection (crown + alarmToggle): 0 FORBIDDEN',
  forb.length ? JSON.stringify(forb.slice(0, 3)) : '');

check(bootWarns.length === 0, 'the applied boot is SILENT', bootWarns.length ? bootWarns[0].slice(0, 90) : '');
if (warns.length) console.log(`        (${warns.length} warning(s) came from the CHECKS, not the build — bvh coplanar notices and the like)`);

console.log(`\n${fail.length ? `probe FAILED (${fail.length}): ${fail.join('; ')}` : 'probe OK'}\n`);
await browser.close(); srv.kill();
process.exit(fail.length ? 1 : 0);
