// §116 tier two — TRADITIONAL CHINESE. Keyed by the English source
// (normalized innerHTML for rich blocks, text for plate labels); see
// src/explain-i18n.js for why.
//
// THIS IS NOT src/explain-i18n.zh.js CONVERTED. Taiwan/HK horological usage
// differs from the Mainland register in words, not only in glyphs, and the two
// tells a reviewer should spot-check are 錶 vs 表 (手錶, 錶冠, 錶盤) and
// 模擬 vs 仿真 for "simulate". A pure glyph conversion of the Simplified
// table would pass every gate in this repo and still read wrong.
//
// Vocabulary is the SAME register tier one's chrome uses (src/i18n.js):
// 機芯, 擒縱, 擺輪, 游絲, 發條盒, 寶塔輪與芝麻鏈.
//
// NUMBERS AND <code> ARE NOT TRANSLATED — they are the source constants this
// page exists to quote.
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
