#!/usr/bin/env node
// §73 tier two — DOES THE EXPLAINER STILL QUOTE THE SOURCE?
//
// explain.html's header promises "values quoted from src/*.js", and CLAUDE.md
// makes the page part of a §'s reconciliation when a constant moves. Until
// now that promise was kept by discipline: nothing compared the page's numbers
// to the source's. This is that promise as an exit code — the same move
// ci-battery.mjs made for standing rule 4.
//
// It reads BOTH sides statically (no browser, under a second):
//
//   source  every `const NAME = …` in src/*.js, including multi-declarations
//           (`const A = 30, B = 8;`). Literals are taken directly; expressions
//           are resolved ONLY when every identifier in them is already known
//           (so ALARM_PIN_DROP + CLEAR_MARGIN resolves, but anything reaching
//           into geometry does not).
//   page    every `<code>NAME = 1.23</code>`, `<code>NAME</code> 1.23`, the
//           feeler table's NAME|VALUE rows, and bare `NAME 1.23` in plates.
//
// DEGREES ARE NOT A DISAGREEMENT. A plate says `GONG_A1 135°` where the source
// holds radians; the comparison accepts a degree reading when it matches after
// conversion, and SAYS so, rather than reporting a false drift that would
// train the next reader to ignore this tool.
//
// Tolerance is 0.5% — the page rounds for display (0.37894… quoted as 0.379).
// A constant that genuinely moved will blow past that; a re-rounding will not.
//
// Exit 0 only when no comparable claim disagrees. Un-comparable claims are
// REPORTED, never silently passed: an instrument that hides what it cannot
// see teaches you to trust it further than it deserves.
//
// §95 — THE SAME INSTRUMENT ENFORCES THE OPPOSITE RULE NEXT DOOR. primer.html
// is the novice page, and its header promises the inverse contract: rounded
// quantities with units, NO source identifiers. "Stays out of this gate by
// construction" is only true while something checks the construction, so the
// primer is scanned with the same claim extractors as explain.html plus a
// source-identifier sweep (every SCREAMING_SNAKE token, and every ALL-CAPS
// name src/*.js declares), and the required count is ZERO. An instrument
// asserting an empty set is still an instrument.
//
// Usage: node tools/explain-quotes.mjs [--verbose]
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const VERBOSE = process.argv.includes('--verbose');
const TOL = 0.005;                    // 0.5% — display rounding, not drift
const DEG2RAD = Math.PI / 180;

// Names that look like constants but are page furniture, not source symbols.
const STOP = new Set(['PLATE', 'TODO', 'TABLE', 'BUILT', 'GPa']);

// ---- source ---------------------------------------------------------------
const lit = new Map();                // name -> { value, file }
const declared = new Map();           // every declared name, resolved or not
const pending = [];                   // [{ name, rhs, file }] awaiting resolution
for (const f of readdirSync(SRC).filter((x) => x.endsWith('.js'))) {
  const text = readFileSync(join(SRC, f), 'utf8');
  for (const m of text.matchAll(/^\s*(?:export\s+)?(?:const|let|var)\s+(.+?);\s*(?:\/\/.*)?$/gm)) {
    // one declaration statement may carry several bindings: A = 1, B = 2
    for (const part of m[1].split(/,(?![^(]*\))/)) {
      const b = part.match(/^\s*([A-Za-z_$][\w$]*)\s*=\s*(.+?)\s*$/);
      if (!b) continue;
      const [, name, rhs] = b;
      if (lit.has(name)) continue;
      const n = rhs.match(/^(-?\d+(?:\.\d+)?)$/);
      declared.set(name, { rhs, file: f });
      if (n) lit.set(name, { value: parseFloat(n[1]), file: f });
      else pending.push({ name, rhs, file: f });
    }
  }
}
// Resolve expressions over already-known names, to a fixed point. The guard is
// deliberately narrow: arithmetic, parentheses, Math.PI, and identifiers we
// have already resolved — anything else stays un-comparable by construction.
lit.set('Math.PI', { value: Math.PI, file: '(builtin)' });
for (let pass = 0; pass < 6; pass++) {
  let progress = false;
  for (const p of pending.slice()) {
    if (lit.has(p.name)) continue;
    const idents = [...p.rhs.matchAll(/[A-Za-z_$][\w$.]*/g)].map((x) => x[0]);
    if (!idents.every((id) => lit.has(id))) continue;
    if (!/^[\w\s.+\-*/()]+$/.test(p.rhs)) continue;
    let expr = p.rhs;
    for (const id of [...new Set(idents)].sort((a, b) => b.length - a.length))
      expr = expr.split(id).join(`(${lit.get(id).value})`);
    let v;
    try { v = Function(`"use strict";return (${expr});`)(); } catch { continue; }
    if (typeof v === 'number' && isFinite(v)) { lit.set(p.name, { value: v, file: p.file, derived: p.rhs }); progress = true; }
  }
  if (!progress) break;
}

// ---- page -----------------------------------------------------------------
const page = readFileSync(join(ROOT, 'explain.html'), 'utf8');
const claims = [];
const add = (name, value, deg, ctx) => {
  if (STOP.has(name)) return;
  claims.push({ name, value: parseFloat(value), deg: !!deg, ctx: ctx.replace(/\s+/g, ' ').slice(0, 76) });
};
for (const m of page.matchAll(/<code>([A-Za-z_][\w]{2,})\s*=\s*(-?\d+(?:\.\d+)?)\s*(°)?\s*(?:rad|mm|u)?\s*<\/code>/g)) add(m[1], m[2], m[3], m[0]);
for (const m of page.matchAll(/<code>([A-Z_][A-Z0-9_]{2,})<\/code>\s*(-?\d+(?:\.\d+)?)\s*(°)?/g)) add(m[1], m[2], m[3], m[0]);
for (const m of page.matchAll(/<code>([A-Z_][A-Z0-9_]{2,})<\/code>\s*<\/td>\s*<td[^>]*>\s*(-?\d+(?:\.\d+)?)/g)) add(m[1], m[2], null, m[0]);
for (const m of page.matchAll(/\b([A-Z][A-Z0-9_]{3,})\s+(-?\d+(?:\.\d+)?)\s*(°)?/g)) add(m[1], m[2], m[3], m[0]);

// ---- compare --------------------------------------------------------------
const seen = new Set(), agree = [], asDeg = [], bad = [], noDef = [], opaque = [];
for (const c of claims) {
  const k = `${c.name}=${c.value}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const d = lit.get(c.name);
  // A name the source DECLARES but whose value needs geometry to know is a
  // different situation from a name the source has never heard of, and the
  // report keeps them apart — collapsing them would train the reader to skim
  // past the line that actually matters.
  if (!d) { (declared.has(c.name) ? opaque : noDef).push({ ...c, decl: declared.get(c.name) }); continue; }
  const near = (a, b) => Math.abs(a - b) < 1e-9 || Math.abs(a - b) <= Math.abs(b) * TOL;
  if (near(c.value, d.value)) agree.push({ ...c, src: d });
  else if (near(c.value * DEG2RAD, d.value)) asDeg.push({ ...c, src: d });
  else bad.push({ ...c, src: d });
}
console.log(`source: ${lit.size} constants resolved from src/*.js (literals + derived)`);
console.log(`page:   ${seen.size} distinct numeric claims in explain.html\n`);
console.log(`agrees                 : ${agree.length}`);
console.log(`agrees (page in degrees): ${asDeg.length}`);
for (const r of asDeg) console.log(`     ${r.name}: page ${r.value}° = ${(r.value * DEG2RAD).toFixed(4)} rad, source ${r.src.value.toFixed(4)}`);
console.log(`declared, not statically comparable: ${opaque.length}  (value needs geometry — check by hand when it moves)`);
for (const r of opaque) console.log(`     ${r.name}: page says ${r.value}${r.deg ? '°' : ''}, source = ${r.decl.rhs.slice(0, 52)}  (${r.decl.file})`);
console.log(`no source definition   : ${noDef.length}  (prose names, or renamed — reported, not passed)`);
for (const r of noDef) console.log(`     ${r.name} ${r.value}   ${r.ctx}`);
console.log(`DISAGREES              : ${bad.length}${bad.length ? '  <-- the page and the source have drifted apart' : ''}`);
for (const r of bad) {
  const via = r.src.derived ? `  [${r.src.derived}]` : '';
  console.log(`     ${r.name}: page says ${r.value}, source says ${r.src.value}  (${r.src.file})${via}\n         ${r.ctx}`);
}
if (VERBOSE) for (const r of agree) console.log(`     ok  ${r.name} = ${r.value}  (${r.src.file}${r.src.derived ? ' — ' + r.src.derived : ''})`);

// ---- primer (§95): the identifier-FREE page ------------------------------
// The same extractors that find claims on explain.html must find NOTHING on
// primer.html — plus a broader sweep, because on the primer an identifier is
// a violation even without a number beside it: any SCREAMING_SNAKE token, and
// any ALL-CAPS name the source declares (STOP-listed page furniture like
// PLATE excepted, same as above).
// THE PAGE AS A READER SEES IT, not the file. §95 tier two gave the primer a
// module script (it localizes like the explainer), and `import { UI_LANG }`
// tripped this scan immediately — correctly, by the letter of "no identifier
// appears in primer.html", and wrongly by its meaning: the promise in the
// page's header is about what the page SAYS. A module's own machinery is not
// a claim, and a <style> block is not prose.
//
// So markup and text are scanned whole, while a script contributes only its
// STRING LITERALS — which is precisely the part of a script a reader can end
// up looking at, since that is what a plate would write into the DOM. Strip
// scripts entirely and this gate would go blind exactly when the primer gains
// its first interactive plate.
const primer = (() => {
  const raw = readFileSync(join(ROOT, 'primer.html'), 'utf8');
  return raw
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, (block) => {
      // COMMENTS COME OUT FIRST, and that is not tidiness. An apostrophe in
      // English prose — "rich blocks' innerHTML" — opens a phantom string
      // literal that runs to the next quote and drags real code in with it,
      // which is exactly how this scan reported `UI_LANG` from a line it was
      // supposed to have dropped. Line comments are only stripped at line
      // START, so a '//' inside a URL literal survives.
      const code = block
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' ');
      return (code.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []).join(' ');
    });
})();
const pClaims = [];
const pAdd = (name, ctx) => { if (!STOP.has(name)) pClaims.push({ name, ctx: ctx.replace(/\s+/g, ' ').slice(0, 76) }); };
for (const m of primer.matchAll(/<code>([A-Za-z_][\w]{2,})\s*=\s*(-?\d+(?:\.\d+)?)\s*(°)?\s*(?:rad|mm|u)?\s*<\/code>/g)) pAdd(m[1], m[0]);
for (const m of primer.matchAll(/<code>([A-Z_][A-Z0-9_]{2,})<\/code>/g)) pAdd(m[1], m[0]);
for (const m of primer.matchAll(/\b([A-Z][A-Z0-9_]{3,})\s+(-?\d+(?:\.\d+)?)/g)) pAdd(m[1], m[0]);
const srcCaps = new Set([...declared.keys()].filter((n) => /^[A-Z][A-Z0-9_]{2,}$/.test(n) && !STOP.has(n)));
for (const m of primer.matchAll(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b[A-Z][A-Z0-9]{2,}\b/g)) {
  const name = m[0];
  if (name.includes('_') ? !STOP.has(name) : srcCaps.has(name))
    pAdd(name, primer.slice(Math.max(0, m.index - 30), m.index + name.length + 30));
}
const pSeen = new Set();
const pBad = pClaims.filter((c) => !pSeen.has(c.name + '|' + c.ctx) && pSeen.add(c.name + '|' + c.ctx));
console.log(`\nprimer: ${pBad.length} identifier claim(s) in primer.html (contract: 0)${pBad.length ? '  <-- the primer quotes no source identifiers, by its own header' : ''}`);
for (const r of pBad) console.log(`     ${r.name}   ${r.ctx}`);

const failed = bad.length + pBad.length;
console.log(failed
  ? `\nFAIL — ${bad.length ? 'reconcile explain.html with the source (CLAUDE.md: the source is right)' : ''}${bad.length && pBad.length ? '; ' : ''}${pBad.length ? 'strip the identifier(s) from primer.html or say it in quantities' : ''}`
  : '\nPASS — every comparable quoted value matches src/*.js, and primer.html quotes no identifiers');
process.exit(failed ? 1 : 0);
