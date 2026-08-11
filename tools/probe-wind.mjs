// TODO 38 W4 probe: registry reversal verdicts and the restoring audit
// under the new `wind` axis. Usage: node probe-wind.mjs out.json
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || '/tmp/probe-wind.json';
const srv = spawn('python3', ['-m', 'http.server', '8440', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8440/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const t0 = performance.now();
  const reg = await I.buildSweptRegistry(window.__clock, { yieldEvery: 64 });
  const regMs = Math.round(performance.now() - t0);
  const reversingUnits = [...new Set(reg.registry.filter((v) => v.reversed).map((v) => v.unit))].sort();
  const windReversed = reg.registry.filter((v) => v.reversed).map((v) => `${v.unit}:${v.reversedVia}`);
  const t1 = performance.now();
  const a = await I.auditOscillators(window.__clock, { yieldEvery: 64 });
  return {
    regMs, auditMs: Math.round(performance.now() - t1),
    byKind: reg.byKind, stillEscaping: reg.stillEscapingAfterWidening,
    reversingUnits,
    restoring: {
      control: a.control, population: a.population,
      twoWay: a.twoWayDriven.map((x) => x.unit).sort(),
      sprung: a.restoredByDeclaredElement.map((x) => x.unit).sort(),
      unrestored: a.restoredByNothing.map((x) => x.unit),
      unwaived: a.unwaived.map((x) => x.unit),
      stale: a.staleDeclarations, malformed: (a.malformed || []).length,
    },
    warns: window.__bootWarns ? window.__bootWarns.length : -1,
  };
});
writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await browser.close(); srv.kill();
