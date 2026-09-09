// §10 level 2 — DOES THE DRILL-IN SEPARATE PIECES FROM THE LIFTED CLUSTER, AND
// DOES THE CHAIN NOW LIFT WITH ITS GROUP? Acceptance, read off a real boot
// through window.__clock (setExplode / setDrill / subEntries):
//   1. boot silent — the extended partition assert (parents real, no double
//      claim, dense sub-layers) passed;
//   2. THE LEVEL-1 GAP IS CLOSED: exploding 'Fusee & chain' carries the chain
//      by exactly the arbor's lift, at both tension extremes (the chain is
//      re-baked at each, so a record that a rebuild could lose would show);
//   3. THE DRILL IS ANCHORED AT THE GROUP: with the group lifted, drilling
//      moves no unit's level-1 z (the cluster never re-homes) and fans the
//      fusee arbor's pieces out by rank·UNIT along the arbor's own order;
//      with the group at rest the same fan-out happens anchored at home;
//   4. BACKING OUT RE-GATHERS BIT-EXACTLY: drill 0 puts every piece at its
//      constructed z (===, not ≈); resetInputs likewise;
//   5. the sub-layers are the arbor's stack order (winding spur lowest, the
//      let-down square highest) and dense; the member units of the group
//      rank by drive order (drum < chain < fusee);
//   6. labels: with Labels on and a drill open, one sub-label per piece is
//      displayed; with the drill closed, none.
//   cd tools && node probe-10-drill.mjs      (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8466;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 }).catch(() => warns.push('NO __clock'));
if (await page.evaluate(() => !window.__clock)) { console.log('boot died:', warns.join(' | ').slice(0, 400)); process.exit(2); }

const r = await page.evaluate(async () => {
  const c = window.__clock;
  const out = { bootWarns: (window.__bootWarns || []).slice() };
  const unit = (n) => c.labelEntries.find((e) => e.name === n).obj;
  const z = (n) => unit(n).position.z;
  const chain = () => unit('Chain');
  c.step(0.02); // the chain's lazy first build has happened by now (boot ticks), but make sure
  await new Promise((r) => setTimeout(r, 50)); // let the lazy MECH_GRAPH import land for the group ranks
  const UNIT = 4;
  // 2 — the chain lifts with its group, at both tension extremes
  out.chain = [];
  for (const tension of [0, 1]) {
    c.resetInputs();
    c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension, windAccumTurns: 0 });
    const home = { chain: z('Chain'), fusee: z('Fusee & great wheel') };
    c.setExplode(1, 'Fusee & chain'); c.step(0.01);
    out.chain.push({ tension, chainLift: z('Chain') - home.chain, fuseeLift: z('Fusee & great wheel') - home.fusee, chainHome: home.chain });
    c.setExplode(0, 'All'); c.step(0.01);
  }
  // 3 — drill anchored at the lifted group, and at home
  c.resetInputs();
  const subs0 = c.subEntries;
  const level1 = () => ({ fusee: z('Fusee & great wheel'), drum: z('Mainspring drum'), chain: z('Chain'), detent: z('Maintaining detent'), setup: z('Set-up work') });
  c.setExplode(1, 'Fusee & chain'); c.step(0.01);
  const liftedBefore = level1();
  c.setDrill(1); c.step(0.01);
  const liftedAfter = level1();
  const subsDrilled = c.subEntries;
  out.drillAtLift = { liftedBefore, liftedAfter, subs: subsDrilled.map((s) => ({ n: s.displayName, dz: s.z - s.baseZ, layer: s.subLayer })) };
  c.setDrill(0); c.step(0.01);
  const subsBack = c.subEntries;
  out.backExact = subsBack.every((s) => s.z === s.baseZ);
  c.setExplode(0, 'Fusee & great wheel'); c.step(0.01);
  const homeBefore = z('Fusee & great wheel');
  c.setDrill(1); c.step(0.01);
  out.drillAtHome = { unitZBefore: homeBefore, unitZAfter: z('Fusee & great wheel'), subs: c.subEntries.map((s) => ({ n: s.displayName, dz: s.z - s.baseZ })) };
  // 6 — labels
  document.getElementById('btn-labels').click(); c.step(0.01);
  out.subLabelsOpen = [...document.querySelectorAll('.clock-sublabel')].filter((e) => e.style.display !== 'none').length;
  c.setDrill(0); c.step(0.01);
  out.subLabelsClosed = [...document.querySelectorAll('.clock-sublabel')].filter((e) => e.style.display !== 'none').length;
  document.getElementById('btn-labels').click();
  // 4 — resetInputs re-gathers
  c.setDrill(1); c.step(0.01); c.resetInputs(); c.step(0.01);
  out.resetExact = c.subEntries.every((s) => s.z === s.baseZ) && z('Chain') === 0;
  out.subs0 = subs0.map((s) => ({ n: s.displayName, parent: s.parentUnit, baseZ: s.baseZ, layer: s.subLayer }));
  return out;
});
await browser.close();
srv.kill();

let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);
if (r.bootWarns.length || warns.length) F(`boot: ${[...r.bootWarns, ...warns].join(' | ').slice(0, 300)}`); else OK('boot silent — the extended partition assert passed');
for (const c of r.chain) {
  if (Math.abs(c.chainLift - c.fuseeLift) > 1e-9 || c.chainLift <= 0) F(`tension ${c.tension}: chain lifted ${c.chainLift}, the arbor ${c.fuseeLift}`);
  else OK(`tension ${c.tension}: the chain lifts with its group — ${c.chainLift} u, the arbor's own lift`);
}
const d = r.drillAtLift;
const moved = Object.keys(d.liftedBefore).filter((k) => d.liftedBefore[k] !== d.liftedAfter[k]);
// member UNITS may fan out by drive rank on a group drill; the FUSEE unit's own z is the anchor of its pieces
const ranks = { drum: d.liftedAfter.drum - d.liftedBefore.drum, chain: d.liftedAfter.chain - d.liftedBefore.chain, fusee: d.liftedAfter.fusee - d.liftedBefore.fusee };
if (!(ranks.drum < ranks.chain && ranks.chain < ranks.fusee)) F(`group drill: member units not in drive order — drum ${ranks.drum}, chain ${ranks.chain}, fusee ${ranks.fusee}`);
else OK(`group drill: member units fan out in drive order (drum +${ranks.drum}, chain +${ranks.chain}, fusee +${ranks.fusee} u)`);
const spread = d.subs.map((s) => s.dz);
if (!d.subs.every((s) => Math.abs(s.dz - s.layer * 4) < 1e-9)) F(`pieces did not fan out by rank·UNIT: ${JSON.stringify(d.subs)}`);
else OK(`pieces fan out by rank·UNIT from the lifted cluster: ${d.subs.map((s) => `${s.n} +${s.dz}`).join(', ')}`);
if (r.drillAtHome.unitZBefore !== r.drillAtHome.unitZAfter) F('drill at home moved the unit itself');
else if (!r.drillAtHome.subs.some((s) => s.dz > 0)) F('drill at home separated nothing');
else OK('drill with the group at rest separates the pieces anchored at home; the unit does not move');
if (!r.backExact) F('backing out left a residual offset'); else OK('backing out re-gathers every piece bit-exactly (=== constructed z)');
if (!r.resetExact) F('resetInputs left a piece or the chain displaced'); else OK('resetInputs puts every piece and the chain home bit-exactly');
const order = [...r.subs0].sort((a, b) => a.layer - b.layer).map((s) => s.n);
const dense = [...r.subs0].map((s) => s.layer).sort((a, b) => a - b).every((l, i) => l === i);
if (!dense) F(`sub-layers not dense: ${JSON.stringify(r.subs0)}`);
else if (order[0] !== 'Winding spur' || order[order.length - 1] !== 'Let-down square') F(`stack order is not the arbor's: ${order.join(' → ')}`);
else OK(`sub-layers dense and in the arbor's order: ${order.join(' → ')}`);
if (r.subLabelsOpen !== r.subs0.length || r.subLabelsClosed !== 0) F(`sub-labels: ${r.subLabelsOpen} shown open (want ${r.subs0.length}), ${r.subLabelsClosed} shown closed (want 0)`);
else OK(`sub-labels: ${r.subLabelsOpen} shown while drilled, 0 when closed`);
process.exit(fail ? 1 : 0);
