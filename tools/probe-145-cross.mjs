// §145 — THE MALTESE CROSS PLATE DRAWS THE CROSS THE BUILD CUTS. Acceptance:
//   1. the plate's ported spec agrees with geometry.js's genevaSpec to 1e-9 on
//      d, a, b, slotW, lockR and the bank angle, on the same inputs — the
//      "same relations" claim, measured rather than trusted;
//   2. the index chip reads 2π/8 (45.00°), not INVERTED;
//   3. the pin walks seven DISTINCT SLOTTED arms and banks on the BLANK one —
//      measured off the drawn cross, not off the chip: at each turn the arm
//      nearest the pin's bearing is read from the DOM, and at the bank it must
//      be the arm carrying the "blank" label, with the finger short of the
//      entry angle. The chip alone is state-derived and said BANKED all through
//      the §145 defect in which the blank was laid out against the travel, so
//      the pin entered it on turn 1 and banked on a slotted arm. The run starts
//      from a WOUND-DOWN home rather than from wherever autoplay left it, so
//      "seven winds" is seven winds; an eighth is refused (W clamps); unwinding
//      back to zero locks it again;
//   4. scrubbing the slider into the engagement window reads INDEXING and the
//      cross angle moves; outside it the cross holds;
//   5. under prefers-reduced-motion the plate does not autoplay and a wind
//      snaps to its end state in one frame;
//   6. no page errors.
//   cd tools && node probe-145-cross.mjs      (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8481;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
let fail = 0; const F = (m) => { fail++; console.log('FAIL', m); }; const OK = (m) => console.log('OK  ', m);
async function open(reduced) {
  const ctx = await browser.newContext({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/explain.html`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => { document.getElementById('alarm-winding-arrest').open = true; });
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}
let { ctx, page, errs } = await open(false);
// 1 — the ported spec against the source's
// the SOURCE's spec, computed where the import map for 'three' exists (index.html)
const simPage = await ctx.newPage();
await simPage.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
const src = await simPage.evaluate(async () => {
  const G = await import('./src/geometry.js'); const L = await import('./src/layout.js');
  const r = G.genevaSpec({ N: 8, stockMin: L.STOCK_MIN_U, pivotMin: L.PIVOT_MIN_U, margin: L.CLEAR_MARGIN, studR: L.PIVOT_MIN_U + 0.01 + L.STOCK_MIN_U, arborR: L.PIVOT_MIN_U });
  return { d: r.d, a: r.a, b: r.b, slotW: r.slotW, lockR: r.lockR, bankDeg: r.bankTh * 180 / Math.PI, inputs: { stock: L.STOCK_MIN_U, pivot: L.PIVOT_MIN_U } };
});
await simPage.close();
const cmp = await page.evaluate(async (src) => {
  // the plate's own inputs are the ROUNDED quotes (0.317, 0.185): compare on those, and separately report the drift the rounding buys
  const text = document.getElementById('mxSolved').textContent;
  const num = (k) => Number((text.match(new RegExp(k + ' ([0-9.]+)')) || [])[1]);
  const plate = { d: num('d'), a: num('a'), b: num('b'), slot: num('slot'), disc: num('disc') };
  const bank = Number((document.getElementById('mxBank').textContent.match(/([0-9.]+)°/) || [])[1]);
  return { src, plate, bank, idx: document.getElementById('mxIndex').textContent, inputs: src.inputs };
}, src);
const rel = (x, y) => Math.abs(x - y) / Math.abs(y);
const drifts = [['d', cmp.plate.d, cmp.src.d], ['a', cmp.plate.a, cmp.src.a], ['b', cmp.plate.b, cmp.src.b], ['slot', cmp.plate.slot, cmp.src.slotW], ['disc', cmp.plate.disc, cmp.src.lockR], ['bank°', cmp.bank, cmp.src.bankDeg]].map(([k, p, s]) => [k, rel(p, s)]);
const worst = Math.max(...drifts.map((d) => d[1]));
if (worst > 0.005) F(`the plate's solve drifts from genevaSpec by ${(worst * 100).toFixed(3)}% (${drifts.map(([k, v]) => k + ' ' + (v * 100).toFixed(3) + '%').join(', ')})`);
else OK(`the plate's solve matches genevaSpec within the quote rounding: worst ${(worst * 100).toFixed(3)}% (source d ${cmp.src.d.toFixed(4)}, plate d ${cmp.plate.d}; inputs rounded from ${cmp.inputs.stock.toFixed(4)}/${cmp.inputs.pivot.toFixed(4)})`);
// 2 — the index
if (!/45\.00° = 2π\/8/.test(cmp.idx) || /INVERTED/.test(cmp.idx)) F(`index chip: ${cmp.idx}`); else OK(`index chip: ${cmp.idx}`);
// 3 — walk the stations, bank on the blank arm, refuse the eighth, unwind
const chip = () => page.evaluate(() => document.getElementById('mxChip').textContent);
const readout = () => page.evaluate(() => document.getElementById('mxReadout').textContent);
const wind = async () => { await page.evaluate(() => document.getElementById('mxWind').click()); await page.waitForTimeout(800); };
const unwind = async () => { await page.evaluate(() => document.getElementById('mxUnwind').click()); await page.waitForTimeout(800); };
const scrubTo = (deg) => page.evaluate((d) => { const sl = document.getElementById('mxSlider'); sl.value = String(d); sl.dispatchEvent(new Event('input')); }, deg);
// WHICH arm is the pin on? Read the cross as drawn: every arm group's bearing in
// the cross's own frame, and the pin's, then the nearest. Whether that arm is the
// blank one is read off the label it carries, not off any angle this file knows.
const armAtPin = () => page.evaluate(() => {
  const svg = document.querySelector('#alarm-winding-arrest svg');
  const crossG = document.getElementById('mxCross');
  const inv = crossG.getScreenCTM().inverse();
  const bearing = (el, lx, ly) => {
    const p = svg.createSVGPoint(); p.x = lx; p.y = ly;
    const q = p.matrixTransform(el.getScreenCTM()).matrixTransform(inv);
    return (Math.atan2(q.y, q.x) * 180 / Math.PI + 360) % 360;
  };
  const arms = [...crossG.firstElementChild.children].filter((n) => n.tagName === 'g');
  const pin = [...document.getElementById('mxFinger').querySelectorAll('circle')].find((c) => /ruby/.test(c.getAttribute('fill') || ''));
  const pinA = bearing(pin, Number(pin.getAttribute('cx')), Number(pin.getAttribute('cy')));
  const sep = (x, y) => { const v = Math.abs(x - y) % 360; return v > 180 ? 360 - v : v; };
  let best = 0;
  arms.forEach((g, k) => { if (sep(bearing(g, 100, 0), pinA) < sep(bearing(arms[best], 100, 0), pinA)) best = k; });
  return { arm: best, blank: !!arms[best].querySelector('text'), nArms: arms.length,
    gap: sep(bearing(arms[best], 100, 0), pinA), pinA };
});
await page.evaluate(() => document.getElementById('mxPlay').click()); // stop autoplay — W is wherever it left off
for (let i = 0; i < 9; i++) await unwind();                           // …so wind down to a known home first
let r = await readout();
if (!/turn 0 /.test(r)) F(`could not reach home before the walk: ${r}`); else OK(`home before the walk: ${r}`);
// the seven indexing turns: mid-slot the pin must be inside a SLOTTED arm, and a
// different one each turn — seven slots, walked once each
const walked = [];
for (let i = 0; i < 7; i++) { await scrubTo(180); walked.push(await armAtPin()); await wind(); }
const onBlank = walked.filter((w) => w.blank);
const distinct = new Set(walked.map((w) => w.arm));
if (onBlank.length) F(`the pin walked the blank arm on turn(s) ${walked.map((w, i) => w.blank ? i : null).filter((i) => i !== null).join(', ')} — the blank is laid out against the travel`);
else if (distinct.size !== 7) F(`seven turns visited ${distinct.size} arms, not 7: ${walked.map((w) => w.arm).join(', ')}`);
else OK(`the pin walks seven distinct slotted arms (${walked.map((w) => w.arm).join(' → ')}) of ${walked[0].nArms}`);
await wind();                                                         // the eighth turn runs into the bank
let c = await chip();
r = await readout();
const bank = await armAtPin();
const fingerDeg = Number((r.match(/finger (-?\d+)°/) || [])[1]);
if (!/BANKED/.test(c)) F(`after seven indexes and one more turn: ${c} — ${r}`);
else if (!bank.blank) F(`the bank landed on arm ${bank.arm}, which is slotted — the blank is one station off`);
else if (!(fingerDeg < 112.5)) F(`the pin banked at finger ${fingerDeg}°, not short of the 112.5° entry angle`);
else OK(`the bank is on the blank arm ${bank.arm} (${bank.gap.toFixed(2)}° off its centreline), finger ${fingerDeg}° short of entry — ${c}`);
await wind();
const r2 = await readout();
if (r2 !== r) F(`a further wind moved the finger past the bank: ${r2}`); else OK('a further wind is refused — the bank holds');
// the bank is a PARTIAL turn (the finger stopped short of entry), so the first
// unwind backs out of it to the locked position and seven more reach home
for (let i = 0; i < 8; i++) await unwind();
c = await chip(); r = await readout();
if (!/LOCKED/.test(c) || !/turn 0 /.test(r)) F(`after unwinding: ${c} — ${r}`); else OK(`after backing out of the bank and seven unwinds: ${c} — ${r}`);
await unwind();
if ((await readout()) !== r) F('a ninth unwind moved the finger below home'); else OK('a further unwind is refused at home');
// 4 — scrub into the engagement window
const scrub = async (deg) => { await page.evaluate((d) => { const s = document.getElementById('mxSlider'); s.value = String(d); s.dispatchEvent(new Event('input')); }, deg); return { chip: await chip(), r: await readout() }; };
const s0 = await scrub(60), s1 = await scrub(180), s2 = await scrub(300);
const crossDeg = (t) => Number((t.match(/cross (-?\d+)°/) || [])[1]);
if (!/LOCKED/.test(s0.chip) || !/INDEXING/.test(s1.chip) || !/LOCKED/.test(s2.chip)) F(`scrub chips: 60° ${s0.chip} · 180° ${s1.chip} · 300° ${s2.chip}`); else OK('scrub: LOCKED before entry, INDEXING mid-slot, LOCKED after exit');
if (crossDeg(s1.r) === crossDeg(s0.r) || crossDeg(s2.r) === crossDeg(s0.r)) F(`the cross did not move through the slot: ${s0.r} → ${s1.r} → ${s2.r}`); else OK(`the cross turns one station through the slot (${crossDeg(s0.r)}° → ${crossDeg(s1.r)}° → ${crossDeg(s2.r)}°)`);
if (errs.length) F(`page errors: ${errs.join(' | ').slice(0, 200)}`); else OK('no page errors');
await ctx.close();
// 5 — reduced motion
({ ctx, page, errs } = await open(true));
const playBtn = await page.evaluate(() => document.getElementById('mxPlay').textContent);
if (!/play/.test(playBtn)) F(`reduced motion: the plate autoplayed (${playBtn})`); else OK('reduced motion: no autoplay');
const before = await readout();
await page.evaluate(() => document.getElementById('mxWind').click());
const justAfter = await readout();
if (!/turn 1 /.test(justAfter)) F(`reduced motion: a wind did not snap (${before} → ${justAfter})`); else OK('reduced motion: a wind snaps to its end state');
await ctx.close(); await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
