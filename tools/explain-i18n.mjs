#!/usr/bin/env node
// §73 tier two — the explainer's translation tooling.
//
// Two jobs, one DOM walk (so extraction and verification can never disagree
// about what "translatable" means):
//
//   --extract   print every translatable key found in explain.html, as a
//               JS object skeleton. The keys come from the REAL DOM, so a
//               translation file built from this output cannot contain a
//               transcription typo — the class of error that would
//               otherwise fall back to English silently.
//   --check     the gate. Verifies, per language:
//                 * 0 unmatched keys (every key in the table matches an
//                   element on the page — the `expectedContacts` "0 unmatched
//                   selectors" convention, applied to prose)
//                 * coverage (translated / translatable), reported per section
//                 * MARKUP preserved: the translation's tag sequence equals
//                   the English's, so a translation cannot silently drop a
//                   <code> or break a <b>
//                 * CONSTANTS preserved: <code> spans byte-identical, and
//                   every number in an SVG plate label surviving translation
//                   — the entry's "the convention is the number, not the
//                   word" made mechanical
//
// Usage: node tools/explain-i18n.mjs --extract [--lang de]
//        node tools/explain-i18n.mjs --check
// Needs python3 (dev_server.py) and a Playwright Chromium, like ci-battery.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODE = process.argv.includes('--check') ? 'check' : 'extract';
const LANG_ARG = (() => {
  const i = process.argv.indexOf('--lang');
  return i >= 0 ? process.argv[i + 1] : 'de';
})();

// "Translatable" is defined ONCE, in src/explain-i18n.js, and imported here —
// extraction, verification and rendering read the same collector, so they
// cannot drift apart. (The el handles don't survive the bridge, so only the
// serialisable fields come back.)
// (An IIFE, not a bare function literal: a STRING passed to page.evaluate is
// an expression to evaluate, so a bare `async () => {}` would hand back the
// function itself rather than its result.)
const WALK = `(async () => {
  const m = await import('./src/explain-i18n.js');
  return m.collectTranslatable().map(({ key, sect, kind }) => ({ key, sect, kind }));
})()`;

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});

const stateDir = mkdtempSync(join(tmpdir(), 'timesim-i18n-'));
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/explain.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

// The plates write text at RUNTIME too (chips, readouts, state lines), and
// those strings never sit in the served DOM — so a DOM walk alone would call
// their translations "unmatched keys" and their absence invisible. Every
// tr('…') literal in the page's own script joins the key set, direct and
// ternary forms alike. (Read from source: they are compile-time literals.)
const pageSrc = readFileSync(join(ROOT, 'explain.html'), 'utf8');
const dynamicKeys = (() => {
  const body = pageSrc.slice(pageSrc.indexOf('<script type="module">'));
  const out = new Set();
  const un = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  for (const m of body.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) out.add(un(m[1]));
  for (const m of body.matchAll(/\btr\([^()]*\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) {
    out.add(un(m[1])); out.add(un(m[2]));
  }
  return [...out];
})();

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
// ?lang=en so the walk always sees the ENGLISH source strings, whatever the
// table would otherwise substitute — the keys are English by definition.
await page.goto(`${base}/explain.html?lang=en`, { waitUntil: 'load', timeout: 120000 });
const domItems = await page.evaluate(WALK);
const items = [...domItems, ...dynamicKeys.map((key) => ({ key, sect: 'script', kind: 'dynamic' }))];

// The tables, imported straight from the module the page uses — one source.
const tables = await page.evaluate(`(async () => {
  const m = await import('./src/explain-i18n.js');
  return m.allTables();
})()`);

const esc = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

if (MODE === 'extract') {
  const bySect = new Map();
  for (const it of items) {
    if (!bySect.has(it.sect)) bySect.set(it.sect, []);
    bySect.get(it.sect).push(it);
  }
  for (const [sect, list] of bySect) {
    console.log(`\n  // ---- ${sect} (${list.length}) ----`);
    for (const it of list) {
      const have = tables?.[LANG_ARG]?.[it.key];
      console.log(`  [${esc(it.key)}]: ${have ? esc(have) : "''"},`);
    }
  }
  console.log(`\n// ${items.length} translatable keys total`);
} else {
  // ---- the gate ----
  const tagSeq = (html) => (html.match(/<[a-zA-Z][^>]*>/g) || [])
    .map((t) => {
      const name = t.match(/^<([a-zA-Z]+)/)[1].toLowerCase();
      const cls = t.match(/class="([^"]*)"/);
      return cls ? `${name}.${cls[1]}` : name;
    }).join(',');
  const codes = (html) => (html.match(/<code>(.*?)<\/code>/g) || []).map((c) => c.replace(/<\/?code>/g, ''));
  // An id inside a rich block is a HANDLE an interactive plate looks up by
  // name; dropping one in translation would break that plate silently, so
  // ids are as non-negotiable as the constants.
  const ids = (html) => (html.match(/id="([^"]*)"/g) || []).sort();
  const nums = (s) => (s.replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).sort();

  // A key with no letters anywhere — "0.10", "−0.024", "+12°" — is a constant
  // rendered as text. There is nothing in it to translate, and counting it as
  // "missing" would understate coverage while inviting a pointless identical
  // entry. Classified INVARIANT: excluded from the denominator, counted out
  // loud so the exclusion is visible rather than assumed.
  // <code> is stripped too: a key whose only letters live inside a code span
  // ("<code>ALARM_PIN_R</code>", a whole table cell) is a quoted identifier,
  // and this page's contract is that identifiers are never translated.
  const isInvariant = (k) => !/[a-zA-ZÀ-ɏ一-鿿]/.test(
    k.replace(/<code>.*?<\/code>/g, ' ').replace(/<[^>]+>/g, ' '));
  const keySet = new Set(items.map((i) => i.key));
  let failed = 0;
  const report = [];
  for (const lang of ['de', 'zh']) {
    const table = tables?.[lang] || {};
    const unmatched = Object.keys(table).filter((k) => !keySet.has(k));
    const live = items.filter((i) => !isInvariant(i.key));
    const invariant = items.length - live.length;
    const translated = live.filter((i) => table[i.key]);
    const missing = live.filter((i) => !table[i.key]);
    const markupBad = [], codeBad = [], numBad = [];
    for (const it of items) {
      const v = table[it.key];
      if (!v) continue;
      if (it.kind === 'rich') {
        if (tagSeq(it.key) !== tagSeq(v)) markupBad.push(it.key.slice(0, 70));
        if (ids(it.key).join('|') !== ids(v).join('|')) markupBad.push(`ID DROPPED: ${it.key.slice(0, 60)}`);
        const a = codes(it.key), b = codes(v);
        if (a.join('|') !== b.join('|')) codeBad.push(`${it.key.slice(0, 50)} :: [${a}] vs [${b}]`);
      }
      if (it.kind === 'svg' || it.kind === 'dynamic') {
        const a = nums(it.key), b = nums(v);
        if (a.join(',') !== b.join(',')) numBad.push(`${it.key} :: [${a}] vs [${b}]`);
      }
    }
    const pct = ((translated.length / live.length) * 100).toFixed(1);
    report.push({ lang, total: live.length, translated: translated.length, pct, unmatched, markupBad, codeBad, numBad, missing });
    const bad = unmatched.length + markupBad.length + codeBad.length + numBad.length;
    if (bad) failed++;
    console.log(`\n[${lang}] ${translated.length}/${live.length} translated (${pct}%) · ${invariant} invariant (numbers/symbols, nothing to translate)`);
    console.log(`  unmatched keys : ${unmatched.length}${unmatched.length ? '  <-- FAIL' : ''}`);
    for (const u of unmatched.slice(0, 10)) console.log(`      ${u.slice(0, 100)}`);
    console.log(`  markup drift   : ${markupBad.length}${markupBad.length ? '  <-- FAIL' : ''}`);
    for (const m of markupBad.slice(0, 10)) console.log(`      ${m}`);
    console.log(`  <code> drift   : ${codeBad.length}${codeBad.length ? '  <-- FAIL' : ''}`);
    for (const c of codeBad.slice(0, 10)) console.log(`      ${c}`);
    console.log(`  plate numbers  : ${numBad.length}${numBad.length ? '  <-- FAIL' : ''}`);
    for (const n of numBad.slice(0, 10)) console.log(`      ${n}`);
    if (missing.length && missing.length <= 40) {
      console.log(`  untranslated (falls back to English, visible):`);
      for (const m of missing) console.log(`      [${m.sect}] ${m.key.slice(0, 90)}`);
    }
  }
  // ---- FIT: a translated plate label must still fit its plate ----
  // German runs ~30% longer and SVG text does not wrap, so a label that fits
  // in English can overrun its viewBox or collide with the next label — the
  // §53 truncation problem, moved from a 240 px column into a drawing. English
  // is the BASELINE (some plates stack labels tightly by design); only what a
  // translation makes worse is a failure, which keeps this gate about the
  // translation rather than about pre-existing drawing choices.
  // Screen rects, not getBBox(): a panel drawn under its own transform
  // reports LOCAL coordinates, so four side-by-side panels would all look
  // superimposed. And every report is keyed by ELEMENT INDEX, never by text —
  // the text changes per language by definition, so a text-keyed baseline
  // would call every German label a new collision.
  const MEASURE = `(() => {
    const out = [];
    const svgs = [...document.querySelectorAll('figure svg')];
    svgs.forEach((svg, si) => {
      const sr = svg.getBoundingClientRect();
      const texts = [...svg.querySelectorAll('text')];
      const boxes = texts.map((el) => ({ t: el.textContent.trim(), r: el.getBoundingClientRect() }));
      boxes.forEach((a, i) => {
        if (a.r.width && (a.r.right > sr.right + 1 || a.r.left < sr.left - 1))
          out.push({ id: si + ':' + i, what: 'OVERFLOW: ' + a.t.slice(0, 60) });
        for (let j = i + 1; j < boxes.length; j++) {
          const b = boxes[j];
          if (!a.r.width || !b.r.width) continue;
          const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (ox > 2 && oy > 2) out.push({ id: si + ':' + i + '-' + j, what: 'COLLIDE: ' + a.t.slice(0, 34) + ' \u21c4 ' + b.t.slice(0, 34) });
        }
      });
    });
    return out;
  })()`;
  const fitOf = async (lang) => {
    const pg = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await pg.goto(`${base}/explain.html?lang=${lang}`, { waitUntil: 'load', timeout: 120000 });
    await pg.evaluate(() => { for (const d of document.querySelectorAll('details.mech')) d.setAttribute('open', ''); });
    const r = await pg.evaluate(MEASURE);
    await pg.close();
    return r;
  };
  const baseFit = new Set((await fitOf('en')).map((x) => x.id));
  for (const lang of ['de', 'zh']) {
    const bad = (await fitOf(lang)).filter((x) => !baseFit.has(x.id));
    console.log(`\n[${lang}] plate fit: ${bad.length} new overflow/collision vs English${bad.length ? '  <-- FAIL' : ''}`);
    for (const x of bad) console.log(`      ${x.what}`);
    if (bad.length) failed++;
  }

  if (errors.length) { console.log(`\nPAGE ERRORS: ${errors.join(' | ')}`); failed++; }
  console.log(failed ? '\nFAIL' : '\nPASS — 0 unmatched, 0 markup drift, 0 code drift, 0 number drift');
  await browser.close(); server.kill();
  process.exit(failed ? 1 : 0);
}
await browser.close();
server.kill();
