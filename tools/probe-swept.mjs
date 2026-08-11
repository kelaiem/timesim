import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const srv = spawn('python3', ['-m', 'http.server', '8402', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8402/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const t0 = performance.now();
  const r = await I.checkSweptOverlap(window.__clock, { yieldEvery: 64 });
  return { ms: Math.round(performance.now() - t0), s: r.sound.staticVsSwept, notClaimed: r.notClaimed, reg: r.registrySummary };
});
writeFileSync(out, JSON.stringify(res, null, 1));
const s = res.s;
console.log(`ms: ${res.ms}, tested: ${s.pairsTested}, confirmed: ${s.violations.length}, tight: ${s.tight.length}, refuted: ${s.refutedByRefinement.length}`);
for (const r of [...s.violations, ...s.tight, ...s.refutedByRefinement])
  console.log(`  ${r.pair} | gap ${r.refinedMinGap}${r.gapIsAtLeast ? '+' : ''}${r.refinedAt ? ' @ ' + r.refinedAt.axis + ' f=' + r.refinedAt.f : ''}`);
await browser.close(); srv.kill();
