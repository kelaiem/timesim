# Localization guide

How the app is localized, how to change UI text without breaking a locale, and
how to add a new one. This page is a map. The reasoning behind each rule lives
in `CLAUDE.md` (the localization paragraphs) and in `docs/BUILT.md` (§73, §95,
§116, §208, §241, §249); this page points there rather than restating it.

Anything with a number in it (the roster, key counts) is deliberately NOT
quoted here: `LOCALES` in `src/i18n.js` is the roster, and a copy would be one
more thing to fall behind.

## The three surfaces

| Surface | Engine | Tables | Keyed by |
|---|---|---|---|
| **Chrome** (HUD, panel, buttons, tooltips) — tier one | `src/i18n.js` | one `TABLES` map in the same file | the English source string |
| **`explain.html`** — tier two | `src/page-i18n.js` | `src/explain-i18n.<code>.js`, one per locale | the English block's normalized `innerHTML` |
| **`primer.html`** — tier two | `src/page-i18n.js` | `src/primer-i18n.<code>.js`, one per locale | the same |

`src/explain-i18n.js` and `src/primer-i18n.js` are the per-page modules. Each
holds a `LOADERS` map (one literal `import()` per locale) and a `NUMBERS`
declaration.

Authoring is always in English. A missing entry falls back to English
**visibly**, which is the intended failure mode. Editing English text
invalidates its translations on purpose: the key stops matching and that block
renders English until it is retranslated.

## Rules that apply to every UI change

- **State is an attribute, never the text.** Toggles carry
  `data-state="on|off"` (`setBtnState`). Never compare button text to `'On'`.
- **Display translates, values do not.** Option `value`, `data-cam`, unit and
  group names in `MECH_GRAPH`, persisted state and deep-link params stay
  canonical English. `t()` only reaches `textContent`, `title`, `placeholder`
  and `aria-label`.
- **Numbers go through `fmtNum` / `fmtInt` / `fmtPct`** at the display layer.
  The stored value keeps its `.`.
- **Write chrome CSS in logical properties** (`margin-inline-start`,
  `text-align: start`, `float: inline-end`). A `left`/`right` claims the thing
  is a viewport fact, not a text fact. Arabic, Hebrew and Persian are
  right-to-left.
- **Never retype a key.** Extract it:
  `node tools/explain-i18n.mjs --extract --page <name>`.
- **A static page's numbers follow that page's declared rule.** The explainer
  keeps numbers in source form in every language, because it quotes
  identifiers. The primer's numbers are quantities and localize. The page's
  `NUMBERS` export says which, and the checker reads it.
- **Say "modelled" and "simulated" precisely** in every language. §241's
  `HONESTY` gate fails a translation that swaps them.
- **A header must not wrap.** Both bars are `position: fixed` over a constant
  body padding, so a second line covers the first paragraph. Items are
  `nowrap`.

## Changing English text

1. Edit the English in the source (`src/*.js` for chrome, `explain.html` /
   `primer.html` for the pages).
2. Chrome: add the new English key to every `TABLES` entry that should carry it.
   Then run the coverage probe (below). It reports MISSING keys, and also keys
   whose display site never ran `t()` / `localizeTree()`.
3. Pages: re-extract keys (`--extract`), re-translate the invalidated blocks,
   then run `--check`.
4. If the page's English changed, re-merge `main` right before merging and wait
   for the Explainer check to be green on that head (see CLAUDE.md,
   Conventions: translations go stale without a line of them changing).
5. A new mechanism entry on `explain.html` also owes its Vocabulary-block links
   (`src/glossary-links.js`); `node tools/glossary-links.mjs` gates that.

## Adding a locale

The checklist below is read off §216 (Hungarian), which landed as two commits:
`7740c90` wired the locale in with empty placeholder tables, and `a36b966`
filled them. That split is worth copying. An empty table falls back to
English visibly, so the build never breaks on a missing module while the
translation runs.

### A. Wiring (the roster; can land with empty tables)

1. **`LOCALES` row in `src/i18n.js`** — `{ code, face, tag, match }`, plus `dir:
   'rtl'` only for right-to-left.
   - `face` is written in the language itself.
   - `code` is a VALUE: it travels in `?lang=`, `localStorage` and
     `documentElement.lang`, and is never translated.
   - `tag` is for number formatting only. **Measure** what Chromium and Node's
     ICU print for the tag (`30,0 · 0,024 · 18 000`) and record it in the row's
     comment. Region subtags change the decimal mark, and some languages need
     `-u-nu-latn` to keep Western digits.
   - `match` must be **anchored**, because three-letter codes collide with
     other languages (`hu` yes, `hup` Hupa no).
   - **Array position matters.** First match wins, so a script-subtag row
     (`zh-Hant`) goes above its bare language (`zh`).
2. **The ladder assert** in `src/i18n.js` (the table of
   `['hu-HU', 'hu']` / `['hup', null]` pairs): add the tags that must resolve
   to the new code, and the lookalikes that must resolve to nothing. This is
   what makes a reorder or a loose matcher loud.
3. **Placeholder tier-one table** — `const XX = {}` between
   `// §n XX TABLE START` / `END` markers, and a `TABLES` entry.
4. **Two page tables and two loaders** — `src/explain-i18n.<code>.js` and
   `src/primer-i18n.<code>.js` (copy an existing file's header), plus a
   `LOADERS` entry in each of `src/explain-i18n.js` and `src/primer-i18n.js`.
   Use a **literal** `import()` specifier. The stamper's module walk and the
   service-worker precache only see quoted strings.
5. **`tools/explain-i18n.mjs`** — a `MARKS` row (which characters the locale
   groups and points with; a missing row is a hard failure) and a `HONESTY`
   row (stems for *modelled* and *simulated*, held to the page's own glossary
   entry).
6. **Roster mirrors in tools**:
   - `tools/offline-check.mjs`: the locale list, and the expected precache
     count rises by two (one explainer table, one primer table).
   - `tools/probe-116-locale-fit.mjs`: the `--locales` default and the loop.
   - `tools/probe-249-vietnamese-vert.mjs`: a script entry if the language
     carries diacritics worth measuring (stacked marks, tall capitals).
7. **`explain.html` and `primer.html`** — if the script needs more line height
   than the base rule gives, add `html:lang(<code>)` to the shared selector
   list and cite the measurement.
8. **`tools/l10n-review/questions.mjs`** — a `QUESTIONS` entry. List the terms
   a workshop may dispute (each `term` must occur in the shipped tables), or
   `[]` to declare there were none. The review-packet builder fails without it.

Run the gates on the wired build before translating anything. They should
report the locale as empty, not crash.

**Staged landings are declared (§274).** A locale need not arrive with all
three surfaces. A `LOCALES` row may carry `surfaces: ['chrome']` or
`['chrome', 'primer']`; omitting the field means all three, which is what every
shipped row says. The chrome is always carried. The gates judge the declaration
both ways, with the judging in `tools/locale-surfaces.mjs`:

- a declared **primer** (the HUD's front door and the project's honesty
  framing) must be complete, and an empty table fails. The chrome is held
  complete by `probe-chrome-coverage`. These are the essential surfaces;
- a declared **explainer** may be partial. Its untranslated blocks are an
  allowed, stated gap: the check counts them in its report (`declared, partial
  — N of M block(s) untranslated`) and does not fail on them. An empty table
  still fails, because that is not a translation;
- an **undeclared** page's table must be **empty**. A half-finished page table
  under a page the row does not claim is stale and fails;
- an undeclared page renders English under a one-line notice in the locale's
  own chrome language, so its chrome table must carry the key
  `UNTRANSLATED_NOTICE` from `src/page-i18n.js` (the page check fails without
  it);
- a page with **no `LOADERS` entry** is how a locale does not carry it: do not
  create an empty table file, and do not list the locale in that page's
  `LOADERS` or in the offline precache count;
- declaring `primer` or `explainer` makes its `HONESTY` row mandatory (a
  declared locale with no row is UNGATED and fails);
- the review packet drops the sections for pages the locale does not carry.

Stage order for a new locale: wiring with the surfaces declared as
`['chrome']`, then the chrome, then declare `primer` and add its table, then
`explainer` last. Each stage can land alone. Say in the PR which surfaces the
row declares. **A locale with the chrome alone appears in the pickers** (the
owner's ruling): the pickers render every `LOCALES` row, so there is nothing to
wire, and the untranslated-page notice is what tells a reader the pages are
still English. No picker mark is built; add one only if looking at the notice
shows it is not enough.

**This is a guideline for documenting gaps, not a ratchet.** The point of
`surfaces` is that a gap is declared rather than owed silently. Today every
shipped explainer is 19 to 45 blocks short of the English (a later English
landing outran the tables; the CJK and Korean tables also leave 15 hidden
`.gloss-variants` rows English by design), and that is allowed and visible in
the check's report. Pinning those counts so they can only fall (an arrival
inventory, the `UNDECLARED_CLEARANCE_DEBT` pattern) is a sound later step, and
if it is built it should apply to the essential surfaces first. It is not
built.

### B. Translation (fills the three tables)

- Chrome: translate the English keys into `TABLES`. The key set to build from
  is an existing table's keys. That is also the blind spot: a key added since
  that table was built is in none of them, so the coverage probe finds it.
- Pages: `--extract` the keys, translate the blocks. Quoted identifiers stay
  in `<code>`. In agglutinative languages, put case endings OUTSIDE the span
  (`<code>X</code>-ban`).
- Digits spelled in words in English stay words in the translation. The number
  gate compares digit glyphs as a multiset outside `<code>`.
- `.gloss-variants` rows in the explainer's glossary list only the inflected
  forms the prose actually uses. Keep ambiguous forms out (the idiom problem
  §236 describes).
- Shorten plate labels that overrun their English box.

### C. Gates to run before opening the PR

```bash
node tools/probe-chrome-coverage.mjs        # every locale: MISSING / NOT APPLIED strings
node tools/explain-i18n.mjs --check         # all pages: keys, markup, <code>, numbers, honesty vocabulary
node tools/glossary-links.mjs               # Vocabulary links don't change the page's text
node tools/explain-quotes.mjs               # explainer constants still match src/*.js
node tools/l10n-review-packets.mjs --out DIR   # review sheet builds (needs the questions row)
node tools/probe-116-locale-fit.mjs         # chrome bar and HUD labels don't wrap (needs Playwright Chromium)
node tools/offline-check.mjs                # precache count and offline boot (needs Playwright Chromium)
```

The coverage probe and fit probe are not in a workflow, for the reason page
coverage is reported rather than gated, so run them by hand and paste the
numbers in the PR. The page checks run in `explain-i18n.yml`. The review sheet
is gated by the Explainer workflow and published at `/review/` on deploy.

### D. Record

- Claim a § number with `node tools/claim-item.mjs --namespace BUILT --title …`
  (and `--namespace TODO` for a debt item; see `docs/item-numbers/README.md`).
  Never reuse one.
- Add the landing to `docs/BUILT.md`. Include the measured number-format
  output, the chrome bar width, the HUD label numbers, and a "No native review
  pass" bullet naming the terms a workshop is likely to dispute. The review
  questions are drawn from that bullet.
- `CLAUDE.md` does not list locales; do not add one there.

## Native review

Every locale still owes a native review. The packet gives a reviewer the
English beside each translation, with a verdict and suggested wording per row.
It is built from the shipped tables, so it cannot lag them. Build it locally
with `tools/l10n-review-packets.mjs --out DIR`, or read the published sheet at
`/review/`.

## Known gaps in this guide

- The checklist is read off one landing. A locale with a new problem (a
  non-Latin script, a different plural system) will find steps this page does
  not have. Add them when you hit them.
- `ARCHITECTURE.md`'s module table still quotes line counts for `i18n.js` and
  the tier-two tables that the tables have long outgrown. Locale counts are
  gone from it and `README.md` (both now point at `LOCALES`); do not
  reintroduce one.
