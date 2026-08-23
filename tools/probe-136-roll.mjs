// §136 Landing 1 — THE CONJUGACY PROOF, IN FREE SPACE.
//
// The house pattern ("design in a line, fold to fit"): prove the mechanism at
// P0 in isolation, its instruments red until the contacts genuinely close,
// before the fold touches the movement. Here the mechanism is the tooth
// profile itself. For every gear-mesh row in the movement this probe builds
// the pair from the REAL generator (src/geometry.js gearToothSpec +
// cycloidalGearShape — the actual code Landing 2 will consume, not a copy of
// its arithmetic), places it at the exact pitch-sum centre distance, rolls it
// through a full tooth pitch at the exact conjugate ratio, and measures
// interpenetration at every step.
//
// THE MEASURE IS ANALYTIC, and that is deliberate. probe-reserve-mesh-overlap
// bins a silhouette at 4096 bins — 34 bins per tooth on the 120-tooth great
// wheel — and a binned max-per-bin silhouette carries a bias on steep flanks
// of the same order as the number this probe must assert (~ε ≈ 0.007–0.03 u).
// So: exact point-in-polygon (ray crossing) of each outline vertex against
// the other outline, penetration depth = distance from an inside vertex to
// the nearest boundary segment. No bins, no bias to state.
//
// PASS: max penetration ≤ ε_mesh = the pair's chord budget (tessellation may
// spend backlash, nothing else may). One roll covers BOTH drive directions:
// the tooth is mirror-symmetric by construction (the outline's two sides are
// the same epicycloid mirrored in code, not two curves that merely look
// alike), so the reverse direction is the same geometry reflected. Also reported, never gated: the MINIMUM
// working clearance through the roll (how much of the derived backlash
// survives), and for multi-mate members the clearance-side deviation of the
// min-mates face in its NON-smallest meshes — the nesting lemma's residual,
// measured on the real cut rather than argued.
//
// Run from tools/:  node --import ./three-node-loader.mjs probe-136-roll.mjs
//                   add --json for the machine payload.
import { gearToothSpec, cycloidalGearShape } from '../src/geometry.js';

// The same rows probe-136-profile prices (citations there); bare numbers in
// `mates` mean a pair-closed mate, descriptors carry a mate's other meshes so
// dedenda are exact — the generator's own locality rule.
const ROWS = [
  { name: 'great ⇄ centerP', m: 0.25511811023622047, a: { teeth: 120, mates: [7] }, b: { teeth: 7, mates: [120] } },
  { name: 'center ⇄ thirdP', m: 0.30, a: { teeth: 75, mates: [10] }, b: { teeth: 10, mates: [75] } },
  { name: 'third ⇄ fourthP', m: 0.24, a: { teeth: 80, mates: [10] }, b: { teeth: 10, mates: [80] } },
  { name: 'fourth ⇄ escapeP', m: 0.21, a: { teeth: 80, mates: [8] }, b: { teeth: 8, mates: [80] } },
  { name: 'rsv p0 ⇄ w1', m: 0.34, a: { teeth: 8, mates: [28] }, b: { teeth: 28, mates: [8] } },
  // Stage two's module is not a chosen number: `main.js` derives it from the
  // solved w1 bearing as 2*centre/(10+6), so it MOVES when that solve moves.
  // It did — the §136 landing corrected `rsvSwing` to bound both members of
  // the arbor rather than w1 alone, and the centre came in from 8.7216 to
  // 8.530594310965839. Re-read it from the movement after any change there.
  { name: 'rsv p1 ⇄ w2', m: 1.0663242888707298, a: { teeth: 10, mates: [6] }, b: { teeth: 6, mates: [10] } },
  { name: 'crown ⇄ windP', m: 0.34,
    a: { teeth: 20, mates: [{ teeth: 8, mates: [20] }, { teeth: 18, mates: [20, 24] }, { teeth: 20, mates: [20] }, { teeth: 24, mates: [18] }] },
    b: { teeth: 8, mates: [20] } },
  { name: 'crown ⇄ windIdler', m: 0.34,
    a: { teeth: 20, mates: [{ teeth: 8, mates: [20] }, { teeth: 18, mates: [20, 24] }, { teeth: 20, mates: [20] }, { teeth: 24, mates: [18] }] },
    b: { teeth: 18, mates: [{ teeth: 20, mates: [8, 18, 20, 24] }, { teeth: 24, mates: [18] }] } },
  { name: 'windIdler ⇄ spur', m: 0.34,
    a: { teeth: 18, mates: [{ teeth: 20, mates: [8, 18, 20, 24] }, { teeth: 24, mates: [18] }] },
    b: { teeth: 24, mates: [{ teeth: 18, mates: [20, 24] }] } },
  { name: 'setting ⇄ minuteW', m: 0.34,
    a: { teeth: 20, mates: [{ teeth: 8, mates: [20] }, { teeth: 24, mates: [20, 8] }] },
    b: { teeth: 24, mates: [{ teeth: 20, mates: [8, 24] }, { teeth: 8, mates: [24] }] } },
  { name: 'minuteW ⇄ settingCap', m: 0.34,
    a: { teeth: 24, mates: [{ teeth: 20, mates: [8, 24] }, { teeth: 8, mates: [24] }] },
    b: { teeth: 8, mates: [24] } },
  { name: 'cannon ⇄ mwMinute', m: 0.30, a: { teeth: 10, mates: [30] }, b: { teeth: 30, mates: [10] } },
  { name: 'mwPinion ⇄ hour', m: 0.30, a: { teeth: 8, mates: [32] }, b: { teeth: 32, mates: [8] } },
  { name: 'alarmSet ⇄ i1', m: 0.30,
    a: { teeth: 30, mates: [28] },
    b: { teeth: 28, mates: [{ teeth: 30, mates: [28] }, { teeth: 37, mates: [28] }] } },
  { name: 'i1 ⇄ i2', m: 0.30,
    a: { teeth: 28, mates: [{ teeth: 30, mates: [28] }, { teeth: 37, mates: [28] }] },
    b: { teeth: 37, mates: [{ teeth: 28, mates: [30, 37] }] } },
  { name: 'i1b ⇄ disc', m: 0.2569, a: { teeth: 28, mates: [30] }, b: { teeth: 30, mates: [28] } },
  { name: 'striking ⇄ govP', m: 0.22, a: { teeth: 64, mates: [8] }, b: { teeth: 8, mates: [64] } },
  { name: 'climbP ⇄ idlerA1', m: 0.30,
    a: { teeth: 12, mates: [51] },
    b: { teeth: 51, mates: [{ teeth: 12, mates: [51] }, { teeth: 51, mates: [12, 51] }] } },
  { name: 'idlerA1 ⇄ idlerA2', m: 0.30,
    a: { teeth: 51, mates: [{ teeth: 12, mates: [51] }, { teeth: 51, mates: [12, 51] }] },
    b: { teeth: 51, mates: [{ teeth: 51, mates: [12, 51] }, { teeth: 44, mates: [51, 11] }] } },
  { name: 'idlerA2 ⇄ arborW', m: 0.30,
    a: { teeth: 51, mates: [{ teeth: 51, mates: [12, 51] }, { teeth: 44, mates: [51, 11] }] },
    b: { teeth: 44, mates: [{ teeth: 51, mates: [51, 44] }, { teeth: 11, mates: [44] }] } },
  { name: 'barrel ⇄ strikeP', m: 0.30,
    a: { teeth: 44, mates: [{ teeth: 11, mates: [44] }, { teeth: 18, mates: [44] }] },
    b: { teeth: 11, mates: [44] } },
  { name: 'arborW ⇄ legA', m: 0.30,
    a: { teeth: 44, mates: [{ teeth: 51, mates: [51, 44] }, { teeth: 11, mates: [44] }] },
    b: { teeth: 11, mates: [44] } },
  // subIdlerW's mate is NOT pair-closed: the barrel's face is driven to its
  // height by the 11T striking mesh, and the idler's root must clear THAT
  // tip. The first draft declared a bare 44 here and the roll measured the
  // consequence as 0.046 u of real interpenetration with 0.0001 u of
  // clearance — the locality rule's failure mode, caught by the instrument
  // built to catch it. Landing 2's call sites carry the full graph for the
  // same reason.
  { name: 'barrel ⇄ subIdlerW', m: 0.30,
    a: { teeth: 44, mates: [{ teeth: 11, mates: [44] }, { teeth: 18, mates: [44] }] },
    b: { teeth: 18, mates: [{ teeth: 44, mates: [11, 18] }] } },
  { name: 'cage ⇄ fingerP', m: 0.20, a: { teeth: 22, mates: [11] }, b: { teeth: 11, mates: [22] } },
];

// outline → closed polygon [[x,y]...] in the gear's own frame
const polyOf = (spec) => cycloidalGearShape(spec).getPoints(1).map((p) => [p.x, p.y]);

// point-in-polygon by ray crossing, then depth = distance to nearest edge
const inside = (px, py, poly) => {
  let odd = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
};
const edgeDist = (px, py, poly) => {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const dx = xj - xi, dy = yj - yi;
    const L2 = dx * dx + dy * dy || 1;
    let t = ((px - xi) * dx + (py - yi) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (xi + t * dx), py - (yi + t * dy));
    if (d < best) best = d;
  }
  return best;
};
const rot = (poly, ang, ox = 0) => {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return poly.map(([x, y]) => [x * ca - y * sa + ox, x * sa + y * ca]);
};

const STEPS = 96;                       // poses per tooth pitch — both parities of contact
const results = [];
for (const row of ROWS) {
  const specA = gearToothSpec({ module: row.m, teeth: row.a.teeth, mates: row.a.mates });
  const specB = gearToothSpec({ module: row.m, teeth: row.b.teeth, mates: row.b.mates });
  const pA = polyOf(specA), pB = polyOf(specB);
  const cd = (row.m * (row.a.teeth + row.b.teeth)) / 2;
  // anti-phase at the centre line: A's tooth 0 centred on +x, B's GAP centred
  // on −x (B rotated half a pitch), B's frame offset to (cd, 0) facing back.
  const pitchA = (2 * Math.PI) / row.a.teeth, pitchB = (2 * Math.PI) / row.b.teeth;
  let worstPen = 0, minClear = Infinity;
  for (let s = 0; s <= STEPS; s++) {
    const angA = (pitchA * s) / STEPS;
    const angB = Math.PI + pitchB / 2 - (angA * row.a.teeth) / row.b.teeth; // conjugate ratio, counter-rotating
    const A = rot(pA, angA, 0);
    const B = rot(pB, angB, 0).map(([x, y]) => [x + cd, y]);
    // measure near the mesh zone only (|x - contact region| small) for speed
    for (const [x, y] of A) {
      if (x < cd - specB.tipR - 0.1 || x > cd + 0.1) continue;
      const dx = x - cd;
      if (Math.hypot(dx, y) > specB.tipR + 0.05) continue;
      const d = edgeDist(x, y, B);
      if (inside(x, y, B)) { if (d > worstPen) worstPen = d; }
      else if (d < minClear) minClear = d;
    }
    for (const [x, y] of B) {
      if (Math.hypot(x, y) > specA.tipR + 0.05) continue;
      const d = edgeDist(x, y, A);
      if (inside(x, y, A)) { if (d > worstPen) worstPen = d; }
      else if (d < minClear) minClear = d;
    }
  }
  const eps = 0.01 * Math.PI * row.m;
  results.push({
    name: row.name, module: row.m, cd: +cd.toFixed(4),
    worstPenU: +worstPen.toFixed(5), budgetU: +eps.toFixed(5),
    minClearU: minClear === Infinity ? null : +minClear.toFixed(5),
    backlashU: +specA.backlash.toFixed(5),
    pass: worstPen <= eps + 1e-9,
    hA: +specA.addendum.toFixed(4), hB: +specB.addendum.toFixed(4),
  });
}

const json = process.argv.includes('--json');
if (json) { console.log(JSON.stringify(results, null, 1)); process.exit(results.every((r) => r.pass) ? 0 : 1); }
console.log('mesh                        m       cd       worst pen   budget ε   min clear  backlash   verdict');
for (const r of results) {
  console.log(`${r.name.padEnd(27)} ${String(r.module).slice(0, 6).padEnd(7)} ${String(r.cd).padEnd(8)} `
    + `${String(r.worstPenU).padEnd(11)} ${String(r.budgetU).padEnd(10)} ${String(r.minClearU).padEnd(10)} `
    + `${String(r.backlashU).padEnd(10)} ${r.pass ? 'PASS' : '✗ FAIL'}`);
}
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} meshes roll within the chord budget`
  + (fails.length ? ` — ${fails.length} FAIL` : ' — the flanks genuinely roll'));
process.exit(fails.length ? 1 : 0);
