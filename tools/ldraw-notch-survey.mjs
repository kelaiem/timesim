// IS THERE A LEGO DISC WITH ONE NOTCH? A report, not a gate: it reads a whole
// LDraw library from disk (unzip LDraw's complete.zip; the run needs no
// network but does need the library, which is not vendored) and prints every
// axle-keyed round part whose outline carries ONE or TWO notches. §219 tier
// three (b), landing I (src/technic-alarm.js) refused a stock notched disc on
// this survey's answer, and built the notch instead: a ring of three pins.
// Its one fatal path (no --lib, exit 2) files it as ACCEPTANCE in tools/INDEX.md;
// what it prints is a report, and it fails nothing.
//
// THE READING. Every part (title not moved, aliased, a sticker, a pattern, a
// minifig, Duplo, electric or a baseplate) that draws an AXLE-HOLE primitive on
// an axis through its origin (its own Y or Z) — a part keyed on an axle there —
// has its outer radius per degree read off its sampled surface
// (technic-ldraw.js' surfaceSamples, 1.5 LDU, so a round rim reads round: a
// first draft read vertices alone and called every rim notched). A NOTCH is a
// contiguous arc deeper than --depth LDU under the part's farthest surface; the
// part is reported when it has one or two such arcs, none wider than 150°, and
// its rim stands within an LDU of its farthest surface over at least 90°. The
// controls are printed first: a 40T (forty notches, its tooth gaps) and a 3×3
// disc (none), read the same way.
//
//   node tools/ldraw-notch-survey.mjs --lib DIR [--depth 3]
//   (DIR holds parts/ and p/, as LDraw's complete.zip unpacks)
//
// Read 2026-10-15 on the library of 2026-09-30: 408 axle-keyed parts, and the
// only hits were tyre treads one degree wide (4265ac01, 6580ac01, 6580bc01):
// no disc with a notch a lever's nose could drop into.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseLibrary, placements, normName } from '../src/ldraw.js';
import { surfaceSamples } from '../src/technic-ldraw.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--lib', null), DEPTH = Number(arg('--depth', 3));
if (!ROOT || !existsSync(join(ROOT, 'parts'))) { console.log('usage: node tools/ldraw-notch-survey.mjs --lib DIR   (an unpacked LDraw library: DIR/parts, DIR/p)'); process.exit(2); }
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
function notches(part) {
  const lib = load(part);
  const axes = new Set();
  for (const q of placements(lib, `${part}.dat`, /axlehol|axleho/)) {
    const ay = [q.m[4], q.m[7], q.m[10]], n = Math.hypot(...ay); if (!n) continue;
    if (Math.abs(ay[1] / n) > 0.99 && Math.hypot(q.m[0], q.m[2]) < 0.5) axes.add('y');
    if (Math.abs(ay[2] / n) > 0.99 && Math.hypot(q.m[0], q.m[1]) < 0.5) axes.add('z');
  }
  const out = [];
  const pts = axes.size ? surfaceSamples(lib, part, 1.5) : [];
  for (const ax of axes) {
    const B = 360, r = new Float64Array(B);
    for (const [x, y, z] of pts) { const [u, v] = ax === 'z' ? [x, y] : [x, z]; const k = Math.floor((((Math.atan2(v, u) / (2 * Math.PI)) % 1) + 1) % 1 * B) % B; r[k] = Math.max(r[k], Math.hypot(u, v)); }
    for (let i = 0; i < B; i++) if (!r[i]) { let a = 1; while (a < B && !r[(i + a) % B] && !r[(i - a + B) % B]) a++; r[i] = Math.max(r[(i + a) % B], r[(i - a + B) % B]); }
    let rMax = 0; for (const v of r) rMax = Math.max(rMax, v);
    const low = Array.from(r, (v) => v < rMax - DEPTH), rim = r.filter((v) => v > rMax - 1).length;
    const first = low.indexOf(false); if (first < 0) continue;
    const arcs = []; let start = -1;
    for (let s = 0; s < B; s++) { const i = (first + s) % B; if (low[i] && start < 0) start = s; if (!low[i] && start >= 0) { arcs.push(s - start); start = -1; } }
    if (start >= 0) arcs.push(B - start);
    out.push({ ax, rMax, arcs, rim });
  }
  return { axes: axes.size, out };
}
for (const [p, want] of [['3649', 'forty notches'], ['2723', 'none']]) {
  const n = notches(p);
  console.log(`control ${p} (${title(p)}): ${n.out.map((o) => `${o.arcs.length} notch${o.arcs.length === 1 ? '' : 'es'}`).join(', ')} — expected ${want}`);
}
const parts = readdirSync(join(ROOT, 'parts')).filter((f) => f.endsWith('.dat')).map((f) => f.slice(0, -4));
let read = 0;
const hits = [];
for (const p of parts) {
  const t = title(p);
  if (!t || /^[~=_]/.test(t) || /Sticker|Pattern|Minifig|Duplo|Electric|Baseplate/i.test(t)) continue;
  let n; try { n = notches(p); } catch { continue; }
  if (!n.axes) continue;
  read++;
  for (const o of n.out) if (o.rMax >= 15 && o.arcs.length >= 1 && o.arcs.length <= 2 && Math.max(...o.arcs) <= 150 && o.rim >= 90) hits.push(`${p}\t${t}\tabout ${o.ax}: rim ${o.rMax.toFixed(1)} LDU, notch${o.arcs.length > 1 ? 'es' : ''} ${o.arcs.join(' + ')}° wide, the rim within an LDU of it over ${o.rim}°`);
}
console.log(`${read} axle-keyed parts read; ${hits.length} with one or two notches deeper than ${DEPTH} LDU:`);
for (const h of hits) console.log(`  ${h}`);
