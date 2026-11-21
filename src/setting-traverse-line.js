// THE SETTING TRAVERSE WITH TWO CORNERS, DESIGNED IN A LINE (§334 landing 3c, TODO 318) — pure, imported by nothing yet.
//
// The traverse carries the hand-setting drive from the keyless minute arbor's corner A to the rise at B through bevel
// corners and rods (§234's fold, TODO 289's bearings). Today it turns once, at K, and K's plate opening lies under the
// keyless rocking bar's first arm (§334 landing 3b; tools/probe-keyless-rocking-bar-fold.mjs row K). So K moves, and the
// traverse gains a corner: A → K1 → K2 → B.
//
// WHY LEG 1'S HEADING MOVES. A fold corner cannot be cut flatter than FOLD_DEFLECT_MIN (14.5°: past it the pair's
// tip cone passes the 85° a plane-bounded blank holds, TODO 138), and K turns 17.8°. With leg 1 on its held heading,
// K1 short of today's K and leg 3 on today's leg-2 line (so everything at B stands as it is: the cap leg, the rise,
// the reserve's swing), the middle leg can meet leg 3's forward half only between the two headings: a CHAMFER whose two
// corners share the 17.8°, both under 14.5°. Past K the held heading does give designs (an overshoot, the middle leg
// cutting back), but those leg-1 runs reach into the reserve train. So the search swings leg 1 and takes the least
// swing that works; B's end is held.
//
// WHAT IS DESIGNED HERE, all of it read off laws the build already uses, each taking its numbers as inputs:
//   · CORNERS (`corner`): the pair's shaft angle from the two legs, its module the least that keeps both blanks at
//     STOCK_MIN_U (foldModuleFor's law: the spec's bound first, the cut blank where the bound cannot answer), its plate
//     opening the blanks' footprint above the dial face grown by the margin (foldOpeningFor's law).
//   · LEGS (`legBearings`): two bearing blocks a leg, TODO 289 landing 2's law (`legBlocks`): bore r + PIVOT_BORE_CLEAR,
//     wall STOCK_MIN_U, length 2·r·MW_BUSH_LD_MIN, each station walked from its apex until the block clears its
//     corners' blanks by the margin, and the two at least a block's length apart. And every leg turnable: L/D at most
//     TURN_LD_TARGET.
//   · THE SEARCH (`solveTraverse`): leg 1's swing off its held heading on a grid, nearest first (the least change at A
//     is the least re-proof), K1 along leg 1 and the middle heading on grids, K2 where the middle leg meets leg 3's
//     line. A candidate passes when every corner is cuttable, every leg turnable and borne, every corner opening keeps
//     `landMin` of plate to every keep-out piece (the bar's pocket pieces), and every leg passes every column (the
//     barrel's) at its own margin. The first swing with a passing candidate is taken, and within it the candidate
//     whose least slack (land and column, in u) is largest.
// Nothing here knows the movement: the caller passes A, B, the held heading, leg 3's direction, the radii, the
// keep-outs and the laws' constants, read off a booted build (tools/probe-setting-traverse-line.mjs).
import * as G from './geometry.js';
import { CLEAR_MARGIN, STOCK_MIN_U, TURN_LD_TARGET } from './layout.js';

const DEG = Math.PI / 180;
export const TIP_CONE_MAX_DEG = 85;   // makeConicalGear's plane-bounded blank holds its tip cone to 85° (TODO 138)

const unit = (v) => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };
const dirOf = (h) => ({ x: Math.cos(h * DEG), y: Math.sin(h * DEG) });
const hdg = (v) => Math.atan2(v.y, v.x) / DEG;
const wrap = (d) => ((d + 540) % 360) - 180;
const segPt = (a, b, p) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };

// The least deflection a corner can be cut at: bisection on Σ for the tip cone at the limit (FOLD_DEFLECT_MIN's law).
export function deflectMinDeg({ teeth, module, bores }) {
  const tip = (sig) => Math.max(...[[bores[0], bores[1]], [bores[1], bores[0]]].map(([b, mb]) => G.bevelToothSpec({ module,
    teeth, mateTeeth: teeth, shaftAngleDeg: sig, boreR: b, mateBoreR: mb, quiet: true }).thetaTip));
  let lo = 90, hi = 180;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (tip(mid) <= TIP_CONE_MAX_DEG * DEG) lo = mid; else hi = mid; }
  return 180 - lo;
}

// foldModuleFor's law: the template module where the spec's bound already clears STOCK_MIN_U, else the least module
// whose cut blanks' thinnest box side is STOCK_MIN_U.
const _modMemo = new Map();
export function cornerModule({ shaftAngleDeg, teeth, templateModule, bores }) {
  const key = `${shaftAngleDeg}|${teeth}|${templateModule}|${bores}`;
  if (_modMemo.has(key)) return _modMemo.get(key);
  let m = templateModule;
  const s = G.bevelToothSpec({ module: m, teeth, mateTeeth: teeth, shaftAngleDeg, boreR: bores[0], mateBoreR: bores[1], quiet: true });
  const { g } = G.bevelBlankEnvelope(s);
  if (!(Math.min(s.zWebHi - s.zWebLo, 2 * s.coneR * Math.sin(s.thetaRoot) * Math.cos(g / 2)) >= STOCK_MIN_U)) {
    const thin = (mm) => { let t = Infinity;
      for (const [b, mb] of [[bores[0], bores[1]], [bores[1], bores[0]]]) {
        const gr = G.makeConicalGear({ teeth, module: mm, mateTeeth: teeth, shaftAngleDeg, boreR: b, mateBoreR: mb });
        gr.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
          t = Math.min(t, bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z); o.geometry.dispose(); });
      }
      return t; };
    for (let it = 0; it < 8; it++) { const t = thin(m); if (t >= STOCK_MIN_U - 1e-9) break; m *= (STOCK_MIN_U / t) * (1 + 1e-3); }
  }
  _modMemo.set(key, m);
  return m;
}

// One corner at `at` (x, y, z), the drive arriving along uIn and leaving along uOut (unit 3-vectors as {x,y,z}),
// bores [in, out]. Its blanks' axes point from the apex along each shaft: the inbound blank back along −uIn.
export function corner({ at, uIn, uOut, bores, teeth, templateModule, zCut, opening = true }) {
  const dot = uIn.x * uOut.x + uIn.y * uOut.y + (uIn.z || 0) * (uOut.z || 0);
  const deflDeg = Math.acos(Math.max(-1, Math.min(1, dot))) / DEG;
  const shaftAngleDeg = 180 - deflDeg;
  const module = cornerModule({ shaftAngleDeg, teeth, templateModule, bores });
  const spec = (b, mb) => G.bevelToothSpec({ module, teeth, mateTeeth: teeth, shaftAngleDeg, boreR: b, mateBoreR: mb, quiet: true });
  const sIn = spec(bores[0], bores[1]), sOut = spec(bores[1], bores[0]);
  const o = [at.x, at.y, at.z];
  const blanks = [
    { name: 'in', e: G.bevelBlankEnvelope(sIn), f: { o, a: [-uIn.x, -uIn.y, -(uIn.z || 0)] } },
    { name: 'out', e: G.bevelBlankEnvelope(sOut), f: { o, a: [uOut.x, uOut.y, uOut.z || 0] } },
  ];
  const pts = opening ? G.blanksPlanFootprint(blanks.map(({ e, f }) => ({ e, f })), zCut - CLEAR_MARGIN, CLEAR_MARGIN) : null;
  return { at, deflDeg, shaftAngleDeg, module, coneR: sIn.coneR, blanks, pts,
    r: pts ? Math.max(...pts.map(([x, y]) => Math.hypot(x - at.x, y - at.y))) : sIn.coneR + CLEAR_MARGIN };
}

// TODO 289 landing 2's block law on one leg, from apex a to apex b (3-vectors), radius r, between two corners.
// `endStation` holds the far block where the build already sites it (its centre's distance from a), walking only the near one.
export function legBearings({ a, b, r, corners, ldMin, wall, boreClear, endStation = null }) {
  const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const u = [(b.x - a.x) / L, (b.y - a.y) / L, (b.z - a.z) / L];
  const bore = r + boreClear, half = bore + wall, len = 2 * r * ldMin, circR = half * Math.SQRT2, m = CLEAR_MARGIN;
  const blanks = corners.flatMap((c) => c.blanks);
  const clear = (s) => blanks.every((bl) => G.revolvedBlankDiscClearance(bl.e, bl.f,
    { o: [a.x, a.y, a.z], a: u, r: circR, zLo: s - len / 2, zHi: s + len / 2 }, m).ok);
  const walk = (from, dir) => {
    let s = from;
    while (!clear(s)) { s += dir * m / 2; if (s - len / 2 < 0 || s + len / 2 > L) return null; }
    let lo = s - dir * m / 2, hi = s;
    if (lo - len / 2 >= 0 && lo + len / 2 <= L && clear(lo)) return s;
    for (let i = 0; i < 40 && Math.abs(hi - lo) > 1e-3; i++) { const mid = (lo + hi) / 2; if (clear(mid)) hi = mid; else lo = mid; }
    return hi;
  };
  const s0 = walk(len / 2, +1), s1 = endStation ?? walk(L - len / 2, -1);
  const fits = s0 !== null && s1 !== null && s1 - s0 >= len;
  return { L, len, half, bore, stations: [s0, s1], fits, spread: fits ? s1 - s0 : null,
    why: fits ? null : (s0 === null || s1 === null ? 'a block cannot clear its corner\'s blanks on this leg' : `the two blocks overlap (spread ${(s1 - s0).toFixed(3)} under ${len.toFixed(3)})`) };
}

// The search. Inputs are plain numbers; see the header for the rule.
export function solveTraverse({
  A, B, z, heldHeadingDeg, approachU, radii, dropBore, teeth, templateModule, zCut,
  ldMin, wall, boreClear, deflMinDeg, keepOuts = [], landMin, columns = [], bBlockFromB = null, discs = [], t1Max = Infinity,
  swingStepDeg = 0.25, swingMaxDeg = 40, t1Step = 0.25, hmStepDeg = 0.5,
}) {
  const [r1, rm, r3] = radii;
  const cap = (r) => 2 * r * TURN_LD_TARGET;
  const h3 = hdg(approachU);
  const P3 = (p) => ({ x: p.x, y: p.y, z });
  const u3 = (v) => ({ x: v.x, y: v.y, z: 0 });
  // the cheap plan tests first (lengths, deflections, columns, lands at the opening's circumscribed disc), the costly
  // ones (the exact footprints, the bearings) only for a candidate that passed them
  const discMemo = new Map();
  const discR = (deflDeg, bores) => { const k = `${Math.round(deflDeg * 4) / 4}|${bores}`;
    if (!discMemo.has(k)) { const d = Math.round(deflDeg * 4) / 4 * DEG;
      discMemo.set(k, corner({ at: { x: 0, y: 0, z }, uIn: { x: 1, y: 0, z: 0 }, uOut: { x: Math.cos(d), y: Math.sin(d), z: 0 }, bores, teeth, templateModule, zCut }).r); }
    return discMemo.get(k); };
  const discLand = (c, R) => Math.min(Infinity, ...keepOuts.map((k) => -G.pointConvexGap(k.pts, c.x, c.y) > 0 ? -Infinity : G.pointConvexGap(k.pts, c.x, c.y) - R));
  // a rod against the rotating members' swept discs it shares a band with: its axis a margin and both radii off each
  const rodDiscGap = (a, b, r) => Math.min(Infinity, ...discs.filter((d) => !(d.zHi < z - r || d.zLo > z + r)).map((d) => segPt(a, b, d) - (d.r + r + CLEAR_MARGIN)));
  // a corner's blanks against the same discs, by the certified revolved-envelope bound the build's fold obstacles use
  const blankDiscsOk = (c) => c.blanks.every((bl) => discs.every((d) => G.revolvedBlankDiscClearance(bl.e, bl.f,
    { o: [d.x, d.y, d.zLo], a: [0, 0, 1], r: d.r, zLo: 0, zHi: d.zHi - d.zLo }, CLEAR_MARGIN).ok));
  const colGap = (a, b, r) => Math.min(Infinity, ...columns.map((c) => segPt(a, b, c) - (c.r + r + CLEAR_MARGIN)));
  const swings = [0];
  for (let k = 1; k * swingStepDeg <= swingMaxDeg + 1e-9; k++) swings.push(k * swingStepDeg, -k * swingStepDeg);
  const tried = { swings: 0, plan: 0, exact: 0 };
  for (const g of swings) {
    tried.swings++;
    const h1 = heldHeadingDeg + g, e1 = dirOf(h1);
    let best = null;
    for (let t1 = t1Step; t1 <= Math.min(cap(r1), t1Max) + 1e-9; t1 += t1Step) {
      const K1 = { x: A.x + e1.x * t1, y: A.y + e1.y * t1 };
      for (let hm = h1 - 90; hm <= h1 + 90 + 1e-9; hm += hmStepDeg) {
        const d1 = Math.abs(wrap(hm - h1)), d2 = Math.abs(wrap(h3 - hm));
        if (d1 < deflMinDeg || d2 < deflMinDeg || d1 >= 90 || d2 >= 90) continue;
        const um = dirOf(hm), det = um.x * approachU.y - um.y * approachU.x;
        if (Math.abs(det) < 1e-9) continue;
        const sm = ((B.x - K1.x) * approachU.y - (B.y - K1.y) * approachU.x) / det;
        const K2 = { x: K1.x + um.x * sm, y: K1.y + um.y * sm };
        const s3 = (B.x - K2.x) * approachU.x + (B.y - K2.y) * approachU.y;
        if (!(sm > 0 && s3 > 0) || sm > cap(rm) || s3 > cap(r3)) continue;
        const col = Math.min(colGap(A, K1, r1), colGap(K1, K2, rm), colGap(K2, B, r3), rodDiscGap(K1, K2, rm), rodDiscGap(A, K1, r1));
        if (col < 0) continue;
        const land = Math.min(discLand(K1, discR(d1, [r1, rm])), discLand(K2, discR(d2, [rm, r3])));
        if (land < landMin) continue;
        tried.plan++;
        const slack = Math.min(col, land - landMin);
        if (best && slack <= best.slackPlan) continue;
        // exact: the corners as cut, their openings, and both legs' bearings
        tried.exact++;
        const cA = corner({ at: P3(A), uIn: { x: 0, y: 0, z: 1 }, uOut: u3(e1), bores: [dropBore, r1], teeth, templateModule, zCut });
        const c1 = corner({ at: P3(K1), uIn: u3(e1), uOut: u3(um), bores: [r1, rm], teeth, templateModule, zCut });
        const c2 = corner({ at: P3(K2), uIn: u3(um), uOut: u3(approachU), bores: [rm, r3], teeth, templateModule, zCut });
        const landOf = (c) => Math.min(Infinity, ...keepOuts.map((k) => G.convexGap(c.pts, k.pts)));
        const lands = { A: landOf(cA), K1: landOf(c1), K2: landOf(c2) };
        if (Math.min(lands.K1, lands.K2) < landMin) continue;
        if (!blankDiscsOk(c1) || !blankDiscsOk(c2) || !blankDiscsOk(cA)) continue;
        const legs = [
          legBearings({ a: P3(A), b: P3(K1), r: r1, corners: [cA, c1], ldMin, wall, boreClear }),
          legBearings({ a: P3(K1), b: P3(K2), r: rm, corners: [c1, c2], ldMin, wall, boreClear }),
          // leg 3 is the tail of today's leg 2: its B block stands where the build sites it, `bBlockFromB` from B
          legBearings({ a: P3(K2), b: P3(B), r: r3, corners: [c2], ldMin, wall, boreClear, endStation: bBlockFromB === null ? null : s3 - bBlockFromB }),
        ];
        if (!legs.every((l) => l.fits)) continue;
        best = { swingDeg: g, headingDeg: h1, t1, midHeadingDeg: hm, K1, K2, corners: { A: cA, K1: c1, K2: c2 }, lands, col, legs,
          lengths: [t1, sm, s3], ld: [t1 / (2 * r1), sm / (2 * rm), s3 / (2 * r3)], deflDeg: [d1, d2],
          slackPlan: slack, slack: Math.min(col, Math.min(lands.K1, lands.K2) - landMin) };
      }
    }
    if (best) return { feasible: true, ...best, tried, grid: { swingStepDeg, t1Step, hmStepDeg } };
  }
  return { feasible: false, why: `no swing of leg 1 within ±${swingMaxDeg}° gives two cuttable, turnable, borne corners clear of the keep-outs`, tried };
}
