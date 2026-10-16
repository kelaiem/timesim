// What fast-forward costs the VIEWER, measured on the live requestAnimationFrame
// loop (§258's footing, not advanceFrame in a loop): fast-forward on from a full
// reserve, wall clock until the reserve reads flat, and beside it what the page
// felt like while it ran — the longest main-thread block (long tasks), the gaps
// between drawn frames, and how long a posted task waited for the thread.
// A REPORT: it prints and exits 0. `--ref DIR` serves every DIR/<name>.js in
// place of src/<name>.js (e.g. `git show <base>:src/main.js > DIR/main.js` for
// each file a change touches), so two trees are compared in one run on one
// machine, alternating when `--runs` is more than one.
//
//   node tools/probe-ff-live.mjs [--runs N] [--ref DIR] [--only-ref] [--cap S] [--verbose]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('--runs', 1));
const REF = arg('--ref', null);
const CAP_S = Number(arg('--cap', 300));
const VERBOSE = process.argv.includes('--verbose');
const PORT = 8400 + Math.floor(Math.random() * 400);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

async function run(label, refDir) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); })
      .observe({ type: 'longtask', buffered: true });
  });
  if (refDir) await page.route(/\/src\/[^/?]+\.js(\?.*)?$/, (r) => {
    const name = new URL(r.request().url()).pathname.split('/').pop();
    const f = resolve(refDir, name);
    return existsSync(f) ? r.fulfill({ body: readFileSync(f, 'utf8'), contentType: 'text/javascript' }) : r.continue();
  });
  await page.route('**/__state', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { timeout: 600000 });
  await page.waitForFunction(() => window.__clock && window.__clock.boot && window.__clock.boot.done !== false, null, { timeout: 600000 });
  if (VERBOSE) console.log(`  ${label}: booted`);
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__clock.setPose({ tension: 1 }); });
  if (VERBOSE) console.log(`  ${label}: wound, fast-forward on`);
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  // Frames are counted IN the page by its own rAF, gaps between them recorded.
  await page.evaluate(() => {
    window.__ffGaps = []; let last = performance.now();
    window.__ffTicks = [];
    const f = (t) => { window.__ffGaps.push(t - last); window.__ffTicks.push(window.__clock.ticksPerFrame); last = t; if (!window.__ffStop) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    window.__lt.length = 0;
  });
  // Responsiveness, measured IN the page: every 100 ms a task is posted
  // (MessageChannel, unclamped) and the delay before it runs is recorded — how
  // long anything the viewer does would have waited for the thread. (A CDP key
  // pump was the first instrument here; Input.dispatchKeyEvent waits on the
  // renderer's ack and wedged the harness itself mid-fast-forward.)
  await page.evaluate(() => {
    window.__lag = [];
    const ch = new MessageChannel(); let sent = 0;
    ch.port1.onmessage = () => { window.__lag.push(performance.now() - sent); };
    window.__lagTimer = setInterval(() => { sent = performance.now(); ch.port2.postMessage(0); }, 100);
  });
  const t0 = Date.now();
  await cdp.send('Runtime.evaluate', { expression: "document.getElementById('btn-ff').click()" });
  // Fast-forward also stops itself AT THE ALARM (it exists to reach it), so a
  // stop with reserve left is counted and fast-forward is pressed again: the
  // wall reported is the whole reserve's, the alarm stops named beside it.
  let drained = false, alarmStops = 0, lastLog = Date.now();
  // Raw CDP evaluation from here on, each bounded: Playwright's own evaluate was
  // seen to stall indefinitely mid-fast-forward on this harness.
  const ev = (e) => Promise.race([
    cdp.send('Runtime.evaluate', { expression: e, returnByValue: true }).then((r) => r.result.value),
    new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timed out')), 20000)),
  ]);
  await ev('window.__ffT0 = performance.now()');
  while (Date.now() - t0 < CAP_S * 1000) {
    await new Promise((r) => setTimeout(r, 250));
    const ff = await ev("document.getElementById('btn-ff').dataset.state").catch(() => 'on');
    if (VERBOSE && Date.now() - lastLog > 10000) {
      lastLog = Date.now();
      console.log(await ev("`  ${((performance.now() - window.__ffT0) / 1000).toFixed(0)} s: reserve ${document.getElementById('reserve-value').textContent}, ff ${document.getElementById('btn-ff').dataset.state}, last frames' ticks ${window.__ffTicks.slice(-8).join(' ')}, gaps ${window.__ffGaps.slice(-8).map((g) => g.toFixed(0)).join(' ')}`").catch((e) => String(e)));
    }
    if (ff !== 'on') {
      const reserve = await ev("parseFloat(document.getElementById('reserve-value').textContent.replace(',', '.'))");
      if (reserve > 0.05) { alarmStops++; await ev("document.getElementById('btn-ff').click()"); continue; }
      drained = true; break;
    }
  }
  const wall = (Date.now() - t0) / 1000;
  const { gaps, lt, ticks, lat } = await ev('window.__ffStop = true, clearInterval(window.__lagTimer), ({ gaps: window.__ffGaps, lt: window.__lt, ticks: window.__ffTicks, lat: window.__lag })');
  const ltd = lt.map((x) => x[1]);
  console.log(`${label.padEnd(10)} ${drained ? 'drained' : 'CAPPED '} in ${wall.toFixed(1)} s · frames ${gaps.length} · gap median ${q(gaps, 0.5).toFixed(0)} p95 ${q(gaps, 0.95).toFixed(0)} max ${Math.max(...gaps).toFixed(0)} ms · long tasks ${ltd.length}, max ${Math.max(0, ...ltd).toFixed(0)} ms, total ${ltd.reduce((a, b) => a + b, 0).toFixed(0)} ms · task delay median ${q(lat, 0.5).toFixed(0)} p95 ${q(lat, 0.95).toFixed(0)} max ${Math.max(...lat).toFixed(0)} ms · ticks/frame median ${q(ticks.filter((x) => x > 0), 0.5)} · alarm stops ${alarmStops}`);
  await ctx.close();
}
const ONLY_REF = process.argv.includes('--only-ref');
for (let i = 0; i < RUNS; i++) {
  if (REF) await run('ref', REF);
  if (!ONLY_REF) await run('tree', null);
}
await browser.close();
srv.kill();
