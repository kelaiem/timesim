// A SECOND, FULL-SIZE GOING BARREL IN PARALLEL: HOW MUCH POWER DOES IT ADD, AND WHAT DOES IT COST THE FOOTPRINT?
// A REPORT (BACKLOG §339, reframed 2026-11-15: the owner's goal is MORE POWER in the smallest footprint, enough to drive
// and start the 36,000 A/h row, which TODO 292 measured needs about ×1.7 of today's spring at the same reserve, ×2 for the
// 200° target on a balance of r ≤ 8). It moves no metal and judges nothing.
//
//   node tools/probe-339-second-barrel.mjs [--cache FILE] ['<query>' …]   (no queries: the round and fitted alarm-free
//                                                                         builds, and the round default)
//
// THE DESIGN READ. Drum A is today's drum, where it stands, carrying the chain and its own ribbon, untouched. Barrel B, a
// second going barrel with its own ribbon, meshes a toothed band cut on A below the chain (the coupling band landing 0 (c)
// measured clear of the coil and the span at every reserve, z 2.93–4.26). The band's pitch circle stands
//     r_pA = R_A + flangeDelta  (= 2·c_end + CLEAR_MARGIN: twin-barrel.js' law, because B's wall stands on that circle
//                                all the way up its height and must clear the chain coiled on A by the margin),
// and B's teeth are cut on its wall, R_B, so B turns n = r_pA/R_B times A. B's ribbon is solved by the build's own law
// (twin-barrel.js drumRibbon → ribbon-solve.js) at n times A's hook angles, so the hook sees (k_A + n²·k_B)·θ: linear
// over the same two angles, the fusee, chain and arrest unmoved (landing 1's interface). The power at the same reserve
// goes as the released energy (GOING_POWER: the fusee torque is released / (turns·2π)), so the multiple is
// (E_A + E_B)/E_A, E_A read back by solving today's drum through the same law and held to the booted record.
//
// Per build, for each R_B on a 0.25 grid: every seat of B on its mesh circle about A (every 0.5°) where
//   - B's wall clears the fields over the drum's whole z band (probe-twin-barrel-room.mjs' free-radius field, the drum
//     group removed, imported, not copied; one CLEAR_MARGIN already taken off) and its tooth tips (R_B + m, m the great
//     wheel's module, the mesh carrying the same torque class) clear the coupling band's field;
//   - B's wall clears the chain's span on BOTH tangents (a seat whichever way the chain runs), by the margin.
// On the round builds the field is the plate one margin in, so a seat costs no footprint. On a form build each seat is
// also scored by THE CASE: the build's own fitted-case solve (layout.js fitFittedCase about the hands) re-run on the
// per-unit hulls the build publishes with B's tip circle added; its control is the area the build cut.
// Moving parts are read at rest, so a seat is a CANDIDATE for the fold's sweeps, not a placement.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMany } from './boot-pool.mjs';
import { EXPR as ROOM_EXPR } from './probe-twin-barrel-room.mjs';
import { drumRibbon, flangeDelta, DRUM_GAP_U } from '../src/twin-barrel.js';
import { TRAIN, CLEAR_MARGIN, UNIT_MM, PLATE_RIM_MARGIN, convexHull2, fitFittedCase, shapeArea } from '../src/layout.js';
import { installDetMath } from '../src/det-math.js';
installDetMath(Math);   // the pure solves read the repository's maths, as the build does (§338 landing 2)

const argOf = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const cache = argOf('--cache');
const queries = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && A[i - 1] !== '--cache');
const SPECS = queries.length ? queries : ['alarm=0', 'alarm=0&case=fitted', ''];
const FLANGE = [2.93, 4.26];   // landing 0 (c): the band clear of the chain on today's drum
const REF_EXPR = `(() => { const g = window.__clock.equalisation.going;
  return { k: g.k_Nm_per_rad, wind: g.windRangeRad, section: g.section, devLen: g.devLen_u, packing: g.packing, fw: window.__clock.fuseeWind }; })()`;
const BOOT_EXPR = `({ room: (() => { const I = window.__clock.fuseeWind.inputs, ce = window.__clock.fuseeWind.chainEndROut, CM = ${CLEAR_MARGIN};
    window.__roomGrid = { bands: [[I.FUSEE_Z0 - ce - CM, I.COIL_TOP + ce + CM], [${FLANGE[0]} - CM, ${FLANGE[1]} + CM]] };
    return ${ROOM_EXPR}; })(),
  fit: (() => { const c = window.__clock, F = c.formFootprint; if (!F || !F.fitted) return null;
    return { units: Object.fromEntries(Object.entries(c.regions.units).map(([k, v]) => [k, v.hull])),
      centre: F.fitted.centre, flatMin: F.fitted.flatMin, fitAreaMm2: F.fitAreaMm2 }; })() })`;

let boots;
if (cache && existsSync(cache)) boots = JSON.parse(readFileSync(cache, 'utf8'));
else {
  const [[ref], tgts] = await Promise.all([bootMany([''], `({ ref: ${REF_EXPR} })`), bootMany(SPECS, BOOT_EXPR)]);
  for (const [q, r] of [['(default)', ref], ...SPECS.map((q, i) => [q, tgts[i]])])
    if (r.unknownKeys?.length || r.bootError || !r.extra) { console.log(`FAIL boot ${q || '(default)'}: ${r.bootError ?? 'unknown keys ' + r.unknownKeys}`); process.exit(1); }
  boots = { ref: ref.extra.ref, tgts: SPECS.map((q, i) => ({ q, room: tgts[i].extra.room, fit: tgts[i].extra.fit })) };
  if (cache) writeFileSync(cache, JSON.stringify(boots));
}
const f = (x, d = 2) => (+x).toFixed(d);
const R0 = boots.ref, fw = R0.fw, c = R0.section.c, setup = R0.wind[0], sweep = R0.wind[1] - R0.wind[0];
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

// THE REFERENCE: today's drum through the same law reproduces the booted ribbon (probe-twin-barrel.mjs row 1's rule),
// and a drum 0.01 smaller does not. Its energy is E_A.
const RA = 10.71;   // DRUM_R_ACTUAL, held by the row below rather than trusted
const A = drumRibbon({ R: RA, c, setup, sweep });
const same = (x) => x && rel(x.k, R0.k) <= 1e-12 && rel(x.a, R0.section.a) <= 1e-12 && rel(x.L, R0.devLen) <= 1e-12;
if (!same(A) || same(drumRibbon({ R: RA - 0.01, c, setup, sweep }))) { console.log('FAIL reference: the pure solve does not reproduce today\'s ribbon at R 10.71 alone'); process.exit(1); }
console.log(`reference: drum A R ${RA}, k ${A.k.toExponential(4)} N·m/rad, E_A ${(A.energyJ * 1e3).toFixed(3)} mJ (the booted ribbon, reproduced; a drum 0.01 smaller is not)`);
const ce = fw.chainEndROut, RL = fw.fuseeRLarge, CM = CLEAR_MARGIN, m = TRAIN.barrel.module;
const rpA = RA + flangeDelta(fw), rCoil = RA + 2 * ce;
console.log(`coupling band on A: pitch r ${f(rpA, 3)} (A's coil ${f(rCoil, 3)} + ${CM}), module ${f(m, 4)} (the great wheel's), z ${FLANGE[0]}–${FLANGE[1]}`);

// B's energy at each radius, n = r_pA/R_B: the power multiple at the same reserve
const RBs = []; for (let R = 4; R <= 14 + 1e-9; R += 0.25) RBs.push(+R.toFixed(2));
const ener = Object.fromEntries(RBs.map((R) => { const n = rpA / R, B = drumRibbon({ R, c, setup: n * setup, sweep: n * sweep });
  return [R, B ? { n, B, mult: (A.energyJ + B.energyJ) / A.energyJ, kHook: A.k + n * n * B.k } : null]; }));
console.log('B alone, solved at n times the hook\'s angles (the power multiple at the same reserve, A + B over A):');
console.log('  ' + RBs.filter((R) => Math.abs(R * 2 - Math.round(R * 2)) < 1e-9).map((R) => ener[R] ? `R ${R}: ×${f(ener[R].mult, 3)}` : `R ${R}: no ribbon`).join(', '));

const mk = (G) => (x, y) => { const i = Math.round((x - G.bx0) / G.res), j = Math.round((y - G.by0) / G.res);
  return i < 0 || j < 0 || i >= G.nx || j >= G.ny ? -Infinity : G.r[j * G.nx + i]; };
const segD = (px, py, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy, t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L2));
  return Math.hypot(px - a.x - t * vx, py - a.y - t * vy); };
const circ = (x, y, r, n = 64) => Array.from({ length: n }, (_, i) => [x + (r / Math.cos(Math.PI / n)) * Math.cos((2 * Math.PI * i) / n), y + (r / Math.cos(Math.PI / n)) * Math.sin((2 * Math.PI * i) / n)]);
const RESULT = [];
for (const { q, room, fit } of boots.tgts) {
  const Rr = room.reach, fus = Rr.fuseeCentre, dir = Rr.drumDir;
  const F0 = mk(room.free.withoutDrumGroup.grid), F1 = mk(room.free.bands[0].grid), F2 = mk(room.free.bands[1].grid);
  // drum A where the build stands it (main.js' law: FUSEE_R_LARGE + R + DRUM_GAP_U along drumDir), held to the record
  const dA = RL + RA + DRUM_GAP_U, Ac = { x: fus[0] + dA * dir[0], y: fus[1] + dA * dir[1] };
  const off = Math.hypot(Ac.x - Rr.drumCentre[0], Ac.y - Rr.drumCentre[1]);
  console.log(`\n${q || '(round default)'}: drum A at (${f(Ac.x)}, ${f(Ac.y)})${off > 1e-6 ? ` — FAIL: the build's drum stands ${f(off, 4)} away` : ' (the build\'s own centre)'}`);
  if (off > 1e-6) process.exit(1);
  // the chain's span, both open-belt tangents from the cone's largest wrap to A's wrap
  const T = [1, -1].map((sg) => { const r1 = RL, r2 = RA + ce, dx = Ac.x - fus[0], dy = Ac.y - fus[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, a = Math.acos((r1 - r2) / L);
    const cs = Math.cos(sg * a), sn = Math.sin(sg * a), nx = ux * cs - uy * sn, ny = uy * cs + ux * sn;
    return [{ x: fus[0] + nx * r1, y: fus[1] + ny * r1 }, { x: Ac.x + nx * r2, y: Ac.y + ny * r2 }]; });
  const seatsAt = (R) => { const out = [];
    for (let k = 0; k < 720; k++) { const ph = (k / 2) * Math.PI / 180, B = { x: Ac.x + (rpA + R) * Math.cos(ph), y: Ac.y + (rpA + R) * Math.sin(ph) };
      const mB = Math.min(F0(B.x, B.y) - R, F2(B.x, B.y) - (R + m));
      if (mB < 0) continue;
      const span = Math.min(...T.map((g) => segD(B.x, B.y, ...g) - ce - R - CM));
      if (span < 0) continue;
      out.push({ az: k / 2, B, margin: Math.min(mB, span) }); }
    return out; };
  const mm2 = UNIT_MM * UNIT_MM;
  const fitArea = fit && ((pts) => { const h = convexHull2(Float64Array.from(pts, (p) => p[0]), Float64Array.from(pts, (p) => p[1]), pts.length);
    const xs = h.map((p) => p[0]), ys = h.map((p) => p[1]);
    const ft = fitFittedCase(h, [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], { margin: PLATE_RIM_MARGIN, centre: fit.centre, flatMin: fit.flatMin });
    return { area: shapeArea(ft.shape) * mm2, b: ft.shape.bounds }; });
  const all = fit && Object.values(fit.units).flat();
  const A0 = fit && fitArea(all);
  if (fit) console.log(`  the case: the build cut ${f(fit.fitAreaMm2)} mm²; every unit re-fitted ${f(A0.area)} mm² (${Math.abs(A0.area / fit.fitAreaMm2 - 1) < 1e-5 ? 'reproduces it' : 'DOES NOT reproduce it'})`);
  const rows = [];
  for (const R of RBs) { const e = ener[R]; if (!e) continue;
    const S = seatsAt(R); if (!S.length) continue;
    let best = null;
    if (fit) { for (const s of S.filter((s) => Math.abs(s.az - Math.round(s.az / 2) * 2) < 1e-9)) {
        const a = fitArea([...all, ...circ(s.B.x, s.B.y, R + m)]);
        if (!best || a.area < best.area - 1e-9 || (Math.abs(a.area - best.area) <= 1e-9 && s.margin > best.s.margin)) best = { ...a, s }; } }
    const wide = [...S].sort((p, q) => q.margin - p.margin)[0];
    rows.push({ R, mult: e.mult, n: e.n, seats: S.length, arcs: S, wide, best }); }
  if (!rows.length) { console.log('  no barrel B of R ≥ 4 has a seat on its mesh circle about A clear of the fields and the span'); RESULT.push({ q, largest: null }); continue; }
  for (const r of rows.filter((r, i, X) => i === X.length - 1 || Math.abs(r.R - Math.round(r.R)) < 1e-9 || r.mult >= 1.67 && X[i - 1]?.mult < 1.67 || r.mult >= 2 && X[i - 1]?.mult < 2))
    console.log(`  R_B ${f(r.R)} (n ${f(r.n, 3)}, power ×${f(r.mult, 3)}): ${r.seats} seats; widest margin ${f(r.wide.margin, 3)} at ${r.wide.az}° round A (${f(r.wide.B.x)}, ${f(r.wide.B.y)})`
      + (r.best ? `; least case ${f(r.best.area)} mm² (${f((r.best.area / A0.area - 1) * 100, 1)}%) at ${r.best.s.az}°` : ''));
  const L = rows.at(-1);
  console.log(`  the LARGEST B with a seat: R ${f(L.R)}, power ×${f(L.mult, 3)}${L.mult >= 2 ? ' (≥ ×2: the 36,000 row\'s target on r ≤ 8)' : L.mult >= 1.67 ? ' (past the ×1.67 crossing threshold, short of ×2)' : ' (short of the ×1.67 crossing threshold)'}`);
  const free = fit && rows.filter((r) => r.best && r.best.area <= A0.area + 1e-6);
  if (fit) console.log(`  inside today's case: ${free.length ? `up to R ${f(free.at(-1).R)}, power ×${f(free.at(-1).mult, 3)}` : 'no B adds power without growing the case'}`);
  RESULT.push({ q, largest: { R: L.R, mult: +L.mult.toFixed(4), seats: L.seats }, caseFree: fit ? (free.length ? { R: free.at(-1).R, mult: +free.at(-1).mult.toFixed(4) } : null) : 'round',
    curve: rows.map((r) => ({ R: r.R, mult: +r.mult.toFixed(4), seats: r.seats, caseMm2: r.best ? +r.best.area.toFixed(2) : null })) });
}
console.log('\nRESULT ' + JSON.stringify(RESULT));
process.exit(0);
