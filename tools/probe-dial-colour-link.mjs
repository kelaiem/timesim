// DOES THE DIAL'S COLOUR SURVIVE A LINK — AND WHOSE COLOUR WINS?
// Acceptance. `?dialcol=rrggbb` is FINISH travelling in a URL, which puts it
// between two things that were previously separate: the aesthetics store
// (browser-local, persisted, the viewer's own taste) and the share link (a
// claim about a watch someone else will see). Six behaviours fall out of that,
// and every one of them is a decision rather than an implementation detail —
// so they are asserted here rather than left to be rediscovered.
//
//   1. The shipped colour does NOT travel. §37's "only non-default travels":
//      a bare view link stays a view link.
//   2. A colour that arrived by link travels on. The recipient can forward it.
//   3. It survives the second hop unchanged — the link is idempotent, not a
//      lossy re-encoding (the '#' is dropped and re-added; this is where that
//      round trip is proven).
//   4. A colour tuned in the PANEL travels too. The link carries the dial the
//      sender is looking at, whichever way they got there.
//   5. THE LINK WINS over the recipient's own saved colour. §97's rule: a
//      recipient who saw their own dial instead would be looking at a
//      different watch from the one that was sent, with nothing saying so.
//   6. ...and their saved colour is NOT overwritten. A link shows someone a
//      dial; it does not edit their preferences. Without the param they get
//      their own back.
//
// 5 and 6 are the pair that matters and they pull in opposite directions —
// either alone is easy and wrong. A probe that checked only 5 would pass an
// implementation that clobbers the store; only 6, one that ignores the link.
//
// Not checked here, and deliberately: whether the colour is LEGIBLE. The
// contrast floor (DIAL_INK_CONTRAST_MIN, WCAG 2.1 SC 1.4.11) is asserted at
// paint by geometry.js, in one copy called at build and on every live
// recolour, and re-checking it here would be the second transcription of a
// threshold that file's own comment warns against. What the link changes is
// WHO can trigger that warning — see the BUILT record.
//
// Run: node tools/probe-dial-colour-link.mjs   (ROOT= to measure another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8457);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const SENT = '#1b3a5c';        // a navy nobody would reach by accident
const THEIRS = '#7a1f1f';      // the recipient's own saved colour, equally distinct
const fails = [];
const check = (name, got, want) => {
  const ok = got === want;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${JSON.stringify(got)}${ok ? '' : `  (wanted ${JSON.stringify(want)})`}`);
  if (!ok) fails.push(name);
};

// A fresh context per case: aesthetics overrides live in localStorage, so a
// shared one would let case 4 leak into case 1 and quietly turn this into a
// test of whatever ran before it.
async function open(qs, { store = null } = {}) {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fails.push('pageerror'); console.log('  PAGEERROR', String(e).slice(0, 200)); });
  if (store) {
    // Seed the store the way the panel would, then load for real.
    await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate((c) => localStorage.setItem('aestheticsOverrides',
      JSON.stringify({ dial: { face: { color: c } } })), store);
  }
  await page.goto(BASE + qs, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  return { ctx, page };
}
const effective = (page) => page.evaluate(async () =>
  (await import('./src/aesthetics.js')).aesthetics.dial.face.color);
const storedColour = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('aestheticsOverrides')).dial.face.color; } catch { return null; }
});
// The button lives in the panel, which is hidden by default since §146 — so
// click the element rather than the pixel; this is about the link it builds.
async function shareLink(page) {
  await page.evaluate(() => document.getElementById('btn-copy-view').click());
  await page.waitForTimeout(400);
  const url = await page.evaluate(() => navigator.clipboard.readText());
  // THE CONTROL. Every "the key is absent" assertion below would also pass on
  // an empty string, a null, or a link this probe failed to build at all —
  // which is exactly how an instrument comes back clean having measured
  // nothing. A share link always carries a camera pose, so require one.
  const q = new URL(url).searchParams;
  if (!q.get('cam')) throw new Error(`the share link carries no ?cam — this probe built nothing to judge: ${url}`);
  return q;
}

console.log(`dial colour through the link — sent ${SENT}, recipient's own ${THEIRS}\n`);

{ // 1 — the shipped colour does not travel
  const { ctx, page } = await open('');
  check('1. shipped colour: absent from the link', (await shareLink(page)).get('dialcol'), null);
  await ctx.close();
}
{ // 2 + 3 — it travels, and survives the hop
  const { ctx, page } = await open(`?dialcol=${SENT.slice(1)}`);
  check('2. arrived by link: applied', await effective(page), SENT);
  const q = await shareLink(page);
  check('2. arrived by link: travels on', q.get('dialcol'), SENT.slice(1));
  await ctx.close();
  const hop = await open(`?dialcol=${q.get('dialcol')}`);
  check('3. second hop: unchanged', await effective(hop.page), SENT);
  await hop.ctx.close();
}
{ // 4 — a panel-tuned colour travels
  const { ctx, page } = await open('', { store: THEIRS });
  check('4. tuned in the panel: applied', await effective(page), THEIRS);
  check('4. tuned in the panel: travels', (await shareLink(page)).get('dialcol'), THEIRS.slice(1));
  await ctx.close();
}
{ // 5 + 6 — the link wins, the store is untouched
  const { ctx, page } = await open(`?dialcol=${SENT.slice(1)}`, { store: THEIRS });
  check('5. link beats the recipient’s saved colour', await effective(page), SENT);
  check('6. their saved colour is not overwritten', await storedColour(page), THEIRS);
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  check('6. without the param, theirs is back', await effective(page), THEIRS);
  await ctx.close();
}
{ // and the refusals — a URL is untrusted input
  for (const bad of ['zzz', '1b3a5', '1b3a5cc', '<script>', '', 'rgb(1,2,3)']) {
    const { ctx, page } = await open(`?dialcol=${encodeURIComponent(bad)}`);
    check(`refused, file's colour stands: ${JSON.stringify(bad)}`, await effective(page), '#e7e5dd');
    await ctx.close();
  }
}

console.log(`\n${fails.length ? `${fails.length} FAILED: ${fails.join(', ')}` : 'all behaviours hold'}`);
await browser.close(); srv.kill();
process.exit(fails.length ? 1 : 0);
