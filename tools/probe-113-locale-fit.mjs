#!/usr/bin/env node
// §113 — WHAT NO GATE MEASURES: does each locale still FIT?
//
// The Explainer gate holds the two static pages' prose (keys, markup, <code>,
// numbers) and holds SVG plate labels inside their viewBox. Four other fits
// are load-bearing and none of them is gated, because each depends on rendered
// text width in a real browser at a real width:
//
//   (a) THE FIXED PAGE HEADERS STAY ONE LINE. Both bars are position: fixed
//       above a constant body padding, so a header that grows to two lines
//       does not merely look wrong — it covers the first paragraph. §95 tier
//       two measured this by hand for three locales; §113 made it six, and
//       added a fourth cross-link-sized item to the bar (a six-option locale
//       select sized to its widest face). Widths straddle the 820 px
//       breakpoint where the stamp leaves, deliberately on both sides.
//   (b) THE CHROME BAR'S WIDTH IS A LOCALE FACT (main.js says so where it
//       measures it rather than typing a breakpoint). English 161, German 211
//       are the numbers on record; a new widest locale moves what that comment
//       should say.
//   (c) .hud-ro-label INSIDE 150 px. Two keys reach it. The rule there is that
//       a locale which does not fit simply gets two lines — so this reports,
//       and a wrap is an outcome to write down, not a failure.
//   (d) THE 240 px PANEL COLUMN (§53). Anything whose content exceeds its box
//       is reported with both widths.
//
// ENGLISH IS THE BASELINE, per the Explainer gate's convention: only what a
// translation makes WORSE is interesting, which keeps this about the
// translation rather than about pre-existing layout choices.
//
//   node tools/probe-113-locale-fit.mjs [--locales en,de,fr,ja,zh-Hant,zh]
//
// Needs python3 (dev_server.py) and a Playwright Chromium, like ci-battery.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const LOCALES = argOf('--locales', 'en,de,fr,ja,zh-Hant,zh').split(',');
// 821/820 straddle the @media (max-width: 820px) rule that hides the stamp:
// the interesting widths are the ones either side of a rule, not round numbers.
const WIDTHS = [1440, 1100, 900, 830, 821, 820, 700, 480];

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)], { cwd: ROOT, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const browser = await chromium.launch();
let failed = 0;

// ---- (a) the two fixed headers ---------------------------------------------
// Pass = the header is no TALLER than English's at that width (one line is one
// line in any script; CJK line height differs, so height-vs-English is the
// honest comparison) and the intro is not underneath it.
console.log('\n══ (a) fixed page headers — height vs English, and the intro clear of it');
for (const doc of ['explain.html', 'primer.html']) {
  const rows = {};
  for (const lang of LOCALES) {
    rows[lang] = [];
    for (const w of WIDTHS) {
      const pg = await browser.newPage({ viewport: { width: w, height: 900 } });
      await pg.goto(`${base}/${doc}?lang=${lang}`, { waitUntil: 'load', timeout: 120000 });
      rows[lang].push(await pg.evaluate(() => {
        const h = document.querySelector('header');
        const hr = h.getBoundingClientRect();
        const intro = document.querySelector('p.intro');
        const sel = document.getElementById('lang-select');
        return {
          h: +hr.height.toFixed(1),
          covered: intro ? +(hr.bottom - intro.getBoundingClientRect().top).toFixed(1) : null,
          stamp: getComputedStyle(document.querySelector('header .stamp')).display !== 'none',
          sel: sel ? +sel.getBoundingClientRect().width.toFixed(1) : null,
          scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      }));
      await pg.close();
    }
  }
  console.log(`\n  ${doc}`);
  console.log(`    ${'locale'.padEnd(9)}${WIDTHS.map((w) => String(w).padStart(8)).join('')}   select  stamp<=`);
  for (const lang of LOCALES) {
    const r = rows[lang];
    const line = r.map((x, i) => {
      const bad = x.h > rows.en[i].h + 0.5 || (x.covered !== null && x.covered > 0.5) || x.scrollX;
      if (bad) failed++;
      return (String(x.h) + (bad ? '!' : ' ')).padStart(8);
    }).join('');
    const lastStamp = WIDTHS.filter((w, i) => r[i].stamp).pop();
    console.log(`    ${lang.padEnd(9)}${line}   ${String(Math.max(...r.map((x) => x.sel ?? 0))).padStart(6)}  ${lastStamp ?? '—'}`);
  }
}
console.log('\n    ! = taller than English at that width, or covering the intro, or scrolling sideways.');

// ---- (b)(c)(d) the app ------------------------------------------------------
console.log('\n══ (b) chrome bar · (c) .hud-ro-label vs 150 px · (d) the 240 px panel column');
const appRows = [];
for (const lang of LOCALES) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.goto(`${base}/index.html?lang=${lang}`, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  appRows.push(await pg.evaluate((lg) => {
    const bar = document.getElementById('chrome-bar');
    const labels = [...document.querySelectorAll('#ctl-hud .hud-ro-label')]
      .map((e) => ({ t: e.textContent.trim(), w: +e.getBoundingClientRect().width.toFixed(1), lines: e.getClientRects().length }));
    const over = [...document.querySelectorAll('#panel *')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0)
      .map((e) => ({ cls: e.className || e.tagName, t: e.textContent.trim().slice(0, 34), s: e.scrollWidth, c: e.clientWidth }));
    return { lang: lg, bar: +bar.getBoundingClientRect().width.toFixed(1), labels, over };
  }, lang));
  await pg.close();
}
const enBar = appRows.find((r) => r.lang === 'en')?.bar ?? 0;
console.log(`\n  (b) #chrome-bar width, against English's ${enBar}`);
for (const r of appRows) console.log(`    ${r.lang.padEnd(9)}${String(r.bar).padStart(7)}${r.bar === enBar ? '' : `   ${r.bar > enBar ? '+' : ''}${(r.bar - enBar).toFixed(1)}`}`);
console.log('\n  (c) .hud-ro-label — 150 px is the box; a locale that does not fit gets two lines, by design');
for (const r of appRows)
  for (const l of r.labels)
    console.log(`    ${r.lang.padEnd(9)}${String(l.w).padStart(7)}  ${l.lines > 1 ? 'WRAPS  ' : '1 line '} ${l.t}`);
console.log('\n  (d) panel content wider than its box (the §53 240 px column)');
let overs = 0;
for (const r of appRows) for (const o of r.over) { overs++; console.log(`    ${r.lang.padEnd(9)}${o.s}>${o.c}  ${o.cls}  ${o.t}`); }
if (!overs) console.log('    none, in any locale');

await browser.close();
server.kill();
console.log(`\n${failed ? `FAIL — ${failed} header cell(s) worse than English` : 'PASS — every header one line, no locale worse than English'}`);
process.exit(failed ? 1 : 0);
