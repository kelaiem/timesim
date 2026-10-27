#!/usr/bin/env node
// ACCEPTANCE (BUILT §310 landing 2): the gong's SEAT on a fitted form case, held to the metal and to the
// mechanism. Exits non-zero on any failure.
//
// Pure half (Node, no browser):
//   P1  the spiral's analytic centreline (GS.seatCurve) is arc-length exact: its chord sum over 1e-3 u steps
//       equals L to 1e-6, and it starts on spiralInGen's curve (the solver's own generator) at the same heading
//   P2  the strike solve (GS.seatStrike) lands its pivot on the lever's circle to 1e-9 and its face one rest
//       gap off the wire's surface along the wire's normal
//   P3  hullDist: 0 inside a convex hull, the true distance outside (a unit square, a point 2 off an edge and
//       one √2 off a corner) — the band map and the boot check both read it
//   P4  every committed row names the spec it was solved for (configKey of the default spec at its kind) and
//       a curve type the build can read
// Browser half (Chromium, one boot per row and the controls):
//   B1  the ROUND build is untouched: no seat, the ring is a torus, boot silent; and the quadrature a seated
//       wire radiates by agrees with §253's Jacobi–Anger series on the shipped arc (∫|F|²dΩ to 1e-3 — the
//       path law takes every second station, which costs 3e-4 on the 34 kHz third mode — the peak to 1%, the
//       first three modes) — the series is exact for a circle, so this is the path law's control
//   B2  each committed seat, booted at its fitted ?formrect=: seated; the seat check holds (the wire
//       ≥ wire + margin from every hull in its band, inside the outline by that need, its block on plate);
//       the face rests the gap off its wire and the pivot on the lever's circle; the build rings the
//       generated f₁, inside §197's 1–4 kHz; the strike line spec's rows all hold on the seated metal (no
//       fork: its `blow` row is the wire's normal, which the reader now measures on any wire); and the
//       seat adds no boot warning the same fit with ?gong=arc does not carry
//   B3  CONTROLS: ?gong=arc keeps the ring; a seat carried to a fit 3 u narrower on its own side is called
//       out by the boot's seat check (the outline clause); a seat whose strike was moved 1 u along its wire
//       is called out by the strike clause
//   P5  TODO 269 — the END strike (GS.seatStrikeEnd) of a spiral built the solver's way from a pivot on the
//       lever's circle returns that pivot to 1e-9, its face one gap before the end, the blow along the tangent
//   B2  …and since TODO 269, each seat's head meets its wire inside §197's 0.4 < μ < 2.5, and an END-struck
//       seat's head stands a margin off every coil but its end; B3's control reads the same spiral's
//       fundamental ACROSS its end, off the build's own record (modal fraction, wire and hammer mass), and
//       must find μ out of that band — the reason a spiral is struck along its tangent
//   B2  …and no warning the movement AS FIRST FITTED (the arc build with no ?formrect=) lacks, by kind: a warning
//       a seat causes by widening its fit stands in the arc build at that fit too, so the row above cannot see it
//   B2  …and since TODO 266, each seat's hammer staff stands in the three-quarter plate's strike opening, not
//       under the plate (a vertical ray at the post meets no plate), the opening holding TQ_LAND_MIN of plate to
//       everything round it (the build's own land test, reported on __clock.strikePlateOpening)
//   B2  …and since TODO 272, the GONG SETS THE PILLARS: each seat row declares `keep`, the strike group's
//       footprint as its seated build measured it; the build's cut strike group stands inside it (to 1e-3), and
//       every pillar, read off the scene (its seat and its widest land), stands CLEAR_MARGIN off the hammer's
//       swept metal, the wire and its post, and TQ_LAND_MIN off the plate's strike opening. Its control: the
//       same reader on the cushion's hammer and the 30° pillar `main` shipped before TODO 271 (32.49, 18.76)
//       must read it inside the metal — the FORBIDDEN pair that build carried unseen
//   B3  …and since TODO 272, a seat whose `keep` is dropped is called out (the pillars sited blind), and one
//       whose `keep` is shrunk about its centre is called out (the cut metal outside what was declared)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as GS from '../src/gong-solve.js';
import { GONG_SEATS } from '../src/gong-seats.js';
import { configKey, SPEC, ARRANGEMENT } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };

// ---- pure half
{
  const c = { type: 'spiral', sx: 32, sy: 6.7, th: 1.2, r0: 18, p: 3.5, turn: 1, L: 56 }, sc = GS.seatCurve(c);
  let L = 0, prev = sc.at(0); for (let s = 1e-3; s <= c.L + 1e-12; s += 1e-3) { const q = sc.at(s); L += Math.hypot(q.x - prev.x, q.y - prev.y); prev = q; }
  const g = GS.spiralInGen(c.sx, c.sy, c.th, c.r0, c.p, c.turn), q0 = sc.at(0), q1 = g(0.05);
  ok('P1 spiral centreline is arc-length exact and starts on the solver\'s curve', Math.abs(L - c.L) < 1e-6 && Math.hypot(q0.x - c.sx, q0.y - c.sy) < 1e-12
    && Math.abs(Math.atan2(q0.ty, q0.tx) - c.th) < 1e-9 && Math.hypot(q1[0] - sc.at(0.05).x, q1[1] - sc.at(0.05).y) < 2e-3,
    `chord sum ${L.toFixed(9)} of ${c.L}`);
}
{
  // the lever as the build stands it (STRIKE_REF.piv at r 35, az 26°; ρ = |(13, 0.5)|; tanLen = √(arm² − 0.6²)),
  // on a vertical bar its circle crosses at two points ~18.7 u apart
  const lever = { Q: { x: 31.457791620470847, y: 15.34299013761771 }, rho: Math.hypot(13, 0.5), tanLen: 7.279256431577741, side: 1, gap: 0.4 }, wireR = 1.4514;
  const curve = GS.seatCurve({ type: 'line', sx: 44, sy: 30, th: -Math.PI / 2, L: 60 });
  const st = GS.seatStrike(curve, lever, wireR, -1, 12);
  const off = st && Math.hypot(st.F.x - st.S.x, st.F.y - st.S.y) - wireR;
  ok('P2 strike solve: pivot on the lever circle, face one gap off the wire', !!st && Math.abs(Math.hypot(st.P.x - lever.Q.x, st.P.y - lever.Q.y) - lever.rho) < 1e-9
    && Math.abs(off - lever.gap) < 1e-12 && Math.abs(st.b.x * st.n.x + st.b.y * st.n.y - 1) < 1e-12,   // face on side −1: the blow runs along +n
    st ? `s ${st.s.toFixed(6)}, |P−Q|−ρ ${(Math.hypot(st.P.x - lever.Q.x, st.P.y - lever.Q.y) - lever.rho).toExponential(1)}` : 'no root');
}
{
  // TODO 269: the solver's construction — a pivot on the circle, a blow b, F = P − side·tanLen·(ẑ×b), the end
  // one gap past F along b — read back by the build's exact end strike
  const lever = { Q: { x: 31.457791620470847, y: 15.34299013761771 }, rho: Math.hypot(13, 0.5), tanLen: 7.279256431577741, side: 1, gap: 0.4 };
  const ph = 0.7, be = 2.1, px = lever.Q.x + lever.rho * Math.cos(ph), py = lever.Q.y + lever.rho * Math.sin(ph), bx = Math.cos(be), by = Math.sin(be);
  const fx = px - lever.side * lever.tanLen * -by, fy = py - lever.side * lever.tanLen * bx, ex = fx + bx * lever.gap, ey = fy + by * lever.gap;
  const st = GS.seatStrikeEnd(GS.seatCurve({ type: 'spiral', sx: ex, sy: ey, th: be, r0: 11, p: 4.5, turn: 1, L: 60 }), lever);
  ok('P5 end strike: the pivot back on the lever circle, the face a gap before the end, the blow along it',
    Math.hypot(st.P.x - px, st.P.y - py) < 1e-9 && Math.abs(st.g) < 1e-9 && Math.abs(Math.hypot(st.F.x - st.S.x, st.F.y - st.S.y) - lever.gap) < 1e-12
    && Math.abs(st.b.x * bx + st.b.y * by - 1) < 1e-12 && st.s === 0 && st.blow === 'tangent',
    `|P − P₀| ${Math.hypot(st.P.x - px, st.P.y - py).toExponential(1)}, g ${st.g.toExponential(1)}`);
}
{
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  ok('P3 hullDist: inside 0, edge and corner distances', GS.hullDist(sq, 0.5, 0.5) === 0 && Math.abs(GS.hullDist(sq, 0.5, -2) - 2) < 1e-12
    && Math.abs(GS.hullDist(sq, 2, 2) - Math.SQRT2) < 1e-12 && GS.hullDist(sq.slice().reverse(), 0.5, 0.5) === 0);
}
const rows = Object.values(GONG_SEATS).flatMap((k) => Object.values(k));
ok('P4 every row names its spec and a readable curve', rows.length > 0 && rows.every((r) => r.specKey === configKey({ spec: { ...SPEC, ...ARRANGEMENT, caseShape: r.kind } })   // a form case is cased on the arrangement (layout.js)
  && ['line', 'arc', 'spiral'].includes(r.curve.type) && r.formrect?.length === 4), `${rows.length} row(s)`);

// ---- browser half
const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
let seatsOverride = null;
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p === '/src/gong-seats.js' && seatsOverride) { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }).end(seatsOverride); return; }
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
// (a 404 is this static server declining dev_server.py's /__state endpoint, which the page falls back from)
const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL|Failed to load resource: the server responded with a status of 404/i;
// TODO 272 — signed distance to a closed polygon (negative inside), and to a segment
const segD = ([ax, ay], [bx, by], x, y) => { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1e-12)));
  return Math.hypot(x - ax - t * vx, y - ay - t * vy); };
const psd = (pts, x, y) => { let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i]; d = Math.min(d, segD(pts[j], pts[i], x, y));
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / ((by - ay) || 1e-12)) inside = !inside; }
  return inside ? -d : d; };
const boot = async (q, fn) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage(), warnings = [];
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(m.text()); });
  page.on('pageerror', (e) => warnings.push('PAGEERROR ' + e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0${q ? '&' + q : ''}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 600000, polling: 1000 });
  const out = await page.evaluate(fn);
  await ctx.close();
  return { warnings, out };
};
const seatRead = async () => {   // (Infinity crosses page.evaluate as null: the check's metal distance is finite by construction)
  const c = window.__clock, g = c.gongSeat, A = c.acoustics;
  const arc = c.scene.getObjectByName('alarmGongArc');
  const r = { seated: g?.seated ?? null, refused: g?.refused ?? null, check: g?.check ?? null, torus: arc.geometry.type === 'TorusGeometry',
    f1: A.modes[0].f_Hz, contact: A.strike.contact, seat: A.wire.seat ? { mode: A.wire.seat.mode, label: A.wire.seat.label, blow: A.wire.seat.blow, driveTip: A.wire.seat.driveTip } : null,
    // TODO 269 — the impedance match, and the same fundamental read ACROSS the end (the control's arithmetic)
    mu: A.strike.mu, muAcross: A.hammer.effMass_mg / (A.wire.mass_mg * A.wire.modalFrac) };
  if (g?.seated) {
    const I = await import('./src/inspect.js');
    const ls = await I.checkLineSpec(c);
    r.strike = ls.rows.filter((x) => x.ref === 'alarm strike').map((x) => ({ key: x.key, pass: x.pass, spec: x.spec, measured: x.measured, fork: x.fork }));
    r.lsMalformed = ls.malformed.filter((m) => m.ref === 'alarm strike' || m.fork);
    // TODO 266 — the staff against the three-quarter plate, and the opening the plate is cut to round it
    const T = await import('./vendor/three.module.js'), tq = c.scene.getObjectByName('threeQuarterPlate'), post = c.scene.getObjectByName('alarmHammerPost');
    c.scene.updateMatrixWorld(true); const p = new T.Vector3(); post.getWorldPosition(p);
    const hits = new T.Raycaster(new T.Vector3(p.x, p.y, 100), new T.Vector3(0, 0, -1)).intersectObject(tq, true);
    const bb = new T.Box3().setFromObject(post), tb = new T.Box3().setFromObject(tq);
    r.staff = { inPlateFootprint: hits.length > 0, postTop: bb.max.z, plateBottom: tb.min.z };
    const op = c.strikePlateOpening; r.opening = op ? { land: op.land, landTo: op.landTo } : null;
    r.tqT = tb.max.z - tb.min.z;   // TQ_LAND_MIN is max(STOCK_MIN_U, TQ_T): the plate's own thickness governs
    // TODO 272 — the pillars as built: each one's seat and its widest land, read off its own vertices
    r.pillars = [];
    c.scene.traverse((o) => { if (o.name !== 'pillar' || !o.isMesh) return;
      const w = new T.Vector3(); o.getWorldPosition(w); const pa = o.geometry.attributes.position, v = new T.Vector3(); let capR = 0;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); capR = Math.max(capR, Math.hypot(v.x - w.x, v.y - w.y)); }
      r.pillars.push({ x: w.x, y: w.y, capR }); });
    r.keep = g.keep; r.rowKeep = g.row?.keep ?? null; r.wireR = g.wireR;
  }
  return r;
};

{
  const { warnings, out } = await boot('', async () => {
    const c = window.__clock, A = c.acoustics, w = A.wire, alpha = w.arcRad, R = w.ringR_u * 0.72 / 1.9 / 1000;
    const modes = c.gongArch.modes(w.S, alpha, 1.1 * 14.13716839 / alpha, 3), cmp = [];
    for (let i = 0; i < 3; i++) { const k = 2 * Math.PI * A.modes[i].f_Hz / 343, a = c.gongArch.radiation(modes[i].w, alpha, R, k), b = c.gongArch.radiationPath(modes[i].w, k);
      cmp.push({ sph: b.sph / a.sph, peak: b.peak / a.peak }); }
    return { seat: c.gongSeat, torus: c.scene.getObjectByName('alarmGongArc').geometry.type === 'TorusGeometry', ws: A.wire.seat, cmp };
  });
  ok('B1 round build untouched (no seat, the ring a torus, boot silent)', out.seat === null && out.torus && out.ws === null && warnings.length === 0, warnings.slice(0, 2).join(' | '));
  ok('B1 path radiation agrees with the arc series on the shipped arc', out.cmp.every((x) => Math.abs(x.sph - 1) < 1e-3 && Math.abs(x.peak - 1) < 0.01),
    out.cmp.map((x) => `${x.sph.toFixed(7)}/${x.peak.toFixed(4)}`).join(', '));
}
const firstFit = {};   // per kind: the movement as first fitted (the arc build, no ?formrect=), the warnings a seat may not add
for (const row of rows) {
  const q = `case=${row.kind}&formrect=${row.formrect.join(',')}${row.mode === 'bar' ? '' : `&gong=${row.mode}`}`;
  firstFit[row.kind] ??= (await boot(`case=${row.kind}&gong=arc`, () => ({}))).warnings;
  const seated = await boot(q, seatRead), arc = await boot(`case=${row.kind}&formrect=${row.formrect.join(',')}&gong=arc`, () => ({}));
  const o = seated.out, ch = o.check, tag = `B2 ${row.kind} ${row.mode}`;
  ok(`${tag}: seated`, o.seated === true, o.refused ?? '');
  if (!o.seated) continue;
  ok(`${tag}: TODO 269 — the head meets the wire inside §197's 0.4 < μ < 2.5`, o.mu > 0.4 && o.mu < 2.5, `μ ${o.mu.toFixed(3)} (${o.seat.blow} blow, contact ${o.contact})`);
  if (o.seat.blow === 'tangent') {
    ok(`${tag}: TODO 269 — the end-struck head stands a margin off every coil but its end`, ch.headClear >= 0.15 - 1e-9, `head ${ch.headClear.toFixed(3)} off the coils`);
    ok(`${tag}: TODO 269 control — the same fundamental struck ACROSS the end falls out of the band`, !(o.muAcross > 0.4 && o.muAcross < 2.5),
      `μ across ${o.muAcross.toFixed(4)} against μ along ${o.mu.toFixed(3)} (u at the tip ${o.seat.driveTip.toFixed(2)}× the normal)`);
  }
  ok(`${tag}: the seat check holds`, ch.metal.d >= ch.need - 1e-9 && ch.outlineInset >= ch.need - 1e-9 && ch.footInset >= 0 && ch.staffClear >= 0.15 - 1e-9,
    `metal ${ch.metal.d.toFixed(3)} (${ch.metal.unit}) / need ${ch.need.toFixed(3)}, outline ${ch.outlineInset.toFixed(3)}, block ${ch.footInset.toFixed(3)}, staff ${ch.staffClear.toFixed(3)}`);
  ok(`${tag}: face at the gap, pivot on the lever's circle`, Math.abs(ch.faceGap - 0.4) < 1e-6 && Math.abs(ch.leverResidual) < 1e-9, `gap ${ch.faceGap.toFixed(9)}, residual ${ch.leverResidual.toExponential(1)}`);
  ok(`${tag}: rings its generated f₁ inside 1–4 kHz`, Math.abs(o.f1 / row.f[0] - 1) < 1e-3 && o.f1 >= 1000 && o.f1 <= 4000, `${o.f1.toFixed(1)} Hz (generated ${row.f[0]}), contact ${o.contact}`);
  const bad = o.strike.filter((x) => !x.pass);
  ok(`${tag}: the strike line spec holds on the seated metal, unforked`, o.strike.length > 0 && !bad.length && !o.lsMalformed.length && o.strike.every((x) => !x.fork),
    bad.length ? bad.map((x) => `${x.key} ${x.measured} vs ${x.spec}`).join('; ') : `${o.strike.length} rows`);
  // §38/TODO 8's guard is a RUNTIME one (a tick that crossed the alarm's coincidence): a starved frame on a
  // loaded machine fires it on any build, at whatever time of day the page boots, so it is no build's warning
  const RUNTIME = /§38\/TODO 8: the alarm's coincidence was crossed/;
  const extra = seated.warnings.filter((w) => !arc.warnings.includes(w) && !RUNTIME.test(w));
  ok(`${tag}: no boot warning the arc build at this fit lacks`, extra.length === 0, extra.slice(0, 3).join(' | '));
  // …nor one the movement as FIRST fitted lacks, compared by kind (digits folded: a measured warning's numbers
  // drift with the fit). A warning the seat causes by widening its fit stands in the arc build at that fit too,
  // which is how the rect's spiral reached a 40.09 mm case past §307's 40 mm cap with the row above green.
  const warnKind = (w) => w.replace(/-?\d+(\.\d+)?/g, '#'), firstKinds = new Set(firstFit[row.kind].map(warnKind));
  // (§308 landing 5's named residue moves with the fit, not with the seat: the alarm pusher bar's L/D, owed a
  // radius-from-length derivation — PR #806's debt, the seat generator's same exemption)
  const widened = seated.warnings.filter((w) => !firstKinds.has(warnKind(w)) && !RUNTIME.test(w) && !/§310/.test(w) && !/§307\/§308: the movement's counted metal/.test(w)
    && !/§234: the alarm pusher bar is L\/D/.test(w));
  ok(`${tag}: no boot warning the movement as first fitted lacks`, widened.length === 0, widened.slice(0, 3).join(' | '));
  ok(`${tag}: TODO 266 — the staff stands in the plate's strike opening, its land held`, !o.staff.inPlateFootprint && !!o.opening && o.opening.land >= o.tqT - 1e-6,
    o.opening ? `land ${o.opening.land.toFixed(3)} to ${o.opening.landTo} (plate ${o.tqT.toFixed(3)} thick); staff top ${o.staff.postTop.toFixed(2)} against the plate's underside ${o.staff.plateBottom.toFixed(2)}` : 'no opening cut');
  // TODO 272 — the gong sets the pillars: declared, cut, and every pillar off the strike group
  {
    const K = o.rowKeep, M = o.keep, wire = [], c = GS.seatCurve(row.curve), nW = Math.max(8, Math.ceil(c.L / 0.25));
    for (let i = 0; i <= nW; i++) { const q = c.at(c.L * i / nW); wire.push([q.x, q.y]); }
    const foot = c.at(c.L);
    const outH = K && M ? Math.max(...M.hull.map(([x, y]) => psd(K.hull, x, y))) : NaN, outO = K && M ? Math.max(...M.opening.map(([x, y]) => psd(K.opening, x, y))) : NaN;
    ok(`${tag}: TODO 272 — the row declares the strike group's keep-out and the cut metal stands inside it`, !!K && !!M && outH <= 1e-3 && outO <= 1e-3 && M.postR <= K.postR + 1e-3,
      K && M ? `hammer ${outH.toFixed(4)}, opening ${outO.toFixed(4)} outside the declaration; post ${M.postR} against ${K.postR}` : `row keep ${!!K}, measured ${!!M}`);
    const worst = { d: Infinity, what: '' };
    for (const p of o.pillars) {
      const lands = [[psd(M.hull, p.x, p.y) - p.capR - 0.15, 'the hammer'], [psd(M.opening, p.x, p.y) - p.capR - o.tqT, 'the opening (less TQ_LAND_MIN)'],
        [Math.min(...wire.slice(1).map((b, i) => segD(wire[i], b, p.x, p.y))) - o.wireR - p.capR - 0.15, 'the wire'],
        [Math.hypot(p.x - foot.x, p.y - foot.y) - M.postR - p.capR - 0.15, 'the post']];
      for (const [d, w] of lands) if (d < worst.d) { worst.d = d; worst.what = `${w}, pillar (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`; }
    }
    ok(`${tag}: TODO 272 — every pillar stands clear of the strike group`, o.pillars.length === 4 && worst.d >= -1e-6,
      `${o.pillars.length} pillars; least spare ${worst.d.toFixed(3)} (${worst.what})`);
    if (row.kind === 'cushion' && row.mode === 'bar') {
      // the reader's control: a pillar planted on the hammer's own swept metal (the hull's first vertex) must read as
      // inside the margin. (It was the 30° pillar `main` shipped before TODO 271, (32.49, 18.76), which stood in the
      // cushion's hammer on the designed train; on §308 landing 5's arrangement the hammer is on the top edge.)
      const capR = o.pillars[0].capR, [hx, hy] = M.hull[0], d = psd(M.hull, hx, hy) - capR;
      ok(`${tag}: TODO 272 control — the reader finds a pillar planted on the hammer's swept metal`, d < 0.15, `${d.toFixed(3)} from the hammer's swept metal`);
    }
  }
}
// controls
{
  const bar = rows.find((r) => r.mode === 'bar');
  if (bar) {
    const fr = `case=${bar.kind}&formrect=${bar.formrect.join(',')}`;
    const a = await boot(`${fr}&gong=arc`, seatRead);
    ok('B3 control: ?gong=arc keeps the ring', a.out.seated === false && a.out.torus, `seated ${a.out.seated}`);
    // the wire's side of the case pulled in 3 u: which bound faces the wire's free end most nearly
    // (over the whole wire, not its free end: an arc bulges, and on §308 landing 5's arrangement its belly, not its end, is nearest a side)
    const [x0, x1, y0, y1] = bar.formrect, cw = GS.seatCurve(bar.curve), d = [Infinity, Infinity, Infinity, Infinity];
    for (let i = 0; i <= 64; i++) { const q = cw.at(cw.L * i / 64); d[0] = Math.min(d[0], q.x - x0); d[1] = Math.min(d[1], x1 - q.x); d[2] = Math.min(d[2], q.y - y0); d[3] = Math.min(d[3], y1 - q.y); }
    const k = d.indexOf(Math.min(...d));
    // pulled in past the wire: 3 u, or as far as puts that side 1 u INSIDE the wire's need (the margin and its radius,
    // the row's map.need) when the wire stands further off than that — the arrangement's arc stands ~10 u inside
    const pull = Math.max(3, d[k] - bar.map.need + 1);
    const narrow = bar.formrect.slice(); narrow[k] += (k % 2 ? -pull : pull);
    const n = await boot(`case=${bar.kind}&formrect=${narrow.join(',')}`, seatRead);
    ok(`B3 control: a seat carried to a fit narrowed past its wire on that side (${pull.toFixed(2)} u) is called out`, n.warnings.some((w) => /§310: the bar gong stands .* inside the/.test(w)),
      n.warnings.filter((w) => /§310/.test(w)).slice(0, 1).join(''));
    const moved = JSON.parse(JSON.stringify(GONG_SEATS)); moved[bar.kind].bar.strikeS += 1;
    seatsOverride = `export const GONG_SEATS = Object.freeze(${JSON.stringify(moved)});\nexport const GONG_SEATS_ARRANGED = Object.freeze({});\n`;
    const m = await boot(fr, seatRead);
    seatsOverride = null;
    ok('B3 control: a seat whose strike moved 1 u is called out', m.warnings.some((w) => /§310: the bar seat's strike solved at/.test(w)), m.warnings.filter((w) => /§310/.test(w)).slice(0, 1).join(''));
    // TODO 272 — the keep-out dropped, and shrunk to half about its own centre
    const dropped = JSON.parse(JSON.stringify(GONG_SEATS)); delete dropped[bar.kind].bar.keep;
    seatsOverride = `export const GONG_SEATS = Object.freeze(${JSON.stringify(dropped)});\nexport const GONG_SEATS_ARRANGED = Object.freeze({});\n`;
    const dk = await boot(fr, () => ({}));
    ok('B3 control: TODO 272 — a seat with no keep-out is called out', dk.warnings.some((w) => /TODO 272: the .* seat carries no pillar keep-out/.test(w)), dk.warnings.filter((w) => /TODO 272/.test(w)).slice(0, 1).join(''));
    const shrunk = JSON.parse(JSON.stringify(GONG_SEATS)), kp = shrunk[bar.kind].bar.keep;
    if (kp) for (const key of ['hull', 'opening']) { const cx = kp[key].reduce((t, q) => t + q[0], 0) / kp[key].length, cy = kp[key].reduce((t, q) => t + q[1], 0) / kp[key].length;
      kp[key] = kp[key].map(([x, y]) => [cx + (x - cx) / 2, cy + (y - cy) / 2]); }
    seatsOverride = `export const GONG_SEATS = Object.freeze(${JSON.stringify(shrunk)});\nexport const GONG_SEATS_ARRANGED = Object.freeze({});\n`;
    const sk = await boot(fr, () => ({}));
    seatsOverride = null;
    ok('B3 control: TODO 272 — a seat whose keep-out is shrunk is called out', sk.warnings.some((w) => /TODO 272: the strike group stands outside the keep-out/.test(w)), sk.warnings.filter((w) => /TODO 272/.test(w)).slice(0, 1).join(''));
  }
}
await browser.close(); srv.close();
console.log(fails.length ? `\nFAIL: ${fails.length} check(s): ${fails.join('; ')}` : '\nPASS: every check');
process.exit(fails.length ? 1 : 0);
