// §117 — THE RELEASE TAKE-OFF, AS A STRAIGHT LINE.
//
// CLAUDE.md's "design in a line, fold to fit": the chain is laid out
// input-to-output with no corridors, and the quantities it establishes are the
// LINE SPEC the folded build must measure back to. In the line it is
// structurally impossible to pay for packaging with a lever arm.
//
// THE PROBLEM. TODO 117's decided topology (2026-08-29) makes the reader ride
// the HOUR and the disc hold the SET, so the trip becomes a coincidence rather
// than a difference and the whole back-driven branch dissolves. What it leaves
// open is the expensive half: the reader now ORBITS, and its output has to
// leave the orbit. probe-feeler-travel.mjs found the constraint (a reader
// confined to the track radius orbits freely; today's 14.261 arm gets 45° of
// fragments) and probe-117-takeoff.mjs priced the space (a free coaxial ring
// exists in the reader's own corridor at the track radius). This is the design
// those two measurements were for.
//
// THE LINE, four members, input to output:
//
//   1  DISC          the notch — carries SET only, holds still while armed.
//   2  READER RING   coaxial, axially free, hour-carried: a pin on its
//                    disc-side face at the track radius, a plain annulus on
//                    its dial-side face. The pin drops into the notch; the
//                    whole ring follows it down; the annulus presents that
//                    drop at EVERY azimuth at once.
//   3  RELEASE LEVER today's feeler lever, its inboard tip re-seated from the
//                    disc's track onto the ring's face — at the same radius.
//   4  PAWL BEAK     unchanged: withdraws from the contrate band, releasing
//                    the alarm train.
//
// WHY THE RING CARRIES NO RATIO, which is the whole design. A ring is present
// at every azimuth simultaneously, so the take-off's only free quantity is the
// RADIUS at which the lever reads it. Put that radius anywhere but the pin's
// own and the lever's input arm changes, which forks ALARM_FEELER_ARM_LEN and
// with it every §29 step-4 number — the withdrawal, the banking stop's gap,
// the bias blade's deflection, the silence finger's force. Put it AT the pin's
// radius and the take-off is 1:1: the orbit is crossed and nothing is spent.
// That is the fold rule's own test, applied to the one member the fold adds.
//
// WHAT BOUNDS THE RING'S STAND-OFF is NOT the clearance. The pin is a
// tip-loaded cantilever of fixed radius — fixed because ALARM_NOTCH_W is
// derived from the pin's diameter over the track radius, so a fatter pin
// re-cuts the notch and narrows the trip window §38/TODO 8 already asserts
// against a tick's advance. So §54's slenderness ceiling sets how far the ring
// may stand off the disc, and the free-ring map's job is to CONFIRM that plane
// is empty rather than to choose it. Measured, the two agree to 0.02.
//
// ACCEPTANCE — exits non-zero. Every row is a relation this design claims;
// each is computed from the constants named beside it and asserted, and the
// three controls below are must-fail cases that prove the assertions can.
//
// Run: node tools/probe-117-line.mjs
//
// ---- constants, restated with their source names ---------------------------
const UNIT_MM = 0.72 / 1.9;                 // layout.js — CHAIN_PITCH_MM / CHAIN_PITCH
const CLEAR_MARGIN = 0.15;                  // layout.js — the ONE margin
const STOCK_MIN_U = 0.12 / UNIT_MM;         // layout.js — §50's floor stock
const SPRING_FLAT_U = 0.05 / UNIT_MM;       // layout.js — spring flat stock
const STEEL_E_PA = 200e9;                   // layout.js — the one steel
const SLENDER_MAX = 30;                     // layout.js — §54's ceiling, span basis
const SLENDER_OVERHANG_K = Math.cbrt(48 / 3); // layout.js — a tip-loaded overhang's penalty, ∛16
const DETENT_MN = [5, 50];                  // layout.js SELECTOR_DETENT_WINDOW_MN — TODO 16's envelope

const ALARM_PIN_DROP = 0.10;                // main.js — the stop-banked travel
const ALARM_PIN_R = 0.14;                   // main.js — pin radius; ALARM_NOTCH_W is derived from its diameter
const ALARM_TRACK_RMID = 3.05;              // main.js — the track annulus' mid radius
const ALARM_FEELER_PIVOT_R = 5.5;           // main.js — the lever's pivot station
const ALARM_FEELER_ARM_LEN = ALARM_FEELER_PIVOT_R - ALARM_TRACK_RMID;  // main.js — pivot → pin
const ALARM_FEELER_BEAR_R = ALARM_FEELER_ARM_LEN * 0.45;               // main.js — bias blade's bearing station
const ALARM_FEELER_SPR_FREE = 0.7;          // main.js — stud outboard of the pivot
const ALARM_PAWL_ENGAGE = 0.06;             // main.js — beak's reach into the contrate band
const PIVOT_TO_CLIMB = 10.427;              // main.js — |pivot → climb axis|, the withdrawal's lever arm
                                            //   (ALARM_PAWL_DIST + contrateR + 0.35, as §29's own assert writes it)

// layout.js's cantilever law, restated: I = a·c³/12, k = 3EI/L³.
const cantileverK_N_per_m = (a_u, c_u, L_u) => {
  const m = UNIT_MM / 1000;
  const I = (a_u * m) * (c_u * m) ** 3 / 12;
  return 3 * STEEL_E_PA * I / (L_u * m) ** 3;
};
// Same law for a round pin: I = πR⁴/4.
const pinK_N_per_m = (R_u, L_u) => {
  const m = UNIT_MM / 1000;
  const I = Math.PI * (R_u * m) ** 4 / 4;
  return 3 * STEEL_E_PA * I / (L_u * m) ** 3;
};
// §54's basis: λ = L / r_gyration, an OVERHANG multiplied by K before it is
// compared against the span-calibrated ceiling.
const overhangLambda = (L_u, rGyr_u) => SLENDER_OVERHANG_K * L_u / rGyr_u;

// ---- the fold's measured stations ------------------------------------------
// NOT line-spec quantities: these are this movement's, measured by
// probe-117-takeoff.mjs over the 42-pose net, and they are quoted so the line's
// requirements can be held against the space that actually exists.
const FOLD = {
  trackTopZ: -5.380,       // world z of the disc's track top — the disc unit's near face
  dialBackZ: -8.350,       // world z of the dial's back face — the feeler bracket's root
  ringCellZ: -6.35,        // the free-ring map's best cell at the track radius, in the reader's corridor
  ringCellClear: 0.4500,   // its clearance, with EVERY unit an obstacle (carrier-excluded reads identically)
  fitC: 0.01,              // the movement's one stated running-fit figure (the lifter fork's)
};

const checks = [];
const push = (name, ok, got, want) => checks.push({ name, ok, got, want });
const near = (a, b, tol = 1e-12) => Math.abs(a - b) < tol;

// ============================================================================
// ROW 1 — the take-off carries no ratio.
// Constraint: the fold rule forbids paying for packaging with a lever arm, and
// the take-off is the one member the fold adds. Reading the ring at the pin's
// own radius leaves the lever's input arm exactly as built.
const takeoffR = ALARM_TRACK_RMID;
const leverArmIn = ALARM_FEELER_PIVOT_R - takeoffR;
push('take-off radius = the pin\'s own radius', near(takeoffR, ALARM_TRACK_RMID),
  takeoffR, ALARM_TRACK_RMID);
push('the lever\'s input arm is INHERITED, not forked', near(leverArmIn, ALARM_FEELER_ARM_LEN),
  leverArmIn, ALARM_FEELER_ARM_LEN);
const takeoffGain = 1;   // a ring's face moves with the pin, one for one
push('the take-off\'s displacement gain is exactly 1', near(takeoffGain, 1), takeoffGain, 1);

// ============================================================================
// ROW 2 — the output is therefore unchanged.
// Constraint: §29's beak must withdraw clear of its engagement by one margin.
// Computed twice — through the shipped chain (pin on the track) and through the
// designed one (pin on the ring, ring read by the lever) — and asserted EQUAL,
// which is what "1:1" has to mean if it means anything.
const wdShipped = ALARM_PIN_DROP * PIVOT_TO_CLIMB / ALARM_FEELER_ARM_LEN;
const wdDesigned = (ALARM_PIN_DROP * takeoffGain) * PIVOT_TO_CLIMB / leverArmIn;
push('the beak\'s withdrawal is unchanged by crossing the orbit', near(wdDesigned, wdShipped),
  wdDesigned.toFixed(6), wdShipped.toFixed(6));
push('withdrawal clears the engagement by one margin',
  wdDesigned - ALARM_PAWL_ENGAGE >= CLEAR_MARGIN - 1e-12,
  (wdDesigned - ALARM_PAWL_ENGAGE).toFixed(4), `≥ ${CLEAR_MARGIN}`);

// ============================================================================
// ROW 3 — the pin's length, and with it the ring's plane.
// Constraint: §54's ceiling on a TIP-LOADED overhang. The pin's radius is not
// available (ALARM_NOTCH_W derives from its diameter), so the ceiling bounds
// the length and the length bounds the stand-off.
const rGyrPin = ALARM_PIN_R / 2;                    // circular section
const pinLenMax = SLENDER_MAX * rGyrPin / SLENDER_OVERHANG_K;
const ringT = STOCK_MIN_U;                          // §50's floor — the ring is a plain annulus
const standoff = pinLenMax + ringT / 2;             // track top → ring's mid-plane
const ringPlaneZ = FOLD.trackTopZ - standoff;       // world; the corridor runs toward more negative z
// This one is the derivation read back through the λ formula — two code paths
// for one relation, not a test of the design. It is kept because inverting a
// formula is exactly where a sign or a factor goes missing, and labelled so
// nobody counts it as evidence.
push('RESTATED the derived length reads back at §54\'s ceiling',
  near(overhangLambda(pinLenMax, rGyrPin), SLENDER_MAX, 1e-9),
  overhangLambda(pinLenMax, rGyrPin).toFixed(4), SLENDER_MAX);
// The row that is evidence: WHICH constraint binds. If the clearance corridor
// were the tighter of the two, this design would be a packaging problem and the
// stand-off would be a number to negotiate; it is not, and that is why the ring's
// plane is derived from the pin rather than from the map.
const corridorPinLen = Math.abs(FOLD.trackTopZ - FOLD.dialBackZ) - ringT / 2;
push('§54 BINDS, the corridor does not — the stand-off is a structural number',
  pinLenMax < corridorPinLen,
  `§54 allows ${pinLenMax.toFixed(4)}, the corridor ${corridorPinLen.toFixed(4)}`,
  'the ceiling is the tighter of the two');
push('the ring\'s plane lands where the free-ring map says the corridor is empty',
  Math.abs(ringPlaneZ - FOLD.ringCellZ) <= 0.25 + 1e-9,      // half the map's 0.5 cell
  ringPlaneZ.toFixed(4), `${FOLD.ringCellZ} ± 0.25 (the map's cell)`);
push('the ring\'s own section fits inside that cell\'s allowance',
  FOLD.ringCellClear - ringT / 2 >= CLEAR_MARGIN - 1e-12,
  (FOLD.ringCellClear - ringT / 2).toFixed(4), `≥ ${CLEAR_MARGIN}`);
const ringTMax = 2 * (FOLD.ringCellClear - CLEAR_MARGIN);
push('and the thickness window is open, not a single value', ringTMax > STOCK_MIN_U,
  `${STOCK_MIN_U.toFixed(4)} … ${ringTMax.toFixed(4)}`, 'a window');

// ============================================================================
// ROW 4 — the force path, and the compliance the ring adds to it.
// Constraint: the ring carries no spring of its own. The release lever's
// existing bias blade already seats the pin, and moving the contact from the
// track to the ring's face only makes that force path one member longer. A
// member in series ROBS the seat in proportion to its compliance (TODO 79's
// lesson), so the pin's stiffness has to dominate the blade's.
const kBlade = cantileverK_N_per_m(SPRING_FLAT_U, SPRING_FLAT_U, ALARM_FEELER_SPR_FREE + ALARM_FEELER_BEAR_R);
const kPin = pinK_N_per_m(ALARM_PIN_R, pinLenMax);
const stiffRatio = kPin / kBlade;
const seatLossFrac = 1 / (1 + stiffRatio);          // series springs
push('the pin does not rob the seat', seatLossFrac <= 0.05,
  `${(seatLossFrac * 100).toFixed(2)}% of the seating force`, '≤ 5%');
// The load the ring actually carries, TODO 16's format. It is the blade's TOTAL
// force, not the change over the stroke: the change (16.72 mN) is what the
// silence chain already declares at ALARM_SIL_FINGER_MN, because a finger only
// feels what moves — but the ring is in the path the whole time and carries the
// lot. Both ends of the stroke are reported; the seat is deflected
// ALARM_FEELER_SEAT_DROP while riding and one CLEAR_MARGIN less at the bank.
const ALARM_FEELER_SEAT_DROP = ALARM_PIN_DROP + CLEAR_MARGIN;   // main.js
const bladeF_mN = (drop) => kBlade * drop * (ALARM_FEELER_BEAR_R / ALARM_FEELER_ARM_LEN) * (UNIT_MM / 1000) * 1000;
const loadRiding = bladeF_mN(ALARM_FEELER_SEAT_DROP);
const loadDropped = bladeF_mN(ALARM_FEELER_SEAT_DROP - ALARM_PIN_DROP);
const loadMN = loadRiding;                                       // the worst of the two
const loadChange = loadRiding - loadDropped;
push('the load is inside the detent envelope (inherited, never forkable)',
  loadDropped >= DETENT_MN[0] && loadRiding <= DETENT_MN[1],
  `${loadDropped.toFixed(2)} … ${loadRiding.toFixed(2)} mN`, `${DETENT_MN[0]}–${DETENT_MN[1]} mN`);
push('and its CHANGE reproduces the silence chain\'s declared figure',
  near(loadChange, kBlade * ALARM_PIN_DROP * (ALARM_FEELER_BEAR_R / ALARM_FEELER_ARM_LEN) * (UNIT_MM / 1000) * 1000, 1e-9),
  `${loadChange.toFixed(2)} mN`, 'ALARM_SIL_FINGER_MN\'s own k·δ');

// ============================================================================
// ROW 5 — the journal, which is this design's one open structural question.
// Constraint: the pin bears at the HOUR's azimuth and the lever reads at the
// RELEASE azimuth, so the ring carries a couple whose arm is the chord between
// them — 2·takeoffR at worst, and ZERO when the pin passes under the lever. The
// journal reacts it, and the tilt it permits shows up directly as a read error
// that varies with the pin's azimuth. (A CONSTANT error would be harmless: the
// banking stop absorbs an offset. It is the variation that has to be budgeted.)
//
// THE BUDGET IS DERIVED, and the first draft of this file did not derive it. It
// budgeted a tenth of the stroke — a number nobody had a reason for, picked, and
// then used to conclude that the journal is short. Concluding from a picked
// number is the wrong shape of argument even when the conclusion survives. What
// actually bounds the read error is FALSE RELEASE: a spurious read of δ
// withdraws the beak by δ·(the lever's gain), and once that reaches
// ALARM_PAWL_ENGAGE the alarm has released with no notch under the pin. That is
// the beak's own metal and the lever's own arms — nothing chosen.
const coupleArm = 2 * takeoffR;
const beakGain = PIVOT_TO_CLIMB / ALARM_FEELER_ARM_LEN;
const readErrMax = ALARM_PAWL_ENGAGE / beakGain;               // false release — the hard bound
// The other failure mode, for comparison: a read error the other way EATS the
// genuine drop, and the release is lost when the shortened travel no longer
// clears the engagement by one margin. Which of the two binds is a fact about
// this chain, not an assumption, so it is asserted below rather than asserted in
// prose.
const readErrLost = ALARM_PIN_DROP - (ALARM_PAWL_ENGAGE + CLEAR_MARGIN) / beakGain;
const journalMin = 2 * takeoffR * FOLD.fitC / readErrMax;      // L ≥ 2·r·c / budget
const corridor = Math.abs(FOLD.trackTopZ - FOLD.dialBackZ);
push('the couple\'s arm is the chord, and it is stated not assumed', near(coupleArm, 6.1),
  coupleArm.toFixed(3), '2 · the take-off radius');
// The tilt is CLEARANCE-limited, not force-limited: any couple at all drives the
// ring to the end of its bore's slack, so the load above sizes the bearing's
// contact and plays no part in this length. Asserting that is worth a row,
// because reading a force into this arithmetic is the obvious mistake.
push('FALSE RELEASE binds, not lost release — so the budget comes from the beak',
  readErrMax < readErrLost,
  `false ${readErrMax.toFixed(5)} vs lost ${readErrLost.toFixed(5)}`,
  'the tighter of the two is the budget');
push('the budget is the beak\'s engagement over the lever\'s gain, nothing picked',
  near(readErrMax, ALARM_PAWL_ENGAGE / beakGain),
  `${readErrMax.toFixed(5)} = ${ALARM_PAWL_ENGAGE} / ${beakGain.toFixed(4)}`,
  'ALARM_PAWL_ENGAGE / (PIVOT_TO_CLIMB / ARM_LEN)');
push('the journal length is a function of the fit and the budget, not the load',
  near(journalMin, 2 * takeoffR * FOLD.fitC / readErrMax) && journalMin > 0,
  `${journalMin.toFixed(3)} = 2·${takeoffR}·${FOLD.fitC} / ${readErrMax.toFixed(5)}`,
  'no term in mN');
// THE CONCLUSION MUST NOT DEPEND ON THE BUDGET. The hard bound above is the
// LOOSEST defensible read error — it lets the beak sit on the very edge of
// releasing — so any reserve a fold adds only lengthens the journal. Asserting
// that over a spread of budgets is what makes the shortfall a property of the
// movement rather than of this file's arithmetic.
const BUDGETS = [
  ['the beak keeps ALL its engagement (the hard bound)', readErrMax],
  ['a tenth of the stroke (the picked number this replaced)', 0.1 * ALARM_PIN_DROP],
  ['the beak keeps half its engagement', readErrMax / 2],
];
const journalAt = (d) => 2 * takeoffR * FOLD.fitC / d;
push('the shortfall survives EVERY budget, the loosest included',
  BUDGETS.every(([, d]) => journalAt(d) > corridor),
  BUDGETS.map(([, d]) => journalAt(d).toFixed(3)).join(' / '),
  `all > the corridor's ${corridor.toFixed(3)}`);
const fitForCorridor = readErrMax * corridor / (2 * takeoffR);
// REPORTED, not asserted. A row that passes BECAUSE the design has a shortfall
// would fail the day someone fixes it, which is the wrong way round for an
// acceptance test: the residue belongs in the report and in the item.
const journalShort = journalMin > corridor;

// ============================================================================
// ROW 6 — the ring's own return, which the SILENCED state demands and the armed
// one does not. Armed, the ring needs no spring: the release lever's bias blade
// seats it through the pin (ROW 4). Silenced, the rocker lifts that lever OFF
// the ring — which is how silencing works here, and it also leaves the ring
// unlocated. §48/TODO 29's audit is explicit that a part which RECIPROCATES
// either has a restoring element existing as a mesh or is driven both ways, and
// this one would be neither. So the ring carries a light return, and the
// constraint on it is a CEILING rather than a value: it is in parallel with the
// blade all the time the alarm is armed, so it must not disturb the seat the
// whole §29 chain is written on.
const kRetMax = 0.05 * kBlade;
push('the ring\'s return is CAPPED by the seat it must not disturb',
  kRetMax > 0 && kRetMax / kBlade <= 0.05 + 1e-12,
  `k ≤ ${kRetMax.toFixed(1)} N/m`, '≤ 5% of the bias blade');
push('and at that cap it moves the seating force by under a twentieth',
  (kRetMax * ALARM_PIN_DROP * (UNIT_MM / 1000) * 1000) / loadMN <= 0.05,
  `${((kRetMax * ALARM_PIN_DROP * (UNIT_MM / 1000) * 1000) / loadMN * 100).toFixed(2)}%`, '≤ 5%');

// ============================================================================
// CONTROLS — must-fail cases. An assertion nobody has seen fail is a comment.
{
  // A: move the take-off off the pin's radius and the inherited-arm row must break.
  const badR = 4.0;
  const badArm = ALARM_FEELER_PIVOT_R - badR;
  push('CONTROL a take-off at r 4.0 FORKS the lever arm', !near(badArm, ALARM_FEELER_ARM_LEN),
    badArm.toFixed(4), `≠ ${ALARM_FEELER_ARM_LEN}`);
  // and the output moves with it, which is what the fork would cost
  const badWd = ALARM_PIN_DROP * PIVOT_TO_CLIMB / badArm;
  push('CONTROL and that fork moves the withdrawal', !near(badWd, wdShipped, 1e-6),
    badWd.toFixed(4), `≠ ${wdShipped.toFixed(4)}`);
  // B: double the pin and §54 must refuse it.
  push('CONTROL a pin twice the derived length breaks §54\'s ceiling',
    overhangLambda(2 * pinLenMax, rGyrPin) > SLENDER_MAX,
    overhangLambda(2 * pinLenMax, rGyrPin).toFixed(2), `> ${SLENDER_MAX}`);
  // C: a spring-steel pin of the blade's section must FAIL the series test —
  //    the stiffness row has to be able to say no.
  const kSoft = cantileverK_N_per_m(SPRING_FLAT_U, SPRING_FLAT_U, pinLenMax);
  push('CONTROL a pin of spring stock would rob the seat', 1 / (1 + kSoft / kBlade) > 0.05,
    `${(100 / (1 + kSoft / kBlade)).toFixed(1)}%`, '> 5% — the row can refuse');
}

// ---- the road not taken, priced ---------------------------------------------
// A FIXED-LENGTH LINK from the orbiting reader to the fixed lifter. Refused by
// measurement, not by taste: probe-feeler-travel measured that run at 2.682 →
// 31.203 across the orbit. A link is one length.
const LINK_SPREAD = [2.682, 31.203];
push('the fixed link is refused by its own spread',
  LINK_SPREAD[1] / LINK_SPREAD[0] > 10,
  `${(LINK_SPREAD[1] - LINK_SPREAD[0]).toFixed(3)} of spread, ${(LINK_SPREAD[1] / LINK_SPREAD[0]).toFixed(1)}×`,
  'one length');

// ---- report -----------------------------------------------------------------
console.log('§117 — THE RELEASE TAKE-OFF, AS A STRAIGHT LINE\n');
console.log('THE LINE SPEC — the reference a folded build must measure back to:');
const spec = {
  takeoffR, leverArmIn, takeoffGain,
  stroke: ALARM_PIN_DROP,
  withdrawal: +wdDesigned.toFixed(6),
  pinR: ALARM_PIN_R, pinLen: +pinLenMax.toFixed(4), pinLambda: +overhangLambda(pinLenMax, rGyrPin).toFixed(2),
  ringT: +ringT.toFixed(4), ringTMax: +ringTMax.toFixed(4),
  standoff: +standoff.toFixed(4),
  loadMN: +loadMN.toFixed(2), loadChangeMN: +loadChange.toFixed(2), seatLossPct: +(seatLossFrac * 100).toFixed(2),
  coupleArm: +coupleArm.toFixed(3), readErrMax: +readErrMax.toFixed(5), journalMin: +journalMin.toFixed(3),
  ringReturnKMax: +kRetMax.toFixed(1),
};
for (const [k, v] of Object.entries(spec)) console.log(`  ${k.padEnd(14)} ${v}`);
console.log(`\nTHE FOLD'S STATIONS (this movement, measured by probe-117-takeoff.mjs):`);
console.log(`  ring plane      world z ${ringPlaneZ.toFixed(4)}  (the map's cell ${FOLD.ringCellZ}, clear ${FOLD.ringCellClear})`);
console.log(`  reader corridor world z ${FOLD.dialBackZ} … ${FOLD.trackTopZ}  (${corridor.toFixed(3)} deep)`);
console.log(`  journal         ${journalMin.toFixed(3)} needed, ${corridor.toFixed(3)} available in the corridor`
  + `${journalShort ? '  — SHORT, the line\'s one open fold problem' : ''}`);
console.log(`                  → the hub passes through the disc's bore, or the fit tightens to ${fitForCorridor.toFixed(5)}`);
console.log(`  and it holds at every budget, the loosest included:`);
for (const [why, d] of BUDGETS)
  console.log(`      ${why.padEnd(52)} read err ${d.toFixed(5)} → journal ${journalAt(d).toFixed(3)}`
    + `${journalAt(d) > corridor ? '  SHORT' : '  fits'}`);
console.log(`  load            ${loadDropped.toFixed(2)} … ${loadRiding.toFixed(2)} mN on the ring (change ${loadChange.toFixed(2)} mN — the silence chain's figure)`);
console.log('\nROWS');
let bad = 0;
for (const c of checks) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}`);
  console.log(`       got ${c.got}   want ${c.want}`);
}
console.log(`\n${checks.length} rows, ${bad} failing`);
if (bad) process.exit(1);
