// Mechanical Clock Simulation — LAYOUT SPEC (BUILT §13, step 1).
//
// The movement's geometry is genuinely parametric — barrel at the origin,
// everything stepped off it through real wheel radii — but for most of the
// project that parametricity lived tangled in `main.js`'s evaluation order:
// 6,400 lines of module-level `const` where a number could not be moved
// without knowing everything downstream of its line. §13 untangles that into
// a pure data module the builders CONSUME. This file is the first slice: the
// constants that were already pure — no `THREE`, no `scene`, no solved
// positions, just numbers DERIVED from constraints with the constraint in the
// comment. Everything here is exported as plain data; nothing here builds or
// mutates anything.
//
// Rule as this module grows: a value belongs here iff it can be computed from
// literals and other values in this file alone. The moment it needs a wheel's
// measured bounding box or a solved position it stays in `main.js` (for now —
// later steps of §13 pull the solve out too, into a `solveLayout(spec)` this
// file will host). The geometry fingerprint (`inspect.js`) guards the move: a
// pure relocation of these definitions must not change a single part's world
// position, so the hash is identical before and after.

// ---------------------------------------------------------------------------
// Kinematic constants (see SPEC.md "Gear train" + "Escapement behavior")
// ---------------------------------------------------------------------------
export const F_BALANCE = 2.5;           // Hz — balance oscillation frequency
export const BEAT_DEG = 12;             // escape-wheel advance per beat (half of 24° tooth pitch)
export const AMPLITUDE_TRUE_DEG = 270;  // "true" balance swing (physical reference, unused for mesh)
export const AMPLITUDE_VISUAL_DEG = 45; // scaled-down, readable swing actually applied to the mesh
export const IMPULSE_WIDTH = 0.16;      // fraction of a beat spent in unlock+impulse (rest = locked)
export const RECOIL_FRACTION = 0.25;    // portion of the impulse window spent on the recoil/draw dip
export const RECOIL_DEG = 1.0;          // escape wheel recoil during draw
// FORK_BANK_DEG / FORK_RECOIL_DEG are DERIVED in main.js (after the pallet
// fork and balance geometry exist), from rollerR and the notch's actual
// reach — see that derivation for why they can't be picked independently of
// the balance's roller radius without the impulse pin missing the notch. They
// are NOT pure, so they stay there.

// ---------------------------------------------------------------------------
// Z-stack — the depth budget between the back plate (z≈0) and the cocks. Each
// arbor's PINION sits at the layer where it meshes with the PREVIOUS wheel;
// its own WHEEL sits one layer further along, where the NEXT pinion meshes it.
// TORNADO Z-stack — compressed to a 1.7-unit wheel stride (the old uniform
// 3-unit staircase was half air). The three offsets expressed as formulas
// are real mechanical constraints, not styling:
//  · L_FORK = L_ESCAPE + 1.5 — the fork body's underside just clears the
//    escape wheel's top face while the stones (stoneZReach below) straddle
//    the tooth band;
//  · L_BALANCE — the balance now sits IN the three-quarter plate's z-band
//    (the classic Glashütte elevation: rim level with the plate, swinging in
//    the cutaway), derived below so its rim's underside binds exactly one
//    CLEAR_MARGIN above the fork body's top face;
//  · L_HAIRSPRING and the flat balance cock ride the balance.
// Stride 2.1 is the floor set by the BRIDGES, not the wheels: each cock is
// a centred slab ±(width·0.2 + bevel) thick, and it must fit between its
// own wheel pair's planes and the next wheel up that crosses it (solved:
// feasible only for stride ≥ ~2.06 at the current cock widths).
// ---------------------------------------------------------------------------
// §39 — the unit→mm mapping. PINNED, not chosen.
//
// The tempting definition is "pick the scale that puts the case under 40 mm".
// That is circular: it makes the size target true by construction and tests
// nothing. Instead the scale is pinned to the one dimension in this movement
// that is a MANUFACTURED STANDARD rather than a style choice — fusee chain
// pitch. Real fusee chain is made to ~0.30 mm rivet-to-rivet and the tolerance
// on it is narrow, because it has to run in a groove cut to match.
//
// Everything else about the movement's real size is then a PREDICTION, and is
// asserted as one at the end of the build. Those asserts are allowed to fail;
// that is the whole point of deriving the scale from something else first.
//
// Cross-check, from a completely independent direction: §2's mapping study
// proposed ~0.38 mm/unit by eye from overall proportions. This lands at
// 0.375. Two methods agreeing to within 1.5% is the argument for the number.
export const CHAIN_PITCH = 0.8;        // units, rivet-to-rivet (geometry)
export const CHAIN_PITCH_MM = 0.30;    // REAL fusee chain — the manufactured standard this pins to
export const UNIT_MM = CHAIN_PITCH_MM / CHAIN_PITCH;   // 0.375 mm per unit
export const MM = (units) => units * UNIT_MM;          // for readouts and asserts

export const CLEAR_MARGIN = 0.15; // ONE structural margin — shared by the plate
                                  // z-stack and the hack solvers, and by
                                  // the balance plane derivation itself.
// RESTRIDDEN STACK — solved BOTTOM-UP from the low-escapement layout: the
// oscillator hangs under the open plate cutaway, and the plate's own floor
// binds on the hairspring stack (the fusee was dropped to make that true —
// see FUSEE_BASE_Z). Chain, with the slim balance: L_FORK/L_ESCAPE 4.5 →
// L_BALANCE ≈ 5.94 → spring top ≈ 7.56 → cock underside = plate floor
// ≈ 7.71 (wheels that XY-overlap must never share z; each step is
// half-thickness sums + the one margin).
export const L_BARREL = 2;     // great-wheel plane (meshes center pinion) — fixed: drum/fusee/chain ride this side
// Center wheel dropped onto its own bind: one margin over the great wheel's
// top face, at the wheel's deepest feature (its hub ring, thickness·1.5/2 =
// 0.75 below the mid-plane). The old 4.85 carried ~1.2 of slack left over
// from the nest-under-the-escape era — slack the fusee now needs: the
// chain's lowest span must clear THIS wheel's top face, and every 0.1 here
// is 0.1 the cone (and with it the whole plate stack) cannot drop.
export const L_CENTER = (L_BARREL + 0.7 + 0.08) + CLEAR_MARGIN + 0.75;
export const L_THIRD = 5.95;   // = L_FOURTH − (fourth 0.4 + margin + third 0.45)
export const L_FOURTH = 6.95;
// ESCAPE WHEEL BELOW THE FOURTH WHEEL — the low-escapement layout: the
// wheel drops under the whole train while its pinion stays up in the
// fourth wheel's plane (the arbor spans the gap). The ceiling is the
// fourth arbor's PINION, which meshes the third wheel at L_THIRD and
// spans 5.15..6.75: escape wheel top (L + 0.4) stays 0.25 under it.
// Below, its own neighbourhood is clear: the nearest train discs
// (center, third) are 19+ away in XY, and the fourth arbor is bare
// staff at this depth.
export const L_ESCAPE = 4.5;
export const FORK_T = 1.2;     // pallet-fork body thickness (= makePalletFork's `thickness`)
// FORK INLINE WITH THE WHEEL: one shared plane, the way a real lever
// escapement is built — the stones engage in the fork's own z-band
// (stoneZReach = 0) instead of reaching down 1.5. The fork's outline
// clears the wheel disc everywhere except the stones (arms straddle
// outside the rim; the belly stays a full radius below it), so
// coplanarity costs nothing laterally and buys the whole stone reach
// in depth — which the balance, spring and cock all inherit.
export const L_FORK = L_ESCAPE;
export const BAL_T = 2.5;              // balance thickness (= makeBalanceWheel's `thickness`)
export const RIM_H = BAL_T * 0.55;     // rim height — mirrors makeBalanceWheel's 0.55·t rim
// Balance mid-plane: fork body top (L_FORK + FORK_T/2) + margin + half the
// rim's own height. The rim's underside is the balance's deepest full-ring
// face, so this is the lowest the wheel can sit without fouling the fork.
// With the low escapement it lands FAR BELOW the plate band — the whole
// oscillator now lives in open air under the plate's cutaway.
export const L_BALANCE = L_FORK + FORK_T / 2 + CLEAR_MARGIN + RIM_H / 2;
// Impulse-pin world mid-plane — inside the fork's z-band, VERIFIED by the
// collision audit; it is pinned to the FORK, not the balance, and must not
// move when L_BALANCE does. makeBalanceWheel takes the wheel-centre→pin
// distance as `pinDrop` so the caller can hold this plane exactly.
export const PIN_PLANE_Z = L_FORK - 0.5;
export const L_HAIRSPRING = L_BALANCE + 1.2;
export const HAIRSPRING_H = 0.6;   // makeHairspring height (its stud/terminal top out ≈0.7·H above mid-plane)
// BALANCE COCK: a LOW bridge riding one margin over the hairspring
// stack, wherever that stack lands — with the low escapement that is
// ~4 under the three-quarter plate's band, so the cock (and the
// free-sprung dress on its face) stands entirely clear of the plate: no
// nesting, no shared band, no collision. The plate keeps its cutaway
// purely for the view of the oscillator below.
export const COCK_T = 0.8;
export const SPRING_TOP_Z = L_HAIRSPRING + HAIRSPRING_H * 0.7; // stud (0.6·H), terminal (0.55·H + ribbon)
export const COCK_SLAB_BOT = SPRING_TOP_Z + CLEAR_MARGIN;
export const COCK_SLAB_TOP = COCK_SLAB_BOT + COCK_T;
export const COCK_MID_Z = COCK_SLAB_BOT + COCK_T / 2;
// Dial plane (watch front, −z side). Part of the same depth budget: the
// motion-works crossing (Z_SETTING), reserve train (Z_RSV) and cannon pinion
// all pack between the plate's back face (−2) and this.
export const Z_DIAL = -7;
// KEYLESS PLANE — the stem/clutch/setting-wheel plane, on the DIAL SIDE of
// the base plate as in a real watch (it used to ride atop the barrel on the
// movement side). Bracketed by two binds and set mid-band:
//  · ceiling: the sliding pinion's axis lies ALONG the stem, so its z-reach
//    is its outer RADIUS (pitch 1.36 + addendum ≈ 1.79); that stack must
//    clear the plate's flat underside (−2) by CLEAR_MARGIN →
//    Z_KEYLESS ≤ −2 − 0.15 − 1.79 = −3.94.
//  · floor: the yoke rides below the plane (its arm passes under the
//    sliding pinion's hub collars, r 1.2) and its pivot boss must clear the
//    dial face (Z_DIAL) by the margin → Z_KEYLESS ≥ −7 + 0.15 + 0.75
//    (boss half) + 1.91 (yoke drop, see Z_YOKE) = −4.19.
export const Z_KEYLESS = -4.1;

// ---------------------------------------------------------------------------
// Train ratios — the "ratios" third of the eventual solveLayout output. Tooth
// counts and modules per mesh: pure literals, the single source §22 (custom
// beat rate) needs to re-derive counts. The going train's counts exist to make
// the FOURTH wheel turn once per minute at F_BALANCE, so a different beat means
// re-solving THESE, not editing an angle somewhere downstream — which is the
// whole reason they want to live together as data. (SPEC.md's gear table is
// the prose version of this object.)
//
// Each entry is one MESH: a wheel of `teeth` driving a pinion of `pinion`
// teeth at `module` (the arrow in the comment). §13 step 3c retired the old
// flat names (barrelTeeth … fourthTeeth) and folded the pinion counts in —
// they used to be magic 10s and an 8 repeated in BOTH the pinion builders
// and tick()'s ratio chain; now builders and kinematics read this one table,
// so a ratio literally cannot disagree with the geometry that carries it.
export const TRAIN = {
  barrel: { module: 0.36, teeth: 80, pinion: 10 }, // great wheel → center pinion
  center: { module: 0.30, teeth: 75, pinion: 10 }, // center wheel → third pinion
  third:  { module: 0.24, teeth: 80, pinion: 10 }, // third wheel → fourth pinion
  fourth: { module: 0.21, teeth: 80, pinion: 8 },  // fourth wheel → escape pinion
};

// Keyless works + winding path (the SETTING side, not the going train).
export const KW_MODULE = 0.34;
export const crownWheelTeeth = 20, windPinionTeeth = 8, settingWheelTeeth = 20;
export const minuteWheelTeeth = 24, minutePinionTeeth = 8;
export const WIND_SPUR_TEETH = 24;

// Motion works — the 12:1 hour reduction. cannon → minute wheel, then minute
// pinion → hour wheel; the ratio falls out of the counts (see main.js), it is
// not asserted.
export const cannonPinionTeeth = 10;
export const MW_MODULE_1 = 0.3;                                 // cannon ⇄ minute wheel
export const MW_MINUTE_TEETH = 30, MW_PINION_TEETH = 8, MW_HOUR_TEETH = 32;

// ---------------------------------------------------------------------------
// Planar layout inputs — the "positions" the tornado solve steps off. These
// are the pure ANGLES and one distance that decide where each arbor lands;
// the solve that consumes them (stepPos / the two-bar third-wheel solve /
// shift) is still interleaved in main.js and comes out in step 3. Editing one
// of these is how "move the crown to 3 o'clock" will eventually be a one-line
// change — once the solve reads a spec instead of module scope.
export const BARREL_STEP_DEG = -35;        // center sits down-right of barrel → barrel/crown exit viewed ~1:50
export const D4 = 15.5;                     // centre → fourth distance (small-seconds pivot radius, ≈0.39·dialRadius)
export const ESCAPE_STEP_DEG = -57.9;      // escape at viewed ~6:25
export const BALANCE_STEP_TARGET_DEG = 44.6; // balance at viewed ~8:00 — a TARGET; the feasible angle is solved in main.js

// ---------------------------------------------------------------------------
// solveLayout (§13 step 3) — the tornado solve as a PURE FUNCTION. Everything
// the solve consumes arrives as an argument: the walk angles and D4 (the
// spec), the mesh centre-distances (pitch-radius sums), and — crucially — the
// SWEPT RADII the balance-clearance solve binds on. Those are measured from
// the built meshes by the CALLER (vertex max: bevels and screw-tip corners
// are real, boxes over-report — the shipped lesson), because measuring is
// main.js's job and purity here means "same inputs, same outputs", not
// "pretends geometry doesn't exist". Called twice with different specs in
// one process, it returns two independent layouts — which is the §13
// regression suite: the current spec must reproduce the fingerprint
// baseline's positions exactly.
//
// Returns { P, BALANCE_STEP_DEG, forkBaseAngle, PIN_AIM } — the shifted
// position table and the three byproducts the build consumes downstream.
// Every expression is ported VERBATIM from the in-line solve so the
// floating-point sequence (and therefore the geometry fingerprint) is
// bit-identical.
export function stepPos(prev, angleDeg, dist) {
  const a = angleDeg * (Math.PI / 180);
  return { x: prev.x + Math.cos(a) * dist, y: prev.y + Math.sin(a) * dist };
}

export function solveLayout({
  barrelStepDeg = BARREL_STEP_DEG,
  d4 = D4,
  escapeStepDeg = ESCAPE_STEP_DEG,
  balanceStepTargetDeg = BALANCE_STEP_TARGET_DEG,
  radii,          // { barrel, centerPinion, centerWheel, thirdPinion, thirdWheel, fourthPinion, fourthWheel, escapePinion }
  escToBalance,   // escape arbor → balance arbor
  palletStone,    // escape arbor → fork pivot, along the escape→balance line
  swept,          // { great, center, third, fourth, escape, balance } — measured swept radii
  clearMargin = CLEAR_MARGIN,
  warn = () => {},
}) {
  const DEG2RAD = Math.PI / 180;
  const barrelPos = { x: 0, y: 0 };
  const centerPos = stepPos(barrelPos, barrelStepDeg, radii.barrel + radii.centerPinion);
  // centre→third→fourth two-bar: the fourth lands EXACTLY d4 below the centre.
  const d1CT = radii.centerWheel + radii.thirdPinion;
  const d2TF = radii.thirdWheel + radii.fourthPinion;
  const thirdWedgeDeg =
    Math.acos((d1CT * d1CT + d4 * d4 - d2TF * d2TF) / (2 * d1CT * d4)) / DEG2RAD;
  const thirdPos = stepPos(centerPos, -90 - thirdWedgeDeg, d1CT);
  const fourthPos = { x: centerPos.x, y: centerPos.y - d4 };
  const escapePos = stepPos(fourthPos, escapeStepDeg, radii.fourthWheel + radii.escapePinion);
  // BALANCE_STEP_DEG — solved from the swept-radius clearance constraint.
  const rBal = swept.balance;
  const obstacles = [
    { pos: barrelPos, rr: swept.great + rBal + clearMargin },
    { pos: centerPos, rr: swept.center + rBal + clearMargin },
    { pos: thirdPos, rr: swept.third + rBal + clearMargin },
    { pos: fourthPos, rr: swept.fourth + rBal + clearMargin },
    { pos: escapePos, rr: swept.escape + rBal + clearMargin },
  ];
  const ok = (deg) => {
    const p = stepPos(escapePos, deg, escToBalance);
    return obstacles.every((o) => Math.hypot(p.x - o.pos.x, p.y - o.pos.y) >= o.rr);
  };
  let BALANCE_STEP_DEG;
  if (ok(balanceStepTargetDeg)) {
    BALANCE_STEP_DEG = balanceStepTargetDeg;
  } else {
    const edge = (s) => {
      let hi = 0.25;
      while (hi <= 90 && !ok(balanceStepTargetDeg + s * hi)) hi += 0.25;
      if (hi > 90) return Infinity;
      let lo = hi - 0.25;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (ok(balanceStepTargetDeg + s * m)) hi = m; else lo = m;
      }
      return hi;
    };
    const down = edge(-1), up = edge(1);
    if (down === Infinity && up === Infinity) {
      warn('balance step: no clear angle about the escape arbor — leaving the target');
      BALANCE_STEP_DEG = balanceStepTargetDeg;
    } else {
      BALANCE_STEP_DEG = balanceStepTargetDeg + (down <= up ? -down : up);
    }
  }
  const balancePos = stepPos(escapePos, BALANCE_STEP_DEG, escToBalance);
  // Fork pivot on the escape→balance line; pin aim at mid-swing.
  const toBalance = { x: balancePos.x - escapePos.x, y: balancePos.y - escapePos.y };
  const toBalanceLen = Math.hypot(toBalance.x, toBalance.y) || 1;
  const uBalance = { x: toBalance.x / toBalanceLen, y: toBalance.y / toBalanceLen };
  const forkPivotPos = { x: escapePos.x + uBalance.x * palletStone, y: escapePos.y + uBalance.y * palletStone };
  const forkBaseAngle = Math.atan2(uBalance.x, -uBalance.y);
  const PIN_AIM = Math.atan2(forkPivotPos.y - balancePos.y, forkPivotPos.x - balancePos.x);
  const dialCenterXY = { x: centerPos.x, y: centerPos.y };
  // Recenter on the CENTER-WHEEL arbor (dial concentric with the plate).
  const centroid = { x: centerPos.x, y: centerPos.y };
  const shift = (p) => ({ x: p.x - centroid.x, y: p.y - centroid.y });
  const P = {
    barrel: shift(barrelPos), center: shift(centerPos), third: shift(thirdPos),
    fourth: shift(fourthPos), escape: shift(escapePos), balance: shift(balancePos),
    fork: shift(forkPivotPos), dial: shift(dialCenterXY),
  };
  return { P, BALANCE_STEP_DEG, forkBaseAngle, PIN_AIM };
}

// ---------------------------------------------------------------------------
// Keyless-works frame constants (§13 step 3b) — the DECLARED spec of the
// stem-side cluster, hoisted beside the counts that gear it. The distances
// derived from these come out of solveKeyless below.
// ---------------------------------------------------------------------------
export const CROWN_PULL_DIST = 5; // stem/crown outward slide when pulled to set
export const SL_C = 10;        // setting-lever pivot's lateral offset from the stem axis
export const SL_TAIL = 6;      // lever tail arm length (pivot → post)
export const GROOVE_LOCAL = 4; // stem groove collars sit this far outboard of the sliding pinion
export const YK_C = 7.5;       // yoke pivot's lateral offset, opposite side of the stem

// ---------------------------------------------------------------------------
// solveKeyless (§13 step 3b) — the P-dependent XY FRAME as a pure function:
// the stem line (uWind/vPerp/sideSign), the keyless cluster's distances
// along it, the setting-lever/yoke pivots with their pull-driven angle
// functions, the plate radius, and the dial-side locals that radius fixes
// (dialRadius, sub-dial positions, the shared sub-dial well radius).
// Same contract as solveLayout: everything measured arrives as an argument
// (outline — each part's own outline radius, with the drum's REAL radius
// under 'barrel'), pitch radii are closed-form from the module/teeth
// constants above, and every expression is ported VERBATIM so the geometry
// fingerprint is bit-identical. main.js destructures the result under the
// same names the in-line block used to declare, so downstream consumers —
// plate openings, keyless assembly, dial build — are unchanged.
// ---------------------------------------------------------------------------
export function solveKeyless({
  P,              // solveLayout's position table (shifted, centre-arbor origin)
  outline,        // { barrel, center, third, fourth, escape, balance, fork, dial } — outline radii for the plate bound
  warn = () => {},
}) {
  const barrelDist = Math.hypot(P.barrel.x, P.barrel.y) || 1;
  const uWind = { x: P.barrel.x / barrelDist, y: P.barrel.y / barrelDist };
  const stemAngle = Math.atan2(uWind.y, uWind.x);
  // Which side of the stem line the balance (and hence the setting lever)
  // lives on. NOTE: with the tornado layout the balance sits
  // almost exactly ON the stem line's far extension (perpendicular distance
  // ≈ 1 unit), so this sign holds by a thin margin — nudging the balance step
  // TARGET, the solved clearances feeding BALANCE_STEP_DEG, or the barrel
  // angle can silently mirror the whole lever/yoke/hack-spring assembly.
  // Warned here (the clearance solve now MOVES the balance, so a silent
  // flip is a live failure mode, not a hypothetical): |projection| ≈ 0.79
  // after the solve, vs ≈ 0.97 at the raw target.
  const vPerp = { x: -uWind.y, y: uWind.x };
  const sideProj = P.balance.x * vPerp.x + P.balance.y * vPerp.y;
  const sideSign = Math.sign(sideProj) || 1;
  if (Math.abs(sideProj) < 0.5) {
    warn(`keyless side sign nearly degenerate (balance ${sideProj.toFixed(2)} off the stem line) — lever/yoke/hack layout may mirror`);
  }
  const barrelR = (TRAIN.barrel.module * TRAIN.barrel.teeth) / 2; // DESIGN radius — closed-form, same expression main.js derives
  const ratchetR = barrelR * 0.34;                       // matches makeBarrel's ratR
  const crownWheelR = (KW_MODULE * crownWheelTeeth) / 2;
  const windPinionR = (KW_MODULE * windPinionTeeth) / 2;
  const settingWheelR = (KW_MODULE * settingWheelTeeth) / 2;
  const minuteWheelR = (KW_MODULE * minuteWheelTeeth) / 2;
  // The transfer wheel drives a plain 24-tooth WINDING SPUR on the fusee
  // arbor (the saw-toothed ratchet lives on the plate top now, serving only
  // the click). Same tooth count as the ratchet keeps the crown→fusee ratio;
  // equal module makes the mesh honest — the old layout gear-meshed the
  // ratchet's saw teeth at an effective module of 0.408 against KW_MODULE.
  const windSpurR = (KW_MODULE * WIND_SPUR_TEETH) / 2;
  // Winding transfer arbor axis — one spur-mesh distance outboard of the
  // barrel, with the same +0.1 slop every keyless mesh uses (see mwFoldD).
  const cwDist = barrelDist + windSpurR + crownWheelR + 0.1;
  const pinDist = cwDist + crownWheelR + windPinionR * 0.55; // sliding pinion, pushed in (teeth overlap the wheel rim, bevel-style)
  const pinOutDist = pinDist + CROWN_PULL_DIST;              // ...pulled out → setting mesh
  const swDist = pinOutDist + windPinionR * 0.55 + settingWheelR;
  // The minute wheel FOLDS perpendicularly off the stem line (see the
  // setting-path assembly for why).
  const mwFoldD = settingWheelR + minuteWheelR + 0.1;
  const minuteArborXY = {
    x: uWind.x * swDist - sideSign * vPerp.x * mwFoldD,
    y: uWind.y * swDist - sideSign * vPerp.y * mwFoldD,
  };
  // Setting lever & yoke pivots + the pull-driven angle solves. Solved with
  // the layout: the lever's tail-post ARC is what the plate's slot is cut
  // from, and every hack/reset solver downstream keys off tailPostWorldAt.
  const slMidAlong = pinDist + CROWN_PULL_DIST / 2 + GROOVE_LOCAL;
  const settingLeverPivot = {
    x: uWind.x * slMidAlong + sideSign * vPerp.x * SL_C,
    y: uWind.y * slMidAlong + sideSign * vPerp.y * SL_C,
  };
  function settingLeverAngleAt(pull) {
    const along = pinDist + pull * CROWN_PULL_DIST + GROOVE_LOCAL;
    const gx = uWind.x * along, gy = uWind.y * along;
    return Math.atan2(gy - settingLeverPivot.y, gx - settingLeverPivot.x) - Math.PI / 2;
  }
  function tailPostWorldAt(pull) {
    const a = settingLeverAngleAt(pull);
    return {
      x: settingLeverPivot.x + Math.sin(a) * SL_TAIL,
      y: settingLeverPivot.y - Math.cos(a) * SL_TAIL,
    };
  }
  const postEng = tailPostWorldAt(1);
  const postRel = tailPostWorldAt(0);
  // The post swings on the lever's tail, so its track between the two crown
  // poses is an ARC, not the chord — both plates' slots need the bow.
  const kwPostBow = (() => {
    const chord = { x: postEng.x - postRel.x, y: postEng.y - postRel.y };
    const L = Math.hypot(chord.x, chord.y) || 1;
    let bow = 0;
    for (let i = 0; i <= 40; i++) {
      const p = tailPostWorldAt(i / 40);
      const t = ((p.x - postRel.x) * chord.x + (p.y - postRel.y) * chord.y) / (L * L);
      bow = Math.max(bow, Math.hypot(p.x - postRel.x - t * chord.x, p.y - postRel.y - t * chord.y));
    }
    return bow;
  })();
  const yokeMidAlong = pinDist + CROWN_PULL_DIST / 2;
  const yokePivot = {
    x: uWind.x * yokeMidAlong - sideSign * vPerp.x * YK_C,
    y: uWind.y * yokeMidAlong - sideSign * vPerp.y * YK_C,
  };
  function yokeAngleAt(pull) {
    const along = pinDist + pull * CROWN_PULL_DIST;
    const px = uWind.x * along, py = uWind.y * along;
    return Math.atan2(py - yokePivot.y, px - yokePivot.x) - Math.PI / 2;
  }

  // Plate radius: tightest circle (plus a rim margin) that contains each part's
  // own outline — arbor distance plus that part's radius, not a blanket maximum.
  let plateR = 20;
  for (const key in P) {
    plateR = Math.max(plateR, Math.hypot(P[key].x, P[key].y) + (outline[key] || 0));
  }
  plateR += 5;
  // Keyless floor: the plate must reach 1 unit past the setting wheel and
  // past the folded minute wheel (with the compact tornado train, this floor
  // — not the train extent — is what sizes the plate).
  plateR = Math.max(
    plateR,
    swDist + settingWheelR + 1,
    Math.hypot(swDist, mwFoldD) + minuteWheelR + 1,
  );

  // --- Dial-side locals the plate radius fixes (moved from the dial build,
  // §13 step 3b — one source; ALARM_CD's plate-bore hoist reads these too) ---
  const dialRadius = plateR * 0.92;
  // Sub-dial positions in dial-local coordinates (+y = 12 o'clock; the
  // dialFace Y-flip makes these read correctly from the front).
  // 12 o'clock — symmetric with the small-seconds sub-dial at 6 (the fourth
  // wheel sits D4 below centre); also much closer to the barrel's dial-side
  // projection than the old 6-o'clock spot, so the reserve reduction train
  // spans a shorter, cleaner run.
  const RESERVE_LOCAL = { x: 0, y: dialRadius * 0.39 };
  // Small seconds live ON the fourth wheel's axis — dial-local coordinates
  // mirror world x through the dialFace Y-flip.
  const SECONDS_LOCAL = { x: -(P.fourth.x - P.dial.x), y: P.fourth.y - P.dial.y };
  // Sub-dial radius — as large as the face allows while staying balanced:
  // one shared radius for both wells (their pivots are fixed on their
  // arbors, so only the radius can grow), capped by the clearance the
  // central hands' boss needs around the dial centre. This lands ≈ 0.30 of
  // the dial radius (up from 0.2); the bigger wells swallow the XI/I and
  // V/VII numerals symmetrically, leaving II–IIII and VIII–X.
  // §25 C tightened this constant: the sub-dial WELLS' walls descend through
  // the gear lane (z −7.0..−6.5), and their rings pass within (centre distance
  // − wellR) of the dial centre — the central SETTING WHEEL (tip 4.83) needs
  // wellR ≤ 15.4 − 4.83 − 0.2 (wall) − 0.15 (margin) ≈ 10.2. The old −4.5
  // (wellR 10.9) had the wall passing straight through the wheel's teeth,
  // masked in the sweep by the wheel⇄Dial EXPECTED blanket; the clearance is
  // boot-asserted at the alarm block.
  const subDialR = Math.min(RESERVE_LOCAL.y, -SECONDS_LOCAL.y) - 5.2;

  return {
    barrelDist, uWind, stemAngle, vPerp, sideSign,
    ratchetR, crownWheelR, windPinionR, settingWheelR, minuteWheelR, windSpurR,
    cwDist, pinDist, pinOutDist, swDist, mwFoldD, minuteArborXY,
    settingLeverPivot, settingLeverAngleAt, tailPostWorldAt, postEng, postRel,
    kwPostBow, yokePivot, yokeAngleAt,
    plateR, dialRadius, RESERVE_LOCAL, SECONDS_LOCAL, subDialR,
  };
}
