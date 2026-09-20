// §236 tier one — THE GLOSSARY LINKER. The explainer defines 30 project words
// across 27 Vocabulary rows and, until this, linked to none of them: the
// definition existed and was unreachable from the prose that used it. Measured
// on the English page, 82 first uses across 20 entries now reach it.
//
// THE WHOLE DESIGN FOLLOWS FROM ONE FACT: this runs at RUNTIME, after
// localizeExplainer() has swapped every rich block. It cannot be authored into
// explain.html, because src/page-i18n.js keys each block by its normalized
// innerHTML — an <a> written into the source would change that key and
// invalidate that block's translation in all twelve locales at a stroke. Three
// consequences worth stating, because each one looks like a free choice and is
// not:
//
//   · The TERM LIST is read off the rendered glossary, never kept beside it.
//     After localization the first column IS the term list in the reader's
//     language, so German prose matches German terms for free. A hand-kept
//     list would be this repository's recurring defect — one fact written
//     down twice, with only one copy carrying the sense.
//   · VARIANTS are content, not attributes (§236's option A). localizeDoc
//     assigns el.innerHTML, and an element's own attributes are NOT part of
//     its innerHTML — the same fact that makes the glossary's ids free. A
//     `data-also` would render untranslated for ever. So each term's inflected
//     forms live in a hidden element whose CONTENT the existing engine
//     translates, while its `data-term` stays canonical English: a VALUE, the
//     same class as `data-cam`, which tier one's rule already permits.
//   · OPT-OUTS are declared here as data, for the same reason — a marker
//     wrapped round a word in the prose would change that block's key too.
//
// WHAT IT REFUSES TO DO is the load-bearing half, and it refuses eleven of the
// thirty. A generic matcher makes FALSE CLAIMS: "a flex ROW" is a CSS note,
// "the drum's FLOOR" is a physical floor, and `corner` and `fork` are ambiguous
// IN THE MECHANISM (a pallet stone's locking corner against §137's routing
// corner; the pallet fork against a declared fork). A link is a claim that a
// word means what the glossary says, so an ambiguous word is not linked at all
// — see AMBIGUOUS, and SENSE_CLASH for the two words that collide in exactly
// one entry each and are worth keeping everywhere else. That refusal rate is
// the finding, not an embarrassment: on a page whose subject is mechanisms,
// a third of the project's abstract vocabulary is also the mechanism's own.

// Terms the linker will not touch, with the sense that collides. Each row is a
// CLAIM someone can check, and tools/glossary-links.mjs fails if a row names a
// word the glossary no longer defines: a stale exclusion silently re-links a
// false positive, which is the failure this table exists to prevent.
//
// The judgement is English's. A locale where one of these is unambiguous
// simply loses a link, which is the safe direction: a missing link is
// invisible, a wrong one is a false claim in the reader's face.
export const AMBIGUOUS = {
  'the line': 'the LINE of centres is where two pitch circles touch; the glossary\'s line is a straight reference chain',
  row: 'a CSS flex row, and an instrument\'s accounting row',
  floor: 'a physical floor (the drum\'s floor and lid are bored) and §50\'s section floor',
  band: 'a z-band, a torque band, and the glossary\'s height band',
  corner: 'a pallet stone\'s LOCKING corner is an edge of metal; §137\'s corner is a routing part',
  fork: 'the pallet fork is a part; a declared fork is a departure from a line spec',
  unit: 'a unit of measurement in ordinary prose, and the instruments\' labelled assembly',
  gate: 'the verb (a check gates), and the glossary\'s noun',

  // The three below were MEASURED into this table rather than predicted into
  // it, which is why the first build of the linker made 105 links and the
  // shipped one makes 82. Reading all 105 in context: `axis` was the
  // mechanism's axis of rotation in nine uses of thirteen (the balance axis,
  // the cone's axis, crossed-AXIS meshes) against the glossary's "one input
  // swept end to end"; `margin` named a measured 0.108 travel bound and a
  // "running margin at each face" beside the entry insisting there is exactly
  // ONE margin and it is 0.15; and `envelope` named sndTone's ADSR. A term
  // the page mostly uses in the other sense is the worst case for a linker,
  // because the link looks most authoritative exactly where it is wrong.
  axis: 'an axis of rotation (the balance axis, the cone\'s axis) and the instruments\' swept input',
  margin: 'any measured clearance in prose, against the entry\'s claim that CLEAR_MARGIN 0.15 is the only one',
  envelope: 'a sound envelope (sndTone\'s), a force window, and the geometric envelope a law hands a cut',
};

// A word that collides in ONE entry, where AMBIGUOUS would be too blunt. Both
// rows below are for words a reader most needs a glossary for — which is
// exactly what excluding them outright would have cost: `annulus` links in
// four other entries and `chord` in three, and losing seven true links to
// avoid two false ones is the wrong trade for two words nobody knows.
//
// The staleness rule is `SLENDER_WAIVERS`': an entry naming a section where
// the word never appears buys silence for nothing and FAILS in
// tools/glossary-links.mjs, as does one naming a section or a term that is
// gone. The residue it cannot check is the case where the word appears in
// that entry in the glossary's OWN sense after all — nothing measurable
// distinguishes that, so the row is a judgement, recorded as one.
export const SENSE_CLASH = {
  'alarm-winding-arrest': {
    annulus: 'the epicyclic RING GEAR (sun-planet-annulus, annulus teeth), not a flat region between two radii',
  },
  gong: {
    chord: 'a musical chord — §56 took the partials from the bar rather than from a preset chord',
  },
};

// The prose a reader reads. Plate labels are cut to fit and have no room for a
// link; a summary is a disclosure control and a link inside one fights the
// toggle; `code` is an identifier, not a word.
const PROSE = 'p.intro, .mech-body p, figcaption, td, th';
const SKIP_INSIDE = 'code, a, svg, #vocabulary, .gloss-variants';

// No `-`: the regexes below are built in UNICODE mode, where `\-` outside a
// character class is an invalid escape rather than a harmless one, and `-` has
// no meaning outside a class anyway. `hand-off` is the form that finds this.
const esc = (s) => s.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');

// WHAT COUNTS AS A WHOLE WORD DEPENDS ON THE SCRIPT, and three answers are
// needed rather than one. `\b` cannot serve them all: JavaScript's `\w` is
// ASCII, so `\b` before `ステーション` or `коридор` asks for a preceding ASCII
// letter and can never hold — every non-Latin locale would match nothing at
// all, silently, while English looked healthy.
//
//   'latin'   Latin and digits: `\b` at both ends, as ever.
//   'cjk'     Han, Hiragana, Katakana: no spaces exist, so no boundary can be
//             asked for in either direction and the form matches as a plain
//             substring. These scripts do not inflect, so the form IS the word.
//   'hangul'  Korean is written in space-separated eojeol of stem + particles,
//             so the stem anchors at a word START and the wrap then grows to
//             the end of the eojeol — listing the particles would be endless.
//   'word'    everything else (Cyrillic, Arabic, Devanagari…): a WHOLE word,
//             bounded by non-letters at both ends. Inflected forms belong in
//             the `.gloss-variants` table, which is what it is for.
//
// The 'word' rule replaced open-ended stem matching, which was tried and
// measured: `лен`/`लेन` (lane) matched inside `लेना` (to take) and the wrap
// covered two thirds of a word. A stem is a cheap way to reach six Russian
// cases and it buys them by making claims about words nobody checked.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const scriptOf = (f) => (/^[A-Za-z0-9]/.test(f) ? 'latin'
  : CJK.test(f[0]) ? 'cjk'
  : /\p{Script=Hangul}/u.test(f[0]) ? 'hangul' : 'word');
const bound = (f) => {
  switch (scriptOf(f)) {
    case 'latin': return '\\b' + esc(f) + (/[A-Za-z0-9]$/.test(f) ? '\\b' : '');
    case 'cjk': return esc(f);
    case 'hangul': return '(?<!\\p{L})' + esc(f);
    default: return '(?<!\\p{L})' + esc(f) + '(?![\\p{L}\\p{M}])';
  }
};

// A term's id is derived from its ENGLISH text, so the anchor is stable across
// locales and a deep link survives a language change. Authored in the HTML
// rather than computed, because an id is not innerHTML and therefore costs no
// translation key — but this is the function that says what the id must BE,
// and the check holds the markup to it.
export const termId = (english) => 'v-' + english.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Read the glossary as rendered: the term cell's own text is the term in the
// reader's language, and its id is the anchor. Variants come from the hidden
// `.gloss-variants` elements, keyed to a term by canonical English.
export function readGlossary(doc = document) {
  const terms = [];
  for (const cell of doc.querySelectorAll('#vocabulary tbody td:first-child')) {
    const id = cell.id;
    const english = cell.dataset.term;          // canonical, never translated
    const shown = (cell.textContent || '').trim();
    if (!id || !english || !shown) continue;
    // Three cells define TWO words at once — `stratum / lane`, `floor / budget`,
    // `modelled / simulated`. They are one row and one anchor, but two things
    // to match, and one half can be ambiguous while the other is not (`floor`
    // collides, `budget` does not). Split both sides and pair them; if a
    // translation did not keep the slash the pairing is not sound, so fall
    // back to treating the cell as one term rather than guessing which half
    // is which.
    //
    // The gloss comes off FIRST, and this was measured rather than foreseen:
    // ten of the twelve locales render a term cell as `Native (english)` —
    // 'Station (station)', 'коридор (corridor)', '工位（station）' with CJK
    // parens — which is the translators' convention for a coined word, keeping
    // the source term so a reader can carry it back to the code. Read whole,
    // the form is a string no prose contains, and the linker matched almost
    // nothing outside English: 82 links in English against 7 in German. The
    // cell names ONE thing TWICE, so both names are forms.
    const m = /^(.*?)\s*[(（]\s*([^()（）]+?)\s*[)）]\s*$/.exec(shown);
    const native = m ? m[1] : shown;
    const gloss = m ? m[2] : null;
    // U+FF0F as well as '/': the CJK tables punctuate with the FULLWIDTH
    // SOLIDUS ('層／レーン'), so an ASCII-only split silently stopped pairing
    // the three two-word rows in four locales and fell back to matching the
    // whole cell.
    const split = (s) => s.split(/[/／]/).map((x) => x.trim()).filter(Boolean);
    const en = split(english);
    const nat = split(native);
    const glo = gloss ? split(gloss) : [];
    const paired = en.length === nat.length
      ? en.map((e, i) => [e, glo.length === en.length ? [nat[i], glo[i]] : [nat[i]]])
      : [[english, [shown]]];
    const live = paired.filter(([e]) => !AMBIGUOUS[e]);
    if (!live.length) continue;                 // every half of this row collides
    // `halves` is what SENSE_CLASH names. A clash suppresses the whole ROW in
    // that entry rather than one half of it, because the variants are keyed to
    // the row and cannot be split; both rows in the table today define a
    // single word, so today that distinction costs nothing.
    const forms = [...new Set(live.flatMap(([, f]) => f).filter(Boolean))];
    terms.push({ id, english, halves: live.map(([e]) => e), forms });
  }
  for (const el of doc.querySelectorAll('.gloss-variants[data-term]')) {
    const t = terms.find((x) => x.english === el.dataset.term);
    if (!t) continue;                            // the check fails this, not us
    for (const v of (el.textContent || '').split(/[,、]/)) {
      const w = v.trim();
      if (w) t.forms.push(w);
    }
  }
  return terms;
}

// Wrap the FIRST occurrence of each term in each mech section. First-per-
// section rather than first-per-block: measured, per-block would be 230 links
// on this page against 170, and a paragraph carrying four links reads like a
// ransom note.
export function linkGlossary(doc = document) {
  const terms = readGlossary(doc);
  if (!terms.length) return { linked: 0, terms: 0 };

  // Longest first, so `action group` wins over a bare `group` if both are ever
  // terms; within a term, longest form first for the same reason.
  for (const t of terms) t.forms.sort((a, b) => b.length - a.length);
  const ordered = [...terms].sort((a, b) => b.forms[0].length - a.forms[0].length);

  const done = new Map();   // section id -> Set of term ids already linked there
  let linked = 0;

  for (const el of doc.querySelectorAll(PROSE)) {
    if (el.closest(SKIP_INSIDE)) continue;
    const sect = el.closest('details.mech')?.id || 'page';
    if (!done.has(sect)) done.set(sect, new Set());
    const taken = done.get(sect);
    const clash = SENSE_CLASH[sect] || {};

    // A fresh walker per element: wrapping a match splits its text node, and a
    // live walker over a tree being rewritten is the kind of bug that only
    // shows up on the second match in a paragraph.
    for (const term of ordered) {
      if (taken.has(term.id)) continue;
      if (term.halves.some((h) => clash[h])) continue;
      const re = new RegExp(term.forms.map(bound).join('|'), 'iu');
      const node = firstTextMatch(el, re);
      if (!node) continue;
      wrap(node.node, node.index, node.length, term.id, doc);
      taken.add(term.id);
      linked++;
    }
  }
  return { linked, terms: terms.length };
}

// A term at the TAIL of a hyphenated compound is not that term being used: the
// compound is the noun. `crossed-axis` is a mesh geometry, `sun-planet-annulus`
// is an epicyclic gear and not a flat ring, `z-station` and `straight-chord`
// keep their sense but are attributive. Skipping the occurrence rather than the
// TERM is what makes this affordable — the walk goes on looking, so a word that
// first appears inside a compound still links at its next free use.
const compoundTail = (s, i) => i >= 2 && s[i - 1] === '-' && /[A-Za-z0-9]/.test(s[i - 2]);

function firstTextMatch(root, re) {
  const w = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.parentElement.closest(SKIP_INSIDE)) continue;
    // `g`, so a compound can be stepped over within one text node.
    const g = new RegExp(re.source, 'giu');
    let m;
    while ((m = g.exec(n.nodeValue))) {
      if (compoundTail(n.nodeValue, m.index)) continue;
      // Korean only, and the rule in `bound` says why: a Hangul stem matches
      // at the start of an eojeol and the particles trail it with no space, so
      // the wrap grows to the end of the word. Underlining `스테이션` and
      // leaving `으로` outside it is a defect a reader sees at once. Every
      // other script has already matched a whole word, and growing a CJK match
      // would run to the end of the clause — measured, `ステーション` became
      // `ステーションも同じ定数だけ上がりました`.
      let end = m.index + m[0].length;
      if (/\p{Script=Hangul}/u.test(m[0][0])) {
        while (end < n.nodeValue.length && /[\p{L}\p{M}]/u.test(n.nodeValue[end])) end++;
      }
      return { node: n, index: m.index, length: end - m.index };
    }
  }
  return null;
}

function wrap(textNode, index, length, id, doc) {
  const after = textNode.splitText(index);
  after.splitText(length);
  const a = doc.createElement('a');
  a.className = 'gloss';
  a.href = '#' + id;
  a.textContent = after.nodeValue;
  after.parentNode.replaceChild(a, after);
}

// The Vocabulary block is a CLOSED <details>, so a bare fragment jump lands on
// a node the browser will not scroll to. Open it, scroll, and flash the row —
// and remember where the reader was, because being thrown to the top of a
// 4,500-line page with no way back is worse than not linking at all.
// `backLabel` is passed IN rather than read here, because tools/explain-i18n.mjs
// harvests runtime strings by scanning the PAGE's module script for tr('…')
// literals. A string this module owned would be invisible to that scan — its
// translations would read as unmatched keys and its absence would be silent,
// which is the exact failure that harvesting exists to prevent.
export function wireGlossaryTargets(doc = document, backLabel = '↩ back to the text') {
  const block = doc.getElementById('vocabulary');
  if (!block) return;
  let backTo = null;

  const reveal = () => {
    const id = (doc.defaultView.location.hash || '').slice(1);
    if (!id) return;
    const cell = doc.getElementById(id);
    if (!cell || !block.contains(cell)) return;
    block.open = true;
    cell.closest('tr')?.classList.add('gloss-flash');
    setTimeout(() => cell.closest('tr')?.classList.remove('gloss-flash'), 1600);
    cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
    showBack();
  };

  const showBack = () => {
    if (!backTo) return;
    let btn = doc.getElementById('gloss-back');
    if (!btn) {
      btn = doc.createElement('button');
      btn.id = 'gloss-back';
      btn.type = 'button';
      doc.body.appendChild(btn);
      btn.addEventListener('click', () => {
        const target = backTo;
        backTo = null;
        btn.remove();
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
    btn.textContent = backLabel;
  };

  doc.addEventListener('click', (e) => {
    const a = e.target.closest?.('a.gloss');
    if (a) backTo = a;
  }, true);
  doc.defaultView.addEventListener('hashchange', reveal);
  reveal();   // a deep link that arrives with the hash already set
}
