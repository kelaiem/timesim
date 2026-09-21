// WHERE DOES BOOT SPEND ITS TIME? — §239 step one, and the first instrument in
// this repo to ask it.
//
// The movement is BUILT, not loaded: `main.js` cuts every part during module
// evaluation, in one synchronous block (§238's trap entry). Until this probe
// existed, nothing measured what was IN that block. `probe-129-bootcost.mjs`
// times a whole boot per spec variant, which is the outer number and says
// nothing about which builder is expensive; the roadmap's §239 asks for the
// split, and its own text warns against acting on a guess.
//
// HOW IT MEASURES, and why it needs no edit to the app. It takes a V8 CPU
// PROFILE over the whole boot through CDP — `Profiler.start` before the
// navigation, `Profiler.stop` once `window.__clock` exists — and aggregates
// the samples three ways:
//   · BY FILE, self time. The honest first cut: which module is the cost.
//   · SELF TIME per function. What the CPU is actually executing.
//   · TOTAL TIME per function (self + everything it calls). What a BUILDER
//     costs, which is the number a human wants and the one a flat self-time
//     table hides — a solver that is 3% itself can own 40% through a callee.
// Instrumenting the source instead was the obvious alternative and is worse:
// timestamps around builders measure the first pass through a cold JIT, and a
// second run of the same page is not a second cold boot.
//
// SAMPLING IS THE LIMITATION AND IT IS NAMED: 500 µs ticks attribute time
// statistically, so small entries are noise and only the shape is reliable.
// Two runs of the same tree will not agree to the digit; they agree on which
// rows are at the top, which is all this is for.
//
// THE CONTROL, and why this file can exit non-zero despite being a REPORT: a
// profiler that failed to attach, or a boot that finished before it started,
// produces a beautifully formatted table of almost nothing — the exact failure
// the instruments skill catalogues. So the sample total is held against the
// measured boot wall, and a profile covering less than half of it is a
// REFUSAL, not a result. Everything else here is reported and judged by you.
//
// WHAT IT FOUND, first run, on the tree before the memo landed (SwiftShader
// container, boot 27.0 s): `gearToothSpec` → `cyPairSolve` was 42.3% of the
// build and `cyEpi` alone 39.1% — a 60-step bisection nested inside another
// 60-step bisection, 200 million evaluations, 19.8 of every 20 of them
// re-deriving a pair already solved. Memoising that one call (geometry.js)
// took boot 24.8 s → 13.9 s with the geometry fingerprint unmoved. Re-run
// after: `cyEpi` 4.1%, nothing above 15%, the profile FLAT — which is itself
// the finding that decides what §239 does next.
//
// Usage:
//   node tools/probe-239-boot-profile.mjs                 # this checkout
//   node tools/probe-239-boot-profile.mjs --tree <path>   # another tree, for an A/B
//   node tools/probe-239-boot-profile.mjs --top 40 --out boot.cpuprofile
// `--out` writes the raw profile for chrome://tracing or DevTools, which is
// where you go when the aggregation is not enough.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--tree', new URL('..', import.meta.url).pathname);
const TOP = Number(arg('--top', 25));
const OUT = arg('--out', null);
const PORT = 8397;
// 500 µs: fine enough that a 100 ms builder lands ~200 samples, coarse enough
// that the profiler is not itself a cost worth reporting.
const INTERVAL_US = 500;
// A profile covering less than this fraction of the boot wall did not measure
// the boot. Not a performance bound — a detector for "the profiler was not
// running", which otherwise reports a tidy table of noise.
const COVERAGE_FLOOR = 0.5;

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: INTERVAL_US });
await cdp.send('Profiler.start');
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'commit', timeout: 300000 });
let booted = true;
await page.waitForFunction(() => !!window.__clock, null, { timeout: 300000 }).catch(() => { booted = false; });
const bootMs = Date.now() - t0;
const { profile } = await cdp.send('Profiler.stop');
await browser.close(); srv.kill();
if (!booted) { console.error(`the tree at ${ROOT} never booted — nothing to profile`); process.exit(1); }

// ---------------------------------------------------------------- aggregation
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
// Sample DELTAS rather than hitCount: the interval is a request, not a promise,
// and a blocked main thread makes the real spacing uneven.
const selfMs = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i], dt = (profile.timeDeltas[i] || 0) / 1000;
  selfMs.set(id, (selfMs.get(id) || 0) + dt);
}
const sum = [...selfMs.values()].reduce((a, b) => a + b, 0);

if (sum < bootMs * COVERAGE_FLOOR) {
  console.error(`REFUSED: the profile covers ${(sum / 1000).toFixed(1)}s of a ${(bootMs / 1000).toFixed(1)}s boot `
    + `(floor ${COVERAGE_FLOOR * 100}%). The profiler did not measure this boot — do not read the table.`);
  process.exit(1);
}

const label = (n) => {
  const f = n.callFrame;
  return `${f.functionName || '(anonymous)'} · ${(f.url || '').split('/').pop() || '(anon)'}:${f.lineNumber + 1}`;
};
const fileOf = (n) => ((n.callFrame.url || '').split('/').pop() || '(none)');

const fn = new Map(), perFile = new Map();
for (const [id, ms] of selfMs) {
  const n = byId.get(id); if (!n) continue;
  fn.set(label(n), (fn.get(label(n)) || 0) + ms);
  perFile.set(fileOf(n), (perFile.get(fileOf(n)) || 0) + ms);
}
// TOTAL: walk each sample's stack to the root, crediting every frame ONCE —
// without the once-per-stack guard, recursion would count a frame twice for
// one sample and a self-recursive solver would report over 100%.
const total = new Map();
for (const [id, ms] of selfMs) {
  const credited = new Set(), walked = new Set();
  for (let cur = id; cur != null; cur = parent.get(cur)) {
    if (walked.has(cur)) break;
    walked.add(cur);
    const n = byId.get(cur); if (!n) continue;
    const k = label(n);
    if (credited.has(k)) continue;
    credited.add(k);
    total.set(k, (total.get(k) || 0) + ms);
  }
}

const pct = (ms) => `${(100 * ms / sum).toFixed(1).padStart(5)}%`;
const secs = (ms) => `${(ms / 1000).toFixed(2).padStart(7)}s`;
const table = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([k, ms]) => `  ${secs(ms)}  ${pct(ms)}  ${k}`).join('\n');

console.log(`tree ${ROOT}`);
console.log(`boot: __clock at ${(bootMs / 1000).toFixed(1)}s · profile covers ${(sum / 1000).toFixed(1)}s of samples `
  + `(${(100 * sum / bootMs).toFixed(0)}% of the wall, floor ${COVERAGE_FLOOR * 100}%)\n`);
console.log('BY FILE (self time):\n' + table(perFile, 12));
console.log(`\nSELF TIME, top ${TOP} — what the CPU executes:\n` + table(fn, TOP));
console.log(`\nTOTAL TIME, top ${TOP} — self + callees, what a BUILDER costs:\n` + table(total, TOP));
if (OUT) { writeFileSync(OUT, JSON.stringify(profile)); console.log(`\nraw profile → ${OUT}`); }
