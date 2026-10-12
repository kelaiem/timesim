// IS SOUND ALWAYS OFF AT LOAD, AND DOES THE BOOT SCREEN'S BUTTON WORK? — ACCEPTANCE.
//
// Sound used to be restored from saved state (and from `?sound=1`) at boot,
// with no gesture behind it: the AudioContext came up suspended, the panel
// button read On, and the first click on it turned sound OFF. In Safari it
// never recovered, because the resume listeners fired on pointerdown (not an
// activation on iOS touch) and tested `=== 'suspended'` (Safari parks a
// context in 'interrupted'). Now index.html's boot button is the only boot
// opt-in; it holds a real click, makes and unlocks the context there, and
// main.js adopts it.
//
// Measured, in Chromium with the autoplay policy at its DEFAULT (a context
// made without a gesture really is suspended — control 1 proves it), by
// recording every AudioContext the page makes:
//   1. a save carrying soundOn:true boots with the panel button OFF and no
//      context made          2. `?sound=1` does the same
//   3. CONTROL: a context constructed with no gesture is 'suspended' — so (1)
//      and (2) staying contextless is a real absence, not a quiet browser
//   4. clicking the boot button yields exactly ONE context, 'running', which
//      main.js adopts: the panel button reads ON and no second is made
//   5. the choice survives the build whenever the click lands (as early as the harness can aim it — see the comment at 4/5)
//   6. an 'interrupted' context (Safari) is resumed by the next real click —
//      simulated by overriding .state/.resume on the adopted instance
//   7. the boot button toggles off again and the panel stays OFF
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8393;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
// Playwright's Chromium defaults to --autoplay-policy=no-user-gesture-required,
// which would make every "needs a gesture" claim here vacuous (the CONTROL below
// caught exactly that). Put the real policy back.
const browser = await chromium.launch({
  ignoreDefaultArgs: ['--autoplay-policy=no-user-gesture-required'],
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=document-user-activation-required'],
});

const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

// Record every context the page constructs, with the state it had at birth.
const INIT = (saved) => {
  window.__ctxs = [];
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(...a) { super(...a); window.__ctxs.push(this); }
  };
  if (saved) localStorage.setItem('timesim-state', JSON.stringify({ soundOn: true }));
};

async function boot({ saved = false, query = '', clickAt = null, delay = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  await page.addInitScript(INIT, saved);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html${query}`);
  if (clickAt) {
    // Actionability checks wait on rAF, which a building page does not run, so
    // find the button once and click its coordinates with raw input.
    await page.waitForTimeout(delay);
    const box = await page.locator('#boot-sound').boundingBox({ timeout: 120000 });
    if (!box) throw new Error('boot button has no box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForFunction(() => window.__clock, null, { timeout: 240000 });
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const panel = (page) => page.evaluate(() => document.getElementById('btn-sound').getAttribute('data-state'));
const ctxStates = (page) => page.evaluate(() => window.__ctxs.map((c) => c.state));

// 3. CONTROL — what "no gesture" does in this browser. Built in an INIT SCRIPT,
// because Playwright's page.evaluate runs with userGesture:true and would hand
// the context an activation that the real boot never has.
{
  const c = await browser.newContext(); const p = await c.newPage();
  await p.addInitScript(() => { try { window.__ctl = new AudioContext().state; } catch (e) { window.__ctl = 'error: ' + e.message; } });
  await p.goto(`http://127.0.0.1:${PORT}/index.html`);
  const st = await p.evaluate(() => window.__ctl);
  check('CONTROL: a context made with no gesture is suspended', st === 'suspended', `state ${st}`);
  await c.close();
}

// 1. saved soundOn:true
{
  const { ctx, page, errors } = await boot({ saved: true });
  const s = await ctxStates(page), b = await panel(page);
  check('1. a save with soundOn:true boots with sound OFF and no context', b === 'off' && s.length === 0, `panel ${b}, contexts ${JSON.stringify(s)}`);
  check('1b. boot is silent', errors.length === 0, errors.join('; '));
  await ctx.close();
}
// 2. ?sound=1
{
  const { ctx, page } = await boot({ query: '?sound=1' });
  const s = await ctxStates(page), b = await panel(page);
  check('2. ?sound=1 boots with sound OFF and no context', b === 'off' && s.length === 0, `panel ${b}, contexts ${JSON.stringify(s)}`);
  await ctx.close();
}
// 4 + 5. the boot button, clicked as early as this harness can reach it. A
// building page answers Playwright's queries (the button's box) only at a seam,
// so a click cannot be aimed mid-build; the hand-off is built to survive either
// side of main.js defining __bootSoundApply (a flag read at the end, a hook for
// a click after it), but only the reachable side is measured here.
for (const delay of [0]) {
  let r;
  try { r = await boot({ clickAt: true, delay }); }
  catch (e) { console.log(`SKIP  4/5. +${delay} ms: the boot screen was already gone (${String(e.message).split('\n')[0]})`); continue; }
  const { ctx, page, errors } = r;
  const s = await ctxStates(page), b = await panel(page);
  check(`4/5. boot button clicked at +${delay} ms: one running context, adopted — panel ON`, s.length === 1 && s[0] === 'running' && b === 'on' && errors.length === 0, `panel ${b}, contexts ${JSON.stringify(s)}`);
  if (delay === 0) {
    // 6. Safari's 'interrupted': the next real click must resume it.
    await page.evaluate(() => {
      const c = window.__ctxs[0]; let st = 'interrupted';
      Object.defineProperty(c, 'state', { get: () => st });
      c.resume = () => { st = 'running'; return Promise.resolve(); };
    });
    await page.mouse.click(500, 350);
    const after = await page.evaluate(() => window.__ctxs[0].state);
    check('6. an interrupted context is resumed by the next click', after === 'running', `state ${after}`);
  }
  await ctx.close();
}
// 7. toggling the boot button off leaves the panel off
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage(); await page.addInitScript(INIT, false);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  const box = await page.locator('#boot-sound').boundingBox({ timeout: 120000 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const pressed = await page.evaluate(() => { const b = document.getElementById('boot-sound'); b.click(); return b.getAttribute('aria-pressed'); });
  await page.waitForFunction(() => window.__clock, null, { timeout: 240000 });
  const b = await panel(page);
  check('7. boot button toggles off; panel stays OFF', pressed === 'false' && b === 'off', `pressed ${pressed}, panel ${b}`);
  await ctx.close();
}

await browser.close(); srv.kill();
const bad = results.filter((x) => !x).length;
console.log(`\n${results.length - bad}/${results.length} held`);
process.exit(bad ? 1 : 0);
