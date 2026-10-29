// §142 — THE TOUR PAUSES, CONFIRMS BEFORE ENDING, AND REACHES THE PAGES.
// Acceptance, on a real run of TOUR_STEPS in headless Chromium with the
// throttling flags off (the engine runs in the rAF loop):
//   1. every caption of every stop exists in all five locale tables (read off
//      src/i18n.js: the file carries five tables, so a caption's key appears
//      five times when it is translated everywhere);
//   2. the two re-recorded captions say what the metal does (half a tooth per
//      beat; the GREAT WHEEL drives the centre), and the cross and alarm-toggle
//      stops exist;
//   3. incidental input PAUSES: a pointerdown on the canvas leaves the run in
//      place, paused, with a Resume control in the banner; the step index does
//      not advance while paused (longer than the stop's dwell); Resume
//      re-enters the same stop and the run goes on to the next;
//   4. the explicit exits CONFIRM: Esc raises the gate ("End the tour?") with
//      the run paused; Keep going resumes; the Tour button raises it too; End
//      stops the run and restores the panel;
//   5. the cross draws in the line tier when framed: at the cross stop with
//      schematic on, the 'Alarm winding arrest' unit carries line proxies;
//   6. the closing stop's banner carries two links, to primer.html and
//      explain.html.
//   cd tools && node probe-142-tour.mjs        (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8470;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
const warns = [];
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
const wait = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => window.__clock.scriptState);

let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);

// start the tour from its button (in-page: the button lives in a fold). The
// engine is driven through scriptTick (real seconds), not the rAF loop: a
// software-GL frame is seconds, so wall time would say nothing.
const tick = (dt) => page.evaluate((d) => window.__clock.scriptTick(d), dt);
await page.evaluate(() => document.getElementById('btn-tour').click());
await wait(300);
let st = await state();
if (!st || st.idx !== 0) F(`tour did not start at stop 0: ${JSON.stringify(st)}`); else OK(`tour running at stop 0 of ${st.of}`);
// A stop's dwell is its caption's READING time since the pacing landing (paceByReading), so
// no fixed wait can stand for "past the dwell": tick until the stop changes, up to a cap
// that a reading-paced stop cannot exceed (the longest caption reads in about 12 s).
const DWELL_CAP_S = 20;
// One in-page loop, not a round trip per tick: a software-GL page answers each evaluate in
// seconds, and the stop's change is read from the same synchronous call that ticks it.
const tickUntilAdvance = (from) => page.evaluate(({ from, cap }) => {
  for (let t = 0; t < cap; t += 0.1) { window.__clock.scriptTick(0.1); const s2 = window.__clock.scriptState; if (!s2 || s2.idx !== from) return t; }
  return cap;
}, { from, cap: DWELL_CAP_S });
// pacing is live: every stop's dwell covers its caption's reading time, read off the
// engine's own table and the pace it declares (never retyped). Wall-clock cannot say this
// here: the rAF loop also feeds the dwell clock while this probe ticks it.
st = await state();
const slow = st.captions.map((c, i) => ({ i, need: st.readPace.tween + c.trim().split(/\s+/).length / st.readPace.wps, got: st.dwells[i] }))
  .filter((x) => !(x.got >= x.need - 0.05));
if (slow.length) F(`${slow.length} stop(s) dwell less than their caption reads: ${slow.map((x) => `#${x.i} ${x.got}s < ${x.need.toFixed(1)}s`).join(', ')}`);
else OK(`all ${st.dwells.length} stops dwell at least their caption's reading time at ${st.readPace.wps} words/s (longest ${Math.max(...st.dwells).toFixed(1)} s)`);
if (Math.max(...st.dwells) >= DWELL_CAP_S) F(`the longest dwell ${Math.max(...st.dwells)} s reaches the probe's ${DWELL_CAP_S} s cap`);
// control: the run advances on its own, within the cap
await tickUntilAdvance(0);
st = await state();
if (!st || st.idx !== 1) F(`control: the run did not advance to stop 1 on its own: ${JSON.stringify(st && st.idx)}`); else OK('control: the run advances to stop 1 after its dwell');
// 1 + 2 — captions and their locales
const i18n = readFileSync(join(ROOT, 'src/i18n.js'), 'utf8');
// §208 — the table count is read off TABLES' own declaration rather than
// typed: a sixth locale arrived and a literal 5 would have let a caption
// missing from it pass as "in every locale".
const nTables = i18n.match(/^export const TABLES = \{([^}]*)\}/m)[1].split(',').filter((x) => x.includes(':')).length;
const missing = st.captions.filter((c) => (i18n.split(`'${c.replace(/'/g, "\\'")}'`).length - 1) < nTables);
if (missing.length) F(`${missing.length} caption(s) not in all ${nTables} locales: ${missing.map((c) => c.slice(0, 40)).join(' | ')}`); else OK(`all ${st.captions.length} captions carry ${nTables} locale rows`);
if (!st.captions.some((c) => /half a tooth/.test(c))) F('the escapement caption still overclaims a tooth per beat'); else OK('escapement caption: half a tooth per beat');
if (!st.captions.some((c) => /great wheel to centre/.test(c))) F('the train caption still names the barrel as the driver'); else OK('train caption: the great wheel drives the centre');
if (!st.captions.some((c) => /Maltese cross/.test(c)) || !st.captions.some((c) => /Press the pusher/.test(c))) F('the cross or alarm-toggle stop is missing'); else OK('the cross stop and the alarm-toggle stop exist');
// 3 — pause on incidental input
await page.mouse.move(550, 380);
await page.mouse.down(); await page.mouse.up();
await wait(200);
st = await state();
const resumeVisible = await page.evaluate(() => { const b = document.getElementById('script-resume'); return !!b && b.offsetParent !== null; });
if (!st || !st.paused) F(`a click on the movement did not pause: ${JSON.stringify(st)}`); else OK('a click on the movement pauses the run (it is not cancelled)');
if (!resumeVisible) F('no visible Resume control while paused'); else OK('the banner shows a Resume control while paused');
const idxAtPause = st ? st.idx : -1;
await page.evaluate((cap) => { for (let t = 0; t < cap; t += 0.1) window.__clock.scriptTick(0.1); }, DWELL_CAP_S); // the cap's worth of engine time, past any stop's dwell
st = await state();
if (!st || st.idx !== idxAtPause) F(`the step advanced while paused (${idxAtPause} → ${st && st.idx})`); else OK('the step index holds while paused, past the stop\'s dwell');
await page.evaluate(() => document.getElementById('script-resume').click());
await wait(200);
st = await state();
if (!st || st.paused || st.idx !== idxAtPause) F(`resume did not re-enter the same stop: ${JSON.stringify(st)}`); else OK('Resume re-enters the same stop, unpaused');
await tickUntilAdvance(idxAtPause); // the paused stop's dwell restarts on Resume, then the run goes on
st = await state();
if (!st || st.idx <= idxAtPause) F(`the run did not go on after resume: ${JSON.stringify(st)}`); else OK(`after resume the run went on to stop ${st.idx}`);
// 4 — the explicit exits confirm
await page.keyboard.press('Escape');
await wait(200);
let gate = await page.evaluate(() => { const g = document.getElementById('clock-tour-gate'); return { shown: g.classList.contains('show'), q: g.querySelector('p').textContent, yes: document.getElementById('tour-gate-go').textContent, no: document.getElementById('tour-gate-skip').textContent }; });
st = await state();
if (!gate.shown || !/End the tour/.test(gate.q)) F(`Esc did not raise the exit gate: ${JSON.stringify(gate)}`); else OK(`Esc asks "${gate.q}" [${gate.no}] [${gate.yes}]`);
if (!st || !st.paused) F('the run is not paused under the gate'); else OK('the run holds paused under the gate');
await page.evaluate(() => document.getElementById('tour-gate-skip').click());
await wait(200);
st = await state(); gate = await page.evaluate(() => document.getElementById('clock-tour-gate').classList.contains('show'));
if (gate || !st || st.paused) F('Keep going did not resume'); else OK('Keep going resumes the run');
await page.evaluate(() => document.getElementById('btn-tour').click());
await wait(200);
gate = await page.evaluate(() => document.getElementById('clock-tour-gate').classList.contains('show'));
if (!gate) F('the Tour button did not ask before ending'); else OK('the Tour button asks before ending');
await page.evaluate(() => document.getElementById('tour-gate-go').click());
await wait(600);
st = await state();
const panelBack = await page.evaluate(() => document.getElementById('clock-ui').style.display !== 'none');
const gateDefault = await page.evaluate(() => document.getElementById('tour-gate-go').textContent);
if (st) F('End did not stop the run'); else OK('End stops the run');
if (!panelBack) F('the panel did not come back after End'); else OK('the panel is restored after End');
if (!/Start Tour|Tour/.test(gateDefault)) F(`the gate's default copy was not restored: ${gateDefault}`); else OK('the gate\'s own copy is restored');
// 5 + 6 — the cross draws in the line tier; the closing stop links out
await page.evaluate(() => document.getElementById('btn-tour').click());
await wait(300);
st = await state();
const crossIdx = st.captions.findIndex((c) => /Maltese cross/.test(c));
await page.evaluate((i) => window.__clock.scriptJump(i), crossIdx);
await wait(300);
const cross = await page.evaluate(() => {
  const u = window.__clock.labelEntries.find((e) => e.name === 'Alarm winding arrest');
  let lines = 0; u.obj.traverse((o) => { if ((o.isLine || o.isLineSegments) && o.userData && o.userData.schematic) lines++; });
  const sch = document.getElementById('btn-schematic').dataset.state;
  return { lines, schematic: sch };
});
if (cross.schematic !== 'on' || cross.lines === 0) F(`at the cross stop: schematic ${cross.schematic}, ${cross.lines} line proxies under the arrest`); else OK(`at the cross stop the line tier is on and the arrest draws ${cross.lines} line proxies`);
await page.evaluate((n) => window.__clock.scriptJump(n - 1), st.of);
await wait(300);
const links = await page.evaluate(() => [...document.querySelectorAll('#clock-caption a')].map((a) => a.getAttribute('href')));
if (links.length !== 2 || !links.some((h) => /primer\.html/.test(h)) || !links.some((h) => /explain\.html/.test(h))) F(`closing stop links: ${JSON.stringify(links)}`); else OK('the closing stop links to primer.html and explain.html from the banner');
await page.evaluate(() => { document.getElementById('btn-tour').click(); document.getElementById('tour-gate-go').click(); });
await wait(300);
if (warns.length) F(`warnings: ${warns.join(' | ').slice(0, 300)}`); else OK('no page errors or boot warnings across the run');
await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
