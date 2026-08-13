// §113 tier two — JAPANESE. Keyed by the English source (normalized
// innerHTML for rich blocks, text for plate labels); see src/explain-i18n.js
// for why.
//
// Vocabulary is the standard 時計 trade register, and it is the SAME register
// tier one's chrome uses (src/i18n.js): 脱進機, がんぎ車, アンクル, テンプ,
// ひげぜんまい, 香箱, 輪列, りゅうず. Katakana where the trade uses katakana.
//
// THE GOING TRAIN IS NUMBERED, NOT NAMED. Japanese counts the wheels from the
// barrel — 二番車, 三番車, 四番車 — where English names them centre, third and
// fourth. The mapping is fixed once in tier one's MECH_GRAPH block and both
// pages inherit it, rather than being re-decided sentence by sentence.
//
// NUMBERS AND <code> ARE NOT TRANSLATED — they are the source constants this
// page exists to quote (ja-JP punctuates them as English does in any case).
//
// Landed empty and filled per locale; an untranslated key renders English,
// visibly, which is the honest failure this tier is built around.
export default {
};
