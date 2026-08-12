// §107 — run the assembly check and print its rows, so the declared-split
// population is seeded from measurement rather than from guesswork.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8461';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => {
  if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) console.log('BOOTWARN', m.text());
});
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  I.start(window.__clock, 'assembly', { yieldEvery: 64 });
});
let out = null;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  out = await page.evaluate(() => (window.__checks?.assembly ?? null));
  if (out && out.state !== 'running') break;
}
const r = out?.result;
if (!r) console.log(JSON.stringify(out, null, 1).slice(0, 4000));
else {
  console.log(`ok=${r.ok}  rows=${r.rowsChecked}  violations=${r.violations.length}  `
    + `waived=${r.waived.length}  outOfScope=${r.outOfScope.length}  unmeasurable=${r.unmeasurable.length}  ms=${out.ms}`);
  const line = (x) => `  ${x.unit} / ${x.group}: ${x.bodies} bodies, sep ${x.separation} — ${x.members.join(' | ')}`;
  for (const v of r.violations) console.log('VIOLATION', line(v));
  for (const v of r.waived) console.log('WAIVED', line(v));
  for (const v of r.outOfScope) console.log('REPORT', line(v));
  for (const u of r.unmeasurable.slice(0, 8)) console.log('UNMEASURABLE', u.unit, u.a, u.b, u.why);
}
await browser.close(); srv.kill();
