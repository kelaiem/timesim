// DOES THE BUILD ACTUALLY LET GO OF THE THREAD? — §239's remainder, measured.
//
// §238 covered the black screen; §239's memo halved the block. Neither made
// the page ANSWER. Chrome's "this page is unresponsive" dialog does not
// measure how long the wait is — it measures the renderer's main thread not
// servicing input — so a 13 s build with no event loop in it still raises it,
// and §238's screen keeps moving through that only because its animations run
// on the compositor.
//
// The fix is `await breathe()` at seams through main.js's module evaluation,
// yielding whenever BREATHE_MS of thread time has been spent — 173 of them at
// §239's landing, and since §266 the probe COUNTS them in the source and prints
// the number rather than any document restating one that goes stale (the file
// had 203 by the time §266 measured the build holding the thread for 3 s again,
// because code that arrived after §239 arrived with none). This is what holds it
// true, and there are three separate claims:
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
// AND A SECOND CONTROL FOR THE TAIL (TODO 188). `__clock` is assigned ~700
// lines before the build ends, and this probe used to read the boot record the
// moment `__clock` existed — from a snapshot frozen there, so every seam after
// it and the whole tail went unread. The record is live now and carries
// `done`, and the probe waits for it. The TAIL control plants a busy-wait of
// TAIL_STALL_MS immediately before `releaseBuildInputGuard();`, seams intact:
// the yielding build must then report it, or the last stretch is still blind.
//
// Usage:
//   node tools/probe-239-boot-yield.mjs                 # this checkout
//   node tools/probe-239-boot-yield.mjs --tree <path>   # another tree
//   node tools/probe-239-boot-yield.mjs --no-control    # skip the control run (faster; reports only)
//   node tools/probe-239-boot-yield.mjs --json <file>    # also write every gated number as JSON
// Under GitHub Actions it also writes its table to the job summary (§266
// landing two), so a run's numbers are readable without opening the log.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import os from 'node:os';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--tree', new URL('..', import.meta.url).pathname);
const PORT = 8399;
const NO_CONTROL = process.argv.includes('--no-control');
const JSON_OUT = arg('--json', null);

// A key event every 150 ms: often enough that a 400 ms block is caught by two
// or three of them, sparse enough that the pump is not itself the load.
const INPUT_EVERY_MS = 150;
// The ceilings, each derived from what limits it — and since §266 landing two,
// from the host that judges them. CI (.github/workflows/boot-yield.yml) runs
// this on ubuntu-latest, and twelve runs on six runners per batch read:
//
//   runner CPU            held, worst   long task, worst   input ack, worst
//   AMD EPYC 7763         311–329 ms    2253–2320 ms       2103–2290 ms
//   AMD EPYC 9V74         278 ms        1948 ms            1799 ms
//   the fastest runner    224 ms        1202 ms            1050 ms
//
// Each ceiling is the slowest run times 1.66, battery.yml's measured same-tree
// spread between two CI runs (the rule every timing cap here follows, because
// the tail past a ceiling cannot be read), rounded up to the next 50 ms.
// They are the CI HOST's numbers. A dev container is its own machine: the ones
// this was built on read 326–520 ms held, which these clear, and a slower one
// can fail them on a healthy tree — read the held line, which is the build's.
//
// MAX_HELD_MS: the BUILD's own number, the sharp gate. 329 × 1.66 = 546. §239's
// 700 was its dev container's unsplittable floor doubled; the CI host's spread
// is the tighter and the truer bound, and it still sits 9× under the 4.7 s
// stretch main had reached when §266 found it.
const MAX_HELD_MS = 550;
// MAX_TASK_MS: a long task counts the BROWSER's work too, and on the CI host
// the worst one in every run is the first composited frame at t+0.2–0.4 s — a
// frame commit blocked in GLES2::ReadPixels while the GPU process drains the
// GL queued before the first yield (§266's trace). It is software-GL work that
// scales with the runner (1.2–2.3 s across the three CPUs above), not build
// work, and no seam reaches it; every other task in those runs is ~250 ms or
// under. So this gate is the backstop, not the sharp one: 2320 × 1.66 = 3851.
// Nothing near Chrome's unresponsive-page threshold may survive.
const MAX_TASK_MS = 3900;
// MAX_INPUT_MS: what a viewer's key waits for is the task in progress, and the
// worst wait in every CI run is that same first frame. 2290 × 1.66 = 3801.
const MAX_INPUT_MS = 3850;
// The control must be a run THESE gates would fail, or it did not reproduce the
// old build and nothing here was measuring anything. §266 landing two tied it
// to the ceiling: a fixed 3000 sat under the new long-task ceiling, so a
// control of 3500 ms would have passed as one while the gate passed it too.
// (On the CI host the control's worst task is 15.2–15.9 s, and it holds the
// thread 21–22 s.)
const CONTROL_MIN_TASK_MS = MAX_TASK_MS;
// The tail control's stall: above MAX_HELD_MS, so a probe that SEES it fails
// the gate by construction, and the check below asks that it was seen whole.
const TAIL_STALL_MS = 800;

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
// §266 — the seams, counted where they are written: every `await breathe(n)` in
// main.js's CODE (a line's text before any `//`), which is what the record and
// CLAUDE.md quote instead of a number of their own. Since §267 a seam carries
// its id, and a bare `await breathe()` (one not yet numbered) still counts.
const SEAMS = MAIN.split('\n').reduce((n, l) => n + (l.split('//')[0].match(/await breathe\(\d*\)/g) || []).length, 0);
console.log(`seams in source       ${SEAMS} \`await breathe(n)\` sites in src/main.js`);
const RELEASE_CALL = '\nreleaseBuildInputGuard();\n';
if (MAIN.split(RELEASE_CALL).length !== 2) {
  console.error('REFUSED: src/main.js must call `releaseBuildInputGuard();` at statement level exactly once — the tail control plants its stall before that line.');
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function boot({ stall, tail }) {
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
  if (stall || tail) await page.route('**/src/main.js*', async (route) => {
    const r = await route.fetch();
    let body = await r.text();
    if (stall) body = body.replace(BREATHE_DECL, 'const BREATHE_MS = Infinity;');
    if (tail) body = body.replace(RELEASE_CALL, `\n{ const t = performance.now(); while (performance.now() - t < ${TAIL_STALL_MS}); }${RELEASE_CALL}`);
    route.fulfill({ body, contentType: 'text/javascript' });
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
  // Not merely `__clock`: the record is only whole once the build has released
  // its input guard. A tree whose record has no `done` is read at once and
  // refused below, rather than waited on for ten minutes.
  await page.waitForFunction(() => !!window.__clock && window.__clock.boot && window.__clock.boot.done !== false,
    null, { timeout: 600000 }).catch(() => { booted = false; });
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
  if (r.boot.done !== true) { console.error(`${name}: the boot record carries no \`done\` — it may be a snapshot taken before the build ended, so it is not read`); return null; }
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
  return { maxTask, maxLat, medLat, warns: r.warns, bootMs: r.bootMs, n: durs.length, held: r.boot.worstHeldMs, breaths: r.boot.breaths, inputBack: r.inputBack,
    worst: worst.map(([at, d]) => ({ atMs: Math.round(at), ms: Math.round(d) })) };
}

const live = summarise('YIELDING (this tree)', await boot({ stall: false }));
const ctrl = NO_CONTROL ? null : summarise('CONTROL (same source, BREATHE_MS = Infinity)', await boot({ stall: true }));
const tailC = NO_CONTROL ? null : summarise(`TAIL CONTROL (same source, ${TAIL_STALL_MS} ms stall before the guard's release)`, await boot({ tail: true }));
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
    if (ctrl.held <= MAX_HELD_MS)
      fail.push(`CONTROL held the thread only ${fmt(ctrl.held)} ms (≤ ${MAX_HELD_MS}) — the held gate would not have caught the un-yielding build`);
    if (ctrl.maxTask < CONTROL_MIN_TASK_MS)
      fail.push(`CONTROL worst long task only ${fmt(ctrl.maxTask)} ms (< ${CONTROL_MIN_TASK_MS}) — it did not reproduce the un-yielding build, so the measurement above proves nothing`);
    if (ctrl.warns !== 0) fail.push(`CONTROL raised ${ctrl.warns} boot warn(s) — the rewrite changed the build, not just its yielding`);
    if (live && ctrl.maxTask <= live.maxTask)
      fail.push('CONTROL was no worse than the yielding build — the seams are not doing anything, or neither run was measured');
    if (ctrl.breaths !== 0)
      fail.push(`CONTROL handed the thread back ${ctrl.breaths} times — the BREATHE_MS rewrite did not take, so it is not a control`);
  }
  if (!tailC) fail.push('the tail control produced no measurement, so the build\'s last stretch is unverified');
  else if (tailC.held < TAIL_STALL_MS)
    fail.push(`TAIL CONTROL held only ${fmt(tailC.held)} ms with a ${TAIL_STALL_MS} ms stall planted before the guard's release — the record does not see the end of the build`);
}
// §266 landing two — the numbers as data. The ceilings are a property of the
// host, so a run that cannot be read back as numbers cannot be used to derive
// them; the summary is the same table for a human reading the Actions page.
const cpus = os.cpus();
const record = {
  format: 1, seams: SEAMS,
  host: { cpu: cpus[0]?.model || '?', cores: cpus.length, platform: `${os.platform()}/${os.arch()}` },
  ceilings: { heldMs: MAX_HELD_MS, taskMs: MAX_TASK_MS, inputMs: MAX_INPUT_MS, controlMinTaskMs: CONTROL_MIN_TASK_MS, tailStallMs: TAIL_STALL_MS },
  live, control: ctrl, tail: tailC, fail,
};
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(record, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const row = (name, r) => r
    ? `| ${name} | ${fmt(r.held)} | ${fmt(r.maxTask)} | ${fmt(r.maxLat)} / ${fmt(r.medLat)} | ${r.breaths} | ${(r.bootMs / 1000).toFixed(1)} s |`
    : `| ${name} | — | — | — | — | — |`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `### Boot yield (§239 / §266) — ${fail.length ? 'FAIL' : 'PASS'}`,
    `${SEAMS} seams in source · ${record.host.cores} × ${record.host.cpu} · ceilings: held ${MAX_HELD_MS}, task ${MAX_TASK_MS}, input ${MAX_INPUT_MS} ms`,
    '', '| run | held, worst (ms) | long task, worst (ms) | input ack, worst / median (ms) | hand-backs | boot |', '|---|---|---|---|---|---|',
    row('yielding', live), ...(NO_CONTROL ? [] : [row('control (BREATHE_MS = Infinity)', ctrl), row(`tail control (${TAIL_STALL_MS} ms stall)`, tailC)]),
    '', ...(fail.length ? fail.map((f) => `- FAIL: ${f}`) : []), '',
  ].join('\n'));
}
console.log('');
if (fail.length) { for (const f of fail) console.error(`FAIL: ${f}`); process.exit(1); }
console.log(`PASS — build held the thread at worst ${fmt(live.held)} ms (ceiling ${MAX_HELD_MS}), worst long task ${fmt(live.maxTask)} ms (ceiling ${MAX_TASK_MS}), worst input ack ${fmt(live.maxLat)} ms (ceiling ${MAX_INPUT_MS})`
  + (ctrl ? `; control held ${fmt(ctrl.held)} ms, task ${fmt(ctrl.maxTask)} ms, ack ${fmt(ctrl.maxLat)} ms` : '')
  + (tailC ? `; tail control held ${fmt(tailC.held)} ms` : ''));
