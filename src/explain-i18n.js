// §73 tier two — THE EXPLAINER, LOCALIZED. German and Chinese prose for
// explain.html's entries, plates and captions.
//
// Same contract as tier one (src/i18n.js): the page is still AUTHORED in
// English, the table is keyed by the English source, and a missing entry
// falls back to English VISIBLY. What changes at this tier is the unit of
// translation — a paragraph, not a word — because a sentence flows THROUGH
// its inline markup (<code>, <b>, <em>) and word order differs per language.
// So rich blocks are keyed by their normalized innerHTML and the markup
// travels with the sentence.
//
// EDITING THE ENGLISH INVALIDATES ITS TRANSLATION, ON PURPOSE. Change a
// paragraph in explain.html and its key no longer matches, so that block
// renders English again until someone re-translates it. A stale German
// paragraph confidently describing changed English would be exactly the lie
// this repo's maintenance rule exists to prevent; visible English is the
// honest failure. `node tools/explain-i18n.mjs --check` reports the coverage
// drop, and --extract regenerates keys straight from the DOM (never retype a
// key by hand — a typo is a silent English fallback).
//
// NUMBERS ARE NOT LOCALIZED HERE, and that is a deliberate divergence from
// tier one's fmtNum rule. This page's whole promise is that its numbers are
// the real constants, greppable in src/*.js (the header says so: "values
// quoted from src/*.js"). Rendering CLEAR_MARGIN as "0,15" in German while
// the source reads 0.15 would break exactly that promise — these are
// IDENTIFIERS being quoted, not quantities being read aloud. The checker
// enforces it: <code> spans must be byte-identical across languages and every
// number in a plate label must survive translation.
import { UI_LANG, t as tChrome } from './i18n.js';

// The ONE definition of what is translatable. tools/explain-i18n.mjs imports
// this rather than keeping its own copy, so extraction, verification and
// rendering cannot drift apart.
export const RICH_SELECTORS = [
  'header h1', 'header a.back', 'header .stamp',
  'p.intro', '.mech-body p', 'figcaption',
  'details.mech > summary', '.fig-title', '.fig-no',
  'td', 'th', 'footer',
  '.controls > span:not(.readout)',
  '.controls button',
  'svg text',
];
export const LABEL_SELECTOR = '.controls label';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// Every translatable node on the page, with the section it belongs to.
// kind: 'rich' (innerHTML-keyed) | 'svg' (plate label) | 'text' (label text node)
export function collectTranslatable(doc = document) {
  const out = [];
  const seen = new Set();
  for (const sel of RICH_SELECTORS) {
    for (const el of doc.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const key = norm(el.innerHTML);
      if (!key) continue;
      out.push({ key, el, sect: el.closest('details.mech')?.id || 'page', kind: el.matches('svg text') ? 'svg' : 'rich' });
    }
  }
  for (const el of doc.querySelectorAll(LABEL_SELECTOR)) {
    for (const n of el.childNodes) {
      if (n.nodeType !== 3) continue;
      const key = norm(n.textContent);
      if (!key) continue;
      out.push({ key, el: n, sect: el.closest('details.mech')?.id || 'page', kind: 'text' });
    }
  }
  return out;
}

// One file per locale, loaded on demand: a reader of the English page pays
// nothing for the German or Chinese prose, and each table stays a file a
// translator can open on its own. Top-level await is what lets the page
// localize BEFORE its interactive plates wire themselves up (see explain.html).
const TABLE = UI_LANG === 'de' ? (await import('./explain-i18n.de.js')).default
  : UI_LANG === 'zh' ? (await import('./explain-i18n.zh.js')).default
  : null;

// Both tables, for tools/explain-i18n.mjs --check (which must see every
// language at once). Loaded only when asked for, so the page never pays.
export async function allTables() {
  const [de, zh] = await Promise.all([import('./explain-i18n.de.js'), import('./explain-i18n.zh.js')]);
  return { de: de.default, zh: zh.default };
}

// Translate one string: the explainer's own table first, then tier one's
// chrome table (so shared vocabulary — part names, "Escapement", "On" — has
// exactly one translation across both surfaces), then English.
export function t(s) {
  if (TABLE && TABLE[s]) return TABLE[s];
  return tChrome(s);
}

// Rewrite the page in place. Runs once, before the interactive plates wire
// themselves up, so every later textContent write goes through t() instead.
export function localizeExplainer() {
  if (!TABLE) return;
  for (const item of collectTranslatable()) {
    const v = TABLE[item.key];
    if (!v) continue;                       // untranslated → English stands
    if (item.kind === 'text') item.el.nodeValue = item.el.nodeValue.replace(norm(item.el.textContent), v);
    else item.el.innerHTML = v;
  }
  document.documentElement.lang = UI_LANG;
  document.title = t(document.title);
}
