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
//     box (the rest with the drum group), side by side: the width a re-fit could recover, an ESTIMATE (the fitted case is
//     solved round the hands, and the fold's re-fit is the measurement).
// Moving parts are read at rest, so a seat is a CANDIDATE for the fold's sweeps, not a placement.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMany } from './boot-pool.mjs';
import { EXPR as ROOM_EXPR } from './probe-twin-barrel-room.mjs';
import { pulleyBarrel, pickPulleyBarrel, DRUM_GAP_U } from '../src/twin-barrel.js';
import { PULLEY_BARREL, CLEAR_MARGIN } from '../src/layout.js';

const ci = process.argv.indexOf('--cache'), cache = ci >= 0 ? process.argv[ci + 1] : null;
const REF_EXPR = `(() => { const g = window.__clock.equalisation.going;
  return { k: g.k_Nm_per_rad, section: g.section, fw: window.__clock.fuseeWind }; })()`;
const TARGET = 'alarm=0&case=fitted';
const FLANGE_TOP = 4.26;   // landing 0 (c): the top of the band the chain never reaches on today's drum (the fold re-measures it on the pulley)
let boots;
if (cache && existsSync(cache)) boots = JSON.parse(readFileSync(cache, 'utf8'));
else {
  const [[ref], [tgt]] = await Promise.all([bootMany([''], `({ ref: ${REF_EXPR} })`),
    bootMany([TARGET], `({ room: (() => { const I = window.__clock.fuseeWind.inputs, ce = window.__clock.fuseeWind.chainEndROut, CM = ${CLEAR_MARGIN};
      // the span's heights (the fusee's lowest groove to the drum's hook plane, a chain plate's half-width and a margin
      // either side) and the coupling band landing 0 (c) measured clear of the chain (z 2.93–4.26)
      window.__roomGrid = { bands: [[I.FUSEE_Z0 - ce - CM, I.COIL_TOP + ce + CM], [2.93 - CM, ${FLANGE_TOP} + CM]] };
      return ${ROOM_EXPR}; })() })`)]);
  for (const [q, r] of [['(default)', ref], [TARGET, tgt]])
    if (r.unknownKeys?.length || r.bootError || !r.extra) { console.log(`FAIL boot ${q}: ${r.bootError ?? 'unknown keys ' + r.unknownKeys}`); process.exit(1); }
  boots = { ref: ref.extra.ref, room: tgt.extra.room };
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
const F0 = mk(room.free.withoutDrumGroup.grid), F1 = mk(room.free.bands[0].grid), F2 = mk(room.free.bands[1].grid);
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
show('widest margin', [...seats].sort((p, q) => q.margin - p.margin || p.area - q.area)[0]);
process.exit(0);
