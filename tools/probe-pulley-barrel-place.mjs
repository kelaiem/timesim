// WHERE DOES THE BARREL GO, AND WHAT DOES THE FORM CASE GIVE BACK? A REPORT (BACKLOG §339 landing 2a', before the fold:
// it moves no metal, and it judges nothing).
//
//   node tools/probe-pulley-barrel-place.mjs [--cache FILE]
//
// It boots `alarm=0&case=fitted` (§339's target: the drum sets that case's +y) and the round default (the record's laws),
// and reads the declared PULLEY_BARREL through twin-barrel.js' pulleyBarrel. Then, in the drum's z band:
//   - the PULLEY A on the drum's own direction (drumDirOf, the one law) at its own centre distance
//     FUSEE_R_LARGE + R_A + 2.5 (main.js' law for the drum), and the free radius at its centre against its flange's
//     tips (r_pA + m), read off tools/probe-twin-barrel-room.mjs' free-radius field with the drum group removed
//     (imported, not copied; one CLEAR_MARGIN already taken off);
//   - the BARREL B on the circle of centres r_pA + R_B about A (its mesh), every 0.25°: a seat where the field's free
//     radius covers B's tooth tips (R_B + m) and B's wall stands a CLEAR_MARGIN off the chain's span, taken as the
//     convex hull of the cone's largest wrap circle and A's coil;
//   - per feasible seat, the axis-aligned box of the rest of the counted metal together with A and B, against today's
//     box (the rest with the drum group): what the PLATES' rectangle could give back;
//   - and THE CASE: the build's own fitted-case solve (layout.js fitFittedCase, about the hands) re-run on the per-unit
//     hulls the build publishes (__clock.regions), its control the area the build cut, then with the drum group out and
//     with the pulley and the barrel at the best box's seat. The case is what a wearer measures, and it is solved about
//     the hands, so the box and the case can disagree; this row is what found that they do.
//   - the seats SCORED BY THE CASE (a 2° subsample, the fit being a ~10 s solve), and the BOUND with the fields ignored
//     (every other part re-sited): today's outline as the screen, the roomiest seats fitted;
//   - and the LARGEST BARREL that clears the fields and stands inside today's outline, and inside the drum-out one: the
//     radius a barrel's energy would have to be found in if it is to give the case area back.
// Moving parts are read at rest, so a seat is a CANDIDATE for the fold's sweeps, not a placement.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMany } from './boot-pool.mjs';
import { EXPR as ROOM_EXPR } from './probe-twin-barrel-room.mjs';
import { pulleyBarrel, pickPulleyBarrel, DRUM_GAP_U } from '../src/twin-barrel.js';
import { PULLEY_BARREL, CLEAR_MARGIN, UNIT_MM, PLATE_RIM_MARGIN, convexHull2, fitFittedCase, shapeArea } from '../src/layout.js';
import { installDetMath } from '../src/det-math.js';
// the build computes with the repository's maths (§338 landing 2), so the pure solves here must too: a row that
// holds Node's solve to the booted record to the bit is otherwise comparing two engines' last ulps
installDetMath(Math);

const ci = process.argv.indexOf('--cache'), cache = ci >= 0 ? process.argv[ci + 1] : null;
const REF_EXPR = `(() => { const g = window.__clock.equalisation.going;
  return { k: g.k_Nm_per_rad, section: g.section, fw: window.__clock.fuseeWind }; })()`;
const TARGET = 'alarm=0&case=fitted';
const FLANGE_TOP = 4.26;
// THE RAISE a taller barrel B may take above the drum's top (the top read off this boot's depth row, held below): the
// smaller barrel that gives the case back drives the train at ~0.954 of today at the ribbon's height 2c, so its ribbon
// wants 2c(1/0.954 − 1) ≈ 0.169 more; RAISE is that rounded up, and the probe refuses a pick asking more than it.
const DRUM_TOP = 7.97, RAISE = 0.20;   // landing 0 (c): the top of the band the chain never reaches on today's drum (the fold re-measures it on the pulley)
let boots;
if (cache && existsSync(cache)) boots = JSON.parse(readFileSync(cache, 'utf8'));
else {
  const [[ref], [tgt]] = await Promise.all([bootMany([''], `({ ref: ${REF_EXPR} })`),
    bootMany([TARGET], `({ room: (() => { const I = window.__clock.fuseeWind.inputs, ce = window.__clock.fuseeWind.chainEndROut, CM = ${CLEAR_MARGIN};
      // the span's heights (the fusee's lowest groove to the drum's hook plane, a chain plate's half-width and a margin
      // either side) and the coupling band landing 0 (c) measured clear of the chain (z 2.93–4.26)
      window.__roomGrid = { bands: [[I.FUSEE_Z0 - ce - CM, I.COIL_TOP + ce + CM], [2.93 - CM, ${FLANGE_TOP} + CM], [${DRUM_TOP} - CM, ${DRUM_TOP + RAISE} + CM]] };
      return ${ROOM_EXPR}; })(),
      // the fitted case's own inputs: each unit's plan hull (FORM_REGIONS), the centre, the flat ends and the area cut
      fit: (() => { const c = window.__clock, F = c.formFootprint;
        return { units: Object.fromEntries(Object.entries(c.regions.units).map(([k, v]) => [k, v.hull])), metal: F.metal,
          centre: F.fitted.centre, flatMin: F.fitted.flatMin, fitAreaMm2: F.fitAreaMm2, rect: F.rect }; })() })`)]);
  for (const [q, r] of [['(default)', ref], [TARGET, tgt]])
    if (r.unknownKeys?.length || r.bootError || !r.extra) { console.log(`FAIL boot ${q}: ${r.bootError ?? 'unknown keys ' + r.unknownKeys}`); process.exit(1); }
  boots = { ref: ref.extra.ref, room: tgt.extra.room, fit: tgt.extra.fit };
  if (cache) writeFileSync(cache, JSON.stringify(boots));
}
const { fw } = boots.ref, c = boots.ref.section.c, room = boots.room, Rr = room.reach;
const discCap = room.free.withDrumA.discs[0].r;
const { pick } = pickPulleyBarrel({ fw, k0: boots.ref.k, c, discCap });
const X = pulleyBarrel({ ...PULLEY_BARREL, fw, c, cB: pick.cB });
const f = (x, d = 2) => (+x).toFixed(d);
console.log(`target ${TARGET}: PULLEY_BARREL zA ${X.zA} zB ${X.zB} NB ${X.NB}: pulley R ${f(X.RA, 3)} (flange pitch ${f(X.rpA, 3)}), barrel R ${f(X.RB, 3)}, module ${f(X.m, 4)}, centres ${f(X.centreDistance, 3)} apart`);

// the fields: the drum's whole band, the span's heights, the flange's band (all with the drum group removed)
const mk = (G) => (x, y) => { const i = Math.round((x - G.bx0) / G.res), j = Math.round((y - G.by0) / G.res);
  return i < 0 || j < 0 || i >= G.nx || j >= G.ny ? -Infinity : G.r[j * G.nx + i]; };
const F0 = mk(room.free.withoutDrumGroup.grid), F1 = mk(room.free.bands[0].grid), F2 = mk(room.free.bands[1].grid), F3 = mk(room.free.bands[2].grid);
if (!(room.depth.drumZ[1] <= DRUM_TOP)) { console.log(`FAIL: the drum's top ${room.depth.drumZ[1]} stands above DRUM_TOP ${DRUM_TOP}`); process.exit(1); }
const fus = Rr.fuseeCentre, RL = fw.fuseeRLarge, ce = fw.chainEndROut, CM = CLEAR_MARGIN;
const dA = RL + X.RA + DRUM_GAP_U, rAt = X.rpA + X.m, rCoil = X.RA + 2 * ce;
const azOf = (v) => ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360;
console.log(`fields: whole band z ${f(room.free.zBand[0])}–${f(room.free.zBand[1])}, span z ${room.free.bands[0].z.map((z) => f(z)).join('–')}, flange z ${room.free.bands[1].z.map((z) => f(z)).join('–')}`);
// the chain's span, either open-belt tangent from the cone's largest wrap (R_LARGE) to the pulley's wrap (R_A + c_end):
// which one the chain takes is the sense's, so a seat is reported with the sides it leaves clear
const tangents = (A) => { const r1 = RL, r2 = X.RA + ce, dx = A.x - fus[0], dy = A.y - fus[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, a = Math.acos((r1 - r2) / L);
  return [1, -1].map((sg) => { const cs = Math.cos(sg * a), sn = Math.sin(sg * a), nx = ux * cs - uy * sn, ny = uy * cs + ux * sn;
    return [{ x: fus[0] + nx * r1, y: fus[1] + ny * r1 }, { x: A.x + nx * r2, y: A.y + ny * r2 }]; }); };
const segD = (px, py, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy, t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L2));
  return Math.hypot(px - a.x - t * vx, py - a.y - t * vy); };
// the span's own clearance in the span's heights, read off the field away from the cone and the coil it joins
const spanClear = ([p, q], A) => { let w = Infinity; const L = Math.hypot(q.x - p.x, q.y - p.y);
  for (let s = 0; s <= L; s += 0.2) { const x = p.x + ((q.x - p.x) * s) / L, y = p.y + ((q.y - p.y) * s) / L;
    if (Math.hypot(x - fus[0], y - fus[1]) < RL + 2 * ce + CM || Math.hypot(x - A.x, y - A.y) < rCoil + CM) continue;
    w = Math.min(w, F1(x, y) - ce); }
  return w; };

// the boxes
const rest = Rr.rest, drum = Rr.drumGroup;
const box0 = { x0: Math.min(rest.x0, drum.x0), x1: Math.max(rest.x1, drum.x1), y0: Math.min(rest.y0, drum.y0), y1: Math.max(rest.y1, drum.y1) };
const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
const withC = (b, x, y, r) => ({ x0: Math.min(b.x0, x - r), x1: Math.max(b.x1, x + r), y0: Math.min(b.y0, y - r), y1: Math.max(b.y1, y + r) });
console.log(`today's box (rest + drum group): x ${f(box0.x0)}…${f(box0.x1)}, y ${f(box0.y0)}…${f(box0.y1)}, area ${f(area(box0), 1)}; the rest alone y1 ${f(rest.y1)}; today's drum at ${f(azOf(Rr.drumDir), 1)}° round the fusee`);
const seats = [];
for (let aA = 0; aA < 360; aA += 0.5) {
  const t = (aA * Math.PI) / 180, A = { x: fus[0] + dA * Math.cos(t), y: fus[1] + dA * Math.sin(t) };
  const mA = Math.min(F2(A.x, A.y) - rAt, F1(A.x, A.y) - rCoil);
  if (mA < 0) continue;
  const T = tangents(A), sc = T.map((g) => spanClear(g, A));
  for (let k = 0; k < 1440; k++) {
    const ph = ((k / 4) * Math.PI) / 180, B = { x: A.x + X.centreDistance * Math.cos(ph), y: A.y + X.centreDistance * Math.sin(ph) };
    const mB = Math.min(F0(B.x, B.y) - X.RB, F2(B.x, B.y) - (X.RB + X.m));
    if (mB < 0) continue;
    const sides = [0, 1].filter((i) => sc[i] >= 0 && segD(B.x, B.y, ...T[i]) - ce - X.RB >= CM);
    if (sides.length < 2) continue;   // a seat whichever side the chain runs
    const b = withC(withC(withC(rest, A.x, A.y, rAt), fus[0], fus[1], RL + ce), B.x, B.y, X.RB + X.m);
    seats.push({ aA, aB: k / 4, A, B, margin: Math.min(mA, mB, ...sc), box: b, area: area(b) });
  }
}
if (!seats.length) { console.log('no seat: no pulley azimuth with a barrel on its mesh circle clears the fields and both sides of the span'); process.exit(0); }
const aAs = [...new Set(seats.map((s) => s.aA))].sort((p, q) => p - q), arcs = [];
for (const d of aAs) { const a = arcs.at(-1); if (a && Math.abs(d - a[1] - 0.5) < 1e-9) a[1] = d; else arcs.push([d, d]); }
console.log(`seats: ${seats.length}, the pulley at ${arcs.map(([a, b]) => `${a}°–${b}°`).join(', ')} round the fusee`);
const show = (tag, s) => { const b = s.box;
  console.log(`  ${tag}: pulley ${s.aA}° (${f(s.A.x)}, ${f(s.A.y)}), barrel ${s.aB}° off it (${f(s.B.x)}, ${f(s.B.y)}), least margin ${f(s.margin, 2)}; box x ${f(b.x0)}…${f(b.x1)}, y ${f(b.y0)}…${f(b.y1)}: ${['x0', 'x1', 'y0', 'y1'].map((kk) => `${kk} ${f(kk.endsWith('0') ? b[kk] - box0[kk] : box0[kk] - b[kk])}`).join(', ')} back, area ${f((1 - s.area / area(box0)) * 100, 1)}% less`); };
show('smallest box', [...seats].sort((p, q) => p.area - q.area || q.margin - p.margin)[0]);
// THE CASE, not the box: the fitted case is solved about the hands (layout.js fitFittedCase, the build's own fit) from
// the counted metal's hull, which the build publishes per unit (__clock.regions). Control: every unit's hull re-fitted
// must read the area the build cut. Then the same fit with the drum group out, and with the pulley and the barrel in.
{
  const FT = boots.fit, mm2 = UNIT_MM * UNIT_MM, DRUM = ['Mainspring drum', 'Chain', 'Set-up work'];
  const fitArea = (pts) => { const h = convexHull2(Float64Array.from(pts, (q) => q[0]), Float64Array.from(pts, (q) => q[1]), pts.length);
    const xs = h.map((q) => q[0]), ys = h.map((q) => q[1]);
    const fit = fitFittedCase(h, [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], { margin: PLATE_RIM_MARGIN, centre: FT.centre, flatMin: FT.flatMin });
    return { area: shapeArea(fit.shape) * mm2, b: fit.shape.bounds, shape: fit.shape }; };
  const circ = (x, y, r, n = 64) => Array.from({ length: n }, (_, i) => [x + (r / Math.cos(Math.PI / n)) * Math.cos((2 * Math.PI * i) / n), y + (r / Math.cos(Math.PI / n)) * Math.sin((2 * Math.PI * i) / n)]);
  const all = Object.values(FT.units).flat(), rest = Object.entries(FT.units).filter(([k]) => !DRUM.includes(k)).flatMap(([, v]) => v);
  const A0 = fitArea(all), A1 = fitArea(rest);
  const best = [...seats].sort((p, q) => p.area - q.area || q.margin - p.margin)[0];
  const A2 = fitArea([...rest, ...circ(best.A.x, best.A.y, rAt), ...circ(best.B.x, best.B.y, X.RB + X.m)]);
  const bx = (r) => `x ${f(r.b.xMin)}…${f(r.b.xMax)}, y ${f(r.b.yMin)}…${f(r.b.yMax)}`;
  console.log(`THE FITTED CASE (fitFittedCase about the hands): the build cut ${f(FT.fitAreaMm2)} mm²; every unit re-fitted ${f(A0.area)} mm² (${Math.abs(A0.area / FT.fitAreaMm2 - 1) < 1e-5 ? 'reproduces it' : 'DOES NOT reproduce it'}), ${bx(A0)}`);
  console.log(`  the drum group out: ${f(A1.area)} mm², ${bx(A1)} — ${Math.abs(A1.area - A0.area) < 1e-3 ? 'the drum does not set the case' : `${f(A0.area - A1.area)} mm² back`}`);
  console.log(`  the pulley and barrel at the best box's seat: ${f(A2.area)} mm², ${bx(A2)} — ${f(((A2.area / A0.area) - 1) * 100, 1)}% against today`);
  // the seat scored BY THE CASE: every seat on a 2° grid of both azimuths (a subsample: the fit is a solve per seat),
  // the least case area, ties to the widest margin. The box above is not the case's ranking; this is.
  const scored = seats.filter((s) => Math.abs(s.aA / 2 - Math.round(s.aA / 2)) < 1e-9 && Math.abs(s.aB / 2 - Math.round(s.aB / 2)) < 1e-9)
    .map((s) => ({ s, fit: fitArea([...rest, ...circ(s.A.x, s.A.y, rAt), ...circ(s.B.x, s.B.y, X.RB + X.m)]) }))
    .sort((p, q) => p.fit.area - q.fit.area || q.s.margin - p.s.margin);
  console.log(`  scored by the case (${scored.length} seats on the 2° grid):`);
  for (const { s, fit } of scored.slice(0, 5)) console.log(`    ${f(fit.area)} mm² (${f(((fit.area / A0.area) - 1) * 100, 1)}%), ${bx(fit)}: pulley ${s.aA}°, barrel ${s.aB}° off it, least margin ${f(s.margin, 3)}`);
  // the BOUND: the same fit with A anywhere on its ring round the fusee and B anywhere on its mesh circle, the fields
  // ignored (every other part could be re-sited, P3's position space). If even this does not beat today, no seat can.
  // THE BOUND, with every other part free to move (P3's position space, the fields ignored): A anywhere on its ring
  // round the fusee, B anywhere on its mesh circle, every 1°. A fit is a solve (about ten seconds), so the screen is
  // TODAY'S CASE itself: a seat whose two circles stand inside today's outline at the rim margin can only fit a case
  // no larger, so the least room any seat finds there says whether one can give area back. The six roomiest are fitted.
  const fitR = (a, r) => { const sh = a.shape; let w = Infinity; for (const [x, y] of r) w = Math.min(w, sh.inset(x, y)); return w - PLATE_RIM_MARGIN; };
  const pts = (aA, aB) => { const t = (aA * Math.PI) / 180, ph = (aB * Math.PI) / 180, A = [fus[0] + dA * Math.cos(t), fus[1] + dA * Math.sin(t)];
    const B = [A[0] + X.centreDistance * Math.cos(ph), A[1] + X.centreDistance * Math.sin(ph)];
    return [...circ(A[0], A[1], rAt, 24), ...circ(B[0], B[1], X.RB + X.m, 48)]; };
  const room = [];
  for (let aA = 0; aA < 360; aA++) for (let aB = 0; aB < 360; aB++) room.push({ aA, aB, w: fitR(A0, pts(aA, aB)) });
  room.sort((p, q) => q.w - p.w);
  console.log(`  the bound (no field: A anywhere on its ring, B anywhere on its circle, 1°): the roomiest seat stands ${f(room[0].w, 3)} ${room[0].w >= 0 ? 'inside' : 'OUTSIDE'} today's outline at the rim margin (pulley ${room[0].aA}°, barrel ${room[0].aB}° off it)`);
  const near = []; for (const r of room) { if (near.every((q) => Math.hypot(q.aA - r.aA, q.aB - r.aB) > 20)) near.push(r); if (near.length === 6) break; }
  for (const r of near) { const t = (r.aA * Math.PI) / 180, A = [fus[0] + dA * Math.cos(t), fus[1] + dA * Math.sin(t)], ph = (r.aB * Math.PI) / 180;
    const ft = fitArea([...rest, ...circ(A[0], A[1], rAt), ...circ(A[0] + X.centreDistance * Math.cos(ph), A[1] + X.centreDistance * Math.sin(ph), X.RB + X.m)]);
    console.log(`    pulley ${r.aA}°, barrel ${r.aB}° off it: room ${f(r.w, 3)}, fitted ${f(ft.area)} mm² (${f(((ft.area / A0.area) - 1) * 100, 1)}%), ${bx(ft)}`); }
  // HOW SMALL WOULD B HAVE TO BE? Over the same rings (A at 1°, B at 1°, the fields kept, the span ignored), the largest
  // barrel radius whose tooth tips clear the fields AND stand inside an outline at the rim margin: today's (a case no
  // larger) and the drum-out one (all of the drum's area back). The barrel's spring scales with its plan, so this is
  // the radius the energy would have to be found in.
  for (const [tag, O, raised] of [["today's outline", A0, false], ['the drum-out outline', A1, false], [`the drum-out outline, B raised ${RAISE}`, A1, true]]) {
    let bestR = -Infinity, at0 = null;
    for (let aA = 0; aA < 360; aA++) { const t = (aA * Math.PI) / 180, A = [fus[0] + dA * Math.cos(t), fus[1] + dA * Math.sin(t)];
      if (Math.min(F2(A[0], A[1]) - rAt, F1(A[0], A[1]) - rCoil) < 0 || fitR(O, circ(A[0], A[1], rAt, 24)) < 0) continue;
      // the span, both sides (a seat whichever way the chain runs), clear in its own heights
      const T = tangents({ x: A[0], y: A[1] }), sides = [0, 1];
      if (sides.some((i) => !(spanClear(T[i], { x: A[0], y: A[1] }) >= 0))) continue;
      for (let aB = 0; aB < 360; aB++) { const ph = (aB * Math.PI) / 180;
        // B's centre moves with its radius on the mesh: centres r_pA + R_B apart, the module held
        const rB = (R) => [A[0] + (X.rpA + R) * Math.cos(ph), A[1] + (X.rpA + R) * Math.sin(ph)];
        let lo = 0, hi = X.RB * 1.5;
        const okR = (R) => { const B = rB(R); return F0(B[0], B[1]) >= R && F2(B[0], B[1]) >= R + X.m && (!raised || F3(B[0], B[1]) >= R)
          && fitR(O, circ(B[0], B[1], R + X.m, 48)) >= 0
          && sides.every((i) => segD(B[0], B[1], ...T[i]) - ce - R >= CM); };
        if (!okR(lo + 0.5)) continue;
        for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (okR(mid)) lo = mid; else hi = mid; }
        if (lo > bestR) { bestR = lo; at0 = { aA, aB }; } } }
    console.log(`  the largest barrel inside ${tag} with the fields kept: R ${at0 ? f(bestR, 3) : 'none'} against the pick's ${f(X.RB, 3)}${at0 ? ` (pulley ${at0.aA}°, barrel ${at0.aB}° off it, the span clear both sides; plan ${f((bestR / X.RB) * (bestR / X.RB) * 100, 0)}% of the pick's)` : ''}`);
  }
  const decl = scored.find(({ s }) => s.aA === PULLEY_BARREL.pulleyAzDeg && s.aB === PULLEY_BARREL.barrelAzDeg);
  console.log(`  the declared seat (pulley ${PULLEY_BARREL.pulleyAzDeg}°, barrel ${PULLEY_BARREL.barrelAzDeg}°): ${decl ? `${f(decl.fit.area)} mm²` : 'not on the 2° grid or not a seat'}`);
}
process.exit(0);
