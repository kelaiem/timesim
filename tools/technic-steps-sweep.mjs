// THE SWEPT-INSERTION VALIDATOR (BUILT §302) — a library for tools/probe-technic-steps.mjs
// and nothing else: it needs three.js and the vendored three-mesh-bvh, so it lives under
// tools/ and src/technic-steps.js (pure, browser-free) never imports it.
//
// THE QUESTION. Is this part, moved along its declared insertion direction from far outside
// the model to its placed pose, clear of every part already placed? Asked at TRIANGLE level
// against the LDraw part geometry the page draws (src/ldraw.js `walk`), in LDU.
//
// WHY NOT A BOOLEAN. LDraw parts are designed to TOUCH: an axle fills its hole end to end, a
// stud stands in its tube, a gear's tooth lies in its neighbour's gap. A triangle-triangle
// "do they cross" test answers yes for every one of those at float noise, and a validator
// that fails them fails every build (the instruments skill: tangency is not intersection).
// So the measure is a DEPTH, per crossing triangle pair: the distance the smaller side of
// one triangle reaches through the other's plane, the lesser of the two readings. Two
// coplanar or edge-on triangles read 0; chords of two tessellated cylinders that disagree
// by their sagitta read that sagitta; a real intrusion reads the thickness of what it
// intrudes with. The part's depth against a neighbour is the largest over its crossing
// pairs, and the sweep's is the largest over its samples. It is a LOWER BOUND on a true
// interpenetration (a thin triangle nearly wholly inside reads only its protruding sliver),
// which is why the sweep is sampled at STEP_LDU, finer than any wall in the pack, so a part
// that crosses a neighbour passes through every depth up to its own thickness on the way.
//
// THE TOLERANCE is stated, not tuned: TOL_LDU below, with the constraint it derives from.
await import('./three-node-loader.mjs');
const THREE = await import('three');
const { MeshBVH } = await import('../vendor/three-mesh-bvh.module.js');
import { walk, normName } from '../src/ldraw.js';
import { meshing, dirName } from '../src/technic-steps.js';
const same = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) < 1e-9;

// Sample spacing along the path: the thinnest wall in the pack's moving parts is 1.6 LDU
// (a plate's skirt is 1 LDU thick in the library; an axle's arm 4), so half a LDU cannot
// step over one. The cost is the number of samples INSIDE a neighbour's box (the rest are
// pruned by box), which is small.
export const STEP_LDU = 0.5;
// THE TOLERANCE. Two surfaces that are TANGENT in the ideal solid are two tessellated curves in the pack:
// the library draws every cylinder as a 16-gon, and two 16-gons at different phases (a gear turned
// on its axle, a part met from another side than it ends in) disagree by up to twice the sagitta of
// one, R(1 - cos(pi/16)) at the radius R the two meet on. The largest circle two meeting surfaces
// share in these builds is a 10 LDU boss or axle hole (a pin hole is 8, a stud 6): 2 * 10 * 0.0192 =
// 0.38, which is 0.4 LDU = 0.16 mm to the tenth above. A crossing no deeper than that, over the
// depth the same pair ends in, is a fit. (The first run of this probe used 0.25, a figure read off the
// axle-in-brick floor; the rows that moved when this derivation replaced it are in docs/BUILT.md §302.)
export const FIT_CIRCLE_R_LDU = 10, FIT_CIRCLE_SEGMENTS = 16;
export const TOL_LDU = Math.ceil(10 * 2 * FIT_CIRCLE_R_LDU * (1 - Math.cos(Math.PI / FIT_CIRCLE_SEGMENTS))) / 10;
// The tolerance: a crossing of this depth or less is a FIT, deeper is a collision. It is
// derived, not typed: the probe measures every pair of every build at the FINAL pose, where
// each fit is as tight as it ever is (tools/probe-technic-steps.mjs prints the largest), and
// the controls push a part into a neighbour by one stud-wall and must read above it. The
// number lives in the probe's header with the measurement; this module takes it as a
// parameter so no caller can forget it exists.
export const TOL_LDU_DEFAULT = null;

const mat4 = (m) => new THREE.Matrix4().set(m[3], m[4], m[5], m[0], m[6], m[7], m[8], m[1], m[9], m[10], m[11], m[2], 0, 0, 0, 1);

// One part's triangle soup in its own frame, with its bounds tree. Cached per id.
export function partGeometry(lib, id) {
  const cache = (partGeometry.cache ??= new WeakMap());
  if (!cache.has(lib)) cache.set(lib, new Map());
  const c = cache.get(lib);
  if (c.has(id)) return c.get(id);
  const pos = [];
  walk(lib, `${id}.dat`, (k, ps) => { if (k === 'tri') for (const p of ps) pos.push(p[0], p[1], p[2]); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: pos.length / 3 }, (_, i) => i), 1));
  g.computeBoundingBox();
  const bvh = new MeshBVH(g, { maxLeafTris: 6 });
  const out = { id, geometry: g, bvh, box: g.boundingBox.clone(), tris: pos.length / 9 };
  c.set(id, out);
  return out;
}

// A placed body: its geometry, world matrix and world box.
export function placedBody(lib, p) {
  const g = partGeometry(lib, p.part), M = mat4(p.m);
  return { part: p, g, M, box: g.box.clone().applyMatrix4(M) };
}

// THE LOCAL REACH of triangle X through triangle Y: X is first CLIPPED to the prism over Y
// (the region of X whose projection along Y's normal lands inside Y), then the clipped
// polygon's vertices are read against Y's plane, and the smaller of its two sides is the
// reach. Clipping is what keeps a long thin triangle that merely grazes Y at a shallow
// angle (an axle's 60 LDU side against a chamfer) from reading the height it climbs a
// stud's length away: only the part of X that stands over Y counts.
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const arr = (t) => [[t.a.x, t.a.y, t.a.z], [t.b.x, t.b.y, t.b.z], [t.c.x, t.c.y, t.c.z]];
function clip(poly, m, p) {                               // keep dot(m, v - p) >= 0
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const da = dot(m, sub(A, p)), db = dot(m, sub(B, p));
    if (da >= 0) out.push(A);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const t = da / (da - db); out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])]); }
  }
  return out;
}
// the least overlap area that counts as a crossing: a 20 LDU edge with float32 noise (1e-5) in
// the clip is 2e-4, an edge-on touch; the thinnest real lens (0.05 deep, 10 long) is 0.5
export const AREA_EPS_LDU2 = 1e-3;
export function reach(X, Y) {
  const y = arr(Y), x = arr(X);
  const n = cross(sub(y[1], y[0]), sub(y[2], y[0])), len = Math.hypot(...n);
  if (len < 1e-9) return 0;                                // a sliver has no plane
  const nu = n.map((v) => v / len);
  let poly = x;
  for (let k = 0; k < 3 && poly.length; k++) {
    const p = y[k], q = y[(k + 1) % 3], r = y[(k + 2) % 3];
    let m = cross(nu, sub(q, p));
    if (dot(m, sub(r, p)) < 0) m = m.map((v) => -v);
    poly = clip(poly, m, p);
  }
  // a clipped polygon with no area is X's EDGE lying on Y's boundary: a touch, not a crossing
  let ar = [0, 0, 0];
  for (let i = 1; i + 1 < poly.length; i++) { const c = cross(sub(poly[i], poly[0]), sub(poly[i + 1], poly[0])); ar = [ar[0] + c[0], ar[1] + c[1], ar[2] + c[2]]; }
  if (Math.hypot(...ar) / 2 < AREA_EPS_LDU2) return 0;
  let pos = 0, neg = 0;
  for (const v of poly) { const d = dot(nu, sub(v, y[0])); if (d > pos) pos = d; else if (-d > neg) neg = -d; }
  return Math.min(pos, neg);
}

// The depth of mover body `mv` (at world matrix Mmv) against static body `st`: the largest
// pair depth over crossing triangles, with the pair that holds it. `stop` ends the search
// at the first pair deeper than it (a caller that only wants "over the tolerance?").
const _toLocal = new THREE.Matrix4(), _inv = new THREE.Matrix4();
export function depthOf(mv, Mmv, st, stop = Infinity) {
  _inv.copy(st.M).invert();
  _toLocal.multiplyMatrices(_inv, Mmv);
  let best = 0, at = null;
  st.g.bvh.bvhcast(mv.g.bvh, _toLocal, {
    intersectsTriangles: (t1, t2, i1, i2) => {
      if (!t1.intersectsTriangle(t2)) return false;
      const d = Math.min(reach(t1, t2), reach(t2, t1));
      if (d > best) { best = d; at = [i1, i2, [t1.a.toArray(), t1.b.toArray(), t1.c.toArray()], [t2.a.toArray(), t2.b.toArray(), t2.c.toArray()]]; }
      return best > stop;
    } });
  return { depth: best, at };
}

// THE PRESS FIT. A friction pin or a bush is moulded to enter a hole against ridges: it carries
// its interference through the hole on the way in, and may not carry it at rest (the ridged
// stretch has passed through). `press` maps a part id to the deepest interference that id shows at
// ANY final-pose contact in the builds (measured by the caller, never typed), and a part may meet
// that depth against anything, but only moving along one of its OWN axes — a pin pushed along its
// axis is pressed in, a pin dragged sideways through a wall is a collision.
const pressFor = (mv, d, press) => {
  const depth = press?.get(mv.part.part);
  if (!depth) return 0;
  const m = mv.part.m;
  for (const a of [[m[3], m[6], m[9]], [m[4], m[7], m[10]], [m[5], m[8], m[11]]]) {
    const n = Math.hypot(...a); if (n > 1e-9 && Math.abs(Math.abs(d.x * a[0] + d.y * a[1] + d.z * a[2]) / n - 1) < 1e-6) return depth;
  }
  return 0;
};

// Sweep `movers` (bodies, a rigid group) along unit `dir` from far outside to their placed
// poses, against `statics`. A pair may reach the depth it ENDS at (its FIT: the interference
// the library gives it at the placed pose, measured here, not typed) plus `tol`; deeper than
// that anywhere on the path is a block. Returns { ok, first, final, dist } where `first` is
// the first sample over its allowance ({ t, blocker, mover, depth, allow }, t the distance
// from the start), `final` the largest fit among the pairs and `worst` the largest depth
// over allowance met anywhere (0 when clear).
export function sweep(movers, dir, statics, { tol, step = STEP_LDU, margin = 4, press = null } = {}) {
  if (tol == null) throw new Error('sweep: a tolerance is required (it is derived, not defaulted)');
  const d = new THREE.Vector3(...dir).normalize();
  // the start: far enough that the movers' union box and the statics' union box are apart along d
  const sb = new THREE.Box3(); for (const s of statics) sb.union(s.box);
  const mb = new THREE.Box3(); for (const m of movers) mb.union(m.box);
  let D = margin;
  if (!sb.isEmpty()) {
    const proj = (b) => { let lo = Infinity, hi = -Infinity; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const v = x * d.x + y * d.y + z * d.z; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
    const [sl] = proj(sb), [, mh] = proj(mb);
    D = Math.max(margin, mh - sl + margin);                // the movers' leading edge back behind the statics' trailing edge
  }
  const n = Math.ceil(D / step);
  const fit = new Map(); let final = 0;
  for (const mv of movers) for (const st of statics) {
    if (!mv.box.intersectsBox(st.box)) continue;
    const r = depthOf(mv, mv.M, st);
    fit.set(mv.part.m.join() + '|' + st.part.m.join() + st.part.part, r.depth); final = Math.max(final, r.depth);
  }
  let first = null, worst = 0;
  const box = new THREE.Box3(), M = new THREE.Matrix4(), T = new THREE.Matrix4();
  for (let k = 0; k <= n && !first; k++) {
    const off = -(D - Math.min(D, k * step));            // 0 at the placed pose
    T.makeTranslation(d.x * off, d.y * off, d.z * off);
    for (const mv of movers) {
      box.copy(mv.box).applyMatrix4(T);
      M.multiplyMatrices(T, mv.M);
      for (const st of statics) {
        if (!box.intersectsBox(st.box)) continue;
        const allow = tol + Math.max(fit.get(mv.part.m.join() + '|' + st.part.m.join() + st.part.part) ?? 0, pressFor(mv, d, press));
        const r = depthOf(mv, M, st, allow);
        if (r.depth > allow) { worst = Math.max(worst, r.depth); if (!first) { first = { t: k * step, blocker: st, mover: mv, depth: r.depth, allow }; break; } }
      }
      if (first) break;
    }
  }
  return { ok: !first, first, final, worst, dist: D };
}

// ---------------------------------------------------------------------------
// A PLAN, JUDGED. Every step's parts are swept in turn against what is already placed (the main
// model, or for a sub-assembly's step only that sub-assembly's earlier parts; a `place` step
// sweeps the finished sub-assembly as one rigid group against the main model). A part is tried
// along its declared directions in order, and only when none clears:
//   · TURN TO MESH — a toothed part with a meshed neighbour already placed is tried again with the
//     meshed chain turned (the mover through δ, each neighbour through −δ·N/N', which keeps every
//     pair meshed), δ over one tooth pitch of the mover in TURN_STEPS steps. The builder turns the
//     gear (or the chain) to the angle the insertion allows and then to the modelled angle; only
//     the insertion is swept, the turn is the meshed rotation probe-technic-build.mjs holds.
//   · TWO LEGS — lowered clear of the mated parts, then slid along one of its own axes (the way a
//     part is put onto a pin or a joiner): `STAGES` LDU of slide, the staged pose swept first.
// Whatever still fails is FLAGGED with the attempt that got furthest and the part that stopped it.
export const TURN_STEPS = 24, STAGES = [8, 16, 32];
const M4 = (m) => mat4(m);
function rotateAbout(o, u, psi) {
  const T = new THREE.Matrix4().makeTranslation(o[0], o[1], o[2]);
  const R = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...u).normalize(), psi);
  const Ti = new THREE.Matrix4().makeTranslation(-o[0], -o[1], -o[2]);
  return T.multiply(R).multiply(Ti);
}
export function rebody(lib, b, Mnew) {
  return { part: b.part, g: b.g, M: Mnew, box: b.g.box.clone().applyMatrix4(Mnew) };
}
export function sweepTwoLeg(movers, d1, d2, s, statics, opts, members = null) {
  // stage: the sliding movers (all of them, or just `members`) displaced -s*d2 from the placed pose; the
  // group is lowered along d1 in that shape, then the sliders slide s along d2 into place
  const D2 = new THREE.Vector3(...d2).normalize().multiplyScalar(-s), T = new THREE.Matrix4().makeTranslation(D2.x, D2.y, D2.z);
  const slides = (m) => !members || members.includes(m);
  const staged = movers.map((m) => (slides(m) ? rebody(null, m, new THREE.Matrix4().multiplyMatrices(T, m.M)) : m));
  const a = sweep(staged, d1, statics, opts);
  if (!a.ok) return { ...a, leg: 1 };
  const sliders = movers.filter(slides), rest = movers.filter((m) => !slides(m));
  const b = sweepLeg(sliders, d2, s, [...statics, ...rest], opts);
  return b.ok ? { ok: true, final: a.final, first: null } : { ...b, leg: 2 };
}
// the short slide: the movers from s behind their placed pose along d to the pose itself
function sweepLeg(movers, d, s, statics, { tol, step = STEP_LDU, press = null }) {
  const dv = new THREE.Vector3(...d).normalize();
  const fit = new Map();
  for (const mv of movers) for (const st of statics) if (mv.box.intersectsBox(st.box)) fit.set(mv.part.m.join() + '|' + st.part.m.join() + st.part.part, depthOf(mv, mv.M, st).depth);
  const n = Math.ceil(s / step), T = new THREE.Matrix4(), M = new THREE.Matrix4(), box = new THREE.Box3();
  for (let k = 0; k <= n; k++) {
    const off = -(s - Math.min(s, k * step));
    T.makeTranslation(dv.x * off, dv.y * off, dv.z * off);
    for (const mv of movers) {
      box.copy(mv.box).applyMatrix4(T); M.multiplyMatrices(T, mv.M);
      for (const st of statics) {
        if (!box.intersectsBox(st.box)) continue;
        const allow = tol + Math.max(fit.get(mv.part.m.join() + '|' + st.part.m.join() + st.part.part) ?? 0, pressFor(mv, dv, press)), r = depthOf(mv, M, st, allow);
        if (r.depth > allow) return { ok: false, first: { t: k * step, blocker: st, mover: mv, depth: r.depth, allow } };
      }
    }
  }
  return { ok: true, first: null };
}

export function validatePlan(plan, lib, { tol = TOL_LDU, turnSteps = TURN_STEPS, pressOn = true } = {}) {
  const base = plan.parts.map((p) => placedBody(lib, p));
  const press = new Map();                                     // part id -> deepest final-pose interference it shows anywhere
  for (let a = 0; a < base.length; a++) for (let b = a + 1; b < base.length; b++) {
    if (!base[a].box.intersectsBox(base[b].box)) continue;
    const dpt = depthOf(base[a], base[a].M, base[b]).depth;
    if (dpt <= 0) continue;
    for (const id of [base[a].part.part, base[b].part.part]) press.set(id, Math.max(press.get(id) ?? 0, dpt));
  }
  const placedMain = [], placedSub = new Map();
  const out = [];
  const rotated = (placedIdx, moverIdx, delta) => {
    // the meshed chain turned: the mover's body through delta, the neighbours through -delta*N/N'
    const present = new Set([...placedIdx, ...moverIdx]), psi = new Map([[plan.bodyOf[moverIdx[0]], delta]]);
    const queue = [plan.bodyOf[moverIdx[0]]];
    const gearsOf = (b) => [...present].filter((i) => plan.bodyOf[i] === b && plan.parts[i].teeth);
    while (queue.length) {
      const b = queue.shift();
      for (const a of gearsOf(b)) for (const c of present) {
        const cb = plan.bodyOf[c];
        if (cb < 0 || psi.has(cb) || !plan.parts[c].teeth || !meshing(plan, a, c)) continue;
        psi.set(cb, -psi.get(b) * plan.parts[a].teeth / plan.parts[c].teeth); queue.push(cb);
      }
    }
    const turned = new Map();
    for (const [b, ang] of psi) {
      const g = [...present].find((i) => plan.bodyOf[i] === b && plan.parts[i].teeth);
      if (g === undefined) continue;
      const m = plan.parts[g].m, R = rotateAbout([m[0], m[1], m[2]], [m[5], m[8], m[11]], ang);
      for (const i of present) if (plan.bodyOf[i] === b) turned.set(i, rebody(lib, base[i], new THREE.Matrix4().multiplyMatrices(R, base[i].M)));
    }
    return turned;
  };
  for (const st of plan.steps) {
    const rec = { n: st.n, kind: st.kind, ok: true, parts: [] };
    out.push(rec);
    if (st.flexible) { rec.skipped = 'flexible'; for (const i of st.parts) placedMain.push(i); continue; }
    if (!st.parts.length && !st.unit) continue;
    const ctx = st.sub ? (placedSub.get(st.sub) ?? placedSub.set(st.sub, []).get(st.sub)) : placedMain;
    const groups = st.unit ? [st.unit] : st.parts.map((i) => [i]);
    for (const grp of groups) {
      const cands = st.unit ? st.cand.unit : st.cand[grp[0]];
      const opts = { tol, press: pressOn ? press : null };
      const statics0 = ctx.map((i) => base[i]), movers0 = grp.map((i) => base[i]);
      const tried = [];
      let hit = null;
      const attempt = (movers, statics, label, run) => { const r = run(); tried.push({ label, r }); if (r.ok) hit = { label, r }; return r.ok; };
      // 1. straight
      for (const c of cands) if (attempt(movers0, statics0, `straight ${dirName(c)}`, () => sweep(movers0, c, statics0, opts))) { hit.dir = c; break; }
      // 2. turn to mesh
      const toothedMover = !hit && grp.length === 1 && plan.parts[grp[0]].teeth && ctx.some((j) => plan.parts[j].teeth && meshing(plan, grp[0], j));
      if (toothedMover) {
        const pitch = 2 * Math.PI / plan.parts[grp[0]].teeth;
        search: for (let k = 0; k < turnSteps; k++) {
          const delta = (k / turnSteps) * pitch;
          const turned = rotated(ctx, grp, delta);
          const sx = ctx.map((i) => turned.get(i) ?? base[i]), mx = grp.map((i) => turned.get(i) ?? base[i]);
          for (const c of cands.slice(0, 4)) if (attempt(mx, sx, `turn ${(delta * 180 / Math.PI).toFixed(1)}° then ${dirName(c)}`, () => sweep(mx, c, sx, opts))) { hit.dir = c; hit.turn = delta; break search; }
        }
      }
      // 2b. the travel the model itself declares (the ring lowered at the neutral place, slid into the mode's)
      if (!hit && st.twoLeg && grp.length === 1) for (const t of st.twoLeg[grp[0]] ?? []) {
        if (attempt(movers0, statics0, `down then slide ${dirName(t.d2)} ${t.s.toFixed(1)} (its travel)`, () => sweepTwoLeg(movers0, t.d1, t.d2, t.s, statics0, opts))) { hit.dir = t.d1; hit.slide = { dir: t.d2, s: t.s }; break; }
      }
      if (!hit && st.twoLeg?.unit && grp.length > 1) for (const t of st.twoLeg.unit) {
        const members = movers0.filter((m) => t.members.includes(grp[movers0.indexOf(m)]));
        if (attempt(movers0, statics0, `down then slide ${dirName(t.d2)} ${t.s.toFixed(1)} (its travel)`, () => sweepTwoLeg(movers0, t.d1, t.d2, t.s, statics0, opts, members))) { hit.dir = t.d1; hit.slide = { dir: t.d2, s: t.s, members: t.members }; break; }
      }
      // 3. two legs
      if (!hit) {
        legs: for (const c1 of [[0, 1, 0]]) for (const c2 of cands.filter((c) => !same(c, c1) && !same(c, c1.map((v) => -v)))) for (const s of STAGES) {
          if (attempt(movers0, statics0, `down then slide ${dirName(c2)} ${s}`, () => sweepTwoLeg(movers0, c1, c2, s, statics0, opts))) { hit.dir = c1; hit.slide = { dir: c2, s }; break legs; }
        }
      }
      const item = { part: grp.length === 1 ? grp[0] : 'unit', idx: grp, declared: cands[0] };
      if (hit) Object.assign(item, { strategy: hit.slide ? 'two-leg' : hit.turn != null ? 'turn' : 'straight', label: hit.label, dir: hit.dir, turn: hit.turn ?? null, slide: hit.slide ?? null });
      else {
        // the attempt that got furthest along its path
        let best = tried[0];
        for (const t of tried) if ((t.r.first?.t ?? Infinity) > (best.r.first?.t ?? Infinity)) best = t;
        rec.ok = false;
        Object.assign(item, { strategy: 'flagged', label: best.label, blockedBy: best.r.first ? { part: best.r.first.blocker.part, depth: best.r.first.depth, allow: best.r.first.allow, t: best.r.first.t } : null, tried: tried.length, attempts: tried.map((t) => ({ label: t.label, t: t.r.first?.t ?? null, by: t.r.first ? `${t.r.first.blocker.part.role}${t.r.first.blocker.part.part}` : null, depth: t.r.first?.depth ?? null, allow: t.r.first?.allow ?? null, leg: t.r.leg ?? null })) });
      }
      rec.parts.push(item);
      for (const i of grp) ctx.push(i);
    }
  }
  return { steps: out, flagged: out.filter((r) => !r.ok).length, press };
}
