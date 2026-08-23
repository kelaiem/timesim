// §136 Landing 0 — THE CYCLOIDAL PROFILE, PRICED BEFORE IT IS CUT.
//
// The entry's own instruction: measure the budget FIRST. This probe is the
// generator's mathematics prototyped standalone — pure node, no browser, no
// three.js — run over every gear-mesh row in the movement, answering the four
// questions Landing 2 must not discover late:
//
//   A. NESTING LEMMA — the multi-mate resolution's load-bearing claim. A
//      member's face is cut with the generating circle of its SMALLEST mate
//      (FACE_GEN_R = m·min(mates)/4). The claim: near the cusp an epicycloid
//      retreats from the radial flank faster for a smaller generating circle,
//      so the min-mates face lies strictly INSIDE every larger mate's exact
//      conjugate — every non-smallest mesh errs on the CLEARANCE side and
//      interference is impossible by construction. Verified numerically here
//      over the movement's actual multi-mate cases, not argued.
//   B. FEASIBILITY — the addendum/dedendum cascade (recess-first, capped by
//      the pointed tip) must reach the contact-ratio target on every mesh.
//      A mesh that cannot is a boot-warn-class design finding to face NOW.
//   C. VERTEX BUDGET — outline points per wheel at the derived chord error,
//      against today's ~8 points/tooth; the multiplier is what the battery
//      pricing run (task 2 of this landing) feeds on.
//   D. COLLATERAL — the tip-radius delta per wheel (gearOuterR's 11 consumers
//      are keep-out/footprint declarations that addenda GROWING toward
//      1.3–1.7·m will squeeze) and the alarm barrel's root-radius delta
//      (drumInnerR = max(rootR − 2.2·m, 0.3·radius), geometry.js:2894 — if
//      the cavity moves, §104's ribbon/set-up solve re-lands in Landing 2).
//
// Plus the GAUGE MATRIX: measuredToothPhase's silhouette logic (main.js:12105
// — 2048 bins, the π/N outline filter at :12143, the 10th/90th-percentile
// threshold at :12161) re-implemented over the NEW outline for every
// (module, count) a boot chain solve reads. A count the gauge refuses is a
// refused solveGearChain chain, which is a rule-6 boot regression — a hard
// gate on Landing 2, tested before any src/ file moves.
//
// DERIVED CONSTANTS (the same nine the generator's comment block will carry;
// Landing 1 moves them into gearToothSpec, this file is their first draft):
//   flank        radial (Willis degeneracy: gen circle R/2 inside the pitch
//                circle traces a diameter)
//   faceGenR     m·min(mates)/4  (nesting lemma → clearance-side elsewhere)
//   CR target    1 + 0.02 + 2ε/p  (carry-before-release + solveGearChain's
//                residual bar main.js:12302 + the tessellation spend)
//   h floor      0.05 + ε  (a mesh green on the centre-distance tripwire
//                main.js:12307 must still be engaged)
//   backlash     B = 0.02·p + 2ε; tooth thickness t = p/2 − B/2
//   dedendum     max(mates' addenda) + c, root clearance c = 0.05 + ε
//   root fillet  radius c, tangent flank ↔ root circle
//   tip          truncate at R+h; pointed cap at 95% of the face-meet height
//                (L0 heuristic — Landing 1 derives the round properly)
//   chord ε      half the phase instrument's guaranteed slack:
//                ε = 0.01·π·m  (chords of a convex face lie INSIDE the metal,
//                so tessellation errs clearance-side and spends only backlash
//                — the instrument anchor, deliberately NOT CLEAR_MARGIN)
//
// Run from tools/:  node probe-136-profile.mjs            (human table)
//                   node probe-136-profile.mjs --json     (machine payload)

// ---------------------------------------------------------------------------
// The mesh rows. Counts cited to their declarations; rows whose count is a
// RUNTIME SOLVE are marked solved:true with the shipped value, to be re-read
// from __clock.gearChains when Landing 2 exposes it — this table prices the
// design and does not pretend to be a registry (that is roadmap §135).
const R = (name, module, teeth, mates, note = '') => ({ name, module, teeth, mates, note });
const MEMBERS = [
  // going train — layout.js:514-531 (module derived at :526 from the held 16.2 centre)
  R('greatWheel',   0.25511811023622047, 120, [7],        'layout.js TRAIN.barrel'),
  R('centerPinion', 0.25511811023622047, 7,   [120],      'the 7-leaf, layout.js:526'),
  R('centerWheel',  0.30, 75,  [10],                      'TRAIN.center'),
  R('thirdPinion',  0.30, 10,  [75],                      ''),
  R('thirdWheel',   0.24, 80,  [10],                      'TRAIN.third'),
  R('fourthPinion', 0.24, 10,  [80],                      ''),
  R('fourthWheel',  0.21, 80,  [8],                       'RATE_TABLE[18000], layout.js:48'),
  R('escapePinion', 0.21, 8,   [80],                      ''),
  // reserve — main.js:10666-10673; rsvModule1 solved from the span (cd 8.7216)
  R('rsvP0',        0.34, 8,   [28],                      ''),
  R('rsvW1',        0.34, 28,  [8],                       ''),
  R('rsvP1',        1.0902, 10, [6],                      'rsvModule1 solved; cd 8.7216 = m(10+6)/2'),
  R('rsvW2',        1.0902, 6,  [10],                     'w2 = reserveHours/5 at the 30 h default'),
  // keyless / motion works — layout.js:534-545; NOT chain-solved (TODO 62's
  // runtime-offset chains) but cut by the same generator, so the cascade and
  // the vertex budget must cover them
  R('crownWheel',   0.34, 20,  [8, 18, 20, 24],           'mates: wind pinion, wind idler, transfer, spur'),
  R('windPinion',   0.34, 8,   [20],                      ''),
  R('windIdler',    0.34, 18,  [20, 24],                  'KW_WIND_IDLER_TEETH, layout.js:830'),
  R('windSpur',     0.34, 24,  [18],                      ''),
  R('settingWheel', 0.34, 20,  [8, 24],                   'mates: sliding pinion, minute wheel'),
  R('minuteWheel',  0.34, 24,  [20, 8],                   'mates: setting wheel, setting cap'),
  R('settingCap',   0.34, 8,   [24],                      ''),
  R('cannonPinion', 0.30, 10,  [30],                      'MW_MODULE_1'),
  R('mwMinute',     0.30, 30,  [10],                      ''),
  R('mwPinion',     0.30, 8,   [32],                      'MW_MODULE_2 ≈ 0.3 (solved from MW_CENTER_D); solved'),
  R('hourWheel',    0.30, 32,  [8],                       'solved module, same mesh'),
  // alarm — main.js:1964-2007, 10918-11006, 15818+, 13636, 14391
  R('alarmSetW',    0.30, 30,  [28],                      'ALARM_SET_WHEEL_TEETH'),
  R('alarmI1',      0.30, 28,  [30, 37],                  'meshes the setting wheel AND i2'),
  R('alarmI2',      0.30, 37,  [28],                      ''),
  R('alarmI1b',     0.2569, 28, [30],                     'ALARM_BRANCH_MODULE (solved); ⇄ disc rim 30'),
  R('alarmDisc',    0.2569, 30, [28],                     ''),
  R('strikingW',    0.22, 64,  [8],                       'ALARM_GOV_WHEEL_TEETH'),
  R('govPinion',    0.22, 8,   [64],                      ''),
  R('climbPinion',  0.30, 12,  [51],                      'ALARM_WIND_PINION_TEETH'),
  R('windIdlerA1',  0.30, 51,  [12, 51],                  'ALARM_WIND_IDLER_TEETH (solved ≥18; shipped 51)'),
  R('windIdlerA2',  0.30, 51,  [51, 44],                  ''),
  R('alarmArborW',  0.30, 44,  [51, 11],                  'ALARM_WIND_W; mates: idler2 AND leg A pinion'),
  R('alarmBarrel',  0.30, 44,  [11, 18],                  'rim; mates: striking pinion AND arrest idler wheel (solved)'),
  R('strikePinion', 0.30, 11,  [44],                      'ALARM_STRIKE_PINION_TEETH'),
  R('legAPinion',   0.30, 11,  [44],                      'SUB_LEG_TEETH (solved; shipped 11)'),
  R('subIdlerW',    0.30, 18,  [44],                      'SUB_IDLER_SOLVED (solved; ~gauge floor)'),
  R('cageWheel',    0.20, 22,  [11],                      'SUB_OUT_TEETH = 2·SUB_LEG'),
  R('fingerPinion', 0.20, 11,  [22],                      'SUB_FINGER/ARREST_PINION_TEETH'),
];
// The mesh list (pairs of member names) — used for contact-ratio accounting
// and the gauge matrix. One row per physical mesh the movement carries in the
// generator's population (bevels excluded by the owner's scope decision).
const MESHES = [
  ['greatWheel', 'centerPinion'], ['centerWheel', 'thirdPinion'],
  ['thirdWheel', 'fourthPinion'], ['fourthWheel', 'escapePinion'],
  ['rsvP0', 'rsvW1'], ['rsvP1', 'rsvW2'],
  ['crownWheel', 'windPinion'], ['crownWheel', 'windIdler'], ['windIdler', 'windSpur'],
  ['settingWheel', 'minuteWheel'], ['minuteWheel', 'settingCap'],
  ['cannonPinion', 'mwMinute'], ['mwPinion', 'hourWheel'],
  ['alarmSetW', 'alarmI1'], ['alarmI1', 'alarmI2'], ['alarmI1b', 'alarmDisc'],
  ['strikingW', 'govPinion'],
  ['climbPinion', 'windIdlerA1'], ['windIdlerA1', 'windIdlerA2'], ['windIdlerA2', 'alarmArborW'],
  ['alarmBarrel', 'strikePinion'], ['alarmArborW', 'legAPinion'], ['alarmBarrel', 'subIdlerW'],
  ['cageWheel', 'fingerPinion'],
];

// ---------------------------------------------------------------------------
// The derived constants, per module.
const pitchOf = (m) => Math.PI * m;                    // circular pitch
const epsOf = (m) => 0.01 * Math.PI * m;               // chord budget ε = B_inst/2
const backlashOf = (m) => 0.02 * pitchOf(m) + 2 * epsOf(m);
const clearOf = (m) => 0.05 + epsOf(m);                // root clearance c
const hFloorOf = (m) => 0.05 + epsOf(m);               // engagement floor
const crTargetOf = (m) => 1 + 0.02 + (2 * epsOf(m)) / pitchOf(m);

// ---------------------------------------------------------------------------
// Epicycloid: generating circle radius rho rolling OUTSIDE a pitch circle
// radius R, cusp on the pitch circle at azimuth 0. psi is the angle of the
// generating circle's centre about the wheel's centre.
const epi = (R, rho, psi) => {
  const k = (R + rho) / rho;
  const x = (R + rho) * Math.cos(psi) - rho * Math.cos(k * psi);
  const y = (R + rho) * Math.sin(psi) - rho * Math.sin(k * psi);
  return [x, y, Math.hypot(x, y) - R, Math.atan2(y, x)]; // [x, y, height over pitch, azimuth]
};
// Invert height → psi by bisection (monotone until the curve tops out at 2·rho).
const psiAtHeight = (R, rho, h) => {
  if (h <= 0) return 0;
  let lo = 0, hi = Math.PI * rho / (R + rho); // half a generating revolution — beyond any tooth
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (epi(R, rho, mid)[2] < h) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
};
// Azimuthal retreat of the face from its own cusp at height h — the nesting
// lemma's comparator, and the pointed-tip solver's input.
const retreatAt = (R, rho, h) => epi(R, rho, psiAtHeight(R, rho, h))[3];

// Arc of action contributed by one face of height h working on the contact
// circle rho (the circle that generated it): the rolled pitch arc when contact
// leaves the addendum circle. Law of cosines on centre–genCentre–contact.
const actionArc = (R, rho, h) => {
  if (h <= 0) return 0;
  const num = (R + rho) ** 2 + rho ** 2 - (R + h) ** 2;
  const den = 2 * rho * (R + rho);
  const c = num / den;
  if (c <= -1) return rho * Math.PI;          // face outreaches the whole circle
  if (c >= 1) return 0;
  return rho * Math.acos(c);
};

// ---------------------------------------------------------------------------
// The cascade: solve every member's addendum against every mesh's CR target.
const M = Object.fromEntries(MEMBERS.map((g) => [g.name, g]));
for (const g of MEMBERS) {
  g.Rp = (g.module * g.teeth) / 2;                       // pitch radius
  g.faceGenR = (g.module * Math.min(...g.mates)) / 4;    // min-mates Willis
  g.eps = epsOf(g.module);
  g.halfThickAng = ((pitchOf(g.module) / 2 - backlashOf(g.module) / 2) / 2) / g.Rp; // (t/2)/R
  // pointed-tip height: faces meet when retreat = halfThickAng; cap at 95%.
  let lo = 0, hi = 2 * g.faceGenR;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (retreatAt(g.Rp, g.faceGenR, mid) < g.halfThickAng) lo = mid; else hi = mid;
  }
  g.hPoint = (lo + hi) / 2;
  g.hCap = 0.95 * g.hPoint;
  g.h = Math.min(hFloorOf(g.module), g.hCap);            // start at the floor
}
// three passes to fixpoint: grow the LARGER member first (recess-first — the
// wheel's face carries what it can), then the smaller.
const meshRows = [];
for (let pass = 0; pass < 3; pass++) {
  for (const [a, b] of MESHES) {
    const X = M[a].teeth >= M[b].teeth ? M[a] : M[b];    // wheel
    const Y = X === M[a] ? M[b] : M[a];                  // pinion
    const p = pitchOf(X.module);
    const target = crTargetOf(X.module) * p;
    const arc = () => actionArc(X.Rp, X.faceGenR, X.h) + actionArc(Y.Rp, Y.faceGenR, Y.h);
    if (arc() < target) {                                 // grow wheel face first
      let lo = X.h, hi = X.hCap;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2; X.h = mid;
        if (arc() < target) lo = mid; else hi = mid;
      }
      X.h = Math.min(hi, X.hCap);
    }
    if (arc() < target) {                                 // remainder from the pinion
      let lo = Y.h, hi = Y.hCap;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2; Y.h = mid;
        if (arc() < target) lo = mid; else hi = mid;
      }
      Y.h = Math.min(hi, Y.hCap);
    }
    if (pass === 2) meshRows.push({
      mesh: `${X.name} ⇄ ${Y.name}`, module: X.module,
      cr: arc() / p, target: target / p,
      hWheel: X.h, hPinion: Y.h,
      feasible: arc() >= target - 1e-9,
    });
  }
}
for (const g of MEMBERS) {
  g.ded = Math.max(...g.mates.map((n) => {
    // dedendum clears the DEEPEST mate addendum; find mates by tooth count
    // within this member's own meshes (names not needed for the depth).
    const mate = MEMBERS.find((o) => o.teeth === n && o.module === g.module && o !== g)
      ?? MEMBERS.find((o) => o.teeth === n && Math.abs(o.module - g.module) < 1e-6);
    return mate ? mate.h : hFloorOf(g.module);
  })) + clearOf(g.module);
}

// ---------------------------------------------------------------------------
// A. Nesting lemma over the multi-mate members: the min-mates face must show
// retreat ≥ the retreat of every larger mate's exact-conjugate face at every
// height (bigger retreat = thinner tooth = clearance side).
const lemma = [];
for (const g of MEMBERS.filter((x) => x.mates.length > 1)) {
  const rhoMin = g.faceGenR;
  for (const n of g.mates) {
    const rho = (g.module * n) / 4;
    if (rho === rhoMin) continue;
    let worst = 0;
    for (let i = 1; i <= 40; i++) {
      const h = (g.h * i) / 40;
      const d = retreatAt(g.Rp, rhoMin, h) - retreatAt(g.Rp, rho, h);
      if (d < worst) worst = d;                          // negative = lemma VIOLATED
    }
    // clearance at the pitch line, in real units, for the report
    const clearU = (retreatAt(g.Rp, rhoMin, g.h) - retreatAt(g.Rp, rho, g.h)) * g.Rp;
    lemma.push({ member: g.name, mate: n, holds: worst >= -1e-12, clearU: +clearU.toFixed(4) });
  }
}

// ---------------------------------------------------------------------------
// C. Outline vertex counts at ε — the new outline, per tooth:
//   root arc (edges < π/(2N) azimuth) + fillet (2 pts) + radial flank (1 seg)
//   + face sampled to sagitta ≤ ε + tip land/round — versus today's 8.
const outlinePts = (g) => {
  const N = g.teeth, Rp = g.Rp, eps = g.eps;
  // face: adaptive sampling by curvature — walk psi, split until sagitta ≤ ε
  const facePts = (() => {
    const psiTop = psiAtHeight(Rp, g.faceGenR, g.h);
    let pts = 1, psiPrev = 0;
    // march with a step that keeps chord sagitta under ε: local radius of
    // curvature of an epicycloid ~ 4·rho·sin(k·psi/2)/(k+2)-ish; do it
    // numerically — double the step count until every chord passes.
    for (let segs = 2; segs <= 64; segs *= 2) {
      let ok = true;
      for (let i = 0; i < segs; i++) {
        const a = epi(Rp, g.faceGenR, (psiTop * i) / segs);
        const b = epi(Rp, g.faceGenR, (psiTop * (i + 1)) / segs);
        const mid = epi(Rp, g.faceGenR, (psiTop * (i + 0.5)) / segs);
        // sagitta = distance from mid to the chord ab
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L = Math.hypot(dx, dy) || 1;
        const s = Math.abs((mid[0] - a[0]) * dy - (mid[1] - a[1]) * dx) / L;
        if (s > eps) { ok = false; break; }
      }
      if (ok) { pts = segs; break; }
      pts = segs;
    }
    return pts;
  })();
  const rootSpanAng = (2 * Math.PI) / N - 2 * g.halfThickAng - 2 * (clearOf(g.module) / Rp);
  const rootPts = Math.max(2, Math.ceil(rootSpanAng / (Math.PI / (2 * N))));
  const tipPts = 3;                                       // land or round, both small
  return 2 * (1 /*flank*/ + facePts + 2 /*fillet*/) + rootPts + tipPts;
};
let oldTotal = 0, newTotal = 0;
const vertexRows = MEMBERS.map((g) => {
  const per = outlinePts(g);
  oldTotal += 8 * g.teeth; newTotal += per * g.teeth;
  return { name: g.name, teeth: g.teeth, ptsPerTooth: per, outlineOld: 8 * g.teeth, outlineNew: per * g.teeth };
});

// ---------------------------------------------------------------------------
// D. Collateral: tip and root deltas.
const OLD_ADD = { wheel: 0.95, pinion: 0.85 };            // geometry.js:369 / :445
const TIP_RELIEF = 1.02;                                  // geometry.js:250
const tipRows = MEMBERS.map((g) => {
  const kind = g.teeth <= 12 ? 'pinion' : 'wheel';
  const oldTip = (g.Rp + g.module * OLD_ADD[kind]) * TIP_RELIEF; // gearOuterR form
  const newTip = g.Rp + g.h;                              // no relief hull on a real face
  return { name: g.name, oldOuterR: +oldTip.toFixed(3), newOuterR: +newTip.toFixed(3),
    deltaU: +(newTip - oldTip).toFixed(3) };
});
// alarm barrel cavity (geometry.js:2892-2894): radius param = ALARM_BARREL_PITCH_R
const bar = M.alarmBarrel;
const bRootOld = bar.Rp - bar.module * 1.15;
const bRootNew = bar.Rp - bar.ded;
const drumOld = Math.max(bRootOld - bar.module * 2.2, 0.3 * bar.Rp);
const drumNew = Math.max(bRootNew - bar.module * 2.2, 0.3 * bar.Rp);

// ---------------------------------------------------------------------------
// GAUGE MATRIX — measuredToothPhase re-implemented over the new outline.
const gaugeRead = (g) => {
  const N = g.teeth, Rp = g.Rp, BINS = 2048;
  // Build the closed outline polyline (world = wheel frame, tooth 0 at az 0).
  const pts = [];
  const rootR = Rp - g.ded, tipR = Rp + g.h;
  const psiTop = psiAtHeight(Rp, g.faceGenR, g.h);
  const faceSegs = Math.max(4, Math.min(64, outlinePts(g)));
  for (let i = 0; i < N; i++) {
    const c = (2 * Math.PI * i) / N;
    const th = g.halfThickAng;
    // right fillet+flank up
    pts.push([rootR, c - th - clearOf(g.module) / Rp]);
    pts.push([rootR + clearOf(g.module), c - th]);
    pts.push([Rp, c - th]);
    // right face rising, curling toward centre
    for (let k = 1; k <= faceSegs; k++) {
      const e = epi(Rp, g.faceGenR, (psiTop * k) / faceSegs);
      pts.push([Rp + e[2], c - th + e[3]]);
    }
    // tip land (may be a point)
    const topAz = retreatAt(Rp, g.faceGenR, g.h);
    pts.push([tipR, c - th + topAz]);
    pts.push([tipR, c + th - topAz]);
    // left face descending (mirror)
    for (let k = faceSegs; k >= 1; k--) {
      const e = epi(Rp, g.faceGenR, (psiTop * k) / faceSegs);
      pts.push([Rp + e[2], c + th - e[3]]);
    }
    pts.push([Rp, c + th]);
    pts.push([rootR + clearOf(g.module), c + th]);
    pts.push([rootR, c + th + clearOf(g.module) / Rp]);
    // root land arc to the next tooth, sampled under π/(2N) azimuth per edge
    const a0 = c + th + clearOf(g.module) / Rp;
    const a1 = c + (2 * Math.PI) / N - th - clearOf(g.module) / Rp;
    const segs = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / (2 * N))));
    for (let k = 1; k < segs; k++) pts.push([rootR, a0 + ((a1 - a0) * k) / segs]);
  }
  // rasterise edges into bins with the π/N filter (main.js:12143's logic)
  const Rb = new Float64Array(BINS).fill(0);
  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  for (let i = 0; i < pts.length; i++) {
    const [r1, a1r] = pts[i], [r2, a2r] = pts[(i + 1) % pts.length];
    let d = norm(a2r) - norm(a1r);
    if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > Math.PI / N) continue;              // the outline filter
    const steps = Math.max(1, Math.ceil(Math.abs(d) / ((2 * Math.PI) / BINS)));
    for (let s = 0; s <= steps; s++) {
      const a = norm(a1r) + (d * s) / steps;
      const r = r1 + ((r2 - r1) * s) / steps;
      const k = Math.min(BINS - 1, Math.floor((norm(a) / (2 * Math.PI)) * BINS));
      if (r > Rb[k]) Rb[k] = r;
    }
  }
  // 10/90 threshold + run count (main.js:12149-12185's logic)
  const filled = [];
  for (let k = 0; k < BINS; k++) if (Rb[k] > 0) filled.push(Rb[k]);
  if (filled.length < BINS / 4) return { gaps: 0, conf: 0, note: 'sparse' };
  filled.sort((a, b) => a - b);
  const lo = filled[Math.floor(filled.length * 0.1)];
  const hi = filled[Math.floor(filled.length * 0.9)];
  const mid = (lo + hi) / 2;
  for (let k = 0; k < BINS; k++) if (Rb[k] === 0) Rb[k] = lo;
  const centres = [];
  let runStart = -1;
  for (let k = 0; k < 2 * BINS; k++) {
    const low = Rb[k % BINS] < mid;
    if (low && runStart < 0) runStart = k;
    if (!low && runStart >= 0) {
      if (k <= BINS || runStart >= BINS) { /* count each run once */ }
      if (runStart < BINS) centres.push(((runStart + k - 1) / 2) % BINS);
      runStart = -1;
    }
  }
  // fold into one pitch, circular resultant = confidence
  let sx = 0, sy = 0;
  for (const cbin of centres) {
    const a = ((cbin / BINS) * 2 * Math.PI * N) % (2 * Math.PI);
    sx += Math.cos(a); sy += Math.sin(a);
  }
  const conf = centres.length ? Math.hypot(sx, sy) / centres.length : 0;
  return { gaps: centres.length, conf: +conf.toFixed(3) };
};
const gaugeRows = MEMBERS.map((g) => {
  const r = gaugeRead(g);
  return { name: g.name, teeth: g.teeth, module: g.module, gaps: r.gaps, conf: r.conf,
    credible: r.gaps === g.teeth && r.conf > 0.9 };
});

// ---------------------------------------------------------------------------
// Report.
const json = process.argv.includes('--json');
const infeasible = meshRows.filter((r) => !r.feasible);
const lemmaFail = lemma.filter((l) => !l.holds);
const gaugeFail = gaugeRows.filter((r) => !r.credible);
// FINDING worth naming before Landing 1: pinion addenda land near the floor
// (~0.2·m against today's 0.85·m house number) because recess-first satisfies
// the contact ratio almost entirely from the wheel faces. Horologically
// defensible — recess-only action is the classical low-friction ideal, and
// the entry's own text derives the addendum from need, not convention — but
// pinion teeth will read visibly STUBBIER than the current render. The split
// rule as implemented is larger-member-first, which equals recess-first in
// the POWER direction; two-way trains (reserve, keyless) accept approach
// action in their second direction exactly as real trains do. Judge the look
// against a render in Landing 1 before deciding whether appearance earns a
// named constraint of its own.
const pinionStubs = MEMBERS.filter((g) => g.teeth <= 12 && g.h < 0.5 * g.module)
  .map((g) => ({ name: g.name, h_over_m: +(g.h / g.module).toFixed(2) }));
const out = {
  lemma, meshRows, vertexRows, tipRows, pinionStubs,
  barrel: { rootOld: +bRootOld.toFixed(3), rootNew: +bRootNew.toFixed(3),
    drumInnerOld: +drumOld.toFixed(3), drumInnerNew: +drumNew.toFixed(3),
    cavityMoves: Math.abs(drumNew - drumOld) > 1e-6 },
  gaugeRows,
  totals: { outlineOld: oldTotal, outlineNew: newTotal, multiplier: +(newTotal / oldTotal).toFixed(2) },
  gates: { lemmaHolds: lemmaFail.length === 0, allFeasible: infeasible.length === 0,
    gaugeAllCredible: gaugeFail.length === 0 },
};
if (json) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

console.log('=== A. nesting lemma (multi-mate members) ===');
for (const l of lemma) console.log(`  ${l.member} vs mate ${l.mate}t: ${l.holds ? 'HOLDS' : 'VIOLATED'} (pitch-line clearance ${l.clearU} u)`);
console.log('\n=== B. cascade: contact ratio per mesh ===');
for (const r of meshRows) console.log(`  ${r.mesh.padEnd(30)} m ${String(r.module).slice(0, 6).padEnd(7)} CR ${r.cr.toFixed(3)} vs ${r.target.toFixed(3)} ` +
  `hW ${r.hWheel.toFixed(3)} hP ${r.hPinion.toFixed(3)} ${r.feasible ? '' : '  ✗ INFEASIBLE'}`);
console.log('\n=== C. vertex budget ===');
console.log(`  outline points: ${oldTotal} → ${newTotal}  (×${(newTotal / oldTotal).toFixed(2)})`);
console.log('\n=== D. collateral ===');
const grown = tipRows.filter((t) => Math.abs(t.deltaU) > 0.05);
for (const t of grown) console.log(`  ${t.name.padEnd(14)} outerR ${t.oldOuterR} → ${t.newOuterR}  (Δ ${t.deltaU})`);
console.log(`  alarm barrel root ${out.barrel.rootOld} → ${out.barrel.rootNew}; drumInnerR ${out.barrel.drumInnerOld} → ${out.barrel.drumInnerNew}` +
  (out.barrel.cavityMoves ? '  ⚠ CAVITY MOVES — §104 re-solve is in Landing 2\'s scope' : '  (cavity held by the 0.3·radius floor)'));
console.log('\n=== gauge matrix ===');
for (const r of gaugeRows.filter((x) => !x.credible)) console.log(`  ✗ ${r.name} (${r.teeth}t m${r.module}): gaps ${r.gaps}, conf ${r.conf}`);
console.log(`  ${gaugeRows.filter((x) => x.credible).length}/${gaugeRows.length} credible`);
console.log('\n=== gates ===');
console.log(`  lemma: ${out.gates.lemmaHolds ? 'PASS' : 'FAIL'} · cascade: ${out.gates.allFeasible ? 'PASS' : 'FAIL'} · gauge: ${out.gates.gaugeAllCredible ? 'PASS' : 'FAIL'}`);
