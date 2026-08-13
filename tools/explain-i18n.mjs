#!/usr/bin/env node
// §73 tier two — the STATIC PAGES' translation tooling.
//
// Two jobs, one DOM walk (so extraction and verification can never disagree
// about what "translatable" means):
//
//   --extract   print every translatable key found in the page, as a
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
// §95 — IT TAKES A PAGE. explain.html was hardcoded in four places until the
// primer earned its translation; both pages now run through --page, and
// --check does BOTH by default, because a gate that only looks at the page
// you remembered to name is not a gate.
//
// The two pages disagree about numbers ON PURPOSE, and the disagreement is
// declared by the page's own i18n module (its NUMBERS export), never assumed
// here:
//
//   'source'    explain.html — its numbers are IDENTIFIERS being quoted, so a
//               translation must reproduce them byte for byte. 0.15 stays
//               0.15 in German, because that is what src/*.js reads.
//   'quantity'  primer.html — it quotes no identifiers, so its numbers are
//               quantities being READ ALOUD and tier one's fmtNum rule
//               applies: German is owed 0,024 and 18.000. The check is
//               therefore on VALUE after locale parsing — 0,024 passes,
//               0,25 fails.
//
// Usage: node tools/explain-i18n.mjs --extract [--lang de] [--page primer]
//        node tools/explain-i18n.mjs --check [--page explain|primer]
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
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const LANG_ARG = argOf('--lang', 'de');

// The pages that carry tier-two prose. A page is its document plus the module
// that names its tables — nothing else here knows either string, which is what
// makes adding a third page an entry in this object rather than a grep.
const PAGES = {
  explain: { doc: 'explain.html', mod: 'explain-i18n.js' },
  primer: { doc: 'primer.html', mod: 'primer-i18n.js' },
};
const PAGE_ARG = argOf('--page', null);
if (PAGE_ARG && !PAGES[PAGE_ARG]) {
  console.error(`explain-i18n: unknown --page ${JSON.stringify(PAGE_ARG)} — expected one of ${Object.keys(PAGES).join(', ')}`);
  process.exit(1);
}
// --check with no --page checks EVERY page: a gate that only looks at the page
// you remembered to name is not a gate. --extract wants exactly one, since its
// output is a file someone is about to paste into.
const TARGETS = PAGE_ARG ? [PAGE_ARG] : (MODE === 'check' ? Object.keys(PAGES) : ['explain']);

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
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

const browser = await chromium.launch();
const esc = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// ---- one page's key set -----------------------------------------------------
// "Translatable" is defined ONCE, in src/page-i18n.js, and imported here —
// extraction, verification and rendering read the same collector, so they
// cannot drift apart. (The el handles don't survive the bridge, so only the
// serialisable fields come back.)
// (An IIFE, not a bare function literal: a STRING passed to page.evaluate is
// an expression to evaluate, so a bare `async () => {}` would hand back the
// function itself rather than its result.)
const readPage = async (name) => {
  const { doc, mod } = PAGES[name];
  // The plates write text at RUNTIME too (chips, readouts, state lines), and
  // those strings never sit in the served DOM — so a DOM walk alone would call
  // their translations "unmatched keys" and their absence invisible. Every
  // tr('…') literal in the page's own script joins the key set, direct and
  // ternary forms alike. (Read from source: they are compile-time literals.)
  const pageSrc = readFileSync(join(ROOT, doc), 'utf8');
  const dynamicKeys = (() => {
    const at = pageSrc.indexOf('<script type="module">');
    if (at < 0) return [];      // a page with no scripted prose (the primer)
    const body = pageSrc.slice(at);
    const out = new Set();
    const un = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    for (const m of body.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) out.add(un(m[1]));
    for (const m of body.matchAll(/\btr\([^()]*\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) {
      out.add(un(m[1])); out.add(un(m[2]));
    }
    return [...out];
  })();

  const pg = await browser.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // ?lang=en so the walk always sees the ENGLISH source strings, whatever the
  // table would otherwise substitute — the keys are English by definition.
  await pg.goto(`${base}/${doc}?lang=en`, { waitUntil: 'load', timeout: 120000 });
  const domItems = await pg.evaluate(`(async () => {
    const m = await import('./src/${mod}');
    return m.collectTranslatable().map(({ key, sect, kind }) => ({ key, sect, kind }));
  })()`);
  // The tables and the number rule, imported straight from the module the page
  // itself uses — one source, so the check cannot enforce a policy the page
  // does not have.
  const { tables, numbers } = await pg.evaluate(`(async () => {
    const m = await import('./src/${mod}');
    return { tables: await m.allTables(), numbers: m.NUMBERS };
  })()`);
  await pg.close();
  const items = [...domItems, ...dynamicKeys.map((key) => ({ key, sect: 'script', kind: 'dynamic' }))];
  return { name, doc, items, tables, numbers, errors };
};

// ---- number rules -----------------------------------------------------------
// Glyphs, for a page whose numbers are identifiers being quoted.
const numGlyphs = (s) => (s.replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).sort();
// Values, for a page whose numbers are quantities being read aloud. Each
// locale's own grouping and decimal marks are parsed away, so a translation is
// free to write 18.000 and 0,024 — and still cannot move a decimal point.
// MARKS is NOT the locale roster — that comes from the page module's own
// allTables() keys, so it cannot drift. This is a per-locale FACT the roster
// cannot carry: which characters that locale groups and points with. A missing
// row is therefore a hard failure below, never a silent skip; a locale whose
// numbers this tool cannot parse is a locale whose numbers are ungated.
//
// §113 — `group` is a LIST because French made it one. Chromium and Node emit
// U+202F NARROW NO-BREAK SPACE for fr-FR, older ICU emitted U+00A0, fr-CA still
// does, and a translator's keyboard may produce U+2009 THIN SPACE. All three
// are accepted: flanked by digits they are unambiguous. A PLAIN ASCII SPACE IS
// DELIBERATELY NOT ACCEPTED — "5 100" in prose is two quantities far more often
// than one, and merging them would be the checker inventing a number rather
// than reading one.
const MARKS = {
  en: { group: [','], dec: '.' },
  de: { group: ['.'], dec: ',' },
  zh: { group: [','], dec: '.' },        // zh-CN groups with ',' and points with '.', as en does
  // Escaped, not typed: three characters that render identically, so a typed
  // one could not be told from another by reading this file.
  fr: { group: ['\u202f', '\u00a0', '\u2009'], dec: ',' },
};
const reEsc = (c) => c.replace(/[\\\]^-]/g, '\\$&');
const numValues = (s, lang) => {
  const marks = MARKS[lang];
  // The token class is BUILT from this locale's own marks, so widening French
  // cannot widen anybody else: for en/de/zh it reproduces the previous
  // /\d+(?:[.,]\d+)*/ exactly, which is why their reports do not move.
  const re = new RegExp(`\\d+(?:[${[...marks.group, marks.dec].map(reEsc).join('')}]\\d+)*`, 'g');
  const out = [];
  for (const m of s.replace(/<[^>]+>/g, ' ').matchAll(re)) {
    let tok = m[0];
    for (const g of marks.group) tok = tok.split(g).join('');
    const v = parseFloat(tok.split(marks.dec).join('.'));
    if (Number.isFinite(v)) out.push(v);
  }
  return out.sort((a, b) => a - b);
};

// ---- extract ----------------------------------------------------------------
let failed = 0;
if (MODE === 'extract') {
  const { items, tables } = await readPage(TARGETS[0]);
  // §113 — the bootstrap state, stated rather than inferred. A locale with no
  // table yet extracts fine (every value blank), and that is the ONLY order
  // that works: listing the locale in the page module's LOADERS makes
  // allTables() import a file that does not exist yet, which takes down
  // --extract along with --check. Extract first, create the file, then wire it.
  if (!tables?.[LANG_ARG]) console.log(`// no '${LANG_ARG}' table in this tree yet — every value blank (bootstrap)`);
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
  // ---- the gate ------------------------------------------------------------
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

  // A key with no letters anywhere — "0.10", "−0.024", "+12°" — is a constant
  // rendered as text. There is nothing in it to translate, and counting it as
  // "missing" would understate coverage while inviting a pointless identical
  // entry. Classified INVARIANT: excluded from the denominator, counted out
  // loud so the exclusion is visible rather than assumed.
  // <code> is stripped too: a key whose only letters live inside a code span
  // ("<code>ALARM_PIN_R</code>", a whole table cell) is a quoted identifier,
  // and this page's contract is that identifiers are never translated.
  // The class is applied to KEYS, which readPage guarantees are English (it
  // walks the page at ?lang=en). So it never has to recognize a translation's
  // script: §113 checked whether Japanese kana needed adding here and the
  // answer is no — recorded because the question looks like it should be yes.
  const isInvariant = (k) => !/[a-zA-ZÀ-ɏ一-鿿]/.test(
    k.replace(/<code>.*?<\/code>/g, ' ').replace(/<[^>]+>/g, ' '));

  for (const target of TARGETS) {
    const { doc, items, tables, numbers, errors } = await readPage(target);
    console.log(`\n══ ${doc} — numbers: ${numbers === 'source' ? 'SOURCE form (identifiers quoted)' : 'QUANTITIES (localized, checked by value)'}`);
    const keySet = new Set(items.map((i) => i.key));
    // §113 — the roster is the PAGE's, read from its own allTables() keys.
    // Adding a locale is one entry in that module's LOADERS map; this tool
    // needs no edit and cannot fall behind it.
    for (const lang of Object.keys(tables || {})) {
      const table = tables?.[lang] || {};
      if (numbers === 'quantity' && !MARKS[lang]) {
        // Not a skip. A locale whose grouping and decimal marks this tool does
        // not know is a locale whose numbers it cannot parse — and an unparsed
        // number is an UNGATED number, which is the one outcome a gate must
        // never reach quietly.
        console.log(`\n[${lang}] no MARKS row — this tool cannot parse the locale's numbers  <-- FAIL`);
        failed++;
        continue;
      }
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
        // On a SOURCE page only plate labels and runtime strings are checked
        // (prose quotes its constants inside <code>, already held above). On a
        // QUANTITY page every block is checked, because there is no <code> to
        // hold anything and the prose is where the quantities live.
        const numbered = numbers === 'source'
          ? (it.kind === 'svg' || it.kind === 'dynamic')
          : true;
        if (!numbered) continue;
        if (numbers === 'source') {
          const a = numGlyphs(it.key), b = numGlyphs(v);
          if (a.join(',') !== b.join(',')) numBad.push(`${it.key} :: [${a}] vs [${b}]`);
        } else {
          const a = numValues(it.key, 'en'), b = numValues(v, lang);
          if (a.join(',') !== b.join(',')) numBad.push(`${it.key.slice(0, 60)} :: [${a}] vs [${b}]`);
          // The likeliest way to fail the line above in a space-grouping
          // locale, named outright: an ASCII space where the locale's own
          // separator belongs. Without this the symptom is "18 000" reading as
          // two quantities, which looks like a translation error and is not.
          else if (MARKS[lang].group.includes(' ') && /\d \d{3}(?!\d)/.test(v))
            numBad.push(`ASCII space used as a group separator — this locale wants U+202F: ${it.key.slice(0, 50)}`);
        }
      }
      const pct = live.length ? ((translated.length / live.length) * 100).toFixed(1) : '100.0';
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
    // §53 truncation problem, moved from a 240 px column into a drawing.
    // English is the BASELINE (some plates stack labels tightly by design);
    // only what a translation makes worse is a failure, which keeps this gate
    // about the translation rather than about pre-existing drawing choices.
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
            if (ox > 2 && oy > 2) out.push({ id: si + ':' + i + '-' + j, what: 'COLLIDE: ' + a.t.slice(0, 34) + ' ⇄ ' + b.t.slice(0, 34) });
          }
        });
      });
      return out;
    })()`;
    const fitOf = async (lang) => {
      const pg = await browser.newPage({ viewport: { width: 1100, height: 900 } });
      await pg.goto(`${base}/${doc}?lang=${lang}`, { waitUntil: 'load', timeout: 120000 });
      await pg.evaluate(() => { for (const d of document.querySelectorAll('details.mech')) d.setAttribute('open', ''); });
      const r = await pg.evaluate(MEASURE);
      await pg.close();
      return r;
    };
    const baseFit = new Set((await fitOf('en')).map((x) => x.id));
    for (const lang of Object.keys(tables || {})) {   // §113 — the page's roster, as above
      const bad = (await fitOf(lang)).filter((x) => !baseFit.has(x.id));
      console.log(`\n[${lang}] plate fit: ${bad.length} new overflow/collision vs English${bad.length ? '  <-- FAIL' : ''}`);
      for (const x of bad) console.log(`      ${x.what}`);
      if (bad.length) failed++;
    }
    if (errors.length) { console.log(`\nPAGE ERRORS (${doc}): ${errors.join(' | ')}`); failed++; }
  }
  console.log(failed ? '\nFAIL' : '\nPASS — 0 unmatched, 0 markup drift, 0 code drift, 0 number drift');
}
await browser.close();
server.kill();
process.exit(failed ? 1 : 0);
