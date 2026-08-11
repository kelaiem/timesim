// §104 — focused instrument pass before the full battery: the fast checks
// that the new unit moves. Run: cd tools && node probe-104-checks.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8449', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|WebGL/.test(m.text())) console.log('BOOTWARN', m.text()); });
await page.goto('http://127.0.0.1:8449/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const out = [];
  const run = async (name) => {
    clock.resetInputs();
    const t0 = performance.now();
    const r = await I.CHECKS_RUN(clock, name).catch((e) => ({ error: String(e) }));
    return { r, ms: Math.round(performance.now() - t0) };
  };
  void run;
  const checks = {};
  clock.resetInputs();
  checks.support = I.checkSupportGeometry(clock);
  clock.resetInputs();
  checks.graph = await I.checkMechanicalGraph(clock);
  clock.resetInputs();
  checks.equalisation = I.checkEqualisation(clock);
  clock.resetInputs();
  checks.oscillator = await I.checkOscillator(clock);
  clock.resetInputs();
  checks.stockFloor = await I.checkStockFloor(clock);
  const brief = (name, c) => {
    if (!c) return `${name}: MISSING`;
    if (name === 'support') return `support: ${c.failures ? c.failures.length : '?'} failures ${JSON.stringify((c.failures || []).slice(0, 4))}`;
    if (name === 'graph') return `graph: notInGraph ${JSON.stringify(c.notInGraph)}, ungrounded ${JSON.stringify(c.ungrounded)}, undriven ${JSON.stringify(c.undriven)}, missingFromScene ${JSON.stringify(c.missingFromScene)}, anchors ${c.anchorFailures ? c.anchorFailures.length : '?'}`;
    if (name === 'equalisation') return `equalisation: ok=${c.ok} failures=${JSON.stringify(c.failures)}\n  ${c.summary}`;
    if (name === 'oscillator') return `oscillator: ok=${c.ok}`;
    if (name === 'stockFloor') return `stockFloor: degenerate ${c.degenerate.length}, unwaived ${c.violations.length} ${JSON.stringify(c.violations.slice(0, 6))}, waived ${c.waivedCount}, defaultedNew ${JSON.stringify(c.partsOnDefaultKind.filter((p) => /governor/i.test(p)))}`;
    return `${name}: ?`;
  };
  for (const [n, c] of Object.entries(checks)) out.push(brief(n, c));
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
