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
//   node tools/gong-seats.mjs --write --spec 'barrelstep=0&rsvaz=36&alarmmod=80'
//                                                 the seats of an ARRANGED movement (any spec knobs): every boot
//                                                 carries the query, and the rows go to GONG_SEATS_ARRANGED under
//                                                 the arrangement's key (the build's own GONG_ARR_KEY, read off the
//                                                 page), beside the designed movement's GONG_SEATS
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
// --out FILE writes the table there instead (parallel runs, one kind each, merged afterwards); it still READS src/gong-seats.js
const WRITE_TO = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : OUT;
const ARGS = process.argv.slice(2), WRITE = ARGS.includes('--write'), CHECK = ARGS.includes('--check');
// --modes bar,spiral (the default both): which seats to solve; a mode left out keeps its committed row
const MODES = ARGS.includes('--modes') ? ARGS[ARGS.indexOf('--modes') + 1].split(',') : ['bar', 'spiral'];
const SPECQ = ARGS.includes('--spec') ? ARGS[ARGS.indexOf('--spec') + 1] : null;
const _pos = ARGS.filter((a, i) => !a.startsWith('--') && ARGS[i - 1] !== '--modes' && ARGS[i - 1] !== '--spec' && ARGS[i - 1] !== '--out');
const KINDS = _pos.length ? _pos : ['rect', 'cushion', 'tonneau'];
if (!MODES.every((m) => m === 'bar' || m === 'spiral')) { console.error(`--modes takes bar and/or spiral (got ${MODES.join(',')})`); process.exit(2); }
if (WRITE === CHECK) { console.error('usage: node tools/gong-seats.mjs --write | --check [kind …]'); process.exit(2); }
export const BAND_HZ = [1000, 4000];   // §197: a struck alarm gong's fundamental (GONG §197 assert, 1–4 kHz)
const STRETCH = [0, 4, 8];              // u added to the cut's y half-extent per retry (y is not under §307's cap)
const DEPTH = 6;
const ARRANGED_RESIDUE = /§234: the alarm pusher bar is L\/D/;   // an arrangement's named, fit-dependent residue (see the widened check)                       // candidates tried per round (each costs up to five boots)
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&${SPECQ ? `${SPECQ}&` : ''}${q}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 600000, polling: 1000 });
  const out = await page.evaluate(() => {
    if (window.__bootError) return { bootError: String(window.__bootError.message || window.__bootError) };
    const c = window.__clock, g = c.gongSeat;
    return { rect: c.formFootprint?.rect ?? null, regions: JSON.parse(JSON.stringify(c.regions)),
      seat: g && { specKey: g.specKey, arrKey: g.arrKey, tenants: JSON.parse(JSON.stringify(g.tenants)), keep: g.keep ? JSON.parse(JSON.stringify(g.keep)) : null, pivot: g.pivot, mode: g.mode, seated: g.seated, refused: g.refused, strike: g.strike, check: g.check, lever: g.lever, wireR: g.wireR, wireD_m: g.wireD_m,
        zGong: g.zGong, postR: g.postR, postRAt: [10, 20, 30, 40, 50, 60, 70, 80].map((L) => [L, g.postRFor(L)]) } };
  });
  await ctx.close();
  return { ...out, warnings };
};
const sameRect = (a, b) => a && b && a.every((v, i) => Math.abs(v - b[i]) < 0.005);
// the smallest box about `fit`'s own centre whose shape holds every station of the wire `need` inside: the seat's
// own fit (the metal's fit never shrinks; the wire is not counted in it, so it may grow it). It grows LUG TO LUG
// first: §307's 40 mm owner cap is on the width across the strap (x) and the length (y) is not capped, so a wire
// the y growth alone can hold costs the case no width; only a wire it cannot hold grows both, by one scale.
const holdWire = (kind, fit, curveRow, need) => {
  const c = GS.seatCurve(curveRow), pts = []; for (let s = 0; s <= c.L + 1e-9; s += 0.25) { const q = c.at(Math.min(s, c.L)); pts.push([q.x, q.y]); }
  const cx = (fit[0] + fit[1]) / 2, cy = (fit[2] + fit[3]) / 2, hw = (fit[1] - fit[0]) / 2, hh = (fit[3] - fit[2]) / 2;
  const box = (kx, ky) => [cx - kx * hw, cx + kx * hw, cy - ky * hh, cy + ky * hh];
  const holds = (kx, ky) => { const [xMin, xMax, yMin, yMax] = box(kx, ky), sh = caseShapeOf(kind, { xMin, xMax, yMin, yMax }); return pts.every(([x, y]) => sh.inset(x, y) >= need - 1e-9); };
  const out = (b) => [Math.floor(b[0] * 100) / 100, Math.ceil(b[1] * 100) / 100, Math.floor(b[2] * 100) / 100, Math.ceil(b[3] * 100) / 100];   // outward, the URL's 0.01
  if (holds(1, 1)) return fit;
  const least = (ok) => { let lo = 1, hi = 1.05; while (!ok(hi)) { lo = hi; hi *= 1.05; if (hi > 2) return null; } while (hi - lo > 1e-6) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } return hi; };
  const ky = least((k) => holds(1, k));
  if (ky) return out(box(1, ky));
  const k = least((k) => holds(k, k));
  return k ? out(box(k, k)) : fit;
};
const within = (a, cut) => a[0] >= cut[0] - 0.005 && a[1] <= cut[1] + 0.005 && a[2] >= cut[2] - 0.005 && a[3] <= cut[3] + 0.005;   // fit a stands within cut
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const r12 = (v) => Math.round(v * 1e12) / 1e12;   // an end-struck spiral's station (rowCurve)
// the file holds the designed movement's seats (GONG_SEATS, per kind) and an ARRANGED movement's (GONG_SEATS_ARRANGED,
// per arrangement key, then per kind); the loop below works on one kind map, and this writes it into its place
let FILE = null, CUR_KEY = null;   // { designed, arranged } as committed; the arrangement this run solves for
const seatModuleText = (seats) => fileText(SPECQ ? FILE.designed : seats, SPECQ ? { ...FILE.arranged, [CUR_KEY]: seats } : FILE.arranged);
const fileText = (seats, arranged) => `// GENERATED by tools/gong-seats.mjs — never edit by hand; re-run the tool (--check re-derives it).
//
// BUILT §310 landing 2: per FITTED form case, the alarm gong's seat — its wire's centreline from the free end
// (gong-solve.js seatCurve), the side the hammer's face stands on (sg) and where the lever's root lies along it
// (strikeS, arc length from the free end), what it rings (in-plane f, out-of-plane fo, Hz), the fit it was
// solved at (formrect) and the spec it was solved for (specKey). The build solves the strike again against its
// own lever and re-measures the band at boot.
export const GONG_SEATS = Object.freeze(${JSON.stringify(seats, null, 1).replace(/\n\s*/g, ' ')});
// …and an ARRANGED movement's (spec knobs that move stations, e.g. §308 landing 5's barrel swing and module turn),
// keyed by the arrangement (layout.js configKey of the spec with the case shape, its fit and the seat mode dropped)
export const GONG_SEATS_ARRANGED = Object.freeze(${JSON.stringify(arranged, null, 1).replace(/\n\s*/g, ' ')});
`;
const loadFile = (text) => {
  const a = text.match(/GONG_SEATS = Object\.freeze\(([\s\S]*?)\);\s*(\/\/|$)/), b = text.match(/GONG_SEATS_ARRANGED = Object\.freeze\(([\s\S]*)\);\s*$/);
  return { designed: a ? JSON.parse(a[1]) : {}, arranged: b ? JSON.parse(b[1]) : {} };
};

// the candidates in the order they are tried: the NARROWEST centred case first (the width across the strap the
// seat's own wire needs about the hands, holdWire on the round's cut — the one quantity §307 caps), then the
// hammer's move from the round build's pivot, then the pitch nearest the band's middle
function pickSeat(kind, mode, res, roundPivot, rect, need) {
  const disp = (r) => Math.hypot(r.hammer.pivot[0] - roundPivot.x, r.hammer.pivot[1] - roundPivot.y);
  const width = (r) => { const f = holdWire(kind, rect, rowCurve(r), need); return Math.round((f[1] - f[0]) * 100) / 100; };
  let pool;
  if (mode === 'bar') {
    pool = res.filter((r) => r.fam === 'edge');
    if (!pool.length) pool = res.filter((r) => r.fam === 'any' && !r.k);
    if (!pool.length) pool = res.filter((r) => r.fam === 'any');
  } else pool = res.filter((r) => r.fam === 'spiral');
  const mid = (r) => Math.abs(Math.log(r.f[0] / Math.sqrt(BAND_HZ[0] * BAND_HZ[1])));
  return pool.map((r) => ({ ...r, pivotMoved: disp(r), wide: width(r) })).sort((a, b) => a.wide - b.wide || a.pivotMoved - b.pivotMoved || mid(a) - mid(b));
}
// §38/TODO 8's guard fires at RUNTIME on a starved frame (a loaded machine), on any build: no seat's warning
const RUNTIME = /§38\/TODO 8: the alarm's coincidence was crossed/;
// the solver's result as the analytic centreline the build reads (from its free end), rounded to the table's 1e-6
function rowCurve(r) {
  const [x0, y0] = r.pts[0];
  const th = r.spiral ? r.spiral.th : Math.atan2(r.pts[1][1] - y0, r.pts[1][0] - x0);
  // an END-struck spiral's strike is its stored end and heading, and the pivot built from them must stand on the
  // lever's circle to the build's own 1e-6 arm check: rounded to 1e-6 they leave it up to ~5e-6 off (5e-7 rad x
  // tanLen 7.28), so a spiral's station is stored to 1e-12
  return r.spiral ? { type: 'spiral', sx: r12(r.spiral.sx), sy: r12(r.spiral.sy), th: r12(r.spiral.th), r0: r.spiral.r0, p: r.spiral.p, turn: r.spiral.turn, L: r6(r.L) }
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
    formrect: rect, specKey: CUR_SPECKEY ?? configKey({ spec: { ...SPEC, caseShape: kind } }), wireR: r6(wireR), map: mapInfo };
}

FILE = loadFile(seatsText);
let committed = SPECQ ? null : FILE.designed, derived = SPECQ ? null : JSON.parse(JSON.stringify(committed));
let CUR_SPECKEY = null;   // the build's own key for the row (read off the page under --spec)
let failed = false;
for (const kind of KINDS) {
  console.log(`== ${kind}`);
  const first = await boot(`case=${kind}&gong=arc`);
  if (first.bootError) { console.error(`  boot failed: ${first.bootError}`); failed = true; continue; }
  if (SPECQ) {
    if (!first.seat?.arrKey) { console.error('  the page publishes no arrangement key (gongSeat.arrKey)'); failed = true; break; }
    if (CUR_KEY && CUR_KEY !== first.seat.arrKey) { console.error(`  the arrangement key moved between kinds (${CUR_KEY} → ${first.seat.arrKey})`); failed = true; break; }
    if (!CUR_KEY) { CUR_KEY = first.seat.arrKey; committed = FILE.arranged[CUR_KEY] ?? {}; derived = JSON.parse(JSON.stringify(committed)); console.log(`  arrangement ${CUR_KEY}`); }
    CUR_SPECKEY = first.seat.specKey;
  }
  const rows = {};
  for (const m of ['bar', 'spiral']) if (!MODES.includes(m) && committed[kind]?.[m]) rows[m] = committed[kind][m];
  // EACH SEAT CLOSES ITS OWN FIT: the bar and the spiral move the hammer to different stations, so each is
  // solved and re-booted at the fit its own seated build needs (the spiral rides ?gong=spiral)
  for (const mode of MODES) {
    let row = null, closed = false;
    // LUG TO LUG when the first cut cannot close: the cut is stretched along y only (the length §307 does not
    // cap), so the band's map reaches toward the lugs and a wire laid there costs the case no width
    for (const stretch of STRETCH) { if (closed) break;
    let rect = [first.rect[0], first.rect[1], first.rect[2] - stretch, first.rect[3] + stretch];
    if (stretch) console.log(`  ${mode}: the cut stretched ${stretch} u lug to lug either side`);
    for (let round = 1; round <= 5 && !closed; round++) {
      // no seat for this kind while its band is read: the arc build is what the measure sees
      const others = JSON.parse(JSON.stringify(derived)); delete others[kind];
      seatsText = seatModuleText({ ...others, ...(Object.keys(rows).length ? { [kind]: rows } : {}) });
      const arc = await boot(`case=${kind}&formrect=${rect.join(',')}&gong=arc`);
      if (arc.bootError) { console.error(`  arc boot failed: ${arc.bootError}`); break; }
      const S = arc.seat, shape = caseShapeOf(kind, { xMin: rect[0], xMax: rect[1], yMin: rect[2], yMax: rect[3] });
      const need = S.wireR + S.lever.margin;
      // the counted metal's hulls (the hammer excepted: it is the seat's own) and the plates' tenants in the band
      // TODO 272: nor the PILLARS — the gong sets them (the build's pillar scan yields to the row's `keep`)
      const parts = [...GS.bandParts(arc.regions, S.zGong - S.wireR, S.zGong + S.wireR, S.lever.margin, new Set(['Alarm hammer', 'pillars'])),
        ...GS.bandParts(S.tenants, S.zGong - S.wireR, S.zGong + S.wireR, S.lever.margin)];
      const W = Math.ceil((rect[1] - rect[0]) / RES) + 2, H = Math.ceil((rect[3] - rect[2]) / RES) + 2;
      const map = GS.bandMap(parts, { x0: rect[0] - RES, y0: rect[2] - RES, W, H, RES, need, inset: (x, y) => shape.inset(x, y) });
      const lever = { Q: S.lever.Q, rho: S.lever.rho, tanLen: S.lever.tanLen, side: S.lever.side, gap: S.lever.gap, headR: S.lever.headR, headH: S.lever.headH,
        postR: S.lever.postR, margin: S.lever.margin, inboard: 3, outward: true };
      // the block's radius at the shortest wire the band admits (the clamp condition's ¼ power makes it the largest)
      const footR = Math.max(...S.postRAt.map(([, r]) => r));
      const base = { free: map.free, W, H, x0: map.x0, y0: map.y0, RES, loop: shape.loop(), pillars: [], need, footR, plateInset: (x, y) => shape.inset(x, y) };
      const opts = { fLo: BAND_HZ[0], fHi: BAND_HZ[1], strike: 'end', rank: 'pitch', perFamily: DEPTH, wireD_m: S.wireD_m, wireR: S.wireR, lever };
      const free = map.free.reduce((t, v) => t + v, 0);
      const mapInfo = { cells: W * H, free, parts: parts.length, res: RES, need: r6(need) };
      console.log(`  ${mode} round ${round}: fit [${rect.join(', ')}], ${parts.length} hulls in the band, ${free} of ${W * H} cells free`);
      // GONG_DUMP=dir writes the map and options each round solves on, so the solver can be read in Node alone
      if (process.env.GONG_DUMP) await writeFile(join(process.env.GONG_DUMP, `${kind}-${mode}-${round}.json`), JSON.stringify({ base: { ...base, free: Array.from(base.free), plateInset: null }, opts, rect, loop: shape.loop() }));
      const res = GS.solveGong(base, mode === 'bar' ? { ...opts, edge: true, any: true } : { ...opts, spiral: true }).results;
      // the candidates in the family's order; a seat is ADMITTED only if its seated build adds no boot
      // warning the arc build at this fit lacks (the hammer's new station must not cost any other part
      // its own assert — the fold rule's P3: the move is refused, never paid for), tried four deep
      const pool = pickSeat(kind, mode, res, arc.seat.pivot, rect, need);
      if (!pool.length) { console.log(`  ${mode}: no seat the lever reaches`); break; }
      let seated = null, pick = null, fallback = null;
      for (const cand of pool.slice(0, DEPTH)) {
        const sh = (q) => q.map((v) => v.toFixed(2)).join(', ');
        console.log(`  ${mode}: ${cand.label} (${cand.fam}), L ${cand.L.toFixed(2)} u, f ${cand.f.map((v) => v.toFixed(0)).join(' / ')} Hz, out of plane ${cand.fo.map((v) => v.toFixed(0)).join(' / ')}; free end (${sh(cand.pts[0])}), foot (${sh(cand.pts.at(-1))}); pivot (${sh(cand.hammer.pivot)}), moved ${cand.pivotMoved.toFixed(2)} u; its wire needs ${cand.wide.toFixed(2)} u across`);
        const st = cand.blow === 'tangent' ? GS.seatStrikeEnd(GS.seatCurve(rowCurve(cand)), lever)
          : GS.seatStrike(GS.seatCurve(rowCurve(cand)), lever, S.wireR, cand.hammer.side, cand.hammer.at * 0.25);
        // the row stores a spiral's end to 1e-12 (rowCurve), so the residual its pivot carries is float noise
        if (!st || (cand.blow === 'tangent' && Math.abs(st.g) > 1e-9)) { console.log(`    refused: the exact strike solve ${st ? `leaves the pivot ${st.g.toExponential(2)} off the lever's circle` : 'finds no root on the analytic curve'}`); continue; }
        let r = rowOf(kind, mode, cand, rect, lever, S.wireR, mapInfo, st);
        // TODO 272 — THE KEEP-OUT the build's pillar scan yields to is the strike group as SEATED, so it is
        // measured off a first seated boot (its pillars still blind to it) and written into the row; the
        // second boot, with the pillars yielding, is the one judged. The hammer does not depend on where the
        // pillars stand, so one measuring boot is the fixed point (the build holds that: declared vs cut).
        seatsText = seatModuleText({ ...others, [kind]: { ...rows, [mode]: r } });
        const m = await boot(`case=${kind}&formrect=${rect.join(',')}${mode === 'bar' ? '' : `&gong=${mode}`}`);
        if (m.bootError || !m.seat?.keep) { console.log(`    refused: the seated build ${m.bootError ? `fails to boot (${m.bootError})` : 'measures no strike footprint'}`); continue; }
        r = { ...r, keep: m.seat.keep };
        // GONG_ROWS=dir writes each candidate row as judged, so a refused seat can be booted and read by hand
        if (process.env.GONG_ROWS) await writeFile(join(process.env.GONG_ROWS, `${kind}-${mode}-${round}-${pool.indexOf(cand)}.json`), JSON.stringify(r));
        seatsText = seatModuleText({ ...others, [kind]: { ...rows, [mode]: r } });
        let b = await boot(`case=${kind}&formrect=${rect.join(',')}${mode === 'bar' ? '' : `&gong=${mode}`}`);
        if (b.bootError) { console.log(`    refused: the seated build fails to boot (${b.bootError})`); continue; }
        // THE SEAT AT ITS OWN FIT (TODO 269's second search change, owed since the case is fitted about the
        // hands): a seat is judged at the smallest case that holds BOTH its seated metal and its own wire, not at
        // the round's cut. The cut is sized by whatever the round's map was read on — the first centred cut stands
        // about the round build's hammer and over §307's 40 mm cap, which refused every seat for a width none
        // needed. The metal's fit alone is not enough: the case-path gong follows the case and is not counted in
        // FORM_FOOTPRINT, so the metal's fit can leave the wire outside (the rect spiral by 0.605 u, measured). So
        // the fit is GROWN about its own centre (the hands) until every station of the wire stands its need inside
        // the outline, then booted with its own arc build beside it (the arc's warnings are what the seat may not
        // add, at the same fit), and taken only if the seated metal still fits it.
        let arcAt = arc;
        const own = holdWire(kind, b.rect, rowCurve(cand), need);
        if (!sameRect(own, rect)) {
          const r2 = { ...r, formrect: own };
          seatsText = seatModuleText({ ...others, [kind]: { ...rows, [mode]: r2 } });
          const c = await boot(`case=${kind}&formrect=${own.join(',')}${mode === 'bar' ? '' : `&gong=${mode}`}`);
          if (!c.bootError && within(c.rect, own)) {
            seatsText = seatModuleText({ ...others });
            arcAt = await boot(`case=${kind}&formrect=${own.join(',')}&gong=arc`);
            seatsText = seatModuleText({ ...others, [kind]: { ...rows, [mode]: r2 } });
            console.log(`    judged at its own fit [${own.join(', ')}] (the metal's [${b.rect.join(', ')}], the cut [${rect.join(', ')}])`);
            b = c; r = r2;
          } else seatsText = seatModuleText({ ...others, [kind]: { ...rows, [mode]: r } });
        }
        const extra = b.warnings.filter((w) => !arcAt.warnings.includes(w) && !RUNTIME.test(w) && !/§310/.test(w) && !/§307\/§308: the movement's counted metal/.test(w));
        if (extra.length) { console.log(`    refused: the seated build adds ${extra.length} warning(s): ${extra.slice(0, 2).map((w) => w.slice(0, 160)).join(' | ')}`); continue; }
        // …nor any the movement AS FIRST FITTED lacks. Against the arc build at the same fit alone, a warning the
        // seat causes by WIDENING the fit stands on both sides and is never counted: the rect's spiral (§310 landing 3)
        // passed that way with its case at 40.09 mm across, over §307's 40 mm owner cap. Compared by KIND (digits
        // folded), because a measured warning's numbers drift with the fit (§186's rim-to-bore reads 2.3060 on one
        // fit and 2.3067 on another) and would otherwise read as new on every round.
        const warnKind = (w) => w.replace(/-?\d+(\.\d+)?/g, '#');
        const firstKinds = new Set(first.warnings.map(warnKind));
        // (an ARRANGEMENT's named residue that moves with the fit, not with the seat, is not the seat's to answer:
        // §308 landing 5's alarm pusher bar, L/D ~20.6 at the 80° turn, owed a radius-from-length derivation — PR #806's debt)
        const widened = b.warnings.filter((w) => !firstKinds.has(warnKind(w)) && !RUNTIME.test(w) && !/§310/.test(w) && !/§307\/§308: the movement's counted metal/.test(w)
          && !(SPECQ && ARRANGED_RESIDUE.test(w)));
        if (widened.length) { console.log(`    refused: at its fit the seated build carries ${widened.length} warning(s) the first fit lacks: ${widened.slice(0, 2).map((w) => w.slice(0, 160)).join(' | ')}`); continue; }
        // A clean seat whose own metal fits INSIDE this cut closes here and is taken at once. One that would WIDEN
        // the cut is kept as the round's fallback and the rest are still tried: taking the first clean seat sent
        // the tonneau's spiral to a 53.2 cut it then could not hold (41.25 mm, over the cap) while a later seat,
        // 18.02 u of hammer move and 48.92 of fit, closed inside the first cut unwidened.
        const fits = within(b.rect, r.formrect);
        if (fits && !b.warnings.some((w) => /§310/.test(w))) { seated = b; pick = cand; row = r; rect = r.formrect; break; }
        console.log(`    clean, but its fit [${b.rect.join(', ')}] widens the cut: kept as the round's fallback`);
        fallback ??= { b, cand, r };
      }
      if (!seated && fallback) ({ b: seated, cand: pick, r: row } = fallback);
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
    }
    if (closed) rows[mode] = row;
    else { console.error(`  ${kind} ${mode}: the fit and the seat did not close`); if (mode === 'bar') failed = true; }
  }
  if (rows.bar) derived[kind] = rows;
}
await browser.close(); srv.close();
const text = SPECQ ? (CUR_KEY ? seatModuleText(derived) : seatsText) : seatModuleText(derived);
if (CHECK) {
  const cur = readFileSync(OUT, 'utf8');
  if (cur !== text) { console.error('FAIL: src/gong-seats.js is not what the tool derives — run `node tools/gong-seats.mjs --write`'); process.exit(1); }
  console.log('PASS: src/gong-seats.js re-derives');
} else if (!failed || Object.keys(derived).length) { await writeFile(WRITE_TO, text); console.log(`wrote ${WRITE_TO}`); }
process.exit(failed ? 1 : 0);
