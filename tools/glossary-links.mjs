#!/usr/bin/env node
// §236 tier one — THE GLOSSARY LINKER'S GATE. explain.html defines 28 project
// words and, since §236, links their first use in each entry to the definition.
// Nothing about that is authored: the links are injected at runtime by
// src/glossary-links.js, after src/explain-i18n.js has swapped the page into
// the reader's language. Two properties have to hold, and neither is visible
// by reading the diff.
//
//   1. THE INJECTION ADDS NO WORDS. A linker that wrapped the wrong span, ate a
//      character, or reordered a sentence would look exactly like one that
//      worked. The gate measures it: the page's text with the linker stubbed
//      out must equal the page's text with the links unwrapped, in EVERY
//      locale.
//   2. THE INJECTION RUNS SECOND. src/page-i18n.js keys each rich block by its
//      authored markup, so a link injected BEFORE the swap would change the key
//      and drop that block to English. Property 1 catches that too, in any
//      locale where the block is translated — which is why the comparison is
//      per-locale rather than English-only.
//
// The tables the linker refuses on are checked for STALENESS on the
// `SLENDER_WAIVERS` convention: a row naming a word the glossary no longer
// defines, or a section where the word never appears, buys silence for nothing
// and FAILS. A stale exclusion silently re-links a false positive, which is
// the whole failure this file exists to prevent.
//
// The structural rule is gated and the taste is REPORTED. One link per term
// per entry is what src/glossary-links.js implements, so it is asserted; how
// dense the busiest paragraph reads is a judgement and is printed.
//
// Usage: node tools/glossary-links.mjs [--lang de]   (all locales by default)
// Needs python3 (dev_server.py) and a Playwright Chromium, like explain-i18n.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };

// The tables the linker refuses on, imported from the module the page itself
// runs — one source, so this cannot gate a policy the page does not have. It
// imports cleanly under node because every DOM reference is inside a function
// body; the locale roster is not, and is read from the browser below.
const { AMBIGUOUS, SENSE_CLASH, termId } = await import(join(ROOT, 'src/glossary-links.js'));

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-gloss-'));
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

const browser = await chromium.launch();
let failed = 0;
const fail = (msg) => { console.log(`  ${msg}  <-- FAIL`); failed++; };

// A stub with the module's exported SHAPE and none of its behaviour. This is
// the reference half of property 1, and the control on it is that the
// reference page must carry ZERO links: if the route never took, the
// "reference" would be the live page and every text comparison would pass by
// comparing something with itself.
const STUB = `export const AMBIGUOUS = {}; export const SENSE_CLASH = {};
export const termId = (s) => s; export function readGlossary() { return []; }
export function linkGlossary() { return { linked: 0, terms: 0 }; }
export function wireGlossaryTargets() {}`;
// The NEGATIVE control: a linker that eats one character. The comparator must
// see it. A gate nobody has watched fail is a comment.
const LOSSY = `export const AMBIGUOUS = {}; export const SENSE_CLASH = {};
export const termId = (s) => s; export function readGlossary() { return []; }
export function linkGlossary(doc) {
  const p = doc.querySelector('.mech-body p');
  if (p) p.textContent = p.textContent.slice(1);
  return { linked: 0, terms: 0 };
}
export function wireGlossaryTargets() {}`;

const open = async (lang, stub) => {
  const pg = await browser.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (stub) {
    await pg.route('**/src/glossary-links.js*', (r) =>
      r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: stub }));
  }
  await pg.goto(`${base}/explain.html?lang=${lang}`, { waitUntil: 'load', timeout: 120000 });
  // Every entry open: a closed <details> still has its text in the DOM, but
  // opening them keeps this measuring what a reader can reach.
  await pg.evaluate(() => { for (const d of document.querySelectorAll('details.mech')) d.setAttribute('open', ''); });
  return { pg, errors };
};

// The page's text with any glossary links UNWRAPPED — the quantity that must
// not move. Taken from a clone so the live page is left alone for the
// structural pass that follows.
const TEXT_OF = `(() => {
  const c = document.body.cloneNode(true);
  for (const a of c.querySelectorAll('a.gloss')) a.replaceWith(...a.childNodes);
  return (c.textContent || '').replace(/\\s+/g, ' ').trim();
})()`;

// §116's rule — the roster is the PAGE's own, read from its i18n module's
// allTables() keys inside the browser (the module reaches for `location` at
// import time, so node cannot load it). Adding a locale must not need an edit
// here.
const LANGS = await (async () => {
  const one = argOf('--lang', null);
  if (one) return [one];
  const { pg } = await open('en', null);
  const langs = await pg.evaluate(`(async () => Object.keys(await (await import('./src/explain-i18n.js')).allTables()))()`);
  await pg.close();
  return ['en', ...langs];
})();

// ---- structure, read from the live English page ----------------------------
console.log('== structure ==');
{
  const { pg, errors } = await open('en', null);
  const s = await pg.evaluate(`(() => {
    const cells = [...document.querySelectorAll('#vocabulary tbody td:first-child')]
      .map((c) => ({ id: c.id, term: c.dataset.term, shown: (c.textContent || '').trim() }));
    const links = [...document.querySelectorAll('a.gloss')].map((a) => ({
      href: a.getAttribute('href'),
      resolves: !!(a.getAttribute('href') || '').startsWith('#') &&
                !!document.getElementById(a.getAttribute('href').slice(1)) &&
                document.getElementById('vocabulary').contains(document.getElementById(a.getAttribute('href').slice(1))),
      nested: !!a.parentElement.closest('a.gloss'),
      forbidden: !!a.closest('code, #vocabulary, .gloss-variants'),
      sect: a.closest('details.mech')?.id || 'page',
      text: a.textContent,
      host: (a.closest('p, td, th, figcaption') || a.parentElement).textContent.slice(0, 40),
    }));
    const dense = {};
    for (const el of document.querySelectorAll('p, td, th, figcaption')) {
      const n = el.querySelectorAll('a.gloss').length;
      if (n) dense[(el.textContent || '').replace(/\\s+/g, ' ').slice(0, 48)] = n;
    }
    return {
      cells,
      links,
      dense,
      variants: [...document.querySelectorAll('.gloss-variants')].map((e) => ({ term: e.dataset.term, forms: (e.textContent || '').trim() })),
      sections: [...document.querySelectorAll('details.mech')].map((d) => d.id),
      sectText: Object.fromEntries([...document.querySelectorAll('details.mech')]
        .map((d) => [d.id, (d.textContent || '').replace(/\\s+/g, ' ').toLowerCase()])),
    };
  })()`);
  await pg.close();
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);

  // The census itself must not be empty — a selector that matched nothing
  // would report every table below as clean.
  if (s.cells.length < 20) fail(`only ${s.cells.length} glossary cells found — the selector has drifted`);
  else console.log(`  ${s.cells.length} glossary cells, ${s.variants.length} variant rows, ${s.links.length} links in ${new Set(s.links.map((l) => l.sect)).size} entries`);

  const ids = new Set();
  for (const c of s.cells) {
    if (!c.term) fail(`glossary cell '${c.shown}' has no data-term — the linker cannot key it`);
    else if (c.id !== termId(c.term)) fail(`id '${c.id}' is not termId('${c.term}') = '${termId(c.term)}'`);
    if (ids.has(c.id)) fail(`duplicate glossary id '${c.id}' — a link would resolve to whichever came first`);
    ids.add(c.id);
  }
  // Halves, because four cells define two words at once ('floor / budget').
  const halves = new Set(s.cells.flatMap((c) => (c.term || '').split('/').map((x) => x.trim())).filter(Boolean));
  const terms = new Set(s.cells.map((c) => c.term));

  for (const w of Object.keys(AMBIGUOUS)) {
    if (!halves.has(w)) fail(`AMBIGUOUS names '${w}', which the glossary no longer defines — a stale exclusion re-links a false positive silently`);
  }
  for (const v of s.variants) {
    if (!terms.has(v.term)) fail(`.gloss-variants names data-term '${v.term}', which is not a glossary row`);
    if (!v.forms) fail(`.gloss-variants for '${v.term}' is empty`);
  }
  for (const [sect, words] of Object.entries(SENSE_CLASH)) {
    if (!s.sections.includes(sect)) fail(`SENSE_CLASH names entry '${sect}', which is not on the page`);
    for (const w of Object.keys(words)) {
      if (!halves.has(w)) fail(`SENSE_CLASH['${sect}'] names '${w}', which the glossary no longer defines`);
      else if (AMBIGUOUS[w]) fail(`SENSE_CLASH['${sect}'] names '${w}', which AMBIGUOUS already refuses everywhere — one of the two rows is dead`);
      // The SLENDER_WAIVERS rule: a row naming a site with no problem is
      // itself a failure. The residue this cannot see is the word appearing
      // there in the glossary's OWN sense after all, which nothing measures.
      else if (!(s.sectText[sect] || '').includes(w.toLowerCase())) {
        fail(`SENSE_CLASH['${sect}'] refuses '${w}', which never appears in that entry — the row buys silence for nothing`);
      }
    }
  }

  for (const l of s.links) {
    if (!l.resolves) fail(`link '${l.text}' → ${l.href} does not resolve to a glossary row`);
    if (l.nested) fail(`link '${l.text}' is nested inside another glossary link`);
    if (l.forbidden) fail(`link '${l.text}' landed inside code/#vocabulary/.gloss-variants (${l.host}…)`);
  }

  // THE STRUCTURAL RULE, gated: at most one link per term per entry. This is
  // what src/glossary-links.js implements; per-BLOCK linking would put four
  // links in one paragraph and still resolve every href, so nothing above
  // would catch the regression.
  const perSect = new Map();
  for (const l of s.links) {
    const k = l.sect + '\u0000' + l.href;
    perSect.set(k, (perSect.get(k) || 0) + 1);
  }
  const twice = [...perSect].filter(([, n]) => n > 1);
  if (twice.length) for (const [k, n] of twice) fail(`${n} links to ${k.split('\u0000')[1]} in entry '${k.split('\u0000')[0]}' — first-per-entry has regressed`);
  else console.log('  one link per term per entry: holds');

  // …and the taste, REPORTED. Legibility is a judgement, so it is printed
  // rather than given a number to fail against.
  const top = Object.entries(s.dense).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`  densest blocks (report): ${top.map(([t, n]) => `${n}× "${t.slice(0, 34)}…"`).join(', ')}`);
}

// ---- property 1 and 2, per locale ------------------------------------------
console.log('\n== the injection adds no words, in every locale ==');
{
  // Negative control FIRST: if the comparator cannot see a linker that eats a
  // character, nothing it says below means anything.
  const ref = await open('en', STUB);
  const refText = await ref.pg.evaluate(TEXT_OF);
  await ref.pg.close();
  const bad = await open('en', LOSSY);
  const badText = await bad.pg.evaluate(TEXT_OF);
  await bad.pg.close();
  if (badText === refText) fail('CONTROL: a linker that deletes a character was not detected — the comparison is measuring nothing');
  else console.log('  control: a one-character loss is detected');

  for (const lang of LANGS) {
    const r = await open(lang, STUB);
    const refT = await r.pg.evaluate(TEXT_OF);
    const refLinks = await r.pg.evaluate(() => document.querySelectorAll('a.gloss').length);
    await r.pg.close();
    const l = await open(lang, null);
    const liveT = await l.pg.evaluate(TEXT_OF);
    const liveLinks = await l.pg.evaluate(() => document.querySelectorAll('a.gloss').length);
    await l.pg.close();

    // Control: the stub must have taken. Without this the reference is the
    // live page and the equality below is a tautology.
    if (refLinks !== 0) { fail(`[${lang}] the stubbed reference still carries ${refLinks} links — the route did not take`); continue; }
    if (l.errors.length) fail(`[${lang}] page errors: ${l.errors.join(' | ')}`);

    // REPORTED, and worth reading whenever a locale's forms change: the
    // distinct strings the matcher actually wrapped. For the suffix-inflected
    // scripts the forms are STEMS, so this is the only place a stem that
    // reaches into an unrelated word shows itself.
    const words = await (async () => {
      const p = await open(lang, null);
      const w = await p.pg.evaluate(() => [...new Set([...document.querySelectorAll('a.gloss')].map((a) => a.textContent))].sort());
      await p.pg.close();
      return w;
    })();

    if (refT !== liveT) {
      let i = 0;
      while (i < refT.length && refT[i] === liveT[i]) i++;
      fail(`[${lang}] injection MOVED the page's text at char ${i}: ` +
           `…${refT.slice(Math.max(0, i - 50), i + 30)}… vs …${liveT.slice(Math.max(0, i - 50), i + 30)}…`);
    } else {
      console.log(`  [${lang}] text identical · ${liveLinks} link(s) · matched: ${words.join(' ')}`);
    }
  }
}

// English is the source language: zero links there would mean the whole
// feature is inert and every text comparison above passed by doing nothing.
// The other locales are allowed to link less — a term whose inflected forms
// nobody has translated yet simply loses links, which is the safe direction.
console.log('\n== the feature is not inert ==');
{
  const { pg } = await open('en', null);
  const n = await pg.evaluate(() => document.querySelectorAll('a.gloss').length);
  await pg.close();
  if (n < 20) fail(`only ${n} links in English — the matcher has stopped matching`);
  else console.log(`  ${n} links in English`);
}

await browser.close();
server.kill();
console.log(failed ? `\nFAIL — ${failed} problem(s)` : '\nPASS — links resolve, tables are live, and the injection adds no words in any locale');
process.exit(failed ? 1 : 0);
