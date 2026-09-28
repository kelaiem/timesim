// TODO 158 — DOES THE PAGE SAY WHEN ITS GEOMETRY WAS NEVER SWEPT? ACCEPTANCE.
//
// Only the default movement is collision-swept by the battery. A URL spec, an
// applied route or a geometry-bearing tuning (hands, markers, gong, plate)
// builds metal nobody checked, so the page computes a configuration key
// (layout.js configKey), looks it up in src/validated-configs.js, and shows an
// "Unverified configuration" pill (#config-unverified, data-state) when the key
// is not listed. The battery's three validated-configs gates hold the set true
// from the spec-boot rows; this probe holds the PAGE, row by row:
//
//   1  the default shows no mark; ?d4=16 shows it (reason 'spec', "As designed"
//      offered); ?reconf=1 (a mode) shows none; ?lang=de&d4=16 shows it in German
//   2  a stored dial.hands override shows it with reason 'tuning' and NO "As
//      designed" (clearing tuning is the Advanced panel's Reset); a stored
//      lighting override (a shareable, geometry-free subtree) shows none
//   3  LIVE: moving the flute slider raises the mark, moving it back clears it
//   4  MUTATION CONTROL: serve src/validated-configs.js with no entries — the
//      default must then read unverified. A page that hard-coded "default =
//      verified" would pass rows 1–3 and fail here.
//   5  the key Node computes (importing layout.js) equals the page's identity key
//   6  both strings are in all twelve locale tables
//   7  FIT: the pill stays inside the viewport and off the HUD panel, the
//      chrome bar and the view panel, in English, German, Russian and Hindi,
//      at 360, 412, 600, 768, 1024 and 1440 px (600 overlapped the bar when the
//      pill was simply centred — the probe's first widths missed it)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8596;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const { configKey } = await import(new URL('../src/layout.js', import.meta.url));

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const fails = [];
const fail = (s) => { fails.push(s); console.log('  FAIL ' + s); };
const ok = (s) => console.log('  ok   ' + s);

async function boot(q = '', { overrides = null, emptySet = false, width = 1280 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  await ctx.route('**/__state*', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 204, body: '' })));
  if (emptySet) await ctx.route('**/src/validated-configs.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: 'export const VALIDATED_CONFIGS = Object.freeze([]);\n' }));
  if (overrides) await ctx.addInitScript((o) => { try { localStorage.setItem('aestheticsOverrides', JSON.stringify(o)); } catch {} }, overrides);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html${q}`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 300000, polling: 1000 });
  return { ctx, page, errors };
}
const read = (page) => page.evaluate(() => {
  const p = document.getElementById('config-unverified');
  const b = document.getElementById('btn-config-as-designed');
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return (r.width && r.height && getComputedStyle(el).display !== 'none') ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  return {
    cfg: window.__clock.config,
    pill: p ? { state: p.dataset.state, reasons: p.dataset.reasons, text: p.querySelector('.config-unverified-text')?.textContent, button: b ? b.style.display !== 'none' : false,
      rect: rect(p), textClipped: (() => { const s = p.querySelector('.config-unverified-text'); return s ? s.scrollWidth > s.clientWidth + 1 : null; })() } : null,
    hud: rect(document.getElementById('clock-ui')), chrome: rect(document.getElementById('chrome-bar')), view: rect(document.getElementById('view-hud')), vw: innerWidth,
  };
});

// 1
{
  const cases = [['', false, null], ['?d4=16', true, 'spec'], ['?reconf=1', false, null], ['?lang=de&d4=16', true, 'spec']];
  for (const [q, want, reason] of cases) {
    const B = await boot(q);
    const r = await read(B.page);
    const tag = q || '(default)';
    if (B.errors.length) fail(`${tag}: page error ${B.errors[0]}`);
    if (!!r.pill !== want || r.cfg.verified === want) fail(`${tag}: mark ${!!r.pill}, verified ${r.cfg.verified} — want mark ${want}`);
    else if (want && (r.pill.state !== 'unverified' || !r.pill.reasons.split(' ').includes(reason) || !r.pill.button)) fail(`${tag}: pill ${JSON.stringify(r.pill)} — want state unverified, reason ${reason}, "As designed" offered`);
    else if (q.includes('lang=de') && r.pill.text !== 'Ungeprüfte Konfiguration') fail(`${tag}: pill text '${r.pill.text}' is not the German string`);
    else ok(`${tag}: ${want ? `marked (${r.pill.reasons}) — '${r.pill.text}'` : 'no mark, verified'}`);
    if (!q) {
      const node = configKey();
      if (r.cfg.key !== node) fail(`5: the page's identity key ${r.cfg.key} differs from Node's ${node}`);
      else ok(`5: Node and the page agree on the identity key`);
      const missing = await B.page.evaluate(async () => {
        const m = await import('./src/i18n.js');
        const keys = ['Unverified configuration', 'No collision sweep has checked this configuration — only the as-designed movement is verified'];
        return Object.entries(m.TABLES).flatMap(([lang, tb]) => keys.filter((k) => !tb[k]).map((k) => `${lang}: ${k}`));
      });
      if (missing.length) fail(`6: missing translations — ${missing.join('; ')}`);
      else ok('6: both strings present in all twelve locale tables');
    }
    await B.ctx.close();
  }
}

// 2
{
  const T = await boot('', { overrides: { dial: { hands: { fluteFactor: -0.05 } } } });
  const r = await read(T.page);
  if (!r.pill || !r.pill.reasons.split(' ').includes('tuning') || r.pill.button || !r.cfg.tuned.includes('dial.hands.fluteFactor'))
    fail(`2: a stored hands override — ${JSON.stringify({ pill: r.pill, cfg: r.cfg })}; want reason tuning, no "As designed", dial.hands.fluteFactor listed`);
  else ok(`2: a stored dial.hands override marks the build (tuning), with no "As designed"`);
  await T.ctx.close();
  const L = await boot('', { overrides: { lighting: { keyLight: { intensity: 1.2345 } } } });
  const l = await read(L.page);
  if (l.pill || !l.cfg.verified) fail(`2: a stored lighting override (shareable, geometry-free) raised the mark — ${JSON.stringify(l.cfg)}`);
  else ok('2: a stored lighting override does not');
  await L.ctx.close();
}

// 3
{
  const B = await boot('');
  const res = await B.page.evaluate(() => {
    const el = document.querySelector('input[data-path="dial.hands.fluteFactor"]');
    if (!el) return { missing: true };
    const was = el.value;
    const set = (v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return !!document.getElementById('config-unverified'); };
    const moved = set(String(Number(was) - 0.02));
    const back = set(was);
    return { moved, back, was };
  });
  if (res.missing) fail('3: no Advanced-panel control carries data-path="dial.hands.fluteFactor"');
  else if (!res.moved || res.back) fail(`3: live edit — mark after moving ${res.moved}, after restoring ${res.back}; want true then false`);
  else ok('3: moving the flute slider raises the mark live, and moving it back clears it');
  await B.ctx.close();
}

// 4
{
  const B = await boot('', { emptySet: true });
  const r = await read(B.page);
  if (r.cfg.verified || !r.pill) fail(`4: with the set emptied the default still reads verified (${JSON.stringify(r.cfg)}) — the page is not reading the set`);
  else ok('4: CONTROL — with the set emptied the default reads unverified: the page reads the set, it does not hard-code the default');
  await B.ctx.close();
}

// 7
{
  const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  for (const lang of ['en', 'de', 'ru', 'hi']) for (const width of [360, 412, 600, 768, 1024, 1440]) {
    const B = await boot(`?lang=${lang}&d4=16`, { width });
    const r = await read(B.page);
    const p = r.pill?.rect;
    const where = `${lang} @ ${width}px`;
    if (!p) fail(`7: ${where}: no pill rendered`);
    else if (p.l < 0 || p.r > r.vw) fail(`7: ${where}: pill [${p.l.toFixed(0)}, ${p.r.toFixed(0)}] leaves the viewport (${r.vw})`);
    else if (hit(p, r.hud)) fail(`7: ${where}: pill overlaps the HUD panel`);
    else if (hit(p, r.chrome)) fail(`7: ${where}: pill overlaps the chrome bar`);
    else if (hit(p, r.view)) fail(`7: ${where}: pill overlaps the view panel`);
    else ok(`7: ${where}: fits [${p.l.toFixed(0)}–${p.r.toFixed(0)}]${r.pill.textClipped ? ' (label ellipsised)' : ''}`);
    await B.ctx.close();
  }
}

await browser.close();
console.log(fails.length ? `\nFAIL — ${fails.length} problem(s)` : '\nPASS — the page marks exactly the configurations the battery never swept');
process.exit(fails.length ? 1 : 0);
