// §240 Landing 3 — A TUNED LOOK TRAVELS IN A LINK (`?aes=`). Acceptance.
// The claims, each a decision rather than an implementation detail:
//   0  CONTROL + byte-identity: a virgin view link carries exactly the keys it
//      carried before this landing (cam, look) — no `aes`, no `dialcol`, no
//      `metal`. The link builder is exercised (the control: it carries a cam),
//      so "absent" cannot pass on a link this probe failed to build.
//   1  ROUND TRIP, lossless: a sender tunes leaves across four subtrees (a
//      colour, a number, a boolean, a pick) in their store; their link opens on
//      a FRESH profile with every named leaf equal to the sender's — read
//      through Copy JSON's own serializer, the plan's acceptance.
//   2  NOT WRITTEN BACK: the recipient's store is empty after the link boot.
//   3  THE LINE THAT KEEPS GEOMETRY OFF LINKS: a pair outside SHARE_SUBTREES
//      (`dial.hands.fluteFactor`, which re-cuts hands) is refused as
//      `notshareable` and the value stays the file's; an unknown path and a
//      mistyped value are refused too, and the valid pair beside them applies.
//   4  THE RECEIPT: a link with values shows the banner with applied/total
//      and the refused path; "Open without them" strips the link and reloads
//      to the file's value with the store untouched.
//   5  THE BOUND: at SHARE_MAX_PAIRS a payload parses; one past it is refused
//      whole. Both sides, because a bound tested from one side only could be
//      anywhere below it.
//   6  A LETHAL LINK SELF-HEALS and costs the viewer nothing. No shareable
//      leaf is known to kill the build (that is what aestheticsShareSafe
//      gates), so the lethality is INJECTED, keyed on the address carrying a
//      sentinel pair — exactly "a link whose value breaks the build" as the
//      value-agnostic recovery sees it. The viewer has a saved tuning. Boot 1
//      must die with the marker naming BOTH layers; boot 2 must be clean, the
//      address must no longer carry `aes`, the warning must be §240's, the
//      viewer's saved tuning must SURVIVE and apply, and the banner must say
//      the link was dropped.
//   7  A TRIAL boot ignores the link (TODO 152's guard, for the new key).
//   8  Key parity: the three new strings in all twelve tables.
//
// The dial-colour behaviours (link beats store, the old key read and never
// written, both keys at once) are probe-dial-colour-link.mjs's; the geometry
// claim is the battery's aestheticsShareSafe gate. NOT this probe's.
//
// Run: cd tools && node probe-240-link.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8469);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const BASE = `http://127.0.0.1:${PORT}/index.html`;

// The sender's tuning — one leaf of each type, across four subtrees.
const SENDER = {
  dial: { face: { color: '#1b3a5c' } },
  lighting: { keyLight: { intensity: 1.2 } },
  decoration: { perlage: { shingleFlip: false } },
  materials: { caseMetal: { alloy: 'platinum' } },
};
const NAMED = ['dial.face.color', 'lighting.keyLight.intensity', 'decoration.perlage.shingleFlip', 'materials.caseMetal.alloy'];
const VIEWER = { lighting: { fillLight: { intensity: 0.321 } } };
const SENTINEL = 'lighting.hemisphere.intensity~0.777';

const fails = [];
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(70)} ${JSON.stringify(got)}${ok ? '' : `  (wanted ${JSON.stringify(want)})`}`);
  if (!ok) fails.push(name);
};

// Seeded once per context (a flag in sessionStorage), so a reload inside the
// row sees what the app wrote rather than the seed again.
async function context({ overrides = null, lethal = false } = {}) {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
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
        if (kind === '2d' && decodeURIComponent(location.search).includes(SENTINEL)) throw new Error('probe-240-link: injected lethal link');
        return orig.call(this, kind, ...rest);
      };
    }
  }, { o: overrides, lethal, SENTINEL });
  return ctx;
}
async function boot(ctx, qs = '') {
  const page = await ctx.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.goto(BASE + qs, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 });
  return { page, warns };
}
const leaves = (page, paths) => page.evaluate(async (paths) => {
  const A = await import('./src/aesthetics.js');
  const json = JSON.parse(A.serializeOverrides(A.aesthetics));   // Copy JSON's own output
  return Object.fromEntries(paths.map((p) => [p, p.split('.').reduce((o, k) => o?.[k], json)]));
}, paths);
const defaults = (page, paths) => page.evaluate(async (paths) => {
  const A = await import('./src/aesthetics.js');
  return Object.fromEntries(paths.map((p) => [p, p.split('.').reduce((o, k) => o?.[k], A.AESTHETICS_DEFAULTS)]));
}, paths);
const stored = (page) => page.evaluate(() => localStorage.getItem('aestheticsOverrides'));
const receipt = (page) => page.evaluate(() => document.getElementById('aes-link-receipt')?.textContent ?? null);
async function shareLink(page) {
  await page.evaluate(() => document.getElementById('btn-copy-view').click());
  await page.waitForTimeout(400);
  const url = await page.evaluate(() => navigator.clipboard.readText());
  const q = new URL(url).searchParams;
  if (!q.get('cam')) throw new Error(`the share link carries no ?cam — this probe built nothing to judge: ${url}`);
  return { url, q };
}

console.log('§240 Landing 3 — the shared link\n');

{ // 0
  const ctx = await context();
  const { page } = await boot(ctx);
  const { q } = await shareLink(page);
  check('0. a virgin view link carries no aes, dialcol or metal', ['aes', 'dialcol', 'metal'].filter((k) => q.has(k)), []);
  check('0. no receipt on a plain boot', await receipt(page), null);
  await ctx.close();
}
let link;
{ // 1 + 2 — round trip
  const s = await context({ overrides: SENDER });
  const { page } = await boot(s);
  const want = await leaves(page, NAMED);
  check('1. CONTROL: the sender\'s tuning is live', want, { 'dial.face.color': '#1b3a5c', 'lighting.keyLight.intensity': 1.2, 'decoration.perlage.shingleFlip': false, 'materials.caseMetal.alloy': 'platinum' });
  const sl = await shareLink(page);
  link = sl.url;
  console.log(`        link: ${link.slice(link.indexOf('?'))}`);
  check('1. the link carries the tuning as aes, and only there', [!!sl.q.get('aes'), sl.q.get('dialcol'), sl.q.get('metal')], [true, null, null]);
  check('1. the link never contains a raw #', new URL(link).search.includes('#') || new URL(link).hash !== '', false);
  check('1. the pairs are readable: ~ and , raw, no escapes', /aes=dial\.face\.color~1b3a5c,/.test(link) && !/%7E|%2C/i.test(link), true);
  await s.close();
  const r = await context();
  const got = await boot(r, link.slice(link.indexOf('?')));
  check('1. fresh profile: every named leaf equals the sender\'s', await leaves(got.page, NAMED), want);
  check('2. not written back: the recipient\'s store is empty', await stored(got.page), null);
  check('4. the receipt counts the pairs', /: 4\/4/.test(await receipt(got.page) || ''), true);
  await r.close();
}
{ // 3 — refusals
  const ctx = await context();
  const { page } = await boot(ctx, '?aes=dial.hands.fluteFactor~0.5,no.such~1,lighting.keyLight.intensity~bright,rendering.toneMappingExposure~1.3');
  const d = await defaults(page, ['dial.hands.fluteFactor', 'lighting.keyLight.intensity']);
  const e = await leaves(page, ['dial.hands.fluteFactor', 'lighting.keyLight.intensity', 'rendering.toneMappingExposure']);
  check('3. a geometry leaf in a link is not applied', e['dial.hands.fluteFactor'], d['dial.hands.fluteFactor']);
  check('3. a mistyped value is not applied', e['lighting.keyLight.intensity'], d['lighting.keyLight.intensity']);
  check('3. the valid pair beside them applies', e['rendering.toneMappingExposure'], 1.3);
  const out = await page.evaluate(async () => (await import('./src/aesthetics.js')).LINK_OUTCOME.refused);
  check('3. refusals named with their reasons', out.map((r) => `${r.path}:${r.why}`).sort(),
    ['dial.hands.fluteFactor:notshareable', 'lighting.keyLight.intensity:type', 'no.such:notshareable']);
  const rc = await receipt(page) || '';
  check('4. the receipt says 1/4 and names the geometry leaf', /: 1\/4/.test(rc) && rc.includes('dial.hands.fluteFactor'), true);
  await ctx.close();
}
{ // 4 — open without them
  const ctx = await context({ overrides: VIEWER });
  const { page } = await boot(ctx, '?aes=rendering.toneMappingExposure~1.3');
  check('4. CONTROL: the link value is live', (await leaves(page, ['rendering.toneMappingExposure']))['rendering.toneMappingExposure'], 1.3);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), page.click('#btn-aes-link-without')]);
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  const d = await defaults(page, ['rendering.toneMappingExposure']);
  check('4. "Open without them": the address no longer carries aes', new URL(page.url()).searchParams.has('aes'), false);
  check('4. "Open without them": the file\'s value is back', (await leaves(page, ['rendering.toneMappingExposure']))['rendering.toneMappingExposure'], d['rendering.toneMappingExposure']);
  check('4. "Open without them": the viewer\'s own store untouched', JSON.parse(await stored(page)).lighting.fillLight.intensity, 0.321);
  check('4. "Open without them": no receipt after', await receipt(page), null);
  await ctx.close();
}
{ // 5 — the bound, both sides of it (read from the page: it is DERIVED from the schema)
  const ctx = await context();
  const { page } = await boot(ctx);
  const max = await page.evaluate(async () => (await import('./src/aesthetics.js')).SHARE_MAX_PAIRS);
  await ctx.close();
  const pairs = (n) => `?aes=${Array.from({ length: n }, () => 'rendering.toneMappingExposure~1.3').join(',')}`;
  for (const [n, want] of [[max, [1, []]], [max + 1, [0, ['oversize']]]]) {
    const c = await context();
    const b = await boot(c, pairs(n));
    const out = await b.page.evaluate(async () => (await import('./src/aesthetics.js')).LINK_OUTCOME);
    check(`5. ${n} pairs (SHARE_MAX_PAIRS ${n === max ? 'exactly' : '+ 1'}): applied, refusals`, [out.applied.length ? 1 : 0, out.refused.map((r) => r.why)], want);
    await c.close();
  }
}
{ // 6 — a lethal link self-heals, the viewer's tuning survives
  const ctx = await context({ overrides: VIEWER, lethal: true });
  const { page } = await boot(ctx, `?aes=${SENTINEL}`);
  const died = await page.evaluate(() => window.__bootError?.message || null);
  check('6. boot 1 died on the linked payload', /injected lethal link/.test(died || ''), true);
  const watcher = await ctx.newPage();
  await watcher.goto(`http://127.0.0.1:${PORT}/vendor/LICENSE-three.txt`);
  check('6. boot 1 left the marker naming BOTH layers', await watcher.evaluate(() => localStorage.getItem('aestheticsBootPending')), 'overrides+link');
  await watcher.close();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.reload({ waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 });
  check('6. boot 2 is clean', await page.evaluate(() => window.__bootError?.message || null), null);
  check('6. boot 2 stripped aes from the address', new URL(page.url()).searchParams.has('aes'), false);
  check('6. boot 2 warned §240 (the link), not §23 (the store)', [warns.some((w) => w.includes('§240')), warns.some((w) => w.includes('§23'))], [true, false]);
  check('6. the viewer\'s saved tuning survived', JSON.parse(await stored(page) || '{}')?.lighting?.fillLight?.intensity, 0.321);
  check('6. ...and applies', (await leaves(page, ['lighting.fillLight.intensity']))['lighting.fillLight.intensity'], 0.321);
  check('6. the receipt says the link was dropped', /stopped the build/.test(await receipt(page) || ''), true);
  check('6. the marker is confirmed clear', await page.evaluate(() => localStorage.getItem('aestheticsBootPending')), null);
  await ctx.close();
}
{ // 7 — a trial ignores the link
  const ctx = await context();
  const { page } = await boot(ctx, '?trial=1&aes=rendering.toneMappingExposure~1.3');
  const d = await defaults(page, ['rendering.toneMappingExposure']);
  const e = await page.evaluate(async () => (await import('./src/aesthetics.js')).aesthetics.rendering.toneMappingExposure);
  check('7. ?trial=1 does not apply a link\'s aes', e, d['rendering.toneMappingExposure']);
  await ctx.close();
}
{ // 8 — key parity
  const ctx = await context();
  const { page } = await boot(ctx);
  const missing = await page.evaluate(async () => {
    const { TABLES } = await import('./src/i18n.js');
    const keys = ['This link carries tuned values', 'Open without them',
      'A shared link’s tuned values stopped the build — they were dropped, and this browser’s own tuning kept'];
    const out = [];
    for (const [loc, tb] of Object.entries(TABLES)) for (const k of keys) if (!tb[k]) out.push(`${loc}:${k.slice(0, 20)}`);
    return { n: Object.keys(TABLES).length, out };
  });
  check('8. twelve tables, every new string in each', [missing.n, missing.out], [12, []]);
  await ctx.close();
}

await browser.close();
srv.kill();
console.log(`\n${fails.length ? `FAIL — ${fails.length} row(s): ${fails.join('; ')}` : 'PASS — the tuned look travels, stays off geometry, is never written back, and a lethal link heals'}`);
process.exit(fails.length ? 1 : 0);
