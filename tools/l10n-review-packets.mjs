#!/usr/bin/env node
// §249's review follow-up — BUILDS THE NATIVE-REVIEW PACKETS: one page a fluent reader opens to
// judge a locale's translation row by row, English beside the translation, and to say "reads
// well", "needs a change" (with their wording) or "not sure". Every locale carries the same IOU
// in docs/BUILT.md ("No native review pass"), and no gate here can pay it: the page gate holds
// keys, markup, numbers and the honesty vocabulary, never whether a sentence reads naturally or
// a part has the name a workshop uses. This makes paying it cheap for whoever can.
//
// A packet per locale, five sections, every row read from the shipped tables (no copy of any
// translation lives here):
//   start    — that locale's recorded questions (tools/l10n-review/questions.mjs), then the
//              core part names every other section leans on;
//   vocab    — the explainer's Vocabulary table, term and definition;
//   parts    — the remaining 3D labels (registerLabel names in src/main.js);
//   honesty  — every explainer and primer block whose English says modelled or simulated;
//   primer   — the primer in reading order.
// Each row carries a stable id (hash of its section and English) and a hash of the translation
// it showed, so a verdict that comes back can be matched to its row and recognised as stale if
// the table moved since.
//
// It is an ACCEPTANCE test as well as a builder, and the checks are the reason it lives here
// rather than in a scratch folder. It FAILS when a LOCALES row has no QUESTIONS entry (an
// empty list is a declaration; a missing one is a locale nobody decided about — MARKS' rule in
// explain-i18n.mjs), when a question's term no longer occurs in that locale's strings, or when
// a part label or glossary row has no translation. The roster is LOCALES in src/i18n.js, read
// at run time, so a new locale cannot be left out by this file falling behind.
//
// src/i18n.js is a browser module (it reads location, navigator and document at import), so
// those globals are stubbed before it is imported; nothing it computes from them is used here.
//
//   node tools/l10n-review-packets.mjs                 # check only
//   node tools/l10n-review-packets.mjs --out DIR       # check, then write DIR/review.html + DIR/data/*.json
//   node tools/l10n-review-packets.mjs --out DIR --standalone [--send-to URL]
//                                                      # ...DIR/index.html, a complete document
//
// DIR is the review page's whole file set: publish review.html with data/ beside it (the page
// fetches data/index.json, then data/<code>.json). The page saves verdicts to the host's shared
// store when it can, and always keeps a copy in the reviewer's browser with a "Copy my review"
// export for reviewers who cannot write there.
//
// page.html is an artifact page — the artifact host wraps it in its document skeleton — so on any
// other host it would render in quirks mode with no charset. --standalone writes it as
// DIR/index.html with that skeleton supplied (doctype, charset, viewport) and noindex: a review
// sheet is a working document, test-geometry.html's case in tools/build-pages.mjs, not a page to
// be found by search. A static host has no shared store, so --send-to names where a copied review
// goes: a GitHub new-issue URL, which the page opens with the locale in the title. pages.yml
// builds /review/ this way from main's tables on every deploy.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE, QUESTIONS } from './l10n-review/questions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const OUT = argOf('--out');
const STANDALONE = process.argv.includes('--standalone');
const SEND_TO = argOf('--send-to');
if (SEND_TO && !STANDALONE) { console.error('--send-to needs --standalone: the artifact build hands reviews to its shared store'); process.exit(1); }
if (SEND_TO && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/new$/.test(SEND_TO)) {
  console.error(`--send-to must be a GitHub new-issue URL (https://github.com/OWNER/REPO/issues/new) — the page appends ?title=&body= to it; got ${JSON.stringify(SEND_TO)}`);
  process.exit(1);
}

const el = { setAttribute() {}, getAttribute() { return null; }, style: {}, classList: { add() {}, remove() {}, toggle() {} } };
globalThis.location = { search: '', href: 'http://localhost/', hash: '', pathname: '/' };
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'], language: 'en' }, configurable: true });
globalThis.document = { documentElement: el, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, createElement() { return el; }, body: el };
globalThis.window = globalThis;
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.addEventListener = () => {};
const { TABLES, LOCALES } = await import(join(ROOT, 'src/i18n.js'));

const entries = async (p) => {
  const m = await import(join(ROOT, p));
  const t = m.default;
  return t instanceof Map ? [...t] : Array.isArray(t) ? t : Object.entries(t);
};
const h = (s, n = 10) => createHash('sha1').update(s).digest('hex').slice(0, n);
const norm = (s) => s.replace(/\s+/g, ' ').trim();
// explain.html's source spells some characters as entities; the tables are keyed by the DOM's
// innerHTML, where they are literal. &amp; &lt; &gt; &nbsp; survive serialization and stay.
const NAMED = { mdash: '—', ndash: '–', middot: '·', sect: '§', pi: 'π', epsilon: 'ε', deg: '°', gamma: 'γ', Gamma: 'Γ', minus: '−', ldquo: '“', rdquo: '”', times: '×', plusmn: '±', alpha: 'α', radic: '√', phi: 'φ', rho: 'ρ', asymp: '≈', equiv: '≡' };
const decode = (s) => s.replace(/&([a-zA-Z]+|#\d+);/g, (m, e) => (e[0] === '#' ? String.fromCodePoint(+e.slice(1)) : NAMED[e] ?? m));
// Only inline emphasis reaches the page; every other tag is dropped and its text kept.
const ALLOW = new Set(['b', 'strong', 'i', 'em', 'code', 'sup', 'sub', 'br']);
const clean = (s) => s.replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (m, t) => (ALLOW.has(t.toLowerCase()) ? (m.startsWith('</') ? `</${t.toLowerCase()}>` : `<${t.toLowerCase()}>`) : ''));
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// The same English matchers explain-i18n.mjs gates with.
const EN_M = /\bmodell?(?:ed|s)\b/i, EN_S = /\bsimulat/i;
const englishName = new Intl.DisplayNames(['en'], { type: 'language' });

const html = readFileSync(join(ROOT, 'explain.html'), 'utf8');
const gloss = [...html.matchAll(/<td id="v-[^"]*" data-term="([^"]*)">([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)]
  .map((m) => ({ term: norm(decode(m[2])), def: norm(decode(m[3])) }));
const labels = [...new Set([...readFileSync(join(ROOT, 'src/main.js'), 'utf8').matchAll(/registerLabel\('([^']*)'/g)].map((x) => x[1]))];

const failures = [];
const fail = (code, msg) => failures.push(`[${code}] ${msg}`);
if (!gloss.length) fail('-', 'read 0 glossary rows from explain.html — the Vocabulary table\'s markup moved');
if (!labels.length) fail('-', 'read 0 registerLabel names from src/main.js');
for (const k of CORE) if (!labels.includes(k)) fail('-', `CORE names "${k}", which is no longer a registered label`);

const roster = LOCALES.filter((L) => L.code !== 'en');
for (const code of Object.keys(QUESTIONS)) if (!roster.some((L) => L.code === code)) fail(code, 'QUESTIONS has a row for a locale LOCALES no longer lists');

const index = [];
const packets = {};
for (const L of roster) {
  const { code } = L;
  if (!QUESTIONS[code]) { fail(code, 'no QUESTIONS entry — add one to tools/l10n-review/questions.mjs ([] declares that nothing was recorded)'); continue; }
  const ex = await entries(`src/explain-i18n.${code}.js`), pr = await entries(`src/primer-i18n.${code}.js`);
  const exM = new Map(ex), ch = TABLES[code];
  const row = (sec, en, t, extra = {}) => ({ id: h(sec + '\u0001' + en), th: h(t || '', 8), en: clean(en), t: clean(t || ''), ...extra });
  const corpus = [...Object.entries(ch), ...ex, ...pr].filter(([, v]) => typeof v === 'string');
  // A flow-arrow question wants CHAINS (two arrows or more), not the header links whose arrow
  // is a physical direction.
  const hit = (term, v) => (term === '←' ? (plain(v).match(/←/g) || []).length >= 2 : plain(v).toLowerCase().includes(term.toLowerCase()));
  const examples = (term) => corpus.filter(([, v]) => hit(term, v))
    .sort((a, b) => plain(a[1]).length - plain(b[1]).length).slice(0, 3)
    .map(([k, v]) => ({ en: clean(k), t: clean(v) }));

  const flags = QUESTIONS[code].map((f) => {
    const ex3 = examples(f.term);
    if (!ex3.length) fail(code, `question term «${f.term}» occurs nowhere in this locale's strings — the question is stale`);
    return { id: h('flag\u0001' + f.term), kind: 'flag', term: f.term, en: f.en, q: f.q, th: h(f.term, 8), examples: ex3 };
  });
  const label = (k) => { if (ch[k] == null) fail(code, `part label "${k}" has no translation`); return row('part', k, ch[k], { kind: 'term' }); };
  const vocab = gloss.map((g) => {
    const t = exM.get(g.term), d = exM.get(g.def);
    if (t == null || d == null) fail(code, `glossary row "${g.term}" has no ${t == null ? 'term' : 'definition'} translation`);
    return { ...row('gloss', g.term + '\u0001' + g.def, (t || '') + '\u0001' + (d || '')), kind: 'gloss', en: clean(g.term), t: clean(t || ''), enDef: clean(g.def), tDef: clean(d || '') };
  });
  const isHon = (k) => EN_M.test(plain(k)) || EN_S.test(plain(k));
  const honesty = [...ex.filter(([k]) => isHon(k)).map(([k, v]) => row('block', k, v, { kind: 'block', page: 'explainer' })),
    ...pr.filter(([k]) => isHon(k)).map(([k, v]) => row('block', k, v, { kind: 'block', page: 'primer' }))];
  const honIds = new Set(honesty.map((r) => r.id));
  const sections = [
    { id: 'start', title: 'Start here', blurb: flags.length
      ? 'The questions this language\'s translation record left for a fluent reader, then the core part names every other section leans on.'
      : 'No term-level questions were recorded for this language, so this section is the core part names every other section leans on.',
    rows: [...flags, ...CORE.map(label)] },
    { id: 'vocab', title: 'Vocabulary', blurb: 'The explainer\'s glossary. Each word is held to one meaning across the page, so a term that reads oddly here reads oddly everywhere.', rows: vocab },
    { id: 'parts', title: 'Part names', blurb: 'The labels on the 3D movement. Short, and seen constantly.', rows: labels.filter((k) => !CORE.includes(k)).map(label) },
    { id: 'honesty', title: 'Modelled vs simulated', blurb: 'Modelled means described: the geometry and numbers exist. Simulated means driven: the part moves because something pushes it. The project polices this distinction hardest, so please check that each paragraph keeps the two words apart.', rows: honesty },
    { id: 'primer', title: 'The primer', blurb: 'The plain-language introduction most readers start with, in reading order.', rows: pr.map(([k, v]) => row('block', k, v, { kind: 'block', page: 'primer' })).filter((r) => !honIds.has(r.id)) },
  ];
  const meta = { code, name: L.face, english: englishName.of(code), ...(L.dir ? { dir: L.dir } : {}) };
  packets[code] = { ...meta, sections };
  const counts = Object.fromEntries(sections.map((s) => [s.id, s.rows.length]));
  index.push({ ...meta, rows: Object.values(counts).reduce((a, b) => a + b, 0), counts });
  console.log(`[${code}] ${String(index.at(-1).rows).padStart(3)} rows · questions ${flags.length} · ${JSON.stringify(counts)}`);
}

if (failures.length) {
  console.log(`\nFAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log(`\nPASS — ${index.length} locale packet(s): every locale has its questions, every question's term is in use, every label and glossary row is translated`);

if (OUT) {
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}
  mkdirSync(join(OUT, 'data'), { recursive: true });
  for (const [code, p] of Object.entries(packets)) writeFileSync(join(OUT, 'data', `${code}.json`), JSON.stringify(p));
  writeFileSync(join(OUT, 'data', 'index.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), commit, locales: index }));
  const page = join(ROOT, 'tools/l10n-review/page.html');
  let wrote = 'review.html';
  if (STANDALONE) {
    const attr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const head = ['<!doctype html>', '<html lang="en">', '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="robots" content="noindex">'];
    if (SEND_TO) head.push(`<meta name="review-send-to" content="${attr(SEND_TO)}">`);
    writeFileSync(join(OUT, 'index.html'), head.join('\n') + '\n' + readFileSync(page, 'utf8'));
    wrote = 'index.html';
  } else copyFileSync(page, join(OUT, 'review.html'));
  console.log(`wrote ${OUT}/${wrote} and ${index.length + 1} data files (commit ${commit})`);
}
