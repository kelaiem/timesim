// THE GONG PLACEMENT SOLVER AND ITS WIRE MODEL (BUILT §310) — acceptance, pure Node.
//
// src/gong-solve.js is one copy of two things the build will lean on: the
// modes of a clamped-free wire of ANY planar centreline (in plane, §253's
// family generalised; out of plane, the flap-and-twist family §253 never had),
// and the solver that places a wire in a case's free space for a band of f1.
// This holds both, each against something it did not produce:
//
//   MODEL
//   1. a straight bar, in plane: the textbook cantilever roots 1.8751, 4.6941,
//      7.8548 (betaL), and its overtone's node at 0.7834 of the length
//   2. a straight bar, out of plane: the same bending roots AND the twist roots
//      (2n-1)(pi/2) sqrt(S/(2(1+nu))) — including the pair 0.0055 apart that a
//      coarse scan straddles and loses (the defect §310's record names)
//   3. a closed ring, both families: Love's free-ring frequencies, in plane
//      n^2(n^2-1)^2/(n^2+1) and out of plane n^2(n^2-1)^2/(n^2+1+nu), found as
//      the minima of |det(T(2 pi R) - I)| (a periodic mode is double, so its
//      determinant touches zero without crossing)
//   4. §253's arc table: at S = 4415, alpha = 55.8 deg, f1 x1.0194 and f2 x0.9055
//      of the straight bar's, f2/f1 5.57
//   5. today's gong: the shipped arc (aesthetics.gong.arcDeg at the built wire's
//      centreline radius) rings C7 within a cent
//   SOLVER, on a synthetic case (a rectangle, a central obstacle, two columns):
//   6. every result's wire stands wholly in free space and rings inside the band
//   7. the edge family finds a bar on every side; under a hammer reach it finds
//      exactly the bar whose strike sits on the perpendicular from the centre,
//      its face inside the reach window and its blow radial within the tolerance
//   8. the column family winds round a column with its foot on the keep-out ring
//   CONTROLS, each of which must FAIL the thing it controls:
//   9. a band no wire in the room can reach (60-90 Hz) returns no result
//  10. metal laid along the right side removes the right-side bar
//  11. a reach window that excludes the right side's face returns no edge bar there
//
// Run: node tools/probe-gong-solve.mjs   (pure Node, about a minute)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { modes, hz, sOf, transfer, shape, overtoneNode, solveGong, U_M, STRIKE_ALPHA_MAX, strikeDriveDb } from '../src/gong-solve.js';
import { STEEL_NU, UNIT_MM, CLEAR_MARGIN } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], pass = [];
const check = (ok, label, detail) => { (ok ? pass : fails).push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- 1. straight, in plane ----
const straight = [{ k: 0, ds: 1 }];
const gIn = modes(straight, 1e6, { nMax: 3 });
check(near(gIn[0], 1.8751, 1e-3) && near(gIn[1], 4.6941, 1e-3) && near(gIn[2], 7.8548, 1e-3), 'straight bar, in plane: the cantilever roots', gIn.map((g) => g.toFixed(4)).join(' '));
const node = overtoneNode(straight, 1e6);
check(near(node, 0.7834, 2e-3), "straight bar: the first overtone's node", `${node.toFixed(4)} of the length from the foot (textbook 0.7834)`);

// ---- 2. straight, out of plane, bending AND twist ----
const S4 = 4000, gT = (n) => Math.sqrt((2 * n - 1) * Math.PI / 2 * Math.sqrt(S4 / (2 * (1 + STEEL_NU))));
const gOut = modes(straight, S4, { nMax: 4, fam: 'out' });
const want2 = [1.8751, 4.6941, gT(1), 7.8548].sort((a, b) => a - b);
check(gOut.length === 4 && gOut.every((g, i) => near(g, want2[i], 2e-3)), 'straight bar, out of plane: bending and twist roots, the close pair resolved', `${gOut.map((g) => g.toFixed(4)).join(' ')} against ${want2.map((g) => g.toFixed(4)).join(' ')}`);
const coarse = modes(straight, S4, { nMax: 4, fam: 'out', step: 0.02 });
check(!coarse.some((g) => near(g, gT(1), 2e-3)), 'control: a 0.02 scan loses the twist root beside the third bending root', `coarse scan found ${coarse.map((g) => g.toFixed(4)).join(' ')}`);

// ---- 3. Love's ring, both families ----
const ring = [{ k: 2 * Math.PI, ds: 1 }], Sb = 1e7;
const detP = (Om, fam) => { const T = transfer(ring, Sb, Om, fam), A = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => T[i * 6 + j] - (i === j ? 1 : 0)));
  let d = 1; for (let c = 0; c < 6; c++) { let p = c; for (let r = c + 1; r < 6; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; if (!A[p][c]) return 0; if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; d = -d; } d *= A[c][c]; for (let r = c + 1; r < 6; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k < 6; k++) A[r][k] -= f * A[c][k]; } } return d; };
for (const fam of ['in', 'out']) {
  const got = [2, 3, 4].map((n) => { const w = (n * n * (n * n - 1) ** 2 / (n * n + 1 + (fam === 'out' ? STEEL_NU : 0))) * (2 * Math.PI) ** 4; let best = null;
    for (let x = 0.95; x <= 1.05; x += 0.0005) { const v = Math.abs(detP(w * x, fam)); if (!best || v < best.v) best = { x, v }; } return best.x; });
  check(got.every((x) => near(x, 1, 1e-3)), `Love's free ring, ${fam === 'in' ? 'in plane' : 'out of plane'}, n = 2, 3, 4`, `located / predicted ${got.map((x) => x.toFixed(4)).join(' ')}`);
}

// ---- 4. §253's arc table ----
const a = 55.8 * Math.PI / 180, SL = 4415 * a * a, arc = [{ k: a, ds: 1 }];
const ga = modes(arc, SL, { nMax: 2 }), gs = modes(straight, SL, { nMax: 2 });
const r1 = (ga[0] / gs[0]) ** 2, r2 = (ga[1] / gs[1]) ** 2, q = (ga[1] / ga[0]) ** 2;
check(near(r1, 1.0194, 5e-4) && near(r2, 0.9055, 5e-4) && near(q, 5.57, 0.01), "§253's arc table", `f1 x${r1.toFixed(4)} (1.0194), f2 x${r2.toFixed(4)} (0.9055), f2/f1 ${q.toFixed(3)} (5.57)`);

// ---- 5. today's gong rings C7 ----
// The arc is aesthetics.gong.arcDeg; its centreline radius is the built wire's, measured off the
// arc mesh (the mid of its 46.74-49.65 radial span on a round build); the wire is the 1.1 mm stock
// the build caps it at (GONG_STOCK_MM).
const aes = JSON.parse(readFileSync(join(ROOT, 'src/aesthetics.json'), 'utf8'));
const R_BUILT = 48.195, D_WIRE = 1.1e-3, arcDeg = aes.gong.arcDeg;
const Lg = arcDeg * Math.PI / 180 * R_BUILT * U_M, gg = modes([{ k: arcDeg * Math.PI / 180, ds: 1 }], sOf(Lg, D_WIRE), { nMax: 1 });
const f1 = hz(gg[0], Lg, D_WIRE), cents = 1200 * Math.log2(f1 / (440 * 2 ** (27 / 12)));
check(Math.abs(cents) < 1, "today's gong rings C7", `${f1.toFixed(2)} Hz at a ${arcDeg} deg arc, ${cents.toFixed(2)} cents from 2093.005 Hz`);

// ---- the synthetic case ----
const WIRE_R = 1.1 / UNIT_MM / 2, NEED = CLEAR_MARGIN + WIRE_R, RES = 0.25, X0 = -50, Y0 = -50, W = 400, H = 400;
const HALF = { x: 45, y: 42 };
const loop = []; const edge = (ax, ay, bx, by) => { for (let t = 0; t < 1; t += 0.02) loop.push([ax + (bx - ax) * t, ay + (by - ay) * t]); };
edge(-HALF.x, -HALF.y, HALF.x, -HALF.y); edge(HALF.x, -HALF.y, HALF.x, HALF.y); edge(HALF.x, HALF.y, -HALF.x, HALF.y); edge(-HALF.x, HALF.y, -HALF.x, -HALF.y);
const pillars = [{ x: -30, y: 25, r: 2.4 + NEED }, { x: -25, y: -25, r: 2.4 + NEED }];
const obstacles = [{ x: 0, y: 0, r: 26 }, ...pillars.map((p) => ({ x: p.x, y: p.y, r: 2.4 }))];
const mapWith = (extra = []) => { const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = X0 + (i + 0.5) * RES, y = Y0 + (j + 0.5) * RES;
    const inset = Math.min(HALF.x - Math.abs(x), HALF.y - Math.abs(y));
    let ok = inset >= NEED; for (const o of obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + NEED) ok = false;
    for (const b of extra) if (x >= b[0] - NEED && x <= b[1] + NEED && y >= b[2] - NEED && y <= b[3] + NEED) ok = false;
    free[j * W + i] = ok ? 1 : 0; }
  return { free, W, H, x0: X0, y0: Y0, RES, loop, pillars, need: NEED }; };
const MAP = mapWith();
const freeOf = (m, x, y) => { const i = Math.floor((x - m.x0) / m.RES), j = Math.floor((y - m.y0) / m.RES); return i >= 0 && j >= 0 && i < m.W && j < m.H && m.free[j * m.W + i] === 1; };
const BAND = { fLo: 1500, fHi: 3000 };
const base = { ...BAND, strike: 'node', rank: 'pitch', wireD_m: D_WIRE, wireR: WIRE_R };
// the right side's face under a reach: the bar's centreline one need (+0.1) inside the edge, the face a wire radius and the rest gap inboard of it
const GAP = 0.4, FACE_R = HALF.x - NEED - 0.1 - WIRE_R - GAP;
const REACH = { rFaceMin: FACE_R - 1.5, rFaceMax: FACE_R + 1.5, gap: GAP, tolDeg: 2 };

const t0 = Date.now();
const free1 = solveGong(MAP, { ...base, edge: true, column: true });
console.log(`      (edge + column, no reach: ${free1.results.length} results, ${Date.now() - t0} ms)`);
const inBand = (r) => r.f[0] >= BAND.fLo * 0.999 && r.f[0] <= BAND.fHi * 1.001;
check(free1.results.length > 0 && free1.results.every((r) => r.pts.every(([x, y]) => freeOf(MAP, x, y)) && inBand(r)), 'every result stands in free space and rings in the band',
  free1.results.map((r) => `${r.fam} ${r.f[0].toFixed(0)} Hz`).join(', '));
const sides = new Set(free1.results.filter((r) => r.fam === 'edge').map((r) => { const [x, y] = r.pts[Math.floor(r.pts.length / 2)]; return Math.abs(x) > Math.abs(y) * HALF.x / HALF.y ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'top' : 'bottom'); }));
check(sides.size === 4, 'the edge family finds a bar on every side', [...sides].join(', '));
const col = free1.results.filter((r) => r.fam === 'column');
check(col.length > 0 && col.every((r) => { const p = pillars[r.pillar], ft = r.pts[r.pts.length - 1]; return near(Math.hypot(ft[0] - p.x, ft[1] - p.y), p.r + 0.1, 0.3); }),
  "the column family's foot sits on its column's keep-out ring", col.map((r) => `P${r.pillar + 1} foot at ${(() => { const p = pillars[r.pillar], ft = r.pts[r.pts.length - 1]; return Math.hypot(ft[0] - p.x, ft[1] - p.y).toFixed(2); })()} (ring ${(pillars[col[0].pillar].r + 0.1).toFixed(2)})`).join(', '));

const reach1 = solveGong(MAP, { ...base, edge: true, reach: REACH });
const right = reach1.results.filter((r) => r.fam === 'edge');
// the window takes the two long sides' faces (x = ±FACE_R) and not the short sides' (y = ±(HALF.y - …), 3.55 u nearer);
// on a vertical side the perpendicular's foot is y = 0, so the face's azimuth is 0 or 180 deg
check(right.length > 0 && right.every((r) => r.hammer && r.hammer.rFace >= REACH.rFaceMin && r.hammer.rFace <= REACH.rFaceMax && Math.abs(Math.sin(r.hammer.azDeg * Math.PI / 180)) < 0.01 && inBand(r)),
  'under a reach, the edge bar strikes on the perpendicular from the centre', right.map((r) => `face r ${r.hammer.rFace.toFixed(2)} at ${r.hammer.azDeg.toFixed(2)} deg, f1 ${r.f[0].toFixed(0)} Hz, struck at ${r.hit.toFixed(3)}`).join('; '));

// ---- §319: the strike tolerance under the lifting lever ----
// A lever whose circle crosses the right bar's line (exact roots), then the same lever shrunk (11.0 against a nearest approach of 11.45) so the circle falls short of the line:
// no untilted strike exists, a blow tilted by a few degrees reaches it. The tolerance is only ever spent where the exact solve has nothing.
const LEV = { Q: { x: 30, y: 12 }, tanLen: 7.279256431577741, side: 1, gap: GAP, headR: 1.5, headH: 3, postR: 1.7, margin: 0.15, inboard: 0, outward: false };
const levOpts = (rho, extra = {}) => ({ ...base, strike: 'end', edge: true, lever: { ...LEV, rho }, ...extra });
const rightBars = (res) => res.results.filter((r) => r.fam === 'edge' && r.pts[0][0] > 0 && Math.abs(r.pts[0][1]) < HALF.y / 2);
const exactLev = solveGong(MAP, levOpts(12.8)), shortLev = solveGong(MAP, levOpts(11.0)), shortOff = solveGong(MAP, levOpts(11.0, { tol: false })), farLev = solveGong(MAP, levOpts(9.0));
check(rightBars(exactLev).length > 0 && rightBars(exactLev).every((r) => !r.alpha && !r.hammer.alpha), 'tolerance: a lever with an exact root keeps the untilted strike', rightBars(exactLev).map((r) => `alpha ${r.alpha ?? 0}`).join(', '));
const tilted = rightBars(shortLev);
check(tilted.length > 0 && tilted.every((r) => r.hammer.alpha && Math.abs(r.hammer.alpha) <= STRIKE_ALPHA_MAX + 1e-12 && inBand(r)), 'tolerance: a lever that falls short of the bar is reached with the blow tilted, inside the 0.5 dB budget',
  tilted.map((r) => `alpha ${(r.hammer.alpha * 180 / Math.PI).toFixed(1)} deg, ${strikeDriveDb(r.hammer.alpha).toFixed(3)} dB`).join('; '));
check(rightBars(shortOff).length === 0, 'control: the same lever with the tolerance off reaches no right-side bar', `${rightBars(shortOff).length} bars`);
check(rightBars(farLev).length === 0, 'control: a lever past the window (circle 3 u short) reaches no right-side bar either', `${rightBars(farLev).length} bars`);

// ---- controls ----
const lowBand = solveGong(MAP, { ...base, fLo: 60, fHi: 90, edge: true, column: true });
check(lowBand.results.length === 0, 'control: a band no wire in this room can reach returns nothing', `${lowBand.results.length} results`);
const blocked = solveGong(mapWith([[HALF.x - 6, HALF.x, -HALF.y, HALF.y]]), { ...base, edge: true, reach: REACH });
check(!blocked.results.some((r) => r.fam === 'edge' && r.pts.some(([x]) => x > HALF.x - 6)), 'control: metal along the right side removes the right-side bar', `${blocked.results.length} edge results with metal there`);
const farReach = solveGong(MAP, { ...base, edge: true, reach: { ...REACH, rFaceMin: FACE_R + 3, rFaceMax: FACE_R + 6 } });
check(!farReach.results.some((r) => r.fam === 'edge' && r.pts[0][0] > 0 && Math.abs(r.pts[0][1]) < HALF.y / 2), "control: a reach window off the right side's face returns no bar there", `${farReach.results.length} results`);

console.log(`\n${pass.length} PASS, ${fails.length} FAIL`);
process.exit(fails.length ? 1 : 0);
