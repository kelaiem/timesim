// DOES A CANVAS DRAG STILL SPIN THE VIEW AFTER THE HUD HAS ROLLED IT? — the
// orbit axis after a §57 arcball roll, measured.
//
// The pad's face is an arcball, and a drag on it rolls the camera by turning
// `camera.up`. OrbitControls read `up` once, at construction, so its orbit
// axis stayed world +Y while its `lookAt` followed the rolled `up`: after one
// spin on the pad, a sideways drag on the canvas turned the view about an axis
// 89.7° off the camera's up, and touch/drag navigation "stopped working"
// until a reload. main.js now runs every controls update inside the camera's
// own frame (`orbitFrame`).
//
// ACCEPTANCE. Boot with the pad open, roll the camera with a real pointer drag
// around the pad's face, then:
//  · a sideways MOUSE drag and a sideways TOUCH drag on the canvas each turn
//    the view about the camera's OWN up — the offset's polar angle from
//    `camera.up` moves by at most AXIS_TOL_DEG — and actually move it. Not the screen's vertical: OrbitControls is a
//    turntable, and its axis leans from the screen's up by the camera's
//    elevation (11–17° here before any roll). What the roll broke was that
//    the turntable's axis stopped being the camera's up;
//  · an arrow key does the same;
//  · a preset flies back LEVEL (up = +Y) — a pose carries no roll;
//  · boot is silent.
//
// THE CONTROL is the load-bearing part: the same page is served with the
// frame bracket short-circuited (every update goes straight to OrbitControls,
// the pre-fix behaviour), and the mouse drag must then move the polar angle
// by more than CONTROL_MIN_DEG. A probe whose roll never happened — a drag
// that missed the face, say — would pass the acceptance for that reason alone,
// and the control is what refuses it. It also refuses a run whose pad drag
// left `up` within ROLL_MIN_DEG of +Y.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8376;
// A sideways drag turns about the camera's up exactly (measured 0.0°); the
// tolerance is room for a drag with a few pixels of vertical travel in it.
const AXIS_TOL_DEG = 3;
// The control must clear the acceptance tolerance by a wide margin or the two
// runs are not telling different things apart: 3 × AXIS_TOL_DEG. The
// unfixed build moves the polar angle ~30° on this gesture after a ~44° roll.
const CONTROL_MIN_DEG = 3 * AXIS_TOL_DEG;
const ROLL_MIN_DEG = 10;

const BYPASS_FROM = 'if (camera.up.equals(_orbitY)) return orbitStep(deltaTime);';
if (!readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').includes(BYPASS_FROM)) {
  console.error('REFUSED: src/main.js no longer contains the orbit-frame fast path this probe rewrites for its control:\n  ' + BYPASS_FROM);
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
  const stateMiss = [];
  // A plain static server has no /__state (dev_server.py's persistence): the
  // app's GET 404s and its PUT 501s, and falls back to localStorage. Those two
  // misses are this harness, not the build; every other failed load counts.
  page.on('response', (r) => { if ((r.status() === 404 || r.status() === 501) && new URL(r.url()).pathname === '/__state') stateMiss.push(r.url()); });
  page.on('console', (m) => {
    const t = m.text();
    if (/WebGL|ReadPixels|GPU stall/.test(t)) return;
    if (/Failed to load resource: .*\b(404|501)\b/.test(t) && stateMiss.length) { stateMiss.pop(); return; }
    if (m.type() === 'warning' || m.type() === 'error') warns.push(t);
  });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + e));
  if (bypass) await page.route('**/src/main.js*', async (route) => {
    const r = await route.fetch();
    route.fulfill({ body: (await r.text()).replace(BYPASS_FROM, 'return orbitStep(deltaTime);'), contentType: 'text/javascript' });
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?hud=1`);
  await page.waitForFunction(() => window.__clock?.boot?.done || window.__bootError, null, { timeout: 600000 });
  const bootError = await page.evaluate(() => window.__bootError && String(window.__bootError));
  if (bootError) throw new Error('boot failed: ' + bootError);
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);

  const snap = () => page.evaluate(() => {
    const c = __clock.camera, T = __clock.controls.target;
    return { off: c.position.clone().sub(T).toArray(), up: c.up.toArray() };
  });
  // A turn about `camera.up` through the target keeps the offset's polar angle
  // from `up` and its length, and nothing else does: so |Δpolar| is the
  // measure, and `turned` (the angle between the two offsets) proves it moved.
  const axisDeg = (a, b) => page.evaluate(([a, b]) => {
    const V = __clock.camera.up.constructor;
    const o0 = new V().fromArray(a.off), o1 = new V().fromArray(b.off), u = new V().fromArray(a.up);
    return { deg: Math.abs(o1.angleTo(u) - o0.angleTo(u)) * 180 / Math.PI, turned: o0.angleTo(o1) * 180 / Math.PI };
  }, [a, b]);
  const settle = async () => { await page.waitForTimeout(1200); };

  async function drag(touch) {
    const a = await snap();
    const [x0, y0, dx] = [500, 450, 150];
    if (touch) {
      const t = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: y0, id: 1 }] });
      await t('touchStart', x0);
      for (let i = 1; i <= 10; i++) { await t('touchMove', x0 + dx * i / 10); await page.waitForTimeout(16); }
      await t('touchEnd');
    } else {
      await page.mouse.move(x0, y0); await page.mouse.down();
      await page.mouse.move(x0 + dx, y0, { steps: 10 }); await page.mouse.up();
    }
    await settle();
    return axisDeg(a, await snap());
  }

  // Roll: a quarter circle inside the face's hit disc.
  const face = await page.evaluate(() => {
    const r = document.querySelector('#ctl-hud [data-ctl="spin"]').getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, R: r.width / 2 * 0.9 };
  });
  await page.mouse.move(face.cx + face.R, face.cy); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { const th = i / 12 * Math.PI / 2; await page.mouse.move(face.cx + face.R * Math.cos(th), face.cy + face.R * Math.sin(th)); }
  await page.mouse.up();
  await settle();
  const rolled = await snap();
  const rollDeg = Math.acos(Math.min(1, rolled.up[1] / Math.hypot(...rolled.up))) * 180 / Math.PI;

  const mouse = await drag(false);
  const out = { rollDeg, mouse };
  if (!bypass) {
    out.touch = await drag(true);
    const a = await snap();
    await page.mouse.click(600, 300); await page.keyboard.press('ArrowLeft');
    await settle();
    out.key = await axisDeg(a, await snap());
    await page.evaluate(() => [...document.querySelectorAll('.hud-panel .presets button')].find((b) => b.dataset.cam === 'Escapement').click());
    for (let i = 0; i < 20; i++) await page.evaluate(() => __clock.step(0.1));
    out.presetUp = (await snap()).up;
  }
  out.warns = warns;
  await ctx.close();
  return out;
}

const fmt = (x) => (x == null ? '—' : x.toFixed(1));
const fail = [];
let live, ctrl;
try {
  live = await run({ bypass: false });
  ctrl = await run({ bypass: true });
} catch (e) {
  fail.push(String(e && e.stack || e));
}
await browser.close(); srv.kill();

if (live) {
  console.log(`roll left by the pad drag      ${fmt(live.rollDeg)}° off +Y`);
  for (const [k, r] of [['mouse drag', live.mouse], ['touch drag', live.touch], ['arrow key', live.key]]) {
    console.log(`${k.padEnd(30)} polar Δ ${fmt(r.deg)}° about camera.up, turned ${fmt(r.turned)}°`);
    if (r.deg === null || r.deg > AXIS_TOL_DEG) fail.push(`${k} after a roll moved the view's polar angle about camera.up by ${fmt(r.deg)}° (> ${AXIS_TOL_DEG}°)`);
    if (!(r.turned > 0.05)) fail.push(`${k} did not move the view (${fmt(r.turned)}°) — the gesture never reached the controls`);
  }
  console.log(`preset up                      [${live.presetUp.map((v) => v.toFixed(4)).join(', ')}]`);
  if (Math.abs(live.presetUp[1] - 1) > 1e-6) fail.push('a preset did not fly back level — up is not +Y after it');
  if (live.rollDeg < ROLL_MIN_DEG) fail.push(`the pad drag rolled the camera only ${fmt(live.rollDeg)}° — no roll, so nothing above was tested`);
  if (live.warns.length) fail.push('boot not silent:\n  ' + live.warns.join('\n  '));
}
if (ctrl) {
  console.log(`CONTROL (frame bypassed) mouse polar Δ ${fmt(ctrl.mouse.deg)}° about camera.up after a ${fmt(ctrl.rollDeg)}° roll`);
  if (ctrl.mouse.deg === null || ctrl.mouse.deg < CONTROL_MIN_DEG)
    fail.push(`CONTROL read ${fmt(ctrl.mouse.deg)}° (< ${CONTROL_MIN_DEG}°) — the pre-fix build did not reproduce the defect, so the pass above proves nothing`);
}
console.log('');
if (fail.length) { for (const f of fail) console.error('FAIL: ' + f); process.exit(1); }
console.log(`PASS — after a ${fmt(live.rollDeg)}° roll, polar Δ about camera.up: mouse ${fmt(live.mouse.deg)}°, touch ${fmt(live.touch.deg)}°, key ${fmt(live.key.deg)}°; preset level; control ${fmt(ctrl.mouse.deg)}°`);
