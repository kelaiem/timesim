// §249 (Vietnamese) — what stacked tone marks do to a line box sized for Latin.
//
// A REPORT, not an acceptance test: it exits non-zero only when a CONTROL
// fails, because then its numbers are not evidence. It answers one question,
// §212's question asked of a second script: at each site the pages and the
// chrome size with `font: Npx/1`, how much ink does Vietnamese put outside the
// box, and what line-height would contain it?
//
// Why it is not obviously the same answer as Hindi's. Vietnamese is Latin, so
// lowercase sits inside the box like English does — until a vowel carries TWO
// marks. A circumflex or breve plus a tone mark stacks above the x-height (ế,
// ở, ữ, ặ), and the dot-below tone sits under the baseline (ạ, ệ, ộ). On an
// UPPERCASE run the stack lands on top of the cap height (Ế, Ữ, Ặ), and the
// plates' `.lbl` class forces uppercase. §208 reworded around two Arabic
// diacritics; Vietnamese cannot drop a mark, because a word without its tone
// is a different word.
//
// THREE CONTROLS, §212's three translated to this script:
//
//   1. THE GLYPHS ARE THE FACE'S OWN. A face with no precomposed Vietnamese
//      falls back PER CHARACTER, so a run is drawn in two faces with two sets
//      of metrics and the ink measured is a mixture. At a MONOSPACE site the
//      test is exact: a monospace face that carries ế gives it the advance of
//      e. A fallback to a proportional face does not.
//   2. DISCRIMINATION. Latin uppercase at the same site must come back INSIDE
//      the box. A probe that calls everything an overrun measured the box.
//   3. THE FACE IS NAMED, by elimination against a family that does not exist
//      (an absent family silently falls back and reads like a match). The
//      number printed is the number for that face; DejaVu, Segoe UI, SF and
//      Noto differ, and that is a limit on the claim, not a footnote.
//
// Usage: node tools/probe-249-vietnamese-vert.mjs   (needs a Playwright Chromium)
import { chromium } from 'playwright';

const FAIL = [];
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'CONTROL PASS' : 'CONTROL FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) FAIL.push(label);
};

// The `/1` sites, as the documents declare them (grep `font: .*px/1` in
// explain.html, primer.html and src/main.js), plus the two SVG sites that have
// no line box at all. `upper` marks a site whose CSS uppercases its text.
const SITES = [
  { name: 'summary .where',          css: '10px/1 ui-monospace, monospace' },
  { name: '.fig-no',                 css: '10px/1 ui-monospace, monospace', upper: false },
  { name: '.readout · #gloss-back',  css: '11px/1 ui-monospace, monospace' },
  { name: 'header .stamp · .chip',   css: '10.5px/1 ui-monospace, monospace' },
  // The 3D part labels: a `/1` box, but inside a PILL with 2px of padding
  // above and below, so ink up to 2px out stays on the label's own ground.
  // (The chrome's third `/1` site, .hud-rock-end, holds only "+" and "−" —
  // no word ever reaches it, so it is not a site for this question.)
  { name: 'chrome .clock-label',     css: '11px/1 -apple-system, sans-serif', pad: 2 },
  { name: 'svg .lbl (no line box)',  css: '10px ui-monospace, monospace', upper: true },
  { name: 'svg .val (no line box)',  css: '10.5px ui-monospace, monospace' },
];

// Strings chosen to carry the extremes rather than to read well, then the
// glossary's own words, in both cases because the plates uppercase.
const VI = {
  stackLower: 'ế ở ữ ặ ỗ ẫ',       // two marks above the x-height
  stackUpper: 'Ế Ở Ữ Ặ Ỗ Ẫ',       // the same stack above the CAP height
  below:      'ạ ệ ộ ụ ỵ Ạ Ộ',     // dot below the baseline
  real:       'bánh xe thoát · dây tóc · ngựa · bánh xe trung tâm',
  realUpper:  'BÁNH XE THOÁT · DÂY TÓC · NGỰA · TRỤC CÂN BẰNG',
};
const EN = { upper: 'ESCAPEMENT BALANCE', mixed: 'Rings at 18,000 A/h pygj' };

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent('<canvas id=c></canvas>');

const face = await p.evaluate(() => {
  const c = document.getElementById('c').getContext('2d');
  const w = (fam, s) => { c.font = `10px ${fam}`; return +c.measureText(s).width.toFixed(3); };
  const S = 'Ế Ở Ữ Ặ bánh xe thoát';
  const out = {};
  // The fallback behind each named family is CURSIVE, deliberately unlike
  // both generics: an absent family then measures as cursive, and cannot
  // pass for the monospace or sans face it is being compared against.
  // (Falling back to the generic itself is the trap — absent and present
  // would measure identically.)
  for (const [label, generic] of [['mono', 'ui-monospace, monospace'], ['sans', '-apple-system, sans-serif']]) {
    const absent = w('"NoSuchVietFace-zzz9", cursive', S);
    const named = {};
    for (const f of ['"DejaVu Sans Mono"', '"Liberation Mono"', 'FreeMono', '"DejaVu Sans"', '"Liberation Sans"', 'FreeSans'])
      named[f] = w(`${f}, cursive`, S);
    out[label] = { generic: w(generic, S), absent, named };
  }
  // Control 1: per-glyph advance at a monospace site. Every precomposed vowel
  // must have the advance of its base letter, or the run fell back.
  c.font = '10px ui-monospace, monospace';
  const adv = (s) => c.measureText(s).width;
  const pairs = [['ế', 'e'], ['ở', 'o'], ['ữ', 'u'], ['ặ', 'a'], ['Ế', 'E'], ['Ữ', 'U'], ['ạ', 'a'], ['ỵ', 'y']];
  out.mono.advance = pairs.map(([v, base]) => ({ v, base, dv: +adv(v).toFixed(3), db: +adv(base).toFixed(3) }));
  return out;
});

const measure = await p.evaluate(({ SITES, VI, EN }) => {
  const c = document.getElementById('c').getContext('2d');
  const ink = (css, s) => {
    c.font = css.replace(/\/[\d.]+/, '');          // TextMetrics ignores line-height
    const m = c.measureText(s);
    return { asc: +m.actualBoundingBoxAscent.toFixed(2), desc: +m.actualBoundingBoxDescent.toFixed(2) };
  };
  return SITES.map((site) => {
    const px = parseFloat(site.css);
    const box = /\/1\b/.test(site.css) ? px : null;
    const row = { site: site.name, px, box, vi: {}, en: {} };
    for (const [k, s] of Object.entries(VI)) row.vi[k] = ink(site.css, s);
    for (const [k, s] of Object.entries(EN)) row.en[k] = ink(site.css, s);
    return row;
  });
}, { SITES, VI, EN });
await b.close();

console.log('\n══ §249 — Vietnamese tone marks against boxes sized for Latin\n');
console.log('(a) the face serving each generic stack, by advance width at 10px');
const owners = {};
for (const [label, f] of Object.entries(face)) {
  console.log(`    ${label}: generic ${f.generic} · a family that does NOT exist ${f.absent}`);
  const serving = [];
  for (const [name, w] of Object.entries(f.named)) {
    const absent = Math.abs(w - f.absent) < 0.01;
    const serves = !absent && Math.abs(w - f.generic) < 0.01;
    if (serves) serving.push(name);
    console.log(`      ${name.padEnd(20)} ${String(w).padStart(8)}${absent ? '  ABSENT (fell back)' : ''}${serves ? '   ← serves the generic run' : ''}`);
  }
  owners[label] = serving;
}

console.log('\n(b) controls');
const mis = face.mono.advance.filter((r) => Math.abs(r.dv - r.db) > 0.001);
ok(mis.length === 0, 'every precomposed vowel takes its base letter\'s advance at a monospace site — the face carries Vietnamese, no per-glyph fallback',
   mis.length ? mis.map((r) => `${r.v} ${r.dv} vs ${r.base} ${r.db}`).join('; ') : `${face.mono.advance.length} pairs equal`);
ok(Object.values(face).every((f) => Math.abs(f.generic - f.absent) > 0.01),
   'an absent family measures DIFFERENTLY from both generics, so "serves" below can mean something');
for (const [label, s] of Object.entries(owners))
  ok(s.length === 1, `exactly one installed face serves the ${label} stack`, s.join(', ') || 'none identified');

console.log('\n(c) ink above and below the baseline, per site (px)\n');
console.log('    site                       box   EN asc/desc    VI asc/desc   ink    over   needs');
let worst = 0, worstSite = '';
for (const r of measure) {
  const viAsc = Math.max(...Object.values(r.vi).map((v) => v.asc));
  const viDesc = Math.max(...Object.values(r.vi).map((v) => v.desc));
  const enAsc = Math.max(...Object.values(r.en).map((v) => v.asc));
  const enDesc = Math.max(...Object.values(r.en).map((v) => v.desc));
  const inkH = +(viAsc + viDesc).toFixed(2);
  const over = r.box === null ? null : +(inkH - r.box).toFixed(2);
  const needs = r.box === null ? null : +(inkH / r.px).toFixed(3);
  if (over !== null && over > worst) { worst = over; worstSite = r.site; }
  console.log(`    ${r.site.padEnd(25)} ${String(r.box ?? '—').padStart(4)}   ` +
    `${String(enAsc).padStart(5)}/${String(enDesc).padEnd(5)}  ${String(viAsc).padStart(5)}/${String(viDesc).padEnd(5)} ${String(inkH).padStart(5)}  ` +
    `${over === null ? '    —' : String(over).padStart(5)}  ${needs === null ? '  —' : needs}`);
  if (r.box !== null) ok(enAsc + enDesc <= r.box + 0.01, `${r.site}: Latin stays INSIDE its box`, `${(enAsc + enDesc).toFixed(2)} ≤ ${r.box}`);
  const site = SITES.find((x) => x.name === r.site);
  if (site.pad && over !== null) console.log(`      ${over <= 2 * site.pad ? 'inside' : 'OUTSIDE'} its ${site.pad}px padding (${over}px over the line box)`);
}
const boxed = measure.filter((r) => r.box !== null && !SITES.find((x) => x.name === r.site).pad);
const per = (r, keys) => (Math.max(...keys.map((k) => r.vi[k].asc)) + Math.max(...keys.map((k) => r.vi[k].desc))) / r.px;
const needAll = Math.max(...boxed.map((r) => per(r, Object.keys(VI))));
const needLower = Math.max(...boxed.map((r) => per(r, ['stackLower', 'below', 'real'])));
console.log('\n(d) the derivation');
console.log(`    worst overrun ${worst} px, at "${worstSite}" (padded sites included; the derivation below excludes them)`);
console.log(`    every boxed site is contained by line-height ≥ ${needAll.toFixed(3)} (uppercase included) — round UP to ${(Math.ceil(needAll * 20) / 20).toFixed(2)}`);
console.log(`    lowercase and dot-below only: ≥ ${needLower.toFixed(3)} — round UP to ${(Math.ceil(needLower * 20) / 20).toFixed(2)}`);
console.log('    the SVG sites have NO line box; what they can do is collide with a');
console.log('    neighbour, which is explain-i18n --check\'s plate-fit pass, not this probe\'s.');
console.log(`\n${FAIL.length ? `CONTROLS FAILED (${FAIL.length}) — the numbers above are not evidence` : 'controls pass — the numbers above are for the faces named in (a)'}`);
process.exit(FAIL.length ? 1 : 0);
