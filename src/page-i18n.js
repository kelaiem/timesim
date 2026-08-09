// §73 tier two, ENGINE — the document localizer, shared by every static page.
//
// §95 split this out of src/explain-i18n.js when the primer earned its
// translation. Tier two is a page-level mechanism (rich blocks keyed by their
// normalized innerHTML, plate labels keyed by their text), and the moment a
// SECOND page wanted it, the choice was one engine with per-page tables or two
// copies of the collector. Two copies is the failure this tier already guards
// against everywhere else: extraction, verification and rendering must not be
// able to disagree about what "translatable" means, and that guarantee does
// not survive being written down twice.
//
// So: this file holds the walk and the swap. A per-page module
// (explain-i18n.js, primer-i18n.js) is a dozen lines that name its own locale
// tables and re-export the same three things — the page decides WHICH prose,
// never HOW the swap works.
//
// The contract is unchanged from tier one (src/i18n.js): pages are AUTHORED in
// English, tables are keyed by the English source, and a missing entry falls
// back to English VISIBLY. Editing the English invalidates its translation ON
// PURPOSE — the key stops matching and that block renders English until
// someone re-translates it, which beats a stale paragraph confidently
// describing changed prose.
//
// WHAT THIS ENGINE DOES NOT DECIDE: whether numbers are localized. That is a
// property of the PAGE's contract, not of the mechanism — see NUMBERS in each
// per-page module and the `numbers` field they declare, which
// tools/explain-i18n.mjs reads to pick which rule to enforce.
import { UI_LANG, t as tChrome } from './i18n.js';

// The ONE definition of what is translatable. tools/explain-i18n.mjs imports
// this rather than keeping its own copy, so extraction, verification and
// rendering cannot drift apart.
export const RICH_SELECTORS = [
  'header h1', 'header a.back', 'header .stamp',
  'p.intro', '.mech-body p', 'figcaption',
  'details.mech > summary', '.fig-title', '.fig-no',
  'td', 'th', 'footer',
  '.controls > span:not(.readout)',
  '.controls button',
  'svg text',
];
export const LABEL_SELECTOR = '.controls label';

export const norm = (s) => s.replace(/\s+/g, ' ').trim();

// Every translatable node on the page, with the section it belongs to.
// kind: 'rich' (innerHTML-keyed) | 'svg' (plate label) | 'text' (label text node)
export function collectTranslatable(doc = document) {
  const out = [];
  const seen = new Set();
  for (const sel of RICH_SELECTORS) {
    for (const el of doc.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const key = norm(el.innerHTML);
      if (!key) continue;
      out.push({ key, el, sect: el.closest('details.mech')?.id || 'page', kind: el.matches('svg text') ? 'svg' : 'rich' });
    }
  }
  for (const el of doc.querySelectorAll(LABEL_SELECTOR)) {
    for (const n of el.childNodes) {
      if (n.nodeType !== 3) continue;
      const key = norm(n.textContent);
      if (!key) continue;
      out.push({ key, el: n, sect: el.closest('details.mech')?.id || 'page', kind: 'text' });
    }
  }
  return out;
}

// Translate one string against a page's table: that page's own prose first,
// then tier one's chrome table (so shared vocabulary — part names,
// "Escapement", "On" — has exactly one translation across every surface),
// then English.
export const translator = (TABLE) => (s) => {
  if (TABLE && TABLE[s]) return TABLE[s];
  return tChrome(s);
};

// Rewrite the page in place. Runs once, before any interactive plate wires
// itself up: the swap replaces rich blocks' innerHTML, so a plate that had
// already cached a node inside one would be holding a detached copy.
export function localizeDoc(TABLE) {
  if (!TABLE) return;                         // English: the page as authored
  for (const item of collectTranslatable()) {
    const v = TABLE[item.key];
    if (!v) continue;                         // untranslated → English stands
    if (item.kind === 'text') item.el.nodeValue = item.el.nodeValue.replace(norm(item.el.textContent), v);
    else item.el.innerHTML = v;
  }
  document.documentElement.lang = UI_LANG;
  document.title = translator(TABLE)(document.title);
}
