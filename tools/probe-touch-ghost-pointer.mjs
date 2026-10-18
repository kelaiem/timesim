// DOES ONE FINGER STILL ORBIT AFTER A RELEASE THE CANVAS NEVER HEARD? — the
// ghost-pointer pinch, measured.
//
// OrbitControls (r165) lists the pointers that are down from the canvas's own
// pointerdown, and forgets one only on the canvas's pointerup / pointercancel.
// A release that never reaches the canvas leaves that pointer listed, and the
// next single finger is read as the second of two: a one-finger drag dollies
// and pans. main.js now cancels every listed pointer of the type when a PRIMARY
// pointer goes down (`orbitPointers`), because a primary touch is by
// definition the only touch.
//
// ACCEPTANCE. Boot; put one finger down on the canvas and swallow its
// pointerup at the window (the canvas never hears it, which is what a lost
// capture or a page left mid-touch looks like to the controls); then a
// one-finger sideways drag must
//  · leave the camera's distance to the target within DIST_TOL_FRAC, and the
//    target within PAN_TOL of where it was (no dolly, no pan), and
//  · turn the view (azimuth moved by more than TURN_MIN_DEG);
// a genuine two-finger pinch must still dolly (distance moves by more than
// PINCH_MIN_FRAC), because the second finger is not primary; and boot and the
// gestures are silent.
//
// THE CONTROL: the same page with the eviction short-circuited must DOLLY on
// the same one-finger drag (distance moves by more than PINCH_MIN_FRAC), or
// the ghost was never made and the acceptance passed for that reason alone.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8377;
const DIST_TOL_FRAC = 1e-3;
const PAN_TOL = 1e-3;
const TURN_MIN_DEG = 5;
const PINCH_MIN_FRAC = 0.02;

const GUARD_FROM = "if (e.target !== renderer.domElement || !e.isPrimary) return;";
// The controls' target is not on __clock; both runs hand the instance out.
const CONTROLS_FROM = 'const controls = new OrbitControls(camera, renderer.domElement);';
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
for (const s of [GUARD_FROM, CONTROLS_FROM]) if (!MAIN.includes(s)) {
  console.error('REFUSED: src/main.js no longer contains a line this probe rewrites:\n  ' + s);
  process.exit(1);
}

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function run({ bypass }) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  const warns = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/WebGL|ReadPixels|GPU stall/.test(t)) return;
    if (/Failed to load resource: .*\b(404|501)\b/.test(t)) return;   // /__state on a plain static server
    if (m.type() === 'warning' || m.type() === 'error') warns.push(t);
  });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + e));
  await page.route('**/src/main.js*', async (route) => {
    const r = await route.fetch();
    let body = (await r.text()).replace(CONTROLS_FROM, CONTROLS_FROM + ' window.__probeControls = controls;');
    if (bypass) body = body.replace(GUARD_FROM, 'return;');
    route.fulfill({ body, contentType: 'text/javascript' });
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => window.__clock?.boot?.done || window.__bootError, null, { timeout: 600000 });
  const bootError = await page.evaluate(() => window.__bootError && String(window.__bootError));
  if (bootError) throw new Error('boot failed: ' + bootError);
  await page.waitForTimeout(1500);   // the boot screen's fade, so touches reach the canvas
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // An empty corner of the canvas, clear of the movement and its controls.
  const cx = 180, cy = 620;
  const pose = () => page.evaluate(() => ({
    p: window.__clock.camera.position.toArray(), t: window.__probeControls.target.toArray(),
  }));
  const settle = () => page.waitForTimeout(1200);   // damping

  // The ghost: one finger down, its pointerup stopped at the window.
  await page.evaluate(() => {
    window.__swallowUp = (e) => { e.stopImmediatePropagation(); window.removeEventListener('pointerup', window.__swallowUp, true); };
    window.addEventListener('pointerup', window.__swallowUp, true);
  });
  await touch('touchStart', [{ x: cx + 300, y: cy, id: 1 }]);
  await touch('touchEnd', []);
  await settle();

  const p0 = await pose();
  await touch('touchStart', [{ x: cx, y: cy, id: 2 }]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [{ x: cx + 20 * i, y: cy, id: 2 }]); await page.waitForTimeout(16); }
  await touch('touchEnd', []);
  await settle();
  const p1 = await pose();

  // A genuine pinch: two fingers, spreading.
  await touch('touchStart', [{ x: cx + 200, y: cy - 100, id: 3 }]);
  await touch('touchStart', [{ x: cx + 200, y: cy - 100, id: 3 }, { x: cx + 260, y: cy - 100, id: 4 }]);
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', [{ x: cx + 200 - 10 * i, y: cy - 100, id: 3 }, { x: cx + 260 + 10 * i, y: cy - 100, id: 4 }]);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd', []);
  await settle();
  const p2 = await pose();
  await ctx.close();
  return { p0, p1, p2, warns };
}

const sub = (a, b) => a.map((x, i) => x - b[i]);
const len = (v) => Math.hypot(...v);
function measure(a, b) {
  const oA = sub(a.p, a.t), oB = sub(b.p, b.t);
  const az = (o) => Math.atan2(o[0], o[2]) * 180 / Math.PI;
  const turn = ((az(oB) - az(oA) + 540) % 360) - 180;
  return { distFrac: Math.abs(len(oB) - len(oA)) / len(oA), pan: len(sub(b.t, a.t)), turnDeg: Math.abs(turn) };
}

const live = await run({ bypass: false });
const ctrl = await run({ bypass: true });
await browser.close();

const one = measure(live.p0, live.p1);
const pinch = measure(live.p1, live.p2);
const ctrlOne = measure(ctrl.p0, ctrl.p1);
const fmt = (x, n = 4) => x.toFixed(n);
const fails = [];
if (one.distFrac > DIST_TOL_FRAC) fails.push(`one-finger drag after a ghost moved the camera's distance by ${fmt(one.distFrac)} (tolerance ${DIST_TOL_FRAC}) — it dollied`);
if (one.pan > PAN_TOL) fails.push(`one-finger drag after a ghost moved the target by ${fmt(one.pan)} (tolerance ${PAN_TOL}) — it panned`);
if (one.turnDeg < TURN_MIN_DEG) fails.push(`one-finger drag after a ghost turned the view only ${fmt(one.turnDeg, 2)}° (need > ${TURN_MIN_DEG}°)`);
if (pinch.distFrac < PINCH_MIN_FRAC) fails.push(`a two-finger pinch moved the distance only ${fmt(pinch.distFrac)} (need > ${PINCH_MIN_FRAC}) — pinch broke`);
if (ctrlOne.distFrac < PINCH_MIN_FRAC) fails.push(`CONTROL: with the eviction bypassed the one-finger drag moved the distance only ${fmt(ctrlOne.distFrac)} — no ghost was made, so the acceptance proves nothing`);
for (const w of live.warns) fails.push('console: ' + w);
if (fails.length) { console.error('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`PASS — after a ghost pointer: one finger Δdist ${fmt(one.distFrac)}, pan ${fmt(one.pan)}, turn ${fmt(one.turnDeg, 2)}°; pinch Δdist ${fmt(pinch.distFrac)}; control (no eviction) Δdist ${fmt(ctrlOne.distFrac)}, pan ${fmt(ctrlOne.pan)}, turn ${fmt(ctrlOne.turnDeg, 2)}°`);
process.exit(0);   // the static server child would otherwise hold the event loop open
