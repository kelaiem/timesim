// §308 landing 3 — THE FLOORPLANNER. Pure (no THREE, no DOM): given the shape
// kind, the region model a form build publishes (`__clock.regions`, BUILT §308
// landing 2 — every action group's units with their XY hulls, z strata and
// anchors) and the MOVES the build can realise through an existing URL knob,
// find the knob values whose fitted outline has the least area, subject to:
//
//   * no two units of DIFFERENT groups sharing a stratum come closer than they
//     stood in the designed build or than CLEAR_MARGIN, whichever is less
//     (hull vs hull, signed: a designed interleave — two hulls that already
//     overlap, as a train wheel's hull does a bridge's — may not get DEEPER);
//   * every anchor holds (a group's anchor point and the point of the group it
//     is pinned to move by the same transform — a rotation about the hand
//     centre keeps the motion works on it; anything else is not a
//     position-space move and is refused);
//   * the outline is the case kind FITTED to the moved metal by layout.js's own
//     law (`fitCaseShape`: every hull vertex PLATE_RIM_MARGIN inside), so
//     "inside the shape by the rim margin" holds by construction.
//
// THE MOVES ARE MEASURED, never assumed. A move is a knob that carries a SET of
// units by one rigid transform per unit of knob travel — a rotation about a
// fixed point, or a translation along a direction — and `tools/form-layout.mjs
// --floorplan` measures each candidate by booting the build with the knob
// changed and fitting a rigid transform to every unit (BUILT §308 landing 3's
// table); a knob is modelled only on the units it moved RIGIDLY, and a unit it
// re-cut (a bridge the build re-solves, like the alarm winding train between a
// fixed crown and a turned barrel) is carried by the move's transform as an
// APPROXIMATION the verifying boot judges, named in `bridges`. A knob whose
// moved units are mostly re-cut (the train's step angles, which re-solve the
// whole going train) is left out with its reason.
//
// What this does NOT know, named: a hull is the convex hull of a unit's metal
// at the build pose, so a unit's swept envelope over its action cycle is not in
// it, and two hulls that clear do not prove two parts clear (an arm's hull is
// fatter than the arm, so the test is conservative there and blind nowhere —
// except where a unit's PATH leaves its build-pose hull). The judge of record is
// the boot (its warnings) and then the battery; a plan here is a candidate.
import { fitCaseShape, CLEAR_MARGIN, PLATE_RIM_MARGIN, convexHull2 } from './layout.js';

// The candidate moves: every knob index.html's roster carries that moves a
// STATION rather than re-solving a train. `transform` is the measured kind; the
// tool's measurement fills `centre`/`dir`/`per` and the unit list, and decides
// `rigid`. Steps are in the knob's own units.
export const FLOORPLAN_KNOBS = Object.freeze([
  Object.freeze({ knob: 'alarmmod', transform: 'rotate', start: 40, step: 15, range: [0, 360],
    why: 'the whole alarm module\'s azimuth about the hand centre (§33): the striking wheel station on its R = 29 circle, its triple turned with it' }),
  Object.freeze({ knob: 'crownaz', transform: 'rotate', start: null, step: 15, range: [-180, 540],
    why: 'the going train\'s frame azimuth (§33 step 1): solveKeyless rotates every station of P about the hand centre' }),
  Object.freeze({ knob: 'stemaz', transform: 'rotate', start: null, step: 15, range: [-180, 540],
    why: 'the winding stem\'s azimuth (§33 step 2): the keyless cluster round its line' }),
  Object.freeze({ knob: 'alarmaz', transform: 'rotate', start: 0, step: 15, range: [-180, 540],
    why: 'the alarm corner\'s azimuth (§33): the alarm crown, its climb and the setting/release levers round the hand centre' }),
  Object.freeze({ knob: 'alarmr', transform: 'translate', start: null, step: 1, range: [10, 25],
    why: 'the alarm corner\'s radius (§98)' }),
  Object.freeze({ knob: 'rsvr', transform: 'translate', start: null, step: 1, range: [10, 25],
    why: 'the power-reserve station\'s radius (§94 tier C)' }),
  Object.freeze({ knob: 'd4', transform: 'translate', start: null, step: 0.5, range: [14, 22],
    why: 'the centre→fourth distance (§94 tier A): the small-seconds station' }),
  Object.freeze({ knob: 'barrelstep', transform: 'resolve', start: null, step: 5, range: [-180, 180],
    why: 'the barrel\'s step angle: solveLayout re-solves the going train from it' }),
  Object.freeze({ knob: 'escstep', transform: 'resolve', start: null, step: 5, range: [-180, 180],
    why: 'the escape step angle: solveLayout re-solves the train from it' }),
  Object.freeze({ knob: 'balstep', transform: 'resolve', start: null, step: 5, range: [-180, 180],
    why: 'the balance step target: solveLayout\'s obstacle solve re-solves the balance from it' }),
  Object.freeze({ knob: 'alarmbarrelaz', transform: 'rotate', start: 202, step: 15, range: [0, 360],
    why: 'the alarm barrel\'s bearing off the striking wheel (§129): one leg of the module\'s solved triple' }),
]);

const RAD = Math.PI / 180;

// ── rigid transforms in the plane: { c, s, tx, ty } for p ↦ R p + t ──
export const IDENTITY = Object.freeze({ c: 1, s: 0, tx: 0, ty: 0 });
export function rotationAbout(deg, cx = 0, cy = 0) {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  return { c, s, tx: cx - (c * cx - s * cy), ty: cy - (s * cx + c * cy) };
}
export const translation = (dx, dy) => ({ c: 1, s: 0, tx: dx, ty: dy });
export const compose = (a, b) => ({ // a after b
  c: a.c * b.c - a.s * b.s, s: a.s * b.c + a.c * b.s,
  tx: a.c * b.tx - a.s * b.ty + a.tx, ty: a.s * b.tx + a.c * b.ty + a.ty,
});
export const apply = (T, [x, y]) => [T.c * x - T.s * y + T.tx, T.s * x + T.c * y + T.ty];
const same = (A, B, eps = 1e-9) => Math.abs(A.c - B.c) < eps && Math.abs(A.s - B.s) < eps && Math.abs(A.tx - B.tx) < eps && Math.abs(A.ty - B.ty) < eps;

// A measured move's transform at knob value v (its travel from the start).
export function moveTransform(m, v) {
  const d = v - m.start;
  if (m.transform === 'rotate') return rotationAbout(d * m.per, m.centre.x, m.centre.y);
  return translation(d * m.dir.x, d * m.dir.y);
}

// ── convex polygons: signed distance (+ apart, − the least SAT overlap) ──
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
  const u = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2)) : 0;
  return Math.hypot(px - ax - u * vx, py - ay - u * vy);
}
export function polySignedDistance(A, B) {
  // SAT over both polygons' edge normals: the largest separation found is the
  // gap if positive (exact only for the axis-realised gap, so the distance is
  // then refined as the true vertex–edge minimum), else the least overlap.
  let sep = -Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) {
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
      let nx = by - ay, ny = -(bx - ax);
      const L = Math.hypot(nx, ny); if (L < 1e-12) continue; nx /= L; ny /= L;
      let pMax = -Infinity, qMin = Infinity;
      for (const [x, y] of P) pMax = Math.max(pMax, nx * x + ny * y);
      for (const [x, y] of Q) qMin = Math.min(qMin, nx * x + ny * y);
      sep = Math.max(sep, qMin - pMax);
    }
  }
  if (sep <= 0) return sep;
  let d = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) for (const [x, y] of P)
    for (let i = 0; i < Q.length; i++) { const [ax, ay] = Q[i], [bx, by] = Q[(i + 1) % Q.length]; d = Math.min(d, segDist(x, y, ax, ay, bx, by)); }
  return d;
}
const zOverlap = (a, b, m) => a[0] < b[1] + m && b[0] < a[1] + m;
export function polyArea(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) { const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length]; a += x0 * y1 - x1 * y0; }
  return Math.abs(a) / 2;
}

// ── the plan's model ──
// `regions`: __clock.regions. `moves`: the measured rigid moves, each
// { knob, transform, start, per | dir, centre, units: [names], range, step }.
// Returns an evaluator: knob values → { transforms per unit, shape, area,
// feasible, why }.
export function makeFloorplan({ kind, regions, moves, shapeOpts = {}, margin = PLATE_RIM_MARGIN, clear = CLEAR_MARGIN }) {
  // Every counted unit sets the outline; the FRAME (plates' pillars, the dial's
  // counted metal) and the unlabelled metal stand still and are no obstacle the
  // planner judges — the pillars are re-sited by their own solve when a module
  // moves (measured: `pillars` re-cuts under ?alarmmod=), so the boot judges them.
  const unitNames = Object.keys(regions.units);
  const units = unitNames.map((u) => ({ name: u, group: regions.units[u].group, hull: regions.units[u].hull, z: regions.units[u].z }));
  const STATIC = new Set(['frame', 'unassigned']);
  const moverOf = new Map();
  for (const m of moves) for (const u of m.units) { if (moverOf.has(u)) moverOf.get(u).push(m); else moverOf.set(u, [m]); }
  // The PARTS the constraint watches: every mesh of a non-static unit (its own
  // hull and z span — `regions.units[u].parts`), so an arc-shaped unit is judged
  // by its pieces, not by the hull that spans them. A pair is watched when its
  // two units are in different groups and their spans overlap in z within the
  // margin; its designed distance is measured once, on first need.
  const boxOf = (h) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of h) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, x1, y0, y1]; };
  const parts = [];
  units.forEach((u, ui) => { if (STATIC.has(u.group)) return; for (const q of regions.units[u.name].parts ?? []) if (q.hull.length >= 3) parts.push({ ui, hull: q.hull, z: q.z, box: boxOf(q.hull) }); });
  const baseDist = new Map();
  const designed = (i, j) => { const k = i < j ? `${i},${j}` : `${j},${i}`; let d = baseDist.get(k); if (d === undefined) baseDist.set(k, d = polySignedDistance(parts[i].hull, parts[j].hull)); return d; };
  const boxGap = (a, b) => Math.max(a[0] - b[1], b[0] - a[1], a[2] - b[3], b[2] - a[3]);
  const pairs = { length: parts.length };
  // Anchors as unit-free points: a group's transform is its units' (a group
  // whose units move by different transforms has no single anchor transform,
  // which is itself a refusal — the group would be torn).
  const groupIds = [...new Set(units.map((u) => u.group))];
  const resolvePt = (p) => (p && Number.isFinite(p.x) ? [p.x, p.y] : null);
  const anchors = [];
  for (const gid of groupIds) for (const a of regions.groups[gid]?.anchors ?? [])
    anchors.push({ group: gid, ...a, xy: resolvePt(a.point) });

  function evaluate(values) {
    const T = new Map();
    for (const u of units) {
      let t = IDENTITY;
      for (const m of moverOf.get(u.name) ?? []) t = compose(moveTransform(m, values[m.knob] ?? m.start), t);
      T.set(u.name, t);
    }
    const why = [];
    // A GROUP's transform is the one most of its units move by. A move may
    // carry part of a group and leave the rest (the alarm corner's levers turn
    // while the disc stays on the hour wheel): that split is the build's own,
    // measured — the units between are the move's bridges — so it is not a
    // refusal; the anchors below are judged on the group's majority transform.
    const gT = new Map();
    for (const gid of new Set(units.map((u) => u.group))) {
      const ts = [];
      for (const u of units) if (u.group === gid) { const t = T.get(u.name); const hit = ts.find((q) => same(q.t, t)); if (hit) hit.n++; else ts.push({ t, n: 1 }); }
      ts.sort((a, b) => b.n - a.n);
      gT.set(gid, ts[0].t);
    }
    // anchors
    for (const a of anchors) {
      if (a.pin === 'case' || a.pin === 'dial') continue; // the case's ports and the dial's sub-dials follow the movement (landing 1's readout)
      // carried VIA a unit the build re-solves: held when an active move measured it re-cut
      if (a.via && moves.some((m) => Math.abs((values[m.knob] ?? m.start) - m.start) > 1e-9 && (m.bridges ?? []).includes(a.via))) continue;
      const TA = gT.get(a.group), TB = a.pin === 'hand' ? IDENTITY : gT.get(a.pin);
      if (TA === undefined || TB === undefined) continue; // a group with no counted metal is not built here
      if (a.xy) {
        const [x1, y1] = apply(TA, a.xy), [x2, y2] = apply(TB, a.xy);
        if (Math.hypot(x1 - x2, y1 - y2) > 1e-6) why.push(`anchor '${a.name}' (${a.group} → ${a.pin}) moves ${Math.hypot(x1 - x2, y1 - y2).toFixed(3)} u off its pin`);
      } else if (!same({ ...TA, tx: 0, ty: 0 }, { ...TB, tx: 0, ty: 0 })) why.push(`anchor '${a.name}' (${a.group} → ${a.pin}): the port's line turns apart from its pin`);
    }
    // collisions, part by part: only pairs whose units move RELATIVE to each
    // other can change, and a pair whose boxes stand the margin apart cannot
    // breach it (the box gap is a lower bound on the distance)
    const moved = units.map((u) => { const t = T.get(u.name); return t === IDENTITY ? u.hull : u.hull.map((p) => apply(t, p)); });
    const pHull = parts.map((q) => { const t = T.get(units[q.ui].name); return t === IDENTITY ? q.hull : q.hull.map((p) => apply(t, p)); });
    const pBox = parts.map((q, k) => (pHull[k] === q.hull ? q.box : boxOf(pHull[k])));
    let worst = null;
    for (let i = 0; i < parts.length; i++) {
      const ti = T.get(units[parts[i].ui].name);
      if (ti === IDENTITY) continue; // every watched pair has a mover; let the mover lead
      for (let j = 0; j < parts.length; j++) {
        if (i === j) continue;
        const ui = parts[i].ui, uj = parts[j].ui;
        if (units[ui].group === units[uj].group || !zOverlap(parts[i].z, parts[j].z, clear)) continue;
        const tj = T.get(units[uj].name);
        if (tj !== IDENTITY && j < i) continue; // a mover pair is judged once
        if (same(ti, tj)) continue;
        if (boxGap(pBox[i], pBox[j]) >= clear) continue;
        const d = polySignedDistance(pHull[i], pHull[j]);
        const need = Math.min(designed(i, j), clear);
        if (d < need - 1e-9) { const short = need - d; if (!worst || short > worst.short) worst = { short, a: units[ui].name, b: units[uj].name, d, base: designed(i, j) }; }
      }
    }
    if (worst) why.push(`${worst.a} ⇄ ${worst.b}: a part pair ${worst.d.toFixed(3)} u apart (designed ${worst.base.toFixed(3)}, required ≥ ${Math.min(worst.base, clear).toFixed(3)})`);
    // the fitted outline
    const xs = [], ys = [];
    for (const h of moved) for (const [x, y] of h) { xs.push(x); ys.push(y); }
    const hull = convexHull2(xs, ys, xs.length);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of hull) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const fit = fitCaseShape(kind, hull, [x0, x1, y0, y1], { margin, ...shapeOpts });
    const b = fit.shape.bounds;
    return { values, feasible: why.length === 0, why, area: polyArea(fit.shape.loop()), bounds: [b.xMin, b.xMax, b.yMin, b.yMax],
      size: [b.xMax - b.xMin, b.yMax - b.yMin], metal: [x0, x1, y0, y1] };
  }
  return { evaluate, parts: parts.length, units: units.length, anchors };
}

// The search: coordinate descent over the moves' knobs from the design (every
// knob at its start), ±step, steps halved after a round with no improving
// feasible move — then the best K distinct feasible plans seen, for the boot.
export function planFloor({ evaluate, moves, rounds = 8, minStepFrac = 1 / 16, keep = 6 }) {
  const knobs = [...new Map(moves.map((m) => [m.knob, m])).values()];
  const step = Object.fromEntries(knobs.map((m) => [m.knob, m.step]));
  const start = Object.fromEntries(knobs.map((m) => [m.knob, m.start]));
  let cur = evaluate({ ...start });
  const design = cur;
  const seen = new Map();
  const key = (v) => knobs.map((m) => (v[m.knob] ?? m.start).toFixed(3)).join(',');
  const note = (r) => { if (r.feasible) seen.set(key(r.values), r); };
  note(cur);
  for (let round = 0; round < 64; round++) {
    let best = null;
    // single-knob steps, and PAIRED steps (two knobs together, both signs):
    // an anchor can tie two moves (the alarm strike train's winding train to
    // the alarm crown's corner), and no single step can keep such a tie
    const dirs = [];
    knobs.forEach((m, i) => { for (const sg of [-1, 1]) dirs.push([[m, sg]]); knobs.slice(i + 1).forEach((n) => { for (const a of [-1, 1]) for (const b of [-1, 1]) dirs.push([[m, a], [n, b]]); }); });
    for (const dir of dirs) {
      if (dir.some(([m]) => step[m.knob] < m.step * minStepFrac)) continue;
      const v = { ...cur.values };
      let ok = true;
      for (const [m, sg] of dir) { v[m.knob] = (v[m.knob] ?? m.start) + sg * step[m.knob]; if (m.range && (v[m.knob] < m.range[0] || v[m.knob] > m.range[1])) ok = false; }
      if (!ok) continue;
      const r = evaluate(v); note(r);
      if (r.feasible && r.area < (best ?? cur).area - 1e-9) best = r;
    }
    if (best) cur = best;
    else { let any = false; for (const m of knobs) { step[m.knob] /= 2; if (step[m.knob] >= m.step * minStepFrac) any = true; } if (!any || round > rounds * 8) break; }
  }
  const top = [...seen.values()].sort((a, b) => a.area - b.area).slice(0, keep);
  return { design, best: cur, top };
}

// The plan as the knobs a URL carries: only those the plan MOVED off the design.
export function planQuery(kind, values, moves) {
  const parts = [`case=${kind}`];
  for (const m of [...new Map(moves.map((q) => [q.knob, q])).values()]) {
    const v = values[m.knob];
    if (v !== undefined && Math.abs(v - m.start) > 1e-9) parts.push(`${m.knob}=${v.toFixed(2)}`);
  }
  return parts.join('&');
}

// ── measuring a move: two region models, the knob's value apart ──
// Every unit's build-pose hull in the moved build is compared with its hull in
// the designed one. A rigid map carries a convex hull onto the hull of the
// image exactly (same vertices, cyclically re-indexed), so a unit with the same
// vertex count yields a candidate transform by a cyclic 2-D Kabsch fit; every
// unit is then judged against every candidate (and the identity) by the
// symmetric vertex-to-boundary distance between its moved hull and the image
// of its designed one. A unit no candidate carries within `tol` was RE-CUT (or
// moved non-rigidly) by the build. `tol` is the region model's rounding (1e-4)
// times ten.
function kabsch2(P, Q) {
  const n = P.length; let px = 0, py = 0, qx = 0, qy = 0;
  for (let i = 0; i < n; i++) { px += P[i][0]; py += P[i][1]; qx += Q[i][0]; qy += Q[i][1]; }
  px /= n; py /= n; qx /= n; qy /= n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const ax = P[i][0] - px, ay = P[i][1] - py, bx = Q[i][0] - qx, by = Q[i][1] - qy; sxx += ax * bx + ay * by; sxy += ax * by - ay * bx; }
  const th = Math.atan2(sxy, sxx), c = Math.cos(th), s = Math.sin(th);
  return { c, s, tx: qx - (c * px - s * py), ty: qy - (s * px + c * py) };
}
function boundaryDist(pt, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; d = Math.min(d, segDist(pt[0], pt[1], ax, ay, bx, by)); }
  return d;
}
export function hullMismatch(T, A, B) {
  const TA = A.map((p) => apply(T, p));
  let d = 0;
  for (const p of TA) d = Math.max(d, boundaryDist(p, B));
  for (const p of B) d = Math.max(d, boundaryDist(p, TA));
  return d;
}
export function describeTransform(T) {
  const th = Math.atan2(T.s, T.c) / RAD;
  let fix = null;
  if (Math.abs(th) > 1e-6) { const d = (1 - T.c) ** 2 + T.s * T.s; fix = { x: ((1 - T.c) * T.tx - T.s * T.ty) / d, y: (T.s * T.tx + (1 - T.c) * T.ty) / d }; }
  return { deg: th, tx: T.tx, ty: T.ty, fix };
}
// `delta` is the knob's travel between the two builds. The HYPOTHESES are the
// simple laws a station knob can mean — a rotation about the hand centre by
// ±delta degrees, a translation by delta along ±x or ±y — and each unit is
// judged against each: CARRIED when its moved hull is the image of its designed
// one within `slack` (CLEAR_MARGIN, the one clearance margin, so a carried hull
// is never off by more than the gap the planner holds), or SPUN when an exact
// rigid fit (a cyclic 2-D Kabsch on the hull's vertices, which a rigid map
// re-indexes but keeps) puts the unit's hull centroid where the hypothesis puts
// it — a toothed wheel moved to a new station comes back at a new tooth PHASE,
// and the phase is not a floorplan quantity; its hull error is reported. A unit
// that is neither was RE-CUT (or moved by another law) — a BRIDGE. The move is
// the hypothesis that carries the most metal.
export function measureMove(base, moved, { delta, tol = 1e-3, slack = CLEAR_MARGIN, skipGroups = ['frame', 'unassigned'] } = {}) {
  const names = Object.keys(base.units).filter((u) => moved.units[u]);
  const hyps = [];
  for (const sg of [1, -1]) hyps.push({ T: rotationAbout(sg * delta), src: `rotate ${sg > 0 ? '+' : '−'}Δ about the hand centre` });
  for (const [x, y, n] of [[1, 0, '+x'], [-1, 0, '−x'], [0, 1, '+y'], [0, -1, '−y']]) hyps.push({ T: translation(x * delta, y * delta), src: `translate Δ along ${n}` });
  const centroid = (H) => { let x = 0, y = 0; for (const [a, b] of H) { x += a; y += b; } return [x / H.length, y / H.length]; };
  const exactFit = (A, B) => {
    if (A.length !== B.length || A.length < 3) return null;
    let best = null;
    for (let k = 0; k < B.length; k++) {
      const Bk = B.map((_, i) => B[(i + k) % B.length]);
      const T = kabsch2(A, Bk), r = hullMismatch(T, A, B);
      if (!best || r < best.r) best = { T, r };
    }
    return best.r < tol ? best.T : null;
  };
  const units = {};
  const tally = hyps.map((h) => ({ ...h, units: [], vertices: 0, worst: 0 }));
  for (const u of names) {
    const A = base.units[u].hull, B = moved.units[u].hull, v = base.units[u].vertices, group = base.units[u].group;
    const dz = Math.max(Math.abs(base.units[u].z[0] - moved.units[u].z[0]), Math.abs(base.units[u].z[1] - moved.units[u].z[1]));
    const still = hullMismatch(IDENTITY, A, B);
    if (dz < tol && still < tol) { units[u] = { kind: 'still', group }; continue; }
    const F = exactFit(A, B), cA = centroid(A);
    let hit = null;
    hyps.forEach((h, hi) => {
      const r = hullMismatch(h.T, A, B);
      let kind = null;
      if (r < slack && dz < slack) kind = 'carried';
      else if (F && dz < tol) { const [fx, fy] = apply(F, cA), [hx, hy] = apply(h.T, cA); if (Math.hypot(fx - hx, fy - hy) < tol) kind = 'spun'; }
      if (kind && (!hit || r < hit.r)) hit = { hi, r, kind };
    });
    if (hit) {
      units[u] = { kind: hit.kind, hyp: hit.hi, r: hit.r, dz, vertices: v, group };
      if (!skipGroups.includes(group)) { const t = tally[hit.hi]; t.units.push(u); t.vertices += v; t.worst = Math.max(t.worst, hit.r); }
    } else units[u] = { kind: 'recut', dz, vertices: v, group, shift: still };
  }
  const ranked = tally.filter((c) => c.units.length).sort((a, b) => b.vertices - a.vertices);
  const dom = ranked[0] ?? null;
  // every moved unit not on the dominant law is a bridge: re-cut, or carried by another law
  const bridges = Object.entries(units).filter(([u, r]) => r.kind !== 'still' && !(dom && dom.units.includes(u)))
    .map(([u, r]) => ({ unit: u, group: r.group, vertices: r.vertices, kind: r.kind === 'recut' ? 'recut' : `by ${hyps[r.hyp].src}`, shift: r.shift }));
  return { units, dominant: dom, bridges, missing: Object.keys(base.units).filter((u) => !moved.units[u]) };
}
