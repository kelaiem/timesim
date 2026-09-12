// §212 — what Devanagari does to a line box that was sized for Latin.
//
// A REPORT, not an acceptance test. It answers one question: at each site the
// two pages size with `font: Npx/1`, how much ink does Hindi put outside the
// box, and what line-height would contain it? The `:lang(hi)` rule in
// explain.html / primer.html is derived from tier B's numbers and cites them.
//
// Why this exists at all. §208's one vertical finding was two Arabic
// diacritics pushing a label 2–3 px past the line beneath it, and the fix was
// to reword around them. Devanagari cannot be reworded around: vowel signs
// sit above the headline (ि ी े ो ौ ँ) and below the base (ु ू ृ), and a
// conjunct stacks. Every `/1` site in these pages was sized by eye for
// scripts that stay inside the em box, so the question is not "does any label
// overrun" but "by how much does the SCRIPT overrun, everywhere".
//
// THREE CONTROLS, because a vertical measurement is easy to pass while
// measuring nothing:
//
//   1. SHAPING. If the container has no Devanagari face, the browser draws
//      .notdef boxes whose metrics are uniform, plausible, and meaningless.
//      A real shaper forms क + ् + ष into ONE cluster narrower than the two
//      letters set apart; a cell font does not. The probe refuses to report
//      if that identity does not hold.
//   2. DISCRIMINATION. Latin uppercase at the same site must come back INSIDE
//      the box. A probe that calls everything an overrun has measured the box,
//      not the script.
//   3. THE FACE IS NAMED. The stacks name no Devanagari family, so the glyphs
//      come from whatever the system resolves — Mangal on Windows, Kohinoor on
//      macOS, Noto or FreeSans on Linux, and the extents differ per face. The
//      number this probe prints is the number for the face it names, and that
//      is a limit on the claim, not a footnote to it.
import { chromium } from 'playwright';

const FAIL = [];
const ok = (cond, label, detail = '') => {
  console.log(`  ${cond ? 'CONTROL PASS' : 'CONTROL FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) FAIL.push(label);
};

// The sites, as the two pages declare them (grep `font:` in explain.html).
const SITES = [
  { name: '.where / section stamp', css: '10px/1 ui-monospace, monospace' },
  { name: '.readout',               css: '11px/1 ui-monospace, monospace' },
  { name: 'chip · stamp · .num',    css: '10.5px/1 ui-monospace, monospace' },
  { name: 'svg .lbl (no line box)', css: '10px ui-monospace, monospace' },
  { name: 'svg .val (no line box)', css: '10.5px ui-monospace, monospace' },
];

// Hindi strings chosen to carry the extremes rather than to read well: matras
// above AND below, a candrabindu, and a stacked conjunct.
const HI = {
  above: 'ऊँची स्थिति',       // candrabindu + i/ii matras, all above the headline
  below: 'मुद्रु पूरु',        // u / uu / vocalic-r, all below the base
  both:  'क्षेत्रफल ऊँ मुद्रु',  // conjunct + both directions in one run
  real:  'एस्केपमेंट बैलेंस व्हील हेयरस्प्रिंग',  // the glossary's own loanwords
};
const EN = { upper: 'ESCAPEMENT BALANCE', mixed: 'Rings at 18,000 A/h pygj' };

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent('<canvas id=c></canvas>');

const face = await p.evaluate(() => {
  // Narrow the family that actually serves Devanagari by elimination. The trap
  // this guards is that an ABSENT family silently falls back, so it reports the
  // same width as the generic run and reads like a match. A deliberately
  // nonexistent family measures what "absent" looks like; anything equal to it
  // is absent, not agreeing.
  const c = document.getElementById('c').getContext('2d');
  const w = (fam) => { c.font = `10px ${fam}`; return +c.measureText('एस्केपमेंट').width.toFixed(2); };
  const generic = w('ui-monospace, monospace');
  const absent = w('"NoSuchDevanagariFace-zzz9", monospace');
  const named = {};
  for (const f of ['FreeSans', 'FreeSerif', 'Unifont', '"Noto Sans Devanagari"', 'Mangal', 'Kohinoor Devanagari'])
    named[f] = { w: w(`${f}, monospace`), present: document.fonts.check(`10px ${f}`) };
  return { generic, absent, named };
});

const shaping = await p.evaluate(() => {
  const c = document.getElementById('c').getContext('2d');
  const w = (s) => { c.font = '10px ui-monospace, monospace'; return +c.measureText(s).width.toFixed(2); };
  // क + ् + ष shapes to one cluster; the same letters held apart by ZWJ do not.
  return { cluster: w('क्ष'), apart: w('क‍ष'), ka: w('क') };
});

const measure = await p.evaluate(({ SITES, HI, EN }) => {
  const c = document.getElementById('c').getContext('2d');
  const ink = (css, s) => {
    c.font = css.replace(/\/[\d.]+/, '');          // TextMetrics ignores line-height
    const m = c.measureText(s);
    return { asc: +m.actualBoundingBoxAscent.toFixed(2), desc: +m.actualBoundingBoxDescent.toFixed(2) };
  };
  const size = (css) => parseFloat(css);
  const out = [];
  for (const site of SITES) {
    const px = size(site.css);
    const box = /\/1\b/.test(site.css) ? px : null;  // a `/1` site has a box of exactly Npx
    const row = { site: site.name, px, box, hi: {}, en: {} };
    for (const [k, s] of Object.entries(HI)) row.hi[k] = ink(site.css, s);
    for (const [k, s] of Object.entries(EN)) row.en[k] = ink(site.css, s);
    out.push(row);
  }
  return out;
}, { SITES, HI, EN });

await b.close();

console.log('\n══ §212 — Devanagari ink against boxes sized for Latin\n');
console.log('(a) the face actually serving the Devanagari run, by advance width at 10px');
console.log(`    generic (ui-monospace, monospace): ${face.generic}`);
console.log(`    a family that does NOT exist:      ${face.absent}   ← this is what "absent" measures`);
const serving = [];
for (const [f, m] of Object.entries(face.named)) {
  const absent = Math.abs(m.w - face.absent) < 0.01;
  const serves = !absent && Math.abs(m.w - face.generic) < 0.75;
  if (serves) serving.push(f);
  console.log(`    ${f.padEnd(26)} ${String(m.w).padStart(6)}  ${absent ? 'ABSENT (fell back)' : m.present ? 'present' : 'present?'}` +
              `${serves ? '   ← serves the generic run' : ''}`);
}
console.log(`    → the numbers below are ${serving.length === 1 ? `this face's: ${serving[0]}` : `AMBIGUOUS between ${serving.join(', ') || 'no identified face'}`}`);
console.log('\n(b) controls');
ok(shaping.cluster < shaping.apart - 1, 'Devanagari is SHAPED, not drawn as cells',
   `क्ष ${shaping.cluster} < क+ZWJ+ष ${shaping.apart} (क alone ${shaping.ka})`);
ok(serving.length === 1, 'exactly one installed face serves the run, so the numbers have an owner',
   serving.length ? serving.join(', ') : 'none identified');

console.log('\n(c) ink above and below the baseline, per site (px)\n');
console.log('    site                        box   EN asc/desc    HI asc/desc   ink    over   needs');
let worst = 0, worstSite = '';
for (const r of measure) {
  const hiAsc = Math.max(...Object.values(r.hi).map((v) => v.asc));
  const hiDesc = Math.max(...Object.values(r.hi).map((v) => v.desc));
  const enAsc = Math.max(...Object.values(r.en).map((v) => v.asc));
  const enDesc = Math.max(...Object.values(r.en).map((v) => v.desc));
  const inkH = +(hiAsc + hiDesc).toFixed(2);
  const over = r.box === null ? null : +(inkH - r.box).toFixed(2);
  const needs = r.box === null ? null : +(inkH / r.px).toFixed(3);
  if (over !== null && over > worst) { worst = over; worstSite = r.site; }
  console.log(
    `    ${r.site.padEnd(26)} ${String(r.box ?? '—').padStart(4)}   ` +
    `${String(enAsc).padStart(4)}/${String(enDesc).padEnd(4)}   ` +
    `${String(hiAsc).padStart(5)}/${String(hiDesc).padEnd(4)}  ${String(inkH).padStart(5)}  ` +
    `${over === null ? '   —' : String(over).padStart(5)}  ${needs === null ? '  —' : needs}`);
  if (r.box !== null) {
    ok(enAsc + enDesc <= r.box, `${r.site}: Latin stays INSIDE its box`,
       `${(enAsc + enDesc).toFixed(2)} ≤ ${r.box}`);
  }
}

const boxed = measure.filter((r) => r.box !== null);
const need = Math.max(...boxed.map((r) => (Math.max(...Object.values(r.hi).map((v) => v.asc))
  + Math.max(...Object.values(r.hi).map((v) => v.desc))) / r.px));
console.log(`\n(d) the derivation`);
console.log(`    worst overrun ${worst} px, at "${worstSite}"`);
console.log(`    every boxed site is contained by line-height ≥ ${need.toFixed(3)} — round UP to ${(Math.ceil(need * 20) / 20).toFixed(2)}`);
console.log(`    the two SVG sites have NO line box (text is baseline-positioned), so`);
console.log(`    they cannot overflow one; what they can do is collide with a neighbour,`);
console.log(`    which is explain-i18n --check's plate-fit pass, not this probe's.`);

console.log(`\n${FAIL.length ? `CONTROLS FAILED (${FAIL.length}) — the numbers above are not evidence` : 'controls pass — the numbers above are for the face named in (a)'}`);
process.exit(FAIL.length ? 1 : 0);
