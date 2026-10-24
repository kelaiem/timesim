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
// REPORTED, not gated: the hammer staff's crossing of the three-quarter plate (TODO 266, pre-existing on
// every form build).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as GS from '../src/gong-solve.js';
import { GONG_SEATS } from '../src/gong-seats.js';
import { configKey, SPEC } from '../src/layout.js';

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
  const lever = { Q: { x: 31.4578, y: 15.343 }, rho: 13.0096, tanLen: 7.2793, side: 1, gap: 0.4 }, wireR = 1.4514;
  const curve = GS.seatCurve({ type: 'line', sx: 44.6, sy: 30, th: -Math.PI / 2, L: 60 });
  const st = GS.seatStrike(curve, lever, wireR, 1, 15);
  const off = st && Math.hypot(st.F.x - st.S.x, st.F.y - st.S.y) - wireR;
  ok('P2 strike solve: pivot on the lever circle, face one gap off the wire', !!st && Math.abs(Math.hypot(st.P.x - lever.Q.x, st.P.y - lever.Q.y) - lever.rho) < 1e-9
    && Math.abs(off - lever.gap) < 1e-12 && Math.abs(st.b.x * st.n.x + st.b.y * st.n.y + 1) < 1e-12,
    st ? `s ${st.s.toFixed(6)}, |P−Q|−ρ ${(Math.hypot(st.P.x - lever.Q.x, st.P.y - lever.Q.y) - lever.rho).toExponential(1)}` : 'no root');
}
{
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  ok('P3 hullDist: inside 0, edge and corner distances', GS.hullDist(sq, 0.5, 0.5) === 0 && Math.abs(GS.hullDist(sq, 0.5, -2) - 2) < 1e-12
    && Math.abs(GS.hullDist(sq, 2, 2) - Math.SQRT2) < 1e-12 && GS.hullDist(sq.slice().reverse(), 0.5, 0.5) === 0);
}
const rows = Object.values(GONG_SEATS).flatMap((k) => Object.values(k));
ok('P4 every row names its spec and a readable curve', rows.length > 0 && rows.every((r) => r.specKey === configKey({ spec: { ...SPEC, caseShape: r.kind } })
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
const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
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
    f1: A.modes[0].f_Hz, contact: A.strike.contact, seat: A.wire.seat ? { mode: A.wire.seat.mode, label: A.wire.seat.label } : null };
  if (g?.seated) {
    const I = await import('./src/inspect.js');
    const ls = await I.checkLineSpec(c);
    r.strike = ls.rows.filter((x) => x.ref === 'alarm strike').map((x) => ({ key: x.key, pass: x.pass, spec: x.spec, measured: x.measured, fork: x.fork }));
    r.lsMalformed = ls.malformed.filter((m) => m.ref === 'alarm strike' || m.fork);
    // TODO 266 — the staff against the three-quarter plate (reported)
    const T = await import('./vendor/three.module.js'), tq = c.scene.getObjectByName('threeQuarterPlate'), post = c.scene.getObjectByName('alarmHammerPost');
    c.scene.updateMatrixWorld(true); const p = new T.Vector3(); post.getWorldPosition(p);
    const hits = new T.Raycaster(new T.Vector3(p.x, p.y, 100), new T.Vector3(0, 0, -1)).intersectObject(tq, true);
    const bb = new T.Box3().setFromObject(post), tb = new T.Box3().setFromObject(tq);
    r.staff = { inPlateFootprint: hits.length > 0, postTop: bb.max.z, plateBottom: tb.min.z };
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
for (const row of rows) {
  const q = `case=${row.kind}&formrect=${row.formrect.join(',')}${row.mode === 'bar' ? '' : `&gong=${row.mode}`}`;
  const seated = await boot(q, seatRead), arc = await boot(`case=${row.kind}&formrect=${row.formrect.join(',')}&gong=arc`, () => ({}));
  const o = seated.out, ch = o.check, tag = `B2 ${row.kind} ${row.mode}`;
  ok(`${tag}: seated`, o.seated === true, o.refused ?? '');
  if (!o.seated) continue;
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
  console.log(`REPORT ${tag}: TODO 266 — the staff ${o.staff.inPlateFootprint ? 'stands under the three-quarter plate' : 'is clear of the plate\'s footprint'}, its top ${o.staff.postTop.toFixed(2)} against the plate's underside ${o.staff.plateBottom.toFixed(2)}`);
}
// controls
{
  const bar = rows.find((r) => r.mode === 'bar');
  if (bar) {
    const fr = `case=${bar.kind}&formrect=${bar.formrect.join(',')}`;
    const a = await boot(`${fr}&gong=arc`, seatRead);
    ok('B3 control: ?gong=arc keeps the ring', a.out.seated === false && a.out.torus, `seated ${a.out.seated}`);
    // the wire's side of the case pulled in 3 u: which bound faces the wire's free end most nearly
    const [x0, x1, y0, y1] = bar.formrect, { sx, sy } = bar.curve, d = [sx - x0, x1 - sx, sy - y0, y1 - sy], k = d.indexOf(Math.min(...d));
    const narrow = bar.formrect.slice(); narrow[k] += (k % 2 ? -3 : 3);
    const n = await boot(`case=${bar.kind}&formrect=${narrow.join(',')}`, seatRead);
    ok('B3 control: a seat carried to a fit 3 u narrower on its side is called out', n.warnings.some((w) => /§310: the bar gong stands .* inside the/.test(w)),
      n.warnings.filter((w) => /§310/.test(w)).slice(0, 1).join(''));
    const moved = JSON.parse(JSON.stringify(GONG_SEATS)); moved[bar.kind].bar.strikeS += 1;
    seatsOverride = `export const GONG_SEATS = Object.freeze(${JSON.stringify(moved)});\n`;
    const m = await boot(fr, seatRead);
    seatsOverride = null;
    ok('B3 control: a seat whose strike moved 1 u is called out', m.warnings.some((w) => /§310: the bar seat's strike solved at/.test(w)), m.warnings.filter((w) => /§310/.test(w)).slice(0, 1).join(''));
  }
}
await browser.close(); srv.close();
console.log(fails.length ? `\nFAIL: ${fails.length} check(s): ${fails.join('; ')}` : '\nPASS: every check');
process.exit(fails.length ? 1 : 0);
