// §274 — JUDGES A LOCALE'S DECLARED SURFACES, both ways. Pure: no browser, no
// file reads, so the planted-locale controls (probe-274-surfaces.mjs) can run
// it on data it makes up, and explain-i18n.mjs calls the same function on the
// real tables. LOCALES' `surfaces` (src/i18n.js) says which of chrome / primer /
// explainer a locale carries; this holds the claim like a waiver is held:
//
//   declared    an ESSENTIAL page (the primer — the HUD's front door and the
//               project's honesty framing) must be COMPLETE, and a table that
//               is empty is not a translation at all. The EXPLAINER is
//               declared PARTIAL-OK: its untranslated blocks are a stated,
//               allowed gap, counted in the report and never a failure;
//   undeclared  the page's table must be EMPTY, or the row is STALE: a half-
//               finished page table under a page the locale does not claim is
//               exactly the confident partial the field exists to stop.
//
// The point is that a gap is DOCUMENTED rather than owed silently, not that
// every gap is closed: the chrome (probe-chrome-coverage) and the primer are
// held to 100%, the explainer is the costly, low-reach surface a thin locale
// may leave short or out. Before §274 a missing block was only a REPORT, so a
// page table could sit at any coverage with every gate green and nothing said
// which. A ratchet on the explainer's count (an arrival inventory, pinned per
// locale and lowered as debt is paid) is a sound LATER step and is deliberately
// not built: the shipped explainers are 19 to 45 blocks short of their English,
// and pinning that would be policing a gap the owner has called allowed.

// Surfaces held COMPLETE when declared. The chrome is held by
// probe-chrome-coverage, so only the pages appear here.
export const ESSENTIAL = ['primer'];

// page: 'explain' | 'primer' (the check's names); surface: 'explainer' | 'primer'.
export const SURFACE_OF_PAGE = { explain: 'explainer', primer: 'primer' };

// → { problems: string[], verdict: string }. `live` is the count of blocks the
// page asks a translation for, `translated` how many of them the table answers,
// `tableSize` the table's entry count (an undeclared table must be 0).
export function judgeSurface({ page, lang, surfaces, live, translated, tableSize }) {
  const surface = SURFACE_OF_PAGE[page];
  if (!surface) return { problems: [`unknown page ${JSON.stringify(page)}`], verdict: 'malformed' };
  const problems = [];
  if (!surfaces.includes(surface)) {
    if (tableSize > 0) problems.push(`STALE: ${lang} does not declare '${surface}' but its table carries ${tableSize} entr${tableSize === 1 ? 'y' : 'ies'} — declare the surface and finish it, or empty the table`);
    return { problems, verdict: problems.length ? 'stale' : 'undeclared, empty' };
  }
  if (!tableSize) problems.push(`${lang} declares '${surface}' and carries an empty table — a declared page must be translated`);
  const missing = live - translated;
  if (ESSENTIAL.includes(surface)) {
    if (missing > 0) problems.push(`${lang} declares '${surface}' but ${missing} block(s) are untranslated — an essential page must be complete`);
    return { problems, verdict: problems.length ? 'fails' : 'declared, complete' };
  }
  // A partial-OK page: the gap is stated, not gated.
  return { problems, verdict: problems.length ? 'fails' : (missing ? `declared, partial — ${missing} of ${live} block(s) untranslated (allowed, reported)` : 'declared, complete') };
}
