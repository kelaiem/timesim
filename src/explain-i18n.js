// §73 tier two — THE EXPLAINER, LOCALIZED. German and Chinese prose for
// explain.html's entries, plates and captions.
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

export const t = translator(TABLE);
export function localizeExplainer() { localizeDoc(TABLE); }
