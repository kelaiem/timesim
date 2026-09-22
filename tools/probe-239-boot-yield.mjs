// DOES THE BUILD ACTUALLY LET GO OF THE THREAD? — §239's remainder, measured.
//
// §238 covered the black screen; §239's memo halved the block. Neither made
// the page ANSWER. Chrome's "this page is unresponsive" dialog does not
// measure how long the wait is — it measures the renderer's main thread not
// servicing input — so a 13 s build with no event loop in it still raises it,
// and §238's screen keeps moving through that only because its animations run
// on the compositor.
//
// The fix is `await breathe()` at 173 seams through main.js's module
// evaluation, yielding whenever BREATHE_MS of thread time has been spent. This
// is what holds it true, and there are three separate claims:
//
//   1. THE BUILD NEVER HOLDS THE THREAD LONG. Read back from
//      `__clock.boot.worstHeldMs`, which main.js measures at every seam: the
//      longest stretch between two hand-backs. This is the BUILD's own number
//      and it is the sharp one, because it counts nothing but this file's work.
//   2. AND NOTHING MULTI-SECOND SURVIVES ANYWHERE. Measured with a
//      PerformanceObserver on 'longtask' installed before any page script runs,
//      so the whole boot is covered. This is the coarser claim and deliberately
//      the looser gate: a long task counts the BROWSER's work too, and on this
//      container exactly one of them is not the build's — the first composited
//      frame with a live WebGL canvas under software GL, ~950 ms, which the
//      old build simply deferred until after the 13 s block. Measured with
//      BREATHE_MS = 0 (2958 yields, so every seam hands back), that frame is
//      the ONLY long task in the whole boot and the worst yield beside it is
//      6 ms — which is how we know the rest of the figure is not this file.
//   3. THE PAGE ANSWERS INPUT WHILE IT BUILDS. Long tasks are a proxy for
//      that; this measures the thing itself. Real key events are dispatched
//      through CDP every INPUT_EVERY_MS for the whole build and each one is
//      timed to its renderer acknowledgement — which cannot come back until
//      the main thread services it.
//   4. AND IT GIVES THE INPUT BACK. A yielding build can be interrupted, so
//      every listener this file registers part way through it would be reachable
//      before the constants it closes over exist — main.js therefore stops the
//      build's own events at the window until the last line. That guard is the
//      one thing here that could silently break the finished app, so this probe
//      dispatches a key AFTER boot and requires it to arrive.
//   5. THE YIELDS CHANGE NOTHING. The order of every statement is what it was;
//      only the event loop gets a turn in between. Held here by booting BOTH
//      builds and comparing the boot-warn buffer, and by the battery's
//      geometry fingerprint, which is the stronger form of the same claim.
//
// THE CONTROL IS THE LOAD-BEARING PART, and it is not a second tree: the same
// source is served with `BREATHE_MS` rewritten to Infinity in flight, so every
// seam still runs and NONE of them yields. That reproduces the pre-§239 build
// exactly — same statements, same clock reads — and it is the only thing that
// proves the observer and the input pump were measuring at all. An instrument
// that reports "max long task 40 ms" because it attached to nothing looks
// identical to one that reports it because the build breathes. The control
// must come back with one enormous task and input latency to match, or this
// probe refuses its own result.
//
// Usage:
//   node tools/probe-239-boot-yield.mjs                 # this checkout
//   node tools/probe-239-boot-yield.mjs --tree <path>   # another tree
//   node tools/probe-239-boot-yield.mjs --no-control    # skip the control run (faster; reports only)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--tree', new URL('..', import.meta.url).pathname);
const PORT = 8399;
const NO_CONTROL = process.argv.includes('--no-control');

// A key event every 150 ms: often enough that a 400 ms block is caught by two
// or three of them, sparse enough that the pump is not itself the load.
const INPUT_EVERY_MS = 150;
// The ceilings, each derived from what limits it.
//
// MAX_HELD_MS: the seams can only go where a statement boundary exists in an
// async context, so the floor of what this build can reach is its largest
// UNSPLITTABLE call — measured on this container, G.makeGenevaCross at 334 ms,
// with G.makeHairspring (314) and G.weldTree (252) just behind. The ceiling is
// that floor doubled: the room a slower machine needs, and still 40x below the
// 13 s block it replaces.
const MAX_HELD_MS = 700;
// MAX_TASK_MS: the same bound plus the one browser task that is not the build's
// (the first composited frame, ~950 ms here), because a long task counts both
// and this probe will not excuse a row by naming it. Whatever is in it, nothing
// MULTI-SECOND may survive — that is what raises Chrome's dialog.
const MAX_TASK_MS = 1800;
// MAX_INPUT_MS: what a viewer's click waits for is the task in progress plus
// the pump's own spacing and the dispatch round trip.
const MAX_INPUT_MS = 1500;
// The control must fail both by a wide margin or it did not reproduce the old
// build, and then nothing here was measuring anything.
const CONTROL_MIN_TASK_MS = 3000;

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const BREATHE_DECL = 'const BREATHE_MS = 40;';
if (!MAIN.includes(BREATHE_DECL)) {
  console.error(`REFUSED: src/main.js no longer declares \`${BREATHE_DECL}\` — the control rewrites that exact line, `
    + 'so it would have served the yielding build twice and called it a control.');
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function boot({ stall }) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  // Installed before ANY page script, so the build's own first task is covered.
  await page.addInitScript(() => {
    window.__lt = [];
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); })
        .observe({ type: 'longtask', buffered: true });
    } catch { window.__lt = null; }   // null means "not observed", never an empty pass
  });
  if (stall) await page.route('**/src/main.js*', async (route) => {
    const r = await route.fetch();
    route.fulfill({ body: (await r.text()).replace(BREATHE_DECL, 'const BREATHE_MS = Infinity;'), contentType: 'text/javascript' });
  });
  const cdp = await ctx.newCDPSession(page);
  const lat = [];
  let pumping = true;
  const pump = (async () => {
    while (pumping) {
      const t = Date.now();
      // F13: a key nothing in the app binds, and the build's own input guard
      // swallows it anyway — what is being timed is the ACK, not a handler.
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'F13', windowsVirtualKeyCode: 124 }).catch(() => {});
      lat.push(Date.now() - t);
      await new Promise((r) => setTimeout(r, INPUT_EVERY_MS));
    }
  })();
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'commit', timeout: 600000 });
  let booted = true;
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 600000 }).catch(() => { booted = false; });
  const bootMs = Date.now() - t0;
  pumping = false; await pump;
  // Claim 4: the build's input guard is gone once the build is. A listener
  // added here is on the BUBBLE phase, so the guard — capture, on the window,
  // registered first — would swallow the event before it ever arrives.
  let inputBack = null;
  if (booted) {
    await page.evaluate(() => { window.__k = false; window.addEventListener('keydown', () => { window.__k = true; }); });
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'F13', windowsVirtualKeyCode: 124 }).catch(() => {});
    inputBack = await page.evaluate(() => window.__k);
  }
  const out = await page.evaluate(() => ({
    lt: window.__lt, warns: (window.__bootWarns || []).length,
    boot: (window.__clock && window.__clock.boot) || null,
  }));
  await ctx.close();
  return { booted, bootMs, lt: out.lt, warns: out.warns, boot: out.boot, lat, inputBack };
}

const fmt = (n) => (n === null || n === undefined ? '—' : String(Math.round(n)));
function summarise(name, r) {
  if (!r.booted) { console.error(`${name}: the tree never booted`); return null; }
  if (r.lt === null) { console.error(`${name}: the long-task observer did not attach — no result`); return null; }
  const durs = r.lt.map((e) => e[1]);
  const maxTask = durs.length ? Math.max(...durs) : 0;
  const over = (t) => durs.filter((d) => d > t).length;
  const maxLat = r.lat.length ? Math.max(...r.lat) : 0;
  const medLat = r.lat.length ? r.lat.slice().sort((a, b) => a - b)[r.lat.length >> 1] : 0;
  if (!r.boot) { console.error(`${name}: __clock carries no boot record — main.js is not the file this probe measures`); return null; }
  console.log(`\n${name}`);
  console.log(`  boot wall            ${(r.bootMs / 1000).toFixed(1)} s`);
  console.log(`  thread HELD, worst   ${fmt(r.boot.worstHeldMs)} ms   over ${r.boot.breaths} hand-backs (budget ${r.boot.budgetMs} ms)`);
  console.log(`  long tasks (>50 ms)  ${durs.length}   worst ${fmt(maxTask)} ms   over 200 ms: ${over(200)}   over 500 ms: ${over(500)}`);
  console.log(`  time in long tasks   ${fmt(durs.reduce((a, b) => a + b, 0))} ms of ${fmt(r.bootMs)} ms`);
  console.log(`  input ack (n=${r.lat.length})       worst ${fmt(maxLat)} ms   median ${fmt(medLat)} ms`);
  console.log(`  boot warns           ${r.warns}`);
  console.log(`  input after boot     ${r.inputBack ? 'delivered' : 'NOT DELIVERED'}`);
  // The worst few, with WHEN they happened: a block at second one is the first
  // cold builder, a block at second ten is a seam that is missing.
  const worst = r.lt.slice().sort((x, y) => y[1] - x[1]).slice(0, 6);
  for (const [at, d] of worst) console.log(`     ${fmt(d).padStart(6)} ms at t+${(at / 1000).toFixed(1)}s`);
  return { maxTask, maxLat, warns: r.warns, bootMs: r.bootMs, n: durs.length, held: r.boot.worstHeldMs, breaths: r.boot.breaths, inputBack: r.inputBack };
}

const live = summarise('YIELDING (this tree)', await boot({ stall: false }));
const ctrl = NO_CONTROL ? null : summarise('CONTROL (same source, BREATHE_MS = Infinity)', await boot({ stall: true }));
await browser.close(); srv.kill();

const fail = [];
if (!live) fail.push('the yielding boot produced no measurement');
else {
  if (live.held > MAX_HELD_MS) fail.push(`the build held the thread ${fmt(live.held)} ms > ${MAX_HELD_MS} ms — a seam is missing`);
  if (live.breaths < 100) fail.push(`only ${live.breaths} hand-backs in the whole build — the seams are not being reached`);
  if (live.maxTask > MAX_TASK_MS) fail.push(`worst long task ${fmt(live.maxTask)} ms > ${MAX_TASK_MS} ms`);
  if (live.maxLat > MAX_INPUT_MS) fail.push(`worst input ack ${fmt(live.maxLat)} ms > ${MAX_INPUT_MS} ms`);
  if (live.warns !== 0) fail.push(`${live.warns} boot warn(s) — rule 6`);
  if (!live.inputBack) fail.push('a keydown after boot never reached a page listener — the build\'s input guard was not released');
}
if (!NO_CONTROL) {
  if (!ctrl) fail.push('the control boot produced no measurement, so nothing above is trustworthy');
  else {
    if (ctrl.maxTask < CONTROL_MIN_TASK_MS)
      fail.push(`CONTROL worst long task only ${fmt(ctrl.maxTask)} ms (< ${CONTROL_MIN_TASK_MS}) — it did not reproduce the un-yielding build, so the measurement above proves nothing`);
    if (ctrl.warns !== 0) fail.push(`CONTROL raised ${ctrl.warns} boot warn(s) — the rewrite changed the build, not just its yielding`);
    if (live && ctrl.maxTask <= live.maxTask)
      fail.push('CONTROL was no worse than the yielding build — the seams are not doing anything, or neither run was measured');
    if (ctrl.breaths !== 0)
      fail.push(`CONTROL handed the thread back ${ctrl.breaths} times — the BREATHE_MS rewrite did not take, so it is not a control`);
  }
}
console.log('');
if (fail.length) { for (const f of fail) console.error(`FAIL: ${f}`); process.exit(1); }
console.log(`PASS — build held the thread at worst ${fmt(live.held)} ms (ceiling ${MAX_HELD_MS}), worst long task ${fmt(live.maxTask)} ms (ceiling ${MAX_TASK_MS}), worst input ack ${fmt(live.maxLat)} ms (ceiling ${MAX_INPUT_MS})`
  + (ctrl ? `; control held ${fmt(ctrl.held)} ms, task ${fmt(ctrl.maxTask)} ms, ack ${fmt(ctrl.maxLat)} ms` : ''));
