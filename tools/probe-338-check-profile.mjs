#!/usr/bin/env node
// §338 landing 0 — WHERE DOES THE BATTERY'S CHECK TIME GO, BY FUNCTION?
//
// A REPORT (it prints and judges nothing; it exits 2 only on a bad argument,
// which is why the generated index files it as acceptance). §108's SWEEP_CENSUS says how the
// sweeps divide between tiers (AABB, exact query, sampledVerdict); nothing said
// which FUNCTIONS the exact tier spends its time in. §338 needs that to choose
// what a compiled kernel replaces first. This boots one virgin build exactly
// the way the battery does (battery-checks.mjs' virginBoot + prepPage: isolated
// state, the sweep hold taken, the anti-throttling flags), then runs each named
// TASK under a CDP sampling profile, started AFTER boot so the build is not in
// it. Each task gets its own profile.
//
//   node tools/probe-338-check-profile.mjs [--top N] [--out DIR] [--interval US]
//        TASK [TASK …]        TASK is a check name or `check:axis` (a §127 slice)
//
// Per task it prints wall, the profile's coverage, the time by SOURCE (which
// file the leaf frame is in, with GC / idle / program apart), the top N
// functions by SELF time, and the top N by INCLUSIVE time (each function
// counted once per sample however deep it recurses). With --out it writes each
// task's .cpuprofile (load it in Chrome DevTools' Performance panel).
//
// Read it as a sampling profile: optimised frames can be INLINED into their
// caller and charged there, so a small helper's absence from the self list is
// not proof it is cheap. The SOURCE split is the robust number. Times are this
// machine's: §127 measured the CI/container ratio per task spread 1.14x-2.69x,
// so the SHARES are what transfers, not the seconds.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BATTERY, prepPage, runCheck, virginBoot } from './battery-checks.mjs';

// tools/ pins its own playwright; a container that never ran `npm ci` here has
// only the global one (and the browser built for it), so fall back to that.
async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return createRequire(join(root, 'noop.js'))('playwright');
  }
}
const { chromium } = await loadPlaywright();

const argv = process.argv.slice(2);
const flag = (f, d) => { const i = argv.indexOf(f); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const TOP = Number(flag('--top', 20));
const OUT = flag('--out', null);
const INTERVAL_US = Number(flag('--interval', 1000));
const TASKS = argv;
if (!TASKS.length) { console.error('usage: probe-338-check-profile.mjs [--top N] [--out DIR] TASK [TASK …]'); process.exit(2); }

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const byName = new Map(BATTERY.map((e) => [e.name, e]));
function taskOpts(task) {
  const [name, axis] = task.split(':');
  const e = byName.get(name);
  if (!e) throw new Error(`unknown check ${name}`);
  if (axis && !(e.slices || []).some((s) => s.axis === axis)) throw new Error(`${name} has no slice ${axis}`);
  return { name, opts: axis ? { ...e.opts, axes: [axis] } : e.opts };
}
TASKS.forEach(taskOpts);   // refuse a typo before a 20 s boot

const freePort = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-338-'));
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)], { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let t0 = Date.now(); ; ) { try { await fetch(`${base}/index.html`); break; } catch { if (Date.now() - t0 > 15000) throw new Error('dev server never answered'); await new Promise((r) => setTimeout(r, 200)); } }

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const tBoot = Date.now();
const { page } = await virginBoot(browser, base, 600000);
const warns = await prepPage(page);
console.log(`boot ${((Date.now() - tBoot) / 1000).toFixed(1)} s, ${warns.length} boot warn(s); profiling at ${INTERVAL_US} µs`);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: INTERVAL_US });
if (OUT) mkdirSync(OUT, { recursive: true });

const srcOf = (url) => {
  if (!url) return null;
  const f = url.split('?')[0].split('/').pop();
  return f || url;
};
const SPECIAL = new Set(['(garbage collector)', '(idle)', '(program)', '(root)']);

function analyse(profile, wallMs) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  // time per node from the samples (timeDeltas[i] is the gap BEFORE sample i, so
  // it belongs to the previous sample; the first is the start offset)
  const self = new Map();
  const { samples, timeDeltas } = profile;
  for (let i = 0; i < samples.length; i++) {
    const dt = (i + 1 < timeDeltas.length ? timeDeltas[i + 1] : 0) / 1000;
    self.set(samples[i], (self.get(samples[i]) || 0) + dt);
  }
  const keyOf = (n) => {
    const cf = n.callFrame;
    if (SPECIAL.has(cf.functionName)) return cf.functionName;
    return `${cf.functionName || '(anonymous)'} ${srcOf(cf.url) || '(native)'}:${cf.lineNumber + 1}`;
  };
  const selfBy = new Map(), inclBy = new Map(), bySrc = new Map();
  let total = 0;
  for (const [id, ms] of self) {
    if (!ms) continue;
    total += ms;
    const n = nodes.get(id);
    const k = keyOf(n);
    selfBy.set(k, (selfBy.get(k) || 0) + ms);
    const src = SPECIAL.has(n.callFrame.functionName) ? n.callFrame.functionName : (srcOf(n.callFrame.url) || '(native/builtin)');
    bySrc.set(src, (bySrc.get(src) || 0) + ms);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const ck = keyOf(nodes.get(cur));
      if (ck === '(root)' || seen.has(ck)) continue;
      seen.add(ck);
      inclBy.set(ck, (inclBy.get(ck) || 0) + ms);
    }
  }
  return { total, wallMs, selfBy, inclBy, bySrc };
}

const pct = (x, t) => `${(100 * x / t).toFixed(1).padStart(5)}%`;
const sec = (ms) => `${(ms / 1000).toFixed(1).padStart(7)} s`;
function print(task, a) {
  console.log(`\n=== ${task} — wall ${sec(a.wallMs)}, sampled ${sec(a.total)} (${pct(a.total, a.wallMs)} coverage)`);
  const rows = (m, n) => [...m].sort((x, y) => y[1] - x[1]).slice(0, n);
  console.log('  by source (leaf frame):');
  for (const [k, v] of rows(a.bySrc, 12)) console.log(`    ${pct(v, a.total)} ${sec(v)}  ${k}`);
  console.log(`  top ${TOP} by SELF time:`);
  for (const [k, v] of rows(a.selfBy, TOP)) console.log(`    ${pct(v, a.total)} ${sec(v)}  ${k}`);
  console.log(`  top ${TOP} by INCLUSIVE time:`);
  for (const [k, v] of rows(a.inclBy, TOP + 8)) if (!SPECIAL.has(k)) console.log(`    ${pct(v, a.total)} ${sec(v)}  ${k}`);
}

const summary = [];
for (const task of TASKS) {
  const { name, opts } = taskOpts(task);
  await cdp.send('Profiler.start');
  const { ms } = await runCheck(page, name, opts, 4 * 3600 * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const a = analyse(profile, ms);
  print(task, a);
  summary.push({ task, wallMs: ms, sampledMs: a.total, bySrc: Object.fromEntries([...a.bySrc].sort((x, y) => y[1] - x[1])) });
  if (OUT) writeFileSync(join(OUT, `${task.replace(':', '_')}.cpuprofile`), JSON.stringify(profile));
}
if (OUT) writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
process.exit(0);
