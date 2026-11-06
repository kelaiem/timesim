#!/usr/bin/env node
// §337 landing 2a — HOW BIG A BULGE THE CONE WINDOW NEEDS for the geared Geneva, and whether the plate's lands allow it. A REPORT.
//
// probe-337-fold-site found six reserves short in plan against the window AS SOLVED (the star's edge reaching the rim by up to
// 0.16, 39 h by 0.78). The owner chose to GROW the window locally instead of bending the line. A bulge is a disc round each
// layer's centre (the cone wheel round the cone, the finger's discs round the finger, the star's tip circle round the star),
// merged into the cone window, so it is feasible where the plate's LAND FIELD (main.js plateLandAt: distance to the nearest
// opening, pivot boss or rim, less TQ_LAND_MIN) is at least the disc's radius plus a margin. The search is probe-337-fold-site's
// with that field in place of the window's edge. It prints the best margin, what binds it, and the bulge's area outside the
// window as solved (the metal the plate gives up).
//
// And the STUDS' SUPPORT: the finger's and the star's studs hang from the cock, so the fold adds a BRANCH ARM off the cock's boss
// (in the cock's plane, flush with the plate) running boss → finger → star. It is a cantilever in plan, loaded at the finger by
// the pin's force plus the mesh's (the torque the finger carries, stall / g, over the pinion's pitch radius) and at the star by
// the pin's force, so its root width is the cock's bar's law, b = √(6·M/(T·σ_y)), M = Σ F·(distance to the boss). The arm must
// stand a margin inside the opening the bulge makes, so each point of the path needs room for b/2 + a margin. Reported per
// reserve: the root width, and the bulge with the arm counted.
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
import { STOCK_MIN_U, CLEAR_MARGIN, UNIT_MM } from '../src/layout.js';

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
  const G = 0.1, R = 25, n = Math.round((2 * R) / G) + 1, land = new Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) land[j * n + i] = +c.plateLandAt(C.x - R + i * G, C.y - R + j * G).toFixed(3);
  return { land: { n, G, R, v: land }, C: { x: C.x, y: C.y }, coneTop: top, bossBot: k ? k.bossMid - k.T / 2 : null, T: k?.T ?? null, yieldPa: k?.bar?.yield_Pa ?? null, bearing: k?.foot?.a ?? null, postS: k?.post?.s_u ?? null,
    win: win ? win.pts : null, stall: c.equalisation?.going?.energy?.fuseeTorque_Nm ?? null };
})()`;
const boots = await bootMany(HOURS.map((h) => `reserveh=${h}`), EXPR, { concurrency: par });

const segD = (x, y, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1e-12; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L2)); return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy); };
const inside = (pts, x, y) => { let s = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
const landAt = (L, x, y) => {   // bilinear on the land grid; outside the grid, no room
  const u = (x - (L.cx - L.R)) / L.G, v = (y - (L.cy - L.R)) / L.G, i = Math.floor(u), j = Math.floor(v);
  if (i < 0 || j < 0 || i >= L.n - 1 || j >= L.n - 1) return -Infinity;
  const fu = u - i, fv = v - j, g = (a, b) => L.v[(j + b) * L.n + i + a];
  return g(0, 0) * (1 - fu) * (1 - fv) + g(1, 0) * fu * (1 - fv) + g(0, 1) * (1 - fu) * fv + g(1, 1) * fu * fv;
};
const edge = (pts, x, y) => { let d = Infinity; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) d = Math.min(d, segD(x, y, pts[j], pts[i])); return inside(pts, x, y) ? d : -d; };

console.log('reserve  z band (need)       best margin (land)  binding            bulge  star  drive   k   D      finger  star');
for (let i = 0; i < HOURS.length; i++) {
  const h = HOURS[i], r = boots[i]?.extra;
  if (r?.land) { r.land.cx = r.C.x; r.land.cy = r.C.y; }
  const cap = (x, y) => Math.max(edge(r.win, x, y), landAt(r.land, x, y));   // the window as solved, or the bulge the land allows
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
      const mCone = cap(r.C.x, r.C.y) - coneTip - M;
      for (let pd = 0; pd < 360; pd += 2) {
        const p = (pd * Math.PI) / 180, Fx = r.C.x + D * Math.cos(p), Fy = r.C.y + D * Math.sin(p);
        const eF = cap(Fx, Fy);
        const mF = Math.min(eF - pinTip - M, eF - crankR - M, eF - g.lockHi - M, D - crankR - keep);
        if (Math.min(mF, mCone) < 0) continue;   // a bulge is wanted only where the land allows the disc at all
        for (let sd = 0; sd < 360; sd += 2) {
          const s = (sd * Math.PI) / 180, Sx = Fx + g.a * Math.cos(s), Sy = Fy + g.a * Math.sin(s);
          const mS = Math.min(cap(Sx, Sy) - g.rTip - M, Math.hypot(Sx - r.C.x, Sy - r.C.y) - g.rTip - keep);
          // the branch arm: boss → finger → star, a cantilever off the boss, uniform at its root width (an upper bound on the taper)
          const dF = Math.hypot(Fx - r.C.x, Fy - r.C.y), dS = Math.hypot(Sx - r.C.x, Sy - r.C.y);
          const Ff = g.F + (r.stall * 1000 / (row.num / row.den)) / ((MODULE_MIN_U * zf / 2) * UNIT_MM), Fs = g.F;   // N: the stall is N·m, ×1000 = N·mm
          const Mroot = (Ff * dF + Fs * dS) * UNIT_MM;                                                // N·mm
          const armW = Math.sqrt((6 * Mroot) / ((r.T * UNIT_MM) * (r.yieldPa / 1e6))) / UNIT_MM;     // units
          let mA = Infinity;
          for (const [ax, ay, bx, by] of [[r.C.x, r.C.y, Fx, Fy], [Fx, Fy, Sx, Sy]])
            for (let q = 0; q <= 12; q++) { const x = ax + ((bx - ax) * q) / 12, y = ay + ((by - ay) * q) / 12; mA = Math.min(mA, cap(x, y) - armW / 2 - M); }
          const m = Math.min(mF, mS, mCone, mA);
          if (m < 0) continue;
          const prot = (x, y, rad) => Math.max(0, rad + M - edge(r.win, x, y));
          let armProt = 0;
          for (const [ax, ay, bx, by] of [[r.C.x, r.C.y, Fx, Fy], [Fx, Fy, Sx, Sy]])
            for (let q = 0; q <= 12; q++) armProt = Math.max(armProt, prot(ax + ((bx - ax) * q) / 12, ay + ((by - ay) * q) / 12, armW / 2 - M));
          const bulge = Math.max(prot(Fx, Fy, Math.max(pinTip, crankR, g.lockHi)), prot(Sx, Sy, g.rTip), prot(r.C.x, r.C.y, coneTip), armProt);
          // the least bulge (how far the worst disc stands past the window as solved); of equals, the more margin
          if (!best || bulge < best.bulge - 1e-9 || (Math.abs(bulge - best.bulge) <= 1e-9 && m > best.m)) {
            const why = [[mCone, 'cone wheel ⇄ land'], [eF - Math.max(pinTip, crankR, g.lockHi) - M, 'finger ⇄ land'], [D - crankR - keep, 'crank ⇄ arbor'],
              [cap(Sx, Sy) - g.rTip - M, 'star ⇄ land'], [Math.hypot(Sx - r.C.x, Sy - r.C.y) - g.rTip - keep, 'star ⇄ arbor']].sort((u, v) => u[0] - v[0])[0][1];
            best = { armW, bulge, m, why, n: row.n, mm: row.m, zc, zf, kk, D, pd, sd, S: Math.hypot(Sx - r.C.x, Sy - r.C.y) };
          }
        }
      }
    }
  }
  const winR = Math.max(...r.win.map(([x, y]) => Math.hypot(x - r.C.x, y - r.C.y)));
  console.log(`  ${String(h).padStart(2)} h  ${f3(band)} (${f3(needZ)})   ${best ? f3(best.m).padStart(7) : '   none'}           ${best ? best.why.padEnd(18) : ''}  bulge ${best ? f3(best.bulge) : ''} arm ${best ? f3(best.armW) : ''} ${best ? `n${best.n}m${best.mm} ${best.zc}:${best.zf}  ${best.kk}  ${f3(best.D)}  ${best.pd}°    |S| ${f3(best.S)}` : ''}   window r ≤ ${f3(winR)}`);
}
