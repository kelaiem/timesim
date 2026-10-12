// §277 part E — navigation on the scripted-user engine, measured in a browser.
//
// Not a gate (the battery cannot see UI). It holds the four claims the entry's
// acceptance makes about a jump:
//   1. FOLD — jumping to any stop from stop 0, or back from the last, lands on
//      the same VIEW STATE as running the route straight through to that stop.
//      Steps are deltas, so a cold entry would show a view nobody authored.
//   2. ONE-SHOTS DO NOT REPEAT — a wind runs once per run: going back over a
//      wind stop and forward again leaves the pending wind where it was, and a
//      forward skip over wind stops applies their sum.
//   3. THE ARROWS STEER — ← / → navigate and do not pause; any other key pauses.
//   4. THE CONTROLS — Previous / Next / the stop list work, disable at the ends,
//      carry localized labels, and are absent when no run is on.
// "A route nobody navigates runs as before" is the straight-through record
// below: it is the same code path the engine has always taken, and this probe's
// column of numbers can be diffed against `main` by running the straight-through
// half there with the hooks stubbed.
//
// Run: node tools/probe-277-nav.mjs
import { chromium } from './node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((rq, rs) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(rq.url, 'http://x').pathname));
  fs.readFile(f, (e, d) => e ? (rs.statusCode = 404, rs.end('not found'))
    : (rs.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'), rs.end(d)));
});
await new Promise((r) => srv.listen(0, r));
const BASE = `http://127.0.0.1:${srv.address().port}/index.html`;
let fails = 0;
const ok = (name, cond, detail) => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  [${detail}]` : ''}`); };

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const pg = await browser.newPage();
await pg.setViewportSize({ width: 760, height: 480 });   // desktop layout, few pixels (probe-161's measured reason)
await pg.goto(BASE, { waitUntil: 'load' });
await pg.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
ok('boot is silent', (await pg.evaluate(() => [...window.__clock.bootWarns])).length === 0);

// ---- 4a. absent when no run is on
ok('nav row hidden with no run', await pg.evaluate(() => getComputedStyle(document.querySelector('#clock-caption .cap-nav')).display === 'none'));

// ---- 1. FOLD, on the Inspect route (no crown/wind/sync steps, so scriptTick alone settles it)
// The pusher is a PRESS (setAlarm), so alarmOn trails the call by the pusher's own
// travel in the frame loop; reading both sides after the same wait is the fair
// comparison (the first run of this probe compared a straight-through state read
// mid-press against a jump that needed no press, and called it a fold bug).
const READ = () => { const { done, autoWind, ...v } = window.__clock.scriptView; return v; };
const SETTLE_TICKS = () => { for (let k = 0; k < 5; k++) window.__clock.scriptTick(0.5); };
const settled = async () => { await pg.evaluate(SETTLE_TICKS); await pg.waitForTimeout(1500); return pg.evaluate(READ); };
// The straight-through record is walked from OUTSIDE the page: the first stop's
// settle waits on the crown, which eases in the frame loop, and a synchronous
// loop inside one evaluate never lets a frame run (measured: it stalls at stop 0).
await pg.evaluate(() => window.__clock.startInspect());
const n = await pg.evaluate(() => window.__clock.scriptState.of);
ok('route has stops', n > 2, n);
const straight = [];
for (let i = 0; i < n; i++) {
  for (let g = 0; g < 400 && (await pg.evaluate(() => window.__clock.scriptState.idx)) < i; g++) {
    await pg.evaluate(() => window.__clock.scriptTick(100)); await pg.waitForTimeout(60);
  }
  straight.push(await settled());
}
const same = (a, b) => Object.keys(a).every((k) => typeof a[k] === 'number' ? Math.abs(a[k] - b[k]) < 1e-2 : a[k] === b[k]);
const fromStart = [], fromEnd = [];
for (let i = 0; i < n; i++) {
  await pg.evaluate((a) => { const c = window.__clock; c.scriptStop(); c.startInspect(); c.scriptGoto(a); }, i);
  fromStart.push({ v: await settled(), idx: await pg.evaluate(() => window.__clock.scriptState.idx) });
  await pg.evaluate((a) => { const c = window.__clock; c.scriptStop(); c.startInspect(); c.scriptGoto(c.scriptState.of - 1); c.scriptGoto(a); }, i);
  fromEnd.push({ v: await settled(), idx: await pg.evaluate(() => window.__clock.scriptState.idx) });
}
const bad = (set) => set.map((r, i) => (r.idx === i && same(straight[i], r.v)) ? null : i).filter((x) => x !== null);
for (const [nm, set] of [['start', fromStart], ['end', fromEnd]]) for (const i of bad(set)) {
  const d = Object.keys(straight[i]).filter((k) => straight[i][k] !== set[i].v[k]);
  console.log('   ', nm, 'stop', i, 'idx', set[i].idx, d.map((k) => `${k}: straight ${straight[i][k]} vs jump ${set[i].v[k]}`).join('; '));
}
ok('jump from the first stop = running straight through (every stop)', bad(fromStart).length === 0, `bad: ${bad(fromStart)}`);
ok('jump back from the last stop = running straight through (every stop)', bad(fromEnd).length === 0, `bad: ${bad(fromEnd)}`);
// the control: entering a stop COLD (no fold) must differ somewhere, or the comparison measures nothing
await pg.evaluate(() => { const c = window.__clock; c.scriptStop(); c.startInspect(); c.scriptJump(c.scriptState.of - 2); });
const cold = await settled();
ok('CONTROL: a cold entry (scriptJump) is NOT the straight-through state', !same(straight[n - 2], cold), JSON.stringify(cold));

// ---- 2. ONE-SHOTS (Tour carries winds and a sync)
await pg.evaluate(() => window.__clock.scriptStop());
const one = await pg.evaluate(() => {
  const c = window.__clock; c.startTour();
  const R = c.scriptRoute, w = R.findIndex((r) => r.wind > 0), last = R.length - 1;
  const total = R.reduce((a, r) => a + r.wind, 0);
  const out = { w, total, last };
  c.scriptGoto(w); out.a = c.scriptView.autoWind;
  c.scriptGoto(0); out.b = c.scriptView.autoWind;
  c.scriptGoto(w); out.c = c.scriptView.autoWind;
  c.scriptStop(); c.startTour();
  const before = c.scriptView.autoWind; c.scriptGoto(last); out.skip = (c.scriptView.autoWind - before) / (2 * Math.PI);
  c.scriptStop();
  return out;
});
ok('Tour has a wind stop', one.w > 0, JSON.stringify(one));
ok('a wind runs when its stop is landed on', one.a > 0, one.a);
ok('going back over it adds nothing', one.b === one.a, `${one.a} -> ${one.b}`);
ok('landing on it again adds nothing', one.c === one.a, `${one.a} -> ${one.c}`);
ok('skipping forward applies the winds passed, summed', Math.abs(one.skip - one.total) < 1e-9, `${one.skip} vs ${one.total}`);

// ---- 3. the keys
await pg.evaluate(() => window.__clock.startInspect());
const key = async (k) => { await pg.keyboard.press(k); return pg.evaluate(() => ({ idx: window.__clock.scriptState.idx, paused: window.__clock.scriptState.paused })); };
let r = await key('ArrowRight'); ok('→ goes to the next stop, not paused', r.idx === 1 && !r.paused, JSON.stringify(r));
r = await key('ArrowLeft'); ok('← goes back, not paused', r.idx === 0 && !r.paused, JSON.stringify(r));
r = await key('ArrowLeft'); ok('← at the first stop stays', r.idx === 0 && !r.paused, JSON.stringify(r));
r = await key('a'); ok('any other key still PAUSES (§142)', r.paused === true, JSON.stringify(r));
r = await key('ArrowRight'); ok('an arrow while paused navigates and resumes the run', r.idx === 1 && !r.paused, JSON.stringify(r));

// ---- 4. the controls
const ui = async () => pg.evaluate(() => { const q = (s) => document.querySelector('#clock-caption ' + s);
  return { shown: getComputedStyle(q('.cap-nav')).display !== 'none', prev: q('.nav-prev').disabled, next: q('.nav-next').disabled,
    sel: q('.nav-sel').value, opts: q('.nav-sel').options.length, label: q('.nav-sel').selectedOptions[0]?.textContent,
    aria: [q('.nav-prev'), q('.nav-next'), q('.nav-sel')].map((e) => e.getAttribute('aria-label')), idx: window.__clock.scriptState?.idx ?? -1 }; });
let u = await ui();
ok('row shown during a run, one option per stop', u.shown && u.opts === n, JSON.stringify(u));
ok('the position reads "k / n"', /^2 \/ \d+/.test(u.label), u.label);
ok('labels are present', u.aria.every((x) => x && x.length > 3), u.aria.join(' | '));
await pg.evaluate(() => document.querySelector('#clock-caption .nav-next').click());
u = await ui(); ok('Next button advances', u.idx === 2 && u.sel === '2', JSON.stringify(u));
await pg.evaluate(() => document.querySelector('#clock-caption .nav-prev').click());
u = await ui(); ok('Previous button goes back', u.idx === 1, JSON.stringify(u));
await pg.selectOption('#clock-caption .nav-sel', String(n - 1));
u = await ui(); ok('the stop list jumps, and Next disables at the end', u.idx === n - 1 && u.next && !u.prev, JSON.stringify(u));
await pg.selectOption('#clock-caption .nav-sel', '0');
u = await ui(); ok('and Previous disables at the start', u.idx === 0 && u.prev && !u.next, JSON.stringify(u));
await pg.evaluate(() => window.__clock.scriptStop());
u = await ui(); ok('row hidden again after the run', !u.shown && u.opts === 0, JSON.stringify(u));

// ---- 4b. localization of the three labels
{
  const p2 = await browser.newPage(); await p2.setViewportSize({ width: 760, height: 480 });
  await p2.goto(BASE + '?lang=de', { waitUntil: 'load' });
  await p2.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
  const l = await p2.evaluate(() => ['.nav-prev', '.nav-next', '.nav-sel'].map((s) => document.querySelector('#clock-caption ' + s).getAttribute('aria-label')));
  ok('labels localize (de)', l[0] === 'Vorheriger Stopp' && l[1] === 'Nächster Stopp', l.join(' | '));
}
await browser.close(); srv.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
