// §121 — run the three-tier intraUnit and print the raw rows, so the declared
// population is seeded from measurement rather than guesswork (the same arc
// probe-107-assembly.mjs ran for the assembly check). Run it TWICE
// back-to-back before declaring anything: rows at the arbiter's d≈1e-4
// boundary flip run-to-run, and the flicker is a triage bucket of its own.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8462';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  I.start(window.__clock, 'intraUnit', { yieldEvery: 64 });
});
let out = null;
for (let i = 0; i < 240; i++) {                       // tier FF may lift the runtime
  await new Promise((r) => setTimeout(r, 2000));
  out = await page.evaluate(() => (window.__checks?.intraUnit ?? null));
  if (out && out.state !== 'running') break;
}
const r = out?.result;
if (!r) { console.log('NO RESULT', JSON.stringify(out)); process.exit(1); }
console.log(`tiers=${JSON.stringify(r.tiers)} frames=${r.frames} violations=${r.violations.length} `
  + `outOfScope=${(r.outOfScope ?? []).length} waived=${r.waived.length} `
  + `unmatched=${r.unmatchedSelectors.length} unmeasurable=${r.unmeasurable.length} ms=${out.ms}`);
// counts per unit per tier — the triage procedure's input
const byUnit = {};
for (const v of [...r.violations, ...r.waived]) (byUnit[`${v.unit} [${v.tier}]${v.waived ? ' (waived)' : ''}`] ??= []).push(v);
for (const v of r.outOfScope ?? []) (byUnit[`${v.unit} [${v.tier}] (out of scope)`] ??= []).push(v);
for (const [k, vs] of Object.entries(byUnit).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${k}: ${vs.length}`);
  for (const v of vs) console.log(`   ${v.a ?? v.mover} ⇄ ${v.b ?? v.fixture}  @${v.at}`);
}
for (const u of r.unmatchedSelectors) console.log('STALE', JSON.stringify(u));
for (const u of r.unmeasurable) console.log('UNMEASURABLE', JSON.stringify(u));
await browser.close();
srv.kill();
