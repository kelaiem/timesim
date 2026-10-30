// WHICH LEGO PARTS CAN CARRY A DEAD-BEAT'S LOCKING FACE? A report, not a gate: it reads a whole LDraw library from
// disk (unzip LDraw's complete.zip, as tools/ldraw-groove-survey.mjs does; or, with --fetch, only the parts named by
// --only, fetched from library.ldraw.org through tools/ldraw-fetch.mjs, ldraw-vendor's own fetcher, into a cache) and
// prints every part whose outline carries a USABLE ARC: a partial circle about a point a LEGO mount can reach. BUILT
// §323 (src/technic-deadbeat.js): the survey that decides whether a Graham's pallets can be made of real parts.
// Its fatal paths (no library, a control that reads wrong: exit 2 and 1) file it as ACCEPTANCE in tools/INDEX.md;
// what it prints is a report.
//
// THE READING (src/technic-deadbeat.js' own laws, so the survey and the escapement read one geometry). Each part's
// SILHOUETTE in each principal plane (`silhouette`, a quarter-LDU grid of every triangle's projection) is read in
// polar coordinates about every LATTICE point of that plane (`latticeCentres`: the half-stud grid in phase with the
// part's studs, and its own holes) by `arcsAbout`: a run of boundary at one radius covering at least 60° is an arc,
// its radius and ROUNDNESS read off the part's own vertices there (the LDraw polygon's spread in radius). USABLE (✓):
//   · PARTIAL (under 330°): a full circle can only be coaxial, and a pallet must let the tooth pass;
//   · CONVEX or CONCAVE (the material on one side, which is what a tooth can bear on);
//   · ROUND to F2's play (roundness under 0.1 mm, the play the lock is held against);
//   · a WALL: the part's vertices on the arc span at least a stud's height (1.6 mm) along the plane's normal (a ball's
//     or a tyre's outline is round in projection and is not a face a tooth can bear on);
//   · radius from 4 mm (a tooth's whole depth, 2.18 mm on the 8T, must fit inside the lock) to 40 mm (beyond, the
//     escape wheel would hang lower than any arbor §287's lattice offers under the knife);
//   · its centre a lattice point or a hole, and the part no more than 240 LDU across (12 studs: a pallet rides on the
//     balance, whose arms reach 32 mm).
// Each usable arc also reads the material BEHIND its face (`thicknessBehind`, the least over its span): a Graham
// pallet dips into the tooth circle between two teeth, so that is the number a pallet must keep under a tooth gap;
// the slenderest of each kind are listed last.
//
// THE CONTROLS, printed first: the 3×3 disc (2723) must read a FULL circle of 12.000 mm about its axle hole, round to
// 0.01 mm; a 1×2 plate (3023b) must read no arc at all; the 2×2 quarter circle plate (7904) must read its 16 mm
// convex quarter about its corner.
//
//   node tools/ldraw-arc-survey.mjs --lib DIR [--only p1,p2,…]
//   node tools/ldraw-arc-survey.mjs --fetch CACHE --only p1,p2,…
//   (DIR holds parts/ and p/, as LDraw's complete.zip unpacks)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseLibrary, normName, LDU_MM } from '../src/ldraw.js';
import { silhouette, arcsAbout, latticeCentres, thicknessBehind } from '../src/technic-deadbeat.js';
import { F2_PLAY_MM } from '../src/technic-escapement.js';
import { LEGO_DIM_MM } from '../src/technic-frame.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
let ROOT = arg('--lib', null);
const FETCH = arg('--fetch', null), ONLY = arg('--only', null);
const USABLE = { minR: 4, maxR: 40, maxSpanDeg: 330, maxExtentLDU: 240 };
if (FETCH) {
  if (!ONLY) { console.log('--fetch needs --only'); process.exit(2); }
  const { fetchParts } = await import('./ldraw-fetch.mjs');
  await fetchParts(FETCH, ONLY.split(',').map((p) => `${p}.dat`));
  ROOT = FETCH;
}
if (!ROOT || !existsSync(join(ROOT, 'parts'))) { console.log('usage: node tools/ldraw-arc-survey.mjs --lib DIR | --fetch CACHE --only p1,…   (an LDraw library: DIR/parts, DIR/p)'); process.exit(2); }
const find = (n) => { for (const d of ['parts', 'p']) { const f = join(ROOT, d, n); if (existsSync(f)) return f; } return null; };
function load(part) {
  const seen = new Map(), todo = [normName(`${part}.dat`)];
  while (todo.length) {
    const n = todo.pop(); if (seen.has(n)) continue;
    const f = find(n); if (!f) { seen.set(n, null); continue; }
    const t = readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); seen.set(n, t);
    for (const l of t.split('\n')) { const w = l.trim().split(/\s+/); if (w[0] === '1' && w.length >= 15) todo.push(normName(w.slice(14).join(' '))); }
  }
  if ([...seen.values()].some((t) => t === null)) return null;
  return parseLibrary([...seen].map(([n, t]) => `0 FILE ${n}\n${t}\n0 NOFILE`).join('\n'));
}
const title = (part) => { const f = find(`${part}.dat`); if (!f) return null; const l = readFileSync(f, 'utf8').split('\n')[0] ?? ''; return l.replace(/^0\s+/, '').trim(); };
const SKIP = /^(~|=|_|Sticker|Minifig|Duplo|Primo|Quatro|Electric|Baseplate|Animal|Figure|Belville|Scala|Fabuland|Znap|Clikits|Homemaker|Train Track|Road|Plant|Cloth|String|Rubber|Hose|Flex|Bionicle|Hero Factory|Tyre|Tire)/i;
const isPattern = (p) => /p[0-9a-z]{2,}$/i.test(p) && !/^[0-9]+$/.test(p);

function survey(part, lib) {
  const rows = [];
  for (const normal of [0, 1, 2]) {
    let sil;
    try { sil = silhouette(lib, part, { normal, res: 0.25, cache: false }); } catch { return null; }
    if (Math.max(sil.hi[0] - sil.lo[0], sil.hi[1] - sil.lo[1]) > USABLE.maxExtentLDU) return { tooBig: true, rows };
    for (const c of latticeCentres(lib, part, sil)) for (const a of arcsAbout(lib, sil, c.c)) {
      const rmm = a.r * LDU_MM, rnd = a.roundness * LDU_MM, spanDeg = a.span * 180 / Math.PI;
      const usable = spanDeg < USABLE.maxSpanDeg && a.kind !== 'thin' && rnd < F2_PLAY_MM && rmm >= USABLE.minR && rmm <= USABLE.maxR && a.faceHeight * LDU_MM >= LEGO_DIM_MM.studH;
      // how much material stands behind the face (mm, least over its span): a pallet dips between two teeth
      const behind = usable ? thicknessBehind(sil, c.c, a).least : null;
      if (usable && behind === null) continue;
      rows.push({ part, normal: 'xyz'[normal], centre: c.c, at: c.kind, rmm, rnd, spanDeg, fromDeg: a.from * 180 / Math.PI, kind: a.kind, usable, behind, wall: a.faceHeight * LDU_MM });
    }
  }
  // the same arc read in two planes or about two neighbouring points: one row per (radius, kind, plane, centre)
  const seen = new Set();
  return { rows: rows.filter((r) => { const k = `${r.normal}|${r.centre}|${r.rmm.toFixed(2)}|${r.kind}`; if (seen.has(k)) return false; seen.add(k); return true; }) };
}

// ── CONTROLS
let bad = 0;
const ctl = (name, ok, got) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — read ${got}`}`); if (!ok) bad++; };
console.log('controls:');
{
  const disc = load('2723'), plate = load('3023b'), quarter = load('7904');
  if (!disc || !plate || !quarter) { console.log('  the control parts are not in the library'); process.exit(2); }
  const d = survey('2723', disc).rows.filter((r) => r.normal === 'y' && r.at === 'hole');
  ctl('the 3×3 disc (2723) reads a FULL 12.000 mm circle about its axle hole, round to 0.01 mm', d.some((r) => r.spanDeg > 355 && Math.abs(r.rmm - 12) < 1e-3 && r.rnd < 0.01 && !r.usable), JSON.stringify(d.map((r) => [r.rmm, r.spanDeg, r.rnd])));
  const p = survey('3023b', plate).rows;
  ctl('a 1×2 plate (3023b) reads no arc', p.length === 0, JSON.stringify(p.map((r) => [r.rmm, r.spanDeg])));
  const q = survey('7904', quarter).rows.filter((r) => r.usable);
  ctl('the 2×2 quarter circle plate (7904) reads its 16 mm convex quarter about its corner', q.some((r) => r.kind === 'convex' && Math.abs(r.rmm - 16) < 0.05 && Math.abs(r.spanDeg - 90) < 1), JSON.stringify(q.map((r) => [r.rmm, r.spanDeg, r.kind])));
}
if (bad) { console.log(`\n${bad} control(s) read wrong: the survey measures nothing`); process.exit(1); }

// ── THE LIBRARY
const names = ONLY ? ONLY.split(',') : readdirSync(join(ROOT, 'parts')).filter((f) => f.endsWith('.dat')).map((f) => f.slice(0, -4));
let read = 0, skipped = 0, big = 0;
const usable = [], full = [];
const t0 = Date.now();
for (const part of names) {
  const t = title(part);
  if (!t || SKIP.test(t) || isPattern(part)) { skipped++; continue; }
  const lib = load(part);
  if (!lib) { skipped++; continue; }
  const s = survey(part, lib);
  if (!s) { skipped++; continue; }
  read++;
  if (s.tooBig) { big++; continue; }
  for (const r of s.rows) { if (r.usable) usable.push({ ...r, title: t }); else if (r.spanDeg >= 355 && r.kind !== 'thin') full.push({ ...r, title: t }); }
  if (read % 500 === 0) console.error(`  … ${read} parts read, ${usable.length} usable arcs, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log(`\nread ${read} parts (${skipped} skipped by title, pattern or a missing file; ${big} wider than ${USABLE.maxExtentLDU} LDU), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`USABLE ARCS: ${usable.length}, on ${new Set(usable.map((r) => r.part)).size} parts (partial, convex or concave, round under ${F2_PLAY_MM} mm, ${USABLE.minR}–${USABLE.maxR} mm, about a lattice point or a hole)`);
usable.sort((a, b) => (a.at === 'hole') - (b.at === 'hole') || a.rmm - b.rmm);
for (const r of usable) console.log(`  ✓ ${r.part.padEnd(10)} ${r.kind.padEnd(8)} r ${r.rmm.toFixed(3)} mm  ${r.spanDeg.toFixed(1)}° from ${r.fromDeg.toFixed(1)}°  roundness ${r.rnd.toFixed(4)} mm  behind ${r.behind.toFixed(2)} mm  wall ${r.wall.toFixed(1)} mm  about ${r.at} (${r.centre}) in the ${r.normal}-normal plane  — ${r.title}`);
// the slenderest of each kind: the material behind the face is what must fit between two teeth
for (const kind of ['convex', 'concave']) {
  const k = usable.filter((r) => r.kind === kind).sort((a, b) => a.behind - b.behind);
  console.log(`\nTHE SLENDEREST ${kind.toUpperCase()} ARCS (least material behind the face):`);
  for (const r of k.slice(0, 12)) console.log(`  ${r.part.padEnd(10)} ${r.behind.toFixed(2)} mm behind, r ${r.rmm.toFixed(2)} mm, ${r.spanDeg.toFixed(0)}°, about ${r.at} — ${r.title}`);
}
const byHole = usable.filter((r) => r.at === 'hole');
console.log(`\nof them about one of the part's OWN HOLES: ${byHole.length} (${[...new Set(byHole.map((r) => r.part))].join(', ') || 'none'})`);
console.log(`FULL CIRCLES (coaxial only, no pallet): ${full.length} on ${new Set(full.map((r) => r.part)).size} parts`);
process.exit(0);
