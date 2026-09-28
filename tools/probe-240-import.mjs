// §240 Landing 2 — IMPORT JSON, Copy JSON's inbound leg. Acceptance.
// The claims: a file picked in the Advanced panel runs through THE merge
// (`mergeAesthetics`, no second parser), persists, reloads, and says what it
// did; every way it can fail DEGRADES — says so, writes nothing, does not
// reload — and a payload that kills the build self-heals on the next boot the
// way §23's slider case does, with the receipt naming what was dropped.
//
// Rows, each in a fresh browser context (overrides live in localStorage):
//   A  CONTROL, must-hit — a seeded override is applied on a plain boot, so the
//      store this probe reads is the one the app reads.
//   1  A fragment imports: the reload happens, the leaf lands, a refused key is
//      NAMED on the receipt, a leaf tuned BEFORE the import survives it (a
//      fragment adds to a session), and a `?dialcol=` link's colour is NOT
//      written into the store (§185: a link is never written back).
//   2  Not JSON: said, nothing written, no reload.
//   3  JSON but not an object (an array): said, nothing written, no reload.
//   4  Zero applicable leaves: "no values applied" naming the refusals, nothing
//      written, no reload.
//   5  Storage refuses the write (setItem throws, a blocked or full store):
//      said, NO reload — reloading would discard what the viewer just loaded.
//   6  LETHAL. No in-bounds leaf is known to kill the build — the merge's type
//      anchor, clamp and option set exist to make that so — so the lethality
//      is injected, KEYED ON THE PAYLOAD: an init script makes 2d-canvas
//      creation throw only while the stored overrides carry a sentinel value,
//      which is exactly "a value that breaks the build" as §23's recovery sees
//      it (value-agnostic: it never knows which value, only that the build
//      died). Boot 1 must die with the marker armed; boot 2 must be clean,
//      warn §23, have dropped the store, and show the "stopped the build"
//      receipt with the Import button reachable.
//   7  Key parity: every new string exists in all twelve tables.
//   R  Warm reloads boot. The import IS a reload, and index.html used to put
//      its modulepreloads above the import map, so a warm-cache reload could
//      start main.js's graph before the map was read and die on "three"
//      (3 of 3 on one run of this container, 1 of 3 on clean main). Three
//      consecutive reloads of one tab, each read through `__bootError`.
//
// Values are read through the module singleton, like probe-240-trial-boot.mjs.
//
// Run: cd tools && node probe-240-import.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8465);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const TUNED_FILL = 0.321;       // lighting.fillLight.intensity — tuned before the import, must survive it
const IMPORT_KEY = 1.2;         // lighting.keyLight.intensity — what the file carries
const SENTINEL = 0.777;         // lighting.keyLight.intensity — the payload the harness makes lethal
const LINK_COL = '#1b3a5c';

const fails = [];
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(70)} ${JSON.stringify(got)}${ok ? '' : `  (wanted ${JSON.stringify(want)})`}`);
  if (!ok) fails.push(name);
};

// Seeded once per CONTEXT (not per navigation — the import's own reload must
// see what the import wrote, not the seed again): a flag in sessionStorage.
async function context({ overrides = null, lethal = false } = {}) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(({ o, lethal, SENTINEL }) => {
    try {
      if (o && !sessionStorage.getItem('__seeded')) {
        localStorage.setItem('aestheticsOverrides', JSON.stringify(o));
        sessionStorage.setItem('__seeded', '1');
      }
    } catch { }
    if (lethal) {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        let o = null;
        try { o = JSON.parse(localStorage.getItem('aestheticsOverrides')); } catch { }
        if (kind === '2d' && o?.lighting?.keyLight?.intensity === SENTINEL) throw new Error('probe-240-import: injected lethal payload');
        return orig.call(this, kind, ...rest);
      };
    }
  }, { o: overrides, lethal, SENTINEL });
  return ctx;
}
async function boot(ctx, qs = '', { expectDeath = false } = {}) {
  const page = await ctx.newPage();
  const warns = [], errors = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + qs, { waitUntil: 'load', timeout: 120000 });
  if (!expectDeath) await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  return { page, warns, errors };
}
const effective = (page) => page.evaluate(async () => {
  const A = await import('./src/aesthetics.js');
  return { key: A.aesthetics.lighting.keyLight.intensity, fill: A.aesthetics.lighting.fillLight.intensity,
    face: A.aesthetics.dial.face.color, defaultKey: A.AESTHETICS_DEFAULTS.lighting.keyLight.intensity,
    defaultFace: A.AESTHETICS_DEFAULTS.dial.face.color };
});
const stored = (page) => page.evaluate(() => ({ overrides: localStorage.getItem('aestheticsOverrides'), pending: localStorage.getItem('aestheticsBootPending') }));
const status = (page) => page.evaluate(() => { const s = document.getElementById('aes-import-status'); return { hidden: s.hidden, text: s.textContent }; });
const file = (text) => ({ name: 'aesthetics.json', mimeType: 'application/json', buffer: Buffer.from(text) });

// Pick a file; report whether the page reloaded. A reload is detected by a
// marker on window that a new document does not carry.
async function pick(page, text, { reloads }) {
  await page.evaluate(() => { window.__beforeImport = 1; });
  if (reloads) {
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), page.setInputFiles('#aes-import-file', file(text))]);
    await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  } else {
    await page.setInputFiles('#aes-import-file', file(text));
    await page.waitForFunction(() => !document.getElementById('aes-import-status').hidden, null, { timeout: 10000 });
    await page.waitForTimeout(500);   // a reload, if one were coming, would have started
  }
  return page.evaluate(() => window.__beforeImport !== 1);
}

console.log('§240 Landing 2 — Import JSON\n');

{ // A — must-hit
  const ctx = await context({ overrides: { lighting: { fillLight: { intensity: TUNED_FILL } } } });
  const { page } = await boot(ctx);
  check('A. CONTROL: a seeded override is applied on a plain boot', (await effective(page)).fill, TUNED_FILL);
  await ctx.close();
}
{ // 1 — a fragment imports
  const ctx = await context({ overrides: { lighting: { fillLight: { intensity: TUNED_FILL } } } });
  const { page } = await boot(ctx, `?dialcol=${LINK_COL.slice(1)}`);
  check('1. CONTROL: the link colour is live before the import', (await effective(page)).face, LINK_COL);
  const reloaded = await pick(page, JSON.stringify({ lighting: { keyLight: { intensity: IMPORT_KEY } }, bogus: { leaf: 1 } }), { reloads: true });
  check('1. a saved import reloads', reloaded, true);
  const e = await effective(page);
  check('1. the imported leaf is live after the reload', e.key, IMPORT_KEY);
  check('1. a leaf tuned before the import survives it', e.fill, TUNED_FILL);
  const st = JSON.parse((await stored(page)).overrides);
  check('1. the link colour was NOT written into the store (§185)', st.dial.face.color, e.defaultFace);
  const s = await status(page);
  check('1. the receipt is shown after the reload', s.hidden, false);
  check('1. the receipt counts applied/total', /Imported: 1\/2/.test(s.text), true);
  check('1. the receipt names the refused key', s.text.includes('bogus'), true);
  check('1. the receipt reveals the panel', await page.evaluate(() => document.getElementById('advanced-section').open && getComputedStyle(document.getElementById('clock-ui')).display !== 'none'), true);
  check('1. the receipt is consumed once the build confirms', await page.evaluate(() => sessionStorage.getItem('aestheticsImportReport')), null);
  await ctx.close();
}
for (const [row, text, re] of [
  ['2. not JSON', '{ this is not json', /Not a JSON file/],
  ['3. JSON, not an object', '[1, 2, 3]', /Not an aesthetics file/],
  ['4. zero applicable leaves', JSON.stringify({ lighting: { keyLight: { intensity: 'bright' } }, nope: 1 }), /No values applied.*lighting\.keyLight\.intensity.*nope/],
]) {
  const ctx = await context();
  const { page } = await boot(ctx);
  const before = await stored(page);
  const reloaded = await pick(page, text, { reloads: false });
  check(`${row}: no reload`, reloaded, false);
  check(`${row}: nothing written`, await stored(page), before);
  check(`${row}: said`, re.test((await status(page)).text), true);
  await ctx.close();
}
{ // 5 — the store refuses the write
  const ctx = await context();
  const { page } = await boot(ctx);
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'aestheticsOverrides') throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); };
  });
  const reloaded = await pick(page, JSON.stringify({ lighting: { keyLight: { intensity: IMPORT_KEY } } }), { reloads: false });
  check('5. unsaved: no reload', reloaded, false);
  check('5. unsaved: said', /could not be saved/.test((await status(page)).text), true);
  check('5. unsaved: nothing stored', (await stored(page)).overrides, null);
  await ctx.close();
}
{ // 6 — lethal payload, two boots
  const ctx = await context({ lethal: true });
  const { page } = await boot(ctx);
  check('6. CONTROL: the lethal hook is inert without the sentinel', (await effective(page)).key !== SENTINEL, true);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 120000 }),
    page.setInputFiles('#aes-import-file', file(JSON.stringify({ lighting: { keyLight: { intensity: SENTINEL } } })))]);
  // Boot 1 dies. The entry script CATCHES main.js's rejection and publishes it
  // as window.__bootError (TODO 30), which is what is read — not a pageerror.
  await page.waitForFunction(() => !!window.__bootError || !!window.__clock, null, { timeout: 120000 });
  const died = await page.evaluate(() => window.__bootError?.message || null);
  check('6. boot 1 died on the imported payload', /injected lethal/.test(died || ''), true);
  const watcher = await ctx.newPage();
  await watcher.goto(`http://127.0.0.1:${PORT}/vendor/LICENSE-three.txt`);
  const armed = await watcher.evaluate(() => localStorage.getItem('aestheticsBootPending'));
  check('6. boot 1 left the §23 marker armed, naming the overrides', armed, 'overrides');
  await watcher.close();
  // Boot 2 — the SAME tab (the receipt rides sessionStorage, per tab).
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.reload({ waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  check('6. boot 2 is clean (no __bootError)', await page.evaluate(() => window.__bootError || null), null);
  check('6. boot 2 warned §23', warns.some((w) => w.includes('§23')), true);
  const after = await stored(page);
  check('6. boot 2 dropped the lethal overrides', after.overrides, null);
  check('6. boot 2 runs the file\'s value', (await effective(page)).key, (await effective(page)).defaultKey);
  check('6. boot 2 says the import was dropped', /stopped the build/.test((await status(page)).text), true);
  check('6. the Import button is reachable after', await page.evaluate(() => !!document.getElementById('btn-import-aesthetics') && document.getElementById('advanced-section').open), true);
  await ctx.close();
}
{ // 7 — key parity
  const ctx = await context();
  const { page } = await boot(ctx);
  const missing = await page.evaluate(async () => {
    const { TABLES } = await import('./src/i18n.js');
    const keys = ['Import JSON', 'Load an aesthetics.json file — whole or a fragment. Its values persist in this browser and the page reloads',
      'Imported', 'refused', 'clamped', 'The file could not be read — nothing was changed', 'Not a JSON file — nothing was changed',
      'Not an aesthetics file — nothing was changed', 'No values applied — nothing was changed',
      'The tuning could not be saved in this browser — not reloaded',
      'The imported values stopped the build — they were dropped and the file’s values restored'];
    const out = [];
    for (const [loc, tb] of Object.entries(TABLES)) for (const k of keys) if (!tb[k]) out.push(`${loc}:${k.slice(0, 20)}`);
    return { n: Object.keys(TABLES).length, out };
  });
  check('7. twelve tables', missing.n, 12);
  check('7. every new string in every table', missing.out, []);
  await ctx.close();
}

{ // R — warm reloads boot
  const ctx = await context();
  const { page } = await boot(ctx);
  const got = [];
  for (let i = 0; i < 3; i++) {
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 });
    got.push(await page.evaluate(() => (window.__bootError ? window.__bootError.message.slice(0, 60) : 'ok')));
  }
  check('R. three warm reloads of one tab all boot', got, ['ok', 'ok', 'ok']);
  await ctx.close();
}

await browser.close();
srv.kill();
console.log(`\n${fails.length ? `FAIL — ${fails.length} row(s): ${fails.join('; ')}` : 'PASS — import applies through the merge, degrades on every failure, and self-heals a lethal payload'}`);
process.exit(fails.length ? 1 : 0);
