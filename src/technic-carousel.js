// BUILT §294 — THE TECHNIC PAGE'S CAROUSEL: the pure half. technic.html shows
// every LEGO cell on one table; the carousel walks them one at a time. This
// module is everything about the walk that needs no browser and no three.js:
// which stops there are, what they are called, how a deep link names one, what
// Next and Previous do at the ends, what a flick is, and how the URL is
// written. The page imports it; tools/probe-technic-carousel.mjs holds it.
//
// DISPLAY ONLY. Nothing here reads or writes a placement: the LDraw parts, the
// .ldr downloads and every other probe are untouched by it.
//
// THE STOPS ARE DERIVED FROM THE CELLS THE PAGE BUILT, never typed: describeCells
// takes what build() already holds (the rows and their frames, the keyless,
// fusee, alarm, escapement and — §315 — going-train frames) and answers the cells in build order; a
// cell that did not frame in LEGO is SKIPPED and says why (skipNote), and a
// cell with two things worth looking at is two stops (the keyless works and
// its motion works; the alarm's column wheel and its strike).
import { ratQ, ratMul, ratStr } from './layout.js';

// The views a stop can take. technic.html keeps one handler per name; the
// probe fails when a view here has no handler there.
export const VIEWS = ['row', 'keyless', 'motion', 'fusee', 'wheel', 'strike', 'escapement', 'train', 'clock'];

// The ?focus= values the page accepted before the carousel, and the stop each
// opens. ?focus= itself is unchanged; it maps onto the same stops.
export const FOCUS_IDS = { escapement: 'escapement', fusee: 'fusee', alarm: 'alarm', strike: 'strike', train: 'train' };

// Next from the last stop goes to the first, and Previous from the first to the
// last: it is a carousel, and the overview button (and Escape) is the way out.
// Home and End are the ends.
export const CAROUSEL_WRAPS = true;

// The camera's travel between stops. CONSTRAINT: long enough that a move of a
// whole table cell (LEGO_CELL, 272 mm) reads as one continuous motion rather
// than a cut, short enough that the reader is not waiting on it (under a
// second); the middle of 0.6–0.9 s.
export const TWEEN_S = 0.75;

// A flick, on the carousel's own bar and nowhere else (the canvas belongs to
// OrbitControls, whose one-finger drag is a horizontal swipe too). CONSTRAINTS:
// SWIPE_MIN_PX is a finger's width beyond the 36 px minimum touch target, so a
// tap that wobbles is not a flick; the dx > 2·dy test keeps a vertical scroll
// of the panel from reading as one; SWIPE_MAX_MS keeps a slow drag (a
// hesitation, a selection) from being one.
export const SWIPE_MIN_PX = 48;
export const SWIPE_MAX_MS = 600;
export const SWIPE_RATIO = 2;

// ---------------------------------------------------------------------------
// the cells, in build order. `n` is the PANEL's number for the cell (a skipped
// cell keeps its number, so the panel and the tour agree).
//   rows       [{ key, chain: [[teeth, teeth], …], frame: { framed, reason } }]
//   keyless    { framed, reason, motion? }   (frameKeyless: `motion` when framed)
//   fusee      { framed, reason }
//   alarm      { framed, reason }
//   escapement { framed, reason }
//   train      { framed, reason }   (§315: frameTrain, the fusee to the balance on one baseplate)
//   clock      { framed, reason, refused? }   (BUILT §312 L1; absent before it, so no stop)
export function describeCells({ rows, keyless, fusee, alarm, escapement, train = { framed: false, reason: 'no frame' }, clock = null }) {
  const cells = [];
  const add = (c) => cells.push({ ...c, n: cells.length + 1 });
  for (const r of rows) {
    const product = r.chain.reduce((acc, [a, c]) => ratMul(acc, ratQ(a, c)), ratQ(1));
    add({ id: `row-${cells.length + 1}`, kind: 'row', title: r.key, framed: !!(r.frame && r.frame.framed), reason: r.frame ? r.frame.reason : 'no frame',
      caption: `${r.chain.map(([a, c]) => `${a}:${c}`).join(' × ')} = ${ratStr(product)}, the steel train's ratio`,
      views: [{ id: `row-${cells.length + 1}`, view: 'row', title: r.key }] });
  }
  add({ id: 'keyless', kind: 'keyless', framed: !!keyless.framed, reason: keyless.reason,
    title: 'keyless works', caption: 'the stem, two clutch gears and the ring between them; wind, set and neutral are a pull held by a detent',
    views: [{ id: 'keyless', view: 'keyless', title: 'keyless works', caption: 'the stem, two clutch gears and the ring between them; wind, set and neutral are a pull held by a detent' },
      ...(keyless.framed && keyless.motion ? [{ id: 'motion', view: 'motion', title: 'motion works', caption: 'the hour wheel idles on the minute axle; in set the crown turns both hands through the gears' }] : [])] });
  add({ id: 'fusee', kind: 'fusee', framed: !!fusee.framed, reason: fusee.reason,
    title: 'fusee and maintaining power', caption: 'a cord on a stepped cone; the spring law is posed, so the loop is modelled, not simulated',
    views: [{ id: 'fusee', view: 'fusee', title: 'fusee and maintaining power', caption: 'a cord on a stepped cone; the spring law is posed, so the loop is modelled, not simulated' }] });
  add({ id: 'alarm', kind: 'alarm', framed: !!alarm.framed, reason: alarm.reason,
    title: 'alarm', caption: '',
    views: [{ id: 'alarm', view: 'wheel', title: 'alarm: the column wheel', caption: 'a pusher steps six columns by twelve rests; the lever reads the wheel at the hour (modelled, not simulated)' },
      { id: 'strike', view: 'strike', title: 'alarm: the strike', caption: 'the release lever, a fly and a hammer on a cam; the cadence and the wind are posed' }] });
  add({ id: 'escapement', kind: 'escapement', framed: !!escapement.framed, reason: escapement.reason,
    title: 'escapement and balance', caption: 'a recoil anchor and a knife-edge balance arm: analogues of the Swiss lever and the sprung balance, modelled',
    views: [{ id: 'escapement', view: 'escapement', title: 'escapement and balance', caption: 'a recoil anchor and a knife-edge balance arm: analogues of the Swiss lever and the sprung balance, modelled' }] });
  add({ id: 'train', kind: 'train', framed: !!train.framed, reason: train.reason,
    title: 'going train', caption: 'the fusee to the balance on one baseplate: every angle from the escapement\'s cycle through the tooth counts; the spring law is posed, so it is modelled, not simulated',
    views: [{ id: 'train', view: 'train', title: 'going train', caption: 'the fusee to the balance on one baseplate: every angle from the escapement\'s cycle through the tooth counts; the spring law is posed, so it is modelled, not simulated' }] });
  if (clock) {
    const caption = `the cells joined on one base, each shared axle one keyed body; display only, modelled${clock.refused?.length ? ` — ${clock.refused.map((r) => `the ${r} line refused`).join(', ')}` : ''}`;
    add({ id: 'clock', kind: 'clock', framed: !!clock.framed, reason: clock.reason, title: 'alarm clock', caption,
      views: [{ id: 'clock', view: 'clock', title: 'alarm clock', caption }] });
  }
  return cells;
}

// The stops: every view of every framed cell, in build order. A cell that did
// not frame is not a stop and is listed in `skipped` with its reason.
export function stopsOf(cells) {
  const stops = [], skipped = [];
  for (const c of cells) {
    if (!c.framed) { skipped.push({ id: c.id, n: c.n, title: c.title, reason: c.reason ?? 'not framed in LEGO' }); continue; }
    for (const v of c.views) stops.push({ id: v.id, cell: c.id, n: c.n, view: v.view, title: v.title, caption: v.caption ?? c.caption });
  }
  return { stops, skipped };
}

// the carousel's own words about what it left out ('' when it left nothing)
export function skipNote(skipped) {
  if (!skipped.length) return '';
  return `skipped, not framed in LEGO: ${skipped.map((s) => `${s.n}. ${s.title} (${s.reason})`).join('; ')}`;
}

// "3 / 10 — fusee and maintaining power"; the overview has no position
export function indicator(i, stops) {
  return i === null || i < 0 ? `overview, ${stops.length} cells to tour` : `${i + 1} / ${stops.length} — ${stops[i].title}`;
}

// ---------------------------------------------------------------------------
// moving. `i` is the current stop, or null/-1 in the overview, where the first
// Next enters at the first stop and the first Previous at the last.
export function step(i, dir, n, wrap = CAROUSEL_WRAPS) {
  if (n <= 0) return -1;
  if (i === null || i === undefined || i < 0) return dir > 0 ? 0 : n - 1;
  const j = i + (dir > 0 ? 1 : -1);
  return wrap ? ((j % n) + n) % n : Math.min(n - 1, Math.max(0, j));
}

// a stop's index by its id (case and edge spaces forgiven), -1 when there is none:
// an unknown id is the overview, silently, as an unknown ?focus= is
export function resolveId(stops, id) {
  if (typeof id !== 'string') return -1;
  const s = id.trim().toLowerCase();
  return s ? stops.findIndex((x) => x.id === s) : -1;
}

// a ?focus= value to a stop (-1 for a value the page never accepted)
export function resolveFocus(stops, focus) {
  return Object.prototype.hasOwnProperty.call(FOCUS_IDS, focus) ? resolveId(stops, FOCUS_IDS[focus]) : -1;
}

// +1 (Next) for a quick leftward flick, −1 for a rightward one, 0 for anything else
export function swipeDir(dx, dy, ms) {
  if (ms > SWIPE_MAX_MS || Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

// WHERE THE PAGE OPENS (BUILT §298) — the one law the page and the probe read.
// technic.html opens in the tour. The table, by the query string alone:
//   (no params, or only panel/loop/auto/gen/…)  on, at the first stop
//   ?cell=<a stop>                              on, at that stop (§294, unchanged)
//   ?cell=<anything else, even empty>           OFF — the overview, as before §298
//   ?focus=<anything, valid or not>             OFF — every ?focus= link lands where it did
//   ?cell=<a stop>&focus=<x>                    on, at the cell (the cell won in §294 too)
//   ?tour=0                                     OFF — the old default, the whole table
//   ?tour=0&cell=<a stop>                       on, at the cell (a named place beats "no tour")
// Only a literal `0` is "off"; `?tour=1`, `?tour=` and `?tour=yes` are the default.
// `stops` are the build's stops (the first is the opening one; none, no tour).
// Read once, at the page's FIRST build: a rebuild keeps the tour as it stands, so
// leaving the tour is not undone by the next generation switch.
export function initialTour(search, stops) {
  const p = new URLSearchParams(search);
  const first = stops && stops.length ? stops[0].id : null;
  if (p.has('cell')) { const i = resolveId(stops ?? [], p.get('cell')); return i >= 0 ? { on: true, id: stops[i].id, why: 'cell' } : { on: false, id: null, why: 'bad cell' }; }
  if (p.has('focus')) return { on: false, id: null, why: 'focus' };
  if (p.get('tour') === '0') return { on: false, id: null, why: 'tour=0' };
  return first ? { on: true, id: first, why: 'default' } : { on: false, id: null, why: 'no stops' };
}

// The query string with `cell` set (or removed when id is null); `focus` goes
// with it because the cell supersedes it and a stale pair would disagree on reload.
// Leaving the tour (id null) writes `tour=0` and entering removes it, so the
// address always says what is on screen: a reload of the overview is the overview.
export function withCell(search, id) {
  const p = new URLSearchParams(search);
  p.delete('focus');
  if (id) { p.set('cell', id); p.delete('tour'); } else { p.delete('cell'); p.set('tour', '0'); }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// cubic ease in-out on t in [0, 1]
export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
