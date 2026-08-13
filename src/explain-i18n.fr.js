// §116 tier two — FRENCH. Keyed by the English source (normalized
// innerHTML for rich blocks, text for plate labels); see src/explain-i18n.js
// for why.
//
// Vocabulary is the Vallée de Joux register — the working French of Swiss
// horology, not generic mechanical French — and it is the SAME register tier
// one's chrome uses (src/i18n.js): échappement à ancre suisse, ancre,
// balancier, spiral, coq, barillet, fusée-chaîne, minuterie, platine
// trois-quarts. One movement cannot have two names for a part.
//
// NUMBERS ARE NOT LOCALIZED ON THIS PAGE, and French is the locale most likely
// to get that wrong: fr-FR would ordinarily write 18\u202f000 and 0,15, and
// here both are WRONG. This page quotes IDENTIFIERS — 0.15 is what
// CLEAR_MARGIN reads as in src/*.js — so every digit, point and comma
// survives translation byte for byte, and tools/explain-i18n.mjs fails the
// build if one moves. primer.html is the opposite page and DOES localize its
// numbers; see src/primer-i18n.fr.js.
//
// "modélisé" vs "simulé" tracks the repo's modelled/simulated distinction
// exactly: modélisé = described, simulé = driven by causality.
//
// NOT YET TRANSLATED — and that is a declared state, not an oversight.
// §116 shipped tier one (the chrome) and primer.html in this locale; this
// page is filed as its own tier in the roadmap (§117), on the §73 precedent
// that shipped the chrome first and the explainer after it. The table is
// WIRED and empty: the module loads, the page renders English, and
// `node tools/explain-i18n.mjs --check` reports the coverage as 0% out loud
// every run rather than letting a missing locale pass unmentioned.
//
// To fill it: `node tools/explain-i18n.mjs --extract --page explain --lang <code>`
// and paste. Never retype a key — the extractor takes them from the real DOM.
export default {
};
