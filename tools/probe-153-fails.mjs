// §153 — re-run the battery's three failing gates alone and dump their
// failing rows (the landing run's payload dump was lost to a tail pipe).
// Same drive as ci-battery.mjs: dev server with a private TMPDIR, headless
// Chromium with throttling off, sweep hold for the run, start()/status().
// Usage: node probe-153-fails.mjs [checkName ...]  (default: the three)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['stockFloor', 'expectedContacts', 'inspection'];
const OPTS = {
  meshIntegrity: { yieldEvery: 64 },
  stockFloor: {},
  expectedContacts: { yieldEvery: 64 },
  inspection: { includeExcluded: true, yieldEvery: 64 },
};
const FAILS = {
  meshIntegrity: (r) => [...(String(r.control).startsWith('PASS') ? [] : [{ control: r.control }]), ...r.subBodies.malformed, ...r.subBodies.pairs.rows],
  stockFloor: (r) => [...r.degenerate, ...r.violations],
  expectedContacts: (r) => [...r.violations, ...r.unmatched.map((u) => ({ unmatchedContactSelector: u }))],
  inspection: (r) => r.report.filter((row) => row.class === 'FORBIDDEN'),
};
const port = Number(process.env.P153_PORT || 8531);
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-p153-'));
const srv = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ args: [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });
const page = await (await b.newContext()).newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
await page.evaluate(async () => {
  window.__I = await import('./src/inspect.js');
  window.__clock.beginSweepHold();
});
for (const name of CHECKS) {
  const t0 = Date.now();
  await page.evaluate(([n, o]) => window.__I.start(window.__clock, n, o), [name, OPTS[name]]);
  let st;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    st = await page.evaluate((n) => {
      const s = window.__I.status(n);
      return s.state === 'running' ? { state: 'running' } : s;
    }, name);
    if (st.state !== 'running') break;
  }
  if (st.state === 'error') { console.log(`${name}: THREW\n${st.error}`); continue; }
  const fails = FAILS[name](st.result);
  console.log(`\n=== ${name}: ${fails.length} failing row(s) in ${((Date.now() - t0) / 1000).toFixed(0)}s ===`);
  console.log(JSON.stringify(fails, null, 1).slice(0, 12000));
}
await b.close(); srv.kill();
