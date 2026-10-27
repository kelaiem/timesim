// IS THE TECHNIC PAGE'S CAROUSEL A WALK OVER THE CELLS THE PAGE ACTUALLY BUILT:
// STOPS DERIVED FROM THEIR FRAMES (NOT RETYPED), IDS THAT ROUND-TRIP, AN UNFRAMED
// CELL SKIPPED OUT LOUD, NEXT AND PREVIOUS WRAPPING AT BOTH ENDS, EVERY OLD
// ?focus= VALUE STILL A STOP, AND THE URL WRITTEN ONLY BY THE TOUR?
// Acceptance, pure Node, no browser, no network; exits non-zero on any failure.
// BUILT §294 (src/technic-carousel.js, technic.html's carousel).
//
// DISPLAY ONLY: the carousel reads no placement and writes none. This holds the
// pure half (the stops, the ids, the ends, the flick, the URL, the ease) and the
// page's wiring that text can show (every view has a handler, every ?focus=
// literal maps, one writer of the URL). The camera, the dimming and the bar are
// the browser's: tools/smoke-technic-carousel.mjs drives them.
//
//   · CELLS — describeCells over the REAL frames of each generation (frameFork,
//     frameKeyless, frameFusee, frameAlarm, frameEscapement, §315's frameTrain, and
//     since BUILT §312 the clock's declared layout, clockLayout over the vendored
//     parts): the stops are those the frames frame, in build order, row ids carry the
//     panel's number;
//   · IDS — unique, round-trip through resolveId, case and edge spaces forgiven,
//     an unknown id (and a prototype name) is the overview (-1);
//   · SKIP — a row, the keyless works, the fusee, the clock left unframed are skipped with
//     their reason and panel number, skipNote says so, the other ids stand;
//   · ENDS — Next from the last stop is the first and Previous from the first
//     the last (CAROUSEL_WRAPS); from the overview they enter at the first and
//     at the last; one stop is its own neighbour;
//   · FOCUS — every `focus === '…'` literal in technic.html resolves to a stop
//     through resolveFocus;
//   · INITIAL — §298: where the page opens, by query string, over the real stops
//     (no params: tour at stop 1; ?tour=0, ?focus=*, a bad ?cell=: overview;
//     ?cell=id: that stop), and the page asks once, at the first build;
//   · FLICK / URL / EASE — thresholds, ?cell= written and removed with every
//     other parameter kept, ?focus= dropped beside it, the ease monotone and
//     the tween inside 0.6–0.9 s;
//   · PAGE — every VIEWS name has a STOP_VIEW handler and no other; the URL has
//     one writer, called from the tour's two entry points only; no i18n.
//
// WHAT THIS DOES NOT CLAIM: that the camera lands well, that the dimming reads,
// that the bar fits at 390 px. Those are the smoke test's and the screenshots'.
//
// CONTROLS, each seen to fail: a stop-id table typed by hand with a row too few;
// a stopsOf that skips nothing; Next and Previous with wrap and clamp swapped;
// a flick that ignores its vertical travel; a URL writer that keeps ?focus=;
// (§298) an opening default that ignores ?focus=, one that ignores ?tour=0, and
// one that tours a bad ?cell=; a page that asks on every build.
//
//   node tools/probe-technic-carousel.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../src/technic-carousel.js';
import { CATALOGUES, TECHNIC_FORK } from '../src/layout.js';
import { frameFork, frameKeyless } from '../src/technic-frame.js';
import { TECHNIC_FUSEE_SPRING, solveFusee, frameFusee } from '../src/technic-fusee.js';
import { frameAlarm } from '../src/technic-alarm.js';
import { frameEscapement } from '../src/technic-escapement.js';
import { frameTrain } from '../src/technic-train.js';
import { clockModules, clockLayout } from '../src/technic-clock.js';
import { loadPack } from './technic-pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(ROOT, 'technic.html'), 'utf8');
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`  ✗ ${msg}`); } return !!cond; };
const controls = [];
const control = (name, caught) => controls.push([name, caught]);

console.log('THE TECHNIC CAROUSEL — stops derived from the built cells (display only)\n');

// the real inputs, per generation
const fusRun = solveFusee(TECHNIC_FUSEE_SPRING).best, ff = fusRun && frameFusee();
const fuseeIn = { framed: !!(fusRun && ff.framed), reason: ff?.reason ?? 'no step set fits the table' };
const alarmIn = frameAlarm(), escIn = frameEscapement();
// the clock (§312): its declared layout judged over the vendored parts, as the page reads it
const lib = loadPack(), clockIn = {};
const clockOf = (gen) => { if (!clockIn[gen]) { const m = clockModules(lib, gen), l = m.framed ? clockLayout(lib, m) : null; clockIn[gen] = { framed: !!l?.framed, reason: m.reason ?? l?.reason, refused: l?.refused.map((r) => r.key) ?? [] }; } return clockIn[gen]; };
const inputs = (gen) => ({ rows: TECHNIC_FORK.rows.map((row, k) => ({ key: row.key, chain: row.chains[gen], frame: frameFork(gen)[k] })),
  keyless: frameKeyless(gen), fusee: fuseeIn, alarm: alarmIn, escapement: escIn, train: frameTrain(gen), clock: clockOf(gen) });

for (const gen of Object.keys(CATALOGUES).filter((k) => CATALOGUES[k])) {
  const inp = inputs(gen), cells = C.describeCells(inp), { stops, skipped } = C.stopsOf(cells);
  const R = TECHNIC_FORK.rows.length;
  console.log(`${gen}: ${cells.length} cells, ${stops.length} stops, ${skipped.length} skipped`);
  console.log('  ' + stops.map((s, i) => `${i + 1}:${s.id}`).join('  '));
  ok(cells.length === R + 6, `${gen}: ${R} rows + keyless + fusee + alarm + escapement + going train + clock = ${R + 6} cells, got ${cells.length}`);
  // the stops are what the frames frame
  const want = [];
  inp.rows.forEach((r, k) => { if (r.frame?.framed) want.push(`row-${k + 1}`); });
  if (inp.keyless.framed) { want.push('keyless'); if (inp.keyless.motion) want.push('motion'); }
  if (inp.fusee.framed) want.push('fusee');
  if (inp.alarm.framed) want.push('alarm', 'strike');
  if (inp.escapement.framed) want.push('escapement');
  if (inp.train.framed) want.push('train');
  if (inp.clock.framed) want.push('clock');
  ok(JSON.stringify(stops.map((s) => s.id)) === JSON.stringify(want), `${gen}: stops ${stops.map((s) => s.id)} are not the framed cells' ${want}`);
  ok(stops.length + skipped.length >= cells.length, `${gen}: a cell vanished (stops+skipped < cells)`);
  // row ids carry the panel's number; numbers never decrease; the order is the build's
  stops.forEach((s, i) => {
    if (s.view === 'row') ok(s.id === `row-${s.n}` && s.title === TECHNIC_FORK.rows[s.n - 1].key, `${gen}: ${s.id} is not row ${s.n}`);
    if (i) ok(stops[i - 1].n <= s.n, `${gen}: ${s.id} stands before a lower-numbered stop`);
    ok(s.title && s.caption, `${gen}: ${s.id} lacks a title or caption`);
  });
  const order = ['keyless', 'motion', 'fusee', 'alarm', 'strike', 'escapement', 'train', 'clock'].map((id) => stops.findIndex((s) => s.id === id)).filter((i) => i >= 0);
  ok(order.every((v, i) => !i || order[i - 1] < v), `${gen}: keyless, motion, fusee, alarm, strike, escapement, train, clock out of order`);
  // ids: unique, round trip, forgiven case and spaces
  const ids = stops.map((s) => s.id);
  ok(new Set(ids).size === ids.length, `${gen}: duplicate stop ids`);
  stops.forEach((s, i) => ok(C.resolveId(stops, s.id) === i && C.resolveId(stops, `  ${s.id.toUpperCase()} `) === i, `${gen}: ${s.id} does not round-trip`));
  // a stop's view is a view the page handles
  for (const s of stops) ok(C.VIEWS.includes(s.view), `${gen}: ${s.id} has unknown view ${s.view}`);
  // the words: posed things say modelled (never "simulated" without "not")
  for (const s of [...stops, ...cells.map((c) => ({ id: c.id, caption: c.caption }))]) {
    const t = s.caption ?? '';
    ok(!/simulated/i.test(t) || /not simulated/i.test(t), `${gen}: ${s.id}'s caption claims "simulated": ${t}`);
  }

  // SKIP: an unframed row, keyless, fusee
  const mutate = (f) => { const i2 = { ...inp, rows: inp.rows.map((r) => ({ ...r })) }; f(i2); return C.stopsOf(C.describeCells(i2)); };
  {
    const r = mutate((i) => { i.rows[1].frame = { framed: false, reason: 'no room on the frame' }; });
    ok(!r.stops.some((s) => s.id === 'row-2') && r.skipped.length === 1 && r.skipped[0].n === 2 && r.skipped[0].reason === 'no room on the frame', `${gen}: an unframed row 2 was not skipped with its reason`);
    ok(C.skipNote(r.skipped).includes('2.') && C.skipNote(r.skipped).includes('no room on the frame'), `${gen}: skipNote does not name row 2 and why`);
    ok(r.stops.length === stops.length - 1 && stops.filter((s) => s.id !== 'row-2').every((s) => r.stops.some((x) => x.id === s.id)), `${gen}: skipping row 2 moved another stop`);
    const k = mutate((i) => { i.keyless = { framed: false, reason: 'no room for the pull' }; });
    ok(!k.stops.some((s) => s.cell === 'keyless') && k.skipped.length === 1, `${gen}: an unframed keyless cell left a stop (the motion works rides it) or was skipped twice`);
    const f = mutate((i) => { i.fusee = { framed: false, reason: 'no step set fits the table' }; });
    ok(!f.stops.some((s) => s.id === 'fusee') && C.skipNote(f.skipped).includes('fusee'), `${gen}: an unframed fusee was not skipped out loud`);
    ok(C.skipNote([]) === '', `${gen}: skipNote of nothing is not empty`);
    const ck = mutate((i) => { i.clock = { framed: false, reason: 'no arrangement joins its lines' }; });
    ok(!ck.stops.some((s) => s.id === 'clock') && C.skipNote(ck.skipped).includes('alarm clock'), `${gen}: an unframed clock was not skipped out loud`);
    // the clock's caption names a refused line
    const cs = stops.find((s) => s.id === 'clock');
    if (cs) ok(inp.clock.refused.every((r) => cs.caption.includes(`the ${r} line refused`)), `${gen}: the clock's caption hides a refused line`);
    // CONTROL: a stopsOf that skips nothing
    const noSkip = (cs) => cs.flatMap((c) => c.views.map((v) => ({ id: v.id, cell: c.id })));
    const bad = C.describeCells({ ...inp, rows: inp.rows.map((rr, i) => (i === 1 ? { ...rr, frame: { framed: false, reason: 'x' } } : rr)) });
    control(`stopsOf that skips nothing (${gen})`, noSkip(bad).some((s) => s.id === 'row-2'));
  }
  // CONTROL: a hand-typed id table with a row too few, against the derived stops
  {
    const typed = ['row-1', 'row-2', 'row-3', 'keyless', 'motion', 'fusee', 'alarm', 'strike', 'escapement', 'clock'];   // as if a row were dropped
    control(`stop ids typed by hand (${gen})`, JSON.stringify(typed) !== JSON.stringify(ids));
  }
  // overview, unknown ids
  for (const bad of ['', '  ', 'nope', 'row-0', `row-${R + 9}`, '__proto__', 'constructor', null, undefined, 3]) ok(C.resolveId(stops, bad) === -1, `${gen}: resolveId(${JSON.stringify(bad)}) is not the overview`);

  // ENDS
  const n = stops.length;
  ok(C.step(n - 1, 1, n) === 0 && C.step(0, -1, n) === n - 1, `${gen}: Next/Previous do not wrap at the ends`);
  ok(C.step(null, 1, n) === 0 && C.step(-1, -1, n) === n - 1 && C.step(undefined, 1, n) === 0, `${gen}: the overview's first Next/Previous do not enter at the ends`);
  ok(C.step(3, 1, n) === 4 && C.step(3, -1, n) === 2, `${gen}: a middle step is not one stop`);
  ok(C.step(0, 1, 1) === 0 && C.step(0, -1, 1) === 0 && C.step(null, 1, 0) === -1, `${gen}: a one-stop or empty tour misbehaves`);
  ok(C.step(n - 1, 1, n, false) === n - 1 && C.step(0, -1, n, false) === 0, `${gen}: the clamped variant does not clamp`);
  // walking Next n times returns to the start, visiting every stop once
  { let i = null; const seen = []; for (let k = 0; k < n; k++) { i = C.step(i, 1, n); seen.push(i); } ok(new Set(seen).size === n && seen[0] === 0 && C.step(i, 1, n) === 0, `${gen}: n Nexts do not visit each stop once and come round`); }
  // CONTROL: wrap and clamp swapped
  control(`wrap and clamp swapped (${gen})`, !(C.step(n - 1, 1, n, !C.CAROUSEL_WRAPS) === 0 && C.step(0, -1, n, !C.CAROUSEL_WRAPS) === n - 1));

  // FOCUS
  for (const f of Object.keys(C.FOCUS_IDS)) ok(C.resolveFocus(stops, f) >= 0, `${gen}: ?focus=${f} resolves to no stop`);
  ok(C.resolveFocus(stops, 'toString') === -1 && C.resolveFocus(stops, 'nope') === -1 && C.resolveFocus(stops, null) === -1, `${gen}: an unknown ?focus= is not the overview`);
}

// FOCUS, against the page: every literal the page accepts
{
  const lits = [...page.matchAll(/focus === '([a-z]+)'/g)].map((m) => m[1]);
  console.log(`\nthe page's ?focus= literals: ${lits.join(', ')}`);
  const stops = C.stopsOf(C.describeCells(inputs('technic_2026'))).stops;
  ok(lits.length >= 4, `the page names ${lits.length} ?focus= values; expected at least the four it always had`);
  for (const l of lits) ok(C.resolveFocus(stops, l) >= 0, `?focus=${l} (technic.html) maps to no stop`);
  for (const f of Object.keys(C.FOCUS_IDS)) ok(lits.includes(f), `FOCUS_IDS names ${f}, which the page no longer accepts`);
}

// FLICK
{
  const d = C.swipeDir;
  ok(d(-80, 5, 200) === 1 && d(80, -5, 200) === -1, 'a quick horizontal flick is not Next (left) / Previous (right)');
  ok(d(-20, 0, 100) === 0 && d(-C.SWIPE_MIN_PX + 1, 0, 100) === 0 && d(-C.SWIPE_MIN_PX, 0, 100) === 1, 'the distance threshold is not SWIPE_MIN_PX');
  ok(d(-80, 60, 200) === 0 && d(-80, 40, 200) === 1 && d(-80, 41, 200) === 0, 'a mostly vertical drag reads as a flick');
  ok(d(-80, 0, C.SWIPE_MAX_MS + 1) === 0 && d(-80, 0, C.SWIPE_MAX_MS) === 1, 'a slow drag reads as a flick');
  ok(C.SWIPE_MIN_PX > 36, 'a flick shorter than a touch target');
  const noRatio = (dx, dy, ms) => (ms > C.SWIPE_MAX_MS || Math.abs(dx) < C.SWIPE_MIN_PX ? 0 : dx < 0 ? 1 : -1);
  control('a flick that ignores its vertical travel', noRatio(-80, 70, 200) !== d(-80, 70, 200));
  ok(/swipe0/.test(page) && /tourEl\.addEventListener\('pointerup'/.test(page) && !/renderer\.domElement\.addEventListener\('pointer(up|down)/.test(page), 'the flick is not confined to the bar');
}

// URL
{
  const w = C.withCell;
  ok(w('', 'fusee') === '?cell=fusee' && w('?cell=fusee', null) === '?tour=0' && w('', null) === '?tour=0', 'withCell does not set/remove ?cell= (leaving writes tour=0, §298)');
  ok(w('?tour=0', 'fusee') === '?cell=fusee' && w('?tour=0&loop=0', 'fusee') === '?loop=0&cell=fusee', 'entering the tour left ?tour=0 beside ?cell=');
  ok(w('?cell=fusee&tour=0', null) === '?tour=0', 'leaving twice duplicated ?tour=0');
  ok(w('?loop=0&gen=technic_2026&cell=row-2&panel=0', 'strike') === '?loop=0&gen=technic_2026&cell=strike&panel=0', 'withCell lost or moved another parameter');
  ok(w('?focus=fusee&loop=0', 'escapement') === '?loop=0&cell=escapement', 'withCell kept ?focus= beside ?cell=');
  ok(w('?focus=fusee&loop=0', null) === '?loop=0&tour=0', 'leaving the tour kept ?focus= (or lost loop)');
  const keep = (search, id) => { const p = new URLSearchParams(search); id ? p.set('cell', id) : p.delete('cell'); const s = p.toString(); return s ? `?${s}` : ''; };
  control('a URL writer that keeps ?focus=', keep('?focus=fusee', 'escapement') !== w('?focus=fusee', 'escapement'));
  const writers = [...page.matchAll(/history\.replaceState/g)].length, calls = [...page.matchAll(/writeUrl\(/g)].length;
  ok(writers === 1 && calls === 3, `the URL has ${writers} writers and writeUrl is mentioned ${calls} times (definition + the tour's two entries = 3)`);
  const tg = page.slice(page.indexOf('function tourGo('), page.indexOf('const tourNext')), outside = page.replace(tg, '');
  ok(/writeUrl\(stop\.id\)/.test(tg) && /writeUrl\(null\)/.test(tg) && (outside.match(/writeUrl\(/g) ?? []).length === 1, 'writeUrl is called outside tourGo/tourExit');
}

// INITIAL — where the page opens (§298): the table, over the real stops
{
  const stops = C.stopsOf(C.describeCells(inputs('technic_2026'))).stops, first = stops[0].id, I = (q) => C.initialTour(q, stops);
  const row = (q, on, id, why) => ok(I(q).on === on && I(q).id === id, `initialTour(${JSON.stringify(q)}) = ${JSON.stringify(I(q))}, expected on=${on} id=${id} (${why})`);
  console.log(`\nthe opening stop: ${first}`);
  ok(first === 'row-1', `the first stop is ${first}, not row-1 (the note in BUILT §298 assumes it)`);
  row('', true, first, 'no params');
  row('?panel=0', true, first, 'panel only'); row('?loop=0&auto=0&panel=0', true, first, 'the display switches');
  row('?gen=technic_classic', true, first, 'gen'); row('?view=lego', true, first, 'index.html\'s own link');
  row('?tour=1', true, first, 'tour=1'); row('?tour=', true, first, 'tour empty'); row('?tour=yes', true, first, 'tour not 0');
  row('?tour=0', false, null, 'the old default');
  row('?tour=0&panel=0&gen=technic_2026', false, null, 'tour=0 with others');
  for (const f of ['escapement', 'fusee', 'alarm', 'strike', 'bogus', '', '__proto__']) row(`?focus=${f}`, false, null, 'explicit focus: no auto tour');
  row('?focus=fusee&loop=0&panel=0', false, null, 'focus with others'); row('?focus=fusee&tour=0', false, null, 'focus and tour=0');
  for (const s of stops) row(`?cell=${s.id}`, true, s.id, 'a named stop');
  row('?cell=ESCAPEMENT', true, 'escapement', 'case forgiven'); row('?cell=fusee&tour=0', true, 'fusee', 'a named place beats tour=0');
  row('?cell=fusee&focus=alarm', true, 'fusee', 'the cell won in §294 too');
  for (const bad of ['bogus', '', 'row-99', '__proto__', 'constructor']) row(`?cell=${bad}`, false, null, 'unknown cell is the overview, as before');
  row('?cell=bogus&focus=fusee', false, null, 'bad cell with focus: focus lands, no tour');
  ok(!C.initialTour('', []).on && !C.initialTour('', undefined).on && C.initialTour('?cell=x', []).on === false, 'no stops still opened a tour');
  ok(C.initialTour('?tour=0', stops).why === 'tour=0' && C.initialTour('', stops).why === 'default', 'initialTour does not say why');
  // the state the URL writer leaves is read back as the same state
  ok(I(C.withCell('', null)).on === false && I(C.withCell('?loop=0', 'fusee')).id === 'fusee' && I(C.withCell('?focus=fusee', null)).on === false, 'the writer\'s URL does not read back as what is on screen');
  // CONTROLS: a default that ignores ?focus= (breaks every old link), one that ignores ?tour=0
  const noFocus = (q) => { const p = new URLSearchParams(q); if (p.has('cell')) return C.initialTour(q, stops); return p.get('tour') === '0' ? { on: false } : { on: true, id: first }; };
  const noTour0 = (q) => { const p = new URLSearchParams(q); if (p.has('cell') || p.has('focus')) return C.initialTour(q, stops); return { on: true, id: first }; };
  control('a default that ignores ?focus=', ['escapement', 'fusee', 'alarm', 'strike'].some((f) => noFocus(`?focus=${f}`).on !== I(`?focus=${f}`).on));
  control('a default that ignores ?tour=0', noTour0('?tour=0').on !== I('?tour=0').on);
  control('a default that tours a bad ?cell=', (() => { const p = new URLSearchParams('?cell=bogus'); return (p.has('cell') ? { on: true, id: first } : null).on !== I('?cell=bogus').on; })());
  // PAGE: the first build alone asks; the rest keep the tour as it stands
  ok(/initialTour\(location\.search, tour\.stops\)/.test(page) && (page.match(/initialTour\(/g) ?? []).length === 1, 'the page does not read initialTour exactly once');
  ok(/let firstBuild = true/.test(page) && /firstBuild \? initialTour/.test(page) && /firstBuild = false;/.test(page), 'the page asks initialTour on every build, not the first');
  ok(!/new URLSearchParams\(location\.search\)\.get\('cell'\)/.test(page), 'the page still reads ?cell= itself instead of through initialTour');
  control('a page that asks on every build', !/firstBuild \? initialTour/.test(page.replace('firstBuild ? initialTour', 'initialTour')));
}

// EASE and the tween's duration
{
  const e = C.ease;
  ok(e(0) === 0 && e(1) === 1 && e(-1) === 0 && e(2) === 1 && Math.abs(e(0.5) - 0.5) < 1e-12, 'ease is not 0 → 1 through ½');
  let prev = -1, mono = true; for (let i = 0; i <= 100; i++) { const v = e(i / 100); if (v < prev) mono = false; prev = v; }
  ok(mono, 'ease is not monotone');
  ok(C.TWEEN_S >= 0.6 && C.TWEEN_S <= 0.9, `TWEEN_S ${C.TWEEN_S} is outside 0.6–0.9 s`);
  ok(/prefers-reduced-motion/.test(page) && /reduceMotion\.matches/.test(page), 'the page does not honour prefers-reduced-motion');
  ok(/controls\.addEventListener\('start', cancelTween\)/.test(page), 'a drag does not cancel the tween');
}

// PAGE wiring
{
  const blk = page.slice(page.indexOf('const STOP_VIEW = {'), page.indexOf('const camPose'));
  const keys = [...blk.matchAll(/^\s{2}([a-z]+): /gm)].map((m) => m[1]);
  ok(JSON.stringify([...keys].sort()) === JSON.stringify([...C.VIEWS].sort()), `STOP_VIEW handles ${keys}; VIEWS names ${C.VIEWS}`);
  ok(!/i18n/.test(page), 'technic.html imports i18n; the carousel text would need localizing');
  ok(!/[^-]left\s*:|[^-]right\s*:|margin-left|margin-right|padding-left|padding-right|text-align:\s*(left|right)/.test(page.slice(page.indexOf('/* §294: the carousel'), page.indexOf('</style>'))), 'the carousel CSS uses a physical property');
}

// CONTROLS
console.log('');
let blind = 0;
for (const [name, caught] of controls) { console.log(`  control ${caught ? 'caught' : 'MISSED '}: ${name}`); if (!caught) blind++; }
const uniq = new Set(controls.map(([n]) => n.replace(/ \(.*\)$/, '')));
ok(uniq.size >= 5, `only ${uniq.size} distinct controls ran`);
console.log(`\n${checks} checks, ${fails} failed; ${controls.length} controls (${uniq.size} kinds), ${blind} missed`);
if (fails || blind) { console.log('FAIL'); process.exit(1); }
console.log('PASS');
