// §111 — the focused instruments, run one at a time on the edited tree:
// the new penetration row's measured depth, and the checks the anchor's new
// radii could move. Not a substitute for the battery; a fast loop while
// iterating (CLAUDE.md's "Inspecting" section).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8472';
const CHECKS = (process.env.ONLY || 'penetration,intraUnit,assembly,stockFloor,equalisation').split(',');
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
console.log('bootWarns:', JSON.stringify(await page.evaluate(() => window.__clock.bootWarns)));

for (const name of CHECKS) {
  await page.evaluate(async (n) => {
    const I = await import('./src/inspect.js');
    I.start(window.__clock, n, { yieldEvery: 64 });
  }, name);
  let out = null;
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    out = await page.evaluate((n) => (window.__checks?.[n] ?? null), name);
    if (out && out.state !== 'running') break;
  }
  console.log(`\n===== ${name}  (${out?.ms ?? '?'} ms, ${out?.state}) =====`);
  const r = out?.result;
  if (!r) { console.log(JSON.stringify(out).slice(0, 800)); continue; }
  if (name === 'penetration') {
    for (const row of r) console.log(`  ${String(row.pair).padEnd(46)} ${row.status.padEnd(15)} worst ${row.worstDepth} / ${row.maxDepth} @ ${row.worstAt}`);
  } else if (name === 'stockFloor') {
    console.log(`  ok=${r.ok} degenerate=${r.degenerate.length} violations=${r.violations.length} waived=${r.waivedCount} rows=${r.rowsChecked}`);
    for (const row of [...r.violations, ...r.waived]) console.log(`   ${row.part} / ${row.mesh}: ${row.mm} mm vs ${row.floorMM} (${row.kind})`);
  } else if (name === 'equalisation') {
    console.log(`  ok=${r.ok} failures=${JSON.stringify(r.failures ?? r.violations ?? [])}`);
    console.log(`  ${JSON.stringify(r.alarm?.governor ?? r.alarm ?? {}).slice(0, 900)}`);
  } else if (name === 'intraUnit' || name === 'assembly') {
    console.log(`  ok=${r.ok} violations=${(r.violations || []).length} waived=${(r.waived || []).length} rows=${r.rowsChecked}`);
    for (const v of (r.violations || [])) console.log(`   VIOLATION ${JSON.stringify(v).slice(0, 260)}`);
    for (const v of (r.waived || [])) console.log(`   WAIVED ${JSON.stringify(v).slice(0, 200)}`);
    for (const v of (r.unmeasurable || []).slice(0, 5)) console.log(`   UNMEASURABLE ${JSON.stringify(v).slice(0, 200)}`);
  } else {
    console.log(JSON.stringify(r).slice(0, 900));
  }
}
await browser.close(); srv.kill();
