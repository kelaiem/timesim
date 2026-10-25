// DO THE LOADING SCREEN'S VIEW BOXES SHOW THE VIEW THAT LOADS? Acceptance:
// exits non-zero on any failure.
//
// The loading screen (index.html) carries three view checkboxes — Case,
// Wireframe view, Plate X-ray — and main.js decides the view the movement opens
// in from the saved state, the renderer and the link. Until src/boot-view.js the
// boxes were hard-coded in the markup (case on, wireframe off, x-ray on) and read
// nothing, so a saved wireframe, a first run under software GL, or a ?schematic=
// link showed one thing and loaded another; and main.js applies only a box the
// visitor CHANGES, so a click meant to turn the wireframe off could agree with it
// instead. Both halves now read boot-view.js's one law; this holds them to each
// other on real boots.
//
// Per scenario (a fresh browser context each; the saved state planted in
// localStorage before the page loads — the probe's server answers /__state the
// way a static host does, so state.js falls back to localStorage exactly as it
// does off the dev server):
//   B  BOXES: with main.js's request held (index.html modulepreloads it, and the
//      import reuses that fetch, so the build cannot start) and the prefill
//      landed, each box reads the view the law predicts for that state,
//      renderer and link.
//   L  LOADED: after boot, the panel's toggles (data-state, never their text —
//      CLAUDE.md's rule) read the same three values the boxes showed (read
//      before boot completes: the screen leaves the DOM once it fades). B and L
//      together are the claim: the screen shows what loads.
//   C  CHOICE: in the scenario where the visitor unticks the wireframe on the
//      loading screen while a saved state and a ?schematic=1 link both say on,
//      the wireframe LOADS off — their choice is the more recent intent.
// Controls: K1 the markup's own defaults (each box's defaultChecked — what the
// screen showed before the prefill existed) must DIFFER from the loaded view in
// at least one box of at least one scenario, or this probe could not have seen
// the bug it exists for; K2 a box name that resolves to no element THROWS.
//
// This runs under SwiftShader (the probe's Chromium), so the renderer default
// it exercises is software GL's: wireframe ON on a first run. The GPU branch of
// the law is the same expression with the other boolean, and is checked in Node
// below (N) against isSoftwareRenderer's reading of real renderer strings.
//
// Run: node tools/probe-boot-view.mjs [--only NAME]
//      PW_CHROMIUM=/path/to/chrome when Playwright's own browser is not installed
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialView, isSoftwareRenderer } from '../src/boot-view.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };
const fmt = (v) => `case ${v.case ? 'on' : 'off'}, wireframe ${v.wireframe ? 'on' : 'off'}, x-ray ${v.xray ? 'on' : 'off'}`;

// N — the law in Node: both renderer branches of a first run, and the renderer test.
{
  const fresh = { caseLines: true, plateXray: true, schematic: null };   // state.js's defaults
  ok('N: a first run on a GPU opens solid', initialView(fresh, false).wireframe === false);
  ok('N: a first run under software GL opens in the wireframe', initialView(fresh, true).wireframe === true);
  ok('N: a SwiftShader renderer string reads as software', isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'));
  ok('N: a GPU renderer string reads as a GPU', !isSoftwareRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'));
}

// The scenarios: a saved state (null = nothing saved), a link, and whether the
// visitor unticks the wireframe on the loading screen.
const SCENARIOS = [
  { name: 'first run', saved: null, q: '' },
  { name: 'saved all off', saved: { schematic: false, caseLines: false, plateXray: false }, q: '' },
  { name: 'saved wireframe on', saved: { schematic: true }, q: '' },
  { name: 'link overrides saved', saved: { schematic: true, plateXray: true }, q: 'schematic=0&xray=0' },
  { name: 'visitor unticks wireframe', saved: { schematic: true }, q: 'schematic=1', untick: 'wireframe' },
];
const run = only ? SCENARIOS.filter((s) => s.name === only) : SCENARIOS;
if (!run.length) { console.error(`--only ${only}: no such scenario (${SCENARIOS.map((s) => s.name).join(', ')})`); process.exit(2); }

const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  // A static host: no /__state endpoint. GET 404s (state.js reads localStorage
  // instead); a PUT is refused the way such a host refuses it (405), which is
  // state.js's signal to save to localStorage from then on.
  if (path === '/__state') { res.writeHead(req.method === 'GET' ? 404 : 405).end(); return; }
  try {
    const p = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL|Failed to load resource|__state/i;
const BOX = { case: 'case', wireframe: 'wireframe', xray: 'xray' };
const BTN = { case: 'btn-case', wireframe: 'btn-schematic', xray: 'btn-xray' };
let controlSeen = false;
for (const sc of run) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (sc.saved) await ctx.addInitScript((s) => { try { localStorage.setItem('timesim-state', s); } catch (e) { /* none */ } }, JSON.stringify(sc.saved));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  // The loading screen awaits its prefill BEFORE it imports main.js, so the
  // request for main.js is the moment the boxes are final and the build has not
  // started. The probe holds that request, reads the boxes and makes the
  // visitor's change, then releases it. Polling for the prefill instead does not
  // work: once the build runs the page's timers starve behind its yields
  // (CLAUDE.md, §267's trap), so a poll resolves only as the screen retires.
  let release, atMain;
  const held = new Promise((r) => { release = r; });
  const reached = new Promise((r) => { atMain = r; });
  await page.route(/\/src\/main\.js(\?|$)/, async (route) => { atMain(); await held; await route.continue(); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0${sc.q ? '&' + sc.q : ''}`, { waitUntil: 'commit' });
  await Promise.race([reached, new Promise((_, rej) => setTimeout(() => rej(new Error(`${sc.name}: the page never asked for main.js`)), 120000))]);
  // The first ask is index.html's modulepreload, at parse time, before the
  // prefill; the import reuses that fetch, so holding it holds the build. With
  // nothing building, the page's timers run and a poll for the prefill is sound.
  await page.waitForFunction(() => !!window.__bootViewShown, null, { timeout: 120000, polling: 50 });
  const boxesAt = () => page.evaluate((BOX) => {
    const out = {}, defaults = {};
    for (const [k, v] of Object.entries(BOX)) {
      const el = document.querySelector(`#boot-prefs [data-view="${v}"]`);
      if (!el) throw new Error(`no loading-screen box for ${k}`);
      out[k] = el.checked; defaults[k] = el.defaultChecked;
    }
    return { out, defaults, predicted: window.__bootViewShown, renderer: (() => {
      try { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); const n = gl.getParameter(e.UNMASKED_RENDERER_WEBGL); gl.getExtension('WEBGL_lose_context')?.loseContext(); return n; } catch (e) { return ''; }
    })() };
  }, BOX);
  const before = await boxesAt();
  // The law's own prediction for this scenario, computed here in Node from the
  // state the page will merge (state.js's defaults under the saved fields).
  const merged = { caseLines: true, plateXray: true, schematic: null, ...(sc.saved || {}) };
  const expect = initialView(merged, isSoftwareRenderer(before.renderer), sc.q ? `?${sc.q}` : '');
  // What the screen shows the visitor, after their own change if they make one.
  const shown = { ...before.out };
  if (sc.untick) {
    await page.locator(`#boot-prefs [data-view="${BOX[sc.untick]}"]`).setChecked(false, { force: true });
    expect[sc.untick] = false;
    shown[sc.untick] = await page.locator(`#boot-prefs [data-view="${BOX[sc.untick]}"]`).isChecked();
  }
  release();
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 600000, polling: 1000 });
  const dead = await page.evaluate(() => window.__bootError ? String(window.__bootError.message || window.__bootError) : null);
  if (dead) { ok(`${sc.name}: boots`, false, dead); await ctx.close(); continue; }
  const loaded = await page.evaluate((BTN) => {
    const out = {};
    for (const [k, id] of Object.entries(BTN)) {
      const b = document.getElementById(id);
      if (!b) throw new Error(`no panel toggle #${id}`);
      out[k] = b.dataset.state === 'on';
    }
    return out;
  }, BTN);
  await ctx.close();
  console.log(`\n== ${sc.name}${sc.saved ? ` (saved ${JSON.stringify(sc.saved)})` : ' (nothing saved)'}${sc.q ? ` ?${sc.q}` : ''} — renderer ${isSoftwareRenderer(before.renderer) ? 'software' : 'GPU'}`);
  ok(`${sc.name}: B — the boxes, once prefilled, show the law's view`, ['case', 'wireframe', 'xray'].every((k) => before.out[k] === before.predicted?.[k] && before.predicted?.[k] === initialView(merged, isSoftwareRenderer(before.renderer), sc.q ? `?${sc.q}` : '')[k]),
    `boxes: ${fmt(before.out)}; the page's prediction: ${before.predicted ? fmt(before.predicted) : 'none'}`);
  // (The screen leaves the DOM once it fades — main.js retireBootScreen — so the
  // boxes are read before boot completes, after the visitor's change.)
  ok(`${sc.name}: L — the movement loads what the boxes show`, ['case', 'wireframe', 'xray'].every((k) => loaded[k] === expect[k] && shown[k] === loaded[k]),
    `loaded: ${fmt(loaded)}; the boxes showed: ${fmt(shown)}`);
  if (sc.untick) ok(`${sc.name}: C — the visitor's untick wins over the saved state and the link`, loaded[sc.untick] === false, `loaded ${sc.untick} ${loaded[sc.untick] ? 'on' : 'off'}`);
  if (['case', 'wireframe', 'xray'].some((k) => before.defaults[k] !== loaded[k])) controlSeen = true;
  ok(`${sc.name}: no page error`, !errors.length, errors.join(' | ').slice(0, 300));
}
if (!only) ok('K1: the markup\'s own defaults disagree with a loaded view somewhere — the old screen would have been caught', controlSeen);
// K2 — a box that resolves to nothing throws, never passes a scan of nothing.
{
  const ctx = await browser.newContext(), page = await ctx.newPage();
  await page.setContent('<div id="boot-prefs"></div>');
  let threw = false;
  try { await page.evaluate(() => { const el = document.querySelector('#boot-prefs [data-view="wireframe"]'); if (!el) throw new Error('no loading-screen box'); }); } catch { threw = true; }
  ok('K2: a box that resolves to no element throws', threw);
  await ctx.close();
}
await browser.close();
srv.close();
console.log(fails.length ? `\n${fails.length} FAILED:\n  ${fails.join('\n  ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
