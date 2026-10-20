// DOES THE TECHNIC PAGE'S CAROUSEL WALK, IN A REAL BROWSER, AT A DESKTOP AND AT A
// PHONE'S WIDTH: ENTER, NEXT THROUGH EVERY STOP AND PREVIOUS BACK, THE CAMERA
// MOVING EACH TIME, ONE CELL SHOWN, THE BAR INSIDE THE SCREEN, ?cell= AND
// ?focus= LANDING, AND NO CONSOLE ERROR?
// Acceptance, needs Chromium (Playwright from tools/node_modules); exits
// non-zero on any failure. BUILT §294 (technic.html, src/technic-carousel.js).
//
// DISPLAY ONLY. The pure half is tools/probe-technic-carousel.mjs; this drives
// the page. It serves the checkout from a throwaway node http server (never
// dev_server.py) and reads the camera from window.__technic. SwiftShader's
// GPU-stall notices are ignored; any other console error, page error or the
// page's own `ERROR:` / `carousel:` warning fails.
//
//   node tools/smoke-technic-carousel.mjs [--shots DIR] [--chromium PATH]
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('--shots'), EXE = arg('--chromium') ?? (process.env.CHROMIUM_PATH || undefined);
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.mpd': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/json' };
const serve = async (root) => {
  const srv = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      const body = await readFile(join(root, path === '/' ? 'technic.html' : path));
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return [srv, `http://127.0.0.1:${srv.address().port}/technic.html`];
};
const [server, base] = await serve(ROOT);
// §296: the page before the default changed, read from git (--baseline REF, default origin/main), so the
// links that must land where they did are compared with the page that landed them. Skipped, aloud, when
// that ref already opens in the tour (the comparison would be the page against itself).
const REF = arg('--baseline') ?? 'origin/main';
let server0 = null, base0 = null;
try {
  const dir = mkdtempSync(join(tmpdir(), 'technic-base-'));
  execSync(`git -C "${ROOT}" archive ${REF} technic.html src vendor | tar -x -C "${dir}"`, { stdio: 'pipe' });
  if (/initialTour/.test(readFileSync(join(dir, 'technic.html'), 'utf8'))) console.log(`baseline ${REF} already opens in the tour: comparisons with the old page SKIPPED`);
  else [server0, base0] = await serve(dir);
} catch (e) { console.log(`baseline ${REF} unavailable (${String(e.message).split('\n')[0]}): comparisons with the old page SKIPPED`); }

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log(`  ✗ ${m}`); } return !!c; };
const IGNORE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(ctx, query = '', errors, root = base) {
  const page = await ctx.newPage();
  page.on('console', (m) => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error' || /^ERROR:|^carousel:/.test(t)) errors.push(`${m.type()}: ${t}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${root}${query}`, { timeout: 180000 });
  await page.waitForFunction(() => window.__technic?.tour?.stops?.length > 0, null, { timeout: 180000 });
  await settle(page);
  return page;
}
const settle = (page) => page.waitForFunction(() => !window.__technic.tour.tweening, null, { timeout: 180000 }).then(() => page.waitForTimeout(150));
const pose = (page) => page.evaluate(() => { const T = window.__technic; return { p: T.cam.position.toArray(), t: T.controls.target.toArray(), fov: T.cam.fov }; });
const dist = (a, b) => Math.hypot(...a.p.map((v, i) => v - b.p[i]), ...a.t.map((v, i) => v - b.t[i])) + Math.abs(a.fov - b.fov);
const shot = (page, name) => SHOTS && page.screenshot({ path: join(SHOTS, `carousel-${name}.png`) });

for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844, mobile: true }]) {
  console.log(`\n== ${vp.name} ${vp.width}x${vp.height}`);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1 });
  // §296: ?tour=0 is the overview the page used to open on; the plain page is the tour at stop 1
  const ovp = await open(ctx, '?tour=0', errors), over = await pose(ovp);
  ok(await ovp.evaluate(() => !window.__technic.tour.active && location.search === '?tour=0') && (await ovp.locator('#tour').isHidden()), '?tour=0 did not open the overview, or wrote the URL');
  ok(await ovp.evaluate(() => window.__technic.tour.shown) >= 8, 'the overview does not show every cell');
  await shot(ovp, `${vp.name}-overview-tour0`); await ovp.close();
  const page = await open(ctx, '', errors);
  const stops = await page.evaluate(() => window.__technic.tour.stops.map((s) => ({ id: s.id, title: s.title })));
  const N = stops.length;
  console.log(`  ${N} stops: ${stops.map((s) => s.id).join(' ')}`);
  ok(N >= 6, `only ${N} stops`);
  ok(await page.evaluate(() => window.__technic.tour.active && window.__technic.tour.id === 'row-1' && window.__technic.tour.i === 0) && (await page.locator('#tour').isVisible()), 'the plain page did not open in the tour at stop 1');
  ok(await page.evaluate(() => window.__technic.tour.indicator) === `1 / ${N} — ${stops[0].title}`, `the bar reads "${await page.evaluate(() => window.__technic.tour.indicator)}" at the opening`);
  ok(await page.evaluate(() => window.__technic.tour.shown) === 1 && await page.evaluate(() => document.querySelectorAll('#rows .row.current').length) === 1, 'the opening shows other cells or lights no panel row');
  ok(await page.evaluate(() => location.search === '?cell=row-1'), 'the opening did not write ?cell=row-1 as entering the tour does');
  ok(await page.locator('#tour-over').isVisible() && (await page.locator('#tour-over').innerText()) === 'overview', 'the overview button is not on the opening bar');
  ok(dist(over, await pose(page)) > 1, 'the opening camera is the overview camera');
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `tourdefault-${vp.name}-plain.png`) });

  // the tour is already on; Next through every stop
  let prev = await pose(page), boxed = 0;
  for (let i = 0; i < N; i++) {
    if (i) { vp.mobile ? await page.click('#tour-next') : await page.keyboard.press('ArrowRight'); await settle(page); }
    const want = `${i + 1} / ${N} — ${stops[i].title}`;
    const got = await page.evaluate(() => window.__technic.tour.indicator);
    ok(got === want, `stop ${i + 1}: indicator "${got}" is not "${want}"`);
    const now = await pose(page), moved = dist(prev, now);
    ok(i === 0 || moved > 1e-3, `stop ${stops[i].id}: the camera did not move (${moved.toExponential(2)})`);
    prev = now;
    ok(await page.evaluate(() => window.__technic.tour.shown) === 1, `stop ${stops[i].id}: ${await page.evaluate(() => window.__technic.tour.shown)} cells show, not 1`);
    ok(await page.evaluate((id) => new URLSearchParams(location.search).get('cell') === id && !new URLSearchParams(location.search).has('focus'), stops[i].id), `stop ${stops[i].id}: ?cell= not written`);
    const lit = await page.evaluate(() => document.querySelectorAll('#rows .row.current').length);
    ok(lit === 1, `stop ${stops[i].id}: ${lit} panel rows lit`);
    // the bar stays inside the screen and clear of the panel
    const geo = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), b = r('tour'), p = r('panel');
      return { bl: b.left, br: b.right, bt: b.top, bb: b.bottom, pl: p.left, pt: p.top, pr: p.right, sw: document.scrollingElement.scrollWidth, vw: innerWidth, vh: innerHeight }; });
    ok(geo.bl >= 0 && geo.br <= geo.vw + 0.5 && geo.bb <= geo.vh && geo.sw <= geo.vw, `stop ${stops[i].id}: the bar leaves the screen ${JSON.stringify(geo)}`);
    if (vp.mobile) ok(geo.bb <= geo.pt + 1, `stop ${stops[i].id}: the bar overlaps the sheet`);
    else ok(geo.bl >= geo.pr || geo.bt >= 0 && geo.bl > 0 && geo.bl >= geo.pr - 1, `stop ${stops[i].id}: the bar overlaps the panel`);
    // the framing holds its box: every corner of the build's extent lands inside what the panel and the bar leave
    const inside = await page.evaluate((id) => { const T = window.__technic, box = T.tour.stopBox(id); if (!box) return null;
      const bar = document.getElementById('tour').getBoundingClientRect(), pan = document.getElementById('panel').getBoundingClientRect();
      const left = pan.width >= innerWidth - 1 ? 0 : pan.right, bottom = bar.top, top = 0, out = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const v = box.min.clone().set(x, y, z).project(T.cam), px = (v.x + 1) / 2 * innerWidth, py = (1 - v.y) / 2 * innerHeight;
        if (px < left - 2 || px > innerWidth + 2 || py < top - 2 || py > bottom + 2) out.push([Math.round(px), Math.round(py)]);
      }
      return { out, left, bottom }; }, stops[i].id);
    if (inside) ok(inside.out.length === 0, `stop ${stops[i].id}: the build's box leaves the visible region ${JSON.stringify(inside)}`);
    if (inside) boxed++;
    const wantShot = { 'row-2': 'row', fusee: 'fusee', escapement: 'escapement' }[stops[i].id];
    if (wantShot) await shot(page, vp.mobile ? `mobile-${wantShot}` : wantShot);
    if (vp.mobile && stops[i].id === 'motion') await shot(page, 'mobile-motion');
  }
  ok(boxed === 6, `${boxed} stops had their box checked, expected the 4 rows, keyless and motion`);
  // the ends wrap
  if (vp.mobile) await page.click('#tour-next'); else await page.keyboard.press('ArrowRight');
  await settle(page);
  ok((await page.evaluate(() => window.__technic.tour.indicator)).startsWith(`1 / ${N}`), 'Next from the last stop did not come round to the first');
  if (vp.mobile) await page.click('#tour-prev'); else await page.keyboard.press('ArrowLeft');
  await settle(page);
  ok((await page.evaluate(() => window.__technic.tour.indicator)).startsWith(`${N} / ${N}`), 'Previous from the first stop did not come round to the last');
  // and back down with Previous
  for (let i = N - 2; i >= 0; i--) {
    vp.mobile ? await page.click('#tour-prev') : await page.keyboard.press('ArrowLeft'); await settle(page);
    const got = await page.evaluate(() => window.__technic.tour.indicator);
    ok(got === `${i + 1} / ${N} — ${stops[i].title}`, `Previous: "${got}" at stop ${i + 1}`);
  }
  // Home / End and a dot
  if (!vp.mobile) {
    await page.keyboard.press('End'); await settle(page);
    ok((await page.evaluate(() => window.__technic.tour.id)) === stops[N - 1].id, 'End did not reach the last stop');
    await page.keyboard.press('Home'); await settle(page);
    ok((await page.evaluate(() => window.__technic.tour.id)) === stops[0].id, 'Home did not reach the first stop');
  }
  await page.click('#tour-dots button:nth-child(3)'); await settle(page);
  ok((await page.evaluate(() => window.__technic.tour.i)) === 2, 'a dot did not go to its stop');
  // the sliders keep their arrows
  const idBefore = await page.evaluate(() => window.__technic.tour.id);
  await page.focus('#speed'); await page.keyboard.press('ArrowRight');
  ok((await page.evaluate(() => window.__technic.tour.id)) === idBefore, 'an arrow key on the speed slider moved the tour');
  // a mid-tween drag takes the camera back: start a move, then orbit
  await page.evaluate(() => window.__technic.tour.next());
  ok(await page.evaluate(() => window.__technic.tour.tweening), 'no tween ran between two stops');
  await page.evaluate(() => window.__technic.controls.dispatchEvent({ type: 'start' }));
  ok(!(await page.evaluate(() => window.__technic.tour.tweening)), 'a drag did not cancel the tween');
  // orbit controls still work after a stop
  await settle(page);
  const before = await pose(page);
  await page.mouse.move(vp.width * 0.6, vp.height * 0.3); await page.mouse.down(); await page.mouse.move(vp.width * 0.6 + 80, vp.height * 0.3 + 20, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(200);
  if (!vp.mobile) ok(dist(before, await pose(page)) > 1e-3, 'orbit controls do not move the camera after the tween');
  // the flick: on the bar yes, on the canvas no
  if (vp.mobile) {
    const i0 = await page.evaluate(() => window.__technic.tour.i);
    const flick = (sel, dx) => page.evaluate(([sel, dx]) => { const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const ev = (t, X) => el.dispatchEvent(new PointerEvent(t, { clientX: X, clientY: y, bubbles: true, pointerId: 1, pointerType: 'touch' }));
      ev('pointerdown', x); ev('pointerup', x + dx); }, [sel, dx]);
    await flick('#tour-text', -90); await settle(page);
    ok((await page.evaluate(() => window.__technic.tour.i)) === (i0 + 1) % N, 'a leftward flick on the bar was not Next');
    await flick('#tour-text', 90); await settle(page);
    ok((await page.evaluate(() => window.__technic.tour.i)) === i0, 'a rightward flick on the bar was not Previous');
    await flick('#tour-text', -20); await settle(page);
    ok((await page.evaluate(() => window.__technic.tour.i)) === i0, 'a short wobble on the bar was a flick');
    await flick('canvas', -150); await settle(page);
    ok((await page.evaluate(() => window.__technic.tour.i)) === i0, 'a flick on the canvas moved the tour');
  }
  // the overview button returns to the whole table; the URL says so (tour=0), so a reload stays out
  await page.click('#tour-over'); await settle(page);
  ok(await page.evaluate(() => !window.__technic.tour.active && window.__technic.tour.shown >= 8 && location.search === '?tour=0'), 'overview did not restore the table and write ?tour=0');
  ok(dist(over, await pose(page)) < 1e-2 * (1 + Math.hypot(...over.p)), `overview camera ${dist(over, await pose(page)).toFixed(3)} from the ?tour=0 view`);
  ok(await page.locator('#tour').isHidden(), 'the bar stays after the overview');
  ok(await page.locator('#tour-start').innerText() === 'tour the cells', 'the panel button does not offer the tour again');
  // a generation switch in the overview STAYS in the overview (the first build alone chose the default)
  await page.evaluate(() => window.__technic.build('technic_classic')); await settle(page);
  ok(await page.evaluate(() => !window.__technic.tour.active && window.__technic.tour.shown >= 8 && location.search === '?tour=0') && await page.locator('#tour').isHidden(), 'a rebuild in the overview re-entered the tour');
  ok(errors.length === 0, `console: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// the new default against the page as it was, at the desktop size
{
  console.log('\n== default and deep links 1280x800');
  const errors = [], ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const shown = (pg) => pg.evaluate(() => window.__technic.tour.shown);
  // the old plain page is the reference for ?tour=0 and for every ?focus= link
  const same = async (what, pg, ref) => { const a = await pose(pg), b = await pose(ref); ok(dist(a, b) < 1e-6 && (await shown(pg)) === (await shown(ref)), `${what}: camera ${dist(a, b).toExponential(2)} from the old page's, cells ${await shown(pg)} vs ${await shown(ref)}`); };
  let overview;
  if (base0) {
    const old = await open(ctx, '', errors, base0); overview = await pose(old);
    const t0 = await open(ctx, '?tour=0', errors);
    await same('?tour=0 against the old plain page', t0, old);
    ok(await t0.evaluate(() => !window.__technic.tour.active && location.search === '?tour=0'), '?tour=0 entered the tour or was rewritten');
    await t0.close();
    // [new query, the old page's query for the same view]
    for (const [q, q0] of [['?focus=escapement'], ['?focus=fusee'], ['?focus=alarm'], ['?focus=strike'], ['?focus=bogus'], ['?focus=fusee&loop=0&panel=0'], ['?panel=0&loop=0&tour=0', '?panel=0&loop=0'],
      ['?cell=bogus']]) {
      const a = await open(ctx, q, errors), b = await open(ctx, q0 ?? q, errors, base0);
      const ra = await a.evaluate(() => ({ act: window.__technic.tour.active, s: location.search })), rb = await b.evaluate(() => ({ act: window.__technic.tour.active }));
      ok(!ra.act && !rb.act, `${q}: entered the tour (new ${ra.act}, old ${rb.act})`);
      await same(`${q} against the old page`, a, b);
      if (q.startsWith('?focus=')) ok(ra.s === q, `${q} was rewritten to ${ra.s}`);
      await a.close(); await b.close();
    }
    await old.close();
  } else console.log('  (no old page to compare: the identity checks are skipped)');
  if (!overview) { const t = await open(ctx, '?tour=0', errors); overview = await pose(t); await t.close(); }
  // ?tour=0 beside the other switches
  const sw = await open(ctx, '?tour=0&panel=0&loop=0&auto=0&gen=technic_classic', errors);
  ok(await sw.evaluate(() => !window.__technic.tour.active && document.getElementById('panel').hidden && window.__technic.fuseeLoop?.on === false), '?tour=0 with panel/loop/auto/gen did not hold');
  await sw.close();
  // the default beside the other switches: the tour, in their state
  const dp = await open(ctx, '?panel=0&loop=0&auto=0&gen=technic_classic', errors);
  ok(await dp.evaluate(() => window.__technic.tour.active && window.__technic.tour.id === 'row-1' && document.getElementById('panel').hidden && window.__technic.fuseeLoop?.on === false), 'the default tour did not combine with panel/loop/auto/gen');
  ok(await dp.evaluate(() => { const p = new URLSearchParams(location.search); return p.get('cell') === 'row-1' && p.get('panel') === '0' && p.get('loop') === '0' && p.get('auto') === '0' && p.get('gen') === 'technic_classic'; }), 'the opening dropped a URL parameter');
  await dp.close();
  // plain: a generation switch IN the tour keeps the stop; Escape reaches the overview and a switch there stays
  const pl = await open(ctx, '', errors);
  await pl.evaluate(() => window.__technic.tour.next()); await settle(pl);
  await pl.evaluate(() => window.__technic.build('technic_classic')); await settle(pl);
  ok(await pl.evaluate(() => window.__technic.tour.active && window.__technic.tour.id === 'row-2' && window.__technic.tour.shown === 1), 'a generation switch in the opening tour lost the stop');
  await pl.keyboard.press('Escape'); await settle(pl);
  ok(await pl.evaluate(() => !window.__technic.tour.active && window.__technic.tour.shown >= 8 && location.search === '?tour=0'), 'Escape from the opening tour did not reach the overview');
  await pl.evaluate(() => window.__technic.build('technic_2026')); await settle(pl);
  ok(await pl.evaluate(() => !window.__technic.tour.active && window.__technic.tour.shown >= 8) && await pl.locator('#tour').isHidden(), 'a rebuild after Escape re-entered the tour');
  await pl.reload(); await pl.waitForFunction(() => window.__technic?.tour?.stops?.length > 0, null, { timeout: 180000 });
  ok(await pl.evaluate(() => !window.__technic.tour.active), 'a reload after leaving the tour went back in');
  await pl.close();
  // ?cell= and ?focus= unchanged
  const cell = await open(ctx, '?cell=escapement', errors);
  ok(await cell.evaluate(() => window.__technic.tour.active && window.__technic.tour.id === 'escapement'), '?cell=escapement did not open the tour at the escapement');
  ok(await cell.evaluate(() => window.__technic.tour.shown) === 1, '?cell=escapement shows more than one cell');
  const cp = await pose(cell);
  const focus = await open(ctx, '?focus=escapement', errors), fp = await pose(focus);
  const cdir = cp.p.map((v, i) => v - cp.t[i]), fdir = fp.p.map((v, i) => v - fp.t[i]), dot = cdir.reduce((s, v, i) => s + v * fdir[i], 0) / (Math.hypot(...cdir) * Math.hypot(...fdir));
  ok(dot > 0.9999 && Math.hypot(...cp.t.map((v, i) => v - fp.t[i])) < 1e-3 && Math.abs(cp.fov - fp.fov) < 1e-9, `?cell= and ?focus= escapement look from different places (cos ${dot.toFixed(5)})`);
  console.log(`  escapement: ?cell= and ?focus= look the same way (cos ${dot.toFixed(6)}); distance ${Math.hypot(...cdir).toFixed(1)} vs ${Math.hypot(...fdir).toFixed(1)} (the bar takes room)`);
  await focus.close();
  const cf = await open(ctx, '?cell=fusee&focus=alarm', errors);
  ok(await cf.evaluate(() => window.__technic.tour.id === 'fusee'), '?cell= did not win over ?focus=');
  for (const f of ['fusee', 'alarm', 'strike']) {
    const pg = await open(ctx, `?focus=${f}`, errors);
    ok(await pg.evaluate(() => !window.__technic.tour.active) && dist(overview, await pose(pg)) > 1, `?focus=${f} did not leave the overview`);
    const c2 = await open(ctx, `?cell=${f}`, errors);
    ok(await c2.evaluate((f) => window.__technic.tour.id === f, f), `?cell=${f} opened elsewhere`);
    await pg.close(); await c2.close();
  }
  for (const bad of ['?cell=', '?cell=row-99']) {
    const pg = await open(ctx, bad, errors);
    ok(await pg.evaluate(() => !window.__technic.tour.active && window.__technic.tour.shown >= 8) && dist(overview, await pose(pg)) < 1e-6, `${bad} is not the overview`);
    await pg.close();
  }
  const rowp = await open(ctx, '?cell=row-3&loop=0&panel=0', errors);
  ok(await rowp.evaluate(() => window.__technic.tour.id === 'row-3' && document.getElementById('panel').hidden), '?cell=row-3 with other parameters did not open');
  await rowp.evaluate(() => window.__technic.tour.next()); await settle(rowp);
  ok(await rowp.evaluate(() => { const p = new URLSearchParams(location.search); return p.get('loop') === '0' && p.get('panel') === '0' && p.get('cell') === 'row-4'; }), 'the tour dropped another URL parameter');
  // the generation button rebuilds the world and keeps the stop
  await rowp.evaluate(() => window.__technic.build('technic_classic')); await settle(rowp);
  ok(await rowp.evaluate(() => window.__technic.tour.active && window.__technic.tour.id === 'row-4' && window.__technic.tour.shown === 1), 'a rebuild for the other generation lost the stop');
  ok(await rowp.evaluate(() => window.__technic.fuseeLoop?.on !== undefined), 'no fusee loop state after the rebuild');
  await ctx.close();
  // reduced motion: a jump
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await open(rctx, '?tour=0', errors);
  await rp.click('#tour-start');
  ok(await rp.evaluate(() => !window.__technic.tour.tweening && window.__technic.tour.active), 'reduced motion still tweened');
  await rctx.close();
  ok(errors.length === 0, `console: ${errors.slice(0, 3).join(' | ')}`);
}

await browser.close(); server.close(); server0?.close();
console.log(`\n${checks} checks, ${fails} failed`);
if (fails) { console.log('FAIL'); process.exit(1); }
console.log('PASS');
