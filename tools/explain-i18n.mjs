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
// §116 — `group` is a LIST because French made it one. Chromium and Node emit
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
  'zh-Hant': { group: [','], dec: '.' }, // and so do zh-Hant …
  ja: { group: [','], dec: '.' },        // … and ja-JP: number-transparent, unlike fr
  // Escaped, not typed: three characters that render identically, so a typed
  // one could not be told from another by reading this file.
  fr: { group: ['\u202f', '\u00a0', '\u2009'], dec: ',' },
  // §208 — Arabic groups with ',' and points with '.' HERE because the chrome
  // formats through 'ar-u-nu-latn' (src/i18n.js LOCALES says why), and a
  // table must read as the chrome does. The row is also the digit gate:
  // the token class below is \d, so an Arabic-Indic ٠١٢ in a translation
  // is not a parsed number at all — the value comparison reports it as a
  // quantity DROPPED, which is what it would be to the checker.
  ar: { group: [','], dec: '.' },
  // §209 — German's marks, and a decision rather than a fact about "Spanish":
  // es-MX and es-419 point with '.' and group with ','. The chrome formats
  // through 'es-ES' (src/i18n.js LOCALES says why), and a table must read as
  // the chrome does, so the primer's quantities are written 0,024 / 18.000.
  // es-ES also leaves four digits ungrouped (1000, measured in Chromium 141);
  // the token class parses either form, so nothing here depends on it.
  es: { group: ['.'], dec: ',' },
  ko: { group: [','], dec: '.' },        // §211 — ko-KR: number-transparent, as ja and zh
  // §212 — hi-IN is number-transparent too, and measured: its DEFAULT numbering
  // system is Latin, not Devanagari ('30.0' · '0.024' · '18,000' · '36,000' in
  // Chromium 141), so this is English's row rather than a digit pin like ar's.
  // The grouping is INDIAN and diverges only at six digits ('1,00,000'); the
  // token class strips group marks before parsing, so that form reads as
  // 100000 if a six-digit quantity ever reaches a page. Devanagari digits
  // appear only under an explicit -u-nu-deva, which no row asks for; were one
  // to appear in a translation, \d would not parse it and the value check
  // would report the quantity DROPPED — the same gate §208 relies on.
  hi: { group: [','], dec: '.' },
  // §213 — Russian groups with U+00A0 (Chromium 141's own output for ru-RU),
  // French's list with the plain no-break space FIRST; the other two are
  // accepted for the same reason they are for French: a translator's keyboard
  // and older ICU produce them, and flanked by digits they are unambiguous.
  ru: { group: ['\u00a0', '\u202f', '\u2009'], dec: ',' },
  // §214 — German's marks, and a decision like Spanish's: pt-PT groups with
  // U+00A0 and leaves four digits bare, pt-BR points and groups them all.
  // The chrome formats through 'pt-BR' (src/i18n.js LOCALES says why), and a
  // table must read as the chrome does.
  pt: { group: ['.'], dec: ',' },
  it: { group: ['.'], dec: ',' },        // §210 — it-IT: German's marks
};

// ---- honesty vocabulary: modelled vs simulated (§241 area C) ----------------
// README's distinction is load-bearing prose, and CLAUDE.md says so in as many
// words: MODELLED claims a thing is described, SIMULATED claims its behaviour
// is DRIVEN. Most of TODO.md lives in the gap. A translation that renders one
// as the other does not read wrong — it reads fluent, and it erases the single
// distinction this project polices hardest. Nothing else here can see that:
// the key matches, the markup matches, the numbers match.
//
// THE ENGLISH MATCHER IS ITSELF A CLAIM, and the narrow form below is measured
// rather than chosen. Widening it to a bare \bmodel\b pulls in the page's own
// credit line — "Claude, Anthropic's AI model" — which all twelve locales
// render with their model-word, correctly and with nothing to do with honesty
// debt. That is the FOURTH false positive §241 has produced (after 멈춤, 크라운
// 휠 and the chain link's crowns) and the first one on the ENGLISH side of the
// question, so it is pinned here rather than left to the next reader.
const EN_MODELLED  = /\bmodell?(?:ed|s)\b/i;
const EN_SIMULATED = /\bsimulat/i;

// Arabic carries the damma of مُحاكى between م and ح, so a substring of the
// bare letters misses the word it is looking at. Diacritics and tatweel come
// off before matching; every other locale passes through untouched.
const AR_MARKS = /[ً-ْٰـ]/g;
const honestyText = (s, lang) => {
  const t = s.replace(/<code>.*?<\/code>/g, ' ').replace(/<[^>]+>/g, ' ');
  return lang === 'ar' ? t.replace(AR_MARKS, '') : t;
};

// STEMS, not words, because every locale here inflects: 모델링됨/모델링되어,
// modelliert/Modellierung, симулировано/симулируется. Each row is held to the
// page's OWN glossary below, so this table cannot quietly invent a vocabulary
// the page does not use. A locale with no row FAILS — MARKS' rule next door:
// a locale this tool cannot read is a locale whose prose is UNGATED, and that
// is the one outcome a gate must never reach quietly.
const HONESTY = {
  en:        { m: EN_MODELLED,     s: EN_SIMULATED },
  ar:        { m: /نمذ/,           s: /حاك/ },
  de:        { m: /modelli/i,      s: /simul/i },
  es:        { m: /modela/i,       s: /simula/i },
  fr:        { m: /modélis/i,      s: /simul/i },
  hi:        { m: /मॉडल/,           s: /सिमुले|सिम्युले/ },
  it:        { m: /modella/i,      s: /simula/i },
  ja:        { m: /モデル/,         s: /シミュレー/ },
  ko:        { m: /모델링/,         s: /시뮬레이/ },
  pt:        { m: /modela/i,       s: /simula/i },
  ru:        { m: /модел/i,        s: /симул/i },
  zh:        { m: /建模|模型化/,    s: /仿真|模拟/ },
  'zh-Hant': { m: /建模|模型化/,    s: /模擬|擬真/ },
};

// THE CONTROL, and it is the load-bearing part. Both pages carry the pair as a
// glossary entry of its own — the key `modelled / simulated` — so each locale
// has already DECLARED its two words on the page a reader sees. A row whose
// stems do not match that declaration is a vocabulary this tool invented, and
// the check below would then be measuring itself. The English gloss several
// locales append in brackets is stripped first: "simuliert (modelled /
// simulated)" would let an English stem satisfy a German row.
const GLOSS_KEY = 'modelled / simulated';
const glossControl = (lang, value) => {
  const bare = honestyText(value, lang).replace(/[(（][^)）]*simulated[^)）]*[)）]/gi, ' ');
  const row = HONESTY[lang];
  return { m: row.m.test(bare), s: row.s.test(bare), bare: bare.trim() };
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
// Which HONESTY rows a page's own glossary has verified, across every page in
// this run. The table is one declaration shared by both pages, and only
// explain.html carries the `modelled / simulated` entry — so the control runs
// THERE and covers the primer's use of the same row. Asserted at the end, and
// only on a whole-run check: --page primer alone cannot verify anything, and a
// gate that failed for being asked a narrower question would teach the wrong
// lesson.
const vocabVerified = new Set();
// Stem staleness is judged over the WHOLE RUN, not per page, and only where
// the locale actually had rows to judge. Per page it was a false-failure
// waiting: the primer's only term-bearing keys are two, so a locale that has
// not translated them yet would be called stale for a stem that is perfectly
// live on the explainer — and a locale wired in with an EMPTY table (the
// bootstrap order --extract documents above) would fail on both stems before
// anyone had written a word.
const stemTally = new Map();   // lang -> { m, s, nM, nS }
if (MODE === 'extract') {
  const { items, tables } = await readPage(TARGETS[0]);
  // §116 — the bootstrap state, stated rather than inferred. A locale with no
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
  // script: §116 checked whether Japanese kana needed adding here and the
  // answer is no — recorded because the question looks like it should be yes.
  const isInvariant = (k) => !/[a-zA-ZÀ-ɏ一-鿿]/.test(
    k.replace(/<code>.*?<\/code>/g, ' ').replace(/<[^>]+>/g, ' '));

  for (const target of TARGETS) {
    const { doc, items, tables, numbers, errors } = await readPage(target);
    console.log(`\n══ ${doc} — numbers: ${numbers === 'source' ? 'SOURCE form (identifiers quoted)' : 'QUANTITIES (localized, checked by value)'}`);
    const keySet = new Set(items.map((i) => i.key));
    // §116 — the roster is the PAGE's, read from its own allTables() keys.
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
          // The ASCII-space test comes FIRST, and that ordering is the whole
          // value of it. In a space-grouping locale an ASCII space is not a
          // near miss — it splits "18 000" into two quantities, so the value
          // comparison below is then GUARANTEED to fail and would report the
          // defect as [18000] vs [0,18]: arithmetic nonsense that reads like a
          // mistranslation. Tested first, it reads as the typing error it is.
          if (MARKS[lang].group.includes('\u202f') && /\d \d{3}(?!\d)/.test(v)) {
            numBad.push(`ASCII space used as a group separator (this locale wants U+202F): ${it.key.slice(0, 50)}`);
            continue;
          }
          const a = numValues(it.key, 'en'), b = numValues(v, lang);
          if (a.join(',') !== b.join(',')) numBad.push(`${it.key.slice(0, 60)} :: [${a}] vs [${b}]`);
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
      // ---- honesty vocabulary (§241 area C) ----
      // CROSSED gates; ABSENT reports. A crossed row is a lie: the English
      // says one word and the translation says only the other. A row with
      // NEITHER word is a weaker finding — a legitimate paraphrase looks the
      // same as a dropped sentence from here — so it is printed and left to a
      // reader, which is also how it earns its keep: every absent row measured
      // on arrival turned out to be a block the translator stopped short of,
      // except one Japanese idiom (造形された金属 for "modelled metal").
      let crossed = [], absent = [];
      if (!HONESTY[lang]) {
        console.log(`  honesty vocab : no HONESTY row — this locale's modelled/simulated prose is UNGATED  <-- FAIL`);
        failed++;
      } else {
        for (const it of items) {
          const v = table[it.key];
          if (!v) continue;
          const M = EN_MODELLED.test(it.key), S = EN_SIMULATED.test(it.key);
          if (!M && !S) continue;
          const body = honestyText(v, lang);
          const hm = HONESTY[lang].m.test(body), hs = HONESTY[lang].s.test(body);
          const tal = stemTally.get(lang) || { m: 0, s: 0, nM: 0, nS: 0 };
          if (M) tal.nM++;
          if (S) tal.nS++;
          if (hm) tal.m++;
          if (hs) tal.s++;
          stemTally.set(lang, tal);
          // CROSSED: the English asserts a word, the translation drops it, and
          // carries the OTHER one. Stated that way it covers all three English
          // shapes with one rule — and the third shape is why it is stated that
          // way. A first draft asked whether the word the English does NOT say
          // is present, which is unanswerable for the keys that say BOTH ("the
          // cam itself is MODELLED and not simulated"), so exactly the
          // sentences built on the contrast were the ones it could never fail.
          // Found by mutating a row and watching the gate report it instead.
          const lacks = (M && !hm) ? 'modelled' : (S && !hs) ? 'simulated' : null;
          if (!lacks) continue;
          const other = lacks === 'modelled' ? hs : hm;
          if (other) crossed.push(`says ${lacks}, reads only the other word: ${it.key.slice(0, 62)}`);
          else absent.push(`no ${lacks}-word: ${it.key.slice(0, 62)}`);
        }
        // The row is held to the page's own glossary, not to this file's taste.
        const gv = table[GLOSS_KEY];
        let ctl = `not verifiable here (this page declares no "${GLOSS_KEY}" entry) — see the run's control line`;
        if (gv) {
          const g = glossControl(lang, gv);
          ctl = (g.m && g.s) ? `PASS (${g.bare})` : `FAIL — the declared stems do not match the page's own "${GLOSS_KEY}": ${g.bare}`;
          if (g.m && g.s) vocabVerified.add(lang); else failed++;
        }
        // A stem that never fires anywhere is a stem for a word this locale
        // does not use — SLENDER_WAIVERS' rule, applied to a vocabulary table.
        console.log(`  honesty vocab : ${crossed.length} crossed${crossed.length ? '  <-- FAIL' : ''} · ${absent.length} absent (report) · control ${ctl}`);
        for (const c of crossed) console.log(`      CROSSED ${c}`);
        for (const a of absent) console.log(`      absent  ${a}`);
        if (crossed.length) failed++;
      }
      // ---- block coverage: a translation that stops early (§241, REPORT) ----
      // This is how the honesty tier's absent rows were diagnosed, so it stays
      // beside them. A translated block's LENGTH against its English key is
      // mostly a fact about the script — German runs ~1.16x, Korean ~0.57,
      // Chinese ~0.34 — so the ruler is the locale's OWN MEDIAN over long
      // blocks, and a row is only interesting well under it.
      //
      // ONE-SIDED, and that is measured rather than tidy. The high side is
      // explained: a quoted identifier survives translation intact, so in a
      // short CJK block it dominates and lifts the ratio past 1.5 with nothing
      // wrong. Only "much shorter than this locale normally runs" is evidence
      // that text was dropped.
      //
      // A REPORT, not a gate. It cannot tell a terse translation from a
      // truncated one — that judgement needs a reader — and a threshold tuned
      // until today's tree is green would be a number that looked right, which
      // rule 1 exists to refuse. What it is FOR is that nothing else can see
      // this at all: the key matches, the markup matches, the numbers match,
      // and the page renders a paragraph that stops at a colon.
      {
        const strip = (x) => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const rs = [];
        for (const it of items) {
          const v = table[it.key];
          if (!v) continue;
          const a = strip(it.key).length;
          if (a < 200) continue;              // long prose only; a label's ratio is noise
          rs.push({ q: strip(v).length / a, a, b: strip(v).length, k: it.key });
        }
        if (rs.length >= 8) {
          const med = [...rs].sort((x, y) => x.q - y.q)[Math.floor(rs.length / 2)].q;
          const short = rs.filter((r) => r.q / med < 0.75).sort((x, y) => x.q - y.q);
          console.log(`  block coverage: ${short.length} block(s) under 0.75x this locale's median length ratio (${med.toFixed(2)}) — REPORT`);
          for (const r of short) console.log(`      ${(r.q / med).toFixed(2)}x (${r.a}->${r.b} chars)  ${r.k.slice(0, 62)}`);
        }
      }
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
    for (const lang of Object.keys(tables || {})) {   // §116 — the page's roster, as above
      const bad = (await fitOf(lang)).filter((x) => !baseFit.has(x.id));
      console.log(`\n[${lang}] plate fit: ${bad.length} new overflow/collision vs English${bad.length ? '  <-- FAIL' : ''}`);
      for (const x of bad) console.log(`      ${x.what}`);
      if (bad.length) failed++;
    }
    if (errors.length) { console.log(`\nPAGE ERRORS (${doc}): ${errors.join(' | ')}`); failed++; }
  }
  // The table is only as good as its control, so the run says how much of it
  // was verified rather than leaving that to be assumed.
  const rows = Object.keys(HONESTY).filter((l) => l !== 'en');
  const unver = rows.filter((l) => !vocabVerified.has(l));
  const whole = !PAGE_ARG;
  console.log(`\n══ honesty vocabulary: ${rows.length - unver.length}/${rows.length} HONESTY rows verified against a page's own "${GLOSS_KEY}" glossary`);
  if (unver.length) {
    console.log(`   unverified: ${unver.join(', ')}${whole ? '  <-- FAIL' : '  (single-page run — not a failure)'}`);
    if (whole) failed++;
  }
  // A stem that never fired over rows it HAD to judge is a stem for a word the
  // locale does not use — SLENDER_WAIVERS' rule, applied to a vocabulary table.
  const stale = [];
  for (const [lang, t] of stemTally) {
    if (t.nM && !t.m) stale.push(`${lang}: model-stem never matched over ${t.nM} row(s)`);
    if (t.nS && !t.s) stale.push(`${lang}: simulate-stem never matched over ${t.nS} row(s)`);
  }
  console.log(`   stale stems: ${stale.length}${stale.length ? '  <-- FAIL' : ''}`);
  for (const x of stale) console.log(`      ${x}`);
  if (stale.length) failed++;
  console.log(failed ? '\nFAIL' : '\nPASS — 0 unmatched, 0 markup drift, 0 code drift, 0 number drift, 0 crossed honesty terms');
}
await browser.close();
server.kill();
process.exit(failed ? 1 : 0);
