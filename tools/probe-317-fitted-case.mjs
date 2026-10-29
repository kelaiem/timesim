#!/usr/bin/env node
// §317 — THE FITTED TONNEAU, held: the case archetype derived from the solved tonneau and form-fitted to the
// least plan AREA (layout.js caseShapeOf 'fitted', fitFittedCase). (§317's stepped back, the volume half, was
// retired by §321 for a flat one, and its B tests with it.) Pure Node over layout.js, the measured hull read from tools/data/probe-317-hull.json
// (`--refresh` re-measures it: one Chromium boot of ?case=fitted at the fixture's spec, through boot-form.mjs).
//
//   S  the shape law. S1 at the tonneau's own curvature and tau 0 the fitted shape IS the tonneau (every ray's
//      exit to 1e-9; the control: tau 0.2 moves it); S2 a grow is the exact offset (every vertex of the shape
//      grown g reads inset −g to 1e-9) and stays convex; S3 a tau tapers it, the end nearer the apex the wider.
//   F  the fit, on the measured hull. F1 it holds every hull vertex at the rim margin; F2 both straight ends run
//      the lug pair's reach; F3 it is TIGHT: each bound pulled in 0.01 u refuses the metal (the control on F1 —
//      a fit that held by being loose would pass F1 alone); F4 it is a LOCAL MINIMUM: k and yA nudged ±1% and
//      re-tightened never enclose less; F5 it encloses less than the tonneau it started from, and less than
//      every other kind's §308 fit (the ranking is printed — the owner's question, measured); F6 it is GLOBAL over a
//      25 × 25 grid of (k, yA) — the landscape is a diagonal V-valley an axis search stalls in (it did, at 1074.19
//      mm²), and the grid's best must beat that stalled answer, its control.
// An ACCEPTANCE test: exits non-zero on any failure.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'tools/data/probe-317-hull.json');
let fails = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails++; };
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const U = L.UNIT_MM, M = L.PLATE_RIM_MARGIN, mm2 = U * U;

if (process.argv.includes('--refresh')) {
  const fx = JSON.parse(readFileSync(FIX, 'utf8'));
  const { bootForm } = await import('./boot-form.mjs');
  const r = await bootForm(fx.query, '({ dial: __clock.P.dial })');
  if (!r.ff?.hull) { console.error('refresh: the boot published no hull', r.bootError ?? ''); process.exit(1); }
  writeFileSync(FIX, JSON.stringify({ ...fx, hull: r.ff.hull, metal: r.ff.metal, centre: [r.extra.dial.x, r.extra.dial.y] }));
  console.log(`refreshed ${FIX}: ${r.ff.hull.length} hull vertices`);
}

// ── S: the shape law ────────────────────────────────────────────────────────────────────────────────────────
{
  const box = { xMin: -40, xMax: 40, yMin: -45, yMax: 47 };
  const t = L.caseShapeOf('tonneau', box), f = L.caseShapeOf('fitted', box), f2 = L.caseShapeOf('fitted', box, { fitted: { k: f.fitted.k, tau: 0.2 } });
  let d = 0, d2 = 0;
  for (let i = 0; i < 720; i++) { const az = (i * Math.PI) / 360; d = Math.max(d, Math.abs(t.exit(az) - f.exit(az))); d2 = Math.max(d2, Math.abs(t.exit(az) - f2.exit(az))); }
  ok('S1 at the tonneau\'s curvature and tau 0 the fitted shape is the tonneau', d < 1e-9, `max exit difference ${d.toExponential(2)}`);
  ok('S1 control: tau 0.2 moves the outline', d2 > 0.1, `max exit difference ${d2.toFixed(3)}`);
  let e = 0, cv = true;
  for (const g of [2.5, 5.278, -3]) {
    const gg = f2.grown(g), lp = gg.loop();
    for (const [x, y] of lp) e = Math.max(e, Math.abs(f2.inset(x, y) + g));
    cv = cv && L.loopConvexity(lp).ok;
  }
  ok('S2 a grow is the exact offset, and convex', e < 1e-9 && cv, `worst |inset + g| ${e.toExponential(2)}`);
  ok('S3 a tau tapers it: the end nearer the apex is the wider', f2.flatTop > f2.flatBot && f.flatTop === f.flatBot,
    `half-runs ${f2.flatTop.toFixed(3)} / ${f2.flatBot.toFixed(3)} at tau 0.2, ${f.flatTop.toFixed(3)} both at 0`);
}

// ── F: the fit, on the measured hull ────────────────────────────────────────────────────────────────────────
const fx = JSON.parse(readFileSync(FIX, 'utf8'));
const { hull, metal, centre } = fx;
const NEED = (20 / U + 1 / U) / 2 + 0.5 / U;   // makeFormCase's lug reach: (CASE_LUG_INNER + CASE_LUG_T)/2 + CASE_LUG_T/2
{
  const fit = L.fitFittedCase(hull, metal, { centre, flatMin: NEED });
  const sh = fit.shape, p = fit.params;
  const worst = (s) => { let w = Infinity; for (const [x, y] of hull) w = Math.min(w, s.inset(x, y)); return w; };
  ok('F1 the fit holds every hull vertex at the rim margin', fit.worst >= M - 1e-9, `worst inset ${fit.worst.toFixed(6)} (need ≥ ${M})`);
  ok('F2 both straight ends run the lug pair\'s reach', sh.flatTop >= NEED - 1e-9 && sh.flatBot >= NEED - 1e-9,
    `half-runs ${(sh.flatTop * U).toFixed(3)} / ${(sh.flatBot * U).toFixed(3)} mm against ${(NEED * U).toFixed(3)}`);
  const make = (q) => { const b = (q.y1 - q.y0) / 2, cy = (q.y0 + q.y1) / 2;
    return quiet(() => L.caseShapeOf('fitted', { xMin: centre[0] - q.a, xMax: centre[0] + q.a, yMin: q.y0, yMax: q.y1 }, { fitted: { k: q.k, tau: (q.yA - cy) / b } })); };
  const feasible = (q) => { const s = make(q); return s.flatTop >= NEED - 1e-9 && s.flatBot >= NEED - 1e-9 && worst(s) >= M - 1e-9; };
  const tight = [['a', -0.01], ['y1', -0.01], ['y0', 0.01]].map(([k, d]) => [k, feasible({ ...p, [k]: p[k] + d })]);
  ok('F3 the fit is tight: each bound pulled in 0.01 u refuses the metal', tight.every(([, f]) => !f), tight.map(([k, f]) => `${k} ${f ? 'still holds' : 'refused'}`).join(', '));
  // a local minimum: the solve's own law re-run from nudged starting points
  let worse = Infinity;
  for (const [k, s] of [['k', 1.01], ['k', 0.99], ['yA', 1]]) for (const sgn of [1, -1]) {
    const q = { ...p, [k]: k === 'k' ? p.k * (sgn > 0 ? s : 2 - s) : p.yA + sgn * 0.01 * (p.y1 - p.y0) };
    // re-tighten q's bounds: the bisection fitFittedCase runs, for a fixed (k, yA)
    let r = { ...q };
    for (let pass = 0; pass < 40; pass++) for (const [b, dir] of [['a', 1], ['y1', 1], ['y0', -1]]) {
      let hi = r[b]; let st = 0.05; let n = 0;
      while (!feasible({ ...r, [b]: hi }) && n++ < 80) { hi += dir * st; st *= 2; }
      let lo = hi - dir * 0.05; st = 0.05; n = 0;
      while (feasible({ ...r, [b]: lo }) && n++ < 80) { hi = lo; st *= 2; lo -= dir * st; }
      while (Math.abs(hi - lo) > 1e-7) { const m = (lo + hi) / 2; if (feasible({ ...r, [b]: m })) hi = m; else lo = m; }
      r = { ...r, [b]: hi };
    }
    worse = Math.min(worse, L.shapeArea(make(r)) - fit.area);
  }
  ok('F4 the fit is a local minimum: k and yA nudged and re-tightened never enclose less', worse > -1e-6 * fit.area, `least change ${(worse * mm2).toFixed(4)} mm²`);
  // F6 — GLOBAL, not only local: the solve's landscape is a V-shaped valley along a diagonal (the record's grid),
  // where an axis-aligned search stalls on the floor. A brute grid over (k, yA) — 25 × 25, k from a quarter of the
  // tonneau's curvature to four times it, yA over the ends, the half-width bisected at the fit's own ends — must find
  // nothing smaller. Its CONTROL: the grid's best must beat 1074.19 mm², what the stalled compass solve shipped on
  // this hull's first measurement, or the grid is too coarse to catch the defect it exists for.
  {
    const kt = fit.tonneau.fitted?.k ?? 2 * L.TONNEAU_BOW / (L.TONNEAU_BOW ** 2 + (fit.tonneau.hh / fit.tonneau.hw) ** 2);
    let gBest = Infinity;
    for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) {
      const k = kt * 4 ** (2 * i / 24 - 1), yA = p.y0 + (p.y1 - p.y0) * j / 24;
      let lo = 20, hi = 80;
      if (!feasible({ ...p, a: hi, k, yA })) continue;
      while (hi - lo > 1e-5) { const m = (lo + hi) / 2; if (feasible({ ...p, a: m, k, yA })) hi = m; else lo = m; }
      gBest = Math.min(gBest, L.shapeArea(make({ ...p, a: hi, k, yA })));
    }
    ok('F6 the fit is the valley\'s floor: no point of a 25 × 25 grid encloses less', fit.area <= gBest + 1e-6 * fit.area && gBest * mm2 < 1074.19,
      `fit ${(fit.area * mm2).toFixed(2)} mm², grid's best ${(gBest * mm2).toFixed(2)} (control: under the stalled solve's 1074.19)`);
  }
  const rows = ['rect', 'cushion', 'tonneau'].map((k) => [k, L.shapeArea(L.fitCaseShape(k, hull, metal, { centre }).shape)]);
  let A = 0, P = 0; for (let i = 0; i < hull.length; i++) { const [ax, ay] = hull[i], [bx, by] = hull[(i + 1) % hull.length]; A += ax * by - ay * bx; P += Math.hypot(bx - ax, by - ay); }
  const bound = A / 2 + P * M + Math.PI * M * M;
  console.log('      plan areas on the measured hull (hands centred across the width):');
  for (const [k, a] of rows) console.log(`        ${k.padEnd(10)} ${(a * mm2).toFixed(1).padStart(7)} mm²  (§308 fit)`);
  console.log(`        ${'fitted'.padEnd(10)} ${(fit.area * mm2).toFixed(1).padStart(7)} mm²  ${(2 * sh.hw * U).toFixed(2)} × ${(2 * sh.hh * U).toFixed(2)} mm, k ${sh.fitted.k.toFixed(4)}, tau ${sh.fitted.tau.toFixed(4)}, hands ${(fit.handOff * U).toFixed(3)} mm off the 12–6 middle`);
  console.log(`        ${'bound'.padEnd(10)} ${(bound * mm2).toFixed(1).padStart(7)} mm²  (the hull grown by the rim margin: no convex case is smaller)`);
  ok('F5 the fitted tonneau encloses less than the tonneau it started from and every other kind\'s §308 fit',
    rows.every(([, a]) => fit.area < a) && Math.abs(fit.tonneauArea - rows[2][1]) < 1e-9 && fit.area > bound,
    `${(fit.area * mm2).toFixed(1)} mm² against the tonneau's ${(fit.tonneauArea * mm2).toFixed(1)} (−${(100 * (1 - fit.area / fit.tonneauArea)).toFixed(1)}%)`);
}

console.log(fails ? `${fails} FAILED` : 'all PASS');
process.exit(fails ? 1 : 0);
