// §135 items 2 and 4 — THE REGISTRY'S OTHER TWO QUESTIONS, run alone. Drives
// the battery's own start()/status() protocol (dev server, private TMPDIR,
// throttling off, sweep hold — probe-153-fails' drive) for `meshPhase` and
// `meshCoverage`, then holds what §135 shipped on:
//   1. meshPhase gates the centre distance: 0 unwaived misses over the 0.5%
//      bar, exactly the two keyless rows waived (TODO 125), no stale waiver;
//   2. meshCoverage's enumeration finds the declared meshes (control), reports
//      0 undeclared pairs in the metal, and the only declared rows it never
//      sees are the two TODO 125 rows (0.1 off the pitch sum, outside the
//      enumeration tolerance by construction — §194 said so);
//   3. neither check threw, and both are silent in the boot.
//   cd tools && node probe-135-registry.mjs        (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.P135_PORT || 8535);
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-p135-'));
const srv = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)], { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const page = await (await b.newContext()).newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
await page.evaluate(async () => { window.__I = await import('./src/inspect.js'); window.__clock.beginSweepHold(); });
const results = {};
for (const name of ['meshPhase', 'meshCoverage']) {
  const t0 = Date.now();
  await page.evaluate(([n]) => window.__I.start(window.__clock, n, {}), [name]);
  let st;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    st = await page.evaluate((n) => { const s = window.__I.status(n); return s.state === 'running' ? { state: 'running' } : s; }, name);
    if (st.state !== 'running') break;
  }
  results[name] = { st, s: (Date.now() - t0) / 1000 };
}
await b.close(); srv.kill();

let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);
if (warns.length) F(`boot: ${warns.join(' | ').slice(0, 300)}`); else OK('boot silent');
for (const [n, r] of Object.entries(results)) if (r.st.state === 'error') F(`${n} THREW: ${String(r.st.error).slice(0, 300)}`);
const mp = results.meshPhase.st.result, mc = results.meshCoverage.st.result;
if (mp) {
  console.log(`meshPhase in ${results.meshPhase.s.toFixed(0)}s: ${mp.rows.length} rows, centre bar ${mp.centreBarPct}%, misses over it: ${mp.rows.filter((r) => Math.abs(r.cdMissRel) > mp.centreBarPct / 100).map((r) => `${r.site} ${(r.cdMissRel * 100).toFixed(3)}%`).join('; ') || 'none'}`);
  if (mp.centreViolations.length) F(`meshPhase: ${mp.centreViolations.length} unwaived centre-distance miss(es): ${mp.centreViolations.map((r) => r.site).join(', ')}`); else OK('meshPhase: 0 unwaived centre-distance misses over 0.5%');
  const w = mp.centreWaived.map((r) => r.site).sort();
  if (w.length !== 2 || !w.every((s) => /^keyless:/.test(s))) F(`meshPhase: centre waivers are ${JSON.stringify(w)}, want the two keyless rows`); else OK(`meshPhase: exactly the two keyless rows waived against TODO 125 (${mp.centreWaived.map((r) => (r.cdMissRel * 100).toFixed(3) + '%').join(', ')})`);
  if (mp.staleCentreWaivers.length) F(`meshPhase: stale centre waivers ${JSON.stringify(mp.staleCentreWaivers)}`); else OK('meshPhase: no stale centre waiver');
  if (mp.violations.length || mp.malformed.length || mp.staleWaivers.length || !mp.controlPass) F(`meshPhase: phase gate not clean (${mp.violations.length} violations, ${mp.malformed.length} malformed, ${mp.staleWaivers.length} stale, controls ${mp.controlPass})`); else OK('meshPhase: the phase gate is as clean as before (§194 waivers unchanged)');
}
if (mc) {
  console.log(`meshCoverage in ${results.meshCoverage.s.toFixed(0)}s: ${mc.rotors} rotors, ${mc.candidates} pairs mesh over ${mc.poseCount} poses, ${mc.covered} declared`);
  if (!mc.controlPass) F('meshCoverage: control FAIL — found no declared mesh'); else OK(`meshCoverage: control — the enumeration finds ${mc.covered} of the declared meshes`);
  if (mc.undeclared.length) F(`meshCoverage: ${mc.undeclared.length} undeclared mesh(es) in the metal: ${mc.undeclared.map((r) => r.pair).join('; ')}`); else OK('meshCoverage: 0 undeclared meshes in the metal');
  const ns = mc.declaredNotSeen.map((r) => r.site).sort();
  if (ns.length !== 2 || !ns.every((s) => /^keyless:/.test(s))) F(`meshCoverage: declared rows never seen are ${JSON.stringify(ns)}, want exactly the two TODO 125 rows`); else OK('meshCoverage: the only declared rows outside the enumeration are the two TODO 125 rows, as §194 said');
  if (mc.staleWaivers.length) F(`meshCoverage: stale waivers ${JSON.stringify(mc.staleWaivers)}`); else OK('meshCoverage: no stale waiver');
}
process.exit(fail ? 1 : 0);
