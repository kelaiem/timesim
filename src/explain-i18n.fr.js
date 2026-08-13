// §113 tier two — FRENCH. Keyed by the English source (normalized
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
// Landed empty and filled per locale; an untranslated key renders English,
// visibly, which is the honest failure this tier is built around.
export default {
};
