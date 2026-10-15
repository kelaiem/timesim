// §274 — JUDGES A LOCALE'S DECLARED SURFACES, both ways. Pure: no browser, no
// file reads, so the planted-locale controls (probe-274-surfaces.mjs) can run
// it on data it makes up, and explain-i18n.mjs calls the same function on the
// real tables. LOCALES' `surfaces` (src/i18n.js) says which of chrome / primer /
// explainer a locale carries; this holds the claim like a waiver is held:
//
//   declared    the page must be COMPLETE — every live block translated — less
//               only the locale's ARRIVAL debt below, and a table that is
//               empty is not a translation at all;
//   undeclared  the page's table must be EMPTY, or the row is STALE: a half-
//               finished page table under a page the locale does not claim is
//               exactly the confident partial the field exists to stop.
//
// Neither half moves a tolerance. Before §274 a missing block was a REPORT, so
// a page table could sit at any coverage with every gate green.

// THE ARRIVAL INVENTORY — CLOSED, and it only shrinks (UNDECLARED_CLEARANCE_DEBT's
// rule). Measured on the tree §274 landed on, not predicted: when the gate was
// written, every shipped explainer already had blocks its English had outgrown
// (the lubrication entry, the fusee spring plate, two honesty ledgers) — 30 in
// most locales, 19 where a later landing had caught up, and 45 in the CJK and
// Korean tables, whose 15 hidden `.gloss-variants` rows stay English by design
// (the CJK and Hangul linkers need no inflected forms; §223). Reading "declared
// means 100%" literally would have failed all twenty-two on arrival, and a
// waiver for each would have been the tolerance this gate refuses to widen.
// So the count is pinned per (page, locale): a locale over it has a NEW
// untranslated block and fails; a locale UNDER it has paid debt down, and the
// row fails as stale until the number is lowered — the ratchet. A new locale
// has no row and so owes zero. Counts, not keys, because the keys are English
// that any landing rewrites; a block swapped for another keeps the count and is
// the residue a count cannot see — the page check's own list still prints it.
export const ARRIVAL_UNTRANSLATED = {
  explain: {
    de: 30, fr: 30, es: 30, ko: 45, ru: 30, pt: 30, it: 30, vi: 30, nl: 30, id: 30, tr: 30, cy: 30,
    fil: 19, lv: 19, hu: 19, hi: 30, ja: 45, zh: 45, 'zh-Hant': 45, he: 30, fa: 30, ar: 30,
  },
  primer: {},
};

// page: 'explain' | 'primer' (the check's names); surface: 'explainer' | 'primer'.
export const SURFACE_OF_PAGE = { explain: 'explainer', primer: 'primer' };

// → { problems: string[], verdict: string }. `live` is the count of blocks the
// page asks a translation for, `translated` how many of them the table answers,
// `tableSize` the table's entry count (an undeclared table must be 0).
export function judgeSurface({ page, lang, surfaces, live, translated, tableSize, arrival = ARRIVAL_UNTRANSLATED }) {
  const surface = SURFACE_OF_PAGE[page];
  if (!surface) return { problems: [`unknown page ${JSON.stringify(page)}`], verdict: 'malformed' };
  const declared = surfaces.includes(surface);
  const problems = [];
  if (!declared) {
    if (tableSize > 0) problems.push(`STALE: ${lang} does not declare '${surface}' but its table carries ${tableSize} entr${tableSize === 1 ? 'y' : 'ies'} — declare the surface and finish it, or empty the table`);
    return { problems, verdict: problems.length ? 'stale' : 'undeclared, empty' };
  }
  if (!tableSize) problems.push(`${lang} declares '${surface}' and carries an empty table — a declared page must be translated`);
  const missing = live - translated;
  const owed = arrival[page]?.[lang] ?? 0;
  if (missing > owed) problems.push(`${lang} declares '${surface}' but ${missing} block(s) are untranslated against ${owed} on arrival — a declared page must be complete`);
  else if (missing < owed) problems.push(`STALE DEBT: ${lang}'s '${surface}' arrival inventory says ${owed} untranslated, ${missing} measured — lower the number in tools/locale-surfaces.mjs`);
  return { problems, verdict: problems.length ? 'fails' : (owed ? `declared, ${missing} on the arrival inventory` : 'declared, complete') };
}

// The inventory's own sanity: no row for a locale or page that does not exist.
export function judgeInventory(rosterCodes, arrival = ARRIVAL_UNTRANSLATED) {
  const out = [];
  for (const [page, rows] of Object.entries(arrival)) {
    if (!SURFACE_OF_PAGE[page]) out.push(`arrival inventory names page ${JSON.stringify(page)}, which is not a page`);
    for (const [lang, n] of Object.entries(rows)) {
      if (!rosterCodes.includes(lang)) out.push(`arrival inventory has a row for ${lang} on ${page}, which LOCALES does not list`);
      if (!Number.isInteger(n) || n <= 0) out.push(`arrival inventory row ${page}/${lang} is ${n} — a paid-off row is deleted, not zeroed`);
    }
  }
  return out;
}
