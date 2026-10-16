// WHICH LEGO PARTS CAN CARRY A FUSEE'S CORD? A report, not a gate: it reads a
// whole LDraw library from disk (unzip LDraw's complete.zip; the run needs no
// network but does need the library, which is not vendored) and prints every
// axle-keyed round part with a CORD GROOVE, its seat and capacity measured by
// technic-fusee.js' own `grooveSeat`, the rows of every USABLE groove not yet
// in FUSEE_PULLEYS (ready to paste into FUSEE_DIM_MM), and the fusee re-solved
// over the catalogue plus those, at most four steps. §219 tier three (b),
// BUILT §285 (src/technic-fusee.js): the survey that asked whether a THIRD STEP
// on the cone could level the spring better than landing H's two.
// Its one fatal path (no --lib, exit 2) files it as ACCEPTANCE in tools/INDEX.md;
// what it prints is a report, and it fails nothing.
//
// THE READING. Every part (title not moved, aliased, a sticker, a pattern, a
// minifig, Duplo, electric, a baseplate, third-party or a shortcut) that draws
// an AXLE-HOLE primitive on an axis through its origin (axlehole, axl2hole,
// axl3hole and their variants: the reduced holes of the half bushes draw
// axl2hole) — keyed on an axle there, as a fusee step must be (a pin hole
// would let the step spin on the fusee) — has its outer radius along that axis
// read off its sampled surface (0.25 LDU, the sampling the catalogue is held
// at, for every part under --fine mm of radius, and --step LDU over it: its
// row says it was read coarser) in 0.1 LDU bins, grooveSeat's own. A GROOVE is
// a local least of the cord's seat (the cord's circle, of the braided string's
// section, resting on that profile) with a WALL either side standing above the
// cord's centre: below that, nothing holds the wrap's plane. Each groove is
// then measured by `grooveSeat` itself, windowed to it. USABLE (✓): on the
// part's own Z, round to a quarter of the cord's diameter, both walls above
// the cord's centre at every angle, and its floor's middle within half a cord
// radius of the origin (the build places a part by its origin and carries the
// offset). THE CEILING beneath prints what off-centre grooves would add if the
// build could mount a part by one of them.
//
// THE CONTROLS, printed first: every catalogued pulley must read its tabled
// seat (FUSEE_DIM_MM) to 1e-3 mm, and a 3×3 disc (2723), round and flat, must
// read no groove.
//
// Read 2026-10-16 on the library of that day: 468 axle-keyed parts, 245
// grooves, 18 usable (landing H's five less the bush with two flanges, whose
// flange dips under the cord's centre, and fourteen more); the solve answers
// two steps on the pulley wheel 5D, 31.61%, its best three-step 47.78%. The
// ceiling's three-step on a solid motorcycle wheel's off-centre gutter (84772)
// is 22.33% against its two-step's 28.00%: the one place a third step wins.
//
//   node tools/ldraw-groove-survey.mjs --lib DIR [--step 1] [--fine 20] [--only p1,p2,…]
//   (DIR holds parts/ and p/, as LDraw's complete.zip unpacks)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseLibrary, placements, normName, bounds, LDU_MM } from '../src/ldraw.js';
import { forEachSurfaceSample } from '../src/technic-ldraw.js';
import { FUSEE_DIM_MM, FUSEE_PULLEYS, grooveSeat, grooveProfile, solveFusee, TECHNIC_FUSEE_SPRING, springBand } from '../src/technic-fusee.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--lib', null), STEP = Number(arg('--step', 1)), FINE = Number(arg('--fine', 20)), ONLY = arg('--only', null);
if (!ROOT || !existsSync(join(ROOT, 'parts'))) { console.log('usage: node tools/ldraw-groove-survey.mjs --lib DIR   (an unpacked LDraw library: DIR/parts, DIR/p)'); process.exit(2); }
const find = (n) => { for (const d of ['parts', 'p']) { const f = join(ROOT, d, n); if (existsSync(f)) return f; } return null; };
function load(part) {
  const seen = new Map(), todo = [normName(`${part}.dat`)];
  while (todo.length) {
    const n = todo.pop(); if (seen.has(n)) continue;
    const f = find(n); if (!f) { seen.set(n, null); continue; }
    const t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); seen.set(n, t);
    for (const line of t.split('\n')) { const s = line.trim().split(/\s+/); if (s[0] === '1') todo.push(normName(s.slice(14).join(' '))); }
  }
  let mpd = ''; for (const [n, t] of seen) if (t) mpd += `0 FILE ${n}\n${t}\n0 NOFILE\n`;
  return parseLibrary(mpd);
}
const title = (part) => { const f = find(`${part}.dat`); return f ? readFileSync(f, 'utf8').split(/\r?\n/)[0].replace(/^0\s+/, '') : ''; };
const cMm = FUSEE_DIM_MM.cordR, c = cMm / LDU_MM;
// ROUND within a quarter of the cord's diameter: a seat that wanders more than
// that round its circumference is no seat (the catalogued five read under it)
const ROUND_MM = cMm / 2;

// the axes a part is keyed on: an axle-hole primitive whose own Y (the hole's
// axis) lies along the part's Y or Z, through the origin
function keyedAxes(lib, part) {
  const axes = new Set();
  for (const q of placements(lib, `${part}.dat`, /axl(e|[2-5])?ho/)) {   // axlehole, axl2hole, axl3ho10, …
    const ay = [q.m[4], q.m[7], q.m[10]], n = Math.hypot(...ay); if (!n) continue;
    if (Math.abs(ay[1] / n) > 0.99 && Math.hypot(q.m[0], q.m[2]) < 0.5) axes.add('y');
    if (Math.abs(ay[2] / n) > 0.99 && Math.hypot(q.m[0], q.m[1]) < 0.5) axes.add('z');
  }
  return [...axes];
}
// the grooves along one axis, as windows (mm) for grooveSeat
function grooveWindows(lib, part, axis, step) {
  const { R, ks, bin } = grooveProfile(lib, part, { step, axis });
  if (!ks.length) return [];
  const K0 = ks[0], K1 = ks[ks.length - 1], Rk = (k) => R.get(k) ?? 0;   // an axial gap is no surface
  const rho = (k) => { let m = 0; for (let j = Math.ceil(k - c / bin); j <= Math.floor(k + c / bin); j++) { const d = (j - k) * bin; if (Math.abs(d) < c) m = Math.max(m, Rk(j) + Math.sqrt(c * c - d * d)); } return m; };
  const rs = []; for (let k = K0; k <= K1; k++) rs.push([k, rho(k)]);
  const out = [];
  for (let i = 1; i < rs.length - 1; i++) {
    const [k, s] = rs[i];
    if (!(s <= rs[i - 1][1] && s < rs[i + 1][1] + 1e-9)) continue;
    let l = k, r = k;
    while (l > K0 && Rk(l) < s) l--;
    while (r < K1 && Rk(r) < s) r++;
    if (Rk(l) < s || Rk(r) < s) continue;          // a side with no wall above the cord's centre
    const w = [l * bin * LDU_MM, r * bin * LDU_MM];
    if (!out.some((o) => Math.abs(o[0] - w[0]) < 1e-9 && Math.abs(o[1] - w[1]) < 1e-9)) out.push(w);
  }
  return out;
}
function survey(part, lib = load(part)) {
  const rows = [];
  for (const axis of keyedAxes(lib, part)) {
    const b = bounds(lib, `${part}.dat`), i = axis === 'y' ? [0, 2] : [0, 1];
    const outerR = Math.max(...i.flatMap((j) => [Math.abs(b.lo[j]), Math.abs(b.hi[j])])) * LDU_MM;
    const step = outerR <= FINE ? 0.25 : STEP;
    for (const window of grooveWindows(lib, part, axis, step)) {
      const g = grooveSeat(lib, part, cMm, { step, axis, window });
      if (!(g.walls[0] > g.seat && g.walls[1] > g.seat)) continue;
      // ROUND: the surface under the cord, around the axis, in 2° bins over
      // the floor and a cord radius either side, must be one radius all the
      // way round, and each WALL (grooveSeat's: a cord diameter outside the
      // floor) must stand above the cord's centre at every angle — a groove a
      // wrap lies in all the way round, not a block's faces or a cross's arms
      // (an empty bin is no metal)
      const f0 = g.floor[0] / LDU_MM, f1 = g.floor[1] / LDU_MM;
      const ring = new Float64Array(180), wl = new Float64Array(180), wr = new Float64Array(180);
      forEachSurfaceSample(lib, part, step, (x, y, z) => {
        const a = axis === 'y' ? y : z; if (a < f0 - 2 * c || a > f1 + 2 * c) return;
        const [u, v] = axis === 'y' ? [x, z] : [x, y], k = Math.floor(((Math.atan2(v, u) / (2 * Math.PI)) % 1 + 1) % 1 * 180) % 180, r = Math.hypot(u, v);
        if (a >= f0 - c && a <= f1 + c) ring[k] = Math.max(ring[k], r);
        if (a <= f0) wl[k] = Math.max(wl[k], r);
        if (a >= f1) wr[k] = Math.max(wr[k], r);
      });
      let rLo = Infinity, rHi = 0; for (const r of ring) { rLo = Math.min(rLo, r); rHi = Math.max(rHi, r); }
      const roundness = (rHi - rLo) * LDU_MM, wallLo = Math.min(...wl, ...wr) * LDU_MM;
      rows.push({ part, axis, window, step, seat: g.seat, walls: g.walls, capacity: g.capacity, floorHalf: (g.floor[1] - g.floor[0]) / 2,
        halfWidth: (axis === 'y' ? b.hi[1] - b.lo[1] : b.hi[2] - b.lo[2]) * LDU_MM / 2, grooveOff: (g.floor[0] + g.floor[1]) / 2, outer: g.outer,
        centred: Math.abs(g.floor[0] + g.floor[1]) / 2 <= cMm / 2,   // the floor's middle within half a cord radius of the origin's plane; the build carries the offset exactly
        roundness, wallLo, round: roundness <= ROUND_MM && wallLo > g.seat });
    }
  }
  return rows;
}

// ── controls
let controlsOk = true;
for (const p of FUSEE_PULLEYS) {
  const rows = survey(p), want = FUSEE_DIM_MM.seat[p];
  const hit = rows.find((r) => Math.abs(r.seat - want) < 1e-3);
  console.log(`control ${p} (${title(p)}): ${rows.map((r) => `seat ${r.seat.toFixed(4)}`).join(', ') || 'no groove'} — tabled ${want}${hit ? '' : '  ✗ NOT READ'}`);
  if (!hit) controlsOk = false;
}
{ const rows = survey('2723'); console.log(`control 2723 (${title('2723')}): ${rows.length ? rows.map((r) => `seat ${r.seat.toFixed(4)}`).join(', ') + '  ✗ a groove on a flat disc' : 'no groove — expected none'}`); if (rows.length) controlsOk = false; }
console.log(controlsOk ? 'controls PASS\n' : 'controls FAIL — the reading below measures nothing\n');

// ── the library
const parts = ONLY ? ONLY.split(',') : readdirSync(join(ROOT, 'parts')).filter((f) => f.endsWith('.dat')).map((f) => f.slice(0, -4));
let read = 0; const hits = [];
for (const [i, p] of parts.entries()) {
  if (i % 2000 === 0) process.stderr.write(`  … ${i} of ${parts.length} files, ${read} keyed parts read\n`);
  const t = title(p);
  if (!t || /^[~=_|]/.test(t) || /Sticker|Pattern|Minifig|Duplo|Electric|Baseplate/i.test(t)) continue;
  if (/c\d\d/.test(p)) continue;                  // a shortcut (a rim with its tyre, …): its parts are read one by one
  let lib; try { lib = load(p); } catch { continue; }
  if (!keyedAxes(lib, p).length) continue;
  read++;
  let rows; try { rows = survey(p, lib); } catch { continue; }
  for (const r of rows) hits.push({ ...r, title: t });
}
hits.sort((a, b) => a.seat - b.seat);
console.log(`${read} axle-keyed parts read; ${hits.length} grooves with a wall either side above the cord's centre:`);
const usable = (h) => h.axis === 'z' && h.centred && h.round;
for (const h of hits) console.log(`  ${usable(h) ? '✓' : ' '} ${h.part.padEnd(9)} seat ${h.seat.toFixed(4).padStart(8)} mm  walls ${h.walls.map((w) => w.toFixed(2)).join('/')}  holds ${h.capacity}  round to ${h.roundness.toFixed(2)}, walls at least ${h.wallLo.toFixed(2)}  about ${h.axis}${h.centred ? '' : ` in [${h.window.map((v) => v.toFixed(2)).join(', ')}]`}${h.step !== 0.25 ? `  (read at ${h.step} LDU)` : ''}  ${h.title}`);
console.log(`  (✓ USABLE by the build: keyed on its own Z, its groove's floor centred within half a cord radius of its origin — the build places a pulley by its origin, its Z along the axle, and carries that offset — round to ${ROUND_MM} mm, and its walls above the cord's centre at every angle)`);

// ── the re-solve: the catalogue plus every hit on its own Z, centred on its
// origin (the build places a pulley by its origin, its Z along the axle), one
// row per part (its deepest groove)
const add = new Map();
for (const h of hits) if (usable(h) && !FUSEE_PULLEYS.includes(h.part) && (!add.has(h.part) || h.seat < add.get(h.part).seat)) add.set(h.part, h);
const D = FUSEE_DIM_MM, P = [...FUSEE_PULLEYS, ...add.keys()];
const pick = (k) => ({ ...D[k], ...Object.fromEntries([...add].map(([p, h]) => [p, h[k]])) });
const sol = solveFusee(TECHNIC_FUSEE_SPRING, { pulleys: P, seat: pick('seat'), capacity: pick('capacity'), halfWidth: pick('halfWidth'), floorHalf: pick('floorHalf'), maxSteps: 4 });
console.log(`\nusable and not yet catalogued, as rows: ${JSON.stringify(Object.fromEntries([...add].map(([p, h]) => [p, { seat: +h.seat.toFixed(4), capacity: h.capacity, halfWidth: +h.halfWidth.toFixed(4), floorHalf: +h.floorHalf.toFixed(2), rim: +h.outer.toFixed(4), grooveOff: +h.grooveOff.toFixed(2), window: h.window.map((v) => +v.toFixed(2)), step: h.step }])))}`);
console.log(`\nre-solve (at most four steps) over ${P.length} pulleys (band ${springBand(TECHNIC_FUSEE_SPRING).toFixed(4)} barrel turns):`);
for (const n of [1, 2, 3, 4]) {
  const r = sol.ranked.find((q) => q.steps.length === n);
  console.log(`  best ${n}-step: ${r ? `barrel ${r.barrel}, cone ${r.steps.join(' > ')}, f ${r.f.toFixed(3)}, spread ${(r.spread * 100).toFixed(2)}%` : 'none runs'}`);
}
console.log(`  the solve's answer: barrel ${sol.best.barrel}, cone ${sol.best.steps.join(' > ')}, spread ${(sol.best.spread * 100).toFixed(2)}% (bare ${(sol.best.bare * 100).toFixed(2)}%)`);
// THE CEILING: every round groove on a part's own Z, off-centre ones too (a
// two-groove part offers both), as if the build could place a groove anywhere
// along its part — what a third step could reach if it could. Grooves of one
// seat (to 0.01 mm) are one row, the widest; steps are the seats a cone can
// use (3–14 mm) and barrels those of 18 mm or more, where the free search says
// a third step could ever win; at most three steps.
const all = new Map();
const put = (k, r) => { const key = `${r.seat.toFixed(2)}`; if (!all.has(key) || all.get(key).capacity < r.capacity) all.set(key, { ...r, name: k }); };
for (const p of FUSEE_PULLEYS) put(p, { seat: D.seat[p], capacity: D.capacity[p], halfWidth: D.halfWidth[p], floorHalf: D.floorHalf[p] });
for (const h of hits) if (h.axis === 'z' && h.round) put(`${h.part}@${h.window.map((v) => v.toFixed(2)).join('..')}`, { seat: h.seat, capacity: h.capacity, halfWidth: (h.window[1] - h.window[0]) / 2, floorHalf: h.floorHalf });
for (const [k, r] of [...all]) if (!(r.seat <= 14 || r.seat >= 18)) all.delete(k);
const col = (k) => Object.fromEntries([...all].map(([p, h]) => [p, h[k]]));
const ceil = solveFusee(TECHNIC_FUSEE_SPRING, { pulleys: [...all.keys()], seat: col('seat'), capacity: col('capacity'), halfWidth: col('halfWidth'), floorHalf: col('floorHalf'), maxSteps: 3 });
const nm = col('name');
console.log(`\nthe ceiling, off-centre grooves placed as if centred (${all.size} grooves):`);
for (const n of [2, 3]) {
  const r = ceil.ranked.find((q) => q.steps.length === n);
  console.log(`  best ${n}-step: ${r ? `barrel ${nm[r.barrel]}, cone ${r.steps.map((k) => nm[k]).join(' > ')}, spread ${(r.spread * 100).toFixed(2)}%` : 'none runs'}`);
}
