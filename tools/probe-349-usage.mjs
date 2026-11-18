#!/usr/bin/env node
// §349 landing 1 — the usage tally's acceptance probe. Exits non-zero on any
// failed rule. Every rule has a control: a reading that would pass with the
// feature broken is not a reading.
//
//   node tools/probe-349-usage.mjs
//
// Needs python3 (dev_server.py) and a Playwright Chromium, like ci-battery;
// PW_CHROMIUM=<path> launches another Chromium binary (probe-308's convention).
// Three virgin boots (~1-2 min each under SwiftShader):
//   C  ?xray=1, no ?usage — off under automation (first, on a virgin state)
//   A  ?usage=1&xray=1&focus=Balance&nosuch=1  — links, controls, keys, dropdown,
//      untrusted clicks, the preview, Copy; then it saves its state
//   B  ?usage=1 — the restore of A's state must count nothing
//   A again: the tour, LAST, because its steps change the view and the
//      autosave would hand a heavy solid view to any later boot
//
// The rules (src/usage.js and src/usage-ui.js state why each holds):
//   1  closed vocabulary: an unlisted key, via or off-list value is refused (pure)
//   2  the table against the surface, both ways: every data-usage names a row,
//      and every row is reached by a control, a mark site or a link parameter
//   3  links count their NAMES, and only the names the table lists
//   4  user-initiated only: a trusted click counts, the same click from code
//      does not, a shortcut counts as `k`, and neither the tour's steps nor the
//      state restore count anything
//   5  a dropdown records its value; a typed field records nothing beyond its name
//   6  the preview IS the payload: the box opens on the report, and Copy puts
//      exactly the box's text, edited, on the clipboard
//   7  typing in the box does not reach the movement's shortcuts
//   8  nothing leaves: no request to another origin, no sendBeacon
//   9  off means off: under automation without ?usage=1 nothing counts, and no
//      boot writes a usage key to storage

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const U = await import(join(ROOT, 'src/usage.js'));

const fails = [];
const ok = (name, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) fails.push(name);
};

// --- 1. the pure half --------------------------------------------------------
{
  const T = U.createTally();
  ok('1 an unlisted key is refused', T.mark('not-a-row', 'c') === false && T.keys().length === 0);
  ok('1 an unlisted via is refused', T.mark('xray', 'z') === false && T.keys().length === 0);
  ok('1 control: a listed key and via are taken', T.mark('xray', 'c') === true && T.has('xray'));
  T.mark('quality', 'c', 'Ultra', ['Auto', 'High']);
  T.mark('spec:crownaz', 'c', '45', ['45']);
  T.mark('spec:case', 'c', 'tonneau', ['', 'rect', 'tonneau']);
  const v = (k) => [...T.entries().get(k).values.keys()];
  ok('1 a value off the dropdown\'s own list is refused', v('quality').length === 0);
  ok('1 a value on a row that takes none is refused', v('spec:crownaz').length === 0);
  ok('1 control: a value on the list is taken', v('spec:case').join() === 'tonneau');
  const text = U.formatReport(T, { build: 'source', env: 'source', locale: 'en', renderer: 'x', tier: 'High', viewport: 'desktop' }, { since: '2026-11' });
  const P = U.parseReport(text);
  ok('1 the report parses back whole', P.refused.length === 0 && P.items.length === 4, `${P.items.length} items, ${P.refused.length} refused`);
  const bad = U.parseReport(text.replace('xray 1 c', 'xray 1 c | evil<b> 1 c').replace('tier=High', 'tier=<b>'));
  ok('1 control: a foreign item and a foreign header value are refused', bad.refused.length === 2, bad.refused.join(' ; '));
}

// --- the browser ---------------------------------------------------------
const freePort = () => new Promise((res, rej) => {
  const s = createServer(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-usage-'));   // probe-116's reason: our own /__state
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)], { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
await ctx.addInitScript(() => {
  window.__beacons = 0;
  if (navigator.sendBeacon) { const real = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (...a) => { window.__beacons++; return real(...a); }; }
});
const foreign = [];
ctx.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== base && !/^(data|blob):/.test(r.url())) foreign.push(r.url()); });

const boot = async (page, query) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'warning' && /usage/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${base}/index.html${query}`);
  await page.waitForFunction(() => !!window.__usage || !!window.__bootError, null, { timeout: 600000 });
  const bootError = await page.evaluate(() => window.__bootError && String(window.__bootError.message || window.__bootError));
  if (bootError) throw new Error(`boot failed: ${bootError}`);
  return errs;
};
const marks = (page) => page.evaluate(() => window.__usage.marks());
const openAll = (page) => page.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });

// --- 9. off means off --------------------------------------------------------
{
  const t2 = Date.now();   // first: a virgin boot, before any journey has saved a state
  const pageC = await ctx.newPage();
  await boot(pageC, '?xray=1');
  console.log(`  boot C ${((Date.now() - t2) / 1000).toFixed(0)} s`);
  await openAll(pageC);
  await pageC.click('#btn-copy-view');
  const [on, m, stored] = await pageC.evaluate(() => [window.__usage.on, window.__usage.marks(),
    Object.keys(localStorage).filter((k) => /usage/i.test(k))]);
  ok('9 under automation without ?usage=1 nothing counts', on === false && Object.keys(m).length === 0, `on=${on}, ${Object.keys(m).length} marks`);
  ok('9 no boot wrote a usage key to storage', stored.length === 0, stored.join() || 'none');
  await pageC.close();
}

const t0 = Date.now();
const page = await ctx.newPage();
const errsA = await boot(page, '?usage=1&xray=1&focus=Balance&nosuch=1');
console.log(`  boot A ${((Date.now() - t0) / 1000).toFixed(0)} s`);
{
  const warns = await page.evaluate(() => (window.__clock.buildWarns || []).map(String));
  ok('the build stays silent with the tally on (standing rule 6)', warns.length === 0, warns.slice(0, 2).join(' ; ') || 'no build warnings');
}

// --- 2. the table against the surface -------------------------------------
{
  const tags = await page.evaluate(() => [...document.querySelectorAll('[data-usage]')].map((e) => ({ key: e.dataset.usage, tag: e.tagName, id: e.id })));
  const unknown = tags.filter((x) => !U.FEATURE.has(x.key));
  ok('2 every data-usage names a row', unknown.length === 0, unknown.map((x) => `${x.id}→${x.key}`).join(', ') || `${tags.length} tagged controls`);
  const valued = tags.filter((x) => U.FEATURE.get(x.key)?.values === 'options');
  const notSelect = valued.filter((x) => x.tag !== 'SELECT');
  ok('2 a row that records values is tagged only on a <select>', notSelect.length === 0, notSelect.map((x) => x.id).join(', ') || `${valued.length} dropdowns`);
  const src = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
  const sites = new Set([...src.matchAll(/usageMark\('([^']+)'/g)].map((m) => m[1]));
  // A site's key can be a ternary: usageMark(crownOut ? 'setHands' : 'wind', …).
  for (const m of src.matchAll(/usageMark\([^'()]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) { sites.add(m[1]); sites.add(m[2]); }
  const badSite = [...sites].filter((k) => !U.FEATURE.has(k));
  ok('2 every mark site names a row', badSite.length === 0, badSite.join(', ') || `${sites.size} sites`);
  const reached = new Set([...tags.map((x) => x.key), ...sites, ...Object.values(U.LINK_PARAMS)]);
  const orphan = U.USAGE_FEATURES.filter((r) => !r.retired && !reached.has(r.key)).map((r) => r.key);
  ok('2 every row is reached by a control, a mark site or a link', orphan.length === 0, orphan.join(', ') || `${U.USAGE_FEATURES.length} rows`);
}

// --- 3. links ------------------------------------------------------------
{
  const m = await marks(page);
  const keys = Object.keys(m).sort().join();
  ok('3 the link counts its listed names and nothing else', keys === 'focus,xray' && m.xray.via.join() === 'l', keys);
}

// --- 4/5. what counts ------------------------------------------------------
await openAll(page);
// Copy view, because it does not re-render the scene: a view toggle can swap
// the line view for the solid one, which costs 7–10 s a frame under software
// GL and stalls every later step.
await page.evaluate(() => document.getElementById('btn-copy-view').click());
ok('4 control: a click from code counts nothing', !(await marks(page)).copyView);
await page.click('#btn-copy-view');
ok('4 a visitor\'s click counts as c', (await marks(page)).copyView?.via.join() === 'c');
await page.locator('body').focus().catch(() => {});
await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
await page.keyboard.press('2');
{
  const m = await marks(page);
  ok('4 a shortcut counts as k', m['cam:Train']?.via.join() === 'k', JSON.stringify(m['cam:Train']));
}
// By KEYBOARD: Playwright's selectOption dispatches its change from script
// (isTrusted false), which the tally rightly ignores; an arrow key on a
// focused select is the visitor's own change.
const pickNext = async (sel) => { await page.focus(sel); await page.keyboard.press('ArrowDown'); };
await pickNext('#quality-select');
{
  const q = (await marks(page)).quality;
  const chosen = await page.evaluate(() => document.getElementById('quality-select').value);
  ok('5 a dropdown records its chosen option', q && Object.keys(q.values).join() === chosen && chosen !== 'Auto', `${chosen}: ${JSON.stringify(q)}`);
  await page.evaluate(() => document.activeElement.blur());
}
await pickNext('#explode-unit');
{
  const u = (await marks(page)).unit;
  ok('5 a dropdown on a row that takes no value records the name alone', u && Object.keys(u.values).length === 0, JSON.stringify(u));
  await page.evaluate(() => document.activeElement.blur());
}

// --- 6/7. the preview --------------------------------------------------------
await page.click('#btn-usage');
await page.waitForSelector('#usage-dialog[open]');
{
  const [box, report] = await page.evaluate(() => [document.getElementById('usage-text').value, window.__usage.report()]);
  ok('6 the preview opens on the report', box === report, `${box.split('\n').length - 1} lines`);
  ok('6 control: the report is not empty', /^view: .*xray 1 l/m.test(box), box.split('\n')[3] || '');
  const xrayBefore = await page.evaluate(() => document.getElementById('btn-xray').dataset.state);
  await page.focus('#usage-text');
  await page.keyboard.press('End');
  await page.keyboard.type('x note');
  const xrayAfter = await page.evaluate(() => document.getElementById('btn-xray').dataset.state);
  ok('7 typing in the box does not reach the shortcuts', xrayBefore === xrayAfter, `x-ray ${xrayBefore} → ${xrayAfter}`);
  // An edit: drop the build line, then Copy.
  const edited = await page.evaluate(() => {
    const ta = document.getElementById('usage-text');
    ta.value = ta.value.split('\n').filter((l) => !l.startsWith('build:')).join('\n');
    return ta.value;
  });
  await page.click('#usage-copy');
  await page.waitForFunction(() => document.querySelector('#usage-dialog .usage-status').textContent !== '');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok('6 Copy puts exactly the edited box on the clipboard', clip === edited, `${clip.length} chars`);
  ok('6 control: the edit changed the text', edited !== box);
  await page.click('#usage-close');
}

// --- 4. the restore ----------------------------------------------------------
{
  // The journey's Unit pick clears the focus, so set it again from CODE (the
  // same setFocus a tap reaches) and save: neither may count.
  const before = Object.keys(await marks(page)).length;
  await page.evaluate(() => window.__clock.setFocusUnit('Balance'));
  await page.waitForFunction(() => window.__clock.focusUnit === 'Balance', null, { timeout: 60000 }).catch(() => {});   // setFocus is async: it loads the drive graph first
  const focused = await page.evaluate(() => window.__clock.focusUnit);
  await page.evaluate(() => document.getElementById('btn-save-state').click());   // code's click: counts nothing, saves the state
  ok('4 a focus set from code, and a save, count nothing', Object.keys(await marks(page)).length === before && focused === 'Balance', `focus ${focused}`);
  await page.waitForTimeout(1500);   // the save is a fire-and-forget PUT
  const t1 = Date.now();
  const pageB = await ctx.newPage();
  const errsB = await boot(pageB, '?usage=1');
  console.log(`  boot B ${((Date.now() - t1) / 1000).toFixed(0)} s`);
  await pageB.waitForFunction(() => document.getElementById('btn-focus').dataset.state === 'on', null, { timeout: 60000 }).catch(() => {});
  const restored = await pageB.evaluate(() => document.getElementById('btn-focus').dataset.state);
  const m = await marks(pageB);
  ok('4 the state restore counts nothing', Object.keys(m).length === 0, Object.keys(m).join() || 'empty');
  ok('4 control: the restore re-applied a focus (through setFocus, the setter a tap reaches)', restored === 'on', `focus ${restored}`);
  ok('boot B raised no usage warning', errsB.length === 0, errsB.join(' ; '));
  await pageB.close();
}

// --- 4. the tour ---------------------------------------------------------
{
  const before = await marks(page);
  // By coordinates: the tour makes the page busy at once, and a locator click
  // waits on it afterwards; a mouse click is the same trusted input.
  await page.locator('#btn-tour').scrollIntoViewIfNeeded();
  const r = await page.evaluate(() => { const b = document.getElementById('btn-tour').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
  await page.mouse.click(r[0], r[1]);
  await page.waitForTimeout(4000);
  const after = await marks(page);
  const gained = Object.keys(after).filter((k) => !before[k]);
  ok('4 the tour\'s steps count nothing; starting it counts tour:started', gained.join() === 'tour:started', gained.join() || 'nothing');
  const stepped = await page.evaluate(() => document.getElementById('btn-tour').classList.contains('active'));
  ok('4 control: the tour ran', stepped);
}
console.log(`  journey A ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const beaconsA = await page.evaluate(() => window.__beacons);
await page.close();

// --- 8. nothing leaves -------------------------------------------------------
{
  const beacons = beaconsA;
  ok('8 no request to another origin', foreign.length === 0, foreign.slice(0, 3).join(' ') || 'none');
  ok('8 no sendBeacon', beacons === 0, String(beacons));
}
ok('boot A raised no usage warning or page error', errsA.length === 0, errsA.join(' ; '));

await browser.close();
server.kill();
console.log(fails.length ? `\nFAIL — ${fails.length} rule(s): ${fails.join('; ')}` : '\nPASS — the tally counts what the visitor did, shows it whole, and sends nothing');
process.exit(fails.length ? 1 : 0);
