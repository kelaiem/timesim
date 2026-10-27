// DOES THE FORM DIAL'S RAILROAD TRACK FOLLOW THE CASE AT ONE GAUGE, AND CAN A
// RAIL BE BENT ROUND EVERY TURN OF IT? Acceptance (BUILT §311): exits non-zero
// on any failure. Pure Node — the law (geometry.js dialTrack) is read on
// layout.js's own shapes, no browser.
//
// On a form face (§307/§308) the chemin de fer was §307's round track on a
// rectangular ground. Since §311 the INNER rail is the outline's inward offset
// at the round face's inner gauge, its corner held at the case's own round
// rather than offset to a cusp, and since §311 landing 2 the OUTER rail is the
// inner rail's exact parallel at the rail gap d = gIn − gOut, and each of the
// sixty rungs spans the rails' shortest distance through the point the hand's
// ray reads it at. Per build — the round circle as the control, then every
// fitted form case gong-seats.js lists, in the dial's frame — the probe holds:
//   G  GAUGE: on the shape's own axes (straights, or the apex of a long arc)
//      the outer rail stands gOut and the inner gIn inside the outline, the
//      round face's own (radius·(1 − 2·DIAL_CANVAS_FILL_F·DIAL_RAIL_{OUT,IN}_F)),
//      and no rail stands nearer the rim than its gauge anywhere.
//   E  ONE GAUGE: every vertex of each drawn rail stands exactly d from the
//      other rail's shape (to its accuracy) — the rails are parallel, corners
//      included.
//   S  SMOOTH: each drawn rail is a simple convex loop whose radius of
//      curvature (the circumradius through each vertex and its neighbours,
//      which on an arc sampled at TRACK_SEGS chords IS the arc's radius) is
//      never under the floor: the case's corner round on the inner rail, that
//      plus d on the outer (rect, tonneau: the track turns no tighter than the
//      case it follows); strictly positive on the cushion (no fold).
//   R  RUNGS: sixty, each from the inner rail to the outer, of length d (the
//      gauge), and as long as each end's distance to the OTHER rail (so the
//      rung is the shortest distance between the rails), read through a
//      point on the hand's ray at the mid-rail that lies on the rung, each end
//      within the drawn stroke's own sagitta, and no two rungs crossing.
//   H  HAND: the mid-rail's nearest approach (where the minute hand's tip
//      lands) is the shape's own signed distance to the axis, and no rung is
//      read nearer the axis than that.
//   W  WELLS' PREMISE: the inner rail stands outside the ROUND inner rail
//      everywhere (the solver bounds the wells by the round one; main.js
//      asserts the same at boot).
// Controls: C1 the law at a circle of the dial's radius reproduces the round
// face's rails (0.8648·R and 0.8004·R to 1e-9), the round rungs (radial, at
// the same radii) and the round hand length — the form law REDUCES to the
// shipped print; C2 the un-held offset fails the smoothness floor on the
// rect and the tonneau (a corner round under the floor), or the smoothness
// gate is reading nothing; C3 two rungs laid end-for-end across each other
// count as a crossing; C4 landing 1's rails (both offset from the rim, both
// corners held) must fail E at a held corner, or E is reading nothing; C5
// landing 1's rungs (along the hand's ray) must fail R's shortest-distance
// hold on a straight side, or R is reading nothing.
//
// Run: node --import ./tools/three-node-loader.mjs tools/probe-form-track.mjs
import { caseShapeOf, formShapeOf, formShapeOpts, loopConvexity, PLATE_RIM_MARGIN } from '../src/layout.js';
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
  // (§317: a fitted tonneau's shape numbers ride the flip unchanged — main.js's FORM_DIAL)
  builds.push({ name: kind, shape: caseShapeOf(kind, { xMin: -xMax, xMax: -xMin, yMin, yMax }, formShapeOpts(formShapeOf(kind, modes.bar.formrect))) });
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
  const d = t.gap;
  // G — the gauges are the round face's, exact on the shape's axes, never nearer the rim
  ok(`${name} G gauges`, Math.abs(t.gOut - gOutRef) < 1e-12 && Math.abs(t.gIn - gInRef) < 1e-12 && Math.abs(d - (gInRef - gOutRef)) < 1e-12,
    `gOut ${t.gOut.toFixed(4)} gIn ${t.gIn.toFixed(4)} gap ${d.toFixed(4)}`);
  let minOut = Infinity, minIn = Infinity;
  for (const [x, y] of t.loops.outer) minOut = Math.min(minOut, shape.inset(x, y));
  for (const [x, y] of t.loops.inner) minIn = Math.min(minIn, shape.inset(x, y));
  ok(`${name} G never nearer the rim than the gauge`, minOut >= t.gOut - tol - 1e-6 && minIn >= t.gIn - tol - 1e-6,
    `outer min inset ${minOut.toFixed(4)} (gauge ${t.gOut.toFixed(4)}), inner ${minIn.toFixed(4)} (${t.gIn.toFixed(4)})`);
  // on the shape's own axes (rays through ITS centre — the fitted box is not
  // centred on the hands' axis) the outline is a straight or the apex of an
  // arc, the normal along the ray: the offset reads exactly g there
  const axisExact = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].every((az) => {
    // (§317: the fitted tonneau's sides peak at their APEX height yA, not the box's centre — its taper — so
    // its two side rays run through (cx, yA); the end rays through cx as every kind's)
    const yAx = shape.fitted ? shape.fitted.yA : shape.cy;
    const off = -shape.cx * Math.sin(az) + yAx * Math.cos(az);   // the base that puts the ray's line through (cx, yAx)
    const o = t.outer.exit(az, off), i = t.inner.exit(az, off), s = shape.exit(az, off);
    return Math.abs(s - o - t.gOut) < tol + 1e-6 && Math.abs(s - i - t.gIn) < tol + 1e-6;
  });
  ok(`${name} G exact gauge on the shape's four axes`, axisExact);
  // E — one gauge between the rails, everywhere
  const gaugeDev = (rails) => {
    let w = 0;
    for (const [x, y] of rails.outerLoop) w = Math.max(w, Math.abs(-rails.inner.inset(x, y) - d));
    for (const [x, y] of rails.innerLoop) w = Math.max(w, Math.abs(rails.outer.inset(x, y) - d));
    return w;
  };
  const eDev = gaugeDev({ outer: t.outer, inner: t.inner, outerLoop: t.loops.outer, innerLoop: t.loops.inner });
  ok(`${name} E the rails are ${d.toFixed(4)} apart at every point`, eDev <= 2 * tol + 1e-9, `worst departure ${eDev.toExponential(2)} u over ${t.loops.outer.length + t.loops.inner.length} vertices`);
  // S — simple convex, and the tightest turn
  const floor = shape.cornerR !== null ? shape.cornerR : 0;
  for (const [which, loop, need] of [['inner', t.loops.inner, floor], ['outer', t.loops.outer, shape.cornerR !== null ? floor + d : 0]]) {
    const cv = loopConvexity(loop);
    ok(`${name} S ${which} rail is a simple convex loop`, cv.ok, `worst turn ${cv.worst.toExponential(2)}, ${cv.turns.toFixed(6)} rev`);
    const rMin = Math.min(...vertexRadii(loop));
    ok(`${name} S ${which} rail's tightest turn ≥ ${shape.cornerR !== null ? need.toFixed(4) : '0 (no fold)'}`, rMin >= (shape.cornerR !== null ? need - 1e-6 : 1e-6),
      `least radius of curvature ${Number.isFinite(rMin) ? rMin.toFixed(4) : '∞'} u`);
  }
  // R — the rungs
  ok(`${name} R sixty rungs, one per minute`, t.rungs.length === 60 && t.rungs.every((r, i) => Math.abs(r.az - (Math.PI / 2 - (i / 60) * 2 * Math.PI)) < 1e-12));
  let onRail = 0, lenDev = 0, footDev = 0, readOff = 0, drawnOff = 0;
  for (const r of t.rungs) {
    const [fx, fy] = r.from, [tx, ty] = r.to, [ax, ay] = r.at;
    onRail = Math.max(onRail, Math.abs(t.inner.inset(fx, fy)), Math.abs(t.outer.inset(tx, ty)));
    lenDev = Math.max(lenDev, Math.abs(Math.hypot(tx - fx, ty - fy) - d));
    // the shortest distance from each end to the OTHER rail, against the
    // rung's own length: equal means no shorter span leaves either end. Read
    // as distances, not as foot positions — on the cushion's polyline a foot
    // can fall either side of a vertex, which moves it along the rail without
    // moving the distance (a foot-position compare read 0.03 u of that).
    const len = Math.hypot(tx - fx, ty - fy);
    footDev = Math.max(footDev, Math.abs(t.outer.inset(fx, fy) - len), Math.abs(-t.inner.inset(tx, ty) - len));
    // the read point: on the hand's ray, on the mid-rail, and on the rung
    const ux = Math.cos(r.az), uy = Math.sin(r.az), ex = tx - fx, ey = ty - fy;
    readOff = Math.max(readOff, Math.abs(ax * uy - ay * ux), Math.abs(t.mid.inset(ax, ay)),
      Math.abs((ax - fx) * ey - (ay - fy) * ex) / Math.hypot(ex, ey));
    drawnOff = Math.max(drawnOff, loopDist(t.loops.inner, fx, fy), loopDist(t.loops.outer, tx, ty));
  }
  ok(`${name} R every rung's ends lie on their rails`, onRail <= tol, `worst ${onRail.toExponential(2)} u`);
  ok(`${name} R every rung is the gauge long`, lenDev <= 2 * tol + 1e-9, `worst departure from ${d.toFixed(4)}: ${lenDev.toExponential(2)} u`);
  ok(`${name} R every rung is the shortest distance between the rails (its length = each end's distance to the other rail)`, footDev <= 2 * tol + 1e-9, `worst ${footDev.toExponential(2)} u`);
  ok(`${name} R every rung is read on the hand's ray at the mid-rail`, readOff <= 2 * tol + 1e-9, `worst ${readOff.toExponential(2)} u`);
  // the drawn loops' own sagitta off their shapes (each edge's midpoint), the
  // most a rung's end can stand off the stroke that draws its rail
  let sag = 0;
  for (const [sh, loop] of [[t.outer, t.loops.outer], [t.inner, t.loops.inner]])
    for (let i = 0; i < loop.length; i++) { const [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % loop.length]; sag = Math.max(sag, Math.abs(sh.inset((ax + bx) / 2, (ay + by) / 2))); }
  ok(`${name} R every rung ends on the drawn strokes`, drawnOff <= sag + tol,
    `${drawnOff.toExponential(2)} off the drawn stroke (its sagitta ${sag.toExponential(2)}, ${(sag * 1024 / (2 * RADIUS)).toFixed(3)} px)`);
  const segs = t.rungs.map((r) => [r.from, r.to]);
  let crossings = 0;
  for (let i = 0; i < 60; i++) for (let j = i + 1; j < 60; j++) if (segCross(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) crossings++;
  ok(`${name} R no two rungs cross`, crossings === 0, `${crossings} crossing pairs`);
  // H — the hand
  const readR = t.rungs.map((r) => Math.hypot(r.at[0], r.at[1]));
  ok(`${name} H the hand's reach is the mid-rail's nearest approach`, Math.abs(t.nearestMid - t.mid.inset(0, 0)) < 1e-12
    && readR.every((x) => x >= t.nearestMid - tol - 1e-6), `tip at ${t.nearestMid.toFixed(4)} u; rungs read at ${Math.min(...readR).toFixed(4)}..${Math.max(...readR).toFixed(4)}`);
  // W — the wells' premise
  ok(`${name} W inner rail outside the round inner rail`, t.nearestInner >= roundInner - 1e-9, `nearest ${t.nearestInner.toFixed(4)} vs round ${roundInner.toFixed(4)}`);
  if (name === 'round') {
    // C1 — the law reduces to the shipped print
    const rOut = RADIUS * 2 * DIAL_CANVAS_FILL_F * DIAL_RAIL_OUT_F, rIn = roundInner, rMid = (rOut + rIn) / 2;
    const railsRound = t.loops.outer.every(([x, y]) => Math.abs(Math.hypot(x, y) - rOut) < 1e-9) && t.loops.inner.every(([x, y]) => Math.abs(Math.hypot(x, y) - rIn) < 1e-9);
    const rungsRound = t.rungs.every((r) => Math.abs(Math.hypot(...r.from) - rIn) < 1e-9 && Math.abs(Math.hypot(...r.to) - rOut) < 1e-9
      && Math.abs(r.from[0] * Math.sin(r.az) - r.from[1] * Math.cos(r.az)) < 1e-9 && Math.abs(r.to[0] * Math.sin(r.az) - r.to[1] * Math.cos(r.az)) < 1e-9);
    ok('C1 at a circle the law IS the round print', railsRound && rungsRound && Math.abs(t.nearestMid - rMid) < 1e-9,
      `rails ${rOut.toFixed(4)} / ${rIn.toFixed(4)}, rungs radial between them, hand ${t.nearestMid.toFixed(4)} = ${rMid.toFixed(4)}`);
  }
  if (shape.cornerR !== null) {
    // C2 — the exact offset (hold removed) is a cusp: the smoothness gate must see it
    console.log('  (C2 — the §308 warn that follows, if any, is the control\'s un-held offset, not the build\'s)');
    const bare = shape.grown(-t.gIn);
    ok(`${name} C2 the un-held offset fails the smoothness floor`, bare.cornerR < floor - 1e-6, `corner round ${bare.cornerR.toFixed(3)} against the floor ${floor}`);
    // C3 — the crossing test reads: two neighbouring rungs laid end-for-end
    // across each other (inner₀ → outer₁, inner₁ → outer₀) must count once
    ok(`${name} C3 the crossing test sees two rungs laid across each other`, segCross(segs[0][0], segs[1][1], segs[1][0], segs[0][1]));
    // C4 — landing 1's rails, both offset from the rim with both corners held,
    // open the gap at a held corner: E must see it
    const hold = { cornerR: shape.cornerR };
    const l1 = { outer: shape.grown(-t.gOut, hold), inner: shape.grown(-t.gIn, hold) };
    l1.outerLoop = l1.outer.loop({ segs: 256 }); l1.innerLoop = l1.inner.loop({ segs: 256 });
    const l1Dev = gaugeDev(l1);
    ok(`${name} C4 landing 1's rails fail the one-gauge hold`, l1Dev > 1e-3, `their worst departure ${l1Dev.toFixed(4)} u from ${d.toFixed(4)}`);
  }
  if (shape.kind === 'rect') {
    // C5 — landing 1's rungs ran along the hand's ray; off a side's middle
    // that is longer than the gauge and not square to the rails: R must see it
    const r = t.rungs[7];   // 7 min: well off the top side's middle
    const tIn = t.inner.exit(r.az), tOut = t.outer.exit(r.az);
    ok(`${name} C5 a rung along the hand's ray is not the shortest span`, tOut - tIn - d > 1e-3, `ray rung ${(tOut - tIn).toFixed(4)} u against the gauge ${d.toFixed(4)}`);
  }
}

console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join('; ')}` : '\nall PASS');
process.exit(fails.length ? 1 : 0);
