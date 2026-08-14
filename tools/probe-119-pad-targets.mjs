#!/usr/bin/env node
// §119 — WHAT NO GATE MEASURES: can a thumb hit each control on the pad?
//
// §57's control pad is a 150 px map of the movement's controls, and two facts
// about it are only true in a rendered browser at a real size:
//
//   (a) NO TWO MARKERS' TARGETS OVERLAP. The pad spreads any pair closer than
//       HUD_MIN_SEP, and §119 made that a rule over every adjacent pair
//       instead of one named one — because §57 named `crown` ⇄ `pusher`, §112
//       then rotated the alarm module, and the pair that collided became
//       `alarm` ⇄ `pusher` at 4.47° with 18-unit hit circles. The pusher,
//       drawn last, took every tap meant for the alarm crown, and every gate
//       in the battery stayed green throughout. main.js boot-asserts the
//       ANGLE; this measures the rendered geometry, which is the thing a
//       finger meets.
//   (b) EACH TARGET CLEARS THE 44 px TOUCH FLOOR §110 derived. §119's wedges
//       clear it along the ring band and fall short across it — that is a
//       reported outcome, not a failure, and printing both numbers is how it
//       stays an outcome someone can argue with rather than a claim.
//
// Not gated, deliberately: like tools/probe-116-locale-fit.mjs, the point is
// that these numbers are MEASURED on purpose rather than assumed. Boot
// warnings are printed too — if the spread's own assert fires, that is the
// headline and the table below is the evidence.
//
//   node tools/probe-119-pad-targets.mjs [--width 1440] [--height 900]
//
// Needs python3 (dev_server.py) and a Playwright Chromium, like ci-battery.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const WIDTH = argOf('--width', 1440), HEIGHT = argOf('--height', 900);
const TOUCH_FLOOR_PX = 44;   // §110's derived floor, quoted here so the report says what it is judging against

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
// Isolated TMPDIR — dev_server.py keeps ONE /__state file per temp dir, and a
// probe sharing the default one can break a battery running beside it (see
// probe-116-locale-fit.mjs, which learned this the expensive way).
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-probe119-'));
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
// ?hud=1 opens the pad from the deep link rather than by clicking the row, so
// this measures a pad that came up on its own. `sync=0` is what makes the pose
// KNOWN: §55 boots by running syncStart(), which pulls the winding crown to
// set the watch to the wall clock, and the head radius is what the
// across-band figure is measured at. Waiting the sync out is not an option
// here — rAF throttles hard in an automated pane (CLAUDE.md's own trap), so
// the eased stem crawls and stalls part way, and a probe that waited for it
// would report a mid-travel pose while looking settled. Merely HAVING the
// param is what skips the boot sync; the value is not read.
await pg.goto(`${base}/index.html?hud=1&sync=0`, { waitUntil: 'load', timeout: 180000 });
await pg.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
await pg.waitForFunction(() => {
  const el = document.getElementById('ctl-hud');
  return el && el.getBoundingClientRect().width > 0;
}, null, { timeout: 30000 });
// SETTLE FIRST. Boot runs syncStart() — it PULLS the crown to set the watch to
// the wall clock — so a pad read straight after load catches the winding crown
// mid-travel and reports its head 6.8 units further out than it rests. The
// head radius is what the across-band figure is measured at, so the pose has
// to be a known one.
//
// Wait on the HEADS, not on the crown-out class: that class carries the
// TARGET, and it clears the moment the sync decides to push home, while
// crownPullT is still easing the stem back (measured: the class was off with
// the head still 2.5 units out, and the across-band figure 0.1 px light for
// it). The eased position is the thing being measured, so the eased position
// is the thing to wait for.
const settled = await pg.waitForFunction(() => {
  const read = () => [...document.querySelectorAll('#ctl-hud .hud-head-g')].map((h) => h.getAttribute('transform')).join('|');
  const now = read();
  const same = window.__probe119Last === now;
  window.__probe119Last = now;
  return same;
}, null, { timeout: 60000, polling: 250 }).then(() => true).catch(() => false);
if (!settled) console.log('    (note: the pad never stopped moving — the numbers below are a mid-travel pose)');

const boot = await pg.evaluate(() => window.__clock.bootWarns || []);
console.log(`\n══ boot (standing rule 6) — ${boot.length === 0 ? 'silent' : `${boot.length} warning(s)`}`);
for (const w of boot) console.log(`    ⚠ ${w}`);

const out = await pg.evaluate(() => {
  const svg = document.querySelector('#ctl-hud svg');
  const r = svg.getBoundingClientRect();
  const k = svg.viewBox.baseVal.width / r.width;   // viewBox units per CSS px
  // Sample each target's own rendered outline: getBoundingClientRect on an
  // SVG path is the ROTATED shape's bounding box, which over-reports a wedge,
  // so walk the path's points instead and measure the shape itself.
  const rows = [...document.querySelectorAll('#ctl-hud [data-ctl]')].map((el) => {
    const g = el.closest('g.hud-g');
    const m = g ? g.transform.baseVal.consolidate() : null;
    const ang = m ? Math.atan2(m.matrix.b, m.matrix.a) * 180 / Math.PI : 0;
    const len = el.getTotalLength ? el.getTotalLength() : 0;
    const pts = [];
    for (let i = 0; i < 240 && len > 0; i++) {
      const p = el.getPointAtLength(len * i / 239);
      const q = g ? p.matrixTransform(m.matrix) : p;   // into the svg's own frame
      pts.push([q.x, q.y]);
    }
    return { id: el.dataset.ctl, tag: el.tagName, angDeg: +ang.toFixed(2), pts,
      headR: el.tagName === 'circle' ? +el.getAttribute('r') : null };
  });
  const heads = Object.fromEntries([...document.querySelectorAll('#ctl-hud .hud-head-g')].map((h) => {
    const g = h.closest('g.hud-g');
    const cls = [...g.classList].find((c) => c.startsWith('hud-g-') && c !== 'hud-g');
    const t = h.transform.baseVal.consolidate();
    return [cls.slice(6), t ? t.matrix.e : 0];
  }));
  const op = (sel) => +document.querySelector(sel).getAttribute('opacity');
  return { k, svgW: +r.width.toFixed(1), padW: +document.getElementById('ctl-hud').getBoundingClientRect().width.toFixed(1), rows, heads,
    pose: [...document.getElementById('ctl-hud').classList].join(' ') || 'at rest',
    hands: { time: op('.hud-pv-time'), alarm: op('.hud-pv-alarm'), ticks: op('.hud-pv-ticks') } };
});

const px = (u) => u / out.k;
console.log(`\n══ the pad — ${out.padW} px wide, its svg ${out.svgW} px, ${out.k.toFixed(4)} viewBox units per px`);
console.log(`    measured with the controls ${out.pose}`);
// §119's hands are always up, so their resting weight is a number worth
// seeing next to the targets: a hand nobody can make out is the same failure
// as a target nobody can hit, one axis over.
console.log(`\n══ §119's hands — time ${out.hands.time}, alarm ${out.hands.alarm}, ticks ${out.hands.ticks}`);
console.log('    (at rest all three sit at HUD_HAND_REST; a setting path takes its own to 1.0)');
console.log(`\n══ (a) targets, and the ${TOUCH_FLOOR_PX} px floor`);
console.log(`    ${'control'.padEnd(9)}${'azimuth'.padStart(9)}${'head R'.padStart(8)}${'shape'.padStart(7)}${'along band'.padStart(12)}${'across@head'.padStart(13)}`);
const named = out.rows.filter((r) => r.id !== 'spin');
let short = 0;
for (const row of out.rows) {
  const xs = row.pts.map((p) => p[0]), ys = row.pts.map((p) => p[1]);
  const rs = row.pts.map((p) => Math.hypot(p[0], p[1]));
  const headR = out.heads[row.id];
  let along, across;
  if (row.tag === 'circle') { along = across = px(2 * (row.headR ?? 0)); }
  else {
    along = px(Math.max(...rs) - Math.min(...rs));
    // Across the band, measured where it matters — at the head's own radius,
    // which is the chord 2·R·sin(half-angle) the wedge spans there.
    const wrapPi = (a) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const mid = row.angDeg * Math.PI / 180;
    const half = Math.max(...row.pts.map((p) => Math.abs(wrapPi(Math.atan2(p[1], p[0]) - mid))));
    across = px(2 * (headR ?? 0) * Math.sin(half));
  }
  const bad = row.id !== 'spin' && Math.min(along, across) < TOUCH_FLOOR_PX;
  if (bad) short++;
  console.log(`    ${row.id.padEnd(9)}${String(row.angDeg).padStart(9)}${(headR == null ? '—' : headR.toFixed(1)).padStart(8)}${row.tag.padStart(7)}`
    + `${(along.toFixed(1) + ' px').padStart(12)}${(across.toFixed(1) + ' px' + (bad ? ' !' : '')).padStart(13)}`);
}
console.log(`\n    ! = under the ${TOUCH_FLOOR_PX} px floor in that axis. ${short} of ${named.length} controls are short in one axis — reported, not failed: closing`);
console.log('    the across-band axis costs ~54° between neighbours, and that much lie about where a control sits is the worse trade.');

console.log('\n══ (b) do any two targets overlap?');
// ABUTTING IS THE DESIGN, NOT A FAULT, and the two have to be told apart.
// §119's wedges TILE: each spans HUD_MIN_SEP/2 either side of its own
// azimuth and the spread leaves neighbours exactly HUD_MIN_SEP apart, so
// adjacent wedges share an edge — and every wedge's inner arc sits on the
// trackball's radius, so each shares an edge with the face too. A naive
// point-in-polygon test calls all of that overlap, because the sampled points
// lie ON the shared edge and parity flips there.
//
// So membership is tested at TOL inside each outline (pull every sample
// toward its own centroid first). A shared edge moves apart under that and
// reads clear; a real overlap is orders of magnitude deeper than TOL and
// still reads. The closest-approach column is printed either way, which is
// what makes the distinction checkable rather than asserted.
const TOL = 0.5;   // viewBox units ≈ 0.4 px — a hair, against wedges 58 units deep
const inside = (pt, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const shrunk = (pts) => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + (cx - x) * (TOL / d), y + (cy - y) * (TOL / d)];
  });
};
const shrunkPts = new Map(out.rows.map((r) => [r.id, shrunk(r.pts)]));
let overlaps = 0;
for (let i = 0; i < out.rows.length; i++) {
  for (let j = i + 1; j < out.rows.length; j++) {
    const a = out.rows[i], b = out.rows[j];
    let gap = Infinity;
    for (const p of a.pts) for (const q of b.pts) gap = Math.min(gap, Math.hypot(p[0] - q[0], p[1] - q[1]));
    const over = shrunkPts.get(a.id).some((p) => inside(p, b.pts))
      || shrunkPts.get(b.id).some((p) => inside(p, a.pts));
    if (over) overlaps++;
    let dAng = a.angDeg - b.angDeg;
    while (dAng > 180) dAng -= 360;
    while (dAng < -180) dAng += 360;
    const verdict = over ? 'OVERLAP' : (gap <= TOL ? 'abutting' : 'clear');
    console.log(`    ${(a.id + ' ⇄ ' + b.id).padEnd(20)}Δaz ${String(dAng.toFixed(2)).padStart(8)}°   closest approach ${gap.toFixed(2)} units (${px(gap).toFixed(1)} px)   ${verdict}`);
  }
}
console.log(`\n    ${overlaps} overlapping pair(s). 'abutting' is a shared edge — the tiling working, and no pixel wasted between two targets.`);

await browser.close();
server.kill();
process.exit(boot.length === 0 && overlaps === 0 ? 0 : 1);
