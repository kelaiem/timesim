// §73 tier two — THE EXPLAINER, LOCALIZED. German and Chinese prose for
// explain.html's entries, plates and captions. §113 wired fr, ja and zh-Hant
// here too; their tables are empty and filed as their own tier (§114), so
// those locales render this page in English and --check says so every run.
//
// The walk and the swap live in src/page-i18n.js (§95 moved them there when
// the primer became a second tier-two page); this file is the EXPLAINER's
// half — which tables, and which number rule.
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
// number in a plate label must survive translation UNCHANGED.
//
// primer.html is the other way round for the same reason, which is why this
// is declared per page rather than assumed by the engine: that page quotes no
// identifiers, so its numbers ARE quantities being read aloud and tier one's
// rule applies to them normally. See src/primer-i18n.js.
import { UI_LANG } from './i18n.js';
import { collectTranslatable, localizeDoc, translator, RICH_SELECTORS, LABEL_SELECTOR } from './page-i18n.js';

export { collectTranslatable, RICH_SELECTORS, LABEL_SELECTOR };

// Which rule tools/explain-i18n.mjs enforces on this page's numbers.
// 'source' = byte-identical (an identifier being quoted).
export const NUMBERS = 'source';

// One file per locale, loaded on demand: a reader of the English page pays
// nothing for the other locales' prose, and each table stays a file a
// translator can open on its own. Top-level await is what lets the page
// localize BEFORE its interactive plates wire themselves up (see explain.html).
//
// §113 — THE SPECIFIERS ARE LITERAL STRINGS, and that is a build constraint
// rather than a style. tools/stamp-release.mjs finds dynamic imports by regex
// over a QUOTED relative specifier, and its leftover scan uses the same
// pattern — so a specifier built by template interpolation from UI_LANG would
// be neither stamped nor added to the service worker's precache AND would not
// be reported as missed: a reader offline in that locale would get a 404 with
// every gate green. One map per page, listed by hand, is the price of being
// visible to that walk.
//
// That regex reads THIS FILE too, comments included, and §113 proved it the
// expensive way: a comment here spelling out the call form it matches put a
// phantom `src/…` into PRECACHE, addAll is all-or-nothing, and the worker
// never activated. Describe the pattern; do not write a specimen of it.
//
// The map is also the page's ANSWER to "which languages do you have" — it
// feeds both the load below and allTables(), so the roster is stated once.
const LOADERS = {
  de: () => import('./explain-i18n.de.js'),
  fr: () => import('./explain-i18n.fr.js'),
  ja: () => import('./explain-i18n.ja.js'),
  zh: () => import('./explain-i18n.zh.js'),
  'zh-Hant': () => import('./explain-i18n.zh-Hant.js'),
};
const TABLE = LOADERS[UI_LANG] ? (await LOADERS[UI_LANG]()).default : null;

// Every table at once, for tools/explain-i18n.mjs --check (which must see all
// languages together). Loaded only when asked for, so the page never pays.
// The tool takes its locale list from the KEYS of what this returns — there is
// no second roster in the harness to keep in step with this one.
export async function allTables() {
  const codes = Object.keys(LOADERS);
  const mods = await Promise.all(codes.map((c) => LOADERS[c]()));
  return Object.fromEntries(codes.map((c, i) => [c, mods[i].default]));
}

export const t = translator(TABLE);
export function localizeExplainer() { localizeDoc(TABLE); }
