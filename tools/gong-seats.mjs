#!/usr/bin/env node
// WRITES src/gong-seats.js (BUILT §310 landing 2): where the alarm gong stands in each FITTED form case, and
// what it rings there. The build cannot solve this itself — the seat needs the whole movement's metal in the
// wire's band, and the gong and the hammer are cut long before the last of it — so the seats are GENERATED
// here from booted builds and committed, never typed. The build reads its row early, solves the strike
// exactly against its own live lever (GS.seatStrike) and, once every part is cut, re-measures the band with
// the SAME functions this tool solved on (GS.bandParts / bandNearest) and warns if the seat no longer holds.
//
//   node tools/gong-seats.mjs --write             every kind (rect, cushion, tonneau), both seats; a few minutes
//   node tools/gong-seats.mjs --check             re-derive and compare with the committed file (same cost)
//   node tools/gong-seats.mjs --write rect        one kind (rows are merged into the committed file)
//
// Per kind, a FIXED POINT. The fit of the case (?formrect=) is measured off the counted metal, and the hammer
// is counted; the seat moves the hammer, so the seat and the fit are solved together: boot the kind unfitted
// for its first fit; boot at that fit with ?gong=arc (the round build's hammer, which the band map excludes)
// and read the band's metal, the lever and the outline; solve; write the candidate seat; boot the SEATED
// build at that fit and read its fit back; repeat until the fit stops moving (to the URL's 0.01 u), at most
// five rounds. A kind that does not close is reported and not written.
//
// What each seat is solved TO, each a constraint already in the build: the §197 envelope for the
// fundamental (1–4 kHz; the length is solved to its geometric centre unless the room caps it), the hammer
// re-sited on its lifting lever's circle and struck at the wire's FREE END (the loudest fundamental), the blow
// outward (§198's rule, toward the case), the wire one wire-plus-margin clear of every hull in its band and
// of the outline, its block wholly on plate. Among the seats that pass, the family is the owner's (a bar
// along a flat edge where the case has one, else the straightest bar; ?gong=spiral a spiral on its own
// block), and inside it the seat whose hammer pivot moves LEAST from the round build's — the fold rule's
// cheapest position change.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as GS from '../src/gong-solve.js';
import { caseShapeOf, configKey, SPEC } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/gong-seats.js');
const ARGS = process.argv.slice(2), WRITE = ARGS.includes('--write'), CHECK = ARGS.includes('--check');
// --modes bar,spiral (the default both): which seats to solve; a mode left out keeps its committed row
const MODES = ARGS.includes('--modes') ? ARGS[ARGS.indexOf('--modes') + 1].split(',') : ['bar', 'spiral'];
const KINDS = ARGS.filter((a, i) => !a.startsWith('--') && ARGS[i - 1] !== '--modes').length
  ? ARGS.filter((a, i) => !a.startsWith('--') && ARGS[i - 1] !== '--modes') : ['rect', 'cushion', 'tonneau'];
if (!MODES.every((m) => m === 'bar' || m === 'spiral')) { console.error(`--modes takes bar and/or spiral (got ${MODES.join(',')})`); process.exit(2); }
if (WRITE === CHECK) { console.error('usage: node tools/gong-seats.mjs --write | --check [kind …]'); process.exit(2); }
export const BAND_HZ = [1000, 4000];   // §197: a struck alarm gong's fundamental (GONG §197 assert, 1–4 kHz)
const RES = 0.25;                      // the map's cell: under the margin the wire must clear by (CLEAR_MARGIN 0.15 + the wire's own radius)

const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
let seatsText = readFileSync(OUT, 'utf8');      // what the server hands the page as src/gong-seats.js
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p === '/src/gong-seats.js') { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }).end(seatsText); return; }
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
const boot = async (q) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage(), warnings = [];
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(m.text()); });
  page.on('pageerror', (e) => warnings.push('PAGEERROR ' + e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&${q}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 600000, polling: 1000 });
  const out = await page.evaluate(() => {
    if (window.__bootError) return { bootError: String(window.__bootError.message || window.__bootError) };
    const c = window.__clock, g = c.gongSeat;
    return { rect: c.formFootprint?.rect ?? null, regions: JSON.parse(JSON.stringify(c.regions)),
      seat: g && { tenants: JSON.parse(JSON.stringify(g.tenants)), pivot: g.pivot, mode: g.mode, seated: g.seated, refused: g.refused, strike: g.strike, check: g.check, lever: g.lever, wireR: g.wireR, wireD_m: g.wireD_m,
        zGong: g.zGong, postR: g.postR, postRAt: [10, 20, 30, 40, 50, 60, 70, 80].map((L) => [L, g.postRFor(L)]) } };
  });
  await ctx.close();
  return { ...out, warnings };
};
const sameRect = (a, b) => a && b && a.every((v, i) => Math.abs(v - b[i]) < 0.005);
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const seatModuleText = (seats) => `// GENERATED by tools/gong-seats.mjs — never edit by hand; re-run the tool (--check re-derives it).
//
// BUILT §310 landing 2: per FITTED form case, the alarm gong's seat — its wire's centreline from the free end
// (gong-solve.js seatCurve), the side the hammer's face stands on (sg) and where the lever's root lies along it
// (strikeS, arc length from the free end), what it rings (in-plane f, out-of-plane fo, Hz), the fit it was
// solved at (formrect) and the spec it was solved for (specKey). The build solves the strike again against its
// own lever and re-measures the band at boot.
export const GONG_SEATS = Object.freeze(${JSON.stringify(seats, null, 1).replace(/\n\s*/g, ' ')});
`;
const loadSeats = (text) => { const m = text.match(/GONG_SEATS = Object\.freeze\(([\s\S]*)\);\s*$/); return m ? JSON.parse(m[1]) : {}; };

function pickSeat(mode, res, roundPivot) {
  const disp = (r) => Math.hypot(r.hammer.pivot[0] - roundPivot.x, r.hammer.pivot[1] - roundPivot.y);
  let pool;
  if (mode === 'bar') {
    pool = res.filter((r) => r.fam === 'edge');
    if (!pool.length) pool = res.filter((r) => r.fam === 'any' && !r.k);
    if (!pool.length) pool = res.filter((r) => r.fam === 'any');
  } else pool = res.filter((r) => r.fam === 'spiral');
  pool.sort((a, b) => disp(a) - disp(b) || Math.abs(Math.log(a.f[0] / Math.sqrt(BAND_HZ[0] * BAND_HZ[1]))) - Math.abs(Math.log(b.f[0] / Math.sqrt(BAND_HZ[0] * BAND_HZ[1]))));
  return pool.map((r) => ({ ...r, pivotMoved: disp(r) }));
}
// §38/TODO 8's guard fires at RUNTIME on a starved frame (a loaded machine), on any build: no seat's warning
const RUNTIME = /§38\/TODO 8: the alarm's coincidence was crossed/;
// the solver's result as the analytic centreline the build reads (from its free end), rounded to the table's 1e-6
function rowCurve(r) {
  const [x0, y0] = r.pts[0];
  const th = r.spiral ? r.spiral.th : Math.atan2(r.pts[1][1] - y0, r.pts[1][0] - x0);
  return r.spiral ? { type: 'spiral', sx: r6(r.spiral.sx), sy: r6(r.spiral.sy), th: r6(r.spiral.th), r0: r.spiral.r0, p: r.spiral.p, turn: r.spiral.turn, L: r6(r.L) }
    : (r.fam === 'edge' || !r.k) ? { type: 'line', sx: r6(x0), sy: r6(y0), th: r6(th), L: r6(r.L) }
    : { type: 'arc', sx: r6(x0), sy: r6(y0), th: r6(r.th), k: r.k, L: r6(r.L) };
}
function rowOf(kind, mode, r, rect, lever, wireR, mapInfo, st) {
  const curve = rowCurve(r);
  // strikeS is the EXACT root on the analytic curve (GS.seatStrike, the build's own solve), not the sampled one
  // TODO 269: a spiral is struck ALONG its end (blow 'tangent'), so it has no face side and its strike is s = 0
  return { kind, mode, fam: r.fam, label: r.label, curve, ...(r.blow === 'tangent' ? { blow: 'tangent' } : {}), sg: r.hammer.side, strikeS: r6(st.s),
    f: r.f.map((v) => Math.round(v * 100) / 100), fo: r.fo.map((v) => Math.round(v * 100) / 100), band: BAND_HZ,
    pivot: r.hammer.pivot.map(r6), face: r.hammer.face.map(r6), pivotMoved: r6(r.pivotMoved),
    formrect: rect, specKey: configKey({ spec: { ...SPEC, caseShape: kind } }), wireR: r6(wireR), map: mapInfo };
}

const committed = loadSeats(seatsText), derived = JSON.parse(JSON.stringify(committed));
let failed = false;
for (const kind of KINDS) {
  console.log(`== ${kind}`);
  const first = await boot(`case=${kind}&gong=arc`);
  if (first.bootError) { console.error(`  boot failed: ${first.bootError}`); failed = true; continue; }
  const rows = {};
  for (const m of ['bar', 'spiral']) if (!MODES.includes(m) && committed[kind]?.[m]) rows[m] = committed[kind][m];
  // EACH SEAT CLOSES ITS OWN FIT: the bar and the spiral move the hammer to different stations, so each is
  // solved and re-booted at the fit its own seated build needs (the spiral rides ?gong=spiral)
  for (const mode of MODES) {
    let rect = first.rect, row = null, closed = false;
    for (let round = 1; round <= 5 && !closed; round++) {
      // no seat for this kind while its band is read: the arc build is what the measure sees
      const others = JSON.parse(JSON.stringify(derived)); delete others[kind];
      seatsText = seatModuleText({ ...others, ...(Object.keys(rows).length ? { [kind]: rows } : {}) });
      const arc = await boot(`case=${kind}&formrect=${rect.join(',')}&gong=arc`);
      if (arc.bootError) { console.error(`  arc boot failed: ${arc.bootError}`); break; }
      const S = arc.seat, shape = caseShapeOf(kind, { xMin: rect[0], xMax: rect[1], yMin: rect[2], yMax: rect[3] });
      const need = S.wireR + S.lever.margin;
      // the counted metal's hulls (the hammer excepted: it is the seat's own) and the plates' tenants in the band
      const parts = [...GS.bandParts(arc.regions, S.zGong - S.wireR, S.zGong + S.wireR, S.lever.margin, new Set(['Alarm hammer'])),
        ...GS.bandParts(S.tenants, S.zGong - S.wireR, S.zGong + S.wireR, S.lever.margin)];
      const W = Math.ceil((rect[1] - rect[0]) / RES) + 2, H = Math.ceil((rect[3] - rect[2]) / RES) + 2;
      const map = GS.bandMap(parts, { x0: rect[0] - RES, y0: rect[2] - RES, W, H, RES, need, inset: (x, y) => shape.inset(x, y) });
      const lever = { Q: S.lever.Q, rho: S.lever.rho, tanLen: S.lever.tanLen, side: S.lever.side, gap: S.lever.gap, headR: S.lever.headR, headH: S.lever.headH,
        postR: S.lever.postR, margin: S.lever.margin, inboard: 3, outward: true };
      // the block's radius at the shortest wire the band admits (the clamp condition's ¼ power makes it the largest)
      const footR = Math.max(...S.postRAt.map(([, r]) => r));
      const base = { free: map.free, W, H, x0: map.x0, y0: map.y0, RES, loop: shape.loop(), pillars: [], need, footR, plateInset: (x, y) => shape.inset(x, y) };
      const opts = { fLo: BAND_HZ[0], fHi: BAND_HZ[1], strike: 'end', rank: 'pitch', wireD_m: S.wireD_m, wireR: S.wireR, lever };
      const free = map.free.reduce((t, v) => t + v, 0);
      const mapInfo = { cells: W * H, free, parts: parts.length, res: RES, need: r6(need) };
      console.log(`  ${mode} round ${round}: fit [${rect.join(', ')}], ${parts.length} hulls in the band, ${free} of ${W * H} cells free`);
      // GONG_DUMP=dir writes the map and options each round solves on, so the solver can be read in Node alone
      if (process.env.GONG_DUMP) await writeFile(join(process.env.GONG_DUMP, `${kind}-${mode}-${round}.json`), JSON.stringify({ base: { ...base, free: Array.from(base.free), plateInset: null }, opts, rect, loop: shape.loop() }));
      const res = GS.solveGong(base, mode === 'bar' ? { ...opts, edge: true, any: true } : { ...opts, spiral: true }).results;
      // the candidates in the family's order; a seat is ADMITTED only if its seated build adds no boot
      // warning the arc build at this fit lacks (the hammer's new station must not cost any other part
      // its own assert — the fold rule's P3: the move is refused, never paid for), tried four deep
      const pool = pickSeat(mode, res, arc.seat.pivot);   // the round build's hammer pivot, which the fold moves least
      if (!pool.length) { console.log(`  ${mode}: no seat the lever reaches`); break; }
      let seated = null, pick = null;
      for (const cand of pool.slice(0, 4)) {
        const sh = (q) => q.map((v) => v.toFixed(2)).join(', ');
        console.log(`  ${mode}: ${cand.label} (${cand.fam}), L ${cand.L.toFixed(2)} u, f ${cand.f.map((v) => v.toFixed(0)).join(' / ')} Hz, out of plane ${cand.fo.map((v) => v.toFixed(0)).join(' / ')}; free end (${sh(cand.pts[0])}), foot (${sh(cand.pts.at(-1))}); pivot (${sh(cand.hammer.pivot)}), moved ${cand.pivotMoved.toFixed(2)} u`);
        const st = cand.blow === 'tangent' ? GS.seatStrikeEnd(GS.seatCurve(rowCurve(cand)), lever)
          : GS.seatStrike(GS.seatCurve(rowCurve(cand)), lever, S.wireR, cand.hammer.side, cand.hammer.at * 0.25);
        // the row stores the end's station and heading to 1e-6 (r6), and a heading rounded by 5e-7 rad swings the
        // pivot by that times tanLen (7.28): the residual a stored row can carry is ~5e-6, so 1e-5 is the bound
        if (!st || (cand.blow === 'tangent' && Math.abs(st.g) > 1e-5)) { console.log(`    refused: the exact strike solve ${st ? `leaves the pivot ${st.g.toExponential(2)} off the lever's circle` : 'finds no root on the analytic curve'}`); continue; }
        const r = rowOf(kind, mode, cand, rect, lever, S.wireR, mapInfo, st);
        seatsText = seatModuleText({ ...others, [kind]: { ...rows, [mode]: r } });
        const b = await boot(`case=${kind}&formrect=${rect.join(',')}${mode === 'bar' ? '' : `&gong=${mode}`}`);
        if (b.bootError) { console.log(`    refused: the seated build fails to boot (${b.bootError})`); continue; }
        const extra = b.warnings.filter((w) => !arc.warnings.includes(w) && !RUNTIME.test(w) && !/§310/.test(w) && !/§307\/§308: the movement's counted metal/.test(w));
        if (extra.length) { console.log(`    refused: the seated build adds ${extra.length} warning(s): ${extra.slice(0, 2).map((w) => w.slice(0, 160)).join(' | ')}`); continue; }
        // …nor any the movement AS FIRST FITTED lacks. Against the arc build at the same fit alone, a warning the
        // seat causes by WIDENING the fit stands on both sides and is never counted: the rect's spiral (§310 landing 3)
        // passed that way with its case at 40.09 mm across, over §307's 40 mm owner cap. Compared by KIND (digits
        // folded), because a measured warning's numbers drift with the fit (§186's rim-to-bore reads 2.3060 on one
        // fit and 2.3067 on another) and would otherwise read as new on every round.
        const kind = (w) => w.replace(/-?\d+(\.\d+)?/g, '#');
        const firstKinds = new Set(first.warnings.map(kind));
        const widened = b.warnings.filter((w) => !firstKinds.has(kind(w)) && !RUNTIME.test(w) && !/§310/.test(w) && !/§307\/§308: the movement's counted metal/.test(w));
        if (widened.length) { console.log(`    refused: at its fit the seated build carries ${widened.length} warning(s) the first fit lacks: ${widened.slice(0, 2).map((w) => w.slice(0, 160)).join(' | ')}`); continue; }
        seated = b; pick = cand; row = r; break;
      }
      if (!seated) { console.log(`  ${mode}: no candidate's seated build is clean`); break; }
      for (const w of seated.warnings.filter((w) => /§310/.test(w))) console.log(`  seated build warns: ${w}`);
      // CLOSED when the seated build's metal fits inside the shape it was cut to: the seat was solved on this
      // outline and the outline holds the seated movement. Otherwise the next round cuts the UNION of the two
      // (never smaller: a seat that moves the hammer out cannot shrink the case it moved out of, and a two-cycle
      // between a narrow cut and a wide fit is what taking either alone does — the first run of this tool).
      const inside = seated.rect[0] >= rect[0] - 0.005 && seated.rect[1] <= rect[1] + 0.005 && seated.rect[2] >= rect[2] - 0.005 && seated.rect[3] <= rect[3] + 0.005;
      const seatWarn = seated.warnings.some((w) => /§310/.test(w));
      if (inside && !seatWarn) { closed = true; console.log(`  ${mode} closed: the seated build fits [${seated.rect.join(', ')}] inside the cut [${rect.join(', ')}]`); }
      else {
        const u = [Math.min(rect[0], seated.rect[0]), Math.max(rect[1], seated.rect[1]), Math.min(rect[2], seated.rect[2]), Math.max(rect[3], seated.rect[3])];
        console.log(`  the seated build fits [${seated.rect.join(', ')}]${seatWarn ? ' and its seat check warns' : ''} — re-solving at the union [${u.join(', ')}]`);
        if (sameRect(u, rect) && seatWarn) { console.log('  the union does not move and the seat still warns: refused'); break; }
        rect = u;
      }
    }
    if (closed) rows[mode] = row;
    else { console.error(`  ${kind} ${mode}: the fit and the seat did not close`); if (mode === 'bar') failed = true; }
  }
  if (rows.bar) derived[kind] = rows;
}
await browser.close(); srv.close();
const text = seatModuleText(derived);
if (CHECK) {
  const cur = readFileSync(OUT, 'utf8');
  if (cur !== text) { console.error('FAIL: src/gong-seats.js is not what the tool derives — run `node tools/gong-seats.mjs --write`'); process.exit(1); }
  console.log('PASS: src/gong-seats.js re-derives');
} else if (!failed || Object.keys(derived).length) { await writeFile(OUT, text); console.log(`wrote ${OUT}`); }
process.exit(failed ? 1 : 0);
