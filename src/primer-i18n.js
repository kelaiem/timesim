// §95 tier two — THE PRIMER, LOCALIZED. German and Chinese prose for
// primer.html's entries, plates and captions.
//
// Same engine as the explainer (src/page-i18n.js holds the walk and the swap),
// same contract as tier one: authored in English, keyed by the English source,
// a missing entry falls back to English VISIBLY, and editing the English
// invalidates its translation by design.
//
// NUMBERS ARE LOCALIZED HERE, which is the exact inverse of explain.html and
// is not an inconsistency — it is each page's contract reaching its numbers.
// The explainer quotes IDENTIFIERS ("0.15" is what `CLEAR_MARGIN` reads as in
// src/*.js, and rendering it "0,15" would break the promise its header makes).
// The primer quotes NOTHING; its header promises rounded quantities with
// units, so its numbers are quantities being READ ALOUD — the ordinary case,
// where tier one's fmtNum rule applies and a German reader is owed "0,024 mm"
// and "18.000" exactly as the app's chrome owes them "30,0 h".
//
// The checker enforces the difference rather than trusting it: on this page a
// translated number must carry the same VALUE (parsed per locale), not the
// same glyphs — so "0,024" passes and "0,25" fails. A byte-identity rule here
// would have forced English punctuation into German prose; a no rule at all
// would have let a decimal point wander during translation.
import { UI_LANG } from './i18n.js';
import { collectTranslatable, localizeDoc, translator, RICH_SELECTORS, LABEL_SELECTOR } from './page-i18n.js';

export { collectTranslatable, RICH_SELECTORS, LABEL_SELECTOR };

// Which rule tools/explain-i18n.mjs enforces on this page's numbers.
// 'quantity' = same value after locale parsing, punctuation free to localize.
export const NUMBERS = 'quantity';

const TABLE = UI_LANG === 'de' ? (await import('./primer-i18n.de.js')).default
  : UI_LANG === 'zh' ? (await import('./primer-i18n.zh.js')).default
  : null;

export async function allTables() {
  const [de, zh] = await Promise.all([import('./primer-i18n.de.js'), import('./primer-i18n.zh.js')]);
  return { de: de.default, zh: zh.default };
}

export const t = translator(TABLE);
export function localizePrimer() { localizeDoc(TABLE); }
