#!/usr/bin/env node
// §337 landing 2a — WHERE THE GEARED GENEVA CAN FOLD: under the fusee cock, in the cone window's air. A REPORT (it prints and
// judges nothing; the fold's build is what will be gated).
//
// Every reserve but 30 h builds §336's fusee cock (§329's direct stop-work keeps the plate's island at 30 h), and with no plate
// over the cone the window is air from the cone's top face up to the cock's boss. That band, less a margin at each end, must
// hold the line's three layers (src/geared-geneva.js): the GEAR layer (the cone's wheel fast on the fusee's arbor, the finger's
// pinion at the pair's centre distance D), the CRANK layer (the pin's circle, r1 + pin, round the finger) and the STAR layer
// (the star's tip circle round its centre S, a from the finger, and the lock disc round the finger). In plan each must stand
// inside the cone window a margin from its edge, and clear the fusee's arbor (TRAIN_STAFF_R, read from main.js's text) by a
// margin. The search, per reserve: every (m, n) the line offers and the pair at its least k and a few larger (a larger k moves
// D out, with the same ratio), every finger direction round the cone (2°), and every star direction round the finger (2°). It
// prints the best plan margin, the arrangement that gives it, what binds it, and the z budget. The finger's and the star's
// studs are to hang from the cock (the finger's under its crank, the star's from an arm the fold adds), so no plan support is
// required here; that, and the stud and the arm's sizing, is the fold's.
//   node tools/probe-337-fold-site.mjs [--par N] [--hours 24,36]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootMany } from './boot-pool.mjs';
import { chooseGearedStopwork, gearPair, MODULE_MIN_U, sizeGeneva } from '../src/geared-geneva.js';
import { STOCK_MIN_U, CLEAR_MARGIN } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const par = args.includes('--par') ? Number(args[args.indexOf('--par') + 1]) : 3;
const HOURS = args.includes('--hours') ? args[args.indexOf('--hours') + 1].split(',').map(Number) : Array.from({ length: 13 }, (_, i) => 12 + 3 * i).filter((h) => h !== 30);
const staffR = Number(/const TRAIN_STAFF_R = ([\d.]+);/.exec(readFileSync(join(ROOT, 'src/main.js'), 'utf8'))[1]);
const M = CLEAR_MARGIN, f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));

const EXPR = `(() => {
  const c = window.__clock, k = c.fuseeCock, C = c.P.barrel;
  let cone = null; c.scene.traverse((o) => { if (!cone && o.name === 'fuseeCone') cone = o; });
  const top = cone ? new cone.geometry.boundingBox.constructor().setFromObject(cone).max.z : null;
  const win = (c.tqWindowPolys || []).find((w) => w.name === 'fusee');
  return { C: { x: C.x, y: C.y }, coneTop: top, bossBot: k ? k.bossMid - k.T / 2 : null, bearing: k?.foot?.a ?? null, postS: k?.post?.s_u ?? null,
    win: win ? win.pts : null, stall: c.equalisation?.going?.energy?.fuseeTorque_Nm ?? null };
})()`;
const boots = await bootMany(HOURS.map((h) => `reserveh=${h}`), EXPR, { concurrency: par });

const segD = (x, y, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1e-12; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L2)); return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy); };
const inside = (pts, x, y) => { let s = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
const edge = (pts, x, y) => { let d = Infinity; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) d = Math.min(d, segD(x, y, pts[j], pts[i])); return inside(pts, x, y) ? d : -d; };

console.log('reserve  z band (need)       best plan margin  binding            star  drive   k   D      finger  star');
for (let i = 0; i < HOURS.length; i++) {
  const h = HOURS[i], r = boots[i]?.extra;
  if (!r || !r.win || !(r.stall > 0)) { console.log(`  ${h} h  no cock or window on this build (${boots[i]?.bootError ?? JSON.stringify(r)?.slice(0, 80)})`); continue; }
  const band = (r.bossBot - M) - (r.coneTop + M), needZ = 3 * STOCK_MIN_U + 2 * M;
  const { rows } = chooseGearedStopwork(h, { stallNmm: r.stall * 1000, coneBoreR: staffR });
  let best = null;
  for (const row of rows) {
    if (row.direct) continue;
    for (let kk = row.k; kk <= row.k + 4; kk++) {
      const zc = row.num * kk, zf = row.den * kk, D = (MODULE_MIN_U * (zc + zf)) / 2;
      const g = row.geneva, coneTip = (MODULE_MIN_U * (zc + 2)) / 2, pinTip = (MODULE_MIN_U * (zf + 2)) / 2;
      const crankR = g.r1 + g.rPin, keep = staffR + M;
      const mCone = edge(r.win, r.C.x, r.C.y) - coneTip - M;
      for (let pd = 0; pd < 360; pd += 2) {
        const p = (pd * Math.PI) / 180, Fx = r.C.x + D * Math.cos(p), Fy = r.C.y + D * Math.sin(p);
        const eF = edge(r.win, Fx, Fy);
        const mF = Math.min(eF - pinTip - M, eF - crankR - M, eF - g.lockHi - M, D - crankR - keep);
        if (best && Math.min(mF, mCone) < best.m) continue;
        for (let sd = 0; sd < 360; sd += 2) {
          const s = (sd * Math.PI) / 180, Sx = Fx + g.a * Math.cos(s), Sy = Fy + g.a * Math.sin(s);
          const mS = Math.min(edge(r.win, Sx, Sy) - g.rTip - M, Math.hypot(Sx - r.C.x, Sy - r.C.y) - g.rTip - keep);
          const m = Math.min(mF, mS, mCone);
          if (!best || m > best.m) {
            const why = [[mCone, 'cone wheel ⇄ window'], [eF - Math.max(pinTip, crankR, g.lockHi) - M, 'finger ⇄ window'], [D - crankR - keep, 'crank ⇄ arbor'],
              [edge(r.win, Sx, Sy) - g.rTip - M, 'star ⇄ window'], [Math.hypot(Sx - r.C.x, Sy - r.C.y) - g.rTip - keep, 'star ⇄ arbor']].sort((u, v) => u[0] - v[0])[0][1];
            best = { m, why, n: row.n, mm: row.m, zc, zf, kk, D, pd, sd, S: Math.hypot(Sx - r.C.x, Sy - r.C.y) };
          }
        }
      }
    }
  }
  const winR = Math.max(...r.win.map(([x, y]) => Math.hypot(x - r.C.x, y - r.C.y)));
  console.log(`  ${String(h).padStart(2)} h  ${f3(band)} (${f3(needZ)})   ${best ? f3(best.m).padStart(7) : '   none'}           ${best ? best.why.padEnd(18) : ''} ${best ? `n${best.n}m${best.mm} ${best.zc}:${best.zf}  ${best.kk}  ${f3(best.D)}  ${best.pd}°    |S| ${f3(best.S)}` : ''}   window r ≤ ${f3(winR)}`);
}
