// §113 tier two — FRENCH. primer.html's prose, keyed by the English source;
// see src/page-i18n.js for the mechanism and src/primer-i18n.js for this
// page's number rule.
//
// Vocabulary is the Vallée de Joux register, the same one tier one's chrome
// and the explainer use (src/i18n.js, src/explain-i18n.fr.js).
//
// NUMBERS ARE LOCALIZED HERE, and this is the page where French differs from
// every locale before it. fr-FR points with ',' (0,024 mm) and GROUPS WITH
// U+202F NARROW NO-BREAK SPACE, not with a plain space and not with '.':
// 18\u202f000, 4\u202f800. tools/explain-i18n.mjs parses per locale and compares
// VALUES, so the punctuation is free and the quantity is not — and it rejects
// an ASCII space outright, because "5 100" in prose is two quantities more
// often than one. explain.html is the opposite page and does NOT localize its
// numbers; see src/explain-i18n.fr.js.
//
// Landed empty and filled per locale; an untranslated key renders English,
// visibly, which is the honest failure this tier is built around.
export default {
};
