// §325 landing 8 — THE LAZY-TONGS MINUTE HAND, designed in free space (no scene, no DOM). `?hands=slide` needs a hand whose
// reach runs from the face's nearest mid-rail to its farthest (9.67 .. 51.1 u on the lands preview). A hand that slides
// out along one line needs a tail as long as its stroke, and the tail sweeps a strip across the dial centre that no fixed
// cam can share (landing 8's first design, a gear train driving a slider, died on exactly that). A LAZY-TONGS retracts
// TOWARD the axis: it has no tail, so the only thing moving in the cam's plane is the follower pin.
//
// THE CHAIN: a fixed CAM on the hands' axis (a stud through the cannon pinion's bore) → a groove, ridden by the PIN of the first MID
// pivot, which the lattice carries up through both bar planes → n scissor cells, bars of length 2ℓ pivoted at their midpoints on the
// axis, carry the tip out to y_b + (2n−1)ℓ·cos α. The last cell's bars stop AT their crossing (half bars): the tip is that mid
// pivot, a point on the axis, so the hand has no wide closing pair at its tip.
//
//   rail pivots at (x = ±h, y = y_b + k·2ℓcosα), mid pivots on the axis at y_b + (k+½)·2ℓcosα, h = ℓ sin α.
//   Two bar families in two planes: family A runs (+h, y_k) → (−h, y_{k+1}), family B the mirror. EVERY pivot carries eyes in both planes
//   (a rail pivot joins an A end to a B start, a mid pivot the crossing pair), which is why the spacing law below reads all pivot pairs.
//
// WHY EACH NUMBER IS WHAT IT IS (standing rule 1): the constraint is beside each derivation below.
import { STOCK_MIN_U, CLEAR_MARGIN, PIVOT_BORE_CLEAR } from './layout.js';

export const PIN_R = STOCK_MIN_U / 2;                              // a pivot pin: §50's floor as its DIAMETER (a bar's eye is bored PIVOT_BORE_CLEAR over it)
export const EYE_R = PIN_R + PIVOT_BORE_CLEAR + STOCK_MIN_U;       // an eye's outer radius: bore + §50's floor of metal around it
export const STUD_R = 0.42;                                        // the movement's one stud (MW_STUD_R, TODO 175)

// The base pins' height: the stud's radius, a margin, an eye, a margin, an eye — the first rail pivots' eyes stand clear of the
// stud's lane. One derivation, read by the build and the probe.
export const baseY = () => STUD_R + CLEAR_MARGIN + EYE_R + CLEAR_MARGIN + EYE_R;

// Geometry of the tongs at rail half-width h (ℓ half the bar length). Returns every pivot, in the hand's frame (+y along
// the arm, x across it): rails[k] = [[+h, y_k], [−h, y_k]], mids[k] on the axis, and the bars as pivot pairs.
export function tongsAt({ n, ell, yb, h }) {
  const c = Math.sqrt(ell * ell - h * h), ax = 2 * c;               // c = ℓ cos α; a cell advances 2c along the axis
  const rails = [], mids = [], bars = [];
  for (let k = 0; k < n; k++) rails.push([[h, yb + k * ax], [-h, yb + k * ax]]);   // the LAST cell has no far rail (see below)
  for (let k = 0; k < n; k++) mids.push([0, yb + (k + 0.5) * ax]);
  for (let k = 0; k < n; k++) {
    const last = k === n - 1;
    // THE POINTED END: the last cell's two bars stop AT their crossing (half bars, length ℓ), so the tip is the last mid pivot
    // ON THE AXIS. A closing rail pair would be 2h wide at the tip (up to 8 u) and stand across the track in nearly every pose.
    bars.push({ fam: 'A', k, half: last, from: [h, yb + k * ax], to: last ? mids[k] : [-h, yb + (k + 1) * ax], mid: mids[k] });
    bars.push({ fam: 'B', k, half: last, from: [-h, yb + k * ax], to: last ? mids[k] : [h, yb + (k + 1) * ax], mid: mids[k] });
  }
  return { rails, mids, bars, tip: mids[n - 1][1], ax };
}
export const reachOf = ({ n, ell, yb }, h) => yb + (2 * n - 1) * Math.sqrt(ell * ell - h * h);
export const halfWidthOf = ({ n, ell, yb }, reach) => { const c = (reach - yb) / (2 * n - 1); return Math.sqrt(Math.max(0, ell * ell - c * c)); };

// THE CLEARANCE THE TONGS OWES, MEASURED ON THE POSED PIVOTS. Every pivot carries an eye in BOTH bar planes (a rail pivot joins an
// A bar's end to a B bar's start, a mid pivot joins the crossing pair), so two pivots must stand 2·EYE_R + CLEAR_MARGIN apart
// whatever the plane. `minPivotSpacing` is that distance, measured, over every pair.
export function minPivotSpacing(tongs) {
  const pts = [...tongs.rails.flat(), ...tongs.mids];
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
  return m;
}
export const PIVOT_NEED = 2 * EYE_R + CLEAR_MARGIN;

// THE CHOICE OF n AND ℓ (α is a bar's angle off the axis). Constraints, all on the pivots' spacing or the reach:
//   · the reach: y_b + (2n−1)ℓ cos α_min = far and y_b + (2n−1)ℓ cos α_max = near, which fixes ℓ and α_max once n and α_min are chosen;
//   · fully out: the two rails stand 2h_min apart, and two eyes must stand PIVOT_NEED apart:  2h_min ≥ PIVOT_NEED;
//   · folded: the cells stack along the axis at 2ℓ cos α_max = 2(near − y_b)/(2n−1) each, and consecutive pivots on one rail
//       must stand PIVOT_NEED apart:  2(near − y_b)/(2n−1) ≥ PIVOT_NEED   (this alone caps the number of cells);
//   · SLENDERNESS: folded, the bundle stands 2h_max wide inside an arm only `near` long, and a hand that folds into
//       something wider than it is long is a diamond:  2h_max ≤ near.
// The FEWEST cells that satisfy all (every cell is two bars and three pins that owe their own §50 floors), and within it
// the NARROWEST folded bundle (the smallest α_min that still clears the rails).
export function solveTongs({ near, far, yb }) {
  for (let n = 3; n <= 24; n++) {
    if ((2 * (near - yb)) / (2 * n - 1) < PIVOT_NEED - 1e-9) return null;          // more cells cannot fold into the arm
    let best = null;
    for (let a = 4; a <= 40; a += 0.05) {
      const cMin = Math.cos((a * Math.PI) / 180), ell = (far - yb) / ((2 * n - 1) * cMin);
      const cMax = (cMin * (near - yb)) / (far - yb);
      if (cMax >= 1) continue;
      const aMax = Math.acos(cMax), hMin = ell * Math.sin((a * Math.PI) / 180), hMax = ell * Math.sin(aMax);
      if (2 * hMin < PIVOT_NEED - 1e-9 || 2 * hMax > near + 1e-9) continue;
      if (!best || hMax < best.hMax) best = { n, ell, yb, alphaMinDeg: a, alphaMaxDeg: (aMax * 180) / Math.PI, hMin, hMax, need: PIVOT_NEED };
    }
    if (best) return best;
  }
  return null;
}

// THE DRIVE. The first MID pivot stands on the axis at y_b + ℓ cos α = y_b + (reach − y_b)/(2n−1), and the lattice itself puts it
// there: bars A_0 and B_0 cross at it, their far ends are the base pins (which slide across the arm in slots and follow), and
// every later cell is carried by the reach. So that pivot's pin, carried up through both bar planes to a fixed CAM above the
// lattice, rides a groove that drives the whole hand, both ways (a groove is positive; no spring, so no restoring row).
//   r = y_b + (reach − y_b)/(2n−1)       ← the groove radius that puts the tip on the wanted reach, and LINEAR in it.
// Nothing else moves in the cam's plane, the pin crosses no other bar (bars cross the axis only at their own mids) and
// the stud, at the origin, is below y_b's eyes. The cam can be no steeper than tan α_p = |dr/dθ| / r (a radial follower's
// pressure angle); reach grows with r, so a cam inside the wanted reach stands at or BELOW the wanted radius:
//   r_cam(θ) = min over φ of  r_want(φ) · exp(tan α_p · |θ − φ|).
// `reach[i]` is the wanted reach at bearing i·2π/N.
// THE SAMPLES THE CAM IS CUT FROM. The pose interpolates the groove radius linearly between samples, so the tip does too; the rail is
// not linear between them (a built tip stood 0.006 u past it). Each sample is therefore the rail's MINIMUM over its neighbours' whole
// reach, [i−1, i+1] — any point between samples i and i+1 lies inside both of their windows, and a convex combination of two values
// each under the rail there is under it. `reachAt(az)` is the wanted reach; `sub` is the sub-sampling of that window.
export function conservativeReach(reachAt, N, sub = 8) {
  return Array.from({ length: N }, (_, i) => { let m = Infinity; for (let j = -sub; j <= sub; j++) m = Math.min(m, reachAt((((i + j / sub) / N) * 2 * Math.PI + 2 * Math.PI) % (2 * Math.PI))); return m; });
}
export function camProfile({ reach, geo, alphaPDeg = 45 }) {
  const N = reach.length, k = Math.tan((alphaPDeg * Math.PI) / 180), dth = (2 * Math.PI) / N, { n, yb } = geo;
  const want = reach.map((R) => yb + (R - yb) / (2 * n - 1));
  const gain = new Float64Array(N);
  for (let d = 0; d < N; d++) gain[d] = Math.exp(k * Math.min(d, N - d) * dth);
  const r = new Float64Array(N);
  for (let i = 0; i < N; i++) { let best = want[i]; for (let j = 0; j < N; j++) { const v = want[j] * gain[(i - j + N) % N]; if (v < best) best = v; } r[i] = best; }
  const tip = Array.from(r, (v) => yb + (2 * n - 1) * (v - yb));
  const short = tip.map((t, i) => reach[i] - t);                                   // how far INSIDE the wanted reach the tip stands
  const h = Array.from(r, (v) => Math.sqrt(Math.max(0, geo.ell * geo.ell - (v - yb) * (v - yb))));   // |mid − base| = ℓ
  let worst = 0;
  for (let i = 0; i < N; i++) { const d = (r[(i + 1) % N] - r[(i + N - 1) % N]) / (2 * dth); worst = Math.max(worst, Math.atan(Math.abs(d) / r[i])); }
  return { r: Array.from(r), h, tip, short, rMax: Math.max(...r), rMin: Math.min(...r), maxShort: Math.max(...short),
    meanShort: short.reduce((a, b) => a + b, 0) / N, pressureDeg: (worst * 180) / Math.PI };
}

// POSE at a bearing (radians): the groove radius there (linear between samples) is the first mid pivot's height; the rail
// half-width follows from bar length, and the tongs it makes.
export function poseAt({ cam, geo, bearing }) {
  const N = cam.r.length, u = (((bearing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI)) * N;
  const i = Math.floor(u) % N, f = u - Math.floor(u), r = cam.r[i] * (1 - f) + cam.r[(i + 1) % N] * f;
  const h = Math.sqrt(Math.max(0, geo.ell * geo.ell - (r - geo.yb) * (r - geo.yb)));
  return { r, h, tongs: tongsAt({ ...geo, h }) };
}

// The largest deviation of any bar from its length 2ℓ, and of any pair of bars from meeting at their shared mid pivot —
// the tongs' closure. Zero by construction; a perturbed pivot is the control.
export function closureError({ tongs, ell }) {
  let worst = 0;
  for (const b of tongs.bars) {
    const len = Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]);
    if (b.half) { worst = Math.max(worst, Math.abs(len - ell)); worst = Math.max(worst, Math.hypot(b.to[0] - b.mid[0], b.to[1] - b.mid[1])); }   // a half bar ends AT the crossing
    else { worst = Math.max(worst, Math.abs(len - 2 * ell)); worst = Math.max(worst, Math.hypot((b.from[0] + b.to[0]) / 2 - b.mid[0], (b.from[1] + b.to[1]) / 2 - b.mid[1])); }
  }
  return worst;
}
