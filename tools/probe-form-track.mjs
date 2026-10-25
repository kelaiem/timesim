// DOES THE FORM DIAL'S RAILROAD TRACK FOLLOW THE CASE, AND CAN A RAIL BE BENT
// ROUND EVERY TURN OF IT? Acceptance (BUILT §311): exits non-zero on any
// failure. Pure Node — the law (geometry.js dialTrack) is read on layout.js's
// own shapes, no browser.
//
// On a form face (§307/§308) the chemin de fer was §307's round track on a
// rectangular ground. Since §311 it is the outline's own INWARD OFFSETS at the
// round face's two gauges (rim → outer rail, rim → inner rail), with a rect's
// and a tonneau's corner HELD at the case's own round rather than offset to a
// cusp, and sixty rungs on the hands' rays. Per build — the round circle as
// the control, then every fitted form case gong-seats.js lists, in the dial's
// frame — the probe holds:
//   G  GAUGE: along every ray the outer rail stands gOut and the inner gIn
//      inside the outline where the outline is a straight or a long arc
//      (the exact offset), and NEVER nearer than that anywhere (a held corner
//      stands farther, by construction); gOut and gIn are the round face's
//      own (radius·(1 − 2·DIAL_CANVAS_FILL_F·DIAL_RAIL_{OUT,IN}_F)).
//   S  SMOOTH: each drawn rail is a simple convex loop, and its radius of
//      curvature — the circumradius through each vertex and its neighbours,
//      which on an arc sampled at TRACK_SEGS chords IS the arc's radius — is
//      never under the floor: the outline's own corner round where it has one
//      (rect, tonneau: the track turns no tighter than the case), and
//      strictly positive on the cushion (no fold; its least radius reported).
//   R  RUNGS: sixty, one per 6° about the hands' axis, each ending ON both
//      rails (the shape's own crossing, re-read off the drawn loops within
//      their sagitta), and NO TWO CROSS — segment against segment over every
//      pair, which the radial law makes true and a square-to-rail sleeper
//      would not round a held corner.
//   H  HAND: the mid-rail's nearest approach (where the minute hand's tip
//      lands) is the shape's own signed distance to the axis, and every rung's
//      mid-point stands at least that far out (the tip never overshoots the
//      track).
//   W  WELLS' PREMISE: the inner rail stands outside the ROUND inner rail
//      everywhere (the solver bounds the wells by the round one; main.js
//      asserts the same at boot).
// Controls: C1 the law at a circle of the dial's radius reproduces the round
// face's rails (0.8648·R and 0.8004·R to 1e-9) and the round hand length — the
// form law REDUCES to the shipped print; C2 the exact offset with the hold
// REMOVED must fail S on the rect and the tonneau (a corner round under the
// floor), or the smoothness gate is reading nothing; C3 two rungs laid
// end-for-end across each other must count as a crossing, or the crossing
// test is reading nothing. (A sleeper square to the rails was measured too:
// at the case's 5 u corner with the track's 2.67 u gauge the inner ends only
// bunch, they do not cross — so that convention is refused for the hand's
// line, not for a crossing.)
//
// Run: node --import ./tools/three-node-loader.mjs tools/probe-form-track.mjs
import { caseShapeOf, loopConvexity, PLATE_RIM_MARGIN } from '../src/layout.js';
import { dialTrack, DIAL_CANVAS_FILL_F, DIAL_RAIL_OUT_F, DIAL_RAIL_IN_F } from '../src/geometry.js';
import { GONG_SEATS } from '../src/gong-seats.js';

const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };
const RADIUS = 41.51616090422663;   // the shipped dial's radius (= plateR; a scale, not a claim — every gauge below is a fraction of it)

// The builds, in the dial's frame: the fitted box mirrored through dialFace's
// Y-flip about the hands' axis, as main.js carries it (P.dial = (0, 0) there).
const builds = [{ name: 'round', shape: caseShapeOf('circle', { cx: 0, cy: 0, r: RADIUS }) }];
for (const [kind, modes] of Object.entries(GONG_SEATS)) {
  const [xMin, xMax, yMin, yMax] = modes.bar.formrect;
  builds.push({ name: kind, shape: caseShapeOf(kind, { xMin: -xMax, xMax: -xMin, yMin, yMax }) });
}

// The discrete radius of curvature at each vertex: the circumradius of the
// vertex and its two neighbours (Infinity on a straight), skipping a
// zero-length edge (a degenerate corner emits its centre twice).
function vertexRadii(loop) {
  const n = loop.length, out = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = loop[(i + n - 1) % n], [bx, by] = loop[i], [cx, cy] = loop[(i + 1) % n];
    const a = Math.hypot(bx - ax, by - ay), b = Math.hypot(cx - bx, cy - by), c = Math.hypot(cx - ax, cy - ay);
    if (a < 1e-12 || b < 1e-12) { out.push(0); continue; }
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    out.push(Math.abs(cross) < 1e-12 ? Infinity : (a * b * c) / (2 * Math.abs(cross)));
  }
  return out;
}
const segCross = (p, q, r, s) => {   // do segments p–q and r–s cross (proper or touching)? collinear to float noise reads 0
  const o = (a, b, c) => { const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return Math.abs(v) < 1e-9 ? 0 : Math.sign(v); };
  return o(p, q, r) !== o(p, q, s) && o(r, s, p) !== o(r, s, q);
};
const loopDist = (loop, x, y) => {   // unsigned distance from (x, y) to a closed polyline
  let d = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % loop.length], ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / L2)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * ex, y - ay - t * ey));
  }
  return d;
};

const gOutRef = RADIUS * (1 - 2 * DIAL_CANVAS_FILL_F * DIAL_RAIL_OUT_F);
const gInRef = RADIUS * (1 - 2 * DIAL_CANVAS_FILL_F * DIAL_RAIL_IN_F);
const roundInner = RADIUS * 2 * DIAL_CANVAS_FILL_F * DIAL_RAIL_IN_F;

for (const { name, shape } of builds) {
  console.log(`\n== ${name} (${shape.kind}, box ${shape.xMin.toFixed(2)}..${shape.xMax.toFixed(2)} × ${shape.yMin.toFixed(2)}..${shape.yMax.toFixed(2)}, accuracy ${shape.accuracy.toExponential(1)})`);
  const t = dialTrack(shape, RADIUS);
  const tol = shape.accuracy + 1e-9;
  // G — the gauges are the round face's, and the rails never come nearer the rim
  ok(`${name} G gauges`, Math.abs(t.gOut - gOutRef) < 1e-12 && Math.abs(t.gIn - gInRef) < 1e-12, `gOut ${t.gOut.toFixed(4)} gIn ${t.gIn.toFixed(4)}`);
  let minOut = Infinity, minIn = Infinity, exactOut = 0, exactIn = 0;
  for (const [x, y] of t.loops.outer) { const d = shape.inset(x, y); minOut = Math.min(minOut, d); if (Math.abs(d - t.gOut) <= tol + 1e-6) exactOut++; }
  for (const [x, y] of t.loops.inner) { const d = shape.inset(x, y); minIn = Math.min(minIn, d); if (Math.abs(d - t.gIn) <= tol + 1e-6) exactIn++; }
  ok(`${name} G never nearer the rim than the gauge`, minOut >= t.gOut - tol - 1e-6 && minIn >= t.gIn - tol - 1e-6,
    `outer min inset ${minOut.toFixed(4)} (gauge ${t.gOut.toFixed(4)}), inner ${minIn.toFixed(4)} (${t.gIn.toFixed(4)})`);
  // on the shape's own axes (rays through ITS centre — the fitted box is not
  // centred on the hands' axis) the outline is a straight or the apex of an
  // arc, the normal along the ray: the offset reads exactly g there
  const axisExact = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].every((az) => {
    const off = -shape.cx * Math.sin(az) + shape.cy * Math.cos(az);   // the base that puts the ray's line through (cx, cy)
    const o = t.outer.exit(az, off), i = t.inner.exit(az, off), s = shape.exit(az, off);
    return Math.abs(s - o - t.gOut) < tol + 1e-6 && Math.abs(s - i - t.gIn) < tol + 1e-6;
  });
  ok(`${name} G exact offset on the shape's four axes`, axisExact, `${exactOut}/${t.loops.outer.length} outer and ${exactIn}/${t.loops.inner.length} inner vertices at the exact gauge`);
  // S — simple convex, and the tightest turn
  const floor = shape.cornerR !== null ? shape.cornerR : 0;
  for (const [which, loop] of [['outer', t.loops.outer], ['inner', t.loops.inner]]) {
    const cv = loopConvexity(loop);
    ok(`${name} S ${which} rail is a simple convex loop`, cv.ok, `worst turn ${cv.worst.toExponential(2)}, ${cv.turns.toFixed(6)} rev`);
    const rMin = Math.min(...vertexRadii(loop));
    const need = shape.cornerR !== null ? floor - 1e-6 : 1e-6;
    ok(`${name} S ${which} rail's tightest turn ≥ ${shape.cornerR !== null ? `the case's corner round ${floor}` : '0 (no fold)'}`, rMin >= need,
      `least radius of curvature ${Number.isFinite(rMin) ? rMin.toFixed(4) : '∞'} u`);
  }
  // R — the rungs
  ok(`${name} R sixty rungs on the hands' rays`, t.rungs.length === 60 && t.rungs.every((r, i) => Math.abs(r.az - (Math.PI / 2 - (i / 60) * 2 * Math.PI)) < 1e-12 && r.tOut > r.tIn && r.tIn > 0));
  let endOff = 0, drawnOff = 0;
  for (const r of t.rungs) {
    endOff = Math.max(endOff, Math.abs(t.inner.inset(r.tIn * Math.cos(r.az), r.tIn * Math.sin(r.az))), Math.abs(t.outer.inset(r.tOut * Math.cos(r.az), r.tOut * Math.sin(r.az))));
    drawnOff = Math.max(drawnOff, loopDist(t.loops.inner, r.tIn * Math.cos(r.az), r.tIn * Math.sin(r.az)), loopDist(t.loops.outer, r.tOut * Math.cos(r.az), r.tOut * Math.sin(r.az)));
  }
  // the drawn loops' own sagitta off their shapes (each edge's midpoint), the
  // most a rung's end can stand off the stroke that draws its rail
  let sag = 0;
  for (const [sh, loop] of [[t.outer, t.loops.outer], [t.inner, t.loops.inner]])
    for (let i = 0; i < loop.length; i++) { const [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % loop.length]; sag = Math.max(sag, Math.abs(sh.inset((ax + bx) / 2, (ay + by) / 2))); }
  ok(`${name} R every rung ends on both rails`, endOff <= tol && drawnOff <= sag + tol,
    `worst end ${endOff.toExponential(2)} off the rail's shape, ${drawnOff.toExponential(2)} off the drawn stroke (its sagitta ${sag.toExponential(2)}, ${(sag * 1024 / (2 * RADIUS)).toFixed(3)} px)`);
  const segs = t.rungs.map((r) => [[r.tIn * Math.cos(r.az), r.tIn * Math.sin(r.az)], [r.tOut * Math.cos(r.az), r.tOut * Math.sin(r.az)]]);
  let crossings = 0;
  for (let i = 0; i < 60; i++) for (let j = i + 1; j < 60; j++) if (segCross(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) crossings++;
  ok(`${name} R no two rungs cross`, crossings === 0, `${crossings} crossing pairs`);
  // H — the hand
  ok(`${name} H the hand's reach is the mid-rail's nearest approach`, Math.abs(t.nearestMid - t.mid.inset(0, 0)) < 1e-12
    && t.rungs.every((r) => (r.tIn + r.tOut) / 2 >= t.nearestMid - tol - 1e-6), `tip at ${t.nearestMid.toFixed(4)} u; rung mid-points ${Math.min(...t.rungs.map((r) => (r.tIn + r.tOut) / 2)).toFixed(4)}..${Math.max(...t.rungs.map((r) => (r.tIn + r.tOut) / 2)).toFixed(4)}`);
  // W — the wells' premise
  ok(`${name} W inner rail outside the round inner rail`, t.nearestInner >= roundInner - 1e-9, `nearest ${t.nearestInner.toFixed(4)} vs round ${roundInner.toFixed(4)}`);
  if (name === 'round') {
    // C1 — the law reduces to the shipped print
    const rOut = RADIUS * 2 * DIAL_CANVAS_FILL_F * DIAL_RAIL_OUT_F, rIn = roundInner, rMid = (rOut + rIn) / 2;
    const railsRound = t.loops.outer.every(([x, y]) => Math.abs(Math.hypot(x, y) - rOut) < 1e-9) && t.loops.inner.every(([x, y]) => Math.abs(Math.hypot(x, y) - rIn) < 1e-9);
    const rungsRound = t.rungs.every((r) => Math.abs(r.tIn - rIn) < 1e-9 && Math.abs(r.tOut - rOut) < 1e-9);
    ok('C1 at a circle the law IS the round print', railsRound && rungsRound && Math.abs(t.nearestMid - rMid) < 1e-9,
      `rails ${rOut.toFixed(4)} / ${rIn.toFixed(4)}, hand ${t.nearestMid.toFixed(4)} = ${rMid.toFixed(4)}`);
  }
  if (shape.cornerR !== null) {
    // C2 — the exact offset (hold removed) is a cusp: the smoothness gate must see it
    console.log('  (C2 — the §308 warn that follows, if any, is the control\'s un-held offset, not the build\'s)');
    const bare = shape.grown(-t.gIn);
    ok(`${name} C2 the un-held offset fails the smoothness floor`, bare.cornerR < floor - 1e-6, `corner round ${bare.cornerR.toFixed(3)} against the floor ${floor}`);
    // C3 — the crossing test reads: two neighbouring rungs laid end-for-end
    // across each other (inner₀ → outer₁, inner₁ → outer₀) must count once
    const x = [[segs[0][0], segs[1][1]], [segs[1][0], segs[0][1]]];
    ok(`${name} C3 the crossing test sees two rungs laid across each other`, segCross(x[0][0], x[0][1], x[1][0], x[1][1]));
  }
}

console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join('; ')}` : '\nall PASS');
process.exit(fails.length ? 1 : 0);
