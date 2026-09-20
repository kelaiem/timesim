// DOES THE BOOT SCREEN ACTUALLY COVER THE WAIT? — §238's four claims, measured.
//
// The movement is BUILT at module-evaluation time: main.js cuts every part in
// one synchronous block, so between the first byte of that module and the
// finished watch there is no frame, no paint and no event loop. Before §238
// the viewer watched #0b0d10 for the whole of it — measured on this
// container's SwiftShader Chromium, a 27.5 s long task and a
// first-contentful-paint at 31.7 s.
//
// A screen that covers that wait has to be true in four separate ways, and
// three of them are invisible to anyone reading the markup:
//
//   1. IT IS PAINTED BEFORE THE BLOCK. index.html's entry script yields a
//      frame before it imports main.js precisely so this cannot depend on a
//      network delay that happens to be long enough. Measured as
//      first-contentful-paint against the START of the build's long task.
//   2. IT KEEPS MOVING THROUGH THE BLOCK. Every animation on the screen is on
//      transform or opacity alone, which Chromium ticks on the COMPOSITOR
//      thread — the main thread is dead for the whole build, the screen is
//      not. This is the claim that cannot be read off the source, and the one
//      a future edit is most likely to break: give `.boot-ring` a `width`
//      animation instead of a `transform` one and the screen freezes for
//      27 s while still looking perfectly correct in a screenshot.
//      Measured through a CDP SCREENCAST, which delivers composited frames to
//      this process and therefore does not need the page's main thread at all.
//      `page.screenshot()` DOES need it: every attempt during the block times
//      out after 30 s, which is how this probe learned to use the screencast.
//   3. IT LEAVES. The overlay covers the viewport and carries aria-live, so a
//      faded-but-present one would keep announcing itself and would sit over
//      the movement forever. Measured as the element being gone from the DOM
//      and the canvas carrying the scene.
//   4. IT IS IN THE READER'S LANGUAGE, AND IN TIME. The strings are authored
//      in English in the markup and swapped by i18n.js's table (§73 tier one)
//      in the entry script — which is only worth anything if the swap happens
//      BEFORE the block, since afterwards there is no frame left to show it
//      in. Measured by holding main.js on the wire and reading the DOM in the
//      gap, which is the only window where the ordering is observable.
//
// THE CONTROLS, because a probe that reports "the screen moved" needs to be
// able to report that it did not:
//   · must-miss, motion — the same run under `prefers-reduced-motion: reduce`,
//     where index.html stops the ring on purpose. Frames through the block
//     must go IDENTICAL. Without this row, a screencast that re-encoded an
//     unchanging frame differently each time would read as animation.
//   · must-hit, failure — main.js is failed on the wire. The screen must stop
//     the ring, say so, and still publish window.__bootError and an uncaught
//     error, because §238 turned a <script src> into a dynamic import() and
//     TODO 30's diagnosis surface rides on that path.
//
// It is NOT tools/probe-129-bootcost.mjs (what a spec variant costs the
// build) and NOT tools/probe-116-locale-fit.mjs (whether a translated string
// fits its chrome). Both touch boot and neither asks whether anything is on
// the glass while it runs.
//
// Usage: node tools/probe-238-boot-screen.mjs      (exit 0 = every claim held)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { inflateSync } from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8392;
const BOOT_TIMEOUT = 180000;

// The screen must be on glass well inside the block's first moments. 2000 ms
// is not a performance target — it is "before anything the viewer would call
// a wait", two orders clear of the frame budget and an order under the
// shortest build this repo has ever measured.
const FCP_CEILING_MS = 2000;

// How much of the viewport is not the page's own ground colour. Written out
// rather than depended on because tools/ carries exactly one dependency and a
// screenshot decoder is not worth a second; Chromium's encoder emits 8-bit
// non-interlaced RGB/RGBA, which is the case handled here.
const PAGE_BG = [0x0b, 0x0d, 0x10];        // index.html's `background`
function readPNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported PNG: depth ${bd} colour type ${ct}`);
  const ch = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * ch;
  let prev = Buffer.alloc(stride), ink = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {           // the five PNG row filters
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = x * ch;
      if (Math.abs(line[o] - PAGE_BG[0]) + Math.abs(line[o + 1] - PAGE_BG[1]) + Math.abs(line[o + 2] - PAGE_BG[2]) > 12) ink++;
    }
    prev = line;
  }
  return ink / (w * h);
}

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

// The timeline every run reads: paint entries and long tasks, installed before
// the document's own scripts so nothing is missed.
const INIT = () => {
  window.__tl = { paint: [], long: [] };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__tl.paint.push({ name: e.name, t: e.startTime }); })
    .observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__tl.long.push({ t: e.startTime, d: e.duration }); })
    .observe({ type: 'longtask', buffered: true });
};

// One run: boot the page, streaming composited frames the whole time. Returns
// the frames (with arrival times), the page's own timeline, and the DOM state
// once __clock is up.
async function bootRun({ reducedMotion = null, query = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, ...(reducedMotion ? { reducedMotion } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const t0 = Date.now();
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ t: Date.now() - t0, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 480, maxHeight: 336, everyNthFrame: 1 });

  await page.goto(`http://127.0.0.1:${PORT}/index.html${query}`, { waitUntil: 'commit', timeout: BOOT_TIMEOUT });
  let booted = true;
  await page.waitForFunction(() => !!window.__clock, null, { timeout: BOOT_TIMEOUT }).catch(() => { booted = false; });
  const bootMs = Date.now() - t0;
  // The screen retires on the first PAINTED frame and then fades, so the
  // interesting moment is after __clock, not at it. Waiting for the element
  // to go — rather than reading the DOM the instant the build ends — is the
  // difference between measuring the retire and measuring this probe's own
  // scheduling; the first version of this row failed for exactly that reason.
  let goneMs = null;
  if (booted) {
    await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 10000 }).catch(() => {});
    goneMs = Date.now() - t0;
  }
  const liveFrom = frames.length;          // frames from here on are the movement, not the screen
  await page.waitForTimeout(1200);
  await cdp.send('Page.stopScreencast').catch(() => {});

  const after = booted ? await page.evaluate(() => ({
    tl: window.__tl,
    bootEl: !!document.getElementById('boot'),
    canvas: !!document.querySelector('#app canvas'),
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  })) : { tl: await page.evaluate(() => window.__tl).catch(() => null) };
  return { page, ctx, frames, liveFrom, bootMs, goneMs, booted, errors, after };
}

// The build's long task: the one that runs for seconds. Its start is the
// moment the main thread dies and its end is the moment it revives.
const buildTask = (tl) => (tl.long || []).filter((e) => e.d > 1000).sort((a, b) => b.d - a.d)[0] || null;

// ---------------------------------------------------------------- run 1: the real thing
{
  const r = await bootRun();
  if (!r.booted) { console.error('the tree did not boot — nothing to measure'); process.exit(1); }
  const tl = r.after.tl;
  const fcp = tl.paint.find((p) => p.name === 'first-contentful-paint');
  const build = buildTask(tl);
  console.log(`\nboot: __clock at ${(r.bootMs / 1000).toFixed(1)}s · build block ${build ? (build.d / 1000).toFixed(1) + 's from ' + Math.round(build.t) + 'ms' : 'not seen'} · ${r.frames.length} composited frames\n`);

  check('1. content is painted before the build blocks the thread',
    !!fcp && !!build && fcp.t < build.t && fcp.t < FCP_CEILING_MS,
    `first-contentful-paint ${fcp ? Math.round(fcp.t) : '—'}ms, build starts ${build ? Math.round(build.t) : '—'}ms (ceiling ${FCP_CEILING_MS}ms)`);

  // Frames that arrived strictly INSIDE the block, and how many of them differ
  // from the frame before. A still screen delivers few frames and no changes.
  const inBlock = build ? r.frames.filter((f) => f.t > build.t + 200 && f.t < build.t + build.d - 200) : [];
  let moved = 0;
  for (let i = 1; i < inBlock.length; i++) if (inBlock[i].data !== inBlock[i - 1].data) moved++;
  check('2. the screen keeps moving while the main thread is blocked',
    inBlock.length >= 10 && moved >= 5,
    `${inBlock.length} frames inside the block, ${moved} of them changed`);
  globalThis.__movedRef = { frames: inBlock.length, moved };

  check('3a. the boot screen leaves the DOM once the movement is drawn', r.after.bootEl === false,
    r.after.bootEl ? '#boot is still there 10s after __clock' : `#boot gone ${r.goneMs - r.bootMs}ms after __clock`);
  // What it uncovered has to be the MOVEMENT, not an empty canvas — a retire
  // that fired a frame too early would leave the viewer the same black the
  // screen existed to cover, arriving at the end of the wait. Measured as ink:
  // pixels that are not index.html's own ground colour. The screen itself is
  // a ring and two lines and reads ~0.2%; the movement reads ~29%. The 5%
  // floor sits in the gap and is a discriminator, not a target. (Motion is NOT
  // the test here: measured, the scene stands still for the first seconds
  // after boot — a fact about the sim's start, not about this screen.)
  const sceneInk = r.after.canvas ? readPNG(await r.page.screenshot({ type: 'png' })) : 0;
  check('3b. …and what it uncovered is the movement, not an empty canvas',
    r.after.canvas === true && sceneInk > 0.05,
    `${(sceneInk * 100).toFixed(1)}% of the viewport is drawn (floor 5%)`);
  check('3c. boot is still silent with the screen in it', r.errors.length === 0,
    r.errors.length ? r.errors.join(' | ') : 'no page errors');
  await r.ctx.close();
}

// ------------------------------------------------ control (must-miss): reduced motion
{
  const r = await bootRun({ reducedMotion: 'reduce' });
  if (!r.booted) { console.error('the reduced-motion run did not boot'); process.exit(1); }
  const build = buildTask(r.after.tl);
  const inBlock = build ? r.frames.filter((f) => f.t > build.t + 1500 && f.t < build.t + build.d - 200) : [];
  let moved = 0;
  for (let i = 1; i < inBlock.length; i++) if (inBlock[i].data !== inBlock[i - 1].data) moved++;
  // The window starts 1.5 s in so the note's own 0.8 s fade (which reduced
  // motion only un-delays, it does not remove) is over before we look.
  // A screencast delivers on CHANGE, so stillness shows up two ways and both
  // are the answer: no frames at all, or frames that are byte-identical. What
  // it must not show is the moving run's number, which is what this row rules
  // out — that the 1500-odd changed frames above are the capture pathway
  // ticking rather than the screen animating.
  check('CONTROL must-miss: under prefers-reduced-motion the same window is STILL',
    moved === 0,
    `${inBlock.length} frames, ${moved} changed (the moving run: ${globalThis.__movedRef.moved} of ${globalThis.__movedRef.frames})`);
  await r.ctx.close();
}

// ------------------------------------- 4: the localized swap lands BEFORE the block
// main.js is held on the wire for a second, which is the only window in which
// the ordering is observable: after the import starts, nothing can be read.
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  await page.route('**/src/main.js*', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?lang=de`, { waitUntil: 'commit', timeout: BOOT_TIMEOUT });
  await page.waitForTimeout(1200);   // inside main.js's hold: the thread is free
  const held = await page.evaluate(() => ({
    head: document.querySelector('#boot .boot-head')?.textContent,
    note: document.querySelector('#boot .boot-note')?.textContent,
    lang: document.documentElement.lang, dir: document.documentElement.dir,
    clock: !!window.__clock,
  }));
  check('4. the boot screen is translated before the build starts',
    held.clock === false && held.head === 'Das Werk wird gebaut' && held.lang === 'de',
    `head "${held.head}", lang ${held.lang}, __clock ${held.clock}`);
  await ctx.close();
}

// ---------------------------- CONTROL (must-hit): a build that cannot load says so
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/src/main.js*', (route) => route.abort('failed'));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'commit', timeout: BOOT_TIMEOUT });
  await page.waitForFunction(() => !!window.__bootError, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
  const dead = await page.evaluate(() => ({
    failed: document.getElementById('boot')?.classList.contains('failed'),
    head: document.querySelector('#boot .boot-head')?.textContent,
    err: !!window.__bootError,
  }));
  check('CONTROL must-hit: a build that cannot load stops the ring and says so',
    dead.failed === true && dead.err === true && errors.length > 0,
    `head "${dead.head}", __bootError ${dead.err}, uncaught ${errors.length}`);
  await ctx.close();
}

await browser.close(); srv.kill();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} held`);
process.exit(bad.length ? 1 : 0);
